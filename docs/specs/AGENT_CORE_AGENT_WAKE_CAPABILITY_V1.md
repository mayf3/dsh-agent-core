---
spec_id: AGENT_CORE_AGENT_WAKE_CAPABILITY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-08-31
revision: r3（2026-08-31 第二轮审计 REVISE：关闭唯一遗留 blocker B4——
  R2 参数校验执行位置冻结准确：R2 full validation location =
  TRUSTED_HANDLER。代码事实：child-side validateArgumentsDetailed 仅覆盖
  required / type / numeric min-max / enum，不覆盖 pattern / charset /
  字符串长度 / 控制字符 / 未声明 key，且既有 mapping 对未声明参数容忍、
  gateway local 路径在 handler 调用前亦无完整 R2 校验——完整 R2 验证因此
  冻结在 handler 内执行，先于 requestId 派生、message 派生、
  agentRouter.deliver、L1 success audit（§4/R2/R5/ACC-002 同步修订；
  r1/r2 的「handler 零执行」表述作废，改为「agentRouter.deliver / fake
  router 零调用」）。B1/B2/B3 与全部不变量零回退。）
  r2（2026-08-31 审计 REVISE：关闭三个 blocker，全部为代码事实
  修正，r1 语义裁定（三参数面 / requestId-message 派生 / dedupe key /
  caller grant 面 / fresh-only / audit 两层）不变——(1) relay local
  capability 支持缺口：relay.js:64 只为带 http 块的 operation 构建 relay
  handler，local capability 在 child 侧零 handler，实现闭包新增 MOD
  relay.js（§4）；(2) localHandlerResolver 注入路径缺口：index.js:182 把
  gateway resolver 硬绑唯一 agentDefinitionAccess 服务，compose 无法零
  broker 改动注入，闭包新增 MOD broker index.js resolver 泛化（§4），
  gateway.js 维持零改动；(3) Router 错误码映射事实：deliver 只 throw 不
  返回错误信封，coded 错误恰 AGENT_NOT_FOUND（含 disabled 的路由拒绝）与
  AGENT_DISABLED（assertRunnable 竞态窗口），spawn/store/inbox 失败为无
  code 的 plain Error——R5 重写为 handler 内显式翻译层，错误表按发射点
  事实重排（agent_start_failed / unauthenticated / forbidden 移除，
  credential_unavailable 新增），并修正 §2.2/R1 三处交叉引用。不变量保持：
  agentRouter.deliver 纯转发 / trusted credential / no OpenClaw / no
  workspace mutation。）
  r1（初版。从 AGENT_CORE_HR_DISPATCHER_V1 §4（proposed r3）提取
  agent_wake 能力合同并收紧为独立 governing Spec：模型可见输入面冻结为
  targetAgentId / workflowInstanceId / reason 恰三参数；requestId 与 message
  由受信区按冻结公式结构性派生（caller 不再自供——HR_DISPATCHER §4.1 的
  caller-supplied 形态升级为派生形态，需其 r4 同步 AMEND，见 §2.3）；
  dedupe key 冻结为 (workflowInstanceId, targetAgentId) 二元组。）
task_name: 唤醒 规格
task_type: SPEC_AUTHORING_ONLY
scope:
  - 一枚 broker local capability（id = toolName = agent_wake，operation
    wake）的完整合同：capability 面 / 参数面 / requestId 与 message 派生 /
    权限语义 / 幂等与重复 wake 行为 / audit / 错误表
  - Caller 限制的授权面冻结（V1 恰 workflow-dispatcher-hr-agent 专用
    identity；扩展 = AMEND）
  - 实现闭包（accept 后评审路径）：packages/broker（manifest + 测试）、
    packages/production-runtime（wiring + handler + audit + 测试）
  - 生产 canary 计划（独立授权轮次的验收面）
governed_by:
  - docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md（D-006，accepted —
    fresh non-main session 纪律，经 router deliver sessionMode:'fresh' 继承）
  - docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md（accepted — Spec 作为
    merge / implementation authority 的元治理）
external_authorities:
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_AGENTCORE_HR_DISPATCHER_IDENTITY_V1
    revision: 441c52e31e995fee032bc49b066bb0226990993d（HR_DISPATCHER r3
      frontmatter 所 pin；其后续演进以 auth-service 仓为准，本 Spec 只依赖
      其冻结的 exact grant 面：workflow.read + agent.wake）
    relation: prerequisite_caller_grant（专用 dispatcher identity 的
      machine client 恰获 scope agent.wake；普通 Agent 零授予）
related_specs:
  - docs/specs/AGENT_CORE_HR_DISPATCHER_V1.md（proposed r3 — §4.1/§3.4 含
    本能力的旧形态 freeze；本 Spec 提取并收紧，见 §2.3 同步 AMEND 义务）
  - AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V1（proposed 姊妹 Spec —
    链路上游只读扫描能力；本 Spec 不依赖其实现，仅链路引用）
supersedes: []
superseded_by: null
owners:
  - repository-maintainers
---

# AGENT_CORE_AGENT_WAKE_CAPABILITY_V1 — agent_wake broker capability（Dispatcher → Router deliver 的唯一 Agent-facing 唤醒面）

> 状态：**proposed**（r3 — 四个审计 blocker 全部关闭：B1 relay local
> 支持、B2 localHandlerResolver 注入路径、B3 Router 错误码映射事实、
> B4 R2 完整参数验证位置 = TRUSTED_HANDLER；不变量保持
> agentRouter.deliver / trusted credential / no OpenClaw / no workspace
> mutation）。本 Spec 当前不授予任何实现、合并或 production apply 权限。
> `implementation_authority = none`；`production_apply_authority = none`。
> 本轮 **零代码改动、零 grant、零部署、零生产访问**（§9）。
> NEXT_TASK = 唤醒 审计（对 r3 的 independent re-review）。

## 0. 任务语境与一句话模型

目标链路（任务冻结；本 Spec 治理加粗一段）：

```text
workflow_global_instances（只读扫描，姊妹 Spec）
  ↓
Dispatcher（workflow-dispatcher-hr-agent-v1 recurring job，HR_DISPATCHER Part A）
  ↓
agent_wake   ←←← 本 Spec（唯一 Agent-facing 唤醒面）
  ↓
Router deliver（AGENT_ROUTER_DELIVERY_V0，已 merged，全部 admission 语义归它）
  ↓
Agent session（fresh non-main native session，D-006）
  ↓
workflow_execute（目标 agent 在自己 session/workspace 内推进，本 Spec 范围外）
```

一句话：**agent_wake 是对既有正式派发机制 `agentRouter.deliver` 的一层最薄、
scope-gated、结构性幂等的 broker local capability 暴露——零新 admission /
session / 派发语义，一切语义由 Router 既有实现拥有；caller 只有一个（专用
dispatcher identity），target 只是路由目标，永远不是身份或权限来源。**

