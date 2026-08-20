---
spec_id: AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1
status: proposed
---

# Agent Core ChatGPT Subscription Target Proxy Seam V1 — 单 Agent 代理注入 seam

> 性质：**Spec（SPEC ONLY — 本轮只冻结授权边界，不实现）** · 日期：2026-08-20 ·
> 仓库：`mayf3/dsh-agent-core` · 基准：`origin/main @ fe2c639`
> （= AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1 实现后的最新主线，
> 含 `8781771` runtime review gaps 与 `fe2c639` target-respawn reload）
>
> SPEC_STATUS = **proposed**（本轮 = INVESTIGATION + SPEC ONLY）
>
> 本轮不做：implementation、production 变更、重新 OAuth、写 Luna override、
> 发送飞书消息、merge。实现权限在本 Spec 被 accept 之前不存在。
>
> 与已 accept Spec 的关系：本 Spec **扩展**（不修改、不 supersede）
> `AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1`（accepted，已实现）冻结的
> `<productionRoot>/agent-model-overrides.json` seam——在该 schema 上增加**一个
> 可选的、严格 allowlist 的 `providerEnv` 字段**。已 accept Spec 的全部冻结语义
> （ENABLED_AGENTS = exactly 1、no silent fallback、rollback 语义、credential
> ownership、plugin pin 等）原样有效，本 Spec 不重开任何一项。
>
> 触发背景（owner 给定，2026-08-20）：controlled activation 发现
> `chatgpt.com` 直连不可达、经本机 `127.0.0.1:7890` 代理可达；当时唯一的
> 注入途径（launchd global env → production-runtime → 全部 88 个 Agent child）
> 违反 `ENABLED_AGENTS = exactly 1 / OTHER_AGENTS_CHANGED = NO`，已安全回滚
> （global proxy absent / Luna override removed / route = oc-go·deepseek-v4-flash /
> credential 与 plugin 保留）。

---

## 0. 一句话

在现有 per-Agent model override seam（`agent-model-overrides.json`）上增加一个
**可选、严格 allowlist、仅在 AgentProcess spawn 时机械注入**的 `providerEnv`
字段，使唯一目标 Agent `agt_cto-agent` 的 DSH 子进程以
`openai-codex / gpt-5.6-luna` 经 `127.0.0.1:7890` 出网；其余 87 个 Agent 的
child env、provider/model、网络路径**字节级不变**；production-runtime 自身
全局 env 保持 proxy-free。

---

## 1. 回滚后生产现状（2026-08-20 只读核实，冻结为本 Spec 前态）

| 项 | 值 | 证据 |
|---|---|---|
| launchd global proxy env | **absent** | `~/Library/LaunchAgents/ai.agent-core.runtime.plist` grep proxy = 无匹配 |
| launchd global route | `DSH_AGENT_PROVIDER=oc-go` / `DSH_AGENT_MODEL=deepseek-v4-flash` | 同 plist :7-10 |
| `<productionRoot>/agent-model-overrides.json` | **文件不存在**（Luna override 已移除 = 完整回滚态） | `~/.agent-core/` 下无该文件 |
| 目标 credential | 保留：`~/.agent-core/homes/agt_cto-agent/.openai-codex-auth.json` 存在、mode 0600 | `ls -l`（未读取内容） |
| 目标 route（当前有效） | `oc-go / deepseek-v4-flash`（全局 env route） | 回滚后自然态 |

North Star（冻结）：

```text
agt_cto-agent → openai-codex / gpt-5.6-luna → 经 http://127.0.0.1:7890
其余 87 Agent → proxy env absent · provider/model unchanged · network path unchanged
```

---

## 2. 既有 seam 源码级复核（evidence authority；BASE = fe2c639）

### 2.1 Agent Core 侧（本仓库，行号 @ fe2c639）

