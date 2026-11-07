---
spec_id: AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V2
status: accepted
accepted_by: mayf3
accepted_date: 2026-11-08
accepted_at: 2026-11-08T00:00:00Z
acceptance_authority: Owner mayf3 ruling owner-20261108-three-unified items[1]
acceptance_authority_source: /Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json
acceptance_authority_selector: $.rulings[id=owner-20261108-three-unified].items[1]
acceptance_authority_canonical_sha256: 00f1fb2995d5f83a3bb9f50f442754fadb13f46274c2f1cbafd5f90253d5b218
acceptance_reviewed_head: e6e326986febeaaef7e51a632d0862fa7fc9099e
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
authority_action: SUPERSEDE
repository: mayf3/dsh-agent-core
date: 2026-11-08
authoring_base: b6ddc2a67ba041b8b13ed33d331104cf809d4985
scope:
  - complete effective PPR V1 and inherited WAE and Recovery Liveness authority
  - bounded B2 terminal refusal responsibility metadata and handoff protocol
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_WORKSPACE_SESSION_MODEL_V3
  - SCHEDULER_OCCURRENCE_OUTCOME_V3
  - AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1
  - AGENT_CORE_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V2
  - AGENT_CORE_REFUSAL_TERMINAL_HANDOFF_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_EXECUTION_CONTROL_V3
    revision: b5096782f666ad22aa3508fdbf9562278a977c0f
    relation: constrained_by
supersedes:
  - AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V1
superseded_by: null
owners: [mayf3]
---

# AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V2

**PROPOSED / 零当前实施权 / 零生产权。接受=Owner mayf3；本 PR 不执行接受或合并。**
未来正式接受须将本候选与 WEC5 显式改为 accepted/contracts、production none，并按 §12
原子退休直接前驱。RTH V1 维持 accepted/none；不能仅改其权限或引用它来取得实施权。

## 1. Goal

完整继承 PPR V1（含完整 WAE/Liveness），将 RTH V1 已接受的六项 refused protocol 语义
纳入未来 implementation-authority Contracts。交接的是拒绝后的责任，原 attempt 不恢复，
UNKNOWN 不结算；既有 #644 blocked 自动恢复和 PPR 初始 ordinary planned 范围保持。

## 2. Scope and non-goals

仅为 ACTIVE 时已存有效 refusalSchedule、经合法 blocked world-drift refusal 到达
terminal `NEEDS_REVIEW/recovery_refused`、责任未合法转移的原 B2 对象，新增同 ledger
handoff 元数据窄例外及既有系统 Assistance 可靠交接/答复验证/失败再触发。
四类可信来源为 VISIT_MOVED/HISTORICAL_VISIBILITY/ASSIGNEE_MISMATCH/INSTANCE_TERMINAL，
不能从任意旧字符串推断。无原 cadence/provenance 则不补造。

附录 A 完整携入 PPR V1 全文（含 A/B 原 WAE/Liveness），§9.2 携入 RTH 六合同。
不扩大首次 admission、不授权重拒绝/重开/replay/new generation/自动 a/b closure，
不带入 aging reason/#1379 传输实现，不建第二账本/queue/业务引擎，不授生产权。

## 3. Authority and dependencies

Owner Standing Delegation V1 `CTR-SOD-003` 原 §3B、四 PR 裁定③
`owner-20261107-four-pr-rulings.items[2]` 与用户本 Brief 授权 docs-only 起草。
来源与实际 hashes 见 [收据](../../RECEIPT-RTH-CORE-SUCCESSOR.md)。RTH1 §3.1 要求 owning
WEC4/PPR 整权继任；PPR1 §2/§8/CTR-PPR-004 明确拒绝当前新协议，不能以 NEW 或
AMEND 绕过。路线 SUPERSEDE/BRIEF/CONTROLLED/AUTHORITY_AUTHORING，docs-first。

本候选只 whole-supersede PPR1，不重新继任已由它退休的 WAE3/Liveness1，不以历史
Liveness 的 clause exception 新开 partial supersession。配对 WEC5 整体替代 WEC4。
两候选共享高优先级父权威；其横向配对依赖在此及 §12 声明，不互作 governed_by 构成循环。
SRE、D-008/D-009/alignment、Owner Workflows、RBAH/RTH 语义来源及 Svc 业务所有权保持。

Svc V3 reference 只绑定现有 reason/current/鉴权限制，**不承接 RTH**。正式实现须有
Svc 自己接受并入 main/base 的完整配对权威，覆盖 CTR-RTH-002/004/005 的历史关系、
discrepancy-only、原 Domain 当前合法 Owner、幂等写/读回、inbox/detail/action/reply。
缺失时不调用新分支、不造 receipt；未来接受时须绑定真实 ID/Contract/revision，不写假坐标。

## 4. Current State

`STATE-PPR2-001` — subject=本地恢复权威与提案状态；as_of_commit=
`b6ddc2a67ba041b8b13ed33d331104cf809d4985`；environment=隔离 worktree
`/private/tmp/h1377-minimpl`、`docs/rth-core-successor`；observed_at=2026-11-07T21:33:34Z；
basis=OBS-PPR2-001/002、EVD-PPR2-001。PPR1 accepted/contracts 已为基线 main 权威；
WAE3/Liveness1 superseded→PPR1。RTH1 accepted/none 的实施闸门未关闭；本任务无产品实现。

## 5. Observations

- `OBS-PPR2-001` — 上述时间/环境以固定 Git 对象、正文/元数据/hash 只读核对：PPR1
  同时携带 WAE/Liveness，仍禁止 B2 terminal 新 append；CTR-EKRWAE-007/CTR-PPR-004
  要求可靠交接但没有授予新 reason/接收入口。RTH1 六项协议已限定接受。收据列坐标与 hashes。
- `OBS-PPR2-002` — 同期 fresh Core main b177d3fc… 只新增 #663 实施；受影响权威未变。
  Svc main b5096782… WEC V3 仍不接受新 reason/历史接收；方法、精确 full SHA/links 见收据。
  #644 的 merge ancestry 仅证明原 blocked 源码交付在基线，不冒称本轮重新执行测试或业务验收。

## 6. Claims and assumptions

- `CLM-PPR2-001 (SUPPORTED)` — terminal metadata/封闭 reason 的变义必须 whole PPR successor，
  不能仅改 historical Liveness 或 additive AMEND。依据 EVD-PPR2-001；无已知反证。
- `CLM-PPR2-002 (SUPPORTED)` — 合法收据与接收全链缺一均须保责；现有自动责任义务本身
  不创造系统 caller 或历史写权限。依据 EVD-PPR2-002；实际能力资格仍 UNKNOWN。
- 条件活性：只在依赖最终可用、持久状态可读、既有调度公平时承诺自动重查/交接；永久不可用
  仍保责，不承诺业务完成。此为失败结果界限，不以未来可用性假设解除任何 gate。

## 7. Evidence relations

| Evidence | Source / target / relation | Coordinates, sufficiency, limitations / provenance |
|---|---|---|
| EVD-PPR2-001 | OBS-PPR2-001 → STATE-PPR2-001、CLM-PPR2-001 / SUPPORTS | 基线 PPR1 §8/CTR-PPR-004/附录 terminal rules、RTH1 §3.1、SPEC_FORMAT §14；足以路由，不证明实现；收据 hashes/crosswalk |
| EVD-PPR2-002 | OBS-PPR2-001/002 → CLM-PPR2-002 / SUPPORTS | 基线 RTH 六约束与固定 Svc V3；足以识别配对门；不证明服务运行/消费者；收据固定来源 |

## 8. Decisions

`DEC-PPR2-001 (PROPOSED, owner=mayf3)`：完整继任 PPR1，不改既有普通计划和 blocked
首次 admission；只承接已限定接受的 RTH refused protocol 到未来 contracts 实施面。
`DEC-PPR2-002 (PROPOSED, owner=mayf3)`：恢复入口 terminal no-op 与责任消费分支分开。
后者只在本版明确的元数据窄例外内追加；不把 handoff 变为恢复授权或责任自动 closure。

### Effective composition and immutable identities

先适用高优先级父权威，再应用附录 A 的 PPR1 完整有效组合（含历史 Liveness scoped
effects 和 PPR 六项 planned 差量），最后应用下表及 §9.2 的**唯一 RTH 差量**。
本候选全局 Contract ID=`AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V2#<本地ID>`；
附录旧全局身份不改义。RTH 携入后本地 CTR-RTH-001..006 是本候选新全局身份，不改 RTH1。
来源 body 中的旧 lifecycle/mandate/未合 main/本轮结果只保留历史语境；本提案权限由自身前言、
frontmatter、§3/§12/§13 控制。全部未变义务/验收继续有效，不能因“历史”而删除安全或测试要求。
继承 Acceptance 的产品正负测试/证据门保持；其中 source authoring-only 的版本、旧前驱退休
清单/旧 PR 操作不重演，本次文档/接受生命周期由 ACC-PPR2-001/§12 覆盖。carried
ACC-RTH-001 的 NEW 是 RTH1 原提案路线，本后继对应检查为 SUPERSEDE；不得误称本候选 NEW。

| PPR1 coordinate @ authoring base | 本后继有效处置 |
|---|---|
| §2（68–83）、§8（217–231）、CTR-PPR-004（313–318） | 仅解除本版 RTH 精确定义类的“新 reason/terminal 后 handoff metadata 一律不得追加”；不解除 closure、业务恢复、未知 replay 或其他责任限制 |
| 附录 A CTR-WAE-005（813–833）、012（996–1057）；附录 B §8（1439–1451）、CTR-EKRWAE-003（1481–1496） | 增加 CTR-RTH-003/005 的 B2 terminal handoff-only append 白名单；旧 B1/B4 例外原义不变，其他 terminal 写继续禁止 |
| CTR-WAE-013 E3/E5（1083/1085）、CTR-EKRWAE-004/005（1498–1536） | RETAIN：recoverAttempt terminal no-op、原 gate/合法 refusal、terminal 前预存 schedule，不从新元数据重新恢复/拒绝 |
| CTR-EKRWAE-007（1556–1565）、CTR-PPR-004（307–324） | 全链交接与失败保责义务完整保留；本版补可接受后实施的合法具体协议，不降低“接收/消费者/答复/再触发”门 |
| CTR-WAE-007/008、CTR-EKRWAE-001、CTR-PPR-001..003/005/006、其余全部 | RETAIN：真实身份、immutable assignee、原 WAL/UNKNOWN、普通 generation=1 planned 闭包、#644 已交付边界、持锁 fresh 恢复 gate、负控及验收 |

## 9. Contracts

### 9.1 Complete inherited obligations

附录 A 为 PPR1 frontmatter 后完整正文的逐字副本，含所有 27 项有效 Contract：
14 WAE（含 001b）、7 EKRWAE、6 PPR。其附录和历史 scoped effects 均完整，不以外链代替。
WEC4 依赖在未来同时接受的组合中解析为 WEC5，未变 lock 规则不再复制解释成新解锁权限。

### CTR-PPR2-007 — Narrow exception, unchanged proof and activation

Core MUST 只按 §8 的精确 RTH 白名单以及下方 CTR-RTH-001..006，向唯一 ledger 追加
B2 terminal handoff 元数据；append/fsync、FIFO/OwnerLock、fresh replay/CAS、原 tuple 和
旧代迟到隔离不变。MUST NOT 将恢复入口 terminal no-op 改为 handoff/recovery 写入口，
也不得追加自动 CLOSED/settlement 或复用 B1/B4 例外扩大资格。UNKNOWN/损坏 ledger
必须保守保责，不得按空集合重建或覆盖原事件。

本差量 MUST NOT 扩大 PPR1 的 ordinary initial generation=1 planned eligibility、
Owner/stale/后继代范围或 proof schema。`plannedRecoveryProof.sourceAuthorityId` 的 V1
常量与原 revision/writer provenance 校验完整保留；不能因新 Spec 名就换成 V2、填候选 SHA、
重写旧 proof 或补造原 writer 资格。它是原 plan 的来源证明，现行恢复 gate 另受本完整后继
约束；本 RTH 任务不授权新 proof tag/新 writer 资格路径。需要另变此契约须重新路由。

RTH 实现 MUST 等 WEC5/PPR2 accepted/contracts 和 Svc 配套 accepted Contract 分别进入
各自 base，绑定精确接受坐标；仅本提案或 RTH1 接受不解闸。未知兼容/服务拒绝/无消费者
均保原责任/next-check、不开 producer；不推定旧 binary 已 fail closed。

### 9.2 Complete RTH protocol carried as implementation contracts

下方六合同从 accepted RTH1 §9 逐字携入；生效只取决于本后继的正式接受与配套 gate。
其中“本提案请求/未来 successors/零追加权限”等来源阶段表述不构成自我否决或提前赋权：
本次仍零权；未来 §12 条件全满足时，由**本整权后继**而非 RTH1 授予严格限定的实施权限。

<!-- BEGIN CARRIED RTH CONTRACTS -->
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

<!-- END CARRIED RTH CONTRACTS -->

## 10. Acceptance

全部是验收定义，当前无产品执行 PASS。先完整继承附录 A 的 ACC-PPR-001..005、
WAE 原 suites 和 ACC-EKRWAE-001..008，再执行以下 RTH carried acceptance 与本版门。
实现证据须正式 Core/Svc 入口、隔离持久 store/测试 DB、真实重启，绑定 exact heads、
配置/时钟/故障、实际调用数、ledger/服务/接收/回复/触发读回。人工辅助不算无人值守 E2E。

<!-- BEGIN CARRIED RTH ACCEPTANCE -->
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

<!-- END CARRIED RTH ACCEPTANCE -->

### ACC-PPR2-001 — Complete authority, scoped exception and pairing

- Contracts: 全部 34 项（27 inherited + CTR-RTH-001..006 + CTR-PPR2-007）。
- Method/environment: 非作者 exact-head 文档/来源逐字比对、全局 ID/有效组合与生命周期审查。
- Required evidence: base/source hashes、carried sections、crosswalk、反向覆盖、proposed 元数据；
  后续接受时另附 reviewed head/hash、Owner 接受与 final-head/main 双向退休关系。
- Expected result: 无遗漏/partial supersession，新增例外仅 RTH 元数据；当前 none，未来
  contracts 与配套门明确；未执行接受不得假称 gate 已关闭。
- Failure condition: 任一旧义务丢失、直接复活旧 WAE/Liveness、漂移 proof tag、提前退休/赋权。

### ACC-PPR2-002 — Boundary and unchanged recovery

- Contracts: CTR-PPR2-007；全部 inherited WAE/EKRWAE/PPR；CTR-RTH-001..006。
- Method/environment: 附录完整 applicable suites + 正式持久 RTH 分支；正 blocked/合格初始
  planned 与负 terminal-recover、legacy planned、generation>1/Owner/stale、ACK 丢失、
  delivery_started、假 provenance、B2 a/b closure、aging 未配套、错 reply/缺消费者/重启。
- Required evidence: 独立恢复/交接/业务调用数，实际 rc，原 proof 字节、原 terminal/UNKNOWN/
  fence/nextRun/账本前缀，CAS/重启后责任和 next-check，服务/接收/答复的完整链。
- Expected result: #644 gate/顺序/审计/消费者保持；planned 原闭包/WAL 保持；仅获权 RTH
  元数据可追加，恢复 terminal 始终 no-op；失败保责，零新代/业务 replay/settlement/自动关闭。
- Failure condition: 新 metadata 触发旧业务、任一来源/回执伪造、责任丢失或回归门失败。

反向覆盖：27 inherited → ACC-PPR2-001/002 及附录 A §10 原逐项表；CTR-PPR2-007 →
ACC-PPR2-001/002；CTR-RTH-001..006 → ACC-PPR2-001/002 及本节 carried ACC-RTH-001..007
逐项表（本节所携入）。34/34 有验收定义，定义不等于实测。

## 11. Alternatives and disposition

- NEW/supersedes[]：拒绝，不能优先于既有 terminal/closed reason 禁止。
- AMEND PPR1：拒绝，改变排除和验收通过集合；不满足 SPEC_FORMAT §14.2。
- 仅 Liveness 新后继：拒绝，它已整体退休于 PPR1，不能旁路 PPR 或复用历史 clause 例外。
- 单份 WEC4+PPR1 完整合并后继：合法备选；推荐 WEC5/PPR2 分别完整继任并配对接受。
- RETAIN 唯一 ledger、既有 poller/消费者、旧入口、原 proof/schema/历史证据；未来在既有
  refused 分支 MIGRATE 合法责任投影，不创建平行引擎或永久兼容 fallback。未完责任不退休。

## 12. Migration, compatibility, and rollback

本 PR 不改任何 accepted authority，不执行接受、退休或 current pointer 迁移。
未来 Owner 接受须另一个 docs-only 原子事务：PPR2 与 WEC5 显式 accepted/contracts、
production none；PPR1→PPR2、WEC4→WEC5 reciprocal whole backlinks，同时迁移 current
dependency notices/index/local pointers、ASM two-kind provenance 与 SRE 历史 scoped-effect
carrier；RBAH/RTH 仅更新现行载体说明，其历史正文/语义/限定权限保持。旧 WAE3/Liveness1
仍 superseded→PPR1→PPR2，旧 WEC3→WEC4→WEC5；历史接受/实现 Evidence 不覆盖改写。

