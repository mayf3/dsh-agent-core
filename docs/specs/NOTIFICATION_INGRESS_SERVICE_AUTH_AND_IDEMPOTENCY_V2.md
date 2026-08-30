---
spec_id: NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V2
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-08-30
scope:
  - notification-ingress service-caller authentication
  - notification-ingress auth-service origin policy
  - notification-ingress durable delivery idempotency
  - notification-ingress credential boundary and production composition wiring
governed_by:
  - AGENT_CORE_HARDENING_PROGRAM_V1
external_authorities:
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
    revision: 159d020b1635cfa7144c8238e9a91d1c6bc268d1
    relation: constrained_by
supersedes:
  - NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1
  - NOTIFICATION_INGRESS_AUTH_RESOURCE_SCOPE_CLARIFICATION_V1
superseded_by: null
owners:
  - mayf3
---

# NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V2

> **Proposed complete standalone whole-authority successor; DOCS ONLY.** This Draft does not
> implement, accept, merge, deploy, create credentials, change auth-service, or alter production.
> V1 and its resource/scope Clarification remain accepted and current while this V2 is proposed.
> Their lifecycle backlinks may change only in a future atomic acceptance transaction.

## 0. Machine-readable freeze

```text
SPEC_STATUS = proposed
AUTHORITY_FORM = COMPLETE_STANDALONE_WHOLE_AUTHORITY_SUCCESSOR
REPLACES_ON_ACCEPTANCE = [
  NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1,
  NOTIFICATION_INGRESS_AUTH_RESOURCE_SCOPE_CLARIFICATION_V1
]
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none

AUTH_SERVICE_ORIGIN_DEFAULT_RULE = HTTPS_ONLY
PLAIN_HTTP_EXCEPTION_COUNT = 1
PLAIN_HTTP_ALLOWED_FORM = http://127.0.0.1:<explicit-port>/
PLAIN_HTTP_RAW_HOST = 127.0.0.1
PLAIN_HTTP_EXPLICIT_PORT = REQUIRED
PLAIN_HTTP_PORT_GRAMMAR = [0-9]+, numeric value 1..65535
PLAIN_HTTP_PATH = /
PLAIN_HTTP_ALIASES = REJECT
PLAIN_HTTP_LOCALHOST = REJECT
PLAIN_HTTP_IPV6 = REJECT
PLAIN_HTTP_TRAILING_DOT = REJECT
PLAIN_HTTP_USERINFO = REJECT
PLAIN_HTTP_QUERY = REJECT
PLAIN_HTTP_FRAGMENT = REJECT
PLAIN_HTTP_DOT_SEGMENT = REJECT
NON_LOOPBACK_HTTP = REJECT
TOKEN_ENDPOINT_REDIRECT = FORBIDDEN
TOKEN_ENDPOINT_3XX = FAIL_CLOSED
TOKEN_VALIDATION_BYPASS = FORBIDDEN

NOTIFICATION_RESOURCE = agent-core-notification-ingress-v1
NOTIFICATION_SCOPE = notification.deliver
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
MERGE_PERFORMED = NO
```

## 1. Goal

Preserve the accepted Notification Ingress identity, authorization, idempotency, credential-boundary,
and wire contracts while making exactly two bounded security changes:

1. `auth.json.authServiceOrigin` may use plain HTTP only when its original input has the single literal
   loopback form `http://127.0.0.1:<explicit-port>/`; every non-matching plain-HTTP input remains invalid.
2. Every credential-bearing token-endpoint 3xx fails closed without following or issuing a second
   request.

No other predecessor meaning changes.

The end-to-end chain remains:

```text
svc-forum or svc-workflow Basic service credential
-> per-request online auth-service /oauth/token verification
-> verified clientId as callerPrincipalId
-> fixed two-caller allowlist
-> durable (callerPrincipalId, requestId) idempotency gate
-> Router internal deliver primitive
```

The loopback transport exception is not caller authentication, authorization, token validation,
credential substitution, or anonymous admission.

## 2. Scope and non-goals

### 2.1 In scope

- Complete replacement of the two accepted Notification Ingress auth authorities named in
  `supersedes`, carrying forward their entire active meaning.
- One literal-host, explicit-decimal-port plain-HTTP loopback origin exception for `auth.json.authServiceOrigin`.
- Raw-input validation that distinguishes the literal host from WHATWG-normalized aliases.
- Token-endpoint redirect fail-closed behavior with no second request.
- Acceptance requirements for the exact positive and negative origin matrix.

### 2.2 Out of scope

```text
packages/broker/** = OUT_OF_SCOPE
BROKER_PR_116 = NOT_A_GOVERNANCE_VEHICLE
AUTH_SERVICE_PROTOCOL_CHANGE = NONE
AUTH_SERVICE_MANAGEMENT_API_CHANGE = NONE
ALLOWED_CALLER_CHANGE = NONE
CALLER_IDENTITY_CHANGE = NONE
RESOURCE_OR_SCOPE_CHANGE = NONE
TOKEN_VALIDATION_BYPASS = FORBIDDEN
IDEMPOTENCY_CHANGE = NONE
ROUTER_SEMANTIC_CHANGE = NONE
AGENT_PROCESS_CHANGE = NONE
BINDING_CHANGE = NONE
WIRE_API_CHANGE = NONE
CREDENTIAL_CREATION = NONE
GRANT_CHANGE = NONE
DEPLOYMENT = NONE
```

