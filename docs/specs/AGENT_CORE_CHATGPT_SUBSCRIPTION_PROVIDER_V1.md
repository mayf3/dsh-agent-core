---
spec_id: AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1
status: proposed
date: 2026-08-18
type: implementation-spec (spec-only; no implementation this round)
scope: docs-only — freeze the explicit opt-in ChatGPT-subscription model backend (dsh-codex@0.2.3 / openai-codex / gpt-5.6-luna) for exactly one named Agent; PRODUCT_CODE_CHANGE = NONE / STATE_CHANGE = NONE (this round)
references:
  - docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md (accepted, Current Authority — security domain = Agent)
  - docs/specs/AGENT_PRIMARY_WORKSPACE_IMPORT_V1.md (accepted — deployment-authored static config seam 先例)
  - docs/specs/AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC.md (accepted — Router 保持 generic / KERNEL_CHANGE = NONE)
  - docs/specs/AGENT_CORE_BACKUP_RETENTION_V1.md (accepted — deployment backup 边界)
  - docs/investigations/same-uid-router-secret-boundary-audit-v1.md (credential 永不经 env/argv 硬前提)
  - DSH_GPT56_CHATGPT_SUBSCRIPTION_ROUNDTRIP（外部实验，PASS — 仅可行性 evidence，不是主线行为 authority）
---

# AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1 — ChatGPT subscription 作为单 Agent 显式 opt-in 模型后端（只出 Spec，不实现）

> 性质：**Spec（SPEC ONLY — 本轮只做源码级调查 + 冻结设计，不 implementation /
> 不执行正式 OAuth 登录 / 不复制实验 credential / 不修改 production Agent /
> 不提交 PR implementation / 不 merge）** · 日期：2026-08-18
> 仓库：`mayf3/dsh-agent-core` · 分支：`docs/agent-core-chatgpt-subscription-provider-v1`
> （linked worktree `.worktree/agent-core-chatgpt-subscription-provider-v1`，base =
> origin/main `93f9acf`）
>
> 本 Spec 把已真实验证的链路

```text
ChatGPT Pro subscription
→ dsh-codex@0.2.3（DSH 插件，OAuth credential 自持）
→ provider = openai-codex / model = gpt-5.6-luna（pi-ai 安装目录 catalog）
→ DSH agent 进程内解析（agent-default-model settings 层）
```

> 收敛为 Agent Core 主线中**显式 opt-in 的可选模型后端**：恰好一个由 deployment
> 显式指定的 Agent 使用它；所有未配置 Agent 的行为逐字节保持现状。

---

## 0. 一句话目标

```text
one Agent = one DSH process = one DSH_HOME = one security domain（不变，D-006）

本次新增的唯一能力：
  deployment 静态配置显式命名 恰好一个 Agent
  → 该 Agent 的持久化 DSH_HOME 内：
      provider  = openai-codex（由 dsh-codex@0.2.3 插件注册）
      model     = gpt-5.6-luna（settings.yaml agent-default-model 用户层）
      OAuth credential = 该 Agent 自己的（插件自持于其 DSH_HOME）
  → 其余一切 Agent：配置缺失 = 行为逐字节等于今天
```

```text
DEFAULT_MODEL_CHANGED   = NO
ENABLED_AGENTS          = 恰好一个（deployment 显式选择；V1 配置拒绝 >1 条）
GLOBAL_ENABLEMENT       = FORBIDDEN
KERNEL_CHANGE           = NONE
ROUTER_SEMANTIC_CHANGE  = NONE
SESSION_MODEL_CHANGE    = NONE
```

---

## 1. DEVELOPMENT_PREFLIGHT（改动第一行代码前已输出；此处存档）

```text
Problem            = 把已验证的 ChatGPT subscription → dsh-codex@0.2.3 →
                     openai-codex/gpt-5.6-luna → DSH Agent 链路收敛为 Agent Core
                     主线显式 opt-in 可选模型后端（INVESTIGATION + SPEC ONLY）
Governing Spec     = 无既有 accepted Spec 覆盖本改动（本文件即新 proposed Spec；
                     本轮零实现，不触发 merge-gate G2）
Spec status        = proposed
Relevant decisions = D-006 AGENT_WORKSPACE_SESSION_MODEL_V2（accepted：
                       security domain = Agent / credential 属 Agent /
                       AGENT_BIRTH_BLOCKS_ON_CREDENTIAL = NO）
                     D-002（保留项：Agent 固定拥有 DSH_HOME/credential）
                     DSH_PLUGIN_ADOPTION_V1（proposed：ADAPT + TRUST/LOCK-IN/FALLBACK 框架）
Relevant investigations = same-uid-router-secret-boundary-audit-v1
                       （硬前提 1：credential 永不经 env/argv）
                     agent-core-production-resident-v1（production layout）
Previously rejected alternatives = 本题无已拒绝先例；全局 env 模型变量
                     （DSH_AGENT_PROVIDER / DSH_AGENT_MODEL）经 source-verify 证伪
                     存在性并否决适用性（§2.4）
Frozen boundaries  = KERNEL_CHANGE = NONE / ROUTER_SEMANTIC_CHANGE = NONE /
                     SESSION_MODEL_CHANGE = NONE；不修改 Binding / Session /
                     Router routing semantics / AgentDefinition 产品身份模型；
                     agents.json 只携带 identity+display（fail-loud 拒绝 runtime 字段）
North Star         = 恰好一个显式指定 Agent 以 ChatGPT subscription 为模型后端，
                     其余 Agent 逐字节不变
First blocker      = 主线无 per-Agent 模型后端声明面（provisioning 对所有 home
                     装配同一份全局 settings 副本）
Can solve outside Kernel = YES（per-agent DSH_HOME settings + profile 装配 +
                     deployment 静态配置，全部现有层）
Kernel change necessary   = NO
Product special-casing    = NONE（Router 只透传配置不解释；无 provider 分支进 Router）
Smallest next action      = 出本 proposed Spec（本轮全部工作）
```

