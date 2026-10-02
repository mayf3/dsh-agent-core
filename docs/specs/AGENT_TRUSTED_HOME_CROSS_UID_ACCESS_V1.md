---
spec_id: AGENT_TRUSTED_HOME_CROSS_UID_ACCESS_V1
status: proposed
date: 2026-08-24
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
scope:
  - production DSH Homes root (/Users/authsvc/.agent-core/homes) 与 default Workspaces root (/Users/authsvc/.agent-core/workspaces) 的跨 UID 权限模型（MODEL A）
  - 两 root 的一次性属主/模式/继承式 ACL 转换及其不可变 invariants
  - authsvc control plane 懒建 per-Agent Home 与 uid502 child 在 ACL 模型下的能力边界
  - Credential 在跨 UID 模型下的 confidentiality 边界
  - canary-first rollout（agt_build-in-public-agent）与 rollback 边界
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
owner_intent_provenance: direct Owner instruction, task 目录 执行 (DOCS_ONLY_SPEC_AUTHORING), 2026-08-24; 第二轮调查 owner-side adjudication
---

# Agent Trusted Home Cross-UID Access V1

> **PROPOSED / DOCS-ONLY / NO IMPLEMENTATION OR PRODUCTION AUTHORITY.**
>
> 本 Spec 冻结 Agent Core production DSH Homes / default Workspaces 两 root 的跨 UID
> 权限模型（SELECTED_PERMISSION_MODEL = MODEL_A）。本 round 仅 authoring：不修改
> production、不改任何 owner/group/mode/ACL、不改代码与脚本、不写 mapping / Binding、
> 不 reload Runtime。`status = proposed`、`implementation_authority = none`、
> `production_apply_authority = none`；任何 apply 需本 Spec accepted + 独立
> runbook/审计 + 显式 production approval。

## 0. Lifecycle and owner ordering

```text
TASK_NAME  = 目录 执行（DOCS_ONLY_SPEC_AUTHORING round）
STATUS     = proposed
BASE       = 0a6e060913e12693142fb0759f35f239b2ef429a (origin/main, verified equal)
PREFLIGHT_MODE = NEW
AUTHORITY_FORM  = NEW independent governing spec（SPEC_GOVERNANCE_V0 §9.2 third legal form:
                  truly non-conflicting new authority refining the same parent）
PARTIAL_SUPERSESSION = NONE（supersedes = []；不触碰任何 accepted spec 的 normative text）

SELECTED_PERMISSION_MODEL = MODEL_A
AFFECTED_EXACT_86_COUNT   = 86
CANARY_ONLY_FIRST         = YES

IMPLEMENTATION_AUTHORIZED_NOW = NO
PRODUCTION_APPLY_AUTHORIZED_NOW = NO
PRODUCTION_CHANGE = NONE
NEXT_TASK = 目录 审计
```

Owner ruling provenance：direct Owner instruction（第二轮调查 adjudication + 本轮
task dispatch，2026-08-24）。第二轮调查（owner-side）已裁定：MODEL A 偏离既有
operative provisioning flow（ROOT provisioner → chown-to-502 → per-Agent repair），
不得伪装为普通实现细节或 prose override；必须以 SPEC_GOVERNANCE_V0 合法形式承载。
本 Spec 即该承载（DEC-HA-002）。

## 1. Goal

把 production DSH Homes root 与 default Workspaces root 的跨 UID 权限模型从
「root 目录由 child uid 拥有 + 每 Agent 经 ROOT provisioner 重建/修复」转换为
MODEL A：两 root 由 trusted control-plane 身份（authsvc）拥有 + 继承式 ACL 授予
child uid（502）与 control plane（authsvc）各自能力，使 authsvc control plane 能
自行懒建 per-Agent Home，child 能以自身 uid 完成全部 DSH 生命周期操作，同时
Credential confidentiality 不降级。并以 Build in Public canary-first 方式冻结
rollout 与 rollback 边界。

## 2. Scope and non-goals

In scope：

- 仅两个 root 目录本身：`HOMES_ROOT = /Users/authsvc/.agent-core/homes` 与
  `WORKSPACES_ROOT = /Users/authsvc/.agent-core/workspaces`（一次性属主/模式/ACL 转换）；
- MODEL A 之下新建树（Home / settings / Credential / profile / sessions）的权限
  invariants 与继承语义；
- authsvc control plane 与 uid502 child 的能力/信任边界；
- Credential confidentiality 边界；
- exact 86 Agent fleet 的 canary-first rollout（第一 subject
  `agt_build-in-public-agent`）与 rollback。

Out of scope（冻结不因本 Spec 变化）：

- 任何 Workspace **内容**（86 个 historical OpenClaw Workspace 原地复用与 zero-touch
  由 `AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3` CTR-OW-004 独占管辖；
  primary-workspaces mapping / Binding 恢复 / Runtime reload 事务由
  `AGENT_TRUSTED_FLEET_CUTOVER_V1` §8 独占管辖，本 Spec 仅复用不修改）；
- Broker credential store（`AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` Part G/H
  语义不变）；
- `agt_stock_agent` 既有 0700 坏 Home 的修复（OUT_OF_SCOPE_FOR_FIRST_CANARY，CTR-HA-008）；
- 其余 85 个 Agent Home 的创建（audit PASS 前禁止，CTR-HA-009）；
- Scheduler jobs、Auth 对象（Principal/Client/Credential/Receipt/Grant）、
  agents.json、historical OpenClaw Runtime 重启。

