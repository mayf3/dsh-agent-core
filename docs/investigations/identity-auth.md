# Identity-Auth Investigation

> 主题：identity-auth（身份与认证）。本报告是 V1 能力调查的一部分，只调查不实现，
> 未修改任何代码。基础证据来自 `docs/TRUST-BOUNDARY-REPORT.md`（既有信任边界调查），
> 本轮在 `deepseek-harness` checkout 重新抽查关键证据是否仍成立（2026 当前 checkout）。

## 1. Required behavior

以 OpenClaw / 旧 Agent Core 为参照，Agent 基础设施在「身份与认证」上必须满足：

- **不可伪造（Non-spoofability）**：Agent A 无论通过 prompt 注入、tool 参数、动态
  插件代码，还是同进程其他代码，都不能以 Agent B 身份调用只授予 B 的能力
  （Broker / Forum / Workflow）。这是硬约束，单一违例即为失败。
- **发起方归因（Attribution）**：每次 action / tool 调用 / 出站请求能可靠记录
  「由哪个 Agent 驱动」，用于日志、审计、计量。
- **跨进程信任（Cross-process）**：DSH → Broker 的出站调用必须携带一个 Broker 侧
  可信的身份，且该身份不可被请求内容（header/body/参数）覆盖。
- **授权（Authorization）**：Broker 侧每个 principal 有最小能力 allowlist；无
  principal 则拒绝（fail-closed）。
- **委托（Delegation）**：子 agent / 编排节点的身份语义清晰（同域子进程呈现父身份，
  需独立身份的节点单独发凭据）。

## 2. DSH native capabilities

（路径均相对 `deepseek-harness/` checkout；行号为本轮实测。）

### 2.1 进程内发起方归因（存在，仅归因）

| 证据 | 位置 |
|---|---|
| `AgentRegistry.currentInitiator/requireInitiator` 基于 `AsyncLocalStorage` | `packages/core/agent/src/index.ts:309-326` |
| 明确注释 "same-process causal attribution only … not authorization"，"identity at worker, process, persistence, and wire boundaries" | `packages/core/agent/src/index.ts:250-254` |
| `withInitiator(anyAgent, op)` 接受任意 Agent，注释"does neither"验证/解析 | `packages/core/agent/src/index.ts:341-343` |
| `tools.execute` 对调用方提供的 `exec.agent` 字段照单全收（scope-filter、resolve） | `packages/core/tools/src/index.ts:1122,1277,1370-1389` |
| agent-loop 以 `requireInitiator()` 作为 tool 的 `agent` 唯一来源（模型输入无 principal 字段） | `packages/core/agent-loop/src/tool-calls.ts:67-80` |

### 2.2 动态插件攻击面（关键，证据仍成立）

| 证据 | 位置 |
|---|---|
| `cordis_define` 接受任意 JS 函数体作为 host half，是模型可见 tool | `packages/extensions/tool-cordis/src/index.ts:149-228` |
| host-only 包（`clientCode===undefined`）直接 `activate()`，**无审批**；审批只 gate client half | `packages/extensions/cordis-host-runner/src/index.ts:270-303` |
| sandbox `ctx.get(name)` 任意服务名，`guardedService` 转发到真实实例，仅 `denyContext` 拦 `Context` 实例 | `packages/extensions/cordis-host-runner/src/guard.ts:718-746` |
| sandbox 明示 "not containment"，"host-realm helper functions remain an escape route"（node:vm 逃逸 = 完全主机权限） | `packages/extensions/cordis-host-runner/src/sandbox.ts:6-7` |

⇒ **全部结论与 TRUST-BOUNDARY-REPORT 一致，抽查证据均仍成立**：在「单 DSH 进程 +
允许自生成插件」前提下，A 的插件可 `ctx.get('agents').get(B_id).ctx`（真实未加壳上下文）、
`withInitiator(B, fn)`、`ctx.tools.execute({…, agent: B})`、`resume({resumeSessionId:B_id})`、
直接 `ctx.get('credentials')` 读取凭据打 Broker → `A_CAN_SPOOF_B = YES`。

### 2.3 DSH 自带的身份/凭据族（都不是「身份认证」）

**关键结论：DSH 目前没有 principal / ACL / OAuth 身份系统。**

