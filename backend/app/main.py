"""CrisisConnect backend -- FastAPI + native WebSockets + Postgres (Supabase)."""
from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from . import config, db, events, expiry
from .demo_seed import DEMO_HELPER, DEMO_REQUESTS, DEMO_ZONE
from .routers import auth as auth_router
from .routers import helpers as helpers_router
from .routers import incidents as incidents_router
from .routers import matches as matches_router
from .routers import messages as messages_router
from .routers import requests as requests_router
from .routers import sos as sos_router
from .routers import zones as zones_router
from .ws import manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
log = logging.getLogger("crisisconnect")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect()
    log.info("DB pool ready")
    expiry.start()
    yield
    await expiry.stop()
    await db.disconnect()
    log.info("DB pool closed")


app = FastAPI(title="CrisisConnect API", version="1.0.0", lifespan=lifespan)

# React (Vite) + Flutter both hit this from other origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(requests_router.router)
app.include_router(zones_router.router)
app.include_router(auth_router.router)
app.include_router(helpers_router.router)
app.include_router(matches_router.router)
app.include_router(messages_router.router)
app.include_router(sos_router.router)
app.include_router(incidents_router.router)


@app.get("/")
async def root():
    return {"service": "crisisconnect", "status": "ok", "docs": "/docs"}


@app.get("/health")
async def health():
    """Liveness + DB reachability -- what Railway/Render health-checks hit."""
    try:
        one = await db.fetchval("select 1")
        db_ok = one == 1
    except Exception as exc:
        return {"status": "degraded", "db": False, "error": str(exc)}
    return {"status": "ok", "db": db_ok}


@app.get("/ws/stats")
async def ws_stats():
    """Live connection registry -- used to prove disconnect cleanup works."""
    return await manager.stats()


@app.get("/events/contract")
async def events_contract():
    """The shared WS contract, served so Dev A can't drift from it."""
    return {
        "events": sorted(events.ALL_EVENTS),
        "channels": {
            "global": [events.NEW_REQUEST, events.ZONE_CONFIRMED, events.INCIDENT_UPDATE],
            "request:{request_id}": [events.MATCHED, events.STATUS_UPDATE],
            "match:{match_id}": [events.NEW_MESSAGE, events.STATUS_UPDATE],
            "incident:{incident_id}": [events.INCIDENT_UPDATE],
        },
        "envelope": {"event": "str", "channel": "str", "payload": {}, "ts": "iso8601"},
        "client_actions": ["subscribe", "unsubscribe", "ping"],
    }


@app.post("/debug/broadcast")
async def debug_broadcast(body: dict):
    """Fire an arbitrary event onto a channel.

    Kept in the app on purpose: it is how both devs smoke-test a client's
    subscription during integration without having to stage real data.
    Body: {"channel": "global", "event": "new_request", "payload": {...}}
    """
    delivered = await manager.broadcast(
        body.get("channel", events.GLOBAL),
        body.get("event", "debug"),
        body.get("payload", {}),
    )
    return {"delivered": delivered}


@app.post("/debug/reseed-demo")
@app.post("/seed")
@app.post("/requests/reseed")
async def reseed_demo():
    """Wipe and reload a curated Mumbai demo scenario.

    Dev tooling only, mirrors the reseed button in the admin header. Clears
    every table (messages/matches/requests/zone_reports/confirmed_zones) --
    intentionally destructive, this is a demo-reset control, not a production
    endpoint.
    """
    async with db.pool().acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "truncate messages, matches, requests, zone_reports, "
                "confirmed_zones restart identity cascade"
            )
            await conn.execute(
                """
                insert into helpers (name, phone, role, org_name, verified, available, lat, lng)
                values ($1,$2,'volunteer',$3,true,true,$4,$5)
                on conflict (phone) do update
                   set name = excluded.name, org_name = excluded.org_name,
                       lat = excluded.lat, lng = excluded.lng
                """,
                DEMO_HELPER["name"], DEMO_HELPER["phone"], DEMO_HELPER["org_name"],
                DEMO_HELPER["lat"], DEMO_HELPER["lng"],
            )
            await conn.execute(
                """
                insert into confirmed_zones (category, center_lat, center_lng, ml_status)
                values ($1,$2,$3,$4)
                """,
                DEMO_ZONE["category"], DEMO_ZONE["center_lat"],
                DEMO_ZONE["center_lng"], DEMO_ZONE["ml_status"],
            )
            for r in DEMO_REQUESTS:
                await conn.execute(
                    """
                    insert into requests (category, urgency, lat, lng, requester_device_id,
                                          requester_name, requester_phone, details,
                                          admin_status, zone_confirmed)
                    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                    """,
                    r["category"], r["urgency"], r["lat"], r["lng"],
                    r["requester_device_id"], r["requester_name"], r["requester_phone"],
                    r["details"], r["admin_status"], r["zone_confirmed"],
                )
    await manager.broadcast(events.GLOBAL, "reseeded", {"status": "ok"})
    return {"message": "Demo data reseeded successfully.", "requests": len(DEMO_REQUESTS)}


