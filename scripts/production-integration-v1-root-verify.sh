#!/bin/bash
# =============================================================================
# production-integration-v1-root-verify.sh — PRODUCTION_INTEGRATION_V1 Root
# Acceptance runbook (Task 2-10). ONE sudo command.
#
# Run as root:
#   sudo ./scripts/production-integration-v1-root-verify.sh
#
# This drives the ENTIRE real acceptance needed to close PRODUCTION_INTEGRATION_V1
# against the FINAL integration branch:
#
#   1. trusted install          sudo scripts/trusted-cp-deploy-install.sh
#                                (ships the production-runtime closure +
#                                 provisions /Users/authsvc/.agent-core)
#   2. production launchd unit  render+validate the --trusted plist
#                                (ProgramArguments -> trusted node + trusted app
#                                 closure + root=/Users/authsvc/.agent-core)
#   3. uid-505 runtime boot      trusted Node -> trusted app -> production
#                                composition as uid 505
#   4. real Agent child @502     Router -> workspace ensure -> child(502) ->
#                                DSH native session -> real model reply
#   5. delivery/scheduler/broker REAL smokes (ingress -> router -> agent;
#                                scheduler -> real agent; child@502 -> parent@505
#                                -> broker gateway -> real auth-service ->
#                                real svc-forum)
#   6. crash + restart recovery  agent kill -> respawn; runtime kill -> 505 respawn
#   7. hardening regression      trusted-cp-hardening-v1-verify.mjs (attack matrix)
#   8. OpenClaw-independence + static no-dependency checks
#
# HARD RULES (no secret leakage, no system change):
#   * NEVER writes, prints or saves any API key / secret / token.
#   * NEVER reads/writes the sudo password. Requires pre-configured passwordless
#     sudo for the invoking fleet user (operator provides it; this script does
#     NOT touch /etc/sudoers).
#   * NEVER modifies /etc/sudoers, NEVER disables OpenClaw, NEVER cuts over a
#     stock agent, NEVER touches the production Feishu binding, NEVER imports
#     real OpenClaw jobs, NEVER runs a bulk migration.
#   * Model: uses ONLY the acceptance-only runtime override already proven by
#     TRUSTED_CP_AGENT_DEFINITION_COMPAT_V1; the production default model
#     config is NEVER modified.
#
# Evidence (NO secrets) is written to:
#   <repo>/.demo/production-integration-v1/evidence.md
# and a short status line with the PRODUCTION_INTEGRATION_V1 report fields.
# Exit 0 = ROOT ACCEPTANCE PASS, 1 = BLOCKED, 2 = infra error.
# =============================================================================
set -euo pipefail

if [ "$(id -u)" != "0" ]; then
  echo "ERROR: must run as root (sudo ./scripts/production-integration-v1-root-verify.sh)" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(dirname "$SCRIPT_DIR")"
# The runbook must run from the FINAL integration branch. Verify the branch.
INTEGRATION_HEAD="$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo UNKNOWN)"
INTEGRATION_BRANCH="$(git -C "$REPO" rev-parse --abbrev-ref HEAD 2>/dev/null || echo UNKNOWN)"
echo "== production-integration-v1 root acceptance =="
echo "  repository : $REPO"
echo "  branch     : $INTEGRATION_BRANCH"
echo "  head       : $INTEGRATION_HEAD"

EVIDENCE_DIR="$REPO/.demo/production-integration-v1"
EVIDENCE="$EVIDENCE_DIR/evidence.md"
LOG="$EVIDENCE_DIR/run.log"
mkdir -p "$EVIDENCE_DIR"
: > "$EVIDENCE"
: > "$LOG"

# ---- helper to tee evidence + log -------------------------------------------
note() { echo "$@" | tee -a "$EVIDENCE" | tee -a "$LOG"; }
note_run() { echo "$@" | tee -a "$LOG"; }

RUN_START="$(date +%s)"

run_phase() {
  local phase="$1"; shift
  note
  note "## Phase — $phase"
  note "  [$(date '+%H:%M:%S') +$(( $(date +%s) - RUN_START ))s since run start]"
  note_run ">> phase: $phase"
}

