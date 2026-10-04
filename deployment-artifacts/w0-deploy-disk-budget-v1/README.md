# W0 RELEASE-SAFETY — deploy disk-budget + full-tree retention cap (Product #430)

STATUS: PREPARED / AUTHORIZED_STANDING-PENDING-MERGE — nothing in this packet
has been executed against production; PRODUCTION_MUTATION = NO in this lane.
Under the #386 standing production authority (Owner policy 2026-10-02) this
packet means DEPLOY NEXT once the corrected source is merged and the exact
live preflight is green; no routine per-release Owner confirmation.

## What changed (candidate 55263a09, base 15cdfc33; floor correction base 09de835d)

Additive, fail-closed admission gate on the trusted-cp/DS tree-deploy path
(scripts/trusted-cp-deploy-install.sh), reusing the existing
AGENT_CORE_BACKUP_RETENTION_V1 filesystem helper
(scripts/agent-core-backup-ops.sh). No new backup service/daemon/watcher/DB/
platform. No Runtime/Router/Scheduler/Kernel/product-semantics change.

- Deploy section 0c (NEW): before the FIRST production mutation — the
  section-1 full-root preimage `mv /usr/local/libexec/agent-core
  → agent-core.bak-<ts>`, or the first tree write on a fresh install — the
  deploy runs the helper's `--check-budget` gate (ROOT = $TRUSTED_ROOT).
  Refusal = deploy exits 2 with "MUTATION TRUTH: NOTHING was mutated" and the
  receipt path. Helper missing = refuse (fail-closed).
- Helper `--check-budget <projected-new-backup-path|NONE>
  [--pin-exception <reason>]`: read-only over the trees; writes
  `/usr/local/libexec/agent-core-deploy-budget-receipt.json` on EVERY attempt
  (latest-wins, per-attempt attempt_id).
- Helper `--cleanup-exact <backup-path>`: operator exact-path cleanup of ONE
  superseded unpinned managed-normal backup; wildcard-free; refuses pinned
  (marker OR meta) / legacy / rollback_used / unknown-status; idempotent NOOP
  when already absent; writes agent-core-cleanup-exact-receipt.json.
- Additive `pin_reason` metadata on FIRST_RELIABLE_PIN and
  `--pin <id> [reason...]` (backward compatible).
- Floor correction (Owner policy 2026-10-02, this packet v2): the
  `--check-budget` floor is FIXED 50 GiB after worst-case reservation. The
  earlier `max(60 GiB, 10% of the Data volume)` formula is SUPERSEDED and the
  AGENT_CORE_BUDGET_FLOOR_VOLUME_PERCENT seam is removed — Data-volume size
  no longer changes the floor. Retention cap, pin protection, exact-path
  cleanup, receipt schema shape, and all other gate semantics unchanged.

## Budget formula (frozen, Owner policy 2026-10-02)

```
DISK_BUDGET_FLOOR   = FIXED 50 GiB (53687091200) — volume-independent; the
                      superseded max(60 GiB, 10% of the Data volume) rule and
                      its AGENT_CORE_BUDGET_FLOOR_VOLUME_PERCENT seam are
                      GONE
ALLOCATION MODEL    = worst-case physical: every file's logical size rounded
                      up to its own 4 KiB block + one 4 KiB block per
                      directory; NO clone/sparse/compression discount
                      (CLONE_PROOF = NONE — no clone semantics are
                      mechanically proven, so none are assumed)
LIVE_TREE_BYTES     = worst-case physical size of the live install tree
PROJECTED_NEW_TREE  = LIVE_TREE_BYTES (the install rewrites the tree fresh;
                      reuse discounts deliberately ignored)
ESTIMATED_PEAK      = volume_used_now + PROJECTED_NEW_TREE
DISK_FREE_AFTER_RESERVATION = DISK_FREE_BEFORE − PROJECTED_NEW_TREE
ADMISSION           = DISK_FREE_AFTER_RESERVATION ≥ DISK_BUDGET_FLOOR
REFUSAL             = exit 4 REFUSED_DISK_BUDGET (HARD — the open-Product pin
                      exception does NOT override the floor)
```

