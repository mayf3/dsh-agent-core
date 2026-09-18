# Independent security review: first-target adoption and Watchdog observer

REVIEW_RESULT=BLOCKED
FROZEN_SOURCE_BLOCKER_UNION=AB-01
REVIEW_TARGET_HEAD=ac8193ed5219c846007aaebd3e371db751653c1e
REVIEW_TARGET_TREE=fe95dbf20de6b9f24761707b3b79b59f21a6e1e3
SEMANTIC_SOURCE_HEAD=2d74fa351c79dd0564c158341a0d5f5033fb1435
BASE_HEAD=e8f863fdb5d3b95dc45cd202acee5c1c69124551
GOVERNING_DESIGN=f88fb71ea79e8795260056758f333e93447460e6
AUTHORITY_ACTION=REUSE
SPEC_AMENDMENT_REQUIRED=NO_FOR_THIS_REPAIR
PRODUCTION_MUTATION_PERFORMED=NO
PRIVILEGED_OPERATION_PERFORMED=NO
FIRST_REAL_AUTOMATIC_DEPLOYMENT_COMPLETE=NO

The reviewer did not author this semantic delta. Scope is the typed attempt-0 observed baseline, durable publication and activation fences, exact executed-predecessor proof for later read-only acceptance, restoration/origin, native runtime identity including the fixed catchup-zero option, and the fixed native Watchdog current-observation reader. The accepted authority remains PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1 at `39865536ce51005f95a98473e77c2329078512c0`; the adopted-baseline operation contract and companion first-live canary operation design explain the producer/consumer boundary. The separate lifecycle/materializer operator is not included in this source verdict. Later author commit `dc55d21ba77174c48da5e88b6bd03e2e14d4888e` adds only evidence documents and does not alter the reviewed source.

## Frozen source finding

### AB-01 — persist observed UNKNOWN before the unrelated event read

Classification: implementation security/logic blocker, directly affected CTR-DCP-011/014 and frozen design unknown-capture obligations. Source: `packages/deployment-control-plane/src/verification/native.rs:307–319` at the exact reviewed head.

`finish` first receives the authenticated exact-job history response, then reads protected `runs.jsonl` with `?`, and only afterwards validates and handles `outcome_unknown`. If that response already contains the sole exact canary run with `outcome_unknown`, a metadata, size or read failure in the event file returns before either immutable `unknown.json` or Queue quarantine is written. The next invocation therefore has no retained fact that this operation observed UNKNOWN.

Concrete reachable counterexample: a permitted canary is unknown; its authenticated history response succeeds; `runs.jsonl` is temporarily unreadable or exceeds the protected reader's bound; `finish` fails at line 308 without retaining unknown. The owning Scheduler may subsequently perform a trusted late settlement. This is supported by actual source `d602b592fad345fb1c9adebe2bc6611a6f5cfdc2`: `history/history.js:278–297` appends `late_settlement`, and `history/history-projection.js:76–85` promotes the projected state and clears its fence. A later capture read may consequently see succeeded. Such owning-system reconciliation does not authorize this deployment observation operation to discard its previously observed UNKNOWN. The frozen design explicitly retains that unknown and prohibits replacement PASS. The author independently confirmed this ordering and reachability; this review did not provoke a live unknown or modify a runtime file.

Minimal closure: parse the authenticated history response and validate its exact single-job identity immediately after receipt, then durably retain UNKNOWN and latch quarantine before attempting any unrelated event-file read. Keep the event reader fixed and all successful-capture generation, routing, timing, raw-byte and semantic checks unchanged. Add a regression through the actual internal helper: exact UNKNOWN plus an event-read closure that would fail must never invoke the closure; immutable unknown and quarantine must survive Queue reopen; a later succeeded response must not replace the retained unknown. Include malformed/wrong-job negatives so unrelated evidence cannot poison this operation. No generic retry, reconciliation or I/O API is needed.

This is the complete currently identified source-blocker union for this frozen review. The previously examined HistoricalReceipt compatibility suspicion was withdrawn after comparison with the base: admission already rejects that mode. It is not a finding or a requested change. Closed R02 and the login-helper review are not reopened.

## Other scoped conclusions

