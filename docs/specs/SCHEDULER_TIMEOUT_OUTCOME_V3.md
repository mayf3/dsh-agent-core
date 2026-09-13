---
spec_id: SCHEDULER_TIMEOUT_OUTCOME_V3
status: proposed
date: 2026-09-13
type: implementation-spec (whole-authority replacement of SCHEDULER_TIMEOUT_OUTCOME_V2; docs only)
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
replaces_on_acceptance: SCHEDULER_TIMEOUT_OUTCOME_V2
supersedes: [SCHEDULER_TIMEOUT_OUTCOME_V2]
superseded_by: null
scope:
  - Scheduler occurrence authority, timeout, termination-only settlement and fence semantics
  - single-document store v3, migration, rollback and evidence
  - trusted caller-owned exact current-epoch reconciliation on the Scheduler side
  - scheduler control projection; model-visible tool schema is deferred to Tools V3
governed_by:
  - AGENT_SELF_SERVICE_OPERATIONS_CONTROL_PLANE_V1
  - SCHEDULER_OCCURRENCE_OUTCOME_V3 (D-009)
  - AGENT_WORKSPACE_SESSION_MODEL_V3 (D-008)
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
external_authorities: []
owners: [mayf3]
references:
  - docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V2.md
  - docs/specs/AGENT_SELF_SERVICE_OPERATIONS_CONTROL_PLANE_V1.md
  - docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md
  - docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md
  - docs/investigations/AGENT_SELF_SERVICE_OPERATIONS_CONTROL_PLANE_V1_CENSUS.md
---

# SCHEDULER_TIMEOUT_OUTCOME_V3

> 状态：**proposed**。本轮只形成 Spec，不改产品代码、store 或 production。
> 在合法 acceptance transaction 合入 main 前，current implementation authority 仍是
> `SCHEDULER_TIMEOUT_OUTCOME_V2`；D-009 是 current Scheduler Decision authority。

## 0. Authoring result

```text
AUTHORING_INPUT = COMPLETE
OWNER_DECISION_REQUIRED = NO
READY_FOR_INDEPENDENT_REVIEW = YES
IMPLEMENTATION_ALLOWED_NOW = NO
```

accepted Program 与 D-009 已给出本 Spec 所需 Owner rulings。本文件只把已接受语义冻结为可实施、
可故障注入验证的 Scheduler contracts，不扩大 Agent 权限。

## 1. Goal

本 Spec 是 V2 的完整、自包含 whole-authority replacement。V2 的 occurrence identity、durable
reserve、at-most-once admission、timeout=`outcome_unknown`、fresh non-main Session、single-document
store、migration/no-catch-up 与 restore gate 均继续有效。

V3 唯一产品语义变化来自 D-009：

```text
business outcome = outcome_unknown                    # 不变
execution termination = terminated_without_outcome    # 新的独立事实
termination proof = exact + trusted + current epoch
old occurrence re-admission = forbidden
automatic retry = forbidden
same-job execution fence = released only after trusted exact termination
recurring continuation = next future natural slot only
one-shot continuation = none; definition atomically disabled
```

V3 同时冻结 self reconciliation 的 Scheduler-side seam。飞书可见名称、输入输出 schema、Router
trusted-caller binding 由后续 `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V3` 冻结；两者均 accepted、
merged 前不得开工产品实现。

## 2. Scope and non-goals

### 2.1 Scope

- `packages/scheduler` 的 job、occurrence、fence、store、recovery、control 与 evidence；
- `packages/scheduler-router` 已有 exact current-epoch reconciliation evidence 的受控消费；
- store v2→v3 原子升级、old-reader fail-loud、forward-fix rollback；
- operator outcome reconciliation 与 caller-owned termination-only reconciliation 的严格分离；
- CLI/control readback；model-visible schema 留给 Tools V3。

### 2.2 Non-goals

- 不新增 `trigger_once`、runtime reload、process kill、cancel 或 supervisor；
- 不允许跨 Agent 管理、run-as/OBO、模型输入 principal/agent identity 或权限自增；
- 不把 termination-only 说成 succeeded/failed/cancelled，也不证明外部副作用为零；
- 不允许 raw `jobs.json`/fence 修改、第二套 Scheduler authority、blind retry；
- 不创建、恢复、启用、补跑任何 production job；disabled domain 仍保持 disabled；
- 不实现 Workflow 业务修复、credential provisioning、delivery channel 或 distributed exactly-once。

## 3. Authority and dependencies

### 3.1 Authority map

```text
Program = AGENT_SELF_SERVICE_OPERATIONS_CONTROL_PLANE_V1 (accepted, main)
Scheduler Decision = D-009 SCHEDULER_OCCURRENCE_OUTCOME_V3 (accepted, main)
Session Decision = D-008 AGENT_WORKSPACE_SESSION_MODEL_V3 (accepted)
Current implementation Spec = SCHEDULER_TIMEOUT_OUTCOME_V2 (accepted)
Proposed replacement = SCHEDULER_TIMEOUT_OUTCOME_V3 (this file)
Visible tool authority = AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V3 (required successor)
```