Env seams (defaults frozen in source; ANY override is recorded in the receipt
as floor_source / size_class_source): AGENT_CORE_BUDGET_FLOOR_MIN_BYTES,
AGENT_CORE_BUDGET_LARGE_CLASS_BYTES.

## Retention rule (frozen)

```
FULL-TREE CAP = live + max ONE pinned known-good + max ONE newest
                immediate-rollback preimage, counted over backups at/above
                the 20 GiB size class
THIRD >=class BACKUP = REFUSED (exit 5 REFUSED_RETENTION_CAP) unless
                (a) the superseded unpinned ones were cleaned first by EXACT
                    path (helper --cleanup-exact; the receipt's
                    cleanup_guidance_exact_paths names the eligible ones), or
                (b) an open-Product pin exception is asserted:
                    sudo AGENT_CORE_BUDGET_PIN_EXCEPTION="<Product id + why>"
                    ./scripts/trusted-cp-deploy-install.sh …  (receipted)
PROTECTED (never cleaned by the helper, never in guidance): reliably pinned
                (marker OR meta), legacy (no .backup-meta), rollback_used,
                unknown/absent status — counted fail-safe toward the cap.
UNCHANGED: post-verified-success prune (NORMAL_RETENTION=3, --prune
                --verified-success); #414 FIRST_RELIABLE_PIN seam (now also
                records pin_reason); backup naming/rollback compat.
```

## Receipt schema (agent-core-deploy-budget-receipt-v1)

Required fields present on every attempt: `DISK_FREE_BEFORE`,
`LIVE_TREE_BYTES`, `ESTIMATED_PEAK_BYTES`, `DISK_FREE_AFTER_RESERVATION`,
`DATA_VOLUME_TOTAL_BYTES`, `DISK_BUDGET_FLOOR_BYTES`, `verdict`,
`refusal_reason`, `retained_backups_before[]`, `retained_backups_after_
projected[]` (id/path/bytes/pinned/status/large/pin_reason each),
`pin_reasons[]`, `pin_exception_asserted`, `pin_exception_reason`,
`cleanup_guidance_exact_paths[]`, `cleanup_guidance_notes[]`,
`clone_semantics_proof`, `attempt_id`, `created_at`, floor/class provenance.

## Verification (measured at the floor-correction head on base 09de835d)

- NEW suite scripts/test-agent-core-deploy-disk-budget-v1.sh: 78/78 PASS
  (RED-first on pristine merged 09de835d: 7 floor-rule assertions failed
  before the source fix — 50 GiB default, volume-percent absence, 49 GiB
  refuse, >50 GiB admit, boundary equality, MIN-seam-only, receipt floor
  fields). Boundary equality is proven on an isolated quiescent sparse image
  so background writes cannot race the two df instants.
- Existing scripts/test-agent-core-backup-retention-v1.sh: 39/39 PASS
  (AC1–AC11 + review fixes intact — no frozen semantics disturbed).
- Round-1/2 history (75/75 at 55263a09): independent changed-surface review
  round-1 REVISE (1 blocker B1 — deploy passed dirname(TRUSTED_ROOT) as the
  helper ROOT, defeating the cap census on the real path; + 9 notes) → all
  absorbed at 55263a09 (B1 + N1–N8; N9 disposition: TAB deletion kept — raw
  TAB is invalid inside JSON strings). Round-2 verdict recorded in
  docs/evidence/w0-deploy-disk-budget-v1-20261002/REVIEW.md. Floor-correction
  changed-surface review recorded in
  docs/evidence/w0-deploy-disk-budget-floor50g-20261002/REVIEW.md.

## Rollback compatibility

No runtime code changed; the gate is deploy-time only. Removing the section
0c block from the deploy script restores the exact prior behavior (the helper
additions are unused-but-harmless without the caller). Existing backups,
pins, metadata, and the documented restore (`rm -rf live && mv $BAK back`)
are untouched.

## Boundaries of THIS lane

No production deploy/restart/sudo/credentials/data mutation; no production
backup deleted, moved, or pinned; no wildcard cleanup anywhere; suites run
only on mktemp fixtures with sparse files and threshold env seams.
