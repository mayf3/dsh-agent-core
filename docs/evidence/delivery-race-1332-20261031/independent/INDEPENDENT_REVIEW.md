# #1332 independent affected-delta review

```text
SPEC_GOVERNANCE_MODE = REVIEW
REPOSITORY = mayf3/dsh-agent-core
REVIEW_KIND = AFFECTED_CONTRACT
REVIEW_TARGET_HEAD = 3259d8cc2c6a3cb0d8e8f16edaacc0c01f0ca3bb
BASE_HEAD = 0b64aca3615aec203b95aa960eff39d635bd26c1
CURRENT_BASE_HEAD = 0b64aca3615aec203b95aa960eff39d635bd26c1 (local integration snapshot)
SOURCE_TREE = 91bb6a0df8f2d4e1a85feafabc1553c90af20ad2
DIFF_FORMAT = git diff --binary --full-index BASE HEAD
DIFF_SHA256 = 44a0d4d57d50808879aa6dbc9cd2ce60a02fd555e7170c61769f1546c3aa2795
REVIEWER_ID = /root/spec_scope
AUTHOR_ID = /root
AUTHOR_INDEPENDENCE = PASS
ASSURANCE_LEVEL = DURABLE
REVIEW_SCOPE = DELTA
SCOPE_REASON = recheck repairs to frozen initial F1..F6 and invalidated native-source/readiness/async dependencies
FROZEN_BLOCKER_UNION = F1,F2,F3,F4,F5,F6
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS (bounded offline source scope)
ACCEPTANCE_COVERAGE_REVIEW = PASS (affected offline cases)
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
BASE_IMPACT = BOUNDED
OPEN_BLOCKERS = 0
SPEC_GAPS = 0
FOLLOW_UPS = 0
SOURCE_REVIEW_RESULT = PASS
MERGE_READY = NOT_APPLICABLE (Owner decision; this task forbids merge)
OPERATION_ALLOWED = NO
PRODUCTION_ACCEPTANCE = NOT_TESTED
NEXT_ACTION = CONTINUE (normal PR and authorized issue delivery comment only; no merge)
```

## Scope and authority

The accepted AGENT_DELIVERY_RESILIENCE_V1 PR-A contracts CTR-R1..R5 authorize the reviewed source behavior. Its harness root-cause PR-B, caller-bound PR-C, scheduler PR-D and production retirement PR-E are outside this review. The active ordered-route authority is AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3 CTR-SCA-012; its immutable chain, same-route identity, closed fallback whitelist, one end-to-end deadline, no unsafe replay and one outward reply remain in place. Existing unknown/lifecycle fences and strict original-source custody retain precedence. The accepted DSH_MCP_NATIVE_CONVERSATION_V1 CTR-NC-002/003/004 govern the directly affected resolution/source receipts. Relevant authority file SHA-256 values are in authority-sha256.json.

The retry helper is nested inside one canonical route entry. It does not add fallback classes or turn generic provider text into replay proof. Retry authority is a private WeakMap entry created by the real exact-terminal reducer, requiring continuous retained harmless events, no output, no parent RPC, no unknown marker and authoritative exact failed+terminal/idle settlement. Connection death quarantines the generation independently of replay eligibility. Respawn waits for real old-generation death through the existing controlled shutdown mechanism. Strict conversationSource/websiteControl/nativeGoalContinuation carriers are excluded from post-admission replay.

No production process/service/credential/Feishu endpoint or historical message was read or written by the review probes. Synthetic child processes and temp data were used. No #554 admission-policy repair, provider lifecycle/root-cause completion, deployment, stopgap removal, merge or production acceptance is claimed.

## Frozen initial blocker union and closure

These initial findings were observed against the author's precommit working diff based on the same Base, rather than an invented immutable initial candidate SHA. Initial author-focused tests were 15/15 PASS despite the reachable failures; the independent probes exposed the missing cases. Historical terminal outputs remain in the review conversation. The final raw logs below are fresh executions at the exact reviewed Head, not reconstructed logs of that earlier working tree.

