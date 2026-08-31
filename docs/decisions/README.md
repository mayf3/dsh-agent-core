# Decisions — Agent Core on DSH

决策记录。每条决策格式：

```markdown
## D-<NNN>: <标题>

- 状态: proposed | accepted | superseded-by-D-<NNN>
- 日期: YYYY-MM-DD
- 背景: 为什么需要决策
- 决策: 选择了什么
- 替代方案: 否决了什么
- 影响: 对文档结构 / 代码 / 迁移的影响
```

已登记决策：

## D-008: Agent / Workspace / Session / main 长期产品模型 Current Decision（V3）

- 状态: accepted（2026-09-01；standalone Current Decision；Current Authority；
  supersedes D-006 / V2；全文见
  `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md`）
- 日期: 2026-08-31（`TASK_NAME = 模型 执行`）
- 背景: D-006 把普通 Agent-to-Agent Messaging 与 explicit Delegation 合并成单一
  per-task non-main 模型；Owner Current Model 要求前者进入 target Agent canonical main、
  后者保持 per-task non-main，并继续保持 cron per-execution non-main。
- 决策: V3 完整重述 D-006 的仍有效 Current Truth，只把 A2A 拆成两个明确
  primitive：Messaging → target canonical main（reuse/establish same main；each send = new
  Run/Turn, not Session）；Delegation → one task one target non-main；Cron → one execution one
  target non-main。Session 选择由 interaction primitive 决定；target/executing Agent 保持其
  自己的 Workspace、Principal、credential 与 grants。
- 替代方案: 保持所有 A2A per-task、所有 A2A 都进 main、long-lived pair Session、Scheduler
  `run_once` 代替 Messaging、只 amendment D-006 §11——均拒绝，详见 V3 §30。
- 影响: D-006 已原子标记 superseded-by-D-008；七份 active child authority 全部 PRESERVE。
  本次 acceptance 不接受或实现 proposed `AGENT_CORE_AGENT_SESSION_MESSAGING_V1 r2`，不修改
  child Spec、代码、Grant、Scheduler、Workflow、部署或 production state；后续 `会话 执行`
  仍需形成独立 implementation-authorizing Spec。

## D-007: Scheduler Occurrence / Outcome / Session / Migration Current Decision（V2）

- 状态: accepted（standalone Current Decision；Current Scheduler Authority；全文见
  `docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md`）
- 日期: 2026-08-19（2026-08-20 accepted；supersedes D-005）
- 背景: D-005 的 job-level execution model（timeout=ordinary error、runningAtMs
  去重、stable per-job Session、legacy catch-up）与真实 fleet evidence 冲突：140 个
  enabled job 绝大多数产生非幂等外部副作用（NON_IDEMPOTENT_SIDE_EFFECT=113）、63/140
  已有 timeout/error，而 Router/AgentProcess 无 cancel + proven termination——重复
  admission 会产生重叠外部副作用；D-005 已 accepted，normative meaning 变化必须完整
  supersession，不得同 stable ID amendment。
- 决策: execution identity 从 job-level 移到 occurrence-level——每逻辑 occurrence 持久
  occurrenceId / runId / idempotencyKey，durable reserve before Router，同 occurrence
  at-most-once admission；timeout without proven termination = outcome_unknown（非
  ordinary failed；same-job execution fence 直到 trusted late settlement / operator
  reconcile；无自动 retry / re-admission；late settlement 只解析状态不重放）；ordinary
  failed retry = 新 occurrence；durable states = admitted / running / succeeded /
  failed / outcome_unknown；exact jobs.json 原子持久化、runs.jsonl 10MB evidence、
  cross-process mutation protocol、CLI control-only 全部 PRESERVE；scheduled Session
  = 每 occurrence fresh non-main + same Agent primary Workspace（D-006）；OpenClaw
  migration = definition-only import + strip legacy execution state + NO_CATCH_UP
  （94 missed 不补跑）；restore gate = READY_TO_RESTORE_BEFORE_HARDENING 0。
- 替代方案: amendment D-005——否决（normative meaning 实质变化）；timeout=failed、
  same-occurrence retry、stale marker 清除重跑、unknown 放行下一自然 occurrence、
  stable per-job Session、Session Mapping DB、补跑 94 次 missed——全部否决（见
  `docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V1.md` §10 与 D-007 §1）。
- 影响: D-005 标记 superseded-by-D-007（保留为历史 authority，不删除、不改写历史
  正文）；governing spec = accepted SCHEDULER_TIMEOUT_OUTCOME_V1；Scheduler
  implementation 仍需独立 implementation round；本轮 acceptance = docs only（无代码、
  无 production jobs、无 Scheduler store 修改、无 Kernel change、无 merge）。