### 3.2 Acceptance transaction

独立 review PASS 后，authorized owner/maintainer 在同一 docs-only commit 中原子完成：

```text
SCHEDULER_TIMEOUT_OUTCOME_V3: proposed -> accepted
SCHEDULER_TIMEOUT_OUTCOME_V2: accepted -> superseded
SCHEDULER_TIMEOUT_OUTCOME_V2.superseded_by = SCHEDULER_TIMEOUT_OUTCOME_V3
mutual backlinks = present
```

本轮不提前修改 V2。不得出现 V2 与 V3 并行 current implementation authority。

### 3.3 Implementation gate

产品代码开工前必须同时成立：

1. accepted Program、D-009、本 Spec、Tools V3 均已合入 main；
2. implementation base 精确包含上述 authority；
3. contract-by-contract test plan 覆盖 §10 和 §10.1；
4. 实现范围不混入 trigger_once、runtime reload、跨 Agent 或 production mutation；
5. production apply 另走 deployment authority、preimage、rollback、readback、fresh canary。

本 Spec 单独 accepted 不代表飞书 Agent 已获得新工具，也不代表 production ready。

## 4. Current state

- `STATE-001` — main 已有 V2 occurrence store、fence、operator reconciliation 与 control mechanics；
  D-009 已接受，但 V3 termination-only projection 尚未实现。
- `STATE-002` — Router 可对 exact `(occurrenceId, runId, requestId)` 给出 current-epoch disposition，
  包括 `terminated_without_outcome`；restart-lost/evicted/never-existed 不等于 termination proof。
- `STATE-003` — V2 fence rebuild 把每条无 late outcome settlement 的 `outcome_unknown` 都视为 active，
  因而不能表达“业务结果 unknown、但 execution 已证明终止”。
- `STATE-004` — 既有 self scheduler 工具可 list/runs/enable/disable own jobs，但 reconcile 仍为 operator-only；
  HR 不能通过正式飞书工具完成 inspect→reconcile→verify。
- `STATE-005` — HR 的旧 cdfd incident 经 runtime restart 后属于 restart-lost，不能作为 current-epoch
  self reconciliation 正例；最终 E2E 必须使用新的真实安全 current-epoch incident 或 effect-free canary。

坐标：`github/main@29a046c5497b578b796785a42c72512f6c69b974`，2026-09-13，本地只读检视。

## 5. Evidence and claims

### OBS-001 / CLM-001 — V2 无法安全释放 termination-only fence

- Evidence: V2 occurrence record 只有 business late settlement；fence projection 依据未解析 unknown 重建。
- Claim: additive 忽略新字段不安全；旧 reader 会重新激活 fence 或丢失新 authority。
- Support: direct source/spec inspection；无已知反证。

### OBS-002 / CLM-002 — Router evidence 可复用但不能由请求伪造

- Evidence: current Router reconciliation 以 exact triple 和 current runtime epoch 查找 live handle。
- Claim: Scheduler 可消费 disposition，但必须 server-side 派生 request correlation，拒绝模型提供 handle、
  PID、requestId、principalId、agentId、outcome 或 termination evidence。
- Support: accepted Program census 与 D-009；无已知反证。

### OBS-003 / CLM-003 — self ownership 能由 trusted caller 与 canonical job owner 相交证明

- Evidence: existing self scheduler surface 已使用 Router trusted caller identity 并限定 own jobs。
- Claim: 新 reconcile 可复用同一 identity boundary，无需新 Grant 或 HR 特权。
- Support: accepted Program census；不声称 remote body identity 可信。

### OBS-004 / CLM-004 — current cdfd 不是合格正例

- Evidence: incident 后 runtime 已 restart，旧 handle 不在 current epoch。
- Claim: 对该 incident 的 self reconcile 必须 `restart_lost` + zero write；这正是负例，而不是待绕过门槛。
- Support: local runtime/session lineage evidence；外部副作用仍 UNKNOWN。

无 open authority assumption。

## 6. Decisions

- `DEC-001` — whole-authority V3 replacement；不修改 accepted V2 stable meaning。
- `DEC-002` — canonical store 升级为 version 3；v2 reader/writer 遇 v3 必须 fail-loud。
- `DEC-003` — business outcome state 与 `terminationSettlement` 正交；不新增伪 terminal business state。
- `DEC-004` — operator reconcile 可判定 outcome；caller-self 只能追加 termination-only settlement。
- `DEC-005` — self path 只接受 trusted caller-owned exact current-epoch record；所有 identity/correlation
  由 server 派生。