---

## 2. Evidence / 依据（source-verified）

> 调查基线：Agent Core = origin/main `93f9acf`；DSH harness =
> `~/workspace/github/deepseek-harness` @ `a12bb03c68`（= `@deepseek-ai/dsh
> 0.1.0-rc.5`，与实验 DSH commit 一致）；dsh-codex = npm registry `dsh-codex@0.2.3`
> tarball 源码审读。**不允许根据实验目录推断主线行为**——本节全部结论来自上述
> source，实验仅作 §2.6 可行性 evidence。

### 2.1 CURRENT_MODEL_CONFIG_AUTHORITY（provider/model 当前选择 authority）

```text
CURRENT_MODEL_CONFIG_AUTHORITY =
  每个 Agent 自己的 DSH_HOME 下的 settings.yaml
  （production 实际路径 = ~/.agent-core/homes/<agentId>/settings.yaml）
```

source-verified 事实链：

| # | 事实 | 位置 |
|---|---|---|
| 1 | DSH 的 settings 文档 = `<DSH_HOME>/settings.yaml`（settings-file provider，`resolveDshHome` 决定） | harness `packages/settings/settings-file/src/index.ts:56` |
| 2 | 默认模型选择 = settings `agent-default-model:` 段（`provider`/`model`/可选 `reasoningEffort`），由第一方插件 `@deepseek-ai/dsh-agent-default-model` **实时读取**；composition base（bundle patch config）之上 **用户 settings 层获胜** | harness `packages/core/agent-default-model/src/index.ts`（`AGENT_DEFAULT_MODEL_SETTINGS_NAMESPACE`） |
| 3 | provider route 声明 = settings `llm-pi-ai:` 段（每 route 一个 `apiKeyEnv` 引用，**不落 secret**）；route 集合可被用户层增改，下一请求即生效 | harness `packages/llm/llm-pi-ai/README.md`（Dynamic configuration） |
| 4 | 主线 production 每 Agent 进程 env：`DSH_HOME=<home>`（`agentEnv`，process.js:73-89）——settings 解析天然 per-Agent | `packages/agent-router/src/process.js` |
| 5 | provisioning 把 operator 全局 `~/.dsh/settings.yaml`（或 `$DSH_SETTINGS_SOURCE`）`copyOnce` 进每个 home；目标已存在则**永不覆盖**；无源时写 `MINIMAL_SETTINGS`（`opencode-go` / `deepseek-v4-flash`） | `packages/agent-provisioning/src/index.js:224-229, 97-106` |
| 6 | 当前生产 provider/model = `opencode-go` / `deepseek-v4-flash`（MINIMAL_SETTINGS 或 operator settings 副本）；API key 经 `<home>/.credentials.yaml` 由 `agentEnv` 注入 `OPENCODE_GO_API_KEY` env | 同上 + process.js:81-87 |

结论：**模型后端 authority 已经是 per-DSH_HOME（机制上 per-Agent）**，但主线没有任何
控制面配置面去差异化驱动它——每个 home 拿到同一份全局副本，因此行为上全体一致。
本 Spec 要补的不是新机制，而是**最小 per-Agent 声明面 + 装配驱动**。

### 2.2 CURRENT_PLUGIN_PROVISIONING_SEAM（profile / patch / plugin 装配）

```text
CURRENT_PLUGIN_PROVISIONING_SEAM =
  packages/agent-provisioning/src/index.js — provisionAgentHome(home, workspace, { profile })
  （Router ensureRunning 每次 spawn 前幂等调用，agent-router/src/index.js:544）
```

装配产物（全部幂等、additive-only）：

```text
<home>/
  settings.yaml                        # copyOnce 自 operator 全局（见 §2.1）
  .credentials.yaml                    # copyOnce（OPENCODE_GO_API_KEY）
  profiles/<profile>/package.json      # COPY（CLI 每次启动重写 cordis.yml，故不能共享 symlink）
  profiles/<profile>/cordis.patch.yml  # COPY
  profiles/node_modules/@agent-core/*  # farm SYMLINKS 指回 repo（共享只读代码）
```

