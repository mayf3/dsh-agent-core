---
spec_id: AGENT_CORE_CANONICAL_ONBOARDING_COMPLETION_V1
status: authorized-implementation
spec_kind: bounded_child_supply_spec
authority_level: governing_child_spec
implementation_authority: this_spec
production_apply_authority: conditional_controlled_operation
authorizing_directive: OWNER RULING "Life Workbench Baseline Access 纳入正式 Agent 生命周期 — CONTINUE_SAME_GOAL" (2026-09-09)：IDENTITY_LIFECYCLE_OWNER=mayf3/dsh-agent-core；PRIMARY_IDENTITY_AUTHORITY=AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1；PREFLIGHT 判定按本文件 §2
approval_ref: OWNER-CANONICAL-ONBOARDING-20260909-01
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
  definitions 文件、trusted store、createAuthProvisioningClient + loopback
  transport adapter、prerequisites `{c,d}`、Part G ownerUid/ownerGid）。
  库的 fail-loud（含 `existing_credential_resolution_required`）原样保留；
  entrypoint 仅把该特定 code 分类为「身份已存在 → 存活性确认」：用 store 内
  既有 credential 做一次 verification mint（200 或 400 invalid_scope = 存活；
  401 = fail-loud credential_invalid，不自动 rotate）。重跑幂等：不建第二个
  Principal/Client/credential。
- STEP 3 Baseline entitlements：调用 auth-service standing reconciliation
  vehicle 的既有特权执行面（approvalRef 固定的 `apply-baseline-grants` +
  `verify-baseline-grants`）；fleet 场景期望 = 既有全体 NOOP、新合格 Agent 恰一
  CREATE、重跑全 NOOP。失败 ⇒ exit 非 0、状态停在 BASELINE_ENTITLEMENTS_PENDING，
  **绝不撤销/回滚已正确创建的 canonical identity**，保持可重试。
- 输出：状态机 JSON（无 secret；Part H 红线继承：provisioner secret 与新 client
  secret 只经文件读入/HTTPS body → 内存 → 0600 store）。

## 4. 生产 trusted store zone（Part G 在部署现实的落地）

accepted store-writer 冻结要求 store 父目录 0700 且属主为 trusted CP（无选项
活口）；当前部署把 store 放在共享安装 config 目录（0755 root:wheel，文件
0600 authsvc）。本 spec 以**语义不变的部署迁移**闭合冲突：

```text
/usr/local/libexec/agent-core/credential-store/        # 0700 authsvc:authsvc（Part G 私区）
/usr/local/libexec/agent-core/credential-store/agent-credentials.json   # 0600 authsvc:authsvc（真实文件）
/usr/local/libexec/agent-core/config/agent-credentials.json → 相对符号链接指向真实文件
```

- 一次性迁移（迁移脚本，root 单次）：preimage 备份 → 建私区 → 原子移动真实
  文件（属主/模式保持）→ pinned 路径原子替换为相对符号链接 → 双面验证
  （broker 读路径 read-through + 库 preflightTrustedCredentialDirectory）。
- 零代码/零重启影响：broker 消费面 `readFileSync` 跟随符号链接（per-call 重读
  语义不变）；plist `AGENT_CORE_CREDENTIALS_FILE` 与既有 executor 路径绑定不变。
- provisioning 库始终使用真实路径（符号链接仅服务既有消费面）。

## 5. 库接触面兼容（wiring 暴露的机械错位，非语义变更）

accepted 库从未与生产 seam 接触过；首次接线暴露一处 wire 字段错位：S2 响应的
one-time secret 字段，部署路由返回 `secret`，库读取 `client_secret ?? clientSecret`。
本 spec 授权**一行兼容扩展**（`?? client?.secret`）+ 对应测试；状态机、
external_ref、store 契约、fail-closed 语义零改动。loopback HTTP 由 entrypoint
注入 fetch adapter（scheme 重写）解决，库字节不动（HTTPS origin 契约保持）。

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
