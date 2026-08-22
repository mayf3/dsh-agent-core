---
spec_id: AGENT_TRUSTED_FLEET_CUTOVER_V1
status: proposed
type: blocked-child-implementation-spec
review_status: FIX_REQUIRED
authority_preconditions:
  - accepted whole-authority supersession of AGENT_PRIMARY_WORKSPACE_IMPORT_V1
  - accepted external Auth authority for every required Auth or grant mutation
owner_intent_provenance: direct Owner instruction, session 2026-08-22, RESTORE_LEGACY_AGENT_FLEET=YES
---

# Agent Trusted Fleet Cutover V1

> **PROPOSED / BLOCKED — no implementation or production authority.**
>
> This proposed child freezes the requested one-time restoration intent for 86 historical
> Agents. It cannot be accepted or implemented until the authority preconditions in §2
> are satisfied. This PR performs no implementation, data mutation, credential action,
> runtime reload/restart, or binding restoration.

## 1. Goal and hard boundary

Restore the exact `OLD_ONLY` Agent IDs from the disabled USER runtime into the sole
trusted `authsvc` runtime using a dry-run-first, fail-loud, safely resumable one-time
operator. Do not create a general migration API.

```text
PRESERVE_AGENT_ID          = REQUIRED
GENERAL_MIGRATION_API      = FORBIDDEN
LEGACY_HOME_COPY           = FORBIDDEN
LEGACY_CREDENTIAL_COPY     = FORBIDDEN
BLANKET_GRANTS             = FORBIDDEN
BINDING_RESTORE            = OUT_OF_SCOPE
OLD_USER_RUNTIME_ENABLE    = FORBIDDEN
RERUN_AFTER_SUCCESS        = NOOP
```

## 2. Authority graph and blockers

Exact repository authorities at proposal base `e0c73a6cce9f13c23085b8a51aaf9581888449ae`:

| Authority | Exact revision | Relationship |
|---|---|---|
| `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` (accepted) | file last changed at `d83a2ff0e9644611707d7481ef88b4d7d49fb68e` | REUSE only; inherit prerequisites (a)–(d), secret handoff, atomic store, and fail-loud rules |
| `AGENT_PRIMARY_WORKSPACE_IMPORT_V1` (accepted) | file last changed at `d8237502dfebe6a8a290b4e363abf2e672d42362` | CONFLICT: it requires adopt-in-place/zero-copy and forbids fleet copying |
| `AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC` (accepted) | file last changed at `ca30981d5b414f167e04c4fee2f85ba33543c6d1` | REUSE invariants only |
| `AGENT_WORKSPACE_SESSION_MODEL_V2` (accepted Decision) | file last changed at `67404bc7014a6770bb29e041e1736e5d34d8cff3` | REUSE one-Agent/one-primary-workspace invariant |
| this document | exact PR head | NEW proposed child; grants no authority while proposed |

The requested curated copy into trusted workspaces directly conflicts with the accepted
workspace authority. A child cannot partially override it. Before this child can become
accepted, a separately reviewed and accepted **whole-authority superseding Spec** must
replace `AGENT_PRIMARY_WORKSPACE_IMPORT_V1` and explicitly authorize this exact curated
fleet import. This document does not perform that supersession.

Auth principal/client/grant authority is external to this repository. This proposal
pins no external accepted artifact because none was supplied or established in the
Authority Gate. Therefore:

```text
AUTH_MUTATION_BY_THIS_OPERATOR  = FORBIDDEN
GRANT_MUTATION_BY_THIS_OPERATOR = FORBIDDEN
```

Before either becomes executable, the implementation base must pin an accepted external
repository, stable authority ID, exact revision, mutation seam, and relationship. Until
then, only read-only readiness classification is allowed. Missing prerequisite (a), (b),
(c), or (d) from the accepted credential Spec returns
`EXTERNAL_PREREQUISITE_MISSING_<A|B|C|D>`; no DB access, legacy create, CLI-secret stdout,
fake/designated owner, fallback, or partial Auth mutation is allowed.

## 3. Qualified input observation, not authority

The following is Owner-supplied planning evidence, not independently verified production
truth:

```text
subject       = legacy/trusted Agent Definition reconciliation
source        = direct Owner instruction in this task
observed_at   = 2026-08-22
method        = Owner-reported comparison
provenance    = RESTORE_LEGACY_AGENT_FLEET=YES request
old_count     = 88
trusted_count = 5
matching      = 2
old_only      = 86
trusted_only  = 3
conflicting   = 0
```

