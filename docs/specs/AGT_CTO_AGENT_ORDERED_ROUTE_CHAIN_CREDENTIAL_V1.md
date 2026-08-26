---
spec_id: AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_CREDENTIAL_V1
status: proposed
date: 2026-08-27
type: credential-authorizing child Spec (SPEC ONLY — 本轮只冻结凭据操作授权边界；不写凭据、不登录 OAuth、不改配置、不部署)
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: bounded-credential-ops (gated; 见 §3 — proposed 阶段不授权任何操作)
parent_policy_authority:
  AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1
governed_by:
  - AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1
  - AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
supersedes: []
superseded_by: null
scope:
  - 父 Spec Q-3（Luna 就绪轮：provisioning + operator 亲自交互式 OAuth）与 GLM
    primary credential 就绪所推迟的「独立授权」（父 §13 Q-3「另行 dispatch」；
    IMPL 子 Spec §2.2「Credential / provisioning / OAuth：零授权……仍需独立轮次」）
    ——本文件即该独立轮次的授权 authority
  - 仅 agt_cto-agent 的 production Home（/Users/authsvc/.agent-core/homes/agt_cto-agent）
    内的模型 provider credential 就绪操作：settings.yaml zai 声明、.credentials.yaml
    ZAI_API_KEY、dsh-codex@0.2.3 安装、全新交互式 OAuth、受控 initialize + no-tool canary
  - 生效硬依赖：父 Spec Amendment 1（Builtin Route Kind；GitHub PR 编号见正文
    §3 GATE-2）accepted 且进入 main 之后，本 Spec 的授权方可生效
owners:
  - repository-maintainers
references:
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1.md（accepted @ main 7ab2e6d；
    父 policy authority；本 Spec 是其 §13 Q-3 显式另行 dispatch 的独立凭据授权；
    不改其任何语义；其 Amendment 1（Builtin Route Kind，GitHub PR 编号见正文
    §3 GATE-2，proposed）是本 Spec 的生效前置）
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1.md（accepted @ main 4d92e31；
    实现授权 sibling child；其 §2.2 冻结 credential 零授权并指向本类独立轮次；
    本 Spec 不触及其 F-1..F-10 / DEC-IMPL / CTR-IMPL 任何条文）
  - docs/specs/AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1.md（superseded；历史
    normative meaning 不重开；其 §4/§5 的 credential ownership / plugin provisioning
    边界表述由父 Spec CTR-010/CTR-014 吸收并由本 Spec 在生产新事实上重新冻结）
  - docs/runbooks/luna-manual-backup-v1.md（旧 root 时代 runbook，BLOCKED；本 Spec
    引用其网络事实（chatgpt.com 仅经本地代理可达）与旧 root 一次性状态清单，
    不复活其 v1 override 机制）
  - docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1.md（accepted；Broker
    credential 族的 authority——与 model-provider credential 分族；本 Spec 沿用其
    Part H secret-handoff 纪律的精神，不受其 Part D 状态机管辖）
---

# AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_CREDENTIAL_V1 — agt_cto-agent 路由链凭据就绪的最小授权（credential-authorizing child authority）

> SPEC_STATUS = **proposed**（authoring 2026-08-27，任务「链路 凭据授权执行」；
> awaiting independent review；Draft PR，不 merge、不写凭据、不登录 OAuth、
> 不改配置、不部署）。
> 本文件是 `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1`（accepted，下称**父 Spec**）的
> **最小 credential-authorizing child authority**：父 Spec §13 Q-3 冻结「Luna 就绪轮
> （provisioning + operator 交互式 OAuth 到新 Home）的独立授权与执行时序：另行
> dispatch」，IMPL 子 Spec §2.2 冻结「Credential / provisioning / OAuth：零授权
> ……仍需独立轮次」——本文件即该被推迟的独立授权。它**不 supersede 任何 Spec**：
> 父 Spec 保持唯一 model-route policy authority；本 Spec 只在 Q-3 + GLM credential
> 就绪这一被显式预留的缝内，授予有界的生产凭据操作权限，并冻结执行轮绑定决策。
>
> **授权生效条件（双重 gate，冻结）**：(GATE-1) 本 Spec `status: accepted` **且**
> 已进入 main；(GATE-2) 父 Spec Amendment 1（Builtin Route Kind，PR #77）已
> accepted 且已进入 main。任一未满足时 `CREDENTIAL_OPERATIONS_ALLOWED = NO`。
> GATE-2 的依据：zai/glm-5.3 的 `routeKind = builtin` 表达、`zai-api-key-home` /
> `luna-oauth-home` 两个 credentialReadiness reference 的语义，均由 Amendment 1
> 冻结；Amendment 1 未生效时本 Spec 的就绪对象在配置语法上不存在。
> proposed 阶段本 Spec 不授权任何操作（Owner 任务指令 2026-08-27 原文冻结）。
>
> 本轮（authoring round）DOCS ONLY：不写任何 Credential，不执行 OAuth，不安装
> 插件，不写 agent-model-overrides.json，不激活 fallback，不修改 Scheduler /
> Binding / Agent Definition / launchd，不部署产品代码，不重启任何进程，不 merge。

