---
spec_id: AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_V1
status: accepted
date: 2026-08-24
accepted_date: 2026-08-27
accepted_by: mayf3
accepted_at: 2026-08-27T15:45:22Z
accepted_reviewed_base: b620907fc6f58292b6ee096c977f0071921d747e
accepted_reviewed_spec_commit: f82a2dbda0c67c6249c057a05546a183fe78679f
accepted_reviewer_id: deepseek-harness-local-independent-spec-reviewer-clean-r4
acceptance_review_result: ACCEPT
semantic_delta_after_review: NONE
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mayf3/dsh-agent-core
  - dedicated workflow-admin Agent identity bootstrap for exactly one new Agent (agt_workflow-admin-agent / 工作流总管): one Agent Definition entry + auth-service machine identity (S1 principal + S2 client) + trusted credential store entry + minimal durable receipt + durable non-secret attempt ledger + safe disabled staged-identity failure terminal state (same single bounded execution round; Revision 4)
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_PRODUCT_BOUNDARY_V3
    revision: d888241ac85ccadd581acdea9f7f7313a0e91bdc
    relation: depends_on
supersedes: []
superseded_by: null
owners:
  - mayf3
type: dedicated-admin-agent-identity-bootstrap-spec
review_status: ACCEPTED_AFTER_INDEPENDENT_REVIEW
owner_intent_provenance: direct Owner instruction, 「身份 执行」 authoring task 2026-08-24 (Owner 决策 §0 Batch 1 全部冻结); direct Owner Revision 1 instruction 2026-08-25 (auth-service 坐标更正 + INITIAL_DEFINITION_DISABLED=true + disabled 状态语义 + activation boundary 冻结, §0 Batch 2); direct Owner current-main ingress reconciliation instruction 2026-08-25 (Notification Ingress premature-activation boundary, Revision 2); direct Owner Revision 3 instruction 2026-08-26 (governance-authority and failure-recovery closure——implementation_authority=contracts 治理字段修正 + verification mint success classification + durable attempt ledger 与 S1/S2 outcome_unknown 闭合 + SAFE_DISABLED_STAGED_IDENTITY rollback + activation authority 完整冻结, §0 Batch 3); direct Owner Revision 4 clean-base replacement instruction 2026-08-27 (clean-base provenance + exact parent D.5 credential-layer classification + minimal final durable receipt allowlist, §0 Batch 4)
references:
  - docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1.md (accepted; present on main 73ec666 as blob df74e92759ad3083328dfd337667fc8a4ec618a0; its Part C.4 external_ref functions, Part D/D.7 Phase A order, Part G store contract, Part H secret handoff and D.5 mint classification are INHERITED and NOT modified by this Spec)
  - docs/specs/AGENT_TRUSTED_FLEET_CUTOVER_V1.md (accepted; its exact-86 roster, EXACT_ROSTER_SHA256 and frozen plan are NOT modified by this Spec)
  - docs/specs/AGT_CTO_AGENT_PRIMARY_WORKSPACE_OPENCLAW_IN_PLACE_V1.md (accepted single-Agent companion authority; subject-bounded format precedent)
  - docs/evidence/workflow-recovery-stage-f-20260822/ (historical production identity evidence for agt_stock_agent and agt_cto-agent; identity-coordinate evidence precedent only—the broader historical receipt shape is NOT reused by Revision 4)
---

# AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_V1 — 专用「工作流总管」Agent 身份 bootstrap 权威

> **ACCEPTED CANDIDATE / DOCS-ONLY / SPEC ONLY — 本轮不执行任何身份动作。**
>
> **Owner acceptance receipt（2026-08-27）**：reviewed base
> `b620907fc6f58292b6ee096c977f0071921d747e`；reviewed Spec head
> `f82a2dbda0c67c6249c057a05546a183fe78679f`；independent reviewer
> `deepseek-harness-local-independent-spec-reviewer-clean-r4`；review result `ACCEPT`；
> acceptance actor `mayf3`；`SEMANTIC_DELTA_AFTER_REVIEW = NONE`。本 accepted candidate
> 仅在合入 designated authority branch `main` 后成为 active repository authority；
> acceptance 本身不执行运行时写入、不创建或启用 Agent、也不授权 Ready 或 merge。
>
> 本 Spec 是 **subject-bounded 的单 Agent 身份 bootstrap child authority**：唯一 subject 是
> 一个**新的专用管理 Agent** —— `agt_workflow-admin-agent`（displayName `工作流总管`，
> `AGENT_KIND = DEDICATED_ADMIN_AGENT`）。它是 svc-workflow 已接受产品方向
> `SVC_WORKFLOW_PRODUCT_BOUNDARY_V3` §18 **Slice A（Dedicated Admin Agent identity）**
> 在 dsh-agent-core 侧的 child authority。本 Spec 是 implementation kind
> （`implementation_authority: contracts`——治理协议 `SPEC_GOVERNANCE_V0` 唯一认可的
> 实现授权字段形式；Revision 3 起本 frontmatter 不再携带任何治理协议未识别的
> authority 字段）。**文档合并本身不执行任何运行时写入**
> （`DOCS_MERGE_PERFORMS_RUNTIME_WRITE = NO`）；accepted + merge 后，本 Spec 成为
> 下列有界写入的**合法实现权威**：必须由**另一次独立派发的「身份 执行」任务**
> （`SEPARATE_EXECUTION_TASK_REQUIRED = YES`；无需第二份 Spec，
> `SEPARATE_EXECUTION_SPEC_REQUIRED = NO`）在满足 §9 CTR-WA-008 冻结执行门后执行
> **恰好一轮**，建立
> （1）`agents.json` 中的 **1 条 Agent Definition entry**（初始 `disabled: true`，
> 见 §0 Batch 2），
> （2）auth-service 机器身份（S1 ownerless agent principal + S2 machine client，
> deterministic `agentcore:v1` external_refs），
> （3）trusted credential store entry，并
> （4）在 `docs/evidence/` 落盘记录 **exact Principal UUID 与 exact Client ID** 的
> minimal final durable receipt；执行轮还必须先落盘 durable 非 secret attempt ledger
> （CTR-WA-010），且 bootstrap 成功判据完整继承父权威 Phase A——**verification
> mint 必须按父 D.5 得出 `CREDENTIAL_LAYER_VERIFICATION = PASS`**；对本 Slice 的
> 零 Grant Client，`machine_grant_missing` 的 deterministic
> `400 invalid_scope` 即为 credential-layer PASS，
> 同时 `BUSINESS_GRANT_READINESS = NOT_READY`（CTR-WA-005）。
>
> 本轮（authoring round）**只交付本文件**：不创建 Agent、Principal、Client、credential、
> workspace、Home、Feishu Binding 或任何 Grant；不写 `agents.json`，不调用任何
> auth-service seam，不 merge。acceptance + merge 之前
> `IDENTITY_BOOTSTRAP_EXECUTION_IN_THIS_AUTHORING_ROUND = NO`。
>
> **REVISION 1（2026-08-25，同一 PR 内修订轮，仍 DOCS ONLY——只改本文件）**：
> 按 Owner 修订指令完成四项修正：(1) auth-service 坐标更正（§3——`170736e` 为
> historical source snapshot 而非 main HEAD；authoring-time main = `45b1b890`；
> current main = `d529bd3c`）；(2) 初始 Definition `disabled: true`；(3) disabled
> 状态语义冻结（身份可准备；Notification / Feishu / Product API / Scheduler 均不能
> 启动该 Agent；零 spawn、零 Workspace/Home 自动创建）；(4) activation boundary
> 单独冻结（`disabled:true → false` 必须经过独立受控 activation authority，Slice A
> 身份 bootstrap 不得自动启用）。修订轮已**重新做 full review**（机械校验与语义
> 审计全部重做，不沿用旧语义审计结论）。
>
> **REVISION 2（2026-08-25，同一 PR 内 current-main ingress reconciliation，仍
> DOCS ONLY——只改本文件）**：在 dsh-agent-core main
> `b3a6d4fe089c4b95bdc22df0cabd24eeb3ccb724` 复核新增 Notification Ingress：
> `/v1/deliver` 的 caller allowlist 只约束 `svc-forum` / `svc-workflow` 调用方，
> 不存在 target Agent allowlist；请求体可直接携带 `agentId`，随后调用
> `agentRouter.deliver`，Router 再执行 `resolveAgentRef → ensureRunning`。因此“无
> Feishu Binding”不是 Notification 路由惰性边界；activation 前不得仅凭 caller
> allowlist 与 body `agentId` 投递本 Agent，必须由 `disabled:true` 的 Agent
> Definition gate 在 Router admission / process activation 前拒绝。身份 bootstrap
> 完成后仍保持 non-routable；`disabled:true → false` 仍只归独立受控 activation
> authority。本次语义修订不得复用 Revision 1 review 结论；修订提交后必须由下一轮
> 独立审计重新做 fresh full review，当前不得标记 Ready。
>
> **REVISION 3（2026-08-26，同一 PR 内 governance-authority and failure-recovery
> closure，仍 DOCS ONLY——只改本文件）**：关闭 Revision 2 独立审计的全部 blocker：
> (B1) authority form 修正——`implementation_authority: none → contracts`，删除
> 治理协议未识别的 `identity_execution_authority` / `production_apply_authority`
> 字段，冻结「docs merge 不执行运行时写入；accepted+merged 后成为有界实现权威；
> 执行需独立任务、绑定 exact accepted revision」语义（§1 / DEC-WA-008 /
> CTR-WA-008）；(B2) activation authority 完整冻结——exact authority ID
> `AGENT_CORE_WORKFLOW_ADMIN_AGENT_ACTIVATION_V1` 与 exact target-admission child
> ID `AGENT_CORE_WORKFLOW_ADMIN_AGENT_NOTIFICATION_TARGET_ADMISSION_V1`、前置条件、
> exact enable/reload/evidence/rollback 事务全部可独立起草，零 TBD（DEC-WA-011 /
> CTR-WA-009 / CTR-WA-012）；(B3) 当时将父 credential authority 的 verification
> gate 表述为“mint 成功”，Revision 4 已精确对齐为父 D.5 credential-layer PASS
> 分类（含 exact zero-Grant machine_grant_missing 的 deterministic 400 invalid_scope PASS），不再把所有非 200 结果
> 归为 INCOMPLETE（CTR-WA-005）；(B4) S1/S2 `outcome_unknown` 闭合——durable 非 secret
> attempt ledger + 分类决策树 + S2 secret 不可取回时 STOP 与唯一显式 rotation 恢复
> 路径（CTR-WA-010）；(B5) rollback 可实现性——删除对不存在的 Agent Definition
> remove seam 的依赖（OBS-WA-011），失败终态冻结为
> `SAFE_DISABLED_STAGED_IDENTITY`（CTR-WA-011）。第 6 项 structure blocker
> （stale scheduler registry entry）已由 current main 独立清册提交修复，本修订
> 不触碰 `.agents/structure-registry.json`，合入 current main 后复验关闭。新增
> CTR/ACC-WA-010..012（Contract 与 Acceptance 计数 12/12）。
>
> **REVISION 4（2026-08-27，clean-base replacement + parent semantic alignment，仍
> DOCS ONLY——只新增本文件）**：本文件从旧 PR #67 的 Revision 3 head
> `fea8f2996129d8b797a1b950fea47983e2b1e30b` 单文件导入，以执行时最新 main
> `b620907fc6f58292b6ee096c977f0071921d747e` 为 clean base，不携带旧 PR 的 merge
> ancestry；`REVISION_4_CLASS = CLEAN_BASE_AND_PARENT_SEMANTIC_ALIGNMENT`，
> `REPLACED_PR = mayf3/dsh-agent-core#67`，`OLD_REVISION_3_HEAD =
> fea8f2996129d8b797a1b950fea47983e2b1e30b`，`CLEAN_BASE =
> b620907fc6f58292b6ee096c977f0071921d747e`。本轮关闭三个 blocker：(B1) clean-base
> ancestry；(B2) verification mint 精确按父 D.5 分成 credential layer 与 business
> grant layer；exact zero-Grant `400 invalid_scope` 以 reason=`machine_grant_missing` 证明，分类为 credential-layer PASS + grant NOT_READY +
> `SUCCESS_IDENTITY_ONLY`，并同步既有 store entry 的 current STOP / historical PASS
> read-only reentry 语义；(B3) final durable receipt 收窄为六字段闭合 allowlist，详细
> 坐标/状态/时间只留在 attempt ledger 或 evidence artifact，并明确 ledger 前 STOP 不
> 产生 receipt、ledger 后早期 STOP 以 null unresolved IDs 表示。Revision 3
> 已关闭的 authority、activation、outcome_unknown 与 rollback 语义逐字保留。
>
> 本 Spec **不授权**：svc-workflow 权限供给（Slice C，auth-service 侧独立权威）、
> Feishu 命令路由/Binding（Slice F）、`SVC_WORKFLOW_TRUSTED_ADMIN_AGENT_ROOT_V1`
> designation root（Slice B，svc-workflow 仓库所有）、workspace/Home provisioning、
> capability manifest、Scheduler、Runtime reload、任何 auth-service 代码修改。

---

## 0. Owner 冻结决策（frozen — 实现轮不得更改、不得重新决定）

以下决策由 Owner 冻结，效力高于本 Spec 任何实现轮的裁量。三批，各自逐字转录、
无增删：

**Batch 1（authoring task 2026-08-24，「身份 执行」authoring）：**

```text
ADMIN_AGENT_ID =
agt_workflow-admin-agent

ADMIN_AGENT_DISPLAY_NAME =
工作流总管

AGENT_KIND =
DEDICATED_ADMIN_AGENT

EXISTING_AGENT_REUSE =
FORBIDDEN

BUSINESS_AGENT_REUSE =
FORBIDDEN

CANARY_AGENT_REUSE =
FORBIDDEN

SECURITY_CEO_CTO_AGENT_REUSE =
FORBIDDEN

PRINCIPAL_EXTERNAL_REF =
agentcore:v1:principal:agt_workflow-admin-agent

CLIENT_EXTERNAL_REF =
agentcore:v1:client:agt_workflow-admin-agent

CLIENT_ID =
generated by accepted auth-service authority;
must not be predicted or hard-coded

SVC_WORKFLOW_PERMISSION_GRANT_IN_THIS_SCOPE =
NO

FEISHU_BINDING_IN_THIS_SCOPE =
NO

TRUSTED_ADMIN_AGENT_ROOT_IN_THIS_SCOPE =
NO

SECRET_IN_GIT_OR_REPORT =
FORBIDDEN
```

**Batch 2（Revision 1 修订指令 2026-08-25，同一 PR 内）：**

```text
INITIAL_DEFINITION_DISABLED =
true

DISABLED_STATE_SEMANTICS =
Identity / Principal / Client / Credential 可准备；
Notification、Feishu、Product API、Scheduler 均不能启动该 Agent；
零 spawn、零 Workspace/Home 自动创建

ACTIVATION_TRANSITION =
disabled:true -> false 必须经过独立受控 activation authority；
不得由 Slice A 身份 bootstrap 自动启用
```

**Batch 3（Revision 3 修订指令 2026-08-26，同一 PR 内）：**

```text
IMPLEMENTATION_AUTHORITY_FORM =
contracts（治理协议唯一认可字段；
删除 identity_execution_authority / production_apply_authority 自创字段）

DOCS_MERGE_PERFORMS_RUNTIME_WRITE =
NO

BOOTSTRAP_SUCCESS_REQUIRES_VERIFICATION_MINT =
YES

VERIFICATION_MINT_FAILED_OR_INCONCLUSIVE =
BOOTSTRAP_INCOMPLETE

ATTEMPT_LEDGER_REQUIRED =
YES

S2_SECRET_LOSS_RECOVERY =
STOP_AND_EXPLICIT_ROTATION_RECOVERY

ROLLBACK_TARGET =
SAFE_DISABLED_STAGED_IDENTITY

AGENT_DEFINITION_REMOVE_REQUIRED =
NO

ACTIVATION_AUTHORITY_ID =
AGENT_CORE_WORKFLOW_ADMIN_AGENT_ACTIVATION_V1

TARGET_ADMISSION_AUTHORITY_ID =
AGENT_CORE_WORKFLOW_ADMIN_AGENT_NOTIFICATION_TARGET_ADMISSION_V1

THIS_BOOTSTRAP_SPEC_AUTHORIZES_ACTIVATION =
NO
```

**Batch 4（Revision 4 clean-base replacement 指令 2026-08-27）：**

