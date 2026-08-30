---
spec_id: AGENT_CORE_GLOBAL_ROUTE_HEMOSTASIS_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: contracts_on_acceptance_only
scope:
  - temporary Agent Core global-route hemostasis from oc-go/deepseek-v4-flash to zai/glm-5.3 strict
  - authoritative migration-target inventory and first-spawn readiness
  - bounded ZAI credential recipients and complete production transaction
  - rollback of five pre-authority home mutations before a fresh migration transaction
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_WORKSPACE_SESSION_MODEL_V2
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2
  - SCHEDULER_TIMEOUT_OUTCOME_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - repository-maintainers
references:
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2.md
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2.md
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2.md
  - https://github.com/mayf3/dsh-agent-core/pull/117
---

# AGENT_CORE_GLOBAL_ROUTE_HEMOSTASIS_V1

> **PROPOSED / NOT ACCEPTED / DO NOT MERGE.** This is a docs-only candidate
> Authority. It makes no production, credential, Agent-home, LaunchDaemon, runtime,
> service, or implementation change. It authorizes nothing unless an independent
> reviewer passes the exact final head, the Owner accepts that exact head, and the
> accepted bytes are merged into `main`. The current PR #117 runner remains forbidden.

## 0. Authoring status and frozen coordinates

```text
TASK_NAME = 授权 执行
REPOSITORY = mayf3/dsh-agent-core
OBSERVED_MAIN_AT_DISPATCH = 9bb5b97442c7155da36f06e867d1a655410544ac
CURRENT_MAIN_AT_AUTHORING = 9bb5b97442c7155da36f06e867d1a655410544ac
HEMOSTASIS_EVIDENCE_PR = 117
REVIEWED_EVIDENCE_HEAD = 079638ef324859db571b6eebbfc0a8787650b061
INDEPENDENT_AUDIT_REVIEW_ID = 5061248705
INDEPENDENT_AUDIT_RESULT = REVISE
SPEC_STATUS = proposed
AUTHORITY_STATUS = PROPOSED
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCTION_APPLY_ALLOWED_NOW = NO
OWNER_ACCEPTANCE_RECORDED = NO
```

PR #117 is evidence input, not an authority dependency and not an implementation
branch. This Spec neither modifies nor accepts PR #117.

## 1. Goal

`GOAL-001` freezes the only goal:

```text
INCIDENT_ENTRY_CONDITION = OpenCode Go global route quota exhausted
TEMPORARY_TARGET = zai / glm-5.3 / fallbacks=[]
TARGET_MODE = GLM53_STRICT_SINGLE_ROUTE
```

During the OpenCode Go monthly-quota outage, every Agent in the frozen authoritative
migration target set MUST stop depending on the global `oc-go/deepseek-v4-flash`
route and MUST use exactly one `zai/glm-5.3` route with `fallbacks=[]`.

### 1.1 Completion line

`SUCCESS_CONDITION` is conjunctive. Completion requires all of the following:

1. the deployed global route and actual shared-runtime environment are
   `zai/glm-5.3`, `fallbacks=[]`;
2. every Agent in the frozen target snapshot has readiness `PASS`;
3. old `oc-go` Harness child count is exactly zero;
4. exactly one explicitly selected non-CTO canary Agent completes the isolated,
   no-delivery diagnostic turn defined by `CTR-HEM-018`;
5. the diagnostic's actual RPC route is provider `zai`, model `glm-5.3`, route
   attempts `1`, `fallbackActivated=false`, one invocation and one result;
6. scheduler health and notification-ingress health are both `PASS`;
7. no business task is replayed, no double delivery occurs, and observed OpenCode Go
   request count after activation is zero;
8. the deployment ledger, target snapshot, source/deployed-byte manifest, backup
   manifest, transaction receipt, and post-switch evidence are complete and pinned.

Activity, a successful restart, plist text, or one passing canary alone is not success.

### 1.2 Expiry and mandatory exit

```text
EXPIRY_CONDITION = earliest of EXPIRY_TIME_OR_EVENT
EXPIRY_TIME_OR_EVENT =
  (a) 14 calendar days after COMMIT, recorded before BEGIN_TRANSACTION; or
  (b) Owner-confirmed OpenCode Go quota restoration plus a separately authorized return; or
  (c) an accepted permanent or successor route Authority becomes effective; or
  (d) Owner revocation or any rollback trigger in this Spec
ROLL_FORWARD_PATH = source-stamped deployment under a separately accepted permanent/successor Authority
ROLLBACK_PATH = complete transaction rollback to the verified pre-BEGIN_TRANSACTION state
```

The runner MUST record an absolute UTC expiry before `BEGIN_TRANSACTION`. The temporary
route MUST NOT become an unbounded implicit default. Before expiry, an authorized Owner
must select and execute a separately governed roll-forward or this Spec's complete
rollback. If neither exit can be safely completed, activation MUST enter
`MANUAL_RECOVERY_REQUIRED`, keep scheduler dispatch and notification ingress paused, and
must not silently continue business delivery.

## 2. Scope and non-goals

### 2.1 In scope after acceptance only

- exact authoritative target inventory and freeze;
- bounded home settings and credential readiness for that frozen set;
- first-spawn settings/credential source readiness and minimal-settings correction;
- global LaunchDaemon provider/model flip;
- controlled shared-runtime restart and authoritative old-child drain;
- one isolated post-switch non-CTO diagnostic;
- full transaction backup, restore drill, rollback, ledger, and expiry exit.

### 2.2 Out of scope

```text
PR115_LUNA_CANDIDATE_DEPENDENCY = NONE
PR118_EVIDENCE_PR_DEPENDENCY = NONE
LUNA_ACTIVATION = OUT_OF_SCOPE
OPENAI_CODEX_OAUTH = OUT_OF_SCOPE
OPENCODE_BALANCE = OUT_OF_SCOPE
FAILED_TASK_REPLAY = OUT_OF_SCOPE
PERMANENT_MODEL_ROUTE_ARCHITECTURE = OUT_OF_SCOPE
```

This Spec is not Luna fallback activation, PR #115 implementation acceptance, PR #118
evidence merge, OpenCode Go recharge, permanent routing architecture, or failed-task
replay. Completion does not mean Luna is usable, PR #115 or #118 is mergeable, or a final
`glm53 -> luna` target state is complete.

