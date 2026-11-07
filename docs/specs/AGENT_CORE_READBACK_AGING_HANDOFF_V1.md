---
spec_id: AGENT_CORE_READBACK_AGING_HANDOFF_V1
status: accepted
accepted_by: mayf3
accepted_date: 2026-11-07
accepted_at: 2026-11-07T12:58:48.337170Z
accepted_reviewed_head: 7b5d79c3961625aaade6f3b383b18b2968e82f6c
acceptance_authority: Owner mayf3 ruling owner-20261107-five-decisions items[2]
acceptance_authority_source: /Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json
acceptance_authority_selector: $.rulings[id=owner-20261107-five-decisions]
acceptance_authority_item_selector: $.rulings[id=owner-20261107-five-decisions].items[2]
acceptance_authority_canonical_sha256: 95290062529cf24c31d3c7f6c748a22e5e369d14458cf623f562eee5c90cedc8
acceptance_authority_item_canonical_sha256: ffeea11b8bd8b57815eb8fc8c9d0ec32e3528386b04d506d71fd8313e067bba1
acceptance_authority_snapshot: docs/reports/readback-aging-acceptance-20261107/owner-ruling.json
acceptance_transcript_comment: https://github.com/mayf3/dsh-agent-core/pull/643#issuecomment-6707205612
acceptance_transcript_comment_id: 6707205612
acceptance_scope: 仅限提案语义
acceptance_restriction: WEC/Svc配套权威正式接受前不得实施新reason或用于生产
acceptance_transaction_executor: /root (transaction executor only; Owner mayf3 is the acceptance authority)
acceptance_final_head_review: PENDING_REGULATOR
activation_boundary: main merge after regulator independent final-HEAD review
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
authority_action: AMEND
date: 2026-11-07
repository: mayf3/dsh-agent-core
authoring_base: 3c1bcf98bc40a2c34cca24f241c87d1b12cea216
scope:
  - proposed bounded B1/B4 readback-aging branch of existing system Assistance
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - SCHEDULER_OCCURRENCE_OUTCOME_V3
  - AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1
  - AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3
  - AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3
external_authorities: []
supersedes: []
superseded_by: null
owners: [mayf3]
---

# AGENT_CORE_READBACK_AGING_HANDOFF_V1