```text
REVISION_4_CLASS =
CLEAN_BASE_AND_PARENT_SEMANTIC_ALIGNMENT

REPLACED_PR =
mayf3/dsh-agent-core#67

OLD_REVISION_3_HEAD =
fea8f2996129d8b797a1b950fea47983e2b1e30b

CLEAN_BASE =
b620907fc6f58292b6ee096c977f0071921d747e

CREDENTIAL_LAYER_VERIFICATION =
PASS | FAIL | INCONCLUSIVE

BUSINESS_GRANT_READINESS =
READY | NOT_READY

ZERO_GRANT_DETERMINISTIC_400_INVALID_SCOPE =
reason = machine_grant_missing;
CREDENTIAL_LAYER_VERIFICATION_PASS_AND_BUSINESS_GRANT_NOT_READY

ZERO_GRANT_BOOTSTRAP_RESULT =
SUCCESS_IDENTITY_ONLY

FINAL_DURABLE_RECEIPT_ALLOWLIST =
attemptId / principalId / clientId / requestDigests / status / evidenceRefs
```

---

## 1. Goal

为「单一 trusted Admin Agent 运行 svc-workflow 全局管理面」这一已接受产品方向
（`SVC_WORKFLOW_PRODUCT_BOUNDARY_V3`，`OWNER_USE_CASE =
SINGLE_USER_TRUSTED_ADMIN_AGENT`）补齐其 **Slice A 身份半边** 在本仓库的唯一权威：
精确授权一个**新的**专用 Agent 身份的建立方式、边界、顺序与证据义务。

```text
AUTHORITY_ID          = AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_V1
AUTHORITY_KIND        = governing_spec (implementation kind, docs-only delivery)
SUBJECT               = exactly one new dedicated Agent: agt_workflow-admin-agent
THIS_ROUND            = SPEC_ONLY (single new file; no execution)
ACTIVATION            = independent review + Owner acceptance + merge to main
POST_MERGE_AUTHORITY  = bounded implementation authority (implementation_authority: contracts)
IDENTITY_BOOTSTRAP_EXECUTION_IN_THIS_AUTHORING_ROUND = NO
```

治理权威形式冻结（Revision 3，§0 Batch 3；治理协议只承认
`implementation_authority: none | contracts`，本 Spec 不携带任何自创 authority 字段）：

```text
DOCS_MERGE_PERFORMS_RUNTIME_WRITE =
NO

ACCEPTED_AND_MERGED_SPEC_AUTHORIZES_BOUNDED_IMPLEMENTATION =
YES

SEPARATE_EXECUTION_TASK_REQUIRED =
YES

SEPARATE_EXECUTION_SPEC_REQUIRED =
NO

EXECUTION_ALLOWED_ONLY_WHEN =
the exact accepted Spec revision is present in the implementation base;
preflight reports IMPLEMENTATION_ALLOWED=YES;
the execution task records exact implementation/evidence coordinates;
Contract-by-Contract conformance is evaluated.

IDENTITY_BOOTSTRAP_EXECUTION_IN_THIS_AUTHORING_ROUND =
NO
```

也就是说：这份 Spec accepted + 合入 main 后即成为上述单次有界身份 bootstrap 的
合法实现权威；**合并文档本身不执行任何生产写入**；实际执行必须由另一次独立
派发的「身份 执行」任务完成，且该任务必须绑定 exact accepted Spec revision、
implementation Base 与逐 Contract conformance record（CTR-WA-008）。

「身份 执行」round 的**唯一目标产出**：

```text
0. docs/evidence/workflow-admin-agent-bootstrap-v1/attempt-ledger.json ——
   durable 非 secret attempt ledger，在首次外部写入前原子创建（CTR-WA-010）
1. agents.json 新增恰好 1 条 entry：{ id: agt_workflow-admin-agent, name: 工作流总管,
   disabled: true, description: null }（CTR-WA-001；初始 disabled:true——启用另需
   独立 activation authority，CTR-WA-009）
2. auth-service 机器身份（S1/S2 幂等 seam，deterministic external_refs，
   principal_type=agent，owner_user_id absent）（CTR-WA-002）
3. trusted credential store entry（AGENT_CORE_CREDENTIALS_FILE，Part G 契约）（CTR-WA-004）
4. verification mint 按父 D.5 分类为 `CREDENTIAL_LAYER_VERIFICATION = PASS`；
   exact 零 Grant（`machine_grant_missing`）的 deterministic
   `400 invalid_scope` 同时记录
   `BUSINESS_GRANT_READINESS = NOT_READY` 与 `BOOTSTRAP_RESULT = SUCCESS_IDENTITY_ONLY`
   （CTR-WA-005）
5. docs/evidence/ 下 final durable receipt，字段严格且仅为 `attemptId`、
   `principalId`、`clientId`、`requestDigests`、`status`、`evidenceRefs`；其余详细
   运行数据只在 attempt ledger / evidence artifact（CTR-WA-006）
```

## 2. Scope and non-goals

### 2.1 In scope（仅在 CTR-WA-008 执行门全部满足后的单次「身份 执行」round 内）

- 在首次外部写入前原子创建 durable 非 secret attempt ledger
  （`docs/evidence/workflow-admin-agent-bootstrap-v1/attempt-ledger.json`；
  CTR-WA-010），此后按阶段原子更新。
- 写入**恰好一条**新 Agent Definition entry（§0 冻结字段，**初始 `disabled: true`**
  （§0 Batch 2）；deployment-side writer seam；`defaultAgentId` 不变；不触碰任何
  既有 entry）。
- 经 auth-service 既有幂等 seam（S1 `POST /api/v1/principals` / S2
  `POST /api/v1/clients`）以 §0 冻结的 deterministic external_refs 建立 ownerless
  agent principal 与 machine client（调用体逐字冻结于 CTR-WA-002；S1/S2
  `outcome_unknown` 按 CTR-WA-010 分类决策树闭合）。
- 按 `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` Phase A（D.7.1/D.7.2）执行
  clean bootstrap，含 trusted store 写入（Part G）与 verification mint（D.5 分类）；
  **Phase A 语义完整继承，不重定义——成功门要求父 D.5 的
  `CREDENTIAL_LAYER_VERIFICATION = PASS`，不要求在业务 Grant 尚不存在时获得 token
  200**（CTR-WA-005）。exact zero-Grant（`machine_grant_missing`）
  deterministic `400 invalid_scope` ⇒ credential-layer PASS、grant NOT_READY、
  `SUCCESS_IDENTITY_ONLY`；只有 credential FAIL / INCONCLUSIVE / zero-Grant unproven
  才 ⇒ `BOOTSTRAP_RESULT = INCOMPLETE`、`IDENTITY_STATE = PARTIAL_SAFE_DISABLED`。
- 落盘 final durable receipt + supporting evidence；final receipt 严格使用 CTR-WA-006
  六字段闭合 allowlist，不含任何 secret；详细坐标、external_refs、时间、created/
  active 与前后计数只在 attempt ledger 或 evidence artifact。
- 失败/STOP 时的合法终态是 `SAFE_DISABLED_STAGED_IDENTITY`（CTR-WA-011）。
- 执行轮自身的 docs-only 提交（evidence + ledger 文件）。

### 2.2 Explicit non-goals（本 Spec 明确不授权；任何一项都需要各自独立权威）

```text
SVC_WORKFLOW_PERMISSION_GRANT_IN_THIS_SCOPE = NO
  —— 不创建/修改任何 MachineAccessGrant、audience/scope 授权、svc-workflow
     permission supply（V3 §18 Slice C，auth-service 侧独立 child authority）

FEISHU_BINDING_IN_THIS_SCOPE = NO
  —— 不写任何 Binding/binding key、不配置 Feishu app/tenant/conversation/sender
     （V3 §18 Slice F，独立权威）

TRUSTED_ADMIN_AGENT_ROOT_IN_THIS_SCOPE = NO
  —— 不创建 SVC_WORKFLOW_TRUSTED_ADMIN_AGENT_ROOT_V1 或任何 designation 文件
     （V3 §18 Slice B，svc-workflow 仓库所有；exact UUID/Client 的 designation
     记录在该权威，不在本仓库）

DISABLED_TO_ENABLED_FLIP_IN_THIS_SCOPE = NO
  —— 本 Spec 及其「身份 执行」round 不执行 disabled:true -> false 的启用转换；
     启用必须经过独立受控 activation authority（§0 Batch 2 / DEC-WA-007 /
     CTR-WA-009）；Slice A 身份 bootstrap 不得自动启用

WORKSPACE_HOME_PROVISIONING = NO（含 DSH home、primary-workspaces.json、
  workspace-bootstrap、任何文件系统 provisioning）
CAPABILITY_MANIFEST_CHANGE  = NO（不新增 broker workflow capability）
SCHEDULER_CHANGE            = NO
RUNTIME_RELOAD_OR_RESTART   = NO
FLEET_CUTOVER_CHANGE        = NO（AGENT_TRUSTED_FLEET_CUTOVER_V1 的 exact-86
  roster、EXACT_ROSTER_SHA256=f046d18f…、冻结计划零改动；本 Agent 不进入
  primary-workspaces 映射）
AUTH_SERVICE_CODE_CHANGE    = NO_IN_REPO（auth-service 是外部 authority；
  AUTH_CHANGE_REQUIRED = EXTERNAL_ONLY，且本 Scope 连外部 grant 变更也不请求）
PRODUCT_CODE_CHANGE         = NONE（packages/** 零改动）
KERNEL_CHANGE               = NONE
```

### 2.3 身份可准备 ≠ Agent 可启动（disabled 状态语义冻结）

初始 `disabled: true`（§0 Batch 2）之下，「身份 执行」round 的身份准备**不受影响**：
Principal / Client / Credential / minimal final receipt 照常建立（DEC-WA-003 的完整 Phase A 链）。
但在 activation authority 翻转 `disabled` 之前，该 Agent **不可被任何表面启动**：

- **Notification**（notification-ingress → `agentRouter.deliver`）：current-main
  ingress 的 caller allowlist 只验证 `svc-forum` / `svc-workflow`，没有 target Agent
  allowlist，且 body 可直接指定 `agentId`；因此 caller allowlist + body `agentId`
  **不足以授权本 Agent 的投递或启动**。Router 必须先经 `resolveAgentRef`，
  `disabled:true` ⇒ 在 `ensureRunning` 前拒绝 admission（OBS-WA-009 / OBS-WA-010）。
- **Feishu**（feishu-connector → Router ingress → `ingress-delivery`）：同经
  `resolveAgentRef`，disabled ⇒ 拒绝路由。
- **Product API**（`router.route` / `router.switchAgent`）：同经 binding-resolution
  `resolveAgentRef`（:221），disabled ⇒ 拒绝路由。
- **Scheduler**（scheduler-router）：spawn 前置 `AGENT_DISABLED` 门，disabled ⇒
  不运行。
- **零 spawn**：process-registry `assertRunnable` 在 lifecycle entry 拒绝
  （`AGENT_DISABLED`）——definition config 是「哪些 Agent 可能 RUN」的唯一权威，
  即使存在仍指向它的 Binding 也绝不 (re)start。
- **零 Workspace/Home 自动创建**：workspace/Home provisioning 只发生在
  ensure/spawn 路径（process-registry `provisionAgentHome`；workspace-bootstrap
  sanitize）；不可启动 ⇒ 不触发任何 provisioning。

disabled Agent 仍保持身份可读（`getAgent` / `listAgents`）且永不能成为 default
（loader 不变量：`defaultAgentId` 必须解析到 enabled Agent，否则 CORRUPT_CONFIG）
（OBS-WA-009）。

本 Spec 建立的身份在 Slice B（designation root）与 Slice C（grant supply）生效前
另有两层 fail-closed 边界：无 svc-workflow grant ⇒ 任何 svc-workflow 权限调用
fail closed；无 Feishu Binding ⇒ 无 Feishu 路由。**这两项均不是 Notification
Ingress 的 target admission gate**：Notification 不要求 Feishu Binding，且允许
已授权 caller 在 body 指定 `agentId`（OBS-WA-010）。本 Spec 不因身份存在而激活
任何 Slice；即使身份与 credential 齐备，activation 之前仍必须由
`disabled:true` 的 definition gate 保持该 Agent non-routable / non-runnable
（CTR-WA-009）。

## 3. Authority and dependencies

```text
PRIMARY_PARENT_PRODUCT_DIRECTION = SVC_WORKFLOW_PRODUCT_BOUNDARY_V3
  repository = mayf3/svc-workflow
  authority_commit = d888241ac85ccadd581acdea9f7f7313a0e91bdc (V3 acceptance transition)
  merged_to_svc_workflow_main = 327b74f138151a7f4d9d88e3881e54d203f1e8f6
  relation = depends_on (Slice A decomposition: V3 §18；V3 §7 ADMIN_AGENT_STRATEGY =
    NEW_DEDICATED_AGENT；V3 §24 明确 exact UUID/Client 由后续 child authority 冻结)

INHERITED_IN_REPO_AUTHORITY = AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
  blob on this authoring base (main 73ec666) = df74e92759ad3083328dfd337667fc8a4ec618a0
  inherited_seams = Part C.4 external_ref 纯函数 · Part D/D.7 Phase A 固定顺序 ·
    Part G store 写契约 · Part H secret handoff · D.5 verification mint 分类表
  relation = reuse（本 Spec 是该 accepted 权威对单个新 Agent 的 subject-bounded
    适用，不修改其任何冻结）
  inherited_success_semantics (Revision 4) = Phase A clean-bootstrap verification
    完整按父 D.5 分类——200 或任一晚于 secret 验证的确定性 400 均可使
    CREDENTIAL_LAYER_VERIFICATION=PASS；exact zero-Grant v1 Client 仅在 reason =
    reason=machine_grant_missing 时将 deterministic 400 invalid_scope 记为
    credential-layer PASS + BUSINESS_GRANT_READINESS=NOT_READY + SUCCESS_IDENTITY_ONLY；
    requested_scope_not_granted alone = zero-Grant unproven；credential invalid / profile conflict / transport
    inconclusive / malformed response / unclassified failure 才是 INCOMPLETE
    （CTR-WA-005）

CURRENT_MAIN_INGRESS_REFERENCE (Revision 2 factual reconciliation):
  dsh-agent-core main = b3a6d4fe089c4b95bdc22df0cabd24eeb3ccb724
  merged change = PR #63 Notification Ingress service auth + idempotency
  notification target semantics = caller allowlist exists; target Agent allowlist absent;
    body.agentId accepted; then agentRouter.deliver -> resolveAgentRef -> ensureRunning
  consequence = caller authorization does not authorize target activation; disabled:true
    is the pre-activation target admission/process gate (OBS-WA-010 / CTR-WA-009)

EXTERNAL_REFERENCE (interoperates_with, no local supersession):
  mayf3/auth-service 坐标（Revision 1 2026-08-25 核准；线性 ancestry 已核实：
  170736e ⊂ 45b1b890 ⊂ d529bd3c）：
    historical source snapshot = 170736e42eb882277011796a98bb415a65d0e84c
      （2026-07-31；authoring 轮源码核实所用的历史快照——原稿曾误标为
       “main HEAD at authoring”，Revision 1 更正）
    authoring-time main        = 45b1b890a0fcd3ca1aeb433dee85a0b3ae283689
      （2026-08-23；authoring round 2026-08-24 当时的 auth-service github/main）
    current main (Revision 1)  = d529bd3c28ece3967149ad793794f8dac2020276
      （2026-08-24；Revision 1 复核当日 auth-service github/main）
  S1/S2 seam 与 ownerless agent principal 创建语义在上述三个修订上一致
  （OBS-WA-006）。生产 reviewed source revision 3b2ae71c38905c72039…（Stage F
  manifest）与 main 的 mint 检查漂移经 Revision 1 四修订对照更正：owner 要求仅
  存在于历史快照，authoring-time main 起已与生产修订一致（OBS-WA-007）。
  auth-service 行为由其自身权威治理，本 Spec 仅引用不改。

GOVERNANCE = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0 (accepted, current)
```

权威边界一句话：**产品方向（谁、为什么、分几片）在 svc-workflow V3；ensure 机制
（怎么建身份）在已接受的 credential provisioning Spec；本 Spec 只冻结「这一次、
这一个 Agent、这些精确值、这条边界」。**

## 4. Current State

- `STATE-WA-001` — 截至 authoring 基准（dsh-agent-core main `73ec666`，
  2026-08-24），三个仓库（dsh-agent-core / svc-workflow / auth-service，各自当前
  main 工作树）中**不存在**任何 `agt_workflow-admin-agent` 或 `工作流总管` 的引用、
  definition、principal、client、binding 或 grant 记录；仓库内已记录的
  `agentcore:v1:*` 身份 receipt 仅 `agt_stock_agent` 与 `agt_cto-agent` 两个 canary。
  Basis: `OBS-WA-004`, `OBS-WA-008`。执行轮必须在执行时**重新核实**该状态
  （`CTR-WA-003`），本 State 不免除该义务。Revision 1（2026-08-25）复核：三仓库
  重跑同一 grep——dsh-agent-core（本 PR 分支）/ auth-service main `d529bd3c` /
  svc-workflow 本地 main `6f1f546`——仍零命中（唯一命中为本 Spec 文件自身）。
