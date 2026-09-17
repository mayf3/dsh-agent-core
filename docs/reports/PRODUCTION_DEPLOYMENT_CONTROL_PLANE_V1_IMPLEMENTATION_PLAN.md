# Production Deployment Control Plane V1 Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development. Execute tasks
> sequentially with a fresh implementer and independent affected-surface review.

**Goal:** implement and independently verify the accepted control plane through
BOOTSTRAP_READY; do not activate it or mutate production.
**Architecture:** a native Rust daemon owns the trusted catalog, signed intake,
durable queue/journal, one OS mutex and fixed privileged executor. Non-root clients
submit identifiers and import authenticated producer/build/review observations;
the same engine runs against isolated fixture roots for negative testing.
**Tech stack:** Rust 2021; serde/serde_json, sha2, hex, ed25519-dalek, rusqlite,
libc; exact resolved dependencies committed in Cargo.lock. Standard POSIX descriptor
operations on macOS; no root shell, package install or artifact-provided hook.
**Spec:** `docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md`, accepted via
PR #304 at `bb5327f622a0333f1e11d945319e024a3731f05a`, reviewed semantics `3986553`.

## Global constraints and preflight

```text
AUTHORITY_ACTION=REUSE; ROUTE_STAGE=IMPLEMENTATION; AUTHORITY_ACCEPTED_IN_BASE=YES
PLAN_LEVEL=EXEC_PLAN; ASSURANCE_LEVEL=CONTROLLED; IMPLEMENTATION_AUTHORITY=contracts
IMPLEMENTATION_ALLOWED=YES; NON_PRODUCTION_VERIFICATION_ALLOWED=YES
PRODUCTION_MUTATION_ALLOWED=NO; PRIVILEGED_BOOTSTRAP_ALLOWED=NO
GOVERNING_SPEC_UNMODIFIED=YES
```

No production paths may be written, services restarted, ACL/sudoers changed,
LaunchDaemon installed, or legacy entrance actually switched. Bootstrap output is
an inert, reviewable package. Production mode must fail closed without its later
root-owned activation receipt. Fixtures must refuse euid 0 and paths outside their
private temporary tree. Do not substitute mocks for real filesystem/OS-lock/socket
tests; launchd/identity-changing operations that cannot run without root are
explicitly simulated and remain post-authorization gates.

20 accepted Contracts and 14 Acceptance rows remain binding. Limit handwritten
files to 500 lines and directories to 20 tracked children, with package.json marking
the Rust package's module root. Do not edit unrelated legacy structure debt.
Document every rejection with a typed code/phase, never secret values. No root
signing private key is shipped; fixtures own ephemeral test keys only.

## Task 1: trusted model, producer intake and persistent queue

**Files:** create `packages/deployment-control-plane/{Cargo.toml,Cargo.lock,package.json,.gitignore,README.md}`;
`src/{lib.rs,error.rs,model.rs}`, `src/trust/{mod.rs,verify.rs}`,
`src/queue/{mod.rs,schema.rs,admission.rs,lifecycle.rs}`;
integration tests under `test/{authority.rs,queue.rs,common/mod.rs}` with explicit
Cargo test targets (no new scripts at repository root).

**Interfaces:** expose typed Catalog/Profile/DeploymentUnit/ReadyRecord/Policy/
Review/BuildAttestation and `Signed<T>`; strict serde unknown-field rejection;
canonical digest helper; `verify_signed` with Ed25519 strict verification and typed
issuer roles. `Queue::open(path)`, transactional submit/admission/status/next-ready/
transition/receipt/goal-outbox methods. Publish concrete signatures in README/report
for Task 2/3. All externally mutable state changes are database transactions with
foreign keys and FULL synchronous durable writes; no caller-supplied SQL.

- [x] Write and run failing authority tests before verifier implementation.
  Required observable examples: forged signature, changed signed payload, author
  self-review, expired/replayed epoch, wrong artifact/source/profile, missing Goal
  coverage, unknown ID/path/command field; all reject with no admitted unit.
  Example assertion shape:
  ```rust
  let result = admit_fixture_with_tampered_artifact();
  assert_eq!(result.unwrap_err().code(), "ARTIFACT_MISMATCH");
  assert_eq!(queue.unit_count().unwrap(), 0);
  ```
- [x] Implement signed producer snapshot/CAS/watermark completeness, trusted canonical
  lineage/build/review binding, policy freshness ≤300s and monotonic anti-replay.
  Accepted/source/review claims must be actual signed structured records rather than
  caller booleans. Readiness registration validates producer identity and revision.
