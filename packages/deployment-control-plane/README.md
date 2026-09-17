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
begin_apply(&Catalog, unit: &str, expected_revision: u64, &Signed<Policy>, now: u64,
            preflight_evidence_digest: &str) -> Result<UnitStatus>
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
daemon_attachments(unit: &str) -> Result<Vec<CoverageAttachment>>
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
content rejects. A committed matching ACK is recovered before freshness/admission
checks, including after policy expiry/revocation. `Submission.state` and
`status_revision` report the current unit projection; `install_required` is false
for terminal/blocked units and is never apply authorization. Persistent per-actor request limits apply to new IDs, including
collapsed work, over 60 seconds. `actor_quota` also bounds active owned units;
`queue_quota` bounds total active units. Same-intent/profile/artifact submissions
collapse. A fresh signed desired revision must change artifact to allocate another
intent; A→B→A is accepted with exact current target generations. Callers cannot
change counters via request IDs or generic state transitions.

Dependencies explicitly declare `DependencySemantics::LiveInstallation`. Admission,
scheduling and fresh gates require that exact receipt to be the protected current
installed unit/generation, plus matching current-attempt semantic Goal results.
`HistoricalReceipt` is reserved and rejected (`UNSUPPORTED_DEPENDENCY_SEMANTICS`):
there is no trusted historical-capability contract in the current profile model.
A caller cannot relabel an installed prerequisite to bypass compatibility.

Unit ID hashes its canonical descriptor with an empty ID. `receipts` is empty in
the sealed descriptor: immutable references are read through `receipt_digests`
and the journal. Late coverage is stored as a new immutable signed-evidence
attachment and returned via `daemon_coverage`; it never rewrites the original
unit. `daemon_attachments` returns each exact digest and full saved proposal,
including signed build/review provenance. Fresh `revalidate` and `begin_apply`
validate every attachment with current protected trust/policy. New attachments
are accepted while queued or applied; an in-flight new attachment is deferred
(`ATTACHMENT_DEFERRED`) until the install completes, preserving its sealed
attempt evidence set. The ready producer record remains durable. `install_required=false` identifies an existing installed-record match;
the executor must still verify its physical generation/metadata before running
late verification, under the same host mutex.

The ready selector and PRECHECK transaction enforce dependency-ready FIFO.
Supersession only replaces queued units, preserves oldest age, all effective Goal
coverage (including late attachments), producer bindings, actor links and dependency
obligations, and rejects cycles. Inbound exact-receipt
edges are retained; they cannot be rewritten into a claim that a new receipt
satisfies an old one. An affected dependent requires a reviewed replacement when
its exact prerequisite receipt changes. Infrastructure failures persist STOP;
accepted CONTINUE permits only nonconflicting resources. Trusted signed remediation
requeues known failures only after current admission/dependency/preimage gates.
It retains the failed-intent STOP; only that corrected unit may advance. Pending
cancel cannot remove it. A reviewed replacement inherits its pause. Generic
`transition` cannot enter APPLYING: `begin_apply` atomically checks fresh full
admission and actual daemon-supplied preflight evidence, increments the attempt
and clears that STOP at this proven-safe resume boundary. No Owner reapproval is
added. There are three total preflight/two mutating attempts per intent. Unknown outcomes cannot use this route.

`record_transaction`, `transition`, `begin_apply`, `retry`, `mark_interrupted`, and `daemon_*`
are privileged internal APIs, never socket methods. The caller cannot create a
transaction receipt. `record_goal` requires the exact verifier issuer selected
by the accepted verification profile. Finalize requires an installation receipt
and a result for every attached Goal. Pure FAIL/WAITING remains installed; only
PASS receives an outbox entry after finalize. Transaction receipts append per
attempt and include the complete sorted `attachment_digests` and effective review
digest union; a previous attempt receipt cannot finalize a later attempt. Each
Goal receipt includes `attempt`, `service_generation` and its exact
`attachment_digest`. Finalize requires every Goal's current-attempt evidence to
match the transaction's process readback; historical PASS cannot substitute.
Late verification binds the existing attempt/service generation and new attachment
without editing the installation receipt. An unknown Goal quarantines the
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
   perform physical readback recovery, and use `begin_apply` with the latest
   policy and authoritative preflight evidence to enter mutation. For late
   verification use `revalidate`; APPLIED revalidation pins the current installed
   unit/generation instead of requiring its old preimage. SQLite serialization is not the OS mutex.
   Quarantine intentionally has no generic unlock. Verified continuation/rollback
   needs the executor's exact step/readback recovery API, never a PID/time claim.
