#!/usr/bin/env bash
# Local dev server. --reload-dir app so editing tests/ doesn't bounce live sockets.
cd "$(dirname "$0")"
exec .venv/bin/python -m uvicorn app.main:app \
  --host 0.0.0.0 --port "${PORT:-8000}" --reload --reload-dir app --log-level info
