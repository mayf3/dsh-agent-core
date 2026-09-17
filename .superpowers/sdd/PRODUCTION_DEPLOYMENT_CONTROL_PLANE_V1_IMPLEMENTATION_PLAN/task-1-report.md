# Task 1 implementation report

## Status and coordinates

Implemented the bounded trusted model, producer intake and durable queue library.
Base: `950cb218769e10f643cba9befce3d605cfe2c113`; authority main `bb5327f` and
Owner-accepted semantics `39865536ce51005f95a98473e77c2329078512c0` as assigned.
Worktree: `/Users/yanfenma/workspace/worktrees/production-deployment-control-plane-v1-impl`.
Implementation commit is the commit carrying this report (avoids a self-referential
hash). No governing Spec edits. No production reads/writes, sudo, services,
LaunchDaemon install, permissions/identity changes, other checkout or subagents.

DEVELOPMENT_PREFLIGHT: REUSE / IMPLEMENTATION / EXEC_PLAN / CONTROLLED;
AUTHORITY_ACCEPTED_IN_BASE=YES; IMPLEMENTATION_AUTHORITY=contracts;
PRODUCTION_MUTATION_ALLOWED=NO; PRIVILEGED_BOOTSTRAP_ALLOWED=NO.
DONE_WHEN for this bounded task: owned code and concrete API, authority/queue
negative and positive fixtures passing, durable report and commit. Parent owns
independent review and further tasks.

## Delivered behavior

- Typed strict records; deterministic domain-separated canonical JSON digest;
  Ed25519 strict signature checks with bootstrap-selected keys, roles and scopes.
  Acceptance, source/tree, build recipe/toolchain/architecture/dependency closure,
  artifact/manifest, independent review and exact Goal contracts/faces are bound
  by real signed records, never caller booleans or arbitrary URLs.
- Producer registration, Goal revision CAS, authenticated complete snapshots,
  registered watermark gaps, stable paginated census and durable change cursors.
  No unauthenticated historical-import path exists.
- SQLite transactional state with foreign keys, FULL synchronous commit, bounded
  busy waits, append-only receipts/journal protections and immutable descriptor.
  Actor/request idempotency, quotas/rate limits, durable desired-state intents,
  same-artifact collapse, immutable late coverage and target-generation binding.
- Global monotonic signed policy epochs; revocation observations survive rejected
  admission; freshness at most 300 seconds; explicit under-mutex `revalidate` API.
- FIFO/CAS lifecycle, exact dependency capability/Goal receipts, cycle/missing
  prerequisite checks, atomic queued supersession with inherited age/coverage/
  dependency obligations; inbound exact-receipt dependencies remain unchanged.
- STOP and accepted independent CONTINUE; automatic signed-remediation return to
  queue for known safe failures, three preflight/two mutating attempts per intent.
  New request IDs do not reset budgets; unchanged artifact under a new desired
  revision cannot allocate a fresh budget. Startup interruption and unknown Goal
  outcomes quarantine with no caller-controlled unlock or blind replay.
- Protected transaction and separately signed per-Goal receipts; fixed verifier
  issuer mapping; successful Goal closure only after finalize; durable scoped
  idempotent outbox and signed producer revision acknowledgements. Late accepted
  Goal verification adds no installation attempts.

Concrete public signatures and integration sequencing are in
`packages/deployment-control-plane/README.md` (Concrete API section). Important
handoff methods: `Queue::open`, `submit`, `next_ready`, `transition`, `revalidate`,
`mark_interrupted`, `retry`, `record_transaction`, `record_goal`, `daemon_coverage`,
`daemon_evidence`, `outbox`, `acknowledge_closure`, actor-scoped status/receipts.

Additional focused modules were necessary for reviewable separation:
`src/trust/admission.rs`, `src/queue/{producer,receipts,readback}.rs` and
`test/{authority_freshness,queue_scheduling,queue_receipts}.rs`. All are within the
planned package/module directories, fewer than 20 children and below 500 lines.
`package.json` establishes the structure module root. Cargo.lock pins the native
Rust dependency closure (serde, Ed25519, SHA-256, bundled SQLite, fixture tempfile).

## Executed evidence

Actual final command:

`cargo test --locked --manifest-path packages/deployment-control-plane/Cargo.toml --test authority --test queue`

Result: authority **12/12**, queue **17/17**, total **29 passed / 0 failed**, no
compiler warnings. Final run used disposable non-root local fixtures and real
SQLite, signatures, concurrent connections and reopen; no mock store or verifier.
`cargo fmt --manifest-path packages/deployment-control-plane/Cargo.toml --check`
passed before final formatting. After the first complete run, two additional
reachable evidence-retention gaps were tested RED and fixed (signed recovery proof
and superseded policy retrieval); the complete affected owned suite was then
rerun once, producing the final 29-test log.

Directly captured final output:
`.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-1-evidence/final-tests.log`.

Honestly labeled excerpts of prior executed RED/GREEN tool outputs:
`.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-1-evidence/red-transcript.md`.