## 1. Goal

1. 冻结 `agent_wake` 的**完整 capability 合同**（§3）：面、参数、派生公式、
   幂等、audit、错误表——使实现轮可以按 exact closure（§5）零歧义落地。
2. 冻结 **Caller 限制的授权面**（§3 R3）：V1 恰
   `agt_workflow-dispatcher-hr-agent` 一个持权者；普通 Agent 结构性
   `access_denied`；扩展 = 本 Spec AMEND + auth-service grant 轮次。
3. 冻结**幂等键与重复 wake 行为**（§3 R4）：requestId 受信区派生、
   dedupe key = (workflowInstanceId, targetAgentId)、重复调用收敛到同一
   fresh session——全部结构性继承 Router read-or-mint，capability 层零新
   dedupe 机制。
4. 冻结 **audit 五要素**（§3 R6）：caller / target / workflow instance /
   request id / result，成功与失败每次调用必有一条，append 失败
   failed-visible。
5. 显式声明与 HR_DISPATCHER §4 的提取/收紧关系及同步 AMEND 义务（§2.3），
   及实现、部署、canary、dispatcher 激活各自独立的授权 gate（§2.2）。

## 2. Authority chain 与前置 Gate 链

### 2.1 依赖事实（2026-08-31）

| 依赖 | 状态 | 证据 |
|---|---|---|
| `agentRouter.deliver`（AGENT_ROUTER_DELIVERY_V0） | **merged**（现有正式派发机制） | packages/agent-router/src/index.js:741-800：`{requestId, agentId, sessionMode:'main'\|'fresh', message}`；fresh = durable read-or-mint `fresh-<sha256(agentId\0requestId)...>` → `{accepted, sessionId}`；stray `sessionId` 入参 fail-loud |
| deliver 失败形态（r2 事实修正，blocker #3） | **fact**：只 throw，不返回错误信封 | deliver 全部失败经异常通道。coded 错误恰两个：`AGENT_NOT_FOUND`（definition `resolveAgentRef`，**unknown 与 disabled 的路由拒绝同码**——definition.js:376-386「disabled agents are not routable」）与 `AGENT_DISABLED`（`assertRunnable`，agent-router index.js:499-503；deliver 路径仅 mid-call 配置重载竞态窗口可达，因 resolveAgentRef 先行已拒 disabled）。spawn / freshSessionFor store / proc.deliver inbox 失败为**无 code 的 plain Error**（不存在 `agent_start_failed` 事实载体）。gateway 对 handler **throw** 统一收敛 `internal_error`（gateway.js:190-193）⇒ handler 必须以 return envelope 翻译 coded 错误（R5 翻译层） |
| local capability 的 child 侧 relay 现状（r2，blocker #1） | **GAP**（闭包修复，§4） | packages/broker/src/relay.js:64 `if (!op.http) continue`——只为带 `http` 块的 operation 构建 relay handler，local manifest 的 operation 在 child 侧**零 relay handler**。broker index.js child 模式已把 local manifest 路由进 `createRelayHandlers`（`hasHttp \|\| manifest?.local !== undefined`，注释即声明「LOCAL capabilities also RELAY」），但 relay gate 未放行——`agent.definition.*` 是唯一 local 先例且无 child 消费者，该路径从未走通；relay.test.js 无 local 覆盖。`agent_wake` 是首个 child-facing local capability ⇒ MOD relay.js 进闭包 |
| gateway local handler 注入现状（r2，blocker #2） | **GAP**（闭包修复，§4） | packages/broker/src/index.js:182：`localHandlerResolver: () => ctx.get('agentDefinitionAccess')?.handlers ?? {}`——硬绑唯一服务，composition 无法零 broker 改动注入。gateway 契约本身完备：`localHandlers` / `localHandlerResolver` 返回 `Record<capabilityId, Record<op, async (args,{agentId})=>envelope>>`，**execute-time 解析**（loader 并发 apply 竞态纪律，gateway.js:88-95/137/187-189），缺席 fail-closed `unsupported_operation`（gateway.js:138-139）；scope 门禁先于 handler（gateway.js:163-186），caller credential 检查更先于二者（gateway.js:147-159，`credential_unavailable`）⇒ MOD broker index.js resolver 泛化 + compose 侧 provide `agentWakeAccess`；**gateway.js 零改动** |
| broker local capability 先例（scope 门禁 + trusted ctx） | merged | packages/broker/src/capabilities/agent-definition.js（agent.definition.write：`local: {resource}` + `requiredScopes`）；packages/broker/src/gateway.js:164-186 —— requiredScopes 存在时先取 client_credentials token，失败即 `access_denied`，handler 零执行 |
| caller 身份 seam | merged | gateway localHandlers `async (args, {agentId})`（gateway.js:189）；Router 侧 proc.onRpcRequest 以 spawn 关系决定 agentId，child 自报身份 logged-and-ignored（agent-router/src/index.js ~578-613）——caller 身份永不出自 call payload |
| capability 语义 audit 的 evidence seam | merged | packages/production-runtime/src/compose.js:296-307 —— `router.deliver` 包一层 `writeEvidence({kind:'deliver', ...})`（JSONL append，失败 log 可见、不阻塞）；本 Spec 的 L1 audit 沿用同一 writeEvidence 纪律（§3 R6） |
| manifest / args 校验面 | merged | packages/broker/src/schema.js `validateManifest`（local 标记与 http 互斥、错误表约束）；packages/broker/src/mapping.js `validateArgumentsDetailed`（required / type / min-max / enum，violation → `invalid_arguments` fail-fast） |
| `agent_wake` 代码现状 | **零实现**（main 与本分支 packages/ 全树 grep 0 hits） | 本轮 grep 证据；HR_DISPATCHER §6 预言的 `capabilities/agent-wake.js` 尚不存在 |
| HTTP ingress 双生形态 | merged，**不作为 Agent 工具面** | packages/notification-ingress `POST /v1/deliver` → router.deliver（同一机制的另一个 caller 面；本 Spec 只绑进程内 seam） |
| 专用 dispatcher identity + `agent.wake` grant | **proposed**（auth-service Spec 独占治理） | AUTH_SERVICE_AGENTCORE_HR_DISPATCHER_IDENTITY_V1（HR_DISPATCHER r3 pin 441c52e；exact grants = workflow.read + agent.wake；workflow.execute/admin 与一切 scheduler scope FORBIDDEN） |
| HR_DISPATCHER §4 旧形态 freeze | proposed（r3） | 本 Spec 提取并收紧（§2.3）；其 §3.4 已预留姊妹 Spec 工具参数变更的同步 AMEND 义务 |

### 2.2 Gate 链（冻结；顺序不可跳跃）

