# EXECUTION_HISTORY_QUERY_V1 — Phase A 真实样本只读验收（2026-09-19，r4 口径修订版）

> Spec: `docs/specs/AGENT_CORE_EXECUTION_HISTORY_QUERY_V1.md` (accepted) §9。
> 边界：**全只读**。session corpus（world-readable）直读；**authsvc-only 存储以空目录
> 代替是本次测试的读取范围限制——它只证明"本边界内读不到"，不构成生产权威源不存在
> 或已丢失的证明**。查询层据此输出 SOURCE_ABSENT/SOURCE_DEGRADED（而非丢失断言）。
> 产物只含坐标（IDs/序号/关联），不含任何消息正文。
> 生产 mutation：**零**（执行于 PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1 冻结期内，纯离线读）。

## 运行

```
node phase-a-run.mjs --homes /Users/authsvc/.agent-core/homes --out /tmp/ehq-phase-a-postfix
```

- 语料：772 个 session.jsonl；索引 1053ms（部分扫描 31 如实标记；unreadable=0）。
- 含 workflow 坐标 journal=324、inter_agent sidecar journal=43。
- 查询核心 = `packages/execution-history/src/index.js`（与 broker 工具同一核心）。
- 本版已吸收 Owner 反例修订（r4）：intent≠ACCEPTED、job-enabled≠ADMITTED、
  occurrence 查询严格作用域、保留损失仅在结构可证时断言、sidecar 关联来源=Session 记录、
  父 turn correlation ≠ 具体发送调用（caller 缺口保留）。

## 五链结果（产物 *.json；timeline 条数是记录数，不是执行操作数）

| 链 | 真实样本 | 结果（修订后语义） | 诚实缺口 |
|---|---|---|---|
| A1 workflow_instance | 索引选出的真实实例 | ok；session_view 定位相关 journal | `SOURCE_ABSENT svc`（本边界无 caller credential=测试范围限制）；`CORRELATION_GAP dispatch_attempts`（ledger 本边界不可读） |
| A2 scheduler occurrence | `occ:003A001022a7134495ba` | ok；R5 **WEAK_NAME_JOIN**（from=query_coordinate，弱关联如实标注）命中真实 cron session；agentExecution=STARTED | `SOURCE_ABSENT scheduler_store ×2`；**该 STARTED 依托弱命名关联，非精确 run↔turn 证据（Phase B 项）** |
| A3 A2A 接收侧 | agt_product-manager/main 真实 inter_agent 注入 | ok；sidecar 坐标可见（sourceAgentId/correlation，seq 精确） | `CORRELATION_GAP inbound_dispatch`（ASM 行本边界不可读） |
| A3b correlation 反查 | 真实源 turnExecutionId | ok；R1 **SIDECAR_PROVENANCE_ONLY**、from=session_journal——只证明"该 Session 记录把消息锚到该父 turn"；**精确发送链未闭合** | `SOURCE_ABSENT asm_audit` + `CORRELATION_GAP caller_send_invocation`（缺口保留，不合成调用方审计来源） |
| A4 独立 session | agt_stock_agent/main | ok；独立还原输入/turn 坐标 | 同 A3 |

## 判定（r4 口径）

- **Phase A = PASS，但结论限定为：在只读离线边界内，四类查询根都能对真实数据给出
  可解释、缺口显式的轨迹**。它**不证明**：生产权威源的内容状态、精确发送链闭合、
  或任何一次真实运行的操作级事实——那些需要 Phase B 的边界内读取。
- Phase B 检查项（=部署后经 broker 工具的只读查询重放；**不是**重放任务或消息）：
  1. A1/A2 在权威源可读边界内复跑：occurrence-scoped 查询无同 job 兄弟 run 混入
     （本修订的回归测试已钉该语义，生产数据复核一次）；
  2. A3/A3b 在 ASM 审计可读边界内复跑：`caller_send_invocation` 缺口应被真实
     requestId 关联闭合（R1 from=asm_audit），弱关联升级为精确关联；
  3. WPA-1 生效后新轮转产生 archive：RETENTION_LOSS_PRE_V1 仅对历史代成立；
  4. `workflow_execution` sidecar 出现首条真实样本后，A1 链补齐 sidecar 证据级；
  5. self/audit 双工具的鉴权实调（Owner 或获权 agent 经飞书触发一次）。
- Phase B **BLOCKED_BY_FREEZE**：`PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1` 解除后，
  按 Spec §10：grant packet → PRODUCTION_DEPLOY_QUEUE → 部署 → 上列检查项。
