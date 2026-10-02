#!/bin/bash
# =============================================================================
# agent-core-backup-ops.sh — deployment backup metadata + pin + retention ops
#
# AGENT_CORE_BACKUP_RETENTION_V1 (accepted Spec). Shell/filesystem ONLY — no
# package, DB, service, daemon, dashboard, or rollback-framework rewrite.
#
# The deploy script (trusted-cp-deploy-install.sh) calls this for the predeploy
# backup metadata + first-reliable-pin. Operators call this out-of-band for
# pin/unpin/list and for the POST-VERIFIED-SUCCESS normal retention prune.
#
# Frozen semantics (Spec §Frozen semantics):
#   NORMAL_RETENTION = 3 · PINNED_MINIMUM = 1
#   PIN      = metadata / marker only  (PIN_DATA_COPY = NO)
#   pinned   = NOT counted in normal 3, NEVER auto-pruned
#   FAILED_DEPLOYMENT_PRUNE             = NO
#   FAILED_HEALTH_VERIFICATION_PRUNE    = NO
#   VERIFIED_SUCCESS_PRUNE              = NORMAL_ONLY
#   USED_ROLLBACK_BACKUP                = KEEP
#   PRUNE_FAILURE                       = loud warning; healthy deploy stays successful
#
# Metadata describes the BACKED-UP previous installed closure (never the
# successor deploy). If the previous app commit is not reliably obtainable,
# source_commit = unknown (do NOT guess / do NOT record the new deploy's HEAD).
#
# LKG authority (Fix): this helper does NOT verify or infer last-known-good. It
# must NOT derive "known-good" from no-pin / mtime / newest / "current install".
# FIRST_RELIABLE_PIN is set ONLY when BOTH:
#   (a) no existing reliable pin exists, AND
#   (b) a trusted operator explicitly asserts the predecessor is the verified
#       LKG via AGENT_CORE_VERIFIED_PREDECESSOR_LKG=YES (the env seam propagates
#       from the deploy invocation to this helper).
# Without the assertion -> the predeploy backup is created normally, auto-pin = NO.
#   LKG verification authority = external acceptance / trusted operator.
#   FIRST_PIN_REQUIRES_PROVEN_LKG = YES · LKG_AUTHORITY = TRUSTED_OPERATOR_ASSERTION
#   MACHINE_LKG_DETECTION = NO
#
# Fail-safe metadata handling (Fix): uncertainty -> KEEP. In --prune, ONLY a
# backup whose .backup-meta status reads EXACTLY the managed-normal value
# 'predeploy' is eligible for normal retention. rollback_used -> KEEP. status
# missing / malformed / unreadable / unknown -> KEEP (never treated as normal).
# Pinned truth is the UNION of the .pinned marker OR pinned=true in meta, so a
# pinned=true meta with a missing marker is STILL KEPT (never pruned).
#
# Legacy backups (agent-core.bak-* WITHOUT a .backup-meta) are NEVER touched by
# the prune here: AUTO_PRUNE_LEGACY_BEFORE_FIRST_PIN = NO, and any later legacy
# cleanup is a separate operator task, not this prune.
#
# Layout: backups are <ROOT>.bak-<YYYYMMDD-HHMMSS> siblings of the install
# <ROOT>. name order == chronological order (lexicographically sortable).
#
# Usage:
#   agent-core-backup-ops.sh <ROOT> <command> [args...]
#   commands:
#     --list                       list backups with id / pinned / status / size
#     --write-predecessor <backup> write .backup-meta for a just-captured predeploy
#                                  backup. FIRST_RELIABLE_PIN is set only when a
#                                  prior reliable pin is absent AND the trusted
#                                  operator asserts LKG via the env seam
#                                  AGENT_CORE_VERIFIED_PREDECESSOR_LKG=YES.
#     --pin <id> [reason...]       pin a backup (marker + meta, no data copy);
#                                  the optional reason words are recorded as
#                                  pin_reason metadata (surfaced by --check-budget
#                                  receipts as pin reasons)
#     --unpin <id>                 clear a pin
#     --mark-rollback-used <id>    mark a backup as used for a rollback (KEEP)
#     --prune --verified-success   post-verified-success NORMAL retention: keep
#                                  newest 3 eligible NORMAL backups (status
#                                  exactly 'predeploy'); pinned (marker or meta),
#                                  rollback-used, legacy, and unknown/absent-status
#                                  backups are never pruned (uncertain -> KEEP).
#                                  Refuses to prune without --verified-success.
#                                  PRUNE_SUCCESS_AUTHORITY=TRUSTED_OPERATOR_ASSERTION
#                                  MACHINE_ENFORCED_VERIFICATION=NO.
#
# W0 RELEASE-SAFETY deploy admission gate (Product #430; additive, no accepted
# spec modified — AGENT_CORE_BACKUP_RETENTION_V1 frozen semantics above stay
# byte-identical: prune remains post-verified-success-only, pinned/legacy/
# rollback_used/unknown stay KEEP, pin stays metadata/marker only):
#     --check-budget <projected-new-backup-path|NONE> [--pin-exception <reason>]
#                              READ-ONLY admission gate the deploy runs BEFORE
#                              its first production mutation (the full-root
#                              preimage mv). Computes the disk budget and the
#                              full-tree retention cap, writes the JSON receipt
#                              <parent>/agent-core-deploy-budget-receipt.json
#                              (latest attempt wins; attempt_id per run), and
#                              exits 0 ADMIT / 4 REFUSED_DISK_BUDGET /
#                              5 REFUSED_RETENTION_CAP. Never creates, deletes,
#                              or renames any backup or tree.
#       BUDGET_FLOOR            = FIXED 50 GiB (53687091200) after worst-case
#                                 reservation  [Owner policy 2026-10-02; the
#                                 earlier max(60 GiB, 10% of the Data volume)
#                                 rule is SUPERSEDED — the floor no longer
#                                 depends on Data-volume size; env seam
#                                 AGENT_CORE_BUDGET_FLOOR_MIN_BYTES is
#                                 recorded in the receipt when overridden]
#       ALLOCATION MODEL        = worst-case physical: logical byte sums; NO
#                                 clone/sparse/compression discount (CLONE_PROOF
#                                 = NONE — no clone semantics are mechanically
#                                 proven, so none are assumed)
#       FULL-TREE RETENTION CAP = live + max ONE pinned known-good + max ONE
#                                 newest immediate-rollback preimage, counted
#                                 over backups at/above the size class
#                                 (default 20 GiB,
#                                 AGENT_CORE_BUDGET_LARGE_CLASS_BYTES seam).
#                                 Creating the THIRD >=class backup is refused
#                                 unless the superseded unpinned ones were
#                                 cleaned first (exact paths, next command) or
#                                 an open-Product pin exception is asserted via
#                                 --pin-exception (receipt records it).
#     --cleanup-exact <backup-path>
#                              operator exact-path cleanup of ONE superseded
#                              unpinned managed-normal backup (the cap's escape
#                              hatch). Refuses: paths outside <ROOT>.bak-<id>,
#                              glob characters, dirs without .backup-meta
#                              (legacy — AUTO_PRUNE_LEGACY=NO), status other
#                              than exactly 'predeploy' (rollback_used/unknown
#                              -> KEEP), and reliably-pinned backups (union
#                              truth). Re-cleaning an absent path is an
#                              idempotent NOOP success. Writes
#                              <parent>/agent-core-cleanup-exact-receipt.json.
#                              NO wildcards, ever.
# =============================================================================
set -uo pipefail

