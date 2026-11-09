# STOPPED-1377-MINIMPL

状态：**STOPPED / PREFLIGHT_NOT_PASSED**。未开始产品实现。

## 坐标与授权

- 核查时间：2026-11-07T10:14:59Z（本机 UTC 读数）。
- 仓库：`mayf3/dsh-agent-core`；worktree：`/private/tmp/h1377-minimpl`。
- `HEAD = BASE_HEAD = origin/main` 本地快照：`2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`；detached。
- #644 已在祖先：`4f7df01bcf087075c114901a96a7a54573110f61`；HEAD 为 #652 合并提交，已包含 #1364 的整合。本轮不接管其他 writer，也未修改 engine.js。
- 执行授权：用户 `BRIEF-1377-MINIMPL`，Owner 审查增量②B＋预授权 V1 §1；只做既有合同内接线，禁止新增系统 producer/reason、账本、业务重放、治理改动、生产写入、rebase、自合并；失败即停止并记录本文件。
- 起始状态只有未跟踪的 `BRIEF-1377-MINIMPL.md`，无 tracked diff。
- `node_modules` 符号链接已只读验证且目标目录存在：`/private/tmp/dsh-ekr-p1-new/node_modules`；未安装或修改依赖。
- PR #650 分析只通过 `git show 4928f502:CONVERGENCE-ANALYSIS-1377.md` 读取，未 checkout、复制或改写其分支。

## 冻结的 DONE_WHEN（未达成）

`REFUSAL_RESPONSIBILITY_PENDING` 记录通过真实、既有且合法的 Owner/Assistance 入口，取得可归属接收与后续处理证据并依法持久保留；不新增 producer/reason、账本或业务重放，不伪造结果；送达失败或仅 ACK 时保留原自动责任及下次触发。不得把函数存在、回调成功、通知入队或伪造 current visit 的测试桩当作达成。

交付还要求针对性用例、observation-cas 全套、blocked-recovery 套件、broker 31 条均 rc0，随后分支 `fix/refusal-consumer-wiring` push/open PR（base main，不合并）及交付 receipt。停止出口不冒称上述成功交付。

## PREFLIGHT（schema_version: 2）

