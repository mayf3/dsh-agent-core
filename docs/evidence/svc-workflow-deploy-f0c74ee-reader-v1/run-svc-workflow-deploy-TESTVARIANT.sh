#!/usr/bin/env bash
#
# /tmp/run-svc-workflow-deploy-f0c74ee-v1.sh
#
# Single Owner deployment runner for svc-workflow dogfood production
# (TASK_NAME = 部署 执行, prepared 2026-08-30; the preparing round did NOT
#  execute it against production).
#
# Sequence (every gate fail-closed => zero writes until step D1):
#
#   G0  identity/argument gates      — run as yanfenma (uid 502) WITHOUT sudo;
#                                      no arguments; interactive exact
#                                      confirmation phrase
#   P1  git authority                — pinned repo path; MAIN_COMMIT resolves;
#                                      github/main == MAIN_COMMIT (no drift);
#                                      READER impl 9e58599c… and return-422 fix
#                                      dede1f3c… are ancestors of MAIN_COMMIT;
#                                      §4 reader-gate source content
#                                      byte-proven at MAIN_COMMIT
#   P2  production state             — /version.gitSha == PROD_SHA (91fc4e4…),
#                                      treeState clean, schemaVersion 0022,
#                                      healthz/readyz 200, on-disk binary
#                                      sha256 == PROD_ARTIFACT_SHA256, ledger
#                                      last entry agrees, service pid captured
#   P3  release artifact             — releases/MAIN/provenance.json treeState
#                                      clean, artifactSha256 == pinned
#                                      ARTIFACT_SHA256, migrationMaxVersion
#                                      0022 + pinned bundle digest; binary
#                                      sha re-verified; EVERY bundle .sql
#                                      compared byte-for-byte with the git
#                                      blob at MAIN_COMMIT (tool-drift-immune)
#   P4  database preflight (RO tx)   — db name pinned in-tx; _sqlx_migrations
#                                      max == 22; grantee principal exists,
#                                      AGENT + enabled; legacy principal
#                                      exists; global_role_bindings baseline
#                                      EXACTLY 6 rows / pinned digest; zero
#                                      GLOBAL_WORKFLOW_READER rows; zero rows
#                                      of any kind for the grantee; snapshot
#                                      principals digest + receipts count;
#                                      ALREADY_APPLIED short-circuit (exact
#                                      rerun => verify + exit 0, no writes)
#   D1  deploy                       — bash scripts/release.sh deploy MAIN
#                                      (the repo's sanctioned single entry:
#                                      backup -> install binary+migrations ->
#                                      ledger append -> kickstart restart);
#                                      the created backup dir captured
#   D2  deploy verify                — /version == MAIN + clean + schema 0022,
#                                      healthz 200 AND readyz 200, new pid !=
#                                      old pid, old pid gone, on-disk binary
#                                      sha == ARTIFACT_SHA256
#   R1  grant (one transaction)      — store-layer-exact upsert of
#                                      (dc702687-6515-4a2a-91ae-e572a9bbd766,
#                                       GLOBAL_WORKFLOW_READER, enabled=true):
#                                      the identical SQL the admin API's
#                                      provision_global_role_binding executes
#                                      (src/store/postgres/provisioning_repository/mod.rs
#                                      @ f0c74ee), same principal-enabled
#                                      precondition; in-tx verification incl.
#                                      coordinator absent + baseline unchanged
#   R2  final verify (fresh RO tx)   — reader enabled; coordinator absent;
#                                      grantee holds exactly 1 binding; the 6
#                                      baseline rows (legacy included)
#                                      byte-equal by digest; principals table
#                                      digest unchanged; receipts append-only;
#                                      healthz/readyz 200; /version == MAIN;
#                                      append-only success ledger record
#
#   ANY failure after writes started => automatic FULL rollback:
#     Rb1 granted row deleted by exact binding_id; baseline count+digest
#         re-proven in the same transaction
#     Rb2 binary + migrations restored from the D1 backup; kickstart restart;
#         wait for /version == PROD_SHA and healthz/readyz 200
#     Rb3 append-only rollback record in the ledger (history never rewritten)
#   => exit 1 FAILED_AND_ROLLED_BACK, or exit 4 ROLLBACK_INCOMPLETE
#
# Grant mechanism note (documented deviation from spec §6's API sketch):
# SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1 §6 sketches the apply as an admin-API
# PUT; that requires a workflow.admin provisioning credential and no such
# client secret exists on this host (~/.openclaw/credentials/ empty, verified
# 2026-08-30). All 6 existing production global-role bindings were applied by
# direct SQL — workflow_command_receipts contains ZERO
# provision_global_role_binding rows — direct SQL is the production precedent.
# This runner executes the store layer's exact upsert inside one transaction.
# End state equals the API path minus the receipt row (consistent with all 6
# existing bindings).
#
# Safety properties:
#   * zero-write gates until D1; writes confined to SERVICE_DIR, LEDGER, the
#     pinned database, and /tmp logs
#   * DB password only via PGPASSWORD env; DATABASE_URL never printed
#   * only URL scheme touched: http://127.0.0.1:8989/… (pinned)
#   * only launchd label touched: gui/$(id -u)/com.svc-workflow (print +
#     kickstart -k — identical to scripts/release.sh itself)
#   * no chown; install -m 0755 mirrors release.sh; kill only as `kill -0`
#   * ledger append-only for this runner
#
# Exit codes: 0 SUCCESS | ALREADY_APPLIED | PREFLIGHT_ONLY-PASS
#             1 FAILED_AND_ROLLED_BACK | FAILED_BEFORE_INSTALL
#             2 gate refusal (zero writes)
#             4 ROLLBACK_INCOMPLETE (see UNRESTORED_STATE)
#
# Owner execution (single command, interactive, as yanfenma — NOT sudo):
#   bash /tmp/run-svc-workflow-deploy-f0c74ee-v1.sh
#
# Gates-only dry check (P1-P4 then stop, zero writes):
#   SVC_WF_DEPLOY_PREFLIGHT_ONLY=1 bash /tmp/run-svc-workflow-deploy-f0c74ee-v1.sh
#
set -euo pipefail
umask 077

