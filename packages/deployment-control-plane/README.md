# Deployment control plane native core

Task 1 of accepted `PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1`, authority reviewed at
`39865536ce51005f95a98473e77c2329078512c0`. This crate is a library. It neither installs
a daemon nor authorizes production/profile activation. All fixture writes are in
private temporary directories; fixture setup refuses euid 0.

## Trust boundary

The embedding daemon supplies a bootstrap-protected `Catalog`, kernel-derived
`Actor`, trusted wall-clock seconds and protected database path. These are not
socket request fields. Catalog keys fix issuer roles and scopes. Ed25519 signatures
use strict verification over `agent-deployd:v1:<record-type>:` plus deterministic
JSON (sorted object keys, typed integer records). Public `signing_bytes`,
`canonical_bytes`, `digest`, `verify_signed` allow isolated issuers to implement
this format. No private key is included in production code.

Every wire record rejects unknown fields. The transport still must enforce its
64 KiB and nesting bounds before decoding. A `Proposal` is a trusted-intake
structure carrying signed evidence; the public socket API should accept catalog
IDs and resolve this evidence through trusted intake, never grant the caller
permission to change Catalog, Actor, clock or phase/receipt APIs.

`Acceptance` authenticates canonical source/tree and semantic authors;
`BuildAttestation` binds source/tree, recipe/toolchain/architecture, dependency
closure, artifact/manifest and exact per-Goal source/contract/face coverage;
`Review` authenticates each required independent scope. Reviewer keys must differ
from authors. `DesiredState` is Authority-signed; the daemon allocates the intent
ID in SQLite. `Policy` is Authority-signed, leased at most 300 seconds with a global
monotonic registry epoch. A validated newer revocation remains recorded even when
it rejects a proposal. Identical epochs must have identical signed records.

Profile IDs, runtime IDs and repo identifiers resolve through the protected
catalog. Runtime identity includes host, launchd domain/label and install-root
identity. Enabled profiles sharing a host/root identity cannot declare different
runtime owners. Root alias/path overlap normalization is an executor/bootstrap
obligation, not a string comparison authorization.

## Concrete API

All methods return `Result<T, Error>`; errors expose a stable `code()` without
underlying SQL, secret values or arbitrary command text. `model.rs` is the typed
record API. `Queue` is safe to share between threads; separate processes/connections
serialize writes with SQLite `BEGIN IMMEDIATE`, foreign keys, FULL synchronous
commit and a bounded five-second busy timeout. Commit precedes successful return.

```rust
Queue::open(path: impl AsRef<Path>) -> Result<Queue>
register_producer(&Catalog, producer_id: &str) -> Result<()>
register_ready(&Catalog, &Signed<ReadyRecord>, expected_revision: u64) -> Result<()>
ingest_snapshot(&Catalog, &Signed<ProducerSnapshot>) -> Result<()>
census_revision() -> Result<u64>
census(revision: u64, cursor: Option<&str>, limit: u32) -> Result<CensusPage>
changes(after: u64, limit: u32) -> Result<Vec<(u64, Signed<ReadyRecord>)>>
submit(&Catalog, &Actor, &Proposal, now: u64) -> Result<Submission>
observe_policy(&Catalog, profile: &str, &Signed<Policy>, now: u64) -> Result<()>
revalidate(&Catalog, unit: &str, &Signed<Policy>, now: u64) -> Result<()>
status(&Actor, unit: &str) -> Result<UnitStatus>
next_ready(&Catalog) -> Result<Option<UnitStatus>>
transition(unit: &str, expected_revision: u64, State, evidence_digest: &str) -> Result<UnitStatus>
cancel_pending(&Actor, unit: &str, expected_revision: u64) -> Result<UnitStatus>
retry(&Catalog, &Signed<RecoveryEvidence>, now: u64) -> Result<UnitStatus>
mark_interrupted() -> Result<Vec<String>>
record_transaction(&TransactionReceipt) -> Result<String>
record_goal(&Catalog, &Signed<GoalReceipt>) -> Result<String>
receipt(&Actor, digest: &str) -> Result<String>
receipt_digests(&Actor, unit: &str) -> Result<Vec<String>>
journal(&Actor, unit: &str) -> Result<Vec<(u64, State, String)>>
outbox(&Actor) -> Result<Vec<OutboxEntry>>
acknowledge_closure(&Catalog, &Signed<ClosureAcknowledgement>) -> Result<()>
daemon_status(unit: &str) -> Result<UnitStatus>
daemon_coverage(unit: &str) -> Result<Vec<Signed<ReadyRecord>>>
daemon_evidence(unit: &str) -> Result<Proposal>
daemon_policy(digest: &str) -> Result<Signed<Policy>>
unit_count() -> Result<u64>
install_intents_for_target(target: &str) -> Result<u64>
```

