"""Blood donor compatibility matching (docs/AGENT-FLOW.md section 6)."""
from __future__ import annotations

from . import config

VALID_BLOOD_TYPES = set(config.BLOOD_DONATION_MAP.keys())


def compatible_donor_types(needed_group: str) -> set[str]:
    """Which donor blood types can give to someone who needs `needed_group`."""
    needed = needed_group.strip().upper()
    return {
        donor for donor, can_give_to in config.BLOOD_DONATION_MAP.items()
        if needed in can_give_to
    }
