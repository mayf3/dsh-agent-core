---
status: historical
as_of: 2026-08-15
superseded_by: ../../guides/scheduler.md
public: PUBLIC_AFTER_SANITIZE
---

> HISTORICAL ENGINEERING RECORD
>
> This document describes the system as of 2026-08-15.
> It is **not** current architecture documentation.
>
> Current documentation: [docs/guides/scheduler.md](../../guides/scheduler.md)

# SCHEDULER_PRODUCTION_CUTOVER_CLOSURE_V1 — 收口报告

> 生产运行态收口任务：确认 Agent Core Scheduler caller migration 之后的现网状态，
> 只允许两种结果 —— Path A（resident Scheduler ready → 最小 resident mount + 真实 fixture）
> 或 Path B（resident 未 ready → 立即恢复 caller 到 OpenClaw）。
>
> 约束落实：不重新设计 Scheduler、不重新做 caller audit、不碰 Auth/Broker/Workflow/
> Forum/Kernel；不建设 Scheduler V2 / 新 Router / 新 outbound / cancellation framework /
> OpenClaw CLI compatibility layer。CONFIG_GET_DEPENDENCY 保持 READ_ONLY_RPC_FALLBACK。

## 最终结论

```
SCHEDULER_PRODUCTION_CUTOVER_CLOSURE_V1 = ROLLED_BACK

LIVE_CALLER_VERSION            = OPENCLAW (v5 / pre-migration restored 2026-08-15 12:52)
AGENTCORE_RESIDENT_RUNNING     = NO
AGENTCORE_NEW_JOBS_PRESENT     = YES → 5 orphaned jobs found, cleaned to 0 (12:52)
AGENTCORE_NEW_JOBS_EXECUTED    = NO (no resident executor existed; 5 jobs never executed)
MISSED_JOB_EVIDENCE            = 5 workflow-dispatch jobs (due 2026-08-15 12:58:53 CST)
                                  had no executor; recovered via re-dispatch by the
                                  restored OpenClaw health checker instead

ACTION                         = ROLLBACK_CALLERS_TO_OPENCLAW

WORKFLOW_LIVE_CHAIN            = launchd com.openclaw.<redacted> (30min)
                                  → restored unified-dispatcher.py / check-dispatch-health.py
                                  → openclaw cron add → ~/.openclaw/cron/jobs.json
                                  → OpenClaw gateway (com.openclaw.<redacted> PID 31652)
                                  → agentTurn → runs/ records
FORUM_LIVE_CHAIN               = launchd com.openclaw.<redacted> (60min)
                                  → restored forum-scheduler.sh v5
                                  → openclaw cron add → jobs.json → gateway → agentTurn

STOCK_CUTOVER_SCHEDULER_READY  = NO

SCHEDULER_CORE_CHANGE          = NONE
ROUTER_CORE_CHANGE             = NONE
AUTH_CHANGE                    = NONE
BROKER_CHANGE                  = NONE
KERNEL_CHANGE                  = NONE
```

## 1. 真实现场调查（2026-08-15 12:43–12:53 CST，全部为直接检查，非报告推测）

### 1.1 三个 caller 的真实运行版本

| caller | 部署路径 | 迁移前 bak（12:12:48 保存） | 实测运行版本（恢复前） | 恢复后 |
|---|---|---|---|---|
| forum-scheduler.sh | `~/.openclaw/cron/scripts/forum-scheduler.sh` | `forum-scheduler.sh.bak-caller-migration-v1-20260815-121248` | **v6**（agentcore-cron add/list/rm；store=`~/.agent-core/scheduler/jobs.json`） | **v5**（openclaw cron add/list + jobs.json 直读清理） |
| unified-dispatcher.py | `~/.openclaw/groups/workspace-oc_<redacted>/skills/cron-domain-scheduler/scripts/unified-dispatcher.py` | `unified-dispatcher.py.bak-caller-migration-v1-20260815-121248` | **migrated**（agentcore-cron add；dedup 读 agentcore store） | **pre-migration**（openclaw cron add --at） |
| check-dispatch-health.py | 同目录 `check-dispatch-health.py` | `check-dispatch-health.py.bak-caller-migration-v1-20260815-121248` | **migrated**（agentcore-cron add/rm） | **pre-migration**（openclaw cron add；jobs.json 死 job 清理） |

证据：恢复前逐文件 grep 确认 `AGENTCORE_CRON` / `agentcore-cron add` 写面；备份文件
grep 确认 `openclaw cron add` 写面。迁移代码本身（v6/migrated 版）已另行保存为
`*.bak-caller-migration-v1-live-20260815-125213`，未丢失。

### 1.2 launchd daemon 状态（system 域，`launchctl print system`）