- profile 表 `AGENT_PROFILE_DEFS`：profile 名 → repo profile dir + farm links。
  production 用 `agent-core-production`（`profile-production/`：dsh-base +
  bundle-demo + bundle-memory + bundle-agent-switch + bundle-broker）。
- **插件代码共享只读装配的既有先例就是 farm symlink**（repo 一份代码，N 个 home
  链接）；`ensureRepoCoreBridge` 保证传递依赖解析。
- DSH 侧插件安装命令 `dsh plugin --profile <p> add <pkg>@<ver>` = 在
  `<$DSH_HOME>/profiles/<p>/` 内跑 `pnpm add`（harness `apps/cli/src/plugin.ts`，
  `resolveProfileDir` 跟随 `$DSH_HOME`）；profile `package.json` 依赖图 +
  `dsh.profile.bundles` 层表由 reconcile 维护。
- 主线 repo（origin/main 93f9acf）**零** dsh-codex / openai-codex / gpt-5 引用
  （全树 grep 证空）——干净基线。

### 2.3 CURRENT_DSH_HOME_OWNERSHIP（one Agent / one DSH_HOME 的分配方式）

```text
CURRENT_DSH_HOME_OWNERSHIP =
  workspace-bootstrap.resolveDshHome(agentId)（单一 path authority）
  production 实际 = <productionRoot>/homes/<agentId>/（production-runtime/src/paths.js
  layout.homesRoot；默认 root = ~/.agent-core）
```

- Router spawn：`processFactory({ agentId, home, workspace, profile, env: { DSH_AGENT_ID,
  DSH_PRIMARY_WORKSPACE } })` → `spawn(node + cliBin() + ['--profile', profile], { cwd:
  workspace, env: agentEnv(home, …) })`——one Agent = one DSH process = one DSH_HOME
  （D-002/D-006 boundary）。
- 重启恢复：进程死亡 → registry 清除 → 下一条消息 `ensureRunning` 重新
  `provisionAgentHome`（幂等）+ respawn + resume 持久化 session；home 内
  settings/credential/profile 天然跨重启存续。
- 进程身份：trusted CP seam 的 `DSH_AGENT_CHILD_UID/GID`（per-agent uid drop）是
  跨 Agent 文件隔离的物理边界（同 uid 互读已在 secret-boundary audit 实证）。

### 2.4 CURRENT_PER_AGENT_MODEL_OVERRIDE（全局 vs per-Agent）

```text
CURRENT_PER_AGENT_MODEL_OVERRIDE =
  机制层：已存在（per-home settings.yaml + per-home profile 组合天然 per-Agent）
  控制面：不存在（无任何配置面能按 agentId 差异化模型后端；
           provisioning 对所有 home 装配同一份全局副本）
```

**source-verified 证伪**：harness 全树（packages + apps，排除 node_modules）grep
`DSH_AGENT_PROVIDER` / `DSH_AGENT_MODEL` = **0 命中**——这两个 env 变量在 DSH 中
不存在。即使存在也不适用：(a) Router 的 spawn env 是进程级共享底座，表达不了
按 agentId 的差异（除非给 Router 加新特性 = ROUTER_SEMANTIC_CHANGE）；(b) env
不是本仓库的 deployment 声明面；(c) 与 per-home settings authority 的所有权层级
冲突。**否决 env 路线**（同时记录：不得在实现轮发明这两个 env）。

### 2.5 dsh-codex@0.2.3 插件审读（npm tarball source-verified）

