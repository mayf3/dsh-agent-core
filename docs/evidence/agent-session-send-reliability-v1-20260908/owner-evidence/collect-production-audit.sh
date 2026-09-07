#!/bin/bash
# AGENT_SESSION_SEND_RELIABILITY_V1 — Owner-side READ-ONLY production evidence
# collector for the agent_session_send L1 audit chain.
#
#   sudo bash /Users/yanfenma/workspace/project/dsh-agent-core/.worktree/sess-send-reliability-v1/docs/evidence/agent-session-send-reliability-v1-20260908/owner-evidence/collect-production-audit.sh
#
# - READ-ONLY: cat + grep + sed + wc on the authsvc-owned audit JSONL. No writes
#   anywhere near production; summary goes to stdout and /tmp.
# - The audit rows intentionally carry NO message text / credentials / handles
#   beyond opaque ids, so cat'ing rows is secret-free by construction (R12).
# - Offline check first:  bash <this script> --selftest   (no sudo needed)
#
# What it answers today: send volume + outcome mix (accepted/replied/timeout/
# failed) + timeoutMode mix + distinct source/target pairs. NOTE: rows do NOT
# carry the reply_unavailable REASON (result:'failed' bundles all reply-side
# failures) — that visibility gap is itself finding E2/R1 in the phase report.

set -u

AUDIT_FILE="${AUDIT_FILE:-/Users/authsvc/.agent-core/control/agent-session-messaging-audit.jsonl}"
OUT="${OUT:-/tmp/agent-session-send-audit-summary-$(date +%Y%m%dT%H%M%S).txt}"

selftest() {
  tmp="$(mktemp -d /tmp/agent-session-audit-selftest.XXXXXX)" || return 1
  fixt="$tmp/audit.jsonl"
  printf '%s\n' \
    '{"kind":"agent_session_send","phase":"intent","sourceAgentId":"agt_a","targetAgentId":"agt_b","requestId":"r1","timeoutMode":"wait_reply","ts":1}' \
    '{"kind":"agent_session_send","phase":"outcome","sourceAgentId":"agt_a","targetAgentId":"agt_b","requestId":"r1","timeoutMode":"wait_reply","result":"replied","ts":2}' \
    '{"kind":"agent_session_send","phase":"outcome","sourceAgentId":"agt_a","targetAgentId":"agt_b","requestId":"r2","timeoutMode":"wait_reply","result":"failed","ts":3}' \
    '{"kind":"agent_session_send","phase":"outcome","sourceAgentId":"agt_c","targetAgentId":"agt_b","requestId":"r3","timeoutMode":"receipt_only","result":"accepted","ts":4}' \
    'NOT_JSON LINE' \
    > "$fixt"
  AUDIT_FILE="$fixt" OUT="$tmp/summary.txt" bash "$0" --run >/dev/null 2>&1 || { rm -rf "$tmp"; return 1; }
  ok=0
  grep -q 'outcome result replied: 1' "$tmp/summary.txt" && ok=$((ok+1))
  grep -q 'outcome result failed: 1'  "$tmp/summary.txt" && ok=$((ok+1))
  grep -q 'outcome result accepted: 1' "$tmp/summary.txt" && ok=$((ok+1))
  grep -q 'intent rows: 1' "$tmp/summary.txt" && ok=$((ok+1))
  grep -q 'unparsable lines skipped: 1' "$tmp/summary.txt" && ok=$((ok+1))
  rm -rf "$tmp"
  if [ "$ok" -eq 5 ]; then echo "SELFTEST PASS (5/5 assertions on temp fixture)"; return 0; fi
  echo "SELFTEST FAIL ($ok/5)"; return 1
}

run_collect() {
  {
    echo "== agent_session_send audit summary =="
    echo "file: $AUDIT_FILE"
    if [ ! -f "$AUDIT_FILE" ]; then
      echo "AUDIT_FILE_MISSING (capability never fired on this runtime)"
    else
      echo "total lines: $(wc -l < "$AUDIT_FILE" | tr -d ' ')"
      echo "intent rows: $(grep -c '"phase":"intent"' "$AUDIT_FILE")"
      echo "denial rows: $(grep -c '"phase":"denial"' "$AUDIT_FILE")"
      for r in accepted replied timeout failed; do
        echo "outcome result $r: $(grep -c "\"phase\":\"outcome\".*\"result\":\"$r\"" "$AUDIT_FILE")"
      done
      for m in receipt_only wait_reply; do
        echo "timeoutMode $m: $(grep -c "\"timeoutMode\":\"$m\"" "$AUDIT_FILE")"
      done
      echo "-- distinct source->target pairs --"
      grep '"phase":"intent"' "$AUDIT_FILE" \
        | sed -n 's/.*"sourceAgentId":"\([^"]*\)","targetAgentId":"\([^"]*\)".*/\1 -> \2/p' \
        | sort | uniq -c | sort -rn
      echo "-- unparsable lines skipped: $(grep -cve '^{' "$AUDIT_FILE") --"
      echo "-- last 5 outcome rows (ids/handles only) --"
      grep '"phase":"outcome"' "$AUDIT_FILE" | tail -5
    fi
  } | tee "$OUT"
  echo ""
  echo "summary saved: $OUT"
}

case "${1:-}" in
  --selftest) selftest ;;
  --run)      run_collect ;;
  "")
    bash "$0" --selftest || exit 1
    echo ""
    echo "selftest passed. Re-run WITH sudo for the real read:"
    echo "  sudo bash $0 --run"
    ;;
  *) echo "usage: bash $0 [--selftest|--run]"; exit 2 ;;
esac
