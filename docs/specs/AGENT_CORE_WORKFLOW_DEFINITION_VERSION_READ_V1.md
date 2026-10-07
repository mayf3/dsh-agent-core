---
spec_id: AGENT_CORE_WORKFLOW_DEFINITION_VERSION_READ_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope: [packages/broker]
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V4
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_PRODUCT_BOUNDARY_V6
    relation: constrained_by
supersedes: []
superseded_by: null
owners: [repository-maintainers]
---

# AGENT_CORE_WORKFLOW_DEFINITION_VERSION_READ_V1

> STATUS: **proposed** — branch-local candidate (issue #555, same branch as
> AGENT_CORE_WORKFLOW_AUTHORING_FILE_ENTRY_V1, writer continuity for adjacent
> Workflow Broker surfaces). Nothing merged or installed. The read endpoints,
> their scope gate and the service-internal domain-owner check are and remain
> svc-workflow's own accepted behavior — this candidate only exposes them
> through the existing trusted broker relay.

## 1. Goal

Give a legitimate SAME-DOMAIN caller (the domain owner) a precise, read-only
broker entry for definition/version data — each version row's exact
`context_schema` and `version_status` — so an agent can prepare
`workflow_execute(create_instance)` input (and independently read back a
draft after authoring) without any global-read permission prerequisite. The
triggering defect (#555): the blog agent could not read its domain's
published version schema through any capability, and the only visible read
surface (GLOBAL instance enumeration) wrongly presented itself as a
pre-creation dedup step while requiring a global role the writer agent does
not hold.

## 2. Scope and non-goals

ONE new pure-data capability family inside the existing broker composition,
following the exact "append one line to the manifest hub + one
DEFAULT_MANIFESTS entry" convention:

- `workflow_definition_read.list_definitions` — GET
  `/internal/v1/domains/{domainId}/definitions` (limit 1–20, optional
  beforeCreatedAt+beforeId all-or-none cursor forwarded verbatim).
- `workflow_definition_read.get_definition` — GET
  `/internal/v1/domains/{domainId}/definitions/{definitionId}` — returns the
  definition plus EVERY version row, each carrying `version_status` and the
  exact `context_schema`, byte-faithful service passthrough.

Non-goals (frozen): no write of any kind (GET-only bindings, no idempotency
key), no global enumeration capability change, no new scope or role, no
response reshaping/filtering, no svc-workflow/auth-service change, no
dedup-contract change (same-domain idempotency contracts stay authoritative;
`my_tasks` emptiness or forum silence are never evidence of absence).

## 3. Minimality record (why a new capability, not new WDA operations)

AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V4 (accepted) freezes the authoring
capability at exactly FOUR operations and states "No new tool/operation";
adding read operations there would amend an accepted governing spec and mix
read scope (`workflow.read`) into a write capability (`workflow.execute`).
A separate pure-data read capability is strictly additive: it changes zero
accepted surfaces, rides the existing relay/gateway/transport, and mirrors
every other workflow read family (`workflow_my_tasks`,
`workflow_instance_detail`, `workflow_domain_instances`). This candidate is
also NOT merged with AGENT_CORE_WORKFLOW_AUTHORING_FILE_ENTRY_V1: that
spec's tool is a local-file entry for ONE write operation; this one is an
ordinary capability manifest — different surfaces, same branch, same writer,
independent acceptance.

## 4. Contracts

### CTR-WDR-001 — reuse of existing service authorization

Both operations bind svc-workflow endpoints that already exist and already
enforce their own authorization: endpoint scope `workflow.read` (the same
scope every workflow read capability here declares; tokens are minted
through the existing trusted credential seam) AND the service-internal H-5
DOMAIN OWNER check inside DefinitionService. This candidate introduces no
scope, no role, no grant, and no global read prerequisite. Global instance
enumeration remains a separate capability with its own role gate and is
never a prerequisite for instance creation.

### CTR-WDR-002 — read-only, verbatim passthrough

GET bindings only; no `http.idempotencyKey`; the response JSON passes
through unchanged (`result: {type:'json'}`), including `version_status`,
`context_schema`, digests and `next_cursor`. The capability never filters,
reshapes, or re-derives service facts.

### CTR-WDR-003 — honest failures

Locally (before any token mint or HTTP request): missing `domainId` /
`definitionId` → `invalid_arguments`; a lone `beforeCreatedAt` or
`beforeId` → `invalid_cursor`; `limit` outside 1–20 → `invalid_pagination`.
Downstream codes pass through preserved: `definition_not_found` (404, also
the not-visible/not-owner shape the service already returns),
`forbidden`/`domain_disabled` (403), transport fallbacks — with the
downstream `x-request-id` carried on the error envelope for correlation.
Non-published versions are reported as the service reports them (the
version row's own `version_status`); the capability does not editorialize.

## 5. Acceptance

- **ACC-WDR-001** — CTR-WDR-001/002: through the REAL pipeline (child apply →
  parent-RPC handler → gateway → authorized transport) a same-domain owner
  reads the precise `context_schema` of a PUBLISHED version and the raw
  page/detail responses pass through unchanged; GET carries no
  Idempotency-Key; the token request scope is exactly `workflow.read`.
- **ACC-WDR-002** — CTR-WDR-003: allow / deny / missing-field matrix —
  honest `definition_not_found` with requestId for a foreign definition;
  local `invalid_arguments` / `invalid_cursor` / `invalid_pagination` with
  zero token and zero svc traffic.
