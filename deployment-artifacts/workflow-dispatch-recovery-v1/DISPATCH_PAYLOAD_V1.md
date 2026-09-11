# DISPATCH_PAYLOAD_V1 — HR 派发循环新冻结 payload（WORKFLOW_NORMAL_DISPATCH_RECOVERY_V1）

> EXACT_PAYLOAD = 本文件 §1 的文本（一字不差进入 `update --message`；sha256 见 packet）。
> 证据底座 = docs/investigations/WORKFLOW_DISPATCH_STARVATION_ROOT_CAUSE_V1.md（PR #267，
> 一手 cron-run 轨迹定版；本文件不重复论证）。

## 0. 两个 Owner 语义修正的落实

### 0.1 CROSS_ROUND_DEDUPE（机械调查结论：需自建，已最小实现）

`agent_session_send` live 面（生产轨迹实证，09-11）**无 caller 可见幂等键、无回执 id、
无调用关联**——工具结果仅 `{"status":"accepted"}`（#203 的丰富语义未部署）。due feed
的 nextEligibleAt **不构成**跨轮 send 去重保证（E2-3：同实例跨轮重发 9-12 次实锤）。

⇒ **write-ahead send fence + durable dispatcher receipt**（`dispatch_round_tools.py`，复用
HR workspace 既有 memory 文件账本模式——与 workflow_pool_metrics.py 同族，不新建平台）：

- key = **dispatchIntentId**（node-visit 级；workflow progression 产生新 intent = 新 key，
  天然满足「只有 progression 改变后续资格」）
- 状态机（顺序冻结）：**durable append `SEND_STARTED`（flush+fsync）→ send →
  accepted ⇒ `SEND_CONFIRMED` / error·timeout·ambiguous ⇒ `SEND_OUTCOME_UNKNOWN`**
- 三态 `SEND_STARTED` / `SEND_CONFIRMED` / `SEND_OUTCOME_UNKNOWN` 全部 **NO AUTOMATIC
  RESEND**；`SEND_STARTED` 语义 = "无法证明 send 是否发生" ⇒ 按 outcome-unknown 安全
  处理，宁可人工 disposition 不 blind retry；`SEND_CONFIRMED` 对本 intent terminal
- **corruption fail-closed**：任何无法可信解析的行 ⇒ 整账本 `LEDGER_UNTRUSTED` ⇒
  当轮零 send + `ledger-record` 拒绝写入——corruption 永远不可能导致 duplicate dispatch
- `ledger-clear` = **operator-only**（euid 0 强制；model-facing HR turn 结构性无法解除
  自己的 fence）；append-only JSONL、幂等 record

### 0.2 CLASSIFICATION（V1 只实现有权威字段的分类）

| 类 | 唯一输入 | 权威面 |
|---|---|---|
| NON_BUSINESS_TEST | `execution_class == 'NON_BUSINESS_TEST'` | WORK_EXECUTION_CLASS（summary 投影） |
| IDENTITY_BLOCKED | exact resolution 失败/歧义/disabled | EXACT_AGENT_PRINCIPAL_RESOLUTION 六错误码 |
| REAL_BUSINESS | 其余且 `execution_class == 'BUSINESS'` | 同上 |

- **禁止并已实现为零**：payload/name/title 子串启发式、「测试词表」、displayName 推断
  （T8 断言：class=BUSINESS 的任何标题都派发）。
- `execution_class` 缺席（svc 0026 未部署的 summary）⇒ `class_unavailable_fail_closed`
  skip——保 TEST_CANARY_DISPATCHED_AS_BUSINESS=0（**CANARY_PRECONDITION：STEP 4 的 svc
  0026 部署**，见 §4）。
- HUMAN_REQUIRED / 泛化 QUARANTINED / EXTERNAL_SIDE_EFFECT：无冻结权威字段，**本轮
  DEFER**（不实现、不猜）。唯一保留 = Owner 明确 quarantine 的 exact entry：
  `cebf4816-c664-40cb-9b61-3fa330ad1c39`（精确 instanceId 比对，绝不泛化）。

## 1. EXACT PAYLOAD（冻结文本；`<...>` 全部为轮内实际值替换，无占位符残留）

> **Embedding authority = `owner_apply_dispatch_payload_v1.sh` 内的 heredoc**（本节为其
> 人类可读副本）。冻结 sha256（对 heredoc 精确字节，fence 修订版）：
> `0f0e3b23301f84dbb36ee17dd1d9b7f7b2312cb5aca284b6388d6fc07fe1dc85`

