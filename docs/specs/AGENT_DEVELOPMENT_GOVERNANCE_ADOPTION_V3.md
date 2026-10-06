---
spec_id: AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3
status: proposed
spec_kind: invariant
authority_level: governing_spec
implementation_authority: none
scope:
  - mayf3/dsh-agent-core bounded governance adoption
  - local ordinary-development routing
  - exact vendor integrity and activation lifecycle
governed_by: []
external_authorities:
  - repository: mayf3/agent-development-governance
    authority_id: AGENT_DEVELOPMENT_GOVERNANCE_V1
    revision: 6301662e18adaed88e4412394ad9bdb959d92355
    relation: constrained_by
supersedes:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
superseded_by: null
owners: [mayf3]
---

# Bounded governance adoption V3 — proposed pilot

## 1. Goal

Adopt the existing upstream PR #21 fixes and make ordinary in-contract work use
its shortest permitted route. This is one consumer adoption, not a new platform.
Preparation, acceptance, source publication and production recovery are separate.

## 2. Scope and non-goals

Scope: exact vendored files and lock, this adoption, local entrypoint/route
amendments, and the existing Spec index. No product, HR, DS/shim, credentials,
production operations, runtime budget controller, or bulk historical rewrite.
The proposed source is `2.0.0-rc.1`, not a stable release or universal rollout.

## 3. Authority and dependencies

This is the prospective top-level local adoption successor; it preserves Product
Direction/Architecture precedence and all unrelated accepted product Contracts.
Owner instructed implementation of the preceding bounded plan on 2026-09-29:
"那你帮忙直接github上操作吧". That instruction permits preparation, not invented
independent review, retrospective acceptance, or production privileges.
Source PR #21 must receive its required review and canonical integration before
this candidate activates. A source or local semantic change reopens only affected review.

## 4. Current State

`STATE-AD3-001`: at consumer `64b752d42bd466594a116f37c17cd4bef4869d51`, observed
2026-09-29T03:16:20.214729Z, the accepted lock selects source `0595e7e8a5f5bcd45660ca19fdabe932637af2ec`,
version `1.1.0`. Existing V2 retains its historical v1.0.3 pin; this
proposal records that difference without claiming to ratify earlier transitions.
Basis: `OBS-AD3-001`. New V3 and new lock are proposed; V2 remains accepted until activation.

## 5. Observations

`OBS-AD3-001`: read the lock, V2, AGENTS and local README at the consumer base above;
method: exact Git checkout, no production read. Lock is v1.1.0; AGENTS requires
an accepted implementation Spec in base for every non-mechanical change; local
rules also impose a three-round cutoff. Provenance: the cited base files.

`OBS-AD3-002`: upstream `6301662e18adaed88e4412394ad9bdb959d92355`, isolated clean checkout, observed 2026-09-29;
method: full unittest/manifest checks; result: 133 tests and manifest check pass.
Initial review regressions produced 5 failures; the separate current/legacy
regressions produced 3 failures before the final repair. All now pass. Provenance: upstream
PR #21 and `tests/test_pr21_review_regressions.py`. These are mechanism results,
not proof that Agent delivery latency or HR recovery has improved.

## 6. Claims and assumptions

`CLM-AD3-001` (SUPPORTED by EVD-AD3-001): the candidate fixes the declared route
contradictions. No claim of production readiness, automatic acceptance, or 99%
availability follows. Actual delivery-time improvement remains unmeasured.

## 7. Evidence relations

`EVD-AD3-001`: OBS-AD3-001/002 SUPPORTS CLM-AD3-001 at the two exact Git revisions
and observation times above; sufficient for selecting a candidate pilot, not
local acceptance or runtime safety. Evidence sources: consumer base files and
upstream PR #21; limits include declared-record semantics and isolated tests.

## 8. Decisions

`DEC-AD3-001`: pin one exact candidate and change local routing only as enumerated
below. Reject floating main and silently overriding accepted product meaning.
Owner: mayf3, proposed for acceptance; independent review must validate the delta.

`DEC-AD3-002`: preserve history and all real safety/authorization boundaries while
allowing proportional work. Reject blanket three-round cutoff, forced full review
for every commit, and widening an operation-only blocker to unrelated development.
Owner: mayf3, proposed for acceptance; no execution power originates from this proposal.

## 9. Contracts

**CTR-AD3-001 — Exact source.** Based on DEC-AD3-001, the lock MUST select source
`6301662e18adaed88e4412394ad9bdb959d92355`, version `2.0.0-rc.1`, distribution `development-governance-v0`,
manifest SHA-256 `645a8c2d14cb03838dc7ecb6e3ac2f5f809bd536cf764384d0da974732e3cf23`. All managed files MUST match that manifest.
A mutable branch/tag or local edit cannot substitute; later updates are explicit.

