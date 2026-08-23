---
spec_id: AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3
status: proposed
date: 2026-08-23
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
replaces_on_acceptance: AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2
scope:
  - whole-authority replacement of the Agent primary Workspace cutover/import authority
  - direct in-place reuse of the historical OpenClaw Workspaces by Agent Core for the exact 86-Agent Trusted Fleet (zero copy, exact path)
  - complete Workspace visibility, filesystem integrity, exclusive runtime ownership, Feishu continuity
  - control-plane-only cutover, Build in Public first canary, and rollback boundary
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_WORKSPACE_SESSION_MODEL_V2
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
references:
  - docs/specs/AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2.md (current accepted authority; replaced whole by this Spec only in the future atomic acceptance transaction; its accepted blob is carried by V2 acceptance-finalize commit 261a80e66e52bf60d43980e9d22fe37dc793e5be and is byte-identical to current main)
  - docs/specs/AGENT_PRIMARY_WORKSPACE_IMPORT_V1.md (superseded historical adopt-in-place authority; historical record only; its superseded_by backlink to V2 is not rewritten)
  - PR #47 AGENT_TRUSTED_FLEET_CUTOVER_V1 at 30ae0f5d9f5f87c0fefda933c04e4e549af0f0f7 (proposed child planning input; not authority)
  - docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md (accepted; product model, path-agnostic)
  - docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md (accepted; separate Scheduler authority line referenced by §9 boundary)
---

# AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3 — Historical OpenClaw Workspace 原地直接复用（whole-authority replacement）

> **PROPOSED / DOCS-ONLY / NO IMPLEMENTATION OR PRODUCTION AUTHORITY YET.**
>
> 本 Spec 是 `AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2`（current accepted Workspace
> cutover/import authority）的完整、自包含、whole-authority replacement。Owner 已于
> 2026-08-23 作出最终决定（§1）：Agent Core 接管历史 OpenClaw Agent 的运行职责，但
> exact 86 Agent 继续直接使用原 OpenClaw Workspace 路径——不复制、不导入、不建立替代
> Workspace。该决定与 V2 的核心语义（Trusted Runtime 新建 primary Workspace、historical
> path 仅作 source、curated manifest 复制）直接冲突，因此不得 AMEND V2，必须整体替换。
>
> Revision 1（2026-08-23，"复用 执行" amendment round，基线 head
> `0a0ce92729107726787cf84f467b77e00fae1185`）：关闭两轮"复用 审计"发现的全部问题——
> 冻结 exact path 的唯一路径权威 `primary-workspaces.json` 及其解析链；冻结 Agent
> Definition 禁止 Workspace path 字段；冻结 `Binding.workspace = null` 的 Default
> Primary Workspace Rule 解析；runtime writer 口径改为
> `HISTORICAL_OPENCLAW_RUNTIME_WRITER_COUNT` / per-Agent single automated generation，
> 并显式允许 Owner interactive writes；symlink 语义冻结为 follow-allowed 且 Owner
> accepted；cross-Agent filesystem isolation 诚实表述为 UNPROVEN；cutover zero-mutation
> 与 functional canary 区分并将 canary 文件/内容/digest 机械化；承接两个既有冻结
> binding 冲突 key；修复 CTR-OW-013 悬空引用与 V2 revision 表述。Owner 总体方向
> （OPENCLAW_RUNTIME_REUSE=NO / OPENCLAW_WORKSPACE_REUSE=YES / DIRECT_ADOPT_IN_PLACE=
> REQUIRED / ZERO_COPY=REQUIRED / EXACT_86_ONLY=YES / FULL_WORKSPACE_VISIBILITY=YES）
> 不因本修订重新讨论。
>
> 在本 Spec 仍为 `proposed` 时：`IMPLEMENTATION_ALLOWED_NOW = NO`，
> `PRODUCTION_APPLY_ALLOWED_NOW = NO`。`implementation_authority: contracts` 只在
> 本 Spec 经独立 review 并合法 accepted 后激活。本轮修订不实现、不修改产品代码、
> 不读写任何 production Workspace、不修改 Agent Definition / Binding / production、
> 不修改 V2 / V1 lifecycle、不修改 PR #47、不 accept、不 merge。

## 0. Historical authoring result

```text
TASK_NAME = 复用 执行
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3
STATUS = proposed
IMPLEMENTATION_AUTHORITY = contracts
PRODUCTION_APPLY_AUTHORITY = none
WHOLE_AUTHORITY_REPLACEMENT = YES
REPLACES_ON_ACCEPTANCE = AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2
PARTIAL_SUPERSESSION = NONE
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCTION_APPLY_ALLOWED_NOW = NO
READY_FOR_INDEPENDENT_REVIEW = YES
NEXT_TASK = 复用 审计
```

本 code block 是 reviewed authoring head 的历史记录。Authoring round 1 head =
`0a0ce92729107726787cf84f467b77e00fae1185`；本 Revision 1 在其之上以单个 docs-only
fix commit 关闭两轮审计发现。Acceptance binding 在未来 acceptance transaction 中
另行冻结（§4.2）。

## 1. Owner ruling (frozen, verbatim)

Owner 最终决定，逐字冻结：

```text
OPENCLAW_RUNTIME_REUSE = NO
OPENCLAW_WORKSPACE_REUSE = YES

WORKSPACE_COPY = NONE
WORKSPACE_IMPORT = NONE
WORKSPACE_OVERLAY = NONE
WORKSPACE_PATH_CHANGE = NONE

HISTORICAL_WORKSPACE_BECOMES_PRIMARY = YES
HISTORICAL_WORKSPACE_READ_ONLY_SOURCE = NO

PRESERVE_EXACT_PATH = YES
PRESERVE_ALL_EXISTING_FILES = YES
PRESERVE_GIT_REPOSITORY = YES
PRESERVE_RELATIVE_PATHS = YES
PRESERVE_FILE_METADATA = YES
PRESERVE_EXECUTABLE_BITS = YES

AGENT_CORE_IS_SOLE_RUNTIME = YES
HISTORICAL_OPENCLAW_RUNTIME_MUST_REMAIN_STOPPED = YES
```

Owner ruling provenance：direct Owner instruction，"复用 执行" task，2026-08-23。本 Spec
是且仅是该 ruling 的 authority 冻结；不得在 review / acceptance 中改写其语义。

## 2. Goal

把上述 Owner ruling 冻结为 repository authority，并整体替换 V2：exact 86 个历史
OpenClaw Agent 的 primary Workspace **就是** immutable cutover plan 中记录的 historical
OpenClaw Workspace absolute path。Agent Core 接管运行职责后：

- 该 exact path mapping 保存在 `primary-workspaces.json`（§2.1 PATH_AUTHORITY）；
- `resolveWorkspace(agentId)` 是正常路径解析入口；
- child cwd（及 `DSH_PRIMARY_WORKSPACE`）使用该 exact path；
- 在该目录内继续读取和写入；
- 继续使用其已有 Git repository；
- 不创建替代 Workspace；
- 不做双写或同步；
- 不建立 copy 后的新 authority。

```text
DIRECT_ADOPT_IN_PLACE = REQUIRED
ZERO_COPY = REQUIRED
```

### 2.1 Exact Workspace path authority（Revision 1 冻结）

唯一正确的路径权威：

