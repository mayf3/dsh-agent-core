#!/bin/bash
# WDA structural diagnostics — narrow 3-file broker closure deployment packet.
# Modes:
#   --selftest   offline full rehearsal against a scratch copy (no production paths)
#   --precheck   read-only production drift gate + untouched-guard baseline
#   --install    sudo: preimage backup -> install 3 files -> readback -> in-place node smoke
#   --apply      sudo: --install, then controlled kickstart + fresh-pid health poll (ONE command)
#   --rollback   sudo: restore preimages -> readback
# bash 3.2 compatible; PATH pinned; all production paths absolute.
set -u
PATH=/usr/bin:/bin:/usr/sbin:/sbin
NODE_BIN=/usr/local/libexec/agent-core/node-runtime/bin/node
export PATH

PACKET_DIR="$(cd "$(dirname "$0")" && pwd)"
LIVE="/usr/local/libexec/agent-core/app/packages/broker/src"
HASH="shasum -a 256"

# mode is only selftest-safe before install; install/rollback/precheck touch production.
MODE="${1:-}"
if [ "$MODE" != "--selftest" ] && [ "$MODE" != "--precheck" ] && [ "$MODE" != "--install" ] && [ "$MODE" != "--apply" ] && [ "$MODE" != "--rollback" ]; then
  echo "usage: $0 --selftest|--precheck|--install|--apply|--rollback" >&2; exit 64
fi

FILES="mapping.js schema.js capabilities/workflow-definition-authoring.js"
GUARDED="index.js relay.js transport.js registry.js gateway.js capabilities/workflow.js"

# expected_hash <kind> <rel>: kind=target|preimage|guard; rel is file-relative path
expected_hash() {
  case "$1" in
    target)    grep "targets/packages/broker/src/$2  " "$PACKET_DIR/SHA256SUMS.txt" | head -1 | awk '{print $2}' ;;
    preimage)  grep "preimages/$2  " "$PACKET_DIR/SHA256SUMS.txt" | head -1 | awk '{print $2}' ;;
    guard)     grep "live:$2  " "$PACKET_DIR/SHA256SUMS.txt" | head -1 | awk '{print $2}' ;;
  esac
}

fail() { echo "FAIL: $1" >&2; exit 1; }
pass() { echo "PASS: $1"; }

