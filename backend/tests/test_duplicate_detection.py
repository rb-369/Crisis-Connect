"""Step 4 acceptance: duplicate request detection.

Defaults: same category, within 150 m and 90 min of an existing ACTIVE request.

Distance fixtures on this DB:
   +0.0005 lat =  56 m   (inside)     +0.0010 lat = 111 m  (inside)
   +0.0020 lat = 223 m   (outside)    +0.0100 lat = 1113 m (outside)
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
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data,
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


def mk(category, lat, lng, dev="dup-dev"):
    st, body = http("POST", "/requests", {
        "category": category, "lat": lat, "lng": lng, "requester_device_id": dev})
    assert st == 201, (st, body)
    return body


async def main():
    print("\n=== STEP 4: duplicate detection ===")
    conn = await asyncpg.connect(DSN)
    # Clear requests so earlier tests' rows can't act as duplicate parents.
    await conn.execute("truncate messages, matches, requests cascade")
    check("clean slate", True)

    LNG = 77.5946

    # ------------------------------------------------- 1. near-identical pair
    A = 20.1000
    a1 = mk("blood", A, LNG)
    check("first request has no parent", a1["linked_request_id"] is None)
    a2 = mk("blood", A + 0.0005, LNG)                       # 56 m, same category
    check("second near-identical request IS linked",
          a2["linked_request_id"] == a1["id"],
          f"{a2['linked_request_id']} vs {a1['id']}")
    check("linked response exposes the parent for the UI",
          a2.get("linked_root", {}).get("id") == a1["id"])
    check("parent's linked_count incremented to 1",
          a2.get("linked_root", {}).get("linked_count") == 1,
          str(a2.get("linked_root", {}).get("linked_count")))

    # third one links to the ROOT, not to the second (no chains)
    a3 = mk("blood", A + 0.0010, LNG)                       # 111 m
    check("third request links to the ROOT, not to the 2nd (no chains)",
          a3["linked_request_id"] == a1["id"], str(a3["linked_request_id"]))
    _, root = http("GET", f"/requests/{a1['id']}")
    check("root now reports 2 people also needing help",
          root["linked_count"] == 2, str(root["linked_count"]))

    # ---------------------------------------------- 2. different category
    B = 20.3000
    b1 = mk("blood", B, LNG)
    b2 = mk("food", B + 0.0005, LNG)                        # same spot, other category
    check("different category at the same spot is NOT linked",
          b2["linked_request_id"] is None, str(b2["linked_request_id"]))

    # ---------------------------------------------- 3. too far away
    C = 20.5000
    c1 = mk("medicine", C, LNG)
    c2 = mk("medicine", C + 0.0020, LNG)                    # 223 m > 150 m
    check("same category beyond the radius is NOT linked",
          c2["linked_request_id"] is None, str(c2["linked_request_id"]))
    c3 = mk("medicine", C + 0.0100, LNG)                    # 1113 m
    check("far-away request is NOT linked", c3["linked_request_id"] is None)

    # ---------------------------------------------- 4. outside the time window
    D = 20.7000
    old_id = await conn.fetchval(
        """insert into requests (category, urgency, lat, lng, requester_device_id, created_at)
           values ('shelter','normal',$1,$2,'old-dev', now() - interval '3 hours')
           returning id""", D, LNG)
    d2 = mk("shelter", D + 0.0005, LNG)
    check("request outside the time window is NOT treated as a duplicate",
          d2["linked_request_id"] is None, str(d2["linked_request_id"]))

    # ---------------------------------------------- 5. resolved/expired parents
    E = 20.9000
    e1 = mk("transport", E, LNG)
    await conn.execute("update requests set status='resolved' where id=$1", e1["id"])
    e2 = mk("transport", E + 0.0005, LNG)
    check("a RESOLVED request is not a duplicate parent",
          e2["linked_request_id"] is None, str(e2["linked_request_id"]))
    await conn.execute("update requests set status='expired' where id=$1", e2["id"])
    e3 = mk("transport", E + 0.0005, LNG)
    check("an EXPIRED request is not a duplicate parent",
          e3["linked_request_id"] is None, str(e3["linked_request_id"]))
    # ...but a matched (still active) one IS
    await conn.execute("update requests set status='matched' where id=$1", e3["id"])
    e4 = mk("transport", E + 0.0005, LNG)
    check("a MATCHED (still active) request IS a duplicate parent",
          e4["linked_request_id"] == e3["id"], str(e4["linked_request_id"]))

    # ---------------------------------------------- 6. broadcast semantics
    F = 21.1000
    ws = await websockets.connect(f"{WS}?channels=global")
    await asyncio.wait_for(ws.recv(), timeout=3)
    f1 = mk("medicine", F, LNG)
    f2 = mk("medicine", F + 0.0005, LNG)                    # duplicate
    frames = []
    try:
        while True:
            frames.append(json.loads(await asyncio.wait_for(ws.recv(), timeout=1.2)))
    except asyncio.TimeoutError:
        pass
    await ws.close()
    kinds = [f["event"] for f in frames]
    check("the original request broadcasts exactly one `new_request`",
          kinds.count("new_request") == 1, str(kinds))
    check("the duplicate does NOT broadcast a second `new_request`",
          kinds.count("new_request") == 1, str(kinds))
    su = [f for f in frames if f["event"] == "status_update"]
    check("the duplicate re-broadcasts the ROOT as a status_update",
          len(su) == 1 and su[0]["payload"]["id"] == f1["id"], str(kinds))
    check("the re-broadcast carries the bumped counter",
          bool(su) and su[0]["payload"]["linked_count"] == 1,
          str(su[0]["payload"].get("linked_count")) if su else "")

    # ---------------------------------------------- 7. simultaneous duplicates
    G = 21.3000
    barrier = threading.Barrier(4)
    out = [None] * 4

    def worker(i):
        barrier.wait()
        out[i] = http("POST", "/requests", {
            "category": "oxygen", "lat": G + i * 0.0002, "lng": LNG,
            "requester_device_id": f"sim-{i}"})

    with ThreadPoolExecutor(max_workers=4) as ex:
        list(ex.map(worker, range(4)))
    bodies = [o[1] for o in out]
    roots = [b for b in bodies if b["linked_request_id"] is None]
    check("4 simultaneous near-identical requests -> exactly 1 unlinked root",
          len(roots) == 1, f"{len(roots)} roots: {[b['id'][:8] for b in roots]}")
    check("the other 3 all link to that one root",
          all(b["linked_request_id"] == roots[0]["id"] for b in bodies if b is not roots[0])
          if roots else False)
    n = await conn.fetchval(
        "select count(*) from requests where linked_request_id = $1", roots[0]["id"]) if roots else -1
    check("root's child count is 3", n == 3, f"count={n}")

    await conn.close()
    print(f"\n  {len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
