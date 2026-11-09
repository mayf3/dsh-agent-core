#!/bin/bash
# r5 implementation ONLY. Blueprint: WINDOW-SEQUENCE-v5.md, with contract r4/r5.
# Default/--dry-run prints boundaries without calling a stage or probing production.
# --execute is exclusively for the separately authorized window's unique writer.
# No automatic rollback, replay, retry, stale-lock disposal, or kickstart -k.
set -Eeuo pipefail
umask 077

PREP=/private/tmp/fleet-v5-prep
INPUT=/private/tmp/fleet-binding-diag/r3
SOURCE=/private/tmp/fleet-roll-src
HARNESS=/tmp/v5-rebuild/harness-src
SHA=f6a1f77a8b7b878bcb9821a68836925755ca7076
TREE=08d7ea7108e8d92417b33db52523e5bd545ddce3
LIVE=/usr/local/libexec/agent-core
PLIST=/Library/LaunchDaemons/ai.agent-core.runtime.plist
SERVICE=system/ai.agent-core.runtime
LOCK=/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock
RECEIPTS=/tmp/fleet-roll-prep/window-receipt-v5
STAGE=entry
INSTALL_STATE=not_started
STOP_STATE=not_attempted
WINDOW_BUNDLE=
RD=

usage() {
  cat <<'HELP'
Usage: window-executor-v5.sh [--dry-run | --help]
       window-executor-v5.sh --selftest
       window-executor-v5.sh --execute --authority /absolute/window-authority.json

Dry-run is the default. It prints ALL stage boundaries; no stage is invoked.
Execution requires the window writer's current JSON authority. Required fields:
  window_id, writer, writer_uid, valid_from, valid_until (UTC ISO8601),
  expected_old_pid, expected_old_identity (exact ps pid/uid/gid/lstart/comm row),
  expected_old_sha (23fb91a690b0a7182ae3ae4bc388c4e3679d4cc9),
  expected_plist_sha256, expected_harness_stamp (HEAD + decimal dirty count),
  expected_bindings_sha256, expected_runtime_uid, expected_runtime_gid,
  scopes: [source_lockfile_cleanup, production_mutex, bootout, full_preimage,
           install, plist_deployed_sha_only, bootstrap, verify, hr_observe]
  sraRef, issuerRef, appointmentRef, callerRef, participants, conflictMatrix,
  requestedEffects, candidateRef, controlVersion, profileRef, attempt,
  releaseClass=STANDARD_RECOVERABLE, standardCriteria[1..5], exclusions, stageRequirements
  (accepted FWAV V1; all declarations require independent authenticated observations).
  c7: {naming_scope, before_path, before_sha256, after_path, renames,
       generations_newest_first, protected_generations, protection_basis}
See C7-INPUTS.md for the manually inventoried snapshots and explicit generation order.
Selftest uses /usr/local/v5-boot-isolation only; production stages are NOT_EXECUTED.
Candidate state loading uses sanitized copies and the candidate's real runtime.
Quiet observes only; unresolved historical UNKNOWN is carried with Agent fences.
The full preimage copy precedes bootout; downtime only rechecks inventory.
The authority documents an actual authorization; creating JSON grants none.
The original registry reader has no qualified caller/freshness binding in B,
so execute currently refuses; fixtures are Python-only external-boundary injection.
Unqualified internal installer/settlement/recursive writes refuse before dispatch.
No defaults for old PID, loaded identity, authority, expiry, or bindings hashes.
Static private inputs retain exact bytes/custody gates. Live jobs/incidents
(including outbox) use schema/agent identity/binding validation and private
diff receipts; runtime progress alone is not a byte-equality failure (r5).
Final closure differing from accepted app/harness/Node bytes, links or modes
STOPs before bootstrap for corresponding isolated canary + runtime receipts.
The executor does not manufacture those receipts or extend the window scope.
Logs/receipts: /tmp/fleet-roll-prep/window-receipt-v5/run-<unique>/ (0700/0600).
Failure preserves the owned mutex and prints a stage-specific rollback recipe.
Only successful completion releases this executor's own mutex.
HELP
}

