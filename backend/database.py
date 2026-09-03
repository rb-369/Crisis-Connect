import uuid
import math
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from config import SUPABASE_URL, SUPABASE_KEY, USE_LIVE_SUPABASE

# Initialize Supabase client if configured
supabase_client = None
if USE_LIVE_SUPABASE:
    try:
        from supabase import create_client, Client
        supabase_client: Optional[Client] = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("[Database] Initialized live Supabase client.")
    except Exception as e:
        print(f"[Database] Could not connect to Supabase: {e}. Falling back to in-memory store.")
        supabase_client = None


# Sachet CAP Standard Alerts FeatureCollection for Mumbai & Surrounding Districts
MUMBAI_SACHET_ALERTS = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "id": "sachet-mum-001",
            "properties": {
                "headline": "Mithi River Basin Flash Flood & Overflow Warning",
                "category": "Flood",
                "severity": "Extreme", # Red
                "district": "Mumbai Suburban (Kurla - Kalina)",
                "state": "Maharashtra",
                "description": "Brimstowd pumping gates saturated. Mithi river level 3.8m exceeding danger mark. Immediate evacuation along Kranti Nagar and Kurla West.",
                "effective": datetime.now(timezone.utc).isoformat(),
                "expires": "2026-09-04T18:00:00Z"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [72.8650, 19.0600],
                        [72.8900, 19.0620],
                        [72.8950, 19.0800],
                        [72.8700, 19.0850],
                        [72.8600, 19.0720],
                        [72.8650, 19.0600]
                    ]
                ]
            }
        },
        {
            "type": "Feature",
            "id": "sachet-mum-002",
            "properties": {
                "headline": "Mahim Bay & Coastal Tidal Surge Advisory",
                "category": "Cyclone / Surge",
                "severity": "Severe", # Orange
                "district": "Mumbai City (Bandra - Dadar Coast)",
                "state": "Maharashtra",
                "description": "High tide of 4.65m combined with squally winds 55-65 kmph. Avoid promenade and low-lying coastal roads.",
                "effective": datetime.now(timezone.utc).isoformat(),
                "expires": "2026-09-04T12:00:00Z"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [72.8150, 19.0200],
                        [72.8400, 19.0300],
                        [72.8450, 19.0650],
                        [72.8250, 19.0600],
                        [72.8150, 19.0200]
                    ]
                ]
            }
        },
        {
            "type": "Feature",
            "id": "sachet-mum-003",
            "properties": {
                "headline": "Hindmata - Sion Waterlogging & Transit Disruption",
                "category": "Heavy Rain",
                "severity": "Moderate", # Yellow
                "district": "Mumbai Central (Sion - Matunga - Parel)",
                "state": "Maharashtra",
                "description": "Continuous precipitation leading to 1.5ft water accumulation. BEST buses diverted via Dr. B.A. Road flyover.",
                "effective": datetime.now(timezone.utc).isoformat(),
                "expires": "2026-09-04T08:00:00Z"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [72.8400, 19.0050],
                        [72.8650, 19.0150],
                        [72.8700, 19.0450],
                        [72.8450, 19.0400],
                        [72.8400, 19.0050]
                    ]
                ]
            }
        }
    ]
}


