---
spec_id: AGENT_TRUSTED_FLEET_CUTOVER_V1
status: proposed
type: child-implementation-spec
parent_authorities:
  - AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
  - AGENT_PRIMARY_WORKSPACE_IMPORT_V1
  - AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC
owner_ruling: RESTORE_LEGACY_AGENT_FLEET_YES
---

# Agent Trusted Fleet Cutover V1

> **PROPOSED — no implementation or production authority yet.**
>
> This Spec freezes one one-time restoration of the 86 `OLD_ONLY` historical Agent
> Definitions from the disabled USER runtime into the sole trusted `authsvc` runtime.
> Until this Spec is accepted, implementation, data mutation, runtime reload/restart,
> credential reconciliation, and production cutover are forbidden.

## 1. Authority gap and narrow disposition

Existing accepted authority does not cover the requested operation as a whole:

- `AGENT_PRIMARY_WORKSPACE_IMPORT_V1` authorizes in-place adoption and explicitly
  forbids fleet workspace copying. This cutover instead requires a curated,
  secret-excluding import into trusted workspaces.
- `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` authorizes the formal credential
  provisioning model, but not this 86-Agent production reconciliation.
- No accepted implementation Spec currently authorizes preserve-ID reconciliation of
  these legacy definitions plus trusted home/workspace bootstrap and production cutover.

If accepted, this child Spec grants only the narrow exception required here:
curated import of approved non-sensitive files for the exact 86-Agent target set. It
neither changes the long-lived primary-workspace model nor creates a general migration
API.

```text
GENERAL_MIGRATION_API                = FORBIDDEN
ONE_TIME_OPERATOR                   = REQUIRED
PRESERVE_AGENT_ID                   = REQUIRED
DRY_RUN_FIRST                       = REQUIRED
FAIL_LOUD                           = REQUIRED
RERUN_AFTER_SUCCESS                 = NOOP
BINDING_RESTORE                     = OUT_OF_SCOPE
```

## 2. Frozen production inputs and expected reconciliation

```text
OLD_DEFINITION_SOURCE = /Users/yanfenma/.agent-core/agents.json
OLD_WORKSPACE_MAPPING = /Users/yanfenma/.agent-core/primary-workspaces.json

TRUSTED_DEFINITION_SOURCE = /Users/authsvc/.agent-core/agents.json
TRUSTED_INSTALLED_DEFINITION_SOURCE = /usr/local/libexec/agent-core/config/agents.json
TRUSTED_SOURCE_RELATION = trusted source MUST resolve to the installed source above

OLD_AGENT_DEFINITION_COUNT     = 88
TRUSTED_AGENT_DEFINITION_COUNT = 5
MATCHING                       = 2
OLD_ONLY                       = 86
TRUSTED_ONLY                   = 3
CONFLICTING_DEFINITIONS        = 0
TARGET_RESTORE_COUNT           = 86
EXPECTED_FINAL_DEFINITION_COUNT = 91
```

The operator MUST recompute these values from the live inputs. Any count drift,
conflicting definition, missing source, invalid definition, duplicate ID, or unexpected
runtime state aborts before mutation. The 86 target IDs are the recomputed `OLD_ONLY`
set; no hand-maintained second target registry is allowed.

The dry-run plan MUST emit one non-secret row per target:

```text
agent_id
definition_validation
workspace_source
restoration_status
```

It MUST also prove that the matching 2 and trusted-only 3 rows remain byte-for-byte
unchanged in the proposed trusted Definition document.

## 3. Definition reconciliation

The apply step MUST preserve every exact legacy `agent_id`. It MUST use the formal
caller-supplied-ID writer `writeAgentDefinition()` to atomically validate and write the
complete merged Definition document. `createAgentInConfig()` and any other ID-minting
path are forbidden.

Only the 86 `OLD_ONLY` definitions may be added. The matching 2, trusted-only 3,
default Agent selection, and all unrelated trusted fields MUST remain unchanged.

A rerun after success MUST detect that all targets are already equivalent and report
NOOP without rewriting the file. A rerun with drift MUST fail loud; it MUST NOT silently
replace a trusted definition.

## 4. Trusted home regeneration

