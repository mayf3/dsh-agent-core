# EKR PRE R3 — Independent evidence review of G6–G8

STATUS = PASS_FOR_BOUNDED_SOURCE_PREFLIGHT_EVIDENCE

This is an independent review of the six exact artifacts below. It approves the fidelity and boundaries of the source/in-memory preflight evidence; it is not product conformance, real storage/process restart, production, business acceptance, or merge approval. The reviewer authored G2–G4, not these G6–G8 artifacts.

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = AFFECTED_CONTRACT
REVIEW_TARGET_HEAD = eb8fd18934d827cec98faacaef987869c5cb92e7
BASE_HEAD = eb8fd18934d827cec98faacaef987869c5cb92e7
CURRENT_BASE_HEAD = eb8fd18934d827cec98faacaef987869c5cb92e7
REVIEWER_ID = /root/b1_b3
AUTHOR_ID = /root/p1_inventory; /root/schedule_inventory
AUTHOR_INDEPENDENCE = PASS
ASSURANCE_LEVEL = ROUTINE
REVIEW_SCOPE = FULL
FULL_REVIEW_BASIS = INITIAL_REVIEW
SCOPE_REASON = complete review of the bounded six report/harness/raw artifacts, not the whole product
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = NOT_APPLICABLE
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
BASE_IMPACT = NONE
BLOCKERS = 0
SPEC_GAPS = 0
FOLLOW_UPS = 0
TOOLING_DEBT = 0
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NOT_APPLICABLE
OPERATION_ALLOWED = NO
NEXT_ACTION = STOP
```

The Head fields bind the existing isolated `ac-ekr-preflight` parent; the reports were uncommitted when reviewed and are bound by SHA-256 below. They are not a fresh remote-main or accepted-final-Head assertion. The primary agent owns later report integration and final-Head mechanical recheck. Current WAE/WEC/Owner/Scheduler contract semantics are preserved; no source or authority acceptance is performed by this review.

Reviewed at UTC: 2026-11-04T16:15:57.698183+00:00

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `G6-G7-R3.md` | 48051 | `db4b286529e4d289132b4d4d4c8dfaddd033e51959166b490898ae8c93f36daa` |
| `g6-g7-harness.py` | 15362 | `d9e9bdbdd40efce31c8c0d244d906c05e324722b1e1fdf4377a11321ff2010d4` |
| `g6-g7.raw.txt` | 120723 | `f16e67a3b4a3beb0313d13a361d308793ccbdf1482e45b48a13ca1d80d102dbe` |
| `G8-R3.md` | 19470 | `b48569fdb6e2f814895cde5828ebda65c611354e80ccf0175be69ab286e073d9` |
| `g8-harness.py` | 7748 | `6a3c16fb7e6a04bad2f8dc6b48dbeed02e3ff11df04661785a3233b43b20403e` |
| `g8.raw.txt` | 1872 | `6b70a306436e639d166bb57f229da082eea1c105879135925ca1ec4508cf474b` |

## Checks and results

1. Read the G8 report, harness and raw in full. Independently read exact M/D archived Scheduler startup/tick/sweep and occurrence-state definitions. Both `scheduler.js` files hash to `778a8ebc2e67284dbd771c522359dd04150b3c892d03ffe36aa4dbb73b8f3943`, matching raw. Actual startup always calls `_sweepUnresolved`; its transition and fence rebuild match the raw five-state result. Unknown→admitted is absent from both state machines. The harness asserts the one normal admission, no same-slot replay, no extra second-engine invocation and post-stop no invocation. The report explicitly says memory document reconstruction, every-only schedules, stub lease/history, no JobStore/fsync/process crash/Router/DB/production proof. Its two raw `NODE_RC=0` records agree with the executed claims. The term PASS is bounded to those mechanisms.

2. Read the stable G6/G7 harness and complete append-only raw history. The first 25 failure candidates consume the real engine poll budget; the tail returns `already_attempted` and is only a discovery sentinel. The final report explicitly withdraws any reading of old `healthyTailReached` as successful healthy admission. A control reaches all 26 candidates but does not demonstrate a successful 26th admission. Core wake settled-with-failed-payload returns reused acknowledgement as raw states; neither report nor harness upgrades that acknowledgement to Svc obligation completion.

3. Check all raw G7 inventory rows against the report table: the union has exactly 119 unique capability.operation names; the report has the same 119, no omission, extra or duplicate. M raw has 119 operations / 69 capabilities; D has 110 / 65. Generic transport key flags are not reported as stable business operation identity or certified idempotency. Every write classification is explicitly a candidate/UNCERTIFIED or outside the effect classes, with response-loss correlation gaps retained. Native shell/file/MCP/custom/runtime allowlists remain outside this bounded inventory and UNKNOWN. `scheduler.runs` was correctly changed to READ_ONLY after source confirmation.

4. The managed guard scenarios use the actual Core guard/mapping with Svc responses supplied by a memory stub. The final report correctly records one POST on prior-success replay, does not count it as zero real external effects, and explicitly states `callCase` fixtures are independent rather than one continuous persisted response-loss/restart scenario. Svc DB effect/receipt atomicity, real dedupe, concurrent claims and actual effects remain UNKNOWN. D's missing managed guard is not filled with M capability. WAE attempt generation, Router processGeneration and runtimeEpoch stay distinct.

5. Review only the appended Svc state-table delta after the original G6/G7 evidence was reviewed. Independently read S=`59daec042786f0416a6a9061c0b638ba56c0d83e` schema 0031 intent/effect enums and immutable-state trigger, Assistance enum, `main.rs:49–64` producer and `forum_sync.rs` claim/delivery/retry branches. The appendix accounts for all 7 intent, 5 effect and 4 Assistance states, including intent UNKNOWN. It separates computed managed/review labels and outbox flag predicates from durable business-state enums. The 2s producer is correctly restricted to PENDING materialization; migration line 100 rejects UNKNOWN/BLOCKED_KNOWN/MATERIALIZED→PENDING. A search in archived owner_obligation Rust for UNKNOWN did not establish an automatic UNKNOWN recovery consumer; the appendix retains UNKNOWN instead of claiming external consumers cannot exist. Outbox retry/delivery acknowledgement remains separate from business/human-answer closure. No new dynamic test was claimed for this static appendix.

## Evidence corrections found and closed

- **D pre-plan case misattribution:** D `engine.js:164–177` has no `pre_plan_unavailable` result branch. The old fixture returned that cause without an attempt; D read `attemptId`, threw, and the poll caught `engine_error`. Raw line 70 therefore cannot verify a real D pre-plan path. The author withdrew that interpretation in the table and paragraph, retained the original raw line, and made the final harness omit this unsupported exact-version mode. D fairness evidence uses the explicit throw case (raw 71), control (72), and source budget logic. Existing old matrix wording must be read with the R3 correction carried into the final integration. This correction closes a report interpretation error without modifying product source or erasing history.
- **Svc fixture continuity boundary:** the report now states each managed response branch is an independent fixture; prior-success POST/readback does not prove actual service response-loss durability or no duplicate business effect.
- **Read-only tool classification:** `scheduler.runs` is READ_ONLY; the earlier candidate label is corrected.

The G6/G7 raw history intentionally contains explained harness failures: bare-module linker path, missing synthetic literal export, and D transport layout lookup. The report records them, their child return codes and targeted repairs; it does not assert zero failed commands. These are explained harness/path issues under the R3 stop ruling, not an unexplained product-source assertion failure. Passed unaffected observations are reused rather than broadly rerun. The final wrapper's version-aware skip and path fixes were reviewed as bounded harness deltas; this reviewer did not rerun the full test groups.

Reviewer exploration noise: attempting to read the G6/G7 report before the author created it returned file-not-found; an initial compact raw parser expected `tailSentinelReached` but encountered the preserved old `healthyTailReached` field and raised KeyError. The parser was corrected to read either historical shape. Neither error was a product assertion or missing dependent product data, and both were kept distinct from executed source evidence.

This review writes only this file. No author artifact, source, accepted Contract, product state, service, DB, live tree, Git ref, external message or UNKNOWN request was mutated by the reviewer. Publication of the bounded preflight report remains within the user's existing R3 mandate; product implementation, deployment, merge and business acceptance remain outside this review.