- `STATE-WA-002` — 本 Spec authoring round 的 repo delta = 本文件一个新文件；
  工作树基于 `73ec666`（github/main HEAD at authoring）。Revision 1（2026-08-25）
  修订轮 delta = 仅修改本文件（同 PR 第二个 commit），基仍为 `73ec666`，不
rebase、不 force-push。Revision 2（2026-08-25）继续在同一 PR branch 原位修订
同一 proposed Spec；入口事实以 current-main ingress coordinate `b3a6d4fe` 复核，
repo delta 仍仅本文件，不 rebase、不 force-push。Revision 3（2026-08-26）在同一
PR branch 原位修订同一 proposed Spec：以普通 merge 合入 current main
`c52bd1ca2720bbea763a9fd9eb4b9069285b47ff`（无冲突），相对 current main 的净变化
仍仅本文件，不 rebase、不 force-push。Revision 4（2026-08-27）不再向旧分支追加：
从执行时最新 main `b620907fc6f58292b6ee096c977f0071921d747e` 创建 clean replacement branch，
只从旧 head `fea8f2996129d8b797a1b950fea47983e2b1e30b` 导入本目标文件并修订；替代分支
不得含 merge commit，最终 base..HEAD 恰好一个 docs-only commit，diff 恰为新增本
Spec 文件。Basis: 四轮 git 状态与 PR Conversation reconciliation record。

## 5. Observations

### OBS-WA-001 — V3 已接受并合入 svc-workflow main，Slice 分解生效

- Subject: svc-workflow 产品方向权威状态。
- Source revision: `327b74f138151a7f4d9d88e3881e54d203f1e8f6`（github/main merge of
  PR #8）；V3 acceptance transition `d888241ac85ccadd581acdea9f7f7313a0e91bdc`。
- Method: 读取 `docs/product/SVC_WORKFLOW_PRODUCT_BOUNDARY_V3.md` frontmatter/§1/§25
  与分支包含关系。
- Result: V3 `status: accepted`，`OWNER_USE_CASE = SINGLE_USER_TRUSTED_ADMIN_AGENT`；
  §18 将 Admin Agent 落地分解为 Slice A（identity）/ B（designation root）/
  C（auth-service permission supply）/ D/E（svc-workflow 实现）/ F（dsh-agent-core
  Feishu 路由），各 Slice 独立权威、互不代为激活（CTR-V3-031）。
- Provenance: svc-workflow 仓库与 PR #8 记录。

### OBS-WA-002 — V3 冻结「新建专用 Agent」，禁止复用，UUID/Client 留给 child authority

- Subject: V3 §7 / §24 / §22。
- Source revision: 同 OBS-WA-001。
- Method: 条文读取。
- Result: `ADMIN_AGENT_STRATEGY = NEW_DEDICATED_AGENT`；
  `EXISTING_BUSINESS_OR_CANARY_AGENT_REUSE = FORBIDDEN_BY_DEFAULT`；§24 明确
  exact Admin Agent Principal UUID 与 Client ID「intentionally not open Product
  Direction decisions」，由后续 designation/child authority 冻结；§22 记录复用
  business/canary Agent 被否决（管理权威需要独立身份与 credential lifecycle）。
- Provenance: V3 原文。

### OBS-WA-003 — 本仓库已接受的 credential provisioning 权威冻结了全部 ensure 机制

- Subject: dsh-agent-core `docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1.md`。
- Source revision: main `73ec666`，blob `df74e92759ad3083328dfd337667fc8a4ec618a0`。
- Method: 全文读取。
- Result: 冻结 `principalExternalRef(agentId) = "agentcore:v1:principal:"+agentId`、
  `clientExternalRef(agentId) = "agentcore:v1:client:"+agentId`（Part C.4）；S1/S2
  幂等 seam 与调用体（`principal_type="agent"`、`agent_id=agt_*`、`owner_user_id`
  不传，Owner Ruling `AGENT_PRINCIPAL_HUMAN_OWNER_RULING_V1`）；Phase A clean
  bootstrap 固定顺序 D.7.1（store 先读先校验、entry absent 才 S1/S2、existing
  entry 一律 fail-loud `existing_credential_resolution_required` 零 Auth 调用）；
  Part G validate-preserve-atomic store 写契约；Part H secret 唯一路径
  （HTTPS body → 进程内存 → 0600 store，env/argv/stdout/log/child/workspace 全禁）；
  D.5 verification mint 分类表（401 多因、profile 类 401 记 (d) 证据、不触发
  rotation）。
- Provenance: 该 Spec 正文（Amendment 1–6）。

### OBS-WA-004 — 无既有 workflow-admin-agent 引用（全新实体）

- Subject: 三仓库当前 main 工作树。
- Source revision: dsh-agent-core `73ec666` / svc-workflow（本地 main 落后于远端，
  以 V3 合入后的 `327b74f` 为准）/ auth-service `170736e`。
- Method: `grep -rln "工作流总管|workflow-admin-agent"`（排除 node_modules；2026-08-24）。
- Result: 零命中。
- Provenance: 本轮调查命令记录。Revision 1（2026-08-25）重跑：dsh-agent-core 本
  PR 分支 / auth-service main `d529bd3c`（Revision 1 更正后的 current main）/
  svc-workflow 本地 main `6f1f546`，仍零命中（唯一命中为本 Spec 文件自身）。

### OBS-WA-005 — `agt_workflow-admin-agent` 是合法 agentId；语义 id 有生产先例

- Subject: `packages/agent-definition/src/definition.js`（Agent Definition 格式权威）。
- Source revision: main `73ec666`。
- Method: 源码读取（`AGENT_ID_RE = /^agt_[A-Za-z0-9_-]+$/`；`generateAgentId()`）。
- Result: `agt_workflow-admin-agent` 匹配 id 合法性正则；`generateAgentId()` 的
  32-hex 仅为 writer 侧默认铸造函数，非格式约束；语义 id 生产先例：
  fleet canary `agt_build-in-public-agent`（AGENT_TRUSTED_FLEET_CUTOVER_V1 冻结）、
  `agt_cto-agent`（PR #59 subject）。Definition 只承载 identity+display
  （persona/workspace/credential 字段 fail-loud 拒绝）。
- Provenance: 源码与两份 accepted Spec。Revision 1（2026-08-25）复核：
  `definition.js:82` 同一 `AGENT_ID_RE`，结论不变。

### OBS-WA-006 — auth-service S1/S2 seam 存在且 ownerless agent principal 创建被允许

- Subject: auth-service（三个坐标修订）。
- Source revision（Revision 1 2026-08-25 核准）: historical snapshot
  `170736e42eb882277011796a98bb415a65d0e84c`；authoring-time main
  `45b1b890a0fcd3ca1aeb433dee85a0b3ae283689`；current main
  `d529bd3c28ece3967149ad793794f8dac2020276`。
- Method: 三修订源码读取 `src/routes/idempotent.ts`（存在；POST `/v1/principals`
  与 POST `/v1/clients` 两个 S1/S2 路由均在）与 `src/lib/oauth/v1/idempotent.ts`
  （`effectiveOwnerUserId = effectiveType === 'agent' ? (ownerUserId ?? null) :
  null`，line 279，三修订逐字一致）。
- Result: S1/S2 幂等 identity seam 在全部三个修订存在；S1 创建 ownerless agent
  principal（`ownerUserId ?? null`）在全部三个修订被允许，digest=(agent, agt_*)
  稳定。（`45b1b890` 起另增 GET by-external-ref 发现路由，与本 Spec 的 S1/S2
  ensure 链无关。）
- Provenance: auth-service 源码（`git show <rev>:<path>` 三修订对照）。

### OBS-WA-007 — mint 检查漂移仅存在于历史快照；authoring-time main 起已与生产修订一致（Revision 1 更正）

- Subject: v1 token mint 的 `assertPrincipalProfile`
  （`src/lib/oauth/v1/direct.ts:72-78`）。
- Source revision（Revision 1 2026-08-25 四修订对照）: historical snapshot
  `170736e`——agent 缺 `agentId` **或** `ownerUserId` ⇒ 401
  `agent_profile_invalid`；authoring-time main `45b1b890`、current main
  `d529bd3c`、生产 Stage F reviewed source `3b2ae71c`——同函数**只**检查
  `agentId`，无 ownerUserId 要求。
- Method: 四 revision `git show` 源码对比。
- Result: 原稿记录的「main HEAD 存在 owner 要求 vs reviewed 生产修订不存在」
  漂移，经 Revision 1 更正坐标后**不复存在**——owner 要求只存在于历史快照
  `170736e`（2026-07-31），在 authoring-time main（`45b1b890`，2026-08-23）之前
  已移除，main 与 reviewed 生产修订一致。**部署面实际运行修订仍未现场确认** ⇒
  执行轮现场重新观测义务保留不变；verification mint 的结果分类一律按 D.5 规则
  处理（profile 类 401 记为 credential-spec 前置 (d) 证据 / INCONCLUSIVE，绝不
  下钻为 secret invalid）——该保守 posture 不因漂移收敛而降低。
- Provenance: 四处源码 + Stage F manifest
  `migration_review.reviewed_source_git_commit`。

### OBS-WA-008 — S1/S2 身份建立已有生产先例并留有 commit 过的 receipts

- Subject: Stage F identity receipts（已合入本仓库 main）。
- Source revision: commit `20a00f2`（`docs/evidence/workflow-recovery-stage-f-20260822/`）。
- Method: 读取 `manifest.json` 与 `identity-cto.json`。
- Result: `agt_stock_agent`（principal `a484b423-…`）与 `agt_cto-agent`（principal
  `4e5a4578-…`）经 `agentcore:v1:principal/client:<agentId>` external_refs 建立，
  `created=true`、principal/client `active=true`、`principal_type=agent`；receipt
  记录 `principal_id` + `client_id`（`mc_` + 随机段），**不含 secret**；manifest
  对每份 receipt 记录 sha256。
- Provenance: 本仓库 main 上的 evidence 文件。

### OBS-WA-009 — disabled:true 的运行面 enforcement 链（Revision 1 新增核实）

- Subject: 本仓库全部 Agent 启动表面。
- Source revision: dsh-agent-core `73ec666`（PR #67 base = github/main at
  authoring；Revision 1 于 2026-08-25 重读核实）。
- Method: 源码读取（下列文件/行号）。
- Result:
  - `packages/agent-definition/src/definition.js:40-43` —— `disabled` 是唯一
    operational-state 字段（AGENT_DEFINITION_ACCESS_V1）：disabled Agent 保持
    身份可读（getAgent/listAgents，:319-343），但 `resolveAgentRef` 拒绝路由，
    且永不能成为 default（`defaultAgentId` 必须解析到 enabled Agent，否则
    CORRUPT_CONFIG，:233-235）。
  - `packages/agent-router/src/binding-resolution.js:41-45` —— Router 的
    `resolveAgentRef` 直接包 agent-definition 同名函数；
    `packages/agent-router/src/ingress-delivery.js:201` 在投递路径调用 ⇒
    **Feishu ingress（feishu-connector → Router ingress）与 notification-ingress
    （→ `agentRouter.deliver`）共用此门**，disabled ⇒ 拒绝路由。
  - `packages/product-api/src/index.js`（`router.switchAgent` :200；
    `router.route` :211 起，注释明言「The SAME path every entry uses:
    resolve -> binding -> ensureRunning」）—— Product API 不能启动 disabled
    Agent（switchAgent 经 binding-resolution `resolveAgentRef` :221）。
  - `packages/agent-router/src/process-registry.js:235-252` ——
    DISABLED_ENFORCEMENT（merge review FIX 1）：definition config 是「哪些
    Agent 可能 RUN」的唯一权威；disabled ⇒ lifecycle entry 结构化拒绝
    `AGENT_DISABLED`，绝不 spawn（即使 Binding 仍指向它）。
  - `packages/scheduler-router/src/index.js:67-91` —— spawn 前置同一
    `AGENT_DISABLED` 门（merge review FIX 2，先于 `ensureRunning`）。
  - workspace/Home provisioning（`provisionAgentHome`，process-registry deps
    :43；workspace-bootstrap sanitize）只发生在 ensure/spawn 路径 ⇒ 不可启动
    即零 Workspace/Home 自动创建。
- Provenance: 本仓库源码（Revision 1 复读）。

### OBS-WA-010 — current-main Notification Ingress 不提供 target Agent allowlist

- Subject: `packages/notification-ingress` 到 Router 的 target admission 链。
- Source revision: dsh-agent-core current-main reconciliation coordinate
  `b3a6d4fe089c4b95bdc22df0cabd24eeb3ccb724`（PR #63 merge）。
- Method: 源码读取 `notification-ingress/src/auth.js:49-50`、
  `wire-response.js:53-64`、`deliver-handler.js:113-170` 与
  `agent-router/src/ingress-delivery.js:178-224`。
- Result:
  - Notification Ingress 的 operator allowlist 只允许 caller names
    `svc-forum` / `svc-workflow`，验证的是已认证 client 是否为获准**调用方**；
  - wire body 接受四字段，其中 `agentId` 是 caller 直接提供的 non-empty string；
    ingress 未维护、未检查 target Agent allowlist；Feishu Binding 也不在该路径；
  - durable idempotency reserve 后，handler 将 payload 原样交给
    `agentRouter.deliver`；Router 调用 `resolveAgentRef(agentId)`，随后调用
    `ensureRunning(agent.id)`；
  - 因而 caller allowlist + body `agentId` 不构成 target activation authority。
    本 Agent activation 前的构造性门必须是 Agent Definition
    `disabled:true`：`resolveAgentRef` 以 `AGENT_NOT_FOUND` 拒绝 admission（Ingress
    记为 proven no-admission），process-registry `assertRunnable` 再以
    `AGENT_DISABLED` 提供 lifecycle-entry defense in depth，二者都先于 spawn。
- Provenance: current-main 源码 + PR #67 Conversation comment
  `WORKFLOW_ADMIN_AGENT_INGRESS_RECONCILIATION`。

### OBS-WA-011 — current main 的 Agent Definition writer seam 清单：无通用 enable seam，无 remove seam（Revision 3 新增核实）

- Subject: `packages/agent-definition/src/config.js` 与 `src/access.js` 导出的全部
  deployment-side writer seam。
- Source revision: dsh-agent-core current main `c52bd1ca2720bbea763a9fd9eb4b9069285b47ff`
  （Revision 3 合入基；含 PR #74/#76 route-chain 变更后复核——该变更不触碰
  agent-definition writer 家族）。
- Method: 导出符号清点与源码读取。
- Result:
  - 存在的 seam：`writeAgentDefinition`、`adoptAgents`、`createAgentInConfig`
    （:253）、`updateAgentInConfig`（:279——**只允许 display 字段**，docstring
    明言 `disabled is NOT touchable through update (use disableAgentInConfig)`，
    且 `id` IMMUTABLE）、`disableAgentInConfig`（:312——**单向** disabled:false→true；
    禁用当前 default 被拒绝 VALIDATION_ERROR）、`setDefaultAgentInConfig`（:341）；
  - **不存在** `enableAgentInConfig` 或任何 disabled:true→false 的通用 writer
    seam——`updateAgentInConfig` 显式不可触碰 `disabled`；
  - **不存在** `removeAgentInConfig` / `deleteAgentInConfig` 或任何 Agent Definition
    entry 删除 seam（`access.js:27` 导入清单亦无）。
- Consequence（本 Spec 两处冻结的事实基础）：
  1. 任何「失败后把 Agent 删除回不存在」的 rollback 要求都依赖不存在的 remove
     seam ⇒ 本 Spec 失败终态冻结为保留 disabled entry 的
     `SAFE_DISABLED_STAGED_IDENTITY`（CTR-WA-011）；
  2. `disabled:true → false` 在 current main 没有任何现存可调用 seam ⇒ activation
     authority 必须自带 exact-subject、one-time、非通用的配置事务（CAS + 原子写 +
     reload + post-read + evidence；CTR-WA-012），不得声称有现存 enable seam 可用。
- Provenance: 本仓库 current-main 源码（Revision 3 复核）。

## 6. Claims and assumptions

### CLM-WA-001 — 本 subject 是 Phase A clean bootstrap 候选

- Support state: SUPPORTED
- Supported by evidence: `EVD-WA-001`
- Contradicted by evidence: none known
- Uncertainty: 仓库记录不能穷尽生产 out-of-band 状态；执行轮的 store-absent 检查与
  S1/S2 deterministic external_ref 语义可找回同一身份；S1 `created=false` 可继续，
  S2 `created=false` 则因 raw secret 不可读回而结构化 STOP（CTR-WA-002），共同
  构成不制造平行身份的冻结兜底。

### CLM-WA-002 — 身份本身不授予任何 svc-workflow 权限

- Support state: SUPPORTED
- Supported by evidence: `EVD-WA-002`
- Contradicted by evidence: none known
- Uncertainty: none（V3 §10/§11 与 credential spec「credential ≠ grant」（Part E、
  S2 新建 client 零 grant）双重冻结）。

