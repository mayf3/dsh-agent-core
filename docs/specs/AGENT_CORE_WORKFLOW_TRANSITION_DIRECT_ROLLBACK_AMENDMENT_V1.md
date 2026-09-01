---
spec_id: AGENT_CORE_WORKFLOW_TRANSITION_DIRECT_ROLLBACK_AMENDMENT_V1
status: accepted
type: child amendment (spec-only; docs-only)
amends:
  - AGENT_CORE_WORKFLOW_TRANSITION_ROOT_XATTR_OBSERVATION_V1
  - AGENT_CORE_WORKFLOW_TRANSITION_DEPLOYMENT_RECOVERY_V1
parent_status: accepted
supersedes_parent: false
date: 2026-09-01
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
scope:
  - mayf3/dsh-agent-core docs/specs authority only
  - removal of the pre-seal root staging observation precondition for rollback-to-frozen-preimage only
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_CORE_WORKFLOW_TRANSITION_DEPLOYMENT_RECOVERY_V1
  - AGENT_CORE_WORKFLOW_TRANSITION_ROOT_XATTR_OBSERVATION_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
references:
  - docs/specs/AGENT_CORE_WORKFLOW_TRANSITION_DEPLOYMENT_RECOVERY_V1.md
  - docs/specs/AGENT_CORE_WORKFLOW_TRANSITION_ROOT_XATTR_OBSERVATION_V1.md
---

# AGENT_CORE_WORKFLOW_TRANSITION_DIRECT_ROLLBACK_AMENDMENT_V1

> **PROPOSED / NO IMPLEMENTATION OR PRODUCTION-APPLY AUTHORITY.** This
> docs-only child amendment removes exactly one precondition established by the
> two accepted workflow-transition Authorities: the requirement that a new,
> independently successful root staging observation precede any new recovery
> seal, **as that requirement applies to a brand-new
> rollback-to-frozen-preimage recovery candidate**. It edits no accepted parent
> file, changes no code, builds no candidate, runs no `osascript`, touches no
> production state, expands no path/Grant/canary scope, and creates no new root
> observation authority. This authoring round MUST NOT accept, merge, or
> implement anything.

## 0. Machine-readable amendment summary

```text
AMENDMENT_ID = AGENT_CORE_WORKFLOW_TRANSITION_DIRECT_ROLLBACK_AMENDMENT_V1
AMENDMENT_RELATION = REMOVES_PRE_SEAL_ROOT_STAGING_OBSERVATION_PRECONDITION_
  FOR_ROLLBACK_TO_FROZEN_PREIMAGE_ONLY
AMENDMENT_MECHANISM = NARROW_CHILD_AMEND_WITH_NEW_STABLE_IDS
AMENDMENT_STATUS = proposed

RECOVERY_PARENT_SPEC      = AGENT_CORE_WORKFLOW_TRANSITION_DEPLOYMENT_RECOVERY_V1
RECOVERY_PARENT_STATUS    = accepted (unchanged by this amendment)
RECOVERY_PARENT_MERGE     = fb046c51dab5dfeaf3c32b480fb4efb8a2860e3d (PR #134)
RECOVERY_PARENT_BLOB      = 558c3f27f41eb099583f1b6f57dc9ff1b6de238d
RECOVERY_PARENT_SHA256    = 5a38f0163653c3115ce603ca0be8d28eba13c8e159500a703f55a41deae9161a

OBSERVATION_PARENT_SPEC   = AGENT_CORE_WORKFLOW_TRANSITION_ROOT_XATTR_OBSERVATION_V1
OBSERVATION_PARENT_STATUS = accepted (unchanged by this amendment)
OBSERVATION_PARENT_MERGE  = 9ce88de6cbb6fe93c19f8e39b0065f95de1b7ffc (PR #135)
OBSERVATION_PARENT_BLOB   = dfb1742349036270b1476c4a6bc2f6fbf650b9f8
OBSERVATION_PARENT_SHA256 = 980ae7519b4f11cad6b2f6a442aa66eb81dec0f9074c03653b2f9cc9f4049e8c

PARENT_FILES_MODIFIED     = NO
SUPERSEDES_PARENT_SPEC    = NO
SUPERSEDES_ANY_WHOLE_SPEC = NO
SUPERSESSION_METADATA     = EMPTY (supersedes: [], superseded_by: null)

REMOVED_PARENT_NORMATIVE_EFFECT =
  1. AGENT_CORE_WORKFLOW_TRANSITION_ROOT_XATTR_OBSERVATION_V1#DEC-XOBS-001:
     the selected-direction ordering "use one new, independently accepted,
     sealed, audited, root-only observation transaction before any new
     recovery seal" -- removed ONLY as a precondition for a brand-new
     rollback-to-frozen-preimage recovery candidate;
  2. AGENT_CORE_WORKFLOW_TRANSITION_ROOT_XATTR_OBSERVATION_V1#CTR-XOBS-015:
     the pre-seal requirement to consume canonical OBSERVATION_ROWS/Dobs
     observation evidence and freeze the complete compatibility vector
     -- removed ONLY as a precondition for a brand-new
     rollback-to-frozen-preimage recovery candidate.

REPLACED_PARENT_NORMATIVE_EFFECT =
  3. AGENT_CORE_WORKFLOW_TRANSITION_DEPLOYMENT_RECOVERY_V1#CTR-REC-008:
     for the rollback transaction's OWN root-owned staging/temp objects only,
     pre-normalization state 2's requirement that the exact
     com.apple.provenance tuple be "frozen in the sealed manifest" at build
     time from a prior observation is replaced by the in-transaction
     observe-then-normalize-then-verify-empty license in CTR-DRB-004. Every
     other CTR-REC-008 obligation (table coverage, canonical §3.1
     representation, fail-closed dispositions) is unchanged.

PRESERVED_PARENT_NORMATIVE_EFFECT =
  ALL parent clauses other than the two removed orderings above, explicitly
  including DEC-XOBS-001's rejected-alternative record (historical, evidence),
  all CTR-XOBS-001..CTR-XOBS-016 evidence semantics, and on the recovery side
  CTR-REC-005 (write gate closed first), CTR-REC-006 (atomic rollback and
  postflight), CTR-REC-008 (XATTR_OBSERVATION_TABLE in-transaction), CTR-REC-009
  (final-target exact equality), CTR-REC-015 (same-seal dual audit + Release
  Gate + post-recovery dual audit), CTR-REC-016 (terminal routing and
  redeployment under the accepted pinned-hotfix deployment authority).

APPLIES_TO_FORWARD_BRANCH      = NO (CTR-REC-003/004 forward candidates keep
  the unamended parent requirements)
NEW_ROOT_OBSERVATION_AUTHORITY = NONE
XOBS_R13                       = NOT CREATED BY THIS AMENDMENT
XOBS_R1_THROUGH_R12            = EVIDENCE_ONLY
PRODUCTION_SCOPE_EXPANSION     = NONE (no new paths, Grants, canary, real
  workflow transitions, write-gate restoration, R5-stage cleanup, or any other
  production surface)

RECORDED_TESTED_FACT =
  At XOBS-R12, a dual oracle (Darwin libc open-FD flistxattr/fgetxattr
  fixed-signature adapter plus /usr/bin/xattr -px canonical) directly read the
  complete xattr set of the live production target
  /usr/local/libexec/agent-core/app/packages/broker/src/capabilities/workflow.js
  (file SHA-256 d162670d64227613bf5c8004fc8491a296f62835722f3bdcde7ddc4131890f8e,
  Git blob 577c8778cf35810ce7538aff52ab354e0c1dddc6) as
  the empty set [], with the target SHA-256 unchanged during the read.

AUDIT_BASIS         = SCHEME_AUDIT_R1 (read-only scheme audit of 2026-09-01)
AUDIT_BASIS_SHA256  = 4ff6defe810f302a93f8d529f5206b54141ced549119e12ceb368b6b86eebd74
AUDIT_VERDICT       = SCHEME_DECISION = DIRECT_AUDITED_ROLLBACK (Q1..Q5)
AUTHORITY_EFFECTIVE_WHEN = INDEPENDENT_REVIEW_PASS AND OWNER_LIFECYCLE_
  ACCEPTANCE AND FINAL_HEAD_AUDIT_SEMANTIC_DELTA_NONE AND MERGE_TO_MAIN_
  READBACK
```