NORMAL_RETENTION=3

# W0 RELEASE-SAFETY (Product #430) frozen defaults. The env seams exist ONLY so
# fixture tests and exotic hosts can adapt; ANY override is recorded verbatim
# in the budget receipt (floor_source / size_class_source), so a production
# receipt computed with non-frozen thresholds is loud, not silent.
# Floor is FIXED (Owner policy 2026-10-02): 50 GiB after worst-case reservation,
# independent of Data-volume size — the superseded max(60 GiB, 10% volume) term
# is intentionally GONE (no volume-percent seam exists anymore).
BUDGET_FLOOR_MIN_BYTES_DEFAULT=53687091200      # 50 GiB — FIXED floor
BUDGET_LARGE_CLASS_BYTES_DEFAULT=21474836480    # 20 GiB

# guard: every function must run with a strict-ish shell
GOT_ARGS=0

# ---------------------------------------------------------------------------
# id handling
# ---------------------------------------------------------------------------
# backup_id_from_path ROOT BACKUP -> prints the timestamp id (or id as-is)
backup_id_from_path() {
  local root="$1" backup="$2"
  local id
  id="${backup#"${root}.bak-"}"
  # if the strip didn't change anything it wasn't a backup path -> keep as-is
  if [ "$id" = "$backup" ]; then
    id="$(basename "$backup")"; id="${id#agent-core.bak-}"
  fi
  printf '%s' "$id"
}

# resolve ROOT + ID -> backup dir path
resolve_backup() {
  local root="$1" id="$2" parent glob found
  parent="$(dirname "$root")"
  # exact match first
  if [ -d "${root}.bak-${id}" ]; then
    printf '%s' "${root}.bak-${id}"; return 0
  fi
  # fall back to any backup whose id suffix matches
  for found in "${root}".bak-*; do
    [ -d "$found" ] || continue
    if [ "$(backup_id_from_path "$root" "$found")" = "$id" ]; then
      printf '%s' "$found"; return 0
    fi
  done
  return 1
}

# ---------------------------------------------------------------------------
# meta read/write (.backup-meta dotted-key file)
# ---------------------------------------------------------------------------
meta_file() { printf '%s/.backup-meta' "$1"; }

read_meta() {
  local path="$1" key="$2" mf line
  mf="$(meta_file "$path")"
  [ -f "$mf" ] || { printf 'NOT_SET'; return 0; }
  while IFS= read -r line; do
    case "$line" in
      "$key="*)
        printf '%s' "${line#*=}"
        return 0
        ;;
    esac
  done < "$mf"
  printf 'NOT_SET'
}

write_meta() {
  local path="$1"; shift
  local mf line key kept arg
  mf="$(meta_file "$path")"
  # rewrite existing file preserving already-set keys not being updated
  local tmp; tmp="$(mktemp -t backup-meta.XXXXXX)" || return 1
  : > "$tmp"
  if [ -f "$mf" ]; then
    while IFS= read -r line; do
      [ -n "$line" ] || continue
      key="${line%%=*}"
      # drop keys that we are about to update, keep the rest
      kept=1
      for arg in "$@"; do
        if [ "${arg%%=*}" = "$key" ]; then kept=0; break; fi
      done
      [ "$kept" = "1" ] && printf '%s\n' "$line" >> "$tmp"
    done < "$mf"
  fi
  for arg in "$@"; do printf '%s\n' "$arg" >> "$tmp"; done
  # atomic-ish move into the backup dir
  if ! cp "$tmp" "$mf.tmp" 2>/dev/null; then
    echo "WARNING: cannot write metadata for $path" >&2
    rm -f "$tmp"; return 1
  fi
  mv -f "$mf.tmp" "$mf"
  rm -f "$tmp"
  # keep the meta root-owned read-only-ish, but tolerate non-root fixtures
  chown root:wheel "$mf" 2>/dev/null || true
  chmod 0640 "$mf" 2>/dev/null || true
  return 0
}

# ---------------------------------------------------------------------------
# pin / status truth model (fail-safe, shared by list/prune/maybe_first_pin)
# ---------------------------------------------------------------------------
# A backup is "reliably pinned" when EITHER the .pinned marker exists OR its
# .backup-meta carries pinned=true. The union is fail-safe: a pinned=true meta
# with a missing/removed marker is STILL treated as pinned (KEEP, never pruned).
is_pinned_reliable() {
  local bak="$1"
  [ -f "$bak/.pinned" ] && return 0
  [ "$(read_meta "$bak" pinned)" = "true" ] && return 0
  return 1
}

