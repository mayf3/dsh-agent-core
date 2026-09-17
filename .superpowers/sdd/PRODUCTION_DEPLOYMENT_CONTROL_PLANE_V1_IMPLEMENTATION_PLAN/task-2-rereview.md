# Task 2 scoped re-audit

## Finding verdicts

- **T2-B01 — retained preflight journal prevents the authorized retry: ADDRESSED.** Journal names now include the Queue preflight ordinal separately from the intended mutation attempt (`packages/deployment-control-plane/src/transaction/apply.rs:49`, `src/transaction/journal.rs:95`). Receipt lookup matches the complete receipt and supports old names (`src/transaction/journal.rs:106`). The previously failing crash/recover/signed-retry sequence now retains old evidence, preserves the intent, and succeeds with preflight 2 / mutation 1 (`test/transaction_repair.rs:12`; evidence `35-repair-red.log`, `36-preflight-retry-green.log`, `46-repair-final-suite.log`). The original name collision is removed. The newly added terminal-recovery branch introduces the separate T2-R01 below.
- **T2-B02 — an admitted file count produces a journal that cannot be reopened: ADDRESSED.** Admission shares MAX_SLOTS; append and journal enumeration share `5 * MAX_SLOTS + 256`, while ordinary directories retain their 8,192-entry cap and transaction-directory creation refuses before exceeding it (`src/transaction/journal.rs:16`, `:95`, `:131`, `:175`; `src/fs/secure.rs:103`). The maximum-size real fixture installed 4,096 slots, reloaded 12,298 apply records, restored every slot, and reloaded 20,494 lifecycle records (`test/transaction_repair.rs:96`; `37-journal-bounds-green.log`, `46-repair-final-suite.log`).
- **T2-B03 — required executor fault evidence stops before rollback/finalize: ADDRESSED for the frozen non-root executor gate.** The new tests cover observed rollback/finalize/restoration journal boundaries and adjacent Queue/projection/eligibility commits, syscall-error/partial-record simulation with actual retained files, and actual owned-child timeout propagation into quarantine/recovery (`test/transaction_faults.rs:325`, `:372`, `:466`; `src/transaction/fault.rs:9`). The added finalization fence prevents public APPLIED, closure delivery/ACK, late acceptance and live-dependency eligibility before the durable Finalized proof; unrelated finalized closure remains available (`src/queue/executor_finalization.rs:5`, `src/queue/receipts.rs:141`, `test/transaction_finalization.rs:11`). This closes the stated evidence gap without asserting physical hardware, SQLite fsync, production launchd, or Task 3 daemon integration proof.

Source/test paths after the first entry are relative to `packages/deployment-control-plane/`. Evidence log names are relative to this report's sibling `task-2-evidence/` directory.

## New breakage in the fix diff

### T2-R01 — historical terminal journal quarantines a later safe preflight

- Severity: **Important**. Class: `CONTRACT_VIOLATION`.
- SOURCE: accepted CTR-DCP-011 (`docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md:255`), preserving proven no-mutation recovery and bounded same-intent preflight re-admission, plus ACC-DCP-009. This is directly introduced by the repair and affects T2-B01's new execution identities.
- Location: `packages/deployment-control-plane/src/transaction/recovery.rs:121`, particularly the unqualified `q.daemon_status(id)?.state == State::Recovering` test at line 126 and quarantine at line 128. `j.identity()`'s attempt is discarded, and the preflight ordinal is not bound to the current execution.
- COUNTEREXAMPLE: first preflight crashes after its durable Preflight event; recovery safely settles BLOCKED and retains terminal `<unit>-1-1`. Valid signed remediation requeues the same intent. Its second preflight creates `<unit>-1-2` and crashes at that same no-effect edge. Startup marks the current Queue execution RECOVERING. Sorted journal traversal encounters historical `<unit>-1-1` first and treats that terminal record as a gap in the current execution, latching quarantine. When it reaches `<unit>-1-2`, complete unchanged-target/service evidence cannot settle it because the Queue is already QUARANTINED; settlement returns `RECOVERY_BINDING`.
- IMPACT: two proven no-mutation preflight crashes exhaust the usable recovery route even though only two of three preflight attempts and zero mutation attempts have been consumed. Historical evidence incorrectly determines the current execution's disposition. The correct behavior is current-execution evidence-bound BLOCKED, preserving the remaining budget and requiring fresh signed remediation before another apply.
- MINIMAL_CLOSURE: bind terminal journal/Queue-gap handling to the current execution, including the preflight ordinal where mutation attempts alone cannot distinguish executions. Retain and ignore historical terminal journals for current recovery decisions; do not delete them or weaken genuine current terminal-gap quarantine. Add the focused first crash -> safe recovery -> signed retry -> second no-effect crash -> safe recovery -> signed retry/third preflight regression, checking immutable intent, both retained journals, unchanged target and exact budgets. Include the analogous earlier rolled-back mutation/current execution distinction in the binding logic.

