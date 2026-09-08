#!/bin/bash
# test-production-candidate-runner-v1.sh — PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1
# Required failure tests (spec §8) + happy path + secret guard + runner meta-integrity.
# Fully offline: fixtures under mktemp; PRODUCTION_CANDIDATE_ROOT redirected; zero production touch.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNNER="$REPO_ROOT/scripts/production-candidate-runner.mjs"
NODE="$(command -v node || echo /usr/local/bin/node)"
TMP="$(mktemp -d /tmp/pcr-v1-test-XXXXXX)"
export PRODUCTION_CANDIDATE_ROOT="$TMP/candidates"
PASS=0; FAIL=0

ok()  { PASS=$((PASS+1)); echo "  PASS: $1"; }
bad() { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }
expect_ok()   { local d="$1"; shift; local out; out="$("$@" 2>&1)"; if [ $? -eq 0 ]; then ok "$d"; else bad "$d (expected success, got failure)"; echo "$out" | sed 's/^/    | /'; fi; }
expect_fail() { local d="$1"; shift; local out; out="$("$@" 2>&1)"; if [ $? -ne 0 ]; then ok "$d"; else bad "$d (expected failure, got success)"; echo "$out" | sed 's/^/    | /'; fi; }
fh() { shasum -a 256 "$1" 2>/dev/null | awk '{print $1}'; }
prep() { # prep <spec.json> -> echoes gen dir
  local out; out="$("$NODE" "$RUNNER" prepare --spec "$1" 2>&1)" || { echo "PREPARE FAILED: $out" >&2; return 1; }
  echo "$out" | sed -n 's/^  dir: //p'
}

echo "=== fixture setup (offline) ==="
SRC="$TMP/src-repo"; mkdir -p "$SRC/lib"
git -C "$SRC" init -q -b main
git -C "$SRC" config user.email fixture@test && git -C "$SRC" config user.name fixture
echo 'console.log("app v1")' > "$SRC/app.js"
echo 'export const helperV1 = 1' > "$SRC/lib/helper.js"
git -C "$SRC" add -A && git -C "$SRC" commit -qm v1
SHA1="$(git -C "$SRC" rev-parse HEAD)"
echo 'console.log("app v2")' > "$SRC/app.js"
git -C "$SRC" add -A && git -C "$SRC" commit -qm v2
SHA2="$(git -C "$SRC" rev-parse HEAD)"
V1_BYTES="$(git -C "$SRC" show "$SHA1:app.js")"
LIVE="$TMP/live"; mkdir -p "$LIVE/bin"
printf 'BBBB' > "$LIVE/bin/tool"
TOOL_PRE="$(fh "$LIVE/bin/tool")"
mkspec() { # mkspec <file> <goal> <sha> <mode> <extra-json-snippet-with-leading-comma>
  printf '{\n "goalName":"%s","sourceRepo":"%s","sourceSha":"%s","arch":"x86_64","sourceMode":"%s","liveRoot":"%s"%s\n}\n' \
    "$2" "$SRC" "$3" "$4" "$LIVE" "${5:-}" > "$1"
}
TARGET_TOOL=',"targets":[{"sourcePath":"app.js","targetPath":"/bin/tool","why":"fixture tool"}]'
echo "  src=$SRC SHA1=${SHA1:0:7} SHA2=${SHA2:0:7} live=$LIVE"

echo "=== T1: candidate sealed then one byte flipped → pre-apply FAIL, zero writes (spec §8.1) ==="
mkspec "$TMP/s1.json" FIX-A "$SHA1" git-show "$TARGET_TOOL"
GEN1="$(prep "$TMP/s1.json")"
[ -d "$GEN1" ] && ok "T1 prepare" || bad "T1 prepare"
expect_ok   "T1 seal"            "$NODE" "$RUNNER" seal --gen "$GEN1"
expect_ok   "T1 verify sealed"   "$NODE" "$RUNNER" verify --gen "$GEN1"
chmod u+w "$GEN1/candidate/bin/tool" && printf 'X' >> "$GEN1/candidate/bin/tool"
expect_fail "T1 verify after byte-flip"  "$NODE" "$RUNNER" verify --gen "$GEN1"
expect_fail "T1 apply after byte-flip"   "$NODE" "$RUNNER" apply --gen "$GEN1" --live-root "$LIVE"
[ "$(fh "$LIVE/bin/tool")" = "$TOOL_PRE" ] && ok "T1 live bytes untouched (zero-write)" || bad "T1 live bytes changed"