- Baseline receipts truthfully record `ObservedExistingInstallation`, attempt 0 and zero install/restart counts. Their private proof constructors bind Authority grant, exact reviewed Proposal, current native enrollment, complete face and service generation. There is no public arbitrary receipt import or fabricated old apply transaction.
- Reservation, immutable proposal pin, physical observation, typed receipt publication and finalization preserve the pending standing-activation disposition. Ordinary startup also checks the configured adoption operation, so absence of a Queue reservation is not permission to run. Separate private activation proof requires baseline, actual current canary evidence, genuine required Goal PASS, Authority standing grant and current physical readback under the held permanent guard. The parent must still implement and review the trusted materializer/receipt producer; protected ownership alone is not proof of lifecycle execution.
- The pre-effect predecessor record pins B's actual same-target installed predecessor, exact live dependency and signed required PASS outcomes before B effects. Later acceptance can use the private proof only for current finalized B with its own journal/receipt and retained required facet. New mutations, retries, issuance and cross-target dependencies retain current dependency requirements. Missing/tampered proof, incomplete/unknown/rolled-back B and changed facet reject. No HistoricalReceipt widening was found.
- Typed installation readers preserve legacy serialized behavior and adopted origin. Restoration records an actual new service generation rather than reusing the old semantic PASS. Existing unit-local recovery isolation and global fail-closed gates remain in the directly exercised paths.
- Native identity uses the exact fixed optional `--catchup 0` suffix; omitted legacy configuration remains byte compatible. Periodic W1/W2 PID/run changes are not mistaken for the continuous Runtime service generation. Root observation uses fixed Rust readers and authenticated local read-only endpoints, not mutable candidate JS/Python/shell execution.
- The Watchdog evaluator binds raw documents, exact canary plan/creator/store chain, actual Router admission, durable no-effect result, before/after and current full face/service identity, routing/migration, incident and job invariants, and fresh W1/W2 observations. Old source-equal semantic receipts without contemporaneous generation correlation remain insufficient. The AB-01 ordering gap prevents an overall PASS despite these successful checks.

## Independently executed evidence

All commands used the author's worktree and `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml --locked`. These were ordinary fixture executions, with no root, real endpoint, credential, service or canary invocation:

| Selected test command suffix | Top-level result |
|---|---|
| `--lib adoption -- --nocapture` | 4 passed, including crash-edge and activation checks |
| `--lib adopted_ -- --nocapture` | 7 passed; overlaps one test above |
| `--lib verification:: -- --nocapture` | 47 passed |
| `--lib executed_predecessor -- --nocapture` | 3 passed |
| `--lib startup_tests -- --nocapture` | 2 passed |
| `r02_ -- --nocapture` | 8 passed |
| `--test queue -- --nocapture` | 30 passed |

Every listed command exited zero. Nested crash-worker subprocess result lines are not additional top-level cases. The existing suite does not cover AB-01's combined response/read-failure ordering, so these results do not close it. Source inspection and upstream settlement implementation establish the finding; the repair's new executed RED/GREEN regression remains required.

Independently verified that `ac8193e` differs from semantic `2d74fa3` only by eleven identical test-file moves and eleven test-module path strings. Recomputed the inert release `agent-deployd` SHA256 as `0469572e9f0d7741c448b74a020b0e279362b3d94a726a1205359a0356ae45a5`. This is an uninstalled build, not an authorized package.

Author evidence separately reports the full locked suite at `2d74fa3`: 336 top-level passed, zero failed, two existing manual probes ignored; log SHA256 `80f6e89f07eb1453fc05f5d3d7fc9955a4b48746e6f1eb21b4d8c4cd0979ea3d`. Final `ac8193e` fmt, strict all-target Clippy and release succeeded, with observer tests rerun after relocation. Those full/build results are attributed to the author and their exact source coordinates, not claimed as another independent full-suite execution. Structure has three unchanged baseline directory violations; the Rust-aware manual check reports no new/grown over-limit surface. No global structure PASS is claimed.

## Operation boundary and remaining conditions

This review has not read protected key/auth content, run root code, queried production endpoints, installed anything or changed service state. It does not assert issuer readiness, actual Review PASS for the business payload, current Watchdog semantic PASS, protected target ownership, enrollment of the two prospective children, or production activation.

The actual Scheduler directory has ordinary metadata evidence for UID505:GID601 mode0700. That does not prove contained `jobs.json`/`runs.jsonl` metadata or sizes. The reader's runtime primary-group binding matches the existing postdeploy helper's contract, while incidents use their separately bound group; actual file metadata and the fixed read bounds still need exact authorized preread evidence. Do not guess protected contents or weaken the binding without new evidence.

The separate parent materializer/lifecycle/canary design rereview now records design-level closure of FM-01/02/03; actual implementation, tests and independent exact-source/package review remain required. Authentic dedicated login reconciliation, current protected closure/loader and legacy-writer/denial proofs, isolated issuer build/review, genuine generation-bound Watchdog canary/PASS, exact Owner grant, conditional activation and the first real Broker delivery remain operation gates. This report neither repeats historical design findings as still-open source findings nor collapses those real gates into this source review. Parent Goal completion remains separate.
