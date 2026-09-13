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
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
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
- `DEC-007` — response loss 后同一请求按 operation identity 幂等回读 receipt，不重复 mutation。
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
- `C-005 Identity` — 每条 record 持久绑定 jobId、scheduleRevision、occurrenceId、runId、requestId/
  idempotencyKey、payloadHash、slot/retry coordinates、admittedAt 和可选 nativeSessionId。
- `C-006 Durable state` — business states 仍只有 admitted/running/succeeded/failed/outcome_unknown；
  `terminationSettlement` 不改变这组 state。
- `C-007 Reserve first` — Router call 前必须原子持久 reserve；reserve 后 crash 不可再次 admission。
- `C-008 At-most-once` — 并发 tick/restart/recovery/control/late callback 均不得二次 Router admission。
- `C-009 Retry` — only proven ordinary failed 可按显式 policy 创建新 occurrence；unknown 和
  termination-only 都不自动 retry。
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
  production restore/enable count=0。
- `C-020 Decision disposition` — D-009 是 standalone current Scheduler Decision；历史 D-005/D-007
  仅作 superseded provenance。

### Store and execution contracts

- `C-021 Store` — canonical file 仍为 `<store>/jobs.json`，V3 document 为
  `{version:3,jobs,occurrences,fences,operations}`；所有 mutation 共用 same-process FIFO、cross-process
  exclusive lock、re-read latest、single delta、fsync+atomic rename、RAM-after-commit。
- `C-022 Record` — OccurrenceRecord 至少含 C-005 字段、business state、deadline/timestamps、
  executionOutcome、deliveryStatus、lateSettlement、terminationSettlement、terminalEvidence 和 append-only
  history。authority 字段缺失/corrupt/unknown version 必须 fail-loud。
- `C-023 Deterministic IDs` — natural `(jobId,revision,nominal)`、retry `(jobId,revision,predecessor)`、
  catchup `(jobId,revision,nominal)` 确定性派生；same coordinates 幂等，different coordinates collision
  fail-loud；natural/catchup 共用 nominal uniqueness。
- `C-024 Payload hash` — hash 覆盖 normalized execution payload、target agent、timeout、revision；不含
  delivery；same key/different hash conflict。
- `C-025 Deadline` — reserve 时一次性持久 `executionDeadlineAtMs`，restart 后不得从 now 延期。
- `C-026 Atomic admission` — due eligibility、fence、slot uniqueness、identity 与 admitted record 在同一
  lock commit；unlock 后才 Router call。
- `C-027 Writeback` — invocation 在锁外；结果以 exact occurrence/run 锁内写 latest document，不覆盖
  并发 job mutation、不复活 deleted job。
- `C-028 Fence projection` — active iff 存在 unresolved unknown with neither business nor termination
  settlement；projection 可完全从 ledger 重建，重建不 admission。
- `C-029 Operator reconcile` — trusted operator 可显式将 unknown resolve to succeeded/failed，记录可信
  identity/evidence；请求 body 自报 operator 无效；不重放、不删 history。
- `C-030 Legacy state` — runningAtMs/lastStatus/errors 等只是 derived projection，不能参与 admission、
  no-dup、ownership 或 termination；固定 2h clear-and-rerun 路径禁止。
- `C-031 Session mint` — admission 为 occurrence mint fresh non-main Session 并仅作 evidence 记录；新
  Job schema 不以 sessionTarget/sessionKey 选择执行 Session。
- `C-032 Control projection` — canonical control 保留 create/update/enable/disable/delete/list/get/runs 与
  operator reconcile；list/runs 显示 occurrence、business state、termination settlement、fence；CLI
  control-only，不执行 due jobs。enable 不清 fence、不补历史。
- `C-033 Native upgrade` — V2→V3 必须 stop/drain/single-writer，在 lock 内以 generation-specific backup
  升级；v2 occurrences 原样保留并补 absent optional fields，不 fabrication evidence；upgrade report
  完整列出 disposition。
- `C-034 Import` — dry-run 默认；写入守卫在 lock 内读 latest；force 最多 definitions-only，必须逐字
  保留 occurrences/fences/operations/history，不能证明安全合并则 fail-loud。
- `C-035 Evidence` — runs.jsonl 只作 bounded append evidence，记录 reserve/admission/start/outcome/
  delivery/settlement/reconcile/upgrade；evidence append failure 可观察但不篡改 authority。