## 1. Goal

Remove, for a brand-new rollback-to-frozen-preimage recovery candidate built
under accepted
`AGENT_CORE_WORKFLOW_TRANSITION_DEPLOYMENT_RECOVERY_V1`, the precondition —
established jointly by accepted
`AGENT_CORE_WORKFLOW_TRANSITION_ROOT_XATTR_OBSERVATION_V1#DEC-XOBS-001` and
`#CTR-XOBS-015` — that one successful root staging observation transaction
must precede any new recovery seal. After this amendment is accepted through
its full lifecycle, such a candidate may proceed directly after a fresh
preflight and the full independent audit chain (same-seal dual audit plus
Release Gate under `CTR-REC-015`) without any prior successful observation
transaction, while every other obligation of both accepted parents remains in
force unchanged.

This amendment is the first docs-only governance step of the
`DIRECT_AUDITED_ROLLBACK` route selected by the independent scheme audit
`SCHEME_AUDIT_R1` (Q1: direct rollback is not allowed by existing authority
text; Q3: a minimal docs-only amendment is feasible with the safety boundary
intact; Q4/Q5: direct is fastest and needs least new code, fewest new Specs,
and one administrator authentication).

## 2. Scope and non-goals

### 2.1 In scope (authority effect only)

- record the tested fact that the production target's complete xattr set was
  directly read as `[]` at XOBS-R12 by a dual oracle (Section 5, `OBS-DRB-001`);
- remove the DEC-XOBS-001/CTR-XOBS-015 pre-seal observation ordering, only as
  a precondition for a brand-new rollback-to-frozen-preimage candidate;
- replace, only for the rollback transaction's own root-owned staging/temp
  objects, CTR-REC-008 pre-normalization state 2's build-time-frozen-tuple
  pathway with the bounded in-transaction license of `CTR-DRB-004`;
- require a fresh preflight and the unchanged independent audit chain before
  any execution; and
- enumerate the preserved parent obligations that continue to bind.

### 2.2 Non-goals

- no edit to either accepted parent file (accepted immutability; parents stay
  `accepted` with no `superseded_by` backlink);
- no supersession of any whole Spec (`supersedes: []`, `superseded_by: null`);
- no coverage of the forward-reconciliation branch (`CTR-REC-003`/`CTR-REC-004`
  candidates remain governed by the unamended parent text);
- no new root observation authority, no XOBS-R13, no restart of the separate
  observation program (its R1–R12 history is retained as evidence only);
- no expansion of paths, Grants, canary, real workflow transitions,
  write-gate restoration, R5-stage cleanup, dotenv mutation authority, or any
  other production scope;
- no candidate build, seal, audit, `osascript`, authorization dialog, root
  execution, or production access in this authoring round; and
- no implementation permission: recovery execution authority remains solely
  with the accepted parents (`implementation_authority: none` /
  `production_apply_authority: none` here).

## 3. Authority and dependencies

This Spec is a `NEW` child-amendment authority candidate under
`SPEC_GOVERNANCE_V0`. It neither fully replaces either parent nor partially
mutates parent files. Because V0 supersession is whole-Spec only
(`SPEC_FORMAT_V0` §2.7 forbids contract-fragment supersession metadata, and
`SPEC_GOVERNANCE_V0` §9.2 directs that an authority which cannot fully replace
the old one be expressed as a new refining authority), the bounded removal is
expressed with the repository's established narrow-child-amendment mechanism:
new stable IDs in this new Spec, explicit enumeration of the removed/replaced
parent normative effect in Section 0 and Contracts, empty supersession
metadata, and parent files byte-unchanged (same mechanism as
`AGENT_CORE_LARK_UX_PHASE1_V2_HEADING_NORMALIZATION_AMENDMENT`).