## 3. Authority and dependencies

### 3.1 Relationship to current accepted route authority

`AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2` is target-only for
`agt_cto-agent`; it freezes other-Agent/global surfaces unchanged. This independent
Authority does not amend or supersede it. The CTO Agent remains under its accepted GLM53
strict override and MUST be excluded from global migration mutations unless its current
strict readiness would otherwise be broken. Any semantic conflict resolves fail-closed:
CTO accepted target-only constraints win and this activation stops.

### 3.2 Per-operation ruling

The following values describe what this proposal would authorize **only after acceptance
and only inside the transaction and gates in this Spec**:

```text
GLOBAL_LAUNCHD_ROUTE_FLIP_AUTHORITY = YES, exact oc-go/deepseek-v4-flash -> zai/glm-5.3 only
SHARED_RUNTIME_RESTART_AUTHORITY = YES, one controlled activation restart plus rollback/recovery restarts
OLD_AGENT_CHILD_DRAIN_AUTHORITY = YES, controlled shutdown; old oc-go count must reach zero
ALL_TARGET_AGENT_ROUTE_CHANGE_AUTHORITY = YES, frozen target snapshot only
HOME_SETTINGS_WRITE_AUTHORITY = YES, frozen target snapshot only
HOME_CREDENTIAL_WRITE_AUTHORITY = YES, authorized credential-recipient snapshot only
FIRST_SPAWN_SETTINGS_SOURCE_WRITE_AUTHORITY = YES, exact verified source only
FIRST_SPAWN_CREDENTIAL_SOURCE_WRITE_AUTHORITY = YES, exact verified source only
SECRET_FOOTPRINT_EXPANSION_AUTHORITY = YES, bounded recipients and expiry only
BACKUP_AND_RESTORE_AUTHORITY = YES, full covered-object transaction only
POST_SWITCH_DIAGNOSTIC_AUTHORITY = YES, exactly one bounded non-CTO no-delivery turn
```

No item above is a standalone grant. If its preconditions or exact allowlist cannot be
proved, the runner MUST set `ACTIVATION=STOPPED` before writing; it MUST NOT infer a
permission, reduce scope, warn-and-continue, or perform a partial substitute.

### 3.3 Current prohibition

Until acceptance and merge:

```text
GLOBAL_PLIST_CHANGE_AUTHORIZED_BY_PROPOSAL = NO
RUNTIME_RESTART_AUTHORIZED_BY_PROPOSAL = NO
HOME_WRITE_AUTHORIZED_BY_PROPOSAL = NO
CREDENTIAL_COPY_AUTHORIZED_BY_PROPOSAL = NO
FIRST_SPAWN_SOURCE_WRITE_AUTHORIZED_BY_PROPOSAL = NO
```

After acceptance these become bounded Contract authority, not an Owner command. A new
runner still requires independent audit and an explicit execution authorization.

## 4. Current State

- `STATE-HEM-001` — Repository source is `main` at
  `9bb5b97442c7155da36f06e867d1a655410544ac` for this authoring work. Basis:
  `OBS-HEM-001`.
- `STATE-HEM-002` — Production global route is
  `oc-go/deepseek-v4-flash`; global route changed = `NO`; runtime restarted = `NO`;
  incident resolved = `NO`. Basis: `OBS-HEM-002`, `EVD-HEM-001`.
- `STATE-HEM-003` — Five named Agent homes already have settings and credential-file
  mutations, and the production secret footprint has expanded. These are historical
  facts, not authorized state. Basis: `OBS-HEM-003`, `EVD-HEM-002`.
- `STATE-HEM-004` — Deployed route-critical source provenance is
  `UNSTAMPED_AND_COMMIT_AMBIGUOUS`. Basis: `OBS-HEM-004`, `EVD-HEM-003`.
- `STATE-HEM-005` — Full wakeable-Agent inventory and first-spawn source readiness were
  not independently verified because bounded root read access was unavailable. Basis:
  `OBS-HEM-005`, `EVD-HEM-004`.

Frozen truth:

```text
PRODUCTION_GLOBAL_ROUTE = oc-go / deepseek-v4-flash
GLOBAL_ROUTE_CHANGED = NO
RUNTIME_RESTARTED = NO
CURRENT_INCIDENT_RESOLVED = NO
PREEXISTING_PRODUCTION_HOME_MUTATIONS = YES
PREEXISTING_MUTATED_AGENTS =
  agt_shopping-list-agent
  agt_hr-agent
  agt_podcast-producer-agent
  agt_family-steward-agent
  agt_efficiency-agent
PREEXISTING_SETTINGS_CHANGED = YES
PREEXISTING_CREDENTIAL_FILES_CHANGED = YES
PREEXISTING_SECRET_FOOTPRINT_EXPANDED = YES
SOURCE_PROVENANCE = UNSTAMPED_AND_COMMIT_AMBIGUOUS
```

## 5. Observations

### OBS-HEM-001 — Authoring base

- Subject: `mayf3/dsh-agent-core` authoring worktree.
- Source revision: `origin/main@9bb5b97442c7155da36f06e867d1a655410544ac`.
- Environment: independent clean worktree.
- Observed at: authoring dispatch.
- Method: fetch origin, resolve `origin/main`, create a new worktree and branch.
- Result: dispatch main and authoring main are identical.
- Provenance: this PR's Git base and commit ancestry.

### OBS-HEM-002 — PR #117 production-state correction

- Subject: production global route and incident state.
- Source revision: PR #117 head `079638ef324859db571b6eebbfc0a8787650b061`.
- Environment: Agent Core production.
- Observed at: independent audit submission.
- Method: read PR body and review `5061248705` at the exact reviewed head.
- Result: plist remains `oc-go/deepseek-v4-flash`; runtime was not restarted; incident
  remains unresolved.
- Provenance: <https://github.com/mayf3/dsh-agent-core/pull/117>.

### OBS-HEM-003 — Five prior mutations

- Subject: the five Agent homes named in `STATE-HEM-003`.
- Source revision: PR #117 head and review `5061248705`.
- Environment: Agent Core production.
- Observed at: independent audit submission.
- Method: independent read-only metadata and parsed key-name verification recorded by
  the audit.
- Result: settings and credential files changed; ZAI key-name presence and pre-write
  backups were observed; secret footprint expanded.
