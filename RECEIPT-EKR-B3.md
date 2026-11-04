# RECEIPT — EKR P0-B3 — STOPPED

Status: **REQUIRED_GATE_FAILURE / B3-REVIEW-001**. Acceptance and delivery NO.
Recorded UTC: 2026-11-04T17:38:34.130157+00:00

- Worktree: `/private/tmp/dsh-ekr-b3`; branch: `ac-ekr-b3`.
- Base SHA: `9f04db29cce44a684b4409fa63b436aaf10dfa52`.
- Source/test candidate HEAD: `f31ba0ea8033ffe97363ba001cc8772154b6f320` (local commit).
- Receipt, stop record and raw evidence are retained locally as untracked artifacts after the stop; no post-stop source/test commit.
- Governing authority: accepted WAE V3 CTR-WAE-002/004/005/006/011/012/013; D-009; WEC V3. Route: REUSE / BRIEF / DURABLE; source only.
- Work order: [agent-control #1374](https://github.com/mayf3/agent-control/issues/1374), P0-B3.
- PR URL: **NOT_CREATED**; push: **NOT_ATTEMPTED**; merge: **NOT_ATTEMPTED** under the explicit failure-stop redline.

## Failure and stop

The candidate's third fault-injection fixture omits `markAdmitted` and
`markPromptWriteAttempted` before `markPromptReceipt`. The original durable
receipt after reopening says `not_admitted / prompt_write_not_attempted`,
contradicting the required accepted-but-caller-receipt-lost precondition.
Seven passing assertions are therefore **not** three-position acceptance PASS.
See [STOPPED-EKR-B3.md](STOPPED-EKR-B3.md) and
[independent exact-head review](docs/evidence/ekr-b3/independent-review.txt).
No further source/test fixes or reruns were made after that finding.

Minimal continuation, if subsequently authorized: correct the sender fixture's
real protocol order, bind new evidence to the new exact SHA, and independently
review the affected delta. The reviewer's separate corrected-protocol experiment
supports this narrow repair; it is not this candidate's acceptance evidence.

## Implemented candidate and responsibility boundary

The candidate stamps new planned WAL records, excludes historical unmarked
planned from non-send proof, checks the exact original request and receipt,
and exposes read-only NOT_SENT / ACCEPTED / UNKNOWN classification on existing
startup/poll reconciliation and `engine.reconcileDeliveries()`. Repeated polls
also enumerate retained terminal `delivery_unverified` attempts. No new request,
retry, terminal state, ledger, business operation, or recovery eligibility is
created. The classification reads under the admission lock without repairing
a torn tail. Existing WAE terminal judgment writing is a separate unchanged
operation; source safety review found no separate concrete blocker.

| Evidence situation | Classification | Retained responsibility |
|---|---|---|
| Marked WAL before delivery fence + exact empty never_existed | NOT_SENT, resumeAuthorized=false | Explicit controlled resolution; classification is not a resend permit |
| Exact original Router message receipt | ACCEPTED, businessOutcome=UNKNOWN | Wait/read original receipt or reconcile, no replay |
| Started fence with no exact receipt; historical/malformed/lost/unavailable correlation | UNKNOWN | Original request readback or escalation, no replacement request |

State remains `NEEDS_REVIEW/delivery_unverified` under WAE CTR-006 for these
missing-linkage attempts. Responsibility visibility/readback does not constitute
automatic recovery, a reliable human delivery proof, or business completion.

## Actual validation results

| Command | rc | Recorded result |
|---|---:|---|
| `EKR_SOURCE_SHA=f31ba0ea8033ffe97363ba001cc8772154b6f320 node --test packages/workflow-execution/test/observation-cas/planned-reconciliation.test.js` | 0 | 7 pass / 0 fail; third-position precondition invalid; acceptance FAIL |
| `EKR_SOURCE_SHA=f31ba0ea8033ffe97363ba001cc8772154b6f320 node --test packages/workflow-execution/test/*.test.js packages/workflow-execution/test/observation-cas/*.test.js` | 0 | 285 pass / 0 fail |
| `npm run test:scheduler` | 0 | 454 pass / 0 fail |
| `npm run test:scheduler-router` | 0 | 40 pass / 0 fail |
| `node scripts/verify-code-structure.mjs --base 9f04db29cce44a684b4409fa63b436aaf10dfa52 --head f31ba0ea8033ffe97363ba001cc8772154b6f320 --json` | 0 | CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT; 28 inherited debt entries |
| `git diff --check` | 0 | Empty output |
| `git diff --cached --check` | 0 | Empty output |

All regression commands had finished before the stop. Raw outputs:
[Workflow](docs/evidence/ekr-b3/workflow.raw.txt),
[Scheduler](docs/evidence/ekr-b3/scheduler.raw.txt),
[Scheduler-Router](docs/evidence/ekr-b3/scheduler-router.raw.txt),
[structure full original JSON](docs/evidence/ekr-b3/structure.raw.txt),
[diff checks](docs/evidence/ekr-b3/diff-checks.raw.txt).
Environment: macOS local isolated worktree, Node v26.7.0, npm 11.19.0;
71 local dependencies installed using `npm install --ignore-scripts
--package-lock=false --no-audit --no-fund`. No package manifest/lock delta.
Faults use a memory sender, actual fsynced temporary ledger and reopened
isolated durable Router store; exception interruption, not OS process kill,
not deployed multi-service E2E and not production acceptance.

## Diff

[Full candidate diff](docs/evidence/ekr-b3/candidate.diff).

```text
 BRIEF-EKR-B3.md                                    |  70 ++++++++
 packages/workflow-execution/src/engine.js          |  12 ++
 packages/workflow-execution/src/ledger-events.js   |   1 +
 packages/workflow-execution/src/ledger-plan.js     |   4 +-
 packages/workflow-execution/src/ledger.js          |  12 ++
 packages/workflow-execution/src/projection.js      |  46 +++++
 .../observation-cas/planned-reconciliation.test.js | 191 +++++++++++++++++++++
 7 files changed, 335 insertions(+), 1 deletion(-)
```

## Three-position original fault output (verbatim, includes invalid third precondition)

```text
{"sourceSha":"f31ba0ea8033ffe97363ba001cc8772154b6f320","testName":"B3-before_delivery","faultInjection":"before_delivery","initialState":{"phase":"planned","wal":[{"kind":"attempt_planned","attemptId":"wfeat-b05e0a0f82bf83095b98cdf6","deliveryProtocol":"write_ahead_v1","nodeVisitId":"0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11","dispatchIntentId":"2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33","workflowInstanceId":"4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55","ownerPrincipalId":"5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66","atMs":1700000000000}]},"expectedResult":"NOT_SENT","actualResult":{"nodeVisitId":"0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11","attemptId":"wfeat-b05e0a0f82bf83095b98cdf6","generation":1,"requestId":"wfeat-b05e0a0f82bf83095b98cdf6","classification":"NOT_SENT","businessOutcome":"UNKNOWN","resumeAuthorized":false,"responsibility":"explicit_controlled_resolution","reason":"wal_before_delivery_fence","observedAtMs":1700000000100},"originalSends":0,"restartSends":0,"originalCorrelationReads":3,"rawReceipt":{"state":"never_existed"},"finalResponsibility":{"state":"NEEDS_REVIEW","judgment":"delivery_unverified"},"readOnlyLedgerUnchanged":true,"readOnlyRouterUnchanged":true}
✔ B3 fault injection: before_delivery -> NOT_SENT, same responsibility and zero restart delivery (161.957667ms)
{"sourceSha":"f31ba0ea8033ffe97363ba001cc8772154b6f320","testName":"B3-during_delivery","faultInjection":"during_delivery","initialState":{"phase":"delivery_started","wal":[{"kind":"attempt_planned","attemptId":"wfeat-b05e0a0f82bf83095b98cdf6","deliveryProtocol":"write_ahead_v1","nodeVisitId":"0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11","dispatchIntentId":"2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33","workflowInstanceId":"4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55","ownerPrincipalId":"5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66","atMs":1700000000000},{"nodeVisitId":"0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11","atMs":1700000000000,"kind":"delivery_started","workflowInstanceId":"4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55"}]},"expectedResult":"UNKNOWN","actualResult":{"nodeVisitId":"0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11","attemptId":"wfeat-b05e0a0f82bf83095b98cdf6","generation":1,"requestId":"wfeat-b05e0a0f82bf83095b98cdf6","classification":"UNKNOWN","businessOutcome":"UNKNOWN","resumeAuthorized":false,"responsibility":"original_request_readback_or_escalation","reason":"delivery_started_without_exact_receipt","observedAtMs":1700000000100},"originalSends":1,"restartSends":0,"originalCorrelationReads":3,"rawReceipt":{"state":"settled","handle":"turn:original-epoch:a1:g1:s1","snapshot":{"handle":"turn:original-epoch:a1:g1:s1","turnExecutionId":"turn:original-epoch:a1:g1:s1","runtimeEpoch":"original-epoch","agentId":"agt_target-agent","processGeneration":1,"callerCorrelation":{"requestId":"wfeat-b05e0a0f82bf83095b98cdf6"},"ingressCorrelation":null,"sessionId":"main","eventWatermarkSeq":null,"promptRequestId":null,"messageId":null,"state":"settled","initialOutcome":null,"initialSource":null,"outcome":"not_admitted","lateOutcome":null,"outcomeEvidence":"prompt_write_not_attempted","terminationEvidence":null,"errorClass":null,"cancelRequested":false,"cancelRequestedAtWallMs":null,"settledAtWallMs":1793813726328,"updatedAt":1793813726328,"deadlineAtWallMs":null,"hardDeadlineAt":null,"recoveryState":"settled","missingEvidence":[],"reapClaim":null,"attemptedActions":[],"shutdownRequestedAt":null,"exitObservedAt":null,"settlementResult":"not_admitted","failureReason":null,"nextSafeAction":"send_new_request_after_reopened","fenceState":"cleared","finalAssistantOutput":null,"audit":[]}},"finalResponsibility":{"state":"NEEDS_REVIEW","judgment":"delivery_unverified"},"readOnlyLedgerUnchanged":true,"readOnlyRouterUnchanged":true}
✔ B3 fault injection: during_delivery -> UNKNOWN, same responsibility and zero restart delivery (183.94725ms)
{"sourceSha":"f31ba0ea8033ffe97363ba001cc8772154b6f320","testName":"B3-accepted_receipt_lost","faultInjection":"accepted_receipt_lost","initialState":{"phase":"delivery_started","wal":[{"kind":"attempt_planned","attemptId":"wfeat-b05e0a0f82bf83095b98cdf6","deliveryProtocol":"write_ahead_v1","nodeVisitId":"0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11","dispatchIntentId":"2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33","workflowInstanceId":"4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55","ownerPrincipalId":"5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66","atMs":1700000000000},{"nodeVisitId":"0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11","atMs":1700000000000,"kind":"delivery_started","workflowInstanceId":"4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55"}]},"expectedResult":"ACCEPTED","actualResult":{"nodeVisitId":"0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11","attemptId":"wfeat-b05e0a0f82bf83095b98cdf6","generation":1,"requestId":"wfeat-b05e0a0f82bf83095b98cdf6","classification":"ACCEPTED","businessOutcome":"UNKNOWN","resumeAuthorized":false,"responsibility":"wait_original_receipt_or_reconcile","reason":"original_prompt_receipt","receipt":{"reconciliationHandle":"turn:original-epoch:a1:g1:s1","agentId":"agt_target-agent","sessionId":"main","messageId":"original-message","turnState":"settled"},"observedAtMs":1700000000100},"originalSends":1,"restartSends":0,"originalCorrelationReads":3,"rawReceipt":{"state":"settled","handle":"turn:original-epoch:a1:g1:s1","snapshot":{"handle":"turn:original-epoch:a1:g1:s1","turnExecutionId":"turn:original-epoch:a1:g1:s1","runtimeEpoch":"original-epoch","agentId":"agt_target-agent","processGeneration":1,"callerCorrelation":{"requestId":"wfeat-b05e0a0f82bf83095b98cdf6"},"ingressCorrelation":null,"sessionId":"main","eventWatermarkSeq":null,"promptRequestId":null,"messageId":"original-message","state":"settled","initialOutcome":null,"initialSource":null,"outcome":"not_admitted","lateOutcome":null,"outcomeEvidence":"prompt_write_not_attempted","terminationEvidence":null,"errorClass":null,"cancelRequested":false,"cancelRequestedAtWallMs":null,"settledAtWallMs":1793813726529,"updatedAt":1793813726529,"deadlineAtWallMs":null,"hardDeadlineAt":null,"recoveryState":"settled","missingEvidence":[],"reapClaim":null,"attemptedActions":[],"shutdownRequestedAt":null,"exitObservedAt":null,"settlementResult":"not_admitted","failureReason":null,"nextSafeAction":"send_new_request_after_reopened","fenceState":"cleared","finalAssistantOutput":null,"audit":[]}},"finalResponsibility":{"state":"NEEDS_REVIEW","judgment":"delivery_unverified"},"readOnlyLedgerUnchanged":true,"readOnlyRouterUnchanged":true}
✔ B3 fault injection: accepted_receipt_lost -> ACCEPTED, same responsibility and zero restart delivery (216.4215ms)
✔ B3 late original receipt is read after terminal judgment and another engine restart, with zero writes (129.361959ms)
✔ B3 historical unmarked planned and malformed/lost/foreign correlations cannot prove non-send (35.905541ms)
✔ B3 unknown classification leaves a torn ledger tail byte-for-byte intact (27.599625ms)
✔ B3 observation waits for in-flight admission lock instead of racing an unsent snapshot (30.861291ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 838.72675
```

## Structure output coordinates

Complete unmodified output is linked above; scalar fields and debt counts:

```json
{
  "schema_version": 1,
  "rules_version": "CODE_STRUCTURE_GUARDRAILS_V2",
  "base_oid": "9f04db29cce44a684b4409fa63b436aaf10dfa52",
  "head_oid": "f31ba0ea8033ffe97363ba001cc8772154b6f320",
  "candidate_result": "CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT",
  "baseline_debt_count": 28,
  "resolved_debt_count": 0
}
```

This is candidate-delta success with visible historical debt, not global PASS.

## Independent review and UNKNOWN

[Independent candidate rerun](docs/evidence/ekr-b3/independent-review.raw.txt):
7 pass / 0 fail / rc=0, also not acceptance PASS.
[Separate protocol experiment](docs/evidence/ekr-b3/review-protocol.raw.txt):
correct order yields recovering / initialOutcome=outcome_unknown / active fence,
ACCEPTED classification and UNKNOWN business result; not candidate acceptance.

Production writes = 0. Window tools unchanged. Automatic resend = 0.
Original business outcome/side effects = UNKNOWN. Installed/enabled/runtime/
business acceptance = UNKNOWN, not attempted. Remote branch state = UNKNOWN,
not queried or changed by this delivery. PR = NOT_CREATED due to stop.

## Evidence hashes

[SHA256SUMS](docs/evidence/ekr-b3/SHA256SUMS) binds the raw artifacts.

```text
c3b22f8177c3a5c6f628d4416a809b08cf831ccc7abc04bf4132b1fb5fcb81fe  candidate.diff
fc52d6a626203a334f0dc4f14e538bead167b6d3470001ef82c1756ffb39874e  diff-checks.raw.txt
f8d4f4395a11b707f990e9d3c7950e7bdbfd4641f7d96116e2a9faf7e25955f5  fault-injection.raw.txt
4a18abd5552abf62ec523507061670cbf511c54ad8653ca08d43f5d801a36ae8  independent-review.raw.txt
a2ca961d79a71af164eaaca8da1633ea6ad24d2493b64a783034789707c08d2c  independent-review.txt
c7543372e5988131905deb1609989181cd528f9236eb1c31c55f606f31562279  review-protocol.raw.txt
6577fe2dfb08ffc8e4641077cd944748182357f522424d98cec365f809cf52b7  scheduler-router.raw.txt
f575e4c14e7c48712fee290a3cddf7f2b59882c17cf209fa9b453116c5b15f5b  scheduler.raw.txt
f4f732b515e1ca01362f07936cb5f4073f3f2ce8bcbc21111669add82f6bca35  structure.raw.txt
fbef4930e21e343997d97bd0071694e0371ddb2ee9682f54592f0c2f57b03be2  workflow.raw.txt
```
