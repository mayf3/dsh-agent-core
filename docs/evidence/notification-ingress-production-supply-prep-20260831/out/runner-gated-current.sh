#!/bin/bash
# shellcheck disable=SC2317
#
# ============================================================================
# PRE-REVIEW DRAFT production runner — Agent Core Notification Ingress audience
# deploy + svc-forum / svc-workflow service credential + Grant supply.
# NOT AUTHORIZED FOR APPLY until every authority gate below is accepted/merged
# and MAIN_SHA is re-frozen by independent implementation review.
#
# AUTHORITY CHAIN (frozen at authoring 2026-08-30):
#   Phase A (audience + binary deploy):
#     - AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1 (accepted)
#       -> CTR-NI-001 exact Audience entry; CTR-NI-005 versioned registry delta.
#     - AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V2
#       (accepted, implementation_authority: contracts) -> exact 16-file closure,
#       merged at github/main 7110463 via PR #29 (Bundle 1.3.0 -> 1.4.0).
#   Phase B (two service principals + two dedicated clients + two exact Grants):
#     - AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_SERVICE_CREDENTIAL_GRANT_V1
#       (at authoring: PROPOSED, PR #28 OPEN/DRAFT, NOT merged). Phase B apply is
#       GATED: it refuses unless that Spec file is present in the deployed tree
#       with frontmatter status: accepted AND implementation_authority:
#       contracts. Until PR #28 is accepted + merged (and this runner's MAIN_SHA
#       pin re-frozen by independent review), Phase B reports GATED and performs
#       zero writes.
#
# SEMANTICS (mirrors accepted operator precedents + proposed spec §10):
#   --plan (default)  read-only, zero writes, full precondition report
#   --apply           execute (root + confirm phrase outside sandbox)
#   --verify          read-only post-state verification (+ secret/dest match)
#   Idempotent: exact rerun = NOOP (zero writes, zero secret regeneration).
#   Conflict: any unexpected pre-existing state = refuse + zero writes.
#   Auto-rollback: failure after the first Phase A write restores the previous
#   launchd target and compensates the DB row; Phase B failures roll back
#   per-caller transactions and never fake the other caller's outcome.
#   Secrets: raw secret lives only in process memory and the one destination
#   file; never in stdout/stderr/report/DB (scrypt "salt:hash" only in DB).
#
# Exit codes: 0 success / already-applied | 1 rolled back | 2 zero-write
#   refused (including an unaccepted Phase B authority gate or conflict) |
#   4 rollback/compensation incomplete or OUTCOME_UNKNOWN | 5 partial (>=1
#   caller committed AND >=1 caller refused).
#
# SANDBOX: NI_SANDBOX=1 switches ALL coordinates to sandbox values (NI_* env).
# No production path is touched in sandbox mode.
# ============================================================================
set -Eeuo pipefail
umask 077

# ---------------------------------------------------------------- frozen ----
MAIN_SHA='7110463636693b3c2eced9d97ccb186adf46907d'
PROD_SHA='0855dc5161309196ef0cddbf9142e22726961956'
REPO='/Users/yanfenma/workspace/project/auth-service'
REMOTE='github'
PROD_DEPLOY_DIR='/Users/yanfenma/workspace/project/production-auth-service-3b2ae71c'
NEW_DEPLOY_DIR='/Users/yanfenma/workspace/project/production-auth-service-7110463'
PLIST='/Library/LaunchDaemons/com.auth-service.plist'
LAUNCHD_LABEL='com.auth-service'
HEALTH_URL='http://127.0.0.1:4001/api/health'
PROD_CONTRACT_VERSION='1.3.0'
PROD_CONTRACT_DIGEST='15f9a591e25fb1dca99c2a02d8362c83e41f4a932ca0710d97a602e18a8234ad'
NODE_BIN='/usr/local/bin/node'
PSQL_BIN='/usr/local/bin/psql'
AUTHSVC_USER='authsvc'
AUTHSVC_ENV_FILE="${PROD_DEPLOY_DIR}/.env"     # authsvc-owned; sourced only by an authsvc shell
AUTH_RO_USER='auth_ro'
AUTH_RO_DB='agent_dev_center'
# Protected read-only seam. The credential remains in the owner's 0600 pgpass;
# this runner contains and prints no database password.
AUTH_RO_PGPASSFILE='/Users/yanfenma/.pgpass'

AUDIENCE_ID='agent-core-notification-ingress-v1'
SPEC_FILE='docs/specs/AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_SERVICE_CREDENTIAL_GRANT_V1.md'
CCR_FILE='docs/specs/AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1.md'
CLOSURE_FILE='docs/specs/AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_IMPLEMENTATION_CLOSURE_V2.md'

# exact Audience row per merged registry entry (PR #29, CTR-NI-001)
AUD_RESOURCE='agent-core-notification-ingress-v1'
AUD_NAMESPACE='notification'
AUD_PRINCIPAL_TYPES='service'
AUD_SCOPES='notification.deliver'
AUD_HUMAN='false'; AUD_MACHINE='true'; AUD_DELEGATED='false'
AUD_STATUS='active'; AUD_FREEZE='true'; AUD_VERSION='1'

# frozen non-target baseline: exactly these 5 rows, field-by-field
BASELINE_ROWS='adc-v2|adc-v2|adc|agent|adc.execute,adc.read|false|true|false|active|true|1
svc-auth|svc-auth|auth|service|auth.identity.provision|false|true|false|active|true|1
svc-forum|svc-forum|forum|agent|forum.read,forum.write|false|true|false|active|true|1
svc-okr|svc-okr|okr|user,agent|okr.read,okr.write|true|true|false|active|true|1
svc-workflow|svc-workflow|workflow|agent|workflow.admin,workflow.execute,workflow.read|false|true|true|active|true|1'

# two callers (proposed spec §9; public identifiers, safe to freeze)
FORUM_CLIENT_ID='mc_Ez8kTAKKvcf2pF40aoUM4q9M'
WORKFLOW_CLIENT_ID='mc_uYu1fDfNHjzUlRQGJdTajz9n'
FORUM_PRINCIPAL_EXT='service:v1:principal:svc-forum'
WORKFLOW_PRINCIPAL_EXT='service:v1:principal:svc-workflow'
FORUM_CLIENT_EXT='service:v1:client:svc-forum:agent-core-notification-ingress-v1'
WORKFLOW_CLIENT_EXT='service:v1:client:svc-workflow:agent-core-notification-ingress-v1'
FORUM_DISPLAY='svc-forum service'
WORKFLOW_DISPLAY='svc-workflow service'
WORKFLOW_ENV_FILE='/Users/yanfenma/.local/services/svc-workflow/.env'
FORUM_ENV_FILE='/Users/yanfenma/.local/services/svc-forum/notification-ingress.env'
CLIENT_ID_KEY='AUTH_NOTIFICATION_INGRESS_CLIENT_ID'
CLIENT_SECRET_KEY='AUTH_NOTIFICATION_INGRESS_CLIENT_SECRET'

GRANT_MIGRATION_ID='notification-ingress-service-credential-supply-v1'
AUDIENCE_EVENT_TYPE='audience.registered'
AUDIENCE_MIGRATION_ID='notification-ingress-v1-audience-supply'
AUDIENCE_ROLLBACK_EVENT='audience.registration_rolled_back'
OPERATOR_ID='owner-run'
APPROVAL_REF='AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_SERVICE_CREDENTIAL_GRANT_V1'
SUPPLY_REASON='supply svc-forum/svc-workflow notification ingress caller credentials'

ADVISORY_LOCK_AUDIENCE=813947206   # distinct from 201/202/203/204/205
ADVISORY_LOCK_CALLER=813947205     # frozen by proposed spec §10

CONFIRM_PHRASE='APPLY AUTHSVC_NOTIFICATION_INGRESS_SUPPLY_7110463_V1'

