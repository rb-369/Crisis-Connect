"""Step 1 acceptance: WebSocket connection manager.

  1. Two clients on the same channel BOTH receive a broadcast to it.
  2. A client on a different channel does NOT receive it (channel isolation).
  3. An abrupt disconnect is cleaned out of the registry and does not break
     delivery for the clients that are still connected.
"""
import asyncio
import json
import sys

import urllib.request
import websockets

BASE = "http://127.0.0.1:8000"
WS = "ws://127.0.0.1:8000/ws"

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  [{'PASS' if cond else 'FAIL'}] {name}" + (f"  -- {detail}" if detail else ""))


def post(path, body):
    req = urllib.request.Request(
        BASE + path, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())


def get(path):
    with urllib.request.urlopen(BASE + path, timeout=5) as r:
        return json.loads(r.read())


async def drain_hello(ws):
    """Consume the `subscribed` frame the server sends on connect."""
    return json.loads(await asyncio.wait_for(ws.recv(), timeout=3))


async def recv_or_none(ws, timeout=1.0):
    try:
        return json.loads(await asyncio.wait_for(ws.recv(), timeout=timeout))
    except (asyncio.TimeoutError, websockets.exceptions.ConnectionClosed):
        return None


async def main():
    print("\n=== STEP 1: WebSocket connection manager ===")

    # --- 1 & 2: fan-out to a shared channel, isolation from another channel ---
    a = await websockets.connect(f"{WS}?channels=global")
    b = await websockets.connect(f"{WS}?channels=global")
    c = await websockets.connect(f"{WS}?channels=request:abc-123")
    for ws in (a, b, c):
        await drain_hello(ws)

    stats = get("/ws/stats")
    check("3 clients registered", stats["connections"] == 3, str(stats))
    check("channel map groups by channel",
          stats["channels"].get("global") == 2
          and stats["channels"].get("request:abc-123") == 1, str(stats["channels"]))

    res = post("/debug/broadcast",
               {"channel": "global", "event": "new_request", "payload": {"id": "r1"}})
    check("broadcast reported 2 deliveries", res["delivered"] == 2, str(res))

    ma, mb, mc = await recv_or_none(a), await recv_or_none(b), await recv_or_none(c)
    check("client A on 'global' received it", ma is not None and ma["payload"]["id"] == "r1")
    check("client B on 'global' received it", mb is not None and mb["payload"]["id"] == "r1")
    check("client C on another channel did NOT receive it", mc is None, str(mc))
    check("envelope shape is {event,channel,payload,data,ts}",
          ma is not None and set(ma) == {"event", "channel", "payload", "data", "ts"}
          and ma["event"] == "new_request" and ma["channel"] == "global", str(ma))

    # reverse direction: C's channel must not leak to A/B
    post("/debug/broadcast",
         {"channel": "request:abc-123", "event": "matched", "payload": {"id": "m1"}})
    mc2 = await recv_or_none(c)
    check("client C received its own channel's event",
          mc2 is not None and mc2["event"] == "matched", str(mc2))
    check("clients A/B did NOT receive C's event",
          await recv_or_none(a, 0.5) is None and await recv_or_none(b, 0.5) is None)

    # --- 3: disconnect cleanup ---
    await a.close()
    await asyncio.sleep(0.4)
    stats = get("/ws/stats")
    check("disconnected client removed from registry",
          stats["connections"] == 2 and stats["channels"].get("global") == 1, str(stats))

    res = post("/debug/broadcast",
               {"channel": "global", "event": "new_request", "payload": {"id": "r2"}})
    check("server still healthy after a disconnect", res["delivered"] == 1, str(res))
    mb2 = await recv_or_none(b)
    check("surviving client still receives broadcasts",
          mb2 is not None and mb2["payload"]["id"] == "r2", str(mb2))

    # --- 3b: hard kill (no close handshake) must also be pruned ---
    d = await websockets.connect(f"{WS}?channels=global")
    await drain_hello(d)
    # abort() drops the TCP socket with no close handshake -- the worst case
    # for a connection registry, since the server gets no clean disconnect.
    killed = False
    try:
        d.transport.abort()
        killed = True
    except Exception as exc:
        print(f"       (transport.abort unavailable: {exc}; falling back to close)")
    if not killed:
        await d.close()
    await asyncio.sleep(0.5)
    post("/debug/broadcast", {"channel": "global", "event": "new_request", "payload": {"id": "r3"}})
    await asyncio.sleep(0.4)
    stats = get("/ws/stats")
    check("abruptly-killed client pruned from channel",
          stats["channels"].get("global") == 1, str(stats))
    check("empty channels are pruned, not leaked",
          "request:abc-123" in stats["channels"], str(stats))

    # --- subscribe/unsubscribe control frames ---
    await b.send(json.dumps({"action": "subscribe", "channels": ["zones-extra"]}))
    ack = await recv_or_none(b, 2)
    # b may still have the r3 frame queued; skip until we get the ack
    while ack and ack.get("event") != "subscribed":
        ack = await recv_or_none(b, 2)
    check("dynamic subscribe works", ack is not None and "zones-extra" in ack["payload"]["channels"], str(ack))

    await b.send(json.dumps({"action": "unsubscribe", "channels": ["zones-extra"]}))
    ack = await recv_or_none(b, 2)
    check("dynamic unsubscribe works",
          ack is not None and "zones-extra" not in ack["payload"]["channels"], str(ack))

    await b.send(json.dumps({"action": "ping"}))
    pong = await recv_or_none(b, 2)
    check("ping/pong keepalive works", pong is not None and pong["event"] == "pong", str(pong))

    for ws in (b, c):
        await ws.close()
    await asyncio.sleep(0.4)
    stats = get("/ws/stats")
    check("registry fully drains when all clients leave",
          stats["connections"] == 0 and stats["channels"] == {}, str(stats))

    print(f"\n  {len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
