# Task 3 — daemon, protected intake, Train and independent closure

## Coordinates and authorized scope

- Target: `mayf3/dsh-agent-core`, isolated branch
  `codex/production-deployment-control-plane-v1-impl` and its named worktree.
- Starting/Base Head: `186c83d7a61320bee9eb04005de13d4bbee27df8`.
- Active authority: `PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@bb5327f`, accepted
  semantics `39865536ce51005f95a98473e77c2329078512c0`.
- Implementation coordinate: commit containing this report; no circular hash.
- Mandate: controller's Task 3 delegation and `task-3-brief.md`; implementation,
  tests and disposable non-root verification only. Controller owns independent
  review. This report makes no independent review PASS or bootstrap-readiness claim.

DEVELOPMENT_PREFLIGHT was emitted before code: `REUSE / IMPLEMENTATION /
EXEC_PLAN / CONTROLLED`; authority accepted in Base, implementation authority
`contracts`, isolated surface YES, authorization VALID, evidence reviewability
PASS, production operation NO, privileged bootstrap NO. DONE_WHEN is bounded
source/API, executed evidence, report and commit. Expansion boundary is new
production issuer authority, actual adoption/bootstrap or accepted-Contract change.
No Spec, other checkout, root launchd/sudoers, installed helper, live service or
legacy routing path was modified. No subagents were spawned and nothing was pushed.

## Implementation and API handoff

The crate now builds `agent-deployd` and identifier-only `agent-deployctl`.
`src/service/{protocol,intake,server,train}.rs` reuse Catalog/Queue/Executor/Guard;
there is no second admission model, execution queue or shell executor. Production
paths are compiled. The only separate entry, `--sandbox`, validates a non-root
0700 current directory beneath the kernel Darwin per-user temporary root. It
cannot select a production target. `service::Configuration`, Caller and typed
VerifierBinding are exported for protected configuration preparation.

The real Unix socket uses kernel UID/effective GID, one honest shared actor per
UID, strict version/unknown-field checks, identifiers/digests only, 64 KiB/depth16,
a total one-second frame deadline, bounded writes and per-UID/global concurrency
and rate limits. Queue status/receipt APIs retain actor authorization and the Task2
finalization projection. Status exposes receipt digests needed for actual export.
Receipt bodies are closed typed IDs/digests/outcomes, with no private preimages,
key material or business-message text. No daemon-only operation is dispatched.
Private SQLite files are inspected before open; Queue durable commit precedes ACK.
Immutable digest-checked proposal retention makes lost ACK recovery work after
upstream intake disappears, through the existing Queue request dedupe.

A protected fixed mailbox integration polls signed producer snapshots by CAS,
performs complete bounded census pagination and checks every producer watermark.
An empty configured registry refuses startup. Producer disconnection does not
manufacture readiness. Identifier submissions fetch signed Proposal evidence by
protected digest. Current signed policy is fetched again under the OS guard.
Configuration/intake have their own 32 MiB/depth32 limit, independent of the small
socket frame and compatible with the existing 4096-slot resource composition.
Immutable mailbox publication flushes bytes and parent directories; acknowledgements
are authenticated with the accepted producer key and exact outbox/Goal/receipt CAS.
A local closure file alone never marks producer closure.

The Train runs automatically after guarded startup recovery, preserves existing
DAG/FIFO/STOP semantics and holds one permanent host guard from policy/precheck
through install/restart/readback, bounded acceptance and Executor finalize.
Separate socket workers keep status responsive. Late acceptance is queued durably
and uses current `verify_installed` restoration binding, exact persisted coverage
attachment, attempt, physical process generation and receipt revision. It does not
install/restart. Two private fixture targets have separate target/journal subtrees
but the same host Queue/root/permanent lock; no separate fixture locks substitute.

Verification has two closed modes:

- `external-observation`: bounded read-only request for an existing accepted
  result, with exact coordinates and next receipt CAS. It grants no business or
  canary execution authority. Accepted external signatures alone may claim PASS/
  FAIL/unknown. Per-profile wait is <=2000 ms and shared external wait <=5 seconds.
- `native-installed-readback`: only the exact installed-byte/process readback
  already proved by the native Executor, and only with the profile's accepted
  Verifier issuer. The daemon requires a protected 0600 private key, matching
  public key, Verifier role and profile scope before apply. No arbitrary health
  command, plugin or candidate-executed verifier exists.