- `C-036 Dependency gate` — §3.3 未全部满足不得开工或合并产品实现。
- `C-037 Production gate` — implementation PR 不创建、enable、补跑、reconcile production records；
  deployment 和 fresh E2E 是后续独立 authority。

### V3 delta contracts

- `C-038 Store v3 exclusivity` — 首次 V3 write 前备份 V2；一旦 version=3 或任何 V3 evidence 存在，
  V2 reader/writer 必须 refuse。不得自动 downgrade；recovery 仅 V3-aware forward fix。
- `C-039 Termination settlement schema` —
  `terminationSettlement={kind:'terminated_without_outcome',requestId,evidenceKind,evidenceId,settledAt,
  reconciledByAgentId,operationId}`。每个字段由 trusted server context/evidence 产生；business state 保持
  outcome_unknown，executionOutcome 不写 succeeded/failed/cancelled。
- `C-040 Exact Router correlation` — self reconcile 只消费 current runtime epoch 对 exact
  `(occurrenceId,runId,requestId)` 返回的 `terminated_without_outcome`。pending/restart_lost/evicted/
  never_existed/mismatch/conflict/unsupported 均不是 proof。
- `C-041 Trusted self ownership` — caller identity 来自 Router trusted Parent context；canonical job.owner
  与 occurrence.jobId 必须同时归属 caller。model/request 不得提供或覆盖 principalId、agentId、owner、
  requestId、handle、PID、outcome、evidence、retry 或 force。
- `C-042 Atomic reconcile` — lock 内 re-read latest、validate exact identity/ownership/state/absence of
  conflicting settlement、validate Router disposition，然后同一 commit 追加 termination settlement、
  history、operation receipt、更新 fence；one-shot 同 commit disable。
- `C-043 Negative zero-write` — C-040 所列非正例、ownership mismatch、record mismatch、non-unknown、
  already business-settled、payload conflict 均返回结构化 disposition且 authoritative store byte-for-byte
  不变；不得“先写处理中”。
- `C-044 Schedule disposition` — recurring 解除 fence 后只等待下一个 strictly-future natural slot，
  fence 期间 slot 全部丢弃不补；one-shot 原 nominal 已耗尽，在 settlement commit 中 definition disabled，
  不生成 retry/new at。
- `C-045 Concurrency and late outcome` — 相同 operationId 同参数幂等回 receipt；不同参数 conflict。
  concurrent operator/business settlement first valid commit wins；若 termination-only 已提交后收到 trusted
  late business outcome，可追加 business settlement但不得改写/删除 termination history或触发 admission。
- `C-046 Receipt and disclosure` — receipt 至少含 operationId、caller-derived agentId、jobId、occurrenceId、
  runId、businessState、terminationKind、fenceBefore/After、scheduleDisposition、committedAt 与 evidenceRef；
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

实现 Conformance Record 必须逐项给出 exact commit/environment/command/result：

1. timeout without proof → unknown+active fence；无 retry/admission。
2. trusted exact current-epoch termination → state 仍 unknown、termination settlement present、fence released。
3. recurring settlement 后不补 fence-period slots，只运行未来自然 slot。
4. one-shot settlement 与 definition disable 同 commit，且无新 occurrence。
5. restart_lost/evicted/pending/never_existed/mismatch/conflict → zero write。
6. caller A 不能读取/修改 caller B job/run；body identity spoof 无效。
7. same operation response loss/retry 返回同 receipt；different parameters conflict。
8. concurrent self/operator/late outcome 只有合法 first commit，history 完整且不 admission。
9. fence projection 删除后从 ledger 重建结果一致；termination-only unknown 不重新 fence。
10. V2→V3 upgrade 保留 records/history；old reader fail-loud；V3 后 downgrade refused。
11. corruption/unsupported version fail-loud，不当空 store。
12. list/runs readback bounded、self-only、secret-free。
13. fresh non-main Session、deterministic identity、reserve-before-Router、at-most-once 回归全部 PASS。
14. import/restore/disabled/no-catch-up gate 回归全部 PASS。
15. HR fresh Feishu E2E 完成 inspect→reconcile→verify；旧 cdfd 仅验证 restart_lost negative case。

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
CONCURRENT_SELF_RECONCILE
CONCURRENT_OPERATOR_RECONCILE
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
