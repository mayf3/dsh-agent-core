# Owner Assistance resolution and workflow resume — review candidate

Status: **candidate for independent review; not an accepted contract and not an implementation authorization**.

## DEVELOPMENT_PREFLIGHT

- Repository: `dsh-agent-core`, isolated worktree `/Users/yanfenma/workspace/worktrees/codex-assistance-resume-contract-20261028`.
- Base: fresh `main` at `90d53b6200d3825f8b7c1e24533af28637085dab`; branch `codex/assistance-resume-contract-20261028`; worktree was clean before this document.
- Governing accepted contracts: `AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V1` (WEC1-004/005), `AGENT_CORE_WORKFLOW_STALE_REENTRY_V1` (SRE-002/003/004, Goal CASE 4), and svc-workflow `SVC_WORKFLOW_VISIT_ACTIVATION_IMPL_V1` (VAI-009) plus `SVC_WORKFLOW_EXECUTION_CONTROL_V1` (SWEC-006). Exact source pointers and current scope are recorded below.
- Evidence: new A20 engine/ledger repro, whose service and Router facts are synthetic. It demonstrates a real dead end in current Core attempt admission; it does not establish that the service currently exposes the proposed recovery proof.
- Intended delta: propose additive svc read evidence plus a narrow Core attempt-ledger admission reason for an explicitly Owner-resolved case. No product code, accepted Spec, pinned experiment source, production endpoint, or production data is changed here.
- Authority/status: this file is a review packet only. Root must decide whether to accept the proposed contracts and any SRE CASE 4 amendment before implementation. Production remains unauthorized.

## New evidence and current behavior

The isolated A20 repro packet is:

- `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/a20-native-fixture-contract-review/assistance-resume-contract-gap.json`, SHA-256 `a5787b14a9c146c1410443b31524d1079c4669ac1989f506e11299b40bb57724`.
- `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/a20-native-fixture-contract-review/assistance-resume-repro.result.json`, SHA-256 `39522901b0cddea96b7c49fe7213b5ec912f6bfc05f5ffb3904d7d8807574adc`.

It exercises the real Core engine and durable attempt ledger with synthetic service/Router facts: dispatch at visit version 2; Assistance opens at version 3; the worker is reconciled settled and ends as `NEEDS_REVIEW/run_ended_no_submission`; Owner resolves the case at version 4 on the same visit; the due row reappears, but the engine returns `already_attempted`. Reloading the same ledger and advancing the fixture clock by 24 hours still returns `already_attempted`. This is a cross-turn/restart recovery gap, not evidence that a live svc outbox or native wake was run.

The ordinary current-assignee open flow is separately documented in `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/generic-assistance-branch-luna-20261027/README.md` (SHA-256 `ac0d89996e341fb58e29744c64eab4fb282e415592573d6f17b9a33a8fa77332`): executor first reads fresh detail, then only the exact current `assigneePrincipalId` may open the case for the current visit/version. That artifact describes accepted API/tool semantics but its traces are synthetic; A20 itself simulates service open/resolve. This proposal therefore handles ordinary assignee-open and policy-generated cases as distinct ingress kinds, without treating the current artifact as a live service test.

Core accepted WEC1-004 makes the automatic cap `maxAttemptsPerVisit` (default 3) and allows run-ended continuation through the existing stale-reentry path; `run_outcome_unknown` is never eligible. WEC1-005 opens Owner Assistance on cap exhaustion and delivers a stable Domain Owner wake, but does not authorize a resume after resolution. Core SRE-003 currently permits generation N+1 only after `stale_no_progress`; SRE Goal CASE 4 explicitly classifies Assistance open/resolve version changes as not stale and prohibits stale redispatch to old ownership. The proposed path must be a separate, explicit Owner-resolution reason; it must not relabel or weaken stale eligibility.

Svc VAI-009 returns exactly seven due fields and explicitly excludes Assistance details. SWEC-006 filters visits while a case is `OWNER_PENDING` or `HUMAN_REQUIRED`; resolving it removes that exclusion, but the due row contains no case identity or resolved-case event marker. The due DTO is deliberately kept unchanged by this proposal.

## Minimal contract candidate

### Svc owner: additive read-only authorization evidence

Add one narrowly scoped companion read under existing `GLOBAL_SCHEDULER_READ` / `workflow.read` authorization, keyed by the exact `dispatchIntentId` (and validated against the current `workflowInstanceId` and `nodeVisitId` from the due row). Do not add fields to VAI-009’s exact seven-field response: that would change its accepted DTO and its negative role/schema contract. The companion query is the smallest compatible seam because it leaves the stable due feed intact while exposing only the proof Core needs.

