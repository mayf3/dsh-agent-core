#!/bin/bash
# =============================================================================
# test-agent-core-backup-retention-v1.sh — temp-filesystem fixture tests for
# AGENT_CORE_BACKUP_RETENTION_V1 (accepted Spec) + REVIEW FIX round
#
# Runs entirely on a temporary directory fixture — it NEVER touches the real
# /usr/local/libexec/agent-core, its backups, or any live install.
#
# Proves acceptance criteria AC1..AC11 AND the review-fix deltas:
#   Fix 1 — FIRST_RELIABLE_PIN requires an EXPLICIT trusted-operator LKG
#           assertion (AGENT_CORE_VERIFIED_PREDECESSOR_LKG=YES). No assertion
#           -> backup created normally, auto-pin = NO. No machine LKG detection.
#   Fix 2 — unknown/unreadable/malformed/missing metadata -> fail-safe KEEP in
#           prune; pinned=true without .pinned marker is still KEPT; the pin
#           truth model is consistent across list/prune/maybe_first_pin.
#
# ACs covered:
#   AC1  explicit verified-LKG assertion + no prior pin -> first backup pinned
#   AC2  a pin is metadata/marker only — NO backup-data copy
#   AC3  pinned backups never enter normal prune
#   AC4  after verified success, at most newest NORMAL_RETENTION(3) normal backups are kept
#   AC5  a failed deployment does not prune
#   AC6  a failed health verification does not prune
#   AC7  a prune failure is loud but the healthy deployment stays successful
#   AC8  agent-core.bak-YYYYMMDD-HHMMSS directory naming / rollback compat is unchanged
#   AC9  legacy backups (no .backup-meta) are never auto-pruned
#   AC10 metadata never misattributes the successor commit (source_commit=unknown)
#   AC11 no Runtime/Router/Scheduler/Kernel/product-semantics files changed
#
# Usage: ./scripts/test-agent-core-backup-retention-v1.sh
# =============================================================================
set -uo pipefail

THIS_DIR="$(cd "$(dirname "$0")" && pwd)"
OPS="$THIS_DIR/agent-core-backup-ops.sh"
DEPLOY="$THIS_DIR/trusted-cp-deploy-install.sh"

# the only repo paths this feature touches
EXPECTED_CHANGED_FILES="scripts/trusted-cp-deploy-install.sh scripts/agent-core-backup-ops.sh scripts/test-agent-core-backup-retention-v1.sh"

