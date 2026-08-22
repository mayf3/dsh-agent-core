---
spec_id: AGENT_CORE_CREDENTIAL_METADATA_RESOLUTION_V1
status: accepted
accepted_date: 2026-08-22
accepted_by: mayf3
accepted_reviewed_base: 1c3401a8194a7b6b2ad38031559cbf6c35795f48
accepted_reviewed_spec_commit: fd69a41adae755fd4c266b85b831aecd612cc948
final_audit: 凭读 审计
final_audit_result: PASS
required_fixes: NONE
semantic_delta_after_review: NONE
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - authsvc trusted-parent read-only credential metadata resolution
  - per-Agent trusted-store entry presence and clientId projection
  - redaction and credential-store immutability acceptance coverage
governed_by:
  - AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
  - AGENT_CORE_HARDENING_PROGRAM_V1
  - AGENT_WORKSPACE_SESSION_MODEL_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_CREDENTIAL_METADATA_RESOLUTION_V1 — Redacted read-only resolution seam

> **ACCEPTED / IMPLEMENTATION AUTHORITY = CONTRACTS / PRODUCTION CHANGE = NONE.**
>
> `凭读 审计` independently reviewed exact head `fd69a41adae755fd4c266b85b831aecd612cc948`
> and returned PASS with no required fixes. Authorized acceptance changes lifecycle metadata
> only; Goal, scope, Decisions, Contracts, Acceptance, security, and production state remain
> byte-semantically unchanged.

Reviewed authoring state (historical):

```text
TASK_NAME = 凭读 执行
SPEC_GOVERNANCE_MODE = AUTHOR
PREFLIGHT_MODE = NEW
AUTHORITY_SUFFICIENT_BEFORE_THIS_SPEC = NO
SPEC_ID = AGENT_CORE_CREDENTIAL_METADATA_RESOLUTION_V1
STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
PARTIAL_SUPERSESSION = NONE
IMPLEMENTATION_PERFORMED = NO
PRODUCTION_CHANGE = NONE
```

Acceptance binding:

```text
REVIEWED_BASE_COMMIT = 1c3401a8194a7b6b2ad38031559cbf6c35795f48
REVIEWED_SPEC_COMMIT = fd69a41adae755fd4c266b85b831aecd612cc948
REVIEWER = 凭读 审计
SPEC_REVIEW = ACCEPT
REQUIRED_FIXES = NONE
READY_FOR_ACCEPTANCE_FINALIZE = YES
ACCEPTANCE_ACTOR = mayf3
ACCEPTED_AT = 2026-08-22
SEMANTIC_DELTA_AFTER_REVIEW = NONE
ACCEPTANCE_DELTA_CLASS = LIFECYCLE_ONLY
IMPLEMENTATION_AUTHORITY_ON_ACCEPTANCE = contracts
IMPLEMENTATION_PERFORMED = NO
PRODUCTION_CHANGE = NONE
```

## 1. Goal

Authorize one minimal, read-only seam inside the existing `authsvc` trusted-parent boundary:

```text
resolveCredentialMetadata(agent_id)
```

The seam answers only whether the canonical trusted credential store has an entry for the
exact Agent id and, when present, returns that entry's non-secret `clientId`. It exists so a
trusted fleet-inventory caller does not call `loadCredentialFor()` and receive
`clientSecret` merely to determine presence.

## 2. Scope and non-goals

### 2.1 In scope

- one-Agent-at-a-time resolution against the configured `AGENT_CORE_CREDENTIALS_FILE`;
- execution only in the `authsvc`/uid505 trusted parent or equivalently protected test
  fixture;
- a closed `PRESENT | ABSENT` metadata result;
- full existing store-document validation and fail-loud configured-store errors;
- tests proving redaction, no secret-bearing output, and byte-for-byte store immutability.