This Spec does not authorize TLS termination changes, trust of `X-Forwarded-*`, private-network HTTP,
`localhost`, IPv6 loopback, DNS names, Unix sockets, or any broader loopback recognition rule.

## 3. Authority, lifecycle, and dependencies

```text
REPOSITORY = mayf3/dsh-agent-core
AUTHORING_BASE = 9bb5b97442c7155da36f06e867d1a655410544ac
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_HARDENING_PROGRAM_V1 (accepted)
CURRENT_AUTHORITY_1 = NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1 (accepted)
CURRENT_AUTHORITY_2 = NOTIFICATION_INGRESS_AUTH_RESOURCE_SCOPE_CLARIFICATION_V1 (accepted)
EXTERNAL_AUTHORITY = mayf3/auth-service@
  AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
  revision 159d020b1635cfa7144c8238e9a91d1c6bc268d1
AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

This is `SUPERSEDE`, not `AMEND`: the accepted HTTPS-only security and token-request failure meaning
changes. V2 is therefore complete and independently implementable; it does not say “V1 applies except”.

While V2 is proposed:

```text
V1.status = accepted
V1.superseded_by = null
CLARIFICATION_V1.status = accepted
CLARIFICATION_V1.superseded_by = null
IMPLEMENTATION_AGAINST_V2 = FORBIDDEN
```

A future acceptance must be one docs-only atomic transaction:

```text
V2.status: proposed -> accepted
V2.implementation_authority: none -> contracts
V1.status: accepted -> superseded
V1.superseded_by: null -> NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V2
CLARIFICATION_V1.status: accepted -> superseded
CLARIFICATION_V1.superseded_by: null -> NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V2
```

No lifecycle flip occurs in this authoring PR.

## 4. Current State

### STATE-NI2-001 — `loadAuthConfig` enforces HTTPS-only

- Subject: `packages/notification-ingress/src/auth.js` `normalizeHttpsOrigin` / `loadAuthConfig`.
- As of commit: `9bb5b97442c7155da36f06e867d1a655410544ac`.
- Environment: `mayf3/dsh-agent-core` source tree, `main`.
- Observed at: 2026-08-30T17:03:31Z.
- Projection: only parsed `https:` origins with normalized path `/` and no parsed search/hash are
  accepted; every HTTP origin is rejected as `AUTH_NOT_CONFIGURED`.
- Basis: `OBS-NI2-001`, `EVD-NI2-001`.

### STATE-NI2-002 — token fetch has implicit redirect behavior

- Subject: `createServiceAuthVerifier` token request.
- As of commit: `9bb5b97442c7155da36f06e867d1a655410544ac`.
- Environment: `mayf3/dsh-agent-core` source tree, `main`.
- Observed at: 2026-08-30T17:03:31Z.
- Projection: the fetch options do not set a redirect policy, so the accepted authority does not
  currently guarantee zero redirect following.
- Basis: `OBS-NI2-002`, `EVD-NI2-002`.

### STATE-NI2-003 — authentication and idempotency are already implemented

- Subject: Notification Ingress implementation merged by PR #63.
- As of commit: `9bb5b97442c7155da36f06e867d1a655410544ac`.
- Environment: `mayf3/dsh-agent-core` source tree and merged GitHub PR records.
- Observed at: 2026-08-30T17:03:31Z.
- Projection: Basic credential parsing, per-request token mint verification, fixed resource/scope,
  allowlist, durable idempotency, and fail-closed missing config exist and remain the carried-forward
  baseline. This is source state, not a claim about production configuration or deployment.
- Basis: `OBS-NI2-003`, `EVD-NI2-003`.

## 5. Observations

### OBS-NI2-001 — exact HTTPS gate

- Repository/source: `mayf3/dsh-agent-core`.
- Commit/artifact: `9bb5b97442c7155da36f06e867d1a655410544ac`,
  `packages/notification-ingress/src/auth.js:134-144,218-220`.
- Environment: local clean worktree at the exact commit.
- Observed at: 2026-08-30T17:03:31Z.
- Method: direct source inspection.
- Result: `normalizeHttpsOrigin` requires `url.protocol === 'https:'`; `loadAuthConfig` maps failure to
  `AUTH_NOT_CONFIGURED`.
- Provenance: exact source coordinates above.

### OBS-NI2-002 — no explicit redirect option

- Repository/source: `mayf3/dsh-agent-core`.
- Commit/artifact: `9bb5b97442c7155da36f06e867d1a655410544ac`,
  `packages/notification-ingress/src/auth.js:287-309`.
- Environment: local clean worktree at the exact commit.
- Observed at: 2026-08-30T17:03:31Z.
- Method: direct source inspection.
- Result: the credential-bearing `/oauth/token` fetch sets method, headers, body and signal but no
  `redirect` option.
- Provenance: exact source coordinates above.

### OBS-NI2-003 — accepted authorities and implementation ownership

- Repository/source: `mayf3/dsh-agent-core`.
- Commit/artifact: `9bb5b97442c7155da36f06e867d1a655410544ac` and merged PRs #37, #50, #63.
- Environment: local clean worktree plus GitHub merged-PR metadata.
- Observed at: 2026-08-30T17:03:31Z.
- Method: direct accepted-Spec, implementation source, and merged-PR inspection.
- Result: Notification Ingress V1 owns `auth.json`, online token verification, service caller identity,
  allowlist, idempotency, and credential boundaries; its Clarification owns the exact resource/scope.
  Broker origin policy is a separate consumer and authority.
- Provenance: the two Specs in `supersedes` and Notification Ingress source paths.

### OBS-NI2-004 — URL normalization erases required lexical distinctions

- Repository/source: local Node.js WHATWG URL implementation used by this repository's runtime tests.
- Commit/artifact: Node `v26.7.0`; authoring worktree at `9bb5b97442c7155da36f06e867d1a655410544ac`.
- Environment: macOS local authoring environment.
- Observed at: 2026-08-30T17:03:31Z.
- Method: execute `new URL(input)` for the raw matrix and record `href`, `hostname`, `port`,
  `pathname`, `search`, and `hash`.
- Result: `127.1`, `2130706433`, `0x7f.0.0.1`, and `127.0.0.1.` all produce hostname
  `127.0.0.1`; explicit HTTP `:80` serializes with empty parsed port; raw `/.` normalizes to `/`;
  raw empty `?` and `#` produce empty parsed search/hash even though their delimiters remain in `href`.