```text
PATH_AUTHORITY        = primary-workspaces.json
PATH_AUTHORITY_OWNER  = deployment-owned production configuration
PATH_SCHEMA           = exact agent_id -> exact historical OpenClaw absolute path
```

解析链必须明确写为：

```text
primary-workspaces.json
→ production-runtime
→ workspace-bootstrap.primaryWorkspaces
→ resolveWorkspace(agentId)
→ child cwd / DSH_PRIMARY_WORKSPACE
```

exact path 不写入 Agent Definition（§5 CTR-OW-008），不写入 `Binding.workspace`
（§5 CTR-OW-008 的 Default Primary Workspace Rule）。

与被替换 authorities 的对照：

```text
V1 (superseded historical): existing historical directory -> adopt in place -> zero copy
V2 (current, to be replaced): trusted primary Workspace under Trusted Runtime
    + curated manifest copy from historical source
V3 (this Spec): historical OpenClaw Workspace absolute path IS the primary Workspace
    + path mapping in deployment-owned primary-workspaces.json
    + exact 86 fleet only
    + exclusive Agent Core runtime ownership (OpenClaw runtime stopped)
    + same Feishu app / binding continuity
    + zero copy, zero path change, zero file mutation at takeover
```

V3 不是 V1 的复活：V1 是无 fleet bound、无 exclusive-runtime 证明、无 Feishu continuity
约束的一般 adopt-in-place authority，且已被 V2 合法 superseded。V3 是 fleet-bounded
one-time cutover authority，并叠加 §5 CTR-OW-005/006/007 的独有边界。

## 3. Scope and non-goals

### 3.1 In scope

- 冻结 §1 Owner ruling 为 whole-authority replacement Spec；
- 唯一 subject：PR #47 `AGENT_TRUSTED_FLEET_CUTOVER_V1` 已冻结的 exact 86 Agent
  （§5 CTR-OW-001）；
- 每个 subject 的 exact historical OpenClaw Workspace absolute path 经
  `primary-workspaces.json` → `resolveWorkspace(agentId)` 直接成为其 primary
  Workspace authority（含 child cwd / `DSH_PRIMARY_WORKSPACE`）；
- 整个 historical Workspace 原地保留、全量可见、继续读写、Git repository 原样使用；
- exclusive runtime ownership（historical OpenClaw runtime 保持停止，fail-loud 证明）；
- same Feishu app / conversation key / agent_id / group 与 P2P entry continuity；
- 控制面-only cutover 与 Build in Public first canary、控制面-only rollback；
- 未来 PR #47 revision 的必备内容（§5 CTR-OW-011）。

### 3.2 Non-goals / forbidden（this round 与本 authority 边界）

```text
PRODUCT_CODE_CHANGE               = NONE (this round)
WORKSPACE_FILE_CHANGE             = NONE (this round AND at future cutover transaction)
AGENT_DEFINITION_CHANGE           = NONE (this round; future cutover = membership metadata only)
BINDING_CHANGE                    = NONE (this round; future cutover = metadata only)
PRODUCTION_APPLY                  = FORBIDDEN_THIS_ROUND
V2_LIFECYCLE_CHANGE               = NONE (reserved for the atomic acceptance transaction)
V1_LIFECYCLE_CHANGE               = NONE
PR47_CHANGE                       = NONE (this round; separate downstream task)
ACCEPT_OR_MERGE                   = FORBIDDEN_THIS_ROUND
OPENCLAW_RUNTIME_REUSE            = NO
OPENCLAW_SESSION_TRANSCRIPT_REUSE = OUT_OF_SCOPE
OPENCLAW_CRON_JOB_REUSE           = OUT_OF_SCOPE
OPENCLAW_RUNTIME_STATE_REUSE      = FORBIDDEN
NOTIFICATION_AUTH_CHANGE          = OUT_OF_SCOPE
SCHEDULER_CHANGE                  = OUT_OF_SCOPE
FLEET_WIDENING                    = FORBIDDEN (incl. agt_cto-agent)
WORKSPACE_CONTENT_CURATION        = FORBIDDEN
WORKSPACE_SECRET_SCAN_REMOVAL     = FORBIDDEN
GENERAL_MIGRATION_API             = FORBIDDEN
```

本 Spec 不为第 87 个 Agent、非 86-fleet 的任意 Agent、backup restore、home migration、
conversation Workspace、one-Agent/multiple-Workspace 提供先例或 API authority。

## 4. Authority and dependencies

### 4.1 Authority map

```text
Repository governance      = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0 (accepted)
Workspace product model    = AGENT_WORKSPACE_SESSION_MODEL_V2 (accepted decision; path-agnostic)
Current workspace authority= AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2 (accepted; to be replaced whole by this Spec)
Superseded historical      = AGENT_PRIMARY_WORKSPACE_IMPORT_V1 (stays superseded; backlink to V2 unchanged)
Proposed child             = AGENT_TRUSTED_FLEET_CUTOVER_V1 (PR #47 at 30ae0f5; planning input, not authority)
Scheduler authority line   = SCHEDULER_OCCURRENCE_OUTCOME_V2 (accepted decision; §9 boundary only)
Exact path authority       = primary-workspaces.json (deployment-owned production configuration; §2.1)
```

`AGENT_WORKSPACE_SESSION_MODEL_V2` 固定的是 one Agent → one Workspace、Workspace-local
Memory、Session cwd 语义，不固定 Workspace 的物理路径位置，因此 V3 无需替换该 decision；
V3 下 one Agent 仍恰好有一个 primary Workspace（即其 historical path）。

### 4.2 Atomic whole-authority acceptance transaction（future）

本 Spec accepted 时，authorized maintainer 必须在同一份 docs-only change 中原子完成：

```text
AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3.status: proposed -> accepted
AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3.supersedes:
  [] -> [AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2]
AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2.status: accepted -> superseded
AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2.superseded_by:
  null -> AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3
mutual whole-Spec backlinks = present
docs/specs/README.md = synchronized
```

不得出现两个并行 accepted Workspace authorities。`AGENT_PRIMARY_WORKSPACE_IMPORT_V1`
保持 superseded，其 `superseded_by: V2` backlink 是历史记录，不重写。除上述
metadata/backlink/index 变化外，acceptance-finalize 不得改变 reviewed normative
meaning（`SEMANTIC_DELTA_AFTER_REVIEW = NONE`）。

### 4.3 Downstream implementation and production gates

本 Spec 与 V2 的关键差异：`implementation_authority: contracts`。V3 accepted 后，本 Spec
自身即为 implementation authority——不需要再有一个 implementation-authorizing child
Workspace Spec。但开工仍需同时满足：

1. 本 Spec accepted 且进入 authority branch（`status: accepted` in main）；
2. PR #47 已按 CTR-OW-011 修订并通过独立 review（exact 86 mapping + runtime
   exclusivity + Feishu continuity + Build in Public canary 计划），或其 successor
   提供同等 frozen plan；
3. 每个 Agent 的 immutable artifact 绑定（CTR-OW-001）已按 CTR-OW-011 方式冻结；
4. §5 CTR-OW-005 独占运行时证明先于任何 Agent 启用；
5. production run 的独立 approval / runbook gate（本 Spec 的
   `production_apply_authority: none` 不因 accepted 而自动升级）。

缺一项，`IMPLEMENTATION_ALLOWED = NO`。PR #47 在 V3 accepted/merged 前不得开始
production apply。

## 5. Contracts

