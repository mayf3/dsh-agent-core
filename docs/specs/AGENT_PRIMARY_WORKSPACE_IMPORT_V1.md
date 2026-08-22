---
spec_id: AGENT_PRIMARY_WORKSPACE_IMPORT_V1
status: superseded
date: 2026-08-18
superseded_date: 2026-08-22
supersedes: []
superseded_by: AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2
type: implementation-spec (spec-only; no implementation this round)
scope: docs-only — freeze the Agent.primaryWorkspace import model; RUNTIME_CHANGE = NONE (this round)
references:
  - LEGACY_WORKSPACE_AUTHORITY_RULING_V1 (Owner Ruling, 2026-08-18 — workspace authority)
  - docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md (accepted, Current Authority)
  - docs/specs/AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC.md (accepted @14a41b3)
  - docs/specs/AGENT_CORE_BINDING_WORKSPACE_V1.md (accepted; PARTIALLY_SUPERSEDE by V2)
  - OPENCLAW_TO_AGENT_CORE_WORKSPACE_MIGRATION_AUDIT (2026-08-18, PASS; session evidence)
---

# AGENT_PRIMARY_WORKSPACE_IMPORT_V1 — 已存在目录 import 为 Agent primary Workspace（只出 Spec，不实现）

> 状态：**superseded**（2026-08-22；whole-authority replacement =
> `AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2`；本文件保留为历史 authority，其原有
> normative meaning 不改写。该 lifecycle transition 不实现 Workspace migration，
> 不执行 production apply。）
>
> **AMENDMENT-1**（2026-08-18，basis = Owner Ruling `LEGACY_WORKSPACE_AUTHORITY_RULING_V1`）：
> 折入 workspace authority 裁定——OpenClaw 原目录 = AUTHORITATIVE_LONG_LIVED_WORKSPACE，
> Agent Core 既有 copy = TEST_ONLY_DISPOSABLE_STATE；原稿中「diverged workspace
> reconciliation / authority conflict / preserve post-Canary Agent Core knowledge」类
> 要求**全部删除或标记为本次不适用**（见 §2.4 / §6 / §8）。其余设计不变。
>
> **ACCEPTANCE**（2026-08-18）：independent review =
> `AGENT_PRIMARY_WORKSPACE_IMPORT_V1_SPEC_REVIEW` **PASS**（REQUIRED_FIXES = NONE；
> VERDICT = READY_TO_ACCEPT_AND_MERGE_SPEC）。status proposed → accepted —— 纯状态
> 翻转，SEMANTIC_CHANGE = NONE（scope / AC / 冻结边界全部原样）。Reviewer 随 PASS
> 附带 4 项 implementation notes（§11.1）仅作实现轮注意事项，不扩大 scope。

## 0. 一句话目标

Agent 仍然只有 **一个** 长期 primary Workspace（V2 §5 `ONE_AGENT_ONE_WORKSPACE`
不变）。primary Workspace 的取得方式从一种变成两种：

```text
1. Agent Core 新建（现有路径）  → <workspaceRoot>/<agentId>
2. import 一个已存在目录（新）  → primaryWorkspaces[agentId] 指向的绝对路径
                                 （例如 ~/.openclaw/groups/workspace-oc_<id>）
```

import 后该目录成为该 Agent 的 primary Workspace，Agent Core 成为唯一 active
writer；`session.header.cwd` / Memory / tools / ordinary files 全部直接使用该目录。

```text
import 语义 = existing directory → adopt in place
             → zero copy → zero merge → zero rewrite
```

**不 copy、不 symlink、不改目录内任何普通文件路径。**

## 1. DEVELOPMENT_PREFLIGHT（改动第一行代码前已输出；此处存档）

