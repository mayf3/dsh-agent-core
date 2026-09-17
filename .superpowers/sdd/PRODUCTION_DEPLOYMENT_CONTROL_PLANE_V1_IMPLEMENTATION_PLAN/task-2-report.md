# Task 2 — native filesystem boundary and transaction engine

## Status and coordinates

Bounded implementation candidate complete, awaiting the controller's independent
Task 2 affected-contract review. It is not whole-profile completion,
BOOTSTRAP_READY, privileged-bootstrap permission, or production conformance.

- Target: `mayf3/dsh-agent-core`.
- Isolated worktree: `/Users/yanfenma/workspace/worktrees/production-deployment-control-plane-v1-impl`.
- Task Base / starting Head: `14090ca2c89cccb9d0962602e88a15535b014a4f`.
- Governing accepted Spec: `PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1`, accepted via
  `bb5327f622a0333f1e11d945319e024a3731f05a`, reviewed semantics `3986553`.
- Consumed Task 1 repair: `9dc5e3c`; no second Queue or admission model.
- Implementation revision: the commit containing this report (no circular hash).
- Authorization: controller's bounded Task 2 delegation, published brief and plan.
  No subagents, other-checkout writes, Spec edits, sudo, root bootstrap, service
  installation, production launchctl mutator or legacy deployment invocation.

DEVELOPMENT_PREFLIGHT:
`REUSE / IMPLEMENTATION / EXEC_PLAN / CONTROLLED`; authority accepted in Base;
implementation authority `contracts`; isolated write surface YES; mutation mandate
VALID for source/non-root fixtures only; production mutation NO; privileged
bootstrap NO; evidence reviewability PASS through checked-in raw logs; no authority
amendment. DONE_WHEN is bounded code/API, real fixture evidence, durable report and
commit; parent owns independent review and later Tasks 3/4. Expansion boundary is
profile activation, new identity/domain, migration or out-of-scope production facets.

## Implemented behavior and exact scope

### Filesystem boundary

Retained descriptors, no arbitrary caller origin/path resolution: `openat` with
NOFOLLOW/NONBLOCK/CLOEXEC, directory ancestry checks, fstat type/link/owner/mode,
Darwin descriptor ACL, flags/xattrs, same-FD read/rehash, same-filesystem renameat,
and file/directory fsync. FIFO opening cannot block before type rejection.
Absolute/parent/Unicode/case/prefix collisions, extra/missing blob, hardlink,
symlink, unsafe ACL/mode, unknown xattr, oversized or changing bytes refuse.
`com.apple.provenance` is explicitly captured/restored; this host puts it on new
files. Darwin no-ACL ENOENT was observed and handled; other unreadable ACL results
refuse. No broad metadata repair exists.

A strict signed manifest identifies app-relative slots and fixed-origin flat blobs.
Raw manifest SHA-256 is artifact identity; typed canonical digest is the existing
manifest attestation digest. Blob SHA/size binds all bytes transitively. Intake
creates a protected temporary generation, rereads same opened inputs, fsyncs and
seals by rename. Rehashes continue before/after apply and installed readback.
Sealed CAS is reusable without staging. Incomplete generations stay retained and
refuse reuse; GC is not introduced. Limits: 4096 entries; 64 MiB per file and
aggregate manifest bytes / captured preimage bytes; bounded names/depth.

`MutationGuard` owns a permanent flock FD, bound to canonical host-root device and
inode, and is never Clone or an inherited string. Production requires the existing
permanent inode; no stale unlink/replacement. Fixture creation is non-root only,
confined to the kernel Darwin per-user temporary root (not TMPDIR), with a 0700
leaf. Guard mismatch prevents another fixture/root's token authorizing apply.

### Transaction and recovery

`Executor::apply` borrows the guard, does authoritative precheck, captures exact
private slot preimages/ABSENT markers and service state, flushes full policy and
attachment set, and calls `Queue::begin_apply` as the sole APPLYING entry. It does
not release the guard. Sequential hash-linked private records retain intent,
attempt, sequence, prepared/installed file identity, owned operation intent/spawn/
kernel identity/exit, service readback and receipt. Atomic individual renames are
not described as whole-release atomicity.