```text
G1  本 Spec accepted（评审轮 NEXT_TASK = 唤醒 审计）
G2  实现闭包（§4）按 GOVERNING_SPEC_UNMODIFIED 评审合并（实现 PR 不得修改
    本文件；manifest 计数基线以实现时 main 实测为准——姊妹 capability
    manifests 落地次序会移动基线，dual-path 纪律；闭包含 relay gate 修复
    与 resolver 泛化两处 broker 基建 MOD，均以既有 index.js 注释声明的
    设计意图为依据，非新语义）
G3  部署到生产 lineage = 独立 operator 轮次（本 Spec 不含 production apply
    authority）
G4  auth-service 侧专用 identity + agent.wake exact grant 供给 = 外部 Spec
    独占治理的独立轮次（无 grant 时能力对一切 caller access_denied——
    fail-closed，部署先于 grant 无害）
G5  生产 canary C1（§5）= 独立授权轮次；须 G3+G4 之后
G6  HR_DISPATCHER r4 同步 AMEND（§2.3）merged——是 dispatcher 激活
    （HR_DISPATCHER G0–G7）的前置，不是本能力实现 merge 的前置
```

本 Spec 的 accept（G1）不蕴含 G2–G6 任何一项；反之亦然。

### 2.3 与 HR_DISPATCHER §4 的关系（提取 + 收紧 + 同步义务）

- **提取**：HR_DISPATCHER §4.1 冻结的 agent_wake 暴露（local capability、
  scope `agent.wake`、`agentRouter.deliver` 纯转发、sessionMode 恒 fresh、
  target 非身份）全部语义**原样进入本 Spec**——本 Spec 是该能力合同的
  新唯一 governing Spec（能力维度从 dispatcher Spec 中拆出，二者是同一
  合同的两侧：dispatcher Spec 管 job/roster/红线，本 Spec 管 capability）。
- **收紧（本 Spec 的实质变更，r1）**：caller-supplied
  `requestId` + `message` 两参数**取消**，改为受信区结构性派生
  （§3 R2/R4）；模型可见输入面 = 任务冻结的恰三参数
  `targetAgentId` / `workflowInstanceId` / `reason`。理由：(i) 幂等键不再
  依赖 prompt 纪律 + regex 校验，caller 物理上无法铸造新键或自由 message；
  (ii) dedupe key 显式冻结为 (workflowInstanceId, targetAgentId)，reason
  变化不再可能绕过收敛；(iii) 审计五要素中的 request id 由此确定性可复算。
- **同步义务（G6）**：HR_DISPATCHER 需 r4 AMEND——§4.1 参数表改为引用本
  Spec 三参数形态；§3.4 FROZEN_DISPATCH_PROMPT 第 4 条由「带 requestId 与
  message 调用」改为「调 agent_wake(targetAgentId, workflowInstanceId,
  reason)」。其正文已声明「若姊妹 Spec 的工具名或参数名在评审中变更，本
  prompt 同步 AMEND」——本 Spec 触发的正是该预留路径。本轮**不修改**
  HR_DISPATCHER 文件（它是 proposed Spec，其修订走它自己的评审轮）。

## 3. 冻结的 Capability 合同（rulings）

### R1 — Capability 面（冻结）

```text
id = toolName = agent_wake            # 一 capability 一 tool 一 operation
local: { resource: 'agent-wake' }     # broker local capability：无 http
                                      # binding；gateway 模式经
                                      # localHandlers / localHandlerResolver
                                      # 执行（agent.definition.* 先例）
requiredScopes: ['agent.wake']        # 部署侧 exact-identity 仅授予专用
                                      # dispatcher identity（R3 / G4）
operation: wake（唯一）
```

- manifest = **纯数据**（packages/broker/src/capabilities/agent-wake.js），
  handler 由 control-plane 组合层经 `agentWakeAccess` 服务注入（§4）；manifest
  内不含任何逻辑。
- 必须通过 `validateManifest`；`local` 与 `http` 互斥（schema.js 既有约束）。
- notification-ingress `POST /v1/deliver` 是同一 deliver 机制的 HTTP ingress
  形态，**不是** Agent 工具面，本 Spec 不触碰它（ALT-005）。

### R2 — 参数面（模型可见输入，恰三个，冻结）

```text
args（两段校验模型，r3 冻结 R2 full validation location =
     TRUSTED_HANDLER；违反 → return invalid_arguments，且
     agentRouter.deliver / fake router **零调用**——参数验证本身就在
     handler 内执行，r1/r2 的「handler 零执行」表述作废：
       child-side    validateArgumentsDetailed 基础层：required / type /
                     numeric min-max / enum（既有行为；不覆盖 pattern /
                     charset / 字符串长度 / 控制字符 / 未声明 key，且
                     mapping 对未声明参数容忍——不构成 R2 防线）
       trusted       handler 完整层：完整 R2 验证——pattern / charset /
       handler       字符串长度 / 控制字符 / 未声明 key 拒绝，作为
                     handler 的第一个动作，先于 requestId 派生、message
                     派生、agentRouter.deliver、L1 success audit（§4））:
  targetAgentId     string  required   # ^agt_[a-z0-9-]+$ —— exact fleet
                                       # agent id；无 wildcard、无 regex、
                                       # 无 default、无批量、无模糊匹配
  workflowInstanceId string  required  # ^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$
                                       # —— charset 冻结：禁 ':'（保证派生
                                       # requestId 可解析）、禁路径语义；
                                       # 与 svc-workflow 实际 id grammar 的
                                       # 最终对齐在实现轮对照已 merge 的
                                       # workflow manifests 确认（dual-path）
  reason            string  required   # 1..240 chars，禁控制字符——caller
                                       # 组合的唤醒事由（dispatcher prompt
                                       # 纪律：应携带 instance title 与
                                       # current node 上下文）；非密内容

整个 args object：未声明 extra key **一律拒绝**（trusted handler 显式
执行该拒绝——既有 mapping 对未声明参数容忍，manifest 声明面不自动成为
运行时防线）。
```

**参数面上物理不存在**：requestId（派生，R4）、message（派生，R2a）、
sessionMode（结构性不透出，恒 'fresh'）、任何 principal/credential/
identity 字段（caller 身份只出自 trusted ctx，R3）。

### R2a — message 派生（冻结模板，字节级）

```text
message = "Workflow dispatch wake: instance <workflowInstanceId> — <reason>"
```

模板变更 = 本 Spec AMEND。target session 收到的内容确定性等于
模板 ∘ (workflowInstanceId, reason)；caller 没有自由 message 注入面
（对 ALT-001 的结构性收紧）。

### R3 — 权限语义（冻结）

