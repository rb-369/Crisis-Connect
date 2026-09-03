"""Mock OTP session tokens.

Stateless and HMAC-signed rather than random-and-stored: the shared schema has
no sessions table, and adding one would mean coordinating a migration with
Dev A mid-build. A signed token needs no storage, survives a server restart,
and is still verifiable.

Format:  <base64url(helper_id.expiry_epoch)>.<base64url(hmac_sha256)>
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import time

SECRET = os.environ.get("SESSION_SECRET", "crisisconnect-dev-secret").encode()
TTL_SECONDS = int(os.environ.get("SESSION_TTL_SECONDS", 60 * 60 * 24 * 7))


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def issue(helper_id: str, ttl: int = TTL_SECONDS) -> str:
    body = f"{helper_id}.{int(time.time()) + ttl}".encode()
    sig = hmac.new(SECRET, body, hashlib.sha256).digest()
    return f"{_b64(body)}.{_b64(sig)}"


def verify(token: str) -> str | None:
    """Return the helper_id, or None if the token is invalid or expired."""
    try:
        body_b64, sig_b64 = token.split(".", 1)
        body, sig = _unb64(body_b64), _unb64(sig_b64)
    except Exception:
        return None
    expected = hmac.new(SECRET, body, hashlib.sha256).digest()
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        helper_id, expiry = body.decode().rsplit(".", 1)
    except ValueError:
        return None
    if int(expiry) < time.time():
        return None
    return helper_id
