---
spec_id: AGENT_TURN_CALLER_WAIT_RECOVERY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - caller-wait expiry recovery for exact Agent turns
  - parent-runtime timeout and recovery receipts
  - late child delivery suppression and exactly-once settlement
  - parent-runtime turn recovery control surface
  - durable bounded TurnRecoveryStore
  - foreground/background detach safety contract
governed_by:
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
date: 2026-08-27
repository: mayf3/dsh-agent-core
authoring_base_main: 4bab9c902931164fb6f812e46891daf9ee7bf68f
references:
  - docs/investigations/AGENT_TURN_CALLER_WAIT_RECOVERY_INVESTIGATION_V1.md
  - docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V2.md
---

# AGENT_TURN_CALLER_WAIT_RECOVERY_V1 — caller wait 超时自动回收与用户可见恢复

> 状态：**proposed**。只有独立验收、`status: accepted` 且合入 `main` 后，本文 Contracts 才可授予后续实现权限。
> 本 PR：**DOCS ONLY**。不实现、不部署、不重启 production，不修改任何 Agent、Session、Fence 或 Store 的运行状态。

## 0. Authoring result

```text
TASK_NAME = 超时 执行
ROUND = AUTHORITY_AUTHORING
SPEC_ID = AGENT_TURN_CALLER_WAIT_RECOVERY_V1
SPEC_STATUS = proposed
IMPLEMENTATION_AUTHORITY_NOW = NONE
IMPLEMENTATION_AUTHORITY_AFTER_ACCEPTANCE_AND_MERGE = contracts
PRODUCTION_APPLY_AUTHORITY = none
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
```

`implementation_authority: contracts` 是候选授权字段，不因 authoring、Draft PR 或 review 单独生效。后续实现必须以包含本 Spec accepted+merged 版本的 base 开始，完成 repository `DEVELOPMENT_PREFLIGHT`，严格受本文 Contracts 与 Acceptance 约束。Production apply、deployment、runtime restart 或配置写入均需独立部署轮授权。

## 1. Goal

在保留 `outcome_unknown` 与 exact fence 安全语义的前提下，为 caller wait 到期后的旧执行增加 parent-owned、durable、bounded 的自动回收与用户可见恢复：先停止等待并告知用户，再在后台精确取消；只有能证明不会影响同 generation 的其他活跃执行时才允许终止 exact child；只有 exact terminal outcome 或真实 child exit 才能 settle/release fence。

目标不是把 timeout 伪装成 ordinary failure，而是让 unknown execution 最终进入以下之一：

```text
exact late outcome
terminated_without_outcome with real-exit evidence
RECOVERY_REQUIRES_OPERATOR with fence retained
```

## 2. Scope and non-goals

### 2.1 In scope after acceptance and merge

- caller-wait expiry 后的 exact-turn durable recovery coordinator；
- exact graceful cancel、bounded grace、process occupancy safety gate、exact-child `SIGTERM`；
- parent-runtime direct receipts、surface-aware delivery、late suppression 与 receipt dedup；
- `turn_status`、`cancel_current_turn`、`recover_agent` parent control surface；
- bounded durable `TurnRecoveryStore`；
- foreground/background detach contract 及 caller-budget mechanical guard；
- fault-injection、integration 与 UX acceptance tests。

### 2.2 Non-goals / forbidden

- 本 authoring PR 的任何产品代码、运行态、Store 数据、Agent、Session 或 Fence 修改；
- production apply、部署、配置写入、重启或 kill；
- Route Chain 或 Luna V2 authority；
- Scheduler 功能、occurrence semantics、job schema、store 或 retry authority；本文只冻结所有 caller 必须遵守的通用 detach 合同；
- GLM、ARM64、HR Dispatcher、Workflow；
- Feishu-only recovery architecture；
- 任意 PID kill API；
- 与 PR #103 混合、依赖或共同交付。

## 3. Authority and dependencies

### 3.1 Authority relation

本文是 `AGENT_PROCESS_LIFECYCLE_HARDENING_V2` 的 additive、bounded child authority，不 supersede、不弱化也不重定义其 `outcome_unknown`、late reconciliation、real-exit proof、registry identity 或 exact fence 基本安全定义。

以下安全原则保持为上位约束：

1. caller wait 到期但没有 termination proof，结果必须是 `outcome_unknown`；
2. child 未被证明终止前，普通新 prompt 继续被 exact fence 拒绝；
3. `mutation_outcome_unknown` 不得自动 retry、replay 或重新提交；
4. 不得为改善体验直接删除、覆盖或绕过 fence；
5. 不得允许旧 turn 与新 turn 并发产生副作用；
6. 不得把重启整个 production runtime 作为正常恢复路径；
7. timer、cancel request/ACK、signal send success、PID 存活探测均不是 termination proof；
8. `SIGKILL` 不得作为普通自动恢复路径；
9. PID alone 与 PID reuse 不得授权 signal 或 fence release。

### 3.2 Authority activation

