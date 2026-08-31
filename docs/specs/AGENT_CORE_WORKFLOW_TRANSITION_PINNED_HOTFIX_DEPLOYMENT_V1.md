---
spec_id: AGENT_CORE_WORKFLOW_TRANSITION_PINNED_HOTFIX_DEPLOYMENT_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: contracts
date: 2026-08-31
type: implementation-spec (production deployment authority proposal; docs-only authoring round)
scope:
  - mayf3/dsh-agent-core
  - production Broker PINNED_TRANSITION_ONLY_HOTFIX 部署授权（workflow_transition only；恰好一个 runtime 文件 packages/broker/src/capabilities/workflow.js）
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - repository-maintainers
---

# AGENT_CORE_WORKFLOW_TRANSITION_PINNED_HOTFIX_DEPLOYMENT_V1

> **PROPOSED / NOT ACCEPTED（2026-08-31，授权 执行 authoring 轮）。** 本文件是
> workflow_transition 生产部署的 **deployment Authority 提案**，依据已完成的独立
> 基线审计（PR #125 comment `5478392503`，
> `RECOMMENDED_OWNER_RULING = REQUIRE_DEPLOYMENT_AUTHORITY_BEFORE_ARTIFACT`）起草。
> 本轮 **docs-only**：不构建制品、不解封旧制品、不写生产目录、不 sudo、不重启服务、
> 不修改 Grant、不修改 svc-workflow、不修改 Broker 产品代码、不执行 workflow
> transition、不执行 canary、不代表 Owner 接受或合并本 Authority。在独立「授权 审计」
> PASS 且 Owner 完成 acceptance 事务之前，本文件 **不授权任何实现或生产动作**
> （`implementation_authority = none`、`production_apply_authority = none`）。
> **DO NOT MERGE**（等待「授权 审计」独立复审；合并仅由 Owner 执行）。

## 1. Goal

为 production Broker 建立 workflow_transition 的**唯一生产部署 Authority**，冻结为
**PINNED_TRANSITION_ONLY_HOTFIX**：只把 `workflow_transition` capability 部署到生产
Broker（恰好一个 runtime 文件），**不顺带部署** workflow_domain_instances Pagination
V2（mapping.js / schema.js 及其测试）。本 Spec 被接受后，才允许开启新的制品轮
（`制品 执行` → `制品 审计` → Owner 部署 → `部署 审计`），并把 canary / Grant
rollout 继续排除在部署授权之外（它们是后续独立 Owner 授权事务，见 CTR-HD-006）。

本 Spec 不改变 `AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1`（下称
**Governing Capability Spec**）的任何 accepted 决策；其 `production_apply_authority
= none`（§18/§20）所要求的前置——"an accepted production-deployment authority
naming the frozen baseline is required before any new artifact"——由本 Spec 经
标准 lifecycle 事务满足。

## 2. Scope and non-goals

**In-scope（本 Spec 授权面，全部为 accept 后才生效的治理合同）：**

- 冻结唯一发布策略：RELEASE_STRATEGY / 四个 commit 坐标 / feature set / 排除集
  （CTR-HD-002）；
- 冻结生产部署单元与路径 allowlist（恰好一个 runtime 文件）及等面回滚
  （CTR-HD-003）；
- 冻结源文件与生产 preimage 的完整 Git blob 身份与 fresh preflight 义务
  （CTR-HD-004）；
- 部署不自动开放写能力：CTR-009 canary gate 独立性、写闸门前置校验、部署后
  只读证明面与禁止面（CTR-HD-005）；
- 后续九步执行链与角色独立性边界（CTR-HD-006 / CTR-HD-008）；
- post-freeze main 漂移政策（CTR-HD-007）；
- 安全部署 Contract（机械加固清单，CTR-HD-009）；
- 旧制品永久 rejected（CTR-HD-010）；
- hotfix 继任与退役条件（CTR-HD-011）；
- 本轮 authoring 边界（CTR-HD-012）。

**Non-goals：**

- 不实现、不修改任何产品代码（Broker / svc-workflow / auth-service / 本仓库
  任何 package）；
- 不构建、不审计、不执行任何部署制品；
- 不授权 workflow write rollout / canary 执行 / Grant 变更（见 CTR-HD-005/006）；
- 不修改 Governing Capability Spec 本体（GOVERNING_SPEC_UNMODIFIED，CTR-HD-012）；
- 不裁决 Pagination V2 的生产发布——那是另一条独立 Authority 的事务。

## 3. Authority and dependencies

**Parent authorities（precedence 顺序）：**

1. `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0`（治理协议 adoption；vendored
   distribution @ `.agents/`，`governance.lock.json` 校验）；
2. `AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1`（accepted @
   AUTHORITY_BASELINE_COMMIT；被部署能力的全部行为合同 CTR-001..009 的 owner）。

本 Spec 是**新增（NEW）governing Spec**，`supersedes = []`：它不替换任何既有
authority，只填补 Governing Capability Spec 显式留空的 production-deployment
authority 位（其 §17 AMEND-3 模式 / §18 flip record 确立了 lifecycle-only
authority transaction 的仓库先例）。

**输入坐标（dispatch 冻结，全部经本轮独立复核，见 §5）：**

```text
REPOSITORY                    = mayf3/dsh-agent-core
CURRENT_MAIN_AT_DISPATCH      = 647835676e7acb904dae48e9b543f4722dcc3ccb
CURRENT_MAIN_AT_AUTHORING     = 2392a41d4655ba25ed9e9749fbf8beb0ad1c71b4（无关漂移，OBS-HD-006；任务 Base 不变）
FEATURE_PR                    = 125（MERGED）
FEATURE_IMPLEMENTATION_HEAD   = f5e44c20fb5fada02e9feffb28c0b8b375e7c057
FEATURE_MERGE_COMMIT          = 1aa8248893766aaf1caae17b2905e40061f0a147
PINNED_RELEASE_SOURCE_COMMIT  = f4bc4311225c9e0fd906ce108a5b9ffdbd83a957
DOMAIN_PAGINATION_MERGE       = 4d7ca245ec0b9f6ed8a650f742b94b39728331a7
AUTHORITY_BASELINE_COMMIT     = 647835676e7acb904dae48e9b543f4722dcc3ccb
ACCEPTED_GOVERNING_SPEC       = AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1
BASELINE_AUDIT_COMMENT_ID     = 5478392503（PR #125；RECOMMENDED_RELEASE = PINNED_TRANSITION_ONLY_HOTFIX）
```

