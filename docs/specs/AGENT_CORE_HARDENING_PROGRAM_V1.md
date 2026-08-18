---
spec_id: AGENT_CORE_HARDENING_PROGRAM_V1
status: draft
---

# Agent Core Hardening Program V1

> 性质：**Program Spec（本轮只冻结问题、边界与实施顺序，不修改产品代码）**  
> 日期：2026-08-18  
> 仓库：`mayf3/dsh-agent-core`  
> 基线：`main@93f9acf67cb9b4862fc9b8ffaf593630086285ba`  
> 触发背景：对当前 Production Runtime / Router / Notification Ingress / Scheduler 的全面审计，以及项目 Owner 对当前信任模型和产品意图的重新确认。
>
> 本 Spec 只允许新增本文件。它**不授权任何 Implementation PR**。后续每一项修复必须拥有独立、已 accepted、已存在于 implementation base branch 的 child Spec，之后才允许改代码。

---

## 0. North Star

Agent Core 当前不缺新的业务组件，缺的是让已经存在的入口、进程与调度器在异常情况下仍然可解释、可恢复、不会被匿名调用、不会把“超时”误报成“确定失败”。

本轮目标不是建立完整零信任平台，也不是立刻隔离所有 Agent，而是冻结一套适合当前开发阶段的真实模型：

```text
Agent 之间：合作式共享主机信任域，优先自由开发与迭代
Control Plane 与 Agent 之间：仍是必须保护的边界
Forum / Workflow 与 Notification Ingress 之间：必须有明确服务身份
进程 / 调度异常：必须有有界等待与诚实结果语义
```

期望的开发顺序：

```text
先冻结 Program Spec
→ 每个问题单独写 child Spec
→ 解决与旧 Spec / Decision / Report 的冲突
→ child Spec accepted 并进入 base branch
→ 再做最小实现
→ 以故障注入而不是 happy-path 数量验收
```

---

## 1. Owner 决策（本 Program 冻结）

### 1.1 当前 Agent 信任模型

```text
AGENT_TRUST_MODEL = COOPERATIVE_SHARED_HOST_TRUST_DOMAIN
MALICIOUS_PEER_AGENT_DEFENSE = OUT_OF_SCOPE_FOR_V1
PER_AGENT_OS_UID_ISOLATION_REQUIRED_NOW = NO
AGENT_CROSS_WORKSPACE_ACCESS_CURRENTLY_ALLOWED = YES
```

当前阶段允许 Agent 互相访问同一主机上的工作区和运行资源，以提高开发自由度与迭代速度。暂不把“Agent A 主动攻击 Agent B”作为 V1 blocker。

因此必须诚实修改长期声明：

- `one Agent = one DSH process` 当前表示**运行时、生命周期、DSH_HOME 与 Session owner 的边界**；
- 它当前**不是 Agent 与 Agent 之间的对抗性安全边界**；
- 同一 UID / 同一主机下的 Agent 属于同一合作式信任域；
- 未来若出现不互信 Agent、外部租户、HR/财务等高敏 Agent，再单独建立 adversarial isolation Spec。

该取舍不表示 Control Plane secrets 可以暴露给 Agent。以下仍必须成立：

```text
AGENT_CAN_READ_CONTROL_PLANE_CREDENTIAL_STORE = NO
AGENT_CAN_READ_NOTIFICATION_CALLER_CREDENTIALS = NO
AGENT_CAN_SELF_ASSERT_SERVICE_IDENTITY = NO
```

### 1.2 Agent 调用另一个 Agent 工作是产品能力

```text
AGENT_TO_AGENT_WORK_REQUIRED = YES
ANONYMOUS_AGENT_TO_AGENT_CALL = NO
NOTIFICATION_INGRESS_IS_AGENT_DELEGATION_API = NO
```

“Agent A 让 Agent B 工作”必须保留，但需要区分三种语义：

1. `switchAgent`：当前聊天窗口切换服务 Agent，是 conversation handoff，不是后台任务委派；
2. Notification Ingress：Forum / Workflow 等可信业务服务把一个已经成立的业务事件送达 Agent，是 service-to-agent admission；
3. Agent task delegation：Agent A 发起任务给 Agent B。V1 首选通过 Workflow / Forum 留痕后，由对应服务通知 B；未来需要低延迟直连时，再单独设计带真实 caller identity 的 `delegateTask` capability。