## D-006: Agent / Workspace / Session / main 长期产品模型 Current Decision（V2）

- 状态: superseded-by-D-008（此前为 standalone Current Decision；历史正文保留；Current
  Authority 已由 D-008 / V3 接管，全文见
  `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md`）
- 日期: 2026-08-17
- 背景: 旧 authority 之间出现需人工 merge 才能理解的产品模型分叉（D-002「Agent 固定
  拥有唯一 workspace」→ BINDING_WORKSPACE_V1「Binding 决定 effective workspace」→
  FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1「conversation workspace」）；需要一份
  standalone Current Decision 收敛长期产品模型，不再叠 amendment。
- 决策: 一个 Feishu conversation → 一个长期 Agent → 一个 Workspace → 一个 canonical
  main；Agent 拥有独立 agentId（≠ conversationId）；Agent 出生 = 自动创建，trigger =
  FIRST_ELIGIBLE_HUMAN_MESSAGE（transport ingress eligibility 前置：p2p 首条真人消息 /
  首次 @bot / no-mention 群首条 eligible 真人消息 → create；requireMention=true 未 @ →
  drop 不创建）；出生 provisioning 非阻塞 —— AGENT_BIRTH_BLOCKS_ON_CREDENTIAL = NO
  （AGENT_CHAT_READY = agentId + Workspace + AGENTS.md + canonical main/runtime；
  principal/credential/baseline grants 失败不阻塞聊天，受影响 Broker capability
  fail-closed + 后续 retry，MAIN_RESET != CAPABILITY_REPAIR）；Workspace = Agent 长期
  状态（bootstrap 只 seed AGENTS.md，其余 Agent 自管）；Session = 只隔离 trajectory
  （main / cron-run-* / agent-task-* / background-* 同 Agent 同 Workspace 同
  security domain）；main = 可 reset 的 logical slot（reset 只影响 main，不动
  Workspace/Binding）；cron = 每次执行 fresh session；Agent-to-Agent = 每 task 一个
  session（不建永久 pair session）；non-main 不 merge 回 main，跨 Session continuity
  靠 Workspace + MEMORY.md + 显式 task result；Feishu = FIXED（不切 Agent），Mobile =
  SWITCHABLE（activeAgent only，不创建 Agent）；switch_agent 只限 switchable Product
  Surface（Mobile main ALLOWED，Feishu/cron/agent-task NOT_ALLOWED）；security domain
  = Agent（principal/credential/grants 属 Agent）。
- 替代方案: 继续在旧 Spec 上叠 amendment——否决（Current Truth 更难找）；per-conversation
  workspace 作为长期产品模型——否决（机制能力 ≠ 产品模型，ONE_AGENT_ONE_WORKSPACE 冻结）。
- 影响: 文档 disposition：D-002 PARTIALLY_SUPERSEDE / D-004 PARTIALLY_SUPERSEDE
  （机制保留：Binding owner / 持久化 / single-flight / switch≠角色扮演 / 薄 adapter；
  产品语义被取代：Feishu 通用 switch / 全可 switch / first-contact→default Agent /
  targetSessionId 人类入口状态）/ D-003 PARTIALLY_SUPERSEDE（产品 invariant 保留：
  Memory 属 Agent Workspace / file-first / MEMORY.md / per-Agent 隔离；consolidation
  时机等具体策略 = RETAIN_AS_IMPLEMENTED_STRATEGY，非产品 authority）/
  AGENT_CORE_BINDING_WORKSPACE_V1 PARTIALLY_SUPERSEDE（机制保留，产品模型条款被取代）/
  FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1 @ 6071dfd DO_NOT_ACCEPT（→ REPLACE_WITH_SMALLER_SPEC）。
  OWNER_RULING_SYNC = PASS（R2 FIX_REQUIRED 四项已修：creation trigger / birth
  readiness / D-004 / MEMORY_V1）。PRODUCT_CODE_CHANGE = NONE / RUNTIME_CHANGE = NONE /
  MIGRATION = NONE / KERNEL_CHANGE = NONE。

## D-004: Router / Binding 域操作与持久化（Product Integration V1）

- 状态: accepted（分支 feat/product-integration-v1 已实现并真实验收，见
  `docs/reports/product-integration-v1.md`；全文见
  `docs/decisions/BINDING_AND_SWITCH_V1.md`）
- 日期: 2026-08-15
- 背景: Integration V1 的 Binding 是 Router 进程内 Map，重启即丢；没有统一切换
  原语；Feishu 与未来 Mobile/Web 两条入口即将并存，路由规则必须只有一套。
