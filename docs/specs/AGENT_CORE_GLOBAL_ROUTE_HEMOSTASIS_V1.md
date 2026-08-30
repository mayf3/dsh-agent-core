---
spec_id: AGENT_CORE_GLOBAL_ROUTE_HEMOSTASIS_V1
status: proposed
spec_kind: program
authority_level: governing_spec
implementation_authority: none
scope:
  - temporary Agent Core global-route hemostasis Governing Authority: goals, boundaries, precedence, child-authority DAG, and the requirements each child authority, artifact audit, and Owner gate must satisfy
  - authoritative migration-target universe partition and recipient-set schema
  - canonical ZAI credential-source mechanical-resolution policy, secret-boundary policy, and secret lifecycle
  - frozen disposition of the five pre-authority home writes and the separate restore-transaction requirements
  - drain, diagnostic, expiry-monitor, and post-COMMIT exit semantics
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
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2_HEMOSTASIS_COMPATIBILITY_AMENDMENT_V1.md
  - https://github.com/mayf3/dsh-agent-core/pull/117
  - https://github.com/mayf3/dsh-agent-core/pull/120
---

# AGENT_CORE_GLOBAL_ROUTE_HEMOSTASIS_V1

> **PROPOSED / NOT ACCEPTED / DO NOT MERGE.** This is a docs-only candidate
> **Governing Authority**. It makes no production, credential, Agent-home,
> LaunchDaemon, runtime, service, or implementation change, and it authorizes no
> code and no production execution. It becomes active only if an independent
> reviewer passes the exact final head, the Owner accepts that exact head, and
> the accepted bytes are merged into `main`. Every implementation, deployment,
> restore, and apply action named here belongs to a separately accepted child
> authority. The current PR #117 runner remains forbidden.

## 0. Authoring status and frozen coordinates

```text
TASK_NAME = 授权 执行 (amendment round)
TASK_MODE = AMENDMENT (revision of a still-proposed Spec inside PR #120)
REPOSITORY = mayf3/dsh-agent-core
OBSERVED_MAIN_AT_DISPATCH = 9bb5b97442c7155da36f06e867d1a655410544ac
CURRENT_MAIN_AT_AMENDMENT = 9bb5b97442c7155da36f06e867d1a655410544ac
HEMOSTASIS_EVIDENCE_PR = 117
REVIEWED_EVIDENCE_HEAD = 079638ef324859db571b6eebbfc0a8787650b061
INDEPENDENT_EVIDENCE_AUDIT_REVIEW_ID = 5061248705
INDEPENDENT_EVIDENCE_AUDIT_RESULT = REVISE
ORIGINAL_PROPOSAL_HEAD = 816ae07c5f18056a82bd156a07ce9bf863e14b1d
AUTHORITY_REVIEW_ID = 5061334894
AUTHORITY_REVIEW_RESULT = REVISE
AMENDMENT_COMMIT = appended on top of 816ae07 without rewriting it;
  the new head is recorded in the PR #120 body and comment, not in this file
SPEC_STATUS = proposed
AUTHORITY_STATUS = PROPOSED
MAIN_SPEC_IMPLEMENTATION_AUTHORITY = none
MAIN_SPEC_PRODUCTION_EXECUTION_AUTHORITY = NONE
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCTION_APPLY_ALLOWED_NOW = NO
OWNER_ACCEPTANCE_RECORDED = NO
```

PR #117 is evidence input, not an authority dependency and not an implementation
branch. This Spec neither modifies nor accepts PR #117. This amendment round
revises the still-proposed V1 in place (governance V0 §9.1: any change while a
Spec remains proposed is `AMEND`); it does not rewrite, amend by rebase, or
force-push the reviewed commit `816ae07`.

### 0.1 Authority-field repair recorded by this amendment

```text
REMOVED_FIELD = production_apply_authority: contracts_on_acceptance_only
REMOVED_REASON = not a governance-defined authorization form; SPEC_GOVERNANCE_V0
  recognizes implementation_authority none|contracts only, with production
  execution gates carried by Contracts of separately accepted child authorities
  and a separately authorized execution task
REPLACEMENT_FIELD = NONE (no substitute self-created field)
SPEC_KIND = program (decomposition, ordering, child-Spec boundaries)
IMPLEMENTATION_AUTHORITY = none
```

## 1. Goal

`GOAL-001` freezes the only goal:

```text
INCIDENT_ENTRY_CONDITION = OpenCode Go global route quota exhausted
TEMPORARY_TARGET = zai / glm-5.3 / fallbacks=[]
TARGET_MODE = GLM53_STRICT_SINGLE_ROUTE
```

During the OpenCode Go monthly-quota outage, every Agent in the frozen
authoritative migration target set MUST stop depending on the global
`oc-go/deepseek-v4-flash` route and MUST use exactly one `zai/glm-5.3` route
with `fallbacks=[]`. This Spec states that goal, its boundaries, its frozen
decisions, and the requirements on every child authority needed to reach it
safely. It does not itself execute anything.

### 1.1 Completion line

`SUCCESS_CONDITION` is conjunctive. Completion of the eventual hemostasis
program requires all of the following, each proved by the child authority that
owns it:

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

### 1.2 Expiry is computed from the durable BEGIN record

```text
BEGIN_TRANSACTION_AT_UTC =
  the UTC timestamp obtained when the durable BEGIN record of the activation
  transaction is written and fsynced
EXPIRY_AT_UTC = BEGIN_TRANSACTION_AT_UTC + 14 calendar days
ATOMICITY = both values are frozen in the SAME fsynced BEGIN record
OTHER_EXIT_EVENTS =
  (b) Owner-confirmed OpenCode Go quota restoration plus a separately authorized
      return transaction; or
  (c) an accepted permanent or successor route Authority becomes effective; or
  (d) Owner revocation or any rollback trigger in this Spec
ROLL_FORWARD_PATH = source-stamped deployment under a separately accepted
  permanent/successor Authority
ROLLBACK_PATH = complete pre-COMMIT transaction rollback as defined by CTR-HEM-020
POST_COMMIT_EXIT = always a new, separately audited exit transaction (CTR-HEM-030)
```

