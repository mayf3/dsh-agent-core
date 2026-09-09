#!/usr/bin/env bash
# WORKFLOW_DOMAIN_MEMBERS_CONTROL_PLANE_V1 — local full-chain E2E orchestrator.
#
# Stack: disposable postgres (docker) + JWKS/auth mock (python) + REAL
# svc-workflow binary (this goal's implementation) + REAL broker model face
# (this worktree's packages/broker). Business steps go through the broker
# tools only; psql is used for (a) the ONE-TIME seed of the identity/domain
# fixture and (b) read-only evidence reads (audit rows) afterwards.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SVC_BIN="${SVC_BIN:-/Users/yanfenma/workspace/project/svc-workflow-wfdm-v1/target/debug/svc-workflow}"
PG_CONTAINER="${PG_CONTAINER:-wfdm-test-pg}"
PG_PORT="${PG_PORT:-55433}"
E2E_DB="wfdm_e2e"
SVC_PORT=55991
JWKS_PORT=55990

OWNER_ID="b21ddb23-0000-4000-8000-00000000eff1"   # efficiency-butler analogue (DOMAIN_OWNER)
LOBSTER_ID="25a6789f-0000-4000-8000-00000000ce01" # 龙虾合伙人 analogue (target agent)
STRANGER_ID="99999999-0000-4000-8000-00000000bad9"
DOMAIN_ID="10000000-0000-4000-8000-000000000100"

