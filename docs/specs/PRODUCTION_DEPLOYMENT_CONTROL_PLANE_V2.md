---
spec_id: PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V2
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - host-local production deployment queue and train
  - immutable multi-goal deployment units and independent receipts
  - allowlisted privileged controller and explicit profile activation
governed_by:
  - AGENT_CORE_HARDENING_PROGRAM_V1
external_authorities: []
supersedes: [PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1]
superseded_by: null
owners:
  - mayf3
authoring_base_main: f0bbf0942752b859da445ba9f775a9061da399b3
production_apply_authority: none
---

# Production Deployment Control Plane V2 — proposed whole-authority successor

**PROPOSED; docs-only; implementation and production effects are not authorized by
this draft.** This is the complete successor to V1, not a partial override. The
accepted V1 remains current until exact reviewed V2 acceptance and atomic lifecycle
integration (V2 accepted, V1 superseded/backlink, index) land together. A review PASS
is not acceptance. The intended implementation authority is `contracts` only after
that lifecycle is effective in the implementation base; production adoption still
requires CTR-DCP-017.

The only new behavior is the fixed `scheduler-whole-main-maintenance-v1` profile in
§9. Other profiles retain V1 decisions and contracts. Explicit changes to the
executor mapping, 002/003, 007/009, 011/012 and 018 are signposted below. V1's
single active deployment transaction is not silently split. No HR cut, private
qualifier, identity seed, prompt replay or business-specific installer is added.

## 1. Goal, scope and authority

Business Goals deliver `DEPLOYMENT_READY`; one shared Train turns approved immutable
releases into receipted production outcomes. Multiple development Goals may proceed
concurrently; production mutation concurrency is one per host across all enrolled
targets. Scope is this macOS host, not a distributed lock or general remote executor.

This NEW authority owns a new durable deployment interface, permission boundary,
queue lifecycle and artifact transaction protocol. It preserves hardening trust
boundaries, Scheduler/Router unknown-outcome semantics, domain business authority,
accepted backup retention and each Goal's acceptance. It creates no new Agent
identity, Grant, business-data repair, Scheduler retry, or process-fence bypass.
No active standing deployment Spec is silently amended or partially superseded.
Historical exact-release mandates remain records for those releases; they do not
authorize future autonomous deployment. Any active Contract conflict discovered
in profile adoption requires a whole-authority successor before that profile activates.

The unmerged stage-isolation document at `569720870781efdc15e36d71c8728fb29b8dc2bd`
is historical input only. This Spec adopts immutable generations and separate
rollback evidence but assigns generation ownership to the Train, not one Goal.

Evidence and provenance: [fresh census](../investigations/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_CENSUS.md),
OBS/CLM/EVD-DCP-001 through 005 as applicable. Canonical design base:
`d602b592fad345fb1c9adebe2bc6611a6f5cfdc2`. Claims of production readiness are absent.

## 2. Decisions

- DEC-DCP-001: deploy immutable artifacts, independently verify covered Goals.
- DEC-DCP-002: root `agent-deployd` enforces admission and transaction decisions
  for the general control plane; §9 explicitly maps only its named profile to the
  existing peer-authenticated DS executor, with the same admission obligations;
  the non-root Train proposes grouping/order, builds and monitors but cannot grant itself authority.
- DEC-DCP-003: fixed privileged profiles; no caller-supplied shell, code hook, path,
  environment, UID/GID, launchctl target, migration or rollback command.
- DEC-DCP-004: one durable queue and mutex; crash recovery is readback-driven, never
  timeout-driven replay. Default independent-unit failure policy is `STOP_TRAIN`.
- DEC-DCP-005: explicit once-per-profile bootstrap/adoption, then standing routine
  authority. A new privilege/profile/controller change is not a routine release.

All decisions above are proposed for Owner acceptance together. Normative choices
are specified below; acceptance and privileged bootstrap remain separate acts.

## 3. Components and trust

```text
Goal producers -> authenticated ready registry -> non-root planner/build workers
                                               -> immutable release proposal
trusted build/review/authority issuers ---------> root admission verifier
                                                 durable queue / Train ordering
                                                 GLOBAL_PRODUCTION_MUTATION_MUTEX
                                                 fixed profile executor
                                                 rollback + per-Goal receipts
```

The implementation uses a compiled native privileged core with kernel peer identity
and descriptor-relative filesystem operations (Rust is the planned implementation).
No package manager or candidate JavaScript/Python/shell runs as root during build,
artifact validation, or generic health verification. Fixed root-executed services
such as Watchdog W2 are explicit privileged payload facets, requiring the profile's
root-code review policy; they cannot be hidden in an ordinary app-only artifact.

Bootstrap layout: `/usr/local/libexec/agent-deployd/` executable closure,
`/Library/LaunchDaemons/ai.agent-deployd.plist`,
`/var/db/agent-deployd/` durable catalog/queue/journal/artifacts/rollback/receipts,
and `/var/run/agent-deployd/control.sock`. Code, plist and trust/profile policy are
root:wheel and non-writable by callers; protected state 0700, ordinary policy files
0644, private trust/receipt material 0600. Socket parent is root-owned 0750 and
socket 0660 for a dedicated bootstrap-resolved caller group. All numeric identities,
ancestors, ACLs and interpreter/library closure are frozen in the bootstrap receipt.
No assumption that existing `staff` membership is a safe deployment permission.

For §9 only, the separately reviewed existing DS Python/interpreter closure is
the fixed privileged executor, not candidate code. Its existing socket, Owner UID
and mutation domain replace the above *backend layout* for that profile only;
§9 states exact limits and adoption proof. No new daemon or socket is installed.
This exception grants no candidate-supplied root execution and is not global PDC
bootstrap, target enrollment or legacy-retirement evidence.

## 4. Contracts

### CTR-DCP-001 — readiness admission and exhaustive discovery

A producer MUST register a durable readiness record with goal ID, source/repo,
accepted authority revisions, artifact requirements, dependency constraints,
verification profile and originating issuer. Only an authenticated producer may
update its records with revision CAS. `source-fixed`, `merged`, task titles or
caller strings `review=PASS` MUST NOT imply DEPLOYMENT_READY. The Train consumes a
complete paginated snapshot plus cursor-based changes and records census revision;
disconnection retains queued work but cannot infer new readiness. Registered
producer watermark gaps block claims of an exhaustive census. Manual historical
import requires provenance and an explicit importer receipt, never guessed closure.

### CTR-DCP-002 — canonical immutable DeploymentUnit

The canonical versioned record MUST contain:

```text
deployment_unit_id, deployment_profile, profile_revision, target_runtime, repo,
source_sha, artifact_sha256, build_attestation_digest, manifest_digest,
deployment_intent_id, desired_state_revision, expected_target_generation,
covered_goal_ids[], goal_coverage[], dependency_units[], required_reviews[],
preflight_policy, privileged_apply_profile, restart_profile,
verification_profiles[], rollback_profile, standing_authority_revision,
policy_epoch, receipts[]
```