- **机制 = 唯一**：auth-service grant 面。scope `agent.wake` 以
  exact-identity machine client grant 的形式**恰授予**
  `agt_workflow-dispatcher-hr-agent`（G4；auth-service Spec 冻结的 exact
  grant 集合）。无 grant 的一切 caller（含全部普通 Agent、HR 主身份
  agt_hr-agent、其余 84 个 fleet Agent）→ gateway scope 门禁
  `access_denied`，handler 零执行（gateway.js:163-186 既有路径）。
  门禁序（r2 事实冻结）：caller 的 MachineClient credential 检查**先于**
  scope 门禁（gateway.js:147-159）——无 credential 绑定的 caller 得
  `credential_unavailable`（仍 fail-closed，handler 零执行）；有 credential
  无 grant 得 `access_denied`。两码均须 declared（R5），否则 child 侧
  fail-closed 收敛会失真。
- **V1 GRANTEE_SET = { agt_workflow-dispatcher-hr-agent }**（本 Spec、
  HR_DISPATCHER G4、auth-service 身份 Spec 三处一致冻结）。新增
  Dispatcher identity = 本 Spec AMEND（显式授权清单扩张）+ auth-service
  grant 轮次；**禁止任何静默扩张**。
- **broker 代码不硬编码 identity allowlist**：单一授权权威 = grants。
  broker 侧复制一份 allowlist = 双头权威，漂移风险（ALT-007 REJECTED）。
- **caller 身份纪律**：caller identity 只出自 broker trusted credential
  seam（gateway execute ctx 的 Router-decided agentId）；child 自报的
  agentId/principalId/clientId/scope/audience/authorization 一律
  logged-and-ignored（agent-router 既有行为）。
- **target 永远不是身份/权限来源**：`targetAgentId` 是且仅是 deliver 的
  路由目标参数——不进 caller identity、不进 token subject、不参与任何
  授权判定（同姊妹 Spec CTR-003 族）。唤醒不使 target 获得任何权限，
  也不使 caller 获得 target 的任何权限（无 agent impersonation 面）。
- **target 解析**：由 `agentRouter.deliver` 内部完成（resolveAgentRef +
  ensureRunning/assertRunnable）——capability 层零解析逻辑，纯转发。失败
  形态按 §2.1「deliver 失败形态」行与 R5 翻译层事实呈现：未定义**与**
  disabled 的路由拒绝同为 `AGENT_NOT_FOUND`（→ `agent_not_found`）；
  `AGENT_DISABLED` 仅 mid-call 重载竞态窗口可达（→ `agent_disabled`）；
  拉起/投递失败为无 code 的 plain Error（→ `internal_error`，detail
  透传）。

### R4 — requestId 派生、dedupe key 与重复 wake 行为（冻结）

```text
REQUEST_ID_PREFIX_V1 = 'wdhr1:'      # 延续 HR_DISPATCHER §3.4/§4.1 冻结的
                                     # requestId 前缀族（其 regex 中段为
                                     # UUID 形态，本 Spec 将 charset 泛化）
requestId = 'wdhr1:' + workflowInstanceId + ':' + targetAgentId
dedupe key = (workflowInstanceId, targetAgentId)   # 恰二元组
```

- **派生发生在受信区（handler 内）**：caller 不可见、不可注入、不可变体。
  同一 (workflowInstanceId, targetAgentId) 恒 produce 同一 requestId。
- **reason 恒不入键**：以不同 reason 重复 wake 同一 (instance, agent)
  不得产生第二个唤醒 session（ALT-002 REJECTED 的判据）。
- **重复 wake 行为（全部继承 Router 既有实现，capability 层零新增）**：
  同键重复调用 → deliver 的 fresh durable read-or-mint 命中同一
  `fresh-<sha256(agentId\0requestId)...>` → **同一 sessionId** 返回
  `{accepted: true, sessionId(同一)}`；消息按 Router 既有行为追加进同一
  fresh session（per-(instance, agent) 连续线程语义——本 Spec 显式接受，
  同 HR_DISPATCHER §4.2 判例）；不产生第二个 session、不产生第二次
  admission、不新建进程。
- **失败后的重试**：deliver 拒绝（如 agent_disabled）时尚无 session 被
  mint；后续同键调用 = 对 Router 的新调用，语义由 Router 决定。
  capability 层不缓存失败、不短路、不补偿。
- **capability 层禁止自建 dedupe store / 第二 admission 语义**
  （ALT-003 REJECTED；零新机制裁定）。

### R5 — 返回、错误表与翻译层（r2 按发射点事实重写，冻结）

```text
result: { accepted: true, sessionId: <native session id>,
          requestId: <服务端派生值回显，caller round 报告对账用> }

declared errors（fail-closed；每码标注唯一事实发射点；未声明码经
child 侧 mapping.js 既有 fail-closed 收敛，不降级不吞错）:
  invalid_arguments        # 两段校验（r3）：child-side
                           # validateArgumentsDetailed 基础层（required/
                           # type/number/enum）+ trusted handler 完整 R2 层
                           # （pattern / charset / 字符串长度 / 控制字符 /
                           # 未声明 key 拒绝——R2 full validation location
                           # = TRUSTED_HANDLER，§4）；relay 传输通道死亡
                           # （relay.js:76）；控制面无 brokerGateway
                           # （agent-router index.js:595）
  unsupported_operation    # operation ≠ 'wake'；gateway 未服务该
                           # capability/operation——含 agentWakeAccess 缺席/
                           # 未注入（gateway.js:133/138-139/142-145）
  credential_unavailable   # caller 无 MachineClient credential 绑定/store 损坏
                           # （gateway.js:147-159；先于 scope 门禁）
  access_denied            # 有 credential、无 agent.wake scope grant——
                           # 普通 Agent 的必然路径（gateway.js:163-186）
  agent_not_found          # deliver 抛 err.code==='AGENT_NOT_FOUND'（unknown
                           # 或 disabled 的路由拒绝——二者同码，
                           # definition.js:376-386）
  agent_disabled           # deliver 抛 err.code==='AGENT_DISABLED'
                           # （assertRunnable；deliver 路径仅 mid-call 配置
                           # 重载竞态窗口可达，agent-router index.js:499-503）
  internal_error           # 其余一切 deliver 抛错（spawn / freshSessionFor
                           # store / proc.deliver inbox——无 code 的 plain
                           # Error）经 handler 翻译层收敛；handler 自身 throw
                           # 亦被 gateway 收敛 internal_error
                           # （gateway.js:190-193）
```

**r2 移除的 r1 码及理由**：`unauthenticated` / `forbidden`（local relay
管线无任何发射点——意外码由 declared-table fail-closed 收敛兜底）；
`agent_start_failed`（**无事实载体**：spawn 失败是无 code 的 plain Error，
按 message 前缀嗅探分类违反 fail-closed 纪律，ALT-010 REJECTED——统一
`internal_error`，detail 透传 router 原始消息）。HR_DISPATCHER §4.1 错误表
的同步对齐并入其 r4 AMEND（§2.3）。

**翻译层（冻结，handler 内，blocker #3 的闭合机制）**：

