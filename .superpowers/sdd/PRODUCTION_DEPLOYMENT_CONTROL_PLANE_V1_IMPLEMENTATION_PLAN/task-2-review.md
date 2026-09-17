# Task 2 independent review

Spec compliance: **ISSUES FOUND**. Code quality: **NEEDS FIXES**.

`FROZEN_BLOCKER_UNION = [T2-B01, T2-B02, T2-B03]`.

## Coordinates and mandate

- Review target: `8b19bc5f2a5dac98af4fa78a78775e77b62d9d57`.
- Integration/task base: `14090ca2c89cccb9d0962602e88a15535b014a4f`.
- Accepted authority: `docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md`, accepted base `bb5327f622a0333f1e11d945319e024a3731f05a`, Owner-accepted semantics `39865536ce51005f95a98473e77c2329078512c0`.
- Independent reviewer did not author the candidate. Task-scoped affected-contract review; no Owner acceptance, whole-branch security PASS, bootstrap readiness, or production conformance is asserted.
- Review preflight: REUSE / IMPLEMENTATION review / EXEC_PLAN / CONTROLLED; accepted Contracts remain unchanged. Authorized effect is this review report only. No source/index/ref changes, production writes, service operations, or subagents.

## Strengths

- Descriptor-relative traversal, same-FD double read, file-type/link/ACL rejection and atomic slot replacement are substantive implementations, with actual adversarial filesystem tests (`src/fs/secure.rs:37`, `src/fs/file.rs:38`, `src/fs/target.rs:49`, `test/filesystem.rs:144`). Paths in this report are relative to `packages/deployment-control-plane/` unless explicitly stated otherwise.
- The permanent flock descriptor is retained by the external Train guard and tied to the executor root; apply borrows it, and wrong-root guards reject before a queue transition (`src/fs/mutex.rs:12`, `src/transaction/apply.rs:23`, `test/transactions.rs:117`).
- Rollback checks complete known file identity, preserves captured metadata, and deletes an ABSENT slot only after matching the transaction postimage (`src/fs/target.rs:54`, `src/transaction/recovery.rs:43`).
- The restored-installation projection preserves historical receipts and requires fresh physical-generation binding for late verification; the test exercises restored A, failed B, stale Goal rejection, live dependency freshness, late coverage, and no duplicate closure (`src/queue/physical.rs:7`, `src/queue/receipts.rs:92`, `test/restored_generation.rs:31`).
- Native service operations use fixed launchctl argv, cleared environment, bounded owned children, process birth/argv evidence, and a pre-bootout exit watch; fixture service events are explicitly distinct (`src/transaction/native.rs:193`, `src/transaction/process.rs:80`, `src/transaction/service.rs:46`). This is source evidence, not executed production proof.

## Frozen blockers

### T2-B01 — retained preflight journal prevents the authorized retry

- Severity: Important. Class: `CONTRACT_VIOLATION`.
- SOURCE: accepted CTR-DCP-011 (`docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md:255`): proven BLOCKED(NO_MUTATION) may return through fresh machine-verifiable remediation, with up to three preflight attempts; historical attempt evidence remains immutable. ACC-DCP-009 requires verified bounded re-admission.
- Location: `src/transaction/apply.rs:46`, `src/transaction/journal.rs:92`, `src/transaction/recovery.rs:138`.
- COUNTEREXAMPLE: crash immediately after the first durable Preflight event, before `begin_apply`. The existing executed edge-1 test proves recovery settles BLOCKED with no target write (`test/transaction_crashes.rs:92`; `task-2-evidence/final-tests.log`, edge 1). Queue mutating attempts remain zero, but the terminal journal named `<unit>-1` is retained. After valid signed remediation and `Queue::retry`, the next apply again computes `mutating_attempts + 1 == 1`, and `Journal::create` rejects that existing name with `TRANSACTION_EXISTS`. The test stops at BLOCKED and never exercises this next authorized apply.
- IMPACT: a proven safe prewrite crash permanently prevents the same intent from making its first mutation despite remaining preflight budget. Repeating requests or fresh policy cannot repair the collision; deleting the old journal would violate evidence retention.
- MINIMAL_CLOSURE: give preflight executions distinct durable identities while preserving the daemon's existing mutation-attempt budget and receipt correlation. Retain prior journals. Add one focused crash-after-Preflight -> recovery -> signed remediation -> successful fresh apply test, checking retained earlier evidence and unchanged intent/budgets. Do not solve this by allocating a new caller intent or removing historical records.