- `DEC-006` — positive mutation 与 one-shot disable/fence projection 在同一 locked commit；negative
  disposition、mismatch、conflict 都是 zero-write。
- `DEC-007` — response loss 后以 server-derived deterministic operation identity 从 occurrence settlement
  幂等回读 receipt，不引入第二 operation store，也不重复 mutation。
- `DEC-008` — runtime reload 与 trigger_once 不进入 V1 delivery；自然下一 slot 是唯一恢复路径。

## 7. Contracts

Contract ID 在 accepted 后不得重编号或复用。C-001..C-037 是 V2 contracts 的 standalone
保留/必要替换；C-038..C-046 冻结 V3 delta。

### Preserved core contracts

- `C-001 Timeout outcome` — timeout without proven termination → `outcome_unknown`，不得按 ordinary
  failure 自动 backoff/retry。
- `C-002 Same occurrence` — unknown occurrence 永不 re-admit、不得获得第二个 runId/key。
- `C-003 Fence` — `outcome_unknown` 且既无 outcome settlement 又无 trusted termination settlement时，
  same-job execution fence active；时间流逝、abort request、lock stale-break 均不解除。
- `C-004 Ordinary failure` — `failed` 只用于 proven pre-start rejection 或 terminal failure；delivery
  outcome 独立于 execution outcome。
- `C-005 Identity` — 每条 record 持久绑定 jobId、reserve-time `ownerAgentId`、scheduleRevision、
  occurrenceId、runId、requestId/idempotencyKey、payloadHash、slot/retry coordinates、admittedAt 和可选
  nativeSessionId。Job 后续 retarget/delete 不改写历史 owner snapshot。
- `C-006 Durable state` — business states 仍只有 admitted/running/succeeded/failed/outcome_unknown；
  `terminationSettlement` 不改变这组 state。
- `C-007 Reserve first` — Router call 前必须原子持久 reserve；reserve 后 crash 不可再次 admission。
- `C-008 At-most-once` — 并发 tick/restart/recovery/control/late callback 均不得二次 Router admission。
- `C-009 Retry` — only proven ordinary failed 可按显式 policy 创建 new retry occurrence（new occurrenceId/
  runId/key，`retryOfOccurrenceId=direct predecessor`）。V2 default policy 继续为 one-shot 30s/60s/5m
  最多 3 次、recurring 30s/60s/5m/15m/60m；非幂等且无 downstream idempotency proof 时
  `AUTO_RETRY_DEFAULT=NO`。unknown 和 termination-only 都不自动 retry。
- `C-010 Cancel` — abort/cancel requested/local Promise settled 不等于 exact turn terminated。
- `C-011 Settlement` — late business outcome 与 termination-only evidence 都必须按 exact run 追加、
  审计、幂等；任何 settlement 不得触发 old occurrence second admission。
- `C-012 Clock` — execution timeout 从 durable admission/deadline 算；未 admission 的 concurrency
  等待不算 execution timeout。
- `C-013 Session` — 每 occurrence 使用 fresh non-main Session、same Agent、same primary Workspace；
  不使用稳定 per-job Session，不建第二 Session Mapping DB。
- `C-014 Migration` — OpenClaw definition import 不补跑 missed history；recurring 从 activation 后
  future natural slot 开始。
- `C-015 Missing Agent` — 缺 Agent ID 的 job blocked，不猜测或绑定 default Agent。
- `C-016 Stale one-shot` — past at target 不转为 now、不导入为立即执行。
- `C-017 Disabled` — disabled job 保持 disabled；cleanup 不是 enable authority。
- `C-018 Daemon` — daemon/long-running job 不进入 Scheduler。
- `C-019 Restore gate` — implementation、review、fault tests、migration prerequisites 未 PASS 前，
  production restore/enable count=0；`NON_IDEMPOTENT_SIDE_EFFECT` 与 `RECORDING_OR_REMINDER` 均不得
  auto-enable，disabled domains 也不得为 cleanup 临时 enable。
- `C-020 Decision disposition` — D-009 是 standalone current Scheduler Decision；历史 D-005/D-007
  仅作 superseded provenance。

### Store and execution contracts

- `C-021 Store` — canonical file 仍为 `<store>/jobs.json`，V3 document 为
  `{version:3,jobs,occurrences,fences}`；所有 mutation 共用 same-process FIFO、cross-process
  exclusive lock、re-read latest、single delta、fsync+atomic rename、RAM-after-commit。
