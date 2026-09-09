#!/usr/bin/env bash
# OWNER_DOGFOOD.sh — WORKFLOW_DOMAIN_MEMBERS_CONTROL_PLANE_V1 real production dogfood.
#
# RUN AS: Owner (sudo -s, or a shell that can read the 505-private credential
# store). Read the packet README.md first. The script is READ-ONLY against
# the DB (auth_ro) and speaks ONLY to authsvc (4001) + svc-workflow (8989)
# over their official HTTP surfaces — no DB writes, no admin endpoints, no
# run-as/OBO, no UUID guessing.
#
# Identity chain (goal §5; zero DB reads for identity):
#   1. dsh Agent Directory (deployment-side agent-definition config):
#      exact unique display-name match "龙虾合伙人" => canonical agentId.
#      0 matches => IDENTITY_NOT_FOUND; >1 => IDENTITY_AMBIGUOUS. STOP.
#   2. The target's OWN MachineClient credential is exchanged at authsvc
#      (client_credentials, resource=svc-workflow) — the token 'sub' IS the
#      canonical principalId bound by the auth service (verified Auth
#      principal context; this is exactly what the agent's runtime does).
#   3. Bidirectional consistency: authsvc identity directory
#      GET /api/v1/directory/principals/{sub}/agent (audience
#      identity-directory, scope auth.directory.read) must return
#      agentId == the directory match AND principalStatus=active,
#      else STOP (IDENTITY_AMBIGUOUS).
#
# Modes:
#   ./OWNER_DOGFOOD.sh --selftest            # offline, stub endpoints only
#   sudo -s CREDS_FILE=... ./OWNER_DOGFOOD.sh  # real production dogfood
#
# Env (real mode):
#   CREDS_FILE      absolute path of the 505-private credential store JSON
#                   ({"version":1,"credentials":{"<agentId>":{"clientId","clientSecret"}}})
#   AGENTS_FILE     absolute path of the dsh agent-definition config
#                   (default /Users/yanfenma/.agent-core/agents.json)
#   AUTH_ORIGIN     default http://127.0.0.1:4001
#   SVC_ORIGIN      default http://127.0.0.1:8989
#   DOMAIN_ID       default 10000000-0000-0000-0000-000000000100 (Workflow Todo Dogfood)
#   TARGET_NAME     default 龙虾合伙人
#   OWNER_AGENT_ID  default agt_efficiency-agent (the domain's enabled DOMAIN_OWNER)
#   TARGET_AGENT_ID optional override; discovered from TARGET_NAME when absent
#   PG_AUTH_RO      default "auth_ro" (read-only audit verification)
#   Evidence: written to ./wfdm-dogfood-evidence-<ts>/ next to the script.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
MODE="${1:-}"
AUTH_ORIGIN="${AUTH_ORIGIN:-http://127.0.0.1:4001}"
SVC_ORIGIN="${SVC_ORIGIN:-http://127.0.0.1:8989}"
DOMAIN_ID="${DOMAIN_ID:-10000000-0000-0000-0000-000000000100}"
TARGET_NAME="${TARGET_NAME:-龙虾合伙人}"
OWNER_AGENT_ID="${OWNER_AGENT_ID:-agt_efficiency-agent}"
AGENTS_FILE="${AGENTS_FILE:-/Users/yanfenma/.agent-core/agents.json}"
PG_AUTH_RO="${PG_AUTH_RO:-auth_ro}"
AUTH_RO_DB="${AUTH_RO_DB:-svc_workflow_dogfood_clean}"
PASS=(); FAIL=()
ok()   { PASS+=("$1"); echo "PASS $1"; }
bad()  { FAIL+=("$1"); echo "FAIL $1"; }
die()  { echo "STOP: $1"; exit 2; }