- **override loader** `packages/production-runtime/src/model-overrides.js`
  - V1 schema 强校验：顶层 `exactKeys(['overrides','version'])` 且
    `version === 1`（:121-125）；`overrides` 至多 1 条（:127）；agentId 必须
    已注册且 = `agt_cto-agent`（:129-133）；route 对象 `exactKeys` 必须恰为
    `{provider, model, plugin, pluginVersion}`（:134-141）且四字段逐字等于
    冻结值 `openai-codex / gpt-5.6-luna / dsh-codex / 0.2.3`（:142-147，
    常量 :12-21）；recursive duplicate-JSON-key 扫描（:34-92）；
    parse/schema/unregistered 全部 `AGENT_MODEL_OVERRIDE_INVALID` fail-loud。
  - `resolve(agentId, globalRoute)` 是纯 resolver（:155-160）。
- **composition / reload boundary** `packages/production-runtime/src/compose.js`
  - `globalRoute` 来自 `DSH_AGENT_PROVIDER / DSH_AGENT_MODEL`（launchd，
    :174-177）；override 文件路径 = `<productionRoot>/agent-model-overrides.json`
    （:178）；**`resolveProcessConfig(agentId)` 在每次新 AgentProcess spawn 前
    同步 reload + validate 该文件**（:181-205，`fe2c639` 引入——这就是已存在的
    target-only reload boundary）；目标 Agent 额外得到
    `omitEnv:['OPENAI_API_KEY']` 与 `subscription` 元数据（:191-203）。
  - 注意对照：compose 确实会写 runtime 自身 `process.env`（`DSH_HARNESS_ROOT`
    / `DSH_MEMORY_WORKSPACE_ROOT`，:107-111）——**本 Spec 明确禁止
    providerEnv 走这条路**（见 §5）。
- **Router 消费点** `packages/agent-router/src/index.js`
  - `ensureRunning`：live process 复用（:521-524）→ `resolveProcessConfig`
    （:548）→ `provisionHome(subscription)`（:553-556）→ `processFactory({…,
    provider, model, omitEnv, env:{DSH_AGENT_ID, DSH_PRIMARY_WORKSPACE}})`
    （:558-570）。Router 不读文件、不校验规则，只做机械传参。
- **AgentProcess env 构造** `packages/agent-router/src/process.js`
  - `agentEnv(home, extra, omit)` = `{...process.env}`（**全量继承**）+
    固定 extras（`DSH_HOME` / `DSH_TELEMETRY_DISABLED` / `DSH_PERMISSION_MODE`）
    + `extra` + credential-file `OPENCODE_GO_API_KEY` + `omit` 删除（:73-90）；
    spawn 时 `agentEnv(this.home, this.env, this.omitEnv)`（:212）；
    `provider/model/omitEnv` 在构造时定格、进程生命周期内不可变（:158-176）。
  - **结论（已知现状复核成立）**：今天唯一的 per-Agent env 通道是减法式的
    `omitEnv`；不存在任何加法式 per-Agent env 注入。launchd 全局 proxy 因此
    必然广播到全部 88 个 child——这正是已回滚事故的机制根源。
  - child 以 `process.execPath`（runtime 自己的 Node 二进制）spawn
    （:49/:66/:201），故 child Node 版本 ≡ runtime Node 版本（今日 = v25.6.1）。

### 2.2 DSH / dsh-codex / pi-ai 侧（生产实装只读核查，2026-08-20）

- **DSH provider config（settings.yaml）**：目标
  `~/.agent-core/homes/agt_cto-agent/settings.yaml` 的 `llm-pi-ai.providers.*`
  条目仅含 `apiKeyEnv / api / baseURL / models`（及 displayName）——**无
  proxy、无通用 env 透传字段**；fallback 模板 `MINIMAL_SETTINGS`
  （`packages/agent-provisioning/src/index.js:251-260`）同形状。
- **dsh-codex@0.2.3**（`<target-home>/profiles/node_modules/dsh-codex/lib`）：
  `proxy|dispatcher|NODE_USE|HTTP_PROXY` 全库 **零匹配**；全部出网调用为裸
  全局 `fetch`：compact `src-0oSwUgNO.js:466`、usage `:689`、image fetch
  `:1044`、search `:1417`、image gen/edit `:1627`；主模型 turn 由 public
  pi-ai adapter 承载（`createOpenAICodexAdapter`，:525-547：「public pi-ai
  adapter owns … streaming」，plugin 只补 OAuth token 与 codex-native 状态）。
  **无 proxy config、无 provider-scoped dispatcher——已知现状复核成立。**
