"""Helper (volunteer / NGO) profile + availability."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from .. import db, serialize
from ..ids import parse_uuid
from ..schemas import DeviceTokenRegister, HelperPatch

router = APIRouter(tags=["helpers"])


@router.get("/helpers/{helper_id}")
async def get_helper(helper_id: str):
    row = await db.fetchrow(
        "select * from helpers where id = $1", parse_uuid(helper_id, "helper_id"))
    if row is None:
        raise HTTPException(404, "helper not found")
    return serialize.row(row)


@router.patch("/helpers/{helper_id}")
async def patch_helper(helper_id: str, body: HelperPatch):
    """Availability toggle (and optional profile/location update)."""
    hid = parse_uuid(helper_id, "helper_id")
    if body.available is None and body.name is None and body.lat is None \
            and body.lng is None and body.blood_type is None:
        raise HTTPException(400, "nothing to update")
    row = await db.fetchrow(
        """
        update helpers
           set available  = coalesce($2, available),
               name       = coalesce($3, name),
               lat        = coalesce($4, lat),
               lng        = coalesce($5, lng),
               blood_type = coalesce($6, blood_type)
         where id = $1
        returning *
        """,
        hid, body.available, body.name, body.lat, body.lng, body.blood_type,
    )
    if row is None:
        raise HTTPException(404, "helper not found")
    return serialize.row(row)


# ---------------------------------------------------------------------------
# Push notification readiness (docs/NOTIFICATIONS-HAPTICS-SHORTCUTS.md).
# Registration works today; nothing sends a real push until Tier 2 (Firebase
# credentials) exists -- see app/push.py.
# ---------------------------------------------------------------------------
@router.post("/helpers/{helper_id}/device-tokens", status_code=201)
async def register_device_token(helper_id: str, body: DeviceTokenRegister):
    hid = parse_uuid(helper_id, "helper_id")
    if not await db.fetchval("select exists(select 1 from helpers where id=$1)", hid):
        raise HTTPException(404, "helper not found")
    row = await db.fetchrow(
        """
        insert into device_tokens (helper_id, platform, token)
        values ($1, $2, $3)
        on conflict (helper_id, token) do update set platform = excluded.platform
        returning *
        """,
        hid, body.platform, body.token,
    )
    return serialize.row(row)


@router.delete("/helpers/{helper_id}/device-tokens/{token}", status_code=204)
async def unregister_device_token(helper_id: str, token: str):
    hid = parse_uuid(helper_id, "helper_id")
    await db.execute(
        "delete from device_tokens where helper_id = $1 and token = $2", hid, token)
    return None
