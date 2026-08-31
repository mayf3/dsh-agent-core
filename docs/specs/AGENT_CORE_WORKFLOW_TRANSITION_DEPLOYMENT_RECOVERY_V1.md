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
  - production workflow_transition deployment recovery
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

> **PROPOSED / NOT ACCEPTED.** This docs-only authoring transaction records a
> production deployment precondition failure discovered after v6 reported
> `OWNER_DEPLOY=PASS`. It does not itself authorize a production write, service
> reload, rollback, canary, Grant, credential, or allowlist change. Until an
> independent review passes and the Owner accepts the exact reviewed head,
> `implementation_authority` and `production_apply_authority` remain `none`.

## 1. Goal

Restore the fail-closed production baseline required by
`AGENT_CORE_WORKFLOW_TRANSITION_PINNED_HOTFIX_DEPLOYMENT_V1#CTR-HD-005` after the
v6 bootstrap inspected only the launchd job environment and therefore missed
the effective dotenv value `AUTH_V1_CANARY_WRITE_ENABLED=true`.

The recovery outcome is intentionally conservative:

1. make the effective svc-workflow write gate false and prove that the running
   process enforces `canary_read_only` before authentication;
2. restore the Broker `workflow.js` exact preimage and prove
   `workflow_transition` absent;
3. preserve complete recovery evidence; and
4. require a newly built and independently audited successor artifact before
   any later redeployment.

## 2. Scope and non-goals

In scope after exact-head acceptance and a separately audited recovery artifact:

- one exact-key change in
  `/Users/yanfenma/.local/services/svc-workflow/.env`:
  `AUTH_V1_CANARY_WRITE_ENABLED=true` to `false`;
- one fail-safe stop/bootstrap cycle of `gui/502/com.svc-workflow` so no old
  process can continue serving with the previously loaded true value;
- one exact rollback of
  `/usr/local/libexec/agent-core/app/packages/broker/src/capabilities/workflow.js`
  from deployed target SHA-256
  `d162670d64227613bf5c8004fc8491a296f62835722f3bdcde7ddc4131890f8e`
  to preimage SHA-256
  `ca27f3a8a1a34f09858988edb57e892ebdb2a98d7ceb755f0eab252a9641a93e`;
- one restart of `system/ai.agent-core.runtime`;
- read-only/negative postflight probes and the following closed operational
  output classes: one root-sealed recovery bundle whose exact inventory is
  frozen by the independently audited artifact manifest; one root-only JSON
  receipt under
  `/usr/local/libexec/agent-core/.deploy-receipts/workflow-transition-deployment-recovery-v1/`;
  and one mode-0600 combined stdout/stderr log under
  `/Users/yanfenma/workspace/deployment-logs/`.

The runtime mutation allowlist is exactly the dotenv file and `workflow.js`.
An audited artifact MAY additionally use one same-directory temporary sibling
for each atomic replacement, but both temporary files MUST be fresh, exact-name
bound by the artifact, and absent at every terminal state. No dotenv preimage
copy may remain on disk.

Non-goals:

- no workflow instance create, transition, cancellation, archive, or other
  state-changing workflow request;
- no canary; no Grant, credential, allowlist, role, or principal mutation;
- no product-code change and no source-repository implementation;
- no restoration or modification of v5 or v6 artifacts;
- no automatic redeployment after recovery.

## 3. Authority and dependencies

This is a `NEW` recovery authority. It does not amend or supersede its parents.
It enforces the already accepted fail-closed requirement after operational
evidence showed that v6's check did not observe the service's effective dotenv
configuration.

Pinned source and runtime coordinates:

```text
DSH_AUTHORITY_BASE              = 433b8bd06a163badae322da9db012b9851e148b6
DEPLOYMENT_AUTHORITY            = AGENT_CORE_WORKFLOW_TRANSITION_PINNED_HOTFIX_DEPLOYMENT_V1
DEPLOYED_ARTIFACT_ID            = workflow-transition-final-f4bc431-v6-20260831T222936Z
DEPLOYMENT_LOG_SHA256           = 5744e56c6def57138e618469703d3a5fd7020dc3e7866c332128bac8dce95d8e
DEPLOYMENT_RECEIPT              = /usr/local/libexec/agent-core/.deploy-receipts/workflow-transition-final-f4bc431-v6/deploy-20260831T230903Z-83319.json
DEPLOYMENT_RECEIPT_TRUST        = PROVENANCE_ONLY_NOT_A_ROLLBACK_TRUST_ANCHOR
TARGET_WORKFLOW_SHA256          = d162670d64227613bf5c8004fc8491a296f62835722f3bdcde7ddc4131890f8e
TARGET_WORKFLOW_GIT_BLOB        = 577c8778cf35810ce7538aff52ab354e0c1dddc6
PREIMAGE_WORKFLOW_SHA256        = ca27f3a8a1a34f09858988edb57e892ebdb2a98d7ceb755f0eab252a9641a93e
PREIMAGE_WORKFLOW_GIT_BLOB      = 04ca8550fbdaf9b66624dea42701a8a9af7547a8
PREIMAGE_ARCHIVE                = /Users/yanfenma/workspace/deployment-artifacts/workflow-transition-final-f4bc431-v6-20260831T222936Z/rollback/rollback-preimage-04ca8550.tar
PREIMAGE_ARCHIVE_SHA256         = 0857f9431309e9e1f8d6f400f5d74dfc46bf7e0cc9d50e46598f4b35a36ac785
SVC_WORKFLOW_CONTROLLER         = gui/502/com.svc-workflow
BROKER_CONTROLLER               = system/ai.agent-core.runtime
SVC_WORKFLOW_ENV_PRE_SHA256     = 5eba1e7924f554b0686216b5a4303480b67f9b7a90f524e8803a957fde255748
SVC_WORKFLOW_ENV_POST_SHA256    = 3b8d266c62b96ba2e701549d9498e829c3af885d2ace7e6a371dd35aa290167a
SVC_WORKFLOW_ENV_PRE_SIZE       = 531
SVC_WORKFLOW_ENV_POST_SIZE      = 532
SVC_WORKFLOW_ENV_METADATA       = regular;uid=502;gid=20;mode=0600;ACL=none
SVC_WORKFLOW_ENV_XATTRS         = exactly com.apple.provenance
SVC_WORKFLOW_PROVENANCE_HEX_SHA = e6be2a51db86e14d2c2d62856a05db6294590e572c98109f004ac17a6cee2819
SVC_WORKFLOW_PLIST_SHA256       = b1a22e7004e251edf3472158abb5b1ec88b8e4c82c63faa80f91f23dd5909c95
SVC_WORKFLOW_DEPLOYED_SOURCE    = f0c74eefd63ca71a1fcb670ad31ac35f19f69539
SVC_WORKFLOW_BINARY_SHA256      = 4e633634b313f8c926ccaf7da07f3bfd9dbf25f024a4b63a3f0a88c5a0200356
```

Any coordinate mismatch stops before the first write. Acceptance of this Spec
would authorize only building and independently auditing a recovery artifact.
Production execution remains a distinct Owner action using the macOS native
administrator authorization dialog.

`svc-workflow@f0c74eefd63ca71a1fcb670ad31ac35f19f69539` is a pinned
**external runtime dependency and evidence coordinate only**. This repository
does not accept, amend, supersede, or redefine svc-workflow authority and does
not authorize a svc-workflow product-code change. If the deployed external
source/binary/config-loading behavior drifts from these pins, recovery stops and
returns to cross-repository authority review.

## 4. Current State

### STATE-REC-001 — Broker contains the uncertified v6 target

On production at `2026-09-01T07:09:05+08:00`, Broker `workflow.js` is the v6
target (SHA-256 `d162670d64227613bf5c8004fc8491a296f62835722f3bdcde7ddc4131890f8e`,
root:wheel 0644, 20,058 bytes), and Broker PID `83440` is healthy. Basis:
`OBS-REC-001`.

### STATE-REC-002 — svc-workflow loads a true gate from dotenv