Authority fixture coverage: forged/changed signatures, issuer roles/scopes,
unknown fields, independent review, expired/replayed/equivocated policy, mismatched
artifact/source/profile, missing/reverted coverage, invalid ID, retained revocation,
cross-profile replay, exact source inclusion, descriptor ID, overlapping root
owners and revision-overflow rejection.
Queue fixture coverage: six concurrent identical requests, durable idempotency,
late multi-Goal attachment, A→B→A, signed snapshot CAS/watermarks/pagination,
dependencies/semantic receipt, retry budgets/new IDs, FIFO bypass, STOP/CONTINUE,
crash quarantine/reopen, cyclic supersession rollback/age inheritance, outbox
reopen/forgery/ack idempotency, verifier scope, unknown canary, quotas/rate/CAS.

## Boundaries and remaining integration obligations

This is source-level core coverage, not all ACC rows and not production readiness.
Task 2/3 must supply protected catalog/actor/path/clock from actual bootstrap and
kernel credentials; this library does not establish root ownership or expose a
socket. Internal phase/transaction-receipt methods must never be caller API.

The fixed slot/manifest owner/mode/ACL mapping, sealed CAS byte verification,
descriptor-relative filesystem security, OS mutex, per-slot/preimage/owned-child
journals, physical rollback/readback and fixed service executor are subsequent
work. A database `installed` match is advisory until that executor verifies live
bytes/metadata/generation. `revalidate` must be called with fresh policy while
holding the permanent host mutex immediately before mutation.

`mark_interrupted` conservatively records RECOVERING and quarantine. No generic
unlock exists; exact verified continuation/rollback recovery remains an executor
integration obligation. Signed known-failure remediation is implemented; its
issuer must be isolated and issue proofs only from complete physical evidence.

Queued supersession preserves immutable inbound exact-receipt edges. Such a
dependent remains blocked until its own reviewed replacement names a compatible
new receipt; silently changing an old descriptor's prerequisite is forbidden.

Manual historical import, retention GC, full-disk/fsync fault injection, actual
kernel identities, OS mutex crash recovery, root activation and production canary
are not claimed executed. All integration gates remain separately reviewable.

## Frozen-union repair pass: DCP-T1-B01–B06

Repair base: `2624e16a8a61f298056396f786661b875a9780ed`. The independent review
`task-1-review.md` is retained with this repair for its exact Contract sources,
executed counterexamples and frozen union. This is one combined repair pass, not
a change to the accepted authority or an expansion into Task 2/3 physical work.

All six reviewer reproductions were converted into rejecting regression tests
before production behavior edits. One initial fixture compilation failed while
synchronizing newly required receipt fields; it is not counted as behavioral RED.
After scaffolding those fields, the six actual regressions ran and failed against
the old behavior: **0 passed / 6 failed**. Raw captured output is
`task-1-evidence/repair-red.log`.

| Blocker | Concrete repair | Rejecting and positive regression evidence |
|---|---|---|
| B01 | Replacement transaction loads every effective coverage row, checks exact Goal coverage plus authenticated producer/issuer/revision binding, and inherits all old actor links. Missing late Goals reject atomically. A corrected replacement also inherits any failed-intent pause. | `b01_supersession_preserves_all_late_goal_and_actor_links`: omit late Goal → SUPERSESSION_COVERAGE; old unit remains queued/count unchanged; include both Goals → replacement retains two Goals and original late actor can read it. |
| B02 | Immutable transaction receipts are selected by `(unit, attempt)`. Finalize demands the active attempt and matching process/target generation; historical receipts remain retrievable. Goal receipts now bind attempt, service generation and attachment digest; a previous-attempt PASS cannot close the active one. | `b02_current_attempt_needs_its_own_transaction_and_goal_readback_receipts`: second attempt without current receipt rejects, correct second receipt appends, stale first Goal rejects, wrong current process generation rejects, correct current Goal finalizes and outbox closes attempt 2. |
| B03 | Authenticated actor/request + canonical payload lookup precedes freshness/readiness checks, both before new admission and again inside the write transaction. Matching ACK recovery returns current state/revision and advisory install status; changed payload is still REQUEST_CONFLICT. | `b03_committed_ack_survives_expired_revoked_policy_and_reports_finalized_state`: expired/revoked old policy still recovers the committed ACK; finalized ACK reports APPLIED/no install; changed signed payload rejects. |
| B04 | Supported dependencies explicitly require LiveInstallation semantics and exact current protected installed unit/generation/receipt. Admission, selection and fresh pre-apply validation all use that meaning, with active-attempt Goal/service evidence. HistoricalReceipt is a reserved typed value rejected until an independently accepted historical-capability contract exists. | `b04_replaced_runtime_cannot_satisfy_live_installation_dependency`: A replaced by B makes queued dependent ineligible; fresh revalidation and new admission reject DEPENDENCY_NOT_CURRENT; relabeling installed capability as HistoricalReceipt rejects UNSUPPORTED_DEPENDENCY_SEMANTICS. |
| B05 | Signed retry now checks current stored policy, full attachment trust, dependencies and expected preimage, and retains STOP. Only the designated corrected unit can advance; cancel cannot erase the failed-intent pause. New `begin_apply` is the only APPLYING entry and atomically validates fresh admission plus daemon preflight evidence before clearing that STOP. | `b05_revoked_recovery_and_cancel_cannot_clear_stop` rejects revoked retry and pending cancel; `b05_safe_correction_resumes_automatically_only_after_fresh_precheck` rejects generic APPLYING and a newly revoked precheck, then resumes automatically with fresh corrected policy/current receipts; unrelated B waits until safe completion. |
| B06 | `daemon_attachments` exposes each exact immutable full signed proposal/digest. `revalidate`, retry and begin_apply check all attachments against current trust/policy. Transaction receipts bind sorted effective attachment/review sets; each Goal receipt binds its own attachment. In-flight new attachments defer until APPLIED so the active receipt set cannot change midway. | `b06_every_attachment_review_is_exposed_and_currently_revalidated` rejects revoked late reviewer and returns both exact proposals; `b06_transaction_receipt_binds_the_full_effective_attachment_set` rejects incomplete transaction provenance, verifies both Goals without descriptor mutation, and accepts deferred late coverage after finalize with zero reinstall. |