| 维度 | 结论（source-verified） |
|---|---|
| 插件身份 | npm `dsh-codex@0.2.3`（GitHub `Yan-Zero/dsh-codex`，Apache-2.0）；Cordis bundle：自带 `cordis.patch.yml`（声明 `dsh.bundle.patch`），bin = `dsh-openai-codex` |
| provider 注册 | 注册 route `openai-codex`（`OPENAI_CODEX_PROVIDER`，store.ts:13）；经 pi-ai `openaiCodexProvider()`；**llm-pi-ai 显式拒绝承载 Codex 类 OAuth route**（README：Codex authenticates through OAuth——所以必须是独立插件，这是本设计引入第三方插件的根因） |
| model catalog | 来自安装的 pi-ai catalog（harness @ a12bb03c 内 pi-ai 0.82.1 实测含 `gpt-5.6-luna` / `gpt-5.6-sol` / `gpt-5.6-terra`）；插件 bundle patch 的 base 默认 = `gpt-5.6-sol`，**settings 用户层（本 Spec 用 gpt-5.6-luna）获胜** |
| credential store | **`<$DSH_HOME>/.openai-codex-auth.json`**（`openAICodexAuthPath` = `resolveDshHome()` 下 `OPENAI_CODEX_AUTH_FILENAME`，store.ts:100-102）——落在 Agent 自己的 home 内，**与 `~/.codex/auth.json`（Codex CLI 自有 store）完全无关** |
| credential 格式/权限 | `{version:1, credential:{type:'oauth', access, refresh, expires, accountId}}`；写 = 原子 + 文件锁 + `mode 0600`、目录 `0700`；**读时强制 owner-only**（mode & 0o077 != 0 → fail loud，store.ts:32-50）；token refresh 由插件在下次请求自动执行 |
| OAuth bootstrap | `dsh plugin --profile <p> exec dsh-openai-codex login`（browser + localhost callback）或 `login --device-code`；`status` 只报非机密状态（authenticated + expiresAt）；`logout` = 删除 credential（需单独显式授权）。`resolveProfileDir` 跟随 `$DSH_HOME` → 可精确作用于目标 Agent home |
| 日志卫生 | settings 服务有 redactSecrets；status 不含 token；INSTALL.md 明令不得输出 OAuth URL / code / token / accountId / auth 文件内容 |
| 组合面 | bundle patch 附带 `- id: web`（searchProvider）与 `openai-codex-tui` insert 行；`agent-core-production` 组合无 web/tui——**这两行在目标组合的实际行为必须在 CONTROLLED_LIVE_ACCEPTANCE 用 `--dump-config` 显式验证**（见 §12 实现注记） |
| 版本兼容 | devDeps 针对 `0.1.0-rc.6` 开发；`dsh-codex@0.2.4` 面向 rc.6——**本 Spec 冻结 0.2.3 + DSH 0.1.0-rc.5 这对已验证组合**，禁 0.2.4、禁 DSH 升级 |

TRUST/LOCK-IN/FALLBACK（按 DSH_PLUGIN_ADOPTION_V1 框架）：

```text
TRUST    = host 平面插件（进程内 JS，等同 bash 权限面）；持 OAuth credential 于
           Agent 自己的 home（0600/0700）；对 chatgpt.com Codex backend 发起请求；
           未发现读取 home 外 credential 的路径（store 路径经 resolveDshHome 解析）
LOCK-IN  = 低（credential 单 JSON 文件，logout 即清；模型选择回到 settings 一段即可）
FALLBACK = 低（disable 配置 → 回到既有 provider/model；其他 Agent 不受影响）
```

### 2.6 实验证据（已确认事实，本轮不重做）

```text
DSH_GPT56_CHATGPT_SUBSCRIPTION_ROUNDTRIP = PASS
USES_CHATGPT_SUBSCRIPTION_QUOTA = YES
USES_OPENAI_API_CREDITS         = NO
DSH = 0.1.0-rc.5（commit a12bb03c6861969985f066bfbf0cb7e5dd5ac567）
dsh-codex = 0.2.3 / provider = openai-codex / model = gpt-5.6-luna
Main Agent 使用成功 / restart persistence = PASS / KERNEL_CHANGE = NONE
~/.codex/auth.json 未被读取或修改
```

实验目录（/tmp 等）**只作可行性 evidence**：本 Spec 的主线行为结论（§2.1–§2.5）
全部来自 source-verified 主线与插件源码；实验 credential **不得**复制进主线
（§6）。兼容组合暂时固定：**DSH 0.1.0-rc.5 + dsh-codex 0.2.3**；不升级 DSH，
不使用面向 rc.6 的 dsh-codex@0.2.4。

---

## 3. 启用范围（V1 冻结）

```text
DEFAULT_MODEL_CHANGED = NO
  （全局默认仍是 operator settings 副本 / MINIMAL_SETTINGS =
   opencode-go / deepseek-v4-flash；本 Spec 不改任何全局默认）

ENABLED_AGENTS = exactly one explicitly selected Agent
  （由 deployment 配置显式命名一个 agentId；本 Spec 冻结机制与 ≤1 约束，
    具体 agentId 在部署 / CONTROLLED_LIVE_ACCEPTANCE 阶段指定）

GLOBAL_ENABLEMENT = FORBIDDEN
  （禁止任何把 openai-codex 变成全局默认的配置形态；
    配置文件出现 >1 个 agent 条目 = 加载时 fail loud）
```

**未显式配置的 Agent 行为必须逐字节保持现状**：其 home 的 provisioning 产物
（settings.yaml 副本、.credentials.yaml、profile COPY、farm links）与今天完全
一致——不新增文件、不修改 settings、不安装插件（§9 有逐字节回归验收）。

---

## 4. 配置 seam（最小静态 deployment config）

### 4.1 现有体系为什么表达不了

