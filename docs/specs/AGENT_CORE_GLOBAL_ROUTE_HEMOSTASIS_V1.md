---
spec_id: AGENT_CORE_GLOBAL_ROUTE_HEMOSTASIS_V1
status: proposed
spec_kind: program
authority_level: governing_spec
implementation_authority: none
scope:
  - "Temporary Agent Core global-route hemostasis Governing Program: goals, fail-closed boundaries, named prerequisite DAG, and required child authorities"
  - "Authoritative registry-union migration universe, exact-digest artifact gates, credential-source policy, restore state machine, drain identity, diagnostic cleanup, and expiry semantics"
  - "Frozen disposition of the five pre-authority home writes and source-stamp-before-write ordering"
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
  - https://github.com/mayf3/dsh-agent-core/pull/120
---

# AGENT_CORE_GLOBAL_ROUTE_HEMOSTASIS_V1

> **PROPOSED / NOT ACCEPTED / DO NOT MERGE.** This docs-only Program freezes
> goals, prerequisites, ordering, and safety boundaries. It authorizes no code,
> runner, deployment, restore, credential operation, service restart, or
> production apply. Every implementation and execution action requires a
> separately accepted and merged child Authority. PR #117's runner is forbidden.

## 0. Authoring status and coordinates

```text
TASK_NAME = 授权 执行
TASK_MODE = AMENDMENT_R2
REPOSITORY = mayf3/dsh-agent-core
PR_NUMBER = 120
PR_BASE = 9bb5b97442c7155da36f06e867d1a655410544ac
REVIEWED_OLD_HEAD = 575c30e2a17b36eabccef7c917a9261be502aa98
PREVIOUS_REVIEW_ID = 5062138118
PREVIOUS_REVIEW_RESULT = REVISE
CURRENT_MAIN_AT_AMENDMENT = 9386ac4e4515ea628e2a450f402b540f165c13c3
SPEC_STATUS = proposed
MAIN_SPEC_COMPOSITION = program / implementation_authority:none
PROGRAM_IMPLEMENTATION_AUTHORITY = none
PROGRAM_PRODUCTION_AUTHORITY = NONE
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCTION_APPLY_ALLOWED_NOW = NO
OWNER_ACCEPTANCE_RECORDED = NO
MAIN_SPEC_COUNT = 1
COMPATIBILITY_SPEC_IN_PR = NO
ATOMIC_MULTI_SPEC_ACCEPTANCE = NOT_APPLICABLE
```

The prior compatibility-amendment candidate is removed from the final PR tree.
Review `5062138118` established that it could not lawfully mix amendment,
sibling, and supersession semantics. This Program does not replace that
candidate and does not resolve the underlying classification question.

## 1. Goal, completion, and immutable boundaries

During the OpenCode Go quota incident, the eventual program goal is to place
every subject in an independently frozen target set on exactly:

```text
TARGET_PROVIDER = zai
TARGET_MODEL = glm-5.3
TARGET_FALLBACKS = []
TARGET_MODE = GLM53_STRICT_SINGLE_ROUTE
```

Completion eventually requires all of the following, proved under child
Authorities: exact deployed route and runtime environment; readiness for every
included subject; old-provider child count zero; one isolated no-delivery
non-CTO diagnostic; exactly one provider attempt with no fallback; scheduler and
ingress health; zero replay or duplicate delivery; and durable non-secret
receipts bound to exact audited artifacts.

This Program preserves these closed boundaries:

```text
INVALID_PRODUCTION_AUTHORITY_FIELD_REMOVED = YES
FIVE_WRITES_DISPOSITION_FROZEN = YES
OPEN_OWNER_DECISIONS = NONE
RETROACTIVE_AUTHORIZATION = FORBIDDEN
PUBLIC_SECRET_DERIVED_HASH = FORBIDDEN
MINIMAL_SETTINGS_CHILD_SPEC_REQUIRED = YES
PRODUCTION_RUNNER_MAY_PATCH_DEPLOYED_CODE = NO
NO_PRODUCTION_WRITE_BEFORE_SOURCE_STAMPED_DEPLOYMENT = YES
RECIPIENT_SET_EQUALITY = YES
SECRET_LIFECYCLE_CLOSED = YES
POST_COMMIT_EXIT_TRANSACTION_REQUIRED = YES
HISTORICAL_OBSERVATION_IS_NOT_APPLY_PROOF = YES
PR117_RUNNER = FORBIDDEN
PR115_DEPENDENCY = NONE
PR118_DEPENDENCY = NONE
PR121_LUNA_SUCCESSOR_DEPENDENCY = NONE
LUNA = OUT_OF_SCOPE
OAUTH = OUT_OF_SCOPE
OPENCODE_BALANCE = OUT_OF_SCOPE
FAILED_TASK_REPLAY = OUT_OF_SCOPE
```

No acceptance of this Program alone permits implementation. No production
command appears in or is authorized by this document.

## 2. CTO shared-environment prerequisite

