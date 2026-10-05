#!/bin/bash
# =============================================================================
# test-agent-core-deploy-disk-budget-v1.sh — W0 RELEASE-SAFETY (Product #430)
#
# Temp-filesystem fixture tests for the DEPLOY ADMISSION GATE:
#   hard disk-budget + full-tree retention cap enforced BEFORE the trusted-cp
#   deploy's first production mutation (the section-1 full-root preimage mv).
#
# Reuses ONLY the existing AGENT_CORE_BACKUP_RETENTION_V1 shell/filesystem
# helper (agent-core-backup-ops.sh) — no new service/daemon/DB/platform.
# NEVER touches the real /usr/local/libexec/agent-core, its backups, or any
# live install. All sizes are simulated with APFS sparse files (mkfile -n:
# logical size without physical allocation), and floor/class thresholds are
# overridden through the documented env seams; defaults are pinned by static
# assertions instead of by allocating real disk.
#
# Frozen gate semantics under test:
#   BUDGET_FLOOR        = FIXED 50 GiB (53687091200) after worst-case
#                         reservation — Data-volume size does NOT change the
#                         floor (Owner policy 2026-10-02; supersedes the
#                         earlier max(60 GiB, 10% Data volume) rule; the only
#                         floor env seam is AGENT_CORE_BUDGET_FLOOR_MIN_BYTES)
#   SIZE_CLASS          = 20 GiB (backups at/above this class count for the cap)
#   ALLOCATION MODEL    = worst-case physical (logical byte sum); clone/sparse
#                         discounts NOT taken (CLONE_PROOF = NONE)
#   RETENTION CAP       = live + max 1 pinned known-good + max 1 newest
#                         immediate-rollback preimage; creating the third
#                         20+GiB backup is REFUSED unless the superseded
#                         unpinned ones were cleaned by EXACT path (operator,
#                         helper refuses pinned/legacy/rollback_used) or an
#                         explicit open-Product pin exception is asserted
#   REFUSAL             = fail-closed BEFORE any mutation; receipt always
#                         written; deploy prints MUTATION TRUTH and exits
#   RECEIPT             = JSON with DISK_FREE_BEFORE / LIVE_TREE_BYTES /
#                         ESTIMATED_PEAK_BYTES / DISK_FREE_AFTER_RESERVATION /
#                         retained backups before+after / pin reasons
#
# Usage: ./scripts/test-agent-core-deploy-disk-budget-v1.sh
# =============================================================================
set -uo pipefail

THIS_DIR="$(cd "$(dirname "$0")" && pwd)"
OPS="$THIS_DIR/agent-core-backup-ops.sh"
DEPLOY="$THIS_DIR/trusted-cp-deploy-install.sh"