### CLM-WA-003 — S1/S2 建身份语义在三个核验修订上一致；四修订 mint 对照中 owner 检查仅存在于历史快照

- Support state: SUPPORTED
- Supported by evidence: `EVD-WA-003`
- Contradicted by evidence: none known
- Uncertainty: 部署修订未在本次 authoring/revision 中现场确认（OBS-WA-007）。
  Revision 4 精确继承父 D.5：必须完成 verification mint 并得到
  `CREDENTIAL_LAYER_VERIFICATION = PASS`，但 PASS 不等于必须 HTTP 200。零 Grant
  v1 Client 只有在 `400 invalid_scope` reason=`machine_grant_missing` 时才是 exact
  zero-Grant credential-layer PASS，同时
  `BUSINESS_GRANT_READINESS = NOT_READY` 与
  `BOOTSTRAP_RESULT = SUCCESS_IDENTITY_ONLY`；`requested_scope_not_granted` 单独不足。profile 类 401 在父 D.5 无法排除时为
  INCONCLUSIVE——既不默认归因 secret invalid、不触发 blind rotate，也不得报告成功。

### CLM-WA-004 — disabled:true 使该 Agent 在身份齐备后仍不可被任何表面启动

- Support state: SUPPORTED
- Supported by evidence: `EVD-WA-004`
- Contradicted by evidence: none known
- Uncertainty: none（OBS-WA-009 的 enforcement 链是本仓库源码的构造性语义；
  未来若有表面绕过 definition gate，属于新权威必须处理的变化，不属本 Spec
  裁量。）

### CLM-WA-005 — Notification caller authorization 不等于 target Agent activation authorization

- Support state: SUPPORTED
- Supported by evidence: `EVD-WA-005`
- Contradicted by evidence: none known
- Uncertainty: none（current-main ingress 链明确没有 target allowlist；本 Agent 的
  pre-activation target gate 由 `disabled:true` definition 语义承担）。

## 7. Evidence relations

### EVD-WA-001 — 无既有身份记录支持 clean-bootstrap 判断

- Source observations: `OBS-WA-004`, `OBS-WA-008`
- Target: `CLM-WA-001`
- Relation: SUPPORTS
- Bound coordinates: 三仓库 2026-08-24 main 状态；Stage F evidence @ `20a00f2`
- Strength/sufficiency: 对仓库记录充分；对生产 out-of-band 状态不充分（由 CTR-WA-003
  执行轮复核兜底）
- Limitations: 不声称生产 DB/secret store 中物理不存在任何对象
- Provenance: OBS 编号所列命令与文件

### EVD-WA-002 — 产品方向与 grant 分离冻结支持「身份 ≠ 权限」

- Source observations: `OBS-WA-001`, `OBS-WA-002`, `OBS-WA-003`
- Target: `CLM-WA-002`
- Relation: SUPPORTS
- Bound coordinates: V3 @ `d888241`；credential spec blob `df74e927`
- Strength/sufficiency: 充分（双权威同向冻结）
- Limitations: none

### EVD-WA-003 — 源码对比支持「三修订创建语义一致、四修订 mint 检查漂移」的边界表述

- Source observations: `OBS-WA-006`, `OBS-WA-007`
- Target: `CLM-WA-003`
- Relation: SUPPORTS
- Bound coordinates: S1/S2 = auth-service `170736e` / `45b1b890` / `d529bd3c`
  （三修订）；mint profile = 上述三修订 + `3b2ae71c`（四修订对照，Revision 1）
- Strength/sufficiency: 对 S1/S2 三 revision 与 mint profile 四 revision 分别充分
- Limitations: 未核验 `3b2ae71c` 的 S1/S2（本 Claim 不作该主张）；部署面实际运行
  修订未现场确认

### EVD-WA-004 — 本仓库源码 enforcement 链支持「disabled ⇒ 不可启动、零 spawn、零 provisioning」

- Source observations: `OBS-WA-009`
- Target: `CLM-WA-004`
- Relation: SUPPORTS
- Bound coordinates: dsh-agent-core PR #67 base `73ec666`（= github/main at
  authoring）与 Revision 2 current-main ingress reconciliation `b3a6d4fe`
- Strength/sufficiency: 充分（五个表面的 gate 均为源码构造性语义；新增 ingress
  的 Router path 已在 current-main coordinate 复核）
- Limitations: 不覆盖未来新增的运行表面
- Provenance: OBS-WA-009 / OBS-WA-010 所列文件与行号

### EVD-WA-005 — current-main ingress 链支持「caller allowlist ≠ target activation」

- Source observations: `OBS-WA-010`
- Target: `CLM-WA-005`
- Relation: SUPPORTS
- Bound coordinates: dsh-agent-core `b3a6d4fe089c4b95bdc22df0cabd24eeb3ccb724`
- Strength/sufficiency: 对该 current-main Notification Ingress pipeline 充分
- Limitations: future ingress semantic change 必须由后续 authority 重新核实
- Provenance: OBS-WA-010 所列 current-main 源码

## 8. Decisions

### DEC-WA-001 — 新建专用 Agent；一切复用被 Owner 禁止

- Decision owner: `mayf3`（§0 冻结）
- Decision: subject 是**新的** `agt_workflow-admin-agent`；
  `EXISTING/BUSINESS/CANARY/SECURITY_CEO_CTO_AGENT_REUSE = FORBIDDEN`——包括但不
  限于 `agt_cto-agent`（即使其 principal 已是 svc-workflow successor principal）、
  `agt_stock_agent`、`agt_build-in-public-agent` 及 exact-86/91 roster 中任何成员。
- Rejected alternative: 复用任何既有 Agent（V3 §22 已否决；§0 冻结）。
- Owner input remaining: none。

### DEC-WA-002 — 身份映射零裁量：external_refs 逐字冻结，ClientID 只接受生成值

- Decision owner: `mayf3`（§0 冻结 + 继承 Part C.4）
- Decision: `PRINCIPAL_EXTERNAL_REF` / `CLIENT_EXTERNAL_REF` 逐字采用 §0 值
  （与 Part C.4 纯函数对该 agentId 的输出逐字节相等）；`CLIENT_ID` 只接受 S2
  response 中的 auth 侧生成值（`mc_` 前缀），任何预测、预写、hard-code、
  expected_client_id claim 均禁止。
- Rejected alternative: 实现轮自行决定 identity mapping（Part C.4 已明令禁止）。
- Owner input remaining: none。

### DEC-WA-003 — 「身份 执行」round 包含 trusted store entry 写入

- Decision owner: `mayf3`
- Decision: 单次执行轮的链是完整的 Phase A clean bootstrap（S1→S2→secret 按
  Part H 进 0600 store→verification mint 记录），不是只建 Auth 对象——secret 仅
  在 S2 created=true 时一次性返回，不落 store 即永久丢失，且会违反 Part H 唯一
  合法路径。
- Rejected alternative: 只建 principal/client、secret 丢弃（违反 Part H；
  不可恢复）。
- Owner input remaining: none。

### DEC-WA-004 — 权限/Binding/designation/workspace 全部出界（Slice 分离）

- Decision owner: `mayf3`（§0 冻结）
- Decision: `SVC_WORKFLOW_PERMISSION_GRANT_IN_THIS_SCOPE = NO`、
  `FEISHU_BINDING_IN_THIS_SCOPE = NO`、`TRUSTED_ADMIN_AGENT_ROOT_IN_THIS_SCOPE =
  NO`；workspace/Home 同样出界。exact UUID/Client 的 designation 记录由
  svc-workflow 侧 `SVC_WORKFLOW_TRUSTED_ADMIN_AGENT_ROOT_V1`（Slice B）持有，
  该权威将引用本 Spec 执行轮 minimal final receipt 中的精确值。
- Rejected alternative: 顺手在本轮授 grant / 建 binding（V3 CTR-V3-031 禁止
  Slice 间代为激活）。
- Owner input remaining: none。

### DEC-WA-005 — Final receipt 最小化；详细证据留 ledger/artifact；secret 永不落盘

- Decision owner: `mayf3`（§0 Batch 4 冻结）
- Decision: final durable receipt 是闭合 schema，字段严格且仅为 `attemptId`、
  `principalId`、`clientId`、`requestDigests`、`status`、`evidenceRefs`。exact Spec/Base、
  agentId、external_refs、阶段/时间、created/reused/outcome_unknown、active 状态、
  repository coordinates、agents.json 前后计数与 sha256 等详细运行数据只允许存在于
  attempt ledger 或其引用的 evidence artifact，不得复制到 final receipt；
  `SECRET_IN_GIT_OR_REPORT = FORBIDDEN`。
- Rejected alternative: 复用较宽的 Stage F receipt shape；在 final receipt 中加入
  allowlist 外字段；报告中含 secret 前缀/摘录。
- Owner input remaining: none。

### DEC-WA-006 — 执行失败保留 disabled entry、确定性重入或 STOP、绝不平行身份

- Decision owner: `mayf3`
- Decision: T4 之后的任何 STOP 保留已写入的 Agent Definition entry（disabled:true
  ⇒ 任何表面不可启动；credential 未写入时 Broker 侧另 fail-closed
  `credential_unavailable`）并如实记录——失败终态是
  `SAFE_DISABLED_STAGED_IDENTITY`（DEC-WA-010 / CTR-WA-011），**不删除 entry**
  （current main 无 remove seam，OBS-WA-011；失败即删也是被否决的反模式）。重入/
  recovery 必须先读取同一 attempt ledger（CTR-WA-010），复用同一 attemptId 与
  同一 external_refs；S1 `created=false` 或 `outcome_unknown` 解析为 exact principal
  external_ref PRESENT exact-match 时可确定性找回**同一 principal** 并继续；但
  store entry absent 前提下，S2 `created=false` 或 `outcome_unknown` 解析为
  CLIENT_PRESENT_AND_SECRET_UNAVAILABLE 表示 existing client 的 raw secret 已不可
  读回，MUST STOP `existing_credential_resolution_required`，
  `BOOTSTRAP_RESULT = INCOMPLETE`，不得谎称 clean-bootstrap 可自动恢复。该状态
  只能由继承权威 Phase B 的 SAME-client rotation 独立后续权威处理（CTR-WA-010
  冻结的唯一恢复路径）；本 Spec 与本执行轮禁止 unrecorded rotation、第二个
  principal/client 及 legacy `machine-admin client create`。
- Rejected alternative: 失败即删 entry 重来（依赖不存在的 remove seam 且可能制造
  平行身份）；将 S2 `created=false` / secret 不可取回当作可继续（响应没有 raw
  secret，无法合法写 store）；响应丢失后自动无记录 rotate。
- Owner input remaining: none。

### DEC-WA-007 — 初始 disabled:true；启用是独立受控 activation authority 的动作

- Decision owner: `mayf3`（§0 Batch 2 冻结，Revision 1 2026-08-25；Revision 3
  冻结 exact authority ID）
- Decision: T4 写入的 Definition entry 初始 `disabled: true`；身份链（Principal /
  Client / Credential / receipts）在 disabled 状态下照常完成；「身份 执行」round
  **不得**将 `disabled` 翻转为 `false`。`disabled:true → false` 的启用转换必须
  经过**独立受控 activation authority**，其 stable authority ID 冻结为
  `AGENT_CORE_WORKFLOW_ADMIN_AGENT_ACTIVATION_V1`，其 Notification target
  admission child 冻结为
  `AGENT_CORE_WORKFLOW_ADMIN_AGENT_NOTIFICATION_TARGET_ADMISSION_V1`（§0 Batch 3 /
  DEC-WA-011 / CTR-WA-009 / CTR-WA-012）。activation 前置条件、exact enable
  事务与 rollback 事务在本 Spec 完整冻结（CTR-WA-009 / CTR-WA-012），使该权威
  可据此独立起草、零 TBD。Slice A 身份 bootstrap 自动启用 = FORBIDDEN；
  Notification caller allowlist 命中与 body `agentId` 命中均不得被视为 activation
  authorization（OBS-WA-010）。
- Rejected alternative: bootstrap 完成即 enabled（原稿 `disabled: false`——Owner
  Revision 1 否决：身份准备与运行启用必须是两个独立受控步骤）；执行轮顺带启用
  （与 V3 Slice 分离 / CTR-V3-031 同构禁止）。
- Owner input remaining: none。

### DEC-WA-008 — 治理权威形式：contracts 字段 + docs merge 零运行时写入 + 独立执行任务（Revision 3 新增）

- Decision owner: `mayf3`（§0 Batch 3 冻结）
- Decision: 本 Spec 使用治理协议唯一认可的 `implementation_authority: contracts`
  形式；frontmatter 不携带 `identity_execution_authority`、
  `production_apply_authority` 或任何治理协议未识别的 authority 字段
  （Revision 3 已删除）。冻结：`DOCS_MERGE_PERFORMS_RUNTIME_WRITE = NO`——
  本 Spec 的 review/acceptance/merge 是文档生命周期事件，本身不触发、也不自动
  授权任何生产写入；accepted + merged 后本 Spec 成为单次有界身份 bootstrap 的
  合法实现权威；实际执行必须由**独立派发的执行任务**承载
  （`SEPARATE_EXECUTION_TASK_REQUIRED = YES`），且无需也不得再建第二份 Bootstrap
  Spec（`SEPARATE_EXECUTION_SPEC_REQUIRED = NO`——本 Spec 已是完整实现权威）。
  执行门冻结于 CTR-WA-008。
- Rejected alternative: 保留自创 authority 字段绕过治理（Revision 2 审计
  AUTHORITY_FORM_REVIEW=FAIL 的根因）；「merge 后即可执行一次真实写入」的自动
  执行语义（CONTRADICTORY，已删除）；为执行另写第二份 Bootstrap Spec（冗余，
  DUPLICATE_AUTHORITY 风险）。
- Owner input remaining: none。

### DEC-WA-009 — Durable attempt ledger 与 S1/S2 outcome_unknown 闭合（Revision 3 新增）

- Decision owner: `mayf3`（§0 Batch 3 冻结）
- Decision: 执行轮在首次外部写入前必须原子创建 durable 非 secret attempt ledger
  （exact path 冻结于 CTR-WA-010），绑定 exact Spec revision / Base / agentId /
  external_refs 与 S1/S2 canonical request digest；每阶段原子替换持久化；永不记录
  Client secret / Token / Authorization。S1/S2 响应丢失（`outcome_unknown`）时，
  必须先经 ledger + exact external_ref 解析分类再动作（ABSENT ⇒ 同 attemptId
  重试；PRESENT exact-match ⇒ 继续；PRESENT conflict ⇒ fail loud STOP）。S2
  解析为 CLIENT_PRESENT_AND_SECRET_UNAVAILABLE ⇒ STOP +
  `BOOTSTRAP_RESULT = INCOMPLETE`，唯一恢复路径是独立受控的 SAME-client
  rotation 执行（CTR-WA-010）；本执行轮不得自动、无记录地 rotate。
- Rejected alternative: 无 ledger 直接执行 S1/S2（审计不可恢复）；outcome_unknown
  后换 external_ref 重来（制造平行身份）；S2 reuse 时伪造/回显旧 secret（不可能
  合法——raw secret 一次性返回，不可读回）。
- Owner input remaining: none。

### DEC-WA-010 — Rollback 终态 = SAFE_DISABLED_STAGED_IDENTITY；零 Definition remove 依赖（Revision 3 新增）

- Decision owner: `mayf3`（§0 Batch 3 冻结）
- Decision: `AGENT_DEFINITION_REMOVE_REQUIRED = NO`（current main 无 remove seam，
  OBS-WA-011）。失败/放弃后的合法终态冻结为 `SAFE_DISABLED_STAGED_IDENTITY`：
  Agent Definition 保留在场且 `disabled = true`、`defaultAgentId` 不变、
  non-routable、non-runnable、无 Binding、无 workflow Grant、无 Root activation。
  按产生的外部状态执行收敛（credential-store entry ⇒ 父权威原子移除/reconciliation
  路径；Client ⇒ 需要时 revoke exact Client；Principal ⇒ 需要遏制时 disable exact
  Principal；durable audit/evidence ⇒ 永不删除）。重新执行必须读取同一 attempt
  ledger 收敛同一 subject，不创建第二身份。
- Rejected alternative: rollback 依赖不存在的 Definition remove seam（Revision 2
  审计 ROLLBACK_IMPLEMENTABILITY=FAIL 的根因）；把 rollback 伪装成「数据库从未
  发生过写入」；删除审计事实；临时复用业务 Agent 顶替。
- Owner input remaining: none。

### DEC-WA-011 — Activation authority 可独立起草：exact IDs + 前置 + 事务全部冻结（Revision 3 新增）