- `C-022 Record` — normative schema（允许添加非 authority evidence 字段，不能替代下列字段）：

  ```text
  OccurrenceRecord {
    recordSchemaVersion: 2|3,
    occurrenceId, jobId, ownerAgentId?, scheduleRevision,
    kind: natural|retry|catchup,
    nominalScheduledAt?, retryOfOccurrenceId?, catchUpOfNominalAt?,
    runId, idempotencyKey, requestId?, payloadHash,
    state: admitted|running|succeeded|failed|outcome_unknown,
    admittedAt, executionDeadlineAtMs, startedAt?, endedAt?,
    executionOutcome?: succeeded|failed,
    deliveryStatus?: delivered|not-delivered|not-requested|unknown,
    nativeSessionId?,
    lateSettlement?: {resolvedTo:succeeded|failed,resolvedAt,
                      basis:trusted-late-evidence|operator-reconcile,evidenceRef},
    terminationSettlement?: {kind:terminated_without_outcome,businessStateAtCommit:outcome_unknown,
                             requestId,evidenceKind,evidenceId,
                             actorKind:self-agent|operator,actorId,actorProvenance,operationId,
                             fenceBefore,fenceAfter,scheduleDisposition,settledAt,committedAt},
    terminalEvidence?: {kind:pre-start-rejection|turn-terminal|late-settlement|
                             operator-reconcile|termination-only,detailRef},
    history: [{at,from,to,reason}]
  }
  ```

  V3-native reserve 必须写 `recordSchemaVersion=3`、ownerAgentId 与 requestId，缺失即 fail-loud。
  V2→V3 migration 只允许把既有 record 标记 `recordSchemaVersion=2`：其历史 authority 字段保持原值，
  requestId 可在 validation/correlation 时按 V2 invariant 视为 `idempotencyKey`，但不得持久 backfill；
  ownerAgentId 缺失不得从 current Job 猜测，因此 legacy record 永不符合 caller-self path，只能由 operator
  或既有 automatic late-outcome seam 处置。其他 authority 字段缺失/corrupt/unknown version 必须
  fail-loud，不能沿用 corrupt-job warn/drop 行为。history append-only；unknown→business terminal 必须同时
  留 lateSettlement；termination-only 必须同时留 terminationSettlement。
- `C-023 Deterministic IDs` — 使用无歧义 canonical encoding：

  ```text
  natural = occ:hex16(sha256(jobId,revision,'natural',nominalScheduledAt))
  retry   = occ:hex16(sha256(jobId,revision,'retry',retryOfOccurrenceId))
  catchup = occ:hex16(sha256(jobId,revision,'catchup',catchUpOfNominalAt))
  runId = 'run:' + occurrenceId
  idempotencyKey = requestId = occurrenceId
  ```

  `hex16` 是 sha256 hex 前 16 字符；字段编码须 length-prefix 或 canonical JSON。same ID+same logical
  coordinates 幂等返回 existing record，不能写第二条或 admission；same ID+different coordinates 返回
  structured collision/fail-loud。natural/catchup 对同 `(jobId,revision,nominal)` 联合唯一。每个 failed
  predecessor 至多一条 retry；retry 必须引用存在且 terminal-failed 的直接前驱，A→B→C 不得跳链。
  任何影响未来 schedule/payload/target/retry 的 update 都递增 scheduleRevision；历史 record 不变。
- `C-024 Payload hash` —

  ```text
  payloadHash = sha256(canonicalJSON({agentId,payload:{kind,message,
    timeoutSeconds,lightContext,model}}))
  ```

  canonicalJSON 键排序、无空白、omit undefined；delivery 不在 execution hash 内。任何 writeback/late
  settlement 的 hash mismatch 都 structured conflict/fail-loud。
- `C-025 Deadline` — reserve 时一次性持久：

  ```text
  timeoutMs = payload.timeoutSeconds*1000; absent => 3600_000
  executionDeadlineAtMs = admittedAt + timeoutMs
  ```

  restart 后不得从 now 延期；admission 前 concurrency queue 时间不计入。
- `C-026 Atomic admission` — 同一 lock 内 re-read latest jobs/occurrences/fences，验证 enabled、agentId
  runnable、nominal<=now、explicit backoff、migration gate、无同 logical slot record、无 active fence，
  然后 mint identity、append admitted record、更新 projection、fsync+rename；unlock 后才 Router call。
  任一失败不写 partial record；concurrent disable 不撤销已 admitted execution，其 outcome 仍须写回。
- `C-027 Writeback` — invocation 在锁外；结果以 exact occurrence/run 锁内写 latest document，不覆盖
  并发 job mutation、不复活 deleted job。
- `C-028 Fence projection` — active iff 存在 unresolved unknown with neither business nor termination
  settlement；projection 可完全从 ledger 重建，重建不 admission。
- `C-029 Operator reconcile` — control-only
  `reconcileOccurrence(occurrenceId,runId,{resolvedTo:succeeded|failed,evidenceNote})` 仅接受 unresolved
  unknown；trusted operator 可写 lateSettlement/history 并在无其他 unresolved unknown 时清 fence。身份
  来自 effective OS user/authenticated principal，body 自报 identity 无效；不重放、不删 history、不自动
  创建 retry。保留并扩展 termination-evidence 形式：trusted operator 也可不选择 business outcome，
  对 exact unknown 追加 `terminated_without_outcome`；business state 保持 unknown，使用 C-039 同一 schema，
  `actorKind=operator`，actorId/provenance 与 operationId 均来自 trusted control context，请求 body 不能伪造。
