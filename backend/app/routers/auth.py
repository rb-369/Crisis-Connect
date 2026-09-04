"""Mock OTP login for volunteers / NGO admins + full helper registration.

Real SMS needs a telephony provider, which is out of scope for the demo, so
any code is accepted (or a fixed DEMO_OTP if ACCEPT_ANY_OTP is turned off).
The demo code is echoed in the send-otp response so the Flutter app can be
driven end-to-end without a phone.
"""
from __future__ import annotations

import re
from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Query

from .. import auth, config, db, serialize
from ..schemas import SendOtpRequest, VerifyOtpRequest, LoginRequest, RegisterHelperRequest

router = APIRouter(prefix="/auth", tags=["auth"])

# Compat alias for Flutter v1
@router.post("/request-otp")
@router.post("/send-otp")
async def send_otp(body: SendOtpRequest):
    """Simulate sending 6-digit OTP via SMS or Email"""
    contact = body.contact.strip()
    role = body.role or "volunteer"
    
    # Check if helper already exists
    row = await db.fetchrow("select * from helpers where phone = $1 or email = $1", contact)
    helper_id = None
    if row is not None:
        helper_id = str(row["id"])
    elif body.name:
        # Create helper for Flutter v1 bootstrap
        is_email = "@" in contact
        new_row = await db.fetchrow(
            """
            insert into helpers (name, phone, email, role, verified, available)
            values ($1, $2, $3, $4, true, true)
            returning id
            """,
            body.name,
            None if is_email else contact,
            contact if is_email else None,
            role,
        )
        if new_row:
            helper_id = str(new_row["id"])

    res = {
        "sent": True,
        "contact": contact,
        "demo_code": config.DEMO_OTP,
        "accepts_any_code": config.ACCEPT_ANY_OTP,
    }
    if helper_id:
        res["helper_id"] = helper_id
    return res


@router.post("/verify-otp")
async def verify_otp(body: VerifyOtpRequest):
    """Verify submitted OTP code and authenticate helper."""
    contact = body.contact.strip()
    code = body.otp_code.strip()

    if not config.ACCEPT_ANY_OTP and code != config.DEMO_OTP:
        raise HTTPException(401, "invalid code")
    if not code:
        raise HTTPException(400, "code is required")

    # Check if helper exists by phone or email
    row = await db.fetchrow(
        "select * from helpers where phone = $1 or email = $1", 
        contact
    )
    
    if row is None:
        raise HTTPException(404, "helper not found")

    helper = serialize.row(row)
    token = auth.issue(helper["id"])
    return {
        "status": "verified",
        "is_new_user": False,
        "token": token,
        "profile": helper,
        "helper": helper, # compat
    }


@router.post("/login")
async def login(body: LoginRequest):
    """Quick login for existing volunteers and NGOs by identifier (no OTP in demo)."""
    identifier = body.identifier.strip()
    clean_id = re.sub(r"[\s\-\(\)]", "", identifier)
    row = await db.fetchrow(
        """
        select * from helpers 
         where phone = $1 
            or email = $1 
            or darpan_id = $1
            or replace(replace(replace(replace(coalesce(phone, ''), ' ', ''), '-', ''), '(', ''), ')', '') = $2
            or name ilike '%' || $1 || '%'
        limit 1
        """, 
        identifier, clean_id
    )
    if row is None:
        raise HTTPException(
            404, 
            f"No verified account found for '{identifier}'. Please register as new responder."
        )
    helper = serialize.row(row)
    return {
        "status": "success",
        "token": auth.issue(helper["id"]),
        "profile": helper,
        "helper": helper,
    }


@router.post("/helpers", status_code=201)
async def create_helper(body: RegisterHelperRequest):
    """Register a new Volunteer or NGO"""
    role = "ngo_admin" if body.role in ("ngo", "ngo_admin") else "volunteer"
    blood_type = body.blood_type or body.bloodGroup
    darpan_id = body.darpan_id or body.darpanId
    phone = (body.phone or "").strip()
    row = await db.fetchrow(
        """
        insert into helpers (
            name, phone, email, role, org_name, darpan_id, 
            blood_type, skills, domains, badge, vehicle_type, 
            id_file_name, verified, available
        )
        values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, true
        )
        on conflict (phone) do update set
            name = excluded.name,
            email = coalesce(excluded.email, helpers.email),
            role = excluded.role,
            org_name = coalesce(excluded.org_name, helpers.org_name),
            darpan_id = coalesce(excluded.darpan_id, helpers.darpan_id),
            blood_type = coalesce(excluded.blood_type, helpers.blood_type),
            skills = excluded.skills,
            domains = excluded.domains,
            badge = coalesce(excluded.badge, helpers.badge),
            vehicle_type = coalesce(excluded.vehicle_type, helpers.vehicle_type),
            id_file_name = coalesce(excluded.id_file_name, helpers.id_file_name)
        returning *
        """,
        body.name, phone, body.email, role, body.org_name, darpan_id,
        blood_type, body.skills, body.domains, body.badge, body.vehicle_type,
        body.id_file_name
    )
    helper = serialize.row(row)
    return {
        "status": "success",
        "token": auth.issue(helper["id"]),
        "helper": helper,
        "profile": helper
    }


@router.get("/helpers")
async def get_helpers(role: Optional[str] = Query(None)):
    """List all registered volunteers or NGOs in DB"""
    if role:
        if role in ("ngo", "ngo_admin"):
            rows = await db.fetch("select * from helpers where role in ('ngo', 'ngo_admin') order by name asc")
        else:
            rows = await db.fetch("select * from helpers where role = $1 order by name asc", role)
    else:
        rows = await db.fetch("select * from helpers order by name asc")
    return serialize.rows(rows)


@router.get("/me")
async def me(authorization: str = Header(default="")):
    """Verify a session token. Volunteer app calls this on cold start."""
    token = authorization[7:].strip() if authorization.lower().startswith("bearer ") \
        else authorization.strip()
    helper_id = auth.verify(token)
    if not helper_id:
        raise HTTPException(401, "invalid or expired token")
    row = await db.fetchrow("select * from helpers where id = $1::uuid", helper_id)
    if row is None:
        raise HTTPException(404, "helper not found")
    return serialize.row(row)
