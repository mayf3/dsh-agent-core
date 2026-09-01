---
spec_id: AGENT_CORE_WORKFLOW_TRANSITION_DEPLOYMENT_RECOVERY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-09-01
scope:
  - mayf3/dsh-agent-core
  - production workflow_transition deployment recovery reconciliation
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1
  - AGENT_CORE_WORKFLOW_TRANSITION_PINNED_HOTFIX_DEPLOYMENT_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_WORKFLOW_TRANSITION_DEPLOYMENT_RECOVERY_V1

> **PROPOSED / NOT ACCEPTED.** This docs-only amendment of the proposed
> recovery Authority reconciles the combined R5/v6 incident. It does not
> authorize a candidate build, production write, service restart, rollback,
> `osascript` invocation, canary, Grant, credential, allowlist, or workflow
> mutation. Until an independent Authority review passes, the Owner accepts the
> exact reviewed final head, and that accepted head is present on `main`, both
> authority fields remain `none`. This authoring round MUST NOT accept or merge
> its own Spec.

## 1. Goal

Recover the production workflow-transition deployment from a state that can no
longer be certified as R5 `STOPPED_PREWRITE`.

The recovery artifact, if and only if this Spec is later accepted and then
built and audited, implements two mutually exclusive branches:

```text
FORWARD_RECONCILIATION
ROLLBACK_TO_FROZEN_PREIMAGE
```

`FORWARD_RECONCILIATION` is selected only when all 23 forward gates in
`CTR-REC-003` independently evaluate `PASS`. A single `FAIL` or `UNKNOWN`
selects `ROLLBACK_TO_FROZEN_PREIMAGE`; inability to execute that rollback
safely produces `MANUAL_RECOVERY_REQUIRED`, never an inferred forward success.

At the current recorded coordinates the effective svc-workflow dotenv gate is
exactly `true`, so gate 12 is expected to fail and the expected execution branch
is `ROLLBACK_TO_FROZEN_PREIMAGE`. Both branches nevertheless MUST be fully
implemented and exercised in the same sealed recovery transaction.

## 2. Scope and non-goals

### 2.1 In scope only after exact-head acceptance, build, same-seal audits, and gate review

- deterministically classify all 23 forward gates as `PASS`, `FAIL`, or
  `UNKNOWN` and persist their evidence;
- either reconcile the already-deployed target without replacing
  `workflow.js`, or safely close the svc-workflow write gate and atomically
  restore the frozen preimage;
- use a new immutable recovery candidate, manifest, stamp, Owner launcher,
  root transaction, random root-owned staging directory, and seal;
- preserve R5 as `FAILED_WITH_UNCERTAIN_TERMINAL`; never retry, modify, reseal,
  or relabel R5 as successful;
- distinguish `ROOT_STAGE_XATTR_POLICY` from `FINAL_TARGET_XATTR_POLICY` and
  enforce both fail closed;
- preserve non-secret incident evidence, a durable `PRE_RECORD`, a terminal
  root receipt, and the exact recovery outcome;
- clean every new temporary object on success and ordinary failure; recover and
  clean after an untrappable interruption before any later transaction may run;
- clean an old R5 root stage only inside the audited root transaction and only
  after mechanical transaction attribution.

### 2.2 Closed mutation and output allowlists

The recovery manifest MUST bind exact absolute paths before audit. Path classes
are closed as follows:

```text
EXISTING_MUTABLE_PATHS =
  /Users/yanfenma/.local/services/svc-workflow/.env
  /usr/local/libexec/agent-core/app/packages/broker/src/capabilities/workflow.js

EXACT_CONTROLLERS =
  gui/502/com.svc-workflow
  system/ai.agent-core.runtime

USER_CANDIDATE_ROOT_CLASS =
  /Users/yanfenma/workspace/deployment-artifacts/<recovery-candidate-id>/

GOAL_STATE_ROOT =
  /Users/yanfenma/workspace/deployment-artifacts/workflow-transition-goal-state/

ROOT_TRANSACTION_ROOT_CLASS =
  /var/root/agent-core-transactions/<random-transaction-id>/

ROOT_RECEIPT_ROOT_CLASS =
  /usr/local/libexec/agent-core/.deploy-receipts/
  workflow-transition-deployment-recovery-v1/<transaction-id>/

USER_LOG_CLASS =
  /Users/yanfenma/workspace/deployment-logs/
  workflow-transition-deployment-recovery-v1-<transaction-id>.log

EPHEMERAL_PATHS =
  one fresh same-directory dotenv replacement sibling
  one fresh same-directory workflow.js replacement sibling
  exact root staging objects enumerated by the sealed manifest
```

The manifest MAY create only the exact authorization records, root transaction
inputs, incident evidence, receipt, log, lock, and temporary objects required by
this Spec. The incident evidence MUST NOT contain the dotenv contents, secret
values, credential material, token material, or secret/hash columns. It may
record only the exact gate key state, whole-file SHA-256, metadata, xattr
inventory, controller identity, non-secret censuses, target source bytes, and
their digests.

### 2.3 Non-goals

- no workflow instance create, transition, cancellation, archive, or other
  state-changing workflow request;
- no canary and no real `workflow_transition` during recovery;
- no Grant, credential, allowlist, role, principal, or auth-service mutation;
- no svc-workflow or Agent Core product-code change;
- no R5 retry, repair, modification, reseal, success relabeling, or manual
  deletion of its root stage;
- no reuse of an old deployment/recovery candidate, root stage, manifest,
  stamp, wrapper, transaction, seal, or receipt as execution authority;
- no automatic canary after either recovery branch;
- no automatic redeployment after rollback; that is a later independently
  authorized artifact and deployment chain.

## 3. Authority and dependencies

This file remains a `NEW` proposed recovery authority and does not amend or
supersede its accepted parents. The present change is an `AMEND` of this
unaccepted proposal after new incident evidence invalidated its earlier
single-path model.

### 3.1 Repository and frozen workflow coordinates

```text
REPOSITORY                         = mayf3/dsh-agent-core
AUTHORITY_BRANCH                   = main
CURRENT_PROPOSED_PR                = 134
ACCEPTED_DEPLOYMENT_AUTHORITY      = AGENT_CORE_WORKFLOW_TRANSITION_PINNED_HOTFIX_DEPLOYMENT_V1
AUTHORITY_MERGE_COMMIT             = 1a9b81de19c2bf4af01f62f6189acffc1bb6839d
RELEASE_SOURCE_COMMIT              = f4bc4311225c9e0fd906ce108a5b9ffdbd83a957
FROZEN_PREIMAGE_SOURCE_COMMIT      = 9bb5b97442c7155da36f06e867d1a655410544ac
PRODUCTION_TARGET                  = /usr/local/libexec/agent-core/app/packages/broker/src/capabilities/workflow.js
TARGET_WORKFLOW_GIT_BLOB           = 577c8778cf35810ce7538aff52ab354e0c1dddc6
TARGET_WORKFLOW_SHA256             = d162670d64227613bf5c8004fc8491a296f62835722f3bdcde7ddc4131890f8e
FROZEN_PREIMAGE_GIT_BLOB           = 04ca8550fbdaf9b66624dea42701a8a9af7547a8
FROZEN_PREIMAGE_SHA256             = ca27f3a8a1a34f09858988edb57e892ebdb2a98d7ceb755f0eab252a9641a93e
BROKER_CONTROLLER                  = system/ai.agent-core.runtime
SVC_WORKFLOW_CONTROLLER            = gui/502/com.svc-workflow
WRITE_GATE_SAFE_STATE              = AUTH_V1_CANARY_WRITE_ENABLED=false
WRITE_GATE_UNSAFE_RECORDED_STATE   = AUTH_V1_CANARY_WRITE_ENABLED=true
SVC_WORKFLOW_ENV_TRUE_SHA256       = 5eba1e7924f554b0686216b5a4303480b67f9b7a90f524e8803a957fde255748
SVC_WORKFLOW_ENV_FALSE_SHA256      = 3b8d266c62b96ba2e701549d9498e829c3af885d2ace7e6a371dd35aa290167a
SVC_WORKFLOW_ENV_METADATA          = regular;uid=502;gid=20;mode=0600;ACL=none
SVC_WORKFLOW_ENV_XATTRS            = exactly com.apple.provenance
SVC_WORKFLOW_PROVENANCE_HEX_SHA256 = e6be2a51db86e14d2c2d62856a05db6294590e572c98109f004ac17a6cee2819
```

