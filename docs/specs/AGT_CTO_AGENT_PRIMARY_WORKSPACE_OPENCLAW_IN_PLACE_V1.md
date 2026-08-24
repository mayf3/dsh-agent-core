---
spec_id: AGT_CTO_AGENT_PRIMARY_WORKSPACE_OPENCLAW_IN_PLACE_V1
status: accepted
accepted_date: 2026-08-23
accepted_by: mayf3
accepted_reviewed_base: 344975d1d6aa2ab560d2f213d4460d34c9f6ae60
accepted_reviewed_spec_commit: 06feadf95f196a4c9581d453c256362b5d9e5914
accepted_reviewed_spec_blob: 5b6ccef2add9ae602bc8168a3e324b4babdb11c3
primary_review: 总监 审计
primary_review_result: PASS
required_fixes: NONE
semantic_delta_after_review: NONE
date: 2026-08-23
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
scope:
  - single-Agent companion Workspace authority for agt_cto-agent only (out-of-roster boundary canary; V3/fleet exact-86 bound untouched)
  - direct in-place reuse of its exact historical OpenClaw Workspace via primary-workspaces.json (direct adopt in place, zero copy)
  - control-plane-only cutover transaction, Feishu binding continuity, and control-plane-only rollback
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_WORKSPACE_SESSION_MODEL_V2
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
references:
  - docs/specs/AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3.md (accepted fleet Workspace authority @f02691c; its exact-86 bound and agt_cto-agent exclusion are NOT modified by this Spec)
  - docs/specs/AGENT_TRUSTED_FLEET_CUTOVER_V1.md (accepted fleet cutover plan; merged into main at 344975d; agt_cto-agent explicitly outside the roster and preserved)
  - docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md (accepted; path-agnostic product model)
  - docs/specs/AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1.md (accepted; freezes the same conversation key / workspace path / session target facts, for model routing only)
  - docs/investigations/cto-workspace-mapping-plan-v1.md (frozen read-only investigation + immutable plan; every load-bearing value is embedded in this Spec)
  - docs/investigations/build-in-public-mapping-canary-plan-v1.md (single-Agent projection form reference)
---

# AGT_CTO_AGENT_PRIMARY_WORKSPACE_OPENCLAW_IN_PLACE_V1 — agt_cto-agent 原历史 OpenClaw Workspace 原地直接复用（单 Agent companion authority）

> **ACCEPTED / DOCS-ONLY / NO IMPLEMENTATION OR PRODUCTION AUTHORITY.**
>
> 本 Spec 是 **subject-bounded 的单 Agent companion authority**：唯一 subject 是
> `agt_cto-agent`（技术研发总监；OpenClaw agent id = `cto-agent`；V3 与 fleet cutover
> 的 exact 86 roster 之外的 out-of-roster boundary canary）。它授权该 Agent 的 primary
> Workspace **继续直接使用其原历史 OpenClaw Workspace**——不复制、不导入、不建立替代
> Workspace（`DIRECT_ADOPT_IN_PLACE = REQUIRED` / `ZERO_COPY = REQUIRED`）。
>
> 本 Spec **不是**对 accepted fleet authority 的 widening：`AGENT_PRIMARY_WORKSPACE_
> OPENCLAW_COMPATIBILITY_V3` 的 exact 86 bound 与 `agt_cto-agent` 排除条款原样保持；
> `AGENT_TRUSTED_FLEET_CUTOVER_V1`（已合入 main）不被修改；
> `EXACT_ROSTER_SHA256` 不变；`agt_cto-agent` 不加入 exact 86
> （`PR47_ROSTER_CHANGE = NONE`）。本 Spec 的 authority 来源是 Owner 对本 subject 的
> 单独指令（「总监 执行」task，2026-08-23），不是 V3 scope 的延伸。
>
> 本轮（authoring）：只写本 Spec 一个文件。不实现、不 production apply、不写
> `primary-workspaces.json`、不写 Binding、不 reload Runtime、不碰 `agents.json` /
> Workspace 文件 / Auth 对象、不 accept、不 merge。`status: proposed`、
> `implementation_authority: none`、`production_apply_authority: none` 是初始冻结状态，
> 不得由 authoring agent 自行翻转。
>
> **Acceptance-finalize（2026-08-23，「采纳 执行」round）**：独立「总监 审计」已在
> exact reviewed head `06feadf95f196a4c9581d453c256362b5d9e5914`（spec blob
> `5b6ccef2add9ae602bc8168a3e324b4babdb11c3`，reviewed base
> `344975d1d6aa2ab560d2f213d4460d34c9f6ae60` = PR #59 base = 当时 main，无漂移）给出
> PASS（REQUIRED_FIXES = NONE；BLOCKER_COUNT = 0）。authorized maintainer 据此以
> lifecycle-only / semantic delta NONE 的 acceptance-finalize 将本 Spec 变为 accepted
> candidate。Accepted 后 `implementation_authority = none`、
> `production_apply_authority = none` 保持不变：`IMPLEMENTATION_ALLOWED_NOW = NO`、
> `PRODUCTION_APPLY_ALLOWED_NOW = NO`；任何 implementation / production apply 仍需
> PR 合入 main 与各自独立的 execution / production approval round。

## 0. Authoring record

```text
TASK_NAME = 总监 执行
TASK_TYPE = 执行
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AGT_CTO_AGENT_PRIMARY_WORKSPACE_OPENCLAW_IN_PLACE_V1
STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCTION_APPLY_ALLOWED_NOW = NO
READY_FOR_INDEPENDENT_REVIEW = YES
NEXT_TASK = 总监 审计
```

Acceptance binding（2026-08-23 acceptance-finalize 冻结）：

```text
REVIEWED_BASE_COMMIT = 344975d1d6aa2ab560d2f213d4460d34c9f6ae60
REVIEWED_SPEC_COMMIT = 06feadf95f196a4c9581d453c256362b5d9e5914
REVIEWED_SPEC_BLOB = 5b6ccef2add9ae602bc8168a3e324b4babdb11c3
REVIEW_NAME = 总监 审计
REVIEW_RESULT = PASS
REQUIRED_FIXES = NONE
SEMANTIC_DELTA_AFTER_REVIEW = NONE
ACCEPTED_BY = mayf3
ACCEPTANCE_DELTA_CLASS = LIFECYCLE_ONLY
IMPLEMENTATION_PERFORMED = NO
PRODUCTION_CHANGE = NONE
```

上文 §0 Authoring record 块内的 `STATUS = proposed` 是 authoring round 的历史冻结记录，
保持原样；acceptance 后的当前状态以 frontmatter `status: accepted` 与本文件
Acceptance-finalize record 为准。

## 1. DEVELOPMENT_PREFLIGHT（改动第一行前已输出；此处存档）

```text
Problem            = agt_cto-agent 的 production primary Workspace 目前落在默认派生
                     fallback 目录（/Users/authsvc/.agent-core/workspaces/agt_cto-agent，
                     出厂种子、无任何历史内容），而其长期 AUTHORITATIVE OpenClaw
                     Workspace 仍在原路径未被接管
Governing Spec     = AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3（accepted，
                     Current Workspace authority）——但其 scope 冻结为 exact 86，
                     agt_cto-agent 被正文明确排除（CTR-OW-001 / FLEET_WIDENING
                     FORBIDDEN）；AGENT_TRUSTED_FLEET_CUTOVER_V1（accepted，main@344975d）
                     同样冻结 roster 不含 cto
Spec status        = 本 subject【无任何 accepted Spec 覆盖】→ Need new Spec = YES
                     （本文件，proposed）
Relevant investigations = cto-workspace-mapping-plan-v1（read-only 冻结 plan：五源交叉
                     exact path + identity digest + production 现状）
                     + build-in-public-mapping-canary-plan-v1（V3 单 Agent 投影形态参照）
Relevant decisions = AGENT_WORKSPACE_SESSION_MODEL_V2（one Agent one Workspace，
                     path-agnostic）；SCHEDULER_OCCURRENCE_OUTCOME_V2（scheduler 边界）
Previously rejected = V3 框内 fleet widening incl agt_cto-agent（FORBIDDEN，不重开——
                     本 Spec 不是 widening：subject 独立、roster / PR #47 / V3 零修改）；
                     curated copy（CURATED_IMPORT_V2 已 superseded，不重开）；
                     conversation workspace（6071dfd DO_NOT_ACCEPT，不重开）
Frozen boundaries  = PR47_ROSTER_CHANGE=NONE / EXACT_ROSTER_SHA256 不变；
                     OPENCLAW_RUNTIME_REUSE=NO / OPENCLAW_WORKSPACE_REUSE=YES；
                     DIRECT_ADOPT_IN_PLACE=REQUIRED / ZERO_COPY=REQUIRED；
                     PATH_AUTHORITY=primary-workspaces.json；Binding.workspace=null；
                     DSH_HOME_CHANGE=NONE；SESSION_TRANSCRIPT_MIGRATION=OUT_OF_SCOPE；
                     SCHEDULER_JOB_MIGRATION=OUT_OF_SCOPE；
                     OPENCLAW_RUNTIME_STATE_REUSE=FORBIDDEN；
                     本轮 production 零触碰、不 accept、不 merge
New evidence       = cto 调查：五源交叉 exact path + canary-canonical identity digest +
                     production 现状（fallback workspace 为出厂种子 / production
                     primary-workspaces.json ABSENT / binding MATCH（provenance+功能
                     证据）/ 历史 OpenClaw runtime 已停止 / DSH_HOME 已正确保留）
Need new/amended Spec = YES（本文件；本轮只写 Spec，不实现）
```

