---
spec_id: AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
intended_implementation_authority_on_acceptance: contracts
authority_action: AMEND
date: 2026-11-04
repository: mayf3/dsh-agent-core
authoring_base: f767e8d6608cdb0917aad2d471ba0454d0966a0f
scope:
  - D-009 alignment of AGENT_DELIVERY_RESILIENCE_V1 Scheduler policy and references
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - SCHEDULER_OCCURRENCE_OUTCOME_V3
  - SCHEDULER_TIMEOUT_OUTCOME_V3
  - SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1
external_authorities: []
supersedes: []
amends:
  - AGENT_DELIVERY_RESILIENCE_V1
superseded_by: null
owners: [mayf3]
owner_rulings:
  - https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622745350
  - https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788
references:
  - docs/specs/AGENT_DELIVERY_RESILIENCE_V1.md
  - docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md
  - docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V3.md
  - docs/specs/SCHEDULER_CONTROL_PLANE_RELIABILITY_V1.md
  - docs/specs/SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1.md
---

# AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1

## 1. Goal

按 #527 Owner 裁定，消除 delivery-resilience Scheduler 政策与 accepted D-009 的冲突：
可信业务 outcome、仅终止无业务 outcome、无可信证据必须分开处理，保留 UNKNOWN 零写保护。
本文是 **proposed corrective AMEND**；不表示已接受或已纠正源码、生产历史及运行时。

## 2. Scope and non-goals

只校正 `AGENT_DELIVERY_RESILIENCE_V1` 的 Scheduler 映射、对应验收 oracle 和父引用。
Router/harness/调用方回复补投、原机器审计身份、单变更通道、默认 OFF、一次性任务
HUMAN_REQUIRED、stopgap 退役所需生产门禁均保留。无 retry/replay、手工选结果、raw store
修改、授权扩大、D3 重做或 D4 新通知设计。

## 3. Authority and activation

- **R1**：[Owner 2026-11-04 初次裁定](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622745350)
  批准 D1–D4 方向；由 R2 明确 docs-first 顺序和 D2 正确语义。
- **R2**：[Owner 补充裁定](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788)
  明确 D-009 胜出，要求对 RESILIENCE_V1 的 child_real_exit 映射及 D-007/Timeout V1
  旧引用做 AMEND，保留三态、无证据零写，不引入重试/重放。
- Accepted 父权威：D-009:48–54、574–600；`SCHEDULER_TIMEOUT_OUTCOME_V3`
  C-001–C-011、C-022、C-028/C-029、termination-only Contracts；watchdog `CTR-RECON-001`:388–424。

一般治理的 AMEND 仅允许既有 stable ID 原义不变的加法。本次依据用户明确合同和 R2 作
**特定的纠偏 AMEND**，以新稳定 Spec/CTR/ACC ID 记录有效替换，保留 V1 原文及历史证据，
不冒称是零语义变动的普通加法，不修改或取代 D-009。本例不成为改写 accepted ID 的一般许可。

接受记录必须明确本文对下表各处的有效解释及新引用关系，绑定独立 reviewed head、文档哈希和
最终 accepted head。只有 Owner/明确授权 maintainer 接受并合入 main 后，方可激活
`implementation_authority=contracts`；后续实现另行绑定包含该接受的 base。
本 PR 无 acceptance、merge、实现或 production effect；既有代码相符与否不决定父权威含义。

## 4. Observations and evidence

`OBS-527D2-001`：2026-11-04 在 base `f767e8d6608cdb0917aad2d471ba0454d0966a0f`
只读核对上述四份权威，确认 RESILIENCE:321–324 的 termination-only/registry-absent→failed
与 D-009 的 outcome/termination 分离相冲突。完整冲突记录来源为只读
`/private/tmp/dsh-527-scheduler/STOPPED-527.md`。

