---
spec_id: AGENT_CORE_BROKER_CAPABILITIES_TEST_DECOMPOSITION_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
accepted_date: 2026-08-30
accepted_reviewed_head: deda45d87635c577be37d6402ba1c26c8a483428
scope:
  - mayf3/dsh-agent-core
  - packages/broker/test capability baseline decomposition only
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2
  - AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1
  - AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1
  - AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V1
  - AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_PAGINATION_V1
  - AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_BROKER_CAPABILITIES_TEST_DECOMPOSITION_V1

> 状态：**proposed**。本轮只提交 docs-only Draft PR，不实现、不接受、不 merge。
> 本 Spec 只有在独立“拆测 审计”通过、完成 lifecycle acceptance 并进入未来实现基线后，
> 才能成为共享测试拆分 authority。`PRODUCT_CODE_CHANGE = NONE`；
> `PRODUCTION_CHANGE = NONE`。
>
> **ACCEPTED（2026-08-30，联动 执行 / COORDINATED_ACCEPTANCE_AND_MERGE）。**
> 生命周期 acceptance：`status: proposed -> accepted`；
> `implementation_authority: none -> contracts`（成为共享测试拆分 authority；
> 依据 §5 exact 8-path 闭包授权 拆测 执行轮）；`PRODUCTION_APPLY_AUTHORITY =
> none` 保持。authoring 轮 reviewed head =
> `deda45d87635c577be37d6402ba1c26c8a483428`（fresh fetch 核对无漂移），加本
> acceptance commit。独立审计 verdict 未经独立审计轮产生——本 acceptance 为
> Owner-directed 协调 acceptance（§10 如实记录，不声明任何独立审计 verdict）。
> 本事务 docs-only：不实现 8-path、不 deploy、不改 PR #101/#102/#108/#109/#110。
> 完整记录见 §10。

## 1. Goal

把 current `main` 上 744 行、未登记 legacy 的
`packages/broker/test/capabilities.test.js` 一次性拆为按职责归属的 `<500` 行测试文件，
消除任何 touch 都触发 `UNREGISTERED_LEGACY_TOUCHED` 的结构死锁，同时保持全部既有
Broker 测试行为、fixture 与错误断言不变，并为后续 Global Instances V2、Domain
Pagination V2、Transition 提供稳定、互不争抢的 dedicated test-file 落点。

本 Spec 是**共享结构前置事务**，不是任何 capability 产品实现。它不授权把 PR #101、
PR #102 或 Transition 的功能代码合入本拆分 PR。

## 2. Current state and blocking evidence

Authoring base：`mayf3/dsh-agent-core` current `github/main` =
`4bab9c902931164fb6f812e46891daf9ee7bf68f`（2026-08-29 scratch probe）。

```text
CURRENT_FILE = packages/broker/test/capabilities.test.js
CURRENT_PHYSICAL_LINES = 744
CURRENT_REGISTERED_LEGACY = NO
CURRENT_MANIFEST_COUNT = 13
CURRENT_FILE_TESTS = 18 / 18 pass / 0 fail
CURRENT_BROKER_TESTS = 173 / 173 pass / 0 fail
BASE_STRUCTURE_GATE = PASS / 0 violations / 34 warnings
```

Active structure verifier 的机械语义：head 中仍超过 500 行的 base legacy 文件只要被
触及且 registry 无 entry，就报 `UNREGISTERED_LEGACY_TOUCHED`；净增、净零或净减都不能
改变“被触及”这一事实。PR #101（Global Instances）与 PR #102（Pagination）均为 Draft，
且均明确报告同一文件、同一 violation class。故其功能正确性与本结构 blocker 是两个独立
维度。

## 3. Decisions

### DEC-001 — Shared decomposition is the only allowed route

未来实现必须删除旧 `capabilities.test.js`，把全部现有 baseline tests 搬到本 Spec 冻结的
职责文件。不得保留 shim、空壳、re-export、loader 或同名替代文件。

### DEC-002 — One small non-test helper

共用 mock HTTP/token wiring 只能进入一个小型 helper：

`packages/broker/test-support/capability-fixtures.js`