- Provenance: PR #117 review `5061248705`.

### OBS-HEM-004 — Source provenance gap

- Subject: deployed route/provisioning closure.
- Source revision: production bytes observed by PR #117 audit.
- Environment: Agent Core production.
- Observed at: independent audit submission.
- Method: inspect source stamp and runner pins.
- Result: no trusted source stamp; runner pinned only a subset of route-critical bytes.
- Provenance: PR #117 review `5061248705`.

### OBS-HEM-005 — Inventory and first-spawn gap

- Subject: authoritative agents inventory and authsvc first-spawn sources.
- Source revision: production as audited at PR #117 head.
- Environment: Agent Core production.
- Observed at: independent audit submission.
- Method: bounded read-only audit without sudo.
- Result: complete registered/enabled/wakeable inventory and first-spawn settings and
  credential sources were unreadable and therefore unproved.
- Provenance: PR #117 review `5061248705`.

### OBS-HEM-006 — Repository first-spawn defaults

- Subject: `packages/agent-provisioning/src/index.js` at authoring base.
- Source revision: `9bb5b97442c7155da36f06e867d1a655410544ac`.
- Environment: repository source.
- Observed at: authoring.
- Method: source inspection.
- Result: provisioning copies `DSH_SETTINGS_SOURCE` or
  `~/.dsh/settings.yaml`, copies `~/.dsh/.credentials.yaml`, and its
  `MINIMAL_SETTINGS` is oc-go-only.
- Provenance: `packages/agent-provisioning/src/index.js:297-306,429-434`.

## 6. Claims and assumptions

### CLM-HEM-001 — A global flip without complete readiness can strand enabled Agents

- Support state: SUPPORTED.
- Supported by evidence: `EVD-HEM-004`, `EVD-HEM-005`.
- Contradicted by evidence: none known.
- Uncertainty: exact target count is intentionally unknown until root/read-only freeze.

### CLM-HEM-002 — The PR #117 runner is not a complete transaction

- Support state: SUPPORTED.
- Supported by evidence: `EVD-HEM-002`, `EVD-HEM-003`.
- Contradicted by evidence: none known.
- Uncertainty: none for the audited runner head.

### CLM-HEM-003 — Restoring the five homes before migration is the safest baseline

- Support state: SUPPORTED.
- Supported by evidence: `EVD-HEM-002`.
- Contradicted by evidence: none known.
- Uncertainty: Owner has not yet accepted this proposed disposition.

### CLM-HEM-004 — Source-byte identity is required for safe emergency apply

- Support state: SUPPORTED.
- Supported by evidence: `EVD-HEM-003`.
- Contradicted by evidence: none known.
- Uncertainty: none; this proposal selects the strict source-stamp option.

## 7. Evidence relations

### EVD-HEM-001 — Audit supports current global-route State

- Source observations: `OBS-HEM-002`.
- Target: `STATE-HEM-002`.
- Relation: SUPPORTS.
- Bound coordinates: PR #117 head and review `5061248705`.
- Strength/sufficiency: direct independent production-state record.
- Limitations: does not establish a later production state.
- Provenance: PR #117.

### EVD-HEM-002 — Audit supports prior-mutation State and transaction Claim

- Source observations: `OBS-HEM-003`.
- Target: `STATE-HEM-003`, `CLM-HEM-002`, `CLM-HEM-003`.
- Relation: SUPPORTS.
- Bound coordinates: PR #117 head and independent review.
- Strength/sufficiency: direct metadata inspection plus sandbox failure reproduction.
- Limitations: secret values were intentionally not read or hashed.
- Provenance: review `5061248705`.

### EVD-HEM-003 — Audit supports provenance State

- Source observations: `OBS-HEM-004`.
- Target: `STATE-HEM-004`, `CLM-HEM-004`.
- Relation: SUPPORTS.
- Bound coordinates: PR #117 reviewed head.
- Strength/sufficiency: sufficient to reject subset-only pins.
- Limitations: does not identify a unified deployed commit.
- Provenance: review `5061248705`.

### EVD-HEM-004 — Audit supports inventory-gap State

- Source observations: `OBS-HEM-005`.
- Target: `STATE-HEM-005`, `CLM-HEM-001`.
- Relation: SUPPORTS.
- Bound coordinates: production audit at reviewed PR head.
- Strength/sufficiency: sufficient to require a root/read-only preflight.
- Limitations: target count remains deliberately unresolved before execution freeze.
- Provenance: review `5061248705`.

### EVD-HEM-005 — Source supports first-spawn readiness Claim

- Source observations: `OBS-HEM-006`.
- Target: `CLM-HEM-001`.
- Relation: SUPPORTS.
- Bound coordinates: repository base `9bb5b97...`.
- Strength/sufficiency: direct source evidence of oc-go-only fallback.
- Limitations: deployed bytes still require source-stamp proof.
- Provenance: repository source lines cited by `OBS-HEM-006`.

## 8. Decisions

### DEC-HEM-001 — Temporary strict global route

- Decision owner: repository Owner.
- Decision: after all gates, use exactly `zai/glm-5.3`, `fallbacks=[]` for the
  global route during this incident.
- Rejected alternative: Luna fallback or multi-route activation.
- Reason: this Authority is strict temporary hemostasis and must not activate Luna.

### DEC-HEM-002 — Authoritative frozen target set

- Decision owner: repository Owner.
- Decision:

```text
MIGRATION_TARGET_SET = every Agent that simultaneously:
  - appears in authoritative production agents.json;
  - is enabled;
  - can be awakened through binding, scheduler, notification ingress, workflow,
    or direct runtime invocation;
  - belongs to the Agent Core production root; and
  - is not explicitly listed by Owner in the exclusion set.
```

`agt_cto-agent` MUST be in the explicit exclusion set because its accepted strict override
is preserved. Exclusions MUST include reason and governing authority; no implicit
exclusion is allowed.
- Rejected alternatives: live-process list; all home directories; `96 homes = 96 Agents`;
  discover-and-mutate; expanding the set after freeze.
- Reason: dormant-but-enabled Agents remain wakeable production subjects.

### DEC-HEM-003 — Target snapshot contract

- Decision owner: repository Owner.
- Decision:

```text
TARGET_SET_SNAPSHOT_PATH = <root-owned-secure-staging>/target-set.snapshot.json
TARGET_SET_SNAPSHOT_SHA256 = lowercase SHA-256 of canonical snapshot bytes (not secret material)
TARGET_SET_FREEZE_TIME = UTC RFC3339 recorded before any write
TARGET_SET_AUTHORIZED_BY_OWNER = required exact digest acceptance before BEGIN_TRANSACTION
```

`TARGET_SET_SNAPSHOT_SCHEMA` is defined by `CTR-HEM-002`. If full inventory cannot be
read with bounded root/read-only access, `ACTIVATION=STOPPED`.

### DEC-HEM-004 — Missing home and first-spawn fail closed

- Decision owner: repository Owner.
- Decision:

```text
MISSING_HOME_POLICY = FAIL_CLOSED
NEW_AGENT_CREATION_DURING_MIGRATION = FORBIDDEN
MISSING_ZAI_READINESS_DISPOSITION = BLOCK_GLOBAL_FLIP
FIRST_SPAWN_SETTINGS_SOURCE_WRITE = AUTHORIZED_IN_TRANSACTION
FIRST_SPAWN_CREDENTIAL_SOURCE_WRITE = AUTHORIZED_IN_TRANSACTION
MINIMAL_SETTINGS_CHANGE = AUTHORIZED_AS_IMPLEMENTATION_PRECONDITION
```

Before global flip, the transaction must verify `DSH_SETTINGS_SOURCE`,
`/Users/authsvc/.dsh/settings.yaml`, `/Users/authsvc/.dsh/.credentials.yaml`, deployed
`MINIMAL_SETTINGS`, provision path, ZAI provider declaration, GLM-5.3 model declaration,
and secure `ZAI_API_KEY` source. New Agent provisioning remains paused from `FREEZE`
through `COMMIT` or rollback. Any missing home or readiness gap stops activation; it is
never a warning.

### DEC-HEM-005 — Credential source and recipient boundary

- Decision owner: repository Owner.
- Decision:

```text
CANONICAL_ZAI_CREDENTIAL_SOURCE = /Users/authsvc/.dsh/.credentials.yaml
AUTHORIZED_CREDENTIAL_READERS = bounded root transaction runner and the existing uid-502
  first-spawn provisioner only; no Agent child receives source-path read authority
AUTHORIZED_CREDENTIAL_WRITERS = bounded root transaction runner only
AUTHORIZED_CREDENTIAL_RECIPIENT_CLASS =
  (a) canonical first-spawn source /Users/authsvc/.dsh/.credentials.yaml, and
  (b) .credentials.yaml of each Agent in the frozen target snapshot only
AUTHORIZED_RECIPIENT_SNAPSHOT = <root-owned-secure-staging>/credential-recipients.snapshot.json;
  canonical non-secret path/agent list and SHA-256 accepted by Owner before BEGIN_TRANSACTION
CREDENTIAL_KEY = ZAI_API_KEY
```

The canonical source is the exact existing first-spawn credential source and MUST NOT be
populated from, replaced by, or compared byte-for-byte with `agt_cto-agent` (or any other
Agent home). Only the bounded readers above may access it, and only the root-owned runner
may write recipient files. A target Agent may hold the key only while it remains in the
frozen recipient set and this Authority is unexpired. `agt_cto-agent` may continue holding
its separately authorized key but is not a source or a new recipient under this Spec.
Canonical and target credential files MUST be regular, no-follow, owner uid `502`, group
gid `20`, mode `0600`; any identity mismatch stops activation and requires Authority
revision rather than implicit chmod/chown.
- Rejected alternative: “copy from agt_cto-agent home to everyone.”
- Reason: an Agent home is not a canonical fleet secret source.

### DEC-HEM-006 — Prior five writes are rolled back first

- Decision owner: repository Owner.
- Proposed decision:

```text
PREEXISTING_FIVE_WRITES_DISPOSITION = ROLLBACK_TO_PREWRITE_BACKUPS
PROPOSED_DEFAULT = ROLLBACK_TO_PREWRITE_BACKUPS
OWNER_DECISION_RECORDED = NO
```

The future accepted runner must first execute a separately identified
`PREEXISTING_FIVE_RESTORE` phase using this exact evidence-bound allowlist (hashes are the
already-published whole-file backup integrity digests; the runner MUST NOT read, print, or
hash an individual secret value):

| Agent | Exact backup path suffix | Published pre-write SHA-256 |
|---|---|---|
| `agt_shopping-list-agent` | `.zhixue-backup-20260830/agt_shopping-list-agent/settings.yaml` | `3a3406785e34ecf6d333551d10dd090d1e160e12088ecfa3ec87b826bbeb64aa` |
| `agt_shopping-list-agent` | `.zhixue-backup-20260830/agt_shopping-list-agent/.credentials.yaml` | `a7436f44c856cd88d9612eb56dc2f2e7870bf1892d81d6b3fe4cc5dca75003ce` |
| `agt_hr-agent` | `.zhixue-backup-20260830/agt_hr-agent/settings.yaml` | `3a3406785e34ecf6d333551d10dd090d1e160e12088ecfa3ec87b826bbeb64aa` |
| `agt_hr-agent` | `.zhixue-backup-20260830/agt_hr-agent/.credentials.yaml` | `a7436f44c856cd88d9612eb56dc2f2e7870bf1892d81d6b3fe4cc5dca75003ce` |
| `agt_podcast-producer-agent` | `.zhixue-backup-20260830/agt_podcast-producer-agent/settings.yaml` | `3a3406785e34ecf6d333551d10dd090d1e160e12088ecfa3ec87b826bbeb64aa` |
| `agt_podcast-producer-agent` | `.zhixue-backup-20260830/agt_podcast-producer-agent/.credentials.yaml` | `a7436f44c856cd88d9612eb56dc2f2e7870bf1892d81d6b3fe4cc5dca75003ce` |
| `agt_family-steward-agent` | `.zhixue-backup-20260830/agt_family-steward-agent/settings.yaml` | `3a3406785e34ecf6d333551d10dd090d1e160e12088ecfa3ec87b826bbeb64aa` |
| `agt_family-steward-agent` | `.zhixue-backup-20260830/agt_family-steward-agent/.credentials.yaml` | `a7436f44c856cd88d9612eb56dc2f2e7870bf1892d81d6b3fe4cc5dca75003ce` |
| `agt_efficiency-agent` | `.zhixue-backup-20260830/agt_efficiency-agent/settings.yaml` | `3a3406785e34ecf6d333551d10dd090d1e160e12088ecfa3ec87b826bbeb64aa` |
| `agt_efficiency-agent` | `.zhixue-backup-20260830/agt_efficiency-agent/.credentials.yaml` | `a7436f44c856cd88d9612eb56dc2f2e7870bf1892d81d6b3fe4cc5dca75003ce` |

