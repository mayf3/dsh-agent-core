# Capability Matrix — Agent Core on DSH

> 状态：V1 五主题调查已完成并收敛（2026-08-14）。每份结论的完整证据见
> `docs/investigations/<topic>.md`；本文件是收敛后的单一事实源。
>
> 方法限制：本轮 web_search 后端不可用（无 `DEEPSEEK_API_KEY`），社区插件检索以本地
> DDGS（smart-search）与 DSH checkout 实证代替，各调查文件 §3 均已注明来源与置信度。

## 0. 总览：为了替代 OpenClaw，我们究竟还必须自己做哪几件事

五份调查的一致图景：**DSH 提供了全部底层原语（agent/session/tools/fs/skill/schedule/
jobs/goal/slots/credentials/持久化），缺口全部集中在"薄集成层"，不是新引擎。**

| 主题 | 主结论 | 一句话 |
|---|---|---|
| identity-auth | **BUILD** | DSH 无 principal 层（`identity/` 仅遥测匿名 id）；必须自建「per-agent 进程 + process credential」（方案 B）+ Broker 侧 flat capability ACL |
| memory | **ADAPT** | 记忆存储/检索走 DSH 官方支持的 MCP 通道 + `tool_session_query` 关键字召回；**跨会话巩固（consolidation）完全缺失，必须 BUILD** |
| workspace-files | **BUILD** | DSH `workspace` 只是注册表；缺「per-agent 长期目录创建/播种/文件约定」（workspace-bootstrap 插件） |
| dashboard | **BUILD** | 官方 UI 已有 session/trajectory/workspace/jobs/plugins/settings，缺「agent 运行态 + errors + 全局 jobs + usage + memory 浏览」控制面面板（数据面全现成，只差 UI） |
| always-on | **ADAPT** | inbox/schedule/goal/resume/崩溃恢复原语可作底座；缺「常驻 daemon + 冷启动批量恢复 + jobs 持久化 + cron 语义」（薄封装层） |

**必须自己做的最小清单（BUILD 项，按依赖排序）：**

1. `workspace-bootstrap` 插件 —— per-agent 目录创建/播种/命名（workspace-files §7）
2. 跨会话 `consolidation` 插件 —— episodic 日志 → curated 长期记忆（memory §7）
3. 控制面（Router）= 常驻 daemon —— per-agent 进程 spawn + 进程凭据注入 + 冷启动批量恢复（identity-auth §7 与 always-on §7 合并，见 §2 裁决 2）
4. jobs 持久化 + cron/日历语义（always-on §7 两个子项）
5. 控制面面板：agent 运行态 / 全局 jobs / usage / errors / memory 浏览（dashboard §7）
6. Broker 侧 credential→principal 绑定 + flat ACL（identity-auth §7；属 Broker 侧协作，不在本仓库实现）

结论动词口径：ADOPT = 直接用 DSH 原生件不包装；ADAPT = 复用原生件 + 薄封装/配置；BUILD = 自建薄层；DEFER = 明确不做。

## 1. 能力矩阵（细表）

### 1.1 identity-auth（详见 `investigations/identity-auth.md`）

| 需求能力 | DSH 原生 | 社区/既有 | 缺口 | 结论 |
|---|---|---|---|---|
| 进程内发起方归因（谁驱动的调用） | `requireInitiator()`/`exec.agent`，AsyncLocalStorage（`core/agent/src/index.ts:309-326`） | — | 仅是归因非授权，注释明示 | **ADOPT**（归因用，绝不作 wire 身份） |
| 不可伪造（A 不能冒充 B） | 无；单进程 + 自生成插件下可伪造（`cordis-host-runner` host-only 免审批 + sandbox 非 containment + `tools.execute` 接受调用方 agent） | 未发现 DSH 身份插件 | 整个「per-agent 进程 + 进程凭据」架构 | **BUILD**（方案 B；唯一成立方案，见 `TRUST-BOUNDARY-REPORT.md` §3） |
| 跨进程信任（DSH → Broker） | `credentials` seam（`.credentials.yaml` 0600）、`subprocess` spawn、per-process `dshHomePath`——拼图碎片齐，无整体 | 旧 Auth（OAuth2 client/secret + JWT + grant）形态不适配，全部判定删除 | 进程凭据注入机制 + Broker 侧 credential→principal 绑定 | **BUILD**（控制面铸凭据；Broker 侧 flat allowlist 替代旧 Auth） |
| 动态插件攻击面处置 | `tool-cordis`/`cordis-host-runner` 是本进程内自提权 | — | 跨 agent 信任必须依赖进程边界 | **DEFER**（per-agent 进程内它是"本进程身份下自提权"，不作为跨 agent 信任机制） |