**旧制品（全部 rejected，不得恢复/修补/复用，CTR-HD-010）：**

```text
OLD_ARTIFACT_1      = /tmp/dsh-agent-core-1aa8248-deploy/workflow-transition-1aa8248.tar
OLD_ARTIFACT_1_SHA256  = db573426e6510777b095625456f4fc965551d028f19f3857250d289363860f98
OLD_ARTIFACT_2      = /Users/yanfenma/workspace/deployment-artifacts/dsh-agent-core-workflow-transition-f4bc4311225c/workflow-transition-f4bc4311225c.tar
OLD_ARTIFACT_2_SHA256  = 482e19c90d08aef415aa4b75316d281160785e1ebae09be40ddf78bcfccf9d5b
OLD_ARTIFACT_STATUS = REJECTED / NOT_AUDITABLE / NOT_DEPLOYABLE
```

## 4. Current State

- `STATE-HD-001` — Governing Capability Spec @ `6478356` 为 accepted /
  `implementation_authority: contracts` / `production_apply_authority: none`
  （§16/§18/§20；PR #129 修订为纯增量治理，未授权生产部署）。Basis：`OBS-HD-005`。
- `STATE-HD-002` — workflow_transition **尚未部署到生产**：生产 Broker 运行
  `9bb5b97` 树（PR #114 时代 base），其 `packages/broker/src/capabilities/workflow.js`
  live blob = `04ca8550fbdaf9b66624dea42701a8a9af7547a8`（最近已记录 live-tree
  观察 2026-08-30/31）；无因 transition 而起的服务重启 / Grant 变更 / canary /
  真实 transition。Basis：`OBS-HD-004`、基线审计 §H。
- `STATE-HD-003` — pinned release source `f4bc431` 与生产运行时（`9bb5b97` 树）的
  **runtime 差恰好是一个文件**：`workflow.js` `+62/−3`（全部删除行为注释行）；
  mapping.js / schema.js / transport.js / relay.js / registry.js / index.js 六个
  兄弟文件 blob 逐字节相同。Basis：`OBS-HD-003`。
- `STATE-HD-004` — 本 Spec 提案时点（2026-08-31T13:11Z），仓库内**不存在**任何
  accepted 的 production deployment authority 命名该冻结 baseline；两枚旧制品
  rejected；PR #117 及一切当前 OPEN draft PR 均不可执行生产部署。Basis：
  `OBS-HD-001`、`OBS-HD-010`。

## 5. Observations

### OBS-HD-001 — 基线审计裁决（本 Spec 的直接证据输入）

- Subject: 独立「基线 审计」（reviewer 独立于两轮制品构建 Agent 与实现作者）
- Source: PR #125 comment `5478392503`（github.com/mayf3/dsh-agent-core）
- Environment: 独立 detached clean worktree；origin/main == `6478356` ==
  CURRENT_MAIN_AT_DISPATCH（审计时零漂移）
- Observed at: 2026-08-31（审计轮；本轮 authoring 于 2026-08-31T13:11Z 复读）
- Method: 只读复审 f4bc431 / 1aa8248 / 4d7ca24 / 6478356 四 commit + 生产 evidence
- Result: `RECOMMENDED_OWNER_RULING = REQUIRE_DEPLOYMENT_AUTHORITY_BEFORE_ARTIFACT`；
  `PINNED_TRANSITION_ONLY_HOTFIX_SAFE = YES`（八项检查全过）；
  `CURRENT_MAIN_COHERENT_RELEASE_SAFE = YES` 但需 joint feature set + 双
  production_apply authority；`PRODUCTION_CHANGE = NONE`
- Provenance: comment 全文 + 本地报告
  `docs/reports/agt-core-workflow-transition-baseline-audit-v1.md`

### OBS-HD-002 — 两个完整 Git blob 身份（本轮独立解析，不用短前缀）

- Subject: workflow.js 的 target 与 production preimage 完整 blob SHA
- Source revision: `f4bc4311225c9e0fd906ce108a5b9ffdbd83a957` /
  `9bb5b97442c7155da36f06e867d1a655410544ac`
- Method: `git rev-parse <commit>:packages/broker/src/capabilities/workflow.js`
- Observed at: 2026-08-31T13:0xZ（authoring 轮，clean worktree @ `6478356`）
- Result:
  `f4bc431:…workflow.js = 577c8778cf35810ce7538aff52ab354e0c1dddc6`
  `9bb5b97:…workflow.js = 04ca8550fbdaf9b66624dea42701a8a9af7547a8`
- Provenance: 本轮 shell 记录；与基线审计短前缀（`577c877…` / `04ca8550…`）前缀一致

### OBS-HD-003 — deployed→pinned 运行时差恰好一个文件（本轮独立复核）

- Subject: `9bb5b97`（生产已部署树，PR #114 merge）vs `f4bc431`（pinned source）
- Method: `git diff --stat 9bb5b97..f4bc431 -- packages/broker/`；
  六文件 `git rev-parse` blob 对比
- Result: packages/broker 运行时差 = **仅**
  `packages/broker/src/capabilities/workflow.js`（`+62/−3`；另两 diff 文件为
  test，不属运行时）；mapping/schema/transport/relay/registry/index 六文件
  blob **IDENTICAL**
- Provenance: 本轮 shell 记录；与基线审计 §A/§E 一致

### OBS-HD-004 — 生产 live manifest 最近已记录观察（既有 evidence，非本轮生产访问）

