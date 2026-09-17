# Task 2 T2-R01 scoped re-audit

## Finding verdict

**T2-R01 — historical terminal journal quarantines a later safe preflight: ADDRESSED.** At source HEAD `2ea68163b627d1b6a1a09333fc0606eb8f275172`, recovery compares the journal unit/attempt and protected directory preflight ordinal against the current Queue execution before any terminal-gap or finalization action (`packages/deployment-control-plane/src/transaction/recovery.rs:121`). Earlier terminal executions are retained and skipped (`:127`); an unbound nonterminal journal still latches quarantine and returns RECOVERY_BINDING (`:140`). Exact-current terminal-gap quarantine remains intact (`:133`). This closes the frozen CTR-DCP-011 / ACC-DCP-009 counterexample without removing evidence or resetting budgets.

The private snapshot (`packages/deployment-control-plane/src/queue/executor_recovery.rs:6`) derives the intended mutation attempt from the existing counters and whether Applying committed after the latest Precheck. Both reads share one Queue transaction. The immediate lifecycle context confirms Precheck increments the preflight budget, Applying increments the mutation budget, and each phase plus its revisioned journal entry commits in that same transaction (`src/queue/lifecycle.rs:191`, `:208`, `:230`). Thus a crash after begin_apply but before the filesystem Applying event does not incorrectly advance the intended attempt. Queue journal entries have unique unit/revision coordinates and no deletion/update path was found in the Queue source. This is a derivation from existing durable state, not another execution counter.

## Regression and evidence checks

- Reviewed FIX_BASE `c56925a034315c414e2cc1e8f1a9c7e8947b6d11` to HEAD `2ea68163b627d1b6a1a09333fc0606eb8f275172`. The local HEAD readback matches. Accepted authority, non-production mandate, and earlier T2-B01/B02/B03 dispositions are unchanged.
- Read the installed SDD re-review template, frozen R01 finding, implementer appendix, and supplied 1,582-line diff in sequential bounded chunks. No diff regeneration, broad repeated audit, source/index/ref edit, production action, external-repository action, or subagent was used. Additional source context was confined to the directly affected risk: Queue phase/counter/journal atomicity underlying the new identity calculation, and its immediate apply/recovery ordering.
- `test/transaction_repair.rs:154` implements real child exits at the no-effect durable edge, OS-lock reacquisition, safe recovery, and fresh signed remediation. `:268` covers two crashes then a third legal preflight; `:272` covers a prior actual apply/rollback then the next no-effect preflight. Assertions check immutable unit/intent, old target bytes before the third apply, exact budgets **3/1** and **3/2**, receipt attempt, three retained journals, and byte-identical historical journal contents (`:246`, `:251`). The prior rollback journal is first snapshotted after the second recovery; source review additionally confirms historical terminal processing performs no journal write. The earlier one-crash regression remains included.
- Retained `47-current-execution-red.log` reproduces both new regression tests failing with RECOVERY_BINDING before the fix. `48-current-execution-green.log` records **3 passed, 0 failed** for the focused repair tests. The final `49-r01-affected-suite.log` records **73 passed, 0 failed, 1 filtered**: library 15, authority 12, filesystem 12, queue 25, transactions 9. The raw library run is 23.43 seconds. Worker helper entries are separate from the visible child executions; they are not counted as independent crash proofs.
- Verified those outputs against the added assertions and changed source. The affected run includes current terminal-gap quarantine, finalization projection/eligibility, lifecycle crashes, labeled failed-sync/partial-record recovery, timeout, dependency/outbox, and restored-generation tests. No compiler warning appears in the supplied output. No test rerun was necessary: no remaining concrete code doubt required an additional execution.
- The unchanged maximum-admitted-slots test was deliberately skipped in this round. Its previous 4,096-slot / 20,494-record roundtrip evidence remains the earlier run's evidence, not a fresh result at this head. This repair changes neither journal capacity nor slot admission limits.
- `r01-governance.log` reports vendored governance bytes match; `r01-fmt.log` is empty (consistent with the reported successful check, not independently an exit-status receipt). The supplied manual Rust inventory reports max **482 lines / 16 children / depth 2**, within hard limits. The existing warning-band file and three general structure baseline violations are unchanged and not reopened.

Source/test coordinates after the first full package path are relative to `packages/deployment-control-plane/`. Evidence names refer to the sibling `task-2-evidence/` directory. Reported command execution is retained implementer evidence inspected by this reviewer, not a claim of reviewer execution.

## New breakage in this fix

**None found.** Directly affected checks cover current-versus-historical identity, preflight versus committed mutation accounting, exact-current terminal-gap quarantine, unknown nonterminal failure closure, and execution-bound finalization eligibility. No new Critical or Important issue remains in this scoped diff.

## Out-of-scope observations

**None added.** Task 3 daemon/transport/Train integration and Task 4 supported profile, bootstrap and live proof obligations remain unchanged. Receipt lookup's existing legacy-name support is distinct from current-execution recovery binding; this review does not assert migration of a deployed legacy executor. Fixture fault evidence is not physical power-loss, SQLite-fsync, privileged launchd, production activation or Owner E2E evidence.

## Verdict

**Fix round: all findings addressed, no new Critical/Important breakage. Open IDs: none.**

**Scoped spec compliance: PASS. Scoped code quality: PASS**, for T2-R01 and the directly affected repair at exact source HEAD `2ea68163b627d1b6a1a09333fc0606eb8f275172`. This is not whole-branch security PASS, whole-profile completion, bootstrap readiness, Owner acceptance, merge approval or production authority.
