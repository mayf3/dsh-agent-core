---
spec_id: AGENT_CORE_REFUSAL_TERMINAL_HANDOFF_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
authority_action: NEW
date: 2026-11-07
repository: mayf3/dsh-agent-core
authoring_base: 2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648
scope:
  - proposed B2 terminal recovery refusal responsibility handoff through existing system Assistance
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_WORKSPACE_SESSION_MODEL_V3
  - SCHEDULER_OCCURRENCE_OUTCOME_V3
  - AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1
  - AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3
  - AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_EXECUTION_CONTROL_V3
    revision: d4c510d94f8929f5377989bd69229d611ab49304
    relation: constrained_by
supersedes: []
superseded_by: null
owners: [mayf3]
---

# AGENT_CORE_REFUSAL_TERMINAL_HANDOFF_V1

## 1. Goal

提出第二份独立交接提案：blocked 恢复被合法拒绝、原 attempt 进入 terminal
`NEEDS_REVIEW/recovery_refused` 后，仍未移交的责任可由真实系统 actor 通过既有
Assistance 机制可靠交接。新候选 reason 为 `RECOVERY_REFUSAL_TERMINAL`。

本文 **proposed / 零实施权 / 不接受**。本文单独被接受也不授权实现：accepted
Core/Svc 意义须另行完成合法权威承接并进入各自 main，再走实现 RE_PREFLIGHT。
提案成立、文档审查、PR 创建、case resolve 均不证明业务完成或运行时已支持。

## 2. Scope and non-goals

仅覆盖 B2 合法 world-drift refusal 后的责任交接及必需的责任证据窄追加设计。
world drift 是总类；visit 迁移、可信历史可见性、assignee 不符、实例终态是具体事实，
不是现有代码的四个互斥枚举。旧 `refused` 是字符串，本文不重写它或推定新枚举已存在。