## 3. Authority and dependencies

```text
governed_by   = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0（治理 parent）
supersedes    = []（无 accepted spec 被取代；无 partial supersession）
superseded_by = null
```

与三项既有 authority 的精确关系（DEC-HA-002）：

```text
AGENT_TRUSTED_FLEET_CUTOVER_V1 (accepted, PR #47, spec blob 2078a11c…)
  RELATION = DEPENDS_ON / NON_CONFLICTING
  - 其 normative text 不含两 root 属主/权限模型：§2 明确将
    TRUSTED_HOME_PROFILE_SETTINGS_REGENERATION_AS_CUTOVER_STEPS REMOVED，
    §8 canary 十步事务中无 home provisioning 步骤（OBS-HA-004）。
  - MODEL A canary rollout step 2 原样复用其 §8 mapping transaction，不修改。

AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3 (accepted)
  RELATION = BOUNDARY_COMPATIBLE / NON_CONFLICTING
  - 其 CTR-OW-004 zero-touch 作用于 Workspace 内容与元数据；MODEL A 仅变更两个
    root 目录自身的 owner/group/mode/ACL，永不触碰任何 workspace 子树内容
    （CTR-HA-010 显式 carve-out）。

现有 Home provisioning contracts（operative，非 accepted spec text）
  = scripts/production-agent-provision.mjs + packages/agent-provisioning
    provisionAgentHome + 2026-08-23 目录 执行 canary-home round 冻结的
    per-Agent 修复矩阵（home 0755 502:20 / settings、Credential 0600 /
    per-file ACL user:authsvc allow read / chown -R -h 502:20）；
    AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 附录 A.3 第 2 条为该 seam 的
    事实描述（OBS-HA-002 / OBS-HA-003）。
  RELATION = DISPLACED_BY_THIS_SPEC（对两 root 下「新建 Home 的权限契约」这一 subject）
  - 依第二轮调查 owner 裁定：MODEL A 偏离该 operative flow（ROOT provisioner →
    chown-to-502 → per-Agent repair），不得伪装为普通实现细节或 prose override。
  - 本 Spec 以 DEC-HA-001/002 显式接管该 subject；被取代的 operative flow 记入
    ALT-HA-001（disposition = displaced）。既有已建 Home 的现状兼容性由
    CTR-HA-008 保护（不递归改写）。该 seam 代码与模块本身不在本 round 修改；
    其后续实现变更须以本 Spec 为 PRIMARY_GOVERNING_SPEC 另行走实现 round。

AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 (accepted)
  RELATION = SCOPE_DISJOINT
  - 其 authority 对象（credential provisioning seams、trusted store Part G、
    secret handoff Part H）不被本 Spec 触碰；A.3 事实描述不因本 Spec 改写。
```

PARTIAL_SUPERSESSION = NONE：本 Spec 不在 prose 中模拟对任何 accepted authority
局部条文的取代；被宣告的 subject 接管仅发生在「无既有 accepted spec 拥有的主题」
（CLM-HA-001）。

## 4. Current State

- `STATE-HA-001` — Frozen identity map：`RUNTIME_UID = 505 / authsvc`；
  `CHILD_UID = 502 / yanfenma`；`CHILD_GID = 20 / staff`。Basis: owner task
  dispatch 2026-08-24；`AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1`（trusted
  505/502 模型，accepted）。
- `STATE-HA-002` — 两 root 现状：`HOMES_ROOT` 与 `WORKSPACES_ROOT` 均为
  `yanfenma:staff 0755`，**无继承式 ACL**（no inherited ACL）。observed 2026-08-23
  （目录 执行 round gate，read-only）。Basis: `OBS-HA-001`。
- `STATE-HA-003` — `AFFECTED_EXACT_86_COUNT = 86`：受影响 fleet 即
  `AGENT_TRUSTED_FLEET_CUTOVER_V1` §4 exact roster
  （`EXACT_ROSTER_SHA256 = f046d18f76da838ba94775af7c960d0ee548f2e392c22a6c7b0e3add36cb8e5f`）。
  Basis: `OBS-HA-006`。
- `STATE-HA-004` — `KNOWN_GOOD_CURRENT_AUTHSVC_SERVICE_SPAWN = NONE`：截至本 Spec
  authoring，不存在 authsvc 侧（懒建 Home + ACL 模型下）known-good 的真实 service
  spawn 证据；pre-cutover 的 agt_cto-agent sessions **不得**冒充该证据。Basis:
  `OBS-HA-008`。
- `STATE-HA-005` — Operative home provisioning contract = ROOT provisioner →
  chown-to-502 → per-Agent repair（seam 代码 + 2026-08-23 目录 执行 canary-home
  round 执行事实）。Basis: `OBS-HA-002`, `OBS-HA-003`。
- `STATE-HA-006` — Production runtime 现状 = 单一 authsvc 实例
  （`SOLE_TRUSTED_RUNTIME_AUTHORITY = authsvc`；historical OpenClaw Runtime 关闭）。
  Basis: `OBS-HA-009`；`AGENT_TRUSTED_FLEET_CUTOVER_V1` §6/§11。

## 5. Observations

### OBS-HA-001 — 两 root 属主/模式/ACL 现状（read-only）