The trusted seam receives only `agent_id`; the store path is a trusted construction or
process configuration dependency, never a child-supplied request field. Before any store
access, the seam MUST call or equivalently reuse the authoritative Agent Definition id
validator from `packages/agent-definition/src/definition.js`: input is a string matching
`^agt_[A-Za-z0-9_-]+$` (non-empty payload; slash, backslash, dot, whitespace, NUL, and path
syntax are rejected). The seam MUST inherit the validator's actual validation/length
contract rather than define a second, looser grammar. At the authoring base, generated ids
are `agt_` plus 32 hex characters; the authoritative compatibility validator itself adds no
separate maximum-length rule.

### 2.2 Out of scope / forbidden

```text
CHILD_AGENT_ACCESS                         = FORBIDDEN
MODEL_TOOL_OR_PARENT_RPC_EXPOSURE          = FORBIDDEN
LOAD_CREDENTIAL_FOR_FLEET_INVENTORY        = FORBIDDEN
CLIENT_SECRET_RETURN                       = FORBIDDEN
TOKEN_PASSWORD_CREDENTIAL_VALUE_RETURN     = FORBIDDEN
STORE_ENUMERATION_BY_RESOLVER              = FORBIDDEN
CREDENTIAL_STORE_WRITE                     = FORBIDDEN
OWNER_GROUP_MODE_CHANGE                    = FORBIDDEN
PROVISION_ROTATE_REVOKE                     = FORBIDDEN
BINDING_RESTORE                             = FORBIDDEN
AUTH_PRINCIPAL_CLIENT_GRANT_LOOKUP          = FORBIDDEN
AUTH_DB_OR_API_CALL                         = FORBIDDEN
TOKEN_MINT_OR_VALIDITY_PROBE                = FORBIDDEN
NEW_IDENTITY_MAPPING_TABLE                  = FORBIDDEN
ROUTER_CREDENTIAL_MANAGER                  = FORBIDDEN
RUNTIME_ROUTER_KERNEL_CHANGE                = NONE
PRODUCTION_APPLY                            = FORBIDDEN_THIS_SPEC_ROUND
```

This Spec does not authorize the Phase B State D/E/F/G reconciliation deferred by
`AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` Amendment 6. In particular, local
`PRESENT` does not establish that an Auth client exists, is active, matches a principal,
has grants, or has a valid secret.

## 3. Authority and dependencies

```text
Repository governance = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0 (accepted)
Credential authority   = AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 (accepted)
Trust boundary         = AGENT_CORE_HARDENING_PROGRAM_V1 (accepted)
Agent ownership model  = AGENT_WORKSPACE_SESSION_MODEL_V2 (accepted)
This child             = AGENT_CORE_CREDENTIAL_METADATA_RESOLUTION_V1 (accepted)
External Auth change   = NONE
```

The parent credential Spec remains unchanged: Auth owns principal/client binding and
credential validity; Deployment/Control Plane uid505 owns the trusted store; Broker is a
trusted reader; child Agents never receive raw credentials. This child adds a distinct
redacted projection without superseding or weakening any parent rule.

A fleet caller MUST source its roster from the existing Agent Definition authority. The
resolver accepts one exact Agent id and MUST NOT enumerate store keys or invent a second
fleet registry.

## 4. Current State

- `STATE-CMR-001` — At `main@1c3401a`,
  `packages/broker/src/credential-store.js` exports `loadCredentialFor(storeFile,
  agentId)`, whose present result contains both `clientId` and `clientSecret`; no redacted
  metadata resolver exists. Basis: `OBS-CMR-001`, `EVD-CMR-001`.
- `STATE-CMR-002` — The accepted credential Spec permits only Phase A clean bootstrap and
  explicitly leaves Phase B without implementation permission while recording a missing
  read-only resolution seam. Basis: `OBS-CMR-002`, `EVD-CMR-002`.
- `STATE-CMR-003` — This accepted docs-only change does not modify code, credential-store
  data, permissions, runtime configuration, or production state. Basis: Git changed-file
  boundary and this Spec lifecycle.

## 5. Observations

### OBS-CMR-001 — Existing lookup returns the secret-bearing credential object

