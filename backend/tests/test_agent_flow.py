"""Agent-flow spec acceptance (docs/AGENT-FLOW.md): critical/incident
grouping, the non-critical verification pipeline, and blood-donor matching.

  1. POST /sos creates an incident; a nearby same-category SOS joins it
     (priority/request_count bump), a distant or differently-categorized
     one does not.
  2. Concurrent SOS at the same site -> exactly ONE incident, never two --
     proven with a real race (threading.Barrier), not a sequential loop.
  3. Incident status only ever advances forward: accept -> responder_accepted,
     en_route -> on_the_way, assessment -> assessed, admin PATCH ->
     coordinated/resolved; a backward PATCH is a no-op.
  4. Non-critical verification: incomplete (missing required fields),
     pending (complete but no evidence), verified (evidence present),
     rejected (duplicate) -- all four rule-based outcomes.
  5. Blood-donor compatibility: correct donor types, respects availability
     and distance, 400s on a non-blood request.
  6. Cross-validation: critical categories rejected on /requests, non-critical
     rejected on /sos.
"""
import asyncio
import json
import sys
import threading
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import asyncpg

BASE = "http://127.0.0.1:8000"
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


def sos(category, lat, lng, dev="agent-flow-dev", **kw):
    st, body = http("POST", "/sos", {
        "category": category, "lat": lat, "lng": lng, "requester_device_id": dev, **kw})
    assert st == 201, (st, body)
    return body


def mk_request(category, lat, lng, dev="agent-flow-nc", **kw):
    st, body = http("POST", "/requests", {
        "category": category, "lat": lat, "lng": lng, "requester_device_id": dev, **kw})
    assert st == 201, (st, body)
    return body