---

## 1. Goal

把父 Spec 为 agt_cto-agent 冻结的初始目标链（Amendment 1 A1.4：`glm53`（builtin /
zai / glm-5.3）primary + `luna`（subscription / openai-codex / gpt-5.6-luna @
dsh-codex@0.2.3）fallback）所需的**两份 production credential 就绪**（父 Q-2 残余
的 zai 生产注入核实 + Q-3 Luna 就绪）转化为最小、有界、可评审的**凭据操作授权**。
一次授权恰好覆盖以下范围（Owner 任务指令 2026-08-27 逐项冻结；每项标注依据）：

| # | 冻结授权范围 | 依据 |
|---|---|---|
| C-1 | production Home `settings.yaml` **新增** zai/glm-5.3 模型声明（additive；`agent-default-model` 逐字节不变） | 任务指令；A1.4 tuple；§4 生产 settings 现状 |
| C-2 | production Home `.credentials.yaml` 写入 Owner 提供的 `ZAI_API_KEY`（其余 entry 原样保留） | 任务指令；pi-ai `envApiKeyAuth(["ZAI_API_KEY"])` |
| C-3 | credential 文件 owner = uid 502、mode 0600（目录 mode 见 DEC-C-002 / Q-C-1） | 任务指令；父 CTR-014；§4 权限实证 |
| C-4 | GLM 受控 initialize + no-tool canary（生产 Home、child uid、无生产流量） | 任务指令；父 CLM-005/A1.0 探针语义 |
| C-5 | production Home 安装 dsh-codex@0.2.3（exact、target-home-only、bundles 注册） | 任务指令；父 CTR-011；历史 PROVIDER_V1 §5 语义 |
| C-6 | Owner 亲自交互式 OAuth，在 production Home **新生成** `.openai-codex-auth.json` | 任务指令；父 CTR-014；Q-3 |
| C-7 | Luna 受控 initialize + no-tool canary（同 C-4 隔离语义） | 任务指令；父 Q-3 |
| C-8 | 就绪后回填事实记录（readiness 事实 ≠ 配置激活；不写任何 overrides 文件） | 父 A1.4（providerEnv 值与激活同属部署轮） |

本 Spec 新增的唯一规范性内容 = 执行轮绑定决策（§6 DEC-C-*：key 交付、目录 mode
裁决、安装路径、probe 隔离、harness 身证 blocker）与操作契约（§7/§8 CTR-C-*）。
全部在父 Spec 冻结政策内，无一改写父 Spec ruling；执行中发现 Contract 缺口时，
走 governance §10 stop → report → 独立 docs-only 变更 → 重启执行。

## 2. Scope and non-goals

### 2.1 In scope（= §1 C-1..C-8 的凭据操作授权；仅 agt_cto-agent 一个 Home）

- `<HOME>` = `/Users/authsvc/.agent-core/homes/agt_cto-agent`（父 STATE-001）：
  - `settings.yaml` 的 zai provider 块新增（§7 CTR-C-101）；
  - `.credentials.yaml` 的 `ZAI_API_KEY` entry 写入（§7 CTR-C-102）；
  - `.openai-codex-auth.json` 的全新生成 + 边界验证（§8 CTR-C-201..204）；
  - `profiles/node_modules/dsh-codex@0.2.3` 安装 + 版本核验 + peer 解析核验 +
    `profiles/agent-core-production/package.json` 的 `dsh.profile.bundles` 追加
    （§8 CTR-C-205..207）；
  - Home 目录 / 上述文件的 owner=uid 502 与 mode 契约（§6 DEC-C-002 / Q-C-1）；
  - 两条受控 canary（§7 CTR-C-103 / §8 CTR-C-208）。
- 执行角色冻结：credential 值的输入与 OAuth 登录 = **Owner 亲自**（DEC-C-001）；
  机械步骤（编辑、安装、核验、probe 驱动）可由执行 agent 在 Owner 同会话逐步
  交互中执行（每次一条命令，Owner 可见可拦）。

### 2.2 Out of scope（明确不授权；执行轮触碰即 out-of-spec）

- **写 `agent-model-overrides.json`**（生产 root 该文件保持 ABSENT，执行前后
  各核验一次）；**激活 fallback / Route Chain**（全局 env route 保持
  oc-go/deepseek-v4-flash；`agent-default-model` 逐字节不变）。
- **改 Scheduler / Binding / Agent Definition / launchd**（plist 全字节不动；
  `DSH_AGENT_PROVIDER/MODEL`、`DSH_AGENT_CHILD_UID/GID`、`DSH_HARNESS_ROOT` 等均
  不变；**禁止**把 `ZAI_API_KEY` 或任何 token/secret 写进 launchd env）。
- **部署产品代码 / 重启任何进程**（packages/ 零改动；无 deployment；无 restart；
  runtime / Router / Scheduler 进程不触碰）。