```text
REPOSITORY                = mayf3/dsh-agent-core
AUTHORITY_BRANCH          = main
AUTHORING_BASE_COMMIT     = 9ce88de6cbb6fe93c19f8e39b0065f95de1b7ffc
RECOVERY_PARENT_SPEC      = AGENT_CORE_WORKFLOW_TRANSITION_DEPLOYMENT_RECOVERY_V1
RECOVERY_PARENT_MERGE     = fb046c51dab5dfeaf3c32b480fb4efb8a2860e3d (PR #134)
RECOVERY_PARENT_BLOB      = 558c3f27f41eb099583f1b6f57dc9ff1b6de238d
RECOVERY_PARENT_SHA256    = 5a38f0163653c3115ce603ca0be8d28eba13c8e159500a703f55a41deae9161a
OBSERVATION_PARENT_SPEC   = AGENT_CORE_WORKFLOW_TRANSITION_ROOT_XATTR_OBSERVATION_V1
OBSERVATION_PARENT_MERGE  = 9ce88de6cbb6fe93c19f8e39b0065f95de1b7ffc (PR #135)
OBSERVATION_PARENT_BLOB   = dfb1742349036270b1476c4a6bc2f6fbf650b9f8
OBSERVATION_PARENT_SHA256 = 980ae7519b4f11cad6b2f6a442aa66eb81dec0f9074c03653b2f9cc9f4049e8c
DEPLOYMENT_GRANDPARENT    = AGENT_CORE_WORKFLOW_TRANSITION_PINNED_HOTFIX_DEPLOYMENT_V1
GOVERNING_FRAMEWORK       = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
SCHEME_AUDIT_REPORT       = /Users/yanfenma/workspace/deployment-artifacts/
                            workflow-transition-goal-state/reports/SCHEME_AUDIT_R1.md
SCHEME_AUDIT_SHA256       = 4ff6defe810f302a93f8d529f5206b54141ced549119e12ceb368b6b86eebd74
R12_STOP_RECORD_SHA256    = ab5e87230ff8696ab00387dac9b2d4e4bd78af929bc96e4b7d610c1e7751953d
EXTERNAL_AUTHORITIES      = NONE
```

Authority precedence statement: within the single bounded boundary declared in
`CTR-DRB-002` and `CTR-DRB-004`, this amendment — once accepted and present on
`main` — prevails over the named clauses of both parents for brand-new
rollback-to-frozen-preimage candidates. Outside that boundary the parents
prevail, including for every forward-branch candidate and for every other
purpose of the observation authority.

## 4. Current State

### STATE-DRB-001 — Production target xattr set directly read as empty

- Subject: live production target
  `/usr/local/libexec/agent-core/app/packages/broker/src/capabilities/workflow.js`
- As of artifact: `GOAL_STATE.json` `xobsR12LibcAdapter`
  (`status=PASS`, `targetXattrSet=[]`, `targetSha256=d162670d…f8e`,
  `dualOracle=Darwin libc open-FD plus /usr/bin/xattr -px canonical`,
  `candidateInstantiated=false`), read by this author 2026-09-01
- Environment: local production host, non-instantiated build evidence, no
  privileged execution
- Projection: the complete xattr set of the current production target is `[]`
  as of the XOBS-R12 dual-oracle read. This is a time-indexed tested fact and
  authorization for nothing: execution-time contracts (`CTR-REC-006`) still
  require fresh re-reading at transaction time.
- Basis: `OBS-DRB-001`, `OBS-DRB-002`

### STATE-DRB-002 — The separate observation program is 0-for-12 with a non-xattr blocker

- Subject: XOBS observation build rounds R1 through R12
- As of artifact: `GOAL_STATE.json` `observationBuildRounds` plus the R12 stop
  record `SCHEME_AUDIT_REQUIRED.md`
  (SHA-256 `ab5e87230ff8696ab00387dac9b2d4e4bd78af929bc96e4b7d610c1e7751953d`)
- Environment: user-side observation build program under accepted
  `AGENT_CORE_WORKFLOW_TRANSITION_ROOT_XATTR_OBSERVATION_V1`
- Projection: twelve consecutive rounds produced no successful observation
  (R1 REJECTED; R2/R3/R5 REJECTED_PRESEAL; R4/R7 REJECTED_POSTSEAL_PREAUDIT;
  R6 STOPPED_PREINSTANTIATION_BUILDER_NONCONFORMANT; R8/R9/R10
  REJECTED_PREINSTANTIATION; R11 sealed then REJECTED_BY_SAME_SEAL_DUAL_AUDIT;
  R12 SCHEME_AUDIT_REQUIRED before candidate instantiation). The R12 stop
  cause is a coordinator/attempt-publication schema mismatch (four attempt
  path key names), outside the xattr observation domain.
- Basis: `OBS-DRB-003`, `OBS-DRB-004`

### STATE-DRB-003 — Existing authority text forbids direct rollback today

- Subject: joint effect of the two accepted workflow-transition Authorities
- As of artifact: `SCHEME_AUDIT_R1` Q1
  (`DIRECT_ROLLBACK_ALLOWED_BY_EXISTING_AUTHORITY = NO`)
- Environment: repository authority branch (`main` at `9ce88de6`)
- Projection: DEC-XOBS-001's selected direction and CTR-XOBS-015's evidence
  consumption ordering, combined with CTR-REC-008's build-time frozen-tuple
  pathway, establish a mandatory observation → recovery-seal ordering, so a
  direct rollback-to-frozen-preimage candidate cannot be legally sealed under
  current text. This amendment is the minimum change that lifts exactly that
  barrier.
- Basis: `OBS-DRB-006`, `OBS-DRB-007`, `SCHEME_AUDIT_R1` Q1

### STATE-DRB-004 — Final-target preimage policy already frozen from qualified evidence

- Subject: frozen production preimage of the rollback target (Git blob
  `04ca8550fbdaf9b66624dea42701a8a9af7547a8`, SHA-256
  `ca27f3a8a1a34f09858988edb57e892ebdb2a98d7ceb755f0eab252a9641a93e`,
  16107 bytes)
- As of artifact: `PREIMAGE_META.json`
  (SHA-256 `50ed9c52886ef0b28f16b55da157d9a6befa039e9aa5d89cc3512282bcd200d5`)
  and `DEPLOYMENT_MANIFEST.json`
  (SHA-256 `15be1175082f262783c1d1bca28ab85548bd0073cd69050f4252c897623e635e`)
  in `workflow-transition-final-f4bc431/`, plus `§3.1` of the accepted
  recovery parent
- Environment: deployment artifact workspace; preflight measurement of the
  production preimage live file (2026-08-31, read-only `stat + hash`)
- Projection: `FINAL_TARGET_OWNER_GROUP_MODE=root:wheel/0644`,
  `FINAL_TARGET_ACL=none`, `FINAL_TARGET_XATTR_SET=∅` are all available from
  qualified evidence (`xattr: none`, `acl: none`, `file_policy.xattr = none
  (verified absent at preflight)`), so `CTR-REC-009`'s "qualified preimage
  evidence" precondition is already satisfiable; the preimage lacks
  `com.apple.provenance`, therefore the postimage must lack it too.
- Basis: `OBS-DRB-005`, `SCHEME_AUDIT_R1` Q2

## 5. Observations

### OBS-DRB-001 — XOBS-R12 dual oracle read the production target xattr set as empty