PASS=0; FAIL=0
ok()   { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL: $1" >&2; FAIL=$((FAIL+1)); }

T="$(mktemp -d /tmp/disk-budget-test.XXXXXX)"
A9_MNT=""
trap 'hdiutil detach "$A9_MNT" -quiet >/dev/null 2>&1; rm -rf "$T"' EXIT
LX="$T/liblx"
ROOT="$LX/agent-core"
RECEIPT="$LX/agent-core-deploy-budget-receipt.json"

# JSON reader (macOS python3)
jq_get() { python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d.get(sys.argv[2],"__MISSING__"))' "$1" "$2" 2>/dev/null; }

# low-floor seams so ADMIT paths never depend on the host's real free disk.
# (The volume-percent seam is gone: the floor is FIXED and volume-independent.)
SEAM_ADMIT=(AGENT_CORE_BUDGET_FLOOR_MIN_BYTES=1048576)

GiB=1073741824
vol_free_now() { df -kP "$1" | awk 'NR==2{printf "%.0f", $4*1024}'; }
# build ROOT so that projected free_after lands ~target bytes: the sparse file
# is sized from a LIVE measurement (calibration receipt overhead + current df),
# so refusal/admit margins stay ~1 GiB wide — real df drift cannot flip them.
build_fixture_for_free_after() { # $1 = target free_after bytes
  new_live_tree
  env AGENT_CORE_BUDGET_FLOOR_MIN_BYTES=1 "$OPS" "$ROOT" \
    --check-budget "$ROOT.bak-20991231-235940" >/dev/null 2>&1
  local overhead target
  overhead="$(jq_get "$RECEIPT" LIVE_TREE_BYTES)"
  target=$(( $(vol_free_now "$LX") - $1 - overhead ))
  [ "$target" -lt 0 ] && target=0
  rm -f "$ROOT/app/sparse.bin"
  [ "$target" -gt 0 ] && mkfile -n "$target" "$ROOT/app/sparse.bin"
}

echo "== fixture: $T =="
echo "== helper present + syntax =="
[ -x "$OPS" ] && ok "helper $OPS exists and is executable" || bad "helper missing"
bash -n "$OPS" && ok "helper shell-syntax valid" || bad "helper syntax error"
bash -n "$DEPLOY" && ok "deploy script shell-syntax valid" || bad "deploy syntax error"

# ---------------------------------------------------------------------------
# static: frozen defaults + new commands exist in the helper source
# ---------------------------------------------------------------------------
echo "== static: frozen defaults (no env) in helper source =="
grep -q 'BUDGET_FLOOR_MIN_BYTES_DEFAULT=53687091200' "$OPS" \
  && ok "floor default FIXED 50 GiB (53687091200) frozen in source" \
  || bad "floor default FIXED 50 GiB (53687091200) not found in helper source"
grep -q 'BUDGET_FLOOR_VOLUME_PERCENT' "$OPS" \
  && bad "superseded volume-percent floor term STILL PRESENT in helper source (floor must be volume-independent)" \
  || ok "superseded volume-percent floor term absent from helper (Data-volume size cannot change the floor)"
grep -q 'BUDGET_LARGE_CLASS_BYTES_DEFAULT=21474836480' "$OPS" \
  && ok "large-backup class default 20 GiB (21474836480) frozen in source" \
  || bad "large-backup class default 20 GiB not found"
grep -q 'worst-case' "$OPS" \
  && ok "worst-case allocation model documented in helper" \
  || bad "worst-case allocation model not documented in helper"

# ---------------------------------------------------------------------------
# fixture helpers
# ---------------------------------------------------------------------------
new_live_tree() { # $1 = logical bytes for one sparse file
  rm -rf "$ROOT"; mkdir -p "$ROOT/config" "$ROOT/app"
  echo sentinel > "$ROOT/.installed"
  echo '{}' > "$ROOT/config/agents.json"
  [ -n "${1:-}" ] && mkfile -n "$1" "$ROOT/app/sparse.bin"
}

seed_backup() { # $1 id  $2 pinned=yes|no  $3 meta: predeploy|rollback_used|legacy  $4 logical size (sparse)  -> prints path
  local id="$1" pin="$2" kind="$3" size="$4"
  local p="$ROOT.bak-$id"
  mkdir -p "$p"
  [ -n "$size" ] && mkfile -n "$size" "$p/sparse.bin"
  echo old > "$p/.installed"
  if [ "$kind" != "legacy" ]; then
    {
      printf 'backup_id=%s\ncreated_at=2026-10-02T00:00:00+08:00\n' "$id"
      printf 'source_commit=unknown\nharness_commit=unknown\n'
      printf 'pinned=%s\nstatus=%s\n' "$pin" "$kind"
    } > "$p/.backup-meta"
  fi
  if [ "$pin" = "yes" ]; then touch "$p/.pinned"; fi
  printf '%s' "$p"
}

# ===========================================================================
echo "== G1: --check-budget exists and writes the required receipt =="
new_live_tree
out="$(env "${SEAM_ADMIT[@]}" "$OPS" "$ROOT" --check-budget "$ROOT.bak-20991231-235959" 2>&1)"; rc=$?
if [ "$rc" -eq 0 ]; then ok "G1 --check-budget ADMIT exit 0"; else bad "G1 --check-budget failed rc=$rc: $out"; fi
[ -f "$RECEIPT" ] && ok "G1 receipt written at $RECEIPT" || bad "G1 receipt missing"
for key in DISK_FREE_BEFORE LIVE_TREE_BYTES ESTIMATED_PEAK_BYTES DISK_FREE_AFTER_RESERVATION; do
  v="$(jq_get "$RECEIPT" "$key")"
  [ "$v" != "__MISSING__" ] && [ -n "$v" ] \
    && ok "G1 receipt field $key present ($v)" \
    || bad "G1 receipt field $key missing/empty"
done
python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$RECEIPT" 2>/dev/null \
  && ok "G1 receipt is valid JSON" || bad "G1 receipt is not valid JSON"
[ -e "$ROOT.bak-20991231-235959" ] \
  && bad "G1 gate CREATED the projected backup (gate must be read-only)" \
  || ok "G1 gate is read-only: projected backup NOT created by the gate"

echo "== G1b: retained backups before/after + pin reasons fields =="
python3 - "$RECEIPT" <<'PY' && ok "G1b retained before/after + pin_reasons structured" || bad "G1b retained/pin_reason fields malformed"
import json,sys
d=json.load(open(sys.argv[1]))
assert "retained_backups_before" in d and "retained_backups_after_projected" in d, d.keys()
assert "pin_reasons" in d, d.keys()
assert isinstance(d["retained_backups_before"], list)
assert isinstance(d["retained_backups_after_projected"], list)
assert isinstance(d["pin_reasons"], list)
assert len(d["retained_backups_after_projected"]) == len(d["retained_backups_before"]) + 1
PY

# ===========================================================================
echo "== G2: FIXED 50 GiB floor — 49 GiB projected free refuses (default env) =="
build_fixture_for_free_after $(( 49 * GiB ))
out="$("$OPS" "$ROOT" --check-budget "$ROOT.bak-20991231-235958" 2>&1)"; rc=$?
[ "$rc" -ne 0 ] && ok "G2 49GiB-projected-free -> refusal rc=$rc (default floor, no env)" || bad "G2 expected refusal, got exit 0"
v="$(jq_get "$RECEIPT" verdict)"; [ "$v" = "REFUSED_DISK_BUDGET" ] \
  && ok "G2 verdict REFUSED_DISK_BUDGET" || bad "G2 verdict=$v (expected REFUSED_DISK_BUDGET)"
[ -e "$ROOT.bak-20991231-235958" ] \
  && bad "G2 refusal happened AFTER mutation (backup exists)" \
  || ok "G2 refusal BEFORE any mutation (no backup created; live tree intact)"
[ -f "$ROOT/.installed" ] && ok "G2 live tree untouched on refusal" || bad "G2 live tree disturbed"
python3 - "$RECEIPT" <<'PY' && ok "G2 receipt: floor==50GiB, free_after<50GiB near 49GiB target, arithmetic consistent" || bad "G2 receipt arithmetic/floor wrong"
import json,sys
d=json.load(open(sys.argv[1]))
assert d["DISK_BUDGET_FLOOR_BYTES"] == 53687091200, d["DISK_BUDGET_FLOOR_BYTES"]
assert d["DATA_VOLUME_TOTAL_BYTES"] > 0, d  # volume still RECORDED, but not part of the floor
assert d["DISK_FREE_AFTER_RESERVATION"] == d["DISK_FREE_BEFORE"] - d["LIVE_TREE_BYTES"], d
assert d["DISK_FREE_AFTER_RESERVATION"] < d["DISK_BUDGET_FLOOR_BYTES"], d
assert abs(d["DISK_FREE_AFTER_RESERVATION"] - 49*2**30) < 2*2**30, d  # fixture landed near the 49GiB target
PY

echo "== G2a: >50 GiB projected free admits at the default floor (volume-independent) =="
build_fixture_for_free_after $(( 51 * GiB ))
out="$("$OPS" "$ROOT" --check-budget "$ROOT.bak-20991231-235957" 2>&1)"; rc=$?
[ "$rc" -eq 0 ] && ok "G2a 51GiB-projected-free -> ADMITTED (default floor, no env)" || bad "G2a expected admit, rc=$rc: $out"
python3 - "$RECEIPT" <<'PY' && ok "G2a receipt: floor==50GiB, free_after>50GiB near 51GiB target" || bad "G2a receipt wrong"
import json,sys
d=json.load(open(sys.argv[1]))
assert d["verdict"] == "ADMITTED", d["verdict"]
assert d["DISK_BUDGET_FLOOR_BYTES"] == 53687091200, d["DISK_BUDGET_FLOOR_BYTES"]
assert d["DISK_FREE_AFTER_RESERVATION"] > d["DISK_BUDGET_FLOOR_BYTES"], d
assert abs(d["DISK_FREE_AFTER_RESERVATION"] - 51*2**30) < 2*2**30, d
PY

echo "== G2b: floor is the FIXED term — boundary equality admits; only the MIN seam moves it =="
# Boundary (free_after == floor) on an ISOLATED fixed-size sparse image: a
# freshly mounted volume has no background writers, so the two df instants
# (seam computation vs the gate's own read) cannot drift apart. On the shared
# Data volume that race flipped a true equality into a refusal.
IMG="$T/a9floor.dmg"; A9_MNT="$T/a9floor-mnt"
IROOT="$A9_MNT/agent-core"; IRECEIPT="$A9_MNT/agent-core-deploy-budget-receipt.json"
if hdiutil create -size 2g -fs JHFS+ -type SPARSE -volname a9floor "$IMG" -quiet >/dev/null 2>&1 \
   && mkdir -p "$A9_MNT" "$IROOT/config" "$IROOT/app" \
   && hdiutil attach -nobrowse -mountpoint "$A9_MNT" "$IMG.sparseimage" -quiet >/dev/null 2>&1; then
  echo boundary > "$IROOT/.installed"; echo '{}' > "$IROOT/config/agents.json"
  mkfile -n 268435456 "$IROOT/app/sparse.bin"
  # calibration: L := gate-measured live tree bytes (floor=1 seam -> ADMIT)
  env AGENT_CORE_BUDGET_FLOOR_MIN_BYTES=1 "$OPS" "$IROOT" --check-budget NONE >/dev/null 2>&1
  L="$(jq_get "$IRECEIPT" LIVE_TREE_BYTES)"
  # floor := EXACTLY the projected free of the isolated volume. The gate's own
  # df runs BEFORE any receipt write inside a run, so this equality holds at
  # the boundary run's df instant on a quiescent volume.
  FLOOR_SEAM=$(( $(df -kP "$A9_MNT" | awk 'NR==2{printf "%.0f", $4*1024}') - L ))
  out="$(env AGENT_CORE_BUDGET_FLOOR_MIN_BYTES="$FLOOR_SEAM" "$OPS" "$IROOT" --check-budget NONE 2>&1)"; rc=$?
  [ "$rc" -eq 0 ] && ok "G2b free_after == floor -> ADMITTED (>= boundary)" || bad "G2b boundary equality refused rc=$rc: $out"
  python3 - "$IRECEIPT" "$FLOOR_SEAM" <<'PY' && ok "G2b receipt: floor == free_after at the equality boundary, verdict ADMITTED" || bad "G2b receipt boundary mismatch"
import json,sys
d=json.load(open(sys.argv[1]))
assert d["verdict"] == "ADMITTED", d["verdict"]
assert d["DISK_BUDGET_FLOOR_BYTES"] == int(sys.argv[2]), (d["DISK_BUDGET_FLOOR_BYTES"], sys.argv[2])
assert d["DISK_FREE_AFTER_RESERVATION"] == d["DISK_BUDGET_FLOOR_BYTES"], d
PY
  hdiutil detach "$A9_MNT" -quiet >/dev/null 2>&1; A9_MNT=""
else
  bad "G2b boundary fixture (sparse image) unavailable — the equality boundary is unproven"
fi
# the only floor input is the MIN seam (no max() of a volume term anymore)
env AGENT_CORE_BUDGET_FLOOR_MIN_BYTES=999999999999 "$OPS" "$ROOT" --check-budget "$ROOT.bak-20991231-235955" >/dev/null 2>&1
f="$(jq_get "$RECEIPT" DISK_BUDGET_FLOOR_BYTES)"
[ "$f" = "999999999999" ] && ok "G2b floor == MIN seam verbatim (fixed-floor semantics)" \
  || bad "G2b floor=$f expected 999999999999"

echo "== G2c: the disk-budget floor is HARD — pin exception does NOT override it =="
out="$(env AGENT_CORE_BUDGET_FLOOR_MIN_BYTES=999999999999 "$OPS" "$ROOT" --check-budget "$ROOT.bak-20991231-235950" --pin-exception "Product #430 open pin: floor exception attempted" 2>&1)"; rc=$?
[ "$rc" -ne 0 ] && ok "G2c floor violation refuses even WITH pin exception" || bad "G2c pin exception overrode the HARD floor"
[ "$(jq_get "$RECEIPT" verdict)" = "REFUSED_DISK_BUDGET" ] \
  && ok "G2c verdict stays REFUSED_DISK_BUDGET" \
  || bad "G2c verdict=$(jq_get "$RECEIPT" verdict)"

echo "== G2d: hostile pin-exception text cannot corrupt the receipt JSON =="
new_live_tree
out="$(env "${SEAM_ADMIT[@]}" "$OPS" "$ROOT" --check-budget "$ROOT.bak-20991231-235949" \
  --pin-exception 'Product "quote" \backslash both' 2>&1)"; rc=$?
python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$RECEIPT" 2>/dev/null \
  && ok "G2d receipt stays valid JSON with quotes+backslash in reason" \
  || bad "G2d receipt corrupted by hostile reason text"
# multi-line reason THROUGH the real carrier (the helper's --pin-exception
# single-arg contract, which is how the deploy forwards the env seam): the
# receipt must stay valid JSON with the raw LF deleted, never emitted raw
MULTILINE_REASON="$(printf 'multi\nline \"reason\" with \backslash')"
out="$(env "${SEAM_ADMIT[@]}" "$OPS" "$ROOT" --check-budget "$ROOT.bak-20991231-235948" --pin-exception "$MULTILINE_REASON" 2>&1)"
python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$RECEIPT" 2>/dev/null \
  && ok "G2d receipt stays valid JSON after multi-line reason (real CLI carrier)" \
  || bad "G2d receipt corrupted by multi-line reason"

echo "== G2e: stricter parse — flag-like projected path is a usage error =="
env "${SEAM_ADMIT[@]}" "$OPS" "$ROOT" --check-budget --pin-exception x >/dev/null 2>&1; rc=$?
[ "$rc" -eq 2 ] && ok "G2e flag-like projected path -> usage error rc=2" || bad "G2e rc=$rc (expected 2)"

# ===========================================================================
echo "== G3: worst-case physical allocation (logical bytes; no clone/sparse discount) =="
# 50MiB SPARSE file: physical ~0, logical 50MiB. live_tree_bytes must reflect
# the logical worst case (what a fresh physical copy would need).
new_live_tree 50m
env "${SEAM_ADMIT[@]}" AGENT_CORE_BUDGET_LARGE_CLASS_BYTES=1048576 \
  "$OPS" "$ROOT" --check-budget "$ROOT.bak-20991231-235955" >/dev/null 2>&1
lv="$(jq_get "$RECEIPT" LIVE_TREE_BYTES)"
physical="$(du -sk "$ROOT" | awk '{print $1*1024}')"
if [ "$lv" -ge 52428800 ]; then ok "G3 LIVE_TREE_BYTES=$lv >= 50MiB logical (sparse discount NOT taken)"; else bad "G3 LIVE_TREE_BYTES=$lv took sparse/clone discount (< 50MiB)"; fi
[ "$lv" -gt "$physical" ] && ok "G3 logical ($lv) > du-physical ($physical): worst-case model confirmed" \
  || bad "G3 logical ($lv) <= du-physical ($physical): not worst-case"
cs="$(jq_get "$RECEIPT" clone_semantics_proof)"
case "$cs" in NONE*) ok "G3 clone_semantics_proof=NONE recorded";; *) bad "G3 clone_semantics_proof='$cs' (must be NONE/worst-case)";; esac

