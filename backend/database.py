import uuid
import math
from datetime import datetime, timezone
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

        # Helper demo (Mumbai Emergency Unit)
        helper_id = "h-1001-vol"
        self.helpers[helper_id] = {
            "id": helper_id,
            "name": "Dr. Rohit Deshmukh (Red Cross Mumbai)",
            "phone": "+91 98201 55019",
            "role": "volunteer",
            "org_name": "Indian Red Cross Emergency Response Mumbai",
            "verified": True,
            "available": True,
            "lat": 19.0178,
            "lng": 72.8478, # Dadar TT
        }

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


# Database Operations (Abstraction Layer)

async def db_create_request(data: Dict[str, Any]) -> Dict[str, Any]:
    req_id = data.get("id") or str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    
    category = data.get("category", "").lower()
    urgency = data.get("urgency", "normal")
    if category in ("oxygen", "rescue") and urgency != "high":
        urgency = "high"

    # Duplicate check: check if any recent active request exists within 300 meters with same category
    linked_id = data.get("linked_request_id")
    if not linked_id:
        try:
            req_lat = float(data.get("lat", 0))
            req_lng = float(data.get("lng", 0))
            for existing in mem_db.requests.values():
                if existing.get("category") == category and existing.get("status") == "requested":
                    dist = haversine_distance(req_lat, req_lng, existing.get("lat", 0), existing.get("lng", 0))
                    if dist <= 300:
                        linked_id = existing.get("id")
                        break
        except Exception:
            pass

    # Non-critical requests (blood, oxygen, medicine, food, shelter, transport) are auto-approved for instant matching
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
        "requester_device_id": data.get("requester_device_id", "anon-device"),
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


async def db_list_requests(admin_status: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Returns requests sorted with newest first (created_at descending)
    as requested by user.
    """
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

    # Sort: Newest requests FIRST (created_at desc)
    return sorted(
        items,
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
    count = 0
    for r in mem_db.requests.values():
        if r.get("linked_request_id") == request_id or (
            r.get("linked_request_id") and r.get("id") != request_id and
            r.get("linked_request_id") == mem_db.requests.get(request_id, {}).get("linked_request_id")
        ):
            count += 1
    return count