```text
try {
  const r = await router.deliver({ requestId, agentId: targetAgentId,
                                   sessionMode: 'fresh', message })
  return { ok: true, result: { ...r, requestId } }
} catch (err) {
  if (err?.code === 'AGENT_NOT_FOUND') return { ok: false,
    error: { code: 'agent_not_found', detail: <sanitized> } }
  if (err?.code === 'AGENT_DISABLED')  return { ok: false,
    error: { code: 'agent_disabled',  detail: <sanitized> } }
  return { ok: false,
    error: { code: 'internal_error', detail: <sanitized 原 message 透传> } }
}
```

- coded 错误必须以 **return envelope** 翻译——**throw 会被 gateway 统一
  收敛 `internal_error` 丢码**（gateway.js:190-193）。
- 分类只认 `err.code`，**禁止 message 前缀嗅探**；未识别一律
  `internal_error` fail-closed。
- deliver 入参由 R4/R2a 派生恒良构，其 TypeError 族（requestId/
  sessionMode/message/agentId/sessionId 校验）结构性不可达，不设翻译分支。
- detail 为 sanitized 文本（透传 router 错误 message，绝无 secret）。

### R6 — Audit（两层，五要素，冻结）

每次**到达 handler** 的调用（成功与失败都记）必须落一条 **L1 capability
语义 audit**，沿 production-runtime 既有 `writeEvidence` JSONL seam（失败
log 可见、不阻塞、不回滚——evidence 纪律同 D-007 §11.5 族）：

**记录边界（r2 事实冻结）**：credential / scope 门禁的拒绝发生在 handler
**之前**（gateway.js:147-186），L1 结构性不可见——`credential_unavailable`
/ `access_denied` / `unsupported_operation` 三类拒绝的可见性 = gateway 既有
stderr log（`[broker-gateway] agent ...: agent_wake grant denied ...` 等），
不产生 JSONL audit 行。这是全部既有 capability 的共同行为（非本能力特例）；
把门禁期拒绝升格为 JSONL audit 需改 gateway.js——与「gateway.js 零改动」
裁定冲突，留作未来独立 AMEND 议题，不在 V1。

```json
{ "kind": "agent_wake", "ts": "...",
  "callerAgentId": "agt_workflow-dispatcher-hr-agent",
  "callerProvenance": "broker-credential",
  "targetAgentId": "agt_...",
  "workflowInstanceId": "...",
  "requestId": "wdhr1:...:agt_...",
  "result": { "accepted": true, "sessionId": "..." }
}
```

（失败调用：`"result": { "accepted": false, "errorCode": "..." }`。）

- **五要素覆盖核对**：caller ✔（callerAgentId，出自 trusted ctx，永不出自
  参数）target ✔ workflow instance ✔ request id ✔ result ✔。
- **零 secret**：audit 行不含 clientId/secret/token；args 与 message 均为
  非密内容（R2 reason 冻结为非密事由文本）。任务的「secret 传递禁止」
  由参数面（无 credential 字段）+ 本 audit 形态 + handler 不读
  credential store 内容三者共同满足（scope 门禁取 token 仅鉴权用，
  不出受信区）。
- **L2 机制 evidence（既有，零改动继承）**：compose.js 的
  `router.deliver` wrap（kind 'deliver'：requestId/agentId/sessionMode/
  sessionId）与 agent-router 进程内 `deliveriesSnapshot` 原样保留——
  L1 记语义（谁为何唤醒谁），L2 记机制（deliver 接受了什么），互不替代。
  **不断链的机制保证（r2 冻结）**：compose 对 `router.deliver` 的 wrap 是
  applyBroker **之后**的方法级替换（compose.js:298-312），故 L1 handler
  必须**调用时属性访问** `router.deliver(...)`（闭包持 router 对象、绝不
  提前解构捕获原函数）——晚绑定保证 L1 的每次 deliver 都穿过 L2 wrap，
  两层 evidence 同时落账。
- **audit append 失败 = failed-visible**：log error、调用结果不变、
  不虚假成功——非法「绕过 audit」路径不存在（append 在 handler 内）。

### R7 — 执行机制红线（FORBIDDEN；违反 = out-of-spec，审计可见）

```text
R-W1  handler 调用且仅调用 agentRouter.deliver({requestId, agentId:
      targetAgentId, sessionMode:'fresh', message})——禁止 handler 直接
      spawn/ensureRunning 目标进程、直接写 target 的 session inbox，
      或触达任何第二派发路径（进程拉起是 Router 在 deliver 内部的
      既有职责，不是 capability 面的）。
R-W2  禁止 OpenClaw cron / ~/.openclaw 任何读写（任务级永久禁令，
      同 HR_DISPATCHER R-A5）。
R-W3  禁止自建 session / 第二 admission / 幂等逻辑（零新机制；全部
      语义归 AGENT_ROUTER_DELIVERY_V0）。
R-W4  禁止修改任何 workspace（capability 无文件写面；target agent 在
      自己 workspace 工作，同 HR_DISPATCHER R-A3 判）。
R-W5  禁止 scheduler 任意 job 创建：本能力无任何 scheduler 面；旧
      trigger_agent one-shot job 模式维持退役（HR_DISPATCHER ALT-002
      同判）。dispatcher 不得以自身为 target（自唤醒回环 = out-of-spec，
      L1 audit 可见）；target 必须经 roster 精确映射派生
      （HR_DISPATCHER §3.5，dispatcher prompt 侧纪律——本 Spec 在
      capability 侧以 exact-id + Router 解析兜底）。
R-W6  禁止 agent impersonation 与 secret 传递（R3/R6 已冻结机制；
      参数面物理无该字段）。
```

### R8 — 模型使用合同（dispatcher turn 视角）

dispatcher（且只有 dispatcher）在自己的 occurrence turn 内：对每个
(instance, mapped agent) 至多调一次 `agent_wake`；`reason` 应命名 instance
title 与 current node；round 报告以返回的 requestId/sessionId 对账 wakes。
普通 Agent 的工具清单中该 tool 存在与否不影响其被 `access_denied` 拒绝
（门禁在 grant，不在清单）。

## 4. 实现闭包（r2 重写——三个 audit blocker 的闭合；G1 accept 后的评审路径；本轮零实现）

