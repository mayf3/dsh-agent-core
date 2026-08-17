---
status: historical
as_of: 2026-08-15
superseded_by: ../../architecture/overview.md
public: PUBLIC
---

> HISTORICAL ENGINEERING RECORD
>
> This document describes the system as of 2026-08-15.
> It is **not** current architecture documentation.
>
> Current documentation: [docs/architecture/overview.md](../../architecture/overview.md)
# Agent Core Component Map V1

> 状态：冻结草案（docs-only）· 日期：2026-08-15
> 回答：哪些能力直接吃 DSH，哪些薄适配，哪些 Agent Core 必须自己做，哪些现在不做。
> 四状态：**ADOPT** = 直接用 DSH 原生件不包装；**ADAPT** = 复用原生件 + 薄封装/配置；
> **BUILD** = 自建薄层（Agent Core 必须自己做）；**DEFER** = 明确现在不做。
> 依据：`CAPABILITY_MATRIX.md`（收敛结论）、`TRUST-BOUNDARY-REPORT.md`、
> `investigations/*`、`reports/*`、Integration V1 实测。

---

## 1. DSH Runtime 面（直接吃 DSH）

| 能力 | 状态 | 说明 / 证据 |
|---|---|---|
| DSH agent loop（turn/step/inbox） | **ADOPT** | Integration V1 实测：create/followup/whenIdle/resume |
| tools（注册/执行/瀑布） | **ADOPT** | broker V1 已用 `ctx.tools.register` + `defineTool` 实测 |
| fs / shell / subagent | **ADOPT** | 全部 DSH 原生；Agent Core 零封装 |
| agent-instructions（AGENTS.md 自动加载） | **ADOPT** | base bundle 默认开；workspace-bootstrap 播种即被消费 |
| skill-filesystem（SKILL.md 磁盘发现） | **ADOPT** | 与 OpenClaw skills/ 同构，零改写 |
| compaction（会话内压缩） | **ADOPT** | 只做会话内；跨会话是 memory 的事（见 §2） |
| session persistence（JSONL/SQLite + resume） | **ADOPT** | Integration V1 实测 kill 后 resume（150 events） |
| schedule（固定周期） | **ADAPT** | 未入默认 bundle，需 opt-in；只支持 every_seconds ≥300s，无 cron |
| goal（自动续轮） | **ADOPT** | 持久化 + 续轮机制成熟 |
| inbox / followup / steer | **ADOPT** | durable 队列 + 唤醒马达 |
| Cordis 动态插件运行时 | **ADOPT** | tool-cordis / cordis-host-runner 作为插件执行机制 |
| MCP 记忆通道（examples/mcp-memory） | **ADAPT** | 官方定位：记忆走第三方 MCP；作为 Memory 的可选后端 |

## 2. Agent Core 自建面（薄层，必须自己做）

> **Session 专项结论（2026-08-15 实验证据，Session V1 真实 PoC）**：
> Agent Core product sessionId = DSH native sessionId，**不建立 Session mapping layer，
> 不建立独立 `packages/agent-session/`**。DSH SessionId 的作用域是 per-Agent DSH_HOME
> （非全局），因此 Session identity = **(agentId, sessionId)**；`main` 是每个 Agent 的
> 保留 SessionId（Agent A/main 与 Agent B/main 可同时存在），normal 用其他 opaque
> sessionId。DSH 原生负责 session identity / trajectory persistence / create/resume /
> process death recovery。

| 能力 | 状态 | 说明 |
|---|---|---|
| workspace-bootstrap（agentId → workspace/DSH_HOME） | **BUILD（已完成）** | 路径映射唯一 owner；幂等创建 + AGENTS.md 播种 |
| agent-definition（这个 Agent 是谁） | **BUILD（AGENT_DEFINITION_CONFIG_V1 + ACCESS_V1 已完成）** | 声明式 Agent Definition config：存在性/stable id/name/display/default/disabled；运行时无写者；thin mutation seam（agent.definition.read 全员可读 / agent.definition.write 需 Auth grant，经 generic Broker capability，无 HR 硬编码）；不拥有 process/session/memory/workspace/credential |
| **DSH Session Runtime**（session identity / trajectory persistence / create / resume / 崩溃恢复） | **ADOPT** | 全部吃 DSH 原生；sessionId 作用域 = per-Agent DSH_HOME，identity = (agentId, sessionId)，main 为每 Agent 保留 SessionId |
| **Product Session Metadata**（title / kind(main\|normal) / archived / lastActiveAt） | **thin BUILD → DEFER 至 Product API milestone** | 只维护产品元数据，不实现 Session Runtime |
| **Session mapping layer**（product sessionId ↔ DSH sessionId 转换） | **DO NOT BUILD** | 两者直接相等，无映射层；不建独立 `packages/agent-session/` |
| agent-memory（跨 Session 长期经验） | **BUILD（并行开发中）** | consolidate / recall / 隔离；存储通道优先 MCP/文件；**不是第二套 session history** |
| memory consolidation（episodic → curated） | **BUILD（memory 子项）** | 唯一完全缺失层；触发时机 OPEN |
| agent-router / process supervisor（消息找谁 + 进程启动/恢复） | **BUILD（Product Integration V1 已落地，PR #8）** | Binding 路由（`switchAgent` 统一域操作，Router 是 Binding 唯一 owner）+ 原子 JSON 持久化 + per-agent 进程注册表 + respawn/resume；入口协议（Feishu/未来 WebSocket）不进入核心路由规则 |
| process identity / credential（进程凭据） | **BUILD（Phase 3）** | 方案 B：spawn 注入进程凭据 + Broker 侧 credential→principal 绑定；形态 OPEN |
| generic Broker bridge（capability manifest → tool） | **BUILD（broker V1 已落地）** | 统一外部能力入口；Forum/Workflow/OKR 只提供 manifest+handler |
| plugin lifecycle（实验→证据→reviewer→promote→rollback） | **BUILD（Phase 4）** | 治理流程，不重做运行时 |
| proactive runtime（常驻 + 恢复编排） | **BUILD（Phase 5）** | daemon + 冷启动批量恢复；托管方式 OPEN |

