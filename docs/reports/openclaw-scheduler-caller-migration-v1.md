# OpenClaw → Agent Core Scheduler 调用方迁移 V1 — 报告

> 分支：`feat/scheduler-caller-migration-v1` · 日期：2026-08-15
> 范围：三个 ACTIVE OpenClaw cron writers（forum-scheduler.sh /
> unified-dispatcher.py / check-dispatch-health.py）的最小调用方迁移；
> 不重新调查 Scheduler、不建设 CLI compatibility layer、不实现 Scheduler V2 /
> 新 dispatcher / 新 Forum scheduler / 新 Workflow / Broker-Auth redesign /
> Kernel change。
> 实证调查：`docs/investigations/openclaw-scheduler-caller-migration-v1.md`。

## 1. 迁移了什么（实际执行路径）

三个 launchd daemon 脚本本体（`~/.openclaw/…`，均以 authsvc/UID505 运行）的
cron 写面，逐调用点迁移到 Agent Core Scheduler（`agentcore-cron` CLI +
`AGENTCORE_SCHEDULER_STORE`，默认 `~/.agent-core/scheduler/jobs.json`）：

| 脚本 | 迁移前 | 迁移后 |
|---|---|---|
| forum-scheduler.sh（v5→v6） | `openclaw cron list --json`；`openclaw cron add --at …`；python 直读直写 `~/.openclaw/cron/jobs.json`（死 job 清理） | `agentcore-cron list`；`agentcore-cron add`（flag 1:1）；`agentcore-cron list + rm`（锁内 mutation authority） |
| unified-dispatcher.py | 两处 `openclaw cron add`；`get_cron_jobs()` 直读 `~/.openclaw/cron/jobs.json`（查重） | `agentcore-cron add`；直读 agentcore store（格式同构，查重语义不变） |
| check-dispatch-health.py | 一处 `openclaw cron add`；直读 jobs.json；Step 4 直写 jobs.json（死 job 清理） | `agentcore-cron add`；直读 agentcore store；`agentcore-cron rm` 清理（含 .bak 备份） |

部署侧配套（最小、可审计）：

- `/usr/local/bin/agentcore-cron` 符号链接 → repo `scripts/agentcore-cron.mjs`；
- `~/.agent-core/scheduler/` 建立 + authsvc ACL（`~/.agent-core` search ACL +
  scheduler 目录全量 `file_inherit,directory_inherit`，镜像 `~/.openclaw/cron`
  既有授权模式）；
- forum-scheduler.sh 编辑后原样恢复文件级 authsvc ACL（原子替换会新建 inode）。

未改动：业务逻辑、任务判断、dispatch 语义、Forum 未读查询、Broker/Auth、
`packages/**`（SCHEDULER_CORE_CHANGE = NONE）、Kernel。

## 2. 验证证据（fixture / 安全测试目标，未触碰生产写面）

驱动：`scripts/scheduler-caller-migration-v1-verify.mjs`（本分支）。
隔离手段：所有 cron 写入 → 临时 sandbox store；`openclaw` → 记录型 stub（任何
残留调用都会被记录并失败）；生产 `~/.openclaw/cron/jobs.json` 只读（md5 +
stock-agent 清单前后对比）。另做了一次生产 store 路径 add→rm 全周期（结束后
jobs.json/runs/lock/bak 全部清除，import 守卫不受影响）。

```
FORUM_STOCK_MEMBERSHIP = PASS   (scope=26 agents; stock-agent declared=false -> NO)

── WORKFLOW battery ──
trigger_agent_immediate(fixture-01) = dispatched (+15m native one-shot timer)
trigger_agent(fixture-02)           = dispatched (+15m one-shot)
trigger_agent_immediate(fixture-01) 再次调用 = recently dispatched (skip)   ← dedup 读 agentcore store
store jobs = 2（workflow-dispatch-*, kind=at, deleteAfterRun=true, enabled=true）
check-dispatch-health.trigger_agent(fixture-03) = OK → store jobs = 3
check-dispatch-health --fix（fixture 配置）: dead=removed, alive=kept, .bak 生成, rc=0
unified-dispatcher main() 真实运行 rc=0（写入限制在 fixture store）

── FORUM battery ──
fixture forum-access（unread=2）+ 真实 domains.yaml/openclaw.json 发现
论坛通知触发 jobs in agentcore store = 26（全部 enabled）；预置 disabled 死 job 被清除
Summary: triggered=26, skipped=0, idle=0, scan_failed=0, errors=0, rc=0

── 完整性 ──
全程 openclaw stub 调用数 = 0
live jobs.json md5 不变；stock-agent 7 条（6 enabled）清单不变
静态扫描：3 个脚本中可执行 `openclaw cron` 引用 = 0（唯一残留：unified-dispatcher.py
的只读 config.get fallback，见 §4）
```

