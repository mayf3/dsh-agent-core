---
spec_id: PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1
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
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# Production Deployment Control Plane V1

**PROPOSED; not accepted and not implementation or bootstrap permission.**
`implementation_authority: contracts` describes the effect after independent
review, Owner acceptance and merge. It is inactive while proposed.

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
- DEC-DCP-002: root `agent-deployd` enforces all admission and transaction decisions;
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
Target generation identifies the daemon's installed release record, distinct from
service process generation/PID. Rollback may restore that release record only with
verified restored bytes/metadata and a separately recorded fresh process readback.
Durable unit ID derives from the canonical immutable descriptor. Deployment dedupe
is `(target, intent, profile revision, artifact digest)`; execution attempts are
append-only journal records under that unit, not mutations of its descriptor.
Goal/review/policy changes cannot silently mutate a unit. Late identical-artifact
Goals use a new immutable coverage attachment and existing install receipt.

### CTR-DCP-003 — collapse and coverage

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

The permanent root-owned mutex inode is `/var/db/agent-deployd/production.lock`;
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

For every enrolled target, inventory and retire all canonical writer paths:
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
OPEN_OWNER_DECISIONS = ACCEPT_OR_REVISE_THIS_PROPOSED_AUTHORITY
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
IMPLEMENTATION_ALLOWED_NOW = NO
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
