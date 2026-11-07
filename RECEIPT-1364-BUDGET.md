# #1364 admission budget — R2 delivery receipt

## Current state and authority

`DELIVERED / PR_OPEN_UNMERGED`. R1's stopped candidate was resumed by the current user's R2 mandate; the fixture failure is closed by actual execution. Source committed as `eeeaecbc312642def91598a5a91ea06d2173385f`. Ordinary push rc0 and actual GitHub readback confirm [PR #652](https://github.com/mayf3/dsh-agent-core/pull/652), base main, open and unmerged. The publication observation and final receipt commit binding are detailed below.

- Repository/worktree: `mayf3/dsh-agent-core`, `/private/tmp/h1364-budget`; branch `fix/admission-budget-fairness`; PR target `main`; no PR merge authorized.
- R1 implementation base: `3c1bcf98bc40a2c34cca24f241c87d1b12cea216`. Fresh fetched/integrated main: `55f442c74414dc723306a6d8e0cdba73d78eb8da` (includes required 55f442c7).
- Mutation mandate: Owner `owner-20261107-audit-increment-execution` ②A + preauthorization V1 §1 as recorded in the Brief, followed by the user's R2 fixture-only continuation, integration recheck and push/base-main PR instruction. This user mandate authorizes the task; it creates no Product Contract.
- Route `schema_version=2`, `PREFLIGHT / REUSE / BRIEF / DURABLE / IMPLEMENTATION`; accepted implementation authority remains WAE V3 `CTR-WAE-001b/002/004`, preserving WEC V3, D-009, UNKNOWN, fresh policy, quiescence and Owner resume. Architecture/Decisions/WAE V3/WEC V3 have no delta between the two bases. No new Spec or accepted semantic edit is needed.
- Goal: stable failed head probes cannot consume actual new-attempt budget or permanently starve a healthy tail. Budgets bound admission probes, failed probes and actual newly created attempts. Full feed discovery still restarts cursorless and pages to SHORT/error; there is no feed-row/page cap, persistent cursor, new queue/worker/store or recovery permission.
- Done When: retain real fixed-base RED; fixture repair without weakened assertions; targeted and affected suites rc0 before/after main integration; #644 influence check; structure and independent affected review; commit, push, open PR base main without merge; complete receipt.
- Expansion/stop: a new required failure or load-bearing Spec gap stops dependent work. R2 produced no such failure or gap. Production/installation/live business acceptance remain outside scope.

## R1 RED and fixture failure, preserved

The original real engine + real temporary durable ledger, with synthetic external I/O, ran at the fixed R1 base. Full raw [baseline RED](docs/evidence/1364-admission-budget-r2/in-tree-red.tap), SHA-256 `44962c6576efbf44bb731748dad3e897f199a8f983e133249b3c2d2a1b8975d0`; actual `BASELINE_RC=1`, 1 pass / 1 fail. Key unmodified lines:

```text
#1364 observations [{"round":1,"probes":25,"failures":25,"attempts":0,"deliveries":0},{"round":2,"probes":25,"failures":25,"attempts":0,"deliveries":0},{"round":3,"probes":25,"failures":25,"attempts":0,"deliveries":0}]
AssertionError [ERR_ASSERTION]: healthy tail must receive exactly one opportunity within three polls
0 !== 1
```

R1 then stopped at 6/7, rc1; [raw failed post-fix output](docs/evidence/1364-admission-budget-r2/green.tap), SHA-256 `800feb4afa8686e4336615bad2a075d244b4839e243469719a23c3f302ec7c65`. Original [R1 receipt](docs/evidence/1364-admission-budget-r2/RECEIPT-1364-R1.md) and [R1 STOP](docs/evidence/1364-admission-budget-r2/STOPPED-1364-R1.md) remain byte-preserved. Expected baseline RED is reproduction evidence; R1's later failed gate was a real stop, not waived.

## R2 exact repair and product diff

R2 changed only fixture recovery consistency: `continuation.test.js:64–65` exposes `restorePolicy(nodeVisitId)` by deleting that ID from the shared `bad` Set; line 112 invokes it instead of installing an inconsistent replacement resolver. Policy, probe tracking and delivery assertions now observe the same restored state. Every existing and new assertion is unchanged, including unavailable-policy refusal, WAL before delivery, bounded tail opportunity and no repeated tail delivery. R1 product changes were retained without further semantic modification.

| File | Integrated lines | Delta |
|---|---|---|
| `packages/workflow-execution/src/ledger-admission.js` | 7–58 | `createAdmissionBudget`: finite admission-probe S, failure F, actual-mint A budgets; process-local visited IDs; incomplete discovery commits no rotation. Existing ledger admission body is unchanged. |
| `packages/workflow-execution/src/engine.js` | 16, 55, 86, 131 | Attach budget and count the real returned ledger `created` before classifying action. |
| same | 325, 371–396 | Probe/failure/mint accounting; unknown return halts probes without classifying missing evidence as `created:false`; discovery still completes. |
| `packages/workflow-execution/test/continuation.test.js` | 27–186 | Seven regressions; R2 only repairs shared recovery state at 64–65/112. |

[Exact integrated source patch](docs/evidence/1364-admission-budget-r2/integrated-source.patch), SHA-256 `dc287eae9b46ccb35606c998e4b3df7fba6ecb9351e624e7dc171035bd15b7cb`. Tracked source delta is 224 additions / 8 deletions across 3 files. No new code path/file/module root, registry or governance configuration was added.

## Actual preintegration GREEN

```text
node --test --test-name-pattern='#1364' packages/workflow-execution/test/continuation.test.js
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5465.737041
R2_PREINTEGRATION_TARGETED_RC=0
```

Full [7/7 raw output](docs/evidence/1364-admission-budget-r2/preintegration-targeted.tap) and [command/time/hash/source metadata](docs/evidence/1364-admission-budget-r2/preintegration-targeted.json).

Then the affected existing suites were run with these explicit files (not Node v26 directory arguments):

```sh
node --test packages/workflow-execution/test/continuation.test.js packages/workflow-execution/test/engine.test.js packages/workflow-execution/test/ledger.test.js packages/workflow-execution/test/execution-control.test.js packages/workflow-execution/test/managed-obligation.test.js packages/workflow-execution/test/owner-assistance-resume-engine.test.js packages/workflow-execution/test/owner-assistance-resume.test.js packages/workflow-execution/test/recovery.test.js packages/workflow-execution/test/terminal-attempt-operations.test.js packages/workflow-execution/test/shutdown-contract.test.js packages/workflow-execution/test/runtime-ready-pagination.test.js packages/workflow-execution/test/runtime-wiring.test.js packages/workflow-execution/test/observation-cas/engine-races.test.js packages/workflow-execution/test/observation-cas/ledger-identity.test.js packages/workflow-execution/test/observation-cas/planned-reconciliation.test.js packages/workflow-execution/test/observation-cas/process-race.test.js packages/workflow-execution/test/observation-cas/readback-restart.test.js packages/workflow-execution/test/observation-cas/readback.test.js packages/workflow-execution/test/observation-cas/stale-guards.test.js packages/workflow-execution/test/observation-cas/stale-reentry.test.js
```

```text
ℹ same phase generation1 -> generation2: ID-only mismatch rejected; generation-only mismatch rejected; both rejected; exact generation committed; new attempt/event bytes unchanged on rejection
ℹ realProcessConcurrency=true; child observed generation1 before parent settled/planned/delivered generation2; child rejection did not append; same-generation parent commit succeeded
ℹ tests 219
ℹ suites 0
ℹ pass 219
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 28755.975375
R2_PREINTEGRATION_RELATED_RC=0
```

Full [219/219 raw output](docs/evidence/1364-admission-budget-r2/preintegration-related.tap) and [metadata](docs/evidence/1364-admission-budget-r2/preintegration-related.json). Node `v26.7.0`; prelinked `node_modules` preserved, no rebuild. Full repository npm test was not used. The inherited stale-quiescence version-noise exclusion is limited to that file; it waived no failed gate.

## Fresh main integration and #644 impact

Actual `git fetch origin main` rc0 yielded `55f442c74414dc723306a6d8e0cdba73d78eb8da`; required-ancestor check rc0. Because the local branch had no commits beyond the original base, the chosen integration was an actual fast-forward merge, without rebase: save the exact dirty candidate in stash `3b5a47fcdc1b1fd3b2a7a316aeb92fb9a353a542`, `git merge --ff-only 55f442c74414dc723306a6d8e0cdba73d78eb8da`, then apply that exact stash. All commands rc0; `engine.js` auto-merged with **zero conflicts**; source whitespace rc0. [Full integration command/output/rc record](docs/evidence/1364-admission-budget-r2/integration.log), [fetch raw](docs/evidence/1364-admission-budget-r2/fetch-main.log), [base coordinates](docs/evidence/1364-admission-budget-r2/integration-base.json). The safety stash is retained.

[PR #644](https://github.com/mayf3/dsh-agent-core/pull/644) is merged as `4f7df01bcf087075c114901a96a7a54573110f61`. Its [main-side engine delta](docs/evidence/1364-admission-budget-r2/main-644-engine.patch) adds `summary.recoveries = await reconcileBlocked()` (integrated line 308), destructures `reconcileBlocked` and passes `clock/config` (430–431). These remain intact. Recovery occurs before `admissionBudget.begin()` and reuses the original attempt, with a separate `maxRecoveryChecksPerPoll` and default OFF; this due-admission A budget does not count recovery of an existing attempt. No recovery/WAL/CAS/UNKNOWN contract was changed. Three new blocked-recovery suites from #644 are included in the integrated run below.

## Exact integrated candidate and executed GREEN

Test-coordinate commit object `3e15d880bf10ab3569174f56fb8b8065a36a4517` was created without moving the branch, from main plus only the 3 source/test edits. Its entire tree `3285e503e7b8a676674f456da61257659557b4e1` equals the later actual source commit `eeeaecbc312642def91598a5a91ea06d2173385f`; packages subtree `bed9e634b5fcaca49928c6fa75663439dd9d968c`. [Candidate metadata](docs/evidence/1364-admission-budget-r2/integrated-candidate.json), [commit/tree equality](docs/evidence/1364-admission-budget-r2/implementation.json).

Unmodified targeted stdout (full):

```text
#1364 observations [{"round":1,"probes":25,"failures":25,"attempts":0,"deliveries":0},{"round":2,"probes":1,"failures":0,"attempts":1,"deliveries":1},{"round":3,"probes":25,"failures":25,"attempts":1,"deliveries":1}]
✔ #1364 RED/GREEN: 25 stable pre-plan failures cannot starve the healthy 26th intent for three polls (617.991083ms)
✔ #1364 control: 24 stable pre-plan failures leave the healthy 25th reachable (269.00775ms)
✔ #1364 bounded rotation passes 250 abnormal heads across pages and returns to repaired heads (3047.387917ms)
✔ #1364 scan cap also bounds already-attempted ledger probes; refusals are not new attempts (450.15525ms)
✔ #1364 minted delivery failures still consume the actual new-attempt budget (93.087417ms)
✔ #1364 unknown post-mint exception halts probes but preserves exhaustive discovery and the fence (175.137542ms)
✔ #1364 incomplete discovery commits no probe rotation; the next sweep retries from page one (597.586833ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5294.097917
R2_INTEGRATED_TARGETED_RC=0
```

Full [targeted raw](docs/evidence/1364-admission-budget-r2/integrated-targeted.tap) and [metadata](docs/evidence/1364-admission-budget-r2/integrated-targeted.json).

Integrated related suites, **23 explicit files**, including blocked-recovery, restart and refusal:

```sh
node --test packages/workflow-execution/test/continuation.test.js packages/workflow-execution/test/engine.test.js packages/workflow-execution/test/ledger.test.js packages/workflow-execution/test/execution-control.test.js packages/workflow-execution/test/managed-obligation.test.js packages/workflow-execution/test/owner-assistance-resume-engine.test.js packages/workflow-execution/test/owner-assistance-resume.test.js packages/workflow-execution/test/recovery.test.js packages/workflow-execution/test/terminal-attempt-operations.test.js packages/workflow-execution/test/shutdown-contract.test.js packages/workflow-execution/test/runtime-ready-pagination.test.js packages/workflow-execution/test/runtime-wiring.test.js packages/workflow-execution/test/observation-cas/blocked-recovery-restart.test.js packages/workflow-execution/test/observation-cas/blocked-recovery.test.js packages/workflow-execution/test/observation-cas/blocked-refusal.test.js packages/workflow-execution/test/observation-cas/engine-races.test.js packages/workflow-execution/test/observation-cas/ledger-identity.test.js packages/workflow-execution/test/observation-cas/planned-reconciliation.test.js packages/workflow-execution/test/observation-cas/process-race.test.js packages/workflow-execution/test/observation-cas/readback-restart.test.js packages/workflow-execution/test/observation-cas/readback.test.js packages/workflow-execution/test/observation-cas/stale-guards.test.js packages/workflow-execution/test/observation-cas/stale-reentry.test.js
```

Unmodified summary:

```text
ℹ same phase generation1 -> generation2: ID-only mismatch rejected; generation-only mismatch rejected; both rejected; exact generation committed; new attempt/event bytes unchanged on rejection
ℹ realProcessConcurrency=true; child observed generation1 before parent settled/planned/delivered generation2; child rejection did not append; same-generation parent commit succeeded
ℹ tests 265
ℹ suites 0
ℹ pass 265
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 33627.825833
R2_INTEGRATED_RELATED_RC=0
```

Full [265/265 raw stdout](docs/evidence/1364-admission-budget-r2/integrated-related.tap), SHA-256 `86e1a3bb256b2f5b0ab926f2b940a8e8cbdd17cb430015bd3af86b06ead13861`; [command/time/rc/source metadata](docs/evidence/1364-admission-budget-r2/integrated-related.json). Tests include existing continuation starvation, fence/WAL/UNKNOWN, Owner resume, ledger/CAS/process/restart races, managed policy, shutdown and runtime wiring. These prove isolated source behavior, not production admission or unattended live business results.

## Structure and independent review

```sh
node scripts/verify-code-structure.mjs --base 55f442c74414dc723306a6d8e0cdba73d78eb8da --head 3e15d880bf10ab3569174f56fb8b8065a36a4517 --json
```

Actual rc0. [Complete unmodified JSON](docs/evidence/1364-admission-budget-r2/integrated-structure.json.txt), [stderr](docs/evidence/1364-admission-budget-r2/integrated-structure.stderr), [command/time/rc/hashes](docs/evidence/1364-admission-budget-r2/integrated-structure.command.json):

```text
governing_authority.id = CODE_STRUCTURE_GUARDRAILS_V3
candidate_result = CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT
candidate_violations = 0
baseline_debt = 28
resolved_debt = 0
R2_INTEGRATED_STRUCTURE_RC=0
```

Actual physical lines: engine 489, ledger-admission 153, continuation test 446. The 28 historical findings remain visible; this is not debt-free repository-wide PASS. README's pending-verifier operational description is stale: fresh main contains `fc518e58170b0baf4e5ce877f1b8c7075cffdb31` and its current V3-aware runner. Independent review corrected the initial README-only inference; this actual execution used the already adapted runner, with no governance/tool edits.

[Independent affected-contract review](docs/evidence/1364-admission-budget-r2/REVIEW-1364-R2.md) by `/root/budget_review` binds the exact tested candidate/base: PASS, blockers=0, Spec gaps=0, author independence PASS, #644 influence and fixture assertions verified. The [prepublication final-HEAD delta review](docs/evidence/1364-admission-budget-r2/REVIEW-1364-R2-PREPUBLICATION.md) passed at `63c075f045ffc2872088169bc1541f55c2e6fc51`; actual push/PR observations follow. The receipt-completion HEAD is bound by the subsequent final delta review and PR metadata, avoiding a self-referential commit claim.

## Done When and limits

| Requirement | Actual |
|---|---|
| Fixed-base real RED retained | DONE, expected rc1, raw preserved |
| Only inconsistent fixture repaired, assertions preserved | DONE, independently reviewed |
| Targeted 7/7 + affected suites before integration | DONE, 7/7 and 219/219 rc0 |
| Fetch main 55f442c7+, integrate, #644 impact | DONE, actual fast-forward merge/apply rc0, no conflict |
| Integrated targeted + related suites | DONE, 7/7 and 265/265 rc0 |
| Structure / independent affected review | DONE, candidate violations0 with visible debt28; independent PASS |
| Commit / push / PR base main, no merge | DONE: source eeeaecbc, initial publication 63c075f0 push rc0; PR #652 open/unmerged, base main |
| Receipt with RED/GREEN/integrated originals | DONE; hashes in evidence SHA256SUMS.txt |

Current delivery readiness: `PR_DELIVERY_READY=YES`; final receipt-only delta is rebound in PR metadata; `MERGE_READY=NO` (forbidden by task), `OPERATION_ALLOWED=NO`. Production writes=0; dependency rebuild=0; rebase=0; candidate edits to governance/`.agents/tools`=0. Main's inherited changes are integration provenance, not this candidate's authored delta. No installation, production enablement, external business mutation or physical/runtime acceptance is claimed.

## Actual publication and receipt completion

- Source commit: `eeeaecbc312642def91598a5a91ea06d2173385f`.
- Prepublication documentation HEAD: `63c075f045ffc2872088169bc1541f55c2e6fc51`; independent final-HEAD DELTA PASS, unchanged packages/source/test hashes and all evidence verified.
- Fresh prepublication remote main readback: `55f442c74414dc723306a6d8e0cdba73d78eb8da`, matching the tested integrated base; [raw readback](docs/evidence/1364-admission-budget-r2/prepublication-remote.log) and [command/time/rc](docs/evidence/1364-admission-budget-r2/prepublication-remote.command.json).
- Actual ordinary `git push -u origin fix/admission-budget-fairness` returned rc0, creating the branch at `63c075f045ffc2872088169bc1541f55c2e6fc51`; [raw output](docs/evidence/1364-admission-budget-r2/initial-push.log), [command/time/rc](docs/evidence/1364-admission-budget-r2/initial-push.command.json).
- Actual GitHub create-PR readback at `2026-11-07T09:05:57Z`: [PR #652](https://github.com/mayf3/dsh-agent-core/pull/652), `state=open`, `merged=false`, `draft=false`, `base=main`, `base_sha=55f442c74414dc723306a6d8e0cdba73d78eb8da`, `head=fix/admission-budget-fairness`, `head_sha=63c075f045ffc2872088169bc1541f55c2e6fc51`; [complete normalized response](docs/evidence/1364-admission-budget-r2/pr-created.json). Its immediate mergeability field was not used as acceptance or conflict proof.
- This final edit closes the receipt with observations made after publication; it changes only documentation/evidence. The final containing commit, its ordinary follow-up push rc, independent DELTA recheck and fresh PR head/open/unmerged readback are recorded in the PR body and final handoff after they occur. This avoids writing a commit's own hash into its contents. No unchanged product suite is rerun for this document delta.

All user-requested implementation/integration gates passed. No new failure stop occurred in R2. Merge and production operations remain forbidden and unperformed.
