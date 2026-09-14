# WGR_STUCK_RECOVERY_WRITE_FIX — Evidence (2026-09-15)

Goal: SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1（续）— 安全 self-reconcile 真实写入缺陷修复。
Branch: `fix/self-ops-reconcile-termination-write-v1`（base = origin/main b9686f9，即已合入的 V1 实现）。
PRODUCTION_MUTATION = NONE（本分支未合入、未部署；occ:0f774c6c7a36f5a3 未获任何 unfence）。

## 文件

- `RED-repro-pre-fix.log` — 修复前红灯：真实 Scheduler 引擎 + 真实 JobStore（commit-time 验证），
  self-ops 与 operator 两条 termination-only 写入路径全部被
  `occurrence authority corrupted (fail loud): endedAt must match the final history transition` 拒绝。
- `GREEN-self-service-suite.txt` / `GREEN-full-scheduler-suite.txt` — 修复后双入口全绿（323/323）。
- `cross-layer-fault-simulations.txt` — F1–F4 跨层故障模拟输出（含 5k ledger 实测数字）。

## 缺陷机理（复现包消费结论）

真实引擎 writeback（`writeOccurrenceOutcome`）对 outcome_unknown **总是**设置 `endedAt`；
validator（occurrence-model: `endedAt must match the final history transition`）要求 `endedAt` 等于
最后一条 history 的时间。两条 termination-only settlement 写入器
（`self-ops/index.js` reconcileTurn、`control.js` reconcileOccurrence）追加同态 history annotation
时**都不维护 `endedAt`** → 一旦 annotation 晚于 writeback（必然），commit 即被验证器拒收。
即：**对所有真实 unknown（全部经 writeback 产生）safe reconcile 100% 死亡**，且以 fail-loud
store corruption 异常形式抛出。旧 self-ops-v3 fixture 构造 unknown 时未传 `endedAt`（非真实形态），
因此 319 项存量测试全绿而生产路径死——与 Owner 指控逐字吻合。

## 修复（writer 侧一致性，validator 不变量零改动）

- `packages/scheduler/src/self-ops/index.js`：annotation 后 `lockedRecord.endedAt = now`。
- `packages/scheduler/src/control.js`：annotation 后 `record.endedAt = resolvedAt`。
- 保留：业务 `outcome_unknown`（state 不变）、原始 history（append-only，前缀逐字节断言）、
  terminationSettlement 严格终止证明权威模型（全部字段断言不变）。
- 语义对齐：`eligibility.js` 的 `operationalEndedAt` 早已把 `terminationSettlement.committedAt`
  当 operational end——原始记录现在与投影模型一致。无 Spec 修订（writer 对既有 accepted
  authority 的 conformance 修复，非新语义）。

## 正向验收（真实引擎链，非 fixture）

status（safe_reconcile_available）→ exact reconcile commit → persisted receipt + fence 清空 readback
→ 下一 future natural slot 恰好一次新准入并真实运行成功；settled occurrence 永不重放；
未证明终止（pending / restart_lost / 无效 abort 证据）仍全部拒绝且字节级零写入。

## 跨层故障模拟分类（F1–F4）

| 项 | 分类 | 结论 |
|---|---|---|
| F1 Router 重启丢 evidence/correlation | 既有能力限制（fail-closed 已验证） | restart_lost 与重启后重铸 correlation 两个轴都拒绝（termination_not_proven / correlation_mismatch），零写入，fence 保持。恢复需 Router 重新证明或 operator reconcile——不盲试。 |
| F2 同 Agent 另一 Job + 交互入口受 process fence | 既有能力限制（已验证非缺陷） | fence 是 per-Job：A 被 fence 时同 Agent 的 B 正常准入并成功；self_ops.status 交互入口在 fence 存活期间照常应答。 |
| F3 Scheduler abort 未形成实际终止 | 既有能力限制（fail-closed 已验证） | `abort_requested`/缺失 terminationEvidence 的 snapshot 一律 unsupported → termination_not_proven，fence 保持。 |
| F4 大量完成任务后的缓存/内存保留 | 待验证风险（已量化） | 5001 条 ledger：status 55ms / reconcile 176ms；缓存=单克隆替换（25 次 force-load 堆增长 10.9MB，无每调用累积）；**ledger 无 retention/compaction 权威**——append-only 无限增长是长期风险，需未来独立 mandate，不在本轮夹带。 |
