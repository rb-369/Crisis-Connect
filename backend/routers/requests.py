import uuid
from typing import Optional, List, Any, Dict
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from database import (
    db_create_request,
    db_list_requests,
    db_get_request,
    db_update_request,
    db_get_linked_count,
    mem_db,
)
from websocket_manager import ws_manager

router = APIRouter(prefix="/requests", tags=["Requests"])


class RequestCreate(BaseModel):
    category: str
    lat: float
    lng: float
    requester_device_id: str
    urgency: Optional[str] = "normal"
    status: Optional[str] = "requested"
    requester_name: Optional[str] = None
    requester_phone: Optional[str] = None
    details: Optional[str] = None
    photo_url: Optional[str] = None
    admin_status: Optional[str] = "pending"
    linked_request_id: Optional[str] = None


class RequestUpdate(BaseModel):
    admin_status: Optional[str] = None  # pending, approved, rejected, flagged
    status: Optional[str] = None        # requested, matched, in_progress, resolved, expired
    requester_name: Optional[str] = None
    requester_phone: Optional[str] = None
    details: Optional[str] = None
    photo_url: Optional[str] = None
    zone_confirmed: Optional[bool] = None


@router.post("", status_code=201)
async def create_request(payload: RequestCreate):
    """
    Step 1 & 2: Create a crisis request.
    Auto-promotes oxygen and rescue to high urgency.
    Broadcasts 'new_request' event over WebSocket across all channels.
    """
    data_dict = payload.model_dump()
    created = await db_create_request(data_dict)

    # Attach linked_count if any duplicate was identified
    linked_count = await db_get_linked_count(created["id"])
    created["linked_count"] = linked_count

    # Broadcast to admin, volunteers, and request channel
    await ws_manager.broadcast("admin", "new_request", created)
    await ws_manager.broadcast("volunteers", "new_request", created)
    await ws_manager.broadcast(f"request:{created['id']}", "new_request", created)
    await ws_manager.broadcast_all("new_request", created)

    return created


@router.get("")
async def list_requests(admin_status: Optional[str] = Query(None)):
    """
    Step 1 & 4: List requests with optional admin_status filtering.
    Enriches with linked duplicate count for Step 8.
    """
    items = await db_list_requests(admin_status=admin_status)
    for req in items:
        req["linked_count"] = await db_get_linked_count(req["id"])
    return items


@router.get("/{request_id}")
async def get_request(request_id: str):
    req = await db_get_request(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    req["linked_count"] = await db_get_linked_count(request_id)
    return req


@router.patch("/{request_id}")
async def update_request(request_id: str, payload: RequestUpdate):
    """
    Step 1 & 3 & 4: Update request.
    Supports admin triage (approve/reject/flag) and Step 3 optional enrichment.
    Broadcasts 'status_update' over WebSocket.
    """
    existing = await db_get_request(request_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Request not found")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        return existing

    updated = await db_update_request(request_id, updates)
    updated["linked_count"] = await db_get_linked_count(request_id)

    # Broadcast updates
    await ws_manager.broadcast(f"request:{request_id}", "status_update", updated)
    await ws_manager.broadcast("admin", "status_update", updated)
    await ws_manager.broadcast("volunteers", "status_update", updated)
    await ws_manager.broadcast_all("status_update", updated)

    return updated


# Simulation endpoint for Dev A full lifecycle testing & volunteer accept from map
@router.post("/{request_id}/accept")
async def simulate_accept_request(request_id: str):
    """
    Accepts a request, simulates volunteer assignment, creates a match,
    and broadcasts 'matched' to request, admin, and volunteer channels.
    """
    req = await db_get_request(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    match_id = str(uuid.uuid4())
    helper_id = "h-1001-vol"
    match_data = {
        "id": match_id,
        "request_id": request_id,
        "helper_id": helper_id,
        "status": "en_route",
        "helper_name": "Volunteer Unit Alpha (Red Cross)",
        "helper_phone": "+1 (555) 0192",
        "helper_lat": req["lat"] + 0.003,
        "helper_lng": req["lng"] + 0.003,
    }
    mem_db.matches[match_id] = match_data

    # Update request status to matched
    updated = await db_update_request(request_id, {
        "status": "matched",
        "match_id": match_id,
    })
    updated["match_info"] = match_data

    # Broadcast 'matched' event across all channels
    await ws_manager.broadcast(f"request:{request_id}", "matched", updated)
    await ws_manager.broadcast("admin", "matched", updated)
    await ws_manager.broadcast("volunteers", "matched", updated)
    await ws_manager.broadcast_all("matched", updated)

    return {"status": "matched", "match": match_data, "request": updated}