helper 位于 `test-support/`，不得以 `.test.js` 结尾，不得注册 `node:test`，不得包含
capability-specific fixture、manifest count、产品合同断言或未来功能行为。shared helper 的
成员合同是：仅承载被 **两个及以上** 拆分测试文件共同使用的 helper。它只容纳当前文件已有、
满足该合同的：
`startMockServer`、`safeJson`、`json`、`startTokenServer`、`wire`、`mockTargets`
及其最低必要 imports/exports。

`svcError` **不属于 shared helper**：它仅服务于 workflow-my-tasks 测试族（单一职责文件），
不满足“两个及以上文件共享”的成员合同，因此保留在
`packages/broker/test/capabilities/workflow-my-tasks.test.js`，随该文件一起搬迁。

### DEC-003 — Aggregate inventory has one owner

aggregate manifest validation 与 count assertion 搬到且只存在于：

`packages/broker/test/capabilities/manifest-inventory.test.js`

拆分事务中 count 必须保持 **13**，不得借拆分顺手接入、删除或重排 manifest。后续 capability
PR 只能在其 governing Spec 明确授权时单独调整 inventory count。

### DEC-004 — Baseline fixtures split by responsibility

未来实现必须使用 §5 exact closure。每个新文件必须小于 500 physical lines；不得通过压缩
语句、删除断言、合并 fixture 或弱化错误检查来满足行数门。

nested `packages/broker/test/capabilities/forum.test.js` 的命名是有意隔离：accepted Forum
Moderation V2 与 Draft PR #105 已冻结/使用顶层 `packages/broker/test/forum-capabilities.test.js`
（implementation 为 441 行）。共享拆分不得占用、修改或合并该顶层文件，否则会破坏其
exact closure，并可能让后续组合越过 500 行。

### DEC-005 — Exact preservation boundary

从 base 文件搬迁的 18 个 `test(...)` block 必须逐 block 原样搬迁：test name、fixture literal、
mock route、scope、request/response shape、secret canary、error code/status/detail/request-id
断言、rendered-text regex、call-count assertion、Idempotency-Key assertion 均 byte-preserved。
仅允许以下结构性差异：

1. 各目标文件增加自己的 imports 与职责 header；
2. shared helper 声明增加必要 `export`，职责文件改为 import 同名 helper；
3. 原文件的 section comments 可按目标职责重建；
4. 不影响执行语义的空白边界调整。

任何断言、fixture payload、期待值或错误语义变化都超出本 Spec，必须停止并 amendment。
拆分前后 target test count 必须都是 18，完整 Broker test count 必须都是 173。

### DEC-006 — Stable downstream test homes

本共享拆分冻结后续唯一落点：

| 后续能力 | dedicated test file | 本拆分是否创建 |
|---|---|---|
| Global Instances V2 | `packages/broker/test/capabilities/workflow-global-instances-v2.test.js` | NO；首次获授权的 Global V2 implementation 创建 |
| Domain Pagination V2 | `packages/broker/test/capabilities/workflow-domain-pagination-v2.test.js` | NO；首次获授权的 Pagination V2 implementation 创建 |
| Transition | `packages/broker/test/capabilities/workflow-transition.test.js` | YES；先承接 current generic transition-shaped idempotency fixture，后续正式 transition 只追加该职责 |

本 Spec **不构成 partial supersession**，也不静默改写既有 accepted Specs。Adoption V0
DEC-ADOPT-004 禁止新增 partial supersession；Error Preservation、Domain Broker、Global、
Pagination、Transition 与 Forum V2 中冻结的旧 test path / exact closure 必须在实现前分别完成
focused in-place amendment，或由 whole successor 完整替代，并通过独立 acceptance。后续 Global
Instances V2、Pagination V2 与 Transition authority 必须显式采用上表 path；在该 authority
reconciliation 完成前，PR #101/#102 不能仅凭本 proposed Spec 改落点或 merge。各既有产品合同、
source behavior、fixture coverage、错误语义与 acceptance 要求均不得因结构拆分而改变；任何
新增 feature Spec 也不得重新创建 `capabilities.test.js`。