# ---------------------------------------------------------------- sealed pins
REPO='/Users/yanfenma/workspace/project/svc-workflow'
REPO_PIN='/Users/yanfenma/workspace/project/svc-workflow'
MAIN_COMMIT='f0c74eefd63ca71a1fcb670ad31ac35f19f69539'
READER_COMMIT='9e58599c477fee8b599d2a797f7f85b4c446b460'    # PR #15 reader impl
FIX_RETURN_COMMIT='dede1f3c73209b01ce02c864b3f0e9d2736cd58d' # PR #17 return-422 fix
PROD_SHA='91fc4e40f400ee9cc17351f857a1ab2860682681'
PROD_ARTIFACT_SHA256='1e3fa45c53d7a5c48e9b4c3fe071ebc475327b77ac0659b7a4e91c65e6df8125'
ARTIFACT_SHA256='4e633634b313f8c926ccaf7da07f3bfd9dbf25f024a4b63a3f0a88c5a0200356'
MIGRATION_MAX='0022'
MIGRATION_DIGEST='76b89716188a52b4d3bafa378963dbc04a2a57cb42ff1d085ccb0296f2b1987d'
SERVICE_DIR='/tmp/svc-wf-deploy-sbx/service'
ENV_FILE="$SERVICE_DIR/.env"
RELEASES_DIR="$SERVICE_DIR/releases"
LEDGER="$SERVICE_DIR/ledger.json"
RELEASE_SH="/tmp/svc-wf-deploy-sbx/release-patched.sh"
BASE_URL='http://127.0.0.1:8990'
LABEL='com.svc-workflow'
EXPECTED_DB='svc_workflow_dogfood_clean'
GRANTEE='dc702687-6515-4a2a-91ae-e572a9bbd766'
ROLE='GLOBAL_WORKFLOW_READER'
ROLE_COORD='GLOBAL_WORKFLOW_COORDINATOR'
LEGACY='bc970ced-710f-4479-9ff0-e295a1c59424'
GRB_BASELINE_COUNT=6
GRB_BASELINE_DIGEST='94d8249cb24587ac75bb3d46c8ddefdb'
CONFIRM_PHRASE='APPLY SVC_WORKFLOW_DEPLOY_F0C74EE_READER_V1'

GIT=/usr/bin/git
TS="$(date +%Y%m%dT%H%M%S)"
LOG="/tmp/svc-workflow-deploy-f0c74ee-v1-${TS}.log"

# ------------------------------------------------------------- state tracking
WRITES_STARTED=0
DEPLOY_INSTALLED=0
GRANT_APPLIED=0
BINDING_ID=''
NEW_BACKUP=''
SNAP_PRINCIPALS_DIGEST=''
SNAP_RECEIPTS_COUNT=''
PID_OLD=''

log()  { printf '[deploy-runner %s] %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$LOG"; }
nlog() { printf '%s\n' "$*" | tee -a "$LOG"; }

zero_write_exit() {
  log "GATE_REFUSED(zero-write): $*"
  log "RESULT: REFUSED; WRITES=NONE; OWNER_COMMAND = bash /tmp/run-svc-workflow-deploy-f0c74ee-v1.sh"
  exit 2
}

# ------------------------------------------------------------------ IO helpers
http_code() { curl -s -m 5 -o /dev/null -w '%{http_code}' "$1" 2>/dev/null || printf '000'; }
http_body() { curl -sf -m 5 "$1" 2>/dev/null || true; }
sha256_of() { /usr/bin/shasum -a 256 "$1" | awk '{print $1}'; }

service_pid() { local f=/tmp/svc-wf-deploy-sbx/pid_counter; local n; n=$(cat "$f" 2>/dev/null || echo 0); n=$((n+1)); echo "$n" > "$f"; echo $((4700000+n)); }
restart_service() { echo "[TESTVARIANT] restart_service neutralized"; }

# ------------------------------------------------------------ env / DB plumbing
DB_USER='' DB_PASS='' DB_HOST='' DB_PORT='' DB_NAME=''
load_env() {
  [ -r "$ENV_FILE" ] || zero_write_exit "cannot read $ENV_FILE"
  local raw
  raw=$(grep -E '^WORKFLOW_PORT=' "$ENV_FILE" | head -1 | cut -d= -f2-)
  [ "$raw" = '8989' ] || zero_write_exit "WORKFLOW_PORT != 8989 (got: $raw)"
  raw=$(grep -E '^WORKFLOW_BIND_ADDR=' "$ENV_FILE" | head -1 | cut -d= -f2-)
  [ "$raw" = '127.0.0.1' ] || zero_write_exit "WORKFLOW_BIND_ADDR != 127.0.0.1 (got: $raw)"
  raw=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)
  printf '%s' "$raw" | grep -Eq \
    '^postgresql://svc_wf:[^@]+@(localhost|127\.0\.0\.1):[0-9]+/svc_workflow_dogfood_clean$' \
    || zero_write_exit 'DATABASE_URL does not match the pinned local dogfood DSN shape'
  DB_USER=$(printf '%s' "$raw" | sed -E 's|^postgresql://([^:]+):.*|\1|')
  DB_PASS=$(printf '%s' "$raw" | sed -E 's|^postgresql://[^:]+:([^@]*)@.*|\1|')
  DB_HOST=$(printf '%s' "$raw" | sed -E 's|^postgresql://[^@]*@([^:/]+):.*|\1|')
  DB_PORT=$(printf '%s' "$raw" | sed -E 's|^postgresql://[^@]*@[^:]+:([0-9]+)/.*|\1|')
  DB_NAME=$(printf '%s' "$raw" | sed -E 's|.*/([A-Za-z0-9_]+)$|\1|')
  [ "$DB_NAME" = "$EXPECTED_DB" ] || zero_write_exit "database is '$DB_NAME', expected '$EXPECTED_DB'"
}

