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

### STATE-SA-001 — Scheduler reuses the local predicate at the proof seam
- Subject: Scheduler self-service cross-agent authorization proof.
- As of commit or artifact revision: dsh-agent-core `9e15808f336e7964f5059e871c32f25e6045e622`, source blob `4a236fed3b201ac8c4de59d86cbbc414beee4ba7`.
- Environment: isolated source worktree; no runtime or production process.
- Observed at: `2026-09-02T21:23:05Z`.
- State assertion: `MANAGE_ANY_SCOPE = 'scheduler.manage:any'` is passed directly to `assertGrant` with resource `scheduler`.
- Basis: `OBS-SA-002`.

### STATE-SA-002 — Focused tests expect the colon form at the external seam
- Subject: Scheduler unit/cross-agent tests and composed production-runtime history test.
- As of commit or artifact revision: dsh-agent-core `9e15808f336e7964f5059e871c32f25e6045e622`; test blobs listed in `OBS-SA-003`.
- Environment: isolated source worktree; tests inspected but not executed for this descriptive State.
- Observed at: `2026-09-02T21:23:05Z`.
- State assertion: focused tests expect `scheduler.manage:any` in the proof seam, including the composed OAuth token request body.
- Basis: `OBS-SA-003`.

### STATE-SA-003 — Accepted local policy uses colon-form predicates
- Subject: accepted `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1` authorization boundary.
- As of commit or artifact revision: parent blob `b3cebc5d3bd64013d8b605311e2cc12cf52cab7f`.
- Environment: dsh-agent-core repository object database at proposal base.
- Observed at: `2026-09-02T21:23:05Z`.
- State assertion: `scheduler.manage:any` is the local cross-agent predicate; `scheduler.read:self` and `scheduler.manage:self` are local outcomes, not token scopes.
- Basis: `OBS-SA-001`.

### STATE-SA-004 — Current local proof value is incompatible with external grammar
- Subject: the exact Scheduler proof input evaluated against auth-service scope grammar.
- As of commit or artifact revision: dsh-agent-core `9e15808f336e7964f5059e871c32f25e6045e622` and auth-service `05fcf4074fe15d7f29ce1ef0f68767fbbebd54de`.
- Environment: isolated read-only source worktrees; no auth-service or production mutation.
- Observed at: `2026-09-02T21:23:05Z`.
- State assertion: `scheduler.manage:any` fails the pinned scope grammar, while `scheduler.manage-any` satisfies it.
- Basis: `OBS-SA-002`, `OBS-SA-004`, `CLM-SA-001`.

## 5. Observations

### OBS-SA-001 — Parent authority preserves local colon-form predicates
- Subject: `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1`, especially `CTR-AUTH-001` and `CTR-AUTH-002`.
- Source revision: dsh-agent-core proposal base `9e15808f336e7964f5059e871c32f25e6045e622`, parent blob `b3cebc5d3bd64013d8b605311e2cc12cf52cab7f`.
- Environment: local repository object database.
- Observed at: `2026-09-02T21:23:05Z`.
- Method: verify the file blob with `git rev-parse` and inspect the authorization Contracts.
- Result: the parent names `scheduler.manage:any` locally and says both `*:self` labels are local outcomes rather than token scopes.
- Provenance: `docs/specs/AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1.md` at the stated blob.

### OBS-SA-002 — Self-service passes the colon form to assertGrant
- Subject: `packages/scheduler/src/self-service.js` cross-agent proof path.
- Source revision: blob `4a236fed3b201ac8c4de59d86cbbc414beee4ba7` at dsh-agent-core `9e15808f336e7964f5059e871c32f25e6045e622`.
- Environment: isolated dsh-agent-core source worktree.
- Observed at: `2026-09-02T21:23:05Z`.
- Method: inspect constant definitions and the `adminAuthorized` `assertGrant` call.
- Result: one colon-form string, `scheduler.manage:any`, serves as local vocabulary and the external scope argument; resource is `scheduler`.
- Provenance: exact-base source file and repository object named above.

