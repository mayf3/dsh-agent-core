# Task 3 scoped repair re-audit

## Spec compliance

**PASS for the scoped Task 3 repair. T3-B01: ADDRESSED. T3-B02: ADDRESSED. Open blocker IDs: none.**

**Code quality: Approved.** The repairs close the reproduced durable-publication and lost-verification-work failures without changing accepted verifier authority, mutation ownership, receipt binding or unknown-outcome semantics. No new concrete blocking breakage was found in this fix.

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = AFFECTED_CONTRACT
REPOSITORY = mayf3/dsh-agent-core
FIX_BASE = 4c9d3654e1296538d05d349020f1877e63669a2e
REVIEW_TARGET_HEAD = b01e8d4872011233ecf4fe2ac7103f23554a7e26
SOURCE_HEAD = 0c4ec56f518394557042445dfd796e439797774f
PRIMARY_AUTHORITY = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1; semantics 39865536ce51005f95a98473e77c2329078512c0; accepted base bb5327f
REVIEWER_ID = /root/dcp_service_review
AUTHOR_INDEPENDENCE = PASS
AUTHORITY_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS (affected repair scope)
ACCEPTANCE_COVERAGE_REVIEW = PASS (affected repair scope)
EVIDENCE_REVIEWABILITY = PASS
FROZEN_BLOCKER_UNION = [T3-B01, T3-B02]
T3-B01 = ADDRESSED
T3-B02 = ADDRESSED
OPEN_BLOCKER_IDS = []
NEW_BLOCKERS = 0
SPEC_GAPS = 0
FOLLOW_UPS = 0
MERGE_READY = NOT_APPLICABLE (task gate; final whole-branch review remains)
OPERATION_ALLOWED = NO
NEXT_ACTION = STOP (scoped re-audit complete)
```

The original governance and accepted Contract sources in `task-3-review.md` remain applicable. This report does not accept a new Spec or certify production/bootstrap readiness. Source and test references below are relative to `packages/deployment-control-plane/`.

## Frozen blocker closures

### T3-B01 — ADDRESSED

`src/service/mailbox.rs:20–28` initializes and flushes one protected 0600 publication-lock inode. `src/service/server.rs:184–187` invokes initialization after acquiring the daemon singleton and before Queue/Train/socket workers. Concurrent publishers therefore open an already-initialized inode. The lock uses bounded nonblocking OS acquisition and checks the named inode (`src/service/mailbox.rs:30–57`); no unlink, lock replacement, caller path selector or substitute mutation authority was added.

Publication now validates the exact protected temporary record while holding that lock. A matching complete record resumes; a matching incomplete canonical prefix is completed in place, then verified and flushed. Mismatches remain preserved refusals (`src/service/mailbox.rs:85–122`). The existing-final-record path verifies bytes and inode identity and repeats both file and parent flushes before success (`src/service/mailbox.rs:74–81`). Rename also requires a successful parent flush. Thus neither the orphan temporary counterexample nor the visible-but-unflushed fast path survives this repair.

Executed evidence directly covers the closure: complete/partial admitted residuals across real daemon restart with three concurrent submitters (`test/common/service_repair.rs:28–71`), closure residual recovery plus authenticated producer ACK and one mutation (`:73–120`), preservation of mismatches and an active publisher's prefix (`:122–151`), and both existing-file and post-rename directory-fsync failures (`test/common/mailbox.rs:46–83`). Final results are retained in evidence logs 37 and 38; earlier RED and diagnostic failures remain distinguishable.

### T3-B02 — ADDRESSED

Enqueue now advances a durable global verification token and atomically upserts the unit's current generation (`src/queue/service.rs:12–25`). Selection returns `(unit,generation)`, and success/error completion predicates on both coordinates (`:27–62`). The Train passes its exact claim to completion (`src/service/train.rs:65–68`). An old pass can neither delete newer acknowledged work nor overwrite its error disposition. The monotonic counter also prevents token reuse after completed-row removal.

`MUTEX_BUSY` remains runnable; other errors are retained in the acknowledged row as an explicit durable disposition until a fresh authorized retry (`src/queue/service.rs:32,46–59`). This satisfies the original repair requirement without inventing acceptance or replaying mutation. The additive migration preserves legacy unit-only rows at generation 1 inside an immediate transaction (`src/queue/schema.rs:42–61`), and Queue open runs it before use (`src/queue/mod.rs:18–24`).

The executed overlap regression reproduces the original synchronization window and now produces both independent PASS outbox entries with one install (`test/common/service_repair.rs:181–228`). The lock-contention regression verifies retained work, later authentic acceptance and token monotonicity after completion (`:230–287`). The migration/reopen regression checks retained ABSENT and SERVICE_GENERATION_DRIFT dispositions, an explicit newer retry token, no manufactured closure/request, and one mutation (`:290–380`). All pass in final evidence log 38.

## Quality and affected invariants

- Publication behavior is isolated in a 124-line module with a single responsibility. The lock wait has a 200 ms bound; content size, protected metadata, immutable mismatches and mailbox quota remain enforced. Filesystem primitives and the Executor transaction/journal algorithm are unchanged (`src/service/mailbox.rs:30–45,64–124`; `src/service/intake.rs:180–185`).
- Generation and error disposition are stored in the existing transactional Queue. The schema upgrade is additive; immutable receipt/history tables are untouched. Completion CAS handles both success and failure, rather than fixing only the originally observed success race (`src/queue/schema.rs:29,42–61`; `src/queue/service.rs:39–62`).
- The production host guard, signed external acceptance, local WAITING restriction, exact attachments and unknown-canary handling were not modified. The affected Train hunk only transports the verification claim/disposition (`src/service/train.rs:65–68`). Retained Train/transaction results include the existing unknown-no-resend, same-host mutex, restored-generation and independent-closure checks.

## Evidence and limits

Read the repair appendix first, then the supplied two-commit repair diff once in sequential bounded chunks. No git diff regeneration, outside-diff source read, suite rerun, focused reproduction, source/index/ref edit, subagent or production operation was needed during this re-audit. Exact source coordinates were extracted from the supplied hunk offsets.

- `37-repair-affected-suite.log` records library 17, authority 12, filesystem 12, Queue 25 and socket 4 passes. It truthfully retains the migration-fixture expectation failure in Train; it is not treated as a wholly passing invocation.
- `38-repair-train-transactions-green.log` records final Train 17 and transaction 9 passes. The test correction accepts the actual fixture process-generation refusal and asserts no acceptance/reinstall; it does not weaken production validation. Together 37 and 38 provide the reported 96 final-source affected passes. The unchanged 4096-slot test uses retained evidence 22 from the preceding reviewed package.
- No final compiler warnings were observed. Logs 30 and 36 have historical “green” filenames but are explicitly disclosed as failed invocations; no false PASS claim is inferred from those names.
- `43-quality.log` records format, vendored governance and scoped source/report whitespace success. `41-whitespace.log` preserves four blank-line-at-EOF warnings in raw Cargo output; these are evidence formatting noise, not a product blocker.
- `44-machine-structure.json` remains exit 1 for exactly three unchanged baseline violations with 76 warnings. This re-audit does not label that repository-wide gate PASS. `42-rust-structure.log` records no new Rust structural violation: maximum 482 lines, 19 children, depth 2; largest new repair test file 380 lines.

Crash residuals and fsync faults are controlled fixture/injection evidence, not a hardware power-loss claim. Production issuer custody/adapters, complete native loader closure, bootstrap preparation, final whole-branch review and any authorized production canary remain outside this task gate and are unchanged by this approval.
