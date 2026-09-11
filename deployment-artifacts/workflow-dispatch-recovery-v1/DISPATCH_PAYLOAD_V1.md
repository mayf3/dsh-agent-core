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
- **有界性与整页推进（CTR-WAE-001b 对齐；keyset 由最后一条派生；上限按尝试计数）**：
  due feed 的 continuation 是 keyset 对（`afterNextEligibleAt` +
  `afterDispatchIntentId`，必须成对，取值一字不差来自本页最后一条已消费记录——
  DISPATCH_INTENT_KEYSET_CONTINUATION_V1），响应**没有** cursor 字段。整页（100 条）
  处理完后只要已发起的 send 调用次数<3 就用上述 keyset 取下一页，**直到短页或 send
  调用次数达到 3**——页数无固定上限，上限只作用于 send 调用（confirmed 与
  unknown 尝试都计入，传输故障不会一轮内无界刷栅栏）。深层候选不被第一窗口稳态饿死；
  skip 路径是本地文件账本 O(1) 查询（历史 15 页烧预算的根因=每候选 detail 读+resolve；
  本循环 skip 零 detail 零网络）。
- **identity 修复 backlog（skip 不是终局 disposition，且绝不绕过解析）**：resolution
  失败 ⇒ 当轮 fail-closed + 机械写入 `identity-repair-backlog.jsonl`（直接喂
  WORKFLOW_DATA_HYGIENE_V1 stock repair，目标是 runtime skip → 0）。**轮首
  backlog-list 记录 intentIds 集合（始终全量计算，与 recent 展示截断无关）**：集合内
  失败候选跳过时不重复登记（backlog 只增新事件），但**精确身份门每次都真实重新解析**
  ——身份修复后候选自然恢复派发，不会被历史登记永久饿死。
- **轮首快照（O(1) skip 路径）**：ledger-snapshot 一次取回全部已处理 nodeVisitId 的
  状态；候选按快照跳过，未在快照 = NOT_SENT；untrusted=true（LEDGER_UNTRUSTED）⇒ 全轮
  零 send 待 operator。每候选零重复解析账本（历史 15 页烧预算的根因=每候选 detail 读
  +resolve；本循环 skip 零 detail 零网络零全文件重扫）。
- 唯一保留的 exact deny = Owner 明确 quarantine 的 `cebf4816-c664-40cb-9b61-3fa330ad1c39`
  （精确 instanceId 比对，绝不泛化）
- `agent_session_send` timeoutSeconds=0（fire-and-forget；live 面实证仅返回
  `{"status":"accepted"}`，长等待不产生回执语义）

## 1. EXACT PAYLOAD（冻结文本；`<...>` 全部为轮内实际值替换，无占位符残留）

> **Embedding authority = `owner_apply_dispatch_payload_v1.sh` 内的 heredoc**（本节为其
> 人类可读副本）。冻结 sha256（对 `read -d ''` 捕获字节，v3 简化版 r9）：
> `43604e6e249284b404133f97aa98a140c69fe995a9ba1ffc9fbeff165beb587e`