```text
Problem            = OpenClaw 退休；87 个 ~/.openclaw/groups/workspace-oc_* 需原地接管
Governing Spec     = AGENT_WORKSPACE_SESSION_MODEL_V2（accepted，Current Authority）
                     + AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC（accepted）
Spec status        = 上述均 accepted；本 Spec = proposed（本轮不实现）
Relevant inves tigations = OPENCLAW_TO_AGENT_CORE_WORKSPACE_MIGRATION_AUDIT（PASS）
Relevant decisions = D-002/D-003/D-004（PARTIALLY_SUPERSEDE 后保留项有效）
Previously rejected = FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1 @6071dfd（DO_NOT_ACCEPT，
                     per-conversation workspace 模型——本 Spec 不重开）
Frozen boundaries  = agent-definition 只携带 identity+display（禁 workspace 字段）
                     SESSION_WRITE_CONTRACT R1/R2/R3；Router 零产品分支
                     Binding.workspace = transitional ≠ authority；KERNEL_CHANGE = NONE
New evidence       = OpenClaw 退休 + in-place 接管方向；审计实证（workspace 位置/
                     内混状态/双写风险）；代码实证（消费方只拿最终绝对路径）
Need new/amended Spec = YES（本文件）
```

```text
North Star     = one Agent = one primary Workspace；primary 可新建或 import 已存目录
First blocker  = resolveWorkspace(agentId) 硬派生 <workspaceRoot>/<agentId>，无 explicit seam
Outside-Kernel = YES（workspace-bootstrap + 部署配置 + 现有 spawn env 通道即可）
Kernel needed  = NO
Special-casing = NONE
```

## 2. Evidence / 依据（source-verified @ origin/main 14a41b3）

### 2.1 当前 Workspace 规则与消费方

`resolveWorkspace(agentId)`（`packages/workspace-bootstrap/src/paths.js`）派生
`<workspaceRoot>/<sanitizeAgentId(agentId)>`，root 优先级 `configured ?? $DSH_WORKSPACE_DIR ?? ~/.dsh/workspaces`。
production 实际 root 由 `production-runtime` layout 决定（`<productionRoot>/workspaces`，
当前部署 = `~/.agent-core/workspaces`）。

生产调用方（全部只消费**最终绝对路径**，无一关心它是否形如 `<root>/<agentId>`）：

| 调用方 | 位置 | 用途 |
|---|---|---|
| agent-router spawn | `agent-router/src/index.js:527,537` | `ensure(agentId)` + `resolveWorkspace` → process `workspace`（spawn cwd 底座） |
| agent-router deliver V0 | `index.js:765` | `proc.deliver(sessionId, message, { cwd: workspacePath })` |
| agent-router effective workspace | `index.js:299`（`resolveEffectiveWorkspace` null 分支） | `binding.workspace == null` → Agent default |
| v2-ingress-gate | `production-runtime/src/v2-ingress-gate.js:82` | primary path 与 `binding.workspace` resolved path 的相等性判定 |
| agent-memory | `agent-memory/src/paths.js:42`（纯函数委托）+ `index.js:153` mount | `MEMORY.md` / `memory/` 派生 + 同步 system-prompt injection |
| scheduler cron | `scheduler-router`（不传 cwd） | 落 process 级 workspace |
| 部署组装 | `production-runtime/src/compose.js:119` | `applyBootstrap({workspaceRoot, agentsHome})` |

### 2.2 关键既有冻结

- `agent-definition` config **只携带 identity + display**（id/name/description/disabled），
  加载时 fail-loud 拒绝 workspace 字段（`packages/agent-definition/src/definition.js`）。
- V2_CORE_ALIGNMENT §4 显式冻结：**不新增 `primaryWorkspace` 配置字段**
  （针对 agent-definition schema；`AGENT_DEFINITION_SCHEMA_CHANGE = NO`）。
- V2 decision §22：`Binding.workspace` = TRANSITIONAL_COMPATIBILITY_FIELD，非产品
  authority；§24.4 PRESERVE `SESSION_WRITE_CONTRACT R1/R2/R3`。
- V2 decision §25 明确把 "OpenClaw migration mechanics" 留给后续 Implementation
  Spec —— 本 Spec 即该问题的 primary-workspace 部分。