No other dotenv line, dotenv value, credential, token, secret, secret hash, or
environment content is authorized for output. The false postimage digest is a
whole-file identity derived by replacing only the unique exact gate value; it
does not disclose any other line.

The new recovery candidate MUST derive rollback bytes independently from the
frozen Git object. R5/v5/v6 artifacts, their root stages, and their receipts are
incident provenance only; none may select or supply the rollback bytes.

### 3.2 External runtime dependency boundary

```text
EXTERNAL_REPOSITORY          = mayf3/svc-workflow
EXTERNAL_SOURCE_REVISION     = f0c74eefd63ca71a1fcb670ad31ac35f19f69539
EXTERNAL_RELATIONSHIP        = pinned deployed-runtime dependency and evidence coordinate only
SVC_WORKFLOW_BINARY_SHA256   = 4e633634b313f8c926ccaf7da07f3bfd9dbf25f024a4b63a3f0a88c5a0200356
SVC_WORKFLOW_PLIST_SHA256    = b1a22e7004e251edf3472158abb5b1ec88b8e4c82c63faa80f91f23dd5909c95
```

This repository does not accept, amend, supersede, or redefine svc-workflow
source or wire authority. Drift in its source, binary, plist, dotenv loading,
guard order, or negative-response semantics makes the relevant gate `UNKNOWN`
and prevents forward reconciliation. If rollback cannot independently prove the
safe gate repair contract at the pinned runtime, it stops prewrite with
`MANUAL_RECOVERY_REQUIRED`.

## 4. Current State

### STATE-REC-001 — R5 is failed with an uncertain terminal boundary

R5 stopped on `root stage xattrs: got=com.apple.provenance expected=`, but the
later observed production target is already the target blob. Therefore R5's
`STOPPED_PREWRITE` claim is invalid as a statement about the combined incident,
and the mutation cannot be safely attributed to R5 or declared absent. R5 is
permanently `FAILED_WITH_UNCERTAIN_TERMINAL`, not retryable, not modifiable, and
not resealable. Basis: `OBS-REC-001`, `OBS-REC-002`, `EVD-REC-001`.

### STATE-REC-002 — Production contains the target blob

At the last recorded production observation, `workflow.js` equals Git blob
`577c8778cf35810ce7538aff52ab354e0c1dddc6`, the Agent Core runtime is running,
and the target capability came from a v6/concurrent production mutation outside
the certifiable R5 prewrite boundary. Basis: `OBS-REC-002`, `CLM-REC-001`.

### STATE-REC-003 — The effective write gate is true

The effective svc-workflow dotenv is whole-file SHA-256
`5eba1e7924f554b0686216b5a4303480b67f9b7a90f524e8803a957fde255748`
and contains the unique exact gate value `true`. The launchd-only v6 check did
not observe this dotenv source. Basis: `OBS-REC-003`, `OBS-REC-004`,
`EVD-REC-002`.

### STATE-REC-004 — Recovery authority is not active

PR #134 is Draft and this Spec remains proposed with no implementation or
production-apply authority. Prior review of the old semantic head does not
cover this amendment. A fresh exact-head review and Owner acceptance are
required before any candidate build. Basis: Git/PR coordinates in §3 and
`CTR-REC-001`.

## 5. Observations

### OBS-REC-001 — R5 xattr stop record

- Subject: R5 Owner deployment prewrite result
- Environment: production-host privileged bootstrap boundary
- Method: inspect saved failure result
- Result: `STOPPED: root stage xattrs: got=com.apple.provenance expected=`
- Limitation: this result proves the failing predicate, not the later combined
  production terminal state or which exact staged object produced the xattr
- Provenance: incident dispatch and preserved R5 records

### OBS-REC-002 — Later production target observation

- Subject: production `workflow.js` and Agent Core runtime
- Environment: local production host, observed 2026-09-01
- Method: full file identity plus runtime inspection
- Result: production Git blob
  `577c8778cf35810ce7538aff52ab354e0c1dddc6`; runtime running
- Provenance: recovery dispatch and PR #134 persistent incident record

### OBS-REC-003 — Effective dotenv write gate

- Subject: `/Users/yanfenma/.local/services/svc-workflow/.env`
- Environment: svc-workflow WorkingDirectory on the production host
- Method: exact-key read without printing the file or any other value; whole-file
  digest and metadata/xattr inventory
- Result: exact gate `true`; whole-file SHA-256
  `5eba1e7924f554b0686216b5a4303480b67f9b7a90f524e8803a957fde255748`;
  uid/gid/mode `502/20/0600`; no ACL; sole xattr `com.apple.provenance`
- Provenance: PR #134 comment `5486244042`

### OBS-REC-004 — v6 configuration-surface blind spot

- Subject: v6 gate check and deployed svc-workflow loading path
- Source coordinates: v6 Owner wrapper plus external source
  `mayf3/svc-workflow@f0c74eefd63ca71a1fcb670ad31ac35f19f69539`
- Method: inspect wrapper, launchd WorkingDirectory, and dotenv loading order
- Result: v6 inspected only `launchctl print`; the runtime loads dotenv before
  config and therefore enforced the recorded true value
- Provenance: PR #134 comment `5486244042`

### OBS-REC-005 — Grant and workflow mutation census

- Subject: active `workflow.execute` Grant population and deployment-window
  workflow mutations
- Environment: production read-only data access
- Method: non-secret active-Grant census and read-only events/receipts/attempts
  census
- Result: 185 active `workflow.execute` grants across 98 active principals were
  recorded, with the maximum update predating deployment; no recorded canary or
  real transition occurred in the deployment window
- Provenance: PR #134 comment `5486244042`
- Limitation: the census is time-sensitive and MUST be freshly re-established
  immediately before recovery without selecting secret/hash columns

### OBS-REC-006 — Root-stage provenance object is not yet safely generalized

- Subject: `com.apple.provenance` at the R5 root staging boundary
- Method: compare the R5 failing predicate with the objects named by the new
  required xattr observation table
- Result: the attribute name was observed, but the precise object, value length,
  value bytes/representation, producing step, and propagation path were not all
  frozen by R5
- Provenance: `OBS-REC-001`
- Limitation: attribute-name-only knowledge is insufficient for an allow rule

### OBS-REC-007 — Parent deployment authority coordinates

- Subject: accepted pinned hotfix deployment Authority
- Source revision: merge commit
  `1a9b81de19c2bf4af01f62f6189acffc1bb6839d`
- Method: inspect accepted frontmatter and CTR-HD-003..010
- Result: accepted/contracts/contracts; frozen one-file target/preimage,
  fail-closed gate, role independence, safe deployment, and old-artifact
  rejection remain normative
- Provenance: repository Git object

## 6. Claims and assumptions

### CLM-REC-001 — R5 cannot certify the combined incident as prewrite

- Support state: SUPPORTED
- Supported by: `EVD-REC-001`
- Contradicted by: none
- Uncertainty: the actor responsible for the later mutation is not safely
  attributable; that uncertainty is preserved rather than guessed

### CLM-REC-002 — Current execution is expected to select rollback

- Support state: SUPPORTED
- Supported by: `EVD-REC-002`
- Contradicted by: none at the recorded coordinates
- Uncertainty: execution-time state can drift, so the sealed transaction must
  still implement and freshly evaluate both branches

### CLM-REC-003 — Gate closure must precede Broker rollback

- Support state: SUPPORTED
- Supported by: `EVD-REC-002`, `EVD-REC-003`
- Contradicted by: none
- Uncertainty: failures can leave a controller offline; they must never restore
  the gate to true

