---
spec_id: AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1
status: proposed
date: 2026-08-31
type: implementation-spec (complete standalone whole-authority successor; docs only this round)
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
replaces_on_acceptance:
  - AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2
  - AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2
  - AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2
supersedes: []
superseded_by: null
governed_by:
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2
  - SCHEDULER_TIMEOUT_OUTCOME_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities:
  - repository: Yan-Zero/dsh-codex
    authority_id: DSH_CODEX_RELEASE_V1
    revision: c35d7a41d16cdf6d202cdb1db4108b32cbafaa0e
    relation: interoperates_with
scope:
  - fleet-wide canonical OpenAI Codex OAuth credential topology for every Luna-enabled production Agent
  - dsh-codex 0.2.3-line explicit credentialFile and durable refresh-intent contracts
  - Agent Core Luna route/profile wiring and shared-store fail-loud admission
  - Permission Model A for the canonical credential domain
  - unchanged ordered-route safety policy carried forward from the V2 authority set
owners:
  - repository-maintainers
---

# AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1

> `TASK_NAME = 共享 执行` · `ROUND = SPEC_AMENDMENT` · **docs only**。
> 本轮不修改产品代码、production 配置、OAuth、credential、模型路由或进程。
>
> 这不是对 accepted stable ID 的原地 amendment。共享 writable OAuth、允许 refresh、
> Permission Model A 与 fleet scope 会反转现行 V2 authority 的 per-home/no-refresh/
> CTO-only/0755 语义，因此按 `SPEC_GOVERNANCE_V0` §9.2 使用新的 complete standalone
> whole-authority successor。proposal 阶段不修改旧 Spec lifecycle；只有独立 Review PASS
> 后，由 Owner 在一个 docs-only acceptance transaction 中原子写入全部前后向 backlink，
> 并 merge 到 `main` 后才生效。

## 1. Goal

91 个 production Agent 位于同一生产信任域，并共用一个 ChatGPT Codex subscription。
只要一个进程成功刷新 rotating refresh token，其他 per-Agent writable 副本立即成为旧副本；
后续 refresh 会得到 `refresh_token_reused`。目标是把所有启用 Luna 的 Agent 收敛到一个
canonical writable credential domain，使一个 credential generation 最多发生一次 remote
refresh，并对不可判定的 refresh 结果 fail closed。

```text
FLEET_SHARED_CODEX_AUTH = YES
CANONICAL_CREDENTIAL_PATH =
  /Users/authsvc/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json
PROVIDER = openai-codex
LUNA_MODEL = gpt-5.6-luna
DSH_CODEX_COMPATIBILITY_LINE = 0.2.3
PER_AGENT_RUNTIME_OAUTH_STORE = FORBIDDEN
REMOTE_REFRESH_CALL_MAX_PER_GENERATION = 1
PRODUCTION_APPLY_AUTHORITY = NONE
```

成功结果不是“复制得更快”，而是所有 Luna process 对同一个 filename、同一个 filesystem
writer lock、同一个 atomic replacement 和同一个 refresh-intent 状态机进行读写。

## 2. Scope and non-goals

### 2.1 In scope

- `dsh-codex` 0.2.3 compatibility line 增加 optional `credentialFile` configuration；
- 复用 `OpenAICodexCredentialStore(explicitFilename)` 与现有 pi-ai refresh callback；
- 在 existing refresh callback 外围增加 durable, non-secret refresh-intent protocol；
- Agent Core 从唯一 Luna route catalog entry 把 canonical `credentialFile` 传到每个
  Luna-enabled Agent 的 copied production profile；
- production shared mode 下 effective credential filename 不等于 canonical path 时 startup /
  admission fail-loud；
- Permission Model A、normal concurrency、stale reader、crash/outcome-unknown、single Owner
  reauth、migration/rollback 与 redaction contracts；
- 完整 carry forward ordered route 的配置所有权、hop/STOP、ONE_LOGICAL_TURN、deadline、
  journal、Scheduler 与 providerEnv 安全语义；共享 credential 迁移不得改变 route membership
  或顺序。

### 2.2 Out of scope

- 本轮 production write、restart、OAuth login/refresh、credential copy 或 Luna model call；
- 启用或移除任一 Agent 的 Luna route；
- 改变 GLM route、route order、fallback eligibility、classifier 或 current production stage；
- ARM64、HR、Workflow、OpenCode balance、真实额度耗尽测试；
- dsh-codex protocol replacement、第二套 token format、credential service、account pool；
- symlink、hardlink、rsync、refresh 后广播或 per-Agent writable OAuth fallback；
- 将 raw token 写入 config、env、argv、prompt、Feishu、日志、PR 或 evidence。

## 3. Authority and dependencies

```text
SPEC_GOVERNANCE_MODE = AUTHOR
CHANGE_CLASS = NON_MECHANICAL
PREFLIGHT_MODE = SUPERSEDE
PRIMARY_CURRENT_POLICY = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2
CURRENT_IMPLEMENTATION_AUTHORITY = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2
CURRENT_ACTIVATION_AUTHORITY = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2
REPLACEMENT_FORM = COMPLETE_STANDALONE_WHOLE_AUTHORITY
PARTIAL_SUPERSESSION = NONE
```

现行三份 V2 分别拥有 Luna credential policy、implementation scope 和 production
activation。它们冻结了 target-home OAuth 原位读取、禁止 refresh、Home 0755/uid502、
非 target fleet 零变化；这些含义不能与本 Spec 并行 accepted。

proposal 阶段：

```text
NEW.status = proposed
NEW.supersedes = []
OLD_V2.status = accepted
OLD_V2.superseded_by = null
IMPLEMENTATION_ALLOWED_FROM_THIS_PROPOSAL = NO
```

future acceptance transaction 必须原子完成：

```text
NEW.status = accepted
NEW.supersedes = [PARENT_V2, IMPL_V2, ACTIVATION_V2]
PARENT_V2.status = superseded
PARENT_V2.superseded_by = AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1
IMPL_V2.status = superseded
IMPL_V2.superseded_by = AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1
ACTIVATION_V2.status = superseded
ACTIVATION_V2.superseded_by = AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1
docs/specs/README.md = lifecycle mirrors updated
```

任何缺 edge、mixed authority、未绑定 reviewed commit/final head/acceptance actor/time 的事务
全部 abort。`dsh-codex` 是外部 repository；本 Spec 冻结 Agent Core 的 interoperability
requirement，但其代码变更必须在该 repository 获得独立 accepted authority 与 exact commit。

## 4. Current State

### STATE-SCA-001 — Production Luna processes use per-home writable stores