Identifiers have bounded ASCII schemas; repo/profile/runtime IDs resolve only in
the protected catalog. Goal coverage binds exact acceptance contract revisions,
source inclusion and reviewed release-face hashes. Runtime identity includes host,
launchd domain, label and install-root identity; system/gui labels are distinct.
`receipts[]` are immutable references appended in the journal, not edits to the
sealed artifact. Artifact identity is `(repo, source, artifact digest)`. A request
ID provides transport idempotency. The daemon alone allocates a monotonic deployment
intent for an authenticated desired-state revision and expected target generation;
callers cannot allocate intents or reset attempt budgets by changing request IDs.
For §9, target generation changes only after activation readback; an inactive
installation has its own immutable receipt and does not change active generation.
Target generation otherwise identifies the daemon's installed release record, distinct from
service process generation/PID. Rollback may restore that release record only with
verified restored bytes/metadata and a separately recorded fresh process readback.
Durable unit ID derives from the canonical immutable descriptor. Deployment dedupe
is `(target, intent, profile revision, artifact digest)`; execution attempts are
append-only journal records under that unit, not mutations of its descriptor.
Goal/review/policy changes cannot silently mutate a unit. Late identical-artifact
Goals use a new immutable coverage attachment and existing install receipt.

### CTR-DCP-003 — collapse and coverage

For §9, enforce one successful inactive publication and one successful activation
per intent; the activation materialization is a journaled step of that linked
intent, not a fresh installation budget. An inactive receipt is not active-version
verification or Goal completion. Other profiles use the following unchanged rule.
The queue MUST enforce one successful installation per intent, coalescing simultaneous
submissions and transport retries. If the required artifact is already installed
and its generation/metadata is verified, attach verification with zero install or
restart. A legitimate A→B→A desired-state transition gets a new daemon intent and
fresh B preimage; it is not a duplicate of A's historical transaction. A failed
attempt may be re-admitted only under CTR-DCP-011, never by a caller-chosen new ID.
It MUST collapse ready Goals into the same
artifact only when one reviewed manifest proves every required face, acceptance
contract and dependency is covered. Newer SHA ancestry alone does not prove
coverage (reverts and integration changes are counterexamples). Profiles targeting
overlapping install roots cannot create separate concurrent release ownership.
A proposed newer unit may supersede only non-started units atomically, preserving
their FIFO age, dependency edges and Goal links. No in-flight replacement.

### CTR-DCP-004 — lineage and trusted build binding

Admission MUST verify an authenticated canonical acceptance/merge observation at
freeze, required independent review scope, exact source SHA/tree, build recipe,
toolchain/architecture, complete dependency closure and artifact digest. The build
issuer is isolated from submitting Agents and cannot be selected by them. A hash
and self-authored provenance JSON are insufficient. Independent review identities
must differ from semantic author and satisfy the profile's trusted issuer policy.
Trusted issuers/keys are established by bootstrap and cannot be replaced by requests.
Existing manual review receipts require authenticated trusted import; a URL alone
or an Agent's self-assertion cannot authorize root operations.

### CTR-DCP-005 — artifact admission and drift

The root intake accepts artifact bytes only from the profile's fixed staging/CAS
origin and a catalog-resolved digest. Requests cannot nominate a path or URL.
The daemon copies into a private root-owned temporary generation using opened
descriptors, verifies the complete descriptor/bytes and then publishes atomically.
It rejects absolute/parent paths, duplicate or case/Unicode-colliding entries,
symlinks, hardlinks, special files, out-of-manifest files, size-limit violations,
and unsafe ACL/metadata. Exact target mapping is profile-owned; manifest paths
cannot enlarge it. Rehash sealed inputs before/after apply and installed outputs.
No build, dependency install or in-place artifact patch after seal. A changed
artifact is a new unit; unreadable or unverifiable material fails closed.

### CTR-DCP-006 — main drift, revocation and policy freshness

Unrelated main movement MUST NOT stale a frozen artifact. Do not require live
`origin/main == source_sha`. Revalidate source acceptance, authenticated blocker/
revocation state and policy epoch under the mutex immediately before mutation.
The protected authority registry supplies monotonically versioned, signed policy
updates; callers cannot hide rollback of its epoch. If its bounded freshness lease
(profile-defined, maximum five minutes) expires or verification fails, no apply.
Explicit supersession/security blockers, artifact mismatch, unauthorized changes
and lost dependency compatibility still fail closed. Unit revocation after apply
does not invent a rollback; use its specified recovery policy.

### CTR-DCP-007 — socket authorization and declarative API

Protocol v1 allows `submit`, `status`, `receipt`, `cancel-pending`, and
`retry-verification`, each with request ID and catalog identifiers only. The daemon
reads peer credentials from the kernel, checks bootstrap ACL plus role/scope, and
never trusts request UID, environment or a PID supplied by the client. Peer identity
does not distinguish Agents sharing one uid: Goal ownership requires an independently
authenticated producer assertion, otherwise all such callers share one actor scope.
Messages have a 64 KiB limit, strict unknown-field rejection and bounded nesting.
Per-actor quotas/rate limits prevent one caller starving the queue. Submission ACK
follows durable commit; retries return the same request/unit state without replay.
Caller disconnect has no cancel semantics. Receipt output is actor-scoped/redacted.

For §9, INSTALL and ACTIVATE are immutable catalog phase units, submitted by the
existing declarative intake. They are not caller-chosen commands, paths or new
actors. The exact existing-DS transport mapping is fixed by §9, not by runtime
profile plugins. Existing installed DS actions do not acquire this capability from
this document or a new request field.

### CTR-DCP-008 — privileged profile contract

Each reviewed root-side profile MUST freeze legal repo/source lineage, build/CAS
origin, staging root, exact install slots, permitted file types/UID/GID/mode/ACL,
launchd domains/labels, typed config keys/destinations, rollback semantics, probes,
root-executed closure review and resource/time limits. Runtime app code must run as
the existing service identity, not as an arbitrary root verifier. External programs
use fixed absolute executable/argument templates, sanitized environment and no shell.
No environment override, PATH fallback, arbitrary chmod/chown/launchctl or recursive
ownership repair. Profiles cannot load candidate-supplied plugins. Updating daemon,
its policy/trust roots or expanding targets/privilege requires separate Owner authority.

### CTR-DCP-009 — one mutex over the transaction

