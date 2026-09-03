from typing import Optional, List, Dict, Any
from fastapi import APIRouter
from pydantic import BaseModel
from database import db_create_zone_report, db_list_confirmed_zones
from websocket_manager import ws_manager

router = APIRouter(tags=["Zones"])


class ZoneReportCreate(BaseModel):
    category: str
    lat: float
    lng: float
    device_id: str


@router.post("/zone-reports", status_code=201)
async def report_zone(payload: ZoneReportCreate):
    """
    Step 6: Public Crisis Zone Pin-Drop.
    Anyone can report hazard sightings.
    If 3+ reports cluster within 500m, creates a confirmed zone and broadcasts 'zone_confirmed'.
    """
    result = await db_create_zone_report(payload.model_dump())
    confirmed = result.get("confirmed_zone")

    if confirmed:
        await ws_manager.broadcast("admin", "zone_confirmed", confirmed)
        await ws_manager.broadcast("zones", "zone_confirmed", confirmed)

    return result


@router.get("/confirmed-zones")
async def get_confirmed_zones():
    """
    Step 5: Fetch confirmed crisis zones for the Admin Map overlay.
    """
    zones = await db_list_confirmed_zones()
    return zones