本后继移除 direct governed_by WEC4，用共享高优先级 parent 与明确 WEC5 配对保持 precedence
无环。source 中的 WEC4 产品约束完整解析至完整继任 WEC5，不按旧文件缺少 RTH 作为旁路。
须非作者精确语义审查、接受者真实权限、reviewed SHA/hash、独立 final-head recheck 和 main
激活记录；如并行 authority 发生实质冲突，停止依赖接受并记录，不静默择一。

Svc 配对完成并分别进入实施 base 后才另任务 REUSE 实现；服务/reader/consumer 兼容先证，
producer 后启。旧 cadence/proof 缺失不 backfill、不替换身份、不 bulk 改写 ledger。
停用/回滚仍保服务收据、UNKNOWN、原责任与消费者，不重开旧 attempt/恢复已退休规则。
产品/安装/运行/业务/无人值守验收与生产 Mandate 各自独立；本 PR 全部未执行。

## 13. Open questions

- 本精确双 successor 的后续 Owner 接受与 main 生命周期交易；本次授权只交 proposed PR。
- Svc 所属新整权 successor ID、具体可调用 historical receipt/inbox/action/reply 面、
  Owner 变更后原 body/key 不变的合法再接收、其接受 head/main SHA：REQUIRED/UNKNOWN。
  本候选已决定 Core fail-closed 结果，不能在实现里新造 Svc 政策或把 case ID 当接收证明。