```text
AUTHORING_PR = docs only, no implementation authority
ACCEPTED_BUT_UNMERGED = inactive candidate authority
ACCEPTED_AND_MERGED_TO_MAIN = contracts may authorize bounded implementation
PRODUCTION_APPLY = separate authority always required
```

## 4. Current State

- `STATE-TWR-001` — 在 `mayf3/dsh-agent-core@4bab9c902931164fb6f812e46891daf9ee7bf68f`，caller wait 到期会持久表达 `outcome_unknown`、安装 exact fence 并停止 caller/route fallback，但普通 timeout 没有 parent-owned recovery coordinator。Environment：source/test audit；observed at 2026-08-27。Basis：`OBS-TWR-001`、`CLM-TWR-001`。
- `STATE-TWR-002` — 同一基线的 exact fence 仅在 exact terminal+trusted idle 或 exact generation child real exit 后 release；固定等待、cancel request、signal-send success 不构成 proof。Environment：source/test audit；observed at 2026-08-27。Basis：`OBS-TWR-002`、`CLM-TWR-002`。
- `STATE-TWR-003` — 同一基线没有 fixed parent-runtime timeout/recovery receipts、late delivery suppression ledger、durable recovery task/store 或 exact-turn parent control surface。Environment：source audit；observed at 2026-08-27。Basis：`OBS-TWR-003`、`OBS-TWR-004`、`CLM-TWR-003`。

## 5. Observations

### OBS-TWR-001 — Caller timeout stops waiting but does not stop the child

- Subject：AgentProcess caller wait path。
- Source revision：`4bab9c902931164fb6f812e46891daf9ee7bf68f`。
- Environment：pristine `origin/main` source/test audit。
- Observed at：2026-08-27。
- Method：静态追踪 route-chain → turn-execution → event-correlation，并复核 timeout/late-settlement tests。
- Result：deadline path marks unknown、rejects caller、installs fence；timeout-alone test asserts zero kill signals。
- Provenance：`docs/investigations/AGENT_TURN_CALLER_WAIT_RECOVERY_INVESTIGATION_V1.md` §1.1、§1.2、§1.5、§9.1。

### OBS-TWR-002 — Existing release requires exact proof

- Subject：unknown fence 与 process registry lifecycle。
- Source revision：`4bab9c902931164fb6f812e46891daf9ee7bf68f`。
- Environment：pristine `origin/main` source/test audit。
- Observed at：2026-08-27。
- Method：检查 event correlation、spawn exit callback、registry REAP/EMPTY transition 与 shutdown identity checks。
- Result：release 只来自 exact terminal+idle 或 exact child real exit；registry cleanup 绑定 exact generation/process identity。
- Provenance：同 Investigation §1.3、§1.4、§9。

### OBS-TWR-003 — Parent recovery UX and suppression are absent

- Subject：Router ingress、Product Surface delivery 与 processing reaction。
- Source revision：`4bab9c902931164fb6f812e46891daf9ee7bf68f`。
- Environment：source audit；不读取 production。
- Observed at：2026-08-27。
- Method：检查 ingress-delivery、active ingress context、reconciliation subscriber 与 Feishu reaction wrapper。
- Result：只有 generic best-effort delivery failure；没有 fixed A/B/C/D receipts、recovery follow-up、late suppression ledger；reaction 是 add/finally-delete wrapper。
- Provenance：同 Investigation §1.6、§1.7、§4。

### OBS-TWR-004 — Recovery evidence is not restart durable

- Subject：turn reconciliation/evidence stores。
- Source revision：`4bab9c902931164fb6f812e46891daf9ee7bf68f`。
- Environment：source audit；不读取 production。
- Observed at：2026-08-27。
- Method：检查 reconciliation store、runtime evidence、stderr tail 与 active ingress context lifecycle。
- Result：reconciliation 是 runtime-epoch memory；没有 durable recovery record、receipt state、cancel/SIGTERM/exit/fence timeline；active reply target caller settle 后清除。
- Provenance：同 Investigation §2、§7。

## 6. Claims and assumptions

### CLM-TWR-001 — Missing recovery coordinator causes indefinite safe fencing

- Support state：SUPPORTED。
- Supported by evidence：`EVD-TWR-001`。
- Contradicted by evidence：none known。
- Uncertainty：仅约束审计基线；实现轮须对 implementation base 重做 preflight。

### CLM-TWR-002 — Safe automatic termination requires exact ownership plus generation occupancy proof

- Support state：SUPPORTED。
- Supported by evidence：`EVD-TWR-002`。
- Contradicted by evidence：none known。
- Uncertainty：共享 process generation 的具体 occupancy data source 由实现选择，但 proof 语义不得降低。

### CLM-TWR-003 — User-visible recovery must be parent-owned and durable

- Support state：SUPPORTED。
- Supported by evidence：`EVD-TWR-003`。
- Contradicted by evidence：none known。
- Uncertainty：每个 surface 的 adapter 位置由实现 base 决定，不改变 surface-aware contract。

```text
OPEN_ASSUMPTION = NONE
```