- **复制或输出任何 secret**（§9 全文；含旧 OpenClaw、旧 root、`~/.codex/auth.json`）。
- **credentialReadiness 的“主张”**：本 Spec 只让 `zai-api-key-home` /
  `luna-oauth-home`（A1.4 reference）成为**可满足**；在 v2 配置中实际引用它们
  = 激活部署轮，不在本授权内（父 A1.4「本 Amendment 不写入任何配置、不授权激活」
  同义延伸到本 Spec）。
- **生产 Harness 无 .git 的 identity 问题修复**：仅按 DEC-C-005 记录为激活部署
  blocker；不得在本凭据执行轮内设计或实施任何部署修复（Owner 任务指令原文）。
- **父 / IMPL / Amendment 1 文件改动**：`GOVERNING_SPEC_UNMODIFIED`——执行轮
  不得修改 `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1.md`、
  `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1.md`（execution agent 不得扩张自己
  的 governing Spec）。
- **共享模板 `profile-production/` 改动**（不得使未来 Agent 默认获得 dsh-codex；
  历史 PROVIDER_V1 §5 边界原样延续）。
- **其他 Agent Home / 其他 credential 族**（Broker credential store 归
  AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 管辖，本 Spec 不碰
  `agent-credentials.json` / auth-service 对象）。

## 3. Authority and dependencies

```text
AUTHORITY_FORM   = child credential-authorizing Spec（不 supersede 任何 Spec）
PARENT_POLICY    = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1（accepted @ main 7ab2e6d）
SIBLING_IMPL     = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1（accepted @ 4d92e31）
GATE-1           = 本 Spec accepted AND 已进入 main
GATE-2           = 父 Spec Amendment 1（Builtin Route Kind，PR #77）accepted AND
                   已进入 main（本轮 authoring 时 PR #77 = OPEN / Draft /
                   proposed，head 8b76909c33dfc39693c6f8e760eb1a29c80d0727）
CREDENTIAL_OPERATIONS_ALLOWED = GATE-1 AND GATE-2（缺一即 NO）
```

- 与父 Spec 的分工：父 Spec = 路由政策与 credentialReadiness **语义**；本 Spec =
  **凭据就绪操作**的授权与执行轮绑定（谁可以在哪个 Home 写哪个文件、key 怎么
  交付、probe 怎么隔离）。政策语义冲突时以父 Spec 为准，本 Spec 对应条文自动
  失效并触发 governance §10 gap 流程。
- 生效顺序冻结：本 Spec 的 acceptance **可以**先于 PR #77 完成（authoring /
  review / accept 不依赖 GATE-2）；但**执行**（第一个凭据操作）必须在 GATE-1
  AND GATE-2 同时成立后开始。执行轮开始时必须 fresh-fetch 核验两 gate 并记录
  commit 坐标。
- 与 IMPL 子 Spec 的关系：正交。IMPL 授权代码实现（已完成，PR #76）；本 Spec
  授权生产凭据操作。Amendment 1 生效后的 loader routeKind 对齐实现轮
  （IMPL Amendment 1 AI1.2/AI1.3）**不是**本 Spec 的 GATE（凭据文件不依赖
  loader 行为），但它是激活部署轮的前置——记录于 §6 DEC-C-005 blocker 清单。

## 4. Current State（只读核实；2026-08-27，base = origin/main `c52bd1c`）

- `STATE-C-001` — 生产布局：launchd `ai.agent-core.runtime` 以 **authsvc(505)**
  运行，`--root /Users/authsvc/.agent-core`；`DSH_AGENT_CHILD_UID=502` /
  `DSH_AGENT_CHILD_GID=20`（per-agent DSH child 经 setuid helper 以 yanfenma(502)
  运行，故 Home 树归 502）；`DSH_HARNESS_ROOT=/usr/local/libexec/agent-core/harness`。
  Basis: `OBS-C-001`。
- `STATE-C-002` — 当前有效路由 = 全局 env route `oc-go/deepseek-v4-flash`；
  生产 root `agent-model-overrides.json` ABSENT；launchd env 无 `ZAI_API_KEY`
  及任何 openai/ codex / proxy 变量。Basis: `OBS-C-001`、`OBS-C-002`。
- `STATE-C-003` — production Home（owner yanfenma/502）现状：`settings.yaml`
  （500B, 0600）声明 opencode-go + oc-go 两 provider，
  `agent-default-model = opencode-go/deepseek-v4-flash`，**无 zai 块**；
  `.credentials.yaml`（172B, 0600，内容未读取）；`sessions/` 0700；
  `profiles/agent-core-production/package.json` 的 bundles 无 dsh-codex；
  `profiles/node_modules` 无 dsh-codex。Basis: `OBS-C-003`、`OBS-C-004`。
- `STATE-C-004` — Home 目录 mode = **0755**（非 0700）；同目录存留
  `agt_cto-agent.pre-permrepair-20260822-061954`（0700，2026-08-22 permrepair 的
  备份）与 `.bak-dualpass-20260822-*` 文件；全部 96 个活动 Home 均 0755。
  父 CTR-014「directory 0700」与 authsvc 运行时存在机械冲突（DEC-C-002 /
  Q-C-1）。Basis: `OBS-C-005`、`OBS-C-006`。
