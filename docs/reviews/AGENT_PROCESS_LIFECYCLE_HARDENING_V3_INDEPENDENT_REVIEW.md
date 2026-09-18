# AGENT_PROCESS_LIFECYCLE_HARDENING_V3 — Independent Semantic Review

```text
REVIEW_KIND = SPEC
BASE_HEAD = 3c7b169a864c1e45df8b5c67333a9478138a22ee
FINAL_REVIEW_TARGET_HEAD = f4e9c3a6c55cea4b96d25ee08ad86dcecef2a5a3
FINAL_SPEC_SHA256 = 7ca0c454de9cc8f699909f91c29363d98006ec52b498175427cf7575c1a74395
REVIEWER = /root/outcome_unknown_v3_review
AUTHOR_INDEPENDENCE = PASS
FINAL_EXACT_SHA_VERDICT = PASS
BLOCKERS = NONE
DOCS_ONLY_BOUNDARY = PASS
MERGE_READY = YES
```

## Review scope

The reviewer independently inspected the exact candidate against accepted
`AGENT_PROCESS_LIFECYCLE_HARDENING_V2`, repository governance, fresh Router
source/tests and the companion investigation. Review covered:

- whole-successor completeness and authority lifecycle;
- exact late-evidence settlement without a new prompt;
- exact-turn idle termination-only evidence and negative controls;
- hard-deadline clock authority, exact-generation REAP and real-exit ordering;
- durable restart/fence state without PID-derived ownership;
- concurrent/duplicate recovery and stale-generation isolation;
- startup admission barrier;
- closed structured outer diagnostics;
- zero prompt/answer/side-effect/rejected-request replay;
- acceptance coverage and docs-only boundary.

## Frozen blocker union and closure

Initial review of `07c7e3f1c94901b8c4e9dc01343e5b18265875d1`
returned `REVISE` with B1–B6:

1. durable hard deadline lacked safe clock semantics;
2. late evidence after claim could still trigger shutdown;
3. outer recovery diagnostics were not a closed executable contract;
4. restart tests did not prove the startup admission barrier;
5. the no-replay row used non-exact placeholders;
6. operational recovery/replay claims lacked a coordinate-bound receipt.

Re-audit of `279d2a3d88160405afa8bd474a91c94aeee0fd29`
confirmed B1–B6 closed and identified one reachable repair-introduced blocker:

7. new `exact_started_then_idle` semantics were not declared across the full
   authority surface and lacked five negative controls.

Final targeted re-audit of the immutable exact candidate
`f4e9c3a6c55cea4b96d25ee08ad86dcecef2a5a3` confirmed:

```text
B1-B6 = CLOSED; NO REGRESSION
B7_DELTA_DECLARATION = CLOSED
B7_TERMINATION_EVIDENCE_UNIONS = CLOSED
B7_POSITIVE_ORACLE = CLOSED
B7_NEGATIVE_CONTROLS = CLOSED
NEW_VALID_BLOCKERS = NONE
FOLLOW_UP_DEBT = NONE
FINAL_EXACT_SHA_VERDICT = PASS
```

The five B7 negative controls independently prove that missing receipt,
pre-start idle, later start, stream gap/loss and one-active-turn violation stay
pending/fenced with zero kill.

## Verification readback

```text
GOVERNANCE_INTEGRITY = PASS
DIFF_CHECK = PASS
FOCUSED_EXISTING_PROCESS_LIFECYCLE_TESTS = 22/22 PASS
PRODUCT_CODE_CHANGED = NO
PRODUCTION_MUTATION_PERFORMED = NO
```

The focused tests exercise existing V2 implementation behavior. The V3 tests
in the acceptance plan are definitions for a later authorized implementation;
they were not executed and are not represented as implementation evidence.

## Disposition

The proposed Spec is independently review-complete and may be presented to the
Owner for exact-head acceptance. This review does not accept the Spec, mutate
V2, authorize implementation, merge, deploy, restart or perform production
recovery.
