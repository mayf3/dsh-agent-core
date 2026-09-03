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