## 7. Evidence relations

### EVD-TWR-001 — Timeout and release observations support the deadlock claim

- Source observations：`OBS-TWR-001`、`OBS-TWR-002`。
- Target：`CLM-TWR-001`。
- Relation：SUPPORTS。
- Bound coordinates：repository `mayf3/dsh-agent-core@4bab9c9`，source/test audit，2026-08-27。
- Strength/sufficiency：strong for the audited baseline；timeout produces no cancel/exit event, while fence release requires exact proof。
- Limitations：不证明 production drift；本轮禁止 production inspection。
- Provenance：input Investigation §1、§9.1。

### EVD-TWR-002 — Registry ownership observations support the kill gate

- Source observations：`OBS-TWR-002`。
- Target：`CLM-TWR-002`。
- Relation：SUPPORTS。
- Bound coordinates：repository `mayf3/dsh-agent-core@4bab9c9`，registry/spawn/shutdown source audit，2026-08-27。
- Strength/sufficiency：strong for rejecting PID-only or shared-generation termination。
- Limitations：不指定 occupancy index 的 implementation layout。
- Provenance：input Investigation §1.4、§3、§9。

### EVD-TWR-003 — UX/store observations support parent-owned durable recovery

- Source observations：`OBS-TWR-003`、`OBS-TWR-004`。
- Target：`CLM-TWR-003`。
- Relation：SUPPORTS。
- Bound coordinates：repository `mayf3/dsh-agent-core@4bab9c9`，Router/Product Surface/store source audit，2026-08-27。
- Strength/sufficiency：strong；expired child cannot reliably own dedup follow-up or restart recovery。
- Limitations：不授权具体 transport redesign。
- Provenance：input Investigation §1.6、§2、§4、§7。

## 8. Decisions

### DEC-TWR-001 — Recovery is an exact parent-owned background state machine

- Decision owner：repository owner `mayf3`。
- Decision：caller timeout 后由 parent durable coordinator 精确取消、bounded grace、proof-gated termination/settlement；expired turn 立即结束。
- Rejected alternative：让 expired child 自救、保持 caller 等待、重启 production runtime。
- Reason：child 已被 fence 且可能卡死；长等会重复触发 caller timeout；runtime restart 会影响无关执行。

### DEC-TWR-002 — SIGTERM requires generation occupancy proof

- Decision owner：repository owner `mayf3`。
- Decision：仅当 exact identity/ownership 且同 processGeneration 无其他 active Session/Turn 时自动 `SIGTERM`；不确定即 operator-required。
- Rejected alternative：PID-only kill、Agent-wide kill、无 occupancy proof 的 best effort kill、普通自动 `SIGKILL`。
- Reason：不得终止无关执行或允许旧/新副作用并发。

### DEC-TWR-003 — Timeout takes delivery ownership from the old child

- Decision owner：repository owner `mayf3`。
- Decision：`CALLER_WAIT_EXPIRED` durable reservation 时 old-child ordinary delivery 即永久进入 suppression gate，independent of receipt A transport state；parent 最多发一个 normalized terminal receipt。
- Rejected alternative：原回复与 recovery receipt 都投递、Feishu-only receipt path。
- Reason：保证 exactly-once、跨 surface 一致与用户可理解状态。

### DEC-TWR-004 — Recovery safety evidence is durable, bounded, and secret-free

- Decision owner：repository owner `mayf3`。
- Decision：引入 canonical schema v1 TurnRecoveryStore，atomic write、restart resume、bounded retention、unresolved 不自动 prune。
- Rejected alternative：只用内存 reconciliation、全量 stderr/prompt dump、容量压力下删除 unresolved evidence。
- Reason：restart 后必须继续 exact recovery，同时不扩大 secret retention。

## 9. Contracts

### CTR-TWR-001 — Timeout reservation and receipt

Caller wait 到期时，parent MUST in one durable transition persist `outcome_unknown` recovery identity、保留 exact fence、reserve one recovery task，并将 old-turn delivery suppression gate 置为 active；然后发送 timeout receipt A exactly once并 detach。Suppression MUST take effect at `CALLER_WAIT_EXPIRED` reservation，不依赖 A 的 transport state。Identity MUST bind `agentId + sessionId + turnExecutionId + processGeneration + processInstanceId + childSpawnId + childPid`。Reserve 失败 MUST fail-loud、保留 fence、拒绝 ordinary admission；MUST NOT 先宣称 recovery 已启动。

### CTR-TWR-002 — Exact graceful cancel and bounded grace

Coordinator MUST 为 exact `turnExecutionId` 生成 stable `cancelActionId`，先持久化 `cancelActionState=prepared` 与 `cancelRequestedAt`，再以该 idempotency key 请求 owning process graceful cancel。Receiver MUST durable-dedup the same `cancelActionId`；请求后记录 `sent|acknowledged|ambiguous`。Request/ACK MUST NOT 被当作 termination proof。Stale generation、session/turn/child mismatch MUST fail-loud with zero signal。只有 idempotency-keyed cancel 可在 restart 后重试；exact rerun MUST be NOOP/continue，不得创建第二 logical task/cancel/receipt。Coordinator 随后仅在 bounded grace 内观察 exact terminal/occupancy/real-exit evidence。