- **pi-ai@0.82.1**（`@deepseek-ai/dsh-llm-pi-ai@0.1.0-rc.5` 内嵌）：
  - 主 SSE fetch = 裸全局 `fetch(resolveCodexUrl(...))`，无 dispatcher 选项
    （`dist/api/openai-codex-responses.js:263`）；transport 默认 `auto` =
    **WebSocket 优先、SSE fallback**（:181-187）；Node 上 WS ctor =
    `globalThis.WebSocket`（:721），显式 proxy wiring 仅存在于 Bun 分支
    （:692-709）。
  - `dist/utils/node-http-proxy.js` 提供 env-proxy resolver（大小写
    `http(s)_proxy/all_proxy/no_proxy`、拒绝 SOCKS/PAC）——但只被 Bun WS 路径
    与 bedrock（`bedrock-converse-stream.js:3-4,93-94`，http(s)-proxy-agent）
    引用；**Node 的 codex fetch 路径不经过它**；dist 中无
    `setGlobalDispatcher/EnvHttpProxyAgent` 注入。
- **Node 运行时实证（v25.6.1，干净 env，2026-08-20，本机）**：
  - `NODE_USE_ENV_PROXY` 未设 + `HTTPS_PROXY` → fetch 直连成功（control）；
    即 **Node 默认完全忽略 proxy env**；
  - `NODE_USE_ENV_PROXY=1` + `HTTP(S)_PROXY`（大写或小写，指向哑端口）→
    全局 `fetch` **与** 全局 `WebSocket` 均尝试经代理出网（ECONNREFUSED@
    proxy；本地监听器捕获到 `CONNECT example.com:443 HTTP/1.1`）；
  - `NODE_USE_ENV_PROXY` 于 Node v24 引入；v25.6.1 覆盖 fetch + WebSocket。

### 2.3 复核结论

```text
FACTS_UNCHANGED = YES（四项已知现状全部成立）
MINIMAL_SEAM_LOCATION = Agent Core spawn env（omitEnv 的加法式对偶）
```

在不动 DSH、dsh-codex、pi-ai 的前提下，把 proxy env 限定到单一 Agent child 的
唯一最小通道就是 Agent Core 的 AgentProcess spawn env——即现有 `omitEnv`
（减法）旁的 `providerEnv`（加法）。不需要也不得引入 dispatcher 注入、
undici global agent、settings.yaml 扩展或任何 DSH 侧改动。

---

## 3. providerEnv 配置面（冻结）

### 3.1 JSON 层级（与现有 versioned schema 对齐）

`providerEnv` 是既有 override 条目上的**可选**字段——不新建文件、不新建
顶层 schema、不建第二套动态 Model Router 或环境 Registry：

```json
{
  "version": 1,
  "overrides": {
    "agt_cto-agent": {
      "provider": "openai-codex",
      "model": "gpt-5.6-luna",
      "plugin": "dsh-codex",
      "pluginVersion": "0.2.3",
      "providerEnv": {
        "HTTP_PROXY": "http://127.0.0.1:7890",
        "HTTPS_PROXY": "http://127.0.0.1:7890",
        "NO_PROXY": "localhost,127.0.0.1,::1",
        "NODE_USE_ENV_PROXY": "1"
      }
    }
  }
}
```

- `version` 保持 `1` 不变：同一部署文件、同一读者（单节点 runtime）；
  schema 以**可选键**方式放宽。方向性后果冻结：旧 loader 读新文件 →
  `exactKeys` 失败 → startup fail-loud（安全方向，绝不静默）；新 loader 读
  旧文件（无 `providerEnv`）→ 行为与今日字节级一致。
