#!/bin/bash
# =============================================================================
# test-trusted-cp-restore-truth-v1.sh — Product #477 (G4) deploy-infra debt
#
# Focused RED-first regressions for the two deploy-infra debt classes the B7
# 2026-10-01/02 fail-closed/rollback sequence proved live (agent-control#191/
# #193/#195, Product #414 DONE_WHEN item 4):
#
#   R1 INSTALL_MUTATION_RECEIPT — a late installer failure (§7 helper gate,
#      §8 symlink-escape gate, §9 uid-502 spot check, or ANY `set -e` exit)
#      after the §1 preimage mv must report ACTUAL mutation truth (stages
#      reached, preimage $BAK, exact restore recipe, stage-gated RESTORE-R1/
#      RESTORE-R2) and a durable JSON receipt — never silence, never
#      "NOTHING was deployed" after the tree was written. A pre-mutation
#      failure must receipt the negative truth too (NOTHING was mutated).
#      Fail-closed semantics and rollback authority are UNCHANGED: the
#      receipt never restores anything and never bypasses the deploy mutex.
#
#   R2 PREIMAGE-COMPLETENESS (RESTORE-R1) — when §1b reuses node-runtime /
#      harness / .cache OUT of the fresh $BAK, the preimage must carry a
#      durable record (<BAK>/.preimage-reused-subtrees) so a later restore
#      knows it lands without those subtrees (the #193/#195 live failure).
#
# Runs entirely on temp fixtures and the installer's own no-root selftest
# mode. NEVER touches /usr/local/libexec/agent-core, its backups, or any
# live install; receipt output is redirected to a fixture dir via the
# TRUSTED_CP_RECEIPT_DIR test seam.
#
# Usage: ./scripts/test-trusted-cp-restore-truth-v1.sh
# =============================================================================
set -uo pipefail

THIS_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY="$THIS_DIR/trusted-cp-deploy-install.sh"
GUARD_TEST="$THIS_DIR/lib/trusted-cp-watchdog-ownership-guard.test.mjs"