- [x] Write and run failing queue tests: concurrent identical requests; same-artifact
  multi-Goal collapse and late attachment; exact coverage vs reverted source;
  A→B→A new daemon intent; caller cannot reset retries; DAG/cycle/missing dependency;
  FIFO age inheritance; failure STOP/explicit CONTINUE; dependency semantic receipts.
  Example assertion shape:
  ```rust
  assert_eq!(submit(request.clone())?.unit_id, submit(request)?.unit_id);
  assert_eq!(queue.install_intents_for_target("fixture-runtime")?, 1);
  ```
- [x] Implement immutable descriptor identity, actor-bound transport idempotency,
  daemon-owned intent/attempt sequence, bounded 3 preflight/2 mutating attempts,
  protected journal/Goal outcomes/outbox, revision CAS and quotas. No user PID or
  outcome claim unlocks quarantine. Preserve dedupe across reopen/crash.
- [x] Run `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml
  --test authority --test queue`; commit code and full RED/GREEN evidence in report.

## Task 2: native filesystem boundary and transaction engine

**Files:** create `src/fs/{mod.rs,secure.rs,artifact.rs,mutex.rs}` and
`src/transaction/{mod.rs,apply.rs,recovery.rs,service.rs}`;
`test/{filesystem.rs,transactions.rs}`. Extend existing model/queue only for these
accepted interfaces, keeping Task 1 behavior passing.
**Consumes:** Task 1 verified typed Unit/Profile/Queue/Receipt.
**Produces:** descriptor-safe ArtifactStore/TargetRoot, `MutationGuard`, and
`Executor` methods for precheck/apply/rollback/recover. Production service driver
accepts fixed reviewed profile enums, never command strings. A fixture driver must
be isolated, unprivileged and clearly named; it cannot select production targets.

- [ ] Write failing real filesystem tests: every ancestor symlink, hardlink/special
  file, ACL, absolute/parent/Unicode/case duplicate names, missing/extraneous slot,
  oversized/mutating input, caller-writable root dependency; sentinel outside root
  remains unchanged. Use openat/fstat/renameat relative to retained descriptors;
  checking then reopening a pathname is not an acceptable implementation.
  ```rust
  assert!(import_adversarial_bundle(&private_root).is_err());
  assert_eq!(std::fs::read(&outside_sentinel)?, original);
  ```
- [ ] Implement fixed-origin artifact intake with pre/post SHA, protected atomic seal,
  full file/type/owner/mode/ACL checks and same-fd reads. Use profile-owned slot mapping
  for install destinations; bundle cannot add executable hooks or filesystem paths.
- [ ] Write real multi-process lock/crash tests. One permanent inode/descriptor lock
  covers authoritative precheck through acceptance/finalize/rollback. Killing a
  holder releases OS lock but leaves durable nonterminal intent that blocks new work
  until recovery. No environment/string inheritance seam or stale lock unlink.
- [ ] Implement complete preimage (ABSENT markers, code/config metadata/service state),
  flushed write-intent/per-slot journal, temporary+rename+fsync install, readback,
  fixed absolute launchctl argv with bounded child ownership, exact generation proof,
  rollback CAS and startup recovery. Unknown effects quarantine, not replay.
- [ ] Inject failures at each durable edge, partial install, restart timeout, rollback
  drift, disk failure. Verify exact restoration or explicit quarantine, bounded
  attempts and no unrelated writes. Known fully restored failure may retry under
  the same daemon intent only with fresh verified remediation and remaining budget.
- [ ] Run Task 1 and filesystem/transactions suites; commit evidence and interface report.

## Task 3: daemon, Train, producer clients and independent Goal closure

**Files:** create `src/service/{mod.rs,protocol.rs,server.rs,train.rs}`,
`src/bin/{agent-deployd.rs,agent-deployctl.rs}`;
`test/{socket.rs,train.rs}`. Extend model/queue/transaction where integration requires.
**Consumes:** Catalog, trust verifier, Queue, Executor and MutationGuard.
**Produces:** working root production entry (refuses absent activation), unprivileged
private sandbox entry, identifier-only client and trusted signed intake catalog import.

- [ ] Failing real Unix-socket tests first: kernel peer IDs, scoped status/receipts,
  strict 64KiB frames/depth/unknown fields, UID spoofing/shared UID ownership, bounded
  disconnect/partial reads/quotas, durable ACK/reconnect dedupe. No public root/path/env
  override. Production entry uses compiled canonical locations only.
- [ ] Implement fixed profile/caller catalog authentication, signed producer/readiness
  polling/import and complete watermark census. Agent submissions contain only
  catalog identifiers; signed producer/build/review content is fetched by protected
  digest from fixed intake, not accepted as proof from a client boolean.