```text
你是 HR Workflow 调度助手，每30分钟运行一次。请用中文输出短报告。严格按以下顺序机械执行；任何单候选失败只记录原因并继续下一个候选，绝不终止整轮；禁止调用 workflow_instance_detail（任何域）。

1. 读取候选：调用 workflow_dispatch_intents(operation=list, limit=100)。本轮只处理前 20 条 due intents（超出部分记 reason=window_bounded）。不扫描全量 active 实例列表。

2. 对每个候选依次执行（派发成功数达到 3 即停止派发，其余记 reason=maxsend_reached）：
a. 查账本（机械执行，禁止手写账本文件）：
python3 /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/scripts/dispatch_round_tools.py ledger-query --file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/dispatch-receipts.jsonl --intent <dispatchIntentId>
SEND_CONFIRMED → 跳过（reason=already_sent）；SEND_OUTCOME_UNKNOWN → 跳过（reason=outcome_unknown_no_retry）；SEND_STARTED → 跳过（reason=send_started_no_auto_resend，无法证明 send 是否发生，按 outcome 未明处理）；LEDGER_UNTRUSTED → 立即停止一切派发，本轮零 send，报告标注账本不可信待 operator 处置；其余继续下一候选。
b. workflowInstanceId 等于 cebf4816-c664-40cb-9b61-3fa330ad1c39 → 跳过（reason=exact_quarantine_owner_ruling），继续下一候选。
c. 取分类字段：调用 workflow_global_instances(operation=list, lifecycle=active, assigneePrincipalId=<ownerPrincipalId>, limit=20)，在结果中找 workflowInstanceId 对应行：找不到 → 跳过（reason=summary_row_missing）；execution_class 缺席 → 跳过（reason=class_unavailable_fail_closed）；NON_BUSINESS_TEST → 跳过（reason=non_business_test）；BUSINESS → 继续 d。
d. 精确身份门：调用 agent_resolve_principal 解析 ownerPrincipalId：失败/歧义/disabled → 跳过（reason=identity_blocked_错误码），继续下一候选；成功得到 agentId。
e. 派发与记账（写前栅栏，顺序不可变，f2 绝不得先于 f1）：
f1. send 之前先落 durable 栅栏（append+fsync）：…/dispatch_round_tools.py ledger-start --file …/dispatch-receipts.jsonl --intent <dispatchIntentId> --instance <workflowInstanceId> --node-visit <nodeVisitId> --agent <agentId>
f2. 然后才调用 agent_session_send(operation=send, targetAgentId=<agentId>, timeoutSeconds=600, message=统一 Workflow 调度。请处理 workflow_instance_id=<workflowInstanceId>，nodeVisitId=<nodeVisitId>（已由调度方提供，无需为定位节点读取实例详情）。请用你自己的 workflow 权限读取实例详情、执行本节点工作，并自行提交推进；调度方不代为 transition/审批。完成后回报结果与证据。)
f3. send 返回后立即补记：ok 或 accepted → --state SEND_CONFIRMED；超时/报错/无法确认送达 → --state SEND_OUTCOME_UNKNOWN：…/dispatch_round_tools.py ledger-record --file …/dispatch-receipts.jsonl --intent <dispatchIntentId> --instance <workflowInstanceId> --node-visit <nodeVisitId> --agent <agentId> --state <状态>

3. 冻结禁令：不用显示名或名称猜测 Agent；不重发任何 SEND_STARTED、SEND_CONFIRMED 或 SEND_OUTCOME_UNKNOWN 的 intent；不对上轮结果未明的任务自动重发；不调用 ledger-clear（operator 专用）也不以任何方式改写账本；Scheduler accepted 不算业务完成；不代任何 Agent transition 或审批。

4. 报告（中文短报告）：本轮 due 候选数；逐候选一行 disposition（sent 或 skip+reason）；实际派发数；账本新增条目数；下一步条件。
```

## 2. Authority 分析（Owner 任务 C：无需新 Spec）

operator 对本 critical job 的 payload 语义变更被**既有 accepted authority 完全覆盖**：

1. `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2`（operator CLI 面）：`update` 明确支持
   mutable fields 的 schedule/**payload** 语义变更（agentcore-cron.mjs:16,252-294，
   `--message` + CAS `--expected-schedule-revision/--expected-updated-at`）。
2. 其 AMENDMENT_1（CRITICAL_JOB_SELF_DISABLE_GUARD，#249/#251/#253 merged）：guard 只拦
   self 面 **disable/remove**（critical-job-guard.js:76）——**update 不在 guard 范围**，
   operator 变更面完整保留。
3. `SCHEDULER_CONTROL_PLANE_RELIABILITY_V1` RUNBOOK：canonical store 的 operator 变更
   纪律（receipt + readback + preimage 回滚）——由 §3 packet 全量执行。
4. 反向核查（authority gap 排除）：desired-state manifest 只冻结
   enabled/schedule/agentId（**不含 payload**）；Lane A payload digest（8ba9674b）是
   一次性 incident resume 脚本的匹配门，非 standing authority；设计态
   AGENT_CORE_HR_DISPATCHER_V1（PR #87）从未 accepted/供给。

⇒ **MECHANICAL_AUTHORITY_GAP = NONE；不写 amendment。**

## 3. 生产 packet

见同目录 `owner_apply_dispatch_payload_v1.sh`（--selftest / --plan / --apply；
preimage 捕获 live payload、CAS compare-before-write、readback=新 digest、回滚=preimage
重放；同时部署 dispatch_round_tools.py 到 HR workspace scripts/ 并初始化账本文件）。

## 4. CANARY 前置依赖（诚实记录，非阻塞本 READY）

- **execution_class 须 live 于 summary 投影**（svc 0026 = WORK_EXECUTION_CLASS 源侧已
  merged、生产 svc 未部署）。部署前所有候选 fail-closed 为 class_unavailable——保
  TEST_CANARY_DISPATCHED_AS_BUSINESS=0。此项与 MASTER STEP 4 的 svc deploy 是同一动作，
  canary 排序由 Owner 在 slot 释放时裁定。
- Scheduler production slot（PRODUCTION_MUTATION_CONCURRENCY=ONE）。
