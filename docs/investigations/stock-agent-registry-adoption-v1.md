# STOCK_AGENT_REGISTRY_ADOPTION_V1 — live survey (investigation)

> 任务：`STOCK_AGENT_REGISTRY_ADOPTION_V1` — 让 Agent Core Registry 正式识别真实生产
> stock-agent，并由 Resident/Router 旁路拉起真实 DSH 进程。**adoption，不是 cutover。**
> 日期：2026-08-15 · 方法：直接检查现网，不凭旧报告（本文件全部事实均为现场核实）。

## 0. 结论摘要

| 项 | 现场核实值 |
|---|---|
| OpenClaw agent id | `stock-agent` |
| OpenClaw 显示名 | `股票分析师` |
| Business workspace | `/Users/yanfenma/.openclaw/groups/workspace-oc_0480991b97f1e27c96514ac66b4f122c`（候选路径**确认属实**） |
| 生产承载 | `openclaw-gateway`（LaunchAgent `ai.openclaw.gateway`，端口 18789，PID 31652，运行中）+ `com.openclaw.agent-node-502` + 监控（auto-repair / control-api 18790） |
| Model | primary `zai/glm-5.2`，fallback `opencode-go/deepseek-v4-flash` / `deepseek/deepseek-v4-flash`（`openclaw.json agents.list` + per-agent `models.json`） |
| Skills | OpenClaw skills 位于 `~/.openclaw/skills/`（agent-lifecycle、agent-principal-lookup、workflow-system 等）；DSH user skill root `~/.agents/skills/` 独立存在 |
| Runtime/session | `~/.openclaw/agents/stock-agent/sessions/`（199 项，含 sessions.json） |
| Feishu binding | `feishu group oc_0480991b97f1e27c96514ac66b4f122c`（`openclaw.json bindings`） |
| Scheduler jobs | `~/.openclaw/cron/jobs.json` 中 stock-agent 共 **7 个 job**（见 §5） |
| Credentials | **本任务不读取、不复制、不修改**（WAIT_ROOT；`openclaw.json` 内 apiKey/appSecret/gateway token、`agents/stock-agent/agent/auth-profiles.json` 均未读取值） |

## 1. 生产拓扑（现场核实）

```
ai.openclaw.gateway (LaunchAgent, openclaw gateway --port 18789, HOME=/Users/yanfenma)
  └─ 读 ~/.openclaw/openclaw.json（87 个 agent，含 stock-agent）
  └─ 读 ~/.openclaw/cron/jobs.json（OpenClaw cron 引擎在 gateway 进程内）
com.openclaw.agent-node-502 (LaunchAgent, openclaw node run --port 18789)
com.openclaw.auto-repair + com.openclaw.control-api (LaunchAgents, monitors)
com.openclaw.forum-scheduler / com.openclaw.workflow-dispatcher / com.openclaw.host-exec-runner (LaunchDaemons)
```

- gateway 进程持续处理真实 `node.invoke` 流量（日志 2026-08-15 14:36–14:37 仍有响应）。
- 迁移任务（caller migration）已 ROLLED_BACK：调用方仍走 OpenClaw cron（`rollback-callers-to-openclaw-v1.sh`
  已入 main）；本次 adoption **不改动** 上述任何 launchd 条目与脚本。

## 2. identity/config（Registry 只保存这些的稳定子集）

`openclaw.json → agents.list` 中 stock-agent 记录（**非** credential 字段）：

```json
{ "id": "stock-agent",
  "name": "股票分析师",
  "workspace": "/Users/yanfenma/.openclaw/groups/workspace-oc_0480991b97f1e27c96514ac66b4f122c",
  "model": { "primary": "zai/glm-5.2",
             "fallbacks": ["opencode-go/deepseek-v4-flash", "deepseek/deepseek-v4-flash"] },
  "tools": { "alsoAllow": ["okr_read","workflow_assistance","workflow_execute",
                           "workflow_read","forum_read","forum_write"] } }
```

- per-agent 模型配置：`~/.openclaw/agents/stock-agent/agent/models.json`（providers:
  qwen-portal / zai / opencode-go / deepseek / xiaomi-coding / agnes / codex / ollama；apiKey 已脱敏，未读取值）。
- `~/.openclaw/agents/stock-agent/agent/auth-profiles.json` 属 credential 面（WAIT_ROOT），未读取。
- **Adoption 边界**：Agent Core Registry 记录只含 `id/name/description`（D-002 身份/展示字段），
  由 `AgentRegistry.registerAgent` 生成不透明 `agt_` id；Feishu chatId、forum/workflow role、
  stock policy、credential 一律不进 Registry。

## 3. business workspace（可复用，只读）

`/Users/yanfenma/.openclaw/groups/workspace-oc_0480991b97f1e27c96514ac66b4f122c` 现场核实内容：

- 身份面：`AGENTS.md`（6.2KB，8-15 03:34 更新）、`SOUL.md`、`IDENTITY.md`、`USER.md`、`GUIDE.md`
- 业务面：`STOCK_SELECTION_STRATEGY.md`、`TRACKING.md`（66KB）、`WATCHLIST.md`、`TODO.md`、
  `PROGRESS.md`、`MEMORY.md`（13KB）、`memory/`、`references/`、`reports/`、`quant/`、`quant-platform/`