The accepted CTO Activation V2 freezes route, credential, and transaction
boundaries. Whether its `global/non-target unchanged` language was only a
historical activation-transaction boundary or remains a continuing constraint
must be decided by a separate child Authority.

```text
CTO_SHARED_ENV_CONSTRAINT = UNRESOLVED_PREREQUISITE
CTO_SHARED_ENV_CONSTRAINT_CLASSIFICATION = REQUIRED
CTO_SHARED_ENV_CONSTRAINT_RESOLUTION = REQUIRED_SEPARATE_CHILD_AUTHORITY
CTO_COMPATIBILITY_AUTHORITY = REQUIRED_SEPARATE_CHILD
CTO_COMPATIBILITY_CHILD_AUTHORITY = REQUIRED
CTO_COMPATIBILITY_CHILD_STATUS = NOT_AUTHORED_OR_NOT_ACCEPTED
CTO_COMPATIBILITY_READY = NO
CTO_CONFLICT_CLOSED_BY_MAIN_SPEC = NO
GLOBAL_ENV_MUTATION_ALLOWED_BEFORE_CHILD_ACCEPTANCE = NO
GLOBAL_ENV_CHANGE_ALLOWED_NOW = NO
ALL_HEMOSTASIS_IMPLEMENTATION = FORBIDDEN
```

The future child must independently choose exactly one classification:

1. **Historical transaction boundary.** It must not invent an amendment or
   carve-out. It may establish a non-conflicting sibling/compatibility Authority,
   or an independent audit may establish that no additional carve-out is needed.
2. **Continuing current constraint.** It must use a governance-permitted
   successor, whole-Spec supersession, or already-defined explicit precedence
   mechanism. A document governed by the parent must not override that parent.

This Program does not interpret governance §9.2, does not decide whether
supersession is required, does not establish precedence, and does not alter
Activation V2's accepted meaning. The child must enumerate and preserve:

```text
current session identity
current turn state
admission state
outcome_unknown reconciliation
process generation
ownership token
real exit
post-restart admission
route identity
provider/model
credential boundary
providerEnv
fallbacks
continuity/cleanup
```

The accepted CTO route and credential invariants remain authoritative. Any
unresolved classification or inability to preserve them means activation is
stopped.

## 3. Named dependency DAG

```text
DAG_IDENTITY = named nodes + explicit edges + required terminal gates
FIXED_NODE_COUNT = NONE
```

Node count is not a correctness criterion. Every edge below is normative.
Parallel chains may converge only where an explicit edge permits it.

### 3.1 Code and capability chains

```text
MINIMAL_SETTINGS_CHILD_AUTHORITY
→ MINIMAL_SETTINGS_CODE
→ MINIMAL_SETTINGS_CODE_AUDIT
→ OWNER_MERGE_DECISION
→ MERGE_AND_SOURCE_STAMPED_DEPLOYMENT

DIRECT_RUNTIME_REGISTRY_AUTHORITY
→ DIRECT_RUNTIME_REGISTRY_IMPLEMENTATION
→ DIRECT_RUNTIME_REGISTRY_CODE_AUDIT
→ MERGE_AND_SOURCE_STAMPED_DEPLOYMENT
→ DIRECT_RUNTIME_REGISTRY_RUNTIME_AUDIT
→ OWNER_DIRECT_RUNTIME_CAPABILITY_ACCEPTANCE

DRAIN_QUERY_CAPABILITY_AUTHORITY
→ DRAIN_QUERY_IMPLEMENTATION
→ DRAIN_QUERY_CODE_AUDIT
→ MERGE_AND_SOURCE_STAMPED_DEPLOYMENT
→ DRAIN_QUERY_RUNTIME_AUDIT
→ OWNER_DRAIN_QUERY_CAPABILITY_ACCEPTANCE

DIAGNOSTIC_CLEANUP_AUTHORITY
→ DIAGNOSTIC_CLEANUP_IMPLEMENTATION
→ DIAGNOSTIC_CLEANUP_CODE_AUDIT
→ MERGE_AND_SOURCE_STAMPED_DEPLOYMENT
→ DIAGNOSTIC_CLEANUP_RUNTIME_AUDIT
→ OWNER_DIAGNOSTIC_CLEANUP_CAPABILITY_ACCEPTANCE

EXPIRY_MONITOR_AUTHORITY
→ EXPIRY_MONITOR_IMPLEMENTATION
→ EXPIRY_MONITOR_CODE_AUDIT
→ MERGE_AND_SOURCE_STAMPED_DEPLOYMENT
→ MONITOR_LIVENESS_AUDIT
→ OWNER_MONITOR_ACCEPTANCE
```

Each code-producing capability needs its own accepted implementation Authority.
The production runner must not implement an absent registry, query API, cleanup
primitive, source resolver, or monitor opportunistically.

### 3.2 Source-stamp and deployment chain