### OBS-SA-003 — Focused tests assert colon-form external proof input
- Subject: the two Scheduler proof test files and composed production-runtime history test.
- Source revision: blobs `b48b58e02d997393cdd99aac94a8a2aa500b1429`, `b5bba97fcee963cffd5e7fbc893e9660922f8a60`, and `b1acd3d82b885944ef66ea722eba3ae2652f2414` at dsh-agent-core `9e15808f336e7964f5059e871c32f25e6045e622`.
- Environment: isolated dsh-agent-core source worktree; no test execution.
- Observed at: `2026-09-02T21:23:05Z`.
- Method: inspect proof-seam assertions and the composed OAuth request-body assertion.
- Result: all three test surfaces expect `scheduler.manage:any` at the external seam.
- Provenance: `packages/scheduler/test/self-service.test.js`, `packages/scheduler/test/cross-agent.test.js`, and `packages/production-runtime/test/compose-cross-agent-history.test.js` at the stated blobs.

### OBS-SA-004 — Auth-service grammar rejects colon and admits hyphen
- Subject: auth-service V1 OAuth scope parser and minimal-auth V1 contract manifest incorporated by the V2 authority.
- Source revision: auth-service `05fcf4074fe15d7f29ce1ef0f68767fbbebd54de`; source blob `f97ddf417f367a9e87d1a271d566b1807c12a84d`, manifest blob `983719d905f9609f6662b71ffb303a817ea292db`.
- Environment: isolated auth-service read-only source worktree; no service or data mutation.
- Observed at: `2026-09-02T21:23:05Z`.
- Method: inspect parser line 3 and manifest `scope_wire_format.item_pattern`, then evaluate the two exact literals against `^[a-z][a-z0-9-]*\.[a-z][a-z0-9._-]*$`.
- Result: `scheduler.manage:any` does not match; `scheduler.manage-any` matches with namespace `scheduler`.
- Provenance: `src/lib/oauth/v1/scope.ts` and `contract-bundles/minimal-auth-v1/contract-manifest.json` at the stated revision/blobs.

### OBS-SA-005 — Production composition forwards the requested scope
- Subject: production-runtime self-service Scheduler authorization composition.
- Source revision: `packages/production-runtime/src/compose.js` blob `c407b064fe846446888109bcc219514a7d15b094` at dsh-agent-core `9e15808f336e7964f5059e871c32f25e6045e622`.
- Environment: isolated dsh-agent-core source worktree; no runtime execution.
- Observed at: `2026-09-02T21:23:05Z`.
- Method: inspect the composed `assertGrant` transport from Scheduler access to auth request.
- Result: composition forwards its requested scope and does not hard-code a Scheduler scope.
- Provenance: exact-base composition source file and repository object named above.

## 6. Claims and assumptions

### CLM-SA-001 — A distinct wire scope resolves the observed grammar mismatch
- Support state: SUPPORTED.
- Supported by evidence: `EVD-SA-001`, `EVD-SA-002`.
- Contradicted by evidence: none known.
- Uncertainty: source evidence proves compatibility at the two pinned revisions; future revisions require re-verification.

### CLM-SA-002 — Exact external proof can establish only the existing local predicate
- Support state: SUPPORTED.
- Supported by evidence: `EVD-SA-003`.
- Contradicted by evidence: none known.
- Uncertainty: this is a bounded policy mapping; actual authorization remains unproved until future implementation tests and separately authorized external/runtime evidence pass.

### CLM-SA-003 — Production composition product code needs no alignment change
- Support state: SUPPORTED.
- Supported by evidence: `EVD-SA-004`.
- Contradicted by evidence: none known.
- Uncertainty: source inspection covers exact base only. If implementation evidence contradicts this Claim, work MUST stop for new or amended authority rather than expand the four-file closure.

No normative Contract depends on an unresolved assumption.