### 2.3 NEW_EVIDENCE（为什么现在加 explicit primary）

1. **OpenClaw 退休 + in-place 接管方向**：87 个长期 Workspace 位于
   `~/.openclaw/groups/workspace-oc_<conversationId>/`（openclaw.json `agents.list[].workspace`
   逐 agent 显式配置，source-verified）。用户决策：不 copy、不 symlink，原地接管。
   fleet 级逐个 copy（此前 stock-agent 单体 copy 模式）不再作为规模路径。
2. **迁移审计实证**（OPENCLAW_TO_AGENT_CORE_WORKSPACE_MIGRATION_AUDIT，PASS）：
   workspace 内混有 `.openclaw/workspace-state.json`、`.archon/`、`.env`/`*token*`/`*jwt*`
   （226 个 secret 形态文件散落 groups/）；OpenClaw 进程仍活写（import 前置 =
   OpenClaw 停写，属 runbook 责任）。
3. **代码实证**：所有消费方经 `resolveWorkspace(agentId)` 单一 seam 取路径 →
   在该 seam 加 per-agent explicit 覆盖即可全链路生效，无需改任何消费方逻辑。

本 Spec 与 V2_CORE_ALIGNMENT §4 的冻结**不冲突**：该冻结限定 agent-definition
schema；本 Spec 保持 agent-definition 原样，把 explicit primary 放在 **workspace-bootstrap
（既有 path authority）** 的配置层。

### 2.4 Owner Ruling — workspace authority（LEGACY_WORKSPACE_AUTHORITY_RULING_V1）

本次 OpenClaw → Agent Core cutover 的 authority 裁定（Owner，2026-08-18）：

```text
~/.openclaw/groups/workspace-oc_<id>/  = AUTHORITATIVE_LONG_LIVED_WORKSPACE
~/.agent-core/workspaces/<agentId>/    = TEST_ONLY_DISPOSABLE_STATE（Canary 测试遗留）

WORKSPACE_RECONCILIATION_REQUIRED = NO
MEMORY_RECONCILIATION_REQUIRED    = NO
POST_CANARY_AGENT_CORE_STATE_PRESERVATION_REQUIRED = NO
```

后果：primary Workspace authority 在 cutover 时**直接切换**为 OpenClaw 原目录。
不存在、也不需要任何「两份历史谁继续」的仲裁——原稿 §8 的 diverged-history
deployment-attention 表述**作废**（AMENDMENT-1 删除，见 §8 现文）。Agent Core 测试
Workspace 可在 rollback 窗口内保留（`DELETE_REQUIRED_FOR_CUTOVER = NO`），但不具
业务 authority；其删除属**单独 cleanup**，不在本 Spec。

## 3. 模型：Primary Workspace Resolution Rule（冻结）

```text
resolvePrimaryWorkspace(agentId)（语义上即改造后的 resolveWorkspace(agentId)）：

  primaryWorkspaces[agentId] 存在（import Agent）
    → 使用该 explicit absolute directory
      （config 加载时已验证：absolute + 真实存在目录 + 非 symlink）

  primaryWorkspaces[agentId] 缺席（default Agent，一切现状）
    → <workspaceRoot>/<sanitizeAgentId(agentId)>（现有派生，逐字节不变）
```

冻结细则：

- **单一 seam**：该解析发生在 workspace-bootstrap（D-002 边界：workspace 映射唯一
  owner）。`resolveWorkspace(agentId)` 本身升级为上述语义；所有既有调用方自动跟随。
- **`resolveWorkspacePath(workspaceId)`（Binding.workspace 派生）不变**：仍是
  `<workspaceRoot>/<workspaceId>`，不查询 primaryWorkspaces。若某 binding 的
  `workspace` 恰为 agentId 字符串，其 resolved path ≠ imported primary → V2 gate
  按 `non_primary_workspace` 拒入 normal path（既有行为，fail-closed，正确）。