- Subject: production `/Users/authsvc/.agent-core/homes` 与
  `/Users/authsvc/.agent-core/workspaces`
- Source revision: n/a（filesystem state）
- Environment: production host（trusted 505/502 布局，trusted install
  `/usr/local/libexec/agent-core`）
- Observed at: 2026-08-23（目录 执行 round gate1 read-only 核验）
- Method: `stat`/`ls -lae`（metadata only）
- Result: `HOMES_ROOT owner=yanfenma(502) group=staff(20) mode=0755`；workspaces
  root 同构（yanfenma:staff 0755）；两 root 均无继承式 ACL 条目
- Provenance: 目录 执行 round gate 日志（operator session 2026-08-23，
  `/private/tmp/canary-home-task/gate1.log`）+ owner task dispatch 2026-08-24 冻结值

### OBS-HA-002 — Operative provisioning seam 契约（代码 + 执行事实）

- Subject: `scripts/production-agent-provision.mjs`、
  `packages/agent-provisioning/src/index.js`、目录 执行 canary-home round
- Source revision: `mayf3/dsh-agent-core@0a6e060`（文件在场且与 trusted install
  `/usr/local/libexec/agent-core/app` 逐字节一致）
- Environment: repo + production
- Observed at: 2026-08-23 / 2026-08-24
- Method: 源码阅读（ROOT-only 门禁；`chown -R -h 502:20 home+workspace`；
  `provisionAgentHome` mkdir home 0700 → 修复为 0755；settings/Credential copyOnce；
  farm links）；目录 执行 round 执行 + 复核（canary home 0755 502:20、
  settings/Credential 0600、per-file ACL `user:authsvc allow read`、chown 后 ACL
  保留、idempotent rerun NOOP）
- Result: operative flow = ROOT provisioner → chown-to-502 → per-Agent repair，
  与本 Spec MODEL A 偏离（owner 第二轮调查裁定）
- Provenance: repo files at 0a6e060；目录 执行 round 报告与
  `/private/tmp/canary-home-task/*.log`

### OBS-HA-003 — Credential provisioning spec 对该 seam 的事实描述

- Subject: `docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1.md`（accepted）
- Source revision: `mayf3/dsh-agent-core@0a6e060`
- Observed at: 2026-08-24
- Method: 文本定位（附录 A.3 第 2 条：「root 侧 `scripts/production-agent-provision.mjs`
  也只 chown home + workspace，不写 credential store」）
- Result: 该描述为 evidence/appendix 事实，不是两 root 权限模型的 accepted
  normative contract；本 Spec 不改写该文本
- Provenance: file at 0a6e060

### OBS-HA-004 — Fleet cutover spec 的 home-provisioning 边界

- Subject: `docs/specs/AGENT_TRUSTED_FLEET_CUTOVER_V1.md`（accepted，PR #47，
  spec blob `2078a11c2467aeb0bdb5b9e2abe6f8ac033da089`）
- Source revision: `mayf3/dsh-agent-core@0a6e060`
- Observed at: 2026-08-24
- Method: 文本定位（§2 删除清单含
  `TRUSTED_HOME_PROFILE_SETTINGS_REGENERATION_AS_CUTOVER_STEPS = REMOVED`；
  §8 canary 十步事务逐条）
- Result: 其 normative text 不含两 root 属主/权限模型，canary 事务无 home
  provisioning 步骤 → 与 MODEL A 无 normative 冲突；其 §8 为 canary step 2 的
  复用对象
- Provenance: file at 0a6e060

### OBS-HA-005 — V3 workspace zero-touch / rollback 边界

- Subject: `docs/specs/AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3.md`
  （accepted）
- Source revision: `mayf3/dsh-agent-core@0a6e060`（acceptance revision f02691c 已合入）
- Observed at: 2026-08-24
- Method: 文本定位（CTR-OW-004：接管对 Workspace 零内容/零元数据变更；
  CTR-OW-010：rollback 仅控制面）
- Result: 两者均以 Workspace 内容与控制面为对象，不涉及两 root 目录自身的
  权限模型 → boundary-compatible
- Provenance: file at 0a6e060

### OBS-HA-006 — Exact 86 roster 冻结

- Subject: fleet roster
- Source revision: `AGENT_TRUSTED_FLEET_CUTOVER_V1` §4
- Observed at: 2026-08-24
- Method: 引用 accepted spec 冻结值（count=86、unique、含 canary）
- Result: `AFFECTED_EXACT_86_COUNT = 86`；canary =
  `agt_build-in-public-agent` 在列
- Provenance: file at 0a6e060

### OBS-HA-007 — Owner 第二轮调查裁定（MODEL A 选型与继承实证矩阵）

- Subject: 跨 UID 权限模型选型
- Environment: owner-side 第二轮调查（2026-08-24 dispatch）
- Observed at: 2026-08-24（task dispatch 冻结转述）
- Method: owner adjudication（本 round 不重做实验，DOCS_ONLY）
- Result:
  - `SELECTED_PERMISSION_MODEL = MODEL_A`（两 root 一次性 authsvc:authsvc 0755 +
    继承式 ACL；权利集见 CTR-HA-001）；
  - 继承已实证机制：`mkdir`、`umask 077`、Node `copyFileSync`、`tmp+rename`、
    `cp -p`、深层递归创建 —— 均继承 root ACL；
  - 外部 `mv` 入树**不会**自动继承 → 必须禁止或 fail-loud（CTR-HA-006）；
  - child supplemental groups 被清除不影响按 uid 生效的 ACL（CTR-HA-007）；
  - MODEL A 偏离 operative ROOT provisioner flow，须以合法 authority 形式承载。