- Repository/revision: `mayf3/dsh-agent-core@1c3401a8194a7b6b2ad38031559cbf6c35795f48`
- Source: `packages/broker/src/credential-store.js:39-47,49-113`
- Method: source inspection
- Result: a valid entry normalizes to `{clientId, clientSecret}`;
  `loadCredentialFor()` returns that object or `undefined`; the configured store is fully
  validated and re-read on every call.
- Environment: source repository, `origin/main`
- Observed at: 2026-08-22T09:15:11Z

### OBS-CMR-002 — Parent authority does not authorize this implementation

- Repository/revision: `mayf3/dsh-agent-core@1c3401a8194a7b6b2ad38031559cbf6c35795f48`
- Source: `docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1.md` Amendment 6,
  D.7.2-D.7.5, Scope, and Frozen Boundaries
- Method: authority inspection under the accepted governance preflight
- Result: Phase A is the only current implementation permission; existing-entry paths
  fail loud with zero Auth/store writes; Phase B requires a read-only resolution seam and
  has no implementation permission. The enumerated implementation scope does not include
  a fleet metadata API.
- Environment: authority branch `main`
- Observed at: 2026-08-22T09:15:11Z

### OBS-CMR-003 — Parent security rules permit clientId metadata but forbid secret output

- Repository/revision: `mayf3/dsh-agent-core@1c3401a8194a7b6b2ad38031559cbf6c35795f48`
- Source: `docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1.md` Parts B, G, H and
  Security Boundaries; `docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md:22-24`
- Method: authority inspection
- Result: clientId is explicitly non-secret metadata; raw secret must not enter child,
  workspace, argv, env, stdout, stderr, log, or report; the uid505 store remains private
  and runtime readers are read-only.
- Environment: authority branch `main`
- Observed at: 2026-08-22T09:15:11Z

### OBS-CMR-004 — Agent Definition owns the Agent id grammar

- Coordinates: `mayf3/dsh-agent-core@1c3401a`, source repository, observed 2026-08-22
- Source/method: inspect `packages/agent-definition/src/definition.js:78-92,120-128,140-158`
- Result: ids are strings matching `^agt_[A-Za-z0-9_-]+$`; `+` requires a non-empty
  payload and excludes path syntax. Generation emits `agt_` plus 32 hex characters; the
  validator has no separate maximum length at this base.

## 6. Claims and assumptions

### CLM-CMR-001 — A closed metadata projection avoids unnecessary secret exposure

- Support state: SUPPORTED
- Supported by evidence: `EVD-CMR-001`, `EVD-CMR-003`
- Contradicted by evidence: none known
- Uncertainty: implementation may still transiently parse secret-bearing store bytes
  inside the trusted parent; the Contract forbids propagation outside that boundary.

### CLM-CMR-002 — Local entry presence is not Auth credential validity

- Support state: SUPPORTED
- Supported by evidence: `EVD-CMR-002`, `EVD-CMR-003`
- Contradicted by evidence: none known
- Uncertainty: none; Auth status resolution remains explicitly out of scope.

Open authority-changing assumptions: **NONE**.

## 7. Evidence relations

### EVD-CMR-001 — Source supports the current secret-bearing lookup State

- Source observations: `OBS-CMR-001`
- Target: `STATE-CMR-001`, `CLM-CMR-001`
- Relation: SUPPORTS
- Bound coordinates: repository commit `1c3401a8194a7b6b2ad38031559cbf6c35795f48`
- Strength/sufficiency: direct source inspection
- Limitations: does not establish deployed store contents.

### EVD-CMR-002 — Accepted parent text supports the authority-gap State

- Source observations: `OBS-CMR-002`
- Target: `STATE-CMR-002`, `CLM-CMR-002`
- Relation: SUPPORTS
- Bound coordinates: accepted parent Spec on `main@1c3401a`
- Strength/sufficiency: direct normative authority
- Limitations: parent text names a broader Auth read-only prerequisite; this child
  authorizes only the narrower local redacted store projection.