### Executed repair validation

- Focused combined repair gate: **8/8 passed**, 17 unrelated queue tests filtered.
  Raw output: `task-1-evidence/repair-focused-green.log`.
- Full owned gate run once after the combined fixes:
  `cargo test --locked --manifest-path packages/deployment-control-plane/Cargo.toml --test authority --test queue`
  → **authority 12/12; queue 25/25; total 37/37**, no warnings/failures.
  Raw output: `task-1-evidence/repair-final-tests.log`.
- Final local diff inspection moved the second (concurrent-commit) ACK lookup
  ahead of policy pinning as well, and unified initial/recovered advisory install
  status for terminal/blocked states. The directly affected B03 regression was
  rerun **1/1 passed**, 24 filtered; no second broad suite was run.
  Raw output: `task-1-evidence/repair-final-ack.log`.
- Final `cargo fmt --manifest-path packages/deployment-control-plane/Cargo.toml --check`
  exited 0; empty stdout/stderr is retained in `task-1-evidence/repair-format.log`.
- Raw logs retain command output, with only redundant trailing blank lines trimmed
  for Git whitespace hygiene. No new production/system operations were performed.

### Changed API and Task 2/3 obligations

- `begin_apply(&Catalog, unit, expected_revision, &Signed<Policy>, now,
  preflight_evidence_digest) -> Result<UnitStatus>` is the sole APPLYING entry.
  Generic `transition(..., Applying, ...)` now rejects PRECHECK_GATE_REQUIRED.
  The executor must hold the OS mutex, complete real authoritative PRECHECK and
  supply its durable physical evidence digest. Policy/current evidence/dependency/
  preimage checks, attempt increment and failed-intent STOP release are atomic.
- `retry` has the same signature, but now validates current policy/attachment/
  dependency/preimage gates and keeps STOP while requeued. Do not interpret retry
  success as releasing the train; only corrected work can advance to begin_apply.
- `Submission` adds `state` and `status_revision`. A duplicate returns current
  durable projection, even if its old admission policy is stale. ACK recovery is
  never new apply authority; `install_required` remains advisory.
- `Dependency` adds required `semantics`. Use `LiveInstallation` only.
  `HistoricalReceipt` explicitly rejects; no caller-controlled exception exists.
- `TransactionReceipt` adds sorted `attachment_digests`; `review_digests` now binds
  the complete sorted deduplicated review union from all saved attachments. Issue
  a new immutable transaction receipt for each actual attempt/readback.
- `GoalReceipt` adds required `attempt`, `service_generation`, and
  `attachment_digest`. Finalize and live semantic dependencies require current
  attempt/target/process correlation; old PASS results are preserved but not reused.
- `daemon_attachments(unit) -> Result<Vec<CoverageAttachment>>` returns full saved
  proposals and digest IDs for all attachment evidence. `daemon_coverage` remains
  the effective Goal registry; `daemon_evidence` remains only original evidence.
- New late attachments during an in-flight install return ATTACHMENT_DEFERRED.
  Retry their declarative submit once APPLIED; producer readiness remains durable.
  APPLIED `revalidate` checks current installed unit/generation so late verification
  can use full current trust without incorrectly requiring the old preimage.
- These required model fields refine the unreleased core format. There is no
  production database/schema migration or enabled profile in this task. Downstream
  code/fixture builders must use the repaired record shapes; absence of required
  evidence fails closed. Physical bootstrap/manifest/mutex/rollback gates remain
  the separately stated Task 2/3 obligations.

Decomposition added focused `src/queue/{gates,dependencies}.rs` and
`test/queue_repairs.rs` and `test/queue_repair_provenance.rs` to keep each responsibility readable. No source file
exceeds 500 lines and no package module directory exceeds 20 direct children.