The live svc-workflow process PID `48822` starts from WorkingDirectory
`/Users/yanfenma/.local/services/svc-workflow`; its source invokes
`dotenvy::dotenv()` before config loading. The dotenv file has
`AUTH_V1_CANARY_WRITE_ENABLED=true` and both identity allowlist keys absent.
Basis: `OBS-REC-002`, `OBS-REC-003`, `CLM-REC-001`.

### STATE-REC-003 — v6 observed the wrong configuration surface

v6 logged `WRITE_GATE=PASS:DEFAULT_FALSE_ABSENT` because its gate function
greps `launchctl print gui/502/com.svc-workflow`; that output contains
launchd-injected variables but not variables loaded by the child process from
dotenv. Basis: `OBS-REC-004`, `EVD-REC-001`.

### STATE-REC-004 — The absent allowlist leaves a broad granted population

Active auth-service data has 185 active `workflow.execute` grants across 98
active principals; the selected CTR-009 identity is among them, while
svc-workflow's two per-identity allowlists are absent. Basis: `OBS-REC-005`,
`OBS-REC-006`, `CLM-REC-002`.

## 5. Observations

### OBS-REC-001 — Deployed Broker target and health

- Subject: production Broker runtime and workflow capability file
- Source revision: v6 receipt `deploy-20260831T230903Z-83319.json`
- Environment: local production host, observed 2026-09-01
- Method: SHA-256/stat, `launchctl print system/ai.agent-core.runtime`, and
  `GET http://127.0.0.1:8790/health`
- Result: exact target SHA-256
  `d162670d64227613bf5c8004fc8491a296f62835722f3bdcde7ddc4131890f8e`,
  root:wheel 0644, PID `83440`,
  health response successful
- Provenance: v6 execution log and persistent PR evidence comment `5486244042`

### OBS-REC-002 — Effective dotenv gate source

- Subject: production svc-workflow configuration file
- Source revision: file SHA-256 `5eba1e79...`, modified
  `2026-08-11T09:19:06+08:00`
- Environment: `/Users/yanfenma/.local/services/svc-workflow/.env`
- Method: exact-key read only; no full-file or credential output
- Result: `AUTH_V1_CANARY_WRITE_ENABLED=true`; `AUTH_V1_CANARY_ALLOWED_SUB`
  absent; `AUTH_V1_CANARY_ALLOWED_CLIENT_ID` absent; metadata uid 502/gid 20/0600
- Provenance: persistent PR evidence comment `5486244042`

### OBS-REC-003 — svc-workflow dotenv loading path

- Subject: deployed controller and svc-workflow startup source
- Source revision: deployed binary provenance
  `f0c74eefd63ca71a1fcb670ad31ac35f19f69539`, binary SHA-256
  `4e633634b313f8c926ccaf7da07f3bfd9dbf25f024a4b63a3f0a88c5a0200356`
- Environment: `gui/502/com.svc-workflow`, PID `48822`
- Method: launchctl/plist inspection and source read
- Result: launchd WorkingDirectory is the dotenv directory; `main.rs` calls
  `dotenvy::dotenv()` before `HttpConfig::from_env()`; health on port 8989 passes
- Provenance: persistent PR evidence comment `5486244042` and pinned
  svc-workflow source

### OBS-REC-004 — v6 gate-check blind spot

- Subject: exact v6 `OWNER_DEPLOY.sh` and deployment log
- Source revision: Owner deploy SHA-256
  `24ab7226840351cab95998af783390612ab1b6e635448effe0d66dba6b3ae541`
- Environment: v6 root-sealed production execution
- Method: inspect `check_write_gate_false()` and complete saved output
- Result: the function uses only `launchctl print`; the log reports absent and
  proceeds to `OWNER_DEPLOY=PASS` although OBS-REC-002 predates the execution
- Provenance: v6 artifact, log SHA-256
  `5744e56c6def57138e618469703d3a5fd7020dc3e7866c332128bac8dce95d8e`, and persistent PR
  evidence comment `5486244042`

### OBS-REC-005 — Current workflow.execute census

- Subject: active auth-service machine access grants for audience svc-workflow
- Source revision: live read-only database snapshot, observed 2026-09-01
- Environment: production `agent_dev_center`, `auth_ro`
- Method: SELECT active, non-revoked principals/clients/grants only
- Result: 185 grants, 98 distinct active principals; no secret/hash selected
- Provenance: persistent PR evidence comment `5486244042`

