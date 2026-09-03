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
    db_heartbeat_request,
    db_expire_stale_requests,
    compute_priority_score,
    check_is_stale,
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
    voice_note_url: Optional[str] = None
    service_details: Optional[Dict[str, Any]] = None
    admin_status: Optional[str] = "approved"
    linked_request_id: Optional[str] = None
    is_critical: Optional[bool] = False


class RequestUpdate(BaseModel):
    admin_status: Optional[str] = None  # pending, approved, rejected, flagged
    status: Optional[str] = None        # requested, matched, en_route, on_the_way, arrived, resolved, expired
    requester_name: Optional[str] = None
    requester_phone: Optional[str] = None
    details: Optional[str] = None
    photo_url: Optional[str] = None
    voice_note_url: Optional[str] = None
    service_details: Optional[Dict[str, Any]] = None
    zone_confirmed: Optional[bool] = None


class HelperAcceptPayload(BaseModel):
    helper_id: Optional[str] = "h-1001-vol"
    helper_name: Optional[str] = "Volunteer Unit Alpha (Red Cross Mumbai)"
    helper_phone: Optional[str] = "+91 98201 55019"
    helper_role: Optional[str] = "volunteer"
    blood_group: Optional[str] = None
    helper_lat: Optional[float] = None
    helper_lng: Optional[float] = None


@router.post("", status_code=201)
async def create_request(payload: RequestCreate):
    """
    Step 1 & 2: Create a crisis request.
    Supports Non-Critical & Critical Emergency requests with device debounce,
    spatial-temporal clustering, and priority & genuineness scoring.
    """
    data_dict = payload.model_dump()
    created = await db_create_request(data_dict)

    # Attach linked_count and priority score
    linked_count = await db_get_linked_count(created["id"])
    created["linked_count"] = linked_count
    created["priority_score"] = compute_priority_score(created, linked_count)
    created["is_stale"] = check_is_stale(created)

    # Broadcast to admin, volunteers, and request channel
    await ws_manager.broadcast("admin", "new_request", created)
    await ws_manager.broadcast("volunteers", "new_request", created)
    await ws_manager.broadcast(f"request:{created['id']}", "new_request", created)
    await ws_manager.broadcast_all("new_request", created)

    return created


@router.post("/reseed")
async def reseed_database():
    """Reset and re-populate fresh Mumbai non-critical and critical emergency scenarios"""
    mem_db.requests.clear()
    mem_db.matches.clear()
    mem_db.messages.clear()
    mem_db.zone_reports.clear()
    mem_db.confirmed_zones.clear()
    mem_db.seed_default_data()
    
    # Broadcast reset
    await ws_manager.broadcast_all("reseeded", {"status": "ok"})
    return {"status": "reseeded", "requests_count": len(mem_db.requests)}


@router.get("")
async def list_requests(
    admin_status: Optional[str] = Query(None),
    exclude_expired: bool = Query(False),
    sort_by: Optional[str] = Query("priority"),
):
    """
    List requests with priority & genuineness scoring, duplicate counts,
    and optional exclusion of expired requests for volunteer dispatch.
    """
    return await db_list_requests(
        admin_status=admin_status,
        exclude_expired=exclude_expired,
        sort_by=sort_by
    )