### CTR-TWR-003 — Exact outcome wins during grace

Grace 内获得 exact authoritative terminal 时，coordinator MUST 以 `late_completed | late_failed` exact outcome settle；MUST suppress old-child ordinary delivery；MUST persist terminal evidence before existing exact terminal/idle rule releases fence；MUST use atomic/CAS settlement so exact outcome wins over concurrent generic termination inference。

### CTR-TWR-004 — Process-kill safety gate

Grace 结束仍无 terminal 时，`SIGTERM` 仅可在以下全部 proof PASS 后发送：四元 identity、`processInstanceId`、`childSpawnId` exact match；registry 仍 owns same process instance/original child；childPid exact match；authoritative occupancy set `activeExecutions(processGeneration) - {timedOutExactExecution}` 为空；无 newer generation active/starting。Occupancy snapshot MUST be taken under the same registry lock/CAS transaction that reserves signal ownership，不能使用 cache/模型自述/过期 snapshot。Evidence missing/stale、无法枚举或存在其他执行 MUST yield `RECOVERY_REQUIRES_OPERATOR`、receipt D exactly once、zero SIGTERM、fence retained。

### CTR-TWR-005 — Safe SIGTERM and real-exit settlement

Gate PASS 后 coordinator MAY CAS exact slot into recovery/reap ownership，并生成 stable `sigtermActionId`，在 signal 前 durable-write `sigtermActionState=prepared` 与完整 exact identity，再向 exact owned child最多发送一次 `SIGTERM`，随后写 `sent` 并 bounded-wait real exit。若 crash/restart 看到 `prepared` 而不能证明 signal 尚未发送，MUST set `sigtermActionState=ambiguous`、进入 `RECOVERY_REQUIRES_OPERATOR`，MUST NOT resend；安全 at-most-once 优先于自动完成。Signal success MUST NOT settle/release。Real exit 后 MUST settle `terminated_without_outcome` unless exact parsed outcome already won；MUST persist exit/settle/fence evidence before exact fence release、registry cleanup与 B。Observation bound 内无 real exit MUST enter operator-required, emit D, retain fence；MUST NOT auto-`SIGKILL`。

### CTR-TWR-006 — Canonical recovery states

Recovery states MUST be `reserved | cancel_requested | grace_wait | late_outcome_settled | sigterm_prepared | sigterm_sent | sigterm_ambiguous | exit_observed | terminated_without_outcome | recovery_requires_operator`。Terminal states are `late_outcome_settled | terminated_without_outcome | recovery_requires_operator` only。前两者仅在 exact proof + durable write 后可 release；`sigterm_ambiguous` MUST transition to operator-required and MUST NOT auto-release。

### CTR-TWR-007 — Late suppression and exactly-once delivery

`CALLER_WAIT_EXPIRED` durable reservation 生效时，old turn ordinary business reply与old-generation late assistant reply MUST be suppressed，regardless of receipt A being `reserved|sending|sent|acknowledged|ambiguous|failed`。Exact success/failure、terminated-without-outcome、operator-required分别只可由 parent占用同一个 terminal receipt slot；原 reply 与 terminal receipt MUST NOT 同时发送。

```text
TIMEOUT_RECEIPT_COUNT = 1
TERMINAL_RECOVERY_RECEIPT_COUNT <= 1
DUPLICATE_REPLY = NO
LATE_CHILD_DELIVERY = SUPPRESSED_AFTER_TIMEOUT
```

Exactly-once count means **one surface-confirmed visible message per stable `receiptId`**，not merely one local reservation or send attempt。Every surface adapter MUST support stable idempotency/dedup key and reconciliation lookup by that key（native or existing parent outbox）；rollout to a surface without both capabilities MUST fail closed。Receipt reservation/send/ack/final state MUST separate persist。For ambiguous send，coordinator MUST reconcile by `receiptId` before retry；confirmed-present becomes acknowledged without resend，confirmed-absent MAY retry with the same key，unreconcilable remains pending/operator-visible and MUST NOT blind resend。Recovery settlement proceeds independently，but `TIMEOUT_RECEIPT_COUNT=1` is not considered satisfied until one visible A is confirmed；terminal receipt MUST remain queued and MUST NOT become visible before A is acknowledged。

### CTR-TWR-008 — User-visible receipt text

Parent runtime MUST direct-send through the originating surface, independent of fenced child。A、B、late-failure、D 的下列中文字符串（含标点）MUST be the complete byte-exact business payload，MUST NOT add any prefix/suffix/business text；C 仅允许本文明确规定的 final-result suffix。Transport envelope/framing is outside the business payload and MUST NOT alter it：

A — timeout：

> 本轮执行超过等待上限，结果暂时未知。系统正在停止旧执行，请勿重复提交。

B — safe recovery complete：

