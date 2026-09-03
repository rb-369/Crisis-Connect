"""Background sweep for PRD Flow E: auto-expire requests nobody responded to.

Runs as an asyncio task for the life of the process -- appropriate for a
single-instance MVP deployment; a multi-worker deployment would need this
moved to a proper scheduler (or guarded by an advisory lock) to avoid every
worker sweeping in parallel.
"""
from __future__ import annotations

import asyncio
import logging

from . import config, db, events, serialize, incident_status
from .ws import manager

log = logging.getLogger("crisisconnect.expiry")

SWEEP_SQL = """
update requests set status = 'expired', updated_at = now()
 where status = 'requested'
   and updated_at < now() - ($1::int * interval '1 minute')
returning *
"""

_task: asyncio.Task | None = None


async def _sweep_once() -> int:
    rows = await db.fetch(SWEEP_SQL, config.STALE_EXPIRE_MIN)
    if rows:
        async with db.pool().acquire() as conn:
            for row in rows:
                if row["incident_id"] is not None:
                    await incident_status.maybe_auto_resolve(conn, row["incident_id"])

    for row in rows:
        out = serialize.row(row)
        await manager.broadcast(events.request_channel(out["id"]), events.STATUS_UPDATE, out)
        await manager.broadcast(events.GLOBAL, events.STATUS_UPDATE, out)
    if rows:
        log.info("expiry sweep: expired %d stale request(s)", len(rows))
    return len(rows)


async def _loop() -> None:
    while True:
        try:
            await _sweep_once()
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # never let one bad sweep kill the loop
            log.warning("expiry sweep failed: %s", exc)
        await asyncio.sleep(config.EXPIRY_SWEEP_INTERVAL_S)


def start() -> None:
    global _task
    if _task is None:
        _task = asyncio.create_task(_loop())
        log.info(
            "expiry sweep started: every %ss, threshold %smin",
            config.EXPIRY_SWEEP_INTERVAL_S, config.STALE_EXPIRE_MIN,
        )


async def stop() -> None:
    global _task
    if _task is not None:
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
        _task = None
