#!/usr/bin/env bash
# Smoke test against a running instance: ./tests/smoke_test_quiz.sh [http://host:port]
set -euo pipefail
API=${1:-${API:-http://localhost:3300}}
BODY=$(mktemp)
trap 'rm -f "$BODY"' EXIT

expect_status() {
  local expected=$1; shift
  local status
  status=$(curl -sS -o "$BODY" -w '%{http_code}' "$@")
  if [ "$status" != "$expected" ]; then
    echo "FAIL: expected $expected, got $status for: $*"; cat "$BODY"; echo; exit 1
  fi
}

echo "Health..."
expect_status 200 "$API/api/health"

echo "Requesting guest token..."
expect_status 200 "$API/api/access_token"
TOKEN=$(jq -r .accessToken "$BODY")

echo "Random question as guest..."
expect_status 200 -H "X-Temporary-Token: $TOKEN" "$API/api/quiz/random"
jq . "$BODY"
if jq -e 'has("answer")' "$BODY" >/dev/null; then echo "FAIL: guest got an answer"; exit 1; fi

echo "Answer as guest must be 401..."
expect_status 401 -X POST -H "Content-Type: application/json" -H "X-Temporary-Token: $TOKEN" -d '{"id":1}' "$API/api/quiz/answer"

echo "Guest token + fake Bearer must be 400..."
expect_status 400 -H "X-Temporary-Token: $TOKEN" -H "Authorization: Bearer fake" "$API/api/quiz/random"

echo "OK"
