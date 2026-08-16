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
#     --pin <id>                   pin a backup (marker + meta, no data copy)
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
# =============================================================================
set -uo pipefail

NORMAL_RETENTION=3

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
    if set_pin_marker "$wanted" && write_meta "$wanted" pinned=true; then
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
  local root="$1" id="$2" bak
  bak="$(resolve_backup "$root" "$id")" || { echo "ERROR: no such backup: $id" >&2; return 1; }
  if ! is_pinned_reliable "$bak"; then
    set_pin_marker "$bak" || return 1
  fi
  write_meta "$bak" pinned=true || return 1
  echo "PIN: $(backup_id_from_path "$root" "$bak") -> pinned (marker only, no data copy)"
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
      [ "$#" -eq 1 ] || { echo "ERROR: --pin needs <id>"; exit 2; }
      pin_backup "$root" "$1"; exit $? ;;
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
    *)
      echo "ERROR: unknown command: $cmd" >&2
      echo "  commands: --list | --write-predecessor <backup> | --pin <id> | --unpin <id> | --mark-rollback-used <id> | --prune [--verified-success]" >&2
      exit 2 ;;
  esac
}

# library + CLI: when sourced, do not auto-run
case "$0" in
  *agent-core-backup-ops.sh) main "$@" ;;
esac