b64url_payload() { python3 -c "
import base64, json, sys
p = sys.argv[1].split('.')[1]
p += '=' * (-len(p) % 4)
print(json.loads(base64.urlsafe_b64decode(p))['sub'])
" "$1"; }

curl_json() { # method url token data -> body; status in REPLY_STATUS (no local: called at script level)
  CURLJSON_M="$1"; CURLJSON_URL="$2"; CURLJSON_TOK="$3"; CURLJSON_DATA="${4:-}"
  if [[ -n "$CURLJSON_DATA" ]]; then
    REPLY_BODY=$(curl -s -X "$CURLJSON_M" -H "Authorization: Bearer $CURLJSON_TOK" -H "Content-Type: application/json" -H "Idempotency-Key: ${IDEM_KEY:-x}" -d "$CURLJSON_DATA" -w $'\n%{http_code}' "$CURLJSON_URL")
  else
    REPLY_BODY=$(curl -s -X "$CURLJSON_M" -H "Authorization: Bearer $CURLJSON_TOK" -w $'\n%{http_code}' "$CURLJSON_URL")
  fi
  REPLY_STATUS="${REPLY_BODY##*$'\n'}"
  REPLY_BODY="${REPLY_BODY%$'\n'*}"
}

mint() { # client_id client_secret resource scopes -> token
  curl -s -X POST "$AUTH_ORIGIN/oauth/token" -u "$1:$2" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "grant_type=client_credentials" \
    --data-urlencode "resource=$3" \
    --data-urlencode "scope=$4" | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])"
}

# ─── selftest: run the whole flow against the offline stub stack ────────────
if [[ "$MODE" == "--selftest" ]]; then
  echo "== OFFLINE SELFTEST (stub auth/svc; no production contact) =="
  AUTH_ORIGIN="http://127.0.0.1:$((RANDOM % 20000 + 30000))"
  SVC_ORIGIN="$AUTH_ORIGIN"
  python3 "$HERE/selftest-stub.py" "${AUTH_ORIGIN#http://127.0.0.1:}" >/dev/null 2>&1 &
  STUB_PID=$!
  trap 'kill $STUB_PID 2>/dev/null' EXIT
  for _ in $(seq 1 40); do curl -sf "$SVC_ORIGIN/version" >/dev/null 2>&1 && break; sleep 0.2; done
  curl -sf "$SVC_ORIGIN/version" >/dev/null || { echo "stub failed to boot"; exit 1; }
  # credentials for the stub are synthetic but the flow is identical
  OWNER_CLIENT="agt_efficiency-agent" OWNER_SECRET="stub-owner"
  TARGET_CLIENT="agt_ceo-agent" TARGET_SECRET="stub-lobster"
  TARGET_AGENT_ID="agt_ceo-agent"
  STUB_MODE=YES
fi