```
37723  0  com.openclaw.<redacted>
31652  0  com.openclaw.<redacted>            ← OpenClaw 网关（执行 cron job 的进程），RUNNING
   0   0  com.openclaw.<redacted>    ← 已加载，周期触发（日志显示 ~每小时：10:41/11:42/12:43），上次 exit=0
   0   0  com.openclaw.<redacted> ← 已加载，周期触发（日志显示 ~每 30 分钟：…/11:43/12:13/12:43），上次 exit=0
```

三个 daemon 均为 ACTIVE（加载于 system 域；PID=0 表示周期型任务当前不在执行瞬间，
非未加载）。另外 `com.openclaw.<redacted><uid>`(5335)、`com.openclaw.<redacted>`(64953)、
`com.openclaw.<redacted>`(64950) 在线。

### 1.3 是否已向 `~/.agent-core/scheduler/` 写入新 job —— 是（且这正是风险实证）

- `~/.agent-core/scheduler/jobs.json`（8508 B，<svc-user>:staff，12:43 写入）含 **5 个
  workflow-dispatch job**，全部 `schedule.kind=at`、`deleteAfterRun=true`，
  due = `2026-08-15T04:58:53Z`（= 12:58:53 CST，即 12:43:53 的迁移版
  check-dispatch-health `--fix` 创建，`+15m`）：
  product-manager / arch-reviewer / article-publisher-agent / content-ops-agent /
  build-in-public-agent。
- 来源：`com.openclaw.<redacted>.log` 12:43:52 运行（迁移版）Step 2
  `⚡ Re-dispatched 5 agent(s)` 全部写入 Agent Core store。
- 同一运行的 forum-scheduler v6（12:43:17）无新触发（未读清零）。

### 1.4 谁在消费/tick/execute 这些 Agent Core job —— 没有人

- `ps aux`：无任何 `scheduler` / `agentcore` node 进程（唯一匹配是 Android 模拟器 AVD
  名为 agentcore，无关）。
- `launchctl list` + `~/Library/LaunchAgents/*.plist` + `/Library/LaunchDaemons/*.plist`
  全量 grep：没有任何 Agent Core Scheduler engine 的 launchd 条目；
  `com.agent-core.*` plist 均未加载（且指向另一项目 `/workspace/project/agent-core`，
  与本 repo 无关）。
- `crontab -l`：无 agentcore 条目。
- `agentcore-cron` CLI（`/usr/local/bin/agentcore-cron` → `scripts/agentcore-cron.mjs`）
  是 **control-only**：自身注释明确「never instantiates the scheduler engine and can
  never execute a job or run startup catch-up」。store 锁内 mutate 只负责增删改查。

结论：5 个 job 在 12:58:53 到期时无任何执行者 —— 正是任务禁止的
「daemon → agentcore-cron add → job 入库 → 没有人执行」黑洞。**MISSED_JOB_EVIDENCE = 实证。**

### 1.5 是否存在 resident Scheduler process —— 不存在（同 1.4）

### 1.6 最近新增的 Agent Core job 是否执行过 —— 否

`~/.agent-core/scheduler/jobs.json` 中 5 个 job 均无 `state.lastRunAtMs/lastStatus`；
Agent Core store 无 run log（store 同目录无 runs 文件；JobStore run log 未被任何进程打开）。
直到 12:52 清理前，5 个 job 保持 created-only 状态。

### 1.7 是否已出现遗漏的 workflow/forum 唤醒 —— 是（workflow 侧）

- 12:43:53 迁移版 check-dispatch-health 创建的 5 个 Agent Core job 到期后无人执行 →
  product-manager / arch-reviewer / article-publisher-agent / content-ops-agent /
  build-in-public-agent 的本次 workflow 唤醒全部未发生（job 因 `deleteAfterRun` 语义
  本会被执行器删除，此处是「从未执行」）。
- 恢复路径：rollback 后由（旧版）check-dispatch-health 的 stale>2h 规则在下一运行重新
  补触发到 OpenClaw cron（见 §3）。
- Forum 侧：12:43 v6 运行无新触发；11:42 v5 触发的 2 个 OpenClaw forum job
  （podcast-producer / writing-style-analyst）在 12:38 完成 status=ok —— forum 无遗漏。

## 2. 为什么不是 Path A —— resident mount 判定

Path A 的前置「当前代码已经具备足够的常驻运行入口」：

- Scheduler 引擎（`packages/scheduler/src/scheduler.js`，tick/start/catchup/no-dup/
  backoff 语义完整）+ scheduler-router 桥（`createRouterInvoker` +
  `createFeishuDeliver`）+ Router → DSH 进程链，已在
  SCHEDULER_ROUTER_FINAL_INTEGRATION_V1 中用 fixture Agent 真实验证
  （16/16 PASS，real DSH process / real model / real Feishu send）。
