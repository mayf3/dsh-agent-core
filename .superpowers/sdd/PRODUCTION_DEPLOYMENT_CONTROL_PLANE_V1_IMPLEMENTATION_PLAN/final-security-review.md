# Independent whole-branch security and conformance review

**SPEC / CONFORMANCE: FIX_REQUIRED. QUALITY / SECURITY: FIX_REQUIRED. BOOTSTRAP_READY: NO.**

The descriptor filesystem boundary, closed socket, signed admission, permanent mutex,
transaction evidence and independent Goal closure are substantial implementations.
They do not yet compose into the accepted production profile or the requested
preauthorization readiness deliverable. Nine concrete source/verification defects
are frozen below. Missing real external inputs and later privileged proof are
separate conditions, not substitutes for these repairs. No production exploit or
privileged execution was performed or is asserted.

## Coordinates, authority and review mandate

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = COMPLETE_APPLICABLE_MATRIX
REVIEWER = /root/dcp_final_security_review (independent of implementation)
REVIEW_TARGET_HEAD = c5cab2eef3a5e7b502016571e1f24dd31b3e0560
BASE_HEAD = bb5327f622a0333f1e11d945319e024a3731f05a
ACCEPTED_SPEC_SEMANTICS = 39865536ce51005f95a98473e77c2329078512c0
PRIMARY_AUTHORITY = docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md
AUTHORITY_ACTION = REUSE
IMPLEMENTATION_AUTHORITY = contracts
ASSURANCE_LEVEL = CONTROLLED
WRITE_MANDATE = final-security-review.md only
PRODUCTION_MUTATION_ALLOWED = NO
PRIVILEGED_BOOTSTRAP_ALLOWED = NO
FROZEN_BLOCKER_UNION = [DCP-FINAL-B01, DCP-FINAL-B02, DCP-FINAL-B03,
 DCP-FINAL-B04, DCP-FINAL-B05, DCP-FINAL-B06, DCP-FINAL-B07,
 DCP-FINAL-B08, DCP-FINAL-B09]