Controller explicitly resolved the absent-verifier integration: the protected
Queue may record WAITING as a daemon observation, separate from external authority.
`daemon_record_waiting` is crate-private, cannot record success, and labels the
retained envelope `issuer=daemon-observation, signature=""`. It is **not a signed
verifier assertion**, uses no provisional/shared external private key, and can
neither close a Goal nor satisfy semantic dependencies. Actual accepted verifier
receipts remain signature-checked and advance normal immutable CAS history. All
attempt/Goal/attachment/process binding checks are shared. OutcomeUnknown cannot
be overwritten and quarantines the host lane. Pure FAIL/WAITING finalizes the
proven shared release; PASS alone enters the eligible outbox after Task2's fence.

Private Queue integration methods add producer cursor, durable verification request,
caller/latest Goal and persisted coverage attachment reads. Executor adds only a
crate-private named fixture target constructor sharing the host root/lock; its
production mapping, mutation semantics, restored binding, current-execution recovery
and finalization eligibility remain those from reviewed Task2.

## Production preparation contract and limits

The complete concrete file/protocol contract is in the crate README Task3 section.
Production requires `service.json`, `daemon-activation.json` signed in domain
`DaemonActivation` by a protected Authority key with bootstrap scope, native
`activation.json`, and exact-digest-bound `issuer-bindings.json`. The positive epoch,
configuration/native-enrollment/issuer-evidence digests, canonical `/var` alias,
protected ancestors, caller identities and socket metadata are checked. The
configuration trust root and its actual acceptance/custody must be established by
Task4's separately reviewed/authorized bootstrap; this program does not provision
them or turn a fixture key into a production issuer.

Required prepared directories: `intake/{proposals,snapshots,policies,results,acks}`,
`admitted`, `requests`, `closure`, existing Executor staging/sealed/transactions,
and `verifier-keys` only for accepted native profiles. Queue/singleton/permanent
mutex and socket parent metadata must be protected. The effective caller GID is
separate from dedicated supplementary socket-group access; no staff or GID602
installation is inferred. Production singleton/mutex inodes must already exist.
No fixed directory or activation file is created by the production entry.

`issuer-bindings.json` is an activation-bound evidence document. Real issuer
service identities, protected delivery adapters, key custody/isolation and accepted
source bindings are still unknown; these cannot be established by signing an
Agent-authored claim. The supplied mailbox transport is executable and fixture
producer/verifier/CAS clients exercised it, but operational external adapters and
business acceptance adoption remain Task4 blockers. No network endpoint or private
upstream key was guessed. Native readback is not a substitute for a business
Goal's acceptance profile. External canary effects are never dispatched by this
implementation; no live message, Grant, domain write or real production canary ran.

All Task2 unsupported profile facets remain unsupported. Controller's separate
Task4 census reports the pinned Node loader closure reaches caller-writable
`/usr/local/opt` dylib ancestors; native Node/plist hashing does not prove the
complete loader closure. Task4 must prepare/enforce an independently reviewed
protected loader closure before enrollment. This Task3 source and fixtures do
not establish BOOTSTRAP_READY, complete profile adoption or production conformance.

## Executed evidence and bounded self-review

All commands run in the named worktree with current non-root UID. Raw command
outputs, including failed fixtures and diagnostics, remain under `task-3-evidence/`.
No earlier failure log was replaced by later passing output.

RED/GREEN pairs and exact behavior:

- `01-socket-red.log` / `02-transport-red.log`: native binary absent; then
  `04-train-red.log` records socket3 GREEN against real processes and sockets.
- `05-train-behavior-red.log` / `06-integration-green.log`: no Train progress vs
  durable WAITING, finalized release and late signed PASS/producer ACK.
- `08-reopen-red.log` / `09-reopen-green.log`: lost ACK failed ABSENT after intake
  removal; durable protected proposal retention recovers the same queued unit.
- `11-host-targets-red.log` / `12-host-targets-green.log`: second actual target
  remained unchanged; named non-root targets now share the actual host mutex.
- `14-external-cas-red.log` / `16-integration-green.log`: no new immutable receipt
  CAS coordinate was exposed for late external acceptance; explicit revision
  binding now allows a real client to sign the correct subsequent result.