| 现有面 | 为什么不行 |
|---|---|
| `agents.json`（agent-definition） | schema 冻结为 identity + display（id/name/description/disabled）；加载 fail-loud 拒绝 persona/workspace/credential/runtime 字段。**禁止修改 AgentDefinition 产品身份模型** |
| env（`DSH_AGENT_PROVIDER`/`DSH_AGENT_MODEL`） | §2.4 已证伪：变量不存在于 DSH；env 是 Router spawn 共享底座，非 per-Agent 声明面；与 per-home settings authority 冲突 |
| operator 全局 `~/.dsh/settings.yaml` | `copyOnce` 进每个 home——改它影响**所有** Agent（= GLOBAL_ENABLEMENT，FORBIDDEN） |
| 手工改单个 home 的 settings.yaml | 机制上可行但无声明 owner：无版本、无校验、重启/重建 home 后不可靠、无法表达 requiredPlugin pin。需要的是 deployment-authored 静态配置 + 装配时 fail-loud 驱动 |

### 4.2 冻结的配置面（复用 primary-workspaces.json 先例）

采用与 `AGENT_PRIMARY_WORKSPACE_IMPORT_V1`（accepted）完全同构的 deployment-authored
静态配置模式：production root 下一份静态 JSON，mount 时由 production-runtime 读取并
fail-loud 校验，交给唯一装配 authority，runtime **永不写**它：

```text
CONFIG_SEAM = <productionRoot>/agent-model-providers.json
（默认 ~/.agent-core/agent-model-providers.json；文件缺席 = 零启用 = 行为与今天逐字节相同）

{
  "version": 1,
  "agents": {
    "<agentId>": {
      "provider": "openai-codex",
      "model": "gpt-5.6-luna",
      "plugin": { "name": "dsh-codex", "version": "0.2.3" }
    }
  }
}
```

加载时 fail-loud 校验（mount 阶段，全部结构化报错）：

```text
MODEL_PROVIDER_CONFIG_VALIDATION =
  version == 1
  agents 恰好 ≤1 条（>1 条 = GLOBAL_ENABLEMENT 违规，拒绝加载）
  agentId 必须存在于 agents.json 且未 disabled
  provider 必须 == "openai-codex"（V1 白名单：只有这一个可选后端）
  model 必须在该插件实际提供的 catalog 内（gpt-5.6-luna/sol/terra @ pi-ai 0.82.1）
  plugin.name 必须 == "dsh-codex"；plugin.version 必须精确 semver（禁 range）
  （校验失败的部署不允许带病启动——fail loud，绝不静默降级）
```

接线（与 primary-workspaces.json 相同的 composition 层模式）：

```text
production-runtime compose.js（读取 + 校验）
→ applyRouter({ …, agentModelProviders })  — 与 agentProfile 同类的 router 级配置透传
→ Router ensureRunning 对命中的 agentId 把该条目【不解释地】传给
  provisionAgentHome(home, workspace, { profile, modelProvider })
→ Router 不新增任何模型逻辑 / provider 分支（ROUTER_SEMANTIC_CHANGE = NONE；
  透传方式与 cfg.agentProfile 完全同构）
```

### 4.3 provisionAgentHome 对命中条目的冻结语义

`provisionAgentHome` 是 per-Agent DSH_HOME 装配的唯一 authority。命中条目时追加
三步（全部幂等、fail-loud、只动目标 home）：

```text
PLUGIN_ENSURE（§5 冻结详细语义）
SETTINGS_SECTION_MERGE
  幂等地把 settings.yaml 的 agent-default-model: 段写为
    { provider: openai-codex, model: gpt-5.6-luna }
  —— 段作用域合并：只动这一个 section，保留文件内一切无关键值
  （llm-pi-ai: / 其他段原样）；不写任何 credential 内容进 settings.yaml
COMPOSITION_VERIFY
  在该 DSH_HOME 下验证有效组合：插件已加载（llm-openai-codex ← dsh-codex）
  且 agent-default-model 解析为 openai-codex / gpt-5.6-luna
  （实现载体：dsh --profile agent-core-production --dump-config 于该 home 下执行
    并结构化断言；验证失败 = fail loud，不视为已启用）
```

**不修改**：Binding、Session、Router routing semantics、AgentDefinition 产品身份模型。

---

## 5. Plugin provisioning（代码所有权 vs credential 所有权分离）

```text
PLUGIN_VERSION = 0.2.3（exact pin；range/缺省 = 配置校验拒绝）
DSH_VERSION    = 0.1.0-rc.5（exact compatibility pin；对应 harness commit
                 a12bb03c68…；不匹配 = fail loud）
```

冻结要求：

```text
PLUGIN_PROVISIONING_SEMANTICS =
  idempotently verify / install / enable required plugin
    （在目标 Agent home 的 agent-core-production profile 内：
      dsh-codex 出现在 profile 依赖图 + dsh.profile.bundles，
      且 <home>/profiles/<p>/node_modules/dsh-codex 可解析）
  fail-loud on version mismatch
    （已装版本 != 0.2.3 → 结构化 PLUGIN_VERSION_MISMATCH，拒绝启用该条目；
      绝不自动 upgrade/downgrade）
  fail-loud on DSH version mismatch
    （harness 版本 != 0.1.0-rc.5 兼容组合 → 拒绝启用；NEVER auto-upgrade DSH）
  never silently fall back to another provider
    （插件缺失/版本不符/组合验证失败 = 目标 Agent 的模型后端启用失败并 fail loud，
      绝不落回 opencode-go 继续跑——那是静默换模型）
```