### DEC-007 — No registry or rule workaround

`.agents/structure-registry.json` 与 `.agents/local/CODE_STRUCTURE_GUARDRAILS_V1*` 不在闭包。
不得新增 exception、改 ceiling、改 verifier、改 scope，也不得以 generated/fixture 标记逃逸。

## 4. Rejected alternatives

- **ALT-001 — registry exception**：拒绝。它只能登记 legacy ceiling，不能提供增长空间，也不
  建立职责边界；且用户裁决为 shared decomposition。
- **ALT-002 — net-zero touch**：拒绝。未登记的 >500 legacy 只要被 touch 即 violation，
  added/deleted 相抵无效。
- **ALT-003 — continue growing the old file**：拒绝。同一 violation 且职责继续聚合。
- **ALT-004 — each blocked feature invents its own ad-hoc file**：拒绝。无法迁出 aggregate
  count 与 baseline debt，会留下旧文件并制造持续双重 owner。
- **ALT-005 — combine all moved tests into one renamed file**：拒绝。只是换名复制 744 行，
  触发 `NEW_FILE_OVER_500`，且没有 dedicated stable homes。
- **ALT-006 — weaken/compress tests to fit**：拒绝。违反 byte/semantic preservation 与
  anti-evasion 纪律。

## 5. Exact future implementation closure

接受后，独立 implementation PR 只能改以下 **8 paths**：

```text
D packages/broker/test/capabilities.test.js
A packages/broker/test-support/capability-fixtures.js
A packages/broker/test/capabilities/manifest-inventory.test.js
A packages/broker/test/capabilities/forum.test.js
A packages/broker/test/capabilities/okr.test.js
A packages/broker/test/capabilities/workflow-instances.test.js
A packages/broker/test/capabilities/workflow-my-tasks.test.js
A packages/broker/test/capabilities/workflow-transition.test.js
```

职责映射与 scratch-measured physical lines：

| Target | Current blocks moved verbatim | Lines |
|---|---|---:|
| `test-support/capability-fixtures.js` | common mock/token/wire helpers shared by 2+ split files (no `svcError`; it stays in workflow-my-tasks.test.js) | 83 |
| `capabilities/manifest-inventory.test.js` | aggregate 13-manifest validation | 28 |
| `capabilities/forum.test.js` | forum safe-kind, required query, reply wire fixture, undeclared-code fallback | 143 |
| `capabilities/okr.test.js` | OKR read fixture | 39 |
| `capabilities/workflow-instances.test.js` | instance-detail and domain-instances baseline success/error/bounds fixtures | 180 |
| `capabilities/workflow-my-tasks.test.js` | baseline list + AC A–E | 198 |
| `capabilities/workflow-transition.test.js` | generic transition-shaped Idempotency-Key fixture | 78 |

`packages/broker/src/**`、其他 `packages/**`、`.agents/**`、`scripts/**`、bundle/config、docs 与
production 均不在 implementation closure。实现 PR 不得修改本 governing Spec
（`GOVERNING_SPEC_UNMODIFIED`）。

## 6. Scratch probe and mechanical feasibility

A disposable fresh-main worktree must prove the exact §5 layout before acceptance. Binding evidence fields:

```text
SCRATCH_BASE = 4bab9c902931164fb6f812e46891daf9ee7bf68f
SCRATCH_HEAD = df3a75570ec1b02d566060ce9e463b25e8d48e6b (disposable; not pushed)
SCRATCH_EXACT_PATHS = PASS / exactly 8 (1 delete + 7 add; §5)
SCRATCH_PER_FILE_LINES = 83 / 28 / 143 / 39 / 180 / 198 / 78 (all <500)
SCRATCH_TARGET_TESTS = 18 / 18 pass / 0 fail
SCRATCH_BROKER_TESTS = 173 / 173 pass / 0 fail
SCRATCH_STRUCTURE_GATE = PASS / exit 0 / 0 violations / 33 unrelated baseline warnings
SCRATCH_TEST_BLOCK_SHA256_BEFORE_AFTER = e4c0e7971f43c7f5ad0e7f25d30f371da9da9fa584ef4d2444b52b4ef02901a4 / identical
SCRATCH_PRODUCT_SOURCE_DIFF = 0
SCRATCH_REGISTRY_OR_RULE_DIFF = 0
```

