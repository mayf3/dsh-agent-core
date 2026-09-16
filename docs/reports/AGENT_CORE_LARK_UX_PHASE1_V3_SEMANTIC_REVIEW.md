# UX V3 independent semantic review

## Coordinates and mandate

- Goal: AGENT_OUTCOME_UNKNOWN_RECOVERY_CLOSURE, display candidate revision only.
- User mandate: combine four requested corrections, freeze head, independently review; preserve separate execution recovery and serialize production mutations.
- Base: `f72255d4feddb6deb4f907cbe70cca547f9e240a` (author fresh-fetch verified).
- Reviewed candidate: `900645556a4395d24ff9e29924171f3d47dfc9e8`.
- Spec: `docs/specs/AGENT_CORE_LARK_UX_PHASE1_V3.md`.
- Spec SHA-256: `a1af429cf3967364edeee2941660fb3a77657948f1061b4dafbc1ae6f66c3fa3`.
- Reviewer: independent subagent `ux_v3_semantic_review`, fresh context, read-only.
- This record persists the review; its addition does not change reviewed Spec bytes.

## Verdict

SPEC_REVIEW = ACCEPT (recommendation only)
AUTHOR_INDEPENDENCE = PASS
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS (Spec and pinned source, not runtime proof)
BASE_IMPACT = NONE
FROZEN_BLOCKER_UNION = []
SHIP_BLOCKER = 0
SPEC_GAPS = 0
MECHANICAL_FIX = NONE

## Semantic findings

1. Router-only media precheck preserves Scheduler's original card eligibility, targets, mention behavior and empty/oversize alternatives; card eligibility union does not trigger the new precheck.
2. Terminal send_timeout retains its SDK classification and projects replyDelivery=unknown with “可能已送达”; no upper-layer resend and no inference of zero delivery.
3. Fixed SDK format fallback is post-to-text only. Preselected text and static card do not receive a second format downgrade. Target-revoked fallback and transport retry remain distinct.
4. Adoption V2 governs. Four closure declarations and the future atomic V3-accepted / both-predecessors-superseded transaction, including reciprocal links, are explicit. Predecessors remain unchanged until acceptance.
5. Effective heading normalization, long-content fidelity, mentions, topic continuity, bounded retry and live-client gates are inherited. Changed meanings have new IDs and migration mappings.
6. Partial-delivery receipts remain possible/unavailable. Final permission/format rejection does not prove whole-answer nondelivery. Receipt failure does not rewrite execution or authorize Agent re-execution.

SDK evidence: fixed revision `ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f`, outbound sender.ts and retry.ts. Repository evidence: exact-base feishu-connector/index.js and accepted predecessors/adoption authority.

## Verification and limitations

Whitespace, unique normative headings, 13 sections, proposed status, governance integrity and targeted secret-pattern inspection passed. No remote push.

Structure verifier reports the same pre-existing scripts directory violation on candidate and base-control: 59 children, exception 40; each reports one violation and 72 warnings. No scripts/product source changed. This is recorded baseline debt, not silently fixed.

Fixed SDK's unknown retry and unavailable partial chunk receipts remain explicit follow-up limitations, not requirements for this candidate.

IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO (Owner acceptance transaction pending)
OPERATION_ALLOWED = NO
PRODUCTION_MUTATIONS = 0
RUNTIME_RESTARTS = 0
REAL_CANARY = NOT_RUN
CURRENT_AGENT_RECOVERY = NOT_PROVEN

This PASS is an exact-head Spec review recommendation, not acceptance, implementation conformance, or production authorization. Next action is Owner acceptance of the reviewed candidate followed by the defined atomic lifecycle transaction and main-base gates. Production deployment/restarts remain serialized with Watchdog and execution recovery.

## Section 12 scoped follow-up review

- Previous record and delta base: `074648412a5145e1f4abd7ab5e70e9f819989ab8`.
- Reviewed candidate: `ac25a9ab58154c8b18059ef08ad358e9336fb036`.
- Spec SHA-256: `fa5d1a125943d5305213f06df8a82ed6a2090de00de0718734d4e7242a225615`.
- Reviewer: `ux_v3_semantic_review`, independent read-only follow-up.
- Verdict: PASS; SHIP_BLOCKER=0; MECHANICAL_FIX=NONE; NEW_FOLLOW_UP_DEBT=NONE.