## 3. 薄适配 / 组合面（ADAPT）

| 能力 | 状态 | 说明 |
|---|---|---|
| channel adapters（feishu-connector 等） | **ADAPT（feishu 已完成）** | 只做映射 + dispatch；零 Agent/Session 状态 |
| skill 目录约定（per-agent skills/ 前缀） | **ADAPT** | 确认 frontmatter/precedence 映射即可 |
| session-reference（跨会话引用注入） | **ADAPT** | 显式「提及式」召回，短期补 recall |
| tool-session-query（FTS 关键字召回） | **ADAPT** | opt-in 挂载，memory 的召回面之一 |
| cold-start recovery（启动扫描恢复） | **ADAPT→BUILD（Phase 5）** | resumeSessionId 单会话已够；批量恢复编排薄层 |
| jobs persistence | **ADAPT→BUILD（Phase 5）** | 当前纯内存；实现方式 OPEN |

## 4. DEFER（现在明确不做）

| 能力 | 状态 | 说明 |
|---|---|---|
| cron / calendar 语义 | **DEFER（Phase 5 再议）** | DSH schedule 无 cron；需要时自建到期器 |
| semantic / vector memory | **DEFER** | 关键字+文件记忆优先；需要时再引向量 |
| artifact（产物/日志展示） | **DEFER（Phase 7）** | 数据面现成（session 日志），UI 形态未定 |
| dashboard（控制面面板） | **DEFER（Phase 7）** | 官方 UI 已有 session/trajectory/plugins；缺运行态聚合 |
| multi-machine / HA | **DEFER** | 单机优先；不提前做多机/扩缩容 |
| 多渠道（WeChat/Mobile/Web 适配器） | **DEFER（Phase 6）** | 契约已渠道无关，接新渠道=新 adapter |
| Product API（HTTP /v1） | **DEFER（Phase 6）** | 契约已冻结（D-002 api.json），实现排期 |

## 5. 外部系统（不归 Agent Core）

| 能力 | 状态 | 说明 |
|---|---|---|
| Forum | 外部 | 经 Broker bridge 访问；不写 agent-core-forum-plugin |
| Workflow | 外部 | 经 Broker bridge 访问；不写 agent-core-workflow-plugin |
| OKR | 外部 | 经 Broker bridge 访问；不写专用 adapter |

## 6. 明确禁止出现的组件名

以下名字**不应出现**（除非未来证据证明 DSH/Broker 无法承载——目前无此证据）：

- ❌ `agent-core-skill-manager`（skill 系统在 DSH）
- ❌ `agent-core-shell`（shell 在 DSH）
- ❌ `agent-core-session-runtime`（session engine 在 DSH）
- ❌ `agent-core-session`（**不建独立 session 包**：identity = (agentId, sessionId)
  直通 DSH，仅 Product metadata 薄层延后到 Product API milestone）
- ❌ `agent-core-forum-plugin` / `agent-core-workflow-plugin`（Forum/Workflow 在外部，走 Broker）

Agent Core 新增组件命名应落在：agent-definition / memory / agent-router /
process-supervisor / workspace-bootstrap / broker / plugin-lifecycle / proactive-runtime。
（注：早期 `registry` 命名已由声明式 `agent-definition` 取代——AGENT_DEFINITION_CONFIG_V1；
V0 一次性驱动 `@agent-core/router` 已废弃并移入 `examples/v0-vertical-slice/`。）

## 7. 汇总一句话

> 吃 DSH：loop / tools / fs / shell / subagents / skills / compaction / persistence /
> schedule / goal / inbox / 动态插件运行时。自己薄建：agent-definition / session 管理 /
> memory / workspace-bootstrap / agent-router+process supervisor / broker bridge /
> plugin lifecycle / proactive runtime。不做：cron、向量记忆、dashboard、artifact、HA、
> 多渠道 adapter、Product API 实现（均排期在后）。