# A backup is "managed normal" (eligible for normal retention) ONLY when its
# .backup-meta is present AND status reads EXACTLY the managed-normal value
# 'predeploy'. Missing/malformed/unreadable/unknown status is NOT normal —
# uncertain -> KEEP. rollback_used is a distinct keep-state (not normal).
is_managed_normal() {
  local bak="$1" st
  [ -f "$(meta_file "$bak")" ] || return 1   # legacy (no meta): skip
  st="$(read_meta "$bak" status)"
  if [ "$st" = "predeploy" ]; then return 0; fi
  return 1   # rollback_used / NOT_SET(absent) / malformed / unreadable / unknown -> KEEP
}

# kept-normal (explicit keep): rollback_used reads status rollback_used (handled
# via is_managed_normal, which treats non-'predeploy' status as keep).

set_pin_marker() { touch "$1/.pinned" 2>/dev/null || { echo "WARNING: cannot create pin marker in $1" >&2; return 1; }; return 0; }
clear_pin_marker() { rm -f "$1/.pinned"; }

# ---------------------------------------------------------------------------
# snapshot helpers
# ---------------------------------------------------------------------------
# harness commit for a backup from $backup/harness/.source-stamp when present
harness_commit_of() {
  local backup="$1" stamp
  stamp="$backup/harness/.source-stamp"
  if [ -f "$stamp" ]; then
    # source-stamp is "<commit><dirtycount>" without a separator; keep the
    # first 40 hex chars as the commit, rest as dirty count
    local s
    s="$(tr -d '\n' < "$stamp")"
    printf '%s' "${s:0:40}"
  else
    printf '%s' 'unknown'
  fi
}

# ---------------------------------------------------------------------------
# write predeploy metadata + FIRST_RELIABLE_PIN (requires explicit LKG assertion)
# ---------------------------------------------------------------------------
write_predecessor_meta() {
  local root="$1" backup="$2"
  local id created_at scommit hcommit
  id="$(backup_id_from_path "$root" "$backup")"
  created_at="$(date +%Y-%m-%dT%H:%M:%S%z)"
  # source_commit = previous installed closure app commit. The previous closure
  # does NOT record its repo commit; never use the new deploy's REPO_SRC HEAD.
  # This helper does NOT derive the commit (or the LKG) itself.
  scommit="unknown"
  hcommit="$(harness_commit_of "$backup")"
  if ! write_meta "$backup" \
       "backup_id=${id}" \
       "created_at=${created_at}" \
       "source_commit=${scommit}" \
       "harness_commit=${hcommit}" \
       "pinned=false" \
       "status=predeploy"; then
    echo "WARNING: backup $backup has no writeable metadata (storage issue?)" >&2
    return 1
  fi
  # FIRST_RELIABLE_PIN: pin ONLY when there is no existing reliable pin AND a
  # trusted operator EXPLICITLY asserts that this predecessor (the predeploy
  # capture of the previously verified closure) is the verified LKG.
  #   LKG verification authority = external acceptance / trusted operator.
  #   This backup helper does NOT verify LKG itself and must NOT infer
  #   known-good from no-pin / mtime / newest / "current install".
  # Without the explicit assertion -> auto-pin = NO (backup created normally).
  if [ "${AGENT_CORE_VERIFIED_PREDECESSOR_LKG:-no}" = "YES" ]; then
    maybe_first_pin "$root" "$backup"
  else
    echo "NOTE: no FIRST_RELIABLE_PIN set for $backup — no explicit verified-LKG assertion"
    echo "  (set AGENT_CORE_VERIFIED_PREDECESSOR_LKG=YES only when a trusted operator has"
    echo "   confirmed this predecessor backup is the verified last-known-good; else it stays normal)"
  fi
}

maybe_first_pin() {
  local root="$1" wanted="$2" bak
  local any_pinned=0
  # historical-pin detection uses the SAME fail-safe truth model as list/prune
  # (marker OR pinned=true-in-meta).
  for bak in "${root}".bak-*; do
    [ -d "$bak" ] || continue
    if is_pinned_reliable "$bak"; then any_pinned=1; break; fi
  done
  if [ "$any_pinned" = "0" ]; then
    if set_pin_marker "$wanted" && write_meta "$wanted" pinned=true \
         "pin_reason=first-reliable-pin: verified-LKG asserted via AGENT_CORE_VERIFIED_PREDECESSOR_LKG=YES"; then
      echo "PIN: $wanted -> FIRST_RELIABLE_PIN (trusted-operator asserted LKG; no prior reliable pin; metadata/marker only, no data copy)"
    else
      echo "WARNING: failed to establish FIRST_RELIABLE_PIN on $wanted" >&2
    fi
  else
    echo "NOTE: a reliable pin already exists; not re-pinning $wanted (passing a deploy does not auto-pin beyond the operator's assertion)"
  fi
}

# ---------------------------------------------------------------------------
# pin / unpin / mark-rollback-used
# ---------------------------------------------------------------------------
pin_backup() {
  local root="$1" id="$2" reason="$3" bak
  bak="$(resolve_backup "$root" "$id")" || { echo "ERROR: no such backup: $id" >&2; return 1; }
  if ! is_pinned_reliable "$bak"; then
    set_pin_marker "$bak" || return 1
  fi
  if ! write_meta "$bak" pinned=true "pin_reason=${reason}"; then return 1; fi
  echo "PIN: $(backup_id_from_path "$root" "$bak") -> pinned (marker only, no data copy; reason recorded)"
}