| 包 | 真实能力 | 位置 |
|---|---|---|
| `identity/` | **只有 `anonymous-user-id`**，README 明示 "do not represent an authenticated account"，是遥测关联 id | `packages/identity/README.md:1-8`；`identity/anonymous-user-id/src/index.ts` |
| `credentials/` | **凭据引用 seam**：存外部服务的 secret（API key 等），`ctx.credentials.resolve()` 按引用取值；文件 `$DSH_HOME/.credentials.yaml`，0600 | `packages/credentials/credentials-local/src/index.ts:309-316,393` |
| `acp/` | Agent Client Protocol 自动化传输；**认证为空**（`authMethods: []`） | `packages/acp/acp/src/index.ts:243,247`；`packages/acp/README.md` |
| `sdk/` | jsonrpc server 按 wire `sessionId` get-or-create 会话，供外部 connector/入口驱动；transport 鉴权属部署配置 | `packages/sdk/server/README.md`；`sdk/server/src/server.ts` |
| `sandbox/`+`subprocess/` | 每个上下文一个 sandbox seam、可换 backend；本地 `spawn` 支持按 B 方案起进程 | `packages/sandbox/`、`packages/subprocess/subprocess-local/src/spawn.ts:350` |

**结论**：DSH 的 `credentials` seam 是做「进程凭据」的天然落点（per-agent 进程只需在
spawn 时注入该 agent 的 credential ref/文件，就满足方案 B），但 DSH 自身**没有**
principal 概念、没有签发/校验凭据的服务、没有把凭据绑定到业务主体的一层。

### 2.4 per-agent 进程 / 独立 home（方案 B 的可行基础）

- DSH home 通过 `dshHomePath` 注入、进程可独立指定（`packages/boot/app-boot/src/index.ts:770`、
  `packages/util/home-paths/src/index.ts`），即「per-agent DSH home」在运行时可行。
- profile / bundle / agent-presets（`isolate` realm）支持 per-session 组合
  （`packages/preset/agent-presets/src/index.ts:421`）。
- 但要真正起「每 Agent 独立 DSH runtime/process」，需控制面（Router）spawn 多个
  `dsh` 进程并分别注入不同 home 与凭据——DSH 有 spawn 原语（`ctx.subprocess`），
  但**没有**现成的「per-agent 多进程编排」bundle。

## 3. Existing community plugins

（web_search 本轮不可用：DeepSeek search 无 `DEEPSEEK_API_KEY`，多次调用均报
"no API key"。以下为基于 DSH checkout / 已知生态的判断，未做在线检索。）

- **OpenClaw**：其身份/认证历史上是轻量的「extensions 自管 access/secret + 人机审批」，
  没有强 per-agent OAuth 主体验证；dsl 授权主要靠 `approval` 策略而非跨进程 principal。
  与本项目"旧 Auth = OAuth2 per-agent client/secret + token-exchange + JWT + principal
  registry"不是同一形态。
- **DSH 生态**：**未发现**任何已发布的身份/认证/principal 插件。DSH 把"谁能做什么"
  交给可插拔的 `approval` seam 与 `sandboxPolicy`/`fs-observation-policy` 等部署层策略，
  默认是全授予（本会话即 `danger-full-access`）；`identity/` 仅 `anonymous-user-id`。
- **必须自己做的"身份认证"层**（见 §5）：DSH 只提供拼图碎片（credentials seam、
  per-process home、approval/sandbox seam、out-of-process spawn），没有把它们拼成
  「per-agent 进程凭据 + Broker 侧 principal 绑定」的一层。

## 4. Evidence

（本检查点抽样结论：TRUST-BOUNDARY-REPORT 的每一条在本轮都仍然有效，见 §2 表格。）
代表性决定证据链：

```
A 想伪造 B（仅授予 B 的 capability）
  ├─ 模型参数/header 走私 principalId → tool schema 无此字段，adapter 忽略
  │     证：agent-loop/tool-calls.ts:71-80（exec.agent 由 requireInitiator 注入，非模型输入）
  ├─ 动态插件（决定性）：host-only 免审批 activate
  │     证：cordis-host-runner/index.ts:270-303
  │     sandbox ctx.get 可达真实 agents/credentials
  │     证：cordis-host-runner/guard.ts:718-746
  │     vm 非 containment → 逃逸即全主机权限
  │     证：cordis-host-runner/sandbox.ts:6-7
  │     tools.execute 接受调用方 agent → 以 B 的 exec.agent 执行任意 tool
  │     证：tools/index.ts:1277,1370；scoped.spec.ts:708
  ├─ 读凭据直接打 Broker
  │     证：credentials-local/index.ts:309-316（resolve 任意 ref）；0600 同用户可读
  └─ assert：模型/参数面被挡住，但同进程插件 seam 不成立 → 信任边界必须放进程外
```

