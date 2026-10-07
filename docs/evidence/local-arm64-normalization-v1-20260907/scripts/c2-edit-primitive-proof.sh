#!/bin/bash
# C2 EDIT-PRIMITIVE OFF-LANE FIXTURE PROOF (packet erratum r376, task agent-control#558).
# NON_PRODUCTION: runs ONLY against /tmp fixture copies of the frozen preimage.
# No launchd mutation, no service reload; live file accessed read-only via cp -p.
# Produces: raw/61-c2-candidate-plist.plist (frozen candidate bytes)
#           raw/62-c2-edit-primitive-fixture-proof.txt (this transcript)
set -u
EV="/Users/yanfenma/workspace/.zcode-worktrees/workspace+project+dsh-agent-core/ac-558/docs/evidence/local-arm64-normalization-v1-20260907"
RAW="$EV/raw"
PRIM="$EV/scripts/c2-apply-program-args0-edit.sh"
LIVE=/Users/yanfenma/Library/LaunchAgents/com.xiaomusic.secure.plist
FROZEN_SHA=e23d0371695260f1a2aec5b4d3ce56c60bce088c21bec69baa9fb2d2325632e0
NEW_ARG0=/Users/yanfenma/Library/PythonEnvs/xiaomusic-arm64/bin/xiaomusic
REJECTED="$RAW/60-c2-rejected-plist/rejected-by-launchd-bootstrap5.plist"
FIX=/tmp/c2-errata-r376
OUT="$RAW/62-c2-edit-primitive-fixture-proof.txt"
CANDIDATE61="$RAW/61-c2-candidate-plist.plist"
OVERALL=PASS

mkdir -p "$FIX"; : > "$OUT"
note(){ echo "== $* ==" | tee -a "$OUT"; }
assert(){ local desc=$1; shift; local rc=0; "$@" >>"$OUT" 2>&1 || rc=$?
  if [ "$rc" -eq 0 ]; then note "PASS: $desc"; else note "FAIL(rc=$rc): $desc"; OVERALL=FAIL; fi; }
refuse(){ local desc=$1; shift; local rc=0; "$@" >>"$OUT" 2>&1 || rc=$?
  if [ "$rc" -eq 9 ]; then note "PASS(refused exit 9 as required): $desc"
  else note "FAIL(expected refusal exit 9, got rc=$rc): $desc"; OVERALL=FAIL; fi; }
expect(){ local want=$1 desc=$2; shift 2; local rc=0; "$@" >>"$OUT" 2>&1 || rc=$?
  if [ "$rc" -eq "$want" ]; then note "PASS: $desc"; else note "FAIL(want rc=$want got $rc): $desc"; OVERALL=FAIL; fi; }

note "C2 EDIT-PRIMITIVE FIXTURE PROOF — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
note "host: macOS $(sw_vers -productVersion 2>/dev/null) / $(uname -m) / darwin $(uname -r)"
LIVESTATED=$(shasum -a 256 "$LIVE" | awk '{print $1}')
note "live preimage sha: $LIVESTATED (frozen: $FROZEN_SHA)"
note "scope: /tmp fixtures only; zero launchd/service mutation"

# ---- fixtures ----
rm -rf "$FIX"; mkdir -p "$FIX"
cp -p "$LIVE" "$FIX/fx-a.plist"; cp -p "$LIVE" "$FIX/fx-a-bak.plist"
cp -p "$LIVE" "$FIX/fx-b.plist"; cp -p "$LIVE" "$FIX/fx-b-bak.plist"
note "fixtures made (cp -p, byte-identical to live preimage)"

# ---- POSITIVE: primitive applies with all guards ----
note "POSITIVE apply (fixture A)"
expect 0 "primitive applies to fixture A (all internal guards green)" \
  bash "$PRIM" "$FIX/fx-a.plist" "$FIX/fx-a-bak.plist" "$FROZEN_SHA" "$NEW_ARG0"
CAND_A=$(shasum -a 256 "$FIX/fx-a.plist" | awk '{print $1}')
note "candidate sha A = $CAND_A"
expect 0 "primitive applies to fixture B — determinism" \
  bash "$PRIM" "$FIX/fx-b.plist" "$FIX/fx-b-bak.plist" "$FROZEN_SHA" "$NEW_ARG0"
CAND_B=$(shasum -a 256 "$FIX/fx-b.plist" | awk '{print $1}')
note "candidate sha B = $CAND_B"
assert "determinism: candidate A bytes == candidate B bytes" test "$CAND_A" = "$CAND_B"

# ---- byte/semantic/form guards on the candidate ----
note "GUARDS on candidate"
expect 0 "byte diff vs preimage is exactly one changed line pair" \
  bash -c "[ \"\$(diff \"$FIX/fx-a-bak.plist\" \"$FIX/fx-a.plist\" | grep -c '^[<>]')\" = 2 ]"
expect 0 "changed lines are the two <string> lines and nothing else" \
  bash -c "diff \"$FIX/fx-a-bak.plist\" \"$FIX/fx-a.plist\" | grep '^[<>]' | grep -vc '<string>' | grep -q '^0$'"