- `C-030 Legacy state` — runningAtMs/lastStatus/errors 等只是 derived projection，不能参与 admission、
  no-dup、ownership 或 termination；固定 2h clear-and-rerun 路径禁止。
- `C-031 Session mint` — admission 为 occurrence mint fresh non-main Session 并仅作 evidence 记录；新
  Job schema 不以 sessionTarget/sessionKey 选择执行 Session。
- `C-032 Control projection` — canonical domain control 完整保留 9 项：`createJob / submitOneShot /
  updateJob / enableJob / disableJob / deleteJob / listJobs / getJob / readRunOccurrenceEvidence`，并保留
  operator reconcile。CLI 精确保留 `add|list|runs|rm|enable|disable`；list/runs 扩展显示 occurrence、
  business state、termination settlement、fence。CLI control-only，不执行 due jobs。enable 不清 fence、
  不补历史。
- `C-033 Native upgrade` — V3 reader 同时承接 V2 的 legacy entry：

  - `version:1` 或 bare array：stop/drain/single-writer 后在 lock 内读取 latest，创建不覆盖的
    generation-specific V1 backup，写 `{version:3,jobs,occurrences:[],fences:{}}`；逐 job report 并 strip
    `runningAtMs`/legacy execution state，绝不 fabrication occurrence 或 outcome，也不自动 enable/restore。
  - `version:2`：同一流程创建 V2 backup；jobs、occurrences 的既有 authority/history 原样保留，仅为每条
    legacy occurrence 添加 `recordSchemaVersion=2` migration marker；ownerAgentId/requestId 保持 absent，
    不伪造 termination；按 V3 rule 重建 fences 后 atomic commit。
  - restart recovery：terminal record 不重放；admitted/running 无 proof → unknown+fence；停机期完全无
    record 的 slot，每 Job 每 downtime 至多一个 catchup（最近 eligible missed slot），不得绕过 fence；
    OpenClaw migration 仍是 zero catchup。
  - corrupt/unsupported version fail-loud。commit 前失败可保留原 store；version 3 一经提交只 forward fix。
  - V2 的旧 rollback-to-V1 allowlist（occurrences empty、fences empty、no unresolved unknown、no V2-era
    job mutation）在 V3 acceptance 后明确 `REPLACED_BY=C-038`；V3 采用更严格的“version-3 document/
    evidence 一经提交不得 downgrade”。rollback/re-upgrade 不得复用或恢复陈旧 generation backup。
- `C-034 Import` — dry-run 默认；写入守卫在 lock 内读 latest。target exists/contains data 且无 force
  则拒绝；force 最多 definitions-only，必须逐字保留 occurrences/fences/history，不能证明
  scheduleRevision/payloadHash 安全合并则 fail-loud。逐 job strip/report：lastRun/lastStatus/runningAt/
  error counters/retry/past-due nextRunAt、sessionTarget/sessionKey、wakeMode、dead everyMs/state.status；
  `payload.kind!=agentTurn` blocked；legacy timeout 规范化；invalid/unknown schedule、empty message、missing
  id/name/agentId、unknown delivery fail-loud/gap。source in-flight 仅 report+strip，不猜 outcome、不 enable。
- `C-035 Evidence` — runs.jsonl 只作 append-only bounded evidence（default 10MB，轮转仅保留完整最新行），
  至少记录 occurrence reserved、Router admission attempted/accepted/unknown、turn start、terminal/unknown、
  delivery、late settlement/operator or self reconcile、store upgrade。append resolve 前 fsync；evidence append
  failure 可观察但不篡改 authority，authoritative commit failure 则 RAM 不更新。
- `C-036 Dependency gate` — §3.3 未全部满足不得开工或合并产品实现。
- `C-037 Production gate` — implementation PR 不创建、enable、补跑、reconcile production records；
  deployment 和 fresh E2E 是后续独立 authority。

### V3 delta contracts

- `C-038 Store v3 exclusivity` — 首次 V3 write 前备份 V2；一旦 version=3 或任何 V3 evidence 存在，
  V2 reader/writer 必须 refuse。不得自动 downgrade；recovery 仅 V3-aware forward fix。
