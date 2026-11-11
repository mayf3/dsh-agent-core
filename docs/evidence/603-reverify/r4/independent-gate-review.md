# R4 independent gate evidence review

Recorder `/root`; reviewer `/root/gate_review` did not author the candidate, write files, execute tests, contact production agents, or perform production actions.

```text
REVIEWER_ID = /root/gate_review
REVIEW_KIND = AFFECTED_CONTRACT
REVIEW_SCOPE = DELTA (frozen gate matrix and unchanged product bytes)
AUTHOR_INDEPENDENCE = PASS
OBSERVED_AT = 2026-11-07T04:54:44.871435+00:00
REVIEW_TARGET = 0f25ce5270c0964476184af509c5857acbdf1527
VERIFICATION_TREE = 63534a3f954004da8967cd1284df8915d11d5603
BRANCH_HEAD = 91e224bc079f26cef285cba6da0872cb640ed330 + working diff
BASE_HEAD = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed
CURRENT_BASE_HEAD = NOT_FRESHLY_RECHECKED_BY_REVIEWER
EVIDENCE_REVIEWABILITY = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS (frozen matrix)
MANDATE_SCOPE_REVIEW = PASS
BLOCKERS = 0
SPEC_GAPS = 0
FINAL_DELIVERY_HEAD_DELTA_REVIEW = PENDING (head not yet generated)
MERGE_READY = NO (not authorized)
OPERATION_ALLOWED = NO
```

- All 13 then-existing R4 command records have actual rc0 and start/end UTC coordinates. Every actual argv contains all nine `env -u` keys, PATH selecting local Node v25.6.1, and both EKR SHA bindings to the real snapshot above.
- Every raw stdout/stderr SHA256 was independently recomputed and matches its metadata. All stderr streams are empty. No FAILED.json exists.
- Dynamic gates: changed-runtime 40, Scheduler 480, Scheduler-Router 40, observation-cas 93, Broker 31, workflow 147, runtime 12. Total 843/843 PASS; fail/cancelled/skipped/todo are zero at each gate.
- Observation-cas expands 11 real test files; Broker 2, workflow 7, runtime 2. These and the three changed-runtime files match the Stage A frozen matrix, with no omission. D-009 dynamics are covered by full Scheduler and changed-runtime; no additional test suite is invented.
- R3's original 13 distinct refused test names each appear as PASS in R4. V2 missing-evidence before/after SHA256 is `10cb327a7c7b62afc2dbbb71e868daece061cd36a9df6e768427017dadf039df`; mutations=0, upgrades=0.
- EKR diagnostic sourceSha values contain only the bound snapshot, no UNKNOWN/UNBOUND. This is local mechanism evidence, not autonomous business/runtime acceptance.
- Fresh `git diff --exit-code` against snapshot for `.agents`, `docs/specs`, `docs/decisions`, `packages`, `scripts` is rc0 and empty. R2 structure raw hashes recompute correctly: actual rc0, governing V3, candidate violations=0, baseline debt=28, resolved=0, exact installer blob pair and 1315-line debt. Unchanged bytes support reuse of structure and source review; this is not a repository-wide debt-free claim.
- Final delivery commit must be checked against the same product bytes and receive final-HEAD delta review. Root's later main-impact check is separate from this review.

Raw `.log` files are ignored by default. Root must explicitly stage load-bearing R2/R3 negative and R4 raw logs, so remote reviewers can read full originals.