当前禁止 Agent 直接持有 Notification Ingress 的服务凭据，也禁止把 Notification Ingress 当作通用 `agentId -> deliver` 后门。

### 1.3 Notification Ingress 的唯一允许调用者

```text
NOTIFICATION_INGRESS_ALLOWED_CALLERS = [svc-forum, svc-workflow]
ANONYMOUS_NOTIFICATION_INGRESS = REJECT
AGENT_CALLER_ON_NOTIFICATION_INGRESS = REJECT
CALLER_ID_FROM_REQUEST_BODY = UNTRUSTED
```

Forum / Workflow 是当前 V1 唯一允许的服务身份。未来新增服务必须通过新的 accepted Spec 或本 Spec 的 accepted amendment，不能仅靠增加一个字符串或环境变量静默放行。

### 1.4 可靠性优先项

以下两项为当前明确要求修复的问题：

```text
AGENT_PROCESS_PENDING_RPC_CAN_HANG_FOREVER = MUST_FIX
SCHEDULER_TIMEOUT_WITHOUT_CANCELLATION = MUST_FIX
```

但二者不得在同一个无 governing Spec 的大改中混做。

---

## 2. Current Facts 与问题边界

### 2.1 Notification Ingress 当前是匿名通用入口

当前 `packages/notification-ingress` 暴露：

```text
POST /v1/deliver
{ requestId, agentId, sessionMode, message }
```

它只依赖 loopback bind，没有 caller identity、caller allowlist 或 service credential。HTTP body 可以直接指定任何已定义 `agentId`。

Router 的 `agentRouter.deliver()` 本身是一个合理的**内部 admission primitive**；问题在于 HTTP adapter 把它直接变成了匿名公共本机能力。修复应优先落在 ingress/auth 边界，不应把 Forum / Workflow 业务语义塞进 Router。

### 2.2 AgentProcess 的请求生命周期不闭合

当前 `AgentProcess.request()` 的 pending waiter 只在收到 JSON-RPC response 或可选 timer 到期时结束；child `error/exit` 没有统一 reject 所有 pending。`ready()` 和 routed `turn()` 的 prompt receipt 也存在未统一 deadline 的路径。

这会导致：

```text
child 已死 / pipe 已断
→ pending request 不结束
→ ensureRunning / turnQueue 永久等待
→ 该 Agent 后续消息全部被堵住
```

### 2.3 Scheduler timeout 不是 cancellation

当前 Scheduler 通过 `Promise.race()` 返回 timeout，并触发 `AbortSignal`；但 Router / AgentProcess 没有真正取消正在运行的 turn。于是“Scheduler 已记录失败”与“真实 Agent 仍继续执行”可以同时成立。

因此：

```text
TIMEOUT != PROVEN_FAILURE
TIMEOUT_WITHOUT_TERMINATION = OUTCOME_UNKNOWN
```

在真实执行是否终止尚未确认时，自动重试可能造成重复外部副作用。

### 2.4 requestId 当前不是完整幂等键

Delivery V0 的 `requestId` 当前主要用于 `fresh` Session 的稳定映射；相同 requestId 再次调用仍可能再次把 message 放入 inbox。

Notification 入口在接入 Forum / Workflow 前必须冻结：

- caller identity；
- requestId namespace；
- 重复请求的返回；
- pending / outcome unknown 时是否允许重投；
- 相同 key 但 payload 不同的冲突语义。

---

## 3. Notification Ingress V1 目标模型

### 3.1 身份必须来自凭据，不来自“固定程序名”

仅仅约定“只有某两个固定程序会调用”不构成安全边界。HTTP 服务看不到对方是哪个可执行文件；同机任意进程都可以复刻同一个请求。

V1 最小可信模型：

```text
Forum process / Workflow process
  → 携带各自独立 service credential
  → Notification Ingress 验证 credential
  → credential 映射到固定 caller principal
  → caller principal 通过 allowlist
  → 再调用 Router internal deliver primitive
```

建议 caller principals：

```text
svc-forum
svc-workflow
```

