---
status: historical
as_of: 2026-08-15
superseded_by: ../../security/security-model.md
public: PUBLIC
---

> HISTORICAL ENGINEERING RECORD
>
> This document describes the system as of 2026-08-15.
> It is **not** current architecture documentation.
>
> Current documentation: [docs/security/security-model.md](../../security/security-model.md)
# Agent Core on DSH — 信任边界与身份伪造调查报告（V1）

目标：验证「Agent A 无论通过 prompt、tool 参数、HTTP header、环境变量还是其他
模型可控输入，都不能伪造成 Agent B 调用 Broker / Forum / Workflow」，并给出
DSH → Broker 跨进程信任边界的最小可信身份传递设计与旧 Auth 删除清单。

本轮只调查与验证，未修改 Kernel / Forum / Workflow / Broker 业务语义，未实现迁移。

---

## 1. 结论速览

```
TRUST_BOUNDARY=进程边界（per-agent DSH 进程 ↔ Broker）；进程内 initiator 仅作归因，不作授权
A_CAN_SPOOF_B=YES（当前单进程 + 允许自生成插件的前提下；纯模型输入伪造 NO；迁移到 B 方案后 NO）
MINIMUM_AUTH=spawn 时注入的 per-process credential + Broker 侧 credential→principal 绑定 + per-principal capability ACL
REQUIRED_ISOLATION=per-agent OS 进程、per-agent DSH home（独立 session store / 独立凭据）、控制面（Router）在 agent 进程之外
OLD_AUTH_CAN_DELETE=per-Agent client、per-Agent secret、token exchange、JWT、Grant 机制、Principal registry 多类型图
RECOMMENDED_ARCHITECTURE=B：每 Agent 独立 DSH runtime/process + process credential
```

详细证据与推导如下。

---

## 2. DSH 侧身份机制现状（证据）

### 2.1 `ctx.agents.currentInitiator()/requireInitiator()` 是进程内归因，不是授权

- `packages/core/agent/src/index.ts:309-312`：`currentInitiator()` 读
  `this.initiators.getStore()`（AsyncLocalStorage）。注释原文：
  > *Initiator methods provide same-process causal attribution only. Ambient
  > presence is neither liveness proof nor authorization; subjects and owners
  > remain explicit, as does identity at worker, process, persistence, and wire
  > boundaries.*（`index.ts:250-254`）
- `packages/core/agent/src/index.ts:341-343`：`withInitiator(agent, op)` 接受**任意
  Agent 对象**，注释原文：
  > *A queue or wire receiver may establish this boundary only after validating
  > explicit identity and resolving the exact live Agent; this method does neither.*
- `packages/core/agent/src/index.ts:583-585`：`get(id)` 无任何访问控制，任何持有
  `ctx` 的代码可按 SessionId 取回任意存活 Agent 对象；`list()`（603-605）返回全部。
- 测试实证：`packages/core/agent/tests/agent-initiator.spec.ts:49-57` —
  `withInitiator(任意 agent, () => requireInitiator())` 恒等于该对象。

**结论：`requireInitiator()` 能可靠拿到「当前 tool 调用由哪个 Agent 驱动」——前提是
调用发生在 agent-loop 建立的边界内；但该值不是 model 可选的（见 2.2），也**不是
同进程其他代码不可伪造的**（见 2.3）。它只能作为归因，绝不能作为跨进程 wire 身份。**

### 2.2 模型（tool 参数 / prompt / session 参数）无法直接提供身份

- `packages/core/agent-loop/src/tool-calls.ts:67-80`：`ToolExecutionInput` 由
  agent-loop 构造，`agent` 字段唯一来源是 `ctx.agents.requireInitiator()`；模型的
  全部输入是 `name` + `arguments`（解析后的 JSON），不存在 principal 字段。
- `packages/core/tools/src/index.ts:324-325`：`ToolExecutionInput.agent` 注释
  "set by the agent loop"。
- subagent tool：子 agent 的 sessionId 由 provider 铸造
  （`packages/subagent/subagent-in-process-driver/src/index.ts:111`，
  `SessionId(randomUUID())`），模型不能指定子 agent 的 sessionId。