# ------------------------------------------------------------- sandbox -------
SANDBOX=0
[ "${NI_SANDBOX:-0}" = '1' ] && SANDBOX=1
if [ "$SANDBOX" -eq 1 ]; then
  REPO="${NI_REPO:-$REPO}"
  REMOTE="${NI_REMOTE:-$REMOTE}"
  PROD_DEPLOY_DIR="${NI_PROD_DIR:-/tmp/ni-sandbox/prod-deploy}"
  NEW_DEPLOY_DIR="${NI_NEW_DIR:-/tmp/ni-sandbox/new-deploy}"
  PLIST="${NI_PLIST:-/tmp/ni-sandbox/plist/com.auth-service.test.plist}"
  HEALTH_URL="${NI_HEALTH:-http://127.0.0.1:45401/api/health}"
  AUTH_RO_PG_PASSWORD="${NI_DB_PASSWORD:-postgres}"
  AUTH_RO_DB="${NI_DB_NAME:-agent_dev_center}"
  NI_DB_URL="${NI_DB_URL:-}"
  NI_STUB_DIR="${NI_STUB_DIR:-/tmp/ni-sandbox/stub}"
  LOCK_DIR="${NI_LOCK_DIR:-/tmp/ni-sandbox/lock}"
  FORUM_ENV_FILE="${NI_FORUM_ENV:-$FORUM_ENV_FILE}"
  WORKFLOW_ENV_FILE="${NI_WF_ENV:-$WORKFLOW_ENV_FILE}"
else
  LOCK_DIR='/var/run/authsvc-ni-supply-7110463.lock'
fi

# ---------------------------------------------------------------- state -----
MODE='plan'; CONFIRM=''; APPLY=0
LOCK_HELD=0; DEPLOY_ARMED=0; DEPLOY_COMMITTED=0; ROLLBACK_ACTIVE=0
AUDIENCE_INSERTED_BY_RUN=0
TS="$(date -u +%Y%m%dT%H%M%SZ)"
SQLDIR="$(mktemp -d -t ni-supply-sql)"   # 0700; SQL files only (no raw secrets)
PLIST_BAK="${PLIST}.bak-ni-supply-${TS}"
SCRATCH_DEPLOY_CREATED=0
NEW_RUNTIME_DIGEST='not-built'
FORUM_OUTCOME='NOT_RUN'; WORKFLOW_OUTCOME='NOT_RUN'
PHASE_B_AUTHORITY='UNKNOWN'; P2_STATE=''; P3_AUDIENCE_STATE=''

log() { printf '%s\n' "$*"; }
fail() { log "ERROR: $*" >&2; exit 2; }
fail_incomplete() { log "ERROR: $*" >&2; exit 4; }

usage() {
  cat <<'EOF'
Usage:
  plan (default):  bash /tmp/run-authsvc-ni-supply-7110463-v1.sh
  apply:           sudo bash /tmp/run-authsvc-ni-supply-7110463-v1.sh --apply \
                       --confirm 'APPLY AUTHSVC_NOTIFICATION_INGRESS_SUPPLY_7110463_V1'
  verify:          bash /tmp/run-authsvc-ni-supply-7110463-v1.sh --verify
No secret is printed by this runner. Sandbox: NI_SANDBOX=1 (sandbox never
touches production coordinates).
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1; MODE='apply'; shift ;;
    --verify) MODE='verify'; shift ;;
    --plan) MODE='plan'; shift ;;
    --confirm) [ "$#" -ge 2 ] || fail '--confirm requires a phrase'; CONFIRM="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "unsupported argument: $1" ;;
  esac
done

# Read-only modes do not need the privileged apply lock. Keep their ephemeral
# lock per-user so owner plan/verify can run without sudo; apply still uses
# /var/run and therefore cannot race another production apply.
if [ "$SANDBOX" -ne 1 ] && [ "$APPLY" -eq 0 ]; then
  LOCK_DIR="${TMPDIR:-/tmp}/authsvc-ni-supply-7110463-${UID}.lock"
fi

[ "$SANDBOX" -eq 1 ] && log '>>> SANDBOX MODE (NI_SANDBOX=1): all coordinates sandbox-overridden; production untouched.'
if [ "$APPLY" -eq 1 ]; then
  [ "$CONFIRM" = "$CONFIRM_PHRASE" ] || fail 'confirmation phrase mismatch'
  if [ "$SANDBOX" -ne 1 ]; then
    [ "$(id -u)" -eq 0 ] || fail 'apply must run as root (sudo) outside sandbox'
    [ -z "${NI_DB_URL:-}" ] || fail 'NI_DB_URL must not be set outside sandbox'
  fi
fi

cleanup() {
  set +e
  rm -rf -- "$SQLDIR" 2>/dev/null
  if [ "$SCRATCH_DEPLOY_CREATED" -eq 1 ] && [ "$DEPLOY_COMMITTED" -eq 0 ]; then
    if [ "$SANDBOX" -eq 1 ]; then
      git -C "$REPO" worktree remove --force "$NEW_DEPLOY_DIR" 2>/dev/null
    else
      sudo -n -u yanfenma git -C "$REPO" worktree remove --force "$NEW_DEPLOY_DIR" 2>/dev/null
    fi
  fi
  if [ "$LOCK_HELD" -eq 1 ]; then rmdir "$LOCK_DIR" 2>/dev/null; fi
  return 0
}
trap 'cleanup' EXIT
trap 'exit 129' HUP; trap 'exit 130' INT; trap 'exit 143' TERM

mkdir -m 700 -p "$(dirname "$LOCK_DIR")" 2>/dev/null || true
mkdir -m 700 "$LOCK_DIR" 2>/dev/null || fail 'another supply run is active or stale lock requires review'
LOCK_HELD=1

# ------------------------------------------------------------ db helpers -----
ro_query() { # $1 = SQL (read-only seam)
  if [ "$SANDBOX" -eq 1 ]; then
    [ -n "$NI_DB_URL" ] || fail 'sandbox requires NI_DB_URL'
    PGPASSWORD="$AUTH_RO_PG_PASSWORD" "$PSQL_BIN" "$NI_DB_URL" -t -A -F'|' -c "$1"
  else
    [ -f "$AUTH_RO_PGPASSFILE" ] || fail "protected auth_ro pgpass missing: $AUTH_RO_PGPASSFILE"
    PGPASSFILE="$AUTH_RO_PGPASSFILE" "$PSQL_BIN" -h localhost -U "$AUTH_RO_USER" -d "$AUTH_RO_DB" -t -A -F'|' -c "$1"
  fi
}
rw_sql_file() { # $1 = SQL file; production executes as the authsvc service
               # account sourcing its private .env in-process (DATABASE_URL is
               # never printed and never enters this runner's environment)
  if [ "$SANDBOX" -eq 1 ]; then
    [ -n "$NI_DB_URL" ] || fail 'sandbox requires NI_DB_URL'
    "$PSQL_BIN" "$NI_DB_URL" -v ON_ERROR_STOP=1 -q -f "$1"
  else
    sudo -n -u "$AUTHSVC_USER" /bin/sh -c \
      "set -a && . '$AUTHSVC_ENV_FILE' && set +a && exec '$PSQL_BIN' \"\$DATABASE_URL\" -v ON_ERROR_STOP=1 -q -f '$1'"
  fi
}
node_js() { "$NODE_BIN" -e "$1"; }

