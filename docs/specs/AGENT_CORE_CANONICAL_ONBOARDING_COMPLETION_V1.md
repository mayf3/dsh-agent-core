---
spec_id: AGENT_CORE_CANONICAL_ONBOARDING_COMPLETION_V1
status: proposed-candidate
spec_kind: bounded_child_supply_spec
authority_level: governing_child_spec_pending_acceptance
implementation_authority: none_until_accepted
production_apply_authority: none
proposed_approval_ref_label: OWNER-CANONICAL-ONBOARDING-20260909-01
proposed_approval_ref_label_note: "LABEL PROPOSAL ONLY — 生效需 Owner 显式接受；在此之前本 ref 不构成任何 Owner authorization"
authorizing_context: OWNER CONTINUE_SAME_GOAL ruling（2026-09-09）：IDENTITY_LIFECYCLE_OWNER=mayf3/dsh-agent-core；PRIMARY_IDENTITY_AUTHORITY=AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1；PREFLIGHT 判定按本文件 §2；PRODUCTION_OPERATION_AUTHORIZED=NO
date: 2026-09-09
governed_by:
  - AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 (accepted；identity 语义唯一权威，冻结项全部继承)
  - AGENT_DEFINITION_ACCESS_V1 (definition 权威与写面校验器)
external_authorities:
  - repository: mayf3/auth-service
    authority_id: LIFE_WORKBENCH_BASELINE_GRANT_SUPPLY_V1
    relation: depends_on (baseline entitlement 层的 standing reconciliation vehicle)
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1
    relation: precedent (uniform baseline entitlement 家族形态)
supersedes: []
superseded_by: null
owners: [mayf3]
---

# AGENT_CORE_CANONICAL_ONBOARDING_COMPLETION_V1

## 0. AUTHORITY STATUS（三分，owner ruling 2026-09-09 固定）

```text
SPEC_STATUS                     = PROPOSED_CANDIDATE（待独立评审 + Owner acceptance）
IMPLEMENTATION_STATUS           = COMPLETE_CANDIDATE（PR #234；candidate 架构方向已被 Owner 接受，
                                  非 production 基线）
PRODUCTION_OPERATION_AUTHORIZED = NO
proposed_approval_ref_label     = OWNER-CANONICAL-ONBOARDING-20260909-01（仅为 label 提案，
                                  Owner 接受前不构成任何 authorization；实现 Agent 不得自行生成或
                                  宣称有效 approvalRef）
```

Owner acceptance 前禁止：production migration、真实 canary 创建、credential-store
mutation、任何 production onboarding execution。

## 1. 目标链（CANONICAL_ONBOARDING_TARGET，owner 冻结）

```text
canonical definition committed
  ↓ (复用 packages/agent-definition 写面，校验器冻结语义)
existing ensureAgentCredential(agentId)            ← AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 本体，逐字复用
  ↓
IDENTITY_READY（verification mint PASS）
  ↓ (复用既有 standing baseline entitlement reconciliation vehicle)
required baseline entitlements converged
  ↓
ONBOARDING_READY
```

可观察、可重试的中间状态（不引入跨系统强事务）：
`DEFINITION_READY · IDENTITY_PENDING · IDENTITY_READY · BASELINE_ENTITLEMENTS_PENDING · ONBOARDING_READY`。
正式 onboarding **不得**在 identity 未 ready 时报告 COMPLETE。

## 2. PREFLIGHT 裁决（authority ownership）

- 现有 accepted spec 均未定义 "definition + identity-ready + mandatory baseline
  entitlements = onboarding 完成"：credential provisioning spec 只定义身份语义；
  AGENT_DEFINITION_ACCESS_V1 只定义定义变更。本 contract 因此以 **bounded child
  authority** 形式落在 dsh-agent-core（不 AMEND 任何 accepted 父 spec 的冻结项，
  不在 personal-cognition-audit 持有 authority，不把 Agent lifecycle 反向放进
  auth-service，不建 Workbench 专用 onboarding spec，不建 IAM/policy framework）。
- Life Workbench 只属于最后的 baseline entitlement 层：身份四件套语义零特例；
  entitlement 层 = 引用 auth-service 的 standing reconciliation vehicle（首个成员
  = life-workbench baseline；家族形态 = internal directory baseline 先例）。

## 3. Entrypoint（唯一正规实现面）

`scripts/canonical-agent-onboarding.mjs` —— deployment-side operator CLI
（root seam，与 `production-agent-provision.mjs` 同类的部署面工具；不是模型任意
shell、不是新 identity engine、不是 runtime hook、不是 Workbench helper）：

- STEP 1 Definition：读权威 agents.json；目标 id 不存在 → 以 accepted 写面
  （`writeAgentDefinition`，校验器全量验证 + 原子替换）追加
  `{id,name,description}`；已存在 disabled → fail-loud（不静默 re-enable）；
  已存在 enabled → noop。写前 preimage 备份。
- STEP 2 Identity：**逐字调用** `ensureAgentCredential`（注入生产 faces：
  definitions 文件、trusted store、createAuthProvisioningClient、prerequisites
  `{c,d}`、Part G ownerUid/ownerGid）。库的 fail-loud（含
  `existing_credential_resolution_required`）原样保留；entrypoint 仅把该特定
  code 分类为「身份已存在 → 存活性确认」：用 store 内既有 credential 做一次
  verification mint（200 或 400 invalid_scope = 存活；401 = fail-loud
  credential_invalid，不自动 rotate——恢复走 canonical rotation seam）。
  重跑幂等：不建第二个 Principal/Client/credential。