- Provenance: authoring command and output recorded in the Draft PR conversation; this Spec preserves
  the load-bearing result and exact runtime version.

## 6. Claims and assumptions

### CLM-NI2-001 — this request changes accepted security semantics

- Support state: SUPPORTED.
- Supported by evidence: `EVD-NI2-001`.
- Contradicted by evidence: none known.
- Uncertainty: none; a previously rejected HTTP input becomes accepted.

### CLM-NI2-002 — parsed-hostname equality is insufficient for the required literal rule

- Support state: SUPPORTED.
- Supported by evidence: `EVD-NI2-004`.
- Contradicted by evidence: none known.
- Uncertainty: none for the contract; implementations may choose any equivalent raw validator that
  passes the complete matrix.

### CLM-NI2-003 — redirect refusal is part of credential non-disclosure

- Support state: SUPPORTED.
- Supported by evidence: `EVD-NI2-002`.
- Contradicted by evidence: none known.
- Uncertainty: transport implementations differ in how `redirect: error` surfaces the first 3xx; the
  Contract therefore binds observable zero-follow behavior and fail-closed classification.

## 7. Evidence relations

### EVD-NI2-001 — source gate supports the lifecycle classification

- Source observations: `OBS-NI2-001`.
- Target: `STATE-NI2-001`, `CLM-NI2-001`.
- Relation: SUPPORTS.
- Bound coordinates: `mayf3/dsh-agent-core@9bb5b974`, `auth.js:134-144,218-220`.
- Strength/sufficiency: exact for current source and accepted HTTPS-only meaning.
- Limitations: does not prove production configuration.

### EVD-NI2-002 — fetch options support the redirect gap

- Source observations: `OBS-NI2-002`.
- Target: `STATE-NI2-002`, `CLM-NI2-003`.
- Relation: SUPPORTS.
- Bound coordinates: `mayf3/dsh-agent-core@9bb5b974`, `auth.js:287-309`.
- Strength/sufficiency: exact for the token request construction.
- Limitations: does not infer a particular auth-service response.

### EVD-NI2-003 — accepted authority chain supports ownership

- Source observations: `OBS-NI2-003`.
- Target: `STATE-NI2-003`.
- Relation: SUPPORTS.
- Bound coordinates: merged PRs #37, #50 and #63 in `mayf3/dsh-agent-core`.
- Strength/sufficiency: exact for repository authority and implementation ownership.
- Limitations: external auth-service remains externally governed.

### EVD-NI2-004 — raw grammar is necessary to preserve lexical identity

- Source observations: `OBS-NI2-004`.
- Target: `CLM-NI2-002`.
- Relation: SUPPORTS.
- Bound coordinates: Node `v26.7.0` authoring probe at repository base `9bb5b974`.
- Strength/sufficiency: directly demonstrates that parsed fields erase aliases, explicit default port,
  dot-segment and empty-delimiter distinctions that the raw policy must decide.
- Limitations: implementation acceptance must rerun the matrix at its exact runtime revision.

## 8. Decisions

### DEC-NI2-001 — one lexical HTTP exception

- Decision owner: mayf3.
- Decision: the only accepted plain-HTTP `authServiceOrigin` is the exact raw grammar
  `http://127.0.0.1:<explicit-port>/` defined by `CTR-NI2-ORI-001`.
- Rejected alternatives: `ALT-NI2-001`, `ALT-NI2-002`, `ALT-NI2-003`.
- Reason: enable an explicit local auth-service endpoint without opening a hostname-equivalence,
  private-network, DNS, or path surface.
- Owner decision remaining: NONE.

### DEC-NI2-002 — raw syntax decides eligibility

- Decision owner: mayf3.
- Decision: HTTP exception eligibility is decided from the original unmodified input before WHATWG
  parsing or normalization. A parsed `hostname === '127.0.0.1'` is not sufficient.
- Rejected alternatives: parser-normalized hostname equality and post-parse reconstruction.
- Reason: aliases, trailing dots, default-port elision and dot-segment normalization can erase the
  lexical facts this policy is required to reject.
- Owner decision remaining: NONE.

### DEC-NI2-003 — credential-bearing redirects never follow

- Decision owner: mayf3.
- Decision: the token request follows zero redirects for HTTP and HTTPS origins; every 3xx is
  fail-closed and produces no second network request.