- SDK JSON-RPC server 接受 wire 上的 `sessionId` 并**自动创建**会话
  （`packages/sdk/server/src/server.ts:203-224`），但该通道的调用方是可信外部入口
  （Feishu connector → Router），且 transport 鉴权属于部署配置。

**结论：纯模型输入（prompt / tool 参数 / session 参数）无法伪造 initiator。**
前提是 Broker adapter 绝不从 tool 参数 / header / 请求体读取 principal——这是设计
约束，不是运行时保证。

### 2.3 同进程插件代码可以伪造 initiator（关键发现）

DSH 发行版已提供「模型可动态生成并加载 Cordis 插件」的能力（本会话即挂载了
`tool-cordis` 工具集）：

- `packages/extensions/tool-cordis/src/index.ts`：`cordis_define` / `cordis_run` /
  `cordis_stop` / `cordis_undefine` 是模型可见 tool；`cordis_define` 接受任意
  JavaScript 函数体作为 host half。
- `packages/extensions/cordis-host-runner/src/index.ts:252-303`：**审批只 gate
  client half**——`if (plan.definition.clientCode === undefined)` 时 host-only
  包直接 `activate()`，无任何审批。
- `packages/extensions/cordis-host-runner/src/guard.ts:705-746`：sandbox ctx
  façade 中 `ctx.get(name)` 是**可选查找，任意服务名**；`guardedService` 把方法
  转发到真实实例；`denyContext` 只拦截 `Context` 实例。因此动态 host 插件可以：
  - `ctx.get('agents').get(B_id)` → 拿到 B 的**真实 Agent 对象**（不是 Context，
    不被拦截），进而 `B.ctx` 是**真实未加壳上下文**；
  - `ctx.get('agents').withInitiator(B_agent, fn)` → 之后任何
    `requireInitiator()` 都报告 B；
  - `B.ctx.tools.execute({callId, name, arguments, agent: B})` → 以 B 的
    exec.agent 直接执行任意已注册 tool（绕过 agent-loop 的调度绑定）；
  - `ctx.get('agents').resume({resumeSessionId: B_id, agentOptions: 自己选定的
    model/config, setup: 自己写的})` → 接管 B 的持久化会话，之后所有 tool 调用
    都以「合法的 B initiator」运行；
  - `ctx.get('credentials').resolve(任意 ref)` / `ctx.get('web')` / `ctx.get('fs')`
    → 读取全部运行时凭据（`$DSH_HOME/.credentials.yaml`，0600，同用户）、直接
    HTTP 调用 Broker。
- `packages/extensions/cordis-host-runner/src/sandbox.ts:17-19` 原文：
  > *This keeps cooperative packages inspectable and disposable but is not
  > containment: host-realm helper functions remain an escape route.*
  （node:vm 不是安全边界，逃逸即完全主机权限。）
- `ctx.tools.execute` 对调用方提供的 `agent` 字段照单全收：
  `packages/core/tools/tests/scoped.spec.ts:419-424`、`tools.spec.ts:741-757`。
- `run_code` worker thread（`packages/code-runtime/code-runtime-worker-thread/
  src/index.ts:378`）与主进程同用户，可读凭据文件、可直接调 Broker HTTP；
  `packages/sandbox` 只约束子进程 argv，不约束宿主进程。

**结论：在「单 DSH 进程 + 允许 Agent 自生成插件」的前提下，恶意插件可以在进程内
完成全部三种伪造：withInitiator(B)、以 B 的 exec.agent 调 tool、resume(B) 接管会话；
还能读取 runtime 凭据直接打 Broker。** 模型参数层面的防线（2.2）在插件 seam 面前
不成立——这正说明信任边界必须放在进程之外。

### 2.4 DSH → Broker 现有通路

- V0 `@agent-core/broker` 只是本地计算 tool，尚无跨进程调用；
- 旧 agent-core 的 capability-host client 用静态 env token
  （`agent-core/src/server/capability_host_client.rs:58`），身份语义在 Broker/Auth
  层；旧 Auth（auth-service）是 OAuth2 形态：per-agent client/secret →
  client_credentials / RFC8693 token-exchange → JWT（HS256/RS256，
  iss/aud/sub）→ grant（audience+scopes）→ 下游 middleware 校验
  （`auth-service/src/routes/oauth.ts`、`src/lib/oauth/v1/exchange.ts`、
  `src/lib/oauth/token-exchange.ts`、`src/lib/oauth/v1/grant-migration.ts`）。