The activation transaction MUST NOT record a relative expiry ("14 days after
COMMIT") and MUST NOT guess a COMMIT-time timestamp before BEGIN; see
`DEC-HEM-011` and `CTR-HEM-019`. The temporary route MUST NOT become an
unbounded implicit default. Before `EXPIRY_AT_UTC`, an authorized Owner must
select and execute a separately governed roll-forward or exit transaction. If no
exit can be safely completed, the system MUST remain in
`MANUAL_RECOVERY_REQUIRED` with scheduler dispatch and notification ingress
paused, and MUST NOT silently continue business delivery.

## 2. Scope and non-goals

### 2.1 This Spec is a pure Governing Authority

`AGENT_CORE_GLOBAL_ROUTE_HEMOSTASIS_V1` is responsible only for:

- the goal (`§1`);
- boundaries and non-goals (`§2`);
- priorities and frozen normative decisions (`§8`);
- the mandatory child-authority DAG (`§3.2`);
- the requirements each subsequent artifact, audit, and Owner gate must satisfy
  (`§3.4`, `§8`, `§9`);
- success, exit, and failure semantics (`§1`, `§9`, `§12`).

It MUST NOT itself act as, and does not contain authority for:

```text
MINIMAL_SETTINGS_IMPLEMENTATION_AUTHORITY_IN_MAIN_SPEC = NONE
SOURCE_STAMP_IMPLEMENTATION_AUTHORITY_IN_MAIN_SPEC = NONE
CLEAN_DEPLOYMENT_AUTHORITY_IN_MAIN_SPEC = NONE
FIVE_WRITE_RESTORE_EXECUTION_AUTHORITY_IN_MAIN_SPEC = NONE
MIGRATION_RUNNER_IMPLEMENTATION_AUTHORITY_IN_MAIN_SPEC = NONE
PRODUCTION_EXECUTION_COMMAND_IN_MAIN_SPEC = NONE
```

Those belong exclusively to the child authorities in `§3.2`, each of which must
be separately authored, independently reviewed, accepted, and merged before the
corresponding action may occur.

### 2.2 Out of scope and cross-track isolation

```text
PR115_DEPENDENCY = NONE
PR118_DEPENDENCY = NONE
PR121_LUNA_SUCCESSOR_DEPENDENCY = NONE
LUNA = OUT_OF_SCOPE
OAUTH = OUT_OF_SCOPE
OPENCODE_BALANCE = OUT_OF_SCOPE
FAILED_TASK_REPLAY = OUT_OF_SCOPE
PERMANENT_MODEL_ROUTE_ARCHITECTURE = OUT_OF_SCOPE
PR117_RUNNER = FORBIDDEN
RETROACTIVE_AUTHORIZATION = FORBIDDEN
```

This Spec is not Luna fallback activation, PR #115 implementation acceptance,
PR #118 evidence merge, OpenCode Go recharge, permanent routing architecture, or
failed-task replay. Completion does not mean Luna is usable, PR #115 or #118 is
mergeable, or a final `glm53 -> luna` target state is complete. No step of the
hemostasis program may call Luna or depend on those tracks.

## 3. Authority and dependencies

### 3.1 Relationship to current accepted route authority

`AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2` (accepted
`accepted_reviewed_head 85431b5`, 2026-08-29) is target-only for `agt_cto-agent`
and freezes non-target/global surfaces unchanged inside its own execution
boundary (`CTR-V2-004` step 7 "all non-target config/route/env semantics
unchanged" and its closing rule "不改 launchd、Definition、Binding、Scheduler
job/store、global env、第二 Feishu consumer"). A global hemostasis flip changes
the shared parent environment, so this Spec cannot stand on
`supersedes = []` plus a prose claim of non-conflict.

The conflict is closed explicitly by the proposed narrow compatibility amendment
`AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2_HEMOSTASIS_COMPATIBILITY_AMENDMENT_V1`
(authored in this PR), which is a **prerequisite child authority** of this Spec:
it must be independently reviewed and accepted together with (or before) this
Spec, and the hemostasis program may not modify shared global env unless it is
active. See `CTR-HEM-013` for the preserved CTO invariants.

```text
CTO_AUTHORITY_COMPATIBILITY = EXPLICITLY_CLOSED (by the compatibility amendment)
REQUIRES_SUPERSESSION = NO — governance V0 §9.2 supersedes whole authorities
  only, and this Spec cannot fully replace the CTO activation authority; the
  lawful path is the compatibility amendment as a new, non-conflicting,
  narrow-scope authority refining the same parent policy
  (AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2)
PRECEDENCE_RULE =
  (a) on any question touching agt_cto-agent's own route, override, or
      credential boundary, AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2
      retains full precedence and this Authority has zero authority;
  (b) on the single question of the shared global environment surface (global
      provider/model env and the controlled shared-runtime restart), the
      compatibility amendment defines a bounded, temporary carve-out that is
      active only while this Governing Spec, that amendment, and every required
      child authority in §3.2 are each accepted and merged, and only inside the
      audited hemostasis transaction;
  (c) on any surface not named in (b), or if any CTO invariant in CTR-HEM-013
      would be broken, the hemostasis activation is STOPPED — fail-closed.
```

### 3.2 Child-authority DAG

The main Spec MUST NOT authorize any implementation or production action
directly. On acceptance it activates exactly the following frozen dependency
DAG; every node names work that still requires its own proposed artifact,
independent review, Owner acceptance, and merge (or, for Owner gates, an
explicit recorded Owner decision on the exact audited digest):

```text
POST_ACCEPTANCE_DEPENDENCY_DAG =
1.  MINIMAL_SETTINGS_IMPLEMENTATION_AUTHORITY
2.  MINIMAL_SETTINGS_CODE_EXECUTION
3.  MINIMAL_SETTINGS_CODE_AUDIT
4.  OWNER_MERGE_DECISION
5.  SOURCE_STAMP_AND_CLEAN_DEPLOYMENT_AUTHORITY
6.  SOURCE_STAMP_IMPLEMENTATION_AND_DEPLOYMENT
7.  CLEAN_DEPLOYMENT_AUDIT
8.  OWNER_SOURCE_MANIFEST_ACCEPTANCE
9.  FRESH_PRODUCTION_OBSERVATION
10. TARGET_SNAPSHOT_AUDIT
11. RECIPIENT_SNAPSHOT_AUDIT
12. SOURCE_MANIFEST_AUDIT
13. EXECUTION_PLAN_AUDIT
14. PREEXISTING_FIVE_RESTORE_AUTHORITY
15. PREEXISTING_FIVE_RESTORE_RUNNER
16. PREEXISTING_FIVE_RESTORE_AUDIT
17. OWNER_RESTORE_EXECUTION
18. RESTORE_RECEIPT_AUDIT
19. HEMOSTASIS_ACTIVATION_AUTHORITY
20. MIGRATION_RUNNER_EXECUTION
21. MIGRATION_RUNNER_AUDIT
22. OWNER_ACTIVATION_EXECUTION
23. POST_SWITCH_PRODUCTION_AUDIT
24. EXPIRY_OR_SUCCESSOR_EXIT_AUTHORITY
```

Ordering constraints that the DAG encodes:

```text
NO_PRODUCTION_WRITE_BEFORE_SOURCE_STAMPED_DEPLOYMENT = YES
```

covering, without exception: five-write restore; credential source write;
settings source write; home write; plist write; runtime restart. Node 1–4
(code) precede node 5–7 (clean, source-stamped deployment); node 8–13
(observations and the four artifact audits) precede node 14–18 (restore
transaction); node 19–23 (activation) precede node 24 (bounded exit). After
this Spec is accepted it is FORBIDDEN to jump directly to runner authoring
(`脚本 执行`), an Owner `sudo` production command, or a production apply: each
such step is reachable only through the named child-authority nodes above.

### 3.3 Independent artifact audit gates

Four artifacts are gated by MANDATORY independent audits before any Owner
acceptance:

```text
TARGET_SNAPSHOT_AUDIT = REQUIRED
RECIPIENT_SNAPSHOT_AUDIT = REQUIRED
SOURCE_MANIFEST_AUDIT = REQUIRED
EXECUTION_PLAN_AUDIT = REQUIRED
```

The Owner may only accept the exact artifact digest that has already passed its
independent audit. From audit freeze to execution, the Owner MUST NOT: edit the
artifact; add any exclusion; add any recipient; change the canary; change the
deployment closure; or change execution steps. Any content change — however
small — requires regenerating the artifact and repeating the independent audit.
This closes dynamic delegation: the Owner cannot at execution time choose which
Agents to exclude, expand the target set or credential recipients, select an
arbitrary source manifest or canary, or improvise a different execution plan.

### 3.4 Current prohibition

Until this Spec, the compatibility amendment, and each required child authority
are accepted and merged:

```text
GLOBAL_PLIST_CHANGE_AUTHORIZED_BY_PROPOSAL = NO
RUNTIME_RESTART_AUTHORIZED_BY_PROPOSAL = NO
HOME_WRITE_AUTHORIZED_BY_PROPOSAL = NO
CREDENTIAL_COPY_AUTHORIZED_BY_PROPOSAL = NO
FIRST_SPAWN_SOURCE_WRITE_AUTHORIZED_BY_PROPOSAL = NO
RESTORE_WRITE_AUTHORIZED_BY_PROPOSAL = NO
```

No later stage of this program turns these into an Owner command; they become
bounded Contract authority of the specific accepted child authorities only.

## 4. Current State

All States below that derive from PR #117 carry the frozen freshness marking
required by `DEC-HEM-013`; none of them is apply-time proof.

- `STATE-HEM-001` — Repository source is `main` at
  `9bb5b97442c7155da36f06e867d1a655410544ac` for this amendment work. Basis:
  `OBS-HEM-001`.
- `STATE-HEM-002` — As last independently observed (PR #117 audit,
  2026-08-30), the production global route was `oc-go/deepseek-v4-flash`,
  global route changed = `NO`, runtime restarted = `NO`, incident resolved =
  `NO`. Basis: `OBS-HEM-002`, `EVD-HEM-001`.
  `HISTORICAL_OBSERVATION_ONLY = YES; APPLY_TIME_PROOF = NO`.
- `STATE-HEM-003` — As last independently observed, five named Agent homes
  already had settings and credential-file mutations and the production secret
  footprint had expanded. These are historical facts, not authorized state.
  Basis: `OBS-HEM-003`, `EVD-HEM-002`.
  `HISTORICAL_OBSERVATION_ONLY = YES; APPLY_TIME_PROOF = NO`.
- `STATE-HEM-004` — As last independently observed, deployed route-critical
  source provenance was `UNSTAMPED_AND_COMMIT_AMBIGUOUS`. Basis: `OBS-HEM-004`,
  `EVD-HEM-003`. `HISTORICAL_OBSERVATION_ONLY = YES; APPLY_TIME_PROOF = NO`.
- `STATE-HEM-005` — As last independently observed, full wakeable-Agent
  inventory and first-spawn source readiness were NOT independently verified
  (bounded root read access unavailable). Basis: `OBS-HEM-005`, `EVD-HEM-004`.
  `HISTORICAL_OBSERVATION_ONLY = YES; APPLY_TIME_PROOF = NO`.

Frozen summary (all historical-observation values):

```text
LAST_OBSERVED_PRODUCTION_GLOBAL_ROUTE = oc-go / deepseek-v4-flash
LAST_OBSERVED_GLOBAL_ROUTE_CHANGED = NO
LAST_OBSERVED_RUNTIME_RESTARTED = NO
LAST_OBSERVED_INCIDENT_RESOLVED = NO
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
LAST_OBSERVED_SOURCE_PROVENANCE = UNSTAMPED_AND_COMMIT_AMBIGUOUS
```

### 4.1 Apply-time freshness framework

Before ANY production write of the hemostasis program, every artifact class
below MUST be re-observed by the responsible child authority. Each observation
records:

```text
OBSERVED_AT / MAX_AGE / SOURCE_GENERATION / INVALIDATION_EVENT
```

| Artifact class | MAX_AGE | SOURCE_GENERATION (bound identity) | INVALIDATION_EVENT |
|---|---|---|---|
| OpenCode Go quota state | until `BEGIN_TRANSACTION` | incident record + Owner confirmation | quota restoration report |
| global LaunchDaemon plist | until `BEGIN_TRANSACTION` | non-secret whole-file digest + metadata | any byte/metadata change |
| shared runtime process + children | zero (current at gate) | PID + runtime epoch | any process lifecycle event |
| Agent homes (settings/credentials) | until `BEGIN_TRANSACTION` | metadata + parser-state class per file | any write or parse-class change |
| first-spawn sources | until `BEGIN_TRANSACTION` | metadata + parser-state class | any write |
| pre-write backups (2026-08-30) | until restore `BEGIN_RESTORE_TRANSACTION` | path/metadata + in-process comparison result | any change or failed comparison |
| agents inventory | until `BEGIN_TRANSACTION` | `agents.json` canonical digest | digest change |
| bindings | until `BEGIN_TRANSACTION` | bindings store digest | digest change |
| scheduler jobs | until `BEGIN_TRANSACTION` | jobs store digest + runs log position | digest change or run-log growth |
| notification ingress | until `BEGIN_TRANSACTION` | idempotency store digest + evidence log position | digest change or log growth |
| workflow assignments | until `BEGIN_TRANSACTION` | authoritative svc-workflow API query | any assignment change |
| source stamp | until activation `BEGIN_TRANSACTION` | stamp content | any stamp change |
| deployed-byte manifest | until activation `BEGIN_TRANSACTION` | manifest digest | any deployed byte change |

A stale observation (age beyond `MAX_AGE`) or any `INVALIDATION_EVENT` fires
before the corresponding write makes the affected artifact, audit, and Owner
acceptance VOID: the child authority MUST re-observe and repeat the failed
portion of the independent audit chain before proceeding.

## 5. Observations

### OBS-HEM-001 — Authoring base

- Subject: `mayf3/dsh-agent-core` authoring/amendment worktree.
- Source revision: `origin/main@9bb5b97442c7155da36f06e867d1a655410544ac`.
- Environment: independent clean worktree at the reviewed head `816ae07`.
- Observed at: original authoring and this amendment dispatch.
- Method: fetch origin, resolve `origin/main`, create a new worktree and branch.
- Result: dispatch main and authoring main are identical; no head drift at
  amendment start.
- Provenance: this PR's Git base and commit ancestry.

### OBS-HEM-002 — PR #117 production-state correction (historical)

- Subject: production global route and incident state.
- Source revision: PR #117 head `079638ef324859db571b6eebbfc0a8787650b061`.
- Environment: Agent Core production.
- Observed at: independent audit submission (2026-08-30).
- Method: read PR body and review `5061248705` at the exact reviewed head.
- Result: plist remained `oc-go/deepseek-v4-flash`; runtime was not restarted;
  incident remained unresolved.
- Limitations: `HISTORICAL_OBSERVATION_ONLY`; not apply-time proof.
- Provenance: <https://github.com/mayf3/dsh-agent-core/pull/117>.

### OBS-HEM-003 — Five prior mutations (historical)

- Subject: the five Agent homes named in `STATE-HEM-003`.
- Source revision: PR #117 head and review `5061248705`.
- Environment: Agent Core production.
- Observed at: independent audit submission (2026-08-30).
- Method: independent read-only metadata and parsed key-name verification recorded by
  the audit.
- Result: settings and credential files changed; ZAI key-name presence and
  pre-write backups were observed; secret footprint expanded.
- Limitations: `HISTORICAL_OBSERVATION_ONLY`; not apply-time proof.
- Provenance: PR #117 review `5061248705`.

### OBS-HEM-004 — Source provenance gap (historical)

- Subject: deployed route/provisioning closure.
- Source revision: production bytes observed by PR #117 audit.
- Environment: Agent Core production.
- Observed at: independent audit submission (2026-08-30).
- Method: inspect source stamp and runner pins.
- Result: no trusted source stamp; runner pinned only a subset of route-critical bytes.
- Limitations: `HISTORICAL_OBSERVATION_ONLY`; not apply-time proof.
- Provenance: PR #117 review `5061248705`.

### OBS-HEM-005 — Inventory and first-spawn gap (historical)

- Subject: authoritative agents inventory and authsvc first-spawn sources.
- Source revision: production as audited at PR #117 head.
- Environment: Agent Core production.
- Observed at: independent audit submission (2026-08-30).
- Method: bounded read-only audit without sudo.
- Result: complete registered/enabled/wakeable inventory and first-spawn settings
  and credential sources were unreadable and therefore unproved.
- Limitations: `HISTORICAL_OBSERVATION_ONLY`; not apply-time proof.
- Provenance: PR #117 review `5061248705`.

### OBS-HEM-006 — Repository first-spawn defaults

- Subject: `packages/agent-provisioning/src/index.js` at authoring base.
- Source revision: `9bb5b97442c7155da36f06e867d1a655410544ac`.
- Environment: repository source.
- Observed at: authoring.
- Method: source inspection.
- Result: provisioning copies `DSH_SETTINGS_SOURCE` or `~/.dsh/settings.yaml`,
  copies `~/.dsh/.credentials.yaml`, and its `MINIMAL_SETTINGS` is oc-go-only.
- Provenance: `packages/agent-provisioning/src/index.js:297-306,429-434`.

### OBS-HEM-007 — Governance grammar for authority fields

- Subject: vendored governance protocol and schema.
- Source revision: `9bb5b97442c7155da36f06e867d1a655410544ac`.
- Environment: repository `.agents/` vendored bytes.
- Observed at: this amendment round.
- Method: read `.agents/protocol/SPEC_FORMAT_V0.md` §2.2/§2.4,
  `.agents/protocol/SPEC_GOVERNANCE_V0.md` §3.2/§9, and
  `.agents/schemas/spec-frontmatter.schema.json`.
- Result: `spec_kind` is `invariant | program | implementation`
  (`program` = decomposition, ordering, child-Spec boundaries);
  `implementation_authority` is `none | contracts` only; a Program Spec
  normally uses `none`; there is NO governance-defined production-execution
  frontmatter form; supersession is whole-Spec only and non-replaceable
  refinements take the "new non-conflicting authority refining the same parent"
  path.
- Provenance: the three vendored files above at the cited base.

### OBS-HEM-008 — CTO activation V2 frozen boundary coordinates

- Subject: `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2` (accepted).
- Source revision: `9bb5b97442c7155da36f06e867d1a655410544ac` (spec file in
  `docs/specs/`).
- Environment: repository authority branch.
- Observed at: this amendment round.
- Method: read `CTR-V2-004` and the acceptance table.
- Result: step 7 requires "all non-target config/route/env semantics
  unchanged"; the order block closes with "不改 launchd、Definition、Binding、
  Scheduler job/store、global env、第二 Feishu consumer"; the accepted frontmatter
  pins `accepted_reviewed_head 85431b5` (2026-08-29). Those clauses scope the
  CTO activation's own transaction; they are the surface the compatibility
  amendment carves out.
- Provenance: the spec file at the cited base.

### OBS-HEM-009 — Authoritative production registry identities in source

- Subject: wake-source and drain registries.
- Source revision: `9bb5b97442c7155da36f06e867d1a655410544ac`.
- Environment: repository source.
- Observed at: this amendment round.
- Method: source inspection of the packages below.
- Result (exact coordinates):
  - production layout: `packages/production-runtime/src/paths.js`
    `resolveProductionLayout()` — root from `$PRODUCTION_RUNTIME_ROOT` else
    `~/.agent-core`; `agentsConfig = <root>/agents.json`;
    `agentModelOverrides = <root>/agent-model-overrides.json`;
    `bindingsStore = <root>/bindings/bindings.json`;
    `jobsStore = <root>/scheduler/jobs.json`, `runsLog =
    <root>/scheduler/runs.jsonl`;
    `notificationIdempotencyStore = <root>/notification-ingress/idempotency.json`,
    `notificationEvidence = <root>/notification-ingress/evidence.jsonl`;
    `homesRoot = <root>/homes`; `controlDir = <root>/control`; `evidenceLog =
    <root>/control/runtime-evidence.jsonl`.
  - agents identity/enabled: `packages/agent-definition/src/index.js`
    (`DEFAULT_CONFIG_FILE`) and `definition.js` — the `disabled` optional
    boolean (default `false`) is the ONLY operational-state field
    (AGENT_DEFINITION_ACCESS_V1).
  - bindings: `packages/agent-router/src/binding-store.js` — durable Binding
    store, version-1 JSON document
    (`bindings`/`lastSessions`/`freshSessions`), atomic writes, Router is sole
    owner.
  - scheduler: `packages/scheduler/src/store.js` — `JobStore`, single-document
    Scheduler V2 authority store (`{version:2, jobs, occurrences, fences}`) +
    `runs.jsonl`; `packages/scheduler/src/lock.js` — cross-process `OwnerLock`
    (`{pid, token, createdAtMs}` artifact, SIGKILL-safe, mechanical-only stale
    verdict via `kill(pid,0)`).
  - ingress: `packages/notification-ingress/src/` — idempotency authority
    (`idempotency.js` state machine + `idempotency-persistence.js` atomic
    store); runtime health endpoint `http://127.0.0.1:<port>/health`
    (`packages/production-runtime/src/entry.js:79`).
  - in-flight turns: `packages/agent-router/src/reconciliation/store.js` — the
    SINGLE query authority for late turn reconciliation under
    AGENT_PROCESS_LIFECYCLE_HARDENING_V2 (C-017..C-019);
    `outcome_unknown` records settle exactly once into `late_completed |
    late_failed | terminated_without_outcome`; handles embed
    `runtimeEpoch + agentId + processGeneration + monotonicTurnSeq`; NO disk
    persistence across control-plane restarts (epoch mismatch = `restart_lost`).
  - child lifecycle: `packages/agent-router/src/process-registry.js` — one
    linearizable slot per Agent
    (`EMPTY | STARTUP | READY | REAP` with `generation` + `ownershipToken`,
    identity CAS; `REAP -> EMPTY` only after real process exit).
  - admission seam: `packages/agent-router/src/ingress-delivery.js` — frozen
    `deliver({requestId, agentId, sessionMode, message})` interface, with the
    reconciliation-capacity precheck before any spawn/write.
- Limitations: source identities at this base; production instances still
  require the freshness re-observation of `§4.1`.
- Provenance: the cited files at the cited base.

### OBS-HEM-010 — No authoritative direct-runtime registry

- Subject: direct runtime invocation wake source.
- Source revision: `9bb5b97442c7155da36f06e867d1a655410544ac`.
- Environment: repository source.
- Observed at: this amendment round.
- Method: source scan of admission paths (agent-router ingress/deliver,
  scheduler, broker relay, production-runtime entry).
- Result: no registry module enumerates direct runtime invocations of Agents;
  admission surfaces found are channel ingress (bindings), scheduler jobs, and
  broker-tool-mediated workflows; direct invocation is unregistered.
- Limitations: absence of a registry is not absence of the wake source.
- Provenance: repository tree scan at the cited base.

### OBS-HEM-011 — Authority review 5061334894 coordinates

- Subject: independent review of the original proposal head.
- Source revision: PR #120 review `5061334894`.
- Environment: GitHub PR #120.
- Observed at: this amendment dispatch (2026-08-31).
- Method: read the review at the exact reviewed head `816ae07`.
- Result: `SPEC_REVIEW = REVISE` with authority blockers (invalid authority
  field; CTO shared-env conflict; dynamic Owner delegation; open five-write
  decision; MINIMAL_SETTINGS as code; source-stamp cycle) and contract blockers
  (restore transaction; stale whole-file overwrite; public secret-derived
  digests; unproved canonical source; target/recipient schema; secret
  lifecycle; drain identities; post-COMMIT rollback; diagnostic terminals;
  non-computable expiry).
- Provenance: review `5061334894` on PR #120.

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

### CLM-HEM-003 — Separately authorized rollback-by-reconciliation is the safest lawful baseline for the five writes

- Support state: SUPPORTED.
- Supported by evidence: `EVD-HEM-002`.
- Contradicted by evidence: none known.
- Uncertainty: the reconciliation itself is future work of the restore child
  authority; this Spec freezes only its required shape and fail-closed
  semantics.

### CLM-HEM-004 — Source-byte identity is required for safe emergency apply

- Support state: SUPPORTED.
- Supported by evidence: `EVD-HEM-003`.
- Contradicted by evidence: none known.
- Uncertainty: none; this Spec requires the strict source-stamp option, ordered
  BEFORE any production write of the program.

### CLM-HEM-005 — A narrow compatibility amendment lawfully closes the shared-env conflict

- Support state: SUPPORTED.
- Supported by evidence: `EVD-HEM-006` (governance grammar: whole-Spec
  supersession unavailable; non-conflicting refinement of the same parent is the
  lawful path; no production-execution frontmatter form exists).
- Contradicted by evidence: none known.
- Uncertainty: acceptance of the amendment itself remains future Owner action.

### CLM-HEM-006 — The authoritative wake/drain universe is bound by named registries, with one missing capability

- Support state: SUPPORTED.
- Supported by evidence: `EVD-HEM-007` (exact module/store coordinates for
  inventory, bindings, scheduler, ingress, reconciliation, child lifecycle).
- Contradicted by evidence: none known.
- Uncertainty: direct runtime invocation has no authoritative registry
  (`OBS-HEM-010`), and no external mechanical query API for the in-process
  reconciliation store is defined by an accepted Spec; both are handled as
  explicit implementation prerequisites (`§13`), never silently derived.

## 7. Evidence relations

### EVD-HEM-001 — Audit supports current global-route State

- Source observations: `OBS-HEM-002`.
- Target: `STATE-HEM-002`.
- Relation: SUPPORTS.
- Bound coordinates: PR #117 head and review `5061248705`.
- Strength/sufficiency: direct independent production-state record.
- Limitations: historical observation only; does not establish a later production state.
- Provenance: PR #117.

### EVD-HEM-002 — Audit supports prior-mutation State and transaction Claim

- Source observations: `OBS-HEM-003`.
- Target: `STATE-HEM-003`, `CLM-HEM-002`, `CLM-HEM-003`.
- Relation: SUPPORTS.
- Bound coordinates: PR #117 head and independent review.
- Strength/sufficiency: direct metadata inspection plus sandbox failure reproduction.
- Limitations: secret values were intentionally not read or hashed; historical
  observation only.
- Provenance: review `5061248705`.

### EVD-HEM-003 — Audit supports provenance State

- Source observations: `OBS-HEM-004`.
- Target: `STATE-HEM-004`, `CLM-HEM-004`.
- Relation: SUPPORTS.
- Bound coordinates: PR #117 reviewed head.
- Strength/sufficiency: sufficient to reject subset-only pins.
- Limitations: does not identify a unified deployed commit; historical observation only.
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

### EVD-HEM-006 — Governance grammar supports the authority-composition repair and the amendment path

- Source observations: `OBS-HEM-007`, `OBS-HEM-008`, `OBS-HEM-011`.
- Target: `CLM-HEM-005`, `§3.1`, `§0.1`.
- Relation: SUPPORTS.
- Bound coordinates: repository base `9bb5b97...` and PR #120 review
  `5061334894`.
- Strength/sufficiency: sufficient to select `spec_kind: program`,
  `implementation_authority: none`, removal of the invalid field, and the
  compatibility-amendment path.
- Limitations: does not itself accept the amendment.
- Provenance: vendored governance bytes; accepted CTO V2 spec; review body.

### EVD-HEM-007 — Source identities support target-universe and drain binding

- Source observations: `OBS-HEM-009`, `OBS-HEM-010`.
- Target: `CLM-HEM-006`, `DEC-HEM-002`, `DEC-HEM-008`.
- Relation: SUPPORTS.
- Bound coordinates: repository base `9bb5b97...`.
- Strength/sufficiency: sufficient to freeze exact module/store coordinates and
  to declare `DIRECT_RUNTIME_REGISTRY = MISSING`.
- Limitations: deployed/production instances require apply-time re-observation.
- Provenance: cited source files.

## 8. Decisions

### DEC-HEM-001 — Temporary strict global route

- Decision owner: repository Owner.
- Decision: after all gates, use exactly `zai/glm-5.3`, `fallbacks=[]` for the
  global route during this incident.
- Rejected alternative: Luna fallback or multi-route activation.
- Reason: this Authority is strict temporary hemostasis and must not activate Luna.
- Owner input remaining: NONE.

### DEC-HEM-002 — Authoritative target universe partition

- Decision owner: repository Owner.
- Decision: the target universe is a COMPLETE candidate partition computed only
  from authoritative sources:

```text
TARGET_UNIVERSE_PARTITION =
  INCLUDED
  EXCLUDED_WITH_ACCEPTED_AUTHORITY
  DISABLED_AND_NON_WAKEABLE
  INVALID_OR_UNRESOLVED

PARTITION_LAWS =
  every candidate appears in exactly one class;
  no omission (every agents.json entry is classified);
  no duplication;
  INVALID_OR_UNRESOLVED non-empty -> ACTIVATION = STOPPED;
  snapshot source coordinates are frozen (below);
  any binding/schedule/workflow/registry generation change after freeze
    voids the snapshot.
```

Authoritative source coordinates (bound by `OBS-HEM-009`):

| Source | Authority / path | Provides |
|---|---|---|
| agents registry | `resolveProductionLayout().agentsConfig` (`<root>/agents.json`, deployed resolution per AGT_CTO Activation V2 `OBS-V2-001`) + `agent-definition` schema | candidate identity set |
| enabled state | `agent-definition` `disabled` field (only operational-state field) | enabled = `disabled !== true` |
| bindings | `bindingsStore` document (`bindings/bindings.json`, version 1) | channel wake sources per Agent |
| scheduler jobs | `jobsStore` (`scheduler/jobs.json`, JobStore v2) + `runs.jsonl` | schedule wake sources per Agent |
| notification ingress | ingress idempotency/evidence + ingress auth config | ingress wake surface |
| workflows | external svc-workflow authoritative API (query recorded in snapshot) | workflow-assigned Agents |
| direct runtime invocation | `DIRECT_RUNTIME_REGISTRY = MISSING` (no authoritative registry; `OBS-HEM-010`) | implementation prerequisite, see `§13` |

The future target-snapshot child authority MUST bind exact digests and parser
results for each source at freeze time. Abstract source names without path,
store, schema, owner, and generation binding are FORBIDDEN. Because
`DIRECT_RUNTIME_REGISTRY = MISSING`, the snapshot MUST classify
direct-invocation exposure conservatively and the prerequisite in `§13` MUST be
closed by a separately accepted child authority before the partition may treat
any Agent as non-wakeable on that ground.

- Rejected alternatives: live-process list; all home directories;
  `96 homes = 96 Agents`; discover-and-mutate; expanding the set after freeze;
  Owner arbitrary exclusion at execution time.
- Reason: dormant-but-enabled Agents remain wakeable production subjects, and a
  partition that can be narrowed ad hoc is not a partition.
- Owner input remaining: NONE.

### DEC-HEM-003 — Exclusion is a closed enumeration bound to authority

- Decision owner: repository Owner.
- Decision: the ONLY legal exclusion reasons are:

```text
EXCLUSION_REASON_ENUM =
  (a) governed-by-another-accepted-authority:
      the Agent is explicitly governed by another accepted Authority, AND an
      independent audit proves the global flip does not change its actual route;
  (b) disabled-and-fully-non-wakeable:
      disabled in agents.json AND every wake source authoritatively closed;
  (c) formally-removed:
      formally removed from the production root by an accepted authority.
```

Every exclusion MUST record: the accepted Authority, precise evidence, and
inclusion in the `TARGET_SNAPSHOT_AUDIT`; exclusions MUST NOT be added after
that audit. `agt_cto-agent` is excluded under reason (a) BOUND to
`AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2_HEMOSTASIS_COMPATIBILITY_AMENDMENT_V1`
(not merely by name): the exclusion is valid exactly while that amendment's
CTO-invariant clause (mirrored in `CTR-HEM-013`) holds; if any invariant fails,
the exclusion lapses and activation stops.
- Rejected alternative: Owner-chosen exclusion list at execution time.
- Reason: §3.3 forbids dynamic delegation; name-based exclusion proves nothing
  about actual routing.
- Owner input remaining: NONE.

### DEC-HEM-004 — Missing home and first-spawn fail closed

- Decision owner: repository Owner.
- Decision:

```text
MISSING_HOME_POLICY = FAIL_CLOSED
NEW_AGENT_CREATION_DURING_MIGRATION = FORBIDDEN
MISSING_ZAI_READINESS_DISPOSITION = BLOCK_GLOBAL_FLIP
FRESHLY_PROVISIONED_TARGET_AGENT_MUST_SUPPORT = zai / glm-5.3 strict
```

Before global flip, the activation child authority must verify first-spawn
settings source, first-spawn credential source, deployed `MINIMAL_SETTINGS`,
provision path, ZAI provider declaration, GLM-5.3 model declaration, and secure
`ZAI_API_KEY` presence. New Agent provisioning remains paused from `FREEZE`
through `COMMIT` or rollback. Any missing home or readiness gap stops
activation; it is never a warning. The requirement on freshly provisioned
Agents is a REQUIREMENT of this Governing Spec; changing
`MINIMAL_SETTINGS` itself is repository code work reserved to the child
implementation authority of `DEC-HEM-009` — this Spec does not authorize
patching `packages/agent-provisioning/src/index.js`.
- Rejected alternative: WARN and continue.
- Reason: dormant-but-enabled Agent could fail after global flip.
- Owner input remaining: NONE.

### DEC-HEM-005 — Credential source resolution is mechanical; recipients are a set equality

- Decision owner: repository Owner.
- Decision: this Spec does NOT assert an unobserved canonical source. The
  canonical ZAI credential source MUST be resolved mechanically from the
  authoritative deployed provisioning closure by an algorithm defined by the
  `CREDENTIAL_SOURCE_AUDIT` child artifact, covering at minimum: effective
  service user; `homedir()` resolution; environment override
  (`DSH_SETTINGS_SOURCE`/credential-source env); configured credential source;
  deployed source code; and symlink resolution policy. The audit MUST emit a
  non-secret descriptor:

```text
SOURCE_PATH =
SOURCE_PATH_CLASS =
RESOLUTION_PROVENANCE =
FILE_TYPE =
OWNER =
GROUP =
MODE =
KEY_NAME_PRESENT =
DUPLICATE_KEY =
READ_AUTHORITY =
WRITE_AUTHORITY =
```

The descriptor is independently audited. Metadata policy is per path class:

```text
CANONICAL_SOURCE_METADATA_POLICY =
  preserve independently observed owner/group/mode
TARGET_HOME_CREDENTIAL_METADATA_POLICY =
  preserve independently observed owner/group/mode,
  subject to the existing accepted Agent-home Contract
```

The canonical authsvc source and uid502 Agent-home files MUST NOT be forced to
a single identity; a mismatch is evidence, not an error to chmod/chown past.
If path, metadata, or key presence is unproved: `ACTIVATION = STOPPED`.

Recipient boundary:

```text
RECIPIENT_AGENT_SET = TARGET_INCLUDED_AGENT_SET
ADDITIONAL_RECIPIENT_PATHS = INDEPENDENTLY_AUDITED_CANONICAL_FIRST_SPAWN_SOURCE only
RECIPIENT_SET_EQUALITY = REQUIRED (set union exactly the two families above;
  Owner MUST NOT hand-add recipients)
RECIPIENT_RECORD_FIELDS =
  agentId; path; pathClass; sourceSnapshotRef; owner/group/mode policy;
  membership reason; expiry cleanup rule
```

The canonical source MUST NOT be populated from, replaced by, or compared
byte-for-byte with `agt_cto-agent` (or any other Agent home). Only bounded
readers named by the child authority may access it; only the root-owned restore
or migration runner of the accepted child authorities may write recipients. A
target Agent may hold the key only while it remains in the frozen recipient set
and this Authority is unexpired.
- Rejected alternative: "copy from agt_cto-agent home to everyone"; uniform
  uid502:gid20:0600 across path classes; Owner-added recipients.
- Reason: an Agent home is not a canonical fleet secret source, and unobserved
  metadata must not be asserted (review 5061334894 contract blocker 4).
- Owner input remaining: NONE.

### DEC-HEM-006 — Five pre-existing writes: frozen disposition, no open decision

- Decision owner: repository Owner (accepting this exact head).
- Decision (frozen semantics of this proposed Spec; acceptance of this head
  IS the acceptance of this decision):

```text
PREEXISTING_FIVE_WRITES_DISPOSITION =
  ROLLBACK_BY_SEPARATELY_AUTHORIZED_RECONCILIATION_TRANSACTION
OPEN_OWNER_DECISIONS = NONE (at acceptance)
```

The five 2026-08-30 writes happened without this Authority. This Spec does not
authorize their rollback by itself: the rollback is executed — if at all — only
by the separately accepted `PREEXISTING_FIVE_RESTORE` child authority
(`DEC-HEM-007`, DAG nodes 14–18) under its own transaction. This Spec never
claims the past writes were compliant, and the current amendment round does not
execute any rollback.
- Rejected alternatives: `ROLLBACK_TO_PREWRITE_BACKUPS` as a vague default with
  `OWNER_DECISION_RECORDED = NO`; retention as prestaging without a semantic
  revision; retroactive authorization.
- Reason: review 5061334894 authority blocker 4 — accepted bytes must not leave
  an open Owner decision inside the Spec.
- Owner input remaining: NONE.

### DEC-HEM-007 — The restore is its own transaction, with staleness-safe reconciliation

- Decision owner: repository Owner.
- Decision:

```text
PREEXISTING_FIVE_RESTORE = SEPARATE_CHILD_TRANSACTION
RESTORE_ALLOWED_BY_MAIN_SPEC = NO (the main Spec forbids itself from
  authorizing restore execution; only the separately accepted restore child
  authority may)
SEPARATE_RESTORE_AUTHORITY_REQUIRED = YES
```

The future restore child authority MUST define its own complete transaction:

```text
PREPARE
→ CURRENT_STATE_OBSERVATION
→ BACKUP_CURRENT_STATE
→ RESTORE_DRILL
→ BEGIN_RESTORE_TRANSACTION
→ RECONCILE
→ VERIFY
→ COMMIT_RESTORE
→ ROLLBACK_RESTORE
→ RECEIPT_AUDIT
→ OWNER_COMMAND
```

It MUST cover: the ten target files (five `settings.yaml` + five
`.credentials.yaml` under the named homes); owner/group/mode; ACL/xattr;
current-state backup; parser state; secret footprint; staging; ledger;
`ERR/EXIT/INT/TERM/HUP`; disk-full/partial-write; partial restore. If the Nth
file fails, the first N−1 files MUST be restored to their pre-restore state.
Restore completed while migration has not started MUST be a legal, stable,
long-lived production state; the restore transaction MUST NOT rely on
"migration will continue immediately".

The restore reconciliation is staleness-safe, never a whole-file stale
overwrite. In particular it MUST NOT copy the 2026-08-30 whole-file backups
over the current files:

`settings.yaml` — processing is allowed only when either:

```text
A. the current file is byte-exactly the independently audited known-after
   state (comparison confined to the trusted restore process, PASS/FAIL only);
   or
B. a parser proves that the only relevant delta of the current file relative
   to a lawful baseline is exactly the unauthorized zai/glm-5.3 provider
   stanza.
```

Default handling is parser-driven precise deletion: remove ONLY that
unauthorized stanza; preserve every later legitimate change; any duplicate,
ambiguous, or dependent reference means `RESTORE = STOPPED`.

`.credentials.yaml` — whole-file stale restore is FORBIDDEN. The restore MUST
use a duplicate-key-rejecting YAML parser; delete ONLY the exact `ZAI_API_KEY`
mapping; preserve all other current keys and formatting that is safe to
preserve; classify exact state when the key is missing, duplicated, or
structurally anomalous; never output a value; never overwrite an unknown new
key with an old backup copy. If precise reconciliation cannot be proved:

```text
RESTORE = STOPPED
MANUAL_RECOVERY_REQUIRED = YES
```

Whole-file backup digests already published in PR #117 historical evidence are
NOT copied into this Spec and MUST NOT be used as future Contract inputs
(`DEC-HEM-014`).
- Rejected alternatives: whole-file restore from 2026-08-30 backups; restore as
  a pre-BEGIN exception inside the migration transaction; restore receipt
  without drill or coverage.
- Reason: review 5061334894 contract blockers 1–2 and authority blocker 6.
- Owner input remaining: NONE.

### DEC-HEM-008 — Authoritative drain identities

- Decision owner: repository Owner.
- Decision: quiescence MUST be proven against the authoritative registries
  bound in `OBS-HEM-009`, each recorded as:

```text
AUTHORITY_NAME / PATH_OR_API / SCHEMA / ZERO_CONDITION / FRESHNESS / FAILURE_DISPOSITION
```

1. In-flight turns and late reconciliation —
   `AGENT_PROCESS_LIFECYCLE_HARDENING_V2` C-017..C-019; in-process Router
   reconciliation store (`@agent-core/agent-router` `src/reconciliation/store.js`,
   the SINGLE query authority); schema: `outcome_unknown` records with
   `runtimeEpoch/agentId/processGeneration/monotonicTurnSeq`, settle-once to
   `late_completed|late_failed|terminated_without_outcome`; zero condition: zero
   pending `outcome_unknown` at the current runtime epoch; freshness: live
   control-plane query immediately before restart (restart resets epoch to
   `restart_lost`); failure: postpone/stop, never restart over unknown.
   No external mechanical query API for this store is defined by an accepted
   Spec: `REGISTRY_CAPABILITY_MISSING = YES` → the drain-query prerequisite in
   `§13` must be closed by the activation child authority.
2. Scheduler — `SCHEDULER_TIMEOUT_OUTCOME_V2`; JobStore document
   (`<root>/scheduler/jobs.json`, version 2: jobs/occurrences/fences) +
   `runs.jsonl` + `OwnerLock` (`{pid,token,createdAtMs}`; mechanical-only stale
   verdict); zero condition: dispatch paused, zero non-terminal occurrences,
   prior OwnerLock provably released; freshness: digest + lock state at gate;
   failure: postpone.
3. Notification ingress — `NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1`;
   idempotency store (`<root>/notification-ingress/idempotency.json`) +
   `evidence.jsonl` + health endpoint; zero condition: admission paused and zero
   non-terminal idempotency records; freshness: digest at gate; failure: drain
   or postpone.
4. Old Harness children — per-Agent lifecycle slots
   (`process-registry.js`): every slot `EMPTY` or provably in `REAP` with real
   process exit; `REAP -> EMPTY` CAS on `generation + entryId + processRef +
   ownershipToken`; old `oc-go` child count exactly zero; freshness: current at
   gate; failure: controlled-shutdown retry then stop.
5. Tool executions — no standalone authoritative tool-execution registry
   exists; tool in-flight is bounded mechanically by (1) zero pending turns at
   the current epoch PLUS (4) no live child slots PLUS (2)/(3) paused admission:
   with all three at zero, no tool execution can be in flight. That inference
   chain MUST be recorded by the runner; inventing a tool registry is
   forbidden.

Process age and `pgrep` output are NOT admissible drain evidence on any surface.
- Rejected alternative: infer no in-flight work from `process age < 180 seconds`
  or process lists.
- Reason: age is not an in-flight or side-effect boundary; generic names
  without store identity proved nothing (review 5061334894 contract blocker 7).
- Owner input remaining: NONE.

### DEC-HEM-009 — MINIMAL_SETTINGS is child code work; source stamp precedes every write

- Decision owner: repository Owner.
- Decision:

```text
MINIMAL_SETTINGS_IMPLEMENTATION =
  SEPARATE_CHILD_IMPLEMENTATION_SPEC_REQUIRED
PRODUCTION_RUNNER_MAY_PATCH_DEPLOYED_CODE = NO
FRESHLY_PROVISIONED_TARGET_AGENT_MUST_SUPPORT = zai / glm-5.3 strict
```

The child implementation Spec must include at minimum: exact authorized files;
tests; independent code audit; Owner merge decision; clean source-stamped
deployment; deployment audit. `MINIMAL_SETTINGS` lives in repository code
(`packages/agent-provisioning/src/index.js`), not in Agent homes, and a root
runner MUST NOT patch deployed JS.

Source-stamp / clean deployment ordering (no cycle):

```text
NO_PRODUCTION_WRITE_BEFORE_SOURCE_STAMPED_DEPLOYMENT = YES
SOURCE_STAMP_AND_CLEAN_DEPLOYMENT_PRECEDES =
  five-write restore (DAG 5-7 before 14-18);
  first-spawn source production writes;
  migration apply.
SOURCE_STAMP_ORDERING_CYCLE = NONE
```

- Rejected alternative: deploy `MINIMAL_SETTINGS` inside the production
  transaction; unstamped emergency exception; runner-side deployed-code patch.
- Reason: review 5061334894 authority blockers 5–6.
- Owner input remaining: NONE.

### DEC-HEM-010 — Exactly one isolated diagnostic with closed terminal semantics

- Decision owner: repository Owner.
- Decision: after switch, the activation authority executes exactly one
  `NON_CTO_NO_DELIVERY_DIAGNOSTIC_TURN` on a canary Agent named in the frozen
  snapshot and covered by the audited execution plan before
  `BEGIN_TRANSACTION`. Frozen non-secret constants:

```text
DIAGNOSTIC_PROMPT_ID = AGENT_CORE_HEMOSTASIS_DIAGNOSTIC_V1
EXPECTED_TOKEN = AGENT_CORE_HEMOSTASIS_OK_V1
```

The exact prompt bytes are non-secret and MUST be frozen in the audited
execution plan Contract. The diagnostic MUST define: exact timeout; caller
cancellation; provider timeout; `outcome_unknown` handling; late settlement;
cleanup terminal state; cleanup failure; session/job retention; exactly one
invocation; exactly one result; zero tools; zero external delivery; zero
retries; zero oc-go requests. Exactly ONE final terminal is permitted:

```text
DIAGNOSTIC_COMMITTED_CLEAN
DIAGNOSTIC_FAILED_ROLLBACK_REQUIRED
DIAGNOSTIC_OUTCOME_UNKNOWN_MANUAL_RECOVERY
```

There is NO state in which "the model may have completed but cleanup is
unknown" while delivery is unpaused: cleanup-unknown maps to the third terminal
and keeps scheduler/ingress paused.
- Rejected alternative: treat the pre-switch author self-canary as acceptance;
  open-ended diagnostic with retry.
- Reason: review 5061334894 contract blocker 9.
- Owner input remaining: NONE.

### DEC-HEM-011 — Computable expiry, monitor, and post-COMMIT exit transactions

- Decision owner: repository Owner.
- Decision: expiry is computed exactly as `§1.2` (both timestamps atomically in
  the fsynced BEGIN record). An expiry monitor MUST exist before unpause with:
  implementation/authority dependency; process/service identity; owner;
  heartbeat; durable state; liveness audit; escalation; exit initiation; expiry
  receipt. No suitable mechanism exists today:

```text
EXPIRY_MONITOR_IMPLEMENTATION_REQUIRED = YES
```

— it is a DAG node 24 prerequisite (`EXPIRY_OR_SUCCESSOR_EXIT_AUTHORITY`) and
MUST be closed by a separately accepted child authority before COMMIT may
unpause delivery. After COMMIT, expiry / roll-forward / rollback-after-commit
are NEW, independently audited exit transactions based on fresh state
reconciliation at exit time; the activation transaction's preimage backups are
usable ONLY for pre-COMMIT failure recovery and MUST NOT overwrite post-COMMIT
state.
- Rejected alternative: "14 days after COMMIT, recorded before
  BEGIN_TRANSACTION"; reusing activation backups after COMMIT.
- Reason: a COMMIT-time timestamp cannot be recorded before BEGIN; stale
  overwrite of post-COMMIT state is exactly what review 5061334894 contract
  blocker 8 forbids.
- Owner input remaining: NONE.

### DEC-HEM-012 — Secret lifecycle is closed

- Decision owner: repository Owner.
- Decision:
  1. While this Authority is active, creating new Agents is FORBIDDEN unless a
     new target/recipient snapshot passes independent audit and a new Authority
     amendment is accepted.
  2. If an Agent is disabled or removed: it MUST NOT retain the target-home ZAI
     credential; disposition MUST go through an independent
     credential-reconciliation transaction.
  3. After a clean COMMIT: activation preimage secret backups MUST NOT be used
     for future expiry rollback; secret-bearing temporary/staging files MUST be
     securely deleted immediately; no plaintext-readable ledger copy remains.
  4. At Authority expiry: deletion, retention, or rotation of target-home ZAI
     keys is decided by the independent exit/successor Authority; absent a
     successor, the default is an independent credential cleanup transaction;
     the canonical source end-state is adjudicated separately; silently
     retaining the expanded footprint forever is FORBIDDEN.
  5. On roll-forward to a permanent GLM Authority: the successor explicitly
     takes over recipients and key lifecycle; rotates the key if required; only
     then may the old Authority's expiry monitor close.
- Reason: review 5061334894 contract blocker 6.
- Owner input remaining: NONE.

### DEC-HEM-013 — Historical state is not apply-time proof

- Decision owner: repository Owner.
- Decision: every PR #117-derived State in `§4` is marked
  `HISTORICAL_OBSERVATION_ONLY = YES / APPLY_TIME_PROOF = NO`, and the
  freshness framework of `§4.1` governs all future use: before any production
  write, the responsible child authority re-observes every artifact class in
  the table with `OBSERVED_AT / MAX_AGE / SOURCE_GENERATION /
  INVALIDATION_EVENT`; stale or generation-changed artifacts void the dependent
  audits and Owner acceptances.
- Reason: review 5061334894 required revision (last paragraph).
- Owner input remaining: NONE.

### DEC-HEM-014 — No public secret-derived hashes

- Decision owner: repository Owner.
- Decision: this Spec, every child authority, and every future evidence
  artifact MUST NOT publish or record: credential-file whole-file SHA-256;
  secret value hashes; secret-derived fingerprints; token hashes. Historical
  evidence already in PR #117 is not rewritten, but MUST NOT be copied as
  future Contract input. Allowed: ephemeral byte comparison inside the
  root-owned trusted process with PASS/FAIL-only output; key-name presence;
  non-secret metadata (regular-file/owner/group/mode/size); parser structure
  results. The PASS/FAIL comparison result and any secret-derived digest MUST
  NOT be written to Git, a public PR, an ordinary ledger, a transcript, or
  Owner command output.
- Reason: review 5061334894 contract blocker 3 (contradiction between
  CTR-HEM-004/019's no-secret-hash rule and the digest table of the original
  DEC-HEM-006).
- Owner input remaining: NONE.

## 9. Contracts

### CTR-HEM-001 — Governing-authority activation gate

No implementation or production action under this Spec is permitted unless: the
exact final head of this Spec receives independent semantic review `PASS`; the
Owner accepts the exact unchanged head; accepted bytes merge into `main`; the
compatibility amendment of `§3.1` is likewise accepted and merged; and every
action then proceeds ONLY through the child-authority DAG of `§3.2` — each node
with its own review, acceptance, and (where named) audit and Owner gate. The
main Spec authorizes no code (`implementation_authority: none`) and carries no
production execution field. PR #117's runner MUST NOT be used. It is FORBIDDEN
to proceed from this Spec's acceptance directly to runner authoring, an Owner
`sudo` production command, or a production apply.

### CTR-HEM-002 — Target snapshot schema, partition, and freeze

Before any migration write, the target-snapshot child artifact MUST be canonical
JSON providing: `schemaVersion`; `productionRoot`; exact digest + parser result
for every authoritative source in `DEC-HEM-002` (agents registry with enabled
state; bindings; scheduler jobs; notification ingress; workflow query);
`freezeTime` (RFC3339-UTC); `ownerAuthorizationRef`; the complete
`TARGET_UNIVERSE_PARTITION` with every agents.json entry in exactly one class;
per-Agent `wakeSources` derived only from those registries (never live
processes); home/settings/credential paths and metadata; `canaryAgentId`;
`snapshotSha256`. Agent IDs MUST be unique and sorted.
`INVALID_OR_UNRESOLVED` non-empty, an unreadable source, a post-freeze
generation change, or any expansion after migration starts means
`ACTIVATION = STOPPED`. The snapshot MUST pass `TARGET_SNAPSHOT_AUDIT`
(`§3.3`) before Owner digest acceptance.

### CTR-HEM-003 — First-spawn and missing-home gate

Global flip MUST NOT begin until all paths and declarations in `DEC-HEM-004`
parse and prove ZAI/GLM53 strict readiness, including the freshly-provisioned
Agent requirement. The first-spawn settings source, first-spawn credential
source, and `MINIMAL_SETTINGS` may change ONLY through the separately accepted
child implementation authority of `DEC-HEM-009`, deployed clean and
source-stamped BEFORE any restore or migration production write. New Agent
provision is paused. A missing home, missing source, duplicate YAML key, absent
ZAI provider/model, absent key-presence, or unverified provisioning path MUST
fail closed and trigger rollback if a transaction has begun.

### CTR-HEM-004 — Secret handling

The runner of any child authority MUST NOT read secret values into
stdout/stderr, argv, logs, Git, transcripts, ledger, evidence, or hashes, and
MUST NOT publish or record any credential-file whole-file digest, secret-value
hash, secret-derived fingerprint, or token hash (`DEC-HEM-014`). It MAY verify
only key presence and non-secret file metadata, and MAY perform ephemeral
byte comparison inside the root-owned trusted process with PASS/FAIL-only
output. All secret copies use root-owned secure staging, `umask 077`, no-follow
open semantics, regular-file gate, exact path allowlist, atomic temporary file
in the destination directory, file `fsync`, atomic `rename`, and
parent-directory `fsync`. YAML must parse once with a duplicate-key-rejecting
parser and contain no duplicate `ZAI_API_KEY`. Error paths must redact values.
Secret temporary/staging copies are restored or securely removed according to
the transaction receipt; inability to prove cleanup is
`MANUAL_RECOVERY_REQUIRED`.

### CTR-HEM-005 — Separate restore transaction with staleness-safe reconciliation

The restore of the five pre-existing write pairs executes ONLY under a
separately accepted restore child authority, as the complete transaction of
`DEC-HEM-007` (own prepare/observation/backup/drill/begin/reconcile/verify/
commit/rollback/receipt/owner phases), covering the ten files, metadata,
ACL/xattr, current-state backup, parser state, secret footprint, staging,
ledger, `ERR/EXIT/INT/TERM/HUP`, disk-full/partial-write, and partial restore,
with Nth-file failure restoring the first N−1 files. Reconciliation follows the
staleness-safe rules of `DEC-HEM-007` (settings stanza-precise deletion under
condition A or B; credentials exact-key mapping deletion; STOP on ambiguity).
Backup identity verification is in-process PASS/FAIL only; published historical
digests are not Contract inputs. The restore emits a non-secret receipt
(schema: per-file action taken, parser classification, PASS/FAIL of comparison,
metadata set, zero secret material), requires no restart, and leaves a legal
stable long-lived state. The migration may start only from the audited restored
baseline — never concurrently, never assuming imminent migration.

### CTR-HEM-006 — Covered transaction objects

Each transaction (restore, activation, exit) MUST cover the objects its
phases mutate, and the activation transaction MUST cover: every target Agent
settings file; every authorized recipient credential file; first-spawn settings
source; first-spawn credential source; the deployed `MINIMAL_SETTINGS`
closure identity (already deployed; not mutated by the runner); LaunchDaemon
plist; owner/group/mode; existing ACL/xattr; runtime state; child-process
state; scheduler/ingress pause state; backup and staging directories; source
stamp/byte manifest; and deployment ledger. Rollback MUST restore all covered
objects, not only the plist.

### CTR-HEM-007 — Transaction mechanics

Every child runner MUST use root-owned secure staging, one single-writer lock,
`mktemp`, `umask 077`, no symlink traversal, regular-file checks, exact
absolute-path allowlist, exact preimage identity (PASS/FAIL in-process only for
secret-bearing files), same-filesystem atomic rename, file and directory
`fsync`, and durable phase receipts. It MUST trap `ERR`, `EXIT`, `INT`, `TERM`,
and `HUP`. Disk-full, short/partial write, rename failure, fsync failure,
signal, and process death faults MUST enter full rollback of that transaction.
A rollback failure MUST enter the named `MANUAL_RECOVERY_REQUIRED` state with
scheduler/ingress paused and exact unresolved objects recorded without
secrets.

### CTR-HEM-008 — Backup and restore drill

Before any `BEGIN` boundary (restore or activation), every covered mutable
production object MUST have an exact preimage backup and manifest containing
path, file type, size, owner/group/mode, and ACL/xattr when present — for
secret-bearing files the manifest records metadata and an in-process-only
identity reference, never a published digest. A root-owned isolated restore
drill MUST reconstruct and compare every object and metadata. Backup or drill
failure stops that transaction with zero new writes.

### CTR-HEM-009 — Begin-transaction boundary

`BEGIN_TRANSACTION` is a durable ledger record containing lock identity,
frozen target and recipient digests, source manifest digest, backup manifest
digest, restore-drill/receipt reference, execution authorization,
`BEGIN_TRANSACTION_AT_UTC`, and `EXPIRY_AT_UTC` — the two timestamps frozen
atomically in this same fsynced record per `§1.2`. No covered production
mutation may occur before that record is fsynced. All later phases are either
committed together or fully rolled back.

### CTR-HEM-010 — Quiescence and old children

Before mutation/restart, the runner MUST prove quiescence against every drain
identity of `DEC-HEM-008` with its zero conditions and freshness rules
(pending-turn zero at current epoch; scheduler paused with zero non-terminal
occurrences and prior OwnerLock released; ingress paused with zero non-terminal
records; every child slot EMPTY or provably exited). Old Harness children MUST
undergo controlled shutdown. After restart:

```text
OLD_OC_GO_CHILD_COUNT > 0 -> ACTIVATION FAIL / ROLLBACK
```

Warnings are forbidden. Process age and `pgrep` are not admissible evidence.

### CTR-HEM-011 — Uniform home and first-spawn mutations

Settings and credential readiness MUST be applied to the entire frozen
authorized set as one transaction, not one discovered Agent at a time. Settings
MUST declare the exact ZAI provider/model required by deployed Harness syntax
and preserve unrelated keys. Credential files MUST preserve unrelated keys and
satisfy `CTR-HEM-004`. First-spawn sources MUST be ready (through the already
deployed, source-stamped child implementation) before plist mutation. Any
target failure rolls back all covered home/source mutations.

### CTR-HEM-012 — Exact plist mutation and controlled restart

Only after `CTR-HEM-002` through `CTR-HEM-011` pass may the activation runner
atomically change the exact allowed LaunchDaemon provider/model values from
`oc-go/deepseek-v4-flash` to `zai/glm-5.3`; fallbacks remain empty by deployed
route configuration. The plist must pass `plutil -lint`, exact semantic diff,
owner/group/mode, ACL/xattr checks. One controlled shared-runtime restart is
allowed. Bootstrap, PID/label identity, liveness, and actual runtime env must
pass or the complete transaction rolls back.

### CTR-HEM-013 — CTO override preservation (bound to the compatibility amendment)

`agt_cto-agent` remains governed by
`AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2` as modified only by the
accepted compatibility amendment: its explicit override continues to determine
`provider = zai`, `model = glm-5.3`, `fallbacks = []`. The global flip MUST NOT
delete the CTO override; MUST NOT modify the CTO credential boundary; MUST NOT
add Luna; MUST NOT change the CTO route identity; MUST NOT let the CTO fall
back to the global route. Any CTO route, credential-boundary, or invariant
drift — or any evidence that the actual shared-env change would still break
CTO accepted behavior — triggers `ACTIVATION = STOPPED` and rollback if begun.
The exclusion of `agt_cto-agent` from the target set is valid only while this
clause holds (`DEC-HEM-003`).

### CTR-HEM-014 — Idempotence and inconsistent target state

`ALREADY_APPLIED` is allowed only when all of these independently pass: actual
runtime env; runtime PID and launchd label; complete frozen inventory;
first-spawn readiness; every target home readiness; old oc-go child count zero;
actual new child RPC route; post-switch diagnostic; scheduler/ingress health;
deployment ledger; unexpired Authority; and exact source/deployed-byte pins.
Plist text alone MUST NOT yield success. Any missing or conflicting item is
`INCONSISTENT_TARGET_STATE`, which fails closed and invokes
reconciliation/rollback rather than exit `0`.

### CTR-HEM-015 — Source provenance gate before any program write

`NO_PRODUCTION_WRITE_BEFORE_SOURCE_STAMPED_DEPLOYMENT = YES`. Exact source and
deployed-byte identity for the complete route-closure-critical set
(production-runtime entry/compose/model-overrides/paths; agent-router
route-chain/process/env/spawn/agent-process/process-registry/provider-errors/
RPC; provisioning; production-runtime shim; Harness CLI; spawn helper) MUST be
verified via the separately accepted source-stamp/clean-deployment authority
(DAG nodes 5–8) BEFORE the five-write restore (nodes 14–18), first-spawn
source writes, or migration apply. The stamp and manifest are durable and part
of backups and ledger. Any missing byte, ambiguous commit, dirty source,
unaccepted manifest, or drift triggers `ACTIVATION = STOPPED` before writes or
rollback after transaction start. No emergency exception exists in V1, and no
ordering cycle is permitted.

### CTR-HEM-016 — Route and request observability

Post-restart evidence MUST prove the deployed route chain has exactly one
route, actual RPC provider/model is `zai/glm-5.3`, attempts is `1`,
`fallbackActivated=false`, and observed OpenCode Go requests is `0`. Evidence
MUST come from non-secret runtime/RPC/provider telemetry with exact
PID/session/time boundaries, not configuration text alone.

### CTR-HEM-017 — Scheduler and ingress safety

Scheduler dispatch and notification ingress remain paused until all post-switch
route, child, diagnostic, delivery, and health gates pass. Health probes MUST
be no-delivery and must prove one consumer/owner path, no pending duplicate,
and no replay. Business tasks and failed occurrences MUST NOT be replayed. Any
unhealthy scheduler/ingress state, duplicate admission/delivery, or unresolved
outcome rolls back and remains paused.

### CTR-HEM-018 — Unique non-CTO no-delivery diagnostic with one terminal

The canary from the frozen snapshot and audited execution plan MUST be non-CTO
and ready. Exactly one fresh isolated diagnostic session/job may invoke exactly
the frozen prompt (`DIAGNOSTIC_PROMPT_ID = AGENT_CORE_HEMOSTASIS_DIAGNOSTIC_V1`)
with tools and all delivery disabled, expecting
`EXPECTED_TOKEN = AGENT_CORE_HEMOSTASIS_OK_V1`, under the exact timeout,
cancellation, provider-timeout, `outcome_unknown`, late-settlement, cleanup,
retention, one-invocation/one-result, zero-tool, zero-external-delivery,
zero-retry, zero-oc-go rules of `DEC-HEM-010`. The single permitted terminals
are `DIAGNOSTIC_COMMITTED_CLEAN`,
`DIAGNOSTIC_FAILED_ROLLBACK_REQUIRED`,
`DIAGNOSTIC_OUTCOME_UNKNOWN_MANUAL_RECOVERY`; cleanup-unknown MUST map to the
third terminal and keep delivery paused. The session/job is deleted or closed
per normal retention immediately after a durable evidence receipt; no business
state is merged into `main` session.

### CTR-HEM-019 — Commit ledger and expiry record

`COMMIT` occurs only after every success condition passes and a durable
non-secret ledger records: exact target/recipient/source/backup/transaction
digests (non-secret artifacts only), runtime PID and label, route tuple, health
results, zero-old-child result, zero-oc-go result, diagnostic identity and its
terminal, activation time, `BEGIN_TRANSACTION_AT_UTC`, `EXPIRY_AT_UTC`, and
rollback coordinates. The ledger MUST NOT include secret values or any
secret-derived digest. An expiry monitor satisfying `DEC-HEM-011` MUST be
established before unpause; failure to establish it triggers rollback.

### CTR-HEM-020 — Rollback triggers (pre-COMMIT only)

Any of the following requires rollback of the activation transaction:
incomplete inventory; incomplete target readiness; incomplete first-spawn
source; nonzero in-flight state; nonzero old child; identity drift; YAML parse
or duplicate-key failure; credential-boundary failure; plist lint failure;
runtime bootstrap failure; wrong runtime env; wrong CTO override; diagnostic
failure; scheduler/ingress unhealthy; any oc-go request; double delivery;
source-provenance gate failure; disk/partial-write fault; signal; transaction
receipt failure. After COMMIT, these triggers no longer apply: exit handling
belongs to `CTR-HEM-030`.

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
  exact unresolved non-secret paths/state and recovery owner recorded
```

Rollback restart is permitted only when required to make runtime match the
restored plist and environment. Rollback MUST NOT claim production restored
until `ROLLBACK_SUCCESS`. The same outcome triple applies to the restore
transaction's `ROLLBACK_RESTORE`.

### CTR-HEM-022 — Track isolation

This program MUST NOT depend on or modify PR #115, PR #118, PR #121 (the Luna
successor candidate), Luna/OAuth, OpenCode balance, failed-task replay, or a
permanent route design. No Luna call is permitted. Its completion changes none
of those tracks' lifecycle or merge status.

### CTR-HEM-023 — No retroactive authority

The ledger, PR, runner, and reports MUST state that the five prior writes
happened without this Authority. Acceptance decides future disposition only;
it MUST NOT describe past writes as authorized, ratified, compliant, or covered
at the time they occurred.

### CTR-HEM-024 — No dynamic Owner delegation

From `TARGET_SNAPSHOT_AUDIT` freeze to execution, the Owner's only lawful
actions are: accept the exact audited artifact digest; or reject and restart
the artifact + audit chain. The Owner MUST NOT edit artifacts, add exclusions
or recipients, swap canary/source/closure, or alter execution steps
(`§3.3`). Any artifact change requires regeneration and re-audit.

### CTR-HEM-025 — Canonical credential-source mechanical resolution

Before any credential write, `CREDENTIAL_SOURCE_AUDIT` MUST produce the
non-secret descriptor of `DEC-HEM-005` using the mechanical resolution
algorithm defined from the deployed provisioning closure, and that descriptor
MUST pass independent audit. Unproved path, metadata, or key presence stops
activation. Metadata handling follows the two path-class policies; forcing one
identity across classes is forbidden.

### CTR-HEM-026 — Secret lifecycle

The lifecycle rules of `DEC-HEM-012` (no new Agents without audited snapshot +
amendment; no retained credential on disable/removal; post-COMMIT backup
non-reuse and staging cleanup; expiry disposition via independent exit
authority with default cleanup; successor takeover on roll-forward) are
binding on every child authority of this program.

### CTR-HEM-027 — Child code and deployment dependency

No production write of this program may occur before the separately accepted
`MINIMAL_SETTINGS` implementation (exact files, tests, code audit, Owner merge)
is deployed clean and source-stamped and independently deployment-audited
(`DEC-HEM-009`). A production runner MUST NOT patch deployed code.

### CTR-HEM-028 — Fresh apply-time observations

Every child authority MUST apply the `§4.1` freshness framework: re-observe all
artifact classes before the corresponding write, record
`OBSERVED_AT/MAX_AGE/SOURCE_GENERATION/INVALIDATION_EVENT`, and treat stale or
invalidated artifacts as voiding the dependent audits and acceptances
(`DEC-HEM-013`). PR #117 States are historical observation only.

### CTR-HEM-029 — Expiry monitor

Before delivery unpause, an expiry monitor with the `DEC-HEM-011` properties
(dependency, process identity, owner, heartbeat, durable state, liveness audit,
escalation, exit initiation, expiry receipt) MUST be established by the exit
child authority; `EXPIRY_MONITOR_IMPLEMENTATION_REQUIRED = YES` until then.

### CTR-HEM-030 — Post-COMMIT exit transactions

After COMMIT, every exit path (expiry, roll-forward, rollback-after-commit) is
a NEW, separately authorized and independently audited exit transaction based
on fresh state reconciliation at exit time. Activation preimage backups MUST
NOT be applied to post-COMMIT state.

## 10. Acceptance

Acceptance of THIS Spec is a docs-only governance acceptance. The rows below
define both (a) what an independent reviewer of this Spec must verify now, and
(b) the semantic coverage every child authority's acceptance must keep
verified. `RUNTIME_EVIDENCE_REQUIRED` marks rows whose full proof exists only
when the corresponding child authority executes.

| Acceptance ID | Contracts | Method / required evidence | Expected result | Failure condition |
|---|---|---|---|---|
| ACC-HEM-001 | CTR-HEM-001, CTR-HEM-024, CTR-HEM-027 | governance-field audit of this exact head; DAG presence; child-authority enumeration | governance-valid authority composition (`program`/`none`, no production-execution field); complete DAG; no direct-to-execution jump | invalid field, missing DAG node, self-granted execution authority |
| ACC-HEM-002 | CTR-HEM-013, DEC-HEM-003 | compatibility amendment accepted; CTO invariants enumerated and bound | `CTO_AUTHORITY_COMPATIBILITY = EXPLICITLY_CLOSED`; precedence rule precise; exclusion bound to amendment | prose-only "no conflict"; name-only CTO exclusion |
| ACC-HEM-003 | CTR-HEM-002, DEC-HEM-002 | target-snapshot schema review against authoritative source coordinates | complete partition (4 classes, laws held); coordinates bound; `DIRECT_RUNTIME_REGISTRY = MISSING` declared with prerequisite | abstract source names; unclassified candidates; post-audit exclusion growth |
| ACC-HEM-004 | CTR-HEM-025, DEC-HEM-005 | CREDENTIAL_SOURCE_AUDIT descriptor schema + mechanical-resolution algorithm review | non-secret descriptor fields complete; path-class metadata policies distinct; no unproved canonical assertion | asserted-but-unobserved source facts; uniform identity across path classes |
| ACC-HEM-005 | CTR-HEM-005, CTR-HEM-021, DEC-HEM-006, DEC-HEM-007 | restore-transaction spec review: phases, coverage, staleness-safe reconciliation rules | `OPEN_OWNER_DECISIONS = NONE`; frozen disposition; restore as separate child transaction; N−1 rollback law; stable restored state | open decision; whole-file stale overwrite; restore inside main transaction |
| ACC-HEM-006 | CTR-HEM-004, CTR-HEM-019, DEC-HEM-014 | secret-boundary scan of this Spec and restore evidence schema | zero credential-file digests / secret-derived hashes published or copied from PR #117; PASS/FAIL-only comparisons | any digest table, token hash, or fingerprint in Spec/evidence/ledger |
| ACC-HEM-007 | CTR-HEM-006, CTR-HEM-007, CTR-HEM-008, CTR-HEM-009 | transaction design review: covered objects, mechanics, drill, BEGIN boundary | both timestamps atomically in fsynced BEGIN; per-transaction coverage; disk/signal fault paths | relative expiry; pre-BEGIN writes; plist-only rollback |
| ACC-HEM-008 | CTR-HEM-010, DEC-HEM-008 | drain-identity table audit vs accepted Specs/source | every surface has AUTHORITY/PATH/SCHEMA/ZERO/FRESHNESS/DISPOSITION; missing capabilities declared | generic registry names; process-age/pgrep evidence |
| ACC-HEM-009 | CTR-HEM-012, CTR-HEM-013 | plist mutation + restart + CTO preservation design (RUNTIME_EVIDENCE_REQUIRED at execution) | exact tuple flip; CTO override/identity/boundary unchanged | extra plist delta; CTO drift; CTO falling to global route |
| ACC-HEM-010 | CTR-HEM-014 | idempotence design (RUNTIME_EVIDENCE_REQUIRED at execution) | ALREADY_APPLIED only on complete verified state | plist-only exit 0 |
| ACC-HEM-011 | CTR-HEM-015, CTR-HEM-027, DEC-HEM-009 | ordering audit: code → deploy/stamp → audits → restore → apply | `NO_PRODUCTION_WRITE_BEFORE_SOURCE_STAMPED_DEPLOYMENT = YES`; no cycle | deployment inside transaction; restore before stamp |
| ACC-HEM-012 | CTR-HEM-016, CTR-HEM-018, DEC-HEM-010 | diagnostic design: frozen IDs/token, timeout/cancellation/outcome matrix, single terminal | exactly one of the three terminals; cleanup-unknown never unpauses | retry/tool/delivery allowed; open-ended terminal set |
| ACC-HEM-013 | CTR-HEM-017 | scheduler/ingress pause + no-replay design | paused until all gates; zero replay/duplicate | unpause before diagnostic terminal |
| ACC-HEM-014 | CTR-HEM-019, CTR-HEM-029, CTR-HEM-030, DEC-HEM-011 | expiry computability + monitor + exit-transaction design | `EXPIRY_AT_UTC` computable from BEGIN record; monitor prerequisite listed in DAG; post-COMMIT exits separate | pre-BEGIN COMMIT-time guess; backup reuse after COMMIT |
| ACC-HEM-015 | CTR-HEM-022, CTR-HEM-023 | track-isolation + non-retroactivity audit | isolation flags intact; no retroactive claim | Luna dependency; ratifying past writes |
| ACC-HEM-016 | CTR-HEM-026, DEC-HEM-012 | secret-lifecycle review | all five lifecycle rules present and binding | open key-retention path at expiry/disable |
| ACC-HEM-017 | CTR-HEM-028, DEC-HEM-013 | freshness framework review | all States marked historical; 14 artifact classes with OBSERVED_AT/MAX_AGE/GENERATION/INVALIDATION | apply-time use of PR #117 state |
| ACC-HEM-018 | CTR-HEM-003, CTR-HEM-011, DEC-HEM-004 | first-spawn/missing-home gate review (RUNTIME_EVIDENCE_REQUIRED at execution) | fail-closed policy; freshly-provisioned = zai/glm-5.3 strict via child code authority | WARN-continue; runner-patched deployed code |
| ACC-HEM-019 | CTR-HEM-020, CTR-HEM-021 | rollback-trigger enumeration + outcome-triple review (fault injection at execution) | complete pre-COMMIT trigger list; ROLLBACK_SUCCESS / ROLLBACK_INCOMPLETE / MANUAL_RECOVERY_REQUIRED semantics with restore-transaction parity | false restored claim; open-ended rollback state; post-COMMIT trigger reuse |

Coverage is bidirectional: every `CTR-HEM-001` through `CTR-HEM-030` appears in
at least one row above, and every Acceptance row names existing Contracts.

## 11. Alternatives and disposition

| Alternative | Disposition | Reason / reopen condition |
|---|---|---|
| Execute PR #117 runner | REJECTED | independent audit found authority and transaction blockers; runner only after the full child-authority chain |
| Main Spec as implementation/production authority | REJECTED | governance grammar has no such form; replaced by `program`/`none` + child DAG (this amendment) |
| Keep `production_apply_authority: contracts_on_acceptance_only` | REJECTED | not a governance-defined authorization form; removed without substitute |
| Prose "no conflict" with CTO authority | REJECTED | replaced by the compatibility amendment with a precise precedence rule |
| Dynamic Owner exclusion/target/recipient/canary choice | REJECTED | closed by four independent artifact audit gates + `CTR-HEM-024` |
| Open five-write decision inside accepted Spec | REJECTED | frozen as `ROLLBACK_BY_SEPARATELY_AUTHORIZED_RECONCILIATION_TRANSACTION` |
| Restore as pre-BEGIN exception in the main transaction | REJECTED | separate child transaction with full phase machine |
| Whole-file stale restore from 2026-08-30 backups | REJECTED | staleness-safe parser reconciliation; STOP on ambiguity |
| Publish/copy backup digests as Contract inputs | REJECTED | secret-derived fingerprint material; PASS/FAIL-only in trusted process |
| Assert canonical source path/metadata without observation | REJECTED | mechanical resolution + audited non-secret descriptor |
| Uniform credential identity across path classes | REJECTED | per-path-class metadata policies |
| Deploy MINIMAL_SETTINGS inside the production transaction | REJECTED | child implementation + clean source-stamped deployment first |
| Process age as quiescence | REJECTED | not evidence of zero in-flight turns/tools/delivery |
| Plist-only rollback / plist-text success | REJECTED | transaction mutates homes, sources, secrets, runtime and ledger |
| Copy ZAI key from CTO home | REJECTED | Agent home is not canonical fleet secret source |
| Activation backups reused after COMMIT | REJECTED | separate post-COMMIT exit transactions on fresh state |
| Relative "14 days after COMMIT" recorded pre-BEGIN | REJECTED | not computable; BEGIN-record atomic timestamps |
| Luna fallback / PR #115 or #118 dependency | REJECTED | separate tracks and explicitly out of scope |
| Permanent GLM global default | REJECTED | temporary authority has explicit expiry and mandatory exit |

## 12. Migration, compatibility, and rollback

### 12.1 Program ordering (frozen)

```text
accepted governing authority (this Spec)
→ accepted compatibility amendment (§3.1)
→ accepted MINIMAL_SETTINGS implementation authority (child spec)
→ merged code (tests + code audit + Owner merge decision)
→ accepted source-stamp / clean-deployment authority
→ clean deployment + source stamp
→ independent deployment audit
→ Owner accepts exact source manifest
→ fresh production observations (§4.1)
→ four snapshot/plan audits (target, recipient, source manifest, execution plan)
→ separately accepted restore authority and restore transaction
→ restore receipt audit (+ Owner restore execution record)
→ separately accepted activation authority and audited migration runner
→ Owner activation execution → post-switch production audit
→ expiry or successor exit authority (bounded exit transactions)
```

### 12.2 Restore child transaction

Per `DEC-HEM-007`/`CTR-HEM-005`: an independent transaction; its failure never
enters the migration transaction; its success is a legal long-lived production
state.

### 12.3 Activation transaction phases

```text
PREPARE → FREEZE → BACKUP → RESTORE_DRILL → BEGIN_TRANSACTION
→ HOME_AND_SOURCE_MUTATIONS → PLIST_MUTATION → CONTROLLED_RESTART
→ POST_SWITCH_VERIFICATION → COMMIT
```

No production write may occur before `BEGIN_TRANSACTION`. Any failure from
`BEGIN_TRANSACTION` onward enters complete rollback (`CTR-HEM-020`/`021`).
Failures before it stop with zero migration writes.

### 12.4 Post-COMMIT exits and compatibility

Expiry, roll-forward, and rollback-after-commit are separate exit transactions
(`CTR-HEM-030`). CTO strict routing stays governed by its accepted authority
under the compatibility amendment's carve-out. Session, Agent, Workspace,
Scheduler occurrence/outcome, notification idempotency, and business-delivery
semantics remain unchanged.

## 13. Open questions, prerequisites, and final output

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE (closed by the compatibility amendment)
PARTIAL_SUPERSESSION = NONE
IMPLEMENTATION_PREREQUISITES =
  DIRECT_RUNTIME_REGISTRY = MISSING (authoritative direct-runtime invocation
    registry; OBS-HEM-010)
  EXPIRY_MONITOR_IMPLEMENTATION_REQUIRED = YES (DEC-HEM-011)
  DRAIN_QUERY_CAPABILITY = PARTIAL (in-process reconciliation store has no
    accepted external query API; DEC-HEM-008 item 1)
CONTRACT_COUNT = 30
CONTRACTS_WITH_ACCEPTANCE = 30
AUTHORING_READY_FOR_REVIEW = YES
READY_FOR_INDEPENDENT_AUDIT = YES
READY_FOR_OWNER_ACCEPTANCE = NO
```

Independent review must verify the exact final head, the authority composition
(`program`/`none`, no production-execution field), the DAG completeness, the
compatibility-amendment precedence rule, Contract/Acceptance coverage,
credential and transaction boundaries, target-set partition semantics,
staleness-safe reconciliation, secret-derived-hash prohibition, expiry
computability, and post-COMMIT exit separation. Review recommendation is not
acceptance.
