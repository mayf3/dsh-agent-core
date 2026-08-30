#!/bin/bash
# Sandbox matrix for /tmp/run-authsvc-ni-supply-7110463-v1.sh (+ VARIANT-B).
set -uo pipefail
SB=/tmp/ni-sandbox
RUNNER_A=${NI_MATRIX_RUNNER_A:-/tmp/run-authsvc-ni-supply-7110463-v1.sh}
RUNNER_B=${NI_MATRIX_RUNNER_B:-$SB/runner-variant-b.sh}
DB=postgresql://postgres:postgres@127.0.0.1:55434/agent_dev_center
PG=authsvc_ni_sandbox_pg
MAIN=7110463636693b3c2eced9d97ccb186adf46907d
VARB=7fad28cc5a12cdd1b7203cedbbb3eae44183350c
PASS=0; FAIL=0; RESULTS=()

q() { docker exec -i $PG psql -U postgres -d agent_dev_center -t -A -F'|' -c "$1"; }
export_env() { # $1 = github/main ref to pin
  git -C $SB/repo update-ref refs/remotes/github/main "$1"
}
run_env() {
  export NI_SANDBOX=1 NI_DB_URL=$DB NI_REPO=$SB/repo NI_PROD_DIR=$SB/prod-deploy \
         NI_NEW_DIR=$SB/new-deploy NI_PLIST=$SB/plist/com.auth-service.test.plist \
         NI_HEALTH=http://127.0.0.1:45401/api/health NI_STUB_DIR=$SB/stub \
         NI_LOCK_DIR=$SB/lock NI_FORUM_ENV=$SB/dest/forum.env NI_WF_ENV=$SB/dest/workflow.env \
         NI_SKIP_BUILD=1
}
reset_state() {
  docker exec -i $PG psql -U postgres -d agent_dev_center -q -v ON_ERROR_STOP=1 < $SB/seed.sql
  rm -rf $SB/new-deploy; git -C $SB/repo worktree prune >/dev/null 2>&1 || true
  cp $SB/plist/template.plist $SB/plist/com.auth-service.test.plist
  rm -f $SB/stub/bootstrapped.marker $SB/stub/health-override.json $SB/stub/launchctl.log
  printf 'DATABASE_URL=x\nWORKFLOW_PORT=8989\n' > $SB/dest/workflow.env; chmod 600 $SB/dest/workflow.env
  : > $SB/dest/forum.env; chmod 600 $SB/dest/forum.env
  rm -rf $SB/dest/ro
}
check() { # $1 name, $2 expected, $3 actual
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); RESULTS+=("PASS  $1"); else FAIL=$((FAIL+1)); RESULTS+=("FAIL  $1 want=[$2] got=[$3]"); fi
}
check_contains() { # $1 name, $2 needle, $3 file
  if grep -q "$2" "$3" 2>/dev/null; then PASS=$((PASS+1)); RESULTS+=("PASS  $1"); else FAIL=$((FAIL+1)); RESULTS+=("FAIL  $1 missing [$2]"); fi
}
check_absent() { # $1 name, $2 needle, $3 file
  if grep -q "$2" "$3" 2>/dev/null; then FAIL=$((FAIL+1)); RESULTS+=("FAIL  $1 unexpectedly contains [$2]"); else PASS=$((PASS+1)); RESULTS+=("PASS  $1"); fi
}

# ================= S1: plan on clean sandbox (VARIANT-A) ====================
export_env $MAIN; reset_state
( run_env; bash $RUNNER_A ) > $SB/out/S1.log 2>&1; RC=$?
check 'S1 exit 0' 0 "$RC"
check_contains 'S1 phase B gated' 'PHASE_B_PLAN=GATED:SPEC_ABSENT_FROM_TREE' $SB/out/S1.log
check_contains 'S1 phase A needed' 'PHASE_A_PLAN=APPLY_NEEDED' $SB/out/S1.log
check 'S1 zero-write audiences' 5 "$(q 'select count(*) from auth_audiences;')"
check 'S1 zero-write security audits' 0 "$(q 'select count(*) from auth_security_audits;')"

