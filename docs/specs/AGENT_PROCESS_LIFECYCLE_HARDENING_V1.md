---
spec_id: AGENT_PROCESS_LIFECYCLE_HARDENING_V1
status: proposed
date: 2026-08-20
type: implementation-spec (spec only; no implementation this round)
repository: mayf3/dsh-agent-core
base_main: d83a2ff0e9644611707d7481ef88b4d7d49fb68e
scope:
  - AgentProcess lifecycle and readiness
  - RPC deadlines and child-exit cleanup
  - interactive turn timeout and late reconciliation
  - graceful shutdown and bounded process evidence
  - termination evidence seam consumed by Scheduler
references:
  - docs/specs/AGENT_CORE_HARDENING_PROGRAM_V1.md
  - docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md
  - docs/investigations/AGENT_PROCESS_INTERACTIVE_TURN_TIMEOUT_INVESTIGATION_V1.md
implementation_authority: none
---

# AGENT_PROCESS_LIFECYCLE_HARDENING_V1 — 进程生命周期、deadline 与未知结果收口

> 状态：**proposed**。
> 本轮：**SPEC ONLY**。
> 不 implementation；不修改 production；不修改当前 `DSH_AGENT_TURN_TIMEOUT=900000` 运维缓解；不修改 Scheduler；不 merge。

---

## 0. Authoring Result

```text
AGENT_PROCESS_LIFECYCLE_HARDENING_V1_SPEC = PASS
NEEDS_OWNER_DECISION = NO
SPEC_STATUS = proposed
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES
IMPLEMENTATION_ALLOWED = NO
```

`PASS` 只表示本 proposed Spec 已能完整表达 Owner 输入；不代表 independent review PASS、accepted、implementation PASS 或 merge authority。

---

## 1. Goal

AgentProcess 必须把以下事实分开：

```text
child spawn requested
child OS process created
initialize request sent
process ready
prompt bytes attempted
prompt receipt received
turn terminal observed
caller deadline expired
cancel requested
turn proven terminated
child real exit observed
```

目标是消除以下已确认缺陷：

- child `error` / `exit` 后 pending RPC 永久等待；
- initialize request 或 prompt receipt 无总 deadline；
- Registry 在 ready 前暴露 process，并发 caller 不能共享完整 startup；
- stdin write failure 不 reject 对应 RPC；
- array-index watermark 与 prompt send 顺序不能构成稳定归因；
- timeout 被当作 ordinary failure，但原 turn 继续运行并可能已有外部副作用；
- timeout 后同一 AgentProcess 可接收新 turn；
- late terminal 与最终 assistant output 无声丢失；
- graceful stop 超期后返回假终态，不 kill / 不 await real exit；
- `events`、`stderr`、`creations` 等 process state 无界增长。

V1 优先保证：不永久挂起、不错误复用、不自动重放、不把“停止等待”冒充“执行已终止”。

---

## 2. Authority and Boundaries

```text
Program authority = AGENT_CORE_HARDENING_PROGRAM_V1 (accepted)
Session/product authority = AGENT_WORKSPACE_SESSION_MODEL_V2 (accepted)
Evidence authority = AGENT_PROCESS_INTERACTIVE_TURN_TIMEOUT_INVESTIGATION_V1 (PASS)
Child Spec = AGENT_PROCESS_LIFECYCLE_HARDENING_V1 (proposed)
Implementation authority = NONE
```

Owner 边界：

```text
CONFIG_OWNER = AgentProcess / production deployment configuration
NOT_OWNED_BY = Feishu, Binding, Session, Scheduler
ONE_AGENT_ONE_PROCESS = PRESERVE
SESSION_MODEL_CHANGE = NONE
ROUTER_PRODUCT_POLICY_CHANGE = NONE
DSH_KERNEL_CHANGE = NONE
```

本 Spec 只定义 Scheduler 将来可消费的 termination seam；不实现或修改 Scheduler。

---

## 3. Current Evidence

当前 `packages/agent-router/src/process.js` / `index.js` 已确认：

1. `pending` waiter 只在 response 或可选 timer 上删除；child `error` / `exit` 不 reject 全部 pending。
2. `ready()` 的 `initialize` RPC 本身无 deadline；外层 retry timeout 无法打断一个永久不返回的 request。
3. `turn()` 的 `session/prompt` receipt 无 deadline。
4. `request()` 在 `stdin.write()` 同步 throw、callback error、pipe close/error 时没有统一 reject contract。
5. `ensureRunning()` 在 `proc.ready()` 前已 `registry.set(agentId, proc)`；并发 caller 可拿到 initializing process，而不是共享 startup result。
6. watermark 当前是 `events.length`；events 无界且 array index 不是可截断 buffer 的稳定 sequence。
7. turn deadline 只让 caller throw；child turn 继续，且 late assistant output 无 reader。
8. shutdown grace 超期可返回 `{ timeout: true }`，没有强制 kill，也没有 await real exit。
9. `events`、`stderr`、`creations`、stdout partial buffer 无明确上限。

真实事故 evidence 已证明：两个 300s caller deadline 后，原 turn 分别继续 46s / 32s 并 `completed`；其中一个在 timeout 前已产生真实购物车和知识库副作用。因此：