```text
CTO_COMPATIBILITY_CHILD_AUTHORITY
→ SOURCE_STAMP_AND_CLEAN_DEPLOYMENT_AUTHORITY

MERGE_AND_SOURCE_STAMPED_DEPLOYMENT
→ SOURCE_STAMP_AND_CLEAN_DEPLOYMENT_AUTHORITY
→ CLEAN_DEPLOYMENT
→ DEPLOYMENT_AUDIT

DEPLOYMENT_AUDIT
→ SOURCE_MANIFEST_GENERATION
→ SOURCE_MANIFEST_AUDIT
→ OWNER_SOURCE_MANIFEST_ACCEPTANCE
```

The source manifest acceptance is after audit, never before it.

### 3.3 Dynamic artifact chains

Every dynamic artifact has the complete three-stage chain:

```text
SOURCE_MANIFEST_GENERATION
→ SOURCE_MANIFEST_AUDIT
→ OWNER_SOURCE_MANIFEST_ACCEPTANCE

TARGET_SNAPSHOT_GENERATION
→ TARGET_SNAPSHOT_AUDIT
→ OWNER_TARGET_SNAPSHOT_ACCEPTANCE

RECIPIENT_SNAPSHOT_GENERATION
→ RECIPIENT_SNAPSHOT_AUDIT
→ OWNER_RECIPIENT_SNAPSHOT_ACCEPTANCE

EXECUTION_PLAN_GENERATION
→ EXECUTION_PLAN_AUDIT
→ OWNER_EXECUTION_PLAN_ACCEPTANCE

CREDENTIAL_SOURCE_DESCRIPTOR_GENERATION
→ CREDENTIAL_SOURCE_AUDIT
→ OWNER_CREDENTIAL_SOURCE_DESCRIPTOR_ACCEPTANCE
```

Credential-source resolution must be frozen before descriptor generation:

```text
CREDENTIAL_SOURCE_RESOLUTION_AUTHORITY_OR_FROZEN_ALGORITHM
→ CREDENTIAL_SOURCE_DESCRIPTOR_GENERATION
→ CREDENTIAL_SOURCE_AUDIT
→ OWNER_CREDENTIAL_SOURCE_DESCRIPTOR_ACCEPTANCE
```

The Owner may accept only the exact digest already audited. Any content,
canary, exclusion, recipient, source coordinate, or execution-step change voids
both audit and Owner acceptance and restarts generation. The Owner must not add
an Agent, recipient, exclusion, canary, or step after audit. Artifact acceptance
is not production execution authorization.

### 3.4 Fresh observation, restore, activation, and unpause edges

```text
OWNER_SOURCE_MANIFEST_ACCEPTANCE
→ FRESH_PRODUCTION_OBSERVATION

OWNER_DIRECT_RUNTIME_CAPABILITY_ACCEPTANCE
→ FRESH_PRODUCTION_OBSERVATION
OWNER_DRAIN_QUERY_CAPABILITY_ACCEPTANCE
→ FRESH_PRODUCTION_OBSERVATION
OWNER_DIAGNOSTIC_CLEANUP_CAPABILITY_ACCEPTANCE
→ FRESH_PRODUCTION_OBSERVATION
OWNER_MONITOR_ACCEPTANCE
→ FRESH_PRODUCTION_OBSERVATION

FRESH_PRODUCTION_OBSERVATION
→ TARGET_SNAPSHOT_GENERATION
FRESH_PRODUCTION_OBSERVATION
→ RECIPIENT_SNAPSHOT_GENERATION
FRESH_PRODUCTION_OBSERVATION
→ CREDENTIAL_SOURCE_DESCRIPTOR_GENERATION
FRESH_PRODUCTION_OBSERVATION
→ EXECUTION_PLAN_GENERATION

OWNER_TARGET_SNAPSHOT_ACCEPTANCE
→ RESTORE_AUTHORITY_ACCEPTED
OWNER_RECIPIENT_SNAPSHOT_ACCEPTANCE
→ RESTORE_AUTHORITY_ACCEPTED
OWNER_CREDENTIAL_SOURCE_DESCRIPTOR_ACCEPTANCE
→ RESTORE_AUTHORITY_ACCEPTED
OWNER_EXECUTION_PLAN_ACCEPTANCE
→ RESTORE_AUTHORITY_ACCEPTED

RESTORE_AUTHORITY_ACCEPTED
→ RESTORE_RUNNER_IMPLEMENTED
→ RESTORE_RUNNER_AUDITED
→ RESTORE_EXECUTION_PLAN_AUDITED
→ OWNER_EXECUTION_AUTHORIZATION
→ RESTORE_TRANSACTION
→ TERMINAL_RECEIPT
→ INDEPENDENT_RECEIPT_AUDIT

INDEPENDENT_RECEIPT_AUDIT
→ HEMOSTASIS_ACTIVATION_AUTHORITY
→ MIGRATION_RUNNER_IMPLEMENTATION
→ MIGRATION_RUNNER_CODE_AUDIT
→ ACTIVATION_EXECUTION_PLAN_AUDIT
→ OWNER_ACTIVATION_EXECUTION_AUTHORIZATION
→ ACTIVATION_TRANSACTION
→ POST_SWITCH_PRODUCTION_AUDIT

OWNER_MONITOR_ACCEPTANCE
→ PRODUCTION_DELIVERY_UNPAUSE
POST_SWITCH_PRODUCTION_AUDIT
→ PRODUCTION_DELIVERY_UNPAUSE
DEFAULT_EXPIRY_EXIT_AUTHORITY_READY
→ PRODUCTION_DELIVERY_UNPAUSE
```