### CTR-OW-001 — Exact fleet identity and immutable binding

唯一 eligible subjects 是 PR #47 已冻结的 exact 86 Agent（其 accepted revision 或
acceptance-bound immutable artifact 所 pin 的 ordered roster，
`EXACT_ROSTER_SHA256 = f046d18f76da838ba94775af7c960d0ee548f2e392c22e6c7b0e3add36cb8e5f`，
count = 86）。对每个 Agent 必须由 immutable artifact 绑定：

```text
agent_id
historical_workspace_path
workspace identity evidence
binding key
```

并保持：

```text
EXACT_AGENT_ID        = unchanged
EXACT_WORKSPACE_PATH  = unchanged
EXACT_FEISHU_BINDING  = unchanged
```

`agt_cto-agent` 继续明确排除。禁止执行时动态发现并扩大范围；count ≠ 86、重复/缺失
ID、roster drift、第 87 个目标、或任何 mutable runtime source 推导出的集合，必须在
mutation 前 fail。本 authority 不得用于扩大 fleet。

### CTR-OW-002 — Direct adopt in place; zero copy; exact path authority

每个 exact Agent 的 primary Workspace 就是 immutable cutover plan 中记录的 historical
OpenClaw Workspace absolute path：

```text
DIRECT_ADOPT_IN_PLACE = REQUIRED
ZERO_COPY             = REQUIRED
WORKSPACE_COPY        = NONE
WORKSPACE_IMPORT      = NONE
WORKSPACE_OVERLAY     = NONE
WORKSPACE_PATH_CHANGE = NONE
HISTORICAL_WORKSPACE_BECOMES_PRIMARY    = YES
HISTORICAL_WORKSPACE_READ_ONLY_SOURCE   = NO
```

exact path mapping 保存在 `primary-workspaces.json`（PATH_AUTHORITY，
PATH_AUTHORITY_OWNER = deployment-owned production configuration，
PATH_SCHEMA = exact agent_id -> exact historical OpenClaw absolute path）。正常路径解析
入口是 `resolveWorkspace(agentId)`，解析链唯一（§2.1）：

```text
primary-workspaces.json
→ production-runtime
→ workspace-bootstrap.primaryWorkspaces
→ resolveWorkspace(agentId)
→ child cwd / DSH_PRIMARY_WORKSPACE
```

Agent Core 以该 exact path 作为 child cwd，在该目录内继续读取和写入。不得创建替代
Workspace、不做双写或同步、不建立 copy 后的新 authority、不把 historical path 降级为
read-only source。因不存在内容复制，本 authority 下不存在 migration allowlist / manifest。

### CTR-OW-003 — Complete Workspace visibility; no curation; isolation honesty

整个 historical Workspace 原地保留。不得根据扩展名、subtree 或 scanner 决定哪些文件
对 Agent 可见。原 Workspace 内现有的（非穷举，类别不受限）：

```text
source code / scripts / projects / memory / docs / materials / files / podcast /
research / data / archives / databases / media / executable files / Git metadata /
hidden project files
```

均继续保持原有路径和可见性。现有 secret/credential-like Workspace 内容继续属于该
Agent 可见的 trust domain；不做 file filtering/removal。不得通过移动、隐藏、删除或不
复制 Workspace 文件来实现安全控制。

Cross-Agent 隔离的诚实口径（Revision 1 冻结）：

```text
CROSS_AGENT_FILESYSTEM_ISOLATION = UNPROVEN
```

- 86 个 Agent 当前属于 cooperative shared-host trust domain；
- 本 V3 不新增 per-Agent OS UID 或 filesystem sandbox；
- 不得声称一个 Agent 已被机械阻止读取其他 Workspace；
- 未来若需 adversarial isolation，必须另走独立 authority；
- 这不改变 exact agent_id → exact own primary Workspace 的正常 cwd 映射。

### CTR-OW-004 — Filesystem integrity during takeover; symlink semantics

接管过程不得对 Workspace 做任何内容或元数据变更：

```text
CHMOD_CHOWN_WORKSPACE   = FORBIDDEN
DELETE_OR_REWRITE       = FORBIDDEN
CACHE_NODE_MODULES_CLEANUP = FORBIDDEN
STRIP_EXECUTABLE_BIT    = FORBIDDEN
SYMLINK_EXPANSION       = FORBIDDEN (takeover 不得创建/展开/改写/删除现有 symlink)
HARDLINK_FLATTEN        = FORBIDDEN (现有 hardlink 同样保持原状，不展开、不重写)
GIT_METADATA_MODIFY     = FORBIDDEN
AUTO_FORMAT             = FORBIDDEN
SECRET_SCAN_THEN_DELETE = FORBIDDEN
MIRROR_COPY             = FORBIDDEN
```

接管前只允许 metadata / preflight 检查（read-only：path 存在性、identity evidence
核对、git status 读取）。现有内容即 Owner 授权继续使用的 Workspace 内容；任何后续
安全治理必须是独立 authority，不得在 Workspace 接管中静默变更用户文件。Agent 正常
运行中的正常读写（含其自身 git 操作）不受本条限制——本条约束的是 cutover/takeover
机制本身不得做 Owner 未授权的文件变更。

Symlink 语义（Revision 1 冻结，为满足完全兼容 Owner 方向）：

```text
SYMLINK_FOLLOW_ALLOWED_AND_OWNER_ACCEPTED = YES
```

- 接管不创建、展开、改写或删除现有 symlink；
- Agent 工具继续沿用原 Workspace 的既有 OS/tool symlink 行为（follow）；
- symlink target 可能位于 Workspace 外；
- Owner 明确接受这一兼容性风险；
- 本 Spec 不得宣称 `PATH_ESCAPE_IMPOSSIBLE`；
- 这不授权 Agent Core 创建新的 symlink。

### CTR-OW-005 — Exclusive runtime ownership（runtime writer 口径，Revision 1 冻结）

为避免两个自动运行时同时写同一 Workspace：

```text
HISTORICAL_OPENCLAW_RUNTIME_MUST_REMAIN_STOPPED = YES
AGENT_CORE_IS_SOLE_RUNTIME                      = YES
```

切换前必须证明：

```text
HISTORICAL_OPENCLAW_RUNTIME_RUNNING      = NO
HISTORICAL_OPENCLAW_RUNTIME_WRITER_COUNT = 0
```

Agent Core 启用后：

```text
AGENT_CORE_AUTOMATED_RUNTIME_WRITER = at most 1 active generation per Agent
```

不得同时启用旧 OpenClaw runtime。若检测到旧 runtime 的自动 writer 或未知自动 writer：

```text
FAIL_LOUD
```

不得接管该 Agent。

Owner interactive writes 显式允许：

```text
OWNER_INTERACTIVE_WRITES = ALLOWED
```

Owner 继续可以使用 Finder、IDE、Git、本地开发工具、手工编辑。这些不算第二个 Agent
Runtime，不触发 FAIL_LOUD。Owner 与 Agent 的并发编辑继续遵循普通 filesystem / Git
语义；本 Spec 不声称自动解决编辑冲突。（不使用上一轮模糊的
`HISTORICAL_WORKSPACE_ACTIVE_WRITER_COUNT` / 无差别 `UNKNOWN_WRITER` 口径——以
runtime 自动 writer 为准。）

### CTR-OW-006 — Feishu continuity; frozen binding conflicts carried forward