### OBS-REC-006 — Independent deployment audit failed

- Subject: v6 production deployment at exact log/artifact coordinates
- Source revision: dsh authority base `433b8bd06a163badae322da9db012b9851e148b6`
- Environment: independent clean audit worktree plus production read-only probes
- Method: artifact/log/source/runtime/config/database cross-check by an Agent
  independent of deployment execution
- Result: `部署审计=FAIL`, Blocker 2, High/Medium/Low 0; effective gate true
  and hard-coded false receipt field; canary readiness NO
- Provenance: independent `部署 审计` result delivered 2026-09-01 and preserved
  by PR comments `5486244042` and `5486223166`

## 6. Claims and assumptions

### CLM-REC-001 — The effective write gate was true during v6 deployment

- Support state: SUPPORTED
- Supported by evidence: `EVD-REC-001`
- Contradicted by evidence: none; v6's absent result inspected a different source
- Uncertainty: none material for the observed single production controller

### CLM-REC-002 — Leaving the deployment in place cannot satisfy fail-closed audit

- Support state: SUPPORTED
- Supported by evidence: `EVD-REC-002`
- Contradicted by evidence: none known
- Uncertainty: direct callers' current activity was not inspected and is not
  required to establish the violated precondition

### CLM-REC-003 — Recovery must close the gate before Broker rollback

- Support state: SUPPORTED
- Supported by evidence: `EVD-REC-003`
- Contradicted by evidence: none known
- Uncertainty: a failed Broker rollback may require Owner intervention, but the
  gate can and must remain false in that failure state

## 7. Evidence relations

### EVD-REC-001 — Effective-config evidence supports the gate Claim

- Source observations: `OBS-REC-002`, `OBS-REC-003`, `OBS-REC-004`
- Target: `CLM-REC-001`
- Relation: SUPPORTS
- Bound coordinates: production controller PID `48822`, dotenv SHA-256
  `5eba1e7924f554b0686216b5a4303480b67f9b7a90f524e8803a957fde255748`,
  v6 log SHA-256
  `5744e56c6def57138e618469703d3a5fd7020dc3e7866c332128bac8dce95d8e`
- Strength/sufficiency: strong; source loading path, file value, and artifact
  blind spot converge
- Limitations: does not prove any unauthorized write occurred
- Provenance: the three source observations

### EVD-REC-002 — Gate and grant census support fail-closed recovery

- Source observations: `OBS-REC-001`, `OBS-REC-002`, `OBS-REC-005`
- Target: `CLM-REC-002`
- Relation: SUPPORTS
- Bound coordinates: production observed 2026-09-01
- Strength/sufficiency: strong for the deployment precondition
- Limitations: does not authorize a Grant change
- Provenance: the three source observations

### EVD-REC-003 — Failure minimization supports recovery order

- Source observations: `OBS-REC-001`, `OBS-REC-002`, `OBS-REC-003`
- Target: `CLM-REC-003`
- Relation: SUPPORTS
- Bound coordinates: the two exact production controllers and paths
- Strength/sufficiency: strong for ordering
- Limitations: operational execution still needs exact-artifact audit and Owner
  authorization
- Provenance: the three source observations

## 8. Decisions

### DEC-REC-001 — Restore both violated dimensions

- Decision owner: mayf3
- Decision: recovery first unloads svc-workflow and proves the old process and
  listener absent, then changes the effective gate to false and bootstraps a
  new process, and only after the exact 403 proof restores the Broker preimage.
- Rejected alternative: leave the target deployed and merely fix the checker.
- Reason: the user's deployment STOP condition was false at execution time, so
  the resulting production state is not certifiable as an authorized deploy.

### DEC-REC-002 — Effective dotenv is authoritative for this controller

- Decision owner: mayf3
- Decision: checks MUST resolve the launchd WorkingDirectory and read the exact
  dotenv key that the running binary loads; launchd environment absence alone
  MUST NOT be interpreted as the default.
