#!/usr/bin/env bash
# visit-activation-dispatch-v1 Phase 4 simulation — scratch-DB boot rehearsal.
# NO production mutation: binary runs from the release staging dir against a
# disposable DB on the test PG instance (127.0.0.1:55432), port 8991.
# Token: SIMULATION ONLY (locally generated JWKS + self-signed JWT).
set -uo pipefail

SIM_DIR="$(cd "$(dirname "$BASH_SOURCE[0]")" && pwd)"
ART_DIR="$(dirname "$SIM_DIR")"
SHA="22e862af8e47050ae1bf9e7c5db7eb22a4d81ee7"
BIN="/Users/yanfenma/.local/services/svc-workflow/releases/$SHA/svc-workflow"
PG_TEST="postgres://postgres:postgres@127.0.0.1:55432"
DB="svc_workflow_sim_vad1"
DBURL="$PG_TEST/$DB"
PORT=8991
JWPORT=8993
BASE="http://127.0.0.1:$PORT"
RESULTS="$SIM_DIR/SIM_RESULTS.json"
KID="vad-sim-$(date +%s)"

cleanup() {
  [[ -n "${BIN_PID:-}" ]] && kill "$BIN_PID" 2>/dev/null
  [[ -n "${JWKS_PID:-}" ]] && kill "$JWKS_PID" 2>/dev/null
  pkill -f "http.server $JWPORT" 2>/dev/null
  psql "$PG_TEST/postgres" -q -c "DROP DATABASE IF EXISTS $DB WITH (FORCE);" >/dev/null 2>&1
}
trap cleanup EXIT

# leftovers from aborted runs
pkill -f "http.server $JWPORT" 2>/dev/null
rm -f "$SIM_DIR/jwks.json" "$RESULTS.new"
sleep 0.5

R=()
rec() { R+=("$1"); echo "$1" >> "$RESULTS.new"; }

echo "== [A] scratch DB =="
psql "$PG_TEST/postgres" -q -c "DROP DATABASE IF EXISTS $DB WITH (FORCE);"
psql "$PG_TEST/postgres" -q -c "CREATE DATABASE $DB;" || exit 1
rec '{"step":"scratch_db_created","ok":true}'

echo "== [B] simulation JWKS (local, SIMULATION ONLY) =="
node "$SIM_DIR/mint-token.mjs" "bc970ced-710f-4479-9ff0-e295a1c59424" "workflow.admin workflow.execute workflow.read" "$KID" > /tmp/vad-token.txt || { echo "MINT FAILED"; exit 1; }
TOKEN=$(cat /tmp/vad-token.txt)
[[ -n "$TOKEN" ]] || { echo "TOKEN EMPTY"; exit 1; }
(cd "$SIM_DIR" && exec python3 -m http.server $JWPORT --bind 127.0.0.1 >/dev/null 2>&1) &
JWKS_PID=$!
for i in $(seq 1 10); do curl -sf -m 2 "http://127.0.0.1:$JWPORT/jwks.json" >/dev/null 2>&1 && break; sleep 1; done
curl -sf -m 2 "http://127.0.0.1:$JWPORT/jwks.json" | grep -q "$KID" || { echo "JWKS NOT SERVING CURRENT KID"; exit 1; }
SUB="bc970ced-710f-4479-9ff0-e295a1c59424"
rec '{"step":"simulation_token_local_jwks","ok":true,"kid":"'"$KID"'","note":"SIMULATION ONLY: locally generated JWKS; protocol path exercised, production auth endpoint NOT used (credential dir is authsvc-owned, unreadable from agent shell)"}'

echo "== [C] boot binary (from release staging, NOT deployed) =="
env \
  "DATABASE_URL=$DBURL" \
  "WORKFLOW_BIND_ADDR=127.0.0.1" \
  "WORKFLOW_PORT=$PORT" \
  "WORKFLOW_JWKS_URL=http://127.0.0.1:$JWPORT/jwks.json" \
  "WORKFLOW_JWT_ISSUER=auth-service" \
  "WORKFLOW_JWT_AUDIENCE=svc-workflow" \
  "AUTH_V1_CANARY_ENABLED=true" \
  "AUTH_V1_CANARY_WRITE_ENABLED=true" \
  "WORKFLOW_PROVISIONING_PRINCIPAL_IDS=$SUB" \
  sh -c "cd '$(dirname "$BIN")' && exec '$BIN'" > "$SIM_DIR/svc-sim.log" 2>&1 &