### T2-B02 — an admitted file count produces a journal that cannot be reopened

- Severity: Important. Class: `CONTRACT_VIOLATION`.
- SOURCE: accepted CTR-DCP-011 durable startup readback and CTR-DCP-020 finite resource bounds / retained usable transaction evidence (`docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md:255`, `:400`).
- Location: `src/fs/artifact.rs:42`, `src/transaction/apply.rs:169`, `src/fs/secure.rs:131`, `src/transaction/journal.rs:108`.
- COUNTEREXAMPLE: a valid manifest containing 3,000 distinct short-named, tiny regular files is below the admitted 4,096-file, 64 MiB aggregate and 1 MiB manifest bounds. The successful install writes at least 9,000 journal files: SlotIntent, Prepared and Installed for each slot, plus service/phase records. `Journal::append` allows 20,000 events, but `Journal::load` calls `Dir::names`, which unconditionally fails above 8,192 entries. Thus an otherwise successful release cannot reload its own journal for the next baseline verification or startup recovery. No adversarial race or large bytes are needed.
- IMPACT: accepted input can leave a successful installation whose authoritative journal is unreadable by this implementation; subsequent deployment refuses, and startup recovery latches host quarantine. The resource limits do not compose across writer and reader.
- MINIMAL_CLOSURE: align admission, append, directory-enumeration and rollback/finalization record bounds so every admitted transaction is readable throughout its permitted lifecycle. Account for both success and rollback records rather than raising only one constant. Add a focused boundary test that creates an admissible multi-slot transaction and reloads/finalizes or recovers its actual retained journal; a cheaper derived-bound unit check may supplement, not substitute for, a real journal round trip.

### T2-B03 — required executor fault evidence stops before rollback/finalize

- Severity: Important. Class: `REQUIRED_GATE_FAILURE`.
- SOURCE: accepted ACC-DCP-009 (`docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md:446`) requires kill-at-every-durable-edge plus disk/fsync/hung-action faults for CTR-DCP-010/011/020. Task 2's valid bounded mandate explicitly assigns failure injection at each durable edge, restart timeout and rollback drift (`task-2-brief.md:33`).
- Location: `test/transaction_crashes.rs:49`, `:117`; `src/transaction/recovery.rs:77`, `:101`, `:207`; `task-2-report.md:194`, `:208`.
- COUNTEREXAMPLE / missing observation: the crash enumerator obtains its edge count immediately after apply returns VERIFYING; the storage loop hardcodes those same 13 apply edges. Neither executes the rollback/finalize boundaries, including restored-installation projection commit, RolledBack journal/queue ordering, or APPLIED before Finalized persistence. The storage injection chmods the journal directory before creating a record, proving EACCES; it does not exercise failed fsync or partial-record persistence. The retained `/bin/sleep` timeout test establishes child kill/join in isolation, not transaction timeout disposition and recovery. The report accurately discloses these narrower observations; this is not false evidence.
- IMPACT: the required Task 2 failure gate remains open precisely at boundaries that span filesystem journal, Queue state, current physical installation and closure eligibility. The 64 passing tests do not establish the prescribed safe recovery behavior for these cases.
- MINIMAL_CLOSURE: execute bounded non-root fixtures for the affected rollback/finalize durable boundaries, error-at-fsync/partial-record persistence, and owned-action timeout propagation into transaction disposition/recovery. Assert actual retained records, target bytes/metadata, service-child termination or explicit unknown quarantine, Queue/physical binding, no replay and budget preservation. Clearly labeled test-only fault injection is sufficient for syscall/error semantics; physical full-disk damage, root launchctl mutation and production crashes are neither required nor authorized. Task 3 daemon/socket process integration remains separate.

## Scope assessment and later verification limits

