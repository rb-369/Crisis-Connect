"""asyncpg Record -> JSON-safe dict."""
from __future__ import annotations

import datetime as _dt
import uuid as _uuid
from typing import Any


def _val(v: Any) -> Any:
    if isinstance(v, _uuid.UUID):
        return str(v)
    if isinstance(v, (_dt.datetime, _dt.date)):
        return v.isoformat()
    return v


def row(record) -> dict | None:
    if record is None:
        return None
    return {k: _val(v) for k, v in dict(record).items()}


def rows(records) -> list[dict]:
    return [row(r) for r in records]
