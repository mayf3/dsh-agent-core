#!/bin/bash
# SHARED_SKILL_ROOT_PRODUCTION_ACTIVATION_V1 — post-apply verification (agent-side, no sudo)
# Maps 1:1 to ACTIVATION_PACKET.md section 4 / goal COMPLETION_CONDITIONS.
set -uo pipefail

PLIST="/Library/LaunchDaemons/ai.agent-core.runtime.plist"
EXPECTED="/Users/yanfenma/.agents"
EXPECTED_SKILLS="/Users/yanfenma/.agents/skills"
# OLD_PID: pass the pre-apply pid as arg 1 (the apply script prints OLD_PID=...);
# default = the pid observed at 2026-09-06 census (68793).
OLD_PID="${1:-68793}"
RUNTIME_PID="$(ps aux | grep 'production-runtime.mjs --root /Users/authsvc' | grep -v grep | awk '{print $2}' | head -1)"

echo "== PARENT_ENV =="
GOT="$(plutil -extract EnvironmentVariables.DSH_AGENTS_HOME raw "$PLIST" 2>/dev/null || echo ABSENT)"
if [ "$GOT" = "$EXPECTED" ]; then echo "PRODUCTION_PARENT_ENV_DSH_AGENTS_HOME=$GOT : PASS"; else echo "PRODUCTION_PARENT_ENV_DSH_AGENTS_HOME=$GOT : FAIL (expect $EXPECTED)"; fi

echo "== RUNTIME PROCESS =="
echo "runtime_pid=${RUNTIME_PID:-none} old_pid=$OLD_PID $([ -n "$RUNTIME_PID" ] && [ "$RUNTIME_PID" != "$OLD_PID" ] && echo RESTARTED || echo NOT_RESTARTED)"
PS_START="$(ps -p "$RUNTIME_PID" -o lstart= 2>/dev/null || true)"; echo "started: $PS_START"

echo "== RUNTIME_HEALTH =="
H="$(curl -s --noproxy '*' -m 5 http://127.0.0.1:8790/health || true)"
echo "ingress_8790=$H"
case "$H" in *'"ok":true'*) echo "RUNTIME_HEALTH(ingress) : PASS";; *) echo "RUNTIME_HEALTH(ingress) : FAIL";; esac

echo "== CANONICAL_SHARED_SKILL_ROOT =="
N="$(ls -1 "$EXPECTED_SKILLS" 2>/dev/null | wc -l | tr -d ' ')"
echo "canonical_root_entries=$N : $([ "${N:-0}" -gt 0 ] && echo PASS || echo FAIL)"

echo "== CHILD_ENV (poll ≤120s for a live agent child of runtime, uid 502) =="
CHILD_ENV_PROOF="NOT_OBSERVED"
for i in $(seq 1 60); do
  for cpid in $(pgrep -u 502 -f 'harness|agent-child|claude' 2>/dev/null; ps -u 502 -o pid=,ppid=,command= 2>/dev/null | awk -v rp="$RUNTIME_PID" '$2==rp{print $1}'); do
    E="$(ps eww "$cpid" 2>/dev/null | tr ' ' '\n' | grep '^DSH_AGENTS_HOME=' | head -1)"
    if [ -n "$E" ]; then
      echo "child_pid=$cpid cmd=$(ps -p "$cpid" -o command= 2>/dev/null | head -c 120)"
      echo "child_env: $E"
      if [ "$E" = "DSH_AGENTS_HOME=$EXPECTED" ]; then CHILD_ENV_PROOF="PASS"; else CHILD_ENV_PROOF="MISMATCH($E)"; fi
      break 2
    fi
  done
  [ "$CHILD_ENV_PROOF" = "PASS" ] && break
  sleep 2
done
echo "PRODUCTION_CHILD_ENV_DSH_AGENTS_HOME=$CHILD_ENV_PROOF"

echo "== UNRELATED_REGRESSION FACES =="
for P in 1696 18234; do
  ps -p "$P" -o pid=,command= 2>/dev/null | head -c 140; echo
done
M="$(curl -s --noproxy '*' -m 5 http://127.0.0.1:8787/health || true)"
echo "mobile_8787=${M:-<no /health>}"
echo "== DONE (child canary via feishu/A2A 若 NOT_OBSERVED 则按 packet §4 另行触发) =="
