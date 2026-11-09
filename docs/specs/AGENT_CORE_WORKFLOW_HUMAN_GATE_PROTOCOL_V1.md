---
spec_id: AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1
title: HUMAN_REQUIRED notification, verified human answer, and Owner-resolved resume protocol proposal
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
repo: mayf3/dsh-agent-core
scope:
  - human-gate-read-and-event-consumption
  - verified-human-answer-to-authorized-owner-resolution
  - existing-owner-assistance-single-resume
date: 2026-11-09
revision: proposal-3-blocker-repair
candidate_base: f6a1f77a8b7b878bcb9821a68836925755ca7076
authority_reference_main: a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_WORKSPACE_SESSION_MODEL_V3
  - AGENT_CORE_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V2
  - AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3
  - AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1

**spec proposal, proposed — not acceptance.** 本文件仅提出 Core 消费合同；
`implementation_authority: contracts` 是接受后、相关 accepted 修订进入实施 base 后的
限定语义，当前不授权产品实现。无 acceptance、生产 apply、部署、身份/Grant 变更或运行时验证。
本文件不替 Svc 仓库接受合同，也不宣称已有 Svc 收件 API、持久消费者或数据库约束。

## 1. Goal

闭合显式 `HUMAN_REQUIRED` 之后的通知、真人答复验证、合法 Domain Owner resolve，
以及原任务一次重唤醒的证据链。任一通知 ACK、Agent turn 结束、普通回复或到期时刻，
均不得被当作业务责任满足或下一代执行授权。

## 2. Scope and non-goals

范围是已有 Svc Assistance case 的 HUMAN_GATE 消费协议。真人答复必须先经可信身份、
指定 Domain、case 和当前责任关系验证，再交由 Svc 的合法 resolve 路径处理；Core
只在原 WEC008 证明充分时消费一次 resume authorization。

不新增 Core 持久 case/phase continuation engine、独立 obligation/permit 账本、第二套
任务/Session authority、写工具、Auth scope、身份冒用、隐式 Owner handoff、自动 resolve、
自动解除 STOP 或 UNKNOWN replay。不把其他 `HUMAN_REQUIRED`（如 Scheduler）纳入。
不改变 managed effect 的稳定 identity、required-operation receipt 或既有 WAE/RETURN 预算。

## 3. Authority and dependencies

原 authoring 坐标保留为 `candidate_base`。本轮有效 WEC 权威改绑到
`authority_reference_main` 的 accepted WEC V5（V3→V4→V5 整权后继），其余原输入
不变；优先级按本地治理。该固定 main 快照只读核对，不表示 WEC5 已进入本分支的旧
实施 base；后续实施仍须核对实际 base 中的 accepted 权威。文件哈希与读取方法见回执。

| 本地权威 | 本协议继承的含义 |
|---|---|
| Product Architecture §§3–4 | Workflow 为外部业务系统；Core 保持薄组织层，不重建业务引擎 |
| D-008 / `AGENT_WORKSPACE_SESSION_MODEL_V3` §14 | Agent 通知进入目标 canonical main；通知不复制 Workflow task authority |
| Owner Workflows V2 §§1/6/8–9 | Svc owns intent/case/effect/receipt/STOP；ACK 不满足义务；Core 不 resolve case；UNKNOWN readback-only；无 Core case/phase engine |
| WAE V3 `CTR-WAE-001b` | 原 due feed 完整 keyset sweep、无持久 cursor/queue/lease；不得以通知流代替可执行任务发现 |
| WEC V5 携带的 `CTR-WEC1-005` | 一次稳定 `wfassist-<caseId>` Owner wake；admission ACK 与业务完成分离；只有显式 Owner 升级产生 HUMAN_REQUIRED |
| WEC V5 携带的 `CTR-WEC1-008`、`CTR-WEC4-010` / `ACC-WEC4-003` | 原精确 Svc 凭证、settled 前驱与单次 permit 消费；两类远端 collection 锁外执行，重获同锁后 current ledger replay、fresh 权威终检、单次 append；A 采集等待不阻塞无关 B |