禁止 request body 自报 `callerId` 后直接相信。即使 wire 为了日志携带 caller hint，最终 caller identity 也只能由 credential lookup 得出。

### 3.2 Credential 最小存储模型

child Spec 至少必须满足：

- Forum 与 Workflow 使用不同 credential，可独立轮换和吊销；
- credential 来源是 505-private / Control-Plane-private 文件或等价受保护存储；
- raw credential 不写日志、不进入响应、不放进 Agent workspace；
- raw credential 不通过 AgentProcess 的继承环境进入 Agent child；
- 缺失、损坏、权限过宽时 fail closed；
- `Authorization` 缺失或无效返回 401；身份有效但无该 operation 权限返回 403。

允许 child Spec 在 bearer token 与 HMAC request signing 之间选择最小方案。loopback-only V1 可使用独立高熵 bearer token，但必须保存 token hash 或采取等价的不回显设计，并做 constant-time compare。

### 3.3 Caller 权限

V1 固定：

| Caller | 允许能力 | 不允许能力 |
|---|---|---|
| `svc-forum` | 将 Forum 事件送达一个已定义且 runnable 的 Agent | 冒充 Workflow、修改 Agent Definition、获得 Broker credential |
| `svc-workflow` | 将 Workflow 任务/状态事件送达一个已定义且 runnable 的 Agent | 冒充 Forum、直接操作 Binding、获得 Broker credential |
| Agent process | 无 Notification Ingress caller credential | 直接调用 service-to-agent ingress |
| 其他本机进程 | 无 | 匿名 deliver |

V1 信任 Forum / Workflow 根据它们自己的业务授权选择目标 Agent；Notification Ingress 仍必须验证目标 Agent 存在且 runnable。若未来需要限制“某服务只能通知某些 Agent”，另增静态 target allowlist，不在本 Program 中预造通用 Policy Engine。

### 3.4 Notification 与 Agent delegation 的关系

推荐的 V1 Agent-to-Agent 工作流：

```text
Agent A
  → 通过 Broker 在 Workflow 创建/分配任务给 Agent B
  → Workflow 形成持久业务事实
  → svc-workflow 使用自己的 service credential 通知 Agent B
  → Agent B 开始工作
```

Forum mention / proposal 同理：

```text
Agent A 写 Forum
  → Forum 形成事件与审计记录
  → svc-forum 通知目标 Agent
```

这样既保留 Agent 协作能力，也避免把匿名 `deliver(agentId)` 变成跨 Agent 后门。

### 3.5 Admission 幂等原则

child Spec 必须冻结以下最小原则：

```text
IDEMPOTENCY_KEY = (authenticatedCallerId, requestId)
SAME_KEY_SAME_PAYLOAD = RETURN_PREVIOUS_OR_CURRENT_STATUS_WITHOUT_BLIND_REENQUEUE
SAME_KEY_DIFFERENT_PAYLOAD = CONFLICT
PENDING_OR_UNKNOWN = DO_NOT_BLINDLY_ENQUEUE_AGAIN
```

由于 durable ledger 与 DSH inbox 不是同一个事务，V1 不得虚假宣称严格 exactly-once。可接受的诚实语义是：

- 已确认 accepted：重复请求返回同一 receipt，不重复入队；
- 已 durable reserve 但最终 admission 未知：返回 `outcome_unknown` / equivalent，不自动重投；
- payload hash 不同：409 conflict；
- 后续是否提供人工 reconcile 或安全重试，由 child Spec 明确。

---

## 4. Child Spec A — Agent Process Lifecycle Hardening V1

建议 Spec ID：

```text
AGENT_PROCESS_LIFECYCLE_HARDENING_V1
```

该 Spec 解决审计问题 4，最小必须冻结：

1. `AgentProcess` 显式状态：至少 `new/spawning/initializing/ready/exited`；
2. Registry 不得向并发调用者返回尚未 ready 的裸 process；并发启动共享一个 startup promise；
3. child `error/exit` 时立即 reject 并清理全部 pending RPC timer/waiter；
4. `initialize`、`session/prompt receipt`、`rpc.response` 都必须有有界 deadline；
5. ready 失败必须从 Registry 清理，并确保失败 child 被终止或已退出；
6. stdin 不可写 / stream error 必须让对应请求失败；
7. turn 的 event watermark 必须在 prompt 发出前建立，避免 response/event 同 chunk 竞态；
8. 一个失败或退出不得永久 wedged `turnQueue`；
9. shutdown 超时后的最终行为必须明确，不能只返回“timeout object”却留下未知活进程；
10. events / stderr / creation evidence 至少有明确容量策略，不能无限增长。