# In-Memory store for fast fallback & local instant testing
class MemoryDB:
    def __init__(self):
        self.requests: Dict[str, Dict[str, Any]] = {}
        self.helpers: Dict[str, Dict[str, Any]] = {}
        self.matches: Dict[str, Dict[str, Any]] = {}
        self.messages: List[Dict[str, Any]] = []
        self.zone_reports: List[Dict[str, Any]] = []
        self.confirmed_zones: List[Dict[str, Any]] = []

    def seed_default_data(self):
        """Populate realistic demo crisis data in Mumbai, Maharashtra, India"""
        if self.requests:
            return  # already seeded

        # Helper demo accounts (Mumbai Emergency Volunteers & NGOs)
        dummy_helpers = [
            {
                "id": "VOL-1001",
                "name": "Dr. Rohit Deshmukh",
                "phone": "+91 98201 55019",
                "email": "rohit.deshmukh@redcrossmumbai.org",
                "role": "volunteer",
                "bloodGroup": "O+",
                "org_name": "Indian Red Cross Emergency Response Mumbai",
                "skills": ["first_aid", "emt_paramedic", "blood_donor"],
                "vehicleType": "4x4 SUV",
                "verified": True,
                "available": True,
                "badge": "Verified First Responder",
                "lat": 19.0178,
                "lng": 72.8478, # Dadar TT
            },
            {
                "id": "VOL-1002",
                "name": "Vikram Joshi",
                "phone": "+91 98201 44021",
                "email": "vikram.joshi@bloodheroes.org",
                "role": "volunteer",
                "bloodGroup": "O-",
                "org_name": "Mumbai Blood Heroes Network",
                "skills": ["blood_donor", "first_aid"],
                "vehicleType": "Motorcycle",
                "verified": True,
                "available": True,
                "badge": "Universal Blood Donor (O-)",
                "lat": 19.0178,
                "lng": 72.8478,
            },
            {
                "id": "VOL-1003",
                "name": "Pooja Mehta",
                "phone": "+91 98670 12890",
                "email": "pooja.mehta@kemdonors.in",
                "role": "volunteer",
                "bloodGroup": "A+",
                "org_name": "KEM Voluntary Donors League",
                "skills": ["blood_donor", "shelter_host"],
                "vehicleType": "4x4 SUV",
                "verified": True,
                "available": True,
                "badge": "Registered Blood Donor (A+)",
                "lat": 19.0028,
                "lng": 72.8428,
            },
            {
                "id": "VOL-1004",
                "name": "Rahul Sawant",
                "phone": "+91 98190 77654",
                "email": "rahul.sawant@mumbaicentral.org",
                "role": "volunteer",
                "bloodGroup": "B+",
                "org_name": "Mumbai Central Youth Donors",
                "skills": ["blood_donor", "offroad_driver"],
                "vehicleType": "Van/Mini-Truck",
                "verified": True,
                "available": True,
                "badge": "Registered Blood Donor (B+)",
                "lat": 18.9712,
                "lng": 72.8197,
            },
            {
                "id": "NGO-2001",
                "name": "Indian Red Cross Emergency Response Mumbai",
                "darpanId": "MH/2021/029104",
                "phone": "022-2410-7000",
                "email": "operations@redcrossmumbai.org",
                "role": "ngo",
                "domains": ["medical_camps", "oxygen_banks", "search_rescue"],
                "fleetAmbulances": 6,
                "fleetRescueBoats": 3,
                "verified": True,
                "available": True,
                "badge": "Authorized Humanitarian Agency",
                "lat": 19.0178,
                "lng": 72.8478,
            },
            {
                "id": "NGO-2002",
                "name": "Dharavi Disaster Taskforce & Relief Fleet",
                "darpanId": "MH/2020/018823",
                "phone": "+91 98200 99881",
                "email": "relief@dharavitaskforce.org",
                "role": "ngo",
                "domains": ["food_water", "evac_shelters"],
                "fleetAmbulances": 2,
                "fleetRescueBoats": 4,
                "verified": True,
                "available": True,
                "badge": "Certified Disaster Relief Agency",
                "lat": 19.0434,
                "lng": 72.8567,
            },
            {
                "id": "NGO-2003",
                "name": "Khalsa Aid Mumbai Crisis Wing",
                "darpanId": "MH/2019/044192",
                "phone": "+91 98210 33445",
                "email": "mumbai@khalsaaid.org",
                "role": "ngo",
                "domains": ["food_water", "evac_shelters", "medical_camps"],
                "fleetAmbulances": 4,
                "fleetRescueBoats": 2,
                "verified": True,
                "available": True,
                "badge": "International Humanitarian Partner",
                "lat": 19.0596,
                "lng": 72.8295,
            },
        ]

        for h in dummy_helpers:
            self.helpers[h["id"]] = h

        # Confirmed Hazard Zone (Kurla-Mithi River Basin Flood Zone)
        zone_id = str(uuid.uuid4())
        self.confirmed_zones.append({
            "id": zone_id,
            "category": "rescue",
            "center_lat": 19.0728,
            "center_lng": 72.8785, # Kurla West
            "ml_status": "confirmed_cluster_8_reports",
            "confirmed_at": datetime.now(timezone.utc).isoformat(),
        })

        # Demo requests with Mumbai coordinates & landmarks
        demo_reqs = [
            {
                "id": str(uuid.uuid4()),
                "category": "blood",
                "urgency": "high",
                "status": "requested",
                "lat": 19.0028,
                "lng": 72.8428,
                "requester_device_id": "demo-device-mum-01",
                "requester_name": "KEM Hospital Blood Bank Liaison",
                "requester_phone": "022-2410-7000",
                "details": "CRITICAL: 2 units O-Negative plasma required for emergency polytrauma surgery. Road waterlogged near Parel junction.",
                "photo_url": None,
                "voice_note_url": None,
                "service_details": {
                    "blood_group": "O-",
                    "units": 2,
                    "hospital_name": "KEM Hospital, Parel",
                    "patient_name": "Aarav Sharma",
                    "patient_condition": "Emergency Surgery - Immediate Need"
                },
                "admin_status": "approved",
                "zone_confirmed": True,
                "ml_status": "high_priority",
                "linked_request_id": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": str(uuid.uuid4()),
                "category": "blood",
                "urgency": "normal",
                "status": "requested",
                "lat": 18.9712,
                "lng": 72.8197,
                "requester_device_id": "demo-device-mum-01b",
                "requester_name": "Nair Hospital Blood Desk",
                "requester_phone": "022-2302-7100",
                "details": "3 units B-Positive whole blood requested for thalassemia ward transfusions.",
                "photo_url": None,
                "voice_note_url": None,
                "service_details": {
                    "blood_group": "B+",
                    "units": 3,
                    "hospital_name": "BYL Nair Hospital, Mumbai Central",
                    "patient_name": "Pooja Varma",
                    "patient_condition": "Thalassemia Transfusion Schedule"
                },
                "admin_status": "approved",
                "zone_confirmed": False,
                "ml_status": None,
                "linked_request_id": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": str(uuid.uuid4()),
                "category": "oxygen",
                "urgency": "high",
                "status": "requested",
                "lat": 19.0390,
                "lng": 72.8619,
                "requester_device_id": "demo-device-mum-02",
                "requester_name": "Ramesh Kulkarni",
                "requester_phone": "98205 11043",
                "details": "Sion West: Elderly COPD patient on continuous oxygen, power transformer submerged. Need 10L medical oxygen cylinder urgently.",
                "photo_url": None,
                "voice_note_url": None,
                "service_details": {
                    "oxygen_type": "10L Jumbo Cylinder",
                    "flow_rate": "5 LPM",
                    "patient_name": "Kulkarni Sr. (Age 74)",
                    "urgency_level": "Immediate (Backup exhausted)"
                },
                "admin_status": "approved",
                "zone_confirmed": True,
                "ml_status": "high_priority",
                "linked_request_id": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": str(uuid.uuid4()),
                "category": "medicine",
                "urgency": "normal",
                "status": "requested",
                "lat": 19.0596,
                "lng": 72.8295,
                "requester_device_id": "demo-device-mum-05",
                "requester_name": "Anil Fernandes",
                "requester_phone": "98210 77165",
                "details": "Bandra West, Hill Road: Type 1 insulin pens (Lantus / Humalog) & sterile saline kit needed for diabetic resident cut off by water.",
                "photo_url": None,
                "voice_note_url": None,
                "service_details": {
                    "medicine_names": "Lantus Insulin Glargine Pen, Sterile Saline 500ml",
                    "dosage": "1 Pen (100 IU/ml) + Needles",
                    "urgency_level": "Within 4 hours"
                },
                "admin_status": "approved",
                "zone_confirmed": False,
                "ml_status": None,
                "linked_request_id": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": str(uuid.uuid4()),
                "category": "food",
                "urgency": "normal",
                "status": "requested",
                "lat": 19.0434,
                "lng": 72.8567,
                "requester_device_id": "demo-device-mum-04",
                "requester_name": "Dharavi Community Relief Hub",
                "requester_phone": "98190 22112",
                "details": "Clean drinking water cans (20L x 10) and 50 ready-to-eat khichdi packets for displaced families.",
                "photo_url": None,
                "voice_note_url": None,
                "service_details": {
                    "persons_count": 45,
                    "food_type": "Ready Rations & Mineral Water",
                    "water_liters": 200
                },
                "admin_status": "approved",
                "zone_confirmed": False,
                "ml_status": None,
                "linked_request_id": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": str(uuid.uuid4()),
                "category": "shelter",
                "urgency": "normal",
                "status": "requested",
                "lat": 19.0688,
                "lng": 72.8785,
                "requester_device_id": "demo-device-mum-06",
                "requester_name": "Sunita Patil",
                "requester_phone": "98670 44188",
                "details": "Kurla West, Bail Bazar: Ground floor tenement waterlogged. Family of 5 (including 2 children & grandmother) need temporary dry shelter.",
                "photo_url": None,
                "voice_note_url": None,
                "service_details": {
                    "persons_count": 5,
                    "duration": "1-2 Days",
                    "special_notes": "Senior citizen with mobility constraint"
                },
                "admin_status": "approved",
                "zone_confirmed": True,
                "ml_status": None,
                "linked_request_id": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        ]

        for req in demo_reqs:
            self.requests[req["id"]] = req


mem_db = MemoryDB()
mem_db.seed_default_data()


# Helper: calculate distance in meters using Haversine
def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000  # meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


# Category-specific Time-To-Live (TTL) configuration in seconds
CATEGORY_TTLS_SECONDS = {
    "rescue": 45 * 60,     # 45 minutes - high urgency life-safety
    "oxygen": 45 * 60,     # 45 minutes - critical respiratory aid
    "blood": 120 * 60,     # 2 hours - urgent medical requirement
    "medicine": 180 * 60,  # 3 hours - pharmacy & essential prescriptions
    "food": 240 * 60,      # 4 hours - humanitarian rations & drinking water
    "shelter": 240 * 60,   # 4 hours - evacuation accommodation
    "transport": 180 * 60, # 3 hours - evacuation & medical transit
}
DEFAULT_TTL_SECONDS = 180 * 60


def compute_priority_score(req: Dict[str, Any], linked_count: int = 0) -> int:
    """
    Computes an Emergency Priority & Genuineness Score (0 - 100).
    Combines:
    1. Base Category Urgency (0-40 pts)
    2. Disaster Zone Corroboration (0-25 pts)
    3. Crowd Co-location / Duplicate Clustering (0-20 pts)
    4. Heartbeat / Freshness Recency (0-15 pts)
    """
    category = req.get("category", "").lower()
    urgency = req.get("urgency", "normal")

    # 1. Base Severity (0 - 40 pts)
    base_scores = {
        "rescue": 40,
        "oxygen": 35,
        "blood": 30,
        "medicine": 25,
        "food": 20,
        "shelter": 18,
        "transport": 16,
    }
    score = base_scores.get(category, 15)
    if urgency == "high" and score < 35:
        score = 35

    # 2. Zone Corroboration (0 - 25 pts)
    # If the incident is crowd-confirmed or within an official disaster zone
    if req.get("zone_confirmed") or req.get("ml_status") in ["high_priority", "flood_zone", "active_cluster"]:
        score += 25

    # 3. Crowd Corroboration / Linked Request Cluster (0 - 20 pts)
    # Each nearby resident reporting the same emergency adds +8 pts (up to 20 pts)
    score += min(20, linked_count * 8)

    # 4. Freshness & Heartbeat Recency (0 - 15 pts)
    ref_time_str = req.get("last_heartbeat_at") or req.get("created_at")
    if ref_time_str:
        try:
            ref_time = datetime.fromisoformat(ref_time_str.replace("Z", "+00:00"))
            age_seconds = (datetime.now(timezone.utc) - ref_time).total_seconds()
            if age_seconds < 15 * 60:      # Fresh < 15 mins
                score += 15
            elif age_seconds < 45 * 60:    # Active < 45 mins
                score += 8
            elif age_seconds < 90 * 60:    # Moderate < 90 mins
                score += 4
        except Exception:
            score += 5

    return min(100, max(10, score))


def check_is_stale(req: Dict[str, Any]) -> bool:
    """Returns True if the request is awaiting response and has exceeded 50% of its TTL without heartbeat."""
    if req.get("status") in ["matched", "en_route", "on_the_way", "arrived", "resolved", "expired"]:
        return False
    ref_time_str = req.get("last_heartbeat_at") or req.get("created_at")
    if not ref_time_str:
        return False
    try:
        ref_time = datetime.fromisoformat(ref_time_str.replace("Z", "+00:00"))
        age = (datetime.now(timezone.utc) - ref_time).total_seconds()
        cat = req.get("category", "").lower()
        ttl = CATEGORY_TTLS_SECONDS.get(cat, DEFAULT_TTL_SECONDS)
        return age >= (ttl * 0.5)
    except Exception:
        return False


async def db_expire_stale_requests() -> List[str]:
    """Sweeps unassigned requests that have passed their expiration timestamp without a heartbeat."""
    expired_ids = []
    now = datetime.now(timezone.utc)
    for req_id, req in list(mem_db.requests.items()):
        if req.get("status") == "requested":
            expires_at_str = req.get("expires_at")
            if expires_at_str:
                try:
                    exp_dt = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
                    if now > exp_dt:
                        req["status"] = "expired"
                        req["updated_at"] = now.isoformat()
                        expired_ids.append(req_id)
                except Exception:
                    pass
    return expired_ids


async def db_heartbeat_request(request_id: str) -> Optional[Dict[str, Any]]:
    """
    Extends the TTL and confirms that the requester is still actively awaiting assistance.
    Resets staleness and extends expires_at.
    """
    req = await db_get_request(request_id)
    if not req:
        return None
    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat()
    cat = req.get("category", "").lower()
    ttl = CATEGORY_TTLS_SECONDS.get(cat, DEFAULT_TTL_SECONDS)
    new_expires_at = (now_dt + timedelta(seconds=ttl)).isoformat()

    updates = {
        "last_heartbeat_at": now_iso,
        "expires_at": new_expires_at,
        "updated_at": now_iso,
        "status": "requested" if req.get("status") == "expired" else req.get("status", "requested"),
    }
    updated = await db_update_request(request_id, updates)
    if updated:
        linked_count = await db_get_linked_count(request_id)
        updated["linked_count"] = linked_count
        updated["priority_score"] = compute_priority_score(updated, linked_count)
        updated["is_stale"] = False
    return updated


# Database Operations (Abstraction Layer)

async def db_create_request(data: Dict[str, Any]) -> Dict[str, Any]:
    req_id = data.get("id") or str(uuid.uuid4())
    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat()
    
    category = data.get("category", "").lower()
    urgency = data.get("urgency", "normal")
    if category in ("oxygen", "rescue") and urgency != "high":
        urgency = "high"

    device_id = data.get("requester_device_id", "anon-device")

    # 1. Device Debounce Prevention:
    # If the same device already submitted the same category in 'requested' status within 2 minutes,
    # return the existing active request rather than creating a duplicate!
    for existing in mem_db.requests.values():
        if (
            existing.get("requester_device_id") == device_id
            and existing.get("category") == category
            and existing.get("status") == "requested"
        ):
            try:
                created_dt = datetime.fromisoformat(existing.get("created_at", "").replace("Z", "+00:00"))
                if (now_dt - created_dt).total_seconds() < 120:
                    existing["is_debounced"] = True
                    return existing
            except Exception:
                pass

    # 2. Duplicate Check & Spatial-Temporal Clustering:
    # If an active request exists within 300 meters and same category, link to anchor request
    linked_id = data.get("linked_request_id")
    if not linked_id:
        try:
            req_lat = float(data.get("lat", 0))
            req_lng = float(data.get("lng", 0))
            for existing in mem_db.requests.values():
                if existing.get("category") == category and existing.get("status") == "requested":
                    dist = haversine_distance(req_lat, req_lng, existing.get("lat", 0), existing.get("lng", 0))
                    if dist <= 300:
                        linked_id = existing.get("linked_request_id") or existing.get("id")
                        # Aggregate notes & details into anchor request
                        anchor_req = mem_db.requests.get(linked_id)
                        if anchor_req:
                            new_detail = data.get("details")
                            if new_detail and new_detail not in (anchor_req.get("details") or ""):
                                anchor_req["details"] = (anchor_req.get("details") or "") + f" | [Corroborated Note]: {new_detail}"
                            # Aggregate quantities if available
                            if data.get("service_details") and anchor_req.get("service_details"):
                                if "persons_count" in data["service_details"] and "persons_count" in anchor_req["service_details"]:
                                    try:
                                        anchor_req["service_details"]["persons_count"] += int(data["service_details"]["persons_count"])
                                    except Exception:
                                        pass
                        break
        except Exception:
            pass

    # Compute category-aware expiration TTL
    ttl_seconds = CATEGORY_TTLS_SECONDS.get(category, DEFAULT_TTL_SECONDS)
    expires_at = (now_dt + timedelta(seconds=ttl_seconds)).isoformat()

    # Non-critical requests are auto-approved for instant matching
    admin_status = data.get("admin_status")
    if not admin_status:
        admin_status = "approved"

    full_item = {
        "id": req_id,
        "category": category,
        "urgency": urgency,
        "status": data.get("status", "requested"),
        "lat": float(data.get("lat", 19.0760)),
        "lng": float(data.get("lng", 72.8777)),
        "requester_device_id": device_id,
        "requester_name": data.get("requester_name"),
        "requester_phone": data.get("requester_phone"),
        "details": data.get("details"),
        "photo_url": data.get("photo_url"),
        "voice_note_url": data.get("voice_note_url"),
        "service_details": data.get("service_details"),
        "admin_status": admin_status,
        "zone_confirmed": data.get("zone_confirmed", False),
        "ml_status": data.get("ml_status"),
        "linked_request_id": linked_id,
        "last_heartbeat_at": now_iso,
        "expires_at": expires_at,
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    if supabase_client:
        try:
            res = supabase_client.table("requests").insert(full_item).execute()
            if res.data and len(res.data) > 0:
                inserted = res.data[0]
                mem_db.requests[inserted["id"]] = inserted
                return inserted
        except Exception as e:
            print(f"[Supabase Insert Warning]: {e}. Writing to local memory store.")

    mem_db.requests[req_id] = full_item
    return full_item


async def db_list_requests(
    admin_status: Optional[str] = None,
    exclude_expired: bool = False,
    sort_by: Optional[str] = "priority"
) -> List[Dict[str, Any]]:
    """
    Lists requests enriched with:
    - linked_count (duplicates in cluster)
    - priority_score (0-100 emergency priority & genuineness)
    - is_stale (awaiting heartbeat)
    Filters out expired requests if exclude_expired is True.
    Sorts by 'priority' (highest first) or 'newest' (created_at desc).
    """
    # 1. Sweep expired requests first
    await db_expire_stale_requests()

    items = []
    if supabase_client:
        try:
            q = supabase_client.table("requests").select("*")
            if admin_status:
                q = q.eq("admin_status", admin_status)
            res = q.order("created_at", desc=True).execute()
            if res.data is not None and len(res.data) > 0:
                for item in res.data:
                    mem_db.requests[item["id"]] = item
                items = res.data
        except Exception as e:
            print(f"[Supabase Query Warning]: {e}. Reading from local memory store.")

    if not items:
        items = list(mem_db.requests.values())
        if admin_status:
            items = [r for r in items if r.get("admin_status") == admin_status]

    # Filter out expired if requested (default for volunteers)
    if exclude_expired:
        items = [r for r in items if r.get("status") not in ["expired", "resolved"]]

    # Enrich with priority score, linked duplicate count, and staleness
    enriched = []
    for req in items:
        req_copy = dict(req)
        linked_cnt = await db_get_linked_count(req_copy["id"])
        req_copy["linked_count"] = linked_cnt
        req_copy["priority_score"] = compute_priority_score(req_copy, linked_cnt)
        req_copy["is_stale"] = check_is_stale(req_copy)
        enriched.append(req_copy)

    # Sort
    if sort_by == "priority":
        # Sort by: Priority Score desc, then created_at desc
        return sorted(
            enriched,
            key=lambda r: (r.get("priority_score", 0), r.get("created_at", "")),
            reverse=True
        )
    else:
        # Sort: Newest requests FIRST (created_at desc)
        return sorted(
            enriched,
            key=lambda r: r.get("created_at", ""),
            reverse=True
        )


async def db_get_request(request_id: str) -> Optional[Dict[str, Any]]:
    if supabase_client:
        try:
            res = supabase_client.table("requests").select("*").eq("id", request_id).execute()
            if res.data and len(res.data) > 0:
                mem_db.requests[request_id] = res.data[0]
                return res.data[0]
        except Exception:
            pass
    return mem_db.requests.get(request_id)


async def db_update_request(request_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    if supabase_client:
        try:
            res = supabase_client.table("requests").update(updates).eq("id", request_id).execute()
            if res.data and len(res.data) > 0:
                updated = res.data[0]
                mem_db.requests[request_id] = updated
                return updated
        except Exception as e:
            print(f"[Supabase Update Warning]: {e}. Updating in local memory store.")

    if request_id in mem_db.requests:
        mem_db.requests[request_id].update(updates)
        return mem_db.requests[request_id]
    return None


async def db_create_message(data: Dict[str, Any]) -> Dict[str, Any]:
    msg_id = data.get("id") or str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    full_msg = {
        "id": msg_id,
        "match_id": data.get("match_id"),
        "sender_id": data.get("sender_id"),
        "body": data.get("body"),
        "sent_at": now_iso,
    }

    if supabase_client:
        try:
            res = supabase_client.table("messages").insert(full_msg).execute()
            if res.data and len(res.data) > 0:
                inserted = res.data[0]
                mem_db.messages.append(inserted)
                return inserted
        except Exception as e:
            print(f"[Supabase Message Insert Warning]: {e}")

    mem_db.messages.append(full_msg)
    return full_msg


async def db_list_messages(match_id: str) -> List[Dict[str, Any]]:
    if supabase_client:
        try:
            res = supabase_client.table("messages").select("*").eq("match_id", match_id).order("sent_at", desc=False).execute()
            if res.data is not None:
                return res.data
        except Exception as e:
            print(f"[Supabase Message Query Warning]: {e}")

    return [m for m in mem_db.messages if m.get("match_id") == match_id]


async def db_create_zone_report(data: Dict[str, Any]) -> Dict[str, Any]:
    report_id = data.get("id") or str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    report = {
        "id": report_id,
        "category": data.get("category"),
        "lat": float(data.get("lat", 19.0760)),
        "lng": float(data.get("lng", 72.8777)),
        "device_id": data.get("device_id", "anon-reporter"),
        "reported_at": now_iso,
    }

    if supabase_client:
        try:
            res = supabase_client.table("zone_reports").insert(report).execute()
            if res.data and len(res.data) > 0:
                report = res.data[0]
        except Exception as e:
            print(f"[Supabase Zone Report Warning]: {e}")

    mem_db.zone_reports.append(report)

    # Threshold check: if 3 or more reports of the same category are within 500m, confirm zone!
    cluster = [
        r for r in mem_db.zone_reports
        if r.get("category") == report["category"] and
        haversine_distance(report["lat"], report["lng"], r.get("lat", 0), r.get("lng", 0)) < 500
    ]
    new_confirmed_zone = None
    if len(cluster) >= 3:
        avg_lat = sum(r["lat"] for r in cluster) / len(cluster)
        avg_lng = sum(r["lng"] for r in cluster) / len(cluster)
        zone_data = {
            "id": str(uuid.uuid4()),
            "category": report["category"],
            "center_lat": avg_lat,
            "center_lng": avg_lng,
            "ml_status": f"cluster_{len(cluster)}_reports",
            "confirmed_at": now_iso,
        }
        if supabase_client:
            try:
                supabase_client.table("confirmed_zones").insert(zone_data).execute()
            except Exception:
                pass
        mem_db.confirmed_zones.append(zone_data)
        new_confirmed_zone = zone_data

    return {"report": report, "confirmed_zone": new_confirmed_zone}


async def db_list_confirmed_zones() -> List[Dict[str, Any]]:
    if supabase_client:
        try:
            res = supabase_client.table("confirmed_zones").select("*").execute()
            if res.data is not None and len(res.data) > 0:
                return res.data
        except Exception:
            pass
    return mem_db.confirmed_zones


async def db_get_linked_count(request_id: str) -> int:
    req = mem_db.requests.get(request_id)
    if not req:
        return 0
    # Determine the anchor ID for this incident cluster
    anchor_id = req.get("linked_request_id") or request_id
    
    count = 0
    for r_id, r in mem_db.requests.items():
        if r_id == request_id:
            continue
        # If r is the anchor, or r links to this anchor, or r links to this request
        if r_id == anchor_id or r.get("linked_request_id") == anchor_id or r.get("linked_request_id") == request_id:
            count += 1
    return count


# Helper / Volunteer & NGO Database Layer
async def db_list_helpers(role: Optional[str] = None) -> List[Dict[str, Any]]:
    items = list(mem_db.helpers.values())
    if role:
        items = [h for h in items if h.get("role") == role]
    return items


async def db_get_helper(helper_id: str) -> Optional[Dict[str, Any]]:
    return mem_db.helpers.get(helper_id)


async def db_create_helper(data: Dict[str, Any]) -> Dict[str, Any]:
    helper_id = data.get("id") or f"{'VOL' if data.get('role') == 'volunteer' else 'NGO'}-{uuid.uuid4().hex[:6].upper()}"
    full_helper = {
        "id": helper_id,
        "name": data.get("name"),
        "phone": data.get("phone"),
        "email": data.get("email"),
        "role": data.get("role", "volunteer"),
        "org_name": data.get("org_name"),
        "darpanId": data.get("darpanId"),
        "bloodGroup": data.get("bloodGroup"),
        "skills": data.get("skills", []),
        "domains": data.get("domains", []),
        "verified": True,
        "available": True,
        "badge": data.get("badge") or ("Verified First Responder" if data.get("role") == "volunteer" else "Authorized Humanitarian Agency"),
        "lat": float(data.get("lat", 19.0178)),
        "lng": float(data.get("lng", 72.8478)),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    mem_db.helpers[helper_id] = full_helper
    return full_helper


async def db_find_helper(query_str: str) -> Optional[Dict[str, Any]]:
    clean = query_str.strip().lower()
    for h in mem_db.helpers.values():
        if (
            (h.get("phone") and clean in h.get("phone").lower()) or
            (h.get("email") and clean in h.get("email").lower()) or
            (h.get("id") and clean == h.get("id").lower()) or
            (h.get("darpanId") and clean in h.get("darpanId").lower())
        ):
            return h
    return None

