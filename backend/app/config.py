"""Runtime configuration. Everything is env-driven so the only change needed to
point at Supabase instead of local Postgres is DATABASE_URL."""
import os
from pathlib import Path

# Minimal .env loader (no dependency on python-dotenv being importable at boot).
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
if _ENV_FILE.exists():
    for _line in _ENV_FILE.read_text().splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#") or "=" not in _line:
            continue
        _k, _v = _line.split("=", 1)
        os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


DATABASE_URL: str = os.environ.get(
    "DATABASE_URL", "postgresql://kk@localhost:5432/crisisconnect"
)

# --- Zone confirmation thresholds (PRD: 3+ reports / 500m / 30min) ---
ZONE_RADIUS_M: int = _int("ZONE_RADIUS_M", 500)
ZONE_WINDOW_MIN: int = _int("ZONE_WINDOW_MIN", 30)
ZONE_THRESHOLD: int = _int("ZONE_THRESHOLD", 3)
# A new confirmed_zone is suppressed if one of the same category already exists
# this close to the cluster centre -- prevents a 4th, 5th report re-confirming.
ZONE_DEDUPE_RADIUS_M: int = _int("ZONE_DEDUPE_RADIUS_M", 500)
# ...but only suppressed by a *recent* zone, so a genuinely new crisis in the
# same place days later can still be confirmed instead of silently swallowed.
ZONE_DEDUPE_WINDOW_MIN: int = _int("ZONE_DEDUPE_WINDOW_MIN", 1440)  # 24h

# Zone report categories are what a bystander sees happening, and are a
# DIFFERENT vocabulary from request categories. Not hard-validated -- Dev A
# owns the pin-drop UI and shouldn't be blocked by an enum mismatch.
SUGGESTED_ZONE_CATEGORIES = {
    "flood", "fire", "accident", "earthquake", "building_collapse",
    "riot", "medical", "other",
}

# --- Duplicate request detection (PRD: 100-200m / 1-2h, same category) ---
DUPLICATE_RADIUS_M: int = _int("DUPLICATE_RADIUS_M", 150)
DUPLICATE_WINDOW_MIN: int = _int("DUPLICATE_WINDOW_MIN", 90)

# --- Feed defaults ---
DEFAULT_NEARBY_RADIUS_M: int = _int("DEFAULT_NEARBY_RADIUS_M", 10000)

# --- Stale request handling (PRD Flow E) ---
# A request that is never matched: nudge the requester at STALE_NUDGE_MIN,
# auto-expire at STALE_EXPIRE_MIN if there has been no response (no keepalive,
# no resolve). Measured from `updated_at`, which the keepalive endpoint bumps.
STALE_NUDGE_MIN: int = _int("STALE_NUDGE_MIN", 20)
STALE_EXPIRE_MIN: int = _int("STALE_EXPIRE_MIN", 45)
EXPIRY_SWEEP_INTERVAL_S: int = _int("EXPIRY_SWEEP_INTERVAL_S", 60)

# --- Zone-based admin scrutiny (PRD Layer 2) ---
# "Inside a confirmed zone" already fast-tracks (zone_confirmed badge). The
# complementary case: far from EVERY confirmed zone gets flagged for extra
# admin scrutiny instead of the default 'pending' -- but only once zones
# exist at all; with none yet, there's nothing to correlate against.
FAR_ZONE_RADIUS_M: int = _int("FAR_ZONE_RADIUS_M", 2000)

# --- Mock OTP ---
DEMO_OTP: str = os.environ.get("DEMO_OTP", "123456")
ACCEPT_ANY_OTP: bool = os.environ.get("ACCEPT_ANY_OTP", "true").lower() == "true"

# Severity classification (docs/AGENT-FLOW.md section 1). Determines which
# flow a request goes through: critical -> POST /sos, minimum interaction,
# straight to broadcast, grouped into an incident. Non-critical -> POST
# /requests, structured fields, rule-based verification pipeline.
CRITICAL_CATEGORIES = {"flood", "earthquake", "fire", "accident", "rescue"}
NON_CRITICAL_CATEGORIES = {"blood", "oxygen", "medicine", "food", "shelter", "transport"}
VALID_CATEGORIES = CRITICAL_CATEGORIES | NON_CRITICAL_CATEGORIES

# High-urgency label (display/sort only -- distinct from severity class
# above). Oxygen is non-critical per the agent-flow spec's own taxonomy
# (the requester can communicate) but still deserves urgent handling.
HIGH_URGENCY_CATEGORIES = {"oxygen", "rescue"}

# Ordering weight for the feed: higher sorts first.
URGENCY_RANK = {"critical": 3, "high": 2, "normal": 1, "low": 0}

# --- Incident grouping (critical requests from the same disaster site) ---
INCIDENT_RADIUS_M: int = _int("INCIDENT_RADIUS_M", 500)
INCIDENT_WINDOW_MIN: int = _int("INCIDENT_WINDOW_MIN", 60)

# --- Non-critical verification pipeline (rule-based, not ML -- see
# docs/AGENT-FLOW.md section 4: "should NOT automatically assume genuine
# just because text sounds believable.") ---
REQUIRED_SERVICE_FIELDS: dict[str, list[str]] = {
    "blood": ["blood_group", "units", "hospital_name"],
    "oxygen": ["oxygen_type", "flow_rate"],
    "medicine": ["medicine_names"],
    "food": ["persons_count"],
    "shelter": ["persons_count"],
    "transport": ["destination"],
}

# --- Blood donor compatibility ---
# donor_type -> set of recipient blood groups that donor can give to.
BLOOD_DONATION_MAP: dict[str, set[str]] = {
    "O-": {"O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"},
    "O+": {"O+", "A+", "B+", "AB+"},
    "A-": {"A-", "A+", "AB-", "AB+"},
    "A+": {"A+", "AB+"},
    "B-": {"B-", "B+", "AB-", "AB+"},
    "B+": {"B+", "AB+"},
    "AB-": {"AB-", "AB+"},
    "AB+": {"AB+"},
}