> 旧执行已停止，可以继续发送新消息。结果未知的操作没有被自动重试。

C — late success（并附唯一最终结果）：

> 本轮执行超过等待上限，但随后已确认完成。

C 的唯一允许附加格式为 byte-exact prefix 后追加 `\n\n最终结果：` 与唯一最终结果 payload；surface wrapper MAY encode transport framing but MUST NOT alter text or add a second business reply。

Exact late failure MUST consume the same terminal slot with normalized text：

> 本轮执行超过等待上限，随后确认执行失败。结果未知的操作没有被自动重试。

D — cannot recover safely：

> 旧执行尚未能安全终止，已暂停接收新操作，需要人工处理。

Raw `AGENT_PROCESS_TURN_OUTCOME_UNKNOWN` MUST remain logs/evidence only，不得成为 user-facing final text。

### CTR-TWR-009 — Surface-aware transport and reaction closure

Receipt transport MUST reuse each ingress's existing reply surface: Feishu、Product API、Notification ingress。Core MUST NOT hardcode Feishu shape/target。Processing reaction MUST be removed when timeout reservation hands delivery to parent（不等待 A transport acknowledgement）；and in all cases MUST be absent or converted to an existing explicit complete/failure state by B/C/D。Terminal follow-up MUST NOT add processing reaction。Cleanup failure MUST record sanitized evidence and bounded dedup，MUST NOT override settlement or retry forever。

### CTR-TWR-010 — Mandatory foreground/background detach

任何需要等待未来时间、Scheduler occurrence、外部审批、长 shell job 或外部回调的操作 MUST reserve durable background task，immediately return `taskId|jobId + status + nextStep`，normal-settle current turn，并由 independent occurrence/follow-up投递结果。Current turn MUST NOT sleep、continuous poll、wait occurrence、把 background completion 作为 reply prerequisite，或用 `job_output(wait=true)` 消耗到 caller timeout。Scheduler create/update 持久成功后 MUST immediately reply；same turn MUST NOT wait occurrence。本 Contract不授权 Scheduler 功能/store 改动。

### CTR-TWR-011 — Caller-budget wait guard

令 `B=remaining caller monotonic budget`、`R=parent-configured positive final-reply reserve`、`W=requested job_output wait timeout`。Parent MUST enforce `W <= B-R`。若 `B <= R` 或 `W > B-R`，MUST perform zero wait and fail-loud `BACKGROUND_DETACH_REQUIRED` with detach guidance；MUST NOT clamp then wait。`R` MUST be centrally configured/testable and child/tool MUST NOT set it to zero。

### CTR-TWR-012 — Closed parent control surface

V1 only authorizes `turn_status`, `cancel_current_turn`, `recover_agent`。They MUST execute in parent/registry, bypass fenced child, call no model, create no user prompt, and write no `session/prompt`。Ordinary prompts MUST remain fenced。Every operation MUST bind/verify `agentId + sessionId + turnExecutionId + processGeneration`；`recover_agent` convenience resolution MUST require exactly one matching unknown execution, else fail-loud and demand exact identity。

### CTR-TWR-013 — Control semantics, authorization, and audit

`turn_status` MUST be read-only allowlisted state；`cancel_current_turn` MUST idempotently reserve/return task without waiting；`recover_agent` MUST delegate the same coordinator。Stale/ambiguous identity MUST cause zero signal/fence mutation。Controls MUST use existing authenticated principal/authorization boundary and append sanitized audit containing principal, operation, four-part identity, decision, timestamp, taskId。They MUST NOT expose prompt/secrets/raw stderr/tool payloads or arbitrary PID/signal/kill parameters。

### CTR-TWR-014 — TurnRecoveryStore canonical schema v1

Parent-owned store MUST be restart-recoverable、atomic、bounded and MUST contain：

```text
schemaVersion=1, recordVersion, recoveryTaskId,
agentId, sessionId, turnExecutionId, processGeneration,
processInstanceId, childSpawnId, childPid,
callerWaitExpiredAt, lastProgressAt,
lastActionClass=none|read_only|mutation|unknown,
mutationOutcomeUnknown,
cancelActionId, cancelActionState, cancelRequestedAt,
sigtermActionId, sigtermActionState, sigtermRequestedAt,
exitCode, exitSignal, settleReason, fenceReleasedAt,
recoveryState, deliverySuppressionActive,
receiptTimeoutId, receiptTimeoutState,
receiptTerminalId, receiptTerminalKind, receiptTerminalState,
receiptReactionCleanupState,
stderrTailRedacted, stderrTailTruncated, stderrDroppedBytes,
createdAt, updatedAt
```

`processInstanceId` and `childSpawnId` MUST be unguessable/stable identities issued at process/spawn creation and independently matched by trusted registry/live-child handshake；they are not PID aliases。Action states MUST be `none|prepared|sent|acknowledged|ambiguous|failed`。Receipt states MUST be `none|reserved|sending|sent|acknowledged|ambiguous|failed`；for terminal receipts, **queued is canonically represented as `receiptTerminalKind != none` plus `receiptTerminalState=reserved`**，不得另造隐式状态。Terminal kind MUST be `none|late_success|late_failure|recovery_complete|recovery_failed`。`recordVersion` MUST provide CAS monotonicity。Transport failure MUST NOT overwrite recovery outcome。

