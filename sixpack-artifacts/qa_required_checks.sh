#!/usr/bin/env bash
# QA automation for dsh-trusted-ingress-align-2.
# Fail-closed by construction: set -euo pipefail; every canonical check is a real
# mechanical assertion; ANY failed step aborts the script nonzero.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

readonly BASE=16e14233fbac1ccbdc00598097380da659e1ecd2
readonly TEST_FILE=packages/agent-router/test/feishu-regression.test.js
readonly MANIFEST=sixpack-artifacts/qa.automation.json

# Canonical check names. SINGLE SOURCE OF TRUTH for both sides of the
# manifest set-equality assertion and for every RESULT line printed below.
readonly CHECK_E2E="end-to-end verification through the public user boundary"
readonly CHECK_CRAPDRY="final CRAP/DRY checks on the terminal candidate"
readonly CHECK_MANIFEST="handoff and manifest consistency"

fail() {
  # fail <check-name> <detail...>  -> evidence-backed FAIL line, nonzero exit.
  local check="$1"; shift
  echo "RESULT ${check} FAIL: $*" >&2
  exit 1
}

# ---------------------------------------------------------------------------
# Node resolution: SIX_PACK_NODE_PATH override if set, else "node" from PATH.
# No hardcoded environment paths. Resolved binary + version are printed.
# ---------------------------------------------------------------------------
if [[ -n "${SIX_PACK_NODE_PATH:-}" ]]; then
  NODE_BIN="$SIX_PACK_NODE_PATH"
else
  NODE_BIN="node"
fi
if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  echo "FATAL: node binary not resolvable: '${NODE_BIN}'. Set SIX_PACK_NODE_PATH to a working node binary or fix PATH." >&2
  exit 1
fi
NODE_VERSION="$("$NODE_BIN" --version)" || {
  echo "FATAL: resolved node binary '${NODE_BIN}' failed to execute --version." >&2
  exit 1
}
echo "NODE resolved: ${NODE_BIN} (${NODE_VERSION})"

# ---------------------------------------------------------------------------
# Canonical check 1: end-to-end verification through the public user boundary.
# Real "node --test <target>" on the terminal candidate; its actual exit code
# gates the script (captured via command substitution + ||, no pipe swallowing).
# ---------------------------------------------------------------------------
# --test-reporter=tap is pinned so count parsing is deterministic in any
# environment; the invocation and its exit code remain the real gate.
TEST_OUT="$("$NODE_BIN" --test --test-reporter=tap "$TEST_FILE" 2>&1)" || {
  printf '%s\n' "$TEST_OUT" >&2
  fail "$CHECK_E2E" "node --test ${TEST_FILE} exited nonzero"
}
TESTS="$(printf '%s\n' "$TEST_OUT" | awk '/^# tests /{print $3}')"
PASSED="$(printf '%s\n' "$TEST_OUT" | awk '/^# pass /{print $3}')"
FAILED="$(printf '%s\n' "$TEST_OUT" | awk '/^# fail /{print $3}')"
: "${TESTS:=0}" "${PASSED:=0}" "${FAILED:=unknown}"
if [[ "$FAILED" != "0" || "$PASSED" != "$TESTS" || "$TESTS" -eq 0 ]]; then
  printf '%s\n' "$TEST_OUT" >&2
  fail "$CHECK_E2E" "tests=${TESTS} pass=${PASSED} fail=${FAILED} (target: all pass, fail=0)"
fi
echo "RESULT ${CHECK_E2E} PASS tests=${TESTS} pass=${PASSED} fail=${FAILED} via real node --test ${TEST_FILE}"

# ---------------------------------------------------------------------------
# Canonical check 2: final CRAP/DRY checks on the terminal candidate.
# Scope computed MECHANICALLY from the real committed changed-file set
# (git diff BASE..HEAD). The actual changed-file list is printed as the scope
# rationale. Working-tree cleanliness is never used as CRAP/DRY evidence.
# ---------------------------------------------------------------------------
CHANGED="$(git diff --name-only "${BASE}..HEAD")"
PRODUCT_CHANGED="$(printf '%s\n' "$CHANGED" | grep -v '^sixpack-artifacts/' || true)"
NON_TEST_CHANGED="$(printf '%s\n' "$PRODUCT_CHANGED" | grep -E '(^|/)(test|tests)/' -v || true)"
echo "SCOPE changed-files (BASE..HEAD, mechanical):"
if [[ -z "$CHANGED" ]]; then
  echo "  (none)"