# scrypt hashing byte-identical to src/lib/oauth/secret.ts (N=16384, r=8, p=1,
# dklen=64, 16-byte hex salt). Prints "salt:hash" then the raw secret.
generate_pair() {
  node_js '
    const crypto = require("crypto");
    const secret = crypto.randomBytes(32).toString("base64url");
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(secret, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
    process.stdout.write(salt + ":" + hash + "\n" + secret + "\n");
  '
}
scrypt_verify() { # $1 secret, $2 stored salt:hash -> 0 iff match
  SEC="$1" STORED="$2" node_js '
    const crypto = require("crypto");
    const stored = process.env.STORED, secret = process.env.SEC;
    const i = stored.indexOf(":");
    if (i < 0) process.exit(2);
    const got = crypto.scryptSync(secret, stored.slice(0, i), 64, { N: 16384, r: 8, p: 1 }).toString("hex");
    const a = Buffer.from(got, "hex"), b = Buffer.from(stored.slice(i + 1), "hex");
    process.exit(a.length === b.length && crypto.timingSafeEqual(a, b) ? 0 : 1);
  '
}

# ------------------------------------------------------- P1 git authority ---
p1_git_authority() {
  log '== P1 git authority =='
  [ -d "$REPO/.git" ] || fail "repo checkout not found: $REPO"
  git -C "$REPO" fetch "$REMOTE" --quiet || fail "git fetch $REMOTE failed"
  local head; head="$(git -C "$REPO" rev-parse "$REMOTE/main")"
  [ "$head" = "$MAIN_SHA" ] || fail "github/main drift: $head != frozen $MAIN_SHA (re-freeze via independent review)"

  local reg
  reg="$(git -C "$REPO" show "$MAIN_SHA:contract-bundles/minimal-auth-v1/audience-registry.json")" || fail 'registry file missing at MAIN_SHA'
  printf '%s' "$reg" | "$NODE_BIN" -e '
    const fs = require("fs");
    const reg = JSON.parse(fs.readFileSync(0, "utf8"));
    const e = (reg.audiences || []).find((a) => a.audience_id === "agent-core-notification-ingress-v1");
    if (!e) { console.error("registry entry missing"); process.exit(1); }
    if (reg.registry_version !== "1.4.0") { console.error("registry_version != 1.4.0"); process.exit(1); }
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    if (e.resource_service !== "agent-core-notification-ingress-v1") { console.error("resource_service"); process.exit(1); }
    if (e.scope_namespace !== "notification") { console.error("scope_namespace"); process.exit(1); }
    if (!eq(e.accepted_principal_types, ["service"])) { console.error("accepted_principal_types"); process.exit(1); }
    if (!eq(e.registered_scopes, ["notification.deliver"])) { console.error("registered_scopes"); process.exit(1); }
    if (e.human_access_enabled !== false) { console.error("human_access_enabled"); process.exit(1); }
    if (e.machine_access_enabled !== true) { console.error("machine_access_enabled"); process.exit(1); }
    if (e.delegated_access_enabled !== false) { console.error("delegated_access_enabled"); process.exit(1); }
    if (e.status !== "active" || e.freeze_ready !== true) { console.error("status/freeze_ready"); process.exit(1); }
  ' || fail 'registry entry at MAIN_SHA differs from frozen CTR-NI-001 values'
  log 'P1_REGISTRY_ENTRY=EXACT registry_version=1.4.0 audiences=6'

  git -C "$REPO" show "$MAIN_SHA:contract-bundles/minimal-auth-v1/validate.mjs" | grep "'agent-core-notification-ingress-v1'" >/dev/null \
    || fail 'validate.mjs first-wave Audience set missing the NI audience at MAIN_SHA'

  git -C "$REPO" show "$MAIN_SHA:$CCR_FILE" 2>/dev/null | grep '^status: accepted' >/dev/null || fail 'audience CCR not accepted at MAIN_SHA'
  git -C "$REPO" show "$MAIN_SHA:$CLOSURE_FILE" 2>/dev/null | grep '^status: accepted' >/dev/null || fail 'closure V2 not accepted at MAIN_SHA'
  log 'P1_PHASE_A_AUTHORITY=ACCEPTED (CCR accepted + closure V2 accepted at MAIN_SHA)'

  local spec
  spec="$(git -C "$REPO" show "$MAIN_SHA:$SPEC_FILE" 2>/dev/null)" || true
  if [ -z "$spec" ]; then
    PHASE_B_AUTHORITY='ABSENT_FROM_TREE'
  elif printf '%s\n' "$spec" | grep '^status: accepted' >/dev/null && printf '%s\n' "$spec" | grep '^implementation_authority: contracts' >/dev/null; then
    PHASE_B_AUTHORITY='ACCEPTED_IN_TREE'
  else
    PHASE_B_AUTHORITY='NOT_ACCEPTED_IN_TREE'
  fi
  log "P1_PHASE_B_AUTHORITY=$PHASE_B_AUTHORITY (file: $SPEC_FILE)"
}

# ---------------------------------------------------- P2 production state ---
health_get() { curl -s --max-time 4 "$HEALTH_URL" || true; }

p2_production_state() {
  log '== P2 production state =='
  local body ver dig
  body="$(health_get)"; [ -n "$body" ] || fail 'auth-service health endpoint unreachable'
  [ "$(printf '%s' "$body" | sed -n 's/.*"ok":\([a-z]*\).*/\1/p')" = 'true' ] || fail "auth-service health not ok: $body"
  ver="$(printf '%s' "$body" | sed -n 's/.*"authContractVersion":"\([^"]*\)".*/\1/p')"

  if [ "$SANDBOX" -ne 1 ]; then
    local dir
    dir="$("$NODE_BIN" -e 'const fs=require("fs");const t=fs.readFileSync(process.argv[1],"utf8");const m=t.match(/<string>(\/Users\/[^<]*auth-service[^<]*)<\/string>/);console.log(m?m[1]:"")' "$PLIST" 2>/dev/null || true)"
    case "$dir" in
      "$PROD_DEPLOY_DIR"*) log "P2_DEPLOY_DIR=$dir (current production)" ;;
      "$NEW_DEPLOY_DIR"*) log "P2_DEPLOY_DIR=$dir (already at target)" ;;
      *) fail "launchd plist does not point at a known deploy dir: $dir" ;;
    esac
  fi

  if [ "$ver" = "$PROD_CONTRACT_VERSION" ]; then
    dig="$(printf '%s' "$body" | sed -n 's/.*"authContractDigest":"\([^"]*\)".*/\1/p')"
    [ "$dig" = "$PROD_CONTRACT_DIGEST" ] || fail "production contract digest drift: $dig"
    log "P2_STATE=AT_PROD version=$ver"
    P2_STATE='AT_PROD'
  elif [ "$ver" = '1.4.0' ]; then
    log 'P2_STATE=ALREADY_1_4_0'
    P2_STATE='ALREADY_APPLIED'
  else
    fail "unexpected authContractVersion: $ver"
  fi
}

# ---------------------------------------------------------- P3 db preflight -
baseline_projection() {
  ro_query "SELECT audience_id,resource_service,scope_namespace,array_to_string(accepted_principal_types,','),array_to_string(registered_scopes,','),human_access_enabled::text,machine_access_enabled::text,delegated_access_enabled::text,status,freeze_ready::text,version::text FROM auth_audiences ORDER BY audience_id;"
}

p3_db_preflight() {
  log '== P3 db preflight (read-only) =='
  local cur want ni_row row expected n
  if [ "$(ro_query "SELECT count(*) FROM auth_audiences WHERE audience_id='$AUDIENCE_ID';")" = '0' ]; then
    cur="$(baseline_projection)"
    want="$(printf '%s\n' "$BASELINE_ROWS")"
    if [ "$cur" != "$want" ]; then
      log 'P3_BASELINE_DRIFT (want vs have):'
      diff <(printf '%s\n' "$want") <(printf '%s\n' "$cur") >&2 || true
      fail 'baseline 5-audience projection mismatch (refuse; re-audit required)'
    fi
    log 'P3_AUDIENCE=ABSENT baseline=exact 5 rows'
    P3_AUDIENCE_STATE='ABSENT'
  else
    row="$(ro_query "SELECT audience_id||'|'||resource_service||'|'||scope_namespace||'|'||array_to_string(accepted_principal_types,',')||'|'||array_to_string(registered_scopes,',')||'|'||human_access_enabled::text||'|'||machine_access_enabled::text||'|'||delegated_access_enabled::text||'|'||status||'|'||freeze_ready::text||'|'||version::text FROM auth_audiences WHERE audience_id='$AUDIENCE_ID';")"
    expected="$AUDIENCE_ID|$AUD_RESOURCE|$AUD_NAMESPACE|$AUD_PRINCIPAL_TYPES|$AUD_SCOPES|$AUD_HUMAN|$AUD_MACHINE|$AUD_DELEGATED|$AUD_STATUS|$AUD_FREEZE|$AUD_VERSION"
    [ "$row" = "$expected" ] || fail "NI audience row exists with unexpected values (conflict): $row"
    log 'P3_AUDIENCE=EXACT (already registered)'
    P3_AUDIENCE_STATE='EXACT'
  fi

  n="$(ro_query "SELECT count(*) FROM machine_access_grants g JOIN machine_clients c ON c.id=g.machine_client_id WHERE (g.audience_id='$AUDIENCE_ID' OR 'notification.deliver'=ANY(g.scopes)) AND c.external_ref NOT IN ('$FORUM_CLIENT_EXT','$WORKFLOW_CLIENT_EXT');")"
  [ "$n" = '0' ] || fail "pre-existing foreign NI grant rows: $n (conflict; full coordinates required)"
  log 'P3_FOREIGN_NI_GRANTS=0'

  n="$(ro_query "SELECT (SELECT count(*) FROM machine_principals WHERE external_ref IN ('$FORUM_PRINCIPAL_EXT','$WORKFLOW_PRINCIPAL_EXT') AND NOT (principal_type='service' AND agent_id IS NULL AND status='active' AND ((external_ref='$FORUM_PRINCIPAL_EXT' AND display_name='$FORUM_DISPLAY') OR (external_ref='$WORKFLOW_PRINCIPAL_EXT' AND display_name='$WORKFLOW_DISPLAY'))))+(SELECT count(*) FROM machine_clients WHERE external_ref IN ('$FORUM_CLIENT_EXT','$WORKFLOW_CLIENT_EXT') AND NOT (status='active' AND cardinality(allowed_resources)=0 AND cardinality(allowed_scopes)=0 AND ((external_ref='$FORUM_CLIENT_EXT' AND client_id='$FORUM_CLIENT_ID') OR (external_ref='$WORKFLOW_CLIENT_EXT' AND client_id='$WORKFLOW_CLIENT_ID'))));")"
  [ "$n" = '0' ] || fail "service:v1 identity rows exist with non-exact shape: $n (conflict; per-caller classify decides NOOP vs refuse)"
  log 'P3_SERVICE_V1_IDENTITY=ABSENT_OR_EXACT_OURS'

  n="$(ro_query "SELECT count(*) FROM machine_clients WHERE client_id IN ('$FORUM_CLIENT_ID','$WORKFLOW_CLIENT_ID') AND external_ref NOT IN ('$FORUM_CLIENT_EXT','$WORKFLOW_CLIENT_EXT');")"
  [ "$n" = '0' ] || fail "frozen clientId taken by a foreign client: $n (conflict)"
  log "P3_CLIENTIDS_FREE_OR_OURS=($FORUM_CLIENT_ID, $WORKFLOW_CLIENT_ID)"

  p4_impersonation_scan || fail 'impersonation conflict (P4)'
  log 'P4_IMPERSONATION=NONE'
}

p4_impersonation_scan() {
  local hits
  hits="$(ro_query "SELECT id::text,principal_type,coalesce(agent_id,'-'),coalesce(display_name,'-'),coalesce(external_ref,'-'),status FROM machine_principals WHERE status='active' AND (agent_id IN ('svc-forum','svc-workflow') OR display_name IN ('svc-forum','svc-workflow','$FORUM_DISPLAY','$WORKFLOW_DISPLAY') OR external_ref IN ('$FORUM_PRINCIPAL_EXT','$WORKFLOW_PRINCIPAL_EXT')) AND NOT (principal_type='service' AND agent_id IS NULL AND external_ref IN ('$FORUM_PRINCIPAL_EXT','$WORKFLOW_PRINCIPAL_EXT'));")"
  [ -z "$hits" ] || { log 'P4_IMPERSONATION_HITS:'; printf '%s\n' "$hits" >&2; return 1; }
  return 0
}

# ----------------------------------------------------- phase A apply steps --
a1_build() {
  log '== A1 build new deploy tree =='
  [ ! -e "$NEW_DEPLOY_DIR" ] || fail "new deploy dir already exists: $NEW_DEPLOY_DIR (conflict)"
  mkdir -p "$(dirname "$NEW_DEPLOY_DIR")"
  if [ "$SANDBOX" -eq 1 ]; then
    git -C "$REPO" worktree add --detach "$NEW_DEPLOY_DIR" "$MAIN_SHA" >/dev/null || fail 'worktree add failed'
  else
    sudo -n -u yanfenma git -C "$REPO" worktree add --detach "$NEW_DEPLOY_DIR" "$MAIN_SHA" >/dev/null || fail 'worktree add failed'
  fi
  SCRATCH_DEPLOY_CREATED=1
  log "A1_WORKTREE=$NEW_DEPLOY_DIR @ $MAIN_SHA"

  if [ "${NI_SKIP_BUILD:-0}" = '1' ]; then
    log 'A1_BUILD=SKIPPED (NI_SKIP_BUILD=1, sandbox harness supplies stub tree)'
    NEW_RUNTIME_DIGEST='sandbox-skip-build-digest'
  else
    # package.json/package-lock are unchanged between PROD_SHA..MAIN_SHA, so the
    # running production node_modules is lockfile- and arch-exact; copy it.
    cp -R "$PROD_DEPLOY_DIR/node_modules" "$NEW_DEPLOY_DIR/node_modules" || fail 'node_modules copy failed'
    ( cd "$NEW_DEPLOY_DIR" && env -i PATH='/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' HOME="$HOME" npm run build ) >/dev/null \
      || fail 'npm run build failed in new deploy tree'
    [ -f "$NEW_DEPLOY_DIR/dist/src/server.js" ] || fail 'dist/src/server.js missing after build'
    [ -f "$NEW_DEPLOY_DIR/generated/minimal-auth-v1/runtime-contract.json" ] || fail 'runtime-contract.json missing after build'

    NEW_RUNTIME_DIGEST="$("$NODE_BIN" -e '
      const fs = require("fs");
      const d = JSON.parse(fs.readFileSync(process.argv[1] + "/generated/minimal-auth-v1/runtime-contract.json", "utf8"));
      const auds = (d.payload && d.payload.audienceRegistry && d.payload.audienceRegistry.audiences) || [];
      const ids = auds.map((a) => a.audience_id).sort().join(",");
      if (ids !== "adc-v2,agent-core-notification-ingress-v1,svc-auth,svc-forum,svc-okr,svc-workflow") {
        console.error("built snapshot audiences wrong: " + ids); process.exit(1);
      }
      console.log(d.runtimeDigest);
    ' "$NEW_DEPLOY_DIR")" || fail 'built runtime snapshot audience set verification failed'
    log "A1_SNAPSHOT=OK audiences=6 runtimeDigest=${NEW_RUNTIME_DIGEST:0:12}..."

    ( cd "$NEW_DEPLOY_DIR" && env -i PATH='/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' HOME="$HOME" "$NODE_BIN" contract-bundles/minimal-auth-v1/validate.mjs ) \
      | grep 'MINIMAL_AUTH_V1_BUNDLE_VALID=true' >/dev/null || fail 'bundle validator did not pass on new tree'
    log 'A1_BUNDLE_VALIDATE=PASS'
  fi

  if [ "$SANDBOX" -ne 1 ]; then
    cp -p "$AUTHSVC_ENV_FILE" "$NEW_DEPLOY_DIR/.env" || fail '.env copy failed'
    chown "$AUTHSVC_USER:$AUTHSVC_USER" "$NEW_DEPLOY_DIR/.env" || fail '.env chown failed'
    chmod 600 "$NEW_DEPLOY_DIR/.env" || fail '.env chmod failed'
    log "A1_ENV=installed (0600 $AUTHSVC_USER)"
  fi
}

a2_audience_row() {
  log '== A2 audience row (one transaction, advisory lock) =='
  cat > "$SQLDIR/a2.sql" <<SQL
\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock($ADVISORY_LOCK_AUDIENCE);
DO \$\$
DECLARE
  v_row text;
  v_expected text := '${AUDIENCE_ID}|${AUD_RESOURCE}|${AUD_NAMESPACE}|${AUD_PRINCIPAL_TYPES}|${AUD_SCOPES}|${AUD_HUMAN}|${AUD_MACHINE}|${AUD_DELEGATED}|${AUD_STATUS}|${AUD_FREEZE}|${AUD_VERSION}';
  v_audit_count int;
BEGIN
  SELECT audience_id||'|'||resource_service||'|'||scope_namespace||'|'||array_to_string(accepted_principal_types,',')||'|'||array_to_string(registered_scopes,',')||'|'||human_access_enabled::text||'|'||machine_access_enabled::text||'|'||delegated_access_enabled::text||'|'||status||'|'||freeze_ready::text||'|'||version::text
    INTO v_row FROM auth_audiences WHERE audience_id = '${AUDIENCE_ID}';
  IF v_row IS NULL THEN
    INSERT INTO auth_audiences (audience_id, resource_service, scope_namespace, accepted_principal_types, registered_scopes,
      human_access_enabled, machine_access_enabled, delegated_access_enabled, status, freeze_ready, version, created_at, updated_at)
    VALUES ('${AUDIENCE_ID}', '${AUD_RESOURCE}', '${AUD_NAMESPACE}', ARRAY['${AUD_PRINCIPAL_TYPES}']::text[], ARRAY['${AUD_SCOPES}']::text[],
      ${AUD_HUMAN}, ${AUD_MACHINE}, ${AUD_DELEGATED}, '${AUD_STATUS}', ${AUD_FREEZE}, ${AUD_VERSION}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO auth_security_audits (id, event_type, result, details, timestamp)
    VALUES (gen_random_uuid(), '${AUDIENCE_EVENT_TYPE}', 'success',
      jsonb_build_object('migration_id','${AUDIENCE_MIGRATION_ID}','source_git_commit','${MAIN_SHA}','operator_id','${OPERATOR_ID}',
        'approval_ref','${APPROVAL_REF}','before',NULL,'after',
        jsonb_build_object('audience_id','${AUDIENCE_ID}','resource_service','${AUD_RESOURCE}','scope_namespace','${AUD_NAMESPACE}',
          'accepted_principal_types',to_jsonb(ARRAY['${AUD_PRINCIPAL_TYPES}']::text[]),'registered_scopes',to_jsonb(ARRAY['${AUD_SCOPES}']::text[]),
          'human_access_enabled',${AUD_HUMAN}::boolean,'machine_access_enabled',${AUD_MACHINE}::boolean,'delegated_access_enabled',${AUD_DELEGATED}::boolean,
          'status','${AUD_STATUS}','freeze_ready',${AUD_FREEZE},'version',${AUD_VERSION})),
      CURRENT_TIMESTAMP);
    RAISE NOTICE 'AUDIENCE_CREATED';
  ELSIF v_row = v_expected THEN
    SELECT count(*) INTO v_audit_count FROM auth_security_audits
      WHERE event_type='${AUDIENCE_EVENT_TYPE}' AND details->>'migration_id'='${AUDIENCE_MIGRATION_ID}';
    IF v_audit_count > 0 THEN
      RAISE NOTICE 'AUDIENCE_NOOP';
    ELSE
      RAISE NOTICE 'AUDIENCE_PRESENT_WITHOUT_OUR_AUDIT';
    END IF;
  ELSE
    RAISE EXCEPTION 'AUDIENCE_MISMATCH: %', v_row;
  END IF;
END \$\$;
COMMIT;
SQL
  local out
  out="$(rw_sql_file "$SQLDIR/a2.sql" 2>&1)" || { log "$out" >&2; fail 'A2 audience transaction failed'; }
  case "$out" in
    *AUDIENCE_CREATED*) log 'A2_RESULT=CREATED'; AUDIENCE_INSERTED_BY_RUN=1; DEPLOY_ARMED=1 ;;
    *AUDIENCE_NOOP*) log 'A2_RESULT=NOOP (exact row + audit already present)' ;;
    *AUDIENCE_PRESENT_WITHOUT_OUR_AUDIT*) log 'A2_RESULT=PRESENT_WITHOUT_OUR_AUDIT (row exact; proceed)' ;;
    *) log "$out" >&2; fail 'A2 unexpected outcome' ;;
  esac
}