- Subject: production Agent Luna credential topology
- As of artifact: Owner incident report, 2026-08-31
- Environment: `/Users/authsvc/.agent-core/homes/<AGENT_ID>`
- Projection: each enabled process resolves `$DSH_HOME/.openai-codex-auth.json`; HR rotated the
  shared subscription token while CEO retained an old writable copy and failed with
  `refresh_token_reused`.
- Basis: `OBS-SCA-001`, `CLM-SCA-001`, `EVD-SCA-001`

### STATE-SCA-002 — The low-level store is shareable but service/config wiring is absent

- Subject: production exact `dsh-codex@0.2.3`
- As of source: `Yan-Zero/dsh-codex@c35d7a41d16cdf6d202cdb1db4108b32cbafaa0e`
- Environment: installed production package under the lobster Agent profile
- Projection: store constructor and lock semantics support one explicit filename; service and plugin
  Config still instantiate the default per-home filename.
- Basis: `OBS-SCA-002` through `OBS-SCA-005`, `CLM-SCA-002`, `EVD-SCA-002`

### STATE-SCA-003 — Normal bursts serialize, crash outcome requires a durable intent

- Subject: isolated synthetic OAuth refresh experiment
- As of code: production exact 0.2.3 store bytes
- Environment: macOS, independent Node processes, fake local refresh endpoint, no real credential
- Projection: 10/20/50 bursts each issue one refresh and all callers succeed; a process exit after
  remote rotation but before local write leaves old credential plus orphan lock.
- Basis: `OBS-SCA-006`, `OBS-SCA-007`, `CLM-SCA-003`, `EVD-SCA-003`

### STATE-SCA-004 — Canonical production domain is not provisioned

- Subject: canonical credential directory and file
- As of observation: 2026-08-31T06:57:00+08:00
- Environment: production filesystem, metadata-only check
- Projection: `/Users/authsvc/.agent-core/shared-credentials` and descendants are absent.
- Basis: `OBS-SCA-008`, `EVD-SCA-004`

## 5. Observations

### OBS-SCA-001 — Rotating token reuse failure occurred across Agent copies

- Subject: `agt_ceo-agent` after `agt_hr-agent` refresh
- Repository/source: Owner production incident report persisted in this authoring request
- Environment: production fleet, same ChatGPT subscription identity
- Observed at: 2026-08-31
- Method: delivery failure inspection
- Result: CEO post-admission refresh returned HTTP 401 `refresh_token_reused` after HR obtained a
  newer refresh token; CEO retained the older per-home copy.
- Provenance: `TASK_NAME = 共享 执行`, incident statement supplied by Owner

### OBS-SCA-002 — Store constructor accepts an explicit filename

- Subject: `OpenAICodexCredentialStore`
- Repository/source: `Yan-Zero/dsh-codex`
- Commit/artifact: tag `v0.2.3`, commit `c35d7a41d16cdf6d202cdb1db4108b32cbafaa0e`,
  `src/store.ts`
- Environment: source audit; production installed `src/store.ts` SHA-256 matched tag bytes
- Observed at: 2026-08-31
- Method: source inspection plus SHA-256 byte comparison
- Result: constructor resolves its explicit `filename`, defaulting only when the argument is absent.
- Provenance: `OpenAICodexCredentialStore.constructor`

### OBS-SCA-003 — Refresh callback and atomic replacement share one writer lock

- Subject: `OpenAICodexCredentialStore.modify`
- Commit/artifact: same as `OBS-SCA-002`
- Environment: source audit
- Observed at: 2026-08-31
- Method: trace `modify -> withFileLock(filename) -> readCurrent -> fn(current) -> writeFileAtomic`
- Result: lock key is the resolved filename; current state is reread under lock; callback and atomic
  replacement both execute before unlock.
- Provenance: `src/store.ts`; production `@deepseek-ai/dsh-atomic-write/src/index.ts`

### OBS-SCA-004 — pi-ai double-checks expiry inside store.modify

- Subject: production resolved `@earendil-works/pi-ai`
- Commit/artifact: installed dependency used by dsh-codex 0.2.3
- Environment: source audit
- Observed at: 2026-08-31
- Method: trace `Models.resolveRefreshCredential` and `resolveStoredOAuth`
- Result: expired optimistic read enters `credentials.modify`; callback rereads current credential,
  returns without refresh when another process already wrote a non-expired generation, otherwise calls
  provider OAuth refresh inside the callback.
- Provenance: installed `dist/models.js` and `dist/auth/resolve.js`

### OBS-SCA-005 — Service and Config do not expose the explicit filename

- Subject: `OpenAICodexService` and plugin `Config`
- Commit/artifact: same as `OBS-SCA-002`
- Environment: source audit; production files byte-match v0.2.3 tag
- Observed at: 2026-08-31
- Method: inspect `src/service.ts` and `src/index.ts`
- Result: service uses `new OpenAICodexCredentialStore()` with no option; Config contains no
  `credentialFile`.
- Provenance: `src/service.ts`, `src/index.ts`

### OBS-SCA-006 — 10/20/50 process normal bursts refresh once

- Subject: production exact store code with synthetic OAuth documents
- Commit/artifact: production installed dsh-codex 0.2.3 bytes
- Environment: isolated temporary directory and local fake HTTP provider; no production token
- Observed at: 2026-08-31
- Method: launch 10, 20, then 50 independent Node processes sharing one filename, all initially expired
- Result: each burst had `REFRESH_HTTP_CALL_COUNT=1`, `REFRESH_TOKEN_REUSED=0`,
  `PROCESS_FAILURES=0`, `ALL_VALID=YES`, final mode `0600`.
- Provenance: authoring-round isolated execution transcript

### OBS-SCA-007 — Crash before local write leaves outcome unknown and an orphan lock

- Subject: same isolated store and fake endpoint
- Commit/artifact: same as `OBS-SCA-006`
- Environment: isolated temporary directory
- Observed at: 2026-08-31
- Method: exit process after fake remote rotation response and before callback returns candidate
- Result: remote calls `1`; canonical store remained expired; `<credential>.lock` remained; next writer
  timed out after two seconds. Crash after canonical write left a valid store, no lock, and next writer
  succeeded.
- Provenance: authoring-round isolated execution transcript

### OBS-SCA-008 — Canonical path is absent before this Spec

- Subject: `/Users/authsvc/.agent-core/shared-credentials/openai-codex`
- Commit/artifact: production filesystem metadata
- Environment: production host
- Observed at: 2026-08-31T06:57:00+08:00
- Method: metadata-only existence check; credential contents not read
- Result: canonical directory and canonical OAuth file do not exist.
- Provenance: authoring-round read-only preflight

### OBS-SCA-009 — Current Agent Core hardcodes per-home credential semantics