- `C-039 Termination settlement schema` —
  `terminationSettlement={kind:'terminated_without_outcome',businessStateAtCommit:'outcome_unknown',
  requestId,evidenceKind,evidenceId,actorKind,actorId,actorProvenance,operationId,fenceBefore,fenceAfter,
  scheduleDisposition,settledAt,committedAt}`。
  每个字段由 trusted server context/evidence 产生；business state 保持 outcome_unknown，executionOutcome
  不写 succeeded/failed/cancelled。self path 的 `operationId` 固定为
  `op:hex16(sha256('self-terminate-reconcile',callerAgentId,occurrenceId,runId))`，actorKind=self-agent；
  operator path 的 operationId 绑定 trusted control-context request identity，actorKind=operator；两者都不
  接受 body nonce/identity/operationId。`fenceBefore/After`、`scheduleDisposition` 是 commit 时快照，
  `settledAt=committedAt` 并冻结为同一 timestamp。settlement 自身就是 canonical receipt authority，不新增
  operations collection；只要 occurrence 保留，receipt 不得独立 eviction。
- `C-040 Exact Router correlation` — self reconcile 只消费 current runtime epoch 对 exact
  `(occurrenceId,runId,requestId)` 返回的 `terminated_without_outcome`。pending/restart_lost/evicted/
  never_existed/mismatch/conflict/unsupported 均不是 proof。`late_completed|late_failed` 是 trusted business
  outcome disposition，但不由 caller-self termination-only operation 写入；self operation 返回结构化
  `business_outcome_available` 且 zero-write，交给既有 authorized automatic/operator late-outcome seam。
- `C-041 Trusted self ownership` — caller identity 来自 Router trusted Parent context。locked latest state
  必须同时满足：job 存在、`job.id=occurrence.jobId`、`job.agentId=callerAgentId`、
  `occurrence.ownerAgentId=callerAgentId`。job 已 deleted、retargeted、owner snapshot 缺失/不一致，self
  path 一律以与 foreign/missing 相同的 opaque `not_found_or_not_owned` 拒绝且 zero-write、不得披露 occurrence，
  只能走独立 operator authority。retarget 后的新 owner 也因历史 owner snapshot 不匹配而不能 self reconcile；
  model/request 不得提供或覆盖 principalId、
  agentId、ownerAgentId、requestId、operationId、handle、PID、outcome、evidence、retry 或 force。
- `C-042 Atomic reconcile` — lock 内 re-read latest、validate exact identity/ownership/state/absence of
  conflicting settlement、validate Router disposition，然后同一 commit 追加 termination settlement、
  history、operation receipt、更新 fence；one-shot 同 commit disable。
- `C-043 Negative zero-write` — C-040 所列非正例（含 `business_outcome_available`）、ownership mismatch、record mismatch、non-unknown、
  already business-settled、payload conflict 均返回结构化 disposition且 authoritative store byte-for-byte
  不变；不得“先写处理中”。
- `C-044 Schedule disposition` — recurring 解除 fence 后只等待下一个 strictly-future natural slot，
  fence 期间 slot 全部丢弃不补；one-shot 原 nominal 已耗尽，在 settlement commit 中 definition disabled，
  不生成 retry/new at。
- `C-045 Concurrency and late outcome` — 同一 caller/occurrence/run 重试确定性得到相同 operationId；若
  exact termination settlement 已存在则从 record 回同 receipt、zero-write。相同 operationId 却绑定
  不同 caller/coordinates 为 corruption/conflict、fail-loud。
  concurrent operator/business settlement first valid commit wins；若 termination-only 已提交后收到 trusted
  late business outcome，可追加 business settlement但不得改写/删除 termination history或触发 admission。
- `C-046 Receipt and disclosure` — self receipt 从 C-039 已持久字段与 occurrence identity 原样投影，至少含 operationId、caller-derived agentId、jobId、occurrenceId、
  runId、businessState、terminationKind、fenceBefore/After、scheduleDisposition、committedAt 与 evidenceRef。
  canonical aliases 冻结为 `businessState=businessStateAtCommit`、`terminationKind=kind`、
  `evidenceRef=evidenceId`；response-loss replay 永远读 settlement snapshot，不读可能已被 later business
  settlement 改成 succeeded/failed 的 current occurrence.state；
  只返回 caller 自有 bounded metadata，不含 prompt、message body、token、credential、raw path、PID 或
  其他 Agent 信息。

## 8. State machine and invariants

```text
(none) -> admitted -> running -> succeeded | failed | outcome_unknown
admitted -> failed                    # proven pre-start terminal rejection only
admitted -> outcome_unknown           # admission后无法证明未开始/已停止
outcome_unknown -> succeeded|failed   # trusted late business settlement/operator only
outcome_unknown -> outcome_unknown + terminated_without_outcome
                                        # trusted exact termination-only; self allowed
```

Invariant：

```text
same occurrence Router admission count <= 1
business unknown != no side effect
termination request != termination proof
active fence iff unresolved unknown has no trusted termination settlement
termination-only never creates retry
negative reconcile writes = 0
caller-visible ownership scope = self only
```

## 9. Compatibility, migration and rollback