boundaries() {
  cat <<'BOUNDARIES'
DRY_RUN_ONLY productionExecution=NOT_EXECUTED stageFunctionsCalled=0
BEGIN stage_00_authority_mutex [§4] authorization/expiry/unique writer; own mutex
END   stage_00_authority_mutex
BEGIN stage_01_integrity_clean [§1] pinned manifests; enumerate/hash/backup/delete ONLY untracked pnpm-lock.yaml; clean status
END   stage_01_integrity_clean
BEGIN stage_02_fresh_read [§1–2,4 + r5] source/Harness; plist/env/old PID; static hashes; live schema/identity/bindings + diff receipt
END   stage_02_fresh_read
BEGIN stage_03_dual_prerequisites [§3] accepted canary + full runtime; complete file/link membership; candidate binding
END   stage_03_dual_prerequisites
BEGIN stage_03b_candidate_state [A4] candidate real runtime + sanitized state copies; UNKNOWN preserved; Agent-scoped fence; no replay/overwrite
END   stage_03b_candidate_state
BEGIN stage_06a_preimage_before_stop [A5] full current tree/config/plist/env/metadata + reused copies while old runtime is alive
END   stage_06a_preimage_before_stop
BEGIN stage_04_quiet_gate [A1] mtime >=180s + read-only census receipt; nonempty allowed; no settlement
END   stage_04_quiet_gate
BEGIN stage_05_old_exit [A2] bootout; exact PID/worker/ports/supervisor absent; classify historical vs executable/unproven; only latter STOP
END   stage_05_old_exit
BEGIN stage_05b_settle_unresolved [A3] same-epoch exact exit evidence only; no conflict; preserve unproven UNKNOWN + carry-forward receipt; remainder nonblocking
END   stage_05b_settle_unresolved
BEGIN stage_06_full_preimage [A5] post-bootout inventory/ACL drift recheck + live schema/identity/bindings receipt; no ditto
END   stage_06_full_preimage
BEGIN stage_07_pinned_install [§5] root-owned physical WINDOW_BUNDLE; pinned THREE arguments + R3_BINDING_PAYLOAD; real rc
END   stage_07_pinned_install
BEGIN stage_08_install_receipt [§2,5–6] THIS install.log backup + reuse marker + completed §5b; closure PASS AND rc=0; carry forward omitted current config
END   stage_08_install_receipt
BEGIN stage_09_final_binding [§3,5 + r5] final closure/config bound to both receipts; live schema/identity/bindings + diff receipt
END   stage_09_final_binding
BEGIN stage_10_plist_bootstrap [§2,5] preserve all plist/env; deployed SHA only; bootstrap
END   stage_10_plist_bootstrap
BEGIN stage_11_production_verify [§5] exact new PID/env/listener owner/log features/public health; authenticated canonical UNKNOWN
END   stage_11_production_verify
BEGIN stage_12_hr_watch [r4] full 600s window; NEW broker execute as agent agt_hr-agent lines
END   stage_12_hr_watch
BEGIN stage_13_close [§7] bounded results; authentication/business NOT_TESTED; release own mutex
END   stage_13_close
FAILURE_BOUNDARY any failure -> STOP + phase receipt + §6 recipe; NO automatic recovery
BOUNDARIES
}

# Split stdlib helper. Never called by --dry-run/--help. Root reads and
# writes occur only behind --execute, explicit authority and stage boundaries.
helper() {
  local privilege=$1
  shift
  local -a runner
  runner=(/usr/bin/python3 -B)
  if [ "$privilege" = root ]; then runner=(/usr/bin/sudo -n /usr/bin/python3 -B); fi
  "${runner[@]}" "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/window_helper.py" "$RD" "$@"
}