wait_health_version() { # $1 expected version, $2 label
  local i body ver
  for i in $(jot 45 1 2>/dev/null || seq 1 45); do
    body="$(health_get)"
    ver="$(printf '%s' "$body" | sed -n 's/.*"authContractVersion":"\([^"]*\)".*/\1/p')"
    if [ "$ver" = "$1" ] && [ "$(printf '%s' "$body" | sed -n 's/.*"ok":\([a-z]*\).*/\1/p')" = 'true' ]; then
      log "HEALTH_$2=OK version=$ver"
      return 0
    fi
    sleep 2
  done
  log "health never reached version=$1 (last: $body)" >&2
  return 1
}

a3_cutover() {
  log '== A3 cutover launchd -> new tree =='
  DEPLOY_ARMED=1
  mkdir -p "$(dirname "$PLIST")" 2>/dev/null || true
  if [ -f "$PLIST" ]; then cp -p "$PLIST" "$PLIST_BAK" || fail 'plist backup failed'; fi
  if [ "$SANDBOX" -eq 1 ]; then
    plutil -replace ProgramArguments.1 -string "$NEW_DEPLOY_DIR/dist/src/server.js" "$PLIST" || fail 'sandbox plist edit failed'
    "$NI_STUB_DIR/launchctl" bootout "system/$LAUNCHD_LABEL" 2>/dev/null || true
    "$NI_STUB_DIR/launchctl" bootstrap "system/$LAUNCHD_LABEL" "$PLIST"
    log 'A3_CUTOVER=sandbox-stub-done'
    return 0
  fi
  plutil -replace ProgramArguments.1 -string "$NEW_DEPLOY_DIR/dist/src/server.js" "$PLIST" || fail 'plist ProgramArguments edit failed'
  plutil -replace WorkingDirectory -string "$NEW_DEPLOY_DIR" "$PLIST" || fail 'plist WorkingDirectory edit failed'
  launchctl bootout "system/$LAUNCHD_LABEL" 2>/dev/null || true
  sleep 2
  launchctl bootstrap system "$PLIST" || fail 'launchctl bootstrap failed'
  log 'A3_CUTOVER=bootout+bootstrap done'
}

a4_verify() {
  log '== A4 post-cutover verify =='
  wait_health_version '1.4.0' NEW || return 1
  local body dig n
  body="$(health_get)"
  dig="$(printf '%s' "$body" | sed -n 's/.*"authContractDigest":"\([^"]*\)".*/\1/p')"
  [ "$dig" = "$NEW_RUNTIME_DIGEST" ] || { log "digest mismatch after cutover: $dig != built snapshot" >&2; return 1; }
  n="$(ro_query "SELECT count(*) FROM auth_audiences;")"
  [ "$n" = '6' ] || { log "audience count after apply = $n (want 6)" >&2; return 1; }
  log "A4_VERIFY=PASS contract=1.4.0 digest=${dig:0:12}... audiences=6"
  return 0
}

rollback_deploy() {
  [ "$ROLLBACK_ACTIVE" -eq 0 ] || return 1
  ROLLBACK_ACTIVE=1
  trap - EXIT
  trap '' HUP INT TERM
  set +e
  local ok=1
  log '== ROLLBACK (phase A) =='
  if [ "$DEPLOY_ARMED" -eq 1 ]; then
    if [ -f "$PLIST_BAK" ]; then
      cp -p "$PLIST_BAK" "$PLIST" || ok=0
      log "ROLLBACK_PLIST=restored from $PLIST_BAK"
    else
      log 'ROLLBACK_PLIST=no-backup (plist never modified this run)'
    fi
    if [ "$SANDBOX" -eq 1 ]; then
      "$NI_STUB_DIR/launchctl" bootout "system/$LAUNCHD_LABEL" 2>/dev/null
      "$NI_STUB_DIR/launchctl" bootstrap "system/$LAUNCHD_LABEL" "$PLIST"
    else
      launchctl bootout "system/$LAUNCHD_LABEL" 2>/dev/null
      sleep 2
      launchctl bootstrap system "$PLIST" 2>/dev/null || ok=0
    fi
    wait_health_version "$PROD_CONTRACT_VERSION" OLD || ok=0
  fi
  if [ "$AUDIENCE_INSERTED_BY_RUN" -eq 1 ]; then
    cat > "$SQLDIR/rb.sql" <<SQL
\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock($ADVISORY_LOCK_AUDIENCE);
DO \$\$
DECLARE v_refs int;
BEGIN
  SELECT count(*) INTO v_refs FROM machine_access_grants WHERE audience_id='${AUDIENCE_ID}';
  IF v_refs <> 0 THEN
    RAISE EXCEPTION 'AUDIENCE_ROLLBACK_REFUSED: % grant rows reference the audience', v_refs;
  END IF;
  DELETE FROM auth_audiences WHERE audience_id='${AUDIENCE_ID}';
  INSERT INTO auth_security_audits (id, event_type, result, details, timestamp)
  VALUES (gen_random_uuid(), '${AUDIENCE_ROLLBACK_EVENT}', 'success',
    jsonb_build_object('migration_id','${AUDIENCE_MIGRATION_ID}','source_git_commit','${MAIN_SHA}','operator_id','${OPERATOR_ID}',
      'approval_ref','${APPROVAL_REF}','phase','A-audience-rollback'),
    CURRENT_TIMESTAMP);
  RAISE NOTICE 'AUDIENCE_COMPENSATED';
END \$\$;
COMMIT;
SQL
    if rw_sql_file "$SQLDIR/rb.sql" 2>/dev/null && [ "$(ro_query "SELECT count(*) FROM auth_audiences WHERE audience_id='$AUDIENCE_ID';" | tr -d '[:space:]')" = '0' ]; then
      log 'ROLLBACK_AUDIENCE_ROW=COMPENSATED'
    else
      ok=0
      log 'ROLLBACK_AUDIENCE_ROW=FAILED (manual review)' >&2
    fi
  fi
  cleanup
  if [ "$ok" -eq 1 ]; then
    log 'RESULT=FAILED_AND_ROLLED_BACK'
    exit 1
  fi
  log 'RESULT=ROLLBACK_INCOMPLETE' >&2
  exit 4
}
trap 'rc=$?; if [ $rc -ne 0 ] && [ "$DEPLOY_ARMED" -eq 1 ] && [ "$DEPLOY_COMMITTED" -eq 0 ]; then rollback_deploy; fi; cleanup; exit $rc' EXIT

# ------------------------------------------------------ phase B per caller --
classify_caller() { # $1 extp $2 extc $3 clientid -> ABSENT | NOOP | CONFLICT:<why>
  local extp="$1" extc="$2" cid="$3" p c g a
  p="$(ro_query "SELECT coalesce((SELECT principal_type||'~'||coalesce(display_name,'-')||'~'||status FROM machine_principals WHERE external_ref='$extp'),'absent');")"
  c="$(ro_query "SELECT coalesce((SELECT client_id||'~'||status||'~'||array_to_string(allowed_resources,',')||'~'||array_to_string(allowed_scopes,',')||'~'||(secret_hash ~ '^[0-9a-f]{32}:[0-9a-f]{128}\$')::text FROM machine_clients WHERE external_ref='$extc'),'absent');")"
  g="$(ro_query "SELECT coalesce((SELECT array_to_string(g.scopes,',')||'~'||g.version::text FROM machine_access_grants g JOIN machine_clients cl ON cl.id=g.machine_client_id WHERE cl.external_ref='$extc' AND g.audience_id='$AUDIENCE_ID'),'absent');")"
  a="$(ro_query "SELECT count(*) FROM grant_change_audits WHERE migration_id='$GRANT_MIGRATION_ID' AND client_id='$cid' AND change_type='create';")"
  if [ "$p" = 'absent' ] && [ "$c" = 'absent' ]; then
    [ "$g" != 'absent' ] && { echo 'CONFLICT:grant_without_identity'; return; }
    echo 'ABSENT'; return
  fi
  case "$p" in
    'service~svc-forum service~active'|'service~svc-workflow service~active') : ;;
    *) echo "CONFLICT:principal_shape:$p"; return ;;
  esac
  [ "$c" != 'absent' ] || { echo 'CONFLICT:client_missing'; return; }
  local ccid cst cres csc chf rest
  ccid="$(printf '%s' "$c" | cut -d'~' -f1)"
  cst="$(printf '%s' "$c" | cut -d'~' -f2)"
  cres="$(printf '%s' "$c" | cut -d'~' -f3)"
  csc="$(printf '%s' "$c" | cut -d'~' -f4)"
  chf="$(printf '%s' "$c" | cut -d'~' -f5)"
  rest="$(printf '%s' "$c" | cut -d'~' -f6-)"
  [ "$ccid" = "$cid" ] || { echo "CONFLICT:client_id:$ccid"; return; }
  [ "$cst" = 'active' ] || { echo "CONFLICT:client_status:$cst"; return; }
  [ -z "$cres" ] || { echo "CONFLICT:legacy_resources:$cres"; return; }
  [ -z "$csc" ] || { echo "CONFLICT:legacy_scopes:$csc"; return; }
  [ "$chf" = 'true' ] || { echo "CONFLICT:secret_hash_format:$chf"; return; }
  [ -z "$rest" ] || { echo "CONFLICT:client_shape:$c"; return; }
  [ "$g" = 'notification.deliver~1' ] || { echo "CONFLICT:grant_shape:$g"; return; }
  [ "$a" -ge 1 ] 2>/dev/null || { echo "CONFLICT:audit_missing:$a"; return; }
  echo 'NOOP'
}

write_destination() { # $1 dest $2 exact|update $3 clientid $4 secret
  local dest="$1" mode="$2" cid="$3" sec="$4" dir tmp ouid ogid omode
  dir="$(dirname "$dest")"
  [ -f "$dest" ] || { log "destination missing: $dest" >&2; return 1; }
  ouid="$(stat -f '%u' "$dest")"; ogid="$(stat -f '%g' "$dest")"; omode="$(stat -f '%Lp' "$dest")"
  tmp="$(mktemp "${dest}.ni-tmp.XXXXXX")" || return 1
  if ! { if [ "$mode" = 'exact' ]; then
      printf '%s=%s\n%s=%s\n' "$CLIENT_ID_KEY" "$cid" "$CLIENT_SECRET_KEY" "$sec" > "$tmp"
    else
      grep -v "^${CLIENT_ID_KEY}=\|^${CLIENT_SECRET_KEY}=" "$dest" > "$tmp" 2>/dev/null || true
      printf '%s=%s\n%s=%s\n' "$CLIENT_ID_KEY" "$cid" "$CLIENT_SECRET_KEY" "$sec" >> "$tmp"
    fi; }; then rm -f "$tmp"; return 1; fi
  chmod "$omode" "$tmp" && chown "$ouid:$ogid" "$tmp" && mv -f "$tmp" "$dest" || { rm -f "$tmp"; return 1; }
  return 0
}

compensate_caller() { # $1 ext_client $2 ext_principal — same-run compensating delete
  cat > "$SQLDIR/comp.sql" <<SQL
\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock($ADVISORY_LOCK_CALLER);
DELETE FROM grant_change_audits WHERE migration_id='${GRANT_MIGRATION_ID}'
  AND client_id=(SELECT client_id FROM machine_clients WHERE external_ref='$1');
DELETE FROM machine_access_grants WHERE machine_client_id IN (SELECT id FROM machine_clients WHERE external_ref='$1');
DELETE FROM machine_clients WHERE external_ref='$1';
DELETE FROM machine_principals WHERE external_ref='$2'
  AND NOT EXISTS (SELECT 1 FROM machine_clients WHERE machine_principal_id=machine_principals.id);
COMMIT;
SQL
  rw_sql_file "$SQLDIR/comp.sql" 2>/dev/null
}

supply_caller() { # $1 CALLER $2 extp $3 extc $4 clientid $5 display $6 dest $7 exact|update
  local caller="$1" extp="$2" extc="$3" cid="$4" disp="$5" dest="$6" dmode="$7"
  log "-- caller $caller --"
  local cls; cls="$(classify_caller "$extp" "$extc" "$cid")"
  case "$cls" in
    NOOP) log "SUPPLY_$caller=NOOP (exact prior product; zero writes)"; eval "${caller}_OUTCOME=NOOP"; return 0 ;;
    CONFLICT:*) log "SUPPLY_$caller=REFUSED ($cls)"; eval "${caller}_OUTCOME=REFUSED"; return 2 ;;
    ABSENT) : ;;
    *) log "SUPPLY_$caller=REFUSED (classify:$cls)"; eval "${caller}_OUTCOME=REFUSED"; return 2 ;;
  esac

  # P5 destination precondition (owner pre-created, 0600, correct owner)
  if [ ! -f "$dest" ]; then log "SUPPLY_$caller=REFUSED (P5 destination absent: $dest)"; eval "${caller}_OUTCOME=REFUSED"; return 2; fi
  local m u; m="$(stat -f '%Lp' "$dest")"
  [ "$m" = '600' ] || { log "SUPPLY_$caller=REFUSED (P5 destination mode $m != 600)"; eval "${caller}_OUTCOME=REFUSED"; return 2; }
  if [ "$SANDBOX" -ne 1 ]; then
    u="$(stat -f '%u' "$dest")"
    [ "$u" = "$(id -u yanfenma)" ] || { log "SUPPLY_$caller=REFUSED (P5 destination owner uid $u != yanfenma)"; eval "${caller}_OUTCOME=REFUSED"; return 2; }
  fi

  local pair hash secret
  pair="$(generate_pair)" || { log "SUPPLY_$caller=REFUSED (secret generation failed)"; eval "${caller}_OUTCOME=REFUSED"; return 2; }
  hash="$(printf '%s\n' "$pair" | sed -n 1p)"
  secret="$(printf '%s\n' "$pair" | sed -n 2p)"
  [ "${#hash}" -eq 161 ] || { log "SUPPLY_$caller=REFUSED (hash format)"; eval "${caller}_OUTCOME=REFUSED"; return 2; }

  cat > "$SQLDIR/caller-${caller}.sql" <<SQL