---

## 3. 三种方案对比

### A. 单 DSH 进程、多 Agent + runtime signed assertion —— **不成立**

- 签名密钥与攻击者（恶意插件）在同一进程同一 V8 isolate：node:vm 逃逸即取到
  进程一切内存/文件，密钥可提取；
- 攻击者甚至不需要密钥：`withInitiator(B)` / `B.ctx.tools.execute(..., agent:B)` /
  `resume(B)` 能让**可信签名路径本身**为「B 的请求」签名；
- 「进程内可信层」与「插件代码」在单进程内不可区分。

### B. 每 Agent 独立 DSH runtime/process + process credential —— **成立（推荐）**

- A 的进程里不存在 B 的 credential（spawn 时只注入 A 的）；A 的插件即使完全
  控制 A 的进程，也只能产出「A 身份的请求」——它**无法生成 B 的签名/凭据**；
- A 的进程里不存在 B 的 Agent 对象与 B 的 session store（per-agent DSH home），
  withInitiator(B) / resume(B) / 伪造 exec.agent 全部不可行；
- Broker 端身份 = 进程凭据（绑定 principal），忽略任何客户端自报 principal；
- 子 agent（subagent）默认与父进程同进程、同凭据 → wire 上呈现父 principal
  （子 agent 仍是 A 域），需要独立身份的编排节点由控制面单独起进程。

### C. 单 DSH 进程 + 独立 privileged broker/identity sidecar —— **按字面不成立，退化为 A**

- sidecar 是独立进程、密钥在 sidecar 里，但**DSH 进程内的插件代码与可信层走同一
  条本地通道**（同 socket/pipe/用户）：插件可以直接向 sidecar 发送
  `(principal: B, request)`，sidecar 无法区分同进程内的调用者；
- 除非 sidecar 的每次调用都携带 per-agent 密钥且该密钥只存在于进程外——那正是 B
  的形态。C 只有在「实现为 B」时安全。

**结论：在「允许未来 Agent 自生成插件」的前提下，只有 B 能保证 A 无法伪造 B。**

---

## 4. 最小可信身份传递（B 方案下的契约）

```
控制面（Router，可信，agent 进程之外）
  Feishu connector → 确定 target Agent → 映射 principal → spawn per-agent DSH 进程
  注入：process credential（env 或 0600 文件，仅本进程可见）+ 该 agent 的 home
Agent 进程（不可信，含模型与自生成插件）
  broker adapter（进程内唯一出站通道）每次请求只携带进程凭据
  requireInitiator()/exec.agent 仅用于日志/归因，永不作为 wire 身份
Broker
  验凭据 → 解析 principal → 查 per-principal capability ACL → 放行/403
  拒绝请求体/header/参数中任何客户端提供的 principalId/agentId
```

契约约束（必须满足，否则 A_CAN_SPOOF_B 为 YES）：
1. 模型不能提供 principalId：tool schema 无此字段；adapter 忽略之。
2. 普通 tool 不能提供 principalId：`ToolExecutionInput.agent` 只作归因。
3. Agent A 不能选择 B：A 的进程凭据是唯一身份源；B 的凭据不在 A 进程内。
4. Broker 最终可信知道「这是 Agent A」：凭据→principal 绑定由控制面建立，Broker
   校验签名/出示即得 principal，与请求内容无关。

---

## 5. 旧 Auth 删除清单

| 旧机制 | 判定 | 替代 |
|---|---|---|
| per-Agent client（OAuth client 注册） | **删除** | 控制面 spawn 时铸发进程凭据，无注册流程 |
| per-Agent secret（client_secret 校验） | **删除** | 进程凭据（随机 opaque token / mTLS cert），出带外下发，模型不可见 |
| token exchange（RFC8693） | **删除** | 委托 = 同进程归因（子 agent 呈现父 principal）或控制面为子进程发新凭据；运行时无换发 |
| JWT | **删除**（agent 路径） | opaque bearer / mTLS；无需签名/校验链 |
| Grant（audience+scope+版本+迁移） | **删除机制** | 保留最小 flat「principal → capability」allowlist（授权语义仍在，机制替换） |
| Principal registry（多类型主体验图） | **删除** | Broker 侧 credential→agentId 绑定表（配置行，非注册服务） |

