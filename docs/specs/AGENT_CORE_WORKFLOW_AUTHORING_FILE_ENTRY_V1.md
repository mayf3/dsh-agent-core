---
spec_id: AGENT_CORE_WORKFLOW_AUTHORING_FILE_ENTRY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope: [packages/broker]
governed_by:
  - AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V4
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_PRODUCT_BOUNDARY_V6
    relation: constrained_by
supersedes: []
superseded_by: null
owners: [repository-maintainers]
---

# AGENT_CORE_WORKFLOW_AUTHORING_FILE_ENTRY_V1

> STATUS: **proposed** — branch-local candidate authored under the #562 Owner
> dispatch (2026-10-07). Nothing here is merged or installed; the underlying
> `replace_draft_graph` operation remains governed, unchanged, by
> AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V4 (accepted). Owner acceptance of
> THIS candidate is a precondition for any merge/install of the entry.

## 1. Goal

Give a per-agent DSH process ONE narrow, lossless entry that turns a local
JSON arguments file into an existing trusted Broker authoring call, so a large
definition graph (≈27–60 KB) no longer has to be restated by the model. The
triggering defect (#562): the family-steward Definition draft could only be
submitted through model-inlined JSON, and the model's restatement dropped
schema `properties` while keeping `required` — 16 previously legal submissions
were all rejected.

## 2. Scope and non-goals

ONE new child-side model tool beside the existing capability tools inside the
existing `@agent-core/broker` per-agent composition:

- `workflow_definition_authoring_file(path, expectedSha256?)` — reads ONE
  explicitly named JSON file, parses it, re-uses the EXISTING invocation
  validation, and relays `{ capabilityId: 'workflow_definition_authoring',
  operation: 'replace_draft_graph', args }` over the EXISTING parent-RPC
  broker channel. One operation. No other capability, no other operation.

Non-goals (frozen): no generic file→RPC platform, no arbitrary-RPC executor,
no code executor, no SDK/token path, no new identity/scope/permission, no
change to `parent-rpc-relay.js`, the gateway, the transport, the WDA manifest
schemas, svc-workflow, or the Scheduler. The model-visible error/result
envelope and all V4 contracts stay exactly as accepted.

## 3. Contracts

### CTR-AFE-001 — single operation, existing channel

The tool relays ONLY `workflow_definition_authoring.replace_draft_graph`
through the existing `ctx.agentRpc.request('agent-core/broker', …)` relay.
Caller identity, credential, scope (`workflow.execute`) and the
Idempotency-Key remain owned by the existing trusted seams (CTR-WDA-003);
identity fields can never be supplied by the file, the tool arguments, or the
model. `additionalProperties=false` on the operation root makes any identity
field inside the parsed file a local `invalid_arguments` rejection BEFORE the
relay.

### CTR-AFE-002 — bounded file read

The read boundary re-uses existing mechanisms only: the file must be a
regular file whose REAL resolved path lies inside the agent's primary
workspace (`$DSH_PRIMARY_WORKSPACE`, the existing spawn env channel also used
by agent-memory; absent ⇒ the tool is not registered), byte size ≤ 1 MiB
(the existing parent-RPC frame bound), absolute explicit path. Symlink
escape out of the workspace is rejected. Reads are single-shot: the exact
bytes read once are hashed (SHA-256), parsed, validated, relayed and
persisted — there is no second read and no TOCTOU window. An optional
`expectedSha256` argument is compared before the relay and mismatches are
rejected.

### CTR-AFE-003 — full validation before any write

Before the relay, the parsed object passes the EXISTING
`validateInvocation` against the UNCHANGED WDA manifest
(`structuralDiagnostics` opt-in preserved), so unknown fields, missing
required fields, malformed nodes/transitions, and wrong-form (mixed
full/linear) inputs fail locally with the existing declared codes/details.
File-stage failures (missing, unreadable, oversize, non-JSON, non-object,
hash mismatch, outside workspace) fail before the relay with
`invalid_arguments` plus a distinguishing detail. No partial submission can
occur: the relay is the single atomic full-graph replace (existing PUT
semantics), never segment writes.

### CTR-AFE-004 — real evidence, untruncated

The tool appends two JSONL evidence lines to
`<workspace>/.workflow-authoring-file-entry/evidence.jsonl`:
`stage:'request'` (ts, path, bytes, sha256, the COMPLETE parsed args object —
never truncated) BEFORE the relay, and `stage:'response'` (the complete
result/error envelope including the downstream `requestId` when present)
after it. A request-line write failure aborts the call (fail loud, nothing
submitted). A response-line write failure never alters the returned envelope
(the request line already carries the mandatory args/hash evidence; the
failure is logged to stderr).

### CTR-AFE-005 — envelope and idempotency passthrough

The tool returns the gateway invoke-shaped envelope verbatim —
`{ok:true,result}` | `{ok:false,error:{code,status?,detail?,requestId?}}` —
byte-compatible with the existing capability tools. Idempotency stays exactly
as accepted in V4: one fresh trusted key per call (`createIdempotencyKey`),
server-owned conflict semantics; a repeated call with the same file converges
(the draft is atomically re-replaced with identical content; no duplicate
definition or version is created by the entry). Unknown outcomes are never
auto-retried.

### CTR-AFE-006 — registration and surface

Registration happens in the child broker `apply()` only (child mode), beside
`registerCapabilities`, when the workspace root resolves; a plugin config
boolean (`authoringFileEntry`, default true) can disable it. The tool name
`workflow_definition_authoring_file` is a PROPOSAL under the existing tool
naming conventions (underscore-safe); the Owner may rename before acceptance
without a semantic delta. The capability stays registered exactly once and
unchanged (CTR-WDA-005).

## 4. Acceptance

- **ACC-AFE-001** — CTR-AFE-001/002/003: unit + runtime-entry tests prove
  (a) the args object the gateway receives is deep-equal, field by field, to
  the file's parsed object (including every nested `properties`/`required` of
  `contextSchema` and every `submission_schema`), (b) every file-stage and
  validation-stage rejection happens BEFORE the relay with zero relay calls,
  (c) identity fields inside the file are rejected pre-relay.
- **ACC-AFE-002** — CTR-AFE-004: evidence lines contain the full args object
  and hash for the request and the full envelope/requestId for the response.
- **ACC-AFE-003** — CTR-AFE-005: two consecutive calls with the same file
  produce two relays with fresh Idempotency-Keys and identical bodies; the
  envelope passes through unchanged including `requestId`.
- **ACC-AFE-004** — business fixture: the captured pipe output re-validated
  with the #562 local fixtures — 16 legal submissions pass, the illegal
  families (approval impersonating purchase, partial purchase, missing
  human proof) stay rejected; the DRAFT head node remains
  `WORKFLOW_CREATOR`.