- [ ] Connect automatic Train scheduling, DAG/FIFO, fresh policy under mutex, execution,
  restart/readback, verification, receipt, finalize and closure outbox. No worker gap
  may release the global mutex between install and Goal acceptance.
- [ ] Failing integration test: one artifact covers three Goals, two verifiers PASS
  and one FAIL/WAITING; assert one install and one success-path restart, separate
  immutable receipts, two outbox closures and one blocked/pending Goal. Retry/late
  coverage/outbox redelivery does not reinstall. A required non-idempotent canary
  with unknown result remains unknown and is never resent.
- [ ] Verification profiles are typed/native/read-only by default; existing explicit
  external canary authority must be independently attested and deadline bounded.
  No dynamic root health command. Outbox uses authenticated producer CAS/ack and
  cannot close a different Goal. Service unavailable is BLOCKED, not fake PASS.
- [ ] Test restart/reopen of real daemon process at durable boundaries, status after
  client timeout and simultaneous submit/drain across targets. Run complete crate
  suite; commit exact RED/GREEN tests and executed daemon evidence.

## Task 4: source adapters, bootstrap bundle and complete security verification

**Files:** create `src/bootstrap/{mod.rs,bundle.rs,verify.rs}` and
`test/{bootstrap.rs,e2e.rs}`; update package README and create
`docs/reports/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_CONFORMANCE.md`.
Legacy repo entry source adapters are limited to the inspected installer/routing/
Watchdog transaction: retain pre-bootstrap behavior and add a fixed protected
enrollment-marker guard; source changes must not increase grandfathered file size.
External installed wrappers remain untouched; bundle inventory declares their
exact disablement/permission/lifecycle checks for the later authorized cutover.

- [ ] Failing package tests first: no activation/signing secrets, mismatched binary/
  source hash, user-writable executable/ancestor, nonallowlisted target, unsafe
  sudoers rule, enabled GUI/502 svc-workflow, missing lifecycle denial or legacy
  inventory. Every case refuses BOOTSTRAP_READY. Test generated files by parsing
  plists/manifests and verifying file hashes; merely generating text is not proof.
- [ ] Implement inert bundle generation: reviewed binary + dependency/source digests,
  disabled LaunchDaemon plist, exact prospective profiles/trust-key IDs, fixed
  ownership/ACL/mode/socket identities, dry-run installation/rollback manifest,
  complete legacy inventory and negative probe plan. No root execution in generator.
  Profile enabling requires a distinct signed Owner bootstrap receipt; blank/unresolved
  host facts are explicit blockers, never permissive defaults.
- [ ] Implement offline preflight verifier for package integrity and all profile
  constraints; production-only metadata checks are listed as later execution gates.
  No generic sudo passthrough or NOPASSWD ALL. Transition deployctl is optional and
  will not be enabled when native daemon is available; verify there is no installed rule.
- [ ] Whole-branch security review covers the user's full attack list and every
  accepted Contract. Freeze one blocker union, repair once and focused re-audit.
  Preserve valid blockers; do not claim readiness from a stub/disabled-only engine.
- [ ] Final checks: locked cargo test, fmt, clippy, release build, structure delta vs
  accepted base, no governing Spec diff, secret-safe artifact inspection, process/socket
  cleanup and no production mutation evidence. Map each ACC row to executed evidence
  or post-authorization production proof; distinguish fixture/mocked launchd from real.
- [ ] Deliver IMPLEMENTATION_COMPLETE / TESTS_PASS / INDEPENDENT_REVIEW_PASS /
  BOOTSTRAP_READY with exact hashes and the one concrete Owner bootstrap request.
  Whole production Goal remains incomplete until separately authorized adoption/E2E.

## Contract coverage and stop boundary

Task 1 owns CTR 001–004/006/010 and durable parts of 011/015/020; Task 2 owns
005/008/009/011–013; Task 3 integrates 001/007/010/014–016/020; Task 4 owns
017–019 and the complete ACC-001–014 conformance audit. Every overlapping interface
gets integration tests in Task 3/4. No Contract is satisfied solely by a type or test
name. Stop only at genuine privileged bootstrap authorization, an irreducible
authority/security blocker, or requested BOOTSTRAP_READY delivery.

## Task 1 checkpoint — 2026-09-17

Trusted core implemented at `2624e16`, repaired at `9dc5e3c381e5229a70011fe8f65ac0430f872175`.
Independent initial review froze six concrete blockers; all six closed in one repair
and scoped re-audit by `/root/dcp_core_review`. Core owned suite 37/37 plus final
affected ACK test 1/1 and format check passed. Evidence and both reviews are retained
under `.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/`.
`CORE_REVIEW_PASS=YES`; overall implementation/security/bootstrap readiness remains
pending Tasks 2–4. Accepted Spec and production state were not mutated by this work.
