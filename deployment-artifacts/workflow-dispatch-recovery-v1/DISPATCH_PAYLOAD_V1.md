# DISPATCH_PAYLOAD_V1 — HR 派发循环新冻结 payload（WORKFLOW_NORMAL_DISPATCH_RECOVERY_V1）

> EXACT_PAYLOAD = 本文件 §1 的文本（一字不差进入 `update --message`；sha256 见 §1）。
> 证据底座 = docs/investigations/WORKFLOW_DISPATCH_STARVATION_ROOT_CAUSE_V1.md（PR #267，
> 一手 cron-run 轨迹定版；本文件不重复论证）。

## 0. Owner v3 简化的落实（SIMPLE 链；dispatcher 零分类）

Owner 裁定（2026-09-11 Master refresh）：派发循环**只有**——

```
workflow_dispatch_intents（due feed）
  → exact canonical assignee resolution（agent_resolve_principal，六错误码 fail-closed）
  → durable write-ahead send fence
  → agent_session_send
  → durable delivery disposition
  → continue
```

- **dispatcher 零分类**：无 execution_class / 标题 / 名称 / 关键词输入（selftest 机械断言
  禁 `workflow_instance_detail` / `workflow_global_instances` / `execution_class` 三面）。
  NON_BUSINESS_TEST / HUMAN_REQUIRED 由 svc-workflow 上游结构排除出 due feed（svc 0026
  WORK_EXECUTION_CLASS live 后），**绝不是**由 HR LLM 在 dispatcher 里分类。
- **write-ahead send fence（`dispatch_round_tools.py`，复用 HR workspace 既有 memory
  文件账本模式，不新建平台）**：
  - key = **nodeVisitId**（duplicate intents 打到同一 visit 必撞同一 fence——这是
    DUPLICATE_WORKFLOW_DISPATCH=0 的根；progression ⇒ 新 visit ⇒ 新 key）
  - 状态机（顺序冻结）：**durable append `SEND_STARTED`（flush+fsync）→ send →
    accepted ⇒ `SEND_CONFIRMED` / error·timeout·ambiguous ⇒ `SEND_OUTCOME_UNKNOWN`**；
    flock 原子 claim（两轮并发不可能同时通过 NOT_SENT）
  - 三态全部 **NO AUTOMATIC RESEND**；`SEND_STARTED` = "无法证明 send 是否发生" ⇒ 按
    outcome-unknown 安全处理；eligibility 只能经 operator ledger-clear 或 workflow
    progression（新 visitId）恢复
  - **corruption fail-closed**：任何无法可信解析的行 ⇒ 整账本 `LEDGER_UNTRUSTED` ⇒
    当轮零 send + 拒绝写入——corruption 永远不可能导致 duplicate dispatch
  - `ledger-clear` = **operator-only**（euid 0 强制；model-facing HR turn 结构性无法
    解除自己的 fence）
- **identity 修复 backlog**：resolution 失败 ⇒ 当轮 fail-closed + 机械写入
  `identity-repair-backlog.jsonl`（skip 不是终局 disposition；backlog 直接喂
  WORKFLOW_DATA_HYGIENE_V1 stock repair，目标是 runtime skip → 0）
- **有界性**：候选源=due feed 本身（天然节流去重），游标翻页最多 5 页，每轮 send ≤3；
  单候选失败只记录并继续（ONE_BAD_WORK_ITEM_MUST_NOT_STARVE_HEALTHY_WORK）
- 唯一保留的 exact deny = Owner 明确 quarantine 的 `cebf4816-c664-40cb-9b61-3fa330ad1c39`
  （精确 instanceId 比对，绝不泛化）
- `agent_session_send` timeoutSeconds=0（fire-and-forget；live 面实证仅返回
  `{"status":"accepted"}`，长等待不产生回执语义）

## 1. EXACT PAYLOAD（冻结文本；`<...>` 全部为轮内实际值替换，无占位符残留）

> **Embedding authority = `owner_apply_dispatch_payload_v1.sh` 内的 heredoc**（本节为其
> 人类可读副本）。冻结 sha256（对 heredoc 精确字节，v3 简化版）：
> `17a2220e59d64f32230c25a4725743f5edb615dc8d347a337a8eacf02d2fe67c`