- **一 Agent 一 primary**：primaryWorkspaces 是 `agentId → path` 单值映射；不存在
  one-agent-multiple-workspaces、conversation workspace、Binding.workspace authority。
- **agent-definition schema 零改动**（AGENT_DEFINITION_SCHEMA_CHANGE = NO 保持）。

## 4. 配置面（最小模型）

```text
配置载体：<productionRoot>/primary-workspaces.json（部署侧人工 authored，可选）
{
  "agt_stock_agent": "/Users/yanfenma/.openclaw/groups/workspace-oc_0480991b97f1e27c96514ac66b4f122c"
}
```

- 文件缺席 = 无 import = **行为与今天完全一致**（default Agent 不受任何影响）。
- `production-runtime/compose.js` 读取该文件 → 传给 `applyBootstrap({ primaryWorkspaces })`
  （workspace-bootstrap Config 增加可选 record，默认 `{}`）。单一配置源，无第二权威。
- agent-definition / bindings / scheduler / credentials 配置面零改动。

### Memory 的路径获取（机械 seam，非新权威）

agent-memory 运行在 per-agent 子进程内，看不到控制面 plugin config。沿用既有
spawn env 通道（router 已传 `DSH_AGENT_ID`）：

```text
router spawn 时：env DSH_PRIMARY_WORKSPACE = workspaceBootstrap.resolveWorkspace(agentId)
                 （值来自唯一权威 seam 的输出；router 不自行拼路径、不加分支）

agent-memory 解析优先级：
  $DSH_PRIMARY_WORKSPACE（absolute；import Agent 时即 imported path）
  > resolveAgentWorkspace(agentId, cfg.workspaceRoot)（现状派生）
```

agent-memory 的 cwd-basename fallback（`agentIdFromCwd`）只在
`<workspaceRoot>/<agentId>` 布局下有效；import 目录名（`workspace-oc_*`）不是
agentId —— 生产路径恒有 `DSH_AGENT_ID` + `DSH_PRIMARY_WORKSPACE`，fallback 语义
不变但被上述优先级自然短路。冻结要求：session-aware 写入（`session.header.cwd`）
与无 session 的同步 injection **必须解析到同一个绝对路径**（V2 invariant 不变）。

## 5. Import 验证（fail-loud；不加 sandbox）

config 加载时逐项验证，任一失败 = 启动 fail-loud（结构化错误码
`PRIMARY_WORKSPACE_INVALID`），**不降级、不静默忽略**：

```text
key   = 合法 agentId（复用 sanitizeAgentId 同构规则）
value = 非 empty string；expandTilde 后必须 absolute
      = 必须是已存在的真实目录（stat isDirectory）
      = 不得是 symlink（lstat；防 alias 混淆，保持单写者语义清晰）
```

显式**不做**（调查结论，均为过度设计或另有 owner）：

- writable check —— 不在 config 层做；ensure/spawn 的真实 IO 失败本身就是 fail-loud。
- ownership/permission check —— 与既有 workspace 同 user 模型，不新增 sandbox。
- path traversal —— explicit absolute 运维配置非外部输入；key 已 sanitize，value
  不与任何不可信输入拼接。
- realpath/别名归一、`.openclaw` 路径黑名单 —— 不做路径政策判断。

## 6. ensure() / bootstrap 语义（import Agent）

```text
primaryWorkspaces[agentId] 生效时，ensure(agentId)：
  workspace 侧 = 零写入：不 mkdir（目录已存在）、不 seed AGENTS.md（import 目录
                87/87 自带 AGENTS.md；即便缺失也不写 —— 见下）
  dshHome 侧  = 照旧 <agentsHome>/<agentId>（Agent Core control-plane 独立，
                provisioning/settings/credentials 与 OpenClaw 无关）
```

冻结：