### EVD-CMR-003 — Parent boundaries support the redaction and placement Claims

- Source observations: `OBS-CMR-003`
- Target: `CLM-CMR-001`, `CLM-CMR-002`
- Relation: SUPPORTS
- Bound coordinates: accepted authorities on `main@1c3401a`
- Strength/sufficiency: direct normative security constraints
- Limitations: implementation conformance still requires executed tests.

## 8. Decisions

### DEC-CMR-001 — Resolution remains inside the trusted parent

- Decision owner: repository owner `mayf3`
- Decision: add one local read-only metadata seam in the existing authsvc trusted-parent
  credential boundary; do not expose it as a child Agent tool, parent RPC, model surface,
  HTTP endpoint, or Router credential manager.
- Rejected alternative: let fleet inventory call `loadCredentialFor()` and discard the
  secret.
- Reason: the caller would unnecessarily receive `clientSecret`, enlarging the secret
  exposure surface.

### DEC-CMR-002 — Result is a closed redacted union

- Decision owner: repository owner `mayf3`
- Decision: return only `entry` and, for `PRESENT`, `clientId`.
- Rejected alternative: return the normalized credential object with redacted or optional
  fields.
- Reason: a closed owned object makes secret absence structural rather than conventional.

### DEC-CMR-003 — Presence is local-store metadata only

- Decision owner: repository owner `mayf3`
- Decision: `PRESENT` means one valid canonical local store entry exists for the exact
  Agent id; `ABSENT` means the store is unconfigured or that exact key is absent, matching
  existing local lookup absence semantics. Configured-but-missing, unreadable, malformed,
  or unsupported-version stores fail loud and never collapse to `ABSENT`.
- Rejected alternative: query Auth, infer validity, or reconcile identities.
- Reason: preserve authority separation and avoid silently expanding into Phase B.

### DEC-CMR-004 — Agent Definition remains Agent id validation authority

- Decision owner: repository owner `mayf3`
- Decision: metadata resolution calls or equivalently reuses the formal Agent Definition
  validator before any credential-store access. It does not define a local fallback or
  looser grammar.
- Rejected alternative: accept any non-empty string because the store is a JSON object.
- Reason: path-like and traversal-shaped input must fail before it can influence or probe
  credential-store access, and Agent identity grammar must retain one authority.

## 9. Contracts

### CTR-CMR-001 — Trusted-parent-only caller boundary

The implementation MUST provide `resolveCredentialMetadata(agent_id)` only to trusted
parent/deployment code running inside the authsvc credential boundary. The store path MUST
come from trusted construction/configuration. Child Agents, model tools, child RPC, UI,
and caller-supplied store paths MUST NOT obtain this capability or credential-store read
permission.

### CTR-CMR-002 — Closed return shape

For a valid present entry, the resolver MUST return exactly:

```json
{"entry":"PRESENT","clientId":"<existing clientId>"}
```

For absence, it MUST return exactly:

```json
{"entry":"ABSENT"}
```

No result may contain `clientSecret`, `token`, `password`, credential value, credential
object, store path, principal, grant, scope, or additional key. `clientId` MUST be omitted,
not null or empty, for `ABSENT`.

### CTR-CMR-003 — Canonical validation and fail-loud semantics

The resolver MUST first call or equivalently reuse Agent Definition's authoritative id
validator. The accepted input is a string matching `^agt_[A-Za-z0-9_-]+$`, with every
actual length and validation constraint inherited from that authority; no local permissive
fallback is allowed. Empty, invalid, slash/backslash-bearing, or traversal-shaped input
MUST fail loud before any credential-store path operation or read, with
`STORE_ACCESS_COUNT = 0`.

Only after successful id validation, the resolver MUST re-read the configured store and
apply the existing full V1 document and entry validation semantics before returning
metadata. An unconfigured store yields `ABSENT`; an absent exact key yields `ABSENT`. A
configured store that is missing, unreadable, malformed, unsupported-version, or contains
any malformed entry MUST throw the stable `CREDENTIALS_STORE_ERROR` family and MUST NOT
return partial inventory or `ABSENT`.