# ================= S2: apply VARIANT-A (Phase A full, B gated) ==============
reset_state
( run_env; bash $RUNNER_A --apply --confirm 'APPLY AUTHSVC_NOTIFICATION_INGRESS_SUPPLY_7110463_V1' ) > $SB/out/S2.log 2>&1; RC=$?
check 'S2 exit 0' 0 "$RC"
check_contains 'S2 audience created' 'A2_RESULT=CREATED' $SB/out/S2.log
check_contains 'S2 phase B skipped' 'PHASE_B=SKIPPED_GATED' $SB/out/S2.log
check 'S2 audiences=6' 6 "$(q 'select count(*) from auth_audiences;')"
check 'S2 NI row exact' 'agent-core-notification-ingress-v1|agent-core-notification-ingress-v1|notification|service|notification.deliver|false|true|false|active|true|1' "$(q "SELECT audience_id||'|'||resource_service||'|'||scope_namespace||'|'||array_to_string(accepted_principal_types,',')||'|'||array_to_string(registered_scopes,',')||'|'||human_access_enabled::text||'|'||machine_access_enabled::text||'|'||delegated_access_enabled::text||'|'||status||'|'||freeze_ready::text||'|'||version::text FROM auth_audiences WHERE audience_id='agent-core-notification-ingress-v1';")"
check 'S2 audit row' 1 "$(q "select count(*) from auth_security_audits where event_type='audience.registered';")"
check 'S2 non-target grant intact' 'svc-auth' "$(q "select audience_id from machine_access_grants where machine_client_id='11111111-1111-4111-8111-111111111111';")"
check 'S2 no NI grants' 0 "$(q "select count(*) from machine_access_grants where audience_id='agent-core-notification-ingress-v1';")"
check_contains 'S2 plist flipped' "$SB/new-deploy/dist/src/server.js" $SB/plist/com.auth-service.test.plist
# S2R: idempotent rerun
( run_env; bash $RUNNER_A --apply --confirm 'APPLY AUTHSVC_NOTIFICATION_INGRESS_SUPPLY_7110463_V1' ) > $SB/out/S2R.log 2>&1; RC=$?
check 'S2R exit 0' 0 "$RC"
check_contains 'S2R already applied' 'PHASE_A=ALREADY_APPLIED' $SB/out/S2R.log
check 'S2R zero new audits' 1 "$(q "select count(*) from auth_security_audits;")"