Return the current activation identity and at most one eligible case marker, or `null`: `dispatchIntentId`, `workflowInstanceId`, `nodeVisitId`, `ownerPrincipalId`, `currentWorkflowStateVersion`, and `{assistanceCaseId, requestedByPrincipalId, resolvedByPrincipalId, requestEventSequence, resolutionEventSequence, ingressKind, reason, lastAttemptId}`. The service derives all IDs from persisted rows; callers cannot supply a requester or resolver identity. Support the two existing ingress shapes: (a) a normal Assistance case opened by the current activation assignee, where `requestedByPrincipalId` must equal the current `ownerPrincipalId`; or (b) the WEC1-005 execution-policy ingress, where the requester is the system execution caller and svc must attest `ingressKind: execution_policy` plus persisted `lastAttemptId` and `dispatchIntentId` bound to the immediately preceding Core attempt and exact due activation. Do not equate the policy caller with the node executor. In either case, the case must be for that same visit/instance, remain `RESOLVED`, and its resolution must be an explicit Domain Owner action authorized by svc. Request and resolution sequences must be read from the existing durable workflow events/command references, not inferred from wall-clock timestamps. No Assistance payload, free text, credentials, or audit body is returned.

The query takes the previous attempt’s `workflowStateVersionAtDispatch` as a lower bound and requires both `requestEventSequence` and `resolutionEventSequence` to be strictly greater than that dispatch baseline, with resolution sequence greater than request sequence. It returns the earliest qualifying case by `(resolutionEventSequence, assistanceCaseId)` so selection is deterministic. A follow-up attempt stores the selected case ID and its sequence evidence in the existing Core attempt ledger. If multiple cases were already resolved for that same baseline, the follow-up consumes exactly one marker; after that new attempt is planned, all older markers are before its new baseline and cannot authorize another attempt. A further attempt requires a new policy case bound to that attempt after its dispatch, then a distinct explicit Domain Owner resolution.

This is a new service read capability/DTO, not present in the accepted service contract today. Candidate source owner: `svc-workflow`, amending `SVC_WORKFLOW_EXECUTION_CONTROL_V1` (new CTR) while preserving VAI-009 unchanged. Existing read surfaces do not suffice: owner detail requires a case ID and owner visibility; `requested-by-me` is tied to requester identity; the global scheduler due feed does not expose a case ID or event marker.

### Core owner: one-use, recoverable admission in the existing ledger

Add a separate `owner_assistance_resolved` admission reason to WEC, distinct from SRE `stale_no_progress`. It is eligible only when all of these are true:

1. The prior attempt is terminal `NEEDS_REVIEW/run_ended_no_submission`, its Router/turn reconciliation is positively `settled`, and its recorded delivery is known. `outcome_unknown`, unresolved/pending execution, unavailable reconciliation, delivery ambiguity, or any other terminal judgment fail closed and remain non-replayable.
2. The authoritative current due activation still matches the prior attempt’s `dispatchIntentId`, `workflowInstanceId`, `nodeVisitId`, and `ownerPrincipalId`; it remains active and on the same current visit/assignee. A moved visit, changed activation, or changed owner rejects the proof.
3. Svc returns one qualifying resolved marker whose request and resolution event sequences are both after the prior attempt’s dispatch baseline, and whose ingress proof is either a normal current-assignee request (`requestedByPrincipalId == ownerPrincipalId`) or the execution-policy case with matching `lastAttemptId` and `dispatchIntentId`. Core does not equate the policy caller with the executing assignee. Svc attests that `resolvedByPrincipalId` was authorized for the explicit Domain Owner resolve action. Core resolves the existing canonical Principal→Agent authority afresh before delivery.
4. Under the existing ledger’s cross-process lock/fence, Core appends a single `attempt_planned` fact containing the next generation, existing dispatch-intent identity, `retryReason: owner_assistance_resolved`, `previousAttemptId`, exact `assistanceCaseId`, and the request/resolution sequence pair. The reducer rejects reuse of a case ID, a nonmatching identity/baseline, a nonterminal or unknown predecessor, or a duplicate generation. This append is the durable consume and generation mint in one existing-ledger operation. A crash after append resumes the same attempt ID through existing delivery idempotency; a crash before append consumes nothing. No separate consumption ledger or scheduler is introduced.

This path does not write `stale_superseded`, count as stale progress, or change the SRE stale predicate. It requires a narrow amendment to WEC and a review decision on whether SRE Goal CASE 4 needs an explicit exception stating that its existing stale path remains prohibited while the new, independently authorized WEC path may resume only after a fresh post-dispatch Owner resolve. If that would alter the stable meaning of CASE 4, create a successor acceptance test/contract rather than silently reinterpreting it.