4. Durably write per-step/preimage/owned-operation records before irreversible
   executor edges; this crate persists coarse phase journals and attempt budgets.
   Issue transaction/recovery records only after concrete physical evidence.
5. Fetch every `daemon_attachments` proof and `daemon_coverage` record before Goal verification/finalize.
   Pin installed generation under the mutex for late or retried verification.
   Deliver outbox entries idempotently and accept the producer's signed CAS ack.
6. Production, LaunchDaemon/sudoers, activation, retention GC, historical importer
   and real canary remain separate accepted-authority gates; this crate enables none.

Run `cargo test --locked --manifest-path packages/deployment-control-plane/Cargo.toml
--test authority --test queue`. Cargo.lock pins the native dependency closure.

## Native executor interface (Task 2)

The macOS filesystem layer retains directory/file descriptors. It uses component
`openat(O_NOFOLLOW|O_NONBLOCK|O_CLOEXEC)`, `fstat`, descriptor ACL/xattr reads,
`renameat` and fsync. Every ancestor is checked; group/world-writable ancestors,
unknown ACLs, set-id/sticky file modes, flags, hardlinks and special files refuse.
The single supported inert xattr is `com.apple.provenance`, captured and restored;
other xattrs refuse. Rollback preserves bytes, UID/GID/mode, empty ACL, permitted
xattrs and mtime, while checking the transaction inode before overwrite/deletion.

```rust
FixtureRoots::open(&Path) -> Result<FixtureRoots>
FixtureRoots::lock() -> Result<MutationGuard>
FixtureRoots::artifacts() -> Result<ArtifactStore>
FixtureRoots::target() -> Result<TargetRoot>
ArtifactStore::import(artifact_sha256: &str, manifest_digest: &str) -> Result<SealedArtifact>
SealedArtifact::verify() -> Result<()>
SealedArtifact::read(relative_slot: &str) -> Result<Vec<u8>>
TargetRoot::read(relative_slot: &str) -> Result<Option<FileImage>>
Executor::fixture(&FixtureRoots) -> Result<Executor>
Executor::production(&Profile) -> Result<Executor>
Executor::lock() -> Result<MutationGuard>
Executor::apply(&mut self, &MutationGuard, &Queue, &Catalog, unit: &str,
                &Signed<Policy>, now: u64, authenticated_caller: &str) -> Result<Applied>
Executor::rollback(&mut self, &MutationGuard, &Queue, unit: &str) -> Result<()>
Executor::recover(&mut self, &MutationGuard, &Queue) -> Result<Vec<String>>
Executor::verify_installed(&mut self, &MutationGuard, &Queue, &Catalog, unit: &str,
                           &Signed<Policy>, now: u64) -> Result<CurrentInstallation>
Executor::finalize(&mut self, &MutationGuard, &Queue, unit: &str) -> Result<String>
Queue::daemon_installed_receipt(target: &str) -> Result<Option<TransactionReceipt>>
Queue::daemon_current_installation(target: &str) -> Result<Option<CurrentInstallation>>
```

Fixture construction refuses euid 0 and uses Darwin's kernel-selected per-user
private temporary root, independent of TMPDIR. Its targets/staging/transactions
remain children of that root; its service driver owns only `/bin/sleep` fixture
children. It cannot select production labels. Native production construction
requires euid 0 and reads only the fixed protected
`/private/var/db/agent-deployd/activation.json`; it checks the protected exact
Profile digest/revision and explicit `root-code` review facet. No activation file
is generated or installed by this library. Task 3 must authenticate the bootstrap
receipt and protected Catalog before construction; an arbitrary JSON activation
flag is not permission. The compiled canonical state root represents the Spec's
`/var/db/agent-deployd` root; bootstrap separately validates the fixed `/var` alias.
No `/var/run` group-writability exception is introduced.