# ---- offline selftest: rehearse every assertion against a scratch tree ----
if [ "$MODE" = "--selftest" ]; then
  SCRATCH="$(mktemp -d /tmp/wda-sd-selftest.XXXXXX)"
  REPO_ROOT="$(cd "$PACKET_DIR/../../.." && pwd)"
  mkdir -p "$SCRATCH/packages/broker/src/capabilities" "$SCRATCH/packages/scheduler/src"
  for f in $FILES; do cp "$PACKET_DIR/targets/packages/broker/src/$f" "$SCRATCH/packages/broker/src/$f"; done
  # import-graph deps of the target files (mapping->schema+scheduler-validation->schedule;
  # registry/manifest->error-detail-sanitizer), staged from the frozen baseline commit.
  for f in scheduler-validation.js error-detail-sanitizer.js transport.js calculator.manifest.js; do
    git -C "$REPO_ROOT" show "ac6f727:packages/broker/src/$f" > "$SCRATCH/packages/broker/src/$f"
  done
  # selftest-only stub: mapping.js statically imports scheduler-validation, which
  # imports croner via schedule.js; scheduler semantics are NOT under test here and
  # the generic mapping path only enters it for manifest.id === 'scheduler'.
  printf 'export function normalizeSchedule() { throw new Error("selftest stub") }\nexport function parseAtToMs() { throw new Error("selftest stub") }\n' > "$SCRATCH/packages/scheduler/src/schedule.js"
  for f in $GUARDED; do
    git -C "$REPO_ROOT" show "ac6f727:packages/broker/src/$f" > "$SCRATCH/packages/broker/src/$f"
  done
  echo "[selftest] 1. target bytes hash to frozen digests"
  for f in $FILES; do
    got=$($HASH "$SCRATCH/packages/broker/src/$f" | awk '{print $1}')
    want=$(expected_hash target "$f")
    [ "$got" = "$want" ] || fail "selftest target hash $f ($got != $want)"
  done
  pass "target hashes frozen"
  echo "[selftest] 2. functional smoke on staged bytes (fresh detail present, V0 envelope bare, manifest schema unchanged)"
  "$NODE_BIN" --input-type=module -e '
    import assert from "node:assert/strict"
    const base = process.argv[1]
    const { assertValidManifest, validateInvocation } = await import(base + "/mapping.js")
    const m = (await import(base + "/capabilities/workflow-definition-authoring.js")).workflowDefinitionAuthoringManifest
    const man = assertValidManifest(m)
    const b = { domainId: "d", definitionId: "e", definitionVersionId: "v" }
    const r1 = validateInvocation(man, { operation: "replace_draft_graph", args: { ...b, graph: {} } })
    assert.equal(r1.error.code, "invalid_arguments"); assert.match(r1.error.detail, /unknown property "graph"/)
    const r2 = validateInvocation(man, { operation: "create_definition", args: { unrelated: 1 } })
    assert.deepEqual(r2.error, { code: "invalid_arguments" })
    const { manifest: calc } = await import(base + "/calculator.manifest.js")
    const r3 = validateInvocation(calc, { operation: "divide", args: { a: 1 } })
    assert.deepEqual(r3, { ok: false, error: { code: "invalid_arguments" } })
    const replace = man.operations.find(o => o.name === "replace_draft_graph").arguments
    assert.deepEqual(Object.keys(replace.properties).sort(),
      ["contextSchema","definitionId","definitionVersionId","domainId","nodes","steps","terminalOutcome","transitions"])
    const { buildToolDefinition } = await import(base + "/registry.js")
    const { definition } = buildToolDefinition({ manifest: m, handlers: {} })
    assert.ok(!Object.keys(definition.parameters).includes("structuralDiagnostics"))
    console.log("[selftest] functional smoke PASS")
  ' "$SCRATCH/packages/broker/src" || fail "functional smoke"
  pass "functional smoke (fresh detail / V0 bare / schema frozen / model-visible clean)"
  echo "[selftest] 3. preimage drift-gate mechanics"
  for f in $FILES; do
    want=$(expected_hash preimage "$f")
    got=$($HASH "$PACKET_DIR/preimages/$f" | awk '{print $1}')
    [ "$got" = "$want" ] || fail "selftest preimage hash $f"
  done
  pass "preimage digests self-consistent"
  rm -rf "$SCRATCH"
  echo "SELFTEST = PASS (offline; nothing outside /tmp touched)"
  exit 0
fi

# ---- production modes below ----
if [ "$MODE" = "--install" ] || [ "$MODE" = "--apply" ] || [ "$MODE" = "--rollback" ]; then
  [ "$(id -u)" = "0" ] || { echo "$MODE requires root (run: sudo bash $0 $MODE)" >&2; exit 77; }
fi

# ---- precheck / install share the drift gate ----
echo "[$MODE] drift gate: live preimages must equal frozen baseline"
for f in $FILES; do
  got=$($HASH "$LIVE/$f" | awk '{print $1}')
  want=$(expected_hash preimage "$f")
  [ "$got" = "$want" ] || fail "LIVE DRIFT at $f (live $got != baseline $want) — STOP, re-baseline with fresh packet"
done
pass "live matches frozen preimage baseline"

if [ "$MODE" = "--precheck" ]; then
  echo "[$MODE] untouched-guard baseline check"
  for f in $GUARDED; do
    got=$($HASH "$LIVE/$f" | awk '{print $1}')
    want=$(expected_hash guard "$f")
    [ "$got" = "$want" ] || echo "NOTE: guarded file already drifted at packet build: $f ($got != $want) — re-baseline before install"
  done
  echo "PRECHECK = PASS (read-only; no changes made)"
  exit 0
fi