- Subject: 生产 `/usr/local/libexec/agent-core/app` live 树
- Source: `docs/evidence/deploy-9bb5b97-live-drift-v3-20260831/live-manifest-20260831.txt`
  第 56 行
- Environment: production host（deploy v3 调查轮只读重算 manifest）
- Observed at: 2026-08-30/31（该轮）
- Result: `04ca8550fbdaf9b66624dea42701a8a9af7547a8
  packages/broker/src/capabilities/workflow.js`；全树 132 文件 / digest
  `9ac84954…`；workflow.js live OID == `9bb5b97`（PR #114 已部署）
- Provenance: 上述 evidence 文件 + `docs/reports/agent-core-deploy-9bb5b97-live-drift-v3.md`

### OBS-HD-005 — Governing Capability Spec lifecycle @ baseline

- Subject: `docs/specs/AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1.md`
- Source revision: `6478356`（PR #129 merge = AUTHORITY_BASELINE_COMMIT）
- Method: `git show 6478356:<path>` frontmatter + §16/§18/§20/CTR-009 阅读
- Result: `status: accepted`、`implementation_authority: contracts`、
  `production_apply_authority: none`；CTR-009 三层 fail-closed 闸门
  （`AUTH_V1_CANARY_WRITE_ENABLED` 全局写闸门默认 false / per-identity allowlist /
  grant 供给），canary 为 design-only 且需 Owner 单独下令；STATE-007：workflow.js
  注册 7 个 workflow manifest，aggregate shipped = **15**
- Provenance: 本轮 `git show` 记录 + 基线审计 §D

### OBS-HD-006 — authoring 期间 main 漂移（无关）

- Subject: origin/main `6478356` → `2392a41`
- Method: `git log/diff --name-only 6478356..2392a41`
- Observed at: 2026-08-31T13:0xZ（fetch 后）
- Result: 恰一个 merge（PR #105 forum-moderation-capabilities-v2-r2）：新增
  forum-moderation.js / error-detail-sanitizer.js、改 forum.js / index.js /
  mapping.js / schema.js / transport.js + 测试 + `bundle-broker/cordis.patch.yml`
  （+6 行 forum moderator 名单，新 capability 的 bundle 子配置）；
  **docs/ 零变化**（Governing Spec 未动、无任何 deployment authority artifact 变化）；
  **workflow.js 未被触碰**（冻结 release source 文件不变）
- Provenance: 本轮 shell 记录；按 CTR-HD-007 判定为无关漂移（不重定向 source
  commit，任务 Base 固定 `6478356`）

### OBS-HD-007 — 提交拓扑与 ancestry

- Method: `git merge-base --is-ancestor` + `git show -s`
- Result: `f4bc431` 是 `6478356` 与 `2392a41` 的 ancestor；`1aa8248`（PR #125
  merge，files = workflow.js + 2 test）是 `6478356` 的 ancestor；`4d7ca24`（PR #126
  Pagination V2 merge）在 `6478356` 内；时间线 1aa8248(08:05) → f4bc431(09:28) →
  4d7ca24(09:47) → 6478356(13:24)，均 2026-08-31 +0800
- Provenance: 本轮 shell 记录

### OBS-HD-008 — manifest 计数证据（target 与 preimage 两侧）

- Method: `git show <commit>:packages/broker/test/capabilities/manifest-inventory.test.js`
- Result: `f4bc431`（target 侧）：`schema: all 15 first-batch manifests validate`、
  `assert.equal(all.length, 15)`——部署该 workflow.js 后生产 shipped HTTP
  manifests = **15**（新增 workflow_transition）；`9bb5b97`（preimage 侧）：
  `assert.equal(all.length, 14)`——生产部署前 fresh preflight 的期望计数为 **14**，
  且 capability catalog 中 workflow_transition 当前不存在
- Provenance: 本轮 `git show` 记录；基线审计 §B 同值

### OBS-HD-009 — 生产运行时坐标（dispatch 冻结 + 既有 investigation 佐证）

- Subject: production runtime root / entrypoint / service label / user
- Source: dispatch §六 冻结值；`docs/investigations/scheduler-v2-deploy-target-v1.md`
  （launchctl print 记录）、`docs/investigations/live-app-source-manifest-pr66-monotonic-target-v1.md`
- Result:
  `PRODUCTION_RUNTIME_ROOT = /usr/local/libexec/agent-core/app`；
  `PRODUCTION_ENTRYPOINT = /usr/local/libexec/agent-core/app/scripts/production-runtime.mjs`；
  `PRODUCTION_SERVICE_LABEL = ai.agent-core.runtime`（system LaunchDaemon，
  plist `/Library/LaunchDaemons/ai.agent-core.runtime.plist`）；
  `PRODUCTION_RUNTIME_USER = authsvc`（505:601）
- Provenance: 上述 investigation 文件；**authoring 轮零生产访问**；执行轮必须
  fresh read-only preflight 复核（CTR-HD-004）

### OBS-HD-010 — 旧制品 rejected 状态留痕

- Source: 基线审计 §H + dispatch §二
- Result: `workflow-transition-1aa8248.tar`（sha256 `db573426…`）与
  `workflow-transition-f4bc4311225c.tar`（sha256 `482e19c9…`）均
  REJECTED / NOT_AUDITABLE / NOT_DEPLOYABLE；后者因 deployment closure drift
  被拒，不得恢复为 deployable 或复用
- Provenance: PR #125 comment `5478392503` §H

## 6. Claims and assumptions

- `CLM-HD-001` — 单文件 pinned hotfix 对 transition 语义完备且自洽：`f4bc431` 的
  workflow.js 正是针对生产同款（byte-identical）mapping/schema/transport/relay/
  registry/index 编写并通过其全套测试（基线审计：f4bc431 worktree 186/186 PASS）。
  Support state: SUPPORTED（`EVD-HD-001`）。Uncertainty：无——runtime closure 由
  blob 等同性机械保证。