- Subject: `dsh-agent-core@9386ac4e4515ea628e2a450f402b540f165c13c3`
- Environment: `origin/main`
- Observed at: 2026-08-31
- Method: source trace through `model-overrides.js`, `compose.js`, and agent provisioning
- Result: subscription descriptor stores basename `.openai-codex-auth.json`; route schema rejects
  `credentialFile`; provisioning joins the basename to Agent Home and requires Home-owned boundary.
- Provenance: `packages/production-runtime/src/model-overrides.js`,
  `packages/production-runtime/src/compose.js`, `packages/agent-provisioning/src/index.js`

## 6. Claims and assumptions

### CLM-SCA-001 — Independent writable copies are causally unsafe for rotating tokens

- Support state: SUPPORTED
- Supported by evidence: `EVD-SCA-001`
- Contradicted by evidence: none known
- Uncertainty: none for one subscription identity with rotating refresh tokens

### CLM-SCA-002 — One explicit filename can serialize normal concurrent refreshes

- Support state: SUPPORTED
- Supported by evidence: `EVD-SCA-002`, `EVD-SCA-003`
- Contradicted by evidence: none known for normal process completion
- Uncertainty: process/power crash requires the separate intent protocol; the existing lock alone is
  not crash recovery.

### CLM-SCA-003 — Remote-success/local-write-unknown cannot be repaired by retrying the old token

- Support state: SUPPORTED
- Supported by evidence: `EVD-SCA-003`
- Contradicted by evidence: none known
- Uncertainty: the provider exposes no transaction status lookup bound to this refresh attempt.

### CLM-SCA-004 — Shared credential wiring can remain independent of route selection

- Support state: SUPPORTED
- Supported by evidence: `EVD-SCA-005`
- Contradicted by evidence: none known
- Uncertainty: future providers may require separate credential policies; this Spec governs only
  `openai-codex`.

## 7. Evidence relations

### EVD-SCA-001 — Incident supports the unsafe-copy claim

- Source observations: `OBS-SCA-001`
- Target: `CLM-SCA-001`, `STATE-SCA-001`
- Relation: SUPPORTS
- Bound coordinates: production fleet, 2026-08-31, CEO/HR same subscription identity
- Strength/sufficiency: direct failure with exact provider error and ordering
- Limitations: does not count every historical stale copy
- Provenance: Owner incident statement

### EVD-SCA-002 — Exact source trace supports the shared-lock claim

- Source observations: `OBS-SCA-002`, `OBS-SCA-003`, `OBS-SCA-004`, `OBS-SCA-005`
- Target: `CLM-SCA-002`, `STATE-SCA-002`
- Relation: SUPPORTS
- Bound coordinates: dsh-codex commit `c35d7a41d16cdf6d202cdb1db4108b32cbafaa0e`
- Strength/sufficiency: direct source and production-byte match
- Limitations: source inspection alone is not concurrency execution evidence
- Provenance: exact files named by the source Observations

### EVD-SCA-003 — Executed bursts and crash injection bound the lock guarantee

- Source observations: `OBS-SCA-006`, `OBS-SCA-007`
- Target: `CLM-SCA-002`, `CLM-SCA-003`, `STATE-SCA-003`
- Relation: SUPPORTS
- Bound coordinates: production exact store bytes, isolated fake provider, 2026-08-31
- Strength/sufficiency: executed cross-process positive and crash-negative evidence
- Limitations: synthetic provider; no real token was intentionally rotated
- Provenance: authoring-round execution transcript

### EVD-SCA-004 — Metadata check supports canonical-path pre-state

- Source observations: `OBS-SCA-008`
- Target: `STATE-SCA-004`
- Relation: SUPPORTS
- Bound coordinates: production host, exact canonical path, 2026-08-31T06:57:00+08:00
- Strength/sufficiency: direct metadata observation
- Limitations: time-indexed; future deployment may create the path
- Provenance: authoring-round read-only preflight

### EVD-SCA-005 — Agent Core source supports route-independent wiring

- Source observations: `OBS-SCA-009`, `OBS-SCA-002`, `OBS-SCA-005`
- Target: `CLM-SCA-004`
- Relation: SUPPORTS
- Bound coordinates: dsh-agent-core `9386ac4e4515ea628e2a450f402b540f165c13c3`,
  dsh-codex `c35d7a41d16cdf6d202cdb1db4108b32cbafaa0e`
- Strength/sufficiency: exact missing seam and existing carrier identified
- Limitations: implementation conformance remains future work
- Provenance: files named by source Observations

## 8. Decisions

### DEC-SCA-001 — One canonical writable store for every Luna-enabled Agent

- Decision owner: repository Owner `mayf3`
- Decision: all production `openai-codex` routes use the exact canonical filename; per-Agent runtime
  stores and every copy/link/sync/broadcast topology are forbidden.
- Rejected alternatives: `ALT-SCA-001`, `ALT-SCA-002`
- Reason: rotating token validity is a property of one mutable generation, not copyable static state.
- Owner decision remaining: NONE

### DEC-SCA-002 — Reuse the 0.2.3 store and refresh implementation

- Decision owner: repository Owner `mayf3`
- Decision: add only explicit configuration and durable intent/recovery around the existing
  `OpenAICodexCredentialStore`/pi-ai refresh path; do not implement another OAuth refresh client.
- Rejected alternatives: `ALT-SCA-003`
- Reason: existing lock, lock-internal reread, provider callback, format validation and atomic replace
  already satisfy the normal concurrency invariant.
- Owner decision remaining: NONE

### DEC-SCA-003 — Permission Model A remains the only permission model

- Decision owner: repository Owner `mayf3`
- Decision: preserve authsvc-owned roots/Homes with inherited exact ACL and private POSIX modes;
  canonical refresh access is granted to uid502 only through exact ACL capabilities.
- Rejected alternatives: `ALT-SCA-004`
- Reason: no group/world widening and no shared-group redesign are needed.
- Owner decision remaining: NONE

### DEC-SCA-004 — Unknown refresh outcome requires one canonical reauth

- Decision owner: repository Owner `mayf3`
- Decision: persist a non-secret intent before remote dispatch; any unresolved pending generation
  forbids retry and fails closed with `OPENAI_CODEX_REAUTH_REQUIRED`. Owner reauth updates only the
  canonical store once.
- Rejected alternatives: `ALT-SCA-005`
- Reason: after remote rotation but before local commit, retrying the old token can only repeat an
  unsafe operation whose outcome is unknown.
- Owner decision remaining: NONE

### DEC-SCA-005 — Shared auth does not select or reorder models

- Decision owner: repository Owner `mayf3`
- Decision: route configuration remains deployment-owned and ordered; this migration changes only
  the credential carrier for routes already authorized to use `openai-codex`.