- 真实 producer/reader/consumer 资格、回滚兼容、运行与无人值守链：UNKNOWN，未来验收。
  不因这些未执行门冻结当前既有 accepted 合同内的无冲突工作。

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = SUPERSEDE
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO (new successor)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_AUTHORITY = none
ACCEPTED_TARGET_IMPLEMENTATION_AUTHORITY = contracts (separate Owner transaction)
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
OPEN_OWNER_DECISIONS = exact proposed acceptance; paired Svc acceptance
NORMATIVE_TBD = NONE_IN_CORE_DESIGN (Svc acceptance remains a closed implementation gate)
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 34
CONTRACTS_WITH_ACCEPTANCE = 34
AUTHORING_READY_FOR_REVIEW = YES
DONE_WHEN = proposed docs + independent review + receipt + commit/push + open base-main PR; no merge
EXPANSION_TRIGGER = authority conflict beyond declared delta; failed required check; non-doc need
FAILURE_ACTION = STOP dependent work and append STOPPED-1377-MINIMPL.md
NEXT_ACTION = REVIEW
```

## Appendix A — Complete PPR V1 carried source including WAE and Liveness

Source: `AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V1` @ authoring base; frontmatter excluded.
SHA256: `babb74a2bef6cdbc31deac52f54b5bb82015e9a4c81c0e15116ab658d4dc8c1b`.
Effective composition/history handling: §8. The following body and all its appendices are byte-preserved.

<!-- BEGIN COMPLETE PPR1 SOURCE -->

<!-- R4_PPR_ACCEPTANCE_LIFECYCLE -->
> **当前：Owner mayf3 正式接受事务已记录，implementation contracts / production none。**
> 非作者语义独审 HEAD `a3f5f601ab7741ebc314cfefbf1e3ec9591ab8db` PASS，0 blockers；
> 本事务同时整体退休 WAE3/Liveness1，互斥回链及当前依赖载体同步。
> main 激活须 #655 先合入，再由监管核验并合 #657；目前不宣称 main 已生效。
> 下文 proposed/本准备/待独审等保留已审语义候选时点，当前生命周期以前述元数据和本说明为准。
> 后续源码实施须 accepted revision 入其base及新任务REUSE；双writer、持久证明和运行验收仍NOT_RUN。
> ordinary planned、UNKNOWN、fresh gate、原身份与原WAL约束不变；不激活aging/refusal新协议。
<!-- END R4_PPR_ACCEPTANCE_LIFECYCLE -->

# AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V1

**PROPOSED / 本准备零实施权 / 零生产权。** 原始立项裁定④的历史边界保留；
Owner 四 PR 裁定②与常设授权原 §3B 已决定本版有界语义及正式接受委托。
本语义准备仍 proposed/none，须非作者独审后另作接受事务，将实施权统一为 `contracts`、
production none。未合 main 的接受分支不压过现行 main 权威；本轮不实施、不合并。

## 1. Goal

为 ordinary planned 在首次投递前中断后，提出可验证的同身份自动续接合同。
正例是可信 `attempt_planned` 已持久化、尚未进入任何投递边界的初始普通计划；
恢复只能完成它的**第一次** admission。缺记录、ACK 丢失、执行已终止与业务零效果
分别判断，不能互相替代。不把 #644 的 blocked-only 交付改称 blocked/planned 全量完成。

## 2. Scope and non-goals

本文是 WAE V3 与 Liveness V1 的完整合并后继候选。§9.1/附录 A、B 完整携带两份来源的
要求、验收与历史约束；§8 规定有效组合和唯一新增差量，§9.2 给出六项新合同。

本版 ordinary planned **精确定义**：正常 due-feed admission 创建的初始 generation=1、
ACTIVE/planned、没有 resolution failure、Owner-resume permit 或 stale-reentry 来源的原计划。
它必须携带 CTR-PPR-005 的可信原始证明，且原 plan 已持久保存 WEC 要求的
`preDeliveryWorkflowStateVersion`。本版不覆盖后继 generation 的未发送计划；不得把
Owner/stale 计划去掉来源字段伪装普通计划。是否另扩其范围是未来新决定，不是隐含许可。

只复用既有 Scheduler/poller/reconciler、FIFO/OwnerLock、唯一 append-only WAE ledger、
`recoverAttempt`、exact resolver、Router correlation 与原 delivery seam。
不增平台、queue、ledger、全局锁、model-facing recovery 工具或第二 transition 入口。
既有 blocked B2、B1/B4、WEC Owner-resume、SRE stale、D-009 及 Svc 业务权限保持。
不接管 #650 a/b closure、B2 refused-terminal 新交接语义、#643 新 reason 或 #1379 传输改造。

## 3. Authority and dependencies

### 3.1 Authoring mandate and resolved route

授权：用户 [BRIEF](../../BRIEF-PLANNED-PROPOSAL.md) 与
`rulings[id=owner-20261107-five-decisions].items[3]`（④，2026-11-07 20:54）：
“planned恢复合同立项: docs-first起草走审查(接受仍需Owner)”。选中裁定、来源与实测哈希在
[source observations](../reports/planned-recovery-proposal-20261107/source-observations.json)。
以上是原始立项授权，保留历史出处。当前 R4 用户续派授权本版精确语义修订、独审及
随后 #657 正式接受事务；Owner `owner-20261107-four-pr-rulings` ②决定 ordinary planned
有界首次 admission 并保留正式 Contracts 实施权，`owner-20261107-standing-delegation`
原 §3B 委托现有合法责任链执行。来源 selector/hash 见本步接受记录与步2既有记录。
Owner 为决定及接受权威，worker 只记录受托事务；Task 不使长期行为自动生效。

`SUPERSEDE / BRIEF / CONTROLLED / AUTHORITY_AUTHORING`。这里 CONTROLLED 是
恢复授权与持久准入语义的后果分类，不表示本轮执行生产操作。依 SPEC_FORMAT_V0 §14，
AMEND 不能改变 accepted 排除或原 CTR 的通过集合。§8 指定拟改变的意义。

不能只 whole-replace Liveness 而借它的历史 WAE 条款例外新增 B3：该例外明确不形成一般许可。
故 `supersedes` 同时列出整份 WAE V3 与 Liveness V1，而非 Contract 片段。
本版不新增 `supersedes_clauses`，不退休 SRE/WEC。Liveness 已有 SRE 责任语义作为
既存效力透明携带，范围不扩大。父权威及其高优先级修订继续约束本文；旧 WAE 的 Owner
Workflows V1 引用按 accepted Owner Workflows V2 及 local README 的现行关系解释。

### 3.2 Preserved dependencies and Svc boundary

本接受候选的 WEC 组合指向步2已审接受事务中的
`AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4` @`1e064916fc0cf423a3b917cfbcc11a97d56921e9`。
该事务尚未合 main；本候选的当前权威激活依赖 #655 先合 main，届时复核精确 merge/条款。
这不是宣称 WEC4 已为 main 有效权威；R4 所读 main `bb67ce5a…` 的 WEC3 仍控制当前行为。
WEC4 CTR-WEC1-008 的 Owner-plan restart 例外完整保留，包括相同 baseline/version、
正面 correlation、same ID、失败 reconciled 与零二次 permit。七字段 due DTO、closed
policy DTO、两种 exhaustion reason 以及 resume permit 全部不改。
WEC4 CTR-WEC4-010 仅将指定 pre-plan/Owner-resume 两类远端 collection 移出 admission
lock，并要求重新获取原锁、fresh replay 和新鲜权威事实终检；它不解锁本 PPR 恢复 gate，
不扩大 ordinary planned/Owner/stale 资格，不改变任何 durable 写入或首次 admission 顺序。
SRE stale 谓词、代数/预算、quiescence 和 D-009 的 UNKNOWN/termination 三分不改。
Scheduler 只是既有恢复消费者，不把 Workflow request 当 Scheduler occurrence 重投。

Svc 仍拥有 DISPATCH_INTENT/visit/assignee/版本、唯一 transition、Assistance case、
角色检查、幂等事务及收据真相。本文没有新增 Svc reason、请求字段、历史对象接收或写权限，
`external_authorities: []` 表示本轮无新配对协议承接声明；不抹去附录 A 的既有外部依赖。
现有受支持 seam 无法提供所需可信读数时必须拒绝依赖动作，不能推定服务承诺。
若实现需要新 Svc CAS、证据查询或系统 handoff 分支，应另行 docs-first、绑定 Svc 所属
accepted ID/精确 main SHA 与 Core 配对接受；本提案或 Core 单方接受均不足。

发布前 fresh main 已合入 #643 的 RBAH V1 语义限定接受，`implementation_authority:none`、
production none 及 WEC/Svc 配套闸门仍保留。该独立同行权威继续有效；本文不 supersede、
不删改其六合同、不把新 reason 携入 planned，也不把语义接受解释为可实施。

## 4. Current State

`STATE-PPR-001`：subject=本 worktree 的文档权威与交付边界；environment=隔离 docs checkout；
as_of_commit=`2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`；observed_at=2026-11-07；
basis=OBS-PPR-001..004、EVD-PPR-001。main 新读数
`24974c720d634b965943e08bfd0862657b9be0e1` 只增加 #654 diagnostic-read 源码/证据，
两份 predecessor、WEC/SRE/D-009 与治理文件未变。发布前再次读到 main=
`9df5bd2fdea17f04bcd1762cd6800c350efcf9c3`（#643 merge）；新增的 RBAH V1 独立语义权威
按 §3.2 保留，其实施闸门未解除。候选尚未接受或安装。

## 5. Observations

- `OBS-PPR-001`：2026-11-07 在上述 authoring base 用本地文件只读核对 WAE V3
  CTR-WAE-011/013、Liveness CTR-EKRWAE-004/005、WEC CTR-WEC1-008、STOPPED-1377-B2。
  来源 revision、原文件 SHA256 见 source observations。结果：普通 planned 正向路径被排除；
  STOPPED 的 SPEC_GAP-1377-B2-001 未由 blocked 拆分关闭。
- `OBS-PPR-002`：同日通过 GitHub connector 读取
  [#650](https://github.com/mayf3/dsh-agent-core/pull/650) @
  `4928f5022a2385b571eba4d9d2967d216c78c2f8` 的 CONVERGENCE-ANALYSIS-1377.md，
  及 [#1377 拆分记录](https://github.com/mayf3/agent-control/issues/1377#issuecomment-6701777981)。
  结果：planned 排除；refused-terminal a/b closure 是独立差量，不是本次权限。
- `OBS-PPR-003`：同日 connector 核对 [#644](https://github.com/mayf3/dsh-agent-core/pull/644)
  已 merge，merge=`4f7df01bcf087075c114901a96a7a54573110f61`；source=
  `d3d4410c9184ca5d1c05607c5d47c3ca024b66c8`，delivery=
  `8f68a94668764f957043640fa1eb23740a760a29`。结果只归属既有 blocked 交付，非本轮测试。
- `OBS-PPR-004`：同日 connector 读取 [#653](https://github.com/mayf3/dsh-agent-core/pull/653)
  @`f3c833737195180a54b8eb6cd95758500fc6c010` 和
  [#655](https://github.com/mayf3/dsh-agent-core/pull/655)
  @`a61ba45f1f168d5b755a9aa37d74f21135467ec6`，均 OPEN/未合并；结果为边界和
  proposed-successor/未来原子 lifecycle 的参考，不是本案接受依据。
- `OBS-PPR-005`：同日只读提取 Owner 选中 ruling，canonical SHA256=
  `95290062529cf24c31d3c7f6c748a22e5e369d14458cf623f562eee5c90cedc8`。
  ④仅立项；③接受 #643 提案语义但保留 WEC/Svc 实施闸门。
- `OBS-PPR-006`：同日 git fetch/readback 核对 main=
  `9df5bd2fdea17f04bcd1762cd6800c350efcf9c3` 的 RBAH V1：accepted/none/production none，
  accepted_reviewed_head=`7b5d79c3961625aaade6f3b383b18b2968e82f6c`；只接受提案语义。
  对比 authoring base，两个 predecessor、WEC/SRE/D-009 和治理原字节不变。

- `OBS-PPR-007`：本 R4 准备在本地读取步2已审接受事务
  `1e064916fc0cf423a3b917cfbcc11a97d56921e9` 的 WEC4 文件与接受记录：
  accepted/contracts/production none，reviewed semantic HEAD `176161f0651847d20a012fb797389b438e11a593`。
  本候选携带该事务的精确文档字节以便顺序合并；#655 尚未合 main，激活依赖未完成。
  方法为固定 Git 对象/本地 carried 文件比较，无新 Svc/运行态访问，不能据此授权产品实施。

## 6. Claims and assumptions

- `CLM-PPR-001 (SUPPORTED)`：改变明确排除及 WAE eligible-shaped 意义须整份后继，
  不能用 issue、一次 authorityRef、测试或“新增独立入口”绕过。依据 EVD-PPR-001。
- `CLM-PPR-002 (SUPPORTED)`：可达正例为现代合格 writer 的 plan fsync 后、resolve_failed/
  delivery_started 前中断；没有这类原始 writer/WAL 证明的历史 planned-only 仍不可恢复。
  这是合同分类论证，不是本轮执行过的崩溃实验。依据 EVD-PPR-001/002。
- `CLM-PPR-003 (OPEN_ASSUMPTION for future runtime only)`：依赖最终可用且既有调度公平，
  合规实现能自动再次处理或可靠升级。本合同只承诺有条件的活性；永久不可用时不承诺业务完成。
  合格 writer 的实际生产来源、installed binding 与新 DTO 消费能力本轮 UNKNOWN。
- `CLM-PPR-004 (SUPPORTED, historical authoring mandate)`：原始 Owner ④只授予文档
  立项/审查，未执行本合同正式接受；当时③的独立提案语义接受也不授予本路径实施权。
  依据 EVD-PPR-003。当前 Owner 四 PR 裁定②与常设 §3B 的作用见 §3.1，
  不回写旧观察、不以新委托冒称旧候选已完成接受。

## 7. Evidence relations

| Evidence | Source → target / relation | Coordinates, sufficiency, limits |
|---|---|---|
| EVD-PPR-001 | OBS-PPR-001/004 → CLM-PPR-001/002、STATE-PPR-001 / SUPPORTS | authoring base 与各固定 PR head；原文足以判断路线及反例，不证明新机制可运行 |
| EVD-PPR-002 | OBS-PPR-002/003 → CLM-PPR-002 / SUPPORTS | #650、#1377 拆分、#644 固定坐标；保留 planned 缺口及 blocked 已交付范围；不复制历史 PASS |
| EVD-PPR-003 | OBS-PPR-005 → CLM-PPR-004 / SUPPORTS | source observations 的选择器/原文/canonical hash；只证明 authoring mandate，不表示新合同接受 |
| EVD-PPR-004 | OBS-PPR-006 → STATE-PPR-001、CLM-PPR-004 / SUPPORTS | fresh main 精确坐标与字段；#643 接受不解除本提案或配套实现闸门，无运行时验证 |
| EVD-PPR-005 | OBS-PPR-007 → §3.2/§8 的顺序组合 / SUPPORTS | 步2精确接受事务足以绑定候选文档依赖；不证明 main 激活、产品实现或双 writer 验收 |

## 8. Proposed decisions and exact semantic delta

下列有界语义已由 Owner 四 PR 裁定②决定，正式候选接受仍须独审与 lifecycle 事务。
`DEC-PPR-001 (PROPOSED lifecycle, owner=mayf3)`：采用两个 predecessor 的完整合并后继；
新增 ordinary planned 的有界首次 admission，整份替代而不新建 parallel recovery path。

`DEC-PPR-002 (PROPOSED lifecycle, owner=mayf3)`：零投递证明以合格原 writer 的完整 WAL 机制与
可信持久来源为主，fresh Router correlation 为只能否决的次级门。没有可证明的原始来源时
宁可拒绝；不补造证明。既有合法交接不足时保留责任，不扩大系统 Assistance。

### Effective composition and immutability

所有 Contract 全局身份都属于本新 SPEC_ID。附录 A/B 的来源 ID 保留用于逐字比对和追溯，
不回写、不重定义 predecessor 的稳定身份。两份来源携带的**全部有效**义务按下表组合：
先适用既有高优先级父权威，再应用 B 已生效的历史 scoped corrections，再应用本次六项
明确差量；其余 A/B 义务、测试与部署/历史操作限制全保留。附录的旧 title、日期、
“this document/V1/V2/本 PR”指原来源文档与其历史任务，不是本候选已接受或获实施权声明。
本候选当前 lifecycle/权限只由自身 frontmatter、§3/§12/§13 决定。

| Source coordinate @ authoring base | Effective carried meaning / proposed disposition |
|---|---|
| WAE V3 bounded delta + CTR-WAE-001/001b..010/012 | 完整携带；只承接下列明确恢复准入差量。due-feed、keyset、原身份解析、sidecar、fact-only ledger、SETTLED 非作者归因、业务唯一入口保持 |
| Liveness §8 全表、CTR-EKRWAE-001..007 | B1/B2/B4 的现行覆盖与先前 WAE/SRE scoped effects 完整携带；不重新申请、不扩大历史例外；尤其 B2 terminal 后无新 append/closure 权限 |
| Liveness §2:58、CTR-EKRWAE-004:221；WAE CTR-WAE-011/013 E5/E6 | **有界解除 ordinary planned 排除**：§2/CTR-PPR-001/003/005 的合格类成为共享 gate 的第二候选类；blocked 类要求和顺序不变，不以计划缺证重标 blocked |
| Liveness CTR-EKRWAE-001 的 B2-only 首次 admission 句、CTR-EKRWAE-005 的 blocked-only trigger；WAE CTR-WAE-003/006/009/013 及相关测试 | 只有本版 ordinary planned 合格类按新六约束扩入。进入普通 terminal reconciliation 前先试新 gate；过不了 gate 按 CTR-PPR-003 分类，禁止宽泛自动 retry；原无授权零写、UNKNOWN/delivery fences不变 |
| WAE CTR-WAE-011 历史 planned-only、Liveness ACC-EKRWAE-005 | 缺原始合格 WAL/来源的历史 planned-only **继续拒绝**；只移除把有可信新证明的 ordinary planned 也一律拒绝的解释；不能改写历史测试使其伪成正例 |
| WAE CTR-WAE-012 的 WRITE-AHEAD primary/Router secondary；WEC CTR-WEC1-008 的原 pre-plan baseline | 完整保留；新增 plan provenance 不削弱旧 delivery_started 主 fence；晚到 baseline、当前 never_existed 不能补证原 plan |
| WEC4 步2事务（依赖 #655 先合 main）、SRE V2、D-008/D-009/alignment、Owner Workflows V2 | RETAIN；只迁移 current WEC 依赖，不 whole-supersede；WEC4 仅两指定 collection 外移，PPR 恢复 gate 仍持原锁/fresh；不加 reason/permit/grant，不扩 stale/Owner restart；零受保护状态越权写 |

## 9. Contracts

### 9.1 Complete inherited obligations

附录 A 完整复制 WAE V3 的 bounded delta 与完整 predecessor body（含所有原 Contract、
验收、身份停点与历史操作顺序）；附录 B 完整复制 Liveness V1 §1–12（含全部七合同、
八验收、§8 有效更正和回滚限制）。它们是本候选携带内容，不要求读者跨文件拼出缺失规则。
§8 枚举的差量之外不存在默示删除、缩窄或新增豁免。附录 source bytes 与 base 的自动比对
及有效组合的独立语义审查都是本提案文档门。

### 9.2 Six bounded additions

### CTR-PPR-001 — Trigger, durable discovery and bounded eligibility

既有可信自动消费者 MUST 在重开持久 ledger 后、普通 planned terminal reconciliation 之前，
自动发现 §2 ordinary planned 和到期未完责任；不得依赖 Root/Owner 再发消息或内存 timer。
每次扫描/检查有有限正上界和有限正、封顶 backoff，持久 `nextCheckAt`、消费者及真实失败类；
单轮耗尽不删除责任、不饿死其他 eligible 项，不重置首次等待来源。

触发只是进行 fresh gate 检查，不是 admission 授权。合格原证明、fresh world/version、
原执行/已派工具不存在证明、fresh correlation、可信自动规则或有效人工授权必须共同成立。
当前 phase、baseline 或证明不符均不得首次投递。ordinary planned 不凭无记录成为
resolution_blocked；只有本次 fresh canonical resolution 确实失败才可产生新的 blocked 事实，
其后走原 B2 路径。Owner/stale/后继 generation、legacy ambiguous、terminal 和 delivery-domain
不在新增候选类；现行各自路径保留。恢复政策默认 OFF，接受/实现/装载与正式启用分列。

### CTR-PPR-002 — Genuine actor and original assignee boundary

自动调用者 MUST 是进程外可归属的现有 control-plane poller/reconciler，以 accepted rule
revision + exact trigger/attempt/generation + fresh gate evidence 取得内部调用权；模型自报
authorityRef、actor、Principal 或 issue URL 均不足。人工路径仍须有效显式 authorityRef。
无两者之一则恢复操作零追加、零投递；责任扫描自己的既有合法元数据权限不得冒充恢复授权。

system requester、activation assignee、目标 executing Agent、接收责任的 Owner 必须分列。
fresh exact Principal→Agent 解析及原 deliverability/TOCTOU gate 不变，执行仍是 target 自己的
Principal、Workspace、canonical main 和既有 trusted workflow_execution provenance。
不新增 grant、run-as/OBO、assignee 写角色，不以 poller 身份伪造 assignee Assistance 或业务
transition。权限/映射失效只拒绝、保责或依法 re-block，不修身份、不改 assignment。

### CTR-PPR-003 — Positive zero-delivery proof, UNKNOWN and atomic first admission

所有提交 MUST 绑定原七元组
`workflowInstanceId/nodeVisitId/dispatchIntentId/ownerPrincipalId/attemptId/requestId/generation`；
requestId=attemptId，原 generation/dispatch-time 与 preDelivery baseline 不变。
attempt generation、Router processGeneration、runtime epoch 各自校验，禁止互换。
同 FIFO/OwnerLock 中 fresh replay/CAS 并重验 exact ACTIVE phase、同 world、同 baseline/version、
有效授权与 CTR-PPR-005 原证明；锁外旧观察不得覆盖后续状态。原锁/远程最终校验边界保持；
WEC4 的两类 collection 时序按 §3.2 的顺序依赖适用，不把其例外扩为本恢复 gate 解锁，
也不假定跨服务原子性。

原 writer 必须可证明**所有**发送路径都先 durable delivery_started 后 invocation，且原 plan
的可信来源绑定该 writer/规则；完整重放中无任何 delivery-domain 记录，fresh exact Router/
session correlation 正面 never-invoked 且无 handle/message/session linkage。只有字符串
never_existed、丢失索引、null、PID 消失或超时均不够。旧 worker 和已派工具必须可证明
从未启动/不存在；若已发生执行或外部效果仍未知，即使已停止也不属本类。

全部通过才在同原锁的写边界顺序提交 recovery authorization → fresh resolution →
durable delivery_started → 原 Router 首次 deliver → 原 receipt/run_delivered；
必须保留 delivery_started 在所有 admission 路径的 WAL 顺序、单次性与幂等。
resolution 失败追加真实 resolution_blocked、零投递。两个自动/人工/原发送 writer 竞争最多
一个 admission；失 CAS 只留合法证据，不改新代。原发送 writer 的迟到恢复也必须先经同锁
fresh replay，不能绕过已持久 delivery_started。

失败分类 MUST 保持可区分：无授权零恢复写；无/terminal attempt 原 no-op；明确 world/version
漂移零 admission，按原 refusal 路径且在 terminal 前保存持久责任；暂时读不可用/证明不足保留
UNKNOWN 与有界只读 next-check，不把它伪称 world drift；已入 delivery-domain 则走既有
reconciliation，不能追加恢复授权、重发或复活 terminal。历史无资格计划保持原保守
delivery_unverified/NEEDS_REVIEW 语义及合法观察责任，不自动补 proof。

发出、持久接收、执行器读取、业务处理四类事实 MUST 分开记录/解释。delivery_started 后
任何崩溃（发送前、接收后 ACK 丢失、run_delivered 持久前）一律零二次投递，仅经原同 request
readback/reconciliation 取事实。UNKNOWN、业务/termination settlement、Router/Scheduler fence、
occurrence/nextRun 不因新 gate/停止证明/交接而改变；可信后续事实只走其既有独立权限。

### CTR-PPR-004 — Reliable handoff and reply do not create eligibility

新路径的未完责任 MUST 在同 ledger 保持 exact identity、来源、缺失事实、消费者、持久下一触发。
可靠交接必须同时有合法接收方、可读回的同意图服务事实/收据、精确合法 admission、后续消费者、
答复验证和 retrigger。入队、ACK、case ID、通知计数耗尽或标 NEEDS_REVIEW 均不转移责任。
交接失败/不支持/无回复/陈旧冲突回复时保留原自动责任和 next-check，不清 UNKNOWN。

只复用现行已获权的 Owner/Assistance 路径；新计划检查失败不自动满足旧 ATTEMPTS_EXHAUSTED/
STALE_LOOP_EXHAUSTED 前置，不增加 reason，不冒用普通 assignee 入口。服务拒绝 noncurrent/
closed/权限不足时保留真实拒绝，不能换 visit/assignee/actor/key 规避。
若现行入口不能接收此责任，保持既有合法只读/监督交接责任，不宣称 handed-off；所缺系统
接收语义须单独 Owner/Svc authoring。world-drift refusal 的 terminal 后新追加/closure 属于
独立 refused-terminal 提案，本合同不得授予；本版只保留原 terminal 前责任与合法只读消费者。

若合法服务命令可用，调用前必须持久其确切意图与稳定 key/body；超时/ACK 丢失只按同 key
读回该交接命令，不发送原业务请求，不伪造新 case 或 delivery。答复需核对权威 request/
resolution 事件、原身份、合法 resolver、顺序/新鲜性。有效答复只触发原权限重检；不能提供
缺失的原计划证明、替换 baseline、解 UNKNOWN 或生成 Owner-resume permit。

### CTR-PPR-005 — Closed internal proof DTO and backward compatibility

新资格证明只允许 trusted plan producer 在原 `attempt_planned` 的**同一 durable append**
写入可选 `plannedRecoveryProof`。现存外层事件/必填字段不删除改名；新对象全部字段必填、
不准 null，`additionalProperties:false`，无任意 payload/context/prompt/正文/evidence map。
不是新增 Router sidecar、公开 due-feed、Svc 请求或 Owner-resume DTO。

| Field | Closed schema / semantic check |
|---|---|
| schemaVersion | integer, const 1 |
| protocol | string, const WAE_PREINVOKE_WAL_V1 |
| planKind | string, const ORDINARY_INITIAL |
| sourceAuthorityId | string, const AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V1 |
| sourceAuthorityRevision | string, pattern `^[0-9a-f]{40}$`; 实际已接受规则的固定 revision，不得写候选 SHA 冒充已接受 |
| writerRevision | string, pattern `^[0-9a-f]{40}$`; 实际合格原 writer，须另有可信 source-to-loaded 与全发送路径 WAL 资格证据 |
| workflowInstanceId, nodeVisitId, dispatchIntentId, ownerPrincipalId | 各 string、canonical UUID；与原计划及权威关系完全一致 |
| attemptId, requestId | 各 string、pattern `^wfeat-[0-9a-f]{24}$`；两者等于外层原 attemptId |
| generation | integer, const 1；与外层原 generation 相等 |
| preDeliveryWorkflowStateVersion | integer, 0..9007199254740991；等于外层已在 plan 持久的原 baseline |

对象存在本身不是 PROVEN_ZERO：恢复时仍须核定 trusted producer/原 writer 资格与 fresh 全部门。
模型输入或调用者 DTO 不得注入/补写此对象。旧记录、证明缺失/损坏/未知版本、不可信 producer
或原 writer 未资格一律不获得新 eligibility；禁止事后 backfill 到历史 planned。
ledger 解析未知或损坏对象必须 fail closed，不能因忽略字段退化成正向 eligibility。

兼容矩阵 MUST 证明：新 reader 原样读取旧事件且不授新资格；新 reader 拒绝未知字段/枚举/
错误身份与 baseline；旧 reader/producer 不被激活来消费新正向分支。未证明老 binary 能安全
保留记录、UNKNOWN 与未完责任时，禁止向它启用新 producer；不能“删字段后重试”或下调协议。
停用/回滚先停新 producer/准入，再保全原 ledger 与责任，不能让旧消费者将新计划永久遗失。
既有 due DTO、Router sidecar、WEC 两 reason/Owner-resume schema 及其历史字节保持不变。

### CTR-PPR-006 — Separation from #1379, existing deliveries and activation

首次投递证明、服务/Router readback 与责任交接仅消费既有合法可用 seam。#1379 Wake 传输
改造不是本版接受/实现的前置交付，也不由本版实现；既有传输无法给 exact proof 时拒绝
依赖 admission、保责，不用 queued/ACK 替代证明。

#644 blocked 已交付类 MUST 继续走原 gate/顺序/审计/失败消费者，不重做、不降低标准。
WEC Owner-resume 与 SRE stale 另按其 accepted 全部条件运行；普通计划/交接 resolve 不能
消耗或创造它们的 permit，不修改原预算或 baseline。B1/B4 读回与 #650 refusal closure 不随带改变。
正式接受事务必须以 `implementation_authority: contracts` 承接本完整后继的源码实施权，
production none；该 accepted revision 进入实施 base 后，另一个合法 REUSE 任务才可按全部
Contracts 与必要兼容证据实施。当前 proposed 准备不授权实施；生产安装启用另循正式
mandate/发布权限。

## 10. Acceptance

以下都是未来验收定义，**产品执行结果 NOT_RUN**。每项未来证据须绑定 exact authority/
implementation/Base/Head、环境/配置/时钟、命令和 rc、原持久事件、故障位置、原七元组、
protected-state 前后、gate/actor 来源、真实调用与 admission 数、readback receipts。
内存 stub 不能替代持久 store、真实进程崩溃或跨服务事实。

### ACC-PPR-001 — Whole-authority document and lifecycle gate

- Contracts: 全部 inherited CTR-WAE-001/001b..013、CTR-EKRWAE-001..007、CTR-PPR-001..006。
- Method: 独立 exact-head 语义审查；附录与固定来源逐字比对；frontmatter/schema、两 predecessor
  对应阶段的 proposed/accepted 原子 transition、local link、范围和 reverse coverage 检查。
- Environment: 本隔离文档 worktree，authoring base 与 current main impact 分列。
- Required evidence: 原件/候选哈希、精确 HEAD/tree、命令 rc、冻结 blocker union、final delta；
  准备阶段两 predecessor 原字节不变；接受阶段绑定真实 reviewed semantic HEAD、Owner
  来源与非作者审查、双前驱退休/回链和载体迁移，原正文/历史字节保全，最终 HEAD 独立复核。
- Expected result: 完整有效义务保留、唯一 ordinary planned 差量清楚；准备时 proposed/none，
  正式接受时 accepted/contracts/production none；main 激活依赖顺序 merge，零运行结果冒报。
- Failure condition: 遗漏规则/验收、新 partial succession、无合法依据接受/退休、平行 current、
  源码或生产写、虚报运行。

### ACC-PPR-002 — Inherited conformance and blocked regression

- Contracts: 全部 inherited CTR-WAE-001/001b..013、CTR-EKRWAE-001..007；CTR-PPR-006。
- Method: 在未来合法实现中执行附录 A 全部原测试/历史受控操作前置及附录 B 八组验收，按 §8
  有效组合判断；特别复验 blocked 正负 gate、B1/B4、SRE/WEC、D-009 与正常 due-feed。
- Environment: 隔离实际 engine/ledger/Router/Broker 及必要配对服务；历史 dogfood 不由本任务重跑。
- Required evidence: 每个来源合同的实际结果、既有反例、consumer/restart 证据与 source-loaded binding。
- Expected result: 原已交付 blocked 不退化；无新 replay、身份/预算/权限/业务归因变化。
- Failure condition: 复制历史 PASS、只测新 helper、把 terminal refusal closure 偷渡为已支持。

### ACC-PPR-003 — Ordinary planned positive path and writer races

- Contracts: CTR-PPR-001/002/003/005/006。
- Method: 合格 writer 在原 plan durable 后、首次 resolution 前真实进程退出；重开真实持久 store，
  由正式 Scheduler→recoverAttempt 自动发现并完成首次 admission。两个进程、人工调用与
  原 writer 迟到继续竞争同一计划；在 proof/resolve/authorization/WAL 前后逐点故障。
- Environment: 未来隔离实际 engine、cross-process OwnerLock、Router 和权威服务 seam。
- Required evidence: 原 proof/资格/baseline、fresh gates、进程轨迹、ledger replay、真实 admission
  与 receipt 计数、四类接收/执行/业务事实；禁止用人工推进当无人值守。
- Expected result: 无 Root/Owner 消息首次 admission 至多一次、same ID/generation/baseline；
  resolve 再失败依法 blocked、有限退避/next-check 可重启发现，其他 eligible 项持续进展。
- Failure condition: 无可信来源即正向、第二 delivery_started/admission、新 identity/baseline、责任失活。

### ACC-PPR-004 — Negative proof, receipt loss and revocation matrix

- Contracts: CTR-PPR-001/002/003/005。
- Method: 分别构造 legacy planned-only、无 proof/缺 baseline、假/未资格 writer、错误 generation/
  epoch、Owner/stale 计划、错 Principal/撤权、moved visit/终态/version 漂移、旧观察 CAS 丢失、
  不可读 store/损坏台账，以及 delivery_started 后发送前崩溃、持久接收 ACK 丢失、接收后
  executor 未读和已读无业务结果；Router 假 never_existed 与 PID 消失分别注入。
- Environment: 真实隔离 store 和进程/loopback 故障，原 request readback seam。
- Required evidence: 每一负例原身份、分类、零 admission/恢复写（按 CTR-PPR-003 分类）、
  UNKNOWN/fence/history 前后、真实 readback 来源、拒绝/责任/next-check；历史加载再次撤权测试。
- Expected result: 每个不安全项零二次投递；已接收仅同 request 读回，不把四类事实混成成功。
- Failure condition: ACK 丢失重发、停止=零效果、历史补 proof、只凭无记录放行、无授权恢复追加。

### ACC-PPR-005 — Actor, closed schema, handoff and compatibility

- Contracts: CTR-PPR-001/002/004/005/006。
- Method: 新旧 producer/reader 矩阵；DTO 未知字段/版本/null/越界值/身份与 baseline 不符；
  真系统 actor 与伪造 assignee/actor/authorityRef；合法现行交接及拒绝/425/503/ACK-only/
  receipt 丢失/已有 case/错误或无回复/无 consumer；默认 OFF 和回滚重启。
- Environment: 未来隔离真实 ledger/Broker 与受支持 Svc 命令/读回/Owner consumer。
- Required evidence: schema 输入输出、原协议字节对比、调用角色/权限、稳定 key/body 与 same-key
  receipt、合法 admission/接收者/消费/答复事件/持久 retrigger、UNKNOWN/责任投影。
- Expected result: 不支持则拒绝保责、不伪装两旧 reason、无冒用/扩权；未证明合法完整交接时
  original duty 不转移；resolve 只重检，#1379 不被冒充已交付。
- Failure condition: 旧 reader 不安全却激活、字段降级、ACK 当交接、无合法 Svc 能力却声称写入、
  新 reason/terminal append/permit/生产启用随带发生。

### Reverse coverage

| Contract (all under this new SPEC_ID) | Acceptance |
|---|---|
| CTR-WAE-001、CTR-WAE-001b、CTR-WAE-002、CTR-WAE-003、CTR-WAE-004 | ACC-PPR-001/002 + 附录 A 原 suite |
| CTR-WAE-005、CTR-WAE-006、CTR-WAE-007、CTR-WAE-008、CTR-WAE-009、CTR-WAE-010 | ACC-PPR-001/002 + 附录 A 原 suite |
| CTR-WAE-011、CTR-WAE-012、CTR-WAE-013 | ACC-PPR-001/002 + 附录 A A..F/entry/history/WAL；新合格类另 ACC-PPR-003/004 |
| CTR-EKRWAE-001、CTR-EKRWAE-002、CTR-EKRWAE-003、CTR-EKRWAE-004 | ACC-PPR-001/002 + 附录 B ACC-EKRWAE-001..008 |
| CTR-EKRWAE-005、CTR-EKRWAE-006、CTR-EKRWAE-007 | ACC-PPR-001/002 + 附录 B ACC-EKRWAE-001..008 |
| CTR-PPR-001、CTR-PPR-002 | ACC-PPR-001/003/004/005 |
| CTR-PPR-003 | ACC-PPR-001/003/004 |
| CTR-PPR-004 | ACC-PPR-001/005 |
| CTR-PPR-005 | ACC-PPR-001/003/004/005 |
| CTR-PPR-006 | ACC-PPR-001/002/003/005 |

## 11. Alternatives and disposition

- `ALT-PPR-001 AMEND`：拒绝。新增资格改变 accepted 排除与 E5/E6，不满足 §14.2。
- `ALT-PPR-002 NEW 独立路径绕开 CTR-EKRWAE-004`：拒绝。同一投递责任仍受 WAE fence/
  entry 管辖；换入口不解除 accepted 排除，且会形成两套 recovery 模型。
- `ALT-PPR-003 仅 Liveness whole successor + 扩用旧 clause exception`：拒绝。旧例外非一般
  许可，WAE resolve_failed-only 仍冲突；采用完整合并后继。
- `ALT-PPR-004 由 Router never_existed / PID / ACK 缺失反推零副作用`：拒绝。可达 ACK 丢失/
  索引丢失反例导致二次业务执行。
- `ALT-PPR-005 把计划重标 blocked 或泛化 Owner-resume`：拒绝。伪造来源/permit，改变历史。
- RETAIN：现有消费者/账本/入口、blocked、Owner/stale、旧 DTO 和历史证据。未来授权后
  MIGRATE 本范围原计划消费者到共享 gate；未接受、未实现前没有可宣布 RETIRE 的运行路径。

## 12. Migration, compatibility, and rollback

**本语义准备仍 proposed。** 两 predecessor 原字节、accepted 状态和 `superseded_by:null`
保持不变；本文件 `supersedes` 尚不激活、不重定向 current pointer。Owner 四 PR 裁定②与
常设 §3B 已授权精确语义的独审及随后 docs-only 接受事务。非作者语义 PASS 后，另一个
绑定真实 reviewed HEAD、并有独立 final-head review 的 lifecycle commit 必须同时：

1. 将本候选标 accepted，统一 `implementation_authority:contracts`、production none；精确绑定
   Owner/委托、reviewed semantic SHA/document hash、final accepted SHA 和真实 main merge。
2. 将 WAE V3 与 Liveness V1 **同时**标 superseded，并各自 `superseded_by` 指向本文；
   原有更早 predecessor 历史链接、接受记录和正文保留。
3. 一致更新 Spec index/current pointers 和 inherited ASM two-kind/backlinks、既有 SRE
   scoped-effect carrier、已接受 RBAH V1 的 predecessor 引用归属；仅迁移载体，不改变其含义、
   不将整份 SRE 或 RBAH 退休，不解除 RBAH 的 WEC/Svc 接受闸门。
   若发现其他独立接受/后继与本候选冲突，停依赖接受并 RE_PREFLIGHT，不能默选新旧。

不能出现本候选 active 与两个 predecessor 仍独立 current，或 accepted predecessor 指向
仅 proposed 本文。正式 Contracts 实施权来自 Owner 已决定范围的合法接受，
不夹带源码或生产写入；后续实施仍须 accepted revision 在其 base、合法任务及全部验收门。
本分支接受记录不代表 main 生效；须 #655 先合 main，再由监管核验/合并 #657，保留真实
merge/最终 HEAD 坐标。本文不自行合并任何 PR。

本轮无事件迁移、backfill、版本重采冒充 baseline、生产配置/装载或控制变化。
未来 rollout 必须先资格 writer/reader、再 producer/消费，新分支默认 OFF；旧 legacy 记录
可读但不新增资格。停用/回滚保留 ledger 原字节、proof、WAL、UNKNOWN、责任与消费者，
不得恢复可能已投递计划或默默重新激活被 superseded 的 Product Authority。

## 13. Open questions and authoring result

| Question / owner | Current disposition |
|---|---|
| 本版初始 ordinary planned 有界解禁及双 whole successor | Owner 四 PR 裁定②+常设 §3B 已决定并授权事务；本准备待非作者独审及随后正式 lifecycle 接受，不重复请求已决定语义 |
| 是否另覆盖 stale/后继 generation 的 planned | 本版明确不覆盖；如需另起范围/权威审查，不作为本版隐含许可 |
| 实际原 writer/loaded WAL 资格与新 DTO 消费兼容 | UNKNOWN，未来实现验收门；证据缺失强制拒绝，不是规范 TBD |
| Svc 是否需要新配对面 | 本版未请求新协议。若现有 seam 不足或要求系统化/历史对象 handoff，则 Owner 与 Svc 权威维护者另行决定并绑定 accepted ID/main SHA；当前新配对坐标 UNKNOWN，不推定已完成 |
| #643 已有限接受、#653/#655 及独立 refused-terminal 后继并行变动 | #643 保留其独立语义和实施闸门；提交接受前 fresh impact/reconcile；本版不提前接受其他差量 |

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = SUPERSEDE
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO (this successor)
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_PRODUCT_ARCHITECTURE_V1
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
DOCS_FIRST_REQUIRED = YES
STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none
OPEN_OWNER_DECISIONS = NONE within Owner ruling ② and standing §3B; future scope extension separate
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE (explicit proposed delta only; no active rule changed)
PARTIAL_SUPERSESSION = NONE (existing SRE effects carried; no new clause exception)
CONTRACT_COUNT = 27 (14 WAE including 001b + 7 EKRWAE + 6 PPR)
CONTRACTS_WITH_ACCEPTANCE = 27
AUTHORING_READY_FOR_REVIEW = YES
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
NEXT_ACTION = REVIEW
DONE_WHEN = exact reviewed semantic candidate + separate atomic acceptance/retirement transaction + final review + push/readback/pause; no PR merge
EXPANSION_TRIGGER = required gate failure; authority conflict beyond declared delta; non-doc or production need
FAILURE_ACTION = STOP dependent action and append current R4/STOPPED-SUCCESSION-ORDER receipt
```