# ================= S3: apply VARIANT-B (full supply) ========================
export_env $VARB; reset_state
( run_env; bash $RUNNER_B --apply --confirm 'APPLY AUTHSVC_NOTIFICATION_INGRESS_SUPPLY_7110463_V1' ) > $SB/out/S3.log 2>&1; RC=$?
check 'S3 exit 0' 0 "$RC"
check_contains 'S3 forum committed' 'SUPPLY_FORUM=COMMITTED' $SB/out/S3.log
check_contains 'S3 workflow committed' 'SUPPLY_WORKFLOW=COMMITTED' $SB/out/S3.log
check 'S3 principals +2' "$(q "select 'svc:'||count(*) from machine_principals where external_ref like 'service:v1:%';")" 'svc:2'
check 'S3 clients +2' "$(q "select string_agg(client_id,',' order by client_id) from machine_clients where external_ref like 'service:v1:%';")" 'mc_Ez8kTAKKvcf2pF40aoUM4q9M,mc_uYu1fDfNHjzUlRQGJdTajz9n'
check 'S3 grants 2 exact' 2 "$(q "select count(*) from machine_access_grants where audience_id='agent-core-notification-ingress-v1' and scopes=ARRAY['notification.deliver']::text[] and version=1;")"
check 'S3 grant audits 2' 2 "$(q "select count(*) from grant_change_audits where migration_id='notification-ingress-service-credential-supply-v1' and change_type='create';")"
check 'S3 audit after client projection' 'mc_Ez8kTAKKvcf2pF40aoUM4q9M|service:v1:client:svc-forum:agent-core-notification-ingress-v1|active' "$(q "select (after_value->'client'->>'client_id')||'|'||(after_value->'client'->>'external_ref')||'|'||(after_value->'client'->>'status') from grant_change_audits g join machine_clients c on c.client_id=g.client_id where g.migration_id='notification-ingress-service-credential-supply-v1' and c.external_ref like 'service:v1:client:svc-forum%';" | head -1)"
check 'S3 audit client keys exactly 3 (no secret_hash)' 3 "$(q "select (select count(*) from jsonb_object_keys(a.after_value->'client')) from grant_change_audits a where a.migration_id='notification-ingress-service-credential-supply-v1' limit 1;")"
check 'S3 forum dest 2 lines' 2 "$(wc -l < $SB/dest/forum.env | tr -d ' ')"
check 'S3 workflow dest keeps old keys' 'DATABASE_URL=x' "$(grep DATABASE_URL $SB/dest/workflow.env)"
check 'S3 workflow dest 4 lines' 4 "$(wc -l < $SB/dest/workflow.env | tr -d ' ')"
check 'S3 legacy arrays empty' 0 "$(q "select coalesce(sum(cardinality(allowed_resources)+cardinality(allowed_scopes)),0) from machine_clients where external_ref like 'service:v1:%';")"
# scrypt cross-verify with the repo's own secret.ts (verifyClientSecret)
cat > $SB/crossverify.ts <<'TS'
import { verifyClientSecret } from '/Users/yanfenma/workspace/project/auth-service/src/lib/oauth/secret';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const q = (s: string) => execSync(`docker exec -i authsvc_ni_sandbox_pg psql -U postgres -d agent_dev_center -t -A -c "${s}"`).toString().trim();
const db1 = q("select secret_hash from machine_clients where external_ref='service:v1:client:svc-forum:agent-core-notification-ingress-v1'");
const db2 = q("select secret_hash from machine_clients where external_ref='service:v1:client:svc-workflow:agent-core-notification-ingress-v1'");
const f1 = fs.readFileSync('/tmp/ni-sandbox/dest/forum.env','utf8').split('\n').find((l)=>l.startsWith('AUTH_NOTIFICATION_INGRESS_CLIENT_SECRET='))!;
const f2 = fs.readFileSync('/tmp/ni-sandbox/dest/workflow.env','utf8').split('\n').find((l)=>l.startsWith('AUTH_NOTIFICATION_INGRESS_CLIENT_SECRET='))!;
console.log(verifyClientSecret(f1.slice('AUTH_NOTIFICATION_INGRESS_CLIENT_SECRET='.length), db1) + ',' + verifyClientSecret(f2.slice('AUTH_NOTIFICATION_INGRESS_CLIENT_SECRET='.length), db2));
TS
XV=$(cd /Users/yanfenma/workspace/project/auth-service && JWT_SECRET=x /usr/local/bin/node ./node_modules/.bin/tsx $SB/crossverify.ts 2>/dev/null | tail -1)
check 'S3 repo verifyClientSecret both true' 'true,true' "$XV"

# S4: idempotent rerun VARIANT-B (NOOP both, zero writes, dest bytes unchanged)
F1=$(shasum -a 256 $SB/dest/forum.env | cut -d' ' -f1)
W1=$(shasum -a 256 $SB/dest/workflow.env | cut -d' ' -f1)
( run_env; bash $RUNNER_B --apply --confirm 'APPLY AUTHSVC_NOTIFICATION_INGRESS_SUPPLY_7110463_V1' ) > $SB/out/S4.log 2>&1; RC=$?
check 'S4 exit 0' 0 "$RC"
check_contains 'S4 forum noop' 'SUPPLY_FORUM=NOOP' $SB/out/S4.log
check_contains 'S4 workflow noop' 'SUPPLY_WORKFLOW=NOOP' $SB/out/S4.log
check 'S4 no new clients' 2 "$(q "select count(*) from machine_clients where external_ref like 'service:v1:%';")"
check 'S4 no new audits' 2 "$(q "select count(*) from grant_change_audits where migration_id='notification-ingress-service-credential-supply-v1';")"
check 'S4 forum dest unchanged' "$F1" "$(shasum -a 256 $SB/dest/forum.env | cut -d' ' -f1)"
check 'S4 workflow dest unchanged' "$W1" "$(shasum -a 256 $SB/dest/workflow.env | cut -d' ' -f1)"