```text
TIMEOUT_WITHOUT_TERMINATION_PROOF != FAILED
TIMEOUT_WITHOUT_TERMINATION_PROOF = outcome_unknown
```

---

## 4. Process State Machine

### 4.1 States

唯一公开 lifecycle 顺序：

```text
SPAWNING
→ INITIALIZING
→ READY
→ DRAINING
→ EXITED
```

定义：

- `SPAWNING`：构造完成、spawn 正在进行或 child handle 刚建立，尚未开始 initialize。
- `INITIALIZING`：child 已建立，initialize 总 deadline 已启动，尚未满足 readiness contract。
- `READY`：initialize 成功，所选 provider 已注册，且 process 可接受业务 turn。
- `DRAINING`：不再接受新业务；正在 reject/settle waiters、graceful stop、kill 或等待 real exit。
- `EXITED`：该 generation 已有 terminal child-existence evidence，全部 pending RPC 已 settle，ready/startup/reap entry 已完成规定处置。Terminal evidence 只能是：(a) child 从未创建成功的 `spawn_failed_without_child`；或 (b) 对已创建 child 观察到真实 `exit`。任何已创建 child 都不得用 `spawn_failed_without_child` 绕过 real-exit proof。

### 4.2 Legal transitions

```text
SPAWNING -> INITIALIZING
SPAWNING -> DRAINING       # spawn/error failure cleanup
INITIALIZING -> READY
INITIALIZING -> DRAINING   # init timeout/error/child exit/stop
READY -> DRAINING          # explicit stop, fatal stream failure, child error/exit
DRAINING -> EXITED         # created child: real exit; no child created: spawn_failed_without_child; then cleanup
```

禁止：

```text
SPAWNING -> READY
INITIALIZING -> EXITED
READY -> EXITED
DRAINING -> READY
EXITED -> any state
```

Unexpected child `error` / `exit` 也必须先执行 DRAINING cleanup；若 real exit 已同时可见，可在同一 task 内完成 `DRAINING -> EXITED`，但不得跳过 cleanup semantics。

### 4.3 State invariants

```text
BUSINESS_TURN_ADMISSION_ALLOWED = state == READY && activeUnknownFence == false
REGISTRY_VISIBILITY_ALLOWED = state == READY
READY_IS_MONOTONIC_PER_PROCESS_INSTANCE = YES
EXITED_IS_TERMINAL = YES
EXITED_REQUIRES = real_exit_for_created_child | spawn_failed_without_child
```

一个 respawn 是新的 AgentProcess instance / processGeneration；不得把旧 `EXITED` object 复活。

---

## 5. Deadline Configuration Model

### 5.1 Four independent fields

```text
initializeTimeoutMs
promptReceiptTimeoutMs
turnTimeoutMs
shutdownGraceMs
```

四者不得合并成通用 `timeoutMs`，不得由 Feishu、Binding、Session 或 Scheduler 动态覆盖，也不得接受 per-message 任意 override。

| Field | Starts | Ends / meaning | Code default |
|---|---|---|---:|
| `initializeTimeoutMs` | transition to `INITIALIZING`, before first initialize write | process reaches `READY`, otherwise startup fails | 90000 |
| `promptReceiptTimeoutMs` | active turn watermark established, immediately before prompt write | exact `session/prompt` receipt arrives | 30000 |
| `turnTimeoutMs` | same point immediately before prompt write | exact turn terminal + required idle/termination evidence arrives | 300000 |
| `shutdownGraceMs` | transition to `DRAINING` for graceful stop | child exits voluntarily before forced kill | 30000 |

All values MUST be positive safe integers and MUST be validated fail-loud before spawning any AgentProcess.

### 5.2 Precedence and static ownership

```text
per-Agent static override
> global deployment value
> code default
```

Global deployment names:

```text
DSH_AGENT_INITIALIZE_TIMEOUT_MS
DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS
DSH_AGENT_TURN_TIMEOUT_MS
DSH_AGENT_SHUTDOWN_GRACE_MS
```

Compatibility requirement:

```text
if DSH_AGENT_TURN_TIMEOUT_MS is absent
and legacy DSH_AGENT_TURN_TIMEOUT is present
→ turnTimeoutMs = DSH_AGENT_TURN_TIMEOUT

if DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS is absent
and legacy DSH_AGENT_DELIVER_TIMEOUT is present
→ promptReceiptTimeoutMs = DSH_AGENT_DELIVER_TIMEOUT
```

Legacy env 只映射到四字段 resolved config，不形成第五个 timeout。当前 production 的 `DSH_AGENT_TURN_TIMEOUT=900000` 在未来 implementation rollout 中必须继续生效；本轮不修改该运维缓解。

Optional per-Agent override 是 deployment-owned、startup/process-start-only config，载体冻结为：

```text
<productionRoot>/agent-process-overrides.json
{
  "version": 1,
  "overrides": {
    "agt_xxx": {
      "initializeTimeoutMs": 90000,
      "promptReceiptTimeoutMs": 30000,
      "turnTimeoutMs": 900000,
      "shutdownGraceMs": 30000
    }
  }
}
```

每个字段 optional；未知字段、重复 key、未知 Agent、非正 safe integer 必须 fail-loud。文件只在 process-start configuration boundary 读取；已运行 process 的 resolved config immutable，不 file-watch、不 per-turn reload。