```text
你是 HR Workflow 调度助手，每30分钟运行一次。请用中文输出短报告。机械按序执行；任何单候选失败只记录原因并继续，绝不终止整轮；不读取任何 workflow 实例详情或全量实例列表面（工具与 HTTP 皆否）；不做任何名称、标题或关键词判断。

1. 候选源：workflow_dispatch_intents(operation=list, limit=100)。轮首先各执行一次：ledger-snapshot（--file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/dispatch-fence.jsonl，得到每个已处理 nodeVisitId 的状态表）与 backlog-list（--file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/identity-repair-backlog.jsonl，记住返回的 intentIds 数组——历史身份失败登记；recent 仅是展示截断，intentIds 始终完整）。若 ledger-snapshot 返回 untrusted=true（即 LEDGER_UNTRUSTED）→ 立即停止一切派发，本轮零 send，报告标注账本不可信待 operator 处置。逐条处理 result.items 里的每个 intent；整页全部处理完后，若本轮已发起的 send 调用次数尚未达到 3 且本页返回了 100 条（满页），就用本页最后一条 intent 的 nextEligibleAt 字符串与 dispatchIntentId 分别作为 afterNextEligibleAt 与 afterDispatchIntentId（两个参数必须同时给、一字不差取自该条已消费记录）取下一页继续处理；直到出现短页（返回<100 条）或已发起的 send 调用次数达到 3 才停止取页（每整页都必须推进，页数无固定上限；上限只作用于 send 调用次数——confirmed 与 unknown 尝试都计入）。

2. 每个 intent 提供 dispatchIntentId、nodeVisitId、workflowInstanceId、ownerPrincipalId。按顺序机械执行：
a. 对照轮首快照：该 nodeVisitId 在快照中的状态 → SEND_STARTED → 跳过（reason=send_started_no_auto_resend）；SEND_CONFIRMED → 跳过（reason=already_sent）；SEND_OUTCOME_UNKNOWN → 跳过（reason=outcome_unknown_no_retry）；不在快照中 = NOT_SENT → 继续。
b. workflowInstanceId 等于 cebf4816-c664-40cb-9b61-3fa330ad1c39 → 跳过（reason=exact_quarantine_owner_ruling），继续下一候选。
c. 精确身份门：调用 agent_resolve_principal 解析 ownerPrincipalId（每一次都真实调用，backlog 历史绝不代替或绕过解析——身份修复后候选即自然恢复派发）。
   - 成功得到 agentId → 继续 d。
   - 失败/歧义/disabled：若该 dispatchIntentId 已在轮首 intentIds 数组中 → 跳过（reason=already_in_backlog），绝不重复登记；否则先 backlog-add：
python3 /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/scripts/dispatch_round_tools.py backlog-add --file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/identity-repair-backlog.jsonl --intent <dispatchIntentId> --instance <workflowInstanceId> --node-visit <nodeVisitId> --principal <ownerPrincipalId> --reason <错误码>
     然后跳过（reason=identity_blocked_错误码）。禁止 displayName/名称猜测，禁止 send。
d. 写前栅栏（先于 send，顺序不可变）：
python3 /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/scripts/dispatch_round_tools.py ledger-start --file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/dispatch-fence.jsonl --node-visit <nodeVisitId> --intent <dispatchIntentId> --instance <workflowInstanceId> --agent <agentId>
返回 claimed=false（已被占用）→ 跳过（reason=fence_already_open）。
e. 派发（完整包，目标零详情前置）：agent_session_send(operation=send, targetAgentId=<agentId>, timeoutSeconds=0, message=统一 Workflow 调度。请处理 workflow_instance_id=<workflowInstanceId>，nodeVisitId=<nodeVisitId>（已由调度方提供，无需为定位节点读取实例详情）。请用你自己的 workflow 权限读取实例详情、执行本节点工作，并自行提交推进；调度方不代为 transition/审批。完成后回报结果与证据。)
本步骤即计入本轮 send 调用次数（无论返回 confirmed 还是未明）。
f. send 返回后立即补记回执：工具正常返回 → --state SEND_CONFIRMED；超时/报错/无法确认送达 → --state SEND_OUTCOME_UNKNOWN：
python3 /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/scripts/dispatch_round_tools.py ledger-record --file /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74/memory/dispatch-fence.jsonl --node-visit <nodeVisitId> --intent <dispatchIntentId> --instance <workflowInstanceId> --agent <agentId> --state <状态>
send 调用次数达到 3 即停止派发（reason=maxsend_reached；当前页剩余候选记 not_processed_this_round，下轮经快照/身份门快速越过自然推进）。

3. 冻结禁令：不用显示名或名称猜测 Agent；不重发任何 SEND_STARTED、SEND_CONFIRMED 或 SEND_OUTCOME_UNKNOWN 的 node-visit；不对上轮结果未明的任务自动重发；不调用 ledger-clear（operator 专用）也不以任何方式改写账本或 backlog；Scheduler accepted 不算业务完成；不代任何 Agent transition 或审批。

4. 报告（中文短报告）：due 候选数与取页数；逐候选一行 disposition（sent / skip+reason / backlog）；send 调用次数（confirmed / unknown 分列）；账本新增条目数；backlog 新增条目数；停止原因（short_page / maxsend_reached / ledger_untrusted）；下一步条件。
```

## 2. Authority 分析（含 WAE V2 协调；Owner 任务 C）