插件代码所有权：

```text
PLUGIN_CODE_OWNERSHIP = 共享只读单副本（复用现有 farm 装配方式）
  插件代码在 repo 管理的位置安装一份（版本 pin 0.2.3），
  以与现有 @agent-core farm links 同构的 symlink 方式挂进
  <home>/profiles/<p>/node_modules/dsh-codex；
  【不得】无依据强制每个 DSH_HOME 复制一套插件代码。
  （若实现证明 symlink 挂载在该组合下不可行——例如 pnpm 布局/解析限制——
    必须以证据提出 per-home install 的最小例外并在实现轮记录理由；
    默认冻结 = 共享只读单副本。）
```

与 credential 所有权的关系：**plugin code ownership（repo，共享只读）与 OAuth
credential ownership（该 Agent 的 DSH_HOME，私有）是两个不同的所有权**，不得合并
（§6）。

---

## 6. OAuth credential ownership

```text
one Agent = one DSH process = one security domain（D-006，重申不变）

CREDENTIAL_OWNER = <target-agentId>（deployment 配置命名的唯一 Agent）
CREDENTIAL_STORE = <该 Agent 持久化 DSH_HOME>/.openai-codex-auth.json
                  （插件自管：resolveDshHome 解析、0600 原子写、0700 目录、
                   读时 owner-only 强制——§2.5 source-verified，非实验推测路径）
OAUTH_BOOTSTRAP_MODE = OPERATOR_INTERACTIVE
  操作者对该 Agent home 执行一次：
    DSH_HOME=<home> dsh plugin --profile agent-core-production \
      exec dsh-openai-codex login          # browser localhost callback
    （无浏览器环境用 login --device-code）
  status 校验（非机密）：… exec dsh-openai-codex status → signed in
SHARES_CODEX_AUTH_FILE = NO
  （不读、不写、不复制 ~/.codex/auth.json；那是 Codex CLI 的自有 store）
```

禁止清单（全部冻结）：

```text
FORBIDDEN =
  从 /tmp 实验目录直接复制 credential
  多 Agent 复制同一 refresh token（一个 token 只属于一个 Agent home）
  读取 / 修改 ~/.codex/auth.json
  把 credential 存入 Agent Workspace
  把 credential 存入 Binding / AgentDefinition / agents.json
  经 env / argv / prompt / Feishu 传递 token
    （same-uid audit 硬前提 1：env/argv 同 uid 全量可读——credential 永不经
      env/argv；插件文件内读取即满足）
  Router / 控制面进程读取或中转该 credential
    （credential 只在目标 Agent 自己的进程内由插件读取；Router 不新增任何
      credential 路径——与 broker「child holds no credential」之外的既有边界一致）
```

卫生要求（实现 + 验收冻结）：

```text
credential file mode = 0600（插件强制 + provisioning 验证复核）
credential directory = 0700 且不被 git 跟踪（homes 在 repo 外 + 显式规则：
  任何 repo 内路径出现该文件 = 违规）
logs 不含 access/refresh token（router/evidence/插件日志——status 只报
  authenticated + expiresAt）
errors 不回显 secret（失败信息只命名 layer/provider，不 echo token）
backup / public-archive policy 排除 credential：
  现有 deployment backup（AGENT_CORE_BACKUP_RETENTION_V1）只覆盖 trusted install
  closure（/usr/local/libexec/agent-core.bak-*），不含 ~/.agent-core homes——
  保持该边界；未来任何覆盖 <productionRoot> 的备份/归档机制必须显式排除
  .openai-codex-auth.json 与 .credentials.yaml 类文件
```

---

## 7. Failure semantics

错误分类（全部 fail loud、标识 provider/account 层、不报为 Kernel failure、
不静默换模型）：

| 类别 | 发生层 | 行为 |
|---|---|---|
| `plugin_missing` | provisioning（spawn 前） | 结构化错误：openai-codex 后端未装配；目标 Agent 启用失败，fail loud；**不落回其他 provider** |
| `plugin_version_mismatch` | provisioning | 同上，错误指名 期望 0.2.3 vs 实际版本；绝不自动升级 |
| `dsh_version_mismatch` | provisioning | harness != 0.1.0-rc.5 兼容组合；拒绝启用；绝不升级 DSH |
| `credential_missing` | 请求时（LlmError） | 目标 Agent turn 失败，错误标识 openai-codex OAuth credential 缺失（操作者走 §6 login 修复）；非 Kernel failure |
| `oauth_expired_or_revoked` | 请求时 | 插件自动 refresh 失败（过期/吊销）→ turn 失败并标识 OAuth 层；操作者重新 login；非静默换模型 |
| `provider_unavailable` | 请求时 | 网络/服务不可达 → turn 失败，标识 provider 层 |
| `account_quota_exhausted` | 请求时 | ChatGPT subscription 配额/限流 → turn 失败，标识 account 层 |
| `model_unavailable` | 请求时 | UNKNOWN_MODEL 类 → turn 失败，指名 provider+model |

