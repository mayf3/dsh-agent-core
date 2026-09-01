---
spec_id: AGENT_CORE_WORKFLOW_TRANSITION_ROOT_XATTR_OBSERVATION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-09-01
scope:
  - mayf3/dsh-agent-core
  - workflow_transition recovery root xattr observation
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_CORE_WORKFLOW_TRANSITION_DEPLOYMENT_RECOVERY_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_WORKFLOW_TRANSITION_ROOT_XATTR_OBSERVATION_V1

> **PROPOSED / NO IMPLEMENTATION OR PRODUCTION-APPLY AUTHORITY.** This new,
> docs-only Spec defines one independently sealed and audited root observation
> transaction. It does not amend
> `AGENT_CORE_WORKFLOW_TRANSITION_DEPLOYMENT_RECOVERY_V1`, authorize a recovery
> candidate, make the R2 pre-seal candidate reusable, or permit any production
> recovery mutation. This authoring round MUST NOT accept, merge, implement, run
> `osascript`, or execute the observation.

## 1. Goal

Produce qualified, per-object macOS extended-attribute tuples for the exact
root-controlled object graph required by accepted recovery Contract
`AGENT_CORE_WORKFLOW_TRANSITION_DEPLOYMENT_RECOVERY_V1#CTR-REC-008`, without
performing recovery or changing production state.

The observation transaction is successful only when it:

1. uses the same sealed source objects, absolute tool identities, operation
   signatures, OS build, filesystem coordinates, and object classes that a
   later brand-new Recovery R3 candidate proposes to use;
2. mechanically creates and metadata-checks every sealed root-controlled object
   class, including one same-filesystem deployment temporary sibling in the
   exact production target directory;
3. records complete pre-normalization and post-normalization xattr tuples and
   propagation relations only for the closed future-recovery simulation set;
4. never renames the deployment temporary sibling over the production target;
5. proves the production target, environment, services, runtime, catalog,
   Grant census, and workflow census are unchanged;
6. removes every ephemeral simulation and publication-temp object created by
   this observation on success, handled failure, or trapped signal, while
   retaining only the exact closed durable evidence finals; and
7. produces an authentic root-owned observation receipt, an exact non-secret
   user-visible mirror, a detached terminal-publication index, and two
   independent post-observation PASS audits.

The successful root terminal is:

```text
ROOT_XATTR_OBSERVATION_VERIFIED
```

That terminal is evidence, not recovery authority. A later Recovery R3 may
consume it only under `CTR-XOBS-015` after both post-observation audits PASS.

## 2. Scope and non-goals

### 2.1 In scope only after acceptance and the complete observation gate chain

- a fresh user-owned `0700` observation candidate with a new unpredictable
  candidate ID and transaction ID;
- an exact inert `RECOVERY_R3_SUBJECT_MANIFEST` whose independently derived
  subject bytes are installed/observed but never executed by the observation;
- a finite, non-circular two-layer manifest and detached-seal graph;
- two independent exact-same-seal pre-execution reviews and a third independent
  Observation Gate review;
- one native macOS authorization attempt using one fixed audited bootstrap;
- one fresh root-owned `0700` observation stage;
- bounded creation, xattr observation, normalization, and deletion of only the
  observation's own root-controlled objects;
- one exact randomized same-filesystem deployment temp sibling directly under
  the production target directory, created with no-clobber and never renamed
  over the target;
- root-owned durable non-secret records, an exact non-secret user-visible
  mirror, and a detached terminal-publication index whose publication graph is
  finite and non-self-referential;
- two independent post-observation audits proving receipt authenticity, zero
  production mutation, and zero observation residue; and
- a closed compatibility vector that a brand-new Recovery R3 must seal and
  revalidate before it may use the observed tuples.

### 2.2 Closed path classes

Every concrete path is generated before candidate sealing and is carried as an
exact canonical absolute path in both manifest layers and the detached seal.
The only allowed path classes are:

```text
PRODUCTION_TARGET =
  /usr/local/libexec/agent-core/app/packages/broker/src/capabilities/workflow.js

PRODUCTION_TARGET_DIRECTORY =
  /usr/local/libexec/agent-core/app/packages/broker/src/capabilities

USER_OBSERVATION_CANDIDATE_ROOT_CLASS =
  /Users/yanfenma/workspace/deployment-artifacts/
  workflow-root-xattr-observation-<candidate-id>/

GOAL_STATE_ROOT =
  /Users/yanfenma/workspace/deployment-artifacts/
  workflow-transition-goal-state/

AUTHORIZATION_ENVELOPE_CLASS =
  <GOAL_STATE_ROOT>/authorization/<transaction-id>/

AUTHORIZATION_ATTEMPT_RECORD_CLASS =
  <GOAL_STATE_ROOT>/authorization/attempts/<attempt-id>.json

OBSERVATION_GATE_RECORD_CLASS =
  <GOAL_STATE_ROOT>/reports/root-xattr-observation-gate-<transaction-id>.json

TERMINAL_INDEX_READBACK_RECORD_CLASS =
  <GOAL_STATE_ROOT>/reports/
  root-xattr-observation-terminal-index-<transaction-id>.json

USER_RECEIPT_MIRROR_CLASS =
  <GOAL_STATE_ROOT>/receipts/root-xattr-observation-<transaction-id>.json

ROOT_OBSERVATION_STAGE_CLASS =
  /var/root/agent-core-transactions/<transaction-id>/

ROOT_RECEIPT_DIRECTORY_CLASS =
  /usr/local/libexec/agent-core/.deploy-receipts/
  workflow-transition-root-xattr-observation-v1/<transaction-id>/

ROOT_PRE_RECORD_CLASS =
  <ROOT_RECEIPT_DIRECTORY_CLASS>/PRE_RECORD.json

ROOT_OBJECT_RECORD_CLASS =
  <ROOT_RECEIPT_DIRECTORY_CLASS>/OBJECT_RECORDS.jsonl

ROOT_TRANSACTION_LOCK_CLASS =
  <ROOT_RECEIPT_DIRECTORY_CLASS>/transaction.lock

ROOT_RECEIPT_CLASS =
  <ROOT_RECEIPT_DIRECTORY_CLASS>/ROOT_OBSERVATION_RECEIPT.json

ROOT_TERMINAL_PUBLICATION_INDEX_CLASS =
  <ROOT_RECEIPT_DIRECTORY_CLASS>/TERMINAL_PUBLICATION_INDEX.json

DEPLOYMENT_TEMP_SIBLING_CLASS =
  <PRODUCTION_TARGET_DIRECTORY>/
  .workflow.js.root-xattr-observation.<transaction-id>.<random>.tmp

ATOMIC_PUBLICATION_TEMP_CLASSES =
  one exact sealed same-directory temp sibling per PRE_RECORD, root-receipt,
  user-mirror, terminal-publication-index, attempt-record, Gate-record,
  terminal-index-readback-record, and consumption-record
```

Line wrapping above is documentary only; every sealed path is one canonical
absolute path with no whitespace, expansion, glob, unresolved variable, or
symlink component. No privileged input, executable, staging root, receipt, or
temporary object may be read from, copied from, interpreted from, or created
under `/tmp`, `/private/tmp`, or another unsealed path.

### 2.3 Closed production mutation boundary

The only temporarily permitted directory entry under a production directory is
the exact randomized `DEPLOYMENT_TEMP_SIBLING_CLASS` member. It MUST be created
with exclusive no-clobber semantics, remain a regular non-symlink with link
count one, MUST NOT replace or rename over any existing path, and MUST be
removed before a successful or handled-failure receipt is terminal.

The transaction MUST NOT write or change:

- `PRODUCTION_TARGET` bytes or metadata;
- any dotenv/configuration file;
- any launchd job, service process, PID, generation, or listener;
- any product source or installed runtime file;
- any Grant, principal, role, credential, allowlist, workflow, command, receipt,
  event, transition attempt, or business state;
- any R5, v5, v6, R2, or other earlier candidate, stage, seal, receipt, or
  evidence file; or
- any production directory entry other than the one sealed temp sibling.

### 2.4 Non-goals

- no forward reconciliation or rollback;
- no deployment, atomic target replacement, service restart, or canary;
- no real or test workflow transition;
- no Grant or write-gate rollout;
- no cleanup, reuse, relocation, normalization, or mutation of the old R5 root
  stage;
- no modification, sealing, resealing, review, or execution of the R2 pre-seal
  candidate;
- no inference that an attribute is safe from its name alone;
- no acceptance of all `com.apple.*` attributes;
- no modification of a user candidate or its inputs to make a seal or xattr
  check pass; and
- no direct authorization for a later Recovery R3 production action.

## 3. Authority and dependencies

This Spec is a `NEW` independent implementation authority candidate. It refines
the accepted recovery authority by defining a prerequisite evidence-producing
transaction. It neither changes nor partially supersedes any accepted
Decision, Contract, Acceptance item, or stable ID.

```text
REPOSITORY = mayf3/dsh-agent-core
AUTHORITY_BRANCH = main
AUTHORING_BASE_COMMIT = fb046c51dab5dfeaf3c32b480fb4efb8a2860e3d
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_WORKFLOW_TRANSITION_DEPLOYMENT_RECOVERY_V1
PARENT_AUTHORITY_COMMIT = fb046c51dab5dfeaf3c32b480fb4efb8a2860e3d
PARENT_SPEC_BLOB = 558c3f27f41eb099583f1b6f57dc9ff1b6de238d
PARENT_SPEC_SHA256 = 5a38f0163653c3115ce603ca0be8d28eba13c8e159500a703f55a41deae9161a
PARENT_CONTRACT = CTR-REC-008
EXTERNAL_AUTHORITIES = NONE
AUTHORITY_CONFLICT = NONE
```

The parent remains `accepted / contracts / contracts` at the fixed authority
branch commit. Historical proposed/authoring prose retained inside its
lifecycle-accepted body does not make its accepted frontmatter inactive and is
not edited by this Spec. The new observation obligation is independent because
the parent forbids name-only inference but does not itself authorize a separate
privileged transaction whose sole purpose is to produce the missing tuple.

The Owner instruction source is:

```text
/Users/yanfenma/.codex/attachments/
3a8243dc-c482-4197-8dae-268cfbcc50d0/pasted-text-1.txt
OWNER_INSTRUCTION_SHA256 =
a023ad37eb5da0d356c3498ab3f1741c1d324b5088bfd58ebd44ce002ff8d647
```

It authorizes autonomous non-privileged coordination and native macOS
authorization-dialog interaction only after all independent gates. It is not a
repository implementation authority and does not override this Spec lifecycle.

## 4. Current State

### STATE-XOBS-001 — Recovery R2 stopped before seal on missing root tuples

- Subject: recovery R2 candidate
  `workflow-recovery-r2-7d65b901-9031-4566-9032-001c84e981a5`
- As of artifact: `AUTHORITY_CONFLICT_STOP.json`, captured
  `2026-09-01T03:21:31Z`
- Environment: user-side pre-seal build, no authorization
- Projection: no qualified per-object root tuple was available; the candidate
  stopped `STOPPED_PRESEAL_AUTHORITY_CONFLICT` with no seal and zero production
  mutation.
- Basis: `OBS-XOBS-001`, `OBS-XOBS-002`, `EVD-XOBS-001`

### STATE-XOBS-002 — R2 is evidence-only and cannot be advanced

- Subject: the complete R2 pre-seal tree and transaction identity
- As of artifact: R2 stop record SHA-256
  `5338d98915868fd0eeffda89d3aa2d49a999baddec51480f376c3338ab8d2637`
- Environment: deployment artifact workspace
- Projection: R2 is not sealable, auditable, executable, repairable, or reusable
  as observation or recovery supply. Its bounded read-only records remain
  incident evidence only.
- Basis: `OBS-XOBS-001`, `CLM-XOBS-001`, `EVD-XOBS-001`

### STATE-XOBS-003 — User-side and dotenv tuples cannot authorize root objects

- Subject: candidate-root and dotenv provenance observations
- As of artifact: R2 `XATTR_OBSERVATION_BUILD.json` and parent §3.1
- Environment: user-owned build root and svc-workflow dotenv
- Projection: the user-side tuple is
  `010200B853F6DC8C0BE32B` / 11 bytes / canonical-ASCII SHA-256
  `201a3fa6f11f41bc0ff612b97e3cad6275f26bf959025c4a6836d0cdb5a64622`;
  the dotenv tuple is `01020061595AF3DBA174A4` / 11 bytes /
  `e6be2a51db86e14d2c2d62856a05db6294590e572c98109f004ac17a6cee2819`.
  Neither tuple is a qualified root-stage observation.
- Basis: `OBS-XOBS-002`, `OBS-XOBS-003`, `CLM-XOBS-002`

### STATE-XOBS-004 — Production observations are time-indexed, not permission

- Subject: production workflow-transition boundary
- As of artifact: R2 fresh read-only baseline captured
  `2026-09-01T02:55:16.456458Z`
- Environment: local production host
- Projection: target blob was `577c8778...`, effective write gate was true,
  Broker health/catalog were readable, while Grant census and root-stage
  visibility were permission denied before authorization. These facts must be
  freshly re-established; they authorize no production change.
- Basis: `OBS-XOBS-004`, `EVD-XOBS-002`

## 5. Observations

### OBS-XOBS-001 — R2 authority-conflict stop

- Subject: R2 pre-seal decision
- Repository/source: deployment artifact workspace
- Commit/artifact: `AUTHORITY_CONFLICT_STOP.json`, SHA-256
  `5338d98915868fd0eeffda89d3aa2d49a999baddec51480f376c3338ab8d2637`
- Environment: non-privileged build
- Observed at: `2026-09-01T03:21:31Z`
- Method: inspect the durable terminal stop record
- Result: `qualifiedPerObjectRootTupleAvailable=false`,
  `rootStageRead=PERMISSION_DENIED_PREAUTH`, `sealExecuted=false`,
  `productionMutationCount=0`
- Provenance: `/Users/yanfenma/workspace/deployment-artifacts/
  workflow-recovery-r2-7d65b901-9031-4566-9032-001c84e981a5/
  AUTHORITY_CONFLICT_STOP.json`

### OBS-XOBS-002 — Candidate/user install provenance tuple

- Subject: R2 user candidate root, candidate member, user install probe
- Repository/source: R2 `XATTR_OBSERVATION_BUILD.json`
- Commit/artifact: candidate ID in `OBS-XOBS-001`
- Environment: uid 502 user-owned workspace objects
- Observed at: R2 build
- Method: canonical `xattr -px` representation recorded by R2
- Result: sole name `com.apple.provenance`; uppercase contiguous hex
  `010200B853F6DC8C0BE32B`; 11 bytes; canonical-hex ASCII SHA-256
  `201a3fa6f11f41bc0ff612b97e3cad6275f26bf959025c4a6836d0cdb5a64622`
- Limitation: not a root-owned object and not recovery authority
- Provenance: R2 pre-seal evidence tree

### OBS-XOBS-003 — Dotenv provenance tuple differs

- Subject: svc-workflow dotenv
- Repository/source: accepted parent §3.1 / `OBS-REC-003`
- Commit/artifact: parent coordinates in §3
- Environment: production host user-owned dotenv
- Observed at: parent incident measurement
- Method: `/usr/bin/xattr -px`, ASCII-whitespace removal, uppercase canonical
  hex, byte count, digest over canonical hex ASCII
- Result: `01020061595AF3DBA174A4`; 11 bytes; canonical-ASCII SHA-256
  `e6be2a51db86e14d2c2d62856a05db6294590e572c98109f004ac17a6cee2819`
- Limitation: applies only to the dotenv object
- Provenance: accepted parent and Owner incident record

### OBS-XOBS-004 — R2 read-only production baseline

- Subject: target, dotenv, services, catalog, Grant/workflow censuses, residue
- Repository/source: R2 `evidence/FRESH_READ_ONLY_BASELINE.json`
- Commit/artifact: accepted parent commit in §3
- Environment: local production host
- Observed at: `2026-09-01T02:55:16.456458Z`
- Method: bounded read-only probes with zero sudo/osascript/mutation
- Result: production target and runtime evidence were collected; Grant census
  and root-stage visibility were `UNKNOWN_PREAUTH_PERMISSION_DENIED`
- Limitation: stale for execution and insufficient for tuple authority
- Provenance: R2 evidence tree

### OBS-XOBS-005 — Parent requires mechanical per-object observation

- Subject: accepted `CTR-REC-008`
- Repository/source: `mayf3/dsh-agent-core`
- Commit/artifact: parent commit/blob/SHA-256 in §3
- Environment: repository authority branch
- Observed at: authoring readback 2026-09-01
- Method: inspect accepted Contract and Acceptance mapping
- Result: every actual root-controlled object needs a separately enumerated,
  mechanically observed, exact tuple; absent or ambiguous relation stops before
  production mutation
- Provenance: repository Git object

## 6. Claims and assumptions

### CLM-XOBS-001 — R2 cannot be made compliant by sealing or audit

- Support state: SUPPORTED
- Supported by evidence: `EVD-XOBS-001`
- Contradicted by evidence: none
- Uncertainty: none material; the durable stop record states no seal exists

### CLM-XOBS-002 — User-side or dotenv equality cannot prove a root tuple

- Support state: SUPPORTED
- Supported by evidence: `EVD-XOBS-001`, `EVD-XOBS-003`
- Contradicted by evidence: none
- Uncertainty: the missing root tuple is exactly what the observation must
  measure; it is not inferred here

### CLM-XOBS-003 — A separate bounded root transaction is required

- Support state: SUPPORTED
- Supported by evidence: `EVD-XOBS-001`, `EVD-XOBS-003`
- Contradicted by evidence: none
- Uncertainty: execution-time tuple values remain outputs, but their acquisition
  and failure semantics are fully contracted

### CLM-XOBS-004 — A successful observation can be consumed without becoming recovery authority

- Support state: INFERRED
- Supported by evidence: `EVD-XOBS-003`
- Contradicted by evidence: none
- Uncertainty: later Recovery R3 must independently satisfy the accepted parent,
  exact receipt compatibility, same-seal audits, and recovery gate

## 7. Evidence relations

### EVD-XOBS-001 — R2 stop supports a new observation prerequisite

- Source observations: `OBS-XOBS-001`, `OBS-XOBS-002`
- Target: `STATE-XOBS-001`, `STATE-XOBS-002`, `CLM-XOBS-001`,
  `CLM-XOBS-003`
- Relation: SUPPORTS
- Bound coordinates: R2 candidate/transaction and artifact digest in §4
- Strength/sufficiency: strong for stopping R2 and requiring new authority
- Limitations: supplies no root tuple and authorizes no privileged execution
- Provenance: R2 durable pre-seal evidence

### EVD-XOBS-002 — R2 baseline supports the zero-mutation comparison surface

- Source observations: `OBS-XOBS-004`
- Target: `STATE-XOBS-004`
- Relation: SUPPORTS
- Bound coordinates: R2 capture time and production paths in §2
- Strength/sufficiency: strong for identifying the surfaces that need fresh
  before/after proof
- Limitations: values are time-sensitive and must not be reused as execution
  preconditions
- Provenance: R2 fresh read-only baseline

### EVD-XOBS-003 — Accepted parent supports exact object-bound evidence

- Source observations: `OBS-XOBS-003`, `OBS-XOBS-005`
- Target: `STATE-XOBS-003`, `CLM-XOBS-002`, `CLM-XOBS-003`,
  `CLM-XOBS-004`
- Relation: SUPPORTS
- Bound coordinates: accepted parent commit/blob/SHA-256 in §3
- Strength/sufficiency: normative for rejecting name-only or borrowed tuples
- Limitations: parent acceptance does not activate this proposed child
- Provenance: repository Git object

## 8. Decisions

### DEC-XOBS-001 — Create a separate observation authority

- Decision owner: mayf3
- Decision: use one new, independently accepted, sealed, audited, root-only
  observation transaction before any new recovery seal
- Rejected alternatives: amend accepted parent in place; infer the tuple; seal
  R2; observe during production recovery
- Reason: observation and recovery have different mutation authority and failure
  boundaries
- Owner decision remaining: NONE

### DEC-XOBS-002 — Preserve exact source-to-object operation identity

- Decision owner: mayf3
- Decision: each object row binds its source object/digest/xattrs, exact tool and
  OS identity, parent directory metadata, creation primitive, ordered operation
  signature, and result tuple