- Decision owner: `mayf3`（§0 Batch 3 冻结）
- Decision: `THIS_BOOTSTRAP_SPEC_AUTHORIZES_ACTIVATION = NO`——本 Spec 不授权
  activation，但必须把 activation authority 起草所需的全部稳定输入冻结：
  `ACTIVATION_AUTHORITY_ID = AGENT_CORE_WORKFLOW_ADMIN_AGENT_ACTIVATION_V1`、
  `TARGET_ADMISSION_AUTHORITY_ID =
  AGENT_CORE_WORKFLOW_ADMIN_AGENT_NOTIFICATION_TARGET_ADMISSION_V1`、activation
  前置条件（CTR-WA-009）、target admission child 保障、exact enable 事务与
  rollback 事务（CTR-WA-012）。具体 wire/storage 归该 child 自己所有，但稳定
  authority ID 与 activation 前置在本 Spec 冻结；不得留 TBD。
- Rejected alternative: activation authority 留 TBD（Revision 2 审计
  ACTIVATION_AUTHORITY_AUTHORABLE=NO 的根因）；把 caller allowlist
  （svc-forum / svc-workflow）当作 target activation authority（OBS-WA-010）；
  授权通用动态 `enable any Agent` API。
- Owner input remaining: none。

## 9. Contracts

### CTR-WA-001 — Agent Definition 精确单条写入

执行轮 MUST 已按 CTR-WA-010 原子创建 attempt ledger（本写入是首个外部写入），
再经 deployment-side writer seam（`createAgentInConfig` /
`writeAgentDefinition` 家族）向生产 `agents.json` 写入**恰好一条**新 entry：

```text
{ "id": "agt_workflow-admin-agent", "name": "工作流总管",
  "disabled": true, "description": null }
```

执行轮 MUST NOT：修改任何既有 entry、修改 `defaultAgentId`、写入任何
persona/workspace/credential/runtime 字段（loader 对此类字段 fail-loud）、将本
entry 的 `disabled` 置为 `false`（启用属独立 activation authority，CTR-WA-009）。
写入后 MUST 以读取校验（loader 或同语义校验）确认文档可加载、id 唯一、新 entry
在列且 `disabled === true`，并记录写入前后 agent 计数（N → N+1）与文档 sha256。

### CTR-WA-002 — Deterministic auth 身份，仅经 S1/S2 幂等 seam

执行轮 MUST 且只能经 S1/S2 建立 auth 身份，调用体逐字冻结（继承 Part C.4）：

```text
POST /api/v1/principals body = {
  external_ref: "agentcore:v1:principal:agt_workflow-admin-agent",
  principal_type: "agent",
  agent_id: "agt_workflow-admin-agent",
  display_name: "工作流总管"
}   // owner_user_id 不传（absent；Owner Ruling 冻结）

POST /api/v1/clients body = {
  external_ref: "agentcore:v1:client:agt_workflow-admin-agent",
  principal_id: <S1 返回的 principal id>
}
```

执行轮 MUST 记录 S1/S2 响应的 `created` 标志与 `status`（principal 非 `active`
⇒ STOP fail-loud `auth_principal_not_active`）。S1 `created=false` 是合法的幂等找回，
MUST 视为同一 principal 继续；S1 对同 external_ref 不同 profile 的 409 ⇒ STOP
（不建平行身份）。由于 CTR-WA-003 已冻结 store entry absent 才允许进入 S1/S2，
S2 只有 `created=true` 可继续接收一次性 raw secret 并写 store；S2
`created=false` MUST STOP `existing_credential_resolution_required`（reason =
`auth_client_present_without_store_entry`），记录同一 `clientId`，且本轮不得 rotate、
不得创建平行 client、不得尝试取回不存在的 raw secret（DEC-WA-006）。执行轮 MUST
NOT 使用 legacy `machine-admin client create`、直连 DB、
`expected_principal_id`/`expected_client_id` claim 或任何非 S1/S2 路径。
`clientId` MUST 按响应原样记录（auth 生成），MUST NOT 被预测或 hard-code。
S1/S2 调用 MUST 先经 attempt ledger 持久化（canonical request digest；CTR-WA-010）；
响应丢失（`outcome_unknown`）时 MUST 按 CTR-WA-010 分类决策树解析 exact
external_ref 后再动作，MUST NOT 更换 external_ref、MUST NOT 创建第二个
principal/client。

### CTR-WA-003 — Clean-bootstrap 前置与 STOP 语义（Phase A 继承）

在**任何** Auth 调用之前，执行轮 MUST：（1）完整读取并校验 credential store 文档
（Part G.2/G.3 语义；malformed ⇒ fail-loud，文件不动）；（2）检查目标 entry
`agt_workflow-admin-agent`——**entry 存在 ⇒ ZERO_AUTH_CALL_STOP**
`existing_credential_resolution_required`（Auth/S1/S2/claim/rotation/store-write
计数全零，不尝试任何 D–G 在线分类）。此时当前 invocation 的结果始终是
`STOPPED_EXISTING_CREDENTIAL_RECONCILIATION_REQUIRED`，不得 claim 当前 invocation
成功；MUST 只读同一 durable attempt ledger / final receipt，且零新 receipt/evidence/
ledger 写入。仅当既有 final receipt `status = SUCCESS_IDENTITY_ONLY`、其 attemptId /
principalId / clientId 与 ledger/store 一致，且 ledger 已持久记录七项 success gates
全部满足、`CREDENTIAL_LAYER_VERIFICATION = PASS`、reason =
`machine_grant_missing`、`BUSINESS_GRANT_READINESS = NOT_READY` 时，才可另行报告
`HISTORICAL_ATTEMPT_RESULT = SUCCESS_IDENTITY_ONLY_CONFIRMED`；这不是当前 invocation
success。store entry 存在但缺上述任一完整 tuple/evidence ⇒
`HISTORICAL_ATTEMPT_RESULT = UNPROVEN`、`BOOTSTRAP_RESULT = INCOMPLETE` + STOP，
不得假设成功、不得自动重发外部写入。bootstrap provisioner 前置（credential-spec E.4(c)）未就绪 ⇒ fail-loud
`external_prerequisite_missing(c)`，Auth 调用为零（此时已写入的 Definition entry 按
保留并记录，见 DEC-WA-006）。

### CTR-WA-004 — Secret 唯一路径与 store 写契约

secret 只允许 `HTTPS response body → 执行进程内存 → Part G 原子写（同目录 0600
temp + rename）→ 0600 store entry`；store 写入 MUST preserve 全部无关 entry
（validate-preserve-atomic，G.1–G.8）。secret MUST NOT 出现在 git、报告、receipt、
manifest、argv、env、stdout/stderr、log、child、workspace、`agents.json`、任何 IM
（`SECRET_IN_GIT_OR_REPORT = FORBIDDEN`；错误 detail 只允许 agentId 与 clientId）。

### CTR-WA-005 — Verification mint 精确继承父 D.5；credential 与 grant 分层

执行轮 MUST 完整继承 `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` D.5 与 Phase A
clean-bootstrap 语义，不得把“HTTP 200”重定义为唯一成功证据。bootstrap 成功门冻结为：

```text
BOOTSTRAP_SUCCESS_REQUIRES =
1. exact disabled Agent Definition exists;
2. S1 exact Principal resolved/created;
3. S2 exact Client resolved/created;
4. created/rotated secret atomically persisted;
5. verification mint classified CREDENTIAL_LAYER_VERIFICATION = PASS under parent D.5;
6. exact Principal/Client/store post-state verified;
7. minimal final durable receipt persisted.

CREDENTIAL_LAYER_VERIFICATION = PASS | FAIL | INCONCLUSIVE
BUSINESS_GRANT_READINESS = READY | NOT_READY
```

执行轮 MUST 在 store 写入后执行一次 verification mint，并逐字按父 D.5 mode-aware
分类：HTTP 200 + access_token ⇒ credential-layer PASS；任一确定发生在 secret 验证
之后的父 D.5 400 也 ⇒ credential-layer PASS。对本 Slice 明确不供应任何业务 Grant
的新 v1 Client，**exact zero-Grant deterministic path** 必须同时满足 wire
`400 invalid_scope`、父 D.5 reason = `machine_grant_missing`；此时必须分类为：

```text
CREDENTIAL_LAYER_VERIFICATION = PASS
BUSINESS_GRANT_READINESS = NOT_READY
BOOTSTRAP_RESULT = SUCCESS_IDENTITY_ONLY
```

该分类只证明 auth-service 已识别 Client credential 且 requested scope 未获授权；
不代表 svc-workflow 权限、Root、Grant、Binding、activation 或 Feishu 已完成。后续
Grant child 仍独立 fail closed。`400 invalid_scope` +
`requested_scope_not_granted` 仍使 credential-layer PASS，但它**不能单独证明零
Grant**；若只得到该 reason（即 `requested_scope_not_granted`）而非
`machine_grant_missing`，则 `ZERO_GRANT_CLASSIFICATION = NOT_PROVEN`、`BOOTSTRAP_RESULT = INCOMPLETE` + STOP，
不得把它冒充 exact zero-Grant success。只有父 D.5 分类为 credential invalid、profile
conflict、transport inconclusive、malformed response 或 unclassified failure 时才是：

```text
CREDENTIAL_LAYER_VERIFICATION = FAIL | INCONCLUSIVE
BOOTSTRAP_RESULT = INCOMPLETE
IDENTITY_STATE = PARTIAL_SAFE_DISABLED
```

profile 类 401 不自动判为 secret invalid；任何 FAIL/INCONCLUSIVE 均不得触发 blind
rotation、第二个 client/principal、更换 external_ref 或绕过 same-attempt ledger
reconciliation。`INCOMPLETE` 阻塞 Root authoring 与 activation；零 Grant
`SUCCESS_IDENTITY_ONLY` 仍不授予任何 business grant，activation 另须满足 CTR-WA-009
全部前置。

### CTR-WA-006 — Final durable receipt 六字段闭合 allowlist（零 secret）

执行轮 MUST 在 `docs/evidence/<round-id>/` 落盘一份 final durable receipt，schema
严格且仅允许以下字段（键名大小写逐字）：

```text
attemptId
principalId
clientId
requestDigests
status
evidenceRefs
```

这是闭合 allowlist；任何额外字段都必须被拒绝。final receipt 尤其 MUST NOT 含
`agent_id`、`principal_external_ref`、`client_external_ref`、`created`、
`principal_type`、`recorded_at`、repository coordinates、agents.json before/after
counts、`secret`、`Token`、`Authorization`。exact Spec/Base、agentId、external_refs、
阶段/时间、created/reused/outcome_unknown、active 状态、repository coordinates、
agents.json 前后计数/sha256 等详细运行数据可以且只能存在于 attempt ledger 或
`evidenceRefs` 指向的 evidence artifact，不得复制进 final receipt。

字段存在性与值语义冻结如下：

```text
KEY_SET = exactly six keys, always
attemptId = non-empty stable attempt id
principalId = exact UUID when resolved, otherwise null
clientId = exact Client ID when resolved, otherwise null
requestDigests = owned non-secret digest object (empty only before any request is prepared)
status = SUCCESS_IDENTITY_ONLY | INCOMPLETE | STOPPED
evidenceRefs = owned non-secret reference array (may be empty only before evidence exists)
```

成功 receipt 的 `principalId` / `clientId` MUST 均为 exact non-null values；早期 STOP
发生在 S1/S2 之前时两字段 MUST 为 null，不得伪造 sentinel 或身份值。只有 attempt
ledger 已创建的 attempt 才产生 final receipt；若 preflight/store gate 在 ledger 创建
之前 STOP，则不产生 final receipt，只返回结构化 current-invocation STOP，且不写任何
ledger/evidence。`requestDigests` 仅含脱敏 digest；`evidenceRefs` 只含非 secret
artifact 引用。evidence + ledger 提交是 docs-only commit。

### CTR-WA-007 — 硬边界（本轮执行的动作清点为封闭集）

「身份 执行」round **成功路径**的动作清单 MUST 恰为：读生产 `agents.json`、读/写
credential store（仅目标 entry）、原子创建并按阶段更新 attempt ledger
（CTR-WA-010 的 exact path）、写一条 **disabled:true** Definition entry、调用
S1/S2 各一次幂等 ensure（每次调用前先持久化 ledger）、一次 verification mint、
写 evidence 文件、提交 docs-only commit。任一冻结 STOP 条件触发时，合法动作集
只能是该成功路径截至 STOP 点的前缀；若 attempt ledger 已创建，则加 minimal final
receipt、supporting evidence artifact 与 ledger 状态更新；若 STOP 发生在 ledger 创建
前（含 malformed/existing store gate），只返回结构化 current-invocation STOP，零新
receipt/evidence/ledger 写入；不得为凑齐
后续动作而继续。除此之外 MUST NOT 发生：任何 svc-workflow grant/MachineAccessGrant/audience-scope
变更、任何 Feishu binding/app/tenant/conversation 配置、任何 designation root 文件、
任何 workspace/Home/primary-workspaces.json 变更、任何 broker capability/
Scheduler/Runtime 变更、任何 auth-service 代码或配置变更、fleet cutover 冻结值
（exact-86 roster、`EXACT_ROSTER_SHA256`）的任何改动、任何 unrecorded rotation
（响应丢失后的恢复必须走 CTR-WA-010 冻结的分类与显式恢复路径）、以及任何
`disabled:true → false` 的启用翻转（含经 writer seam、手改 `agents.json` 或借
runtime reload 的任何路径；启用属独立 activation authority，CTR-WA-009）。

### CTR-WA-008 — 治理执行门：contracts 权威 + 独立执行任务 + 单次有界执行

本 Spec 以 `implementation_authority: contracts` 为唯一实现授权形式（治理协议
`SPEC_GOVERNANCE_V0` §2.4/§4 preflight step 8；DEC-WA-008），MUST NOT 携带或复活
任何治理协议未识别的 authority 字段。冻结：

```text
DOCS_MERGE_PERFORMS_RUNTIME_WRITE = NO
ACCEPTED_AND_MERGED_SPEC_AUTHORIZES_BOUNDED_IMPLEMENTATION = YES
SEPARATE_EXECUTION_TASK_REQUIRED = YES
SEPARATE_EXECUTION_SPEC_REQUIRED = NO
```

「身份 执行」MUST 仅在以下条件全部满足后开始：

```text
EXECUTION_ALLOWED_ONLY_WHEN =
the exact accepted Spec revision is present in the implementation base;
preflight reports IMPLEMENTATION_ALLOWED=YES;
the execution task records exact implementation/evidence coordinates;
Contract-by-Contract conformance is evaluated.
```

即：独立 review PASS、Owner acceptance、**exact accepted revision 已存在于
implementation base**（accepted 内容合入本仓库 main，且执行 base 包含该提交）、
preflight 报告 `IMPLEMENTATION_ALLOWED = YES`、执行任务记录 exact
implementation/evidence 坐标（Spec revision sha、implementation base HEAD、
evidence 目录、attempt ledger path）、并按 Contract 逐条评估 conformance。执行
MUST 恰好一次、以包含该 accepted revision 的 main 为基、于执行时重新基线化
（re-verify spec 在 main、记录当时 main HEAD、重验 CTR-WA-003 前置、读取既有
attempt ledger 并复用同一 attemptId，并逐字对照当时 accepted parent D.5 分类与
CTR-WA-006 final receipt exact key set）。任何与冻结值/顺序/边界的偏差 ⇒ STOP +
OWNER_DECISION，不得现场裁量。本 Spec 的 review/acceptance/merge 本身 MUST NOT
触发或被表述为触发任何生产写入。

### CTR-WA-009 — Activation boundary：disabled:true → false 仅经独立受控权威

本 Spec、「身份 执行」round 与 Slice A 身份 bootstrap MUST NOT 以任何路径将
`agt_workflow-admin-agent` 的 `disabled` 从 `true` 变为 `false`——包括
deployment writer seam、手改 `agents.json`、借 runtime reload、或任何其他方式。

`disabled:true → false` 的启用转换 MUST 由**独立受控 activation authority**
授权，其 stable authority ID 与 activation 前置在本 Spec 冻结（零 TBD，使该权威
可据此独立起草；DEC-WA-011）：

```text
ACTIVATION_AUTHORITY_ID =
AGENT_CORE_WORKFLOW_ADMIN_AGENT_ACTIVATION_V1

TARGET_ADMISSION_AUTHORITY_ID =
AGENT_CORE_WORKFLOW_ADMIN_AGENT_NOTIFICATION_TARGET_ADMISSION_V1

THIS_BOOTSTRAP_SPEC_AUTHORIZES_ACTIVATION =
NO
```

activation authority 授予启用 MUST 至少满足以下前置（全部冻结）：

```text
1. exact Agent Definition exists and disabled=true
2. minimal final receipt contains exact non-null principalId
3. the same minimal final receipt contains exact non-null clientId
4. CREDENTIAL_LAYER_VERIFICATION = PASS under exact parent D.5
5. SVC_WORKFLOW_TRUSTED_ADMIN_AGENT_ROOT_V1 accepted and merged
6. auth-service permission-supply child accepted and conformed
7. svc-workflow scheduler/domain-admin children accepted and conformed
8. TARGET_ADMISSION_AUTHORITY_ID accepted, merged and conformed
```