## 3. 最终结果

```
OPENCLAW_SCHEDULER_CALLER_MIGRATION_V1 = PASS

FORUM_STOCK_MEMBERSHIP = NO
WORKFLOW_DISPATCH_WRITES_AGENTCORE = PASS
WORKFLOW_NO_LONGER_WRITES_OPENCLAW = PASS
FORUM_SCHEDULER_WRITES_AGENTCORE = PASS
FORUM_NO_LONGER_WRITES_OPENCLAW = PASS
EXISTING_OPENCLAW_JOBS_UNCHANGED = PASS
CONFIG_GET_DEPENDENCY = READ_ONLY_RPC_FALLBACK（文件不可读时才触发；Agent Core
                       无等价配置权威来源；不新增 Config Service）
STOCK_CUTOVER_CRON_WRITERS = CLEAN

SCHEDULER_CORE_CHANGE = NONE      （packages/scheduler/** 未触碰）
WORKFLOW_CHANGE = NONE            （业务/任务判断/dispatch 语义未触碰；仅 cron 调用面）
FORUM_CHANGE = NONE               （未读查询逻辑、Broker/Auth 未触碰；仅 cron 调用面）
KERNEL_CHANGE = NONE
```

## 4. CONFIG_GET_DEPENDENCY 详细结论

`unified-dispatcher.py::load_gateway_config()` 的 `openclaw gateway call config.get
--json` 是**只读兜底**：主路径是直接读 `~/.openclaw/openclaw.json`（生产可读），
RPC 仅在配置文件不可读时触发，且不写任何东西。Agent Core 目前没有 broker
capability 治理事实（enabledAgentIds / capabilities / tools.alsoAllow）的权威
来源（agent-registry 只持身份字段），任务约束不新增 Config Service → 保持现状并
在代码 docstring 记录结论。该只读依赖随 OpenClaw gateway 在 stock cutover 阶段
退役而消除；它**不是 cron writer**，不阻塞 cutover。

## 5. 部署注意事项（下个阶段）

1. **执行间隙（预期，非本任务缺陷）**：迁移后 daemon 的新增 job 写入
   `~/.agent-core/scheduler/jobs.json`；在 Agent Core Scheduler 引擎常驻
   （Control Plane 注入 invoker + deliver，见 scheduler-replacement-v1 §9）
   之前，新 job 只入库不执行。OpenClaw gateway 继续执行其 jobs.json 内已有 job
   （含 stock-agent 6 个生产 job）。引擎启动属于 stock-agent cutover 阶段，不在
   本任务范围。
2. **存量状态**：forum-scheduler 的 state 文件里若有指向旧 OpenClaw jobId 的
   pending 条目，会在下次运行被正常清除（job 已不存在 → 视为完成）——行为符合
   预期，无需人工处理。
3. **store 目录**：`~/.agent-core/scheduler/` 已建好且 authsvc 可写；当前为空，
   `openclaw-job-import.mjs --write` 的存量守卫不受影响。
4. **回滚**：三个脚本均已保留 `.bak-caller-migration-v1-<ts>` 备份；launchd
   下一轮自动生效（forum 每小时、dispatcher 每 30 分钟）。

## 6. 交付物

- 部署侧（不在 git，报告与调查文档内记录）：三个 daemon 脚本迁移、
  `/usr/local/bin/agentcore-cron` 符号链接、`~/.agent-core/scheduler` + ACL。
- 本分支：`docs/investigations/openclaw-scheduler-caller-migration-v1.md`、
  本报告、`scripts/scheduler-caller-migration-v1-verify.mjs`（7/7 gates PASS）。