```text
AUTOMATIC_FALLBACK = OUT_OF_SCOPE
  （不允许任何 fallback 到 opencode-go / 其他 provider / 其他 model；
    「换模型」只能是 §8 的显式 rollback）
FAIL_LOUD_SURFACING =
  目标 Agent 的 turn/deliver 错误结构化携带 provider 层标识
  （provider=openai-codex + 错误类别），不冒充 Kernel/Router 错误
```

---

## 8. Rollback

```text
ROLLBACK_SCOPE = target Agent only
DEFAULT_MODEL_UNCHANGED = YES

rollback 步骤（冻结，只有这一条路径）：
  1. disable/remove 目标 Agent 的 model override
     （从 agent-model-providers.json 删除该条目或整份文件）
  2. restore previous provider/model config
     （移除该 home settings.yaml 的 agent-default-model 覆盖段 →
       回到 operator 全局副本语义 = opencode-go / deepseek-v4-flash；
       插件代码可留在共享只读位置——不参与组合即不生效）
  3. restart target Agent process
     （Router respawn 幂等重装配：无条目 → 该 home 回到 default 装配）

不要求删除 OAuth credential（.openai-codex-auth.json 留在原 home；
  显式 logout 是独立的、需单独授权的操作）
不影响其他 Agent（它们的 home 从未被触碰）
```

---

## 9. 测试分层

### 9.1 普通自动化测试（进 CI，无真实 OAuth / 无网络）

```text
AUTOMATED_TEST_SCOPE =
  config parsing：合法 / 非法（>1 条目、未知 agent、disabled agent、
    非 openai-codex provider、非白名单 model、range 版本、坏 JSON）→ 各自结构化拒绝
  per-Agent opt-in：命中条目只影响目标 home（settings 段合并 + 插件装配）
  default Agent regression：无配置文件 / 未命中条目时，provisioning 产物与
    现状【逐字节】一致（settings.yaml / profile COPY / farm links 全比照）
  plugin pin / version mismatch：装 0.2.4 或其他版本 → fail loud（模拟 fixture）
  missing credential fail-loud：credential 缺失时启用/请求路径的结构化错误
    （不含 token 内容）
  log redaction：router/evidence/插件状态输出无 token 形态字符串
  restart config persistence：重复 provisionAgentHome（幂等）不破坏
    settings 段 / 插件装配；home 既有内容不被覆盖（copyOnce 语义保持）
  rollback config：删除条目 → 该 home 恢复 previous provider/model 配置
```

### 9.2 真实 OAuth / 套餐请求：CONTROLLED_LIVE_ACCEPTANCE（见 §12）

不进入普通 CI。自动 refresh：**不人为破坏 token**；自然到期刷新 = follow-up
observation（记录观察项，不设人工破坏性验收）。

---

## 10. Scope（Allowed for Implementation，实现轮）

```text
FILES_TO_CHANGE（预期）=
  packages/agent-provisioning/src/index.js   # modelProvider 装配语义（§4.3/§5）
  packages/production-runtime/src/compose.js # 读取 + 校验 + 透传 agent-model-providers.json
  packages/agent-router/src/index.js         # 仅配置透传（与 agentProfile 同构，无新语义）
  tests（§9.1 全项）
  docs/runbooks/*（如需 controlled acceptance runbook）
```

本轮（Spec）**不改任何代码**。

---

## 11. Non-Goals and Frozen Boundaries

```text
KERNEL_CHANGE            = NONE
ROUTER_SEMANTIC_CHANGE   = NONE
SESSION_MODEL_CHANGE     = NONE
Binding / Session / Router routing semantics / AgentDefinition 产品身份模型 = 不修改
agents.json schema       = 不动（identity+display only 维持）
DEFAULT_MODEL_CHANGED    = NO
GLOBAL_ENABLEMENT        = FORBIDDEN

explicit non-goals =
  model router / fallback / 负载均衡            （不许顺手建设）
  OpenAI API Key / OpenAI API credits           （本后端 = ChatGPT subscription）
  quota scheduling / account pool
  shared global OAuth credential / credential service
  DSH upgrade / dsh-codex 0.2.4
  external live OAuth in ordinary CI
  任何把 provider 选择逻辑放进 Router / Kernel 的形态
```

---

## 12. Acceptance — CONTROLLED_LIVE_ACCEPTANCE（实现完成后执行，非本轮）

必须逐项验证（一次性受控验收，真人操作者执行）：