expect 0 "zero tab bytes in candidate (launchd-rejected form absent)" \
  bash -c "! grep -q \"\$(printf '\\t')\" \"$FIX/fx-a.plist\""
python3 - "$FIX/fx-a-bak.plist" "$FIX/fx-a.plist" "$NEW_ARG0" >>"$OUT" 2>&1 <<'PYEOF'
import sys
a = open(sys.argv[1], 'rb').read(); c = open(sys.argv[2], 'rb').read()
old = b"        <string>/usr/local/bin/xiaomusic</string>\n"
new = b"        <string>" + sys.argv[3].encode() + b"</string>\n"
sys.exit(0 if a.replace(old, b"@@\n") == c.replace(new, b"@@\n") else 1)
PYEOF
PYRC=$?
expect 0 "form-identity: all non-target bytes identical to the launchd-accepted preimage form" test "$PYRC" -eq 0
python3 - "$FIX/fx-a-bak.plist" "$FIX/fx-a.plist" "$NEW_ARG0" >>"$OUT" 2>&1 <<'PYEOF'
import sys, plistlib
a = plistlib.load(open(sys.argv[1], 'rb')); c = plistlib.load(open(sys.argv[2], 'rb'))
assert len(c['ProgramArguments']) == 3, 'array length changed'
assert c['ProgramArguments'][0] == sys.argv[3]
assert c['ProgramArguments'][1:] == a['ProgramArguments'][1:], 'tail args changed'
diffs = [k for k in set(a) | set(c) if a.get(k) != c.get(k)]
assert diffs == ['ProgramArguments'], diffs
PYEOF
PYRC=$?
expect 0 "semantic diff == exactly ProgramArguments[0]; array length 3; other keys deep-equal" test "$PYRC" -eq 0
expect 0 "plutil -lint candidate" plutil -lint "$FIX/fx-a.plist"
cp "$FIX/fx-a.plist" "$FIX/fx-rt.plist"; plutil -convert xml1 "$FIX/fx-rt.plist" >/dev/null 2>>"$OUT"
python3 - "$FIX/fx-a.plist" "$FIX/fx-rt.plist" >>"$OUT" 2>&1 <<'PYEOF'
import sys, plistlib
sys.exit(0 if plistlib.load(open(sys.argv[1],'rb')) == plistlib.load(open(sys.argv[2],'rb')) else 1)
PYEOF
PYRC=$?
expect 0 "plutil -convert xml1 round-trip semantic equality (Apple-parser agreement)" test "$PYRC" -eq 0
rm -f "$FIX/fx-rt.plist"

# ---- freeze candidate bytes as raw/61 ----
cp "$FIX/fx-a.plist" "$CANDIDATE61"
note "FROZEN candidate -> raw/61 sha256 = $(shasum -a 256 "$CANDIDATE61" | awk '{print $1}')"
assert "raw/61 sha == fixture candidate sha" test "$(shasum -a 256 "$CANDIDATE61" | awk '{print $1}')" = "$CAND_A"

# ---- ROLLBACK serialization compatibility ----
note "ROLLBACK serialization compatibility"
cp -p "$FIX/fx-a-bak.plist" "$FIX/fx-a.plist"
assert "cp -p restore sha == frozen preimage" test "$(shasum -a 256 "$FIX/fx-a.plist" | awk '{print $1}')" = "$FROZEN_SHA"
expect 0 "primitive re-applies on restored preimage" \
  bash "$PRIM" "$FIX/fx-a.plist" "$FIX/fx-a-bak.plist" "$FROZEN_SHA" "$NEW_ARG0"
assert "re-applied candidate byte-identical to frozen raw/61" \
  test "$(shasum -a 256 "$FIX/fx-a.plist" | awk '{print $1}')" = "$CAND_A"

# ---- REFUSAL paths (fail-closed) ----
note "REFUSAL paths"
refuse "apply to already-edited target (idempotency = refuse)" \
  bash "$PRIM" "$FIX/fx-a.plist" "$FIX/fx-a-bak.plist" "$CAND_A" "$NEW_ARG0"
refuse "apply with drifted expected-sha" \
  bash "$PRIM" "$FIX/fx-a-bak.plist" "$FIX/fx-a-bak.plist" 0000000000000000000000000000000000000000000000000000000000000000 "$NEW_ARG0"
refuse "apply with missing backup (rollback coupling mandatory)" \
  bash "$PRIM" "$FIX/fx-a-bak.plist" "$FIX/fx-a-bak.plist.NOPE" "$FROZEN_SHA" "$NEW_ARG0"