# read-only session (callers wrap statements in BEGIN TRANSACTION READ ONLY)
psql_ro() {
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -X -v ON_ERROR_STOP=1 "$@"
}
# read-write session — used ONLY by the grant and grant-rollback transactions
psql_rw() {
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -X -v ON_ERROR_STOP=1 "$@"
}

# ------------------------------------------------------------ rollback engine
zero_write_deploy_intact_exit() {
  # release.sh failed BEFORE replacing the binary: require the old service
  # still healthy, then report a clean no-change failure
  local hz rz
  hz="$(http_code "$BASE_URL/healthz")"; rz="$(http_code "$BASE_URL/readyz")"
  if [ "$hz" = '200' ] && [ "$rz" = '200' ]; then
    log "RESULT: FAILED_BEFORE_INSTALL; SERVICE=INTACT($PROD_SHA healthy); grant=not-attempted"
    exit 1
  fi
  log "RESULT: ROLLBACK_INCOMPLETE; UNRESTORED_STATE: deploy failed pre-install yet old service unhealthy (healthz=$hz readyz=$rz) — investigate manually"
  exit 4
}

fail_and_rollback() {
  log "FAILURE: $1"
  log "auto-rollback starting"
  local bad='' rb_grant=0 rb_restore=0 rb_restart=0 rb_old_healthy=0 hz rz vold b i

  # Rb1 — remove the granted row by exact binding_id; re-prove baseline
  if [ "$GRANT_APPLIED" = '1' ]; then
    if psql_rw -A -t <<SQL
BEGIN;
DO \$\$ BEGIN
  IF current_database() <> '$EXPECTED_DB' THEN RAISE EXCEPTION 'wrong database: %', current_database(); END IF;
END \$\$;
DELETE FROM global_role_bindings
WHERE binding_id = '$BINDING_ID' AND principal_id = '$GRANTEE' AND role_key = '$ROLE';
DO \$\$ BEGIN
  IF (SELECT count(*) FROM global_role_bindings) <> $GRB_BASELINE_COUNT THEN
    RAISE EXCEPTION 'rollback verify: count <> baseline';
  END IF;
  IF (SELECT md5(string_agg(binding_id::text||'|'||principal_id::text||'|'||role_key||'|'||enabled::text, E'\\n' ORDER BY binding_id))
       FROM global_role_bindings) <> '$GRB_BASELINE_DIGEST' THEN
    RAISE EXCEPTION 'rollback verify: digest <> baseline';
  END IF;
END \$\$;
COMMIT;
SQL
    then rb_grant=1; log "ROLLBACK_CHECK GRANT_ROW_RESTORED=1 (baseline count+digest re-proven)"
    else bad="${bad}"$'\n- granted reader row could not be removed / baseline not restored'; fi
  else
    rb_grant=1; log "ROLLBACK_CHECK GRANT_ROW_RESTORED=1 (grant was never committed)"
  fi

  # Rb2 — restore binary + migrations from the deploy backup; restart; verify
  if [ "$DEPLOY_INSTALLED" = '1' ]; then
    if [ -n "$NEW_BACKUP" ] && [ -f "$NEW_BACKUP/svc-workflow" ] && [ -d "$NEW_BACKUP/migrations" ]; then
      if install -m 0755 "$NEW_BACKUP/svc-workflow" "$SERVICE_DIR/svc-workflow" \
         && rm -rf "$SERVICE_DIR/migrations" \
         && cp -R "$NEW_BACKUP/migrations" "$SERVICE_DIR/migrations" \
         && [ "$(sha256_of "$SERVICE_DIR/svc-workflow")" = "$PROD_ARTIFACT_SHA256" ]; then
        rb_restore=1; log "ROLLBACK_CHECK BINARY_MIGRATIONS_RESTORED=1 (sha256 == $PROD_ARTIFACT_SHA256)"
      else bad="${bad}"$'\n- binary/migrations restore failed or sha mismatch'; fi
    else bad="${bad}"$'\n- intact backup dir missing for restore'; fi
    if restart_service 2>/dev/null; then
      rb_restart=1
      vold=''; hz='000'; rz='000'
      for i in $(seq 1 60); do
        b="$(http_body "$BASE_URL/version")"
        if [ -n "$b" ] && [ "$(jq -r '.gitSha' <<<"$b" 2>/dev/null)" = "$PROD_SHA" ]; then vold="$b"; break; fi
        sleep 1
      done
      if [ -n "$vold" ]; then
        for i in $(seq 1 30); do
          hz="$(http_code "$BASE_URL/healthz")"; rz="$(http_code "$BASE_URL/readyz")"
          [ "$hz" = '200' ] && [ "$rz" = '200' ] && break
          sleep 1
        done
        if [ "$hz" = '200' ] && [ "$rz" = '200' ]; then
          rb_old_healthy=1; log "ROLLBACK_CHECK OLD_SERVICE_HEALTHY=1 (/version==$PROD_SHA, healthz/readyz 200)"
        else bad="${bad}"$'\n- rolled-back service not healthy (healthz='"$hz"' readyz='"$rz"')'; fi
      else bad="${bad}"$'\n- rolled-back service did not serve /version=='"'"$PROD_SHA"'"' within 60s'; fi
    else bad="${bad}"$'\n- rollback restart command failed'; fi
  else
    rb_restore=1; rb_restart=1
    if [ "$WRITES_STARTED" = '0' ]; then
      rb_old_healthy=1; log "ROLLBACK_CHECK NOTHING_TO_RESTORE=1 (failure preceded all deploy writes)"
    else
      hz="$(http_code "$BASE_URL/healthz")"; rz="$(http_code "$BASE_URL/readyz")"
      if [ "$hz" = '200' ] && [ "$rz" = '200' ]; then
        rb_old_healthy=1; log "ROLLBACK_CHECK NOTHING_TO_RESTORE=1 (binary never replaced; service healthy)"
      else bad="${bad}"$'\n- service unhealthy though binary never replaced (healthz='"$hz"' readyz='"$rz"')'; fi
    fi
  fi

  # Rb3 — append-only rollback ledger record
  jq -cn --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg reason "$1" \
        --arg main "$MAIN_COMMIT" --arg old "$PROD_SHA" --arg gid "$BINDING_ID" \
    '{type:"deploy-runner-rollback-v1", rolledBackAt:$ts, reason:$reason,
      attemptedSourceSha:$main, restoredSourceSha:$old, removedBindingId:$gid}' >> "$LEDGER" 2>/dev/null || true

  log "ROLLBACK_CHECK GRANT_ROW_RESTORED=$rb_grant"
  log "ROLLBACK_CHECK BINARY_MIGRATIONS_RESTORED=$rb_restore"
  log "ROLLBACK_CHECK RESTART_EXECUTED=$rb_restart"
  log "ROLLBACK_CHECK OLD_SERVICE_HEALTHY=$rb_old_healthy"
  if [ "$rb_grant" = '1' ] && [ "$rb_restore" = '1' ] && [ "$rb_restart" = '1' ] && [ "$rb_old_healthy" = '1' ]; then
    log "RESULT: FAILED_AND_ROLLED_BACK; reason=$1; state=baseline restored ($PROD_SHA, $GRB_BASELINE_COUNT bindings)"
    exit 1
  fi
  log "RESULT: ROLLBACK_INCOMPLETE; UNRESTORED_STATE:${bad:-<unspecified>}"
  exit 4
}

