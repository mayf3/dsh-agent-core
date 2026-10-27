# Owner Assistance resolution and workflow resume — review candidate

Status: **candidate for independent review; not an accepted contract and not an implementation authorization**.

> Final review target (2026-10-28): the concrete proposal is now
> `AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V2`,
> `AGENT_CORE_WORKFLOW_STALE_REENTRY_V2`, and svc
> `SVC_WORKFLOW_EXECUTION_CONTROL_V1` CTR-SWEC-010. The sketches below are
> historical proposal development, not the final DTO or acceptance target.
> Root selected whole-authority Core successors because accepted admission
> semantics change; svc remains additive. The V1 bodies are unchanged and
> their status/backlinks are part of the proposed atomic acceptance transaction.
> Source and isolated validation only; production apply authority NONE.
>
> Review artifacts and reproducible scratch-apply byte checks:
> `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/a20-native-fixture-contract-review/finalized/manifest.json`.
> `core-body-semantic-delta.patch` isolates the new semantics from the carried
> V1 text; `build_proposal.py` generates complete patch bodies with difflib
> and actually applies them to fresh copies of the pinned base files.

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

Return the current activation identity and at most one eligible case marker, or `null`: `dispatchIntentId`, `workflowInstanceId`, `nodeVisitId`, `ownerPrincipalId`, `currentWorkflowStateVersion`, and `{assistanceCaseId, requestedByPrincipalId, resolvedByPrincipalId, requestEventSequence, resolutionEventSequence, ingressKind, reason, lastAttemptId}`. The service derives all IDs from persisted rows; callers cannot supply a requester or resolver identity. Support the two existing ingress shapes: (a) a normal Assistance case opened by the current activation assignee, where `requestedByPrincipalId` must equal the current `ownerPrincipalId`; or (b) the WEC1-005 execution-policy ingress, where the requester is the system execution caller and svc must attest `ingressKind: execution_policy` plus persisted `lastAttemptId` and `dispatchIntentId` bound to the immediately preceding Core attempt and exact due activation. Do not equate the policy caller with the node executor. In either case, the case must be for that same visit/instance, remain `RESOLVED`, and its resolution must be an explicit Domain Owner action authorized by svc. Request and resolution sequences must be joined through the case's exact request/resolution command IDs to the exact workflow event types and case ID; do not infer them from mutable case timestamps or wall-clock order. No Assistance payload, free text, credentials, or audit body is returned.

The query takes the previous attempt’s durable `preDeliveryWorkflowStateVersion` as a lower bound and requires both `requestEventSequence` and `resolutionEventSequence` to be strictly greater than that baseline, with resolution sequence greater than request sequence. It returns the earliest qualifying case by `(resolutionEventSequence, assistanceCaseId)` so selection is deterministic. This pre-delivery baseline is read from fresh workflow detail and appended to the new attempt plan before any Router invocation; it is distinct from the existing post-delivery `workflowStateVersionAtDispatch` field and is never reconstructed from a later read. Svc main’s existing event writer sets `event_sequence = new_workflow_state_version`, which supplies the same monotonic scale for this comparison. A missing pre-delivery baseline makes the attempt ineligible for Assistance recovery. A follow-up attempt stores the selected case ID and its sequence evidence in the existing Core attempt ledger. If multiple cases were already resolved for that same baseline, the follow-up consumes exactly one marker; after that new attempt is planned, all older markers are before its new baseline and cannot authorize another attempt. A further attempt requires a new case opened after that attempt’s own pre-delivery baseline, then a distinct explicit Domain Owner resolution.

This is a new service read capability/DTO, not present in the accepted service contract today. Candidate source owner: `svc-workflow`, amending `SVC_WORKFLOW_EXECUTION_CONTROL_V1` (new CTR) while preserving VAI-009 unchanged. Existing read surfaces do not suffice: owner detail requires a case ID and owner visibility; `requested-by-me` is tied to requester identity; the global scheduler due feed does not expose a case ID or event marker.

### Core owner: one-use, recoverable admission in the existing ledger

Add a separate `owner_assistance_resolved` admission reason to WEC, distinct from SRE `stale_no_progress`. It is eligible only when all of these are true:

1. For the normal cross-turn path, the prior attempt is terminal `NEEDS_REVIEW/run_ended_no_submission`, its Router/turn reconciliation is positively `settled`, and its recorded delivery is known. `outcome_unknown`, unresolved/pending execution, unavailable reconciliation, delivery ambiguity, or any other terminal judgment fail closed and remain non-replayable.
2. The authoritative current due activation still matches the prior attempt’s `dispatchIntentId`, `workflowInstanceId`, `nodeVisitId`, and `ownerPrincipalId`; it remains active and on the same current visit/assignee. A moved visit, changed activation, or changed owner rejects the proof.
3. Svc returns one qualifying resolved marker whose request and resolution event sequences are both after the prior attempt’s dispatch baseline, and whose ingress proof is either a normal current-assignee request (`requestedByPrincipalId == ownerPrincipalId`) or the execution-policy case with matching `lastAttemptId` and `dispatchIntentId`. Core does not equate the policy caller with the executing assignee. Svc attests that `resolvedByPrincipalId` was authorized for the explicit Domain Owner resolve action. Core resolves the existing canonical Principal→Agent authority afresh before delivery.
4. Before planning a resumed generation, Core executes a narrowly scoped async pre-plan evidence read while holding the existing ledger fence: fresh-read the exact current activation detail and obtain `preDeliveryWorkflowStateVersion`. It then records that baseline inside the same durable `attempt_planned` append that contains the next generation, dispatch identity, `retryReason: owner_assistance_resolved`, `previousAttemptId`, exact case ID, and request/resolution sequence pair. Under the existing ledger lock/fence, that one append is the durable one-use consume and generation mint. The reducer rejects reuse of a case ID, nonmatching identity/baseline, a nonterminal/unknown predecessor, or duplicate generation. If no baseline can be read, Core does not mint or consume the marker.
5. There is one narrow crash-safe pre-delivery continuation for an Owner-resume attempt only: before ordinary reconciliation terminalizes the marked `phase: planned` attempt with no `delivery_started`, Core uses the existing Router caller-correlation read for the same stable `requestId = attemptId`. It also re-reads the current activation detail and requires the exact same dispatch intent, instance, visit, assignee Principal, and state version as the stored pre-delivery baseline. Only a positive `never_existed` result with no attributable handle/message/session fields permits fresh Principal→Agent resolution and delivery under the *same* attempt ID; it does not create another generation or consume another case. Any non-`never_existed` result, mismatch, unreadable/error, or missing marker/baseline skips delivery and falls through to the existing `reconcileOnce`/`judgeAttempt` path, which appends its normal `reconciled` event with `NEEDS_REVIEW/delivery_unverified`. The existing planned-attempt fence then prevents replay. Once `delivery_started` exists, the existing write-ahead/unknown-outcome rules remain unchanged and no replay is added. A crash before `attempt_planned` consumes nothing. No separate consumption ledger or scheduler is introduced.

This path does not write `stale_superseded`, count as stale progress, or change the SRE stale predicate. It requires a narrow amendment to WEC and an explicit SRE clarification: Assistance version changes remain non-stale, but a separately authorized `owner_assistance_resolved` attempt is admitted only by the new WEC path. If that changes the stable meaning of Goal CASE 4, create a successor acceptance test/contract rather than silently reinterpreting it. An Owner-resumed attempt that ends without transition is not eligible for automatic stale re-entry; any later attempt requires a new eligible case and explicit Owner resolution.

### Attempt budget and boundedness

Keep `maxAttemptsPerVisit` as the bound on unapproved automatic attempts; do not reset the monotonic generation counter. A fresh eligible case resolved by the Domain Owner authorizes exactly the next generation immediately, whether the current generation is below or at the automatic cap; the explicit case is a one-run exception, not permission to reset the counter. For a policy-origin case, the persisted case binds the triggering attempt and dispatch intent; for a normal case, the service verifies its requester was the current assignee on that visit. In both cases, the Owner’s separate resolve is the explicit authorization. After an Owner-resumed attempt settles without a transition, no automatic stale continuation is allowed; another generation requires a new case opened after that attempt’s own pre-delivery baseline and a new Owner resolution. Replays of the same case, same event sequences, or same due row cannot authorize another run. `run_outcome_unknown` is never overridden by Owner resolution.

## Review / acceptance checks

The follow-up source implementation should test these cases against actual svc routes and the existing Core ledger, once separately authorized:

- A settled, known `run_ended_no_submission` attempt plus a normal same-visit case opened by the current assignee and resolved after its dispatch baseline admits one new generation and records the exact case marker in the existing ledger.
- The same success path works for a WEC1-005 policy case bound to the exact triggering attempt and dispatch intent. Its requester may be a system principal; it is not asserted to be the node executor.
- Replaying the due row, companion result, same case, or same generation cannot create a second attempt. A crash after the Owner-resume `attempt_planned` append follows the planned-only correlation rule below and can resume only the same attempt ID.
- Crash after an Owner-resume `attempt_planned` append but before `delivery_started` resumes the same attempt ID only when fresh activation identity/version still matches and Router correlation is `never_existed` with no attributable fields; missing, unknown, or other correlation status falls through to existing terminal `NEEDS_REVIEW/delivery_unverified`. No new generation or case consumption occurs. `delivery_started`-and-later crash behavior remains under the current unknown fence.
- Two cases resolved before the resumed dispatch admit one attempt only; neither old case can authorize a later generation. A fresh case opened/resolved after the resumed dispatch can authorize one further attempt.
- `run_outcome_unknown`, pending/unsettled Router turn, unverified delivery, earlier event sequence, altered visit/activation/assignee/owner, normal-case requester mismatch, unsupported ingress, policy-case mismatched triggering attempt/dispatch intent, non-Owner resolution, mismatched case, or missing event link refuses admission with no ledger mutation or delivery.
- Automatic cap remains unchanged; a distinct explicit Owner resolution authorizes only one extra attempt, and no prompt text or agent assertion can substitute for svc evidence.
- An Owner resolution at generation 1 is immediately usable and admits only generation 2; after that Owner-resumed attempt, no automatic stale continuation can admit generation 3 without a fresh case/resolve, regardless of remaining automatic cap.
- Existing SRE stale cases remain byte-for-byte ineligible under Assistance-driven version changes; existing quiescence and old-transition fencing remain intact.
- Service access is restricted to the existing global scheduler read binding; no read path exposes payload bodies or creates/upgrades capabilities.

## Exact pointers and repository state

Core fresh base is `90d53b6200d3825f8b7c1e24533af28637085dab`.

- `docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V1.md`: CTR-WEC1-004 (automatic cap and unknown exclusion), CTR-WEC1-005 (Owner Assistance and stable wake).
- `docs/specs/AGENT_CORE_WORKFLOW_STALE_REENTRY_V1.md`: CTR-SRE-003 (stale-only generation N+1); Goal CASE 4 (Assistance activity is not stale).
- `packages/workflow-execution/src/ledger.js`: `beginAttemptIfAbsent` returns `already_attempted` for existing attempt; ledger is the current generation fence. `attempt_planned` precedes resolution/delivery callback.
- `packages/workflow-execution/src/judgment.js` and `src/recovery.js`: current planned attempts are classified `delivery_unverified` and recovery refuses them as `not_pre_admission_blocked`; the proposed owner-resume-only exception must be added without changing other phases.
- `packages/workflow-execution/src/engine.js`: current `workflowStateVersionAtDispatch` probe happens after `router.deliver`; the new durable `preDeliveryWorkflowStateVersion` must be collected and stored before invoking Router, not inferred from the existing field.
- `packages/workflow-execution/src/ledger-events.js`: `attempt_planned` currently admits later generations only through stale predecessor rules.
- `packages/workflow-execution/src/judgment.js`: settled worker on a still-current visit yields `NEEDS_REVIEW/run_ended_no_submission`.

Svc fresh main after PR #92 is `f0188b7c14ee786575b6b8aa6fb08c36444fef05` (the relevant workflow spec remains unchanged by PR #92).

- `docs/specs/SVC_WORKFLOW_VISIT_ACTIVATION_IMPL_V1.md`: CTR-VAI-009 exact due DTO and GLOBAL_SCHEDULER_READ gate.
- `docs/specs/SVC_WORKFLOW_EXECUTION_CONTROL_V1.md`: CTR-SWEC-006 excludes open OWNER_PENDING/HUMAN_REQUIRED cases from due rows; resolution restores due eligibility.
- `migrations/0021_workflow_assistance_v1.sql`: persisted case identity/status/requester/resolver/command fields; only one *open* case per visit is constrained, so multiple historical cases can exist.
- `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/generic-assistance-branch-luna-20261027/README.md`: current-assignee ordinary open and separate Domain Owner read/action identities; task artifact only, not a live HTTP result.
- `migrations/0004_workflow_events.sql`: durable per-instance event sequence and command correlation suitable for ordering request/resolve against dispatch state version.
- `src/store/postgres/workflow_instance_repository/assistance_transaction/write.rs`: ordinary open records the authenticated requester; Owner resolve records its authenticated resolver and command ID.
- `src/store/postgres/workflow_instance_repository/query_dispatch_intents.rs`: current due projection does not return a case marker.

No service or product source is modified by this packet. Production authorization remains `NONE`.

## Proposed amendment file scope

This candidate requires two exact contract amendments and a bounded Core implementation/test delta:

