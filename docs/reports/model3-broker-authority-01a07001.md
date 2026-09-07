# Bounded model-3 Broker authority preparation

## Attributable mandate and isolation

Issuer: Owner/user in Goal VISIT_ACTIVATION_DISPATCH_PRODUCTION_V1, 2026-09-05,
thread 01a07001-26f2-71b3-a6f4-94c37d10cd44. Latest ruling authorizes bounded
investigation, minimal Authority authoring, independent review and exact-head
acceptance preparation, without asking about engineering choices. Target is
mayf3/dsh-agent-core existing authoring surface. Allowed effect now: docs-only
whole successor plus this preparation record. Forbidden: implementation before
accepted authority, production mutation, workflow_execute changes, scope/Grant,
Scheduler, Session Messaging, generic model framework. Done when exact proposed
head and implementation plan are reviewable. Parent/base:
`ec074d568f7b99ec76118e6d45abab410b55198d`. Isolated branch:
`codex/model3-broker-authority-01a07001`; isolated worktree:
`/Users/yanfenma/workspace/project/dsh-model3-broker-authority-01a07001`.

## DEVELOPMENT_PREFLIGHT

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
BASE_HEAD = ec074d568f7b99ec76118e6d45abab410b55198d
CURRENT_BASE_HEAD = ec074d568f7b99ec76118e6d45abab410b55198d
REVIEW_TARGET_HEAD = recorded by exact commit delivery after this record commits
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO (new V2; V1 remains active)
GOAL_OR_TARGET = same authoring path accepts and transmits exact model 3
CURRENT_GAP = DEC-005 and CTR-WDA-001 limit accepted Broker models to 1/2
AUTHORITY_ACTION = SUPERSEDE
PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V1@ec074d568f7b99ec76118e6d45abab410b55198d
RELATED_AUTHORITIES = Product Architecture; assignee transition capability; svc CTR-VAI-001@22e862af8e47050ae1bf9e7c5db7eb22a4d81ee7
IMPLEMENTATION_AUTHORITY = contracts (proposed, not active)
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
EXECUTION_MANDATE = VALID (docs-only owner task above)
MUTATION_AUTHORIZATION = VALID
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = NO (authoring only; YES for later production operation)
SPEC_GAP_DEPENDENCY = LOAD_BEARING
EVIDENCE_REVIEWABILITY = PASS (exact Git blobs)
LIVE_AUTHORITY_GAP = NONE (no new live behavior asserted)
OWNER_DECISION_REQUIRED = YES (independently reviewed exact-head acceptance only)
EMERGENCY_STATE = NONE
EMERGENCY_ACTION = NONE
INCIDENT_REFERENCE = NOT_APPLICABLE
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = exact independent review; lifecycle final-head check after acceptance
DONE_WHEN = reviewable proposed authority and bounded implementation plan delivered
EXPANSION_TRIGGER = only a contradicting accepted authority or genuine product ambiguity
NEXT_ACTION = CONTINUE
```

Current `.agents/README.md`, local governance, AUTHOR mode and Spec format were
read at this exact base. Scope search covered Workflow Specs, decisions and
investigations; the explicit current WDA DEC-005/CTR-WDA-001 resolves ownership.
V1's model-3 follow-up is not a rejected business direction. New evidence is the
Goal requiring formal model-3 authoring plus accepted svc CTR-VAI-001 defining its
exact meaning. No architecture reinvestigation is required.

## Minimal implementation plan (after acceptance and merge)

1. Re-pin authority/base, create isolated implementation branch. Change only
   `packages/broker/src/capabilities/workflow-definition-authoring.js` draft
   `semanticModelVersion` enum from `[1, 2]` to `[1, 2, 3]`.
2. Extend focused `packages/broker/test/capabilities/workflow-definition-authoring.test.js`
   to prove catalog and handler accept/transmit number 3; preserve 1/2/omitted;
   reject 0/4/string/null/fraction with zero writes; keep existing trusted seams.
3. Use svc's separately governed decoder/authoring repair in a disposable local
   real-service composed proof. All authoring goes through existing Broker tool;
   unchanged create_instance and canonical readback bind model 3 and published ID.
   Negative graph validation stays service owned. Preserve existing model-2 proof.
4. Run focused tests and existing structure verifier; one independent implementation
   audit covers changed contracts and directly dependent preserved invariants.
   Freeze its complete blocker union, one repair and one re-audit if necessary.
5. Integrate audited exact candidate. Prepare narrow Broker artifact with actual
   live preimage, import closure, rollback and deployment gate. Do not deploy latest
   main wholesale. Coordinate svc artifact under same Goal; no automatic production
   action follows merely from Spec acceptance.

## Bounded production impact

The planned Broker delta is one integer enum value plus tests. Same tool, four
operations, endpoint, path/body mapping, scope, principal, token and idempotency
behavior. No DB change, new permission or new model semantics. It depends on
service conformance and the separately authorized ownership/migration recovery.
Production preimage/rollback and native privileged execution (if required) remain
in the final execution packet. This docs-only candidate changes no runtime state.

## Review and acceptance procedure

One independent review of exact candidate; no code author self-review claim.
V1 is unchanged during proposal. On Owner acceptance, lifecycle-only atomic
V2 accepted/V1 superseded backlink transaction, final-head recheck, merge, then
implementation under REUSE. Owner receives the reviewed candidate SHA and
BLOCKERS=0 only if the independent verdict proves it; this record does not claim
review PASS or acceptance.