echo "=== T2: source checkout advances after seal → frozen candidate unchanged (spec §8.2) ==="
mkspec "$TMP/s2.json" FIX-B "$SHA1" git-show "$TARGET_TOOL"
GEN2="$(prep "$TMP/s2.json")"
"$NODE" "$RUNNER" seal --gen "$GEN2" >/dev/null 2>&1
expect_ok "T2 verify after source advanced to SHA2" "$NODE" "$RUNNER" verify --gen "$GEN2"
[ "$(cat "$GEN2/candidate/bin/tool")" = "$V1_BYTES" ] && ok "T2 candidate bytes == SHA1 blob" || bad "T2 candidate bytes drifted"

echo "=== T3: another Goal mutates the shared dev checkout → candidate unchanged (spec §8.3) ==="
printf '/* garbage from another goal */' >> "$SRC/app.js"
mkspec "$TMP/s3.json" FIX-C "$SHA1" git-show "$TARGET_TOOL"
GEN3="$(prep "$TMP/s3.json")"
"$NODE" "$RUNNER" seal --gen "$GEN3" >/dev/null 2>&1
expect_ok "T3 verify with dirty shared checkout" "$NODE" "$RUNNER" verify --gen "$GEN3"
[ "$(cat "$GEN3/candidate/bin/tool")" = "$V1_BYTES" ] && ok "T3 candidate bytes immune to checkout pollution" || bad "T3 polluted"
mkspec "$TMP/s3b.json" FIX-C2 "$SHA1" worktree "$TARGET_TOOL"
expect_fail "T3 worktree-mode prepare refuses dirty checkout" "$NODE" "$RUNNER" prepare --spec "$TMP/s3b.json"
git -C "$SRC" checkout -q -- app.js

echo "=== T4: dependency closure file drift → FAIL (spec §8.4) ==="
CLOSURE_JSON=",\"targets\":[{\"sourcePath\":\"app.js\",\"targetPath\":\"/bin/other\",\"why\":\"t4\"}],\"dependencyClosure\":{\"sourcePath\":\"$SRC/lib\",\"installPath\":\"/opt/lib\"}"
mkspec "$TMP/s4.json" FIX-D "$SHA1" git-show "$CLOSURE_JSON"
GEN4="$(prep "$TMP/s4.json")"
"$NODE" "$RUNNER" seal --gen "$GEN4" >/dev/null 2>&1
expect_ok "T4 verify sealed with closure" "$NODE" "$RUNNER" verify --gen "$GEN4"
chmod -R u+w "$GEN4/candidate/opt" && printf '/* drift */' >> "$GEN4/candidate/opt/lib/helper.js"
expect_fail "T4 verify after closure drift" "$NODE" "$RUNNER" verify --gen "$GEN4"

echo "=== T6: failed-apply path → frozen rollback preimage usable (spec §8.6) ==="
mkspec "$TMP/s6.json" FIX-F "$SHA1" git-show "$TARGET_TOOL"
GEN6="$(prep "$TMP/s6.json")"
"$NODE" "$RUNNER" seal --gen "$GEN6" >/dev/null 2>&1
expect_ok   "T6 apply (happy)"          "$NODE" "$RUNNER" apply --gen "$GEN6" --live-root "$LIVE"
[ "$(fh "$LIVE/bin/tool")" = "$(fh "$GEN6/candidate/bin/tool")" ] && ok "T6 live == candidate bytes after apply" || bad "T6 apply bytes wrong"
[ -f "$GEN6/apply-receipt.json" ] && ok "T6 apply receipt written" || bad "T6 receipt missing"
expect_fail "T6 second apply refuses"   "$NODE" "$RUNNER" apply --gen "$GEN6" --live-root "$LIVE"
expect_ok   "T6 rollback-restore"       "$NODE" "$RUNNER" rollback-restore --gen "$GEN6" --live-root "$LIVE"
[ "$(fh "$LIVE/bin/tool")" = "$TOOL_PRE" ] && ok "T6 live restored to exact frozen preimage" || bad "T6 restore mismatch"
[ -f "$GEN6/rollback/MANIFEST.sha256" ] && ok "T6 rollback separately sealed" || bad "T6 rollback seal missing"