```text
North Star     = one Agent = one primary Workspace；本 subject 的 primary =
                 其原历史 OpenClaw Workspace 绝对路径（adopt in place）
First blocker  = 无 accepted authority 覆盖本 subject（V3/fleet 均明确排除）
Outside-Kernel = YES（控制面配置 + 部署侧 mapping 文件 + 既有 spawn env 通道）
Kernel needed  = NO
Special-casing = NONE（走既有 primary-workspaces.json 单一 seam，无产品代码分支）
```

## 2. Frozen subject and inputs（全部来自冻结调查，非猜测）

### 2.1 Subject identity

```text
AGENT_ID          = agt_cto-agent（技术研发总监）
OPENCLAW_AGENT_ID = cto-agent
SUBJECT_COUNT     = 1（本 Spec 唯一 subject；禁止任何第二个 Agent）
```

### 2.2 Exact historical Workspace 与 identity digest

```text
EXACT_HISTORICAL_WORKSPACE_PATH =
  /Users/yanfenma/.openclaw/groups/workspace-oc_648db8f3df0ef0249b761ebb0b7a56ab
BINDING_KEY = feishu:oc_648db8f3df0ef0249b761ebb0b7a56ab
EXACT_ROSTER_SHA256 = f046d18f76da838ba94775af7c960d0ee548f2e392c22e6c7b0e3add36cb8e5f
  (86；agt_cto-agent ∈ roster = FALSE —— 本 Spec 不改变该 digest、不加入 roster)
```

exact path 五源交叉一致（read-only，零名称猜测）：冻结 inventory（旧 USER runtime
deployment-owned mapping，87 entries，文件 sha256
`e3c27c39af8b6810f511caa4ef7bfad5f4fcb98b10cb47e13941bd5b296733ce`）；OpenClaw registry
（`~/.openclaw/openclaw.json` agents.list[43]，registry record sha256
`c8eb0b3da0742d5af3de4c81134227a6d08e5ab5c5a1474f0fe63a368c31e0f2`，canonical JSON）；
OpenClaw bindings[43]（match.peer.id `oc_648db8f3…` → `cto-agent`）；scheduler 迁移
冻结 inventory（`openclawAgentId=cto-agent / agentCoreAgentId=agt_cto-agent /
primaryWorkspace=同一路径`）；旧 USER runtime 实进程 env（PID 17922：
`DSH_AGENT_ID=agt_cto-agent` + `DSH_PRIMARY_WORKSPACE=同一路径` +
`DSH_HOME=/Users/authsvc/.agent-core/homes/agt_cto-agent`）。第六源：accepted
`AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1` §1 目标事实表冻结同一路径。

Workspace 实体核验（read-only）：真实目录（lstat 非 symlink；通过
`validatePrimaryWorkspaces` 同构检查）；mode 0700 uid 502(yanfenma) gid 20(staff)；
git worktree（`git -C <ws> rev-parse --show-toplevel` = `/Users/yanfenma/.openclaw`，
workspace 根无自有 `.git` 文件）；路径对 uid 502 child 可达；identity 文件齐全
（AGENTS.md / IDENTITY.md / SOUL.md / MEMORY.md / USER.md / HEARTBEAT.md / TOOLS.md，
OpenClaw workspace 形态）。

```text
WORKSPACE_IDENTITY_DIGEST = 042926010fb70cff6110124dabd8e6249944763645a421bfcf9690a0dd5355aa
```

canonical 文档（compact、sort_keys、UTF-8；canary-canonical 字段集，与
build-in-public canary plan §2.2 同集）：

```json
{"agent_id":"agt_cto-agent","agents_md_sha256":"6c444f213afd600db77a4af8e3c6e718aea529036bba8c5237f82970dc695c44","historical_conversation_key":"feishu:oc_648db8f3df0ef0249b761ebb0b7a56ab","historical_workspace_absolute_path":"/Users/yanfenma/.openclaw/groups/workspace-oc_648db8f3df0ef0249b761ebb0b7a56ab","identity_md_sha256":"3fa744bf13c40d4feaf7a00d03f2d8e13bdcea50d7fa92a8b449090f8bca0a58","inventory_primary_workspaces_sha256":"e3c27c39af8b6810f511caa4ef7bfad5f4fcb98b10cb47e13941bd5b296733ce","openclaw_agent_id":"cto-agent","openclaw_registry_record_sha256":"c8eb0b3da0742d5af3de4c81134227a6d08e5ab5c5a1474f0fe63a368c31e0f2","soul_md_sha256":"c64263052d2ab097c4ac93523353e11bf270b814cade55252542a8adfc98aee8"}
```

组成证据（read-only）：

```text
AGENTS.md   sha256 = 6c444f213afd600db77a4af8e3c6e718aea529036bba8c5237f82970dc695c44
IDENTITY.md sha256 = 3fa744bf13c40d4feaf7a00d03f2d8e13bdcea50d7fa92a8b449090f8bca0a58
SOUL.md     sha256 = c64263052d2ab097c4ac93523353e11bf270b814cade55252542a8adfc98aee8
MEMORY.md   sha256 = d67a75c98e2db73e41e75bb8be44c7d3d96bebcb0288ee22075251fb442ea9d3
  （MEMORY.md 记录用，不入 identity digest；其内容随 Agent 正常运行演化，
    不得用作接管前置相等性断言）
```

### 2.3 Production 当前状态输入（冻结证据基线，执行轮必须重新核实）

```text
CURRENT_WRONG_FALLBACK_WORKSPACE = /Users/authsvc/.agent-core/workspaces/agt_cto-agent
  （默认派生产物：primary-workspaces.json 缺席 -> resolveWorkspace(agentId) =
   <root>/workspaces/<agentId>；内容为 workspace-bootstrap 出厂种子（模板 AGENTS.md +
   MEMORY.md/memory/），无任何历史 workspace 内容 —— 纯 fallback，非迁移结果；
   保留作为 rollback 基线：不删除、不合并、不迁移）
CORRECT_RETAINED_DSH_HOME = /Users/authsvc/.agent-core/homes/agt_cto-agent
  （settings.yaml + profiles/agent-core-production + sessions/；DSH_HOME_CHANGE = NONE）
CURRENT_PRIMARY_WORKSPACES_PATH = /Users/authsvc/.agent-core/primary-workspaces.json
CURRENT_PRIMARY_WORKSPACES_SHA256 = ABSENT（调查轮直接访问 = ENOENT，真实不存在；
  注意：fleet cutover 执行轮可能先行创建该文件 —— 执行轮必须以实际 pre-state
  重定基线，见 CTR-CW-007/G4）
PRODUCTION_RUNTIME = authsvc 唯一 production runtime
  （node production-runtime.mjs --root /Users/authsvc/.agent-core --catchup 0；
  调查轮实测 pid 98184）
AGENTS_JSON = /Users/authsvc/.agent-core/agents.json -> symlink ->
  /usr/local/libexec/agent-core/config/agents.json（0600 authsvc；fleet restore 后
  FINAL_AGENT_DEFINITION_COUNT = 91；调查轮记录基线 sha256 =
  636cff614f0fa0e2655404bb06370cd0ee59cec07d85c990f7a356b6efb8fb3d，执行轮重新字节核实）
DEFINITION_PRESENT(agt_cto-agent) = true（trusted runtime 既有 out-of-roster boundary
  canary 之一：account-recovery delivery 记录其 identity + store entry + working mint；
  今日真实 spawn 反证）
CURRENT_BINDING_STATUS = MATCH（判定链 = 旧 USER store 同 key row + 2026-08-22 authsvc
  feishu cutover 生成 production store + PREBOUND_ONLY fail-closed 功能证据；调查轮 uid
  无法字节读取 production store（bindings 目录 0700 authsvc），执行轮必须 authsvc 侧
  byte-verify，见 CTR-CW-007/T2）
HISTORICAL_OPENCLAW_RUNTIME_RUNNING = NO（pgrep openclaw = 0；
  /Users/authsvc 下无 .openclaw）
DSH_HOME sessions = 6 个（main + 5×fresh-*），header cwd 全部 = fallback path
  （main createdAt 2026-08-22T15:24:15；最近 turn 2026-08-23T17:41 飞书切换测试）
```