- 状态面：`.git`（OpenClaw 维护，最近 commit「Sync scheduled stock analysis rules」）、
  `.env` / `.todo-client-jwt`（**credential 面，未读取**）、`.openclaw/workspace-state.json`
- 无目录级 lock 文件（无 `.git/index.lock`）；OpenClaw 侧不存在对该目录的排他锁。

## 4. 双运行并行安全分析（§4 输出）

| 风险面 | 判定 | 依据（现场核实） |
|---|---|---|
| workspace 双写 | **复用但只读** | OpenClaw 侧活跃写（memory/、TRACKING.md、git commit）；Agent Core 侧 DSH 子进程以该目录为 cwd，canary 强制「不写文件、不调用工具」，DSH 启动不写 cwd（session 落 DSH_HOME） |
| session/runtime 双写 | **不冲突** | OpenClaw session：`~/.openclaw/agents/stock-agent/sessions/`；Agent Core session：`<runtime>/homes/<agt_id>/sessions/`，完全隔离 |
| DSH_HOME 冲突 | **不冲突** | Agent Core 子进程 DSH_HOME = `<runtime>/homes/<agt_id>`（全新目录）；与 `~/.dsh`（GUI）、`~/.openclaw*` 无关 |
| lock 冲突 | **不冲突** | 无共享 lock 文件；Agent Core 控制面锁只在自己的 `<runtime>/control/` 内；OpenClaw 无目录锁 |
| PID/process ownership | **不冲突** | Agent Core 拉起自己的 DSH child（resident 进程树内）；OpenClaw gateway/node 进程不动（PID 校验门） |
| 端口 | **不冲突** | demo-server 走 stdio JSON-RPC，无端口绑定；无共享端口 |

**结论：`OPENCLAW_AGENTCORE_PARALLEL_SAFE = WITH_RUNTIME_ISOLATION`**
（business workspace 复用、read-only；runtime / DSH_HOME / session 全部 Agent Core 独立。）

## 5. Scheduler jobs（现状只读，不改）

`~/.openclaw/cron/jobs.json` 中 stock-agent 的 7 个 job（2026-08-15 现场）：

| id | name | schedule (Asia/Shanghai) | enabled | delivery |
|---|---|---|---|---|
| 0876ced5-… | 每周一收盘后更新股票价格跟踪 | `40 3 * * 1` | true | announce → chat:oc_0480… |
| 3649529b-… | 商业分析每日学习 | `20 1 */2 * *` | true | none |
| 464a1900-… | 股票研究自进化 - 23点起每小时 | `0 23,0-8 * * *` | **false** | announce → chat:oc_0480… |
| 9abe6e6d-… | 股票分析学习 | `25 1 * * *` | true | announce → chat:oc_0480… |
| stock-agent-biweekly-check | 应用检查 - stock-agent | `00 4 1,15 * *` | true | announce → chat:oc_0480… |
| stock-agent-weekly-review | 周内化 - stock-agent | `15 3 * * 6` | true | announce → chat:oc_0480… |
| stock-daily-market-brief-001 | 每日市场简报 - AI/科技/指数行情 | `44 2 * * 1-5` | true | announce → chat:oc_0480… |

本任务不在 `~/.openclaw/cron/jobs.json` 写任何 job（canary job 只写入 Agent Core runtime store）。

## 6. Feishu binding（现状只读，不改）

`openclaw.json bindings`：`stock-agent → feishu group oc_0480991b97f1e27c96514ac66b4f122c`
（与 workspace 后缀相同，OpenClaw 约定）。binding 属 OpenClaw 配置面，本任务不读值入 Registry、
不修改、不迁移。canary job 使用 `--no-deliver`，且验证脚本不调用任何 Feishu 发送。

## 7. Agent Core 侧可复用机制（零 core 修改）

- `scripts/agent-core-resident.mjs`（main=6d1cc77 原样）：加载 `<runtime>/control/registry.json`，
  **只 load 不注册**；scheduler tick → `createRouterInvoker` → `Router.ensureRunning(agentId)` →
  per-agent DSH child（`dsh --profile agent-core-demo`，cwd=workspace，DSH_HOME=home）→ native session。
- workspace 映射：`workspace-bootstrap` 通用映射 `<workspaceRoot>/<agentId>`；adoption 通过
  操作层 symlink `<runtime>/agents/<agt_id>` → 真实 workspace 复用业务目录（**不改代码、不拷贝 workspace、
  不建 stock-agent-v2、不新增 Registry 字段**）。
- DSH_HOME 由通用 provisioner（`demo-home.mjs provisionAgentHome`）从 `~/.dsh/settings.yaml` +
  `.credentials.yaml` 安装模型路由（opencode-go/deepseek-v4-flash，与本 GUI 同路由）。

## 8. 已知观察（非本任务修改范围）

- `scripts/agent-core-resident.mjs` 的 feishu recording-seam fallback 缺少 `setCallback`，
  在凭证缺失时会崩（router 要求该接口）。本任务**不修改**（RESIDENT_CORE_CHANGE=NONE），
  验证按既有已接受行为走 live connector（DSH test-bot 凭证，canary 零发送）。
- DSH 子进程（agent-core-demo profile）不会继承 OpenClaw skills 目录（`~/.openclaw/skills`）；
  V1 adoption 的身份面 = 真实 workspace 的 AGENTS.md + `~/.agents/skills`（DSH user root）。
  技能/工具对等属后续 canary/cutover 阶段。
