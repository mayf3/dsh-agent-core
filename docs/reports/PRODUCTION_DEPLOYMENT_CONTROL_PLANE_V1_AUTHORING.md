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

## Independent review round 1 and bounded repair

Reviewer `/root/dcp_spec_review` did not author the semantic delta. Reviewed exact
head `dc658bb611c85b8c0bc2045d94e1b598bfa2c23d` against base `d602b592fad345fb1c9adebe2bc6611a6f5cfdc2`.
Result: `SPEC_REVIEW=REVISE`; authority, mandate and bounded evidence review PASS;
Contract/acceptance review required the following frozen revision union:

| Finding | Source / reachable counterexample | Minimum closure in revision 2 |
|---|---|---|
| B1 SECURITY_OR_DATA_LOSS | task forbids per-Goal restart/mutex bypass; uid 502 can still launchctl-restart or signal its GUI service after file chown | CTR-018 forbids enrollment until lifecycle/signaling control is separated; svc-workflow current GUI profile disabled; ACC-013 covers direct denial |
| G1 LOAD_BEARING SPEC_GAP | artifact-only permanent dedupe strands valid A→B→A or safe rollback recovery | CTR-002/003 separate artifact/request/daemon intent/attempt; CTR-010/011 define bounded recovery and queue resume; ACC-002/009 reject wrong behavior |
| F1 FOLLOW_UP, mechanical | phase2 cited but not hashed; initially checked socket spelling differs from proposal | append exact phase2 hash and proposed socket observation; preserve initial observations and explicit supplement timestamp |

The revision is still NEW/proposed authority authoring. No accepted Contract was
changed and no privileged enrollment/migration was performed. Re-audit is limited
to the frozen union, changed semantics and directly affected evidence.

Executed mechanical validation of round-1 candidate:

- Governance bytes/accepted adoption integrity: PASS.
- New Spec frontmatter lifecycle validation: PASS (no errors).
- Contract/Acceptance reverse coverage: 20/20, 14 acceptance rows; valid local links
  and parseable sanitized census JSON. This proves document coverage, not behavior.
- `git diff --check`: PASS.
- Code structure verifier: exit 1 on both exact base/base and base/candidate.
  The three violation records are identical: `packages/production-runtime/src`
  21 children, `packages/production-runtime/test` 23, `scripts` 59. New violations=0;
  unrelated baseline debt is preserved. Do not report the full structure gate PASS.
- No product tests executed or claimed: this revision changes only documents.
