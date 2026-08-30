---
spec_id: AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2_HEMOSTASIS_COMPATIBILITY_AMENDMENT_V1
status: proposed
type: proposed narrow compatibility amendment (spec-only; docs-only)
amends: AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2
parent_status: accepted
supersedes_parent: false
date: 2026-08-31
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
scope:
  - bounded precedence carve-out on the shared global environment surface for AGENT_CORE_GLOBAL_ROUTE_HEMOSTASIS_V1 only
  - agt_cto-agent route identity, override, and credential-boundary preservation invariants under that carve-out only
governed_by:
  - AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2
  - AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - repository-maintainers
references:
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2.md
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2.md
  - docs/specs/AGENT_CORE_GLOBAL_ROUTE_HEMOSTASIS_V1.md
  - https://github.com/mayf3/dsh-agent-core/pull/120
---

# AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2 — Hemostasis Compatibility Amendment V1

> **PROPOSED / NOT ACCEPTED / DO NOT MERGE.** This is a docs-only, narrow
> compatibility amendment. It changes no production state, no code, no
> credential, and no route. It authorizes no implementation
> (`implementation_authority: none`). It becomes active only if independently
> reviewed, accepted at the exact head, and merged into `main`.

## 1. Goal

Close the authority conflict between:

- accepted `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2`, whose transaction
  boundary froze non-target and shared-global surfaces unchanged; and
- proposed `AGENT_CORE_GLOBAL_ROUTE_HEMOSTASIS_V1`, whose eventual global
  hemostasis flip must temporarily modify the shared global environment.

with an explicit, narrow precedence rule — not a prose claim that the two
authorities "do not conflict".

## 2. Scope and non-goals

In scope: the precedence relationship on exactly (i) the shared global
environment surface (global provider/model environment values and the
controlled shared-runtime restart) and (ii) the preserved invariants of
`agt_cto-agent` while any hemostasis transaction is live.

Out of scope: everything else. This amendment does not re-open any CTO route
decision, does not touch Luna, OAuth, PR #115/#117/#118, does not authorize any
production write, and does not modify the parent Spec file (the parent's bytes
are untouched; this amendment is a separate authority that refines the same
parent policy, `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2`).

## 3. Authority and dependencies

```text
AMENDMENT_RELATION = NARROW_PRECEDENCE_CARVE_OUT_ONLY
PARENT_SPEC = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2
PARENT_SPEC_STATUS = accepted
SUPERSEDES_PARENT_SPEC = NO
PARENT_SPEC_FILE_MODIFIED = NO
GOVERNING_COMPANION = AGENT_CORE_GLOBAL_ROUTE_HEMOSTASIS_V1 (proposed)
CTO_AUTHORITY_COMPATIBILITY = EXPLICITLY_CLOSED
REQUIRES_SUPERSESSION = NO
SUPERSESSION_REASON = governance V0 §9.2 supersedes whole authorities only;
  a hemostasis compatibility rule cannot fully replace the CTO activation
  authority, and the parent Spec cannot be edited in place under its immutable
  accepted Decision/Contract IDs. The lawful path (SPEC_GOVERNANCE_V0 §9.2
  alternative) is this new, non-conflicting, narrow-scope authority refining
  the same parent policy AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2.
```

### PRECEDENCE_RULE (frozen)