## 7. Evidence relations

### EVD-SA-001 — Local authority and source support predicate/wire separation
- Source observations: `OBS-SA-001`, `OBS-SA-002`.
- Target: `CLM-SA-001`.
- Relation: SUPPORTS.
- Bound coordinates: dsh-agent-core `9e15808f336e7964f5059e871c32f25e6045e622`, parent/source blobs stated above, observed `2026-09-02T21:23:05Z`.
- Strength/sufficiency: strong for intentional local naming and current external reuse; sufficient only together with `EVD-SA-002`.
- Limitations: does not prove external grammar behavior or runtime success.
- Provenance: exact repository objects in `OBS-SA-001` and `OBS-SA-002`.

### EVD-SA-002 — External grammar supports the hyphen-form wire value
- Source observations: `OBS-SA-004`.
- Target: `CLM-SA-001`.
- Relation: SUPPORTS.
- Bound coordinates: auth-service `05fcf4074fe15d7f29ce1ef0f68767fbbebd54de`,
  source/manifest blobs stated above, observed `2026-09-02T21:23:05Z`.
- Strength/sufficiency: strong for exact admission/rejection at the pinned revision; with
  `EVD-SA-001`, sufficient for the alignment Claim.
- Limitations: does not prove audience registration, Grant existence, deployment, or runtime
  authorization.
- Provenance: exact auth-service repository objects in `OBS-SA-004`.

### EVD-SA-003 — Parent policy and grammar support the one-to-one proof mapping
- Source observations: `OBS-SA-001`, `OBS-SA-004`.
- Target: `CLM-SA-002`.
- Relation: SUPPORTS.
- Bound coordinates: parent blob `b3cebc5d3bd64013d8b605311e2cc12cf52cab7f`,
  auth-service `05fcf4074fe15d7f29ce1ef0f68767fbbebd54de`, observed
  `2026-09-02T21:23:05Z`.
- Strength/sufficiency: strong and sufficient for the bounded policy mapping, but not runtime
  conformance.
- Limitations: supports no alias, `scheduler.admin`, self token scope, Grant, or activation.
- Provenance: exact objects and methods in `OBS-SA-001` and `OBS-SA-004`.

### EVD-SA-004 — Scope forwarding supports a test-only runtime-test change
- Source observations: `OBS-SA-003`, `OBS-SA-005`.
- Target: `CLM-SA-003`.
- Relation: SUPPORTS.
- Bound coordinates: dsh-agent-core `9e15808f336e7964f5059e871c32f25e6045e622`,
  test/composition blobs stated above, observed `2026-09-02T21:23:05Z`.
- Strength/sufficiency: strong for the exact-base composition shape and sufficient to bound
  the planned production-runtime edit to the focused test.
- Limitations: source inspection does not replace future executed regression evidence; a
  contradictory implementation result forces governance STOP.
- Provenance: exact repository objects in `OBS-SA-003` and `OBS-SA-005`.

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

### ACC-SA-001 — Exact proof tuple and stable local vocabulary
- Contracts: `CTR-SA-001`, `CTR-SA-002`, `CTR-SA-005`.
- Method: focused source inspection plus unit test of one authorized cross-agent operation.
- Environment: isolated implementation worktree at the future accepted implementation head.
- Required evidence: exact diff, executed test command/result, captured `assertGrant` arguments, and returned local denial/policy labels.
- Expected result: one call uses scope `scheduler.manage-any` and resource `scheduler`; local vocabulary remains `scheduler.manage:any`.
- Failure condition: wrong tuple/call count, a colon-form wire request, or any local predicate/label rename.

### ACC-SA-002 — Exact success and fail-closed negative matrix
- Contracts: `CTR-SA-002`, `CTR-SA-003`.
- Method: table-driven unit tests with an exact-success stub and colon/alias/admin/denial/error/malformed/unavailable cases.
- Environment: isolated Scheduler test process with no production service, Grant, or credential.
- Required evidence: executed matrix results, proof-call ledger, and target store read/mutation ledger.
- Expected result: only exact verified success authorizes; every negative case denies with one or zero calls as applicable, no alternate request, and no target access/mutation.
- Failure condition: any negative authorizes, any fallback/second spelling occurs, or the target is read or mutated.