For §9, use the existing DS mutex and bounded adoption proof in MSR-C02; do not
create an alternate lock. Each of its two transactions independently satisfies
this contract; the inactive waiting interval owns no mutation transaction or lock.
For all other profiles, the permanent root-owned mutex inode is `/var/db/agent-deployd/production.lock`;
only the daemon owns its exclusive OS lock. It is never unlinked/replaced for
stale-lock recovery. All enrolled targets share it, even across repositories.
Speculative read-only preflight may run earlier; authoritative PRECHECK, APPLY,
ROUTING/CONFIG, RESTART, READBACK, ACCEPTANCE, ROLLBACK/FINALIZE and RELEASE all
execute under one acquisition. Profile components cannot acquire independent locks,
accept “lock held” strings or release their parent's lock. Pending queue wait does
not hold the mutex. Child operations are bounded/owned and must be reconciled before
releasing transaction ownership; daemon exit alone is not proof they stopped.

### CTR-DCP-010 — queue order and dependency failures

Persist queue sequence and compare-and-swap transitions in one daemon-owned
transactional store. Schedule oldest dependency-ready unit first with stable unit-ID
tie breaking; replacements inherit oldest age and cannot cause indefinite deferral.
Detect cycles, missing/unaccepted prerequisites and incompatible target versions
before admission. Each dependency names exact unit/capability receipt and required
Goal outcomes; transport success cannot satisfy a failed semantic prerequisite.
Default failure policy `STOP_TRAIN` blocks subsequent units on infrastructure/unit
failure. `CONTINUE_INDEPENDENT` is available only as an accepted profile policy
and only after safe finalize, for units with no dependency/resource/rollback conflict.
Unknown mutation outcome always quarantines the host mutation lane regardless of policy.
`STOP_TRAIN` is a persisted pause: resume automatically only when its failed intent
has a proven safe disposition and its corrected unit/replacement passes all gates.
Dependents must still satisfy their own exact receipts. Unresolved failure never
gets skipped merely to resume work; no per-head Owner approval is added.

### CTR-DCP-011 — durable state machine and unknown recovery

§9 adds the explicit inactive-publication branch in MSR-C03 and linked activation
branch in MSR-C04. Only verified activation reaches APPLIED. No phase change, new
request ID or new phase unit resets intent deduplication or failure budgets.

```text
PROPOSED -> VALIDATING -> QUEUED -> PRECHECK -> APPLYING -> RESTARTING
 -> VERIFYING -> FINALIZING -> APPLIED
prewrite failure -> BLOCKED (NO_MUTATION)
postwrite known failure -> ROLLING_BACK -> ROLLED_BACK | QUARANTINED
ambiguous/crash outcome -> RECOVERING -> verified continuation | QUARANTINED
pending only -> CANCELLED | SUPERSEDED
```

Write and flush intent, preimage identity, phase, sequence and ownership before
each irreversible edge; flush outcomes before ACK. On startup acquire the mutex,
inspect nonterminal journal and actual bytes/service generation/owned operations
before admitting work. Finish a proven completed step or perform verified rollback;
otherwise retain `OUTCOME_UNKNOWN` and quarantine. No blind replay of copy, restart,
migration or canary; no “PID absent means side effects absent”. Bounded read-only
recovery (at most three probes within the profile deadline) prevents infinite loops.
`BLOCKED(NO_MUTATION)` may return to VALIDATING after fresh machine-verifiable
remediation evidence; at most three preflight attempts per intent. A ROLLED_BACK
attempt may start a second attempt only after complete preimage/service restoration,
owned-operation termination and fresh admission/precheck are proven, the failure
cause is resolved, and every potentially executed step is proven absent, restored,
or explicitly idempotent. At most two mutating attempts per intent (profiles may
lower this). Unknown canary/business side effects prohibit this path. Exhaustion
stays `BLOCKED/RETRY_BUDGET_EXHAUSTED`; duplicate submissions cannot refresh budgets.
Different artifact/profile/preimage requirements require a reviewed replacement unit;
only a trusted changed desired-state transition can allocate a new intent. Historical
attempt receipts remain immutable. QUARANTINED never auto-retries mutation.

### CTR-DCP-012 — fresh preimage, apply and restart

For §9 INSTALL only, MSR-C03 replaces active apply/restart with root-custodied
inactive publication and its verification, preserving the active service. ACTIVATE
uses the full following apply/restart/readback contract with a new fresh preimage;
an old installation-time snapshot cannot satisfy it.
After authoritative preflight, capture complete code/config/metadata/service
preimage privately under the mutex, including ABSENT markers and intended service
identity/generation. Stop if the expected live face differs; independent main drift
is unrelated. Do not snapshot or distribute secret values in public artifacts.
Quiesce only named affected services, prove required old generation exit, install
using same-filesystem temporary+rename operations and verify each exact face.
Multi-file transactions use a durable per-slot journal; rename is not a claim of
whole-release atomicity. Restart the shared parent once on the successful path;
separate rollback restarts are counted explicitly. Verify loaded generation,
installed digest and health; config strings/deployed SHA alone are insufficient.

### CTR-DCP-013 — rollback without privilege expansion

Rollback is daemon code over daemon-captured preimages, never a script in the
artifact. Validate paths/types/metadata and compare current values to the known
transaction face before restoration; never overwrite unrelated drift. Restore
only the profile's exact targets/config keys and prior service state, including
deleting only transaction-created files whose identities match. Failure to prove
rollback gives `UNSAFE_ROLLBACK`, quarantine and an actionable receipt. Secret
preimages stay protected with original access restrictions. No business-data
rollback or side-effect reversal is implied by filesystem restoration.

### CTR-DCP-014 — per-Goal acceptance and partial success

Execute each covered Goal's accepted verification profile with fixed identity,
inputs, deadline and idempotency/side-effect classification. Never send business
messages, create Grants or mutate domain data merely to make a canary pass; those
effects require existing explicit authority. Goal states are `PENDING`, `PASS`,
`FAIL`, `WAITING_EXTERNAL_ACCEPTANCE` or `OUTCOME_UNKNOWN`, separate from install state.
Infrastructure/security/rollback-invalidating failures roll back the unit; no Goal
closes until finalize. Pure Goal acceptance failures leave the proven shared release
installed: successful Goals close, failed Goals remain blocked. External/Owner
acceptance is bounded then pending, not fabricated PASS or indefinite mutex hold.
After safe finalize/release, later verification pins installed generation under the
same mutex; no redeploy if the correct artifact remains installed. Non-idempotent
unknown canaries require readback, never automatic resend. An identical late Goal
can attach verification only; a changed target face requires a new coverage assessment.

### CTR-DCP-015 — receipts and closure

Persist one transaction receipt and independent per-Goal receipts containing unit,
artifact, source, profile/policy/review digests, caller/issuer, dependency outcomes,
pre/postimage, old/new service generation, attempts, step results, rollback and
verification identities. Root-protected append-only records are authoritative;
unprivileged copies are verifiable exports. Redact secrets and private message bodies.
Only a durable PASS receipt from the accepted Goal verifier permits its producer
to CAS-close that Goal. Notify closure through a durable idempotent outbox; if the
producer is unavailable, retry closure delivery without reinstalling. Codex task
archive is a UI action and is not the canonical deployment receipt or Goal closure.