\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT pg_advisory_xact_lock($ADVISORY_LOCK_CALLER);
DO \$\$
DECLARE
  v_pid uuid; v_cid uuid; v_count int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth_audiences WHERE audience_id='${AUDIENCE_ID}' AND status='active' AND machine_access_enabled) THEN
    RAISE EXCEPTION 'P1_FAILED';
  END IF;
  IF EXISTS (SELECT 1 FROM machine_principals WHERE external_ref='${extp}') THEN RAISE EXCEPTION 'P2_FAILED'; END IF;
  IF EXISTS (SELECT 1 FROM machine_clients WHERE external_ref='${extc}') THEN RAISE EXCEPTION 'P3_FAILED'; END IF;
  IF EXISTS (SELECT 1 FROM machine_principals WHERE status='active' AND (agent_id IN ('svc-forum','svc-workflow') OR display_name IN ('svc-forum','svc-workflow','${FORUM_DISPLAY}','${WORKFLOW_DISPLAY}') OR external_ref IN ('${FORUM_PRINCIPAL_EXT}','${WORKFLOW_PRINCIPAL_EXT}')) AND NOT (principal_type='service' AND agent_id IS NULL AND external_ref IN ('${FORUM_PRINCIPAL_EXT}','${WORKFLOW_PRINCIPAL_EXT}'))) THEN RAISE EXCEPTION 'P4_FAILED'; END IF;
  IF EXISTS (SELECT 1 FROM machine_access_grants g JOIN machine_clients c ON c.id=g.machine_client_id
    WHERE (g.audience_id='${AUDIENCE_ID}' OR 'notification.deliver'=ANY(g.scopes))
      AND c.external_ref NOT IN ('${FORUM_CLIENT_EXT}','${WORKFLOW_CLIENT_EXT}')) THEN RAISE EXCEPTION 'P7_FAILED'; END IF;

  INSERT INTO machine_principals (id, principal_type, agent_id, owner_user_id, display_name, external_ref, request_digest, status, created_at, updated_at)
  VALUES (gen_random_uuid(), 'service'::"PrincipalType", NULL, NULL, '${disp}', '${extp}', NULL, 'active'::"PrincipalStatus", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  RETURNING id INTO v_pid;
  INSERT INTO machine_clients (id, client_id, machine_principal_id, secret_hash, external_ref, status, allowed_resources, allowed_scopes, created_at, updated_at)
  VALUES (gen_random_uuid(), '${cid}', v_pid, '${hash}', '${extc}', 'active'::"ClientStatus", '{}'::text[], '{}'::text[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  RETURNING id INTO v_cid;
  INSERT INTO machine_access_grants (machine_client_id, audience_id, scopes, version, created_at, updated_at)
  VALUES (v_cid, '${AUDIENCE_ID}', ARRAY['notification.deliver']::text[], 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO grant_change_audits (change_id, migration_id, source_git_commit, operator_id, approval_ref, reason, client_id, change_type,
    expected_grant_version, resulting_grant_version, before_value, after_value, timestamp)
  VALUES (gen_random_uuid(), '${GRANT_MIGRATION_ID}', '${MAIN_SHA}', '${OPERATOR_ID}', '${APPROVAL_REF}', '${SUPPLY_REASON}',
    '${cid}', 'create'::"GrantChangeType", NULL, 1, NULL,
    jsonb_build_object('principal', jsonb_build_object('external_ref','${extp}','principal_type','service','display_name','${disp}','status','active'),
      'client', jsonb_build_object('client_id','${cid}','external_ref','${extc}','status','active'),
      'grant', jsonb_build_object('audience_id','${AUDIENCE_ID}','scopes',to_jsonb(ARRAY['notification.deliver']::text[]),'version',1)),
    CURRENT_TIMESTAMP);

  SELECT count(*) INTO v_count FROM machine_access_grants g JOIN machine_clients c ON c.id=g.machine_client_id
    JOIN machine_principals p ON p.id=c.machine_principal_id
    WHERE c.client_id='${cid}' AND p.external_ref='${extp}' AND c.external_ref='${extc}'
      AND g.audience_id='${AUDIENCE_ID}' AND g.scopes=ARRAY['notification.deliver']::text[] AND g.version=1
      AND c.status='active' AND p.status='active' AND cardinality(c.allowed_resources)=0 AND cardinality(c.allowed_scopes)=0;
  IF v_count <> 1 THEN RAISE EXCEPTION 'END_STATE_MISMATCH:%', v_count; END IF;
  RAISE NOTICE 'CALLER_COMMITTED';
END \$\$;
COMMIT;
SQL

  local out
  if out="$(rw_sql_file "$SQLDIR/caller-${caller}.sql" 2>&1)"; then
    log "SUPPLY_$caller=COMMITTED (principal+client+grant+audit, one transaction)"
  else
    case "$out" in
      *P1_FAILED*|*P2_FAILED*|*P3_FAILED*|*P4_FAILED*|*P7_FAILED*)
        log "SUPPLY_$caller=REFUSED (in-tx precondition: $(printf '%s' "$out" | grep -o 'P[0-9]*_FAILED' | head -1))"; eval "${caller}_OUTCOME=REFUSED"; return 2 ;;
      *'could not serialize'*|*deadlock*)
        log "SUPPLY_$caller=ROLLED_BACK (serialization; safe rerun)"; eval "${caller}_OUTCOME=ROLLED_BACK"; return 1 ;;
      *)
        log "$out" >&2; log "SUPPLY_$caller=ROLLED_BACK (transaction failed)"; eval "${caller}_OUTCOME=ROLLED_BACK"; return 1 ;;
    esac
  fi

  if ! write_destination "$dest" "$dmode" "$cid" "$secret"; then
    log "SUPPLY_$caller=SECRET_HANDOFF_FAILED (compensating same-run delete)" >&2
    if compensate_caller "$extc" "$extp" \
       && [ "$(ro_query "SELECT count(*) FROM machine_clients WHERE external_ref='$extc';" | tr -d '[:space:]')" = '0' ] \
       && [ "$(ro_query "SELECT count(*) FROM machine_principals WHERE external_ref='$extp';" | tr -d '[:space:]')" = '0' ]; then
      log "SUPPLY_$caller=ROLLED_BACK (secret never materialized durably)"
      eval "${caller}_OUTCOME=ROLLED_BACK"; return 1
    fi
    log "SUPPLY_$caller=OUTCOME_UNKNOWN (compensation failed; manual review)" >&2
    eval "${caller}_OUTCOME=OUTCOME_UNKNOWN"; return 4
  fi
  eval "${caller}_OUTCOME=COMMITTED"
  log "SUPPLY_$caller=SECRET_HANDOFF=OK dest=$dest"
  return 0
}