BIN_PID=$!

for i in $(seq 1 30); do
  curl -sf -m 2 "$BASE/healthz" >/dev/null 2>&1 && break
  sleep 1
done
curl -sf -m 2 "$BASE/healthz" >/dev/null || { echo "BOOT FAILED"; tail -20 "$SIM_DIR/svc-sim.log"; exit 1; }
rec '{"step":"boot_healthz","ok":true}'

MAXMIG=$(psql "$DBURL" -At -c "SELECT max(version) FROM _sqlx_migrations;")
[[ "$MAXMIG" == "23" ]] && rec "{\"step\":\"migrations_0023_applied\",\"ok\":true,\"maxVersion\":$MAXMIG}" || rec "{\"step\":\"migrations_0023_applied\",\"ok\":false,\"maxVersion\":\"$MAXMIG\"}"

VER=$(curl -sf -m 3 "$BASE/version")
echo "version: $VER"
if echo "$VER" | jq -e '.gitSha == "'"$SHA"'" and .gitTreeState == "clean"' >/dev/null 2>&1; then
  rec '{"step":"version_sha_clean","ok":true}'
else
  rec "{\"step\":\"version_sha_clean\",\"ok\":false,\"body\":\"$(echo "$VER" | head -c 200)\"}"
fi

echo "== [D] fail-closed gate (no GLOBAL_SCHEDULER_READ binding yet) =="
CODE=$(curl -s -o /tmp/vad_dq1.json -w '%{http_code}' -H "Authorization: Bearer $TOKEN" "$BASE/internal/v1/dispatch-intents?limit=1")
ERRCODE=$(jq -r '.error.code // empty' /tmp/vad_dq1.json 2>/dev/null)
[[ "$CODE" == "403" && "$ERRCODE" == "scheduler_read_role_required" ]] \
  && rec '{"step":"due_poll_failclosed_403","ok":true}' || rec "{\"step\":\"due_poll_failclosed_403\",\"ok\":false,\"http\":$CODE,\"code\":\"$ERRCODE\"}"