### CTR-DCP-016 — DEPLOYMENT_STANDING_AUTHORITY_V1

`AUTO_DEPLOY_ALLOWED` requires active Owner-accepted standing authority, enabled
profile, canonical lineage, trusted artifact/build binding, independent review PASS,
current policy with no blocker, dependency PASS, held global mutex, fresh preflight,
safe rollback and ready readback. It excludes destructive migration, unauthorized
business writes and privilege expansion. Normal deployment/restart, existing sudo
mechanics, unrelated main drift and repeated per-head acceptance are not escalation
reasons. Daemon execution uses no sudo and never asks for a password after bootstrap.

`HUMAN_REQUIRED` codes are closed: `NEW_PRIVILEGE`, `UNKNOWN_SCOPE`,
`DESTRUCTIVE_DATA_CHANGE`, `PROFILE_NOT_ALLOWED`, `ARTIFACT_MISMATCH`,
`UNSAFE_ROLLBACK`, `UNRESOLVED_DEPENDENCY_CONFLICT`. Unknown source/provenance or
mutation recovery uses `UNKNOWN_SCOPE` with the exact missing evidence. Ordinary
queue contention, unavailable trusted service, fresh-preimage mismatch or missing
review is `BLOCKED` with machine action/reason, not an invented Owner reapproval.
The caller cannot override a rejection. A rejected artifact remains rejected even
if a human presses approve; correction requires valid new evidence/unit/authority.

### CTR-DCP-017 — profile activation and bootstrap separation

`CONTROL_PLANE_SOURCE_FIXED != PRIVILEGED_BOOTSTRAP_ALLOWED`. Independent security
review must cover injection, traversal, symlink/race, caller-writable privileged
code, arbitrary launchctl/chmod/chown/config, environment injection, artifact
substitution, TOCTOU, rollback escalation, mutex bypass and legacy bypass.
After review, Owner separately authorizes one exact controller/profile/trust-root
bootstrap manifest, numeric identities, target enrollment and rollback package.
No proposed document, unit submission, successful fixture or review recommendation
is bootstrap permission. Bootstrap writes a protected epoch/receipt; only then may
standing normal deployment operate. Self-update and new profiles remain separately gated.

### CTR-DCP-018 — legacy retirement and complete adoption

For §9, inventory and retire/conflict-block competing writers for that same target
under MSR-C02; the retained existing DS is its sole approved executor, not a second
legacy backdoor. No claim of other-target or global retirement follows.
For every other enrolled target, inventory and retire all canonical writer paths:
source scripts, installed helpers, wrappers, sudoers rules, launchd/cron jobs and
direct service-account write permissions. Existing commands either fail with a
queue migration message or become nonprivileged enqueue-only clients. No old root
script, environment-based lock inheritance, or independent sudo grant stays a
canonical path. Entry points inside this repo get negative bypass tests; external
paths require owner-repo changes and installed readback before that target enables.
Migrate metadata preventing enrolled caller identities writing code/config/plists
directly, including currently user-owned svc-workflow service surfaces.
Enrollment MUST also prove callers cannot control the target launchd domain, signal
its service processes, or invoke another lifecycle manager outside the mutex.
Changing file ownership does not remove same-UID signal or GUI launchctl powers.
The current `gui/502/com.svc-workflow` target is therefore ineligible while caller
uid 502 retains those powers; activation requires independently accepted identity/
domain separation and executed lifecycle-denial evidence, not just hardened files.
Root Owner emergency containment remains a separately receipted exceptional action,
not a second routine deploy API. Impossible-to-revoke copies run by an omnipotent
Owner are outside the non-root adversary claim; they cannot count as canonical.
Partial adoption reports target coverage explicitly and MUST NOT claim global exit.

### CTR-DCP-019 — optional transition deployctl

If LaunchDaemon bootstrap is temporarily unavailable, a separately reviewed
root:wheel/non-caller-writable deployctl may expose exactly one no-argument `drain`
subcommand over the same protected queue, policy engine, journal and mutex.
Sudoers may allow only that exact installed binary and argument, no wildcard,
`SETENV`, shell, caller path or alternative command; execution is `sudo -n`.
The bootstrap receipt declares a sunset condition; daemon activation removes the
rule atomically. This is never `NOPASSWD: ALL` and never a parallel train.

### CTR-DCP-020 — resource bounds and control-plane failure

Each profile has finite staging bytes/files, queue/actor quota, preflight/restart/
verification/rollback timeouts and retention policy. Full disk, corrupt journal,
unavailable trust service, failed fsync or unknown metadata refuses mutation and
returns the exact recoverable phase. Durable failed units/receipts are retained;
GC may remove only unreferenced artifacts/preimages under accepted retention,
never the current generation, open transaction, pinned rollback or review evidence.
No silent boot-loop apply, unattended privilege repair, or infinite retry.

## 5. Initial profile adoption boundaries

The framework can be implemented after this Spec is accepted; live profiles remain
disabled until their exact profile definitions and authority dependencies pass
independent review and Owner bootstrap. This is intentional separation of source
readiness from privileged activation, not permission to ship incomplete profiles.

| Proposed profile family | Legal target/effects | Adoption requirement |
|---|---|---|
| dsh system runtime | fixed `/usr/local/libexec/agent-core/app` release slots; `system/ai.agent-core.runtime`; preserve unrelated config/model overrides | enumerate complete manifest; independent per-Goal coverage; app/node/harness/root-code facets separated |
| Watchdog adjuncts in dsh transaction | exact W1/W2 plists and root-reviewed W2 closure; typed routing; incident migration only under its accepted authority | resolve 505:20 versus routing 0:601/0:20 roles; no unknown-occurrence mutation or fence release |
| auth-service | exact root-protected release root and `system/com.auth-service`; secret references preserved | external repo authority, immutable build and installed entry cleanup; no incidental Grant/schema/DB mutation |
| svc-workflow | exact binary slot under a separately accepted service identity/domain inaccessible to caller lifecycle control; current `gui/502` target disabled | external repo authority, caller-write and lifecycle/signal revocation; DB/reconciliation remains separately authorized |

No profile is enabled by this table. Grant/identity/domain reconciliation cannot
be squeezed into deployment; dependent units wait for independently evidenced
domain prerequisites. Runtime identities cannot be guessed from service labels.

## 6. Acceptance matrix

Each row is a required future executed test, not a result. Evidence MUST bind exact
implementation/profile/authority revisions, environment, inputs, result and negative
counterexample. F = disposable unprivileged fixtures; M = isolated macOS integration;
P = separately authorized production/bootstrap. Failure means the named forbidden
behavior occurs, required proof is missing, or expected state/receipt differs.

