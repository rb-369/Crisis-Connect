"""Step 3 acceptance: zone-threshold logic (3 reports / 500 m / 30 min).

Each case uses its own category AND its own base coordinate so cases cannot
contaminate each other through the 24h/500m dedupe window.

Distance fixtures (verified against earth_distance on this DB):
   +0.0010 lat = 111 m      +0.0020 lat =  223 m
   +0.0030 lat = 334 m      +0.0100 lat = 1113 m
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


def report(category, lat, lng, dev="zone-dev"):
    st, body = http("POST", "/zone-reports", {
        "category": category, "lat": lat, "lng": lng, "device_id": dev})
    assert st == 201, (st, body)
    return body


async def main():
    print("\n=== STEP 3: zone-threshold logic ===")
    conn = await asyncpg.connect(DSN)
    await conn.execute("truncate zone_reports, confirmed_zones")
    check("clean slate", True)

    async def zone_count(cat):
        return await conn.fetchval(
            "select count(*) from confirmed_zones where category = $1", cat)

    # ------------------------------------------------------------------ 1 & 2
    # 3 reports, same category, all within 500 m -> exactly one zone.
    LAT, LNG = 12.9716, 77.5946
    r1 = report("flood", LAT, LNG)
    check("1st report: no zone yet",
          r1["cluster_count"] == 1 and r1["confirmed_zone"] is None, str(r1["cluster_count"]))
    r2 = report("flood", LAT + 0.0010, LNG)            # 111 m
    check("2nd report: still below threshold",
          r2["cluster_count"] == 2 and r2["confirmed_zone"] is None, str(r2["cluster_count"]))
    r3 = report("flood", LAT + 0.0020, LNG)            # 223 m
    check("3rd report: cluster count reaches 3", r3["cluster_count"] == 3, str(r3["cluster_count"]))
    check("3rd report CONFIRMS the zone", r3["confirmed_zone"] is not None)
    check("exactly ONE confirmed_zones row", await zone_count("flood") == 1,
          f"count={await zone_count('flood')}")
    if r3["confirmed_zone"]:
        z = r3["confirmed_zone"]
        # centre should be the mean of the 3 report positions
        expect_lat = (LAT + (LAT + 0.0010) + (LAT + 0.0020)) / 3
        check("zone centre is the cluster mean",
              abs(z["center_lat"] - expect_lat) < 1e-9 and abs(z["center_lng"] - LNG) < 1e-9,
              f"{z['center_lat']} vs {expect_lat}")

    # ---------------------------------------------------------------------- 3
    # More reports in the same cluster must NOT create more zones.
    r4 = report("flood", LAT + 0.0005, LNG)
    r5 = report("flood", LAT + 0.0015, LNG)
    check("4th/5th report do NOT create duplicate zones",
          await zone_count("flood") == 1, f"count={await zone_count('flood')}")
    check("dedupe reports which existing zone swallowed it",
          r4["already_confirmed_zone_id"] is not None
          and r5["already_confirmed_zone_id"] is not None,
          f"{r4['already_confirmed_zone_id']} / {r5['already_confirmed_zone_id']}")
    check("suppressed reports point at the SAME zone",
          r4["already_confirmed_zone_id"] == r5["already_confirmed_zone_id"])

    # ---------------------------------------------------------------------- 4
    # Mixed categories at one spot: no single category reaches 3 -> no zone.
    L2 = 13.2000
    report("fire_a", L2, LNG)
    report("fire_a", L2 + 0.0010, LNG)
    mixed = report("riot_a", L2 + 0.0015, LNG)
    check("different categories do NOT combine into a confirmation",
          await zone_count("fire_a") == 0 and await zone_count("riot_a") == 0,
          f"fire_a={await zone_count('fire_a')} riot_a={await zone_count('riot_a')}")
    check("mixed-category cluster counts only its own category",
          mixed["cluster_count"] == 1, str(mixed["cluster_count"]))

    # ---------------------------------------------------------------------- 5
    # Same category but spread far apart -> no cluster.
    L3 = 13.4000
    far1 = report("quake_b", L3, LNG)
    far2 = report("quake_b", L3 + 0.0100, LNG)         # 1113 m away
    far3 = report("quake_b", L3 + 0.0200, LNG)         # 2226 m away
    check("reports outside the radius do NOT confirm",
          await zone_count("quake_b") == 0, f"count={await zone_count('quake_b')}")
    check("each far-apart report sees a cluster of 1",
          far1["cluster_count"] == far2["cluster_count"] == far3["cluster_count"] == 1,
          f"{far1['cluster_count']},{far2['cluster_count']},{far3['cluster_count']}")

    # ---------------------------------------------------------------------- 6
    # Same category, same place, but the earlier reports are outside the
    # 30-minute window -> the new report must not resurrect them.
    L4 = 13.6000
    for off in (0.0000, 0.0010):
        await conn.execute(
            """insert into zone_reports (category, lat, lng, device_id, reported_at)
               values ('stale_c', $1, $2, 'old-dev', now() - interval '45 minutes')""",
            L4 + off, LNG)
    stale = report("stale_c", L4 + 0.0020, LNG)
    check("reports outside the time window do NOT confirm",
          await zone_count("stale_c") == 0, f"count={await zone_count('stale_c')}")
    check("stale reports are excluded from the cluster count",
          stale["cluster_count"] == 1, str(stale["cluster_count"]))
    # and prove the same 3 positions WOULD have confirmed if they were recent
    await conn.execute("update zone_reports set reported_at = now() where category='stale_c'")
    fresh = report("stale_c", L4 + 0.0025, LNG)
    check("same positions DO confirm once inside the window",
          fresh["confirmed_zone"] is not None and await zone_count("stale_c") == 1,
          f"count={await zone_count('stale_c')}")

    # ---------------------------------------------------------------------- 7
    # zone_confirmed broadcast is receivable on the global channel.
    L5 = 13.8000
    ws = await websockets.connect(f"{WS}?channels=global")
    await asyncio.wait_for(ws.recv(), timeout=3)               # drain `subscribed`
    report("bcast_d", L5, LNG)
    report("bcast_d", L5 + 0.0010, LNG)
    report("bcast_d", L5 + 0.0020, LNG)                        # confirms

    frames = []
    try:
        while True:
            frames.append(json.loads(await asyncio.wait_for(ws.recv(), timeout=1.2)))
    except asyncio.TimeoutError:
        pass
    zc = [f for f in frames if f["event"] == "zone_confirmed"]
    check("`zone_confirmed` broadcast received on the global channel",
          len(zc) == 1, f"got events {[f['event'] for f in frames]}")
    check("`zone_confirmed` payload carries the zone + cluster count",
          bool(zc) and zc[0]["payload"]["zone"]["category"] == "bcast_d"
          and zc[0]["payload"]["cluster_count"] == 3,
          json.dumps(zc[0]["payload"])[:160] if zc else "")
    await ws.close()

    # ---------------------------------------------------------------------- 8
    # Race: two simultaneous 3rd-reports must not both confirm.
    L6 = 14.0000
    report("race_e", L6, LNG)
    report("race_e", L6 + 0.0005, LNG)

    barrier = threading.Barrier(2)
    out = [None, None]

    def worker(i, lat):
        barrier.wait()
        out[i] = http("POST", "/zone-reports", {
            "category": "race_e", "lat": lat, "lng": LNG, "device_id": f"race-{i}"})

    with ThreadPoolExecutor(max_workers=2) as ex:
        list(ex.map(lambda a: worker(*a), [(0, L6 + 0.0010), (1, L6 + 0.0015)]))
    check("simultaneous threshold-crossing reports -> exactly ONE zone",
          await zone_count("race_e") == 1, f"count={await zone_count('race_e')}")
    confirmers = [o for o in out if o and o[1].get("confirmed_zone")]
    check("only one of the two racing reports reports a confirmation",
          len(confirmers) == 1, f"{len(confirmers)} claimed the confirmation")

    # ---------------------------------------------------------------------- 9
    # PRD badge: requests inside a confirmed zone are marked zone_confirmed.
    L7 = 14.2000
    st, pre_req = http("POST", "/requests", {
        "category": "oxygen", "lat": L7 + 0.0010, "lng": LNG,
        "requester_device_id": "badge-dev"})
    check("request created before confirmation starts unbadged",
          st == 201 and pre_req["zone_confirmed"] is False, str(pre_req.get("zone_confirmed")))
    st, far_req = http("POST", "/requests", {
        "category": "oxygen", "lat": L7 + 0.0500, "lng": LNG,
        "requester_device_id": "badge-dev-far"})

    report("badge_f", L7, LNG)
    report("badge_f", L7 + 0.0010, LNG)
    conf = report("badge_f", L7 + 0.0020, LNG)
    check("zone confirmed for badge case", conf["confirmed_zone"] is not None)
    check("nearby pre-existing request got badged",
          pre_req["id"] in conf["requests_badged"], str(conf["requests_badged"]))
    check("far-away request did NOT get badged",
          far_req["id"] not in conf["requests_badged"])
    _, refetched = http("GET", f"/requests/{pre_req['id']}")
    check("badge persisted to the row", refetched["zone_confirmed"] is True,
          str(refetched["zone_confirmed"]))
    st, post_req = http("POST", "/requests", {
        "category": "blood", "lat": L7 + 0.0005, "lng": LNG,
        "requester_device_id": "badge-dev-2"})
    check("request created AFTER confirmation is badged on insert",
          post_req["zone_confirmed"] is True, str(post_req["zone_confirmed"]))

    # confirmed-zones listing for Dev A's map overlay
    st, zones = http("GET", "/confirmed-zones")
    check("GET /confirmed-zones serves the map overlay",
          st == 200 and len(zones) >= 5 and "report_count" in zones[0],
          f"{st} n={len(zones) if isinstance(zones, list) else zones}")

    await conn.close()
    print(f"\n  {len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
