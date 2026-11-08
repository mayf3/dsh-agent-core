---
spec_id: AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5
status: accepted
accepted_by: mayf3
accepted_date: 2026-11-08
accepted_at: 2026-11-08T00:00:00Z
acceptance_authority: Owner mayf3 ruling owner-20261108-three-unified items[1]
acceptance_authority_source: /Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json
acceptance_authority_selector: $.rulings[id=owner-20261108-three-unified].items[1]
acceptance_authority_canonical_sha256: 00f1fb2995d5f83a3bb9f50f442754fadb13f46274c2f1cbafd5f90253d5b218
acceptance_reviewed_head: e6e326986febeaaef7e51a632d0862fa7fc9099e
acceptance_qualifier: >-
  Implementation of new reason RECOVERY_REFUSAL_TERMINAL gated on Svc paired
  authority formal acceptance; production use gated on deployment authorization.
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
authority_action: SUPERSEDE
repository: mayf3/dsh-agent-core
date: 2026-11-08
authoring_base: b6ddc2a67ba041b8b13ed33d331104cf809d4985
scope:
  - complete effective WEC V4 authority
  - bounded refused-terminal system Assistance branch and responsibility projection
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_WORKSPACE_SESSION_MODEL_V3
  - SCHEDULER_OCCURRENCE_OUTCOME_V3
  - AGENT_CORE_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V2
  - AGENT_CORE_REFUSAL_TERMINAL_HANDOFF_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_EXECUTION_CONTROL_V3
    revision: b5096782f666ad22aa3508fdbf9562278a977c0f
    relation: constrained_by
supersedes:
  - AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4
superseded_by: null
owners: [mayf3]
---

# AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5

**当前：已按 Owner mayf3 `owner-20261108-three-unified` items[1] 完成 accepted-contracts 接受事务（PR #664）。**
`implementation_authority: contracts`，`production_apply_authority: none`；本次仅对齐已发生的接受记录。
新 `RECOVERY_REFUSAL_TERMINAL` reason 的实施仍须 Svc 配套权威正式接受并进入各自实施 base，按 §12 保留配套与生产授权闸门。

## 1. Goal

完整继承当前 WEC V4，将 RTH V1 已限定接受的 `RECOVERY_REFUSAL_TERMINAL` 系统责任
交接接入同一 WEC 实施权威。原执行失败、终态和业务 UNKNOWN 保持，Owner 接收责任不成为
执行成功或恢复许可。与完整恢复后继 PPR V2 配对，不创建第二执行模型。

## 2. Scope and non-goals

附录 A 携带 WEC V4 全部正文、十项 Contract、全部 Acceptance 和既有有效修订。
唯一新增协议是 PPR V2 §9.2 六项 RTH Contract 所限定的 B2 terminal refusal 责任分支。
不承接 #643 aging reason，不扩 ordinary planned/stale/Owner-resume，不承接 #650 a/b closure、
#1379 传输实现，不创建账本/queue/controller，不改变 Grant、身份、业务 transition 或生产状态。
WEC4 的两类远端 collection 解锁例外、fresh replay/终检与实际双 writer 验收完整保留。

## 3. Authority and dependencies

授权为用户 BRIEF-RTH-CORE-SUCCESSOR 及 accepted Standing Delegation V1 `CTR-SOD-003`
原 §3B；Owner `owner-20261107-four-pr-rulings.items[2]`（③）限定接受 RTH 语义。
原 `owner-20261107-five-decisions.items[2]`（③）涉及 #643 aging，不能误作 RTH 裁定。
来源 selectors/canonical hashes 与 fresh main 核对见 [收据](../../RECEIPT-RTH-CORE-SUCCESSOR.md)。

路线 `SUPERSEDE / BRIEF / CONTROLLED / AUTHORITY_AUTHORING`，docs-first。
RTH V1 §3.1 明确要求 owning WEC4/PPR 整权后继；SPEC_FORMAT_V0 §14 不允许用 NEW 或
PPR V1 AMEND 改变 closed reason、终态追加或旧 resume 的通过集合。

配对本仓候选为 `AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V2`（PPR V2）。本候选不将
RTH V1、PPR V1、WAE3、Liveness1 或 SRE 退休；仅拟整体替代 WEC4。RTH V1 保留
accepted/none 语义来源角色。PPR V2 单独完整替代 PPR V1；旧 WAE3/Liveness1 的历史退休链不分叉。

上述 Svc reference 绑定已接受的**现有限制**，不声明它支持新协议。当前 V3 不接受新 reason、
historical/closed 责任 case，resume evidence 也不是交接回执。未来须以 Svc 所属完整后继
承接接收/幂等读回/答复/消费者，并绑定真实 accepted ID、reviewed head、main SHA/Contract。
本文件不预造 Svc ID 或权限；配对未完成时本 reason 的实现继续为 NO。

## 4. Current State

`STATE-WEC5-001` — subject=Core 本地接受权威及本提案；as_of_commit=
`b6ddc2a67ba041b8b13ed33d331104cf809d4985`；environment=隔离 docs worktree
`/private/tmp/h1377-minimpl`、`docs/rth-core-successor`；observed_at=2026-11-07T21:33:34Z。
WEC4/PPR1/RTH1 的 #655→#657→#658 已为该基线祖先；RTH 为 accepted/none。
附录保留的“未合 main”等是来源时点，不是当前状态。Basis: OBS-WEC5-001/002、EVD-WEC5-001。
源码、装载、运行、业务与无人值守验收均未在本任务执行。

## 5. Observations

- `OBS-WEC5-001` — 在上述时间/环境，以 git ancestry、frontmatter/正文和 SHA256 只读核对
  WEC4/PPR1/RTH1；结果及文件/来源 body hashes 见收据。WEC4 的新 reason 分支尚无实施权。
- `OBS-WEC5-002` — fresh Core main=`b177d3fcce3febb09711135c145cc4b43e63aa8e`，仅新增 #663
  实施源码/测试/证据；受影响权威、治理及 Current Decisions 字节未变。Svc main=
  `b5096782f666ad22aa3508fdbf9562278a977c0f` 的 WEC V3 仍是两旧 reason/current 门。
  方法、固定链接和读取限制见收据；没有 DB 或运行时观察。

## 6. Claims and assumptions

- `CLM-WEC5-001 (SUPPORTED)` — 必须整体替代当前 WEC4，不能通过独立 NEW 实施 Spec
  绕过它。支持 EVD-WEC5-001；反证无；限于该基线 authority authoring。
- `CLM-WEC5-002 (SUPPORTED)` — Core 本候选单独接受仍不足以启用新 reason，Svc 和 PPR
  配对为独立实施闸门。支持 EVD-WEC5-002；不推定服务、旧 binary 或生产能力。

## 7. Evidence relations

| Evidence | Source / target / relation | Coordinates, sufficiency, limitations / provenance |
|---|---|---|
| EVD-WEC5-001 | OBS-WEC5-001 → STATE-WEC5-001、CLM-WEC5-001 / SUPPORTS | 本 authoring base 的 RTH §3.1、WEC4 CTR-WEC1-005/008、SPEC_FORMAT §14；足以路由，非实现证据；收据固定 hash/坐标 |
| EVD-WEC5-002 | OBS-WEC5-002 → CLM-WEC5-002 / SUPPORTS | 固定 Core/Svc main 源码文档只读；足以识别未承接协议，不证明运行态；收据 Svc crosswalk |

## 8. Decisions

`DEC-WEC5-001 (PROPOSED, owner=mayf3)`：WEC4 完整整权后继；仅在现有系统 Assistance
入口新增独立 reason 分支，使用 PPR V2 携入的封闭 RTH 协议，不扩大旧 reason 或 resume。
`DEC-WEC5-002 (PROPOSED, owner=mayf3)`：责任状态单独投影，失败保原自动责任；只接受
真实 actor、历史关系、收据及消费者证据。接受和配套入 base 前零实施。

有效组合顺序为高优先级父权威 → 附录 A 的完整 WEC4 有效义务 → 下列精确差量。
所有 carried Contract 的本候选全局 ID 为 `AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5#<原本地ID>`；
旧全局 ID 和原义永久保留。附录中的生命周期、旧 authoring mandate/实施结果、旧代 Spec ID
均为来源历史，不授本提案实施权；其未变产品义务与验收完整携带。
来源 authoring-only 的 Spec 名称、版本、旧前驱退休清单和旧 PR 操作不是本次重演任务；
本次文档/接受生命周期以 ACC-WEC5-001/§12 为准。继承的产品正负测试与实际双 writer 门不减。

