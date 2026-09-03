"""WebSocket connection manager -- channel registry + broadcast + cleanup.

Everything else in the app pushes real-time updates through `manager.broadcast`.

Design notes that matter:
  * The registry lock is NEVER held across an `await ws.send_*`. A slow or dead
    client must not be able to stall broadcasts to everyone else.
  * Each connection has its own send lock, so two concurrent broadcasts can't
    interleave frames on the same socket.
  * Sends are bounded by a timeout; a client that can't keep up is dropped
    rather than being allowed to wedge the broadcast loop.
  * Failed sends are collected and cleaned up *after* the fan-out, so one dead
    socket never aborts delivery to the rest of the channel.
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import WebSocket

log = logging.getLogger("crisisconnect.ws")

SEND_TIMEOUT_S = 5.0


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Connection:
    """One live client socket and the set of channels it is registered to."""

    __slots__ = ("id", "ws", "channels", "_send_lock", "alive")

    def __init__(self, ws: WebSocket):
        self.id = uuid.uuid4().hex[:8]
        self.ws = ws
        self.channels: set[str] = set()
        self._send_lock = asyncio.Lock()
        self.alive = True

    async def send(self, message: dict) -> bool:
        """Send one frame. Returns False if the socket is dead/unwritable."""
        if not self.alive:
            return False
        try:
            async with self._send_lock:
                await asyncio.wait_for(
                    self.ws.send_text(json.dumps(message, default=str)),
                    timeout=SEND_TIMEOUT_S,
                )
            return True
        except asyncio.TimeoutError:
            log.warning("ws %s: send timed out, dropping connection", self.id)
        except Exception as exc:  # client vanished, socket closed, etc.
            log.info("ws %s: send failed (%s), dropping connection", self.id, exc)
        self.alive = False
        return False

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return f"<Connection {self.id} channels={sorted(self.channels)}>"


class ConnectionManager:
    def __init__(self) -> None:
        self._channels: dict[str, set[Connection]] = {}
        self._connections: set[Connection] = set()
        self._lock = asyncio.Lock()

    # ---------------------------------------------------------------- connect
    async def connect(self, ws: WebSocket, channels: list[str] | None = None) -> Connection:
        """Accept the socket and register it to the requested channels."""
        await ws.accept()
        conn = Connection(ws)
        async with self._lock:
            self._connections.add(conn)
        if channels:
            await self.subscribe(conn, channels)
        return conn

    async def subscribe(self, conn: Connection, channels: list[str]) -> list[str]:
        clean = [c.strip() for c in channels if c and c.strip()]
        async with self._lock:
            for ch in clean:
                self._channels.setdefault(ch, set()).add(conn)
                conn.channels.add(ch)
            return sorted(conn.channels)

    async def unsubscribe(self, conn: Connection, channels: list[str]) -> list[str]:
        clean = [c.strip() for c in channels if c and c.strip()]
        async with self._lock:
            for ch in clean:
                subs = self._channels.get(ch)
                if subs:
                    subs.discard(conn)
                    if not subs:                     # prune empty channels
                        self._channels.pop(ch, None)
                conn.channels.discard(ch)
            return sorted(conn.channels)

    # ------------------------------------------------------------- disconnect
    async def disconnect(self, conn: Connection) -> None:
        """Remove a connection from every channel it was in. Idempotent."""
        conn.alive = False
        async with self._lock:
            self._connections.discard(conn)
            for ch in list(conn.channels):
                subs = self._channels.get(ch)
                if subs:
                    subs.discard(conn)
                    if not subs:
                        self._channels.pop(ch, None)
            conn.channels.clear()

    # -------------------------------------------------------------- broadcast
    async def broadcast(self, channel: str, event_type: str, payload: dict) -> int:
        """Fan `payload` out to every live client on `channel`.

        Returns the number of clients the frame was actually delivered to.
        Never raises: a dead subscriber is pruned, not propagated.
        """
        async with self._lock:
            targets = list(self._channels.get(channel, ()))

        if not targets:
            log.debug("broadcast %s -> %s: no subscribers", event_type, channel)
            return 0

        # Dual-key envelope (docs/INTEGRATION-CONTRACT.md S4): `payload` is
        # canonical, `data` is the same object under the co-dev frontend's
        # key name so both client generations work off one broadcast.
        message = {
            "event": event_type,
            "channel": channel,
            "payload": payload,
            "data": payload,
            "ts": _now_iso(),
        }
        results = await asyncio.gather(
            *(c.send(message) for c in targets), return_exceptions=True
        )

        delivered, dead = 0, []
        for conn, ok in zip(targets, results):
            if ok is True:
                delivered += 1
            else:
                dead.append(conn)
        for conn in dead:                    # cleanup happens after fan-out
            await self.disconnect(conn)

        log.info(
            "broadcast %s -> %s: %d delivered, %d pruned",
            event_type, channel, delivered, len(dead),
        )
        return delivered

    async def broadcast_many(self, channels: list[str], event_type: str, payload: dict) -> int:
        total = 0
        for ch in channels:
            total += await self.broadcast(ch, event_type, payload)
        return total

    # ------------------------------------------------------------------ stats
    async def stats(self) -> dict:
        async with self._lock:
            return {
                "connections": len(self._connections),
                "channels": {ch: len(subs) for ch, subs in sorted(self._channels.items())},
            }


manager = ConnectionManager()