### Attempt budget and boundedness

Keep `maxAttemptsPerVisit` as the bound on unapproved automatic attempts; do not reset the generation counter or disguise an Owner-authorized run as automatic continuation. One fresh, eligible case resolved by the Domain Owner may authorize exactly one additional generation beyond the automatic cap. For a policy-origin case, the persisted case binds the triggering attempt and dispatch intent; for a normal case, the service verifies its requester was the current assignee on that visit. In both cases, the Owner’s separate resolve is the explicit authorization. This is finite and cannot be initiated as a self-retry: after the resumed attempt settles, another generation requires a new case opened after that attempt’s dispatch and a new Owner resolution. Replays of the same case, same event sequences, or same due row cannot authorize another run. `run_outcome_unknown` is never overridden by Owner resolution.

## Review / acceptance checks

The follow-up source implementation should test these cases against actual svc routes and the existing Core ledger, once separately authorized:

- A settled, known `run_ended_no_submission` attempt plus a normal same-visit case opened by the current assignee and resolved after its dispatch baseline admits one new generation and records the exact case marker in the existing ledger.
- The same success path works for a WEC1-005 policy case bound to the exact triggering attempt and dispatch intent. Its requester may be a system principal; it is not asserted to be the node executor.
- Replaying the due row, companion result, same case, same generation, or reloading after a crash cannot create a second attempt; crash after ledger append resumes the same attempt ID.
- Two cases resolved before the resumed dispatch admit one attempt only; neither old case can authorize a later generation. A fresh case opened/resolved after the resumed dispatch can authorize one further attempt.
- `run_outcome_unknown`, pending/unsettled Router turn, unverified delivery, earlier event sequence, altered visit/activation/assignee/owner, normal-case requester mismatch, unsupported ingress, policy-case mismatched triggering attempt/dispatch intent, non-Owner resolution, mismatched case, or missing event link refuses admission with no ledger mutation or delivery.
- Automatic cap remains unchanged; a distinct explicit Owner resolution authorizes only one extra attempt, and no prompt text or agent assertion can substitute for svc evidence.
- Existing SRE stale cases remain byte-for-byte ineligible under Assistance-driven version changes; existing quiescence and old-transition fencing remain intact.
- Service access is restricted to the existing global scheduler read binding; no read path exposes payload bodies or creates/upgrades capabilities.

## Exact pointers and repository state

Core fresh base is `90d53b6200d3825f8b7c1e24533af28637085dab`.

- `docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V1.md`: CTR-WEC1-004 (automatic cap and unknown exclusion), CTR-WEC1-005 (Owner Assistance and stable wake).
- `docs/specs/AGENT_CORE_WORKFLOW_STALE_REENTRY_V1.md`: CTR-SRE-003 (stale-only generation N+1); Goal CASE 4 (Assistance activity is not stale).
- `packages/workflow-execution/src/ledger.js`: `beginAttemptIfAbsent` returns `already_attempted` for existing attempt; ledger is the current generation fence.
- `packages/workflow-execution/src/ledger-events.js`: `attempt_planned` currently admits later generations only through stale predecessor rules.
- `packages/workflow-execution/src/judgment.js`: settled worker on a still-current visit yields `NEEDS_REVIEW/run_ended_no_submission`.

Svc current main is `1be4c6685315df6c05adf2917b084b4d74e21f2c`.

- `docs/specs/SVC_WORKFLOW_VISIT_ACTIVATION_IMPL_V1.md`: CTR-VAI-009 exact due DTO and GLOBAL_SCHEDULER_READ gate.
- `docs/specs/SVC_WORKFLOW_EXECUTION_CONTROL_V1.md`: CTR-SWEC-006 excludes open OWNER_PENDING/HUMAN_REQUIRED cases from due rows; resolution restores due eligibility.
- `migrations/0021_workflow_assistance_v1.sql`: persisted case identity/status/requester/resolver/command fields; only one *open* case per visit is constrained, so multiple historical cases can exist.
- `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/generic-assistance-branch-luna-20261027/README.md`: current-assignee ordinary open and separate Domain Owner read/action identities; task artifact only, not a live HTTP result.
- `migrations/0004_workflow_events.sql`: durable per-instance event sequence and command correlation suitable for ordering request/resolve against dispatch state version.
- `src/store/postgres/workflow_instance_repository/query_dispatch_intents.rs`: current due projection does not return a case marker.

No service or product source is modified by this packet. Production authorization remains `NONE`.