### 2.4 冻结目标控制面 artifacts（执行轮写入物）

```text
PROPOSED_MAPPING_ENTRY =
  {"agt_cto-agent":"/Users/yanfenma/.openclaw/groups/workspace-oc_648db8f3df0ef0249b761ebb0b7a56ab"}
PROPOSED_MAPPING_ENTRY_SHA256 = 1ce350e03a74baa3c4453589b1cde3f1fb44bb6aa1ddad7838a0eeb31e3b3005

PROPOSED_FILE（仅当 pre-state = ABSENT 时的整文件首建形态：单条目、2-space JSON +
trailing newline、104 bytes）：
{
  "agt_cto-agent": "/Users/yanfenma/.openclaw/groups/workspace-oc_648db8f3df0ef0249b761ebb0b7a56ab"
}
PROPOSED_FILE_SHA256 = 2814c909d3f4597e78f2647a7df60be2d3a42e87e8d37e7bf00bbe043c35e659

PROPOSED_BINDING_ROW（冻结字段；updatedAt 为 runtime-owned 不参与 hash）：
{"channelConversationId":"feishu:oc_648db8f3df0ef0249b761ebb0b7a56ab","activeAgentId":"agt_cto-agent","activeSessionId":"main","workspace":null}
PROPOSED_BINDING_ROW_SHA256 = 7f11e541c08cc7b48a86935ce7fd4b5797b084488dee27e888ca124b1f4fbff9
语义：仅确保 workspace = null（historical path 永不写入 Binding.workspace）；
等价目标 -> NOOP。

冻结冲突 binding key（零触碰）：
feishu:oc_92332c45c1cac2ef89857abfee8ed762
feishu:oc_9dd74b9ed02ce216951260a381eb502d

REQUIRED_RELOAD_MODE = CONTROLLED_RUNTIME_RESTART
  seam = sudo launchctl kickstart -k system/ai.agent-core.runtime
  （mapping 与 Definition 仅在 compose 时一次性加载，无热 reload seam）
```

## 3. Goal

把 Owner 对本 subject 的裁定冻结为 repository authority：`agt_cto-agent` 的 primary
Workspace **就是**其原历史 OpenClaw Workspace 绝对路径，Agent Core 接管运行职责后
原地直接继续使用：

```text
OPENCLAW_RUNTIME_REUSE  = NO
OPENCLAW_WORKSPACE_REUSE = YES

DIRECT_ADOPT_IN_PLACE = REQUIRED
ZERO_COPY             = REQUIRED

WORKSPACE_COPY        = NONE
WORKSPACE_IMPORT      = NONE
WORKSPACE_OVERLAY     = NONE
WORKSPACE_PATH_CHANGE = NONE

HISTORICAL_WORKSPACE_BECOMES_PRIMARY  = YES
HISTORICAL_WORKSPACE_READ_ONLY_SOURCE = NO
```

实现形态（与 accepted V3 的 fleet 模型逐项同构，仅 subject 不同）：

```text
PATH_AUTHORITY = primary-workspaces.json
PATH_SCHEMA    = agt_cto-agent -> exact historical OpenClaw absolute path
唯一解析链：
primary-workspaces.json
→ production-runtime
→ workspace-bootstrap.primaryWorkspaces
→ resolveWorkspace(agt_cto-agent)
→ child cwd / DSH_PRIMARY_WORKSPACE
（Binding.workspace = null → Default Primary Workspace Rule → resolveWorkspace）

Binding.workspace                     = null（historical path 永不写入）
AGENT_DEFINITION_WORKSPACE_PATH_FIELD = FORBIDDEN
DSH_HOME_CHANGE                       = NONE
SESSION_TRANSCRIPT_MIGRATION          = OUT_OF_SCOPE
SCHEDULER_JOB_MIGRATION               = OUT_OF_SCOPE
OPENCLAW_RUNTIME_STATE_REUSE          = FORBIDDEN
```

接管后：child cwd / `DSH_PRIMARY_WORKSPACE` = exact path；DSH 以 cwd 派生 session
存储目录 → main session 在 exact path 下开新 trajectory；fallback Workspace 内既有
main trajectory 原样保留在原目录（不合并、不迁移、不删除）；旧 AGENTS.md、
MEMORY.md、`memory/`、Git repository 对 child 立即可见并继续原样使用。

## 4. Scope and non-goals

### 4.1 In scope

- 冻结本 Spec：`agt_cto-agent` 单 subject 的 primary Workspace in-place 接管 authority；
- exact mapping 写入 production `primary-workspaces.json`（未来执行轮，非本轮）；
- controlled Runtime restart 与接管后可见性 / 真实飞书回复验证；
- 控制面-only rollback；
- 与 fleet authority 的边界声明（roster / PR #47 / V3 零修改）。

### 4.2 Non-goals / forbidden（本轮与本 authority 边界）

```text
PRODUCT_CODE_CHANGE        = NONE（本轮；本 authority 不要求任何产品代码改动）
PR47_ROSTER_CHANGE         = NONE（agt_cto-agent 不加入 exact 86；
                             EXACT_ROSTER_SHA256 不变；PR #47 已 merge，历史事实不改）
EXACT_ROSTER_SHA256        = f046d18f…（不变）
PRIMARY_WORKSPACES_CHANGE  = NONE（本轮）
BINDING_CHANGE             = NONE（本轮）
RUNTIME_RELOAD             = NO（本轮）
AGENTS_JSON_CHANGE         = NONE（本 authority 全程 verify-only）
WORKSPACE_FILE_CHANGE      = NONE（本轮 AND 未来接管 transaction 期间）
AUTH_CHANGE                = NONE（零读零写 Principal/Client/Credential/Grant/Auth DB）
FLEET_WIDENING             = FORBIDDEN（本 Spec 唯一 subject = agt_cto-agent；
                             不得用于任何第二个 Agent）
V3_CHANGE                  = NONE（V3 及其 exact-86 bound / cto 排除条款原样保持）
ACCEPT_OR_MERGE            = FORBIDDEN_THIS_ROUND（authoring agent 不得自行 accepted）
OPENCLAW_RUNTIME_REUSE     = NO
OPENCLAW_SESSION_TRANSCRIPT_REUSE = OUT_OF_SCOPE
OPENCLAW_CRON_JOB_REUSE    = OUT_OF_SCOPE
OPENCLAW_RUNTIME_STATE_REUSE     = FORBIDDEN
FALLBACK_WORKSPACE_MIGRATION     = FORBIDDEN（不合并/不回写/不因接管删除）
SECRET_CLEANUP             = separate follow-up（Workspace 内历史隐藏文件不读不写不删）
SCHEDULER_CHANGE           = OUT_OF_SCOPE（沿 SCHEDULER_OCCURRENCE_OUTCOME_V2 既有线）
NOTIFICATION_AUTH_CHANGE   = OUT_OF_SCOPE
```

## 5. Authority and dependencies

### 5.1 Authority map

