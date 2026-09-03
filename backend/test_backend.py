import asyncio
from fastapi.testclient import TestClient
from main import app

def test_endpoints():
    print("Testing Backend Endpoints against active configuration...")

    with TestClient(app) as client:
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
            "lat": 19.075,
            "lng": 72.877,
            "requester_device_id": "test-device-uuid-1",
            "details": "Need asthma inhaler Albuterol",
            "service_details": {"medicine_names": "Albuterol Inhaler"},
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
            "lat": 19.076,
            "lng": 72.878,
            "requester_device_id": "test-device-uuid-2",
            "details": "Power down, elderly patient requires oxygen",
            "service_details": {"oxygen_type": "Concentrator", "flow_rate": "5 LPM"},
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

        # 7. Zone report endpoint
        res = client.post("/zone-reports", json={
            "category": "flood",
            "lat": 19.078,
            "lng": 72.875,
            "device_id": "reporter-01",
        })
        assert res.status_code == 201
        print("[PASS] POST /zone-reports -> 201 Created")

        # 8. Concurrency Accept Test (Single accept allowed, second volunteer gets 409)
        res_accept1 = client.post(f"/requests/{req_id}/accept", json={
            "helper_id": "vol-rahul",
            "helper_name": "Rahul Sawant (B+)",
            "helper_phone": "+91 98190 77654",
            "blood_group": "B+",
        })
        assert res_accept1.status_code == 200, f"First accept failed: {res_accept1.text}"
        assert res_accept1.json()["status"] == "matched"
        match_id = res_accept1.json()["match"]["id"]
        print("[PASS] POST /requests/{id}/accept (First responder) -> 200 OK Matched")

        # 9. Messages endpoints
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

        # Second volunteer attempts to accept the already-matched request
        res_accept2 = client.post(f"/requests/{req_id}/accept", json={
            "helper_id": "vol-vikram",
            "helper_name": "Vikram Joshi (O-)",
            "helper_phone": "+91 98201 44021",
            "blood_group": "O-",
        })
        assert res_accept2.status_code == 409, f"Expected 409 Conflict, got {res_accept2.status_code}: {res_accept2.text}"
        assert "already been accepted" in res_accept2.json()["detail"]
        print("[PASS] POST /requests/{id}/accept (Second responder) -> 409 Conflict Guard working!")

    print("\n>>> ALL BACKEND API ENDPOINTS & LIVE SUPABASE INTEGRATION PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    test_endpoints()
