from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import random
from database import db_list_helpers, db_get_helper, db_create_helper, db_find_helper

router = APIRouter(prefix="/auth", tags=["auth"])

# Temporary in-memory OTP cache for verification
OTP_STORE: Dict[str, str] = {
    "+91 98201 55019": "749201",
    "operations@redcrossmumbai.org": "839104",
}


class SendOtpRequest(BaseModel):
    contact: str = Field(..., description="Phone number or Email address")
    role: Optional[str] = "volunteer"


class VerifyOtpRequest(BaseModel):
    contact: str
    otp_code: str
    role: Optional[str] = "volunteer"


class LoginRequest(BaseModel):
    identifier: str = Field(..., description="Phone, Email, ID, or Darpan ID")
    role: Optional[str] = None


class RegisterHelperRequest(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: str = "volunteer"
    org_name: Optional[str] = None
    darpanId: Optional[str] = None
    bloodGroup: Optional[str] = None
    skills: Optional[List[str]] = []
    domains: Optional[List[str]] = []
    badge: Optional[str] = None
    vehicleType: Optional[str] = None
    idFileName: Optional[str] = None


@router.post("/send-otp")
async def send_otp(req: SendOtpRequest):
    """Simulate sending 6-digit OTP via SMS or Email"""
    code = f"{random.randint(100000, 999999)}"
    OTP_STORE[req.contact.strip()] = code
    return {
        "status": "success",
        "message": f"OTP sent to {req.contact}",
        "otp_code": code, # Returned for dev simulation/instant auto-fill
        "contact": req.contact
    }


@router.post("/verify-otp")
async def verify_otp(req: VerifyOtpRequest):
    """Verify submitted OTP code"""
    contact = req.contact.strip()
    
    # Allow any valid 6-digit code or matched code in testing mode
    if len(req.otp_code.strip()) != 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP. Please enter a valid 6-digit verification code."
        )

    # Check if helper already exists in DB
    existing = await db_find_helper(contact)
    if existing:
        return {
            "status": "verified",
            "is_new_user": False,
            "profile": existing
        }

    return {
        "status": "verified",
        "is_new_user": True,
        "contact": contact
    }


@router.post("/login")
async def login(req: LoginRequest):
    """Quick login for existing volunteers and NGOs"""
    helper = await db_find_helper(req.identifier)
    if not helper:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No verified account found for '{req.identifier}'. Please check credentials or register as new responder."
        )
    return {
        "status": "success",
        "profile": helper
    }


@router.get("/helpers")
async def get_helpers(role: Optional[str] = None):
    """List all registered volunteers or NGOs in DB"""
    helpers = await db_list_helpers(role)
    return helpers


@router.post("/helpers", status_code=status.HTTP_201_CREATED)
async def create_helper(req: RegisterHelperRequest):
    """Register a new Volunteer or NGO"""
    created = await db_create_helper(req.dict())
    return created