- Rejected alternative: continue treating `launchctl print` as complete config.
- Reason: OBS-REC-002..004 prove that model is incomplete.

### DEC-REC-003 — Recovery is fail-safe and non-expanding

- Decision owner: mayf3
- Decision: after svc-workflow is unloaded, any failure before proven restart
  leaves it offline; any failure after the false dotenv replacement leaves the
  file false. A failed/ambiguous new process or probe is booted out again. The
  transaction stops for Owner intervention and MUST NOT reopen the gate.
- Rejected alternative: attempt to restore the pre-recovery `true` value.
- Reason: false is the accepted safety baseline.

## 9. Contracts

### CTR-REC-001 — Exact prewrite binding

The recovery artifact MUST verify every path, SHA-256, owner/group/mode, process
controller, current PID, service health, target file, dotenv preimage, plist,
external binary/source, and rollback archive named in this Spec. It MUST verify
the archive has exactly one regular `workflow.js` member with the frozen
preimage size/SHA-256/Git blob before any production write. The v6 deployment
receipt is evidence-only: its `write_gate` and overall PASS semantics MUST NOT
be trusted, and it MUST NOT select or authorize the rollback source. Any
mismatch MUST stop before writing.

### CTR-REC-002 — Native Owner authorization

Production execution MUST be launched through the macOS native administrator
authorization dialog. The agent MUST NOT obtain, store, transmit, log, or fill
the Owner password. Cancellation MUST produce `OWNER_RECOVERY=CANCELLED` and no
write.

### CTR-REC-003 — Exact dotenv repair

Only after the pre-edit stop phase of `CTR-REC-004` has proved the old
svc-workflow process and listener absent, the artifact MUST create one fresh
same-directory temporary sibling and
change only the unique exact line `AUTH_V1_CANARY_WRITE_ENABLED=true` to exactly
`AUTH_V1_CANARY_WRITE_ENABLED=false`. The temp MUST equal the pinned postimage
SHA-256 `3b8d266c62b96ba2e701549d9498e829c3af885d2ace7e6a371dd35aa290167a`
and size 532 before atomic rename. Every other byte, uid 502, gid 20, mode 0600,
no ACL, and the exact `com.apple.provenance` xattr value MUST be preserved.
Missing, duplicate, already-different, symlink, xattr, digest, or metadata
mismatch MUST stop while svc-workflow remains offline. The temporary sibling
MUST be absent at every terminal state.

### CTR-REC-004 — Effective gate proof

Before the first configuration write, the artifact MUST boot out exactly
`gui/502/com.svc-workflow` using the pinned plist, prove the old PID exited,
prove the controller absent, and prove port 8989 has no listener. Failure to
prove all four conditions MUST stop before modifying dotenv.

After `CTR-REC-003`, the artifact MUST bootstrap exactly the pinned plist and
prove exactly one new PID healthy on port 8989 with the effective dotenv
postimage. It MUST then issue exactly one probe with no retry, no redirect, a
two-second maximum timeout, no `Authorization` header, method `POST`, URL
`http://127.0.0.1:8989/internal/v1/workflow-instances`, header
`Content-Type: application/json`, and body `{}`. Before/after read-only database
census of instances, commands, receipts, events, and transition-attempt audits
MUST be identical. The only passing response is HTTP 403 with JSON code
`canary_read_only`.

If bootstrap, PID, health, config, probe, or zero-delta proof fails or is
ambiguous, the artifact MUST boot out the new controller, prove its PID and
listener absent, leave dotenv false, emit the exact failed stage, and stop
before Broker rollback. With no credential and an invalid empty request, the
probe cannot reach a write handler whether the gate is false (403 at middleware)
or unexpectedly true (authentication/body rejection); database zero-delta is
still mandatory evidence rather than an assumption.

### CTR-REC-005 — Exact Broker rollback

Only after `CTR-REC-004` passes, the artifact MUST restore exact preimage
`ca27f3a8a1a34f09858988edb57e892ebdb2a98d7ceb755f0eab252a9641a93e`
from a new root-sealed recovery bundle containing the exact one-member archive
SHA-256 `0857f9431309e9e1f8d6f400f5d74dfc46bf7e0cc9d50e46598f4b35a36ac785`.
The source archive is selected by the
new audited recovery manifest, never by the v6 receipt. It MUST NOT accept any
other live target, archive, member, or preimage identity.