# ---- step 0: sanity ----------------------------------------------------------
run_phase "0. sanity"
[ -f "$REPO/scripts/trusted-cp-deploy-install.sh" ] || { echo "ERROR: trusted install script missing" >&2; exit 2; }
[ -f "$REPO/scripts/production-integration-v1-acceptance.mjs" ] || { echo "ERROR: acceptance orchestrator missing" >&2; exit 2; }
[ -f "$REPO/scripts/production-runtime-launchd.mjs" ] || { echo "ERROR: launchd script missing" >&2; exit 2; }
id authsvc >/dev/null 2>&1 || { echo "ERROR: user authsvc (uid 505) missing" >&2; exit 2; }
id '502' >/dev/null 2>&1 || id -u yanfenma | grep -q '^502$' || true
# the scheduler smoke drives the agentcore-cron control seam through the
# TRUSTED copy shipped by step 1 (as uid 505) — never the /usr/local/bin
# dev-repo symlink; here we only verify the source that step 1 ships
[ -f "$REPO/scripts/agentcore-cron.mjs" ] || { echo "ERROR: agentcore-cron source missing (shipped into the trusted install by step 1)" >&2; exit 2; }
note "sanity OK (integration branch=$INTEGRATION_BRANCH @ $INTEGRATION_HEAD)"
note "BASE_MAIN=${BASE_MAIN:-bfe7491}"
note "INTEGRATION_HEAD=$INTEGRATION_HEAD"

# ---- step 1: trusted install (reproducible, includes production closure) ----
run_phase "1. trusted install (re-run, ships production-runtime closure)"
# The integration worktree has no node_modules; the trusted install copies code
# only. REPO_SRC is this worktree; MAIN_REPO is the main repo (needed for the
# third-party node_modules surface).
MAIN_REPO="$(dirname "$REPO")/dsh-agent-core"
if [ ! -d "$MAIN_REPO/node_modules" ]; then
  # when running from a plain checkout (not a worktree) the repo is its own main
  MAIN_REPO="$REPO"
fi
set +e
bash "$REPO/scripts/trusted-cp-deploy-install.sh" "$REPO" /Users/yanfenma/workspace/github/deepseek-harness "$MAIN_REPO" 2>&1 | tee -a "$LOG" | tail -25
INSTALL_EXIT="${PIPESTATUS[0]}"
set -e
note "trusted install exit=$INSTALL_EXIT TRUSTED_INSTALL_PATH=/usr/local/libexec/agent-core"
if [ "$INSTALL_EXIT" != "0" ]; then
  note "TRUSTED_INSTALL=FAIL (exit $INSTALL_EXIT — see $LOG)"
  exit "$INSTALL_EXIT"
fi

# ---- step 2: production launchd --trusted unit render + validation ----------
run_phase "2. production launchd --trusted unit (ProgramArguments -> trusted closure)"
TRUSTED_NODE=/usr/local/libexec/agent-core/node-runtime/bin/node
PROD_ROOT=/Users/authsvc/.agent-core
PLIST_OUT="$(cd "$REPO" && node scripts/production-runtime-launchd.mjs --print --trusted --root "$PROD_ROOT")"
echo "$PLIST_OUT" > "$EVIDENCE_DIR/ai.agent-core.runtime.plist"
if echo "$PLIST_OUT" | grep -q "ProgramArguments" \
   && echo "$PLIST_OUT" | grep -q "$TRUSTED_NODE" \
   && echo "$PLIST_OUT" | grep -q "/usr/local/libexec/agent-core/app/scripts/production-runtime.mjs" \
   && echo "$PLIST_OUT" | grep -q "$PROD_ROOT"; then
  note "LAUNCHD_TRUSTED_START=PASS (rendered ProgramArguments = trusted node + trusted app closure + $PROD_ROOT)"
else
  note "LAUNCHD_TRUSTED_START=FAIL (rendered plist did not resolve to the trusted closure)"
  exit 1
fi
# the trusted unit's argv0 must NOT be /usr/local/bin/node nor any dev repo path
if echo "$PLIST_OUT" | grep -qE '/usr/local/bin/node|workspace/project/dsh-agent-core|\.worktree'; then
  note "LAUNCHD_TRUSTED_START=FAIL (unit still references dev node / dev repo / worktree)"
  exit 1
fi
note "TRUSTED_NODE_PATH=$TRUSTED_NODE"

# ---- step 3..N: run the acceptance orchestrator (root) ----------------------
run_phase "3. real acceptance (trusted 505 runtime -> agent@502 -> smokes -> recovery -> openclaw)"
cd "$REPO"
node scripts/production-integration-v1-acceptance.mjs 2>&1 | tee -a "$LOG"
ACCEPT_EXIT="${PIPESTATUS[0]}"
note "acceptance orchestrator exit=$ACCEPT_EXIT"

