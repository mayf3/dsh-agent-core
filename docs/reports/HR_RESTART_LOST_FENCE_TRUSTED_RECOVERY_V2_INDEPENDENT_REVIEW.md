# HR whole-authority V2 successor and fixed R2 addendum — independent final docs review

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = SPEC / FINAL_HEAD_AND_FIXED_OPERATION_CROSSCHECK
SPEC_REVIEW = ACCEPT
REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = 94eb53c48856d850a77a0d64ada6566f9fcd13d4
BASE_HEAD = bed1936f990f7a2831cf55ac35716b861570f40e
CURRENT_BASE_HEAD = bed1936f990f7a2831cf55ac35716b861570f40e
REVIEWER_ID = independent HR r4 consumer/replay reviewer
AUTHOR_INDEPENDENCE = PASS
ASSURANCE_LEVEL = CONTROLLED
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS (docs-only; no runtime proof asserted)
BASE_IMPACT = NONE
BLOCKERS = 0
SPEC_GAPS = 0 in the affected proposed contract
FOLLOW_UPS = 0 for this docs-only review
TOOLING_DEBT = 0
VERDICT = PASS_READY_FOR_OWNER_ACCEPTANCE
IMPLEMENTATION_ALLOWED = NO (V2 and R2 remain proposed)
MERGE_READY = NO (Owner decision and atomic acceptance transaction pending)
OPERATION_ALLOWED = NO
NEXT_ACTION = OWNER_DECISION on two separately identified exact authorities
```

## Exact coordinates and independently executed checks

| Item | Verified coordinate/result |
| --- | --- |
| Isolated worktree | `/Users/yanfenma/.codex/worktrees/hr-replay-provenance-successor/dsh-agent-core`; `HEAD=94eb53c48856d850a77a0d64ada6566f9fcd13d4`; `origin/main=bed1936f990f7a2831cf55ac35716b861570f40e`; `git status --porcelain` empty. |
| Source effect | Candidate diff has only `docs/specs/HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V2.md` and `docs/specs/README.md`; `git diff --check` passed. No source, tests, profile or production state changed. |
| Accepted predecessor | Historical reviewed r4 file at `5726f43f9c028a8967720ccaff49a054ee1423e6` hashes to `fb5a5f825900b4c77ff681283cb51b5f914f449adda6789949f39dffeb60ad78`; current accepted lifecycle file hashes to `4d24ac5086969f38db368c94ebef777c1d391bda519419936e41073f554d86f0`. |
| Successor | V2 full file SHA-256 `62a105cc1cc34160253b938d55637898cb1ff93d75096331d450b2fa042ee259`; normative bytes after frontmatter SHA-256 `183ec2c7c301aefdd6d897d5577e9995dde75f06a9b0eef686b3fbf2a9841629`; Specs index SHA-256 `b00951ff35f254a26bb25bb3dd756cbf05b66e8517ecfe2e21131235d44d8ee4`. |
| Full carry-forward | Independently generated GNU unified diff from current accepted V1 to committed proposed V2 hashes exactly to frozen `V1_TO_V2.diff` SHA-256 `9c739efe90265ca3cd264e5f37f283b01d15d45cbec5f2a45b806384456d3865`. Unchanged r4 lines carry forward byte-for-byte; changes are confined to metadata/lifecycle, RQ-002..005, affected ACC/NEG and summaries. |
| Mechanical governance | V2 frontmatter passes `.agents/schemas/spec-frontmatter.schema.json`; transition `[accepted V1] -> [accepted V1, proposed V2]` passes `validate_spec_transition.py`; `verify_governance.py --target . --require-accepted` passes. Proposed V2 names whole V1 in `supersedes`; accepted V1 remains `superseded_by: null` until the later atomic acceptance transaction. |
| Fixed operation | Original R2 SHA-256 `35dbaeb6938c81f3101506efd42d065caf4ea7ad47010a52e5a906bb5c252a7c` verified unchanged. Addendum SHA-256 `4ae224d4103e8c0cad31b963e1c9609eef748194c6d64a5e6e9838c13349e233` verified. Preliminary addendum review SHA-256 `e633f06a653b63533dae2ff6a558b3c46803457cd57f20ebb8f17ba3eadc77e7` is superseded for this exact crosscheck by this review's conclusion. |

## Semantic and security crosscheck

- **Whole-authority lifecycle.** V2 is a complete proposed successor, not an in-place alteration of accepted r4. The predecessor remains active and unbacklinked while V2 is proposed; §11 specifies one atomic docs-only status/backlink/index transaction after exact independent review and Owner decision. V2 declares implementation authority only after acceptance in the applicable base. The fixed privileged R2 addendum is separate and cannot be inferred from V2 acceptance.
- **Original proof identity and zero write.** V2 RQ-002 binds the exact sealed final bundle bytes, subject/preimage and launch-authorization digest to a create-only external receipt keyed by `(operationId, hostId, startupNonce, reconciliationHandle)` outside the Router store. V9 requires immutable registration, exact bytes/length, current live lock/window/challenge, P5 producer preflight and the sole nonce-bound launch. The key alone is expressly not a settled-winner oracle. Pending V8 retains P1..P10 and live preimage comparison; settled V8 retains P1..P4/P6 and exact quiescence settlement/fence predicates, comparing to the immutable original commitment. Altered proof, other settled outcome, stale window/key, ambiguous journal or tombstone rejects before record **or audit** write. A byte-identical same-window replay may append only bounded `duplicate_ignored`, transactionally rolled back on persist failure; `conflict_ignored` remains only for independently validated late evidence. No business outcome is inferred.
- **Launch and crash.** V2 RQ-005 and R2 addendum agree on: fixed preflight and floor/validator proof; canonical global lock and source inhibition; post-stop complete census/holder checks; root authorization after observations; final bundle seal; commitment create/fsync/index/exact readback; durable/read-back `LAUNCH_ATTEMPT_COMMITTED` before any possible spawn; then one pinned fresh Runtime launch with authenticated nonce/challenge. Continuous lock/window and bounded timing cover census through consumption. No nonce is reused after a crash. Affirmative no-launch and exact child/source/lock proof are required for prelaunch abandonment. Possible launch is UNKNOWN until exact durable child/store readback; it cannot trigger another spawn or old-bundle replay. Settled active-fence crash cleanup uses the existing may-finish branch without bundle or duplicate audit.
- **Journal and containment.** V2 and R2 match on create-only receipt/index, no-follow descriptor-relative storage, file/parent fsync, independent root readback, one live commitment per handle, settled-handle exclusion, monotone durable phase journal, capacity admission before the cut, no eviction of eligible/UNKNOWN entries, permanent tombstone before separate retirement, archive/readback requirements, and bounded inhibited UNKNOWN custody. A deadline cannot release an unresolved window. These are proposed obligations; installed enforcement is not attested here.
- **R2 scope and rollback.** The addendum preserves original R2's exact s256 subject `turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256`, operation `hr-s256-trusted-quiescence-cut-20260925-v1`, unit `scheduler-whole-main`, service `system/ai.agent-core.runtime`, bootstrap-resolved DS Owner peer-authenticated actor, fixed protected-read/source/holder closure and one Runtime. It adds only predeclared root journal/index/receipt/tombstone effects; no caller path, arbitrary root command, second lock, sidecar or generic endpoint. Both documents preserve the validator-before-producer floor, compatible rollback only with separate exact receipt, no fence clear/recreate, no historical replay and no business-outcome upgrade.
- **Acceptance matrix.** V2 adds exact duplicate and prelaunch-abandon acceptance rows and negative rows for changed valid-format preimage, other settled outcome, stale key/window, journal substitution/symlink/tombstone, capacity, UNKNOWN and unsafe purge. Existing three-handle, generation/epoch, no-sweep, validator-floor, fail-closed and business-outcome cases remain. Each changed behavior has a positive or rejecting observation target without claiming tests have already run.

**Decision boundary.** `PASS_READY_FOR_OWNER_ACCEPTANCE` means these two exact **proposed documents** are semantically compatible for an attributable Owner decision that identifies each separately. It does not perform Owner acceptance, flip V1/V2 lifecycle metadata, merge a branch, authorize the privileged producer/profile, verify installed root immutability, or permit live reads, bootstrap, restart or HR recovery. Those gates require later exact authority acceptance, implementation/security evidence and an explicit controlled-operation package. No R2 text update is required by this crosscheck.