- Rejected alternatives: same-origin redirects, one-hop redirects, manual allowlist following.
- Reason: token endpoint identity is frozen by the validated origin plus `/oauth/token`; redirect
  handling must not create a second credential destination.
- Owner decision remaining: NONE.

### DEC-NI2-004 — all accepted auth and idempotency meaning carries forward

- Decision owner: mayf3.
- Decision: caller identity, resource/scope, allowlist, failure classes, per-request verification,
  credential non-echo, idempotency, Router and wire semantics remain the complete V1 meaning restated
  in `CTR-NI2-AUTH-*`, `CTR-NI2-IDM-*`, `CTR-NI2-BND-*`, and `CTR-NI2-WIRE-*`.
- Rejected alternative: treating the loopback origin as authentication or skipping token validation.
- Reason: transport locality does not establish caller identity.
- Owner decision remaining: NONE.

## 9. Contracts

### 9.1 Origin and token transport

#### CTR-NI2-ORI-001 — exact raw HTTP grammar

Before any URL parser or normalizer can determine HTTP eligibility, the original
`authServiceOrigin` value MUST match exactly:

```text
^http://127\.0\.0\.1:([0-9]+)/$
```

The captured base-10 port MUST have numeric value `1..65535`. Scheme and host are lowercase exact
literals; the port contains one or more decimal digits with no sign, whitespace or percent encoding;
leading-zero decimal spellings remain explicit ports and are allowed. The terminal `/` is required.
Only after this raw eligibility decision, `loadAuthConfig` MAY return the canonical origin
serialization without its terminal slash (matching the existing HTTPS config shape); that output
normalization MUST NOT be used to admit a non-matching raw input.

#### CTR-NI2-ORI-002 — required HTTP rejections

Every other HTTP input MUST be invalid configuration before any token-endpoint network attempt.
Required reject classes include:

```text
hostname aliases: 127.1, 127.0.1, 2130706433, 0x7f.0.0.1, 0177.0.0.1
localhost: localhost and any case/trailing-dot variant
IPv6: [::1] and every other IPv6 spelling
trailing dot: 127.0.0.1.
userinfo: user@, user:pass@
query: ?x, ?
fragment: #x, #
dot segment/path: /., /.., /a/../, /%2e/, or any path other than raw /
port: missing, empty, numeric 0, numeric >65535, signed, whitespace, non-decimal
syntax: upper/mixed-case scheme, whitespace, control characters, percent-encoded host characters
```

This list is representative by class, not permission for unlisted aliases. Failure is the existing
`AUTH_NOT_CONFIGURED` state and causes zero token fetches.

#### CTR-NI2-ORI-003 — HTTPS remains the default

Any origin not accepted by `CTR-NI2-ORI-001` MUST satisfy the carried-forward HTTPS-origin rule or be
invalid configuration: it parses as an absolute URL with protocol `https:`, normalized pathname `/`,
empty search and empty fragment, and `loadAuthConfig` returns its canonical `url.origin`. No
non-loopback host, private address, DNS name, IPv6 address, wildcard or interface address gains
plain-HTTP permission. Existing HTTPS origin semantics do not become HTTP permissions by host
equivalence.

#### CTR-NI2-ORI-004 — token endpoint is fixed and redirect-free

For a validated origin, the only verification endpoint is exactly `<validated-origin>/oauth/token`.
The credential-bearing request MUST use a transport mode equivalent to `redirect: 'error'`: it MUST
NOT follow 301, 302, 303, 307, 308, or any other 3xx; MUST NOT issue a second request; and MUST NOT
re-send Basic credentials to any redirect target. Any 3xx or transport-level redirect refusal is
fail-closed as `503 AUTH_INCONCLUSIVE`, with no Router call and no idempotency mutation.

### 9.2 Authentication and authorization

#### CTR-NI2-AUTH-001 — credential presentation and identity

`POST /v1/deliver` requires a well-formed Basic client credential. Missing, non-Basic, malformed
base64/UTF-8, empty clientId or empty secret is `401 INVALID_CREDENTIAL`. The verified clientId, never
a body field or network source, is `callerPrincipalId`.

#### CTR-NI2-AUTH-002 — exact online verification protocol

Every request performs one online auth-service client-credentials mint using Basic credentials,
`grant_type=client_credentials`, resource `agent-core-notification-ingress-v1`, and scope
`notification.deliver`. No credential or positive/negative verification result is cached. The verifier
MUST expose an injectable `fetchImpl` transport seam for deterministic tests and acceptance, matching
the established verification primitive; production defaults to the runtime fetch implementation. The
origin exception MUST NOT skip, stub, replace, downgrade or locally emulate this verification.

#### CTR-NI2-AUTH-003 — caller allowlist and separation

The only caller names are `svc-forum` and `svc-workflow`, mapped by trusted config to distinct,
non-empty clientIds. A verified clientId outside that mapping, including any Agent client, is
`403 CALLER_NOT_ALLOWED`. Body caller identity is ignored.

#### CTR-NI2-AUTH-004 — failure classification

Invalid/revoked/wrong-resource credentials proven by `invalid_client`, `invalid_scope`,
`invalid_grant`, `invalid_resource`, or `invalid_target` are `401 INVALID_CREDENTIAL`. Transport
failure, 3xx, 5xx, `temporarily_unavailable`, unknown OAuth error, malformed response, or 200 without a
non-empty access token is `503 AUTH_INCONCLUSIVE`. No inconclusive result is admitted.

