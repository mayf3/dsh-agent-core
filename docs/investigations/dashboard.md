# Dashboard Investigation

> 主题：Agent Core on DSH 用于替换 OpenClaw dashboard（control plane）所需的 UI/控制面能力。
> 范围：只读探查 `deepseek-harness`（本机路径以实际为准），
> 不修改任何代码。证据路径均相对于 DSH checkout 根目录。

## 1. Required behavior

OpenClaw 的 dashboard 诉求（对照 `openclaw/openclaw` 仓库 `docs/web/*`）：

- **会话列表与详情**：按 agent/session 浏览、搜索、标题、存档/删除/切换面（`/dashboards`、Sessions、Tasks、Workboard）。
- **trajectory / 会话日志**：只读查看一次 run 的事件流、工具调用、耗时、完成状态。
- **workspace 文件浏览**：只读浏览 agent 工作区文件树、定位、搜索结果定位。
- **jobs 面板**：后台任务列表（running/settled）、日志、kill。
- **usage / cost 监控**：token 用量、费用、调用次数、逐天/逐小时分布（余额等账户级数据）。
- **errors / 运行态监控**：agent/error、会话头部状态摘要、健康度。
- **插件管理（plugin inventory）**：系统级插件与动态 Cordis 插件的运行状态、启停。
- **设置（settings）**：模型、权限、常规、onboarding。

「为替代 OpenClaw dashboard，DSH 还必须自己做什么」落在第 5、6、7 节。

## 2. DSH native capabilities

**架构模型**：浏览器 UI 是一个 Cordis `dsh-web-app` bundle 之上的插件树（`docs/architecture.md` 描述：profile/bundle 分层、无特权 core）。apps/web 只是薄 vite entry：`apps/web/src/main.ts:17` 里 `import { AppWebEntry } from '@deepseek-ai/dsh-client-web'`，把 `#root` 交给 shell 库；实际 UI 全部在 `packages/client/*`。

**三栏布局与 Slots 扩展点**：`packages/client/ui-layout/src/client/AppFrame.tsx:23` 定义了 `sidebar | conversation | details | shell.overlay` 四类 child slot；`AppFrame.tsx:179-194` 分列渲染这四类。`packages/client/ui-layout/src/client/index.ts:72` 声明 `details`（session 作用域 single）；`packages/client/ui-conversation/src/client/apply.ts:444-454` 注册 `DetailsPanel` 到 `details`。Slots（`packages/client/ui-slots`）是官方 UI 的一等扩展机制：任何插件可在这些 slot 里 `register()`，`ui-conversation/src/client/apply.ts:378` 注册 `conversation.view` 的 `id:'chat'` 标签页，`ui-trajectory/src/client/index.ts:43-64` 再注入同 slot 的 `id:'trajectory'` 标签页——视图由 slot 列表动态合并（`apply.ts:155-165` 用 `slots.entries('conversation.view')` 编程投影）。

**官方默认挂载的 UI 模块盘点**（来自 `packages/bundle/web-app/cordis.patch.yml` 的完整 ui-* 列表 + 源码），以下为「官方 UI 已有什么」清单：