### 1.2 memory（详见 `investigations/memory.md`；已落地：决策 D-003 + `reports/memory-v1.md`，分支 feat/agent-memory-v1）

| 需求能力 | DSH 原生 | 社区/既有 | 缺口 | 结论 |
|---|---|---|---|---|
| 事件溯源日志 + 持久化 | Session append-only 日志 + JSONL/SQLite，崩溃恢复 | — | 无（这是日志不是记忆） | **ADOPT** |
| 会话内压缩 | `compaction`（摘要替换 surface） | — | 只做会话内，不跨会话 | **ADOPT** |
| 跨会话召回（关键字） | `tool_session_query`（FTS5，opt-in）+ `session-reference` 引用注入 | — | 无语义召回；召回发生在原始日志而非 curated 记忆库 | **ADAPT**（`agent-memory` 注入 + `memory_search` 工具已落地；语义召回 **DEFER**） |
| 跨会话巩固（consolidation） | ❌ 无 | MCP Reference Memory/Memorix/Engram（官方示例）；OpenClaw dreaming/consolidation；mem0/Letta/Zep 过重；mneme 0.1.6（SQLite+镜像，全局库） | 曾是**唯一完全缺失层** | **BUILD ✅**（`@agent-core/agent-memory`：turn/end + 防抖提炼写入 `<workspace>/MEMORY.md`，输出逐条校验防记忆注入，失败落 daily note 兜底） |
| 记忆存储/检索通道 | 官方定位 = 第三方 MCP（`examples/mcp-memory`） | MCP server-memory（KG）等 | — | **ADAPT**（文件记忆为主，MCP 保留可选后端） |
| per-agent 隔离 | 会话存储按会话隔离；cwd 认证 | — | 曾无「每 agent 一份记忆命名空间」统一抽象 | **BUILD ✅**（物理隔离：agentId→workspace→MEMORY.md，无全局库；`DSH_AGENT_ID`/cwd 键控） |

### 1.3 workspace-files（详见 `investigations/workspace-files.md`）

| 需求能力 | DSH 原生 | 社区/既有 | 缺口 | 结论 |
|---|---|---|---|---|
| 文件读写/搜索 | `fs/*`（read/write/edit/glob/grep + observation-policy） | — | 无 | **ADOPT** |
| AGENTS.md 自动加载 | `agent-instructions`（base bundle 默认开，分层 reload + 预算） | OpenClaw AGENTS.md（蓝本） | 无 | **ADOPT**（等价且更自动） |
| skills/ 目录约定 | `skill-filesystem`（磁盘 SKILL.md 同构 + 优先级梯） | OpenClaw skills/（蓝本） | 无 | **ADAPT**（确认 frontmatter/precedence 映射） |
| per-agent 长期目录创建/播种/命名 | ❌ `workspace` 只是注册表（拒绝不存在的目录） | — | **核心缺口**：无 `workspace-<agentId>` 等价物、无种子文件、无 git init、cwd 无人设置 | **BUILD**（workspace-bootstrap 插件） |
| 记忆文件约定（MEMORY.md/SOUL.md/USER.md/memory/daily） | ❌ 无原生概念 | OpenClaw 文件 Map（蓝本） | 种子 + 维护 workflow | **ADAPT**（约定文档）+ **BUILD**（播种，见 1.2） |
| 附件 | `attachment`（仅图片） | OpenClaw 无 attachments/ 工作区目录（channel 媒体是另一管线） | 通用文件非 V1 必需 | **DEFER** |
| 备份（git init） | ❌ | OpenClaw 自动 git init | 播种时顺带 | **BUILD**（并入 bootstrap） |

### 1.4 dashboard（详见 `investigations/dashboard.md`）

| 需求能力 | DSH 官方 UI | 社区/既有 | 缺口 | 结论 |
|---|---|---|---|---|
| 会话列表/搜索/新建 | `ui-workspace`（读写） | — | 无跨 workspace 全量聚合页 | **ADOPT**（沿用） |
| trajectory 只读 | `ui-trajectory`（conversation.view 标签页） | — | 无 | **ADOPT**（沿用） |
| files 浏览 | `ui-workspace` 目录流 | — | 无会话内纵深预览面板 | **ADAPT** |
| plugins 管理 | `ui-settings-plugin-inventory` + `ui-cordis`（只读 + 启停） | — | 无「运行中插件 → 会话/服务/错误」关联视图 | **ADAPT** |
| agent 运行态 + errors 总览 | ❌ 无 | OpenClaw dashboard（gateway 内嵌，不可移植，仅范式） | 数据面现成（`session/event`、`agent/error` relay、telemetry） | **BUILD**（Slots 面板） |
| 全局 jobs 聚合 | `ui-jobs` 仅会话头部弹层 | — | 无跨会话聚合 + 日志展开 | **BUILD**（依赖 jobs 持久化，见 §2 裁决 4） |
| usage/cost | ❌ 官方无 | `dsh-usage-dashboard` 等动态插件（已示范 Slots 路径） | token-meter 数据面现成 | **BUILD**（官方内置，吸收社区思路） |
| memory 浏览 | ❌ 无（仅 ui-skill 列表） | — | 记忆面板 | **ADAPT**（并入控制面板） |
| OpenClaw 式 agent 自建 widget 网格 | — | OpenClaw board/dashboards | 与控制面监控目标不同 | **DEFER** |