该载体独立于 `agents.json`，不扩大 AgentDefinition 的 identity/display-only schema；也不复用 model override 文件。

---

## 6. RPC and Stream Contracts

### C-001 — Every RPC has one absolute total deadline

每个 JSON-RPC operation 在创建时必须获得 monotonic absolute deadline；deadline 覆盖：

```text
pending entry creation
→ stdin enqueue/write completion
→ child processing/retry
→ matching response receipt
```

不得在 retry 时重置 deadline，不得把“每次 attempt timeout”冒充 total deadline。

Enforcement 使用 process-local monotonic clock：`deadlineMono = monotonicNow + budget`；audit 另存 wall-clock `deadlineAtWallMs`。系统时钟跳变不得延长/缩短 enforcement budget，wall-clock 字段不得反过来驱动 timeout。

Deadline source：

- initialize RPC/retries：remaining `initializeTimeoutMs`；
- prompt RPC：remaining `promptReceiptTimeoutMs`，同时受 active `turnTimeoutMs` 的更早 deadline 限制；
- shutdown RPC：remaining `shutdownGraceMs`；
- parent-RPC handling and `rpc.response`：remaining active turn deadline；若没有可归属 active turn，则从 receipt 时起最多 `turnTimeoutMs`，不新增第五个配置字段；
- 其他 internal RPC：必须由调用 contract 从以上 lifecycle budget 之一显式派生；禁止 `undefined` / infinite deadline。

### C-002 — Pending entry settles exactly once

Response、deadline、stdin failure、child `error`、child `exit` 可以竞争，但每个 pending RPC 只能 settle 一次；settle 必须同步删除 map entry并清理 timer/listener。

Late response 不得重新 settle 已 reject 的 caller。若它属于 `outcome_unknown` turn，则只能进入该 turn 的 bounded reconciliation record。

### C-003 — Child error/exit rejects all pending

```text
child error OR child exit
→ reject every pending RPC immediately
→ clear all RPC timers/listeners
→ pending.size = 0
```

Error 必须携带至少：`agentId`、`processGeneration`、RPC method 与 observed evidence。只观察到 child `error` 时使用 `code=AGENT_PROCESS_UNAVAILABLE`；只有真实 exit 已观察时才使用 `code=AGENT_PROCESS_EXITED`。两者都 reject pending，但不得把 stream/process error 冒充 real exit。

### C-004 — stdin failure rejects request

以下任一情况必须 reject 对应 RPC，不得留下 pending entry：

- `stdin.write()` synchronous throw；
- write callback error；
- stdin `error` / premature `close`；
- stream known non-writable before write。

若能证明 zero-byte / pre-send rejection，则可分类 `not_admitted`。若 bytes 是否到达 child 不可证明，则 prompt operation 必须进入 `outcome_unknown`；不得自动 replay。

### C-005 — Parent RPC is bounded

child→parent `rpc.request` handler 也受 total deadline。调用 hook 时必须传递 `{ deadlineMono, deadlineAtWallMs, signal }` cooperative cancellation context；deadline 到期后 response 为 bounded failure（若 pipe 仍可写），并记录 `cancelRequested` 与 `terminated` 为不同事实。

AgentProcess 只能强制 **one wire response / one waiter settlement / no automatic re-invocation**；它不能强行阻止已经运行的任意 Promise 或外部系统在 timeout 后产生一次迟到副作用。Late hook settlement 不得发送第二 response；side effect 是否已发生若不可证明，必须保留 `sideEffectOutcome=unknown`，不得自动重试该 parent RPC。

---

## 7. Registry and Startup

### C-006 — Registry exposes READY only

`registry.get(agentId)` 对业务 caller 只可返回 `READY` process。`SPAWNING`、`INITIALIZING`、`DRAINING`、`EXITED` process 不得出现在 ready registry 中。

实现必须把两类 entry 分离：

```text
readyRegistry: agentId -> READY AgentProcess
startupRegistry: agentId -> { resultPromise: shared Promise<READY AgentProcess>, generation }
reapRegistry: agentId -> { generation, reapPromise }   # failed/stop generation awaiting terminal child evidence
```

### C-007 — Concurrent startup shares one promise

并发 `ensureRunning(agentId)`：

```text
existing READY process → all callers receive same process
startup in progress → all callers await same startup resultPromise
reap fence exists → all callers immediately reject AGENT_PROCESS_REAPING
no READY/startup/reap → exactly one caller creates startup resultPromise before async work
```

同一 Agent 同一 startup generation 的 spawn count 必须为 1。不得把 initializing process object 直接交给 caller。

### C-008 — Ready failure cleans completely

任何 spawn/initialize/provider-readiness failure 必须分开 **caller result settlement** 与 **generation reap**：

```text
failure observed within initialize total deadline
→ mark DRAINING
→ reject all pending
→ ensure readyRegistry has no failed process
→ reject shared startup resultPromise once with same startup failure
→ delete startupRegistry result entry
→ if no child was created: record spawn_failed_without_child -> EXITED
→ if child exists: install reapRegistry fence -> kill immediately -> await real exit
→ on real exit: finish cleanup -> remove reapRegistry -> EXITED
```