| 能力面 | 官方 UI 现状 | 只读/读写 | 证据（文件:行） |
|---|---|---|---|
| 会话列表/搜索 | `ui-sidebar`+`ui-workspace`，WorkspaceBrowser 整区 + 搜索 + 新建/重命名/归档/fork | 读写 | `packages/client/ui-workspace/src/client/index.ts:70-102` |
| 会话详情（聊天） | `ui-conversation`，`conversation.view` chat 标签页 | 读写（发送/steer） | `apply.ts:377-378` |
| trajectory（会话事件流/工具调用） | `ui-trajectory`，trajectory 标签页，事件表/时长/compaction | 只读 | `ui-trajectory/src/client/index.ts:43`、`TrajectoryTable.tsx` |
| files / workspace | `ui-workspace` WorkspaceBrowser（sidebar 区 + hero picker）目录流 | 读写（创建/选目录）+ 会话内 file 工具只读 | `ui-workspace/src/client/index.ts:110-128` |
| jobs（后台任务） | `ui-jobs`，会话头部 action 弹层 job 列表 | 只读 + `job_*` tool | `ui-jobs/src/client/index.ts:30-39` |
| 插件管理 | `ui-settings-plugin-inventory`（只读 inventory tab）+ `ui-cordis` shell.overlay 全局面板 | 只读视图 + run/stop 控制 | `ui-settings-plugin-inventory/src/client/index.ts`、`extensions/ui-cordis/README.md` |
| 记忆/memory | **无独立 UI**；`ui-skill`（skill 列表）存在，session projection 只在轨迹内联动 | 只读（skill） | `ui-skill/`；`packages/client/ui-skill/src/client/index.ts` |
| 设置 | `ui-settings`+`ui-settings-general`（onboarding/常规）+`ui-settings-models`+`ui-settings-plugins` | 读写 | `ui-settings-general/src/client/index.ts:4,123-128` |
| agent/runtime 健康 | **无独立监控页**；无 telemetry/usage/error UI 模块 | — | bundle web-app 无对应 ui-* 包 |
| usage / cost | **无官方页**（社区插件见 §3） | — | token-meter 有数据面但无 UI |
| errors | **无独立页**；`ui-message-feedback` 记录人工反馈 | 只读 | `ui-message-feedback/src/client/index.ts:60` |

**可供 UI 消费的 host 数据面**：
- **会话日志/事件流**：`ctx.sessions` + append-only `SessionEvent`（`docs/persistence-catalog.md` 枚举全部事件，含 `assistant/message` 的 `usage`、`tool/result` 的 `error`、`turn/end`、`agent/error` 中继）。`docs/architecture.md:44-61` 说明事件如何驱动 UI 渲染。
- **usage/token**：`packages/llm/token-meter/src/` 提供 `tokenUsageProjectionDefinition`/`contextPressureProjectionDefinition`（usage-projection.ts），可聚合成用量数据（无默认 UI）。
- **telemetry / errors**：`packages/session/session-telemetry/` 提供 `session-telemetry/record` waterfall + `agent/error` relay（coordinator.ts）；`session-telemetry-otel` 提供 OTEL 导出（供外部监控栈消费，无内置 UI）。
- **jobs**：`ctx.jobs`（`docs/architecture.md:116`）+ `tool-jobs` 的 `job_list/job_output/job_kill`。
- **plugin inventory**：`packages/host/plugin-inventory/src/` + `remote.pluginInventory`（供 settings tab）。
- **workspace/fs**：`ctx.workspaces`（上表 `ui-workspace/index.ts` 全量可调 host 方法）。

**官方 web 扩展点**（对应问题 3）：
- Slots：一级扩展点，见上。任何插件可注册到 `sidebar.*` / `conversation.*` / `details` / `shell.overlay`。
- 主题：`packages/client/ui-theme`（theme-settings、boot-theme）——可换设计 token/外观。
- 自定义面板/`conversation.view` tab：`ui-trajectory` 即最佳范例（新增只读视图标签页）。
- `extensions/ui-cordis`（@deepseek-ai/dsh-client-ui-cordis）：动态 Cordis 插件的全局 shell.overlay 面板 + `cordis_define` 只读卡片；`extensions/cordis-client-runner` 负责浏览器半身加载/编排（page 的 live set、run/stop 编排、render 失败归因）。

## 3. Existing community plugins

（web_search 因本会话无 DEEPSEEK_API_KEY 不可用；改用 GitHub/API 实证。）