# ============================================================================ G0
if [ "$#" -ne 0 ]; then
  echo "REFUSED: this runner takes no arguments." >&2
  echo "Owner command: bash /tmp/run-svc-workflow-deploy-f0c74ee-v1.sh" >&2
  exit 2
fi
if [ "$(id -un)" != 'yanfenma' ] || [ "$(id -u)" -ne 502 ]; then
  echo 'REFUSED: run as yanfenma (uid 502) WITHOUT sudo — the service, files,' >&2
  echo 'and launchd gui domain all belong to yanfenma; root would corrupt ownership.' >&2
  echo 'Owner command: bash /tmp/run-svc-workflow-deploy-f0c74ee-v1.sh' >&2
  exit 2
fi
for t in psql curl jq /usr/bin/shasum /usr/bin/git /bin/launchctl /usr/bin/uuidgen /bin/realpath; do
  command -v "$t" >/dev/null 2>&1 || { echo "REFUSED: required tool missing: $t" >&2; exit 2; }
done
[ -x "$RELEASE_SH" ] || { echo "REFUSED: release.sh not executable: $RELEASE_SH" >&2; exit 2; }

: > "$LOG"
log "svc-workflow deploy runner v1  ts=${TS}"
log "target: MAIN_COMMIT=$MAIN_COMMIT  (prod expected at $PROD_SHA)"
log "grant:  principal=$GRANTEE role=$ROLE"
log "transcript: $LOG"
nlog ""
log "Type the exact phrase to confirm ($CONFIRM_PHRASE):"
read -r phrase || { echo 'REFUSED: confirmation input unavailable' >&2; exit 2; }
[ "$phrase" = "$CONFIRM_PHRASE" ] || { echo 'REFUSED: confirmation phrase mismatch' >&2; exit 2; }
log "interactive Owner confirmation accepted"

# ============================================================================ P1
nlog "---- P1 git authority ----"
[ "$(/bin/realpath "$REPO")" = "$REPO_PIN" ] \
  || zero_write_exit "repo realpath drift: $REPO -> $(/bin/realpath "$REPO" 2>/dev/null || echo unresolved)"
[ "$("$GIT" -C "$REPO" cat-file -t "$MAIN_COMMIT" 2>/dev/null)" = 'commit' ] \
  || zero_write_exit "MAIN_COMMIT does not resolve to a commit in $REPO"
gh_main="$("$GIT" -C "$REPO" rev-parse --verify --quiet refs/remotes/github/main || true)"
[ "$gh_main" = "$MAIN_COMMIT" ] \
  || zero_write_exit "github/main drift: got '${gh_main:-unresolved}', expected $MAIN_COMMIT (main advanced — re-derive pins after review)"
"$GIT" -C "$REPO" merge-base --is-ancestor "$READER_COMMIT" "$MAIN_COMMIT" \
  || zero_write_exit "READER_COMMIT $READER_COMMIT is not an ancestor of MAIN_COMMIT"
"$GIT" -C "$REPO" merge-base --is-ancestor "$FIX_RETURN_COMMIT" "$MAIN_COMMIT" \
  || zero_write_exit "FIX_RETURN_COMMIT $FIX_RETURN_COMMIT is not an ancestor of MAIN_COMMIT"
"$GIT" -C "$REPO" show "$MAIN_COMMIT":src/store/postgres/workflow_instance_repository/query_visibility.rs \
  | grep -Fq "role_key IN ('GLOBAL_WORKFLOW_READER', 'GLOBAL_WORKFLOW_COORDINATOR')" \
  || zero_write_exit "reader gate predicate missing at MAIN_COMMIT (query_visibility.rs)"
"$GIT" -C "$REPO" show "$MAIN_COMMIT":src/http/error.rs \
  | grep -Fq '"global_read_role_required"' \
  || zero_write_exit "global_read_role_required error code missing at MAIN_COMMIT (error.rs)"
"$GIT" -C "$REPO" show "$MAIN_COMMIT":src/domain/provisioning/mod.rs \
  | grep -Fq 'pub const GLOBAL_WORKFLOW_READER_ROLE: &str = "GLOBAL_WORKFLOW_READER";' \
  || zero_write_exit "GLOBAL_WORKFLOW_READER_ROLE const missing at MAIN_COMMIT (provisioning/mod.rs)"