| WEC4 coordinate @ authoring base | 本后继的有效处置 |
|---|---|
| CTR-WEC1-005（377–394） | 保留两旧 exhaustion 触发/入口/wake/失败门；新增 RTH 独立分支，不能伪装到限，不将原 Owner wake 当历史 executor |
| CTR-WEC1-002（326–348）、007（406–427） | 原执行投影完整保留；RTH 仅附属责任状态，不覆盖 UNKNOWN/终态/SETTLED 归因，不新增 forum 或传输平台 |
| CTR-WEC1-008（429–545） | 全部 RETAIN：旧两 ingress、两 reason、ACTIVE/current/settled/baseline/单代 permit；明确排除 RTH，旧 DTO 不改 |
| CTR-WEC4-010（552–660）、其余所有 Contract/数据/API/Acceptance | 全部 RETAIN；RTH 不取得新的解锁、due DTO、Router、Scheduler 或业务写权限 |

## 9. Contracts

### 9.1 Complete inherited obligations

附录 A 是 authoring base 中 WEC4 frontmatter 后全部正文的逐字副本，不以链接代替完整义务。
除 §8 和以下三项显式差量，十项 inherited Contracts 及全部有效修订、负控和验收不删改。

### CTR-WEC5-011 — Bounded system refusal branch

未来获权的 Core 系统 producer MUST 仅在配对 PPR V2 `CTR-RTH-001..006` 全部成立时，
通过既有 runtime-only `workflow_execution_escalation.create` 使用
`RECOVERY_REFUSAL_TERMINAL`。MUST 使用其中原身份、封闭 DTO、可信 refusal/cadence、
稳定 intent/body/key、同意图幂等收据/历史查询与真实 system Principal。四类 refusal 的
严格关系验证及 discrepancy-only 只按该协议，不授任意错误 owner 写资格。
不满足/不支持/冲突 MUST 保留原责任及 durable next-check，不能降级旧 reason/换身份或重发业务。
普通 assignee Assistance 与两旧 exhaustion reason 的前置和 wire 语义保持不变。

### CTR-WEC5-012 — Responsibility projection cannot authorize execution

RTH 的 case/receipt/接收/HANDED_OFF/resolve MUST 只投影责任交接事实，不改原 terminal
verdict、attempt phase/generation、UNKNOWN 或业务归因。`CTR-WEC1-008` 消费者 MUST
拒绝本 reason 和本 receipt 作为 resume/admission permit；不得把历史交接读回塞进旧
active owner-assistance-resume-evidence DTO。Owner wake 沿合法 `wfassist-<caseId>`、
`inter_agent`、目标 Owner 自身身份与 canonical main；不得冒称原 executor 的 workflow_execution。
入队/ACK/仅 case ID 不等于接收；不全链即保持 PENDING/原责任，移交后仍须原消费者监测。
MUST 遵守 Svc 已接受的 request-time pinned Owner-consumer policy、opt-in 路由及
source-retirement 门；不能以直接 wake 绕过 opted-in 工作流或向已退休 source 新发业务效果。
配套 Svc 未决定 historical RTH 与这些门的关系时，按 CTR-WEC5-013 保责、不开新 producer。

### CTR-WEC5-013 — Paired authority and compatibility gate

RTH 分支的实现/启用 MUST 等到 WEC5、PPR2 正式 accepted/contracts 和所需 Svc 配套
accepted Contracts 分别进入各自实施 base，并由独立记录绑定 exact ID/Contract/main SHA。
Core 单方接受不能解除 Svc CURRENT/nonterminal/鉴权门。本提案声明 none 不改变既有
accepted WEC4 在当前 base 的实施权限；未来 whole retirement 必须保全其 contracts 权限。
服务/reader/consumer 未资格或旧 binary 未证明 fail closed 时 MUST 不启用新 producer。
回滚 MUST 保留原 ledger、真实命令事实、UNKNOWN、未完责任及再触发，不恢复旧业务投递。

## 10. Acceptance

除文档检查外全部是未来测试定义，当前 NOT_RUN。正式实现须隔离持久存储、正式入口，
记录 Core/Svc exact bases/heads、配置/时钟/输入、实际调用数、ledger/收据/重启读回和 result/rc。

| Acceptance | Contracts | Method / environment | Required evidence | Expected result / failure condition |
|---|---|---|---|---|
| ACC-WEC5-001 | 十项 inherited Contracts；CTR-WEC5-011..013 | 非作者固定 head 文档审查、source-body 比对、语法/lifecycle 检查 | 基线与 source hashes、真实 reviewed SHA、完整 carry、双向覆盖、diff | 完整继任、proposed/none；误激活/遗漏/偷改旧 ID 即失败 |
| ACC-WEC5-002 | CTR-WEC1-001..008、CTR-WEC4-009/010、CTR-WEC5-012 | 继承附录 A 全部 Acceptance，负控新增 RTH receipt/resolve 送入 resume | 原 trace/policy/DTO/WAL/permit 测试、实际双 writer 隔离持久证明；resume/admission count | 原 gate 不变；RTH 零恢复/零新代/零业务 settlement；否则失败 |
| ACC-WEC5-003 | CTR-WEC5-011/012 | PPR2 ACC-RTH-002..007 正式系统入口与持久服务集成 | 四类合法 refusal、假 actor/错历史/closed/无 Owner、ACK-only/丢回包/错 reply/重启、保护状态 hashes | 新 branch 才可处置历史责任；失败保责，旧门不松动；假接收/业务 replay 即失败 |
| ACC-WEC5-004 | CTR-WEC5-011..013 | 配套缺失/旧 Svc/旧 Core/未知 version/回滚矩阵及独立配对核验 | 每份 accepted authority/base、DTO validation、未启用证据、重启和完整责任前缀 | 缺一门不启用；无降级/换 key/丢责任；未经实测不得兼容 PASS |

反向覆盖：十项 inherited Contracts → ACC-WEC5-001/002 及附录原逐项表；
CTR-WEC5-011 → 001/003/004；012 → 001/002/003/004；013 → 001/004。13/13 有验收定义。

## 11. Alternatives and disposition

- 独立 NEW 实施 Spec：拒绝；不能改 owning WEC/PPR 的既有禁止。
- PPR V1 additive AMEND：拒绝；新 reason/terminal 例外改变 accepted 通过集合。
- 单份同时完整替代 WEC4+PPR1：合法备选；推荐两份 whole successors，保持控制与恢复各自可审边界，配对激活。
- RETAIN：唯一 ledger、旧 producer/消费者、身份/Grant、旧 read/resume DTO、PPR planned proof、历史证据。
  MIGRATE：未来获权时本 reason 进入既有系统入口和原 due poller refused 分支；不新增永久 fallback/映射。

## 12. Migration, compatibility, and rollback

本次只新增 proposed 文件与收据，不修改 WEC4/PPR1/RTH1 或 current pointer。
未来接受须另做 docs-only 原子事务：Owner 绑定已审 head/hash；本 WEC5 与 PPR2
均设 accepted/contracts/production none；WEC4→WEC5、PPR1→PPR2 互斥回链同步完成。
WEC5 的 current recovery 依赖改指 PPR2；PPR2 的 WEC 依赖指 WEC5；共享父权威不得互相
governed_by 成环。Spec index/local current pointers、ASM two-kind provenance、SRE scoped-effect
carrier、RBAH/RTH 的 current dependency notices 只迁移载体，不能偷改其 accepted 语义/权限。
先核 fresh main 和并行 successor；冲突停止依赖接受，不能选择新旧二选一默认通过。

独立语义审查与 final-head delta 复核、接受者真实权限及 main 合入均另行记录。
Svc 后继和各 base 配对前 RTH 仍不可实施；现有无关 accepted 合同内工作不因此冻结。
后续新任务 RE_PREFLIGHT/REUSE→隔离实现/验收→合法发布，分别记录；本 PR 不实现/接受/合并。
旧事件不 bulk 改写；停用仍保留 RTH 服务事实和可接续消费者，不重新激活被退休权威。

## 13. Open questions