SPEC_GAPS = 0 (none needed to repair this union)
INDEPENDENT_REVIEW_PASS = NO
IMPLEMENTATION_COMPLETE = NO (whole requested deliverable)
BOOTSTRAP_READY = NO
OPERATION_ALLOWED = NO
```

Worktree: `/Users/yanfenma/workspace/worktrees/production-deployment-control-plane-v1-impl`.
The exact HEAD and nonroot euid502 were read back. Read the review brief, scope,
controller rulings, repository grammar/local governance/structure rules, accepted
Spec, task reports/reviews, current conformance and all sixteen stable EVD records.
The supplied `review-final-bb5327f-c5cab2e.diff` is the review package: nineteen
commits, 2,093,830 bytes, 45,257 lines. Source/test/adapter/report semantic hunks
were inspected in bounded chunks; oversized JSON inventories were also decoded
and compared by field. Truncated output gaps were followed with bounded or decoded
reads. Historical repeated test/structure logs were navigated by hunk/file index;
relevant final observations were checked without rerunning suites. Cargo.lock has
68 packages, registry checksums and no alternate registry/path dependency surprise.
No vulnerability-database or external dependency audit is claimed.

Named focused source reads after the package pass were confined to the nine risks:
native profile/slot routing, readiness equality, socket ancestry, apply/finalize
error exits, recovery call sites, health read loop, and fixture setup ordering.
The counterexamples below are deterministic source/control-flow deductions, **not
newly executed test observations**. No disposable reproducer was necessary. No
suite, root probe, service operation, new diff, source/index/ref edit, subagent or
external message was used. This report is the reviewer's sole checkout write.

Paths abbreviated `src/` and `test/` below are relative to
`packages/deployment-control-plane/`; Spec line coordinates refer to the accepted
file at this review HEAD. Each finding's `EVD-DCP-FINAL-Bnn` is a stable review
evidence relation: exact source at the pinned HEAD SUPPORTS its stated defect,
under the stated input conditions; it does not claim production execution.

## Frozen actionable findings

### DCP-FINAL-B01 / EVD-DCP-FINAL-B01 — readiness cannot accept resolved inputs

**Important / P1; CONTRACT_VIOLATION, REQUIRED_GATE_FAILURE.** SOURCE: CTR-017
(Spec:356), section5 framework/profile separation and section7 review → exact
preparation → Owner authorization → activation ordering; implementation plan Task4
and the explicit preauthorization BOOTSTRAP_READY mandate.

**COUNTEREXAMPLE:** `src/bootstrap/verify.rs:55–62` regenerates the unresolved
`prospective` object, removes only supplied payloads, and requires complete equality.
`src/bootstrap/prospective.rs:48–96` fixes an unresolved host/toolchain and null
issuer public keys, service identities and custody receipts. Resolving even one
of these to an independently valid real value makes equality fail. Clearing a
genuinely satisfied prerequisite also fails. Even equality success returns literal
`bootstrap_ready: false` (`verify.rs:145–148`). The schema/recipe supplies no path
for validating a resolved Configuration/NativeEnrollment and exact useful face.
The unresolved list also requires a future `EXACT_OWNER_BOOTSTRAP_RECEIPT`.

**IMPACT:** This is a safe candidate-integrity verifier, but cannot deliver the
requested ready-to-authorize package even if every real prerequisite is supplied.
It also conflates preauthorization readiness with the receipt created only after
authorization. Truthful NO and fixture-secret rejection do not close implementation.

**MINIMAL_CLOSURE:** Preserve an inert unresolved candidate mode; add a strict,
typed resolved preparation/validation path. Separate immutable driver constraints
from reviewable host, exact enrollment/slot/facet, public issuer/custody/source,
independent review and operation/rollback inputs. Validate their cross-bindings,
provenance and bounds instead of equality to null placeholders. Compute readiness
from the preauthorization requirements. Keep activation permission false, profiles
disabled and no activation receipt generated; a future Owner execution receipt is
an activation prerequisite, not a circular offline-readiness prerequisite. Do not
implement a caller `ready=true` or accept arbitrary self-signed assertions.

**VALIDATION:** Nonroot synthetic resolved inputs with an explicitly test-only
trust anchor must reach ready-to-authorize while remaining nonactivating; omit,
forge or cross-bind each prerequisite and reject. The unresolved current package
must remain nonready. Actual host values, issuer custody, upstream contracts and
accepted production reviews remain required external facts; fixtures cannot fill
them. This repair can implement the generic validator without guessing protocols.

### DCP-FINAL-B02 / EVD-DCP-FINAL-B02 — artifact manifest controls the install set and metadata

**Important / P1; SECURITY_OR_DATA_LOSS, CONTRACT_VIOLATION.** SOURCE: CTR-005
(Spec:176, exact mapping profile-owned; manifest cannot enlarge it), CTR-008
(Spec:214, exact slots/type/UID/GID/mode/ACL), ACC-004.

**COUNTEREXAMPLE:** An enabled, validly signed dsh profile/enrollment authorizes
an initial baseline `scripts/A.mjs`. Its protected existing `scripts` directory
also permits a regular or absent `B.mjs` leaf. A correctly signed/build-attested/
reviewed proposal with a valid artifact manifest naming `scripts/B.mjs` reaches
`Train::tick` → `Executor::apply` → `precheck`. The profile-ID check at
`src/transaction/apply.rs:111–115` passes; `verify_live_baseline` checks A
(`:280–293`), then `:123–128` captures B including ABSENT. Nothing compares manifest
paths with a profile-owned slot allowlist. `:170–195` installs B. Signature validity
authenticates the proposed bytes; it does not grant a manifest authority to expand
the profile. `NativeEnrollment.initial_files` (`native_profile.rs:63–98`) is only
a baseline, not an enforced destination mapping.

A second direct case enrolls A with permitted mode0600/GID601. The next ordinary
manifest selects `executable=false`; installation writes0644 and the parent GID
(`apply.rs:181–185`, `src/fs/target.rs:44–47`), ignoring enrolled mode/GID. Thus an
otherwise legal private slot becomes world-readable. Later baselines verify only
the previous journal's Installed entries (`apply.rs:261–279`); omitted profile
slots cease to be checked after the first partial release.

**IMPACT:** Out-of-profile writes within the broad app tree, privilege/metadata
expansion, and incomplete face readback. This is not an out-of-root traversal claim.

**MINIMAL_CLOSURE:** Bind a complete exact legal slot descriptor set and permitted
release-facet/overlay semantics into protected enrollment/profile revision. Resolve
each artifact slot through that mapping before service stop; reject undeclared
slots and executable/metadata changes. Derive UID/GID/mode/ACL from the protected
mapping, supporting only explicitly declared ABSENT additions. Preserve and check
the complete required current face across partial overlays; do not replace it with
only the last mutation's entries. Unsupported required facets remain blocked.

**VALIDATION:** Nonroot native-plan validation and real fixture writes must reject
extra existing/ABSENT siblings, wrong type/mode/GID/executable bit and drift of an
unchanged required slot before mutation; accepted exact slots retain metadata and
rollback. Actual useful slot/facet selection is an external release fact (RP-04),
but generic enforcement is implementable now under the accepted Contracts.

### DCP-FINAL-B03 / EVD-DCP-FINAL-B03 — signed profile identity is not bound to the physical driver

**Important / P1; CONTRACT_VIOLATION.** SOURCE: CTR-002/003 immutable physical
target ownership, CTR-008 fixed strategy/identity, CTR-018 caller lifecycle exclusion.

**COUNTEREXAMPLE:** Prepare otherwise authentic protected Configuration,
DaemonActivation and NativeEnrollment with an enabled Profile whose `host`,
`target_runtime`, `install_root_id`, repo and strategy identifiers describe a
different target but whose domain/label are `system/ai.agent-core.runtime` and whose
review includes root-code. Set enrollment.profile_digest to that exact Profile;
all signatures/digests are genuine. `src/service/intake.rs:93–112` verifies the
signed documents but does not cross-check physical host/driver mapping.
`src/transaction/mod.rs:75–90` checks only enabled/digest/revision/domain/label/
root-code and always opens `/usr/local/libexec/agent-core/app`. `precheck` checks
the profile ID; the admitted unit/installed ledger retain the descriptive target
while the fixed Runtime/W1/W2 driver acts locally. NativeEnrollment contains no
host binding (`native_profile.rs:63–74`). Hashing internally consistent documents
does not demonstrate that the described identity equals the physical target.

Similarly, enrollment validation permits Runtime/W1 uid502: its only numeric rule
is Runtime nonzero, W1 same, W2 zero (`native_profile.rs:110–115`). Intake permits
caller502 because it checks only caller nonzero. Matching actual uid502 services
therefore pass those checks while that enrolled caller can signal them outside
the mutex. This is an invalid prospective adoption the code must reject; it does
not assert that the current proposed505/root deployment already has this bypass.

**IMPACT:** Misbound receipts/target ownership and acceptance of an ineligible
lifecycle identity. A nonroot client cannot forge the protected activation; the
defect is missing validation at the real preparation/enrollment boundary.

**MINIMAL_CLOSURE:** Use a shared typed supported-driver binding in offline resolved
preparation and production startup: canonical target/root/strategy/repo mapping,
exact observed host binding, service numeric identities and enrolled caller set.
Reject unsupported field combinations and caller/service UID overlap; retain
explicit full lifecycle-denial evidence as an enrollment requirement. Canonical
root ownership checks must use the physical mapping, not arbitrary ID equality.
Host observations and live denial receipts are real inputs, not invented values.

**VALIDATION:** Pure nonroot validator cases for foreign host, wrong root/target/
strategy/repo, overlapping physical mappings and caller502/service502 reject;
the exact supported505/root binding is accepted structurally. Actual native host,
UID/GID/launchd/write/signal denial remains separately authorized proof.

### DCP-FINAL-B04 / EVD-DCP-FINAL-B04 — the fixed production socket path fails its own ancestor policy

**Important / P2; CONTRACT_VIOLATION, REQUIRED_GATE_FAILURE.** SOURCE: CTR-007
usable protected Unix socket, CTR-008/017 exact platform-compatible preparation.

**COUNTEREXAMPLE:** The retained `platform-boundaries.json` records macOS
`/private/var/run` as root:daemon0775. With that observed parent unchanged and an
otherwise perfectly provisioned root:6020750 `agent-deployd` child, production
`src/service/server.rs:193–198` calls `Dir::open` on the compiled path. Each ancestor
passes through `Dir::child/validate` (`src/fs/secure.rs:37–65`); `:191` rejects any
group-write bit, so startup returns UNSAFE_MODE at `run` before binding the socket.
The client and prospective manifest hardcode the same route
(`src/bin/agent-deployctl.rs:38`, `bootstrap/prospective.rs:119–121`). The candidate
explicitly forbids relaxing this ancestor rule and contains no alternate safe path.

**IMPACT:** Resolving issuer/enrollment facts alone cannot make the proposed daemon
usable on the observed platform. This is a preparation/code mismatch, not evidence
that protection should be weakened or a privileged test should run now.

**MINIMAL_CLOSURE:** Keep the accepted section3 canonical socket path. Add a narrow,
reviewed socket-ancestor policy that verifies the exact root-owned platform parent,
numeric group, ACL/flags, retained descriptor identity and absence of enrolled
caller/service-account write authority, with those facts bound in preparation and
rechecked at startup. Keep the0750 dedicated child and all generic artifact/target
ancestor checks restrictive. Mode0775 alone must not count as safe evidence. Do
not chmod the shared OS directory or add a caller path override. Moving the public
socket outside the accepted layout would require an authority decision and is not
the prescribed source repair. If the actual ancestor cannot meet the accepted
noncaller-writable condition, retain a concrete host blocker.

**VALIDATION:** Nonroot metadata-policy/descriptor fixtures must reject the old
unsupported case, accept a fully proven equivalent platform binding, and reject
caller/group/ACL/ancestor replacement attacks. Refresh actual platform metadata
before later bootstrap. Existing
facts are time-bound, but the current proposed recipe must explicitly handle them.

### DCP-FINAL-B05 / EVD-DCP-FINAL-B05 — final prewrite rejection strands PRECHECK and an active journal

**Important / P2; CONTRACT_VIOLATION.** SOURCE: CTR-006 no apply on expired/revoked
policy; CTR-010/011 prewrite failure BLOCKED(NO_MUTATION), bounded safe resumption.

**COUNTEREXAMPLE:** Admit a legitimate unit with a still-valid near-expiry lease.
`src/transaction/apply.rs:47` validates using the supplied start time. Artifact
import/baseline/plist/process checks take long enough to cross expiry. Preflight
and the finalization fence are persisted and `self.active=Some(journal)` (`:55–69`).
The correctly fresh elapsed-time check in `q.begin_apply` rejects POLICY_EXPIRED
(`:71–78`), but `?` exits without terminalizing the journal, entering BLOCKED or
clearing the in-memory active transaction. A concurrently observed newer policy
can reach the same exit. No production mutation has begun. The Train propagates
the error; later ticks cannot select this PRECHECK unit, and its executor is still
active. Only daemon restart invokes recovery; ordinary corrected input cannot
take the accepted bounded retry path.

**IMPACT:** A normal safe policy refusal becomes a stuck execution/lane until an
unnecessary daemon restart. Freshness denial itself works; failure disposition
and automatic progress do not. Post-fsync ambiguity must remain distinct.

**MINIMAL_CLOSURE:** Handle failures between durable preflight and successful
begin_apply explicitly. For a proven gate rejection with no operation started,
append a durable no-mutation disposition, reconcile the executor fence, move to
BLOCKED and release active state while preserving history/budget/STOP. Storage or
uncertain commit failures must retain recovery/quarantine, not be recast as safe.

**VALIDATION:** Deterministically advance an injected trusted clock or publish a
new protected policy at the pre-begin gate; assert zero writes/service actions,
BLOCKED, retained evidence and successful same-daemon bounded remediation/retry.
Also retain failure-at-flush/commit negative cases. No broad expensive suite is needed.

### DCP-FINAL-B06 / EVD-DCP-FINAL-B06 — valid recovery evidence has no daemon intake route

**Important / P2; CONTRACT_VIOLATION.** SOURCE: CTR-010 automatic proven-safe
STOP resumption and CTR-011 signed bounded same-intent remediation; ACC-009.

**COUNTEREXAMPLE:** A real daemon PRECHECK failure becomes BLOCKED with STOP and
remaining budget, or a known postwrite failure safely reaches ROLLED_BACK. The
accepted recovery issuer supplies fresh signed RecoveryEvidence and corrected
policy. `src/queue/lifecycle.rs:60–131` can validate/requeue it, but no production
source calls `Queue::retry`. `src/service/intake.rs` implements only proposals,
snapshots, policies, acceptance results and closure ACKs; `Train::tick` at
`src/service/train.rs:61–129` never consumes recovery. The closed five-operation
socket intentionally exposes no such privileged API. Tests call the library
directly, so their successful retries do not demonstrate daemon integration.

**IMPACT:** The accepted recovery/automatic resume feature is unreachable in the
delivered service even after real issuer facts are resolved. Restart does not
consume a signed remediation record either. No ordinary Owner action is required
by the Contract to work around this missing internal connection.

**MINIMAL_CLOSURE:** Add a bounded protected signed-recovery intake and daemon
consumer using the existing record, queue, mutex, physical readback and budgets.
Bind exact failed execution/status/cause and dispositions, refresh current policy,
dedupe receipt consumption, preserve STOP until corrected begin_apply, and reject
unknowns. Do not expose caller-authored proof or a generic unlock/socket command.
The actual external issuer-to-mailbox bridge remains an external-contract task;
the daemon's typed mailbox consumption can be implemented and tested now.

**VALIDATION:** Real private daemon/socket fixture: fail known preflight and known
rolled-back attempt, publish legitimate signed remediation through protected
intake, correct gates, observe same intent advance automatically within budgets.
Wrong revision/cause/signature, expired/replayed proof, unknown canary and exhausted
budget refuse with no install. No direct test call to Queue::retry may substitute.

### DCP-FINAL-B07 / EVD-DCP-FINAL-B07 — known final health failure never attempts rollback

**Important / P1; CONTRACT_VIOLATION.** SOURCE: CTR-011 known postwrite rollback
and CTR-014 infrastructure failures roll back; ACC-010/011.

**COUNTEREXAMPLE:** Apply installs a valid artifact, resolves all service operations
and returns VERIFYING. Bounded Goal observation succeeds. Before finalize's second
proof, the same correctly identified runtime returns HTTP200 `{"ok":false}`.
This produces the definite HEALTH_FAILED from `src/transaction/native.rs:335–338`;
there is no unknown operation, byte drift or ambiguous fsync. Finalize performs
`self.service.prove(image)?` at `src/transaction/recovery.rs:227` and funnels this
known pre-final-commit failure into the same host latch as failed fsync (`:239–242`).
`src/service/train.rs:114–125` rolls back errors from verify_goals, but the
`executor.finalize(...)?` branch bypasses rollback. The bad release stays installed,
the unit remains VERIFYING/fenced, and the lane is latched without a rollback attempt.

**IMPACT:** The required safe rollback policy is not used for a definite native
infrastructure failure. The finalization fence correctly prevents Goal closure;
this finding does not weaken that fence or authorize rolling back uncertain commits.

**MINIMAL_CLOSURE:** Distinguish known physical/health failures before finalization
commit from ambiguous journal/Queue durability failures. Attempt the existing
guarded exact-preimage rollback for the former, retaining quarantine if rollback
is unsafe; preserve existing fence/quarantine for uncertainty after commits.

**VALIDATION:** Deterministic private service seam: healthy apply → acceptance →
known unhealthy finalize proof, with resolved operations and unchanged postimages.
Assert restored bytes/service binding, ROLLED_BACK, zero closure and retained
attempt evidence. Keep existing finalization fsync/partial-record ambiguity tests.

### DCP-FINAL-B08 / EVD-DCP-FINAL-B08 — native health uses per-read timeout, not an absolute deadline

**Important / P2; CONTRACT_VIOLATION.** SOURCE: CTR-008 profile time limits,
CTR-009 bounded owned work, CTR-014 bounded acceptance, CTR-020 finite probe bounds.

**COUNTEREXAMPLE:** `src/transaction/native.rs:318–339` sets two-second socket
read/write timeouts, then uses `take(65537).read_to_string`. A local health peer
can send one byte every second and keep each individual read below timeout. The
routine can hold the global transaction mutex for roughly eighteen hours before
the byte cap rejects; it has no elapsed deadline. This path is used during native
start/prove/finalize/late proof. A byte cap is not the intended wall-clock deadline.

**IMPACT:** An unhealthy/dribbling runtime can monopolize the production lane far
beyond the bounded verification window despite small individual I/O timeouts.

**MINIMAL_CLOSURE:** Apply a single monotonic deadline across connect/write/read,
set each blocking operation's remaining timeout, and bound incremental response
parsing/bytes. Return a typed timeout and use the appropriate known/unknown phase
disposition. Do not add an arbitrary endpoint/command option to production.

**VALIDATION:** A nonroot ephemeral-loopback test of the shared health reader sends
data more frequently than the per-read timeout but beyond the total deadline;
assert bounded refusal and transaction disposition. Do not bind/probe live8790.

### DCP-FINAL-B09 / EVD-DCP-FINAL-B09 — non-adoption fixtures still perform effects before confinement

**Important / P2; REQUIRED_GATE_FAILURE.** SOURCE: plan Global constraints and
review mandate: fixtures refuse euid0 and paths outside private temporary roots.
The Task4 scoped repair explicitly did not certify prior-task harnesses.

**COUNTEREXAMPLE:** `test/common/service.rs:27–57` allocates through environment-
selected `tempfile::tempdir`, chmods, writes service.json, creates directories and
spawns the daemon without checking euid0 or the kernel private root. The daemon's
later --sandbox refusal occurs after those effects. `test/transaction_fixture.rs:28–35`
also creates/chmods before FixtureRoots can refuse. `test/common/mod.rs:179–181`
refuses root early but opens SQLite under an unchecked environment-selected temp
directory; it never applies the private0700/kernel-root policy. The filesystem
fixtures contain the same early tempdir pattern. These are new branch fixtures,
not unrelated repository legacy debt. No root invocation was executed to prove this.

**IMPACT:** The whole-branch verification surface does not meet the mandated
nonroot/private-root boundary. Existing euid502 runs remain valid observations of
their actual inputs; this is not a claim those historical runs changed production.

**MINIMAL_CLOSURE:** Reuse a shared audited nonroot/kernel-private0700 constructor
before the first filesystem/process effect in all owned fixture helpers and worker
entries. Keep intentionally unsafe test paths inside the validated private tree.
Do not rely on daemon/FixtureRoots refusal after harness writes. Preserve task4's
closed adoption regressions and honest historical evidence.

**VALIDATION:** Safe injected-euid rejection before effects (no actual root test),
hostile TMPDIR cases, and instrumented no-outside-write/no-child assertions for
queue, filesystem, transaction and service helpers. Run only affected cases.

## Required real facts and postauthorization proof

These remain readiness/adoption conditions, separate from the nine repair IDs.
No external endpoint or key custody fact was invented by this review.

| Existing condition | Required next evidence and boundary |
|---|---|
| RP-01 host/enrollment | Exact stable host identity, selected service/plist/root/OS/tool/numeric identities and usable protected socket layout. Structural validation B01/B03/B04 is feasible now; protected live readback/collision checks must be performed at the authorized boundary. |
| RP-02 real issuers/adapters | Actual Authority, Producer, Builder, Reviewer, Verifier and Recovery service contracts, public keys, isolated custody and protected authenticated bridge ownership. Current typed mailbox transport works in fixtures; actual upstream adapters are not implemented. Identify real contracts before implementing them; absence in this repo is not proof services do not exist. B06's daemon-side consumer needs no guessed upstream protocol. |
| RP-03 source/build/review | Authentic canonical acceptance, immutable source/tree, isolated build/toolchain/dependency attestation and independent review for the exact package/face. Local checksums and fixture signatures are not these facts. |
| RP-04 complete useful release | Choose a concrete meaningful runtime release whose complete required code/config/routing/plist/Node/harness/incident facets are enumerated and supported. An app-only subset is possible only when unchanged facets are explicitly bound and safe. Any required unsupported facet remains blocked; all-disabled profiles do not satisfy implementation. B02 enforces the supplied mapping; it cannot invent release selection. |
| RP-05 legacy/lifecycle | Exhaustive protected inventory of source and installed helpers, wrappers, sudoers includes/aliases, jobs, direct writes and lifecycle managers; exact retirement plan and later actual caller negative write/launchctl/signal checks. Four repo source guards are useful M evidence only. No global retirement PASS. Parent505/root and intentional child502 control remain distinct. |
| RP-06 native closure/runtime | Transformed x86_64 Node closure requires authentic build/review/signature provenance, supported ABI and later native loader/process/readback/runtime validation. Local ad-hoc signing and static graph parsing are insufficient. No live Node or Homebrew alteration is authorized. |
| RP-07 whole review | This independent review has occurred and returns FIX_REQUIRED; repair this union and obtain the one scoped re-audit. It must not be relabeled PASS merely because it ran. |
| RP-08 Owner execution | Separate future Owner authorization of the exact reviewed manifest, staged protected executable/keys/rollback, then protected activation epoch/receipt, retirement/enrollment/canary and standing enablement. This is not required to claim an otherwise complete preauthorization package reviewable/ready. It is required to execute bootstrap and operate. |

Current source does not implement auth-service or svc-workflow drivers, directory
creation/deletion, routine Node/harness/plist/config/routing writes or Watchdog
incident migration. These are explicit exclusions, not silently completed facets.
GUI/502 svc-workflow remains ineligible; new identity/domain requires its separate
accepted migration. This review requests no new product authority or privileged action.

## Full Contract disposition

`BOUNDARY_SUPPORTED` below means reviewed source plus the named qualified F/M
evidence supports its bounded cases, not complete production conformance. `GAP`
means a frozen source finding; `EXTERNAL/P` means facts or later proof remain.

| CTR-DCP | Disposition and exact qualification |
|---|---|
| 001 | BOUNDARY_SUPPORTED: signed producer CAS, complete pagination/watermarks and changes; missing producer data cannot imply exhaustive readiness. EXTERNAL RP-02. EVD-T4-001. |
| 002 | GAP B03 physical identity; immutable descriptors, daemon intents/attempts and append-only receipt history supported by EVD-T4-002. |
| 003 | BOUNDARY_SUPPORTED collapse, exact coverage, A→B→A and inherited supersession age/links; physical overlap identity requires B03; complete face B02/RP-04. EVD-T4-002. |
| 004 | BOUNDARY_SUPPORTED role/scope signatures, source/tree/build/review bindings and independent review rejection; real custody/build sources RP-02/03. EVD-T4-003. |
| 005 | GAP B02; descriptor seal/no-link/hash primitives supported. EVD-T4-004. |
| 006 | BOUNDARY_SUPPORTED monotonic observed epochs and lease revalidation, unrelated main movement not a stale trigger; GAP B05 safe disposition on final fresh-gate rejection. EVD-T4-003. |
| 007 | BOUNDARY_SUPPORTED closed protocol/kernel peer/shared-UID actor/durable ACK; GAP B04 usable production socket. EVD-T4-005. |
| 008 | GAP B02/B03/B08; fixed command/environment/native loader checks supported, real closure RP-04/06. EVD-T4-004/006. |
| 009 | BOUNDARY_SUPPORTED permanent inode/guard from precheck through acceptance/finalize; GAP B08 bounded hold; actual legacy exclusion RP-05. EVD-T4-007. |
| 010 | BOUNDARY_SUPPORTED DAG/FIFO/dependencies/STOP/explicit independent continuation; GAP B05/B06 recovery composition. EVD-T4-008/009. |
| 011 | GAP B05/B06/B07; crash evidence, exact-attempt recovery, no unknown replay and finite attempts otherwise supported. EVD-T4-009. |
| 012 | GAP B02 complete mapping/current face; native generation/readback source and fixture restart semantics supported; real native proof RP-01/04/06. EVD-T4-010. |
| 013 | BOUNDARY_SUPPORTED captured-slot CAS rollback/ABSENT/metadata restoration, drift quarantine and restored physical binding; B07 invokes it on known finalize failure. EVD-T4-010. |
| 014 | GAP B07/B08; mixed per-Goal outcomes, bounded external WAITING and nonresend of unknown supported. EVD-T4-011. |
| 015 | BOUNDARY_SUPPORTED immutable exact-attempt/attachment/generation receipts, per-unit finalization fence and producer-CAS outbox; real bridge RP-02. EVD-T4-011. |
| 016 | BOUNDARY_SUPPORTED standing policy/no normal sudo/per-head approval, missing trust refused; operational resolution B01/B03/RP-02/03. EVD-T4-012. |
| 017 | GAP B01/B03/B04; independent review FIX_REQUIRED, exact later activation permission separate. EVD-T4-012/016. |
| 018 | GAP B03 identity exclusion; four source guards supported, full installed/lifecycle retirement RP-05 remains unexecuted. EVD-T4-013/015. |
| 019 | BOUNDARY_SUPPORTED optional transition disabled/empty, no daemon sudo path; actual installed-rule absence RP-05. EVD-T4-014/016. |
| 020 | GAP B08 and verification boundary B09; finite byte/count/queue/operation limits, retained current/preimage/journal/outbox and corruption quarantine supported. No destructive GC supplied. EVD-T4-009/014. |

## All acceptance rows and attack-list assessment

Stable inherited `EVD-T4-nnn` references above/below mean
`docs/reports/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md#evd-dcp-t4-nnn`.
Their source, inputs, raw command/result coordinates, negative cases and limitations
remain authoritative as **observations**, not as a whole-branch PASS. Every current
conformance row has such a relation; this review's B01–B09 records qualify the
remaining cross-component gaps without erasing earlier passing evidence.