复用当前已经由 Agent Core production 使用的原 OpenClaw Feishu app：

```text
NEW_APP   = FORBIDDEN
APP_ID_CHANGE = FORBIDDEN
same app
same conversation key
same agent_id
same group / P2P entry
```

历史 OpenClaw runtime 保持关闭，因此不会产生双消费者。本 Spec 不修改 Notification
auth，也不修改 Scheduler。

Binding 类型证据的诚实区分（Revision 1 冻结）：

```text
EVIDENCE_PROVEN_BINDING_TYPES  = historical conversation-key bindings
FUTURE_SUPPORTED_BINDING_TYPES = subject to immutable cutover plan and canary evidence
```

不得把 group/P2P continuity 写成已经全部实证。

承接 PR #47 既有冻结 binding 冲突（不得因修订 PR #47 而丢失）：

```text
feishu:oc_92332c45c1cac2ef89857abfee8ed762
feishu:oc_9dd74b9ed02ce216951260a381eb502d

CONFLICTING_BINDING_OVERWRITE   = FORBIDDEN
CONFLICTING_BINDING_DELETE      = FORBIDDEN
CONFLICTING_BINDING_REASSIGN    = FORBIDDEN
CONFLICTING_BINDING_AUTO_REPAIR = FORBIDDEN
CONFLICTING_BINDING_FALLBACK    = FORBIDDEN
```

### CTR-OW-007 — Session, Scheduler, and runtime-state boundary

```text
WORKSPACE_REUSE                   = IN_SCOPE
OPENCLAW_SESSION_TRANSCRIPT_REUSE = OUT_OF_SCOPE
OPENCLAW_CRON_JOB_REUSE           = OUT_OF_SCOPE
OPENCLAW_RUNTIME_STATE_REUSE      = FORBIDDEN
```

Workspace 原地复用不自动授权：session transcript 导入、cron history 导入、280 jobs
启用、catch-up、retry state 继承。这些分别等待独立 authority（Scheduler 侧沿
`SCHEDULER_OCCURRENCE_OUTCOME_V2` 既有 authority line，本 Spec 不新增、不启用任何
scheduler job）。

### CTR-OW-008 — Cutover is control-plane metadata only; Agent Definition / Binding boundary

未来接管只改变控制面 metadata：

```text
primary-workspaces.json mapping（exact agent_id -> exact historical path）
Agent Definition membership（fleet membership）
Binding
runtime ownership
```

不改变 Workspace 文件（对齐 CTR-OW-002/004）。

Agent Definition 边界（Revision 1 冻结）：

```text
AGENT_DEFINITION_WORKSPACE_PATH_FIELD = FORBIDDEN
```

Agent Definition 继续只允许：exact `agent_id`、name、description、default selection、
现有身份/展示 membership 字段。不得加入：Workspace path、OpenClaw path metadata、
credential、secret、runtime state、session state、process state。未来 cutover 可修改
Definition membership，但不得在 Definition 中写 Workspace path。

Binding 解析边界（Revision 1 冻结）：

```text
Binding.workspace = null
→ Default Primary Workspace Rule
→ resolveWorkspace(agentId)
→ primary-workspaces.json
→ exact historical OpenClaw absolute path
```

不得：将 historical path 写入 `Binding.workspace`；将 Workspace path 写入 Agent
Definition；使用 fallback 新 Workspace；动态猜测路径。

### CTR-OW-009 — Build in Public first canary；zero-mutation transaction 与 functional canary 区分（Revision 1 冻结）

```text
CUTOVER_TRANSACTION_WORKSPACE_MUTATION = NONE
POST_CUTOVER_FUNCTIONAL_CANARY         = Owner-authorized reversible file write
```

第一 canary 是 `agt_build-in-public-agent`。其余 85 个 Agent 不得先于或并行于 canary
被接管。canary 必须证明：

```text
same exact workspace path
existing files immediately visible
existing Git status unchanged
Agent 能读取已有资料
Agent 能在原目录创建一个 Owner-authorized 可逆 canary 文件（机械化见下）
删除 canary 文件后 Git/Workspace 回到原状态
原飞书 Binding 能正常回复
historical OpenClaw runtime 仍关闭
```

Canary 文件机械化：

```text
CANARY_AGENT     = agt_build-in-public-agent
CANARY_FILE_PATH = .agent-core-workspace-reuse-v3-canary.txt
CANARY_CONTENT   = AGENT_CORE_WORKSPACE_REUSE_V3_CANARY
```

前置：exact file 必须不存在；若已存在，`FAIL_LOUD`；不覆盖。必须记录：

```text
PRE_CANARY_GIT_STATUS_DIGEST  = sha256(git status --porcelain=v1 -z)
POST_CANARY_GIT_STATUS_DIGEST = same as PRE_CANARY_GIT_STATUS_DIGEST
FILE_EXISTS_AFTER_CANARY      = NO
```

流程：

1. 记录 pre status digest；
2. 使用 exclusive create 创建固定路径、固定内容的 canary 文件；
3. 读取验证固定内容；
4. 删除该文件；
5. 记录 post status digest；
6. pre/post digest 必须一致。

如果 canary Workspace 不是 Git repo：必须使用等价的固定 metadata snapshot，不得伪造
Git status PASS。任一证明失败即 STOP，fleet 不得推进。

### CTR-OW-010 — Rollback is control-plane only

回滚只需：

```text
1. 恢复 primary-workspaces.json mapping
2. 恢复 Agent Definition membership
3. 恢复 Binding
4. 停止 Agent Core 对该 Agent 的自动化使用
```

回滚不得移动或还原 Workspace 文件——文件从未迁移。回滚不得激活旧 OpenClaw runtime。

### CTR-OW-011 — PR #47 revision gate

V3 accepted/merged 后，必须修订现有 proposed PR #47
（`AGENT_TRUSTED_FLEET_CUTOVER_V1`）——删除 curated Workspace import、五文件限制、
copy/manifest migration、Trusted replacement Workspace 创建；替换为：

```text
exact historical path direct reuse
zero-copy
exact 86 mapping
runtime exclusive ownership
same Feishu app
exact Binding continuity
Build in Public first canary
```

修订必须承接 CTR-OW-006 冻结的两个 conflicting binding keys 及其五项 FORBIDDEN 处置，
不得因修订丢失。PR #47 不得在 V3 accepted 前自行扩大 authority，也不得在 V3 accepted
后保留与本 Spec 冲突的 curated-import 语义；在 V3 accepted/merged 前不得开始
production apply。该 revision 是独立 downstream task，本轮不执行。

### CTR-OW-012 — Authority and production gates

本 Spec 在 proposed 阶段不授权任何 implementation 或 production 动作。Accepted 后
`implementation_authority: contracts` 激活，但 production apply 仍需 §4.3 全部条件 +
独立 production run approval。本 authoring/amendment round：只修改本 Spec 文件；不修改
V2 / V1 lifecycle；不修改 PR #47；不修改产品代码；不读写 production Workspace；
不 accept、不 merge。

## 6. Current State

- `STATE-OW-001` — 在 `origin/main@622cb7b6bae7b0b5a9a8713bb5a843ad6a7dc5f1`，V2 由
  acceptance-finalize commit `261a80e66e52bf60d43980e9d22fe37dc793e5be` 携带（该
  commit 携带的 V2 blob 与 current main byte-identical；它是 acceptance commit，不是
  file/blob revision），是 accepted/current Workspace cutover authority：Trusted
  Runtime provision primary、historical path source-only read-only、curated manifest
  copy。Basis: `OBS-OW-001`, `CLM-OW-001`, `EVD-OW-001`。