#### CTR-NI2-AUTH-005 — rotation, revocation, and management boundary

Secret rotation preserves clientId and idempotency identity; the next request uses the newly presented
secret without ingress restart. Revocation fails subsequent verification but does not rewrite durable
outcomes. Ingress never calls auth-service principal/client management APIs and never creates or
modifies auth-service entities.

#### CTR-NI2-AUTH-006 — credential non-disclosure

Authorization values, Basic plaintext, clientSecret, and derived credential material MUST NOT appear
in logs, error messages, HTTP responses, evidence, idempotency state, Agent workspaces, or Agent child
environments. Origin-validation and redirect failures obey the same redaction rule.

#### CTR-NI2-AUTH-007 — external audience and principal-profile equality

The exact external dependency is `mayf3/auth-service`
`AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1` at
`159d020b1635cfa7144c8238e9a91d1c6bc268d1`. Mechanical equality is required:

```text
AUTH audience = CORE resource = agent-core-notification-ingress-v1
AUTH registered scope = CORE scope = notification.deliver
accepted_principal_types = [service]
machine_access_enabled = true
human_access_enabled = false
delegated_access_enabled = false
svc-forum and svc-workflow = distinct service clients and distinct secrets; no delegation
```

The pinned external authority at that exact revision MUST itself receive independent exact-revision
review, authorized acceptance, and merge into the auth-service authority branch before Notification
implementation may start. Any absent lifecycle proof, mismatch, or semantic change blocks
implementation until auth-service completes its lifecycle and this repository reviews and pins the
exact effective revision. External authority remains owned by auth-service.

### 9.3 Durable idempotency

#### CTR-NI2-IDM-001 — key and payload hash

The authority key is `(callerPrincipalId, requestId)`. Canonical payload bytes are UTF-8 bytes of
exactly the no-whitespace result of:

```text
JSON.stringify({
  agentId,
  message,
  requestId,
  sessionMode
})
```

with that insertion order. `payloadHash` is the SHA-256 lowercase hex of those exact bytes. Unknown
wire fields and delivery outcome are excluded.

#### CTR-NI2-IDM-002 — authority store and persistence

The authority is exactly one versioned JSON document:

```text
path = <production-root>/notification-ingress/idempotency.json
shape = {"version":1,"records":{"<clientId>":{"<requestId>":{
  callerPrincipalId, requestId, payloadHash,
  state:"reserved"|"delivered"|"failed_no_admission"|"outcome_unknown",
  createdAt, updatedAt,
  sessionId?, failure?{code,httpStatus},
  history?[{at,from,to,reason}]   // maximum 16, oldest evicted first
}}}}
```

Every mutation uses an in-process queue, `<same-directory>/idempotency.lock` advisory lock,
re-read-latest after lock acquisition, temporary file, file fsync, atomic rename, and directory fsync
on first creation. Directory mode is 0700, file mode 0600, and owner is the trusted non-root
control-plane account. A missing file is an empty store. Parse failure, structural invalidity or an
unknown version fails loud at mount; no reset or in-memory degraded mode is permitted. Exactly one
production runtime mounts exactly one Notification Ingress instance; the lock is defensive
serialization, not multi-instance authority.

#### CTR-NI2-IDM-003 — reserve-before-Router state machine

States are `reserved -> delivered | failed_no_admission | outcome_unknown`. Reservation is durable
before Router invocation. For same key/same payload, there is no second Router call and the stored
outcome is returned exactly: delivered is
`200 {accepted:true,sessionId:<stored>,outcome:"delivered",duplicate:true}`;
failed-no-admission reuses its stored 400/404 error envelope; unknown is
`200 {accepted:false,outcome:"outcome_unknown",duplicate:true}`. Same key/different payload is
`409 CONFLICT` regardless of stored state, without mutation. Concurrent same-key/same-payload calls
use per-key single-flight and wait for the in-flight terminal result; they do not independently infer
unknown while the attempt remains in flight.

#### CTR-NI2-IDM-004 — conservative outcome classification

Only Router `VALIDATION_ERROR` and `AGENT_NOT_FOUND`, proven before admission, become
`failed_no_admission`. Every other Router error, timeout or uncertain settlement becomes
`outcome_unknown`; automatic re-delivery is forbidden.

#### CTR-NI2-IDM-005 — crash, restart, late settlement, and remediation

Crash before durable reserve permits a clean retry. Crash after reserve and before a proven terminal
write becomes `outcome_unknown` on restart. Boot atomically sweeps every non-terminal `reserved`
record to `outcome_unknown` and appends history reason exactly `restart_unresolved`; no reserved record
is resumed or re-delivered. Late Router settlement is evidence-only and never rewrites authority.
Remediation requires caller business choice and a new requestId.

#### CTR-NI2-IDM-006 — deadline, retention, evidence, and BindingStore boundary

Router wait deadline defaults to 300000 ms and may be overridden only by a positive integer in trusted
config; server `requestTimeout=0` remains because the handler owns the bound. Terminal retention
defaults to 604800000 ms (7 days) and 100000 records. Sweep runs at boot and hourly, affects terminal
records only, removes over-age terminal records first and then oldest terminal records above the cap.
The retention window is the duplicate-protection horizon: a later same-key request is new admission.