- 决策: Router / Control Plane 是 Binding 的唯一 owner；唯一切换原语
  `Router.switchAgent(bindingContext, targetAgentId, { targetSessionId? })`——
  1) Registry 验证 target Agent 存在，2) Router 选 Session（显式 sessionId，缺省
  main，无 LLM 猜测），3) 更新并持久化 Binding，4) 返回新 Binding。所有入口
  （Feishu connector / 未来 Product API / per-Agent DSH switch 工具）最终都调用
  它；入口协议不进入核心路由规则。持久化 = 原子 JSON 单文档
  （`<home>/.dsh/bindings/bindings.json`，tmp+rename，fail-loud），无数据库 /
  event sourcing。DSH 工具 `agent_core.switch_agent` 是纯 adapter（经 demo-server
  parent-RPC 转发），不拥有持久化 / 查找 / Session 选择 / 入口分支 / 导航历史。
- 替代方案: Binding 留内存（重启丢——否决）；SQLite/Redis（本轮不需要——否决）；
  tool 侧解析 Agent/选 Session（策略必须集中 Router——否决）；Feishu/Mobile 两套
  Router（入口协议进核心规则——否决）。
- 影响: agent-router 新增 BindingStore + switchAgent/getBinding + registry 校验 +
  parent-RPC 钩子；demo-server 新增无状态 parent-RPC passthrough；新增
  `packages/agent-switch/`、`bundle-agent-switch/`、`profile-integration-agent/`；
  bundle-integration 新增 agent-registry 行与 router 配置 env 化；验收
  `scripts/product-integration-v1-verify.mjs`。

## D-005: Scheduler Replacement V1 — 最小 job 模型、持久化与执行语义

- 状态: superseded-by-D-007（Scheduler authority 已由 D-007
  SCHEDULER_OCCURRENCE_OUTCOME_V2 接管，见
  `docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md`；此前 accepted，分支
  feat/scheduler-replacement-v1 已实现并真实验收，见
  `docs/reports/scheduler-replacement-v1.md`）
- 日期: 2026-08-15
- 背景: OpenClaw Gateway 内嵌 cron scheduler 是 141 个 enabled job（90 个
  announce 回飞书群）的唯一执行者，是关闭 OpenClaw 的最大 blocker；需要最小替代
  执行面，不复制 OpenClaw cron 系统。
- 决策: Job 模型 = 现网字段真子集（cron/at/every + announce/none/silent + opaque
  sessionKey + state 机）；持久化 = 单文件原子 JSON + runs.jsonl（无分布式栈）；
  执行语义 = OpenClaw 忠实最小复刻（at 至多一次、cron/every 循环 + backoff、
  停机补跑每 job 至多一次、invoke 前落 runningAtMs 防重复）；调用缝 = 注入式
  `invokeAgent` seam（fake/noop，Router 后续接线）；投递缝 = opaque
  `deliver` seam（无 Feishu SDK，`chat:oc_*` 不解释）；daemon 提交面 =
  `scripts/agentcore-cron.mjs`（openclaw cron add/list/runs 1:1 flag）。
- 替代方案: 完整 cron API clone——否决（现网只用了 3 个 CLI 面）；DSH
  `dsh-schedule`——否决（无 cron/at、无跨会话存储）；分布式队列——否决（无多机
  实证）。
- 影响: 新增 `packages/scheduler/`（零 DSH 依赖）+ 3 个 scripts + 3 篇文档；
  未触碰 agent-router/broker/feishu-connector/bundle/profile；迁移 =
  `openclaw-job-import.mjs --write`（97.9% importable，3 条无 agentId legacy
  job 需人工补）。
- 追加（2026-08-15 第二轮审计，VERDICT: MERGE AFTER SMALL FIX）:
  tick 单飞 + 最新态写回（FIX 1）；CLI 纯控制面、永不执行（FIX 2）；单一
  mutation authority = 跨进程锁内重读最新再应用增量（FIX 3）；persist 失败 RAM
  回滚（FIX 4）；import 已有 store 默认拒绝 + in-flight 只报告（FIX 5）。
  详见 `docs/reports/scheduler-replacement-v1.md` §11。

## D-003: Memory V1 — per-agent file-first 长期记忆（Agent Core memory glue）

- 状态: accepted（分支 feat/agent-memory-v1 已实现并真实验收，见
  `docs/reports/memory-v1.md`）
- 日期: 2026-08-15
- 背景: Session trajectory ≠ Agent long-term memory；调查收敛裁决 3 定「V1 以文件
  记忆为主」，consolidation 是唯一完全缺失层。