else
  printf '  %s\n' "$CHANGED"
fi
echo "SCOPE product changed-files (sixpack-artifacts/ excluded):"
if [[ -z "$PRODUCT_CHANGED" ]]; then
  echo "  (none)"
else
  printf '  %s\n' "$PRODUCT_CHANGED"
fi
if [[ -n "$NON_TEST_CHANGED" ]]; then
  fail "$CHECK_CRAPDRY" "non-test product files in BASE..HEAD diff require real CRAP/DRY evaluation; refusing to fabricate a verdict: $(printf '%s; ' $NON_TEST_CHANGED)"
fi
echo "RESULT ${CHECK_CRAPDRY} NOT_APPLICABLE (governed: test-only product scope per mechanical BASE..HEAD diff) crap=NOT_APPLICABLE dry=NOT_APPLICABLE structure=NOT_APPLICABLE"

# ---------------------------------------------------------------------------
# Canonical check 3: handoff and manifest consistency.
# Real assertions: (a) manifest entrypoints schema; (b) declared checks are
# SET-EQUAL (order-insensitive, duplicates rejected) to the exact canonical
# names this script evaluates and reports; (c) each declared entrypoint exists
# on disk WITH the exec bit. Any mismatch fails the script.
# ---------------------------------------------------------------------------
"$NODE_BIN" -e '
  const fs = require("fs");
  // node -e argv layout: [execPath, arg1, arg2, ...] — no script-path slot.
  const [, manifestPath, ...expected] = process.argv;  let m;
  try {
    m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (err) {
    console.error(`MANIFEST UNREADABLE: ${err.message}`);
    process.exit(1);
  }
  let ok = true;
  const eps = m.entrypoints;
  if (!Array.isArray(eps) || eps.length !== 1 || typeof eps[0] !== "string" || eps[0].length === 0) {
    console.error(`ENTRYPOINTS SCHEMA FAIL: expected exactly one non-empty entrypoint string, got ${JSON.stringify(eps)}`);
    ok = false;
  } else if (!eps[0].startsWith("qa_") || eps[0].includes("/")) {
    console.error(`ENTRYPOINTS VALUE FAIL: entrypoint must be a bare qa_*.sh filename, got ${JSON.stringify(eps[0])}`);
    ok = false;
  }
  const declared = m.checks;
  if (!Array.isArray(declared) || declared.some((c) => typeof c !== "string")) {
    console.error(`CHECKS SCHEMA FAIL: expected array of strings, got ${JSON.stringify(declared)}`);
    process.exit(1);
  }
  if (new Set(declared).size !== declared.length) {
    console.error(`DUPLICATE declared checks: ${JSON.stringify(declared)}`);
    ok = false;
  }
  const dSet = new Set(declared);
  const eSet = new Set(expected);
  const drift = [...new Set([...dSet, ...eSet])].filter((c) => !dSet.has(c) || !eSet.has(c));
  if (dSet.size !== eSet.size || drift.length > 0) {
    console.error(`SET-EQUALITY FAIL: declared=${JSON.stringify(declared)} script-evaluated=${JSON.stringify(expected)} drift=${JSON.stringify(drift)}`);
    ok = false;
  }
  if (ok && Array.isArray(eps)) {
    for (const ep of eps) {
      const p = `sixpack-artifacts/${ep}`;
      let st;
      try {
        st = fs.statSync(p);
      } catch {
        console.error(`ENTRYPOINT MISSING: ${p}`);
        ok = false;
        continue;
      }
      try {
        fs.accessSync(p, fs.constants.X_OK);
      } catch {
        console.error(`ENTRYPOINT NOT EXECUTABLE (exec bit required): ${p}`);
        ok = false;
      }
      void st;
    }
  }
  if (!ok) process.exit(1);
  console.log(`MANIFEST OK: entrypoints=${JSON.stringify(eps)} declared-checks set-equal to script-evaluated checks (${declared.length})`);
' "$MANIFEST" "$CHECK_E2E" "$CHECK_CRAPDRY" "$CHECK_MANIFEST" || {
  fail "$CHECK_MANIFEST" "qa.automation.json inconsistent with script-evaluated canonical checks (see MANIFEST/SET-EQUALITY/ENTRYPOINT diagnostics above)"
}
echo "RESULT ${CHECK_MANIFEST} PASS manifest set-equality asserted (declared == script-evaluated) + entrypoint present with exec bit"

echo "QA_SUMMARY all canonical checks evidence-backed: exit 0"
exit 0