# ================= S5: conflict matrix (VARIANT-A plan/apply, zero-write) ==
# a) NI audience row pre-exists with wrong scopes
export_env $MAIN; reset_state
q "insert into auth_audiences values ('agent-core-notification-ingress-v1','agent-core-notification-ingress-v1','notification',ARRAY['service']::text[],ARRAY['notification.deliver','extra']::text[],false,true,false,'active',true,1,now(),now());" >/dev/null
( run_env; bash $RUNNER_A ) > $SB/out/S5a.log 2>&1; RC=$?
check 'S5a exit 2' 2 "$RC"
check 'S5a wrong row untouched' 'notification.deliver,extra' "$(q "select array_to_string(registered_scopes,',') from auth_audiences where audience_id='agent-core-notification-ingress-v1';")"
check 'S5a zero audit writes' 0 "$(q 'select count(*) from auth_security_audits;')"
# b) foreign NI-scope grant (scope collision on an existing audience; no FK dependency)
reset_state
q "insert into machine_access_grants values ('33333333-3333-4333-8333-333333333333','svc-auth',ARRAY['auth.identity.provision','notification.deliver']::text[],1,now(),now());" >/dev/null
( run_env; bash $RUNNER_A ) > $SB/out/S5b.log 2>&1; RC=$?
check 'S5b exit 2' 2 "$RC"
check 'S5b zero audience writes' 5 "$(q 'select count(*) from auth_audiences;')"
# c) impersonation: active service principal display_name='svc-forum'
reset_state
q "insert into machine_principals values ('44444444-4444-4444-8444-444444444444','service',NULL,NULL,'svc-forum','evil:impersonator',NULL,'active',now(),now(),NULL);" >/dev/null
( run_env; bash $RUNNER_A ) > $SB/out/S5c.log 2>&1; RC=$?
check 'S5c exit 2' 2 "$RC"
check_contains 'S5c P4 hit' 'P4_IMPERSONATION_HITS' $SB/out/S5c.log
# d) clientId collision
reset_state
q "insert into machine_clients values ('55555555-5555-4555-8555-555555555555','mc_Ez8kTAKKvcf2pF40aoUM4q9M','22222222-2222-4222-8222-222222222222','aabbccddaabbccddaabbccddaabbccdd:'||repeat('ab',64),'evil:ref','active','{}'::text[],'{}'::text[],now(),now(),NULL,NULL);" >/dev/null
( run_env; bash $RUNNER_A ) > $SB/out/S5d.log 2>&1; RC=$?
check 'S5d exit 2' 2 "$RC"
check 'S5d zero writes' 5 "$(q 'select count(*) from auth_audiences;')"

# ================= S6: per-caller isolation (forum dest absent) ============
export_env $VARB; reset_state
rm -f $SB/dest/forum.env
( run_env; bash $RUNNER_B --apply --confirm 'APPLY AUTHSVC_NOTIFICATION_INGRESS_SUPPLY_7110463_V1' ) > $SB/out/S6.log 2>&1; RC=$?
check 'S6 exit nonzero partial (foreign-hardened semantics: rc=1)' 1 "$RC"
check_contains 'S6 forum refused P5' 'SUPPLY_FORUM=REFUSED (P5 destination absent' $SB/out/S6.log
check_contains 'S6 workflow committed' 'SUPPLY_WORKFLOW=COMMITTED' $SB/out/S6.log
check 'S6 forum client absent' 0 "$(q "select count(*) from machine_clients where external_ref='service:v1:client:svc-forum:agent-core-notification-ingress-v1';")"
check 'S6 workflow client present' 1 "$(q "select count(*) from machine_clients where external_ref='service:v1:client:svc-workflow:agent-core-notification-ingress-v1';")"
check 'S6 grant audits 1' 1 "$(q "select count(*) from grant_change_audits where migration_id='notification-ingress-service-credential-supply-v1';")"