- `15-receipt-discovery-red.log` / `16-integration-green.log`: public native PASS
  receipt discovery absent; actor-scoped digest exports now work.
- `20-exact-attachment-red.log` / `21-exact-attachment-green.log`: a combined late
  proposal selected a different attachment for the older WAITING Goal; the Train
  now reads the Queue's persisted per-Goal binding. Logs17–19 retain unsuccessful
  fixture ordering searches; the original deterministic attachment started0001,
  so the fixture changed its legitimate signed dependency-closure input rather
  than widening authority or modifying the expected attachment.
- `23-native-key-mode-red.log` / `24-native-key-mode-green.log`:0644 native key
  permitted install;0600/matching role/public-key/scope gate now precedes apply.

Commands for all focused runs use:
`cargo test --locked --manifest-path packages/deployment-control-plane/Cargo.toml`
with the named `--test socket`, `--test train` and focused test name, plus
`-- --nocapture`. Compile/type fixture errors and the too-fast test polling that
hit the real per-UID quota remain in03/04/07; test pacing was corrected without
weakening production quotas. Lifecycle expected rejection codes printed by owned
daemons are evidence, not compiler warnings.

Final suite results are recorded below after completion. Formatter, whitespace,
governance integrity, staged machine structure and supplemental Rust counts are
separate gates. Supplemental Rust currently has max482 physical lines,19 immediate
children and depth2. Task4 must preserve the test-root20 limit. Three pre-existing
machine structure violations remain existing debt; this Task does not rewrite them.

### Final executed gate results

Complete crate command:

```text
cargo test --locked --manifest-path packages/deployment-control-plane/Cargo.toml -- --nocapture
```

`22-full-suite.log`, exit0: **89 passed /0 failed** (library16, authority12,
filesystem12, queue25, socket4, Train11, transactions9). The unchanged actual
4096-slot full install/rollback journal roundtrip ran; library elapsed320.29s.
Helper child invocations are additionally retained and are not double-counted.
No compiler warnings. Expected owned-daemon BLOCKED logs are preserved verbatim.

The final native-key check was completed while the long unchanged journal test
was running. Therefore an explicit final-source affected command also ran:

```text
cargo test --locked --manifest-path packages/deployment-control-plane/Cargo.toml -- \
  --skip maximum_admitted_slots_roundtrip_success_and_rollback_journal --nocapture
```

`25-final-affected-suite.log` records library15 + authority12 + filesystem12 +
queue25 + socket4 passing, then a real test-harness timing failure: restart used a
fixed250ms delay, and under concurrent journal I/O the socket was not listening
when the test connected. The daemon did not report a source failure. Replaced the
test delay with a bounded5s actual socket-connect/child-exit readiness check.
No production timing, quota, recovery or acceptance check was weakened.

The exact affected remainder was rerun:

```text
cargo test --locked --manifest-path packages/deployment-control-plane/Cargo.toml \
  --test train --test transactions -- --nocapture
```

`26-final-readiness-green.log`, exit0: **20 passed /0 failed** (Train11,
transactions9). Together the final-source affected checks cover all88 tests other
than the unchanged maximum-slot test, whose passing full executed evidence is
retained in22. Only the test readiness wait changed after25. The full failed25 log
is retained, not recast as a successful invocation.

Final formatting, source whitespace and vendored governance integrity PASS.
Supplemental Rust structure PASS: maximum482 lines /19 children /depth2. The
machine structure result and its exact staged tree are retained separately;
existing unrelated structure debt does not become a self-declared PASS.


Machine gate executed against source commit
`4c45c9eaa5573fecccf55a926395d21af588b8a2`, base186c83d7:

```text
node scripts/verify-code-structure.mjs --base 186c83d7a61320bee9eb04005de13d4bbee27df8 --head 4c45c9e --json
```

Exit1, exactly the three unchanged existing violations:
`packages/production-runtime/src`21/21 children;
`packages/production-runtime/test`23/23; `scripts`59/59. No Task3/new violation.
The raw JSON has76 warnings and notes the existing exception ceilings. A prior
attempt using staged tree d29a7a0 was rejected because the verifier requires a
commit ref (exit2); it was not a product gate result. The actual commit-bound
result is `machine-structure.json`. The subsequent commit changes only this gate
report, its raw JSON and introductory README wording; source tests are unchanged.