- `STATE-OW-002` — PR #47 head `30ae0f5d9f5f87c0fefda933c04e4e549af0f0f7` 是
  Draft/proposed child，pin 了 exact 86 ordered roster（count = 86、
  `EXACT_ROSTER_SHA256`、`INVENTORY_RESULT_SHA256`）与 Build in Public first canary，
  其 authority_dependencies 指向 V2。Basis: `OBS-OW-002`, `EVD-OW-002`。
- `STATE-OW-003` — 本 authoring/amendment branch 不改变任何 active authority、
  production state、Workspace 文件或产品代码。Basis: direct Git changed-file boundary
  and this Spec status。

## 7. Observations

### OBS-OW-001 — V2 freezes trusted-provision + curated copy semantics

- Repository/revision: `mayf3/dsh-agent-core` acceptance-finalize commit
  `261a80e66e52bf60d43980e9d22fe37dc793e5be`（该 commit 携带的 V2 blob 与 current
  main byte-identical；它是一个 acceptance commit，不是 file/blob revision）
- Source: `docs/specs/AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2.md`
- Method: inspect frontmatter and §§1, 2.2, 8 (CTR-WS-002/004), 9
- Result: accepted/current；historical path 必须是 source-only、read-only、never
  active primary；只有 curated manifest 文件可复制进 trusted primary Workspace。
- Environment: source repository, current main
- Observed at: 2026-08-23

### OBS-OW-002 — PR #47 pins the exact 86 fleet as planning input

- Repository/revision: `mayf3/dsh-agent-core@30ae0f5d9f5f87c0fefda933c04e4e549af0f0f7`
- Source: `docs/specs/AGENT_TRUSTED_FLEET_CUTOVER_V1.md` §§1–3
- Method: inspect Draft PR #47 exact head
- Result: proposed child；ordered 86-ID roster + roster digest + read-only inventory
  digests；Build in Public first canary；authority_dependencies 指向 V2；自身
  implementation/production authority = none。
- Environment: Draft PR branch; not active authority
- Observed at: 2026-08-23

### OBS-OW-003 — Owner ruling directly contradicts V2 core semantics

- Repository/revision: Owner instruction, "复用 执行" task, 2026-08-23
- Source: task §0/§2（本 Spec §1 逐字冻结）
- Method: direct comparison with OBS-OW-001
- Result: `OPENCLAW_WORKSPACE_REUSE = YES`、`HISTORICAL_WORKSPACE_BECOMES_PRIMARY = YES`、
  `WORKSPACE_COPY = NONE` 与 V2 的 source-only/curated-copy 核心语义正面冲突；同时
  ruling 显式冻结 `不得 AMEND V2；必须创建 whole-authority replacement`。
- Environment: direct Owner instruction
- Observed at: 2026-08-23

### OBS-OW-004 — Governance requires whole-authority replacement for direction reversal

- Repository/revision: `mayf3/dsh-agent-core@622cb7b6bae7b0b5a9a8713bb5a843ad6a7dc5f1`
- Sources: `.agents/README.md`, `.agents/protocol/SPEC_FORMAT_V0.md`,
  `.agents/protocol/SPEC_GOVERNANCE_V0.md`
- Method: inspect whole-authority lifecycle and review rules
- Result: accepted long-lived meaning 的方向性改变需要 new standalone replacement +
  atomic forward/backlink transition；proposed authority 不激活；partial supersession
  被禁止。
- Observed at: 2026-08-23

### OBS-OW-005 — Workspace product model decision is path-agnostic

- Repository/revision: `mayf3/dsh-agent-core@622cb7b6bae7b0b5a9a8713bb5a843ad6a7dc5f1`
- Source: `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md`
- Method: inspect §0 one-line model and PRESERVE invariants
- Result: decision 固定 one Agent → one Workspace、Workspace-local Memory、Session 共享
  Workspace；不固定 Workspace 物理路径必须在 Trusted Runtime tree 内。
- Observed at: 2026-08-23

## 8. Claims and assumptions

### CLM-OW-001 — The Owner ruling cannot be authorized by amending V2 or by a child exception

- Support state: SUPPORTED
- Supported by: `EVD-OW-001`, `EVD-OW-003`
- Contradicted by: none known
- Uncertainty: none；partial supersession 被治理协议禁止（`EVD-OW-004`）。

### CLM-OW-002 — A whole-authority replacement can adopt historical paths without breaking the workspace product model

- Support state: SUPPORTED
- Supported by: `EVD-OW-005`
- Contradicted by: none known
- Uncertainty: one Agent 仍 one primary Workspace（= 其 historical path）；Memory 仍
  Workspace-local；session cwd fail-loud 语义不变。

### CLM-OW-003 — Full visibility is adopted with honest, unproven cross-Agent isolation

- Support state: SUPPORTED（Owner ruling 显式冻结 full visibility；Revision 1 审计冻结
  isolation honesty）
- Supported by: `EVD-OW-003`
- Contradicted by: none known
- Uncertainty: Credential/process boundaries remain applicable, but cross-Agent
  filesystem isolation is not proven by this Spec（`CROSS_AGENT_FILESYSTEM_ISOLATION =
  UNPROVEN`，CTR-OW-003）。各 boundary（credential / process 等）的强化属于
  implementation 与后续 authority；本 Spec 只冻结"不得用文件移动/隐藏/删除/不复制实现
  安全控制"。

### CLM-OW-004 — Exclusive automated runtime ownership is provable and must gate every takeover

- Support state: SUPPORTED
- Supported by: `EVD-OW-003`
- Contradicted by: none known
- Uncertainty: 具体检测机制（runtime stopped 证明、runtime writer count 证明）由未来
  cutover runbook/implementation 细化，但 FAIL_LOUD / 不得接管 是本 Spec 冻结的硬边界；
  口径是 runtime 自动 writer（CTR-OW-005），Owner interactive writes 永远允许。

Open authority-changing assumptions: **NONE**。exact 86 identities 与 per-Agent
workspace paths 已由 PR #47 pinned roster + 本 Spec CTR-OW-001 的 immutable artifact
要求冻结；不得在实现中猜测。

## 9. Evidence relations

### EVD-OW-001 — V2 text supports the authority-conflict claim

- Source: `OBS-OW-001`
- Target: `STATE-OW-001`, `CLM-OW-001`
- Relation: SUPPORTS
- Strength: direct accepted Spec text
- Limitation: does not describe production state

### EVD-OW-002 — PR #47 text supports the fleet-bound and canary claims

- Source: `OBS-OW-002`
- Target: `STATE-OW-002`, `CLM-OW-001`
- Relation: SUPPORTS
- Strength: exact proposed child head with immutable digests
- Limitation: proposed child is not production conformance evidence

### EVD-OW-003 — Owner instruction supports the replacement direction and all frozen boundaries

- Source: `OBS-OW-003`
- Target: `CLM-OW-001`, `CLM-OW-003`, `CLM-OW-004`, §5 all Contracts
- Relation: SUPPORTS
- Strength: direct, explicit, final Owner ruling with verbatim freeze
- Limitation: owner instruction 与 production 现状的一致性（runtime 状态、binding 状态）
  留给未来 cutover preflight 证明

