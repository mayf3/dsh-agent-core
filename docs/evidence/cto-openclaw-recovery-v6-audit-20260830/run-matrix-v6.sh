#!/bin/bash
# AUDIT-ONLY driver: independently re-runs the v5 runner's synthetic sandbox matrix.
# Runs as the audit user (no sudo anywhere); each case is `bash <sealed runner> --synthetic-case <name>`.
set -u
RUNNER=/tmp/run-agent-core-cto-openclaw-recovery-v6.sh
EV=/tmp/cto-v6-audit-evidence
PASS=0; FAIL=0

pre_dirs="$(ls -d /tmp/cto-v4-runner-matrix.* 2>/dev/null | sort)"

new_synth_dir() {
  local d
  for d in $(ls -dt /tmp/cto-v4-runner-matrix.* 2>/dev/null); do
    printf '%s\n' "$pre_dirs" | grep -qxF "$d" || { printf '%s' "$d"; return 0; }
  done
  printf ''
}

check_post_state() {
  # $1=dir $2=mode: restored|promoted
  local dir="$1" mode="$2" map backup
  map="$dir/root/primary-workspaces.json"; backup="$dir/backup/primary-workspaces.json"
  if [ "$mode" = restored ]; then
    /usr/bin/cmp -s "$backup" "$map" || { echo "POST-FAIL: map != backup pre-bytes"; return 1; }
    [ "$(stat -f '%Lp' "$dir/root/homes/agt_cto-agent")" = "755" ] || { echo "POST-FAIL: home mode not 755"; return 1; }
  else
    /usr/bin/cmp -s "$backup" "$map" && { echo "POST-FAIL: map == backup (promote missing)"; return 1; }
    /usr/local/libexec/agent-core/node-runtime/bin/node -e 'const o=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.exit(Object.keys(o).length===88&&o[process.argv[2]]===process.argv[3]?0:1)' "$map" agt_cto-agent "$dir/target" || { echo "POST-FAIL: promoted map shape"; return 1; }
  fi
  [ ! -e "$dir/target/.agent-core-cto-recovery-v4-canary.txt" ] || { echo "POST-FAIL: marker residue"; return 1; }
  return 0
}

run_case() {
  # $1=name $2=expect(final|rolledback|incomplete) $3=expect_rc $4=optional expected UNRESTORED substring
  local name="$1" expect="$2" rc_expect="$3" substr="${4:-}" out rc dir post
  local env_prefix=""
  if [ "$name" = "fault-env-pollution-ignored" ]; then
    env_prefix="RECOVERY_ATOMIC_TEST_FAULT=rename RECOVERY_ATOMIC_TEST_CANDIDATE=/tmp/cto-v6-audit-evidence/should-never-be-used"
    name="fault-env-pollution-ignored" # unrecognized by runner -> success path, with polluted env
  fi
  if [ -n "$env_prefix" ]; then
    out="$(env $env_prefix bash "$RUNNER" --synthetic-case "$name" </dev/null 2>&1)"
  else
    out="$(bash "$RUNNER" --synthetic-case "$name" </dev/null 2>&1)"
  fi
  rc=$?
  {
    echo "===== CASE $name (expect=$expect rc=$rc_expect) ====="
    printf '%s\n' "$out"
    echo "RC=$rc"
  } > "$EV/case-$name.log"
  dir="$(new_synth_dir)"
  if [ "$expect" = success ]; then
    printf '%s\n' "$out" | grep -q 'FINAL: SUCCESS; EXIT=0; SYNTHETIC_CASE=.*; ROLLBACK_CALLS=0' && [ "$rc" = "0" ] && post="$(check_post_state "$dir" promoted)" && [ -z "$post" ] \
      && { echo "CASE $name = PASS"; PASS=$((PASS+1)); return 0; }
  elif [ "$expect" = rolledback ]; then
    if printf '%s\n' "$out" | grep -q 'RESULT: FAILED_AND_ROLLED_BACK' && [ "$rc" = "$rc_expect" ] \
      && [ "$(printf '%s\n' "$out" | grep -c 'ROLLBACK_CHECK.*=1$')" = "14" ] \
      && ! printf '%s\n' "$out" | grep -q 'ROLLBACK_CHECK.*=0$' \
      && post="$(check_post_state "$dir" restored)" && [ -z "$post" ]; then
      echo "CASE $name = PASS"; PASS=$((PASS+1)); return 0
    fi
  else
    if printf '%s\n' "$out" | grep -q 'RESULT: ROLLBACK_INCOMPLETE' && [ "$rc" = "$rc_expect" ] \
      && printf '%s\n' "$out" | grep -q "UNRESTORED_STATE" \
      && { [ -z "$substr" ] || printf '%s\n' "$out" | grep -qF "$substr"; }; then
      echo "CASE $name = PASS"; PASS=$((PASS+1)); return 0
    fi
  fi
  echo "CASE $name = FAIL (rc=$rc dir=$dir post=${post:-n/a})"
  FAIL=$((FAIL+1))
}

run_case baseline success 0
run_case fault-env-pollution-ignored success 0
run_case restart-fail rolledback 1
run_case health-fail rolledback 1
run_case delivery-404 rolledback 1
run_case delivery-accepted-false rolledback 1
run_case marker-timeout rolledback 1
run_case marker-open-failed rolledback 1
run_case marker-cwd-wrong rolledback 1
run_case mapping-promote-fail rolledback 1
run_case rollback-primary-mapping-restore-fail incomplete 4 'mapping restore transaction failed'
run_case rollback-home-mode-restore-fail incomplete 4 'home numeric mode is not 755'
run_case rollback-restart-fail incomplete 4 'rollback service restart command failed'
run_case rollback-health-fail incomplete 4 'rollback HEALTH_URL/new-pid check failed'
run_case rollback-fallback-proof-fail incomplete 4 'deployed resolver does not return exact fallback path'

echo "MATRIX_PASS=$PASS MATRIX_FAIL=$FAIL TOTAL=15"