- Authority acceptance 按 §3.2；不改历史正文。
- Store upgrade：stop/drain/single-writer → backup exact V2 → locked latest read → validate → atomic V3 write
  → V3 readback。任一步失败，未提交时保持 V2；已提交后只 forward fix。
- V3 document 不向 V2 代码兼容。原因不是字段语法，而是 V2 fence rebuild 会错误忽略/丢失
  termination authority。
- 若 V3 从未提交且无 V3 evidence，可恢复本次 generation backup；一旦 version 3/V3 evidence 提交，
  `ROLLBACK_TO_V2=FORBIDDEN`，只能部署 V3-aware 修复。
- `runs.jsonl`/archive 是 evidence，不是恢复 authority 的输入。
- production apply 必须记录 exact preimage、binary/ref、upgrade receipt、readback 与 rollback route；本 Spec
  不授权 apply。

## 10. Acceptance

实现 Conformance Record 必须对每个 Contract 给出 exact commit/environment/command/result。下表中
“失败”任一成立即不通过；不能用代码审查替代要求的 fault/runtime test。

| Contract | Method / expected evidence | 失败 |
|---|---|---|
| C-001 | active-turn timeout fault → unknown，no backoff/retry | 写 failed/error 或创建 retry |
| C-002 | unknown 后 tick/restart/control → same run Router count 仍 1 | 第二 runId/call |
| C-003 | later slot while unresolved unknown → admission 0 | fence 被时间/abort 清除 |
| C-004 | pre-start/terminal/delivery 三类 fault 分别投影 | delivery 改 execution 或无 proof 写 failed |
| C-005 | record round-trip + update/retarget 后历史 identity 不变 | authority 字段缺失/改写 |
| C-006 | exhaustive transition table including illegal transitions | 新伪 business state 或非法转换成功 |
| C-007 | crash after reserve/before Router | recovery re-admits exact occurrence |
| C-008 | concurrent ticks/recovery/control | Router admission count >1 |
| C-009 | proven failure retry → new IDs/direct predecessor；unknown → none | identity reuse/unknown retry |
| C-010 | abort emitted without terminal ack | abort 被当 termination |
| C-011 | late success/failure/termination round-trip | evidence 丢失或 second admission |
| C-012 | pre-admission queue delay 与 post-admission deadline 两个时钟测试 | queue 被算 execution timeout |
| C-013 | two occurrences → distinct non-main Sessions, same workspace | session reuse/main session |
| C-014 | migration fixture with past slots | 任一 missed slot replay |
| C-015 | missing-agent fixtures → blocked/gap | fuzzy/default binding |
| C-016 | stale at fixture → do-not-import | 转为 now |
| C-017 | disabled fixtures through upgrade/import/control | 任一 auto-enable |
| C-018 | daemon fixtures excluded with disposition | daemon 被 Scheduler admission |
| C-019 | pre-gate production restore attempt refused | gate 前 production restore |
| C-020 | static authority/backlink audit | 并行 current Decision/spec |
| C-021 | concurrent writers + corrupt/unknown document | torn write/second authority/empty fallback |
| C-022 | V3-native required fields + V2 legacy marker/request alias/self-deny matrix | legacy 被猜 owner 或 corrupt 被 drop |
| C-023 | restart determinism/collision/natural-catchup/retry-chain matrix | unstable ID/silent collision/bad predecessor |
| C-024 | canonicalJSON vectors + same-key different-hash fault | mismatch 被接受 |
| C-025 | persisted default/explicit deadline + restart | restart 延期或 default≠3600s |
| C-026 | concurrent due+disable+fence under one lock | partial/double reserve |
| C-027 | late result concurrent with update/delete/disable | overwrite mutation/revive job |
| C-028 | delete projection then rebuild；two unknowns settle only one | result differs or fence prematurely clears |
| C-029 | operator outcome and termination-only reconcile + body identity spoof | untrusted identity/outcome fabrication/replay |
| C-030 | delete derived state + 2h passage | admission depends on legacy state |
| C-031 | legacy session fields ignored/stripped | admission reads stable session field |
| C-032 | 9 domain ops + 6 CLI commands inventory/runtime test | missing op/CLI executes jobs |
| C-033 | v1/bare and v2 fixtures through crash points | fabricated evidence/lost history/auto-enable |
| C-034 | dry-run/default refusal/force definitions-only fixtures | occurrence/history rewrite or unsafe merge |
| C-035 | evidence append failure vs authority commit failure | silent evidence loss/RAM advances on failed commit |
| C-036 | implementation PR authority/base/scope audit | missing prerequisite/mixed child scope |
| C-037 | implementation CI attempts production mutation | create/enable/reconcile succeeds |
| C-038 | V3 document opened by V2 reader/writer; post-commit rollback | old code accepts/downgrade succeeds |
| C-039 | full persisted receipt snapshot/derivation vectors and business-state readback | field missing/caller field accepted/outcome changed |
| C-040 | exact current-epoch termination positive；all dispositions table | non-exact settles；late outcome self-writes |
| C-041 | own/foreign/deleted/retargeted/spoof matrix | disclosure or non-current ownership mutation |
| C-042 | crash before/after atomic commit incl one-shot | settlement/fence/disable torn |
| C-043 | byte-hash store before/after every negative disposition | any authoritative byte changes |
| C-044 | recurring clock advance + one-shot fixture | backlog/retry/new at/admission now |
| C-045 | concurrent self/operator/late outcome + response loss | duplicate mutation/conflicting receipt/lost history |
| C-046 | response loss 后先追加 late business outcome，再回读 receipt；断言与原 receipt byte-equivalent | receipt 随 current state 漂移或泄露 secret/body/path/PID/foreign metadata |