The common absolute backup root is
`/Users/authsvc/.agent-core/homes/.zhixue-backup-20260830/`; each restore target is the
same suffix with that backup-root segment removed. Before use, an independent bounded
root/read-only task MUST confirm each path is a regular no-follow file and matches its
published whole-file digest without emitting bytes. The restore changes only those exact
ten targets and their recorded metadata; it must not restart runtime because the global
route/runtime never consumed these writes. It must prove the added `ZAI_API_KEY` copies
are absent from those five homes and that all non-ZAI preimage keys/bytes and metadata
match the exact backups. Only after an independently verified restore receipt may a fresh
migration transaction start and reapply readiness uniformly.

This is not retroactive authorization. If exact backup hashes, path identity, or secret
footprint restoration cannot be proved, activation stops in
`MANUAL_RECOVERY_REQUIRED`. Owner may change this proposed decision only through an
independently reviewed semantic revision before acceptance.

### DEC-HEM-007 — One complete transaction

- Decision owner: repository Owner.
- Decision: the later runner is one full transaction:

```text
PREPARE
→ FREEZE
→ BACKUP
→ RESTORE_DRILL
→ BEGIN_TRANSACTION
→ HOME_AND_SOURCE_MUTATIONS
→ PLIST_MUTATION
→ CONTROLLED_RESTART
→ POST_SWITCH_VERIFICATION
→ COMMIT
```

No production write may occur before `BEGIN_TRANSACTION`, except the independently gated
`PREEXISTING_FIVE_RESTORE`, which must fully complete and close before `PREPARE` of the new
migration. Backup creation is read/copy preparation, not mutation of covered production
objects; backup directories themselves are transaction-covered state.

### DEC-HEM-008 — Authoritative drain, not process age

- Decision owner: repository Owner.
- Decision: quiescence requires scheduler dispatch pause, notification-ingress pause or
  drain, runtime in-flight turn registry `0`, delivery queue/pending ledger `0`, tool
  execution registry `0`, owner/single-writer lock held with prior owner lock released,
  controlled shutdown of old Harness children, and old `oc-go` child count `0`.
- Rejected alternative: infer no in-flight work from `process age < 180 seconds`.
- Reason: process age is not an in-flight or side-effect boundary.

### DEC-HEM-009 — Strict source stamp before hemostasis

- Decision owner: repository Owner.
- Decision:

```text
SOURCE_PROVENANCE = UNSTAMPED_AND_COMMIT_AMBIGUOUS
SOURCE_STAMP_REQUIRED_BEFORE_HEMOSTASIS = YES
EMERGENCY_UNSTAMPED_EXCEPTION = NO
```

A trusted source stamp and deployed-byte manifest are mandatory before activation. They
must cover every route-closure-critical deployed byte, including production-runtime
entry/compose/model-overrides/paths; agent-router route-chain/process/env/spawn/
agent-process/process-registry/provider-errors/RPC; provisioning; production-runtime shim;
Harness CLI; and spawn helper. Exact deployed bytes, source commit/blob identity, mode,
owner/group, path, and SHA-256 are recorded. Any drift stops activation. Subset-only plist
and overrides pins are rejected.

### DEC-HEM-010 — Exactly one isolated diagnostic

- Decision owner: repository Owner.
- Decision: after switch, authorize exactly one
  `NON_CTO_NO_DELIVERY_DIAGNOSTIC_TURN` on a canary Agent named in the frozen snapshot and
  accepted by Owner before `BEGIN_TRANSACTION`.
- Constraints: isolated fresh session; Feishu delivery disabled; scheduler business
  delivery disabled; no tools; no external side effects; fixed non-secret reply token;
  exactly one invocation/result; provider `zai`; model `glm-5.3`; attempts `1`;
  fallback false; observed oc-go requests `0`; session/job cleanup after evidence capture.
- Rejected alternative: treat the pre-switch author self-canary as acceptance.

## 9. Contracts

### CTR-HEM-001 — Authority activation gate

No implementation or production action under this Spec is permitted unless the exact Spec
head receives independent semantic review `PASS`, the Owner accepts the exact unchanged
head, accepted bytes merge into `main`, a new runner is independently audited, and an
explicit execution authorization names its exact digest. PR #117's runner MUST NOT be
used.

### CTR-HEM-002 — Target snapshot schema and freeze

Before any new migration write, the root/read-only inventory phase MUST create canonical
JSON with schema:

```text
{
  schemaVersion: 1,
  productionRoot: absolute-path,
  authoritativeAgentsJson: {path, sha256},
  freezeTime: RFC3339-UTC,
  ownerAuthorizationRef: string,
  exclusions: [{agentId, reason, authority}],
  agents: [{
    agentId, enabled, productionRootMember,
    wakeSources: {binding, scheduler, notificationIngress, workflow, directRuntime},
    homePath, homeExists, settingsPath, credentialPath,
    routeDisposition, readiness
  }],
  canaryAgentId,
  snapshotSha256
}
```

Agent IDs MUST be unique and sorted; `wakeSources` booleans MUST derive from complete
registries, not live processes. Every included Agent MUST satisfy `DEC-HEM-002`; every
excluded enabled/wakeable Agent MUST have explicit Owner authority. The runner MUST verify
canonical bytes and `TARGET_SET_SNAPSHOT_SHA256` immediately before
`BEGIN_TRANSACTION`. Inventory unreadable, incomplete, changed after freeze, or expanded
after migration starts means `ACTIVATION=STOPPED`.

### CTR-HEM-003 — First-spawn and missing-home gate

Global flip MUST NOT begin until all paths and declarations in `DEC-HEM-004` parse and
prove ZAI/GLM53 strict readiness. The accepted implementation may update the first-spawn
settings source, first-spawn credential source, and `MINIMAL_SETTINGS` only within the
full transaction and source-stamped deployment. New Agent provision is paused. A missing
home, missing source, duplicate YAML key, absent ZAI provider/model, absent key-presence,
or unverified provisioning path MUST fail closed and trigger rollback if a transaction
has begun.