- Rejected alternatives: record only an attribute name/value; treat tool or OS
  drift as harmless; record only final stage state
- Reason: provenance can arise at a particular copy/extract/create boundary
- Owner decision remaining: NONE

### DEC-XOBS-003 — Production target is never a transaction destination

- Decision owner: mayf3
- Decision: create one same-filesystem sibling, normalize and observe it, then
  unlink it; never rename or link it over the target
- Rejected alternatives: complete and roll back a test replacement; use a temp
  outside the target directory; infer filesystem behavior without the sibling
- Reason: the required filesystem boundary can be observed without target
  mutation
- Owner decision remaining: NONE

### DEC-XOBS-004 — Observation records tuples but does not pre-authorize them

- Decision owner: mayf3
- Decision: a well-formed provenance tuple may be captured and normalization
  attempted only on observation-owned objects; it becomes recovery-consumable
  only after exact terminal receipt and dual post-audit PASS
- Rejected alternatives: accept provenance by name, accept all `com.apple.*`,
  silently ignore additional attributes, or normalize the user candidate
- Reason: discovery must not be confused with an allow rule
- Owner decision remaining: NONE

### DEC-XOBS-005 — Single native authorization attempt with durable intent

- Decision owner: mayf3
- Decision: after same-seal audits and Gate, use exactly one macOS
  authorization-only attempt with a durable prelaunch record and no automatic
  repeat after crash, cancellation, denial, or unknown outcome
- Rejected alternatives: password channel, `sudo -S`, `expect`, Keychain
  extraction, sudoers change, command copy/paste, or repeated dialogs
- Reason: the Owner authenticates only to the OS UI and an ambiguous privileged
  outcome must fail closed
- Owner decision remaining: NONE

### DEC-XOBS-006 — Observation residue is transaction-owned only

- Decision owner: mayf3
- Decision: clean only objects created under this observation's exact sealed
  transaction ID; never clean or reuse the old R5 stage
- Rejected alternatives: use the observation as a general root-stage cleanup or
  reuse a pre-existing stage to reduce authorization prompts
- Reason: unrelated or ambiguously attributed root data is outside scope
- Owner decision remaining: NONE

### DEC-XOBS-007 — Receipt use is a separate compatibility decision

- Decision owner: mayf3
- Decision: Recovery R3 seals the exact canonical observation-row digest,
  receipt/index identities and digests, and post-audit records, then must match
  the complete source/OS/tool/parent/operation/simulation-object tuple vector
  before and during execution; publication-object xattrs are never tuple input
- Rejected alternatives: consume only the provenance value, accept compatible-
  looking drift, or treat the observation success as recovery Gate acceptance
- Reason: a tuple is qualified only at its bound execution coordinates
- Owner decision remaining: NONE

## 9. Threat model and safety invariants

The design MUST reject at least these threats:

| Threat | Required disposition |
|---|---|
| User-candidate byte/xattr mutation before root copy | candidate rejected; no authorization |
| Symlink, hard link, path traversal, archive escape, or inode alias | stop before object creation or production-directory write |
| Seal self-reference, fixed-point hash, or post-Gate patch | candidate rejected; new candidate/transaction required |
| Candidate/environment/argument supplies its own seal hash | bootstrap rejects before root payload |
| Unknown xattr, quarantine, resource fork, or additional attribute | record exact safe diagnostic; receipt unusable; fail closed |
| `xattr` list/read/delete/readback command failure or ambiguous output | `OBSERVATION_FAILED` or `MANUAL_RECOVERY_REQUIRED` |
| Raw/default/truncated/lowercase/odd/non-hex provenance representation | canonicalization failure; receipt unusable |
| Deployment temp rename/link over target | forbidden path; post-audit fails manual recovery |
| Target/env/service/catalog/Grant/workflow drift | no verified terminal; manual recovery |
| R5 stage deletion or R2 supply reuse | hard failure and role/audit violation |
| Crash between prelaunch record and process creation | no second dialog/process; reconcile or unknown/manual |
| Root receipt/mirror mismatch or partial write | no consumption; manual recovery |
| Receipt/mirror/index self-hash, publication-object observation row, or future-object dependency | reject cyclic graph; no verified terminal |
| Receipt replay on different source, OS, tool, filesystem, parent, or operation | R3 stops prewrite and requires new observation |

No implementation may weaken these dispositions to warnings.

## 10. Contracts

### CTR-XOBS-001 — Lifecycle, parent precedence, and authoring boundary

This Spec MUST remain `proposed / none / none` in this authoring round and this
round MUST change only this new Spec file. The accepted parent MUST remain
byte-for-byte unchanged. No observation candidate may be built until an
independent semantic Reviewer accepts this exact proposed head, an authorized
Owner lifecycle transaction changes only lifecycle fields plus an acceptance
record, a second independent final-head Reviewer proves semantic delta after
review is none, and the exact accepted head is merged and read back from
`github/main`.

Acceptance of this Spec authorizes only the bounded implementation described
here. It does not authorize the authorization dialog or root execution; those
still require `CTR-XOBS-004`. It never authorizes recovery, deployment, target
replacement, restart, Grant mutation, workflow mutation, canary, or R5 cleanup.

### CTR-XOBS-002 — R2 and prior artifacts are evidence-only

The implementation and every record MUST state:

```text
R2_STATE = STOPPED_PRESEAL_AUTHORITY_CONFLICT
R2_SEAL_EXECUTED = NO
R2_REUSE_ALLOWED = NO
R2_RESEAL_ALLOWED = NO
R2_CANDIDATE_AUDIT_ALLOWED = NO
R2_EXECUTION_ALLOWED = NO
R5_RETRY_ALLOWED = NO
R5_MODIFY_OR_RESEAL_ALLOWED = NO
R5_ROOT_STAGE_CLEANUP_ALLOWED_BY_OBSERVATION = NO
```

R2/R5/v5/v6 candidate bytes, scripts, manifests, wrappers, stages, seals, or
receipts MUST NOT supply observation or recovery executable content. The exact
R2 preflight/stop/evidence digests may be cited only as non-executable evidence.
The observation uses a new candidate root, IDs, manifests, source subject set,
wrapper, transaction, authorization envelope, seal, stage, receipt, mirror, and
terminal-publication index.

### CTR-XOBS-003 — Fresh candidate and acyclic detached seal

The Observation Build Agent MUST create a new uid-502-owned `0700`, non-symlink
candidate root. Every member is a regular non-symlink, link-count-one file owned
by uid 502, and every path component is canonical and non-symlink. The Build
Agent MUST freeze the candidate ID, unpredictable transaction ID, root stage,
receipt, mirror, terminal-publication-index, authorization paths, exact
terminal-index-readback-record path, source-subject manifest, exact operation
plan, and one randomized temp-sibling path before serialization.

The source-subject manifest MUST separate:

```text
observation_control = bootstrap/transaction/control members needed only to
  perform observation; enumerated and separately checked as execution or
  publication plumbing, but excluded from compatibility-bearing
  OBSERVATION_ROWS and never offered to R3 as reusable executable supply
recovery_subject = inert target/preimage/artifact/helper/policy source members
  independently derived under the accepted recovery parent, with exact bytes
  intended for a brand-new R3; installed and extracted for observation but
  never executed as recovery behavior
```

Every recovery subject that R3 may later install, extract, copy, or normalize
MUST exist in the sealed observation subject set. If a future R3 introduces a
new or different subject, helper, policy, or source digest, that is source drift
under `CTR-XOBS-015` and requires a new observation. Preparing inert source
subjects does not seal or authorize an R3 candidate and does not permit any
recovery action.

Before seal, both candidate audits MUST bind the complete candidate-root and
source-member xattr name/value tuples without changing them. The only eligible
source states are the exact sealed empty set or exact sealed sole
`com.apple.provenance` tuple. Quarantine, resource forks, additional/unknown
attributes, unreadable values, or ambiguous inventory reject the candidate
before authorization; no user-side normalization is permitted.

The seal graph MUST be finite and acyclic in this order:

```text
Layer-1 observation payload/source/helper/policy/plan members
  -> OBSERVATION_INPUT_MANIFEST -> D1
  -> five D1-bound authorization members
  -> OBSERVATION_CONTENT_MANIFEST -> D2
  -> OBSERVATION_CANDIDATE_SEAL.json
  -> observationCandidateSealSha256 (external only)
```

The five authorization members are exactly:

```text
AUTH_REQUEST.json
AUTH_LAUNCH.applescript
AUTH_LAUNCH.sha256
ROOT_BOOTSTRAP.sh
ROOT_BOOTSTRAP.sha256
```

Layer 1 excludes both manifests, all five authorization members, and the seal.
Layer 2 contains the input manifest, every Layer-1 member, and all five final
authorization members, but excludes itself and the seal. The seal contains
fixed coordinates plus exactly `D1` and `D2`; it never contains its own hash.
`observationCandidateSealSha256` exists only in external review/Gate/attempt/
receipt records. The complete canonical serialization, row identity, path,
ownership, mode, length, SHA-256, ordering, duplicate-path/inode rejection, and
allowed digest edges MUST be as strict as parent `CTR-REC-007` with observation-
specific schema names. No candidate or authorization member may depend on an
upper-layer digest or its own digest. No byte may change after seal.

### CTR-XOBS-004 — Same-seal reviews, Gate, and authorization lifecycle

After build, two new independent Reviewers MUST separately recompute and bind
the exact same `(D1,D2,observationCandidateSealSha256)` and every candidate and
authorization byte:

```text
Root Xattr Observation Supply Reviewer
Root Xattr Observation Boundary Reviewer
```

Any `REVISE` permanently rejects that candidate. A third independent Root Xattr
Observation Gate Reviewer may emit:

```text
OBSERVATION_GATE = ACCEPT
READY_FOR_ROOT_OBSERVATION = YES
```

only after both exact-same-seal PASS records. The external Gate record MUST bind
all three hashes, exact authorization paths/digests, fixed transaction/stage/
receipt/mirror/terminal-publication-index/index-readback-record/temp/target
coordinates, source/tool/OS/parent/operation signatures, Reviewer identities,
and verdicts. It is not a candidate member and cannot change candidate bytes.