（第 4 项不要求零 Grant 阶段 token 200；deterministic `400 invalid_scope` 可按父 D.5
满足 credential-layer PASS，但 activation 仍须独立满足后续 Root/Grant/domain/target-
admission 前置；`BOOTSTRAP_RESULT = INCOMPLETE` 时必定阻塞，CTR-WA-005。）activation authority MUST 显式引用本 Spec 执行轮 minimal final
receipt（exact principalId / clientId），其 exact enable 事务与 rollback 事务的契约边界由
CTR-WA-012 冻结。

disabled 状态期间（无论身份/credential 是否已备）：Notification ingress、
Feishu ingress、Product API、Scheduler 均不可启动该 Agent（OBS-WA-009 /
OBS-WA-010 enforcement 链）；零 spawn、零 Workspace/Home 自动创建；Identity /
Principal / Client / Credential 的准备与 receipts 不受 disabled 影响。

特别地，Notification Ingress MUST NOT 仅因 caller 命中 `svc-forum` /
`svc-workflow` allowlist 且 body `agentId == "agt_workflow-admin-agent"`，就在
activation 前 admit、投递或启动本 Agent。该请求即使通过 ingress authenticate /
authorize / body validation / idempotency reserve，Router 仍 MUST 由
`disabled:true` definition gate 在 `ensureRunning` / spawn 前拒绝 target
admission；Feishu Binding 缺失不得被当作此路径的保护条件。current-main 的
`resolveAgentRef` 对 disabled target 返回 `AGENT_NOT_FOUND`，Ingress 按其既有
idempotency authority 将其记录为 proven no-admission；process-registry 的
`AGENT_DISABLED` 是绕过 routing resolution 的 lifecycle-entry defense in depth。
两条路径均 MUST NOT 产生 `accepted:true`、Router delivered terminal、Agent
process 或 Workspace/Home provisioning。

### CTR-WA-010 — Durable attempt ledger 与 S1/S2 outcome_unknown 闭合

执行轮 MUST 维护一份 exact non-secret attempt ledger：

```text
ATTEMPT_LEDGER_PATH =
docs/evidence/workflow-admin-agent-bootstrap-v1/attempt-ledger.json
```

该 ledger MUST：

- 在首次外部写入前原子创建（同目录 temp + rename；CTR-WA-001 引用）；
- 使用唯一、稳定的 `attemptId`（recovery/重入复用同一 attemptId，不新建）；
- 绑定 exact Spec revision（blob sha）、implementation Base HEAD、agentId、
  external_refs；
- 记录 S1/S2 canonical request digest（逐字冻结调用体的脱敏摘要）；
- 记录阶段、时间、结果分类（success | failed | outcome_unknown | stopped）；
- 记录 Principal UUID / Client ID（获得后）；
- 记录父 D.5 `CREDENTIAL_LAYER_VERIFICATION`、`BUSINESS_GRANT_READINESS` 与
  `BOOTSTRAP_RESULT` 分类；exact zero-Grant deterministic `400 invalid_scope`（reason =
  machine_grant_missing）必须记录为 PASS / NOT_READY /
  SUCCESS_IDENTITY_ONLY；requested_scope_not_granted 单独必须记录 zero-Grant unproven；
- **永不记录** Client secret、Token 或 Authorization（任何形式）；
- 每个阶段使用原子替换并持久化；
- recovery MUST 复用同一 attemptId 和同一 external_refs。

**S1 outcome_unknown**（请求已发出、响应未获得）MUST 按以下决策树闭合：

```text
S1 outcome_unknown
→ resolve exact principal external_ref
→ ABSENT: same request / same attempt retry
→ PRESENT exact match: continue
→ PRESENT conflict: fail loud / stop
```

**S2 outcome_unknown** MUST 先持久化 ledger 再调用：

```text
S2 request prepared
→ ledger persisted
→ S2 call
```

若 S2 响应丢失，MUST resolve exact client external_ref，分类冻结为：

```text
CLIENT_ABSENT =
same request / same attempt retry

CLIENT_PRESENT_AND_LOCAL_SECRET_ALREADY_VERIFIED =
continue

CLIENT_PRESENT_AND_SECRET_UNAVAILABLE =
STOP
BOOTSTRAP_RESULT = INCOMPLETE
do not create another Client
do not change external_ref
do not fabricate/recover old secret
```

`CLIENT_PRESENT_AND_SECRET_UNAVAILABLE` 的唯一恢复路径冻结为：

```text
separate bounded credential-recovery execution
under an accepted Client rotation authority
→ rotate the exact existing Client
→ receive one new secret
→ atomically store it
→ verify old secret invalid
→ run verification mint
→ update the same attempt ledger
```

本 Bootstrap execution MUST NOT 在响应丢失后自动、无记录地 rotate（CTR-WA-007
封闭动作集排除 unrecorded rotation）。

### CTR-WA-011 — 失败/回滚终态：SAFE_DISABLED_STAGED_IDENTITY；零 Definition remove 依赖

本 Spec 及其执行轮 MUST NOT 依赖任何 Agent Definition remove seam（current main
不存在该 seam，OBS-WA-011）。冻结：

```text
AGENT_DEFINITION_REMOVE_REQUIRED =
NO

ROLLBACK_TARGET =
SAFE_DISABLED_STAGED_IDENTITY
```

失败后的合法终态 MUST 恰为：

```text
Agent Definition remains present
disabled = true
defaultAgentId unchanged
non-routable
non-runnable
no Binding
no workflow Grant
no Root activation
```

按已产生的外部状态执行收敛：

```text
credential-store entry created
→ parent-authority atomic removal/reconciliation path

Client created
→ revoke exact Client when rollback or compromise requires it

Principal created
→ disable exact Principal when containment requires it

durable audit/evidence
→ never deleted
```

执行轮与回滚动作 MUST NOT：删除审计事实；创建新 external_ref；临时复用业务
Agent；把 rollback 伪装成「数据库从未发生过写入」。重新执行 MUST 读取同一
attempt ledger（CTR-WA-010），收敛同一 subject，不创建第二身份。

### CTR-WA-012 — Activation authority 可起草性：exact target-admission child 与 exact enable/rollback 事务

Activation authority（`AGENT_CORE_WORKFLOW_ADMIN_AGENT_ACTIVATION_V1`，
CTR-WA-009）MUST 拥有独立 Notification target admission child，其 stable
authority ID 冻结为
`AGENT_CORE_WORKFLOW_ADMIN_AGENT_NOTIFICATION_TARGET_ADMISSION_V1`。current
caller allowlist（`svc-forum` / `svc-workflow`，OBS-WA-010）MUST NOT 被当作
target activation authority。target-admission child MUST 确保：

```text
body.agentId alone cannot activate an undesignated target
exact Admin Agent admission is server-side
disabled still overrides all admission
revocation/disable fails closed
no general arbitrary-Agent target allowlist is silently created
```

具体 wire/storage 由该 child 自己拥有，但其 stable authority ID 与 activation
前置（CTR-WA-009 八项）在本 Spec 冻结。

由于 current main 没有通用 enable seam（OBS-WA-011：`updateAgentInConfig` 不可
触碰 `disabled`，无 `enableAgentInConfig`），Activation Spec MUST 拥有一个
**exact-subject、one-time、非通用 API** 的配置事务：

```text
before:
exact agt_workflow-admin-agent entry
disabled=true

after:
same id/name/description
disabled=false

unchanged:
all other Agent entries
defaultAgentId
file schema/version
```

事务要求冻结为：

```text
compare-and-swap on exact pre-image digest
atomic config write
definition.reload()
post-read verification
durable before/after evidence
same-key replay = no-op
different pre-image = conflict / fail loud
```

MUST NOT 授权通用动态 `enable any Agent` API。Activation rollback 事务 MUST：

```text
same exact subject
disabled=false → true
atomic write
reload
verify resolveAgentRef rejects
verify Notification/Feishu/Product/Scheduler cannot admit
persist durable evidence
```

Emergency disable 只撤权，MUST NOT 指定替代 Agent。

## 10. Acceptance

### ACC-WA-001 — Definition 精确单条写入

- Contracts: `CTR-WA-001`
- Method/environment: 生产 `agents.json` 前后快照对比（sha256 + 解析 diff）
- Expected: delta = 恰好一条新增 entry，字段逐字等于冻结值（含
  `disabled === true`）；无其他 entry/defaultAgentId 变化；无 persona/
  workspace/credential 字段
- Required evidence: 前后 sha256、解析 diff、写入后 loader 校验输出、
  attempt ledger 已存在且绑定本次 attemptId（CTR-WA-010）
- Failure condition: 任何额外 entry 被改、字段漂移、文档不可加载
- Negative path: 在 attempt ledger 缺席时执行本写入 ⇒ 必须被判定为违规
  （无 ledger 的外部写入）；写入 `disabled:false` ⇒ 违规（启用越权）

### ACC-WA-002 — S1/S2 幂等身份建立

- Contracts: `CTR-WA-002`
- Method/environment: 生产 auth-service；执行轮 wire 记录（脱敏后入 evidence）
- Expected: S1/S2 各至多一次调用；成功路径各恰好一次；external_refs 逐字等于
  §0；principal `status=active`；S1 `created=false` 可找回同一 principal 继续；S2
  `created=true` 才可用一次性 secret 继续，`client_id` 为 auth 生成 `mc_*`；S2
  `created=false` + store absent ⇒ STOP `existing_credential_resolution_required`，零
  store write / mint / rotation；created 标志如实记录；每次 S1/S2 调用前 ledger
  已持久化 request digest，`outcome_unknown` 按 CTR-WA-010 分类闭合且 external_ref
  不变
- Required evidence: minimal final receipt + `evidenceRefs` 指向的非 secret artifact；
  created 标志、零后续动作计数与阶段历史只在 attempt ledger / evidence artifact，
  不进入 final receipt
- Failure condition: external_ref 漂移、走 legacy/DB 路径、principal 非 active、
  client_id 被预写/断言，或 S2 `created=false` 后仍写 store / mint / rotate / 继续
- Negative path: `outcome_unknown` 后更换 external_ref 重发 ⇒ 违规（平行身份）；
  无 ledger 记录的 S1/S2 调用 ⇒ 违规；伪造或回显旧 secret ⇒ 违规（且不可能通过
  mint 验证）

### ACC-WA-003 — Clean-bootstrap 负向门

- Contracts: `CTR-WA-003`
- Method/environment: 执行轮前置检查（store 读+校验+目标 entry 判定）
- Expected: store malformed 或目标 entry 存在或 (c) 未就绪 ⇒ 结构化 STOP，
  Auth 调用计数 = 0；目标 entry 存在时 current invocation 始终为
  `STOPPED_EXISTING_CREDENTIAL_RECONCILIATION_REQUIRED`，只读 ledger/final receipt：
  只有既有 final receipt status=SUCCESS_IDENTITY_ONLY 且 IDs/attemptId 对齐，并由
  ledger 证明七项 gates + PASS + machine_grant_missing + NOT_READY 完整 tuple 时，才可
  另报 historical success confirmed；否则 historical result unproven +
  `BOOTSTRAP_RESULT = INCOMPLETE`
- Required evidence: ledger 创建后才触发的 STOP 使用 minimal final receipt +
  attempt ledger/evidence artifact；malformed/existing store 等 ledger 前 STOP 只保留
  结构化当前调用结果，零新 durable write
- Failure condition: 任何前置失败后仍发生 Auth 调用或 store 写入；entry 已存在时
  写新 receipt/evidence/ledger、claim current success，或无完整 PASS 证据却假设成功
- Negative path: store entry 已存在却进入 S1/S2 或重发外部写入 ⇒ 违规；（c）未就绪
  却调用 Auth ⇒ 违规；store malformed 时静默覆盖 ⇒ 违规

### ACC-WA-004 — Secret 路径与 store 契约

- Contracts: `CTR-WA-004`
- Method/environment: store 文件权限/属主检查 + 本轮全部产出物 secret 扫描
- Expected: store entry 0600、trusted 属主；git delta 与全部报告/receipts/
  attempt ledger 经模式扫描无 secret 材料；无关 entry 逐字节不变
- Required evidence: `ls -l`/等价权限记录、扫描命令与结果、store 前后文档对比
- Failure condition: secret 出现在任何产出物、权限/属主不符、无关 entry 被动
- Negative path: secret 进入 Git、日志、stdout/stderr、workspace、聊天或报告
  （任一通道）⇒ 必须被扫描捕获并判定违规；attempt ledger 含 Token/Authorization
  ⇒ 违规

### ACC-WA-005 — 父 D.5 credential-layer 分类与零 Grant 语义

- Contracts: `CTR-WA-005`
- Method/environment: 单次 verification mint wire 结果 + parent D.5 mode-aware 表 +
  attempt ledger 分类复核（对照 BOOTSTRAP_SUCCESS_REQUIRES 七项）
- Expected: `CREDENTIAL_LAYER_VERIFICATION = PASS | FAIL | INCONCLUSIVE` 与
  `BUSINESS_GRANT_READINESS = READY | NOT_READY` 分开记录；HTTP 200 ⇒ PASS；本
  Slice exact zero-Grant deterministic `400 invalid_scope` 只有在 reason =
  `machine_grant_missing` 时 ⇒ PASS + NOT_READY +
  `BOOTSTRAP_RESULT = SUCCESS_IDENTITY_ONLY`；`requested_scope_not_granted` 仍为
  credential PASS 但不单独证明零 Grant，零 Grant 未证明时必须 INCOMPLETE + STOP；
  credential invalid / profile conflict / transport inconclusive / malformed response /
  unclassified failure ⇒ INCOMPLETE；
  profile 类 401 不默认 secret-invalid，零 blind rotation/平行身份
- Required evidence: attempt ledger 中的 D.5 wire/classification 与七项成功门逐项
  判定；final receipt 只通过 `status` / `evidenceRefs` 引用该证据
- Failure condition: 把 deterministic zero-Grant `400 invalid_scope` 归为 credential
  FAIL/INCOMPLETE；把 grant NOT_READY 写成 READY；或 FAIL/INCONCLUSIVE 仍报告成功
- Negative path: “任何非 200 都 INCOMPLETE”、401 无上下文归因 secret、blind
  rotate、创建平行身份、把 identity-only 成功声称为 Root/Grant/Binding/activation/
  Feishu 已完成——任一构造必须拒绝

### ACC-WA-006 — Final durable receipt 最小闭合 schema

- Contracts: `CTR-WA-006`
- Method/environment: final receipt JSON key-set exact equality + secret scan +
  attempt ledger/evidenceRefs 交叉核对
- Expected: key set **恰好**为 `attemptId`、`principalId`、`clientId`、
  `requestDigests`、`status`、`evidenceRefs`；成功时 exact UUID / Client ID 在对应字段；
  ledger 创建后、S1/S2 前 STOP 时两字段为 null；`status` 为
  `SUCCESS_IDENTITY_ONLY`、`INCOMPLETE` 或 `STOPPED`；ledger 前 STOP 不产生 receipt；
  零 secret
- Required evidence: final receipt（仅当 ledger 已创建）+ attempt ledger +
  `evidenceRefs` 指向的 artifacts；ledger 前 STOP 的结构化 current-invocation result
- Failure condition: 已产生 receipt 却缺任一 allowlist 字段、出现任一额外字段、
  identity 值/null 规则或 attemptId 不一致、结果分类不一致、出现敏感材料；ledger 前
  STOP 仍写 receipt
- Negative path: final receipt 含 `agent_id`、`principal_external_ref`、
  `client_external_ref`、`created`、`principal_type`、`recorded_at`、repository
  coordinates、agents.json before/after counts、`secret`、`Token`、`Authorization`
  中任一项 ⇒ 必须拒绝；INCOMPLETE 被记为 SUCCESS_IDENTITY_ONLY ⇒ 违规

### ACC-WA-007 — 封闭动作清点

- Contracts: `CTR-WA-007`
- Method/environment: 执行轮命令清单与生产面 post-state 核查
- Expected: 动作集合 ⊆ CTR-WA-007 枚举（含 ledger 原子创建/更新）；svc-workflow
  grant 面、binding 面、designation 面、workspace 面、fleet 冻结值零变化；零
  unrecorded rotation；identity bootstrap 未被表述/记录为 Root、Grant 或 Feishu
  已完成
- Required evidence: 命令清单、post-state 检查记录（如 roster sha 复算不变）
- Failure condition: 清单外任何生产面变更
- Negative path: identity bootstrap 被写成 Root/Grant/Feishu 已完成 ⇒ 违规
  （三项 §0 Batch 1 = NO）；响应丢失后自动 rotate 而无 ledger 分类 ⇒ 违规

### ACC-WA-008 — 治理权威形式与执行门

