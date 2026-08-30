#!/bin/bash
# Sandbox verification matrix for /tmp/run-svc-workflow-deploy-f0c74ee-v1.sh
# TESTVARIANT + scenarios S1-S7. Production is NEVER touched: the variant
# redirects SERVICE_DIR/BASE_URL/RELEASE_SH and neutralizes the two launchctl
# seams; every production invariant is asserted unchanged at the end.
set -u
SBX=/tmp/svc-wf-deploy-sbx
SVCDIR=$SBX/service
RUNNER=/tmp/run-svc-workflow-deploy-f0c74ee-v1.sh
TV=$SBX/run-svc-workflow-deploy-TESTVARIANT.sh
REL=f0c74eefd63ca71a1fcb670ad31ac35f19f69539
NEW_SHA=4e633634b313f8c926ccaf7da07f3bfd9dbf25f024a4b63a3f0a88c5a0200356
OLD_SHA=1e3fa45c53d7a5c48e9b4c3fe071ebc475327b77ac0659b7a4e91c65e6df8125
PHRASE='APPLY SVC_WORKFLOW_DEPLOY_F0C74EE_READER_V1'
PASS=0; FAIL=0; RESULTS=""

PRODDSN=$(grep '^DATABASE_URL=' /Users/yanfenma/.local/services/svc-workflow/.env | cut -d= -f2-)
SBXDSN=$(printf '%s' "$PRODDSN" | sed -E 's|:[0-9]+/|:5433/|')
export PGPASSWORD=$(printf '%s' "$SBXDSN" | sed -E 's|^postgresql://[^:]+:([^@]*)@.*|\1|')
PSQ() { psql -h 127.0.0.1 -p 5433 -U svc_wf -d svc_workflow_dogfood_clean -X -A -t -c "$1"; }

