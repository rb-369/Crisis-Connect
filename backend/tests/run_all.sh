#!/usr/bin/env bash
# Runs every step's acceptance suite. Backend must already be running.
set -uo pipefail
cd "$(dirname "$0")/.."
PY=python3
if [ -f .venv/bin/python ]; then
  PY=.venv/bin/python
elif [ -n "${VIRTUAL_ENV:-}" ] && [ -f "$VIRTUAL_ENV/bin/python" ]; then
  PY="$VIRTUAL_ENV/bin/python"
elif [ -f /Users/kk/Downloads/crisisconnect/backend/.venv/bin/python ]; then
  PY=/Users/kk/Downloads/crisisconnect/backend/.venv/bin/python
fi
fail=0
for t in test_ws_manager test_atomic_accept test_zone_threshold \
         test_duplicate_detection test_volunteer_api test_stale_requests test_agent_flow; do
  echo "──────────────────────────────────────────── $t"
  $PY "tests/$t.py" || fail=1
done
echo
[ $fail -eq 0 ] && echo "ALL SUITES PASSED" || echo "SOME SUITES FAILED"
exit $fail
