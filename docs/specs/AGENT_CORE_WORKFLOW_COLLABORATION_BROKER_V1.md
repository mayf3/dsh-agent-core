---
spec_id: AGENT_CORE_WORKFLOW_COLLABORATION_BROKER_V1
title: Workflow collaboration broker capability — read feed + side-band append (thin transport over the svc-workflow collaboration proposal routes)
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-10-07
repo: mayf3/dsh-agent-core
base_head: d1e42f217f (github/main)
scope:
  - mayf3/dsh-agent-core
  - packages/broker workflow capability surface（新增一族两个 thin-transport 能力：workflow_collaboration_read / workflow_collaboration_append）
governed_by:
  - AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1
  - AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1
  - AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1
  - AGENT_CORE_WORKFLOW_EXECUTION_CLASS_BROKER_V1
  - AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1
external_authorities:
  - SVC_WORKFLOW_INSTANCE_COLLABORATION_V1 @183c85c8766e6fc0b3451820f0be7fda16b4afe6 (mayf3/svc-workflow PR #60, proposed, AUTHORITY_GATE=PENDING)
supersedes: []
superseded_by: null
owners:
  - mayf3
product_issue: mayf3/dsh-agent-core#480
implementation_status: riding-WIP (this PR; NOT authorized for merge until this Spec's Owner acceptance flips implementation_authority to contracts — merged-main precedent 7655a817)
---

# AGENT_CORE_WORKFLOW_COLLABORATION_BROKER_V1 — Workflow collaboration broker capability

> **状态：proposed。** 本 Spec 当前**不授予**任何 merge 或 production apply 权限。
> `implementation_authority = none`；`production_apply_authority = none`。
> 随本 Spec 同 PR 保存一份 riding WIP 实现（broker focused tests 13/13 PASS +
> broker full regression 517/517 PASS）；该实现**未获授权合并**，accept 本 Spec
> 是其唯一授权路径（对齐 AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1
> 头注的 preserved-WIP 模型与 merged-main 先例 7655a817：
> RETURN_POLICY_EXHAUSTED_DECLARER_V1 实现先于 Spec acceptance 合入并在
> 2026-09-29 被 Owner exact-head accept）。
>
> **外部权威边界：** collaboration 的业务语义、可见性分类与写关系判定全部
> 归属 svc-workflow 侧的协作提案
> `SVC_WORKFLOW_INSTANCE_COLLABORATION_V1 @183c85c`（PR #60，proposed，
> AUTHORITY_GATE=PENDING；svc-workflow 主干另有 ARCHITECTURE_V0_4_3 并发候选
> gate）。本 Spec **不**实现、不修改、不预接受任何 svc-workflow 侧行为；它只
> 冻结 dsh-agent-core broker 对该提案 CTR-10 两条路由的 thin-transport 绑定，
> 使 Agent Session 在 svc-workflow 侧接受并部署协作面时立即可用。svc-workflow
> 侧路由变更时，本 Spec 走 AMEND 跟随，broker 不得先行放宽或收紧参数面。

## 0. 问题（已实证）

Product #480（G7 Workflow collaboration）的 DONE_WHEN 要求一条真实的协作
读写流。现状（fresh-read @d1e42f21 + svc-workflow 7c533cf）：

1. 协作提案（svc-workflow PR #60，independent review PASS @183c85c）定义了
   append-only side-band + 统一 feed（CTR-1..13），但 AUTHORITY_GATE=PENDING，
   svc-workflow 本地治理与 PR #60 自身（`IMPLEMENTATION_ALLOWED=NO`）明确
   禁止在 Owner acceptance 前实现服务端；
2. dsh-agent-core broker 现有 workflow 面（read 族 + `workflow_execute` 四
   操作 + assistance/definition/progress/projection 族）**没有任何协作能力**：
   即使 svc-workflow 未来部署协作端点，Agent Session 也无法经 broker 使用；
3. 因此本仓侧最小连贯缺口 = 绑定提案 CTR-10 两条路由的两个 broker manifest
   （读 + 写），全部复用既有 canonical authorities（broker transport/targets、
   scope 模型、Idempotency-Key 机制、错误保留纪律），零新增 service/DB/
   scheduler/watcher/auth authority/control plane/parallel backend。

## 1. 冻结的语义（rulings）

### R1. Capability 面（唯一新增）

- `workflow_collaboration_read`（toolName 同 id）：唯一 operation `feed`，
  http binding `{ target: 'svc-workflow', method: 'GET',
  path: '/internal/v1/workflow-instances/{workflowInstanceId}/collaboration',
  query: ['limit', 'afterCreatedAt', 'afterItemType', 'afterId'] }`，
  requiredScopes `['workflow.read']`，无 Idempotency-Key。
- `workflow_collaboration_append`（toolName 同 id）：唯一 operation
  `append_entry`，http binding `{ target: 'svc-workflow', method: 'POST',
  path: '/internal/v1/workflow-instances/{workflowInstanceId}/collaboration/entries',
  body: ['body', 'replyToEntryId', 'relatedEventId', 'relatedSubmissionId',
  'relatedAssistanceCaseId'], idempotencyKey: true }`，requiredScopes
  `['workflow.execute']`。
- 读/写分两个 manifest：broker scope 是 capability 级（同
  workflow-assistance read/action split 的最小特权模型）。
- **协作 append 不是 `workflow_execute` 的第五个操作**：提案 CTR-3 规定
  append 是 non-state 命令（零 `workflow_instances`/`workflow_events` 写入、
  不占状态命令序列化位、无 CAS 输入），而 `workflow_execute` 是
  ASSIGNEE_TRANSITION_CAPABILITY_V1 §25 冻结的四操作实例执行写入口。
  本 Spec 不触碰该冻结面（DEC-WECB 同族先例：additive family 独立成文件）。

### R2. 参数面（冻结，提案 CTR-9/CTR-10 逐字段）

- `workflowInstanceId`：必填 UUID（wire 名 camelCase，transport 原样转发）。
- `limit`：可选 integer，1..100，broker-side fail-fast `invalid_pagination`
  （下游默认 50；上限与提案 CTR-9 一致）。
- keyset 三元组 `afterCreatedAt`（RFC3339 string）+ `afterItemType`
  （`COLLABORATION_ENTRY | WORKFLOW_FACT`）+ `afterId`：allOrNone 组，
  broker-side fail-fast `invalid_cursor`（提案 CTR-9 "all present or all
  absent"；复用 DOMAIN_INSTANCES_BROKER_V1 的 allOrNone 机制族）。
- append：`body` 必填（1..16384 由服务端 CHECK 强制；broker 不重复长度校验），
  四个可选引用字段全部为 UUID；**不建模** `kind`/`author`/`authoredNodeVisitId`/
  `observedNodeVisitId`/`observedWorkflowStateVersion`（提案 CTR-10：服务器
  authored only，请求含这些字段由服务端 deny_unknown_fields/unknown-field
  拒绝；broker 参数 schema 物理上不出现它们）。
- 无 optional 引用时对应 key 完全省略（DEC-WECB-002 同纪律：请求体键缺席
  保持 svc 请求哈希恒等，不注入 null/空串）。

### R3. 权限（服务端唯一权威）

- 可见性（CTR-8）与写关系（CTR-5：enabled Domain Owner | creator | 当前
  assignee | Historical Participant；archived 关闭写入口）全部由 svc-workflow
  强制；broker 不做、不复制、不缓存任何权限判断，无任何放宽性参数。
- 身份只经 credential seam 传递（`author = token.sub` 服务端解析）；
  Idempotency-Key 由 broker trusted-zone 生成，模型提供的 key 被忽略。

### R4. 错误保留（AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1 纪律）

- 读表声明：`workflow_instance_not_found_or_not_visible`（404）、
  `invalid_pagination`、`invalid_cursor` + base/auth/query 共有码。
- 写表在提案 §3 catalogue 全量声明：404
  `workflow_instance_not_found_or_not_visible`、403 `principal_disabled`、
  403 `collaboration_write_forbidden`（新码，declarer row）、409
  `instance_archived`、409 `idempotency_conflict`、425
  `command_still_processing`、422 `invalid_input`、422
  `invalid_collaboration_references`（新码，declarer row）+ 共有码。
- 已声明码 verbatim 透传（code + status + sanitized detail + x-request-id），
  detail 内容由 error-detail-sanitizer 家族净化（可能 redacted，非本 Spec
  冻结点）；未声明码 fail-closed 到 canonical `http_4xx`/`http_5xx`（无
  wildcard，DEC-006）；零 broker 自动重试。

## 2. 实现面（随本 PR 保存的 WIP；acceptance 前不授权合并）

- 新文件 `packages/broker/src/capabilities/workflow-collaboration.js`
  （两个 manifest，纯数据；与 workflow-assistance.js 同构）。
- `capabilities/manifests.js` 增加恰好一行 re-export；`src/index.js`
  DEFAULT_MANIFESTS 增加恰好一个 import 名与一个 spread 行（hub 纪律）。
- 测试 `packages/broker/test/workflow-collaboration-capability.test.js`
  （RED-first：module-absent RED → 13/13 GREEN；mutation bite：移除
  `idempotencyKey: true` 恰好击穿 freeze+IK 两个测试后 revert；
  broker 全量回归 517/517 PASS）。
- 不改：`workflow_execute`、read 族现有 manifest、任何 svc-workflow 文件、
  任何 scheduler/WIP 面。

## 3. 明确非目标

不实现 svc-workflow 服务端协作面（表格/迁移/DTO/openapi 变更全数归属
svc-workflow PR #60 的 acceptance 后实现轮）；不改变 `workflow_execute`
四操作冻结面；不引入 broker 侧权限判断、kind 分类、编辑/删除/搜索/实时/
附件等提案非目标；不部署、不 reload、不 claim production 效果。

## 4. Acceptance 与实现授权顺序

1. 独立 exact-head 语义 review（本 PR head）。
2. Owner exact-head acceptance：本 Spec `status: proposed -> accepted`、
   `implementation_authority: none -> contracts`（lifecycle-only，
   不改 reviewed semantics）。
3. 随 PR 保存的 riding WIP 实现在 accepted Spec 在 base 后方可 merge；
   svc-workflow 侧部署其协作端点属独立 production gate，与本 Spec 互不授权。

## 5. 环境备注（测试可复现性）

本 slice 的测试在 pnpm store 失效的机器上通过一个**未提交的本地 resolution
hook**（`@deepseek-ai/*` → deepseek-harness 源码树）运行；该 hook 不入仓，
不改变任何被测代码。健康环境下（dsh-tools 可解析）同一命令
`node --test packages/broker/test/workflow-collaboration-capability.test.js`
直接可复现；`AGENT_CORE_WORKFLOW_RETURN_POLICY_EXHAUSTED_DECLARER_V1`/
`EXECUTION_CLASS_BROKER_V1` 等 riding 实现的既有测试环境先例同源。