```text
NEW   packages/broker/src/capabilities/agent-wake.js
        — agentWakeManifest（纯数据：R1 面 + R2 参数 + R5 错误表，
          withTransportErrors 同族包装）

MOD   packages/broker/src/relay.js                      ← blocker #1
        — relay gate 修复，一处：为 local manifest 的 operations 同样构建
          relay handler（`if (!op.http && manifest?.local === undefined)
          continue`）。handler 体零改动——本就 transport 无关
          （{capabilityId, operation, args} 转发 + 两层信封解包，
          relay.js:65-94）。依据 = broker index.js child 模式既有注释声明
          的设计意图（「LOCAL capabilities also RELAY to the trusted
          parent」）；既有 http relay 行为字节不变；calculator 等
          process-internal capability 不经 createRelayHandlers，不受影响

MOD   packages/broker/src/index.js                      ← blocker #2 + 计数
        — (a) import + DEFAULT_MANIFESTS 追加 1 枚（计数基线以实现时
          main 实测为准，dual-path 纪律；既有 manifest 字节不变）
        — (b) gateway localHandlerResolver 泛化：execute-time merge
          `{ ...ctx.get('agentDefinitionAccess')?.handlers,
          ...ctx.get('agentWakeAccess')?.handlers }`——键为 capabilityId，
          构造上不相交（capability id 唯一）；任一服务缺席不影响另一路
          （`?? {}` 既有纪律）；合并结果缺席该 capability 时仍由
          gateway.js:138-139 fail-closed unsupported_operation

MOD   packages/broker/src/gateway.js
        — 零改动（明确列出以正视听）：localHandlers/localHandlerResolver
          契约、execute-time 解析、credential→scope→handler 门禁序、
          throw→internal_error 收敛均已存在，blocker #2 的修复全部落在
          resolver 的提供侧（index.js + compose）

MOD   packages/production-runtime/src/compose.js        ← blocker #2 + 注入
        — composition root `ctx.provide('agentWakeAccess', { handlers:
          { agent_wake: { wake: handler } } })`，挂在与 applyBroker
          gateway 调用（compose.js:251 附近）同层；resolver 为
          execute-time 解析，provide 与 broker apply 的相对次序不构成
          竞态（gateway.js 注释冻结的 loader 竞态纪律）
        — handler 冻结形态（r3：R2 full validation location =
          TRUSTED_HANDLER）——**第一个动作 = handler 内完整 R2 参数验证**，
          必须先于以下全部四者：requestId 派生、message 派生、
          agentRouter.deliver、L1 success audit：
            targetAgentId      精确 pattern ^agt_[a-z0-9-]+$；长度上限；
                               禁控制字符；禁路径/分隔符逃逸（'/'、
                               '..'、空字节等——pattern 本身排除，验证
                               显式断言）
            workflowInstanceId 精确 charset ^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$；
                               长度上限；禁 ':'；禁控制字符
            reason             minLength = 1；maxLength = 240；
                               禁控制字符
            整个 args object   未声明 extra key 一律拒绝
          任一失败 → return { ok:false, error:{code:'invalid_arguments'} }，
          且 fake router call count = 0（验证先于派生与转发，二者均未
          发生；失败不产生 L1 success audit 行）。
          验证通过后 → R2a/R4 派生（message 模板、requestId 公式）→
          R5 翻译层（coded return envelope / 未识别 internal_error /
          无 message 嗅探）→ **调用时属性访问** `router.deliver(...)`
          （R6 晚绑定，穿 L2 wrap）→ R6 L1 audit append（writeEvidence
          同 seam，成败皆记，append 失败 failed-visible）

MOD   packages/broker/test/relay.test.js                ← blocker #1 的证明
        — 首个 local relay 覆盖：local manifest 的 non-http operation
          获得 relay handler；两层信封解包；transport 死亡 →
          invalid_arguments（detail 带 'broker relay failed'）；http
          relay 既有 fixture 字节不变
MOD   packages/broker/test/capabilities.test.js
        — manifest 计数 + args/pattern/R5 错误表 fixture
MOD   packages/broker/test/gateway.test.js              ← blocker #2 的证明
        — resolver merge 注入：提供 agentWakeAccess 形 handler map 后
          local 调用可达 handler；仅 agentDefinitionAccess 在场时
          agent_wake → unsupported_operation；credential→scope 门禁序
          （credential_unavailable 先于 access_denied）；handler throw →
          internal_error 收敛
MOD   packages/production-runtime/test/compose.test.js
        — fake router 端到端（child relay → gateway → agentWakeAccess
          handler）：R2 完整验证（ACC-002 全部非法输入 → invalid_arguments
          且 fake router deliver 调用计数 = 0）/ 派生断言（恰收
          deliver({requestId, agentId, sessionMode:'fresh', message})）/
          同键双调同 sessionId（fake router 恰一次 mint）/ R5 翻译
          （AGENT_NOT_FOUND→agent_not_found；plain Error→internal_error
          且 detail 透传）/ audit 五要素 / audit append 注入失败
          failed-visible / L2 wrap 与 L1 同调用共存（deliver 计数=1）
```

**零改动**：agent-router、scheduler、svc-workflow、feishu-connector、
notification-ingress、auth-service、**broker gateway.js**。grant 供给 =
G4 外部轮次；部署 = G3 独立轮次；生产 canary = G5 独立授权轮次。实现
PR 不得修改本文件（GOVERNING_SPEC_UNMODIFIED）。

## 5. CANARY_PLAN（C1 生产 canary，独立授权轮次；前置 G3+G4）

```text
C1-A 正常唤醒：dispatcher 身份对 1 个真实 (workflowInstanceId, roster-mapped
      target) 调 agent_wake → accepted + sessionId + requestId 回显；
      L1 audit 行存在且五要素齐；L2 kind:'deliver' evidence 行存在；
      两层 requestId 一致。
C1-B 幂等收敛：同 (workflowInstanceId, targetAgentId) 立即重复调用
      （reason 故意不同）→ 同一 sessionId、无第二个 fresh session mint、
      无新进程；两次调用各有一条 L1 audit（result.sessionId 相同）。
C1-C 越权拒绝：任一普通 fleet Agent（无 grant）调 agent_wake →
      access_denied，handler 零执行（L1 结构性不产生——记录边界见 R6；
      可见性 = gateway stderr log 的 grant-denied 行）；有 credential 判据
      与无 credential 判据（→ credential_unavailable）各验一次。
C1-D 失败面：未定义 targetAgentId → agent_not_found fail-visible；disabled
      target 同样 → agent_not_found（路由拒绝同码，R5 事实——这是对
      「disabled ≠ 独立码」的生产行为验证点）；detail 透传且无 secret。
C1-E 零外泄扫描：canary 全程 evidence log 与 audit 行无 secret/token/
      clientId 字段；message 为模板 ∘ 输入字节。
聚合断言：canary 全程恰 N 次真实 deliver（N = 成功唤醒次数）；零
      scheduler job 创建；零 ~/.openclaw 触及；零 workspace 写（target
      session 自身产物除外，属 Router 既有语义）；重复调用零第二 mint。
```

C1 不经普通 Agent 面发起（无 grant 者仅出现于 C1-C 的拒绝路径）；
C1 通过不是 dispatcher 正式 enable 的充分条件（后者归 HR_DISPATCHER
G0–G7 链，且以 G6 同步 AMEND merged 为前置）。

## 6. 验收条件（fixture 级，G1/G2 评审用）

