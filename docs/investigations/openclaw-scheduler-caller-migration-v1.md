# OpenClaw → Agent Core Scheduler 调用方迁移 V1 — 实证调查

> 实证调查（investigation）· 只读本机真实脚本与配置。
> 日期：2026-08-15 · 分支：`feat/scheduler-caller-migration-v1`
> 前置：`docs/investigations/scheduler-replacement-audit.md`（job 形态与字段映射）、
> `docs/reports/scheduler-replacement-v1.md`（Scheduler V1 交付）。本文件回答
> 「三个 ACTIVE cron writer 的确切调用点、迁移前后形态、config.get 真实用途、
> 权限面」；本文件不改任何 OpenClaw 配置、不改 `packages/**`。

## 0. 结论速览

| 项 | 结论 |
|---|---|
| ACTIVE cron writers（复核） | 3 个：`forum-scheduler.sh`、`unified-dispatcher.py`、`check-dispatch-health.py`（与 OPENCLAW_ACTIVE_CALLER_AUDIT_V1 一致） |
| `openclaw cron list/add` 调用点 | 全部确认并逐一迁移（见 §2~§4 前后对照） |
| `openclaw gateway call config.get` | **只读 fallback**（文件不可读时才触发）；Agent Core 无等价配置权威来源；不新增 Config Service（详见 §5） |
| stock-agent 是否 forum-scheduler 目标 | **NO**（不在 domains.yaml `forum:broker` 声明集合，见 §6） |
| 执行身份 | 两个 launchd daemon 均以 `authsvc`(UID 505) + `HOME=/Users/yanfenma` 运行（launchctl print 实证） |
| cron 写面落点（迁移后） | `~/.agent-core/scheduler/jobs.json`（AGENTCORE_SCHEDULER_STORE 可覆盖） |

## 1. 三个 callers 的定位与调用点清单

| 脚本 | 路径 | 调用点（迁移前） | 性质 |
|---|---|---|---|
| forum-scheduler.sh v6 | `~/.openclaw/cron/scripts/forum-scheduler.sh` | L142 `openclaw cron list --json`（pending 去重缓存）；L251 `openclaw cron add --at …`（论坛通知触发）；Step 0a 直读+直写 `~/.openclaw/cron/jobs.json`（死 job 清理） | 每小时，launchd `com.openclaw.forum-scheduler`（authsvc） |
| unified-dispatcher.py | `~/.openclaw/groups/workspace-oc_648db8f3…/skills/cron-domain-scheduler/scripts/unified-dispatcher.py` | `trigger_agent()` / `trigger_agent_immediate()` 两处 `openclaw cron add`（workflow-dispatch 一次性 job）；`get_cron_jobs()` 直读 `~/.openclaw/cron/jobs.json`（30 分钟查重）；`load_gateway_config()` fallback `openclaw gateway call config.get --json` | 每 30 分钟，launchd `com.openclaw.workflow-dispatcher`（authsvc） |
| check-dispatch-health.py | 同目录 | `trigger_agent()` 一处 `openclaw cron add`（--fix stale 补触发）；`get_cron_jobs()` 直读 `~/.openclaw/cron/jobs.json`；Step 4 直写 `~/.openclaw/cron/jobs.json`（disabled workflow-dispatch 清理，含 .bak 备份） | 每 30 分钟（--fix 模式） |

`learning-expert-daily-scorecard` 只做 `openclaw cron list` 只读（OPENCLAW_ACTIVE_CALLER_AUDIT_V1 已证），
不在本任务写面；`openclaw session send` 无真实调用者 —— 两者均不迁移。

## 2. forum-scheduler.sh v5 → v6（前后对照）

**v6 头注释 + seam（新增）**：

```bash
export AGENTCORE_SCHEDULER_STORE="${AGENTCORE_SCHEDULER_STORE:-$HOME/.agent-core/scheduler/jobs.json}"
AGENTCORE_CRON="${AGENTCORE_CRON:-agentcore-cron}"
```

**Step 0a 死 job 清理**（v5：python 直读直写 `~/.openclaw/cron/jobs.json`）→ v6：
`agentcore-cron list --json` 过滤 disabled 且 name 含「论坛通知触发」→ 逐个
`agentcore-cron rm <id>`（删除前对 agentcore store 做 `.bak` 备份，与 v5 备份行为
对齐）。走 CLI 而非直写文件，是为了遵守 Scheduler V1 审计 FIX 3 的
**单一 mutation authority**（锁内读改写），常驻引擎运行后也不会互相覆盖。