- Contracts: `CTR-WA-008`
- Method/environment:
  - authoring/revision 侧：本 PR repo delta + frontmatter 权威字段检查 + 校验工具；
  - future execution 侧：执行开始前 preflight（exact accepted revision 在
    implementation base 的包含关系、`IMPLEMENTATION_ALLOWED=YES` 报告、执行坐标
    记录、Contract-by-Contract conformance 清单、既有 attempt ledger 读取与
    attemptId 复用、CTR-WA-003 前置重跑）。
- Expected:
  - frontmatter 恰为 `implementation_authority: contracts`，无
    `identity_execution_authority` / `production_apply_authority` 或任何治理协议
    未识别的 authority 字段；
  - 本 Spec 及其 review/acceptance/merge 均不执行、不触发、不表述为触发任何
    生产写入（`DOCS_MERGE_PERFORMS_RUNTIME_WRITE = NO`）；合并的是文档权威，
    执行由独立任务承载（`SEPARATE_EXECUTION_TASK_REQUIRED = YES`）；
  - authoring/revision delta = 本文件一个新文件；`git diff --check` PASS；
    `python3 .agents/tools/verify_governance.py --target . --require-accepted` PASS；
    `npm run verify:structure -- --base github/main` PASS；
  - execution 仅在 CTR-WA-008 `EXECUTION_ALLOWED_ONLY_WHEN` 四条件全满足后开始；
    base 是包含 exact accepted revision 的当时 main；此前成功/进行中的同
    authority execution = 0；执行恰好一次。
- Required evidence: 本修订 commit 与校验输出；future execution 的 preflight
  报告（`IMPLEMENTATION_ALLOWED=YES`）、accepted-main ancestry/HEAD record、
  执行坐标（Spec revision sha + base HEAD + evidence/ledger path）、
  Contract-by-Contract conformance record、attempt-ledger 复用记录、re-baseline
  checklist 与唯一 execution receipt。
- Failure condition: 携带任何非本文件 delta 或校验失败；或 future execution 在
  review/acceptance/merge 或 preflight 四条件缺一时开始、base 不含 exact
  accepted revision、未 re-baseline、已有成功/进行中 execution、重复执行，或
  冻结值/顺序/边界偏差后未 STOP + OWNER_DECISION。
- Negative path: 以下三种构造都必须被验收拒绝——(1) Spec 声称
  `implementation_authority: none` 却执行真实生产写入；(2) 使用自创 authority
  字段（如 `identity_execution_authority` / `production_apply_authority`）绕过
  治理；(3) 声称 docs merge 自动执行生产写入（含「合并后可执行一次真实写入」
  的自动化语义）。

### ACC-WA-009 — Activation boundary 未被越过

- Contracts: `CTR-WA-009`
- Method/environment: 执行轮命令清单 + agents.json 后快照解析；review 时对
  current-main Notification Ingress → Router source path 做静态构造性核验（不发送
  production probe、不启动 Agent）
- Expected: 执行轮结束时该 entry `disabled === true`；全程无任何启用动作（无
  writer-seam enable、无手改 `agents.json`、无借 reload 启用）；source path 证明
  caller allowlist + body `agentId` 后仍经 disabled gate，且 gate 位于
  ensureRunning/spawn 前；报告显式记录 activation boundary 引用
  （`ACTIVATION_AUTHORITY_ID = AGENT_CORE_WORKFLOW_ADMIN_AGENT_ACTIVATION_V1`；
  `THIS_BOOTSTRAP_SPEC_AUTHORIZES_ACTIVATION = NO`）与八项 activation 前置
- Required evidence: agents.json 后快照解析输出（disabled 字段在列）、命令清单、
  current-main source coordinate 与 OBS-WA-010 静态核验记录
- Failure condition: `disabled` 被翻转、存在任何启用路径的调用，或 source path
  允许 authorized Notification caller + body `agentId` 在 activation 前绕过
  disabled gate admission / delivery / process spawn / provisioning
- Negative path: caller allowlist 命中 + body `agentId` 命中被当作 activation
  authorization ⇒ 违规；bootstrap/INCOMPLETE 状态下任何 activation 授予 ⇒ 违规
  （第 4 项 credential-layer PASS 未满足）；零 Grant identity-only PASS 也不得绕过
  第 5–8 项 Root/Grant/domain/target-admission 前置

### ACC-WA-010 — Attempt ledger 与 S1/S2 outcome_unknown 闭合

- Contracts: `CTR-WA-010`
- Method/environment: attempt ledger 文件审查（时序、attemptId 稳定性、绑定字段、
  secret 扫描）+ S1/S2 `outcome_unknown` 分类路径推演
- Expected: ledger 在首次外部写入前原子创建；attemptId 唯一且 recovery 复用；
  绑定 exact Spec revision / Base / agentId / external_refs；含 S1/S2 canonical
  request digest、阶段、时间、结果分类、Principal UUID / Client ID，以及 parent D.5
  credential/grant/bootstrap 三层分类；零 secret/Token/Authorization；S1
  `outcome_unknown` → external_ref 解析三分支（ABSENT 重试 / PRESENT exact-match 继续 /
  PRESENT conflict STOP）；S2 响应丢失 → 三分类（CLIENT_ABSENT 同 attempt 重试 /
  已验证继续 / SECRET_UNAVAILABLE STOP+INCOMPLETE）；STOP 后零第二 Client、零
  external_ref 变更、零伪造 secret；store entry 已存在时 ZERO_AUTH_CALL_STOP，current
  invocation = STOPPED，零新 durable write；仅以既有 final receipt
  status=SUCCESS_IDENTITY_ONLY + IDs/attemptId 对齐 + ledger 七项 gates/PASS/
  machine_grant_missing/NOT_READY 完整 tuple 另行复述 historical result confirmed
- Required evidence: attempt-ledger.json（含阶段历史）、S1/S2 调用时序记录、
  minimal final receipt + evidenceRefs（仅 ledger 已创建的 attempt）；existing-store
  reentry 只读既有 artifacts
- Failure condition: ledger 缺失/迟到（首个外部写入后才创建）、attemptId 或
  external_refs 在 recovery 中漂移、ledger 含 secret 材料、任一 outcome_unknown
  未按冻结分类闭合
- Negative path: 以下构造都必须被验收拒绝——S2 response lost 后创建第二个
  Client；S2 reuse 时伪造或回显旧 secret；无 attempt ledger 执行 S1/S2；
  `outcome_unknown` 后更换 external_ref。唯一合法的 secret 恢复是 CTR-WA-010
  冻结的独立受控 rotation 执行（rotate exact Client → 新 secret 原子入 store →
  验证旧 secret 失效 → verification mint → 更新同一 ledger）。

### ACC-WA-011 — 安全失败终态：SAFE_DISABLED_STAGED_IDENTITY

- Contracts: `CTR-WA-011`
- Method/environment: 失败/STOP 后生产面 post-state 核查（agents.json 解析、
  Router/Scheduler 静态门、store/auth 状态、evidence 在场性）
- Expected: Agent Definition 仍在场且 `disabled = true`；`defaultAgentId` 不变；
  non-routable（resolveAgentRef 拒绝）/ non-runnable（AGENT_DISABLED）；无
  Binding、无 workflow Grant、无 Root activation；credential-store entry 按
  父权威路径收敛；Client/Principal 仅在需要时 revoke/disable exact 对象；
  durable audit/evidence 全部保留；重新执行读取同一 ledger 收敛同一 subject
- Required evidence: 若 attempt ledger 已创建，则 post-state 快照（agents.json +
  store + auth 对象）作为 evidence artifact、minimal final receipt、ledger attemptId
  复用记录；若 malformed/existing-store gate 在 ledger 前 STOP，则只核验结构化
  current-invocation STOP 与既有 read-only evidence（如有），且必须证明零新 durable
  write，不要求也不得新建 receipt/ledger/artifact
- Failure condition: rollback 依赖或要求删除 Agent Definition entry；失败后
  Agent 变为 routable/runnable；defaultAgentId 变化；审计/证据被删；重入创建
  第二身份
- Negative path: 以下构造都必须被验收拒绝——rollback 要求删除 Definition；
  rollback 后 Agent 变为 routable；删除审计事实；把 rollback 伪装成「数据库
  从未发生过写入」；临时复用业务 Agent 顶替；重入时新 attemptId/新
  external_ref 制造第二身份。

### ACC-WA-012 — Activation authority 可起草性与 exact 事务

- Contracts: `CTR-WA-012`
- Method/environment: 对本 Spec 文本的静态审查（activation authority 是否零 TBD
  可独立起草）+ 对 activation 执行的 future 核查项冻结
- Expected: `ACTIVATION_AUTHORITY_ID` /
  `TARGET_ADMISSION_AUTHORITY_ID` 在本 Spec 冻结；target-admission child 五项
  保障在列；exact enable 事务（exact before/after/unchanged 状态 + CAS on
  pre-image digest + 原子写 + `definition.reload()` + post-read + durable
  before/after evidence + same-key replay no-op + different pre-image conflict）
  与 rollback 事务（exact subject + reload + resolveAgentRef 拒绝 + 四表面
  admission 验证 + durable evidence）全部冻结；无通用 `enable any Agent` API
  授权
- Required evidence: 本 Spec CTR-WA-009/012 冻结块；activation 执行轮的
  before/after evidence、pre-image digest、reload 与 post-read 记录（future）
- Failure condition: activation authority 含 TBD 或缺 exact target-admission
  child；声称使用现存通用 enable seam（不存在，OBS-WA-011）；activation 修改
  其他 Agent 或 `defaultAgentId`；缺 reload/post-read/evidence；replay 重复写；
  rollback 后仍可投递
- Negative path: 以下构造都必须被验收拒绝——activation authority 无 exact
  target-admission child；caller allowlist 被当成 target authority；无现存
  enable seam 却声称 activation 可执行；activation 修改其他 Agent 或
  defaultAgentId；activation 无 reload / post-read / evidence；activation replay
  重复写；activation rollback 后仍能投递；emergency disable 指定替代 Agent。

**覆盖对照**：CTR-WA-001→ACC-WA-001 · 002→002 · 003→003 · 004→004 · 005→005 ·
006→006 · 007→007 · 008→008 · 009→009 · 010→010 · 011→011 · 012→012
（CONTRACT_COUNT = 12；CONTRACTS_WITH_ACCEPTANCE = 12；ACCEPTANCE_COUNT = 12；
无 uncovered contract、无 declaration-only / coverage-table-only 边；ACC-001..012
中涉及执行面的证据均属未来「身份 执行」round，属 runtime/manual evidence 类，
理由：其 subject 在 authoring round 中依法不存在；ACC-WA-008 同时覆盖本轮
spec-only delta 与 future execution gate 两侧；ACC-WA-012 覆盖本 Spec 文本冻结
与 future activation 执行两侧）。

## 11. Alternatives and disposition

- **复用既有 business/canary/security Agent**（含 `agt_cto-agent`）：否决——Owner
  §0 冻结 FORBIDDEN；V3 §22（管理权威需独立身份与 credential lifecycle）；
  `agt_cto-agent` 已是 successor principal，混用会破坏 V3 §10 的 exact
  designated-Principal 模型。
- **不经 Spec 直接建身份**：否决——治理协议（无 accepted authority 不得实现；
  身份/授权/lifecycle 属非机械变更）。
- **在本轮顺带授 svc-workflow grant / 建 binding / 写 designation root**：否决——
  V3 §18 Slice 分离 + CTR-V3-031（Slice 不得互相激活）；§0 三项 NO。
- **预生成/断言 clientId**：否决——auth 侧生成是幂等 seam 的安全属性（S2）；
  §0 冻结 must not be predicted。
- **只建 Auth 对象、不写 trusted store**：否决——secret 一次性返回，不落 store
  即丢失且违反 Part H（DEC-WA-003）。
- **为过 mint 检查绑定 owner**：否决——Owner Ruling（owner NULL/ABSENT，
  `FAKE_ADMIN_OWNER_FORBIDDEN`）；401 按规则归因（CTR-WA-005）。
- **把本 Spec 写进 svc-workflow / auth-service 仓库**：否决——subject 的
  Agent Definition 与 ensure tooling 归 dsh-agent-core；V3/auth-service 保持外部
  引用（§3），不跨界持有。
- **bootstrap 完成即 enabled（初始 `disabled: false`）/ 执行轮顺带启用**：
  否决——Owner Revision 1 冻结（§0 Batch 2）：身份准备与运行启用必须是两个
  独立受控步骤；activation boundary 由独立受控 activation authority 持有
  （DEC-WA-007 / CTR-WA-009）。
- **自创 authority 字段 / docs-merge 自动执行语义**（Revision 3 否决）：
  `identity_execution_authority` / `production_apply_authority` 不是治理协议
  认可的授权形式；「合并后自动执行一次真实写入」与 authority 字段自相矛盾
  （Revision 2 审计 AUTHORITY_FORM_REVIEW=FAIL / POST_MERGE_RUNTIME_WRITE_
  AUTHORITY=CONTRADICTORY）——改为 `implementation_authority: contracts` +
  `DOCS_MERGE_PERFORMS_RUNTIME_WRITE = NO` + 独立执行任务（DEC-WA-008 /
  CTR-WA-008）。
- **跳过 verification mint 或重定义父 D.5**（Revision 4 冻结否决）：完整继承
  Phase A + D.5；必须完成 mint 分类并得到 credential-layer PASS，但不得把 HTTP 200
  当作唯一 PASS。exact zero-Grant `400 invalid_scope` 需 reason=machine_grant_missing 才 = PASS + NOT_READY + `SUCCESS_IDENTITY_ONLY`；
  requested_scope_not_granted alone、credential FAIL/INCONCLUSIVE 均不能完成该
  identity-only success gate（CTR-WA-005）。
- **响应丢失后自动 rotate / 无 ledger 执行**（Revision 3 否决）：S1/S2
  `outcome_unknown` 必须先经 attempt ledger + external_ref 解析分类；secret
  不可取回 ⇒ STOP，唯一恢复是独立受控 SAME-client rotation 执行（CTR-WA-010）。
- **删除 Definition 式 rollback**（Revision 3 否决）：current main 无 remove seam
  （OBS-WA-011）；安全终态是保留 disabled entry 的
  `SAFE_DISABLED_STAGED_IDENTITY`（CTR-WA-011）。
- **通用 `enable any Agent` API**（Revision 3 否决）：activation 只允许
  exact-subject、one-time、CAS 保护的事务（CTR-WA-012）。

## 12. Migration, compatibility, and rollback

- **兼容性 / inertness 更正**：原稿若以“无 Binding / 无 grant / 仅建立身份”推导
  全面 inert，结论为 **FALSE**——current-main Notification Ingress 不需要 Feishu
  Binding，获准 caller 可直接提交 body `agentId`（OBS-WA-010）。本修订只以
  `disabled: true` definition gate 证明 activation 前 non-routable / non-runnable；
  无 credential、无 grant、无 Feishu Binding 仅是各自表面的附加 fail-closed
  边界，不能替代 target activation gate。不触碰 fleet 冻结值。
- **执行中断**：T4 后 STOP ⇒ 保留惰性 entry + minimal final receipt / supporting
  evidence artifact（DEC-WA-006）+ ledger 状态更新（CTR-WA-010）；重入先读同一
  ledger、复用同一 attemptId，按 S1/S2 幂等与 outcome_unknown 分类找回同一身份。
- **回滚（若 Owner 决定放弃该身份；Revision 3 重写）**：回滚目标冻结为
  `SAFE_DISABLED_STAGED_IDENTITY`（CTR-WA-011）——**不删除 Agent Definition
  entry**（current main 无 remove seam，OBS-WA-011；entry 保持 disabled:true 即
  non-routable/non-runnable，留场无害且可审计）。按已产生的外部状态收敛：
  credential-store entry ⇒ 经父权威（credential spec Part G/J）原子移除/
  reconciliation 路径；Client ⇒ 需要时 revoke exact Client（外部、幂等）；
  Principal ⇒ 需要遏制时 disable exact Principal；durable audit/evidence/ledger
  ⇒ 永不删除。回滚详细理由与坐标记录在 attempt ledger/evidence artifact；final
  durable receipt 仍必须遵守 CTR-WA-006 六字段闭合 allowlist；不得删除审计事实、
  不得创建新 external_ref、不得临时复用业务 Agent、不得把
  rollback 伪装成「数据库从未发生过写入」。重新执行读取同一 attempt ledger
  收敛同一 subject。
- **启用路径（非回滚方向）**：`disabled:true → false` 不在本 Spec 权限内——
  独立受控 activation authority（CTR-WA-009）；回滚（移除）与启用（翻转
  disabled）是两个方向相反、各自独立的权威动作。
- **权威回滚**：本 Spec 未 accepted ⇒ PR 关闭即无痕；accepted 后撤回需 whole-
  authority successor（SPEC_GOVERNANCE_V0 §9.2）。