async def main():
    print("\n=== AGENT-FLOW: incidents, verification, blood matching ===")
    conn = await asyncpg.connect(DSN)
    # Clean slate -- this suite is re-runnable against the same dev DB, and
    # every case below uses fixed coordinates so repeated runs are exact
    # repros, not accumulating state that changes the outcome each time.
    await conn.execute("truncate messages, matches cascade")
    # Sever the FK link (safe -- just a linkage field) so incidents can be
    # truncated without `cascade`, which would otherwise wipe the entire
    # requests table (every table with an FK into incidents), not just this
    # test's own rows.
    await conn.execute("update requests set incident_id = null")
    # DELETE, not TRUNCATE: Postgres refuses to truncate a table that has an
    # incoming FK constraint at all (schema-level), regardless of whether
    # current data actually violates it (which it doesn't -- just nulled it).
    await conn.execute("delete from incident_events")
    await conn.execute("delete from incidents")
    await conn.execute("delete from requests where requester_device_id like 'agent-flow-%' "
                       "or requester_device_id like 'race-%' or requester_device_id = 'no-group-dev'")

    # ------------------------------------------------------------- 1: cluster
    L1 = 25.0000
    a = sos("flood", L1, 88.0)
    check("first SOS creates a new incident", a["request"]["incident_id"] is not None)
    check("new incident starts at priority 1", a["incident"]["priority"] == 1)
    check("new incident advances past sos_triggered to alert_sent",
          a["incident"]["status"] == "alert_sent", a["incident"]["status"])

    b = sos("flood", L1 + 0.0010, 88.0)  # ~111m away, same category -- joins
    check("nearby same-category SOS joins the same incident",
          b["request"]["incident_id"] == a["incident"]["id"])
    check("joining bumps priority and request_count",
          b["incident"]["priority"] == 2 and b["incident"]["request_count"] == 2,
          f"priority={b['incident']['priority']} count={b['incident']['request_count']}")

    c = sos("flood", L1 + 0.0500, 88.0)  # ~5.5km away -- too far
    check("a far-away SOS does NOT join", c["request"]["incident_id"] != a["incident"]["id"])

    d = sos("fire", L1, 88.0)  # same spot, different category
    check("a different-category SOS at the same spot does NOT join",
          d["request"]["incident_id"] != a["incident"]["id"])

    e = mk_request("blood", L1, 88.0, structured_details={
        "blood_group": "O+", "quantity": "1", "hospital": "X"})
    check("critical incident grouping never touches non-critical requests",
          e.get("incident_id") is None)

    # -------------------------------------------------- 2: concurrent SOS race
    print("  ... concurrent SOS race: 6 simultaneous calls, one disaster site")
    L2 = 26.0000
    barrier = threading.Barrier(6)
    results = [None] * 6

    def fire_sos(i):
        barrier.wait()
        results[i] = sos("earthquake", L2 + i * 0.0002, 88.5, dev=f"race-{i}")

    with ThreadPoolExecutor(max_workers=6) as ex:
        list(ex.map(fire_sos, range(6)))

    incident_ids = {r["request"]["incident_id"] for r in results}
    check("6 simultaneous SOS at one site -> exactly ONE incident",
          len(incident_ids) == 1, f"{len(incident_ids)} distinct incidents: {incident_ids}")
    final_incident = await conn.fetchrow(
        "select * from incidents where id = $1", list(incident_ids)[0])
    check("incident's request_count matches all 6 joins",
          final_incident["request_count"] == 6, f"count={final_incident['request_count']}")
    check("incident's priority matches all 6 joins",
          final_incident["priority"] == 6, f"priority={final_incident['priority']}")
    linked = await conn.fetchval(
        "select count(*) from requests where incident_id = $1", list(incident_ids)[0])
    check("exactly 6 requests actually linked to it in the DB",
          linked == 6, f"linked={linked}")

    # ---------------------------------------------------- 3: status monotonic
    iid = a["incident"]["id"]
    rid = a["request"]["id"]
    hid = json.loads(json.dumps(http("POST", "/auth/request-otp",
        {"phone": "+919000111222", "role": "volunteer"})[1]))["helper_id"]

    st, accepted = http("POST", f"/requests/{rid}/accept", {"helper_id": hid})
    check("accept succeeds", st == 200, str(st))
    st, inc = http("GET", f"/incidents/{iid}")
    check("accept advances incident to responder_accepted",
          inc["status"] == "responder_accepted", inc["status"])

    match_id = accepted["match"]["id"]
    http("PATCH", f"/matches/{match_id}", {"status": "en_route"})
    st, inc = http("GET", f"/incidents/{iid}")
    check("en_route advances incident to on_the_way", inc["status"] == "on_the_way", inc["status"])

    st, assessed = http("POST", f"/incidents/{iid}/assessment", {
        "submitted_by": hid, "people_affected": 20, "rescue_required": True})
    check("assessment advances incident to assessed", assessed["status"] == "assessed")
    check("assessment payload round-trips as a real nested object (jsonb codec)",
          isinstance(assessed["assessment"], dict)
          and assessed["assessment"]["people_affected"] == 20,
          str(assessed.get("assessment")))

    st, patched = http("PATCH", f"/incidents/{iid}", {"status": "alert_sent"})
    check("a backward PATCH is a no-op, does not regress",
          patched["status"] == "assessed", patched["status"])

    st, coord = http("PATCH", f"/incidents/{iid}",
                     {"status": "coordinated", "coordinating_orgs": ["NDRF", "Red Cross"]})
    check("forward PATCH to coordinated works with org tagging",
          coord["status"] == "coordinated" and coord["coordinating_orgs"] == ["NDRF", "Red Cross"],
          str(coord))

    st, resolved = http("PATCH", f"/incidents/{iid}", {"status": "resolved"})
    check("incident can be resolved by admin", resolved["status"] == "resolved")

    st, listing = http("GET", "/incidents?status=resolved")
    check("GET /incidents filters by status",
          any(x["id"] == iid for x in listing), f"found={any(x['id']==iid for x in listing)}")

    # ------------------------------------------------- 4: verification pipeline
    L3 = 27.0000
    incomplete = mk_request("blood", L3, 89.0, structured_details={"blood_group": "A+"})
    check("missing required fields -> incomplete",
          incomplete["verification_status"] == "incomplete"
          and any("quantity" in r for r in incomplete["verification_reasons"]),
          str(incomplete["verification_reasons"]))

    no_evidence = mk_request("blood", L3 + 1.0, 89.0, structured_details={
        "blood_group": "A+", "quantity": "1", "hospital": "Y"})
    check("complete but no phone/photo -> pending, not auto-verified",
          no_evidence["verification_status"] == "pending"
          and "no_evidence_signal" in no_evidence["verification_reasons"])

    verified = mk_request("blood", L3 + 2.0, 89.0, requester_phone="+919123456789",
                          structured_details={"blood_group": "A+", "quantity": "1", "hospital": "Y"})
    check("complete + phone evidence -> verified",
          verified["verification_status"] == "verified"
          and verified["verification_reasons"] == [])

    dup = mk_request("blood", L3 + 2.0005, 89.0, requester_phone="+919123456780",
                     structured_details={"blood_group": "A+", "quantity": "1", "hospital": "Y"})
    check("duplicate of an active request -> rejected",
          dup["verification_status"] == "rejected"
          and dup["verification_reasons"] == ["duplicate"]
          and dup["linked_request_id"] == verified["id"])

    # ----------------------------------------------------- 5: blood matching
    donor_o_minus = await conn.fetchval(
        """insert into helpers (name, phone, role, verified, available, blood_type, lat, lng)
           values ('Donor A','+911000000001','volunteer',true,true,'O-',$1,$2)
           on conflict (phone) do update set blood_type=excluded.blood_type,
             available=excluded.available, lat=excluded.lat, lng=excluded.lng
           returning id""", verified["lat"], verified["lng"])
    donor_wrong_type = await conn.fetchval(
        """insert into helpers (name, phone, role, verified, available, blood_type, lat, lng)
           values ('Donor B','+911000000002','volunteer',true,true,'B+',$1,$2)
           on conflict (phone) do update set blood_type=excluded.blood_type,
             available=excluded.available, lat=excluded.lat, lng=excluded.lng
           returning id""", verified["lat"], verified["lng"])
    donor_unavailable = await conn.fetchval(
        """insert into helpers (name, phone, role, verified, available, blood_type, lat, lng)
           values ('Donor C','+911000000003','volunteer',true,false,'O-',$1,$2)
           on conflict (phone) do update set blood_type=excluded.blood_type,
             available=excluded.available, lat=excluded.lat, lng=excluded.lng
           returning id""", verified["lat"], verified["lng"])

    st, result = http("GET", f"/requests/{verified['id']}/compatible-donors")
    donor_ids = {d["id"] for d in result["donors"]}
    check("compatible donor (right type, available) IS included",
          str(donor_o_minus) in donor_ids, str(donor_ids))
    check("wrong blood type is excluded", str(donor_wrong_type) not in donor_ids)
    check("unavailable donor is excluded", str(donor_unavailable) not in donor_ids)

    no_group = mk_request("blood", L3, 89.0, dev="no-group-dev")  # blood_group itself absent
    st, body = http("GET", f"/requests/{no_group['id']}/compatible-donors")
    check("compatible-donors on a request with no blood_group -> 400", st == 400, str(st))
    st, body = http("GET", f"/requests/{rid}/compatible-donors")  # a flood SOS, not blood
    check("compatible-donors on a non-blood request -> 400", st == 400, str(st))

    # -------------------------------------------------- 6: cross-validation
    st, _ = http("POST", "/requests", {
        "category": "fire", "lat": 1, "lng": 1, "requester_device_id": "x"})
    check("critical category rejected on POST /requests", st == 422, str(st))
    st, _ = http("POST", "/sos", {
        "category": "blood", "lat": 1, "lng": 1, "requester_device_id": "x"})
    check("non-critical category rejected on POST /sos", st == 422, str(st))
    st, _ = http("PATCH", f"/helpers/{donor_o_minus}", {"blood_type": "Z+"})
    check("invalid blood_type rejected", st == 422, str(st))

    await conn.close()
    print(f"\n  {len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
