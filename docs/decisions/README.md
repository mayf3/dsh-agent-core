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