Legacy home directories are evidence inputs only and MUST NOT be copied as directories.
Trusted homes MUST be regenerated under the trusted production layout by the existing
formal chain:

```text
production-agent-provision
  -> provisionAgentHome
  -> workspace-bootstrap
```

The provisioner must use trusted deployment sources for settings/profile and preserve
its existing ownership/mode rules. It MUST NOT copy from a legacy home any credential,
token, API key, session secret, settings file, profile, or other opaque state.

For every target, home readiness requires the formally provisioned home, settings,
profile, and `AGENTS.md`-consuming runtime shape expected by spawn preflight.

## 5. Curated workspace import policy

Blind directory copy is forbidden. Import is per file, allowlist-led, non-following for
symlinks, deterministic, and idempotent.

Allowed candidates are limited to Agent-owned, non-sensitive content required for
normal operation:

- `AGENTS.md` and explicit persona-definition documents;
- explicitly approved business documents and materials;
- file-first memory documents and memory directories;
- other non-executable, non-sensitive Agent-owned workspace content admitted by the
  reviewed policy manifest.

The importer MUST deny by path/type and content scan at least:

- credentials, tokens, API keys, cookies, session secrets, private keys, auth caches;
- `.env*`, environment/runtime configuration, credential stores, secret-bearing logs;
- sockets, devices, FIFOs, symlinks, hard-link aliases, and files escaping source root;
- generated runtime state and legacy control-plane metadata;
- any candidate whose sensitivity cannot be determined safely.

Existing non-equivalent destination content MUST NOT be overwritten or merged. The
per-Agent outcome is:

```text
WORKSPACE_IMPORT = PASS      # all required approved content present after import
WORKSPACE_IMPORT = SKIP      # no import needed; destination already equivalent
WORKSPACE_IMPORT = CONFLICT  # unsafe/ambiguous input or non-equivalent destination
```

Any `CONFLICT` blocks that Agent from `RESTORABLE_FOR_BINDING`, is reported without
secret content, and prevents final fleet success. Reports may include paths and reason
codes, never secret values or matching content.

### 5.1 First explicit acceptance object: Build in Public

```text
agent_id = agt_build-in-public-agent
legacy_workspace = /Users/yanfenma/.openclaw/groups/workspace-oc_95bd40ab17712fe0f3a7cf7eb6f4e24a
```

Build in Public MUST be the first target evaluated in dry-run and the first target
processed and verified in apply mode. Fleet apply cannot continue unless it reaches:

```text
BUILD_IN_PUBLIC_DEFINITION_READY = YES
BUILD_IN_PUBLIC_HOME_READY       = YES
BUILD_IN_PUBLIC_WORKSPACE_READY  = YES
BUILD_IN_PUBLIC_SPAWN_PREFLIGHT  = YES
```

## 6. Credential and grant reconciliation

No legacy credential value may be read for transfer, copied, printed, logged, compared,
or written to the trusted store.

For each target, the operator MUST determine from current formal authority and actual
runtime dependencies:

- whether a machine principal/client is required;
- whether the Auth identity already exists;
- whether a trusted credential-store entry is required;
- whether a Workflow and/or Forum grant is currently required.

Reconciliation MUST use the accepted Auth and trusted credential provisioning seams,
including their deterministic identity mapping, idempotency, split-brain failure, atomic
store, and secret-handoff rules. Existing sufficient trusted identity/credential state is
NOOP. Grants are least-privilege and dependency-driven; fleet-wide blanket Workflow or
Forum grants are forbidden.

```text
CREDENTIALS_COPIED_FROM_LEGACY = 0
BLANKET_WORKFLOW_GRANT          = FORBIDDEN
BLANKET_FORUM_GRANT             = FORBIDDEN
```

## 7. One-time operator and execution modes

The implementation MUST be a repository-owned one-time operator/runbook, not a runtime
service or public API. It has exactly two modes:

1. `--dry-run`: read-only; validates authority inputs, computes the exact plan, scans
   workspace candidates, evaluates credential/grant requirements without mutation, and
   emits the complete redacted report.
2. `--apply --plan-digest <digest>`: refuses stale plans; revalidates all inputs, runs
   Build in Public first, then processes the remaining targets deterministically.