# ===========================================================================
echo "== G4: retention cap — third 20+GiB backup refused =="
new_live_tree 1m   # class override makes every fixture backup "large"
CAPENV=(AGENT_CORE_BUDGET_LARGE_CLASS_BYTES=1048576 "${SEAM_ADMIT[@]}")

# G4a: live only -> first backup admitted (unpinned count goes 0 -> 1)
out="$(env "${CAPENV[@]}" "$OPS" "$ROOT" --check-budget "$ROOT.bak-20991231-100001" 2>&1)"; rc=$?
[ "$rc" -eq 0 ] && ok "G4a first backup admitted" || bad "G4a first backup refused rc=$rc: $out"

# G4b: one pinned large + new backup = 1 pinned + 1 unpinned newest -> admitted
new_live_tree 1m
seed_backup 20991230-000001 yes predeploy 1m >/dev/null
out="$(env "${CAPENV[@]}" "$OPS" "$ROOT" --check-budget "$ROOT.bak-20991231-100002" 2>&1)"; rc=$?
[ "$rc" -eq 0 ] && ok "G4b pinned(1)+newest(1) within cap -> admitted" || bad "G4b refused rc=$rc: $out"
python3 - "$RECEIPT" <<'PY' && ok "G4b pin_reason echoes recorded reason" || bad "G4b pin_reasons wrong"
import json,sys
d=json.load(open(sys.argv[1]))
pins=[p for p in d["pin_reasons"] if p.get("pinned")]
assert len(pins)==1 and pins[0]["reason"], d["pin_reasons"]
PY

