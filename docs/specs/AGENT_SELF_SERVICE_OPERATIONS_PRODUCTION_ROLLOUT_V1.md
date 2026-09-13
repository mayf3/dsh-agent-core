---
spec_id: AGENT_SELF_SERVICE_OPERATIONS_PRODUCTION_ROLLOUT_V1
status: proposed
date: 2026-09-13
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
scope:
  - narrow production release authority for merged self_ops V1
  - exact target-lineage and mixed-generation closure gates
  - fresh effect-free canary and HR Feishu dogfood
governed_by:
  - AGENT_SELF_SERVICE_OPERATIONS_CONTROL_PLANE_V1
  - SCHEDULER_OCCURRENCE_OUTCOME_V3
  - SCHEDULER_TIMEOUT_OUTCOME_V3
  - AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V3
external_authorities: []
supersedes: []
superseded_by: null
references:
  - docs/investigations/AGENT_SELF_SERVICE_OPERATIONS_PRODUCTION_ROLLOUT_CENSUS_V1.md
owners:
  - mayf3
---

# AGENT_SELF_SERVICE_OPERATIONS_PRODUCTION_ROLLOUT_V1

> Proposed only. This document currently authorizes no code, merge, sudo, restart, production write,
> Scheduler mutation, Grant change, Feishu message, or HR incident repair.

## 0. Authoring result

```text
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = NEW
SPEC_ID = AGENT_SELF_SERVICE_OPERATIONS_PRODUCTION_ROLLOUT_V1
STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none
PRIMARY_PARENT_AUTHORITY = AGENT_SELF_SERVICE_OPERATIONS_CONTROL_PLANE_V1
EXTERNAL_AUTHORITIES = NONE
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
DOCS_FIRST_REQUIRED = YES
OPEN_OWNER_DECISIONS = NONE (accept/reject lifecycle action is not a normative TBD)
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
CONTRACT_COUNT = 10 (CTR-ROL-000..009)
CONTRACTS_WITH_ACCEPTANCE = 10
ACCEPTANCE_COUNT = 7 (ACC-ROL-001..007)
AUTHORING_READY_FOR_REVIEW = YES
READY_FOR_ACCEPTANCE = NO_UNTIL_INDEPENDENT_EXACT_HEAD_PASS
NEXT_ACTION = INDEPENDENT_EXACT_HEAD_REVIEW
```

## 1. Goal

Define the staged authority and acceptance contracts for a bounded deployment of the already merged
`self_ops(status|reconcile_turn)` capability and the existing caller-owned Scheduler controls, followed by a
fresh effect-free canary and real HR Feishu dogfood. First acceptance authorizes release-vehicle implementation
only; it does not authorize production apply. A later exact-manifest Execution Mandate is required before one
apply attempt. The release must make the actual HR ingress lineage load the capability without activating
unrelated current-main features or weakening any identity, ownership, termination-proof, disabled-domain, or
unknown-business-outcome invariant.

## 2. Scope and exclusions

In scope:

- a narrow, sealed production candidate based on the exact 16-file release seed in the census;
- one minimal compose integration derived from the exact live compose preimage;
- exact target runtime/store/connector/HR binding proof;
- single-writer stop/drain, preimage capture, apply, readback, health, catalog, negative security checks;
- one fresh effect-free current-epoch reconciliation canary;
- the exact HR Feishu dogfood phrase and authoritative post-state evidence.

Out of scope:

- full current-main install or unrelated Workflow Execution/history/voice/model-route activation;
- `trigger_once`, runtime reload, cancellation, kill, raw store/fence editing, or a second Scheduler;
- model-supplied principal/PID/Router handle, run-as/OBO, foreign Agent access, or Grant/credential changes;
- enabling any disabled Workflow domain, deleting history, or guessing canonical jobs by title/payload/time;
- interpreting termination proof as business success/failure/zero side effects;
- any Workflow instance mutation or global Workflow-pool drain under this authority.

## 3. Authority coordinates

```text
PROGRAM_AUTHORITY = AGENT_SELF_SERVICE_OPERATIONS_CONTROL_PLANE_V1 accepted
PRODUCT_IMPLEMENTATION_REVIEWED_HEAD = 62905c1055b3d2c2459b346711f5c5aa4253001f
PRODUCT_IMPLEMENTATION_MERGE = 447becfcfce708b128959b01596cf491f3fa9a60
PRODUCT_IMPLEMENTATION_PR = 278 MERGED
CURRENT_SPEC_STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none
OWNER_EXACT_HEAD_ACCEPTANCE = REQUIRED
INDEPENDENT_EXACT_HEAD_REVIEW = REQUIRED
FIRST_ACCEPTANCE_TRANSITION = status:accepted, implementation_authority:contracts,
                              production_apply_authority:none
PRODUCTION_EXECUTION_MANDATE = separate exact-manifest Owner-attributable accepted authority
HR_DOGFOOD_EXECUTION_MANDATE = separate post-canary exact-sample Owner-attributable accepted authority
```