- Subject: live production target workflow.js complete xattr set
- Repository/source: `GOAL_STATE.json` `xobsR12LibcAdapter` and R12
  `SCHEME_AUDIT_REQUIRED.md`
- Commit/artifact: R12 report SHA-256
  `ab5e87230ff8696ab00387dac9b2d4e4bd78af929bc96e4b7d610c1e7751953d`
- Environment: local production host; Darwin libc open-FD adapter
  (`flistxattr`/`fgetxattr`, fixed signatures) plus canonical
  `/usr/bin/xattr -px`, with FD/path device+inode consistency checks
- Observed at: XOBS-R12 build-evidence round, 2026-09-01
- Method: dual-oracle direct read; `status=PASS`
- Result: complete observed set `[]`; target SHA-256 unchanged
  (`d162670d64227613bf5c8004fc8491a296f62835722f3bdcde7ddc4131890f8e`);
  no candidate instantiated, no privileged execution
- Provenance: `/Users/yanfenma/workspace/deployment-artifacts/
  workflow-transition-goal-state/GOAL_STATE.json` and
  `workflow-root-xattr-observation-xobs-r12-…-build-evidence/
  SCHEME_AUDIT_REQUIRED.md`

### OBS-DRB-002 — Production fresh read fixes the target identity coordinates

- Subject: production target bytes/metadata and Broker health
- Repository/source: `GOAL_STATE.json` `productionFreshRead`
- Commit/artifact: Git blob `577c8778cf35810ce7538aff52ab354e0c1dddc6`
- Environment: local production host, read-only
- Observed at: `2026-09-01T12:16:22Z`
- Method: fresh non-privileged read
- Result: file SHA-256 `d162670d…f8e`, `root:wheel 0644`, 20058 bytes,
  Broker health PASS, workflow_transition present
- Limitation: time-indexed; execution must re-establish it
- Provenance: `GOAL_STATE.json`

### OBS-DRB-003 — Twelve consecutive observation rounds, zero successes

- Subject: XOBS R1–R12 observation build program
- Repository/source: `GOAL_STATE.json` `observationBuildRounds`
- Environment: user-side build program under the accepted observation parent
- Observed at: 2026-09-01 (author readback of the round ledger)
- Method: inspect durable round ledger
- Result: 12 rounds, 0 successful observations (states enumerated in
  `STATE-DRB-002`)
- Limitation: past performance does not prove future impossibility; it is
  evidence about the program as deployed, per `SCHEME_AUDIT_R1` Q3 item 1
- Provenance: `GOAL_STATE.json`

### OBS-DRB-004 — R12 stop cause is outside the xattr observation domain

- Subject: R12 stop record STOP_RULE trigger
- Repository/source: R12 `SCHEME_AUDIT_REQUIRED.md` "STOP_RULE trigger" section
- Commit/artifact: SHA-256
  `ab5e87230ff8696ab00387dac9b2d4e4bd78af929bc96e4b7d610c1e7751953d`
- Environment: coordinator/attempt-publication framework
- Observed at: R12 stop, 2026-09-01
- Method: inspect the durable stop record
- Result: the sealed coordinates define `requestedAttemptTemp`,
  `requestedAttemptFinal`, `terminalAttemptTemp`, `terminalAttemptFinal`,
  while the coordinator indexes `attemptRequestedTemp`,
  `attemptRequestedFinal`, `attemptTerminalTemp`, `attemptTerminalFinal` — a
  deterministic `KeyError` before any no-clobber publication; four key-name
  mismatches, not an xattr observation failure
- Provenance: R12 build-evidence tree

### OBS-DRB-005 — Preimage final-target policy frozen from qualified evidence

- Subject: rollback preimage metadata and deployment manifest file policy
- Repository/source: `workflow-transition-final-f4bc431/rollback/
  PREIMAGE_META.json` and `…/DEPLOYMENT_MANIFEST.json`
- Commit/artifact: SHA-256 `50ed9c52…00d5` and `15be1175…635e`; preimage tar
  SHA-256 `fe290f9fefb112f9b50a9ec0fff273267d37c02c5f4dc7c4e90e286d252eedb6`
- Environment: deployment artifact workspace (pinned-hotfix deployment
  authority chain, accepted @ merge `1a9b81de`)
- Observed at: preflight 2026-08-31 (read-only `stat + hash` of the
  production preimage live file)
- Method: inspect preflight-measured metadata and manifest file policy
- Result: `uid0/gid0 (root:wheel)`, `mode 0644`, `acl: none`, `xattr: none`,
  regular file; `file_policy.xattr = none (verified absent at preflight)`;
  preimage Git blob `04ca8550…` / SHA-256 `ca27f3a8…` / 16107 bytes
- Provenance: deployment artifact tree cited above

### OBS-DRB-006 — Accepted parents jointly order observation before any new recovery seal

- Subject: DEC-XOBS-001, CTR-XOBS-015, and CTR-REC-008 accepted text
- Repository/source: `mayf3/dsh-agent-core` `main` @ `9ce88de6`
- Commit/artifact: parent blobs `dfb17423…` and `558c3f27…`
- Environment: repository authority branch
- Observed at: authoring readback 2026-09-01
- Method: inspect accepted Decisions and Contracts
- Result: DEC-XOBS-001 selects "root-only observation transaction before any
  new recovery seal" (rejected alternatives include "observe during
  production recovery"); CTR-XOBS-015 binds R3 sealing to
  `OBSERVATION_ROWS`/`Dobs` consumption and execution-time re-observation;
  CTR-REC-008 admits only empty-set or build-time-frozen provenance tuples
  pre-normalization
- Provenance: repository Git objects

### OBS-DRB-007 — R5 proved root staging objects can carry provenance

- Subject: R5 rollback staging stop record
- Repository/source: accepted recovery parent §4/§5 R5 truth and
  `SCHEME_AUDIT_R1` Q2 staging-side analysis
- Environment: historical R5 root staging attempt
- Observed at: R5 incident (recorded in the accepted recovery parent)
- Method: inspect the accepted parent's frozen R5 record
- Result: a fresh root staging object was observed with
  `got=com.apple.provenance expected=` — staging objects may carry a
  provenance tuple whose exact value is not pre-known
- Provenance: accepted recovery parent text

## 6. Claims and assumptions

### CLM-DRB-001 — Final-target safety does not depend on a pre-observed staging tuple

- Support state: SUPPORTED
- Supported by evidence: `EVD-DRB-001`, `EVD-DRB-002`
- Contradicted by evidence: none
- Uncertainty: none material; the staging tuple's only use is ephemeral
  normalize-to-empty hygiene, while `CTR-REC-009` independently forbids
  provenance on the final target and the preimage policy is frozen
  (`STATE-DRB-004`)