- **对后续 Slice 的接口**：Slice B（designation root）应引用本 Spec 执行轮
  minimal final receipt 中的 exact principalId 与 clientId；该接口是纯引用，不使本 Spec
  获得 designation 权威。

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE（§0 全部冻结）
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
DUPLICATE_AUTHORITY_RISK = NONE（OBS-WA-004 零命中）
```

非规范跟进（不改变本 Spec 语义，均由各自权威持有）：Slice B/C/F 的 child
authority；独立受控 activation authority
`AGENT_CORE_WORKFLOW_ADMIN_AGENT_ACTIVATION_V1` 与其 target-admission child
`AGENT_CORE_WORKFLOW_ADMIN_AGENT_NOTIFICATION_TARGET_ADMISSION_V1` 的起草
（其稳定 ID 与前置已在本 Spec 冻结，CTR-WA-009 / CTR-WA-012；起草时须引用
本 Spec 执行轮 minimal final receipt）；`CLIENT_PRESENT_AND_SECRET_UNAVAILABLE` 场景的
Client rotation recovery 权威（CTR-WA-010 冻结路径）；部署面实际 auth-service
修订的现场确认（OBS-WA-007：main 已收敛，但部署修订仍未现场观测——现场确认
失败只影响 bootstrap 结果分类为 INCOMPLETE，不降低成功条件，CTR-WA-005）。

## 14. Final Output（authoring round 冻结输出）

```text
AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_V1 = ACCEPTED_CANDIDATE (docs-only; active authority only after merge to main)

ADMIN_AGENT_ID = agt_workflow-admin-agent
ADMIN_AGENT_DISPLAY_NAME = 工作流总管
AGENT_KIND = DEDICATED_ADMIN_AGENT
IDENTITY_EXECUTION_ORDER = T1 re-baseline（preflight：exact accepted revision
  在 implementation base、IMPLEMENTATION_ALLOWED=YES、执行坐标记录、读同一
  attempt ledger）→ T2 agents.json 读+前后记录 → T3 store 读+完整校验+目标
  entry 判定（exists ⇒ current invocation STOPPED_EXISTING_CREDENTIAL_RECONCILIATION_REQUIRED，
  ZERO_AUTH_CALL_STOP + 零新 durable write；只读 ledger/final receipt，仅在 receipt
  status=SUCCESS_IDENTITY_ONLY、IDs/attemptId 对齐且 ledger 七项 gates + PASS +
  machine_grant_missing + NOT_READY tuple 完整时另报 historical success confirmed，
  否则 historical unproven + INCOMPLETE）→ T3.5 attempt ledger
  原子创建/复用（首次外部写入前；CTR-WA-010）→ T4 写恰好一条 disabled:true Definition entry
  （CTR-WA-001）→ T5 (c) 前置检查（未就绪 ⇒ fail-loud，Auth=0）→ T6 S1（body
  冻结；ledger 先持久化 request digest；created=false 可继续同一 principal；
  outcome_unknown 按 CTR-WA-010 分类）→ T7 S2（body 冻结；ledger 先持久化；
  created=true 的一次性 secret→内存；created=false / secret 不可取回 ⇒ STOP
  existing_credential_resolution_required）→ T8 Part G 原子 store 写 + 单次
  verification mint（精确按父 D.5 分类；credential-layer PASS 才满足 gate；exact
  zero-Grant 需 invalid_scope reason=machine_grant_missing ⇒ PASS +
  business grant NOT_READY + SUCCESS_IDENTITY_ONLY；requested_scope_not_granted 不单独
  证明零 Grant；FAIL/INCONCLUSIVE/zero-Grant unproven ⇒ INCOMPLETE + PARTIAL_SAFE_DISABLED，
  CTR-WA-005）→ T9 final durable receipt（字段严格且仅为 attemptId/principalId/
  clientId/requestDigests/status/evidenceRefs；详细数据留 ledger/artifacts；零 secret）+
  docs-only commit

REUSE (EXISTING/BUSINESS/CANARY/SECURITY_CEO_CTO) = FORBIDDEN
PRINCIPAL_EXTERNAL_REF = agentcore:v1:principal:agt_workflow-admin-agent
CLIENT_EXTERNAL_REF = agentcore:v1:client:agt_workflow-admin-agent
CLIENT_ID = auth-service 生成值，禁止预测/hard-code
SVC_WORKFLOW_PERMISSION_GRANT_IN_THIS_SCOPE = NO
FEISHU_BINDING_IN_THIS_SCOPE = NO
TRUSTED_ADMIN_AGENT_ROOT_IN_THIS_SCOPE = NO
WORKSPACE_HOME_PROVISIONING_IN_THIS_SCOPE = NO
CREDENTIAL_LAYER_VERIFICATION = inherits exact parent D.5: PASS | FAIL | INCONCLUSIVE
ZERO_GRANT_INVALID_SCOPE = CREDENTIAL_LAYER_VERIFICATION PASS only with machine_grant_missing
BUSINESS_GRANT_READINESS_AFTER_BOOTSTRAP = NOT_READY
ZERO_GRANT_BOOTSTRAP_RESULT = SUCCESS_IDENTITY_ONLY
DURABLE_RECEIPT_SCHEMA = attemptId / principalId / clientId / requestDigests / status / evidenceRefs
DURABLE_RECEIPT_KEY_SET = EXACT_ALWAYS
DURABLE_RECEIPT_ID_NULLABILITY = null only when ledger exists but STOP precedes identity resolution
DURABLE_RECEIPT_STATUS = SUCCESS_IDENTITY_ONLY | INCOMPLETE | STOPPED
LEDGER_PRECEDING_STOP_RECEIPT = NONE
DURABLE_RECEIPT_ADDITIONAL_FIELDS = FORBIDDEN
SECRET_IN_GIT_OR_REPORT = FORBIDDEN
INITIAL_DEFINITION_DISABLED = true
ACTIVATION_TRANSITION_AUTHORITY = INDEPENDENT_CONTROLLED_ONLY
  （disabled:true -> false 必须经过独立受控 activation authority =
    AGENT_CORE_WORKFLOW_ADMIN_AGENT_ACTIVATION_V1；
    Slice A 身份 bootstrap 自动启用 = FORBIDDEN；CTR-WA-009 / CTR-WA-012）
DISABLED_STATE_SEMANTICS = Identity/Principal/Client/Credential 可准备；
  Notification/Feishu/Product API/Scheduler 均不能启动该 Agent；
  零 spawn、零 Workspace/Home 自动创建（OBS-WA-009）

AUTHORING_ROUND：PRODUCT_CODE_CHANGE = NONE · AGENTS_JSON_CHANGE = NO ·
AUTH_IDENTITY_CREATED = 0 · STORE_WRITE = NO · BINDING_CHANGE = NO ·
GRANT_CHANGE = NO · WORKSPACE_CHANGE = NO · FLEET_CUTOVER_CHANGE = NONE ·
AUTH_CHANGE = NO_IN_REPO · RUNTIME_RELOAD = NO · MERGE_PERFORMED = NO ·
SECRET_MATERIAL_IN_THIS_SPEC = NONE
REVISION_ROUND（2026-08-25，Revision 1）：PRODUCT_CODE_CHANGE = NONE ·
AGENTS_JSON_CHANGE = NO · DEFINITION_CREATED = 0 · DISABLED_FLIP = NO ·
AUTH_IDENTITY_CREATED = 0 · STORE_WRITE = NO · BINDING_CHANGE = NO ·
GRANT_CHANGE = NO · WORKSPACE_CHANGE = NO · FLEET_CUTOVER_CHANGE = NONE ·
AUTH_CHANGE = NO_IN_REPO · RUNTIME_RELOAD = NO · MERGE_PERFORMED = NO ·
PRODUCTION_STATE_CHANGE = NONE（仍 DOCS ONLY：仅修改本文件）

REVISION 1 (2026-08-25) 修订内容：
  (1) auth-service 坐标更正——170736e = historical source snapshot（原稿误标
      为 main HEAD at authoring）；authoring-time main = 45b1b890；current
      main = d529bd3c；mint 检查漂移经四修订对照更正为「仅存在于历史快照，
      authoring-time main 起已与生产修订一致」（§3 / OBS-WA-006 / OBS-WA-007）
  (2) 初始 Definition disabled:true（§0 Batch 2 / §1 / CTR-WA-001 / ACC-WA-001）
  (3) disabled 状态语义冻结（§2.3：身份可准备；Notification/Feishu/Product
      API/Scheduler 四表面不可启动；零 spawn、零 Workspace/Home 自动创建；
      OBS-WA-009 / CLM-WA-004 / EVD-WA-004）
  (4) activation boundary 单独冻结（DEC-WA-007 / CTR-WA-009 / ACC-WA-009：
      disabled:true -> false 仅经独立受控 activation authority；Slice A
      bootstrap 不得自动启用）
  (5) full review 重做——机械校验与语义审计全部重做，不沿用旧语义审计结论

REVISION 2 (2026-08-25) current-main ingress reconciliation：
  CURRENT_DSH_MAIN = b3a6d4fe089c4b95bdc22df0cabd24eeb3ccb724
  NOTIFICATION_INGRESS_ACCEPTS_TARGET_AGENT_ID = YES
  NOTIFICATION_INGRESS_TARGET_ALLOWLIST_EXISTS = NO
  FEISHU_BINDING_REQUIRED = NO
  ROUTER_DELIVERY_CALLS_ENSURE_RUNNING = YES
  SPEC_INERTNESS_CLAIM = FALSE（无 Binding/grant 不足以证明 Notification inert）
  PREMATURE_PROCESS_ACTIVATION_RISK = DETECTED
  REQUIRED_BOUNDARY = caller allowlist + body.agentId 不得在 activation 前投递；
    disabled:true definition gate 必须在 ensureRunning/spawn 前拒绝；身份 bootstrap
    后仍 non-routable；disabled:true -> false 仅归独立受控 activation authority
  REVISION_2_ROUND = DOCS ONLY · SAME SPEC · SAME DRAFT PR ·
    PRODUCT_CODE_CHANGE = NONE · TEST_CHANGE = NONE · SCRIPT_CHANGE = NONE ·
    RUNTIME_WRITE = NO · AGENT_START_OR_RESTART = NO · MERGE = NO
  FRESH_FULL_REVIEW_REQUIRED = YES（不得复用 Revision 1 review）

REVISION 3 (2026-08-26) governance-authority and failure-recovery closure：
  REVISION_3_CLASS = GOVERNANCE_AUTHORITY_AND_FAILURE_RECOVERY_CLOSURE
  RECONCILED_MAIN = c52bd1ca2720bbea763a9fd9eb4b9069285b47ff（普通 merge，无冲突）
  IMPLEMENTATION_AUTHORITY = contracts（治理协议唯一认可字段）
  UNRECOGNIZED_AUTHORITY_FIELDS_REMOVED = YES
    （identity_execution_authority / production_apply_authority 已从 frontmatter 删除）
  DOCS_MERGE_PERFORMS_RUNTIME_WRITE = NO
  SEPARATE_EXECUTION_TASK_REQUIRED = YES
  SEPARATE_EXECUTION_SPEC_REQUIRED = NO
  EXECUTION_ALLOWED_ONLY_WHEN = exact accepted revision in implementation base ·
    preflight IMPLEMENTATION_ALLOWED=YES · execution task records exact
    implementation/evidence coordinates · Contract-by-Contract conformance
  BOOTSTRAP_SUCCESS_REQUIRES_VERIFICATION_MINT = YES（父权威 Phase A 成功条件完整继承）
  VERIFICATION_MINT_FAILED_OR_INCONCLUSIVE = BOOTSTRAP_INCOMPLETE
    （IDENTITY_STATE = PARTIAL_SAFE_DISABLED；不报成功；不 blind rotate）
  ATTEMPT_LEDGER_REQUIRED = YES
    （docs/evidence/workflow-admin-agent-bootstrap-v1/attempt-ledger.json）
  S2_OUTCOME_UNKNOWN_CLOSED = YES
    （CLIENT_ABSENT 重试 / 已验证继续 / SECRET_UNAVAILABLE STOP+
    INCOMPLETE；唯一恢复 = 独立受控 SAME-client rotation 执行）
  ROLLBACK_TARGET = SAFE_DISABLED_STAGED_IDENTITY
  AGENT_DEFINITION_REMOVE_REQUIRED = NO（current main 无 remove seam，OBS-WA-011）
  ACTIVATION_AUTHORITY_ID = AGENT_CORE_WORKFLOW_ADMIN_AGENT_ACTIVATION_V1
  TARGET_ADMISSION_AUTHORITY_ID =
    AGENT_CORE_WORKFLOW_ADMIN_AGENT_NOTIFICATION_TARGET_ADMISSION_V1
  THIS_BOOTSTRAP_SPEC_AUTHORIZES_ACTIVATION = NO（八项 activation 前置已冻结）
  CONTRACT_COUNT = 12 · CONTRACTS_WITH_ACCEPTANCE = 12 · ACCEPTANCE_COUNT = 12
  OWNER_PRODUCT_DIRECTION_CHANGED = NO
  EXACT_AGENT_SUBJECT_CHANGED = NO
  SLICE_BOUNDARY_EXPANDED = NO
  SECURITY_BOUNDARY_STRENGTHENED = YES
  REVISION_3_ROUND = DOCS ONLY · SAME SPEC · SAME DRAFT PR ·
    PRODUCT_CODE_CHANGE = NONE · TEST_CHANGE = NONE · SCRIPT_CHANGE = NONE ·
    STRUCTURE_REGISTRY_CHANGE = NO · RUNTIME_WRITE = NO ·
    AGENT_START_OR_RESTART = NO · MERGE = NO
  FRESH_FULL_REVIEW_REQUIRED = YES（不得复用 Revision 1/2 review）

REVISION 4 (2026-08-27) clean-base and parent semantic alignment：
  REVISION_4_CLASS = CLEAN_BASE_AND_PARENT_SEMANTIC_ALIGNMENT
  REPLACED_PR = mayf3/dsh-agent-core#67
  OLD_REVISION_3_HEAD = fea8f2996129d8b797a1b950fea47983e2b1e30b
  CLEAN_BASE = b620907fc6f58292b6ee096c977f0071921d747e
  MERGED_MAIN_HISTORY_IN_REPLACEMENT = NO
  PARENT_D5_CLASSIFICATION_INHERITED = YES
  CREDENTIAL_LAYER_VERIFICATION = PASS | FAIL | INCONCLUSIVE
  ZERO_GRANT_INVALID_SCOPE_CLASSIFICATION = CREDENTIAL_LAYER_PASS
    （exact zero-Grant requires reason=machine_grant_missing；
    requested_scope_not_granted alone does not prove zero Grant）
  BUSINESS_GRANT_READINESS_AFTER_BOOTSTRAP = NOT_READY
  ZERO_GRANT_BOOTSTRAP_RESULT = SUCCESS_IDENTITY_ONLY
  EXISTING_STORE_REENTRY_SYNC = current invocation STOPPED + ZERO_AUTH_CALL_STOP +
    zero new durable writes；historical PASS evidence may only confirm historical result
  EARLY_STOP_RECEIPT_SYNC = ledger-before STOP emits no final receipt；ledger-after STOP
    uses exact six keys with null unresolved IDs and status STOPPED
  DURABLE_RECEIPT_SCHEMA = MINIMAL_EXACT_ALLOWLIST
    （attemptId / principalId / clientId / requestDigests / status / evidenceRefs）
  REVISION_3_MINT_200_ONLY_READING = SUPERSEDED_BY_EXACT_PARENT_D5_CLASSIFICATION
  REVISION_3_BROAD_RECEIPT_SHAPE = SUPERSEDED_BY_MINIMAL_EXACT_ALLOWLIST
  CONTRACT_COUNT = 12 · CONTRACTS_WITH_ACCEPTANCE = 12 · ACCEPTANCE_COUNT = 12
  REVISION_4_ROUND = DOCS ONLY · SAME SPEC · CLEAN REPLACEMENT DRAFT PR ·
    PRODUCT_CODE_CHANGE = NONE · TEST_CHANGE = NONE · SCRIPT_CHANGE = NONE ·
    AGENTS_JSON_CHANGE = NO · RUNTIME_WRITE = NO · AGENT_START_OR_RESTART = NO ·
    MERGE = NO · FORCE_PUSH = NO
  FRESH_FULL_REVIEW_REQUIRED = YES（不得复用 Revision 1/2/3 review）

权威激活路径 = 独立 review PASS + Owner acceptance + merge to main ⇒ 本 Spec
  成为单次有界身份 bootstrap 的合法实现权威（docs merge 本身零运行时写入）⇒
  另行独立派发的「身份 执行」任务在 CTR-WA-008 执行门全部满足后恰好执行一次
NEXT_TASK = 授权 审计（全新的本地审计 Agent 对 lifecycle-only accepted head 做
  final-head recheck；FINAL_HEAD_RECHECK=PENDING；MERGE_ALLOWED=NO）
```