This is a new deployment-preparation authority. It does not amend product semantics. Until its metadata is
atomically changed by an Owner-authorized acceptance transaction, every implementation and mutation gate
remains closed. Its first accepted state keeps production apply closed.

The two-stage lifecycle is frozen normatively by CTR-ROL-000 in §9.

### Lifecycle projection

The only permitted first acceptance transition is:

```text
status: proposed -> accepted
implementation_authority: none -> contracts
production_apply_authority: none -> none
```

The same acceptance-only transaction may add only these provenance fields and matching banner/final-output
facts: `accepted_date`, `accepted_by`, `accepted_at`, `accepted_reviewed_head`,
`independent_review_result`, `independent_review_blockers`, `acceptance_verdict`, and
`acceptance_authority_basis`. It may not alter contracts, scope, release construction, files, matrix, or
production authority. Any semantic change requires a new independent exact-head review before acceptance.
It may also update only the lifecycle projections in §0, §3, §11, and the README Spec navigation row so they
say `accepted`, `implementation_authority: contracts`, `production_apply_authority: none`, the exact accepted
head, and the next implementation action. No other normative byte is in the lifecycle-only allowlist.

That transition authorizes only the release vehicle, minimal compose integration, tests, sealed candidate,
and draft runbook. Their implementation PR must not edit this governing Spec. After merge, an independent
exact-head audit must close the full matrix in §10.

Production apply then requires a separate accepted `AGENT_SELF_SERVICE_OPERATIONS_PRODUCTION_EXECUTION_V1`
mandate. That mandate must pin: this accepted Spec revision; release-vehicle and minimal-compose commits;
sealed manifest and rollback digests; exact current preimage vector; target host/runtime/store/connector/HR
binding; actor; UTC window; `MAX_ATTEMPTS=1`; abort criteria; V3 rollback boundary; and the exact post-apply
readback/canary sequence. It must also bind the admission-paused verification start and the separate
post-verification activation step in ACC-ROL-004. Its `production_apply_authority: contracts` applies only to
that one generation and expires atomically when ACC-ROL-007 records the immutable canary sample, or immediately
on abort, preimage drift, unknown outcome, or window end.

Only after ACC-ROL-007 has produced the exact `CANARY_SAMPLE_ID` and occurrence coordinates may an
Owner-attributable accepted `AGENT_SELF_SERVICE_OPERATIONS_HR_DOGFOOD_EXECUTION_V1` mandate be created. That
separate one-attempt mandate must pin the trusted HR caller, exact phrase, unchanged `CANARY_SAMPLE_ID`, exact
owned non-critical job and occurrence coordinates, target host/runtime/connector/store binding, exact runtime
epoch and deployed generation, locked-current critical-inventory digest, UTC `valid_from`/`expires_at`,
at-most-once action bounds, abort conditions, and immutable receipts. Before sending the phrase, the
mandate-bound executor must perform a read-only authoritative validity gate; after the phrase, HR must repeat
the same gate through formal read-only tools immediately before each mutation. Both gates fail closed unless
the window is live and every pinned environment, generation, epoch, target, ownership, and inventory coordinate
remains exact. Expiry or any drift invalidates the mandate before mutation and permits no retry. This is an
execution gate and adds no tool argument or product surface. It grants mutation authority only to HR through
the formal self-service tools; the deployment operator receives no dogfood mutation authority. HR dogfood
remains a subsequent distinct evidence gate; neither implementation merge, apply, activation, nor canary
availability implies dogfood PASS.

## 4. Current State

### STATE-DEP-001 — Source complete, live absent

At reviewed source `62905c1` / merge `447becf`, V1 product code is merged and independently audited. At the
exact read-only observation in the referenced Census, three required files are absent from the trusted live
tree and the live Runtime source remains V2; protected store contents were not read. Basis: OBS-DEP-001 and
EVD-DEP-001.

### STATE-DEP-002 — Production is a mixed generation

The candidate boot graph has 140 reachable local files and 37 candidate/live differences, including unrelated
features. The 16-file seed is separately exact: 13 live files equal the review base and three new files are
absent in both review base and live. Basis: OBS-DEP-002 and EVD-DEP-002.

### STATE-DEP-003 — HR target lineage is unresolved

Three Runtime lineages and more than one Feishu-capable connector surface exist. The system authsvc Runtime is
only the leading hypothesis; the exact HR connector/runtime/store/trusted-binding chain is not yet proved.
Basis: OBS-DEP-003 and EVD-DEP-003.

## 5. Observations

### OBS-DEP-001

- Subject/revision/environment/time/method/result: Census STATE/OBS-ROL-001 and §1–§3, incorporated by
  reference without upgrading its evidence-only authority.
- Result: source merged, live feature absent, production apply authority absent.

### OBS-DEP-002

- Subject/revision/environment/time/method/result: Census STATE/OBS-ROL-002 and per-path table.
- Result: full candidate is too broad; exact 16-file reviewed delta plus one live-derived compose transform is
  the bounded candidate construction.