- `STATE-C-005` — dsh-codex@0.2.3 的 19 个 peerDependencies 在 production Home
  `profiles/node_modules` 下**全部已可解析**（symlink 指向生产 harness）。Basis:
  `OBS-C-007`。
- `STATE-C-006` — 生产 harness（`/usr/local/libexec/agent-core/harness`）=
  0.1.0-rc.8、authsvc 属主、**无 `.git`** ⇒ `readHarnessIdentity()`（git
  rev-parse）在生产不可执行 ⇒ spawn 内建 `provisionExactProfilePlugin` 的
  in-band 安装/身份核验路径在生产 fail-loud（`dsh_commit_mismatch` 族）。Basis:
  `OBS-C-008`。
- `STATE-C-007` — 旧 root（yanfenma）Home 仍保留 `.openai-codex-auth.json`
  （0600, 2092B, 2026-08-20）与 dsh-codex@0.2.3 安装；父 Spec 不授权复制
  （OBS-005 / CTR-014），本 Spec 同禁。旧 root `settings.yaml` 含 zai 块
  生产先例形态（§7 CTR-C-101 引用其**形态**，禁复制其 credential 值）。Basis:
  `OBS-C-009`。
- `STATE-C-008` — 网络事实：chatgpt.com 后端仅经本地代理（ClashX
  127.0.0.1:7890）可达（旧 root 时代实测；执行轮需现场复核）。Basis:
  `OBS-C-010`。

## 5. Observations（只读，2026-08-27）

- `OBS-C-001` — `plutil -p /Library/LaunchDaemons/ai.agent-core.runtime.plist`：
  UserName=authsvc；EnvironmentVariables 含 `DSH_AGENT_CHILD_UID=502`、
  `DSH_AGENT_CHILD_GID=20`、`DSH_AGENT_PROVIDER=oc-go`、
  `DSH_AGENT_MODEL=deepseek-v4-flash`、
  `DSH_HARNESS_ROOT=/usr/local/libexec/agent-core/harness`；无任何 ZAI /
  OPENAI / proxy 变量。
- `OBS-C-002` — `ls /Users/authsvc/.agent-core/agent-model-overrides.json` =
  ENOENT（父 OBS-003 复核成立）。
- `OBS-C-003` — `cat <HOME>/settings.yaml`（非 secret 配置文件；credential 值
  不在此文件）：`llm-pi-ai.providers` = {opencode-go, oc-go}；
  `agent-default-model` = opencode-go/deepseek-v4-flash；无 zai 块。
- `OBS-C-004` — `stat`：settings.yaml / .credentials.yaml 均 0600 yanfenma；
  profiles/agent-core-production/package.json bundles =
  [@deepseek-ai/dsh-base, @agent-core/bundle-demo, @agent-core/bundle-memory,
  @agent-core/bundle-agent-switch, @agent-core/bundle-broker]；node_modules
  无 dsh-codex。`.credentials.yaml` **内容未读取**（仅 stat）。
- `OBS-C-005` — `ls -la` homes 树：96 个活动 Home 全部 `drwxr-xr-x`（0755）
  yanfenma；`agt_cto-agent.pre-permrepair-20260822-061954`（0700）与
  `agt_stock_agent`（0700，停用名）为存留。
- `OBS-C-006` — 源码级（main `c52bd1c`）：`agent-provisioning/src/index.js`
  `provisionAgentHome` 在 Router（生产 = authsvc 505）每次 spawn 幂等重跑：
  `copyOnce(settingsSource, <home>/settings.yaml)` 对 target 做
  `existsSync` —— Home 若 0700(uid 502)，authsvc 无权 stat/mkdir-write，
  `copyFileSync`/`writeFileSync` EACCES ⇒ `startupFailureStage='provisionHome'`
  ⇒ 该 Agent 下一次 spawn fail。同文件注释自证：「an operator-owned 0755 home
  remains a fail-loud activation prerequisite rather than being mutated
  implicitly」。permrepair 备份目录（0700）+ 现行 0755 = 该冲突已于 2026-08-22
  在生产实际发生并被修复为 0755 的直接证据。
- `OBS-C-007` — 对 dsh-codex@0.2.3 `peerDependencies` 全集（19 项：
  @earendil-works/pi-ai、@deepseek-ai/{cordis, dsh-agent, dsh-atomic-write,
  dsh-attachment, dsh-commands, dsh-home-paths, dsh-host-webserver,
  dsh-invariants, dsh-llm, dsh-llm-pi-ai, dsh-fs, dsh-session, dsh-settings,
  dsh-tools, dsh-web, schemastery}、react、react-dom）逐项 `-e` 存在性核验：
  production Home profiles/node_modules 下 19/19 OK（symlink 目标为生产
  harness `apps/cli/node_modules/...`）。