# ------------------------------------------------------ verify projection ---
verify_caller() { # $1 extp $2 extc $3 clientid $4 display $5 dest
  local extp="$1" extc="$2" cid="$3" disp="$4" dest="$5" got expected idn secn
  got="$(ro_query "SELECT p.external_ref, p.principal_type, coalesce(p.display_name,'-'), p.status,
c.client_id, c.external_ref, c.status, array_to_string(c.allowed_resources,','), array_to_string(c.allowed_scopes,','),
coalesce(array_to_string(g.scopes,','),'-'), coalesce(g.version::text,'-'), coalesce(g.audience_id,'-'),
(SELECT count(*) FROM machine_clients c2 WHERE c2.machine_principal_id=p.id)::text,
(SELECT count(*) FROM machine_access_grants g2 WHERE g2.machine_client_id=c.id)::text,
(SELECT count(*) FROM grant_change_audits a WHERE a.migration_id='$GRANT_MIGRATION_ID' AND a.client_id='$cid' AND a.change_type='create')::text
FROM machine_principals p JOIN machine_clients c ON c.machine_principal_id=p.id
LEFT JOIN machine_access_grants g ON g.machine_client_id=c.id
WHERE p.external_ref='$extp' AND c.external_ref='$extc' AND c.client_id='$cid';")"
  expected="$extp|service|$disp|active|$cid|$extc|active|||notification.deliver|1|$AUDIENCE_ID|1|1|1"
  if [ "$got" != "$expected" ]; then
    log "VERIFY_DB_MISMATCH client=$cid"
    return 1
  fi
  idn="$(grep -c "^${CLIENT_ID_KEY}=${cid}\$" "$dest" 2>/dev/null || true)"
  secn="$(grep -c "^${CLIENT_SECRET_KEY}=" "$dest" 2>/dev/null || true)"
  if [ "$idn" != '1' ] || [ "$secn" != '1' ]; then
    log "VERIFY_DEST_MISMATCH $dest client_lines=$idn secret_lines=$secn"
    return 1
  fi
  log "VERIFY_CALLER=PASS client=$cid dest=$dest"
  return 0
}