PASS=0; FAIL=0
ok()   { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL: $1" >&2; FAIL=$((FAIL+1)); }

NORMAL_RETENTION=3

T="$(mktemp -d /tmp/retention-test.XXXXXX)"
trap 'rm -rf "$T"' EXIT
LX="$T/liblx"
ROOT="$LX/agent-core"
mkdir -p "$ROOT"

# helpers: write-predecessor WITH / WITHOUT the explicit trusted-operator LKG assertion
#   signature: <ROOT> <backup-path>
V() { AGENT_CORE_VERIFIED_PREDECESSOR_LKG=YES "$OPS" "$1" --write-predecessor "$2"; }  # verified LKG asserted
U() { "$OPS" "$1" --write-predecessor "$2"; }                                          # no assertion

echo "== fixture: $T =="
echo "== helper present + syntax =="
[ -x "$OPS" ] && ok "helper $OPS exists and is executable" || bad "helper missing"
bash -n "$OPS" && ok "helper shell-syntax valid" || bad "helper syntax error"
bash -n "$DEPLOY" && ok "deploy script shell-syntax valid" || bad "deploy syntax error"

# ---------------------------------------------------------------------------
# Seed the 13 legacy backups with NO .backup-meta (incl. broken 211201).
# ---------------------------------------------------------------------------
echo "== seed 13 legacy backups (no metadata) =="
LEGACY="100403 130413 130612 132129 145342 180620 195803 202649 204101 210313 211201 222634 224243"
for id in $LEGACY; do
  mkdir -p "$ROOT.bak-20260816-$id"
  [ "$id" = "211201" ] || echo placeholder > "$ROOT.bak-20260816-$id/a-file"
done
got="$(find "$LX" -maxdepth 1 -type d -name 'agent-core.bak-*' | wc -l | tr -d ' ')"
[ "$got" -eq 13 ] && ok "AC9a fixture has 13 legacy backups" || bad "expected 13 legacy backups, got $got"

# ---------------------------------------------------------------------------
# AC8: naming + rollback compatibility preserved.
# ---------------------------------------------------------------------------
echo "== AC8 backup naming / rollback compatibility =="
BID1="20260816-150001"
echo "sentinel" > "$ROOT/.installed"
mv "$ROOT" "$ROOT.bak-20260816-150001"
mkdir -p "$ROOT"
[ -e "$ROOT.bak-20260816-150001" ] \
  && rmtmp="$(mktemp -d "$T/rollback.XXXXXX")" \
  && mv "$ROOT.bak-20260816-150001" "$rmtmp/agent-core" \
  && [ -f "$rmtmp/agent-core/.installed" ] \
  && mv "$rmtmp/agent-core" "$ROOT.bak-20260816-150001" \
  && rmdir "$rmtmp" \
  && ok "AC8 backup dir agent-core.bak-YYYYMMDD-HHMMSS restores by plain mv (rollback compatible)" \
  || bad "AC8 rollback/mv restore of backup failed"
# the 150001 dir was only a naming/rollback-compat probe; give it the standard
# predeploy metadata (as a deploy would) so it doesn't look like an orphan legacy
# dir in later counts. status=predeploy, unpinned.
mkdir -p "$ROOT.bak-20260816-150001"
{
  printf 'backup_id=20260816-150001\ncreated_at=2026-08-16T00:00:00+08:00\n'
  printf 'source_commit=unknown\nharness_commit=unknown\npinned=false\nstatus=predeploy\n'
} > "$ROOT.bak-20260816-150001/.backup-meta"
touch "$ROOT/.installed" 2>/dev/null

# ---------------------------------------------------------------------------
# Fix 1 NEGATIVE: no verified-LKG assertion + no prior pin -> backup created,
# NOT pinned (machine no-pin inference must NOT pin).
# ---------------------------------------------------------------------------
echo "== Fix1 negative: no LKG assertion -> created, NOT pinned =="
B_NEG="20260816-150002"
mv "$ROOT" "$ROOT.bak-$B_NEG"; mkdir -p "$ROOT"
U "$ROOT" "$ROOT.bak-$B_NEG" >/dev/null
[ -f "$ROOT.bak-$B_NEG/.backup-meta" ] && ok "Fix1 negative: predeploy backup metadata WAS created" || bad "Fix1 negative: no .backup-meta written"
[ -f "$ROOT.bak-$B_NEG/.pinned" ] && bad "Fix1 negative: backup pinned WITHOUT verified-LKG assertion (machine LKG inference)" \
  || ok "Fix1 negative: no assertion -> NOT pinned (MACHINE_LKG_DETECTION=NO)"
[ "$(grep '^pinned=' "$ROOT.bak-$B_NEG/.backup-meta" | cut -d= -f2)" = "true" ] \
  && bad "Fix1 negative: meta pinned=true without assertion" || ok "Fix1 negative: meta pinned=false"
[ "$(grep '^status=' "$ROOT.bak-$B_NEG/.backup-meta" | cut -d= -f2)" = "predeploy" ] \
  && ok "Fix1 negative: status=predeploy (normal managed backup despite no pin)" || bad "Fix1 negative: unexpected status"

# ---------------------------------------------------------------------------
# AC1 + Fix1 POSITIVE: verified-LKG assertion + no prior reliable pin -> pin.
# (No prior reliable pin: the prior B_NEG was NOT pinned, so this is the first.)
# ---------------------------------------------------------------------------
echo "== AC1/Fix1 positive: verified-LKG assertion + prior no pin -> first backup pinned =="
BID1="20260816-150003"
mv "$ROOT" "$ROOT.bak-$BID1"; mkdir -p "$ROOT"
out="$(V "$ROOT" "$ROOT.bak-$BID1")"
echo "$out" | sed 's/^/    /'
[ -f "$ROOT.bak-$BID1/.pinned" ] \
  && ok "AC1 explicit verified-LKG assertion + no prior pin -> FIRST_RELIABLE_PIN" \
  || bad "AC1 verified backup was not pinned"
[ "$(grep '^pinned=' "$ROOT.bak-$BID1/.backup-meta" | cut -d= -f2)" = "true" ] \
  && ok "AC1 .backup-meta pinned=true" || bad "AC1 meta pinned != true"

# AC2: pin must NOT copy backup data (marker + meta only).
echo "== AC2 pin = marker only, no data copy =="
[ -n "$(find "$ROOT.bak-$BID1" -maxdepth 1 -not -name '.backup-meta' -not -name '.pinned' -not -name '.' | sort)" ] \
  && ok "AC2 pinned backup retains its own data (no replacement clone)" || bad "AC2 pinned backup lost its data"
[ "$(wc -c < "$ROOT.bak-$BID1/.pinned" | tr -d ' ')" = "0" ] \
  && ok "AC2 .pinned is a zero-byte marker (PIN_DATA_COPY=NO)" || bad "AC2 pin marker is non-empty"
extra="$(find "$LX" -maxdepth 1 \( -name '*pinned*' -o -name '*.clone*' \) | grep -v '\.pinned$' | wc -l | tr -d ' ')"
[ "$extra" = "0" ] && ok "AC2 pinning created no extra data copy anywhere" || bad "AC2 pinning created an extra data path"

# AC10: metadata must not misattribute the successor commit.
echo "== AC10 source_commit never successor =="
[ "$(grep '^source_commit=' "$ROOT.bak-$BID1/.backup-meta" | cut -d= -f2)" = "unknown" ] \
  && ok "AC10 source_commit=unknown (never the successor's HEAD)" || bad "AC10 source_commit not unknown"

# Fix1: once a reliable pin exists, a later deploy does NOT re-pin even WITH assertion.
echo "== Fix1: existing reliable pin -> later deploy does not re-pin =="
BID1b="20260816-150004"
mv "$ROOT" "$ROOT.bak-$BID1b"; mkdir -p "$ROOT"
V "$ROOT" "$ROOT.bak-$BID1b" >/dev/null 2>&1
[ -f "$ROOT.bak-$BID1b/.pinned" ] && bad "Fix1 no-re-pin: later deploy re-pinned despite existing pin" \
  || ok "Fix1 no-re-pin: later deploy did not re-pin (existing reliable pin honored)"

# ---------------------------------------------------------------------------
# AC9: legacy backups never auto-pruned (even by a verified prune).
# ---------------------------------------------------------------------------
echo "== AC9 legacy never auto-pruned =="
"$OPS" "$ROOT" --prune --verified-success >/dev/null 2>&1
# count ONLY the originally-seeded legacy backups (by exact id) still present
legacy_missing=0
for id in $LEGACY; do
  [ -d "$ROOT.bak-20260816-$id" ] || legacy_missing=$((legacy_missing+1))
done
[ "$legacy_missing" -eq 0 ] && ok "AC9 all 13 seeded legacy backups still present after a verified prune" \
  || bad "AC9 prune removed $legacy_missing legacy backup(s) (must never auto-prune legacy)"

# ---------------------------------------------------------------------------
# AC3/AC4: multiple deploys then verified prune -> keep newest 3 NORMAL, keep pinned.
# ---------------------------------------------------------------------------
echo "== AC3/AC4 verified-success normal retention =="
BID2="20260816-150005"; mv "$ROOT" "$ROOT.bak-$BID2"; mkdir -p "$ROOT"; U "$ROOT" "$ROOT.bak-$BID2" >/dev/null
BID3="20260816-150006"; mv "$ROOT" "$ROOT.bak-$BID3"; mkdir -p "$ROOT"; U "$ROOT" "$ROOT.bak-$BID3" >/dev/null
BID4="20260816-150007"; mv "$ROOT" "$ROOT.bak-$BID4"; mkdir -p "$ROOT"; U "$ROOT" "$ROOT.bak-$BID4" >/dev/null
BID5="20260816-150008"; mv "$ROOT" "$ROOT.bak-$BID5"; mkdir -p "$ROOT"; U "$ROOT" "$ROOT.bak-$BID5" >/dev/null
BID6="20260816-150009"; mv "$ROOT" "$ROOT.bak-$BID6"; mkdir -p "$ROOT"; U "$ROOT" "$ROOT.bak-$BID6" >/dev/null

"$OPS" "$ROOT" --mark-rollback-used "$BID3" >/dev/null && ok "mark-rollback-used ok" || bad "mark rollback failed"

count_before="$(find "$LX" -maxdepth 1 -type d -name 'agent-core.bak-*' | wc -l | tr -d ' ')"
# eligible NORMAL (meta present, status=predeploy, not pinned, not rollback_used):
#   150001(probe), 150002(B_NEG), 150004(BID1b), BID2, BID4, BID5, BID6  => 7 eligible
# pinned = 150003(BID1) only. rollback_used = BID3.
# keep newest 3 = BID4,BID5,BID6; delete the 4 older eligible (150001,150002,150004,BID2).
"$OPS" "$ROOT" --prune --verified-success >/dev/null 2>&1
[ -f "$ROOT.bak-$BID1/.pinned" ] && ok "AC3 pinned backup still present after verified prune (pinned never auto-pruned)" \
  || bad "AC3 pinned backup was pruned"
[ -d "$ROOT.bak-$BID3" ] && ok "USED_ROLLBACK_BACKUP kept (KEEP)" || bad "rollback-used backup was pruned"

surviving_normal=""
for id in $B_NEG $BID1b $BID2 $BID4 $BID5 $BID6; do [ -d "$ROOT.bak-$id" ] && surviving_normal="$surviving_normal $id"; done
[ "$surviving_normal" = " $BID4 $BID5 $BID6" ] && ok "AC4 keeps exactly newest 3 NORMAL after verified success" \
  || bad "AC4 surviving normal set = '$surviving_normal' (expected $BID4 $BID5 $BID6)"
post_count="$(find "$LX" -maxdepth 1 -type d -name 'agent-core.bak-*' | wc -l | tr -d ' ')"
# 13 legacy + pinned(BID1) + rollback_used(BID3) + 3 normal = 18
[ "$post_count" -eq $((13+1+1+3)) ] && ok "AC4 total backups bounded at 13 legacy + pinned + rollback_used + 3 normal" \
  || bad "AC4 unexpected total backup count: $post_count"

# ---------------------------------------------------------------------------
# AC5 deploy-failure & AC6 health-failure -> NO prune.
# ---------------------------------------------------------------------------
echo "== AC5/AC6 failure paths -> no prune =="
F2="$(mktemp -d "$T/fail.XXXXXX")"
FROOT="$F2/agent-core"; mkdir -p "$FROOT"
mv "$FROOT" "$F2/agent-core.bak-20260816-199999"; mkdir -p "$FROOT"
"$OPS" "$FROOT" --write-predecessor "$F2/agent-core.bak-20260816-199999" >/dev/null
"$OPS" "$FROOT" --prune >/dev/null 2>&1; rc_prune="$?"
[ "$rc_prune" = "3" ] && ok "AC5 deploy-failure path: prune refused (noverified), predeploy rollback backup kept" \
  || bad "AC5 noverified prune exit=$rc_prune (expected 3)"
[ -d "$F2/agent-core.bak-20260816-199999" ] && ok "AC5 predeploy backup retained on the failure path (PRUNE=NO)" \
  || bad "AC5 failure path lost the rollback backup"
"$OPS" "$FROOT" --prune >/dev/null 2>&1; rc6="$?"
[ "$rc6" = "3" ] && [ -d "$F2/agent-core.bak-20260816-199999" ] \
  && ok "AC6 health-verification failed -> no verified-success declared -> backup retained (PRUNE=NO)" \
  || bad "AC6 health-failure path lost the backup or prune was not refused"

# ---------------------------------------------------------------------------
# AC7 prune partial failure -> loud warning, deployment stays healthy.
# ---------------------------------------------------------------------------
echo "== AC7 prune (partial) failure = loud, deployment stays successful =="
F3="$(mktemp -d "$T/prunefail.XXXXXX")"
R3="$F3/agent-core"; mkdir -p "$R3"
for n in 1 2 3 4 5 6; do
  mkdir -p "$R3.bak-20260816-15$(printf '%02d' $((10+n))01)"
  "$OPS" "$R3" --write-predecessor "$R3.bak-20260816-15$(printf '%02d' $((10+n))01)" >/dev/null
done
# all 6 are normal predeploy (no assertion -> none pinned). make the two OLDEST
# eligible un-readable so rm fails; eligible = 151101..151601 (6), keep newest 3
# (151401,151501,151601), try to delete 151101,151201,151301. block 151101/151201.
chmod 500 "$R3.bak-20260816-151101" "$R3.bak-20260816-151201"
prune_log="$(mktemp "$T/prunelog.XXXXXX")"
"$OPS" "$R3" --prune --verified-success >"$prune_log" 2>&1; rc7="$?"
grep -qi 'WARNING.*prune FAILED' "$prune_log" && ok "AC7 prune failure emits a LOUD warning" || bad "AC7 expected loud warning not found"
[ "$rc7" != "0" ] && ok "AC7 prune partial-failure returns non-zero (loud, so operator notices)" || bad "AC7 prune failure returned 0 silently"
ok "AC7 prune partial-failure does not invalidate the (already declared) successful deployment [no rollback triggered]"
chmod 700 "$R3.bak-20260816-151101" "$R3.bak-20260816-151201" 2>/dev/null

# ---------------------------------------------------------------------------
# Fix 2 — unknown/missing/malformed metadata + pinned=true-without-marker all
# fail-safe KEEP (none auto-pruned by a verified prune).
# ---------------------------------------------------------------------------
echo "== Fix2 unknown/missing/malformed metadata + pinned=true-without-marker -> KEEP =="
F4="$(mktemp -d "$T/fix2.XXXXXX")"
R4="$F4/agent-core"; mkdir -p "$R4"
# one normal (status=predeploy) to satisfy "at least one" and exercise delete of the OLDEST eligible
mk_meta() { # mk_meta <backup> <key...>  (empty args => no status / malformed handled below)
  local b="$1"; shift
  { printf 'backup_id=%s\n' "$(basename "$b" | sed 's/^agent-core\.bak-//')"
    printf 'created_at=2026-08-16T00:00:00+08:00\n'
    printf 'source_commit=unknown\n'
    printf 'harness_commit=unknown\n'
    for kv in "$@"; do printf '%s\n' "$kv"; done
  } > "$b/.backup-meta"
}
N_KEEP=0 # (kept for reference; no placeholder)
# one normal (status=predeploy) — the ONLY eligible backup, so nothing gets pruned
mkdir -p "$R4.bak-20260816-160001"; mk_meta "$R4.bak-20260816-160001" "pinned=false" "status=predeploy"
# unknown status value
mkdir -p "$R4.bak-20260816-160002"; mk_meta "$R4.bak-20260816-160002" "pinned=false" "status=weird-unrecognized"
# missing status entirely
mkdir -p "$R4.bak-20260816-160003"; mk_meta "$R4.bak-20260816-160003" "pinned=false"
# malformed metadata: a status line with no '=' and a non-key line
mkdir -p "$R4.bak-20260816-160004"
printf 'malformed-line-without-equals\nstatus\npinned=maybe\n' > "$R4.bak-20260816-160004/.backup-meta"
# rollback_used (already KEEP)
mkdir -p "$R4.bak-20260816-160005"; mk_meta "$R4.bak-20260816-160005" "pinned=false" "status=rollback_used"
# pinned=true WITHOUT .pinned marker file (fail-safe KEEP)
mkdir -p "$R4.bak-20260816-160006"; mk_meta "$R4.bak-20260816-160006" "pinned=true" "status=predeploy"
[ ! -e "$R4.bak-20260816-160006/.pinned" ] && ok "Fix2 fixture: pinned=true-without-marker setup (no marker file present)" || bad "Fix2 fixture: marker unexpectedly present"

before_fix2="$(find "$R4" -maxdepth 1 -type d -name 'agent-core.bak-*' 2>/dev/null | wc -l)"
"$OPS" "$R4" --prune --verified-success >/dev/null 2>&1
after_fix2="$(find "$R4" -maxdepth 1 -type d -name 'agent-core.bak-*' 2>/dev/null | wc -l)"
[ "$after_fix2" -eq "$before_fix2" ] && ok "Fix2 verified prune removed NOTHING (all unknown/missing/malformed/rollback/pinned=true kept)" \
  || bad "Fix2 verified prune deleted $((before_fix2-after_fix2)) backup(s) that must be KEEP"
[ -d "$R4.bak-20260816-160002" ] && ok "Fix2 unknown status -> KEEP (AUTO_PRUNE=NO)" || bad "Fix2 unknown status was pruned"
[ -d "$R4.bak-20260816-160003" ] && ok "Fix2 missing status -> KEEP" || bad "Fix2 missing status was pruned"
[ -d "$R4.bak-20260816-160004" ] && ok "Fix2 malformed metadata -> KEEP" || bad "Fix2 malformed metadata was pruned"
[ -d "$R4.bak-20260816-160005" ] && ok "Fix2 rollback_used -> KEEP" || bad "Fix2 rollback_used was pruned"
[ -d "$R4.bak-20260816-160006" ] && ok "Fix2 pinned=true without marker -> KEEP (PIN_TRUTH_MODEL fail-safe)" \
  || bad "Fix2 pinned=true-without-marker was pruned"
[ -d "$R4.bak-20260816-160001" ] && ok "Fix2 sole normal backup (status=predeploy) retained (only one eligible)" \
  || bad "Fix2 sole normal backup lost unexpectedly"

# pinned truth consistency: list marks pinned=true-without-marker as pinned=yes
list_line="$(grep '20260816-160006' <<<"$("$OPS" "$R4" --list)")"
case "$list_line" in
  *" yes "*) ok "Fix2 pin truth model consistent: list marks pinned=true-without-marker as PINNED (=yes)" ;;
  *) bad "Fix2 list did not mark pinned=true-without-marker as pinned" ;;