- Owner 后续接受本精确候选与 PPR2；本次只交 proposed，不借 §3B 自我接受。
- Svc 配对 successor ID/Contracts/接受 head/main SHA 当前 REQUIRED/UNKNOWN；须独立接受其
  historical/closed/discrepancy-only 接收、同意图读回、Owner inbox/action/reply 与 Owner 变更处置。
  本 Core 规范的安全结果已封闭：配套缺失或不能证明合法接收时保责、零启用，不凭聊天补权限。
- 实际 writer/reader/consumer/installed bindings 与运行验收 UNKNOWN；未来证据门，非本次 PASS。

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
MERGE_READY = NO (acceptance not executed)
OPERATION_ALLOWED = NO
OPEN_OWNER_DECISIONS = exact proposed acceptance; paired Svc acceptance
NORMATIVE_TBD = NONE_IN_CORE_DESIGN (Svc acceptance is a closed implementation gate)
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 13
CONTRACTS_WITH_ACCEPTANCE = 13
AUTHORING_READY_FOR_REVIEW = YES
DONE_WHEN = proposed docs + independent review + receipt + commit/push + open base-main PR; no merge
EXPANSION_TRIGGER = authority conflict beyond declared delta; failed required check; non-doc need
FAILURE_ACTION = STOP dependent work and append STOPPED-1377-MINIMPL.md
NEXT_ACTION = REVIEW
```

## Appendix A — Complete WEC V4 carried source

Source: `AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4` @ authoring base; frontmatter excluded.
SHA256: `e4bebaa6188bf8a65a8e5d14f1727580c603c1750573ae60ad744febed5249aa`.
Effective composition and history handling: §8. The following source is complete and byte-preserved.

<!-- BEGIN COMPLETE WEC4 SOURCE -->

<!-- R4_WEC_CURRENT_RECOVERY_OWNER -->
> Current recovery ownership resolves WAE3 and Liveness1 references through their complete
> successor PPR V1 after ordered #655/#657 main activation. Historical references and WEC4
> Contracts remain unchanged; only two designated collection reads use the bounded lock exception.
<!-- END R4_WEC_CURRENT_RECOVERY_OWNER -->

# AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4

Standalone whole-authority **accepted transaction**, recorded for Owner mayf3 under
ruling ④ and standing delegation §3B after independent semantic PASS at
`176161f0651847d20a012fb797389b438e11a593`. Its implementation authority is
`contracts`; production apply remains `none`. WEC V3 is retired with reciprocal
links in this same transaction. This branch is not main activation: until PR #655
is merged after independent final-HEAD review, main's predecessor remains controlling.
The complete WEC V3 contract surface is carried; the only product behavior delta
is the two remote-read timings in `CTR-WEC1-008`, completed by `CTR-WEC4-010`.
V3's Contracts and historical acceptance provenance remain untouched.

A Contract's global identity is `<SPEC_ID>#<CONTRACT_ID>` (SPEC_FORMAT_V0 §4).
Thus this proposal's `AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4#CTR-WEC1-008`
is a new identity. The accepted
`AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3#CTR-WEC1-008` retains its original
meaning forever. Local suffixes for carried Contracts and Acceptance items
are retained for traceability; they refer to V4 within this document.

## 1. Goal

The workflow control plane must be able to answer, from system-owned facts
alone: which NodeVisit is dispatched to whom, at which generation, in which
session the Run happened, whether the Run really occurred, why nothing
completed, and when Domain Owner attention or an explicit human escalation
exists. The Agent never reports any of these; the system derives them. This
Spec is the dsh-agent-core slice: it exposes the existing execution ledger as
a stable read model, adds a deterministic execution-state projection,
extends the stale-reentry exception with bounded policy-driven continuation
for `run_ended_no_submission`, opens OWNER_PENDING assistance at the attempt
limit, durably wakes the authoritative Domain Owner, accepts push-first kicks,
and projects execution facts as human-readable forum messages. It creates NO second execution ledger and NO second
duplicate fence.


The bounded successor goal is to release the existing Core admission lock
while the remote pre-plan and Owner-resume evidence reads wait, then reacquire
it and reject stale observations before planning. This is a proposal of the
rules, not evidence that #1366's performance or implementation goal is met.

## 2. Scope and non-goals

The complete inherited frozen boundaries are preserved verbatim:

- BUSINESS_STALENESS != EXECUTION_TERMINATION (AGENT_CORE_WORKFLOW_STALE_REENTRY_V2):
  the unknown fence is absolute. `outcome_unknown` is never policy-retried;
  C-013/015/016 termination-evidence discipline stands byte-for-byte.
- One attempt per NodeVisit (`beginAttemptIfAbsent`); generation N+1 only
  supersedes a terminal attempt through the SAME fence; the CTR-SRE-004
  quiescence gate stands.
- The ledger (`attempts.jsonl`, append-only) stays the only execution
  evidence store. Everything in this Spec is a projection, a policy gate,
  or an outbound projection — never a second store of record.
- Router admission seam, reconciliation store, and session semantics are
  read-only from here.


The complete WEC V3 scope is retained. Only these two remote collection reads
change timing: (1) every new attempt's fresh pre-plan activation/visit/assignee
and version read, and (2) the Owner-resume evidence request using the exact
predecessor ID and its durable baseline. The mandatory revalidation below
bounds that change; it grants no unlocked mutation or delivery.

All other lock-held segments retain their accepted meaning, including policy
classification, Principal resolution/admission gates, the atomic planned
append and permit consumption, write-ahead `delivery_started`, Router delivery,
completion events, post-delivery detail capture and restart recovery checks.
In particular, SRE V2 `CTR-SRE-002`'s post-delivery
`workflowStateVersionAtDispatch` read remains inside the existing admission
completion callback. The two baselines MUST NOT be substituted for one another.

Non-goals: overall lock architecture, a second ledger/lock service, lock splitting,
Svc Domain/store lock changes, new APIs/DTO fields/epochs/CAS protocols,
permission or identity expansion, automatic retry, UNKNOWN replay, source or
test implementation, production writes, deployment, acceptance or merge.
No work from #1367 or #1358 is reopened.

## 3. Authority and dependencies

The authoring base is `24974c720d634b965943e08bfd0862657b9be0e1` in
`mayf3/dsh-agent-core`. Product Architecture retains the thin Core/external
Workflow ownership boundary. D-009 and D009_ALIGNMENT retain business-outcome
versus termination separation and zero authoritative writes without evidence.
The current Owner Workflows V2, WAE V3, SRE V2 and Recovery Liveness V1 remain
independent constraints; this proposal supersedes none of them. V3's historical
Owner Workflows V1 references resolve through the accepted V1→V2 lifecycle
edge for current context; this preparation changes no predecessor metadata or
accepted meaning. The separately reviewed acceptance transaction changes only
V3 lifecycle metadata and its retirement notice, retaining the original body.

The required route is `SUPERSEDE + BRIEF + DURABLE`, `AUTHORITY_AUTHORING`,
docs-first. The original R3 authoring mandate and R1/R2 stop lineage remain in
`RECEIPT-1366-SUPERSEDE.md`. The R4 succession continuation authorizes this bounded
revision, independent semantic review, then the docs-only Owner acceptance
transaction on PR #655. Owner ruling `owner-20261107-four-pr-rulings` ④ chooses
the bounded semantics and preserves Contracts source authority; accepted
`AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1` §9 `CTR-SOD-003` (original §3B)
delegates the formal transaction. Neither the worker nor this task becomes the
Product Authority. Exact issuer, source selectors/hashes, reviewed candidate and
final acceptance coordinates belong in the step2 acceptance record. No merge,
product implementation, or production write is authorized in this R4 task.
SPEC_FORMAT_V0 §§2.7,14.1–14.3 and the local ban on new partial supersession
require a complete successor and atomic reciprocal lifecycle transaction.

### Svc pairing and trust boundary

The approved current read-only companion is
`SVC_WORKFLOW_EXECUTION_CONTROL_V3#CTR-SWEC-010` at Svc #131 merge
`8da8dbcb70e700d9e35970e8b662b1be2c29afdc` (Git blob
`7c6c5d1de1d1f6e1a580521f01fce90f1c2de2b2`), as recorded in `OBS-WEC4-003`.
Svc V2 is superseded with its reciprocal V3 backlink; V1→V2→V3 history is retained.
The V3 and predecessor V2 `CTR-SWEC-010` bytes are identical at these approved
coordinates. Its closed DTO, canonical persisted provenance, selection, roles
and lack of a consumption write are unchanged. Historical `OBS-WEC4-002`
retains its original V2 observation; it is not the current companion pointer.
This proposal changes no Svc store transaction, Domain lock or external Contract;
Core's file OwnerLock is not a Svc Domain lock. This is not a paired acceptance
or an audit of the running Svc store. A later implementation must recheck the
actual accepted paired authorities and prove that its chosen validation uses
existing authoritative surfaces. If that proof needs a new Svc lock, epoch,
DTO, CAS, binding or protocol, stop that dependent work and re-PREFLIGHT for
separate paired authority; this document does not authorize it.