- `CLM-HD-002` — 生产 preimage 在最近已记录 evidence 时点仍为
  `04ca8550fbdaf9b66624dea42701a8a9af7547a8`；但该事实**随时间衰减**，任何执行轮
  必须以 fresh read-only preflight 重新证明。Support state: SUPPORTED
  （`EVD-HD-002`；limitation 即其时效性 → CTR-HD-004 强制 fresh recheck）。
- `CLM-HD-003` — origin/main 普通前进（如 `2392a41`）不使冻结 baseline 失效：
  漂移未触碰 workflow.js / Governing Spec / deployment authority / packaging 边界。
  Support state: SUPPORTED（`EVD-HD-003`；规范性表达见 CTR-HD-007）。
- `CLM-HD-004` — 仓库治理 schema 存在表达本 Authority 的合法形式：frontmatter
  字段 `production_apply_authority: none|contracts` 在本仓库已有 14 个 spec 先例
  （含 accepted 部署先例 AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V1/V2 于
  接受后为 `contracts`），vendored schema `additionalProperties: true` 且枚举字段
  齐备。Support state: SUPPORTED（`EVD-HD-004`）。**无需发明新 Authority 语法。**
- 无 OPEN_ASSUMPTION 影响权威或合同含义：生产坐标（OBS-HD-009）与 preimage
  新鲜度均被 CTR-HD-004 的执行轮 fresh preflight 义务收敛为合同风险而非假设。

## 7. Evidence relations

- `EVD-HD-001` — Source: `OBS-HD-002`、`OBS-HD-003`、`OBS-HD-008`、基线审计
  §A/§E（186/186）。Target: `CLM-HD-001`。Relation: SUPPORTS。Bound coordinates:
  dsh-agent-core `f4bc431`/`9bb5b97`，observed 2026-08-31。Strength: 强
  （blob 数学 + 测试证据）。Limitations: 不覆盖未观察的未来 revision。
- `EVD-HD-002` — Source: `OBS-HD-002`、`OBS-HD-004`。Target: `CLM-HD-002` /
  `STATE-HD-002`。Relation: SUPPORTS。Bound coordinates: git `9bb5b97` + production
  live manifest 2026-08-30/31。Strength: 强（git blob == live 记录全等）。
  Limitations: 时效性——不证明未来某执行时刻仍相等（→ CTR-HD-004）。
- `EVD-HD-003` — Source: `OBS-HD-006`、`OBS-HD-007`。Target: `CLM-HD-003` /
  CTR-HD-007 的事实面。Relation: SUPPORTS。Bound coordinates: `6478356..2392a41`。
  Strength: 中（单次漂移实例 + 类别判定规则）；规范性兜底由 CTR-HD-007 的
  失效条件清单承担。
- `EVD-HD-004` — Source: `.agents/schemas/spec-frontmatter.schema.json` @
  `6478356`、14-spec `production_apply_authority` 清点（§3/§5 方法）。
  Target: `CLM-HD-004`。Relation: SUPPORTS。Bound coordinates: vendored
  governance @ `6478356`（lock 校验 PASS）。Strength: 强。Limitations: 无。

## 8. Decisions

- `DEC-HD-001` — **发布策略 = PINNED_TRANSITION_ONLY_HOTFIX**。Decision owner:
  mayf3（依基线审计建议 + 授权 执行 dispatch）。Rejected alternative:
  CURRENT_MAIN_COHERENT_RELEASE（ALT-HD-001）。Reason: 最小变更面——单文件、
  纯增量（+62/−3，删除皆为注释）、无 Pagination V2 混入、回滚面最小；coherent
  release 需 joint feature set + 双 production_apply authority + 3 文件回滚。
- `DEC-HD-002` — **Authority 形式 = 新增 governing Spec + 标准 lifecycle flip
  事务**。提案态 `implementation_authority: none` +
  `production_apply_authority: none`；acceptance 事务（§15）在独立「授权 审计」
  PASS 后由 Owner 原子翻转两字段为 `contracts`。不发明任何治理 schema 未定义的
  frontmatter 字段或新 Authority 语法（字段先例：ACTIVATION_V1/V2 + AMEND-3 模式；
  `production_apply_authority` 为本仓库既有字段）。Decision owner: mayf3。
- `DEC-HD-003` — **四角色分离，制品一变全失效**。授权 接受后仍不能立即部署：
  制品构建（新 Deployment Build Agent）→ 制品审计（不同独立 Reviewer）→ Owner
  部署执行（具备 sudo 与 system launchd 权限）→ 部署审计（第四个独立 Reviewer，
  至少与构建及部署执行者独立）。Owner 只对**精确** artifact digest / source stamp /
  deployment manifest / rollback bundle / Owner execution plan / production
  preimage 下令；任一 artifact 字节变化，原审计与 Owner 授权**全部失效**。
- `DEC-HD-004` — **旧制品永久 rejected；新 provenance 重建**。两枚旧 tar（§3
  坐标）不得恢复、修补或复用；Authority 接受后必须从冻结 release baseline 重新
  生成具有新 provenance 的制品。Reason: 旧制品审计链已断（closure drift / 不可
  审计），复用即绕过授权与审计。
- `DEC-HD-005` — **冻结 baseline 不随 main 普通前进失效**（post-freeze drift
  policy 全文见 CTR-HD-007）。构建 Agent 永远不得自行改 source commit / feature
  set / allowlist。
- `DEC-HD-006` — **部署 ≠ 写能力开放**。Governing Capability Spec 的 CTR-009
  canary gate 保持独立；本 Authority 不含 canary Owner command；写闸门
  `AUTH_V1_CANARY_WRITE_ENABLED` 在部署前后必须保持 `false`，且本 Authority 不
  修改该开关。
- `DEC-HD-007` — **hotfix 退役为条件驱动，不设时间期限**。继任条件与失效条件见
  CTR-HD-011；不采用"尽快替换"式 TBD。

## 9. Contracts

### CTR-HD-001 — Authority 唯一性与激活事务