rollback_recipe() {
  printf '\nSTOP stage=%s install_state=%s stop_state=%s\n' "$STAGE" "$INSTALL_STATE" "$STOP_STATE"
  printf 'Evidence: %s\nNo automatic recovery. Preserve the owned mutex and all raw evidence.\n' "$RD"
  if [ -n "$RD" ]; then helper user rollback-summary || printf '%s\n' 'Rollback coordinate readback unavailable: UNKNOWN'; fi
  case "$INSTALL_STATE" in
    not_started)
      printf '%s\n' '§6 PRE-INSTALL: no installer tree mutation. Do not restore a guessed BAK.'
      if [ "$STOP_STATE" != not_attempted ]; then
        printf '%s\n' 'bootout was attempted: fresh-read supervisor/PID; verify unchanged complete old tree and plist/env before an operator-authorized bootstrap.'
      fi ;;
    started)
      printf '%s\n' '§6 INSTALL-INTERRUPTED: installer termination and mutation_truth UNKNOWN. First reconcile the exact child process and this-run log/receipt; never assume install success or issue a second install.' ;;
    failed)
      printf '%s\n' '§6 INSTALL-FAILED: use ONLY failed-install-mutation-receipt.json confirmed from this invocation.'
      printf '%s\n' 'If absent/unconfirmed: mutation_truth=UNKNOWN, STOP; inspect install.log and exact preimage. Never use an older receipt.'
      printf '%s\n' 'NOTHING_WAS_MUTATED: no blind tree restore. TREE_WRITTEN_BY_THIS_RUN: use receipt preimage_bak and R1/R2 flags.' ;;
    *)
      printf '%s\n' '§6 POST-INSTALL: use successful-install-rollback.json (this install.log + BAK marker + completed §5b), never an old mutation receipt.'
      printf '%s\n' 'If success coordinates are incomplete: STOP for evidence reconciliation; do not guess a backup.' ;;
  esac
  cat <<'RECIPE'
For a required restore, the authorized window writer must:
1. Stop/isolate the exact failed new instance and workers; record termination and supervisor absence first. Never replay UNKNOWN requests.
2. Preserve the failed FULL tree at a NEW unique failed-* evidence path; never overwrite/delete earlier evidence.
3. Before selecting old code, run the read-only --rollback-check in an isolated NEW receipt directory with --candidate-root pointing at the verified old closure and --turn-recovery-store/--jobs-store pointing at CURRENT business state. Both actual old readers must accept that state. Missing/incompatible version-3 reader or evidence means STOP: V3-aware forward fix only. Never strip fields, downgrade, or overwrite current business jobs/bindings/incidents/runs/fences/credentials with old snapshots.
   Guard entrypoint: scripts/fleet-window/anarrowed/candidate-state.mjs --rollback-check --candidate-root /VERIFIED/OLD/CLOSURE --turn-recovery-store /CURRENT/control/turn-recovery-v3.json --jobs-store /CURRENT/scheduler/jobs.json --receipt-dir /NEW/ISOLATED/RECEIPTS
   Only after guard PASS, verify preimage_bak against preimage-live-inventory.json and preimage-full; restore the COMPLETE compatible app/harness/Node/config/home tree and matching plist/env, preserving current business state.
4. RESTORE-R1: read .preimage-reused-subtrees. Restore each missing node-runtime/harness/.cache only from this run's verified preimage-full copy; verify hashes, symlinks, UID/GID/mode/ACL before any start. A simple mv of an incomplete BAK is insufficient.
5. RESTORE-R2 only when this run completed §5b: within window authorization, re-pin /Users/authsvc/.agent-core/control/scheduler-watchdog and control/incident-backups to GID 20; read back metadata using external-preimage-metadata.json. Do not restore their stale contents.
6. Only bootstrap a verified complete old closure after the current-state compatibility guard PASS; incompatible old code must remain stopped. Recheck exact PID/SHA/env/listener ownership/health; old business UNKNOWN remains UNKNOWN.
Missing preimage/reuse/permissions/termination proof: STOP and have the supervisor append evidence to #605; no lock clearing or identity switching.
RECIPE
}

stop_on_error() {
  local rc=$1 line=$2
  trap - ERR INT TERM
  set +e
  if [ -n "$RD" ]; then
    STOP_STATE=$(helper user stop-state) || STOP_STATE=UNKNOWN
    helper user phase "$STAGE" FAIL "rc=$rc" "line=$line"
  fi
  rollback_recipe
  exit "$rc"
}

