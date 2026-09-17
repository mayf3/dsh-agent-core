# R02 successor closure

Status: R02 implementation, frozen-source verification and fresh independent
scoped security review PASS. Bootstrap readiness remains NO. All completion flags
below refer only to this successor lane, not the parent implementation or Goal.

## Authority and scope

Goal `PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_R02_CLOSURE`, parent
`PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1`. Owner explicitly authorized this narrow
successor lane. Accepted Spec semantics3986553 remain unchanged; applicable
Contracts are CTR010/011 and CTR014/015, with directly affected identity, mutex,
state and evidence safeguards retained. No new Product Authority is needed.

Base delivery `1cbdaaff03fffa02bfa0394c7a7a9e9ed47ba696`; inherited executable
`277a5e8832938e6b2232d11949aedfb92cd0e318`. New branch
`codex/production-deployment-control-plane-v1-r02-closure` reuses the existing
isolated worktree. Parent branch remains pinned and every original run record,
accepted Spec and governance file is byte-identical to the base.

Test-first commit `4ab507d` contains six initial regression tests and their actual
RED logs with production source unchanged. Final executable/source freeze:
`8ab5904fc0b79ba2e565469f1127312bb36c4e58`.
The [brief and nonproduction runbook][brief] preserve mandate and stop boundaries.

## Root cause and minimal repair

`Train::tick` called `recover_failed()?` before retrieving pending late-verification
requests. An expired or mismatched B record propagated its rejection through that
call, repeatedly starving current Applied A. Meanwhile, the recovery-binding
`Err(_) => continue` branch also discarded real shared-journal uncertainty. The
new regression proves both directions; one blanket treatment is inappropriate.

`RecoveryFailure` carries a daemon-determined unit-local/global scope at the actual
failure stage. Unknown error codes, trusted-key/metadata defects, journal/transaction
uncertainty, mutex errors and store failures remain global errors. A finite set of
definite unit/proof refusals remains local. The selected mailbox unit and status
revision are checked before using payload identity. When recovery intake is read,
missing protected ancestry remains global; missing only the exact unit/revision
file means no proof. An already-unrecoverable B need not consume its mailbox;
this is not a universal intake-namespace census before every read-only operation.

Unit-local refusals are stored through the existing protected append-only receipt
ledger, deduplicated by unit/revision/operation stage/reason and bound to profile,
target, intent, expected generation and attempt counts. This adds no schema or
public operation. Failure to commit the refusal propagates and blocks the tick.
No recovery record is deleted or accepted merely because it is stale. B's state,
STOP pause, budgets and actual recovery checks are unchanged.

A proceeds through the existing `verify_late` and `verify_installed` path: its own
authorization/policy, held permanent mutex, finalized/current installation,
physical generation, complete file face, health, sealed artifact and exact Goal
receipt still gate acceptance. There is no new acceptance bypass or mutation retry.
The fixed32-row future multi-resource limitation was not changed.

## Changed files

All paths below are relative to `packages/deployment-control-plane/`:

- `src/transaction/remediation.rs`: stage-scoped error classification, preserve global journal failure.
- `src/transaction/mod.rs`: expose that internal error type to intake/Train.
- `src/service/intake.rs`: distinguish protected namespace failure from per-record absence/decoding.
- `src/service/train.rs`: persist local rejection and retain global error propagation; bind mailbox identity.
- `src/queue/service.rs`: bounded, append-only rejection receipt; no lifecycle/budget/STOP mutation.
- `test/common/recovery_isolation.rs`: eight real daemon/socket positive and negative cases.
- `test/train.rs`: include the new test module.

New tests, all in `test/common/recovery_isolation.rs`:

- `r02_expired_unit_recovery_does_not_starve_current_acceptance`
- `r02_incomplete_unit_recovery_metadata_does_not_starve_current_acceptance`
- `r02_mismatched_unit_recovery_does_not_starve_current_acceptance`
- `r02_cross_unit_record_is_rejected_without_starving_acceptance`
- `r02_global_quarantine_still_blocks_current_acceptance`
- `r02_unknown_shared_transaction_still_blocks_current_acceptance`
- `r02_rejection_store_failure_still_blocks_current_acceptance`
- `r02_missing_protected_recovery_namespace_still_blocks_acceptance`

## Executed evidence