### CTR-HEM-004 — Secret handling

The runner MUST NOT read secret values into stdout/stderr, argv, logs, Git, transcripts,
ledger, evidence, or hashes. It MAY verify only key presence and non-secret file metadata.
All secret copies use root-owned secure staging, `umask 077`, no-follow open semantics,
regular-file gate, exact path allowlist, atomic temporary file in the destination
directory, file `fsync`, atomic `rename`, and parent-directory `fsync`. YAML must parse
once and contain neither duplicate mapping keys nor duplicate `ZAI_API_KEY`. Error paths
must redact values. Secret temporary/staging copies are restored or securely removed
according to the transaction receipt; inability to prove cleanup is
`MANUAL_RECOVERY_REQUIRED`.

### CTR-HEM-005 — Prior five-write restoration

Before the new migration transaction, the restore task defined by `DEC-HEM-006` MUST use
an exact ten-file allowlist and exact independently checked backup hashes. It MUST reject
symlinks/non-regular files/hash drift, restore bytes and recorded owner/group/mode plus
ACL/xattr when present, use atomic no-follow writes, and emit a non-secret receipt proving
only those ten targets changed. No restart is required or permitted. Secret footprint
restoration requires key-name absence in the five restored credential files and deletion
of only the exact unauthorized backup/staging secret copies identified by the evidence.
Any uncertainty stops activation; the new migration starts only from the verified restored
baseline.

### CTR-HEM-006 — Covered transaction objects

The transaction MUST cover: every target Agent settings file; every authorized recipient
credential file; first-spawn settings source; first-spawn credential source; deployed
`MINIMAL_SETTINGS`/provisioning closure; LaunchDaemon plist; owner/group/mode; existing
ACL/xattr; runtime state; child-process state; scheduler/ingress pause state; backup and
staging directories; source stamp/byte manifest; and deployment ledger. Rollback MUST
restore all covered objects, not only the plist.

### CTR-HEM-007 — Transaction mechanics

The runner MUST use root-owned secure staging, one single-writer lock, `mktemp`, `umask
077`, no symlink traversal, regular-file checks, exact absolute-path allowlist, exact
preimage hashes, same-filesystem atomic rename, file and directory `fsync`, and durable
phase receipts. It MUST trap `ERR`, `EXIT`, `INT`, `TERM`, and `HUP`. Disk-full,
short/partial write, rename failure, fsync failure, signal, and process death faults MUST
enter full rollback. A rollback failure MUST enter the named
`MANUAL_RECOVERY_REQUIRED` state with scheduler/ingress paused and exact unresolved
objects recorded without secrets.

### CTR-HEM-008 — Backup and restore drill

Before `BEGIN_TRANSACTION`, every covered mutable production object MUST have an exact
preimage backup and manifest containing path, file type, byte hash, size, owner/group/mode,
and ACL/xattr when present. A root-owned isolated restore drill MUST reconstruct and
compare every object and metadata. Backup or drill failure stops activation with zero new
migration writes.

### CTR-HEM-009 — Begin-transaction boundary

`BEGIN_TRANSACTION` is a durable ledger record containing lock identity, frozen target and
recipient digests, source manifest digest, backup manifest digest, restore-drill result,
preimage hashes, absolute expiry, and execution authorization. No covered production
mutation may occur before that record is fsynced. All later phases are either committed
together or fully rolled back.

### CTR-HEM-010 — Quiescence and old children

Before mutation/restart, scheduler dispatch and notification ingress MUST pause/drain;
runtime in-flight turns, delivery/pending ledger, and tool execution registry MUST each be
zero. The old owner lock MUST be released before the transaction owner proceeds. Old
Harness children MUST undergo controlled shutdown. After restart:

```text
OLD_OC_GO_CHILD_COUNT > 0 -> ACTIVATION FAIL / ROLLBACK
```

Warnings are forbidden. Process age is not admissible drain evidence.

### CTR-HEM-011 — Uniform home and first-spawn mutations

Settings and credential readiness MUST be applied to the entire frozen authorized set as
one transaction, not one discovered Agent at a time. Settings MUST declare the exact ZAI
provider/model required by deployed Harness syntax and preserve unrelated keys. Credential
files MUST preserve unrelated keys and satisfy `CTR-HEM-004`. First-spawn sources and
`MINIMAL_SETTINGS` MUST be ready before plist mutation. Any target failure rolls back all
covered home/source mutations.

### CTR-HEM-012 — Exact plist mutation and controlled restart

Only after `CTR-HEM-002` through `CTR-HEM-011` pass may the runner atomically change the
exact allowed LaunchDaemon provider/model values from `oc-go/deepseek-v4-flash` to
`zai/glm-5.3`; fallbacks remain empty by deployed route configuration. The plist must pass
`plutil -lint`, exact semantic diff, owner/group/mode, ACL/xattr, and hash checks. One
controlled shared-runtime restart is allowed. Bootstrap, PID/label identity, liveness, and
actual runtime env must pass or the complete transaction rolls back.

### CTR-HEM-013 — CTO override preservation

The `agt_cto-agent` accepted strict `zai/glm-5.3`, `fallbacks=[]` override, credential
boundary, and actual route MUST remain correct before and after activation. The global
transaction MUST NOT remove, broaden, or add Luna to that override. Any CTO route or
credential-boundary drift triggers rollback.

### CTR-HEM-014 — Idempotence and inconsistent target state

`ALREADY_APPLIED` is allowed only when all of these independently pass: actual runtime
env; runtime PID and launchd label; complete frozen inventory; first-spawn readiness;
every target home readiness; old oc-go child count zero; actual new child RPC route;
post-switch diagnostic; scheduler/ingress health; deployment ledger; unexpired Authority;
and exact source/deployed-byte pins. Plist text alone MUST NOT yield success. Any missing
or conflicting item is `INCONSISTENT_TARGET_STATE`, which fails closed and invokes
reconciliation/rollback rather than exit `0`.

### CTR-HEM-015 — Source provenance gate

