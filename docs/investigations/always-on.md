# Always-On Investigation

> V1 能力调查 · 主题：常驻、调度、唤醒、恢复（always-on）。
> 调查对象：DSH checkout（只读，本机路径以实际为准）。
> 结论用途：为「Agent Core on DSH」V1 判定如何替代旧 Agent Core / OpenClaw 的 always-on 能力。**本阶段只调查、不写代码。**

## 1. Required behavior

为替代 OpenClaw 的 always-on 定位，我们需要的目标行为：

1. **定时调度（scheduler）**：按 cron / 固定周期 / 单次 at 触发 agent 动作；调度持久化，重启进程后仍保留到期任务。
2. **后台作业（background jobs）**：由 agent 触发的长运行任务（命令、子 agent、工作流），可查询/等待/终止，进程重启后状态可恢复或可观测。
3. **消息队列 / 唤醒（inbox / wakeup）**：agent「常驻等待消息」——进程存活时外部（SDK/HTTP/事件）可随时投递消息唤醒 idle agent 开一轮 turn。
4. **外部唤醒（external wakeup）**：非本进程的服务（SDK JSON-RPC server、web、cron daemon）能对运行中的 agent 发 prompt / steer，投递即唤醒。
5. **长运行（long-running）**：同一会话跨多轮自动续跑（goal 自动续轮），无需人工逐轮干预。
6. **重启恢复（restart/resume）**：进程退出后，靠持久化（session 事件日志）把会话+inbox+调度+goal 全部还原，新进程可无缝接续。
7. **崩溃恢复（crash recovery）**：进程被 kill / 断电后不丢数据、不留悬挂 turn。
8. **多 Agent 常驻（multi-agent resident）**：多个 agent/子 agent 同时在内存中待命，各自收消息、各自调度，组成常驻 agent 网络。

## 2. DSH native capabilities

以下为 DSH 原生能力盘点（文件行号为 checkout 实际源码/文档证据）。

### 2.1 逐项能力清单表

| 能力 | DSH 包 / 机制 | 模型可见 tool / API | 支持常驻等待消息 | 持久化 | 证据 |
| --- | --- | --- | --- | --- | --- |
| 定时调度 | `@deepseek-ai/dsh-schedule` | `schedule_create` / `schedule_list` / `schedule_delete` | 仅会话存活时按时投递；会话下线则成 overdue 待 resume | `schedule/change` 事件（session 日志） | `packages/schedule/schedule/src/index.ts:40-77`；`src/tools.ts:318,400,420`；`src/runtime.ts:99,180,189,256,275` |
| 后台作业 | `@deepseek-ai/dsh-jobs-local` + `@deepseek-ai/dsh-tool-jobs` | `job_kill` / `job_list` / `job_output`（bash run_in_background、PTY、子 agent 通用） | 否（进程内内存记录） | 否（仅内存；`job/` 无持久事件） | `packages/jobs/jobs-local/src/index.ts:1-9,39-60`；`docs/tool-catalog.md:38` |
| 长期目标自动续轮 | `@deepseek-ai/dsh-goal` + `goal-round-driver` | `create_goal` / `get_goal` / `update_goal` | 是：goal 自动生成续轮 turn | `goal/change` 事件（session 日志） | `packages/goal/tool-goal/src/index.ts`；`docs/tool-catalog.md:29,945`；`goal-round-driver/src/index.ts:1-60`；`docs/persistence-catalog.md:414` |
| 任务清单 | `@deepseek-ai/dsh-tool-todo` | `todo_write` | 会话态 UI 状态（不驱动 turn） | `todo/write` 事件 | `docs/tool-catalog.md:39,1686`；`docs/persistence-catalog.md:711` |
| 消息队列/唤醒 | `@deepseek-ai/dsh-agent` 的 Inbox | `agent/status` 事件；SDK `session/prompt`、`Agent.followup/steer/inject/send` | 是：inbox 常驻，`followup` 唤醒 idle driver 开 turn；`steer` 中断/边界接管 | inbox `agent/inbox/spliced` 事件（持久） | `packages/core/agent/src/inbox.ts:26,86`；`src/runtime-types.ts:93,117,124,133,143`；`docs/agent-lifecycle.md:19-71` |
| 会话恢复 | `@deepseek-ai/dsh-session-persistence`（jsonl/sqlite 后端） | `resumeSessionId` → `ctx.agents.resume()`（SDK/网关路径） | — | JSONL / SQLite 事件日志 | `packages/core/agent-loop/src/index.ts:653,667`；`packages/api/remotes/src/agent-lookup.ts:162-166`；`docs/persistence-catalog.md` |
| 外部唤醒（SDK JSON-RPC server） | `@deepseek-ai/dsh-sdk-jsonrpc-server` | `session/prompt`（按 sessionId 投递→followup 唤醒） | 是（进程内已挂的 agent）；但冷启动按 sessionId 新建而非自动 resume | transport 事件流 | `packages/sdk/server/src/server.ts:132-143,203-235,190-200` |
| 长运行子 agent / 多 agent 常驻 | `@deepseek-ai/dsh-subagent` 的可续（continuable）后台子 agent | `agent.followup`（运行时唤醒），tools 子 agent 族 | 是：Activation 常驻、`waiting`/`running` 态、cold-resume new Activation | 子 session（`subagent/descriptor` 事件） | `docs/subsystems/subagent.md:116-160` |
| 崩溃恢复 | `session-persistence` 修复流程 | — | — | 中断 turn 补 `turn/end interrupted` | `docs/subsystems/persistence.md`（crash recovery 段） |
| 进程生命周期 | `apps/cli`（`dsh --profile web/headless/…`） | CLI 无 daemon 子命令；靠外部注册守护 | web-app bundle 可长期驻留 | 见 persistence | `apps/cli/src/bin.ts:29-52`；`packages/bundle/web-app/README.md:5` |