`A_CAN_SPOOF_B`（当前架构：单进程 + 自生成插件）= **YES**；
迁移到方案 B（per-agent 进程 + process credential）= **NO**。

## 5. Gaps

为替代 OpenClaw / 旧 Agent Core 的「身份认证」语义，DSH 还缺什么：

1. **缺 principal / 业务主体层**：无「谁（agent principal）能做什么」的概念与 ACL；
   `identity/` 只做遥测匿名 id。
2. **缺进程级身份注入机制**：没有"spawn 此进程并注入唯一凭据、且该凭据不在此进程外"'的内建原语——需在控制面（Router）实现，复用 `ctx.subprocess` + per-process `dshHomePath`。
3. **缺 Broker 侧凭据→principal 绑定与校验**：旧 Auth 的 principal registry 绑定、JWT 校验都必须由本项目在 Broker 侧重建（flat allowlist，非旧图）。
4. **缺对"插件即信任边界"的正确处置**：默认 `danger-full-access` + 动态插件同进程，与"不可伪造"冲突——必须让每个 Agent 的进程边界成为唯一身份源，并在该进程内禁用/减弱跨进程伪造路径（或明确接受单进程=单信任单元）。
5. **缺出站 adapter 的身份纪律**：broker adapter 必须只带进程凭据、绝不读请求体/参数自报 principal（设计约束 + 测试断言，非运行时保证）。

## 6. Options

- **A. 单 DSH 进程 + runtime signed assertion**：密钥与恶意插件同 V8 isolate，逃逸即取密钥；可信签名路径本身可被 `withInitiator(B)`/`tools.execute(agent:B)` 利用。**不成立**。
- **B. 每 Agent 独立 DSH runtime/process + process credential**：spawn 时只注入 A 的凭据，A 进程内不存在 B 的凭据与 B 的 Agent 对象，伪造不可行；Broker 以进程凭据解析 principal。**成立（推荐）**。
- **C. 单进程 + 独立 identity sidecar**：sidecar 在进程外但插件与可信层走同一本地通道，sidecar 无法区分同进程调用者。除"实现为 B"外不安全。

后续均可再叠加：Broker 侧 flat `principal → capability` allowlist（授权语义，机制扁平化）。

## 7. Recommendation

**主 Recommendation：BUILD** —— DSH 缺 principal/进程凭据/绑定层，必须自建"per-agent
进程 + process credential"架构（方案 B），无法仅靠 ADOPT 现有组件完成不可伪造。

| 子项 | 动词 | 理由 |
|---|---|---|
| 控制面（Router）per-agent 进程 spawn + 注入进程凭据 + per-agent home | **BUILD** | 这是方案 B 的核心；DSH 只有 spawn/home 原语，编排层要全新做 |
| Broker 侧 credential→principal 绑定 + flat capability ACL | **BUILD** | 用 flat allowlist 替代旧 OAuth/JWT/principal 图，机制精简但仍需自建 |
| broker adapter 出站只带进程凭据、忽略自报 principal | **ADAPT** | 复用 DSH `ctx.credentials.resolve` 作为凭据来源，按契约收紧 adapter |
| 进程内 initiator（`requireInitiator`/`exec.agent`） | **ADOPT** | 保留作归因/审计，明确不作 wire 身份授权 |
| per-agent 独立 session store / home 隔离 | **ADAPT** | DSH `dshHomePath` + profile 组合已原生支持，按进程粒度复用 |
| 动态插件（tool-cordis / cordis-host-runner） | **DEFER** | 在 per-agent 进程内它是"本进程身份下自提权"，跨进程安全感只在每进程边界；不作为跨 agent 信任机制 |

## 8. Open questions

1. **子 agent 是否应与父进程共享主身份（wire 上呈现父 principal），还是需要独立身份时由控制面单独起进程？**（影响 DSH 内建
   `subagent` 的审计语义是否足够。）
2. **进程凭据形态选 opaque bearer token 还是 mTLS 证书？**（决定 `credentials-local`
   是否够用、是否要新 provider。）
3. **Broker 侧 audit 的「attempted_principal vs actual_principal」事件由谁产出、格式如何定义？**
   （最小攻击测试的断言依赖它，需在 Broker adapter 契约里明确。）
4. 若沿用单进程部署（短期），如何在动态插件 seam 上临时收紧以缓解 `A_CAN_SPOOF_B`？
   （是默认禁用 tool-cordis / 抬高审批，还是接受单进程=单信任单元？）