### CLM-REC-004 — Attribute-name-only acceptance is unsafe

- Support state: SUPPORTED
- Supported by: `EVD-REC-004`
- Contradicted by: none
- Uncertainty: the exact allowed provenance tuple is a required sealed build
  output, not an open normative choice

### CLM-REC-005 — One deterministic two-branch transaction is required

- Support state: INFERRED
- Supported by: `EVD-REC-001`, `EVD-REC-002`
- Contradicted by: none
- Uncertainty: production can change between build and execution; classification
  at execution time therefore remains mandatory

## 7. Evidence relations

### EVD-REC-001 — R5 stop plus later target contradicts a certified prewrite terminal

- Source observations: `OBS-REC-001`, `OBS-REC-002`
- Target: `STATE-REC-001`, `CLM-REC-001`
- Relation: SUPPORTS
- Coordinates: R5 incident followed by production observation 2026-09-01
- Strength: strong for invalidating the combined `STOPPED_PREWRITE` claim
- Limitation: does not identify the later mutating actor
- Provenance: incident records and PR #134

### EVD-REC-002 — Effective true gate supports rollback selection and ordering

- Source observations: `OBS-REC-003`, `OBS-REC-004`, `OBS-REC-005`
- Target: `STATE-REC-003`, `CLM-REC-002`, `CLM-REC-003`
- Relation: SUPPORTS
- Coordinates: exact dotenv digest and pinned runtime loading path
- Strength: strong; file identity, loading path, and v6 blind spot converge
- Limitation: execution must recheck freshness before mutation
- Provenance: PR #134 comment `5486244042`

### EVD-REC-003 — Accepted parent supports fail-closed rollback boundaries

- Source observations: `OBS-REC-007`
- Target: `CLM-REC-003`
- Relation: SUPPORTS
- Coordinates: accepted Authority merge `1a9b81de...`
- Strength: normative parent authority
- Limitation: this proposed child must still be accepted before use
- Provenance: repository Git object

### EVD-REC-004 — Incomplete R5 provenance record supports exact xattr policy

- Source observations: `OBS-REC-001`, `OBS-REC-006`
- Target: `CLM-REC-004`
- Relation: SUPPORTS
- Coordinates: R5 root staging failure
- Strength: strong for rejecting name-only policy
- Limitation: exact allowed tuple must be generated and sealed by the new build
- Provenance: incident record

## 8. Decisions

### DEC-REC-001 — Preserve R5 as failed and immutable

- Decision owner: mayf3
- Selected direction: `R5_STATUS=FAILED_WITH_UNCERTAIN_TERMINAL`; never retry,
  modify, reseal, or relabel it
- Rejected alternative: retroactively certify R5 as `STOPPED_PREWRITE` or
  `SUCCESS`
- Reason: the production target contradicts a complete prewrite terminal claim

### DEC-REC-002 — Deterministic two-branch reconciliation

- Decision owner: mayf3
- Selected direction: all 23 gates PASS selects forward; any FAIL/UNKNOWN selects
  rollback
- Rejected alternative: Owner intuition, majority gates, or an inferred default
- Reason: production uncertainty must fail closed and remain mechanically
  reproducible

### DEC-REC-003 — Close the write gate first and never reopen it

- Decision owner: mayf3
- Selected direction: rollback stops svc-workflow, performs the exact true-to-
  false edit, and proves the effective false runtime before touching Broker
- Rejected alternative: restore the pre-recovery true gate on any failure
- Reason: false is the accepted safety baseline; failure may leave the service
  offline but MUST NOT make writes reachable

### DEC-REC-004 — Split root-stage and final-target xattr policies

- Decision owner: mayf3
- Selected direction: root-controlled staging may normalize one exact sealed
  provenance tuple; production final metadata must equal the frozen preimage
- Rejected alternative: accept all `com.apple.*`, accept provenance by name, or
  modify the user candidate to make its seal pass
- Reason: staging provenance is an execution-environment artifact, not
  permission to alter final production metadata or candidate identity

### DEC-REC-005 — Native authorization dialog only

- Decision owner: mayf3
- Selected direction: one fixed audited bootstrap via macOS `osascript` with
  administrator privileges after all gates pass
- Rejected alternative: password in chat/stdin/env/file/args/logs, `sudo -S`,
  `expect`, Keychain password extraction, or sudoers bypass
- Reason: the Owner authenticates only to the operating-system authorization UI

### DEC-REC-006 — Exact-head and same-seal role separation

- Decision owner: mayf3
- Selected direction: accepted exact Spec head before build; new Recovery Build;
  two independent same-seal audits; third independent Owner gate; independent
  post-recovery audits
- Rejected alternative: reuse the author/reviewer, audit different seals, or
  treat review recommendation as acceptance
- Reason: semantic, supply, execution, and runtime claims require distinct
  evidence owners

### DEC-REC-007 — Recovery excludes rollout

- Decision owner: mayf3
- Selected direction: no Grant/canary/real transition in recovery; terminal
  recovery routing may only authorize later independent work
- Rejected alternative: use a canary to prove recovery or bundle recovery and
  rollout into one privileged transaction
- Reason: a real transition is an independent production mutation and authority

## 9. Contracts

### CTR-REC-001 — Lifecycle, exact-head, and role gate

This Spec MUST remain `proposed / none / none` in this authoring round. A
candidate MUST NOT be built until the exact final Spec head is independently
reviewed, accepted by an authorized Owner lifecycle transaction, independently
checked for post-review semantic delta, merged to `main`, and re-read from the
exact accepted `main` commit. Review recommendation is not acceptance.

After acceptance, roles MUST be distinct:

```text
Recovery Authority Author
Recovery Authority Reviewer
Recovery Build Agent
Recovery Transaction Reviewer
Production Boundary Reviewer
Release Gate Reviewer
Root Transaction Executor
Post-Recovery Runtime Reviewer
Post-Recovery Boundary Reviewer
```

One person/session MUST NOT satisfy incompatible roles. Any semantic Spec change
invalidates the prior Authority review. Any candidate byte, manifest, stamp,
wrapper, transaction, bootstrap, authorization file, plan, or seal change
invalidates all candidate audits and the Owner gate.

### CTR-REC-002 — Incident truth and old-candidate immutability

The artifact and every receipt MUST record:

```text
R5_STATUS = FAILED_WITH_UNCERTAIN_TERMINAL
R5_STOPPED_PREWRITE_CLAIM = INVALIDATED_BY_COMBINED_INCIDENT
R5_RETRY_ALLOWED = NO
R5_MODIFY_OR_RESEAL_ALLOWED = NO
PRODUCTION_OBSERVED_BLOB = 577c8778cf35810ce7538aff52ab354e0c1dddc6
FROZEN_PREIMAGE_BLOB = 04ca8550fbdaf9b66624dea42701a8a9af7547a8
```

R5/v5/v6 artifacts and receipts are evidence-only and MUST NOT supply commands,
rollback bytes, trusted metadata, success state, or execution authority. A new
candidate MUST have a new ID, private root, manifest, stamp, Owner wrapper,
root transaction, authorization bundle, random root stage, and seal.

### CTR-REC-003 — Exactly 23 forward gates and branch selection

The sealed transaction MUST freshly compute and persist each gate as exactly
`PASS`, `FAIL`, or `UNKNOWN`. Missing, stale, indirect, parse-failed, command-
failed, permission-denied, timeout, or ambiguous evidence is `UNKNOWN`, never
`PASS`.

`FORWARD_RECONCILIATION` is selected if and only if all of the following PASS:

1. production target is a regular file;
2. production target is not a symlink;
3. production target Git blob equals
   `577c8778cf35810ce7538aff52ab354e0c1dddc6`;
4. the current Agent Core runtime is proved to have loaded that target version;
5. Agent Core health is PASS;
6. capability catalog contains `workflow_transition`;
7. manifest count is exactly 15;
8. operation is exactly `submit`;
9. `requiredScopes` is exactly `["workflow.execute"]`;
10. model-facing parameters contain none of `principalId`, `agentId`, `actor`,
    `assignee`, or `idempotencyKey`;
