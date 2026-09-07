---
spec_id: AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V1
status: superseded
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: conditional_controlled_operation
scope:
  - mayf3/dsh-agent-core
  - exact Principal to enabled Agent read capability
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
  - AGENT_CORE_AGENT_SESSION_MESSAGING_V1
external_authorities:
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1
    revision: b5eef6cdf00aa9ebb581f6a18adbae8d975f9f26
    relation: depends_on
supersedes: []
superseded_by: AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2
accepted_date: 2026-09-05
accepted_by: mayf3
accepted_reviewed_spec_commit: f3b11d78f4e38aa9f60caa0d9b3c5ce7dc6abfa2
acceptance_review_verdict: PASS
superseded_note: >-
  Superseded 2026-09-05 by AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2
  (whole-Spec subject successor: canary/proof subject bc970ced…/hr-agent ->
  dc702687…/agt_hr-agent per Owner fresh identity fact). Its subject-generic
  resolution and exact-ID admission contracts remain in force verbatim through
  V2; the legacy Principal is no longer a valid business assignee/canary
  subject (its agent_id grammar already fails closed downstream).
acceptance_authority_basis: >-
  Owner BATCHED EXACT-HEAD ACCEPTANCE = YES on 2026-09-05 for the three
  HR_DISPATCH_DELIVERY_READINESS_V1 authority candidates, binding this Spec at
  reviewed semantic head f3b11d78f4e38aa9f60caa0d9b3c5ce7dc6abfa2 after one
  independent first review (ACCEPT, BLOCKERS = 0, MERGE_READY = YES,
  UPSTREAM_PIN_CONSISTENCY = PASS one-for-one; review record 2f6fd7e). The
  external_authorities revision pin is updated 0359575dd… -> b5eef6cdf… (the
  accepted Auth acceptance-transaction revision, reachable from auth main
  bb5b6f2) exactly as this Spec's section 1 requires and the review FOLLOW_UP
  directs; the pinned Auth contracts are byte-identical between the two
  revisions, so there is no semantic movement and no re-preflight is triggered.
  The reviewed normative body is otherwise preserved byte-for-byte. The review
  SPEC_GAP (credential_missing vs credential_unavailable naming) and
  TOOLING_DEBT (500-line legacy-file ceiling) stay implementation-preflight
  obligations, not shipping blockers.
owners:
  - mayf3
---

# AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V1

## 1. Goal, mandate and route

Given one exact Workflow assignee AGENT Principal UUID, HR obtains the canonical
enabled Agent ID and can pass it to existing `agent_session_send`. This read does
not dispatch work, create a Session or deliver a message.

```
MASTER_GOAL = HR_DISPATCH_DELIVERY_READINESS_V1
BASE = 1912d582888455a049838f376759b62f295b341b
AUTHORITY_ACTION = NEW
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCTION_APPLY_ALLOWED_NOW = NO
```

The 2026-09-05 Owner attachment mandates preparation of this minimum candidate,
not acceptance of Product Authority. Exact independent review and Owner acceptance
plus merge in each owning repo must precede implementation. The Auth dependency
is proposed; its presence here never represents accepted authority or live readiness.
Implementation must pin the final accepted Auth revision preserving these Contracts;
semantic movement requires re-preflight and independent review before acceptance.

## 2. Ownership, scope and non-goals

Auth alone owns Principal UUID -> canonical agent_id/type/status. Agent Definition
alone owns exact Agent ID existence and enabled state. The Broker owns trusted
caller credentials. Router alone owns target main Session and admission. No new
identity database, name map, dispatcher, agent_wake, scheduler work delivery,
Session per message, identity federation, lifecycle administration, target token,
credential impersonation or automatic ping-pong. No full autonomous Workflow E2E.