### CLM-DRB-002 — The separate observation program became the failure bottleneck while its goal-side fact is already obtained

- Support state: SUPPORTED
- Supported by evidence: `EVD-DRB-003`, `EVD-DRB-004`
- Contradicted by evidence: none
- Uncertainty: a repaired framework might eventually succeed; the Owner goal
  (`noXobsR13=true`, stop rule "no new builder/framework expansion") closes
  that path as a matter of direction, not proof

### CLM-DRB-003 — In-transaction staging observation does not import observation authority into recovery

- Support state: SUPPORTED
- Supported by evidence: `EVD-DRB-001`, `OBS-DRB-006`, `OBS-DRB-007`
- Contradicted by evidence: none
- Uncertainty: none material; `CTR-REC-008` already required the recovery
  transaction itself to produce the `XATTR_OBSERVATION_TABLE` in-transaction;
  this amendment only licenses the observed-not-pre-frozen staging tuple for
  normalize-to-empty and creates no reusable observation evidence authority

## 7. Evidence relations

### EVD-DRB-001 — Preimage freeze and final-target equality support the safety claim

- Source observations: `OBS-DRB-001`, `OBS-DRB-005`
- Target: `CLM-DRB-001`, `STATE-DRB-004`
- Relation: SUPPORTS
- Bound coordinates: production target @ R12 read; preimage artifacts @
  `workflow-transition-final-f4bc431/` (2026-08-31 preflight)
- Strength/sufficiency: strong for the final-target invariant path
- Limitations: time-indexed; execution must re-establish freshness under
  `CTR-REC-006`
- Provenance: `GOAL_STATE.json`, preimage metadata tree

### EVD-DRB-002 — Parent contracts independently enforce the final-target invariant

- Source observations: `OBS-DRB-006`
- Target: `CLM-DRB-001`
- Relation: SUPPORTS
- Bound coordinates: accepted parent text @ `9ce88de6`
- Strength/sufficiency: normative — `CTR-REC-009` binds regardless of staging
  tuples
- Limitations: none
- Provenance: repository Git objects

### EVD-DRB-003 — Round ledger supports the bottleneck claim

- Source observations: `OBS-DRB-003`, `OBS-DRB-004`
- Target: `CLM-DRB-002`, `STATE-DRB-002`
- Relation: SUPPORTS
- Bound coordinates: XOBS R1–R12, 2026-09-01
- Strength/sufficiency: strong for the program as deployed (12/12 failures,
  current blocker outside the xattr domain)
- Limitations: does not prove the framework could never be repaired
- Provenance: `GOAL_STATE.json`, R12 stop record

### EVD-DRB-004 — Scheme audit supports the feasibility and route verdict

- Source observations: `OBS-DRB-001`…`OBS-DRB-007`
- Target: `CLM-DRB-002`, `STATE-DRB-003`
- Relation: SUPPORTS
- Bound coordinates: `SCHEME_AUDIT_R1` SHA-256 `4ff6defe…ebd74`,
  completed `2026-09-01T12:22:42Z`
- Strength/sufficiency: strong — read-only audit with independently verified
  input digests (both parent SHA-256 values re-verified by this author)
- Limitations: audit reasoning is not mechanical proof of optimality; the
  Owner retains lifecycle control
- Provenance: `workflow-transition-goal-state/reports/SCHEME_AUDIT_R1.md`

## 8. NEW_EVIDENCE (Standing Order item 5 reopening record)

`DEC-XOBS-001` was accepted `2026-09-01T04:46:43Z` with rejected alternatives
"amend accepted parent in place" and "observe during production recovery".
The repository Standing Order forbids reopening a rejected proposal without
explicit `NEW_EVIDENCE`. This amendment supplies it; every item below is a
mechanical fact first observed after that acceptance time, cited to
`SCHEME_AUDIT_R1`:

1. **Twelve consecutive observation rounds failed (0/12).**
   `GOAL_STATE.observationBuildRounds`: R1 REJECTED; R2/R3/R5
   REJECTED_PRESEAL; R4/R7 REJECTED_POSTSEAL_PREAUDIT(†R4 static); R6
   STOPPED_PREINSTANTIATION_BUILDER_NONCONFORMANT; R8/R9/R10
   REJECTED_PREINSTANTIATION; R11 sealed then REJECTED_BY_SAME_SEAL_DUAL_AUDIT;
   R12 SCHEME_AUDIT_REQUIRED before instantiation (`OBS-DRB-003`;
   `SCHEME_AUDIT_R1` Q3 NEW_EVIDENCE item 1).
2. **The R12 stop cause is not an xattr problem.** Four attempt path key-name
   mismatches (`requestedAttemptTemp/…` vs `attemptRequestedTemp/…`)
   deterministically raise `KeyError` before publication — an
   authorization-framework defect outside the observation domain
   (`OBS-DRB-004`; `SCHEME_AUDIT_R1` Q3 NEW_EVIDENCE item 2, R12
   `SCHEME_AUDIT_REQUIRED.md` STOP_RULE section).
3. **The program's goal-side fact is already directly obtained.** The R12
   dual oracle read the production target's complete xattr set as `[]`
   (`OBS-DRB-001`; `SCHEME_AUDIT_R1` Q3 NEW_EVIDENCE item 3) — the final
   target-side fact the separate program was built to serve.
4. **The preimage-side final-target policy is already frozen from qualified
   evidence** (`OBS-DRB-005`, `STATE-DRB-004`; `SCHEME_AUDIT_R1` Q3
   NEW_EVIDENCE item 4), so the staging tuple's only remaining use is
   ephemeral normalize-to-empty hygiene while `CTR-REC-009` independently
   forbids provenance on the final target.

Consistency note (not mechanical evidence): the Owner goal patch
(`noXobsR13=true`; stop rule "no new builder/framework expansion") aligns
with items 1–3 (`SCHEME_AUDIT_R1` Q3 item 5).

Scope of reopening: the original rejection reason — observation and recovery
have different mutation authority and failure boundaries — is NOT overturned
as a principle and is preserved by keeping every parent boundary contract in
force. The new facts are that the separated program itself became the failure
bottleneck and that its goal-side fact is already directly readable. The
reopening is limited to exactly the two orderings removed by `CTR-DRB-002`
and the single staging-tuple license of `CTR-DRB-004`.

## 9. Decisions

### DEC-DRB-001 — Remove the pre-seal observation precondition for rollback only