Only that exact Gate permits one macOS authorization attempt. Immediately before
attempt publication, the coordinator MUST verify console user `yanfenma`, uid
502, execution user/session, GUI availability, `/usr/bin/osascript`, exact Gate
bytes/digest, the full D1/D2/seal graph, all member metadata, and immutable
candidate state. It MUST durably publish a unique no-clobber prelaunch attempt
record with file fsync, atomic rename, readback, and directory fsync containing:

```text
AUTH_DIALOG_REQUESTED = YES
authorizationState = REQUESTED_NOT_YET_TERMINAL
authorizationInvocationCount = 1
```

Only then may it synchronously create one `/usr/bin/osascript` process invoking
the exact sealed AppleScript and fixed audited bootstrap. Password material is
forbidden in chat, stdin, environment, files, arguments, AppleScript, logs,
Keychain automation, or agent-visible output. `sudo`, `sudo -S`, `expect`,
sudoers changes, dynamic shell command input, command-copy instructions, and
retry/prompt loops are forbidden.

Cancellation/denial with proof that root execution did not begin becomes
`AUTHORIZATION_NOT_GRANTED`. Missing or conflicting proof becomes
`AUTHORIZATION_OUTCOME_UNKNOWN` and `MANUAL_RECOVERY_REQUIRED`. A coordinator
restart with a non-terminal attempt MUST NOT create another process or dialog;
it may wait for the same mechanically identified live process or reconcile the
fixed root receipt/mirror/terminal-publication-index/stage. Irreducible
uncertainty is terminal manual recovery, never a retry.

### CTR-XOBS-005 — Fixed root bootstrap, closed environment, and path safety

The AppleScript may execute only one literal fixed audited bootstrap with
administrator privileges. The bootstrap MUST:

1. set `umask 077` and a minimal sealed environment;
2. reject `/tmp`, `/private/tmp`, network input, shell-evaluated dynamic data,
   unresolved variables/globs, and nested privilege escalation;
3. validate the exact external Gate and reconstruct seal -> D2 -> every
   authorization member -> D1 -> every Layer-1 member before any root payload;
4. validate canonical paths, ancestry, types, owners, modes, link counts,
   lengths, hashes, source identities, and no duplicate path/inode;
5. create the exact fresh root stage as root:wheel `0700` with exclusive
   no-clobber semantics and never reuse an existing stage;
6. use the sealed absolute `/usr/bin/install` binary and exact audited argv for
   root-stage directory creation and every source-to-stage install, copy only
   the sealed allowlist, then re-hash and re-stat root copies;
7. execute only the root-owned audited transaction copy;
8. write only the sealed stage, receipt, mirror, terminal-publication-index,
   PRE_RECORD, object-record journal, lock, and exact production temp-sibling
   paths; and
9. refuse to enumerate, delete, normalize, execute, or reuse an old R5 or other
   pre-existing root stage beyond the bounded parent-name/identity census needed
   to prove this transaction created no residue.

The bootstrap MUST obtain `observationCandidateSealSha256` only from the exact
external Gate record. Candidate, environment, stdin, or command arguments MUST
NOT supply it.

The fixed AppleScript command MUST NOT directly execute a user-writable
`ROOT_BOOTSTRAP.sh`. Its literal, audited system-tool sequence first validates
and installs the sealed bootstrap into the new root-owned stage, verifies the
root copy again, and only then executes that root-owned copy. A read-only parent
census may record an old R5 stage's exact entry name and visible identity as
pre-existing/excluded evidence, but it MUST NOT traverse its contents, change
metadata/xattrs, remove it, or treat it as an observation object.

### CTR-XOBS-006 — Fresh zero-mutation before snapshot

After root start and before the first observation-owned object is created, the
transaction MUST durably write and read back a root-owned `PRE_RECORD`. It MUST
capture one fresh, canonical, non-secret before snapshot covering at least:

- target regular/non-symlink/type/link/realpath, complete bytes SHA-256 and Git
  blob, uid/gid/mode, ACL, and complete xattr tuples;
- target-directory device/inode/volume identity, realpath, uid/gid/mode, ACL,
  xattrs, and complete directory-entry inventory;
- exact environment whole-file digests and security metadata without content,
  including the effective write-gate state;
- both launchd controller identities, PIDs, runs/generation/start time, binary/
  plist/argv/working-directory identities, listeners, and process ancestry;
- exact Agent Core health status and response-body bytes/digest;
- canonical sorted capability catalog and manifest count/digest;
- canonical sorted non-secret Grant row projection/count/principal count/digest;
  and
- canonical sorted workflow instance/state, command, receipt, event, attempt,
  and transition census projections/counts/digests.

Permission denial, unstable read, timeout, parse ambiguity, secret-safe
projection uncertainty, concurrent change, or incomplete baseline yields
`MANUAL_RECOVERY_REQUIRED` before the production temp sibling is created. A
count without the canonical projection/digest never establishes equality.

### CTR-XOBS-007 — Complete object graph and exact operation signatures

The sealed observation plan MUST enumerate every root-controlled object before
execution and classify it into exactly one of two disjoint sets. Only the
closed `FUTURE_RECOVERY_SIMULATION_OBJECT_SET` supplies compatibility-bearing
xattr rows:

```text
root_staging_directory
installed_staged_artifact (each actual artifact)
extracted_workflow_js
installed_helper (one row per helper)
installed_policy (one row per policy)
deployment_temp_sibling
explicit_future_recovery_other (one row per exact sealed object, permitted only
  when a future R3 operation will create the same object class by the same
  source-to-object operation)
```

The second set is `PUBLICATION_AND_CONTROL_PLUMBING_SET`. It MUST enumerate the
bootstrap/worker/supervisor-only controls, `PRE_RECORD`, object-record journal,
transaction lock, root-receipt temp/final, user-mirror temp/final,
terminal-publication-index temp/final, and every other exact sealed
publication/control temp or final object. These objects receive separate path,
type, owner/group/mode, link/inode, length/digest where applicable, complete
xattr inventory, fsync/readback, and final-residue checks. They MUST NOT append
or otherwise contribute an `OBSERVATION_ROWS` row, must not change `Dobs`, and
their xattrs MUST NOT be offered to Recovery R3 as tuple evidence. In
particular, root-receipt, mirror, and terminal-index temp/final objects are
publication plumbing, never simulation objects. No publication/control xattr
may be normalized to make evidence eligible; unreadable, ambiguous,
quarantine/resource-fork/additional, or policy-mismatched publication metadata
fails closed without creating a row.

The two sets MUST be sealed as sorted lists of exact object IDs and paths with
no overlap, implicit catch-all, or runtime reclassification. No unenumerated
root-controlled file, directory, archive member, hard link, symlink, FIFO,
socket, device, named fork, or temp object may be created. An
`explicit_future_recovery_other` entry MUST name its future R3 operation and
source/destination edge; a generic `other`, `every object`, or publication
object is invalid. The plan MUST use the same primitive for each simulation
source-to-object edge that later Recovery R3 will use. For every such
operation, it freezes:

```text
stepId and total sequence
objectClass and exact destination path
source object ID, exact source path/class, byte length, SHA-256, Git blob when applicable,
  uid/gid/mode/type/link/realpath, ACL, and complete source xattr tuples
primitive kind and absolute executable path
executable bytes SHA-256, code-signing identity when available, and version
ordered argv bytes or syscall name/flags
closed environment bytes, umask, cwd, stdin policy, stdout/stderr policy
requested uid/gid/mode and archive/extraction member rules
source/destination device, filesystem type, volume UUID, and parent directory identity
expected predecessor and successor object IDs
```

Shell aliases, PATH lookup, implicit tool defaults, locale-dependent parsing,
unsealed archive entries, and alternate fallback primitives are forbidden. Any
execution mismatch from the sealed signature fails before the next object is
created and makes the receipt unusable for recovery.

The bootstrap/transaction control members are `observation_control` plumbing;
their bytes and xattrs are never compatibility-bearing rows and R3 MUST NOT
reuse them. The root-stage directory and installed/extracted
`recovery_subject` objects listed above are the compatibility-bearing rows.
Root-stage directory creation and installed source/artifact/helper/policy copies
use the exact sealed `/usr/bin/install` operations. Extraction and the
same-directory deployment-temp creation/population use the exact separately
sealed primitives that R3 proposes to use. Any different primitive requires a
new observation rather than a fallback.

### CTR-XOBS-008 — Per-object metadata and canonical xattr observation

Immediately after each simulation-object creation and before any normalization,
the root transaction MUST append, file-fsync, and read back one canonical
`OBJECT_PRE_OBSERVATION` event in `OBJECT_RECORDS.jsonl`. Later normalization,
propagation, deletion, and cleanup facts are append-only canonical events for
the same object ID; no event is rewritten. The journal is publication plumbing
under `CTR-XOBS-007`: its file, inode, xattrs, and publication operations never
produce an observation row and never enter `Dobs`.

After every member of `FUTURE_RECOVERY_SIMULATION_OBJECT_SET` has been observed,
all required normalization and propagation edges are determined, every
simulation object including the root stage and deployment temp is removed, and
the exact sealed residue census proves zero simulation-object residue, the root
supervisor MUST deterministically reduce the durable events to exactly one
ordered `OBSERVATION_ROWS` row per sealed simulation object. Each row contains:

```text
objectId, objectClass, exactPath, pathClass, creationStepId
creation/copy/extract primitive signature digest
source object ID/path/class/digest/Git blob/metadata/ACL/xattr tuple
actual uid, gid, mode, file type, link count, device, inode, realpath
complete sorted xattr name set
for every xattr: exact name and value byte length; canonical uppercase
  contiguous hex plus SHA-256 of those canonical ASCII hex bytes when the value
  is mechanically classified non-secret, otherwise an explicit redaction class
  plus value length and sealed digest only
com.apple.provenance exact tuple, or explicit ABSENT
resource-fork results from both xattr inventory and the sealed named-fork probe
nextObjectId and observedPropagationToNext
actuallyPropagatedToProductionTarget
normalization action/result and complete post-normalization set
```

