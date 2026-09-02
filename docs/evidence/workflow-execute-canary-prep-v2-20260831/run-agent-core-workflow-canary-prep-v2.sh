#!/bin/bash
# run-agent-core-workflow-canary-prep-v2.sh — WORKFLOW_EXECUTE_CANARY_V1
# fixture-only provisioning (root-gated, one-shot, owner command).
#
# TASK_NAME = 验收 执行 (canary fixture preparation round, 2026-08-31)
#
# Owner command:
#   sudo bash /tmp/run-agent-core-workflow-canary-prep-v2.sh
#   (interactive phrase: APPLY WORKFLOW_CANARY_PREP_V2)
#
# Atomically performs, in order:
#   G0  preflight: root gate, files, service health, canary-gate posture
#       (write gate must be enabled; per-identity allowlist must be ABSENT —
#       this round is explicitly forbidden from setting it);
#   W1  read the frozen canary credential from the broker credential store
#       (root-only); assert agentId == agt_build-in-public-agent and
#       clientId == mc_ohDTyGYRpBLI4qN_sVU88aob;
#   W2  acquire canary token (workflow.read workflow.execute, resource
#       svc-workflow); decode claims; assert sub == frozen principal,
#       client_id == frozen client id, scopes include workflow.execute;
#   W3  create EXACTLY ONE dedicated canary instance via the formal
#       provisioning surface (POST /internal/v1/workflow-instances, scope
#       workflow.execute, Idempotency-Key, domain workflow-todo-dogfood,
#       definition personal_quick_item_v1 @ 95aacea2..., entry node
#       WORKFLOW_CREATOR => current assignee becomes the frozen canary
#       principal itself);
#   W3b create EXACTLY ONE read-only control instance (same surface, same
#       identity; never transitioned). Rationale, verified read-only this
#       round: instance-detail visibility is owner / current-assignee /
#       creator-draft / historical-participant ONLY, and the canary principal
#       has created 0 and been assigned 0 instances in its lifetime — no
#       pre-existing instance is readable by it, and touching a real business
#       instance is forbidden. The deploy-time canary program requires a
#       control instance in the same domain whose detail is byte-equal before
#       and after the canary transition.
#   W4  baseline read as canary: GET instance detail for BOTH instances;
#       freeze stateVersion / currentNodeVisitId / assignee / title /
#       outgoing transition (advance-to-completed) transition_id +
#       submission_schema + executable_for_actor;
#   W4b pagination posture probes (READ-ONLY, zero writes, evidence for the
#       deployment review): domain-instance listing as the canary identity on
#       workflow-todo-dogfood (expected 403 — DOMAIN_OWNER-only, canary holds
#       DOMAIN_MEMBER) and on build-in-public-dogfood (expected 200 — the one
#       domain this identity owns). Neither result fails this runner;
#       both are recorded as POSTURE_EVIDENCE;
#   W5  read-only DB receipts/events baseline + zero-transition attestation
#       + domain census (psql SELECT inside BEGIN READ ONLY ... ROLLBACK);
#   W6  generate /tmp/agent-core-workflow-canary-v1.json from the frozen
#       facts (server-derived values only; no placeholders, no secrets);
#   W7  validate the generated config with the VERBATIM validator python of
#       the sealed combined deploy runner v2 (18c1fdc6...) — must report
#       CANARY_PREREQS_READY=YES; print CANARY_CONFIG_SHA256;
#   W8  boundary re-attestation: allowlist still absent, reload count 0,
#       transition submissions 0.
#
# HARD BOUNDARIES (mechanically enforced):
#   - NEVER writes svc-workflow .env (read-only grep only); refuses to start
#     if AUTH_V1_CANARY_ALLOWED_SUB / AUTH_V1_CANARY_ALLOWED_CLIENT_ID exist.
#   - NEVER calls launchctl / kickstart (zero reloads of anything).
#   - NEVER calls the transitions endpoint (the only writes are the two
#     fixture-instance creates; workflow_transition submissions stay 0).
#   - SQL is SELECT-only (read-only transaction, rolled back).
#   - Never echoes or persists clientSecret / access token; secrets live in
#     shell variables only. On failure nothing is rolled back destructively —
#     the fixtures are inert, explicitly-marked disposable rows; a rerun
#     adopts them (exactly-once per external_reference).
#   - Rerun after success: adopts both fixtures and regenerates a
#     byte-identical config (same sha256).
#
# bash 3.2 compatible (macOS /bin/bash). set -Eeuo pipefail.
#
# Prepared 2026-08-31 by the canary fixture preparation round; sealed copy in
# docs/evidence/workflow-execute-canary-prep-v2-20260831/ of dsh-agent-core.

set -Eeuo pipefail