### OBS-DEP-003

- Subject/revision/environment/time/method/result: Census STATE/OBS-ROL-003 and lineage table.
- Result: target proof is open and requires trusted-boundary readback; plist key presence is not identity or
  binding proof.

## 6. Claims and assumptions

### CLM-DEP-001 — Narrow overlay is necessary and sufficient for candidate preparation

- Support state: SUPPORTED for preparation, UNPROVED for production behavior.
- Supported by: EVD-DEP-001 and EVD-DEP-002.
- Claim: the 16 reviewed delta paths plus one constrained live-compose transform are the maximum authorized
  implementation surface; closure/boot/matrix proof is still mandatory before any execution mandate.

### CLM-DEP-002 — Production target cannot be inferred from process names

- Support state: SUPPORTED.
- Supported by: EVD-DEP-003.
- Claim: only the exact Feishu binding → connector → Runtime → store chain can select the production target.

### ASM-DEP-001 — Live preimage remains stable until an apply lock

- State: UNVERIFIED and never relied upon.
- Treatment: every observed blob/process fact is re-read under the future lock; any drift invalidates the
  generation and requires re-census/re-review.

## 7. Evidence relations

### EVD-DEP-001

- Source: Census OBS-ROL-001. Target: STATE-DEP-001, CLM-DEP-001. Relation: SUPPORTS.
- Sufficiency: exact source/live seed equality at the recorded timestamp.
- Limitation: no runtime load or store content proof.

### EVD-DEP-002

- Source: Census OBS-ROL-002. Target: STATE-DEP-002, CLM-DEP-001. Relation: SUPPORTS.
- Sufficiency: exact boot reachability/difference count and exact per-seed blob relation.
- Limitation: future minimal compose and release vehicle remain to be implemented and audited.

### EVD-DEP-003

- Source: Census OBS-ROL-003. Target: STATE-DEP-003, CLM-DEP-002. Relation: SUPPORTS_WITH_LIMITATION.
- Sufficiency: exact for visible process/plist/log facts.
- Limitation: protected target binding/store/log remain unreadable to developer uid; target remains OPEN.

## 8. Decisions

### DEC-DEP-001 — Separate preparation acceptance from production execution

First acceptance grants only the exact four-file implementation closure; a separately accepted exact-manifest,
one-attempt Execution Mandate grants production apply. Produces CTR-ROL-000 and CTR-ROL-003.

### DEC-DEP-002 — Preserve live generation outside the reviewed delta

Use exact reviewed seed bytes and a deterministic minimal transform of the exact live compose. Never overlay
the whole candidate tree or candidate compose. Produces CTR-ROL-001 and CTR-ROL-002.

### DEC-DEP-003 — Bind target and serialize the sole writer

No apply until HR lineage is exact and the target is drained with one store writer. Produces CTR-ROL-004 and
CTR-ROL-005.

### DEC-DEP-004 — V3 is an irreversible semantic boundary

Before any V3 commit, exact generation rollback is allowed; after any V3 document/evidence commit, only
V3-aware forward-fix is allowed. Produces CTR-ROL-006 and CTR-ROL-007.

### DEC-DEP-005 — Real canary and HR dogfood are distinct terminal gates

One current-epoch effect-free canary precedes the exact HR Feishu dogfood. Neither apply nor health implies
either PASS. Produces CTR-ROL-008 and CTR-ROL-009.

## 9. Contracts

### CTR-ROL-000 — Two-stage lifecycle

The only permitted first acceptance transition and lifecycle-only provenance/projection allowlist are exactly
those stated in §3. The transition authorizes only the exact implementation closure in CTR-ROL-001 and keeps
production apply `none`. Production requires the separate exact one-attempt Execution Mandate described in
§3 for apply/verification/activation/canary. After the exact sample exists, HR dogfood requires the separate
accepted one-attempt dogfood Execution Mandate described in §3; it remains a later distinct evidence gate and
grants no mutation authority to the deployment operator.

### Contract group — frozen release construction

### CTR-ROL-001 — Source pin

Every source byte in the 16-file release seed must equal its Git blob at `62905c1`. The deployment branch may
add only:

1. one minimal compose candidate created from the exact observed live compose blob
   `940c21653303b70df782c82a125809edca2b37a1`; and
2. a transactional release vehicle plus tests/evidence required by this Spec.

The compose candidate may only import `mountSchedulerSelfServiceRuntime`, replace the existing inline
`selfServiceSchedulerAccess` mount with that shared mount, and preserve every other live behavior byte-for-byte
apart from mechanically necessary adjacent formatting. It must not mount history or Workflow Execution.

For each of the 13 seed paths present in live, the expected preimage is the exact corresponding blob at
implementation review base `e01ea3494d0b382bab0fbf636fdd55a590d2bfdc`. The remaining three seed paths are
`ABSENT` in both live and the review base. This makes the seed overlay mechanically identical to the reviewed
implementation delta. Any changed preimage, including a legitimate later deployment, invalidates this
candidate and requires re-census/re-review rather than three-way patching during apply.