The reviewed semantic preparation was proposed/none/none. This formal accepted
transaction declares `implementation_authority: contracts` and
`production_apply_authority: none`, consistently with the §12 lifecycle. Once that accepted
revision is present in a later implementation base, a separately authorized
`REUSE` task may implement within these Contracts; it must satisfy every
applicable evidence gate. It cannot use retired V3 to bypass V4's constraints.
This docs-only acceptance preparation executes no code or product tests.
`ACC-WEC4-003`'s actual dual-writer/isolated persistent-store proof remains
mandatory for implementation conformance and any concurrency-improvement claim;
static semantic review does not satisfy it. Performance is UNMEASURED.

## 4. Current State

### STATE-WEC4-001 — Authoring coordinates only

- Subject: WEC authority in the Core authoring checkout.
- As of commit: `24974c720d634b965943e08bfd0862657b9be0e1`.
- Environment: isolated `/private/tmp/h1366-lockscope`, docs-only branch.
- Observed at: 2026-11-07T12:35:29Z (authoring preflight snapshot).
- Projection: WEC V3 is accepted with no successor backlink; V4 is proposed.
  Changed read timing is not accepted or implemented by this work.
- Basis: `OBS-WEC4-001`; actual checks and final coordinates are in
  `RECEIPT-1366-SUPERSEDE.md`. Product concurrency tests are NOT_RUN; production
  state and business outcome were not inspected and remain UNKNOWN.

## 5. Observations

### OBS-WEC4-001 — Accepted lock obligations and lifecycle readback

- Subject/source: Core WEC V3, SRE V2, local governance and SPEC_FORMAT_V0.
- Source revision: Core `24974c720d634b965943e08bfd0862657b9be0e1`.
- Environment/time: local read-only source inspection, 2026-11-07T12:35:29Z.
- Method/result: WEC V3 lines 222–227 require a locked pre-plan read and
  lines 259–265 require locked evidence; SRE V2 lines 179–188 retain locked
  post-delivery detail capture. SPEC_FORMAT_V0 §14 routes changed accepted
  meaning through SUPERSEDE. Remote `main` readback matched this Core base.
- Provenance: those exact Git source files; receipt and R2 stop record hashes.

### OBS-WEC4-002 — Svc companion source, not runtime

- Subject/source: Svc `SVC_WORKFLOW_EXECUTION_CONTROL_V2#CTR-SWEC-010`.
- Source revision: `d4c510d94f8929f5377989bd69229d611ab49304`, blob above.
- Environment/time: GitHub connector read and remote main-ref readback,
  2026-11-07 authoring preflight.
- Method/result: accepted whole successor; canonical consistent service read,
  exact closed evidence shape, current active identity, event/version ordering
  and zero consumption writes. No cross-service atomic snapshot is promised.
- Provenance: pinned GitHub source link in the receipt. No DB/runtime access.

### OBS-WEC4-003 — Approved current Svc companion and reciprocal lifecycle

- Subject/source: Svc WEC V3 `CTR-SWEC-010`, V2 retirement and current indexes.
- Source revision: Svc #131 merge `8da8dbcb70e700d9e35970e8b662b1be2c29afdc`;
  V3 blob `7c6c5d1de1d1f6e1a580521f01fce90f1c2de2b2`, V2 blob
  `e528b2f10733f48187ef88a99e696f9df0c5bed3`.
- Environment/time: reuse of the completed R2 source approval recorded at
  `2026-11-07T15:46:09.453460+00:00`, inspected locally for this R4 preparation;
  no fresh Svc runtime or database inspection is claimed.
- Method/result: R2's fixed source inventory and independent byte comparison
  establish V3 accepted/contracts/production none, V2 superseded→V3, retained
  V1→V2→V3 history and both synchronized indexes; V3/V2 `CTR-SWEC-010` bytes match.
  This closes the historical `d4c510d9` lifecycle conflict without rewriting it.
- Provenance: Core `5df19f5f5ab0251088c27d9657ace66b9e0a3425`,
  `SUCCESSION-ORDER-AND-CONFLICTS.md` §2 and
  `docs/evidence/succession-order/r2/svc-authority.json`; source approval only,
  not permission for aging/refusal protocols or proof of store conformance.

## 6. Claims and assumptions

### CLM-WEC4-001 — The timing change requires whole succession

- Support state: SUPPORTED.
- Supported by evidence: `EVD-WEC4-001`.
- Contradicted by evidence: none found on the affected surface.
- Uncertainty: document review supports routing only, not implemented safety or
  performance. Authoritative external revalidation is a required acceptance
  obligation, not an assumption that an unchanged local revision proves it.

## 7. Evidence relations

### EVD-WEC4-001 — Exact accepted text supports SUPERSEDE routing

- Source observations: `OBS-WEC4-001`, `OBS-WEC4-002`.
- Target: `CLM-WEC4-001`.
- Relation: SUPPORTS.
- Bound coordinates: the Core and Svc source revisions and environments above.
- Strength/sufficiency: sufficient for the bounded authority comparison and
  unchanged companion interface inventory.
- Limitations: no implemented lock timing, concurrency, remote atomicity,
  source conformance, deployed capability or live business result is established.
- Provenance: pinned authority files, R2 stop lineage and this delivery receipt.

## 8. Decisions

### DEC-WEC4-001 — Complete successor with exactly two read-timing replacements

- Decision owner: mayf3 (bounded semantics chosen by Owner ruling ④; formal
  independent review and acceptance transaction remain separate).
- Decision proposed: replace the complete WEC V3 authority with this standalone
  body; change only the pre-plan/evidence collection timing and its exact
  revalidation/refusal requirements. Keep the remaining inherited clauses
  verbatim, including restart behavior and all other lock segments.
- Rejected alternatives: `ALT-WEC4-001..004` in §11.
- Reason: bounded concurrency improvement cannot be called an additive AMEND
  when accepted locked-read obligations are replaced.
- Owner decision remaining: none within ruling ④ and standing §3B's exact scope.
  The revised semantic candidate still requires non-author review; its real
  reviewed HEAD and final acceptance transaction must be recorded before merge.
  This preparation does not claim those steps have already passed.

| V3 surface | Disposition in this complete successor |
|---|---|
| Intent and frozen boundaries | PRESERVE verbatim in §§1–2 |
| CTR-WEC1-001..007 | PRESERVE verbatim in §9 |
| CTR-WEC1-008 two locked remote-read sentences | REPLACE only those spans; §9 plus CTR-WEC4-010 states complete new timing |
| CTR-WEC1-008 remaining text, DTO and restart paragraph | PRESERVE verbatim in §9 |
| V3 bounded managed intake/review delta | PRESERVE verbatim as CTR-WEC4-009; no new product obligation |
| Data model, API and test obligations | PRESERVE verbatim in §§9–10; add explicit acceptance mapping |
| V3 accepted status, original acceptance/ancestor provenance | RETAIN as history in V3 and Git, not as V4 acceptance or execution permission |
| WAE/SRE/recovery/D-009/Svc Contracts and other held-lock segments | RETAIN their separate accepted authority; no succession edge or semantic change |

No normative content is deferred to manual merging with V3. All eight inherited
Contracts, its managed-path delta, data/API obligations and tests appear below.
The proposed `none` and accepted `contracts` declarations are explicit lifecycle
metadata under Owner ruling ④; they do not widen this successor's Contracts or
grant production permission.

## 9. Contracts

### Carried WEC Contracts with the two explicit timing replacements

### CTR-WEC1-001 Execution trace read model

A pure projection module derives, from ledger facts only, per
`workflowInstanceId`:

```
{ workflowInstanceId, generatedAt, nodeVisits: [ {
    nodeVisitId, attemptId, generation, dispatchIntentId, ownerPrincipalId,
    agentId?, sessionId?, reconciliationHandle?, messageId?,
    executionState, attemptCount, escalation?,
    startedAt, updatedAt } ] }
```

