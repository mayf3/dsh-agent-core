# RED/GREEN — fixed 50 GiB disk floor correction (Product #430, 2026-10-02)

Authority: Owner policy 2026-10-02 on #386 (invariant §3) and #430 ("Owner
disk-floor update"): post-reservation free-space floor = FIXED 50 GiB; the
earlier `max(60 GiB, 10% of Data volume)` rule is superseded; no
volume-percent term remains; retention cap and all other gate semantics
unchanged.

## RED (suite against pristine merged source 09de835d, tests already updated)

`bash scripts/test-agent-core-deploy-disk-budget-v1.sh` → PASS=71 FAIL=7,
SUITE FAILED. The 7 failures are exactly the superseded-formula assertions:

1. floor default FIXED 50 GiB (53687091200) not found in helper source
   (source still had 64424509440 / 60 GiB).
2. superseded volume-percent floor term STILL PRESENT in helper source.
3. G2 receipt arithmetic/floor wrong — 49 GiB-projected-free fixture was
   refused under the old formula but the receipt floor ≠ 53687091200.
4. G2a expected admit (51 GiB projected free), got rc=4 REFUSED_DISK_BUDGET
   under the old formula (10%-of-volume term dominated).
5. G2a receipt wrong (same root cause as 4 — old floor asserted).
6. G2b boundary equality refused rc=4 (old floor > free_after).
7. G2b floor=99461015552 != seam 54760816640 (old max() ignored the MIN-only
   fixed-floor contract).
   All non-floor groups (G1, G2c refusal-with-exception, G2d/G2e, G3
   worst-case allocation, G4 cap matrix, G5 cleanup-exact, G6 idempotency,
   G7 deploy statics, G8 pin metadata, G9 fresh install) stayed green under
   the old source — the RED set is precisely the floor-rule delta.

## GREEN (same suite after the source fix)

`bash scripts/test-agent-core-deploy-disk-budget-v1.sh` → PASS=78 FAIL=0,
SUITE PASSED (three consecutive runs — the boundary-equality probe is
deterministic on an isolated quiescent sparse image, immune to shared-volume
df drift that flipped a naive equality probe).

Coverage added/changed, mapping to the required proof:

- 49 GiB projected free REFUSES at the DEFAULT floor (no env): G2
  (self-calibrating sparse fixture; receipt binds floor==53687091200,
  free_after<floor, free_after within 49 GiB ± 2 GiB; refusal created no
  backup; live tree intact).
- 50 GiB boundary ADMITS: G2b — free_after == floor exactly, proven on a
  freshly mounted 2 GiB sparse image (no background writers → deterministic
  equality); receipt asserts verdict ADMITTED with floor == free_after.
- >50 GiB ADMITS: G2a — 51 GiB projected free at the default floor.
- Data-volume size no longer changes the floor: G0 static —
  `BUDGET_FLOOR_VOLUME_PERCENT` ABSENT from helper source (the only floor
  input is AGENT_CORE_BUDGET_FLOOR_MIN_BYTES / the 50 GiB default), plus
  G2/G2a receipts showing DISK_BUDGET_FLOOR_BYTES == 53687091200
  independent of DATA_VOLUME_TOTAL_BYTES (still recorded as context only).
- Existing retention/pinned/cleanup/idempotency tests remain green:
  scripts/test-agent-core-backup-retention-v1.sh → 39 passed, 0 failed
  (AGENT_CORE_BACKUP_RETENTION_V1_TESTS = PASS, repo at the correction
  head); in-suite G4 cap matrix / G5 cleanup-exact guards / G6 idempotency
  all green.

PRODUCTION_MUTATION = NO in this lane (fixtures only: /tmp mktemp dirs,
sparse files, one ephemeral 2 GiB sparse image mounted detached within the
suite run).