### CTR-CMR-004 — No secret-bearing observability

The resolver MUST NOT call `loadCredentialFor()` in fleet-inventory paths. It MUST NOT emit
logs, metrics, reports, stdout, or stderr. Return values, thrown error messages/stacks, and
caller-visible diagnostics MUST NOT contain any `clientSecret`, token, password, or
credential value, including when malformed input embeds a secret canary. Only the error
class/code and non-secret agentId/clientId metadata may be used by a trusted caller.

### CTR-CMR-005 — Store and permission immutability

Resolution MUST open no write path and MUST NOT provision, rotate, revoke, repair, claim,
or normalize persistent data. Before and after every success or failure, credential-store
bytes, owner uid, owner gid, and permission mode MUST be identical. The implementation
MUST NOT chmod, chown, rename, replace, truncate, create a sidecar, or acquire a
write-capable lock for resolution.

### CTR-CMR-006 — Per-Agent lookup without enumeration or authority inference

Each invocation MUST inspect only the exact requested Agent key after full document
validation. The resolver MUST NOT enumerate entries into its result, derive a fleet roster,
accept child self-asserted identity, perform Auth/DB/API/token calls, create identity
mappings, or interpret `PRESENT` as client validity, principal binding, grant readiness, or
service authorization. A trusted fleet caller MAY iterate an Agent Definition roster and
invoke this one-Agent seam.

## 10. Acceptance

### ACC-CMR-001 — PRESENT returns only clientId

- Contracts: `CTR-CMR-001`, `CTR-CMR-002`, `CTR-CMR-004`, `CTR-CMR-006`
- Method: unit test a private fixture containing one valid entry with a unique secret
  canary.
- Expected result: deep equality with `{entry:'PRESENT', clientId}`; exact key set excludes
  every secret-bearing field; serialized result excludes the canary.
- Failure condition: any additional key/value, use of `loadCredentialFor()` by the
  inventory path, or child/model exposure.

### ACC-CMR-002 — ABSENT is explicit

- Contracts: `CTR-CMR-002`, `CTR-CMR-003`
- Method: test both an unconfigured store and a valid configured store without the exact
  Agent key.
- Expected result: deep equality with `{entry:'ABSENT'}` and no `clientId` key.
- Failure condition: `undefined`, `null`, partial object, or collapsed configured-store
  error.

### ACC-CMR-003 — Errors never expose secret values

- Contracts: `CTR-CMR-003`, `CTR-CMR-004`
- Method: exercise missing, unreadable, malformed JSON, unsupported version, and malformed
  entry fixtures containing unique secret/token/password canaries; capture return/error,
  console/logger sinks, stdout, and stderr.
- Expected result: stable `CREDENTIALS_STORE_ERROR` where applicable; every captured
  surface excludes every canary and raw credential value.
- Failure condition: any canary appears in return, error message/stack, log, report,
  stdout, or stderr.

### ACC-CMR-004 — Store bytes and permissions remain unchanged

- Contracts: `CTR-CMR-003`, `CTR-CMR-005`
- Method: snapshot fixture bytes plus uid/gid/mode, run PRESENT, ABSENT, and each failure
  path, then compare after every invocation.
- Expected result: bytes are byte-for-byte identical and uid/gid/mode are unchanged.
- Failure condition: any content, ownership, or mode delta, or any write-capable filesystem
  operation attributable to resolution.

### ACC-CMR-005 — Trusted boundary and no external side effects

- Contracts: `CTR-CMR-001`, `CTR-CMR-005`, `CTR-CMR-006`
- Method: module/integration tests prove no child registration or parent-RPC/tool exposure;
  inject counters/fakes for Auth, provisioning, rotation, revocation, binding, and token
  transport seams.
- Expected result: child cannot invoke the resolver or read the store; all side-effect and
  external-call counters remain zero.
- Failure condition: any child-readable capability/store access, Auth call, store write,
  provisioning, rotation, revocation, binding restoration, or token mint.

