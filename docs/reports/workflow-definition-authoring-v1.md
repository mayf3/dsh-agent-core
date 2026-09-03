# Workflow Definition Authoring V1 — implementation evidence

```text
GOVERNING_SPEC = AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V1
ACCEPTED_AUTHORITY_HEAD = 5dc83e44e235826555dd6b0a988af48c97e42285
OBSERVED_AT = 2026-09-03 Asia/Shanghai
PRODUCTION_CHANGE = NONE
SERVICE_CODE_CHANGE = NONE
GRANT_CHANGE = NONE
CREDENTIAL_CHANGE = NONE
```

## Contract evidence

- CTR-WDA-001/003/004/005: focused Broker capability tests exercise all four
  exact method/path/body bindings, `workflow.execute` token scope, trusted fresh
  idempotency keys, identity-field rejection, current downstream error
  preservation, and unchanged `workflow_execute` semantics.
- CTR-WDA-002: catalog readback proves closed nested array item schemas with the
  service's mixed wire shape (outer camelCase; node/transition snake_case).
- CTR-WDA-006: a disposable local PostgreSQL 16 database, svc-workflow
  `22e862af8e47050ae1bf9e7c5db7eb22a4d81ee7`, ephemeral RS256 JWKS/token server,
  and this Broker implementation completed the real TCP chain:

```text
create_definition -> create_draft_version(model 2)
-> replace_draft_graph -> publish_version
-> workflow_execute(create_instance) = PASS
definitionId = 754abd83-3463-48da-b1ab-10fb0daff1e8
published definitionVersionId = 73af335d-be95-4624-b7e4-576338be732f
instanceId = 1386adeb-e544-48c4-a946-0c976fced086
instance input definitionVersionId = 73af335d-be95-4624-b7e4-576338be732f
```

The PostgreSQL container/database, service process, JWKS server, token server,
and process-local key material were destroyed after the run.

## Verification notes

- Focused suites: 19/19 PASS before the real E2E run.
- Root `npm test` is not a qualified green run in this isolated checkout:
  unrelated packages lack their private/peer runtime modules
  (`@agent-core/workspace-bootstrap`, `@deepseek-ai/dsh-llm`,
  `@larksuite/channel`) and one unrelated notification-ingress test failed.
  This is recorded as environment/pre-existing regression debt, not hidden or
  counted as conformance evidence.

## Structure fix (WORKFLOW_DEFINITION_AUTHORING_STRUCTURE_FIX_V1)

The first slice touched the over-limit legacy
`packages/broker/src/capabilities/workflow.js`, tripping the structure gate
(`UNREGISTERED_LEGACY_TOUCHED`). Mechanical fix, applied in
WORKFLOW_DEFINITION_AUTHORING_STRUCTURE_FIX_V1:

- The `workflow_definition_authoring` manifest (plus the authoring error table
  and node/transition item schemas) moved byte-identical into
  `packages/broker/src/capabilities/workflow-definition-authoring.js`. The
  shared svc-workflow base/auth error rows moved with it as the single source;
  `workflow.js` imports them back, so all other manifests are unchanged.
- `workflow.js` is now import + manifests-inventory wiring only: 722 -> 590
  lines (integration base a0ce485 measures 601; no growth). The legacy file is
  registered in `.agents/structure-registry.json` (ceiling = baseline,
  must-not-grow, house pattern).
- registry / mapping / transport / svc-workflow: UNCHANGED.

Post-fix verification (all re-run after the move):

```text
STRUCTURE_GATE   = PASS (violations 0, base a0ce485 head dc0e58c)
FOCUSED_TESTS    = 19/19 PASS (definition-authoring, execute, transition,
                   manifest inventory)
BROKER_SUITE     = 336/336 PASS (packages/broker full node --test)
LOCAL_E2E_RERUN  = PASS (create_definition -> create_draft_version(model 2)
                   -> replace_draft_graph -> publish_version
                   -> workflow_execute(create_instance) -> instance detail
                   readback; ephemeral PG 16 + svc-workflow 22e862a + ephemeral
                   RS256 JWKS/token server; all temporary processes, container,
                   database, and key material destroyed after the run)
definitionId             = 92d5c871-a0fa-470c-89d9-e36374050f06
published definitionVersionId = f9b2e98c-96c8-4b76-9691-6bbcf7fe536f
instanceId               = 23795053-2feb-4937-9a0e-d9c5016ac3f5
instance bound definitionVersionId = f9b2e98c-96c8-4b76-9691-6bbcf7fe536f (equal)
REGRESSION_INTRODUCED_BY_CANDIDATE = NO (production-runtime failures at this
                   checkout are the same missing-private-module family as at
                   base 005ffbb: 21 vs 23 failing files, same packages;
                   classified INHERITED_ENVIRONMENT_OR_PREEXISTING)
```

The E2E harness ran entirely on ephemeral localhost resources; the write chain
exercised the real Broker credential -> token -> HTTP transport with trusted
Idempotency-Key generation and no model-supplied identity fields.