Audit evidence is append-only
`<production-root>/notification-ingress/evidence.jsonl`, contains at least `auth_ok`,
`auth_reject(code,clientId?)`, `idempotency_transition(from,to,reason)`,
`outcome(delivered|failed_no_admission|outcome_unknown)`, `late_settled`,
`sweep_pruned(count)`, and `boot_unresolved_sweep(count)`, never credential material, rotates at
10 MiB and retains two generations. It is evidence only and is never read for authority or recovery.
BindingStore `freshSessions` remains `(agentId,requestId)->sessionId` session identity reuse; ingress
never reads it and it is never delivery-idempotency authority.

### 9.4 Config, composition, Router, and wire

#### CTR-NI2-BND-001 — trusted auth.json seam

`<production-root>/notification-ingress/auth.json` is an operator-owned regular non-symlink 0600 file
inside a regular non-symlink 0700 directory, owned by the non-root control-plane account. Its semantic
keys are exactly `authServiceOrigin` (required), `audience` (required and exactly
`agent-core-notification-ingress-v1`), `allowlist` (required object with exactly the required
`svc-forum` and `svc-workflow` client mappings), plus optional positive integers
`routerDeadlineMs`, `retentionMs`, and `maxRecords`; it contains no clientSecret. Missing or invalid
config is a legal not-ready state: mount remains up and every delivery is
`503 AUTH_NOT_CONFIGURED`, never anonymous acceptance.

#### CTR-NI2-BND-002 — composition and Agent isolation

Composition supplies only verifier/config/store paths. No Notification credential or auth-config
semantic value (`authServiceOrigin`, audience, allowlist, deadlines, retention, limits) is accepted
from global `process.env`. `NOTIFICATION_INGRESS_*` environment inputs are limited to the existing
non-secret `ENABLED`, `HOST`, and `PORT` controls plus the `AUTH_CONFIG` path pointer; no secret or
semantic auth value may be introduced under another environment name. No Notification credential is
injected into Agent children. AgentProcess and uid separation remain unchanged.

#### CTR-NI2-BND-003 — Router boundary

Router receives a delivery only after successful per-request token verification, allowlist admission,
body validation and durable reservation. Router remains business-unaware and has no Forum/Workflow,
origin, OAuth or idempotency special case.

#### CTR-NI2-WIRE-001 — endpoints and health

`GET /health` is unauthenticated and returns only `{ok,service,deliverReady,authConfigured,storeReady}`
level name/boolean fields; it never exposes origin or allowlist content. `POST /v1/deliver` requires
authentication. Other paths/methods retain 404/405 behavior.

#### CTR-NI2-WIRE-002 — exact status classes and envelopes

```text
401 = missing/malformed/invalid/revoked/wrong-resource credential
403 = verified caller not in allowlist
400 = Router VALIDATION_ERROR
404 = Router AGENT_NOT_FOUND
409 = same idempotency key with different payload
500 = INTERNAL_ERROR
503 = AUTH_INCONCLUSIVE | AUTH_NOT_CONFIGURED | SERVICE_UNAVAILABLE
200 = delivered, duplicate delivered, outcome_unknown, duplicate outcome_unknown
```

Success/unknown bodies are `{accepted,sessionId?,outcome,duplicate?}`. Errors are
`{error:{code,message}}`. `accepted:true` means Router inbox admission, not model-turn completion.

#### CTR-NI2-WIRE-003 — body and thin-adapter semantics

The request body limit is exactly 1 MiB. The adapter reads exactly `requestId`, `agentId`,
`sessionMode`, and `message`; unknown fields are ignored and do not enter payloadHash. Required-field
and `sessionMode` validation remain pre-gate and create no idempotency state.

#### CTR-NI2-DEP-001 — implementation-order gates

There is no technical dependency on a new AgentProcess seam: the implementation consumes existing
`agentRouter.deliver` and does not change AgentProcess, BindingStore, kernel or v2-ingress-gate.
Nevertheless, Program order remains mandatory: AgentProcess implementation PASS precedes Notification
implementation; Scheduler implementation waits for Notification implementation PASS. V2
implementation may start only after V2 receives independent exact-revision review, is accepted and
merged into the implementation base; the exact pinned auth-service authority in
`CTR-NI2-AUTH-007` has independent review, authorized acceptance and authority-branch merge proof;
its equality holds; and the AgentProcess prerequisite is PASS. Proposed or merely
accepted-but-unmerged local or external authority grants no permission.

## 10. Acceptance

### ACC-NI2-ORI-001 — exact positive origin matrix

- Contracts: `CTR-NI2-ORI-001`, `CTR-NI2-ORI-003`.
- Method: table-driven config validation plus token-fetch recorder.
- Environment: exact implementation commit in a clean worktree, repository-supported Node runtime,
  temporary 0700 root with 0600 auth.json, injected fetch recorder, no real auth-service.
- Inputs: at least `http://127.0.0.1:1/`, `http://127.0.0.1:80/`,
  `http://127.0.0.1:080/`, `http://127.0.0.1:4001/`, `http://127.0.0.1:65535/`, and valid existing
  HTTPS origins.
- Required evidence: implementation SHA, Node version, runner command, complete case table, loaded
  config value, recorded request URL/options and pass/fail summary.
- Expected result: each accepted raw HTTP form validates; its fetch URL is exactly
  `<canonical loadAuthConfig origin>/oauth/token` (so default-port serialization may omit `:80`);
  valid HTTPS behavior remains accepted.
- Failure condition: rejection, normalization to another origin, or a different endpoint.

### ACC-NI2-ORI-002 — required raw rejection matrix

