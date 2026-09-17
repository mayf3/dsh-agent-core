# Production Deployment Control Plane V1 conformance

Authority: accepted semantics `39865536ce51005f95a98473e77c2329078512c0`, accepted
base `bb5327f622a0333f1e11d945319e024a3731f05a`. Task 4 starts at
`28c09f73897b98ba3da520d43128f49eb101a0b0`, using the already reviewed Tasks 1–3.
Exact Task 4 source commit, final commands/results, generated artifact hashes and
retained failures are recorded in
`.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-report.md`.
This document is implementation evidence, never activation authority.

Status: bounded source implementation and inert preparation exist. Production
adoption is incomplete. Real upstream service contracts/key custody/protected
adapters, trusted build/review binding, exact initial app slots, protected metadata,
legacy writer/lifecycle denial and separately authorized real E2E remain open.
The candidate verifier returns `bootstrap_ready=false`; local fixture keys or
ad-hoc signatures cannot turn that into readiness. Independent whole-branch
review is performed by the controller; this author makes no independent PASS claim.

## Acceptance evidence mapping

F means disposable unprivileged fixture. M means isolated macOS integration.
P means production proof only after separate authorization. M fixtures use real
files, OS locks, kernel peer credentials, owned children and Unix sockets, but
the target service driver simulates launchd/restart. No P result exists here.
Each row links to a stable observation-to-contract relation in the
[evidence record](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md), including
source/log/test coordinates, inputs, negative cases, provenance and sufficiency.
All relations support their named F/M subclaims only; no complete ACC or P PASS
is inferred. T4-B01's old fixture counterexample remains historical contrary
evidence; the repair's separate boundary proof is
[EVD-DCP-T4-015](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md#evd-dcp-t4-015).

| Acceptance / Contracts | Executed source/fixture evidence | Remaining boundary |
|---|---|---|
| [ACC-001 / EVD-DCP-T4-001](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md#evd-dcp-t4-001) / CTR-001 | authority/queue producer revision CAS, signatures, complete pagination/watermarks; Train protected intake and retained admitted proposals | Real registered producer service and authenticated bridge not supplied; no production exhaustive census claim |
| [ACC-002 / EVD-DCP-T4-002](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md#evd-dcp-t4-002) / CTR-002,003 | queue concurrent dedupe, collapse, late attachments, supersession, A→B→A; Train exact attachment and once-only mutation/closure; restored installation binding | Exact adopted release faces, actual native install/restart counts |
| [ACC-003 / EVD-DCP-T4-003](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md#evd-dcp-t4-003) / CTR-004,006 | signed role/scope/author separation, source inclusion/reverts, policy epoch/lease/revocation under guard; bootstrap exact source/binary/load-graph hashes | Real source/merge/build/review issuer isolation; hashes are not attestations |
| [ACC-004 / EVD-DCP-T4-004](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md#evd-dcp-t4-004) / CTR-005,008 | filesystem traversal, symlink/hardlink/special-file/ACL/case/bounds/swap fixtures; sealed same-descriptor blobs, preimage/postimage; package unsafe metadata and undeclared files | Initial protected app slots/parents and accepted complete release coverage; existing app symlinks were not adopted |
| [ACC-005 / EVD-DCP-T4-005](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md#evd-dcp-t4-005) / CTR-007 | real socket kernel identity/shared UID scope, unknown fields/frame/depth/deadline/quota, disconnect/retry ACK and scoped receipts | Actual provisioned caller supplementary group and protected socket metadata |
| [ACC-006 / EVD-DCP-T4-006](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md#evd-dcp-t4-006) / CTR-008,017,019 | fixed native command/argv; parsed exact-byte plist dangerous environment rejection including XML-entity key; transitive Mach-O path/rpath/architecture/missing/extra graph rejection; exact-empty transition policy; package target/metadata rejection | Protected full closure and sealed-OS/platform-tool readback, no installed sudoers transition rule, real native runtime proof |
| [ACC-007 / EVD-DCP-T4-007](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md#evd-dcp-t4-007) / CTR-009,010 | independent processes/targets sharing permanent host mutex through acceptance/finalization; wrong guard/child-exit/corrupt inode refusal; legacy source guard negatives | Actual legacy sources/helpers/lifecycle managers cannot mutate outside lane under each enrolled caller |
| [ACC-008 / EVD-DCP-T4-008](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md#evd-dcp-t4-008) / CTR-010 | FIFO replacement age, dependency-ready order/DAG/cycles, semantic PASS, STOP persistence and explicit independent continuation | Operational upstream desired-state/dependency issuers |
| [ACC-009 / EVD-DCP-T4-009](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md#evd-dcp-t4-009) / CTR-010,011,020 | crash hooks at durable transaction edges, fsync/EIO and partial-record fixtures, retained budgets, remediation, owned-operation reconciliation; mailbox publication retry; versioned verification CAS | Injected syscalls/reachable crash residue are not hardware power-loss or production mutation proof |
| [ACC-010 / EVD-DCP-T4-010](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md#evd-dcp-t4-010) / CTR-012,013 | exact preimage/ABSENT install, hash/metadata drift, bounded fixture process readback, rollback/quarantine, restored physical binding; maximum4096-slot journal roundtrip | Real Runtime/W1/W2 launchd generation, current identities, native exit/readback and exact rollback |
| [ACC-011 / EVD-DCP-T4-011](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md#evd-dcp-t4-011) / CTR-014,015 | mixed Goal outcomes, bounded WAITING, unknown quarantine, immutable late receipts, generation CAS, finalization fence, producer closure ACK retry with zero reinstall | Actual per-Goal business acceptance/external canary results and protected transport; no messages or canary writes executed |
| [ACC-012 / EVD-DCP-T4-012](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md#evd-dcp-t4-012) / CTR-016,017 | signed standing authority/profile/policy truth table; production entry rejects nonroot/overrides; exact disabled package; no activation/signing secrets and no self-update route | Separate exact signed Owner bootstrap receipt/epoch; no per-head Owner gate for routine valid units is added |
| [ACC-013 / EVD-DCP-T4-013](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md#evd-dcp-t4-013) / CTR-018 | four repo entrance negatives including unreadable/unsafe marker parent; known installed/external/helper/lock inventory; svc-workflow GUI ineligible and auth-service disabled | Exhaustive protected sudoers/jobs/writers and actual write/launchctl/same-UID signal denial. Parent505/root vs child502 scopes are explicitly separate |
| [ACC-014 / EVD-DCP-T4-014](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md#evd-dcp-t4-014) / CTR-019,020 | no transition rule emitted/accepted; bounded socket/intake/parser/loader/artifact/queue/verifier, retained outbox/journals/preimages and corrupt state refusal | Installed rule absence, protected retention/disk state and real process lifecycle |

## Claim boundaries

Queue, immutable multi-Goal unit, once-per-intent install, immutable artifact
binding, host mutex, allowlisted native controller, declarative socket, independent
Goal receipts and standing-policy gates have executable nonproduction evidence.
The package contains no NOPASSWD rule and daemon execution uses no sudo. This is
not proof that existing host sudoers rules are absent. Known per-Goal/legacy locks
remain live/unretired; source guards alone do not establish global exit.

The supported proposed native mutation subset is existing regular app-file slots
under `/usr/local/libexec/agent-core/app`, with Runtime/W1/W2 quiescence/readback.
Directory creation/deletion, Node/harness/plist/config/routing replacement, incident
migration, external auth-service and svc-workflow drivers are not supported.
A required unsupported release facet blocks that release. No disabled/stub profile
or locally transformed dependency candidate is described as production ready.

The inert dependency candidate preserves x86_64 Node and dylib architecture; the
native controller uses the host's ARM64 build. Apple's sealed OS/shared cache is
an explicit platform boundary, not silently represented by launcher hashes.
Source/binary identity and transformed dependency digests are retained; original
Homebrew bytes and local ad-hoc code signing have no trusted-issuer status.

The deterministic repository structure verifier excludes Rust. Three existing
repository directory violations remain distinct from the supplemental Rust
file/child/depth check. No global structure PASS is asserted. No governing Spec
was modified. No root invocation, production write/restart/install/routing,
LaunchDaemon enablement, key provision, sudoers edit or live retirement occurred.

Historical executed source coordinates: full locked suite at
`3f59cf3aa4c11ae2dbec107e1284487b45bac099` passed105/105; final prospective-template
and guard-only changes at`8db5ada86ce13f5f22727cd8fc6d8734afad35a9` passed affected
bootstrap6/e2e3, clean strict all-targets Clippy, fmt and release build. Historical8db5ada
inert package manifest SHA256 is
`ea4e075fa3a04b9b0dffa8772869beee68e335e47344b7eefe79a306f672f18d`, with offline
integrity verified and BOOTSTRAP_READY=NO. Exact paths/raw evidence and all retained
failed observations are in the Task4 report. Final structure retains only the
three existing directory violations; Rust max479lines/20children/depth2, and the
legacy installer is498lines with its executable-line identity preserved.

Repair source `a263c8089e16b3614f37b5c4766af50f4d449275` passes affected adoption
15 executions /12 unique cases (3 shared helper cases compile in both targets)
under hostile TMPDIR, with strict Clippy/fmt/source checks. No full suite rerun.
The [replacement inert package](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md#evd-dcp-t4-016)
binds84 current source files; manifest
`1b4b4e1608f9335eb4db8aba319b0e19a0e8610ccefac2c1df2c25e6bbe949c6`, source digest
`da70fad9b07a064a07489c14aff006cc1781a66ca359e7d44522bb7fed1bebb7`.
It reuses byte-verified8db5ada release binaries because only test source changed;
the original package is preserved as historical evidence. Integrity passes;
bootstrap readiness remains false. RP-01–08 remain open, including unimplemented
real upstream-to-mailbox bridges and host/full-profile integration, beyond missing
configuration values. Scoped repair and whole-branch reviews remain controller-owned.