- `OBS-C-008` — `ls /usr/local/libexec/agent-core/harness/.git` = ENOENT；
  `package.json` version = 0.1.0-rc.8；owner authsvc。
  `agent-provisioning readHarnessIdentity` = `spawnSync('git', ['-C', root,
  'rev-parse', 'HEAD'])` ⇒ 生产必失败；`provisionExactProfilePlugin` 在
  installed-check **之前**无条件调用它（`options.harnessIdentity ?? read…`）⇒
  任何携带 subscription block 的 spawn（激活后 luna fallback hop）都会先撞
  此墙（fail-loud；按父 CTR-011 不属于 fallback 触发类）。
- `OBS-C-009` — 旧 root `settings.yaml` zai 块形态：
  `zai: { apiKeyEnv: ZAI_API_KEY, models: [{id: glm-5.3}] }`（生产同款
  yaml grammar 的既有先例；仅引用键形态）。旧 root `.credentials.yaml` /
  `.openai-codex-auth.json` 内容未读取、不得读取。
- `OBS-C-010` — `docs/runbooks/luna-manual-backup-v1.md` §0/§1：chatgpt.com 仅
  经 ClashX（127.0.0.1:7890）可达；其「启用 Luna」v1 override 机制已随
  route-chain family 取代而作废，仅网络事实被本 Spec 引用。

## 6. Decisions（执行轮绑定；全部在父 Spec 政策内）

- `DEC-C-001` — **key 交付与 OAuth 主体 = Owner 亲自**：`ZAI_API_KEY` 明文与
  ChatGPT OAuth 登录只能由 Owner 本人完成/输入。冻结交付面：
  `ZAI_API_KEY` 经 Owner 在本机对 `<HOME>/.credentials.yaml` 的直接安全输入
  （Owner 亲手执行写入命令，值不经 agent 会话、不经 prompt/env/argv/日志/
  Feishu/commit/PR）；执行 agent 的职责边界 = 写入前后的**元数据**核验
  （key 名存在、非空、mode/owner 正确）与行为验证（canary），**永不读取/
  回显值本身**。OAuth = Owner 在本机交互式执行
  `DSH_HOME=<HOME> dsh plugin --profile agent-core-production exec
  dsh-openai-codex login`（浏览器或 `--device-code`），一次性落盘。
- `DEC-C-002` — **目录 mode 裁决（Q-C-1，OWNER_DECISION_REQUIRED）**：任务指令
  与父 CTR-014 要求「directory 0700」，但生产实证（OBS-C-005/006）表明在
  authsvc 运行时下 Home 0700 会令下一次 spawn 在 provisionHome 阶段 EACCES
  fail-loud（2026-08-22 permrepair 即此故障的修复痕迹）。本 Spec 默认冻结
  **推荐方案 (a)**：本轮 Home 目录 mode **保持 0755 不变**（不授权 chmod
  0700）；隐私实质由文件级 0600 + uid 502 承载；「0700」的达成与
  provision 路径的适配（如 provisioner 对已 provision Home 的 skip 语义、或
  边界校验调整）一并归入激活部署轮前的 implementation 轮（需要独立 authority，
  本 Spec 不设计）。Owner 亦可裁决 (b)：坚持本轮即 0700 —— 则必须先 dispatch
  并完成上述 runtime 侧适配 authority，本 Spec 的 C-3 目录部分在该完成前
  BLOCKED。**默认执行语义 = (a)**，除非 Owner 在本 Spec review/acceptance 时
  明确改裁 (b)。
- `DEC-C-003` — **GLM settings 编辑形态**：仅向 `llm-pi-ai.providers` 追加 zai
  块（键序按现有文件风格追加于 providers 之下；形态 =
  `apiKeyEnv: ZAI_API_KEY` + `models: [{id: glm-5.3}]`，即 OBS-C-009 先例
  grammar）；`agent-default-model` 与其余所有既有键**逐字节保留**；编辑采用
  原子替换（同目录 temp + rename），编辑前后各留一份时间戳 `.bak`（settings.yaml
  非 secret，允许；`.credentials.yaml` **禁止**任何明文备份副本——见
  CTR-C-102）。编辑后文件保持 0600 / uid 502。
- `DEC-C-004` — **probe 隔离**：两条 canary 均为受控一次性 DSH 进程，以
  yanfenma(502)（= child uid）运行、`DSH_HOME=<HOME>`、显式指定被测
  route（zai/glm-5.3；openai-codex/gpt-5.6-luna），scratch 工作目录（不触碰
  agent workspace）；不产生任何 Router ingress / Feishu 消息 / Scheduler 任务；
  选择无在途 CTO 生产 turn 的窗口执行；probe 会话产物落入 `<HOME>/sessions/`
  （uid 502，随 Home 既有语义）；证据 = provider initialize 成功 + 恰好一个
  no-tool turn 完成（prompt 选取不诱发工具；记录零 tool call）；输出与日志
  遵守 §9 redaction。Luna probe 额外前置：出网经本地代理（OBS-C-010，现场
  复核）；代理 env **仅**设在一次性 probe 进程上，不写入任何持久配置
  （providerEnv 四值作为 v2 配置内容仍属激活部署轮，A1.4）。