| ACC-DCP | Review disposition |
|---|---|
| 001 | Existing F cases supported (EVD-T4-001); real exhaustive registered census/bridge pending RP-02. |
| 002 | Existing F/M collapse/late coverage/intent cases supported (002); physical binding B03 and complete face B02/RP-04 block full claim. |
| 003 | Existing forged/real fixture signature, epoch/revocation cases supported (003); B05 final denial disposition; authentic issuers RP-02/03. |
| 004 | Existing real filesystem attacks supported (004); zero out-of-profile writes fails B02. |
| 005 | Existing real socket/peer/framing/ACK cases supported (005); fixed production route fails B04. |
| 006 | Existing fixed-command/plist/loader/empty-transition negatives supported (006); B02/B03 profile binding and RP-06 real closure remain. |
| 007 | Existing real same-host lock/phase cases supported (007); B08 deadline and RP-05 actual legacy callers remain. |
| 008 | Existing F scheduling/dependency cases supported (008); daemon automatic corrected-intent resume missing B05/B06. |
| 009 | Existing crash/partial/fsync/owned-child cases supported (009); B05/B06/B07 remaining reachable lifecycle paths need new focused cases; B09 fixtures boundary. |
| 010 | Existing real-file/fixture-process rollback cases supported (010); B02 metadata/face, B07 known final failure and real native P proof remain. |
| 011 | Existing mixed outcomes/WAITING/late/unknown/CAS cases supported (011); B07/B08 native finalize health; RP-02 actual business acceptance. |
| 012 | Existing disabled/authority negatives supported (012); B01 readiness path/B03 enrollment, future distinct Owner receipt. |
| 013 | Existing four repo entrance negatives supported (013/015); B03 same-UID rejection and RP-05 exhaustive installed/lifecycle P proof. |
| 014 | Existing quotas/malformed journal/no-transition cases supported (014); B08 deadline/B09 harness confinement; installed-rule/retention P proof pending. |