echo "== [E] provisioning PUT GLOBAL_SCHEDULER_READ (real admin API, not SQL) =="
# actor principal must exist (enabled AGENT) in the scratch DB — mirrors production
# where hr-agent already exists in the principals table
psql "$DBURL" -q -c "INSERT INTO principals (principal_id, principal_type, display_name, email, enabled) VALUES ('$SUB','AGENT','Sim Creator',NULL,TRUE);"
PCODE=$(curl -s -o /tmp/vad_prov.json -w '%{http_code}' -X PUT \
  -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: vad-sim-$KID" \
  -H 'Content-Type: application/json' \
  -d '{"roleKey":"GLOBAL_SCHEDULER_READ","enabled":true}' \
  "$BASE/internal/v1/admin/global-role-bindings/$SUB")
if [[ "$PCODE" == "200" || "$PCODE" == "201" ]]; then
  rec "{\"step\":\"provisioning_put_scheduler_read\",\"ok\":true,\"http\":$PCODE}"
else
  rec "{\"step\":\"provisioning_put_scheduler_read\",\"ok\":false,\"http\":$PCODE,\"body\":$(jq -c . /tmp/vad_prov.json 2>/dev/null || echo 'null')}"
fi

CODE=$(curl -s -o /tmp/vad_dq2.json -w '%{http_code}' -H "Authorization: Bearer $TOKEN" "$BASE/internal/v1/dispatch-intents?limit=1")
ITEMS=$(jq '.items | length' /tmp/vad_dq2.json 2>/dev/null)
[[ "$CODE" == "200" && "$ITEMS" == "0" ]] && rec '{"step":"due_poll_empty_200","ok":true}' || rec "{\"step\":\"due_poll_empty_200\",\"ok\":false,\"http\":$CODE,\"items\":${ITEMS:-null}}"

WUUID="00000000-0000-0000-0000-000000000000"
WCODE=$(curl -s -o /tmp/vad_wk.json -w '%{http_code}' -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H "Idempotency-Key: vad-wk0-$KID" \
  -d '{"expectedWorkflowStateVersion":1}' \
  "$BASE/internal/v1/workflow-instances/$WUUID/node-visits/$WUUID/wake")
WERR=$(jq -r '.error.code // empty' /tmp/vad_wk.json 2>/dev/null)
[[ "$WCODE" == "404" && ( "$WERR" == "dispatch_intent_not_found" || "$WERR" == "instance_not_found" ) ]] \
  && rec '{"step":"wake_route_404_contract","ok":true}' || rec "{\"step\":\"wake_route_404_contract\",\"ok\":false,\"http\":$WCODE,\"code\":\"$WERR\"}"

echo "== [F] visit-activation E2E on scratch (SQL-seeded def, real HTTP runtime) =="
CREATOR="$SUB"
WORKER="6e1a11d1-1111-4222-8333-444455556666"
DOMID=$(python3 -c "import uuid;print(uuid.uuid4())")
DEFID=$(python3 -c "import uuid;print(uuid.uuid4())")
VERID=$(python3 -c "import uuid;print(uuid.uuid4())")
SN=$(python3 -c "import uuid;print(uuid.uuid4())"); WN=$(python3 -c "import uuid;print(uuid.uuid4())")
DN=$(python3 -c "import uuid;print(uuid.uuid4())")
T1=$(python3 -c "import uuid;print(uuid.uuid4())"); T2=$(python3 -c "import uuid;print(uuid.uuid4())")

psql "$DBURL" -q <<SQL
INSERT INTO principals (principal_id, principal_type, display_name, email, enabled) VALUES ('$CREATOR','AGENT','Sim Creator',NULL,TRUE) ON CONFLICT (principal_id) DO NOTHING;
INSERT INTO principals (principal_id, principal_type, display_name, email, enabled) VALUES ('$WORKER','AGENT','Sim Worker',NULL,TRUE);
INSERT INTO domains (domain_id, domain_key, display_name, enabled) VALUES ('$DOMID','sim-vad-1','Sim VAD',TRUE);
INSERT INTO domain_role_bindings (binding_id, domain_id, principal_id, role_key, enabled) VALUES (gen_random_uuid(),'$DOMID','$CREATOR','AGENT',TRUE);
INSERT INTO domain_role_bindings (binding_id, domain_id, principal_id, role_key, enabled) VALUES (gen_random_uuid(),'$DOMID','$CREATOR','DOMAIN_OWNER',TRUE);
INSERT INTO workflow_definitions (workflow_definition_id, domain_id, definition_key, display_name) VALUES ('$DEFID','$DOMID','sim-vad-def','Sim Def');
INSERT INTO workflow_definition_versions (definition_version_id, workflow_definition_id, version_number, version_status, semantic_model_version) VALUES ('$VERID','$DEFID',1,'DRAFT',3);
INSERT INTO workflow_node_definitions (node_id, definition_version_id, node_key, display_name, order_index, node_type, assignee_ref_type) VALUES ('$SN','$VERID','start','Start',0,'TASK','WORKFLOW_CREATOR');
INSERT INTO workflow_node_definitions (node_id, definition_version_id, node_key, display_name, order_index, node_type, assignee_ref_type, fixed_principal_id) VALUES ('$WN','$VERID','work','Work',1,'TASK','FIXED_PRINCIPAL','$WORKER');
INSERT INTO workflow_node_definitions (node_id, definition_version_id, node_key, display_name, order_index, node_type, assignee_ref_type) VALUES ('$DN','$VERID','done','Done',2,'TERMINAL',NULL);
INSERT INTO workflow_transition_definitions (transition_id, definition_version_id, transition_key, display_name, source_node_id, target_node_id, transition_effect) VALUES ('$T1','$VERID','advance-1','advance-1','$SN','$WN','ADVANCE');
INSERT INTO workflow_transition_definitions (transition_id, definition_version_id, transition_key, display_name, source_node_id, target_node_id, transition_effect) VALUES ('$T2','$VERID','advance-2','advance-2','$WN','$DN','ADVANCE');
UPDATE workflow_node_definitions SET primary_advance_transition_id='$T1' WHERE node_id='$SN';
UPDATE workflow_node_definitions SET primary_advance_transition_id='$T2' WHERE node_id='$WN';
UPDATE workflow_definition_versions SET version_status='PUBLISHED' WHERE definition_version_id='$VERID';
SQL
rec '{"step":"seed_v1_definition","ok":true}'

CCODE=$(curl -s -o /tmp/vad_ci.json -w '%{http_code}' -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H "Idempotency-Key: vad-create-$KID" \
  -d "{\"domainId\":\"$DOMID\",\"definitionVersionId\":\"$VERID\",\"metadata\":{},\"contextPayload\":{\"title\":\"vad-sim\"}}" \
  "$BASE/internal/v1/workflow-instances")
INST=$(jq -r '.workflowInstanceId // empty' /tmp/vad_ci.json 2>/dev/null)
VISIT1=$(jq -r '.currentNodeVisitId // empty' /tmp/vad_ci.json 2>/dev/null)
SV1=$(jq -r '.workflowStateVersion // empty' /tmp/vad_ci.json 2>/dev/null)
if [[ -n "$INST" ]]; then
  rec "{\"step\":\"create_instance\",\"ok\":true,\"http\":$CCODE,\"instanceId\":\"$INST\",\"entryVisitId\":\"$VISIT1\",\"stateVersion\":$SV1}"
else
  rec "{\"step\":\"create_instance\",\"ok\":false,\"http\":$CCODE,\"body\":$(jq -c . /tmp/vad_ci.json 2>/dev/null || echo null)}"
fi

POLL1=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/internal/v1/dispatch-intents?limit=50")
if echo "$POLL1" | jq -e '[.items[]? .workflowInstanceId] | index("'"$INST"'") != null' >/dev/null 2>&1; then
  rec '{"step":"due_poll_sees_entry_intent","ok":true}'
else
  rec "{\"step\":\"due_poll_sees_entry_intent\",\"ok\":false,\"body\":$(echo "$POLL1" | jq -c . 2>/dev/null | head -c 300 || echo null)}"
fi
DI1=$(echo "$POLL1" | jq -r '[.items[]? | select(.workflowInstanceId=="'"$INST"'")][0].dispatchIntentId // empty' 2>/dev/null)
KEYS=$(echo "$POLL1" | jq -r '[.items[]? | select(.workflowInstanceId=="'"$INST"'")][0] | keys | sort | join(",")' 2>/dev/null)
echo "entry intent: $DI1"
echo "projection keys: $KEYS"
EXPECTED_KEYS="createdAt,dispatchIntentId,nextEligibleAt,nodeVisitId,ownerPrincipalId,updatedAt,workflowInstanceId"
if [[ "$KEYS" == "$EXPECTED_KEYS" ]]; then
  rec "$(printf '{"step":"projection_exact_7_fields","ok":true,"keys":"%s"}' "$KEYS")"
else
  rec "$(printf '{"step":"projection_exact_7_fields","ok":false,"keys":"%s","expected":"%s"}' "$KEYS" "$EXPECTED_KEYS")"
fi
POLL2=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/internal/v1/dispatch-intents?limit=50")
DI1B=$(echo "$POLL2" | jq -r '[.items[]? | select(.workflowInstanceId=="'"$INST"'")][0].dispatchIntentId // empty' 2>/dev/null)
if [[ -n "$DI1" && "$DI1" == "$DI1B" ]]; then
  rec "{\"step\":\"identity_stable_across_polls\",\"ok\":true,\"dispatchIntentId\":\"$DI1\"}"
else
  rec '{"step":"identity_stable_across_polls","ok":false}'
fi

TCODE=$(curl -s -o /tmp/vad_tr.json -w '%{http_code}' -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H "Idempotency-Key: vad-adv-$KID" \
  -d "{\"transitionDefinitionId\":\"$T1\",\"expectedWorkflowStateVersion\":$SV1,\"submissionPayload\":{}}" \
  "$BASE/internal/v1/workflow-instances/$INST/transitions")
SV2=$(jq -r '.workflowStateVersion // empty' /tmp/vad_tr.json 2>/dev/null)
VISIT2=$(jq -r '.currentNodeVisitId // empty' /tmp/vad_tr.json 2>/dev/null)
if [[ "$TCODE" == "200" && -n "$SV2" ]]; then
  rec "{\"step\":\"transition_advance1\",\"ok\":true,\"newStateVersion\":$SV2,\"newVisitId\":\"$VISIT2\"}"
else
  rec "{\"step\":\"transition_advance1\",\"ok\":false,\"http\":$TCODE,\"body\":$(jq -c . /tmp/vad_tr.json 2>/dev/null || echo null)}"
fi

POLL3=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/internal/v1/dispatch-intents?limit=50")
OLD_GONE=$(echo "$POLL3" | jq '[.items[]? | select(.dispatchIntentId=="'"$DI1"'")] | length' 2>/dev/null)
NEW_SEEN=$(echo "$POLL3" | jq '[.items[]? | select(.nodeVisitId=="'"$VISIT2"'")] | length' 2>/dev/null)
[[ "$OLD_GONE" == "0" ]] && rec '{"step":"closed_intent_leaves_due_set","ok":true}' || rec "{\"step\":\"closed_intent_leaves_due_set\",\"ok\":false,\"oldStillPresent\":$OLD_GONE}"
if [[ "$NEW_SEEN" == "1" ]]; then
  OWNER=$(echo "$POLL3" | jq -r '[.items[]? | select(.nodeVisitId=="'"$VISIT2"'")][0].ownerPrincipalId // empty' 2>/dev/null)
  rec "{\"step\":\"work_node_intent_visible_with_assignee\",\"ok\":true,\"ownerPrincipalId\":\"$OWNER\"}"
else
  rec "{\"step\":\"work_node_intent_visible_with_assignee\",\"ok\":false,\"newSeen\":$NEW_SEEN}"
fi

AWCODE=$(curl -s -o /tmp/vad_aw.json -w '%{http_code}' -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H "Idempotency-Key: vad-wk1-$KID" \
  -d '{"expectedWorkflowStateVersion":1}' \
  "$BASE/internal/v1/workflow-instances/$INST/node-visits/$VISIT2/wake")
AWR=$(jq -r '.reason // empty' /tmp/vad_aw.json 2>/dev/null); AWA=$(jq -r '.wakeApplied' /tmp/vad_aw.json 2>/dev/null)
[[ "$AWCODE" == "200" && "$AWR" == "VERSION_MISMATCH" && "$AWA" == "false" ]] \
  && rec '{"step":"wake_stale_version_durable_noop","ok":true}' || rec "{\"step\":\"wake_stale_version_durable_noop\",\"ok\":false,\"http\":$AWCODE,\"reason\":\"$AWR\"}"
AW2=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H "Idempotency-Key: vad-wk2-$KID" \
  -d "{\"expectedWorkflowStateVersion\":$SV2}" \
  "$BASE/internal/v1/workflow-instances/$INST/node-visits/$VISIT2/wake")