原请求的 REUSE 路线未通过。下表记录依赖关闭所需的下一路线；本任务已经停止，不启动 authority authoring 或产品实现。

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = 2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648
BASE_HEAD = 2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648
CURRENT_BASE_HEAD = 2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648 (local origin/main snapshot; no remote refresh claim)
ROUTE_STAGE = AUTHORITY_AUTHORING (required next route only; stopped before authoring)
AUTHORITY_ACCEPTED_IN_BASE = NO (required delta absent; listed existing authorities are accepted)
GOAL_OR_TARGET = frozen DONE_WHEN above
CURRENT_GAP = no demonstrated legal ingress for original migrated/terminal B2 refused identity plus durable handoff evidence
AUTHORITY_ACTION = SUPERSEDE (required re-PREFLIGHT route for any B2 terminal metadata/closed-visit semantics delta; not authorized for authoring in this task)
PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1@BASE_HEAD, CTR-EKRWAE-001/003/004/007
RELATED_AUTHORITIES = AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3 CTR-WAE-008/012; AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3 CTR-WEC1-005/008; D-008/D-009
IMPLEMENTATION_AUTHORITY = contracts (existing accepted Contracts; does not cover the missing delta)
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO (SUPERSEDE; task also forbids governance changes)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE (intended source/durable evidence change; no operation)
EXECUTION_MANDATE = VALID (bounded task only)
MUTATION_AUTHORIZATION = VALID (within task red lines; does not create Product Authority)
ISOLATED_WRITE_SURFACE = YES (provided isolated detached worktree; no implementation ref created)
CONTROLLED_RUNBOOK_REQUIRED = NO (no production operation)
SPEC_GAP_DEPENDENCY = LOAD_BEARING
EVIDENCE_REVIEWABILITY = PASS (repository originals and fixed analysis revision available)
LIVE_AUTHORITY_GAP = NONE_OBSERVED (no production inspected)
OWNER_DECISION_REQUIRED = YES (closure of missing authority or a proven existing legal path)
EMERGENCY_STATE = NONE
EMERGENCY_ACTION = NONE
INCIDENT_REFERENCE = BRIEF-1377-MINIMPL
BASE_IMPACT = NONE (no product candidate delta)
IMPLEMENTATION_ALLOWED = NO (dependent wiring/evidence change)
MERGE_READY = NO
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = legal reachable receiving path for the original identity, permitted durable evidence, then required executed suites
EXPANSION_TRIGGER = needing new producer/reason, noncurrent/closed-visit authority, or B2 terminal metadata exception
NEXT_REAL_ACTION = resolve the named dependency through existing legal authority or separately accepted authority before renewed implementation
NEXT_ACTION = RE_PREFLIGHT
```

## 具体依赖诊断（SPEC_GAP，不以缺失合同自证）

**受影响动作**：把 #644 已有、带 `refusalSchedule` 的 B2 terminal `recovery_refused` 自动交接至 Owner/Assistance，并记录可归属接收、答复验证和后续触发证据。

**已查权威**：`.agents/README.md`、`.agents/local/README.md`、锁、相关 Product Architecture、Current Decision 索引及 D-008/D-009 相关边界、上述 accepted LIVENESS/WAE/WEC 条款、spec-governance PREFLIGHT。分析 #650 是条件与源码盘点，不作 Product Authority。

1. LIVENESS `CTR-EKRWAE-007`（276–285 行）要求可靠升级；它未授予新 caller/reason 或 closed-visit 写权限。`CTR-EKRWAE-003`（201–216 行）针对终态责任追加的窄例外明确限定 B1/B4，保留其他 terminal append 禁止。
2. `recovery/operation.js:75–78,139–156`：自动读取临时不可用返回 `RECOVERY_INAPPLICABLE`，保持 ACTIVE blocked；真正调用 `retainRefusal` 再 terminal refusal 的分支是 world drift，包括原 visit 已迁移、assignee 不符或实例终态。不能把持续 503 的 blocked 正例冒充目标 refused 正例。
3. `recovery/refusal.js:9–12,64–80` 只消费 terminal refusal＋持久 schedule，锁内 fresh identity/revision 检查后只读观察，始终 Pending；没有合法 Assistance case/Domain Owner 归属事实。`automatic-ledger.js:20–38` 的责任记录验证限定 ACTIVE/resolution_blocked，不可直接给 terminal B2 增补字段。
4. 普通 `workflow_assistance_request.open` 的服务前置是 authenticated current assignee、current visit、fresh CAS 与可信幂等键（`packages/broker/src/capabilities/workflow/assistance.js:282–349`）。WAE `CTR-WAE-008`（363–371 行）明确由 target Agent 自己 Principal 发起；把 runtime 的 target-agent read seam 改成代其写入会引入未经接受的 producer。
5. 既有 `workflow_execution_escalation.create` 要真实 `ATTEMPTS_EXHAUSTED` 或 `STALE_LOOP_EXHAUSTED`，并拒绝非 current visit / closed instance（`packages/broker/src/capabilities/workflow/dispatch.js:179–225`；WEC `CTR-WEC1-005`）。不能把观察次数耗尽伪称 attempt-limit。即使另有真实到限事实，原 visit 已迁移/实例已终态的反例仍不能满足该入口前置。
6. 既有 `wakeDomainOwnerAssistance` 需要已经存在的 `assistanceCaseId` 和 Domain Owner Principal（`packages/production-runtime/src/workflow-execution-runtime.js:92–145`）。本责任结构没有这些坐标；凭空指定 case/接收方或另起 generic system callback 不能成为合法接通。已有到限流程的 `escalation_requested` 是 WEC-005 的专属既有事实记录，不授予 generic refusal handoff。
7. #650 §3/§5 明文区分：合法 assignee/Owner 前置已满足时的 c 是实现缺口；新增 non-assignee producer/reason/closed-visit 处置或 B2 terminal handoff/答复/next-trigger append 则需要 accepted 语义变更。本任务选择前者，并未接受后者。

**可达反例**：原 attempt 的解析 blocked 在自动恢复前已有合法 visit 迁移或实例终态 → fresh 世界读证明变化 → 在 ACTIVE 时持久 refusalSchedule → 原 attempt terminal recovery_refused → 到期 poller 返回 Pending。用该原 nodeVisitId 向既有入口交接会遇到 current-visit/closed 前置失败；换 visit/assignee/reason 会改变原身份或伪造事实。只追加 B2 handoff 字段则依赖当前没有的 terminal 元数据例外。

**影响**：冻结验收的真实交接与证据落账不能在已证明的既有路径内完成。只接一个永远拒绝的调用、用测试假件把旧 visit 变回 current、仅凭 `ok`/ACK 成功，均不满足 DONE_WHEN。

**最小关闭条件**：提供对该原 identity 真正满足前置、已有接受依据的 Owner/Assistance 接收与持久证据路径；若需要 noncurrent/closed-visit 处置、系统 producer/reason 或 B2 terminal handoff 元数据，则须在另项任务先完成相应 Core/Svc authority 接受，再由包含其接受的 base 重新 PREFLIGHT。这里不起草新 Spec，也不把问题扩大成新平台。

**可移除依赖的边界**：已有合法 case/caller/current visit 的具体任务可复用既有路径，但本轮未证明目标 refused 集合存在这样的可达正例；只做真实到限子集不能替代上述迁移/终态反例。原只读责任与持久 cadence 继续保留，无需变更。

## 复核、实际动作与未执行项

- 独立只读核查：`/root/consumer_inventory`，未参与编写产品代码；结论同上。它检验并排除了以“真实到限”接口形态冒充 migrated/terminal 原 visit 可达正例的方案。
- 未修改产品源码、测试、治理文档或 `.agents/tools`；未更改或重建责任、事件、UNKNOWN、attempt/request/generation、Router/Scheduler store/fence。
- **测试 NOT_RUN**：针对性新例、observation-cas、blocked-recovery、broker 31 条均未执行；原因是 dependent implementation readiness=NO，非测试已通过或测试失败。历史 #644/#652 PASS 未当成本轮结果。
- 未创建分支、commit、push、PR；未 merge/rebase、部署、运行生产消费者或发送 Owner/Assistance 消息。安装、业务/无人值守结果均 UNKNOWN。
- 唯一新增文件为本停止记录；起始 Brief 保留。`RECEIPT-1377-MINIMPL.md` 未生成，因为任务未达成功交付边界。
- 停止依据是用户“失败即停”与 AGENTS.md 的权威冲突边界；所用 [spec-governance SKILL.md](.agents/skills/spec-governance/SKILL.md) 的 [PREFLIGHT 模式](.agents/skills/spec-governance/modes/PREFLIGHT.md) 亦要求：`Do not start semantic implementation or mutation when the relevant readiness flag is NO.` 本记录是用户明确授权的停止出口。

## 实测 SHA-256

下列文件均在原 HEAD 的只读核查阶段计算；停止记录自身 hash 由后续只读终端回执给出，避免自引用。

```text
660b0fdc72b6fdb44a47f2d7422c8f51e1a04bd9a449d1b69c0c2da18f5be5e0  BRIEF-1377-MINIMPL.md
54b1f7203ed55dadc23d5f512126cd266f401533ac49d38eb91c00a7003902a7  4928f502:CONVERGENCE-ANALYSIS-1377.md
a939403cbd83bf9636d2f55e439dddcbbfc3eb74c578db8d4e348d513323a481  docs/specs/AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1.md
c5d39e390026807b9e471a6875f5e0e9d15432f21a3d177733bf422fc751a1e6  docs/specs/AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3.md
03469e9f53ccf53f23de3a552270a4bb82f1922b6979108fe01083488c3335d4  docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3.md
d4c5bb2733f75f70c1db2f5334c5c6a30cdd9663a7b9fbeafad6ab2395e92a26  packages/workflow-execution/src/recovery/refusal.js
2a30ea7476c184e90241a16dde50069b20f080c1c93ed53efebd2aba436a8449  packages/workflow-execution/src/recovery/operation.js
37872d963f53e9744833a2e882479ea400ef24859b87535c3fc07a4354faf592  packages/workflow-execution/src/recovery/automatic-ledger.js
92d0b10ca354d1d4c53bd48c062ef8d9b2ecb326b0cd1003d88f0fef5fdfb32a  packages/production-runtime/src/workflow-execution-runtime.js
```