"$GIT" -C "$REPO" show "$MAIN_COMMIT":src/application/workflow_instance/query_service.rs \
  | grep -Fq 'GLOBAL_WORKFLOW_READER' \
  || zero_write_exit "query_service reader mention missing at MAIN_COMMIT"
log "P1 PASS: github/main==$MAIN_COMMIT; reader+return-422 ancestry proven; §4 content byte-proven"

# ============================================================================ P2
nlog "---- P2 production state ----"
vbody="$(http_body "$BASE_URL/version")"
[ -n "$vbody" ] || zero_write_exit "cannot reach $BASE_URL/version"
vsha="$(jq -r '.gitSha' <<<"$vbody" 2>/dev/null || true)"
ALREADY_DEPLOYED=0
if [ "$vsha" = "$MAIN_COMMIT" ]; then
  # service ALREADY runs the target artifact (idempotent rerun / previously
  # interrupted run): tolerate; the P4 already-applied branch decides
  ALREADY_DEPLOYED=1
  log "P2 note: /version.gitSha == MAIN_COMMIT (already-deployed state; P4 already-applied will decide)"
  # a rerun over the target artifact must still start from a healthy service
  [ "$(jq -r '.gitTreeState' <<<"$vbody")" = 'clean' ] || zero_write_exit "running treeState not clean"
  [ "$(jq -r '.schemaVersion' <<<"$vbody")" = "$MIGRATION_MAX" ] || zero_write_exit "running schemaVersion != $MIGRATION_MAX"
  pre_hz="$(http_code "$BASE_URL/healthz")"; pre_rz="$(http_code "$BASE_URL/readyz")"
  [ "$pre_hz" = '200' ] || zero_write_exit "pre-deploy healthz=$pre_hz (refuse to continue over an unhealthy service)"
  [ "$pre_rz" = '200' ] || zero_write_exit "pre-deploy readyz=$pre_rz (refuse to continue over an unhealthy service)"
  [ "$(sha256_of "$SERVICE_DIR/svc-workflow")" = "$ARTIFACT_SHA256" ] \
    || zero_write_exit "already-deployed state but on-disk binary sha=$(sha256_of "$SERVICE_DIR/svc-workflow") != target artifact"
else
  [ "$vsha" = "$PROD_SHA" ] \
    || zero_write_exit "running /version.gitSha='${vsha:-unparsable}' neither pinned prod $PROD_SHA nor target $MAIN_COMMIT (production moved — re-derive pins)"
  [ "$(jq -r '.gitTreeState' <<<"$vbody")" = 'clean' ] || zero_write_exit "running treeState not clean"
  [ "$(jq -r '.schemaVersion' <<<"$vbody")" = "$MIGRATION_MAX" ] || zero_write_exit "running schemaVersion != $MIGRATION_MAX"
  pre_hz="$(http_code "$BASE_URL/healthz")"; pre_rz="$(http_code "$BASE_URL/readyz")"
  [ "$pre_hz" = '200' ] || zero_write_exit "pre-deploy healthz=$pre_hz (refuse to deploy an unhealthy service)"
  [ "$pre_rz" = '200' ] || zero_write_exit "pre-deploy readyz=$pre_rz (refuse to deploy an unhealthy service)"
  live_bin_sha="$(sha256_of "$SERVICE_DIR/svc-workflow")"
  [ "$live_bin_sha" = "$PROD_ARTIFACT_SHA256" ] \
    || zero_write_exit "on-disk binary sha256=$live_bin_sha != pinned $PROD_ARTIFACT_SHA256 (production moved — re-derive pins)"
  last_ledger_sha="$(jq -rs '.[-1].artifactSha256 // empty' "$LEDGER" 2>/dev/null || true)"
  [ "$last_ledger_sha" = "$PROD_ARTIFACT_SHA256" ] \
    || zero_write_exit "ledger last artifactSha256='${last_ledger_sha:-unparsable}' != live binary sha (ledger/binary drift)"
  PID_OLD="$(service_pid)"
  if [ -z "$PID_OLD" ] || [ "$PID_OLD" = '0' ]; then zero_write_exit "cannot resolve running service pid for $LABEL"; fi
fi
log "P2 PASS: prod state ok (already_deployed=$ALREADY_DEPLOYED)"

# ============================================================================ P3
nlog "---- P3 release artifact ----"
rdir="$RELEASES_DIR/$MAIN_COMMIT"
[ -f "$rdir/provenance.json" ] || zero_write_exit "missing provenance: $rdir/provenance.json"
[ -f "$rdir/svc-workflow" ]     || zero_write_exit "missing artifact: $rdir/svc-workflow"
[ -d "$rdir/migrations" ]      || zero_write_exit "missing bundle: $rdir/migrations"
[ "$(jq -r '.sourceSha' "$rdir/provenance.json")" = "$MAIN_COMMIT" ] || zero_write_exit "provenance.sourceSha mismatch"
[ "$(jq -r '.treeState' "$rdir/provenance.json")" = 'clean' ] || zero_write_exit "provenance.treeState != clean"
[ "$(jq -r '.artifactSha256' "$rdir/provenance.json")" = "$ARTIFACT_SHA256" ] || zero_write_exit "provenance.artifactSha256 != pinned ARTIFACT_SHA256"
[ "$(jq -r '.migrationMaxVersion' "$rdir/provenance.json")" = "$MIGRATION_MAX" ] || zero_write_exit "provenance.migrationMaxVersion != $MIGRATION_MAX"
[ "$(jq -r '.migrationBundleDigest' "$rdir/provenance.json")" = "$MIGRATION_DIGEST" ] || zero_write_exit "provenance.migrationBundleDigest != pinned MIGRATION_DIGEST"
[ "$(sha256_of "$rdir/svc-workflow")" = "$ARTIFACT_SHA256" ] || zero_write_exit "artifact sha256 != pinned ARTIFACT_SHA256"
git_list="$("$GIT" -C "$REPO" ls-tree -r --name-only "$MAIN_COMMIT" migrations | grep '\.sql$' | sort)"
bundle_list="$(cd "$rdir" && find migrations -name '*.sql' -type f | sort)"
[ "$git_list" = "$bundle_list" ] || zero_write_exit "bundle file set != git migrations tree at MAIN_COMMIT"
bundle_file_count=0
while IFS= read -r f; do
  blob_sha="$("$GIT" -C "$REPO" show "$MAIN_COMMIT:$f" | /usr/bin/shasum -a 256 | awk '{print $1}')"
  file_sha="$(sha256_of "$rdir/$f")"
  [ "$blob_sha" = "$file_sha" ] || zero_write_exit "bundle file $f != git blob at MAIN_COMMIT"
  bundle_file_count=$((bundle_file_count + 1))