- Supported Task 2 source slice is app-relative regular-file replacement/addition under the compiled dsh app root with existing protected parents, plus Runtime/W1/W2 lifecycle handling. The target resolver explicitly refuses missing parents (`src/fs/target.rs:23`); native construction binds an enrolled protected profile and requires root-code review (`src/transaction/mod.rs:49`).
- CTR-DCP-005/008/012/013 do not require an app-only transaction to invent changes to unrelated config, routing, plist, Node, harness, incident data, auth-service or svc-workflow. This slice can be assessed as a bounded executor, but does not complete those profile facets. Under accepted section 5 (`docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md:410`), disabled profiles are not a waiver for missing functionality.
- Task 4 must bind an exact release/profile whose complete required face fits this slice, enumerate the full manifest and metadata, preserve config/model overrides, and explicitly resolve W2 root-code closure. A release needing a new parent directory, typed routing/config write, plist/Node/harness replacement, or separately authorized incident migration cannot be enabled using this executor as-is. The Watchdog family table's typed-routing and role requirements remain outstanding if that family is adopted (`docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md:420`). The report's exclusions do not silently satisfy them.
- Task 3 must authenticate activation and Catalog, bind trusted clock/caller/peer credentials, protect Queue opening, and retain the same guard across accepted Goal verification through finalize/rollback. Library constructors and borrowed guards alone do not prove the running daemon does so (`src/transaction/mod.rs:47`, `src/transaction/apply.rs:11`, package `README.md:200`).
- Real native launchd behavior, root process census accessibility, interpreter/library closure, current numeric identities/ACLs, canonical `/var` alias, target lifecycle-denial and legacy-writer retirement remain M/P integration or separately authorized bootstrap gates. Neither fixtures nor this review establish them. The current source only checks fixed Node/plist dependencies during service image readback (`src/transaction/native.rs:166`).
- Actual Goal verifier execution, outer Train scheduling, redacted export and closure delivery belong to Task 3; the changed receipt/projection APIs were reviewed only for their Task 2 affected behavior. All 20 Contracts and 14 acceptance rows remain binding at their applicable later boundaries.

## Review method and evidence

- Read the supplied 6,672-line package sequentially in bounded chunks. Earlier historical RED/GREEN log chunks were tool-truncated; the complete final suite and all source/test hunks were readable. Did not regenerate a Git diff or rerun the suite. Source-location searches after the pass supplied exact citations only.
- Retained final evidence reports 64 passed / 0 failed, no compiler warnings. Two helper tests return immediately without worker environment, and the real child invocations are separately visible. Earlier warning/failure logs are development history, not final PASS output (`task-2-report.md:172`, `task-2-evidence/final-tests.log`).
- No additional counterexample tests were run: B01 follows the already executed crash disposition plus the deterministic next journal name; B02 follows the admitted bounds and deterministic event count. The repair tests above should make those rejecting examples durable.
- Named outside-diff context checks: queue retry/attempt allocation and dependency semantics (diff context did not include complete functions); inspected `src/queue/lifecycle.rs:27`, `src/queue/dependencies.rs:1`, model dependency enum, and existing dependency tests. The suspected HistoricalReceipt regression was rejected: admission already refuses that reserved mode (`src/queue/admission.rs:157`, `test/queue_repairs.rs:252`).
- Named native risk check: whether the fixed parent launch/stop interface alone established descendant exit. Read only the thin runtime launcher, resident entry and focused lifecycle/plist snippets. They do not provide a concrete new reachable counterexample here; complete native generation/lifecycle evidence remains the later integration limit above. One guessed runtime.js path did not exist; no broad repository crawl followed.
- Structure assessment: new files are at most 346 physical lines; retained manual inventory reports at most 13 directory children and depth 2. Reviewed source shows ordinary responsibility-based modules, no dense-statement/copy-split/barrel evasion. Rust is outside the general structure verifier; no unrelated baseline debt was reopened (`task-2-evidence/rust-structure.json`).

## Assessment

Task quality: **NEEDS FIXES** for T2-B01/T2-B02 and closure of the bounded T2-B03 evidence gate. Repair this frozen union, then re-audit the exact repair head and directly affected contracts. This report performs no Owner acceptance or production authorization.