Startup caller 不等待无限 OS reap：shared startup `resultPromise` 必须在 initialize deadline/failure observation 后 bounded reject。与此同时，只要该 generation 的 created child 尚无 real-exit proof，`reapRegistry` safety fence 就必须保留：后续 `ensureRunning(agentId)` 立即 structured reject `AGENT_PROCESS_REAPING`，不得等待、复用旧 child或 spawn 新 generation。

Startup failure 不走 ordinary graceful-stop grace：尚未 READY 的 child 不可信为可协作 shutdown，必须 kill + await real exit。若 spawn 在 child handle 建立前同步失败，则记录 `spawn_failed_without_child` 后可直接 cleanup / `EXITED`；此时没有 OS child 可 await。

失败 startup 不得留 orphan child、ready row 或 reusable half-ready object。Created child real exit 后必须完成 registry cleanup；若 exit 长期不可确认，Agent 保持 fail-closed reap fence，但 caller 不永久 pending。

### C-009 — Exit reaping is identity-safe

Exit cleanup 只能删除仍指向相同 processGeneration / startup promise 的 entry；旧 child 的迟到 exit 不得删除新 generation。

---

## 8. Turn Admission, Watermark and Receipt

### C-010 — Watermark precedes prompt send

每个 prompt-producing path（等待 terminal 的 `turn()`、receipt-only `deliver()`、Scheduler bridge 及未来业务入口）都先 mint `turnExecutionId`，再建立 monotonic event watermark，最后才允许 prompt bytes 写入。`deliver()` 的 caller 可在 receipt 后返回，但 AgentProcess 仍必须在后台跟踪该 exact execution 的 terminal/unknown fence；receipt-only 不等于 lifecycle-untracked：

```text
turnExecutionId minted
→ eventWatermarkSeq captured
→ reconciliation record installed
→ prompt receipt + turn absolute deadlines installed
→ prompt write attempted
```

watermark 必须是永不回退的 event sequence number，不得使用可截断 array 的当前 index/length 作为长期 identity。

### C-011 — Exact correlation

本 turn 只消费：

1. `eventSeq > eventWatermarkSeq`；
2. exact `sessionId`；
3. prompt receipt 的 exact `messageId`；
4. 与该 message/turn 关联的 exact terminal event。

前一 turn 的迟到 event 不得混入；本 turn 在 JSON-RPC response 前到达的 receipt event 不得因 watermark 建立过晚而丢失。

### C-012 — Prompt receipt has a deadline

Prompt receipt wait 使用 `promptReceiptTimeoutMs` total deadline。若 deadline 到期：

- proven pre-send rejection → `failed/not_admitted`；
- write may have reached child、receipt 丢失或 response late → `outcome_unknown`；
- 保留 bounded late-response correlation tombstone，以便迟到 receipt 建立 exact `messageId` 并继续 reconciliation；
- 不自动重写 prompt，不自动创建第二 request。

### C-013 — Queue and fence

每个 AgentProcess 同时最多一个 active turn。Queued-but-not-sent turns 必须有界（见 §11）。

当 active turn 进入 unresolved `outcome_unknown`：

```text
SAME_AGENTPROCESS_NEW_TURN_ADMISSION = FORBIDDEN
```

Fence 必须位于统一 `session/prompt` write boundary，覆盖 `turn()`、receipt-only `deliver()`、Scheduler bridge 及任何未来业务 prompt path；不得通过绕过 turn queue 的 delivery seam 向同一 process 注入新工作。

所有尚未 prompt-send 的 queued turns 必须以结构化 `AGENT_PROCESS_TURN_FENCED` reject；不得在 fence 解除后自动发送。Caller 若仍希望执行，必须在 reconciliation 后进行新的显式业务 admission；这不是自动 replay。

---

## 9. Turn Deadline and Outcome Model

### C-014 — Timeout is not ordinary failure

```text
turn deadline exceeded
AND exact turn termination not proven
→ outcome_unknown
```

`outcome_unknown` 表示 caller deadline 已到，但 success、failure、termination、外部副作用均未被证明。

禁止：

```text
timeout -> ordinary failed
timeout -> claim no side effect
timeout -> automatic replay
timeout -> immediately admit next turn on same AgentProcess
```

### C-015 — Outcome evidence and termination evidence are distinct

**Outcome evidence** 只回答 success/failure：watermark 后、exact `sessionId`、receipt `messageId` 与 DSH turn identity 关联的 `turn/end` reason。Uncorrelated terminal、其他 Session idle、process still alive 都不是 exact outcome evidence。

**Termination evidence** 只回答 exact execution 能否继续。V1 可信类型仅为：

1. `exact_terminal_then_idle`：上述 exact `turn/end` 已观察，随后同一 `sessionId` 的 status 为 `idle`，且两者之间没有同 Session 的 later turn/start；
2. `exact_queued_removal`：DSH 明确 acknowledgment **同一 `turnExecutionId` / prompt request / messageId** 尚未开始且已从 native queue 移除；
3. `child_real_exit`：承载该 turn 的 exact processGeneration 已真实 exit；
4. future accepted cancellation contract 的 exact turn terminal acknowledgment。

因此在 deadline 前：

- exact success outcome + `exact_terminal_then_idle` → `completed`；
- exact failure outcome + `exact_terminal_then_idle` → `failed`；
- proven pre-send zero-byte rejection → `failed/not_admitted`。

