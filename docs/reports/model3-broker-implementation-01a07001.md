# Model 3 Broker implementation

## DEVELOPMENT_PREFLIGHT

Target/Goal: VISIT_ACTIVATION_DISPATCH_PRODUCTION_V1, existing formal authoring
accepts/passes model 3. Owner accepted reviewed authority head
092d9c16a4ec0f6e8f60468373b1560f7e846565 and explicitly mandated lifecycle,
implementation, focused tests, independent audit and integration. This task
implements only accepted V2 contracts; no production mutation or self-merge.

```text
BASE_HEAD = 1912d582888455a049838f376759b62f295b341b
CURRENT_BASE_HEAD = 1912d582888455a049838f376759b62f295b341b
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACTION = REUSE
AUTHORITY_ACCEPTED_IN_BASE = YES
PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V2@1912d582888455a049838f376759b62f295b341b
CURRENT_GAP = manifest draft enum still 1/2
IMPLEMENTATION_AUTHORITY = contracts
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
MUTATION_AUTHORIZATION = VALID (Owner same Goal continuation)
ISOLATED_WRITE_SURFACE = YES
BRANCH = codex/model3-broker-implementation-01a07001
WORKTREE = /Users/yanfenma/workspace/project/dsh-model3-broker-implementation-01a07001
SPEC_GAP_DEPENDENCY = NONE
IMPLEMENTATION_ALLOWED = YES
OPERATION_ALLOWED = NO
DONE_WHEN = minimal enum delta, focused and real service proof, exact audit candidate
EXPANSION_TRIGGER = load-bearing accepted Contract conflict
```

Scope: one manifest enum plus focused tests and local evidence. No accepted Spec,
workflow_execute, service code, gateway/transport/trust/retry algorithm, auth/grant,
Scheduler or Session Messaging change. Deployment is separately controlled.

## Executed evidence (2026-09-05)

- Focused authoring/execute/transition suites: 19/19 PASS.
- Real service harness: PASS against clean official svc revision
  c4f1fa8d9bae7c91d9cc09751cfa8e2195c3911a; official startup applied migration 23
  in a unique disposable PostgreSQL database. Only identity/domain fixture was
  seeded; all Workflow authoring used actual Broker handlers and HTTP.
- Model-3-invalid NORMAL graph rejected with internal_consistency_error, no nodes
  persisted; TASK graph accepted and published. Canonical HTTP readback binds exact
  published version, and read-only DB inspection proves version/instance model 3.
- Published version: 41d58ca7-baf1-44f4-a41a-b0cedd237eea; instance: 8aa55e59-008a-43a4-a16b-a950dd2fdfbf.
- The same separately prepared canary flow additionally passed through actual
  registry + createRelayHandlers + gateway + scratch credential file + token/HTTP
  transport: seven fields, stable intent identity, exact assignee, two wake noops,
  terminal transition and old-intent exit. Parent RPC is an in-process adapter;
  this is local conformance evidence, never production or real-user E2E proof.
- All service/auth processes, scratch DB and local-only credentials removed.
- Existing root deps read-only linked; missing dsh-tools resolved by isolated
  packages/broker/node_modules link to installed dsh package. No dependency source
  or lockfile changed. Initial missing dependency was not counted as a test pass.

Evidence file: `/Users/yanfenma/workspace/deployment-artifacts/visit-activation-dispatch-v1/recovery-01a07001/authorized-r2/broker-implementation/model3-broker-local-e2e-01a07001.json`
SHA256: `feec3bd6e66afb2f1b580ba03a282f629ab8b7ae6cecf27016f9937ad952a811`.
Focused log in the same artifact directory: model3-broker-focused-01a07001.txt.
Reproducer in this candidate: packages/broker/test-support/model3-real-service.mjs;
first argument official release directory; optional second argument exact local
canary flow.mjs. The flow input remains deployment-preparation evidence, not new
Broker product code or a replacement of frozen Phase 2–4.

## Contract coverage

CTR-WDA-001/002/003/004/005/008: focused tests prove enum, exact unchanged wires,
trusted key/identity/scope, omitted model and invalid-value zero-write behavior.
CTR-WDA-006: retained model-2 local chain and unchanged execute/transition tests.
CTR-WDA-007: product delta confined to single authoring-manifest enum; no accepted
Spec or generic runtime algorithm touched. CTR-WDA-009: real HTTP local proof above.
Independent audit and integration remain pending; production operation forbidden.