| User attack | Assessment |
|---|---|
| Command injection | Closed identifier protocol; fixed native absolute argv, no shell/candidate hooks. No concrete socket-to-command injection found. |
| Path traversal | Bounded ASCII descriptor-relative components reject absolute/parent/case/prefix collisions; no traversal escape found. B02 remains a separate in-root authorization defect. |
| Symlink race / TOCTOU | Retained O_NOFOLLOW descriptors, same-FD snapshots/sealing, exact slot CAS and protected ancestors are substantive. Final physical mapping/current-face authorization still needs B02/B03. |
| Caller-writable privileged script | Daemon is native with fixed helpers; loader graph/plist checks reject unsafe closure. First bootstrap must stage/reverify protected bytes. Real issuer/build and unchanged JS/harness closure remain RP-03/04/06, not proven by Node entry hash. |
| Arbitrary launchctl | Compiled Runtime/W1/W2 commands and domains; no caller argv option. B03 must reject misleading profile/identity combinations. |
| Arbitrary chmod/chown | No public chmod/chown/recursive API, but B02 permits manifest-controlled executable mode and ignores enrolled private metadata. |
| Environment injection | Native child env_clear and exact-byte plist parser reject dangerous Node/DYLD/LD/OpenSSL/ICU keys; static Mach-O rpath/environment negatives present. No new concrete bypass found in supported closure. |
| Artifact substitution | Signed raw/typed manifests, exact blob closure, private seal and rehash support byte identity. B02 shows authenticated bytes still need profile authorization. |
| Rollback escalation | Exact captured targets/inode face, metadata and ABSENT handling constrain restoration; drift quarantines. B07 is failure to invoke safe rollback, not an arbitrary rollback destination. |
| Mutex bypass | One permanent descriptor/host-bound guard retained through acceptance/finalize; no inherited-string seam in daemon. B03 same-UID enrollment and RP-05 unretired external paths prevent global exclusion claim. |
| Direct legacy deployment | Four source guards/negative copies pass their bounded cases; installed/external wrappers/sudo/jobs/signals have not been retired or denied. No global or production adoption PASS. |

