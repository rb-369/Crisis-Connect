"""Step 2 acceptance: atomic accept / first-accept-wins.

Threads are released from a shared Barrier so the accepts genuinely land at the
same moment -- this is a real race, not a sequential loop pretending to be one.

Covers:
  1. 2 simultaneous accepts  -> exactly 1 wins, 1 clean 409, 1 match row.
  2. 10 simultaneous accepts -> exactly 1 wins (scaled-up version of the same).
  3. 25 requests x 8 helpers -> never more than one winner, ever (flake hunt).
  4. Rollback: accept with a non-existent helper must NOT leave the request
     stranded in 'matched' with no match row.
  5. A successful accept broadcasts `matched` on the request's channel and a
     subscribed client actually receives it.
"""
import asyncio
import json
import sys
import threading
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import asyncpg
import websockets

BASE = "http://127.0.0.1:8000"
WS = "ws://127.0.0.1:8000/ws"
DSN = "postgresql://kk@localhost:5432/crisisconnect"

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  [{'PASS' if cond else 'FAIL'}] {name}" + (f"  -- {detail}" if detail else ""))


def http(method, path, body=None):
    """Returns (status_code, parsed_body)."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path, data=data,
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


def make_request(category="oxygen", lat=12.9716, lng=77.5946, dev="race-dev"):
    st, body = http("POST", "/requests", {
        "category": category, "lat": lat, "lng": lng, "requester_device_id": dev})
    assert st == 201, (st, body)
    return body["id"]


def fire_accepts(request_id, helper_ids):
    """Fire one accept per helper, all released from a barrier together."""
    n = len(helper_ids)
    barrier = threading.Barrier(n)
    results = [None] * n

    def worker(i, hid):
        barrier.wait()                       # <- everyone leaves the gate together
        results[i] = http("POST", f"/requests/{request_id}/accept", {"helper_id": hid})

    with ThreadPoolExecutor(max_workers=n) as ex:
        list(ex.map(lambda a: worker(*a), enumerate(helper_ids)))
    return results


async def main():
    print("\n=== STEP 2: atomic accept (first-accept-wins) ===")
    conn = await asyncpg.connect(DSN)

    # --- seed helpers ---
    helper_ids = []
    for i in range(10):
        hid = await conn.fetchval(
            """insert into helpers (name, phone, role, verified, available, lat, lng)
               values ($1,$2,'volunteer',true,true,12.9716,77.5946)
               on conflict (phone) do update set name = excluded.name
               returning id""",
            f"Race Volunteer {i}", f"+9199000000{i:02d}")
        helper_ids.append(str(hid))
    check("seeded 10 volunteer helpers", len(helper_ids) == 10)

    # ---------------------------------------------------------------- case 1
    rid = make_request()
    results = fire_accepts(rid, helper_ids[:2])
    wins = [r for r in results if r[0] == 200]
    conflicts = [r for r in results if r[0] == 409]
    check("2 simultaneous accepts -> exactly 1 HTTP 200",
          len(wins) == 1, str([r[0] for r in results]))
    check("the loser gets a clean 409 (not a 500)",
          len(conflicts) == 1, str([r[0] for r in results]))
    check("409 body carries a machine-readable code the app can branch on",
          len(conflicts) == 1 and conflicts[0][1].get("code") == "already_matched",
          str(conflicts[0][1]) if conflicts else "")
    nmatch = await conn.fetchval("select count(*) from matches where request_id = $1", rid)
    check("exactly 1 match row created (no duplicate)", nmatch == 1, f"count={nmatch}")
    status = await conn.fetchval("select status from requests where id = $1", rid)
    check("request status flipped to 'matched'", status == "matched", str(status))

    # ---------------------------------------------------------------- case 2
    rid = make_request()
    results = fire_accepts(rid, helper_ids)
    codes = sorted(r[0] for r in results)
    nmatch = await conn.fetchval("select count(*) from matches where request_id = $1", rid)
    check("10 simultaneous accepts -> exactly 1 HTTP 200",
          codes.count(200) == 1, str(codes))
    check("10 simultaneous accepts -> 9 clean 409s",
          codes.count(409) == 9, str(codes))
    check("10 simultaneous accepts -> still exactly 1 match row",
          nmatch == 1, f"count={nmatch}")

    # ---------------------------------------------------------------- case 3
    print("  ... flake hunt: 25 requests x 8 simultaneous accepts")
    bad = []
    for n in range(25):
        rid = make_request()
        results = fire_accepts(rid, helper_ids[:8])
        winners = sum(1 for r in results if r[0] == 200)
        rows = await conn.fetchval(
            "select count(*) from matches where request_id = $1", rid)
        others = [r[0] for r in results if r[0] not in (200, 409)]
        if winners != 1 or rows != 1 or others:
            bad.append({"i": n, "winners": winners, "match_rows": rows,
                        "unexpected_codes": others})
    check("25 races: always exactly 1 winner and 1 match row",
          not bad, f"{len(bad)} bad rounds: {bad[:3]}")

    # ---------------------------------------------------------------- case 4
    rid = make_request()
    ghost = "00000000-0000-0000-0000-000000000000"
    st, body = http("POST", f"/requests/{rid}/accept", {"helper_id": ghost})
    check("accept with unknown helper -> 404", st == 404, f"{st} {body}")
    status = await conn.fetchval("select status from requests where id = $1", rid)
    rows = await conn.fetchval("select count(*) from matches where request_id = $1", rid)
    check("ROLLBACK: request still 'requested' after failed accept",
          status == "requested", f"status={status}")
    check("ROLLBACK: no orphan match row", rows == 0, f"count={rows}")
    st, _ = http("POST", f"/requests/{rid}/accept", {"helper_id": helper_ids[0]})
    check("request is still acceptable afterwards (not bricked)", st == 200, str(st))

    # ---------------------------------------------------------------- case 5
    rid = make_request()
    ws = await websockets.connect(f"{WS}?channels=request:{rid}")
    await asyncio.wait_for(ws.recv(), timeout=3)          # drain `subscribed`
    st, body = http("POST", f"/requests/{rid}/accept", {"helper_id": helper_ids[3]})
    check("accept succeeded", st == 200, str(st))
    try:
        frame = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
    except asyncio.TimeoutError:
        frame = None
    check("requester's WS client received the `matched` event",
          frame is not None and frame["event"] == "matched", str(frame))
    check("`matched` payload carries request + match + helper identity",
          frame is not None
          and frame["payload"]["request"]["id"] == rid
          and frame["payload"]["match"]["request_id"] == rid
          and frame["payload"]["helper"]["name"] is not None,
          json.dumps(frame["payload"], indent=None)[:200] if frame else "")
    await ws.close()

    # ---------------------------------------------------------------- extras
    st, body = http("POST", f"/requests/{rid}/accept", {"helper_id": helper_ids[4]})
    check("accepting an already-matched request -> 409 already_matched",
          st == 409 and body.get("code") == "already_matched", f"{st} {body}")
    st, body = http("POST", "/requests/not-a-uuid/accept", {"helper_id": helper_ids[0]})
    check("malformed request id -> 400, not 500", st == 400, f"{st} {body}")
    st, body = http("POST", f"/requests/{ghost}/accept", {"helper_id": helper_ids[0]})
    check("unknown request id -> 404", st == 404, f"{st} {body}")

    # rejected request must not be acceptable
    rid = make_request()
    http("PATCH", f"/requests/{rid}", {"admin_status": "rejected"})
    st, body = http("POST", f"/requests/{rid}/accept", {"helper_id": helper_ids[0]})
    check("admin-rejected request cannot be accepted -> 409 rejected",
          st == 409 and body.get("code") == "rejected", f"{st} {body}")

    await conn.close()
    print(f"\n  {len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