`child_real_exit` 可证明 termination，但没有 exact turn/end 时不证明 success/failure。仅本地 Promise rejection、AbortSignal、cancel request、时间流逝、caller disconnect、unrelated queue removal 或 unrelated Session idle 都不是 termination proof。

### C-016 — Unknown fence release

Fence 只能由 C-015 针对 **同一 active unknown turnExecutionId** 的 termination evidence 解除。特别地，`exact_queued_removal` 必须移除该 unknown execution 本身；移除别的 queued prompt 不影响 active fence。

Operator 猜测、固定等待时长、clear stale marker 不是 proof。

Child exit 可解除 process-level concurrency risk，但若没有 exact terminal outcome，turn 结果仍保持 `outcome_unknown` / `terminated_without_outcome`；不得改写为 ordinary failed。

---

## 10. Late Terminal Reconciliation and Reply

### C-017 — Late settlement is required

Timeout 后必须继续观察 exact turn，并记录：

```text
outcome_unknown -> late_completed
outcome_unknown -> late_failed
outcome_unknown -> terminated_without_outcome
```

- `late_completed`：可信 exact success terminal + termination/idle evidence；
- `late_failed`：可信 exact failure terminal + termination/idle evidence；
- `terminated_without_outcome`：只证明执行不能继续（例如 child real exit），但无法证明 success/failure。

历史 `outcome_unknown`、`deadlineAtWallMs`、late `settledAtWallMs` 与 termination evidence 必须在 §10/§11 的 bounded retention window 内可审计；late settlement 不得触发第二 prompt admission。

### C-018 — Final assistant output is retained, not silently dropped

Exact turn 的 final assistant output 必须进入 bounded reconciliation record，并随 `late_completed` event 暴露给原 caller/Router reconciliation seam。若超过 byte cap，保留尾部/最终 message与明确 `truncated=true`、original byte count；不得静默返回空字符串。

```text
AGENTPROCESS_AUTONOMOUS_USER_DELIVERY = FORBIDDEN
LATE_REPLY_DELIVERY = RETAIN_AND_EXPOSE_VIA_ORIGINAL_CALLER_RECONCILIATION_HANDLE
AUTOMATIC_UNSOLICITED_PRODUCT_SURFACE_DELIVERY = NO
```

即：AgentProcess 必须让迟到 reply 对原 caller/Router 可查询、可观察、可审计，但不自行或要求 Feishu/Mobile/其他 Product Surface 自动发送消息。本 child 明确选择 **不自动 unsolicited delivery**，避免在 caller 已收到 timeout 后制造新的跨 surface 产品行为；未来若要改变用户可见 delivery，必须由独立 accepted Product Surface Spec 授权。该选择不允许丢弃 output，也不允许通过重新 prompt/replay 用户消息补偿。

Reconciliation API contract：

```text
getTurnReconciliation(turnExecutionId) -> snapshot | not_found
readFinalAssistantOutput(turnExecutionId) -> { text, truncated, originalBytes } | not_available
onTurnReconciled(listener) -> disposer
```

Router owner 必须持有 process-independent bounded reconciliation store。AgentProcess 在 generation cleanup / object release 前把 unresolved/resolved record 与 output handoff 到该 store；因此 record 在 AgentProcess child exit / respawn 后仍可读取。V1 retention 保证是 **同一 control-plane runtime lifetime 内、直到 §11 允许的 resolved-record eviction**；不承诺跨 control-plane restart 的 disk durability。Eviction 必须增加 aggregate dropped counter，并让已知但被移除的 query 返回 `not_found`；不得把 eviction 解释为 turn success/failure或解除 unresolved fence。

### C-019 — Reconciliation identity

Late event 至少携带：

```text
agentId
processGeneration
turnExecutionId
sessionId
eventWatermarkSeq
promptRequestId
messageId (when eventually known)
deadlineAtWallMs               # audit only; enforcement uses private deadlineMono
initialOutcome
lateOutcome
cancelRequestedAtWallMs (optional)
terminationProven
terminationEvidence
finalAssistantOutput / truncated metadata
settledAtWallMs
```

---

## 11. Bounded State

所有 process-owned evidence 必须有明确 hard cap、O(1) eviction，并暴露 dropped/truncated counters。V1 固定 safety ceilings（不是第五类 runtime timeout/config surface）：

```text
MAX_EVENT_RECORDS = 10000
MAX_EVENT_BUFFER_BYTES = 8388608
MAX_EVENT_RECORD_BYTES = 1048576
MAX_STDERR_BYTES = 1048576
MAX_CREATION_RECORDS = 256
MAX_CREATION_RECORD_BYTES = 4096
MAX_STDOUT_PARTIAL_BYTES = 1048576
MAX_RPC_FRAME_BYTES = 1048576
MAX_PENDING_RPC = 1024
MAX_RECONCILIATION_RECORDS_PER_AGENT = 256
MAX_FINAL_ASSISTANT_OUTPUT_BYTES = 1048576
MAX_QUEUED_TURNS_PER_PROCESS = 64
MAX_QUEUED_PROMPT_BYTES_PER_PROCESS = 4194304
MAX_PROMPT_BYTES = 1048576
```

规则：