```text
DEFAULT_EXPIRY_EXIT_AUTHORITY_READY = YES required before activation COMMIT or unpause
EXPIRY_MONITOR_REQUIRED_BEFORE_PRODUCTION_DELIVERY_UNPAUSE = YES
NO_PRODUCTION_WRITE_BEFORE_SOURCE_STAMPED_DEPLOYMENT = YES
```

The source-stamp gate covers five-write reconciliation, first-spawn settings,
first-spawn credential source, target homes, plist, and runtime restart.

## 4. Apply-time freshness: exactly 14 classes

Every row is independently observable and machine-computable. Allowed
`MAX_AGE_KIND` is the closed enum `SECONDS | SAME_TRANSACTION |
SAME_SOURCE_GENERATION`. For `SECONDS`, the value is a non-negative integer
number of seconds. `N/A` is used only when the kind itself supplies the bound.

| CLASS_ID | OBSERVED_AT_UTC | MAX_AGE_KIND | MAX_AGE_VALUE | SOURCE_GENERATION | INVALIDATION_EVENT | REOBSERVATION_GATE |
|---|---|---|---:|---|---|---|
| QUOTA_STATE | RFC3339 UTC | SECONDS | 300 | incident-generation | quota report or Owner confirmation changes | OBSERVE → AUDIT → OWNER EXACT-DIGEST ACCEPTANCE |
| GLOBAL_PLIST | RFC3339 UTC | SAME_SOURCE_GENERATION | N/A | plist byte+metadata generation | any byte or metadata change | OBSERVE → AUDIT → OWNER EXACT-DIGEST ACCEPTANCE |
| RUNTIME | RFC3339 UTC | SAME_TRANSACTION | N/A | runtimeEpoch+pid+launchd label | process lifecycle or env change | OBSERVE → AUDIT → OWNER EXACT-DIGEST ACCEPTANCE |
| CHILDREN | RFC3339 UTC | SAME_TRANSACTION | N/A | registry generation+ownership tokens | spawn, exit, admission, reconciliation change | OBSERVE → AUDIT → OWNER EXACT-DIGEST ACCEPTANCE |
| AGENT_HOMES | RFC3339 UTC | SAME_SOURCE_GENERATION | N/A | per-file metadata+parser generation | any write or parse-class change | OBSERVE → AUDIT → OWNER EXACT-DIGEST ACCEPTANCE |
| FIRST_SPAWN_SOURCES | RFC3339 UTC | SAME_SOURCE_GENERATION | N/A | source metadata+parser generation | any write or resolver change | OBSERVE → AUDIT → OWNER EXACT-DIGEST ACCEPTANCE |
| BACKUPS | RFC3339 UTC | SAME_TRANSACTION | N/A | backup transaction generation | mutation or failed in-process comparison | OBSERVE → AUDIT → OWNER EXACT-DIGEST ACCEPTANCE |
| AGENT_INVENTORY | RFC3339 UTC | SAME_SOURCE_GENERATION | N/A | agents registry generation | registry or enabled-state change | OBSERVE → AUDIT → OWNER EXACT-DIGEST ACCEPTANCE |
| BINDINGS | RFC3339 UTC | SAME_SOURCE_GENERATION | N/A | binding store generation | binding change | OBSERVE → AUDIT → OWNER EXACT-DIGEST ACCEPTANCE |
| SCHEDULER | RFC3339 UTC | SAME_TRANSACTION | N/A | JobStore+occurrence+fence generation | job, occurrence, fence, lock, or run-log change | OBSERVE → AUDIT → OWNER EXACT-DIGEST ACCEPTANCE |
| INGRESS | RFC3339 UTC | SAME_TRANSACTION | N/A | idempotency+evidence generation | admission, idempotency, health, or log change | OBSERVE → AUDIT → OWNER EXACT-DIGEST ACCEPTANCE |
| WORKFLOWS | RFC3339 UTC | SECONDS | 60 | authoritative API result generation | assignment or API generation change | OBSERVE → AUDIT → OWNER EXACT-DIGEST ACCEPTANCE |
| SOURCE_STAMP | RFC3339 UTC | SAME_SOURCE_GENERATION | N/A | source stamp generation | source stamp or repository coordinate change | OBSERVE → AUDIT → OWNER EXACT-DIGEST ACCEPTANCE |
| DEPLOYED_BYTE_MANIFEST | RFC3339 UTC | SAME_SOURCE_GENERATION | N/A | manifest+deployment generation | any deployed-byte change | OBSERVE → AUDIT → OWNER EXACT-DIGEST ACCEPTANCE |