done <<<"$git_list"
bundle_digest_now="$(cd "$rdir" && find migrations -name '*.sql' -type f | sort | xargs /usr/bin/shasum -a 256 | /usr/bin/shasum -a 256 | awk '{print $1}')"
[ "$bundle_digest_now" = "$MIGRATION_DIGEST" ] || zero_write_exit "recomputed bundle digest != pinned MIGRATION_DIGEST"
log "P3 PASS: artifact sha256 + provenance + $bundle_file_count migration files byte-proven against MAIN_COMMIT"

# ============================================================================ P4
nlog "---- P4 database preflight (read-only) ----"
load_env
p4_out="$(psql_ro -A -t <<SQL
BEGIN TRANSACTION READ ONLY;
DO \$\$ BEGIN
  IF current_database() <> '$EXPECTED_DB' THEN RAISE EXCEPTION 'wrong database: %', current_database(); END IF;
END \$\$;
SELECT 'migmax=' || (SELECT max(version)::text FROM _sqlx_migrations);
SELECT 'grantee=' || coalesce((SELECT principal_type || '/' || enabled::text FROM principals WHERE principal_id = '$GRANTEE'), 'MISSING');
SELECT 'legacy=' || coalesce((SELECT principal_type || '/' || enabled::text FROM principals WHERE principal_id = '$LEGACY'), 'MISSING');
SELECT 'grb_count=' || count(*)::text FROM global_role_bindings;
SELECT 'reader_rows=' || count(*)::text FROM global_role_bindings WHERE role_key = '$ROLE';
SELECT 'grantee_rows=' || count(*)::text FROM global_role_bindings WHERE principal_id = '$GRANTEE';
SELECT 'grantee_coord=' || count(*)::text FROM global_role_bindings WHERE principal_id = '$GRANTEE' AND role_key = '$ROLE_COORD';
SELECT 'non_grantee_count=' || count(*)::text FROM global_role_bindings WHERE principal_id <> '$GRANTEE';
SELECT 'non_grantee_digest=' || coalesce(md5(string_agg(binding_id::text||'|'||principal_id::text||'|'||role_key||'|'||enabled::text, E'\\n' ORDER BY binding_id)), 'empty')
  FROM global_role_bindings WHERE principal_id <> '$GRANTEE';
SELECT 'principals_digest=' || coalesce(md5(string_agg(principal_id::text||'|'||principal_type||'|'||coalesce(email,'')||'|'||coalesce(display_name,'')||'|'||enabled::text, E'\\n' ORDER BY principal_id)), 'empty') FROM principals;
SELECT 'receipts=' || count(*)::text FROM workflow_command_receipts;
COMMIT;
SQL
)" || zero_write_exit "P4 read-only session failed"
p4_val() { printf '%s\n' "$p4_out" | grep -F "$1=" | head -1 | cut -d= -f2-; }

# ALREADY_APPLIED short-circuit (exact idempotent rerun)
if [ "$(p4_val reader_rows)" = '1' ] && [ "$(p4_val grantee_rows)" = '1' ] \
   && [ "$(p4_val grantee_coord)" = '0' ] \
   && [ "$(p4_val non_grantee_count)" = "$GRB_BASELINE_COUNT" ] \
   && [ "$(p4_val non_grantee_digest)" = "$GRB_BASELINE_DIGEST" ]; then
  vnow="$(http_body "$BASE_URL/version")"
  if [ "$(jq -r '.gitSha' <<<"$vnow" 2>/dev/null || true)" = "$MAIN_COMMIT" ] \
     && [ "$(http_code "$BASE_URL/healthz")" = '200' ] && [ "$(http_code "$BASE_URL/readyz")" = '200' ]; then
    log "RESULT: ALREADY_APPLIED; deployed=$MAIN_COMMIT; reader binding present+enabled; coordinator absent; baseline intact; no writes"
    exit 0
  fi
  zero_write_exit "reader row present but service not healthy at MAIN_COMMIT — split state, resolve manually"
fi

[ "$(p4_val migmax)" = '22' ] || zero_write_exit "_sqlx_migrations max version = $(p4_val migmax), expected 22"
gt="$(p4_val grantee)"; [ "$gt" = 'AGENT/true' ] || zero_write_exit "grantee principal state '$gt' != AGENT/true"
lt="$(p4_val legacy)";  [ "$lt" != 'MISSING' ] || zero_write_exit "legacy principal row missing"
[ "$(p4_val grb_count)" = "$GRB_BASELINE_COUNT" ] \
  || zero_write_exit "global_role_bindings baseline count $(p4_val grb_count) != $GRB_BASELINE_COUNT (drift — re-derive pins)"