| ID | Initial concrete finding and legal source | Exact-candidate closure and executed result |
|---|---|---|
| F1 CONTRACT_VIOLATION | CTR-R2/R3/R5: receipt-only deliver returned before delayed terminal TRANSPORT; initial probe admitted=true with one generation, counts all zero and no dead letter. | turn-execution attaches a private nonenumerable completion Symbol; delivery-resilience observes terminal failure after returning one original receipt, then recovers under the same deadline. Independent delayed-failure probe: accepted=true, prompts=3, generations=3, transport_death=3, waits=[1,2], deadLetters=1, one route-chain final row. |
| F2 CONTRACT_VIOLATION | CTR-R4: unsafe tool/output event correctly blocked replay but left known transport-dead generation reusable. | markTransportRetryEvidence quarantines before testing replay proof; normal preAdmission and registry gates honor the flag. Independent tool-event probe: prompt=1, no retries, quarantine=true. Independent real registry same-route probe: old shutdown=1, generations=2, old process not reused. |
| F3 CONTRACT_VIOLATION | CTR-R5: actual AGENT_PROCESS_CHILD_EXITED carrier was counted as other. | category function accepts actual carrier. Independent receipt-then-child-exit probe: child_exit_without_outcome=1, other=0, one prompt, no replay. |
| F4 CONTRACT_VIOLATION | CTR-R3: original code awaited generation reap before persisting exhaustion; shutdown failure skipped dead letter and resend notice. | exhausted() writes independently on retirement/backoff/budget failure. Independent third-generation shutdown throw: attempts=3, deadLetters=1, recoveryBlocked=true, userMessage contains 请重发. |
| F5 CONCRETE_REGRESSION | Accepted native conversation CTR-NC-002 and existing B003: preparation populated handles, causing first created/resumed prompt receipt to falsely claim hot_reuse. | session-seam tracks successfully prompted handles separately. Independent prepared-create and prepared-resume probes retain created/resumed on first receipt and hot_reuse on the second, with zero followups during preparation. |
| F6 CONTRACT_VIOLATION | Accepted native conversation CTR-NC-003/004: source-bound failure attempted a second native prompt under the same reserved key; real source owner rejected existing record. Initial probe prompts=2/generations=2 and generic failure. | stricter custody opts deny post-admission replay and retain original failure. Independent real createConversationSource owner + AgentProcess probe: prompts=1/generations=1, replayForbidden=true, original source request/message row unchanged, deadLetters=1. No source row is deleted or replacement request minted. |

All F1..F6 are CLOSED at the exact reviewed Head. No new blocker is introduced by preference or speculative hardening.

## Executed evidence

Environment: macOS local isolated clone, Node v26.7.0. Run coordinates and full command arrays/times/return codes are in executed-receipts.json. All logs are kept outside the candidate tree.

| Evidence | Result | Output SHA-256 |
|---|---|---|
| focused.log: four new readiness/race/resilience/demo-server test files | rc=0; 30 tests, 30 PASS, 0 FAIL | 213d6944d93b589922e7c66fa9af610aca2eb293d51e1da2ed3ab2b548ec89b0 |
| independent-probes.log: independent script using production seams, not author rig | rc=0; 8/8 asserted probes PASS | 10ed6fa14d8e1334a09f13944757201f3ad3b9f32725864710c6fa428adfa15c |
| structure.log: exact Base/Head V2 verifier | rc=0; CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT; candidate violations=0, baseline debt=32, resolved debt=1 | c70a4fb409cc0590a5cd2cda197cd79078136461e64d7ae209b5616fa70c678e |

The focused tests include fresh-spawn suspended 59,243-event resume injection, a real stdio child application acknowledgment, no-prompt-before-ready, deadline/protocol rejection, two exponential respawns, exhaustion persistence/file mode and readback, explicit Feishu resend text through real ingress, unsafe/unknown/RPC no-replay, all four independently recomputable categories and threshold reset, delayed async failure, and original-source custody. The 59,243 count is synthetic replay injection; no claim is made about production replay latency or provider-network health.

Independent-probes.mjs adds actual registry nonreuse and real source-owner persistence to the repair verification. Its data lives in temporary directories. Source and test file SHA-256 values are in coordinates.json; semantic.diff is the complete reviewed patch.

The author's broader 72/72 fixture and 66/66 workflow results were reported to the reviewer but were not rerun in this bounded independent delta audit. This review does not claim a full-repository test PASS, clear the known main failures, or convert inherited structure debt into conformance. The parent must carry exact full-suite/Base failure evidence in the delivery record.

## Final binding and limits

Tracked source/semantic Head was held at 3259d8cc2c6a3cb0d8e8f16edaacc0c01f0ca3bb throughout these executions. The author began staging untracked docs/evidence receipts after source freeze; those receipt files are not part of this semantic Head or semantic.diff. A final receipt-only commit requires the planned small independent delta recheck. Review is not Owner acceptance and does not authorize merge or deployment.
