#!/usr/bin/env bash
# QA required checks — dsh-trusted-ingress-align-2 (FAIL-CLOSED).
#
# Canonical checks (names are load-bearing: they must stay set-equal with
# sixpack-artifacts/qa.automation.json; the equality is asserted below):
#   1. end-to-end verification through the public user boundary
#   2. final CRAP/DRY checks on the terminal candidate
#   3. handoff and manifest consistency
#
# Fail-closed contract:
#   - any failed check aborts the script with a nonzero exit;
#   - check 1 gates on the real "node --test" exit code (never piped away);
#   - check 2 derives its scope ONLY from the real BASE..HEAD changed-file
#     set; working-tree cleanliness is never a CRAP/DRY verdict source;
#   - check 3 is a real assertion, not a listing.
set -euo pipefail

readonly BASE='16e14233fbac1ccbdc00598097380da659e1ecd2'
readonly TEST_FILE='packages/agent-router/test/feishu-regression.test.js'
readonly SELF_PATH='sixpack-artifacts/qa_required_checks.sh'
readonly MANIFEST='sixpack-artifacts/qa.automation.json'

readonly CHECK_E2E='end-to-end verification through the public user boundary'
readonly CHECK_CRAP='final CRAP/DRY checks on the terminal candidate'
readonly CHECK_MANIFEST='handoff and manifest consistency'
# The exact set of check names this script evaluates and reports.
readonly EVALUATED_CHECKS="$(printf '%s\n' "$CHECK_E2E" "$CHECK_CRAP" "$CHECK_MANIFEST")"

# --------------------------------------------------------------- node resolution
# SIX_PACK_NODE_PATH (a node binary path, not a PATH-style list) overrides;
# otherwise "node" must resolve on PATH. No hardcoded environment paths.
NODE_BIN="${SIX_PACK_NODE_PATH:-node}"
NODE_PROBE=''
if ! NODE_PROBE="$("$NODE_BIN" --version 2>&1)"; then
  printf 'FATAL: node binary not executable: "%s" (override with SIX_PACK_NODE_PATH=<path-to-node> or fix PATH); diagnostic: %s\n' \
    "$NODE_BIN" "$NODE_PROBE" >&2
  exit 1
fi
printf 'node resolution: using "%s" (version %s)\n' "$NODE_BIN" "$NODE_PROBE"

# --------------------------------------------------------------- repo root
REPO_PROBE=''
if ! REPO_PROBE="$(git rev-parse --show-toplevel 2>&1)"; then
  printf 'FATAL: not inside a git worktree; run from within the candidate worktree. diagnostic: %s\n' \
    "$REPO_PROBE" >&2
  exit 1
fi
cd "$REPO_PROBE"
printf 'worktree root: %s\n' "$REPO_PROBE"

# ------------------------------------------------- check 1: end-to-end via user boundary
printf '\n== %s ==\n' "$CHECK_E2E"
TEST_OUTPUT=''
if ! TEST_OUTPUT="$("$NODE_BIN" --test "$TEST_FILE" 2>&1)"; then
  printf '%s\n' "$TEST_OUTPUT"
  printf 'RESULT: %s = FAIL (real "node --test %s" exited nonzero on the terminal candidate)\n' \
    "$CHECK_E2E" "$TEST_FILE"
  exit 1
fi
printf '%s\n' "$TEST_OUTPUT"
TESTS_N="$(printf '%s\n' "$TEST_OUTPUT" | sed -n 's/^ℹ tests \([0-9][0-9]*\)$/\1/p' | tail -n 1 || true)"
PASS_N="$(printf '%s\n' "$TEST_OUTPUT" | sed -n 's/^ℹ pass \([0-9][0-9]*\)$/\1/p' | tail -n 1 || true)"
FAIL_N="$(printf '%s\n' "$TEST_OUTPUT" | sed -n 's/^ℹ fail \([0-9][0-9]*\)$/\1/p' | tail -n 1 || true)"
printf 'RESULT: %s = PASS (real "node --test %s" exit code 0 on the terminal candidate: tests=%s pass=%s fail=%s)\n' \
  "$CHECK_E2E" "$TEST_FILE" "${TESTS_N:-?}" "${PASS_N:-?}" "${FAIL_N:-?}"

# ------------------------------------- check 2: CRAP/DRY/structure on real changed set
printf '\n== %s ==\n' "$CHECK_CRAP"
if ! CHANGED_FILES="$(git diff --name-only "${BASE}..HEAD")"; then
  printf 'RESULT: %s = FAIL (git diff against BASE %s is unavailable)\n' "$CHECK_CRAP" "$BASE"
  exit 1
fi
if [ -z "$CHANGED_FILES" ]; then
  printf 'RESULT: %s = FAIL (empty BASE..HEAD changed-file set; the terminal candidate has no committed delta to gate)\n' "$CHECK_CRAP"
  exit 1