- Contracts: `CTR-NI2-ORI-001`, `CTR-NI2-ORI-002`, `CTR-NI2-ORI-003`.
- Method: table-driven validation over every named class and representative in
  `CTR-NI2-ORI-002`, including empty `?` and `#`, default port spelling without explicit port,
  all named host aliases, tail dot, userinfo, IPv6 and dot segments. Positive leading-zero decimal
  spellings such as `:080` belong in the positive matrix, not the rejection matrix.
- Environment: exact implementation commit in a clean worktree, repository-supported Node runtime,
  temporary trusted config root, injected fetch/Router/idempotency recorders.
- Required evidence: implementation SHA, Node version, runner command, raw input table, config result,
  and per-case counters proving fetch=0, Router=0 and idempotency mutations=0.
- Expected result: no HTTP input outside the exact raw grammar is accepted even when a URL parser would normalize it
  to the same network destination.
- Failure condition: any candidate validates, reaches fetch, or is silently rewritten.

### ACC-NI2-ORI-003 — redirect fail-closed drill

- Contracts: `CTR-NI2-ORI-004`, `CTR-NI2-AUTH-004`, `CTR-NI2-AUTH-006`.
- Method: table-drive every integer status `300..399` from a token endpoint stub, with same-origin and
  cross-origin `Location` targets where the status permits a Location header, exercised for accepted
  HTTP and valid HTTPS origins. No unlisted 3xx may rely on default behavior.
- Environment: exact implementation commit, repository-supported Node runtime, local first-hop and
  redirect-target recorders on distinct ports, temporary config/store, recorder Router.
- Required evidence: implementation SHA, Node version, runner command, per-status request/response
  transcript, first-hop count, target count, sanitized request headers, Router count, store before/after
  hash, evidence output and final HTTP response.
- Expected result: `503 AUTH_INCONCLUSIVE`; exactly one attempted request; zero redirected requests;
  zero Router calls; zero idempotency mutations; no credential in output/evidence.
- Failure condition: redirect follow, second request, credential forwarding, admission, or 401.

### ACC-NI2-AUTH-001 — no token-validation bypass

- Contracts: `CTR-NI2-AUTH-001` through `CTR-NI2-AUTH-007`, `CTR-NI2-BND-003`.
- Method: execute the complete auth matrix defined by these V2 Contracts for both accepted HTTP and
  HTTPS origins; machine-compare the pinned external Audience, Scope and principal profile.
- Environment: exact implementation commit, repository-supported Node runtime, temporary trusted
  config/store, injected token endpoint and Router recorders; read-only access to the exact external
  authority revision.
- Required evidence: implementation SHA, external authority SHA, Node version, runner command, config,
  request/result table, token call counts and exact form bodies, Router/store counters, rotation/revoke
  sequence, secret scan and cross-repository equality output.
- Expected result: anonymous/malformed/revoked/wrong-resource/non-allowlisted/inconclusive cases retain
  401/403/503 semantics and zero Router admission; both allowed services succeed only after one valid
  online mint; body caller spoofing is ignored; rotation/revocation semantics remain.
- Failure condition: locality becomes identity, token fetch is skipped, or any failure is admitted.

### ACC-NI2-IDM-001 — complete idempotency regression

- Contracts: `CTR-NI2-IDM-001` through `CTR-NI2-IDM-006`.
- Method: execute exact `JSON.stringify` canonical-byte/hash vectors, duplicate outcome shapes,
  conflict, concurrency, crash W1-W4, real restart/kill -9 with `restart_unresolved` history assertion,
  deadline, late-settlement, corruption/version/schema, hourly/boot retention, evidence event/rotation,
  metadata/lock/fsync and BindingStore-isolation tests under both accepted origin classes.
- Environment: exact implementation commit, repository-supported Node runtime, temporary trusted root,
  controllable clock, child process for restart, fault-injectable filesystem and recorder Router.
- Required evidence: implementation SHA, Node version, runner command, initial/final authority bytes and
  hashes, state-transition table, Router counts, crash points, restart PIDs, retention ordering,
  evidence files/sizes/generations and complete pass/fail summary.
- Expected result: the exact V2 durable outcomes and zero-replay guarantees hold.
- Failure condition: any origin policy changes keying, reservation, outcome or replay behavior.

### ACC-NI2-BND-001 — config, composition, Router, and wire regression

- Contracts: `CTR-NI2-BND-001` through `CTR-NI2-BND-003`, `CTR-NI2-WIRE-001` through
  `CTR-NI2-WIRE-003`.
- Method: trusted-file metadata matrix; exact auth.json key/default/invalid-value table; source/runtime
  proof that global env accepts only existing ENABLED/HOST/PORT controls plus the AUTH_CONFIG path
  pointer and no auth semantic values; missing/invalid config calls; child-env secret scan; Router
  recorder; exact health/status/envelope/body-limit/unknown-field table; and changed-path audit.
- Environment: exact implementation commit, repository-supported Node runtime, temporary trusted root,
  mounted Notification Ingress with injected token/Router recorders and isolated child environment.
- Required evidence: implementation SHA, Node version, runner command, file stat records, config cases,
  health and delivery request/response transcript, 1-MiB boundary results, child-env/log/store/evidence
  secret scans, Router/store counters and changed-path list.
- Expected result: all exact V2 boundaries pass; implementation is confined to Notification
  Ingress auth/config tests and source required by these Contracts.
