# EXECUTION_HISTORY_QUERY_V1 — Phase A 真实样本只读验收（2026-09-19）

> Spec: `docs/specs/AGENT_CORE_EXECUTION_HISTORY_QUERY_V1.md` (accepted) §9。
> 边界：**全只读**。session corpus（world-readable）直读；authsvc-only 存储（ASM audit、
> attempts ledger、scheduler store/history、runtime-evidence、turn-recovery）按访问矩阵
> 指向空临时目录 → 诚实的 SOURCE_ABSENT/DEGRADED，不伪造。索引与产物写入 /tmp 与本目录。
> 产物只含坐标（IDs/序号/关联），**不含任何消息正文**（隐私边界，§4.3 精神）。
> 生产 mutation：**零**（本验收在 PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1 冻结期内执行，
> 纯离线读；部署=Phase B，按冻结暂停，待 Owner 队列）。

## 运行

```
node phase-a-run.mjs --homes /Users/authsvc/.agent-core/homes --out /tmp/ehq-phase-a-final
```

- 语料：765 个 session.jsonl（669→765 含当日新文件）；索引构建 1052ms（2 MiB/文件扫描帽，
  31 个部分扫描如实标记）；含 workflow 坐标的 journal=319，含 inter_agent sidecar=43。
- 查询核心 = `packages/execution-history/src/index.js`（与 broker 工具同一核心，零分支差异）。

## 五链结果（结构化产物见同目录 *.json）

| 链 | 真实样本 | 结果 | 诚实缺口（按 §5 显式输出） |
|---|---|---|---|
| A1 workflow_instance | 索引选出的真实实例（agtv8 UUID，来自真实 tool-call 坐标，`A1_workflow_instance.json`） | ok；session_view 定位到真实 journal（agt_arch-reviewer/main 与 agt_hr-agent cron session 的 R4 坐标关联） | `SOURCE_ABSENT svc`（离线无 caller credential）、`CORRELATION_GAP dispatch_attempts`（ledger authsvc-only） |
| A2 scheduler occurrence | `occ:003A001022a7134495ba`（真实 agt_hr-agent cron-run 目录名反推） | ok；**R5 命名约定 join 命中真实 cron-run session**，agentExecution=STARTED（turn 存在） | `SOURCE_ABSENT scheduler_store ×2` |
| A3 A2A 接收侧 | agt_product-manager/main 真实 inter_agent 注入消息 | ok；sidecar 坐标可见：sourceAgentId=agt_course-community-agent-2、correlation=turn:a4994258-…（seq 精确定位，多任务不混淆） | `CORRELATION_GAP inbound_dispatch`（ASM 行 authsvc-only） |
| A3b correlation 反查 | 用 A3 的真实 correlation（=源 turnExecutionId）作 message 根 | ok；**反查命中目标 journal**（12 条 timeline），R1 关联 rule 落地 | `RETENTION_LOSS_PRE_V1`（无 WPA-1 archive 的离线世界，如实标注） |
| A4 独立 session | agt_stock_agent/main（无 workflow 依赖） | ok；输入/turn 坐标独立还原 | 同 A3 的调用侧缺口 |

## 判定

- **Phase A = PASS（离线边界内的四类查询根 × 真实数据全部可查询、可解释、缺口显式）**。
  每条关键结论都能回查到坐标级证据引用（nativeRefs/sampleRefs）；"查不到 ≠ 没发生"在三处
  SOURCE_ABSENT 场景下按 §5 输出 UNKNOWN+缺口码，无一例伪造链路。
- **Phase B（部署后经 broker 产品入口重放四链）= BLOCKED_BY_FREEZE**：
  `PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1` 首次接管期间暂停一切生产 mutation（含本 Goal
  的 runtime 部署与 auth-service 两 scope grant）。接手：freeze 解除后按 Spec §10 排队执行
  （grant packet → PRODUCTION_DEPLOY_QUEUE → 部署 → broker 实调四链）。
- Phase A 中发现并已回灌产品的真实格式事实（implementation r3 吸收）：
  1. tool args/results 在 journal 中是**转义 JSON 字符串** → 索引正则升级为转义容忍形；
  2. spliced 的 `inserted[]` 才携带 source sidecar（无独立 messageId 字段，旧 seam 构建）→
     projectJournal 提取 inserted[] 为注入消息；
  3. correlation（=源 turnExecutionId）是可索引的反查坐标 → 索引新增 interAgentCorrelations
     键 + message 根反查回退（A3b 即其真实命中）；
  4. 权威账本不可读时，occurrence 坐标仍驱动命名约定 join（A2 的 R5 命中即该退化路径）。