Environment: nonroot macOS fixtures beneath the kernel-selected private0700 temp
directory, real sandbox daemon/Unix socket/SQLite/files/owned child processes.
Launchd and actual production runtime are never connected. Fixture service health
and process generation are real fixture readbacks, not production proof. Each
scenario installs A, leaves a Goal waiting, then lets same-profile B fail prewrite;
A's bytes/generation and B's zero mutation count remain checked throughout.

Evidence directory: `.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_R02_CLOSURE/evidence/`.

| Stable relation | Observation, target and scope |
|---|---|
| EVD-DCP-R02-001 | Logs02–03 at test commit4ab507d against unchanged executable277a: expired/malformed/mismatched B proof starves A; unknown shared transaction incorrectly reaches A's verifier. Expanded run2PASS/4FAIL. Supports R02 and directly affected global-scope counterexamples, not production exploit claims. |
| EVD-DCP-R02-002 | Log10: expired, incomplete, mismatched-generation and cross-unit records all leave B Blocked while A receives a signed PASS and exactly one outbox closure with no reinstall. Durable rejection binds B and remains one record across repeated ticks. Supports CTR014/015 unit isolation. |
| EVD-DCP-R02-003 | Log10: global quarantine, unknown shared transaction, rejection-store failure and missing protected recovery namespace prevent A from reaching the verifier. Supports the user-mandated fail-closed boundary under these injected fixture states. |
| EVD-DCP-R02-004 | Log11: existing protected preflight/known rollback recovery and exhausted mutation budget3PASS. Log12: ordinary waiting-to-late-PASS/closure1PASS. Existing valid recovery and late verification are retained. |
| EVD-DCP-R02-005 | Logs15–19 and receipt20 bind debug build, complete locked all-target suite176PASS, fmt, strict Clippy and fresh release to8ab5904. Inventory14 remained byte-identical throughout. Full run2026-09-17T22:52:19Z–22:58:16Z; final release completed22:58:28Z. Supports frozen-source tests/build, not actual deployment. |
| EVD-DCP-R02-006 | Independent reviewer /root/dcp_r02_security_review completed PASS at8ab5904, 2026-09-17T22:59:58Z. Supplied diff, all90 frozen file hashes, final gates and release hashes independently checked. No new scoped blocker, Spec gap or follow-up. Source/nonproduction-fixture scope only; see [security review][review]. |

Log05 records the first six-case GREEN. Logs06–07 preserve additional cross-unit
and missing-namespace RED observations against the intermediate source delta08;
they are development observations, not final-source runs. Log10 has all eight
GREEN cases; the decisive complete-source run is separately bound to8ab5904.
No failed invocation is retrospectively labeled PASS.

The full suite's176 top-level executions are lib35, authority17, bootstrap13,
e2e8, filesystem17, queue30, socket9, train33 and transactions14. Three binary
targets have0 tests. The66 nested worker summaries are excluded from the count;
shared helper definitions may execute in more than one target. All commands,
timestamps and return codes are retained in20-final-gates.json. Release hashes
are in26-release-hashes.json; local compilation is not an authentic build attestation.

Existing global structure verifier debt remains three unchanged directory limits;
manual Rust inventory24 has88files, max479lines/20children/depth2. No global
structure PASS is claimed. Governance integrity21 passes; authority/history
identity22 is empty with exit0.
Raw logs and supplied review diffs are retained byte-for-byte. The final all-file
whitespace check flags only captured command-output whitespace and diff context;
source/report/review text checks pass. These raw artifacts were not reformatted
to manufacture a clean whitespace result.

## Independent review and readiness

Fresh [security review][review] closes R02 and the directly affected composition
of recovery, journal/mutex/authority checks and ordinary acceptance. The other
eight closed findings and fixed32-row future debt were not reopened. Review
Head8ab5904 and executable bytes are frozen; the final delivery commit adds only
this report and retained successor evidence. The original run records remain
historical and byte-identical, including their then-correct unresolved R02 status.

### Fresh bootstrap dependency assessment

This is a source/contract assessment at8ab5904 after R02 PASS, not a live host
observation, a bootstrap execution or a new integration implementation.

