import pytest
import httpx
from httpx import ASGITransport, AsyncClient

from app.main import app
from app import config, db

@pytest.mark.asyncio
async def test_critical_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Trigger SOS
        res = await client.post("/sos", json={
            "category": "earthquake",
            "lat": 19.0760,
            "lng": 72.8777,
            "requester_device_id": "test-device-1",
            "details": "Trapped under rubble"
        })
        assert res.status_code == 201
        data = res.json()
        assert "incident" in data
        assert "request" in data
        incident_id = data["incident"]["id"]

        # 2. Check responders (escalating search)
        res = await client.get(f"/incidents/{incident_id}/responders")
        assert res.status_code == 200
        responders_data = res.json()
        assert "radius_m" in responders_data

        # 3. Assessment
        res = await client.post(f"/incidents/{incident_id}/assessment", json={
            "submitted_by": "test-responder",
            "trapped": 2,
            "injuries": 1
        })
        assert res.status_code == 200
        assessment_data = res.json()
        assert assessment_data["status"] == "assessed"

        # 4. Timeline
        res = await client.get(f"/incidents/{incident_id}/timeline")
        assert res.status_code == 200
        timeline = res.json()
        assert len(timeline) >= 2
        statuses = [t["status"] for t in timeline]
        assert "sos_triggered" in statuses
        assert "assessed" in statuses