The scratch worktree is evidence only: it must not be pushed, merged, deployed or reused as this docs-only PR.

## 7. Acceptance contracts for the future implementation

- **ACC-001 Exact closure**：diff name-status 恰为 §5 八个 paths；旧文件为 delete，七个新文件
  为 add；extra path count = 0。
- **ACC-002 Line limit**：七个新文件各 `<500` physical lines；无 structure violation。
- **ACC-003 Inventory**：aggregate manifest count = 13；manifest iteration 与 validation
  assertions 不变。
- **ACC-004 Behavioral parity**：18/18 moved tests pass；test names 集合与 base 完全一致；
  fixture/error assertion preservation audit PASS。
- **ACC-005 Broker baseline**：`(cd packages/broker && npm test)` = 173/173 pass，
  0 fail/cancel/skip/todo；该命令必须发现 nested `test/capabilities/*.test.js`，不得用只匹配
  顶层测试的窄 glob 伪造通过。
- **ACC-006 Structure**：`node scripts/verify-code-structure.mjs --base <implementation-base>
  --head <implementation-head>` exit 0，violations = 0；warnings 只允许 pre-existing 或新文件
  正常 warning-line 提示，不得新增 anti-evasion warning/violation。
- **ACC-007 Boundaries**：product source diff = 0；registry/rule diff = 0；manifest bytes = unchanged；
  production change = none。
- **ACC-008 Stable homes**：本拆分不得创建 Global/Pagination 的空 placeholder；未来分别由
  获授权的 V2 PR 创建 `capabilities/workflow-global-instances-v2.test.js` 与
  `capabilities/workflow-domain-pagination-v2.test.js`。Transition 只能落在 DEC-006 文件。

任一 acceptance contract 不满足，implementation 不得 merge；不得以“测试都绿”覆盖 structure
失败，也不得以“structure 通过”覆盖 test/fixture 漂移。

## 8. Lifecycle and sequencing

严格顺序：

```text
1. 本 docs-only Draft PR（status=proposed）
2. 拆测 审计
3. 对 §3 DEC-006 列出的 conflicting accepted authorities 做 focused in-place amendments，或
   whole successors；独立审计并 acceptance（禁止 partial supersession）
4. 本 Spec 在冲突消解后做独立 lifecycle-only acceptance（可与第 3 步同一原子 authority transaction）
5. fresh-main shared decomposition implementation（本 Spec 文件不得修改）
6. decomposition audit + merge
7. PR #101 / PR #102 / Transition 依据已接受的新 authority rebase/reconcile 到 stable dedicated paths
```

在第 5 步完成前，PR #101/#102 的 `UNREGISTERED_LEGACY_TOUCHED` blocker 仍然存在；本
proposed Spec 或 Draft PR 本身不解除 blocker。拆分 implementation 不得夹带三项 feature 的
任何新增 manifest、schema、mapping、transport、relay 或 feature fixture。

## 9. Authoring result

```text
SHARED_STRUCTURE_SPEC_PR = DRAFT / OPEN / docs-only (assigned after push)
IMPLEMENTATION_CLOSURE = EXACT_8_PATHS (1 delete + 7 add; §5)
SCRATCH_TESTS = 18/18 split + 173/173 Broker PASS
STRUCTURE_GATE = SCRATCH PASS / 0 violations; DOCS_ONLY_BRANCH PASS / 0 violations
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
NEXT_TASK = 拆测 审计
```

## 10. Acceptance Record (2026-08-30, 联动 执行 / COORDINATED_ACCEPTANCE_AND_MERGE)

ACCEPTANCE_TRANSACTION = LIFECYCLE_ONLY，ONE commit，ONE file（本文件）。

