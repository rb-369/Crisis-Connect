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
        """Populate realistic demo crisis data"""
        if self.requests:
            return  # already seeded

        # Helper demo
        helper_id = "h-1001-vol"
        self.helpers[helper_id] = {
            "id": helper_id,
            "name": "Dr. Sarah Lin (Red Cross)",
            "phone": "+1-555-0192",
            "role": "volunteer",
            "org_name": "Red Cross Emergency Unit",
            "verified": True,
            "available": True,
            "lat": 37.7749,
            "lng": -122.4194,
        }

        # Confirmed Hazard Zone
        zone_id = str(uuid.uuid4())
        self.confirmed_zones.append({
            "id": zone_id,
            "category": "rescue",
            "center_lat": 37.7780,
            "center_lng": -122.4150,
            "ml_status": "confirmed_cluster_8_reports",
            "confirmed_at": datetime.now(timezone.utc).isoformat(),
        })

        # Demo requests with varied categories and urgencies
        demo_reqs = [
            {
                "id": str(uuid.uuid4()),
                "category": "oxygen",
                "urgency": "high",
                "status": "requested",
                "lat": 37.7812,
                "lng": -122.4180,
                "requester_device_id": "demo-device-001",
                "requester_name": "Marcus Vance",
                "requester_phone": "415-555-0143",
                "details": "Elderly patient on 5L concentrator, power generator failed 20m ago. Urgent cylinder needed.",
                "photo_url": None,
                "admin_status": "pending",
                "zone_confirmed": True,
                "ml_status": "high_priority",
                "linked_request_id": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": str(uuid.uuid4()),
                "category": "rescue",
                "urgency": "high",
                "status": "requested",
                "lat": 37.7790,
                "lng": -122.4162,
                "requester_device_id": "demo-device-002",
                "requester_name": "Elena Rostova",
                "requester_phone": "415-555-0188",
                "details": "Ground floor submerged, 3 adults and 1 infant trapped on roof deck.",
                "photo_url": None,
                "admin_status": "approved",
                "zone_confirmed": True,
                "ml_status": "critical_trapped",
                "linked_request_id": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": str(uuid.uuid4()),
                "category": "medicine",
                "urgency": "normal",
                "status": "requested",
                "lat": 37.7720,
                "lng": -122.4220,
                "requester_device_id": "demo-device-003",
                "requester_name": "David Cho",
                "requester_phone": "415-555-0165",
                "details": "Type 1 diabetic needing rapid-acting insulin pens (Humalog/Novolog).",
                "photo_url": None,
                "admin_status": "pending",
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
                "lat": 37.7735,
                "lng": -122.4110,
                "requester_device_id": "demo-device-004",
                "requester_name": "Community Shelter Unit 4",
                "requester_phone": "415-555-0112",
                "details": "Drinking water bottles and ready-to-eat rations for 25 displaced residents.",
                "photo_url": None,
                "admin_status": "approved",
                "zone_confirmed": False,
                "ml_status": None,
                "linked_request_id": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        ]

        # Add duplicate example: second food request nearby linked to the first
        first_food_id = demo_reqs[3]["id"]
        dup_req = {
            "id": str(uuid.uuid4()),
            "category": "food",
            "urgency": "normal",
            "status": "requested",
            "lat": 37.7738,
            "lng": -122.4115,
            "requester_device_id": "demo-device-005",
            "requester_name": "Neighbor Apt 2B",
            "requester_phone": "415-555-0177",
            "details": "Clean drinking water needed for 4 people.",
            "photo_url": None,
            "admin_status": "pending",
            "zone_confirmed": False,
            "ml_status": "duplicate_candidate",
            "linked_request_id": first_food_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        demo_reqs.append(dup_req)

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
    # Auto-generate ID & timestamps if missing
    req_id = data.get("id") or str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # Auto urgency high for oxygen / rescue
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

    full_item = {
        "id": req_id,
        "category": category,
        "urgency": urgency,
        "status": data.get("status", "requested"),
        "lat": float(data.get("lat", 0)),
        "lng": float(data.get("lng", 0)),
        "requester_device_id": data.get("requester_device_id", "anon-device"),
        "requester_name": data.get("requester_name"),
        "requester_phone": data.get("requester_phone"),
        "details": data.get("details"),
        "photo_url": data.get("photo_url"),
        "admin_status": data.get("admin_status", "pending"),
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
    if supabase_client:
        try:
            q = supabase_client.table("requests").select("*")
            if admin_status:
                q = q.eq("admin_status", admin_status)
            res = q.order("created_at", desc=True).execute()
            if res.data is not None:
                # Synchronize memory store
                for item in res.data:
                    mem_db.requests[item["id"]] = item
                # Sort: urgency 'high' first, then created_at desc
                return sorted(
                    res.data,
                    key=lambda r: (0 if r.get("urgency") == "high" else 1, r.get("created_at", "")),
                )
        except Exception as e:
            print(f"[Supabase Query Warning]: {e}. Reading from local memory store.")

    items = list(mem_db.requests.values())
    if admin_status:
        items = [r for r in items if r.get("admin_status") == admin_status]

    # Calculate linked counts for display
    return sorted(
        items,
        key=lambda r: (0 if r.get("urgency") == "high" else 1, r.get("created_at", "")),
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
        "lat": float(data.get("lat", 0)),
        "lng": float(data.get("lng", 0)),
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
            if res.data is not None:
                return res.data
        except Exception:
            pass
    return mem_db.confirmed_zones


async def db_get_linked_count(request_id: str) -> int:
    """Returns how many other requests are linked to this request or share this linked_request_id"""
    count = 0
    for r in mem_db.requests.values():
        if r.get("linked_request_id") == request_id or (
            r.get("linked_request_id") and r.get("id") != request_id and
            r.get("linked_request_id") == mem_db.requests.get(request_id, {}).get("linked_request_id")
        ):
            count += 1
    return count
