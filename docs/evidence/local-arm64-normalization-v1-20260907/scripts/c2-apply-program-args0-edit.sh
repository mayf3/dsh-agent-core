#!/bin/bash
# C2 EDIT PRIMITIVE (packet erratum r376) — deterministic single-line byte substitution.
#
# Provenance: XIAOMUSIC-PACKET-C2 amendment, docs 11 §6 / 13 (task agent-control#558).
# Root cause of the r373 failure: launchd on this OS rejects TAB-indented XML plists
# at bootstrap (exit 5) while accepting the 4/8-space-indented original form; plistlib
# dump and `plutil -convert xml1` both emit tab-indented XML, so the only shape-safe
# primitive is an in-byte substitution of exactly the ProgramArguments[0] line.
#
# Usage:
#   c2-apply-program-args0-edit.sh <TARGET_PLIST> <BACKUP_PLIST> <EXPECTED_PREIMAGE_SHA256> <NEW_ARG0>
#
# Contract (fail-closed, all guards must pass before the target is touched):
#   1. TARGET sha256 == EXPECTED_PREIMAGE_SHA256 (drift gate) and BACKUP sha256 too.
#   2. TARGET parses (plistlib) with ProgramArguments length 3 and [0] == OLD_ARG0.
#   3. OLD_ARG0 line (8-space indent form) occurs EXACTLY once in the bytes.
#   4. NEW_ARG0 contains no XML-escapable bytes (& < > ' ").
#   5. Candidate built purely in memory; guards: one-line byte diff vs preimage,
#      form-identity (non-changed bytes identical), zero tab bytes (launchd-form guard),
#      plistlib semantic diff == exactly ProgramArguments[0], plutil -lint OK,
#      plutil -convert xml1 round-trip semantic equality (scratch copy only).
#   6. Apply = truncate+write on the SAME inode (preserves xattrs/mode/owner), fchmod 0600.
#   7. Post-apply: re-read target, sha == candidate sha, lint OK, byte-diff vs backup == 1 line.
# Exit 0 only if every guard passed (idempotency: refuses if TARGET arg0 already == NEW_ARG0).
set -u
TARGET=$1; BACKUP=$2; EXPECTED_SHA=$3; NEW_ARG0=$4
OLD_ARG0=/usr/local/bin/xiaomusic
OLD_LINE="        <string>${OLD_ARG0}</string>
"
die(){ echo "PRIMITIVE_REFUSED: $*" >&2; exit 9; }

command -v python3 >/dev/null || die "python3 not on PATH"
command -v plutil   >/dev/null || die "plutil not on PATH"
[ -f "$TARGET" ] || die "target missing: $TARGET"
[ -f "$BACKUP" ]  || die "backup missing: $BACKUP (rollback coupling is mandatory)"

TSHA=$(shasum -a 256 "$TARGET" | awk '{print $1}')
BSHA=$(shasum -a 256 "$BACKUP" | awk '{print $1}')
[ "$TSHA" = "$EXPECTED_SHA" ] || die "target sha drift: $TSHA != $EXPECTED_SHA"
[ "$BSHA" = "$EXPECTED_SHA" ] || die "backup sha drift: $BSHA != $EXPECTED_SHA"

python3 - "$TARGET" "$NEW_ARG0" "$OLD_LINE" <<'PYEOF' || die "python guards failed"
import sys, plistlib
target, new_b, old_line = sys.argv[1], sys.argv[2].encode(), sys.argv[3].encode()
raw = open(target, 'rb').read()
if raw.count(old_line) != 1:
    sys.exit(f"old arg0 line count = {raw.count(old_line)}, must be exactly 1")
for ch in b"&<>\"'":
    if ch in new_b:
        sys.exit(f"new arg0 contains XML-escapable byte {chr(ch)}")
old = plistlib.loads(raw)
pa = old.get('ProgramArguments')
inner = old_line.decode().strip()[len('<string>'):-len('</string>')]
if not isinstance(pa, list) or len(pa) != 3 or pa[0] != inner:
    sys.exit("preimage ProgramArguments shape/[0] mismatch")