- **Xenia0922/dsh-opencode-go-usage** — DeepSeek Harness 插件，OpenCode Go 用量与花费悬浮仪表盘（配额、逐请求成本、模型/来源分布）。动态 Cordis 插件。星 3。
- **Cassius0924/dsh-usage-dashboard** — DSH Web GUI 用量/余额仪表盘：右下角悬浮额度窗 + 「额度」view tab（余额、token 聚合、费用估算、逐天/逐小时/热力图）。动态 Cordis 插件，Host 侧私有 RPC + Client 渲染。这直接证明**社区已用官方 Slots/插槽机制做 dashboard tab**，也证明 token 用量可从 `assistant/message.usage`（`sessionPersistence`）聚合。https://github.com/Cassius0924/dsh-usage-dashboard
- **OpenClaw 官方 dashboard**（`openclaw/openclaw`）——不是可复用的独立包：是「session 的一个 face」，agent 通过 `dashboard` tool 构建 widget 网格 + docked chat + `/dashboards` 索引页，widget 是硬沙箱 HTML/JS/SVG，能力需 operator grant（`docs/web/dashboards.md`、`docs/web/dashboard-architecture.md`）。**无法直接采用**，仅作设计参照。
- **OpenClaw Control UI**（`docs/web/control-ui.md`）——Vite+Lit SPA，直接连 Gateway WebSocket，提供 chat + session rail（headline digest、plan progress）+ 会话观察（utility model 生成状态摘要）。同样是「gateway 内嵌」而非可移植插件。

结论：DSH 生态尚无成熟的开箱即用 monitoring/control-plane dashboard；现有社区件均为单个功能的动态插件（usage），并示范了「用插槽机制扩展 Web GUI」这一正确路径。OpenClaw dashboard 不可移植，只能作为产品/交互范式参考。

## 4. Evidence

- `apps/web/src/main.ts:17` web 薄入口；`apps/web/index.html` 只有 `#root`。
- `packages/client/ui-layout/src/client/AppFrame.tsx:23,179-194` 三栏 + `shell.overlay`；`index.ts:72` details slot。
- `packages/client/ui-conversation/src/client/apply.ts:366-455` chat 标签页 + `DetailsPanel` + views 投影；`contract/slots.ts:63-118` conversation 各 slot。
- `packages/client/ui-trajectory/src/client/index.ts:43-64` trajectory 标签页注入 `conversation.view`。
- `packages/client/ui-workspace/src/client/index.ts:45-128` 全量 workspace/会话方法。
- `packages/client/ui-jobs/src/client/index.ts:22-39` jobs 头部 action。
- `packages/client/ui-settings-plugin-inventory/src/client/index.ts` plugin inventory tab（`remote.pluginInventory`）。
- `packages/bundle/web-app/cordis.patch.yml` 默认挂载的完整 ui-* 清单（无 telemetry/usage/error 面板）。
- `docs/persistence-catalog.md` 全部持久化事件（usage/error/turn 等）；`docs/architecture.md:44-61,110-127` 扩展点。
- `packages/llm/token-meter/src/usage-projection.ts`、`packages/session/session-telemetry/src/coordinator.ts`（agent/error relay）、`packages/host/plugin-inventory`。
- 社区：github.com/Xenia0922/dsh-opencode-go-usage、github.com/Cassius0924/dsh-usage-dashboard；openclaw/openclaw `docs/web/dashboards.md`、`docs/web/control-ui.md`。

## 5. Gaps

逐项对照（OpenClaw dashboard 需求 × DSH 官方 UI）：

- **agent**：DSH 以 session 为一级对象，无「agent runtime 列表/健康/活跃 run」监控页；会话观察摘要（OpenClaw headline/rail）缺失。→ **GAP：agent/runtime 运行态总览页缺失**。
- **session**：✓ 较全（workspace 组织的会话列表/搜索/新建/重命名/归档/fork，`ui-workspace`）。仍无跨 workspace 的全量「全部会话」聚合页（依赖现有 sidebar/workspace 区）。
- **trajectory**：✓ 只读标签页已具备（`ui-trajectory`）。可评估是否要导出/筛选增强。
- **files**：△ 能浏览/选目录并创建；**无会话内只读纵深文件树/预览面板**（文档、图片、diff）等 dashboard 式浏览。需确认覆盖度。
- **memory / 长期记忆**：**GAP**——无官方记忆/投影浏览 UI；`ui-skill` 只有 skill 列表。
- **jobs**：△ 仅会话头部的弹层列表（`ui-jobs`）；**无全局跨会话 jobs 聚合面板**、无日志/结果展开面板，未用 `ctx.jobs` 的全局列举做跨会话视图。
- **plugins**：△ inventory 只读 + `ui-cordis` 动态插件面板可启停；**无「运行中插件 → 会话/服务」关联视图、无健康/错误归因的集中仪表盘**。
- **usage**：**GAP（官方）**——官方无用量/费用仪表盘；数据面（token-meter、`assistant/message.usage`）现成，社区插件已示范。余额类账户数据需 DeepSeek API。
- **errors**：**GAP（官方）**——无错误/告警集中展示；虽有 `agent/error` relay + `session-telemetry/record`，但无 UI 消费面。