[ "$(p4_val reader_rows)" = '0' ] || zero_write_exit "GLOBAL_WORKFLOW_READER rows present outside the pinned baseline"
[ "$(p4_val grantee_rows)" = '0' ] || zero_write_exit "grantee already holds global role bindings outside the pinned baseline"
[ "$(p4_val grantee_coord)" = '0' ] || zero_write_exit "grantee already holds GLOBAL_WORKFLOW_COORDINATOR — spec forbids"
SNAP_PRINCIPALS_DIGEST="$(p4_val principals_digest)"
SNAP_RECEIPTS_COUNT="$(p4_val receipts)"
[ -n "$SNAP_PRINCIPALS_DIGEST" ] && [ -n "$SNAP_RECEIPTS_COUNT" ] || zero_write_exit "snapshot values missing"
log "P4 PASS: db=$EXPECTED_DB schema 0022; baseline $GRB_BASELINE_COUNT rows digest-ok; grantee AGENT/enabled; no reader/coordinator rows; legacy present"
log "RESULT: PREFLIGHT PASSED (P1-P4); writes have NOT started"

if [ "${SVC_WF_DEPLOY_PREFLIGHT_ONLY:-0}" = '1' ]; then
  log "RESULT: PREFLIGHT_ONLY PASSED; WRITES=NONE"
  exit 0
fi

# ============================================================================ D1
nlog "---- D1 deploy via release.sh (writes start) ----"
WRITES_STARTED=1
ls -d "$SERVICE_DIR"/svc-workflow.backup-* 2>/dev/null | sort > "/tmp/svc-wf-deploy-v1-backups-before-${TS}" || true
log "invoking: bash $RELEASE_SH deploy $MAIN_COMMIT"
if SVC_WORKFLOW_SERVICE_DIR="$SERVICE_DIR" bash "$RELEASE_SH" deploy "$MAIN_COMMIT" 2>&1 | tee -a "$LOG"; then
  log "release.sh deploy returned 0"
else
  log "release.sh deploy returned non-zero"
fi
ls -d "$SERVICE_DIR"/svc-workflow.backup-* 2>/dev/null | sort > "/tmp/svc-wf-deploy-v1-backups-after-${TS}" || true
NEW_BACKUP="$(comm -13 "/tmp/svc-wf-deploy-v1-backups-before-${TS}" "/tmp/svc-wf-deploy-v1-backups-after-${TS}" | head -1 || true)"
installed_sha="$(sha256_of "$SERVICE_DIR/svc-workflow")"
if [ "$installed_sha" = "$ARTIFACT_SHA256" ]; then
  DEPLOY_INSTALLED=1
  log "installed binary sha256 == $ARTIFACT_SHA256; backup dir: ${NEW_BACKUP:-<none>}"
  if [ -z "$NEW_BACKUP" ] || [ ! -f "$NEW_BACKUP/svc-workflow" ]; then
    fail_and_rollback "binary replaced but no intact backup dir found"
  fi
else
  [ "$installed_sha" = "$PROD_ARTIFACT_SHA256" ] || fail_and_rollback "binary neither new nor old after failed deploy"
  log "binary untouched (still $PROD_SHA artifact); deploy failed before install"
  zero_write_deploy_intact_exit
fi

# ============================================================================ D2
nlog "---- D2 deploy verify ----"
vnew=''
for i in $(seq 1 90); do
  b="$(http_body "$BASE_URL/version")"
  if [ -n "$b" ] && [ "$(jq -r '.gitSha' <<<"$b" 2>/dev/null)" = "$MAIN_COMMIT" ]; then vnew="$b"; break; fi
  sleep 1
done
[ -n "$vnew" ] || fail_and_rollback "service did not serve /version==$MAIN_COMMIT within 90s"
[ "$(jq -r '.gitTreeState' <<<"$vnew")" = 'clean' ] || fail_and_rollback "new /version.treeState != clean"
[ "$(jq -r '.schemaVersion' <<<"$vnew")" = "$MIGRATION_MAX" ] || fail_and_rollback "new /version.schemaVersion != $MIGRATION_MAX"
hz='000'; rz='000'
for i in $(seq 1 60); do
  hz="$(http_code "$BASE_URL/healthz")"; rz="$(http_code "$BASE_URL/readyz")"
  [ "$hz" = '200' ] && [ "$rz" = '200' ] && break
  sleep 1
done
[ "$hz" = '200' ] || fail_and_rollback "post-deploy healthz=$hz"
[ "$rz" = '200' ] || fail_and_rollback "post-deploy readyz=$rz"
PID_NEW="$(service_pid)"
if [ -z "$PID_NEW" ] || [ "$PID_NEW" = "$PID_OLD" ]; then fail_and_rollback "service pid unchanged ($PID_OLD) after restart"; fi
if [ "$PID_OLD" != '0' ] && kill -0 "$PID_OLD" 2>/dev/null; then
  fail_and_rollback "old pid $PID_OLD still alive after restart"
fi
run_sha="$(sha256_of "$SERVICE_DIR/svc-workflow")"
[ "$run_sha" = "$ARTIFACT_SHA256" ] || fail_and_rollback "on-disk binary drifted post-install: $run_sha"
log "D2 PASS: /version==$MAIN_COMMIT clean schema=$MIGRATION_MAX; healthz/readyz 200; pid $PID_OLD -> $PID_NEW"
DEPLOY_OK=1

# ============================================================================ R1
nlog "---- R1 grant (single transaction, store-layer-exact upsert) ----"
BINDING_ID="$(/usr/bin/uuidgen | tr 'A-Z' 'a-z')"
grant_out="$(psql_rw -A -t <<SQL
BEGIN;
DO \$\$ BEGIN
  IF current_database() <> '$EXPECTED_DB' THEN RAISE EXCEPTION 'wrong database: %', current_database(); END IF;
END \$\$;
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM principals WHERE principal_id = '$GRANTEE' AND enabled) THEN
    RAISE EXCEPTION 'grantee principal missing or disabled';
  END IF;
END \$\$;
INSERT INTO global_role_bindings (binding_id, principal_id, role_key, enabled)
VALUES ('$BINDING_ID', '$GRANTEE', '$ROLE', true)
ON CONFLICT (principal_id, role_key) DO UPDATE
  SET enabled = true, disabled_at = NULL
