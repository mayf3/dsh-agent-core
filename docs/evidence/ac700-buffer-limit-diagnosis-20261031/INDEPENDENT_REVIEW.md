# AC700 current-build prerequisite — independent evidence review

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = AFFECTED_CONTRACT
REVIEW_VERDICT = PASS
SPEC_REVIEW = NOT_APPLICABLE
REPOSITORY = mayf3/dsh-agent-core
REVIEWED_AT = 2026-10-31T04:02:59Z
REVIEWER_ID = /root/diagnosis_review
AUTHOR_ID = /root
AUTHOR_INDEPENDENCE = PASS
ASSURANCE_LEVEL = DURABLE
BRANCH = ac-task/700-buffer-limit-diagnosis
REVIEW_TARGET_HEAD = 0386b34a3d1054c71cbe51a2310fdff4d55c992b (parent only; candidate evidence is bound by hashes below)
BASE_HEAD = 0386b34a3d1054c71cbe51a2310fdff4d55c992b
CURRENT_BASE_HEAD = 0386b34a3d1054c71cbe51a2310fdff4d55c992b (local origin/main snapshot)
CANDIDATE_COMMIT = NOT_YET_CREATED_AT_REVIEW
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = NOT_APPLICABLE (no product implementation or authority change)
ACCEPTANCE_COVERAGE_REVIEW = PASS (bounded evidence delivery only)
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS (sanitized receipts and observer source; no production rerun)
BASE_IMPACT = NONE
REVIEW_SCOPE = FULL (initial review of this bounded evidence delivery only)
FULL_REVIEW_BASIS = INITIAL_REVIEW
SCOPE_REASON = first independent review of the current-build prerequisite investigation and proposed issue comment
BLOCKERS = 0
SPEC_GAPS = 0
FOLLOW_UPS = 0
TOOLING_DEBT = 0
FROZEN_BLOCKER_UNION = []
IMPLEMENTATION_ALLOWED = NO (current-build reproduction prerequisite remains unresolved)
MERGE_READY = NOT_APPLICABLE
OPERATION_ALLOWED = YES (reviewed issue delivery only; no production mutation or probe admission)
NEXT_ACTION = CONTINUE (publish exact-head evidence and record issue readback)
```

## Exact reviewed content

The isolated candidate consists of the nine files listed by the manifest, the manifest itself, and this review receipt. The external comment template is separately bound here. This record does not claim that the uncommitted candidate already has a commit SHA.

| Item | SHA-256 |
|---|---|
| `MANIFEST.sha256` | `e9e349e628f0a4396267b002ed43343a2774ca177f27746ab11fbfba9f6a94f5` |
| `docs/investigations/AC700_BUFFER_LIMIT_CURRENT_BUILD_CHECK_20261031.md` | `d25affa485c1e1bb43cbdc444af540767c7396edbfebab7ad00b927859250457` |
| `/private/tmp/ac700-delivery-comment-template.md` | `b90fab45e6245a32970d65d1bd1a78469659b13ab6165fdda2b87bc4855005b4` |

The template's single `{{EVIDENCE_LINK}}` placeholder may be replaced with the final exact-commit evidence link. A substantive later change needs an affected-delta review; committing these reviewed bytes and adding this receipt does not require repeating the prior investigation.

## Scope and executed checks

Read the repository grammar, local governance, Spec-governance REVIEW mode, accepted V3 adoption frontmatter and accepted lock, the new investigation, all six sanitized JSON receipts, the observer source, validation text, manifest, and proposed delivery comment. The reviewer authored none of the investigated observations or proposed delivery semantics. The reviewer did not access production/session paths, execute the observer, send a probe, change identity, inspect credentials, or inspect/re-run old harness PR #3 code or tests.

Executed locally against the evidence tree:

- Manifest verification: all nine listed byte hashes match; the revised manifest and two separately bound document/template hashes match the table above.
- JSON parsing: all six files parse. A recursive key check found no fields named content, text, prompt, messages, arguments, args, result, body, token, secret, password, authorization, or API key. Manual inspection found metadata, hashes, status projections and explicit limitations, without private dialogue/tool payloads or Secret values.
- Observer syntax: Python AST parsing passes. Source inspection confirms read-only source operations and stdout metadata projection, with exact-ID/error-text counts and no write/send path. This inspection does not assert that no source bytes were read during metadata extraction.
- Cross-receipt assertions: start/end counts are both nine, turn identities are exactly 1–9, and every end kind is completed; event counts sum to 714, parse errors are zero, and the retained main's exact error count is zero.
- Both final reconciliation records are settled/completed, their message IDs appear in retained main input metadata, and the final message ID matches the final input. Their epoch differs from the store-declared current epoch. The store reports 256 family records, 246 completed/10 failed, and zero family records in that declared epoch.
- Original-ID matches are empty in the retained main, runtime evidence, messaging audit and family recovery projection. These empty matches are not treated as proof of no execution or side effect.
- Probe receipt reports two unsuccessful resolves, no target handle, zero send calls and zero probe messages. The transport result is 429/UNAVAILABLE. Both DS receipts retain `current_runtime_verified=false`; the family-lock process check has rc=1 with no process output.
- After the author's bounded wording repair, all eight evidence/observer/validation files other than the investigation retain their originally reviewed hashes. No product files changed in the candidate.

The original observations are reviewed as coordinate-bound sanitized receipts, with reproducible observer source; this reviewer did not independently resample production. In particular, zero send/write counts and the transport failure are attributable recorded observations, not a second production execution by the reviewer.

## Semantic disposition

PASS for delivering an **INCONCLUSIVE** prerequisite result. The evidence supports historical completed requests and changed on-disk artifacts. It does not support current family-loaded identity, current-build reproduction, permanent resolution, original-request business outcome, or an absence of original side effects. The revised text correctly scopes the zero-family-record result to the retained store's declared epoch and states that private body/tool data was not exported, displayed or semantically interpreted.

The two uncorrelated log-line matches are not assigned to the family request, HTTP 507, request size, retry count or tool stage. MCP SSE 429 is an observation-entry failure, and DS's false runtime-verification flag remains a limit rather than a cause of the family buffer error. The denied DS unit-status subject is not used to authorize a substitute identity or route.

The proposed next action preserves the old UNKNOWN, prohibits old-request replay and fence clearing, and requires supported admission/deduplication before any separately authorized minimal probe. A future single successful probe would establish only that exact current path's result. No root-cause implementation, deployment, recovery, retry or issue closure is approved by this review.

There are no blockers to publishing the bounded findings and the recommendation to keep #700/#701 open. The unresolved reproduction prerequisite remains a business/investigation limitation, not a reason to mislabel this evidence delivery as failed. Initial wording refinements were resolved by the author before this PASS; the final frozen blocker union is empty.

This review is exclusively for the new AC700 investigation and its delivery comment. Old harness PR #3 SOURCE/exact-head review status remains **UNKNOWN** and is neither repeated nor replaced here. Product tests and RED→GREEN remain NOT_APPLICABLE for this evidence-only change.

## Remaining delivery verification

After committing, bind the final candidate SHA and confirm that its materialized evidence bytes match this manifest and that the only additional file is this review receipt. Replace only the comment link placeholder, then retain the GitHub comment URLs, posted-body hashes and readbacks. Publication and business acceptance have not occurred merely because this independent review passed.