```text
Repository governance       = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0 (accepted)
Workspace product model     = AGENT_WORKSPACE_SESSION_MODEL_V2 (accepted decision; path-agnostic)
Fleet workspace authority   = AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3
                              (accepted @f02691c，merged at 6ec83fa —— 不因本 Spec 修改)
Fleet cutover plan          = AGENT_TRUSTED_FLEET_CUTOVER_V1
                              (accepted @eb2189c，merged into main at 344975d，
                               agt_cto-agent 明确 roster 外且保留 —— 不因本 Spec 修改)
Subject workspace authority = AGT_CTO_AGENT_PRIMARY_WORKSPACE_OPENCLAW_IN_PLACE_V1
                              (本 Spec，proposed —— 生效前无任何 authority)
Model routing（相邻线）     = AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1 (accepted；
                              只授 model-routing，不授 workspace 接管)
Scheduler authority line    = SCHEDULER_OCCURRENCE_OUTCOME_V2 (accepted decision；边界引用)
Exact path authority        = primary-workspaces.json (deployment-owned；§2.4/§3)
```

### 5.2 与 V3 / fleet authority 的关系（非 widening 声明）

- V3 `CTR-OW-001` 与 fleet Spec 均冻结 exact 86 并明确排除 `agt_cto-agent`；
  本 Spec **不修改、不放宽、不借道**该 bound；
- 本 Spec 是 Owner 对 roster **之外**单个既有 trusted-runtime boundary canary 的
  单独授权：`AGENT_TRUSTED_FLEET_CUTOVER_V1` 正文自身即要求
  "`agt_cto-agent` 继续不属于 exact 86 cutover roster，但不得因本任务删除它"——
  本 Spec 与该要求一致（不删、不改、不并入）；
- 两 authority 并行不冲突：fleet 线负责 exact 86（canary → 审计 → 85），本 Spec 只
  负责 `agt_cto-agent`；任一线的执行不阻塞另一线，但共享同一 production
  `primary-workspaces.json` 文件时必须遵守 CTR-CW-007 的 pre-state 重定基线与原子
  合并约束；
- 本 Spec 不 supersede 任何既有 Spec（`supersedes: []`）；若未来方向逆转，用新的
  whole-authority superseding Spec 处理。

### 5.3 Implementation / production gates

本 Spec `proposed` 阶段：`IMPLEMENTATION_ALLOWED_NOW = NO`、
`PRODUCTION_APPLY_ALLOWED_NOW = NO`。任何 production 写入（mapping / restart）必须
同时满足：

1. 本 Spec 经独立 review（总监 审计）并由 authorized maintainer 合法 accepted，
   且 accepted snapshot 进入 main；
2. `implementation_authority` / `production_apply_authority` 由该 acceptance
   transaction 按其自身记录决定（authoring 冻结为 none / none，不得由执行 agent
   自行翻转）；
3. 独立 production run approval / runbook gate；
4. 执行轮以实际 pre-state 重定基线（§2.3 / CTR-CW-007 G4），不假设调查轮快照仍然
   成立。

缺一项即 `PRODUCTION_APPLY_ALLOWED = NO`。

## 6. Contracts

### CTR-CW-001 — Single subject identity and immutable binding

唯一 eligible subject 是 `agt_cto-agent`（`OPENCLAW_AGENT_ID = cto-agent`）。以下
immutable binding 必须逐字节成立，任何一项不符即在 mutation 前 fail：

```text
agent_id                    = agt_cto-agent
historical_workspace_path   = /Users/yanfenma/.openclaw/groups/workspace-oc_648db8f3df0ef0249b761ebb0b7a56ab
workspace identity evidence = WORKSPACE_IDENTITY_DIGEST 042926010f…355aa（§2.2）
binding key                 = feishu:oc_648db8f3df0ef0249b761ebb0b7a56ab
```

并保持：

```text
EXACT_AGENT_ID        = unchanged
EXACT_WORKSPACE_PATH  = unchanged
EXACT_FEISHU_BINDING  = unchanged
PR47_ROSTER_CHANGE    = NONE
EXACT_ROSTER_SHA256   = f046d18f…（不变；agt_cto-agent 不加入 exact 86）
```

本 authority 不得用于任何第二个 Agent；不得动态发现、扫描、自动新增 subject。

### CTR-CW-002 — Direct adopt in place; zero copy; exact path authority

```text
DIRECT_ADOPT_IN_PLACE = REQUIRED
ZERO_COPY             = REQUIRED
WORKSPACE_COPY / IMPORT / OVERLAY / PATH_CHANGE = NONE
HISTORICAL_WORKSPACE_BECOMES_PRIMARY  = YES
HISTORICAL_WORKSPACE_READ_ONLY_SOURCE = NO
```

- exact mapping 只写入 production `primary-workspaces.json`
  （`PATH_AUTHORITY`；`PATH_SCHEMA = agt_cto-agent -> exact historical absolute path`）；
- 唯一解析链 = `primary-workspaces.json → production-runtime →
  workspace-bootstrap.primaryWorkspaces → resolveWorkspace(agt_cto-agent) →
  child cwd / DSH_PRIMARY_WORKSPACE`（§3）；
- `AGENT_DEFINITION_WORKSPACE_PATH_FIELD = FORBIDDEN`（Definition 全程 verify-only：
  不创建、不修改、不写 path；只允许既有 identity+display 字段）；
- `Binding.workspace = null` → Default Primary Workspace Rule →
  `resolveWorkspace(agentId)`；不得把 historical path 写入 `Binding.workspace`；
  不得 fallback 新 Workspace；不得动态猜测路径；
- `DSH_HOME_CHANGE = NONE`：dshHome 侧照旧
  `/Users/authsvc/.agent-core/homes/agt_cto-agent`（Agent Core control-plane 独立）；
- fallback Workspace `/Users/authsvc/.agent-core/workspaces/agt_cto-agent` =
  TEST_ONLY fallback 产物：保留为 rollback 基线，不删除
  （`DELETE_REQUIRED_FOR_CUTOVER = NO`）、不合并、不回写、不覆盖
  （merge/回写/覆盖 = FORBIDDEN；删除 = 单独 cleanup，不在本 authority）；
- 因不存在内容复制，本 authority 下不存在 migration allowlist / manifest。

### CTR-CW-003 — Complete visibility; filesystem integrity during takeover（继承 V3 CTR-OW-003/004 单 Agent 语义）

整个 historical Workspace 原地保留、全量可见（source/scripts/projects/memory/docs/
materials/data/archives/media/executables/git metadata/hidden files，类别不受限）；
不得以 extension/subtree/scanner 过滤可见性；不得通过移动/隐藏/删除/不复制文件实现
安全控制。接管 transaction 期间对 Workspace 零内容/零元数据变更：

```text
CHMOD_CHOWN_WORKSPACE / DELETE_OR_REWRITE / CACHE_NODE_MODULES_CLEANUP /
STRIP_EXECUTABLE_BIT / SYMLINK_EXPANSION / HARDLINK_FLATTEN /
GIT_METADATA_MODIFY / AUTO_FORMAT / SECRET_SCAN_THEN_DELETE / MIRROR_COPY
  = 全部 FORBIDDEN
SYMLINK_FOLLOW_ALLOWED_AND_OWNER_ACCEPTED = YES（接管不创建/展开/改写/删除既有
  symlink/hardlink；Agent 工具沿用既有 OS/tool follow 行为；不宣称
  PATH_ESCAPE_IMPOSSIBLE；不授权新建 symlink）
CROSS_AGENT_FILESYSTEM_ISOLATION = UNPROVEN（cooperative shared-host trust domain；
  本 Spec 不新增 per-Agent OS UID / filesystem sandbox）
OWNER_INTERACTIVE_WRITES = ALLOWED（Finder/IDE/Git/本地工具/手工编辑不算第二个
  Runtime，永不触发 FAIL_LOUD）
```

Agent 正常运行中的正常读写（含其自身 git 操作）不受本条限制；本条约束的是 takeover
机制本身。接管前只允许 read-only metadata / preflight 检查。

### CTR-CW-004 — Exclusive runtime ownership; runtime state boundary

```text
OPENCLAW_RUNTIME_REUSE = NO
HISTORICAL_OPENCLAW_RUNTIME_MUST_REMAIN_STOPPED = YES
AGENT_CORE_IS_SOLE_RUNTIME = YES
```