与 [#643 aging](https://github.com/mayf3/dsh-agent-core/pull/643) 共用系统入口、
唯一 ledger、Svc command/receipt、Owner 消费及送达骨架，**独立提案、独立接受**。
不以等待到期、失败数或 attempt/stale-loop 耗尽替代本触发，不修改 #643 的 B1/B4 范围。
不承接 #650 a/b 的自动持久关闭；真实 terminal/moved 事实在本提案只支持责任交接，
不自动关闭原观察责任，不把旧 Run 归因为完成者。

不改产品源码/测试/配置/accepted 文档；不实现、不接受、不合并、不生产读写。
不开放 ordinary planned 恢复，不重做已交付 B2 blocked 自动恢复，不改身份/Grant。
与 [#1379 Wake](https://github.com/mayf3/agent-control/issues/1379) 解耦：仅消费合法
同请求接收证明，不实施传输改造；不建第二 ledger、queue、通知平台或业务重试引擎。

## 3. Authority and dependencies

### 3.1 Mandate, NEW route and future whole-authority succession

起草授权：[BRIEF](../../BRIEF-REFUSAL-PROPOSAL.md)、Owner
`rulings[id=owner-20261107-five-decisions].items[1]`（裁定②，采纳 #653 的两缺口边界）
及预授权 V2 §5（原记录 items[4]）。选中原文、读取时间、canonical hash 见
[来源记录](../reports/refusal-terminal-proposal-20261107/source-provenance.json)。
它们授权本次 docs commit/push/PR，不构成新 Product Contract 的接受。

裁定③另行认可 #643 的**提案语义**；该提案已正式限定接受并合并至 main
`9df5bd2fdea17f04bcd1762cd6800c350efcf9c3`，frontmatter 为 accepted，
`implementation_authority: none`、`production_apply_authority: none` 保持不变。
WEC/Svc 配套权威正式接受前不得实施新 reason 或用于生产；#643 的接受不扩展到本提案。

选择 **NEW**：refused-terminal 的独立 Decision、历史对象接收和责任范围不属于
#643 的 bounded B1/B4 aging scope；没有 active accepted authority 决定这一专用交接协议。
本文件不是任何旧权威的完整替代，故 `supersedes: []`，不作 partial supersession。
NEW 是本独立 proposed 设计的路线，**不是对 accepted closed reason/terminal refusal
规则的新增例外**；不能用“NEW 已接受”绕过其 owning authority。

未来激活至少需要 docs-first **whole-authority successors** 承接 Core WEC V3 的系统
producer/reason/消费边界、LIVENESS V1 的 B2 terminal 责任元数据例外，以及 WAE V3
仍有效的 terminal-refusing 约束及依赖。须完整保留未变义务、明确 crosswalk，并在接受时
原子更新整权 supersedes/superseded_by/backlinks。不得改旧 stable ID 或复制 LIVENESS
§3 的历史任务专属 partial-supersession 例外。这里不写这些 successors，也不预定其 ID。

Svc 单独拥有历史业务关系、case 生命周期、系统 caller 授权、Domain Owner 解析、事务、
幂等收据/读回、Owner inbox/action 与 request/resolution provenance。前言的 external
reference 只绑定**现有约束**；新 Svc successor ID/接受/main SHA 为 UNKNOWN / REQUIRED。
Core 提案不能解除 Svc current/nonterminal 前置，不能借 active Owner-resume evidence
查询为历史交接读回。Svc 配对面须接受 CTR-RTH-002/004/005 才可能有合法正例。

### 3.2 Pinned current authorities and counterexample

Core 以下行号均 @ `2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`。
L=[LIVENESS V1](AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1.md)，
E=[WEC V3](AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3.md)，
A=[WAE V3](AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3.md)。

| Accepted coordinate | Preserved meaning / proposed delta |
|---|---|
| L CTR-EKRWAE-001:175–187; D-009 §8.4/8.5:574–600; alignment CTR-527D2-002/003 | 原 tuple/UNKNOWN/停止与副作用证据保全；零 replay/settlement/fence 写，CTR-RTH-003/006 保留 |
| L CTR-EKRWAE-003:201–216; §8:157–158; A CTR-WAE-005:301–321、012:484–545 | terminal 追加窄例外只含 B1/B4；本设计请求 B2 handoff 元数据例外，当前没有该权限 |
| L CTR-EKRWAE-004:218–239、005:241–256 | 安全同 attempt 首次 admission 和合法 refusal 保留；terminal no-op 不因交接变成可恢复 |
| L CTR-EKRWAE-007:276–285 | 可靠接收、后续消费者、答复验证、再触发；失败保留自动责任，CTR-RTH-005 全绑定 |
| E CTR-WEC1-005:152–169、008:204–283 | 旧 exhaustion reason/Owner wake 保留；新 reason 非 resume permit，不改旧 active/settled/baseline 门 |
| A CTR-WAE-007:351–361、008:363–372 | 原 Principal、immutable visit-assignee、普通 Assistance 身份/权限保留；系统 actor 不冒充 assignee |
| Svc WEC V3 CTR-SWEC-004:365–395、010:603–696 @ d4c510d94f8929f5377989bd69229d611ab49304 | 系统命令两 reason、CURRENT/nonterminal；resume DTO 两 reason且 ACTIVE/current。历史对象接收尚需 Svc successor |

[STOPPED-1377-MINIMPL 原字节快照](https://github.com/mayf3/dsh-agent-core/blob/f3c833737195180a54b8eb6cd95758500fc6c010/docs/reports/semantic-delta-consolidation-20261107/STOPPED-1377-MINIMPL.md#L66-L84)
SHA256 `9b3acc663678399e54bc930f507953c3eca6defa47f148933d65a5f06a025821`：
原 blocked → world drift → ACTIVE 时预存 refusalSchedule → terminal refusal → 后续只读
Pending。保持原 tuple 调 ordinary Assistance 不满足 current assignee/current visit/CAS；
系统入口只有真实 exhaustion 两 reason，仍拒绝 noncurrent/closed；换 visit/assignee 则
篡改原责任。仅新 reason 不能关闭历史对象接收与 B2 terminal 追加这两个独立前置。

复用 [#650 §3/§5](https://github.com/mayf3/dsh-agent-core/blob/4928f5022a2385b571eba4d9d2967d216c78c2f8/CONVERGENCE-ANALYSIS-1377.md#L123-L191)
及 [#653 §§2–5](https://github.com/mayf3/dsh-agent-core/blob/f3c833737195180a54b8eb6cd95758500fc6c010/SEMANTIC-DELTA-CONSOLIDATION.md)：
合法 assignee 前置内的已有交接义务，与新增 system producer/reason、历史对象、terminal
元数据权限分开。报告是 Evidence，不是 Product Authority；本文不重做其已完成分析。

## 4. Current State

`STATE-RTH-001`：2026-11-07，本 worktree authoring base 上，terminal refusal 消费者
以持久 schedule 只读观察并返回 `REFUSAL_RESPONSIBILITY_PENDING/UNKNOWN`；未见本类
服务交接或 terminal handoff append。依据 OBS-RTH-001/002、CLM-RTH-001。
这只是固定 revision 的源码/权威观察，无生产或运行时结论。

## 5. Observations

- `OBS-RTH-001`：2026-11-07，本机 git object readback，读取 §3.2 的 accepted 文件及
  STOPPED/#650/#653/#643 固定 revision；来源/hash 见来源记录。结果是既有系统两 reason
  和 current/nonterminal gate，STOPPED 反例无新分支正例；没有运行产品测试或调用服务。
- `OBS-RTH-002`：同日/base，`recovery/automatic.js:56–64` ACTIVE 时预写 cadence；
  `automatic-ledger.js:20–38` 只准 ACTIVE/resolution_blocked checkpoint；
  `refusal.js:11–22,64–80` 对 terminal+schedule 锁内核对后只读 Pending。
  路径均在 `packages/workflow-execution/src/`。`operation.js:139–156` 自动 unreadable
  保持 blocked，真实 drift 才 refusal；原 refusal 字符串并非本文拟定的 closed 类别。
- `OBS-RTH-003`：同日通过 GitHub connector 读取 Svc 固定 revision 的 §3.2 两条合同，
  与 #653 的 Svc 约束相符；通过本机只读 registry 得到裁定②/③及 V2 §5 选中项。
  前者不是新 Svc 接受，后者是起草授权/边界，没有本提案接受记录。

## 6. Claims and assumptions

- `CLM-RTH-001 (SUPPORTED)`：既有合法入口不覆盖目标历史/终态集合；只加 reason
  或挪 B1/B4 writer 仍不足。支持 EVD-RTH-001；局限：未以 live 调用复现拒绝。
- `CLM-RTH-002 (SUPPORTED)`：两缺口共享机制但资格独立，支持 EVD-RTH-002；
  不从共用代码推出一个提案接受另一个，亦不声称拒绝责任已交接。
- `CLM-RTH-003 (OPEN_ASSUMPTION)`：未来依赖最终可用、合法 Owner 可解析且既有调度
  公平时可完成交接/答复监测；永久故障下只承诺保留责任，不保证业务最终成功。
  该假设不得放宽权限或开启 UNKNOWN admission。

## 7. Evidence relations

| Evidence | Source → Claim/State / relation | Coordinates, sufficiency and limitation |
|---|---|---|
| EVD-RTH-001 | OBS-RTH-001/002/003 → CLM-RTH-001、STATE-RTH-001 / SUPPORTS | §3.2 base/paths、固定 STOPPED/hash、Svc revision；足以定位缺口，不能证明新实现可用或跨服务验收 |
| EVD-RTH-002 | OBS-RTH-001/003 → CLM-RTH-002 / SUPPORTS | #643/#650/#653 固定 heads与裁定②选中原文；只证明独立边界/起草依据，不替代接受 |

## 8. Proposed decisions

`DEC-RTH-001 (PROPOSED)`：独立 reason `RECOVERY_REFUSAL_TERMINAL` 表达合法拒绝后的
未移交责任；通过同一系统 Assistance 为原历史对象接受**责任处置**，不重开原执行。

`DEC-RTH-002 (PROPOSED)`：接收方为原 visit 的权威 Domain 的当前合法 enabled Owner。
精确保留原身份与 Svc 权威关系；对可证明的 assignee 差异提出显式 discrepancy-only
接收分支（CTR-RTH-002），不把差异记录冒称为一致。该具体设计是本次新提议，#653 的
边界认可没有预先接受它。Owner/Svc 需明确裁定后才可激活。

## 9. Proposed contracts

### CTR-RTH-001 — Refusal trigger independent of aging

系统 producer MUST 在既有 FIFO/OwnerLock/fresh replay 下确认：原 attempt 已因合法
blocked recovery world-drift 路径进入 `NEEDS_REVIEW/recovery_refused`；exact
instance/visit/dispatch/original owner/attempt/request/generation 未被改写；原拒绝事件、
可归属来源及 ACTIVE 时预存的有效 refusalSchedule 可重放核对；责任尚未合法转移。
新 reason 不要求等待期限或计数达到上限；第一次到期的原 refusal cadence 即可尝试交接。

MUST 以可信拒绝来源和权威关联归类为本文封闭 `refusalKind`：`VISIT_MOVED`、
`HISTORICAL_VISIBILITY`、`ASSIGNEE_MISMATCH`、`INSTANCE_TERMINAL`。
原字符串原样保留；不得仅 regex/标签推断新类别。复合事实保留原记录，选取导致原拒绝的
可验证主因；无法唯一核验则拒绝新写并保责。404/PID 消失、same-visit version-only、
陈旧/冲突证据、持续 503、ordinary planned、无合法 refusal/schedule 均不能造正例。
历史缺 cadence 不得凭 now 伪造：保留 UNKNOWN/原消费者，另经合法补证路径处理。

### CTR-RTH-002 — Real system actor, historical target and recipient

MUST 复用既有 runtime-only `workflow_execution_escalation.create`，系统 Principal
由进程外凭据及 Svc `workflow.execute`、direct token、enabled GLOBAL_SCHEDULER_READ
检查派生；不接收自报 actor、不授 assignee 角色、不 run-as/OBO，不调用普通入口冒充执行者。

本提案请求 Svc 在同入口**按新 reason 单独分支**，接受原 historical visit/closed instance
的责任处置 case。Svc 事务必须验证 instance/visit/dispatch 的原权威关联及可信系统报告
的 refusal provenance；原 tuple 不换成当前 visit/新 assignee，不重开实例或授旧 visit
业务写权。旧 reason 和 #643 各自的 current/nonterminal 条件不得随此放宽。

通常原 owner 与 Svc immutable historical assignee MUST 相符。唯一另提的
`ASSIGNEE_MISMATCH` 分支：系统可证明合法原 refusal、其 ledger 原 owner 事实、Svc
instance/visit/dispatch 关联和**权威历史 assignee 的具体不等事实**时，Svc MAY 接受
discrepancy-only case；分别记录 source owner 与 authoritative historical assignee，
不得称 source owner 是合法 executor 或把其替换成新值。其余身份不符/缺关联/伪造来源
均拒绝并保责。该专用处置资格不是“任意错误 owner 可交接”，且须 Owner/Svc 明确接受。

Svc 从原 visit 的权威 Domain 关系解析当前合法 enabled Domain Owner，单列真实 system
requester、原 owner、权威历史 assignee、接收 Owner。关系缺失/冲突、无合法 Owner 或
只有本地 UUID 时不声称接收，保留原自动责任。Owner 后续变更按权威关系重核，不能默默
改变已持久请求/body/key；已有接收失效须保留监测并走同一合法责任链重新取得接收证据。

### CTR-RTH-003 — Narrow responsibility metadata, immutable UNKNOWN

MUST 保留原 tuple、attempt generation、Router processGeneration、runtime epoch 和各自
来源，不互换；旧拒绝事件、terminal verdict、WAL、停止/副作用证据和 UNKNOWN 保持。
不得 un-terminal、re-refuse、recover/deliver 原业务、mint generation、新建业务 request，
不得写 business/termination settlement 或 Router/Scheduler fence/occurrence/nextRun。

这里只**请求**同一 append-only ledger 的 B2 terminal handoff 元数据窄例外：意图、服务
事实、接收证明、答复验证、下次触发及投影。正式 whole successors 接受前零追加权限。
未来每次追加须 append+fsync、现有锁、fresh replay、exact identity/revision CAS、幂等；
迟到旧代只留对应历史，不能改新代责任。未知/损坏 ledger 保持 UNKNOWN 并安全升级，
不能按空集合通过。不授 a/b 自动 closure 或把 handed-off 等同 attempt SETTLED。

### CTR-RTH-004 — Closed DTO and fail-closed compatibility

以下均为**提议 schema**。request 根为既有 instance/visit/dispatch/reason/
lastAttemptId/可选真实 attemptCount 加一个条件必填 `recoveryRefusal`；新 reason 必填
`workflowInstanceId/nodeVisitId/dispatchIntentId`（UUID）、`lastAttemptId`（原 opaque
attempt ID），reason const `RECOVERY_REFUSAL_TERMINAL`。attemptCount 若给出为实际
非负安全整数，不作本触发门。根与所有嵌套对象 `additionalProperties:false`；不接收
prompt、context、正文、任意 map 或用户身份字段。所有旧 reason 禁携此对象，保持原 wire。

`recoveryRefusal` 全部必填、不允许 null；整数均安全整数，时间 >=0，字符串非空：

| Field | Closed schema / relation |
|---|---|
| schemaVersion / responsibilityKind | integer const 1 / string const B2_TERMINAL_REFUSAL |
| ownerPrincipalId | UUID，原 ledger owner，非接收方；assignee差异时不声称权威一致 |
| requestId / generation | string maxLength 512，等于原 lastAttemptId；integer 1..9007199254740991 |
| refusalKind | enum VISIT_MOVED / HISTORICAL_VISIBILITY / ASSIGNEE_MISMATCH / INSTANCE_TERMINAL |
| refusalEventDigest / scheduleEventDigest | string pattern ^[0-9a-f]{64}$，各为原始事件字节 SHA256，非正文 |
| refusalAtMs / firstCheckAtMs / intervalMs | integer 0..MAX / 0..MAX / 1..MAX；来自原事件/cadence，求和溢出拒绝 |
| intentAtMs / expectedRecoveryRevision | integer 0..MAX / 0..MAX；首次持久意图时间固定；revision在锁中匹配 |
| businessOutcome | string const UNKNOWN，非业务结算 |

MAX=9007199254740991。可信 Core producer 对自身 ledger 来源负责，Svc 验证自身权威关系、
系统身份及报告绑定；digest 本身不证明事件合法或赋权。Svc 从权威数据派生 Domain、
historical assignee、接收者及 MATCHED/ASSIGNEE_DISCREPANCY 判定，不信任客户端自报。
不能证明历史关联、拒绝来源或必要差异时不写新分支。

成功响应保留既有 `escalated`（boolean）、`assistanceCaseId`（UUID）、
`workflowStateVersion/eventSequence`（正安全整数），条件增加 closed `refusalHandoff`。
该对象字段全部必填：`schemaVersion` const 1、`commandReceiptId/commandKey`
（非空 string max512）、`sourceOwnerPrincipalId/historicalAssigneePrincipalId/
domainId/receiverPrincipalId/requesterPrincipalId`（UUID）、`relationship`
（enum MATCHED/ASSIGNEE_DISCREPANCY）、`requestEventSequence`（正安全整数）。
source owner 等于请求原 owner；MATCHED 时两 assignee 值相等，DISCREPANCY 时必须不等
且请求类别为 ASSIGNEE_MISMATCH；case/key/原 tuple/reason/digests 的服务持久关联可读回。
无该同意图关联的已有 case/`escalated:false` 不得假充成功；Svc 应拒绝或返回可核对的
同意图事实，不得本地补造。新增 case/resolution 只记责任处置，不改变实例终态/业务状态。

沿既有幂等 command receipt 的写/读回机制承接此 DTO；Svc 必须在配对 successor 定义
其可调用的历史对象查询/Owner inbox/detail/action 面。**不扩展/复用 active
owner-assistance-resume-evidence DTO 为本交接回执**；其既有两 reason、nullability、
sequence/identity/baseline/current/settled 门完整保留。新 reason 的任何消费均不得授 resume。

旧服务不识 reason/字段按原 validation 拒绝；不得删对象、降级为旧 reason 或换身份重发。
旧消费者未知枚举/版本 MUST fail closed，记录 unsupported 并保留责任/下一触发，不能当成
移交、业务完成或 admission。新消费者继续读旧事件/两旧 reason；#643 仅在其配套权威
实际接受时另增资格，不由本提案带入。上述为兼容验收要求，未经实测不得声称旧 binary
已满足；不能证明兼容便不启用 producer。回滚仍须保留原责任、服务事实及历史。

### CTR-RTH-005 — Receipt, receiver, verified reply and retrigger

1. 既有 due poller 的 refused 责任分支在同 ledger 先持久精确 intent/body/key 及 next-check，
   再请求服务。稳定 key 由 schema tag、新 reason、原 tuple及原 refusal/schedule digests
   确定；不含重试次数、每轮 now、新 current owner 或观测 revision。首次 intent 的
   intentAtMs/expectedRecoveryRevision 固定；后续追加另用 fresh CAS，不改服务 body。
2. 超时、425/503、服务提交后回包丢失和进程重启，MUST 用同 key/body 读回/幂等重取
   **Assistance 命令**事实，不能重发原业务或换 key 规避冲突。同 key 不同 body 的
   conflict 保留并升级。跨服务无单事务假设，未知提交状态保留 pending/UNKNOWN。
3. handoff 证据须同 intent 的真实 Svc command receipt、case/request sequence、
   tuple/reason/digest、system requester、权威 Domain/历史 assignee及接收 Owner。
   沿既有 `wfassist-<caseId>`、`inter_agent` 路径取得 exact admission/correlation；
   case ID、函数存在、入队/ACK 或 naked chat 不等于责任接收。送达状态未知先重查同请求，
   不盲发第二 prompt，不把 Owner 冒充旧 visit 的 workflow_execution executor。
4. 只有上述服务事实、合法接收证明、接收者、后续消费者、持久答复验证与再触发均可核对，
   才可投影 HANDED_OFF。后续消费者明确为既有 Owner Assistance inbox/action 链和
   既有 due poller refused 分支的交接监测/答复验证；它们的本新分支尚未实现，不把名字
   当注册证据。原 poller 移交后仍持久监测；没有任一环节则保留原自动责任及 next-check。
5. 答复须由 Svc 持久 case request/resolution command/event provenance 验证：同 case/
   key/原 tuple/reason、真实 requester、resolution 时获权 Domain Owner、同实例事件
   序列满足 request < resolution <= read version。历史对象不要求伪造原 pre-plan baseline。
   普通聊天“done”、ACK、过期/错误身份/冲突答复均无效。有效答复仅安排原权限内只读
   重检，不授业务执行；无答复或消费者/读回失败时，正有限 backoff 后 durable retrigger。
6. 重启从唯一 ledger 重建 pending/handed-off 和 next-check；本轮有限正扫描/读/交接预算、
   上限退避与公平轮转，失败项不饿死健康项。仅有计数耗尽、进程 timer/Map 或返回 summary
   不得使责任消失。不把 next-check 写为 Scheduler nextRun，不依赖 Root/Owner 提醒续跑。

同 ledger 新证据闭合为：原 tuple/来源 digests、固定 intent及 `handoffCommandKey`
（非空 string max512）、`handoffReceiptId`（非空 string max512 或 null）、
`assistanceCaseId/receiverPrincipalId/historicalAssigneePrincipalId`（UUID或null）、
`requestEventSequence/resolutionEventSequence`（正安全整数或null）、`deliveryRequestId`
（wfassist-<caseId>或null）、`deliveryProofRef`（可信关联ID，非空 string max512或null）、
`consumer`（enum EXISTING_DUE_POLLER_REFUSAL_MONITOR / EXISTING_OWNER_ASSISTANCE）、
`handoffState`（enum PENDING / HANDED_OFF）、`nextCheckAtMs`（非负安全整数）。
保留每次追加的来源时间和 fresh CAS revision；未证字段必须 null，意图/reason/原身份和
未完 next-check 不可 null。无任意结果载荷。此处不定义 CLOSED 或自动关闭权限。

### CTR-RTH-006 — Independent acceptance, no resume or transport expansion

本 reason、移交和 case resolve 均 MUST 被 Owner-resume/admission 消费者拒作 permit；
不能因识别新枚举就 mint generation。UNKNOWN 不变成 known delivery/settled/termination，
不补造 preDeliveryWorkflowStateVersion，原 WEC/D-009 gate 全保留。另一路未来合法动作
仍须自己的 accepted authority和 exact 前置，不能重用此回执当执行许可。

MUST 与 #643 分别验收/接受、分别保留触发；“第二份新增 reason”不表示现有枚举只有一值。
当前旧枚举两值；未来两提案均配套接受时才可能共存四值，不由本文件宣布四值已生效。
与 #1379 只共享合法传输证明，不把其实现纳入本接受范围或用其 ACK 关闭交接。

## 10. Acceptance

这是后续接受/实现的定义，**本轮没有产品执行 PASS**。除 ACC-RTH-001 的文档审查外，
须未来可信隔离持久环境，正式 Core/Svc 入口和测试专有 DB/真实重启，记录 exact
Core/Svc base/head、配置/时钟、输入/故障、原 tuple、ledger前后、服务/送达/答复收据、
业务与 Assistance 调用计数分列、实际 result/rc。人工推进/内存桩不能冒充无人值守 E2E。

| Acceptance | Contracts | Method / environment | Required evidence | Expected result / failure condition |
|---|---|---|---|---|
| ACC-RTH-001 | CTR-RTH-001..006 | 独立固定head文档审查；对照§3/两提案/六约束 | reviewed SHA/hash、来源、blocker union/final delta | proposed/NEW零实施权、successor/Svc门明确；误激活/偷带aging或closure即失败 |
| ACC-RTH-002 | CTR-RTH-001/002/003/006 | 正：真实visit迁移、可信历史visibility、assignee差异、实例终态各自合法refusal；负：503/planned/无schedule/伪refusal/version-only | 原拒绝+cadence、主因、历史关系及新分支调用数 | 无aging前提；各正例在获权后可交接，负例零新分支写且保责；任意字符串造资格失败 |
| ACC-RTH-003 | CTR-RTH-001/002/003/004 | 正式系统actor；合法历史tuple与discrepancy-only正例；错instance/visit/dispatch/假owner、缺来源/Domain/Owner、旧revision跨新代负控 | 服务关系读回、双份身份、授权拒绝、CAS、原事件/保护状态hash | 特例不冒认source owner；仅new reason可处理历史对象；其他错误拒绝保责，零重开/冒充/新业务 |
| ACC-RTH-004 | CTR-RTH-003/004/005 | commit后丢回包、425/503、key冲突、已有无关联case；逐项真实重启 | 固定key/body、服务receipt/readback、intent/fsync/重建 | 同意图同事实，不重复case/盲发prompt；无关联不交接，未知/失败保留责任与下次触发 |
| ACC-RTH-005 | CTR-RTH-002/003/005/006 | 送达失败、ACK-only、缺consumer、Owner变更、无答复/错旧冲突reply；正对照真实接收/合法答复并重启 | 服务事实→接收→consumer→reply→next trigger链与独立调用计数 | 全链才HANDED_OFF，之后仍监测；失败保原自动责任，无Root催促自动安全再查；reply不能执行业务 |
| ACC-RTH-006 | CTR-RTH-003/004/006 | 旧Svc/旧Core/新消费者矩阵；两旧reason、未配套aging、新reason未知版本/字段、UNKNOWN predecessor+resolve | 实际validation/unsupported/升级门、旧事件字节、resume/admission count | fail closed且责任不丢；证明前不开producer；旧resume DTO原义/旧current门保留，不识别即放行失败 |
| ACC-RTH-007 | CTR-RTH-001..006 | scoped持久重启/公平预算/D-009/WAL/CAS回归；停用producer后重启、仅terminal/moved观察 | 完整旧前缀、UNKNOWN/terminal/fence/nextRun、效果计数、实际rc | 不自动a/b closure/新generation；无第二账本/传输实现依赖；文档或函数存在不能冒充运行/业务PASS |

反向覆盖：CTR-RTH-001→ACC-001/002/003/007；002→001/002/003/005/007；
003→001..007；004→001/003/004/006/007；005→001/004/005/007；006→001/002/005/006/007。
6/6 有验收定义，定义不等于实际执行结果。

## 11. Alternatives and disposition

- RETAIN：唯一 ledger、现有 due poller/reconciler、普通 Assistance、旧exhaustion入口、
  Owner消费/幂等收据与历史 Evidence；资格不同的 reason 不合并成一个计数模型。
- REJECT：只给#643加reason而保留其历史对象拒绝集；伪装exhaustion/assignee，换tuple，
  交接即业务成功/UNKNOWN settlement，借B1/B4窄例外写B2 terminal。
- REJECT：本提案直接整权替代WEC/LIVENESS/WAE但不带完整有效正文；NEW不用于规避继任。
- REJECT：任意错误owner都可接收。仅CTR-RTH-002明确来源/关系/不等事实的处置特例可提请接受。
- 未来获权实现才 MIGRATE 此责任的消费投影；当前不RETIRE未完责任，不新增永久fallback/映射。

## 12. Migration, compatibility, and rollback

当前仅proposed文档，无运行时迁移。未来须先Core/Svc权威承接和main接受→含接受的base
RE_PREFLIGHT→先证明服务/消费者兼容和历史case可发现/答复→另行授权启用producer。
沿用同一ledger，旧事件不bulk改写，不要求补造原schedule/基线；未获权/缺来源仍保留旧观察。
与#643可共享实现骨架，但接受坐标/启用条件独立；不得先开放全部reason再等接受。
生产停用/回滚另走正式权限，保留未完责任、UNKNOWN、旧事件、真实服务事实和可接续消费者。
本文件不执行发布，不以回滚清fence或复活旧业务操作。

## 13. Open questions and authoring boundary

须后续明确接受的开放面：Core整权successor的ID/精确继任交易；Svc历史/closed case、
discrepancy-only资格、原Domain当前Owner选择、历史case inbox/detail/action及幂等读回的
配对权威与正式调用面；Owner变更后的合法再接收。本文给出提议义务，不声称现入口支持。
未来Svc若不能以这些约束接受，则拒绝保责、重做受影响提案；不得在实现/Review中补出权限。

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = NEW (independent proposal; accepted-meaning activation requires SUPERSEDE)
SPEC_ID = AGENT_CORE_REFUSAL_TERMINAL_HANDOFF_V1
STATUS = proposed
PRIMARY_PARENT_AUTHORITY = accepted LIVENESS V1 / WEC V3 / WAE V3, constrained not replaced
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED (cross-repository lifecycle/protocol; docs only)
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO (this proposal)
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_AUTHORITY = none
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
OPEN_OWNER_DECISIONS = proposed historical/discrepancy case semantics; Core whole successors and paired Svc acceptance
NORMATIVE_TBD = NONE_IN_PROPOSED_DESIGN; acceptance dependencies remain OPEN
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 6
CONTRACTS_WITH_ACCEPTANCE = 6
AUTHORING_READY_FOR_REVIEW = YES (proposal only)
READY_TO_MARK_ACCEPTED = NO
DONE_WHEN = bounded proposed doc + independent review + receipt + branch pushed + open base-main PR, no merge
EXPANSION_TRIGGER = required gate failure, authority conflict beyond disclosed delta, non-doc write need
NEXT_ACTION = independent REVIEW then docs delivery; later separate acceptance and implementation RE_PREFLIGHT
```

原 STOPPED-1377-MINIMPL 及各原任务门保持，不因本文/独审/发布而关闭；#1377全量完成、
源码/安装/运行时/业务/无人值守结果均未在本任务发生。