- STEP 3 Baseline entitlements：调用 auth-service standing reconciliation
  vehicle 的既有特权执行面（approvalRef 固定的 `apply-baseline-grants` +
  `verify-baseline-grants`）；fleet 场景期望 = 既有全体 NOOP、新合格 Agent 恰一
  CREATE、重跑全 NOOP。失败 ⇒ exit 非 0、状态停在 BASELINE_ENTITLEMENTS_PENDING，
  **绝不撤销/回滚已正确创建的 canonical identity**，保持可重试。
- 输出：状态机 JSON（无 secret；Part H 红线继承：provisioner secret 与新 client
  secret 只经文件读入/HTTPS body → 内存 → 0600 store）。

## 4. Trusted store zone（独立治理包——不随本 PR 执行）

**MIGRATION_REQUIRED_FOR_CANONICAL_ONBOARDING = YES**：accepted store-writer
冻结要求 store 父目录 0700 且属主为 trusted CP（无选项活口）；生产 store 现存
于共享安装 config 目录（0755 root:wheel，文件 0600 authsvc）。identical 语义
的 accepted 实现无法对现状落写 ⇒ 迁移是 canonical onboarding 的必要前置。

但它同时是 **fleet-wide credential infrastructure change**，因此按 owner
ruling 拆为独立治理包，不作为本 implementation 的 incidental step：

```text
governing parent authority = AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 Part G
                             （trusted-zone 语义来源；本包零语义变更）
exact pre-state            = pinned 路径为普通文件 0600 authsvc(505:601)，
                             父目录 0755 root:wheel
exact post-state           = /usr/local/libexec/agent-core/credential-store/ 0700 505:601
                             …/credential-store/agent-credentials.json 0600 505:601（真实文件）
                             旧 pinned 路径 = 相对符号链接 ../credential-store/agent-credentials.json
consumer compatibility     = broker gateway：readFileSync 跟随符号链接、per-call
                             重读（源码核实）；plist 绑定不变；executor
                             shasum/-f 检查跟随符号链接；provisioning/rotation
                             库 lstat 拒 symlink ⇒ 一律使用真实路径（迁移后
                             面向真实路径的调用面不变，含 rotation 的 .bak
                             preimage 落在同私区）
rollback                   = preimage（bytes+sha256）还原 + 移除符号链接
failure behavior           = 任何一步失败即停，文件已入私区则以 preimage 回滚；
                             拒绝在非一致状态上"顺手修复"
fleet blast radius         = 全体 88 Agent 的 credential 解析路径（经符号链接
                             透传）；需 bounded independent review PASS 后
                             单独进入 Owner acceptance / production package
candidate artifact         = 归档于 deployment-artifacts/canonical-onboarding-v1/
                             migration-candidate/（未执行；不属本 PR change set）
```

**不得先迁生产 store 再证明。**

## 5. 传输契约（HTTPS——parent authority 待决前置；代码零静默降级）

parent authority（AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 Part A.4/H）冻结：
provisioner management 调用与 one-time client secret 的唯一合法路径是
**auth-service HTTPS response body → 进程内存 → 0600 store**；库的
`normalizeOrigin` 恒等拒绝非 HTTPS origin。生产现实：auth-service 部署为
loopback `http://127.0.0.1:4001`（与 BROKER_AUTH_ORIGIN 同一信任域；2026-08-23
fleet 身份批次即经该 loopback seam 创建）。

处置（owner ruling 阻塞 3）：

- **本 implementation 不携带任何 transport adapter**：CLI 原样传递所配 origin；
  在 parent authority 解析之前，库对 http origin fail-loud
  `AUTH_CONFIGURATION_ERROR`，对 https origin 的调用因服务无 TLS 而
  fail-closed——即 **IDENTITY 步骤在传输决议前不可执行**，这是诚实的
  fail-closed，不是可用的旁路。
- 解析路径二选一（需经语义 review + Owner acceptance，作为 parent authority
  amendment / explicit prerequisite resolution）：
  - **A**：使用真正满足 parent contract 的现有 HTTPS/provisioning seam
    （当前生产不存在 TLS 面）；
  - **B（提案）**：把受控 loopback HTTP 显式接受为本部署的 provisioning
    transport（与全体 deployed machine 流量——broker token minting——同一
    信任域、同一 listen 面），作为 parent authority 的显式 prerequisite
    resolution。
- 库一行 wire-field 兼容（S2 one-time secret 的 `secret` 字段）维持 §5 原判定：
  机械接线修正，非语义变更。

## 6. 边界（禁止，owner 冻结继承）

不建平行 identity onboarding；不为 Workbench 特例化身份语义；不把
`agent.definition.write`（canonical definition mutation）当作 onboarding
completion；不要求 per-Agent approval / per-Agent whitelist / per-Agent owner
动作；baseline reconciliation 失败不得撤销 identity；不重做 Auth/Broker/
Workbench；不处理 rotation packet 与其他 FOLLOW_UP_DEBT。

## 7. 验收（DONE_WHEN 映射）

真实新 Agent（agt_lw-lifecycle-canary）仅经本 entrypoint：
definition → IDENTITY_READY → baseline 自动收敛（read+propose）→ ONBOARDING_READY；
重跑全幂等（无平行 Principal/Client/credential/Grant）；随后正常产品会话
workbench_read → workbench_propose 产生真实 ENTRY_ID；disabled /
identity-not-ready / legacy-test-external 继续 fail-closed/排除；
MANUAL_BASELINE_APPLY_REQUIRED = NO；OWNER_PER_AGENT_ACTION_REQUIRED = NO
（Workbench 层零 owner 触碰；canary 的创建本身 = owner 执行一次 canonical
entrypoint 命令，属 Agent 创建的固有主行为，非 Workbench 特例）。