unpin_backup() {
  local root="$1" id="$2" bak
  bak="$(resolve_backup "$root" "$id")" || { echo "ERROR: no such backup: $id" >&2; return 1; }
  clear_pin_marker "$bak"
  if [ "$(read_meta "$bak" pinned)" = "true" ]; then write_meta "$bak" pinned=false || return 1; fi
  echo "UNPIN: $(backup_id_from_path "$root" "$bak") -> not pinned"
}

mark_rollback_used() {
  local root="$1" id="$2" bak
  bak="$(resolve_backup "$root" "$id")" || { echo "ERROR: no such backup: $id" >&2; return 1; }
  write_meta "$bak" status=rollback_used || return 1
  echo "ROLLBACK_USED: $(backup_id_from_path "$root" "$bak") -> KEEP (never auto-pruned)"
}

# ---------------------------------------------------------------------------
# list
# ---------------------------------------------------------------------------
list_backups() {
  local root="$1" bak id pin st status size
  printf '%-15s %-7s %-14s %9s  %s\n' "BACKUP_ID" "PINNED" "STATUS" "SIZE" "PATH"
  for bak in "${root}".bak-*; do
    [ -d "$bak" ] || continue
    id="$(backup_id_from_path "$root" "$bak")"
    pin="no"; if is_pinned_reliable "$bak"; then pin="yes"; fi
    st="$(read_meta "$bak" status)"     # predeploy | rollback_used | NOT_SET(legacy/unknown)
    if [ "$st" = "NOT_SET" ]; then st="legacy/unknown"; fi
    size="$(du -sk "$bak" 2>/dev/null | awk '{print $1}')"; [ -z "$size" ] && size="-"
    printf '%-15s %-7s %-14s %9s  %s\n' "$id" "$pin" "$st" "${size}K" "$bak"
  done
}

# ---------------------------------------------------------------------------
# post-verified-success NORMAL retention
# ---------------------------------------------------------------------------
do_prune() {
  local root="$1"
  # strict gate: prune is ONLY allowed after the operator declares the deploy
  # reached verified success (Spec: prune only after verification success ->
  # deployment success declared).
  if [ "${VERIFIED_SUCCESS:-0}" != "1" ]; then
    echo "WARNING: prune skipped — deployment not declared verified-success." >&2
    echo "  (Spec: FAILED_DEPLOYMENT_PRUNE=NO, FAILED_HEALTH_VERIFICATION_PRUNE=NO." >&2
    echo "   Re-run with --verified-success only after health/acceptance verification succeeds.)" >&2
    return 3
  fi

  local eligible="" bak
  # collect eligible NORMAL backups = those with .backup-meta AND status EXACTLY
  # 'predeploy' (the managed-normal value), NOT reliably pinned.
  # Fail-safe rule (uncertain -> KEEP):
  #   legacy (no meta)           -> skip (AUTO_PRUNE_LEGACY=NO)
  #   pinned (marker OR pinned=true meta) -> skip (never auto-pruned)
  #   rollback_used              -> skip (KEEP)
  #   status missing / malformed / unreadable / unknown -> skip (NOT treated as normal)
  for bak in "${root}".bak-*; do
    [ -d "$bak" ] || continue
    is_managed_normal "$bak"   || continue   # legacy / rollback_used / unknown/absent status -> KEEP
    is_pinned_reliable "$bak"  && continue   # pinned (either truth): never auto-pruned
    eligible="$eligible $(backup_id_from_path "$root" "$bak")"
  done

  # keep newest NORMAL_RETENTION (name order == chronological for .bak-<ts>)
  local newest=""
  newest="$(printf '%s\n' $eligible | sort -r | head -n "$NORMAL_RETENTION")"
  local prune_ids=""
  prune_ids="$(printf '%s\n' $eligible | sort -r | tail -n +"$((NORMAL_RETENTION+1))")"

  if [ -z "$prune_ids" ]; then
    echo "PRUNE: nothing to prune (eligible NORMAL=${eligible:-none}; keeping newest ${NORMAL_RETENTION})"
    return 0
  fi

  local anynote=0 pid pth
  for pid in $prune_ids; do
    pth="$(resolve_backup "$root" "$pid")" || continue
    echo "PRUNE: removing ${pth}"
    if rm -rf -- "$pth" 2>/dev/null; then
      :
    else
      echo "WARNING: prune FAILED for $pth — kept on disk; will retry on next deploy (deployment stays successful)." >&2
      anynote=1
    fi
  done
  if [ "$anynote" = "1" ]; then
    # loud, non-silent, does NOT invalidate the healthy deployment
    return 1
  fi
  echo "PRUNE: complete — NORMAL backups kept at ${NORMAL_RETENTION}; pinned + rollback-used + legacy retained."
  echo "PRUNE: PRUNE_SUCCESS_AUTHORITY=TRUSTED_OPERATOR_ASSERTION MACHINE_ENFORCED_VERIFICATION=NO"
  return 0
}

# ===========================================================================
# W0 RELEASE-SAFETY (Product #430): deploy admission gate — disk budget +
# full-tree retention cap + receipt. READ-ONLY over the trees; the only thing
# it ever writes is its own receipt JSON in ROOT's parent directory.
# ===========================================================================

# worst-case physical size of a tree: every regular file's logical size
# ROUNDED UP to its own 4 KiB allocation block (sparse/compressed/clone
# savings deliberately NOT taken — CLONE_PROOF=NONE, no clone semantics are
# mechanically proven) + one 4 KiB block per directory.
tree_logical_bytes() {
  local p="$1" files dirs
  [ -d "$p" ] || { printf '0'; return 0; }
  files="$(find "$p" -type f -print0 2>/dev/null | xargs -0 stat -f %z 2>/dev/null \
           | awk '{s += (int(($1+4095)/4096))*4096} END{printf "%.0f", s+0}')"
  dirs="$(find "$p" -type d 2>/dev/null | wc -l | tr -d ' ')"
  awk -v f="${files:-0}" -v d="${dirs:-0}" 'BEGIN{printf "%.0f", f + (d*4096)}'
}