```text
A. formal persistent DSH_HOME（~/.agent-core/homes/<target-agentId>，非 /tmp）
B. plugin loaded（该 home 组合内 llm-openai-codex ← dsh-codex@0.2.3；
   --dump-config 结构化断言；同时记录 web/tui patch 行在 agent-core-production
   组合下的实际行为——§2.5 实现注记）
C. resolved provider/model correct（agent-default-model → openai-codex/gpt-5.6-luna）
D. first real request（真实模型 turn，走 ChatGPT subscription）
E. full process exit（目标 Agent 进程完整退出）
F. restart without reinjecting token（Router respawn；无任何 token 重注入动作）
G. second real request（重启后第二次真实 turn 成功）
H. ~/.codex/auth.json hash/mtime unchanged（全程未读/未写）
I. OPENAI_API_KEY absent（目标 Agent 子进程 env 无 OPENAI_API_KEY）
J. no api.openai.com traffic（后端流量只到 ChatGPT/Codex 端点；
   USES_OPENAI_API_CREDITS = NO）
K. credential mode 0600（+ 目录 0700）
L. disabled config restores previous model（删条目 → 重启 → opencode-go/
   deepseek-v4-flash 恢复）
M. other Agents unchanged（其他 Agent home / 行为逐字节比对不变）

follow-up observation（非阻塞）：
  natural token expiry refresh（自然到期后自动刷新，观察记录即可）
```

---

## Final Output

```text
AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1_SPEC = PASS

BASE_MAIN = 93f9acf（origin/main）
HEAD      = 本 Spec commit（docs/agent-core-chatgpt-subscription-provider-v1 分支）

INTEGRATION_LAYER = per-Agent DSH_HOME 装配层（settings.yaml agent-default-model 段
                    + profile 插件组合），非 Kernel / 非 Router 语义 / 非 Session 模型
CURRENT_MODEL_CONFIG_AUTHORITY = <DSH_HOME>/settings.yaml
                    （agent-default-model 用户层 > bundle patch base；
                      DSH_AGENT_PROVIDER / DSH_AGENT_MODEL env 在 DSH 中不存在——
                      source-verified 证伪）
CONFIG_SEAM = <productionRoot>/agent-model-providers.json
                    （deployment-authored 静态 JSON；缺席 = 零启用；
                      mount 时 fail-loud 校验；runtime 永不写；
                      复用 AGENT_PRIMARY_WORKSPACE_IMPORT_V1 的 primary-workspaces.json 先例）
PER_AGENT_OPT_IN = YES（≤1 条目；>1 = 加载拒绝 = GLOBAL_ENABLEMENT FORBIDDEN）

DSH_VERSION = 0.1.0-rc.5（harness a12bb03c68…，exact compatibility pin）
PLUGIN_VERSION = 0.2.3（exact pin；0.2.4 / range 禁止）
PROVIDER = openai-codex
MODEL = gpt-5.6-luna

PLUGIN_PROVISIONING_SEAM = provisionAgentHome 命中条目的 PLUGIN_ENSURE +
                    COMPOSITION_VERIFY（幂等 / fail-loud / never auto-upgrade /
                    never silent fallback）
PLUGIN_CODE_OWNERSHIP = repo 管理共享只读单副本（farm symlink 同构）；
                    credential 所有权独立归目标 Agent home

CREDENTIAL_OWNER = <target-agentId>（deployment 命名的唯一 Agent）
CREDENTIAL_STORE = <该 Agent DSH_HOME>/.openai-codex-auth.json
                    （插件自管，0600/0700/owner-only 强制——插件源码 verified）
OAUTH_BOOTSTRAP_MODE = OPERATOR_INTERACTIVE
                    （DSH_HOME=<home> dsh plugin … exec dsh-openai-codex login；
                      browser/device-code；status 非机密）
SHARES_CODEX_AUTH_FILE = NO（~/.codex/auth.json 全程不读不写不复制）

DEFAULT_MODEL_CHANGED = NO
ENABLED_AGENTS = 恰好一个（机制 + ≤1 约束本轮冻结；具体 agentId 由部署/
                  CONTROLLED_LIVE_ACCEPTANCE 阶段显式指定）

FAILURE_SEMANTICS = plugin_missing / plugin_version_mismatch / dsh_version_mismatch /
                    credential_missing / oauth_expired_or_revoked /
                    provider_unavailable / account_quota_exhausted / model_unavailable
                    —— 全部 fail loud、标识 provider/account 层、非 Kernel failure、
                    不静默换模型；AUTOMATIC_FALLBACK = OUT_OF_SCOPE
ROLLBACK = disable 条目 → 恢复 previous provider/model → 重启目标 Agent 进程；
                    不删 credential；其他 Agent 不受影响

AUTOMATED_TEST_SCOPE = §9.1（config parsing / opt-in / default 逐字节回归 /
                    version pin fail-loud / missing credential / log redaction /
                    restart persistence / rollback config）
CONTROLLED_LIVE_ACCEPTANCE = §12 A–M（真实 OAuth/套餐请求只进受控验收，不进 CI；
                    自然到期 refresh = follow-up observation）

KERNEL_CHANGE = NONE
ROUTER_SEMANTIC_CHANGE = NONE（Router 仅与 agentProfile 同构的配置透传）
SESSION_MODEL_CHANGE = NONE

SPEC_STATUS = proposed
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES
```