- Decision owner: mayf3
- Decision: a brand-new rollback-to-frozen-preimage recovery candidate under
  the accepted recovery parent no longer requires a prior successful root
  staging observation transaction (`DEC-XOBS-001` ordering) nor
  `CTR-XOBS-015` observation-evidence consumption before sealing; it may
  proceed after a fresh preflight and the full `CTR-REC-015` audit chain
- Rejected alternatives: continue the `MINIMAL_ONE_TIME_OBSERVATION` route;
  fully supersede either parent; infer the staging tuple from user-side or
  dotenv tuples; edit accepted parents in place
- Reason: `NEW_EVIDENCE` Section 8 plus `SCHEME_AUDIT_R1` Q3/Q4/Q5 (direct
  route is feasible, faster, needs zero observation-framework code, and one
  administrator authentication instead of two)
- Owner decision remaining: NONE (lifecycle acceptance is a separate role)

### DEC-DRB-002 — License in-transaction staging-tuple observation and normalize-to-empty

- Decision owner: mayf3
- Decision: within the rollback transaction itself, on its OWN root-owned
  staging/temp objects only, mechanically observe one exact
  `com.apple.provenance` tuple using the parent §3.1 canonical procedure,
  normalize exactly that tuple, and verify the empty set afterward
  (`CTR-DRB-004`); this is the bounded reopening of "observe during
  production recovery" and it produces no reusable observation authority
- Rejected alternatives: accept provenance by name; accept any
  `com.apple.*`; leave the tuple on staging objects; normalize the user
  candidate; pre-freeze a guessed tuple value
- Reason: staging objects provably may carry provenance (`OBS-DRB-007`);
  user/dotenv tuples cannot authorize root objects (parent `CLM-XOBS-002`);
  hygiene needs only removal with verified empty set
- Owner decision remaining: NONE

### DEC-DRB-003 — No new observation authority; history is evidence-only

- Decision owner: mayf3
- Decision: this amendment creates no root observation authority, starts no
  XOBS-R13, and reclassifies nothing: XOBS R1–R12 artifacts and the accepted
  observation parent remain evidence/authority for their own scope; a future
  observation program would need its own separately accepted authority
- Rejected alternatives: restart the observation framework; reuse R2/R12
  bytes as executable supply; treat R12's `[]` read as standing execution
  authority
- Reason: `OBS-DRB-001`/`OBS-DRB-003` facts are recorded and time-indexed;
  standing authority for future observation is not needed for the rollback
- Owner decision remaining: NONE

### DEC-DRB-004 — Forward branch untouched

- Decision owner: mayf3
- Decision: this amendment applies only to rollback-to-frozen-preimage
  candidates; a forward-reconciliation candidate (`CTR-REC-003`/`CTR-REC-004`)
  remains governed by the unamended parent authorities in full
- Rejected alternatives: removing the precondition for all recovery branches
- Reason: the audit verdict chain and the current incident goal need only the
  rollback path; minimizing semantic surface
- Owner decision remaining: NONE

## 10. Contracts

### CTR-DRB-001 — Authoring and lifecycle boundary

This authoring round MUST remain docs-only and change exactly two files: this
new Spec file and one index row in `docs/specs/README.md`. It MUST NOT modify
either accepted parent file, any code, any evidence directory, or any
pre-existing WIP. The Spec MUST remain `proposed / none / none` in this
round. Acceptance follows the full lifecycle: independent semantic review of
the exact head, Owner lifecycle-only acceptance, independent final-head audit
with `SEMANTIC_DELTA_AFTER_REVIEW = NONE`, merge to `main`, and readback. The
authoring agent MUST NOT merge or accept its own Spec, and the PR MUST remain
Draft through this round.

### CTR-DRB-002 — The bounded removal

Once this amendment is accepted and present on `main`, for a brand-new
rollback-to-frozen-preimage recovery candidate under
`AGENT_CORE_WORKFLOW_TRANSITION_DEPLOYMENT_RECOVERY_V1`:

1. the ordering "one new, independently accepted, sealed, audited, root-only
   observation transaction **before any new recovery seal**" selected by
   `DEC-XOBS-001` does not apply as a precondition; and
2. the `CTR-XOBS-015` requirements to consume canonical
   `OBSERVATION_ROWS`/`Dobs` evidence, to freeze the observation
   compatibility vector before sealing, and to re-observe against that sealed
   vector at execution do not apply as preconditions.

Nothing else is removed. Both parent files remain accepted and byte-unchanged;
no parent `superseded_by` backlink is created; the removal applies to no
other candidate kind (see `CTR-DRB-005`); and the forward branch keeps the
unamended requirements (`DEC-DRB-004`).

### CTR-DRB-003 — What still gates execution (no weakening)

A rollback-to-frozen-preimage candidate proceeding under this amendment MUST
still satisfy, unchanged, at least: fresh preflight re-establishment of the
production facts (target identity, bytes, metadata, xattr set —
`STATE-DRB-001` is a tested fact, not execution authority); `CTR-REC-001`
through `CTR-REC-004` (lifecycle, R5 truth, 23 forward gates, forward-branch
contract even when unselected); `CTR-REC-005` (svc-workflow write gate closed
first, true→false atomic edit, never restored); `CTR-REC-006` (preserve
current-target evidence, export frozen preimage bytes from Git blob
`04ca8550…`, same-filesystem atomic rename, exact restart, postflight health
PASS / manifest count 14 / catalog absence); `CTR-REC-007`/`CTR-REC-008`/
`CTR-REC-009` (candidate graph; in-transaction `XATTR_OBSERVATION_TABLE`;
final-target exact equality `root:wheel/0644`, ACL none, xattr `∅` —
preimage without provenance means postimage without provenance);
`CTR-REC-010`…`CTR-REC-014` (transaction, records, cleanup, single
crash-safe authorization, exclusions); `CTR-REC-015` (same-seal dual audit,
Release Gate with `OWNER_GATE=ACCEPT`, post-recovery Runtime/Boundary dual
audit); and `CTR-REC-016` (terminal `ROLLED_BACK_TO_FROZEN_PREIMAGE`,
redeployment only under the accepted pinned-hotfix deployment authority).
The recorded `[]` target read MUST be re-established fresh at execution time
by the transaction itself.

### CTR-DRB-004 — Bounded in-transaction staging-tuple license (CTR-REC-008 application)

For the rollback transaction's OWN root-owned staging and deployment-temp
objects only, the allowed pre-normalization states under
`CTR-REC-008` are amended to:

```text
1. empty xattr set; or
2. exactly one com.apple.provenance tuple that the transaction itself
   mechanically observed on that exact object in-transaction, using the
   §3.1 canonical procedure (/usr/bin/xattr -px, ASCII-whitespace removal,
   uppercase even-length hex, byte length = hex_chars / 2, digest over the
   contiguous uppercase hex ASCII bytes).
```

For state 2 the transaction MUST normalize exactly that observed tuple from
that exact object and MUST verify the complete post-normalization set equals
the empty set before the object may participate in any further step. Any
other attribute, any second attribute, `com.apple.quarantine`,
`com.apple.ResourceFork`, a resource fork exposed by any other API, missing
expected provenance, value/length ambiguity, or any command/parse failure
remains an immediate stop under the unamended `CTR-REC-008` dispositions.
The license does NOT extend to: the user candidate or its seal (never
modifiable to make a check pass), any parent-directory or publication
object, the dotenv, or the final target; the observed staging tuple value is
NOT frozen as reusable policy; and it creates no permission to place
provenance on the final temp or target (`CTR-REC-009` unchanged). All other
`CTR-REC-008` obligations — one table row per actual object category,
canonical representation rules, fail-closed semantics — remain in force
unchanged.

### CTR-DRB-005 — No scope expansion, no new authority

This amendment MUST NOT be read to expand any path class, Grant, canary,
workflow-transition, dotenv, service, credential, R5-stage-cleanup, or any
other production scope of either parent; to create a new root observation
authority; to start XOBS-R13; or to make any R1–R12 artifact executable or
consumable as supply (all remain evidence-only per parent `CTR-XOBS-002`).
It authorizes exactly one thing: the removal in `CTR-DRB-002` plus the
license in `CTR-DRB-004`, for rollback-to-frozen-preimage candidates at the
frozen coordinates of recovery parent §3.1 (preimage Git blob `04ca8550…` /
SHA-256 `ca27f3a8…`; production target Git blob `577c8778…` / SHA-256
`d162670d…`). A candidate at any other coordinates is outside this
amendment and must stop.

### CTR-DRB-006 — Recorded tested fact is evidence, not authority

The XOBS-R12 dual-oracle result (production target complete xattr set =
`[]`, target SHA-256 unchanged `d162670d…`) is recorded by this Spec as a
tested, time-indexed fact (`STATE-DRB-001`). It MUST NOT be treated as: a
standing authorization for any production action; a substitute for
execution-time fresh reads required by `CTR-REC-006`; a qualified
per-object staging tuple; or evidence about any object other than the exact
production target at the observation time.

## 11. Acceptance

### ACC-DRB-001 — Docs-only authoring boundary

- Contracts: `CTR-DRB-001`
- Method: inspect exact base/head, diff file list (exactly this Spec plus one
  `docs/specs/README.md` index row), parent blobs byte-identical to
  `9ce88de6`, `git diff --check`, Draft PR state
- Environment: clean isolated worktree at exact PR head
- Required evidence: exact SHAs, diff, check output, PR record
- Expected result: two-file docs-only delta; parents unchanged; PR Draft
- Failure condition: any third path changes, parent bytes drift, or PR is
  ready-for-review/merged by the author

### ACC-DRB-002 — Removal is exactly the two named orderings

- Contracts: `CTR-DRB-002`
- Method: semantic review mapping every normative sentence of this Spec to
  either the two removed orderings, the `CTR-DRB-004` license, preservation
  statements, or evidence records
- Environment: repository authority branch
- Required evidence: review record enumerating the mapping; parent clause
  citations (`DEC-XOBS-001`, `CTR-XOBS-015`)
- Expected result: no third parent obligation is removed or weakened
- Failure condition: any additional clause is removed, narrowed silently, or
  contradicted

### ACC-DRB-003 — Preserved obligations remain binding

- Contracts: `CTR-DRB-003`
- Method: cross-reference each listed `CTR-REC-*`/`CTR-XOBS-*` obligation
  against the accepted parent text at `9ce88de6`
- Environment: repository authority branch
- Required evidence: citation table
- Expected result: all preserved clauses remain in force with identical
  meaning for the rollback chain
- Failure condition: any preserved clause is restated weaker than the parent

### ACC-DRB-004 — Staging-tuple license is closed and minimal

- Contracts: `CTR-DRB-004`
- Method: adversarial construction of the disallowed matrix: second
  attribute, quarantine/ResourceFork, name-only match, tuple on final temp,
  tuple on dotenv, tuple on user candidate, non-empty post-normalization
  set, non-canonical representation