1. `events` 同时受 record count、total bytes、per-record bytes 三个 cap；使用 monotonic `eventSeq` ring，eviction 不重用 sequence。Oversized single event 保留 correlation header + explicit truncated metadata，不能分配原始无界 payload。
2. Live turn matcher 在 event arrival 时增量归因，不依赖无限历史 array。
3. Active turn/reconciliation 所需最小 correlation metadata 独立保存，受 per-Agent reconciliation cap 管理。
4. `stderr` 保留最新 tail；记录 `stderrDroppedBytes`。
5. `creations` 同时受 count 与 per-record bytes cap；保留最新 records并记录 `creationsDroppedCount/Bytes`。
6. stdout partial line 或完整 RPC frame 超 cap 是 fatal protocol error → DRAINING；parser 在分配/parse 前 enforce cap。
7. pending RPC 达 cap 时，新 RPC 在 write 前 fail-loud；不得 eviction 一个仍 pending waiter。RPC params/result frame 同样受 frame cap。
8. reconciliation cap 满且最旧 record 仍 unresolved 时，新 turn admission fail-loud；不得 eviction unresolved unknown。
9. queued turns 同时受 count、total prompt bytes、single prompt bytes cap；超限在 prompt-send 前 structured reject，并且不得缓存 oversized input。
10. 最终 assistant output cap 超限必须明确 truncated；不得无标记丢失。

Resolved reconciliation record 可 oldest-first eviction；unresolved `outcome_unknown` 不得因 cap 被忘记或解除 fence。Process-independent reconciliation store 使用相同 per-Agent cap；handoff 不得复制成第二份无界 payload。

---

## 12. Shutdown Model

### C-020 — Graceful, kill, real exit

```text
READY/INITIALIZING/SPAWNING
→ DRAINING
→ stop new admissions
→ reject queued-not-sent turns
→ send graceful shutdown within remaining shutdownGraceMs (if a created child/pipe is usable)
→ wait until grace deadline
→ if created child has no real exit: SIGKILL
→ for created child: await real exitPromise
→ reconcile every unresolved active turn as exact late terminal OR terminated_without_outcome(child_real_exit)
→ publish/handoff reconciliation record + exit evidence
→ reject/clear all pending RPC
→ cleanup startup/ready/reap registry entries
→ for no-child spawn failure: require spawn_failed_without_child evidence
→ EXITED
```

若该 generation 创建过 child，`shutdown()` 只有在 real child exit 已观察、所有 unresolved active turn 已 reconciliation/handoff、且 cleanup 完成后才能 resolve success。若 child 从未创建，只能以 `spawn_failed_without_child` terminal evidence 收口。禁止返回 `{timeout:true}` 作为终态。

### C-021 — Idempotent concurrent stop

并发 shutdown caller 必须共享一个 shutdown promise。重复 stop 不发送多次业务动作；若已 `EXITED`，返回已保存 exit evidence。

### C-022 — Grace expiry is escalation, not completion

`shutdownGraceMs` 到期只授权 kill，不代表 process 已退出。Kill 后必须 await real exit；若平台无法确认 exit，process 保持 `DRAINING`，不得进入 Registry、不得报告 `EXITED`。

---

## 13. Scheduler Termination Seam (No Scheduler Implementation)

AgentProcess implementation 必须提供 Scheduler 可消费、但不含 Scheduler policy 的通用 seam。

### 13.1 Snapshot

按 `turnExecutionId` 返回最小 owned snapshot：

```text
{
  turnExecutionId,
  agentId,
  processGeneration,
  phase: queued | prompt_sending | receipt_pending | running | outcome_unknown | terminal,
  promptReceipt: unknown | accepted | proven_not_accepted,
  initialOutcome: completed | failed | outcome_unknown | null,
  reconciledOutcome: late_completed | late_failed | terminated_without_outcome | null,
  outcomeEvidence: exact_turn_end_success | exact_turn_end_failure | null,
  cancelRequested: boolean,
  cancelRequestedAtWallMs: number | null,
  terminationProven: boolean,
  terminationEvidence: exact_terminal_then_idle | exact_queued_removal | child_real_exit | cancellation_ack | null,
  reconciliationHandle: turnExecutionId,
  finalAssistantOutputAvailable: boolean,
  finalAssistantOutputTruncated: boolean,
  updatedAtWallMs
}
```

### 13.2 Event

同一 identity 发布 at-most-once state transitions / reconciliation notification。Subscriber 重连或 event 丢失时可重新读取 snapshot；事件不是唯一 truth source。

### 13.3 Frozen semantic distinctions

```text
active turn timeout != active turn terminated
cancel requested != proven terminated
child kill requested != child exited
outcome_unknown != failed
late terminal reconciliation != retry
```

Scheduler 可用 seam：

- 判断 active turn 是否有 termination evidence；
- 分开记录 cancel requested 与 proven terminated；
- 对 `outcome_unknown` 等待/查询 `late_completed`、`late_failed` 或 `terminated_without_outcome`；
- 通过 `reconciliationHandle` 调 `readFinalAssistantOutput()` 获取 bounded late final assistant output，而不只得到 availability boolean。

本 Spec 不定义 occurrence identity、retry、same-job fence、Scheduler persistence 或 store mutation；这些继续属于 Scheduler authority。

---

## 14. Failure Taxonomy