- `DEC-C-005` — **激活部署 blocker 登记（本 Spec 仅记录，不修复）**：
  1. `PRODUCTION_HARNESS_GIT_IDENTITY_BLOCKER` —— 生产 harness 无 `.git`
     （OBS-C-008）：(i) 本轮 Luna 安装因此采用 operator-side 机械安装
     （CTR-C-205），无法 in-band 核验 dshCommit（只能核验 harness
     package.json version 与 installed plugin exact version）；(ii) 激活后任何
     携带 subscription block 的 spawn（luna fallback hop）会在
     `readHarnessIdentity` 处 fail-loud —— 激活部署轮必须先解决（形态由该轮
     评审决定：为生产 harness 提供可核验 identity（如受管 manifest）或调整
     provisioner 身份核验 seam，均需独立 authority）。
  2. `HOME_MODE_0700_SPAWN_CONFLICT`（DEC-C-002 (a) 的 deferred 项）。
  3. （既有，非本轮新增）IMPL Amendment 1 的 loader routeKind 对齐实现轮
     未完成前，v2 配置无法合法表达 builtin route（A1.6 / AI1.3）。
- `DEC-C-006` — **readiness 事实记录**：执行轮完成且全部 ACC-C 通过后，
  `zai-api-key-home` 与 `luna-oauth-home` 记为 `SATISFIABLE_UNCLAIMED`
  （可满足、未被任何配置引用）；此记录进入执行轮 Final Output，不写任何
  配置文件。

## 7. GLM authorization contracts（CTR-C-1xx）

- `CTR-C-101`（settings.yaml zai 声明）—— additive 追加 zai provider 块，
  形态冻结为 DEC-C-003；`agent-default-model` 与其余键逐字节不变；原子替换；
  编辑后 mode 0600 / owner uid 502 核验；`.bak` 允许（非 secret）。
- `CTR-C-102`（.credentials.yaml ZAI_API_KEY）—— 文档形态 = 严格
  `CredentialRef → string` YAML 顶层映射（harness `@deepseek-ai/dsh-credentials-local`
  契约）；仅新增 `ZAI_API_KEY` 一个顶层 key，其余 entry / 注释 / 排版原样保留；
  由 Owner 亲自写入值（DEC-C-001）；**禁止**明文备份/副本/截图/回显；写入后
  核验：key 名存在且值非空（不得输出值）、mode 0600、owner uid 502；harness
  对外部编辑 hot-reload，无需重启任何进程。
- `CTR-C-103`（GLM canary）—— DEC-C-004 隔离语义；pass 判据 = initialize
  成功 + 恰好一个 no-tool turn 完成（零 tool call）；fail = fail-loud 记录
  结构化原因（不含 provider raw error body / key）。
- `CTR-C-104`（launchd 不变量）—— 执行前后核验 plist 全字节不变，且
  `ZAI_API_KEY` 不出现在任何 launchd env（env 层会 shadow credential store，
  由 harness precedence 决定；亦违反最小暴露）。

## 8. Luna authorization contracts（CTR-C-2xx）

- `CTR-C-201`（全新 OAuth）—— 仅由 Owner 亲自交互式登录生成
  `<HOME>/.openai-codex-auth.json`（DEC-C-001 命令形态）；**禁止**复制/链接/
  读取旧 OpenClaw OAuth 物料、旧 root
  `/Users/yanfenma/.agent-core/homes/agt_cto-agent/.openai-codex-auth.json`、
  或 `~/.codex/auth.json`（后者全程 hash/mtime 不变并作为 ACC 核验）；
  禁止 `OPENAI_API_KEY` / API credits 路径（父 CTR-014 原文延续）。
- `CTR-C-202`（OAuth 文件边界）—— 登录后核验：regular file、mode 0600、
  owner uid 502；目录 mode 按 DEC-C-002 默认 (a) 维持 0755 并记录偏差说明
  （如 Owner 裁 (b) 且前置已完成，则 0700）。`assertOAuthCredentialBoundary`
  语义（0600/0700）在 (a) 下不作为本轮 pass/fail 判据——其完整生效归
  激活轮（与 DEC-C-005.2 同一 blocker 家族），如实记录。
- `CTR-C-203`（token 边界）—— token / refresh token 永不进入 env（非目标
  进程）/ argv / prompt / Feishu / 日志 / commit / PR 描述；日志与报告仅允许
  文件名、大小、mtime、mode、owner 与 hash 指纹（如需比对）。
- `CTR-C-204`（`~/.codex/auth.json` 不变量）—— 执行前后 hash + mtime 不变。
- `CTR-C-205`（dsh-codex 安装）—— operator-side 精确安装，机械形态与
  `defaultPluginInstaller` 同义：`npm install --prefix <HOME>/profiles
  --no-save --no-package-lock --ignore-scripts dsh-codex@0.2.3`，以 uid 502
  执行；安装后核验 `profiles/node_modules/dsh-codex/package.json` version
  === "0.2.3"（exact；resolved ≠ 0.2.3 ⇒ fail-loud，禁止静默放行/降级）；
  幂等可重跑；不做 in-band dshCommit 核验（OBS-C-008；DEC-C-005.1 记录该
  缺口）。禁止从旧 root 复制 node_modules 或 tarball 拷贝——必须 registry
  （或等价受信源）安装。