本 Spec 是 workflow_transition 生产部署的**唯一** deployment Authority。提案态
（本文件）不授权任何实现、构建或生产动作。激活只有一条受控路径（无其它 flip
通道）：独立「授权 审计」对完整 reviewed head 给出 PASS verdict（binding：reviewed
head pin、本 Spec 语义确认、frontmatter/schema 校验）→ Owner（mayf3 或 PR 内显式
授权的 maintainer）执行 **ONE commit / ONE file 的 lifecycle-only acceptance
事务**：`status: proposed → accepted`、`implementation_authority: none → contracts`、
`production_apply_authority: none → contracts`，并写入 acceptance record（reviewed
head / verdict / 时间）；除此之外 reviewed semantics 逐字节保留。任何未走该事务的
"已授权"声称无效。

### CTR-HD-002 — 冻结唯一发布策略

接受后，后续制品轮与 Owner 执行必须绑定且仅绑定：

```text
RELEASE_STRATEGY          = PINNED_TRANSITION_ONLY_HOTFIX
RELEASE_SOURCE_COMMIT     = f4bc4311225c9e0fd906ce108a5b9ffdbd83a957
AUTHORITY_BASELINE_COMMIT = 647835676e7acb904dae48e9b543f4722dcc3ccb
FEATURE_ORIGIN_COMMIT     = 1aa8248893766aaf1caae17b2905e40061f0a147
RELEASE_FEATURE_SET       = workflow_transition only
EXCLUDED_FEATURE_SET      = workflow_domain_instances Pagination V2
```

构建 Agent **MUST NOT** 在构建期切换成 current main coherent release，MUST NOT
以"main 已前进"为由改绑 source commit、扩大 feature set 或 allowlist。如未来要
联合发布 Pagination V2（或任何能力组合），MUST 另建新的发布 Authority，MUST NOT
在本 Authority 下扩大 closure。

### CTR-HD-003 — 冻结生产部署单元

```text
PRODUCTION_RUNTIME_ROOT     = /usr/local/libexec/agent-core/app
PRODUCTION_ENTRYPOINT       = /usr/local/libexec/agent-core/app/scripts/production-runtime.mjs
PRODUCTION_SERVICE_LABEL    = ai.agent-core.runtime
PRODUCTION_RUNTIME_USER     = authsvc
DEPLOYMENT_UNIT             = single directly imported ESM source file
DEPLOYMENT_PATH_ALLOWLIST   = ["/usr/local/libexec/agent-core/app/packages/broker/src/capabilities/workflow.js"]
DEPLOYMENT_SCOPE            = 恰好一个 runtime file
ROLLBACK_SCOPE              = 恰好同一个 runtime file + 精确服务恢复动作（preimage 恢复 + label 精确重启）
ROLLBACK_MATCHES_DEPLOYMENT_SCOPE = REQUIRED
```

部署面 MUST 恰为 allowlist 中的一个文件。MUST NOT 部署：
`packages/broker/src/mapping.js`、`packages/broker/src/schema.js`、Pagination V2
测试、workflow-transition 测试、manifest inventory 测试、任何其他 current-main
文件、或整个 repository tree。

### CTR-HD-004 — 冻结源文件与生产 preimage 的完整身份

制品轮 MUST 解析并记录**完整 40-hex Git blob SHA**（不得使用短前缀）：

```text
EXPECTED_TARGET_GIT_BLOB          = 577c8778cf35810ce7538aff52ab354e0c1dddc6
EXPECTED_PRODUCTION_PREIMAGE_BLOB = 04ca8550fbdaf9b66624dea42701a8a9af7547a8
PRODUCTION_PREIMAGE_FRESH_RECHECK_REQUIRED = YES
```

Owner 执行轮在写入前 MUST 以 fresh read-only preflight 确认（任一不符 →
**DEPLOYMENT = STOPPED**）：

- 生产 workflow.js 为 regular file、无 symlink、路径精确、owner/group/mode、
  ACL/xattr，且**完整 byte identity == EXPECTED_PRODUCTION_PREIMAGE_BLOB**——
  preimage 已变化时 MUST NOT 自动将新的生产文件当作 preimage 继续部署，须回
  Authority 审计（按 CTR-HD-007 走重新接受或 supersede）；
- Broker health PASS；
- capability catalog 中 `workflow_transition` **当前不存在**；
- shipped HTTP manifest count 当前为 **14**（preimage 侧计数，见 OBS-HD-008；
  部署后增至 15）。

### CTR-HD-005 — 部署后不能自动变成"写能力已开放"

Governing Capability Spec 的 **CTR-009 canary gate MUST 保持独立**。本 Authority
冻结：

```text
BROKER_DEPLOYMENT_AUTHORIZED    = 仅在 Authority 接受、制品审计通过并有单次 Owner 命令后
WORKFLOW_WRITE_ROLLOUT_AUTHORIZED = NO
CANARY_EXECUTION_AUTHORIZED     = NO
GRANT_ROLLOUT_AUTHORIZED        = NO
WRITE_GATE_REQUIRED_STATE       = AUTH_V1_CANARY_WRITE_ENABLED = false
```

部署前 MUST 只读验证 `AUTH_V1_CANARY_WRITE_ENABLED = false`；若不是 false：
**DEPLOYMENT = STOPPED**。本 Authority MUST NOT 修改该开关。部署后只允许**只读**
证明：Broker health PASS；manifest count = 15；capability catalog 出现
`workflow_transition`；operation 只有 `submit`；requiredScopes =
`["workflow.execute"]`；model-facing schema 不含 `principalId` / `agentId` /
`actor` / `assignee` / `idempotencyKey`；trusted Idempotency-Key 机制仍成立
（trusted transport 生成、模型不可传入 key）；**没有真实 transition**；**没有
Grant 变化**（grant census 只读复核不变）。部署后 MUST NOT：打开
svc-workflow write gate、选择 canary identity、修改 allowlist、修改 Grant、发
真实 workflow transition、或把 capability catalog 的出现描述为 rollout 完成。

