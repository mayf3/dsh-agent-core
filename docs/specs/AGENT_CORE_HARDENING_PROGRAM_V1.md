---
spec_id: AGENT_CORE_HARDENING_PROGRAM_V1
status: draft
date: 2026-08-19
type: program-spec
implementation_authority: none
---

# Agent Core Hardening Program V1

> 性质：**Program Spec（只冻结问题、Owner 决策、authority 关系与实施顺序）**  
> 仓库：`mayf3/dsh-agent-core`  
> 原始基线：`main@93f9acf67cb9b4862fc9b8ffaf593630086285ba`  
> 工作分支：`agent/security-reliability-hardening-plan-v1`（Draft PR #11）  
> 本轮允许：Spec / Decision / authority 文本。  
> 本轮禁止：产品实现、生产 job 创建、missed-run 补跑、Scheduler store 修改、部署与 merge。

本 Program **不授权任何 Implementation PR**。任何实现必须拥有独立、已 accepted、且已存在于 implementation base branch 的 implementation Spec。

PR #11 当前允许的文档范围：

```text
docs/specs/AGENT_CORE_HARDENING_PROGRAM_V1.md
docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md
docs/AGENT_CORE_ROADMAP_V1.md
docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V1.md
docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md
```

除上述文档外，本轮不得修改代码、配置、production state 或 Scheduler store。

---

## 0. Program Authority

### 0.1 Peer-Agent trust-model convergence

本 Program 被 accepted 并 merge 后，正式承担以下 authority：

```text
AUTHORITY = PROGRAM_SPEC_FOR_AGENT_CORE_HARDENING_V1

AMENDS = [
  AGENT_CORE_PRODUCT_ARCHITECTURE_V1.PEER_AGENT_SECURITY_DOMAIN_CLAIM,
  AGENT_CORE_ROADMAP_V1.PEER_AGENT_SECURITY_DOMAIN_CLAIM
]

SUPERSEDED_CLAIM = one Agent = one process currently provides adversarial peer-Agent isolation
REPLACED_BY = AGENT_CORE_HARDENING_PROGRAM_V1
PRECEDENCE_ON_CONFLICT = AGENT_CORE_HARDENING_PROGRAM_V1
```

当前唯一解释：

```text
one Agent = one DSH process
= runtime / lifecycle / DSH_HOME / Session-owner boundary
!= current adversarial peer-Agent isolation boundary

same-host Agents under the shared runtime identity
= cooperative shared-host trust domain
```

`docs/TRUST-BOUNDARY-REPORT.md` 的调查证据继续有效：如果未来要求 Agent A 无法攻击 Agent B，需要额外 per-Agent security domain；但该目标不是当前 V1 已兑现保证或 blocker。

### 0.2 Scheduler authority correction

本 Program 早期 draft 曾写：

```text
SCHEDULER_TIMEOUT_OUTCOME_V1 MUST AMEND D-005
```

该 draft 语句在接受前由 Owner 新 ruling 撤销。D-005 已是 accepted Decision，既有 normative meaning 不允许在同一 stable ID 下被重新解释。

当前冻结：

```text
D005_DISPOSITION = SUPERSEDE
REPLACEMENT_DECISION = D-007 / SCHEDULER_OCCURRENCE_OUTCOME_V2
REPLACE_AFFECTED_TIMEOUT_AND_RETRY_SEMANTICS = YES
COMPLETE_STANDALONE_REPLACEMENT_REQUIRED = YES
```

D-007 必须完整重述：

- 哪些 D-005 语义保留；
- 哪些 timeout / retry / occurrence / session / migration 语义被替换；
- 新的完整 Current Truth。

未来 Agent 不得自行拼接 D-005 与 amendment 才得到当前 Scheduler 语义。

在 D-007 被独立 review 并 accepted 前：

```text
D005_CURRENT_AUTHORITY = YES
D007_STATUS = proposed
IMPLEMENTATION_AUTHORITY_FROM_D007 = NONE
```

D-007 接受时必须在同一次 docs-only authority transition 中完成：

```text
D-007: proposed -> accepted
D-005: accepted -> superseded-by-D-007
D-005.replaced_by = D-007
D-007.supersedes = D-005
Decision index / backlinks 同步
```

不得让 proposed D-007 提前夺取 accepted D-005 的 authority，也不得在 D-007 accepted 后继续把 D-005 当作需要人工 merge 的并行 current decision。

---

## 1. North Star

Agent Core 当前不缺新的业务组件，缺的是让已经存在的入口、进程与调度器在异常情况下仍然：

```text
可解释
可恢复
不会被匿名调用
不会无限挂住
不会把“超时”误报成“确定失败”
不会对同一业务 occurrence 产生重复外部副作用
```

开发顺序：