附录仅承接现行规范与其来源语境；当前提案权限由前述 13 节明确控制。

## Appendix A — Complete WAE V3 carried source

Source: WAE V3 @ `2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`.
Effective composition: §8. Historical scope/lifecycle sentences refer to that source.

<!-- BEGIN CARRIED WAE V3 -->
## Bounded contract delta

Use the unchanged WAE ledger, trusted `workflow_execution` provenance and quiescence/reconciliation for normal intake/review Workflow instances. The original assistance wake stays `inter_agent` and is not reinterpreted as source-visit execution. Per-NodeVisit WAE attempt fences remain unchanged; Svc's stable effect identity is an additional business-command dedupe boundary across RETURN, not a Core attempt reset or second ledger. Prior managed turn quiescence remains a write gate. UNKNOWN is readback-only, no replacement key. Core observes Svc durable intent/effect/STOP projections and never uses its local ledger as business authority.

This amendment does not add a Core queue, watcher, scheduler, retry loop, worker, or service-owned responsibility store. Svc's separately specified request/review responsibility producer may reconcile exact policy intents and invoke existing receipted Workflow commands; that Svc mechanism is outside Core's WAE ledger and may not mint Core attempts outside existing WAE admission. Opted-in intake/review singletons then use the existing WAE path. Owner replacement is `OWNER_CHANGED_UNSUPPORTED` in V1; no automatic Visit handoff. No second Core case/phase execution engine. Paired Spec §§4–8,11–13.

Paired authority reference: `AGENT_CORE_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V1 §§1,4–8,11–14; preserves WAE V2 whole body`.
The predecessor contracts are carried forward below with only the bounded successor changes stated above; the predecessor source remains unchanged. This successor is accepted in the same paired lifecycle transaction that records the reciprocal predecessor backlink. Acceptance is not implementation or conformance evidence.

Predecessor source: `docs/specs/AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2.md` at `45268be276276462bd71040f0cd51b28a7764fe0`; original file SHA-256 `39819798d91c0ce25982887e8be5ed02fc12e37256eed6aae06b3942d5b88b24`.

## Complete predecessor body carried forward verbatim

# AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2 — whole-authority successor (minimal semantic delta: pre-admission recovery)

## 0. What this successor is — and the one semantic it changes

This document SUPERSEDES accepted AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V1
in full. V1's architecture, reuse map, due-feed contract, keyset
continuation, admission/provenance contract, reconcile judgment, settle
probe, Assistance boundary, boundaries-kept contract, and SETTLED
semantics are carried forward VERBATIM (§2–§3 below; each carried section
is marked). The architecture is NOT reopened; nothing is redesigned.

The ONE semantic changed — closing the Owner-ruled `REAL_SEMANTIC_GAP`
(2026-09-10): under V1, a canonical-resolution failure lands terminal
NEEDS_REVIEW and the fenced attempt can never execute, even after
identity/mapping repair, because the fence rightly forbids a second
attempt. The composed real-world deadlock:

```
canonical Principal resolution unavailable
→ attempt minted (deterministic fence)
→ terminal NEEDS_REVIEW under V1
→ identity/mapping later repaired through its own authority
→ the SAME NodeVisit can nevertheless NEVER execute
   (a second attempt is forbidden by CTR-WAE-002 — correctly)
```

The fence is right; the terminality is wrong. A resolution failure that
mechanically happens BEFORE any delivery admission has zero external side
effect by construction, so recovering it can never double-deliver. V2
changes exactly that class: **provably pre-admission resolution failure
becomes a recoverable-blocked LIVE phase of the SAME attempt, continuable
only through an explicit, governance-authorized, controlled recovery**
(CTR-WAE-011/012/013) — and nothing else.

Making "pre-admission" PROVABLE is itself part of this successor: every
admission path gains exactly one durable pre-invocation delivery-start
record (write-ahead intent, CTR-WAE-012/013), so "never invoked" becomes
a ledger-provable fact rather than an inference from silence — without
it, an invocation that crashed before its Router record was minted would
be indistinguishable from no invocation at all.

New non-goals on top of ALL V1 non-goals (carried in §0.1): no automatic
retry engine of any kind (no re-resolve interval, no backoff, no queue,
no worker, no new scheduler, no watcher); no model-facing recovery tool;
no recovery triggered by poller ticks or reconcile passes; no
identity-truth change (§4); no reclassification of any post-invocation
failure class; no second attempt id, ever; no rewrite of ledger history.

### 0.1 V1 §0 carried forward (verbatim, unchanged)

A THIN infrastructure module (`packages/workflow-execution`) connects
svc-workflow's Agent-owned NodeVisit / DISPATCH_INTENT due feed to
dsh-agent-core Agent Runs:

```
Workflow transition (existing, agent-owned)
→ new NodeVisit + DISPATCH_INTENT (existing svc-workflow VISIT_ACTIVATION_V1)
→ DSH due-feed poll (existing broker capability + minimal keyset continuation,
   §CTR-WAE-001/001b)
→ atomic one-attempt-per-NodeVisit fence (ledger)
→ canonical assignee resolution (existing auth-service authority)
→ Agent Run admission (existing router.deliver, NEW trusted provenance kind)
→ NodeVisit → Attempt → Run linkage (append-only ledger)
→ target Agent re-reads the workflow with its OWN Principal and commits via
   workflow_execute.transition (existing, the ONLY write path)
→ next NodeVisit repeats.
```

This is NOT a new workflow engine, NOT a task platform, and NOT an HR
replacement for judgment work. Explicit non-goals (carried; V1's list
plus this successor's additions in §0): lease/renew, heartbeat,
generation/fencing protocols, retry engines, reassignment, worker pools,
load balancing, parallel workflows, SLA/escalation, outbox/event bus, new
databases or services, agent ACK/heartbeat tools, generic operators.

Business consistency stays ENTIRELY with svc-workflow's existing state
version / idempotency-key / transaction semantics. The design is
optimistic on reads (re-polling, re-reading, machine re-checks are always
safe) and conservative on writes (DSH never schedules a second attempt
for the same NodeVisit; unknown outcomes never produce a second
execution).

## 1. Frozen invariants (gates this successor may never move)

```
ONE_NODE_VISIT
→ at most ONE deterministic attemptId   (CTR-WAE-002 formula unchanged)
→ at most ONE Agent Run admission       (CTR-WAE-004 gate unchanged)

SECOND_ATTEMPT_ID = FORBIDDEN
SECOND_RUN        = FORBIDDEN
UNKNOWN_DELIVERY  = NEVER ZERO SIDE EFFECT
```

Recovery continues the SAME attempt through the SAME deterministic id. It
is not, and must never degenerate into, "failed attempt → create second
attempt". V1's fence machinery (beginAttemptIfAbsent, FIFO chain,
cross-process OwnerLock, fresh replay under the lock) is carried forward
unchanged and is the mechanical reason the invariant survives recovery.

Identity remains independently authoritative (Owner ruling §9): the exact
resolver authority (AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2) stands
untouched; resolution is re-executed fresh at recovery, never cached, never
substituted; no Principal→agent map may be hardcoded anywhere in engine,
config, or tests; the canonical id is expected EVIDENCE to assert against,
never an input.

## 2. Reuse map (carried verbatim from V1 §1 — unchanged)