# G4c: one UNPINNED large already present -> new backup would be the second
# unpinned (third large overall with the pin in G4d); here bare: 0->? -- one
# existing unpinned + new = 2 unpinned -> refused
new_live_tree 1m
OLD="$(seed_backup 20991230-000002 no predeploy 1m)"
out="$(env "${CAPENV[@]}" "$OPS" "$ROOT" --check-budget "$ROOT.bak-20991231-100003" 2>&1)"; rc=$?
[ "$rc" -ne 0 ] && ok "G4c third-backup creation refused (rc=$rc)" || bad "G4c expected refusal, got exit 0"
v="$(jq_get "$RECEIPT" verdict)"; [ "$v" = "REFUSED_RETENTION_CAP" ] \
  && ok "G4c verdict REFUSED_RETENTION_CAP" || bad "G4c verdict=$v"
[ -e "$OLD" ] && ok "G4c refusal removed nothing" || bad "G4c existing backup deleted by gate!"
guid="$(python3 -c 'import json,sys; print("\n".join(json.load(open(sys.argv[1]))["cleanup_guidance_exact_paths"]))' "$RECEIPT" 2>/dev/null)"
echo "$guid" | grep -q "$OLD" && ok "G4c cleanup guidance names the exact superseded path" \
  || bad "G4c guidance missing exact path: got '$guid'"