The exact repository implementation closure authorized by the first acceptance is:

```text
packages/production-runtime/src/scheduler/self-ops-production-release.js
packages/production-runtime/test/scheduler/self-ops-production-release.test.js
docs/runbooks/self-ops-production-rollout-v1.md
docs/reports/self-ops-production-rollout-v1.md
```

The first file is the only builder/operator entrypoint and owns the deterministic live-compose transform. Its
only generated compose destination inside a sealed generation is
`packages/production-runtime/src/compose.js`; it must never rewrite the repository compose. The report is a
PENDING template until an authorized execution fills exact receipts. No `scripts/**`, package manifest/bin,
barrel, registry, product source, accepted authority, or other path may change in the implementation PR.
The production overlay target set is exactly the 16 seed paths plus that one generated compose path. The
deployment module, test, runbook, and report are control/evidence artifacts and must never be installed into
the trusted app target.

The frozen invocation grammar is:

```text
node packages/production-runtime/src/scheduler/self-ops-production-release.js \
  <prepare|seal|verify|apply|rollback-pre-v3|receipt> \
  --generation <absolute-generation-directory> \
  --repo <absolute-clean-source-root> \
  --live-root <absolute-live-root> \
  [--execution-mandate <absolute-accepted-mandate-file>]
```

`prepare|seal|verify` may target only an isolated generation/live copy. `apply|rollback-pre-v3|receipt` must
fail closed unless the exact accepted Execution Mandate, root actor, target lock, manifest, preimage, and
attempt window all match. No other subcommand, implicit default, environment-selected target, or interactive
fallback exists.

### CTR-ROL-002 — Candidate closure

Before sealing, construct `LIVE_COPY + NARROW_OVERLAY` and prove:

- all relative imports resolve transitively from `scripts/production-runtime.mjs`;
- every named import exists in the selected target module;
- all 16 reviewed source blobs match and no extra candidate-source path is overlaid;
- the compose preimage matches exactly and the compose diff is limited to CTR-ROL-001;
- a trusted-Node isolated boot remains healthy for at least 60 seconds on isolated ports and root;
- the catalog contains `self_ops` exactly once with only `status|reconcile_turn`;
- existing Scheduler, Session Messaging, principal resolution, Feishu, and Product API smoke checks remain
  available with their preimage semantics;
- no Workflow Execution/history/voice surface becomes newly active because of this release.

Any mismatch is `STOP_NO_APPLY`, not an invitation to widen the release face.

### CTR-ROL-003 — Transaction artifact

The implementation must produce a sealed manifest containing, for every target: relative path, destination,
candidate blob/bytes, expected preimage blob/bytes or `ABSENT`, type, owner, group, and mode. It must include
the reviewed source SHA, exact Spec SHA, actor, target host, target runtime label, store path, connector label,
generation id, manifest digest, rollback digest, and test receipts. A second apply of one generation is refused.

### Contract group — target and concurrency gates

### CTR-ROL-004 — HR lineage proof

Before apply, prove one exact chain:

```text
HR Feishu app/chat binding
  -> active connector label and PID
  -> active Agent Core runtime label, executable, source root and PID
  -> exact Scheduler store path
  -> HR canonical agent id derived from trusted binding
```

The current three-runtime census is not sufficient. If the HR connector targets a different lineage from the
candidate target, apply is forbidden. No config, credential, or secret value may enter evidence.

### CTR-ROL-005 — Serialized apply

The operator must acquire an exclusive deployment lock, refuse concurrent release activity, stop admission,
wait for `NO_ACTIVE_TURN` and `NO_IN_FLIGHT_MUTATION`, stop exactly the target runtime, and verify that no other
writer can mutate the same Scheduler store. Legacy or shadow runtimes must not be killed or repointed under
this authority; a conflicting writer is `STOP_OWNER_GATE`.

Admission must remain mechanically disabled throughout ACC-ROL-004 post-apply verification. The release
vehicle must start a bounded verification process from the exact installed compose and target configuration by
calling the existing Scheduler seam with `autoStart:false` and `catchup:false`; it must not call the resident
entry's normal `runtime.start()`. This permits the mandatory lease/upgrade/recovery and trusted-interface
checks without starting catch-up or the tick timer. The target supervisor remains stopped during this phase.
Only a passing ACC-ROL-004 post-apply verification allows the same exact Execution Mandate to stop that
verification process and activate the normal supervised runtime. Verification failure must stop the bounded
process and leave the target supervisor stopped and admission disabled. No separate retry, implicit resume, or
operator-selected start path is allowed.

### Contract group — V2/V3 migration and rollback

### CTR-ROL-006 — V2 to V3 boundary

Before the first code write, capture and seal exact code and Scheduler-store preimages. Candidate boot against
a copy must prove deterministic V2-to-V3 migration, idempotent V3 reopen, and that actual pinned V2 reader and
writer both fail loudly on V3 while leaving every byte unchanged.

Rollback states:

```text
BEFORE_V3_STORE_COMMIT:
  restore exact code + exact store preimage; verify hashes; restart exact predecessor.

AFTER_ANY_V3_DOCUMENT_OR_EVIDENCE_COMMIT:
  old V2 reader/writer start is forbidden;
  preserve V3 bytes, stop admission, and use only a V3-aware forward fix; downgrade has no exception.
```

Unknown apply or migration outcome is fail-closed. It is never retried blindly.

### CTR-ROL-007 — Post-apply proof

After start, prove exact loaded file hashes, new runtime PID/generation, single target writer, health, catalog,
`self_ops.status` positive for the trusted caller, and all mandatory negative cases: absent caller, foreign
job/run, mismatched occurrence/run, pending/restart-lost/evicted/never-existed/conflict evidence, secret-like
inputs, extra fields, and repeated committed reconcile. The closed matrix in §10 is mandatory and runs against
`LIVE_COPY + NARROW_OVERLAY + minimal compose`; the previous implementation suite is supporting evidence only.

### Contract group — fresh canary and HR dogfood

### CTR-ROL-008 — Effect-free reconciliation canary

First consume a naturally existing, current-runtime-epoch HR-owned `terminated_without_outcome` only if it has
exact job/occurrence/run/request/turn correlation and effect-free payload proof. Otherwise use one separately
Owner-authorized effect-free canary with attempt count `<=1`, bounded timeout, no external business effect,
pre/post store+Router snapshots, no collateral active turn, and explicit abort/rollback.

Stale, restart-lost, evicted, ambiguous, or business-effecting samples are forbidden. The canary itself must
not use a disabled Workflow domain.

### CTR-ROL-009 — Real HR Feishu dogfood

Send exactly:

```text
检查一下你自己的定时任务，有问题就自己修复。
```

HR, not the deployment operator, must call its formal tools to:

1. read `self_ops.status` and `scheduler.list/runs`;
2. classify canonical versus superseded only from authoritative provenance and exact persisted `logicalKey`,
   or report the exact ambiguity gate;
3. disable an owned superseded job only when it is mechanically proven non-critical against the locked-current
   critical inventory;
4. reconcile only an exact caller-owned current-epoch termination-proven unknown;
5. read back fence clearance while preserving business outcome `unknown`;
6. observe a future-natural canonical occurrence and new session or disposition activity;
7. report the repair and any remaining exact blocker in Feishu.

The external coding/deployment Agent may inspect authoritative post-state but may not perform HR's mechanical
repair. Because V1 excludes `trigger_once`, success uses a future-natural run.

`critical_job_protected` or `critical_inventory_unavailable` must commit zero bytes and become an exact Owner
gate. If the terminal dogfood requires a self-disable PASS, the selected superseded target must be proven
non-critical before the HR prompt. Ambiguity or critical protection cannot be relabelled as terminal success.

### Contract-wide disabled-domain and Workflow-pool invariant

The four disabled Workflow domains remain disabled throughout preparation, canary, dogfood, and rollback.
Their instances remain `BLOCKED_BY_DISABLED_DOMAIN` until narrow historical-disposition authority or explicit
preserve/quarantine. `REENABLE_FOR_CLEANUP=FORBIDDEN`.

Workflow-pool reporting must use a fresh authoritative DB read. The fixed historical baseline is:

```text
ACTIVE_POOL_START = 51
HISTORY = 59 -> 54 -> 51
REAL_NET_REDUCTION = 8
TEST_ACTIVE = UNVERIFIED_UNTIL_FRESH_DB
```

`WORKFLOW_POOL_MUTATION=FORBIDDEN` under this authority. A fresh DB read may record a collateral observation,
including an independently authorized `51 -> 50` transition, but neither rollout operator nor HR may execute a
Workflow instance transition under this Spec. Active draining requires its own accepted authority and mandate.

### Contract-wide failure semantics

- Any authority/preimage/lineage/closure/writer/drain mismatch: `STOP_NO_APPLY`.
- Failure before V3 commit: exact automatic rollback and verified predecessor restart.
- Failure after any V3 document/evidence commit: admission stopped, V3 bytes preserved, V3-aware forward-fix
  only; downgrade or V2 preimage restore has no exception.
- Canary uncertainty: no retry; preserve evidence and escalate the exact Owner-only gate.
- HR ambiguity: do not guess or mutate; report the exact ambiguous resource.
- Production credentials, URLs with secrets, tokens, hashes tied to identity, and raw payloads remain redacted.

## 10. Acceptance

### ACC-ROL-001 — Authority and source

- Contracts: CTR-ROL-000, CTR-ROL-001.
- Method: exact-base/head metadata diff, Git ancestry, and 16-path Git-blob/absence comparison.
- Environment: clean isolated source worktree plus read-only trusted live tree.
- Required evidence: accepted Program and three child authorities on the base; `62905c1` ancestor of
  `447becf`; 16/16 source/preimage relations; exact-head independent `BLOCKER_UNION=NONE`; implementation
  relative-delta `newViolations=[]` and each new code file `<=500` lines.