| Concern | Frozen seam |
|---|---|
| due feed | broker capability `workflow_dispatch_intents` op `list` (limit 1..100 + keyset continuation §CTR-WAE-001b; svc-workflow GLOBAL_SCHEDULER_READ binding enforced server-side) |
| assignee mapping | `agentPrincipalResolutionAccess` (`AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2`, which supersedes V1 and retains CTR-EPAR-005): auth-service exact UUID read + local definition deliverability |
| Run admission | `router.deliver({requestId, agentId, sessionMode:'main', message}, {messageOrigin})` — AGENT ROUTER DELIVERY V0 |
| run outcome | Router reconciliation store: `getTurnReconciliation` / `resolveCallerCorrelation` (handle first, exact requestId correlation as restart fallback) |
| settle probe | broker capability `workflow_instance_detail` op `read`, executed AS THE TARGET AGENT |
| transition | `workflow_execute.transition` called by the target Agent itself (its own Principal; `WORKFLOW_TRANSITION_WRITE_PATH_FLEET_OPEN_V1`: no second write entry) |
| Assistance | existing Workflow Assistance surface, opened by the target Agent; no new state machine here |
| ledger discipline | scheduler V2 patterns: OwnerLock (`SIGKILL_LOCK_FILE_WINDOW` hardened) + append+fsync event log + replay projection |

## 3. Contracts (carried from V1; V2 successor notes mark every change)

### CTR-WAE-001 — due-feed consumption (carried verbatim — unchanged)

The engine polls `workflow_dispatch_intents.list` through the broker gateway
(token + HTTP stay in the trusted parent transport; no new HTTP client, no
new scope handling). The poller Principal must hold the server-side
GLOBAL_SCHEDULER_READ binding (deployment provisioning, out of scope here).
Malformed feed records are skipped loudly, never admitted, never silently
dropped. No assignee/due filters are requested; the svc-workflow API surface
is extended ONLY by the keyset continuation of §CTR-WAE-001b (external
`SVC_WORKFLOW_DISPATCH_INTENT_KEYSET_CONTINUATION_V1`), nothing else.

### CTR-WAE-001b — keyset continuation (carried verbatim — unchanged)

The feed is a single ordered window (`(nextEligibleAt, dispatchIntentId)`,
limit ≤ 100) with no server-side state; if more than one window of due
intents exists and every intent in the first window already has an attempt,
intents beyond the first window are INVISIBLE — a confirmed starvation that
violates work-discovery completeness. Minimal closure (scoped by the goal's
continuation exception; required by Owner ruling B2, 2026-09-09):

- The external svc-workflow contract adds optional keyset continuation
  parameters `afterNextEligibleAt` + `afterDispatchIntentId` (both-or-neither;
  exclusive row-value keyset on the feed's existing order). The dsh consumer
  sweep pages: first request without cursor; while a page is FULL
  (items == limit), request the next page with the cursor taken from the
  LAST item's EXACT returned `nextEligibleAt` string + `dispatchIntentId`
  (byte-exact round-trip, never reformatted); a short page ends the sweep.
- Exhaustion is "short page"; the API adds NO page/count/offset/totalPages
  anywhere (that is an svc-side CTR, restated here as a consumer-side
  constraint: the consumer never sends or expects such fields).
- The sweep has NO finite page cap: it pages until a SHORT page
  (exhaustion) or a per-request error (logged loud; the normal tick retries
  the next sweep). The keyset strictly advances, so any static or
  slower-growing due set terminates the sweep; a feed growing faster than
  page reads is not a real V1 scenario and is observable as a
  never-completing sweep (the single-flight tick guard prevents overlapping
  sweeps). NO persistent cursor, NO queue, NO lease — the non-goals stand.
  The admission bound still counts only NEW attempts per sweep;
  already-attempted replays are free.
- Starvation invariant (mechanically testable, REQUIRED): with > 100 due
  intents where the first 100 already have attempts, the sweep still
  discovers intents 101+ (consumer-side stub test; the svc side proves the
  keyset endpoint itself).
- Deployment order: svc-workflow with the accepted keyset continuation
  deploys BEFORE the dsh poller is enabled in that environment. No
  consumer-side feature flag.
- Consumer-visible feed safety (restated from the external CTR-DKC-004):
  an already-RETURNED due row's key never moves backward (wake is a durable
  no-op on due rows); mid-sweep entries (woken deferred intents, brand-new
  activations) land at/after the cursor EXCEPT long-transaction timestamp
  skew and exact-timestamp ties, which stay due and are caught by the next
  sweep; each sweep restarts cursorless and, with continuation, is
  exhaustive — and the one-attempt fence (CTR-WAE-002) dedupes any repeated
  observation anyway.

### CTR-WAE-002 — the one-attempt fence (carried; V2 successor note appends the recovery carve-out)

`attemptId = wfeat-<sha256(lowercase(nodeVisitId)).slice(0,24)>` —
deterministic, clock-free, stable across pollers/restarts. The ledger's
`beginAttemptIfAbsent` is the ONLY way to mint an attempt; it appends
`attempt_planned` iff the NodeVisit has NO attempt yet. ANY existing attempt —
ACTIVE, SETTLED or NEEDS_REVIEW — blocks a second one. Duplicate triggers
(re-poll, second dispatch intent for the same visit, HR double-fire,
post-restart replay) therefore cannot create a second execution on the DSH
path. Race safety: in-process FIFO chain + cross-process OwnerLock + fresh
replay under the lock before every mutation.

**V2 successor note (recovery carve-out; the fence itself is unchanged).**
"ANY existing attempt blocks a SECOND one" is restated as permanent: the
fence still guarantees at most one attempt per NodeVisit and, with
CTR-WAE-004, at most one Run admission per attempt. What changes (and only
in CTR-WAE-011) is the STATE a resolution-phase failure lands in: it no
longer terminates the attempt. Recovery never mints a second attempt id
and never bypasses `beginAttemptIfAbsent`.

### CTR-WAE-003 — canonical assignee resolution (carried; V2 successor note amends the failure destination)

`ownerPrincipalId` resolves through the agent-principal-resolution authority
(auth-service is the identity authority; the local definition registry proves
deliverability). Resolution failure ⇒ the attempt lands NEEDS_REVIEW
(`resolve_failed:<code>`) with ZERO Runs admitted. No display-name fallback,
no agent reassignment, no retry (V1).

**V2 successor note (the amendment).** The final sentence is superseded:
a resolution failure now lands the RESOLUTION_BLOCKED live phase of the
SAME attempt (CTR-WAE-011), not terminal NEEDS_REVIEW. ZERO Runs admitted
on failure stands exactly. "No display-name fallback, no agent
reassignment" stand exactly. "No retry" is restated as: no AUTOMATIC retry
of any kind, ever — the ONLY continuation is the explicit, authorized,
controlled recovery of CTR-WAE-013, which is not a retry engine.

### CTR-WAE-004 — Run admission and provenance (carried; V2 successor note declares the write-ahead sequence addition)

One admission per attempt: `router.deliver` with `requestId = attemptId`,
`sessionMode: 'main'` (canonical main session), the deterministic instruction
message, and the NEW trusted sidecar shape

```
messageOrigin = { kind: 'workflow_execution', workflowInstanceId: <uuid>,
                  nodeVisitId: <uuid>, attemptId: 'wfeat-<24hex>' }
```

exact-allowlisted, frozen, malformed-rejected in BOTH the Router
(`ingress-delivery.js`) and the session seam (`session-seam.js`); the
exact-id admission gate (AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2
CTR-EPAR-005 TOCTOU family) applies to it. Unknown origin kinds stay
rejected. The session journal stamps the message `source` verbatim — this is
the runtime-owned workflow provenance on the Run; it is NEVER model input.

AMENDMENT DECLARATION (vs accepted AGENT_CORE_AGENT_SESSION_MESSAGING_V1):
this contract extends R4's frozen source-kind enumeration from one trusted
kind (`inter_agent`) to two (`workflow_execution`). Nothing else about the
R4 sidecar changes: exact-allowlist, Object.freeze detach, fail-loud
malformed rejection, control-plane-only provenance. On R4's genericity rule
("the Router must not learn Workflow/Forum/Feishu/Scheduler semantics"):
the Router's treatment of `workflow_execution` is SHAPE VALIDATION ONLY
(UUID / `wfeat-` grammar checks) — no workflow-aware routing, admission, or
retry decision is derived from the sidecar; routing stays keyed on the exact
Agent Definition id exactly as before. The instruction text carries the
exact coordinates and the special semantics (acknowledgments are not facts;
the transition receipt is the only commitment; version-conflict allows
exactly one re-read+retry; blocked work goes to the existing Assistance
surface, never a fabricated submission).

**V2 successor note (one declared sequence addition; the admission gate is
unchanged).** The delivery SEQUENCE gains exactly one durable pre-invocation
append: the `delivery_started` write-ahead record (CTR-WAE-012/013),
appended BEFORE any `router.deliver` call on EVERY admission path. It
changes no admission semantics, adds no field to the Router call, and is
invisible to the Router; it exists because it is the mechanical fence that
makes pre-admission provable (without it, "never invoked" would be an
inference from silence and an invoked-but-crashed delivery could be
wrongfully recovered).

### CTR-WAE-005 — ledger linkage (carried; V2 successor note adds the recovery lifecycle)

Append-only `workflow-execution/attempts.jsonl` + `attempts.lock`
(OwnerLock). Event kinds: `attempt_planned`, `run_delivered`
(`{agentId, requestId, sessionId, reconciliationHandle?, messageId?}`),
`delivery_failed`
(terminal NEEDS_REVIEW), `reconciled` (terminal verdict). Replay tolerates a
torn tail; terminal attempts REFUSE further appends fail-loud (a late writer
would mean someone is trying to re-run a settled/reviewed NodeVisit). The
ledger records facts and IDs only — never workflow context, message bodies,
or business state. State machine: ACTIVE | SETTLED | NEEDS_REVIEW (whole V1;
CTR-WAE-010 defines what SETTLED does and does not mean).

**V2 successor note (lifecycle extension; nothing removed).** The event
stream gains the recovery lifecycle of CTR-WAE-012 (`delivery_started`,
`resolution_blocked`, `recovery_authorized`, `recovery_refused`). The
append-only, torn-tail-tolerant, terminal-refusing, fact/ID-only rules and
the three-state machine (ACTIVE | SETTLED | NEEDS_REVIEW; no new terminal
state) are unchanged. Historical V1-ledger events are never rewritten,
truncated, or deleted; only the projection's state mapping for the
`resolve_failed:` reason family changes (CTR-WAE-011).

### CTR-WAE-006 — reconcile judgment (carried; V2 successor note adds ONE exception row)

Per ACTIVE attempt, per pass:

| turn state (Router store) | settle probe | verdict |
|---|---|---|
| no verified Run linkage | — | NEEDS_REVIEW `delivery_unverified` |
| `pending` | (not spent) | ACTIVE `run_running` |
| `settled` | visit moved past ours | SETTLED `business_commitment_observed` |
| `settled` | visit still current | NEEDS_REVIEW `run_ended_no_submission` |
| `evicted` / `restart_lost` / `never_existed` | visit moved past ours | SETTLED (business fact beats lost linkage) |
| `evicted` / `restart_lost` / `never_existed` | visit still current | NEEDS_REVIEW `run_outcome_unknown` |
| any terminal/lost | probe unavailable | NEEDS_REVIEW `settle_check_unavailable` |

Unknown outcome NEVER becomes "not delivered, so run it again". A model
reply ("收到"/"完成了") is never consulted: the settle fact is workflow
state only. Reconcile is read-only except when landing a terminal verdict.