### EVD-OW-004 — Governance protocol supports the whole-authority replacement path

- Source: `OBS-OW-004`
- Target: `CLM-OW-001`
- Relation: SUPPORTS
- Strength: accepted repository governance
- Limitation: semantic review and authorized acceptance remain manual

### EVD-OW-005 — Product-model decision supports path-agnostic adoption

- Source: `OBS-OW-005`
- Target: `CLM-OW-002`
- Relation: SUPPORTS
- Strength: accepted decision text
- Limitation: none known

## 10. Decisions

### DEC-OW-001 — Replace V2 wholly; do not amend or partially override it

- Decision owner: `mayf3`
- Selected direction: new V3 standalone Current Truth with future atomic supersession
  （§4.2）。
- Rejected: amend V2, child exception under V2, parallel accepted authorities.
- Reason: in-place zero-copy reuse 直接矛盾 V2 的 trusted-provision/curated-copy 核心
  语义；治理协议禁止 partial supersession。
- Owner input remaining: NONE.

### DEC-OW-002 — Historical Workspace becomes the primary Workspace, in place, via primary-workspaces.json

- Decision owner: `mayf3`
- Selected direction: exact historical path mapping 保存在 deployment-owned
  `primary-workspaces.json`；`resolveWorkspace(agentId)` 为正常解析入口；child cwd /
  `DSH_PRIMARY_WORKSPACE` 使用该 exact path；read/write in place；existing Git
  repository 继续使用。
- Rejected: trusted replacement Workspace, copy/manifest import, overlay, symlink farm,
  dual-write/sync, read-only source, 把 path 写进 Agent Definition 或
  `Binding.workspace`。
- Reason: Owner 最终决定（§1 verbatim）+ Revision 1 路径权威冻结。
- Owner input remaining: NONE.

### DEC-OW-003 — Exact 86 fleet only; no widening

- Decision owner: `mayf3`
- Selected direction: PR #47 frozen exact 86 + immutable per-Agent binding artifact；
  `agt_cto-agent` excluded；no dynamic discovery。
- Rejected: 87th Agent, count-only mutable discovery, general migration API.
- Reason: Owner authorization is one-time and fleet-bounded。
- Owner input remaining: NONE.

### DEC-OW-004 — Full Workspace visibility; honest UNPROVEN cross-Agent isolation

- Decision owner: `mayf3`
- Selected direction: 整个 Workspace 原地全量可见，不做 extension/subtree/scanner 过滤；
  cross-Agent filesystem isolation 诚实表述为 UNPROVEN（cooperative shared-host trust
  domain，本 V3 不新增 per-Agent OS UID / filesystem sandbox）；未来 adversarial
  isolation 另走独立 authority。
- Rejected: visibility filtering, curated allowlist, move/hide/delete-based control,
  宣称机械隔离已成立。
- Reason: no copy happens; existing content is owner-authorized; zero-copy 模型下
  content-based 筛选既不可能也不被授权；审计要求不得过度声称。
- Owner input remaining: NONE.

### DEC-OW-005 — Filesystem integrity: takeover mutates nothing; symlink follow allowed and owner-accepted

- Decision owner: `mayf3`
- Selected direction: cutover 前 read-only metadata/preflight only；禁止
  chmod/chown/delete/rewrite/cleanup/exec-bit/git/格式化/scan-delete/mirror 类变更；
  现有 symlink/hardlink 原样保留；Agent 工具沿用既有 OS/tool symlink follow 行为
  （target 可在 Workspace 外，Owner 接受该风险；不宣称 PATH_ESCAPE_IMPOSSIBLE；
  不授权创建新 symlink）。
- Rejected: takeover-time cleanup, secret-scan deletion, auto-format, metadata
  rewrite, symlink 展开/改写/删除, hardlink flatten。
- Reason: 接管是控制面事件，不是文件系统事件；完全兼容 Owner 方向要求沿用既有 link
  行为；后续安全治理必须独立 authority。
- Owner input remaining: NONE.

### DEC-OW-006 — Exclusive automated runtime ownership with fail-loud proof; Owner writes allowed

- Decision owner: `mayf3`
- Selected direction: historical OpenClaw runtime 保持停止；切换前证明 RUNNING=NO 且
  `HISTORICAL_OPENCLAW_RUNTIME_WRITER_COUNT=0`；启用后 per-Agent 至多 1 个 active
  automated generation；旧 runtime 自动 writer 或未知自动 writer → FAIL_LOUD 不接管；
  Owner interactive writes（Finder/IDE/Git/本地工具/手工编辑）永远允许，不算第二个
  runtime；并发编辑遵循普通 filesystem/Git 语义，本 Spec 不自动解决冲突。
- Rejected: dual automated runtime, best-effort takeover, silent override, 把 Owner
  手工写入当作违规 writer。
- Reason: 防止两个自动运行时写同一 Workspace，同时不禁止 Owner 自身使用其文件。
- Owner input remaining: NONE.

### DEC-OW-007 — Feishu continuity on the same app; frozen binding conflicts carried forward

- Decision owner: `mayf3`
- Selected direction: reuse 已由 Agent Core production 使用的原 OpenClaw Feishu app；
  same app / conversation key / agent_id / group 与 P2P entry；evidence-proven 类型仅为
  historical conversation-key bindings，其余 binding 类型以 immutable cutover plan 与
  canary evidence 为准；承接两个 frozen conflicting binding keys 及五项 FORBIDDEN
  处置。
- Rejected: new app, appId change, new conversation mapping, conflict overwrite/
  delete/reassign/auto-repair/fallback, 把 group/P2P continuity 宣称为已全部实证。
- Reason: binding continuity；旧 runtime 关闭故无双消费者；审计要求不丢失既有冻结
  冲突。
- Owner input remaining: NONE.

### DEC-OW-008 — Session/cron/runtime-state reuse stays out

- Decision owner: `mayf3`
- Selected direction: transcript reuse OUT_OF_SCOPE；cron job reuse OUT_OF_SCOPE；
  runtime state reuse FORBIDDEN；均等待独立 authority。
- Rejected: bundle import, auto catch-up, retry-state inheritance.
- Reason: workspace 原地复用只授权文件层，不授权历史运行语义。
- Owner input remaining: NONE.

### DEC-OW-009 — Build in Public first canary; control-plane-only rollback

- Decision owner: `mayf3`
- Selected direction: `agt_build-in-public-agent` 独占第一 canary；cutover transaction
  零 Workspace mutation 与 Owner-authorized reversible functional canary（固定路径
  `.agent-core-workspace-reuse-v3-canary.txt`、固定内容、exclusive create、pre/post
  `sha256(git status --porcelain=v1 -z)` digest 一致、非 Git repo 用等价固定 metadata
  snapshot）区分；rollback 只恢复 primary-workspaces.json mapping、Agent Definition
  membership、Binding 并停用 Agent Core 自动化使用。
- Rejected: all-at-once, parallel canaries, 覆盖已存在 canary 文件, 伪造 Git status
  PASS, file-moving rollback, rollback 时激活旧 runtime。
- Reason: explicit Owner ordering；文件从未迁移故回滚永不触碰文件；审计要求 canary
  机械化可验。
- Owner input remaining: NONE.

## 11. Acceptance