echo "=== T9: apply receipt + runner pin + test receipt registration ==="
mkspec "$TMP/s9.json" FIX-J "$SHA1" git-show "$TARGET_TOOL"
GEN9="$(prep "$TMP/s9.json")"
"$NODE" "$RUNNER" seal --gen "$GEN9" >/dev/null 2>&1
expect_ok "T9 apply" "$NODE" "$RUNNER" apply --gen "$GEN9" --live-root "$LIVE"
PINNED="$(sed -n 's/.*"runnerSha256": "\([0-9a-f]*\)".*/\1/p' "$GEN9/apply-receipt.json")"
[ "$PINNED" = "$(shasum -a 256 "$RUNNER" | awk '{print $1}')" ] && ok "T9 receipt records runner sha (A1.2)" || bad "T9 runner pin missing"
echo "test receipt: failure-test suite r1 PASS" > "$TMP/test-receipt.txt"
expect_ok "T9 register test receipt" "$NODE" "$RUNNER" receipt --gen "$GEN9" --type test --file "$TMP/test-receipt.txt"
expect_ok "T9 verify with receipts"  "$NODE" "$RUNNER" verify --gen "$GEN9"
"$NODE" "$RUNNER" rollback-restore --gen "$GEN9" --live-root "$LIVE" >/dev/null 2>&1

echo "=== T5: production preimage drift → FAILED_NO_MUTATION (spec §8.5) ==="
mkspec "$TMP/s5.json" FIX-E "$SHA1" git-show "$TARGET_TOOL"
GEN5="$(prep "$TMP/s5.json")"
"$NODE" "$RUNNER" seal --gen "$GEN5" >/dev/null 2>&1
printf 'CCCC' > "$LIVE/bin/tool"
CCCC_HASH="$(printf 'CCCC' | shasum -a 256 | awk '{print $1}')"
expect_fail "T5 apply refuses on preimage drift" "$NODE" "$RUNNER" apply --gen "$GEN5" --live-root "$LIVE"
[ "$(fh "$LIVE/bin/tool")" = "$CCCC_HASH" ] && ok "T5 zero-write on refusal" || bad "T5 wrote despite drift"

echo "=== T7: candidate change requires new generation; old stays audit-valid (spec §8.7) ==="
mkspec "$TMP/s7.json" FIX-G "$SHA1" git-show "$TARGET_TOOL"
GEN7A="$(prep "$TMP/s7.json")"
"$NODE" "$RUNNER" seal --gen "$GEN7A" >/dev/null 2>&1
chmod u+w "$GEN7A/candidate/bin/tool" && printf 'X' >> "$GEN7A/candidate/bin/tool"
G7A_SEAL_BEFORE="$(fh "$GEN7A/MANIFEST.sha256")"
expect_fail "T7 old generation tamper is DETECTED (audit-valid = drift surfaced)" "$NODE" "$RUNNER" verify --gen "$GEN7A"
GEN7B="$(prep "$TMP/s7.json")"
"$NODE" "$RUNNER" seal --gen "$GEN7B" >/dev/null 2>&1
expect_ok "T7 corrected candidate = new generation g2" "$NODE" "$RUNNER" verify --gen "$GEN7B"
[ "$GEN7A" != "$GEN7B" ] && ok "T7 g1/g2 are disjoint generation dirs" || bad "T7 generation dirs collide"
[ "$(fh "$GEN7A/MANIFEST.sha256")" = "$G7A_SEAL_BEFORE" ] && ok "T7 g1 seal untouched by g2 creation" || bad "T7 g1 mutated"

echo "=== T8: two Goals prepare concurrently → no shared writable candidate bytes (spec §8.8) ==="
mkspec "$TMP/s8a.json" FIX-H "$SHA1" git-show "$TARGET_TOOL"
mkspec "$TMP/s8b.json" FIX-I "$SHA2" git-show "$TARGET_TOOL"
"$NODE" "$RUNNER" prepare --spec "$TMP/s8a.json" > "$TMP/p8a.log" 2>&1 &
PA=$!
"$NODE" "$RUNNER" prepare --spec "$TMP/s8b.json" > "$TMP/p8b.log" 2>&1 &
PB=$!
wait $PA; RA=$?; wait $PB; RB=$?
[ $RA -eq 0 ] && [ $RB -eq 0 ] && ok "T8 both concurrent prepares succeeded" || bad "T8 a concurrent prepare failed"
GEN8A="$(sed -n 's/^  dir: //p' "$TMP/p8a.log")"
GEN8B="$(sed -n 's/^  dir: //p' "$TMP/p8b.log")"
if [ -n "$GEN8A" ] && [ -n "$GEN8B" ] && [ "$GEN8A" != "$GEN8B" ]; then
  ok "T8 disjoint generation dirs, no shared bytes"