### CTR-TWR-015 — Recovery data classification

`lastProgressAt` MUST use parent-observed event/status/RPC progress。Only trusted metadata may classify read_only/mutation；unknown MUST remain unknown。Observed/possible side effect MUST set `mutationOutcomeUnknown=true`，which MUST NEVER auto retry/replay。Stderr tail MUST be UTF-8-safe、redacted before persistence、max 64 KiB with truncation/drop counters。Store MUST NOT contain prompt正文、hidden content、token、credential、Authorization、cookie、full tool args/results或raw stderr全量。

### CTR-TWR-016 — Atomic write and restart recovery

Transitions MUST use crash-safe same-filesystem temporary full write + file sync + atomic rename/replace + directory metadata sync；unsupported durability step MUST fail-loud, never partial-overwrite fallback。Transitions MUST CAS on `recordVersion`；duplicate exact transition MUST be NOOP。Restart MUST scan both (a) unfinished recovery states and (b) any record where **`receiptTimeoutState != acknowledged` or (`receiptTerminalKind != none` and `receiptTerminalState != acknowledged`)**，even when `recoveryState` is terminal；it MUST resume receipt reconciliation/delivery with the same `receiptId` and preserve A-before-terminal ordering。Before any process action it MUST match `processInstanceId + childSpawnId + processGeneration + four-part turn identity` against trusted registry and live-child handshake；durable PID alone MUST NOT authorize signal。If exact non-PID identity/occupancy cannot be re-established, or `sigtermActionState=prepared|ambiguous` cannot prove unsent, coordinator MUST become operator-required with fence/evidence retained and zero resend。

### CTR-TWR-017 — Retention and capacity

```text
MAX_RECORDS = 10000
SETTLED_RETENTION = 30 days
STDERR_TAIL_MAX = 64 KiB per record
PRUNE_ORDER = oldest settled updatedAt first
UNRESOLVED_AUTO_PRUNE = FORBIDDEN
```

For pruning only, a record is `fully_settled` iff recoveryState is terminal, `receiptTimeoutState=acknowledged`, `receiptTerminalKind!=none`, and `receiptTerminalState=acknowledged`。Recovery-terminal records with pending/ambiguous/failed A or queued/unacknowledged terminal receipt remain unresolved and unprunable。Startup/write pruning MUST first remove fully_settled records older than 30 days, then oldest fully_settled until within cap。All other unresolved/operator-required/receipt-pending records MUST NOT auto-prune。If 10,000 records are unprunable, Store MUST fail-loud `TURN_RECOVERY_STORE_CAPACITY_EXHAUSTED`、retain fences and reject admission that would create unprotected execution；MUST NOT delete safety evidence。

## 10. Acceptance

### ACC-TWR-001 — No-tool timeout recovery

- Contracts：`CTR-TWR-001`、`CTR-TWR-002`、`CTR-TWR-004`、`CTR-TWR-005`、`CTR-TWR-006`。
- Method：fake-child integration with no terminal until graceful grace expires, then real exit after exact SIGTERM。
- Environment：isolated test registry/store；no production。
- Required evidence：state/receipt ledger, signal target identity, exit event, fence/next-prompt trace。
- Expected：A=1 → exact cancel → safe gate → real exit → terminated_without_outcome → fence release → B=1 → next prompt success。
- Failure：release before proof、wrong signal、duplicate task/receipt、next prompt remains fenced。

### ACC-TWR-002 — Stuck tool and shared-generation safety

- Contracts：`CTR-TWR-002`、`CTR-TWR-004`、`CTR-TWR-005`、`CTR-TWR-013`。
- Method：fault injection with stuck tool; matrix for unrelated Agent and same-generation active Session/Turn。
- Environment：multi-Agent/multi-Session isolated registry。
- Required evidence：before/after identities, signal audit, recovery state。
- Expected：exact owning child only；shared/unknown occupancy gives SIGTERM=0、D=1、operator-required、fence retained。
- Failure：any unrelated identity changes or is signaled。

### ACC-TWR-003 — Mutation unknown never retries

- Contracts：`CTR-TWR-001`、`CTR-TWR-015`。
- Method：mutation receipt observed before timeout, then recovery and follow-up status query。
- Environment：isolated fake mutation tool。
- Required evidence：store record and tool invocation count。
- Expected：marker=true、retry/replay=0；recovered next turn can query status。
- Failure：automatic second mutation invocation。

### ACC-TWR-004 — Late outcome suppression