### CTR-HD-006 — 后续顺序（CTR-009 依赖链）

本 Authority 明确冻结后续顺序，每一环为独立事务、独立角色：

```text
DEPLOYMENT_AUTHORITY_ACCEPTED（本 Spec acceptance 事务）
→ ARTIFACT_BUILD（新的 Deployment Build Agent）
→ ARTIFACT_AUDIT（不同的独立 Deployment/Release Reviewer）
→ OWNER_DEPLOYMENT_EXECUTION（具备 sudo 与 system launchd 权限的 Owner/Deployment Agent）
→ DEPLOYMENT_AUDIT（第四个独立 Reviewer，至少独立于构建与部署执行者）
→ CANARY_EXECUTION_AUTHORITY（独立授权事务）
→ CANARY_PLAN_AUDIT
→ OWNER_CANARY_EXECUTION
→ CANARY_AUDIT
→ OPTIONAL_GRANT_ROLLOUT_AUTHORITY
```

canary 会**真实改变 workflow state**，MUST 是另一条独立 Owner 授权事务。本
Authority MUST NOT 包含 canary Owner command（DEC-HD-006）。

### CTR-HD-007 — Post-freeze main 漂移政策（规范性 Contract）

1. Owner 接受精确 release baseline 后，origin/main 普通前进**不**使 release
   baseline 自动失效。
2. 后续制品始终绑定：`RELEASE_SOURCE_COMMIT = f4bc431…`、
   `AUTHORITY_BASELINE_COMMIT = 6478356…`、`RELEASE_FEATURE_SET =
   workflow_transition only`、`DEPLOYMENT_PATH_ALLOWLIST = workflow.js only`。
3. **只有**下列情况使 release 失效：
   - accepted deployment Authority 被撤销或 supersede；
   - workflow_transition 安全/合同 blocker 出现；
   - 冻结 target blob 被证明不安全；
   - 生产 preimage 不再匹配（CTR-HD-004 的 STOPPED 分支）；
   - 服务 / packaging / deployment unit 发生相关变化；
   - accepted Governing Spec 发生影响发布合同的 amendment。
4. 无关 docs、其他 capability 或测试提交**不**使制品失效。
5. 构建 Agent MUST NOT 自行改变 source commit、feature set 或 allowlist。
6. 任一有效性输入变化 MUST 重新走：Authority 审计 → Owner 精确接受 → 制品执行。

### CTR-HD-008 — 角色、独立性与授权失效

接受后仍不能立即部署（DEC-HD-003）：
`ARTIFACT_BUILD` = 新的 Deployment Build Agent；`ARTIFACT_AUDIT` = 不同的独立
Deployment/Release Reviewer；`OWNER_DEPLOYMENT_EXECUTION` = 具备 sudo 与 system
launchd 权限的 Owner/Deployment Agent；`DEPLOYMENT_AUDIT` = 第四个独立 Reviewer
（至少与构建及部署执行者独立）。Owner 只能对以下**精确**对象执行：artifact
digest、source stamp、deployment manifest、rollback bundle、Owner execution
plan、production preimage。**任一 artifact 变化，原审计和 Owner 授权全部失效**
（需重走 ARTIFACT_AUDIT 起）。

### CTR-HD-009 — 安全部署 Contract（制品轮与 Owner 执行计划的必备要求）

未来制品与 Owner 执行计划 MUST 要求：

- artifact 位于用户私有 **0700** 目录，**不在 /tmp**；
- regular-file / 无 symlink gate；
- root-owned **0700** staging；
- user-side hash；
- `sudo install`（非 `sudo cp`）；
- root-side 二次 hash；
- safe archive allowlist；
- absolute path / `..` / symlink / hardlink / device file 拒绝；
- 完整 preimage backup；
- owner/group/mode/ACL/xattr 保存；
- same-filesystem 原子替换（temp + rename）；
- 精确 launchd label restart（`ai.agent-core.runtime`）；
- 旧 PID 退出、新 PID 产生；
- 新进程实际加载 target blob（运行时读回 == EXPECTED_TARGET_GIT_BLOB）；
- 无旧 Broker 进程残留；
- health PASS；
- catalog / inventory read-back（CTR-HD-005 证明面）；
- 失败时恢复 preimage 并再次重启；
- root-owned 非秘密 receipt。

禁止以下形式：`sudo bash /tmp/…`、`sudo cp /tmp/…`、`sudo tar -xf /tmp/…`
（一切从 /tmp 以 root 身份解释/展开/复制制品的路径）。

### CTR-HD-010 — 旧制品保持 rejected

§3 所列两枚旧制品（含其 sha256）MUST 保持 REJECTED / NOT_AUDITABLE /
NOT_DEPLOYABLE：不得恢复、修补、重新封印或复用；`制品 执行` 轮 MUST 从冻结
release baseline 重新生成具有新 provenance 的制品。任何以旧制品为对象的 Owner
sudo 命令均违反本 Authority。

### CTR-HD-011 — Hotfix 继任与退役

本 hotfix 是 pinned ancestor hotfix，MUST NOT 成为无说明的永久生产分叉：

```text
HOTFIX_SUCCESSOR_CONDITION =
  未来一个经独立审计的 coherent Broker release 正式包含 workflow_transition
  及届时所有应发布能力
HOTFIX_INVALIDATION_CONDITIONS = 与 CTR-HD-007 第 3 条一致
HOTFIX_RETIREMENT_AUTHORITY_REQUIRED = YES
```

后续 coherent release MUST NOT 直接覆盖本 hotfix；仍需 fresh preimage、制品、
审计、Owner 执行与部署审计（即同样走 CTR-HD-006 链）。本 Authority 不设时间
期限（条件驱动，DEC-HD-007）；**无 TBD、无"尽快替换"**。

### CTR-HD-012 — Authoring 边界与文件不可修改性