if [ "$ACCEPT_EXIT" != "0" ]; then
  note "PRODUCTION_INTEGRATION_V1 = ROOT_ACCEPTANCE_BLOCKED"
  note "ROOT_ACCEPTANCE_REQUIRED = YES"
  note "READY_FOR_MANUAL_ROOT_ACCEPTANCE = NO"
  echo
  echo "Full evidence: $EVIDENCE"
  echo "Full run log : $LOG"
  exit "$ACCEPT_EXIT"
fi

# ---- step 4: production launchd --trusted supervision surface ------------------
# (Task 2: the production launchd unit MUST point at the trusted install.
#  launchctl bootstrap runs in a GUI login session — the supervised unit is
#  installed from the fleet user's session with:
#    node scripts/production-runtime-launchd.mjs --install --trusted \
#         --root /Users/authsvc/.agent-core
#  The runbook proves the CONTRACT here: the rendered unit's ProgramArguments
#  resolve to the trusted node + trusted app closure + 505 production root,
#  and contain NO dev-repo / worktree / /usr/local/bin/node references.)
run_phase "4. production launchd --trusted supervision contract"
PROD_ROOT=${PROD_ROOT:-/Users/authsvc/.agent-core}
TRUSTED_NODE=${TRUSTED_NODE:-/usr/local/libexec/agent-core/node-runtime/bin/node}
PLIST_OUT="$(cd "$REPO" && node scripts/production-runtime-launchd.mjs --print --trusted --root "$PROD_ROOT")"
echo "$PLIST_OUT" > "$EVIDENCE_DIR/ai.agent-core.runtime.plist"
# the exact operator install command (trusted mode) for the fleet login session
note_run "operator install command:"
note_run "  cd $REPO && node scripts/production-runtime-launchd.mjs --install --trusted --root $PROD_ROOT"
if echo "$PLIST_OUT" | grep -q "ProgramArguments" \
   && echo "$PLIST_OUT" | grep -q "$TRUSTED_NODE" \
   && echo "$PLIST_OUT" | grep -q "/usr/local/libexec/agent-core/app/scripts/production-runtime.mjs" \
   && echo "$PLIST_OUT" | grep -q "$PROD_ROOT" \
   && ! echo "$PLIST_OUT" | grep -qE '/usr/local/bin/node|workspace/project/dsh-agent-core|\.worktree'; then
  note "LAUNCHD_TRUSTED_START=PASS (unit -> trusted node + trusted app closure + $PROD_ROOT; no dev-node/dev-repo/worktree refs)"
else
  note "LAUNCHD_TRUSTED_START=FAIL (unit resolution to the trusted closure failed)"
  exit 1
fi

# ---- step 5: Task 9 hardening regression (existing driver; expected full pass)
run_phase "5. trusted-cp hardening regression (attack matrix; 502 cannot modify trusted code)"
node "$REPO/scripts/trusted-cp-hardening-v1-verify.mjs" 2>&1 | tee -a "$LOG"
HARD_EXIT="${PIPESTATUS[0]}"
if [ "$HARD_EXIT" = "0" ]; then
  note "HARDENING_TESTS=PASS (existing trusted-cp-hardening acceptance)"
else
  note "HARDENING_TESTS=FAIL (exit $HARD_EXIT)"
  exit 1
fi

# ---- step 6: final ------------------------------------------------------------------
note
note "# PRODUCTION_INTEGRATION_V1 — root acceptance evidence"
note "Run: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
note "Total elapsed: $(( $(date +%s) - RUN_START ))s"
note "Integration head: $INTEGRATION_HEAD (branch $INTEGRATION_BRANCH)"
note_run "evidence dir: $EVIDENCE_DIR"
note "(the acceptance launchd unit was NOT left installed — the operator "
note " installs it from the fleet login session with the --trusted command above)"
echo
echo "Root acceptance PASS. Evidence written to:"
echo "  $EVIDENCE"
grep -E '^(PRODUCTION_INTEGRATION|LAUNCHD_|TRUSTED_NODE|PARENT_UID|CHILD_UID|REAL_|AGENT_|CREDENTIAL|SECRET|CONTROL|BINDING|SCHEDULER|DELIVERY|HARDENING|AUTH_|BROKER_|AGENT_DEFINITION|DSH_|KERNEL_|OPENCLAW|READY_FOR|BASE_|INTEGRATION_HEAD|DEMO_|DEV_REPO)' "$EVIDENCE" || true
exit 0