- Rejected alternatives: `ALT-SCA-006`
- Reason: credential correctness and model selection are separate authorities.
- Owner decision remaining: NONE

## 9. Contracts

### CTR-SCA-001 — Canonical credential identity

Production shared mode MUST use exactly:

```text
/Users/authsvc/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json
```

Every Luna-enabled process MUST resolve `OpenAICodexCredentialStore.filename` to those exact bytes
after absolute-path normalization. The path and every component MUST be non-symlink; the OAuth object
MUST be a regular file with link count `1`. A different, missing, relative, symlinked or hardlinked
effective filename MUST fail before model admission. No fallback filename is allowed.

### CTR-SCA-002 — dsh-codex explicit configuration and compatibility

The dsh-codex 0.2.3 compatibility line MUST add:

```ts
interface OpenAICodexServiceOptions {
  credentialFile?: string
}

new OpenAICodexCredentialStore(options.credentialFile)
```

Plugin `Config` MUST expose the same optional string and `apply()` MUST pass it to the service.
When absent outside production shared mode, behavior MUST remain the existing
`$DSH_HOME/.openai-codex-auth.json`. This default compatibility MUST NOT weaken `CTR-SCA-001`:
production shared mode requires the explicit canonical value. OAuth protocol, provider callback and
credential payload fields MUST remain the upstream implementation; no second refresh client or token
format is authorized.

### CTR-SCA-003 — Agent Core route/profile wiring

The deployment-owned route catalog MUST contain one canonical Luna descriptor, not 91 credential
definitions. Its subscription entry MUST carry `credentialFile` with the exact canonical path.
The successor config schema MUST reject duplicate/unknown keys and MUST preserve route order semantics;
version `3` is required so an old loader fails loud rather than accepting changed meaning.

For every resolved `provider=openai-codex` route, production composition MUST carry the immutable
credential filename through provisioning into the `llm-openai-codex` plugin config in that Agent's
copied profile. Agent provisioning MUST NOT copy, move, link, create or refresh a per-home OAuth file.
Profile configuration may be per-home; credential bytes may not.

### CTR-SCA-004 — Shared-mode fail-loud invariant

At startup and before each new Luna child generation, Agent Core MUST prove:

```text
configured credentialFile = canonical path
effective store.filename = canonical path
plugin = dsh-codex
plugin compatibility line = 0.2.3
provider = openai-codex
```

Any mismatch MUST prevent that child from starting or admitting a Luna request. It MUST NOT silently
use `$DSH_HOME`, oc-go, GLM or another credential source. Running-child reuse MUST include credential
path identity; a generation created with a different path MUST NOT be reused.

### CTR-SCA-005 — Per-Agent runtime OAuth use is forbidden

Once shared mode is activated, `<AGENT_HOME>/.openai-codex-auth.json` MAY remain only as read-only
rollback evidence. Runtime code, login/status/usage/search/image/model paths and recovery tooling MUST
NOT read or write it. Symlink, hardlink, rsync, periodic synchronization, refresh broadcast and
post-refresh fan-out are forbidden. A migration verifier MUST prove zero opens of per-home OAuth paths.

### CTR-SCA-006 — One refresh under one filename lock

All refresh-capable callers MUST use the same filesystem writer lock derived from the canonical
filename. The exact normal sequence is:

```text
acquire canonical filename lock
-> reread canonical credential
-> reject/resolve pending refresh intent
-> determine refresh still required
-> durably persist pending intent
-> remote refresh callback
-> atomic canonical credential replacement and file/parent-directory durability barrier
-> durably remove intent and sync the parent directory
-> release lock
```

No cached refresh token obtained before lock acquisition may be used for remote refresh. If the
lock-internal reread is already valid, callback count is zero. For one canonical generation,
`REMOTE_REFRESH_CALL_MAX=1`.

The existing two-second low-level lock timeout MUST NOT cause another remote refresh. A waiter that
times out while the lock owner is still completing a refresh MUST observe the pending intent and wait,
without a provider call, within the one logical-turn deadline for either a valid new inode or a
fail-closed terminal state. If that bounded wait expires, the caller fails loud as
`OPENAI_CODEX_REFRESH_IN_PROGRESS`; it does not reuse the old token and does not independently refresh.

### CTR-SCA-007 — Durable refresh-intent domain

The intent path is fixed:

```text
REFRESH_INTENT_PATH =
  /Users/authsvc/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json.refresh-intent.json
```

Before remote dispatch and while holding the canonical lock, the process MUST durably create one exact
document:

```json
{
  "version": 1,
  "generationId": "fs:<device>:<inode>",
  "state": "pending",
  "startedAt": "RFC3339 timestamp"
}
```

`generationId` is the non-secret `lstat` device/inode identity of the current canonical credential
before creating the replacement inode. It MUST NOT contain or derive from an access token, refresh
token, token hash or credential digest. The intent MUST be mode `0600`, inherit the same exact ACL
domain, be written with no partial-reader window, and be fsynced together with the parent directory
before network dispatch. An existing intent MUST never be overwritten by an automatic refresh.

### CTR-SCA-008 — Crash and outcome-unknown recovery

Recovery MUST inspect intent before any automatic refresh:

| Condition | Required result |
|---|---|
| pending intent; canonical `device:inode` equals `generationId` | `REFRESH_OUTCOME=UNKNOWN`; no remote call; no old-token reuse; fail closed; reauth required |
| pending intent; canonical inode differs; canonical document parses, is 0600 and otherwise valid | treat atomic credential commit as complete; clear intent under controlled recovery; no remote call |
| pending intent; canonical inode differs but document/permission validation fails | fail closed; reauth required; do not clear evidence |
| no intent; canonical credential valid | normal read/use |
| no intent; canonical credential expired | `CTR-SCA-006` refresh protocol |

Crash before remote dispatch intentionally enters the first conservative state; the system MUST NOT
guess that no request occurred. Crash after remote rotation but before local write enters the same
state and is an expected safe terminal result, not an acceptance failure. Crash after atomic write is
recoverable from the new inode and MUST NOT refresh again.

An orphan `<credential>.lock` MUST NOT be removed merely because it is old. Recovery may remove it only
after fleet quiescence and positive proof that its owner process no longer exists; intent inspection and
Owner notification remain available without acquiring that writer lock.

### CTR-SCA-009 — Fail-closed Owner reauth contract

Unknown outcome MUST surface the stable redacted error:

```text
OPENAI_CODEX_REAUTH_REQUIRED
REFRESH_OUTCOME = UNKNOWN
AUTO_REFRESH_RETRY = FORBIDDEN
OLD_REFRESH_TOKEN_REUSE = FORBIDDEN
```