Status: bounded Task3 implementation complete with explicit production-adoption
concerns; independent review pending. Stop here; no Task4 bootstrap work performed.

## Frozen Task 3 review repair: T3-B01 / T3-B02

Repair starts at `4c9d3654e1296538d05d349020f1877e63669a2e`. The controller's
attributable mandate freezes exactly the two Important blockers in
`task-3-review.md`; no Spec gap or authority change was requested. Repair
DEVELOPMENT_PREFLIGHT reuses accepted semantics39865536 / accepted basebb5327f,
CTR-DCP-007/011/014/015/020, the same isolated branch and source/private-fixture
boundary. DONE_WHEN is those counterexamples closed, affected tests/evidence
retained, report/commit handed back for independent re-audit. No new profile,
bootstrap, live operation, external issuer, Spec edit or agent was introduced.

### Exact repair and API handoff

B01: `service/mailbox.rs` owns protected publication. Singleton-owned startup
creates and flushes a permanent0600 `publication.lock` before workers/listening.
Every publisher opens that inode and obtains `flock(LOCK_EX|LOCK_NB)` with a200ms
bounded wait. It validates metadata and the named inode; lock descriptors are
CLOEXEC and never unlinked. This lock serializes mailbox writes, not mutation
execution; `production.lock` and the guarded Executor remain mandatory.

Under the lock, a complete matching `<digest>.tmp` is file/parent-flushed and
renamed; an incomplete exact canonical prefix is appended in place, rechecked,
and flushed before rename. No temporary is truncated or removed. Mismatching
partial/complete/final content refuses with IMMUTABLE_DELIVERY and is preserved.
An existing matching final file is file/parent-flushed again before success,
including after visible rename plus failed directory flush. Complete matching
files, incomplete prefixes and active concurrent publishers have separate
behavioral coverage. The same routine serves admitted, requests and closure.
No blanket cleanup or journal algorithm change occurs.

B02: `verification_requests` gains `generation` and nullable `last_error`.
A persistent `meta.verification` counter supplies monotonic tokens, including
after a previous row has been deleted. Queue open upgrades legacy unit-only rows
inside an immediate transaction, retaining them at generation1. New requests
atomically advance generation and clear their old disposition. The crate-private
`daemon_next_verification` now returns `(unit, generation)`; the single Train uses
that exact claim with `daemon_finish_verification(unit, generation, error)`.
Success deletes only the claimed generation; failure updates only that same
generation. Older success or failure cannot erase/overwrite a newer acknowledged
late attachment or retry. Socket schemas/public Queue interfaces are unchanged.

MUTEX_BUSY remains runnable and retries only physical readback. Other failures
remain explicit durable `last_error` dispositions, excluded from automatic
selection until an authorized fresh retry; no acknowledged row silently vanishes.
The migration/reopen regression covers ABSENT policy, then genuine fixture
SERVICE_GENERATION_DRIFT refusal, and token monotonicity is checked after a
successful row's completion/recreation. WAITING remains bounded and permits
finalization; signed PASS/FAIL/unknown provenance, immutable attachment/history,
physical readback, finalization eligibility and no-reinstall/no-resend rules are
unchanged. The existing unknown regression still passes. Production adapters,
issuer custody and complete native loader closure remain Task4 adoption blockers.
Task4 must preserve/provision the internal publication lock with the protected
state root; it conveys no extra caller or bootstrap authority.

### RED/GREEN and retained raw evidence

All commands below run in the pinned worktree as the current nonroot identity.
Prefix `cargo test --locked --manifest-path packages/deployment-control-plane/Cargo.toml`
is abbreviated as `cargo-test` only in this report. Full raw stdout/stderr remains
under `task-3-evidence/`; no failed observation is deleted or relabeled.

- `cargo-test --test train repair:: -- --nocapture`:27-frozen-union-red.log,
  exit101,5 failures reproducing complete/partial publication rejection,
  active-publisher/mismatch behavior, lost overlapping coverage and lost lock-busy
  work.31-frozen-union-green.log, exit0,5 pass after initial repair.
