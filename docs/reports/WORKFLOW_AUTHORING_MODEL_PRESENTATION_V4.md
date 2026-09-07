# Workflow authoring model presentation — V4 authority route

DEVELOPMENT_PREFLIGHT

- GOAL: WORKFLOW_AUTHORING_USABILITY_PRODUCTION_V1.
- BASE: dsh `600d4df9b50fa4b7ffc368020cf0a8840d37346e`; paired svc `0d56d1e32b5bea5a65ef32706bc70449910866f0`.
- AUTHORITY_ACTION: SUPERSEDE; PLAN_LEVEL: EXEC_PLAN; ASSURANCE_LEVEL: CONTROLLED.
- ROUTE_STAGE: AUTHORITY_AUTHORING; DOCS_FIRST_REQUIRED: YES.
- AUTHORITY_ACCEPTED_IN_BASE: V3 YES; V4 NO.
- PRIMARY: proposed AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V4; parent V3 unchanged.
- EXECUTION_MANDATE: Owner 2026-09-06 Goal/exact-head acceptance attachment, SHA256 `b835b5a2fca95d18b6c24c6deb1729a503deb5c1b7ee191b2076979aa8ee804f`.
- CURRENT_GAP: actual normal model presentation loses top guidance and safe diagnostic detail; V3 CTR-WDA-007 excludes the required registry modification.
- SPEC_GAP_DEPENDENCY: LOAD_BEARING; MERGE/OPERATION readiness for registry repair: NO.
- ISOLATED_REF: codex/workflow-authoring-model-render-authority-v4; changes docs only.
- IMPLEMENTATION_CANDIDATE: `d2aabd7d34191585137bfeef4156381f1091ca6b`, held unmerged and undeployed; not authorized retroactively by this proposal.

## EVD-WDA-103 — qualified evidence

Source OBS-WDA-105 is a normal Feishu request to the production HR Agent on
2026-09-06, using deployed authoring files from dsh main and the paired svc main
above. Operator captured the real request/header, actual tool/call and tool/result
records from the session. No internal runner is substituted for this observation.
The sanitized immutable extraction is retained at:

`/Users/yanfenma/workspace/deployment-artifacts/workflow-authoring-usability-v1/model-render-evidence-immutable.json`

SHA256: `c04a64cd46dbfb767d53c728cd5d14092207fa38d09b021b521b5c02dabfb200`.

Exact observed model description:

```text
Agent Core capability `workflow_definition_authoring`: undefined Supported operations: create_definition, create_draft_version, replace_draft_graph, publish_version.
```

Exact observed failure suffix:

```text
failed: graph_validation_failed (status=422, request_id=b9cfcfd0-1004-4b8e-b5c3-7fe9758bb1b8)
```

Source OBS-WDA-106 is exact base code inspection: `packages/broker/src/schema.js`
validates raw description but does not copy it to its normalized manifest;
`packages/broker/src/registry.js` interpolates that omitted field and renders only
error code/status/request-id. The production model still selected legacy full graph
and stopped after canonical rejection. No publication or instance was created.

These observations support CLM-WDA-103 and the narrowly changed CTR-WDA-007 boundary.
They are sufficient to establish the presentation defect and need for a successor;
they do not prove repaired production usability. The independent implementation audit
at candidate `d2aabd7d34191585137bfeef4156381f1091ca6b` returned REVISE, sole blocker
CONTRACT_VIOLATION against V3 CTR-WDA-007. Its 16 focused tests passed, demonstrating
function without supplying missing authority.

## Production disposition and evidence limits

The reviewed deployment was applied and independently read back successfully. The
normal-Agent usability attempt failed; root receipt is `E2E_FAIL_PRESERVED_NO_REPLAY`.
Production keeps safe V3 authoring/diagnostics generation; its lock was released.
No registry repair was deployed. No failed business operation was blindly replayed.
The initial localhost8787 request belonged to a separate user runtime and failed
provider quota before any tool call; it is excluded from production evidence.

Root receipt:
`/private/var/tmp/wau-20260906-authoring-v1-r3/FINAL_RECEIPT.json`.
Operator copy:
`/Users/yanfenma/workspace/deployment-artifacts/workflow-authoring-usability-v1/production-attempt-20260906-r3/ROOT_FINAL_RECEIPT.json`.
The immutable extraction above is the review snapshot; the earlier mutable working
extraction path is not the durable snapshot authority.

## Exact bounded semantic delta

Only CTR-WDA-007 expands its implementation boundary: existing registry may restore
validated description and sanitized bounded graph422/local malformed replacement
detail only for the exact existing authoring capability and tool name. ACC-WDA-011
now requires actual registered tool output-renderer proof, including unchanged unrelated
capability rendering. CTR-WDA-001..006 and008..011 normative meanings are retained.
No new operation/tool/schema, scope/Grant, validator, graph model or service change.
V3 stays accepted until exact V4 acceptance and atomic successor lifecycle activation.

## Gate

Independent exact-head semantic review, then Owner acceptance of that reviewed V4 SHA.
Only afterwards: lifecycle finalization/main merge, re-audit/reconcile the held repair
under active authority, controlled Broker-only apply, normal Agent authoring and one
bounded downstream smoke. Goal is INCOMPLETE until all production terminal rows pass.