- Failure condition: secret exposure, Router semantic change, anonymous fallback, wire drift, or Broker
  package change.

### ACC-NI2-DEP-001 — authority and implementation-order gate

- Contracts: `CTR-NI2-DEP-001`.
- Method: exact-base authority audit plus changed-path and dependency-status checks before implementation.
- Environment: proposed/accepted Spec Git commits, target implementation base branch, merged PR and
  conformance records; no production action.
- Required evidence: V2 reviewed/accepted/merge SHAs, predecessor atomic lifecycle transaction,
  implementation-base SHA, pinned auth-service review record, authorized acceptance record and
  authority-branch merge SHA at the exact external revision, external pin equality result, AgentProcess
  implementation PASS record, Notification changed-path list, and proof Scheduler implementation did
  not precede Notification PASS.
- Expected result: every gate is PASS before semantic implementation begins.
- Failure condition: implementation starts from a base without accepted V2; the exact external
  authority lacks independent review, authorized acceptance or authority-branch merge; an external
  mismatch exists; AgentProcess prerequisite lacks PASS; predecessor lifecycle is non-atomic; or
  Scheduler runs early.

### Contract coverage

| Contract group | Acceptance | Covered |
|---|---|---|
| `CTR-NI2-ORI-001..004` | `ACC-NI2-ORI-001..003` | YES |
| `CTR-NI2-AUTH-001..007` | `ACC-NI2-ORI-003`, `ACC-NI2-AUTH-001` | YES |
| `CTR-NI2-IDM-001..006` | `ACC-NI2-IDM-001` | YES |
| `CTR-NI2-BND-001..003` | `ACC-NI2-AUTH-001`, `ACC-NI2-BND-001` | YES |
| `CTR-NI2-WIRE-001..003` | `ACC-NI2-BND-001` | YES |
| `CTR-NI2-DEP-001` | `ACC-NI2-DEP-001` | YES |

## 11. Alternatives and disposition

### ALT-NI2-001 — parsed hostname equals 127.0.0.1

- Disposition: rejected.
- Reason: parser canonicalization accepts or erases forbidden lexical aliases and delimiters.
- Evidence/Claims considered: `CLM-NI2-002`, `EVD-NI2-004`.
- What would reopen: an Owner-directed policy that intentionally accepts a named alias set and a new
  whole-authority successor with an exhaustive ambiguity analysis.

### ALT-NI2-002 — localhost or IPv6 loopback

- Disposition: rejected.
- Reason: the authorized host is the original exact string `127.0.0.1`, not semantic loopback.
- Evidence/Claims considered: Owner constraint and `DEC-NI2-001`.
- What would reopen: explicit Owner authority naming each additional raw form in a future successor.

### ALT-NI2-003 — broader local/private-network HTTP

- Disposition: rejected.
- Reason: private, link-local, wildcard, interface and DNS destinations are not the narrow exception.
- Evidence/Claims considered: `DEC-NI2-001`.
- What would reopen: a new transport security design with endpoint identity and credential-disclosure
  analysis; operational convenience alone is insufficient.

### ALT-NI2-004 — follow safe or same-origin redirects

- Disposition: rejected.
- Reason: the fixed token endpoint must not delegate credential destination through server response.
- Evidence/Claims considered: `CLM-NI2-003`.
- What would reopen: a future whole-authority successor defining a cryptographically bound redirect
  destination; ordinary URL allowlisting is insufficient.

### ALT-NI2-005 — amend V1 or rely on Broker PR #116

- Disposition: rejected.
- Reason: accepted security/failure semantics change requires whole-authority supersession, and Broker
  is a separate origin consumer outside Notification Ingress ownership.
- Evidence/Claims considered: repository governance and `OBS-NI2-003`.
- What would reopen: none under current governance; Broker work can govern Broker only.

## 12. Migration, compatibility, and rollback

```text
MIGRATION_THIS_ROUND = NONE
COMPATIBILITY = predecessor auth/idempotency/wire behavior preserved; one literal HTTP origin class added and token 3xx made redirect-free fail-closed
CONFIG_EFFECT_AFTER_FUTURE_IMPLEMENTATION = existing HTTPS configs remain valid; exact-form loopback HTTP may become valid
DATA_MIGRATION = NONE
CREDENTIAL_MIGRATION = NONE
ROLLBACK_THIS_ROUND = close or revise Draft PR
IMPLEMENTATION_ROLLBACK = future implementation reverts to accepted predecessor behavior only under explicit authority
EMERGENCY_CONTAINMENT = disable Notification Ingress or restore HTTPS config; no new durable behavior authorized here
```

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
READY_TO_MARK_ACCEPTED = NO
```

## 14. Authoring closure

```text
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V2
SPEC_KIND = implementation
STATUS = proposed
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = none
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_HARDENING_PROGRAM_V1
EXTERNAL_AUTHORITIES = mayf3/auth-service/AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1@159d020b1635cfa7144c8238e9a91d1c6bc268d1
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
NORMATIVE_DELTA_COUNT = 2
NORMATIVE_DELTAS = [literal 127.0.0.1 explicit-port HTTP exception, token 3xx redirect-free fail-closed]
CONTRACT_COUNT = 24
CONTRACTS_WITH_ACCEPTANCE = 24
AUTHORING_READY_FOR_REVIEW = YES
READY_TO_MARK_ACCEPTED = NO
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
MERGE_PERFORMED = NO
NEXT_TASK = 鉴源 审计
```