| Acceptance | Contracts | Method / required evidence | Environment | Expected result and rejecting counterexample |
|---|---|---|---|---|
| ACC-DCP-001 | 001 | producer pagination/CAS/disconnection tests + import receipts | F | full registered census; missing watermark blocks exhaustive claim; merged title cannot enqueue |
| ACC-DCP-002 | 002,003 | duplicate requests, late Goal, A→B→A, supersession/revert fixtures; intent/install/restart counters | F/M | one successful install per intent; already-installed artifact has zero reinstall; A→B→A gets a fresh authorized intent; reverted Goal cannot collapse |
| ACC-DCP-003 | 004,006 | authentic and forged lineage/build/review receipts; source drift and revocation tests | F/M | unrelated main drift accepted; self-PASS, stale epoch, revoked source and missing build proof rejected |
| ACC-DCP-004 | 005,008 | traversal/case collision/link/special-file/oversize/ACL fixtures and swap during admission/hash/apply | M | zero out-of-profile writes; same opened bytes installed; mismatch rejected before mutation |
| ACC-DCP-005 | 007 | real Unix socket peer identities, bad fields, uid spoof, shared-uid ownership and disconnect/retry | M | declarative scoped API; durable dedupe ACK; caller data cannot choose identity/root command |
| ACC-DCP-006 | 008,017,019 | inject environment/path/command/launch target/chmod params and writable dependency; exact sudoers parser check | M/P | all rejected; no arbitrary root execution, no NOPASSWD ALL, no interactive normal sudo |
| ACC-DCP-007 | 009,010 | concurrent independent targets and legacy callers; phase trace from precheck through finalize | M | maximum mutator=1 for entire transaction; no between-phase unlock or inherited-string bypass |
| ACC-DCP-008 | 010 | DAG cycle, failed prerequisite, same-target conflict, FIFO starvation and explicit continue-policy fixtures | F | dependents never run; default STOP; only proven independent units continue under selected policy |
| ACC-DCP-009 | 010,011,020 | kill at every durable edge, disk/fsync/hung-action faults; known rollback/remediation, budget exhaustion and repeated request IDs | M | verified bounded re-admission and STOP_TRAIN resumption; unknown stays quarantined; caller cannot reset budget; no blind replay or stale lock unlink |
| ACC-DCP-010 | 012,013 | fresh preimage drift, partial install, restart timeout, readback failure and rollback drift | M/P | exact rollback or explicit unsafe quarantine; preserve secrets/adjacent files; real generation proof |
| ACC-DCP-011 | 014,015 | mixed Goal PASS/FAIL, required external acceptance, unknown canary, late coverage and closure transport failure | F/M/P | successful Goals close after finalize; failures remain blocked; retry verification/outbox causes zero installs/messages replay |
| ACC-DCP-012 | 016,017 | standing-authority truth table and explicit denied bootstrap/control-plane self-update | F/M/P | normal rule-authorized release needs no per-head Owner action; missing activation stays disabled |
| ACC-DCP-013 | 018 | entry inventory; file/sudoers checks; legacy invoke, direct launchctl/restart and same-UID signal denial under actual caller identities | M/P | every enrolled direct writer/lifecycle bypass denied; gui/502 caller-owned service cannot enroll; omitted/unreadable surface prevents global PASS |
| ACC-DCP-014 | 019,020 | transition sunset, quota exhaustion, retention pin, malformed journal and long-running verifier | F/M/P | bounded fail-closed behavior; transition rule removed; live/preimage evidence preserved |

Reverse coverage: CTR-001→ACC-001; 002/003→002; 004→003; 005→004;
006→003; 007→005; 008→004/006; 009→007; 010→007/008; 011→009;
012/013→010; 014/015→011; 016→012; 017→006/012; 018→013;
019→006/014; 020→009/014. All 20 Contracts have rejecting acceptance methods.

## 7. Migration and rollback

Sequence: accepted authority → isolated implementation + fixtures → independent
security review → exact nonprivileged bootstrap preparation → separate Owner
bootstrap permission → disabled daemon/trust install → retire legacy writers and
enroll profiles under one maintenance transaction → harmless real canary → enable
standing normal Train → joint release proof and per-Goal receipts.

Before activation, require a receipted census of all four existing lock families
and active legacy transactions; no lock stealing or blanket deletion. Migration
quiesces old canonical entrances before the new lane is enabled. If a target cannot
retire its writer permissions, it remains unenrolled and overall Goal remains incomplete.
Bootstrap rollback disables new admission, reconciles/drains owned work and restores
the exact pre-bootstrap code/policy/ACL/plist state only from verified preimages.
It does not silently reactivate old automated deploy paths; any restored routine
authority needs an explicit rollback disposition. Receipt history is preserved.

## 8. Alternatives, status and completion

Rejected for this proposed design: generic sudo wrapper; per-Goal locks;
live-main equality; caller-provided command/path/profile implementation; deployment
of arbitrary same-repo HEAD; uid-only per-Agent claims; health-only closure; blind
unknown replay; permanent parallel legacy entry. They reopen only on new evidence
and accepted authority, never by profile parameter.

```text
OPEN_OWNER_DECISIONS = EXACT_V2_ACCEPTANCE_AND_LATER_PROFILE_ADOPTION
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
IMPLEMENTATION_ALLOWED_NOW = NO_PROPOSED; CONTRACTS_AFTER_EXACT_ACCEPTANCE_MERGE
PRIVILEGED_BOOTSTRAP_ALLOWED = NO
PRODUCTION_MUTATION_PERFORMED = NO
```

Final conformance must report every requested gate independently: queue exists;
multi-Goal unit; same target installs once; immutable artifact binding; single mutex;
per-Goal locks removed/noncanonical; allowlisted controller; no arbitrary root
commands; no NOPASSWD ALL; no normal interactive sudo; standing authority; no normal
per-head Owner confirmation; preserved per-Goal receipts; all legacy canonical
entrances exited. None becomes YES from this proposal, a fixture alone, or a partial
profile adoption. Production completion also needs real canary/readback evidence.

## 9. Fixed registered-service maintenance profile

### Evidence and bounded decision

**OBS-MSR-001:** installed DS source `95dc02f87106ca9e131839e6d9843a65adcff6018bfbf47725e9241b4e80961d`,
observed 2026-09-29, has a strict active-target registry and coupled DEPLOY→restart→
health→receipt. Five isolated routing/schema probes reject inactive/maintenance
fields, separate INSTALL/ACTIVATE requests and an inactive registry slot, before
any effect. Exact evidence is
`/Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG/deployment-maintenance-separation-20260929-v1/PROBE_RESULT.json`;
independent ruling SHA256 `cbf11956c9bcf5f2c190b835501055474bd4aa987e5052bde274f76dfe6c725f`.
These observations justify the missing contract, not production authority or a
claim that the observed source remains installed later. ADOPT records existing
bytes; CAPTURE/ADMIT binds a current rollback generation. Neither installs a new
inactive candidate. A client inbox is untrusted preparation, never installation.