# G4d: pinned protected — with 1 pinned + 1 unpinned + new: guidance must name
# ONLY the unpinned one, never the pinned
new_live_tree 1m
PINB="$(seed_backup 20991230-000003 yes predeploy 1m)"
UNPB="$(seed_backup 20991230-000004 no predeploy 1m)"
env "${CAPENV[@]}" "$OPS" "$ROOT" --check-budget "$ROOT.bak-20991231-100004" >/dev/null 2>&1; rc=$?
[ "$rc" -ne 0 ] && ok "G4d over-cap refused with pinned present" || bad "G4d expected refusal"
[ "$(jq_get "$RECEIPT" verdict)" = "REFUSED_RETENTION_CAP" ] \
  && ok "G4d verdict pinned to REFUSED_RETENTION_CAP" \
  || bad "G4d verdict=$(jq_get "$RECEIPT" verdict) (wrong refusal branch)"
guid="$(python3 -c 'import json,sys; print("\n".join(json.load(open(sys.argv[1]))["cleanup_guidance_exact_paths"]))' "$RECEIPT" 2>/dev/null)"
echo "$guid" | grep -q "$UNPB" && ok "G4d guidance names the unpinned backup" || bad "G4d guidance missing unpinned path"
echo "$guid" | grep -q "$PINB" && bad "G4d guidance LEAKED the pinned path" || ok "G4d pinned backup NOT in cleanup guidance (protected)"

