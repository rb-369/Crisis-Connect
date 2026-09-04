"""asyncpg connection pool.

Handles the two things that reliably break FastAPI + Supabase:
  1. Supabase requires TLS -- but asyncpg does not accept every libpq
     `sslmode` spelling, so it is stripped from the DSN and passed explicitly.
  2. The Supabase *pooler* (port 6543, pgbouncer transaction mode) cannot use
     prepared statements, so the statement cache must be disabled there.
"""
from __future__ import annotations

import json
import ssl
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

import asyncpg


async def _init_connection(conn: asyncpg.Connection) -> None:
    """Transparent jsonb <-> dict codec on every pool connection, so callers
    pass/receive plain Python dicts/lists (service_details, assessment,
    etc.) instead of hand-rolling json.dumps/loads at each call site."""
    await conn.set_type_codec(
        "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog",
    )

from . import config

_pool: asyncpg.Pool | None = None


def _parse_dsn(dsn: str) -> tuple[str, object | None, int]:
    """Return (clean_dsn, ssl_arg, statement_cache_size)."""
    parsed = urlparse(dsn)
    params = parse_qs(parsed.query)
    sslmode = (params.pop("sslmode", ["prefer"])[0] or "prefer").lower()

    host = parsed.hostname or ""
    is_supabase = "supabase" in host
    is_pooler = parsed.port == 6543 or "pooler" in host

    ssl_arg: object | None = None
    if sslmode in {"require", "verify-ca", "verify-full"} or is_supabase:
        ctx = ssl.create_default_context()
        if sslmode in {"require", "prefer"} or is_supabase:
            # Supabase serves a cert chain many local trust stores don't carry;
            # we still get an encrypted channel, just no CA pinning.
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
        ssl_arg = ctx
    elif sslmode == "disable":
        ssl_arg = False

    clean = urlunparse(parsed._replace(query=urlencode(params, doseq=True)))
    # 0 disables the prepared-statement cache (required behind pgbouncer).
    return clean, ssl_arg, (0 if is_pooler else 100)


async def connect() -> asyncpg.Pool:
    global _pool
    if _pool is not None:
        return _pool
    dsn, ssl_arg, cache = _parse_dsn(config.DATABASE_URL)
    kwargs: dict = {"min_size": 1, "max_size": 10, "statement_cache_size": cache}
    if ssl_arg is not None:
        kwargs["ssl"] = ssl_arg
    if cache == 0:
        # pgbouncer also rejects asyncpg's introspection prepared statements.
        kwargs["server_settings"] = {"jit": "off"}
    try:
        _pool = await asyncpg.create_pool(dsn, init=_init_connection, **kwargs)
        return _pool
    except (ConnectionRefusedError, OSError, asyncpg.PostgresError) as exc:
        parsed_cfg = urlparse(config.DATABASE_URL)
        host = parsed_cfg.hostname or ""
        if host in {"localhost", "127.0.0.1"}:
            raise RuntimeError(
                f"Failed to connect to database at {host}:{parsed_cfg.port or 5432}. "
                "If running on Render or in production, set the DATABASE_URL environment variable "
                "to your Supabase/PostgreSQL connection string."
            ) from exc
        if host.startswith("db.") and "supabase.co" in host:
            raise RuntimeError(
                f"Network unreachable when connecting to '{host}'. "
                "Render does not support IPv6, and Supabase direct database URLs (db.*.supabase.co) are IPv6-only. "
                "Please switch DATABASE_URL to the Supabase Connection Pooler URI (port 6543, "
                "e.g., postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres) "
                "which supports IPv4."
            ) from exc
        raise


async def disconnect() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool not initialised -- app lifespan did not run")
    return _pool


async def fetch(query: str, *args):
    async with pool().acquire() as conn:
        return await conn.fetch(query, *args)


async def fetchrow(query: str, *args):
    async with pool().acquire() as conn:
        return await conn.fetchrow(query, *args)


async def fetchval(query: str, *args):
    async with pool().acquire() as conn:
        return await conn.fetchval(query, *args)


async def execute(query: str, *args) -> str:
    async with pool().acquire() as conn:
        return await conn.execute(query, *args)
