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

## D-005: Scheduler Replacement V1 — 最小 job 模型、持久化与执行语义

- 状态: accepted（分支 feat/scheduler-replacement-v1 已实现并真实验收，见
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
