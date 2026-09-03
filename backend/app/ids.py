import uuid
from fastapi import HTTPException


def parse_uuid(value: str, field: str = "id") -> uuid.UUID:
    """Reject malformed UUIDs with a 400 instead of leaking a 500 from asyncpg."""
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=400, detail=f"{field} is not a valid uuid")
