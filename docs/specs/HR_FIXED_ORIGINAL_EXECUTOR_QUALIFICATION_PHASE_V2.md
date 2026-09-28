---
spec_id: HR_FIXED_ORIGINAL_EXECUTOR_QUALIFICATION_PHASE_V2
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
owners: [mayf3]
governed_by: [HR_FIXED_CAUSAL_QUALIFICATION_EVENT_SEAM_V2, HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V2, HR_FIXED_S256_MAINTENANCE_INSTALLATION_V1, HR_CTO_OWNER_SENDER_EXACT_READ_AMENDMENT_V1]
external_authorities: []
supersedes: [HR_FIXED_ORIGINAL_EXECUTOR_QUALIFICATION_PHASE_V1]
superseded_by: null
scope: [original separate executor fixed qualification-only private startup phase with CTO and fixed admin turn eligibility]
---

# Original executor qualification phase — whole-authority successor proposal

This is a docs-first, whole-authority successor to accepted QF V1. It becomes
effective only together with proposed
`HR_FIXED_CAUSAL_QUALIFICATION_EVENT_SEAM_V2` (QE2), after independent review,
attributable Owner acceptance and one applicable canonical lifecycle. Until
then QF V1, QE V1 and the CTO-specific OCB child amendment remain accepted;
this proposal authorizes no implementation, deployment, root/host action,
protected read, restart, message, receipt seal or HR recovery. The atomic
lifecycle will mark both accepted QF V1 and QE V1 `superseded_by` their V2
successors, update their governing index links, and leave their contract bodies
and historical acceptance records intact. OCB V1 remains a CTO-branch child;
its seed, exact sender readback and OCB-C06 apply only when the original CTO
branch is selected. OCB does not select, constrain or supply evidence for the
new fixed admin branch.

## DEVELOPMENT_PREFLIGHT

`BASE_HEAD=861235491cdb216b12346181d26616f383ab4fd0` for proposal authoring;
`GOAL` is to permit QE2's one fixed CTO-free qualification turn source without
weakening the original CTO procedure. `CURRENT_GAP` is accepted QF V1 C01/C03/C04:
they require attributable Owner-delivered proof turns and forbid automatic
sending unconditionally. `AUTHORITY_ACTION=SUPERSEDE`, `PLAN_LEVEL=BRIEF`,
`ASSURANCE_LEVEL=CONTROLLED`, `ROUTE_STAGE=AUTHORITY_AUTHORING`,
`SPEC_GAP_DEPENDENCY=LOAD_BEARING`, `IMPLEMENTATION_ALLOWED=NO`,
`OPERATION_ALLOWED=NO`, `NEXT_ACTION=REVIEW`. QF V1's accepted source and
prior synthetic tests cannot grant this new private Router ingress trust.

## Contracts

**QF2-C01 — Two closed eligibility branches, one original executor.** The same
original separate Deployment Agent proof executor, authenticated by its
sealed fixed root entry and genuinely held kernel namespace/OFD custody,
owns one trusted deployment and the original OWNER_RUNBOOK §①/§② proof
procedure for the exact final consuming whole-app binary. It chooses one
reviewed branch before the first qualification startup and cannot mix turns,
identities or receipts between branches:

- **CTO branch unchanged:** accepted QF V1 C01–C05, QE V1 QE-C01 and CTO-only
  OCB-C01–C06 retain their exact Owner-authored seed, sender binding, three
  later attributable CTO deliveries, native/Broker completion, two owned
  restarts, receipt ordering and UNKNOWN semantics. No CTO evidence may be
  replaced by a fabricated canary or passive other-Agent event.
- **Fixed admin branch:** QE2-C02/C03 supplies either three actual tool-free
  native canary completions for package-pinned `agt_efficiency-agent`, one
  per owned startup phase across the same two controlled restarts, or three
  naturally occurring authenticated completed turns of that same fixed Agent.
  Its private fixed canary ingress is a **new trust boundary**: exact root
  FD/nonce/package/host/phase/same-binary authentication, one-use Router
  admission, enforced empty tool/Broker/outbound capability, real durable
  issuance and native terminal/result readback. No Owner/CTO message ID,
  sender hash, driver impersonation, public `deliver`, caller prompt or
  manually supplied turn is eligible. Passive evidence is an alternate,
  never a required traffic wait for the fixed canary path.

Both branches prove unchanged whole-app identity from trusted deployment
through two owned restarts, three real completed turns, strict generation and
max-issued monotonicity/no overlap, valid durable store/floor, and new-kind
validator installation from that deployment before any HR producer. Only the
same original executor's directly owned observations may seal unchanged
floor4/validator3 receipts under QE2; old or mixed-branch proof cannot.