PASS=0; FAIL=0
ok()  { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL: $1" >&2; FAIL=$((FAIL+1)); }

T="$(mktemp -d /tmp/restore-truth-test.XXXXXX)"
trap 'rm -rf "$T"' EXIT

echo "== fixture: $T =="
echo "== installer present + syntax =="
[ -f "$DEPLOY" ] && ok "installer present" || bad "installer missing"
bash -n "$DEPLOY" && ok "installer shell-syntax valid" || bad "installer syntax error"

json_get() { python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d.get(sys.argv[2],"__MISSING__"))' "$1" "$2" 2>/dev/null; }

# ---------------------------------------------------------------------------
# R1a: REAL end-to-end pre-mutation failure — no args (P1 provenance fail),
# exit non-zero, receipt says NOTHING was mutated, JSON written to fixture dir.
# ---------------------------------------------------------------------------
echo "== R1a e2e pre-mutation failure receipt (no args, no root) =="
F1="$T/r1a"; mkdir -p "$F1"
R1A_OUT="$(cd "$THIS_DIR" && env TRUSTED_CP_RECEIPT_DIR="$F1" bash "$DEPLOY" 2>&1)"
R1A_RC=$?
[ "$R1A_RC" -ne 0 ] && ok "R1a no-arg run fails closed (exit $R1A_RC)" || bad "R1a no-arg run unexpectedly succeeded"
grep -q "MUTATION RECEIPT" <<<"$R1A_OUT" \
  && ok "R1a failure emits a MUTATION RECEIPT block" \
  || bad "R1a failure carried NO mutation receipt (silent failure — the B7 #191 wrapper-truth class)"
grep -q "NOTHING was mutated by this run" <<<"$R1A_OUT" \
  && ok "R1a pre-mutation failure receipts the NO-MUTATION truth" \
  || bad "R1a pre-mutation failure did NOT receipt no-mutation truth"
grep -q "EXACT RESTORE" <<<"$R1A_OUT" \
  && bad "R1a no-mutation failure must not offer a restore recipe" \
  || ok "R1a no-mutation failure offers no restore recipe (nothing to restore)"
[ -f "$F1/agent-core-install-mutation-receipt.json" ] \
  && ok "R1a durable JSON receipt written to TRUSTED_CP_RECEIPT_DIR" \
  || bad "R1a durable JSON receipt missing"
[ "$(json_get "$F1/agent-core-install-mutation-receipt.json" exit_code)" = "$R1A_RC" ] \
  && ok "R1a JSON exit_code matches" || bad "R1a JSON exit_code mismatch"
[ "$(json_get "$F1/agent-core-install-mutation-receipt.json" stages_completed)" = "[]" ] \
  && ok "R1a JSON stages_completed empty (pre-mutation)" || bad "R1a JSON stages_completed not empty"

# ---------------------------------------------------------------------------
# R1b: installer-side no-root selftest covers the LATE-failure truth contract
# (stages reached, $BAK preimage, exact restore, R2 stage-gating, R1 absence
# without reuse) — the paths only reachable after real mutation.
# ---------------------------------------------------------------------------
echo "== R1b/R2 installer restore-truth selftest (no root) =="
SELFTEST_OUT="$(env TRUSTED_CP_SELFTEST_RESTORE_TRUTH=1 bash "$DEPLOY" 2>&1)"
if grep -q "SELFTEST_RESTORE_TRUTH=PASS" <<<"$SELFTEST_OUT"; then
  ok "installer TRUSTED_CP_SELFTEST_RESTORE_TRUTH selftest PASS"
  echo "$SELFTEST_OUT" | sed 's/^/    /' | grep "SELFTEST_OK" || true
else
  bad "installer restore-truth selftest FAILED or MISSING (add TRUSTED_CP_SELFTEST_RESTORE_TRUTH block)"
  echo "$SELFTEST_OUT" | sed 's/^/    /' | tail -20
fi

# ---------------------------------------------------------------------------
# R1c: structural wiring — the receipt is emitted from the composed EXIT trap
# (B6 single composed cleanup), and the existing §8 domain-literal truth fix
# is not regressed.
# ---------------------------------------------------------------------------
echo "== R1c structural wiring =="
grep -q "emit_mutation_receipt" "$DEPLOY" \
  && ok "emit_mutation_receipt defined/used in installer" \
  || bad "installer has no emit_mutation_receipt"
grep -Eq "trap .*TRAP_RC=\\$\?; composed_exit_cleanup" "$DEPLOY" \
  && ok "EXIT trap captures rc into the composed cleanup" \
  || bad "EXIT trap does not feed rc to composed_exit_cleanup"
grep -q "MUTATION TRUTH: late gate" "$DEPLOY" \
  && ok "§8 domain-literal late-gate truth fix intact (no regression)" \
  || bad "§8 late-gate truth text regressed"

# ---------------------------------------------------------------------------
# R2: §1b reuse must record the moved-out subtrees in the fresh preimage.
# ---------------------------------------------------------------------------
echo "== R2 §1b preimage-reuse record =="
grep -q "note_preimage_reuse" "$DEPLOY" \
  && ok "§1b reuse records moved-out subtrees (note_preimage_reuse)" \
  || bad "§1b reuse leaves the preimage completeness unrecorded (RESTORE-R1 #193/#195 class)"
grep -q ".preimage-reused-subtrees" "$DEPLOY" \
  && ok "durable per-backup marker path .preimage-reused-subtrees present" \
  || bad "no durable preimage-reuse marker path"
grep -q "RESTORE-R1" "$DEPLOY" \
  && ok "RESTORE-R1 contract present in installer" \
  || bad "RESTORE-R1 contract absent from installer"

# ---------------------------------------------------------------------------
# Cross-surface guard: the §5b pinned-set shape the watchdog ownership guard
# pins byte-wise must be untouched (distinct-owner regression stays green).
# ---------------------------------------------------------------------------
echo "== §5b pinned-set guard regression (node:test) =="
if command -v node >/dev/null 2>&1; then
  if (cd "$THIS_DIR/.." && node --test "$GUARD_TEST" >/tmp/rtr-guard.log 2>&1); then
    ok "trusted-cp-watchdog-ownership-guard tests still PASS (§5b shape intact)"
  else
    bad "watchdog ownership guard test FAILED — §5b pinned-set shape drifted"
    tail -20 /tmp/rtr-guard.log
  fi
else
  bad "node not available — cannot run the §5b guard regression"
fi

# ---------------------------------------------------------------------------
echo
echo "== RESULT: $PASS passed, $FAIL failed =="
if [ "$FAIL" -eq 0 ]; then
  echo "TRUSTED_CP_RESTORE_TRUTH_V1_TESTS = PASS"
  exit 0
else
  echo "TRUSTED_CP_RESTORE_TRUTH_V1_TESTS = FAIL"
  exit 1
fi