Accepted CTR-DCP-004 establishes trusted issuers through bootstrap; CTR-DCP-017
requires a separately authorized exact controller/profile/trust-root manifest,
numeric identities, enrollment and rollback package. Spec section7 orders exact
nonprivileged preparation before separate Owner authorization, then disabled
installation, enrollment/retirement, real canary and normal Train enablement.
Source PASS does not satisfy that preparation by itself.

The current implementation gives a precise, split answer for the separate
`issuer-public-input-handoff.md` dependency:

| Dependency | Required phase and implementation basis |
|---|---|
| Real issuer identities, public keys, allowed scopes, isolated custody and authoritative source bindings | **Before BOOTSTRAP_READY / exact Owner bootstrap request.** `bootstrap/preparation.rs:247–302` requires six distinct role/key/service bindings and custody receipt digests. `:309–352` verifies nine exact, fresh, independently anchored signed preparation proofs. The proposed input cannot establish its own trust. Missing real signing services/custody cannot be deferred to production acceptance. |
| Producer/verifier integration contract and configuration | **Before freezing the exact preparation/configuration.** `bootstrap/binding.rs:73–126` binds producer IDs/scopes and verifier profiles/deadlines to the enrolled profile. The requested authentication, authoritative readiness/CAS/watermark and result-correlation facts are inputs to the real bridge; fixture mailboxes do not establish them. This lane supplies none of those missing facts. |
| Protected adapter installation and operational upstream-to-mailbox connection | **Bootstrap/post-bootstrap integration before standing activation and end-to-end operation.** `bootstrap/prospective.rs:202–204` places provisioning of real issuers/authenticated protected adapters before activation and canary. Root installation is a later separately authorized operation. `verify_resolved` does not call a remote issuer or prove bridge liveness; its successful local predicate must not be represented as live integration proof. Real upstream bridges remain unimplemented and require their own bounded integration lane once public contracts exist. |
| Real producer census, signed business results, closure ACK and harmless production canary | **Activation/end-to-end production acceptance evidence.** Spec section7 and CTR001/014/015 require these downstream outcomes. They are separate from inert preparation and require their own operational authorization. |

Thus the handoff is not one indivisible dependency that can all be postponed:
its trust/custody and exact binding inputs are pre-bootstrap preparation needs;
protected provisioning and live operation follow the separately authorized
bootstrap sequence. The current preparation validator does not itself attest that
an upstream bridge is implemented or functioning. This distinction neither
removes that integration gap nor invents a new accepted requirement.

**BOOTSTRAP_READY=NO.** No real resolved preparation proof set or replacement
bootstrap package bound to8ab5904 was produced in this narrow lane. The retained
parent package6e6411dd binds277a5e883 and cannot stand in for the new executable.
The release hashes in receipt26 establish local build output only. Authentic
issuer/custody inputs, exact host/enrollment and release face, source/build/review
attestations, protected lifecycle/legacy evidence, native closure provenance and
exact operation/rollback bindings remain unestablished by this delivery. No live
census was performed; historical missing-input observations are not presented as
fresh production state. R02's last source-review blocker is now closed, but that
does not manufacture a trusted signed preparation review proof.

The future separate Owner bootstrap authorization is an execution gate, not a
missing Spec acceptance or a reason to claim HUMAN_REQUIRED now. No bootstrap
permission is requested by this delivery. Stop this completed R02 successor lane;
leave integration and exact preparation in their separate scope.

```text
R02_STATUS=CLOSED
IMPLEMENTATION_COMPLETE=YES (R02 successor scope)
R02_REGRESSION_TEST=PASS
GLOBAL_UNSAFE_STATE_FAIL_CLOSED=PASS
UNIT_LOCAL_RECOVERY_ISOLATION=PASS
TESTS_PASS=YES
FULL_TESTS=PASS (176 primary executions)
FMT=PASS
CLIPPY=PASS
RELEASE_BUILD=PASS
INDEPENDENT_R02_REREVIEW=PASS
INDEPENDENT_REVIEW_PASS=YES (R02 and directly affected surface)
NEW_SHIP_BLOCKERS=NONE (this scope)
BOOTSTRAP_READY=NO
ACTIVATION_ALLOWED=NO
OPERATION_ALLOWED=NO
```

PRODUCTION_MUTATION_PERFORMED=NO
PRIVILEGED_BOOTSTRAP_PERFORMED=NO

[brief]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_R02_CLOSURE/brief.md
[review]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_R02_CLOSURE/security-review.md