The guard owns the permanent `production.lock` flock descriptor and is not Clone.
It is bound to its host root's device/inode. Production acquisition never creates,
unlinks or replaces the lock. `apply` borrows it and performs authoritative
precheck internally; it calls `Queue::begin_apply` with the flushed preflight
journal digest, then leaves the Queue in VERIFYING and returns `Applied.receipt`.
The outer Train MUST retain the same guard through all Goal verification,
rollback/finalize and release. `finalize` repeats physical/service readback,
records the returned transaction receipt in FINALIZING and lets Queue require all
current Goal receipts before APPLIED. A caller disconnect does not drop the guard.

A bundle is a fixed-origin `staging/<artifact_sha256>/` directory with
`manifest.json` plus exactly its declared flat blob names. The artifact SHA-256 is
of the raw manifest bytes; `manifest_digest` is the existing typed canonical
`trust::digest(ArtifactManifest)`. Each signed manifest entry binds one relative
app slot, blob, SHA-256, size and executable bit. The manifest's complete closed
blob set binds all bytes transitively. ASCII-only bounded relative names reject
Unicode ambiguity, traversal, case collisions and prefix collisions. File and
aggregate bundle/preimage limits are 64 MiB, with at most 4096 entries. Intake
reads/hashes twice through the same FD, creates 0400 private blobs, flushes them,
and publishes one sealed directory by rename. An existing sealed artifact remains
usable after staging disappears. Incomplete intake is retained and refuses reuse.

The journal contains flushed hash-linked sequential records: private complete
preimages/ABSENT markers, policy/attachment set, intended attempt, service image,
slot write intent, prepared inode, installed readback and owned-operation
intent/spawn/kernel identity/exit. Crash hooks exist only in `cfg(test)` code and
are absent from production builds. Runtime service operations use fixed native
launchctl templates for Runtime/W1/W2: adjunct bootout precedes parent bootout;
bootstrap preserves each preimage's loaded/disabled selection. Disabled+loaded
preimages refuse before mutation because this source does not change launchd's
disabled map. Periodic not-running jobs are observed as such; their process/runs
observations are separate from installed-release generation. Running processes
require Darwin birth, UID/GID, executable and actual kernel argv. Kqueue is
subscribed before old-process exit; unloaded readback and a complete process
census cover periodic tick races. Parent health is fixed `127.0.0.1:8790/health`
and is additional to process/installed-byte proof. No native mutator was executed
by the Task 2 fixtures. Root process census, current launchd shapes, all live
identities/plist hashes and real service readback remain bootstrap/live gates.

On known safe failure, rollback checks exact known transaction faces, restores
only captured slots and prior service semantics, and emits ROLLED_BACK. Unknown
owned actions, drift or failed evidence persistence quarantine the lane. Startup
recovery inspects nonterminal journals while locked: a proven pre-operation crash
settles BLOCKED/ROLLED_BACK, preserving STOP and budgets; unresolved service or
acceptance steps remain quarantined and are never replayed. Signed remediation
and `begin_apply` remain the only retry path. Corrupt journals latch host
quarantine, including when no Queue unit is currently nonterminal.

After a failed B restores an already installed A, the daemon appends a
`RestoredInstallation` receipt and CAS-updates only the current physical binding.
It binds A's unit, installed target generation, attempt and original transaction
receipt, the predecessor physical binding, fresh process generation, the failing
B attempt and exact physical restoration evidence. Historical transaction/Goal
receipts are immutable. `verify_installed` returns that current binding under the
mutex, without reinstalling/restarting. Late Goal and dependency checks reject
stale process generations; a fresh accepted verifier may reverify a prior PASS
against the restored process. Existing closure outbox entries, including delivered
ones, prevent duplicate Goal closure. An exact original signed desired intent can
attach passive late coverage only while that exact unit is currently installed;
it cannot allocate or replay an old desired intent.

### Exact production coverage of this candidate

Supported mutation scope: reviewed regular-file app slots below the fixed
`/usr/local/libexec/agent-core/app` root, using existing protected parent
directories; additions of files within those directories have ABSENT preimages.
All three fixed dsh services are included in quiescence/readback because W2 can
execute this app closure as root. Protected `NativeEnrollment` binds their
numeric identities, plist hashes, Node hash, runtime root argument, exact Profile
digest and initial app-file baseline. Later baselines are checked against the
Queue's installed receipt plus the protected journal.