# G4e: open-Product pin exception admits the third backup, receipted
out="$(env "${CAPENV[@]}" "$OPS" "$ROOT" --check-budget "$ROOT.bak-20991231-100005" --pin-exception "Product #414 open pin: verified rollback rehearsal needs both" 2>&1)"; rc=$?
[ "$rc" -eq 0 ] && ok "G4e pin exception -> admitted" || bad "G4e pin exception refused rc=$rc: $out"
pe_a="$(jq_get "$RECEIPT" pin_exception_asserted)"; pe_r="$(jq_get "$RECEIPT" pin_exception_reason)"
[ "$pe_a" = "True" ] && ok "G4e receipt records pin_exception_asserted" || bad "G4e pin_exception_asserted=$pe_a"
echo "$pe_r" | grep -q "Product #414" && ok "G4e receipt records the exception reason" || bad "G4e reason not recorded: '$pe_r'"

# G4f: legacy large counted (fail-safe) but never named for helper cleanup
new_live_tree 1m
LEG="$(seed_backup 20991230-000005 no legacy 1m)"
env "${CAPENV[@]}" "$OPS" "$ROOT" --check-budget "$ROOT.bak-20991231-100006" >/dev/null 2>&1; rc=$?
[ "$rc" -ne 0 ] && ok "G4f legacy large counts toward cap (refusal)" || bad "G4f legacy large not counted"
[ "$(jq_get "$RECEIPT" verdict)" = "REFUSED_RETENTION_CAP" ] \
  && ok "G4f verdict pinned to REFUSED_RETENTION_CAP" \
  || bad "G4f verdict=$(jq_get "$RECEIPT" verdict) (wrong refusal branch)"
guid="$(python3 -c 'import json,sys; print("\n".join(json.load(open(sys.argv[1]))["cleanup_guidance_exact_paths"]))' "$RECEIPT" 2>/dev/null)"
echo "$guid" | grep -q "$LEG" && bad "G4f guidance offered a LEGACY path (must stay protected)" || ok "G4f legacy path NOT in cleanup guidance"

# G4g: rollback_used counted, kept, not cleanable
new_live_tree 1m
RU="$(seed_backup 20991230-000006 no rollback_used 1m)"
env "${CAPENV[@]}" "$OPS" "$ROOT" --check-budget "$ROOT.bak-20991231-100007" >/dev/null 2>&1; rc=$?
[ "$rc" -ne 0 ] && ok "G4g rollback_used large counts toward cap" || bad "G4g rollback_used not counted"
[ "$(jq_get "$RECEIPT" verdict)" = "REFUSED_RETENTION_CAP" ] \
  && ok "G4g verdict pinned to REFUSED_RETENTION_CAP" \
  || bad "G4g verdict=$(jq_get "$RECEIPT" verdict) (wrong refusal branch)"
guid="$(python3 -c 'import json,sys; print("\n".join(json.load(open(sys.argv[1]))["cleanup_guidance_exact_paths"]))' "$RECEIPT" 2>/dev/null)"
echo "$guid" | grep -q "$RU" && bad "G4g guidance offered a rollback_used path (KEEP)" || ok "G4g rollback_used NOT in cleanup guidance"

# ===========================================================================
echo "== G5: --cleanup-exact removes EXACTLY the named superseded unpinned backup =="
new_live_tree 1m
A="$(seed_backup 20991230-000010 no predeploy 1m)"
B="$(seed_backup 20991230-000011 no predeploy 1m)"
env "${CAPENV[@]}" "$OPS" "$ROOT" --cleanup-exact "$A" >/dev/null 2>&1; rc=$?
[ "$rc" -eq 0 ] && ok "G5 cleanup-exact exit 0" || bad "G5 cleanup-exact rc=$rc"
[ ! -e "$A" ] && ok "G5 named superseded backup removed" || bad "G5 named backup still present"
[ -e "$B" ] && [ -d "$ROOT" ] && ok "G5 sibling backup + live tree untouched (exact path only)" \
  || bad "G5 collateral damage: sibling/live disturbed"

echo "== G5b: cleanup-exact is idempotent =="
env "${CAPENV[@]}" "$OPS" "$ROOT" --cleanup-exact "$A" >/dev/null 2>&1; rc=$?
[ "$rc" -eq 0 ] && ok "G5b repeated cleanup-exact: NOOP success (rc=0)" || bad "G5b repeated cleanup rc=$rc"