**DEC-MSR-001:** add one profile, `scheduler-whole-main-maintenance-v1`, for the
already registered `scheduler-whole-main` service. This profile is not a generic
service installer. No other registry unit, service, HR recovery operation, caller,
credential, daemon or business admission policy is added. The existing ordinary
DEPLOY/ROLLBACK APIs keep their semantics; production adoption must serialize or
disable their conflicting writes, not silently reinterpret an old request/ID.

**MSR-C01 — Fixed slots and inactive isolation.** The host-local service is
`system/ai.agent-core.runtime`, active app `/usr/local/libexec/agent-core/app`,
Runtime UID505/GID601; candidate lineage is `mayf3/dsh-agent-core`. Registry and
launch-source identities must match the exact adopted profile, including preserved
`node_modules` closure; drift is BLOCKED, not an implicit registry update. No plist,
identity, credential, settings or business-store change is a profile effect.
The only new inactive slot family is
`/usr/local/libexec/agent-core/.ds-generations/scheduler-whole-main/inactive/<unit-id>/tree`.
`unit-id` is the daemon-derived canonical catalog ID, never a caller path. The
profile owns this namespace: uid0/gid0, directories0700, regular payload files0400,
no hardlinks, special files, external symlinks, caller-write ACLs or writable code
closure. Ancestor/name/descriptor custody and same-opened-byte hashes are verified
before and after publication. Reviewed internal relative links may resolve only
inside the sealed tree; no link can name active app, receipts, secrets or staging.
Bound the **complete whole-app artifact**, including its required `node_modules`
closure, to 65,536 entries, 512 MiB of logical payload bytes, and depth32. Count the
root as one entry and every directory, regular file and link exactly once without
following links; depth is root=0; payload bytes are the sum of regular-file sizes
and link-target byte lengths. Never prune dependencies to satisfy a limit. Each
immutable INSTALL unit must bind the exact complete inventory digest, artifact
digest, measured entry count, logical byte count and maximum depth; verify those
measurements against the candidate before publication. Drift, missing closure or
any exceeded bound rejects the whole candidate without partial publication; a
larger future complete artifact needs a reviewed profile revision, not a caller
limit override.

EVD-MSR-CAPACITY-01: Root's attributable read-only observation on 2026-09-29
(delivery `92bf73da-fd42-5d15-afab-2ba79643e904`, fixed active app path) reports
36,610 entries by `find ... -print | wc -l` and 370,264 KiB by `du -sk`. This
falsifies the old 20,000-entry bound and supports bounded entry headroom at 65,536.
It does not bind an immutable candidate, prove dependency completeness/depth, or
measure logical bytes: disk allocation is not the payload-byte metric. Thus the
exact complete artifact inventory/measurements remain required release inputs;
no claim that this observation alone admits the current tree. The capacity fixture
in the accompanying report covers the measured count and limit+1 rejection;
complete dependency-preserving inventory validation is a later source test. The inactive tree is inaccessible to Runtime505 and cannot be an
entrypoint, route, import root or worker source. Installation never starts candidate
code or admits requests to it. Existing active B may keep serving; this is not a
promise that the whole service has no traffic. Normal-Agent configuration remains
unchanged. No candidate hook executes as root.

**MSR-C02 — Existing executor and adoption.** This profile alone uses the existing
root DS at `/usr/local/libexec/agent-deploy-system/deployment_system.py`, its fixed
reviewed interpreter closure, socket `/private/var/run/agent-deploy-system.sock`,
and kernel-authenticated Owner UID502. Shared-UID Agents gain no new identities or
authority; preserve authenticated producer/review/policy checks. The only transport
addition is a fixed mapping of CTR-DCP-007 `submit/status/receipt/cancel-pending/
retry-verification` to catalog IDs in this one profile. No caller phase switch,
slot, service selector, UID, command, environment, proof or PASS input is admitted.
The catalog, authenticated by existing trusted issuer rules, distinguishes phase
units; transport acceptance alone is not operation admission. This backend's fixed
profile policy is `/private/var/db/agent-deploy-system-config/scheduler-whole-main-maintenance-v1.json`;
immutable units/intents/journal live under
`/private/var/db/agent-deploy-system/maintenance-units/`. These are root0/gid0,
directories0700/files0600, not caller-supplied files or a new database service.
Independent operation receipts remain in the existing DS receipts namespace;
new private receipt fields stay0600, with only actor-scoped redacted projections
available through the required new profile `receipt` capability specified in
MSR-C05; this is not an already installed DS action. Authenticated producer assertions and reviewed unit
provenance are required before privileged import; UID502 alone cannot write policy,
forge review/standing authority, allocate intent, or choose arbitrary catalog data. No plugin loader,
root shell, new listener, sudo or password fallback.
Use the existing permanent `/private/var/db/agent-deploy-system/mutation.lock`
inode, with reviewed custody checks and no create/replace/unlink during operation.
Each phase holds it from authoritative precheck through its own final receipt.
Waiting for ACTIVATE holds no lock; no later operation can claim continuity with
INSTALL's expired lock. Adoption must preserve the one-host mutation domain across
ALL enrolled targets: every enrolled mutable operation, including ordinary DS and
any PDC/HR lane, must share this actual canonical lock domain or be mechanically
blocked for the entire adoption period. Proof limited to overlapping app/route
writers is insufficient. If another domain can independently mutate even a
different enrolled target, adoption is BLOCKED; this scoped backend mapping does
not waive the whole-host invariant. Unknown or active conflicting ownership
blocks effects; priority remains with HR recovery.
The existing service/lock mapping is a scoped V2 exception to §§3, 009 and 018,
not evidence that the general agent-deployd layout or global adoption exists.
Root installation/update of this reviewed code/profile still requires one exact
CTR-DCP-017 bootstrap/adoption and rollback manifest; this draft supplies none.

**MSR-C03 — INSTALL transaction.** A reviewed immutable DeploymentUnit for INSTALL
binds profile revision, policy epoch, target, desired-state intent, source/artifact,
manifest/build/review identities, current registry, slot identity and limits. Under
MSR-C02, validate provenance/custody and current active generation, flush intent,
and copy verified candidate bytes to a same-filesystem owned temporary slot. Verify
complete bytes/metadata/closure, atomically publish to the fixed inactive slot,
fsync directory and write an independently addressable root receipt
`INSTALLED_INACTIVE` before ACK. State path is PRECHECK→INSTALLING→
VERIFYING_INACTIVE→INSTALLED_INACTIVE; it is not APPLIED, an active generation or
business acceptance. No active-target write, routing change, stop, restart or
application canary occurs. Receipt binds unit/intent/profile/policy, exact tree and
metadata digests, slot identity, installer/caller/review provenance and unchanged
active generation observation. Only that receipt—not inbox existence—supplies the
activation dependency. One successful publication per intent; duplicate submission
returns its existing receipt without copying or starting anything.