- 决策: 记忆 = `<workspace>/MEMORY.md`（curated 唯一事实源）+ `<workspace>/memory/
  YYYY-MM-DD.md`（episodic）；隔离 = 物理目录隔离（per-agent workspace），无全局
  库；新 session 拿记忆 = `systemPrompt.context` 同步重读注入 + `memory_*` 工具；
  consolidation 时机 = turn/end + 防抖 + 显式工具/服务；输入 = session surface 证据
  （直接用户消息 + 助手回复，seq 水位去重，输出逐条校验）；人工查看/编辑/删除 =
  直接编辑 MEMORY.md（file-first，人工优先）；fallback = 原始证据始终落 daily note。
- 替代方案: SQLite+镜像双写（mneme 式）——否决（全局库破坏隔离、双写复杂）；MCP
  记忆服务——保留为可选后端；向量/embedding——DEFER。
- 影响: 新增 `packages/agent-memory/` + `bundle-memory/` + `profile-memory/` +
  `scripts/memory-v1-verify.mjs`；未触碰 agent-router/agent-registry/agent-session。

## D-002: Agent / Session / Channel / Binding 模型与 API 契约（V1）

- 状态: proposed
- 日期: 2026-08-15
- 背景: Router、渠道适配器（feishu-connector 等）与各端 UI 需要一个渠道无关的
  统一「会话归属」契约，避免每个渠道各自发明一套语义。
- 决策: 最小实体集 = Agent / Session / ChannelConversation / Binding。Agent 是长期
  实体（固定拥有 workspace / DSH_HOME / credential / memory，V1 API 不暴露）；
  Session 属于 Agent（main 长期主会话 + normal 可新建/归档/定期清理）；Channel 只是
  UI/传输，不拥有 Agent 与 Session；「切换 Agent」= `switchAgent(ccv, agentId,
  sessionId?)` 只改 Binding，不是角色扮演；未传 sessionId 固定进入目标 Agent 的
  main；「换回来」= 客户端再次 switchAgent，V1 后端不保存切换 history/stack。
  渠道落地入口 = 幂等 `resolveChannelConversation(channel, externalId)`：一步返回
  ChannelConversation + Binding（首次创建时建立默认 Agent + main 的初始 Binding），
  飞书只有 chatId 时即可直接 dispatch。端点清单 + 错误码 + 通用约定见
  `AGENT_SESSION_CHANNEL_MODEL_V1.md`；Android 可直接 mock 的机器可读契约见
  `AGENT_SESSION_CHANNEL_MODEL_V1.api.json`。
- 替代方案: 把 Session 挂在 ChannelConversation 之下（Channel 拥有 Session）——否决：
  与「Agent 是长期实体、跨渠道延续」原则冲突；把「切换」做成角色扮演/复制 Agent——
  否决：产生状态分裂。
- 影响: 入站消息按 Binding.activeAgentId 路由到 per-agent 进程（Router #9）；渠道
  适配器只做 externalId ↔ ChannelConversation 映射 + 调 API；不实现后端。

## D-001: V1 调查收敛 — 能力结论与首个实现里程碑

- 状态: proposed
- 日期: 2026-08-14
- 背景: 五主题并行调查（identity-auth/memory/workspace-files/dashboard/always-on）
  完成，需要收敛冲突结论并确定下一步唯一 milestone（详见 `docs/CAPABILITY_MATRIX.md`
  与 `docs/README.md`）。
- 决策:
  1. 六项 BUILD 为「必须自己做」最小清单：workspace-bootstrap、跨会话 consolidation、
     控制面（= 常驻 daemon）、jobs 持久化 + cron、控制面面板、Broker 侧
     credential→principal 绑定（协作项）；
  2. 四项冲突裁决（见 CAPABILITY_MATRIX §2）：多 agent 常驻 = per-agent 进程（方案 B
     硬约束）；控制面 ≡ daemon 为同一组件；V1 记忆以文件为主、MCP 为可选后端；
     全局 jobs 面板依赖 jobs 持久化；
  3. 下一 milestone = **M1: per-agent workspace-bootstrap**（唯一自包含、纯 DSH 侧、
     不触碰 Auth/Broker 的根依赖项）。
- 替代方案: 以 identity-auth 方案 B（per-agent 进程编排）作为首个 milestone ——
  否决理由：依赖 Broker 侧协作且需部署形态变更，范围过大，不符合「先单进程稳定、
  再动编排」的 V0 既定节奏。
- 影响: M1 只新增一个 Cordis 插件与验收断言；不实现任何其余调查结论，不修改
  DSH/Auth/Broker/旧 Agent Core。
