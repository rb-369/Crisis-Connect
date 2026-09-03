"""PRD gap-fix acceptance: stale-request handling + far-zone flagging.

  1. keepalive resets the staleness clock on an unmatched request.
  2. resolve lets the REQUESTER close their own request (with or without a
     match), and cascades to the match row if one exists.
  3. A request far from every confirmed zone is flagged for extra admin
     scrutiny (admin_status='flagged'), not auto-rejected -- and this does
     NOT happen before any zone exists at all.
  4. The background expiry sweep actually fires and auto-expires a request
     that's gone stale with no keepalive/resolve, broadcasting the change --
     proven against a throwaway server with a short sweep interval, not just
     the SQL in isolation.
"""
import asyncio
import json
import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request

import asyncpg
import websockets

BASE = "http://127.0.0.1:8000"
DSN = "postgresql://kk@localhost:5432/crisisconnect"

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  [{'PASS' if cond else 'FAIL'}] {name}" + (f"  -- {detail}" if detail else ""))


def http(method, path, body=None, base=BASE):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data,
                                 headers={"Content-Type": "application/json"}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw or b"null")
        except json.JSONDecodeError:
            return e.code, {"raw": raw.decode(errors="replace")}


def mk(category, lat, lng, dev="stale-dev", base=BASE):
    st, body = http("POST", "/requests", {
        "category": category, "lat": lat, "lng": lng, "requester_device_id": dev},
        base=base)
    assert st == 201, (st, body)
    return body


