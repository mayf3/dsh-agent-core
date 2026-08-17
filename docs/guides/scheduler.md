# Scheduler 使用

> status: current · 本页是「cron/at/every 定时任务」的使用 authority。决策记录：
> D-005（`docs/decisions/SCHEDULER_V1.md`）。

## Job 模型（OpenClaw 现网字段的真子集）

- 触发：`cron` / `at` / `every`。
- 投递：`announce`（回群）/ `none` / `silent`；sessionKey 为 opaque 字符串
  （`chat:oc_*` 这类 id 原样存储、不解释）。
- 状态机 + enabled/disabled。

## 执行语义（忠实最小复刻）

- `at` 至多一次；`cron`/`every` 循环 + backoff。
- 停机补跑：每 job 至多一次（启动 catch-up）。
- invoke 前先落 `runningAtMs` 防重复；tick 单飞 + 最新态写回；跨进程锁内
  重读-再应用（单一 mutation authority）；persist 失败 RAM 回滚；import 对已有
  store 默认拒绝。

## 持久化

单文件原子 JSON：`<root>/scheduler/jobs/jobs.json` + `runs.jsonl`
（生产根默认 `~/.agent-core`）。无数据库 / 分布式栈。

## CLI（scripts/agentcore-cron.mjs）

`openclaw cron add/list/runs` 的 1:1 flag 面。**CLI 是纯控制面，永不执行 job**；
执行者是常驻的 Scheduler 引擎（production-runtime，见
[guides/deployment](deployment.md)）。

## 与 Router 的接线

`packages/scheduler-router` 把 scheduler 的注入式 `invokeAgent` seam 接到真实
Router 域面（真实 per-agent 进程 turn），`deliver` seam 接到 Feishu 出站。scheduler
包本身零 DSH 依赖、零 Feishu SDK。

## 迁移

`scripts/openclaw-job-import.mjs --write`：从 OpenClaw 导出导入 job store
（`npm run import:openclaw-jobs`）。

验收：`npm run verify:scheduler`、`npm run verify:scheduler-router-final`、
`npm run test:scheduler` / `test:scheduler-router`。迁移/替换的历史证据见
[docs/history/reports/](../history/reports/)（scheduler-*）。