At BASE the accepted provisioning Spec Part C explicitly separates agentId,
clientId and Principal UUID, and freezes Auth as the binding authority
(:636-637, :662-674). The accepted ASM R2 already requires targetAgentId rather
than display name. This new child owns a bounded read tool and its target result
validation. An exact-ID check for the ASM path is a minimal conformance repair
of that existing routing-target obligation; no changes to its three-field schema,
authorization, receipt, exactly-once, main Session or no-replay Contracts.
Existing general UI/name navigation `resolveAgentRef` behavior remains unchanged.

## 3. Source observations and evidence

### OBS-EPAR-001

At BASE, read 2026-09-05: packages/agent-credential-provisioning/src/index.js:177-185
supplies exact Agent Definition ID to Auth principal ensure. No reverse Principal
resolver exists among packages source; broker identity.js is caller identity, not
a target resolver. Environment source-only, method bounded rg and exact file read.

### OBS-EPAR-002

At BASE definition.js:330-338 `getAgent` is exact but returns disabled records;
:376-390 `resolveAgentRef` falls back to display names. Duplicate ID config is
rejected at :213. Router ingress-delivery.js:280 starts with resolveAgentRef.
Therefore a previously resolved ID deleted before send could match another Agent's
display name. This is an identity wrong-target SHIP_BLOCKER family, not an
observation of actual wrong delivery. No production canary has run in this census.

### CLM-EPAR-001 / EVD-EPAR-001 / STATE-EPAR-001

SUPPORTED: existing identity truth is reusable, but new read exposure and exact
ID admission are required. OBS-EPAR-001/002 SUPPORT the claim at BASE. Exact source
paths and `git show BASE:path` reproduce the evidence. Sufficient for source gap,
not proof of runtime config, HR Grant, production health, or terminal readiness.

## 4. Decisions

DEC-EPAR-001 (proposed owner mayf3): compose the two existing authorities; no cache
or copied mapping table. DEC-EPAR-002: use a distinct read tool and independently
scoped Auth caller permission. DEC-EPAR-003: enforce exact identity at both read
result and final A2A admission; an earlier read is an observation, not a lease.
DEC-EPAR-004: preserve target/source credential separation and existing send schema.

## 5. Contracts

### CTR-EPAR-001 — Model surface and trusted caller

Expose exactly `agent_resolve_principal` with arguments object containing only
required string `principalId`, no unknown fields. Validate UUID syntax as Auth's
CTR-EAPR-002; no trimming, guessing, name lookup, supplied origin, credential,
source Agent/Principal/client ID, grant, headers, Session, operation override or
identity assertion. This target Principal parameter MUST NEVER select caller
credentials, source identity or audit actor. Runtime derives caller from actual
process identity using existing parent RPC and Broker trusted credential seam.

The tool is read-only and performs no Agent creation, Session mutation, run admission,
Workflow transition, scheduler job, message send or automatic subsequent action.
Success result is exactly `{"principalId":"<canonical UUID>","agentId":"<exact ID>"}`
inside the normal Broker result envelope; no private metadata or credentials.

### CTR-EPAR-002 — Fixed Auth request and authorization

Call only trusted configured Auth service origin and fixed path
`GET /api/v1/agent-principals/<validated UUID>/agent`. Origin must satisfy existing
service-origin authority, is pinned by deployment configuration, and cannot be
changed by model args or response. Redirects are rejected; never send credentials
to an alternate origin. Use existing Broker trusted credential acquisition and V1
direct-machine issuance for actual caller, exact audience `agent-principal-resolution`
and only scope `auth.agent.resolve`. Tokens remain in trusted parent transport;
no token, secret, target credential or provisioning credential reaches child/model.

The composed trusted provider must use the fixed Auth transport and then exact
local Agent Definition validation before producing a success envelope. A public
Auth response alone must not bypass local validation. Reuse existing transport
and parent execute-time provider mechanisms; do not add a second credential store
or pass authorization supplied by the tool. No implicit permission from send,
scheduler/admin or provisioning. Do not automatically retry the Auth read or
create a background resolver; fail with the original known/unknown read failure.

### CTR-EPAR-003 — Closed Auth response and canonical Agent validation

