---
spec_id: AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1
status: superseded
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
authority_action: SUPERSEDE
date: 2026-11-05
repository: mayf3/dsh-agent-core
authoring_base: 9f04db29cce44a684b4409fa63b436aaf10dfa52
scope:
  - B1 persistent read-only settlement responsibility
  - B2 safe same-attempt pre-admission resolution recovery through the existing Scheduler
  - B4 version-baseline observation and unfinished-business responsibility
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - SCHEDULER_OCCURRENCE_OUTCOME_V3
  - AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1
  - AGENT_CORE_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V2
external_authorities: []
supersedes: []
supersedes_clauses:
  - authority: AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3
    clauses: CTR-WAE-006/011/013 and the bounded dependent statements enumerated in section 8
  - authority: AGENT_CORE_WORKFLOW_STALE_REENTRY_V2
    clauses: CTR-SRE-002 version-baseline responsibility and dependent CTR-SRE-005 and acceptance statements enumerated in section 8
superseded_by: AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V1
owners: [mayf3]
owner_rulings:
  - https://github.com/mayf3/agent-control/issues/1374
references:
  - docs/specs/AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3.md
  - docs/specs/AGENT_CORE_WORKFLOW_STALE_REENTRY_V2.md
  - docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3.md
  - docs/specs/AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1.md
  - docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md
  - docs/evidence/ekr-preflight/DEFECT-MATRIX.md
---

<!-- R4_PPR_RETIREMENT -->
> Whole-authority retirement recorded to [PPR V1](AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V1.md)
> under Owner ruling ② / standing §3B; activates with the ordered #655/#657 main transactions.
> Original body, Contracts, historical acceptance and predecessor links remain readable unchanged.
<!-- END R4_PPR_RETIREMENT -->

# AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1

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

## 13. Open questions and authoring result

规范性 TBD：NONE。待接受绑定坐标、具体实现预算值和实际运行结果不伪造为已知；实现选型
不得改变上述 Contracts。本文没有接受、merge、实现或 production apply 权限。

```text
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = SUPERSEDE (explicit task-scoped clause exception)
PRIMARY_AUTHORITY = WAE V3 / SRE V2 affected clauses; D-009/alignment preserved
PLAN_LEVEL = BRIEF (this bounded docs-only task)
ASSURANCE_LEVEL = CONTROLLED (recovery authorization semantics; no operation in this task)
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO (this successor)
DOCS_FIRST_REQUIRED = YES
PARTIAL_SUPERSESSION = EXPLICIT_TASK_SCOPED_EXCEPTION (sections 3/8)
CONTRACT_COUNT = 7
CONTRACTS_WITH_ACCEPTANCE = 7
OPEN_OWNER_DECISIONS = NONE_FOR_AUTHORING
NORMATIVE_TBD = NONE
AUTHORING_READY_FOR_REVIEW = YES
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO (acceptance and merge delegated to later supervision)
OPERATION_ALLOWED = NO
DONE_WHEN = docs-only candidate + independent review + receipt + pushed open PR referencing #1374
EXPANSION_TRIGGER = new semantic conflict, unsafe replay, scope escape, required verification failure
NEXT_REAL_ACTION = independent exact-head REVIEW; then delivery only, never merge
```

## Acceptance alignment note (2026-11-06, traceable correction)

Owner acceptance was recorded on PR #623 (comment 6646591408): "Status proposed→accepted, implementation_authority→contracts, effective retroactively to the task-mandate issuance" — the comment's `$(gh pr view 623 ...)` binding literal failed to expand at posting time; the intended binding is PR #623 merge commit `2d550bc8147c877db33886fccb85e00a64353e66`. This frontmatter edit only aligns the document with that recorded acceptance; no new acceptance is created here.