# ================= S7: deploy rollback (new version unhealthy) =============
export_env $MAIN; reset_state
printf '{"version":"1.3.0"}\n' > $SB/stub/health-override.json
( run_env; bash $RUNNER_A --apply --confirm 'APPLY AUTHSVC_NOTIFICATION_INGRESS_SUPPLY_7110463_V1' ) > $SB/out/S7.log 2>&1; RC=$?
check 'S7 exit 1 rolled back' 1 "$RC"
check_contains 'S7 rolled back' 'RESULT=FAILED_AND_ROLLED_BACK' $SB/out/S7.log
check 'S7 audience compensated' 5 "$(q 'select count(*) from auth_audiences;')"
check 'S7 rollback audit' 1 "$(q "select count(*) from auth_security_audits where event_type='audience.registration_rolled_back';")"
if diff -q $SB/plist/template.plist $SB/plist/com.auth-service.test.plist >/dev/null; then PASS=$((PASS+1)); RESULTS+=('PASS  S7 plist restored byte-equal'); else FAIL=$((FAIL+1)); RESULTS+=('FAIL  S7 plist not restored'); fi

# ================= S10: secret handoff failure -> compensation =============
export_env $VARB; reset_state
mkdir -p $SB/dest/ro; : > $SB/dest/ro/forum.env; chmod 600 $SB/dest/ro/forum.env; chmod 555 $SB/dest/ro
( run_env; export NI_FORUM_ENV=$SB/dest/ro/forum.env; bash $RUNNER_B --apply --confirm 'APPLY AUTHSVC_NOTIFICATION_INGRESS_SUPPLY_7110463_V1' ) > $SB/out/S10.log 2>&1; RC=$?
chmod 755 $SB/dest/ro
check 'S10 exit nonzero' 1 "$RC"
check_contains 'S10 forum rolled back' 'SUPPLY_FORUM=ROLLED_BACK' $SB/out/S10.log
check_contains 'S10 workflow committed' 'SUPPLY_WORKFLOW=COMMITTED' $SB/out/S10.log
check 'S10 forum rows compensated' 0 "$(q "select count(*) from machine_clients where external_ref='service:v1:client:svc-forum:agent-core-notification-ingress-v1';")"
check 'S10 forum principal compensated' 0 "$(q "select count(*) from machine_principals where external_ref='service:v1:principal:svc-forum';")"

# ================= S8: secret non-disclosure ================================
# gather every secret value written to destinations across scenarios and make
# sure none appears in any runner output
SECRETS=$(cat $SB/dest/forum.env $SB/dest/workflow.env $SB/dest/ro/forum.env 2>/dev/null | sed -n 's/^AUTH_NOTIFICATION_INGRESS_CLIENT_SECRET=//p')
LEAK=0
for s in $SECRETS; do
  if grep -rq -- "$s" $SB/out/ 2>/dev/null; then LEAK=1; fi
done
check 'S8 no secret in any output' 0 "$LEAK"
# DB stores only scrypt salt:hash
check 'S8 every service:v1 client hash is scrypt salt:hash' 0 "$(q "select count(*) from machine_clients where external_ref like 'service:v1:%' and secret_hash !~ '^[0-9a-f]{32}:[0-9a-f]{128}$';")"

# ================= summary ===================================================
echo '==================== MATRIX SUMMARY ===================='
printf '%s\n' "${RESULTS[@]}"
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