```text
(a) HISTORICAL BOUNDARY PRESERVED — the parent activation transaction's
    "global/non-target unchanged" clauses (CTR-V2-004 step 7 and its closing
    line: 不改 launchd、Definition、Binding、Scheduler job/store、global env、
    第二 Feishu consumer) remain the true historical execution boundary of
    THAT transaction. This amendment does not rewrite that history.

(b) CARVE-OUT, FULLY GATED — the shared global environment surface MAY be
    temporarily modified by the hemostasis program ONLY when ALL of the
    following are separately accepted and present in main:
      1. AGENT_CORE_GLOBAL_ROUTE_HEMOSTASIS_V1 (the Governing Spec);
      2. this compatibility amendment;
      3. every child authority required by that Spec's
         POST_ACCEPTANCE_DEPENDENCY_DAG for the action being taken;
    and only inside that program's audited transaction. Before those
    acceptances, the parent's unchanged-surface boundary continues to govern
    unmodified.

(c) CTO SELF-GOVERNANCE RETAINED — on any question of agt_cto-agent's own
    route, override, credential boundary, providerEnv, or Luna policy, the
    parent authority retains full precedence; the hemostasis Authority has
    zero authority over that Agent in any state.

(d) FAIL-CLOSED RESIDUE — on any surface not named in (b), and whenever any
    invariant of §CTR-CTOC-002 would be broken by the actual shared-env
    change, the hemostasis activation is STOPPED. No precedence inference, no
    "spirit of the Specs" reasoning, and no runtime expediency may expand (b).
```

## 4. Current State

- `STATE-CTOC-001` — The parent Spec is accepted at
  `accepted_reviewed_head 85431b5aa61493d9e472ab9b731ef58e896e581b`
  (2026-08-29) and present in `main` at `9bb5b97442c7155da36f06e867d1a655410544ac`.
  Basis: `OBS-CTOC-001`.
- `STATE-CTOC-002` — `AGENT_CORE_GLOBAL_ROUTE_HEMOSTASIS_V1` is proposed
  (PR #120, original head `816ae07c5f18056a82bd156a07ce9bf863e14b1d`,
  amended in this PR after review `5061334894` = REVISE). Basis: `OBS-CTOC-002`.

## 5. Observations

### OBS-CTOC-001 — Parent frozen clauses

- Subject: `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2`.
- Source revision: `9bb5b97442c7155da36f06e867d1a655410544ac`.
- Method: read `CTR-V2-004` (order steps 7 and closing rule) and frontmatter.
- Result: target-only transaction; non-target config/route/env semantics and
  the shared global surfaces frozen unchanged within that transaction;
  acceptance metadata as in `STATE-CTOC-001`.
- Provenance: the spec file at the cited revision.

### OBS-CTOC-002 — Hemostasis proposal and review

- Subject: PR #120 and review `5061334894`.
- Source revision: head `816ae07...`; review read 2026-08-31.
- Method: PR/review inspection.
- Result: authority blocker 2 names the shared-env conflict and requires an
  explicit coordinated amendment/precedence rule rather than
  "`supersedes = []` + conflict fails closed + proceed anyway".
- Provenance: PR #120 review `5061334894`.

### OBS-CTOC-003 — Governance supersession grammar

- Subject: `SPEC_GOVERNANCE_V0` §9.2.
- Source revision: vendored bytes at `9bb5b97...`.
- Method: protocol read.
- Result: whole-Spec supersession only; a non-replaceable refinement must be a
  new non-conflicting authority refining the same parent.
- Provenance: `.agents/protocol/SPEC_GOVERNANCE_V0.md`.

## 6. Claims and assumptions

### CLM-CTOC-001 — A narrow carve-out authority lawfully reconciles the two Specs

- Support state: SUPPORTED (`EVD-CTOC-001`: grammar permits the refinement
  path; `EVD-CTOC-002`: the conflict is exactly the shared-env surface).
- Contradicted by evidence: none known.
- Uncertainty: acceptance of both artifacts remains future Owner action.

## 7. Evidence relations

### EVD-CTOC-001 — Grammar supports the refinement path

- Source observations: `OBS-CTOC-003`.
- Target: `CLM-CTOC-001`, `§3 REQUIRES_SUPERSESSION`.
- Relation: SUPPORTS.
- Bound coordinates: vendored protocol at `9bb5b97...`.
- Strength/sufficiency: direct protocol text.
- Limitations: does not itself accept this amendment.

### EVD-CTOC-002 — The conflict surface is exactly the shared global env

- Source observations: `OBS-CTOC-001`, `OBS-CTOC-002`.
- Target: `CLM-CTOC-001`, `§3 PRECEDENCE_RULE (b)`.
- Relation: SUPPORTS.
- Bound coordinates: parent spec + PR #120 review.
- Strength/sufficiency: the parent's freeze clauses and the review blocker name
  the same surface.