@router.get("/{request_id}")
async def get_request(request_id: str):
    req = await db_get_request(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    req["linked_count"] = await db_get_linked_count(request_id)
    req["priority_score"] = compute_priority_score(req, req["linked_count"])
    req["is_stale"] = check_is_stale(req)
    return req


@router.post("/{request_id}/heartbeat")
async def heartbeat_request(request_id: str):
    """
    Requester Liveness Heartbeat ('Still Need Help?').
    Extends category TTL, resets staleness, and confirms emergency is still genuine and active.
    """
    updated = await db_heartbeat_request(request_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Request not found")

    await ws_manager.broadcast(f"request:{request_id}", "heartbeat_confirmed", updated)
    await ws_manager.broadcast("admin", "status_update", updated)
    await ws_manager.broadcast("volunteers", "status_update", updated)
    await ws_manager.broadcast_all("status_update", updated)

    return {"status": "heartbeat_received", "request": updated}


@router.post("/{request_id}/expire")
async def expire_request(request_id: str):
    """
    Explicitly marks a request as expired / stale.
    Removes it from active volunteer feeds.
    """
    req = await db_get_request(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    updated = await db_update_request(request_id, {"status": "expired"})
    updated["linked_count"] = await db_get_linked_count(request_id)
    updated["priority_score"] = compute_priority_score(updated, updated["linked_count"])

    await ws_manager.broadcast(f"request:{request_id}", "status_update", updated)
    await ws_manager.broadcast("admin", "status_update", updated)
    await ws_manager.broadcast("volunteers", "status_update", updated)
    await ws_manager.broadcast_all("status_update", updated)

    return {"status": "expired", "request": updated}


@router.patch("/{request_id}")
async def update_request(request_id: str, payload: RequestUpdate):
    """
    Update request.
    Supports admin triage, optional enrichment, and status lifecycle progression.
    Broadcasts 'status_update' over WebSocket.
    """
    existing = await db_get_request(request_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Request not found")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        return existing

    updated = await db_update_request(request_id, updates)
    linked_count = await db_get_linked_count(request_id)
    updated["linked_count"] = linked_count
    updated["priority_score"] = compute_priority_score(updated, linked_count)
    updated["is_stale"] = check_is_stale(updated)

    # Broadcast updates
    await ws_manager.broadcast(f"request:{request_id}", "status_update", updated)
    await ws_manager.broadcast("admin", "status_update", updated)
    await ws_manager.broadcast("volunteers", "status_update", updated)
    await ws_manager.broadcast_all("status_update", updated)

    return updated


# Volunteer & Donor Accept endpoint supporting custom helper identity
@router.post("/{request_id}/accept")
async def simulate_accept_request(request_id: str, helper_payload: Optional[HelperAcceptPayload] = None):
    """
    Accepts a request, simulates volunteer / donor assignment, creates a match,
    and broadcasts 'matched' to request, admin, and volunteer channels.
    """
    req = await db_get_request(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # Concurrency Guard: If request is already accepted by another volunteer/donor, prevent double-accept
    if req.get("status") in ["matched", "en_route", "on_the_way", "arrived", "resolved", "completed"] or req.get("match_id"):
        existing_match = mem_db.matches.get(req.get("match_id")) if req.get("match_id") else None
        existing_helper = (
            existing_match.get("helper_name")
            if existing_match
            else (req.get("match_info", {}).get("helper_name") if isinstance(req.get("match_info"), dict) else None)
        )
        msg = f"This emergency request has already been accepted by {existing_helper or 'another responder'}."
        raise HTTPException(status_code=409, detail=msg)

    match_id = str(uuid.uuid4())
    
    helper_name = helper_payload.helper_name if helper_payload and helper_payload.helper_name else "Volunteer Unit Alpha (Red Cross Mumbai)"
    helper_phone = helper_payload.helper_phone if helper_payload and helper_payload.helper_phone else "+91 98201 55019"
    helper_id = helper_payload.helper_id if helper_payload and helper_payload.helper_id else "h-1001-vol"
    helper_lat = helper_payload.helper_lat if helper_payload and helper_payload.helper_lat is not None else (req["lat"] + 0.003)
    helper_lng = helper_payload.helper_lng if helper_payload and helper_payload.helper_lng is not None else (req["lng"] + 0.003)

    match_data = {
        "id": match_id,
        "request_id": request_id,
        "helper_id": helper_id,
        "status": "on_the_way",
        "helper_name": helper_name,
        "helper_phone": helper_phone,
        "helper_role": helper_payload.helper_role if helper_payload else "volunteer",
        "blood_group": helper_payload.blood_group if helper_payload else None,
        "helper_lat": helper_lat,
        "helper_lng": helper_lng,
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
