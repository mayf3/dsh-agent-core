# Control plane V1 — authority authoring and execution boundary

## Mandate and coordinates

Issuer: repository Owner in task `01a0ad06-249f-7632-809b-961b93c3b113`, 2026-09-17.
Input: attached `pasted-text.txt`, Goal `PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1`.
Authorized effects: fresh read-only investigation; design, implement and verify
within accepted repository authority. Explicit prohibition: no production mutation
until independent review and separate Owner privileged bootstrap authorization.
This stage writes only proposed authority, investigation and sanitized observations.

Parent/base: `d602b592fad345fb1c9adebe2bc6611a6f5cfdc2`.
Isolated branch: `codex/production-deployment-control-plane-v1` at
`/Users/yanfenma/workspace/worktrees/production-deployment-control-plane-v1`.
Shared dirty checkout, other candidates, production locks and running services are preserved.

## DEVELOPMENT_PREFLIGHT

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT -> AUTHOR
TARGET_REPOSITORY = mayf3/dsh-agent-core
BASE_HEAD = d602b592fad345fb1c9adebe2bc6611a6f5cfdc2
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO (new control-plane authority)
GOAL_OR_TARGET = shared autonomous deployment with one production mutation lane
CURRENT_GAP = per-Goal wrappers, divergent mutexes, interactive sudo and main drift
AUTHORITY_ACTION = NEW
PRIMARY_AUTHORITY = NONE for new durable deployment interface
RELATED_AUTHORITIES = accepted hardening Program; Watchdog; Scheduler reconciliation;
  Session Send standalone/V2; Lark UX V3; offline pnpm; active local governance
IMPLEMENTATION_AUTHORITY = none until proposed control-plane Spec accepted in base
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
EXECUTION_MANDATE = VALID for this isolated docs/read-only stage only
MUTATION_AUTHORIZATION = VALID for this isolated docs stage
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = YES before privileged bootstrap
SPEC_GAP_DEPENDENCY = LOAD_BEARING
EVIDENCE_REVIEWABILITY = PASS for bounded census; privileged completeness unproven
LIVE_AUTHORITY_GAP = NONE introduced by this stage
OWNER_DECISION_REQUIRED = YES (new Product Authority acceptance)
EMERGENCY_STATE = NONE
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO (independent review and Owner acceptance pending)
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = independent Spec review, accepted base; later security/runtime proof
DONE_WHEN = reviewable proposed authority and census with exact next boundary
EXPANSION_TRIGGER = active conflicting authority or concrete review blocker
NEXT_REAL_ACTION = independent review of exact proposed authority
NEXT_ACTION = RE_PREFLIGHT (resolved NEW docs-first route; no implementation)
```

Supersession check: stage-isolation accepted-looking revision is absent from main;
no automatic acceptance transfer. Existing narrow product/deployment authorities
do not permit this new root API. Preserve domain acceptance and business semantics.

## Staged execution checkpoints

This is a phase outline for review, not an executable production runbook.
After authority acceptance, re-PREFLIGHT as REUSE and create the implementation plan
against the accepted exact revision. Do not modify that governing Spec in the code PR.

| Phase | Work | Required exit evidence |
|---|---|---|
| A — authority (current) | census, immutable Unit/Train/controller/standing-authority contracts | independent exact-Head Spec review, Owner acceptance and merge |
| B — nonprivileged core | canonical encoding, queue/DAG/dedupe, trusted issuance adapters, coverage and outbox | negative tests: duplicate submit/revert/stale epoch/missing dependency/mixed Goal outcomes |
| C — privileged source in isolation | native socket/peer validation, protected intake, fixed profile engine, journal/mutex/recovery | disposable macOS integration and all injection/TOCTOU/rollback/bypass tests; no production paths reachable from fixtures |
| D — independent security review | exact controller, trust chain, profiles, target inventory, retirement changes and bootstrap package | frozen blocker union; one repair pass and exact re-audit; no author self-approval |
| E — concrete bootstrap package | hashes, exact paths/UID/GID/ACL/group, allowed effects, rollback, attempts, verification | complete reviewable package; separate Owner permission is the final gate before privileged action |
| F — authorized adoption | install disabled daemon; retire old entrances; activate reviewed profiles and canary | root/service identity readback, legacy denial, concurrency=1, crash recovery, no interactive normal sudo |
| G — real Train completion | authenticated ready census; joint artifact; dependency order; Goal receipts | real one-install/multi-Goal evidence; success closes independently; every requested final gate proven |

Root Watchdog code is an explicit security-review surface; auth-service and
svc-workflow need owning-repo authority and exact metadata transitions. An
app-only profile does not silently gain these permissions. Partial rollout cannot
close this whole Goal. A failed source build/review creates no privileged bootstrap.

## Verification and current result

This stage has no production implementation. Future test definitions in the Spec
are not executed proof. Source hashes and six service observations are in the
sanitized census; permission-denied surfaces are recorded explicitly.

```text
CONTROL_PLANE_SOURCE_FIXED = NO
SPEC_STATUS = proposed
SPEC_ACCEPTED_IN_BASE = NO
INDEPENDENT_SPEC_REVIEW = PENDING
PRIVILEGED_SECURITY_REVIEW = NOT_STARTED
PRIVILEGED_BOOTSTRAP_ALLOWED = NO
PRODUCTION_MUTATION_PERFORMED = NO
LEGACY_CANONICAL_DEPLOYMENT_ENTRANCES_EXITED = NOT_PROVEN
GOAL_COMPLETE = NO
```

The next Owner action, after independent review, is acceptance of the proposed
Product Authority. It is not an artifact deployment approval and does not authorize
root bootstrap. This boundary comes from `.agents/README.md` docs-first route and
`.agents/local/README.md` local operating loop, in addition to the explicit task
prohibition on privileged bootstrap before separate authorization.