最终 product acceptance 还必须完成 HR fresh Feishu inspect→reconcile→verify；旧 cdfd 只验证
`restart_lost` negative case，不能作为 positive canary。

### 10.1 Required fault matrix

```text
TIMEOUT_DURING_ACTIVE_TURN
ABORT_WITHOUT_TERMINATION
CURRENT_EPOCH_EXACT_TERMINATION
RESTART_LOST_ZERO_WRITE
EVICTED_ZERO_WRITE
PENDING_ZERO_WRITE
OWNERSHIP_MISMATCH_ZERO_WRITE
REQUEST_ID_MISMATCH_ZERO_WRITE
LATE_COMPLETED_SELF_ZERO_WRITE
LATE_FAILED_SELF_ZERO_WRITE
CONCURRENT_SELF_RECONCILE
CONCURRENT_OPERATOR_RECONCILE
OPERATOR_TERMINATION_ONLY_SETTLEMENT
TWO_UNRESOLVED_UNKNOWNS_SETTLE_ONE_FENCE_REMAINS
LATE_BUSINESS_OUTCOME_AFTER_TERMINATION_SETTLEMENT
RESPONSE_LOST_AFTER_COMMIT_IDEMPOTENT_RECEIPT
ONE_SHOT_ATOMIC_DISABLE
RECURRING_NEXT_FUTURE_NATURAL_ONLY
FENCE_REBUILD_WITH_TERMINATION_SETTLEMENT
STORE_V2_TO_V3_CRASH_POINTS
OLD_READER_ON_V3_FAIL_LOUD
CORRUPT_STORE_FAIL_LOUD
CONCURRENT_DUE_TICKS_SAME_OCCURRENCE
RESTART_AFTER_RESERVE_BEFORE_ROUTER
PAYLOAD_HASH_CONFLICT
FRESH_SESSION_PER_OCCURRENCE
DISABLED_DOMAIN_REMAINS_DISABLED
```

## 11. Rejected alternatives

- timeout/abort/request age 当 failed 或 termination proof；
- unknown 后 blind retry、同 occurrence 重放、补 fence-period slots；
- 由模型提供 identity、outcome、evidence、PID/handle 或 force；
- 为 cleanup enable disabled domain；
- caller-self 判定 succeeded/failed；
- “先清 fence、再写 receipt”或跨文件双 authority；
- 让 V2 reader 忽略 V3 termination field；
- 用 runtime reload、process kill、raw store edit 代替 exact reconciliation；
- 直接把 PR #45/新代码 merge 当作 production authority。

## 12. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
```

非 normative 自由度：内部类型/函数名、canonical encoding、CLI 排版和备份文件名；不得改变上述
identity、atomicity、zero-write、scope 或 disclosure 语义。

## 13. Final output

```text
SPEC_ID = SCHEDULER_TIMEOUT_OUTCOME_V3
SPEC_STATUS = proposed
REPLACES_ON_ACCEPTANCE = SCHEDULER_TIMEOUT_OUTCOME_V2
SEMANTIC_DELTA_VS_V2 = TERMINATION_ONLY_SETTLEMENT_AND_SELF_RECONCILIATION_SEAM
BUSINESS_OUTCOME_AFTER_TERMINATION_ONLY = outcome_unknown
FENCE_AFTER_TRUSTED_EXACT_TERMINATION = RELEASED
OLD_OCCURRENCE_RETRY = FORBIDDEN
SELF_SCOPE = TRUSTED_CALLER_OWNED_ONLY
NEGATIVE_DISPOSITION_WRITES = ZERO
STORE_SCHEMA = VERSION_3_SINGLE_DOCUMENT
DOWNGRADE_AFTER_V3_EVIDENCE = FORBIDDEN
MODEL_VISIBLE_SCHEMA_AUTHORITY = FUTURE_TOOLS_V3
PRODUCT_CHANGE_THIS_ROUND = NONE
PRODUCTION_CHANGE_THIS_ROUND = NONE
IMPLEMENTATION_ALLOWED_NOW = NO
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES
```