Class count is exactly 14. Runtime and children are separate. Any age violation,
generation change, or invalidation event voids dependent artifacts, audits, and
Owner acceptances.

All PR #117 observations are historical only:

```text
HISTORICAL_OBSERVATION_ONLY = YES
APPLY_TIME_PROOF = NO
```

## 5. Registry-union target universe

Authoritative source coordinates are frozen as follows; the future snapshot
must bind their deployed byte identity and live source generation:

| Surface | Repository/source coordinate | Production identity |
|---|---|---|
| production layout | `packages/production-runtime/src/paths.js` `resolveProductionLayout()` | `<root>/agents.json`, `<root>/bindings/bindings.json`, `<root>/scheduler/jobs.json`, `<root>/scheduler/runs.jsonl`, `<root>/notification-ingress/idempotency.json`, `<root>/notification-ingress/evidence.jsonl` |
| Agent identity/enabled | `packages/agent-definition/src/definition.js` | canonical Agent ID; `disabled` is the operational enabled-state field |
| bindings | `packages/agent-router/src/binding-store.js` | version-1 binding document generation |
| Scheduler | `packages/scheduler/src/store.js`, `occurrence.js`, `lock.js` | JobStore v2 jobs/occurrences/fences, run-log position, exact OwnerLock token |
| ingress | `packages/notification-ingress/src/` | idempotency/evidence generations and health identity |
| workflows | authoritative svc-workflow API | query generation and assignment identities |
| in-flight reconciliation | `packages/agent-router/src/reconciliation/store.js` | runtimeEpoch plus unresolved/settled outcome generation |
| child lifecycle | `packages/agent-router/src/process-registry.js` | processGeneration plus ownershipToken and real-exit transition |
| direct runtime | capability absent at this revision | future accepted direct-runtime registry generation |

```text
CANDIDATE_UNIVERSE = UNION(
  authoritative agents registry subjects,
  binding-referenced subjects,
  scheduler-job-referenced subjects,
  notification-ingress-referenced subjects,
  workflow-referenced subjects,
  direct-runtime-registry subjects
)
```

Every union subject is totally reconciled against the Agent registry and enters
exactly one class:

```text
INCLUDED
EXCLUDED_WITH_ACCEPTED_AUTHORITY
DISABLED_AND_NON_WAKEABLE
INVALID_OR_UNRESOLVED
```

The following always enter `INVALID_OR_UNRESOLVED`: wake-source orphan; Agent
with unknown enabled state; identity that cannot be canonicalized; absent or
unreadable direct-runtime registry; conflicting subject generations; and any
source-generation change after freeze.

```text
INVALID_OR_UNRESOLVED != [] → ACTIVATION = STOPPED
```

No execution-time Owner exclusion is allowed. Every exclusion names an accepted
Authority and exact audited evidence. The recipient set equals included Agents
plus only the independently audited canonical first-spawn source; no hand-added
recipient is permitted.

## 6. Credential-source resolution and byte-preserving restore

The canonical source is not assumed. A child Authority or frozen algorithm must
resolve effective service user, home resolution, environment overrides,
configured source, deployed provisioning code, path class, and symlink policy.
It generates a non-secret descriptor containing path, path class, provenance,
file type, owner, group, mode, key-name presence, duplicate-key status, and read
and write authority. The descriptor follows generation → audit → exact-digest
Owner acceptance.

Credential restoration uses exactly:

```text
CREDENTIAL_EDIT_PRIMITIVE = CST/token/span-based mapping-local byte edit
WHOLE_DOCUMENT_YAML_RESERIALIZATION_ALLOWED = NO
NON_TARGET_BYTES_IDENTICAL_REQUIRED = YES
```

A duplicate-key-rejecting parser is used only to validate structure and locate
the unique top-level `ZAI_API_KEY` mapping's exact byte span. The target value is
opaque secret bytes. The edit removes only that mapping and its dedicated line
ending. Every other byte remains identical, including values, quoting, order,
comments, whitespace, newline style, and document directives.

The value must never reach stdout/stderr, logs, argv, ledger, Git, transcript,
or evidence. If the mapping-local span is not unique, restore stops. If any
non-target byte changes, restore rolls back. Whole-file stale credential restore
and secret-derived hashes or credential-file digests are forbidden. Secret
comparison may occur only ephemerally inside the trusted process with no value
or derived digest emitted.

## 7. Restore child transaction

Owner execution authorization is before transaction BEGIN. The complete order is:

```text
RESTORE_AUTHORITY_ACCEPTED
→ RESTORE_RUNNER_IMPLEMENTED
→ RESTORE_RUNNER_AUDITED
→ RESTORE_EXECUTION_PLAN_AUDITED
→ OWNER_EXECUTION_AUTHORIZATION
→ PREPARE_RESTORE
→ BACKUP_CURRENT_STATE
→ RESTORE_DRILL
→ BEGIN_RESTORE_TRANSACTION
→ RECONCILE
→ VERIFY
→ {
     COMMIT_RESTORE
     or
     ROLLBACK_RESTORE
   }
→ TERMINAL_RECEIPT
→ INDEPENDENT_RECEIPT_AUDIT
```

