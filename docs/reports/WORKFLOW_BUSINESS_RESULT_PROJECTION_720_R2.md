# #720 R2 — source conformance and independent review

This report records source work for [PR #595](https://github.com/mayf3/dsh-agent-core/pull/595)
under the [2026-10-31 Owner ruling](https://github.com/mayf3/agent-control/issues/720#issuecomment-6542854437).
It does not accept the proposed Spec, authorize merge or authorize production.

## Coordinates and scope

- Integration and freshly rechecked main: `491faec46877d8078dd5be4a491f8fc047f83c82`.
- R2 input: `324d3265ea791e43d1ac86e80b2e7ca059f7661d`.
- Initial semantic/code candidate: `52243fbcc8a9b51d434798fca28537c6cb25e3fc`.
- Repaired implementation: `54a235c55f52b209e6f3b17fa1e23eea73c9da2f`.
- Svc accepted authority and source pin: `ddf81196225f28bb5ffe0b8e73c8bc747aae736b`.
- Working surface: dedicated `/tmp/dc-720`, local branch `pr-720`; existing PR ref
  `ac-task/720-business-projection`. No other checkout or active writer was changed.

The [proposed Spec](../specs/AGENT_CORE_BUSINESS_RESULT_PROJECTION_V1.md) and its
Contracts are in the same PR. The pure classifier is
`packages/workflow-execution/src/business-result.js:139`; its only new consumer is
the existing history workflow root through `packages/execution-history/src/workflow-result.js`.
The existing structured and report views expose `summary.workflowResult`.

`execution[].executionState`, `attemptClosure` and `visitLeft` describe existing
execution/visit facts. `businessOutcome.state` independently reports
`UNKNOWN|FORWARD|RETURNED|CANCELLED|TERMINATED`.
`businessOutcome.acceptance.state=ACCEPTED` is explicitly
`SVC_WORKFLOW_ACCEPTANCE_CONTEXT_BINDING_V2 / STRUCTURAL_BINDING_ONLY`, with exact
Definition/transition/submission/digest/Context/catalog joins. Missing or denied
proof remains `UNPROVEN`. Observation times, native versions/evidence and
`consistency=NON_ATOMIC` remain visible. No Run authorship is inferred.

Definition discovery and exact-version reads use existing caller-credential GETs,
including existing Domain Owner visibility for the graph. No grant or identity
changes occur. Raw timeline response revisions are hashed before normalization or
cap clipping so missing/invalid evidence cannot disappear from the read boundary.

## Executed tests and unchanged boundaries

Node `v26.7.0`, npm `11.19.0`, isolated temporary fixture roots. The existing
external dependency directory `/tmp/ac720-test-deps/node_modules` supplies only
`croner@10.0.1` and `@deepseek-ai/schemastery@3.18.1` (previously installed with
scripts disabled). No package manifest or lockfile changed.

```sh
node --test --test-reporter=tap packages/workflow-execution/test/*.test.js packages/execution-history/test/*.test.js
```

| Observation | Actual result |
|---|---|
| Initial environment baseline | rc 1; 251 pass, 2 file-load failures |
| Repaired-environment baseline | rc 0; 330/330 |
| Initial feature RED | rc 1; 23 failures, including both existing-reader missing-field assertions; remaining pure-function tests could not yet import the absent implementation |
| Initial pagination RED | rc 1; 6 pass, 1 fail |
| Malformed DTO / remote-proof boundary RED | rc 1; 23 pass, 2 fail |
| Initial feature + loader GREEN | rc 0; 32/32 |
| Initial full regression | rc 0; 356/356 |
| Independent-review union RED | rc 1; 32 pass, 4 fail |
| Review repair GREEN | rc 0; 36/36 |
| Repaired full regression | rc 0; 360/360 |
| Structure at repaired implementation | rc 0; candidate delta PASS, 0 candidate violations, 32 historical debt entries retained |

The two initial environment failures are named separately:
`packages/execution-history/test/session-traceability.test.js` could not load
`croner`; `packages/workflow-execution/test/runtime-wiring.test.js` could not load
`@deepseek-ai/schemastery`. Neither is a candidate regression. The baseline
comparison [receipt](../evidence/business-result-projection-720-r2/TEST_EVIDENCE.json)
lists all 30 original test files and all 330 hierarchical test results, with 30
added results, zero removed and zero changed baseline outcomes, plus every log's
SHA-256 and actual process-rc provenance.
These are two-package regressions, not a whole-repository test claim.

`git diff --check`, Spec frontmatter schema and vendored-governance integrity
checks passed. Exact tree diff confirms no change to judgment, engine, ledger or
the original ledger-only execution projection. The existing consumption-ban and
checkpoint-privacy tests pass. There is no new collector, global entity ID,
database write, execution flow or production action.

## Independent non-author review — initial candidate

Reviewer `/root/independent_review` authored no candidate semantics or code and
read the repository authorities, exact Svc authority/DTOs and complete affected
delta. This is an independent Agent review, not a GitHub maintainer approval.

```text
REVIEW_TARGET_HEAD = 52243fbcc8a9b51d434798fca28537c6cb25e3fc
BASE_HEAD = CURRENT_BASE_HEAD = 491faec46877d8078dd5be4a491f8fc047f83c82
AUTHOR_INDEPENDENCE = PASS
REVIEW_SCOPE = FULL (initial review of bounded candidate)
SPEC_REVIEW = ACCEPT (recommendation only)
SPEC_SEMANTIC_FINDING = NONE
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = FAIL
ACCEPTANCE_COVERAGE_REVIEW = FAIL
FROZEN_BLOCKER_UNION = [BRP-READ-COMPLETENESS-1]
MERGE_READY = NO
OPERATION_ALLOWED = NO
```

`BRP-READ-COMPLETENESS-1`, implementation-only `CONTRACT_VIOLATION`:

- Source: accepted Execution History Query V1 §2 and proposed CTR-BRP-003/005.
- Counterexamples: missing both cursor fields treated as EOF; null/scalar items
  filtered before classification/hash; cursor 10 after returning only sequence
  1 skips an unreturned interval; final three-row response clipped to a two-row
  cap without reporting truncation.
- Impact: incomplete evidence could support `FORWARD`, and malformed content
  could disappear from the report boundary.
- Minimum closure: validate native cursor/page coordinates, surface malformed
  rows and every clipping, hash raw consulted responses, add reader regressions.
- Affected readiness: implementation conformance and merge readiness were NO at
  the initial head. The supervisor's Spec acceptance remained outstanding.

The reviewer independently executed feature, loader, consumption-ban and judgment
suites: rc 0, 46/46. Its non-author helper independently reproduced all four
counterexamples and ran feature/loader suites: rc 0, 32/32. Reviewer inspected and
hash-verified the supplied full regression/structure evidence rather than claiming
to have rerun it. It confirmed no other Spec/code blocker, no Spec gap and no
production activity. The published PR still pointed to the R1 head at that time.

## Repair disposition and final review

The four review regressions were observed RED, then GREEN. The single union was
repaired in `54a235c5` without changing any Spec byte. Full source regression is
360/360. The same non-author reviewer independently completed affected-delta
review with the following result:

```text
REVIEW_TARGET_HEAD = 54a235c55f52b209e6f3b17fa1e23eea73c9da2f
PREVIOUS_REVIEWED_HEAD = 52243fbcc8a9b51d434798fca28537c6cb25e3fc
REVIEW_SCOPE = DELTA (frozen blocker closure and invalidated dependencies)
AUTHOR_INDEPENDENCE = PASS
SPEC_REVIEW = ACCEPT (recommendation; supervisor acceptance remains separate)
SPEC_SEMANTIC_FINDING = NONE
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
BRP-READ-COMPLETENESS-1 = CLOSED
OPEN_BLOCKER_UNION = []
SOURCE_REVIEW_READY = YES
MERGE_READY = NO (supervisor acceptance pending; merge not authorized)
OPERATION_ALLOWED = NO
```

The reviewer executed the four focused suites again: rc 0, 50/50. Its non-author
helper replayed all four original counterexamples, each now `truncated:true`, and
ran feature/loader tests: rc 0, 36/36. It confirmed malformed reader results are
UNKNOWN, source DEGRADED and raw differing responses remain in the source token;
Spec bytes are unchanged and no new semantic blocker exists. It inspected the
360/360 full regression and exact-head structure receipts without claiming another
full run. Final documentation/receipt-head recheck is recorded in the PR delivery
record; the code and Spec coordinates above remain the reviewed source tuple.

## Acceptance and live-state limits

The Spec remains **proposed** until the supervisor performs the post-review
semantic acceptance required by the ruling. A review recommendation is not that
acceptance. PR #595 remains open and unmerged; #720 remains open.

`INSTALLED=NOT_VERIFIED; ENABLED=NOT_VERIFIED; BUSINESS_VERIFIED=NO;
PRODUCTION_MUTATION=NO`. No original-instance production/private-session read was
performed. No authorized exact blog/EP49 instance coordinates were supplied for
this source task; original-instance comparison and a second-instance reuse proof
remain unexecuted. Fixture structural acceptance is not live business acceptance.