Only the user-specified section 12 replacement changed. Other Spec bytes are preserved; diff whitespace check passed. Coordination is limited to the same production installation, Runtime or shared deployment resources and existing operational authority/gates. This Spec adds no cross-Goal deployment veto. The new generation is not old execution termination proof; exact lifecycle evidence and no historical replay remain mandatory. Prior four-item closure remains valid.

Author-side revision ends here. This follow-up supersedes the previous record's unqualified final sentence about shared serialization: serialization applies only to the shared resources specified in the current section 12. Candidate remains proposed; acceptance, implementation and production operations are not authorized by this review. This report update does not change the reviewed Spec bytes.

## Fresh full-head review and frozen blocker union

- Review target: `d35a52d14ac202c497c906a9e7270136cd147c1a`.
- Merge base: `f72255d4feddb6deb4f907cbe70cca547f9e240a`.
- Current remote main observed during review: `31e0dfe6f7af2aec0e570fe804904b2a4d720a4e`;
  its only delta from the merge base was an unrelated pnpm diagnostic runbook.
- Reviewer: independent subagent `v3_fresh_full_semantic_review`, fresh context, read-only.
- Verdict: `REVISE`; `BLOCKERS=3`; `IMPLEMENTATION_ALLOWED=NO`; `OPERATION_ALLOWED=NO`.

The fresh review did not inherit the preceding PASS. It froze three blockers: the proposed V3 bytes omitted the
two `supersedes` entries; the standalone successor lacked the effective predecessor Decisions, material
scope/non-goals, and exhaustive global-ID migration; and `CTR-DISPLAY-001..006` lacked six structured
Acceptance definitions plus a closed stage-specific result carrier. Existing Scheduler-plan preservation,
SDK retry/fallback ownership, truthful unknown/partial-delivery semantics and zero business replay were coherent.

The following author repair is one union pass: name both predecessors while V3 remains proposed; restate the
effective scope/prohibitions and Decisions; add a global Decision/Contract/Acceptance/test-gate crosswalk; define
the admission/execution/reply-delivery union and six complete `ACC-DISPLAY-*` gates. It does not alter product
code or production state. A new independent exact-head review is required; the old PASS records do not authorize
acceptance or implementation.

## Repaired exact-head independent re-audit

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = SPEC
REVIEW_TARGET_HEAD = a52e796fbb06f40e766aa6b6b45271909c720dbe
BASE_HEAD = f72255d4feddb6deb4f907cbe70cca547f9e240a
CURRENT_BASE_HEAD = 129463986a7d971eca726e06c7d23b5df5231c03
MERGE_BASE = f72255d4feddb6deb4f907cbe70cca547f9e240a
SPEC_SHA256 = d76817605e49398ca35f4b32c64c8038f300f61e9e589a6d2aef2681e4f2aac7
REVIEWER_ID = v3_fresh_full_semantic_review
REVIEWED_AT = 2026-09-15T15:59:24Z
SPEC_REVIEW = ACCEPT
AUTHOR_INDEPENDENCE = PASS
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
BASE_IMPACT = BOUNDED
BLOCKERS = 0
SPEC_GAPS = 0
FOLLOW_UPS = 0
TOOLING_DEBT = 1
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
NEXT_ACTION = OWNER_DECISION
OWNER_EXACT_HEAD_ACCEPTANCE_SOLE_NEXT_GATE = YES
```

The re-audit independently re-read the full repaired successor and affected source seams. Both predecessor IDs
are present in the proposed `supersedes` list; effective scope, prohibitions and Decisions are standalone; the
global migration table covers all 80 V2 and 8 amendment normative/gate items; all 34 Contracts have Acceptance
coverage; six structured display Acceptances and the closed stage-specific result union satisfy the frozen blocker
closures. Scheduler plans, SDK ownership, execution/delivery separation, honest ambiguity and zero replay remain
intact. No AgentProcess, lifecycle, identity, SDK pin, persistent-store or production authority was added.

Fresh main movement was bounded to the unrelated pnpm diagnostic runbook. Governance integrity, whitespace and
the focused accepted lifecycle simulation pass. The only tooling debt is the unchanged base structure violation
for `scripts` (59 children versus registered ceiling 40; one violation and 72 warnings on base and candidate).

This `ACCEPT` is a review recommendation, not Owner acceptance. Owner acceptance must bind the reviewed Spec head
and SHA-256, authorize only the atomic lifecycle/provenance finalization, and receive a final accepted-head recheck.
