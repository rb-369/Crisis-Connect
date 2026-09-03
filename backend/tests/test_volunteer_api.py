"""Step 5 acceptance: volunteer-specific endpoints.

  * GET /requests/nearby  -- filtering, sorting, distance
  * mock OTP              -- request -> verify -> token -> /auth/me
  * PATCH /helpers/{id}   -- availability toggle that persists
"""
import asyncio
import json
import sys
import urllib.error
import urllib.request

import asyncpg

BASE = "http://127.0.0.1:8000"
DSN = "postgresql://kk@localhost:5432/crisisconnect"

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  [{'PASS' if cond else 'FAIL'}] {name}" + (f"  -- {detail}" if detail else ""))


def http(method, path, body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    h = {"Content-Type": "application/json"}
    h.update(headers or {})
    req = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw or b"null")
        except json.JSONDecodeError:
            return e.code, {"raw": raw.decode(errors="replace")}


def mk(category, lat, lng, urgency=None, dev="feed-dev"):
    payload = {"category": category, "lat": lat, "lng": lng,
               "requester_device_id": dev}
    if urgency:
        payload["urgency"] = urgency
    st, body = http("POST", "/requests", payload)
    assert st == 201, (st, body)
    return body


async def main():
    print("\n=== STEP 5: volunteer endpoints ===")
    conn = await asyncpg.connect(DSN)
    await conn.execute("truncate messages, matches, requests cascade")

    LAT, LNG = 12.9716, 77.5946

    # ---------------------------------------------------------- feed contents
    near = mk("blood", LAT + 0.0010, LNG)                      # 111 m
    far = mk("blood", LAT + 0.2000, LNG)                       # ~22 km
    matched_req = mk("food", LAT + 0.0010, LNG)
    rejected_req = mk("medicine", LAT + 0.0010, LNG)
    pending_req = mk("shelter", LAT + 0.0010, LNG)
    root = mk("transport", LAT + 0.0012, LNG)
    child = mk("transport", LAT + 0.0014, LNG)                 # duplicate of root

    await conn.execute("update requests set status='matched' where id=$1", matched_req["id"])
    http("PATCH", f"/requests/{rejected_req['id']}", {"admin_status": "rejected"})
    check("duplicate was linked (feed precondition)",
          child["linked_request_id"] == root["id"], str(child["linked_request_id"]))

    st, feed = http("GET", f"/requests/nearby?lat={LAT}&lng={LNG}&radius_m=2000")
    check("GET /requests/nearby returns 200", st == 200, str(st))
    ids = [r["id"] for r in feed]

    check("in-radius open request IS in the feed", near["id"] in ids)
    check("out-of-radius request is NOT in the feed", far["id"] not in ids)
    check("already-matched request is NOT in the feed", matched_req["id"] not in ids)
    check("admin-rejected request is NOT in the feed", rejected_req["id"] not in ids)
    check("admin-PENDING request IS in the feed (approval never gates)",
          pending_req["id"] in ids)
    check("duplicate child is folded away, not shown as a 2nd card",
          child["id"] not in ids and root["id"] in ids)
    root_row = next(r for r in feed if r["id"] == root["id"])
    check("root carries linked_count for the 'N others need this' badge",
          root_row["linked_count"] == 1, str(root_row["linked_count"]))

    near_row = next(r for r in feed if r["id"] == near["id"])
    check("every row carries distance_m", "distance_m" in near_row)
    check("distance_m is accurate (111 m for 0.0010 lat)",
          abs(near_row["distance_m"] - 111) < 3, str(round(near_row["distance_m"], 1)))

    # radius really is a filter, not decoration
    st, tight = http("GET", f"/requests/nearby?lat={LAT}&lng={LNG}&radius_m=50")
    check("shrinking the radius excludes the 111 m request",
          near["id"] not in [r["id"] for r in tight], f"n={len(tight)}")

    # ------------------------------------------------------------- feed sorting
    await conn.execute("truncate messages, matches, requests cascade")
    L2 = 13.5000
    lo = mk("blood", L2, LNG, urgency="low")
    no = mk("food", L2, LNG, urgency="normal")
    hi = mk("medicine", L2, LNG, urgency="high")
    cr = mk("shelter", L2, LNG, urgency="critical")
    no2 = mk("transport", L2, LNG, urgency="normal")           # newest 'normal'

    st, feed = http("GET", f"/requests/nearby?lat={L2}&lng={LNG}&radius_m=1000")
    order = [r["id"] for r in feed]
    urg = [r["urgency"] for r in feed]
    check("feed sorts urgency-first: critical > high > normal > low",
          urg == ["critical", "high", "normal", "normal", "low"], str(urg))
    check("critical is first", order[0] == cr["id"])
    check("low is last", order[-1] == lo["id"])
    check("within one urgency band, newest first (recency)",
          order.index(no2["id"]) < order.index(no["id"]),
          f"no2@{order.index(no2['id'])} no@{order.index(no['id'])}")
    check("oxygen gets urgency='high' automatically",
          mk("oxygen", 13.9, LNG)["urgency"] == "high")
    # "rescue" is a critical category as of docs/AGENT-FLOW.md -- it goes
    # through POST /sos now, not POST /requests. Its auto-high-urgency is
    # covered in tests/test_agent_flow.py / sos.py (always 'high' for SOS).

    st, body = http("GET", "/requests/nearby?lat=999&lng=0")
    check("out-of-range lat is rejected with 422", st == 422, str(st))
    st, body = http("GET", "/requests/nearby")
    check("missing lat/lng is rejected with 422", st == 422, str(st))

    # ------------------------------------------------------------- mock OTP
    phone = "+919812345678"
    await conn.execute("delete from helpers where phone = $1", phone)
    st, otp = http("POST", "/auth/request-otp",
                   {"phone": phone, "name": "Asha K", "role": "volunteer"})
    check("POST /auth/request-otp succeeds", st == 200 and otp["sent"] is True, str(st))
    check("request-otp creates the helper account", otp.get("helper_id"))
    check("demo code is returned inline (no SMS needed)",
          otp.get("demo_code") == "123456", str(otp.get("demo_code")))

    st, ver = http("POST", "/auth/verify-otp", {"phone": phone, "code": "123456"})
    check("POST /auth/verify-otp returns a session token",
          st == 200 and bool(ver.get("token")), str(st))
    check("verify returns the helper record",
          ver["helper"]["phone"] == phone and ver["helper"]["name"] == "Asha K")
    token = ver["token"]
    helper_id = ver["helper"]["id"]

    st, me = http("GET", "/auth/me", headers={"Authorization": f"Bearer {token}"})
    check("token authenticates against GET /auth/me",
          st == 200 and me["id"] == helper_id, f"{st} {me}")
    st, _ = http("GET", "/auth/me", headers={"Authorization": "Bearer garbage.token"})
    check("a forged token is rejected with 401", st == 401, str(st))
    st, _ = http("GET", "/auth/me", headers={"Authorization": f"Bearer {token[:-4]}xxxx"})
    check("a tampered signature is rejected with 401", st == 401, str(st))

    st, again = http("POST", "/auth/request-otp", {"phone": phone, "role": "volunteer"})
    check("re-requesting an OTP reuses the same account (no dup helper)",
          again["helper_id"] == helper_id, f"{again['helper_id']} vs {helper_id}")
    st, _ = http("POST", "/auth/verify-otp", {"phone": "+910000000000", "code": "1"})
    check("verifying an unknown phone -> 404", st == 404, str(st))

    # ------------------------------------------------------ availability toggle
    st, h = http("PATCH", f"/helpers/{helper_id}", {"available": True})
    check("PATCH /helpers/{id} sets available=true",
          st == 200 and h["available"] is True, f"{st} {h.get('available')}")
    st, h = http("GET", f"/helpers/{helper_id}")
    check("availability persisted (survives a re-read)", h["available"] is True)
    db_val = await conn.fetchval("select available from helpers where id=$1::uuid", helper_id)
    check("availability persisted in the DB, not just the response", db_val is True, str(db_val))

    st, h = http("PATCH", f"/helpers/{helper_id}", {"available": False})
    check("toggling back to false works", h["available"] is False)
    st, h = http("GET", f"/helpers/{helper_id}")
    check("false also persists", h["available"] is False)

    st, h = http("PATCH", f"/helpers/{helper_id}",
                 {"available": True, "lat": 12.97, "lng": 77.59})
    check("location can be updated alongside availability",
          h["lat"] == 12.97 and h["lng"] == 77.59 and h["available"] is True)
    st, _ = http("PATCH", f"/helpers/{helper_id}", {})
    check("empty patch -> 400", st == 400, str(st))
    st, _ = http("PATCH", "/helpers/00000000-0000-0000-0000-000000000000",
                 {"available": True})
    check("unknown helper -> 404", st == 404, str(st))

    await conn.close()
    print(f"\n  {len(PASS)} passed, {len(FAIL)} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
