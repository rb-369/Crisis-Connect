"""Push notification sender -- readiness stub.

See docs/NOTIFICATIONS-HAPTICS-SHORTCUTS.md for the full picture. Short
version: this function is the ONE place that will need to change once a
Firebase project exists. Every call site should look like a real send
already; only this body needs to change from "log it" to "call FCM."

Nothing in the app calls this yet -- which events should trigger a push is
an undecided product decision, not a technical gap.
"""
from __future__ import annotations

import logging
from typing import Any

from . import db

log = logging.getLogger("crisisconnect.push")


async def send_push(
    helper_id: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> int:
    """Send a push to every device registered for `helper_id`.

    Returns the number of devices it was (would be) sent to. Today: looks up
    real registered tokens and logs what it would send -- exercises the
    lookup path so wiring in a real FCM call later is a one-function change,
    not a new feature.
    """
    rows = await db.fetch(
        "select platform, token from device_tokens where helper_id = $1", helper_id)

    if not rows:
        log.info("send_push(%s): no registered devices, nothing to send", helper_id)
        return 0

    for row in rows:
        # TODO(push): replace with a real FCM HTTP v1 API call once
        # backend/.env has GOOGLE_APPLICATION_CREDENTIALS pointed at a
        # Firebase service-account JSON. Token + platform are already here.
        log.info(
            "send_push (NOT WIRED -- would send): helper=%s platform=%s "
            "title=%r body=%r data=%s",
            helper_id, row["platform"], title, body, data or {},
        )

    return len(rows)