**QF2-C02 — Fixed qualification-only startup.** QF V1 C02's pre-Router-import
private context, exact package, root-held namespace/OFD/owned child and
phase/binary validation remain mandatory for either branch. The admin branch
may use the additional QE2-C02 private canary turn callsite only after those
checks and existing global durable-store readiness, mint-capacity and fixed
Agent fence checks. A root UID/thread label, environment flag, generic DS
request, caller-selected context, old HR startup authorization or credential
change cannot admit it. Ordinary/manual startup remains rejected.

**QF2-C03 — No HR recovery or uncontrolled send.** Neither branch consumes an
HR bundle, settles/replays s256, clears a fence, consumes the HR one-use ID or
proves business admission. The CTO branch continues to require three
legitimate attributable Owner Feishu deliveries and actual native/Broker
completion; OCB-C06 remains CTO-only and its seed is never a proof turn. In
the admin branch the original executor may initiate only QE2-C02's exact
fixed, tool-free native canary over the authenticated private owned-child
capability. That call is not Feishu sending, Owner impersonation, generic
agent messaging, old-turn replay, or a public DS/Router action. If its
effect-denial or same-child readback cannot be enforced, no canary or receipt
is eligible. Normal Router admission policy, validator and recovery fences
remain effective in both branches.

**QF2-C04 — Owned completion and receipt boundary.** The original executor
directly observes actual trusted deployment, two controlled restarts, the
three branch-specific terminal turns, store/generation issuance, required
health, validator-before-producer and continuous exact whole-app identity.
The fixed canary must yield a real native prompt receipt ID, reconciled
terminal handle/reply, no tool/Broker/outbound effect, and phase/child/nonce
binding; generic inbox `accepted`, model text, caller PASS, a zero-call claim
or source-byte match cannot qualify. The original CTO branch retains its
Owner delivery/native reply predicate. Only then may the unchanged closed
floor4/validator3 receipts be sealed once with actual observed times through
the existing four-input chain. No new protected output, public receipt field,
vocabulary, credential or actor is created.

**QF2-C05 — UNKNOWN, disposition and ordinary-Agent availability.** Missing,
ambiguous, late, changed or unbound event; invalid global store; fenced fixed
Agent; lost tool-denial or root/child custody; changed binary; or incomplete
native/Owner completion is sticky UNKNOWN/no seal/no automatic retry. Keep
actual known child/state and safe custody; timeout never authorizes release.
The original reviewed owned child disposition must finish before seal.
Controlled proof restarts temporarily interrupt ordinary Agents sharing the
Runtime, so current app/routes, compatible rollback and safe service
restoration must be bound before each effect. Qualification success does not
authorize an HR cut: unchanged R2/MI proof-before-stop, separate host facts,
one private HR startup and later H4–H6 remain necessary.

## Focused acceptance

| Case | Required confined evidence | Reject when |
|---|---|---|
| QF2-A01 | Existing CTO fixture preserves QF V1/OCB seed, three Owner deliveries, native/Broker completion and receipt bytes | CTO branch admits canary/passive event, or admin branch demands CTO ID/sender |
| QF2-A02 | Actual-module root entry → gated same-child context → one-use fixed canary ingress → native durable terminal readback in three phases/two restarts | wrong peer/FD/nonce/package/host/phase/Agent/binary, inbox-only acceptance, duplicate handle or wrong child |
| QF2-A03 | Enforced empty turn-scoped tool registry plus Broker/shell/Feishu/alternate-route denial before prompt write | any capability available or attempted, prompt-only prohibition, post-hoc zero-call assertion |
| QF2-A04 | Existing global store, mint and fixed-Agent fence checks; protected descriptor readback, original owned final-child disposition | invalid store/fence, missing/late reply, lost custody, wrong issuance or early seal |
| QF2-A05 | Branch selection, unchanged floor4/validator3/four-output join, R2/MI proof-before-stop and compatible ordinary-Agent rollback | mixed branches, fabricated event, qualification credited as H2–H6 or HR business recovery |

All tests are nonproduction mechanics only. The current generic Router
`deliver` returns on inbox admission; the current production child profile
exposes Broker/memory/switch capabilities and no private fixed canary ingress
exists. These are concrete implementation gaps for subsequent accepted-scope
nonproduction work, not reasons to treat this proposal as installed or to
run a host procedure. A final executable package still needs exact reviewed
entry/deployment/selector pins, current final binary, rollback, authentic
floor/validator proof, controlled operation authority and host readback.