```text
Program / Current Decision
→ child implementation Spec
→ independent Spec review
→ accepted Spec 进入 implementation base
→ 最小实现
→ fault-injection compliance review
```

---

## 2. Owner 决策

### 2.1 当前 Agent trust model

```text
AGENT_TRUST_MODEL = COOPERATIVE_SHARED_HOST_TRUST_DOMAIN
MALICIOUS_PEER_AGENT_DEFENSE = OUT_OF_SCOPE_FOR_V1
PER_AGENT_OS_UID_ISOLATION_REQUIRED_NOW = NO
AGENT_CROSS_WORKSPACE_ACCESS_CURRENTLY_ALLOWED = YES
```

当前阶段允许 Agent 互相访问同一主机上的工作区和运行资源，以提高开发自由度与迭代速度。暂不把“Agent A 主动攻击 Agent B”作为 V1 blocker。

但以下边界继续成立：

```text
AGENT_CAN_READ_CONTROL_PLANE_CREDENTIAL_STORE = NO
AGENT_CAN_READ_NOTIFICATION_CALLER_CREDENTIALS = NO
AGENT_CAN_SELF_ASSERT_SERVICE_IDENTITY = NO
```

即：Agent 之间当前合作互信，不等于 Control Plane、Broker credential 或 service credential 可以交给 Agent。

### 2.2 Agent-to-Agent work 是产品能力

```text
AGENT_TO_AGENT_WORK_REQUIRED = YES
ANONYMOUS_AGENT_TO_AGENT_CALL = NO
NOTIFICATION_INGRESS_IS_AGENT_DELEGATION_API = NO
```

必须区分：

1. `switchAgent`：当前 Product Surface 切换服务 Agent；
2. Notification Ingress：可信业务服务把已成立的业务事件送达 Agent；
3. task delegation：Agent A 让 Agent B 工作。V1 首选通过 Workflow / Forum 留下业务事实，再由服务通知 B。

未来若需要低延迟直接 delegation，另行设计带真实 caller identity 的 capability；不得把 Notification Ingress 偷偷扩成匿名 `deliver(agentId)`。

### 2.3 Notification Ingress caller identity

```text
NOTIFICATION_INGRESS_ALLOWED_CALLERS = [svc-forum, svc-workflow]
ANONYMOUS_NOTIFICATION_INGRESS = REJECT
AGENT_CALLER_ON_NOTIFICATION_INGRESS = REJECT
CALLER_ID_FROM_REQUEST_BODY = UNTRUSTED
```

最小身份链：

```text
svc-forum / svc-workflow
→ 各自独立 service credential
→ Ingress 验证 credential
→ credential 映射 caller principal
→ allowlist
→ Router internal deliver primitive
```

固定程序名、固定 executable 路径和 localhost 都不是 authentication。Forum 与 Workflow 必须使用不同 credential，可独立轮换和吊销；raw credential 不得进入日志、响应、Agent workspace 或 Agent child 环境。

### 2.4 可靠性 hardening 必须拆分

```text
AGENT_PROCESS_PENDING_RPC_CAN_HANG_FOREVER = MUST_FIX
NOTIFICATION_INGRESS_ANONYMOUS_AND_NON_IDEMPOTENT = MUST_FIX
SCHEDULER_TIMEOUT_WITHOUT_TERMINATION_PROOF = MUST_FIX
```

三者不得在一个 implementation PR 中混做。

---

## 3. Current Facts

### 3.1 Notification Ingress

当前 HTTP adapter 暴露：

```text
POST /v1/deliver
{ requestId, agentId, sessionMode, message }
```

当前只依赖 loopback bind，没有 caller identity、caller allowlist 或 service credential。Router `agentRouter.deliver()` 可以继续作为内部 admission primitive；修复 owner 是 ingress/auth 边界，Router 不获得 Forum / Workflow 产品特例。

### 3.2 AgentProcess

当前 pending waiter 可能在 child `error/exit`、pipe 断开、initialize 无回复或 prompt receipt 无回复后永久不结束，继而 wedged `ensureRunning` 或整个 per-Agent turn queue。

### 3.3 Scheduler

当前 Scheduler 使用 `Promise.race()` 停止等待并发送 `AbortSignal`，但 Router / AgentProcess 没有真实 cancel + proven termination seam。因此：

```text
AbortSignal sent != Agent turn proven terminated
TIMEOUT != PROVEN_FAILURE
```

当前实现还把 timeout 折叠为普通 error，并可能进入 retry/backoff；当前默认 isolated Session 是稳定 per-job：

```text
agent:<agentId>:cron:<jobId>
```

这与 D-006 的“每次 scheduled execution 使用 fresh non-main Session”冲突。

### 3.4 Scheduled-work migration evidence