stage_00_authority_mutex() {
  helper user authority "$AUTHORITY" "$$" "$0" --execute --authority "$AUTHORITY"
  sudo -n true
  helper root mutex "$$"
}
stage_01_integrity_clean() {
  helper user integrity
  # Bundle is staged before downtime; original WINDOW_INPUTS is preserved.
  WINDOW_BUNDLE=$(helper root stage-bundle)
  helper root bundle "$WINDOW_BUNDLE"
  sudo -n /bin/bash -n "$WINDOW_BUNDLE/scripts/trusted-cp-deploy-install.sh"
  helper user clean
}
stage_02_fresh_read() { helper user sources; helper root fresh; }
stage_03_dual_prerequisites() { helper user prerequisites; }
stage_03b_candidate_state() {
  sudo -n "$PREP/scratch/node-runtime/bin/node" \
    "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/anarrowed/candidate-state.mjs" \
    --candidate-root "$PREP/scratch" \
    --turn-recovery-store /Users/authsvc/.agent-core/control/turn-recovery-v3.json \
    --jobs-store /Users/authsvc/.agent-core/scheduler/jobs.json \
    --receipt-dir "$RD/candidate-state"
}
stage_06a_preimage_before_stop() { helper root preimage; }
stage_04_quiet_gate() {
  local i rc
  for ((i=0;i<80;i++)); do
    rc=0
    helper root quiet || rc=$?
    if [ "$rc" -eq 0 ]; then return 0; fi
    [ "$rc" -eq 10 ] || return "$rc"
    printf 'Waiting for 180s mtime quiet; read-only census may be nonempty; poll=%s/80\n' "$((i+1))"
    sleep 30
  done
  return 42
}
stage_05_old_exit() {
  helper root before-stop
  helper root bootout
  STOP_STATE=attempted
  local i rc
  for ((i=0;i<30;i++)); do
    rc=0; helper root exit-check || rc=$?
    if [ "$rc" -eq 0 ]; then STOP_STATE=proved; return 0; fi
    [ "$rc" -eq 10 ] || return "$rc"
    sleep 2
  done
  return 43
}
stage_05b_settle_unresolved() {
  # supervisor: settle externally WHILE THE OLD RUNTIME IS DOWN (no overwrite race).
  # Evidence: all worker child processes verifiably exited (stage_05 proved old exit);
  # semantics: per AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1;
  # exact termination-only -> terminated_without_outcome; business outcome stays UNKNOWN.
  helper root settlement-start
  printf '%s\n' 'stage_05b: settling unresolved turns while runtime is down'
  sudo -n /usr/local/libexec/agent-core/node-runtime/bin/node \
    "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/settle_unresolved_runtime_down.mjs" \
    --source-root "$SOURCE" --stage-05-receipt-dir "$RD" \
    | tee "$RD/settle-runtime-down.json" || return 45
}
stage_06_full_preimage() { helper root preimage-recheck; }
stage_07_pinned_install() {
  helper user sources
  helper root bundle "$WINDOW_BUNDLE"
  helper root install-start
  printf 'WINDOW_BUNDLE=%s\nLOGDIR=%s\n' "$WINDOW_BUNDLE" "$RD"
  printf '%s\n' "argv: /bin/bash $WINDOW_BUNDLE/scripts/trusted-cp-deploy-install.sh $SOURCE $HARNESS $SOURCE" \
    "env: EXPECTED_SOURCE_SHA=$SHA EXPECTED_SOURCE_TREE=$TREE GENERATION_LABEL_SHA=$SHA R3_BINDING_PAYLOAD=$WINDOW_BUNDLE/payload" \
    "mutex: PRODUCTION_DEPLOY_LOCK_INHERITED_FROM=^pid=$$\$" > "$RD/install-invocation.txt"
  helper root installer-boundary "$WINDOW_BUNDLE"
  INSTALL_STATE=started
  # Preserve BOTH pipeline statuses. Do not run the installer in an if/function
  # context that disables its own errexit; it is a separate /bin/bash process.
  if sudo -n /usr/bin/env -i PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin HOME=/var/root \
    EXPECTED_SOURCE_SHA="$SHA" EXPECTED_SOURCE_TREE="$TREE" GENERATION_LABEL_SHA="$SHA" \
    R3_BINDING_PAYLOAD="$WINDOW_BUNDLE/payload" \
    PRODUCTION_DEPLOY_LOCK_INHERITED_FROM="^pid=$$\$" \
    /bin/bash "$WINDOW_BUNDLE/scripts/trusted-cp-deploy-install.sh" \
    "$SOURCE" "$HARNESS" "$SOURCE" 2>&1 | tee "$RD/install.log"; then
    INSTALL_PIPE=("${PIPESTATUS[@]}")
  else
    INSTALL_PIPE=("${PIPESTATUS[@]}")
  fi
  printf 'installer_rc=%s\ntee_rc=%s\n' "${INSTALL_PIPE[0]}" "${INSTALL_PIPE[1]}" > "$RD/install-exit.txt"
  if [ "${INSTALL_PIPE[0]}" -ne 0 ]; then
    INSTALL_STATE=failed
    helper root install-failed "${INSTALL_PIPE[0]}" || printf '%s\n' 'THIS-RUN MUTATION RECEIPT UNCONFIRMED; mutation_truth=UNKNOWN'
    return "${INSTALL_PIPE[0]}"
  fi
  INSTALL_STATE=succeeded_coordinates_pending
  [ "${INSTALL_PIPE[1]}" -eq 0 ]
}
stage_08_install_receipt() {
  helper root install-success
  INSTALL_STATE=succeeded
  grep -Fx 'CLOSURE_RESOLUTION_GATE PASS (runtime darwin-x64, expected suffix darwin-x64)' "$RD/install.log"
  grep -Fx 'installer_rc=0' "$RD/install-exit.txt"
  helper root preserve-config
}
stage_09_final_binding() { helper root final-binding; }
stage_10_plist_bootstrap() {
  helper root plist-update
  helper root bootstrap
  # Boot stabilization, never an automatic bootstrap retry.
  sleep 25
}
stage_11_production_verify() { helper root verify; }
stage_12_hr_watch() {
  local remaining pause
  helper user hr-start
  while :; do
    helper root hr-check
    remaining=$(helper user hr-remaining)
    [ "$remaining" -gt 0 ] || break
    pause=30; [ "$remaining" -ge 30 ] || pause=$remaining
    printf 'HR observation remaining=%ss/600s\n' "$remaining"
    sleep "$pause"
  done
  helper root hr-check final
  helper root verify
}
stage_13_close() { helper root close; helper root release; }