# ---------------------------------------------------------------------------
# Path-based WS compatibility route (docs/INTEGRATION-CONTRACT.md S4).
# The co-dev's React components connect as /ws/{channel_type}/{channel_id};
# newer clients use the multiplexed /ws?channels=... below. Both are served
# by the same ConnectionManager, so a broadcast reaches every client
# regardless of which scheme it connected with.
# ---------------------------------------------------------------------------
@app.websocket("/ws/{channel_type}/{channel_id}")
async def websocket_path_endpoint(websocket: WebSocket, channel_type: str, channel_id: str):
    if channel_type in ("admin", "zones", "volunteers", "global"):
        channel = events.GLOBAL
    else:
        channel = f"{channel_type}:{channel_id}"

    conn = await manager.connect(websocket, [channel])
    log.info("ws %s connected (path-based) -> %s", conn.id, channel)
    try:
        await conn.send({
            "event": "connected", "channel": channel,
            "payload": {"connection_id": conn.id, "channels": [channel]},
            "data": {"connection_id": conn.id, "channels": [channel]},
            "ts": None,
        })
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await conn.send({"event": "ack", "echo": raw})
                continue
            if msg.get("action") == "ping" or msg.get("type") == "ping":
                await conn.send({"event": "pong", "payload": {}, "data": {}})
            else:
                await conn.send({"event": "ack", "echo": msg})
    except WebSocketDisconnect:
        log.info("ws %s disconnected (path-based)", conn.id)
    except Exception as exc:  # noqa: BLE001
        log.warning("ws %s errored: %s", conn.id, exc)
    finally:
        await manager.disconnect(conn)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, channels: str = ""):
    """Single WS entry point. Subscribe via ?channels=a,b or a subscribe frame."""
    initial = [c for c in channels.split(",") if c.strip()] if channels else []
    conn = await manager.connect(websocket, initial)
    log.info("ws %s connected -> %s", conn.id, sorted(conn.channels))
    try:
        await conn.send({
            "event": "subscribed",
            "channel": None,
            "payload": {"connection_id": conn.id, "channels": sorted(conn.channels)},
            "ts": None,
        })
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await conn.send({"event": "error", "payload": {"detail": "invalid json"}})
                continue

            action = msg.get("action")
            if action == "subscribe":
                subs = await manager.subscribe(conn, msg.get("channels") or [])
                await conn.send({"event": "subscribed", "payload": {"channels": subs}})
            elif action == "unsubscribe":
                subs = await manager.unsubscribe(conn, msg.get("channels") or [])
                await conn.send({"event": "unsubscribed", "payload": {"channels": subs}})
            elif action == "ping":
                await conn.send({"event": "pong", "payload": {}})
            else:
                await conn.send({
                    "event": "error",
                    "payload": {"detail": f"unknown action: {action!r}"},
                })
    except WebSocketDisconnect:
        log.info("ws %s disconnected", conn.id)
    except Exception as exc:                      # noqa: BLE001 - never leak a leak
        log.warning("ws %s errored: %s", conn.id, exc)
    finally:
        await manager.disconnect(conn)            # always unregister