**CTR-AD3-002 — Honest activation.** Preparation MUST keep V3/lock proposed,
accepted fields absent/null, V2 unchanged and accepted. Before activation obtain
source integration, independent local review and attributable maintainer acceptance
of exact reviewed coordinates. Atomically accept V3/lock, supersede V2 with mutual
backlink, update the index, preserve preparation fields and historical meanings.
Final-Head delta recheck and merge into main make the adoption active, not the PR title.

**CTR-AD3-003 — Local routing.** Based on DEC-AD3-002, REUSE inside existing accepted
implementation Contracts MUST NOT require a new Spec solely for internal changes.
V3 permits a single atomic Spec-delta/code PR for bounded AMEND/NEW + ROUTINE/DURABLE
with owner task authorization and independent acceptance of the delta before merge.
It MUST NOT contradict higher authority, replace accepted meaning, widen privileges,
change Secret/Grant boundaries, introduce destructive data changes or grant production
access. CONTROLLED and SUPERSEDE remain docs-first; unaccepted proposals authorize no code.

**CTR-AD3-004 — Bounded review and stops.** Current decisions MUST identify actual
affected boundaries and review impact using the imported protocol. No raw SHA change
alone requires full review. Current records require route schema v2 and explicit blocker scope. Legacy v1
omitted scope is inspection-only, never current-readiness credit. The earlier local mandatory three-round guard
is replaced by non-normative reassessment guidance; no global numeric cutoff or new
Agent formation is imposed. Actual permission/evidence failures still stop dependent work.

**CTR-AD3-005 — Preservation.** Except the enumerated adoption/local-policy delta,
product Contracts, architecture, code, protected state, historical receipts and actors
MUST stay unchanged. A changed source pin does not authorize HR recovery, clear fences,
replay operations, deploy code, or install controller changes. No normative history rewrite.

**CTR-AD3-006 — Verification and rollback.** Integrity MUST be checked with the
actual vendored verifier, route cases against the actual imported validator, and
adoption transitions against the complete raw RKGV1/V0/V1/V2/V3 metadata set.
Rollback MUST restore lock, vendor bytes, local entrypoints and adoption lifecycle
together via a reviewed repository change; it does not roll back runtime/data or
silently erase adoption history. Historical references remain readable.

## 10. Acceptance

All cases require exact candidate/base, actor, time, command/result and limits in
the existing PR record. Tests are not an independent acceptance recommendation.

| Case | Contracts | Method and required evidence | Failure condition |
|---|---|---|---|
| ACC-AD3-001 | 001,005,006 | manifest parity and vendored verifier; exact source head and changed paths | any mismatch, unrelated product/credential change or floating source |
| ACC-AD3-002 | 002,005,006 | raw five-record transition before/after, independent reviewed/final-head bindings | premature retirement, missing reciprocal edge, forged acceptance or normalized-only proof |
| ACC-AD3-003 | 003,004 | imported validator: REUSE ordinary repair, DELTA with moved head, operation-only NO and implementation YES | forced new Spec/full re-review/global stop |
| ACC-AD3-004 | 003,004,005 | explicit wrong scope, invalid mandate, CONTROLLED and SUPERSEDE atomic negatives | unsafe operation permitted, fake legacy scope used as permission |
| ACC-AD3-005 | 003,004,006 | local entrypoint review and raw contract coverage; opt-in later real task sample | atomic path enabled before acceptance, mandatory numeric cutoff retained, runtime success invented |

Coverage: 001→001; 002→002; 003→003/004/005; 004→003/004/005; 005→001/002/004;
006→001/002/005. Mechanism tests cannot prove real delivery-time improvement.

## 11. Alternatives and disposition

Keep v1.1.0: valid until activation, but retains diagnosed route issues.
Edit imported files by hand: rejected because lock parity would be lost.
Rebuild the whole governance/runtime platform: excluded; use the existing PR,
vendor, validator and local-policy surfaces. Broader versioning changes are deferred.

## 12. Migration, compatibility, and rollback

Forward-only pilot. Existing tasks/evidence do not lose validity merely because
this adoption exists; changed inputs and live operations keep their actual gates.
Before activation, this branch does not change main's rules. After activation,
record separately source-ready, locally adopted and observed task results. No
claim of runtime duplicate suppression or bounded recovery without that implementation.
Rollback follows CTR-AD3-006 and the preserved lineage; do not edit old receipts.

## 13. Open questions

Source PR #21 integration is satisfied: the exact source `6301662e18adaed88e4412394ad9bdb959d92355`
was merged into upstream main by `d38c94dc6df8e8d8e0bfe45528dadfe5c9bf2543`
on 2026-09-29T03:26:17Z. Source: https://github.com/mayf3/agent-development-governance/pull/21.
Local independent final-head review and adoption acceptance remain pending.
No unresolved question grants implementation or production authority. Future
executor-level duplicate suppression and measured delivery improvements are not
prerequisites of current HR recovery or this bounded governance repair.