11. trusted transport still generates `Idempotency-Key` and the model cannot
    provide it;
12. the effective svc-workflow write gate is false;
13. fresh Grant census equals the frozen pre-deployment baseline census;
14. svc-workflow config/env has no unauthorized change;
15. no real workflow transition occurred;
16. no real business workflow state changed;
17. the only persistent production runtime-file change relative to the frozen
    deployment preimage is `workflow.js`;
18. no production file outside the one-file allowlist changed;
19. no unknown `.new`, `.restore`, staging, or temporary residue exists;
20. target owner/group/mode/ACL/xattr satisfies the deployed-target contract;
21. no old Broker instance remains;
22. runtime PID, generation, start time, and loaded-byte proof are auditable;
23. R5 remains truthfully recorded as `FAILED_WITH_UNCERTAIN_TERMINAL`, never
    success.

The selector MUST evaluate all gates without production mutation. All PASS
selects forward. Any FAIL/UNKNOWN selects rollback and records the complete gate
vector. If rollback preflight cannot establish its own exact safe inputs, the
transaction emits `MANUAL_RECOVERY_REQUIRED` without falling back to forward.

### CTR-REC-004 — Forward reconciliation branch

Forward reconciliation MUST NOT replace or rewrite `workflow.js`, mutate the
dotenv, restart either service merely to create evidence, modify Grants, run a
canary, or submit a transition. It may only:

- preserve the complete 23-gate evidence and combined incident history;
- clean a mechanically attributed R5 root stage under `CTR-REC-012`;
- create the closed root-owned incident evidence and durable receipt;
- re-read all forward invariants after cleanup;
- record `DEPLOYMENT_STATE=MANUALLY_RECONCILED_FORWARD`,
  `PRODUCTION_CAPABILITY_INSTALLED=YES`, and
  `WORKFLOW_WRITE_ROLLOUT=NOT_AUTHORIZED`.

Any change or uncertainty before terminal receipt invalidates forward and
enters the rollback branch only if rollback preflight remains exact and safe;
otherwise it stops `MANUAL_RECOVERY_REQUIRED`.

### CTR-REC-005 — Rollback branch closes the effective gate first

Before touching Broker, rollback MUST verify the exact unsafe dotenv whole-file
SHA-256 in §3, unique exact gate value `true`, metadata, no ACL, and exact sole
provenance value. It MUST boot out only
`gui/502/com.svc-workflow`, prove the old PID exited, prove the controller
absent, and prove port 8989 has no listener. Any uncertainty stops before the
dotenv write.

It then MUST create one fresh same-directory regular-file non-symlink sibling,
perform only the exact `true` to `false` substitution, verify the full false
postimage digest, preserve uid 502/gid 20/mode 0600/no ACL/exact preimage xattr,
fsync the file, atomically rename it, and fsync the directory. It MUST NOT retain
or output a dotenv preimage copy.

It MUST bootstrap only the pinned svc-workflow plist and prove one new PID,
pinned binary, correct WorkingDirectory, health PASS, and effective gate false.
The proof includes one no-auth, no-retry, no-redirect, two-second maximum probe:

```text
POST http://127.0.0.1:8989/internal/v1/workflow-instances
Content-Type: application/json
Authorization header: absent
body: {}
passing response: HTTP 403 with JSON code canary_read_only
```

Read-only before/after workflow instances, commands, receipts, events, and
transition-attempt censuses MUST be identical. Any failure after controller stop
leaves svc-workflow offline or proven running only with the false gate. Once the
dotenv is false it MUST NEVER be restored to true, including during failure,
rollback, signal handling, recovery resume, or manual-recovery output.

### CTR-REC-006 — Atomic workflow rollback and postflight

Only after `CTR-REC-005` passes may rollback touch `workflow.js`. The recovery
candidate MUST contain newly derived frozen-preimage bytes from the Git object
in §3 and no bytes supplied by an old candidate or receipt.

Before replacement, the transaction MUST durably preserve the current target
bytes plus its SHA-256/Git blob, owner/group/mode, ACL, complete xattr values,
runtime identity, and R5/v6 provenance inside the exact root-owned incident-
evidence path sealed under `ROOT_RECEIPT_ROOT_CLASS`. It MUST fsync and read back
that evidence before proceeding. It MUST NOT preserve the dotenv contents.

Before atomic replacement it MUST prove:

- live target remains regular, non-symlink, and exact target blob/SHA-256;
- replacement temp is regular, non-symlink, has link count one, and exact frozen
  preimage blob/SHA-256;
- owner/group/mode equals the preimage contract (`root:wheel`, `0644`);
- ACL equals `PRODUCTION_PREIMAGE_ACL_POLICY` frozen by the audited manifest;
- xattrs equal `PRODUCTION_PREIMAGE_XATTR_SET` frozen by the audited manifest;
- the temp and target are on the same filesystem;
- no allowlist-external production path changed.

It MUST fsync the replacement, atomically rename it, fsync the target directory,
restart exactly `system/ai.agent-core.runtime`, prove the old PID exited, prove
exactly one new PID/generation/start time, prove runtime-loaded bytes equal the
frozen preimage, prove health PASS, manifest count 14, and catalog absence of
`workflow_transition`.

Success additionally requires effective gate false, unchanged fresh Grant
census, no workflow transition/state delta, final metadata/ACL/xattrs equal the
preimage contract, no old Broker, no unknown residue, and a terminal receipt:

```text
DEPLOYMENT_STATE = ROLLED_BACK_TO_FROZEN_PREIMAGE
PRODUCTION_CAPABILITY_INSTALLED = NO
```

Failure after Broker mutation MUST either converge to the exact healthy frozen
preimage or stop Agent Core and emit `MANUAL_RECOVERY_REQUIRED`; it MUST NOT
silently restore the uncertified target or report success from disk hash alone.

### CTR-REC-007 — New sealed candidate and fixed root bootstrap

The Recovery Build Agent MUST create a fresh user-private 0700 candidate root,
derive every input from pinned source/evidence, and freeze an exact inventory,
file SHA-256 table, semantic stamp, execution plan, authorization plan, and seal.
Candidate files MUST be regular, non-symlink, link-count one, owner uid 502, and
unmodified after seal. User-side and root-side hashes MUST both match the seal.

No privileged command may copy, interpret, expand, or execute content from
`/tmp`. The only privileged bootstrap is the exact inline command sealed with
the candidate. It MUST:

1. set `umask 077` and a closed environment;
2. validate candidate root 0700, regular/non-symlink inputs, ownership, link
   count, absolute paths, and exact seal;
3. create a new unpredictable
   `/var/root/agent-core-transactions/<transaction-id>/` as root:wheel 0700;
4. use a fixed allowlist and `/usr/bin/install` to copy inputs into that root
   stage;
5. re-hash every root-stage copy and revalidate file types/metadata/xattrs;
6. execute only the root-owned audited transaction copy;
7. use no nested sudo, network-fetched command, shell-evaluated dynamic input,
   or user-writable executable after bootstrap;
8. write only the sealed non-secret receipt/evidence paths.

Any bootstrap mismatch stops before production mutation.

### CTR-REC-008 — ROOT_STAGE_XATTR_POLICY

The build and root transaction MUST produce an
`XATTR_OBSERVATION_TABLE` with one row for every actual object category:

```text
staging directory
each staged artifact
extracted workflow.js
deployment temporary sibling
each other created root-stage object
```

Each row MUST record object path/role, creation step, xattr name set, each value
length, exact value bytes as bounded hex or a sealed non-secret digest plus
length, whether the value is expected to propagate, the normalization action,
and the post-normalization set.

The only allowed pre-normalization states are:

1. empty xattr set; or
2. for an explicitly enumerated root-controlled object only, exactly one
   `com.apple.provenance` tuple whose exact value representation and length are
   frozen in the sealed manifest.

