import pytest
import httpx
from httpx import ASGITransport, AsyncClient

from app.main import app
from app import config, db

@pytest.mark.asyncio
async def test_noncritical_flow():
    # Cleanup previous test runs
    async with db.pool().acquire() as conn:
        await conn.execute("delete from requests where requester_device_id = 'test-device-unique-noncrit-1'")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Submit Request
        res = await client.post("/requests", json={
            "category": "medicine",
            "lat": 19.4560,
            "lng": 72.9123,
            "requester_device_id": "test-device-unique-noncrit-1",
            "service_details": {"medicine_names": "Insulin"}
        })
        assert res.status_code == 201
        data = res.json()
        assert data["severity_class"] == "non_critical"
        assert data["verification_status"] == "pending" # pending since no phone/photo
        req_id = data["id"]

        # 2. Enrich Request
        res = await client.patch(f"/requests/{req_id}/enrich", json={
            "requester_phone": "+919876543210"
        })
        assert res.status_code == 200

        # 3. Resolve Request
        res = await client.post(f"/requests/{req_id}/resolve")
        assert res.status_code == 200
        assert res.json()["status"] == "resolved"
        
        # 4. Reopen Request
        res = await client.post(f"/requests/{req_id}/reopen", json={"reason": "Still need help"})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "requested"
        assert data["reopen_reason"] == "Still need help"
