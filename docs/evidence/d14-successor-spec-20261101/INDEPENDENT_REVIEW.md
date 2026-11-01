# D14 independent non-author review record

Recorded by `/root` from the independent reviewers' returned assessments; neither reviewer authored
any reviewed Spec text or modified files. Review target is the exact committed initial semantic
candidate below. The later change to Reconciliation's predecessor/link display text is identified
here and requires final-Head delta recheck, persisted in the PR conversation after final commit.

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = SPEC
REVIEW_TARGET_HEAD = 2e2e0f804cacee3eccae2e7f4c26179be028be3f
BASE_HEAD = 3a1282b35e7b852f51cd14284ea91fd77a13543e
CURRENT_BASE_HEAD = 3a1282b35e7b852f51cd14284ea91fd77a13543e
AUTHOR = /root
ASSURANCE_LEVEL = CONTROLLED
REVIEW_SCOPE = FULL (initial affected-authority review)
FROZEN_BLOCKER_UNION = {D14-DOCS-LIFECYCLE-001}
DOCS_DRAFT_PUBLICATION_ALLOWED = YES
AUTHORITY_ACTIVATION_READY = NO
IMPLEMENTATION_ALLOWED = NO
ACTIVE_AUTHORITY_MERGE_READY = NO
OPERATION_ALLOWED = NO
```

## Reviewer `/root/authority_inventory` — four-authority completeness

Verdict: `ACCEPT / DOCS_DRAFT_PUBLICATION_ONLY`; `FOUR_AUTHORITY_COMPLETENESS=PASS`;
Contract, reverse Acceptance coverage, primitive boundaries, mandate scope and evidence
reviewability PASS. `AUTHORITY_ACTIVATION_REVIEW=FAIL_EXISTING_DECLARED_GATE`.
New draft-publication blockers0; activation blockers1; one editorial follow-up.

Independently inventoried the accepted pin owners and compared old/new normative sections after
accounting for new namespaces:

| Old owner → complete successor | Independent result |
|---|---|
| SCA V3 → V4 | all17 CTR,13 ACC and full bootstrap/rollback definitions retained;002/004/013 and dependent version/identity decisions/acceptance explicitly replaced; canonical/lock/intent/UNKNOWN/Owner recovery/permissions/route semantics preserved |
| Default V1 → V2 | full default and precedence retained; ACC-D1–D7 retained, D8 covers same-generation identity; no independent pin or silent fallback |
| GPT6 V1 → V2 | six CTR/seven ACC retained; ordinary-fleet old byte-equivalence obligation explicitly replaced for controlled migration; exact dormant0.2.3-dshr1/source/patch/archive/pi-ai/Harness identity remains independently dormant |
| authsvc Reconciliation V2 → V3 | A1/A4 D14 source/installer/marker rebinding explicit; A2/A3/six cohort CTR/ACC/original R/F and same-transaction recovery retained; original B7 packet is not silently rewritten |

Extra accepted source pins in Activation V2, Activation V1's retained authsvc operation scope, and
the two fixed B7 offline-carrier authorities are explicitly RETAINed within their separate bounds.
The proposed capture amendment is not treated as accepted. No fifth reachable pin owner was
silently omitted. Old files and globally qualified stable IDs remain unchanged.

Reviewer independently ran `verify-docs.py`, governance `--require-accepted` and exact-base/head
`git diff --check`, exit0: five schema records,12 original quoted blocks, four byte-exact source
copies, four unchanged predecessor files and activation patch check PASS. No product tests,
protected production observation or activation was performed.

## Reviewer `/root/evidence_review` — facts, phase and rollback

Verdict: `ACCEPT_FOR_DOCS_DRAFT_PUBLICATION`; authority/primitive/Contract/Acceptance/mandate
boundaries PASS within scope. Same frozen blocker union; new blockers0.

Exact tuple hashes match PR599's immutable evidence. Old rc.8 is not asserted as gen-032's Harness.
Full Harness identity, Core combination compatibility, process-loaded identity and business
acceptance remain UNKNOWN.117 home,123 readable packages and118 historical rollout claims are
distinct; four paths remain in byte-exact source evidence.

R1/R2/R3, real Loader/apply, all path components/permissions, cross-process filename lock, locked
reread, durable intent/commit/clear, at-most-one refresh, crash boundaries, current document fields,
pending/replacement, actual Owner login seams and stable redacted error identity are preserved.
Sequence is main atomic acceptance → production-line import → isolated implementation → compatibility
proof → regulator acceptance → controlled publication. Compatibility proof gates production
admission and admissible delivery, not isolated code/fixtures needed to obtain that proof.

Standard rollback restores a qualified whole generation and matching expected/config/home-link
preimages, proves worker/tool/refresh exclusion, accounts for watchdog, verifies exact readbacks and
uses same-transaction recovery. Unsafe old-label rollback refuses; no credential lineage, pending
intent, UNKNOWN or business fence is rolled back. Without a qualified target, use safe containment.

Reviewer independently ran `verify-docs.py`, exit0/PASS_DOCS_ONLY, and checked all15 initial delta
paths are additions in the allowed directories. No product test or production operation is claimed.

## Preserved activation blocker

```text
ID = D14-DOCS-LIFECYCLE-001
CLASS = REQUIRED_GATE_FAILURE
SOURCE = .agents/protocol/SPEC_FORMAT_V0.md:128-135,146-147 and .agents/local/README.md whole-authority rule
COUNTEREXAMPLE = four proposed successors exist while additions-only scope leaves old authorities accepted with no reciprocal backlinks
IMPACT = activation, dependent implementation, active-authority merge and production operation remain NO; clearly labelled draft publication is allowed
MINIMAL_CLOSURE = authorize existing-doc lifecycle/index scope; Owner accepts exact independently reviewed bytes; atomically update all old/new lifecycles with actual reviewed/final-head/actor/time provenance; independent final delta recheck; merge to main
AFFECTED_READINESS = AUTHORITY_ACTIVATION_READY, IMPLEMENTATION_ALLOWED, ACTIVE_AUTHORITY_MERGE_READY, OPERATION_ALLOWED
NEXT_ACTION = CONTINUE_DOCS_DRAFT_PUBLICATION
```

## Consolidated editorial repair

Both reviewers observed that Reconciliation V3 §1 linked the historical amendment as if it were this
V3's direct predecessor, and used SCA V3/Default V1 display labels for V4/V2 links. The author checked
the supersedes metadata and repaired only those three display/reference statements: direct
predecessor is Reconciliation V2; the amendment is its historical ancestor. No Contract, tuple,
Acceptance or phase gate changed. Final-Head delta review is bounded to this repair and added
review/verification evidence; no unaffected mechanisms are rerun as product acceptance.