Attribute-name-only acceptance is forbidden. `com.apple.quarantine`,
`com.apple.ResourceFork`, resource forks exposed by any other API, any additional
attribute, missing expected provenance, or provenance value/length mismatch is
an immediate stop. Failure or ambiguous output from list/read/delete/readback
xattr commands is an immediate stop.

Normalization may remove only the exact sealed provenance tuple and only from
root-owned staging/temp objects. It MUST verify the empty or expected closed set
afterward. It MUST NOT modify the user candidate, its artifacts, or its seal to
make a check pass.

### CTR-REC-009 — FINAL_TARGET_XATTR_POLICY and metadata equality

The audited manifest MUST independently freeze the original production
preimage owner/group/mode, ACL policy, and complete xattr name/value set from
qualified preimage evidence. If that evidence is unavailable or ambiguous,
rollback MUST stop prewrite.

```text
FINAL_TARGET_OWNER_GROUP_MODE = PRODUCTION_PREIMAGE_OWNER_GROUP_MODE
FINAL_TARGET_ACL              = PRODUCTION_PREIMAGE_ACL_POLICY
FINAL_TARGET_XATTR_SET        = PRODUCTION_PREIMAGE_XATTR_SET
```

The equality is exact, including names, value lengths, and bytes. If the
preimage lacks `com.apple.provenance`, the postimage MUST lack it. A provenance
tuple tolerated and normalized in root staging creates no permission to place
it on the final target. The final temp MUST satisfy the final-target policy
before rename, and the renamed target MUST be re-read afterward.

### CTR-REC-010 — Transaction, concurrency, signal, and partial-write semantics

The transaction MUST use an exclusive transaction lock whose ownership,
process liveness, transaction ID, and seal are mechanically verified. An active
or ambiguous concurrent transaction stops prewrite. All state writes use fresh
same-directory temp files, file fsync, atomic rename, and directory fsync.

A root-owned durable `PRE_RECORD` MUST exist before the first production
mutation. `COMMITTED`, `MANUALLY_RECONCILED_FORWARD`, and
`ROLLED_BACK_TO_FROZEN_PREIMAGE` MUST NOT be written until every branch
postcondition and cleanup check passes.

`INT`, `TERM`, and `HUP` traps MUST cover every window, including before/during/
after xattr observation and normalization, dotenv temp creation/rename,
workflow temp creation/rename, and both service restarts. Fault injection MUST
cover command error, timeout, partial write, truncated output, stale PID,
multiple PID, failed fsync/rename, and lost health/readback proof.

`KILL` is untrappable: on the next authorized invocation, the transaction MUST
reconcile the root-owned `PRE_RECORD`, on-disk bytes, PIDs/controllers, gate,
seal, and temp inventory before any new mutation. It may resume only the same
transaction or contain it as `MANUAL_RECOVERY_REQUIRED`; it MUST NOT start a new
candidate over unresolved state.

### CTR-REC-011 — Durable coordination state and receipts

The coordinator MUST atomically maintain under `GOAL_STATE_ROOT`:

```text
GOAL_STATE.json
EVENTS.jsonl
LAST_HANDOFF.md
REMOTE_WRITES_PENDING.json
reports/
locks/
authorization/
receipts/
```

State must include goal/phase/recovery state, candidate ID/root/seal, accepted
Authority commit, target/preimage/observed blobs, runtime PIDs, role identities,
audits, blockers, next action, Owner action, authorization state, root receipt,
and update time. Writes require file fsync, atomic rename, and directory fsync
where needed.

`GOAL_STATE.json` MUST use at least these explicit fields:

```text
goalName
goalStatus
phase
recoveryState
candidateRound
candidateRoot
candidateSealSha256
authorityMergeCommit
releaseSourceCommit
targetBlob
preimageBlob
productionObservedBlob
runtimePid
activeSubagents
completedAudits
blockers
nextAutomaticAction
ownerActionRequired
authorizationState
rootReceiptPath
lastUpdatedAtUtc
```

Ordinary automatic phases persist `ownerActionRequired=NONE`. Network or remote
write failure MUST persist the pending operation in
`REMOTE_WRITES_PENDING.json`, use bounded retries, and MUST NOT broaden into a
production action. Owner notification is closed to GUI authorization
unavailability, authorization cancellation/failure, `MANUAL_RECOVERY_REQUIRED`,
an Authority/production fact conflict that cannot be mechanically decided,
later canary prerequisites missing, or Goal completion.

The root receipt and combined log MUST be non-secret and bind transaction ID,
accepted Spec commit, candidate seal, branch/gate vector, all input/output
digests, metadata/ACL/xattr tables, mutation boundaries, PIDs, health, censuses,
cleanup, and terminal state. Stdout alone is never authoritative. Missing,
malformed, digest-mismatched, or non-terminal receipt means
`MANUAL_RECOVERY_REQUIRED`.

Recovery receipt terminals are closed to `STOPPED_PREWRITE`,
`MANUALLY_RECONCILED_FORWARD`, `ROLLED_BACK_VERIFIED`, and
`MANUAL_RECOVERY_REQUIRED`; `ROLLED_BACK_VERIFIED` maps only to
`DEPLOYMENT_STATE=ROLLED_BACK_TO_FROZEN_PREIMAGE`. `COMMITTED` is forbidden for
this recovery candidate and is reserved for a later independently sealed
deployment transaction. Authorization cancellation occurs before root execution
and is persisted as coordinator state `AUTHORIZATION_NOT_GRANTED`, not forged as
a root receipt.

### CTR-REC-012 — Cleanup and old R5 root stage

Success and handled failure MUST remove every new root-stage object and both
same-directory replacement temps, then prove zero new residue. Signal/crash
reconciliation MUST complete the same cleanup before a later transaction.

The old R5 root stage MUST NOT be manually deleted or reused. The sealed root
transaction may remove it only after mechanically proving all of:

- exact R5 transaction ID/path binding from durable evidence;
- root ownership, expected type, and no symlink/hardlink escape;
- complete expected inventory and digests;
- no active process/lock uses it;
- realpath remains inside the exact R5 root-stage root;
- no unexpected entry or xattr outside the exact recorded R5 inventory exists.

If attribution is absent or ambiguous, leave the old stage untouched, record
the blocker, and return `MANUAL_RECOVERY_REQUIRED`; never broaden a deletion
target or use a recursive unresolved path.

### CTR-REC-013 — macOS authorization-dialog-only execution

Before creating an authorization request the coordinator MUST mechanically
prove:

```text
OWNER_INTERACTION_MODE = MACOS_AUTHORIZATION_DIALOG_ONLY
PRIVILEGE_BROKER = /usr/bin/osascript
CHAT_SUDO_CONFIRMATION_REQUIRED = NO
CONSOLE_USER = yanfenma
CONSOLE_UID = 502
AGENT_EXECUTION_USER = yanfenma
GUI_SESSION_AVAILABLE = YES
/usr/bin/osascript = executable
```

It MUST prove `/dev/console` ownership and that execution is not from authsvc, a
root daemon, SSH-only context, or another session. Failure yields
`AUTHORIZATION_UI_UNAVAILABLE` with no password fallback and no production
mutation.

Only after both same-seal audits and the independent Release Gate Reviewer emit
`OWNER_GATE=ACCEPT` and `READY_FOR_OWNER_EXECUTION=YES` may the coordinator
create sealed `AUTH_REQUEST.json`, `AUTH_LAUNCH.applescript`,
`AUTH_LAUNCH.sha256`, `ROOT_BOOTSTRAP.sh`, and `ROOT_BOOTSTRAP.sha256` under the
private authorization directory and synchronously invoke `/usr/bin/osascript`.

The AppleScript may execute only one literal
`do shell script <FIXED_AUDITED_BOOTSTRAP_COMMAND> with administrator privileges`
binding the seal and exact paths. Password material is forbidden in chat,
stdin, environment, file, command arguments, AppleScript, logs, Keychain
automation, or agent-visible input/output. `sudo -S`, `expect`, sudoers changes,
and repeated prompt loops are forbidden.