> 本节为未来 implementation/cutover 的验收契约（accepted 后由下游执行与审计）；本轮
> authoring 的验收是 docs 边界本身（ACC-OW-001 的 authoring 投影 + 本 Spec 独立 review）。

### ACC-OW-001 — Whole-authority lifecycle

- Contracts: `CTR-OW-012`
- Method: inspect reviewed authoring head 与未来 atomic acceptance transaction。
- Expected: V3 proposed 阶段零 authority；acceptance 原子链接 V3↔V2、只留 V3
  accepted/current、记录 `SEMANTIC_DELTA_AFTER_REVIEW = NONE`；本轮 changed files 只有
  本 Spec 一个文件。
- Failure: parallel accepted authorities、缺失 backlink、任何 implementation/product/
  production/workspace-file 变更。

### ACC-OW-002 — Exact fleet and immutable binding

- Contracts: `CTR-OW-001`
- Method: 对照 PR #47 accepted revision 的 frozen roster 与 digest；测试 85/86/87、
  duplicate、drift、out-of-set、`agt_cto-agent` 输入。
- Expected: 只有 exact 86 通过 planning；其他一切在 mutation 前 fail；无动态发现面。
- Failure: count-only 扩张、mutable source 推导、第 87 个目标被接受。

### ACC-OW-003 — Direct adopt-in-place via primary-workspaces.json; Definition/Binding boundary

- Contracts: `CTR-OW-002`, `CTR-OW-008`
- Method: 核对 `primary-workspaces.json`（deployment-owned）保存 exact agent_id →
  exact historical absolute path mapping；解析链 `primary-workspaces.json →
  production-runtime → workspace-bootstrap.primaryWorkspaces →
  resolveWorkspace(agentId) → child cwd / DSH_PRIMARY_WORKSPACE` 逐段可验；Agent
  Definition 中不存在任何 Workspace path / OpenClaw path metadata 字段；
  `Binding.workspace = null` 且 Default Primary Workspace Rule 生效；全库检索确认无
  copy/import/overlay/replacement-workspace 代码路径被启用、无 fallback 新 Workspace、
  无动态路径猜测。
- Expected: exact path 由唯一 PATH_AUTHORITY 提供；child cwd 使用该 exact path；
  historical path 可读可写（非 read-only source）；Definition 与 Binding 均不携带
  path。
- Failure: 任何 copy/overlay/dual-write/replacement Workspace 出现；path 与 plan 不
  一致；path 被降级为 source；Agent Definition 出现 workspace path 字段；
  `Binding.workspace` 被写入 historical path 或其他值；fallback 新 Workspace 或动态
  猜测路径出现。

### ACC-OW-004 — Full visibility and honest isolation

- Contracts: `CTR-OW-003`
- Method: 对代表性 Workspace（含 executables、hidden files、databases、media、git
  metadata、credential-like 文件）验证 Agent 可见性与路径不变；检索实现中不存在
  extension/subtree/scanner 可见性过滤；审计 Spec 与实现均不声称 cross-Agent 机械
  隔离。
- Expected: 全量可见、原路径；`CROSS_AGENT_FILESYSTEM_ISOLATION = UNPROVEN` 表述
  保持；normal cwd 映射（agent_id → own primary Workspace）不变。
- Failure: 任何基于文件选择、移动、隐藏、删除的安全控制；任何"已机械阻止读取其他
  Workspace"的声称或实现依赖。

### ACC-OW-005 — Filesystem integrity and symlink semantics

- Contracts: `CTR-OW-004`
- Method: cutover 前后对 Workspace 做 metadata/content 不变性证明（含 git status、
  exec bits、symlink/hardlink 形态、mtime）；对 cutover 机制代码做禁止操作审计；
  验证 Agent 工具对既有 symlink 沿用 OS/tool follow 行为且 cutover 未创建/展开/改写/
  删除任何 link。
- Expected: 除 Agent 正常运行产生的变更外，接管本身零文件/零元数据变更；preflight
  只读；symlink/hardlink 形态原样；无 `PATH_ESCAPE_IMPOSSIBLE` 声称；无新建 symlink。
- Failure: 任何 §CTR-OW-004 列表内的操作出现在 takeover 路径；link 被展开/改写/
  删除；接管创建新 symlink。

### ACC-OW-006 — Exclusive automated runtime ownership

- Contracts: `CTR-OW-005`
- Method: 注入旧 OpenClaw runtime 自动 writer / 未知自动 writer 场景；验证证明链
  （RUNNING=NO、`HISTORICAL_OPENCLAW_RUNTIME_WRITER_COUNT=0` → 接管 → per-Agent 至多
  1 个 active automated generation）；同时验证 Owner interactive writes（IDE/Git/
  手工编辑）不被阻止、不触发 FAIL_LOUD。
- Expected: 自动 writer 证明缺失或检测到冲突时 FAIL_LOUD 且不接管；Owner 手工写入
  始终允许。
- Failure: best-effort 接管、双自动 writer 并存、证明可跳过、把 Owner 手工写入当作
  违规 writer 阻断。

### ACC-OW-007 — Feishu continuity and frozen binding conflicts

- Contracts: `CTR-OW-006`
- Method: canary Agent 通过原 binding 收发真实消息；核对 appId/conversation key/
  agent_id/group、P2P entry 不变；对照 frozen conflicting binding keys
  （`feishu:oc_92332c45c1cac2ef89857abfee8ed762`、
  `feishu:oc_9dd74b9ed02ce216951260a381eb502d`）测试 overwrite/delete/reassign/
  auto-repair/fallback 全部被拒绝；核对 evidence 区分（historical conversation-key
  bindings vs subject-to-plan types）未被夸大。
- Expected: same app、same binding、正常回复；无新 app、无 mapping 变更；两个冲突
  key 的五项处置全部 FORBIDDEN；binding 类型声称与 evidence 一致。
- Failure: 新 app、appId 更换、binding 重映射、任一冲突处置被允许、把
  FUTURE_SUPPORTED 类型写成已实证。

### ACC-OW-008 — Session/Scheduler boundary

- Contracts: `CTR-OW-007`
- Method: 审计 cutover 实现与运行面：无 transcript/cron-history 导入、无 280 jobs
  启用、无 catch-up、无 retry-state 继承、无 OpenClaw runtime state 消费。
- Expected: 上述全部缺席；各自等待独立 authority。
- Failure: 任一历史运行语义被隐式带入。

### ACC-OW-009 — Canary mechanics and control-plane-only rollback

- Contracts: `CTR-OW-008`, `CTR-OW-009`, `CTR-OW-010`
- Method: 执行 canary 全部证明并断言 mutation-order trace；专项验证 canary 文件
  mechanics——`CANARY_FILE_PATH = .agent-core-workspace-reuse-v3-canary.txt` 前置不
  存在（已存在则 FAIL_LOUD 且不覆盖）、exclusive create、内容恰为
  `AGENT_CORE_WORKSPACE_REUSE_V3_CANARY`、读回验证、删除、
  `PRE_CANARY_GIT_STATUS_DIGEST == POST_CANARY_GIT_STATUS_DIGEST`
  （`sha256(git status --porcelain=v1 -z)`）、`FILE_EXISTS_AFTER_CANARY = NO`；非
  Git repo 场景验证等价固定 metadata snapshot；执行一次 rollback 演练并对比
  Workspace 前后状态与控制面四项恢复（primary-workspaces.json mapping、Agent
  Definition membership、Binding、停用自动化使用）。