`OBS-527D2-002`：同日通过 gh 和 GitHub issue/comments API 核对 mayf3 的 R1/R2。
`EVD-527D2-001`：父权威原文与 R2 直接支持下列纠偏，不依赖当前 policy 代码、旧台账或
生产 state 推导含义；未执行任何 live reconciliation，未验证旧台账动作的业务正确性。

## 5. Decision and conflict crosswalk

`DEC-527D2-001`：以 D-009 为结果语义权威；RESILIENCE 的政策触发/通道仍保留，旧台账
只作历史观察。本文接受后的有效替换完整列于下表，不要求读者从旧映射自行拼出例外。
行号全部绑定上述 base；“RESILIENCE”指 `AGENT_DELIVERY_RESILIENCE_V1.md`。

| 旧条款原文与行号 | 新语义 / 保留关系 | Owner 裁定锚点 |
|---|---|---|
| RESILIENCE:13–22 `AMENDMENT_1`：`lateOutcome=terminated_without_outcome -> failed`；321–322「重跑安全」 | 只保留为旧接受历史；当前政策须验证 exact trusted termination，保持 `outcome_unknown`，追加 termination settlement；不自动重跑 | [R2 D2 仅终止分支](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| RESILIENCE:35–45 references/parent_authorities 的 Timeout V1、D-007；28 的政策层描述 | 当前引用改为 `SCHEDULER_TIMEOUT_OUTCOME_V3` 与 D-009 / `SCHEDULER_OCCURRENCE_OUTCOME_V3`；CONTROL_PLANE_RELIABILITY_V1 保留 | [R2 修正废弃引用](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| RESILIENCE:223–230 DEC-004、303–305 CTR-W3、335–337 CTR-S5、383–398 authority pass 的 D-007/Timeout V1 相容论证 | 用 D-009/Timeout V3 的 business-outcome 与 termination 分离解释；旧相容性 PASS 仅为当时记录，不能压过当前父权威 | [R2 D-009 胜出及引用修正](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| RESILIENCE:319–320 exact success→succeeded、exact failure→failed（「下个 slot 重跑」） | 可信且 exact 的业务结果各归其态；本政策不创建 retry/replay，未来自然槽仍走原调度/准入规则 | [R2 D2 业务结果区分、无重试](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| RESILIENCE:323–324 `terminationEvidence=child_real_exit ... -> failed` | 只有 exact、可信、适用 epoch 的终止证明才写 `terminated_without_outcome`；business state 仍 UNKNOWN，未过证明门不写 | [R2 D2 仅终止分支](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| RESILIENCE:323–325 registry 无记录→failed；其他不动作 | registry-absent、丢失、过期、不可信或冲突证据全部保留 UNKNOWN/fence，零 authoritative reconciliation 写入 | [R2 缺失/不可信证据零写 UNKNOWN](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| RESILIENCE:331–333 CTR-S4、371–373 ACC-S2/S3：旧 janitor 44 决策逐条一致（含 AMENDMENT_1） | 默认 OFF 保留；验收 oracle 改为本文三态映射，旧台账作为输入须按证据重分类，不能要求复制错误输出；无证据零写验收保留且覆盖 registry-absent | [R2 D-009 胜出、三态与零写](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| D-009:48–54、574–600；watchdog:388–424 | PRESERVE：exact outcome 优先；termination-only 与 business state 正交；缺证据零写；aggregate fence 不误清另一 unknown | [R2 明确 D-009 胜出](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |
| #527 原正文 blanket `exact_terminal_then_idle -> succeeded` | 该标签单独不能证明业务成功；仍须区分 exact success/failure/termination-only，无证据不得推断 | [R2 三态裁定取代原始理解](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6622874788) |

## 6. Contracts — effective corrected policy

### CTR-527D2-001 — Current parent references and precedence

RESILIENCE 的当前 Scheduler 政策父引用 MUST 为 D-009、Timeout V3 及既有
CONTROL_PLANE_RELIABILITY_V1；watchdog 的 exact evidence/aggregate fence 规则仍约束消费。
D-007、Timeout V1 和旧 janitor 决策不再提供当前映射 authority。
上述 crosswalk 中所有 dependent normative references 按此解释，包含 CTR-W3 的 reconciliation
引用；该入口提示及其他回复补投义务不变。来源：R2 的引用修正和 D-009 胜出裁定。

### CTR-527D2-002 — Evidence gate and ordered three-way disposition

保留 CTR-S2 的 recurring-only 自动政策；`schedule.kind='at'` 恒 HUMAN_REQUIRED，本文不扩张。
对政策内 fenced occurrence，先验证 exact job/occurrence/run/request/owner correlation、
trusted provenance、适用 runtime epoch/freshness 和跨来源 coherence，再按下表顺序处置：

| 输入（通过 exact/trust/coherence 门后） | 允许的 authoritative 写入 | Fence / execution |
|---|---|---|
| `outcomeEvidence=exact_turn_end_success` | 追加 business late settlement → `succeeded` | 只移除此 occurrence 的 fence contribution；不重放 |
| `outcomeEvidence=exact_turn_end_failure` | 追加 business late settlement → `failed` | 同上；不由本政策创建 retry |
| 无可信 business outcome，但有可信 exact termination-only proof；例如具完整绑定的 `child_real_exit` 或 `lateOutcome=terminated_without_outcome` | business state **保持 `outcome_unknown`**，追加 `terminationSettlement.kind=terminated_without_outcome` | 只移除此 occurrence 的 contribution；不 retry/replay，只能走下一个 future natural slot 的既有准入 |
| 其他：registry-absent、`pending/restart_lost/evicted/never_existed`、无证明、未绑定/错误 identity/epoch、stale/untrusted/conflicting evidence | **零 authoritative reconciliation 写入**，不制造 success/failure/terminationSettlement | 保留 UNKNOWN 与该 occurrence 的 fence contribution |

`lateOutcome`/`terminationEvidence` 字符串、PID 不存在、age/timeout 或 registry null 本身都不越过
证明门。`exact_terminal_then_idle` 本身不选 business 结果；必须同时有可信 exact success/failure，
或确切验证为 termination-only。相互矛盾的可信 success/failure 先触发 coherence 失败，不能靠
表中顺序任选一方；可信 business outcome 与其终止事实相容时，business outcome 优先。

watchdog 中 trusted fresh liveness 仍可投影 STILL_IN_FLIGHT；这不是第四个 business outcome，
也不允许本政策写 settlement。健康/incident 的既有记录义务不被“零 reconciliation 写入”取消。
来源：R2 三态/UNKNOWN 裁定；门及顺序继承 D-009:574–600、watchdog:388–424。

### CTR-527D2-003 — Atomic settlement, history and no replay

沿用 CTR-S1/S3 的唯一 settlement 路径、机器 actor 身份及 durable receipt，不建旁路 store。
已有 unknown/timeout/外部副作用不确定性 MUST 保留，settlement 按 exact identity 幂等追加，
不得清空、覆盖或重写成失败。迟到可信 business outcome 在 termination-only 之后仍可追加为
success/failure，不重新激活旧 occurrence。

同 Job 仍有另一 unresolved unknown 时 aggregate fence MUST 保留。已过的 slots 不积压补跑；
解除 fence 不立即执行，不创建 retry/catch-up，不第二次 admission，不变换 runId。
缺失/不可信证据不得顺带修补 occurrence、nextRun 或 fence。来源：R2 无重试/重放与 UNKNOWN
保护；D-009:544–600 和 watchdog:411–424；持久化/审计复用原 CTR-S1/S3。

### CTR-527D2-004 — Corrected acceptance oracle, retained controls

CTR-S4 的默认 OFF、显式启用、CTR-S2 的 one-shot HUMAN_REQUIRED、CTR-S5 的 UNKNOWN
保护及 CTR-X2 既有实现/验收/生产门禁 MUST 保留。把 CTR-S4/ACC-S2 的旧 janitor
“44 决策逐条一致（含 AMENDMENT_1）”替换为本节三态映射验收；旧台账可以作为 fixture
输入，输出须由可信证据重分类，不能复制 termination-only/registry-absent→failed。

OBS-008 中历史 44 次操作、当时 review/acceptance/等价性结论原样保留为历史证据；
本文不追认其业务结果，不修改旧记录、不重复执行。来源：R2 D-009 胜出与三态零写要求；
这是其对直接依赖验收 oracle 的必要纠偏，不是新增 production 操作。

## 7. Acceptance

以下为后续实现验收定义；当前 docs-only 任务只验证文档，不声称已执行 settlement 测试。

| Acceptance | Contracts | Method / environment / inputs | Required evidence | Expected result / failure condition |
|---|---|---|---|---|
| ACC-527D2-001 | CTR-001,004 | 独立文档审查 base 与 candidate crosswalk；核对全部旧父引用和旧 oracle 的处置 | reviewed semantic head、文件哈希、逐项结论 | 无当前 D-007/Timeout V1 映射或旧台账等价要求；历史保留；混用旧 authority 即失败 |
| ACC-527D2-002 | CTR-002,003 | 隔离 fixture：exact success、failure；各自同时有 coherent termination；单独 `exact_terminal_then_idle` | exact implementation SHA、输入及 authoritative store 前后快照、receipt、rc | 仅可信业务证明决定 succeeded/failed；裸标签不制造成功；无 replay、无新增 retry |
| ACC-527D2-003 | CTR-002,003 | trusted exact current-epoch `child_real_exit`；同条件 `lateOutcome=terminated_without_outcome`；随后 late success/failure；重复读/消费 | history、terminationSettlement、lateSettlement、fence、admission 计数 | business UNKNOWN 先保留，termination-only contribution 解除且幂等；后续 outcome 可追加；若写 failed 或重 admission 即失败 |
| ACC-527D2-004 | CTR-002,003,004 | null registry；missing/stale/untrusted/跨 job/run/epoch、conflict，尤其旧 restart-quiescence 标签无当前 exact proof | occurrence/jobs/fences 字节前后比较、mutation/dispatch 计数，健康日志另列 | authoritative state 零写、UNKNOWN/fence 保留；仅字符串判终止或 null→failed 即失败 |
| ACC-527D2-005 | CTR-002,003,004 | 同 Job 两个 unknown，仅一个获 termination proof；one-shot、默认 OFF；旧 44 台账中有证据与无证据输入 | aggregate fence、policy decision、actor receipt、store snapshots、rc | 第二 unknown 仍 fence；at/OFF 不自动处置；按新 oracle 重分类；清全 Job fence 或要求旧错误输出即失败 |

每个 CTR 均有 Acceptance 覆盖。后续声明 conformance 必须有实际输入与 exact revision 证据；
文档 PASS 不等于源码 PASS、运行时接受或业务结果已知。

## 8. Compatibility, migration and rollback

不做历史 ledger/store 的 bulk 重写，不将旧 unknown 推断为失败。已有 settlement 以其真实
证据另行核证；本任务没有这类读写生产权限。实现以后仍走既有 single-document 原子通道和
identity/epoch 门。回滚候选不能恢复与 D-009 冲突的映射；若安全回退需要停用政策，需另外的
运维授权，本 PR 不执行。D3 已在 #608/main，保留；D4 在 D1/D2 接受后另作有界核证。

## 9. Authoring result

```text
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = AMEND (explicit Owner-directed corrective scope)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO (this corrective amendment)
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_ALLOWED = NO
OPERATION_ALLOWED = NO
PARTIAL_SUPERSESSION = EXPLICIT_TASK_SCOPED_CORRECTION (section 3; no parent Decision replacement)
CONTRACT_COUNT = 4
CONTRACTS_WITH_ACCEPTANCE = 4
OPEN_OWNER_DECISIONS = NONE_FOR_AUTHORING
NORMATIVE_TBD = NONE
READY_TO_MARK_ACCEPTED = NO (independent review and authorized acceptance required)
NEXT_ACTION = REVIEW
```