Frozen input locations:

```text
OLD_DEFINITION_SOURCE = /Users/yanfenma/.agent-core/agents.json
OLD_WORKSPACE_MAPPING = /Users/yanfenma/.agent-core/primary-workspaces.json
TRUSTED_DEFINITION_SOURCE = /Users/authsvc/.agent-core/agents.json
TRUSTED_INSTALLED_DEFINITION_SOURCE = /usr/local/libexec/agent-core/config/agents.json
```

Dry-run MUST independently recompute all counts and safe file identities. It requires
`88/5/2/86/3/0`, final count `91`, and that the trusted source resolves to the installed
source. Drift aborts before mutation with a structured reason. Definition input digests
may be reported because Agent Definitions contain no credentials; workspace candidate
content digests MUST NOT be reported.

## 4. Exact Definition plan

Use `writeAgentDefinition()` with caller-supplied IDs; never call
`createAgentInConfig()`. The plan is:

- add only recomputed `OLD_ONLY=86`, preserving every exact `agent_id`;
- preserve the matching 2 and trusted-only 3 by canonical JSON value equality;
- preserve `defaultAgentId` and every unrelated top-level field by canonical JSON value
  equality;
- reject duplicate IDs, schema errors, unknown top-level fields, source drift, or any
  non-equivalent existing target as `DEFINITION_CONFLICT`.

Canonical equality means recursively sorted object keys, array order preserved, and
JSON scalar type/value preserved; formatting and object-key serialization order are not
part of equality. Safe before/after SHA-256 digests of canonical Definition projections
prove unchanged values.

Each target dry-run row contains only:

```text
agent_id
definition_validation = PASS | CONFLICT:<reason_code>
workspace_source = SAFE_OPAQUE_SOURCE_ID | MISSING | DUPLICATE
restoration_status = PLANNED | NOOP | BLOCKED:<stage>:<reason_code>
```

## 5. Trusted home

Never open legacy home files for migration. Rebuild trusted homes only through the
existing formal chain:

```text
production-agent-provision -> provisionAgentHome -> workspace-bootstrap
```

Trusted deployment settings/profile sources and existing ownership/mode contracts apply.
No legacy settings, profile, credentials, token, key, session state, or opaque file is
copied. `HOME_READY` requires the formal provisioner to report equivalent/noop state and
read-only checks for expected directories, settings, profile, ownership, and modes.

## 6. Frozen curated workspace policy

This section is dormant until the whole workspace authority is validly superseded.
Blind copy is forbidden. The dry-run creates one canonical JSON manifest per Agent at a
trusted operator evidence path fixed by the future runbook. The manifest schema is:

```text
{
  version: 1,
  agent_id: string,
  source_identity: SAFE_OPAQUE_SOURCE_ID,
  entries: [{ opaque_entry_id, relative_path, byte_size, media_type, required }],
  excluded_counts_by_reason: object,
  policy_version: "AGENT_TRUSTED_FLEET_CUTOVER_V1_WORKSPACE_POLICY_1"
}
```

The reviewed plan digest covers canonical manifest metadata but never candidate bytes.
The operator may apply only the exact reviewed manifest digest.

Admissible roots are exactly root files `AGENTS.md`, `SOUL.md`, `IDENTITY.md`, `USER.md`,
`MEMORY.md`, plus regular files below `memory/`, `docs/`, `materials/`, and `files/`.
Admissible extensions are `.md`, `.txt`, `.csv`, `.json`, `.yaml`, `.yml`, `.pdf`,
`.png`, `.jpg`, `.jpeg`, and `.webp`. `AGENTS.md` is required; all other entries are
optional. A file is inadmissible if it is executable, over 32 MiB, makes total admitted
bytes exceed 1 GiB per Agent, has a denied path component, has an unknown type, or fails
content safety scanning.

Denied path components are case-insensitive matches for `.env*`, `credential*`,
`secret*`, `token*`, `cookie*`, `auth*`, `session*`, `private*key*`, runtime control
metadata, VCS metadata, caches, logs, sockets, devices, FIFOs, symlinks, and hard links
(`st_nlink != 1`). Missing or duplicate workspace mappings are respectively
`WORKSPACE_MAPPING_MISSING` and `WORKSPACE_MAPPING_DUPLICATE`.

