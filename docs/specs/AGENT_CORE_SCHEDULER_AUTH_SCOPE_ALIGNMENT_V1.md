---
spec_id: AGENT_CORE_SCHEDULER_AUTH_SCOPE_ALIGNMENT_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
scope:
  - scheduler self-service authorization proof
  - production-runtime scheduler authorization integration
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1
external_authorities:
  - repository: mayf3/auth-service
    authority_id: MINIMAL_AUTH_FOUNDATION_V2
    revision: 05fcf4074fe15d7f29ce1ef0f68767fbbebd54de
    relation: constrained_by
supersedes: []
superseded_by: null
owners:
  - repository-maintainers
---

# AGENT_CORE_SCHEDULER_AUTH_SCOPE_ALIGNMENT_V1

> **Proposed bounded child amendment.** This document has no implementation or production
> apply authority. It does not edit or supersede
> `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1`; it adds the minimum wire-level alignment
> needed for that accepted parent's existing `scheduler.manage:any` local predicate to be
> proved through auth-service's exact scope grammar.

## 1. Goal

Separate the Scheduler's existing local cross-agent entitlement name from the exact OAuth
scope sent to auth-service:

```text
local predicate: scheduler.manage:any
auth resource:   scheduler
auth wire scope: scheduler.manage-any
```

The local predicate, authorization result, public behavior, denial vocabulary, ownership
rules, and Scheduler execution semantics remain unchanged. Only the `assertGrant` / token
request proof input changes from the colon form to the hyphen form.

## 2. Scope and non-goals

### In scope

- preserve `scheduler.manage:any` as the Agent Core local entitlement and predicate name;
- use exact wire scope `scheduler.manage-any` with exact resource `scheduler` when asking
  auth-service to prove that predicate;
- preserve `scheduler.read:self` and `scheduler.manage:self` as local-only outcomes that
  make no token request;
- fail closed when exact external proof is denied, absent, malformed, unavailable, or
  uncertain;
- cover the alignment in exactly four future implementation/test files:
  `packages/scheduler/src/self-service.js`,
  `packages/scheduler/test/self-service.test.js`,
  `packages/scheduler/test/cross-agent.test.js`, and
  `packages/production-runtime/test/compose-cross-agent-history.test.js`.

### Non-goals

- renaming or replacing the local `scheduler.manage:any` predicate;
- creating `scheduler.admin` or any other Scheduler scope;
- turning `scheduler.read:self` or `scheduler.manage:self` into token scopes;
- accepting, translating, retrying, or falling back to an alias;
- changing Scheduler action, ownership, occurrence, run, session, target, correlation,
  history, idempotency, replay, delivery, or terminal-outcome semantics;
- changing production composition outside the named focused test;
- registering an auth audience or scope, changing a registry/database, creating or applying
  a Grant, reading or writing credentials, deploying, reloading, or running a production
  canary in this docs-only round.

## 3. Authority and dependencies

### 3.1 Local parent authority

The accepted parent is
`AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1` at repository blob
`b3cebc5d3bd64013d8b605311e2cc12cf52cab7f`. Its body remains byte-unchanged.
This child preserves the parent's local predicates and narrows only the external proof
encoding needed by parent Contract `CTR-AUTH-002`.

The proposal base is exact dsh-agent-core commit
`9e15808f336e7964f5059e871c32f25e6045e622`. Acceptance review MUST bind to the final
candidate head, not merely this proposal base.

### 3.2 External grammar constraint

The external constraint is auth-service `main` commit
`05fcf4074fe15d7f29ce1ef0f68767fbbebd54de`, whose
`MINIMAL_AUTH_FOUNDATION_V2` / incorporated V1 scope contract applies the exact grammar:

```regex
^[a-z][a-z0-9-]*\.[a-z][a-z0-9._-]*$
```

That grammar admits `scheduler.manage-any` and rejects `scheduler.manage:any`. This
repository consumes that fact as an external constraint; this document does not authorize
an auth-service change.

### 3.3 Explicit authority DAG

The only authorized dependency direction is:

```text
accepted AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1
  -> accepted final head of this child alignment Spec
  -> future auth-service Scheduler Audience CCR
  -> separately authorized auth-service source implementation and deployment
  -> separately authorized Grant supply/apply
  -> separately authorized local production activation and canary
```

A future auth-service CCR MAY normatively depend on the accepted exact final head of this
Spec. This Spec is constrained by the pinned current external grammar, but MUST NOT depend
on that future CCR; a circular authority edge is forbidden. Proposal, acceptance,
implementation, merge, external registration, deployment, Grant apply, and runtime proof
remain distinct events.