if len(set(pa)) != len(pa):
    sys.exit("duplicate ProgramArguments elements")
PYEOF

CAND=$(mktemp /tmp/c2-candidate.XXXXXX)
python3 - "$TARGET" "$CAND" "$NEW_ARG0" "$OLD_LINE" <<'PYEOF' || { rm -f "$CAND"; die "candidate build failed"; }
import sys, plistlib
target, cand_path, new_arg0 = sys.argv[1], sys.argv[2], sys.argv[3].encode()
old_line = sys.argv[4].encode()
raw = open(target, 'rb').read()
new_line = b"        <string>" + new_arg0 + b"</string>\n"
cand = raw.replace(old_line, new_line, 1)
# form guards: exactly one line changed, everything else byte-identical, zero tabs
mask = lambda b, line, filler: b.replace(line, b"@@C2@@\n")
if mask(raw, old_line, None) != mask(cand, new_line, None):
    sys.exit("non-target bytes changed")
if b"\t" in cand:
    sys.exit("tab byte in candidate (launchd-rejected form)")
a, b = plistlib.loads(raw), plistlib.loads(cand)
if a == b:
    sys.exit("no semantic change")
diffs = []
for k in set(a) | set(b):
    va, vb = a.get(k), b.get(k)
    if va != vb:
        if k == 'ProgramArguments' and isinstance(va, list) and isinstance(vb, list):
            if len(va) != len(vb): diffs.append(f"{k}: length {len(va)}->{len(vb)}")
            else: diffs += [f"ProgramArguments[{i}]" for i in range(len(va)) if va[i] != vb[i]]
        else:
            diffs.append(k)
if diffs != ['ProgramArguments[0]']:
    sys.exit(f"semantic diff != exactly ProgramArguments[0]: {diffs}")
open(cand_path, 'wb').write(cand)
PYEOF

plutil -lint "$CAND" >/dev/null || { rm -f "$CAND"; die "candidate lint failed"; }
RT=$(mktemp /tmp/c2-roundtrip.XXXXXX); cp "$CAND" "$RT"
plutil -convert xml1 "$RT" >/dev/null || { rm -f "$CAND" "$RT"; die "round-trip convert failed"; }
python3 - "$CAND" "$RT" <<'PYEOF' || { rm -f "$CAND" "$RT"; die "round-trip semantic mismatch"; }
import sys, plistlib
sys.exit(0 if plistlib.load(open(sys.argv[1],'rb')) == plistlib.load(open(sys.argv[2],'rb')) else 1)
PYEOF
rm -f "$RT"

CSHA=$(shasum -a 256 "$CAND" | awk '{print $1}')
python3 - "$TARGET" "$CAND" <<'PYEOF' || { rm -f "$CAND"; die "atomic apply failed"; }
import sys, os, stat
target, cand = sys.argv[1], sys.argv[2]
data = open(cand, 'rb').read()
fd = os.open(target, os.O_WRONLY)          # same inode: xattrs/mode/owner preserved
try:
    os.ftruncate(fd, 0); os.lseek(fd, 0, os.SEEK_SET); os.write(fd, data)
    os.fchmod(fd, 0o600)
finally:
    os.close(fd)
PYEOF
rm -f "$CAND"

PSHA=$(shasum -a 256 "$TARGET" | awk '{print $1}')
plutil -lint "$TARGET" >/dev/null || die "post-apply lint failed"
[ "$PSHA" = "$CSHA" ] || die "post-apply sha mismatch: $PSHA != $CSHA"
DIFF_LINES=$(diff "$BACKUP" "$TARGET" | grep -c '^[<>]' || true)
[ "$DIFF_LINES" = "2" ] || die "post-apply byte diff vs backup is $DIFF_LINES lines, expected exactly 2 (one changed pair)"

echo "PRIMITIVE_APPLIED target=$TARGET new_sha256=$PSHA"