Require exactly the two documented fields, matching canonical requested UUID,
and string agentId. Error HTTP responses cannot be treated as success. Require
agentId to satisfy existing ASM target grammar `^agt_[a-z0-9-]+$`, 5..128 chars,
without rewriting the stored value. Read current authoritative Agent Definition,
using exact ID equality only (`getAgent`, plus explicit disabled check or equivalent).
Missing ID, duplicate/corrupt registry, disabled Agent or Auth-ID mismatch fails closed.
Do not use `resolveAgentRef` or display-name fallback; do not infer from prompt,
workspace, credential-store keys, legacy User records or external-ref strings.
No persisted or success-result cache may substitute for fresh Auth and Definition reads.

### CTR-EPAR-004 — Read failure semantics

Reject malformed args with `invalid_arguments` before transport. Preserve existing
Broker `credential_missing`, `credential_invalid`, `access_denied`, and
`transport_failure` responsibilities. Map Auth target errors to stable lower-case
codes: `principal_not_found`, `principal_not_agent`, `principal_disabled`,
`agent_mapping_missing`, `identity_resolution_ambiguous`; 500/504 and malformed
response are `identity_resolution_unavailable`, never missing/success.
Local missing exact ID -> `target_not_found`; disabled -> `target_disabled`;
registry corruption/duplicate -> `identity_resolution_ambiguous`.
Auth/transport uses a bounded operation deadline at most 5 seconds plus bounded
transport overhead; no indefinite wait or automatic repair. No secret-bearing
upstream body/log is returned. All failures have zero send/admission/target writes.

### CTR-EPAR-005 — Exact admission and state changes

A read success is time-indexed and is not a reservation. HR passes its returned
agentId to unchanged `agent_session_send`; that call independently checks existing
send authorization. The trusted A2A Router path must resolve the supplied target
by exact Agent Definition ID at admission, never by a display name. The resolved
record ID must equal the requested target ID; missing/disabled/corrupt records fail
before any prompt byte, Session creation or run admission under existing ASM errors.
This exact check applies to A2A message-origin delivery, not general display-name UI
navigation. Use one coherent validated Definition snapshot per admission; do not
check ID then later re-resolve through a name fallback after an await.

Deletion, disabling, or rename between read and send cannot choose a different
Agent: deletion fails target_not_found, disabled fails target_disabled, display name
rename with same exact ID still selects that ID. A display name equal to an absent
or disabled canonical ID must not rescue it. A registry refresh during admission
must either use the coherently captured exact enabled record under existing lifecycle
serialization, or revalidate exact ID and enabled state before target side effects.
No new identity lease, mapping database, message field, or Principal-bearing send
schema is introduced. A later Auth Principal disable invalidates subsequent reads;
the read does not promise atomic cross-service revocation between resolution and
send. Existing target credential/Principal checks and Agent lifecycle remain
independent, and no stale read permits routing to a different Agent.

### CTR-EPAR-006 — Implementation and tests boundary

Allowed closure is a focused capability manifest/schema, trusted composed read
provider, fixed Auth transport wiring, minimal registry/execute-time provider
wiring, exact-ID guard on existing A2A Router ingress, and focused tests. Reuse
Agent Definition, Broker credential provider and ASM delivery. No ASM core rewrite,
scheduler changes, schema/storage migration or broad refactor. Keep capability
data out of over-limit legacy files; existing structure verifier must pass.
A runtime grant capability being visible is not evidence of authorization success.

### CTR-EPAR-007 — Integration, production and terminal proof

Implement only after both Specs are accepted in relevant bases. Prepare exact
source closure, tests, independent review, and reviewed controlled runbook with
fresh target preimage, minimal apply, readback, health, durable receipt and rollback.
Deploy only this audited closure. HR read Grant is governed by the Auth child;
HR send Grant by Lane A, with neither implying the other.