Control-plane incident deduplication MUST produce at most one Owner-facing reauth request per
`generationId`; it MUST NOT open 91 OAuth flows or instruct individual Agents to log in. Recovery is:
quiesce all Luna refresh-capable children, prove/remove orphan lock if present, perform one interactive
login directly into the canonical store, validate metadata without printing credential content, clear
the matching intent/incident marker, then restart through the separately authorized activation plan.

### CTR-SCA-010 — Permission Model A

The following existing model remains normative:

```text
homes root       = authsvc:authsvc 0755 + frozen inheritable ACL
workspaces root  = authsvc:authsvc 0755 + frozen inheritable ACL
Agent Home       = authsvc:authsvc 0700 + inherited ACL
sensitive files  = POSIX 0600; group/world bits 0
Harness child    = uid502
Control plane    = authsvc uid505
```

The canonical `openai-codex` directory MUST be authsvc-owned, mode `0700`, with exact inheritable ACLs.
uid502 MUST have directory search, read, write, add-file, rename and delete-child capabilities required
for lock creation and same-directory atomic replacement. authsvc's directory-owner rights are the
control-plane boundary; when a replacement inode is owned by uid502, authsvc access to that inode MUST
come only from the inherited exact control-plane read/list/search/recovery ACL, never group/world bits.
The canonical OAuth, lock, temp and intent files MUST be `0600` with group/world bits zero and inherited
exact ACLs. A third unrelated uid MUST be denied. No existing Agent Home mode/owner/ACL may change.

ACL conformance MUST cover fresh create, temp+rename, crash leftovers and replacement inode ownership;
checking only the preexisting canonical inode is insufficient.

### CTR-SCA-011 — Secret and observability boundary

No command, log, journal, error, test fixture output, PR text or evidence artifact may contain a real
access token, refresh token, OAuth object, credential hash/digest or raw provider body. Allowed fields
are provider, model, canonical path, file metadata, generationId, intent state, stable failure class,
refresh call count and redacted success/failure. Real credential contents MUST never be read for audit.

### CTR-SCA-012 — Ordered-route policy carried forward unchanged

This successor preserves these route contracts as complete current authority:

- deployment-owned ordered chain `[primary, ...fallbacks]`, maximum four routes; no order hardcoded in
  product code; strict route means `fallbacks=[]`;
- closed `builtin|subscription` route kinds, canonical route identity, duplicate/unknown/cycle rejection,
  immutable turn-start snapshot and each canonical route attempted at most once;
- hop only for the accepted closed proven-no-admission classes and exact terminal
  `provider_quota_rejected_before_generation` with zero output/tool/side effect; all ambiguity, timeout,
  partial output, tool start, external side effect and outcome-unknown states STOP_CHAIN;
- one logical turn, one end-to-end deadline, one terminal reply; no replay after output or side effects;
- onIngress, Delivery admission and Scheduler share one executor; Scheduler without explicit model
  inherits the Agent chain, while an explicit model is strict one-route execution;
- attempt journal is redacted and records immutable chain, per-attempt route/result and terminal outcome;
- providerEnv remains target-scoped, allowlisted and non-secret; no launchd-global proxy or arbitrary
  environment injection;
- clean pinned Harness/source identity and controlled fixture rules remain fail-loud gates.

Shared credential migration MUST NOT add/remove/reorder routes, change GLM behavior, change fallback
eligibility, replay a turn, or alter Definition/Binding/Feishu/Scheduler data. Existing CTO activation
state remains unchanged until a separately reviewed conformance and production-apply record authorizes
configuration and restart. Future Agent Luna enablement requires its own deployment authorization but,
once enabled, MUST use this canonical credential domain.

### CTR-SCA-013 — Exact implementation boundary and source identity

The future implementation may change only the smallest directly required surfaces:

```text
Yan-Zero/dsh-codex:
  src/store.ts
  src/service.ts
  src/index.ts
  direct tests for store/service/config/intent/recovery

mayf3/dsh-agent-core:
  packages/production-runtime/src/model-overrides.js
  packages/production-runtime/src/compose.js
  packages/agent-provisioning/src/index.js
  direct corresponding tests
  profile config helper only if required to persist llm-openai-codex.credentialFile
```

No Router routing algorithm, Kernel, Binding, Session, Feishu, Scheduler engine, ARM or unrelated
profile change is authorized. `dsh-codex` package compatibility version remains `0.2.3`; modified bytes
MUST have an honest exact source commit, artifact digest and source-stamp and MUST NOT masquerade as the
unmodified npm artifact. No later dsh-codex feature/version may enter incident recovery by implication.

### CTR-SCA-014 — Migration candidate, activation and rollback

Implementation completion does not grant production apply. A later controlled activation authority
MUST first establish and durably record both preconditions before inspecting any of the 91 legacy
stores:

```text
LUNA_DISPATCH_QUIESCED = YES
REFRESH_WRITERS_QUIESCED = YES
```

The migration MUST derive a `PROVEN_GENERATION_SET` only from trustworthy local successful credential
commit provenance. A proven generation record MUST mechanically bind one non-secret `generationId` to:

1. one successful login or refresh remote operation;
2. the corresponding new credential's completed atomic local commit;
3. a commit point before the quiesce fence; and
4. an ordered provenance history proving that no later successful refresh, later refresh
   `outcome_unknown`, pending refresh-intent or competing committed generation exists after that commit.

The provenance and every comparison MUST bind the candidate to the same configured expected account
identity. Account identity and `generationId` MUST be non-secret identifiers recorded independently of
credential bytes; neither may contain, derive from, compare, log or output an access token, refresh
token, token hash or credential digest.

Legacy credential reuse is permitted only when every candidate can be bound to the same expected
account identity, `PROVEN_GENERATION_SET` contains exactly one generation, and the complete ordered
provenance above has no conflict, tie, gap, pending intent or unknown outcome:

```text
LEGACY_CREDENTIAL_REUSE_ALLOWED = YES
AUTHORITATIVE_STORE = <the sole proven generation's legacy store>
```

The following are forbidden selection evidence and MUST NOT rank, prefer or break a tie between
candidates: `mtime`, `ctime`, `expiresAt`, file size, recent Agent use, access-token callability or any
other manual inference. Migration MUST NOT probe-refresh, retry an old token or try the 91 refresh
tokens in sequence.

Zero proven generations, more than one different proven generation, conflicting provenance, a
generation tie, insufficient provenance, a newer `mtime` with older provenance, a usable access token
with unknown refresh generation, any pending/unknown refresh intent, or inability to prove that the
last remote rotation was atomically committed MUST fail closed:

```text
LEGACY_CREDENTIAL_REUSE_ALLOWED = NO
AUTHORITATIVE_STORE = NONE
CANONICAL_REAUTH_REQUIRED = YES
CANONICAL_REAUTH_COUNT_MAX = 1
```

The only allowed recovery from that state is one Owner OpenAI Codex login/reauth written directly to:

```text
/Users/authsvc/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json
```

It MUST NOT first write an Agent Home and copy from there. The controlled activation authority MUST
then execute, in order:

1. inventory and establish both quiesce preconditions and the durable fence;
2. inspect all legacy candidates using only the provenance rule above;
3. create/verify the canonical Model A directory and ACL domain;
4. either atomically write the sole proven legacy credential once to canonical storage without remote
   refresh, or perform exactly one direct canonical Owner reauth when reuse is not allowed;
5. configure the single Luna route descriptor with canonical `credentialFile`;
6. prove all per-home OAuth paths have zero runtime opens and zero refresh writers;
7. controlled restart under pinned clean Harness identity;
8. CEO canary, then HR, Podcast and Shopping canaries;
9. prove provider/model/path and zero oc-go/GLM use for Luna-only canaries as applicable;
10. retain the 91 old per-home files only as read-only forensic evidence, never as a runtime source,
    refresh source or rollback credential.

If shared mode fails before any remote refresh, rollback MAY restore the previous software/config only
after quiescence. It MUST disable Luna rather than resume independent writable OAuth copies. If a pending
intent exists, rollback MUST preserve it and follow `CTR-SCA-008/009`; it MUST NOT restore or retry an old
token. Rollback MUST NOT restore any legacy rotating refresh token. Production credential cleanup is a
later explicit decision.

### CTR-SCA-015 — Test and conformance isolation

Ordinary tests MUST use synthetic credentials and an isolated fake OAuth endpoint. They MUST NOT read,
refresh, corrupt or exhaust the production subscription. Process-burst tests MUST use independent OS
processes and the exact shared filename. Fault injection MUST cover the boundaries before remote
dispatch, after remote success/before local write, and after atomic canonical write/before intent clear.

### CTR-SCA-016 — No production mutation from this authoring round

This proposed Spec and its PR MUST contain docs only. It MUST NOT modify production, OAuth, credential,
route configuration, package installation, process state or source code. Acceptance of this Spec may
authorize future bounded implementation under `CTR-SCA-*`; production apply remains separately gated.

## 10. Acceptance

### ACC-SCA-001 — Explicit path and default compatibility

- Contracts: `CTR-SCA-001`, `CTR-SCA-002`
- Method: unit/integration tests instantiate service and full plugin Config with absent, canonical,
  relative, different, symlink and hardlink paths
- Environment: clean dsh-codex implementation checkout
- Required evidence: exact implementation commit, executed test log, resolved filename values with no
  credential content
- Expected result: absent config retains per-home default outside shared mode; shared mode accepts only
  canonical regular single-link path
- Failure condition: any shared-mode noncanonical path starts or any default compatibility regression

### ACC-SCA-002 — Agent Core carrier and fail-loud path identity

- Contracts: `CTR-SCA-003`, `CTR-SCA-004`, `CTR-SCA-005`
- Method: production-runtime fixture with multiple Agent definitions referencing one Luna route catalog
  entry; process/profile read-back and file-open audit
- Environment: isolated Agent Core runtime
- Required evidence: version-3 parser matrix, resolved plugin config for multiple Agents, negative child
  generation tests, zero per-home OAuth opens
- Expected result: every Luna process resolves the same canonical filename; mismatch prevents admission
- Failure condition: 91 hand-authored credential entries, per-home open, fallback path or stale child reuse

### ACC-SCA-003 — Fifty-process simultaneous expiry

- Contracts: `CTR-SCA-006`, `CTR-SCA-015`
- Method: 50 independent dsh/Harness processes, one synthetic expired canonical credential, one fake
  refresh endpoint
- Environment: isolated filesystem and network namespace
- Required evidence: process IDs, shared resolved filename, endpoint call counter, per-caller terminal result
- Expected result: `REFRESH_HTTP_CALL_COUNT=1`, `REFRESH_TOKEN_REUSED=0`,
  `ALL_CALLERS_SUCCESS=YES`, final store valid and `0600`; a separate fake response delayed beyond the
  low-level two-second lock timeout still produces no second provider call
- Failure condition: call count not one, any reused-token class, caller failure or invalid store

### ACC-SCA-004 — Stale reader and atomic readers

- Contracts: `CTR-SCA-006`, `CTR-SCA-007`
- Method: retain stale pre-lock snapshot while another process refreshes; continuously parse canonical
  file during replacement
- Environment: isolated fake provider
- Required evidence: refresh counter, parse counter, old/new generation observations
- Expected result: stale caller rereads under lock and performs no second refresh; readers observe only a
  complete old or complete new document
- Failure condition: second refresh or partial/invalid read

### ACC-SCA-005 — Crash before dispatch

- Contracts: `CTR-SCA-007`, `CTR-SCA-008`, `CTR-SCA-009`
- Method: terminate after durable intent commit and before fake endpoint dispatch
- Environment: isolated process crash fixture
- Required evidence: intent metadata, endpoint count, restart result and stable redacted error
- Expected result: endpoint count zero; restart still treats pending outcome as unknown, performs no
  refresh and emits one logical `OPENAI_CODEX_REAUTH_REQUIRED`
- Failure condition: intent absent, auto retry, token reuse or silent continuation

### ACC-SCA-006 — Crash after remote rotation before local write

- Contracts: `CTR-SCA-007`, `CTR-SCA-008`, `CTR-SCA-009`
- Method: fake endpoint rotates once, then terminate before candidate credential atomic replacement
- Environment: isolated process crash fixture
- Required evidence: endpoint count one, canonical inode unchanged, pending intent, restart network audit
- Expected result: `REFRESH_INTENT_REMAINS=YES`, `AUTO_REFRESH_RETRY=NO`,
  `OLD_TOKEN_REUSED=NO`, `RESULT=REAUTH_REQUIRED`
- Failure condition: retry, intent overwrite/clear, old-token dispatch or success claim

### ACC-SCA-007 — Crash after canonical atomic write

- Contracts: `CTR-SCA-007`, `CTR-SCA-008`
- Method: terminate after credential rename and before intent clear
- Environment: isolated process crash fixture
- Required evidence: old/new device:inode, valid canonical document, refresh counter, recovery result
- Expected result: inode differs, canonical valid, recovery clears intent, total refresh count one
- Failure condition: second refresh, reauth request for a provably committed credential or invalid store

### ACC-SCA-008 — One Owner reauth restores the fleet