readonly SCRIPT_NAME="run-agent-core-workflow-canary-prep-v2.sh"
readonly CANARY_AGENT_ID="agt_build-in-public-agent"
readonly CANARY_CLIENT_ID="mc_ohDTyGYRpBLI4qN_sVU88aob"
readonly CANARY_PRINCIPAL="d5b3aeb2-e754-49a9-9914-b963521c0985"
readonly CRED_STORE="/usr/local/libexec/agent-core/config/agent-credentials.json"
readonly AUTH_ORIGIN="http://127.0.0.1:4001"
readonly WF_ORIGIN="http://127.0.0.1:8989"
readonly WF_ENV="/Users/yanfenma/.local/services/svc-workflow/.env"
readonly WF_DOMAIN_ID="10000000-0000-0000-0000-000000000100"        # workflow-todo-dogfood
readonly BIP_DOMAIN_ID="f9b5682c-1c9c-5ace-a7b1-01b9a3be5965"       # build-in-public-dogfood (probe only)
readonly WF_DEFVER_ID="95aacea2-5599-4e74-b576-e2eeb61e27a0"        # personal_quick_item_v1 v1 PUBLISHED
readonly EXPECTED_TRANSITION_ID="7493f6ca-6cf0-4ebf-95f8-f565f2b231ec" # advance-to-completed (DB-frozen 2026-08-31; cross-checked live in W4)
readonly CANARY_EXT_REF="workflow_execute_canary_v1"
readonly CONTROL_EXT_REF="workflow_execute_canary_v1_control"
readonly CANARY_TITLE="CANARY workflow_execute_canary_v1 — dedicated disposable fixture (do not process)"
readonly CONTROL_TITLE="CANARY CONTROL workflow_execute_canary_v1 — read-only control fixture (never transitioned)"
readonly CANARY_SUMMARY="workflow_execute_canary_v1: combined deploy canary transition (disposable fixture)"
readonly CANARY_CONFIG="/tmp/agent-core-workflow-canary-v1.json"
readonly MARKER_CANARY="/tmp/workflow-canary-prep-v2-canary.json"
readonly MARKER_CONTROL="/tmp/workflow-canary-prep-v2-control.json"
readonly FACTS_FILE="/tmp/workflow-canary-prep-v2-facts.json"
readonly LOG_TAG="[canary-prep-v2]"

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

log() { echo "$LOG_TAG $*"; }
die() { echo "$LOG_TAG FAIL: $*" >&2; exit 1; }

on_error() {
  local code=$?
  log "ERROR trap (exit=$code) — no destructive rollback performed (fixtures, if created, are inert disposable rows; rerun adopts them)"
  exit "$code"
}
trap on_error ERR INT TERM

# ------------------------------------------------------------- G0 preflight
[ "$(id -u)" = "0" ] || die "must run as root (sudo bash $SCRIPT_NAME)"

printf '%s\n' \
  "$LOG_TAG ABOUT TO: create EXACTLY TWO dedicated disposable fixture instances" \
  "  (1 canary + 1 read-only control) in domain workflow-todo-dogfood" \
  "  (definition personal_quick_item_v1) as the frozen CTR-009 canary identity" \
  "  agt_build-in-public-agent, then freeze facts and generate" \
  "  $CANARY_CONFIG." \
  "$LOG_TAG This round does NOT set the canary allowlist, does NOT reload" \
  "  svc-workflow, and does NOT execute any workflow_transition (writes stay 0)."
printf '%s' "$LOG_TAG Type APPLY WORKFLOW_CANARY_PREP_V2 to continue: "
read -r PHRASE
[ "$PHRASE" = "APPLY WORKFLOW_CANARY_PREP_V2" ] || die "phrase mismatch — aborting with zero changes"

for f in "$CRED_STORE" "$WF_ENV"; do
  [ -f "$f" ] || die "required file missing: $f"
done
[ "$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$WF_ORIGIN/healthz")" = "200" ] || die "svc-workflow healthz not 200"
[ "$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$AUTH_ORIGIN/api/health")" = "200" ] || die "auth-service health not 200"

grep -q '^AUTH_V1_CANARY_ENABLED=true$' "$WF_ENV"        || die "$WF_ENV: AUTH_V1_CANARY_ENABLED != true (unexpected posture)"
grep -q '^AUTH_V1_CANARY_WRITE_ENABLED=true$' "$WF_ENV"  || die "$WF_ENV: AUTH_V1_CANARY_WRITE_ENABLED != true — instance create would be 403 canary_read_only; refusing (fixing the gate is outside this round)"
if grep -q '^AUTH_V1_CANARY_ALLOWED_SUB=' "$WF_ENV" || grep -q '^AUTH_V1_CANARY_ALLOWED_CLIENT_ID=' "$WF_ENV"; then
  die "$WF_ENV: allowlist vars already present — this round is forbidden from touching them and refuses to run in that state"
fi
command -v psql >/dev/null 2>&1 || die "psql not found in PATH"
log "G0 preflight PASS (root, files, healthz=200, auth=200, write gate enabled, allowlist ABSENT)"