强制故障验收：

```text
CHILD_EXIT_BEFORE_INITIALIZE_REPLY
CHILD_EXIT_AFTER_PROMPT_WRITE_BEFORE_RECEIPT
STDIN_WRITE_FAILURE
INITIALIZE_NEVER_REPLIES
PROMPT_RECEIPT_NEVER_REPLIES
RESPONSE_AND_EVENTS_IN_SAME_STDOUT_CHUNK
CONCURRENT_ENSURE_RUNNING_DURING_INITIALIZE
READY_FAILURE_THEN_NEXT_MESSAGE_RESPAWNS
```

边界：

```text
DSH_KERNEL_CHANGE = NONE
SESSION_MODEL_CHANGE = NONE
ROUTER_PRODUCT_POLICY_CHANGE = NONE
```

---

## 5. Child Spec B — Notification Ingress Service Auth and Admission Idempotency V1

建议 Spec ID：

```text
NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1
```

该 Spec 解决匿名入口和 Forum / Workflow 正式接入前的契约，必须覆盖：

- credential document / rotation / permission validation；
- authenticated caller resolution；
- 固定 allowlist `svc-forum` / `svc-workflow`；
- 401 / 403 / 409 / outcome-unknown error envelope；
- caller credential 绝不进入 Agent child；
- `(callerId, requestId)` durable idempotency；
- same-key/different-payload conflict；
- crash point matrix：reserve 前、reserve 后、inbox receipt 前、receipt 后、result persist 前；
- Agent process 直接请求必须失败的真实测试；
- Router 继续保持 Workflow / Forum 语义无知。

在该 child Spec implementation 合并前：

```text
FORUM_NOTIFICATION_CUTOVER = BLOCKED
WORKFLOW_NOTIFICATION_CUTOVER = BLOCKED
```

---

## 6. Child Spec C — Scheduler Timeout Outcome V1

建议 Spec ID：

```text
SCHEDULER_TIMEOUT_OUTCOME_V1
```

该 Spec 解决审计问题 5，并依赖 Child Spec A 的进程生命周期保证。

必须冻结：

1. timeout 在未证明执行终止时记录为 `outcome_unknown` 或语义等价状态，而不是普通 `error`；
2. one-shot 非幂等任务在 outcome unknown 后不得自动重试；
3. recurring job 必须明确当前 occurrence 与下一自然 occurrence 的关系，不能把同一次未知执行当作确定失败重复跑；
4. AbortSignal 是否只表示观察、能取消排队项、能取消 active turn，必须诚实标注；
5. late settlement 必须记录 evidence，不能静默覆盖先前的 timeout 状态；
6. 如果实现选择 kill AgentProcess 作为终止手段，必须证明不会错误杀死另一个 surface 已在执行的 turn；否则不得采用；
7. Scheduler concurrency slot、AgentProcess turnQueue 和 timeout clock 的起点必须明确；
8. 不允许“测试只看到 signal.aborted=true”就宣称 end-to-end cancellation PASS。

最小故障验收：

```text
TIMEOUT_BEFORE_QUEUED_TURN_STARTS
TIMEOUT_DURING_ACTIVE_TURN
LATE_SUCCESS_AFTER_TIMEOUT
LATE_EXTERNAL_SIDE_EFFECT_AFTER_TIMEOUT
ONE_SHOT_UNKNOWN_NOT_RETRIED
RECURRING_UNKNOWN_NO_SAME_OCCURRENCE_DUPLICATE
PROCESS_EXIT_DURING_SCHEDULER_TURN
```

---

## 7. P1 Follow-ups（不阻塞前三项，但必须留档）

### 7.1 Production Runtime readiness

后续独立 Spec：

```text
PRODUCTION_RUNTIME_READINESS_V1
```