async def main():
    print("\n=== PRD gap fixes: keepalive / resolve / far-zone flag / expiry sweep ===")
    conn = await asyncpg.connect(DSN)

    # ------------------------------------------------------------- keepalive
    r = mk("shelter", 21.5000, 77.5946)
    before = await conn.fetchval("select updated_at from requests where id=$1", r["id"])
    await conn.execute(
        "update requests set updated_at = now() - interval '10 minutes' where id=$1", r["id"])
    st, res = http("POST", f"/requests/{r['id']}/keepalive")
    check("keepalive on an unmatched request succeeds", st == 200 and res["kept_alive"] is True,
          f"{st} {res}")
    after = await conn.fetchval("select updated_at from requests where id=$1", r["id"])
    check("keepalive actually bumps updated_at", after > before, f"{before} -> {after}")

    # keepalive on a matched/resolved request is a no-op, not an error
    r2 = mk("shelter", 21.5000, 77.5946)
    await conn.execute("update requests set status='matched' where id=$1", r2["id"])
    st, res = http("POST", f"/requests/{r2['id']}/keepalive")
    check("keepalive on a matched request is a clean no-op",
          st == 200 and res["kept_alive"] is False and res["status"] == "matched", f"{st} {res}")

    st, res = http("POST", "/requests/00000000-0000-0000-0000-000000000000/keepalive")
    check("keepalive on unknown request -> 404", st == 404, str(st))

    # ---------------------------------------------------------------- resolve
    ws = await websockets.connect(f"{BASE.replace('http','ws')}/ws?channels=request:{r['id']}")
    await asyncio.wait_for(ws.recv(), timeout=3)  # drain `subscribed`
    st, res = http("POST", f"/requests/{r['id']}/resolve")
    check("requester resolve (no match yet) succeeds", st == 200 and res["status"] == "resolved",
          f"{st} {res}")
    try:
        frame = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
    except asyncio.TimeoutError:
        frame = None
    check("resolve broadcasts status_update to the requester's own channel",
          frame is not None and frame["event"] == "status_update"
          and frame["payload"]["status"] == "resolved", str(frame))
    await ws.close()

    st, res = http("POST", f"/requests/{r['id']}/resolve")
    check("resolving an already-resolved request is idempotent (no error)",
          st == 200 and res["status"] == "resolved", f"{st} {res}")

    # resolve WITH an active match cascades to the match row
    r3 = mk("medicine", 21.6000, 77.5946)
    hid = await conn.fetchval(
        """insert into helpers (name, phone, role, verified, available)
           values ('Stale Test Helper','+911234500099','volunteer',true,true)
           on conflict (phone) do update set name=excluded.name returning id""")
    st, accept_res = http("POST", f"/requests/{r3['id']}/accept", {"helper_id": str(hid)})
    assert st == 200, (st, accept_res)
    match_id = accept_res["match"]["id"]
    st, res = http("POST", f"/requests/{r3['id']}/resolve")
    check("resolve with an active match succeeds", st == 200 and res["status"] == "resolved")
    match_status = await conn.fetchval("select status from matches where id=$1", match_id)
    check("resolve cascades the linked match to resolved too", match_status == "resolved",
          str(match_status))

    # ------------------------------------------------------- far-zone flagging
    await conn.execute("truncate confirmed_zones")
    isolated = mk("food", 40.0000, 77.5946)  # far from anything, and no zones exist yet
    check("no zones exist yet -> NOT flagged (nothing to correlate against)",
          isolated["admin_status"] == "pending", str(isolated["admin_status"]))

    await conn.execute(
        """insert into confirmed_zones (category, center_lat, center_lng)
           values ('flood', 41.0000, 77.5946)""")
    # Deliberately NOT the same spot as `isolated` -- same coordinates would
    # get picked up as a duplicate of it (Step 4) and folded out of the feed,
    # which would confound the feed-visibility check below.
    far = mk("food", 40.0100, 77.5946)          # ~111 km from the zone -- far
    check("far from the only confirmed zone -> flagged for scrutiny",
          far["admin_status"] == "flagged", str(far["admin_status"]))
    check("far-zone flagging does NOT auto-reject (still visible to volunteers)",
          far["admin_status"] != "rejected")

    near = mk("food", 41.0005, 77.5946)          # ~56 m from the zone -- inside
    check("inside the zone -> badged genuine, NOT flagged",
          near["zone_confirmed"] is True and near["admin_status"] == "pending",
          f"zone_confirmed={near['zone_confirmed']} admin_status={near['admin_status']}")

    mid = mk("food", 41.0080, 77.5946)           # ~890 m -- outside badge radius (500m)
    check("moderately outside the zone (890m, < far-zone 2000m) -> plain pending",
          mid["zone_confirmed"] is False and mid["admin_status"] == "pending",
          f"zone_confirmed={mid['zone_confirmed']} admin_status={mid['admin_status']}")

    st, feed = http("GET", "/requests/nearby?lat=41.0000&lng=77.5946&radius_m=200000")
    ids = [x["id"] for x in feed]
    check("a 'flagged' request still appears in the volunteer feed",
          far["id"] in ids, f"present={far['id'] in ids}")

    # --------------------------------------------------- expiry sweep (real)
    print("  ... launching a throwaway server with a short sweep interval")
    env = dict(os.environ)
    env["EXPIRY_SWEEP_INTERVAL_S"] = "2"
    env["PORT"] = "8099"
    proc = subprocess.Popen(
        [".venv/bin/python", "-m", "uvicorn", "app.main:app",
         "--host", "127.0.0.1", "--port", "8099"],
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    test_base = "http://127.0.0.1:8099"
    try:
        for _ in range(40):
            try:
                if http("GET", "/health", base=test_base)[0] == 200:
                    break
            except Exception:
                pass
            time.sleep(0.5)
        else:
            raise RuntimeError("throwaway server never came up")

        stale = mk("blood", 22.0000, 77.5946, dev="expiry-test", base=test_base)
        await conn.execute(
            "update requests set updated_at = now() - interval '50 minutes' where id=$1",
            stale["id"])
        ws2 = await websockets.connect(
            f"ws://127.0.0.1:8099/ws?channels=request:{stale['id']}")
        await asyncio.wait_for(ws2.recv(), timeout=3)

        expired_frame = None
        for _ in range(10):
            try:
                expired_frame = json.loads(await asyncio.wait_for(ws2.recv(), timeout=1.5))
                if expired_frame.get("payload", {}).get("status") == "expired":
                    break
            except asyncio.TimeoutError:
                continue
        await ws2.close()

        check("background sweep auto-expires a stale (>45min) request",
              expired_frame is not None
              and expired_frame["payload"].get("status") == "expired",
              str(expired_frame))

        _, refetched = http("GET", f"/requests/{stale['id']}", base=test_base)
        check("expiry persisted to the row", refetched["status"] == "expired",
              str(refetched["status"]))

        fresh = mk("blood", 22.1000, 77.5946, dev="expiry-test-2", base=test_base)
        time.sleep(3)
        _, still_fresh = http("GET", f"/requests/{fresh['id']}", base=test_base)
        check("a request younger than the threshold is NOT swept",
              still_fresh["status"] == "requested", str(still_fresh["status"]))
    finally:
        proc.send_signal(signal.SIGTERM)
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()

    await conn.close()
    print(f"\n  {len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