- Contracts: `CTR-SCA-009`, `CTR-SCA-014`
- Method: synthetic controlled reauth writes only canonical store, then starts multiple Agent profiles
- Environment: isolated full-runtime fixture; later one controlled production conformance run
- Required evidence: one login invocation, canonical metadata change, per-home metadata unchanged, all
  Agents read the new canonical generation
- Expected result: one canonical login restores all callers; no Agent-specific OAuth flow
- Failure condition: more than one login, per-home write/read or duplicate Owner incident per generation

### ACC-SCA-009 — Permission Model A

- Contracts: `CTR-SCA-010`
- Method: metadata/ACL inspection plus actual uid505, uid502 and unrelated-uid operations, including fresh
  temp creation and rename over canonical file
- Environment: isolated filesystem fixture matching production Model A; later production preflight
- Required evidence: owner/group/mode/ACL before and after replace; operation results by uid
- Expected result: authsvc access PASS, uid502 read and atomic replace PASS, third uid denied,
  group/world bits zero, all Agent Homes unchanged
- Failure condition: 0755 Agent Home workaround, group/world access, shared group, ACL inheritance loss or
  replacement inode inaccessible to either required principal

### ACC-SCA-010 — Secret redaction and route regression

- Contracts: `CTR-SCA-011`, `CTR-SCA-012`
- Method: secret canary scan plus existing ordered-route positive/negative suite and config diff
- Environment: clean implementation checkout
- Required evidence: redaction scan, route attempt/journal fixtures, before/after route membership/order
- Expected result: no secret/hash output; all route semantics unchanged except version-3 credential field
- Failure condition: route/hop/classifier/deadline drift, secret serialization or new Agent enablement

### ACC-SCA-011 — Source identity and scope

- Contracts: `CTR-SCA-013`, `CTR-SCA-016`
- Method: exact diff manifest, source-stamp verification, package artifact comparison and structure gate
- Environment: implementation PR and candidate artifact
- Required evidence: both repository commits, artifact digest, changed-path list, clean build identity
- Expected result: only authorized files changed; compatibility line 0.2.3 with honest distinct build
  provenance; authoring PR docs-only
- Failure condition: unpinned npm bytes, hidden upgrade, unrelated path or production write

### ACC-SCA-012 — Migration/rollback dry run

- Contracts: `CTR-SCA-014`, `CTR-SCA-015`
- Method: execute the full candidate migration, canary order and rollback branches against disposable
  91-Agent inventories containing the following synthetic provenance fixtures

#### Fixture A — `ONE_PROVEN_GENERATION`

- Environment: isolated x64 candidate runtime; 91 synthetic legacy stores; both quiesce fences proven;
  one expected account identity; exactly one complete successful remote-operation-to-atomic-commit
  provenance chain; no production token
- Required evidence: ordered quiesce/fence log, non-secret generation/account identity, remote-success
  receipt, atomic-commit receipt, complete later-event absence proof and canonical write record
- Expected result: `LEGACY_CREDENTIAL_REUSE_ALLOWED=YES`; the sole proven generation is written once to
  canonical storage without remote refresh
- Reject condition: reuse without the complete provenance chain, more than one canonical write or any
  remote refresh

#### Fixture B — `MULTIPLE_CANDIDATES_ONE_PROVEN`

- Environment: isolated x64 candidate runtime; multiple same-account synthetic candidates; exactly one
  candidate has complete provenance; no pending/unknown intent; no production token
- Required evidence: all candidate account bindings, complete candidate inventory, unique
  `PROVEN_GENERATION_SET`, selected non-secret generation identity and canonical write record
- Expected result: only the proven generation is selected; unproven candidates cannot rank or win
- Reject condition: selection of an unproven candidate, ambiguity hidden by metadata or more than one
  authoritative store

#### Fixture C — `STALE_STORE_WITH_NEWER_MTIME`

- Environment: isolated x64 candidate runtime; same-account stale unproven store has newer `mtime` than
  the sole proven generation; no production token
- Required evidence: provenance-only selection trace plus a negative proof that `mtime`/`ctime` were not
  selection inputs
- Expected result: the proven generation wins; the newer stale store does not
- Reject condition: any timestamp ordering, preference or tie-break

#### Fixture D — `TWO_CONFLICTING_PROVEN_GENERATIONS`

- Environment: isolated x64 candidate runtime; two different same-account generation records each claim
  complete but mutually conflicting provenance; no production token
- Required evidence: both non-secret generation identities, conflict classification, zero legacy
  refresh dispatches and direct-canonical reauth count
- Expected result: `AUTHORITATIVE_STORE=NONE`; `CANONICAL_REAUTH_REQUIRED=YES`; exactly one Owner reauth
  writes the canonical store directly
- Reject condition: either legacy generation selected, any old-token refresh or reauth count other than one

#### Fixture E — `TIE_OR_INSUFFICIENT_PROVENANCE`

- Environment: isolated x64 candidate runtime; a generation tie or a missing remote-success,
  atomic-commit, fence-order or later-event proof; no production token
- Required evidence: exact missing/conflicting provenance field, fail-closed result, zero legacy refresh
  dispatches and direct-canonical reauth count
- Expected result: `AUTHORITATIVE_STORE=NONE`; `CANONICAL_REAUTH_REQUIRED=YES`; exactly one Owner reauth
- Reject condition: guessed selection, metadata tie-break, old-token use or multiple reauths

#### Fixture F — `ACCESS_TOKEN_VALID_BUT_REFRESH_GENERATION_UNKNOWN`

- Environment: isolated x64 candidate runtime; synthetic access-token status is usable while refresh
  generation provenance is unknown; no production token or real provider call
- Required evidence: selection-input audit proving access-token validity was ignored, fail-closed result,
  zero legacy refresh dispatches and direct-canonical reauth count
- Expected result: `AUTHORITATIVE_STORE=NONE`; `CANONICAL_REAUTH_REQUIRED=YES`; exactly one Owner reauth
- Reject condition: access-token probing/ranking, legacy reuse or more than one reauth

#### Fixture G — `PENDING_REFRESH_INTENT_EXISTS`

- Environment: isolated x64 candidate runtime; at least one same-account candidate has a pending or
  outcome-unknown refresh intent; no production token
- Required evidence: redacted intent state and generation identity, fail-closed result, preserved intent,
  zero legacy refresh dispatches and direct-canonical reauth count
- Expected result: `AUTHORITATIVE_STORE=NONE`; intent evidence remains; exactly one direct canonical Owner
  reauth is required
- Reject condition: intent clear/overwrite, legacy selection, automatic retry or multiple reauths

#### Fixture H — `NO_LEGACY_PROVEN_GENERATION`

- Environment: isolated x64 candidate runtime; 91 same-account synthetic candidates and no proven
  generation; no production token