## 4. Current State

- `STATE-SA-001`: At the exact proposal base, Scheduler self-service defines
  `MANAGE_ANY_SCOPE = 'scheduler.manage:any'` and passes it directly to `assertGrant` with
  resource `scheduler`.
- `STATE-SA-002`: Focused Scheduler tests expect `scheduler.manage:any` in the proof seam,
  and the composed production-runtime cross-agent test expects it in the OAuth token request.
- `STATE-SA-003`: The accepted parent deliberately defines `scheduler.manage:any` as the
  local cross-agent predicate and defines both `*:self` labels as local outcomes rather
  than token scopes.
- `STATE-SA-004`: No compatible exact auth-service wire scope is authorized by current
  dsh-agent-core authority, so real external proof cannot satisfy the accepted local
  predicate under the pinned grammar.

## 5. Observations

- `OBS-SA-001` (2026-09-03, repository object inspection): the accepted parent file has
  blob `b3cebc5d3bd64013d8b605311e2cc12cf52cab7f`; its `CTR-AUTH-002` names the exact local
  predicate `scheduler.manage:any`.
- `OBS-SA-002` (2026-09-03, exact-base source inspection):
  `packages/scheduler/src/self-service.js` uses the same colon-form string both as local
  vocabulary and as the `assertGrant` scope argument.
- `OBS-SA-003` (2026-09-03, exact-base test inspection): the three named Scheduler/runtime
  proof tests assert the colon form at that external seam, including the composed HTTP token
  body.
- `OBS-SA-004` (2026-09-03, pinned auth-service source/manifest inspection): at external
  head `05fcf4074fe15d7f29ce1ef0f68767fbbebd54de`, the exact scope grammar
  `^[a-z][a-z0-9-]*\.[a-z][a-z0-9._-]*$` excludes colon and admits the proposed hyphen form.
- `OBS-SA-005` (2026-09-03, composition inspection): production composition forwards the
  requested scope; no production composition product-code change is required for this
  alignment.

## 6. Claims and assumptions

- `CLM-SA-001`: Distinguishing the local predicate string from the auth wire scope is both
  necessary and sufficient to remove this grammar mismatch without changing local policy.
  Basis: `OBS-SA-002`, `OBS-SA-004`, and the parent's local/external boundary.
- `CLM-SA-002`: A successful exact proof of resource `scheduler` plus wire scope
  `scheduler.manage-any` may establish only the already-defined local predicate
  `scheduler.manage:any`; it creates no broader or differently named authority.
  Basis: closed mapping in `CTR-SA-001` and fail-closed proof in `CTR-SA-002`.
- `CLM-SA-003`: No product-code composition change is necessary because the existing proof
  transport forwards the requested scope unchanged. Basis: `OBS-SA-005`. If implementation
  evidence disproves this claim, work MUST stop for a new or amended Spec; the four-file
  closure MUST NOT be silently expanded.

No normative Contract depends on an unresolved assumption.

## 7. Evidence relations

- `EVD-SA-001`: `OBS-SA-001` + `OBS-SA-002` establish that the colon form is normative
  locally but is currently reused at the external proof seam.
- `EVD-SA-002`: `OBS-SA-004` establishes the incompatibility of that wire value and the
  grammar compatibility of `scheduler.manage-any`.
- `EVD-SA-003`: `EVD-SA-001` + `EVD-SA-002` support the one-to-one mapping frozen by
  `DEC-SA-001`; they do not support aliases or a local predicate rename.
- `EVD-SA-004`: `OBS-SA-003` + `OBS-SA-005` identify the smallest discriminating regression
  surface and support the exact four-file closure.

## 8. Decisions

- `DEC-SA-001` — Preserve the local predicate `scheduler.manage:any`; freeze exact external
  proof tuple `(resource=scheduler, scope=scheduler.manage-any)`.
- `DEC-SA-002` — Treat the tuple as a closed one-to-one proof mapping. Do not translate,
  normalize, alias, dual-request, retry, or fall back among spellings. Any result other than
  verified exact success denies the local predicate.
- `DEC-SA-003` — Keep `scheduler.read:self` and `scheduler.manage:self` local-only. Do not
  register or request them, and do not introduce `scheduler.admin`.
- `DEC-SA-004` — Limit future implementation to the exact four files listed in §2. A newly
  discovered need for any fifth file is a governance stop, not implied authority.