- Provenance: owner task dispatch 目录 执行（DOCS_ONLY_SPEC_AUTHORING）2026-08-24；
  第二轮调查原文为 owner-side artifact（见 §13 非规范 follow-up）

### OBS-HA-008 — 无 known-good authsvc service spawn 证据

- Subject: authsvc 侧懒建模型下的真实 service spawn
- Observed at: 2026-08-24（owner dispatch 冻结）
- Method: owner adjudication
- Result: `KNOWN_GOOD_CURRENT_AUTHSVC_SERVICE_SPAWN = NONE`；pre-cutover
  agt_cto-agent sessions 不构成 current authsvc service spawn 证据
- Provenance: owner task dispatch 2026-08-24

### OBS-HA-009 — Production runtime 单实例现状

- Subject: production runtime 进程
- Environment: production host
- Observed at: 2026-08-23
- Method: `launchctl print system/ai.agent-core.runtime` + `ps`（read-only）
- Result: state=running、pid=61979、user=authsvc、`--root /Users/authsvc/.agent-core`；
  historical OpenClaw 进程 = 0
- Provenance: 目录 执行 round gate 日志（`/private/tmp/canary-home-task/gate1.log`）

## 6. Claims and assumptions

### CLM-HA-001 — 无既有 accepted spec 拥有两 root 跨 UID 权限模型主题

- Support state: SUPPORTED
- Supported by evidence: `EVD-HA-001`
- Contradicted by evidence: none known
- Uncertainty: 仅覆盖 `mayf3/dsh-agent-core@0a6e060` 的 docs/specs 全集

### CLM-HA-002 — MODEL A 能力矩阵在 macOS 继承式 ACL 语义下成立

- Support state: SUPPORTED
- Supported by evidence: `EVD-HA-002`
- Contradicted by evidence: none known
- Uncertainty: 依赖 owner 第二轮调查的实证矩阵（mkdir/umask077/copyFileSync/
  tmp+rename/cp -p/深层递归）；`mv` 不继承已按禁止处理；canary 环境需整体复证
  （ACC-HA-005/006）

### CLM-HA-003 — MODEL A 保持 Credential confidentiality 不降级

- Support state: INFERRED
- Supported by evidence: `EVD-HA-002`（继承 ACL 仅授予 uid502 与 authsvc）+
  CTR-HA-002/003 边界
- Contradicted by evidence: none known
- Uncertainty: 需 canary 真实环境按 ACC-HA-002 证实（第三方 uid 拒绝、无
  group/world reader）；证实前为 bounded risk，由 ACC 失败条件守护

### CLM-HA-004 — canary step 2 可原样复用 PR #47 §8 mapping transaction

- Support state: SUPPORTED
- Supported by evidence: `EVD-HA-003`
- Contradicted by evidence: none known
- Uncertainty: 复用时点的 baseline（例如 canary Binding row 现状）由该事务自身
  的 STATE_BASELINE gate 约束，不由本 Spec 重新定义

## 7. Evidence relations

### EVD-HA-001 — Accepted-spec 全集检索支持「无既有 authority 拥有该主题」