处理 async effect、Feishu connect、HTTP listen、disabled handle、graceful stop 与“ready 必须意味着所有 enabled component 已 ready”。

### 7.2 Trusted spawn helper restriction

后续独立 Spec：

```text
TRUSTED_SPAWN_HELPER_RESTRICTION_V1
```

当前 helper 的作用是：Control Plane 以 uid 505 运行，但 Agent 需要以 uid 502 运行；普通 505 进程不能自行切换成 502，所以通过一个 root-owned setuid 小程序暂时获得切换用户所需的权限，然后立刻降到 502 并启动 Agent。

`4755` 的人话含义：

```text
root 拥有这个程序
所有本地用户都能执行它
执行时它会暂时以 root 权限运行
```

当前 helper 虽然只允许最终变成 502，但没有限制“谁可以调用”和“只能启动哪个程序”。因此任意本地用户理论上都可以借它变成 uid 502。它不会让人变成 root，但会让调用者冒充当前所有 Agent 共用的运行用户。

后续最小收口方向：

- real uid 必须为 authsvc/505；
- 目标 uid/gid 不再由参数自由提供；
- program / trusted Node / DSH entry 必须固定或严格验证；
- 文件权限从 world-executable 收紧到仅可信 group 可执行；
- 清理危险环境变量；
- 保持 Kernel change = NONE。

### 7.3 Adversarial Agent isolation

未来触发条件：

- 引入互不信任租户；
- 一个 Agent 拥有其他 Agent 不应间接获得的高敏权限；
- Agent 可运行外部不可信代码；
- 发生真实 peer-agent 越权事件。

届时再创建：

```text
PER_AGENT_SECURITY_DOMAIN_V1
```

可能评估 per-Agent UID / container / VM / sandbox，但当前明确 defer，不能反向阻塞开发。

---

## 8. 与现有 Artifact 的冲突裁决

### 8.1 `docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md`

其中“one Agent = one DSH process（进程 = 安全域）”若被理解为 Agent 对 Agent 的对抗隔离，与当前 Owner 决策冲突。

本 Program accepted 后，当前 V1 解释改为：

```text
PROCESS = runtime/lifecycle/session-owner boundary
SHARED_HOST_UID = cooperative trust domain
PROCESS != adversarial peer-agent security boundary (current V1)
```

后续 docs convergence 必须同步文字，但不要求在本 draft PR 中修改旧文档。

### 8.2 `docs/TRUST-BOUNDARY-REPORT.md`

该报告关于“如果要求 A 无法攻击 B，需要 per-agent security domain”的调查证据仍然有效；但其推荐目标不再是当前 V1 的已兑现保证。

裁决：

```text
EVIDENCE_VALID = YES
CURRENT_OPERATIONAL_REQUIREMENT = DEFERRED
```

### 8.3 `docs/reports/agent-router-delivery-v0.md`

Delivery V0 的内部 admission 语义继续保留：Router 不理解 Forum / Workflow。

本 Program 只要求：

```text
HTTP_SERVICE_AUTH_OWNER = notification-ingress / trusted ingress boundary
ROUTER_BUSINESS_SPECIAL_CASE = NONE
```

### 8.4 `docs/decisions/SCHEDULER_V1.md`

D-005 的 cron/at/every、store、catch-up 与 backoff 决策继续有效；但“timeout 之后如何证明原执行已停止”未被冻结。

`SCHEDULER_TIMEOUT_OUTCOME_V1` accepted 后应以 amendment / supersession 形式补齐该缺口，不重写整个 Scheduler。

---

## 9. 实施顺序与 Merge Gate

严格顺序：

```text
0. AGENT_CORE_HARDENING_PROGRAM_V1 accepted + merged
1. AGENT_PROCESS_LIFECYCLE_HARDENING_V1: draft → review → accepted → implementation
2. NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1: draft → review → accepted → implementation
3. SCHEDULER_TIMEOUT_OUTCOME_V1: draft → review → accepted → implementation
4. PRODUCTION_RUNTIME_READINESS_V1（P1）
5. TRUSTED_SPAWN_HELPER_RESTRICTION_V1（P1）
```

规则：