<!-- BEGIN RBAH_ACCEPTANCE_LIFECYCLE -->
> **当前生命周期：Owner mayf3 已正式接受本提案语义；接受事务已记录，待监管独立最终 HEAD 审查及合并。**
> 接受限定：**仅限提案语义；WEC/Svc配套权威正式接受前不得实施新reason或用于生产**。
> 接受权威为 Owner 裁定 `rulings[id=owner-20261107-five-decisions] / items[2]`；
> [PR 转录评论 6707205612](https://github.com/mayf3/dsh-agent-core/pull/643#issuecomment-6707205612) 与
> [接受事务收据](../reports/readback-aging-acceptance-20261107/acceptance-transaction.md) 绑定受审 HEAD `7b5d79c3961625aaade6f3b383b18b2968e82f6c`。
> 下文 proposed、READY_TO_MARK_ACCEPTED=NO 及原起草接受依赖等描述保留其原起草时点含义；当前限定接受以 frontmatter 和本说明为准。
> 本事务没有关闭 §3.1 的 WEC 封闭枚举合法 lifecycle 与 Svc 精确配对接受门，未裁定或实施新的 accepted-ID 例外。
> `implementation_authority: none`、`production_apply_authority: none` 保持不变；worker 仅执行接受事务，不合并、不实施、不写生产。
<!-- END RBAH_ACCEPTANCE_LIFECYCLE -->

## 1. Goal

提出既有系统级 Assistance 的有界 readback-aging 分支，关闭
`STOPPED-1376-BUDGET.md` 的 lawful handoff 缺口。读回等待预算与失败预算独立；
超限可以可靠移交处理责任，不能伪造业务失败、重放 UNKNOWN 或把技术问题全部推给人工。

这是 **AMEND 请求的 proposed 文档**，不是已生效的 WEC 枚举扩展。
`implementation_authority: none`；当前和本提案单独接受后均不授予产品实现或操作权限。

## 2. Scope and non-goals

只提出 B1 临时结算读不可用、B4 原基线缺失/visit 进展未证实的等待超限交接。
复用原 Scheduler/reconciler、append-only WAE ledger、Broker 系统 escalation、
Svc Assistance 事务/幂等收据/读回及既有 Owner 消费链。

不修改 accepted 文档或 `.agents/tools`，不实现、不合并、不部署；不增第二账本、到期表权威、
服务、平台、业务重试引擎、assignee 写角色或 model-facing 工具。
与 [#1379](https://github.com/mayf3/agent-control/issues/1379) Wake 传输面解耦：仅消费既有
合法送达/同请求关联证明，传输改造不在本提案中。#1377 B2 自动恢复接线、Owner/权限变化
及节点前进的独立验收扩展也不在本次交付内。

## 3. Authority and dependencies

### 3.1 Authoring mandate and lifecycle boundary

起草授权为 `BRIEF-1376-AMEND-AUTHOR.md` / 本次 Owner 交办所引常设预授权 V1 §2；
仅授权 proposed 文档、独立审查、push 和开 PR，不代行接受。此前停止记录是缺口证据，
不是 Product Authority。实现验收继续引用 `RECEIPT-1376-BUDGET.md` 的冻结 DW-1..5。

本提案明确请求在 WEC V3 CTR-WEC1-008 的封闭 policy reason 中增加一个值，故存在
**待接受的语义差异**。`.agents/protocol/SPEC_FORMAT_V0.md` §14.1–14.3 与
`.agents/local/README.md` 的 accepted-ID 不变/whole-authority 规则仍有效。
不得把这项请求冒称为普通 strictly additive AMEND 已满足接受条件；也不借用
LIVENESS_V1 §3 对 #1374 的历史条款例外。

Owner 接受前必须 RE_PREFLIGHT 并持久裁定该封闭枚举的合法 lifecycle：默认由拥有该
accepted 意义的权威走 docs-first whole-authority successor；任何任务特定例外必须由
Owner 明确记录精确范围，不能从本提案或审查建议推定。本文只记录请求，不替换旧 CTR ID，
`supersedes: []` 不表示差异已经兼容或已生效。若须 SUPERSEDE，另开相应接受事务，
不得将本提案改标 accepted 来绕过它。这个接受依赖不授权当前实现。

Core 只拥有本地消费/责任证据边界。Svc 拥有 Assistance case、系统命令事务、requester/
resolver 授权、收据及读回真相。WEC CTR-WEC1-008 引用的 Svc `CTR-SWEC-010` 和既有
execution-escalations 事务必须由 Svc 所属权威承接新 reason、封闭 DTO 与幂等读回。
本次未核定新的 Svc 接受版本，`external_authorities: []` 不表示没有依赖；不存在可声称
已接受的新 Svc authority ID/SHA。配对接受必须另行绑定准确 ID、main revision 和条款。
Core 单库接受、Broker 描述或 task URL 都不能使 Svc 新协议生效。

### 3.2 Exact accepted-authority crosswalk

以下行号全部固定于 authoring base `3c1bcf98bc40a2c34cca24f241c87d1b12cea216`。
L = [LIVENESS_V1](AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1.md)，
E = [WEC V3](AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3.md)，
A = [WAE V3](AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3.md)。

| Accepted coordinate | Current meaning / requested disposition | Proposed binding |
|---|---|---|
| L §8:144–171; CTR-EKRWAE-001:175–187 | 保留 WEC admission 与 D-009；原身份、UNKNOWN、零业务 replay、无证据零 fence/settlement 写；B1/B4 原目标 Agent 只读 | CTR-RBAH-002/003/006；不授 poller assignee 权限 |
| L CTR-EKRWAE-002:189–199 | 有限读预算、退避及持久 next-check；预算耗尽不删除责任 | CTR-RBAH-001；增加独立 aging 提议，不混同失败计数 |
| L CTR-EKRWAE-003:201–216 | 同一 append-only ledger；可靠送达+后续消费者+答复验证+再触发才可转移责任 | CTR-RBAH-003/005 全量继承 |
| L CTR-EKRWAE-006:258–274; CTR-EKRWAE-007:276–285 | late baseline 不冒充原基线；queued/ACK 不交接，失败保留自动责任和下一触发 | CTR-RBAH-001/005/006 |
| E CTR-WEC1-005:152–169 | 现有 actual attempt-limit 系统入口、Svc case、Domain Owner inter_agent wake | CTR-RBAH-001/002/005：请求并列的新系统分支；旧触发原义保留 |
| E CTR-WEC1-008:204–233 | Owner-resume 须 latest terminal、known delivery、fresh positive settled 与原 pre-plan baseline；UNKNOWN 不合格 | CTR-RBAH-006 保留全部 gate；aging case/resolve 不产生 resume permit |
| E CTR-WEC1-008:237–257 | closed policy DTO；现有 reason 仅 ATTEMPTS_EXHAUSTED / STALE_LOOP_EXHAUSTED | CTR-RBAH-004 请求增加 READBACK_WAIT_BUDGET_EXHAUSTED；该差异须 §3.1 接受，不偷改旧 ID |
| E CTR-WEC1-008:259–271 | 真实 request/resolution 序列及身份；ownerPrincipalId 是 activation assignee，resolver 是 Domain Owner | CTR-RBAH-002/004/005：区分系统 requester、原 assignee 和接收责任方 |
| A bounded delta:34–36; CTR-WAE-008:363–372 | UNKNOWN readback-only；普通 Assistance 由真实 target Agent own Principal 开启；原 wake 为 inter_agent | CTR-RBAH-002/003：只走系统分支，不冒用普通入口 |
| A CTR-WAE-010:396–418; L §8 的相应保留关系 | 可信 moved visit 可关闭处理责任，不归因旧 Run 完成 | CTR-RBAH-003/005；version++、case resolve、ACK 均不是业务结果 |
| D-009 §8.4/8.5:574–600；D009_ALIGNMENT CTR-527D2-002/003 | business outcome / exact termination-only / 无可信证据分离 | CTR-RBAH-003/006；aging 无 settlement 或 fence 权限 |

## 4. Current State

`STATE-RBAH-001`：2026-11-07，在 `/private/tmp/h1376-budget` 的 authoring base 上，
只读对照 accepted 权威与现有 Broker/runtime：系统 reason 仍只有两值，等待超限不满足
其前置；没有执行生产调用或模拟运行验证。依据 OBS-RBAH-001/002、EVD-RBAH-001。
当前 #1376 实现停点继续有效；本提案的 acceptance、Svc 配对接受和可调用实现均未证明。

## 5. Observations

- `OBS-RBAH-001`：2026-11-07 只读读取 §3.2 的 base 文件及停点/冻结收据；
  accepted Liveness 有可靠交接义务，WEC 现有枚举不含 aging。来源为该 Git revision，
  方法为本地逐条 readback；该结果不证明 live 故障或业务效果。
- `OBS-RBAH-002`：同 base，`packages/broker/src/capabilities/workflow/dispatch.js:180–237`
  与 `packages/production-runtime/src/workflow-execution-runtime.js:339–373`：系统
  escalation 以 poller 调用，仅接受两种 exhaustion reason。未调用该入口。
- `OBS-RBAH-003`：2026-11-07 通过 GitHub connector 读取
  [#1376 正文](https://github.com/mayf3/agent-control/issues/1376) 与其全部评论（1 条），
  [6645082629](https://github.com/mayf3/agent-control/issues/1376#issuecomment-6645082629)
  明确要求独立 aging、持久下次意图、可靠交接；这是交付定义，不是扩大协议权限的接受记录。

## 6. Claims and assumptions

- `CLM-RBAH-001 (SUPPORTED)`：generation=1、maxAttempts=3、长期 503 到期且无 case 的
  停点反例，没有两种旧 reason 的真实前置，也没有 ordinary assignee 写权限；
  需要可归属系统的合法新分支，不能改名伪装。依据 EVD-RBAH-001。
- `CLM-RBAH-002 (OPEN_ASSUMPTION for future runtime)`：依赖最终可用且既有调度公平时，
  可靠服务读回和后续消费者可使未完责任继续得到处理。本文定义待接受义务，不声称已实现。

## 7. Evidence relations

| Evidence | Source → target / relation | Sufficiency / limits |
|---|---|---|
| EVD-RBAH-001 | OBS-001/002 → STATE-001、CLM-001 / SUPPORTS | 固定 base 的 authority/source 反例；不替代跨服务调用或执行证据 |
| EVD-RBAH-002 | OBS-003 → §1、CTR-001/005 的提议目标 / SUPPORTS | 交付目标与来源可追溯；不建立 Product Authority、不证明验收通过 |

## 8. Proposed decisions

`DEC-RBAH-001 (PROPOSED)`：在既有系统 Assistance 中增加专用 reason
`READBACK_WAIT_BUDGET_EXHAUSTED`，只表示独立等待期限耗尽；系统 requester 与业务
assignee 分离。完整语义见下列新稳定 ID，不改变旧 ID 的历史含义。

`DEC-RBAH-002 (PROPOSED)`：责任转移以可读回的服务事实、可靠接收与持续消费为准；
aging 与 Assistance resolve 均不是业务结果、终止证明或新 admission 权限。

## 9. Proposed contracts

### CTR-RBAH-001 — Independent finite aging trigger

同一原身份的 B1/B4 未完责任 MUST 在原 ledger 持久保存 `firstWaitAtMs`、有限正整数
`waitBudgetMs`、`deadlineAtMs = firstWaitAtMs + waitBudgetMs` 与持久下一触发。
时间值和求和须为安全整数。`now >= deadlineAtMs` 且责任未依法关闭时才触发新 reason。
aging 独立于读失败数、业务 attempt 数和 stale-loop 数；重新排程、失败、成功但未完成的读、
进程重启、配置变动均不得后移既有 deadline 或重置首次等待时间。实现须记录配置值和时钟来源；
时钟回退不能刷新期限，不能从不可信时间声称已超限。新预算只用于新责任。

预算内保留有界只读检查；预算耗尽时尝试本系统交接，不增加业务 attempt/generation、
不把该事件编码为 ATTEMPTS_EXHAUSTED / STALE_LOOP_EXHAUSTED，不以超限强制 HUMAN_REQUIRED。
暂不可读与真正需决策继续区分；交接待证时仍有自动只读/交接重检消费者。
历史缺 firstWait 的责任从可信同身份旧记录恢复最早时间；无可信时间则保存未知来源并继续
安全观察/升级，不能按每轮 now 重建新期限或伪造已经 aging 到期。

### CTR-RBAH-002 — System actor without impersonation

调用沿既有 `workflow_execution_escalation.create` 系统入口，真实 actor 为获准的 poller/
系统收据 actor。Principal 由进程外凭据与服务端既有角色检查派生，不接收自报 actor 字段。
不新增 grant、assignee 写角色或 run-as/OBO，不调用 ordinary Assistance 冒充 target Agent。
缺合法系统权限即拒绝该写，保留责任；不能改 caller 来绕过拒绝。

原 `ownerPrincipalId` 始终是 activation assignee，与 system requester、接收责任的
Domain Owner 分别记录。接收方必须由 Svc 的权威关系决定，不能把本地 target Agent 或
返回的任意 UUID 当作 Owner；当前关系无法核定则不得声称送达/转移。B1/B4 读回仍只使用
LIVENESS 所允许的原目标身份和权限，不把只读授权升级成写授权。

### CTR-RBAH-003 — Exact identity, UNKNOWN and protected state

所有责任、请求、收据、答复与提交 MUST 绑定原
`workflowInstanceId/nodeVisitId/dispatchIntentId/ownerPrincipalId/attemptId/requestId/generation`。
attempt generation、Router processGeneration 与 runtime epoch 按原权威分别保全、校验；
不得互换。锁内 fresh replay/CAS 及原 revision 守卫继续适用，迟到旧代只留证据不改新代。

aging 不证明业务失败/成功、终止或零副作用。保持原 UNKNOWN、原停止/副作用证据与历史；
零业务重放、零 fence 写，零 business/termination settlement、occurrence/nextRun 修补。
后续可信事实的处理仍须其原独立 gate，不能将本分支当作 reconciliation 授权。
仅追加同 ledger 的责任/交接事实并保持 append+fsync、幂等与可重放投影，不改旧终态字节，
不重开 attempt、不重新生成 dispatch-time/preDelivery baseline。

### CTR-RBAH-004 — Closed schema and explicit compatibility

以下是**提议的协议 schema**，不是现有入口已支持声明。请求保留既有字段及封闭形状，
仅 reason 增加新值，增加一个条件必填的 closed `readbackAging` 对象。
根与各对象均 `additionalProperties: false`；不接受 context/payload、prompt、正文、任意 map。
新 reason 时 `workflowInstanceId/nodeVisitId/dispatchIntentId/lastAttemptId/readbackAging`
均必填；`lastAttemptId` 为原 attemptId，非 UUID。`attemptCount` 如给出只记录真实计数，
绝不作 aging 前提。旧两 reason 不携新对象，其原 schema/哈希/语义不变；缺省不注入新字段。

`readbackAging` 字段全部必填，禁止 null（唯下表明确允许者）：

| Field | JSON schema / constraint | Meaning |
|---|---|---|
| schemaVersion | integer, const 1 | 此对象的封闭版本 |
| responsibilityKind | string enum B1_SETTLEMENT_READBACK / B4_BASELINE_REVALIDATION | 原未完责任类别 |
| ownerPrincipalId | string, UUID | 原 activation assignee，非 requester/接收 Owner |
| requestId | non-empty string, maxLength 512 | 原业务 request ID；不得换新 |
| generation | integer, minimum 1, maximum 9007199254740991 | 原 attempt generation |
| firstWaitAtMs | integer, 0..9007199254740991 | 原责任首次等待时间 |
| waitBudgetMs | integer, 1..9007199254740991 | 固定等待预算 |
| deadlineAtMs | integer, 1..9007199254740991 | 等于 firstWaitAtMs + waitBudgetMs，溢出拒绝 |
| exhaustedAtMs | integer, 0..9007199254740991 | 可信观测时间，必须 >= deadlineAtMs |
| businessOutcome | string, const UNKNOWN | 不改变旧 UNKNOWN |
| missingFacts | unique array, minItems 1, maxItems 3; enum SETTLEMENT_READ_UNAVAILABLE / ORIGINAL_BASELINE_MISSING / VISIT_PROGRESS_UNPROVEN | 缺失事实的封闭分类，无任意文本 |

Svc MUST 校验原 dispatch/instance/visit/assignee 关系及请求字段一致性，拒绝不匹配、
不可信系统 actor、未到期或损坏证据。B1/B4 已无法取 fresh instance-detail version
不是转用 assignee CAS 的理由：请求不添加 assignee expected-version 伪前置；Svc 仍在自己
的事务内检查 current visit/instance 状态与权限，真实拒绝照实保存。

WEC CTR-WEC1-008 的 closed policy evidence DTO **请求**将非空 reason union 扩为三值；
其余字段、nullability、sequence、persisted lastAttemptId provenance 不变，不能回显 query
伪造证据。不添加任意载荷或放宽 assignee 的 null 规则。新 reason 可作为交接/答复的
事实读回，CTR-RBAH-006 明确禁止它成为 Owner-resume permit。

旧服务不识新 reason/字段：按原 validation 拒绝（例如 invalid_reason/invalid_arguments），
不降级、不删字段重发旧 reason；原责任+UNKNOWN+下次触发保留。未知 DTO reason 的旧消费者
MUST fail closed，不作为业务完成、交接成功或 resume/admission proof；记录 unsupported
及继续消费的下一触发。此为**兼容性验收要求**，不是未经验证的旧 binary 行为声明。
无法证明旧消费者安全拒绝并保留责任时，不得向它激活新分支；停用 producer 仍保留原
readback 消费链。新消费者继续接受原两 reason，原历史事件可读、可重放，无 bulk 改写。

### CTR-RBAH-005 — Receipted handoff, verified reply and retrigger

1. 在同一 ledger 的原子责任提交中，先持久新分支的精确意图和下次触发，再调用既有
   服务命令。稳定幂等 key 由原 identity、responsibilityKind、firstWaitAtMs、deadlineAtMs
   与固定 schema tag 确定；同一意图重试 key/body 不变，不包含每轮 now/失败次数。
   `exhaustedAtMs` 固定为首次持久到期观测，不能逐轮改 body。业务 requestId 不作新业务重放。
2. 服务收据须可按相同 key 读回/重放**该 Assistance 命令**取得同一事实；超时/425/503/
   回包丢失不能生成另一意图/key。沿既有命令收据/读回合同，不声称跨服务单事务。
   若读回不可用，保留 pending/UNKNOWN 与 next trigger。幂等冲突须保存真实拒绝并升级，
   不换 key 规避。不发送原业务请求。
3. 交接证据必须有同请求的 Svc command key/receipt identity、case ID、request event
   sequence、原身份/新 reason、可信 system requester 和权威接收 Owner。已有 case 可复用，
   但仅有 case ID/`escalated=false` 不证明该 aging 意图已记账；须读回同 key 的关联事实。
   Svc 若不能为既有 case 提供该事实，交接仍 pending，不伪造本地 receipt。
4. 接收方通过既有 Owner Assistance 链消费。用原稳定 `wfassist-<caseId>` / inter_agent
   送达身份及精确关联证明防重复；该证明只证明 admission，不单独证明完整责任转移。
   后续消费者明确为既有 Owner Assistance 消费链和原 readback reconciler 的交接监测/答复
   验证分支；后者在移交后仍持久监测下一触发。不是将原 visit 冒充 workflow_execution。
5. 只有服务事实读回、合法接收的 admission 证明、接收者/后续消费者和持久答复验证/
   retrigger 全部可核对时，原自动责任才可投影为 handed-off；保留原事件，UNKNOWN 不变。
   送达失败、只有入队/ACK、仅函数存在、缺消费者或监测触发一律不得转移，原自动责任和
   next trigger 继续保留。下一轮先读回同一命令/同一送达 identity，不盲发第二 prompt。
6. 答复必须来自 Svc 可归属的 case request/resolution 事件，验证 exact source tuple、
   原 lastAttemptId/new reason、requester、当前获权 resolver、顺序与新鲜性；普通聊天 ACK、
   文本“done”或本地标签无效。有效答复仅让既有调度进行安全只读重检/原权限处理，
   不自动执行业务。无答复、陈旧/冲突/错误身份、读回/消费者失败时，保留监测责任及有限正
   backoff 后的 durable next trigger，可再触发同一合法链；不能静默失活或强制人来重启。

同 ledger 的新增证据字段必须闭合：`handoffCommandKey`（非空字符串）、
`handoffReceiptId`（非空 opaque ID 或 null）、`assistanceCaseId/receiverPrincipalId`
（UUID 或 null）、`requestEventSequence/resolutionEventSequence`（正安全整数或 null）、
`deliveryRequestId`（`wfassist-<caseId>` 或 null）、`deliveryProofRef`（可信原关联记录 ID 或 null）、
`consumer`（固定枚举 EXISTING_READBACK_RECONCILER / EXISTING_OWNER_ASSISTANCE_MONITOR）、
`handoffState`（PENDING / HANDED_OFF / CLOSED）、`nextCheckAtMs`（安全非负整数；未完必填）。
另引用同 ledger 中闭合的 aging/原 identity 字段，不复制正文、秘密或任意结果载荷。
缺证据用 null/UNKNOWN，不伪造已验证值。CLOSED 仅由原权限可信关闭事实支持；每次追加
保留来源时间、原 revision 及 existing CAS，不能把监测 next-check 当 Scheduler nextRun 写。

### CTR-RBAH-006 — No resume permit, no transport expansion

READBACK_WAIT_BUDGET_EXHAUSTED、case 被 resolve、甚至可靠交接都不证明原 Run settled。
Owner-resume 消费者 MUST 将新 reason 拒作 resume permit；不能因 DTO 能解析新枚举就
规划下一 generation。WEC CTR-WEC1-008 的全部 identity/version/sequence、fresh positive
Router settled、known delivery、latest predecessor 与 pre-plan baseline 条件保持；
UNKNOWN/unavailable 绝不 admission。后续若需执行授权，必须由另一个真实满足原 accepted
前置的合法路径取得；不得重新解释本 aging receipt。

不依赖 #1379 改造来宣称本义务已实现；Wake 仅是既有投递面的消费者接口。
无法证明可靠接收则保持 pending+自动责任+next trigger，不建通知平台、第二队列或重试业务。

## 10. Acceptance

下表为**后续接受/实现**的反例定义，不是本次执行 PASS。除 ACC-001 的本次独立文档审查外，
均须未来在可信隔离持久环境、正式入口/消费者执行；不得在生产制造故障。
每项绑定 exact source/base/head、配置、输入/故障、原身份、ledger 前后、服务/送达收据及
protected state/调用计数、actual result/rc；文档审查不替代跨服务或无人值守证明。

| Acceptance | Contracts | Method / environment | Required evidence | Expected result / failure condition |
|---|---|---|---|---|
| ACC-RBAH-001 | CTR-001..006 | 独立固定 head 的文档 review，对照三权威/§3.1 与六项交办 | reviewed SHA/文件哈希、冻结 blocker union、最终 delta readback | 明确 proposed/零实施权与接受依赖；伪称 AMEND 已合法激活枚举或省略 Svc 依赖失败 |
| ACC-RBAH-002 | CTR-001/003/005 | 预算内/恰到期；generation=1<cap=3；失败数0与非0；成功但未完成读；重排/重启/时钟回退 | firstWait/deadline/next-check、原事件及各计数 | aging 不刷新、不冒用旧 reason；过早交接、超限责任消失或增加业务投递失败 |
| ACC-RBAH-003 | CTR-002/003/004 | 正式系统入口；错误 actor/identity/generation、ordinary assignee 冒用、未知字段/损坏时间；实例已迁移 | 授权拒绝/服务 receipts、protected-state 字节、旧/新代交错 | 零冒充、零新业务 replay/fence 写；旧代不能提交新代；拒绝后责任与下次触发保留 |
| ACC-RBAH-004 | CTR-003/004/005 | Svc 已提交后丢回包并重启；425/503/幂等冲突；已有 case 但不同 request | 同 key/body、真实服务读回、case/request provenance、重启重建 | 同一意图不重复 case/副作用；无同 key 事实不能交接；换 key/本地伪收据失败 |
| ACC-RBAH-005 | CTR-003/005/006 | 送达失败、仅 ACK、缺 consumer、错误/陈旧/冲突 reply；正对照真实接收+授权答复；重启监测 | 状态→消费者→触发链、精确 admission、Svc reply、durable next-check | 未证交接保留自动责任；已交接仍监测/验证/再触发；无 Root 催促继续安全读；ACK 当完成失败 |
| ACC-RBAH-006 | CTR-004/006 | 旧服务/旧 DTO 消费者/新消费者组合；两旧 reason、未知 reason、新 reason + UNKNOWN predecessor | 实际 validation/unsupported、升级启用门、原事件/哈希、resume/delivery count | 旧协议行为保留；未知 fail closed+责任不丢；不能证明即不启用；aging 不能生成 resume permit |
| ACC-RBAH-007 | CTR-001..006 | scoped observation-cas/持久重启回归、D-009 三态；缺原基线/只有 late sample/version-only；停用新 producer | DW-1..4 所需真实 rc/隔离 receipts、历史与 fence 比较 | 原 UNKNOWN/终态/基线不改；不依赖 #1379、不建第二账本；文档/内存桩 PASS 不冒充 E2E |

覆盖：CTR-001→ACC-001/002/007；CTR-002→ACC-001/003/007；CTR-003→ACC-001..005/007；
CTR-004→ACC-001/003/004/006/007；CTR-005→ACC-001/002/004/005/007；
CTR-006→ACC-001/005/006/007。6/6 有验收定义，均非执行结果。

## 11. Alternatives and disposition

- RETAIN：既有 Scheduler/reconciler、ledger、Svc Assistance/幂等收据、Owner 消费链。
- REJECT：假称 attempt/stale-loop 耗尽；poller 冒充 assignee；ACK/入队等于转移；
  等待无限刷新；本地 receipt 代替服务事实；aging resolve 自动解除 UNKNOWN 或恢复执行。
- REJECT：新到期表/账本/平台、盲目业务重试、绑定 #1379 传输改造。
- 接受路径须依 §3.1 裁定；不把现有 accepted enum 与新提议同时声称为生效协议。

## 12. Migration, compatibility, and rollback

本 PR 只有 proposed 文档，无运行时迁移/回滚操作。旧文件字节不改。
未来顺序为配对权威接受→包含接受的实现 base RE_PREFLIGHT→Svc/消费者兼容性验证→
正式授权启用 producer；实现应仍复用原 ledger，不 bulk 改历史或增加平行可执行模型。
旧消费者未知字段/reason 的处理见 CTR-004；不证明就不激活。运行时停用/回滚另需正式授权，
保全 UNKNOWN、原责任/触发/服务事实/历史，不能因新 reason 无法解析而丢弃记录或清 fence。

## 13. Open questions and delivery boundary

```text
SPEC_GOVERNANCE_MODE = AUTHOR
REQUESTED_AUTHORITY_ACTION = AMEND (proposed request only)
AUTHORITY_ACTION = AMEND (this proposal; accepted-enum lifecycle pending section 3.1)
PRIMARY_PARENT_AUTHORITY = LIVENESS_V1 / WEC V3 / WAE V3 at authoring_base
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED (cross-repository protocol semantics; docs only)
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO (this proposal)
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_AUTHORITY = none
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO (author may only open PR)
OPERATION_ALLOWED = NO
OPEN_OWNER_DECISIONS = accepted WEC closed-enum lifecycle; paired Svc authority acceptance
NORMATIVE_TBD = NONE_IN_PROPOSED_BRANCH (acceptance dependencies above remain open)
PARTIAL_SUPERSESSION = NONE_PERFORMED; no exception inferred
CONTRACT_COUNT = 6
CONTRACTS_WITH_ACCEPTANCE = 6
AUTHORING_READY_FOR_REVIEW = YES (proposal, not ready to mark accepted)
READY_TO_MARK_ACCEPTED = NO
EXPANSION_TRIGGER = authority conflict beyond disclosed proposal delta, required-check/review failure, non-doc change
NEXT_ACTION = independent REVIEW -> Owner acceptance-route disposition and paired acceptance -> implementation RE_PREFLIGHT
```

后续 #1376 实现必须在包含合法接受的 base 重做 RE_PREFLIGHT，复用
`RECEIPT-1376-BUDGET.md` 的冻结 DW-1..5，不新增验收范围，不重复已通过且未失效修复。
原停点只有可核对的接受/可调用证据才能关闭；本提案、独审或 PR 创建均不关闭它。