- `providerEnv` 缺席 = 现状语义（本 Spec 对既有部署零影响）。
- 既有全部约束原样保留：至多 1 条 override、agentId 必须是已注册的
  `agt_cto-agent`、四字段逐字等于冻结值、duplicate-key 拒绝。

### 3.2 键集（V1 冻结，禁止任意 env map）

```text
PROVIDER_ENV_ALLOWLIST = {
  HTTP_PROXY, HTTPS_PROXY, NO_PROXY, NODE_USE_ENV_PROXY
}
```

- 键名**精确匹配**（大小写敏感；`http_proxy` 等小写形式 = 未知键 → fail-loud）；
- `providerEnv` 一旦出现，**四个键必须全部在场**（部分子集 → fail-loud）：
  - `NODE_USE_ENV_PROXY` 值必须恰为 `"1"`（缺失或他值 → Node 静默忽略 proxy
    env = 静默 no-op，机械禁止）；
  - `HTTP_PROXY` / `HTTPS_PROXY` 至少其一必须指向真实代理（本 North Star
    两者皆为 `http://127.0.0.1:7890`）；全空集无意义且遮蔽 no-op；
  - `NO_PROXY` 必须非空（默认 `localhost,127.0.0.1,::1`；目标 child 仍有
    localhost HTTP 依赖，不得经代理回环）。

### 3.3 值校验（loader 内冻结，全部 fail-loud）

`HTTP_PROXY` / `HTTPS_PROXY` 值必须：

- `new URL(value)` 可解析；scheme ∈ {`http:`, `https:`}（SOCKS/PAC/其他 → 拒绝）；
- **不含 username / password / userinfo**（`url.username === ''` 且
  `url.password === ''`，authority 中不得出现 `@`）；
- host 非空；端口（若出现）合法；不得携带 query / fragment；
- 不包含 token / 凭证形态（由上三条机械覆盖；URL 本身即唯一载荷）。

`NO_PROXY` 值必须：非空字符串、逗号分隔、每段 trim 后非空。

类型约束：`providerEnv` 必须是 JSON object（string/array/null/number →
fail-loud）；所有值必须是非空 string。

---

## 4. 注入机制与安全边界（冻结）

```text
TARGET_PROCESS_ENV = 目标 AgentProcess spawn env 恰含四个已验证键值
                     （在 {...process.env} 与固定 extras 之后合并，
                       同名继承值被 providerEnv 覆盖——部署单一权威）
NON_TARGET_PROCESS_ENV = 与今日字节级一致（继承语义不变，不增不删）
GLOBAL_RUNTIME_PROXY = absent（production-runtime 自身 process.env 永不获得
                       proxy 键；对照 DSH_HARNESS_ROOT 的 runtime-global 写法
                       ：107-111，providerEnv 明确禁止该模式）
```

- **只作用于该 override 所属 Agent 的新 AgentProcess**：`providerEnv` 随
  `resolveProcessConfig` 解析、经 Router `processFactory` opts 传入
  AgentProcess 构造（与 `omitEnv` 同通道、同不可变性），仅在 `spawn()` 的
  `agentEnv()` 合并一次；
- **不按 turn 热更新**：进程生命周期内不可变（同 provider/model 的既有
  语义，process.js:167-176）；已运行进程永不热切；
- **不进入 Binding / Session / Feishu**：providerEnv 不出现在 initialize
  params、turn/deliver、Binding、ChannelConversation、任何 channel 消息；
- **不写日志、不进 argv**：spawn argv 不变（env 注入非 CLI 参数）；
  compose 既有 startup 日志行（`agent model override loaded for …
  provider=… model=…`）**不得**扩展 providerEnv 值；evidence log
  （writeEvidence）不得包含 providerEnv；以 §7 测试机械看护；
- **Node 版本前置**：providerEnv 生效要求 runtime（= child）Node major
  ≥ 24；注入点必须校验 `process.versions.node`，不满足 → fail-loud（归入
  `AGENT_MODEL_OVERRIDE_INVALID` 家族），绝不静默直连；