**MSR-C04 — ACTIVATE transaction.** A distinct immutable phase unit and operation
receipt share the original desired-state intent/artifact/profile; activation cannot
allocate a fresh intent merely to bypass INSTALL eligibility or attempt limits.
An authenticated authorized release decision may be automated under standing
policy; no per-head human prompt is added. Before any effect, require exact trusted
INSTALL receipt, stable slot bytes/metadata, current policy/review/registry, current
active generation and newly captured compatible rollback. If B changed while C
waited, reject stale activation rather than using INSTALL's old preimage. Hold the
same mutex throughout this new transaction. Materialize the admitted candidate
into a private same-filesystem active replacement, applying only the existing
profile's UID505/GID601/file-mode policy there; never chmod/chown the sealed inactive
slot or recursively repair unrelated ownership. Preserve/revalidate dependencies
rather than taking mutable import paths on trust. Quiesce the owned old Runtime,
atomically switch the fixed active tree, restart once and prove exact loaded
candidate generation, health and ordinary admission before APPLIED. Journal all
slots/steps and retain independent activation/Goal receipts. Candidate ordinary
admission must remain closed until startup/readback proves its authorized generation;
if the existing startup seam cannot enforce that, source conformance fails before
adoption—health polling after early admission is insufficient. No HR fence or
business-store bypass is permitted. Actual business validation remains separate.

**MSR-C05 — Identity, budgets and lost response.** INSTALL and ACTIVATE each have
an independently addressable immutable operation ID, joined by the daemon intent
and exact install-receipt digest. Apply CTR-DCP-002/003 coalescing across transports.
At most one mutating attempt for each phase in this profile; an UNKNOWN phase never
gets another attempt via new request/unit ID. A new desired-state intent requires
trusted changed state and proven safe disposition, not caller insistence. Lost ACK
or closed client does not cancel, roll back, resume or replay. Read the exact
operation receipt through the following **new, reviewed profile-specific readback**,
not an assumed existing DS path. The installed DS has root-owned per-ID files and
lexical `STATUS.last_receipt`, but no generic per-ID socket action; the current
nonprivileged `scripts/lib/deployment-reuse/receipt.py` recognizes only old
DEPLOY/ROLLBACK shapes and supplies no maintenance receipt capability.

**Independent reader bootstrap prerequisite.** A new maintenance reader cannot
prove its own installation. Before its bootstrap mutation, CTR-DCP-017 must bind
an independently callable, already-installed updater receipt/readback mechanism:
exact executor/client hashes and kernel caller, unique bootstrap operation ID,
expected service preimage/candidate/rollback digests, durable terminal disposition,
and fresh installed/loaded reader closure. The reconciliation implementation must
predate the new reader and remain callable after a lost bootstrap ACK or updater
restart. Its exact-ID receipt proves only that bootstrap operation's disposition;
a matching fresh service/closure readback proves installed bytes/loaded identity,
not INSTALL/ACTIVATE or business success. Both are required. Missing receipt,
unknown schema/custody, inconsistent disposition or unavailable loaded closure
remain UNKNOWN, keep phase admission disabled, and never authorize replay.

**Current evidence boundary:** the installed-byte snapshot SHA
`95dc02f87106ca9e131839e6d9843a65adcff6018bfbf47725e9241b4e80961d`
exposes authenticated `{action: STATUS}` with PID/registry/units and lexical
`last_receipt`; this is not exact bootstrap-operation proof or loaded-code proof.
The existing nonprivileged `receipt.py OPERATION_ID REGISTERED_UNIT` validates
only DEPLOY/ROLLBACK records. Neither proves installation of this new reader.
`DS_UPDATE` is guarded by `p0_maintained_ds_update` (fixed P0 repair ID, artifact and
maintenance eligibility); it is not generic authorization for this profile.
No sufficient already-installed bootstrap reconciliation path is established by
this proposal's evidence. The narrow missing prerequisite is an authorized
existing updater's exact-operation durable receipt **and** independent current
reader-closure readback, callable before the reader exists. Root may close this
by pinning a genuinely existing lawful entry and its demonstrated schema/custody/
operation binding in the exact CTR-DCP-017 adoption; STATUS alone or a successful
socket response cannot close it. If the installed interfaces cannot supply it,
that bounded updater/readback adaptation and its authority/adoption must be
reviewed before bootstrap, never silently inferred from DS_UPDATE or installed
after lost ACK. This proposal authorizes no such privileged update. Absence of
that prerequisite blocks reader bootstrap and both phases, not ordinary existing
DEPLOY/ROLLBACK or independently authorized HR recovery.

Before the first INSTALL or ACTIVATE, the same authenticated fixed DS endpoint
must have the CTR-DCP-007 `receipt` mapping for this profile installed, independently
reviewed and verified under its exact adopted service/client/schema digests. It
accepts only request ID and exact immutable operation/catalog identifiers under
this fixed profile; no path, command, UID, service or schema selector. Kernel peer
and existing authenticated actor/producer scope must match the authoritative
operation binding. Resolve only the daemon-owned per-ID journal/receipt namespace,
with custody, nofollow and stable identity checks; never search by filename order.
Project a bounded redacted response containing schema version, operation/unit/intent,
profile revision, phase (INSTALL, ACTIVATE or its rollback), disposition, registry/
policy identities, artifact digest, install-receipt linkage when applicable and
receipt digest. Recognize `INSTALLED_INACTIVE`, activation APPLIED, rollback and
failure/UNKNOWN dispositions without treating inactive installation as activation
or business success. Reject wrong ID, unit/profile/registry, malformed or
unsupported schema, cross-actor linkage and unstable custody. Receipt absence
returns UNKNOWN even when the request was disconnected; status is not proof of
no effect.

The adoption evidence must exercise this installed readback against reviewed
non-mutating conformance records in the private namespace covering both phase
schemas, rollback, failure and absence (clearly tagged as fixtures, not operation
success), plus wrong actor/ID and unknown schema negatives. The normal readback
parser/custody/authentication path must be used; a version string or mock endpoint
is insufficient. Such records are fixed adoption inputs, not caller-supplied
receipts. INSTALL/ACTIVATE admission remains disabled until that evidence matches
the exact installed reader closure. Preserve compatible readback across restart,
service rollback and every retained receipt version; a service change that loses
this ability is inadmissible. Lost ACK must never require replaying mutation,
installing its reader afterward or weakening file permissions. Absence, EACCES, incomplete/crash state
and ambiguous disposition are UNKNOWN, never no-effect evidence. Lexical
STATUS.last_receipt is not an operation lookup. Prewrite BLOCKED remediation may
revalidate only inside the inherited preflight bound and without inventing a new
mutating attempt. Bound active INSTALL to120s and ACTIVATE to300s; each owned stop/start/health
step is at most60s, bounded read-only recovery at most three probes of5s each.
Timeout stops new effects and records UNKNOWN; it is not proof of safe termination
or permission to release a lease held by uncertain owned work. The original
controller remains the named custodian until proven safe disposition, with queryable
durable state. No timer authorizes activation or cleanup.