echo "== G5c: cleanup-exact guards =="
new_live_tree 1m
PINB="$(seed_backup 20991230-000020 yes predeploy 1m)"
LEG="$(seed_backup 20991230-000021 no legacy 1m)"
RUB="$(seed_backup 20991230-000022 no rollback_used 1m)"
for t in "pinned:$PINB" "legacy:$LEG" "rollback_used:$RUB"; do
  kind="${t%%:*}"; p="${t#*:}"
  env "${CAPENV[@]}" "$OPS" "$ROOT" --cleanup-exact "$p" >/dev/null 2>&1
  [ -e "$p" ] && ok "G5c $kind backup PROTECTED (refused, intact)" \
    || bad "G5c $kind backup was DELETED"
done
env "${CAPENV[@]}" "$OPS" "$ROOT" --cleanup-exact "$LX/not-a-backup" >/dev/null 2>&1
[ -e "$LX/not-a-backup" ] || mkdir -p "$LX/agent-core.bak-notglob"
env "${CAPENV[@]}" "$OPS" "$ROOT" --cleanup-exact "$LX/agent-core.bak-*" >/dev/null 2>&1; rc=$?
[ "$rc" -ne 0 ] && ok "G5c wildcard path refused (no wildcard cleanup)" \
  || bad "G5c wildcard path accepted!"
[ -d "$LX/agent-core.bak-notglob" ] \
  && ok "G5c wildcard-lookalike sibling SURVIVED the refused cleanup" \
  || bad "G5c glob-happy cleanup deleted the wildcard-lookalike sibling"

# ===========================================================================
echo "== G6: idempotent repeated gate attempts =="
new_live_tree 1m
r1="$(env "${CAPENV[@]}" "$OPS" "$ROOT" --check-budget "$ROOT.bak-20991231-100010" 2>&1)"; rc1=$?
v1="$(jq_get "$RECEIPT" verdict)"; lv1="$(jq_get "$RECEIPT" LIVE_TREE_BYTES)"
r2="$(env "${CAPENV[@]}" "$OPS" "$ROOT" --check-budget "$ROOT.bak-20991231-100010" 2>&1)"; rc2=$?
v2="$(jq_get "$RECEIPT" verdict)"; lv2="$(jq_get "$RECEIPT" LIVE_TREE_BYTES)"
[ "$rc1" = "$rc2" ] && [ "$v1" = "$v2" ] && [ "$lv1" = "$lv2" ] \
  && ok "G6 repeated attempts: same verdict + same measurements ($v1)" \
  || bad "G6 repeated attempts diverge: rc $rc1/$rc2 v $v1/$v2 lv $lv1/$lv2"
a1="$(jq_get "$RECEIPT" attempt_id)"
r3="$(env "${CAPENV[@]}" "$OPS" "$ROOT" --check-budget "$ROOT.bak-20991231-100010" 2>&1)"
a2="$(jq_get "$RECEIPT" attempt_id)"
[ -n "$a1" ] && [ -n "$a2" ] && [ "$a1" != "$a2" ] \
  && ok "G6 receipt carries per-attempt id (latest-wins receipt)" \
  || bad "G6 attempt_id missing or static ('$a1' vs '$a2')"

# ===========================================================================
echo "== G7: deploy integration (static, fail-closed before the mv) =="
LINE_BUDGET="$(grep -n '\-\-check-budget' "$DEPLOY" | head -1 | cut -d: -f1)"
LINE_MV="$(grep -n 'mv "$TRUSTED_ROOT" "$BAK"' "$DEPLOY" | head -1 | cut -d: -f1)"
if [ -n "$LINE_BUDGET" ] && [ -n "$LINE_MV" ] && [ "$LINE_BUDGET" -lt "$LINE_MV" ]; then
  ok "G7 --check-budget (line $LINE_BUDGET) precedes the section-1 mv (line $LINE_MV)"
else
  bad "G7 gate/mv ordering wrong (budget='$LINE_BUDGET' mv='$LINE_MV')"
fi
grep -q '"\$BACKUP_OPS" "\$TRUSTED_ROOT" --check-budget' "$DEPLOY" \
  && ok "G7 gate is anchored on ROOT=\$TRUSTED_ROOT (census/receipt correct in the real layout)" \
  || bad "G7 gate root argument is not \$TRUSTED_ROOT (B1-class regression)"
grep -q '"\$BACKUP_OPS" "\$TRUSTED_ROOT" --write-predecessor' "$DEPLOY" \
  && ok "G7 --write-predecessor anchored on the same ROOT (FIRST_RELIABLE_PIN census correct)" \
  || bad "G7 --write-predecessor root argument drifted from \$TRUSTED_ROOT"