# volume_stats PATH -> "<total_bytes> <avail_bytes>" (the Data volume holding PATH)
volume_stats() {
  df -kP "$1" 2>/dev/null | awk 'NR==2{printf "%.0f %.0f", $2*1024, $4*1024}'
}

json_str() {
  # control chars (incl. LF/TAB) are DELETED, never emitted raw: raw bytes
  # <0x20 are invalid inside JSON strings, so a multi-line --pin-exception
  # reason must not be able to corrupt the receipt
  local s
  s="$(printf '%s' "$1" | tr -d '\010\011\012\013\014\015\016\017\020\021\022\023\024\025\026\027\030\031\032\033\034\035\036\037' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')"
  printf '"%s"' "$s"
}

# stdin lines -> JSON array of strings (pure bash; no external JSON tooling —
# this helper must run on a bare macOS host)
json_array_from_lines() {
  local out="[" first=1 line
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    [ "$first" = "1" ] || out="$out, "
    first=0
    out="$out$(json_str "$line")"
  done
  printf '%s]' "$out"
}

# one census line per backup: <large 0|1>\t<pinned 0|1>\t<status>\t<id>\t<path>\t<bytes>
budget_census() {
  local root="$1" class="$2" bak id bytes pin st large
  for bak in "${root}".bak-*; do
    [ -d "$bak" ] || continue
    id="$(backup_id_from_path "$root" "$bak")"
    bytes="$(tree_logical_bytes "$bak")"
    if is_pinned_reliable "$bak"; then pin=1; else pin=0; fi
    st="$(read_meta "$bak" status)"     # predeploy | rollback_used | NOT_SET(legacy/unknown)
    [ "$st" = "NOT_SET" ] && st="legacy/unknown"
    large=0; awk -v b="$bytes" -v c="$class" 'BEGIN{exit !(b>=c)}' && large=1
    printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$large" "$pin" "$st" "$id" "$bak" "$bytes"
  done | sort -t "$(printf '\t')" -k4,4
}

# the effective thresholds + their provenance (defaults vs env override)
budget_thresholds() { # prints MIN CLASS MIN_SRC CLASS_SRC
  local min="${AGENT_CORE_BUDGET_FLOOR_MIN_BYTES:-}" cls="${AGENT_CORE_BUDGET_LARGE_CLASS_BYTES:-}"
  local msrc="defaults" csrc="defaults"
  [ -n "$min" ] && msrc="env-override"
  [ -n "$cls" ] && csrc="env-override"
  printf '%s %s %s\n' \
    "${min:-$BUDGET_FLOOR_MIN_BYTES_DEFAULT}" \
    "${cls:-$BUDGET_LARGE_CLASS_BYTES_DEFAULT}" "$msrc" "$csrc"
}

# do_check_budget ROOT <projected-new-backup-path|NONE> [--pin-exception <reason>]
# exit: 0 ADMIT · 4 REFUSED_DISK_BUDGET · 5 REFUSED_RETENTION_CAP · 2 usage error
do_check_budget() {
  local root="$1"; shift
  local projected="${1:-}"; shift || true
  local pin_exc=""
  if [ "$#" -gt 0 ] && [ "$1" = "--pin-exception" ]; then
    shift
    [ "$#" -gt 0 ] || { echo "ERROR: --pin-exception needs a reason" >&2; return 2; }
    pin_exc="$*"
  fi
  [ -n "$projected" ] || { echo "ERROR: --check-budget needs <projected-new-backup-path|NONE>" >&2; return 2; }
  case "$projected" in
    --*) { echo "ERROR: --check-budget: first argument must be <projected-new-backup-path|NONE>, got '$projected'" >&2; return 2; } ;;
  esac
  local parent receipt
  parent="$(dirname "$root")"
  receipt="$parent/agent-core-deploy-budget-receipt.json"

  read -r min_b cls msrc csrc <<<"$(budget_thresholds)"

  local vol_total=0 vol_free=0
  read -r vol_total vol_free <<<"$(volume_stats "$parent")"
  [ -z "$vol_total" ] && vol_total=0
  [ -z "$vol_free" ] && vol_free=0
  # FIXED floor (Owner policy 2026-10-02): floor == 50 GiB default (MIN seam),
  # with NO volume-percent term — Data-volume size cannot change the floor.
  # vol_total is still measured and receipted below as context only.
  local floor="$min_b"

  local live_bytes=0
  [ -d "$root" ] && live_bytes="$(tree_logical_bytes "$root")"

  # census + cap arithmetic. The projected backup is a plain rename of the live
  # tree (same volume, zero copy), so its worst-case size == live tree size and
  # it adds NO new allocation; the fresh allocation at peak is the NEW tree the
  # install writes (worst case: full physical copy, reuse discounts ignored).
  local new_is_large=0 new_will_pin=0
  local census id bak pin st large bytes
  census="$(budget_census "$root" "$cls")"
  local pin_large=0 unpin_large=0 any_reliable_pin=0
  if [ -n "$census" ]; then
    while IFS="$(printf '\t')" read -r large pin st id bak bytes; do
      [ -n "$id" ] || continue
      [ "$large" = "1" ] || continue          # the cap counts only >=size-class backups
      if [ "$pin" = "1" ]; then pin_large=$((pin_large+1)); fi
      if [ "$pin" = "0" ]; then unpin_large=$((unpin_large+1)); fi
    done <<<"$census"
  fi
  local any_reliable_pin_all=0
  if [ -n "$census" ]; then
    while IFS="$(printf '\t')" read -r large pin st id bak bytes; do
      [ -n "$id" ] || continue
      if [ "$pin" = "1" ]; then any_reliable_pin_all=1; break; fi
    done <<<"$census"
  fi
  any_reliable_pin="$any_reliable_pin_all"
  if [ "$projected" != "NONE" ]; then
    awk -v b="$live_bytes" -v c="$cls" 'BEGIN{exit !(b>=c)}' && new_is_large=1
    # #414 seam: with an explicit verified-LKG assertion and no prior reliable
    # pin, the new preimage becomes FIRST_RELIABLE_PIN right after the mv — the
    # gate models that pinned outcome (the operator assertion is the authority;
    # no machine inference).
    if [ "${AGENT_CORE_VERIFIED_PREDECESSOR_LKG:-no}" = "YES" ] && [ "$any_reliable_pin" = "0" ]; then
      new_will_pin=1
    fi
  fi
  local post_pin_large=$((pin_large + new_will_pin))
  local post_unpin_large=$((unpin_large + (new_is_large == 1 && new_will_pin == 0 ? 1 : 0)))

  # guidance: EXACT superseded unpinned managed-normal paths only
  local guidance="" notes=""
  if [ -n "$census" ]; then
    while IFS="$(printf '\t')" read -r large pin st id bak bytes; do
      [ -n "$id" ] || continue
      [ "$large" = "1" ] || continue
      [ "$pin" = "0" ] || continue
      if [ "$st" = "predeploy" ]; then
        guidance="$guidance$bak
