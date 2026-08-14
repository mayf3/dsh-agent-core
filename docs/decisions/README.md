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
  十一个端点 + 错误码 + 通用约定见 `AGENT_SESSION_CHANNEL_MODEL_V1.md`；Android
  可直接 mock 的机器可读契约见 `AGENT_SESSION_CHANNEL_MODEL_V1.api.json`。
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