### 2.2 关键语义细节（供对标）

- **schedule 是「可选挂载、会话本地投递」**：`dsh-schedule` 不在 base / web-app / headless 任一 bundle 中（`apps/cli/composition.md:21-167` 无 schedule 行），需单独加载。其承诺明确「session-local delivery only —— 只在其原 Session **活着**时按时跑，冷会话不投外部通知，过期的过时 reminder 待 resume 后才处理」（`packages/schedule/schedule/README.md:109-116`）。调度驱动靠「agent 变 idle 或 `whenIdle()` 后 `requestDrive()` + `followup()`」，即**依赖进程内该 agent 活着**。
- **schedule 只支持固定周期（`every_seconds` ≥ 300s）/ 单次 after / 单次 at，不支持 cron 表达式 / 日历规则**（README.md:113-115）。
- **jobs 是进程内内存态、不可跨重启恢复**（`packages/jobs/jobs-local/src/index.ts:1-9`），无持久化事件；`run_in_background` 与子 agent 均走这个 registry，进程死即失联。
- **不会自动「resume 全部会话」**：SDK server 的 `createSession` 总是 `ctx.agents.create`（新建空会话，`server.ts:218-235`）；`agent-lookup.ts` 提供 `resume` 能力，但需上层调用方显式按 resumeSessionId 拉起来，DSH 自身没有「启动时扫描并恢复所有历史会话」的机制。
- **inbox 是 durable 的 next-turn / next-step 队列**：`agent/inbox/spliced` 落盘（`inbox.ts:27,186`），因此「投递但还没跑完」的消息在崩溃后能从日志重放，天然支持「重启后恢复待跑消息」。
- **goal 是 DSH 上最接近「long-running 自动续跑」的原生机制**：自动续轮 turn 通过 `runMaintenance` / inbox 注入（`goal-round-driver/src/index.ts`），由 `goal/change` 持久化，且专门规避次数上限/blocked 判定。
- **进程生命周期结论**：DSH 通过 `dsh --profile <mode>` 启动一次进程（`bin.ts`），无内建 daemon / supervisor / 进程自动重启；「常驻」= 保持进程活着（web-app bundle 即浏览器常驻前端）+ 外部（systemd/pm2/supervisor）负责存活。`subagent` 已实现「续子 agent Activity 常驻 + 冷恢复」，是 DSH 的多 agent 常驻雏形。

## 3. Existing community plugins

web_search 后端因缺 `DEEPSEEK_API_KEY` 不可用，改用 smart-search（DDGS）搜索：