"
      else
        if [ "$st" = "rollback_used" ]; then
          notes="${notes}KEEP (rollback-used, never auto-pruned): $bak
"
        elif [ "$st" = "legacy/unknown" ]; then
          notes="${notes}legacy/unknown (AUTO_PRUNE_LEGACY=NO — separate operator task per AGENT_CORE_BACKUP_RETENTION_V1): $bak
"
        else
          notes="${notes}unknown status (fail-safe KEEP): $bak
"
        fi
      fi
    done <<<"$census"
  fi
  if [ "$post_pin_large" -gt 1 ]; then
    notes="${notes}over-cap PINNED backups are protected; release via --unpin or assert a pin exception.
"
  fi

  # budget arithmetic (all worst-case)
  local used_now reservation peak free_after disk_ok=1 ret_ok=1 verdict="ADMITTED" rc=0 refusal="null"
  used_now=$((vol_total - vol_free))
  reservation="$live_bytes"                      # fresh allocation = new tree, worst case
  peak=$((used_now + reservation))
  free_after=$((vol_free - reservation))
  if awk -v f="$free_after" -v fl="$floor" 'BEGIN{exit !(f < fl)}'; then
    disk_ok=0
  fi
  if [ "$post_pin_large" -gt 1 ] || [ "$post_unpin_large" -gt 1 ]; then
    ret_ok=0
  fi

  if [ "$disk_ok" = "0" ]; then
    verdict="REFUSED_DISK_BUDGET"; rc=4
    refusal="\"projected free after reservation ($free_after) is below the disk-budget floor ($floor)\""
  elif [ "$ret_ok" = "0" ] && [ -z "$pin_exc" ]; then
    verdict="REFUSED_RETENTION_CAP"; rc=5
    refusal="\"creating this backup would exceed the full-tree retention cap (live + 1 pinned known-good + 1 newest immediate-rollback preimage; >=size-class backups)\""
  fi
  # an asserted open-Product pin exception admits a retention-cap overflow
  # (receipted above); the disk-budget floor itself is HARD — no exception.

  # ---- receipt (ALWAYS written, before any verdict is returned) ----
  local ts aid
  ts="$(date +%Y-%m-%dT%H:%M:%S%z)"
  aid="$(date +%Y%m%d-%H%M%S)-$$-${RANDOM:-0}"

  local tmp; tmp="$(mktemp -t budget-receipt.XXXXXX)" || return 1
  {
    printf '{\n'
    printf '  "schema": "agent-core-deploy-budget-receipt-v1",\n'
    printf '  "attempt_id": %s,\n' "$(json_str "$aid")"
    printf '  "created_at": %s,\n' "$(json_str "$ts")"
    printf '  "command": "--check-budget",\n'
    printf '  "root": %s,\n' "$(json_str "$root")"
    printf '  "projected_new_backup": %s,\n' "$(json_str "$projected")"
    printf '  "verdict": %s,\n' "$(json_str "$verdict")"
    printf '  "refusal_reason": %s,\n' "$refusal"
    printf '  "DATA_VOLUME_TOTAL_BYTES": %s,\n' "$vol_total"
    printf '  "DISK_FREE_BEFORE": %s,\n' "$vol_free"
    printf '  "DISK_BUDGET_FLOOR_BYTES": %s,\n' "$floor"
    printf '  "LIVE_TREE_BYTES": %s,\n' "$live_bytes"
    printf '  "PROJECTED_NEW_TREE_BYTES": %s,\n' "$live_bytes"
    printf '  "ESTIMATED_PEAK_BYTES": %s,\n' "$peak"
    printf '  "DISK_FREE_AFTER_RESERVATION": %s,\n' "$free_after"
    printf '  "disk_budget_ok": %s,\n' "$disk_ok"
    printf '  "retention_cap_ok": %s,\n' "$ret_ok"
    printf '  "retention_cap_rule": %s,\n' "$(json_str "live + max 1 pinned known-good + max 1 newest immediate-rollback preimage, counted at/above the size class")"
    printf '  "size_class_bytes": %s,\n' "$cls"
    printf '  "size_class_source": %s,\n' "$(json_str "$csrc")"
    printf '  "floor_source": %s,\n' "$(json_str "floor_min=$msrc rule=fixed-floor-no-volume-term (Owner policy 2026-10-02; supersedes max(60GiB,10% volume))")"
    printf '  "clone_semantics_proof": "NONE (worst-case physical allocation assumed; no clone semantics mechanically proven)",\n'
    printf '  "projected_new_backup_will_be_pinned_first_reliable": %s,\n' "$new_will_pin"
    printf '  "pin_exception_asserted": %s,\n' "$([ -n "$pin_exc" ] && echo true || echo false)"
    printf '  "pin_exception_reason": %s,\n' "$(json_str "$pin_exc")"
    printf '  "cleanup_guidance_exact_paths": %s,\n' "$(json_array_from_lines <<<"$guidance")"
    printf '  "cleanup_guidance_notes": %s,\n' "$(json_array_from_lines <<<"${notes:-}")"
    printf '  "retained_backups_before": ['
    local first=1
    if [ -n "$census" ]; then
      while IFS="$(printf '\t')" read -r large pin st id bak bytes; do
        [ -n "$id" ] || continue
        [ "$first" = "1" ] || printf ', '
        first=0
        printf '{"id": %s, "path": %s, "bytes": %s, "pinned": %s, "status": %s, "large": %s, "pin_reason": %s}' \
          "$(json_str "$id")" "$(json_str "$bak")" "$bytes" "$pin" "$(json_str "$st")" "$large" \
          "$(json_str "$(pinned_reason_of "$bak" "$pin")")"
      done <<<"$census"
    fi
    printf '],\n'
    printf '  "retained_backups_after_projected": ['
    first=1
    if [ -n "$census" ]; then
      while IFS="$(printf '\t')" read -r large pin st id bak bytes; do
        [ -n "$id" ] || continue
        [ "$first" = "1" ] || printf ', '
        first=0
        printf '{"id": %s, "path": %s, "bytes": %s, "pinned": %s, "status": %s, "large": %s, "pin_reason": %s}' \
          "$(json_str "$id")" "$(json_str "$bak")" "$bytes" "$pin" "$(json_str "$st")" "$large" \
          "$(json_str "$(pinned_reason_of "$bak" "$pin")")"
      done <<<"$census"
    fi
    if [ "$projected" != "NONE" ]; then
      [ "$first" = "1" ] || printf ', '
      printf '{"id": %s, "path": %s, "bytes": %s, "pinned": %s, "status": "predeploy(projected)", "large": %s, "pin_reason": %s}' \
        "$(json_str "$(backup_id_from_path "$root" "$projected")")" "$(json_str "$projected")" "$live_bytes" \
        "$new_will_pin" "$new_is_large" \
        "$(json_str "$([ "$new_will_pin" = "1" ] && echo "first-reliable-pin: verified-LKG asserted via AGENT_CORE_VERIFIED_PREDECESSOR_LKG=YES" || echo "")")"
    fi
    printf '],\n'
    printf '  "pin_reasons": ['
    first=1
    if [ -n "$census" ]; then
      while IFS="$(printf '\t')" read -r large pin st id bak bytes; do
        [ -n "$id" ] || continue
        [ "$first" = "1" ] || printf ', '
        first=0
        printf '{"id": %s, "pinned": %s, "reason": %s}' \
          "$(json_str "$id")" "$pin" "$(json_str "$(pinned_reason_of "$bak" "$pin")")"
      done <<<"$census"
    fi
    if [ "$new_will_pin" = "1" ]; then
      [ "$first" = "1" ] || printf ', '
      printf '{"id": %s, "pinned": 1, "reason": %s}' \
        "$(json_str "$(backup_id_from_path "$root" "$projected")")" \
        "$(json_str "first-reliable-pin: verified-LKG asserted via AGENT_CORE_VERIFIED_PREDECESSOR_LKG=YES")"
    fi
    printf ']\n'
    printf '}\n'
  } > "$tmp"
  if ! mv -f "$tmp" "$receipt" 2>/dev/null; then
    echo "WARNING: cannot write budget receipt $receipt" >&2
    rm -f "$tmp"
    return 1
  fi
  chmod 0644 "$receipt" 2>/dev/null || true

  # human verdict line (loud either way)
  if [ "$rc" = "0" ]; then
    echo "BUDGET: ADMITTED — free=$vol_free floor=$floor reservation=$reservation free_after=$free_after; retention cap ok (pinned_large=$post_pin_large unpinned_large=$post_unpin_large class=$cls)"
    [ -n "$pin_exc" ] && echo "BUDGET: open-Product pin exception asserted and receipted: $pin_exc"
  else
    echo "BUDGET: REFUSED ($verdict) — receipt: $receipt" >&2
    [ "$disk_ok" = "0" ] && echo "  free=$vol_free reservation=$reservation free_after=$free_after < floor=$floor" >&2
    if [ "$ret_ok" = "0" ]; then
      echo "  cap exceeded: pinned_large=$post_pin_large unpinned_large=$post_unpin_large (class=$cls bytes)" >&2
      if [ -n "$guidance" ]; then
        echo "  EXACT superseded unpinned cleanup candidates (run --cleanup-exact on the ones you accept removing):" >&2
        printf '    %s\n' "$guidance" >&2
      fi
      [ -n "$notes" ] && printf '  NOTE: %s\n' "$notes" >&2
    fi
  fi
  return "$rc"
}