cleanup() {
  [[ -n "${SVC_PID:-}" ]] && kill -9 "$SVC_PID" 2>/dev/null || true
  [[ -n "${JWKS_PID:-}" ]] && kill "$JWKS_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "=== [1/7] reset scratch database ${E2E_DB} ==="
docker exec "$PG_CONTAINER" psql -U postgres -c "DROP DATABASE IF EXISTS ${E2E_DB};" >/dev/null
docker exec "$PG_CONTAINER" psql -U postgres -c "CREATE DATABASE ${E2E_DB};" >/dev/null

echo "=== [2/7] start JWKS/auth mock on :${JWKS_PORT} ==="
python3 "$HERE/identity_stack.py" serve "$JWKS_PORT" >"$HERE/jwks-mock.log" 2>&1 &
JWKS_PID=$!
for _ in $(seq 1 40); do
  curl -sf "http://127.0.0.1:${JWKS_PORT}/.well-known/jwks.json" >/dev/null && break
  sleep 0.25
done
curl -sf "http://127.0.0.1:${JWKS_PORT}/.well-known/jwks.json" >/dev/null || { echo "jwks mock failed"; exit 1; }

echo "=== [3/7] mint persona tokens ==="
python3 "$HERE/identity_stack.py" mint "$OWNER_ID"   "workflow.read workflow.execute" "$HERE/owner.token"
python3 "$HERE/identity_stack.py" mint "$LOBSTER_ID" "workflow.read workflow.execute" "$HERE/lobster.token"
python3 "$HERE/identity_stack.py" mint "$STRANGER_ID" "workflow.read workflow.execute" "$HERE/stranger.token"

echo "=== [4/7] boot REAL svc-workflow (migrations auto-apply on boot) ==="
(
  cd "$HERE" # svc must find migrations/ — run.sh chdirs via SVC_MIGRATIONS below
)
cd /Users/yanfenma/workspace/project/svc-workflow-wfdm-v1
DATABASE_URL="postgres://postgres:postgres@127.0.0.1:${PG_PORT}/${E2E_DB}" \
WORKFLOW_JWKS_URL="http://127.0.0.1:${JWKS_PORT}/.well-known/jwks.json" \
WORKFLOW_JWT_ISSUER="auth-service" \
WORKFLOW_JWT_AUDIENCE="svc-workflow" \
WORKFLOW_PROVISIONING_PRINCIPAL_IDS="$OWNER_ID" \
AUTH_V1_CANARY_ENABLED=true \
AUTH_V1_CANARY_WRITE_ENABLED=true \
WORKFLOW_BIND_ADDR="127.0.0.1" \
WORKFLOW_PORT="$SVC_PORT" \
"$SVC_BIN" >"$HERE/svc.log" 2>&1 &
SVC_PID=$!
cd "$HERE"
for _ in $(seq 1 80); do
  curl -sf "http://127.0.0.1:${SVC_PORT}/version" >/dev/null 2>&1 && break
  sleep 0.25
done
curl -sf "http://127.0.0.1:${SVC_PORT}/version" || { echo "svc failed to boot"; tail -30 "$HERE/svc.log"; exit 1; }
echo

echo "=== [5/7] seed identity/domain fixture (ONE-TIME, pre-business) ==="
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$E2E_DB" -q -v ON_ERROR_STOP=1 <<SQL
INSERT INTO principals (principal_id, principal_type, display_name, email, enabled) VALUES
  ('${OWNER_ID}',   'AGENT', '效率管家(E2E)',   NULL, TRUE),
  ('${LOBSTER_ID}', 'AGENT', '龙虾合伙人(E2E)', NULL, TRUE),
  ('${STRANGER_ID}','AGENT', '陌生人(E2E)',     NULL, TRUE)
ON CONFLICT (principal_id) DO NOTHING;
INSERT INTO domains (domain_id, domain_key, display_name, enabled)
VALUES ('${DOMAIN_ID}', 'wfdm-e2e-dogfood', 'Workflow Todo Dogfood (E2E)', TRUE)
ON CONFLICT (domain_id) DO NOTHING;
INSERT INTO domain_role_bindings (binding_id, domain_id, principal_id, role_key, enabled)
VALUES ('b1000000-0000-4000-8000-000000000a00', '${DOMAIN_ID}', '${OWNER_ID}', 'DOMAIN_OWNER', TRUE)
ON CONFLICT (domain_id, principal_id, role_key) DO NOTHING;
SQL
echo "seeded: 3 principals + domain ${DOMAIN_ID} + owner binding"

echo "=== [6/7] run broker model-face driver ==="
WFDM_SVC_ORIGIN="http://127.0.0.1:${SVC_PORT}" \
WFDM_DOMAIN_ID="$DOMAIN_ID" WFDM_OWNER_ID="$OWNER_ID" \
WFDM_LOBSTER_ID="$LOBSTER_ID" WFDM_STRANGER_ID="$STRANGER_ID" \
WFDM_APP_DIR="/Users/yanfenma/workspace/project/dsh-wfdm-v1" \
node "$HERE/driver.mjs"
DRIVER_RC=$?

echo "=== [7/7] wire-level idempotency replay + audit evidence ==="
IDEM_KEY="wire-replay-$(date +%s)"
REPLAY_URL="http://127.0.0.1:${SVC_PORT}/internal/v1/domains/${DOMAIN_ID}/members/${LOBSTER_ID}"
FIRST=$(curl -s -o "$HERE/replay-1.json" -w "%{http_code}" -X PUT "$REPLAY_URL" \
  -H "Authorization: Bearer $(cat "$HERE/owner.token")" -H "Idempotency-Key: $IDEM_KEY" -H "Content-Type: application/json" -d '{}')
SECOND=$(curl -s -o "$HERE/replay-2.json" -w "%{http_code}" -X PUT "$REPLAY_URL" \
  -H "Authorization: Bearer $(cat "$HERE/owner.token")" -H "Idempotency-Key: $IDEM_KEY" -H "Content-Type: application/json" -d '{}')
echo "replay first=$FIRST second=$SECOND"
diff "$HERE/replay-1.json" "$HERE/replay-2.json" >/dev/null && REPLAY_IDENTICAL=YES || REPLAY_IDENTICAL=NO
echo "REPLAY_IDENTICAL=$REPLAY_IDENTICAL"
printf '{"first_status": %s, "second_status": %s, "replay_identical": "%s"}\n' "$FIRST" "$SECOND" "$REPLAY_IDENTICAL" > "$HERE/replay-summary.json"

AUDITS=$(docker exec "$PG_CONTAINER" psql -U postgres -d "$E2E_DB" -t -A -c \
  "SELECT jsonb_pretty(jsonb_agg(to_jsonb(a) ORDER BY a.created_at)) FROM (SELECT action, principal_id, resource_type, resource_id, details, created_at FROM workflow_security_audits WHERE resource_type='DOMAIN_MEMBERSHIP') a;")
echo "$AUDITS" > "$HERE/audit-evidence.json"
ADD_AUDITS=$(docker exec "$PG_CONTAINER" psql -U postgres -d "$E2E_DB" -t -A -c \
  "SELECT count(*) FROM workflow_security_audits WHERE action='member_added' AND resource_id='${DOMAIN_ID}/${LOBSTER_ID}';")
echo "member_added audit rows for the single real grant: $ADD_AUDITS"
printf '{"member_added_audit_rows": %s}\n' "$ADD_AUDITS" > "$HERE/audit-count.json"

echo
echo "driver_rc=$DRIVER_RC replay_identical=$REPLAY_IDENTICAL member_added_audit_rows=$ADD_AUDITS"
if [[ "$DRIVER_RC" == "0" && "$REPLAY_IDENTICAL" == "YES" && "$ADD_AUDITS" == "1" ]]; then
  echo "LOCAL E2E = PASS"
else
  echo "LOCAL E2E = FAIL"
  exit 1
fi