- `attemptCount` = number of generations planned for the visit (system
  counted; never agent-reported).
- All fields come from the ledger projection; absent facts stay absent
  (no inference, no defaults that look like facts).

### CTR-WEC1-002 Execution state projection

`executionState` is deterministically derived per visit:

| Ledger facts | executionState |
|---|---|
| ACTIVE, phase `resolution_blocked` | `BLOCKED` |
| ACTIVE, phase `delivery_started` | `DISPATCHED` |
| ACTIVE, phase `run_delivered` | `RUNNING` |
| ACTIVE, phase `planned` | `DISPATCHED` |
| NEEDS_REVIEW, judgment `run_ended_no_submission` | `RUN_ENDED_NO_TRANSITION` |
| NEEDS_REVIEW, judgment `run_outcome_unknown` | `OUTCOME_UNKNOWN` |
| NEEDS_REVIEW, judgment `delivery_unverified` / `settle_check_unavailable` / `delivery_failed` phase | `OUTCOME_UNKNOWN` |
| NEEDS_REVIEW with recorded system assistance fact | `OWNER_PENDING` |
| terminal, judgment `stale_no_progress` | `STALE_NO_PROGRESS` |
| terminal SETTLED, judgment `business_commitment_observed` | `SETTLED` |
| terminal SETTLED, judgment `stale_no_progress` | `STALE_NO_PROGRESS` |

`ELIGIBLE` (due, not yet attempted) is a svc-workflow activation fact and is
deliberately NOT projected here. `HUMAN_REQUIRED` is also NOT inferred from
the dsh execution ledger: it exists only after an explicit Domain Owner
assistance escalation in authoritative svc-workflow state. The projection
never mutates the ledger.

### CTR-WEC1-003 HTTP trace surface

`GET /workflow-execution/traces?workflowInstanceId=<uuid>[&nodeVisitId=<uuid>]`
on the product-api loopback server (127.0.0.1:8787). Bearer-token gate
reusing the existing scheduler token verifier seam; unconfigured verifier or
any verification failure = 401 fail-closed; token must carry
`workflow.execute`. Errors use the frozen product-api envelope. Read-only.

### CTR-WEC1-004 Policy-driven continuation (run_ended_no_submission only)

Config: `maxAttemptsPerVisit` (default 3, min 1; env
`DSH_WORKFLOW_MAX_ATTEMPTS_PER_VISIT`), `retryDelayMs` (default 60_000; env
`DSH_WORKFLOW_RETRY_DELAY_MS`).

- A terminal NEEDS_REVIEW attempt with judgment `run_ended_no_submission`,
  unless it was admitted by CTR-WEC1-008 Owner-resume, becomes re-entry-eligible
  when `now - reconciled.atMs >= retryDelayMs`.
  Eligibility is realized through the EXISTING stale-reentry machinery: the
  reconcile second pass settles the visit's eligibility, and the due sweep
  mints generation N+1 through the same fence + quiescence gate.
- `run_outcome_unknown` NEVER becomes re-entry-eligible. No timeout, no
  policy, no operator convenience changes this.
- The automatic-continuation fence refuses to mint
  `generation > maxAttemptsPerVisit` (`cause: 'attempt_limit_reached'`).
  CTR-WEC1-008 supplies a distinct one-generation Owner authorization without
  resetting that automatic budget.

### CTR-WEC1-005 Attempt-limit owner assistance

When a visit's attempt limit is reached (a generation == maxAttempts attempt
settles NEEDS_REVIEW, or a stale settlement finds generation == maxAttempts),
the engine invokes `workflow_execution_escalation.create`. Authoritative
svc-workflow opens/replays one `OWNER_PENDING` case and returns
`{assistanceCaseId, ownerPrincipalId, ...}`. Agent Core resolves the exact
Principal UUID through the existing Principal→Agent authority, then delivers
one stable Domain Owner wake using request id `wfassist-<assistanceCaseId>` and
an `inter_agent` origin. It MUST NOT use `workflow_execution` origin, because
the Domain Owner is an exception handler, not the original NodeVisit executor.

Only after the owner wake is proven admitted (or already pending/settled under
the same request id) is the append-only escalation fact recorded in the
execution ledger. Resolution/wake failure is retried on a later pass; no blind
second prompt is sent after an outcome-unknown delivery whose caller
correlation proves admission. Domain Owner may resolve the assistance or
explicitly escalate it to `HUMAN_REQUIRED` through svc-workflow.

### CTR-WEC1-006 Push-first kick

`POST /workflow-execution/kicks` on the product-api loopback server: body
`{workflowInstanceId, nodeVisitId, dispatchIntentId}` (all UUID). Gated like
CTR-WEC1-003. Effect: ONE coalesced engine poll trigger (a poll already in
flight or armed coalesces — kicks never stack). The kick is a latency
optimization ONLY: the poll loop remains the correctness path; a lost or
dropped kick is invisible to semantics. No new duplicate lock is introduced
(any double trigger meets the existing one-attempt fence).

### CTR-WEC1-007 Forum execution-event projection

A forum projection module converts ledger lifecycle events into
human-readable messages on the canonical workflow thread:

- Thread resolution: `forum_threads.list` broker capability with
  `contextType=workflow_instance&contextId=<workflowInstanceId>` (manifest
  query list widened additively). The module NEVER creates threads — the
  canonical binding is owned by svc-workflow. No thread found ⇒ skip and
  retry later.
- Message: `forum_threads.reply` with `kind=comment` and metadata
  `{workflowInstanceId, nodeVisitId, eventKey, eventType}`. `eventKey` is
  the sha256 of the raw ledger line — the dedupe identity. Posted keys are
  persisted in `<workflowExecutionDir>/forum-projection-state.json`
  (offset + posted-key window) so restart does not re-post or skip.
- Posting failures never propagate into the engine, the ledger, or any
  execution decision. A periodic reconcile pass re-scans the bounded tail
  of the ledger for unposted events.