本轮（授权 执行）MUST docs-only：新增本文件一个 docs 文件 + Draft PR + PR #125
留痕 comment；零产品代码、零制品、零 Owner command、零 secret 值、零
credential-file digest、零 Grant 变更、零 canary 命令、零生产 apply 声称、零
open Owner decision、零治理 schema 未定义的 frontmatter 字段。后续制品轮 /
部署轮 MUST NOT 修改本文件（GOVERNING_SPEC_UNMODIFIED）；对本文件的任何变更
只能走独立评审的 AMEND/SUPERSEDE docs-only 事务。

## 10. Acceptance

> ACC-HD-002..012 为 accept 后各执行轮的验收映射（runtime/manual evidence 型，
> 原因：所验证的 Contract 本身约束未来制品/部署轮，在 authoring 轮无法产生其
> 证据；每一项都绑定到 CTR-HD-006 链中确定的轮次与角色）。

- `ACC-HD-001` — 本 Spec 自身（本轮）：docs-only authoring PR，只新增本文件；
  base = `6478356`（AUTHORITY_BASELINE_COMMIT）；governance verifier（vendored
  bytes == lock）、structure verifier（vs origin/main）、frontmatter schema 校验、
  hierarchy/reference 校验、Contract↔Acceptance 双向覆盖、`git diff --check`、
  docs-only scope、secret scan、current-main synthetic integration 全部 PASS。
  Contracts: `CTR-HD-012`。Method: 本轮验证 battery。Environment: clean worktree
  @ `6478356` + synthetic `2392a41`。Expected: 全 PASS、diff 恰 1 个 docs 文件。
  Failure: 任一 verifier 非 PASS 或 diff 含非 docs 路径。
- `ACC-HD-002` — Authority 形式合法：frontmatter 通过
  `.agents/schemas/spec-frontmatter.schema.json`；提案态字段 = proposed / none /
  none；无 schema 外必填语义字段。Contracts: `CTR-HD-001`。Method: schema 校验 +
  人工核对 §15 事务定义。Failure: 字段缺失/枚举外值/出现未定义字段语义。
- `ACC-HD-003` — 发布策略冻结：制品的 source stamp / manifest 逐字段等于
  CTR-HD-002 六值。Contracts: `CTR-HD-002`。Method: 制品审计轮核对。Environment:
  制品轮。Failure: 任一值不等或出现 allowlist 外路径。
- `ACC-HD-004` — 单元与回滚等面：deployment manifest 恰 1 文件；rollback bundle
  恰恢复该文件 + 精确重启动作。Contracts: `CTR-HD-003`。Method: 制品审计 +
  Owner plan 审计。Failure: 多文件、缺回滚或回滚面大于部署面。
- `ACC-HD-005` — 完整身份与 fresh preflight：制品记录两个完整 blob SHA；Owner
  执行轮 preflight 输出生产文件 byte identity == preimage blob、health PASS、
  catalog 无 workflow_transition、manifest count = 14。Contracts:
  `CTR-HD-004`。Method: 只读 preflight + 双侧 hash。Environment: 生产执行轮。
  Failure: preimage 不匹配 / health FAIL / catalog 已含 workflow_transition /
  count ≠ 14（→ 均为 STOPPED）或 SHA 为短前缀。
- `ACC-HD-006` — 写闸门独立性：部署前只读输出 `AUTH_V1_CANARY_WRITE_ENABLED =
  false`；部署后证明面全部只读、无真实 transition、grant census 只读复核不变。
  Contracts: `CTR-HD-005`。Method: 部署轮 preflight + 部署审计轮只读复核。
  Failure: 闸门非 false、出现任何写/canary/Grant 动作、或 grant census 变化。
- `ACC-HD-007` — 链序完整：四角色独立（构建/制品审计/Owner 执行/部署审计互不
  同源），canary 与 Grant 未被并入部署事务。Contracts: `CTR-HD-006`、`CTR-HD-008`。
  Method: 各轮 TASK_RECIPIENT 独立性核对。Failure: 角色复用或链
  序跳跃。
- `ACC-HD-008` — 漂移政策执行：任一执行轮发现 main 前进时，按 CTR-HD-007 判定
  并留痕（无关 → 继续；相关 → STOPPED 回审计）。Contracts: `CTR-HD-007`。
  Method: 执行轮 fetch + 类别判定记录。Failure: 未判定即继续，或自行改绑
  source commit。
- `ACC-HD-009` — 安全部署机械面：CTR-HD-009 清单逐项出现在制品与 Owner plan
  中并被部署审计逐项核对（含禁止形式缺失）。Contracts: `CTR-HD-009`。Method:
  部署审计轮 checklist。Failure: 任一必备项缺失或出现禁止形式。
- `ACC-HD-010` — 旧制品未被复用：执行轮不引用两枚旧 tar 的任何字节。
  Contracts: `CTR-HD-010`。Method: 制品 provenance 审计。Failure: 旧制品出现
  在供应链中。
- `ACC-HD-011` — 退役条件留痕：任何后续 coherent release 计划必须显式引用
  CTR-HD-011 并走完整链。Contracts: `CTR-HD-011`。Method: 后续 release
  authority 审计。Failure: 直接覆盖 hotfix 或无 retirement 记录。
- `ACC-HD-012` — 本文件未被执行轮修改：制品/部署轮 diff 不含本文件。
  Contracts: `CTR-HD-012`。Method: 各轮 `git diff --name-only` 核对。Failure:
  本文件出现在任何执行轮 diff 中。

## 11. Alternatives and disposition

- `ALT-HD-001` — CURRENT_MAIN_COHERENT_RELEASE（3 文件 joint closure）：
  **否决**（DEC-HD-001）——需 joint feature set（transition + Pagination V2）、
  两个 spec 的 production_apply authority、3 文件回滚面；与"只发 transition"的
  Owner 意图不符。将来联合发布走新 Authority（CTR-HD-002）。
- `ALT-HD-002` — 复用/修补旧制品：**否决**（DEC-HD-004 / CTR-HD-010）——审计链
  已断。