### ACC-SA-003 — Self access makes no external proof request
- Contracts: `CTR-SA-004`.
- Method: self read and self mutation unit tests with an assert-fail-if-called proof stub.
- Environment: isolated Scheduler test process using caller-owned fixture data.
- Required evidence: executed test results, successful self-operation results, and zero-call proof ledger.
- Expected result: self operations succeed under local ownership with zero `assertGrant` or token requests.
- Failure condition: any external proof request, including either `*:self` label or a substitute.

### ACC-SA-004 — Stable semantics and exact four-file closure
- Contracts: `CTR-SA-005`, `CTR-SA-006`.
- Method: focused Scheduler regression tests plus exact accepted-base-to-head diff inspection.
- Environment: isolated implementation worktree; no production process.
- Required evidence: executed results and name-status/stat diff covering the complete implementation candidate.
- Expected result: ownership/results remain unchanged; only the four named files change and production composition source is untouched.
- Failure condition: semantic drift, a fifth file, or any production-runtime product-code change.

### ACC-SA-005 — Composed exact wire proof and preserved HistoryStore truth
- Contracts: `CTR-SA-001`, `CTR-SA-002`, `CTR-SA-003`, `CTR-SA-005`.
- Method: composed production-runtime cross-agent test with local OAuth capture and credential-propagation rejection seams.
- Environment: isolated test process with disposable stores and no production network/service.
- Required evidence: executed result, captured OAuth body, proof call count, execution payload inspection, and HistoryStore queries.
- Expected result: body scope is `scheduler.manage-any`; target identity, no source Grant/credential propagation, exactly once/no replay, and linked job/occurrence/run/session/target/correlation/parent/terminal truth all remain proved.
- Failure condition: wrong/alternate scope, leaked source authority material, replay, identity mismatch, or broken/missing history linkage.

### ACC-SA-006 — Focused suites and repository gates
- Contracts: `CTR-SA-006`.
- Method: run exact focused tests/relevant suites under the repository-pinned Node runtime, then structure/governance checks.
- Environment: isolated implementation worktree with proxy variables unset.
- Required evidence: exact commands, exit statuses, test totals, structure output, and governance output bound to exact base/head.
- Expected result: every command passes, changed-file closure is exact, and structure violations are zero.
- Failure condition: any failure, skipped required suite, unpinned runtime, scope drift, or new structure violation.

### ACC-SA-007 — Authority DAG and zero-production boundary
- Contracts: `CTR-SA-007`, `CTR-SA-008`.
- Method: independent exact-head Spec governance review and external/local authority-edge audit.
- Environment: docs-only candidate; read-only repository evidence; no production mutation.
- Required evidence: reviewed/final heads, parent/external pins, reviewer verdict, DAG audit, and zero-effect audit.
- Expected result: DAG is acyclic, future auth CCR depends downstream on this accepted final head, Owner gate remains explicit, and no Grant/credential/registry/database/deploy effect occurred.
- Failure condition: circular/missing authority, unbound review, premature authority claim, prohibited effect, or production authority other than `none`.

### ACC-SA-008 — Migration and rollback are bounded and alias-free
- Contracts: `CTR-SA-009`.
- Method: exact diff/preimage review and rollback procedure audit.
- Environment: isolated source/test candidate; no data migration or production rollback execution.
- Required evidence: four-file preimage identities, migration diff, rollback steps, and external-action separation checklist.
- Expected result: no data migration; rollback restores the four preimages without aliases/dual scope and does not claim external state changed.
- Failure condition: data/schema mutation, incomplete preimage, alias/fallback, or conflation with Grant/auth/runtime rollback.

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