verify_secret_match() { # $1 extc $2 dest — scrypt-verify the dest secret vs DB hash; prints MATCH/MISMATCH only
  local stored sec
  stored="$(ro_query "SELECT secret_hash FROM machine_clients WHERE external_ref='$1';")"
  sec="$(sed -n "s/^${CLIENT_SECRET_KEY}=//p" "$2" 2>/dev/null | head -1)"
  if [ -n "$stored" ] && [ -n "$sec" ] && scrypt_verify "$sec" "$stored"; then log "SECRET_VERIFY $1=MATCH"; return 0; fi
  log "SECRET_VERIFY $1=MISMATCH_OR_UNREADABLE"; return 1
}

final_report() {
  log '== FINAL =='
  log "AUDIENCE_ROWS=$(ro_query "SELECT count(*) FROM auth_audiences WHERE audience_id='$AUDIENCE_ID';") NI_GRANTS=$(ro_query "SELECT count(*) FROM machine_access_grants WHERE audience_id='$AUDIENCE_ID';")"
  log "FORUM_OUTCOME=$FORUM_OUTCOME WORKFLOW_OUTCOME=$WORKFLOW_OUTCOME"
  log "FORUM_CLIENT_ID=$FORUM_CLIENT_ID"
  log "WORKFLOW_CLIENT_ID=$WORKFLOW_CLIENT_ID"
}