切换前必须证明（fail-loud）：

```text
HISTORICAL_OPENCLAW_RUNTIME_RUNNING      = NO
HISTORICAL_OPENCLAW_RUNTIME_WRITER_COUNT = 0
```

切换后：`AGENT_CORE_AUTOMATED_RUNTIME_WRITER = at most 1 active generation`。检测到
旧 runtime 自动 writer 或未知自动 writer → `FAIL_LOUD`，不得接管。

```text
OPENCLAW_RUNTIME_STATE_REUSE = FORBIDDEN
（不导入 OpenClaw runtime state / retry state；无 catch-up；无历史运行语义继承）
```

### CTR-CW-005 — Feishu continuity; binding verify-only with fail-closed conflicts

复用当前已由 Agent Core production 使用的原 OpenClaw Feishu app：

```text
NEW_APP / APP_ID_CHANGE = FORBIDDEN
same app · same conversation key · same agent_id · same group entry
```

Binding 处置（fail-closed）：

```text
预期 row（冻结字段，§2.4）：
  channelConversationId = feishu:oc_648db8f3df0ef0249b761ebb0b7a56ab
  activeAgentId         = agt_cto-agent
  activeSessionId       = main
  workspace             = null
处置 = 先 authsvc 字节验证（verify-only）；row 缺席 / activeAgentId != agt_cto-agent /
  key 冲突 -> BINDING_CONFLICT STOP（绝不 overwrite/delete/reassign/auto-repair/
  fallback）；row 已等价（workspace 已为 null）-> NOOP
冻结冲突 key（零触碰，五项 FORBIDDEN：OVERWRITE/DELETE/REASSIGN/AUTO_REPAIR/
  FALLBACK）：
  feishu:oc_92332c45c1cac2ef89857abfee8ed762
  feishu:oc_9dd74b9ed02ce216951260a381eb502d
端到端证明 = 从原飞书会话经恢复后 Binding + basic runtime path 发真实 basic reply；
  mock / bearer / direct-call / alternate Agent / grant-dependent reply 不算证据
  （credential readiness 可先 read-only verify，创建/修复属外部 auth 线）。
```

### CTR-CW-006 — Session transcript / scheduler migration boundary

```text
SESSION_TRANSCRIPT_MIGRATION = OUT_OF_SCOPE
SCHEDULER_JOB_MIGRATION      = OUT_OF_SCOPE
（不导入 OpenClaw transcript / cron history / scheduler jobs；沿
 SCHEDULER_OCCURRENCE_OUTCOME_V2 既有 authority line，本 Spec 不新增、不启用任何
 scheduler job）
```

Session 语义（既有产品语义，无新增机制）：

- mapping 生效后新 session 的 `session.header.cwd` 冻结为 exact path；main session
  在新目录开新 trajectory；
- fallback Workspace 内既有 trajectory（main + fresh-*）原样保留在原目录，不合并、
  不迁移、不删除；
- 以 fallback cwd 冻结的既有 session 在接管后 resume = 既有 cwd-mismatch 结构化拒绝
  （fail-loud，无静默 remap）——预期行为，不建 remap/migration。

### CTR-CW-007 — Pre-production transaction（staged immutable order；任一步 FAIL -> STOP）

GATES（任何写之前全部通过）：

```text
G1 DEFINITION_VERIFY_ONLY   authsvc 字节验证 agents.json（现状 Definition）；
                             definition_present(agt_cto-agent) = true；
                             绝不创建/修改/写 path 字段
G2 EXACT_PATH_VERIFY        read-only：stat = 现存目录、lstat 非 symlink；
                             WORKSPACE_IDENTITY_DIGEST == 042926010f…355aa；
                             path 仅来自冻结 authority 输入（§2.2），零猜测
G3 RUNTIME_OWNERSHIP        HISTORICAL_OPENCLAW_RUNTIME_RUNNING = NO；
                             WRITER_COUNT = 0；authsvc 唯一 production runtime；
                             否则 FAIL_LOUD 不接管（OWNER_INTERACTIVE_WRITES 永远
                             ALLOWED）
G4 STATE_BASELINE           production primary-workspaces.json 实际 pre-state 重定
                             基线（调查轮 = ABSENT；若 fleet 线已先行建文件，改为在
                             既有文件上原子合并本条目并重算整文件 digest）；
                             Binding row authsvc 字节验证 = §2.4 预期（否则
                             BINDING_CONFLICT STOP）；两个冻结冲突 key 零触碰
```

TRANSACTION（顺序不可弱化）：

```text
T1 authsvc 字节验证 agents.json 中 agt_cto-agent Definition（G1）
T2 authsvc 字节验证当前 Binding row（G4 判据）
T3 写 exact mapping：owner authsvc:authsvc · mode 0600 · temp + atomic rename ·
   no-clobber · fail-loud；写入前 authsvc 预检 validatePrimaryWorkspaces
   （非法条目会使整个 runtime 启动期 PRIMARY_WORKSPACE_INVALID fail-loud）；
   pre-state ABSENT -> 整文件首建 = PROPOSED_FILE（sha256 2814c909…，104 bytes）；
   pre-state 已存在 -> 仅原子合并 cto 单条目（PROPOSED_MAPPING_ENTRY sha256
   1ce350e0…）并重算整文件 digest
T4 Binding workspace=null 确认（等价 -> NOOP；冲突 -> BINDING_CONFLICT STOP；
   updatedAt runtime-owned；冲突 key 零触碰）
T5 controlled Runtime restart（REQUIRED_RELOAD_MODE =
   sudo launchctl kickstart -k system/ai.agent-core.runtime；无热 reload seam）
T6 验证 runtime 可见 mapping：resolveWorkspace(agt_cto-agent) == exact path；
   child cwd / DSH_PRIMARY_WORKSPACE == exact path
T7 验证旧 Workspace 内容可见：旧 AGENTS.md、MEMORY.md、memory/、Git repository
   对 child 可见（identity digest 按 §2.2 复核；MEMORY.md 记录型比对，不做内容
   相等性断言）
T8 原飞书会话（feishu:oc_648db8f3df0ef0249b761ebb0b7a56ab）真实 basic reply
   （CTR-CW-005 证据口径）
T9 exact rerun = NOOP（幂等重跑：mapping 已存在 -> verify-only；binding 已 null ->
   NOOP；不产生第二次 mutation、不重复消息）
```

任一步 FAIL → STOP（已写入部分可按 CTR-CW-008 回滚或保位待审，须在执行记录中
显式声明）。

### CTR-CW-008 — Rollback is control-plane only

```text
R1 primary-workspaces.json 恢复 pre-apply 状态（ABSENT 基线 -> 删除 cto 条目/文件；
   已有文件基线 -> 移除 cto 条目并保留其余字节内容）
R2 Binding row 恢复 pre-apply 字节（预期 pre-state 已 workspace=null -> NOOP）
R3 controlled restart（同一 kickstart seam）
R4 停止 Agent Core 对 agt_cto-agent 的自动化使用
禁止：移动/还原/删除任何 Workspace 文件（文件从未迁移）；重启历史 OpenClaw
  runtime；触碰两个冻结冲突 binding key；删除 pre-existing trusted state；
  删除/改写 fallback Workspace。
```

### CTR-CW-009 — Authority and production gates

本 Spec `proposed` 阶段零 authority：不授权任何 implementation / production 动作。
accepted 后 production apply 仍需 §5.3 全部条件 + 独立 production approval。本
authoring round：只新增本 Spec 一个文件；不修改 V3 / fleet Spec / PR #47 / 产品代码；
不读写 production；不 accept、不 merge。

## 7. Current State

- `STATE-CW-001` — production `agt_cto-agent` child cwd = 默认派生 fallback
  Workspace `/Users/authsvc/.agent-core/workspaces/agt_cto-agent`（出厂种子内容，
  无历史 workspace 内容）。Basis: `OBS-CW-001`。observed at 2026-08-23。
- `STATE-CW-002` — production `primary-workspaces.json` =
  `/Users/authsvc/.agent-core/primary-workspaces.json` = ABSENT（调查轮基线；
  执行轮必须重核）。Basis: `OBS-CW-001`。observed at 2026-08-23。