`COMMIT_RESTORE` and `ROLLBACK_RESTORE` are mutually exclusive branches, never a
linear sequence. Exactly one terminal is recorded:

```text
RESTORE_COMMITTED
RESTORE_ROLLED_BACK_VERIFIED
RESTORE_MANUAL_RECOVERY_REQUIRED
```

They are mutually exclusive and complete. If object N fails, objects 1 through
N−1 return to their state immediately before this restore BEGIN, and object N
must retain no partial write. Receipt audit occurs only after execution ends.
Successful restore without later migration is a stable lawful production state.
The five prior writes remain unauthorized historical facts and have frozen
future disposition `ROLLBACK_BY_SEPARATELY_AUTHORIZED_RECONCILIATION_TRANSACTION`.

The restore covers all ten affected settings/credential files and their
metadata, ACL/xattr, current-state backup, parser state, staging, secret
footprint, signal/disk/partial-write failures, and durable receipts. Settings
stanza removal must also be mapping-local and ambiguity-stopping.

## 8. Drain-query and old-child identity

The drain-query capability must emit at least:

```text
agentId
pid
processGeneration
ownershipToken
routeRef
providerRaw
providerCanonical
model
sessionId
turnState
admissionState
outcomeState
exitObserved
observedAt
sourceGeneration
```

Provider alias normalization is an independently audited registry artifact. The
runner must not guess that `oc-go == opencode-go`.

```text
OLD_OC_GO_CHILD_PREDICATE = exact audited providerCanonical/model/generation predicate
```

Zero requires real exit observed, ownership token released, registry generation
advanced, all `outcome_unknown` records reconciled, no old child able to admit
work, and predicate count exactly zero. Missing drain-query capability stops
activation. `pgrep`, process age, and generic process names are not admissible.

## 9. Diagnostic terminal and missing cleanup capability

Accepted lifecycle sources preserve unresolved reconciliation records and
Scheduler deletion removes only the job definition while occurrence/run evidence
persists. No accepted product Authority supplies one unique primitive that also
retires the diagnostic session, prevents replay/delivery, clears pending work,
and persists cleanup generation. Therefore:

```text
DIAGNOSTIC_CLEANUP_CAPABILITY_MISSING = YES
DIAGNOSTIC_CLEANUP_SUCCESS = DIAGNOSTIC_RETIRED_AND_NON_WAKEABLE
```

The named terminal may become usable only after the full child chain in §3.1.
It must prove: invocation cannot execute again; Scheduler cannot replay it; no
delivery can occur; no pending job remains; no active session remains; a
non-secret evidence receipt is auditable; and cleanup generation is persisted.
No second cleanup terminal is permitted.

The diagnostic itself is exactly one fresh non-CTO, no-delivery invocation from
the exact audited canary and plan: zero tools, retries, business delivery, or
oc-go request. Cleanup uncertainty keeps delivery paused and enters manual
recovery.

## 10. Expiry and secret lifecycle

`BEGIN_TRANSACTION_AT_UTC` and
`EXPIRY_AT_UTC = BEGIN_TRANSACTION_AT_UTC + 14 calendar days` are written
atomically in the same fsynced activation BEGIN record. An accepted default exit
Authority and audited live monitor must exist before COMMIT or delivery unpause.
The monitor has identity, owner, heartbeat, durable state, escalation, exit
initiation, and expiry receipt.

Post-COMMIT expiry, roll-forward, and rollback-after-commit are new separately
authorized transactions based on fresh state. Activation preimages must not be
used against post-COMMIT state. New Agent creation is forbidden while the target
snapshot is frozen. Disabled/removed Agents do not retain target-home
credentials. Staging copies are removed after clean COMMIT. A successor must
explicitly take over recipients and credential lifecycle; otherwise the default
accepted exit Authority performs credential cleanup.

## 11. Source and scheduler coordinate policy

The source-stamp manifest covers the complete route/provision/runtime closure,
including production-runtime composition and paths, model overrides,
agent-router route/process/env/spawn/reconciliation/process registry/provider
errors/RPC, provisioning, runtime shim, Harness CLI, and spawn helper. Clean
deployment and audit precede source-manifest generation.

Current main `9386ac4e4515ea628e2a450f402b540f165c13c3` changes Scheduler terminal-success
presentation only. It does not change JobStore, occurrence/fence identity,
pause/drain semantics, or delivery attempt count. Future source and deployed-byte
manifests must nevertheless use the latest pre-apply coordinates.

## 12. Contracts

### CTR-HEM-001 — Pure Program composition

Frontmatter is schema-valid; every scope item is a string; `spec_kind: program`
and `implementation_authority: none`; no production authority field exists.

### CTR-HEM-002 — No direct authority