输入 evidence：

```text
OPENCLAW_TO_AGENT_CORE_SCHEDULED_WORK_MIGRATION_AUDIT_V1 = PASS

OpenClaw jobs total = 280
enabled = 140
disabled = 140
Agent Core production jobs = 0

SAFE_READ_ONLY = 0
IDEMPOTENT_WRITE = 0
NON_IDEMPOTENT_SIDE_EFFECT = 113
RECORDING_OR_REMINDER = 4
DAEMON_OR_LONG_RUNNING = 3
OBSOLETE_OR_DUPLICATE = 13
BLOCKED = 7

pre-existing timeout/error = 63 / 140
missed runs since cutover = 94
READY_TO_RESTORE_BEFORE_HARDENING = 0
```

这批 evidence 说明 timeout / retry / occurrence identity 不是理论优化：当前 enabled fleet 绝大多数会产生非幂等外部副作用，而没有任何 SAFE_READ_ONLY / IDEMPOTENT_WRITE 候选可在 hardening 前安全恢复。

---

## 4. Child Specs

### 4.1 Agent Process Lifecycle Hardening V1

```text
SPEC_ID = AGENT_PROCESS_LIFECYCLE_HARDENING_V1
```

最小范围：

- process state；
- shared startup promise；
- child exit/error 后 pending RPC cleanup；
- initialize / prompt receipt / parent-RPC deadline；
- stdin/stream failure；
- event watermark；
- turnQueue 不永久 wedged；
- shutdown 最终状态；
- evidence buffer 有界。

```text
DSH_KERNEL_CHANGE = NONE
SESSION_MODEL_CHANGE = NONE
ROUTER_PRODUCT_POLICY_CHANGE = NONE
```

### 4.2 Notification Ingress Service Auth and Admission Idempotency V1

```text
SPEC_ID = NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1
```

最小范围：

- per-service credential；
- caller resolution + allowlist；
- 401 / 403 / 409 / outcome-unknown；
- `(callerId, requestId)` durable idempotency；
- same-key / different-payload conflict；
- crash-point matrix；
- Agent 直接请求失败；
- Router 继续保持业务无知。

在其 implementation accepted 前：

```text
FORUM_NOTIFICATION_CUTOVER = BLOCKED
WORKFLOW_NOTIFICATION_CUTOVER = BLOCKED
```

### 4.3 Scheduler Timeout Outcome V1

```text
SPEC_ID = SCHEDULER_TIMEOUT_OUTCOME_V1
SPEC_FILE = docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V1.md
STATUS = proposed
REPLACEMENT_DECISION = D-007 / SCHEDULER_OCCURRENCE_OUTCOME_V2
```

Owner 已明确要求在 PR #11 中先完成该 child Spec 与 proposed replacement Decision 文本。该范围变化仍是 docs-only，不授权实现。

该 child Spec 必须冻结：

- timeout without proven termination = `outcome_unknown`；
- `outcome_unknown` 对同一 occurrence 禁止自动 retry / re-admission；
- stable `occurrenceId` / `runId` / request idempotency key；
- durable occurrence execution states；
- same occurrence MUST NOT enter Router twice；
- `AbortSignal sent` 与 `turn terminated` 分离；
- D-006 fresh non-main Session per scheduled execution；
- OpenClaw migration no-catch-up 与 restore gates；
- D-005 由完整 D-007 supersede，不做同-ID normative amendment。

---

## 5. Implementation Dependency and Merge Gates

设计文本可以并行起草，但 implementation 依赖保持：

```text
1. AGENT_PROCESS_LIFECYCLE_HARDENING_V1 accepted + implementation PASS
2. NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1 accepted + implementation PASS
3. SCHEDULER_TIMEOUT_OUTCOME_V1 accepted + D-007 accepted + implementation
```

Scheduler implementation 至少依赖 AgentProcess 提供可信生命周期 / 终止 evidence；在 `cancel + proven termination` 尚不存在时，timeout 的唯一安全 terminal observation 是 `outcome_unknown`。

通用规则：

- proposed Spec / Decision 不授权代码；
- implementation base 必须包含 accepted governing Spec 与 accepted Current Decision；
- D-007 accepted 时 D-005 必须原子标记 `superseded-by-D-007`；
- 一个 implementation PR 不得顺手实现下一 child；
- acceptance 以 fault injection 与 contract-by-contract compliance 为准；
- 默认 `KERNEL_CHANGE = NONE`。

---

## 6. P1 Follow-ups

### 6.1 Production Runtime Readiness V1

处理 async effect、Feishu connect、HTTP listen、disabled handle、graceful stop，以及：

```text
RUNTIME_READY = every enabled component proven ready
```

### 6.2 Trusted Spawn Helper Restriction V1