# ------------------------------------------------------------------- W1 creds
CRED_JSON=$(python3 - "$CRED_STORE" "$CANARY_CLIENT_ID" <<'PYEOF'
import json, sys
store_file, canary_id = sys.argv[1], sys.argv[2]
doc = json.load(open(store_file))
entries = doc.get("credentials", {})
hit = None
for agent_id, c in entries.items():
    if (c or {}).get("clientId") == canary_id:
        hit = (agent_id, c.get("clientSecret", ""))
        break
print(json.dumps({"agentId": hit[0] if hit else None, "hasSecret": bool(hit and hit[1]), "entryCount": len(entries)}))
PYEOF
) || die "credential store parse failed"
CANARY_AGENT_ID_FOUND=$(printf '%s' "$CRED_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["agentId"] or "")')
CANARY_HAS_SECRET=$(printf '%s' "$CRED_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["hasSecret"])')
CANARY_SECRET=$(python3 - "$CRED_STORE" "$CANARY_CLIENT_ID" <<'PYEOF'
import json, sys
doc = json.load(open(sys.argv[1]))
for agent_id, c in doc.get("credentials", {}).items():
    if (c or {}).get("clientId") == sys.argv[2]:
        print(c.get("clientSecret", ""))
        break
PYEOF
)
[ -n "$CANARY_AGENT_ID_FOUND" ] || die "frozen canary clientId not found in credential store"
[ "$CANARY_AGENT_ID_FOUND" = "$CANARY_AGENT_ID" ] || die "credential store agentId ($CANARY_AGENT_ID_FOUND) != $CANARY_AGENT_ID"
[ "$CANARY_HAS_SECRET" = "True" ] && [ -n "$CANARY_SECRET" ] || die "canary credential entry has no clientSecret"
log "W1 PASS: frozen canary credential found (agentId=$CANARY_AGENT_ID clientId=$CANARY_CLIENT_ID)"

# ------------------------------------------------------------------ W2 token
get_token() { # $1=client_id $2=client_secret $3=scope -> stdout token
  curl -s -m 10 -X POST "$AUTH_ORIGIN/oauth/token" \
    -u "$1:$2" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "grant_type=client_credentials" \
    --data-urlencode "resource=svc-workflow" \
    --data-urlencode "scope=$3" | python3 -c 'import json,sys
try:
    d = json.load(sys.stdin)
    print(d.get("access_token",""))
except Exception:
    print("")'
}
decode_claim() { # $1=token $2=claim
  printf '%s' "$1" | python3 -c 'import base64,json,sys
parts = sys.stdin.read().split(".")
pad = "=" * (-len(parts[1]) % 4)
claims = json.loads(base64.urlsafe_b64decode(parts[1] + pad))
print(claims.get(sys.argv[1], ""))' "$2"
}

CANARY_TOKEN=$(get_token "$CANARY_CLIENT_ID" "$CANARY_SECRET" "workflow.read workflow.execute")
[ -n "$CANARY_TOKEN" ] || die "canary token acquisition failed (grant census fail-closed)"
TOKEN_SUB=$(decode_claim "$CANARY_TOKEN" "sub")
TOKEN_CID=$(decode_claim "$CANARY_TOKEN" "client_id")
TOKEN_SCOPE=$(decode_claim "$CANARY_TOKEN" "scope")
log "W2 canary token acquired: sub=$TOKEN_SUB client_id=$TOKEN_CID scope=$TOKEN_SCOPE"
[ "$TOKEN_SUB" = "$CANARY_PRINCIPAL" ] || die "token sub ($TOKEN_SUB) != frozen principal ($CANARY_PRINCIPAL)"
[ "$TOKEN_CID" = "$CANARY_CLIENT_ID" ] || die "token client_id mismatch"
case " $TOKEN_SCOPE " in *" workflow.execute "*) ;; *) die "token lacks workflow.execute (grant census fail-closed)";; esac
case " $TOKEN_SCOPE " in *" workflow.read "*) ;; *) die "token lacks workflow.read";; esac
log "W2 PASS: grant census empirical — canary principal holds workflow.execute via auth-service"