- Core `AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V1`: add a distinct Owner-resolved retry reason, stable case/event marker fields in `attempt_planned`, durable pre-delivery baseline, one-use admission, immediate one-generation Owner permission, and planned-only `never_existed` continuation. Do not alter the existing post-delivery `workflowStateVersionAtDispatch` meaning.
- Core `AGENT_CORE_WORKFLOW_STALE_REENTRY_V1`: clarify Goal CASE 4 remains non-stale and add only the explicit WEC Owner-resolved path; add that an Owner-resumed failed attempt is not eligible for automatic stale re-entry. The stale predicate and `stale_superseded` event remain unchanged.
- Svc `SVC_WORKFLOW_EXECUTION_CONTROL_V1`: add the restricted read-only companion DTO and case eligibility rules for the two existing ingress kinds. Keep VAI-009 exact seven fields and `GLOBAL_SCHEDULER_READ` gate unchanged.
- Core source/tests, after contract acceptance: `packages/workflow-execution/src/{engine.js,ledger.js,ledger-events.js,judgment.js,recovery.js}` plus focused ledger/engine/recovery tests. No other recovery category, source identity, Router-delivered attempt replay, UI/HR policy, new scheduler, side ledger, or production scope is in this amendment.
- Svc source/tests, after contract acceptance: only the route/handler/query/OpenAPI and focused tests needed to derive the case marker from existing assistance rows and workflow events; no new persisted case status or side ledger. PR #92 head `0fb2fa213773a01d7e41af1d226db5c12e1c4287` is now merged to svc main `f0188b7c14ee786575b6b8aa6fb08c36444fef05`; do not drop its token-renewal implementation while preparing that contract.

The acceptance metadata of either governing Spec must not be edited until Root accepts the exact amendment body. This investigation is not itself implementation authority.

## Proposed contract text for insertion

The following is the minimal normative text proposed for the corresponding amendments. IDs are placeholders for the Spec owners to assign without colliding with accepted CTRs.

**Svc companion read (new CTR under SWEC):** An enabled `GLOBAL_SCHEDULER_READ` caller with `workflow.read` may read Owner-resume evidence for one exact active `dispatchIntentId` from the due feed. The service derives current instance, visit, assignee Principal, case status, case requester/resolver, request/resolution command IDs, and their durable event sequences. It returns at most the earliest eligible resolved case marker for the requested activation and prior-attempt `preDeliveryWorkflowStateVersion`. Eligibility requires the exact same active activation/visit/instance and current assignee; `RESOLVED`; explicit authorized Domain Owner resolver; both event sequences greater than the prior attempt baseline; request sequence less than resolution sequence; and one of (1) requester Principal equals the current assignee Principal for ordinary open, or (2) the authorized execution-policy ingress with exact prior `lastAttemptId` and `dispatchIntentId`. Event rows must match the case ID, command ID, and exact request/resolution event type. Response is identifiers, bounded enum ingress/reason, state version, and event sequences only; no payload/body. No case marker is `null`. VAI-009 response shape and role gate remain unchanged.

**Core Owner-resume admission (new CTR under WEC):** A terminal known `run_ended_no_submission` attempt with positively settled Router turn may admit exactly one next generation when the svc companion read returns the exact qualifying case and activation remains unchanged. `run_outcome_unknown`, unsettled/pending execution, missing Router proof, missing pre-delivery baseline, visit/assignee/activation mismatch, or invalid case proof refuses without delivery. A narrowly scoped async pre-plan evidence callback, executed while holding the existing ledger fence and before `attempt_planned`, obtains the fresh pre-delivery state version. Core then records `preDeliveryWorkflowStateVersion` with the owner-resume case ID, request/resolution event sequences, previous attempt ID, and next generation in one existing-ledger `attempt_planned` append. This is the one-use consume; no side ledger is added. For an Owner-resume planned record with no `delivery_started`, restart may continue the same attempt ID only after fresh existing Router caller-correlation positively returns `never_existed` with no attributable fields and fresh activation identity/version still matches. Any other correlation state or read failure falls through to existing `reconcileOnce`/`judgeAttempt`, which appends `reconciled` with `NEEDS_REVIEW/delivery_unverified`; no delivery or replay occurs. Once `delivery_started` exists, current WAE unknown/replay rules are unchanged. Owner-resumed attempts do not qualify for automatic stale re-entry; a later generation requires a distinct case requested after that attempt’s pre-delivery baseline and a fresh explicit Owner resolve. The Owner resolve authorizes exactly one next generation immediately, including before the automatic attempt cap; generation remains monotonic and the automatic cap is not reset. `run_outcome_unknown` is never overridden.

**SRE clarification/test:** Assistance-driven state-version changes remain non-stale under the existing predicate. The explicit WEC Owner-resume path is separate and must never append `stale_superseded`. CASE 4 therefore remains a stale-path refusal; add a separate positive case for a settled known attempt plus exact post-baseline Owner-resolved case, and a negative case proving an Owner-resumed failure cannot automatically stale-redispatch without a fresh case.
