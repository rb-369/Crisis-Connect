import asyncio
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_endpoints():
    print("Testing Backend Endpoints against active configuration...")

    # 1. Health check
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("[PASS] GET /health -> 200 OK")

    # 2. List requests (table is live)
    res = client.get("/requests")
    assert res.status_code == 200
    print(f"[PASS] GET /requests -> 200 OK (returned {len(res.json())} live records)")

    # 3. Create request with normal category
    new_req_data = {
        "category": "medicine",
        "lat": 37.775,
        "lng": -122.420,
        "requester_device_id": "test-device-uuid-1",
        "details": "Need asthma inhaler Albuterol",
    }
    res = client.post("/requests", json=new_req_data)
    assert res.status_code == 201, f"Create request failed: {res.text}"
    created = res.json()
    assert created["category"] == "medicine"
    assert created["urgency"] == "normal"
    req_id = created["id"]
    print(f"[PASS] POST /requests (medicine) -> Created ID: {req_id}")

    # 4. Create request with oxygen (must auto-escalate to high urgency)
    res = client.post("/requests", json={
        "category": "oxygen",
        "lat": 37.776,
        "lng": -122.418,
        "requester_device_id": "test-device-uuid-2",
        "details": "Power down, elderly patient requires oxygen",
    })
    assert res.status_code == 201
    oxy_req = res.json()
    assert oxy_req["urgency"] == "high", f"Expected urgency 'high', got '{oxy_req['urgency']}'"
    print("[PASS] POST /requests (oxygen) -> Auto-promoted to urgency 'high'")

    # 5. Patch request (Admin triage approve)
    res = client.patch(f"/requests/{req_id}", json={"admin_status": "approved"})
    assert res.status_code == 200
    assert res.json()["admin_status"] == "approved"
    print("[PASS] PATCH /requests/{id} -> admin_status approved")

    # 6. Filter by admin_status
    res = client.get("/requests?admin_status=approved")
    assert res.status_code == 200
    for r in res.json():
        assert r["admin_status"] == "approved"
    print("[PASS] GET /requests?admin_status=approved -> filter working")

    # 7. Messages endpoints
    match_id = f"test-match-{req_id[:8]}"
    res = client.post("/messages", json={
        "match_id": match_id,
        "sender_id": "test-device-uuid-1",
        "body": "Volunteer is on the way with inhaler.",
    })
    assert res.status_code == 201
    print("[PASS] POST /messages -> 201 Created")

    res = client.get(f"/messages/{match_id}")
    assert res.status_code == 200
    msgs = res.json()
    assert len(msgs) >= 1
    assert msgs[0]["body"] == "Volunteer is on the way with inhaler."
    print("[PASS] GET /messages/{match_id} -> 200 OK")

    # 8. Zone report endpoint
    res = client.post("/zone-reports", json={
        "category": "rescue",
        "lat": 37.778,
        "lng": -122.415,
        "device_id": "reporter-01",
    })
    assert res.status_code == 201
    print("[PASS] POST /zone-reports -> 201 Created")

    # 9. Confirmed zones
    res = client.get("/confirmed-zones")
    assert res.status_code == 200
    print("[PASS] GET /confirmed-zones -> 200 OK")

    print("\n>>> ALL BACKEND API ENDPOINTS & LIVE SUPABASE INTEGRATION PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    test_endpoints()