The coordinator MUST NOT ask the Owner to paste a command, reply `continue`, or
report `executed`; the native authorization dialog is the only normal
interaction for this privileged transaction.

Cancellation or authentication failure yields
`AUTHORIZATION_NOT_GRANTED`, persists the state, performs no production write,
and is not automatically retried. The terminal transaction result is derived
from the verified root receipt, never inferred from `osascript` stdout/status.
After the synchronous invocation begins, the coordinator MUST persist
`AUTH_DIALOG_REQUESTED=YES`, wait for completion, and validate the receipt's
transaction ID and digest before choosing any next action.

### CTR-REC-014 — Grant, canary, and real-transition exclusion

Immediately before and after every branch, independent read-only censuses MUST
prove:

- Grant population/digest unchanged, without selecting or outputting secret or
  secret-hash columns;
- no canary identity/allowlist change;
- no real transition command, receipt, event, attempt audit, or business
  workflow-state delta;
- no credential, principal, role, or auth-service mutation;
- effective write gate false at every successful terminal state.

For forward gate 13, the frozen pre-deployment Grant baseline MUST be a
canonical, sorted, non-secret row projection plus digest, with the recorded
185-row/98-principal counts and maximum-update-time relation as cross-checks;
counts alone do not pass. If that exact baseline cannot be retrieved and
recomputed, gate 13 is `UNKNOWN` and forward is forbidden. For rollback, the
same canonical projection is captured immediately before recovery and MUST be
byte-for-byte/digest identical afterward; rollback never attempts to restore or
edit Grant rows.

The one unauthenticated negative guard probe in `CTR-REC-005` is not a canary and
must produce zero database delta. Any forbidden delta yields
`MANUAL_RECOVERY_REQUIRED`; the artifact MUST NOT attempt to repair it by
deleting records or changing Grants.

### CTR-REC-015 — Same-seal audits, gate review, and post-recovery audit

After build, two new independent reviewers run in parallel against the exact
same candidate seal:

```text
Recovery Transaction Reviewer
Production Boundary Reviewer
```

Both MUST verify branch mutual exclusion, all 23 gates, current expected
rollback selection, R5 truth, rollback source, xattr/ACL policy, bootstrap,
signals/faults/partial writes, receipts, cleanup, exclusions, and seal-to-script
identity. Any `REVISE` rejects that candidate; a new Recovery Build Agent must
create a new candidate/seal.

Only two PASS results allow a third independent Release Gate Reviewer to bind
the same seal. Only `OWNER_GATE=ACCEPT` plus
`READY_FOR_OWNER_EXECUTION=YES` allows authorization.

After execution, new independent Runtime and Boundary Reviewers MUST verify the
root receipt, selected branch, runtime-loaded bytes, both services, health,
catalog/inventory, effective false gate, unchanged Grant census, zero workflow
mutation, metadata/xattrs, and residue. No recovery terminal is promoted to a
milestone before both post-recovery reviews PASS.

### CTR-REC-016 — Terminal routing and successor work

Forward success ends recovery as `MANUALLY_RECONCILED_FORWARD`; rollback success
ends recovery as `ROLLED_BACK_TO_FROZEN_PREIMAGE`. Recovery itself MUST NOT run a
canary.

After forward success, any canary requires a separate accepted canary Authority,
dedicated test workflow, existing lawful Grant identity, audited write-gate
operation, separate seal/audits/Owner authorization, exactly one transition,
and safe gate/allowlist restoration.

After rollback success, any workflow-transition redeployment MUST use a new
candidate under the accepted parent Authority, with new provenance and the
xattr/fault lessons in this Spec. R5/v5/v6 and this recovery candidate MUST NOT
be repurposed as the deployment candidate. Redeployment requires its own
build, supply audit, deployment audit, gate review, authorization, execution,
and post-deployment audits.

### CTR-REC-017 — Authoring boundary

This amendment MUST change only this proposed Spec. It MUST remain Draft,
docs-only, and lifecycle-neutral. It MUST NOT modify an accepted parent, product
code, test code, artifact, production, service, Grant, credential, workflow
data, or external repository. Governance integrity, structure, frontmatter,
Contract/Acceptance coverage, diff hygiene, docs-only scope, and secret scan
must pass before push.

## 10. Acceptance

### ACC-REC-001 — Exact-head lifecycle and role independence

- Contracts: `CTR-REC-001`
- Method: inspect PR/merge topology, exact Spec commits, acceptance record,
  task/session identities, and candidate audit identities
- Environment: clean detached worktrees plus persistent PR records
- Required evidence: reviewed head, final accepted head, merge commit, main
  readback, role matrix, and semantic-delta verdict
- Expected result: no build before accepted main; all incompatible roles are
  independent
- Failure condition: acceptance is inferred, reviewed bytes changed, build
  precedes accepted main, or a role is improperly reused

### ACC-REC-002 — R5 truth and old-artifact rejection

- Contracts: `CTR-REC-002`
- Method: inspect every manifest/stamp/receipt and run adversarial old-receipt/
  old-artifact fixtures
- Environment: isolated candidate harness
- Required evidence: unique candidate identities, provenance graph, and receipt
  field-use trace
- Expected result: R5 remains failed/uncertain; no old input supplies authority
  or bytes
- Failure condition: R5 is retried/changed/resealed/relabelled or any old object
  influences execution

### ACC-REC-003 — Twenty-three-gate branch matrix

- Contracts: `CTR-REC-003`
- Method: one all-PASS fixture plus at least one independent FAIL and UNKNOWN
  fixture for each of the 23 gates; truncate/timeout/permission-error parsers
- Environment: isolated production-tree/controller/database mocks
- Required evidence: 47 or more complete gate vectors, branch decisions, exit
  codes, zero-predecision-write census, and terminal receipts
- Expected result: only 23/23 PASS selects forward; every FAIL/UNKNOWN selects
  rollback; unsafe rollback preflight stops manual-recovery, never forward
- Failure condition: omitted gate, short-circuit without a persisted vector,
  ambiguous evidence passes, or a non-all-PASS vector selects forward

### ACC-REC-004 — Forward reconciliation behavior

- Contracts: `CTR-REC-004`
- Method: all-PASS forward fixture plus drift injected before terminal receipt
- Environment: sealed harness with target catalog/inventory/runtime mocks
- Required evidence: file/controller mutation trace, incident evidence, cleanup,
  and receipt
- Expected result: no workflow/env replacement or restart; only closed evidence
  and attributable-stage cleanup; exact forward terminal
- Failure condition: any forbidden mutation, premature terminal, lost R5 truth,
  or forward survives drift

### ACC-REC-005 — Safe gate closure and false-runtime proof

- Contracts: `CTR-REC-005`
- Method: positive exact true-to-false fixture and faults at every stop/edit/
  fsync/rename/bootstrap/PID/health/probe/census boundary
- Environment: isolated copied dotenv with mocked launchctl/listener/service/DB
- Required evidence: whole-file pre/post digests, redacted one-key diff,
  metadata/ACL/xattrs, PIDs, listener state, exact request/response, database
  zero delta, temp absence, and receipt
- Expected result: old true-gate process cannot serve before edit; success proves
  one false-gate process; failures are offline or proven false; gate never true
- Failure condition: other dotenv bytes leak/change, true gate returns, an
  unproved process remains, non-403 passes, row delta occurs, or temp survives

### ACC-REC-006 — Atomic frozen-preimage rollback and postflight

- Contracts: `CTR-REC-006`
- Method: positive rollback plus source/target/temp/metadata/restart/load-proof/
  health/catalog/inventory tamper matrix
- Environment: same-filesystem isolated production tree and controller mocks;
  authorized production postflight only after all prior gates
- Required evidence: exact blobs/SHA-256, fsync/rename trace, old/new PIDs,
  runtime-loaded proof, health, 14-manifest enumeration, catalog, census,
  metadata, xattrs, residue, and receipt
- Expected result: exact healthy preimage, count 14, capability absent, gate
  false, no workflow/Grant delta
- Failure condition: disk hash substitutes for load proof, target is restored,
  service ambiguity passes, metadata differs, or success is premature