- **但生产 resident mount 不成立**：
  1. 无生产 Control Plane：`~/.dsh/bindings/bindings.json` 不存在；无任何已加载的
     agent-core launchd；生产 agent（product-manager 等）全部由 OpenClaw gateway
     （PID 31652）管理，Agent Core Router 的 registry/workspace-bootstrap 只认识
     demo runtime（`.demo/…`）中注册的 agent。
  2. 若把 resident engine 挂到生产 store：`createRouterInvoker(router, {registry})`
     对未注册 agent 返回 AGENT_NOT_FOUND error 或 `ensureRunning` 直接为任意 agentId
     spawn 一个全新 demo DSH 进程（空 home、无凭据的「幽灵 agent」）—— 两种结果都会
     把生产 job 标记为 error/删除，生产 agent 永远收不到唤醒。**不是安全 mount。**
  3. 结论：组件 ready，生产接线不 ready。STOCK_CUTOVER_SCHEDULER_READY = NO。

因此按任务规则「如果没有真实 resident execution 证据，宁可 ROLLBACK」，选择
**Path B**，不维持半迁移状态。

## 3. 已执行的恢复（ROLLBACK_CALLERS_TO_OPENCLAW）

### 3.1 恢复三个 caller（12:52:13 CST）

```bash
TS=20260815-125213
# 1) 迁移版（v6/migrated）live 文件保留副本，不丢代码：
cp -p forum-scheduler.sh           forum-scheduler.sh.bak-caller-migration-v1-live-$TS
cp -p unified-dispatcher.py        unified-dispatcher.py.bak-caller-migration-v1-live-$TS
cp -p check-dispatch-health.py     check-dispatch-health.py.bak-caller-migration-v1-live-$TS
# 2) 从迁移前保存的备份恢复：
cp -p forum-scheduler.sh.bak-caller-migration-v1-20260815-121248  forum-scheduler.sh
cp -p unified-dispatcher.py.bak-caller-migration-v1-20260815-121248 unified-dispatcher.py
cp -p check-dispatch-health.py.bak-caller-migration-v1-20260815-121248 check-dispatch-health.py
# 3) 恢复 forum-scheduler.sh 的 ACL（launchd 以 UID505 <svc-user> 执行；bak 无 ACL）：
chmod -E forum-scheduler.sh <<EOF
user:yanfenma allow read,execute,readattr,readextattr
user:<svc-user> allow read,write,append,readattr,writeattr,readextattr,writeextattr
EOF
```

### 3.2 清理 Agent Core store 孤儿 job（12:52:27 CST）

- 先备份：`jobs.json → jobs.json.bak-closure-v1-20260815-125227`（保留 5 个孤儿 job
  的完整原始内容作为证据）。
- `agentcore-cron rm` 逐个删除 5 个孤儿 job（store 现在 0 job，不再有黑洞残留）。
- 部署 seam（`~/.agent-core/scheduler/`、`/usr/local/bin/agentcore-cron` 符号链接）保留
  不动 —— 下次正式 cutover 直接复用。

### 3.3 恢复后验证

- 三个文件恢复为 pre-migration 版本（版本头 + `openclaw cron add` 写面 grep 确认；
  sha256 与备份逐字节一致）。
- 12:52:55 手动执行 `workflow-dispatcher-launchd.sh`（恢复版）：
  - Step 1 unified-dispatcher.py（旧版）正常执行（token 读取受限属 yanfenma 身份
    限制，daemon 以 <svc-user> 运行时有凭据；见 12:13 日志对照）；
  - Step 2 check-dispatch-health.py --fix（旧版）**成功读写 `~/.openclaw/cron/jobs.json`**
    （`🧹 Cleaned 3 dead workflow-dispatch job(s) from jobs.json`，jobs.json mtime 12:52）；
  - Step 3 audit-agent-credentials 的 PermissionError 为恢复前就存在的旧行为（12:13
    日志同款），与迁移无关。
- 12:52:56 之后 agentcore store 无任何新写入（store job 数 = 0）。

### 3.4 launchd 自动运行实证（恢复后的 caller 已回归 OpenClaw 写面）

**workflow-dispatcher daemon 13:13:55 运行（恢复版，<svc-user>，`com.openclaw.<redacted>.log`）：**

- Step 1 unified-dispatcher.py：capability preflight，0 触发，exit=0；
- Step 2 check-dispatch-health.py --fix：检测 2 个 stale agent →
  **`openclaw cron add` 成功写入 2 个新 job 到 `~/.openclaw/cron/jobs.json`**：
  - `74c8436f-80ff-45f5-9332-d2cb21166d42` workflow-dispatch-arch-reviewer-1786770836
    （enabled=true, at=05:28:58Z）
  - `629c0193-83bc-42dd-a6c6-4fce5522094e` workflow-dispatch-build-in-public-agent-1786770842
    （enabled=true, at=05:29:04Z）