`SOURCE_STAMP_REQUIRED_BEFORE_HEMOSTASIS=YES`. Before transaction, exact source and deployed
byte identity for the complete list in `DEC-HEM-009` MUST be verified and Owner-accepted.
The source stamp and manifest MUST be durable and part of backups and ledger. Any missing
byte, ambiguous commit, dirty source, unaccepted manifest, or drift triggers
`ACTIVATION=STOPPED` before writes or rollback after transaction start. No emergency
exception is reusable or allowed by V1.

### CTR-HEM-016 — Route and request observability

Post-restart evidence MUST prove the deployed route chain has exactly one route, actual RPC
provider/model is `zai/glm-5.3`, attempts is `1`, `fallbackActivated=false`, and observed
OpenCode Go requests is `0`. Evidence MUST come from non-secret runtime/RPC/provider
telemetry with exact PID/session/time boundaries, not configuration text alone.

### CTR-HEM-017 — Scheduler and ingress safety

Scheduler dispatch and notification ingress remain paused until all post-switch route,
child, diagnostic, delivery, and health gates pass. Health probes MUST be no-delivery and
must prove one consumer/owner path, no pending duplicate, and no replay. Business tasks and
failed occurrences MUST NOT be replayed. Any unhealthy scheduler/ingress state, duplicate
admission/delivery, or unresolved outcome rolls back and remains paused.

### CTR-HEM-018 — Unique non-CTO no-delivery diagnostic

The Owner-authorized canary from the frozen snapshot MUST be non-CTO and ready. Exactly one
fresh isolated diagnostic session/job may invoke exactly one fixed prompt with tools and
all delivery disabled and expect one fixed token. It MUST produce one invocation and one
result with provider `zai`, model `glm-5.3`, attempts `1`, fallback false, and zero oc-go
requests. Any retry, tool use, external side effect, scheduler/Feishu business delivery,
second result, wrong route, or cleanup failure triggers rollback. The session/job is
deleted or closed per normal retention immediately after a durable evidence receipt; no
business state is merged into `main` session.

### CTR-HEM-019 — Commit and expiry ledger

`COMMIT` occurs only after every success condition passes and a durable non-secret ledger
records exact target/recipient/source/backup/transaction/evidence hashes, runtime PID and
label, route tuple, health results, zero-old-child result, zero-oc-go result, diagnostic
identity, activation time, expiry, and rollback coordinates. The ledger MUST NOT include
secret values or secret hashes. An expiry monitor/Owner task MUST be established before
unpausing delivery; failure to establish it triggers rollback.

### CTR-HEM-020 — Rollback triggers

Any of the following requires rollback: incomplete inventory; incomplete target readiness;
incomplete first-spawn source; nonzero in-flight state; nonzero old child; hash drift; YAML
parse or duplicate-key failure; credential-boundary failure; plist lint failure; runtime
bootstrap failure; wrong runtime env; wrong CTO override; diagnostic failure;
scheduler/ingress unhealthy; any oc-go request; double delivery; source-provenance gate
failure; disk/partial-write fault; signal; transaction receipt failure; or expiry without a
separately authorized roll-forward.

### CTR-HEM-021 — Rollback outcomes

```text
ROLLBACK_SUCCESS =
  every covered production byte and metadata restored to exact pre-BEGIN_TRANSACTION
  preimage; source/first-spawn/home/plist/ACL/xattr/runtime/child/pause/backup/ledger
  semantics reconciled; old/new child state matches restored route; no unauthorized
  secret copies remain; verification receipt durable

ROLLBACK_INCOMPLETE =
  any covered object, metadata, runtime/child state, secret-copy disposition, pause state,
  backup/staging directory, or ledger cannot be proved restored

MANUAL_RECOVERY_REQUIRED =
  named fail-closed state entered on ROLLBACK_INCOMPLETE; scheduler and notification
  ingress remain paused; no business delivery, retry, replay, or further automated write;
  exact unresolved non-secret paths/hashes/state and recovery owner recorded
```

Rollback restart is permitted only when required to make runtime match the restored plist
and environment. Rollback MUST NOT claim production restored until `ROLLBACK_SUCCESS`.

### CTR-HEM-022 — Track isolation

This transaction MUST NOT depend on or modify PR #115, PR #118, Luna/OAuth, OpenCode
balance, failed-task replay, or a permanent route design. No Luna call is permitted. Its
completion changes none of those tracks' lifecycle or merge status.

### CTR-HEM-023 — No retroactive authority

The ledger, PR, runner, and reports MUST state that the five prior writes happened without
this Authority. Acceptance can decide future rollback/retention only; it MUST NOT describe
past writes as authorized, ratified, compliant, or covered at the time they occurred.

## 10. Acceptance