### 1.5 always-on（详见 `investigations/always-on.md`）

| 需求能力 | DSH 原生 | 社区/既有 | 缺口 | 结论 |
|---|---|---|---|---|
| inbox / followup / steer 唤醒 | durable inbox + `agent/inbox/spliced` 落盘 | — | 无 | **ADOPT** |
| 外部唤醒 | SDK JSON-RPC `session/prompt`、web | — | 冷启动不自动恢复历史会话 | **ADAPT**（封装统一恢复入口） |
| 定时调度（固定周期） | `dsh-schedule`（every_seconds ≥300s，持久化） | — | 未入默认 bundle 需 opt-in；会话本地投递 | **ADOPT**（纳入组合） |
| cron/日历规则 | ❌ 不支持 | OpenClaw automations/cron（蓝本） | 需自建编译到 schedule 或独立到期器 | **BUILD** |
| 长期目标自动续轮 | `goal` + goal-round-driver（持久化） | — | 无 | **ADOPT** |
| 后台作业 jobs | `jobs-local` **纯内存**（重启即失联） | — | 无持久化、无跨重启恢复 | **BUILD**（落盘 + 恢复） |
| 重启/崩溃恢复 | 单会话 resumeSessionId + 日志重放 + interrupted 补记 | — | 无「启动时批量扫描恢复全部会话/inbox/schedule/goal」编排 | **BUILD**（并入控制面 daemon，见 §2 裁决 2） |
| 多 agent 常驻 | 续子 agent Activation 常驻 + 冷恢复 | — | 顶层多 agent 各自常驻框架；**形态被方案 B 约束为 per-agent 进程**（见 §2 裁决 1） | **ADAPT**（= 控制面编排） |
| daemon/进程长驻 | ❌ CLI 单进程，无 supervisor | systemd/pm2 可外部托管 | 常驻宿主 + 冷启动恢复 | **BUILD**（控制面） |

## 2. 收敛裁决（冲突结论修正记录）

1. **always-on「多 agent 常驻同进程 vs 独立进程」（§8 Q3）× identity-auth 方案 B**：
   方案 B 是硬约束 —— 多 agent 常驻 = 控制面管理 N 个 per-agent 进程；单进程内多 agent
   仅限同信任域（如 subagent 父子链，wire 呈现父 principal）。always-on 的常驻框架
   按此形态设计，不得为省资源退化为单进程多 principal。
2. **always-on「常驻 daemon + 冷启动恢复」≡ identity-auth「控制面（Router）」**：
   同一组件，合并为一个 BUILD（spawn per-agent 进程、注入进程凭据与 per-agent home、
   启动时批量恢复会话/inbox/schedule/goal、接收外部唤醒）。两报告各自列出的独立
   BUILD 项取消其一。
3. **memory「MCP 记忆通道」× workspace-files「MEMORY.md 文件约定」**：
   V1 以文件记忆为主（与 OpenClaw「Memory is just Markdown」一致、零外部依赖、
   与 workspace-bootstrap 播种天然衔接），consolidation 写入文件；MCP 记忆保留为
   可选后端，不建两套记忆面。
4. **dashboard「全局 jobs 聚合」依赖 jobs 持久化**（always-on BUILD 子项）：
   控制面板 V1 先做进程内聚合；跨重启聚合在 jobs 持久化落地后升级。

## 3. 未决开放问题（进入 milestone 与后续决策）

- 控制面（daemon/Router）常驻的 profile/bundle 形态与系统托管方式（systemd vs 进程内）
- workspace-bootstrap 的挂点（`agent/pre-step` vs preset 组合创建）与 AGENTS.md race
- ~~consolidation 触发时机（compaction 前 / turn 尾 / 定时）与记忆信任边界（防记忆注入）~~ → 已定案（D-003）：turn/end + 防抖 + 显式工具/服务；证据先过滤 + 输出逐条校验
- 控制面板目标用户（人工运维 vs 上层编排读运行态）决定 `agent/*` 事件是否投影为可聚合数据
- 子 agent 是否共享父 principal 的 wire 呈现（影响内建 subagent 审计语义）
- 进程凭据形态（opaque bearer vs mTLS）与 Broker 审计事件格式（attempted vs actual principal）