- `STATE-CW-003` — binding key `feishu:oc_648db8f3df0ef0249b761ebb0b7a56ab` 判定
  MATCH（provenance + PREBOUND_ONLY 功能证据；production store 字节未读——
  0700 authsvc）。Basis: `OBS-CW-002`。observed at 2026-08-23。
- `STATE-CW-004` — `agt_cto-agent` Definition 存在于 production agents.json
  （FINAL_AGENT_DEFINITION_COUNT = 91；out-of-roster boundary canary）。Basis:
  `OBS-CW-003`。observed at 2026-08-23。
- `STATE-CW-005` — 唯一 production runtime = authsvc（`--root
  /Users/authsvc/.agent-core --catchup 0`）；历史 OpenClaw runtime 未运行；
  DSH_HOME `/Users/authsvc/.agent-core/homes/agt_cto-agent` 已正确保留。Basis:
  `OBS-CW-004`。observed at 2026-08-23。
- `STATE-CW-006` — 本 authoring round 不改变任何 authority、production state、
  Workspace 文件或产品代码。Basis: direct Git changed-file boundary and this Spec
  status。

## 8. Observations

### OBS-CW-001 — Fallback workspace + mapping absent（production 现状，调查轮 §3.1/3.2）

- Subject: production authsvc runtime `agt_cto-agent` workspace 状态
- Source: docs/investigations/cto-workspace-mapping-plan-v1.md §3.1–3.2（read-only：
  DSH_HOME 6 sessions header cwd、session 目录名、compose.js:131-156、
  workspace-bootstrap lookupPrimaryWorkspace）
- Environment: /Users/authsvc/.agent-core（production root）
- Observed at: 2026-08-23
- Method: read-only session header / stat / 源码语义核对
- Result: child cwd = fallback 派生目录（出厂种子）；
  primary-workspaces.json = ABSENT → 所有 agent 走默认派生
- Provenance: 调查轮冻结快照（执行轮须重核）

### OBS-CW-002 — Binding MATCH（provenance + 功能证据）

- Subject: production binding store row[feishu:oc_648db8f3…]
- Source: 旧 USER store 同 key row（frozen）+ 2026-08-22 authsvc feishu cutover 生成
  production store（调查轮 sha256
  `e821610796cee70eb509b2a26ada8c56f2e8ddb2a568d5b9045cdc776208ca31`，其后多次快照
  byte-identical）+ V2 ingress PREBOUND_ONLY（v2-ingress-gate.js:76-79）功能反证
- Environment: production bindings store（0700 authsvc）
- Observed at: 2026-08-23
- Method: provenance chain + fail-closed 功能证据（真实群消息驱动多次回复成立）
- Result: row 存在且 activeAgentId = agt_cto-agent（判定；字节级验证留给执行轮 T2）
- Provenance: 调查轮 §3.3

### OBS-CW-003 — Definition present（verify-only 事实）

- Subject: production agents.json
- Source: agents.json symlink → /usr/local/libexec/agent-core/config/agents.json
  （0600 authsvc；调查轮基线 sha256 `636cff61…`，mtime 2026-08-23 16:13:27，
  91 agents）；account-recovery delivery（only out-of-roster canaries
  agt_stock_agent / agt_cto-agent have identities + store entries + working mints）；
  今日真实 spawn 反证
- Environment: production root
- Observed at: 2026-08-23
- Method: symlink/权限核实 + 文档 provenance + 真实 spawn 功能证据
- Result: definition_present(agt_cto-agent) = true（字节验证留给执行轮 T1）
- Provenance: 调查轮 §3.4 + canary plan §3.1

### OBS-CW-004 — Runtime / DSH_HOME / OpenClaw runtime 状态

- Subject: production runtime 进程拓扑
- Source: ps/pgrep 核实（authsvc runtime 运行中；pgrep openclaw = 0；
  /Users/authsvc 下无 .openclaw；yanfenma 侧仅 isolated-root mobile canary）
- Environment: production host
- Observed at: 2026-08-23
- Method: 进程枚举（read-only）
- Result: 唯一 production runtime = authsvc；HISTORICAL_OPENCLAW_RUNTIME_RUNNING = NO；
  DSH_HOME 保留完好
- Provenance: 调查轮 §3.4

### OBS-CW-005 — V3/fleet authority 均不覆盖本 subject

- Subject: repository authority 覆盖面
- Source: `docs/specs/AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3.md`
  （CTR-OW-001 exact 86；§3.2 FLEET_WIDENING FORBIDDEN incl agt_cto-agent）+
  `docs/specs/AGENT_TRUSTED_FLEET_CUTOVER_V1.md`（roster 冻结；"agt_cto-agent
  继续不属于 exact 86 cutover roster，但不得因本任务删除它"）
- Environment: origin/main@344975d
- Observed at: 2026-08-23
- Method: inspect accepted authority text
- Result: 本 subject 的 in-place 接管无 accepted Spec 覆盖 → 需要本 companion
- Provenance: 本轮 source-verified

## 9. Claims and assumptions

### CLM-CW-001 — 本 subject 需要独立 companion authority，且不能经 V3/fleet 授权

- Support state: SUPPORTED
- Supported by: `EVD-CW-001`
- Contradicted by: none known
- Uncertainty: none（V3/fleet 文本明确排除；治理禁 partial supersession）。

### CLM-CW-002 — exact path 与 identity 冻结可靠

- Support state: SUPPORTED
- Supported by: `EVD-CW-002`
- Contradicted by: none known
- Uncertainty: MEMORY.md 等运行文件持续演化——identity digest 只含稳定 identity
  文件 + registry/inventory 记录；执行轮 G2 复核时若 identity 文件本身被 Owner
  编辑过，按 OWNER_INTERACTIVE_WRITES = ALLOWED 处理并以实际 digest 重定基线记录，
  不得 FAIL_LOUD 阻断 Owner 手工写入。

### CLM-CW-003 — binding MATCH 判定足以支撑 verify-only transaction（不是 apply 依据）

- Support state: INFERRED
- Supported by: `EVD-CW-003`
- Contradicted by: none known
- Uncertainty: production store 字节未读（权限）；已由 T2 fail-closed byte-verify +
  BINDING_CONFLICT STOP 收敛——判定错误的最坏后果是执行轮 STOP，不会错误写入。

Open authority-changing assumptions: **NONE**（全部 load-bearing 输入已冻结于 §2；
执行差异由 G-gates fail-closed 收敛）。

## 10. Evidence relations

### EVD-CW-001 — Authority 文本支持 companion 必要性

- Source observations: `OBS-CW-005`
- Target: `CLM-CW-001`, §5.2
- Relation: SUPPORTS
- Strength: direct accepted authority text（V3 + fleet spec，main@344975d）
- Limitation: 无

### EVD-CW-002 — 冻结调查支持 exact path / digest 可靠性

- Source observations: `OBS-CW-001`, `OBS-CW-004`
- Target: `CLM-CW-002`, `STATE-CW-001/002/005`
- Relation: SUPPORTS
- Strength: 五源交叉 + accepted 第六源（CHATGPT_SUBSCRIPTION_PROVIDER_V1 目标事实表）
- Limitation: 调查轮快照；执行轮 G2/G4 重核

### EVD-CW-003 — Provenance + 功能证据支持 binding MATCH 判定

- Source observations: `OBS-CW-002`
- Target: `CLM-CW-003`, `STATE-CW-003`
- Relation: SUPPORTS
- Strength: 双 provenance + PREBOUND_ONLY fail-closed 反证
- Limitation: 非字节级；T2 收敛

### EVD-CW-004 — Runtime/Definition 现状支持 G-gates 可满足

- Source observations: `OBS-CW-003`, `OBS-CW-004`
- Target: `STATE-CW-004/005`, CTR-CW-004 G3
- Relation: SUPPORTS
- Strength: 进程/权限/文档三源
- Limitation: 时点快照；执行轮重证

## 11. Decisions

### DEC-CW-001 — 单 Agent companion，而非 V3 widening / amend

- Decision owner: mayf3
- Selected direction: 新建本独立 single-subject authority；V3 / fleet / PR #47 /
  roster 零修改。
- Rejected: widen V3 scope；amend V3；把 cto 塞进 exact 86；借 fleet runbook 顺带处理。
- Reason: V3/fleet 的 exact-86 bound 是 accepted 冻结；本 subject 是 roster 外既有
  trusted-runtime boundary canary，Owner 单独授权。