Row order is the sealed simulation-plan sequence, with `objectId` as a unique
secondary assertion; duplicate, missing, extra, reordered, or post-cleanup
events fail closed. `OBSERVATION_ROWS` canonical serialization is a single
UTF-8 JSON array with no BOM or insignificant whitespace, lexicographically
sorted object-member keys, lowercase JSON literals, base-10 integers without
leading zeros, and shortest JSON escapes (UTF-8 characters remain unescaped
except control characters, quote, and backslash). No floating-point value is
allowed. The implementation MUST seal positive and adversarial serializer test
vectors. The root supervisor freezes:

```text
Dobs = SHA-256(exact canonical OBSERVATION_ROWS bytes)
```

only after the zero-residue proof. Neither the canonical rows nor `Dobs` may be
changed afterward, and no publication/control object may append a row before or
after the freeze.

Xattr listing, value reads, deletion, and readback use exact sealed absolute
macOS tools and locale. Each value read MUST use `/usr/bin/xattr -px <name>
<path>`, remove ASCII whitespace only, require the remaining output itself to
be uppercase even-length hexadecimal, derive byte length as hex characters / 2,
and hash the uppercase contiguous ASCII hex bytes. Raw/default `xattr -p`,
lowercase stored canonical text, whitespace-bearing stored canonical text,
odd-length/non-hex text, truncated output, or a digest of decoded bytes is not
canonical. Any list/read/parse/command error or path/inode change fails closed.

The observation never treats a provenance name as an allow rule. It may proceed
far enough on its own exact object to record one well-formed sole
`com.apple.provenance` tuple and test its exact deletion/readback. The complete
tuple, not the name, is the output. Missing expected observations, malformed or
changed provenance, `com.apple.quarantine`, `com.apple.ResourceFork`, a resource
fork exposed through the named-fork probe, any unknown/additional xattr, or any
command ambiguity MUST be recorded and make
`receiptUsableForRecovery=false`; no later object except cleanup may be created.

### CTR-XOBS-009 — Root-only normalization and propagation proof

Normalization may occur only after the `OBJECT_PRE_OBSERVATION` event is
durable and only on exact observation-owned root-stage objects or the exact
observation deployment temp sibling. It may remove only the exact just-observed
`com.apple.provenance` name/value/inode tuple. It MUST verify by complete list
and readback that the post-normalization set equals the sealed expected set.
Deletion/readback failure, inode/path drift, or any other attribute is fail
closed. The transaction MUST NOT modify a user candidate, source object,
authorization member, manifest, seal, Gate record, production target, dotenv,
or pre-existing object.

For each adjacent source-to-object edge, propagation is `YES`, `NO`, or
`INDETERMINATE`, based on exact name/value/length/canonical-hex/digest equality;
`INDETERMINATE` makes the receipt unusable. For the deployment temp sibling the
record MUST distinguish:

```text
actualRenameOverTargetExecuted = false
actuallyPropagatedToProductionTarget = false
tempPostNormalizationXattrSet = <exact set>
hypotheticalRecoveryRenamePostimageSet = <derived exact set or INDETERMINATE>
```

The hypothetical field is explicitly an inference from the temp's exact
post-normalization set and operation signature, not an Observation of a rename.
Only an exact set equal to the accepted parent's final-target preimage policy is
eligible for later R3 use. No staging provenance may remain on the temp.

### CTR-XOBS-010 — Same-filesystem deployment temp without replacement

Only after all earlier simulation-object observation events remain valid may the
transaction create the exact randomized temp sibling sealed under §2. It MUST
use the exact future R3 creation/copy primitive and prove, before and after
population:

- target and parent realpaths/inodes remain the sealed objects;
- temp and target share device/filesystem/volume identity;
- the name did not exist and was created with exclusive no-clobber semantics;
- temp is regular, non-symlink, link-count one, root:wheel with the sealed mode;
- bytes equal the exact sealed target or preimage subject selected by the
  operation plan;
- ACL and complete xattrs are observed before normalization and satisfy the
  post-normalization policy afterward; and
- no rename, exchange, clone-over-target, link-over-target, chmod/chown/xattr on
  target, or service action occurs.

After the final temp observation/normalization events are durable, the temp MUST
be unlinked, the deletion event made durable, and directory contents read back.
Failure to prove unlink or target identity is
`MANUAL_RECOVERY_REQUIRED`, never observation success.

### CTR-XOBS-011 — Exact after snapshot and zero mutation

After all simulation objects and then-existing publication temps are removed,
and before `OBSERVATION_ROWS`/`Dobs` freeze or terminal publication, the
transaction MUST repeat every field in `CTR-XOBS-006`. Equality is exact for
target bytes/Git blob/security metadata/xattrs, environment whole-
file digests/metadata/effective gate, controller/service/PID/generation/start
time/binary/plist/argv/working-directory/listener/ancestry, exact health
status/body bytes, catalog projection/digest, Grant projection/digest, and every
workflow projection/digest.

The target-directory entry inventory MUST exactly equal its before inventory.
The parent device/inode/realpath/uid/gid/mode/ACL/xattrs MUST match; timestamps
whose kernel semantics necessarily reflect creation/deletion of the one allowed
entry are recorded before/after and MUST NOT be misrepresented as equal. Any
other parent metadata or entry change fails.

The production mutation ledger MUST prove:

```text
targetReplaceOrWriteCount = 0
dotenvOrConfigWriteCount = 0
serviceRestartOrSignalCount = 0
grantOrAuthWriteCount = 0
workflowOrCanaryWriteCount = 0
r5StageMutationCount = 0
productionDirectoryTempCreateCount = 1
productionDirectoryTempDeleteCount = 1
productionDirectoryFinalResidueCount = 0
```

Any mismatch, uncertainty, transient drift, or missing proof forbids
`ROOT_XATTR_OBSERVATION_VERIFIED` and routes to
`MANUAL_RECOVERY_REQUIRED` after bounded cleanup.

### CTR-XOBS-012 — Durable receipts, mirror, and closed terminals

The terminal-evidence publication graph MUST be the following exact finite
total order. An implementation MUST reject any dependency edge not listed here:

```text
durable PRE_RECORD and append-only OBJECT_RECORDS journal
  -> create/observe/normalize/remove every simulation object
  -> after snapshot and zero simulation-object residue
  -> freeze canonical OBSERVATION_ROWS and Dobs
  -> atomically publish ROOT_OBSERVATION_RECEIPT.json
  -> atomically publish its byte-identical user mirror
  -> atomically publish detached TERMINAL_PUBLICATION_INDEX.json
  -> external coordinator records the final index SHA-256 and metadata
```

`PRE_RECORD`, journal, root-receipt temp/final, mirror temp/final, and
terminal-index temp/final are publication plumbing outside the simulation tuple
set. Their creation, xattrs, normalization state, and propagation MUST NOT add
an `OBSERVATION_ROWS` row or alter `Dobs`. Every publication object still has an
exact sealed path/primitive and receives complete separately auditable metadata,
xattr, fsync, readback, and residue checks under this Contract. Publication
xattrs are never Recovery R3 compatibility evidence.

All three final publications use a fresh exact same-directory temp, exclusive
no-clobber creation, file fsync, atomic no-clobber rename/link discipline,
readback, and directory fsync. The root receipt is canonical non-secret JSON,
root:wheel `0600`, at `ROOT_OBSERVATION_RECEIPT.json`. It uses the same canonical
JSON rules as `CTR-XOBS-008` and binds:

- candidate ID, transaction/attempt IDs, accepted Spec and parent coordinates;
- `D1`, `D2`, external observation seal hash, exact Gate path/digest;
- root bootstrap/transaction/tool bytes and digests, OS/Darwin build, arch;
- target-parent path/device/inode/filesystem/volume/security metadata;
- source-subject manifest and every operation-signature digest;
- exact canonical `OBSERVATION_ROWS` bytes and `Dobs` for a complete
  observation, or explicit `Dobs=null` plus the journal digest and incomplete
  row IDs for a handled failure before the freeze;
- normalization/delete/readback and propagation results;
- before/after production snapshots and mutation ledger;
- cleanup/residue census and old-stage non-mutation assertion; and
- proposed terminal, failure stage, proposed receipt usability
  (`pending_terminal_publication` or `false`), publication state
  `PENDING_TERMINAL_INDEX`, and timestamps.

The root receipt contains neither its own length/hash/metadata nor any predicted
or actual row for itself, its temp, the future mirror/temp, the future terminal
index/temp, or other publication objects. Once the final receipt bytes are
durable and read back, the root supervisor computes their exact byte length and
SHA-256 without changing them.

The root supervisor then copies those exact final receipt bytes, never a
re-serialization, into a fresh sealed temp in the user-visible receipt
directory, sets exact uid 502/group 20/mode `0600`, file-fsyncs, publishes
atomically with no clobber, directory-fsyncs, and reads back. Exact receipt and
mirror byte length and SHA-256 MUST be equal. Mirror xattrs and other metadata
are checked and recorded only as publication metadata; they never supply a
recovery tuple.

Only after that equality proof may root canonically serialize and atomically
publish root:wheel `0600` `TERMINAL_PUBLICATION_INDEX.json`. The detached index
binds:

- transaction/attempt IDs, exact Gate digest, candidate `D1`/`D2`/external seal
  hash, accepted Spec/parent coordinates, and `Dobs`;
- root receipt path, exact length/SHA-256, type/uid/gid/mode/link/device/inode/
  realpath, complete publication-only xattr metadata, and fsync/readback proof;
- mirror path and the same metadata, exact length/SHA-256 equality with the root
  receipt, and fsync/readback proof;
- absence of every sealed receipt/mirror/index temp and every simulation object;
  and
- one closed terminal, failure stage, final `receiptUsableForRecovery`, and
  timestamps.

The terminal index excludes itself and its temp, never contains its own hash or
future publication-object observations, and is never mutated after publication.
After index file fsync, atomic publication, readback, directory fsync, and a
second complete temp/residue absence check, the external coordinator MUST hash
the exact final index bytes and atomically no-clobber publish a uid 502/group 20/
mode `0600` `TERMINAL_INDEX_READBACK_RECORD_CLASS` with file fsync, readback, and
directory fsync. It records the index hash plus index path/length/type/uid/gid/
mode/link/device/inode/realpath and publication-only xattr metadata. That
external record is not an observation row, contains no self hash, and cannot
modify the index.

Effective root transaction terminals are closed to the terminal value in a
valid durable index:

```text
ROOT_XATTR_OBSERVATION_VERIFIED
OBSERVATION_FAILED
MANUAL_RECOVERY_REQUIRED
```

`COMMITTED`, recovery/deployment success, `STOPPED_PREWRITE`, and R5 success are
forbidden terminals. Unknown/quarantine/resource-fork/additional attributes,
command failure, drift, missing cleanup, mismatched mirror, malformed/partial
receipt/index, or any uncertainty sets `receiptUsableForRecovery=false`.

`ROOT_XATTR_OBSERVATION_VERIFIED` does not exist effectively until the index is
durable, read back, directory-fsynced, every publication temp is absent, and the
external coordinator records its hash. It still sets
`receiptUsableForRecovery=pending_post_audits`; only `CTR-XOBS-014` can produce
the external audited-consumption state. Stdout, exit status, AppleScript return,
receipt alone, or mirror alone is never authoritative.

Reconciliation is deterministic and never republishes, repairs, or completes a
partial graph after the root supervisor is gone:

| Durable state | Reconciled result |
|---|---|
| Valid externally hashed index + all bound receipt/mirror bytes and metadata + no temp | exact index terminal |
| Valid receipt and optional valid mirror, but no valid index | `MANUAL_RECOVERY_REQUIRED`; publication incomplete; no retry |
| Index missing/invalid, index/receipt/mirror mismatch, unexpected final/temp, or unknown metadata | `MANUAL_RECOVERY_REQUIRED`; receipt unusable |
| PRE_RECORD/root-start proof but no valid receipt | `AUTHORIZATION_OUTCOME_UNKNOWN` and `MANUAL_RECOVERY_REQUIRED` |
| Valid failure index proving known no-mutation and cleanup | `OBSERVATION_FAILED`; never recovery-consumable |

A still-live, mechanically identified original root supervisor may finish its
already-started total order; no coordinator, later process, or new authorization
attempt may do so. A failure index may bind `Dobs=null`; a verified index MUST
bind the exact frozen non-null `Dobs` and complete rows.

### CTR-XOBS-013 — Concurrency, faults, signals, partial writes, and cleanup

The transaction and authorization attempt MUST share one exclusive lock bound
to transaction ID, process liveness, `D1`, `D2`, and external seal hash. Active
or ambiguous concurrency stops before the temp sibling. All state transitions
are durable and monotonic; no verified terminal is written early.

Fault injection and trapped-signal handling MUST cover before/during/after each:

```text
root stage mkdir
candidate install
artifact install and extraction
helper/policy install
xattr list/read/canonicalization
xattr delete and readback
deployment temp create/populate/normalize/unlink
before/after production snapshot
PRE_RECORD/object-event append/fsync/readback
root-stage cleanup
simulation cleanup/residue proof and OBSERVATION_ROWS/Dobs freeze
root-receipt, mirror, and terminal-index temp-write, file-fsync, publish,
  readback, dir-fsync, and temp-absence checks
```

`INT`, `TERM`, and `HUP` MUST enter one idempotent bounded cleanup path, remove
the exact temp sibling and all ephemeral simulation/control/temp objects
attributed to this transaction, prove zero new simulation/temp residue, and
publish a valid `OBSERVATION_FAILED` failure index unless state is uncertain,
which publishes `MANUAL_RECOVERY_REQUIRED`. No signal/fault path may append a
publication-object row, change frozen `OBSERVATION_ROWS`/`Dobs`, publish success
before the index, or complete a partial publication from a new process. The root
bootstrap MUST supervise a killable worker so injected worker `KILL` is
detected and cleaned by the root-owned supervisor. A `KILL` of the root
supervisor itself is untrappable;
the coordinator MUST NOT repeat authorization and MUST classify missing
terminal proof as `AUTHORIZATION_OUTCOME_UNKNOWN` /
`MANUAL_RECOVERY_REQUIRED`. It may not claim zero residue without a later
separately authorized cleanup authority.

Handled success, ordinary failure, trapped signal, and supervised worker-KILL
MUST leave zero transaction-created simulation/stage/temp residue. Durable
PRE_RECORD/journal/receipt/mirror/index finals are evidence, not residue, and
their exact presence must match the reconciliation table in `CTR-XOBS-012`.
Cleanup targets are exact sealed paths and inodes; recursive unresolved paths,
globs, broad parent
deletion, or old-stage cleanup are forbidden. Cleanup failure cannot be hidden
by receipt publication.

### CTR-XOBS-014 — Independent post-observation dual audit

After a valid externally hashed `ROOT_XATTR_OBSERVATION_VERIFIED` terminal index
binds the exact root receipt and mirror, two new independent Reviewers, distinct
from the Author, acceptance actors, Build Agent, pre-execution Reviewers, Gate
Reviewer, and executor, MUST audit in parallel:

```text
Post-Observation Receipt Authenticity Reviewer
Post-Observation Production Boundary Reviewer
```

Both bind the exact observation seal, Gate, attempt, root receipt, mirror,
terminal index and external index hash, `Dobs`, and transaction/tool/OS/parent/
operation/object tuple coordinates. The Receipt Reviewer reconstructs the
layered seal, recomputes canonical `OBSERVATION_ROWS` and `Dobs`, authenticates
every receipt field, simulation row, xattr representation, propagation edge,
mirror byte, publication metadata record, index field, and all temp exclusions,
and proves no publication object contributed a row. The
Boundary Reviewer independently re-runs fresh read-only production snapshots,
proves the target/env/services/PID/health/catalog/Grant/workflow state matches
the receipt's after state and admissible before state, and proves zero
transaction residue without deleting anything.

Any `REVISE`, missing evidence, stale/mixed seal, inability to read, or drift
sets the observation state `MANUAL_RECOVERY_REQUIRED` and the receipt unusable.
Only two PASS reports for the same exact receipt/index/`Dobs` tuple may produce
an external `ROOT_XATTR_OBSERVATION_AUDITED_V1` consumption record under
`GOAL_STATE_ROOT`. That record binds both audit paths/digests/identities/verdicts
and sets:

```text
ROOT_XATTR_OBSERVATION_VERIFIED = YES
ZERO_PRODUCTION_MUTATION_VERIFIED = YES
ZERO_OBSERVATION_RESIDUE_VERIFIED = YES
RECEIPT_AUTHENTICITY_VERIFIED = YES
READY_FOR_RECOVERY_R3_CONSUMPTION = YES
```

It does not authorize R3 build, execution, or production mutation.

### CTR-XOBS-015 — Recovery R3 receipt consumption and drift stop

A later Recovery R3 MUST be a brand-new candidate and transaction built under
the accepted recovery parent. It MUST NOT reuse R2 or observation executable
bytes/stages. Its compatibility input may consume only the canonical
`OBSERVATION_ROWS`/`Dobs` from the exact root receipt plus the receipt and
terminal-index identities/digests bound by both post-audit reports and the
external audited-consumption record. It may verify mirror equality through the
index/audits, but MUST NOT consume receipt/mirror/index/journal/temp/control
xattrs or any other publication-object metadata as a recovery tuple.

Before R3 sealing, its manifest and detached seal MUST include exact digests and
paths for that evidence and freeze the complete compatibility vector:

```text
observation candidate seal and accepted observation Spec coordinates
canonical OBSERVATION_ROWS and Dobs
root receipt, terminal index, external index-hash record, mirror-equality proof,
  and post-audit record digests
root bootstrap and observation transaction tool identities
OS version, Darwin build, architecture
target-parent realpath/device/inode/filesystem/volume/security metadata
each source object class/path policy/byte digest/Git blob/metadata/ACL/xattr tuple
each absolute tool/version/binary digest and exact operation signature
each simulation-object-class pre/post xattr tuple and propagation edge
final-target preimage metadata/ACL/xattr policy
```

The vector MUST reject any observation row whose object ID/path is not in the
sealed `FUTURE_RECOVERY_SIMULATION_OBJECT_SET`, any missing simulation row, any
publication/control row, and any `Dobs` mismatch. Publication metadata may
authenticate evidence handling but cannot satisfy any parent xattr prerequisite.

Source object/digest/xattr, OS/build/arch, tool bytes/version, target-parent,
filesystem/volume, operation signature, or object-class mapping drift makes the
receipt ineligible and R3 MUST stop prewrite and require a new observation.
There is no compatibility-by-name, best-effort, or Reviewer waiver.

At actual R3 root execution, before normalization or production mutation, the
transaction MUST re-observe every corresponding object tuple and compare it
byte-for-byte with the sealed observation vector. Missing object, different
tuple, execution-signature mismatch, or propagation mismatch stops prewrite,
emits a non-success recovery receipt, and requires a new observation. Exact
match only satisfies the tuple prerequisite; R3 still needs all accepted parent
Contracts, same-seal recovery audits, recovery Gate, authorization lifecycle,
and final-target metadata equality. Observation evidence never authorizes
recovery on its own.

### CTR-XOBS-016 — Secret safety, exclusions, and documentation-only checks

All candidate, receipt, mirror, logs, audit records, and PR records MUST be
non-secret. They may contain exact xattr bytes only because the observed
provenance tuples are explicitly classified non-secret; if any xattr or command
output cannot be mechanically classified non-secret, store only a sealed
length/digest plus `receiptUsableForRecovery=false` and stop. Dotenv contents,
tokens, credentials, Grant secrets/hashes, workflow payloads, and business data
MUST NOT be emitted.

This authoring PR MUST remain Draft, change exactly this one Spec, preserve the
parent, and pass governance integrity, frontmatter, required sections, stable
IDs, bidirectional Contract/Acceptance coverage, authority/relations,
non-circular seal graph, finite terminal-publication graph, structure, diff
hygiene, docs-only scope, and secret scan checks. This Contract grants no
implementation exception.

## 11. Acceptance

### ACC-XOBS-001 — Lifecycle and parent immutability

- Contracts: `CTR-XOBS-001`
- Method: inspect exact base/head, parent blob, Spec lifecycle, independent
  semantic review, Owner lifecycle record, final-head review, merge, and main
  readback
- Environment: clean isolated worktrees and persistent Draft PR records
- Required evidence: all exact SHAs/blobs/digests, role identities, lifecycle
  diff, and `SEMANTIC_DELTA_AFTER_REVIEW=NONE`
- Expected result: only this Spec activates through the complete lifecycle;
  parent remains byte-identical; no build precedes accepted main