- Contracts：`CTR-TWR-003`、`CTR-TWR-007`、`CTR-TWR-008`。
- Method：race exact late success/failure against exit callback and old reply delivery；repeat with A state=`reserved|sending|failed|ambiguous|acknowledged`。
- Environment：deterministic event scheduler。
- Required evidence：CAS winner, suppression activation transition, delivery ledger, payload count/content。
- Expected：suppression starts atomically at timeout reservation and old reply=0 for every A state。When A is not acknowledged, visible terminal count=0 and exactly one terminal kind/state=`reserved` is queued；after A acknowledgement, success gives C=1 + one final result or failure gives one normalized failure；terminal visible total<=1。
- Failure：terminal visible before A acknowledgement、more than one queued slot、double settle/reply or raw technical error to user。

### ACC-TWR-005 — Surface-aware UX and reaction

- Contracts：`CTR-TWR-008`、`CTR-TWR-009`。
- Method：Feishu/Product API/Notification ingress adapter integration matrix, including cleanup failure and send outcomes present/absent/ambiguous reconciled by stable receiptId。
- Environment：surface test doubles with native/outbox dedup and lookup。
- Required evidence：byte-exact user text, idempotency key, reconciliation trace, target identity, reaction lifecycle, sanitized cleanup audit。
- Expected：reconciled-present → one confirmed visible A and zero resend；reconciled-absent → retry same key then one confirmed visible A；lookup temporarily unavailable → A stays pending/operator-visible, zero resend, terminal receipt queued/not visible, count not falsely claimed；after lookup recovery it converges through one of the first two branches。After A acknowledgement, B/C/D are mutually exclusive total<=1。Reaction is not left processing；Core has no Feishu-only dependency。
- Failure：wrong text/target、duplicate receipt、unkeyed retry、terminal visible before A、false exactly-once claim while pending、permanent reaction、raw outcome code或 rollout to a surface without dedup+lookup。

### ACC-TWR-006 — Background detach and budget guard

- Contracts：`CTR-TWR-010`、`CTR-TWR-011`。
- Method：long shell/external callback/Scheduler create-update caller tests plus boundary values `B=R`, `W=B-R`, `W>B-R`。
- Environment：fake clock and job/occurrence services。
- Required evidence：turn settle time, returned task identity, wait calls, follow-up identity。
- Expected：immediate taskId/jobId/status/nextStep；independent follow-up；over-budget zero wait + `BACKGROUND_DETACH_REQUIRED`。
- Failure：same-turn future wait/poll/occurrence completion prerequisite。

### ACC-TWR-007 — Parent controls under fence

- Contracts：`CTR-TWR-012`、`CTR-TWR-013`。
- Method：authorized/unauthorized/stale/ambiguous control calls while business fence active。
- Environment：isolated parent runtime/control queue。
- Required evidence：auth decisions, audit entries, session/prompt write delta, signal count。
- Expected：valid status/cancel/recover works without child/model；ordinary prompt fenced；stale/unauthorized zero mutation；no arbitrary PID parameter。
- Failure：control writes prompt、bypasses auth or signals approximate target。

### ACC-TWR-008 — Store schema, restart, atomicity, retention

- Contracts：`CTR-TWR-007`、`CTR-TWR-014`、`CTR-TWR-015`、`CTR-TWR-016`、`CTR-TWR-017`。
- Method：schema validation；crash injection before/after every durable write、cancel send/ACK、SIGTERM send、A/terminal receipt reserve/send/ack and while terminal is queued；restart at every recovery/receipt state；PID reuse/non-PID handshake mismatch；secret corpus；retention/capacity。
- Environment：isolated filesystem, idempotent cancel receiver, surface receipt dedup/reconciliation, and registry/live-child simulator。
- Required evidence：on-disk schema/recordVersion/non-PID identities/action/receipt IDs, fsync/rename trace, receiver/surface dedup log, signal and visible-message counts, A-before-terminal trace, recovery transitions, secret scan, prune report。
- Expected：cancel retry uses same id and receiver applies once；SIGTERM prepared/ambiguous crash never resends and becomes operator-required；receipt restart keeps same receiptId, resumes reconciliation, produces no visible duplicate, and never exposes terminal before acknowledged A；terminal recovery state with pending/queued receipt survives/restarts and is unprunable；only fully_settled receipt-acknowledged records enter 30-day/oldest-first pruning；unfinished safe process states resume only after exact non-PID ownership recheck；no secrets；64 KiB bound；10,000 cap；capacity fail-loud。
- Failure：partial record、PID-only signal、second SIGTERM、second logical cancel、new receiptId/duplicate visibility、terminal-before-A、lost queued receipt、unresolved prune或secret persistence。

### ACC-TWR-009 — Global safety matrix

- Contracts：`CTR-TWR-001` through `CTR-TWR-017`。
- Method：aggregate assertions across ACC-TWR-001..008。
- Environment：CI/test only；production untouched。
- Required evidence：all mapped tests and diff scope report。
- Expected：

```text
DUPLICATE_CHILD = NO
DUPLICATE_REPLY = NO
AUTO_MUTATION_RETRY = NO
AUTO_PROMPT_REPLAY = NO
UNRELATED_SESSION_TERMINATED = NO
FENCE_RELEASE_BEFORE_PROOF = NO
SIGKILL_NORMAL_PATH = NO
PRODUCTION_RUNTIME_RESTART = NO
ARBITRARY_PID_KILL = NO
```