Acceptance freezes goals and dependencies only. Implementation, restore,
deployment, and production execution remain forbidden until their child chains
are independently accepted and merged.

### CTR-HEM-003 — CTO prerequisite

CTO compatibility remains unresolved and requires a separate child Authority
that classifies the accepted constraint without a parent-governed carve-out.

### CTR-HEM-004 — Named DAG

Correctness is named nodes, explicit edges, and terminal gates; fixed node count
is none. Every capability chain in §3 exists before its dependent gate.

### CTR-HEM-005 — Audit before Owner acceptance

For source manifest, target snapshot, recipient snapshot, execution plan, and
credential-source descriptor, generation precedes independent audit and audit
precedes exact-digest Owner acceptance.

### CTR-HEM-006 — No dynamic scope

Any artifact mutation voids audit and acceptance. The Owner cannot add Agents,
recipients, exclusions, canary, source, or execution steps after audit.

### CTR-HEM-007 — Source-stamp-before-write

No five-write reconciliation, first-spawn write, home write, plist mutation, or
runtime restart occurs before clean source-stamped deployment, deployment audit,
source-manifest audit, and exact-digest acceptance.

### CTR-HEM-008 — Registry union

Candidate universe is the total union in §5. Every subject has exactly one
classification; any invalid/unresolved subject stops activation.

### CTR-HEM-009 — Credential descriptor

Resolution is implemented only under a child Authority or frozen algorithm and
produces the audited non-secret descriptor before credential writes.

### CTR-HEM-010 — Secret boundary

No secret value or secret-derived hash/digest appears in output, logs, argv,
ledger, Git, transcript, evidence, or public artifacts.

### CTR-HEM-011 — Byte-local credential edit

Only CST/token/span mapping-local removal is permitted; all non-target bytes are
identical; ambiguity stops; whole-document YAML reserialization is forbidden.

### CTR-HEM-012 — Restore authorization position

Owner execution authorization occurs after plan audit and before
`BEGIN_RESTORE_TRANSACTION`.

### CTR-HEM-013 — Restore branch semantics

COMMIT and rollback are exclusive branches with exactly one of three terminals;
Nth-object failure restores prior objects and leaves no partial current object.

### CTR-HEM-014 — Stable restore outcome

A committed restore is legal indefinitely even if activation never starts.
Receipt audit follows transaction termination.

### CTR-HEM-015 — Drain capability

The external mechanical drain query and audited provider normalization exist;
missing capability stops activation; process-list inference is forbidden.

### CTR-HEM-016 — Old-child zero

The exact providerCanonical/model/generation predicate returns zero only after
real exit, token release, generation advance, reconciliation, and admission
closure.

### CTR-HEM-017 — Diagnostic cleanup

Only `DIAGNOSTIC_RETIRED_AND_NON_WAKEABLE` is cleanup success. Until the missing
capability chain passes, diagnostic execution and unpause are forbidden.

### CTR-HEM-018 — Diagnostic isolation

Exactly one audited-canary invocation has no tools, retry, delivery, or old-route
request; cleanup/outcome uncertainty is manual recovery with admission paused.

### CTR-HEM-019 — Expiry monitor before unpause

Monitor authority, implementation, code audit, deployment, liveness audit, and
Owner capability acceptance all precede production delivery unpause.

### CTR-HEM-020 — Default exit authority

An accepted default expiry/cleanup Authority exists before activation COMMIT or
unpause. Post-COMMIT exits are fresh separate transactions.

### CTR-HEM-021 — Exactly 14 freshness classes

The table has exactly the named 14 classes, machine-computable max-age kinds,
source generation, invalidation events, and re-observation gates.

### CTR-HEM-022 — Historical evidence only

PR #117 evidence is historical and never apply-time proof; its runner remains
forbidden and past writes are not retroactively authorized.

### CTR-HEM-023 — Recipient equality

Recipients equal included target Agents plus only the audited canonical
first-spawn source. Any additional recipient is forbidden.

### CTR-HEM-024 — Five-write disposition

The frozen disposition is reconciliation rollback only under a separate restore
Authority; open Owner decisions are none.

### CTR-HEM-025 — Transaction mechanics

Child runners require an exact allowlist, single writer, no-follow regular-file
gates, secure same-directory staging, atomic replacement, file/directory fsync,
signal handling, disk/partial-write handling, and durable non-secret receipts.

### CTR-HEM-026 — CTO invariant enumeration

The future child enumerates all lifecycle, admission, route, provider/model,
credential, providerEnv, fallback, continuity, and cleanup fields in §2.

### CTR-HEM-027 — Secret lifecycle

Target credential creation, disable/removal, staging, expiry, successor takeover,
and cleanup are closed by accepted child transactions; indefinite silent
retention is forbidden.

### CTR-HEM-028 — Track isolation

PR #115, #118, #121, Luna, OAuth, OpenCode balance, and failed-task replay are
not dependencies and are not modified.

### CTR-HEM-029 — Source-coordinate freshness