```text
IMPORT_DOES_NOT_DELETE_EXISTING_FILES = YES
IMPORT_DOES_NOT_COPY_FILES            = YES
IMPORT_DOES_NOT_MERGE_FILES           = YES
IMPORT_DOES_NOT_REWRITE_WORKSPACE     = YES
SEED_IMPORTED_WORKSPACE               = NO   # 宁可 AGENTS.md 缺失 fail-loud 也不写
```

Reconciliation 冻结（AMENDMENT-1，Owner Ruling §2.4）：

```text
WORKSPACE_RECONCILIATION_REQUIRED = NO
MEMORY_RECONCILIATION_REQUIRED    = NO
MERGE_TEST_MEMORY_BACK            = FORBIDDEN   # 不把 Agent Core 测试 MEMORY.md
                                                #  / memory/ merge 回 OpenClaw Workspace
OVERWRITE_OPENCLAW_ORIGINAL       = FORBIDDEN   # 不用 Agent Core copy 覆盖 OpenClaw 原目录
```

OpenClaw 遗留隐藏文件（`.openclaw/`、`.archon/`、`.env`、`.env.bak`、`*token*`、
`*jwt*` 等）：Agent Core **不读不写不删**（无 compat layer）。secret cleanup =
**separate follow-up**（独立后续任务/Spec），本 Spec 不顺手清理。

## 7. Ownership 规则

```text
IMPORT_PRECONDITION  = OpenClaw 已停止写该 Workspace（operator/runbook 责任；
                       本 Spec 不建检测机器）
POST_IMPORT          = Agent Core = sole active writer
AUTHORITY_SWITCH     = DIRECT（cutover 时 primary Workspace authority 直接切到
                       OpenClaw 原目录；无过渡期双权威、无 reconciliation 阶段）
DUAL_WRITE           = UNSUPPORTED（不检测、不仲裁；属运维契约）
```

## 8. 对各消费方的影响（全部 source-verified，零产品分支）

| 消费方 | 影响 | 改动 |
|---|---|---|
| Router spawn cwd / deliver cwd / effective workspace | 拿到 imported path | 仅 spawn env 追加 `DSH_PRIMARY_WORKSPACE`（机械传值，无分支） |
| v2-ingress-gate | `resolveWorkspace(activeAgentId)` 返回 imported path；非 primary `binding.workspace` 照旧被挡在 normal path 外 | 无 |
| agent-memory | MEMORY.md / memory/ 落在 imported path 下（session-aware + 同步 injection 一致） | env 优先级一处 |
| scheduler cron | process 级默认 workspace = imported path | 无 |
| agent-instructions（AGENTS.md） | 从 session cwd（= imported path）读取；import 目录自带 AGENTS.md | 无 |
| agent-definition / bindings / scheduler / credentials / logs | 不受影响 | 无 |

### Session / Binding 语义

```text
session.header.cwd   = Agent.primaryWorkspace（新 session 冻结为 imported path）
SESSION_WRITE_CONTRACT R1/R2/R3 = PRESERVE（cwd 创建时冻结；resume 校验相等性；
                       绝不静默改 cwd）
pre-import session 在 import 后 resume = 结构化拒绝（fail-loud；预期行为，
                       不做 remap/migration）
native main          = create/resume 机制不变；post-import 创建的 main 落在
                       imported path；restart recovery 经 binding → 同一 path
DSH projectKey       = 本仓库 0 处引用（grep-verified）；harness 内部若按 cwd
                       派生则自动跟随 —— KERNEL_CHANGE = NONE
```

### Authority 与既有 Agent Core copy（AMENDMENT-1，取代原「部署注意」）

原稿此处曾把「copy 与 OpenClaw 原件 MEMORY.md 已分叉、以哪份历史继续」列为待仲裁的
部署注意——**已由 Owner Ruling（§2.4）裁定，作废**：

```text
OPENCLAW_WORKSPACE_AUTHORITY  = AUTHORITATIVE（cutover 后业务权威 = OpenClaw 原目录）
AGENT_CORE_EXISTING_COPY      = TEST_ONLY_DISPOSABLE（Canary 测试遗留，无业务 authority）
DELETE_REQUIRED_FOR_CUTOVER   = NO（rollback 窗口内保留；删除 = 单独 cleanup）
```