# ------------------------------------------------- psql read-only helper (W3 adopt/W5)
DB_URL=$(grep '^DATABASE_URL=' "$WF_ENV" | head -1 | cut -d= -f2-)
DBParse=$(DB_URL="$DB_URL" python3 -c '
import os, urllib.parse
u = urllib.parse.urlparse(os.environ["DB_URL"])
print(urllib.parse.unquote(u.hostname or "localhost")); print(u.username or ""); print((u.path or "/").lstrip("/"))')
DB_HOST=$(printf '%s\n' "$DBParse" | sed -n 1p)
DB_USER=$(printf '%s\n' "$DBParse" | sed -n 2p)
DB_NAME=$(printf '%s\n' "$DBParse" | sed -n 3p)
export PGPASSWORD=$(DB_URL="$DB_URL" python3 -c '
import os, urllib.parse
u = urllib.parse.urlparse(os.environ["DB_URL"])
print(urllib.parse.unquote(u.password or ""))')
[ -n "$DB_USER" ] && [ -n "$DB_NAME" ] || die "DATABASE_URL parse failed"
db_query() { psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -At -F '|' -v ON_ERROR_STOP=1 "$@"; }

adopt_or_create() { # $1=marker $2=ext_ref $3=title $4=description_json $5=metadata_json $6=idemp_prefix -> sets INSTANCE_ID
  local marker="$1" ext_ref="$2" title="$3" desc="$4" meta="$5" idemp_prefix="$6" rows n idb
  if [ -f "$marker" ]; then
    INSTANCE_ID=$(python3 -c 'import json; print(json.load(open("'"$marker"'"))["workflowInstanceId"])')
    log "  SKIP create: marker present — adopting existing $ext_ref instance $INSTANCE_ID"
    return 0
  fi
  rows=$(db_query -c "SELECT workflow_instance_id FROM workflow_instances WHERE external_reference = '$ext_ref' AND created_by_principal_id = '$CANARY_PRINCIPAL';" 2>/dev/null || true)
  n=$(printf '%s\n' "$rows" | grep -c . || true)
  if [ "$n" = "1" ] && [ -n "$(printf '%s' "$rows" | head -1)" ]; then
    INSTANCE_ID=$(printf '%s\n' "$rows" | head -1)
    printf '{\n  "workflowInstanceId": "%s",\n  "adopted": true\n}\n' "$INSTANCE_ID" > "$marker"
    log "  ADOPT: exactly one prior $ext_ref instance found — adopting $INSTANCE_ID (no new create)"
    return 0
  fi
  [ "$n" = "0" ] || die "multiple prior $ext_ref instances exist ($n) — refusing to create another"
  local idemp_key body http
  idemp_key="${idemp_prefix}-$(date -u +%Y%m%dT%H%M%SZ)"
  body=$(python3 - "$WF_DOMAIN_ID" "$WF_DEFVER_ID" "$ext_ref" "$meta" "$title" "$desc" <<'PYEOF'
import json, sys
print(json.dumps({
    "domainId": sys.argv[1],
    "definitionVersionId": sys.argv[2],
    "externalReference": sys.argv[3],
    "metadata": json.loads(sys.argv[4]),
    "contextPayload": {"title": sys.argv[5], "description": sys.argv[6]},
}, ensure_ascii=False))
PYEOF
)
  http=$(curl -s -m 15 -o /tmp/canary-prep-v2-create-body.json -w '%{http_code}' -X POST \
    "$WF_ORIGIN/internal/v1/workflow-instances" \
    -H "Authorization: Bearer $CANARY_TOKEN" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $idemp_key" \
    -d "$body") || die "create request transport failure ($ext_ref)"
  [ "$http" = "201" ] || { log "create failed HTTP=$http body=$(head -c 400 /tmp/canary-prep-v2-create-body.json)"; die "instance create failed for $ext_ref"; }
  python3 -c 'import json; d=json.load(open("/tmp/canary-prep-v2-create-body.json"));
req=["workflowInstanceId","workflowStateVersion","currentNodeVisitId","eventSequence","currentContextRevisionId"]
assert all(k in d for k in req), d
json.dump({"workflowInstanceId":d["workflowInstanceId"],"workflowStateVersion":d["workflowStateVersion"],"currentNodeVisitId":d["currentNodeVisitId"],"currentContextRevisionId":d["currentContextRevisionId"],"eventSequence":d["eventSequence"],"idempotencyKey":"'"$idemp_key"'"}, open("'"$marker"'","w"), indent=2)' || die "create response parse failed ($ext_ref)"
  INSTANCE_ID=$(python3 -c 'import json; print(json.load(open("'"$marker"'"))["workflowInstanceId"])')
  log "  PASS: $ext_ref instance created — id=$INSTANCE_ID (idempotency-key=$idemp_key)"
}

log "W3 create canary instance (externalReference=$CANARY_EXT_REF) — exactly one"
adopt_or_create "$MARKER_CANARY" "$CANARY_EXT_REF" "$CANARY_TITLE" \
  "Dedicated canary instance for the broker workflow_transition production canary (workflow_execute_canary_v1). Created by the canary fixture preparation round as the workflow creator so the current assignee is the frozen canary principal. Not a business task; never processed." \
  '{"canary": true, "purpose": "workflow_execute_canary_v1 dedicated disposable canary instance", "preparedBy": "WORKFLOW_CANARY_PREP_V2 2026-08-31", "disposable": true}' \
  "canary-prep-v2-canary"
CANARY_INSTANCE_ID="$INSTANCE_ID"

log "W3b create control instance (externalReference=$CONTROL_EXT_REF) — read-only control, never transitioned"
adopt_or_create "$MARKER_CONTROL" "$CONTROL_EXT_REF" "$CONTROL_TITLE" \
  "Read-only control instance for the broker workflow_transition production canary (workflow_execute_canary_v1). Created by the canary fixture preparation round because the canary principal has no read relationship with any pre-existing instance. Never transitioned; not a business task." \
  '{"canary": true, "purpose": "workflow_execute_canary_v1 read-only control instance (never transitioned)", "preparedBy": "WORKFLOW_CANARY_PREP_V2 2026-08-31", "disposable": true}' \
  "canary-prep-v2-control"
CONTROL_INSTANCE_ID="$INSTANCE_ID"
[ "$CANARY_INSTANCE_ID" != "$CONTROL_INSTANCE_ID" ] || die "canary and control resolved to the same instance id"
log "W3 PASS: fixtures in place — canary=$CANARY_INSTANCE_ID control=$CONTROL_INSTANCE_ID"

# ------------------------------------------------------------- W4 baseline read
read_detail() { # $1=instance_id $2=outfile -> http code
  curl -s -m 10 -o "$2" -w '%{http_code}' \
    "$WF_ORIGIN/internal/v1/workflow-instances/$1" \
    -H "Authorization: Bearer $CANARY_TOKEN"
}

extract_facts() { # $1=detail_file $2=marker_file $3=expected_title -> stdout facts json
  python3 - "$1" "$2" "$3" "$CANARY_PRINCIPAL" "$WF_DOMAIN_ID" "$WF_DEFVER_ID" "$EXPECTED_TRANSITION_ID" <<'PYEOF'
import json, sys
detail_file, marker_file, expected_title, principal, domain_id, defver_id, expected_tid = sys.argv[1:8]
doc = json.load(open(detail_file))
mark = json.load(open(marker_file))
assert doc.get("visibility") == "full", doc.get("visibility")
d = doc["detail"]
inst = d["instance"]
assert inst["domain_id"] == domain_id, inst["domain_id"]
assert inst["definition_version_id"] == defver_id, inst["definition_version_id"]
assert inst["workflow_instance_id"] == mark["workflowInstanceId"]
assert inst["is_terminal"] is False
assert inst["current_node"]["node_key"] == "open", inst["current_node"]
assert d["current_visit"]["assignee_principal_id"] == principal, d["current_visit"]
assert d["current_node_visit_id"] == mark.get("currentNodeVisitId", d["current_node_visit_id"])
title = d["current_context"]["payload"]["title"]
assert title == expected_title, title
outs = d["outgoing_transitions"]
target = next((t for t in outs if t["transition_key"] == "advance-to-completed"), None)
assert target is not None, [t["transition_key"] for t in outs]
assert target["transition_id"] == expected_tid, target["transition_id"]
assert target["executable_for_actor"] is True, target
assert target["blocked_reason"] is None, target
schema = target["submission_schema"] or {}
assert "summary" in (schema.get("required") or []), schema
print(json.dumps({
    "workflowInstanceId": inst["workflow_instance_id"],
    "domainId": inst["domain_id"],
    "definitionVersionId": inst["definition_version_id"],
    "stateVersion": inst["workflow_state_version"],
    "currentNodeVisitId": d["current_node_visit_id"],
    "currentContextRevisionId": d["current_context_revision_id"],
    "assigneePrincipalId": d["current_visit"]["assignee_principal_id"],
    "title": title,
    "currentNodeKey": inst["current_node"]["node_key"],
    "transitionDefinitionId": target["transition_id"],
    "transitionKey": target["transition_key"],
    "executableForActor": target["executable_for_actor"],
    "submissionSchema": schema,
    "outgoingTransitionKeys": [t["transition_key"] for t in outs],
}, ensure_ascii=False))
PYEOF
}

CANARY_DETAIL_HTTP=$(read_detail "$CANARY_INSTANCE_ID" /tmp/canary-prep-v2-detail-canary.json) || die "canary detail read transport failure"
[ "$CANARY_DETAIL_HTTP" = "200" ] || die "canary baseline detail read failed HTTP=$CANARY_DETAIL_HTTP"
CANARY_FACTS=$(extract_facts /tmp/canary-prep-v2-detail-canary.json "$MARKER_CANARY" "$CANARY_TITLE") || die "canary baseline extraction/assertion failed"
log "W4 canary baseline: $(printf '%s' "$CANARY_FACTS" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("version=%s nodeVisit=%s assignee=%s transition=%s executable=%s schemaRequired=%s" % (d["stateVersion"], d["currentNodeVisitId"], d["assigneePrincipalId"], d["transitionDefinitionId"], d["executableForActor"], d["submissionSchema"].get("required")))')"

CONTROL_DETAIL_HTTP=$(read_detail "$CONTROL_INSTANCE_ID" /tmp/canary-prep-v2-detail-control.json) || die "control detail read transport failure"
[ "$CONTROL_DETAIL_HTTP" = "200" ] || die "control baseline detail read failed HTTP=$CONTROL_DETAIL_HTTP"
CONTROL_FACTS=$(extract_facts /tmp/canary-prep-v2-detail-control.json "$MARKER_CONTROL" "$CONTROL_TITLE") || die "control baseline extraction/assertion failed"
log "W4 control baseline: $(printf '%s' "$CONTROL_FACTS" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("version=%s nodeVisit=%s assignee=%s title-marked=%s" % (d["stateVersion"], d["currentNodeVisitId"], d["assigneePrincipalId"], ("CANARY" in d["title"])))')"
log "W4 PASS: both baselines frozen (visibility=full, assignee=frozen canary principal, node=open, non-terminal)"

# --------------------------------------------- W4b pagination posture probes (read-only)
probe_domain() { # $1=domain_id $2=outfile -> http code
  curl -s -m 10 -o "$2" -w '%{http_code}' \
    "$WF_ORIGIN/internal/v1/workflow-instances/domain?domainId=$1&limit=2" \
    -H "Authorization: Bearer $CANARY_TOKEN"
}
TODO_PROBE_HTTP=$(probe_domain "$WF_DOMAIN_ID" /tmp/canary-prep-v2-probe-todo.json) || TODO_PROBE_HTTP="transport_failure"
BIP_PROBE_HTTP=$(probe_domain "$BIP_DOMAIN_ID" /tmp/canary-prep-v2-probe-bip.json) || BIP_PROBE_HTTP="transport_failure"
log "W4b POSTURE_EVIDENCE (read-only): domain listing as canary identity —"
log "  workflow-todo-dogfood  HTTP=$TODO_PROBE_HTTP body=$(head -c 200 /tmp/canary-prep-v2-probe-todo.json 2>/dev/null)"
log "  build-in-public-dogfood HTTP=$BIP_PROBE_HTTP body=$(head -c 120 /tmp/canary-prep-v2-probe-bip.json 2>/dev/null)"
if [ "$TODO_PROBE_HTTP" = "200" ]; then
  log "  NOTE: workflow-todo-dogfood listing unexpectedly SUCCEEDED for the canary identity (DOMAIN_OWNER posture changed?) — re-audit required before deploy"
else
  log "  EXPECTED-CONFLICT CONFIRMED: canary identity is DOMAIN_MEMBER (not DOMAIN_OWNER) of workflow-todo-dogfood;"
  log "  the sealed combined-deploy-v2 runner's canary pagination step will fail closed on this domain until the"
  log "  ownership conflict is resolved by the Owner (see round report BLOCKER-2)."
fi

# ------------------------------------------------ W5 read-only DB receipts/events/attestations
CANARY_IDEMP_KEY=$(python3 -c 'import json; print(json.load(open("'"$MARKER_CANARY"'"))["idempotencyKey"])' 2>/dev/null || printf '%s' "adopted")
CONTROL_IDEMP_KEY=$(python3 -c 'import json; print(json.load(open("'"$MARKER_CONTROL"'"))["idempotencyKey"])' 2>/dev/null || printf '%s' "adopted")
DB_OUT=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -At -F '|' -v ON_ERROR_STOP=1 <<SQL
BEGIN READ ONLY;
SELECT 'census_domain', count(*)::text FROM workflow_instances WHERE domain_id = '$WF_DOMAIN_ID';
SELECT 'canary_receipts', idempotency_key, command_type::text, receipt_status::text FROM workflow_command_receipts WHERE principal_id = '$CANARY_PRINCIPAL' AND idempotency_key LIKE 'canary-prep-v2-%';
SELECT 'canary_transition_events', count(*)::text FROM workflow_events WHERE workflow_instance_id = '$CANARY_INSTANCE_ID' AND transition_effect IS NOT NULL;
SELECT 'canary_events', event_type::text, count(*)::text FROM workflow_events WHERE workflow_instance_id = '$CANARY_INSTANCE_ID' GROUP BY 1,2;
SELECT 'control_events', event_type::text, count(*)::text FROM workflow_events WHERE workflow_instance_id = '$CONTROL_INSTANCE_ID' GROUP BY 1,2;
ROLLBACK;
SQL
) || die "psql read-only baseline failed"
log "W5 receipts/events baseline (read-only SELECT, rolled back):"
printf '%s\n' "$DB_OUT" | sed 's/^/    /'
TRANSITION_EVENTS=$(printf '%s\n' "$DB_OUT" | sed -n 's/^canary_transition_events|//p')
[ "$TRANSITION_EVENTS" = "0" ] || die "canary instance already has transition events ($TRANSITION_EVENTS) — fixture is not pristine; refusing"
DOMAIN_CENSUS=$(printf '%s\n' "$DB_OUT" | sed -n 's/^census_domain|//p')
log "W5 PASS: zero transition events (idempotency keys: canary=$CANARY_IDEMP_KEY control=$CONTROL_IDEMP_KEY); domain census (rows in workflow-todo-dogfood incl. fixtures) = $DOMAIN_CENSUS"

# ------------------------------------------------------------- W6 generate config
CANARY_STATE_VERSION=$(printf '%s' "$CANARY_FACTS" | python3 -c 'import json,sys; print(json.load(sys.stdin)["stateVersion"])')
CANARY_TRANSITION_ID=$(printf '%s' "$CANARY_FACTS" | python3 -c 'import json,sys; print(json.load(sys.stdin)["transitionDefinitionId"])')
CANARY_SERVER_TITLE=$(printf '%s' "$CANARY_FACTS" | python3 -c 'import json,sys; print(json.load(sys.stdin)["title"])')

python3 - "$CANARY_CONFIG" "$CANARY_INSTANCE_ID" "$CONTROL_INSTANCE_ID" "$CANARY_PRINCIPAL" \
  "$CANARY_SERVER_TITLE" "$CANARY_TRANSITION_ID" "$CANARY_STATE_VERSION" "$CANARY_SUMMARY" <<'PYEOF'
import json, sys, os
path, canary_id, control_id, principal, title, tid, version, summary = sys.argv[1:9]
cfg = {
    "agentId": "agt_build-in-public-agent",
    "domainId": "10000000-0000-0000-0000-000000000100",
    "canaryInstanceId": canary_id,
    "controlInstanceId": control_id,
    "expectedAssigneePrincipalId": principal,
    "expectedCanaryTitle": title,
    "transitionDefinitionId": tid,
    "expectedWorkflowStateVersion": int(version),
    "paginationLimit": 2,
    "expectedMinimumPages": 2,
    "expectedMinimumInstances": 10,
    "dedicatedNoBusinessSideEffects": True,
    "submissionPayload": {"summary": summary},
    "expectedSubmissionSchemaKeys": ["summary"],
}
tmp = path + ".tmp"
with open(tmp, "w") as fh:
    json.dump(cfg, fh, indent=2, ensure_ascii=False)
    fh.write("\n")
os.chmod(tmp, 0o644)
os.rename(tmp, path)
print(path)
PYEOF
[ -f "$CANARY_CONFIG" ] || die "canary config generation failed"
log "W6 PASS: config generated at $CANARY_CONFIG (title frozen from server response)"

# ----------------------------------------------- W7 validate with the VERBATIM validator
VOUT=$(python3 - "$CANARY_CONFIG" <<'PYEOF'
import hashlib, json, os, re, stat as statmod, sys

path = sys.argv[1]
issues = []

def emit(line):
    print(line)

def ready(flag):
    emit(f'CANARY_PREREQS_READY={"YES" if flag else "NO"}')

try:
    st = os.lstat(path)
except FileNotFoundError:
    emit('CANARY_ISSUE=file_missing: ' + path)
    ready(False)
    sys.exit(0)
if statmod.S_ISLNK(st.st_mode):
    emit('CANARY_ISSUE=symlink_refused')
    ready(False)
    sys.exit(0)
if not statmod.S_ISREG(st.st_mode):
    emit('CANARY_ISSUE=not_a_regular_file')
    ready(False)
    sys.exit(0)
if st.st_size == 0:
    emit('CANARY_ISSUE=empty_file')
    ready(False)
    sys.exit(0)
try:
    with open(path, 'rb') as fh:
        raw = fh.read()
except OSError as exc:
    emit(f'CANARY_ISSUE=unreadable: {type(exc).__name__}')
    ready(False)
    sys.exit(0)

emit(f'CANARY_CONFIG_SHA256={hashlib.sha256(raw).hexdigest()}')

text = raw.decode('utf-8', errors='replace')

PLACEHOLDER_RES = [
    r'PLACEHOLDER', r'\bTODO\b', r'\bTBD\b', r'\bFIXME\b', r'CHANGE_?ME',
    r'<[A-Za-z_][A-Za-z0-9_-]*>', r'example\.(com|org)', r'\byour[-_][a-z]', r'\bXXX{2,}\b',
]
for pattern in PLACEHOLDER_RES:
    m = re.search(pattern, text, re.IGNORECASE)
    if m:
        issues.append(f'placeholder_pattern={pattern}')

SECRET_RES = [
    r'-----BEGIN [A-Z ]*PRIVATE KEY-----',
    r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}',
    r'[A-Fa-f0-9]{48,}',
    r'[A-Za-z0-9+/]{44,}={0,2}',
]
for pattern in SECRET_RES:
    if re.search(pattern, text):
        issues.append(f'secret_pattern={pattern}')
if re.search(r'"(client_?secret|access_?token|refresh_?token|api_?key|password|private_?key|token|secret)"\s*:\s*"[^"]+"', text, re.IGNORECASE):
    issues.append('secret_key_with_value')

try:
    cfg = json.loads(text)
except Exception as exc:
    emit(f'CANARY_ISSUE=json_parse_failed: {type(exc).__name__}')
    for i in issues:
        emit(f'CANARY_ISSUE={i}')
    ready(False)
    sys.exit(0)

REQUIRED_STRINGS = [
    'agentId', 'domainId', 'canaryInstanceId', 'controlInstanceId',
    'expectedAssigneePrincipalId', 'expectedCanaryTitle', 'transitionDefinitionId',
]
for key in REQUIRED_STRINGS:
    v = cfg.get(key)
    if not isinstance(v, str) or v.strip() == '':
        issues.append(f'missing_or_empty={key}')

# CTR-009 canary identity: default (and currently the only) canary identity.
if cfg.get('agentId') != 'agt_build-in-public-agent':
    issues.append('canary_identity_not_ctr009_default (expected agt_build-in-public-agent)')

UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
for key in ['domainId', 'canaryInstanceId', 'controlInstanceId', 'expectedAssigneePrincipalId', 'transitionDefinitionId']:
    v = cfg.get(key)
    if isinstance(v, str) and not UUID_RE.match(v):
        issues.append(f'not_a_uuid={key}')

if cfg.get('dedicatedNoBusinessSideEffects') is not True:
    issues.append('dedicatedNoBusinessSideEffects_not_true')
if cfg.get('canaryInstanceId') == cfg.get('controlInstanceId'):
    issues.append('control_instance_equals_canary_instance')
if not re.search(r'canary', str(cfg.get('expectedCanaryTitle', '')), re.IGNORECASE):
    issues.append('canary_title_not_marked')

sv = cfg.get('expectedWorkflowStateVersion')
if not isinstance(sv, int) or isinstance(sv, bool) or sv < 1:
    issues.append('expectedWorkflowStateVersion_invalid (integer >= 1)')

limit = cfg.get('paginationLimit', 2)
if not isinstance(limit, int) or isinstance(limit, bool) or not (1 <= limit <= 20):
    issues.append('paginationLimit_invalid (integer 1..20)')
pages = cfg.get('expectedMinimumPages')
if not isinstance(pages, int) or isinstance(pages, bool) or pages < 2:
    issues.append('expectedMinimumPages_invalid (integer >= 2)')
inst = cfg.get('expectedMinimumInstances')
if not isinstance(inst, int) or isinstance(inst, bool) or (isinstance(limit, int) and inst is not None and inst <= limit):
    issues.append('expectedMinimumInstances_invalid (must exceed one page)')

if 'submissionPayload' in cfg and not isinstance(cfg['submissionPayload'], dict):
    issues.append('submissionPayload_not_object')

# Schema baseline sanity: submission schema keys, if provided, must be strings.
schema_baseline = cfg.get('expectedSubmissionSchemaKeys')
if schema_baseline is not None and not (isinstance(schema_baseline, list) and all(isinstance(k, str) for k in schema_baseline)):
    issues.append('expectedSubmissionSchemaKeys_invalid')

for i in issues:
    emit(f'CANARY_ISSUE={i}')
ready(not issues)
PYEOF
) || die "validator invocation failed"
printf '%s\n' "$VOUT" | sed 's/^/  /'
CANARY_CONFIG_SHA256=$(printf '%s\n' "$VOUT" | sed -n 's/^CANARY_CONFIG_SHA256=//p' | head -n 1)
printf '%s\n' "$VOUT" | grep -q '^CANARY_PREREQS_READY=YES$' || die "generated canary config FAILED the verbatim combined-runner validator (see issues above)"
log "W7 PASS: config validated by the VERBATIM sealed-runner validator — CANARY_PREREQS_READY=YES"

# ------------------------------------------------------- W8 boundary re-attestation
if grep -q '^AUTH_V1_CANARY_ALLOWED_SUB=' "$WF_ENV" || grep -q '^AUTH_V1_CANARY_ALLOWED_CLIENT_ID=' "$WF_ENV"; then
  die "BOUNDARY VIOLATION DETECTED: allowlist vars present in .env after run — this runner never writes it; manual investigation required"
fi
unset PGPASSWORD CANARY_SECRET CANARY_TOKEN || true
log "W8 PASS: allowlist untouched (absent), zero reloads performed, zero workflow_transition submissions"
log "DONE."
echo ""
echo "================ CANARY PREP V2 SUMMARY ================"
echo "CANARY_INSTANCE_PROVISIONED = YES"
echo "CANARY_INSTANCE_ID = $CANARY_INSTANCE_ID"
echo "CONTROL_INSTANCE_ID = $CONTROL_INSTANCE_ID"
echo "CANARY_AGENT_ID = $CANARY_AGENT_ID (clientId $CANARY_CLIENT_ID, sub $CANARY_PRINCIPAL)"
echo "DOMAIN = workflow-todo-dogfood ($WF_DOMAIN_ID), definition personal_quick_item_v1 ($WF_DEFVER_ID)"
echo "STATE_VERSION = $CANARY_STATE_VERSION ; TRANSITION = advance-to-completed ($CANARY_TRANSITION_ID)"
echo "CANARY_CONFIG = $CANARY_CONFIG"
echo "CANARY_CONFIG_SHA256 = $CANARY_CONFIG_SHA256"
echo "CANARY_TRANSITIONS_EXECUTED = 0"
echo "SVC_WORKFLOW_RELOADS = 0"
echo "ALLOWLIST_SET = NO (verified absent before and after)"
echo "PRODUCTION_CHANGE = CANARY_FIXTURE_ONLY (2 disposable fixture instances via official create endpoint)"
echo "POSTURE: todo-domain listing as canary HTTP=$TODO_PROBE_HTTP / owned-domain listing HTTP=$BIP_PROBE_HTTP (see report BLOCKER-2)"
echo "========================================================="