fi
printf 'mechanical scope rationale — changed-file set (git diff --name-only %s..HEAD):\n' "$BASE"
printf '%s\n' "$CHANGED_FILES" | sed 's/^/  - /'
DIRTY_N=''
if DIRTY_N="$(git status --porcelain | wc -l | tr -d ' ')" && [ "$DIRTY_N" != '0' ]; then
  printf 'evidence note: %s uncommitted working-tree change(s) exist and are OUTSIDE the BASE..HEAD scope above; working-tree cleanliness is never a CRAP/DRY verdict source\n' "$DIRTY_N"
fi
PRODUCT_CHANGED=''
while IFS= read -r changed_file; do
  [ -n "$changed_file" ] || continue
  case "$changed_file" in
    sixpack-artifacts/*) : ;;                               # stage artifacts, not product tree
    */test/* | test/* | *.test.js | *.spec.js) : ;;         # test surface
    *) PRODUCT_CHANGED="$changed_file" ;;
  esac
done <<<"$CHANGED_FILES"
if [ -n "$PRODUCT_CHANGED" ]; then
  printf 'RESULT: %s = FAIL (non-test product file(s) changed, e.g. %s; CRAP/DRY/structure must then be really evaluated over product code by a governed tool before handoff — refusing to fabricate a verdict)\n' \
    "$CHECK_CRAP" "$PRODUCT_CHANGED"
  exit 1
fi
printf 'metric CRAP      = NOT_APPLICABLE (governed: test-only changed-file set listed above; no product surface to score)\n'
printf 'metric DRY       = NOT_APPLICABLE (governed: test-only changed-file set listed above; no product surface to score)\n'
printf 'metric structure = NOT_APPLICABLE (governed: test-only changed-file set listed above; no product surface to score)\n'
printf 'RESULT: %s = NOT_APPLICABLE (governed: every changed file outside sixpack-artifacts/ in the mechanical BASE..HEAD set above is a test file; verdict derived from that diff, never from working-tree cleanliness)\n' \
  "$CHECK_CRAP"

# ------------------------------------------------- check 3: handoff/manifest consistency
printf '\n== %s ==\n' "$CHECK_MANIFEST"
MANIFEST_PROBE=''
if ! MANIFEST_PROBE="$("$NODE_BIN" -e '
const fs = require("fs");
const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (typeof manifest.entrypoint !== "string" || manifest.entrypoint.length === 0) {
  console.error("entrypoint must be a non-empty string"); process.exit(1);
}
if (!Array.isArray(manifest.checks) || manifest.checks.some((c) => typeof c !== "string")) {
  console.error("checks must be an array of strings"); process.exit(1);
}
process.stdout.write(manifest.entrypoint + "\n" + manifest.checks.join("\n"));
' "$MANIFEST" 2>&1)"; then
  printf 'RESULT: %s = FAIL (%s is missing or malformed: %s)\n' "$CHECK_MANIFEST" "$MANIFEST" "$MANIFEST_PROBE"
  exit 1
fi
DECLARED_ENTRYPOINT="$(printf '%s\n' "$MANIFEST_PROBE" | sed -n '1p')"
DECLARED_CHECKS="$(printf '%s\n' "$MANIFEST_PROBE" | sed -n '2,$p' || true)"
MANIFEST_FAIL=''
if [ "$DECLARED_ENTRYPOINT" != "$(basename "$SELF_PATH")" ]; then
  printf 'manifest assertion FAILED: declared entrypoint "%s" is not the bare filename "%s"\n' \
    "$DECLARED_ENTRYPOINT" "$(basename "$SELF_PATH")"
  MANIFEST_FAIL=1
fi
if [ ! -f "$SELF_PATH" ]; then
  printf 'manifest assertion FAILED: entrypoint file %s does not exist\n' "$SELF_PATH"
  MANIFEST_FAIL=1
fi
if [ ! -x "$SELF_PATH" ]; then
  printf 'manifest assertion FAILED: entrypoint file %s exists but lacks the exec bit\n' "$SELF_PATH"
  MANIFEST_FAIL=1
fi
DECLARED_SORTED="$(printf '%s\n' "$DECLARED_CHECKS" | sort)"
EVALUATED_SORTED="$(printf '%s\n' "$EVALUATED_CHECKS" | sort)"
if [ "$DECLARED_SORTED" != "$EVALUATED_SORTED" ]; then
  printf 'manifest assertion FAILED: declared check names are not set-equal to the names this script evaluates and reports\n'
  printf 'declared (sorted):\n%s\nevaluated (sorted):\n%s\n' "$DECLARED_SORTED" "$EVALUATED_SORTED"
  MANIFEST_FAIL=1
fi
if [ -n "$MANIFEST_FAIL" ]; then
  printf 'RESULT: %s = FAIL (see manifest assertions above)\n' "$CHECK_MANIFEST"
  exit 1
fi
printf 'RESULT: %s = PASS (entrypoint "%s" exists with exec bit; declared check names set-equal to script-evaluated check names)\n' \
  "$CHECK_MANIFEST" "$DECLARED_ENTRYPOINT"

printf '\nQA_REQUIRED_CHECKS: all canonical checks disposed (exit 0)\n'