**V2 successor note (the single exception).** A RESOLUTION_BLOCKED attempt
has no Run linkage BY CONSTRUCTION, so the first row ("no verified Run
linkage → NEEDS_REVIEW `delivery_unverified`") MUST NOT fire on it — it
would silently recreate the V1 terminality on the next pass. Reconcile
SKIPS blocked attempts (leaves them blocked, counts them loud in engine
status). Every other row, the read-only discipline, and the no-wake rule
stand. Reconcile never performs recovery. A `delivery_started` attempt is
NOT exempt (it takes the unchanged rows, e.g. `delivery_unverified` while
pending evidence).

### CTR-WAE-007 — settle probe and the visibility invariant (carried verbatim — unchanged)

The probe reads instance detail AS THE TARGET AGENT (at admission the agent
IS the due visit's canonical assignee; node-visit rows are immutable). Wire
shapes: `full` carries `current_node_visit_id` (strict lowercase compare ⇒
settled iff different); `historical_participant` carries no visit id but
mechanically PROVES our visit is no longer current — if it were still
current, its (immutable) assignee, our agent, would hold CurrentAssigneeFull.
Unreadable states (error, missing fields, unknown visibility) are
`unavailable` ⇒ NEEDS_REVIEW, never silently settled. The probe never calls
`wake` (reconcile must not mutate eligibility).

### CTR-WAE-008 — Assistance (carried verbatim — unchanged)

Directly reused: the target Agent opens existing assistance cases with its
own Principal when blocked; no BLOCKED/report/resume machinery is added here.
svc-workflow currently exposes no machine-checkable per-instance assistance
query, so V1 reconcile cannot distinguish "open assistance" from other
no-submission ends — both land NEEDS_REVIEW (HR classifies via its existing
Assistance inbox; manager-level work stays with HR per the goal's
HR_AFTER_V1). This is the V1 boundary, ruled NOT a blocker; no fake probe, no
API expansion.

### CTR-WAE-009 — boundaries kept (carried; V2 successor note adds the no-auto-recovery carve-out)

No svc-workflow semantic change beyond the external keyset-continuation
contract; no second transition write entry; broker manifests unchanged;
Scheduler unchanged and not a dispatcher; HR is not the normal
transport/retry daemon anymore (manager work only); no Redis/Postgres/
new service; outcome-unknown and side-effect-unknown never auto-rerun; no
automatic agent switching.

**V2 successor note.** The V2 carve-out is explicit: pre-admission-blocked
attempts never AUTO-recover — recovery is only ever the explicit
CTR-WAE-013 operation carrying an authorityRef. No other boundary moves.
The seven-field svc due-feed projection is untouched; no lineage-resolved
Principal is added to the feed; resolver choice stays a dsh-consumer
decision. The earlier svc dispatch identity-bridge proposal remains
REJECTED (violated the svc architecture's seven-field projection, exact-
resolution V2, and the accepted reconciliation lineage's "not a Principal
resolver" clause); reopening it would require NEW_EVIDENCE — none exists.
AGENT_CORE_AGENT_SESSION_MESSAGING_V1 receives no further amendment (the
R4 extension inherited via CTR-WAE-004 is the last word). Assignment data
on existing instances is NEVER changed to bypass resolution.

### CTR-WAE-010 — SETTLED semantics (carried verbatim — unchanged)

`SETTLED` means exactly: THIS attempt no longer needs to process the
NodeVisit, because authoritative workflow state has moved past the visit
(different `current_node_visit_id`, or the visibility invariant). It is a
fact about the ATTEMPT's closure, not about the transition's authorship.

`SETTLED != COMPLETED_BY_THIS_ATTEMPT`. Without exact transition-receipt
evidence (command id / receipt linkage tying the committed transition to
this attempt's Run), NOTHING may claim that this attempt's Run performed the
transition — not ledger fields, not logs, not reports. V1 collects no such
receipt linkage (`workflow_execute` receipts are the target Agent's tool
results; the engine never sees them as machine input), so V1 NEVER asserts
completion attribution. The actor is unknown-by-V1 and may be this Run,
another actor, or an admin action.

Minimal provenance (already carried by the ledger, frozen as-is): the
`reconciled` event records `judgment` + `reason`, where
`business_commitment_observed` reads as "a business commitment was observed
in authoritative state (actor unspecified)" and `reason` ∈
{`node_visit_no_longer_current`, `assignee_no_longer_current: …`}. No new
ledger field, no new state, no rename of the judgment vocabulary is
required by this Spec.

### CTR-WAE-011 — pre-admission recoverable boundary (NEW; amends the destinations fixed by CTR-WAE-002/003)

**Definition (resolution-phase failure).** A resolution failure is an
emission of the CTR-WAE-003 resolution phase. By engine construction that
phase strictly precedes any `router.deliver` invocation (CTR-WAE-004), so
at the moment of failure no delivery admission side effect exists. Ledger
shape: the attempt has phase `planned`, carries a
`resolve_failed:<code>` classification, has NO `run_delivered` event, and
has NO durable pre-invocation delivery-start record (CTR-WAE-012/013) —
that record is what makes "never invoked" mechanically provable at all;
without it, "no delivery evidence in the ledger" would be unprovable
silence, not PROVEN_ZERO.

**Reclassification (the amendment).** Such an attempt lands in phase
`RESOLUTION_BLOCKED` of state ACTIVE — a live, continuable phase — NOT in
terminal NEEDS_REVIEW. V1's terminal reading of `resolve_failed` is hereby
superseded. Every post-invocation failure class keeps V1 semantics
exactly: `delivery_rejected:<code>` and all delivery/outcome-unknown paths
remain terminal NEEDS_REVIEW, fail-closed, non-recoverable.

**Historical ledgers (projection-only).** V1-era ledger events
`delivery_failed{reason:"resolve_failed:<code>"}` already on disk are
NOT rewritten, truncated, or deleted (bytes unchanged). The replay
projection changes only their STATE MAPPING: reason prefix
`resolve_failed:` projects to ACTIVE/RESOLUTION_BLOCKED; every other
`delivery_failed` reason (`delivery_rejected:*` and any other) keeps
projecting terminal NEEDS_REVIEW. The discrimination is mechanical
(reason-prefix, deterministic at replay, no human input). Recovery
eligibility of a HISTORICAL attempt rests on exactly this event evidence:
the `resolve_failed` emission proves the engine was still in the
resolution phase when the attempt's single V1 pass ended, so deliver was
never reached. A historical attempt with NO `resolve_failed` event
(planned-only) is NOT eligible — its zero-invocation status is unprovable
retroactively without the V2 write-ahead record — and keeps the V1
terminal paths (reconcile `delivery_unverified` → NEEDS_REVIEW).
Conservative false refusals are the correct failure direction; the
reverse is forbidden.

**Code classification.** ALL `resolve_failed:<code>` emissions belong to
the blocked class, where `<code>` ranges over the resolution-phase failure
vocabulary exactly as fixed by the identity authorities: the Auth-target
codes of AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2 CTR-EPAR-004
(`principal_not_found`, `principal_not_agent`, `principal_disabled`,
`agent_mapping_missing`, `identity_resolution_ambiguous`, and
`identity_resolution_unavailable` for every 500/504/timeout/malformed
read), the preserved Broker responsibilities named in that same clause
(`credential_missing`, `credential_invalid`, `access_denied`,
`transport_failure`), and the local-definition layer codes
(`target_not_found`, `target_disabled`). Implementation-level naming
aliases (e.g. the broker capability manifest renders the
credential-absence responsibility as `credential_unavailable`) do NOT
change the classification; classification keys on the resolution PHASE
(pre-admission by construction), never on the code string, and no code is
special-cased in either direction. The core condition at RECOVERY time is
not the code but the fresh judgment:

```
EXTERNAL_DELIVERY_SIDE_EFFECT = PROVEN_ZERO
```

which is established per CTR-WAE-013's entry dispatch at every recovery
invocation. A blocked attempt is therefore ELIGIBLE — never automatically
recoverable.

### CTR-WAE-012 — ledger recovery lifecycle (NEW; extends CTR-WAE-005)

The event stream stays append-only, torn-tail-tolerant, terminal-refusing,
and fact/ID-only (no workflow context, no message bodies). NO truncation,
NO reset, NO deletion, NO historical rewrite — of any event, ever.

Indicative event additions (exact names/fields are an implementation-
investigation decision; the CONTRACT semantics below are frozen):

- `delivery_started { attemptId, at }` — the durable WRITE-AHEAD INTENT
  record, appended BEFORE any `router.deliver` invocation on EVERY
  admission path — the original path included, not only recovery. At most
  ONE per attempt; a second is a corrupt-ledger fail-loud. Its presence
  unconditionally classifies the attempt
  DELIVERY_STARTED_OR_OUTCOME_UNKNOWN: never recovery-eligible, whatever
  any other store answers; reconcile treats it under the UNCHANGED V1
  rows (`delivery_unverified` family). Its absence on a blocked attempt
  is the mechanical proof of never-invoked.
- `resolution_blocked { attemptId, code, at }` — appended when the
  resolution phase fails; attempt phase = RESOLUTION_BLOCKED (ACTIVE).
  Repeated resolution failures (e.g. each authorized recovery that fails
  resolution again) append fresh events; a second `attempt_planned` for
  the same NodeVisit remains impossible (CTR-WAE-002 unchanged).
- `recovery_authorized { attemptId, authorityRef, at }` — appended ONLY
  by the controlled recovery operation of CTR-WAE-013, ALWAYS AFTER its
  fresh preconditions pass and ALWAYS BEFORE any resolution/delivery
  re-execution (never on the refusal or no-op paths); `authorityRef` is
  the exact governance reference (goal directive / Owner ruling)
  authorizing THIS recovery. Multiple authorization events may exist over
  an attempt's lifetime; none of them can create a second Run — the
  CTR-WAE-002/004 gates are untouched and remain the only admission path.
- `recovery_refused { attemptId, authorityRef, refused: <which>, at }` —
  appended ONLY on the world-drift refusal path of the CTR-WAE-013 entry
  dispatch (an eligible-shaped attempt whose instance/visit/assignee
  reality drifted); it carries the same `authorityRef` for audit; the
  attempt then lands terminal NEEDS_REVIEW (`recovery_refused:<which>`).
  Terminal attempts NEVER receive this event (entry dispatch E3 no-ops —
  the V1 terminal append-refusal is preserved, which is exactly why
  refused-once attempts cannot be re-refused or re-run).

After a successful recovery the attempt proceeds through the UNCHANGED
events — `run_delivered` (same attemptId, requestId = attemptId) →
`reconciled` — and its terminal states are exactly V1's
(SETTLED | NEEDS_REVIEW). No new terminal state exists; NEEDS_REVIEW
remains the only human-escalation terminal.

**Mechanical discriminability (frozen contract).** The projection must
always distinguish, mechanically, (a) PRE_ADMISSION_BLOCKED from (b)
DELIVERY_STARTED_OR_OUTCOME_UNKNOWN. The PRIMARY fence is the durable
pre-invocation `delivery_started` record: because it is appended BEFORE
`router.deliver` is invoked on EVERY admission path, its ABSENCE is
mechanical proof that no invocation was even attempted (any invocation
attempt must first append it — there is no invocation-to-record crash
window left), and its PRESENCE unconditionally places the attempt in
class (b). The fresh Router correlation query (requestId = attemptId;
only "no record ever existed" passes) remains a REQUIRED SECONDARY gate
whose ONLY legal effect is to refuse recovery: it is one-directional and
can never override the ledger — a never-existed store answer with a
`delivery_started` record present (e.g. after a correlation-index
restart/loss) still refuses. Ledger class (a) determines ELIGIBILITY;
PROVEN_ZERO is proven fresh at every recovery invocation and is never a
persistent property of an attempt.

### CTR-WAE-013 — the controlled recovery operation (NEW; the anti-retry-engine contract)

**Surface.** Exactly ONE narrow internal/control-plane operation of the
workflow-execution engine (the existing control-plane/CLI seam class). It
MUST NOT be: a model-facing broker tool or capability; reachable from any
Agent tool surface; invoked by the poller tick; invoked by reconcile; or
invoked by any timer/watcher/queue. There is no scheduling semantics of
any kind between explicit authorized invocations: a blocked attempt simply
waits, loudly visible in engine status/reports (visibility is not
triggering).

**Authorization (call gate).** Every invocation MUST carry an explicit
`authorityRef` (a named Owner ruling / goal directive). No authorityRef ⇒
refuse the call with zero side effects and NOTHING appended (dispatch E1).

**Entry-state dispatch (frozen; evaluated under the SAME per-attempt FIFO
chain + cross-process OwnerLock + fresh replay-under-lock as every V1
mutation — CTR-WAE-002 race machinery, unchanged; evaluated in order,
first match wins):**

| # | entry state | outcome | ledger effect |
|---|---|---|---|
| E1 | no/empty authorityRef | refuse the call | none |
| E2 | no attempt exists for the nodeVisitId | `NO_OP_NO_ATTEMPT` | none |
| E3 | attempt is TERMINAL (SETTLED, or NEEDS_REVIEW of any cause incl. prior `recovery_refused`) | `NO_OP_TERMINAL` | none — the V1 terminal append-refusal is preserved; a replayed recovery command can never un-terminal or re-append |
| E4 | attempt non-terminal but delivery-domain evidence exists: any `delivery_started` / `run_delivered` / `delivery_rejected` / reconciled outcome-unknown handle in the ledger, OR the fresh Router correlation query answers anything other than "no record ever existed" (pending/settled/evicted/restart_lost), OR the store is unreachable, OR any reconciliation handle, messageId, or session linkage attributable to this attempt (by requestId, attemptId, or nodeVisitId) exists in the Router or session seams | `RECOVERY_INAPPLICABLE:<evidence-class>` | none from the recovery operation — recovery simply does not apply; the attempt remains owned by the UNCHANGED V1 machinery (reconcile lands the V1 verdict: `delivery_unverified`, `run_running`, `run_outcome_unknown`, `settle_check_unavailable`, …). Appending a refusal here would mislabel a delivery-domain attempt as a failed recovery |
| E5 | attempt is eligible-shaped (phase planned/RESOLUTION_BLOCKED with `resolve_failed` evidence per CTR-WAE-011, no delivery-domain evidence, store never-existed) BUT the world has drifted: instance gone, NodeVisit no longer current (`nodeVisitId` exact-compare), `assigneePrincipalId` changed, or a business transition past the visit is observed | `RECOVERY_REFUSED:<which>` | append `recovery_refused {authorityRef, which}` ⇒ attempt lands terminal NEEDS_REVIEW — it can never validly execute, so the human path is correct |
| E6 | eligible-shaped and world intact | PROCEED | append `recovery_authorized {authorityRef}` (durable) → re-run resolution exactly per CTR-WAE-003 (fresh reads; no cache): failure ⇒ append fresh `resolution_blocked` with the new code, attempt stays blocked, ZERO side effects; success ⇒ append `delivery_started` (durable, BEFORE any deliver call) ⇒ invoke delivery exactly per CTR-WAE-004 — ONE Run, same attemptId, `requestId = attemptId`, unchanged sidecar ⇒ `run_delivered` and unchanged V1 events on success, `delivery_failed{reason:"delivery_rejected:<code>"}` (terminal, V1 semantics) on synchronous rejection |

Every Owner §8 precondition is enforced inside this dispatch (E4 carries
the zero-delivery-evidence family; E5 carries the instance/visit/assignee/
transition family). There is NO path on which a precondition failure still
leads to delivery: E4/E5/E1 all end without admission. Caller outcomes are
exactly: `RECOVERED_RUN_ADMITTED` (E6 delivered) | `STILL_BLOCKED:<code>`
(E6 re-blocked) | `RECOVERY_REFUSED:<which>` (E5) |
`RECOVERY_INAPPLICABLE:<evidence-class>` (E4) | `NO_OP_*` (E2/E3) |
call-refused (E1).

**Concurrency and crash boundaries (frozen):**

- Concurrent second caller: serialized by the OwnerLock/FIFO machinery;
  observes the dispatch outcome of the post-first-caller state (no-op,
  inapplicable, or a fresh block) and can never double-admit (the
  CTR-WAE-004 gate is the only admission path).
- Crash BEFORE the durable `delivery_started` append (including
  before/inside re-resolution): the ledger mechanically proves
  never-invoked, and the fresh Router-store query confirms ⇒ still
  eligible; a later authorized invocation proceeds (Owner acceptance case
  D).
- Crash AFTER `delivery_started` is durable, at ANY point before
  `run_delivered` is durable (including during the `router.deliver` call
  and before receipt durability): class DELIVERY_STARTED_OR_OUTCOME_UNKNOWN
  ⇒ the ledger record alone puts every later invocation on E4 ⇒ never
  recoverable, EVEN IF the Router store later answers "no record ever
  existed" (its answer is never primary) ⇒ reconcile lands NEEDS_REVIEW
  (V1 CTR-WAE-006 stands; Owner acceptance case E).
- NodeVisit moved / assignee changed / any world drift before recovery ⇒
  E5 REFUSED ⇒ NEEDS_REVIEW (Owner acceptance case F).

## 4. Identity boundary (record-only; NO identity semantics in this successor)

The dogfood deadlock has an identity half that this successor deliberately
does NOT solve (Owner ruling §9/§10). Recorded facts:

- The historical assignment Principal
  `61819256-07e1-4bd0-adea-e93e51243fa1` maps, in Auth, to a legacy-
  grammar (non-canonical) agent_id; it therefore fails the exact
  resolver's canonical-agent gate
  (AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2 CTR-EPAR-003 — stored
  value is returned verbatim and never rewritten; grammar/canonicality
  fail-closed), classified `agent_mapping_missing`.
- The canonical id `agt_writing-style-analyst-agent` is held by the
  formal successor Principal (recorded in goal evidence, prefix
  `9e3adced…`), which is an enabled member of the subject domain; the
  Workflow lineage for the historical Principal already exists and is not
  in dispute here.
- Auth enforces `machine_principals.agent_id @unique` (prisma schema,
  recorded frozen in AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1): two
  Principals cannot hold one canonical id simultaneously.

**Determination (Owner ruling §10 branch taken):** repairing that mapping
CONFLICTS with accepted authority — the `@unique` constraint makes the
direct repair collide with the successor Principal's holding, and no
accepted authority defines an authorized agent_id rebind operation
(AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 governs the credential/secret
lifecycle and freezes auth-service as the sole binding authority without a
rebind path; the resolution V2 spec governs read-side exactness only and
forbids rewriting stored values at resolution time). Therefore: STOP on
identity; a SEPARATE `IDENTITY_AUTHORITY_SUCCESSOR_REQUIRED` must carry
the exact conflicting clauses. It is out of scope here and MUST NOT be
folded into this successor or its implementation.

**Consequence for recovery (fail-closed by design).** Until identity is
repaired through its own valid authority, an authorized recovery of a
blocked dogfood attempt re-runs resolution, fails with the same
`agent_mapping_missing`-class code, appends a fresh `resolution_blocked`,
and admits ZERO Runs — idempotent, loud, correct. Recovery authorization
and identity repair are independent acts under independent authorities;
neither approximates nor substitutes for the other.

## 5. Required dogfood (acceptance-gated; NO replacement instances)

Subjects (frozen by Owner ruling §11; full UUIDs from recorded artifacts,
not guessed):

```
Subject A = cebf4816-c664-40cb-9b61-3fa330ad1c39
Subject B = 5709a28e-3938-4b0e-b878-59711f5341e8
common assignee Principal = 61819256-07e1-4bd0-adea-e93e51243fa1
```

Per subject, the required terminal proof:

```
formal exact resolver → SAME canonical Agent
  (agt_writing-style-analyst-agent asserted as EXPECTED EVIDENCE only)
→ one explicitly authorized controlled recovery (authorityRef on record)
→ exactly ONE Agent Run (one attemptId, one run_delivered)
→ target-own-context verification (the Run executes as the canonical
  Agent's own Principal context)
```

Lifecycle order is the Owner §13 sequence, uniformly (see §7): controlled
deployment (step 12) → identity repair through its own authority (step
13) → per-subject recovery (step 14) → target-own-context verification
(step 15). In the window between deployment and identity repair, an
authorized recovery re-blocks fail-closed with zero Runs (§4) — that is
the designed behavior, not a defect. No replacement workflow instance, no
assignee change, no direct DB write, no display-name fallback, no
hardcoded mapping — the Owner's §14 refusal list is adopted verbatim as
successor boundaries.

## 6. Tests (acceptance-critical; a happy-path-only suite is a REVISE)

V1 §4's suite is carried (port keeps it green): ledger
fence/dedupe/concurrency/restart/torn-tail/terminal-refusal; judgment
tables (incl. run completed + "完成了" + visit still current ⇒
NEEDS_REVIEW, never rerun); instruction determinism/semantics; engine
chain; Router workflow-execution-origin tests; demo-server session-seam
tests; the B2 starvation and continuation suites. Added by this
successor, each mechanically asserted in
`packages/workflow-execution/test/`:

- A: resolution fails → ZERO Run → (simulated) identity repair → explicit
  authorized recovery → exactly ONE Run, same attemptId, unchanged events
  thereafter.
- B: recovery command replay after completed recovery → `NO_OP_TERMINAL`,
  no ledger append, no duplicate Run, no second admission.
- C: two concurrent recovery invocations → exactly one recovery owner
  (OwnerLock/FIFO serialization proven), at most one Run.
- D: crash before the durable `delivery_started` append (including
  before/inside re-resolution) → ledger mechanically proves never-invoked,
  Router-store never-existed passes as the secondary gate → still
  eligible → later authorized recovery succeeds.
- E: crash after the `delivery_started` append, before `run_delivered`
  durability (any point, including during the deliver call) → every later
  invocation lands E4 → NOT recoverable → reconcile lands NEEDS_REVIEW.
- STORE-FALSE-NEGATIVE (r1 blocker-2 regression): a `delivery_started`
  record present AND the fresh Router correlation query answers "never
  existed" (restarted/lost correlation index) → dispatch E4 STILL applies
  → no recovery, no append; a second Run is impossible.
- ENTRY-DISPATCH TABLE: E1 no-authorityRef refuses with zero appends; E2
  no-attempt no-ops; E3 terminal no-ops with zero appends (asserting the
  V1 terminal append-refusal survives); E4 delivery-domain evidence (each
  class — ledger events, non-never-existed/unreachable Router store
  answers, AND attributable handle/messageId/session linkage in
  Router/session seams) yields `RECOVERY_INAPPLICABLE` with zero appends
  and the unchanged reconcile verdict; E5 world drift yields
  `recovery_refused` append + terminal NEEDS_REVIEW with the exact
  `<which>`.
- Blocked-attempt reconcile exemption: RESOLUTION_BLOCKED never takes the
  `delivery_unverified` NEEDS_REVIEW verdict; `delivery_started` attempts
  still do.
- Historical projection: a V1-era
  `delivery_failed{reason:"resolve_failed:…"}` projects to
  ACTIVE/RESOLUTION_BLOCKED with ledger bytes unchanged;
  `delivery_rejected:*` keeps projecting terminal NEEDS_REVIEW; a
  historical planned-only attempt (no `resolve_failed`) is NOT
  recovery-eligible (E4/E5 cannot be reached; V1 terminal paths only).
- Lifecycle integrity: at most one `delivery_started` per attempt (second
  = corrupt fail-loud); `recovery_authorized` never precedes its passing
  preconditions and never appears on E1–E5 paths; `resolution_blocked`
  re-appends never re-mint `attempt_planned`.
- Authorization discipline: no-authorityRef invocation refused with zero
  side effects; `recovery_authorized` records the exact reference.
- Surface discipline (negative existence assertion): no model-facing
  tool/manifest exposes recovery; poller tick and reconcile passes never
  invoke it.
- Identity-unrepaired behavior: authorized recovery re-blocks with the
  fresh code and admits ZERO Runs (fail-closed proof).

Affected regression at port time: broker / scheduler / agent-router /
demo-server / production-runtime suites under the pinned node with proxy
env stripped; pre-existing baseline failures documented, not caused.

## 7. Production wiring (carried from V1 §3; recovery-operation mounting and the unified deployment order added)

`production-runtime/src/workflow-execution-runtime.js` mounts the engine
with real seams; `compose.js` mounts it after the broker gateway +
agent-principal-resolution rows and starts/stops it with the runtime.
Enabled only when `WORKFLOW_EXECUTION_POLLER_AGENT_ID` (or compose
`workflowExecution.pollerAgentId`) is configured; otherwise the mount is
honest-disabled (ledger evidence-only, `start()` logs the disabled line,
never fakes liveness). Deployment prerequisites (out of scope here): the
poller agent's credential in the canonical store + GLOBAL_SCHEDULER_READ
binding + `auth.agent.resolve` grant + the external keyset-continuation
svc-workflow deployed first (§CTR-WAE-001b).

The recovery operation mounts with the engine (no additional enable flag):
it is individually inert without an explicit authorityRef per invocation,
which is the authorization mechanism. PRODUCTION_APPLY_ALLOWED = NO for
the authoring goal.

**Deployment order of record (Owner §13 sequence, identical in §5 and
§8):** svc keyset-continuation build first (already-deployed prerequisite)
→ (12) controlled deployment of this successor's implementation → (13)
identity repair through its own valid authority (separate successor;
`IDENTITY_AUTHORITY_SUCCESSOR_REQUIRED`) → (14) per-subject recovery of
Subjects A/B (§5) → (15) target-own-context verification. In the window
between (12) and (13), authorized recovery re-blocks fail-closed with
zero Runs — designed behavior (§4).

## 8. Governance sequencing (frozen; from the Owner ruling §13)

1. PR #224 stays frozen at `b3483d9592b19a17a121db71889681675fc1ac0b`.
2. THIS document is the step-2 product (docs-only successor authority
   candidate).
3. Independent semantic review of this exact head (reviewer did not
   author the delta).
4. Exact successor head returned to the Owner.
5. Owner exact-head acceptance (THE gate; this document's `proposed`
   status carries no authority until then).
6. Merge successor authority. At merge, the acceptance transaction adds
   BOTH reciprocal backlinks: (a) the accepted V1 file gains a
   superseded-by backlink pointing at this Spec, and (b) the accepted
   AGENT_CORE_AGENT_SESSION_MESSAGING_V1 R4 gains its reciprocal
   amended-by backlink identifying THIS Spec as the current carrier of
   the two-source-kind enumeration — carrying out V1 §5's outstanding
   ASM backlink obligation, which this succession inherits and must not
   drop (a one-way authority edge is not a closed succession). This
   candidate does not modify either accepted file itself — the backlinks
   are the acceptance-time transaction; the inherited ASM R4 amendment
   relationship continues to hold unchanged via CTR-WAE-004.
7. Rebase/port the frozen PR #224 implementation onto the accepted base.
8. Implement ONLY the accepted recovery delta (CTR-WAE-011/012/013).
9. Focused + regression + §6 crash/concurrency/dispatch matrix.
10. Independent implementation review.
11. Merge.
12. Controlled deployment.
13. Identity repair through its own valid authority (separate successor —
    `IDENTITY_AUTHORITY_SUCCESSOR_REQUIRED`; MUST NOT ride this Spec).
14. Recover existing Subjects A/B (§5).
15. Target-own-context verification.

Steps 4/5 may never be skipped. Nothing in this document authorizes
implementation, deployment, identity mutation, or production writes.
<!-- END CARRIED WAE V3 -->

## Appendix B — Complete Liveness V1 carried source

Source: Liveness V1 @ `2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`.
Effective composition: §8. No new scoped supersession exception is requested.

<!-- BEGIN CARRIED LIVENESS V1 -->
## 1. Goal

落实 Owner [#1374 §3 B1/B2/B4](https://github.com/mayf3/agent-control/issues/1374)
的持续责任：临时读失败自动再读，安全的投递前解析阻塞自动获得合法继续，缺失基线或仅版本变化
不能使未完成业务永久退出处理集合。上述 issue 的正文 §3 是原文定位；本文不以 issue 取代
仓库接受程序。三条路径均不重放业务操作，不从 UNKNOWN 推断成功、失败或零副作用。

## 2. Scope and non-goals

本候选只接续 §8 精确列出的 WAE V3 / SRE V2 条款及其直接依赖表述。其余 accepted
权威继续有效，包括 Svc 业务所有权、唯一 transition 写入口、精确 Principal 解析、WAL、
既有锁、attempt/generation、单 attempt 单次 admission、UNKNOWN 与执行停止证明边界。

只使用现有 Scheduler / Workflow reconciler、既有 append-only WAE ledger 和正式恢复入口。
不创建平行 Scheduler、全局锁服务、新 execution ledger、业务重试引擎、身份修复接口或
Agent/model-facing 恢复工具。不扩展 B3 planned 恢复、Owner-resume、stale redispatch、
Scheduler occurrence retry、生产部署或业务副作用权限。本任务只写 docs/，不实现、不合并。

## 3. Authority, scope exception and activation

Owner mayf3 在 [#1374](https://github.com/mayf3/agent-control/issues/1374) 下达期望行为；
本次合同交办明确要求新稳定 ID、对应条款 SUPERSEDE、接受记录占位、push/PR、不 merge。
这是可追溯的文档起草与交付授权，尚不是已合入 main 的 Product Contract。

通常 `.agents/local/README.md` 与 `SPEC_FORMAT_V0` 要求 whole-authority successor，禁止
partial supersession。本次按用户明确交办，复用已接受的
[#610](https://github.com/mayf3/dsh-agent-core/pull/610) /
[#611](https://github.com/mayf3/dsh-agent-core/pull/611) **特定条款范围例外**，完整公开
实际替换关系及依赖，不伪称 whole-WAE / whole-SRE supersession，不形成一般许可。
`supersedes: []` 表示没有整份 Spec lifecycle 替代；`supersedes_clauses` 与 §8 共同指定真实范围。
原 accepted 文档字节及历史接受记录不改，不把整份父权威标成 superseded。

三态与零写的直接已接受约束是
[`AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1`](AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1.md)
CTR-527D2-001..004（#610/#611）；#616 是另一项 docs-first 接受载体的先例，
**不是 D009_ALIGNMENT 的接受来源**。本文不替代 D-009 或上述 alignment。

监管验收后，仅 Owner 或 PR 中明确获授权的 maintainer 可记录接受：绑定独立评审的语义头、
文件哈希、最终接受头与实际 merge；同时明确接受本条款范围例外、§8 继任关系及其可追溯索引。
起草候选不修改旧权威 backlink；接受事务须持久登记精确条款关系，不能使整份 WAE/SRE 退役。
Owner 裁定依据溯及 #1374 下达；此溯源不使未合并候选提前生效。接受并合入 main 后才可将
`implementation_authority` 激活为 `contracts`，实现另以包含该接受的 base 走 REUSE。

### 接受记录占位（不表示已接受）

```text
OWNER_RULING = mayf3 / agent-control#1374 / 2026-11-04 task issuance
ACCEPTANCE_STATE = PENDING_SUPERVISORY_REVIEW_AND_AUTHORIZED_ACCEPTANCE
ACCEPTED_BY = UNKNOWN (pending acceptance recording)
REVIEWED_SEMANTIC_HEAD = UNKNOWN (bind after independent review)
REVIEWED_DOCUMENT_SHA256 = UNKNOWN (bind exact reviewed bytes)
FINAL_ACCEPTED_HEAD = UNKNOWN (bind in acceptance transaction)
MERGE_PR_AND_COMMIT = UNKNOWN (this task must not merge)
CLAUSE_SUCCESSION_RECORD = section 8; acceptance-time binding pending
IMPLEMENTATION_AUTHORITY_NOW = none
PRODUCTION_APPLY_AUTHORITY = none
```

## 4. Current State

固定 authoring base / 当前 main 核对快照为 `9f04db29cce44a684b4409fa63b436aaf10dfa52`。
WAE V3、SRE V2、WEC V3 与 D009_ALIGNMENT 已在该 base；本文尚未被接受。
预检记录揭示目标与旧 accepted 语义之间的差距，不能用 REUSE 越过该差距；源码、部署、
真实 Scheduler 消费者、故障恢复及业务效果的本轮验证均未执行。

## 5. Observations

- `OBS-EKRWAE-001`：2026-11-05，在上述 base 只读核对 WAE V3、SRE V2、WEC V3、
  D-009 和 D009_ALIGNMENT 原文；旧/新语义坐标见 §8。
- `OBS-EKRWAE-002`：同日执行 `gh issue view 1374 --repo mayf3/agent-control`，作者
  mayf3，正文更新时间 `2026-11-04T15:49:34Z`；§3 B1/B2/B4 原文逐条引于 §8。
- `OBS-EKRWAE-003`：只读核对 `DEFECT-MATRIX.md` §2、G2/G3/G5 及 R3 §9.1/9.2：
  它记录分支/内存桩证据与持久进程 E2E 边界，不是新 Product Authority，也不是本轮重跑结果。
- `OBS-EKRWAE-004`：通过 `gh pr view` 核对 #610/#611 已 merge；#611 接受绑定
  semantic `159938d7c84c9d429ee197cc784a8e132948f337`、delivery
  `79bc8e2e02df8b06cbef95212eb2d72687b31c47`，#611 merge
  `29d1cd86fd823a8d51bde9d0b3a58ccc56965912`。#616 的载体属于 #442，不混用其来源。

## 6. Claims and assumptions

`CLM-EKRWAE-001 (SUPPORTED)`：B1/B2 直接改变既有 failure/自动调用语义；B4 改变永久
失去观察责任的解释，保留保守 redispatch 谓词。故选 SUPERSEDE / docs-first。

`CLM-EKRWAE-002 (SUPPORTED)`：恢复责任与业务 outcome 是不同量。保留 UNKNOWN 时仍可
持久登记只读检查责任；这不授予 UNKNOWN settlement、清 fence 或业务操作重放权限。

`CLM-EKRWAE-003 (OPEN_ASSUMPTION for future runtime only)`：依赖最终恢复、现有监督最终
可用且调度公平时，合规实现应自动产生下一次检查或合法恢复/可靠升级。本文定义该条件性活性，
不宣称已实现、不承诺未经验证的 SLA；不得把所有技术故障直接标为人工问题来满足它。

## 7. Evidence relations

| Evidence | Source → target / relation | Sufficiency and limitations |
|---|---|---|
| EVD-EKRWAE-001 | OBS-001/003 → CLM-001 / SUPPORTS | base 原文与预检精确坐标足以说明需权威接续；不证明源码缺陷本轮重现或修复 |
| EVD-EKRWAE-002 | OBS-002 → §8 原文及 CTR-002/004/005/006 / SUPPORTS | Owner 期望与文档写入授权可追溯；未代行接受 |
| EVD-EKRWAE-003 | OBS-001/004 → CLM-002、CTR-001 / CONSTRAINS | 已接受三态、零 authoritative reconciliation 写入及条款例外的来源明确；不证明 live 恢复 |

所有坐标固定于 authoring base，外部 issue/PR 以所列 URL 和读取时间定位。后续源码/运行时
conformance 必须另有 §10 的执行证据；本文没有伪造 rawReceipt 或测试 PASS。

## 8. Decision and conflict crosswalk

`DEC-EKRWAE-001`：采用以下三条有界接续；§9 是完整有效语义，表中未替换部分均 PRESERVE。
下文 `CTR-001` 等短写均指本文 `CTR-EKRWAE-001` 等完整 ID，不指旧 WAE/SRE 的同号条款。
WAE / SRE 行号均绑定 authoring base。**R-B1 / R-B2 / R-B4** 均指
[#1374 正文 §3 对应 bullet](https://github.com/mayf3/agent-control/issues/1374)，原文如下：

> **R-B1**：区分临时业务读回失败与人工审查需求。临时不可用保留"结果未知等待再读"持久责任+下次检查时间；只读对账可有界重试；不得重跑未知结果业务操作。验收：503 后依赖恢复由现有调度自动再读收敛，无需 Root/Owner 再发消息。

> **R-B2**：核查 recoverAttempt 正式调用者与授权路径；满足安全条件的 blocked attempt 纳入既有 Scheduler/治理恢复触发；保留原 request identity/generation/旧执行停止证明/副作用状态。验收：解析依赖恢复后无人工调用也能获得合法继续；证据不足可靠升级。

> **R-B4**：修一次版本采样失败致永久无法判断 + 仅凭同 visit workflowStateVersion 增长即认定业务推进。业务推进依据原 nodeVisit/合法 transition/执行事件/业务结果等权威事实；版本增长可触发重检，不单独等价于完成。验收：缺失基线与同 visit 版本增长都不能让未完成业务永久逃离自动处理集合。

| 旧条款 / base 坐标与冲突 | 新语义及保留关系 | Owner 原文锚点 / 新 Contract |
|---|---|---|
| WAE CTR-WAE-006:323–349：terminal/lost + probe unavailable → terminal NEEDS_REVIEW；只允许 terminal-verdict 写入；blocked 仅 skip、never recovery | 临时不可用保留 UNKNOWN 与持久只读下一检查责任；reconciler 可处理责任元数据，B2 由既有 Scheduler 调用同一正式安全 gate；不把 blocked 当 delivery_unverified | R-B1/B2；CTR-EKRWAE-002..005 |
| WAE CTR-WAE-005:301–321、CTR-WAE-012:484–487、SRE §1:98–99：terminal-refusing、三态/历史保全 | 仅为 B1/B4 的责任登记、只读观察和可信关闭事实开放追加；保留旧 verdict/event 字节与未知副作用，不 un-terminal 为可执行 attempt；其他 terminal append refusal 保留 | R-B1/B4；CTR-001/003/006 |
| WAE CTR-WAE-007:351–361：unavailable ⇒ NEEDS_REVIEW | unavailable 不能视作业务事实；临时读失败不等于人工裁决需求，必须有下次只读检查；目标 Agent 身份、visibility invariant、no wake 原义保留 | R-B1；CTR-001/002 |
| WAE CTR-WAE-011:420–482：blocked eligible，never automatically recoverable | 仅 PROVEN_ZERO 的原 blocked attempt 可经可信 Scheduler trigger 重入同一恢复 gate；原身份、停止证明、副作用状态保全；历史 planned-only 仍不适用 | R-B2；CTR-004/005 |
| WAE CTR-WAE-013:547–604：禁止 poll/reconcile/timer 调用；authorityRef E1；E2–E6 与 WAL/crash gate | 新增可信自动调用授权分支，保留显式 authorityRef 人工升级路径；共享 E2–E6 的安全条件、既有锁和 WAL；无任一合法授权 E1 仍零写拒绝 | R-B2；CTR-001/004/005 |
| WAE:75–90、CTR-WAE-003:250–256、CTR-WAE-009:374–387：只准 explicit controlled recovery、no automatic retry ever | 只让位于本文同 attempt、投递前、有限频率的自动 resolution 恢复；不增加新 scheduler/retry engine，不自动修身份或恢复 delivery-domain attempt | R-B2；CTR-004/005 |
| WAE CTR-WAE-012:507–528：recovery_authorized 只携每次显式 authorityRef；NEEDS_REVIEW 是唯一 human escalation terminal | 自动路径须记录可信规则引用、触发来源、精确 attempt/generation 与 gate 证据；人工路径保留显式 authorityRef。NEEDS_REVIEW 标签本身不证明人工责任已送达 | R-B1/B2；CTR-003/005/007 |
| WAE:679–737 的 entry/authorization/surface oracle、756–757 inert-without-authorityRef | 无授权仍零写；允许经过正式可信自动授权且安全 gate 全通过的 Scheduler 调用；禁止模型调用与一切不安全 retry 的负例继续有效；新增 §10 反例 | R-B2；CTR-004/005 |
| WAE:647–677 的历史 Subjects A/B dogfood、deployment/recovery 顺序 | RETAIN 历史特定受控操作要求；本文不替代该操作 mandate、不启动两实例、不追认历史部署或身份修复 | R-B2 的安全边界；CTR-001/004 |
| SRE CTR-SRE-002:139–190：缺 baseline 则 NEVER stale-eligible；相等版本才可 stale | 保留无可靠原 baseline/版本不等不得 stale redispatch；必须补采/重验、持久再查或可靠升级，禁止“没有基线所以永久不处理”；晚采样不能冒充 dispatch-time baseline | R-B4；CTR-006/007 |
| SRE CTR-SRE-005:283–306、CASE3/4:322–323：assistance/version change defeats staleness | version-only（含增长、下降、assistance-only）只触发重检，不单独证明业务完成或责任关闭；原 stale 谓词不满足时仍保留只读处理责任；真实业务事实照常结算 | R-B4；CTR-001/006 |
| WEC V3 CTR-WEC1-002/004/008:101–151,204–233；SRE CTR-SRE-003/004 | PRESERVE：OUTCOME_UNKNOWN 不变可执行；Owner-resume 要正面 settled proof 和原 pre-plan baseline；本文不扩大 stale/Owner-resume admission 或将 late baseline 替换 preDeliveryWorkflowStateVersion | R-B1/B2/B4 不重放；CTR-001/004/006 |
| D-009 §8.4/8.5；D009_ALIGNMENT CTR-527D2-002/003 | PRESERVE：可信业务结果、可信 exact termination-only、无可信证据三分；无证据零 authoritative reconciliation 写入，UNKNOWN/fence/history 不改；责任元数据不是 settlement 权限 | 全部三条安全边界；CTR-001/003 |

## 9. Contracts

### CTR-EKRWAE-001 — Exact identity, UNKNOWN and no business replay

全部检查/恢复/责任提交 MUST 绑定原 `workflowInstanceId/nodeVisitId/dispatchIntentId/ownerPrincipalId`、
`attemptId/requestId/generation`；attempt generation、Router processGeneration、runtime epoch
分别记录与校验，不能混作一个量。提交在既有锁与 fresh replay 的原子边界比较原 attempt/generation
及所需 version；旧观察只留证据，不改新 attempt。不得通过换 identity、换 generation、清 fence、
重建 request 或伪造结果绕过 UNKNOWN。全部三条路径均不重放已经可能发生的业务操作。

沿用 D-009/alignment 三分：可信 exact 业务结果才可按原权限记录业务结果；exact termination-only
保留业务 UNKNOWN；缺失、冲突、过期、不可信证据不得写 business settlement、termination settlement、
Router/Scheduler occurrence/fence/nextRun 等受保护状态。停止证明本身不证明业务副作用为零。
B1/B4 只读观察不投递、不 transition/wake；B2 只允许证明从未投递的同 attempt **首次** admission。
其他业务执行或后继 generation 仍须另走既有 accepted 契约，本文不新增其许可。

### CTR-EKRWAE-002 — B1 persistent read-only settlement responsibility

`settle_check_unavailable` MUST 保留原未知结果，区分临时网络/503/依赖读失败与真实人工裁决。
临时不可用必须在既有持久 ledger 中保留“结果未知等待再读”责任、原检查身份、失败分类与
`nextCheckAt`（语义字段，不指定 wire 名）。既有 Scheduler/reconciler MUST 自动发现到期项并
以目标 Agent 身份只读重查；重启重新发现不依赖 Root/Owner 再发消息或进程内 timer。

每次扫描的项数/读次数有正的有限上界，失败采用有上限的退避与持久下一次检查，不能忙循环。
具体有限预算/延迟值是后续实现配置，必须验证为有限正值并在证据中记录；有限单次预算耗尽
不删除责任。依赖恢复后自动再读，按可信 Workflow 事实与原结算权限收敛；读仍不可用或证据
不够则继续保留责任/按 CTR-007 可靠升级。不得以“已 NEEDS_REVIEW”停止消费，不创建业务 retry。

### CTR-EKRWAE-003 — Responsibility lifecycle without rewriting history

在同一既有 ledger 上追加责任/check/交接证据，保留 append+fsync、现有锁、fresh replay、
可重放投影与幂等，不建第二 ledger。记录至少包含 exact identity、责任类别、消费者、下一触发、
最近结果/失败、观察来源时间和交接/关闭证据；只存事实/ID，不复制上下文或敏感正文。

针对 B1/B4，旧 terminal verdict 与事件字节不改；只允许追加责任元数据、只读观察及其可信关闭事实。
该窄例外不把终态 attempt 改回 ACTIVE、不重开 admission、不追加 delivery_started/run_delivered。
新可信业务事实可依 CTR-WAE-010 关闭本 visit 的处理责任/投影为 SETTLED，但不得声称旧 Run 是
完成者；缺证据仍 UNKNOWN。仅责任到期/退避写入不是 authoritative reconciliation，不得顺带
修补 business outcome、terminationSettlement、Router/Scheduler fence、occurrence 或 nextRun。

已有 `NEEDS_REVIEW/settle_check_unavailable` 记录须在重放/扫描中自动重建同身份责任，首次
持久 next-check 登记须幂等且不重写原事件。不可读/损坏台账保持 UNKNOWN 并可靠升级，不能
按“空集合”通过；其他 terminal append 禁止保持。责任只能以权威事实关闭或以已可靠送达、
具有后续消费者/答复验证与重新触发路径的合法交接转移，不能以一次失败或耗尽次数消失。

### CTR-EKRWAE-004 — B2 one shared safe pre-admission gate

自动与人工调用 MUST 共用既有 `recoverAttempt` 正式内部入口和同一 FIFO/OwnerLock/fresh replay。
仅原 `resolution_blocked`（含合法历史 resolve_failed 投影）可候选；不是普通 planned 恢复。
每次调用必须在锁内重新证明以下全部条件，不能缓存一次 PROVEN_ZERO 供以后使用：

1. 当前仍为同一 attempt/request/generation、同 instance/visit/dispatch/assignee，visit 未合法
   迁移、实例未终止、身份权威未漂移；fresh exact resolver 与原 deliverability gate 原样适用。
2. 原 WAL/解析阶段证据证明从未进入投递：不存在 `delivery_started/run_delivered/delivery_rejected`
   或任何 delivery-domain linkage；历史 planned-only 无此证明仍不适用。
3. fresh、可信且 exact 的 Router/session correlation 明确满足旧入口的 never-invoked 次级门；
   `null/never_existed` 标签自身不是证明，不能覆盖 WAL。pending/settled/evicted/restart_lost、
   不可达/不可信/冲突/错误 epoch 或任何已投递证据均禁止 admission。
4. 原执行及已派工具不存在或已依法停止/隔离的证明必须保全；投递前机制的正面“从未启动”证明
   可以满足不存在，不能用超时、PID 消失或仅抑制回复代替。若已存在旧执行/副作用不确定性，
   即便有停止证明，也不再属于本文的零投递自动恢复类；只读对账/升级，绝不重放。

通过后才可持久 recovery authorization、fresh resolve、持久 `delivery_started`、首次 deliver，
严格顺序不改；同 requestId=attemptId，原 generation/副作用身份不变。解析仍失败保持 blocked，
不投递；投递开始后任何崩溃都转 delivery-domain，不得重复恢复。并发自动/人工调用仍至多一次
admission。无 attempt / terminal 保持旧 no-op；world drift 按旧 refusal 保留事实并可靠交接；
证据不足不得臆断拒绝原因或清 UNKNOWN，保持责任并按 CTR-007 处理。

### CTR-EKRWAE-005 — B2 existing Scheduler trigger and manual escalation

安全 eligible blocked attempt MUST 纳入既有 Scheduler/治理恢复触发，包含持久 next-check、
消费者与重启重建；解析依赖恢复后不依赖人工调用即可通过 CTR-004 获得合法继续。
可信 control-plane 自动消费者以**已接受本文的规则引用 + exact trigger/attempt/generation +
fresh gate evidence**记录调用授权；不是模型自填 authorityRef，也不是把 issue URL 当一次
运行授权。未接受/未装载的候选规则不授予自动调用权限；生产启用仍另循正式发布授权。

人工升级路径继续要求显式 `authorityRef`（归属明确的 Owner/治理裁定），不取消该入口。
调用既无可信自动授权又无有效显式 authorityRef 时，按旧 E1 零写拒绝；两类授权均不能越过
CTR-004 的安全条件。`recovery_authorized/recovery_refused` 审计能区分自动规则来源和人工
authorityRef，精确绑定本次调用及证据。无 gate 通过不得预记“已获恢复授权”。

自动触发限频、有界逐项处理，解析仍失败须持久安排下一次/可靠升级，不阻断其他 eligible 项；
不新增 timer/queue/服务或周期重投逻辑。执行从未开始时的重新解析与首次投递不是业务 replay。
停止未知旧执行、修复 identity/grant、承认外部效果或恢复 delivery-domain 仍须原独立权限。

### CTR-EKRWAE-006 — B4 baseline evidence and business progress

缺 `workflowStateVersionAtDispatch` MUST 保留补采/重验的持久只读责任。只能从可归属原
dispatch/visit/attempt/generation/时间的可信历史事实恢复原基线，保存来源与补证时间。
晚到当前读数必须标明“重检观察基线”，不得冒充原 dispatch-time baseline，更不能替代
WEC CTR-WEC1-008 的 `preDeliveryWorkflowStateVersion`。无法恢复原基线不使业务出集合，
持续只读重验/可靠升级；不凭新样本放宽旧 stale/re-entry、quiescence 或 Owner-resume gate。

同 visit version 增长、下降、不等、assistance-only 变化只触发重检；单独不能判业务完成、
Run 成功、stale_superseded 或处理责任已结束。进展须有与原 visit 相符的合法 transition、
执行事件、权威业务结果等事实；执行活动/版本变化不自动等于该 visit 完成。依 WAE CTR-010，
可信 moved visit/visibility invariant 可关闭本 visit 处理责任，但不归因给旧 Run。

保留 CTR-SRE-002 的 redispatch 必要条件（可靠原基线、相同版本、current visit、实例非终态、
阈值及成功读）和 SRE/WEC 的全部准入保护。不满足 stale predicate 只拒绝该写路径，
不取消 B1/B4 的到期只读消费者。修复前缺基线/同 visit version-only 的旧记录须可重启再发现，
不得把旧 `progressed` 标签或“非 stale”投影当作已完成业务。

### CTR-EKRWAE-007 — Coverage, closure and reliable escalation

后续实现须为三个范围逐一给出状态—消费者—安全前置—持久下次触发—权限—失败责任—关闭
条件映射，实际运行入口与重启可发现性可验证。无消费者、仅函数存在、仅 NEEDS_REVIEW
标签、通知已排队/ACK、计数耗尽均不能宣称自动恢复或责任已交接。

长期无法取得安全证据/确需真实决策时可升级至既有 Owner/Assistance 路径：保存原 identity、
UNKNOWN、副作用与停止证据、缺失事实、接收责任方、送达证明和答复验证/重新唤醒路径。
送达失败时原自动责任及下次触发继续保留；真实人工决策门可暂停不安全 admission，不能
伪称业务完成。B1 的有限临时读失败不能直接强制人工，B2 的证据不足不能盲目循环 deliver。

## 10. Acceptance

以下是**后续实现**的必需反例验收定义，不是本次执行结果。每项须记录
`sourceSha/testName/faultInjection/initialState/expectedResult/actualResult/rawReceipt`，
原/新 identity、持久事件与 protected-state 前后证据、调用/投递计数及 rc；独立 Reviewer 可复现。

| Acceptance | Contracts | Method / environment | Required evidence | Expected result / failure condition |
|---|---|---|---|---|
| ACC-EKRWAE-001 | CTR-001..007 | 独立文档 review：固定 base/candidate 对照 §8、Owner 原文、三态和依赖 oracle | 精确 reviewed head/哈希、冻结 blocker union、最终头 delta recheck | 范围例外透明且无冲突遗漏；误标 accepted 或扩大 replay 权限失败 |
| ACC-EKRWAE-002 | CTR-001/002/003/007 | 可信隔离持久 ledger + 正式 reconciler/Scheduler；注入一次真实读入口 503，随后依赖恢复；中间真实进程重启；含旧 NEEDS_REVIEW 记录 | nextCheck 持久化/重建、自动消费者触发、原事件/UNKNOWN/read count/delivery count | 无 Root/Owner 消息自动再读收敛；原业务投递不增加；缺责任或重放失败 |
| ACC-EKRWAE-003 | CTR-001/002/003/007 | 隔离环境持续 unavailable、缺字段/visibility、错误 identity/generation/epoch、stale/conflict evidence；耗尽单次预算/通知失败 | protected state/fence/history 字节与语义比较，限频/退避/交接记录；原/新 attempt 并发交错 | 仅责任元数据合法追加，UNKNOWN 零 settlement/零 fence 写；旧观察不改新代；责任不消失、健康项不饥饿 |
| ACC-EKRWAE-004 | CTR-001/004/005/007 | 正式既有 Scheduler→recoverAttempt + 持久 store/真实重启；解析先失败后恢复；并发人工 authorityRef 与自动 trigger | caller/规则授权、fresh gate/停止证明、WAL、原 request/attempt/generation、admission receipt/count | 无人工调用自动首次 admission 至多一次；identity/generation/效果状态不变；仅调用 helper 或换 request 不算通过 |
| ACC-EKRWAE-005 | CTR-001/004/005 | 每个 B2 负例：delivery_started 即崩溃、receipt 丢失、Router 假 never_existed、实际投递/未知效果、无停止证明、pending/lost/不可达、world drift、历史 planned-only、无合法自动/人工授权 | 原锁中 gate 结果、零 admission/相应零 recovery append、refusal/交接；对 WAL 前后注入真实进程故障 | 不安全项零 admission；无授权 E1 零写；显式 authorityRef 不绕安全 gate；证据不足保留责任/可靠升级 |
| ACC-EKRWAE-006 | CTR-001/003/006/007 | 隔离持久环境：一次基线采样失败，重启再发现；可恢复可信原证据与只有晚到当前样本两分支 | 基线来源/时间/原身份、late-sample 标注、next-check/recheck、投递计数 | 可补证重验；晚样本不冒充原 baseline/preDeliveryVersion；无可靠基线不 stale redispatch、不逃离处理集合 |
| ACC-EKRWAE-007 | CTR-001/003/006 | 同 visit version++、version--、assistance-only bump；正对照合法 transition/moved visit/terminal business result | 原 nodeVisit/transition/event/result 事实、责任投影/重检与 ledger 结果 | version-only 仅重检且未完责任持续；真实事实按原权限关闭、不误归因 Run；数字变化即完成/重新投递失败 |
| ACC-EKRWAE-008 | CTR-001/003/004/005/006/007 | D-009/alignment 三态回归、正常执行、既有 stale/Owner-resume、停用/回滚与重启；隔离真实 store/入口 | 已接受既有反例 suite 的真实结果，UNKNOWN/单 admission/基线/责任映射 | 全部安全边界保留；政策停用不清理 UNKNOWN，未完成责任保全/可靠交接；文档/内存桩 PASS 不冒充跨服务 E2E |

每个 CTR 均被覆盖。涉及 DB/多进程的声明须用可信隔离数据库与真实进程故障注入；不在生产
制造故障。源码 conformance、实际安装启用、跨服务业务验收、无人值守结果分别报告 UNKNOWN
或实测状态；自动函数已存在不能替代真实消费者/持久触发的证明。

## 11. Alternatives and disposition

- NEEDS_REVIEW 后永久退出、无限忙循环、有限次数后丢责任：REJECT，违背 B1/L1/L2。
- 所有 blocked 无条件循环 recover、人工 authorityRef 可绕过安全条件：REJECT，可能重放 UNKNOWN。
- 事后采样伪造原基线、version++ 即完成或任意 redispatch：REJECT，破坏 B4 与 UNKNOWN 保护。
- whole-WAE/SRE 改写：本任务不采用；按用户明确的特定条款例外公开接续，保留原权威其余部分。
- RETAIN：既有 Scheduler/reconciler/ledger/正式 recovery 与人工 authorityRef；新增语义取代
  相应永久失活/全面禁自动解析恢复解释，不维护平行旧/新可执行恢复模型。

## 12. Migration, compatibility and rollback

旧 ledger 原字节保留、事件可重放；只在同 ledger 上追加带来源的责任/观察与授权记录。
历史 ambiguous/缺基线记录保留 UNKNOWN，按 CTR-003/006 重建观察责任，不 bulk 改成成功/失败。
原 generation、operation/request identity、WEC pre-plan baseline 与历史事故关联不变。
后续实现迁移既有消费者与 gate，替换本范围的旧永久 skip 解释；不并存两套 Scheduler/ledger。

本 PR 无源码/配置/生产变化，回退此 proposed 文档不影响运行时。未来运行时回退/停用自动
恢复须另有正式发布/运维授权，并保留未完责任、UNKNOWN、停止/副作用证据和可靠接续路径；
不能以回退清空 next-check/ledger 或复活可能已投递的旧操作。

<!-- END CARRIED LIVENESS V1 -->
<!-- END COMPLETE PPR1 SOURCE -->