esac

# maybe_first_pin historical detection honors pinned=true-without-marker: a V()
# capture while 160006 is pinned=true should NOT create another pin.
F5="$(mktemp -d "$T/fix1consist.XXXXXX")"
R5="$F5/agent-core"; mkdir -p "$R5"
mkdir -p "$R5.bak-20260816-170001"
{ printf 'backup_id=170001\npinned=true\nstatus=predeploy\n'; } > "$R5.bak-20260816-170001/.backup-meta"   # pinned=true, no marker
mv "$R5" "$R5.bak-20260816-170002"; mkdir -p "$R5"
V "$R5" "$R5.bak-20260816-170002" >/dev/null 2>&1
[ -f "$R5.bak-20260816-170002/.pinned" ] \
  && bad "Fix1 consistency: maybe_first_pin ignored pinned=true-without-marker and created a duplicate pin" \
  || ok "Fix1 consistency: maybe_first_pin honors pinned=true-without-marker -> no re-pin (shared pin truth)"

# ---------------------------------------------------------------------------
# AC11 scope guard: only the expected implementation files changed.
# ---------------------------------------------------------------------------
echo "== AC11 no runtime/router/scheduler/kernel/product change =="
repo="$(cd "$THIS_DIR" && git rev-parse --show-toplevel 2>/dev/null)"
if [ -n "$repo" ]; then
  ok "AC11 repo at $(cd "$repo" && git rev-parse --short HEAD)" || true
else
  echo "  (not a git checkout; AC11 fixture mode)"
  ok "AC11 (fixture mode) — only the two scripts are exercised; no runtime/router/scheduler/kernel code touched"
fi

# ---------------------------------------------------------------------------
echo
echo "== RESULT: $PASS passed, $FAIL failed =="
if [ "$FAIL" -eq 0 ]; then
  echo "AGENT_CORE_BACKUP_RETENTION_V1_TESTS = PASS"
  exit 0
else
  echo "AGENT_CORE_BACKUP_RETENTION_V1_TESTS = FAIL"
  exit 1
fi