- `DEC-SA-005` — Preserve colon-form local labels in messages, denial details, assertions
  about local policy, and other user-visible/local vocabulary. Only the `assertGrant` and
  resulting token request use the hyphen form.
- `DEC-SA-006` — Keep the authority DAG in §3.3 acyclic and make every external source,
  deploy, Grant, activation, and canary action separately Owner-gated.

## 9. Contracts

### CTR-SA-001 — Closed vocabulary and mapping

The implementation MUST use exactly:

```text
LOCAL_MANAGE_ANY_PREDICATE = scheduler.manage:any
AUTH_RESOURCE              = scheduler
AUTH_MANAGE_ANY_WIRE_SCOPE = scheduler.manage-any
LOCAL_READ_SELF            = scheduler.read:self
LOCAL_MANAGE_SELF          = scheduler.manage:self
```

Only the exact external tuple `(scheduler, scheduler.manage-any)` may prove
`scheduler.manage:any`. The mapping MUST NOT establish any other predicate.

### CTR-SA-002 — Exact proof and fail-closed result

For a request requiring the existing local `scheduler.manage:any` predicate, the trusted
proof seam MUST call `assertGrant(callerAgentId, 'scheduler.manage-any', 'scheduler')` once.
Only an exact verified success may establish the local predicate. Denial, error, timeout,
unavailability, malformed response, or uncertainty MUST return the existing unauthorized
outcome with no Scheduler read or mutation.

### CTR-SA-003 — No alias, translation, fallback, or admin scope

The proof path MUST NOT request `scheduler.manage:any`, translate arbitrary local names,
accept both spellings, retry a second spelling, or fall back after failure. It MUST NOT
request, accept, or introduce `scheduler.admin`.

### CTR-SA-004 — Self access remains local

An authorized self read or self mutation MUST remain governed by local ownership rules and
MUST make zero auth token / `assertGrant` requests for `scheduler.read:self`,
`scheduler.manage:self`, or any substitute.

### CTR-SA-005 — Local and public semantics remain stable

Local policy assertions, denial messages, and user-visible labels MAY and normally SHOULD
continue to say `scheduler.manage:any`. This change MUST NOT alter action schemas, target
ownership, authorization breadth, output schemas, or any Scheduler/run/history behavior.

### CTR-SA-006 — Exact implementation closure

A future implementation authorized by a later lifecycle flip MUST change no product or test
files outside:

1. `packages/scheduler/src/self-service.js`;
2. `packages/scheduler/test/self-service.test.js`;
3. `packages/scheduler/test/cross-agent.test.js`;
4. `packages/production-runtime/test/compose-cross-agent-history.test.js`.

The production-runtime file is test-only. Production composition product code MUST remain
unchanged. Any need to expand this list requires STOP and new or amended accepted authority.

### CTR-SA-007 — External authority ordering

The future auth-service Scheduler Audience CCR MAY cite the accepted exact final head of
this Spec as an upstream dependency. It MUST independently authorize any audience/scope
registration. Auth source implementation/deployment, Grant supply/apply, and local
production activation/canary MUST each remain subsequent, separately authorized DAG nodes.
None is implied by Spec acceptance or local implementation.

### CTR-SA-008 — Lifecycle and Owner gates

This proposal authorizes documentation only. An Owner-bound independent review of the exact
final candidate head is required before changing `status` to `accepted` and
`implementation_authority` to `contracts`. `production_apply_authority` MUST remain `none`.
No acceptance or implementation commit may create a Grant, touch credentials, mutate an
auth registry/database, deploy, reload, or run a production canary.

### CTR-SA-009 — Migration and rollback

There is no data or store migration. After acceptance, implementation migration is a single
source/test alignment from the colon-form proof argument to the exact hyphen-form proof
argument while retaining the colon-form local predicate. Rollback MUST restore the four-file
preimage; it MUST NOT add aliases or dual-scope fallback. External registration, deployment,
Grant application/revocation, and local runtime rollback remain separately authorized
operations with their own evidence.

## 10. Acceptance

- `ACC-SA-001` (`CTR-SA-001`, `CTR-SA-002`, `CTR-SA-005`): focused source/unit evidence
  proves a cross-agent operation asks once for exact scope `scheduler.manage-any` and resource
  `scheduler`, then exposes only local predicate/denial vocabulary `scheduler.manage:any`.
- `ACC-SA-002` (`CTR-SA-002`, `CTR-SA-003`): positive evidence proves exact verified success
  permits the existing cross-agent operation; negative table evidence proves colon-form,
  alias, `scheduler.admin`, denial, error, malformed, and unavailable proof cannot authorize,
  cannot trigger a second request, and cannot read or mutate the target.