- Environment: spec review (runtime execution evidence belongs to the future
  recovery chain's own acceptance items under the parents)
- Required evidence: review record of the closed matrix
- Expected result: every disallowed state stops fail-closed under unamended
  `CTR-REC-008`
- Failure condition: any state passes that the parent forbids

### ACC-DRB-005 — Scope and authority non-expansion

- Contracts: `CTR-DRB-005`
- Method: compare every path class, Grant/canary/transition exclusion, and
  authority declaration against both parents; grep for any new authorization
  verb
- Environment: repository authority branch
- Required evidence: comparison record
- Expected result: no new path, Grant, canary, transition, cleanup, or
  observation authority appears
- Failure condition: any expansion or any R1–R12 artifact becomes supply

### ACC-DRB-006 — Tested fact stays evidence-only

- Contracts: `CTR-DRB-006`
- Method: inspect every use of `STATE-DRB-001`/`OBS-DRB-001` in this Spec
- Environment: spec review
- Required evidence: usage list
- Expected result: the `[]` read is used only as NEW_EVIDENCE and recorded
  fact; execution authority always routes to fresh reads under parent
  contracts
- Failure condition: the recorded read is used as an execution precondition
  substitute

### Contract / Acceptance bidirectional coverage

| Contract | Acceptance coverage |
|---|---|
| `CTR-DRB-001` | `ACC-DRB-001` |
| `CTR-DRB-002` | `ACC-DRB-002` |
| `CTR-DRB-003` | `ACC-DRB-003` |
| `CTR-DRB-004` | `ACC-DRB-004` |
| `CTR-DRB-005` | `ACC-DRB-005` |
| `CTR-DRB-006` | `ACC-DRB-006` |

## 12. Alternatives and disposition

### ALT-DRB-001 — Continue `MINIMAL_ONE_TIME_OBSERVATION`

- Disposition: rejected
- Reason: `SCHEME_AUDIT_R1` Q4/Q5 — roughly 15+ steps and two administrator
  authentications versus direct's ~5 docs-only governance steps plus the
  shared rollback chain (one authentication); re-enters the 0/12 framework;
  its own stop rule already triggered once ("first new non-xattr blocker →
  amendment + DIRECT")
- Evidence/Claims considered: `OBS-DRB-003`, `OBS-DRB-004`, `CLM-DRB-002`
- What would reopen: a future Owner-accepted observation authority for a
  different need; not this rollback

### ALT-DRB-002 — Fully supersede the observation authority

- Disposition: rejected
- Reason: V0 supersession replaces a whole authority; the observation
  authority's evidence semantics, terminal-publication contracts, and
  non-reuse rulings remain valid and needed; only two orderings block the
  rollback
- Evidence/Claims considered: `OBS-DRB-006`, `SPEC_GOVERNANCE_V0` §9.2
- What would reopen: a whole-authority replacement decision by the Owner

### ALT-DRB-003 — Edit the accepted parents in place

- Disposition: rejected
- Reason: accepted immutability (`SPEC_FORMAT_V0` §14.1) and the hard
  boundary of this task; parents stay byte-identical
- Evidence/Claims considered: `OBS-DRB-006`, `SPEC_FORMAT_V0` §14.1
- What would reopen: none

### ALT-DRB-004 — Infer the staging tuple from user-side or dotenv tuples

- Disposition: rejected permanently
- Reason: parent `CLM-XOBS-002`/`ALT-XOBS-002` — object identity differs,
  values differ, and name/value/length equality cannot transfer
- Evidence/Claims considered: `OBS-DRB-007`
- What would reopen: never as inference

### ALT-DRB-005 — Relax the rollback audit chain instead

- Disposition: rejected
- Reason: the speedup must come only from removing the observation
  precondition; `CTR-REC-015` dual same-seal audits, Release Gate, and
  post-recovery audits are the load-bearing safety chain and remain
  mandatory (`CTR-DRB-003`)
- Evidence/Claims considered: `SCHEME_AUDIT_R1` Q3
- What would reopen: none

## 13. Migration, compatibility, and rollback

```text
MIGRATION = NONE (authority-layer effect only; no product/schema change)
COMPATIBILITY = both parents remain accepted at their exact revisions; other
  consumers of the observation authority are unaffected; a future separately
  accepted observation program remains possible and is simply no longer a
  rollback precondition
ROLLBACK_OF_THIS_AMENDMENT = a later accepted superseding authority; until
  then the removal is in force once this amendment is on main
OLD_CANDIDATES = R2/R5/v5/v6 and all R1–R12 observation artifacts remain
  evidence-only (parent CTR-XOBS-002, CTR-REC-002 unchanged)
EXECUTION_AUTHORITY = unchanged; remains solely with the accepted parents
```

## 14. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE (no supersession metadata or lifecycle mutation;
  the bounded effect uses new stable IDs in this new child-amendment
  authority with explicit parent-clause enumeration, per SPEC_FORMAT_V0 §2.7
  and the repository child-amendment precedent; semantic review verifies the
  boundary)
READY_TO_MARK_ACCEPTED = NO
```

## 15. Authoring result

```text
SPEC_GOVERNANCE_MODE = AUTHOR
TASK_NAME = 授权 执行
MODE = MINIMAL_AMENDMENT_AUTHORING_R1
SPEC_ID = AGENT_CORE_WORKFLOW_TRANSITION_DIRECT_ROLLBACK_AMENDMENT_V1
SPEC_KIND = implementation
STATUS = proposed
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none
GOVERNING_FRAMEWORK = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
PARENT_AUTHORITIES = AGENT_CORE_WORKFLOW_TRANSITION_DEPLOYMENT_RECOVERY_V1,
  AGENT_CORE_WORKFLOW_TRANSITION_ROOT_XATTR_OBSERVATION_V1
AUDIT_BASIS = SCHEME_AUDIT_R1 (SHA-256 4ff6defe810f302a93f8d529f5206b54141ced549119e12ceb368b6b86eebd74)
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 6
CONTRACTS_WITH_ACCEPTANCE = 6
NEW_EVIDENCE_SECTION = PRESENT (Section 8, Standing Order item 5)
AUTHORING_ROUND_DELTA = exactly 2 files (this Spec + README index row)
AUTHORING_READY_FOR_REVIEW = YES
```

This is an authoring claim only. It is not semantic review, acceptance,
implementation, rollback authorization, or production conformance.

## 16. Authority acceptance lifecycle

1. This exact docs-only head remains `proposed` on a Draft PR.
2. A new independent Direct Rollback Amendment Reviewer binds the exact base
   (`9ce88de6…`), head, Spec blob/SHA-256, both parent commit/blob/SHA-256
   tuples, the Section 0 removal/replacement/preservation enumeration, all 6
   Contracts and 6 Acceptance items, the NEW_EVIDENCE record, and the audit
   basis digest, then returns `ACCEPT` or `REVISE` in a persistent PR record.
3. `REVISE` returns to a new authoring revision; no recovery candidate work
   may begin.
4. Only after `ACCEPT`, mayf3 or an explicitly authorized maintainer performs
   a docs-only lifecycle transaction on this one file (`status: proposed ->
   accepted`; lifecycle fields and an acceptance record only).
5. A different independent final-head Reviewer proves
   `SEMANTIC_DELTA_AFTER_REVIEW = NONE`.
6. The Owner merges the exact accepted final head and reads it back from
   `github/main`.
7. Only then may a brand-new rollback-to-frozen-preimage recovery candidate
   be authored under the accepted recovery parent as amended by this Spec,
   following the full `CTR-REC-001`…`CTR-REC-016` chain with `CTR-DRB-003`'s
   preserved obligations and `CTR-DRB-004`'s staging-tuple license.

### Acceptance record (2026-09-01 lifecycle-only acceptance)

```text
REVIEWED_BASE                = 9ce88de6cbb6fe93c19f8e39b0065f95de1b7ffc
REVIEWED_SPEC_COMMIT         = f83dce94428b451047a4e472d93130244d7d2fe9
REVIEW_VERDICT               = PASS (0 blockers; 3 non-blocking observations)
REVIEW_COMMENT               = PR #136 issuecomment 5494269132
REQUIRED_FIXES               = NONE
SEMANTIC_DELTA_AFTER_REVIEW  = NONE
ACCEPTED_BY                  = Owner standing directive WORKFLOW_TRANSITION_FAST_GO_LIVE_V1 (2026-09-01)
```

The amendment author, semantic reviewer, acceptance actor, final-head
reviewer, and all later recovery-chain roles MUST remain distinct.