| Acceptance ID | Contracts | Method / required evidence | Expected result | Failure condition |
|---|---|---|---|---|
| ACC-HEM-001 | CTR-HEM-001, CTR-HEM-023 | exact-head governance review, Owner acceptance, main ancestry, runner digest/audit | authority and runner gates all present; no retroactivity | any missing gate or PR #117 runner use |
| ACC-HEM-002 | CTR-HEM-002 | root/read-only inventory across agents/bindings/scheduler/notification/workflow/runtime; schema and digest verification | complete immutable target snapshot | unreadable source, missing wake source, dynamic expansion |
| ACC-HEM-003 | CTR-HEM-003, CTR-HEM-011 | parse settings/sources/MINIMAL_SETTINGS and dry-run first-spawn into isolated root | every target and fresh provision is ZAI/GLM53 strict ready | missing home/source/declaration or WARN continuation |
| ACC-HEM-004 | CTR-HEM-004 | static and fault-injection checks for no-follow, duplicate YAML, atomic write, fsync, redaction and cleanup | only metadata/key-presence evidence; no leak | secret value/hash/output or residual temp copy |
| ACC-HEM-005 | CTR-HEM-005 | exact ten-file backup/hash/metadata restore and independent diff | five homes restored; no restart; secret footprint restored | extra path touched or any unproved preimage |
| ACC-HEM-006 | CTR-HEM-006, CTR-HEM-007, CTR-HEM-008, CTR-HEM-009 | complete manifest, restore drill, lock and phase receipts; disk-full/partial-write and ERR/EXIT/INT/TERM/HUP injection | zero writes before durable begin; full rollback on each fault | plist-only or partial rollback |
| ACC-HEM-007 | CTR-HEM-010 | pause/drain registries and controlled child shutdown telemetry | all registries and old oc-go children exactly zero | age heuristic, warning, or old child >0 |
| ACC-HEM-008 | CTR-HEM-012, CTR-HEM-013 | plist lint/diff, launchd identity, restart/bootstrap/env and CTO checks | exact target env and preserved CTO strict override | extra plist delta, wrong PID/env/CTO route |
| ACC-HEM-009 | CTR-HEM-014 | exercise pristine, already-applied, and intentionally inconsistent states | ALREADY_APPLIED only for complete verified state | plist-only exit 0 |
| ACC-HEM-010 | CTR-HEM-015 | source stamp plus full route-closure deployed-byte manifest verification | exact Owner-accepted source/byte identity | missing/drifted/ambiguous/subset pin |
| ACC-HEM-011 | CTR-HEM-016, CTR-HEM-018 | one isolated non-CTO fixed-token diagnostic with RPC/provider/request telemetry | one result; zai/glm-5.3; attempts 1; fallback false; oc-go 0 | retry, delivery, tool, side effect, wrong route, cleanup failure |
| ACC-HEM-012 | CTR-HEM-017 | scheduler/ingress no-delivery health and queue/delivery audit | healthy; no replay or duplicate; safe unpause | unhealthy, pending unknown, replay, dual delivery |
| ACC-HEM-013 | CTR-HEM-019 | durable ledger and expiry-exit drill | complete non-secret receipt and bounded expiry | absent monitor/expiry/rollback coordinates |
| ACC-HEM-014 | CTR-HEM-020, CTR-HEM-021 | inject every enumerated rollback trigger and verify complete restored state | ROLLBACK_SUCCESS or named fail-closed manual recovery | false restored claim or business delivery while incomplete |
| ACC-HEM-015 | CTR-HEM-022 | docs/code/production diff and network-call audit | no Luna/PR115/PR118/balance/replay dependency or call | any cross-track dependency or Luna call |

Coverage is bidirectional: every `CTR-HEM-001` through `CTR-HEM-023` appears above, and
every Acceptance row names existing Contracts.

## 11. Alternatives and disposition

| Alternative | Disposition | Reason / reopen condition |
|---|---|---|
| Execute PR #117 runner | REJECTED | independent audit found authority and transaction blockers; replace runner only after this Authority is accepted |
| Retroactively authorize five writes | REJECTED | new authority cannot rewrite past governance facts |
| Retain five writes as prestaging | REJECTED_IN_PROPOSAL | may reopen only by semantic revision with explicit Owner acceptance, failure retention, and bounded secret duration |
| Missing home WARN and continue | REJECTED | dormant-but-enabled Agent could fail after global flip |
| Infer target set from live processes or homes | REJECTED | neither is the authoritative wakeable inventory |
| Process age as quiescence | REJECTED | not evidence of zero in-flight turns/tools/delivery |
| Plist-only rollback | REJECTED | transaction mutates homes, sources, secrets, runtime and ledger |
| Plist text means ALREADY_APPLIED | REJECTED | does not prove actual runtime/inventory/health/source state |
| Copy ZAI key from CTO home | REJECTED | Agent home is not canonical fleet secret source |
| Unstamped emergency exception | REJECTED | selected policy is source stamp required before hemostasis |
| Luna fallback / PR #115 or #118 dependency | REJECTED | separate tracks and explicitly out of scope |
| Permanent GLM global default | REJECTED | temporary authority has explicit expiry and mandatory exit |

## 12. Migration, compatibility, and rollback

### 12.1 Required phase state machine

1. `PREEXISTING_FIVE_RESTORE`: close historical partial state under `CTR-HEM-005`.
2. `PREPARE`: verify accepted authority, runner digest/audit, execution authorization,
   canonical secret metadata, source stamp, allowlists, free space, and tools.
3. `FREEZE`: pause provisioning, snapshot target/recipient sets, set canary and expiry,
   pause/drain scheduler and notification ingress.
4. `BACKUP`: capture every covered object and metadata to secure root staging.
5. `RESTORE_DRILL`: reconstruct and compare every backup.
6. `BEGIN_TRANSACTION`: fsync the boundary ledger; only now may new migration writes occur.
7. `HOME_AND_SOURCE_MUTATIONS`: uniformly update targets and first-spawn sources.
8. `PLIST_MUTATION`: exact linted global tuple change.
9. `CONTROLLED_RESTART`: stop old children, restart shared runtime, prove identity/env/zero old.
10. `POST_SWITCH_VERIFICATION`: unique diagnostic, route/request/health/delivery gates.
11. `COMMIT`: durable receipt, expiry monitor, then controlled ingress/scheduler unpause.

Any failure from step 6 onward enters complete rollback. Failures before step 6 stop with
zero new migration writes. A failure in the preexisting-five restore never enters the new
migration transaction.

### 12.2 Roll-forward

Roll-forward requires a separately accepted permanent/successor Authority and source-
stamped deployment. This Spec cannot self-extend or silently convert temporary GLM53 into
the permanent default.

### 12.3 Rollback

Rollback follows `CTR-HEM-020` and `CTR-HEM-021`; it restores the complete covered set and
runtime relationship. If exact restoration is not provable, the system remains paused in
`MANUAL_RECOVERY_REQUIRED`. No task replay is allowed during or after rollback.

### 12.4 Compatibility

CTO strict routing stays governed by its accepted authority. Session, Agent, Workspace,
Scheduler occurrence/outcome, notification idempotency, and business-delivery semantics
remain unchanged. This Spec changes only the temporary route/readiness transaction for the
frozen target set after acceptance.

## 13. Open questions and acceptance readiness

```text
OPEN_OWNER_DECISIONS =
  PREEXISTING_FIVE_WRITES_DISPOSITION must be accepted as the proposed rollback default
  or changed by an independently reviewed semantic revision before acceptance
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE (conflict with CTO target-only authority fails closed)
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 23
CONTRACTS_WITH_ACCEPTANCE = 23
AUTHORING_READY_FOR_REVIEW = YES
READY_FOR_INDEPENDENT_AUDIT = YES
READY_FOR_OWNER_ACCEPTANCE = NO
```

Independent review must verify the exact final head, Contract/Acceptance coverage,
credential and transaction boundaries, target-set completeness semantics, expiry, rollback,
and non-conflict with accepted CTO authority. Review recommendation is not acceptance.