Not implemented/enrolled by this candidate: new directory creation/deletion,
config or routing key writes/migrations, plist mutation, Node/harness replacement,
Watchdog incident migration, auth-service or svc-workflow execution profiles.
Those facets cannot be put into this app manifest as out-of-root destinations.
`NativeEnrollment` and passing fixtures do not establish bootstrap readiness or
current production enrollment. Task 4 must bind the intended release's complete
facet coverage; an unsupported required facet prevents enabling that profile.
Task 3 still owns socket/credentials, trusted clock/caller selection, the Train,
bounded accepted Goal verifier dispatch, bootstrap activation/trust validation,
protected SQLite open, and user-facing receipt redaction.

### Task 2 repair: retained executions and finalization eligibility

A retained journal directory is `<unit>-<mutation-attempt>-<preflight-ordinal>`.
The preflight ordinal comes from the existing Queue budget; it does not consume a
mutation attempt or allocate another intent. Receipt lookup matches the complete
immutable transaction receipt, and can also read the previous `<unit>-<attempt>`
name. Recovery matches the current Queue preflight ordinal and intended mutation
attempt, derived from its latest Precheck/Applying interval; earlier terminal
executions remain historical evidence. Old journals are never removed to permit retry. The 4096-slot admission cap
and journal writer/reader now compose: at most three install plus two rollback
records per slot, with 256 reserved service/phase records (20,736 total). Journal
enumeration uses that same cap; ordinary directories remain capped at 8192 and
journal-directory creation rejects before exceeding that parent cap.

Executor finalization has a per-unit durable `executor_pending` fence. It is
recorded before the preflight journal, and is cleared only after this ordering:
Goal proof/readback → Queue FINALIZING → immutable transaction receipt → internal
Queue APPLIED/outbox commit → flushed `Finalized` journal → eligibility commit.
`finalize` returns success only after eligibility commits. While fenced:

- actor `status` and idempotent `submit` project FINALIZING rather than APPLIED;
- new late attachments, late verification and live dependency capability reject;
- outbox delivery and closure acknowledgement exclude that unit;
- a pending internal APPLIED commit holds the mutation lane.

`daemon_status`, `daemon_installed_receipt`, `daemon_current_installation` and
immutable receipt/journal reads remain raw forensic/physical readbacks. Task 3
must not treat those internal values as externally actionable success. Use the
actor projection, dependency checks and outbox eligibility instead. Safely
finalized unrelated units retain their durable PASS outbox even when another
unit is unknown. No receipt or Goal closure is rewritten or duplicated.

Startup, under the guard, can clear the fence for the exact hash-checked terminal
`Finalized` record only after re-flushing that record/directory and binding its
complete receipt to the durable APPLIED attempt and immutable Queue receipt.
This reconciles eligibility without install, service action or Goal replay; it
does not silently clear an existing host mutation-quarantine latch.
A terminal rollback/Queue gap is explicitly quarantined; incomplete/corrupt
finalization retains the unit fence and host mutation quarantine. Test-only
EIO-at-fsync and truncated-record injection are not hardware-failure evidence.

## Task 3 daemon, protected intake and acceptance

`agent-deployd` has exactly two entries: no arguments uses the compiled production
paths; `--sandbox` uses the current directory only after `FixtureRoots` proves it
is non-root and private in Darwin's kernel-selected temporary tree. The sandbox
does not install or select a production service. Production requires the protected
activation proof before Queue/executor startup. The daemon takes a separate
permanent `daemon.lock` singleton before cleaning an abandoned socket; it never
unlinks `production.lock`. Guarded Executor recovery precedes listening/admission.

`agent-deployctl [--sandbox] <operation> <request-id> <catalog-digest>` uses the same
fixed socket. Allowed operations are `submit`, `status`, `receipt`,
`cancel-pending`, `retry-verification`. Requests use a four-byte big-endian length,
then strict JSON `{version:1,request_id,operation:{op,...}}`; the digest field is
`proposal_digest`, `digest`, or `unit_id` for the corresponding operation. The
socket accepts no proof blob, actor/UID, command, environment, path or root override.
Kernel `getpeereid` must match one protected caller entry. One UID has one `uid-N`
actor scope, even when several Agents share it; duplicate UID configuration refuses.
Socket group access is additional to the UID/effective-GID/profile/producer binding.
Status includes actor-authorized `receipt_digests`; receipt export contains only the
closed typed records, never private preimages, key bytes or external message bodies.