- `cargo-test --lib service::mailbox_tests -- --nocapture`:
  28-mailbox-flush-red.log, exit101,2 failures (existing retry returned success
  without directory flush);29-mailbox-flush-green.log, exit0,2 pass. Both admitted
  and closure exercise the failed preexisting-file flush and failed post-rename
  directory flush, followed by a successful exact retry.
- `cargo-test --test train temporary -- --nocapture`:30-mailbox-restart-green.log
  is a retained **failed** invocation despite its historical filename:2 pass/1
  failure, concurrent admitted submission returned ABSENT. A bounded repeat
  command in32-concurrent-publication-repeat.log stopped on its first failure.
  33/34 retain temporary diagnostic runs: concurrent first-use `open(O_CREAT)`
  on publication.lock returned ENOENT while another publisher created it. Startup
  initialization before workers closes that concrete race. Diagnostic source
  was removed; no common filesystem implementation change remains.
- `cargo-test --test train admitted_temporary_records -- --nocapture`:
  35-initialized-lock-green.log, exit0,1 pass (complete and partial residuals,
  three concurrent submitters each). It also passes in37 and38.
- 36-repair-focus-green.log is a retained CLI invocation error, exit1: Cargo
  accepts one filter, not two. No tests ran; it is not GREEN evidence.
- `cargo-test -- --skip maximum_admitted_slots_roundtrip_success_and_rollback_journal --nocapture`:
  37-repair-affected-suite.log, exit101: library17, authority12, filesystem12,
  Queue25, socket4 and16/17 Train pass. The additional migration test incorrectly
  expected the fixture to preserve its child-process identity across daemon
  restart. The existing fixture intentionally starts with no tracked child;
  real physical readback correctly reported SERVICE_GENERATION_DRIFT. The test
  now asserts that exact retained error, with no closure/request/reinstall.
  Production source did not change after this run.
- `cargo-test --test train --test transactions -- --nocapture`:
  38-repair-train-transactions-green.log, exit0: Train17/transactions9 pass.
  Together37+38 cover all **96 final-source affected tests**, including8 new
  regressions, with0 remaining failures. The unchanged4096-slot test is not
  repeated;22-full-suite.log retains its earlier passing execution. No bounds,
  transaction/journal algorithm or filesystem primitive changed in this repair.

Real daemon processes restart over flushed private admitted/closure temporary
residuals. Closure tests deliver an authentic producer CAS ACK and assert exactly
one mutation. Overlapping late coverage closes both Goals after authentic PASS
with one install; MUTEX_BUSY work survives and closes after guard release, also
with one install. Directory-fsync injection is test-only at the exact call
boundary; this is emulated syscall failure/reachable crash residue evidence,
not actual hardware power-loss evidence.

Reviewer repro source and output are retained byte-for-byte as
`review-reproducer.rs.txt` and `review-reproducer.log`, hashes respectively
`2e084a865cca0296b0d47a2b7c13a3a4db73ef4f41d9598438d33890920f7d5d` and
`f5755fe454885c1110d2f2a7a40f96c12611d56ddfce490b87510786902d2043`.
The original external private fixture has not been removed by this repair.

Formatting, governance integrity, whitespace and supplemental Rust structure
results are retained in39–43.41 records four trailing blank-line warnings in raw
Cargo logs; those bytes are preserved.43 explicitly passes source/report whitespace,
format and governance commands with exit0. Test-root immediate children remain19; all new
repair tests live beneath existing `test/common/`. Machine gate is recorded
against the repair commit separately, retaining the existing three violations.
Status: frozen repair implemented and locally verified; independent scoped
re-audit pending. No independent review PASS or production readiness is claimed.

Repair commit: `0c4ec56f518394557042445dfd796e439797774f`.
Commit-bound machine structure command:
`node scripts/verify-code-structure.mjs --base 186c83d7a61320bee9eb04005de13d4bbee27df8 --head 0c4ec56f518394557042445dfd796e439797774f --json`.
Exit1;44-machine-structure.json retains exactly three unchanged existing
violations: production-runtime/src21, production-runtime/test23, scripts59;
76 warnings. No new Task3 structure violation. Supplemental Rust max482 lines,
19 immediate children, depth2; largest new repair file380 lines. This follow-up
changes only the report and retained machine output; tested source is unchanged.