- `ACC-SA-003` (`CTR-SA-004`): self read and self mutation tests prove successful local
  behavior with zero `assertGrant` / token requests.
- `ACC-SA-004` (`CTR-SA-005`, `CTR-SA-006`): cross-agent Scheduler tests retain existing
  ownership and result semantics, and diff inspection proves the exact four-file closure with
  no production composition source change.
- `ACC-SA-005` (`CTR-SA-001`, `CTR-SA-002`, `CTR-SA-003`, `CTR-SA-005`): the composed
  production-runtime test captures the OAuth request body and proves exact wire scope
  `scheduler.manage-any`; it simultaneously preserves target-owned identity, absence of
  source Grant/credential propagation into execution, exactly-once/no-replay behavior, and
  linked job/occurrence/run/session/target/correlation/parent/terminal history truth.
- `ACC-SA-006` (`CTR-SA-006`): the exact new/focused tests and relevant scheduler and
  production-runtime suites pass under the repository-pinned Node runtime, and repository
  structure/governance checks pass.
- `ACC-SA-007` (`CTR-SA-007`, `CTR-SA-008`): governance review confirms the acyclic DAG,
  exact local/external pins, Owner acceptance gate, and zero Grant/credential/registry/
  database/deployment effects.
- `ACC-SA-008` (`CTR-SA-009`): migration review confirms no data migration; rollback review
  proves a four-file preimage restore and forbids alias/dual-scope fallback.

Acceptance of this Spec does not itself satisfy implementation, external auth, production,
or canary acceptance. Those events require their own exact-head and runtime evidence.

## 11. Alternatives and disposition

- Rename the local predicate to `scheduler.manage-any`: **rejected** because it needlessly
  changes accepted Agent Core policy vocabulary and user-visible semantics.
- Request `scheduler.manage:any` from auth-service: **rejected** because the pinned exact
  grammar forbids colon.
- Add translation, dual spelling, or fallback: **rejected** because it creates ambiguous
  authority and can turn denial into unintended success.
- Register `scheduler.admin`: **rejected** because it is broader and is not the accepted
  local predicate.
- Mint `scheduler.read:self` / `scheduler.manage:self`: **rejected** because self access is
  intentionally local and must cause zero token requests.
- Change production composition product code: **rejected absent new evidence and authority**;
  current composition already transports the requested proof scope.

## 12. Migration, compatibility, and rollback

Compatibility is semantic, not string-identical across the trust boundary: callers and local
policy continue to observe `scheduler.manage:any`; auth-service sees only
`scheduler.manage-any` for resource `scheduler`. No persisted records, schemas, APIs, jobs,
occurrences, runs, sessions, or history rows are migrated.

The authorized future order is: accept this exact Spec head; implement and verify the four
files; separately accept/implement/deploy the auth-service CCR; separately supply/apply the
Grant; separately authorize local activation; then prove production and canary behavior.
Every unmet step fails closed.

Local rollback restores the exact four-file preimage and therefore disables compatible
external proof; it does not authorize an alias. External registration rollback, Grant
revocation, and runtime rollback are separate Owner-controlled actions. A rollback MUST not
claim that local source restoration revoked an external Grant or changed auth-service state.

## 13. Open questions

None. `NORMATIVE_TBD = NONE`.

## Frozen proposal summary

```text
SPEC_ID = AGENT_CORE_SCHEDULER_AUTH_SCOPE_ALIGNMENT_V1
STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none
PARENT_SPEC_BLOB = b3cebc5d3bd64013d8b605311e2cc12cf52cab7f
PROPOSAL_BASE = 9e15808f336e7964f5059e871c32f25e6045e622
AUTH_SERVICE_PIN = 05fcf4074fe15d7f29ce1ef0f68767fbbebd54de
LOCAL_PREDICATE = scheduler.manage:any
AUTH_RESOURCE = scheduler
AUTH_WIRE_SCOPE = scheduler.manage-any
SELF_TOKEN_SCOPES = NONE
SCHEDULER_ADMIN = FORBIDDEN
ALIAS_TRANSLATION_FALLBACK = FORBIDDEN
FUTURE_IMPLEMENTATION_FILES = 4
CURRENT_ROUND_PRODUCT_CHANGE = NONE
CURRENT_ROUND_GRANT_CREDENTIAL_REGISTRY_DATABASE_DEPLOY = NONE
NORMATIVE_TBD = NONE
```