### ACC-CMR-006 — Invalid and traversal-shaped ids fail before store access

- Contracts: `CTR-CMR-003`, `CTR-CMR-005`, `CTR-CMR-006`
- Method: instrument every credential-store path/read seam with an access counter, then
  invoke metadata resolution with: invalid id, empty id, `/path`, `../traversal`,
  `agt_../x`, a slash-bearing id, and a backslash-bearing path-like id. Include type-invalid
  values and any current Agent Definition length-boundary cases.
- Expected result: every case fails loud through the authoritative Agent Definition
  validation semantics before any store operation;
  `FAIL_LOUD_BEFORE_STORE_ACCESS = YES` and `STORE_ACCESS_COUNT = 0` for each case.
- Failure condition: any input reaches path construction/probing, file existence checks,
  open/read/stat, store parsing, or returns `ABSENT`/`PRESENT`.

## 11. Alternatives and disposition

- `ALT-CMR-001` — **Use `loadCredentialFor()` then delete `clientSecret`: rejected.** The
  fleet caller still receives the secret-bearing object and can accidentally log/report
  it.
- `ALT-CMR-002` — **Expose metadata resolution to child Agents: rejected.** Inventory is a
  trusted deployment concern; child access would weaken the accepted store boundary.
- `ALT-CMR-003` — **Enumerate the credential store as the fleet roster: rejected.** Agent Definition remains roster authority; store keys are credential state, not fleet membership.
- `ALT-CMR-004` — **Treat malformed/unreadable store as ABSENT: rejected.** This would hide broken trusted state and produce false fleet inventory.
- `ALT-CMR-005` — **Query Auth or mint a token to enrich presence: rejected.** This is Phase B validity/reconciliation authority and is not granted here.
- `ALT-CMR-006` — **Repair, rotate, provision, or restore binding during read: rejected.** The seam is strictly read-only and side-effect free.

All parent-rejected alternatives remain rejected: child-held credentials, credentials in `agents.json`, Router self-provisioning/credential management, OpenClaw fallback, identity string unification, legacy CLI secret capture, and non-atomic store mutation.

## 12. Migration, compatibility, and rollback

- Existing `loadCredentialFor()` behavior for Broker execution remains unchanged.
- No store schema or version change is authorized.
- No migration, backfill, production invocation, or fleet report is authorized by this Spec.
- Acceptance activates `implementation_authority: contracts` for only the bounded Contracts
  in this Spec; it does not itself implement, deploy, or invoke the resolver.
- Any later additive implementation remains unused until a trusted caller adopts it under
  a separate implementation change reviewed against this accepted revision.
- Rollback of later implementation is code reversion; store rollback is unnecessary because
  the Contract permits no store mutation.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

The reviewed authoring head is accepted through the lifecycle-only binding above. Current
`IMPLEMENTATION_AUTHORITY = contracts`; product implementation still requires a separate
implementation PR and exact Contract-by-Contract conformance review.

## Acceptance result

```text
SPEC_ID = AGENT_CORE_CREDENTIAL_METADATA_RESOLUTION_V1
SPEC_KIND = implementation
STATUS = accepted
IMPLEMENTATION_AUTHORITY = contracts
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 6
CONTRACTS_WITH_ACCEPTANCE = 6
REVIEWED_SPEC_COMMIT = fd69a41adae755fd4c266b85b831aecd612cc948
SEMANTIC_DELTA_AFTER_REVIEW = NONE
AUTHORITATIVE_AGENT_ID_GRAMMAR_REUSED = YES
INVALID_ID_PRE_STORE_REJECTION = YES
TRAVERSAL_PRE_STORE_REJECTION = YES
STORE_ACCESS_COUNT_FOR_INVALID_INPUT = 0
CLIENT_SECRET_EXPOSED = NO
CREDENTIAL_STORE_CHANGED = NO
IMPLEMENTATION_PERFORMED = NO
PRODUCTION_CHANGE = NONE
```