AWA2=$(echo "$AW2" | jq -r '.wakeApplied' 2>/dev/null); AWR2=$(echo "$AW2" | jq -r '.reason // empty' 2>/dev/null)
[[ "$AWA2" == "false" && "$AWR2" == "ALREADY_DUE" ]] \
  && rec '{"step":"wake_already_due_durable_noop","ok":true}' || rec "{\"step\":\"wake_already_due_durable_noop\",\"ok\":false,\"applied\":\"$AWA2\",\"reason\":\"$AWR2\"}"

ARC=$(curl -s -o /tmp/vad_ar.json -w '%{http_code}' -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: vad-arc-$KID" \
  -d '{"reason":"sim probe"}' "$BASE/internal/v1/workflow-instances/$INST/archive")
[[ "$ARC" == "409" ]] && rec '{"step":"archive_failclosed_active_activation","ok":true}' || rec "{\"step\":\"archive_failclosed_active_activation\",\"ok\":false,\"http\":$ARC}"

echo "== [G] results =="
python3 - <<PYEOF
import json
lines=[]
for l in open("$RESULTS.new"):
    l=l.strip()
    if not l: continue
    try: lines.append(json.loads(l))
    except Exception as e: lines.append({"step":"UNPARSEABLE","ok":False,"raw":l[:200]})
ok=all(l.get("ok") for l in lines)
json.dump({"sim":"visit-activation-dispatch-v1-phase4","binarySourceSha":"$SHA","allOk":ok,"steps":lines}, open("$RESULTS","w"), indent=2)
import os
try: os.remove("$RESULTS.new")
except OSError: pass
print("SIM_ALL_OK" if ok else "SIM_HAS_FAILURES", len(lines), "steps")
PYEOF