- 每个 child Spec 独立 PR；
- child Spec PR 不改产品代码；
- implementation PR 的 base 必须已经包含对应 accepted child Spec；
- implementation 不得顺手实现下一 child Spec；
- 一个 child implementation 未通过故障验收，不开始依赖它的下一项；
- 所有修复默认 `KERNEL_CHANGE = NONE`。

---

## 10. Non-Goals / Frozen Boundaries

本 Program 不做：

- per-Agent OS UID / container / VM 隔离；
- 通用 IAM / Policy Engine；
- Agent-to-Agent 敌对模型；
- Forum / Workflow 业务逻辑进入 Router；
- 新 Session mapping layer；
- 重写 DSH agent loop；
- 在本 Spec PR 中修改任何产品代码；
- 一次 PR 同时修 Notification、AgentProcess、Scheduler；
- 以“localhost”“固定程序名”“只有我会调用”代替 caller authentication。

---

## 11. Alternatives Considered

### A. 只把调用程序路径写死

**拒绝。** HTTP 服务无法证明请求由哪个 executable 发出；同机 Agent 或其他进程可以复刻请求。可以把固定程序作为部署约定，但不能作为唯一认证。

### B. 一个共享 Notification token

**拒绝作为最终 V1。** 无法区分 Forum 与 Workflow，不能单独吊销，审计归因也不清晰。至少需要 per-service credential。

### C. 直接禁止 Agent 调用另一个 Agent

**拒绝。** Agent 协作是产品能力。正确做法是区分 conversation handoff、service notification 与 task delegation，而不是删除协作。

### D. 现在立刻做 per-Agent 强隔离

**暂缓。** 当前 Owner 明确选择合作式共享信任域以换取开发自由度。保留未来触发条件，不把它当作当前 blocker。

### E. Scheduler timeout 后照常 retry

**拒绝。** 没有 end-to-end cancellation 时，timeout 只说明调用方停止等待，不证明真实执行终止。

### F. 一次大 PR 全部修完

**拒绝。** 三个问题分别属于 ingress trust、process lifecycle、scheduler outcome；混做会使 Spec authority、回归范围和失败定位全部失真。

---

## 12. Acceptance Criteria（本 Program Spec）

本 Spec 可 accepted 的条件：

1. 明确冻结合作式 shared-host Agent trust model；
2. 明确撤销“当前进程边界已经防 peer-agent 攻击”的过度声明；
3. 明确 Agent-to-Agent work 必须保留；
4. 明确 Notification Ingress 只允许 `svc-forum` / `svc-workflow`；
5. 明确“固定程序”不是认证，必须使用 service credential；
6. 明确 Agent 不持有 service credential；
7. 明确 requestId 需要 caller namespace 与 outcome-unknown 语义；
8. 明确 AgentProcess、Notification、Scheduler 三个 child Spec 的独立范围；
9. 明确 Scheduler timeout 不等于 proven failure；
10. 明确实施顺序和 Spec-before-code merge gate；
11. 本 PR 只有本文件，无产品代码、无生产状态变化、无 Kernel change。

---

## 13. Final Output

```text
SPEC_ID = AGENT_CORE_HARDENING_PROGRAM_V1
SPEC_STATUS = draft
IMPLEMENTATION_AUTHORITY = NONE
CHILD_SPEC_REQUIRED = YES

AGENT_TRUST_MODEL = COOPERATIVE_SHARED_HOST_TRUST_DOMAIN
MALICIOUS_PEER_AGENT_DEFENSE = DEFERRED
AGENT_TO_AGENT_WORK_REQUIRED = YES

NOTIFICATION_INGRESS_ALLOWED_CALLERS = svc-forum, svc-workflow
ANONYMOUS_NOTIFICATION_INGRESS = REJECT
DIRECT_AGENT_USE_OF_NOTIFICATION_CREDENTIAL = REJECT

FIRST_CHILD_SPEC = AGENT_PROCESS_LIFECYCLE_HARDENING_V1
SECOND_CHILD_SPEC = NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1
THIRD_CHILD_SPEC = SCHEDULER_TIMEOUT_OUTCOME_V1

KERNEL_CHANGE = NONE
PRODUCT_CODE_CHANGE_THIS_PR = NONE
PRODUCTION_STATE_CHANGE_THIS_PR = NONE
```