All state writes MUST use existing formal atomic writers/provisioners. The operator MUST
record non-secret per-stage status sufficient for safe rerun. Unknown partial state,
source drift, target drift, or policy ambiguity fails loud. Successful rerun reports NOOP.

## 8. Reload and runtime invariant

Definitions, homes, workspaces, and required credential state MUST all complete before
reload. Reload uses formal `agentDefinitionAccess` reload; a controlled restart of the
sole trusted runtime is permitted only if reload cannot satisfy the formal contract.

Post-cutover invariants:

```text
ACTIVE_PRODUCTION_RUNTIME_COUNT = 1
ACTIVE_RUNTIME_USER             = authsvc
OLD_RUNTIME_RUNNING             = NO
```

The disabled USER runtime MUST remain disabled. The operator MUST never start it, use it
as a writer, or enable dual runtime operation.

## 9. Read-only verification and binding boundary

After reload, verify every target independently:

```text
DEFINITION_PRESENT
AGENT_ID_PRESERVED
HOME_READY
WORKSPACE_READY
PROFILE_READY
SPAWN_PREFLIGHT
CREDENTIAL_READINESS   # only where actual dependencies require it
```

`RESTORABLE_FOR_BINDING = YES` only when all required checks for that Agent pass.
`RESTORABLE_FOR_BINDING_COUNT` is the count of such Agents and is the handoff to the
separate task `绑定 执行`.

This task MUST NOT restore or mutate any Feishu binding. These known conflicts remain
frozen and untouched:

```text
feishu:oc_92332...
feishu:oc_9dd74...
```

## 10. Acceptance and final report

Acceptance requires dry-run review, Build in Public success, all required per-Agent
checks, redacted evidence, exactly one `authsvc` production runtime, and the old runtime
stopped. Expected target values do not waive live verification.

The final report schema is fixed:

```text
TASK_NAME = 注册 执行

AUTHORITY_SUFFICIENT
OLD_ONLY_AGENT_COUNT
TARGET_RESTORE_COUNT

DEFINITIONS_ADDED
AGENT_IDS_PRESERVED

HOMES_REGENERATED
WORKSPACES_IMPORTED
WORKSPACE_CONFLICTS

CREDENTIALS_COPIED_FROM_LEGACY
CREDENTIALS_RECONCILED_TRUSTED

BUILD_IN_PUBLIC_DEFINITION_READY
BUILD_IN_PUBLIC_HOME_READY
BUILD_IN_PUBLIC_WORKSPACE_READY
BUILD_IN_PUBLIC_SPAWN_PREFLIGHT

RESTORABLE_FOR_BINDING_COUNT

ACTIVE_PRODUCTION_RUNTIME_COUNT
OLD_RUNTIME_RUNNING

SECRET_DISCLOSURE_FOUND
PRODUCTION_CHANGE
```

Expected successful cutover values include:

```text
TARGET_RESTORE_COUNT                    = 86
DEFINITIONS_ADDED                       = 86
AGENT_IDS_PRESERVED                     = YES
HOMES_REGENERATED                       = 86
WORKSPACE_CONFLICTS                     = 0
CREDENTIALS_COPIED_FROM_LEGACY          = 0
BUILD_IN_PUBLIC_DEFINITION_READY        = YES
BUILD_IN_PUBLIC_HOME_READY              = YES
BUILD_IN_PUBLIC_WORKSPACE_READY         = YES
BUILD_IN_PUBLIC_SPAWN_PREFLIGHT         = YES
RESTORABLE_FOR_BINDING_COUNT            = 86
ACTIVE_PRODUCTION_RUNTIME_COUNT         = 1
OLD_RUNTIME_RUNNING                     = NO
SECRET_DISCLOSURE_FOUND                 = NO
```

## 11. Explicit non-goals

- no general or long-lived migration API;
- no legacy home copy;
- no whole-workspace copy or secret cleanup by disclosure;
- no minted replacement Agent IDs;
- no mutation of the matching 2 or trusted-only 3 definitions;
- no blanket credentials or grants;
- no Feishu binding restoration or conflict resolution;
- no dual-runtime period;
- no implementation or production action while this Spec remains `proposed`.