```text
ACC-001  agentWakeManifest 过 validateManifest（local/http 互斥、错误表
         约束）；DEFAULT_MANIFESTS 计数 = 实现时 main 基线 +1；既有
         manifest 字节不变
ACC-002  R2 完整验证（r3；fake router 断言 deliver 调用计数 = 0）：
         以下输入均 return invalid_arguments 且 fake router deliver
         call count = 0——(a) targetAgentId pattern 错（非 ^agt_ 前缀 /
         大写 / 非法字符）；(b) workflowInstanceId 含 ':'；(c) reason
         空字符串；(d) reason 超 240 字符；(e) reason 含控制字符（如
         \u0000 / \u001f / \n）；(f) 任意 unknown key（如注入
         {sessionMode:'main'} 尝试）；另断言 charset 违例与缺必填
         （child 基础层与 handler 完整层双保险，两段各自可单独触发）
ACC-003  派生冻结：fake router 恰收
         deliver({requestId:'wdhr1:<wi>:<agt>', agentId:targetAgentId,
         sessionMode:'fresh', message:'Workflow dispatch wake: instance
         <wi> — <reason>'})；无 sessionMode/requestId/message 透出参数
ACC-004  幂等：同 (workflowInstanceId, targetAgentId) 双调用（reason 不同）
         → 两次 deliver 收到同一 requestId；返回同一 sessionId；
         fake router 恰一次 fresh mint
ACC-005  门禁序：无 credential 绑定 → credential_unavailable；有
         credential 无 agent.wake grant → access_denied；两者 handler 均
         零执行；caller 身份出自 ctx.agentId，参数面无 identity 字段
ACC-006  audit：到达 handler 的成功与失败调用各恰一条 L1 audit（五要素
         + provenance = broker-credential）；门禁期拒绝零 L1 行（R6 记录
         边界）；audit append 注入失败 → failed-visible log，调用结果
         不变，不回滚
ACC-007  翻译层（r2）：fake router 抛 {code:'AGENT_NOT_FOUND'} →
         agent_not_found；{code:'AGENT_DISABLED'} → agent_disabled；
         无 code 的 plain Error → internal_error 且 detail 透传原
         message；翻译以 return envelope 表达（fake 断言非 throw 路径
         ——gateway throw 收敛 fixture 另证 internal_error）；零 message
         前缀嗅探（fake 构造 message 含 'AGENT_NOT_FOUND' 字样但无
         code 的 plain Error → internal_error）
ACC-008  result 信封：{accepted:true, sessionId, requestId}，requestId
         为服务端派生值回显；错误走 {ok:false, error:{code}} 不 reshape
ACC-009  红线静态断言：handler 无 spawn/ensureRunning 直调、无 fs 写、
         无 scheduler/openclaw 引用、无 credential store 内容读取
ACC-010  relay local 支持（blocker #1 证明）：local manifest 的
         non-http operation 在 child 侧获得 relay handler
         （createRelayHandlers fixture）；两层信封解包正确；既有 http
         relay fixture 字节不变
ACC-011  resolver merge 注入（blocker #2 证明）：提供 agentWakeAccess
         形 handler map 后 local 调用可达 handler；仅
         agentDefinitionAccess 在场时 agent_wake →
         unsupported_operation 且 agent.definition.* 路径不受影响
ACC-012  生产 canary C1（A–E + 聚合断言）通过——G5 独立轮次，不属实现
         轮验收
```

## 7. Alternatives and disposition

```text
ALT-001  caller-supplied requestId + message（HR_DISPATCHER §4.1 原形态）
         — REFINED AWAY（提取进本 Spec 时收紧，非全盘否定）：幂等键升级为
         受信区结构性派生，caller 物理上无法铸造新键、无自由 message
         注入面；派生公式延续其 wdhr1: 前缀族。HR_DISPATCHER r4 同步
         AMEND（§2.3）。
ALT-002  reason 计入 dedupe key
         — REJECTED：变 reason 即新 session，破坏收敛；幂等键必须恰为
         (workflowInstanceId, targetAgentId)。
ALT-003  capability 层自建 dedupe / admission / audit store
         — REJECTED：第二套派发语义，违反「零新机制」；一切收敛语义归
         Router read-or-mint。
ALT-004  透出 sessionMode 参数（允许 'main'）
         — REJECTED：main session 会被后台调度污染（D-006 纪律；
         HR_DISPATCHER ALT-006 同判）。
ALT-005  经 notification-ingress POST /v1/deliver HTTP 面暴露为 Agent 工具
         — REJECTED：HTTP ingress 无 broker scope 门禁面；引入第二控制面
         无实证收益（HR_DISPATCHER ALT-005 同判）。
ALT-006  OpenClaw cron / 动态 one-shot job 唤醒（旧 unified-dispatcher 模式）
         — REJECTED：任务明令禁止 + OpenClaw 退役中（R-W2/R-W5）。
ALT-007  broker 代码内硬编码 caller identity allowlist
         — REJECTED：与 auth-service grants 形成双头授权权威，漂移必致
         越权或误拒；单一权威 = grant 面（R3）。
ALT-008  handler 直接 spawn 目标进程 / 自建 session / 写 target workspace
         — REJECTED：任务明令禁止；绕过 Router admission 与审计（R-W1/
         R-W3/R-W4）。
ALT-009  workflowInstanceId 强制 UUID 36 字符格式
         — DEFERRED：V1 冻结保守 charset（禁 ':'、禁路径语义）；实现轮
         对照已 merge 的 workflow manifests 确认 svc-workflow 实际 id
         grammar 后再决定是否收紧（dual-path）。
ALT-010  以 message 前缀嗅探分类 spawn 失败为 agent_start_failed
         — REJECTED（r2）：router spawn/store/inbox 失败为无 code 的
         plain Error，嗅探字符串违反 fail-closed 纪律且脆于文案变更；
         统一 internal_error（detail 透传），翻译层只认 err.code。
ALT-011  compose 零 broker 改动注入（r1 闭包的原始主张）
         — REJECTED AS INFEASIBLE（r2 事实，blocker #2）：index.js:182
         的 resolver 硬绑唯一 agentDefinitionAccess 服务，静态
         localHandlers 参数不经 applyBroker 暴露——零 broker 改动的
         注入路径不存在；正确路径 = resolver 泛化（MOD index.js）+
         compose provide agentWakeAccess（§4）。
```

## 8. 与既有权威的一致性核对（non-contradiction）