- Step 3 audit-agent-credentials：pre-existing PermissionError（同 12:13），exit=1。
- 同一时段 agentcore store 保持 0 job（不再有写入、不再有黑洞）。

**完整闭环实证（恢复 caller → OpenClaw 写面 → gateway 执行 → 真实业务推进）：**
13:13:55 daemon 写入的 2 个 job 于 13:29:25 由 gateway 执行，13:35:17 全部
**finished status=ok**（`~/.openclaw/cron/runs/74c8436f…jsonl`、`629c0193…jsonl`）：
- `74c8436f`（arch-reviewer）：处理 arch_analysis 架构梳理任务 →
  提交 `advance-pm-review` transition，state version 2→3（submission 38f40269）；
- `629c0193`（build-in-public-agent）：核查 GitHub 发布（PR #21）→ 创建掘金/CSDN/知乎
  3 个分发实例 → `advance-to-verification`，state version 9→10。

**forum-scheduler daemon 13:43:22 运行（恢复版 v5，<svc-user>，`forum-scheduler.log`）：**
- `[CLEANUP]` 走 v5 的 jobs.json 直读清理路径（jobs.json.bak 的 PermissionError 与
  10:41/11:42 迁移前运行同款，非回归）；`[SETUP] Cached 130 existing cron jobs`
  （从 `~/.openclaw/cron/jobs.json` 读取 OpenClaw 写面）；扫描 26 agents 无未读
  → triggered=0, idle=26, exit=0。
- 即：恢复版 v5 已通过 launchd 回归 OpenClaw 写面（若有未读将走
  `openclaw cron add`，11:42 运行已实证该路径成功触发并被 gateway 执行 status=ok）。

## 4. OpenClaw 现网执行链证据（恢复目标态）

- `com.openclaw.<redacted>` RUNNING（PID 31652）；`com.openclaw.<redacted><uid>`（5335）。
- OpenClaw 正在执行 workflow-dispatch job：12:30:48 gateway `cron: job created` ×5；
  `openclaw cron list` 显示 5 个 `workflow-dispatch-*` job 状态 **running**（agentTurn
  执行中，isolated session）。
- 这 5 个 job 于 12:58:28 全部 **finished status=ok**（`~/.openclaw/cron/runs/*.jsonl`，
  <svc-user> 写入），其中包含真实 workflow 业务推进：
  - `dd4b9589`（content-ops-agent）：CSDN 发布验证通过（HTTP 200 + 内容核对）→
    提交 `verified` transition → 实例推进「已完成」终态（state version 3→4）；
  - `89f685bf`（content-ops-agent）：掘金发布验证通过 → 工作流推进至终态 done；
  - `1c4c8bc6`（cto-agent）/ `2099afb1` / `8d0c7f4a`（build-in-public-agent）：
    无待办任务，安静结束（status=ok）。
- `~/.openclaw/cron/runs/*.jsonl` 记录到 12:38（含 11:42 forum 触发的
  podcast-producer-agent job 12:38 status=ok）。
- 恢复后的 caller 自动运行已确认：workflow-dispatcher 13:13:55（恢复版）已通过
  `openclaw cron add` 写入 2 个新 workflow-dispatch job（见 §3.4），gateway 将按
  at=13:28:58/13:29:04 执行；forum-scheduler 恢复版 v5 下一次运行 ≈ 13:43。

## 5. 重要边界声明

- 未触碰：`packages/scheduler/**`、`packages/agent-router/**`、Auth、Broker、Workflow、
  Forum、Kernel；无 Scheduler V2 / 新 Router / 新 outbound / cancellation framework /
  OpenClaw CLI compatibility layer；CONFIG_GET_DEPENDENCY 保持现状。
- feature branch `feat/scheduler-caller-migration-v1`（72dca80）保留未动，迁移代码完整。
- 预存问题（与迁移无关，本次不修）：OpenClaw 侧对部分 workflow job 存在
  `[plugins] [openclaw-auth-broker] no adapter implementation for capability
  "workflow_instance_detail"`（12:13 旧版运行同款失败，属 OpenClaw/Broker 能力适配缺口）。

## 6. 下次正式 cutover 的前置条件（建议，不在本次范围）

1. 生产 Control Plane：Agent Registry + Router 接入生产 agent（agent-session-v1 /
   agent-registry-v1 工作线），或 Router 能 attach 到 OpenClaw gateway 的 agent 运行时；
2. 以此为前提重新评估 resident mount（engine + scheduler-router 桥已就绪，约 10 行接线）；
3. 在 production store 上跑通 fixture → 真实 DSH turn → run record → 重启恢复，再切换 caller。