- `ALT-HD-003` — 在 Governing Capability Spec 上做 amendment 直接授予部署权：
  **否决**（DEC-HD-002）——部署授权是独立义务（NEW），且实现/制品轮不可修改
  其自身 governing spec；独立 Authority 更符合基线审计裁决与角色分离。
- `ALT-HD-004` — 发明新的 frontmatter Authority 字段（如新的
  `deployment_authority:` 枚举）：**否决**（DEC-HD-002）——治理 schema 未定义；
  既有 `production_apply_authority` + lifecycle 事务已足够表达。
- `ALT-HD-005` — 时间期限式 hotfix 退役（如"30 天内替换"）：**否决**
  （DEC-HD-007）——可计算期限在此场景无自然依据，条件驱动更诚实且不留 TBD。

## 12. Migration, compatibility, and rollback

Not applicable（对本 Spec 自身：docs-only 新增，无数据/存储/部署迁移）。部署轮
的 migration/compatibility/rollback 由 CTR-HD-003（等面回滚）、CTR-HD-004
（preimage 恢复）、CTR-HD-009（失败恢复 + 重启）承载，验收见 ACC-HD-004/005/009。

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE（接受/拒绝本 Authority 本身即是 Owner 的单一决策点；
  无遗留待决项嵌入正文）
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

非规范性后续（不改变 Decision/Contract 含义）：canary 授权轮的具体 identity 选择
（CTR-HD-006 链独立事务）；Pagination V2 联合发布 Authority（如 Owner 需要时另建）。

## 14. Authoring result（2026-08-31，授权 执行）

```text
SPEC_GOVERNANCE_MODE        = AUTHOR
SPEC_ID                     = AGENT_CORE_WORKFLOW_TRANSITION_PINNED_HOTFIX_DEPLOYMENT_V1
SPEC_KIND                   = implementation
STATUS                      = proposed
AUTHORITY_LEVEL             = governing_spec
IMPLEMENTATION_AUTHORITY    = none
PRODUCTION_APPLY_AUTHORITY  = none
PRIMARY_PARENT_AUTHORITY    = AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1
EXTERNAL_AUTHORITIES        = NONE
OPEN_OWNER_DECISIONS        = NONE
NORMATIVE_TBD               = NONE
PARTIAL_SUPERSESSION        = NONE
CONTRACT_COUNT              = 12
CONTRACTS_WITH_ACCEPTANCE   = 12
AUTHORING_READY_FOR_REVIEW  = YES
AUTHORITY_FORM              = NEW governing Spec（spec_kind=implementation；
                              production_apply_authority 字段 + §15 lifecycle flip
                              事务；零新造语法）
FRONTMATTER_VALID           = YES（对 vendored spec-frontmatter v0 schema 校验）
```

本轮边界：独立 clean worktree @ `6478356`（Base 固定，不随 `2392a41` 前进重定向）；
主 checkout 既有 WIP 原样未动；零生产访问（preimage 身份由可信 git + 既有生产
evidence 解析，OBS-HD-002/004）；不构建制品；不进入任何旧制品 worktree；Draft PR
不合并。

## 15. Authority activation（acceptance gate transaction 方案）

单一受控激活路径（与 Governing Capability Spec §17 AMEND-3 / §18 同构）：

1. **本轮（authoring）**：docs-only Draft PR 记录本提案；lifecycle 字段零授权
   （proposed / none / none）；不实现、不构建、不 merge。
2. **审计 gate**：独立「授权 审计」轮（与 authoring Agent 不同源的 Governance /
   Deployment Reviewer）对 reviewed head 给出 PASS verdict（binding：reviewed
   head pin、六值冻结确认、blob 身份确认、CTR/ACC 双向覆盖、frontmatter schema）。
3. **acceptance 事务**：审计 PASS 后，Owner（mayf3 或 PR 内显式授权 maintainer）
   以 ONE commit / ONE file 的 lifecycle-only 事务翻转 `status → accepted`、
   `implementation_authority → contracts`、`production_apply_authority →
   contracts`，并将 acceptance record（reviewed head / verdict / 时间 / SEMANTIC_
   DELTA_AFTER_REVIEW = NONE）写入本节；reviewed semantics 逐字节保留。
4. **激活后第一动作**：新的 `制品 执行` 轮（CTR-HD-006 链第 2 环），从冻结
   baseline 重建新 provenance 制品；仍需制品审计 + Owner 单次精确命令才可部署。
5. **失败语义**：审计 REVISE / Owner 拒绝 → 本提案回到 proposed 修订或按
   SPEC_GOVERNANCE_V0 §8.4 记录 rejected disposition；任何状态下本轮都不产生
   生产变化。

### Acceptance record（2026-08-31 lifecycle-only acceptance）

```text
REVIEWED_BASE_COMMIT         = 647835676e7acb904dae48e9b543f4722dcc3ccb
REVIEWED_SPEC_COMMIT         = cf5606163d75f5c1a0bf7504f45e47d56c2a17db
REVIEWER_ID                  = 独立 review 5067223455
REVIEW_RESULT                = ACCEPT
BLOCKERS                     = NONE
FINAL_ACCEPTED_HEAD           = SEE_THIS_FINALIZE_COMMIT_AND_PR_DESCRIPTION
ACCEPTANCE_ACTOR             = mayf3
ACCEPTED_AT                  = 2026-08-31T13:58:22Z
SEMANTIC_DELTA_AFTER_REVIEW  = NONE

NEXT_TASK                    = 接受 审计
READY_TO_MERGE               = NO
ARTIFACT_BUILD_ALLOWED       = NO
PRODUCTION_APPLY_ALLOWED     = NO
```

`FINAL_ACCEPTED_HEAD` 在本 lifecycle commit 产生后由该 Git object identity 与 PR
描述绑定完整 SHA；commit 不能在自身内容中预填或伪造自身 SHA。final-head 独立复核
通过前，禁止 merge、制品构建与生产 apply。