```text
spawn_failed
initialize_timeout
initialize_failed
prompt_write_failed
prompt_receipt_timeout
turn_deadline_exceeded
parent_rpc_timeout
protocol_buffer_overflow
child_error
child_exited
shutdown_grace_expired
```

以上是 failure/evidence class，不自动等于 turn outcome。尤其：

- `prompt_write_failed` 若 admission 不可证明 → `outcome_unknown`；
- `prompt_receipt_timeout` 若 prompt 可能已接受 → `outcome_unknown`；
- `turn_deadline_exceeded` 无 termination proof → `outcome_unknown`；
- `child_exited` 证明 termination，但不必然证明 success/failure。

---

## 15. Rejected Alternatives

### timeout = ordinary failed

拒绝。停止等待不证明 turn 或副作用停止。

### timeout 后自动重发用户消息

拒绝。原 turn 可能仍运行且可能已产生非幂等外部副作用。

### unknown 时继续同 process 新 turn

拒绝。会与未知旧执行重叠，并污染 binding context、event attribution 与外部副作用顺序。

### Registry 暴露 initializing process

拒绝。Caller 可能在 ready 前调用业务方法，并发启动不能共享完整 startup result。

### 单一通用 timeout

拒绝。initialize、prompt receipt、active turn、shutdown grace 的起点和失败语义不同。

### per-message / Scheduler dynamic timeout override

拒绝。deadline 属于 AgentProcess deployment config，不属于消息、Session 或 Scheduler。

### shutdown grace 到期即返回 timeout 终态

拒绝。grace expiry 只触发 kill；必须 await real exit。

### 无限 evidence buffer

拒绝。常驻 per-Agent process 必须有明确 memory ceiling 和 truncation evidence。

### 把 timeout overrides 写入 AgentDefinition

拒绝。AgentDefinition 保持 identity/display-only；process config 使用独立 deployment-owned static file。

---

## 16. Future Implementation Acceptance

本轮不实现。未来 implementation 至少证明：

1. state transition 只走 legal graph；created child 必须 real exit，no-child spawn failure 使用 exact terminal evidence；
2. Registry 永远只返回 `READY`；
3. 30 个 concurrent `ensureRunning` → one spawn + one shared startup resultPromise；
4. initialize timeout → startup callers在 initialize deadline bounded reject；created child立即 kill并由 reap fence阻止新 generation，real exit 后 cleanup；
5. child `error` / `exit` → all pending reject，pending size 0，且 error/exit code不混淆；
6. stdin sync throw / callback error / close → request reject，无 leaked waiter；
7. every RPC has monotonic absolute total deadline，retry 不重置；wall clock只用于 audit；
8. 所有 prompt-producing path 的 watermark sequence 在 prompt write 前建立；
9. response 前到达的 receipt event 仍可正确关联；
10. prior-turn late event 不污染 current turn；
11. prompt receipt timeout 且 admission unknown → `outcome_unknown`；
12. active turn timeout 且 child继续 → `outcome_unknown` + same-process fence；
13. unknown 后 `turn()` / `deliver()` / Scheduler bridge 等所有 prompt path write count = 0；queued callers structured reject；
14. exact outcome evidence 与 termination evidence 独立测试；unrelated idle/removal 不能解除 fence；
15. late success → `late_completed` + final output reconciliation event；
16. late failure → `late_failed`；
17. child exit无 exact terminal → `terminated_without_outcome`；
18. timeout/user message automatic replay count = 0；
19. late output 在 child respawn 后仍可经 reconciliation handle读取，resolved eviction行为与 counters符合 contract；
20. parent-RPC timeout最多一个 wire response、不自动 re-invoke；late side effect unknown不误报；
21. graceful stop success → active unknown reconciliation/handoff + real exit before `EXITED`；
22. grace expiry → SIGKILL exactly once + await real exit；
23. concurrent shutdown shares one promise；
24. events/stderr/creations/stdout frames/pending/reconciliation/outputs/queued prompt 的 count 与 byte state 均不超过 cap；
25. unresolved unknown 不因 eviction 解除 fence；
26. legacy `DSH_AGENT_TURN_TIMEOUT=900000` compatibility生效；legacy deliver timeout只映射 promptReceiptTimeoutMs；
27. Scheduler seam 分开 outcome evidence / cancel requested / termination proven / reconciled outcome；
28. exact commit、environment、fault injection command、result evidence；
29. Scheduler code/store change = none for AgentProcess implementation PR；
30. Kernel change = none。

Fault matrix：