- Failure condition: self-acceptance, parent edit, build before acceptance,
  stale/missing final-head review, or inferred authority

### ACC-XOBS-002 — R2/R5 non-reuse

- Contracts: `CTR-XOBS-002`
- Method: provenance trace and adversarial R2/R5 path/digest injection fixtures
- Environment: observation build harness
- Required evidence: complete input graph, old-artifact access trace, new IDs,
  and terminal records
- Expected result: prior artifacts are evidence-only; no executable/input byte
  is reused and no old stage is changed
- Failure condition: R2 becomes sealable/auditable, old bytes execute, or R5 is
  cleaned/relabelled/retried

### ACC-XOBS-003 — Finite seal graph and candidate immutability

- Contracts: `CTR-XOBS-003`
- Method: construct the graph twice from identical inputs, topologically sort
  it, mutate every member byte/path/metadata, inject cycles/self-hashes/upper-
  layer references/duplicate paths and inodes, and re-read after Gate
- Environment: fresh uid-502 `0700` candidate roots
- Required evidence: raw manifest/seal/auth bytes, D1/D2/external seal hashes,
  dependency graph, mutation matrix, and immutability trace
- Expected result: finite reproducible graph; all drift rejects; no seal self-
  reference or post-Gate materialization
- Failure condition: cycle/fixed-point, candidate-supplied seal hash, missing
  member, path/type/owner/mode/link mismatch, or mutation survives

### ACC-XOBS-004 — Same-seal Gate and one authorization attempt

- Contracts: `CTR-XOBS-004`
- Method: role matrix; mixed-seal/stale-review/Gate mutation fixtures; GUI/
  console/session preconditions; cancellation/denial; crashes before/after each
  prelaunch persistence and process-creation boundary
- Environment: macOS authorization harness without password capture
- Required evidence: two PASS audits, Gate bytes/digest, attempt fsync/rename/
  readback trace, process census, receipt reconciliation, and redaction scan
- Expected result: only one dialog/process after exact Gate; no password channel
  or repeat; unknown outcome is manual recovery
- Failure condition: mixed role/seal, dialog before Gate, post-Gate input,
  repeated attempt, password/fallback channel, or stdout-only outcome

### ACC-XOBS-005 — Bootstrap and path escape matrix

- Contracts: `CTR-XOBS-005`
- Method: inspect literal bootstrap and run `/tmp`, PATH, env, argv, symlink,
  hardlink, ancestry, archive traversal, inode-alias, existing-stage, network,
  dynamic-command, and old-stage fixtures
- Environment: isolated macOS filesystem fixture
- Required evidence: allowlist trace, root-side layered recomputation, exact
  stage metadata, executed-path census, and zero production writes on rejection
- Expected result: only root-owned audited code in one fresh `0700` stage runs
- Failure condition: unsealed or user-writable privileged execution, `/tmp`,
  path escape, reused stage, or old-stage access

### ACC-XOBS-006 — Complete fresh before snapshot

- Contracts: `CTR-XOBS-006`
- Method: positive snapshot plus permission/timeout/parse/unstable-read/secret-
  projection/concurrent-drift and count-only fixtures for every surface
- Environment: read-only production adapter and isolated mocks
- Required evidence: canonical records/digests and PRE_RECORD durability trace
- Expected result: every surface is complete and stable before object creation
- Failure condition: UNKNOWN passes, count-only census passes, secret is emitted,
  or temp creation occurs before durable baseline

### ACC-XOBS-007 — Object inventory and operation signatures

- Contracts: `CTR-XOBS-007`, `CTR-XOBS-012`
- Method: execute each required simulation class, helpers/policies and explicit
  future-recovery-other of cardinality zero/one/many; enumerate all publication
  plumbing; topologically sort the declared runtime publication graph; inject
  set overlap, implicit/generic other, unenumerated objects, publication-object
  rows, self/future-object edges, alternate tools/defaults/locale/env, source
  digest/xattr drift, wrong order, and operation fallback
- Environment: macOS root-stage simulation then authorized observation only
  after all gates
- Required evidence: both disjoint object inventories, complete simulation
  edges, publication DAG/topological order, and exact signature records
- Expected result: every actual object is sealed in exactly one set; only finite
  future-recovery simulation objects produce rows; no implicit primitive,
  object, publication row, or dependency cycle exists
- Failure condition: missing/extra/overlapping object, publication row,
  self/future edge, incomplete source tuple, tool/argv/env/OS/parent drift, or
  fallback succeeds

### ACC-XOBS-008 — Canonical per-object xattr matrix

- Contracts: `CTR-XOBS-008`
- Method: for every object class exercise empty set; sole well-formed provenance;
  differing provenance value/length; unknown xattr; quarantine; resource fork
  through both APIs; additional attrs; missing expected attr; list/read failure;
  raw/default/truncated/lowercase/whitespace/odd/non-hex representations; path/
  inode swap
- Environment: fresh root-owned objects per case on the qualified macOS volume
- Required evidence: exact commands/outputs/exit codes, canonical hex/length/
  digest math, source tuples, append-only events, canonical
  `OBSERVATION_ROWS`/`Dobs`, publication-object exclusion trace, and receipt
  usability
- Expected result: complete exact tuple or explicit ABSENT; every ambiguity and
  forbidden state is recorded and fails closed; rows freeze only after cleanup,
  and publication-object xattrs cannot change `Dobs`
- Failure condition: name-only acceptance, unknown attr passes, command failure
  passes, representation is normalized permissively, publication plumbing adds
  a row, or byte/key/order mutation preserves `Dobs`

### ACC-XOBS-009 — Normalization and propagation

- Contracts: `CTR-XOBS-009`
- Method: positive delete/readback per class; wrong value/inode; delete/readback
  failures; candidate mutation sentinel; every adjacent propagation combination;
  injected final-target contamination attempt
- Environment: root-stage and same-filesystem temp fixtures
- Required evidence: immutable candidate hashes, pre/post tuples, propagation
  table, target census, and terminal receipt
- Expected result: only exact observation-owned tuples are touched; final target
  is untouched; every edge is determined or receipt is unusable
- Failure condition: user input changes, broader xattr deletion, indeterminate
  edge passes, or staging metadata reaches target

### ACC-XOBS-010 — Same-filesystem sibling without target replacement

- Contracts: `CTR-XOBS-010`
- Method: exact positive create/populate/observe/normalize/unlink plus existing-
  name, filesystem/device mismatch, symlink/hardlink, rename/link/exchange,
  byte/mode/ACL/xattr drift, unlink failure, and target inode-swap fixtures
- Environment: isolated exact-layout parent and authorized production only after
  all prior gates
- Required evidence: syscall/command trace, inode/device/volume identities,
  target before/after, directory inventory, and residue census
- Expected result: exactly one sibling is created/deleted and never installed
- Failure condition: target changes, alternate temp path, overwrite, rename/link,
  wrong metadata, or residue

### ACC-XOBS-011 — Exact production before/after equality

- Contracts: `CTR-XOBS-011`
- Method: inject independent change into each target/env/service/PID/health/
  catalog/Grant/workflow field and directory entry; run no-change success
- Environment: deterministic production-boundary harness then authorized
  read-only post-observation checks
- Required evidence: canonical paired snapshots, mutation ledger, raw identity
  proofs, and parent timestamp disclosure
- Expected result: all frozen surfaces and directory inventory match exactly;
  only one temp create/delete is observed
- Failure condition: any drift or unknown passes, or unavoidable directory
  timestamp effects are falsely reported as equality

### ACC-XOBS-012 — Receipt, mirror, and terminal integrity

- Contracts: `CTR-XOBS-008`, `CTR-XOBS-012`
- Method: mechanically topologically sort the exact terminal-publication graph;
  reject every added self/future/publication-row edge; byte-mutate, corrupt,
  truncate, reorder, or partially publish every root-receipt, mirror, and
  terminal-index temp/write/fsync/rename/readback/dir-fsync boundary; mismatch
  every path/length/hash/metadata/`Dobs`/coordinate; leave each temp; inject
  forbidden terminal, index self-hash, future-object row, and secret
- Environment: isolated receipt roots with root/user ownership simulation
- Required evidence: canonical row/receipt/index bytes, `Dobs`, root receipt/
  mirror/index lengths and digests, exact equality, publication metadata,
  fsync/readback/temp-absence trace, external index-hash record, reconciliation
  table result, redaction result, and recovery-usability decision
- Expected result: finite total order, immutable receipt, exact durable mirror,
  detached externally hashed index, no publication row, no temp, only closed
  terminals, and success effective only after index durability/readback
- Failure condition: cycle, byte mutation or partial/mismatched publication
  passes, receipt/index self-reference, publication xattr becomes tuple evidence,
  stdout controls state, secret leaks, or `COMMITTED`/recovery success appears

### ACC-XOBS-013 — Fault, signal, and cleanup matrix

- Contracts: `CTR-XOBS-013`
- Method: command failure, timeout, partial write, fsync/publish failure, INT/
  TERM/HUP at every named window including row freeze and every receipt/mirror/
  index publication substep, worker KILL, supervisor KILL, concurrent lock,
  cleanup error, pre-existing old stages, and coordinator restart
- Environment: isolated root supervisor/payload and filesystem mocks
- Required evidence: PRE_RECORD, lock/process identity, state sequence, signal/
  fault trace, exact cleanup targets, residue census, invocation count,
  receipt/mirror/index reconciliation state
- Expected result: handled paths have zero new residue and no early success;
  supervisor KILL is unknown/manual with no repeated authorization or false
  cleanup claim
- Failure condition: repeat dialog, broad deletion, old-stage mutation, frozen
  rows change, partial publication is completed by a new process, early success,
  residue hidden, or ambiguous outcome passes

### ACC-XOBS-014 — Post-observation dual audit

- Contracts: `CTR-XOBS-014`
- Method: independent reconstruction by two roles; tamper receipt/mirror/Gate/
  terminal-index/external-index-hash/seal/audit identity; mutate `Dobs`; inject
  a publication-object row; fresh production and residue readback; mixed audit
  tuple
- Environment: exact production host after root execution
- Required evidence: two reports and digests, fresh boundary snapshot, receipt
  and terminal-index authentication chain, row/index reconstruction, role
  matrix, and external consumption record