Known failures restore only exact transaction-owned postimages by CAS; restore
includes UID/GID/mode, permitted xattrs/empty ACL and mtime. Transaction-created
ABSENT slots are removed only at their exact observed identity. Unrelated drift
and unresolved temporary writes are not overwritten/deleted. Service state is
restored separately and verified. Unknown actions remain quarantined. Startup
recovery holds the mutex and performs one bounded evidence pass; proven pre-action
crashes can settle BLOCKED/ROLLED_BACK, preserving STOP and budgets; later unknown
service/verification effects are never replayed. Corrupt journals latch host
quarantine even without a currently nonterminal Queue row.

The public API and exact Train sequencing are in
`packages/deployment-control-plane/README.md`, “Native executor interface (Task 2)”.
The principal API is `FixtureRoots` / `ArtifactStore` / `TargetRoot` /
`MutationGuard`, `Executor::{fixture,production,lock,apply,rollback,recover,
verify_installed,finalize}`. Authoritative precheck is inside apply. Task 3 retains
the same guard through Goal acceptance and finalize, uses all immutable
`daemon_attachments`, and supplies authenticated caller/current clock/policy.

### Service boundary

Functional native source contains only fixed Runtime/W1/W2 targets and native
launchctl argv templates; it does not invoke wrappers or candidate programs.
W1/W2 quiesce before the shared parent. Exact protected Node/plist hashes and the
whole reviewed Profile digest are enrollment-bound. Explicit `root-code` review is
required for the shared W2 app closure. Current numeric UID/GID values are read
from the protected bootstrap enrollment; none were guessed from service labels.
Actual kernel argv, executable path, UID/GID and process birth identify running
processes. Kqueue NOTE_EXIT is registered before bootout for observed running
processes; unload readback plus complete kernel process census closes periodic
start/tick races. All command children have bounded owned wait/cancel/readback.
Periodic not-running state is distinguished from failed/unknown state and from
installed release generation. Fixed parent health is additional evidence.

Loaded/disabled selection is preserved. A loaded-and-disabled preimage refuses
before mutation: this driver has no enable/disable write authority. Missing or
inaccessible root census/identity/launchd proof fails closed. This native source
was compiled but no production launchctl mutator was run.

The isolated fixture driver owns `/bin/sleep` processes and explicitly records
fixture start/stop events rather than claiming native launchd execution. Real
Darwin birth/argv/path/kqueue APIs are separately exercised against an owned
non-root child. Crash-worker helpers use two-second natural lifetime and cfg(test)
fault hooks; normal fixture children are explicitly killed/joined on teardown.

### Restored installed release and late verification

A concrete integration gap was repaired within the controller's authorized minimum
Queue extensions: failed B can restore A with a new physical process generation,
while A's historical transaction/Goal receipts remain immutable.

`CurrentInstallation` exposes current installed unit/target generation/attempt,
original transaction receipt, current process generation and binding digest.
`RestoredInstallation` append-only receipts bind the predecessor physical binding,
restoring B attempt, exact restoration evidence and A's fresh process generation.
Only the internal executor proof path may CAS the `physical_current` projection.
It does not change deployment attempt budgets or rewrite historical receipts.

`Executor::verify_installed` checks exact current physical state under the mutex
without install/restart. Late Goal and dependency checks use the current physical
binding; stale process-bound semantic PASS is insufficient. The accepted verifier
may reverify a historical PASS at the new process generation, while the existing
closure outbox record (including delivered entries) prevents duplicate closure.
An original signed desired intent can add passive coverage only to the exact
currently installed unit; an old desired state cannot allocate/replay an intent.
UNKNOWN outcomes still prohibit recovery/verification overrides.

Focused additions to the existing Queue are `daemon_installed_receipt`,
`daemon_current_installation`, the internal proof-bound safe-settlement path and
restoration CAS. No new transport methods, queue, or alternate budget model exists.

## Exact production facets supported and deferred

Supported mutation: regular-file slots under the fixed
`/usr/local/libexec/agent-core/app` release root, with existing protected parent
directories. File additions within those directories have ABSENT preimages. The
fixed Runtime/W1/W2 group is included because its processes may execute that app.
Initial app-file baselines, plist hashes, Node hash, numeric service identities and
runtime root argument must be re-pinned by the protected reviewed bootstrap.
Later app faces are checked against Queue installed receipts and protected journal.