- Source observations: `OBS-HA-003`, `OBS-HA-004`, `OBS-HA-005`
- Target: `CLM-HA-001`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/dsh-agent-core@0a6e060`，docs/specs 全集（含
  FLEET_CUTOVER / V3 / CREDENTIAL_PROVISIONING / 其余 accepted specs 的
  chown/ACL/homes 关键词检索），2026-08-24
- Strength/sufficiency: strong for repo@0a6e060
- Limitations: 不约束未来新增 spec
- Provenance: 本 round authoring 检索记录（工作区 worktree
  home-cross-uid-access-v1-spec）

### EVD-HA-002 — Owner 实证矩阵支持 MODEL A 能力与继承语义

- Source observations: `OBS-HA-007`, `OBS-HA-001`
- Target: `CLM-HA-002`, `CLM-HA-003`
- Relation: SUPPORTS
- Bound coordinates: owner 第二轮调查（2026-08-24 dispatch 转述）；production
  host 布局
- Strength/sufficiency: 对已列机制（mkdir/umask077/copyFileSync/tmp+rename/
  cp -p/深层递归 + mv 例外）strong
- Limitations: 非 repo 内持久 artifact；canary rollout 必须按 ACC-HA-005/006
  在真实环境复证
- Provenance: owner task dispatch 2026-08-24

### EVD-HA-003 — Fleet cutover spec 文本支持 mapping transaction 复用

- Source observations: `OBS-HA-004`
- Target: `CLM-HA-004`
- Relation: SUPPORTS
- Bound coordinates: spec blob `2078a11c…` @ 0a6e060
- Strength/sufficiency: strong（accepted text 直接可复用）
- Limitations: 无
- Provenance: file at 0a6e060

### EVD-HA-004 — 执行事实支持 operative flow 现状

- Source observations: `OBS-HA-002`
- Target: `STATE-HA-005`
- Relation: SUPPORTS
- Bound coordinates: repo@0a6e060 + production 2026-08-23 执行
- Strength/sufficiency: strong
- Limitations: 描述现状，不构成对旧 flow 的 normative authority
- Provenance: 目录 执行 round 记录

## 8. Decisions

### DEC-HA-001 — 选型 MODEL A（owner ruling）

- Decision owner: mayf3（owner ruling，经第二轮调查 adjudication）
- Decision: `SELECTED_PERMISSION_MODEL = MODEL_A`——两 root 一次性改为
  `owner=authsvc / group=authsvc / mode=0755` 并分别添加继承式 ACL（yanfenma/502
  全能力集 + authsvc 只读集，权利集冻结于 CTR-HA-001）；此后 authsvc control
  plane 在两 root 下自行 mkdir/懒建 per-Agent Home，child uid502 经继承 ACL 获得
  Home 内操作能力，不再依赖 ROOT provisioner chown-to-502。
- Rejected alternative: ALT-HA-001（延续 per-Agent ROOT provisioner + chown 修复）。
- Reason: 消除每 Agent 一次的 root actor 与 per-file ACL 修复；使 control plane
  具备自持懒建能力；confidentiality 经 POSIX 0600 + uid-keyed ACL 保持。
- Owner input remaining: NONE。

### DEC-HA-002 — Authority 形式 = NEW 独立 governing spec（显式接管 subject）

- Decision owner: mayf3
- Decision: 以本 Spec（NEW independent authority）冻结两 root 跨 UID 权限模型。
  对 operative home provisioning contracts 的偏离**显式宣告**：本 Spec accepted 后，
  在「两 root 下新建 Home 的权限契约」subject 上取代
  ROOT-provisioner→chown-to-502→per-Agent-repair（ALT-HA-001 disposition =
  displaced）；不修改任何 accepted spec 的 normative text（`supersedes = []`），
  不做 prose partial supersession；对 FLEET_CUTOVER = depends_on（复用 §8），
  对 V3 = boundary-compatible carve-out（CTR-HA-010），
  对 CREDENTIAL_PROVISIONING_V1 = scope-disjoint。
- Rejected alternative: whole-authority replacement（无既有 accepted spec 拥有该
  主题，无整体可取代对象）；formal amendment（MODEL A 非任何既有 accepted
  Decision 的 additive elaboration，AMEND 不合法）；把偏离藏进实现细节（被
  第二轮调查裁定禁止）。
- Reason: SPEC_GOVERNANCE_V0 §9.2 第三种合法形式；如实承载 owner 裁定。
- Owner input remaining: NONE。

### DEC-HA-003 — Canary-first rollout（11 步冻结，audit gate）

- Decision owner: mayf3
- Decision: 第一 subject 唯一固定 `agt_build-in-public-agent`；rollout 流程冻结为
  CTR-HA-009 的 11 步；不得同时创建 86 个 Home；其余 85 Home 保持 ABSENT 直至
  独立审计 PASS。
- Rejected alternative: 一次性 fleet 转换 / 并行多 canary（禁止）。
- Reason: 与 fleet cutover 的 canary-first 纪律一致；fail 影响半径最小。
- Owner input remaining: NONE。

### DEC-HA-004 — Legacy state 不触碰

- Decision owner: mayf3
- Decision: `agt_stock_agent` 既有 0700 坏 Home = OUT_OF_SCOPE_FOR_FIRST_CANARY，
  必须单独 detect/refuse，不得在 canary 轮顺手修复；现有其他 Home 不得被递归
  chown 或改 ACL（CTR-HA-008）。
- Rejected alternative: canary 轮一并修复 legacy（拒绝）。
- Reason: 变更半径控制；legacy 修复需独立 authority。
- Owner input remaining: NONE。

### DEC-HA-005 — Rollback 边界（control-plane + canary-only + 两 root 还原）

- Decision owner: mayf3
- Decision: 冻结 CTR-HA-011 的 rollback 清单；永不触碰 Workspace 文件；永不
  重启 historical OpenClaw Runtime。
- Rejected alternative: 保留半应用状态 / 触碰 workspace 回滚（禁止）。
- Reason: 最小可逆面。
- Owner input remaining: NONE。

## 9. Contracts

### CTR-HA-001 — 两 root 一次性 MODEL A 转换

对 `HOMES_ROOT` 与 `WORKSPACES_ROOT`（各仅目录本身）执行一次性转换：

```text
owner = authsvc
group = authsvc
mode  = 0755
```

并分别添加继承式 ACL，权利集逐字冻结：

```text
acl:yanfenma/uid502 allow:
  list, add_file, search, delete, add_subdirectory, delete_child,
  read, write, append, write_attr, write_extattr,
  file_inherit, directory_inherit

acl:authsvc allow:
  read, list, search,
  file_inherit, directory_inherit