- Owner input remaining: NONE.

### DEC-CW-002 — 逐项采用 V3 冻结模型（direct adopt in place / zero copy / path authority）

- Decision owner: mayf3
- Selected direction: `OPENCLAW_RUNTIME_REUSE=NO / OPENCLAW_WORKSPACE_REUSE=YES /
  DIRECT_ADOPT_IN_PLACE=REQUIRED / ZERO_COPY=REQUIRED`；
  `PATH_AUTHORITY=primary-workspaces.json`；`Binding.workspace=null`；
  `AGENT_DEFINITION_WORKSPACE_PATH_FIELD=FORBIDDEN`；`DSH_HOME_CHANGE=NONE`。
- Rejected: copy / curated import / overlay / symlink farm / dual-write；path 写入
  Definition 或 Binding；fallback 新 Workspace；动态猜测路径。
- Reason: 与 fleet 同构的最小机械路径（既有 workspace-bootstrap 单一 seam，零产品
  分支）。
- Owner input remaining: NONE.

### DEC-CW-003 — Roster / PR #47 边界

- Decision owner: mayf3
- Selected direction: `PR47_ROSTER_CHANGE = NONE`；`EXACT_ROSTER_SHA256` 不变；
  `agt_cto-agent` 不加入 exact 86；fleet 线与本线并行、互不修改。
- Rejected: roster 扩张；动态发现；借本 Spec 处理任何其他 Agent。
- Reason: accepted fleet authority 的冻结边界。
- Owner input remaining: NONE.

### DEC-CW-004 — Transcript / scheduler / runtime-state 全部不迁移

- Decision owner: mayf3
- Selected direction: `SESSION_TRANSCRIPT_MIGRATION=OUT_OF_SCOPE`；
  `SCHEDULER_JOB_MIGRATION=OUT_OF_SCOPE`；`OPENCLAW_RUNTIME_STATE_REUSE=FORBIDDEN`。
- Rejected: bundle import、auto catch-up、retry-state 继承、顺带启用 scheduler jobs。
- Reason: workspace 复用只授权文件层，不授权历史运行语义。
- Owner input remaining: NONE.

### DEC-CW-005 — 9 步 staged transaction；端到端证明 = 真实飞书回复（不建 V3 式 canary 文件）

- Decision owner: mayf3
- Selected direction: G1–G4 gates + T1–T9 staged immutable order（CTR-CW-007）；
  接管后以 child cwd 可见性 + 旧文件可见 + 原会话真实 basic reply 作为端到端证明。
- Rejected: 跳步；all-at-once；V3 CTR-OW-009 functional canary 文件（该机制是 fleet
  第一接管 canary 的专用 gate；本单 Agent 线按 Owner 指令以真实回复 + 可见性验证
  为准）；伪造/免验证 PASS。
- Reason: Owner 指令冻结的生产前 8 步（本 Spec 固化为 T1–T8 + 幂等 T9）；
  fail-closed 语义与 fleet 线一致。
- Owner input remaining: NONE.

### DEC-CW-006 — Fallback workspace 保留为 rollback 基线

- Decision owner: mayf3
- Selected direction: `/Users/authsvc/.agent-core/workspaces/agt_cto-agent` 不删除、
  不合并、不回写（`DELETE_REQUIRED_FOR_CUTOVER = NO`；删除 = 单独 cleanup）。
- Rejected: 接管时删除/清空/合并 fallback 目录；把其内 trajectory merge 进 exact path。
- Reason: rollback 基线 + 零 mutation 原则。
- Owner input remaining: NONE.

## 12. Acceptance（未来执行轮验收契约；本轮 authoring 的验收 = docs 边界 + 独立 review）

### ACC-CW-001 — Authoring / lifecycle boundary

- Contracts: `CTR-CW-009`
- Method: inspect authoring branch diff 与 frontmatter。
- Expected: 本轮 changed files = 仅本 Spec 一个文件；status = proposed；
  implementation_authority = none；production_apply_authority = none；无
  implementation/product/production/workspace-file/auth 变更；未 accept、未 merge。
- Failure: 任一额外文件被修改；状态字段被 authoring agent 翻转；production 被触碰。

### ACC-CW-002 — Single subject immutable binding

- Contracts: `CTR-CW-001`
- Method: 对照 §2 冻结值核对执行产物与执行记录；验证 roster 排除。
- Expected: mapping key/path/digest/binding key 与冻结值逐字节一致；
  EXACT_ROSTER_SHA256 复核不变；无第二个 subject 出现。
- Failure: 任一值漂移；roster 被修改；出现动态发现面。

### ACC-CW-003 — Direct adopt-in-place via primary-workspaces.json; Definition/Binding boundary

- Contracts: `CTR-CW-002`
- Method: 核对 mapping 文件条目与权限（authsvc:authsvc 0600、atomic、no-clobber）；
  解析链逐段验证；agents.json byte-compare（verify-only）；Binding.workspace = null。
- Expected: `resolveWorkspace(agt_cto-agent)` = exact path；Definition 无 path 字段
  且未被修改；Binding.workspace = null（historical path 未写入）；DSH_HOME 未变。
- Failure: copy/overlay/替换 Workspace 出现；Definition/Binding 被写入 path；
  fallback 新 Workspace 或路径猜测出现。

### ACC-CW-004 — Visibility + filesystem integrity

- Contracts: `CTR-CW-003`
- Method: 接管前后 Workspace metadata/content 不变性证明（identity 文件 digest、
  git status、exec bits、symlink/hardlink 形态）；接管后旧 AGENTS.md / MEMORY.md /
  memory/ / Git repository 对 child 可见性实测。
- Expected: 接管 transaction 零文件/零元数据变更；旧内容在 exact path 原位可见。
- Failure: §CTR-CW-003 禁止清单任一操作出现在 takeover 路径；旧文件不可见。

### ACC-CW-005 — Exclusive runtime ownership + runtime-state boundary

- Contracts: `CTR-CW-004`
- Method: G3 证明链复核（OpenClaw RUNNING=NO、WRITER_COUNT=0、authsvc 唯一
  production runtime）；接管后单 automated generation；无 OpenClaw runtime state
  导入/catch-up。
- Expected: 证明齐全后接管；Owner interactive writes 不受影响。
- Failure: 证明缺失仍接管；双自动 writer；历史运行语义被带入。

### ACC-CW-006 — Feishu continuity + frozen conflicts

- Contracts: `CTR-CW-005`
- Method: T2 byte-verify 判据执行；两个冻结冲突 key 快照对比；T8 真实 basic reply
  证据核验（原会话、经恢复后 Binding、非 mock/bearer/direct-call/alternate）。
- Expected: same app / conversation key / agent_id；冲突 key 零变化；真实回复 PASS。
- Failure: BINDING_CONFLICT 未 STOP 而被 overwrite/delete/reassign/auto-repair/
  fallback；冲突 key 被触碰；回复证据不合规。

### ACC-CW-007 — Transaction order + idempotency + rollback drill

- Contracts: `CTR-CW-007`, `CTR-CW-008`
- Method: T1–T9 mutation-order trace 审计；T9 重跑 NOOP 证明；rollback 演练
  （R1–R4）对比控制面前后状态与 Workspace 零触碰。
- Expected: 顺序完整、每步证据在案；重跑零新增 mutation / 零重复消息；回滚只动
  控制面四项、文件从未移动、旧 runtime 保持关闭。
- Failure: 跳步/弱化顺序；重跑产生副作用；rollback 触碰文件或激活旧 runtime。

### ACC-CW-008 — Boundary honesty（不越权、不扩大）

- Contracts: `CTR-CW-001`, `CTR-CW-006`, `CTR-CW-009`
- Method: 审计执行记录与产物：无 transcript/scheduler/runtime-state 导入；无
  fleet widening；fallback workspace 未被删除/合并；无 Auth 对象变更；无产品代码
  变更。
- Expected: 全部缺席；本 authority 仅产生 §2.4 冻结的控制面变更。
- Failure: 任一越权项出现。

### Success receipt（未来执行轮成功回执，值由执行证据产生，不手填 path）