- Expected result: first acceptance changes only the exhaustive lifecycle allowlist and keeps production
  authority `none`.
- Failure condition: semantic drift, missing authority/ancestry/blob, extra path, or any production grant.

### ACC-ROL-002 — Mixed-generation safety

- Contracts: CTR-ROL-001, CTR-ROL-002, CTR-ROL-004.
- Method: lock-time preimage hash census, deterministic compose-diff verifier, transitive import/export
  closure, catalog comparison, and 60-second isolated trusted-Node boot.
- Environment: `LIVE_COPY + NARROW_OVERLAY + minimal compose`, isolated root/ports, no production write.
- Required evidence: 13/13 live-base equality, 3/3 exact absence, 16 candidate blobs, one permitted compose
  diff, zero unresolved imports/exports, health, and before/after capability inventory.
- Expected result: self operations loads exactly once and unrelated newly activated capability count is zero.
- Failure condition: any preimage drift, broader compose/source delta, missing import/export, boot failure, or
  unrelated activation.

### ACC-ROL-003 — Transaction and rollback

- Contracts: CTR-ROL-003, CTR-ROL-005, CTR-ROL-006.
- Method: transaction fault injection at every write boundary, lock contention, process/store writer census,
  sealed manifest verification, and actual pinned V2 reader/writer execution against copied V3 bytes.
- Environment: isolated copies for destructive faults; future production only under exact Execution Mandate.
- Required evidence: one writer and drained target, manifest/rollback digests, V2→V3 migration receipt,
  pre/post byte hashes, forced precommit rollback, and postcommit forward-fix stop receipt.
- Expected result: pre-V3 failure restores exact code/store; post-V3 failure preserves V3 and never boots V2.
- Failure condition: concurrent/unverifiable writer, mutable artifact, unknown write, hash drift, downgrade, or
  any V2 read/write mutation of V3 bytes.

### ACC-ROL-004 — Runtime and security

- Contracts: CTR-ROL-004, CTR-ROL-005, CTR-ROL-007.
- Method: two ordered phases under one acceptance item. The pre-apply gate performs trusted binding readback and
  process/session/store lineage census. Only after ACC-ROL-006 has passed may the separately authorized apply
  occur; the post-apply verification then uses the CTR-ROL-005 bounded admission-paused process to perform
  loaded-file hash readback, catalog/status calls, and closed negative security probes. Only after those checks
  pass may the mandate-bound normal supervised activation occur.
- Environment: the pre-apply gate observes the exact target runtime without a production write. The post-apply
  verification observes the exact installed target bytes, configuration, store, and trusted binding with
  Scheduler catch-up and timer mechanically disabled, only after ACC-ROL-006 passes and the one separately
  authorized apply completes; probes use test-owned coordinates. The target supervisor stays stopped until
  this verification passes.
- Required evidence: pre-apply, the exact Feishu→connector→Runtime→store→HR chain and sole-writer/drain facts;
  post-apply, the bounded verification PID/generation/writer, `autoStart:false`, `catchup:false`, no tick timer,
  supervisor-stopped proof, health, exact loaded hashes and catalog, server-derived caller, opaque foreign
  denials, secret-output scan, verification-process stop receipt, then one mandate-bound normal activation and
  exact final PID/generation readback.
- Expected result: before any live apply, target identity and serialization are proved and ACC-ROL-006 is fully
  closed; after the authorized apply, every security check passes while Scheduler admission remains disabled,
  then and only then the normal supervised runtime activates and HR's exact lineage exposes only the intended
  self surface with every forbidden bridge absent.
- Failure condition: inferred target, duplicate writer/tool, foreign disclosure, secret/path/PID/handle output,
  identity input, raw mutation, run-as/OBO, kill, Grant change, any live apply before ACC-ROL-006 passes, any
  catch-up/timer admission before post-apply verification passes, or activation after a verification failure.

### ACC-ROL-005 — HR business outcome

- Contracts: CTR-ROL-000, CTR-ROL-009.
- Method: send the exact Feishu phrase once, observe HR's model-visible tool calls/report, then independently
  read authoritative Scheduler/Router post-state.
- Environment: real production HR binding after ACC-ROL-001..004, ACC-ROL-006, and ACC-ROL-007 pass, while the
  separate exact post-canary dogfood Execution Mandate is accepted and valid, using the exact
  `AVAILABLE_FOR_HR_SELF_RECONCILIATION` sample it pins from ACC-ROL-007.
- Required evidence: exact logicalKey/non-critical proof, HR-owned status/list/disable/reconcile/readback,
  immutable receipt bound to the unchanged ACC-ROL-007 `CANARY_SAMPLE_ID`, future-natural run, new
  session/disposition, exact mandate actor/target/attempt/abort binding, immutable apply-mandate expiry receipt,
  exact dogfood-mandate digest and Owner acceptance provenance, the ordering proof
  `sample_committed_at < mandate_created_at <= mandate_accepted_at < first_dogfood_action_at`, and zero
  external mechanical repair; exact target host/runtime/connector/store, runtime epoch, deployed generation,
  locked-current critical-inventory digest, UTC validity window, an immutable executor-owned pre-phrase
  read-only receipt, and immutable HR-owned pre-mutation read-only receipts.