## Evidence verification and limits

Retained evidence was inspected, not rerun: S1 source9dc5e3c37+final ACK1;
S2 c56925a72 including4096 and2ea6816 affected73; S3 source0c4ec56 logs37/38
cover96 affected cases, with the failed migration expectation in37 preserved.
Task4 full105 at3f59cf3, affected9 at8db5ada and final adoption15 executions/12
unique at a263c808 are separate observations, not a fresh full suite at c5cab2e.
Child executions are not counted twice. Clippy/fmt/release remain bound to their
reported coordinates; historical failures and earlier weaker fixtures remain visible.

Replacement inert manifest:
`1b4b4e1608f9335eb4db8aba319b0e19a0e8610ccefac2c1df2c25e6bbe949c6`;
source digest `da70fad9b07a064a07489c14aff006cc1781a66ca359e7d44522bb7fed1bebb7`.
Review-time hashing found zero mismatches in all84 declared source files.
Task4 evidence69–72 binds exact reuse of binaries built at8db5ada; no fresh build
or authentic production provenance is inferred. Twenty-two transformed x86_64
loader files total117,266,720 bytes; ad-hoc signing remains structural-only.

Structure remains exit1 for three unchanged baseline directories: runtime/src21,
runtime/test23, scripts59. Supplemental Rust:75 files/max479 lines/20 children/
depth2. Modules are responsibility-oriented; installer498 lines retains mechanical
executable-line identity outside its guard. No unrelated structure debt repair is
requested. Earlier Task4 F-01 recipe read-before-size-bound and F-02 broader shell
lookup handling stay FOLLOW_UP; no new reachable production counterexample was
established for them here.

Preserve strict signatures, durable ACK, complete late-attachment validation,
exact-attempt/current-generation receipts, permanent flock, descriptor seal/CAS,
owned-operation reconciliation, exact rollback/restored binding, finalization
eligibility fence, mailbox recovery, verification CAS and unknown-no-resend.
Real root mutation/process census, complete installed closure, lifecycle denial,
hardware failure, upstream custody and Owner E2E remain unexecuted. Fixture fault
injection is not production proof.

## Completion and next gate

The initial broad review is complete. Repair the nine frozen findings in one
coherent source/evidence pass, preserving accepted authority and existing receipts;
then perform the scoped re-audit of those closures and directly affected behavior.
Update conformance/EVD relations with exact new observations, retaining historical
coordinates. Genuine external facts may still prevent BOOTSTRAP_READY after the
source repair; report them concretely. No first privileged authorization request
is ready at this HEAD, and this report grants no merge, bootstrap or deployment.