### 2.1 operator payload 变更面（既有 accepted authority 完全覆盖）

1. `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2`（operator CLI 面）：`update` 明确支持
   mutable fields 的 schedule/**payload** 语义变更（agentcore-cron.mjs，
   `--message` + CAS `--expected-schedule-revision`/`--expected-updated-at`
   **两字段必须同时给**——packet 两者都从 live doc 读取后传入）。
2. 其 AMENDMENT_1（CRITICAL_JOB_SELF_DISABLE_GUARD，#249/#251/#253 merged）：guard 只拦
   self 面 **disable/remove**——**update 不在 guard 范围**，operator 变更面完整保留。
3. `SCHEDULER_CONTROL_PLANE_RELIABILITY_V1` RUNBOOK：canonical store 的 operator 变更
   纪律（receipt + readback + preimage 回滚）——由 §3 packet 全量执行。
4. 反向核查（authority gap 排除）：desired-state manifest 只冻结
   enabled/schedule/agentId（**不含 payload**）；Lane A payload digest（8ba9674b）是
   一次性 incident resume 脚本的匹配门，非 standing authority；设计态
   AGENT_CORE_HR_DISPATCHER_V1（PR #87）从未 accepted/供给。

⇒ **operator 变更面 MECHANICAL_AUTHORITY_GAP = NONE。**

### 2.2 与 AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2 的协调（诚实记录，不掩盖）

WAE V2（accepted，#246 merged）CTR-WAE-009 定义**终局架构**：Scheduler 不是 dispatcher、
HR 不再是 normal transport/retry daemon、normal admission 收敛在 `router.deliver` 的
one-attempt fence。**本 packet 不与此竞争，也不主张 WAE V2 的 implementation_authority**：

- **定位 = 过渡载体的生产恢复**：WAE V2 的生产部署（deploy→identity repair→Subjects
  A/B provisioning）属 MASTER STEP 5，尚未 production-live；在此之前真实业务
  ACTUAL_DISPATCH=0。Owner P0-lane amendment（2026-09-11）明确指令以既有 canonical HR
  dispatcher job b115cb96（Owner canonicality ruling：唯一 canonical；专用 dispatcher
  从未供给）为载体、按 SIMPLE 链先行恢复派发。
- **两层 fence 不重复消费**：本循环的 fence 在 **send 层**（nodeVisitId 键，防跨轮
  重复 send）；WAE V2 的 one-attempt fence 在 **router.deliver 准入层**（workflow
  execution 语义）。目标 Agent 仍须经其自身 authority 做合法 workflow progression——
  本 packet 不创建任何绕过 workflow 准入语义的写路径。
- **退出契约（STEP 5 cutover）**：WAE V2 production-live 时，经 packet preimage 回滚 +
  job 恢复 Owner 指定 payload 退役本过渡循环——记为 §4 显式排序依赖，不是无限期并存。

### 2.3 governance 状态

PR 全程 proposed/docs+deployment-artifact 载体，governance none/none；生产效力只来自
Owner 的 `--apply` 单条 sudo 动作（PRODUCTION_MUTATION_CONCURRENCY=ONE 排队）。

## 3. 生产 packet

见同目录 `owner_apply_dispatch_payload_v1.sh`（--selftest / --plan /
--apply --confirm-upstream-test-exclusion-live）。安全与正确性语义：

- **CLI pinning（codex P1 修复）**：operator 变更一律走 root-owned sealed install
  `/usr/local/bin/agentcore-cron`（+`/usr/local/libexec/agent-core/node-runtime`），
  每次运行机械验证：resolve 目标**不得**落在 dsh-agent-core 源 worktree 内、resolve
  目标属主必须 root、sha256 必须 equals `EXPECTED_CLI_SHA256`
  （=`scripts/agentcore-cron.mjs` @35a5b6a = `98a2a031…`；scheduler lane 换代改变 CLI
  字节时必须显式 re-pin，永不 auto-trust）。--plan 打印 resolve 链与双 digest 作证据。
- **叶子安装 = 私有 temp + 原子 rename（codex P1 修复：check-then-chown race 消除）**：
  tools、ledger、backlog、preimage、receipt 一律 mktemp（O_EXCL、不可预测名）由 root
  新建、在私有名上完成 chown/chmod，再 `mv -f` rename 落位——rename 原子**替换**目标位
  上的任何旧内容（含预植 symlink），全程不 follow；root 对预存在文件仅做只读
  stat/shasum。已存在的 regular yanfenma/root 属主账本文件是 live append-only 面，保持
  不动（本 packet 永不重写其内容）；预存在目录永不 chown（必须已是 yanfenma 属主）。
- **receipt 叶子防 symlink（codex P1 修复）**：preimage 与 apply-receipt 一律
  `mktemp`（O_EXCL、不可预测名）创建后 `mv -f` rename 落位——rename 原子**替换**
  预植叶子 symlink，绝不 follow 打开。
- **CAS 双字段（codex P1 修复）**：operator CLI 要求 `--expected-schedule-revision` 与
  `--expected-updated-at` 成对出现；packet 从 live doc 读 `scheduleRevision` +
  `updatedAtMs` 同时传入，回滚命令同样成对。单字段调用会在 CLI 侧直接 throw（已实证
  `expectedRevisionFromFlags`）。
- preimage 捕获 live payload、CAS compare-before-write、readback=新 digest、回滚=preimage
  重放；同时部署同目录 `dispatch_round_tools.py` 到 HR workspace 并初始化
  fence/backlog 两个账本文件。

### 3.1 布局（结构规则 reconciliation，codex P1 响应）

CODE_STRUCTURE_GUARDRAILS_V1 要求新增 executable 归 `scripts/`/package 或经 rule
change 扩 `includeRoots`；但 scripts/ 目录受 registry 冻结条款（"no further growth"，
ceiling 40，已注册豁免 mayf3/2027-08-22）约束，且 scripts/ 计数 59 已超 ceiling
（pre-existing，main-vs-main 同样违规）。两条约束冲突时取**更具体的已批准 registry
条款**：新增 executable 不进 scripts/。placement 选择与既有先例一致
（`deployment-artifacts/wda-structural-diagnostics-v1/run-wda-structural-diagnostics-v1.sh`
executable 已在 main）。packet 属部署载体（evidence 邻接、携带 receipts、由 Owner sudo
块执行），非 repo 实现代码；如需 verifier 覆盖 deployment-artifacts，那是 `includeRoots`
rule change（Owner 裁量），已记 FOLLOW_UP_DEBT。

## 4. 依赖与排序（诚实记录）

- **sequencing guard（v3 语义使然）**：payload 无 dispatcher 侧分类 ⇒ `--apply` 强制
  显式 attest `--confirm-upstream-test-exclusion-live`：仅当 svc WORK_EXECUTION_CLASS
  已 live 且 NON_BUSINESS_TEST 已被上游排除出 workflow_dispatch_intents 后才允许安装
  新 payload。attest 之前 live job 保持旧 payload（或 disabled），新循环不运行。
- **STEP 5 退出依赖**：WAE V2 production-live 时本过渡循环按 §2.2 退出契约退役。
- census（PHASE 1，仓库路径 `docs/evidence/workflow-dispatch-recovery-v1-20260911/census.sql`，
  READ-ONLY）待 Owner 执行回贴：identity 分类与 candidate 全景落定后，
  STALE_UNIQUE_SUCCESSOR 修复走 PHASE 4 权威路径。
- Scheduler production slot（PRODUCTION_MUTATION_CONCURRENCY=ONE）；packet apply 的
  slot 排序归 Owner 裁定。
- **census 执行纪律（codex P1：stage 后运行）**：census.sql 属用户可写 checkout——被
  妥协的进程可在其中植入 `\!` meta-command（read_only 只约束服务端事务，不约束客户端
  meta-command）。Owner 执行序列（digest pinned
  `ebe3b1f0a26adbfb062a5d28e27c6a8bca6cab40aab72a6ea175203d612e6d09`）：
  1. `shasum -a 256 docs/evidence/workflow-dispatch-recovery-v1-20260911/census.sql`（比对 pinned）
  2. `sudo install -o postgres -g postgres -m 0400 docs/evidence/workflow-dispatch-recovery-v1-20260911/census.sql /var/tmp/census-r1.sql`
  3. `sudo -u postgres psql -d svc_workflow_dogfood_clean -tA -f /var/tmp/census-r1.sql`