- Required evidence: empty `PROVEN_GENERATION_SET`, zero probe/legacy refresh calls, one direct-canonical
  login invocation, canonical metadata result and per-home file-open audit
- Expected result: `LEGACY_CREDENTIAL_REUSE_ALLOWED=NO`; `AUTHORITATIVE_STORE=NONE`; exactly one canonical
  Owner reauth establishes the shared store; zero per-home runtime use; controlled restart/canaries and
  rollback never restore a legacy credential
- Reject condition: guessing, 91 copies/logins, per-home runtime access, implicit fallback, route change
  or rollback to any legacy rotating token

### Contract coverage

| Contract | Acceptance | Covered |
|---|---|---|
| `CTR-SCA-001` | `ACC-SCA-001` | YES |
| `CTR-SCA-002` | `ACC-SCA-001`, `ACC-SCA-011` | YES |
| `CTR-SCA-003` | `ACC-SCA-002` | YES |
| `CTR-SCA-004` | `ACC-SCA-002` | YES |
| `CTR-SCA-005` | `ACC-SCA-002`, `ACC-SCA-012` | YES |
| `CTR-SCA-006` | `ACC-SCA-003`, `ACC-SCA-004` | YES |
| `CTR-SCA-007` | `ACC-SCA-004` through `ACC-SCA-007` | YES |
| `CTR-SCA-008` | `ACC-SCA-005` through `ACC-SCA-007` | YES |
| `CTR-SCA-009` | `ACC-SCA-005`, `ACC-SCA-006`, `ACC-SCA-008` | YES |
| `CTR-SCA-010` | `ACC-SCA-009` | YES |
| `CTR-SCA-011` | `ACC-SCA-010` | YES |
| `CTR-SCA-012` | `ACC-SCA-010` | YES |
| `CTR-SCA-013` | `ACC-SCA-011` | YES |
| `CTR-SCA-014` | `ACC-SCA-008`, `ACC-SCA-012` | YES |
| `CTR-SCA-015` | `ACC-SCA-003` through `ACC-SCA-007`, `ACC-SCA-012` | YES |
| `CTR-SCA-016` | `ACC-SCA-011` | YES |

## 11. Alternatives and disposition

### ALT-SCA-001 — Per-Agent writable OAuth copies

- Disposition: rejected
- Reason: observed rotating-token invalidation and 401 reuse failure
- Evidence/Claims considered: `CLM-SCA-001`, `EVD-SCA-001`
- What would reopen: provider-issued independent refresh identities per Agent under a different accepted
  account architecture; not present here

### ALT-SCA-002 — Symlink/hardlink/rsync/broadcast

- Disposition: rejected
- Reason: symlink violates the trust boundary; hardlink breaks atomic-replace identity; synchronization
  retains multiple writable generations and race windows
- Evidence/Claims considered: `CLM-SCA-001`, `CLM-SCA-002`
- What would reopen: none for this shared subscription architecture

### ALT-SCA-003 — New OAuth refresh implementation or credential service

- Disposition: rejected
- Reason: duplicates a verified provider implementation and expands the secret boundary
- Evidence/Claims considered: `OBS-SCA-002` through `OBS-SCA-006`
- What would reopen: upstream store cannot meet an accepted Contract after implementation review

### ALT-SCA-004 — Home 0755/shared group/world access

- Disposition: rejected
- Reason: violates Owner-frozen Permission Model A and unnecessarily broadens disclosure
- Evidence/Claims considered: Owner Decision `DEC-SCA-003`
- What would reopen: new whole-authority permission-model successor

### ALT-SCA-005 — Retry old token after uncertain refresh

- Disposition: rejected
- Reason: remote rotation may already have committed, making the old token invalid and outcome unknowable
- Evidence/Claims considered: `CLM-SCA-003`, `EVD-SCA-003`
- What would reopen: provider offers a transaction-status or idempotency protocol bound to refresh intent

### ALT-SCA-006 — Couple credential migration to GLM/model-route changes

- Disposition: rejected
- Reason: expands blast radius and conflates credential correctness with route policy
- Evidence/Claims considered: `CLM-SCA-004`, Owner scope
- What would reopen: separate accepted route-policy successor

## 12. Migration, compatibility, and rollback

```text
MIGRATION = CTR-SCA-014 ordered candidate and separately authorized production activation
COMPATIBILITY = absent credentialFile retains upstream per-home behavior outside production shared mode
PRODUCTION_SHARED_MODE = explicit canonical credentialFile mandatory and fail-loud
OLD_PER_HOME_FILES = read-only evidence; never runtime fallback
UNKNOWN_REFRESH = fail closed; one canonical Owner reauth
ROLLBACK = quiesce and disable Luna or restore known-good shared implementation; never restore writable copies
EMERGENCY_CONTAINMENT = quiesce Luna children, preserve intent/lock/credential metadata, no refresh retry
```

The acceptance transaction changes authority only. Implementation must occur on a base containing the
accepted successor. Production migration requires a later exact implementation conformance record,
Permission Model A proof, candidate dry run, explicit Owner apply authority and rollback evidence.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE_AFTER_ATOMIC_ACCEPTANCE
PARTIAL_SUPERSESSION = NONE
READY_TO_MARK_ACCEPTED = NO
READY_FOR_INDEPENDENT_REVIEW = YES
```

## 14. Authoring output

```text
TASK_NAME = 共享 执行
ROUND = SPEC_AMENDMENT

SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1
SPEC_KIND = implementation
STATUS = proposed
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = contracts
PRODUCTION_APPLY_AUTHORITY = none
PRIMARY_PARENT_AUTHORITY = AGENT_PROCESS_LIFECYCLE_HARDENING_V2
EXTERNAL_AUTHORITIES = Yan-Zero/dsh-codex@c35d7a41d16cdf6d202cdb1db4108b32cbafaa0e

FLEET_SHARED_CODEX_AUTH = YES
CANONICAL_CREDENTIAL_PATH = /Users/authsvc/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json
PER_AGENT_OAUTH_RUNTIME_USE = FORBIDDEN
GLOBAL_REFRESH_LOCK = REQUIRED

REFRESH_OUTCOME_UNKNOWN = FAIL_CLOSED_REAUTH_REQUIRED
AUTO_RETRY_AFTER_UNCERTAIN_REFRESH = FORBIDDEN
CRASH_AFTER_REMOTE_ROTATION_ACCEPTANCE = PASS_IF_FAIL_CLOSED_WITHOUT_TOKEN_REUSE

OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 16
CONTRACTS_WITH_ACCEPTANCE = 16
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
AUTHORING_READY_FOR_REVIEW = YES
NEXT_TASK = 共享 审计
```