对 `agt_stock_agent` 这类已有 copy 的 Agent：配置 import 后 primary 直接切到
OpenClaw 原目录；copy（含其内已分叉的 MEMORY.md / memory/）整体降级为
TEST_ONLY_DISPOSABLE_STATE——**不 merge、不回写、不覆盖、不因 cutover 删除**。
原稿中任何 diverged workspace reconciliation / authority conflict / preserve
post-Canary Agent Core knowledge 要求 = **本次不适用**。

## 9. Scope（Allowed for Implementation——accepted 后）

```text
packages/workspace-bootstrap/src/paths.js      # resolveWorkspace 增加 optional 覆盖参数（缺席=现状）
packages/workspace-bootstrap/src/index.js      # Config.primaryWorkspaces、service 关包、ensure 零写语义、验证
packages/workspace-bootstrap/test/*            # 新增 import/default/invalid 用例
packages/agent-router/src/index.js             # 仅 spawn env 追加 DSH_PRIMARY_WORKSPACE（机械）
packages/agent-memory/src/index.js             # $DSH_PRIMARY_WORKSPACE 优先级
packages/production-runtime/src/compose.js     # 读取 primary-workspaces.json + 接线 + 启动日志
packages/*/test/*                              # 对应测试
```

## 10. Non-Goals and Frozen Boundaries（禁止方案）

```text
whole ~/.openclaw as Agent Core root            = 禁止
OpenClaw compatibility layer                     = 禁止
reading openclaw.json as runtime authority       = 禁止
copying 87 workspaces                            = 禁止
symlink farm                                     = 禁止（config 值亦不得为 symlink）
Workspace Registry / one Agent multiple Workspaces = 禁止
conversation workspace                           = 禁止（不重开 6071dfd）
Router Feishu special case                       = 禁止
Kernel change                                    = NONE
secret cleanup / OpenClaw 隐藏文件处置           = separate follow-up
Agent Core 测试 copy 的 merge/回写/覆盖          = 禁止（TEST_ONLY_DISPOSABLE，§2.4/§8）
旧 <root>/<agentId> copy 的删除                  = 单独 cleanup（rollback 窗口内保留；
                                                  DELETE_REQUIRED_FOR_CUTOVER = NO）
workspace / memory reconciliation                = NO（NOT_APPLICABLE，Owner Ruling）
真实 Workspace 迁移 / OpenClaw 停启              = out of scope（runbook 责任）
```

## 11. Acceptance（实现轮测试口径；不含真实生产迁移）

```text
AC1  default Agent（无 primaryWorkspaces 条目）：resolveWorkspace(agentId) 逐字节
     等于 <workspaceRoot>/<agentId>；既有全部测试不改即过。
AC2  imported Agent（条目 = 已存在绝对目录）：resolveWorkspace(agentId) 返回该目录。
AC3  DSH cwd：spawn workspace / deliver / turn cwd == imported path；
     session.header.cwd 创建时冻结为 imported path。
AC4  Memory：MEMORY.md 与 memory/ 解析在 imported path 下；session-aware 写入与
     同步 system-prompt injection 得到同一路径。
AC5  native main：post-import create 与 resume 均工作；restart recovery 后仍工作。
AC6  Binding.workspace 不覆盖 V2 normal path：非 primary binding.workspace 照旧被
     v2-ingress-gate 以 non_primary_workspace 拒绝。
AC7  import 零副作用：ensure(importedAgent) 对 imported 目录零 copy / 零 delete /
     零 merge / 零写入（含不 seed AGENTS.md）；dshHome 照常 provision；Agent Core
     测试 copy 不被读取、merge 或覆盖（TEST_ONLY_DISPOSABLE，§2.4）。
AC8  invalid 配置 fail-loud：relative path / 不存在目录 / symlink / 非法 agentId key
     → PRIMARY_WORKSPACE_INVALID 启动失败；不牵连 default Agent。
AC9  pre-import session 在 import 后 resume → 结构化拒绝（cwd mismatch，无静默 remap）。
AC10 scheduler cron（无显式 cwd）落 process 级 imported workspace。
```