### ACC-REC-007 — Seal, bootstrap, and fixed allowlist

- Contracts: `CTR-REC-007`
- Method: candidate/root-side hash comparison and adversarial path/type/owner/
  mode/link/archive/environment/bootstrap fixtures
- Environment: user-private candidate and synthetic root staging tree
- Required evidence: inventory, stamp, seal, bootstrap literal, root-copy hashes,
  allowlist trace, and zero production writes on rejection
- Expected result: only exact sealed inputs enter a new root-owned stage and only
  root-owned audited code executes
- Failure condition: `/tmp` use, user-writable privileged execution, dynamic
  command injection, old stage reuse, hash drift, or allowlist escape

### ACC-REC-008 — Root-stage xattr regression matrix

- Contracts: `CTR-REC-008`
- Method: execute all cases A-M below on macOS-capable isolated fixtures
- Environment: fresh user candidate and fresh root-owned staging per case
- Required evidence: complete `XATTR_OBSERVATION_TABLE`, commands, outputs,
  exit codes, propagation trace, PRE_RECORD, receipt, cleanup, and target census
- Expected result: only empty or the exact sealed provenance tuple is
  normalizable on root-controlled objects; every other case fails closed
- Failure condition: name-only acceptance, unread attribute, failed deletion,
  propagation to final target, or any unknown attribute passes

```text
A. root staging has no xattr
B. root staging has only the exact allowed com.apple.provenance tuple
C. provenance value or length mismatches
D. staging has an unknown xattr
E. staging has com.apple.quarantine
F. staging has a resource fork / com.apple.ResourceFork
G. provenance propagates to deployment temp
H. provenance propagates to final target
I. xattr list/read fails
J. xattr deletion/normalization/readback fails
K. rollback restores exact preimage xattr set
L. success and handled failure leave zero new temp/root-stage residue
M. INT/TERM/HUP occurs in every xattr observation/normalization window;
   KILL is reconciled on the next same-transaction invocation
```

Every A-M case MUST also prove: prewrite failure does not touch production;
post-mutation failure reaches the safe containment defined by this Spec; a
terminal receipt exists (or is durably reconstructed from `PRE_RECORD` after
KILL); `PRE_RECORD` is recoverable; no success terminal is early; the gate is
never restored true; and any final production target exactly satisfies the
preimage metadata contract.

### ACC-REC-009 — Final target ACL/xattr equality

- Contracts: `CTR-REC-009`
- Method: preimage policy fixtures spanning empty/provenance/other permitted
  preimage sets plus injected staging provenance and readback failures
- Environment: isolated same-filesystem target/temp
- Required evidence: preimage manifest, temp inventory, post-rename inventory,
  byte-for-byte xattr value comparisons, ACL comparison, and receipt
- Expected result: final metadata equals preimage exactly; no staging-only
  provenance leaks
- Failure condition: any name/value/length/ACL/mode difference or unavailable
  preimage evidence passes

### ACC-REC-010 — Concurrency, signal, fault, and partial-write recovery

- Contracts: `CTR-REC-010`
- Method: concurrent-lock fixtures; INT/TERM/HUP at every named window; KILL and
  restart reconciliation; partial/truncated write, fsync, rename, PID, timeout,
  and readback failures
- Environment: isolated filesystem and service mocks
- Required evidence: lock ownership, PRE_RECORD sequence, on-disk states,
  controller states, cleanup, resume decision, and terminal receipt
- Expected result: no overlapping transaction, no early success, safe gate,
  exact target or stopped service, and deterministic same-transaction recovery
- Failure condition: new transaction starts over unresolved state, receipt lies,
  target is ambiguous while service runs, or gate becomes true

### ACC-REC-011 — Goal state and durable receipt integrity

- Contracts: `CTR-REC-011`
- Method: crash each atomic state write, corrupt/truncate receipt fields, mismatch
  transaction/seal, and restart a coordinator without chat context
- Environment: isolated goal-state and receipt roots
- Required evidence: fsync/rename trace, recovered state, receipt validation,
  redaction scan, and next-action decision
- Expected result: coordinator resumes from durable state; malformed/missing
  receipt yields manual recovery; no secret appears
- Failure condition: chat is required to recover truth, stdout alone determines
  success, or a corrupt receipt passes

### ACC-REC-012 — New-temp and R5-stage cleanup

- Contracts: `CTR-REC-012`
- Method: exact-attribution, absent-stage, altered-entry, symlink/hardlink,
  unexpected-xattr, live-lock, realpath-escape, and signal fixtures
- Environment: synthetic root transaction trees
- Required evidence: attribution chain, lstat/realpath/inventory/digest/xattr/
  liveness checks, deletion trace, and residue census
- Expected result: exact attributable stage is removed only by audited root
  transaction; ambiguous stage remains and stops; all new temps are cleaned
- Failure condition: manual/broad deletion, old stage reuse, unresolved recursive
  target, or unrecorded residue

### ACC-REC-013 — Authorization-only interaction

- Contracts: `CTR-REC-013`
- Method: GUI/session precondition fixtures, AppleScript/bootstrap inspection,
  cancelled-dialog fixture, auth-failure fixture, and secret-channel scan
- Environment: macOS UI test harness without a real password
- Required evidence: console/uid/session checks, exact sealed files/command,
  invocation count, filesystem/process delta, and redaction scan
- Expected result: only one native dialog after gate acceptance; cancellation is
  no-op; no password is agent-visible; no fallback or retry loop
- Failure condition: dialog before gate, missing GUI bypass, password channel,
  dynamic command, write on cancel, or automatic repeated prompt

### ACC-REC-014 — Forbidden-change census

- Contracts: `CTR-REC-014`
- Method: before/after filesystem, controller, auth/Grant/role/principal,
  allowlist, and workflow database census for both branches and every failure
- Environment: artifact harness then authorized production read-only audit
- Required evidence: exact allowed diffs, non-secret census digest, negative
  guard probe delta, controller trace, and terminal gate proof
- Expected result: no Grant/canary/credential/role/principal/real-transition
  mutation; gate false on success; forward uses the exact retrievable
  pre-deployment Grant baseline rather than count-only evidence
- Failure condition: forbidden delta, count-only Grant evidence passes, or the
  artifact attempts to repair a forbidden delta

### ACC-REC-015 — Same-seal pre/post audit chain

- Contracts: `CTR-REC-015`
- Method: compare reviewer identities, candidate seals, script hashes, verdicts,
  Owner gate, authorization request, root receipt, and post-recovery reports
- Environment: persistent PR/task records plus sealed artifact roots
- Required evidence: one seal across both audits/gate/execution, independent
  identities, PASS verdicts, and post-recovery reports
- Expected result: no authorization before three exact-seal approvals; no
  milestone before two post-recovery PASS results
- Failure condition: mixed seal, reused role, skipped review, stale verdict, or
  post-recovery result inferred from executor output

### ACC-REC-016 — Terminal routing and no recovery canary

- Contracts: `CTR-REC-016`
- Method: exercise both success terminals and inspect all automatically selected
  next actions
- Environment: coordinator state-machine fixtures
- Required evidence: terminal receipt, next-task record, candidate identity
  separation, and command census
- Expected result: recovery ends before canary; rollback routes only to a fresh
  deployment chain; forward routes canary only through separate Authority
- Failure condition: canary or redeploy runs inside recovery, or any old/recovery
  candidate becomes deployment supply

### ACC-REC-017 — Docs-only authoring checks

- Contracts: `CTR-REC-017`
- Method: governance verifier, structure verifier against PR base, frontmatter
  schema, required sections and stable IDs, Contract/Acceptance bidirectional
  coverage, `git diff --check`, docs-only diff, and secret-pattern scan
- Environment: clean isolated worktree at the exact PR head
- Required evidence: commands, exit codes, diff scope, and remote-head pins
- Expected result: all checks PASS; exactly this one proposed Spec changes; PR
  remains Draft; lifecycle fields remain none