```

执行者 MUST 以 root 一次性完成两 root 转换；MUST NOT 对两 root 之外的任何路径
应用本转换；exact rerun MUST 为 NOOP（已到位状态不重复添加 ACL 条目）。

### CTR-HA-002 — 新建树权限 invariants

MODEL A 之下：

```text
新建 Home 默认 POSIX mode = 0700 允许（"仍可保持 0700"）
settings.yaml / .credentials.yaml = 0600
group / other 权限位 = 0
0750 / 0770 = FORBIDDEN
0777 = FORBIDDEN
Credential 不得 group/world-readable
```

任何新建子树 MUST 满足上述 invariants；violation = FAIL_LOUD，不得静默修复。

### CTR-HA-003 — Credential confidentiality 边界

```text
POSIX 0600
可访问者 = 仅 uid502（yanfenma）+ authsvc（经继承式 ACL）
无 group/world reader
Credential 不得复制到任何 Workspace
```

raw credential 内容 MUST NOT 出现在 log / stdout / stderr / report（对齐
CREDENTIAL_PROVISIONING_V1 Part H 精神，适用于本模型下的 per-agent DSH
credential 文件）。

### CTR-HA-004 — authsvc control plane 能力

authsvc control plane MUST 能够（且仅经两 root 的 MODEL A 权限，不需 root）：

```text
在 HOMES_ROOT 与 WORKSPACES_ROOT 下 mkdir
创建 settings / Credential / profile
读取 Credential
审计 / 备份（读遍历两 root 内树）
```

任一能力失败 = FAIL_LOUD（不得降级为静默跳过）。

### CTR-HA-005 — uid502 child 能力

uid502 child MUST 能够：

```text
traverse Home
读取 settings / Credential
每次 boot 重写 profiles/<profile>/cordis.yml
创建和追加 sessions
执行 credentials-local 原子轮换
```

### CTR-HA-006 — 继承面与 mv 禁止

继承式 ACL MUST 覆盖既有实证机制：

```text
mkdir
umask 077
Node copyFileSync
tmp + rename
cp -p
深层递归创建
```

（以上均已实证继承，见 OBS-HA-007。）

外部 `mv` 入树**不会**自动继承 ACL：任何把树外文件 `mv` 进入两 root 的操作
MUST 被禁止或 fail-loud（部署/运维 runbook MUST 包含 detect/refuse 规则）。

### CTR-HA-007 — supplemental groups 独立性

ACL 按 uid 生效：child spawn 时 supplemental groups 被清除 MUST NOT 影响本模型
任何授权路径（uid502 与 authsvc 的 ACL 权益不依赖 group membership）。

### CTR-HA-008 — Legacy 非干扰

```text
agt_stock_agent 既有 0700 坏 Home = OUT_OF_SCOPE_FOR_FIRST_CANARY
  → 必须 detect/refuse（作为独立后续 subject），不得在 canary 轮修复
现有其他 Home（含 agt_cto-agent 参考 Home、既有 hash-id Homes、backup 目录）
  → 不得递归 chown
  → 不得改 ACL
```

rollout 前后 MUST 以 metadata diff 证明现有 Home 零变化。

### CTR-HA-009 — Canary-first rollout 事务（11 步冻结）

第一 subject 唯一 = `agt_build-in-public-agent`。顺序不可弱化：

```text
1  仅修改 homes/ 与 workspaces/ 两 root（CTR-HA-001 一次性转换）
2  重新执行既有 Build in Public mapping transaction
   （= AGENT_TRUSTED_FLEET_CUTOVER_V1 §8 十步事务，原样复用，不修改）
3  runtime 首次懒建 canary Home
   （precondition：canary Home ABSENT——若存在 2026-08-23 目录 执行 round 的
     旧模型 canary Home，必须先按该 round 自身 rollback 语义删除（canary-only），
     使懒建路径为真实首次）