**MSR-C06 — Crash, rollback and retention.** Flush phase intent and identities
before writes; restart reconciles under the same domain before new work. INSTALL
crash leaves its own slot/journal retained until readback proves complete inactive
publication or exact pre-publication absence; otherwise quarantine and no activate.
Its failure never permits touching active B. Inactive slot garbage collection is
out of this profile: retain failed/superseded slots and receipts; exhaustion blocks
new installation, not deletion or capacity bypass. ACTIVATE known failure may use
only the just-captured exact rollback under original custody; an ambiguous child,
request or external effect retains UNKNOWN and inhibits further conflicting work.
An independently admitted rollback of activated C restores captured B bytes,
metadata and service generation with fresh readback and its own receipt; it does
not replay B's original request or old business work. On rollback mismatch retain
UNSAFE_ROLLBACK/quarantine. Active B may be released only after proven restoration;
no automatic fence clear or unverified claim of availability. All historical
install/activation/rollback receipts and attempt identities survive.

**MSR-C07 — Evidence and success.** Keep SOURCE_READY, INSTALLED_CALLABLE and
BUSINESS_ACCEPTED separate. Source requires fixed-input isolation, transition and
fault evidence plus independent review. Installed-callable requires exact adopted
service/profile bytes, kernel caller, catalog/slot/lock and independent real
INSTALL and ACTIVATE receipts; an inbox or installed DS script is insufficient.
Business acceptance requires genuine named-version B→C→B service use with attributable
request/results and no early candidate admission, not test-mode restart/health.
No product implementation may rely on this proposed Spec. After exact lifecycle
acceptance/merge, bounded source/tests are the next step on the original writer;
production adoption and validation wait for their separately bound Root window.

### Added acceptance matrix (V1 matrix remains applicable)

F = isolated source fixture; I = separately authorized installed/live operation.
Every F result earns source evidence only; I evidence is required for the last two
readiness states. B and C are distinct reviewed whole-app artifacts for the same
fixed service, not different units or registry targets.

| Case | Contracts | Method/environment and required evidence | Expected result; failure condition |
|---|---|---|---|
| ACC-MSR-01 | C01,C02 | F: full-closure inventory including node_modules, measured 36,610-entry count, 65,536 boundary and 65,537 rejection, 512 MiB+1 byte/depth33/mismatched inventory rejection, plus slot/path/link/ACL/owner/UID/unknown-field negatives; I: adopted closure and Runtime505 denied traversal | Only fixed root slot and existing peer/profile admitted; any arbitrary path/caller, candidate import before activation or concurrent writer fails. |
| ACC-MSR-02 | C01,C03,C07 | F: A active, install B, journal/fsync fault injection and request probe; I: exact INSTALL receipt, inactive hash/custody and attributable traffic served only by A | B durable/inactive, A unchanged; inbox-only, startup, B admission, active-generation advance or APPLIED on INSTALL fails. |
| ACC-MSR-03 | C02,C04,C07 | F: activate installed B; I: fresh A preimage/rollback, exact receipt join, owned restart, loaded B and ordinary request/result | Only authorized B becomes active after admission proof; health-only, receipt substitution or early admission fails. |
| ACC-MSR-04 | C03,C04,C07 | F/I: after B active, install distinct C then activate C, same service and exact phase receipts | B serves during inert C wait; activation has fresh B rollback. Changed registry/preimage/slot/policy between phases blocks, never silently installs different C. |
| ACC-MSR-05 | C02,C04,C06,C07 | F/I: explicit rollback C→captured B, byte/metadata/service readback, genuine B request/result | Independent rollback receipt and restored B; stale snapshot, old B replay or unverified restored admission fails. |
| ACC-MSR-06 | C03,C04,C05 | F: new reader self-certification, bootstrap ACK loss without independent exact-ID disposition/closure, reader absent/wrong schema/wrong actor all prevent first mutation; both phase and rollback schemas, close client before ACK; I: bootstrap reconciled through a pinned pre-existing entry before new-reader conformance and first mutation, then exact-ID reconciliation of genuine phase receipts including lost-response run if exercised | One publication/activation at most; duplicate/reordered/new request IDs return original disposition. Missing receipt remains UNKNOWN; missing reader cannot be repaired after mutation as a lost-ACK prerequisite; mutation replay or cross-actor receipt disclosure fails. |
| ACC-MSR-07 | C02,C05,C06 | F: another independently mutable lock domain for a different enrolled target (adoption rejected), crashes before/after rename, lost lock, live/unknown owned child, disk pressure, changed rollback; I: bounded authorized fault/readback evidence when required by adoption | Retained truthful state, no new conflict/cleanup/activation; absence or deadline must not imply safety. Verified rollback only; unverifiable path quarantines. |
| ACC-MSR-08 | C01..C07 | Docs/F: same-source/head/review and reverse contract coverage; I: exact adoption, whole B→C→B receipts plus business proof | SOURCE_READY alone never sets INSTALLED_CALLABLE/BUSINESS_ACCEPTED; old ordinary actions unchanged, HR lane untouched; any speculative production claim fails. |

### Exact acceptance boundary

This proposal requests acceptance of the scoped V2 decisions/contracts, not a
release or privileged installation. An authorized acceptance actor must bind the
reviewed commit and final accepted head. Lifecycle integration atomically marks V2
accepted, V1 superseded with V2 backlink, and the index current; until then V1 is
unchanged/current. Do not implement this profile from a proposed branch. A separate
exact CTR-DCP-017 adoption must later pin service/interpreter/client/catalog/slot
policy, actual numeric custody, enrolled target, mutex/writer retirement and
rollback. Merely accepting this Spec does not authorize DS_UPDATE, shim changes,
Runtime restart, new messages or current production writes.

### Focused V1 inheritance proof

`docs/reports/pdc-v2-inheritance/verify.py` compares the exact accepted V1 bytes
with this V2 and the independently reviewable `allowed-delta.json`. The finite
allowlist enumerates exact before/after spans for lifecycle/frontmatter, the
named-profile executor mapping and CTR-DCP-002/003/007/009/011/012/018; §9 is the
only new normative section. Every other inherited byte, including every other
Decision/Contract and acceptance/migration obligation, must match. The checker
reports all five Decisions and twenty Contracts separately with hashes, checks
reverse reconstruction, and rejects unlisted changes. A machine result binds V1,
V2, allowlist, checker and exact Git head; it is inheritance evidence, not semantic
acceptance or current installation evidence. Editing its allowlist requires the
same independent affected-surface review; merely regenerating it is not a pass.