```text
你是 HR Workflow 调度助手，每30分钟运行一次。请用中文输出短报告。机械按序执行；任何单候选失败只记录原因并继续，绝不终止整轮；不读取任何 workflow 实例详情或全量实例列表面（工具与 HTTP 皆否）；不做任何名称、标题或关键词判断。

1. 候选源：workflow_dispatch_intents(operation=list, limit=100)。按返回顺序逐条处理；处理中跳过的候选（已栅栏/已入 backlog/隔离）直接越过继续下一条；若整页全部跳过且有下一页，用返回的游标取下一页（最多 5 页）。每轮最多 send 3 个。

2. 每个 intent 提供 dispatchIntentId、nodeVisitId、workflowInstanceId、ownerPrincipalId。依次执行：
a. 栅栏查询（机械执行，禁止手写账本文件）：
python3 /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/scripts/dispatch_round_tools.py ledger-query --file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/dispatch-fence.jsonl --node-visit <nodeVisitId>
SEND_STARTED → 跳过（reason=send_started_no_auto_resend）；SEND_CONFIRMED → 跳过（reason=already_sent）；SEND_OUTCOME_UNKNOWN → 跳过（reason=outcome_unknown_no_retry）；LEDGER_UNTRUSTED → 立即停止一切派发，本轮零 send，报告标注账本不可信待 operator 处置；NOT_SENT → 继续。
b. workflowInstanceId 等于 cebf4816-c664-40cb-9b61-3fa330ad1c39 → 跳过（reason=exact_quarantine_owner_ruling），继续下一候选。
c. 精确身份门：调用 agent_resolve_principal 解析 ownerPrincipalId。失败/歧义/disabled → 机械登记修复待办后跳过：
python3 /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/scripts/dispatch_round_tools.py backlog-add --file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/identity-repair-backlog.jsonl --intent <dispatchIntentId> --instance <workflowInstanceId> --node-visit <nodeVisitId> --principal <ownerPrincipalId> --reason <错误码>
（reason=identity_blocked_错误码，已入 backlog；禁止 displayName/名称猜测，禁止 send。）成功得到 agentId → 继续 d。
d. 写前栅栏（先于 send，顺序不可变）：
python3 /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/scripts/dispatch_round_tools.py ledger-start --file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/dispatch-fence.jsonl --node-visit <nodeVisitId> --intent <dispatchIntentId> --instance <workflowInstanceId> --agent <agentId>
返回 claimed=false（已被占用）→ 跳过（reason=fence_already_open）。
e. 派发（完整包，目标零详情前置）：agent_session_send(operation=send, targetAgentId=<agentId>, timeoutSeconds=0, message=统一 Workflow 调度。请处理 workflow_instance_id=<workflowInstanceId>，nodeVisitId=<nodeVisitId>（已由调度方提供，无需为定位节点读取实例详情）。请用你自己的 workflow 权限读取实例详情、执行本节点工作，并自行提交推进；调度方不代为 transition/审批。完成后回报结果与证据。)
f. send 返回后立即补记回执：工具正常返回 → --state SEND_CONFIRMED；超时/报错/无法确认送达 → --state SEND_OUTCOME_UNKNOWN：
python3 /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/scripts/dispatch_round_tools.py ledger-record --file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/dispatch-fence.jsonl --node-visit <nodeVisitId> --intent <dispatchIntentId> --instance <workflowInstanceId> --agent <agentId> --state <状态>
send 确认数达到 3 即停止派发（reason=maxsend_reached）。

3. 冻结禁令：不用显示名或名称猜测 Agent；不重发任何 SEND_STARTED、SEND_CONFIRMED 或 SEND_OUTCOME_UNKNOWN 的 node-visit；不对上轮结果未明的任务自动重发；不调用 ledger-clear（operator 专用）也不以任何方式改写账本或 backlog；Scheduler accepted 不算业务完成；不代任何 Agent transition 或审批。

4. 报告（中文短报告）：due 候选数；逐候选一行 disposition（sent / skip+reason / backlog）；实际 send 数；账本新增条目数；backlog 新增条目数；下一步条件。
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

见同目录 `owner_apply_dispatch_payload_v1.sh`（--selftest / --plan /
--apply --confirm-upstream-test-exclusion-live）。安全语义（codex security review
P1×2 修复后冻结）：

- **CLI pinning（P1-1 修复）**：operator 变更一律走 root-owned sealed install
  `/usr/local/bin/agentcore-cron`（+`/usr/local/libexec/agent-core/node-runtime`），
  每次运行机械验证：resolve 目标**不得**落在 dsh-agent-core 源 worktree 内、resolve
  目标属主必须 root、sha256 必须 equals `EXPECTED_CLI_SHA256`
  （=`scripts/agentcore-cron.mjs` @35a5b6a = `98a2a031…`；scheduler lane 换代改变 CLI
  字节时必须显式 re-pin，永不 auto-trust）。--plan 打印 resolve 链与双 digest 作证据。
- **no-follow / no-pre-existing-chown（P1-2 修复）**：对 `$WS`、`$WS/scripts`、
  `$WS/memory`、receipts 目录、目标文件全部先做 symlink 拒绝；**预存在目录永不 chown**
  （必须已是 yanfenma 属主，否则 abort）；预存在文件属主仅接受 yanfenma（no-op）或
  root（前次 root run 残留 = 事故家族已知修复），第三方属主 abort；仅 chown 本次新建
  的目录与部署的文件。root 写 preimage/receipt 前同样拒绝 symlink 目录。
- preimage 捕获 live payload、CAS compare-before-write、readback=新 digest、回滚=preimage
  重放；同时部署同目录 `dispatch_round_tools.py` 到 HR workspace 并初始化
  fence/backlog 两个账本文件。（布局注：工具与 packet 同放
  deployment-artifacts/——scripts/ 目录受结构门 file-ceiling 管辖，本 PR 零
  candidate-caused 结构增量。）

## 4. 依赖与排序（诚实记录）

- **sequencing guard（v3 语义使然）**：payload 无 dispatcher 侧分类 ⇒ `--apply` 强制
  显式 attest `--confirm-upstream-test-exclusion-live`：仅当 svc WORK_EXECUTION_CLASS
  已 live 且 NON_BUSINESS_TEST 已被上游排除出 workflow_dispatch_intents 后才允许安装
  新 payload。attest 之前 live job 保持旧 payload（或 disabled），新循环不运行。
- census（PHASE 1，同目录 `census.sql`，READ-ONLY）待 Owner 执行回贴：identity 分类与
  candidate 全景落定后，STALE_UNIQUE_SUCCESSOR 修复走 PHASE 4 权威路径。
- Scheduler production slot（PRODUCTION_MUTATION_CONCURRENCY=ONE）；packet apply 的
  slot 排序归 Owner 裁定。