- **OpenClaw 官方文档（对标对象）**已确认其 always-on 能力定义：
  - **Automations / cron jobs**：OpenClaw 内建调度器，「persists jobs, wakes the agent at the scheduled time」（`docs.openclaw.ai/automation/cron-jobs`）；`openclaw cron` 为别名。
  - **Background tasks**：会话之外的长期工作「activity ledger」。
  - **Task flow**：background tasks 之上的持久编排层（`docs.openclaw.ai/automation/taskflow`）。
  - **Standing orders**：给 agent「permanent operating authority」——按既定边界自主定时执行例行工作，只在异常/审批时人工介入（`docs.openclaw.ai/automation/standing-orders`）。
  - URL：https://docs.openclaw.ai/automation/cron-jobs 、https://docs.openclaw.ai/automation/standing-orders 、https://docs.openclaw.ai/automation/taskflow 、https://docs.openclaw.ai/automation/tasks
- **DSH / Cordis 生态 cron/schedule 插件**：未发现独立的第三方「DSH schedule/cron」实现。DSH 生态仍以仓库内 `@deepseek-ai/dsh-schedule`（固定周期）+ 可选 `@deepseek-ai/dsh-time-context`（自然语言时区解释，`packages/context/time-context`）为主；未发现支持 cron 表达式的社区插件。
- **结论**：社区侧没有「拿来即用」的 DSH cron 插件；参考实现应取自 OpenClaw 的 automations（持久调度器+到点唤醒）这一范式，但需在 DSH 上自建（见 §5/§6）。

## 4. Evidence

- DSH checkout 源码 / 文档引用见 §2.1 表格「证据」列。关键文件：
  - `packages/schedule/schedule/{index,runtime,tools,domain,persistence}.ts`
  - `packages/core/agent/{inbox,dispatch,runtime-types}.ts`；`packages/core/agent-loop/src/index.ts`
  - `packages/jobs/jobs-local/src/index.ts`；`packages/goal/{tool-goal,goal-round-driver}/src/`
  - `packages/sdk/server/src/server.ts`；`packages/api/remotes/src/agent-lookup.ts`
  - `docs/{agent-lifecycle,persistence-catalog,tool-catalog}.md`；`docs/subsystems/{persistence,schedule,subagent}.md`
- OpenClaw 对标文档 URL：见 §3。

## 5. Gaps

按目标行为逐项标状态（✅ 内建 / ⚠️ 部分 / ❌ 缺失）：

| 目标能力 | 状态 | 缺口说明 |
| --- | --- | --- |
| schedule（定时任务） | ⚠️ 部分 | 已有固定周期/单次提醒且持久化；但**不支持 cron 表达式/日历规则**（`README.md:113-115`）；**会话本地投递**，冷会话不主动投递外部通知（`README.md:111`）；**未入默认 bundle**，需 opt-in。 |
| jobs（后台作业） | ❌ 关键缺口 | jobs **纯进程内内存态**（`jobs-local/src/index.ts:1-9`），**无持久化、进程重启即失联**，无法恢复长运行任务的进度/结果。 |
| inbox（消息队列/唤醒） | ✅ 内建 | durable next-turn/next-step 队列 + followup/steer 唤醒；崩溃后可从日志重放。 |
| wakeup（外部唤醒） | ✅ 内建（进程内） | SDK JSON-RPC `session/prompt` 与 web 可唤醒已挂 agent（`server.ts:132-143`）。**但冷启动不自动恢复历史会话**（`createSession` 总是新建 `server.ts:218-235`），外部唤醒的对象须已在进程内或显式 resume。 |
| long-running（长运行自动续跑） | ✅ 内建 | goal 自动续轮机制成熟，`goal/change` 持久化。 |
| restart-resume（重启后恢复会话） | ⚠️ 部分 | 单个会话可按 resumeSessionId 恢复（`agent-loop/src/index.ts:667`）；inbox、schedule、goal 均可从日志重放。**缺「启动时批量扫描并自动恢复全部会话/inbox/schedule/jobs」的编排**；jobs 更是无法恢复。 |
| crash recovery（崩溃恢复） | ✅ 内建 | 中断 turn 补 `turn/end interrupted`，不截断日志（`docs/subsystems/persistence.md`）；但 jobs 的进程内状态仍丢。 |
| multi-agent resident（多 agent 常驻） | ⚠️ 部分 | 可续后台子 agent 具备 Activation 常驻 + 冷恢复 + FIFO inbox（`docs/subsystems/subagent.md:116-160`）；但**没有「顶层多 agent 同时常驻、各自配 schedule/inbox」的统一框架**。 |
| daemon / 进程长驻 | ❌ 缺失 | `apps/cli/bin.ts` 仅按 profile 单进程启动；**无内建 daemon / supervisor / 自动拉起 / 开机常驻**，靠第三方（systemd/pm2）或 web-app 常驻进程补位。 |