Transport bounds are 64 KiB / depth 16, a one-second total frame read deadline,
four concurrent connections per UID, 32 total and 120 connections per UID/minute.
Queue's existing admission quotas remain independently enforced. Status runs on
separate workers from Train; SQLite operations retain their bounded busy timeout.
Protected intake/configuration records have a separate 32 MiB / depth 32 bound;
this does not narrow the Executor's admitted 4096-slot manifest limit. Responses
are bounded to 8 MiB. Mailbox directories retain at most 8192 entries; no automatic
GC removes referenced evidence. Disk/flush errors remain refusals.

The protected `service.json` is `service::Configuration`: Catalog, numeric callers,
nonempty producer IDs, typed verifier bindings and socket GID. Files beneath the
fixed protected state root are descriptor-validated and not caller-selected:

- `intake/proposals/<canonical-Proposal-digest>.json`: original signed Proposal.
  The daemon retains exact content-addressed copies under `admitted/` before ACK;
  the Queue's existing durable dedupe therefore works after upstream disappearance.
- `intake/snapshots/<producer>-<revision>.json`: signed complete ProducerSnapshot,
  ingested by exact monotonic CAS, at most 16 per producer/poll. Complete pagination
  checks every registered watermark. An unavailable producer never means exhaustive.
- `intake/policies/<profile>.json`: current signed policy, fetched again with the
  permanent host guard held immediately before apply or late verification.
- `requests/<digest>.json`: immutable `read-existing-acceptance` observation request
  with unit/Goal/acceptance/attachment/attempt/physical generation and next receipt
  CAS revision. `intake/results/<digest>.json` supplies the accepted verifier's
  signed GoalReceipt. This asks for an existing result; it conveys no canary or
  business-write authority. Requests for unknown results are never resent.
- `closure/<outbox-id>.json`: durable eligible PASS outbox record. Only an exact
  producer-signed CAS acknowledgement in `intake/acks/<outbox-id>.json` marks it
  delivered. Local publication is not producer closure. Unavailable delivery stays
  pending and never reinstalls. Bootstrap must provision actual protected adapters
  capable of exchanging these files with the independent upstream services.

Typed verification is either `external-observation` with a positive deadline no
larger than 2000 ms, or `native-installed-readback` with the profile's accepted
Verifier issuer. Native readback accepts only the Executor-proven byte/process
face, using a separately provisioned 0600 key, with public-key/role/scope checked before apply, at `verifier-keys/<issuer>.json`;
it is suitable only when that check is the Goal's accepted contract. It must not
be configured for a business Goal requiring external semantics. No arbitrary health
command, subprocess verifier, external message, Grant or domain mutation is emitted.
All covered acceptance runs share a five-second external wait budget and one host
guard through finalize. Late acceptance calls `verify_installed` and uses its current
restoration binding, rather than a historical process generation.

Absent external acceptance creates an explicit protected daemon observation:
`issuer="daemon-observation", signature="", outcome=WaitingExternalAcceptance`.
This is intentionally **not a verifier signature** and needs no shared external
private key. Its private Queue entry permits WAITING only; public `record_goal`
still requires the accepted Verifier's valid signature. The same immutable receipt
CAS history binds all unit/Goal/attempt/attachment/process coordinates. It cannot
close a Goal or satisfy a semantic dependency. Later authentic acceptance advances
that revision under physical readback. OutcomeUnknown remains non-overwritable and
quarantines the lane. Pure FAIL/WAITING permits the shared proven install to finalize;
only independent PASS receipts create closure entries.

Production additionally requires `daemon-activation.json`, an Authority-signed
`DaemonActivation` payload (signing domain `agent-deployd:v1:DaemonActivation:`):
`epoch`, `configuration_digest`, `enrollment_digest`, `owner_acceptance_digest`,
`issuer_bindings_digest`. Epoch must be positive; its authority key needs `bootstrap`
scope. The daemon verifies its signature and exact configuration/native-enrollment/
issuer-bindings digests and canonical `/var` alias. `issuer-bindings.json` is a
protected, activation-bound adoption evidence document, not self-authenticating
proof of upstream isolation. Task 4's separately reviewed bootstrap must establish
its actual key custody/source/role facts and provision every directory, singleton,
mutex, socket owner/group and canonical executable dependency. This code generates
no keys, acceptance evidence, activation files, root directory or launchd job.
Unknown real upstream issuers remain a production blocker; fixture keys establish
only nonproduction behavior. Native Executor profile limitations remain unchanged.