- Expected result:

```text
HR_SELF_DIAGNOSIS = PASS
HR_SELF_JOB_LIST = PASS
HR_SUPERSEDED_JOB_DISABLED_BY_SELF = PASS (exact logicalKey, locked-current non-critical proof)
HR_OUTCOME_UNKNOWN_RECONCILED_BY_SELF = PASS
HR_ADMISSION_RECOVERED = PASS
HR_CANONICAL_DISPATCHER_NEW_NATURAL_RUN = PASS
OWNER_INTERVENTION_FOR_MECHANICAL_REPAIR = 0
FEISHU_AGENT_SELF_SERVICE_OPERATIONS_READY = YES
```

- Failure condition: guessed identity, critical/ambiguous target, external operator repair, no exact receipt,
  no future-natural activity, a pre-created or pre-accepted dogfood mandate, missing apply-mandate expiry,
  overlapping mandate validity, invalid timestamp/digest/provenance chain, expired/not-yet-valid window, any
  runtime epoch/target generation/environment/ownership/inventory drift, a mutation without an immediately
  preceding valid readback receipt, or inference from deployment/health/chat/local synthetic tests alone.

### ACC-ROL-006 — Closed V3 rollout matrix

- Contracts: CTR-ROL-002, CTR-ROL-006, CTR-ROL-007.
- Method: execute every row below with deterministic fixtures, concurrency barriers, injected write/response
  faults, actual pinned V2 binaries, and exact pre/post hashes/audit/receipt comparison.
- Environment: `LIVE_COPY + NARROW_OVERLAY + minimal compose`; never the live production store.
- Required evidence: per-row method/environment, authoritative pre/post store hashes, audit count, receipt
  bytes, expected result, observed result, and failure condition. Zero-write means byte-identical.
- Expected result: every row passes and the prior implementation suite also remains green.
- Failure condition: any row missing, non-deterministic, executed only against a different composition, or
  producing an extra write/audit/retry/disclosure.

| # | Required case | Required result |
|---:|---|---|
| 1 | status ordering/bounds | newest-first blockers, max 20, full counts, exact `truncated`; no foreign IDs, payloads, secrets, paths, PID, or handle |
| 2 | ownership and identity | absent caller, foreign job/run, deleted job, retargeted job, legacy row, and spoofed coordinates fail closed/opaque with zero write |
| 3 | state/evidence negatives | pending, restart-lost, evicted, never-existed, mismatch, conflict, unsupported, non-unknown, already business-settled, and payload conflict all fail with zero write and zero settlement audit |
| 4 | known business outcomes | `late_completed` and `late_failed` make self reconcile zero-write and route only through the authorized business-settlement path |
| 5 | exact positive | exact caller-owned current-epoch `terminated_without_outcome` commits one immutable termination settlement and exactly one audit |
| 6 | multi-unknown fence | reconciling one unknown does not clear a fence while another unresolved unknown for the same job remains |
| 7 | self concurrency | concurrent self/self commits once; all replies converge on identical receipt bytes; exactly one audit |
| 8 | authority races | concurrent operator/business settlement first valid commit wins; if termination-only commits first, a later trusted business settlement may append without rewriting/deleting termination history, changing its receipt, or triggering admission; repeated self reconcile is zero-write |
| 9 | response loss | committed response loss followed by late outcome and receipt replay returns immutable committed receipt without duplicate write/audit |
| 10 | one-shot | precommit fault is byte-zero-write; postcommit atomically records settlement, clears eligible fence, disables job, and returns exact receipt |
| 11 | recurring | settlement preserves enabled definition and schedules strictly future-natural execution; no backlog replay or blind retry |
| 12 | critical controls | exact locked-current `logicalKey`; protected/inventory-unavailable denial and replay are zero-write; alias bypass fails; sanitized durable denial audit is exact-once; `manage:any` operator CLI/admin emergency path is preserved; non-critical owned target may self-disable |
| 13 | compatibility/regression | operator outcome/termination plus scheduler `list|runs|enable` and inherited seven-action semantics remain intact; actual pinned V2 reader and writer both reject V3 loudly with byte-zero-write |
| 14 | closed result paths | provider absence returns `capability_unavailable`; lock contention returns `store_conflict`; injected unexpected failure returns sanitized `internal_error`; each is bounded, secret-free, and byte-zero-write |

### ACC-ROL-007 — Real current-epoch effect-free canary

- Contracts: CTR-ROL-008.
- Method: bind one already-natural eligible incident or execute the separately Owner-authorized canary once;
  compare authoritative Scheduler/Router snapshots before and after sample generation/binding, without calling
  `reconcile_turn` or clearing its fence.
