# INDEPENDENT_CHANGED_SURFACE_REVIEW — fixed 50 GiB floor correction (Product #430, 2026-10-02)

REVIEWER_IDENTITY = W0_DEPLOY_DISK_BUDGET_FLOOR50G_20261002_REVIEW
  (independent review run, same repo REVIEW record format as
  w0-deploy-disk-budget-v1-20261002/REVIEW.md)
REVIEWED_COMMIT = 46ea1d2b (branch w0-release-safety-430-floor50g,
  base = origin/main 09de835d, the PR #431 merge head)
REVIEW_SCOPE = git diff 09de835d..46ea1d2b (7 files: helper, deploy
  installer, disk-budget suite, packet README/RUNBOOK/MANIFEST, RED_GREEN
  evidence) + both suites executed fresh by the reviewer.

## VERDICT = PASS

SHIP_BLOCKERS = NONE

## Reviewer's mechanical verification (summary)

1. FLOOR RULE: BUDGET_FLOOR_MIN_BYTES_DEFAULT=53687091200 (helper:135);
   `local floor="$min_b"` (helper:539) — no other term; only floor inputs are
   the default + AGENT_CORE_BUDGET_FLOOR_MIN_BYTES; BUDGET_FLOOR_VOLUME_PERCENT
   appears repo-wide ONLY in the test's absence assertion, README supersession
   notes, and RED_GREEN evidence; vol_total still measured/receipted as
   context; unset-seam probe produced floor=53687091200 with floor_min=defaults.
2. NO RETENTION DRIFT: helper diff = 4 hunks (header comment, defaults,
   budget_thresholds, the read/floor/floor_source lines in do_check_budget);
   cap arithmetic, census, guidance, --cleanup-exact guards, prune, pin
   metadata byte-identical to 09de835d; budget_thresholds single caller
   updated; zero remaining consumers of the removed pct/psrc variables.
3. RECEIPT SHAPE: only floor_source's VALUE text changed vs 09de835d; all
   agent-core-deploy-budget-receipt-v1 required fields still emitted; JSON
   validity exercised by the suite on every receipt.
4. DEPLOY PATH: trusted-cp-deploy-install.sh diff is ONE comment-only hunk;
   gate call order/args, MUTATION TRUTH refusal (exit 2), helper-missing
   fail-closed, pin-exception propagation all unchanged.
7. PACKET: README/RUNBOOK/STATUS internally consistent; remaining "max(60"/
   "10%" mentions are supersession notes; MANIFEST verified OK
   (shasum -a 256 -c); historical evidence dir w0-deploy-disk-budget-v1-
   20261002 untouched; no spec file touched.
8. SMALLEST-CORRECTION: diff confined to the floor rule + tests/docs/packet.
9. FAIL-CLOSED AUDIT: garbage MIN-seam now refuses (rc=4, fail-closed) —
   strictly better than 09de835d where awk coerced garbage to floor=0 and
   ADMITTED (fail-open); see reviewer note 1 below.

## SUITES (reviewer-executed, at 46ea1d2b)

- test-agent-core-deploy-disk-budget-v1.sh: PASS=78 FAIL=0, SUITE PASSED
  (twice — boundary probe stable across runs).
- test-agent-core-backup-retention-v1.sh: 39 passed, 0 failed
  (AGENT_CORE_BACKUP_RETENTION_V1_TESTS = PASS).
- MANIFEST.sha256: both entries OK. bash -n clean on all three scripts.

## RED_AUDIT (reviewer)

RED_GREEN's RED claims verified mechanically against
`git show 09de835d:scripts/agent-core-backup-ops.sh`: each claimed failing
assertion fails under the old formula; 78-assertion arithmetic consistent.

## Non-blocking notes (reviewer) + absorption

1. Garbage MIN-seam: gate refuses loudly (rc=4, fail-closed, improved vs
   base) but writes `DISK_BUDGET_FLOOR_BYTES: <garbage>` raw into the
   receipt JSON on that hand-misconfiguration path (unparseable receipt).
   ABSORBED AS: recorded, deferred — numeric-validation guard is a scope
   expansion beyond the smallest floor correction; reachable only via a
   hand-misconfigured seam; refusal is loud on stderr; nothing parses the
   receipt programmatically on refusal.
2. RED_GREEN item-7 figures quoted the earlier shared-volume boundary
   variant. ABSORBED IN FULL: the RED state of the COMMITTED suite was then
   executed for real (restored 09de835d helper, sha-verified) → actual RED
   = PASS=73 FAIL=5 (G0 x2 + G2 receipt + G2a rc + G2a receipt); RED_GREEN
   rewritten to the executed truth, including why the boundary probe is
   floor-value-agnostic by construction. Evidence-only; zero semantic delta
   to 46ea1d2b's source/test/packet bytes.
3. Boundary probe relies on the mounted image being quiescent (Spotlight
   could in principle allocate between the two df instants); stable across
   reviewer x2 + author x3 runs; acceptable.
4. STATUS flip to AUTHORIZED_STANDING-PENDING-MERGE is keyed to the cited
   #386/#430 Owner policy of 2026-10-02; consistent with the authority
   context; not independently verifiable from the repo alone.
5. Historical README/RUNBOOK claims correctly preserved as history, not
   rewritten.

## Disposition

SEMANTIC_CHANGE_AFTER_REVIEW = NONE (post-review commit touches ONLY
docs/evidence/w0-deploy-disk-budget-floor50g-20261002/{RED_GREEN.md,
REVIEW.md}; source/test/packet bytes remain exactly the reviewed 46ea1d2b).
Delivery proceeds under the #386 standing production authority once merged.
