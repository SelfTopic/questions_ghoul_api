#!/usr/bin/env bash
set -euo pipefail
API=http://localhost:3000

echo "Requesting temporary access token..."
TOKEN_JSON=$(curl -sS ${API}/api/access_token)
ACCESS_TOKEN=$(echo "$TOKEN_JSON" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
if [ -z "$ACCESS_TOKEN" ]; then
  echo "Failed to obtain access token"
  echo "Response: $TOKEN_JSON"
  exit 1
fi

echo "Got token: $ACCESS_TOKEN"

for i in 1 2 3; do
  echo "Calling /api/quiz/random (#$i)"
  curl -sS -H "X-Temporary-Token: $ACCESS_TOKEN" ${API}/api/quiz/random | jq .
done

# try answer lookup by id
echo "Calling /api/quiz/answer (by id=1)"
curl -sS -X POST -H "Content-Type: application/json" -H "X-Temporary-Token: $ACCESS_TOKEN" -d '{"id":1}' ${API}/api/quiz/answer | jq . || true

echo "Note: /api/quiz/answer requires JWT; this last call is expected to 401 unless JWT provided."