- 失败语义总则：未注册 Agent、未知键、非法 URL、URL 含凭证、错误类型、
  缺键、`NODE_USE_ENV_PROXY ≠ "1"` → **startup/spawn fail-loud**；不得静默
  忽略、不得回落全局代理、不得部分注入。

---

## 5. Reload boundary 与 Rollback（冻结，复用既有 target-only 机制）

### 5.1 Reload boundary（已存在，fe2c639，不新造）

```text
new AgentProcess spawn（ensureRunning 判定无 live process 可复用）
→ resolveProcessConfig 同步 reload + validate agent-model-overrides.json
→ resolve provider / model / omitEnv / subscription / providerEnv
→ processFactory 构造 → spawn 注入
```

- target-only 重新加载：只需停目标 Agent 进程，下一次 ensureRunning 即读取
  新 providerEnv；**不重启 production-runtime、不重启其他 Agent**；
- 已运行进程（含其他 87 个）的 env 与 PID 不受任何影响。

### 5.2 Rollback（机械可执行，两层）

```text
ROLLBACK_PROXY_ONLY =
  1) 从 override 条目移除 providerEnv 键（或将其置为合法全键集缺席形态）
  2) restart only agt_cto-agent（停止目标进程 → respawn）
  3) 验证：目标 child env 无四个 proxy 键；route 仍 = openai-codex/gpt-5.6-luna
     （注意：proxy 移除后 chatgpt.com 直连不可达会以 provider_unavailable
      fail-loud 呈现——这是如实失败，不是回退）

ROLLBACK_FULL（沿用已 accept Spec §7，不重开）=
  1) 移除整个 Luna override（或删除 agent-model-overrides.json）
  2) restart only agt_cto-agent
  3) 自然回落全局 env route → oc-go / deepseek-v4-flash
  4) 不重启其他 Agent；credential / plugin 可保留
```

任一 rollback 都不修改 launchd、不触碰其他 Agent 进程。

---

## 6. 自动化测试范围（冻结；实现轮必须覆盖，普通 CI 不做真实出网）

1. target child 收到**恰为** allowlist 的四个 proxy env（键集与值精确相等）；
2. non-target child env 无任何 proxy 键，且与无本 Spec 时的构造结果一致；
3. production-runtime 自身 `process.env` 在 compose + providerEnv 生效后仍
   proxy-free（无四个键）；
4. malformed proxy config（坏 URL / 错 scheme / 带 userinfo/query/fragment）
   → fail-loud；
5. 未知 env 键（含小写形式）→ fail-loud；
6. proxy URL 含 username/password/token → fail-loud；
7. providerEnv 类型错误（string/array/null/数字）或值非非空 string → fail-loud；
8. 缺四键之一或 `NODE_USE_ENV_PROXY ≠ "1"` → fail-loud；
9. duplicate JSON key（providerEnv 内）→ fail-loud（既有 recursive 扫描覆盖）；
10. target-only restart 后 respawn 进程读到新增/移除的 providerEnv（reload
    boundary）；同轮 non-target PID 与 route 保持不变；
11. 移除 override → 目标回落 oc-go / deepseek-v4-flash（rollback，
    沿用既有测试语义）；
12. 无任何日志行包含 proxy URL / providerEnv 值（含 evidence log）。

---

## 7. Controlled live acceptance（后续单独执行；本 Spec 只冻结清单，不执行）

| # | 验收项 |
|---|---|
| 1 | target 经 127.0.0.1:7890 可达 chatgpt.com（subscription 路径真实 roundtrip） |
| 2 | non-target Agent child env proxy 键 absent（进程级证据） |
| 3 | CTO 手机飞书 Luna reply 成功（真实消息） |
| 4 | cold restart 后 reply 成功（providerEnv 持久生效，不重新 OAuth） |
| 5 | rollback（proxy-only 或 full）按 §5.2 执行成功 |
| 6 | final Luna re-enable 成功 |

---

## 8. Non-Goals（明确不做）