- `CTR-C-206`（peer 解析核验）—— 注册 bundles **之前**，对 dsh-codex 的
  19 项 peerDependencies 逐项核验在 `<HOME>/profiles/node_modules` 下可解析
  （OBS-C-007 现状 19/19；若 npm install 改变了任一 peer 链接 ⇒ fail-loud
  并在注册前修复）；任何核验不过 ⇒ **不得**触碰 bundles 注册（防止下一次
  生产 spawn 因插件加载失败而 fail）。
- `CTR-C-207`（bundles 注册）—— 仅当 CTR-C-205/206 全过后，向
  `<HOME>/profiles/agent-core-production/package.json` 的
  `dsh.profile.bundles` 追加 `"dsh-codex"`（原子写；其余字节不变；文件保持
  现有 owner/mode）。仅此一个 Home；共享模板 `profile-production/` 零改动。
- `CTR-C-208`（Luna canary）—— DEC-C-004 隔离语义 + DEC-C-004 代理前置；
  route = openai-codex / gpt-5.6-luna；pass 判据同 CTR-C-103。

## 9. Security boundaries（明令禁止；违反即 out-of-spec + 事故记录）

```text
secret 明文进入 agent 会话 / prompt / env / argv / stdout / 日志 / Feishu —— 禁止
ZAI_API_KEY 或 token 写入 launchd / agent-model-overrides.json / 任何配置 —— 禁止
复制旧 OpenClaw / 旧 root OAuth / ~/.codex/auth.json —— 禁止（含读取后转写）
.credentials.yaml / .openai-codex-auth.json 的明文备份或第二副本 —— 禁止
读取 .credentials.yaml / .openai-codex-auth.json 的值用于“验证” —— 禁止
（验证 = 元数据 + 行为 canary）
编辑 settings.yaml 时改动 agent-default-model 或其余既有键 —— 禁止
在 bundles 注册未过核验（CTR-C-206）前触碰 profile package.json —— 禁止
修改共享模板 profile-production/ 或任何其他 Agent Home —— 禁止
修改父 / IMPL / Amendment 1 Spec 文件 —— 禁止（GOVERNING_SPEC_UNMODIFIED）
执行任何尚未满足 GATE-1 AND GATE-2 的凭据操作 —— 禁止
```

## 10. Acceptance（执行轮验收；本 authoring 轮不执行）

| # | 验收项 | 依据 |
|---|---|---|
| ACC-C-001 | GATE-1 AND GATE-2 执行前核验记录（两 commit 坐标） | §3 |
| ACC-C-002 | settings.yaml：zai 块存在且形态正确；`agent-default-model` 与其余键 diff = 零变化；0600/uid502 | CTR-C-101 |
| ACC-C-003 | .credentials.yaml：`ZAI_API_KEY` key 存在、值非空（未输出）；其余 entry 保留；0600/uid502；无第二副本 | CTR-C-102 |
| ACC-C-004 | GLM canary PASS（initialize + 1 no-tool turn，零 tool call；隔离证据：无 Router/Feishu/Scheduler 流量） | CTR-C-103 |
| ACC-C-005 | launchd plist 字节不变；无 ZAI/token env | CTR-C-104 |
| ACC-C-006 | dsh-codex installed version === 0.2.3（exact）；安装来源 = registry 类受信源（非旧 root 拷贝） | CTR-C-205 |
| ACC-C-007 | 19/19 peers 解析核验记录（注册前） | CTR-C-206 |
| ACC-C-008 | bundles 追加后 profile package.json 其余字节不变；仅本 Home | CTR-C-207 |
| ACC-C-009 | `.openai-codex-auth.json` 全新生成（Owner 交互式）；0600/uid502；`~/.codex/auth.json` hash/mtime 不变 | CTR-C-201/202/204 |
| ACC-C-010 | Luna canary PASS（同 ACC-C-004 语义 + 代理前置记录） | CTR-C-208 |
| ACC-C-011 | 生产 root `agent-model-overrides.json` 执行前后均 ABSENT；全局 env route 不变 | §2.2 |
| ACC-C-012 | redaction 扫描：执行轮全部输出/日志/commit 文本无 secret（key/token/Authorization/provider raw error body） | §9 |
| ACC-C-013 | Q-C-1 裁决记录（默认 (a) 已执行：Home mode 保持 0755；或 Owner 改裁 (b) 的完成证明） | DEC-C-002 |
| ACC-C-014 | readiness 事实记录：`zai-api-key-home` / `luna-oauth-home` = SATISFIABLE_UNCLAIMED | DEC-C-006 |

## 11. Alternatives considered

- **沿用（复活）superseded `AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1` 作为
  授权**：REJECTED——已被父 Spec whole-supersede；且其 TARGET_DSH_HOME 与
  0700 边界锚定旧 root 同 uid 模型，与生产新事实冲突；复活违反 no-dual-current。