# ---- RED: reproduce the two proven r373 failure modes (fixture-only) ----
note "RED R1: plutil -replace ProgramArguments.0 misbehaves on array index (reproduced; banned primitive)"
cp -p "$FIX/fx-a-bak.plist" "$FIX/fx-r1.plist"
plutil -replace 'ProgramArguments.0' -string "$NEW_ARG0" "$FIX/fx-r1.plist" >>"$OUT" 2>&1 || true
python3 - "$FIX/fx-r1.plist" >>"$OUT" 2>&1 <<'PYEOF'
import sys, plistlib
pa = plistlib.load(open(sys.argv[1], 'rb'))['ProgramArguments']
print(f"  R1: ProgramArguments after plutil -replace: length={len(pa)} elements={pa}")
sys.exit(0 if len(pa) != 3 else 1)
PYEOF
expect 0 "R1: plutil -replace does NOT leave a clean 3-element replacement (append/insert bug reproduced)" test $? -eq 0

note "RED R2: plistlib dump edit (order-preserving) == raw/60 rejected bytes — root-cause closure"
python3 - "$FIX/fx-r2.plist" "$FIX/fx-a-bak.plist" "$NEW_ARG0" <<'PYEOF'
import sys, plistlib
d = plistlib.load(open(sys.argv[2], 'rb')); d['ProgramArguments'][0] = sys.argv[3]
with open(sys.argv[1], 'wb') as f: plistlib.dump(d, f, sort_keys=False)
PYEOF
S60=$(shasum -a 256 "$REJECTED" | awk '{print $1}'); SR2=$(shasum -a 256 "$FIX/fx-r2.plist" | awk '{print $1}')
note "  raw/60 (rejected) sha = $S60"
note "  R2 plistlib dump sha  = $SR2"
assert "R2: byte-identical to the r373 launchd-rejected artifact (EIO 5)" test "$S60" = "$SR2"
expect 0 "R2: rejected form carries tab indentation; accepted preimage form does not" \
  bash -c "grep -q \"\$(printf '\\t')\" \"$REJECTED\" && ! grep -q \"\$(printf '\\t')\" \"$FIX/fx-a-bak.plist\""

note "RED R3: plutil -convert xml1 emits tab-indented XML — doc-12 candidate (b) refuted"
cp "$FIX/fx-r2.plist" "$FIX/fx-r3.plist"; plutil -convert xml1 "$FIX/fx-r3.plist" >>"$OUT" 2>&1
expect 0 "R3: round-trip output still tab-indented (would re-fail bootstrap identically)" \
  bash -c "grep -q \"\$(printf '\\t')\" \"$FIX/fx-r3.plist\""
cp -p "$FIX/fx-a-bak.plist" "$FIX/fx-r4.plist"; plutil -convert xml1 "$FIX/fx-r4.plist" >>"$OUT" 2>&1
expect 0 "R3b: even round-tripping the ORIGINAL also emits tabs + re-sorted keys (normalization destroys the accepted form)" \
  bash -c "grep -q \"\$(printf '\\t')\" \"$FIX/fx-r4.plist\""
note "  R3b head (key order re-sorted alphabetically, tab indent):"
head -6 "$FIX/fx-r4.plist" | sed 's/^/    /' | tee -a "$OUT"

note "RED R5: defaults-write rewrite of ProgramArguments (alternative system primitive — form check)"
cp -p "$FIX/fx-a-bak.plist" "$FIX/fx-r5.plist"
/usr/bin/defaults write "$FIX/fx-r5" ProgramArguments -array \
  /usr/local/bin/xiaomusic --config /Users/yanfenma/workspace/baby/xiaoai/conf/setting.json >>"$OUT" 2>&1
if [ -f "$FIX/fx-r5.plist" ]; then
  note "  R5 output format: $(file -b "$FIX/fx-r5.plist")"
  case "$(head -c 8 "$FIX/fx-r5.plist")" in
    bplist00) note "  R5 head: binary bplist00 (content dump suppressed to keep transcript textual)" ;;
    *) head -6 "$FIX/fx-r5.plist" | sed 's/^/    /' | tee -a "$OUT" ;;
  esac
  python3 - "$FIX/fx-r5.plist" >>"$OUT" 2>&1 <<'PYEOF'
import sys, plistlib
raw = open(sys.argv[1], 'rb').read()
d = plistlib.loads(raw)
pa = d.get('ProgramArguments')
binform = raw[:8] == b'bplist00'
print(f"  R5: ProgramArguments={pa} binary={binform}")
# accepted form = the space-indented XML with original key order; a binary rewrite
# is already a different serialization, which by itself refutes the primitive
sys.exit(0 if not binform else 1)
PYEOF
  PYRC=$?
  expect 0 "R5: defaults write does NOT preserve the accepted XML serialization form (binary rewrite — refuted as candidate primitive)" \
    test "$PYRC" -eq 1
else
  note "  R5: defaults produced no file (recorded; primitive unusable)"
fi

# ---- live anchor unchanged ----
note "LIVE anchor after all fixture work (read-only)"
assert "live plist sha still == frozen preimage (zero live effect)" \
  test "$(shasum -a 256 "$LIVE" | awk '{print $1}')" = "$LIVESTATED"

note "OVERALL=$OVERALL"
[ "$OVERALL" = PASS ] || exit 1