- Expected: cutover transaction 零 Workspace mutation；functional canary 是唯一
  Owner-authorized 可逆写入且 pre/post digest 一致；其余 85 个 Agent 在 canary 全绿
  前零接管；rollback 后只有控制面回到先前值且旧 runtime 保持关闭。
- Failure: 任意 Agent 先行/并行接管；canary 文件已存在仍覆盖；digest 不一致或伪造
  Git PASS；rollback 触碰文件或激活旧 runtime；rollback 遗漏任一控制面恢复项。

### ACC-OW-010 — PR #47 revision gate

- Contracts: `CTR-OW-011`
- Method: V3 accepted 后 review PR #47 revision 的增删清单，并核对两个 frozen
  conflicting binding keys 及五项 FORBIDDEN 处置被承接。
- Expected: curated import / 五文件限制 / copy-manifest migration / trusted
  replacement Workspace creation 全部删除；direct reuse / zero-copy / exact 86 /
  runtime exclusivity / same Feishu app / binding continuity / Build in Public
  canary 全部在场；conflict keys 未丢失。
- Failure: PR #47 保留与 V3 冲突语义、丢失冲突 key 处置，或在 V3 accepted 前自行
  扩大 authority / 开始 production apply。

### Contract coverage

| Contract | Acceptance |
|---|---|
| CTR-OW-001 | ACC-OW-002 |
| CTR-OW-002 | ACC-OW-003 |
| CTR-OW-003 | ACC-OW-004 |
| CTR-OW-004 | ACC-OW-005 |
| CTR-OW-005 | ACC-OW-006 |
| CTR-OW-006 | ACC-OW-007 |
| CTR-OW-007 | ACC-OW-008 |
| CTR-OW-008 | ACC-OW-003, ACC-OW-009 |
| CTR-OW-009 | ACC-OW-009 |
| CTR-OW-010 | ACC-OW-009 |
| CTR-OW-011 | ACC-OW-010 |
| CTR-OW-012 | ACC-OW-001 |

## 12. Alternatives and disposition

| Alternative | Disposition | Reason |
|---|---|---|
| Amend V2 to allow in-place reuse | REJECTED | 治理协议禁止 partial supersession；方向性反转需 whole replacement |
| Keep V2 + child exception for direct reuse | REJECTED | child 不能覆盖 parent 核心 semantics |
| Trusted replacement Workspace + curated import (V2 path) | REJECTED | Owner 2026-08-23 最终决定推翻 |
| Copy whole Workspace then clean | REJECTED | `ZERO_COPY = REQUIRED`；copy 本身被禁止 |
| Overlay / symlink farm / dual-write sync | REJECTED | `WORKSPACE_OVERLAY = NONE`；引入第二 authority 与一致性面 |
| Visibility filtering by extension/subtree/scanner | REJECTED | full visibility frozen |
| Takeover-time cleanup (cache/node_modules/secret-scan delete) | REJECTED | filesystem integrity frozen；安全治理独立 authority |
| Dual automated runtime during transition | REJECTED | 单自动 writer 强制；FAIL_LOUD |
| New Feishu app or appId change | REJECTED | binding continuity frozen |
| Overwrite/delete/reassign/auto-repair/fallback a frozen conflicting binding | REJECTED | CTR-OW-006 五项 FORBIDDEN |
| Session transcript / cron / runtime-state import in this authority | REJECTED | OUT_OF_SCOPE / FORBIDDEN；等待独立 authority |
| Fleet widening incl. `agt_cto-agent` | REJECTED | exact 86 bound frozen |
| All 86 in parallel | REJECTED | Build in Public first canary mandatory |
| Overwrite an existing canary file / forge Git status PASS | REJECTED | CTR-OW-009 mechanics frozen |
| Rollback that moves/restores files | REJECTED | 文件从未迁移 |
| Keep both V2 and V3 accepted | REJECTED | ambiguous Current Authority |
| Resurrect V1 as authority | REJECTED | V1 stays superseded；V3 是新的 fleet-bounded authority |
| Put workspace path into Agent Definition or Binding.workspace | REJECTED | CTR-OW-008 boundary frozen（path 唯一权威 = primary-workspaces.json） |
| Claim cross-Agent filesystem isolation is proven | REJECTED | `CROSS_AGENT_FILESYSTEM_ISOLATION = UNPROVEN`；adversarial isolation 需独立 authority |

## 13. Migration, compatibility, and rollback

### 13.1 Authority migration

本 round 只修改 proposed V3；V2 保持 accepted/current。V3 经独立 review + §4.2 原子
acceptance transaction 后成为 Current Authority；V2 superseded 并 backlink；V1 记录
不动。该 lifecycle transition 本身仍不授权任何 implementation 或 production 动作。

### 13.2 Runtime compatibility

Non-fleet（新建/默认）Agent 的 primary Workspace 语义不受本 Spec 影响，继续走既有
Trusted Runtime 途径。对 exact 86 Agent：primary Workspace = historical path（经
`primary-workspaces.json` → `resolveWorkspace(agentId)` 解析），one Agent one
Workspace、Workspace-local Memory、session cwd fail-loud 全部保持。旧 OpenClaw
runtime 全程保持停止；Owner interactive writes 不受影响。

### 13.3 Cutover and rollback

未来 cutover 只改控制面 metadata（§CTR-OW-008：primary-workspaces.json mapping、
Agent Definition membership、Binding、runtime ownership）；canary ordering 与机械化见
§CTR-OW-009；rollback 按四项恢复并停用（§CTR-OW-010）。不移动、不还原、不删除任何
Workspace 文件。若本 authority 本身需要逆转，用新的 whole-authority superseding
Spec；不得把 V2 静默翻回 accepted。

## 14. Open questions

```text
OPEN_OWNER_DECISIONS = NONE（ruling 已最终冻结）
NORMATIVE_TBD = NONE
IMPLEMENTATION_TBD = 未来 cutover runbook/实现细节（runtime-stopped 证明机制、runtime
  writer-count 检测、preflight 工具形态、非 Git repo metadata snapshot 形态）——不得
  弱化本 Spec 任何 Contract
PR47_REVISION = V3 accepted 后的独立 downstream task
PRODUCTION_APPROVAL = 独立 gate，本 Spec 不授予
```

## 15. Authoring boundary

```text
DOCS_ONLY = YES
CHANGED_FILES = docs/specs/AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3.md only
ROUND_1_HEAD = 0a0ce92729107726787cf84f467b77e00fae1185 (authoring)
ROUND_2 = Revision 1 amendment (复用 执行 amendment round; closes both 复用 审计 rounds)
V2_LIFECYCLE_CHANGE = NONE (reserved for the atomic acceptance transaction)
V1_LIFECYCLE_CHANGE = NONE
PR47_CHANGE = NONE (this round)
PRODUCT_CODE_CHANGE = NONE
WORKSPACE_FILE_CHANGE = NONE
AGENT_DEFINITION_CHANGE = NONE
BINDING_CHANGE = NONE
PRODUCTION_CHANGE = NONE
IMPLEMENTATION = NONE
ACCEPT_OR_MERGE = NO
PUBLISH = single fast-forward push to spec/agent-primary-workspace-openclaw-compat-v3 (PR #55); no force-push, no rebase, no second PR
VALIDATION = git diff --check / verify_governance.py / npm run verify:structure
NEXT_TASK = 复用 审计
```