ok()  { PASS=$((PASS+1)); RESULTS="$RESULTS\nPASS  $1"; echo "PASS  $1"; }
bad() { FAIL=$((FAIL+1)); RESULTS="$RESULTS\nFAIL  $1"; echo "FAIL  $1"; }
chk() { if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1: got '$2' want '$3'"; fi; }

sha_of() { shasum -a 256 "$1" | awk '{print $1}'; }

reset_state() {
  rm -f $SBX/flags/*
  # DB back to seeded baseline (CASCADE: sandbox only; re-creates the unique index S5 drops)
  PSQ "TRUNCATE principals, global_role_bindings, workflow_command_receipts CASCADE;" >/dev/null 2>&1
  psql -h 127.0.0.1 -p 5433 -U svc_wf -d svc_workflow_dogfood_clean -X -q -v ON_ERROR_STOP=1 -f $SBX/seed.sql >/dev/null 2>&1
  PSQ "CREATE UNIQUE INDEX IF NOT EXISTS idx_grb_principal_role ON global_role_bindings (principal_id, role_key);" >/dev/null
  rm -f $SBX/hits $SBX/hit-threshold
  # service dir back to old binary
  rm -rf "$SVCDIR/svc-workflow.backup-"* "$SVCDIR/service.backup-"*
  cp "$SBX/pristine-old-binary" "$SVCDIR/svc-workflow"
  rm -rf "$SVCDIR/migrations"; cp -R "$SBX/pristine-migrations" "$SVCDIR/migrations"
  jq -cn '{deployedAt:"2026-08-16T01:00:00Z",sourceSha:"91fc4e40f400ee9cc17351f857a1ab2860682681",artifactSha256:"'"$OLD_SHA"'"}' > "$SVCDIR/ledger.json"
  rm -f $SBX/pid_counter
}

run_tv() { echo "$PHRASE" | bash "$TV" > "$SBX/last-run.log" 2>&1; echo $?; }

# ---------- build TESTVARIANT (6 documented line patches, everything else identical)
sed \
 -e "s|^SERVICE_DIR='/Users/yanfenma/.local/services/svc-workflow'|SERVICE_DIR='$SVCDIR'|" \
 -e "s|^BASE_URL='http://127.0.0.1:8989'|BASE_URL='http://127.0.0.1:8990'|" \
 -e 's|^RELEASE_SH="\$REPO/scripts/release.sh"|RELEASE_SH="/tmp/svc-wf-deploy-sbx/release-patched.sh"|' \
 -e 's|^restart_service() { /bin/launchctl kickstart -k "gui/\$(id -u)/\$LABEL"; }|restart_service() { echo "[TESTVARIANT] restart_service neutralized"; }|' \
 -e 's|^service_pid() { /bin/launchctl print "gui/\$(id -u)/\$LABEL" 2>/dev/null \| awk '"'"'/\^\[\[:space:\]\]\*pid =/{print \$3; exit}'"'"'; }|service_pid() { local f=/tmp/svc-wf-deploy-sbx/pid_counter; local n; n=$(cat "$f" 2>/dev/null \|\| echo 0); n=$((n+1)); echo "$n" > "$f"; echo $((4700000+n)); }|' \
 -e 's|^if bash "\$RELEASE_SH" deploy|if SVC_WORKFLOW_SERVICE_DIR="\$SERVICE_DIR" bash "$RELEASE_SH" deploy|' \
 "$RUNNER" > "$TV"
if diff <(grep -c '') "$TV" >/dev/null 2>&1; then :; fi
N1=$(wc -l < "$RUNNER"); N2=$(wc -l < "$TV")
if [ "$N1" = "$N2" ]; then ok "TESTVARIANT line count matches sealed runner ($N2)"; else bad "TESTVARIANT line count $N2 != $N1 (sed patch malformed)"; fi
DIFFN=$(diff "$RUNNER" "$TV" | grep -c '^[<>]')
chk "TESTVARIANT diff hunks = 12 lines (6 patches x 2)" "$DIFFN" "12"

# pristine copies for reset — taken from the REAL production service dir
# (constant old artiФact), never from the mutable sandbox dir
cp /Users/yanfenma/.local/services/svc-workflow/svc-workflow "$SBX/pristine-old-binary"
rm -rf "$SBX/pristine-migrations"
cp -R /Users/yanfenma/.local/services/svc-workflow/migrations "$SBX/pristine-migrations"
rm -rf "$SVCDIR/svc-workflow.backup-"*; cp "$SBX/pristine-old-binary" "$SVCDIR/svc-workflow"; rm -rf "$SVCDIR/migrations"; cp -R "$SBX/pristine-migrations" "$SVCDIR/migrations"

echo "=============== S4: baseline drift => zero-write refusal"
reset_state
PSQ "INSERT INTO global_role_bindings (binding_id, principal_id, role_key, enabled) VALUES ('$(uuidgen | tr 'A-Z' 'a-z')', '10000000-0000-0000-0000-000000000001', 'GLOBAL_WORKFLOW_COORDINATOR', true);" >/dev/null
rc=$(run_tv)
chk "S4 exit code = 2 (zero-write gate)" "$rc" "2"
grep -q "global_role_bindings baseline count 7 != 6" "$SBX/last-run.log" && ok "S4 refusal names count drift" || bad "S4 refusal message missing"
chk "S4 binary untouched (old)" "$(sha_of "$SVCDIR/svc-workflow")" "$OLD_SHA"
chk "S4 injected row still present (7)" "$(PSQ 'SELECT count(*) FROM global_role_bindings;')" "7"
chk "S4 no backup dirs created" "$(ls -d "$SVCDIR"/svc-workflow.backup-* 2>/dev/null | wc -l | tr -d ' ')" "0"

echo "=============== S5: grant SQL failure => full rollback"
reset_state
PSQ "DROP INDEX idx_grb_principal_role;" >/dev/null
rc=$(run_tv)
chk "S5 exit code = 1 (FAILED_AND_ROLLED_BACK)" "$rc" "1"
grep -q "RESULT: FAILED_AND_ROLLED_BACK" "$SBX/last-run.log" && ok "S5 reports FAILED_AND_ROLLED_BACK" || bad "S5 missing FAILED_AND_ROLLED_BACK"
chk "S5 binary restored (old)" "$(sha_of "$SVCDIR/svc-workflow")" "$OLD_SHA"
chk "S5 DB reader rows = 0" "$(PSQ "SELECT count(*) FROM global_role_bindings WHERE role_key='GLOBAL_WORKFLOW_READER';")" "0"
grep -q 'ROLLBACK_CHECK OLD_SERVICE_HEALTHY=1' "$SBX/last-run.log" && ok "S5 rollback health proof" || bad "S5 rollback health proof missing"
jq -rs '.[-1].type' "$SVCDIR/ledger.json" | grep -q deploy-runner-rollback && ok "S5 ledger rollback record appended" || bad "S5 ledger rollback record missing"

echo "=============== S6: post-deploy unhealthiness survives restore => ROLLBACK_INCOMPLETE"
reset_state
# stub fails healthz after hit #6 (pre-deploy P2 consumes 2; D2 probes cross the threshold,
# and the rolled-back old service is ALSO unhealthy) -> restore succeeds, old-healthy check fails
echo 2 > $SBX/hit-threshold
rc=$(run_tv)
chk "S6 exit code = 4 (ROLLBACK_INCOMPLETE)" "$rc" "4"
grep -q "ROLLBACK_INCOMPLETE" "$SBX/last-run.log" && ok "S6 reports ROLLBACK_INCOMPLETE" || bad "S6 missing ROLLBACK_INCOMPLETE"
grep -q "UNRESTORED_STATE" "$SBX/last-run.log" && ok "S6 names UNRESTORED_STATE" || bad "S6 UNRESTORED_STATE missing"
chk "S6 binary restored (old) though incomplete" "$(sha_of "$SVCDIR/svc-workflow")" "$OLD_SHA"
grep -q 'ROLLBACK_CHECK OLD_SERVICE_HEALTHY=0' "$SBX/last-run.log" && ok "S6 old-healthy failed as designed" || bad "S6 old-healthy did not fail"

echo "=============== S3: version never flips => rollback after timeout"
reset_state
touch $SBX/flags/version_hang
rc=$(run_tv)
chk "S3 exit code = 1" "$rc" "1"
grep -q "did not serve /version==" "$SBX/last-run.log" && ok "S3 failure names version timeout" || bad "S3 failure reason missing"
chk "S3 binary restored" "$(sha_of "$SVCDIR/svc-workflow")" "$OLD_SHA"
chk "S3 DB reader rows = 0" "$(PSQ "SELECT count(*) FROM global_role_bindings WHERE role_key='GLOBAL_WORKFLOW_READER';")" "0"

echo "=============== S2: new binary unhealthy => rollback"
reset_state
touch $SBX/flags/healthz_newbreak
rc=$(run_tv)
chk "S2 exit code = 1" "$rc" "1"
grep -q "post-deploy healthz=500" "$SBX/last-run.log" && ok "S2 failure names healthz" || bad "S2 failure reason missing"
chk "S2 binary restored" "$(sha_of "$SVCDIR/svc-workflow")" "$OLD_SHA"
grep -q 'ROLLBACK_CHECK OLD_SERVICE_HEALTHY=1' "$SBX/last-run.log" && ok "S2 old service healthy after restore" || bad "S2 old-healthy proof missing"

echo "=============== S1: full success path"
reset_state
rc=$(run_tv)
chk "S1 exit code = 0" "$rc" "0"
grep -q "RESULT: SUCCESS" "$SBX/last-run.log" && ok "S1 reports SUCCESS" || bad "S1 missing SUCCESS"
chk "S1 binary == new artifact" "$(sha_of "$SVCDIR/svc-workflow")" "$NEW_SHA"
chk "S1 reader enabled = 1" "$(PSQ "SELECT count(*) FROM global_role_bindings WHERE principal_id='dc702687-6515-4a2a-91ae-e572a9bbd766' AND role_key='GLOBAL_WORKFLOW_READER' AND enabled;")" "1"
chk "S1 coordinator absent = 0" "$(PSQ "SELECT count(*) FROM global_role_bindings WHERE principal_id='dc702687-6515-4a2a-91ae-e572a9bbd766' AND role_key='GLOBAL_WORKFLOW_COORDINATOR';")" "0"
chk "S1 grantee total rows = 1" "$(PSQ "SELECT count(*) FROM global_role_bindings WHERE principal_id='dc702687-6515-4a2a-91ae-e572a9bbd766';")" "1"
chk "S1 non-grantee baseline intact" "$(PSQ "SELECT md5(string_agg(binding_id::text||'|'||principal_id::text||'|'||role_key||'|'||enabled::text, E'\n' ORDER BY binding_id)) FROM global_role_bindings WHERE principal_id <> 'dc702687-6515-4a2a-91ae-e572a9bbd766';")" "94d8249cb24587ac75bb3d46c8ddefdb"
chk "S1 legacy coordinator intact = 1" "$(PSQ "SELECT count(*) FROM global_role_bindings WHERE principal_id='bc970ced-710f-4479-9ff0-e295a1c59424' AND role_key='GLOBAL_WORKFLOW_COORDINATOR' AND enabled;")" "1"
chk "S1 principals unchanged (232)" "$(PSQ 'SELECT count(*) FROM principals;')" "232"
jq -rs '.[-1].type' "$SVCDIR/ledger.json" | grep -q deploy-runner-grant && ok "S1 ledger grant record appended" || bad "S1 ledger grant record missing"
BK=$(ls -d "$SVCDIR"/svc-workflow.backup-* 2>/dev/null | head -1)
[ -n "$BK" ] && chk "S1 backup holds old binary" "$(sha_of "$BK/svc-workflow")" "$OLD_SHA" || bad "S1 backup dir missing"

echo "=============== S7: idempotent rerun => ALREADY_APPLIED"
LED_BEFORE=$(wc -l < "$SVCDIR/ledger.json" | tr -d ' ')
rc=$(run_tv)
chk "S7 exit code = 0" "$rc" "0"
grep -q "RESULT: ALREADY_APPLIED" "$SBX/last-run.log" && ok "S7 reports ALREADY_APPLIED" || bad "S7 missing ALREADY_APPLIED"
chk "S7 DB still 7 rows" "$(PSQ 'SELECT count(*) FROM global_role_bindings;')" "7"
chk "S7 ledger unchanged" "$(wc -l < "$SVCDIR/ledger.json" | tr -d ' ')" "$LED_BEFORE"
chk "S7 binary still new" "$(sha_of "$SVCDIR/svc-workflow")" "$NEW_SHA"

echo "=============== production invariants (assert untouched by the whole matrix)"
chk "PROD binary unchanged" "$(sha_of /Users/yanfenma/.local/services/svc-workflow/svc-workflow)" "$OLD_SHA"
unset PGPASSWORD
PRODPW=$(printf '%s' "$PRODDSN" | sed -E 's|^postgresql://[^:]+:([^@]*)@.*|\1|')
chk "PROD grb baseline unchanged" "$(PGPASSWORD="$PRODPW" psql -h 127.0.0.1 -p 5432 -U svc_wf -d svc_workflow_dogfood_clean -X -A -t -c "SELECT count(*) || '|' || md5(string_agg(binding_id::text||'|'||principal_id::text||'|'||role_key||'|'||enabled::text, E'\n' ORDER BY binding_id)) FROM global_role_bindings;")" "6|94d8249cb24587ac75bb3d46c8ddefdb"
chk "PROD service pid still 1687" "$(launchctl print gui/$(id -u)/com.svc-workflow 2>/dev/null | awk '/^[[:space:]]*pid =/{print $3; exit}')" "1687"
chk "PROD ledger unchanged (12 lines)" "$(wc -l < /Users/yanfenma/.local/services/svc-workflow/ledger.json | tr -d ' ')" "12"

echo; echo "=================== MATRIX SUMMARY"
printf "$RESULTS\n"
echo "PASS=$PASS FAIL=$FAIL"