```text
CTO_PRIMARY_WORKSPACE_READY = YES
CTO_EXACT_WORKSPACE_PATH =
  /Users/yanfenma/.openclaw/groups/workspace-oc_648db8f3df0ef0249b761ebb0b7a56ab
CTO_BINDING_READY = YES
CTO_RUNTIME_VISIBLE = YES
CTO_OLD_AGENTS_MD_VISIBLE = YES
CTO_OLD_MEMORY_VISIBLE = YES
CTO_OLD_GIT_REPOSITORY_VISIBLE = YES
CTO_REAL_FEISHU_BASIC_REPLY = PASS
任一 FAIL -> STOP（记录在案，等待 Owner/审计处置）。
```

### Contract coverage

| Contract | Acceptance |
|---|---|
| CTR-CW-001 | ACC-CW-002, ACC-CW-008 |
| CTR-CW-002 | ACC-CW-003 |
| CTR-CW-003 | ACC-CW-004 |
| CTR-CW-004 | ACC-CW-005 |
| CTR-CW-005 | ACC-CW-006 |
| CTR-CW-006 | ACC-CW-008 |
| CTR-CW-007 | ACC-CW-007 |
| CTR-CW-008 | ACC-CW-007 |
| CTR-CW-009 | ACC-CW-001 |

## 13. Alternatives and disposition

| Alternative | Disposition | Reason |
|---|---|---|
| 扩大 V3 scope 纳入 agt_cto-agent / amend V3 | REJECTED | V3 exact-86 bound 为 accepted 冻结；治理禁 partial supersession |
| 把 cto 加入 exact 86（roster 变更） | REJECTED | `PR47_ROSTER_CHANGE = NONE`；`EXACT_ROSTER_SHA256` 不变 |
| 等待 fleet 线顺带覆盖 cto | REJECTED | cto 是 roster 外 boundary canary，fleet 计划明确不含且不动它 |
| copy / curated import / overlay / symlink farm / dual-write | REJECTED | `ZERO_COPY = REQUIRED`；copy 类路线已被 V2 superseded |
| path 写入 Agent Definition 或 Binding.workspace | REJECTED | `PATH_AUTHORITY = primary-workspaces.json` 唯一 |
| fallback 新 Workspace / 动态猜测路径 | REJECTED | CTR-CW-002 冻结 |
| 接管时删除/合并 fallback Workspace | REJECTED | rollback 基线保留（DEC-CW-006） |
| V3 CTR-OW-009 式 functional canary 文件 | NOT_ADOPTED | fleet 第一 canary 专用机制；本线端到端证明 = 旧文件可见 + 真实飞书回复（DEC-CW-005） |
| transcript / scheduler / runtime-state 一并迁移 | REJECTED | 全部 OUT_OF_SCOPE / FORBIDDEN（CTR-CW-006） |
| 热 reload / 免 restart 生效 | REJECTED | mapping 无热 reload seam；controlled restart 必需 |
| BINDING_CONFLICT 时 auto-repair / fallback | REJECTED | fail-closed STOP 冻结 |
| 回滚时移动/还原 Workspace 文件或重启 OpenClaw runtime | REJECTED | 文件从未迁移；旧 runtime 必须保持停止 |
| authoring agent 自行 accepted / merge | FORBIDDEN | 只有 authorized maintainer 可在独立 review 后 accept |
| 并行第二个 Agent 走本 authority | REJECTED | subject_count = 1 冻结 |

## 14. Migration, compatibility, and rollback

### 14.1 Authority migration

本 round 只新增 proposed 本 Spec；不 supersede 任何 Spec；V3 / V1 / V2 / fleet
lifecycle 不变。未来经独立 review（总监 审计）+ authorized acceptance transaction
后，本 Spec 成为 `agt_cto-agent` 的 subject Workspace authority（与 V3 的 fleet
authority 并行，§5.2）。该 lifecycle transition 本身仍不授权任何 production 动作。

### 14.2 Runtime compatibility

非 subject Agent（exact 86 fleet 与 default Agents）不受本 Spec 影响。subject 接管
后：one Agent one Workspace（= exact path）、Workspace-local Memory、session cwd
fail-loud 语义全部保持；`DSH_HOME` 不变；fallback Workspace 与其中既有 trajectory
原样保留。controlled restart 是共享 runtime 事件（与 fleet runbook 同 seam），重启
窗口内其他 Agent 的在途 turn 按既有 restart 语义处理，不因本 Spec 新增机制。

### 14.3 Cutover and rollback

未来接管只改控制面 metadata（mapping 单条目 + Binding workspace=null 确认 +
restart）；transaction = CTR-CW-007（G1–G4 + T1–T9）；rollback = CTR-CW-008
（R1–R4，control-plane only）。不移动、不还原、不删除任何 Workspace 文件。

## 15. Open questions

```text
OPEN_OWNER_DECISIONS = NONE（subject/path/边界均已冻结）
NORMATIVE_TBD        = NONE
IMPLEMENTATION_TBD   = 执行轮细节：authsvc 侧 byte-verify 的具体执行形态、
                       restart 后 child 状态验证工具、G2 中 identity 文件被 Owner
                       编辑后的重定基线记录格式 —— 均不得弱化任何 Contract
FLEET_INTERACTION    = 共享 primary-workspaces.json 的原子合并顺序（若 fleet 线
                       并行执行）由执行轮按实际 pre-state 协调，本 Spec 不冻结
                       跨线时序
PRODUCTION_APPROVAL  = 独立 gate，本 Spec 不授予
```

## 16. Authoring boundary

```text
DOCS_ONLY = YES
CHANGED_FILES = docs/specs/AGT_CTO_AGENT_PRIMARY_WORKSPACE_OPENCLAW_IN_PLACE_V1.md only
BASE = origin/main@344975d（含 accepted V3 与 accepted AGENT_TRUSTED_FLEET_CUTOVER_V1）
V3_LIFECYCLE_CHANGE = NONE
FLEET_SPEC_CHANGE = NONE
PR47_CHANGE = NONE（PR #47 已 merge 进 main，本轮对其零修改）
ROSTER_CHANGE = NONE（EXACT_ROSTER_SHA256 不变；agt_cto-agent 不加入 exact 86）
PRODUCT_CODE_CHANGE = NONE
PRIMARY_WORKSPACES_CHANGE = NONE
BINDING_CHANGE = NONE
RUNTIME_RELOAD = NO
AGENTS_JSON_CHANGE = NONE
WORKSPACE_FILE_CHANGE = NONE
AUTH_CHANGE = NONE
PRODUCTION_CHANGE = NONE
IMPLEMENTATION = NONE
ACCEPT_OR_MERGE = NO
SPEC_STATUS = proposed（implementation_authority = none；production_apply_authority = none）
READY_FOR_INDEPENDENT_REVIEW = YES
VALIDATION = git diff --check / verify_governance.py / npm run verify:structure
NEXT_TASK = 总监 审计
```

## 17. Acceptance-finalize record

```text
STATUS_AFTER_ACCEPTANCE = accepted
ACCEPTED_BY = mayf3
REVIEWED_BASE_COMMIT = 344975d1d6aa2ab560d2f213d4460d34c9f6ae60
REVIEWED_SPEC_COMMIT = 06feadf95f196a4c9581d453c256362b5d9e5914
REVIEWED_SPEC_BLOB = 5b6ccef2add9ae602bc8168a3e324b4babdb11c3
REVIEW_NAME = 总监 审计
REVIEW_RESULT = PASS
REQUIRED_FIXES = NONE
SEMANTIC_DELTA_AFTER_REVIEW = NONE
ACCEPTANCE_DELTA_CLASS = LIFECYCLE_ONLY
CHANGED_FILES = docs/specs/AGT_CTO_AGENT_PRIMARY_WORKSPACE_OPENCLAW_IN_PLACE_V1.md only
IMPLEMENTATION_AUTHORITY_AFTER_ACCEPTANCE = none
PRODUCTION_APPLY_AUTHORITY_AFTER_ACCEPTANCE = none
IMPLEMENTATION_AUTHORIZED_NOW = NO
PRODUCTION_APPLY_AUTHORIZED_NOW = NO
STILL_REQUIRED_BEFORE_IMPLEMENTATION = PR #59 merged into main + separate execution round with its own task authorization
STILL_REQUIRED_BEFORE_PRODUCTION = separate production approval round (control-plane transaction CTR-CW-007 executed by an authorized execution round only)
NEXT_TASK = 采纳 审计
```