main() {
  case "${1:---dry-run}" in
    --dry-run) [ "$#" -le 1 ] || { usage >&2; return 64; }; boundaries; return 0 ;;
    --help|-h) usage; return 0 ;;
    --selftest)
      [ "$#" -eq 1 ] || { usage >&2; return 64; }
      /usr/bin/python3 -B "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/window-selftest.py" \
        "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/window-executor-v5.sh"
      return $? ;;
    --execute) [ "$#" -eq 3 ] && [ "$2" = --authority ] && [[ "$3" = /* ]] || { usage >&2; return 64; }; AUTHORITY=$3 ;;
    *) usage >&2; return 64 ;;
  esac
  # No production operation precedes this explicit execution branch.
  mkdir -p "$RECEIPTS"
  RD=$(mktemp -d "$RECEIPTS/run-$(date -u +%Y%m%dT%H%M%SZ).XXXXXX")
  exec > >(tee -a "$RD/window.log") 2>&1
  trap 'stop_on_error "$?" "$LINENO"' ERR
  trap 'stop_on_error 130 "$LINENO"' INT
  trap 'stop_on_error 143 "$LINENO"' TERM
  printf 'WINDOW V5 execution start; receipts=%s\n' "$RD"
  local f
  for f in stage_00_authority_mutex stage_01_integrity_clean stage_02_fresh_read \
    stage_03_dual_prerequisites stage_03b_candidate_state stage_06a_preimage_before_stop \
    stage_04_quiet_gate stage_05_old_exit \
    stage_05b_settle_unresolved \
    stage_06_full_preimage stage_07_pinned_install stage_08_install_receipt \
    stage_09_final_binding stage_10_plist_bootstrap stage_11_production_verify \
    stage_12_hr_watch stage_13_close; do
    STAGE=$f
    printf 'BEGIN %s %s\n' "$STAGE" "$(date -u +%FT%TZ)"
    if [ "$STAGE" != stage_00_authority_mutex ]; then helper root mutex-check; fi
    helper user phase "$STAGE" BEGIN
    "$f"
    helper user phase "$STAGE" PASS
    printf 'END %s PASS %s\n' "$STAGE" "$(date -u +%FT%TZ)"
  done
  printf 'Configured production checks PASS; HR broker execute observed; authentication NOT_TESTED; business success UNKNOWN.\n'
}

# Sourcing is also inert: definitions only, never execute a production stage.
if [[ "${BASH_SOURCE[0]}" = "$0" ]]; then main "$@"; fi