- 事务：TASK_NAME = 联动 执行；TASK_TYPE = COORDINATED_ACCEPTANCE_AND_MERGE；
  独立 worktree；authoring-round reviewed head =
  `deda45d87635c577be37d6402ba1c26c8a483428`（fresh fetch 核对无漂移）+ 本
  acceptance commit。main 状态坐标：authoring base f54679c；本事务执行时 main
  已含并行的 PR #111（冷备 执行，merge b53ebd6）——与本文档零文件重叠，纯
  lifecycle 无关。
- **权威协调上下文**：本 acceptance 与姊妹协调 PR #108/#109/#110（Global
  Instances V2 successor / Domain Pagination V2 successor / Transition focused
  amendment）属同一 联动 执行 协调事务，按 Owner 编排顺序 #107 → #108 → #109
  → #110 逐 PR 顺序 merge（本事务其后立即依次 merge）。结束态满足 §8 步骤 3–4：
  冲突 accepted authorities（Global V1 / Pagination V1 闭包、Transition §2 落点）
  已由三份协调 authority 解消，本 Spec 已 accepted、实现基线就绪；
  #108/#109/#110 已显式 adopt DEC-006 路径（各自 acceptance 记录绑定）。
- **独立审计状态（如实记录）**：本事务为 Owner-directed 协调 acceptance；
  独立「拆测 审计」轮未在本事务之前运行；§8 步骤 2 的审计项按 Owner 编排后置
  （NEXT_TASK = 拆测 执行 轮将实现 §5 exact 8-path 闭包；实现轮审计随实现
  验收执行）。本记录**不声明任何独立审计 verdict**——没有审计 verdict 可记录，
  不伪造 `independent_audit_result` 类字段。机械化验证在 authoring head 与
  acceptance head 全部实测 PASS：frontmatter schema、`verify_governance.py`
  （vendored bytes 匹配）、`npm run verify:structure`（0 violations）、
  `git diff --check`、Broker 基线 `node --test` = 173/173。
- 语义变化 = STATUS_MIRROR_AND_PROVENANCE_ONLY：本事务仅翻转 status
  （proposed → accepted）、翻转 implementation_authority（none → contracts）、
  记录 acceptance provenance（frontmatter 字段 + 头部引注 + 本节）；§1–§9 全部
  冻结内容（§3 DEC-001..007、§5 exact 8-path closure、§6 scratch evidence、
  §7 ACC-001..008、§8 生命周期序列、§9 authoring result）逐字节保留；正文中
  先于 acceptance 的条件句（§1「只有在独立拆测 审计通过…」、§7「任一
  acceptance contract 不满足，implementation 不得 merge」、§8 步骤 2、§9
  `NEXT_TASK = 拆测 审计`）按既有纪律作为历史记录原样保留。
- 授权生效语义：本 Spec merged on main 起成为共享测试拆分 authority
  （`implementation_authority = contracts`）；拆测 执行 轮的实现按 §5 exact
  8-path 闭包在独立 worktree 从 fresh merged main 进行；实现 PR 不得修改本
  文件（GOVERNING_SPEC_UNMODIFIED）；`production_apply_authority = none` ——
  deploy / restart / production state 变更仍需独立授权。
- 协调文档冻结：DEC-006 dedicated homes（Global V2 =
  `capabilities/workflow-global-instances-v2.test.js`、Pagination V2 =
  `capabilities/workflow-domain-pagination-v2.test.js`、Transition =
  `capabilities/workflow-transition.test.js`）与 DEC-003 aggregate owner
  （`capabilities/manifest-inventory.test.js`）已由 #108/#109/#110 显式采用；
  inventory 协调序 = 分解保持 13 → Global V2 13→14 → Transition 14→15；
  Pagination V2 不改变计数。
- 事务边界：DOCS_ONLY；PRODUCT_CODE_CHANGE = NONE；PRODUCTION_CHANGE = NONE；
  packages/、scripts/、.agents/**、production 均不动；PR #101/#102 不被本事务
  修改（其处置按 §8 步骤 7 属实现轮之后的独立未来轮次）；#108/#109/#110 仅在
  其自己的 acceptance 轮被推进。
- Merge：本 commit 之后随即 mark ready 并 merge PR #107（merge commit 为本
  Spec 的 effective-on-main 坐标，记录于 merge 后的 main lineage）。