# ─── real-mode prerequisites ────────────────────────────────────────────────
if [[ "${STUB_MODE:-}" != "YES" ]]; then
  [[ "${CREDS_FILE:-}" != "" ]] || die "CREDS_FILE is required (absolute path of the credential store). Run under sudo -s."
  [[ -r "$CREDS_FILE" ]] || die "CREDS_FILE not readable: $CREDS_FILE"
  [[ -r "$AGENTS_FILE" ]] || die "AGENTS_FILE not readable: $AGENTS_FILE"
  owner_cred=$(python3 -c "
import json,sys
d=json.load(open('$CREDS_FILE'))
c=d['credentials'].get('$OWNER_AGENT_ID') or {}
print(c.get('clientId',''), c.get('clientSecret',''))")
  target_cred=$(python3 -c "
import json,sys
d=json.load(open('$CREDS_FILE'))
c=d['credentials'].get('${TARGET_AGENT_ID:-__discover__}') or {}
print(c.get('clientId',''), c.get('clientSecret',''))")
  OWNER_CLIENT=$(echo "$owner_cred" | cut -d' ' -f1); OWNER_SECRET=$(echo "$owner_cred" | cut -d' ' -f2)
  TARGET_CLIENT=$(echo "$target_cred" | cut -d' ' -f1); TARGET_SECRET=$(echo "$target_cred" | cut -d' ' -f2)
  [[ -n "$OWNER_CLIENT" && -n "$OWNER_SECRET" ]] || die "owner credential ($OWNER_AGENT_ID) not found in CREDS_FILE"
  if [[ "${TARGET_AGENT_ID:-}" == "" || "$TARGET_CLIENT" == "" ]]; then :; fi
fi

EVIDENCE="${EVIDENCE:-$HERE/wfdm-dogfood-evidence-$(date +%Y%m%d-%H%M%S)}${STUB_MODE:+-selftest}"
mkdir -p "$EVIDENCE"
echo "evidence dir: $EVIDENCE"

# ─── [1] svc preflight ───────────────────────────────────────────────────────
curl_json GET "$SVC_ORIGIN/version" ""
echo "$REPLY_BODY" > "$EVIDENCE/00-svc-version.json"
echo "$REPLY_BODY" | grep -q '"service": *"svc-workflow"' && ok "svc /version reachable" || bad "svc /version"

# ─── [2] Phase A: identity discovery (formal chain) ─────────────────────────
if [[ "${STUB_MODE:-}" != "YES" ]]; then
  MATCHES=$(python3 -c "
import json
agents = json.load(open('$AGENTS_FILE')).get('agents', [])
hits = [a for a in agents if a.get('name') == '$TARGET_NAME']
print(json.dumps(hits))")
  echo "$MATCHES" > "$EVIDENCE/10-directory-matches.json"
  N=$(echo "$MATCHES" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
  [[ "$N" == "1" ]] || { [[ "$N" == "0" ]] && die "IDENTITY_NOT_FOUND (directory matches=0)" || die "IDENTITY_AMBIGUOUS (directory matches=$N)"; }
  TARGET_AGENT_ID=$(echo "$MATCHES" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])")
  DISABLED=$(echo "$MATCHES" | python3 -c "import json,sys; print(json.load(sys.stdin)[0].get('disabled', False))")
  [[ "$DISABLED" == "False" ]] || die "IDENTITY_NOT_FOUND (directory entry disabled)"
  ok "A1 directory exact unique match: $TARGET_NAME => $TARGET_AGENT_ID"
  target_cred=$(python3 -c "
import json
d=json.load(open('$CREDS_FILE'))
c=d['credentials'].get('$TARGET_AGENT_ID') or {}
print(c.get('clientId',''), c.get('clientSecret',''))")
  TARGET_CLIENT=$(echo "$target_cred" | cut -d' ' -f1); TARGET_SECRET=$(echo "$target_cred" | cut -d' ' -f2)
  [[ -n "$TARGET_CLIENT" && -n "$TARGET_SECRET" ]] || die "target credential ($TARGET_AGENT_ID) not found in CREDS_FILE"
else
  ok "A1 directory match (stub fixed): $TARGET_AGENT_ID"
fi

OWNER_TOKEN=$(mint "$OWNER_CLIENT" "$OWNER_SECRET" "svc-workflow" "workflow.read workflow.execute")
[[ -n "$OWNER_TOKEN" ]] || die "owner token mint failed"
LOBSTER_TOKEN=$(mint "$TARGET_CLIENT" "$TARGET_SECRET" "svc-workflow" "workflow.read workflow.execute")
[[ -n "$LOBSTER_TOKEN" ]] || die "target token mint failed"
LOBSTER_SUB=$(b64url_payload "$LOBSTER_TOKEN")
echo "$LOBSTER_SUB" > "$EVIDENCE/11-canonical-principal-id.txt"
ok "A2 canonical principalId from target's own credential (token sub): $LOBSTER_SUB"

DIR_TOKEN=$(mint "$TARGET_CLIENT" "$TARGET_SECRET" "identity-directory" "auth.directory.read")
curl_json GET "$AUTH_ORIGIN/api/v1/directory/principals/$LOBSTER_SUB/agent" "$DIR_TOKEN"
echo "$REPLY_BODY" > "$EVIDENCE/12-directory-reverse-proof.json"
echo "$REPLY_BODY" | python3 -c "
import json,sys
d = json.load(sys.stdin)
assert d.get('agentId') == '$TARGET_AGENT_ID', d
assert d.get('principalStatus') == 'active', d
" && ok "A3 authsvc directory reverse-proof: sub <=> $TARGET_AGENT_ID (active)" || die "IDENTITY_AMBIGUOUS (reverse proof failed: $REPLY_BODY)"

# ─── [3] Phase B: owner-side membership operations (wire contract) ──────────
MEMBERS_URL="$SVC_ORIGIN/internal/v1/domains/$DOMAIN_ID/members"
curl_json GET "$MEMBERS_URL" "$OWNER_TOKEN"
echo "$REPLY_BODY" > "$EVIDENCE/20-b1-members-baseline.json"
echo "$REPLY_BODY" | grep -q '"items"' && ok "B1 list baseline" || bad "B1 list baseline"
BEFORE_HITS=$(echo "$REPLY_BODY" | python3 -c "
import json,sys
print(sum(1 for i in json.load(sys.stdin)['items'] if i['principal_id'] == '$LOBSTER_SUB'))")

IDEM_KEY="wfdm-dogfood-add-$(date +%s)-1"
curl_json PUT "$MEMBERS_URL/$LOBSTER_SUB" "$OWNER_TOKEN" '{}'
echo "$REPLY_BODY" > "$EVIDENCE/21-b2-add.json"
if [[ "$BEFORE_HITS" == "0" ]]; then
  [[ "$REPLY_STATUS" == "200" ]] && echo "$REPLY_BODY" | grep -qE '"role": *"DOMAIN_MEMBER"' \
    && ok "B2 add => 200 DOMAIN_MEMBER" || bad "B2 add (status=$REPLY_STATUS body=$REPLY_BODY)"
else
  [[ "$REPLY_STATUS" == "409" ]] && echo "$REPLY_BODY" | grep -q 'already_member' \
    && ok "B2 re-run observed already_member (binding persisted from an earlier run)" || bad "B2 add (status=$REPLY_STATUS)"
fi

IDEM_KEY="wfdm-dogfood-list-$(date +%s)"
curl_json GET "$MEMBERS_URL" "$OWNER_TOKEN"
echo "$REPLY_BODY" > "$EVIDENCE/22-b3-members-after.json"
HITS=$(echo "$REPLY_BODY" | python3 -c "
import json,sys
print(sum(1 for i in json.load(sys.stdin)['items'] if i['principal_id'] == '$LOBSTER_SUB'))")
[[ "$HITS" == "1" ]] && ok "B3 target listed exactly once" || bad "B3 hits=$HITS"

IDEM_KEY="wfdm-dogfood-add-$(date +%s)-2"
curl_json PUT "$MEMBERS_URL/$LOBSTER_SUB" "$OWNER_TOKEN" '{}'
echo "$REPLY_BODY" > "$EVIDENCE/23-b4-duplicate.json"
[[ "$REPLY_STATUS" == "409" ]] && echo "$REPLY_BODY" | grep -qE '"code": *"already_member"' \
  && ok "B4 new-key duplicate => 409 already_member" || bad "B4 (status=$REPLY_STATUS body=$REPLY_BODY)"

IDEM_KEY="wfdm-dogfood-add-$(date +%s)-1"
curl_json PUT "$MEMBERS_URL/$LOBSTER_SUB" "$OWNER_TOKEN" '{}'
echo "$REPLY_BODY" > "$EVIDENCE/24-b5-replay.json"
[[ "$REPLY_BODY" == "$(cat "$EVIDENCE/21-b2-add.json")" ]] \
  && ok "B5 same-key replay byte-identical to B2" || bad "B5 replay differs"

IDEM_KEY="wfdm-dogfood-deleg-$(date +%s)"
curl_json PUT "$MEMBERS_URL/$LOBSTER_SUB" "$OWNER_TOKEN" '{"role":"DOMAIN_OWNER"}'
echo "$REPLY_BODY" > "$EVIDENCE/25-b6-delegation-forbidden.json"
[[ "$REPLY_STATUS" == "403" ]] && echo "$REPLY_BODY" | grep -qE '"code": *"domain_owner_delegation_forbidden"' \
  && ok "B6 role=DOMAIN_OWNER => 403 domain_owner_delegation_forbidden (single-owner invariant)" || bad "B6 (status=$REPLY_STATUS body=$REPLY_BODY)"

if [[ "${STUB_MODE:-}" != "YES" ]]; then
  AUDITS=$(PGPASSWORD="${PGPASSWORD_AUTH_RO:-}" psql -h localhost -U "$PG_AUTH_RO" -d "$AUTH_RO_DB" -t -A -c \
    "SELECT count(*) FROM workflow_security_audits WHERE action='member_added' AND resource_id='$DOMAIN_ID/$LOBSTER_SUB';" 2>/dev/null || echo "query-failed")
else
  AUDITS="stub" # audit-table mechanics verified against a real DB in the local E2E
fi
echo "$AUDITS" > "$EVIDENCE/26-audit-count.txt"
if [[ "$AUDITS" == "stub" ]]; then
  ok "B7 audit check: skipped in selftest (real-DB audit evidence: local E2E audit-count.json)"
elif [[ "$BEFORE_HITS" == "0" ]]; then
  [[ "$AUDITS" == "1" ]] && ok "B7 audit: exactly 1 member_added row for the real grant" || bad "B7 audit rows=$AUDITS"
else
  [[ "$AUDITS" =~ ^[0-9]+$ ]] && ok "B7 audit rows=$AUDITS (binding pre-existed; +0 fabricated this run)" || bad "B7 audit query failed"
fi

# ─── [4] Phase C: target-agent reads in ITS OWN context ─────────────────────
curl_json GET "$SVC_ORIGIN/internal/v1/principals/me/domains" "$LOBSTER_TOKEN"
echo "$REPLY_BODY" > "$EVIDENCE/30-c1-lobster-my-domains.json"
echo "$REPLY_BODY" | python3 -c "
import json,sys
items = json.load(sys.stdin)['items']
mine = [i for i in items if i['domain_id'] == '$DOMAIN_ID']
assert len(mine) == 1 and mine[0]['caller_role'] == 'DOMAIN_MEMBER', items
" && ok "C1 lobster my_domains: dogfood domain visible as DOMAIN_MEMBER" || bad "C1"

# C2: owner authors a minimal V2 task assigned to the lobster and creates an instance.
DEFS_URL="$SVC_ORIGIN/internal/v1/domains/$DOMAIN_ID/definitions"
DEF_KEY="wfdm-dogfood-$(date +%s)"
IDEM_KEY="wfdm-dogfood-def-$(date +%s)-1"
curl_json POST "$DEFS_URL" "$OWNER_TOKEN" "{\"definitionKey\":\"$DEF_KEY\",\"displayName\":\"龙虾合伙人 dogfood 任务\"}"
echo "$REPLY_BODY" > "$EVIDENCE/31-c2a-create-definition.json"
DEF_ID=$(echo "$REPLY_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin)['workflowDefinitionId'])" 2>/dev/null)
[[ -n "$DEF_ID" ]] && ok "C2a definition created" || bad "C2a ($REPLY_BODY)"
IDEM_KEY="wfdm-dogfood-def-$(date +%s)-2"
curl_json POST "$DEFS_URL/$DEF_ID/versions" "$OWNER_TOKEN" '{"semanticModelVersion":2}'
echo "$REPLY_BODY" > "$EVIDENCE/32-c2b-draft.json"
VER_ID=$(echo "$REPLY_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin)['definitionVersionId'])" 2>/dev/null)
[[ -n "$VER_ID" ]] && ok "C2b draft version created" || bad "C2b ($REPLY_BODY)"
IDEM_KEY="wfdm-dogfood-def-$(date +%s)-3"
curl_json PUT "$DEFS_URL/$DEF_ID/draft" "$OWNER_TOKEN" "{\"definitionVersionId\":\"$VER_ID\",\"nodes\":[{\"node_key\":\"task\",\"display_name\":\"龙虾任务\",\"order_index\":0,\"node_type\":\"NORMAL\",\"assignee_ref_type\":\"FIXED_PRINCIPAL\",\"fixed_principal_id\":\"$LOBSTER_SUB\"},{\"node_key\":\"done\",\"display_name\":\"完成\",\"order_index\":1,\"node_type\":\"TERMINAL\"}],\"transitions\":[{\"transition_key\":\"finish\",\"display_name\":\"完成\",\"source_node_key\":\"task\",\"target_node_key\":\"done\",\"transition_effect\":\"ADVANCE\"}]}"
echo "$REPLY_BODY" > "$EVIDENCE/33-c2c-graph.json"
echo "$REPLY_BODY" | grep -q '"ok"\|DRAFT\|status' && ok "C2c graph replaced" || bad "C2c ($REPLY_BODY)"
IDEM_KEY="wfdm-dogfood-def-$(date +%s)-4"
curl_json POST "$DEFS_URL/$DEF_ID/publish" "$OWNER_TOKEN" "{\"versionId\":\"$VER_ID\"}"
echo "$REPLY_BODY" > "$EVIDENCE/34-c2d-publish.json"
echo "$REPLY_BODY" | grep -q 'PUBLISHED' && ok "C2d published" || bad "C2d ($REPLY_BODY)"
IDEM_KEY="wfdm-dogfood-inst-$(date +%s)"
curl_json POST "$SVC_ORIGIN/internal/v1/workflow-instances" "$OWNER_TOKEN" "{\"domainId\":\"$DOMAIN_ID\",\"definitionVersionId\":\"$VER_ID\",\"contextPayload\":{},\"metadata\":null}"
echo "$REPLY_BODY" > "$EVIDENCE/35-c2e-instance.json"
INSTANCE_ID=$(echo "$REPLY_BODY" | python3 -c "import json,sys; print(json.load(sys.stdin)['workflowInstanceId'])" 2>/dev/null)
[[ -n "$INSTANCE_ID" ]] && ok "C2e instance created: $INSTANCE_ID" || bad "C2e ($REPLY_BODY)"

curl_json GET "$SVC_ORIGIN/internal/v1/worklists/assigned-to-me?limit=20" "$LOBSTER_TOKEN"
echo "$REPLY_BODY" > "$EVIDENCE/36-c3-lobster-my-tasks.json"
echo "$REPLY_BODY" | grep -q "$INSTANCE_ID" && ok "C3 lobster worklist contains the instance" || bad "C3"
curl_json GET "$SVC_ORIGIN/internal/v1/workflow-instances/$INSTANCE_ID" "$LOBSTER_TOKEN"
echo "$REPLY_BODY" > "$EVIDENCE/37-c4-lobster-detail.json"
echo "$REPLY_BODY" | python3 -c "
import json,sys
d = json.load(sys.stdin)
assert d.get('visibility') == 'full', d.get('visibility')
assert d['detail']['current_visit']['assignee_principal_id'] == '$LOBSTER_SUB', d['detail'].get('current_visit')
" && ok "C4 lobster instance_detail: full visibility, assignee = lobster" || bad "C4"

# ─── verdict ────────────────────────────────────────────────────────────────
echo
echo "== DOGFOOD RESULT: ${#PASS[@]} PASS / ${#FAIL[@]} FAIL =="
printf '%s\n' "${PASS[@]}" > "$EVIDENCE/pass.txt"
: > "$EVIDENCE/fail.txt"
if [[ "${#FAIL[@]}" != "0" ]]; then printf '%s\n' "${FAIL[@]}" >> "$EVIDENCE/fail.txt"; fi
[[ "${#FAIL[@]}" == "0" ]] && { echo "WORKFLOW_DOMAIN_MEMBERS_CONTROL_PLANE_V1 DOGFOOD = PASS"; exit 0; }
echo "DOGFOOD = FAIL (see $EVIDENCE/fail.txt)"; exit 1