## 6. Options

- **A. 直接采用 OpenClaw dashboard**：不可行。OpenClaw 的 board/dashboards 是 gateway 内嵌的 Lit SPA + agent 自建 widget 沙箱，非可移植插件；与 DSH 的 Cordis/slot 模型不匹配。
- **B. 仅做 usage 仪表盘**：可先靠社区 `dsh-usage-dashboard` 类插件覆盖 usage/cost，但对 agent/errors/jobs 聚合无解。
- **C. 自建 DSH 控制面面板**（BEST）：以官方 Slots 扩展点新增 1–2 个 `conversation.view`/`shell.overlay`/`details` 面板，直接消费现成数据面（`session/event`、`ctx.jobs`、token-meter、`session-telemetry`、plugin-inventory），做成 agent/jobs/errors/usage 的运行态总览 + memory/files 只读浏览。

## 7. Recommendation

主 Recommendation：**BUILD** — 基于官方 Slots/插槽 + 现成数据面自建 DSH 控制面面板，而不是套用或依赖 OpenClaw dashboard。

子项动词表：

- **BUILD** `agent+runtime 运行态总览` — 消费 `session/event`（`turn/*`、`agent/error`）与 `agent/*` 事件，做活跃/完成 run、健康度、错误列表；OpenClaw 只提供范式（headline/rail），需新建。
- **BUILD** `全局 jobs 聚合面板` — `ctx.jobs` 已可全局列举，缺跨会话聚合 UI；比 ui-jobs 弹层升一级。
- **BUILD** `usage/cost 仪表盘（官方内置）` — token-meter + `assistant/message.usage` 数据面现成；可吸收社区插件思路，避免依赖第三方动态插件。
- **ADAPT** `plugins 管理面板` — 扩展 `ui-cordis`/`plugin-inventory`：把只读 inventory 升级为「运行中插件 → 会话/服务/错误」关联视图。
- **ADAPT** `memory/files 只读浏览` — 复用 `ui-skill` 与 workspace 目录流，补记忆投影与文件预览面板（skill/`session-projection` 数据面已有）。
- **DEFER** `OpenClaw 式 agent 自建 widget 网格`（`dashboards.md` 的 board/docked chat）— 与「控制面监控」目标不同，成本高、非首要。
- **ADOPT** `trajectory / session 列表已具备能力` — 直接沿用官方 `ui-trajectory`、`ui-workspace`，不重写。

理由：DSH 官方已提供 session/trajectory/workspace/jobs/plugins/settings 的主要只读/交互面，且数据面（event log、token-meter、telemetry、jobs、plugin-inventory）全部齐备；真正的缺口集中在「agent 运行态 + errors + 全局 jobs + 官方 usage + memory 浏览」这类控制面监控面板，正适合用官方 Slots 扩展点增量 BUILD，复用现成 host 服务而非另起炉灶或移植 OpenClaw。

## 8. Open questions

1. Agent Core 所需控制面板的**目标用户**是谁——供人工运维查看，还是复用给上层编排读运行态？（决定 `agent/*` 事件是否要投影为可持久化/可聚合的面板数据，而不只是浏览器内联渲染。）
2. usage/cost 面板的**数据归属**：tokens 来自 DSH 会话日志（审计/计费正确），余额来自 DeepSeek API；跨 provider（pi-ai 等非 DeepSeek）费用估算是否在范围内？
3. 「全局 jobs 聚合」是否要**跨进程/多副本**聚合（当前 `ctx.jobs` 为进程内）——单进程 web 面板足够，还是要像 OpenClaw 的 gateway 那样背后接同一个运行态存储？
