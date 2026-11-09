# RECEIPT — EKR-B3-r2 / P0-B3

Status: **SOURCE_VERIFIED; THREE_POSITION_ACCEPTANCE_PASS; INDEPENDENT_DELTA_REVIEW_PASS**.
This receipt records isolated mechanism acceptance, not deployment, physical process-kill or cross-service business acceptance.

## Coordinates and authorization

- Repository/worktree/branch: `mayf3/dsh-agent-core` / `/private/tmp/dsh-ekr-b3` / `ac-ekr-b3`.
- Integration base: `9f04db29cce44a684b4409fa63b436aaf10dfa52`.
- Prior stopped source/test candidate: `f31ba0ea8033ffe97363ba001cc8772154b6f320`.
- Exact new tested and independently reviewed source/test candidate: **`060417c900ec8a65fd991872ae18d59be04334f0`**; tree `260ef5a091b3cf70ecb13438cb9bb3e8fba57346`.
- Fresh main snapshot: `2d550bc8147c877db33886fccb85e00a64353e66`; only added proposed B1/B2/B4 authority and its delivery receipt since base; affected accepted authority and product bytes unchanged.
- Task authorization: [BRIEF-EKR-B3-R2.md](BRIEF-EKR-B3-R2.md), Owner completion mandate; work order [mayf3/agent-control#1374](https://github.com/mayf3/agent-control/issues/1374), §3 B3 / §7.4.
- Governance: REUSE / BRIEF / DURABLE; accepted WAE V3 CTR-WAE-002/004/005/006/011/012/013, WEC V3, D-009 and Product Architecture V1 at base. No authority or product semantics changed.
- Candidate was minted as an immutable Git object while the delivery branch stayed at the prior stopped HEAD. Tests executed against matching candidate bytes. Delivery branch promotion occurs only after required gates pass.
- PR URL: **PENDING_DELIVERY**; delivery-head and final independent evidence-only delta recheck will be recorded in the PR after commit. This avoids inventing a self-containing commit SHA.
- Push: **PENDING_DELIVERY**. Merge: **NOT_ATTEMPTED / explicitly forbidden**.

## Fixture diff and frozen product files

Only `packages/workflow-execution/test/observation-cas/planned-reconciliation.test.js` changed under packages/scripts since the verified prior candidate: **21 insertions, 1 deletion**.
The accepted-receipt-loss sender now executes
`mintTurnExecution -> markAdmitted -> markPromptWriteAttempted -> markPromptReceipt -> interruption`.
After reopening both durable stores, assertions check original prompt/message/caller correlation, admission metadata, recovering state, outcome_unknown from runtime_restart_after_prompt_write, active fence and absent business/termination settlement. The old not_admitted/prompt_write_not_attempted fixture cannot pass these assertions.

[Exact fixture diff](docs/evidence/ekr-b3-r2/fixture.diff), SHA-256 `3c502d164e10b0cc27e5ee0be40afa038ace3e1cf524a4fbfa9b6a7483ff50f0`.
Fixture SHA-256: `1900ceb464a67e865841944d8aba50e5ef27acf219c2a7b7c8f16d5c72cb479a`.
[Product identity and evidence reuse](docs/evidence/ekr-b3-r2/product-identity-and-evidence-reuse.json) records matching old/new Git blobs and measured SHA-256 for all five prior product files. No other package/script file changed. Product files remain byte-identical to `f31ba0ea…`; window tools unchanged.
Original [STOPPED](STOPPED-EKR-B3.md), [failed receipt](RECEIPT-EKR-B3.md), and raw evidence are preserved as history. Their invalid third-position evidence is not relabeled PASS.

## Executed validation

| Gate / observation | Executed result |
|---|---|
| `EKR_SOURCE_SHA=060417c900ec8a65fd991872ae18d59be04334f0 node --test packages/workflow-execution/test/observation-cas/planned-reconciliation.test.js` | rc=0; 7/7 passed, 0 failed; all three positions PASS |
| Independent exact-candidate rerun of same command | rc=0; 7/7 passed, 0 failed; all three positions PASS |
| `node scripts/verify-code-structure.mjs --base 9f04db29cce44a684b4409fa63b436aaf10dfa52 --head 060417c900ec8a65fd991872ae18d59be04334f0 --json` | rc=0; `CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT`; candidate violations=0, baseline debt=28; not global conformance |
| Original workflow 285/285, scheduler 454/454, scheduler-router 40/40 | Prior rc=0 observations reused only for unchanged product and unaffected mechanisms. Affected seven-test observation replaced by the fresh runs above; no fresh full-regression run is claimed |
| Original raw-evidence hash verification | 10/10 artifacts match original SHA256SUMS |
| `git diff --check` | rc=0, empty output |
| `git diff --cached --check` | Required before each delivery commit; raw record in evidence directory |

[Main raw output](docs/evidence/ekr-b3-r2/fault-injection.raw.txt),
[execution coordinates](docs/evidence/ekr-b3-r2/fault-injection.coordinates.json),
[independent raw output](docs/evidence/ekr-b3-r2/independent-review.raw.txt),
[structure JSON](docs/evidence/ekr-b3-r2/structure.raw.txt),
[structure coordinates](docs/evidence/ekr-b3-r2/structure.coordinates.json).
Environment: local macOS isolated worktree, Node `v26.7.0`; memory sender, fsynced temporary ledger and real isolated durable Router reconciliation store. Fault is an injected interruption exception; it is not OS process termination or production E2E.

| Interruption position | Classification | Reopened original Router receipt | Restart sends | Business outcome |
|---|---|---|---:|---|
| before_delivery | NOT_SENT | never_existed | 0 | UNKNOWN |
| during_delivery | UNKNOWN | original mint interrupted before admission; not_admitted/prompt_write_not_attempted, no message | 0 | UNKNOWN |
| accepted_receipt_lost | ACCEPTED | recovering; original-message; outcome_unknown; runtime_restart_after_prompt_write; active fence; no settlement/termination evidence | 0 | UNKNOWN |

All three retain original attemptId/requestId and generation 1, `resumeAuthorized=false`, `NEEDS_REVIEW/delivery_unverified`, non-consuming Router read and unchanged read-only ledger bytes. The during-delivery case remains conservatively UNKNOWN because the durable delivery-start fence cannot authorize replay; its pre-admission interruption is distinct from the corrected accepted third position.

## Independent affected-delta review

Reviewer `/root/r2_review` did not author or modify the fixture. [Persisted report](docs/evidence/ekr-b3-r2/independent-review.txt) binds exact new candidate and prior candidate, independently reads real protocol/store behavior, runs all seven tests and verifies product identity, original evidence hashes and unaffected regression reuse.
**FROZEN_BLOCKER_UNION = [B3-REVIEW-001]; B3-REVIEW-001 = CLOSED; open blockers = []; spec gaps = 0.**
Independent raw output SHA-256: `da475d57f149338a69a3d67eea39a1d5ce1075b24b7ecc312575c2d5c938f421`.
Review PASS permits authorized repository delivery; it does not perform Owner acceptance or merge.
The final committed evidence-only delta receives an independent exact-Head recheck, published in the PR so no recursive receipt/hash commit is required.

## Three-position complete PASS output (verbatim)

```text
{"sourceSha":"060417c900ec8a65fd991872ae18d59be04334f0","testName":"B3-before_delivery","faultInjection":"before_delivery","initialState":{"phase":"planned","wal":[{"kind":"attempt_planned","attemptId":"wfeat-b05e0a0f82bf83095b98cdf6","deliveryProtocol":"write_ahead_v1","nodeVisitId":"0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11","dispatchIntentId":"2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33","workflowInstanceId":"4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55","ownerPrincipalId":"5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66","atMs":1700000000000}]},"expectedResult":"NOT_SENT","actualResult":{"nodeVisitId":"0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11","attemptId":"wfeat-b05e0a0f82bf83095b98cdf6","generation":1,"requestId":"wfeat-b05e0a0f82bf83095b98cdf6","classification":"NOT_SENT","businessOutcome":"UNKNOWN","resumeAuthorized":false,"responsibility":"explicit_controlled_resolution","reason":"wal_before_delivery_fence","observedAtMs":1700000000100},"originalSends":0,"restartSends":0,"originalCorrelationReads":3,"rawReceipt":{"state":"never_existed"},"finalResponsibility":{"state":"NEEDS_REVIEW","judgment":"delivery_unverified"},"readOnlyLedgerUnchanged":true,"readOnlyRouterUnchanged":true}
✔ B3 fault injection: before_delivery -> NOT_SENT, same responsibility and zero restart delivery (151.36375ms)
{"sourceSha":"060417c900ec8a65fd991872ae18d59be04334f0","testName":"B3-during_delivery","faultInjection":"during_delivery","initialState":{"phase":"delivery_started","wal":[{"kind":"attempt_planned","attemptId":"wfeat-b05e0a0f82bf83095b98cdf6","deliveryProtocol":"write_ahead_v1","nodeVisitId":"0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11","dispatchIntentId":"2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33","workflowInstanceId":"4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55","ownerPrincipalId":"5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66","atMs":1700000000000},{"nodeVisitId":"0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11","atMs":1700000000000,"kind":"delivery_started","workflowInstanceId":"4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55"}]},"expectedResult":"UNKNOWN","actualResult":{"nodeVisitId":"0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11","attemptId":"wfeat-b05e0a0f82bf83095b98cdf6","generation":1,"requestId":"wfeat-b05e0a0f82bf83095b98cdf6","classification":"UNKNOWN","businessOutcome":"UNKNOWN","resumeAuthorized":false,"responsibility":"original_request_readback_or_escalation","reason":"delivery_started_without_exact_receipt","observedAtMs":1700000000100},"originalSends":1,"restartSends":0,"originalCorrelationReads":3,"rawReceipt":{"state":"settled","handle":"turn:original-epoch:a1:g1:s1","snapshot":{"handle":"turn:original-epoch:a1:g1:s1","turnExecutionId":"turn:original-epoch:a1:g1:s1","runtimeEpoch":"original-epoch","agentId":"agt_target-agent","processGeneration":1,"callerCorrelation":{"requestId":"wfeat-b05e0a0f82bf83095b98cdf6"},"ingressCorrelation":null,"sessionId":"main","eventWatermarkSeq":null,"promptRequestId":null,"messageId":null,"state":"settled","initialOutcome":null,"initialSource":null,"outcome":"not_admitted","lateOutcome":null,"outcomeEvidence":"prompt_write_not_attempted","terminationEvidence":null,"errorClass":null,"cancelRequested":false,"cancelRequestedAtWallMs":null,"settledAtWallMs":1793814354210,"updatedAt":1793814354210,"deadlineAtWallMs":null,"hardDeadlineAt":null,"recoveryState":"settled","missingEvidence":[],"reapClaim":null,"attemptedActions":[],"shutdownRequestedAt":null,"exitObservedAt":null,"settlementResult":"not_admitted","failureReason":null,"nextSafeAction":"send_new_request_after_reopened","fenceState":"cleared","finalAssistantOutput":null,"audit":[]}},"finalResponsibility":{"state":"NEEDS_REVIEW","judgment":"delivery_unverified"},"readOnlyLedgerUnchanged":true,"readOnlyRouterUnchanged":true}
✔ B3 fault injection: during_delivery -> UNKNOWN, same responsibility and zero restart delivery (162.361333ms)
{"sourceSha":"060417c900ec8a65fd991872ae18d59be04334f0","testName":"B3-accepted_receipt_lost","faultInjection":"accepted_receipt_lost","initialState":{"phase":"delivery_started","wal":[{"kind":"attempt_planned","attemptId":"wfeat-b05e0a0f82bf83095b98cdf6","deliveryProtocol":"write_ahead_v1","nodeVisitId":"0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11","dispatchIntentId":"2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33","workflowInstanceId":"4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55","ownerPrincipalId":"5d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e66","atMs":1700000000000},{"nodeVisitId":"0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11","atMs":1700000000000,"kind":"delivery_started","workflowInstanceId":"4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55"}]},"expectedResult":"ACCEPTED","actualResult":{"nodeVisitId":"0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11","attemptId":"wfeat-b05e0a0f82bf83095b98cdf6","generation":1,"requestId":"wfeat-b05e0a0f82bf83095b98cdf6","classification":"ACCEPTED","businessOutcome":"UNKNOWN","resumeAuthorized":false,"responsibility":"wait_original_receipt_or_reconcile","reason":"original_prompt_receipt","receipt":{"reconciliationHandle":"turn:original-epoch:a1:g1:s1","agentId":"agt_target-agent","sessionId":"main","messageId":"original-message","turnState":"recovering"},"observedAtMs":1700000000100},"originalSends":1,"restartSends":0,"originalCorrelationReads":3,"rawReceipt":{"state":"recovering","handle":"turn:original-epoch:a1:g1:s1","snapshot":{"handle":"turn:original-epoch:a1:g1:s1","turnExecutionId":"turn:original-epoch:a1:g1:s1","runtimeEpoch":"original-epoch","agentId":"agt_target-agent","processGeneration":1,"callerCorrelation":{"requestId":"wfeat-b05e0a0f82bf83095b98cdf6"},"ingressCorrelation":null,"sessionId":"main","eventWatermarkSeq":0,"promptRequestId":"original-prompt","messageId":"original-message","state":"recovering","initialOutcome":"outcome_unknown","initialSource":"runtime_restart_after_prompt_write","outcome":null,"lateOutcome":null,"outcomeEvidence":null,"terminationEvidence":null,"errorClass":null,"cancelRequested":false,"cancelRequestedAtWallMs":null,"settledAtWallMs":null,"updatedAt":1793814354394,"deadlineAtWallMs":1793814414371,"hardDeadlineAt":1793814414371,"recoveryState":"blocked","missingEvidence":["live_generation_ownership"],"reapClaim":null,"attemptedActions":[],"shutdownRequestedAt":null,"exitObservedAt":null,"settlementResult":null,"failureReason":"runtime_restart_ownership_unavailable","nextSafeAction":"reestablish_exact_ownership","fenceState":"active","finalAssistantOutput":null,"audit":[]}},"finalResponsibility":{"state":"NEEDS_REVIEW","judgment":"delivery_unverified"},"readOnlyLedgerUnchanged":true,"readOnlyRouterUnchanged":true}
✔ B3 fault injection: accepted_receipt_lost -> ACCEPTED, same responsibility and zero restart delivery (179.862584ms)
✔ B3 late original receipt is read after terminal judgment and another engine restart, with zero writes (110.918ms)
✔ B3 historical unmarked planned and malformed/lost/foreign correlations cannot prove non-send (34.106166ms)
✔ B3 unknown classification leaves a torn ledger tail byte-for-byte intact (31.968416ms)
✔ B3 observation waits for in-flight admission lock instead of racing an unsent snapshot (28.745ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 744.574208
```

## UNKNOWN and remaining boundary

Production writes = 0. Automatic replay/restart sends = 0. No UNKNOWN is reclassified as business failure/success or proof of zero external effects. No new request, attempt, generation, recovery authorization, production fence clearing or installed-runtime operation occurred.
Installation, loaded/enabled runtime version, production reconciliation, cross-service E2E, original business result/side effects and #1374 overall unattended outcome remain **UNKNOWN / NOT_ATTEMPTED**. This closes the bounded B3 fixture gate only. Owner/authorized maintainer acceptance and merge remain pending outside this mandate. No auto-merge is enabled.

[Evidence SHA256SUMS](docs/evidence/ekr-b3-r2/SHA256SUMS) binds raw logs, coordinates, fixture diff, product-identity and independent review artifacts. Delivery provenance/final-Head recheck are retained in the PR.