4  child boot PASS
5  RPC initialize PASS
6  Credential read PASS
7  session create/write PASS
8  shutdown/restart PASS
9  exact rerun NOOP
10 其余 85 Home仍 ABSENT
11 独立审计 PASS 后才扩 85
```

任一步 FAIL → STOP；MUST NOT 同时创建 86 个 Home；MUST NOT 并行第二 canary。
steps 4–8 构成 `KNOWN_GOOD_CURRENT_AUTHSVC_SERVICE_SPAWN` 的首次合法证据集
（pre-cutover CTO sessions 不得充当，OBS-HA-008）。

### CTR-HA-010 — Workspace 非干扰（V3 carve-out）

```text
本 authority 的全部文件系统变更 = 仅两 root 目录自身（owner/group/mode/ACL）
任何 workspace 子树内容/元数据 = 零接触（V3 CTR-OW-004 语义保持）
historical OpenClaw Workspaces = 零接触
mapping / Binding / Runtime reload = 仅经 PR #47 §8 事务（step 2），本 Spec 不新增
```

### CTR-HA-011 — Rollback

任一步失败时 MUST 执行（且仅执行）：

```text
删除本轮新建的 canary Home（canary-only）
两 root 恢复 yanfenma:staff 0755
删除本轮新增 ACL（两 root 恢复 no ACL）
若 mapping 已执行 → 恢复 mapping ABSENT
恢复 Binding store exact bytes
单次 restart（runtime）
Workspace 文件零变化
historical OpenClaw Runtime 保持关闭
```

## 10. Acceptance

### ACC-HA-001 — 两 root 转换与 rerun NOOP

- Contracts: `CTR-HA-001`
- Method: root 执行一次性转换后 `stat`/`ls -lae` 双 root 核验 owner/group/mode
  与两条 ACL 权利集逐项一致；exact rerun 证明 NOOP（不新增重复 ACL 条目）
- Environment: production host
- Required evidence: 转换前后双 root metadata 记录、rerun diff
- Expected result: `authsvc:authsvc 0755` + 恰好 yanfenma/authsvc 两条继承式
  ACL；rerun 零变化
- Failure condition: 任一权利项缺失/多余、出现第三 principal、rerun 产生重复条目

### ACC-HA-002 — 新建树 invariants 与 credential 读者矩阵

- Contracts: `CTR-HA-002`, `CTR-HA-003`
- Method: 在 MODEL A root 下新建树（含 settings/Credential），核验模式位；
  以 uid502 / authsvc / 第三方 uid 分别探测 credential 可读性；扫描任何
  Workspace 内无 Credential 副本
- Environment: production host（canary step 3 产物或等价探针树）
- Required evidence: 模式清单、三 uid 探测结果（authsvc/502 探测不得输出
  credential 值）、Workspace 扫描记录
- Expected result: 0600/0700 invariants 成立；仅 uid502 与 authsvc 可读；
  第三方 uid 拒绝；无 group/world reader；Workspace 零副本
- Failure condition: 任一 invariant 违反、第三方 uid 可读、发现 Workspace 副本

### ACC-HA-003 — authsvc control plane 能力

- Contracts: `CTR-HA-004`
- Method: 以 authsvc 身份（无 root）在两 root 下 mkdir、创建 settings/Credential/
  profile、读取 Credential、执行审计/备份读遍历
- Environment: production host
- Required evidence: 各操作退出码与 metadata 证据（无 credential 值输出）
- Expected result: 全部成功或 FAIL_LOUD
- Failure condition: 任一操作静默失败/降级

### ACC-HA-004 — child 全生命周期能力 + group 独立性

- Contracts: `CTR-HA-005`, `CTR-HA-007`
- Method: uid502 child 在 supplemental groups 清除的 spawn 环境下执行：traverse、
  读 settings/Credential、boot 重写 `profiles/<profile>/cordis.yml`、sessions
  create/append、credentials-local 原子轮换
- Environment: production host（canary steps 4–8）
- Required evidence: 各步 PASS 记录（boot/RPC initialize/credential read/
  session/shutdown-restart）
- Expected result: 全部 PASS 且授权不依赖 group membership
- Failure condition: 任一步因 group 清除而失败、cordis.yml 无法重写、轮换非原子

### ACC-HA-005 — 继承矩阵与 mv fail-loud

- Contracts: `CTR-HA-006`
- Method: 在 MODEL A root 下逐一执行 mkdir / umask077 / Node copyFileSync /
  tmp+rename / cp -p / 深层递归创建并核验继承 ACL 到位；尝试外部 mv 入树，
  核验 detect/refuse 生效
- Environment: production host（canary 前置探针或 canary 内建验证）
- Required evidence: 各机制产物 ACL 记录、mv 拒绝记录
- Expected result: 六机制全部继承；mv 被禁止或 fail-loud
- Failure condition: 任一机制产物缺继承 ACL、mv 静默入树

### ACC-HA-006 — Canary 事务 11 步

- Contracts: `CTR-HA-009`, `CTR-HA-010`
- Method: 按 CTR-HA-009 顺序执行并记录每步证据；step 2 复用 PR #47 §8 并保留
  其全部返回值；前后核验其余 85 Home ABSENT、现有 Home metadata 零变化
  （CTR-HA-008 一并证明）、workspace 内容零变化
- Environment: production host
- Required evidence: 11 步逐步记录（懒建、boot、RPC initialize、credential read、
  session、shutdown/restart、rerun NOOP、85 ABSENT、mapping 事务返回值）
- Expected result: 全部 PASS；`KNOWN_GOOD_CURRENT_AUTHSVC_SERVICE_SPAWN` 首次
  由 steps 4–8 建立
- Failure condition: 任一步 FAIL、85 出现任何新 Home、workspace/mapping/binding
  出现事务外变更

### ACC-HA-007 — Legacy 非干扰

- Contracts: `CTR-HA-008`
- Method: rollout 前后对 homes/ 下全部既有条目做 metadata（owner/group/mode/
  ACL/mtime）快照 diff
- Environment: production host
- Required evidence: 前后快照与 diff
- Expected result: 除两 root 与新建 canary Home 外零变化；`agt_stock_agent`
  0700 状态原样且被 detect/refuse 标记
- Failure condition: 任何既有 Home 被递归 chown/ACL 改写、stock_agent 被顺手修复

### ACC-HA-008 — Workspace 非干扰

- Contracts: `CTR-HA-010`
- Method: rollout 前后对 86 historical workspace 及默认 workspaces 子树做内容/
  metadata 不变性核验（对齐 V3 CTR-OW-004 证明形态）；确认 historical OpenClaw
  Runtime 全程关闭
- Environment: production host
- Required evidence: 前后 digest/清单、进程核验
- Expected result: 零变化、OpenClaw 保持关闭
- Failure condition: 任何 workspace 内容/元数据变化、OpenClaw 进程出现

### ACC-HA-009 — Rollback 可执行

- Contracts: `CTR-HA-011`
- Method: 演练或实际失败路径下按 CTR-HA-011 清单逐项执行并核验（含 Binding
  store byte-exact 恢复、单次 restart、两 root 还原 yanfenma:staff 0755 no ACL）
- Environment: production host
- Required evidence: 各项恢复前后状态记录
- Expected result: 清单全项达成、Workspace 零变化
- Failure condition: 任一项不可逆/未恢复、残留 ACL 或 canary Home、OpenClaw 启动

## 11. Alternatives and disposition

### ALT-HA-001 — 延续 ROOT provisioner → chown-to-502 → per-Agent repair

- Disposition: **displaced**（由本 Spec DEC-HA-001/002 显式接管 subject）。
- 内容：每新增 Agent 由 root actor 运行 provision seam、整树 chown 502:20、
  per-file 0600 + per-file ACL `user:authsvc allow read` 修复（2026-08-23
  目录 执行 round 执行过的模型）。
- 拒绝原因：每 Agent 一次 root actor；per-file ACL 维护；control plane 无法
  自持懒建。
- 现状兼容：已按该模型建立的 Home 不被改写（CTR-HA-008），直至各自独立后续
  subject 处理。

### ALT-HA-002 — same-uid（runtime 与 child 同 uid）模型

- Disposition: rejected。破坏 trusted 505/502 信任边界与 credential 分离
  （`AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` 冻结模型）。

### ALT-HA-003 — group 位模型（0750/0770 + 共享 group）

- Disposition: rejected。group 语义受 supplemental groups 清除影响、授权面
  过宽；已被冻结为 FORBIDDEN（CTR-HA-002）。

### ALT-HA-004 — world 可读（0777 / group/world-readable Credential）

- Disposition: rejected。直接违反 confidentiality 边界。

### ALT-HA-005 — 以 prose / 实现细节改写既有 authority（partial supersession）

- Disposition: rejected。SPEC_GOVERNANCE_V0 禁止；第二轮调查裁定 MODEL A 的
  偏离必须以合法 authority 形式承载（本 Spec 即其执行）。

## 12. Migration, compatibility, and rollback

Migration：

- 一次性两 root 转换（CTR-HA-001）+ canary-first（CTR-HA-009）；fleet 其余 85
  在独立审计 PASS 后逐 Agent 懒建扩展（每 Agent 复用 canary 语义；届时另行
  bounded rollout round）。
- 混合形态共存：既有旧模型 Home（owner 502:20 + per-file ACL）与 MODEL A 新建
  Home（owner authsvc + 继承 ACL）在过渡期并存；runtime MUST 同时兼容两者
  （既有 Home 行为不变，CTR-HA-008）。
- operative provisioning seam 的代码演进（如 provision 脚本对 MODEL A 的适配）
  属后续实现 round，以其时点本 Spec 状态为准（accepted 后方可实现）。

Compatibility：

- 与 FLEET_CUTOVER §8 事务：原样复用（step 2），无语义修改。
- 与 V3：两 root 之外零接触（CTR-HA-010）。
- 与 Broker credential store（Part G/H）：零交集。

Rollback：CTR-HA-011（冻结清单）；rollback 永不触碰 Workspace 文件、永不重启
historical OpenClaw Runtime。

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

非规范 follow-up（不改变 Decision/Contract 含义）：

- 第二轮调查原文为 owner-side artifact，建议后续 docs round 将其作为
  Investigation Record 持久化进 `docs/investigations/`（含 ACL 继承实证矩阵原始
  证据）；
- fleet 85 扩展 runbook（audit PASS 后）另行 authoring；
- acceptance 时按惯例同步 `docs/specs/README.md` 导航索引。

## 14. Review handoff

```text
SPEC_ID  = AGENT_TRUSTED_HOME_CROSS_UID_ACCESS_V1
STATUS   = proposed
BASE     = 0a6e060913e12693142fb0759f35f239b2ef429a (origin/main verified)

