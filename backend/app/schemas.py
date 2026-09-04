"""Request/response models."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from .blood import VALID_BLOOD_TYPES
from .config import CRITICAL_CATEGORIES, NON_CRITICAL_CATEGORIES

Category = str
Urgency = Literal["low", "normal", "high", "critical"]


def _validate_category(v: str, allowed: set[str]) -> str:
    v = v.strip().lower()
    if v not in allowed:
        raise ValueError(f"category must be one of {sorted(allowed)}")
    return v


class RequestCreate(BaseModel):
    """Non-critical structured-request path (POST /requests). For the
    critical/SOS path see SosCreate + POST /sos."""
    category: Category
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    requester_device_id: str = Field(min_length=1)
    urgency: Optional[Urgency] = None
    requester_name: Optional[str] = None
    requester_phone: Optional[str] = None
    details: Optional[str] = None
    photo_url: Optional[str] = None
    # Category-specific fields (docs/AGENT-FLOW.md section 3), e.g. for
    # blood: {"blood_group": "O+", "quantity": "2 units", "hospital": "..."}.
    # Not schema-validated per-field -- see config.REQUIRED_STRUCTURED_FIELDS
    # for the completeness check the verification pipeline runs on this.
    service_details: Optional[dict[str, Any]] = None
    voice_note_url: Optional[str] = None
    proof_video_url: Optional[str] = None
    # Accepted for co-dev frontend compatibility; the server derives
    # severity_class from the category and ignores this as authority.
    is_critical: Optional[bool] = None
    # Ignored on purpose -- clients may not self-approve (contract S0.3).
    admin_status: Optional[str] = None

    @field_validator("category")
    @classmethod
    def _cat(cls, v: str) -> str:
        # Critical categories go through POST /sos, not here -- keeps the
        # two flows' domains mutually exclusive rather than overlapping.
        return _validate_category(v, NON_CRITICAL_CATEGORIES)


class SosCreate(BaseModel):
    """Critical/SOS path (POST /sos) -- minimum interaction by design: no
    structured fields, no verification gate, straight to incident grouping
    and broadcast."""
    category: Category
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    requester_device_id: str = Field(min_length=1)
    details: Optional[str] = None
    photo_url: Optional[str] = None
    # Offline-queued SOS synced late (docs/AGENT-FLOW.md section 2B): the
    # original client-side trigger time, distinct from the row's created_at
    # (server receipt time).
    client_created_at: Optional[datetime] = None
    via_offline_sync: bool = False

    @field_validator("category")
    @classmethod
    def _cat(cls, v: str) -> str:
        return _validate_category(v, CRITICAL_CATEGORIES)


class IncidentAssessment(BaseModel):
    """Responder's on-scene report (docs/AGENT-FLOW.md section 2A step 6)."""
    submitted_by: str = Field(min_length=1)  # helper_id
    people_affected: Optional[int] = Field(default=None, ge=0)
    injuries: Optional[int] = Field(default=None, ge=0)
    trapped: Optional[int] = Field(default=None, ge=0)
    medical_assistance_required: Optional[bool] = None
    rescue_required: Optional[bool] = None
    ambulance_required: Optional[bool] = None
    food_water_required: Optional[bool] = None
    other_resources: Optional[str] = None
    notes: Optional[str] = None


class IncidentPatch(BaseModel):
    status: Optional[Literal[
        "sos_triggered", "alert_sent", "responder_accepted", "on_the_way",
        "assessed", "coordinated", "resolved",
    ]] = None
    coordinating_orgs: Optional[list[str]] = None


class RequestReopen(BaseModel):
    reason: Optional[str] = None


class RequestEnrich(BaseModel):
    """PRD step 2 -- optional, skippable enrichment after instant submit."""
    requester_name: Optional[str] = None
    requester_phone: Optional[str] = None
    details: Optional[str] = None
    photo_url: Optional[str] = None
    voice_note_url: Optional[str] = None
    service_details: Optional[dict[str, Any]] = None


class RequestAdminPatch(BaseModel):
    admin_status: Optional[Literal["pending", "approved", "rejected", "flagged"]] = None
    status: Optional[Literal["requested", "matched", "in_progress", "resolved", "expired"]] = None