# pin reason for receipt output: recorded reason, or an explicit unrecorded
# marker for pins that predate pin_reason metadata (never a guessed reason)
pinned_reason_of() {
  local bak="$1" pin="$2" r
  if [ "$pin" != "1" ]; then printf ''; return 0; fi
  r="$(read_meta "$bak" pin_reason)"
  if [ "$r" = "NOT_SET" ] || [ -z "$r" ]; then
    printf 'unrecorded (pin without pin_reason metadata)'
  else
    printf '%s' "$r"
  fi
}

# do_cleanup_exact ROOT <backup-path>
# exit: 0 removed or idempotent NOOP · 2 refused (protected/out-of-family/wildcard)
do_cleanup_exact() {
  local root="$1" target="$2"
  local parent receipt
  parent="$(dirname "$root")"
  receipt="$parent/agent-core-cleanup-exact-receipt.json"
  refuse_cleanup() { # PATH REASON
    echo "CLEANUP: REFUSED $1 — $2" >&2
    write_cleanup_receipt "$root" "$receipt" "$1" "REFUSED" "$2" 0
    return 2
  }
  # no wildcards, ever: the command is exact-path by construction
  case "$target" in
    *[\*\?\[]*) refuse_cleanup "$target" "wildcard/glob characters are not permitted (exact-path cleanup only)"; return $? ;;
  esac
  case "$target" in
    "${root}".bak-*) : ;;
    *) refuse_cleanup "$target" "not a backup of this root (expected <ROOT>.bak-<id>)"; return $? ;;
  esac
  local id="${target#"${root}".bak-}"
  case "$id" in
    ''|*[/]*|.|..) refuse_cleanup "$target" "malformed backup id: $id"; return $? ;;
  esac
  if [ ! -d "$target" ]; then
    echo "CLEANUP: NOOP $target already absent (idempotent)"
    write_cleanup_receipt "$root" "$receipt" "$target" "NOOP_ALREADY_ABSENT" "" 0
    return 0
  fi
  # protection truth model — same fail-safe classes as prune (uncertain -> KEEP)
  if [ ! -f "$(meta_file "$target")" ]; then
    refuse_cleanup "$target" "legacy backup (no .backup-meta) — AUTO_PRUNE_LEGACY=NO, separate operator task"; return $?
  fi
  local st; st="$(read_meta "$target" status)"
  if [ "$st" != "predeploy" ]; then
    refuse_cleanup "$target" "status=$st (only managed-normal 'predeploy' is cleanable; rollback_used/unknown -> KEEP)"; return $?
  fi
  if is_pinned_reliable "$target"; then
    refuse_cleanup "$target" "reliably pinned (marker OR pinned=true) — protected; --unpin first if this pin is genuinely obsolete"; return $?
  fi
  local bytes
  bytes="$(tree_logical_bytes "$target")"
  if ! rm -rf -- "$target"; then
    refuse_cleanup "$target" "rm failed"; return $?
  fi
  if [ -e "$target" ]; then
    refuse_cleanup "$target" "path still present after rm"; return $?
  fi
  echo "CLEANUP: removed $target (exact path; freed ~$bytes logical bytes)"
  write_cleanup_receipt "$root" "$receipt" "$target" "REMOVED" "" "$bytes"
  return 0
}