AUTHORITY_RELATION =
  NEW independent governing spec（SPEC_GOVERNANCE_V0 §9.2 third form）
  vs AGENT_TRUSTED_FLEET_CUTOVER_V1   = DEPENDS_ON / NON_CONFLICTING（复用 §8）
  vs AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3 = BOUNDARY_COMPATIBLE（CTR-HA-010）
  vs operative Home provisioning contracts = DISPLACED_BY_THIS_SPEC（DEC-HA-002，
    ALT-HA-001 displaced；非 prose override、非 partial supersession）
  vs AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 = SCOPE_DISJOINT

SELECTED_PERMISSION_MODEL = MODEL_A
AFFECTED_EXACT_86_COUNT   = 86
CANARY_ONLY_FIRST         = YES

PARTIAL_SUPERSESSION = NONE
supersedes = []
superseded_by = null

IMPLEMENTATION_AUTHORIZED_NOW = NO
PRODUCTION_APPLY_AUTHORIZED_NOW = NO
READY_FOR_INDEPENDENT_REVIEW = YES
NEXT_TASK = 目录 审计
```

## 15. Authoring round output

```text
TASK_NAME = 目录 执行
TASK_STATUS = PASS（DOCS_ONLY_SPEC_AUTHORING）

SPEC_ID   = AGENT_TRUSTED_HOME_CROSS_UID_ACCESS_V1
SPEC_COMMIT = <本 round commit>
DRAFT_PR  = <本 round Draft PR>

PRODUCT_CODE_CHANGE = NONE
SCRIPT_CHANGE = NONE
OWNER_CHANGE = NONE
ACL_CHANGE = NONE
PRODUCTION_CHANGE = NONE
PRODUCTION_APPLY_AUTHORIZED_NOW = NO
```