# ================================================================== main ====
p1_git_authority
p2_production_state
p3_db_preflight

if [ "$MODE" = 'verify' ]; then
  log '== VERIFY MODE (read-only) =='
  VRC=0
  verify_caller "$FORUM_PRINCIPAL_EXT" "$FORUM_CLIENT_EXT" "$FORUM_CLIENT_ID" "$FORUM_DISPLAY" "$FORUM_ENV_FILE" || VRC=1
  verify_secret_match "$FORUM_CLIENT_EXT" "$FORUM_ENV_FILE" || VRC=1
  verify_caller "$WORKFLOW_PRINCIPAL_EXT" "$WORKFLOW_CLIENT_EXT" "$WORKFLOW_CLIENT_ID" "$WORKFLOW_DISPLAY" "$WORKFLOW_ENV_FILE" || VRC=1
  verify_secret_match "$WORKFLOW_CLIENT_EXT" "$WORKFLOW_ENV_FILE" || VRC=1
  final_report
  [ "$VRC" -eq 0 ] && log 'VERIFY_RESULT=PASS' || log 'VERIFY_RESULT=FAIL'
  exit "$VRC"
fi

PHASE_A='APPLY_NEEDED'
if [ "$P2_STATE" = 'ALREADY_APPLIED' ] && [ "$P3_AUDIENCE_STATE" = 'EXACT' ]; then
  PHASE_A='ALREADY_APPLIED'
fi
log "PHASE_A_PLAN=$PHASE_A"

PHASE_B='GATED'
if [ "$PHASE_B_AUTHORITY" = 'ACCEPTED_IN_TREE' ]; then PHASE_B='AUTHORIZED'; else PHASE_B="GATED:SPEC_${PHASE_B_AUTHORITY}"; fi
log "PHASE_B_PLAN=$PHASE_B (client/grant supply; zero writes while gated)"

if [ "$MODE" = 'plan' ]; then
  log 'PLAN_RESULT=READ_ONLY_ZERO_WRITES'
  final_report
  exit 0
fi

# The integrated apply is all-authorities-gated. Never use accepted Audience
# authority as permission to begin a partial run while Client/Grant authority
# is absent, proposed, or otherwise unaccepted.
[ "$PHASE_B" = 'AUTHORIZED' ] || fail "apply gated before first write: $PHASE_B"

# ---- apply Phase A
if [ "$PHASE_A" = 'APPLY_NEEDED' ]; then
  a1_build
  a2_audience_row
  a3_cutover
  a4_verify || rollback_deploy
  DEPLOY_COMMITTED=1
  log 'PHASE_A=COMMITTED (new tree live + audience row registered)'
else
  log 'PHASE_A=ALREADY_APPLIED (skip build/cutover)'
fi

# ---- apply Phase B (authority-gated)
RC=0
if [ "$PHASE_B" != 'AUTHORIZED' ]; then
  log "PHASE_B=SKIPPED_GATED ($PHASE_B) — no Principal/Client/secret/Grant written"
else
  rc1=0; rc2=0
  supply_caller FORUM "$FORUM_PRINCIPAL_EXT" "$FORUM_CLIENT_EXT" "$FORUM_CLIENT_ID" "$FORUM_DISPLAY" "$FORUM_ENV_FILE" exact || rc1=$?
  supply_caller WORKFLOW "$WORKFLOW_PRINCIPAL_EXT" "$WORKFLOW_CLIENT_EXT" "$WORKFLOW_CLIENT_ID" "$WORKFLOW_DISPLAY" "$WORKFLOW_ENV_FILE" update || rc2=$?
  if [ "$rc1" -eq 4 ] || [ "$rc2" -eq 4 ]; then fail_incomplete 'OUTCOME_UNKNOWN present (manual review required)'; fi
  if [ "$rc1" -eq 1 ] || [ "$rc2" -eq 1 ]; then RC=1; fi
  if [ "$rc1" -eq 2 ] || [ "$rc2" -eq 2 ]; then
    if [ "$rc1" -eq 0 ] || [ "$rc2" -eq 0 ]; then RC=5; else RC=2; fi
  fi
  verify_caller "$FORUM_PRINCIPAL_EXT" "$FORUM_CLIENT_EXT" "$FORUM_CLIENT_ID" "$FORUM_DISPLAY" "$FORUM_ENV_FILE" || RC=1
  verify_secret_match "$FORUM_CLIENT_EXT" "$FORUM_ENV_FILE" || RC=1
  verify_caller "$WORKFLOW_PRINCIPAL_EXT" "$WORKFLOW_CLIENT_EXT" "$WORKFLOW_CLIENT_ID" "$WORKFLOW_DISPLAY" "$WORKFLOW_ENV_FILE" || RC=1
  verify_secret_match "$WORKFLOW_CLIENT_EXT" "$WORKFLOW_ENV_FILE" || RC=1
fi

final_report
log "RESULT=APPLY_DONE rc=$RC"
exit "$RC"