write_cleanup_receipt() { # ROOT RECEIPT PATH ACTION REASON BYTES
  local root="$1" receipt="$2" path="$3" action="$4" reason="$5" bytes="$6"
  local tmp
  tmp="$(mktemp -t cleanup-receipt.XXXXXX)" || return 1
  {
    printf '{\n'
    printf '  "schema": "agent-core-cleanup-exact-receipt-v1",\n'
    printf '  "created_at": %s,\n' "$(json_str "$(date +%Y-%m-%dT%H:%M:%S%z)")"
    printf '  "root": %s,\n' "$(json_str "$root")"
    printf '  "path": %s,\n' "$(json_str "$path")"
    printf '  "action": %s,\n' "$(json_str "$action")"
    printf '  "reason": %s,\n' "$(json_str "$reason")"
    printf '  "freed_logical_bytes": %s\n' "$bytes"
    printf '}\n'
  } > "$tmp"
  mv -f "$tmp" "$receipt" 2>/dev/null || { rm -f "$tmp"; return 1; }
  chmod 0644 "$receipt" 2>/dev/null || true
  return 0
}

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
main() {
  [ "$#" -ge 2 ] || { echo "usage: agent-core-backup-ops.sh <ROOT> <command> [args...]" >&2; exit 2; }
  root="$1"; shift
  cmd="$1"; shift

  # validate the install root has a sane parent (for building backup globs)
  [ -d "$(dirname "$root")" ] || { echo "ERROR: parent of root not a dir: $(dirname "$root")" >&2; exit 2; }

  case "$cmd" in
    --list) list_backups "$root"; exit $? ;;
    --write-predecessor)
      [ "$#" -eq 1 ] || { echo "ERROR: --write-predecessor needs <backup>"; exit 2; }
      write_predecessor_meta "$root" "$1"; exit $? ;;
    --pin)
      [ "$#" -ge 1 ] || { echo "ERROR: --pin needs <id> [reason...]"; exit 2; }
      pid="$1"; shift
      preason="${*:-operator --pin (no reason recorded)}"
      pin_backup "$root" "$pid" "$preason"; exit $? ;;
    --unpin)
      [ "$#" -eq 1 ] || { echo "ERROR: --unpin needs <id>"; exit 2; }
      unpin_backup "$root" "$1"; exit $? ;;
    --mark-rollback-used)
      [ "$#" -eq 1 ] || { echo "ERROR: --mark-rollback-used needs <id>"; exit 2; }
      mark_rollback_used "$root" "$1"; exit $? ;;
    --prune)
      VERIFIED_SUCCESS=0
      for a in "$@"; do [ "$a" = "--verified-success" ] && VERIFIED_SUCCESS=1; done
      do_prune "$root"; exit $? ;;
    --check-budget)
      [ "$#" -ge 1 ] || { echo "ERROR: --check-budget needs <projected-new-backup-path|NONE> [--pin-exception <reason>]"; exit 2; }
      do_check_budget "$root" "$@"; exit $? ;;
    --cleanup-exact)
      [ "$#" -eq 1 ] || { echo "ERROR: --cleanup-exact needs exactly <backup-path>"; exit 2; }
      do_cleanup_exact "$root" "$1"; exit $? ;;
    *)
      echo "ERROR: unknown command: $cmd" >&2
      echo "  commands: --list | --write-predecessor <backup> | --pin <id> [reason...] | --unpin <id> | --mark-rollback-used <id> | --prune [--verified-success] | --check-budget <projected-new-backup-path|NONE> [--pin-exception <reason>] | --cleanup-exact <backup-path>" >&2
      exit 2 ;;
  esac
}

# library + CLI: when sourced, do not auto-run
case "$0" in
  *agent-core-backup-ops.sh) main "$@" ;;
esac