- Failure：any assertion differs。

## 11. Alternatives and disposition

- `ALT-TWR-001` — Timeout 后直接删除 fence：**REJECTED**；会允许 unknown old turn 与新 turn 并发副作用。
- `ALT-TWR-002` — 自动重试 mutation：**REJECTED**；outcome unknown 无法排除首次副作用已发生。
- `ALT-TWR-003` — PID-only/Agent-wide kill 或普通 SIGKILL：**REJECTED**；无法证明 exact ownership，可能终止无关执行。
- `ALT-TWR-004` — 重启 production runtime 解卡：**REJECTED** as normal recovery；影响所有 Agent，且不替代 exact evidence。
- `ALT-TWR-005` — 让旧 child 自己发送 timeout/final reply：**REJECTED**；child 可能卡死且会制造 double delivery。
- `ALT-TWR-006` — 当前 turn 等后台 job/occurrence 完成：**REJECTED**；消耗 caller budget并重现 unknown/fence。
- `ALT-TWR-007` — Feishu-only receipts：**REJECTED**；Product API/Notification ingress 必须获得同等 parent recovery semantics。

Investigation disposition：`AGENT_TURN_CALLER_WAIT_RECOVERY_INVESTIGATION_V1` 的 evidence/recommendation 被本文吸收为 proposed authority；Investigation 本身不授予 implementation。

## 12. Migration, compatibility, and rollback

1. 本 authoring PR migration/rollout 为 **NONE**。
2. 后续实现 MUST preserve existing reconciliation/fence semantics and treat TurnRecoveryStore as additive safety evidence；MUST NOT bulk-convert in-memory historical handles into fabricated durable proof。
3. Store starts at `schemaVersion=1`；unknown future schema MUST fail-loud and preserve bytes，不得降级覆盖。
4. Production activation is a separate deploy round and MUST include pre-activation store path/permission/capacity check、surface target compatibility和 rollback procedure。
5. Implementation/runtime rollback MUST first stop new recovery admission, preserve all unresolved records/fences, and hand unresolved executions to operator control；MUST NOT delete store/fence or restart whole production runtime as cleanup。
6. Receipt adapters MUST remain backward-compatible with each ingress's existing reply target/auth boundary；本文不授权 surface protocol replacement。

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

Implementation may choose internal module names, coordinator scheduling primitive and occupancy index layout only if every Contract/Acceptance remains exact。No such choice may weaken proof、identity、dedup、retention、surface or user-text semantics。

## 14. Review, implementation, and production gates

### Gate A — Spec acceptance

Independent reviewer MUST confirm state machine、kill gate、late suppression、surface-aware receipts、Store schema/retention、detach guard and complete Contract-to-Acceptance mapping。Only authorized acceptance transaction may set `status: accepted` and record reviewed base/head, reviewer and verdict。

### Gate B — Merge activation

Accepted candidate MUST merge into `main` to become active repository authority。Accepted-but-unmerged grants no implementation。

### Gate C — Implementation

A later independent implementation PR may modify code only after accepted+merged base preflight。It MUST reference this Spec, emit `DEVELOPMENT_PREFLIGHT` and `SPEC_COMPLIANCE`, stay within scope, and MUST NOT edit this governing Spec's normative body。

### Gate D — Production apply

`production_apply_authority = none`。Even merged implementation MUST NOT deploy/restart/write production config/store without an independently authorized deployment round。

## 15. Final authority statement

```text
TASK_NAME = 超时 执行
ROUND = AUTHORITY_AUTHORING

SPEC_ID = AGENT_TURN_CALLER_WAIT_RECOVERY_V1
SPEC_PR = populated after Draft PR creation
SPEC_HEAD = populated after commit/push

EXACT_TURN_CANCEL_REQUIRED = YES
PROCESS_KILL_SAFETY_GATE = exact identity + ownership + no other active Session/Turn in processGeneration; otherwise NO SIGTERM and RECOVERY_REQUIRES_OPERATOR
LATE_DELIVERY_POLICY = SUPPRESSED_AFTER_TIMEOUT; parent emits at most one normalized terminal receipt
USER_VISIBLE_RECEIPTS = A timeout exactly once; B/C/D mutually exclusive and total <= 1; surface-aware parent delivery
BACKGROUND_DETACH_CONTRACT = durable task + immediate taskId/jobId/status/nextStep; no future wait in current turn; BACKGROUND_DETACH_REQUIRED guard
CONTROL_SURFACE = parent direct turn_status + cancel_current_turn + recover_agent; exact four-part identity; auth/audit; no session/prompt and no arbitrary PID kill
TURN_RECOVERY_STORE = schema v1, atomic, restart-resumable, 10000 records, settled 30 days, unresolved never auto-pruned, redacted stderr tail <= 64 KiB, no secrets

PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
READY_FOR_REVIEW = YES
NEXT_TASK = 超时 审计
```
