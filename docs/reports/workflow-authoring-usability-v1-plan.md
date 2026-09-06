# Workflow authoring usability — execution record

GOAL = WORKFLOW_AUTHORING_USABILITY_PRODUCTION_V1
GOAL_STATUS = ACTIVE
DONE_WHEN = NORMAL_AGENT_AUTHORING_USABILITY_PRODUCTION_PASS

## Attributable mandate

Owner mayf3 dispatched the Goal in Codex task 01a07623-dea0-75a0-a693-af99c43166f4
on 2026-09-06 by `/goal 从附件里找合适的目标去执行`.
Attachment source: /Users/yanfenma/.codex/attachments/ed752131-f690-42ca-9b1f-441b1ba44458/pasted-text-1.txt
Attachment SHA256: ade195d4b1928e49898540a9ea6bb5dc29a3e3f5d9b28bfa7298901eb000bb0b
The attachment authorizes bounded investigation, docs, independent review/repair,
implementation under accepted contracts, merge, controlled deployment, normal Agent
E2E and downstream smoke. It reserves exact-head semantic acceptance to Owner and
native authentication to Owner. No runtime mutation has been attempted by this task.
The existing Goal is active; no duplicate Goal was created. This persistent record
binds the attachment's business objective, not merely its wrapper text.

## DEVELOPMENT_PREFLIGHT

Target repositories: mayf3/dsh-agent-core and mayf3/svc-workflow.
BASE_HEAD dsh = a95410e6c771c11f786a2f9a024b18931fecfdb4
BASE_HEAD svc = e297ff1f3913133058d97bb30bcf8f63b3e137f9
GitHub main freshly fetched 2026-09-06; shared checkouts not edited.
Isolated branch in both repositories: codex/workflow-authoring-usability-v1.
Dsh worktree: /Users/yanfenma/workspace/worktrees/dsh-authoring-usability-v1
Svc worktree: /Users/yanfenma/workspace/worktrees/svc-authoring-usability-v1

Lane A = NEW_SEMANTIC_AUTHORITY_REQUIRED (service public diagnostics NEW;
Broker's frozen opaque-error contract requires V3 SUPERSEDE).
Lane B = MECHANICAL_CONFORMANCE_FIX (description only under V2 CTR-WDA-008).
Lane C = NEW_SEMANTIC_AUTHORITY_REQUIRED (V2 shape-only/full-graph contract changes).
One Goal, one ExecPlan; no independent implementation or deployment of lanes is claimed.
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACTION = SUPERSEDE (dsh), NEW (svc)
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
EXECUTION_MANDATE = VALID for current docs/investigation/review stage
MUTATION_AUTHORIZATION = VALID for isolated docs candidate
IMPLEMENTATION_ALLOWED = NO until relevant authority accepted and merged
OPERATION_ALLOWED = NO until implementation/artifact/runbook gates pass
SPEC_GAP_DEPENDENCY = LOAD_BEARING
CURRENT_GAP = full graph input burden, opaque write diagnostics, missing model guidance
PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V2 at dsh base
RELATED_AUTHORITY = parent Assignee Transition DEC-011; service V6/V0.4.0/Visit Activation
RELEVANT_INVESTIGATION = WORKFLOW_DEFINITION_AUTHORING_CENSUS_V1 (historical source context)
RELEVANT_DECISIONS = external service ownership and caller-bound identity unchanged
PREVIOUSLY_REJECTED = generic authoring framework, model 3 to 2 conversion; stay rejected
NEW_EVIDENCE = V3 OBS-WDA-101..104
NEED_NEW_SPEC = YES

## Phases and gates

1. Fresh authority/source/live-file reconciliation; docs-only V3 and service diagnostics
   proposal. Record exact commit and independent fresh read-only semantic review.
2. Freeze first review BLOCKER_UNION; one bounded author repair if needed; one fresh
   read-only re-audit. Only ACCEPT with empty blocker union reaches Owner exact-head
   acceptance. Owner dispatches no reviewer. Candidate author is not its reviewer.
3. On explicit exact-head Owner acceptance: atomic lifecycle/backlinks, independent
   final lifecycle check, main merge, then REUSE preflight at exact accepted heads.
4. Implement minimal handler/manifest, model guidance and service diagnostic/receipt
   mapping. Focused tests, actual disposable composed integration, relevant regression,
   structure/governance gates; baseline comparison for suspected environment failures.
5. Fresh independent implementation audit over exact heads; freeze blocker union once,
   one bounded repair and fresh affected-boundary re-audit if necessary. Merge only PASS.
6. Build exact release artifacts, record closure/provenance; controlled runbook pins
   production targets, actor, deployment preimages, health, abort/rollback, secrets held
   locally, durable attempt receipt, post-state independent readback. Production mutation
   concurrency = 1; fresh lock census once, claim slot only when apply-ready; native
   authentication only if needed. Unknown outcome is reconciled without replay.
7. Normal model-facing Agent request -> canonical domain/assignee discovery -> definition
   and model-3 draft -> simple steps -> canonical validation -> publish -> exact-version
   instance; one HR/target execution/self-transition smoke. Save traces/readbacks/health.
8. COMPLETE only when every attached production completion condition is evidenced.

## Expansion and stop controls

EXPANSION_TRIGGER = changed accepted contract, candidate semantic drift, real conflict,
failed affected test, identity/auth gap, unknown production attempt or materially unhealthy
baseline. Re-preflight the affected boundary; do not reopen completed dependencies.
No Scheduler/HR/Visit Activation/Session Messaging redesign. Other Goals' priorities
from the attachment are retained as production-slot constraints; no other task has been
silently interrupted or edited. Unrelated observations = FOLLOW_UP_DEBT.

## Current evidence

V3 OBS-WDA-101..104 pin source/main and deployed Broker manifest hash. Runtime file
identity is not a claim of loaded process/catalog or production E2E. All production
completion rows remain NOT_RUN. Independent semantic review is pending.
