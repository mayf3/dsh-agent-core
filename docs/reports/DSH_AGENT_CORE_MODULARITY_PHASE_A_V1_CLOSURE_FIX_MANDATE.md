# DSH_AGENT_CORE_MODULARITY_PHASE_A_V1_CLOSURE_FIX — Owner Mandate Record

```text
SOURCE_KIND = direct Owner execution directive supplied in the ChatGPT task
SOURCE_DATE = 2026-09-24
SOURCE_SHA256 = 13245acaea57ba547e90b536c14b36c0af6ad0cd982868e02a6435f82ca8cf67
SOURCE_BYTES = 12674
SOURCE_LINES = 586
GOAL = DSH_AGENT_CORE_MODULARITY_PHASE_A_V1_CLOSURE_FIX
PARENT_GOAL = DSH_AGENT_CORE_MODULARITY_PHASE_A_V1
TASK_TYPE = SOURCE_CLOSURE_FIX
OLD_CANDIDATE_SHA = b6ecc52ac63c17bde1aee6a211c025ac861feced
PRODUCTION_MUTATION = FORBIDDEN
DEPLOYMENT_SYSTEM_CHANGE = FORBIDDEN
```

## Load-bearing Owner directives

The Owner directed the source lane to close exactly two independently discovered blockers before returning a new exact candidate to the Deployment Agent:

1. **Trusted-pack closure** — the canonical trusted app must contain the identity package root public entry (`app/packages/agent-identity-capabilities/index.js`) in addition to `package.json` and `src/**`, and `production-runtime/src/compose.js -> ../../agent-identity-capabilities/index.js` must resolve directly from the packed app. Manual `ln -s`, `node_modules` bridge, live-app patch, and Deployment-Agent post-pack copy are forbidden.
2. **Governing authority closure** — perform a fresh authority audit. If no accepted authority explicitly covers identity provider extraction, provider relocation, and the generic Broker LOCAL-handler composition seam, create the minimum governing Spec/amendment under the repository's docs-first governance and complete independent review + compliance.

Scope is frozen to trusted-pack closure, governing authority closure, required fresh-main mechanical integration, tests, and review evidence. The directive explicitly forbids new identity semantics, Auth scope/audience redesign, Workflow/Scheduler redesign, dynamic capability loading, generic plugin architecture, Deployment System redesign, credential topology changes, persistence/state migration, and model-routing changes.

The Owner further requires preservation of:
- the real reverse-principal child → relay → Router parent-RPC → Broker gateway → `agentPrincipalReverseResolutionAccess` chain;
- the generic LOCAL handler seam without changing capability IDs, model-visible contracts, trusted-caller semantics, or Auth boundaries;
- workflow shutdown ordering: await workflow engine drain → scheduler stop → context/router disposal.

## Required closure gates

The Owner requires all of the following before source closure may be declared:

```text
SPEC_GATE = PASS
SPEC_COMPLIANCE = PASS
TRACKED_ONLY_CLOSURE = PASS
TRUSTED_PACK_CLOSURE = PASS
IDENTITY_PACKAGE_PACKED = YES
IDENTITY_PACKAGE_RESOLUTION = PASS
REVERSE_PRINCIPAL_WIRING = PASS
WORKFLOW_SHUTDOWN_DRAIN = PASS
CANDIDATE_ONLY_DETERMINISTIC_REGRESSION = NONE
INDEPENDENT_REVIEW = PASS
SOURCE_COMPLETE = YES
DEPLOYMENT_READY = YES
CURRENT_BLOCKER = NONE
PRODUCTION_MUTATION = NO
```

The Owner expressly superseded the old deployment-ready claim for `b6ecc52ac63c17bde1aee6a211c025ac861feced`: a new exact candidate SHA/tree must be produced after closure.

## Authority use

This record persists the Owner's execution mandate so the lifecycle transaction for `DSH_AGENT_CORE_MODULARITY_PHASE_A_V1` can bind acceptance to:
- the reviewed proposed Spec commit;
- the independent semantic review record; and
- this Owner directive.

It is **not** Production Apply Authority and grants no permission to deploy, restart, or mutate live production.