Every pre-apply source/deployed-byte manifest uses the latest coordinates;
Scheduler presentation-only changes do not alter its JobStore/fence/drain model.

### CTR-HEM-030 — Fail closed

Any missing Authority, capability, observation, digest acceptance, source stamp,
reconciliation, receipt, monitor, or classification yields STOPPED before write
or rollback/manual recovery after BEGIN. Warnings are never success.

## 13. Acceptance

Acceptance of this Program is docs-only and must independently establish both
mechanical and semantic coverage.

| Acceptance | Contracts | Required result |
|---|---|---|
| ACC-HEM-001 | 001,002 | frontmatter/schema/type valid; pure Program; no implementation/apply authority |
| ACC-HEM-002 | 003,026 | compatibility is a future child prerequisite; no conflict-closed, carve-out, or supersession conclusion |
| ACC-HEM-003 | 004 | named-node/edge DAG topologically valid; fixed count none; all capability chains present |
| ACC-HEM-004 | 005,006 | all five artifact chains are generation → audit → exact-digest acceptance; no dynamic Owner changes |
| ACC-HEM-005 | 007,029 | code/deploy/stamp/audit/source-manifest ordering precedes every production write |
| ACC-HEM-006 | 008 | registry-union universe and four-way total classification are complete |
| ACC-HEM-007 | 009,010,011 | descriptor chain, no secret-derived publication, and exact non-target byte preservation |
| ACC-HEM-008 | 012,013,014 | Owner authorization before BEGIN; exclusive restore branches; stable legal restore terminal |
| ACC-HEM-009 | 015,016 | explicit drain capability and mechanical old-child provider/generation identity |
| ACC-HEM-010 | 017,018 | one cleanup success terminal; missing capability chain explicit; no replay/delivery/session/job residue |
| ACC-HEM-011 | 019,020 | expiry monitor and default exit Authority exist before COMMIT/unpause |
| ACC-HEM-012 | 021 | freshness table contains exactly 14 separately named, machine-computable classes |
| ACC-HEM-013 | 022,024 | five-write decision frozen; no retroactivity; historical evidence not apply proof |
| ACC-HEM-014 | 023,027 | recipient equality and complete secret lifecycle are closed |
| ACC-HEM-015 | 025,030 | transaction mechanics and fail-closed behavior are complete |
| ACC-HEM-016 | 028 | track isolation flags remain exact; open Owner decisions none |

Mechanical validation must report every existing Contract ID and Acceptance ID
exactly once and verify each Acceptance references existing Contracts. Semantic
validation must separately attest every row's required result; matching IDs or
keywords alone is insufficient.

```text
CONTRACT_COUNT = 30
CONTRACTS_WITH_ACCEPTANCE = 30
MECHANICAL_ACCEPTANCE_COVERAGE = REQUIRED
SEMANTIC_ACCEPTANCE_COVERAGE = REQUIRED
OPEN_OWNER_DECISIONS = NONE
```

## 14. Alternatives and disposition

| Alternative | Disposition | Reason |
|---|---|---|
| Run PR #117 | REJECTED | historical evidence and runner do not satisfy authority or transaction gates |
| Main Program grants implementation/apply authority | REJECTED | pure Program has `implementation_authority:none` |
| Repair the compatibility amendment again in this PR | REJECTED | classification must precede legal governance form; separate child required |
| Parent-governed carve-out | REJECTED | lower authority cannot override its governing parent |
| Fixed numeric DAG size | REJECTED | named capabilities, explicit edges, and terminal gates define correctness |
| Owner edits audited scope | REJECTED | exact-digest chain would be bypassed |
| agents.json-only universe | REJECTED | misses orphan wake-source subjects |
| process age or pgrep as drain proof | REJECTED | cannot prove generation, ownership, provider, or outcome |
| whole-document YAML reserialization | REJECTED | permits unrelated byte drift and secret exposure |
| linear COMMIT then rollback restore | REJECTED | mutually exclusive terminal branches are required |
| deleted-or-closed cleanup | REJECTED | product lacks one complete accepted cleanup primitive; explicit child chain required |
| expiry monitor after activation | REJECTED | liveness and default exit must precede COMMIT/unpause |
| Luna/OAuth or failed-task replay dependency | REJECTED | separate tracks and out of scope |

## 15. Final readiness

```text
CURRENT_COMPATIBILITY_AMENDMENT_DISPOSITION = REMOVE_FROM_FINAL_PR_TREE
CTO_CONFLICT_CLAIMED_CLOSED = NO
GLOBAL_ENV_CHANGE_ALLOWED = NO until child Authority is independently accepted and merged
PROGRAM_IMPLEMENTATION_AUTHORITY = none
PROGRAM_PRODUCTION_AUTHORITY = NONE
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
READY_FOR_OWNER_ACCEPTANCE = NO
READY_FOR_INDEPENDENT_AUDIT = YES
NEXT_TASK = 授权 审计
```

An independent reviewer must bind the exact final Head. Review is not Owner
acceptance, implementation authorization, production authorization, or merge.