Source traversal and reads MUST be fd-relative and non-following. The operator performs
`lstat`/open-with-no-follow/`fstat` identity checks, rejects identity changes, reads only
bounded regular-file bytes, and scans in trusted-process memory without subprocesses.
Known denied paths are rejected by metadata and NEVER opened. Content scanning may only
classify an otherwise admissible candidate as rejected; bytes, excerpts, matches,
hashes, secret-bearing path components, and filenames MUST NOT enter temp files, argv,
env, stdout, stderr, logs, reports, or evidence.

A rejected entry is reported only by `opaque_entry_id` and reason code. Destination
creation uses a trusted-directory mode-0600 temporary file containing only content that
passed scanning, fsync, identity recheck, atomic no-clobber rename, and final formal
ownership/mode setting. Cleanup removes incomplete temp files by opaque run ID.

Equivalence is exact byte equality after both bounded files pass the same safety checks;
the report records only `EQUIVALENT`, never a content digest. Existing non-equivalent
destination content is `WORKSPACE_DESTINATION_CONFLICT` and is never overwritten or
merged.

Per Agent:

```text
WORKSPACE_IMPORT = PASS      # required entries safely imported; no conflict
WORKSPACE_IMPORT = SKIP      # all selected entries already equivalent
WORKSPACE_IMPORT = CONFLICT  # required item absent/unsafe, destination differs, or race/drift
```

## 7. Build in Public first and staged recovery

First acceptance object:

```text
agent_id = agt_build-in-public-agent
legacy_workspace = /Users/yanfenma/.openclaw/groups/workspace-oc_95bd40ab17712fe0f3a7cf7eb6f4e24a
```

Execution stages, after all authority blockers are cleared:

1. `PLAN`: read-only validation of all 86; any fleet conflict aborts with zero mutation.
2. `CANARY_PREPARE`: provision/import/readiness-check only Build in Public; checkpoint
   created artifacts using opaque IDs.
3. `CANARY_DEFINE`: atomic Definition write adding only Build in Public; reload and spawn
   preflight it. Failure preserves explicit partial state and permits deterministic
   forward recovery; it never rolls back by deleting pre-existing trusted state.
4. `FLEET_PREPARE`: provision/import the remaining 85; Definitions unchanged.
5. `FLEET_DEFINE`: atomic complete-document write from the canary state to all 91 rows.
6. `RELOAD_VERIFY`: formal `agentDefinitionAccess` reload, or controlled restart only on
   structured `RELOAD_UNSUPPORTED`; verify all targets read-only.

Every stage revalidates plan digest and source identities. Checkpoints contain no
candidate content or secrets. A pre-Definition failure removes only incomplete artifacts
created by that run. A post-Definition failure is forward-recovery-only: keep the exact
known Definition state, leave bindings absent, report `PARTIAL_MUTATION`, and resume from
the last validated checkpoint. Unknown state aborts `RECOVERY_STATE_UNKNOWN` without
further mutation.

Canary must reach all four before `FLEET_PREPARE`:

```text
BUILD_IN_PUBLIC_DEFINITION_READY = YES
BUILD_IN_PUBLIC_HOME_READY = YES
BUILD_IN_PUBLIC_WORKSPACE_READY = YES
BUILD_IN_PUBLIC_SPAWN_PREFLIGHT = YES
```

## 8. Credential/readiness classification

For each Agent, exact dependency evidence is limited to formal deployed profile/tool
configuration and accepted service capability declarations pinned by the future runbook.
No inference from legacy credential presence is allowed.

Output:

```text
principal_required = YES | NO | UNKNOWN
identity_readiness = READY | NOT_REQUIRED | EXTERNAL_PREREQUISITE_MISSING_<A|C|D> | UNKNOWN
trusted_credential_required = YES | NO | UNKNOWN
trusted_credential_readiness = READY | NOT_REQUIRED | EXTERNAL_PREREQUISITE_MISSING_<B|C|D> | UNKNOWN
workflow_grant_required = YES | NO | UNKNOWN
workflow_grant_readiness = READY | NOT_REQUIRED | EXTERNAL_PREREQUISITE_MISSING_A | UNKNOWN
forum_grant_required = YES | NO | UNKNOWN
forum_grant_readiness = READY | NOT_REQUIRED | EXTERNAL_PREREQUISITE_MISSING_A | UNKNOWN
```

`UNKNOWN` blocks that Agent. This operator performs no Auth/grant mutation until exact
external accepted authority is pinned. It never grants Workflow/Forum fleet-wide.
`CREDENTIALS_COPIED_FROM_LEGACY` is always `0`.

## 9. Runtime and verification

After all required state is ready:

```text
ACTIVE_PRODUCTION_RUNTIME_COUNT = 1
ACTIVE_RUNTIME_USER = authsvc
OLD_RUNTIME_RUNNING = NO
```

Any other pre-apply runtime state is `RUNTIME_INVARIANT_FAILED` and blocks mutation. The
operator never starts the old runtime or permits dual writers.

Read-only verification per target:

```text
DEFINITION_PRESENT
AGENT_ID_PRESERVED
HOME_READY
WORKSPACE_READY
PROFILE_READY
SPAWN_PREFLIGHT
CREDENTIAL_READINESS  # only when dependency evidence says required
```

Only all-required-pass yields `RESTORABLE_FOR_BINDING=YES`. No binding is restored.
`feishu:oc_92332...` and `feishu:oc_9dd74...` remain frozen conflicts for `绑定 执行`.

## 10. Fixed report contract

The report is canonical JSON plus the requested text summary. It contains:

```text
result = SUCCESS | ABORTED_NO_MUTATION | PARTIAL_MUTATION | NOOP
failed_stage = NONE | PLAN | CANARY_PREPARE | CANARY_DEFINE | FLEET_PREPARE | FLEET_DEFINE | RELOAD_VERIFY
plan_digest = sha256 of redacted canonical plan
safe_input_identities = definition digests + opaque workspace identities
per_agent_report_ref = trusted redacted evidence coordinate
reason_counts = map<reason_code, nonnegative integer>
workspace_counts = {pass, skip, conflict}
unchanged_proofs = {matching_2, trusted_only_3, default_agent_id, unrelated_top_level}
definition_conflicts = nonnegative integer
credential_readiness_counts = typed counts from §8
runtime = {active_count, active_user, old_runtime_running}
reload_outcome = NOT_RUN | RELOADED | CONTROLLED_RESTART | FAILED
rerun_outcome = NOT_RUN | NOOP | DRIFT_BLOCKED
production_change_id = NONE | opaque approved run ID
secret_disclosure_found = NO | SUSPECTED
```

`secret_disclosure_found=SUSPECTED` records only an opaque incident ID and stops all
further output/mutation; it never records content or secret-bearing paths.

Requested summary fields are emitted with integer/YES/NO/enum types:

```text
TASK_NAME = 注册 执行
AUTHORITY_SUFFICIENT = YES | NO
OLD_ONLY_AGENT_COUNT = integer
TARGET_RESTORE_COUNT = integer
DEFINITIONS_ADDED = integer
AGENT_IDS_PRESERVED = YES | NO | NOT_RUN
HOMES_REGENERATED = integer
WORKSPACES_IMPORTED = integer
WORKSPACE_CONFLICTS = integer
CREDENTIALS_COPIED_FROM_LEGACY = 0
CREDENTIALS_RECONCILED_TRUSTED = integer
BUILD_IN_PUBLIC_DEFINITION_READY = YES | NO | NOT_RUN
BUILD_IN_PUBLIC_HOME_READY = YES | NO | NOT_RUN
BUILD_IN_PUBLIC_WORKSPACE_READY = YES | NO | NOT_RUN
BUILD_IN_PUBLIC_SPAWN_PREFLIGHT = YES | NO | NOT_RUN
RESTORABLE_FOR_BINDING_COUNT = integer
ACTIVE_PRODUCTION_RUNTIME_COUNT = integer | UNKNOWN
OLD_RUNTIME_RUNNING = YES | NO | UNKNOWN
SECRET_DISCLOSURE_FOUND = NO | SUSPECTED
PRODUCTION_CHANGE = YES | NO | PARTIAL
```

Success requires `86/86`, preserved IDs, zero workspace conflicts, Build in Public all
YES, `RESTORABLE_FOR_BINDING_COUNT=86`, exactly one `authsvc` runtime, old runtime NO,
secret disclosure NO, and a second dry-run reporting NOOP. Aborted-before-mutation uses
zero mutation counters, `NOT_RUN`, and `PRODUCTION_CHANGE=NO`. Partial state uses actual
completed counters, `PARTIAL_MUTATION`, and `PRODUCTION_CHANGE=PARTIAL`.

## 11. Stop condition

This Spec remains `proposed`, `review_status=FIX_REQUIRED`, and blocked. Required next
authority work is outside this task: valid whole-authority workspace supersession and
accepted/pinned external Auth mutation authority. Until both exist, `注册 执行` stops at
this Draft PR with `AUTHORITY_SUFFICIENT=NO` and `PRODUCTION_CHANGE=NO`.