if [ "$MODE" = "--rollback" ]; then
  for f in $FILES; do
    cp "$PACKET_DIR/preimages/$f" "$LIVE/$f" || fail "rollback copy $f"
    chmod 0644 "$LIVE/$f"
    got=$($HASH "$LIVE/$f" | awk '{print $1}')
    want=$(expected_hash preimage "$f")
    [ "$got" = "$want" ] || fail "rollback readback $f"
  done
  echo "ROLLBACK = PASS (preimages restored, readback verified; kickstart required to take effect)"
  exit 0
fi

# ---- install ----
for f in $FILES; do
  cp "$LIVE/$f" "$PACKET_DIR/preimages/$f.install-backup" || fail "preimage backup $f"
done
pass "preimages backed up (.install-backup)"
for f in $FILES; do
  cp "$PACKET_DIR/targets/packages/broker/src/$f" "$LIVE/$f" || fail "install $f"
  chmod 0644 "$LIVE/$f"
  got=$($HASH "$LIVE/$f" | awk '{print $1}')
  want=$(expected_hash target "$f")
  [ "$got" = "$want" ] || fail "readback $f ($got != $want)"
done
pass "3 files installed, readback == frozen targets"

echo "[$MODE] untouched guard"
for f in $GUARDED; do
  got=$($HASH "$LIVE/$f" | awk '{print $1}')
  want=$(expected_hash guard "$f")
  [ "$got" = "$want" ] || fail "GUARDED FILE CHANGED: $f — investigate before kickstart"
done
pass "guarded files unchanged (hotfix line preserved)"

echo "[$MODE] in-place functional smoke on staged production bytes (separate process; running runtime unaffected)"
"$NODE_BIN" --input-type=module -e '
  import assert from "node:assert/strict"
  const base = process.argv[1]
  const { assertValidManifest, validateInvocation } = await import(base + "/mapping.js")
  const m = (await import(base + "/capabilities/workflow-definition-authoring.js")).workflowDefinitionAuthoringManifest
  const man = assertValidManifest(m)
  const b = { domainId: "d", definitionId: "e", definitionVersionId: "v" }
  const r1 = validateInvocation(man, { operation: "replace_draft_graph", args: { ...b, graph: {} } })
  assert.equal(r1.error.code, "invalid_arguments"); assert.match(r1.error.detail, /unknown property "graph"/)
  const r2 = validateInvocation(man, { operation: "create_definition", args: { unrelated: 1 } })
  assert.deepEqual(r2.error, { code: "invalid_arguments" })
  console.log("[smoke] staged production bytes functional PASS")
' "$LIVE" || fail "in-place smoke"
pass "staged bytes smoke"

echo "INSTALL = PASS"

if [ "$MODE" = "--apply" ]; then
  OLD_PID="$(launchctl print system/ai.agent-core.runtime 2>/dev/null | awk '/^\tpid = /{print $3; exit}')"
  echo "[$MODE] controlled restart: kickstart system/ai.agent-core.runtime (old pid=${OLD_PID:-unknown})"
  launchctl kickstart -k system/ai.agent-core.runtime || fail "kickstart"
  NEW_PID=""
  STATE=""
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    sleep 2
    NEW_PID="$(launchctl print system/ai.agent-core.runtime 2>/dev/null | awk '/^\tpid = /{print $3; exit}')"
    STATE="$(launchctl print system/ai.agent-core.runtime 2>/dev/null | awk '/^\tstate = /{print $3; exit}')"
    if [ -n "$NEW_PID" ] && [ "$NEW_PID" != "$OLD_PID" ] && [ "$STATE" = "running" ]; then break; fi
  done
  if [ -n "$NEW_PID" ] && [ "$NEW_PID" != "$OLD_PID" ] && [ "$STATE" = "running" ]; then
    pass "runtime restarted: old pid=${OLD_PID:-unknown} -> new pid=$NEW_PID state=running"
    echo "APPLY = PASS (3-file closure installed, runtime restarted healthy)"
    echo "NEXT: send the PACKET.md E2E prompt to the build-in-public feishu group"
  else
    fail "runtime did not reach running state with a fresh pid (new=${NEW_PID:-none} state=${STATE:-unknown})"
  fi
else
  echo "NEXT (Owner): sudo bash $0 --apply"
fi