交办输入：[任务 #1374](https://github.com/mayf3/agent-control/issues/1374)、
[Owner 议题 #1352](https://github.com/mayf3/agent-control/issues/1352) 和
[Svc 后继任务 #1378](https://github.com/mayf3/agent-control/issues/1378)。这些是任务/协作记录，
不替代 accepted Product Authority。交办已给定 HUMAN_GATE、指定域 Owner、24h 三项意向，
无需请求 Owner 重复决定。已核验来源为 [#1352 comment-6622750077](https://github.com/mayf3/agent-control/issues/1352#issuecomment-6622750077)：
作者 `mayf3`，创建/更新时间 `2026-11-04T04:42:18Z`（2026-11-04 12:42:18 +08），
正文标注“监管代记”。三点持久裁定是：通知 HUMAN_GATE 群（附实例上下文与已尝试清单）；
仅 Owner 指定的域 owner 可代答/resolve，普通 Agent 不得代 Owner 意志；24h 无 resolve
则升级再提醒，不自动降级或关闭实例。2026-11-06 原任务指令④及其 Brief 本轮为
`NOT_LOCATED`（不可读不等于不存在），不凭旧路径/哈希重建原文。2026-11-08 持久
DISPATCH-REGISTRY 的 `$.rulings[id=owner-20261108-three-unified].items[3]` 与
`$.rulings[id=owner-20261108-backlog-convergence].items[3]` 已本地只读核实：仅常设授权
§7 所列新风险/新决策才最小差量 HUMAN_GATE，#1352 复用已裁定不重请。此政策语义
重锚定不重决产品裁定；原提案的期限、路径约束与依赖边界保留，不冒充上述来源原文。
可读摘录、持久路径、哈希、历史评论核验和局限见 `RECEIPT-627-REVISION.md`。

`external_authorities: []` 表示本轮没有核得可绑定的 Svc HUMAN_GATE accepted authority
及其 exact revision，不表示不存在跨仓依赖。Svc 持久 obligation producer/后继由 #1378
实施线承担；接收协议、授权验证、原子 receipt 和持久重发现须由所属仓库接受并进入
其实施 base。本 Core proposal 不赋予 Svc 写权限或跨仓 acceptance，依赖边界见 §13A。

## 4. Current State

`STATE-HG-001`：2026-11-06 authoring 观察，环境为隔离 worktree
`/private/tmp/dsh-ekr-p1a-spec`，branch `ac-ekr-p1a-spec`，base
`f6a1f77a8b7b878bcb9821a68836925755ca7076`。依赖 `OBS-HG-001/002`；
仅有本地合同与停止记录，不具有通知送达、真人身份、实际 resolve、安装或无人值守业务验收证据。

## 5. Observations

- `OBS-HG-001`：在上述 base 只读检查 Owner V2 §§1/6/8、WAE V3 CTR-WAE-001b、
  WEC V3 CTR-WEC1-005/008，观察到现有 ownership、ACK 与单次 resume 边界。
  文件实测 SHA-256 和方法记录在 `RECEIPT-EKR-P1A-SPEC.md`，不由代码反推权威。
- `OBS-HG-002`：只读检查第 3 派停止文件
  `/private/tmp/dsh-ekr-p1-new/STOPPED-EKR-P1IMPL.md` 的 `spec_gap_detail`；
  SHA-256 `7dcaf3792a8561caf2779d4e336cc48a935144e5646931f94113e430624a1466`。
  其反例和 minimum_closure 为本提案的问题输入，不是生产事故或已运行 HUMAN_GATE 的证明。
  关键反例与 minimum_closure 在 §10 完整重述，审阅不依赖该外部临时路径可用。
- `OBS-HG-003`：2026-11-06 修订时，通过 GitHub 只读 API 核验上述 #1352 精确评论的
  author、created/updated time、issue URL 与正文，三项裁定均有持久记录。API 来源、
  正文 SHA-256 与核验时间见 `RECEIPT-627-REVISION.md`；这仅证明裁定记录存在，
  不证明 HUMAN_GATE 收件、Svc 计时/提醒或 resolve 接线已经实现。
- `OBS-HG-004`：2026-11-09 在隔离 `/private/tmp/review-627/repo` 本地只读核对
  `authority_reference_main` 的 accepted WEC5 及其携带的 CTR-WEC1-008、CTR-WEC4-010、
  ACC-WEC4-003；同时读取上述 DISPATCH-REGISTRY 两条 ruling。方法、源文件哈希与
  最小摘录见回执；未访问生产，未重新访问 GitHub 评论，原指令④仍为 NOT_LOCATED。

## 6. Claims and assumptions

- `CLM-HG-001` — `SUPPORTED`（仅本地合同）：admission ACK 不能推出真人送达、
  答复合法、case resolve 或义务满足；依据 `OBS-HG-001`。
- `CLM-HG-002` — `INFERRED`：§9 的完整验证链可在合同层闭合 `OBS-HG-002` 反例。
  这不是已有消费者或运行效果的结论，未来须按 §11 验证。
- Svc 收件面、真实身份映射、managed HUMAN_REQUIRED 的合法后继、resolve link 及
  DB 原子性为 `UNKNOWN`，不得作为“已经实现”的假设。普通/managed 的已给定路径
  约束见 CTR-HG-004，不将它们扩大为全链路实现证明。缺失时拒绝依赖动作，见 §13A。

## 7. Evidence relations

`EVD-HG-001`：`OBS-HG-001` SUPPORTS `CLM-HG-001`；坐标为 `candidate_base`、
本地文档读取、2026-11-06 authoring，provenance 为回执的源文件哈希。足以确认文档边界，
不足以证明任何部署、实际身份授权或业务结果。

`EVD-HG-002`：`OBS-HG-001/002` SUPPORTS `CLM-HG-002` 的合同设计依据；
relation 仅为设计推断，充分性限于 §10 逐步拒绝反例。§11 所有执行证据仍 `NOT_RUN`。

`EVD-HG-003`：`OBS-HG-003` SUPPORTS §3 三项 Owner 裁定的持久来源；目标为
DEC-HG-002/003、CTR-HG-002/003/008 的 authoring 输入，坐标为精确 comment ID、
作者、时间和回执正文哈希。足以撤销旧“待核验”缺口，不足以证明跨仓 acceptance 或运行效果。

`EVD-HG-004`：`OBS-HG-004` SUPPORTS §3 当前 WEC 权威、CTR-HG-007/ACC-HG-007 的
锁时序与已裁定不重请的来源重锚定；坐标为固定 main SHA、registry path/selector、
回执摘录及哈希。足以复核本次文档修复，不证明原指令④原文、并发改善或产品/运行验收。

## 8. Decisions (proposed)

- `DEC-HG-001`：HUMAN_GATE 以 Svc 原 case 为唯一业务责任主体；通知和真人答复是
  可审计输入，持久 obligation/到期后继留在 Svc；Core 消费可重读事实和已有 resume 证明。
- `DEC-HG-002`：仅 Owner 指定的域 owner 可代答/resolve；消息验真与答复验证本身
  不授予该权限。普通 case 仅凭合法显式 resolve receipt 才可能进入 WEC008；opted-in
  managed case 必须保留 require_effect/真实 STARTED REVIEW effect 路径及原 guard。
  两条路径见 CTR-HG-004；本合同不承诺直接 Owner resolve 能解开 managed HUMAN gate。
- `DEC-HG-003`：24h 是“未 resolve 的处置期限”，不是“有人回复就结束”。从 Svc 原
  HUMAN_REQUIRED 的 `escalationAt` 起算；通知 ACK、答复已验证、通知重试或进程重启
  均不取消未 resolve 责任或重置期限。未 resolve 到期，须由 Svc 现有责任/通知机制
  持久升级再提醒并可重发现；仅显示 `OVERDUE` 不足。到期不能自动 resolve、默认同意、
  清除 fence、换责任主体或执行任务。实际持久接线仍属 Svc 依赖，见 §13A。

## 9. Contracts (proposed)

### CTR-HG-001 — Trigger, identity and durable ownership

Core 只接受 Svc 可重读、可归因于显式 Domain Owner escalation 的 `HUMAN_REQUIRED`
事实；本地 `needs_review`、failed turn、attempt cap、模型文本均不能生成该业务状态。
case/Domain/source Workflow/source NodeVisit/当前 Owner 关系由 Svc 确认，不能由消息
文本、Forum thread 名或 Core 自建映射补全。标识缺失保留 UNKNOWN，不伪造 UUID。

失败 Owner turn 后未完业务责任的持久后继属于 Svc（#1378）；Core 消费其事实。
Core 进程退出或 ledger/通知投影丢失不能被解释为责任消失。没有可验证 Svc 后继时，
只报告缺口，不在 Core 新建常驻 case/phase 控制器。

### CTR-HG-002 — Notification and ACK separation

通知目标为 HUMAN_GATE 群，附实例上下文与已尝试清单，必须绑定原 escalation Event 和
原 case、Domain、source 坐标、Owner 指定的域 owner、答复入口及原 24h 未 resolve
处置期限；无已验证收件路由时不得报告已送达。通知内容不得包含凭据。
对 Agent 的提醒服从 D-008 notification/main 边界；对真人的实际渠道送达须有该渠道证明。
canonical Forum thread 仅为展示关联，回复所属 thread 不是身份或权限证明。

分别报告通知请求/admission、渠道送达、已验证答复、合法 resolve、resume admission 和
业务义务满足。每项只能由对应实际 receipt 支持；缺失为 UNKNOWN/未证明。
复用 WEC005 Owner wake 时保持原 `wfassist-<assistanceCaseId>` 与 `inter_agent` origin；
pending/settled 的同 request ACK 仍只证明 admission。不得换 key/Session/任务盲目重发。
既有 WEC007 Forum 投影错误不得影响执行决策；展示 ACK 不能提升为业务事实。

### CTR-HG-003 — Verify the human answer without granting authority

可信收件边界须验证渠道消息真实性与防重放身份，将不可由模型自报的外部身份映射到
启用的 canonical HUMAN Principal，再验证其是该原 case 所指定的真人收件者/受权答复者。
消息真实性或 HUMAN 身份不授予代答权：仅 Owner 指定的域 owner 可代答/resolve，
须验证该指定和当前 Domain/case 关系；普通群成员或未获指定 Agent 不得代 Owner 意志，
不得将其消息验真记成受权代答验证成功。
显示名、@ 提及、HUMAN 类型、已投影 Principal UUID、转发消息或任意 Agent 代答均不足。

验证必须精确关联 `assistanceCaseId/domainId/workflowInstanceId/nodeVisitId`、原
`escalationEventId`、当前 HUMAN_REQUIRED 状态与当前责任关系。由消息的 reply-to/thread
关联提供候选定位后，仍须重新读取 Svc 权威关系。伪造、跨域、跨 case、旧 escalation、
身份不明、Owner 更换后过期的输入一律不得进入 resolve；拒绝事实可审计，业务零推进。
答复验证记录必须带原消息稳定标识、验证主体/时间、canonical human ID、关联坐标及结果，
可从授权的只读面追溯。不得把正文中的 actor/Domain/同意字样当作认证结果。

### CTR-HG-004 — Explicit lawful resolve at the Svc boundary

已验证答复仅交给指定 Domain 当前有权 Owner 的既有决策/命令路径。Svc 必须在命令
提交时重新验证真实 caller、精确 Domain resolve 权限、当前 case/状态/source/Owner
关系及既有 CAS/receipt 条件；通知 recipient、答复人和 `resolverPrincipalId` 各自记录，
不得混同。无权限的答复人不能借 Core、Agent credential、Owner 字段或“回复”获得授权。

保留原提案的路径约束（原指令④ NOT_LOCATED，来源重锚定见 §3/回执）；消费前
必须分拆两类，不能把普通路径外推到 managed：

| case 路径 | 合法推进约束 / Core 消费边界 |
|---|---|
| 普通 Assistance case（非 opted-in managed） | 既有 `owner_action` 支持 `HUMAN_REQUIRED→RESOLVED`；仍需指定域 owner 的真实 caller、显式授权、当前状态/CAS 与实际 receipt/readback。只有该合法 resolve 凭证及 WEC008 全部证明成立时，Core 才可消费一次 resume |
| opted-in managed case | 必须走 `require_effect`，关联真实 `STARTED` 的 `REVIEW` effect，遵守既有 managed admission/receipt/STOP guard。在现有可达路径下，直接 Owner resolve 被 managed guard 拦截，不能因“有权 Owner”而绕过。HUMAN_REQUIRED 后的 managed 合法后继由 Svc 的 #1378/#1352 责任线闭合；本 Core 合同只描述消费面，不创建或承诺该后继已可达 |

以上路径约束保留为提案消费边界，不作为已核得原指令④原文或 Svc 实现/运行验收。Core 不代行 resolve，不从
通知/答复构造 resolved Event，也不新增 HUMAN_REQUIRED 旁路。实际路径若不允许该
状态或所需输入，则维持待处置并报告 UNKNOWN/缺权威，交 Svc 所属 accepted authority
闭合；不得通过放宽现有 managed guard 解决。只有已提交、可读回的合法 resolve
receipt/Event 才可进入下一步；它仍不等于任务业务完成。

### CTR-HG-005 — Minimum read/event consumption contract

Core 所需的是**经认证 Svc 只读投影或等价事件加权威重读**。以下是新提案的逻辑字段合同，
不是已存在的 endpoint、Event 名称、DB 表或实现声明。版本 1 投影为封闭对象；字段必填
且不接受 null/部分证明，未核到的事实不能用默认值补齐：

| 投影 | 最小字段及约束 |
|---|---|
| `humanGateEscalation` | `version:1`；UUID `escalationEventId/assistanceCaseId/domainId/workflowInstanceId/nodeVisitId/domainOwnerPrincipalId/recipientHumanPrincipalId`；`caseStatus:HUMAN_REQUIRED`；整数 `escalationEventSequence/workflowStateVersion`；RFC3339 `escalationAt/resolutionDueAt`，后者等于原 escalationAt 加 24h，表示未 resolve 处置期限；`escalationEventSequence <= workflowStateVersion`。Svc 证明 Domain 当前 Owner、Owner 指定关系、指定收件人、原 source 和该显式 Event 的关联 |
| `verifiedHumanAnswer` | `version:1`；UUID `verificationReceiptId/escalationEventId/assistanceCaseId/domainId/workflowInstanceId/nodeVisitId/humanPrincipalId`；非空 opaque `sourceMessageId`；非空 `channel`；RFC3339 `receivedAt/verifiedAt`；非空 `verifierAuthorityRef`；`verificationResult:VERIFIED`。Svc 可验证其指向 CTR-HG-003 的实际可信验证记录；human ID 匹配该 escalation 的受权答复者 |
| `humanGateResolutionLink` | `version:1`；UUID `verificationReceiptId/escalationEventId/assistanceCaseId/domainId/workflowInstanceId/nodeVisitId/resolutionEventId/resolutionCommandId/resolverPrincipalId`；整数 `resolutionEventSequence/workflowStateVersion`；`resolutionEventSequence <= workflowStateVersion`。Svc 将真实验证记录、原 HUMAN gate 和合法 resolve receipt/Event 关联；不得由 Core 自签 |

所有 ID 精确匹配；整数在 Svc workflow-state-version/Event scale 内，时间不替代 sequence
授权。通知送达 receipt 与以上投影分开，可缺失但必须诚实报告；不能合成为 `VERIFIED`。
投影是必要输入而非 bearer permit，模型提交同名 JSON 不可信。授权读取不得扩大为跨域
枚举；沿用既有合法 visibility/credential seams。具体路径、分页与消息适配归 Svc 合同，
未接受/不可用时拒绝消费；不新增 Core product-api、scope 或模型写入口。

通知事件可作提示，丢失、重复、乱序不能成为唯一 correctness 路径；Svc 须提供授权范围
内可重新发现的未闭合责任、到期升级提醒及上述事实。提醒发送失败须保留原责任和失败
结果，恢复后仍可从 Svc 现有机制重发现并按原合同处置，不能仅靠一次事件或 `OVERDUE`
展示。Core 不用另一份持久 case store 填补该缺口。
原可执行任务发现仍使用 WAE001b：原七字段 due DTO 不增字段、cursor 用最后一行原值、
持续到 short page、失败等待下个正常 sweep；无有限页上限或持久 cursor。

### CTR-HG-006 — Resolve credential is exactly WEC008 evidence

CTR-HG-005 的 resolution link 必须与 WEC008 Svc 证据的同一 case、source、resolver、
resolution sequence 一致。link 不能替代后者，更不能向其封闭 DTO 增加 HUMAN 字段。
Core 继续调用既有只读 companion：

```text
GET /internal/v1/dispatch-intents/{dispatchIntentId}/owner-assistance-resume-evidence
query: previousAttemptId=<non-empty opaque Core attempt ID>&preDeliveryWorkflowStateVersion=<integer>
scope: workflow.read + direct token + enabled GLOBAL_SCHEDULER_READ binding
200 {"evidence": null | {
  "dispatchIntentId": UUID, "workflowInstanceId": UUID, "nodeVisitId": UUID,
  "ownerPrincipalId": UUID, "activationState": "ACTIVE", "workflowStateVersion": integer,
  "assistanceCaseId": UUID, "requestEventSequence": integer,
  "resolutionEventSequence": integer, "requesterPrincipalId": UUID,
  "resolverPrincipalId": UUID, "ingress": "assignee" | "execution_policy",
  "reason": null | "ATTEMPTS_EXHAUSTED" | "STALE_LOOP_EXHAUSTED",
  "lastAttemptId": null | opaque attempt ID string
}}
```

`ownerPrincipalId` 是 activation 的 assignee，不是答复人或 resolving Domain Owner。
`resolverPrincipalId` 是 Svc 验证精确 Domain 授权的 resolver。ordinary ingress 必须
`requesterPrincipalId == ownerPrincipalId` 且 `reason/lastAttemptId` 为 null；policy ingress
两者非 null、reason 合法、持久 `lastAttemptId == previousAttemptId`，不能回显查询造证。
真人答复不是第三种 ingress。`evidence:null`、缺字段、身份/版本/来源不明不能授权 resume。

### CTR-HG-007 — One resume authorization per lawful resolve

只沿 WEC008：latest predecessor 必须为 terminal `NEEDS_REVIEW/run_ended_no_submission`，
known delivery 且 fresh Router reconciliation 正面证明 `settled`。pending/UNKNOWN/
unavailable/ambiguous（包括 `run_outcome_unknown`）均拒绝；stale-path quiescence
替代证据不能用于这里。原 attempt 自身落盘的 `preDeliveryWorkflowStateVersion` 不得后补。

沿 WEC5 携带的 CTR-WEC4-010：先在既有 admission lock 内 replay ledger，捕获 detached
context（精确 tuple、前驱/不存在、generation、state/phase、baseline、settled proof、
eligibility、budget、已消费 case/Event 及 replay 坐标），不占用 generation 或消费 permit。
释放锁，在锁外完成两类远端 collection：fresh pre-plan read 与 Owner-resume evidence
read；响应须绑定原 tuple、前驱、baseline、Svc version 与 Event sequence。A 等待任一
采集时，无关 eligible B 必须能取得锁完成正常 admission。

随后重获同一 admission lock → replay CURRENT durable ledger → 比较全部相关本地前置
条件 → 在该锁内 commit-preparation 坐标取得 fresh trusted 权威终检 → 单次 append。
终检须正面确认当前同一 ACTIVE dispatch、非终态 instance、current visit、assignee 及
workflow-state version 均等于锁外结果；仅 local revision、结果 TTL 或两份旧 read 相同
不足，不能以在锁内重跑整套 collection 替代。无关 ledger append 保留；相关前驱、预算、
eligibility、permit consumption 或外部身份/版本变化、缺失/不可验证均丢弃旧结果，本轮
零 plan、零 permit consumption、零 delivery；沿原 refusal/正常 sweep，不改 refusal code
或重试政策、不把旧结果换 baseline/前驱再用。

仍要求 `baseline < requestEventSequence < resolutionEventSequence <= workflowStateVersion`，
证据版本等于锁外 fresh pre-plan version 并经终检确认相等。全部通过才一次 locked durable
`attempt_planned` 同时产生 N+1 并消费 permit，落盘该 pre-plan version 为新 baseline、
相同 identity、`previousAttemptId`、`retryReason:owner_assistance_resolved` 及原样
`assistanceResume`。不增第二份消费账本，其余 resolution/WAL/delivery 的原锁纪律不变。

一个 resolve 最多授权一次 next generation，非“每收到一次消息执行一次”。case/Event pair/
due row/restart 重放均不可再次 mint；多个旧 case 不能连续推动后续 generation。generation
与自动预算不重置；不标 `stale_superseded`。Owner-resumed turn 再无 submission 时，必须
有该 attempt 自身 baseline 之后的新 case 及新显式合法 resolve，不能自动继续。
Owner V2 的 managed STOP、Owner-change 和更严格的有限预算仍控制对应 managed path；
本协议不以 resume 消费授权清除它们或扩张适用范围。

### CTR-HG-008 — Failure, deadline, restart and audit boundaries

24h 是未 resolve 的处置期限，`resolutionDueAt = 原 escalationAt + 24h`。即使第 1 小时
已回复且答复验证成功，未 resolve 的原责任仍在，到期仍须升级再提醒；通知 ACK、答复
已验证、通知重复或 Core/Svc restart 均不取消责任或延后期限。

到期仍未 resolve 时，Svc 必须通过现有责任/通知机制持久记录升级提醒及发送结果，并
在重启、丢事件或通知失败后保持可重发现、可继续处置；通知失败不能抹去责任或假报送达。
仅显示 `OVERDUE`、只写本地日志或一次易失提醒不满足原裁定。Core 消费该权威事实，
不自建 timer-case 引擎、不替 Svc 承担持久后继；实际接线与交付证据仍 UNKNOWN。

超时/晚到答复均不得自动 resolve。晚到答复仍须重验当前 case/Owner/source 与所有授权；
已 resolve/VOID/retired 或 source 移动的旧答复不能产生新 permit。合法闭合须有权威
receipt/readback，答复验证状态不能冒充闭合事实。

答复验证、resolve 或 delivery 结果不明时只读原 receipt/权威事实；不能换 key/body/CAS
重试来“证明”成功。既有合法失败重试只在原合同明确允许的范围内进行。Owner replacement
保留 `OWNER_CHANGED_UNSUPPORTED` 与原 effect/STOP，通知不可另行选 Owner 或重置预算。

crash 在 plan 之前不消费 permit；plan 已落盘但无 `delivery_started` 时，严格复用 WEC008
原检查：exact requestId/attemptId caller-correlation 正面 `never_existed`、无 attributable
execution/handle/message/session，且 fresh 同一 ACTIVE tuple/version 等于落盘 baseline，
才可同 attempt 投递；fresh canonical Principal→Agent resolution 和 write-ahead delivery
仍前置。否则记录正常 `NEEDS_REVIEW/delivery_unverified` 而不投递。已有 `delivery_started`
不得借此 replay。审计串联原 escalation、通知结果、验证记录、resolve receipt、WEC evidence、
attempt 和实际业务 receipt；展示状态不能覆盖原 UNKNOWN 或把机制证据标为业务验收。

## 10. Counterexamples and minimum closure

第 3 派反例：Owner 显式升级 HUMAN_REQUIRED 后，Forum 通知/Agent wake 的 admission ACK
不能证明真人送达、答复合法或原 case resolve；没有经鉴权消费者时，普通回复不能获得
WEC008 的一次 resume 授权。minimum_closure 是接受通知/答复实施合同进入相关实施 base，
并由 Svc 线承担持久 obligation producer/后继；已有合法 Owner resolve→一次 resume 路径
不能替代前置真人答复协议。

| 可达反例步骤 | 本提案的验证链闭合点 |
|---|---|
| 同 request 返回 `ok:true,reused:true` / Forum 发帖成功即宣称 HUMAN gate 完成 | CTR-HG-001/002 保留 ACK 与业务事实区别；无渠道送达证明则送达 UNKNOWN，无验证/resolve 不推进 |
| thread 中普通“同意”、同名人、Agent 转述被当作 resolve | CTR-HG-003 验真实性、HUMAN 身份及受权答复者、精确 Domain/case/Event/current relation；CTR-HG-004 仍要求合法 Owner 命令 |
| 真实人回复了别的 Domain/case，或权限在答复后变化 | CTR-HG-003/004 的精确 join 与提交时重验拒绝；不通过模型自报身份/Owner credential 补权 |
| 已验证回复直接写 Core permit、24h 到期默认同意、Owner turn failed 后无人负责 | CTR-HG-001/004/005/008 将责任后继留在 Svc；期限不是权限；无真实合法 resolve receipt 则不消费 |
| 第 1 小时回复并验证成功但未 resolve，系统取消期限；或 24h 只展示 OVERDUE | CTR-HG-005/008 从原 escalationAt 保留未 resolve 责任，到期由 Svc 现有机制持久升级再提醒；回复/验证不取消责任 |
| 到期前后 Core/Svc 重启或通知失败，提醒和责任丢失或期限从重启重算 | CTR-HG-005/008 要求持久责任、原期限、提醒及失败结果可重发现；无该证据不能声称满足裁定 |
| 把普通 owner_action 的 HUMAN_REQUIRED→RESOLVED 用于 opted-in managed case，因 Owner 身份而绕过 effect | CTR-HG-004 分拆路径；managed 保留 require_effect/真实 STARTED REVIEW effect 与现有 guard，合法后继归 Svc #1378/#1352，Core 不补旁路 |
| 有 resolve 但前驱 UNKNOWN、已换 assignee/visit、缺 baseline 或仍有 managed STOP | CTR-HG-006/007/008 保留 WEC008 全部 proof 与 Owner V2 guard，零 resume |
| 同 resolve 重复消息、重放 due row/restart、旧 case 连续推动多个 generation | CTR-HG-007 的原 ledger 单次原子消费及新 baseline 拒绝重复；CTR-HG-008 仅允许原 WEC008 的同 attempt 恢复 |

上述是拟议合同如何拒绝反例，不是已执行的端到端修复；没有 Svc 受权收件、持久后继和
receipt/readback 证据前，完整 P1-A 仍不得宣称 `SOURCE_VERIFIED` 或无人值守闭环。

## 11. Acceptance

以下为将来实施的验收定义，当前全部 `NOT_RUN`。独立 Spec 语义审阅不等于执行这些测试。

| Acceptance / Contracts | Method | Environment | Required evidence | Expected result | Failure condition |
|---|---|---|---|---|---|
| ACC-HG-001 / CTR-HG-001 | 对比真实 escalation 与 local failed/cap/model text；杀 Core 后重读责任 | 隔离 paired Core/Svc fixture | 原 Event/case/Owner 坐标、Svc 后继、重启前后 readback | 仅显式 Svc HUMAN_REQUIRED 触发，责任不因 Core 消失 | 假 HUMAN_REQUIRED、无后继却称闭环、Core case engine |
| ACC-HG-002 / CTR-HG-002 | admission/settled ACK、渠道缺 receipt、投影失败、重复通知 | 隔离渠道与 Core fixture | 原 requestId、各阶段 receipt、投递次数、状态读回 | ACK 不推出送达/resolve/满足；同 Owner wake identity 保持 | 换 key 盲发、复制任务、伪送达、投影改执行 |
| ACC-HG-003 / CTR-HG-003 | 注入伪签名、Agent 转述、同名、wrong human/Domain/case/Event/Owner drift；消息验真但未获 Owner 指定的群成员/Agent 代答 | 隔离可信 ingress + Svc | 消息身份 provenance、canonical mapping、Owner 指定关系、验证记录、零 resolve/attempt 计数 | 拒绝所有错配；仅真正授权答复被记录 VERIFIED，验真不授予代答/resolve 权 | 正文自授权、HUMAN 类型即有权、未指定主体代答、thread 即 case proof |
| ACC-HG-004 / CTR-HG-004 | 普通 case 走 owner_action HUMAN_REQUIRED→RESOLVED；对比 opted-in managed 直接 Owner resolve、缺/伪 STARTED REVIEW effect；另测撤权/换 Owner/非法状态/CAS drift | 隔离真实 Svc 命令/DB 与 managed effect fixture | 路径分类、真实 caller/Domain 检查、guard 拒绝、require_effect 与真实 STARTED REVIEW effect、命令 receipt/Event、前后 readback | 普通合法 resolve 产生实际关联 receipt；managed 直接 resolve 被现有 guard 拦，合法后继只能按 Svc accepted 合同验证，缺失则 UNKNOWN/零推进 | 外推普通路径、Core 自 resolve、借 credential、放宽 managed guard、伪 effect、无 receipt 成功 |
| ACC-HG-005 / CTR-HG-005 | 校验封闭投影，缺字段/乱序/重复/丢事件后重读；>100 due rows 首100已 attempted | 隔离 Svc 只读/事件面 + Core sweep | exact DTO/schema、授权范围、恢复后责任、cursor 原值及101+发现记录 | 缺证据拒绝；事件非唯一正确性路径；原 WAE sweep 保持 | 自签投影、跨域枚举、漏责任、页上限/持久 case cursor、修改 due DTO |
| ACC-HG-006 / CTR-HG-006 | 对比 resolution link 与原 WEC008 DTO；普通/policy ingress、错 resolver/version/case | 隔离真实 Svc evidence seam | 原 receipt/Event join、exact request/response、身份/版本值 | 仅既有两种 ingress、原 DTO、精确关联被接受 | 第三种 human ingress、混淆 assignee/Owner、缺/假证明授权 |
| ACC-HG-007 / CTR-HG-007 | settled 正例与 UNKNOWN/pending/legacy baseline/换 tuple/STOP 反例；分别 barrier 暂停 A 的远端 pre-plan/evidence collection，令无关 B admission；真实独立双 writer 共享 ledger；采集后注入相关本地/外部 drift；并发/重复/replay/旧 cases | 隔离实际 Core engine/ledger/OwnerLock + Svc，按 WEC5 携带的 ACC-WEC4-003 | 两次 collection 锁外 barrier、同锁获取/释放、current replay、fresh 权威终检及 sequence/version 等值、全部 durable lines、delivery count、等待耗时含终检、implementation SHA | 两个 interval 中 B 均在解除 A barrier 前完成；A 仅在终检通过后单次 append；一个 resolve 最多一个 N+1；原 budget/STOP 与全部 writer append 保持，相关 drift 零 plan/消费/delivery | B 被 A collection 阻塞、锁内重跑整套采集、漏报终检等待、无权威等值终检、丢 append、双消费、新 permit store、补/换 baseline、UNKNOWN resume、自动续跑 |
| ACC-HG-008 / CTR-HG-008 | 第 1 小时回复且验证成功但未 resolve，推进至原 24h；到期前后 Core/Svc 重启、丢事件/通知失败后恢复重发现；晚到/response loss；crash before/after plan、before/after delivery_started | 隔离 paired fixture；可控时钟/故障与 Svc 现有责任/通知机制 | 原 escalationAt/resolutionDueAt、1h 验证记录、24h 未 resolve readback、持久升级提醒及发送/失败结果、恢复重发现、原 receipt、exact correlation、ledger replay/投递计数 | 回复/ACK/验证不取消责任；未 resolve 到期持久升级再提醒，重启/通知失败不丢责任不改期限；到期不授权；UNKNOWN readback-only；仅 WEC008 正面 never_existed 可同 attempt 恢复 | 仅 OVERDUE/日志/易失提醒、回复即取消责任、deadline 重置、失败假送达或丢责任、自动 resolve、未知换 key/重放、STOP 被消息清除 |

## 12. Alternatives and disposition

- `ALT-HG-001` 任意真人回复直接 resolve/resume：REJECT，真实性与 Domain 权限不同，
  违反显式 Owner resolve 与 WEC008 proof。
- `ALT-HG-002` 在 Core 增持久 case/phase/permit store：REJECT，复制 Svc ownership
  和原 ledger 消费权威；故障后会出现双重责任源。
- `ALT-HG-003` 通知重试/24h 超时替代 resolve：REJECT，活跃或等待不是业务事实。
- `ALT-HG-004` 复用合法 Owner resolve、原 WEC008、原 due sweep：RETAIN；只提出缺失
  的验证输入合同和消费关联，不重开已通过的现有机制修复。

## 13. Migration, compatibility, rollback and UNKNOWN

新逻辑投影仅供未来 HUMAN gate 消费，旧 case/Event/ledger 保持可读；不回填身份、
baseline、送达或验证证明，不从历史 thread 文本迁移出权限。不改 accepted 文件及稳定
Contract ID，不 supersede 现有含义。缺投影的历史记录保持未证明，不获得新授权。
若未来 Core 消费能力停用，原 Svc case/STOP/UNKNOWN 和持久责任仍保留；停用不是取消
或补偿。实际发布/回滚须另有授权，本 proposal 不执行任何迁移或运行操作。

| UNKNOWN | 关闭所需证据 / 责任方 | 当前限制 |
|---|---|---|
| 跨仓 Svc 真实收件面、渠道验真、canonical Human 映射和当前指定受权答复关系 | Svc/渠道所属 accepted 合同、exact revision、隔离真实接线与鉴权证明 | 不声称任一现有 Forum/消息/API 已满足协议 |
| managed HUMAN_REQUIRED 的实际合法后继、receipt/verification resolve link 投影与读取授权 | Svc 权威、actual require_effect/STARTED REVIEW effect、命令/DTO/receipt 与 guard 反例 | 普通 owner_action 不推出 managed 可达；不放宽 guard；依赖实施与跨仓 acceptance 未完成 |
| #1378 持久 obligation 后继、到期后继、实际事件重发现与 DB 唯一性/原子 join | Svc writer 的 accepted authority/base、真实 DB 并发/崩溃/事务证据 | 不把任务书、stub 或逻辑 identity 当 DB 唯一性 PASS |
| 通知真人送达、真实人答复、resolve、原任务执行与业务满足 | 后续授权运行的各阶段 receipt/readback 与独立验收 | 全部 UNKNOWN / NOT_RUN，不宣称无人值守闭环 |

## 13A. 依赖边界

Core 消费合同接受 ≠ 全链路解阻。即使本 proposal 后续获 Owner 接受，Svc 侧所属合同、
实施 base 与真实接线未闭合前，仍不得声称 HUMAN_GATE 已可用或解除 managed 阻塞。
当前各项均如实保留 `UNKNOWN`：

| 外部依赖 | 当前状态 / 责任线 | 对 Core 消费的限制 |
|---|---|---|
| Svc 真实收件面、HUMAN_GATE 群路由及渠道验真 | UNKNOWN；Svc/渠道所属方，#1352 协议线 | 裁定已核验不等于渠道送达或存在受权消费者 |
| 外部身份→canonical HUMAN、Owner 指定域 owner/当前 case 授权关系映射 | UNKNOWN；Svc/身份所属方 | 不凭群成员、显示名、消息验真或正文自报授予代答/resolve 权限 |
| verification receipt→原 escalation→合法 resolve receipt/Event 的 resolve link 与读授权 | UNKNOWN；Svc 协议线 | Core 不自签关联、不造 resolved Event、无足够证明不消费 WEC008 |
| opted-in managed HUMAN_REQUIRED 的合法后继 | UNKNOWN；Svc #1378/#1352 责任线 | 保留 require_effect/真实 STARTED REVIEW effect 和直接 resolve guard；普通路径支持不等于 managed 已解阻 |
| 原 escalationAt、未 resolve 责任、24h 持久升级再提醒、失败结果与重启后重发现接线 | UNKNOWN；Svc 现有责任/通知机制，#1378/#1352 | 仅 OVERDUE 不合格；Core 不增加持久 case/timer/后继引擎补缺 |
| paired accepted authority exact revision、真实 DB 唯一性/原子 join 与全链路 receipt | UNKNOWN；Svc writer/后续独立验收 | 不把此 Core proposal、文档检查或测试定义标为跨仓实现/运行 PASS |

## 14. Open questions and authoring boundary

无须重决 HUMAN_GATE、指定域 Owner、24h 三项意向。Svc 收件/解析/事务的具体 wire 与
权威修订待所属仓库闭合，不能由本 Core 文档自签；这是依赖 readiness gap，不是产品
实现许可。任何后续方案若改变 accepted guard、STOP、权限或 ownership，须单独重新
PREFLIGHT，不得将其称为本提案细节而修改原 accepted 意义。

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = AMEND (bounded revision of the existing proposed authority)
AUTHORITY_OWNERSHIP = resolved (Core consumer; Svc-owned producer remains external dependency)
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO (this new protocol)
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V2
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED (reply authorization and cross-repository protocol)
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_AUTHORITY = contracts (proposal only; not active)
PRODUCTION_APPLY_AUTHORITY = none
PARTIAL_SUPERSESSION = NONE
OPEN_OWNER_DECISIONS = NONE for the three task-supplied intentions
NORMATIVE_TBD = Svc-owned receive/resolve wire and paired accepted authority revision
CONTRACT_COUNT = 8
CONTRACTS_WITH_ACCEPTANCE = 8
AUTHORING_READY_FOR_REVIEW = YES (proposal with explicit external dependency gaps)
IMPLEMENTATION_ALLOWED = NO (new protocol not accepted; Svc dependencies unresolved)
MERGE_READY = NO (no authorized acceptance)
OPERATION_ALLOWED = NO
NEXT_ACTION = REVIEW
```