```text
SPAWN_ERROR_BEFORE_CHILD_HANDLE
INITIALIZE_REQUEST_NEVER_REPLIES
INITIALIZE_PROVIDER_NEVER_READY
STARTUP_RESULT_REJECTS_WHILE_REAP_FENCE_WAITS_REAL_EXIT
CHILD_EXIT_WITH_MULTIPLE_PENDING_RPC
STDIN_SYNC_THROW
STDIN_ASYNC_WRITE_ERROR
STDIN_CLOSE_AFTER_PARTIAL_WRITE
PROMPT_EVENT_BEFORE_RPC_RESPONSE
PROMPT_RECEIPT_NEVER_REPLIES
DELIVER_TIMEOUT_USES_PROMPT_RECEIPT_FIELD_AND_UNKNOWN_FENCE
DELIVER_CANNOT_BYPASS_ACTIVE_UNKNOWN_FENCE
TURN_TIMEOUT_THEN_LATE_SUCCESS
TURN_TIMEOUT_THEN_LATE_FAILURE
TURN_TIMEOUT_THEN_CHILD_EXIT_WITHOUT_TERMINAL
UNRELATED_IDLE_OR_QUEUE_REMOVAL_DOES_NOT_RELEASE_FENCE
LATE_OUTPUT_RETRIEVAL_AFTER_PROCESS_GENERATION_EXIT
UNKNOWN_REJECTS_QUEUED_TURNS
PRIOR_TURN_LATE_EVENT_AFTER_NEXT_CALL
GRACEFUL_SHUTDOWN_SUCCESS
SHUTDOWN_GRACE_EXPIRES_THEN_KILL
CONCURRENT_SHUTDOWN
EVENT_RING_WRAP_DURING_ACTIVE_TURN
STDERR_AND_CREATIONS_OVERFLOW
UNRESOLVED_RECONCILIATION_CAP_PRESSURE
CONCURRENT_ENSURE_RUNNING
OLD_GENERATION_LATE_EXIT_AFTER_RESPAWN
```

---

## 17. Spec Review Gate

Independent reviewer 必须确认：

- 五态 lifecycle 完整且 failure cleanup 不跳过 `DRAINING`；
- 四个 timeout 字段独立、static、owner 正确；
- 当前 `DSH_AGENT_TURN_TIMEOUT=900000` 兼容边界未被改变；
- 所有 RPC 有 total deadline；
- child exit/error 与 stdin failure 不泄漏 pending；
- Registry ready-only + shared startup resultPromise + nonblocking reap fence；
- ready failure bounded caller reject、kill、created-child real exit + cleanup；
- all prompt paths watermark before prompt send + exact receipt correlation；legacy deliver timeout无第五字段；
- outcome evidence与termination evidence分离且可执行；
- timeout unknown fence、no replay、late reconciliation 完整；
- final assistant output 有明确 handle/query/retention/eviction contract，且 AgentProcess 不越权自行向 Product Surface 发消息；
- shutdown 必须先 reconciliation/handoff，再以 created-child real exit或no-child terminal evidence收口；
- 所有长期 state 同时有 count/byte bound；
- Scheduler 只有 termination seam，没有 implementation；
- 本轮 docs-only，无 production、Scheduler、timeout mitigation、Kernel、merge 变化。

Review 输出：

```text
AGENT_PROCESS_LIFECYCLE_HARDENING_V1_SPEC_REVIEW = PASS | FIX_REQUIRED
REQUIRED_FIXES = [...]
VERDICT = READY_TO_ACCEPT | NOT_READY
```

Review recommendation 不自动等于 acceptance；status flip 由 authorized Owner / maintainer 完成。

---

## 18. Final Output

```text
AGENT_PROCESS_LIFECYCLE_HARDENING_V1_SPEC = PASS

BASE_MAIN = d83a2ff0e9644611707d7481ef88b4d7d49fb68e

PROCESS_STATE_MACHINE = SPAWNING -> INITIALIZING -> READY -> DRAINING -> EXITED
TIMEOUT_CONFIG_MODEL = initializeTimeoutMs,promptReceiptTimeoutMs,turnTimeoutMs,shutdownGraceMs; global defaults + optional static per-Agent override

CHILD_EXIT_PENDING_RPC = REJECT_ALL_AND_CLEAR
REGISTRY_READY_MODEL = READY_ONLY + SHARED_STARTUP_RESULT_PROMISE + FAIL_CLOSED_REAP_FENCE
WATERMARK_MODEL = MONOTONIC_EVENT_SEQUENCE_BEFORE_PROMPT_SEND + EXACT_RECEIPT_MESSAGE_ID

TURN_DEADLINE_OUTCOME = outcome_unknown_without_termination_proof
NEW_TURN_AFTER_OUTCOME_UNKNOWN = FORBIDDEN_ON_SAME_AGENTPROCESS_UNTIL_LATE_TERMINAL_OR_PROVEN_TERMINATION
LATE_TERMINAL_RECONCILIATION = late_completed | late_failed | terminated_without_outcome
LATE_REPLY_DELIVERY = RETAIN_AND_EXPOSE_VIA_ORIGINAL_CALLER_RECONCILIATION_HANDLE; AUTOMATIC_UNSOLICITED_PRODUCT_SURFACE_DELIVERY=NO

SHUTDOWN_MODEL = graceful_stop -> grace_expiry -> SIGKILL -> await_real_exit_for_created_child -> reconcile_active_unknown -> registry_cleanup -> EXITED
BOUNDED_BUFFERS = count_and_byte_caps_for_events,stderr,creations,stdout_frames,pending_rpc,reconciliations,final_output,queued_prompts

SCHEDULER_TERMINATION_SEAM = active_turn_snapshot + outcome_evidence_distinct_from_termination_evidence + cancel_requested_distinct_from_termination_proven + outcome_unknown_reconciliation_event

SPEC_STATUS = proposed
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES

IMPLEMENTATION_STARTED = NO
PRODUCTION_CHANGE = NONE
DSH_AGENT_TURN_TIMEOUT_900000_CHANGE = NONE
SCHEDULER_CHANGE = NONE
KERNEL_CHANGE = NONE
MERGE = NO
```
