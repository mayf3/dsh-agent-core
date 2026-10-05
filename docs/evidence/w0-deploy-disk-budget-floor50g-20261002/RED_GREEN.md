# RED/GREEN — fixed 50 GiB disk floor correction (Product #430, 2026-10-02)

Authority: Owner policy 2026-10-02 on #386 (invariant §3) and #430 ("Owner
disk-floor update"): post-reservation free-space floor = FIXED 50 GiB; the
earlier `max(60 GiB, 10% of Data volume)` rule is superseded; no
volume-percent term remains; retention cap and all other gate semantics
unchanged.

## RED (final suite executed against pristine merged source 09de835d)

The RED state of the COMMITTED suite was executed by restoring
`git show 09de835d:scripts/agent-core-backup-ops.sh` (helper sha256
245d4dc9… == the 09de835d blob) and running the committed suite unmodified:

`bash scripts/test-agent-core-deploy-disk-budget-v1.sh` → PASS=73 FAIL=5,
SUITE FAILED. The 5 failures are exactly the default-floor/static assertions
that discriminate the fixed 50 GiB rule:

1. floor default FIXED 50 GiB (53687091200) not found in helper source
   (source still had 64424509440 / 60 GiB).
2. superseded volume-percent floor term STILL PRESENT in helper source.
3. G2 receipt arithmetic/floor wrong — 49 GiB-projected-free fixture was
   refused under the old formula but the receipt floor ≠ 53687091200.
4. G2a expected admit (51 GiB projected free), got rc=4 REFUSED_DISK_BUDGET
   under the old formula (10%-of-volume term dominated: ~10% of the ~926 GiB
   Data volume ≈ 92.6 GiB > free_after).
5. G2a receipt wrong (same root cause as 4 — old floor asserted).

By construction the G2b boundary-equality probe passes under BOTH formulas:
it drives the floor via the AGENT_CORE_BUDGET_FLOOR_MIN_BYTES seam (set to
the isolated image's exact projected free, which dominates the old max()'s
volume term), so it pins the gate's `>=` boundary SEMANTICS (free_after ==
floor admits), not the floor VALUE. The floor VALUE is pinned by G0's two
static greps and G2/G2a's no-env receipt asserts (floor == 53687091200) —
the five assertions above. (History: an earlier shared-volume variant of
the boundary probe captured a 71/7 RED on the first run; that variant was
replaced during GREEN stabilization by the deterministic isolated-image
probe, and the committed suite's own RED — recorded above — is 73/5.)

GREEN (same committed suite, corrected source): PASS=78 FAIL=0, three
consecutive runs.

## GREEN (same suite after the source fix)

`bash scripts/test-agent-core-deploy-disk-budget-v1.sh` → PASS=78 FAIL=0,
SUITE PASSED (three consecutive runs — the boundary-equality probe is
deterministic on an isolated quiescent sparse image, immune to shared-volume
df drift that flipped a naive equality probe).

Coverage added/changed, mapping to the required proof:

- 49 GiB projected free REFUSES at the DEFAULT floor (no env): G2
  (self-calibrating sparse fixture; receipt binds floor==53687091200,
  free_after<floor, free_after within 49 GiB ± 2 GiB; refusal created no
  backup; live tree intact). RED-verified (failure 3).
- 50 GiB boundary ADMITS: G2b — free_after == floor exactly, proven on a
  freshly mounted 2 GiB sparse image (no background writers → deterministic
  equality); receipt asserts verdict ADMITTED with floor == free_after.
- >50 GiB ADMITS: G2a — 51 GiB projected free at the default floor.
  RED-verified (failures 4+5).
- Data-volume size no longer changes the floor: G0 static —
  `BUDGET_FLOOR_VOLUME_PERCENT` ABSENT from helper source (the only floor
  input is AGENT_CORE_BUDGET_FLOOR_MIN_BYTES / the 50 GiB default), plus
  G2/G2a receipts showing DISK_BUDGET_FLOOR_BYTES == 53687091200
  independent of DATA_VOLUME_TOTAL_BYTES (still recorded as context only).
  RED-verified (failures 1+2).
- Existing retention/pinned/cleanup/idempotency tests remain green:
  scripts/test-agent-core-backup-retention-v1.sh → 39 passed, 0 failed
  (AGENT_CORE_BACKUP_RETENTION_V1_TESTS = PASS, repo at the correction
  head); in-suite G4 cap matrix / G5 cleanup-exact guards / G6 idempotency
  all green.

PRODUCTION_MUTATION = NO in this lane (fixtures only: /tmp mktemp dirs,
sparse files, one ephemeral 2 GiB sparse image mounted detached within the
suite run).