### CTR-REC-006 — Broker postflight

The artifact MUST restart only `system/ai.agent-core.runtime`, prove the old PID
exited and exactly one new PID is healthy, enumerate exactly 14 manifests, and
prove `workflow_transition` absent. Any ambiguity is failure.

### CTR-REC-007 — Durable evidence and failure semantics

Complete stdout/stderr and machine-readable receipts MUST record preimages,
postimages, PIDs, health, negative gate probe, manifest inventory, and final
status. Durable writes are closed to exactly: the new root-sealed recovery
bundle at the exact path/inventory/digests frozen by the audited artifact; one
root:wheel 0600 JSON receipt in the path class frozen in §2; and one uid-502/gid-20
0600 combined log in the path class frozen in §2. The artifact manifest MUST
resolve the exact three paths before audit. No dotenv preimage copy is retained.
After controller stop, any later failure MUST leave svc-workflow offline or
running only after the false-gate proof, and MUST leave the dotenv false once
replaced; the exact manual-intervention stage is durable and no automatic reopen
is allowed.

### CTR-REC-008 — Scope closure

The artifact MUST NOT change Grants, credentials, allowlists, roles, principals,
workflow rows, source repositories, or any file outside the two runtime paths,
three durable operational-output paths, and two fresh ephemeral temp paths
closed by §2/CTR-REC-007 and the audited artifact manifest. Both temps MUST be
absent at every terminal state. It MUST NOT run a canary or a real
`workflow_transition`.

### CTR-REC-009 — Successor requirement

After successful recovery, v5 and v6 are `NOT_DEPLOYABLE`. Any subsequent
workflow-transition deployment MUST use a new immutable artifact whose gate
check reads the effective dotenv source and which passes a different independent
artifact audit before another Owner deployment authorization.

## 10. Acceptance

### ACC-REC-001 — Prewrite mismatch matrix

- Contracts: `CTR-REC-001`
- Method: fixture matrix covering every pinned path/digest/metadata/controller/
  PID/health/archive/member mismatch plus adversarial v6 receipt fields
- Environment: isolated temporary filesystem and mocked launchctl/curl
- Required evidence: executed matrix, commands, exit codes, and zero-write proof
- Expected result: every trusted-input mismatch stops before write; arbitrary
  receipt status/write_gate/backup fields never select a source or change outcome
- Failure condition: any mismatch reaches a write primitive or any receipt field
  is used as rollback authority

### ACC-REC-002 — Password opacity and cancellation

- Contracts: `CTR-REC-002`
- Method: inspect invocation and run a cancelled-dialog fixture
- Environment: macOS test harness without a real password
- Required evidence: command path, captured output, filesystem scan
- Expected result: native dialog only; password absent; cancellation is no-op
- Failure condition: password reaches agent-visible input/output or a write occurs

### ACC-REC-003 — Exact dotenv edit

- Contracts: `CTR-REC-003`
- Method: positive and negative byte/metadata fixtures
- Environment: isolated copied dotenv file
- Required evidence: full-file pre/post digests and sizes, unique-line count,
  byte-level redacted diff, stat/ACL/xattr inventory and xattr-value digest,
  temp-path absence
- Expected result: exact preimage becomes exact postimage, only the one value
  changes, metadata/xattr are exact, and no temp remains
- Failure condition: any other byte or metadata changes, wrong postimage passes,
  edit occurs while the old process/listener exists, or a temp survives

### ACC-REC-004 — Effective gate stop/bootstrap proof

- Contracts: `CTR-REC-004`
- Method: controller stop/edit/bootstrap fixture, fault injection at every
  boundary, and the exact frozen negative HTTP probe; production replay only
  during authorized Owner recovery
- Environment: mocked service for artifact audit, production for final audit
- Required evidence: bootout target/plist, old/new PID, listener absence/presence,
  health, effective config, exact request transcript, HTTP status/body, database
  before/after counts, and failure-state controller posture