- Failure condition: any checker fails, another path changes, a secret/env line
  leaks, remote head drifts, or lifecycle/PR state changes

### Contract / Acceptance bidirectional coverage

| Contract | Acceptance coverage |
|---|---|
| CTR-REC-001 | ACC-REC-001 |
| CTR-REC-002 | ACC-REC-002 |
| CTR-REC-003 | ACC-REC-003 |
| CTR-REC-004 | ACC-REC-004 |
| CTR-REC-005 | ACC-REC-005 |
| CTR-REC-006 | ACC-REC-006 |
| CTR-REC-007 | ACC-REC-007 |
| CTR-REC-008 | ACC-REC-008 |
| CTR-REC-009 | ACC-REC-009 |
| CTR-REC-010 | ACC-REC-010 |
| CTR-REC-011 | ACC-REC-011 |
| CTR-REC-012 | ACC-REC-012 |
| CTR-REC-013 | ACC-REC-013 |
| CTR-REC-014 | ACC-REC-014 |
| CTR-REC-015 | ACC-REC-015 |
| CTR-REC-016 | ACC-REC-016 |
| CTR-REC-017 | ACC-REC-017 |

Every active Contract has executable or explicitly production-qualified
Acceptance coverage, and every Acceptance item resolves to its listed Contract.
No Contract is accepted by a test definition alone; executed results must bind
the candidate seal, environment, time, and evidence provenance.

## 11. Alternatives and disposition

### ALT-REC-001 — Retry, modify, or reseal R5

Rejected permanently. R5 is failed with an uncertain terminal and its audit
chain cannot be repaired in place. Reopening would require new evidence that
mechanically proves the complete original transaction and absence of later
mutation; current evidence contradicts that premise.

### ALT-REC-002 — Declare R5 stopped prewrite and ignore the target blob

Rejected. The later target blob makes that a false combined-incident statement
and would erase uncertainty instead of recovering it.

### ALT-REC-003 — Forward reconcile on partial or unknown gates

Rejected. Only 23/23 PASS is forward-safe. Owner intuition, a majority, or a
disk-only target hash cannot substitute for runtime/config/data evidence.

### ALT-REC-004 — Always rollback without implementing forward

Rejected. The recovery candidate must remain deterministic if execution-time
state is already independently proven safe; omitting forward would leave a
hidden manual branch and encourage ad hoc operator choice.

### ALT-REC-005 — Fix only the write gate

Rejected. It leaves an uncertified Broker mutation in place without satisfying
all forward gates or returning to the frozen preimage.

### ALT-REC-006 — Roll back Broker before closing the gate

Rejected. An effective true write gate remains an unsafe failure interval; the
gate must be false and running proof complete first.

### ALT-REC-007 — Restore gate=true on failure

Rejected permanently. True is the unsafe incident state, not a rollback target.
Offline or proven false is the only failure-safe controller posture.

### ALT-REC-008 — Accept all `com.apple.*` or provenance by name

Rejected. It admits quarantine/resource forks/unknown metadata and fails to bind
value, length, object, origin, or propagation.

### ALT-REC-009 — Strip xattrs from the user candidate before hashing

Rejected. It changes audited input to evade its seal. Normalization is confined
to exact root-controlled staging/temp objects after root-side re-hash.

### ALT-REC-010 — Manually delete or reuse the R5 root stage

Rejected. Attribution and deletion must be performed by the audited root
transaction; ambiguity remains a manual-recovery blocker, not permission to
broaden deletion.

### ALT-REC-011 — Chat-based sudo or password automation

Rejected. Owner authentication occurs only in the native macOS authorization
dialog after exact-seal gates; cancellation is terminal and non-mutating.

### ALT-REC-012 — Bundle canary or Grant changes into recovery

Rejected. Recovery proves a safe baseline; rollout is a separate Authority and
production mutation.

## 12. Migration, compatibility, and rollback

This is incident recovery, not a product or schema migration. Forward
reconciliation preserves the exact target runtime only after all 23 gates pass.
Rollback restores the exact frozen preimage capability inventory and maintains
svc-workflow binary compatibility while closing its write gate.

There is no rollback from false to true. After the dotenv edit, any failure
keeps the file false and leaves svc-workflow either offline or proven running
false. After Broker mutation, failure converges to the exact preimage or stops
Agent Core for manual recovery. No failure path restores the uncertified target
as a hidden success.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

Execution-time evidence values such as PID, generation, fresh Grant census,
preimage ACL/xattr bytes, exact provenance tuple, and random transaction ID are
required sealed build/execution outputs, not open policy choices. Missing or
ambiguous values fail closed under the Contracts above.

## 14. Authoring result

```text
SPEC_GOVERNANCE_MODE        = AUTHOR
SPEC_ID                     = AGENT_CORE_WORKFLOW_TRANSITION_DEPLOYMENT_RECOVERY_V1
SPEC_KIND                   = implementation
STATUS                      = proposed
AUTHORITY_LEVEL             = governing_spec
IMPLEMENTATION_AUTHORITY    = none
PRODUCTION_APPLY_AUTHORITY  = none
PRIMARY_PARENT_AUTHORITY    = AGENT_CORE_WORKFLOW_TRANSITION_PINNED_HOTFIX_DEPLOYMENT_V1
EXTERNAL_AUTHORITIES        = NONE (svc-workflow is a pinned dependency/evidence coordinate only)
OPEN_OWNER_DECISIONS        = NONE
NORMATIVE_TBD               = NONE
PARTIAL_SUPERSESSION        = NONE
CONTRACT_COUNT              = 17
CONTRACTS_WITH_ACCEPTANCE   = 17
AUTHORING_READY_FOR_REVIEW  = YES, subject to §16 mechanical checks
```

This result is an authoring claim, not review, acceptance, implementation,
execution, or conformance.

## 15. Authority acceptance transaction

The only activation path is:

1. This docs-only authoring revision remains proposed on Draft PR #134.
2. A new independent Recovery Authority Reviewer binds the exact base, head,
   Spec blob/SHA-256, parent accepted revisions, all primitive IDs, all 17
   Contracts, all 17 Acceptance items, the 23 gates, and this amendment's
   semantic delta, then returns `ACCEPT` or `REVISE` in a persistent PR record.
3. `REVISE` returns to a new authoring revision; no build or authorization is
   allowed.
4. Only after `ACCEPT`, mayf3 or an explicitly authorized maintainer performs
   one docs-only lifecycle commit on this one file: `status: proposed →
   accepted`, `implementation_authority: none → contracts`,
   `production_apply_authority: none → contracts`, plus an acceptance record
   binding the reviewed head, reviewer identity/verdict, time, final head, and
   `SEMANTIC_DELTA_AFTER_REVIEW`.
5. A different independent Reviewer checks the exact lifecycle final head. Any
   semantic delta beyond the reviewed text invalidates acceptance and returns
   to authoring.
6. The Owner merges only the accepted exact final head to `main` and reads back
   the merged Spec blob. The accepted main commit becomes
   `RECOVERY_AUTHORITY_COMMIT`.
7. Only then may a new Recovery Build Agent start `CTR-REC-007`. Acceptance does
   not itself authorize `osascript` or production mutation; those still require
   the same-seal audit and gate chain in `CTR-REC-015`.

The authoring Agent, semantic Reviewer, acceptance actor, final-head Reviewer,
build Agent, candidate Reviewers, gate Reviewer, executor, and post-recovery
Reviewers remain distinct as required by `CTR-REC-001`.

## 16. Authoring verification record

The final commit may be pushed only after the remote PR head is still the exact
expected pre-authoring head and the following checks pass in the isolated
worktree:

```text
vendored governance integrity
frontmatter schema
required Spec sections and stable primitive IDs
Contract -> Acceptance coverage = 17/17
Acceptance -> Contract coverage = 17/17
repository structure verifier against PR base
git diff --check
docs-only one-file diff
secret/env-content scan
Draft PR state
```

The executed command results and final commit identity belong in the persistent
PR/authoring handoff. They do not change this proposal's lifecycle.