`register_producer` is a trusted administrative intake, not caller self-enrollment.
Single readiness updates require exact Goal CAS and invalidate snapshot
completeness. Complete signed snapshots preserve all previous Goals, require
producer revision + 1 and matching watermark, and cannot change another producer's
Goals. `census` rejects a changed revision between pages. An exhaustive census
requires every registered producer's watermark plus consuming every page;
disconnection never manufactures readiness. Manual historical import is not
implemented/exposed and cannot bypass signed producer intake.

Transport request identity is `(Actor.id, request_id)`; reusing it with changed
content rejects. Persistent per-actor request limits apply to new IDs, including
collapsed work, over 60 seconds. `actor_quota` also bounds active owned units;
`queue_quota` bounds total active units. Same-intent/profile/artifact submissions
collapse. A fresh signed desired revision must change artifact to allocate another
intent; A→B→A is accepted with exact current target generations. Callers cannot
change counters via request IDs or generic state transitions.

Unit ID hashes its canonical descriptor with an empty ID. `receipts` is empty in
the sealed descriptor: immutable references are read through `receipt_digests`
and the journal. Late coverage is stored as a new immutable signed-evidence
attachment and returned via `daemon_coverage`; it never rewrites the original
unit. `install_required=false` identifies an existing installed-record match;
the executor must still verify its physical generation/metadata before running
late verification, under the same host mutex.

The ready selector and PRECHECK transaction enforce dependency-ready FIFO.
Supersession only replaces queued units, preserves oldest age, original Goal
coverage and dependency obligations, and rejects cycles. Inbound exact-receipt
edges are retained; they cannot be rewritten into a claim that a new receipt
satisfies an old one. An affected dependent requires a reviewed replacement when
its exact prerequisite receipt changes. Infrastructure failures persist STOP;
accepted CONTINUE permits only nonconflicting resources. Trusted signed remediation
requeues known failures and clears their STOP automatically, with three total
preflight/two mutating attempts per intent. Unknown outcomes cannot use this route.

`record_transaction`, `transition`, `retry`, `mark_interrupted`, and `daemon_*`
are privileged internal APIs, never socket methods. The caller cannot create a
transaction receipt. `record_goal` requires the exact verifier issuer selected
by the accepted verification profile. Finalize requires an installation receipt
and a result for every attached Goal. Pure FAIL/WAITING remains installed; only
PASS receives an outbox entry after finalize. An unknown Goal quarantines the
lane and cannot be overwritten by a retry PASS. Producer closure acknowledgements
bind exact outbox, receipt and producer revision; retries never install again.

## Task 2 / 3 integration obligations

1. Bind Catalog/Actor/path/clock to protected bootstrap and kernel identities;
   root path protections, schema activation, socket limits and closed protocol
   dispatch are outside this library. Never expose daemon-only methods remotely.
2. Add the independently reviewed fixed executor slot/manifest metadata mapping,
   CAS descriptor-safe byte ingestion, hashes, ACL/owner/type checks and fixed
   process/service operations. This task authenticates attestation/manifest
   digests; it does not inspect artifact bytes or interpret install paths.
3. Acquire the permanent host OS mutex, call `mark_interrupted` before scheduling,
   perform physical readback recovery, and call `revalidate` with the latest
   policy immediately before mutation. SQLite serialization is not the OS mutex.
   Quarantine intentionally has no generic unlock. Verified continuation/rollback
   needs the executor's exact step/readback recovery API, never a PID/time claim.
4. Durably write per-step/preimage/owned-operation records before irreversible
   executor edges; this crate persists coarse phase journals and attempt budgets.
   Issue transaction/recovery records only after concrete physical evidence.
5. Fetch every `daemon_coverage` attachment before Goal verification/finalize.
   Pin installed generation under the mutex for late or retried verification.
   Deliver outbox entries idempotently and accept the producer's signed CAS ack.
6. Production, LaunchDaemon/sudoers, activation, retention GC, historical importer
   and real canary remain separate accepted-authority gates; this crate enables none.

Run `cargo test --locked --manifest-path packages/deployment-control-plane/Cargo.toml
--test authority --test queue`. Cargo.lock pins the native dependency closure.