当前 setuid helper 允许调用者临时获得“切到 uid 502 并启动程序”的 root 权限。后续最小收口：

- real uid 必须为 authsvc/505；
- target uid/gid 固定；
- trusted Node / DSH entry 固定或严格验证；
- 仅可信 group 可执行；
- 清理危险环境变量；
- Kernel 不变。

### 6.3 Per-Agent Security Domain V1

仅在出现不互信租户、高敏差异权限、外部不可信代码或真实 peer-Agent 越权事件后启动。当前不反向阻塞开发。

---

## 7. Artifact Disposition

### Product Architecture / Roadmap

旧 peer-Agent adversarial security-domain claim 已在本 PR 做最小 amendment / backlink。其余 ownership、thin-layer 与 DSH-native 方向保留。

### TRUST-BOUNDARY-REPORT

```text
EVIDENCE_VALID = YES
CURRENT_ADVERSARIAL_ISOLATION_REQUIREMENT = DEFERRED
```

### Agent Router Delivery V0

内部 admission primitive 保留；service authentication / idempotency 由 ingress boundary 拥有。

### D-005 Scheduler Replacement V1

```text
CURRENT_UNTIL_D007_ACCEPTED = YES
FINAL_DISPOSITION = SUPERSEDED_BY_D007
DIRECT_NORMATIVE_REWRITE_UNDER_D005 = FORBIDDEN
```

### D-006 Agent / Workspace / Session model

继续是 scheduled Session 产品语义 authority：

```text
each scheduled execution
→ fresh non-main Session
→ same Agent primary Workspace
```

D-007 必须完整吸收该约束。

---

## 8. Non-Goals

本 Program 不做：

- per-Agent OS UID / container / VM 隔离；
- 通用 IAM / Policy Engine；
- Forum / Workflow 业务逻辑进入 Router；
- 新 Session Mapping DB；
- 重写 DSH agent loop；
- production job 创建或启用；
- missed-run catch-up；
- OpenClaw job import implementation；
- Scheduler store 修改；
- Forum / Workflow credential provisioning；
- `channel:last` delivery；
- `payload.model` passthrough / model fallback；
- OpenClaw daemon deployment；
- merge。

---

## 9. Program Acceptance Criteria

本 Program 可 accepted 的条件：

1. cooperative shared-host trust model 与 Control Plane credential boundary 清楚；
2. Agent-to-Agent work、switchAgent、Notification、task delegation 正确拆分；
3. Notification 只允许 authenticated `svc-forum` / `svc-workflow`；
4. AgentProcess / Notification / Scheduler 三个 child scope 不混写；
5. timeout 不等于 proven failure；
6. D-005 disposition 已改为完整 supersession，不再要求同 stable ID amendment；
7. proposed D-007 完整重述 preserved / replaced D-005 semantics；
8. D-006 fresh scheduled Session 约束进入 Scheduler child；
9. OpenClaw migration no-catch-up 与 restore gate 已冻结；
10. 所有变更仍为 Spec / Decision text only，无代码、production state、store 或 Kernel 变化。

---

## 10. Final Output

```text
SPEC_ID = AGENT_CORE_HARDENING_PROGRAM_V1
SPEC_STATUS = draft
IMPLEMENTATION_AUTHORITY = NONE

AGENT_TRUST_MODEL = COOPERATIVE_SHARED_HOST_TRUST_DOMAIN
MALICIOUS_PEER_AGENT_DEFENSE = DEFERRED
AGENT_TO_AGENT_WORK_REQUIRED = YES

NOTIFICATION_INGRESS_ALLOWED_CALLERS = svc-forum, svc-workflow
ANONYMOUS_NOTIFICATION_INGRESS = REJECT
DIRECT_AGENT_USE_OF_NOTIFICATION_CREDENTIAL = REJECT

FIRST_IMPLEMENTATION_DEPENDENCY = AGENT_PROCESS_LIFECYCLE_HARDENING_V1
SECOND_IMPLEMENTATION_DEPENDENCY = NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1
THIRD_CHILD_SPEC = SCHEDULER_TIMEOUT_OUTCOME_V1
THIRD_CHILD_STATUS = proposed

D005_DISPOSITION = SUPERSEDE
D005_REPLACEMENT = D-007 / SCHEDULER_OCCURRENCE_OUTCOME_V2
D005_DIRECT_NORMATIVE_AMENDMENT = FORBIDDEN
D005_CURRENT_UNTIL_D007_ACCEPTED = YES

KERNEL_CHANGE = NONE
PRODUCT_CODE_CHANGE_THIS_PR = NONE
PRODUCTION_STATE_CHANGE_THIS_PR = NONE
SCHEDULER_STORE_CHANGE_THIS_PR = NONE
MERGE = NO
```