- **在本 Spec 内顺带修复 harness identity / Home 0700 spawn 冲突**：REJECTED /
  FORBIDDEN——Owner 任务指令明令「仅记录为后续激活部署 blocker，不得自行设计
  部署修复」；二者均为 runtime/部署面变更，需独立 authority。
- **agent 代替 Owner 输入 key / 完成 OAuth**：REJECTED——secret 必须经 Owner
  亲手（DEC-C-001）；agent 会话即 prompt 面，等价泄露。
- **从旧 root 拷贝 dsh-codex node_modules / OAuth 文件以省安装与登录**：
  REJECTED / FORBIDDEN——父 CTR-014 与任务指令双重明禁。
- **将 zai 同时设为 `agent-default-model`（复制旧 root 全局主路由形态）**：
  REJECTED——那是路由激活，属激活部署轮；本 Spec 只做 credential 就绪，
  `agent-default-model` 逐字节不变（DEC-C-003 / CTR-C-101）。
- **本轮直接 chmod Home 0700 满足字面指令**：REJECTED（作为默认）——生产
  实证其立即破坏下一次 spawn（OBS-C-006）；保留为 Q-C-1 的 Owner 显式裁决项
  (b)，且 (b) 附带前置 authority 要求。
- **把 Luna providerEnv 四值写进任何持久位置**：REJECTED——A1.4 冻结其属部署
  事实；probe 仅进程级一次性 env（DEC-C-004）。

## 12. Rollback（凭据轮自身的回退；不动路由/运行时）

- GLM：移除 `.credentials.yaml` 的 `ZAI_API_KEY` entry（原子、保留其余 entry）；
  settings.yaml 移除 zai 块（或恢复时间戳 `.bak`）。文件权限保持 0600/502。
- Luna：从 bundles 移除 `dsh-codex`（原子）→ 视需要 `rm -rf
  <HOME>/profiles/node_modules/dsh-codex`（npm 管理目录，安全删除；不动
  peers symlinks）；删除 `.openai-codex-auth.json`（OAuth credential 可保留
  以便再启用——保留时维持 0600/502）。
- 上述任何回退**不触碰** launchd / overrides / Scheduler / 其他 Agent；
  全局 env route 从未改变，生产行为回退前后一致（本轮本就不改变任何路由）。

## 13. Open questions

- `Q-C-1`（OWNER_DECISION_REQUIRED）— Home 目录 mode：采纳默认 (a)
  （0755 保持，0700 归激活轮前置的 implementation 轮）或 (b)（本轮即 0700，
  需先完成 runtime 侧适配 authority）。默认执行语义 = (a)；review/acceptance
  时 Owner 显式确认或改裁。

## 14. Final Output（authoring 轮填写）

```text
TASK_NAME = 链路 凭据授权执行
TASK_STATUS = AUTHORING_COMPLETE（proposed；READY_FOR_INDEPENDENT_REVIEW）

SPEC_ID = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_CREDENTIAL_V1
AUTHORITY_FORM = child credential-authorizing Spec（不 supersede 任何 Spec）
GATE-1 = 本 Spec accepted AND 进入 main
GATE-2 = 父 Spec Amendment 1（Builtin Route Kind，PR #77）accepted AND 进入 main
CREDENTIAL_OPERATIONS_ALLOWED_NOW = NO（proposed；GATE 未满足）

AUTHORIZED_SCOPE（仅 agt_cto-agent production Home）=
  GLM：settings.yaml zai/glm-5.3 additive 声明；.credentials.yaml ZAI_API_KEY
       （Owner 亲自交付）；文件 0600 / uid 502；受控 initialize + no-tool canary
  Luna：dsh-codex@0.2.3 exact 安装（operator-side + bundles 注册）；Owner 亲自
       交互式 OAuth 全新生成 .openai-codex-auth.json；0600 / uid 502；
       initialize + no-tool canary
  目录 mode = Q-C-1 默认 (a)：保持 0755（0700 与 authsvc spawn 路径冲突，
       归激活轮前置；OBS-C-005/006 实证）

NOT_AUTHORIZED =
  写 agent-model-overrides.json；激活 fallback/Route Chain；改 Scheduler/
  Binding/Agent Definition/launchd；部署产品代码；输出/复制任何 secret；
  复制旧 OpenClaw/旧 root/~/.codex/auth.json；修复 harness identity 或
  Home-mode spawn 冲突（仅登记 blocker）

ACTIVATION_DEPLOYMENT_BLOCKERS_RECORDED =
  1. PRODUCTION_HARNESS_GIT_IDENTITY_BLOCKER（in-band 安装/身份核验与
     subscription spawn 均被无 .git 阻断）
  2. HOME_MODE_0700_SPAWN_CONFLICT（0700 需 runtime 适配后达成）
  3. loader routeKind 对齐实现轮未完成（IMPL Amendment 1 AI1.2/3）

PRODUCT_CODE_CHANGE = NONE
CREDENTIAL_CHANGE = NONE（本轮零执行）
CONFIG_CHANGE = NONE
PRODUCTION_CHANGE = NONE
DEPLOYMENT = NONE
MERGE = NO（Draft PR）

NEXT_TASK = 链路 凭据授权审计
```