Mutation concurrency is one. Production remains on hold until fresh evidence
establishes VISIT_ACTIVATION_PRODUCTION_READY=YES,
DISPATCH_INTENT_BROKER_PRODUCTION_READY=YES and PRODUCTION_RUNTIME_LOCK=IDLE.
For privileged access use native Owner authorization where required. Before real
canary, prove A and B production ready, exact HR Principal
bc970ced-710f-4479-9ff0-e295a1c59424 binding, and exact enabled authorized target
mechanically. One harmless disposable canary may then perform resolution -> HR
send -> canonical main. No real private content, target auto-reply task, Workflow
transition or scheduler mutation. Prove accepted/replied, delivery_count=1,
new_target_run_count=1, canonical main, no source credential propagation/ping-pong,
unchanged unrelated grants/workflow, healthy runtime and ASM/scheduler regression.
Persist exact refs, grants, request/correlation identity, target, receipt and
rollback boundary. HR_DISPATCH_DELIVERY_PRODUCTION_READY=YES only when Lane A+B+C
all terminal, then stop; full Workflow E2E belongs to next Goal.
Rollback disables/removes new exposure and restores exact deployed preimage; never
reintroduce a known wrong-target A2A route as active traffic. If the baseline lacks
the exact-ID guard, contain the affected A2A ingress until a safe accepted closure
is restored. Keep durable sanitized failure receipt and report no readiness.

## 6. Acceptance

All rows require executed evidence bound to authority and implementation heads,
command, environment, timestamp and outcome; tests alone do not prove deployment.

| Acceptance | Contracts | Method / environment | Expected result / failure condition |
|---|---|---|---|
| ACC-EPAR-001 | CTR-EPAR-001 | manifest/direct-parent/schema tests, isolated | only UUID target allowed; spoofed caller/headers/origin rejected; zero target writes |
| ACC-EPAR-002 | CTR-EPAR-002 | real trusted gateway/provider with local RS256 Auth fixtures, isolated | actual caller token and exact audience/scope/origin/path; wrong caller grant denied; redirect refused; no secret/target credentials or retries |
| ACC-EPAR-003 | CTR-EPAR-003/004 | table-driven composed Auth+Definition tests, isolated | exact success; reject wrong UUID, extra response fields, wrong type/missing/disabled/duplicate target, invalid syntax, name collisions, timeout/DB error; no empty-success fallback |
| ACC-EPAR-004 | CTR-EPAR-005 | composed read then mutate fixture Definition before/during send, isolated | deleted ID matching another display name sends zero; disabled-ID name collision sends zero; same-ID rename remains exact; refresh interleaving cannot reroute; one valid send uses main |
| ACC-EPAR-005 | CTR-EPAR-006 | exact diff, focused tests, existing ASM/scheduler tests + structure verifier | bounded closure, unchanged send schema/receipt/no-replay, no new truth/store/refactor; failure blocks implementation acceptance |
| ACC-EPAR-006 | CTR-EPAR-007 | premutation/rollback rehearsal then independent target readback and one authorized canary | lock hold enforced; no readiness without required receipt/counts/health; target proof+grant delta minimal; rollback preserves exact preimage or contains unsafe ingress |

Coverage: CTR-EPAR-001..007 all covered; 7/7. Required production record includes
independent target-bound readback and actual one-canary receipt. No test, receipt
or production success is claimed by this proposal.

## 7. Alternatives and closure

ALT-EPAR-001 rejected: expose provisioning/admin to HR; excessive authority.
ALT-EPAR-002 rejected: name/substring/prompt/manual mapping; wrong identity risk.
ALT-EPAR-003 rejected: trust an earlier resolver result then allow name fallback
at admission; TOCTOU counterexample OBS-EPAR-002. ALT-EPAR-004 rejected: add Principal
to send or build a dispatcher; current three-field ASM suffices with exact ID.
A newly found accepted exact UUID read contract may reopen reuse before acceptance;
no such contract was found at pinned bases.

```
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
AUTHORING_DONE_WHEN = independent exact-head review ready
IMPLEMENTATION_READY = NO
PRODUCTION_READY = NO
```