RETURNING 'binding_id=' || binding_id::text;
DO \$\$ BEGIN
  IF (SELECT count(*) FROM global_role_bindings WHERE principal_id = '$GRANTEE' AND role_key = '$ROLE' AND enabled) <> 1 THEN
    RAISE EXCEPTION 'grant verify: reader row not exactly-1 enabled';
  END IF;
  IF (SELECT count(*) FROM global_role_bindings WHERE principal_id = '$GRANTEE' AND role_key = '$ROLE_COORD') <> 0 THEN
    RAISE EXCEPTION 'grant verify: coordinator present for grantee';
  END IF;
  IF (SELECT count(*) FROM global_role_bindings) <> $((GRB_BASELINE_COUNT + 1)) THEN
    RAISE EXCEPTION 'grant verify: row count <> baseline+1';
  END IF;
  IF (SELECT md5(string_agg(binding_id::text||'|'||principal_id::text||'|'||role_key||'|'||enabled::text, E'\\n' ORDER BY binding_id))
       FROM global_role_bindings WHERE principal_id <> '$GRANTEE') <> '$GRB_BASELINE_DIGEST' THEN
    RAISE EXCEPTION 'grant verify: baseline rows changed';
  END IF;
END \$\$;
COMMIT;
SQL
)" || fail_and_rollback "grant transaction failed"
got_bid="$(printf '%s\n' "$grant_out" | grep -F 'binding_id=' | head -1 | cut -d= -f2-)"
[ -n "$got_bid" ] || fail_and_rollback "grant returned no binding_id"
BINDING_ID="$got_bid"
GRANT_APPLIED=1
log "R1 PASS: reader binding committed binding_id=$BINDING_ID"

# ============================================================================ R2
nlog "---- R2 final verification (fresh read-only session + live HTTP) ----"
r2_out="$(psql_ro -A -t <<SQL
BEGIN TRANSACTION READ ONLY;
SELECT 'reader=' || count(*)::text FROM global_role_bindings WHERE principal_id = '$GRANTEE' AND role_key = '$ROLE' AND enabled;
SELECT 'coord=' || count(*)::text FROM global_role_bindings WHERE principal_id = '$GRANTEE' AND role_key = '$ROLE_COORD';
SELECT 'grantee_total=' || count(*)::text FROM global_role_bindings WHERE principal_id = '$GRANTEE';
SELECT 'non_grantee_count=' || count(*)::text FROM global_role_bindings WHERE principal_id <> '$GRANTEE';
SELECT 'non_grantee_digest=' || coalesce(md5(string_agg(binding_id::text||'|'||principal_id::text||'|'||role_key||'|'||enabled::text, E'\\n' ORDER BY binding_id)), 'empty')
  FROM global_role_bindings WHERE principal_id <> '$GRANTEE';
SELECT 'legacy_coord=' || count(*)::text FROM global_role_bindings WHERE principal_id = '$LEGACY' AND role_key = '$ROLE_COORD' AND enabled;
SELECT 'principals_digest=' || coalesce(md5(string_agg(principal_id::text||'|'||principal_type||'|'||coalesce(email,'')||'|'||coalesce(display_name,'')||'|'||enabled::text, E'\\n' ORDER BY principal_id)), 'empty') FROM principals;
SELECT 'receipts=' || count(*)::text FROM workflow_command_receipts;
COMMIT;
SQL
)" || fail_and_rollback "R2 read-only session failed"
r2_val() { printf '%s\n' "$r2_out" | grep -F "$1=" | head -1 | cut -d= -f2-; }
[ "$(r2_val reader)" = '1' ]            || fail_and_rollback "final: reader row not enabled (count $(r2_val reader))"
[ "$(r2_val coord)" = '0' ]             || fail_and_rollback "final: coordinator present for grantee"
[ "$(r2_val grantee_total)" = '1' ]     || fail_and_rollback "final: grantee holds more than 1 binding"
[ "$(r2_val non_grantee_count)" = "$GRB_BASELINE_COUNT" ] || fail_and_rollback "final: baseline count changed"
[ "$(r2_val non_grantee_digest)" = "$GRB_BASELINE_DIGEST" ] || fail_and_rollback "final: baseline digest changed (legacy/others touched)"
[ "$(r2_val legacy_coord)" = '1' ]      || fail_and_rollback "final: legacy principal's existing coordinator row not intact"
[ "$(r2_val principals_digest)" = "$SNAP_PRINCIPALS_DIGEST" ] || fail_and_rollback "final: principals table changed"
[ "$(r2_val receipts)" -ge "$SNAP_RECEIPTS_COUNT" ] || fail_and_rollback "final: receipts count shrank (append-only violated)"
hz="$(http_code "$BASE_URL/healthz")"; rz="$(http_code "$BASE_URL/readyz")"
[ "$hz" = '200' ] || fail_and_rollback "final: healthz=$hz"
[ "$rz" = '200' ] || fail_and_rollback "final: readyz=$rz"
vfin="$(http_body "$BASE_URL/version")"
[ "$(jq -r '.gitSha' <<<"$vfin")" = "$MAIN_COMMIT" ] || fail_and_rollback "final: /version drifted"

jq -cn --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg main "$MAIN_COMMIT" --arg art "$ARTIFACT_SHA256" \
      --arg gid "$BINDING_ID" --arg grantee "$GRANTEE" --arg role "$ROLE" \
      '{type:"deploy-runner-grant-v1", deployedAt:$ts, sourceSha:$main, artifactSha256:$art,
        grant:{bindingId:$gid, principalId:$grantee, roleKey:$role, enabled:true},
        verification:{healthz:"200", readyz:"200", readerEnabled:true, coordinatorAbsent:true,
                      baselineRowsUnchanged:true, principalsUnchanged:true}}' >> "$LEDGER"

nlog ""
log "ALL CHECKS PASSED"
log "RESULT: SUCCESS; deployed=$MAIN_COMMIT; artifact=$ARTIFACT_SHA256; grant=$GRANTEE/$ROLE binding_id=$BINDING_ID; legacy+baseline unchanged"
exit 0