不允许为兼容旧 Agent Core 保留任何上述机制。

---

## 6. 最小攻击测试（实现后执行；本轮不落地）

目标：Agent A 以 Agent B 身份调用一个**只授予 B** 的 capability，必须被拒绝。

### 6.1 预置
- principal A：capability `calc.*`；principal B：capability `forum.admin_only`（仅 B）。
- Broker 启动时加载绑定表 `credA→A, credB→B` 与 ACL。
- 控制面以 credA 起 A 进程，以 credB 起 B 进程。

### 6.2 用例

1. **参数走私**（模型层）：向 A 的 tool schema 中追加 `principalId: "B"` 参数 →
   期望：schema 拒绝 / adapter 忽略；Broker 日志 `principal=A`；B-only capability
   返回 403。
2. **prompt 注入**：A 的输入被诱导「以 B 的身份发帖」→ 期望：tool schema 无身份
   字段；Broker 看到 `principal=A`；403。
3. **插件伪造（决定性用例）**：A 动态生成 host-only Cordis 插件，apply 中依次尝试
   (a) `ctx.get('agents').withInitiator(B_agent, …)`；
   (b) `B_agent.ctx.tools.execute({name:'forum_admin_only', …, agent: B_agent})`；
   (c) `ctx.get('agents').resume({resumeSessionId: B_id, …})`；
   (d) 直接向 Broker 发请求并自报 `principalId: B`。
   期望（B 架构）：(a)(b)(c) 在 A 进程内解析不到 B 的 Agent 对象 / B 的 session
   store（404/加载失败）；(d) Broker 以进程凭据为准 → `principal=A` → 403；
   审计日志记录 `attempted_principal=B, actual_principal=A, denied`。
4. **负向对照**：同一插件以 A 身份调用 `calc.*` → 200；B 进程调用
   `forum.admin_only` → 200。

### 6.3 验收断言
- 4 个用例中凡涉及「以 B 身份」的请求全部返回 403（或前置失败），且 Broker 侧
  可审计的实际 principal 恒为 A；
- 唯一能成功调用 B-only capability 的身份是 credB 的进程。

---

## 7. 证据索引（deepseek-harness checkout）

| 事实 | 证据 |
|---|---|
| initiator 是进程内归因 | `packages/core/agent/src/index.ts:250-254, 309-326` |
| withInitiator 接受任意 Agent | `packages/core/agent/src/index.ts:333-343`；`tests/agent-initiator.spec.ts:49-57` |
| get/list 无访问控制 | `packages/core/agent/src/index.ts:583-605` |
| 模型输入无身份字段 | `packages/core/agent-loop/src/tool-calls.ts:67-80` |
| execute 接受调用方 agent | `packages/core/tools/tests/scoped.spec.ts:419-424`；`tools.spec.ts:741-757` |
| resume 无主体验证 | `packages/core/agent/src/index.ts:424-430`；`session-persistence-jsonl/src/index.ts:184` |
| 动态插件是模型工具 | `packages/extensions/tool-cordis/src/index.ts` |
| host-only 包免审批 | `packages/extensions/cordis-host-runner/src/index.ts:252-303` |
| sandbox ctx 可取任意服务/真实对象 | `packages/extensions/cordis-host-runner/src/guard.ts:705-746` |
| vm 非安全边界 | `packages/extensions/cordis-host-runner/src/sandbox.ts:17-19` |
| 凭据文件同用户可读 | `packages/credentials/credentials-local/src/index.ts` |
| run_code 为同用户 worker | `packages/code-runtime/code-runtime-worker-thread/src/index.ts:378` |
| SDK server 按 wire sessionId 自动建会话 | `packages/sdk/server/src/server.ts:203-224` |
| 子 agent sessionId 由 provider 铸造 | `packages/subagent/subagent-in-process-driver/src/index.ts:111-133` |
| 旧 Auth 形态 | `auth-service/src/routes/oauth.ts`、`src/lib/oauth/v1/exchange.ts`、`src/lib/oauth/token-exchange.ts`、`src/lib/oauth/v1/grant-migration.ts` |
| 旧 kernel 出站 token | `agent-core/src/server/capability_host_client.rs:50-58` |