Focused observed result, disposable non-root fixture only:

```text
compile 0
child 1: Some(75)
crash 1: None; state=Blocked; preflights=1; mutations=0
child 2: Some(75)
crash 2: Some("RECOVERY_BINDING"); state=Quarantined; preflights=2; mutations=0
CONFIRMED T2-R01: safe second preflight is quarantined by retained earlier terminal journal
result 0
```

The harness used the existing fixture setup and trusted fixture signing helper, invoked the existing `transaction::crashes::crash_worker` twice with `DCP_TEST_CRASH_EDGE=1`, recovered under the actual OS guard, and asserted unchanged `old code` bytes. No production labels, paths or processes were used. It was compiled from stdin into a disposable temporary directory and linked to the existing candidate library; no Cargo rebuild or source modification occurred. Two earlier harness attempts accidentally substituted the word ROOT inside the test environment-variable name and therefore ran a no-op worker; those attempts are not product evidence. One direct worker-coordinate check confirmed the environment handling, then the corrected harness produced the output above. Temporary harness/fixture files were removed by their owning temporary-directory cleanup.

Reproduction artifact coordinates (local compiled artifacts, not a fresh source rebuild):

- `target/debug/deps/libdeployment_control_plane-41279b0845ffce9a.rlib`: SHA-256 `e53a43dca353349fce9c5e98c8d432c2b6d643665f0c9c3efa311c1d33680054`.
- `target/debug/deps/deployment_control_plane-f5a61e6e2546900c`: SHA-256 `7dc2ee5754da1e5e872bc72435ea64e679c4cc0bc4084f8b4452ea707ed1cf0b`.
- The deterministic control flow at the reviewed source head independently establishes the same counterexample; the focused execution supplements it.

## Evidence and scope checks

- FIX_BASE `8b19bc5f2a5dac98af4fa78a78775e77b62d9d57`; reviewed HEAD `c56925a034315c414e2cc1e8f1a9c7e8947b6d11`. Accepted authority and the non-production mandate are unchanged. Followed the installed SDD scoped re-review template and the frozen initial report.
- Read the supplied 5,226-line fix package sequentially. All source/test hunks and the final suite output were readable. One chunk of repetitive intermediate historical test output was tool-truncated; it is not used as final-pass evidence. No Git diff regeneration or broad source re-review.
- The complete retained `46-repair-final-suite.log` shows **72 passed, 0 failed**: library 14, authority 12, filesystem 12, queue 25, transactions 9. It includes the maximum-slot round trip, 25 additional lifecycle crash boundaries, 58 labeled fsync/partial-record cases, and restored-A/dependency/outbox regressions. Parent helper no-op entries are separate from the visible real worker invocations. No full-suite rerun was performed by this reviewer.
- `44-repair-final-suite.log` retains the intermediate PRODUCER_CAS failure. The final fixture uses a distinct independent Goal (`test/transaction_finalization.rs:102`); focused `45-projection-fixture-green.log` and complete `46-repair-final-suite.log` pass. The production CAS check was not relaxed.
- Finalization source review covered its per-unit fence, actor/idempotency projection, dependency/Goal/outbox gating, exact immutable receipt proof, and explicit host-quarantine retention (`src/queue/executor_finalization.rs:16`, `src/transaction/journal.rs:154`, `src/transaction/recovery.rs:224`). No additional new blocker was found in those paths apart from T2-R01's terminal-history binding.
- Named focused context check: the new terminal-history branch versus current-attempt Queue recovery. Read its immediate lines and fixture helper imports to construct the bounded counterexample; source-location searches supplied citations. No external repository or production reads/actions were needed.
- Manual Rust evidence reports 482 maximum physical lines, 16 immediate children and depth 2. The new 482-line fault test is below the hard limit but in the existing warning band; no anti-evasion pattern was identified. The three reported general structure baseline violations remain unchanged and are not reopened.

## Out-of-scope observations

No new unrelated issue is added. The original source profile exclusions and Task 3/4 live/bootstrap verification obligations remain unchanged. The finalization README's raw daemon readback versus actionable actor projection distinction remains a Task 3 integration obligation. This review grants no whole-profile completion, whole-branch security PASS, bootstrap readiness, Owner acceptance or production authority.

## Verdict

**Fix round: findings remain open — T2-R01.** T2-B01, T2-B02 and T2-B03 are addressed; the repair-introduced current-execution binding regression requires the minimal correction above. Spec compliance and code-quality disposition remain **NEEDS FIXES** at this exact head.