## 6. Options

1. **直接采用 DSH 原语拼装（最小改法）**：以 inbox+followup 为唤醒马达，schedule 做定时投递，goal 做长运行续轮，resumeSessionId 做按需恢复，外部用 web-app/SDK server 进程当常驻宿主。→ 最快，但无法覆盖 jobs 持久化、冷启动全量恢复、顶层多 agent 常驻与 daemon 化。
2. **在 DSH 上补一个「always-on daemon 层」**（自定义 bundle/profile）：进程常驻 + 启动时扫描 persistence 恢复全部目标会话（如 agent-lookup 那样逐 session resume）+ 恢复 inbox/schedule/goal + 把 jobs 或调度到期消息落盘。
3. **扩展 DSH schedule 支持 cron / 日历规则**：把「固定周期」扩成 cron 语义，并在到期时真正唤醒（含把目标 session 从持久化拉起而非仅 inline 提醒）。
4. **把 jobs 改为可持久化**（session 事件或独立 store），跨重启续期/可观测。
5. **复用/对标 OpenClaw standing orders 模式**：常驻 agent 的持久运行边界（权限+日程），在 DSH 上以 preset（goal + schedule + permission）表达。
6. **外部托管常驻**：进程存活交给 systemd/pm2/k8s，DSH 只负责 resume 协议——简单，但把「恢复/重活」责任外推，重启窗口期无法调度。

## 7. Recommendation

**主推荐：ADAPT（采用 DSH 原语为底座，新增一薄层「always-on daemon + 恢复编排」以补齐缺口）**

理由：DSH 已具备 inbox 唤醒、schedule（固定周期）、goal 长续、resume、崩溃恢复、续子 agent 常驻等高质量原语，足以作为 always-on 底座；真正缺失的是「进程内常驻宿主 + 冷启动全量恢复 + jobs 持久化 + cron 语义」，这些是薄封装层而非新引擎，采用 ADAPT 成本最低、收益最大。

子项动词表：

| 子能力 | 动词 | 一句理由 |
| --- | --- | --- |
| schedule 固定周期/单次 | **ADOPT** | 已持久化且投递清晰，直接承担常规调度；仅需将未入 bundle 的它纳入我们的组合。 |
| cron / 日历规则 | **BUILD** | DSH 只支持 every_seconds≥300s，无 cron 语义，需自建 cron 表达式编译到 schedule（或独立到期器）。 |
| inbox / followup / steer / wakeup | **ADOPT** | durable 队列 + 唤醒马达已达标，直接作为一切唤醒的统一通道。 |
| goal 长运行自动续轮 | **ADOPT** | 原生且持久化，长期任务直接复用它。 |
| restart-resume（逐会话恢复） | **ADOPT** | resumeSessionId + 日志重放已满足；需封装统一恢复入口。 |
| 冷启动批量恢复全部会话 + daemon 常驻 | **BUILD** | DSH 无此编排与 daemon 层，需新建常驻 profile + 启动扫描恢复。 |
| jobs 后台作业持久化/跨重启恢复 | **BUILD** | 当前纯内存，长运行任务重启即丢，需把任务记录与 payload 落盘。 |
| 多 agent 常驻框架 | **ADAPT** | 复用续子 agent 的 Activation 常驻语义，扩为「顶层多 agent 各自常驻」。 |

## 8. Open questions

1. OpenClaw 的「standing orders / automations 到点唤醒」是否天然要求一个**常驻调度进程**（而非仅会话内计时）？若是，我们的 daemon 层该常驻哪个 profile、挂哪些 bundle。
2. jobs 的持久化与重启恢复，是否应复用 session 事件日志（可重放、可审计），还是独立 job store（更小的读放大、但需单独事务与 GC）？
3. 「多 agent 常驻」的规模与隔离要求：顶层多 agent 是否共享一个进程（省资源、易协作）还是各自进程（隔离、可独立拉起）？这会决定 daemon 层形态。
4. 崩溃窗口的重复投递语义（schedule README 也自承 `narrow crash duplicate window`，`README.md:116`）对金融/审批类场景是否可容忍，是否需要 exactly-once 化。
5. 冷启动全量恢复的代价：恢复 N 个历史会话的启动耗时与内存占用，是否需按「最近活跃 / schedule 最近到期 / owner」做优先级与惰性加载。