grep -q 'MUTATION TRUTH: NOTHING was mutated' "$DEPLOY" \
  && ok "G7 deploy refusal carries the MUTATION TRUTH line" \
  || bad "G7 MUTATION TRUTH refusal line missing"
grep -q 'agent-core-deploy-budget-receipt.json' "$DEPLOY" \
  && ok "G7 deploy names the receipt path on refusal" \
  || bad "G7 deploy does not name the receipt path"
grep -n 'backup-ops helper missing' "$DEPLOY" | grep -q 'refus' \
  && ok "G7 helper-missing is FAIL-CLOSED (refuses, not warn-and-continue)" \
  || bad "G7 helper-missing still warn-and-continue (must refuse)"
grep -q 'AGENT_CORE_BUDGET_PIN_EXCEPTION' "$DEPLOY" \
  && ok "G7 deploy propagates the open-Product pin-exception seam" \
  || bad "G7 deploy does not propagate the pin-exception seam"

# ===========================================================================
echo "== G8: pin_reason metadata (receipt + meta, additive) =="
# fresh fixture: FIRST_RELIABLE_PIN requires NO pre-existing reliable pin, and
# the fresh-install assertion needs an empty census — isolate from G4's seeds.
LX2="$T/liblx-g8"
ROOT2="$LX2/agent-core"
RECEIPT2="$LX2/agent-core-deploy-budget-receipt.json"
rm -rf "$LX2"; mkdir -p "$LX2"
new_live_tree
mv "$ROOT" "$ROOT2.bak-20991231-110001"; mkdir -p "$ROOT"
AGENT_CORE_VERIFIED_PREDECESSOR_LKG=YES "$OPS" "$ROOT2" --write-predecessor "$ROOT2.bak-20991231-110001" >/dev/null 2>&1
grep -q '^pin_reason=' "$ROOT2.bak-20991231-110001/.backup-meta" \
  && ok "G8 FIRST_RELIABLE_PIN records pin_reason in .backup-meta" \
  || bad "G8 pin_reason missing for FIRST_RELIABLE_PIN"
env "${SEAM_ADMIT[@]}" "$OPS" "$ROOT2" --check-budget "$ROOT2.bak-20991231-110002" >/dev/null 2>&1
python3 - "$RECEIPT2" <<'PY' && ok "G8 receipt pin_reasons carries the recorded reason" || bad "G8 receipt pin_reason lacks recorded text"
import json,sys
d=json.load(open(sys.argv[1]))
pins=[p for p in d["pin_reasons"] if p.get("pinned")]
assert pins and "AGENT_CORE_VERIFIED_PREDECESSOR_LKG" in (pins[0]["reason"] or ""), d["pin_reasons"]
PY
rm -rf "$LX2"; mkdir -p "$LX2"
new_live_tree
mv "$ROOT" "$ROOT2.bak-20991231-110003"; mkdir -p "$ROOT"
"$OPS" "$ROOT2" --pin 20991231-110003 operator rehearsal pin >/dev/null 2>&1
grep -q '^pin_reason=operator rehearsal pin$' "$ROOT2.bak-20991231-110003/.backup-meta" \
  && ok "G8 --pin records the operator reason verbatim" \
  || bad "G8 --pin reason not recorded verbatim"

# ===========================================================================
echo "== G9: fresh install path (no live root, no backup) =="
LX3="$T/liblx-g9"
ROOT3="$LX3/agent-core"
RECEIPT3="$LX3/agent-core-deploy-budget-receipt.json"
rm -rf "$LX3"; mkdir -p "$LX3"
out="$(env "${SEAM_ADMIT[@]}" "$OPS" "$ROOT3" --check-budget NONE 2>&1)"; rc=$?
[ "$rc" -eq 0 ] && ok "G9 fresh install (projected=NONE) admitted under floor" || bad "G9 fresh install refused rc=$rc: $out"
python3 - "$RECEIPT3" <<'PY' && ok "G9 fresh-install receipt: no retention delta, no live tree" || bad "G9 fresh-install receipt inconsistent"
import json,sys
d=json.load(open(sys.argv[1]))
assert d["LIVE_TREE_BYTES"] == 0, d["LIVE_TREE_BYTES"]
assert len(d["retained_backups_after_projected"]) == len(d["retained_backups_before"]) == 0, d
PY
env AGENT_CORE_BUDGET_FLOOR_MIN_BYTES=999999999999 "$OPS" "$ROOT3" --check-budget NONE >/dev/null 2>&1; rc=$?
[ "$rc" -ne 0 ] && ok "G9 fresh install also floor-guarded (refusal)" || bad "G9 fresh install bypassed the floor"

# ===========================================================================
echo
echo "== RESULTS: PASS=$PASS FAIL=$FAIL =="
[ "$FAIL" -eq 0 ] || { echo "SUITE FAILED" >&2; exit 1; }
echo "SUITE PASSED"