- Environment: exact current production HR Runtime epoch after apply/readback; never a disabled Workflow domain.
- Required evidence: effect-free payload proof; exact job/occurrence/run/request/turn and caller binding;
  `ATTEMPT_COUNT<=1`; bounded timeout; pre/post Scheduler and Router snapshots; process-collateral analysis;
  abort criteria; rollback/stop receipt; real Feishu visibility; preserved business outcome `unknown`; stable
  `CANARY_SAMPLE_ID` passed unchanged to ACC-ROL-005; exact `sample_committed_at`; and an immutable receipt that
  the apply mandate expired atomically at that sample commit before any dogfood mandate exists.
- Expected result: one current-epoch `terminated_without_outcome` is safely
  `AVAILABLE_FOR_HR_SELF_RECONCILIATION`; no reconcile, fence clear, external business effect, retry, or
  collateral turn has occurred; the apply mandate is expired and no dogfood mutation authority yet exists.
  ACC-ROL-005 alone consumes that same sample under its subsequently accepted dogfood mandate and verifies its
  receipt.
- Failure condition: stale/restart-lost/evicted/ambiguous evidence, effectful payload, second attempt, missing
  coordinate/snapshot/collateral/receipt, missing or non-atomic apply-mandate expiry, overlapping dogfood
  authority, operator mechanical repair, or business outcome assertion.

The mandatory execution order is:

```text
ACC-ROL-001..003
  -> ACC-ROL-004 pre-apply gate
  -> ACC-ROL-006 full closed matrix PASS
  -> separate exact Execution Mandate may authorize one live apply
  -> ACC-ROL-004 post-apply verification with Scheduler admission mechanically disabled
  -> mandate-bound normal supervised activation and exact final readback
  -> ACC-ROL-007 sample available
  -> Owner accepts the separate exact post-canary HR dogfood Execution Mandate
  -> ACC-ROL-005 HR consumes the mandate-pinned same sample within its at-most-once action bounds
```

### Contract-to-acceptance reverse mapping

| Contract | Acceptance |
|---|---|
| CTR-ROL-000 | ACC-ROL-001, ACC-ROL-005 |
| CTR-ROL-001 | ACC-ROL-001, ACC-ROL-002 |
| CTR-ROL-002 | ACC-ROL-002, ACC-ROL-006 |
| CTR-ROL-003 | ACC-ROL-003 |
| CTR-ROL-004 | ACC-ROL-002, ACC-ROL-004 |
| CTR-ROL-005 | ACC-ROL-003, ACC-ROL-004 |
| CTR-ROL-006 | ACC-ROL-003, ACC-ROL-006 |
| CTR-ROL-007 | ACC-ROL-004, ACC-ROL-006 |
| CTR-ROL-008 | ACC-ROL-007 |
| CTR-ROL-009 | ACC-ROL-005 |

## 11. Alternatives and current disposition

- Full current-main install: rejected because it activates unrelated differing boot-closure files.
- Direct candidate `compose.js` overlay: rejected because it mounts unrelated runtime capabilities absent live.
- Ad hoc file copy or raw store edit: rejected because it has no sealed transaction or rollback proof.
- Restart first, diagnose later: rejected because it destroys current-epoch reconciliation evidence.
- Enable disabled domains for cleanup: forbidden by Owner ruling.
- Add `trigger_once` or self runtime reload: deferred to separate successor authority; outside this Spec.

Current proposed disposition:

```text
AUTHORING_READY_FOR_REVIEW = YES
READY_FOR_ACCEPTANCE = NO_UNTIL_INDEPENDENT_REVIEW_AND_OWNER_EXACT_HEAD
PRODUCTION_APPLY_AUTHORITY = none
OWNER_ACTION_REQUIRED = review and, only if satisfied, accept exact final head for implementation preparation
NEXT_AFTER_ACCEPTANCE = implement and merge sealed vehicle; independent matrix audit; author separate exact
                        production Execution Mandate; Owner acceptance; one serialized apply; distinct dogfood
```

## 12. Migration, compatibility, and rollback

CTR-ROL-006 and CTR-ROL-007 fully define the operational boundary. V2 store bytes migrate only inside the
single V3 writer. Before any V3 document/evidence commit, a failed generation restores exact sealed V2 code and
store preimages. After any V3 commit, V2 reader/writer execution and V2 preimage restore are permanently
forbidden for that live lineage; only a V3-aware forward fix may proceed. The original unknown business outcome,
termination settlement, immutable receipt, audit count, and future-natural scheduling semantics survive every
compatible restart and forward fix.

The deployment module changes no credential, Grant, Agent Definition, Workflow domain, disabled-domain state,
job payload, or foreign Principal state. Its rollback/forward-fix receipts never contain secrets or raw paths.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
```

Owner exact-head acceptance/rejection is the next lifecycle action, not an unresolved product or contract
decision. Runtime PID, generation, preimage, execution window, and manifest digest are deliberately late-bound
operational coordinates that the separate Execution Mandate must freeze after the release vehicle is audited;
they are not semantic TBDs in this preparation authority.