Unsupported by this candidate (cannot be smuggled into app-relative manifests):
new directory creation/deletion; configuration/routing key mutation or migration;
plist mutation; Node replacement; harness replacement; Watchdog incident migration;
auth-service or svc-workflow profiles/identity migration. The fixed dsh driver
operates existing enrolled plists; it is not a plist installer. Every required
unsupported facet blocks enabling that release/profile until implemented/reviewed.
These limits must be assessed by the Task 2 reviewer against CTR-005/008/012/013
and bound by Task 4 before any whole-branch BOOTSTRAP_READY claim.

Task 3 still owns protected Queue open, socket/peer credentials, trusted catalog/
activation/clock/caller, outer Train lifetime, actual accepted Goal verifier
execution, receipt redaction and closure delivery. Production construction checks
fixed protected activation data; authentic bootstrap acceptance and canonical
`/var` alias validation remain mandatory Task 3/4 obligations.

## Executed evidence

Final command, exit 0:

```text
cargo test --locked --manifest-path packages/deployment-control-plane/Cargo.toml \
  --lib --test authority --test queue --test filesystem --test transactions -- --nocapture
```

Final result: **64 passed, 0 failed**, comprising library 6, authority 12, queue 25,
filesystem 12 and transactions 9. Two helper entrypoint tests intentionally return
without worker environment in the parent; real child runs are separately visible
in the logs. No compiler warnings. This includes all 37 affected Task 1 tests.
`cargo fmt --check` and the staged source-only `git diff --check` passed.
Raw Cargo logs preserve their original trailing blank lines, which the all-files
whitespace checker reports at EOF. Vendored governance integrity passed. Manual Rust structure: max 346 physical lines, 13 immediate children,
module depth 2; all below the limits (machine general verifier does not cover Rust).

Raw observations are retained in `task-2-evidence/` beside this report:

- `final-tests.log`: complete final executed suite and every crash/storage edge.
- `01-filesystem-red.log`, `03-mutex-green.log`: positive real descriptor/flock RED→GREEN.
- `04-artifact-red.log`, `06-artifact-green.log`: real intake/seal RED→GREEN.
- `07-transactions-red.log`, `09-transactions-green.log`: real install/rollback RED→GREEN.
- `14-metadata-red.log`, `17-xattr-green.log`: real xattr rejection and Darwin provenance handling.
- `19-known-recovery-red.log`, `20-known-recovery-green.log`: proven no-effect crash settlement.
- `27-cas-red.log`, `28-cas-green.log`: sealed CAS independent of disappeared staging.
- `29-restored-binding-red.log` through `32-late-attach-green.log`: restored-A/failed-B,
  stale semantic generation rejection, dependency freshness, late coverage and no reclosure.
- `23-kernel-api.log`: real non-root Darwin process identity/argv/birth/kqueue and
  timeout kill/join, independent of simulated launchd behavior.
- Final suite: child process exit after **all 13 durable apply edges**, lock
  reacquisition and no replay; actual directory EACCES at **all 13 edges**, no
  unreceipted replay and blocked lane; direct multiprocess holder kill preserves
  permanent inode and durable intent. Exact safe early dispositions and later
  quarantine are printed separately.
- Final suite: ACL, symlink at each nested target ancestor, hardlink/FIFO/writable
  payload, traversals/case/Unicode, missing/extra/oversized bundle, concurrent byte
  mutation, sentinel preservation, partial two-file rollback, original 0440 mode,
  ABSENT deletion and unrelated drift rejection.
- `34-fixture-mode-red.log` records the final confinement tightening finding:
  Rust tempfile default was 0755; fixture setup now explicitly uses 0700. No
  implementation check was weakened to hide that failure.
- `final-fmt.log`, `governance.log`, `rust-structure.json`: final checks.

EACCES is an actual filesystem write-denial fault, not a claim of ENOSPC or a
hardware fsync failure. The source propagates fsync/write failures, but no real
full-disk/hardware fault or production daemon crash was injected. Native launchd,
privileged root process census accessibility, current disabled-map shape, real
installed service identity/artifact/canary and legacy-bypass denial remain
unexecuted live gates. These fixtures establish bounded source evidence only.