- 通用 per-Agent 任意 env 服务（V1 = 单 Agent + 4 键 allowlist，仅此）；
- 全局 proxy（launchd / runtime 全局 env 注入一律禁止）；
- proxy auto-discovery / 健康检查 / 自动切换；
- provider fallback / account pool / quota scheduler；
- Router 动态模型选择（routing semantic 不变）；
- Session / Binding / Feishu 任何变更；
- DSH / Kernel / dsh-codex / pi-ai 任何变更（含 settings.yaml、dispatcher、
  global agent 注入）。

```text
ROUTER_CODE_CHANGE_REQUIRED    = YES_MINIMAL（providerEnv 机械传参，同 omitEnv 模式）
ROUTER_ROUTING_SEMANTIC_CHANGE = NONE
SESSION_MODEL_CHANGE           = NONE
KERNEL_CHANGE                  = NONE
DSH_CHANGE / PLUGIN_CHANGE / CREDENTIAL_CHANGE = NONE
```

实现轮允许触碰的文件冻结为：`packages/production-runtime/src/model-overrides.js`
+ `compose.js`、`packages/agent-router/src/index.js` + `process.js` 及对应
test 文件。其余包（feishu-connector / scheduler / broker / product-api /
workspace-bootstrap / agent-provisioning 等）零改动；任何溢出 =
OWNER_DECISION_REQUIRED。

---

## 9. 实现边界与产物约束

- 独立 linked worktree off 最新 origin/main；不直接改 main；实现完成后
  commit + push 交独立 review，不自行 merge。
- 必须复用既有机制：override loader 的 fail-loud 家族与 duplicate 扫描、
  resolveProcessConfig reload boundary、processFactory/omitEnv 传参通道、
  既有测试文件扩展（model-overrides / provider-route /
  chatgpt-subscription-real）。
- 无新服务、无新守护进程、无新配置文件、无 watcher。

---

## 10. Final Output（本轮 SPEC_PROPOSAL 填写；acceptance 轮补全）

```text
AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1_SPEC = PASS

BASE_MAIN = fe2c6393915b1dc61c4c3d25b2996d2f258ba484
HEAD =

TARGET_AGENT = agt_cto-agent
CONFIG_SEAM = <productionRoot>/agent-model-overrides.json → overrides["agt_cto-agent"].providerEnv（可选键，version 1 schema 内）
PROVIDER_ENV_ALLOWLIST = HTTP_PROXY | HTTPS_PROXY | NO_PROXY | NODE_USE_ENV_PROXY（全键必在场；NODE_USE_ENV_PROXY="1"）

TARGET_PROCESS_ENV = spawn 时机械注入恰四个键（覆盖同名继承值）
NON_TARGET_PROCESS_ENV = 与今日字节级一致（proxy 键 absent）
GLOBAL_RUNTIME_PROXY = absent（runtime 自身 env 永不获得 proxy 键）

RELOAD_BOUNDARY = 新 AgentProcess spawn → resolveProcessConfig 同步 reload/validate（fe2c639 既有机制，不热切）
ROLLBACK = 移除 providerEnv/override → restart only agt_cto-agent → Luna-无代理 或 oc-go/deepseek-v4-flash；其他 Agent 不重启

ROUTER_CODE_CHANGE_REQUIRED = YES_MINIMAL
ROUTER_ROUTING_SEMANTIC_CHANGE = NONE
SESSION_MODEL_CHANGE = NONE
KERNEL_CHANGE = NONE

SPEC_STATUS = proposed
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES
```

---

## ReviewDisposition

- **Round 1（本轮，proposed）**：INVESTIGATION + SPEC ONLY。源码级复核基于
  `origin/main @ fe2c639` 与生产实装只读证据（§2），四项已知现状全部复核
  成立（FACTS_UNCHANGED = YES）；Node v25.6.1 env-proxy 机制经本机干净环境
  实证（fetch + WebSocket）。无 implementation、无 production 变更、无
  OAuth、无 Luna override 写入、无飞书消息、无 merge。
- （预留：independent review → accept/fix 轮 → implementation 轮。）