- Expected result: only two exact-same-receipt/index/`Dobs` PASS audits make
  evidence consumable; no production action is authorized
- Failure condition: one audit, reused role, stale/mixed evidence, cleanup by
  Reviewer, or direct recovery readiness inference

### ACC-XOBS-015 — Recovery R3 compatibility and execution-time mismatch

- Contracts: `CTR-XOBS-015`
- Method: construct a new R3 seal with exact evidence, then independently mutate
  every source digest/xattr, OS/build/arch, tool/version/binary, parent/filesystem/
  volume, operation signature, simulation-object mapping, observed tuple,
  propagation edge, `OBSERVATION_ROWS` byte, `Dobs`, receipt/index identity, and
  publication-object xattr at pre-seal and execution time
- Environment: isolated recovery build/root-stage harness; no production write
- Required evidence: R3 manifests/seal, compatibility matrix, `Dobs` and
  receipt/index bindings, tuple readbacks, publication-exclusion trace, stop
  receipts, and zero-prewrite mutation census
- Expected result: exact vector is a prerequisite only; every drift stops
  prewrite and requires new observation; publication-object xattrs are ignored
  as tuple supply and cannot make a missing/mismatched simulation row pass
- Failure condition: receipt reused across drift, partial vector match passes,
  R2/observation executable bytes are reused, or observation bypasses recovery
  audits/Gate

### ACC-XOBS-016 — Docs-only governance and secret safety

- Contracts: `CTR-XOBS-016`
- Method: governance/frontmatter/required-section/stable-ID/relations and
  bidirectional coverage checks; seal-cycle and terminal-publication-cycle
  tests; structure verifier; diff and docs-only scope; gitleaks/secret/env-
  content scan; Draft PR inspection
- Environment: clean isolated worktree at exact PR head
- Required evidence: commands, exit codes, exact diff, base/head pins, scan
  output, and Draft state
- Expected result: all checks PASS; exactly this new proposed/none/none Spec is
  added; parent and production remain unchanged
- Failure condition: any check fails, another path changes, lifecycle activates,
  parent changes, secret leaks, or PR is ready/merged

### Contract / Acceptance bidirectional coverage

| Contract | Acceptance coverage |
|---|---|
| `CTR-XOBS-001` | `ACC-XOBS-001` |
| `CTR-XOBS-002` | `ACC-XOBS-002` |
| `CTR-XOBS-003` | `ACC-XOBS-003` |
| `CTR-XOBS-004` | `ACC-XOBS-004` |
| `CTR-XOBS-005` | `ACC-XOBS-005` |
| `CTR-XOBS-006` | `ACC-XOBS-006` |
| `CTR-XOBS-007` | `ACC-XOBS-007` |
| `CTR-XOBS-008` | `ACC-XOBS-008`, `ACC-XOBS-012` |
| `CTR-XOBS-009` | `ACC-XOBS-009` |
| `CTR-XOBS-010` | `ACC-XOBS-010` |
| `CTR-XOBS-011` | `ACC-XOBS-011` |
| `CTR-XOBS-012` | `ACC-XOBS-007`, `ACC-XOBS-012` |
| `CTR-XOBS-013` | `ACC-XOBS-013` |
| `CTR-XOBS-014` | `ACC-XOBS-014` |
| `CTR-XOBS-015` | `ACC-XOBS-015` |
| `CTR-XOBS-016` | `ACC-XOBS-016` |

Every Contract has Acceptance coverage and every Acceptance item references an
existing Contract. Executed evidence must bind the exact Spec/candidate/
environment/time tuple; a test definition alone proves nothing.

## 12. Alternatives and disposition

### ALT-XOBS-001 — Seal, repair, or audit R2

- Disposition: rejected permanently
- Reason: R2's durable stop record states no qualified root tuple and no seal;
  post-hoc repair would change the reviewed candidate identity
- Evidence/Claims considered: `OBS-XOBS-001`, `CLM-XOBS-001`
- What would reopen: nothing for R2; only a new candidate is allowed

### ALT-XOBS-002 — Borrow user-candidate or dotenv provenance

- Disposition: rejected
- Reason: object identity and producing step differ; even their recorded values
  differ, and the parent forbids automatic generalization
- Evidence/Claims considered: `OBS-XOBS-002`, `OBS-XOBS-003`, `CLM-XOBS-002`
- What would reopen: never as inference; only exact qualified root observation

### ALT-XOBS-003 — Accept `com.apple.provenance` by name or all `com.apple.*`

- Disposition: rejected
- Reason: it ignores value, length, source, propagation, quarantine, resource
  forks, and unknown metadata
- Evidence/Claims considered: accepted parent `DEC-REC-004` / `CTR-REC-008`
- What would reopen: a new whole-authority safety decision; none is requested

### ALT-XOBS-004 — Observe by replacing and rolling back production target

- Disposition: rejected
- Reason: observation does not need a production target mutation; replacement
  would collapse observation and recovery authority
- Evidence/Claims considered: `DEC-XOBS-003`
- What would reopen: none under this Spec

### ALT-XOBS-005 — Use `/tmp` or a user-writable privileged script

- Disposition: rejected
- Reason: privileged execution would depend on a mutable/unsealed path
- Evidence/Claims considered: parent bootstrap boundary and `DEC-XOBS-005`
- What would reopen: none

### ALT-XOBS-006 — Normalize the user candidate before seal

- Disposition: rejected
- Reason: it mutates the input whose bytes and metadata are under audit
- Evidence/Claims considered: accepted parent `DEC-REC-004`
- What would reopen: none

### ALT-XOBS-007 — Clean the old R5 root stage during observation

- Disposition: rejected
- Reason: it is unrelated production/root mutation and lacks the parent's exact
  attribution-and-cleanup recovery transaction
- Evidence/Claims considered: `DEC-XOBS-006`
- What would reopen: separate accepted cleanup/recovery authority

### ALT-XOBS-008 — Treat terminal observation evidence as direct R3 authority

- Disposition: rejected
- Reason: receipt/index authenticity and `Dobs` compatibility need independent
  post-audits, and recovery remains governed by the accepted parent
- Evidence/Claims considered: `DEC-XOBS-007`, `CLM-XOBS-004`
- What would reopen: none; the authority separation is intentional

## 13. Migration, compatibility, and rollback

This Spec adds no product/schema migration. It creates ephemeral observation
objects and durable non-secret evidence only.

```text
MIGRATION = NONE
PRODUCT_COMPATIBILITY_CHANGE = NONE
PRODUCTION_ROLLBACK = NOT APPLICABLE; production target is never changed
OBSERVATION_FAILURE_CONTAINMENT = exact transaction-owned cleanup, then
  OBSERVATION_FAILED or MANUAL_RECOVERY_REQUIRED
OLD_STAGE_HANDLING = identify as pre-existing evidence if visible; never delete
RECEIPT_COMPATIBILITY = exact OBSERVATION_ROWS/Dobs plus receipt/index identity
  vector under CTR-XOBS-015; no fuzzy match; no publication-xattr tuple input
```

There is no automatic rerun after authorization cancellation, denial, crash, or
unknown root outcome. A failed/rejected candidate is never modified or resealed;
a later authorized attempt uses a new candidate and transaction after the prior
state is mechanically reconciled.

## 14. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
READY_TO_MARK_ACCEPTED = NO
```

Exact random IDs, paths, member digests, source-object digests, tool digests, OS
build, parent-directory identity, operation signatures, and observed tuples are
mechanical sealed build/execution outputs under the Contracts above. They are
not open policy choices. Missing or ambiguous values fail closed.

## 15. Authoring result

```text
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AGENT_CORE_WORKFLOW_TRANSITION_ROOT_XATTR_OBSERVATION_V1
SPEC_KIND = implementation
STATUS = proposed
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_WORKFLOW_TRANSITION_DEPLOYMENT_RECOVERY_V1
EXTERNAL_AUTHORITIES = NONE
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 16
CONTRACTS_WITH_ACCEPTANCE = 16
TERMINAL_PUBLICATION_GRAPH = FINITE_ACYCLIC
AUTHORING_READY_FOR_REVIEW = YES, subject to CTR-XOBS-016 checks
```

This is an authoring claim only. It is not semantic review, acceptance,
implementation, observation execution, receipt validation, recovery authority,
or production conformance.

## 16. Authority acceptance lifecycle

1. This exact docs-only head remains proposed on a Draft PR.
2. A new independent Root Xattr Observation Authority Reviewer binds the exact
   base, head, Spec blob/SHA-256, parent commit/blob/SHA-256, all primitive IDs,
   16 Contracts, 16 Acceptance items, threats, seal graph, finite terminal-
   publication graph, and Owner instruction digest, then returns `ACCEPT` or
   `REVISE` in a persistent PR record.
3. `REVISE` returns to a new authoring revision. No artifact build,
   authorization, or observation may begin.
4. Only after `ACCEPT`, mayf3 or an explicitly authorized maintainer perform a
   docs-only lifecycle transaction on this one file: `status: proposed ->
   accepted`, `implementation_authority: none -> contracts`,
   `production_apply_authority: none -> contracts`, plus an acceptance record
   binding the reviewed head, Reviewer, verdict, time, and final head.
5. A different independent final-head Reviewer proves the lifecycle-only delta
   has `SEMANTIC_DELTA_AFTER_REVIEW=NONE`. Any other delta returns to authoring.
6. The Owner merges only the exact accepted final head and reads it back from
   `github/main`. That main commit becomes the observation authority commit.
7. Only then may a new Observation Build Agent start. Acceptance alone does not
   display an authorization dialog; `CTR-XOBS-004` still requires two
   exact-same-seal candidate reviews and an independent Gate.
8. Only a verified root receipt, detached terminal index, external index-hash
   record, and the two independent post-observation PASS audits can make the
   exact `OBSERVATION_ROWS`/`Dobs` eligible evidence for a brand-new Recovery R3
   under `CTR-XOBS-015`.

The Spec Author, semantic Reviewer, acceptance actor, final-head Reviewer,
Observation Build Agent, two pre-execution Reviewers, Gate Reviewer, root
executor, and two post-observation Reviewers MUST remain distinct wherever the
roles are incompatible under `CTR-XOBS-004` and `CTR-XOBS-014`.