**Step 1b**（v5：`openclaw cron list --json`）→ v6：`"$AGENTCORE_CRON" list --json`。
输出形态同构（`{"jobs":[…]}`），下游 python 解析逻辑不变。

**Step 3 触发**（v5：`openclaw cron add --agent … --at ${delay_min}m --message … --light-context --no-deliver --session isolated --timeout-seconds 600 --delete-after-run --model … --json`）→ v6：
同一组 flag 换成 `"$AGENTCORE_CRON" add`。jobId 解析（grep `"id"`）不变。

**未改动**：Agent 发现（domains.yaml ∩ broker agentClients）、Forum 未读查询
（forum-access.mjs 调用形态）、错峰/批次/pending 去重、Broker/Auth 读取、fail-visible
退出契约（新增 cleanup_errors 计入 degraded 判定，语义更严）。

**测试性覆盖**（非业务逻辑）：`FORUM_SCHEDULER_STATE_FILE`、`FORUM_ACCESS` 允许
环境变量覆盖，供 fixture 验证隔离真实 state/forum 服务。

## 3. unified-dispatcher.py（前后对照）

- `get_cron_jobs()`：`~/.openclaw/cron/jobs.json` → `AGENTCORE_SCHEDULER_STORE`
  或 `~/.agent-core/scheduler/jobs.json`。文件格式同构（`{version, jobs}`），
  dedup 字段（agentId / name / state.runningAtMs / createdAtMs）在 Agent Core job
  模型中原样存在（`packages/scheduler/src/job-model.js`），**查重语义不变**。
- `trigger_agent()` / `trigger_agent_immediate()`：argv
  `['openclaw','cron','add', …]` → `[AGENTCORE_CRON,'add', …]`，flag 面 1:1。
  `AGENTCORE_CRON` 解析顺序：env → `shutil.which('agentcore-cron')` →
  `/usr/local/bin/agentcore-cron`（launchd PATH 含 /usr/local/bin）。
- 业务逻辑（domain 扫描 / OAuth / workload 查询 / capability preflight /
  MISSING_WORKFLOW_CAPABILITY 判定 / 30 分钟查重 / 触发消息）**零改动**。
- `load_gateway_config()`：**未改动**（见 §5 结论）。

## 4. check-dispatch-health.py（前后对照）

- `get_cron_jobs()`：同上改为 agentcore store。
- `trigger_agent()`：`['openclaw','cron','add',…]` → `[AGENTCORE_CRON,'add',…]`。
- Step 4 死 job 清理：不再直写 `~/.openclaw/cron/jobs.json`；改为从（agentcore
  store 读取的）`jobs` 里收集 disabled workflow-dispatch 的 id → 先备份 store
  （`.json.bak`）→ 逐个 `agentcore-cron rm <id>`。
- 其余（4 项健康检查逻辑、stale 判定、token、auth principal 映射）**零改动**。

## 5. `openclaw gateway call config.get` 单独调查（CONFIG_GET_DEPENDENCY）

**真实用途（读实现确认）**：`load_gateway_config()` 的读取顺序是

1. `OPENCLAW_CONFIG_PATH` 环境变量指向的文件；
2. `~/.openclaw/openclaw.json`（默认路径，**生产可用**：该文件属主 authsvc，
   daemon 身份可直接读）；
3. 两者都不可读时 → 兜底 `openclaw gateway call config.get --json` RPC
   （只读；只解析治理事实：agents.list[].tools.alsoAllow + broker
   capabilities/enabledAgentIds）。

即：**RPC 只在配置文件不可读的退化场景触发，生产路径实际不触发**；且它是只读
RPC，不是 cron writer，不参与本任务「写面清零」的目标。

**Agent Core 是否有等价权威来源**：检查 `packages/agent-registry`（D-002）——
只持身份 + 展示字段（id/name/avatar/description），**不持 broker capability 治理
事实**；scheduler store 只持 job。Agent Core 目前不存在「capabilities /
enabledAgentIds / tools.alsoAllow」的权威来源。

**结论与处理**：任务约束「不因此新增 Config Service」→ 保持现状
（文件读取为主 + RPC 兜底），**不改代码**，仅在函数 docstring 记录调查结论。
报告字段：`CONFIG_GET_DEPENDENCY = READ_ONLY_RPC_FALLBACK（文件不可读时才触发；
Agent Core 无等价配置权威；不新增 Config Service）`。OpenClaw 在 stock-agent
cutover 期间仍运行（`auto-repair-daemon.sh` / `gateway-control-api.js` 属 gateway
运维组件，本任务不处理），该只读依赖可随 gateway 退役一并消除。