class AcceptBody(BaseModel):
    helper_id: Optional[str] = None
    helper_name: Optional[str] = None
    helper_phone: Optional[str] = None
    helper_role: Optional[str] = None
    blood_group: Optional[str] = None
    blood_type: Optional[str] = None
    helper_lat: Optional[float] = None
    helper_lng: Optional[float] = None

    @classmethod
    def model_validate(cls, obj: Any, *args, **kwargs):
        if isinstance(obj, dict):
            obj = dict(obj)
            if "blood_type" in obj and not obj.get("blood_group"):
                obj["blood_group"] = obj["blood_type"]
            if "bloodGroup" in obj and not obj.get("blood_group"):
                obj["blood_group"] = obj["bloodGroup"]
        return super().model_validate(obj, *args, **kwargs)


class MatchStatusPatch(BaseModel):
    status: Literal["en_route", "arrived", "resolved"]


class HelperPatch(BaseModel):
    available: Optional[bool] = None
    name: Optional[str] = None
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    blood_type: Optional[str] = None  # for blood-request donor matching
    skills: Optional[list[str]] = None
    domains: Optional[list[str]] = None

    @field_validator("blood_type")
    @classmethod
    def _blood(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip().upper()
        if v not in VALID_BLOOD_TYPES:
            raise ValueError(f"blood_type must be one of {sorted(VALID_BLOOD_TYPES)}")
        return v


class SendOtpRequest(BaseModel):
    contact: str = Field(min_length=3)
    role: Optional[Literal["volunteer", "ngo_admin", "ngo"]] = "volunteer"
    name: Optional[str] = None

    @classmethod
    def model_validate(cls, obj: Any, *args, **kwargs):
        if isinstance(obj, dict):
            obj = dict(obj)
            if "phone" in obj and "contact" not in obj:
                obj["contact"] = obj["phone"]
            if obj.get("role") == "ngo":
                obj["role"] = "ngo_admin"
        return super().model_validate(obj, *args, **kwargs)


class DeviceTokenRegister(BaseModel):
    platform: Literal["ios", "android"]
    token: str = Field(min_length=1)


class VerifyOtpRequest(BaseModel):
    contact: str = Field(min_length=3)
    otp_code: str
    role: Optional[Literal["volunteer", "ngo_admin", "ngo"]] = "volunteer"

    @classmethod
    def model_validate(cls, obj: Any, *args, **kwargs):
        if isinstance(obj, dict):
            obj = dict(obj)
            if "phone" in obj and "contact" not in obj:
                obj["contact"] = obj["phone"]
            if "code" in obj and "otp_code" not in obj:
                obj["otp_code"] = obj["code"]
            if obj.get("role") == "ngo":
                obj["role"] = "ngo_admin"
        return super().model_validate(obj, *args, **kwargs)


class LoginRequest(BaseModel):
    identifier: str = Field(..., description="Phone, Email, ID, or Darpan ID")
    role: Optional[Literal["volunteer", "ngo_admin", "ngo"]] = None


class RegisterHelperRequest(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: Literal["volunteer", "ngo_admin", "ngo"] = "volunteer"
    org_name: Optional[str] = None
    darpan_id: Optional[str] = None
    darpanId: Optional[str] = None
    blood_type: Optional[str] = None
    bloodGroup: Optional[str] = None
    skills: Optional[list[str]] = []
    domains: Optional[list[str]] = []
    badge: Optional[str] = None
    vehicle_type: Optional[str] = None
    id_file_name: Optional[str] = None

    @classmethod
    def model_validate(cls, obj: Any, *args, **kwargs):
        if isinstance(obj, dict):
            obj = dict(obj)
            if obj.get("role") == "ngo":
                obj["role"] = "ngo_admin"
            if "bloodGroup" in obj and not obj.get("blood_type"):
                obj["blood_type"] = obj["bloodGroup"]
            if "darpanId" in obj and not obj.get("darpan_id"):
                obj["darpan_id"] = obj["darpanId"]
        return super().model_validate(obj, *args, **kwargs)


class ZoneReportCreate(BaseModel):
    category: Category
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    device_id: str = Field(min_length=1)


class MessageCreate(BaseModel):
    match_id: str
    sender_id: str
    body: str = Field(min_length=1)