- Events covered: attempt planned (dispatched to Agent X, #N), run
  delivered (session linked), run ended without transition, delivery
  failed / resolution blocked (execution blocked), stale superseded, attempt
  limit owner-attention request (OWNER_PENDING), reconciled settled.

### CTR-WEC1-008 Owner-resolved same-visit resume

An explicit authorized Domain Owner resolve may authorize exactly one next
generation for the same active dispatch intent, workflow instance, visit,
and assignee Principal. The predecessor MUST be the latest attempt, terminal
`NEEDS_REVIEW/run_ended_no_submission`, with known delivery and a fresh
Router reconciliation result positively `settled`. Pending, unknown,
unavailable or ambiguous delivery/execution facts, including
`run_outcome_unknown`, are ineligible. The broader stale-path quiescence
alternatives do not substitute for this path's positive settled proof.

The two eligible ingress kinds are an ordinary Assistance request opened by
the authenticated current assignee, and CTR-WEC1-005 `execution_policy`
assistance. The policy requester is not presumed to be the executor. In both
cases svc must attest an explicit resolve authorized for the exact Domain;
no extra rule requires the Domain Owner and executor to be different
Principals. Neither model/prompt text nor elapsed time grants permission.

Before appending `attempt_planned` for EVERY new attempt (generation 1,
stale re-entry, and Owner-resume), Core MUST perform a fresh pre-plan read of
the exact current activation/visit/assignee and workflow state version. Core
MUST release the existing ledger admission lock for this remote pre-plan
read, then reacquire that lock and exactly revalidate the bound local and
authoritative external preconditions under CTR-WEC4-010 before any append.
Changed, unavailable or ambiguous preconditions reject the old unlocked
result through the existing zero-mint/zero-delivery refusal path. It durably records that version
as `preDeliveryWorkflowStateVersion` in the same planned append, before any
Router delivery invocation. Failed or mismatching reads mint and deliver
nothing. This is distinct from post-delivery
`workflowStateVersionAtDispatch` and MUST NOT be reconstructed from a later
read. Legacy events without the new field remain readable but cannot be the
predecessor of an Owner-resume.

Core consumes the read-only svc companion below; it adds no Core product-api
endpoint and does not widen the existing seven-field due DTO.

```text
GET /internal/v1/dispatch-intents/{dispatchIntentId}/owner-assistance-resume-evidence
query: previousAttemptId=<opaque attempt ID string>&preDeliveryWorkflowStateVersion=<integer>
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

The request and response are closed shapes. `dispatchIntentId` is the exact
path UUID; `previousAttemptId` is the non-empty opaque Core attempt ID
(currently `wfeat-*`), not a UUID. Versions and sequences are integers on the
svc workflow-state-version scale. `reason` and `lastAttemptId` are present
and null for `ingress: assignee`; for `execution_policy` both are non-null,
the reason is one of the two enumerated policy reasons, and `lastAttemptId`
is the persisted policy value, never an echo of the query parameter.

Svc's exact provenance and selection obligations are CTR-SWEC-010. Core
requests evidence with the latest attempt's own ID and durable pre-delivery
baseline, releasing the existing admission lock for this remote evidence
read, then reacquiring it and exactly revalidating the bound preconditions
under CTR-WEC4-010. Changed, unavailable or ambiguous preconditions reject
the old unlocked result through the existing zero-mint/zero-delivery refusal
path. It accepts only a matching active
dispatch/instance/visit/assignee tuple, with
`baseline < requestEventSequence < resolutionEventSequence <= workflowStateVersion`.
The evidence's current version must equal the fresh pre-plan version stored
for the new attempt; a version/identity mismatch rejects that planning pass.
For ordinary ingress, Core requires `requesterPrincipalId == ownerPrincipalId`
and the two nullable fields to be null; there is no persisted ordinary
attempt-ID claim. For policy ingress, Core additionally requires the
non-null persisted `lastAttemptId == previousAttemptId` and the exact policy
reason. In the DTO, `ownerPrincipalId` means the activation's assignee;
`resolverPrincipalId` is the separately authorized resolving Domain Owner.

One locked durable `attempt_planned` append mints generation N+1 and consumes
the permit together. It contains the new baseline, unchanged identity,
`previousAttemptId`, `retryReason: owner_assistance_resolved`, and
`assistanceResume` containing the exact returned evidence DTO. The existing
ledger reducer/fence MUST reject a reused case ID, mismatched predecessor or
identity, missing/invalid baseline or sequence proof, nonterminal/unknown
predecessor, or duplicate generation. No second consumption ledger or side
store is introduced. Replaying the same case, event pair, due row, or restart
cannot mint again. If several old cases qualify, one is consumed; the new
baseline is at least their already-observed resolution versions, so none of
those old cases can authorize the following generation.

This permit may authorize the next generation immediately after generation
1, before or at the automatic cap, or after the cap. It never resets the
monotonic generation counter or automatic `maxAttemptsPerVisit` budget.
Each case authorizes at most one generation; this is not a claim that the
whole system terminates after finitely many distinct Owner authorizations.
This path MUST NOT append `stale_superseded` or treat Assistance activity as
satisfying the stale predicate. An Owner-resumed attempt that ends without
submission is excluded from automatic stale/policy continuation: another
generation requires a new case requested after that attempt's own baseline
and a new explicit authorized resolve.

For an Owner-resume plan durably appended but with no `delivery_started`,
restart processing MUST perform the following check BEFORE ordinary
reconciliation terminalizes that planned attempt. Query the existing Router
caller-correlation seam for the exact `requestId = attemptId`. Only a
positive `never_existed` result with no attributable execution, handle,
message, or session fields, plus a fresh read of the exact same active
dispatch/instance/visit/assignee and a workflow state version equal to the
stored `preDeliveryWorkflowStateVersion`, permits delivery under the SAME
attempt ID. Fresh canonical Principal-to-Agent resolution and write-ahead
`delivery_started` still precede delivery. This creates no generation and
consumes no second permit. Any query error, unknown or other correlation,
attributable execution field, missing proof/baseline, or identity/version
mismatch falls through to existing reconciliation, which MUST durably append
its normal `reconciled` event with `NEEDS_REVIEW/delivery_unverified`; no
delivery is attempted. A crash before `attempt_planned` consumes nothing.
Once `delivery_started` exists, all existing unknown/delivery replay fences
remain unchanged; this exception never replays such a delivery.


### CTR-WEC4-009 — Carried managed intake/review obligations

Both intake and separate review execute through existing WEC policy and bounded mechanisms. Opted-in initial wake is routed to the real intake workflow and never also drives naked chat. A turn delivery or `completed` result does not complete the Svc obligation. Only a real Svc command receipt joined to published required operation permits progress; failure/cap/Owner change is represented by a durable Svc STOP, not local needs_review alone. Preserve explicit resolve-before-resume and existing HUMAN_REQUIRED guard; no automatic phase re-prompt. Paired Spec §§4–9.

### CTR-WEC4-010 — Snapshot, unlocked reads, locked exact validation and refusal

For the two collection reads named in §2 only, Core MUST follow this order:

1. Under the existing admission lock, replay the durable ledger and capture a
   detached validation context: exact dispatch/instance/visit/assignee identity;
   current predecessor attempt ID or explicit absence, generation, phase/state,
   judgment, pre-delivery baseline and known delivery/reconciliation facts;
   relevant consumed assistance case/event identities, budget and eligibility
   inputs; and the replay/revision coordinates that make those facts comparable.
   This capture mints no attempt, consumes no permit and reserves no generation.
2. Release that lock for the remote pre-plan and, when applicable, evidence
   reads. Bind responses to the exact request/identity, predecessor, baseline,
   service workflow version and assistance event sequence coordinates used.
   Failed/restricted/malformed/ambiguous reads provide no permission. The two
   responses MUST satisfy every inherited identity/provenance/sequence rule.
3. Reacquire the SAME existing admission lock and replay the CURRENT durable
   ledger before evaluating a candidate append. Compare all relevant captured
   local preconditions, including predecessor absence/identity/generation,
   state/phase, eligibility, budget, reconciliation proof and permit consumption.
   Unrelated ledger appends need not reject a candidate when replay proves every
   relevant precondition unchanged; they MUST NOT be lost or overwritten.
4. At this locked commit-preparation validation coordinate, obtain fresh trusted
   authoritative validation of the exact current ACTIVE dispatch, nonterminal
   instance, current visit, assignee and workflow-state version. They MUST equal
   the identity/version bound to the unlocked results. Existing authorized
   canonical read surfaces MAY supply this necessary lock-held validation;
   no new Svc protocol is implied. Matching local revision, attempt/generation,
   result age/TTL or agreement between the two earlier remote reads alone is
   insufficient. Missing or unverifiable external equality MUST reject the
   unlocked results even when the local ledger is unchanged.
5. Only with all checks true, perform the existing single locked durable
   `attempt_planned` append. Its baseline is the observed pre-plan version,
   verified equal at step 4, never replaced by a newer version. The inherited
   permit-consumption reducer, fresh resolution, WAL, delivery and completion
   sequence remain inside their original lock discipline without alteration.

Any changed, unavailable, conflicting or ambiguous required precondition MUST
cause the old unlocked results to be discarded for this planning pass, with
zero new plan, zero permit consumption and zero delivery from those results.
Use the existing non-created refusal behavior: pre-plan failure is
`pre_plan_unavailable`; an already changed/occupied predecessor is
`already_attempted`; unavailable Owner proof remains rejected under the existing
Owner-proof path. This proposal adds no new refusal code or retry policy.
A later ordinary existing sweep may recollect new facts under its existing
eligibility rules; it MUST NOT rebase, repair or relabel the rejected result,
reuse its authorization for a new predecessor, or bypass any existing fence.

Concurrent Core writers MUST still serialize every durable mutation through the
same single-writer/fresh-replay discipline. While A waits for either unlocked
read, unrelated eligible B can acquire the lock and complete its normal admission.
If B/C instead changes A's relevant predecessor, generation, eligibility or
permit-consumption facts, A MUST reject its old result after replay. Two writers
competing for the same visit/case can mint at most one authorized generation and
consume that case at most once; the loser uses the existing refusal. No lockless
ledger write, second consumption store, dropped append or duplicated delivery
is permitted. Existing timeout, crash, replay and UNKNOWN boundaries remain.

Core's admission lock does not fence an independent Svc writer. Step 4 is a fresh
canonical observation at its stated coordinate, not a shared Core/Svc transaction
or a promise that remote state cannot change afterward. Subsequent service writes
remain subject to existing authoritative Svc authorization, expected-version CAS
and fences. A Svc version/identity change observed between collection and step 4
rejects the old results even if the local ledger did not change. No late read
may manufacture the original pre-delivery or dispatch-time baseline.

The concurrency acceptance must measure the unlocked read intervals and any
residual wait at the necessary final validation. Re-running the complete two
collection operations under lock and claiming their waiting was removed does
not satisfy the acceptance. This bounded proposal does not promise that all
external I/O, Principal resolution or final validation is now lock-free.

### Carried data model obligations (verbatim)

The existing append-only JSONL ledger gains
`preDeliveryWorkflowStateVersion` on every new `attempt_planned`, and the
Owner-resume fields defined by CTR-WEC1-008 only on Owner-resume plans.
Legacy rows remain readable, with no invented baseline or permit. The
single ledger remains the source of execution evidence and permit
consumption; `escalation_recorded` remains the escalation event. New state file
`forum-projection-state.json` (regenerable; loss ⇒ at-least-once re-post
with server-side read-before-write dedupe, never a business fact).


### Carried API obligations (verbatim)

- ADD `GET /workflow-execution/traces` (loopback product-api; CTR-WEC1-003).
- ADD `GET /workflow-execution/attention` (loopback product-api; same gate as
  CTR-WEC1-003; zero-parameter read-only selection over CTR-WEC1-001/002
  projection).
- ADD `POST /workflow-execution/kicks` (loopback product-api; CTR-WEC1-006).
- CONSUME svc-workflow
  `GET /internal/v1/dispatch-intents/{dispatchIntentId}/owner-assistance-resume-evidence`
  with CTR-WEC1-008's exact query and response envelope. This adds no Core
  product-api route, broker action, Auth scope, or role.
- ADD internal `POST /workflow-execution/owner-assistance-wakes` (same
  `workflow.execute` bearer gate): closed payload
  `{workflowInstanceId,nodeVisitId,assistanceCaseId,ownerPrincipalId,reason?}`;
  non-2xx remains retryable for the svc durable outbox.
- ADD broker manifest `workflow_execution_escalation` (create; target
  svc-workflow; scope `workflow.execute`) — companion svc endpoint.
- ADD least-privilege assistance tools over existing svc-workflow APIs:
  `workflow_assistance_read` (`workflow.read`: owner_inbox/detail) and
  `workflow_assistance_action` (`workflow.execute`: resolve/escalate_to_human).
  svc-workflow server-side Domain Owner bindings remain the authorization
  authority; no new Auth scope or role is created.
- WIDEN `forum_threads.list` manifest query list with `contextType`,
  `contextId` (additive; the svc-forum API already accepts them).


## 10. Acceptance

These are test definitions and required future evidence, not executed results.
All product concurrency and paired runtime acceptance is `NOT_RUN` for this
proposal. Every mapping below belongs to this V4 identity.

### Carried test obligations (verbatim)

- Projection/state-table unit tests (all rows of the CTR-WEC1-002 table).
- Engine policy tests: run_ended re-entry after delay (Goal Case 3),
  limit → OWNER_PENDING fact once (Case 4), outcome_unknown never re-enters
  (Case 7), fence limit refusal, kick coalescing (Case 1/2 support),
  restart: projection recovers from replayed file (Case 9).
- Owner-wake tests: exact Principal→Agent resolution, stable request-id dedupe,
  lost delivery receipt with proven admission, failed resolution retryability,
  and the closed product-api wake payload/gate.
- Assistance broker tests: read/action scope split, existing svc routes,
  idempotent owner actions, no model-carried authority inputs.
- Poster tests: dedupe by eventKey, forum down = no execution effect,
  late thread appears = events eventually posted (Case 8 agent side).

- ACC-WEC1-008-001 (CTR-WEC1-008): actual engine/ledger tests in an isolated
  environment prove one next generation from each ingress after generation 1
  and at the automatic cap, positive settled execution and exact post-baseline
  Owner proof; generation/budget stay monotonic and ordinary null fields are
  accepted only with current-assignee provenance. Evidence: input service and
  Router facts, resulting ledger lines, attempt IDs and delivery counts.
- ACC-WEC1-008-002 (CTR-WEC1-008): replay the same case, event pair and due row,
  reload the ledger, and provide multiple old resolved cases; at most one new
  generation is planned. Changed dispatch/instance/visit/assignee, forged
  ordinary policy payload, wrong policy attempt ID, pre-baseline events,
  non-resolved cases, legacy missing baseline, unknown/pending execution and
  elapsed time alone mint/deliver nothing. An Owner-resumed no-submission
  result cannot automatically stale-redispatch; only a fresh case plus resolve
  may authorize another generation.
- ACC-WEC1-008-003 (CTR-WEC1-008): fault-inject before plan, after Owner plan
  and before delivery_started, and after delivery_started. Only positive
  caller-correlation never_existed without execution fields plus exact fresh
  identity/version resumes the same planned ID; negative/error cases persist
  reconciled NEEDS_REVIEW/delivery_unverified and deliver zero times. Baseline
  read failure writes no plan, and gen1/stale/Owner plans all persist their
  baseline before Router delivery. Evidence: durable replay and crash traces.
  Any missing required ledger fact or unexpected delivery fails acceptance;
  isolated tests establish mechanism evidence, not production outcome.

### ACC-WEC4-001 — Complete carry and docs-only lifecycle

- Contracts: `CTR-WEC1-001`, `CTR-WEC1-002`, `CTR-WEC1-003`, `CTR-WEC1-004`,
  `CTR-WEC1-005`, `CTR-WEC1-006`, `CTR-WEC1-007`, `CTR-WEC1-008`,
  `CTR-WEC4-009`, `CTR-WEC4-010`.
- Method: independent exact-head review plus deterministic comparison to V3;
  verify all carried contract/data/API/test spans, replacement-span inverse
  equality, frontmatter schema and the applicable phase-1/phase-2 whole-authority
  state under §12.
- Environment: isolated documentation checkout against the authoring base.
- Required evidence: exact base/head, source and candidate hashes, commands/rc,
  Contract-to-Acceptance map and affected delta review. Phase 1 retains all V3
  bytes and prospective backlinks; phase 2 binds the reviewed semantic HEAD,
  Owner authority, reciprocal lifecycle and indexes, unchanged V3 body and
  independent final-HEAD review. Historical source observations stay intact.
- Expected result: only the two timing spans and their bounded validation
  obligations change product meaning; complete inherited norms are present,
  phase 1 leaves the predecessor unchanged with proposed/none/none; phase 2
  records accepted/contracts/production none with V3 retired, original body and
  acceptance provenance retained, and main activation still pending its merge.
- Failure condition: omitted inherited rule, changed other held-lock segment,
  AMEND/partial succession, unauthenticated acceptance or conflicting current
  lifecycle, code or production write,
  false test/runtime claim or missing reverse coverage.

### ACC-WEC4-002 — Inherited behavior conformance

- Contracts: `CTR-WEC1-001..008` (each of the eight Contracts), `CTR-WEC4-009`.
- Method: run the carried test obligations through real affected engine/ledger,
  API and broker seams, plus managed intake/review receipt/STOP/HUMAN_REQUIRED
  cases; evaluate all original success and negative examples.
- Environment: future authorized isolated implementation and paired Svc fixtures.
- Required evidence: implementation/authority revisions, actual commands/rc,
  service and Router facts, ledger replay, attempt IDs/counts, delivery receipts,
  managed operation/STOP receipts and full negative inputs.
- Expected result: every carried obligation, UNKNOWN/fence/budget/Owner provenance,
  no dual naked-chat execution and explicit resolve-before-resume remain true.
- Failure condition: any inherited regression, fabricated baseline, no real Svc
  receipt substituted by transport success, widened auto-retry, or bypassed guard.

### ACC-WEC4-003 — Both unlocked intervals permit unrelated writer progress

- Contracts: `CTR-WEC1-008`, `CTR-WEC4-010`.
- Method: independently barrier-pause A first in the real remote pre-plan read
  and then in Owner evidence; in each case run unrelated eligible B through the
  existing admission seam. Repeat with real separate writers sharing the ledger.
- Environment: isolated actual ledger/OwnerLock and controlled service responses;
  no production writes.
- Required evidence: interval barriers, acquisition/release and replay coordinates,
  B completion before releasing A's remote barrier, resulting durable lines,
  wait timings including final validation, delivery counts, implementation SHA.
- Expected result: B completes during each A collection wait; A can continue only
  after its exact locked checks pass; every writer's committed facts survive.
- Failure condition: B waits for A's paused collection, lockless writes, whole
  collection repeated under lock disguised as removal, lost append, duplicate
  generation/delivery, or unreported final-validation wait.

### ACC-WEC4-004 — Reject stale external or local observations

- Contracts: `CTR-WEC1-008`, `CTR-WEC4-010`.
- Method: inject each relevant change after capture, between the two reads, and
  during reacquisition wait. Independently change Svc activation, terminality,
  instance/visit/assignee or workflow version while local ledger stays unchanged;
  also change local predecessor, phase, generation, budget, positive settled
  proof and permit consumption. Include proof timeout/restricted/error/ambiguity.
- Environment: isolated real admission/reducer plus authoritative service seam;
  implementation must demonstrate the trust source of final validation.
- Required evidence: old/new exact identity and version/replay coordinates,
  negative fixture per field/window, canonical final-validation observation,
  unchanged local-ledger case, refusal results and zero plan/consume/delivery.
- Expected result: reject/discard every stale result through the existing path;
  no substitution of a new version, local-CAS-only success or retry permission.
  Unknown fences remain; a fresh later pass needs fresh facts and normal gates.
- Failure condition: any old result takes effect, identical local revision hides
  remote drift, unrelated facts are overwritten, or a new Svc protocol is silently
  presumed. This does not claim remote immutability after the validation read.

### ACC-WEC4-005 — Same-visit/case contention and crash boundaries

- Contracts: `CTR-WEC1-004`, `CTR-WEC1-008`, `CTR-WEC4-010`.
- Method: two real writers race for one predecessor/case at the same and different
  generations; inject crashes before capture, during unlocked I/O, on reacquire,
  before/after `attempt_planned` and after `delivery_started`; restart/replay.
- Environment: isolated process/ledger tests with exact Router correlation and
  paired service evidence; retain the existing held completion callback.
- Required evidence: both writer outcomes, raw append order and replay, old/new
  IDs/baselines, case consumption, WAL, delivery counts and refusal paths.
- Expected result: at most one permitted next generation/case consumption;
  crash before plan consumes nothing. After plan, only the inherited same-ID
  never-existed restart exception applies; after delivery_started no replay.
  Automatic budget, UNKNOWN, D-009 and dispatch-time locked capture remain intact.
- Failure condition: dual mint/consume/delivery, changed generation/request,
  reconstructed baseline, broadened recovery or discarded historical uncertainty.

### Reverse Contract-to-Acceptance coverage

| Contract | Acceptance |
|---|---|
| CTR-WEC1-001 | ACC-WEC4-001/002; carried projection tests |
| CTR-WEC1-002 | ACC-WEC4-001/002; all carried state-table rows |
| CTR-WEC1-003 | ACC-WEC4-001/002; carried API token/envelope/read-only tests |
| CTR-WEC1-004 | ACC-WEC4-001/002/005; carried policy tests |
| CTR-WEC1-005 | ACC-WEC4-001/002; carried Owner-wake tests |
| CTR-WEC1-006 | ACC-WEC4-001/002; carried kick tests |
| CTR-WEC1-007 | ACC-WEC4-001/002; carried poster tests |
| CTR-WEC1-008 | ACC-WEC4-001..005; carried ACC-WEC1-008-001..003 |
| CTR-WEC4-009 | ACC-WEC4-001/002; managed intake/review receipt and STOP cases |
| CTR-WEC4-010 | ACC-WEC4-001/003/004/005 |

## 11. Alternatives and disposition

- `ALT-WEC4-001` — AMEND or a fragment successor: REJECTED; it changes accepted
  meaning and violates whole-authority immutability/lifecycle requirements.
- `ALT-WEC4-002` — Keep only local CAS/TTL or equality between earlier remote
  reads: REJECTED; a Svc writer can change external facts without a local append.
- `ALT-WEC4-003` — Move delivery, dispatch-baseline, restart or all Domain locking
  outside: REJECTED; expands this two-read mandate and changes other authorities.
- `ALT-WEC4-004` — Add a new shared epoch/lock/CAS service or presume Svc atomicity:
  REJECTED here; needs separately justified authority and exceeds this task.

V3 has no separate alternative-disposition section; its negative choices (no
second ledger/fence, no unknown retry, no inferred HUMAN_REQUIRED, exact Owner
proof and no planned-delivery replay outside the exception) are carried above.
No historical alternative or acceptance record is deleted.

## 12. Migration, compatibility, and rollback

### Phase 1 — Semantic preparation before independent review

At reviewed semantic HEAD `176161f0651847d20a012fb797389b438e11a593`, V4 remained `proposed`, with `supersedes: [AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3]`
and `superseded_by: null`. V3 remains `accepted`, its `superseded_by: null`
and entire bytes unchanged. This matches #642's standalone successor pattern
and the transition verifier's explicit proposed-successor branch; it is not a
completed supersession transaction. No current authority pointer is redirected.

### Phase 2 — Independently reviewed Owner acceptance transaction

Owner ruling ④ and standing §3B authorize the original lawful responsibility
chain to execute formal acceptance after a non-author independent semantic PASS.
The acceptance executor must bind the actual reviewed semantic commit (not the
pre-repair proposal head), issuer/source and independent review. A subsequent
docs-only lifecycle commit MUST atomically record these reciprocal whole-Spec
edges and consistent current pointers:

```yaml
# docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4.md
status: accepted
supersedes:
  - AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3
superseded_by: null
implementation_authority: contracts
production_apply_authority: none

# docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3.md
status: superseded
superseded_by: AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4
# all original Contracts, acceptance provenance and its V2 supersedes stay intact
```

Update the current Spec index and affected authority pointers consistently in
that same transaction, with explicit reference disposition and independent
final-head delta review; reference maintenance cannot rewrite other accepted
Contract meaning. Preserve the V1→V2→V3 historical edges and receipts. Bind issuer,
time, exact reviewed semantic head/document hash and final accepted-head review.
There MUST NOT be an active accepted V4 with V3 independently current, or a V3
backlink pointing to a merely proposed V4. This R4 lifecycle commit records
acceptance and retirement on PR #655; it does not merge the PR. Both acceptance
and retirement activate as current repository authority only on main merge
after independent final-HEAD review. Until then main's accepted predecessors
remain controlling; a branch's accepted-looking status is not active authority.

No ledger/schema migration, backfill, baseline invention, store rewrite, permit
reset or production activation occurs. Existing events/DTOs remain compatible.
The unlocked observations are ephemeral inputs, not a new durable truth model.
A future separately authorized rollback must preserve appended facts, baseline,
permit consumption, UNKNOWN and all admission fences; reverting code cannot
silently reactivate superseded Product Authority. Before acceptance, withdrawing
this proposal needs no runtime rollback because it has no execution permission.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE within Owner ruling ④ and standing delegation §3B
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE (bounded proposal; no active rule changed)
PARTIAL_SUPERSESSION = NONE
ACCEPTANCE_TRANSACTION = RECORDED; MAIN_ACTIVATION = PENDING_MERGE
IMPLEMENTATION_AUTHORITY = contracts; effective only after accepted revision enters the implementation base
PRODUCTION_APPLY_AUTHORITY = none
IMPLEMENTATION_VALIDATION = NOT_RUN / MECHANISM_NOT_YET_QUALIFIED
SVC_RUNTIME_OR_STORE_CONFORMANCE = UNKNOWN
```

The external-validation mechanism must satisfy the explicit safety obligation;
its implementation feasibility and residual wait require future executed
Acceptance evidence. Missing proof is an executable refusal requirement, not
permission to assume equality. No runtime/performance PASS is implied.

```text
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = SUPERSEDE
SPEC_ID = AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4
STATUS = accepted
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_PRODUCT_ARCHITECTURE_V1
EXTERNAL_AUTHORITIES = SVC_WORKFLOW_EXECUTION_CONTROL_V3 @ 8da8dbcb70e700d9e35970e8b662b1be2c29afdc
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
DOCS_FIRST_REQUIRED = YES
CONTRACT_COUNT = 10
CONTRACTS_WITH_ACCEPTANCE = 10
AUTHORING_READY_FOR_REVIEW = YES
NEXT_ACTION = REVIEW
```
<!-- END COMPLETE WEC4 SOURCE -->
