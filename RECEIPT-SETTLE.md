# RECEIPT-SETTLE

2026-11-04 · SOURCE / ISOLATED VALIDATION COMPLETE · production access NONE.

## Coordinates and authority

- Worktree: `/private/tmp/dsh-fleet-window-tools`; branch: `chore/fleet-window-tools`.
- Base: `b40a495dce664b4f95463849f8937e08c8c072f6` (fresh origin/main readback).
- Reviewed semantic commit: `e2fdeffcf77d48cbfe00030843833e6b6090a052`.
- Route: REUSE / BRIEF / DURABLE; implementation only. Mandate: user's contract in
  [BRIEF-SETTLE.md](BRIEF-SETTLE.md). Commit/push/PR authorized; merge and production prohibited.
- Accepted authority in base: `AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1`
  CTR-527D2-002/003/004; parent D-009; Owner #527 ruling
  <https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788>.

## Delivered diffs

The complete two-script additions and executor diff are preserved in
[implementation.patch](docs/evidence/fleet-window-settle-20261104/implementation.patch).

- [settle_unresolved_runtime_down.mjs](scripts/fleet-window/settle_unresolved_runtime_down.mjs):
  parameterized source imports; fresh stage_05 receipt/store hash/epoch and repeated ps gates;
  only unknown with its own exact durable `child_real_exit` observation uses official
  `settleLate(terminated_without_outcome, child_real_exit)`.
  No `settleDirect(failed)` branch. No persistence-bearing constructor. Official
  `writeDurableRecoveryStore` generates the candidate; untouched raw rows and historical
  answer hashes are retained before validation and fsync/rename publication.
  No selected record means no durable write. Any remaining/unavailable state returns 5.
- [precheck_zero_inflight.mjs](scripts/fleet-window/precheck_zero_inflight.mjs): read-only
  `readRestartDrainCensus`, using default authsvc control recovery and scheduler jobs paths,
  with explicit fixture overrides. Outputs the three lists; all empty=0, nonempty=1.
  Missing/invalid/changed inputs produce null lists + UNKNOWN and exit 1, never a false empty PASS.
- [window-executor-v5.sh](scripts/fleet-window/window-executor-v5.sh): only stage_05b changed;
  same-directory Git script, `--source-root "$SOURCE"`, `--stage-05-receipt-dir "$RD"`;
  comment now reads `per AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1`.
  All other stage functions and the 15-node execution order are unchanged.

## Executed evidence

Fixture directory: `/usr/local/v5-boot-isolation/settle-test/run-qSJKXn/`.
All stores were generated synthetically; no production store was opened or copied.
ps inputs in synthetic settlement tests are injected simulated observations.
These tests prove the mechanism, not actual worker death or a live recovery.

| Required scenario | Actual result | Script exit | Authoritative writes |
| --- | --- | --- | --- |
| unknown + trusted exact termination | `initialOutcome=outcome_unknown`, `outcome=null`, `lateOutcome=terminated_without_outcome`, `terminationEvidence=child_real_exit` | 0 | 1 |
| non-unknown | PASS: original bytes, inode, timestamps and row unchanged | 5 | 0 |
| unknown without exact evidence | PASS: original UNKNOWN, bytes, inode and timestamps unchanged | 5 | 0 |

The same sequential run passed **16/16 scenarios, 0 failed** (Node runner: one top-level test,
**1/1 PASS**, rc=0). Additional checks covered mixed-store untouched rows and answer digests,
issuance/correlation preservation, repeated invocation zero-write, live-worker/stale/mismatched
epoch/bare-label/old-epoch refusal, missing CLI proof, and function + CLI three-list precheck.
Expected refusal exit codes 1/5 are test PASS results, not failed runs.

- [Raw synthetic output](docs/evidence/fleet-window-settle-20261104/synthetic-test.stdout.log)
- [Actual scenario reports](docs/evidence/fleet-window-settle-20261104/fixture-report.json)
- [Exact fixture stores and snapshots](docs/evidence/fleet-window-settle-20261104/synthetic-fixtures.tar.gz)
- [Commands, return codes and log hashes](docs/evidence/fleet-window-settle-20261104/verification-commands.json)
- [Source/evidence SHA-256 manifest](docs/evidence/fleet-window-settle-20261104/SHA256.json)

Both new scripts and the test passed `node --check`; executor `bash -n`, `git diff --check`
and accepted-governance integrity check all returned 0.

Existing `window-executor-v5.sh --selftest` returned 0:
`PASS_ISOLATED_CHECKS_AND_STDIO_CANARY`, `windowGO=false`;
receipt directory `/usr/local/v5-boot-isolation/c7-selftest-mah0t7yr/`.
[Raw selftest output](docs/evidence/fleet-window-settle-20261104/executor-selftest.stdout.log).
Production stages and full runtime were NOT_EXECUTED.

Structure gate at the reviewed semantic commit returned 0:
`CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT`, candidate violations=0,
unchanged baseline debt=29, resolved=0. This is not a global clean-repository claim.
[Raw structure report](docs/evidence/fleet-window-settle-20261104/structure.stdout.json).

Independent reviewer `/root/settle_review` did not author the semantic delta:
**PASS**, frozen blocker union `[]`, blockers=0, spec gaps=0.
[Review record](docs/evidence/fleet-window-settle-20261104/independent-review.md).
Final receipt/log-only Head receives a separate independent delta readback.

## UNKNOWN and retained scope

- Business outcome remains UNKNOWN after termination-only settlement. No replay/retry,
  Scheduler occurrence/fence rewrite or runtime admission was executed here.
- Production access/read/write=NONE. Installation, live termination, runtime reconciliation,
  zero-inflight production state and business effects are UNKNOWN / NOT_RUN.
- The existing `window_helper.py` quiet branch still invokes `/tmp/settle-all-pending.mjs`
  before shutdown. It was found and reported, and scope clarification was requested.
  It is retained because the contract preserves the other nodes; no response expanding
  scope had arrived at this receipt. This source delivery does **not** establish retirement
  of every old call path or authorize a production window. mtime quiet is not termination proof.
- No verification failed, so no `STOPPED-SETTLE.md` was created. No merge or deployment.