```text
AGENT_ROUTER_DELIVERY_V0   纯转发：deliver 签名/sessionMode/幂等原样调用，
                           capability 层零 admission/session 语义 ✔（R-W3）；
                           失败翻译层只对既有异常**编码**（err.code →
                           declared 码），不新增/不改写 router 语义 ✔（R5）
D-006（session 模型）      fresh non-main per wake；main 结构性不可达 ✔
HR_DISPATCHER r3           能力合同提取 + §2.3 同步 AMEND 义务显式化；
                           dispatcher 零 scheduler 写（R-A8）不受影响；
                           其 §3.4 prompt 修订归其 r4，本轮零修改 ✔
auth-service 身份 Spec     exact grant 面（workflow.read + agent.wake）
                           是 caller 限制的唯一执行机制，本 Spec 不复制
                           不放宽 ✔（R3）
broker 架构纪律            manifest 纯数据；handler 注入经既有
                           localHandlerResolver 契约（resolver 泛化只是
                           增加一个 sibling 服务源，execute-time 解析与
                           fail-closed 纪律不变）；relay gate 修复实现的
                           正是 broker index.js 注释已声明的设计意图
                           （child 模式 local relay），非新语义；参数永
                           不含 principal；错误 fail-closed
                           declared-codes-only ✔
scheduler（D-007）         零接触：无 store 读写、无 job 面、无 scope ✔
svc-workflow               零改动；唤醒不触发任何 Workflow 写（目标 agent
                           的 workflow_execute 是其自身授权面内行为）✔
```

## 9. 本轮边界（不做清单）

```text
PRODUCT_CODE_CHANGE      = NONE（零 packages/ 文件改动；仅本 Spec 文件
                           r1 → r2 → r3 就地修订）
SPEC_REVISION_ROUND      = r3（第二轮审计 REVISE 唯一 blocker B4 关闭；
                           取证 = 只读 packages/ 源码；r1/r2 语义裁定与
                           B1–B3 关闭状态零回退）
HR_DISPATCHER_MODIFIED   = NO（r4 同步 AMEND = 其自身评审轮，G6；本轮
                           只记录义务，不修改该文件）
SPEC_PR                  = OPENED（docs-only 单文件 Draft PR，自干净
                           worktree（base = origin/main）交付，不含任何
                           混合 WIP 产品代码；URL 见 Final Output）
GRANT / SCOPE_CHANGE     = NONE（agent.wake 授予归 auth-service G4 轮次）
DEPLOY / RESTART         = NONE
PRODUCTION_CHANGE        = NONE（零生产访问）
SCHEDULER / OPENCLAW     = 零接触
干净 worktree 内单文件提交；git diff --check = PASS
```

## 10. Final Output

```text
TASK_NAME = 唤醒 规格
TASK_TYPE = SPEC_AUTHORING_ONLY
SPEC_ID = AGENT_CORE_AGENT_WAKE_CAPABILITY_V1
SPEC_STATUS = proposed（r3 — 四审计 blocker 全关：B1 relay local 支持 /
  B2 localHandlerResolver 注入路径 / B3 Router 错误码映射事实 /
  B4 R2 完整参数验证位置 = TRUSTED_HANDLER）
DELIVERABLE = docs/specs/AGENT_CORE_AGENT_WAKE_CAPABILITY_V1.md（单文件，
  r1 → r2 → r3 就地修订；r3 经干净 worktree 单文件 Draft PR 交付）
DELIVERED_SECTIONS = PROPOSED_SPEC（§0–§3,§7,§8）+ IMPLEMENTATION_CLOSURE
  （§4，r2 重写 + r3 B4 完整验证段）+ CANARY_PLAN（§5）+
  ACCEPTANCE_CRITERIA（§6，ACC-002 r3 重写 / ACC-010/011 r2 新增）

CAPABILITY = agent_wake（broker local，id = toolName，operation wake）
MODEL_FACING_ARGS = targetAgentId / workflowInstanceId / reason（恰三个）
R2_FULL_VALIDATION_LOCATION = TRUSTED_HANDLER（child-side
  validateArgumentsDetailed 仅 required/type/number/enum 基础层；
  pattern/charset/字符串长度/控制字符/未声明 key 拒绝的完整 R2 验证在
  handler 内、先于 requestId/message 派生与 agentRouter.deliver 及 L1
  success audit；失败 → return invalid_arguments 且 deliver 零调用）
REQUEST_ID_DERIVATION = 'wdhr1:' + workflowInstanceId + ':' + targetAgentId
DEDUPE_KEY = (workflowInstanceId, targetAgentId)——reason 恒不入键
MESSAGE_TEMPLATE = "Workflow dispatch wake: instance <wi> — <reason>"
SESSION_MODE = fresh（结构性不透出）
EXECUTION_MECHANISM = agentRouter.deliver 纯转发（零新 admission/session
  /幂等语义）
CALLER_V1 = 恰 agt_workflow-dispatcher-hr-agent（agent.wake exact-identity
  grant；扩展 = AMEND；普通 Agent access_denied）
TARGET_SEMANTICS = 仅路由目标；非授权/权限/caller identity 来源
AUDIT = L1 五要素（caller/target/instance/requestId/result，到达 handler
  的成败皆记、failed-visible；门禁期拒绝零 L1 行——记录边界见 R6）
  + L2 router deliver evidence（既有继承；L1 handler 调用时属性访问
  router.deliver 保证穿 L2 wrap）
ERROR_TABLE = invalid_arguments / unsupported_operation /
  credential_unavailable / access_denied / agent_not_found /
  agent_disabled / internal_error（每码唯一事实发射点，R5；r1 的
  unauthenticated / forbidden / agent_start_failed 移除——无发射载体）
ERROR_TRANSLATION = handler 内 try/catch，只认 err.code（AGENT_NOT_FOUND
  → agent_not_found；AGENT_DISABLED → agent_disabled；其余一律
  internal_error + detail 透传）；return envelope 表达，禁 message 嗅探
RELAY_LOCAL_FIX = MOD relay.js 一处 gate（non-http op of local manifest
  获得 relay handler）——实现 broker index.js 已声明的 child 模式 local
  relay 意图；http relay 行为字节不变
RESOLVER_INJECTION = MOD broker index.js（resolver execute-time merge
  agentDefinitionAccess + agentWakeAccess）+ compose ctx.provide
  ('agentWakeAccess')；gateway.js 零改动
FORBIDDEN = OpenClaw cron / 自建 session / 直接 spawn / workspace 写 /
  scheduler job 创建 / agent impersonation / secret 传递（R-W1..R-W6）
HR_DISPATCHER_SYNC = r4 AMEND required before dispatcher activation（G6；
  本轮零修改）
PRODUCTION_CHANGE = NONE
PRODUCT_CODE_CHANGE = NONE
FILES_CHANGED = 1（仅本 Spec 文件；PR 分支自干净 origin/main worktree
  建立，零混合 WIP 产品代码）
SPEC_PR = OPENED（branch docs/agent-wake-capability-v1-spec，Draft，
  docs-only 单文件，base = origin/main；URL 见本轮 Final Output）
READY_FOR_INDEPENDENT_REVIEW = YES
NEXT_TASK = 唤醒 审计（对 r3 的 independent re-review）
```