### 11.1 Implementation Notes（Reviewer 随 PASS 附带；非新 AC、非 scope 扩大）

以下 4 项为 independent review 附带的实现轮注意事项——不新增任何要求，仅提示实现时
核对（每项均可回指已冻结条款）：

1. **resolveWorkspacePath 委托解耦** —— `resolveWorkspacePath(workspaceId)` 委托
   `resolveWorkspace` 内部派生（§3 冻结：不查询 primaryWorkspaces）；实现覆盖参数时
   不得把 per-agent 覆盖带进 workspaceId 派生分支。
2. **provisionAgentHome mkdir** —— ensure() 对 imported workspace 零 mkdir / 零写
   （§6），但 dshHome 侧 `provisionAgentHome` 照常 mkdir；实现时确认 home
   provisioning 不依赖 workspace 目录新建的副作用。
3. **pre-import main R3 fail-loud** —— pre-import 冻结旧 cwd 的 main 在 import 后
   resume 必须走结构化拒绝（§8 / AC9），实现时确认拒绝路径是结构化错误，
   不是静默新建 session。
4. **memory mkdir** —— MEMORY.md / memory/ 的 lazy 创建落在 imported path 下
   （§4 / AC4）；这是 import 完成后 Agent 正常运行的 lazy 写入，不属于 §6 的
   import 零写约束（零写指 ensure()/import 动作本身）。

## 12. Final Output（Spec 交付时）

```text
AGENT_PRIMARY_WORKSPACE_IMPORT_V1_SPEC = PASS（AMENDMENT-1 已折入；independent review PASS；accepted）

CURRENT_WORKSPACE_RULE  = resolveWorkspace(agentId) → <workspaceRoot>/<agentId>
PROPOSED_WORKSPACE_RULE = resolveWorkspace(agentId) → primaryWorkspaces[agentId]
                          （validated existing absolute dir）| <workspaceRoot>/<agentId>

AGENT_DEFINITION_CHANGE    = NO（schema 冻结不动）
WORKSPACE_BOOTSTRAP_CHANGE = YES（optional per-agent primaryWorkspace 覆盖 +
                              import 验证 + ensure 零写语义；唯一 path authority 不变）
ROUTER_CHANGE              = 机械传值 only（spawn env DSH_PRIMARY_WORKSPACE；零分支）
MEMORY_CHANGE              = env 优先级一处（语义不变：Workspace-local）
DSH_CHANGE                 = NONE

DEFAULT_AGENT_BEHAVIOR_PRESERVED = YES（无配置条目 = 逐字节现状）
EXISTING_PATH_IMPORT_SUPPORTED  = YES（explicit absolute existing dir）

OPENCLAW_WORKSPACE_AUTHORITY = AUTHORITATIVE（Owner Ruling §2.4）
AGENT_CORE_EXISTING_COPY     = TEST_ONLY_DISPOSABLE
RECONCILIATION_REQUIRED      = NO（workspace/memory/post-Canary state 全部 NO）

COPY_REQUIRED               = NO
MERGE_REQUIRED              = NO
SYMLINK_REQUIRED            = NO（且 config 值不得为 symlink）
DELETE_REQUIRED_FOR_CUTOVER = NO（copy 删除 = 单独 cleanup）

OPENCLAW_COMPAT_LAYER = NO
WORKSPACE_REGISTRY    = NO
KERNEL_CHANGE         = NONE

SPEC_STATUS = accepted
INDEPENDENT_SPEC_REVIEW = PASS（REQUIRED_FIXES = NONE；VERDICT = READY_TO_ACCEPT_AND_MERGE_SPEC）
```