## 6. FORUM_STOCK_MEMBERSHIP 实证

按 forum-scheduler.sh 的真实发现逻辑（domains.yaml 声明 `credential_delivery.forum
= broker` ∩ openclaw.json broker `agentClients`）实跑：

- domains.yaml（oc_ddee1a74b…/cron-domain-scheduler/references/domains.yaml）
  声明 `forum:broker`：26 个 agent；
- broker agentClients：87 个；
- 扫描 scope = 26 个 agent；**stock-agent 既不在 declared 集合、也不在 scope**。

```
FORUM_STOCK_MEMBERSHIP = NO
```

（stock-agent 不是 forum-scheduler 的真实目标集合 → 论坛侧迁移对 stock-agent
cutover 无直接联动面；stock-agent 的 6 个生产 job 全部是 OpenClaw jobs.json 内的
cron job，由 OpenClaw gateway 继续执行，与本任务验证互不干扰。）

## 7. 权限面（daemon = authsvc, UID 505）

实证（launchctl print system/…）：
`com.openclaw.forum-scheduler` / `com.openclaw.workflow-dispatcher` 均
`username = authsvc`、`HOME => /Users/yanfenma`、PATH 含 `/usr/local/bin`。

| 面 | 迁移后要求 | 现状 | 处置 |
|---|---|---|---|
| `agentcore-cron` 可执行 | daemon 需在 PATH 解析 | `/usr/local/bin/agentcore-cron` → 符号链接到 repo `scripts/agentcore-cron.mjs`（755，世界可读；node 在 /usr/local/bin） | ✅ 已安装 |
| agentcore store 目录 | authsvc 需读写 | `~/.agent-core` 原为 700/yanfenma，`~/.agent-core/scheduler` 不存在 | ✅ 已建 `~/.agent-core/scheduler`（700），`~/.agent-core` 加 authsvc `list,search,readattr,readextattr` ACL；scheduler 目录加 authsvc 全量 + `file_inherit,directory_inherit` ACL（镜像 `~/.openclaw/cron` 既有授权模式） |
| 脚本可读 | authsvc 读脚本 | 两个 .py 644 世界可读；forum-scheduler.sh 700 + 文件级 ACL（authsvc read/write/append…） | ✅ 编辑后已恢复文件级 ACL（编辑的原子替换会新建 inode 丢失 ACL，已用 `chmod +a` 原样恢复） |
| dispatcher scripts 目录 | authsvc search/list | dir 700 + `group:oc-canary allow list,search`；authsvc ∈ oc-canary 组 | ✅ 无需变更 |

## 8. 验证设计（fixture / 安全测试目标）

`scripts/scheduler-caller-migration-v1-verify.mjs`（本分支新增）：

- **隔离**：所有 cron 写入落临时 sandbox 的 `AGENTCORE_SCHEDULER_STORE`；
  `openclaw` 被 PATH stub 替换（记录调用 + exit 127）→ 任何残留调用既被检测又不
  造成影响；生产 `~/.openclaw/cron/jobs.json` 只读（md5 + stock-agent 清单前后对比）。
- **Workflow**：import 两个 .py 直接调用真实 `trigger_agent_immediate` /
  `trigger_agent`（安全测试目标 agent id `migration-fixture-agent-*`）→ 断言
  agentcore store 收到 workflow-dispatch job（at / deleteAfterRun / enabled）；
  二次调用命中 30 分钟查重（dedup 读 agentcore store）；`check-dispatch-health.py
  --fix`（fixture 空 domains 配置 + 预置 disabled/enabled job）→ 断言死 job 被
  `agentcore-cron rm` 删除、活 job 保留、`.bak` 备份生成；最后跑一次真实
  `unified-dispatcher.py main()`（写仍限制在 fixture store）。
- **Forum**：fixture `forum-access.mjs`（固定 unread=2）+ fixture state 文件 →
  跑真实 `forum-scheduler.sh`（真实 domains.yaml/openclaw.json 发现）→ 断言
  agentcore store 收到 26 个「论坛通知触发」job、预置 disabled 死 job 被清掉、
  state 记录 pending。
- **完整性**：全程 `openclaw` stub 调用数 = 0；`~/.openclaw/cron/jobs.json` md5
  与 stock-agent 7 条（6 enabled）清单不变。