- Limitations: future production behavior is governed, not observed.
- Provenance: cited artifacts.

## 8. Decisions

### DEC-CTOC-001 — Freeze the precedence rule of §3 as the only compatibility semantics

- Decision owner: repository Owner.
- Decision: `PRECEDENCE_RULE` (a)–(d) is the complete rule; no other
  interaction between the two authorities is created.
- Rejected alternatives: superseding the parent; editing the parent in place;
  prose non-conflict claims; runtime precedence inference.
- Reason: review `5061334894` authority blocker 2.
- Owner input remaining: NONE.

## 9. Contracts

### CTR-CTOC-001 — Carve-out activation preconditions

The shared global environment surface may be modified under the hemostasis
program ONLY while: `AGENT_CORE_GLOBAL_ROUTE_HEMOSTASIS_V1`, this amendment,
and every DAG child authority required for that specific action are each
accepted and present in `main`, and the action executes inside that program's
audited transaction. At all other times the parent's unchanged-surface
boundary governs without modification.

### CTR-CTOC-002 — CTO invariants under the carve-out

While any hemostasis transaction is live, `agt_cto-agent` continues to be
determined by its explicit override:

```text
provider  = zai
model     = glm-5.3
fallbacks = []
```

and the global flip MUST NOT: delete the CTO override; modify the CTO
credential boundary; add Luna; change the CTO route identity; or let the CTO
fall back to the global route. If the actual shared-env change would still
break any accepted CTO behavior: `ACTIVATION = STOPPED` (fail-closed).

### CTR-CTOC-003 — No scope expansion

This amendment creates no authority beyond §3(b). It grants no implementation
authority, no production execution authority, and no Luna/OAuth authority, and
it must not be cited as precedent for any other shared-surface change.

## 10. Acceptance

| Acceptance ID | Contracts | Method / required evidence | Expected result | Failure condition |
|---|---|---|---|---|
| ACC-CTOC-001 | CTR-CTOC-001 | review of this exact head against the hemostasis DAG | carve-out preconditions complete and conjunctive | missing precondition; carve-out reachable before acceptances |
| ACC-CTOC-002 | CTR-CTOC-002 | invariant enumeration review; runtime proof required at future execution | all five prohibitions + STOP rule present and testable | missing invariant; any "proceed anyway" path |
| ACC-CTOC-003 | CTR-CTOC-003 | scope audit of this amendment | no authority beyond §3(b) | any implicit expansion |

Coverage is bidirectional: every `CTR-CTOC-001`..`003` appears above, and every
row names existing Contracts.

## 11. Alternatives and disposition

| Alternative | Disposition | Reason / reopen condition |
|---|---|---|
| Supersede the parent activation Spec | REJECTED | whole-Spec supersession would destroy unrelated accepted semantics |
| Edit the parent Spec in place | REJECTED | accepted Decision/Contract IDs are immutable under V0 |
| Prose "the two Specs do not conflict" | REJECTED | review 5061334894 explicitly rejects it |
| Proceed with "conflict ⇒ activation stops" only | REJECTED | self-blocking; no lawful path to the hemostasis goal |
| Broad shared-env precedent | REJECTED | carve-out is hemostasis-only and fully gated |

## 12. Migration, compatibility, and rollback

Docs-only authority. If the hemostasis Governing Spec is rejected or expires,
this amendment becomes permanently dormant (its carve-out predicate can never
be satisfied) and may be superseded by a future cleanup authority; no
production rollback is implicated by this file alone.

## 13. Open questions and final output

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE_AFTER_BOTH_ACCEPTED
PARTIAL_SUPERSESSION = NONE
PARENT_SPEC_BYTES = UNCHANGED
CTO_AUTHORITY_COMPATIBILITY = EXPLICITLY_CLOSED
READY_FOR_INDEPENDENT_AUDIT = YES
READY_FOR_OWNER_ACCEPTANCE = NO
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_CHANGE = NONE
```