- Expected result: old service is offline before edit; success yields one new
  healthy PID, exact 403 `canary_read_only`, and zero workflow row delta; every
  injected failure leaves svc-workflow offline and never running with true gate
- Failure condition: edit while old service can run; 401/other response; row
  delta; ambiguous PID/listener; unhealthy service; or a failure leaves a live
  unproved process

### ACC-REC-005 — Exact rollback identity

- Contracts: `CTR-REC-005`
- Method: archive/member/target tamper matrix, malicious receipt variants, and
  successful isolated rollback
- Environment: sealed temporary root tree
- Required evidence: exact archive/member hashes, Git blobs, metadata, sealed
  manifest inventory, and exit codes
- Expected result: only exact target-to-preimage transition from the new sealed
  recovery bundle succeeds; receipt variants have no effect
- Failure condition: alternate target/archive/member is accepted or v6 receipt
  selects the source

### ACC-REC-006 — Broker postflight

- Contracts: `CTR-REC-006`
- Method: mocked restart convergence plus production postflight
- Environment: isolated harness then production
- Required evidence: PIDs, health, manifest enumeration JSON
- Expected result: count 14 and `workflow_transition` absent
- Failure condition: wrong count, capability present, or runtime ambiguity

### ACC-REC-007 — Failure and receipt behavior

- Contracts: `CTR-REC-007`
- Method: fault injection at every stage after gate closure
- Environment: isolated harness
- Required evidence: full transcripts, exact bundle/log/receipt inventories,
  temp cleanup, controller posture, and final gate value
- Expected result: only the closed outputs persist; gate never reopens; failure
  is offline or proven-false; exact intervention stage is durable
- Failure condition: unlisted output, retained dotenv preimage/temp, gate reopens,
  live unproved controller, evidence truncates, or failure is reported pass

### ACC-REC-008 — Forbidden-change census

- Contracts: `CTR-REC-008`
- Method: before/after filesystem, auth, role, and workflow database census
- Environment: artifact harness and production read-only audit
- Required evidence: scoped runtime diffs, exact operational-output inventory,
  temp absence, controller action log, and zero workflow command/event delta
- Expected result: exactly two runtime paths differ, exactly three audited
  operational-output paths exist, no temp remains, and only the two named
  controller actions occurred
- Failure condition: any unlisted path/action or any Grant/credential/allowlist/
  role/workflow/source change

### ACC-REC-009 — Artifact retirement

- Contracts: `CTR-REC-009`
- Method: artifact manifest and successor preflight inspection
- Environment: deployment-artifacts directory and independent audit worktree
- Required evidence: v5/v6 status records and successor effective-dotenv tests
- Expected result: v5/v6 rejected; only a new audited successor may proceed
- Failure condition: v5/v6 is retried or successor repeats the blind spot

## 11. Alternatives and disposition

### ALT-REC-001 — Keep v6 deployed and only set the gate false

Rejected because it would retroactively excuse a failed precondition and blur
audit truth.

### ALT-REC-002 — Roll back Broker only

Rejected because the effective service write gate would remain open.

### ALT-REC-003 — Revoke all 185 Grants

Rejected as a massive auth-service scope expansion; this recovery changes no
Grant.

### ALT-REC-004 — Add an allowlist during recovery

Rejected; allowlist selection belongs to the later independent canary authority.

## 12. Migration, compatibility, and rollback

This transaction is recovery, not migration. The Broker returns to its exact
pre-deployment capability inventory. svc-workflow remains binary-compatible and
changes only from effective write-enabled to fail-closed write-disabled.

There is deliberately no rollback to `write_enabled=true`. svc-workflow is
booted out before the dotenv edit. If any subsequent stage fails, it remains
offline unless the new process has completed the exact false-gate proof; if the
dotenv edit has occurred, the exact false postimage remains. Owner intervention
is required. No durable or temporary pre-recovery dotenv copy is retained.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

Owner acceptance is still required because this is proposed. After independent
review, acceptance MUST bind the exact final head and may flip
`implementation_authority` and `production_apply_authority` from `none` to
`contracts` in a lifecycle-only transaction. Only then may a recovery artifact
be built and independently audited.