else
  bad "T8 disjointness violated"
fi
expect_ok "T8 seal A" "$NODE" "$RUNNER" seal --gen "$GEN8A"
expect_ok "T8 seal B" "$NODE" "$RUNNER" seal --gen "$GEN8B"

echo "=== T10: secret-class bytes refused (NO_SECRET_EXPOSURE) ==="
printf 'TOKEN=supersecret' > "$SRC/lib/.env"
expect_fail "T10 prepare refuses secret-class closure content" "$NODE" "$RUNNER" prepare --spec "$TMP/s4.json"
rm -f "$SRC/lib/.env"

echo "=== T11: runner meta-integrity — mutated runner cannot apply (AMENDMENT_1 A1.2) ==="
cp "$RUNNER" "$TMP/tampered-runner.mjs" && printf '// tampered\n' >> "$TMP/tampered-runner.mjs"
mkspec "$TMP/s11.json" FIX-K "$SHA1" git-show "$TARGET_TOOL"
GEN11="$(prep "$TMP/s11.json")"
"$NODE" "$RUNNER" seal --gen "$GEN11" >/dev/null 2>&1
expect_fail "T11 apply via mutated runner refuses at gate0" "$NODE" "$TMP/tampered-runner.mjs" apply --gen "$GEN11" --live-root "$LIVE"

echo "=== T12: built-artifact source (fromPath disk bytes) → sealed like git bytes ==="
printf '#!/bin/sh\necho built-binary-v1\n' > "$TMP/built-tool" && chmod 755 "$TMP/built-tool"
printf '{\n "goalName":"FIX-L","sourceRepo":"%s","sourceSha":"%s","arch":"x86_64","sourceMode":"git-show","liveRoot":"%s","targets":[{"fromPath":"%s","targetPath":"/bin/built","why":"build output candidate"}]\n}\n' \
  "$SRC" "$SHA1" "$LIVE" "$TMP/built-tool" > "$TMP/s12.json"
GEN12="$(prep "$TMP/s12.json")"
"$NODE" "$RUNNER" seal --gen "$GEN12" >/dev/null 2>&1
expect_ok "T12 verify sealed built artifact" "$NODE" "$RUNNER" verify --gen "$GEN12"
printf '#!/bin/sh\necho REBUILT\n' > "$TMP/built-tool"
expect_ok "T12 disk source rebuilt after seal → candidate unchanged" "$NODE" "$RUNNER" verify --gen "$GEN12"
grep -q 'built-binary-v1' "$GEN12/candidate/bin/built" && ok "T12 candidate holds seal-time bytes" || bad "T12 candidate drifted with disk source"

echo "=== T13: symlinked live target → apply refuses to write through the link ==="
mkdir -p "$LIVE/real" && printf 'REAL' > "$LIVE/real/tool" && ln -sfn real/tool "$LIVE/bin/linked"
printf '{\n "goalName":"FIX-M","sourceRepo":"%s","sourceSha":"%s","arch":"x86_64","sourceMode":"git-show","liveRoot":"%s","targets":[{"sourcePath":"app.js","targetPath":"/bin/linked","why":"symlink guard"}]\n}\n' \
  "$SRC" "$SHA1" "$LIVE" > "$TMP/s13.json"
GEN13="$(prep "$TMP/s13.json")"
"$NODE" "$RUNNER" seal --gen "$GEN13" >/dev/null 2>&1
expect_fail "T13 apply refuses symlinked target" "$NODE" "$RUNNER" apply --gen "$GEN13" --live-root "$LIVE"
[ "$(cat "$LIVE/real/tool")" = "REAL" ] && ok "T13 symlink target bytes untouched" || bad "T13 wrote through symlink"

echo ""
echo "=== SUMMARY ==="
echo "TMPDIR=$TMP"
if [ "$FAIL" -eq 0 ]; then
  echo "ALL TESTS PASS: $PASS assertions passed, 0 failed"
  rm -rf "$TMP"
  exit 0
else
  echo "TESTS FAILED: $FAIL failed, $PASS passed (fixtures preserved at $TMP)"
  exit 1
fi
