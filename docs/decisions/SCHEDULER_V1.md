# D-005: Scheduler Replacement V1 — 最小 job 模型、持久化与执行语义

- 状态: accepted（本 PR 交付范围）
- 日期: 2026-08-15
- 背景: OpenClaw Gateway 内嵌 cron scheduler 是 141 个 enabled job 的唯一执行者
  （其中 90 个要 announce 回飞书群）。关闭 OpenClaw 前必须有一个最小替代执行面。
  实证依据：`docs/investigations/scheduler-replacement-audit.md`（全字段统计 +
  gateway bundle 源码段核对）。
- 决策:
  1. **Job 模型 = 现网字段的真子集**（V1 schema 见
     `packages/scheduler/src/job-model.js`）。只建模有真实使用量的字段；休眠字段
     归一化（顶层 timeoutSec/timeoutMs/runTimeoutMs → payload.timeoutSeconds）或
     丢弃（wakeMode、顶层 everyMs 死数据、systemEvent payload）。
  2. **agentId 必填**。141 条 enabled 中 3 条无 agentId 的 legacy job 在 OpenClaw
     现网本就 broken（runs 实证 sessionId=null / 全 error）——列为迁移数据缺口，
     不扩 schema。
  3. **持久化 = 单文件原子 JSON**（`{version, jobs}`，write-tmp + fsync + rename，
     fail-loud）+ 追加式 `runs.jsonl` 运行日志（默认 10MB 截断）。单写者假设：
     Control Plane 是唯一写者，CLI 提交面走同一原子协议。**不用** Redis / Kafka /
     分布式锁 / K8s CronJob（无多机实证需求，141 job 单进程即可承载）。
  4. **执行语义 = OpenClaw 的忠实最小复刻**（逐条对照 gateway bundle）：
     - 到期：enabled ∧ 无 runningAtMs ∧ now ≥ nextRunAtMs ∧ 非 error-backoff；
     - at 一次性：至多执行一次（成功 → deleteAfterRun 删除，否则 disabled；瞬时
       错误 ≤3 次 30s/60s/5m 重试，永久错误 disabled）；
     - cron/every：每次运行后 next = 严格晚于运行结束的下一次 occurrence；
       error → max(naturalNext, endedAt + backoff(30s/60s/5m/15m/60m))；
     - **重启补跑：任何一次停机每 job 至多补跑一次**（cron 最近一个错过的
       occurrence 且仅当 lastRunAtMs 已存在；at 仅从未跑过时；every 由
       nextRunAtMs 保证）——不重放整段停机期；
     - **崩溃去重**：invoke 前先持久化 runningAtMs；重启跳过 fresh 标记；>2h
       卡死标记清除后可再跑。
  5. **调用缝 = 薄注入 seam**：`invokeAgent({agentId, sessionId?, message, model?,
     lightContext?, timeoutMs?, deliveryTarget?})`。Scheduler 不认识任何 agent：
     V1 用 fake invoker（测试）与 noop invoker（集成桩）。Product Integration /
     Router 的稳定实现后续接线，本 PR 不冻结其 API。
  6. **投递缝 = opaque delivery seam**：`deliver({job, result, text})`；
     `job.delivery.{mode,channel,to}` 原样透传，Scheduler 内**没有** `if feishu`。
     Feishu Connector 后续提供真适配器。
  7. **daemon 提交面**：domain 操作 `submitOneShot`/`createJob`/`listJobs` +
     `scripts/agentcore-cron.mjs`（`add/list/runs/rm/enable/disable`，覆盖
     forum-scheduler / workflow-dispatcher / cron-helper 的全部 `openclaw cron`
     调用点）。本轮不改 daemon 本体。
- 替代方案:
  - 完整复刻 OpenClaw cron API（`cron add --cron --at --every --heartbeat …`）——
    否决：现网只用了 add/list/runs 三个面；多出的面无迁移价值。
  - 用 DSH 原生 `dsh-schedule` —— 否决：只有 every_seconds≥300s 的会话内提醒，
    无 cron 表达式、无绝对 at、无跨会话 job 存储（audit 已证）。
  - 分布式 job 队列 —— 否决：单机单进程即可；引入协调成本无实证收益。
  - 把 announce 目标建模为「agent 绑定群」并让 Scheduler 解析 —— 否决：90 条
    announce 中 4 条指向非绑定群/无 to；Scheduler 应保持渠道无知。
- 影响:
  - `packages/scheduler/**`（新包，零 DSH 依赖，仅 `croner`）；`scripts/` 增加
    `agentcore-cron.mjs`、`openclaw-job-import.mjs`、`scheduler-v1-verify.mjs`；
  - `docs/investigations/scheduler-replacement-audit.md`（字段映射）、
    `docs/reports/scheduler-replacement-v1.md`（最终报告）；
  - 不改 `packages/agent-router/**`、broker、feishu-connector、bundle、profile；
  - 迁移动作 = `node scripts/openclaw-job-import.mjs --write`（dry-run 默认），
    3 条 GAP 需人工补 agentId；daemon 换 `agentcore-cron` 提交面。
