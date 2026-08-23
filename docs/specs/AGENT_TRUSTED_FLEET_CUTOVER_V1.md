---
spec_id: AGENT_TRUSTED_FLEET_CUTOVER_V1
status: accepted
accepted_date: 2026-08-23
accepted_by: mayf3
accepted_reviewed_base: 0fced5bbcc4287eb20ef5f54979ccd8ef31716e8
accepted_reviewed_spec_commit: eb2189c088d12613a1ba0b55ec59037c62110d07
accepted_reviewed_spec_blob: 2078a11c2467aeb0bdb5b9e2abe6f8ac033da089
primary_review: 接管 审计
primary_review_result: PASS
current_base_review: 漂移 审计
current_base_review_result: PASS
previous_reviewed_base: 6ec83fa7ef0565959f26c7112de423bf5aa65680
required_fixes: NONE
semantic_delta_after_review: NONE
type: bounded-fleet-cutover-spec
review_status: READY_FOR_INDEPENDENT_REVIEW
implementation_authority: none
production_apply_authority: none
owner_intent_provenance: direct Owner instruction, sessions 2026-08-22 / 2026-08-23
phases:
  - WORKSPACE_IN_PLACE_CUTOVER
workspace_authority: AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3@f02691c6e31ac60dd673f7846742e8d4c2029abf
authority_dependencies:
  - AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3@f02691c6e31ac60dd673f7846742e8d4c2029abf
external_parallel_authorities:
  - AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1@d83a2ff0e9644611707d7481ef88b4d7d49fb68e
superseded_authorities_not_reopened:
  - AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2@261a80e66e52bf60d43980e9d22fe37dc793e5be
---

# Agent Trusted Fleet Cutover V1

> **ACCEPTED / DOCS-ONLY / NO IMPLEMENTATION OR PRODUCTION AUTHORITY.**
>
> 本修订（「接管 执行」round，基于 previous head `30ae0f5d9f5f87c0fefda933c04e4e549af0f0f7`，
> 并已把 current main `6ec83fa7ef0565959f26c7112de423bf5aa65680` 以普通 merge commit 合入）
> 使本 Spec 完全对齐已进入 main 的 accepted Workspace authority
> `AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3`：删除全部 curated import /
> replacement Workspace 路线，冻结 exact 86 Agent 的**原 Workspace 原地接管计划**。
> 本修订不实现、不 accept、不 merge、不 production apply，不创建/修改/删除
> Principal/Client/Credential/Receipt/Workflow Grant/Forum Grant，不改 `agents.json`，
> 不写 `primary-workspaces.json`，不改 Binding，不 reload/restart Runtime，
> 不启用 Scheduler jobs。
>
> **Acceptance-finalize（2026-08-23，「同步采纳 执行」round）**：独立「接管 审计」已在
> exact reviewed head `eb2189c088d12613a1ba0b55ec59037c62110d07`（spec blob
> `2078a11c2467aeb0bdb5b9e2abe6f8ac033da089`，previous reviewed base
> `6ec83fa7ef0565959f26c7112de423bf5aa65680`）给出 PASS（REQUIRED_FIXES=NONE）；main
> 前进至 `0fced5bbcc4287eb20ef5f54979ccd8ef31716e8` 后由独立「漂移 审计」确认该漂移
> 不影响 reviewed 语义。authorized maintainer 先以普通 merge commit 将 current main
> 合入本分支（reviewed Spec blob 未改变），再以 lifecycle-only / semantic delta NONE 的
> acceptance-finalize 将本 Spec 变为 accepted candidate。Accepted 后
> `implementation_authority = none`、`production_apply_authority = none` 保持不变：
> `IMPLEMENTATION_AUTHORIZED_NOW = NO`、`PRODUCTION_APPLY_AUTHORIZED_NOW = NO`；
> 生产接管仍需 PR 合入 main、immutable mapping/runbook、独立 runbook 审计、显式
> production approval 与 Build in Public first canary。

## 0. Lifecycle and owner ordering

```text
TASK_NAME = 接管 执行
STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none

WORKSPACE_AUTHORITY =
  AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3
WORKSPACE_AUTHORITY_ACCEPTED_REVISION =
  f02691c6e31ac60dd673f7846742e8d4c2029abf
WORKSPACE_AUTHORITY_MAIN_MERGE =
  6ec83fa7ef0565959f26c7112de423bf5aa65680

DIRECT_ADOPT_IN_PLACE = REQUIRED
ZERO_COPY = REQUIRED

AUTH_PHASE_A = EXTERNAL_PARALLEL_LINE
WORKSPACE_PHASE_BLOCKED_BY_AUTH = NO

IMPLEMENTATION_AUTHORIZED_NOW = NO
PRODUCTION_CHANGE = NONE
NEXT_TASK = 接管 审计
```

Acceptance binding（2026-08-23 acceptance-finalize 冻结）：

```text
REVIEWED_SPEC_COMMIT = eb2189c088d12613a1ba0b55ec59037c62110d07
REVIEWED_SPEC_BLOB = 2078a11c2467aeb0bdb5b9e2abe6f8ac033da089
PREVIOUS_REVIEWED_BASE = 6ec83fa7ef0565959f26c7112de423bf5aa65680
CURRENT_REVIEWED_BASE = 0fced5bbcc4287eb20ef5f54979ccd8ef31716e8
PRIMARY_REVIEW = 接管 审计
PRIMARY_REVIEW_RESULT = PASS
CURRENT_BASE_REVIEW = 漂移 审计
CURRENT_BASE_REVIEW_RESULT = PASS
REQUIRED_FIXES = NONE
ACCEPTED_BY = mayf3
SYNC_MERGE = current main 0fced5bbcc4287eb20ef5f54979ccd8ef31716e8 merged by ordinary merge commit (parent1 = eb2189c088d12613a1ba0b55ec59037c62110d07); reviewed spec blob unchanged
SEMANTIC_DELTA_AFTER_REVIEW = NONE
ACCEPTANCE_DELTA_CLASS = LIFECYCLE_ONLY
IMPLEMENTATION_PERFORMED = NO
PRODUCTION_CHANGE = NONE
```

本文件描述的 “MUST / SHALL / authorized scope” 仅冻结未来 acceptance 与独立 execution
authority 的最大允许范围；在本文件仍为 `proposed` 且 `implementation_authority=none`
时，任何 apply 均未获授权。

## 1. Pinned authority graph

开工前已在 `origin/main@6ec83fa7ef0565959f26c7112de423bf5aa65680` 逐项核对每个 revision
的 main ancestry 与角色，按 exact 类别分类（不存在、也不得再使用任何 blanket
“全部均为 main ancestors” 的陈述）：

| Authority / implementation | Exact revision | Per-revision classification |
|---|---|---|
| `AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3` | acceptance-finalize revision `f02691c6e31ac60dd673f7846742e8d4c2029abf`，merge into main `6ec83fa7ef0565959f26c7112de423bf5aa65680` | ACCEPTED_REVISION_ON_MAIN；MAIN_ANCESTOR = YES — sole current Workspace authority（historical OpenClaw Workspace 原地直接复用 / zero copy / `primary-workspaces.json` path authority）；`implementation_authority=contracts`，`production_apply_authority=none`；本 PR #47 revision 即其 CTR-OW-011 gate 的执行 |
| `AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2` | acceptance-finalize revision `261a80e66e52bf60d43980e9d22fe37dc793e5be` | SUPERSEDED_ON_MAIN（superseded_by = V3 at `f02691c`；supersedes=[V1] 历史保留）；其 replacement Workspace / curated import 语义整体作废，本 Spec 不得再引用其任何 curated/import/copy 语义作为 authority |
| `AGENT_PRIMARY_WORKSPACE_IMPORT_V1` | historical | STAYS_SUPERSEDED；不复活、不重写 backlink |
| `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` Amendment 6 | current accepted revision / file last change `d83a2ff0e9644611707d7481ef88b4d7d49fb68e` | ACCEPTED_REVISION_ON_MAIN；MAIN_ANCESTOR = YES — 但角色冻结为 **EXTERNAL_PARALLEL_LINE**（§5）：本 PR 复用其既有事实作为证据，不在本计划内执行任何 Principal/Client/Credential 创建 |
| `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` (same authority) | reviewed semantic head `5d1285195f8c2e3eb88ea606be09671b074f68d4` | REVIEWED_SEMANTIC_PROVENANCE_ONLY；MAIN_ANCESTOR = NO；IMPLEMENTATION_AUTHORITY_SOURCE = NO — independent review provenance only；MUST NOT be cited as an accepted revision, main ancestor, or implementation-authority source |
| Phase-A implementation, PR #17 | final merged implementation head `83d10b8ad8d10595d18c190190ff99f9cfcd5185` | MERGED_IMPLEMENTATION_HEAD；MAIN_ANCESTOR = YES — external parallel auth line 的实现基线（本 PR 不依赖其执行） |
| Phase-A implementation, PR #17 (merge) | merge commit `79cc8e861cbb16755370b0e9f30ef3fb47c56fa6` | MERGE_COMMIT_ON_MAIN；MAIN_ANCESTOR = YES |
| Phase-A trusted-store hardening | `d8cb1b0d2536c424653bd514486490ea16208c56` | MERGED_POST_IMPLEMENTATION_HARDENING_ON_MAIN；MAIN_ANCESTOR = YES |
| this Spec | Draft PR #47 exact head after this revision | proposed child；grants no current implementation or production authority |

Authority consequences:

```text
WORKSPACE_AUTHORITY_PRESENT = YES (V3 accepted on main)
WORKSPACE_AUTHORITY_ALIGNED = REQUIRED (this revision)
PHASE_A_ROLE = EXTERNAL_PARALLEL_LINE
WORKSPACE_WHOLE_AUTHORITY_BLOCKER = CLOSED
WORKSPACE_PHASE_BLOCKED_BY_AUTH = NO
```

Acceptance of this proposed child would still not itself approve a production run. A separately
reviewed execution/runbook authority and explicit production approval remain required before
apply（对齐 V3 §4.3 与 CTR-OW-012）。

## 2. Obsolete workspace model removed and replaced（V3 CTR-OW-011）

本修订从本 Spec 中**删除或明确废止**以下全部旧语义（均属已被 V3 superseded 的
V2 replacement/curated 路线；不得以任何措辞重新引入）：

```text
CREATE_REPLACEMENT_TRUSTED_WORKSPACE  = REMOVED
HISTORICAL_WORKSPACE_SOURCE_ONLY      = REMOVED
CURATED_IMPORT                        = REMOVED
FIVE_PERSONA_FILE_LIMIT               = REMOVED
MANIFEST_SELECTED_COPY                = REMOVED
EXTENSION_ALLOWLIST                   = REMOVED
SUBTREE_ALLOWLIST                     = REMOVED
POST_COPY_NEW_WORKSPACE_AUTHORITY     = REMOVED
WORKSPACE_FILE_MIGRATION              = REMOVED
SYMLINK_HARDLINK_REWRITE_AT_CUTOVER   = REMOVED
FILE_MODE_EXECUTABLE_BIT_CHANGE       = REMOVED
TRUSTED_HOME_PROFILE_SETTINGS_REGENERATION_AS_CUTOVER_STEPS = REMOVED
PHASE_2_GRANT_RESTORE_AS_THIS_SPECS_PHASE = REMOVED (external parallel, §5)
```

替换为 accepted V3 的原地接管模型（`OPENCLAW_RUNTIME_REUSE = NO` /
`OPENCLAW_WORKSPACE_REUSE = YES`）：

```text
OPENCLAW_RUNTIME_REUSE = NO
OPENCLAW_WORKSPACE_REUSE = YES

DIRECT_ADOPT_IN_PLACE = REQUIRED
ZERO_COPY = REQUIRED

PATH_AUTHORITY = primary-workspaces.json
PATH_SCHEMA = exact agent_id -> exact historical OpenClaw absolute path

AGENT_DEFINITION_WORKSPACE_PATH_FIELD = FORBIDDEN

Binding.workspace = null
```

解析链唯一（V3 §2.1 / CTR-OW-002 / CTR-OW-008）：

```text
Binding.workspace = null
→ Default Primary Workspace Rule
→ resolveWorkspace(agentId)
→ primary-workspaces.json
→ exact historical OpenClaw Workspace
→ child cwd / DSH_PRIMARY_WORKSPACE
```

每个 exact Agent 的 primary Workspace **就是**其 historical OpenClaw Workspace absolute
path：原地读、原地写、继续使用其既有 Git repository；不创建替代 Workspace、不做双写或
同步、不建立 copy 后的新 authority、不把 historical path 降级为 read-only source。因不
存在内容复制，本计划下不存在 migration allowlist / manifest / curated set。整个
historical Workspace 全量可见（full visibility），不得按扩展名、subtree 或 scanner 决定
可见性；`CROSS_AGENT_FILESYSTEM_ISOLATION = UNPROVEN`（cooperative shared-host trust
domain，对齐 V3 CTR-OW-003，不得过度声称）。接管 transaction 对 Workspace 零文件、零
metadata 变更（V3 CTR-OW-004：no chmod/chown/delete/rewrite/cleanup/exec-bit strip/
symlink expansion/hardlink flatten/git metadata change/auto-format/secret-scan-delete/
mirror copy；`SYMLINK_FOLLOW_ALLOWED_AND_OWNER_ACCEPTED = YES`，接管不创建/展开/改写/
删除现有 symlink）。回滚只恢复控制面四项（V3 CTR-OW-010：primary-workspaces.json
mapping、Agent Definition membership、Binding、停止 Agent Core 对该 Agent 的自动化使用），
永不触碰 Workspace 文件。

## 3. Pinned production read-only inventory and Definition facts

The completed redacted inventory is immutable evidence for this proposal:

```text
INVENTORY_RESULT_SHA256 = 56a75dde3942e4d0b1acdb822c664de32770b5f5b4ce848769c32e4b2f5e8419
INVENTORY_SCRIPT_SHA256 = 58ab3c2854c6b74cd30eb41c71618be7df310dec1aec11c23e57f619db04b664
INVENTORY_GENERATED_AT = 2026-08-22T15:25:22.725Z
EXACT_ROSTER_SHA256 = f046d18f76da838ba94775af7c960d0ee548f2e392c22e6c7b0e3add36cb8e5f
TOTAL = 86
CLASS_A_CLEAN_BOOTSTRAP_COUNT = 86
CLASS_B_EXISTING_MATCH_COUNT = 0
CLASS_C_RECONCILIATION_COUNT = 0
CLASS_D_ERROR_COUNT = 0
PARENT_CLIENT_ROUTE_BLOCKED_COUNT = 0
GRANT_UNKNOWN_COUNT = 86
```

`EXACT_ROSTER_SHA256` is SHA-256 of the compact JSON array of §4 IDs in listed order. Every
inventory row is exactly:

```text
principal = ABSENT
client = ABSENT
credential = ABSENT
client_id_match = NOT_APPLICABLE
grant_state = UNKNOWN
classification = CLASS_A_CLEAN_BOOTSTRAP
```

本修订同时接受最新生产事实并冻结为 verify-only 输入：

```text
FINAL_AGENT_DEFINITION_COUNT = 91
EXACT_86_DEFINITIONS_PRESENT = YES

EXACT_86_PRESENT = REQUIRED
UNRELATED_DEFINITIONS_PRESERVED = REQUIRED
```

Definition 在本计划中仅做 **verify-only**。不得：创建 Definition；删除 Definition；重命名
Agent；修改 Definition schema；写入 Workspace path（对齐 V3
`AGENT_DEFINITION_WORKSPACE_PATH_FIELD = FORBIDDEN`）；为凑 91 删除 unrelated
Definition。`agt_cto-agent` 继续不属于 exact 86 cutover roster，但不得因本任务删除它；
其余 5 个 unrelated Definitions 同样 preserved。91 是生产现状的验收输入，不是本计划的
变更目标。

## 4. Exact 86 frozen Agent IDs

This ordered array is the complete and only fleet. Count must equal 86, entries must be unique,
and every future plan/apply must match both this array and `EXACT_ROSTER_SHA256`. Count-only or
mutable discovery MUST NOT widen the set.

```json
[
  "agt_ceo-agent",
  "agt_stock-agent",
  "agt_research-agent",
  "agt_knowledge-curator-agent",
  "agt_daily-thought-agent",
  "agt_efficiency-agent",
  "agt_lobster-agent",
  "agt_itops-agent",
  "agt_healthcheck-agent",
  "agt_hr-agent",
  "agt_security-agent",
  "agt_skill-engineer-agent",
  "agt_discipline-coach-agent",
  "agt_blog-agent",
  "agt_education-agent",
  "agt_psychology-agent",
  "agt_game-dev-agent",
  "agt_finance-agent",
  "agt_devtools-agent",
  "agt_voice-tech-agent",
  "agt_image-gen-agent",
  "agt_email-manager-agent",
  "agt_account-manager-agent",
  "agt_shopping-list-agent",
  "agt_feishu-expert-agent",
  "agt_podcast-producer-agent",
  "agt_soul-questioner-agent",
  "agt_lobster-guide-agent",
  "agt_article-publisher-agent",
  "agt_travel-planner-agent",
  "agt_agent-dev-engineer",
  "agt_paper-reviewer-agent",
  "agt_3d-print-agent",
  "agt_writing-style-analyst-agent",
  "agt_family-doctor-2-agent",
  "agt_feishu-expert-2-agent",
  "agt_reimbursement-expert",
  "agt_mobile-app-engineer",
  "agt_miniapp-game-engineer",
  "agt_trend-tracker",
  "agt_biz-explorer",
  "agt_video-producer",
  "agt_creative-writer",
  "agt_test-engineer",
  "agt_learning-expert",
  "agt_content-ops-agent",
  "agt_finance-housekeeper-agent",
  "agt_quant-trading-agent",
  "agt_novel-writer",
  "agt_frontend-react-engineer",
  "agt_open-source-agent",
  "agt_smart-home-agent",
  "agt_product-manager",
  "agt_product-designer",
  "agt_qa-reviewer",
  "agt_investment-debater",
  "agt_backend-engineer-2",
  "agt_qa-reviewer-2",
  "agt_social-butterfly-agent",
  "agt_arch-reviewer",
  "agt_explorer",
  "agt_ppt-designer",
  "agt_training-expert-agent",
  "agt_needs-radar-agent",
  "agt_delivery-review-agent",
  "agt_course-community-agent",
  "agt_biz-product-designer",
  "agt_private-chef-agent",
  "agt_course-community-agent-2",
  "agt_book-deconstructor-agent",
  "agt_build-in-public-agent",
  "agt_job-watch-agent",
  "agt_search-expert-agent",
  "agt_transcript-editor-agent",
  "agt_home-repair-agent",
  "agt_sales-copy-agent",
  "agt_hao-yang-mao-agent",
  "agt_family-steward-agent",
  "agt_video-model-expert",
  "agt_game-designer-agent",
  "agt_game-producer-agent",
  "agt_reader-simulator-agent",
  "agt_thesis-advisor-agent",
  "agt_biz-reviewer",
  "agt_translator-agent",
  "agt_translation-qa-agent"
]
```

Explicit exclusions include existing trusted identities such as `agt_stock_agent` and
`agt_cto-agent`; they are not members of this exact fleet and MUST NOT be changed by this plan.
A 87th identity, replacement identity, normalized/renamed identity, duplicate, missing member,
or digest mismatch fails before mutation.

每个 Agent 必须由 immutable cutover plan 精确绑定（对齐并扩展 V3 CTR-OW-001 的
per-Agent immutable artifact）：

```text
agent_id
historical_workspace_absolute_path
workspace identity evidence
historical conversation key
expected Binding row
```

- `historical_workspace_absolute_path` 只能来自已冻结 inventory 证据（§3 digests 及其
  续作/等价 read-only evidence artifact）；**不得人工猜测、不得按命名惯例推导、不得
  fallback 到 default Workspace**；
- `workspace identity evidence` = 证明该 path 属于该 exact Agent 的 read-only 证据
  （如 workspace 内 identity/persona 文件、OpenClaw registry 记录等，具体形态由
  PLAN_READ_ONLY 阶段冻结，不得伪造）；
- `historical conversation key` 与 `expected Binding row` 必须与生产 Binding 证据一致；
- 不得：动态扩大 roster；加入 `agt_cto-agent`；执行时扫描并自动新增 Agent。

## 5. Auth boundary — external parallel line

Auth/Credential 是**外部并行主线**，不是本计划的 phase、blocker 或变更面：

```text
AUTH_PHASE_A = EXTERNAL_PARALLEL_LINE
WORKSPACE_PHASE_BLOCKED_BY_AUTH = NO
```

本 PR 不得创建、修改或删除：

- Principal；
- Client；
- Credential；
- Receipt；
- Workflow Grant；
- Forum Grant。

不得继续把以下三项写成 Workspace mapping / Binding 计划的 blocker：

```text
DEFINITION_MISSING_AS_BLOCKER = FORBIDDEN (verify-only presence check, §3)
CREDENTIAL_MISSING_AS_BLOCKER = FORBIDDEN
GRANT_MISSING_AS_BLOCKER = FORBIDDEN
```

真实飞书回复（§8 step 9 / §10）之前**可以**验证 Credential readiness（read-only），
但 Credential 的创建与修复由鉴权线独立负责；若鉴权线未就绪，仅该真实回复 gate 无法
执行/通过，Workspace mapping 与 Binding 计划本身不被阻塞。原 §6
（WORKFLOW_FORUM_GRANT_RESTORE 作为本 Spec 的 Phase 2）整体废止：Grant/Workflow/Forum
的规划、创建与验收不属于本 Spec。

## 6. Global frozen boundaries

```text
PRESERVE_EXACT_AGENT_ID = REQUIRED
REPLACEMENT_IDENTITY = FORBIDDEN
LEGACY_CREDENTIAL_COPY = FORBIDDEN
LEGACY_SECRET_REUSE = FORBIDDEN
BLIND_WORKSPACE_COPY = FORBIDDEN
WORKSPACE_COPY = NONE
WORKSPACE_IMPORT = NONE
WORKSPACE_OVERLAY = NONE
WORKSPACE_PATH_CHANGE = NONE
CONFLICTING_BINDING_OVERWRITE = FORBIDDEN
AUTO_BIND = FORBIDDEN
ACTIVE_PRODUCTION_RUNTIME_COUNT = 1
ACTIVE_PRODUCTION_RUNTIME_USER = authsvc
SOLE_TRUSTED_RUNTIME_AUTHORITY = authsvc
OLD_USER_RUNTIME_RUNNING = NO
DUAL_RUNTIME_WRITERS = FORBIDDEN
RERUN_AFTER_SUCCESS = NOOP
```

The sole active production Runtime authority is `authsvc`. No USER (non-`authsvc`) Runtime may be
running, and no second Runtime writer may exist on Binding or Trusted state. Every side effect
must be exact-roster bounded, plan-digest bound, fail-loud, no-clobber, staged, and independently
auditable。

## 7. First canary — Build in Public

第一 canary 唯一固定为：

```text
AGENT_ID = agt_build-in-public-agent
CANARY_BINDING_KEY = feishu:oc_95bd40ab17712fe0f3a7cf7eb6f4e24a
```

- Definition：verify-only，必须已存在（不得创建）；
- `primary-workspaces` mapping：`agt_build-in-public-agent` → exact historical OpenClaw
  absolute path。路径必须来自已冻结 inventory / immutable cutover plan（§4 绑定字段），
  **不得人工猜测**；本 Spec 不内嵌手写路径值，canary 执行时必须原样引用 plan 冻结值；
- Binding：

```text
agentId = agt_build-in-public-agent
workspace = null
```

不得把 historical path 写进 `Binding.workspace`。除 canary 外的其余 85 个 Agent 不得先于
或并行于 canary 被接管（V3 CTR-OW-009）。

## 8. Canary control-plane transaction

未来 production canary 必须作为 staged、不可变计划执行（顺序不可弱化）：

1. 验证 Definition 已存在（verify-only）；
2. 验证 historical Workspace exact path（对照 immutable cutover plan 冻结值 + workspace
   identity evidence，read-only）；
3. 原子更新 `primary-workspaces.json`（exact `agent_id -> exact historical path` 单行
   mapping；atomic writer，fail-loud）；
4. 原子恢复 exact `Binding.workspace = null`（保留 exact conversation key 与
   `agent_id`；equivalent target = `NOOP`；non-equivalent occupied target =
   `BINDING_CONFLICT`，不得 overwrite）；
5. controlled Runtime reload（仅在 §11 runtime ownership 前置证明全部满足后）；
6. 验证 runtime 能看到：
   - Definition；
   - mapping（`resolveWorkspace(agentId)` 解析结果 = exact path）；
   - Binding；
7. 验证 child cwd 为 exact historical path（`child cwd / DSH_PRIMARY_WORKSPACE`）；
8. 执行 Workspace V3 固定 reversible functional canary（V3 CTR-OW-009 机械化：
   `CANARY_FILE_PATH = .agent-core-workspace-reuse-v3-canary.txt` 前置不存在（已存在则
   `FAIL_LOUD` 不覆盖）、exclusive create、内容恰为
   `AGENT_CORE_WORKSPACE_REUSE_V3_CANARY`、读回验证、删除、
   `PRE_CANARY_GIT_STATUS_DIGEST == POST_CANARY_GIT_STATUS_DIGEST`
   （`sha256(git status --porcelain=v1 -z)`）、`FILE_EXISTS_AFTER_CANARY = NO`；非 Git
   repo 用等价固定 metadata snapshot，不得伪造 Git status PASS）；
9. 从原飞书 conversation 发真实 basic reply（走恢复后的 exact Binding 与 basic runtime
   path；mock、manual bearer、direct service call、alternate Agent、Grant-dependent reply
   不是证据；执行前可 verify-only 检查 Credential readiness，见 §5）；
10. exact rerun = `NOOP`（零重复身份、零新 secret、零 overwrite、零 unrelated mutation）。

必须返回（值由 plan/evidence 产生，不得人工填写 path 值）：

```text
BUILD_IN_PUBLIC_PRIMARY_WORKSPACE_READY = YES
BUILD_IN_PUBLIC_EXACT_WORKSPACE_PATH = <exact value frozen in immutable cutover plan>
BUILD_IN_PUBLIC_BINDING_READY = YES
BUILD_IN_PUBLIC_RUNTIME_VISIBLE = YES
BUILD_IN_PUBLIC_REAL_FEISHU_BASIC_REPLY = PASS
```

任一项 FAIL → STOP；剩余 85 个 Agent 不得推进。

## 9. Binding restoration and conflict preservation

Fleet 阶段每个 exact row 的 Binding 恢复沿用 §8 step 4 语义：只恢复 immutable-plan 中
proven exact `OLD_ONLY` 的 row；保留 exact channel conversation key 与 exact `agent_id`；
`Binding.workspace = null`；任何 historical/external Workspace path 不得写入 Binding。

继续保留并禁止触碰（冻结，不得因本修订丢失——对齐 V3 CTR-OW-006）：

```text
feishu:oc_92332c45c1cac2ef89857abfee8ed762
feishu:oc_9dd74b9ed02ce216951260a381eb502d

CONFLICTING_BINDING_COUNT = 2
CONFLICTING_BINDING_OVERWRITE = FORBIDDEN
CONFLICTING_BINDING_DELETE = FORBIDDEN
CONFLICTING_BINDING_REASSIGN = FORBIDDEN
CONFLICTING_BINDING_AUTO_REPAIR = FORBIDDEN
CONFLICTING_BINDING_FALLBACK = FORBIDDEN
CONFLICTING_BINDINGS_CHANGED = 0
```

No auto-overwrite, delete, reassign, merge, or fallback. These two exact keys MUST NOT enter the
exact `OLD_ONLY` restoration set — they are excluded from Binding restore, not members of the
exact plan — and they are not allowed to widen or weaken that plan.

## 10. Fleet rollout

Build in Public canary PASS 后，**先审计、再扩剩余 85**：

```text
1 canary
→ audit（独立 接管 审计 对 §8 全部返回值的复核）
→ 85 fleet（bounded reviewed order，逐 row 同一套 §8 语义与 fail-loud gates）
```

不得要求所有 86 同时首发；不得并行 canary。最终验收：

```text
PRIMARY_WORKSPACE_READY_COUNT = 86
BINDING_READY_COUNT = 86
REAL_FEISHU_BASIC_REPLY_PASS_COUNT = 86
EXACT_RERUN_RESULT = NOOP
```

`PRIMARY_WORKSPACE_READY` 仅当该 row 的 Definition 存在（verify-only）、mapping 原子写入
且 `resolveWorkspace(agentId)` 解析为 exact path、child cwd 为 exact path、V3 functional
canary PASS 时成立；Unknown/partial outcome 永不计 ready。

## 11. Runtime ownership

冻结（对齐 V3 CTR-OW-005 的 runtime writer 口径）：

```text
HISTORICAL_OPENCLAW_RUNTIME_WRITER_COUNT = 0
AGENT_CORE_AUTOMATED_RUNTIME_WRITER = at most 1 active generation per Agent
OWNER_INTERACTIVE_WRITES = ALLOWED
```

- 不得重新启动 historical OpenClaw runtime；接管前必须证明
  `HISTORICAL_OPENCLAW_RUNTIME_RUNNING = NO` 且
  `HISTORICAL_OPENCLAW_RUNTIME_WRITER_COUNT = 0`，否则 `FAIL_LOUD` 不接管；
- 检测到旧 runtime 的自动 writer 或未知自动 writer：`FAIL_LOUD`；
- 不得把 Owner 的 Finder / IDE / Git / shell / 手工编辑误判为第二个 Agent Runtime——
  它们永远允许、永不触发 `FAIL_LOUD`；Owner 与 Agent 的并发编辑遵循普通
  filesystem / Git 语义，本 Spec 不自动解决冲突、不声称解决；
- 结合 §6：exactly one production Runtime active（`authsvc`）、auto-bind 关闭、
  每 row 只来自 exact reviewed plan；任一不满足 →
  `BINDING_WRITES = 0`、`RESULT = FAIL_LOUD`。

## 12. Out of scope

明确保持 OUT_OF_SCOPE（对齐 V3 CTR-OW-007 及既有 authority lines）：

```text
OPENCLAW_SESSION_TRANSCRIPT_IMPORT = OUT_OF_SCOPE
OPENCLAW_RUNTIME_STATE_REUSE = FORBIDDEN
SCHEDULER_280_JOBS_MIGRATION_OR_ENABLE = OUT_OF_SCOPE
CATCH_UP = OUT_OF_SCOPE
PROVIDER_FALLBACK = OUT_OF_SCOPE
GLM_LUNA_ROUTE = OUT_OF_SCOPE
NOTIFICATION_IMPLEMENTATION = OUT_OF_SCOPE
SCHEDULER_V2_IMPLEMENTATION = OUT_OF_SCOPE
```

Scheduler 侧沿 `SCHEDULER_OCCURRENCE_OUTCOME_V2` 既有 authority line；本 Spec 不新增、
不启用任何 scheduler job。

## 13. Staging, drift, recovery, and NOOP

A future implementation-authorizing child/runbook may not weaken this stage order:

1. `PLAN_READ_ONLY`: verify exact roster/digests、V3 authority coordinates、Definition
   verify-only facts（§3）、per-Agent immutable cutover plan 五字段（§4）、exact Binding
   plan、Runtime invariants（§11）、zero conflicts。此阶段同时冻结全部 86 个
   `historical_workspace_absolute_path` 的 inventory 证据来源。
2. `CANARY`: apply only Build in Public（§7–§8）。
3. `CANARY_AUDIT`: independent `接管 审计` 复核 §8 返回值。
4. `FLEET`: apply remaining 85 in bounded order（§9–§10）。
5. `RERUN`: exact reviewed rerun must be `NOOP`。

Every stage revalidates exact immutable inputs and source identities. Unknown/partial outcome
stops forward mutation and reports the last known checkpoint. Recovery is forward-only/
no-clobber control-plane rollback（V3 CTR-OW-010 四项恢复 + 停止自动化使用）: must not
delete pre-existing Trusted state, move/restore Workspace files（文件从未迁移）,
reactivate old Runtime, auto-fix a conflicting Binding, copy a legacy credential, or create a
replacement identity。

## 14. Acceptance requirements for this proposed revision

Independent `接管 审计` must verify at least:

1. frontmatter remains `status: proposed` and `implementation_authority: none`;
2. authority graph：V3 accepted revision `f02691c…`（merge `6ec83fa…`）是 sole current
   Workspace authority 且被本 Spec 依赖；V2 `261a80e…` superseded 且其语义不再被引用；
   credential spec `d83a2ff…` accepted 但角色 = EXTERNAL_PARALLEL_LINE；`5d12851…`
   remains REVIEWED_SEMANTIC_PROVENANCE_ONLY（MAIN_ANCESTOR = NO）；无 blanket
   all-ancestors 陈述；
3. §2 删除清单完整：replacement Trusted Workspace、historical source-only、curated
   import、五个 persona 文件限制、manifest-selected copy、extension allowlist、subtree
   allowlist、copy 后新 authority、Workspace 文件迁移、symlink/hardlink 重写、file
   mode/executable bit 变更——全部不再以任何形式出现；替换语义
   （DIRECT_ADOPT_IN_PLACE/ZERO_COPY/PATH_AUTHORITY/PATH_SCHEMA/
   AGENT_DEFINITION_WORKSPACE_PATH_FIELD=FORBIDDEN/Binding.workspace=null/解析链）与 V3
   一致；
4. exact §4 roster count is 86, unique, digest-matches, and includes the canary; per-Agent
   immutable plan 五字段在场且 path 来源 = frozen inventory（无猜测、无 default
   fallback）；
5. §3 inventory digests match；`FINAL_AGENT_DEFINITION_COUNT = 91`、
   `EXACT_86_DEFINITIONS_PRESENT = YES`、`EXACT_86_PRESENT = REQUIRED`、
   `UNRELATED_DEFINITIONS_PRESERVED = REQUIRED` 在场；Definition verify-only 边界完整
   （不创建/删除/重命名/改 schema/写 path/为凑数删 unrelated）；`agt_cto-agent` 排除但
   保留；
6. auth boundary：`AUTH_PHASE_A = EXTERNAL_PARALLEL_LINE`、
   `WORKSPACE_PHASE_BLOCKED_BY_AUTH = NO`；六类对象（Principal/Client/Credential/
   Receipt/Workflow Grant/Forum Grant）零变更；Definition/Credential/Grant missing 均非
   blocker；Credential readiness 只作为真实回复前的可选 verify；
7. canary pin：`agt_build-in-public-agent` +
   `feishu:oc_95bd40ab17712fe0f3a7cf7eb6f4e24a`；Binding.workspace=null；无手写 path 值；
8. §8 十步 transaction 与五个 `BUILD_IN_PUBLIC_*` 返回值完整，V3 CTR-OW-009 functional
   canary 机械化在场；
9. 两个 conflicting binding keys 以完整未截断形式冻结，五项 FORBIDDEN
   `CONFLICTING_BINDINGS_CHANGED = 0` 在场，且两个 key 不进入 `OLD_ONLY` 恢复集；
10. rollout 顺序为 1 canary → audit → 85 fleet；最终计数
    `PRIMARY_WORKSPACE_READY_COUNT = 86`、`BINDING_READY_COUNT = 86`、
    `REAL_FEISHU_BASIC_REPLY_PASS_COUNT = 86`、`EXACT_RERUN_RESULT = NOOP`；
11. runtime ownership：`HISTORICAL_OPENCLAW_RUNTIME_WRITER_COUNT = 0`、
    `AGENT_CORE_AUTOMATED_RUNTIME_WRITER = at most 1 active generation per Agent`、
    `OWNER_INTERACTIVE_WRITES = ALLOWED`；Owner interactive 工具不算第二 runtime；
    historical OpenClaw runtime 不重启；
12. §12 OUT_OF_SCOPE 清单完整（transcript import、runtime state reuse、280 scheduler
    jobs、catch-up、provider fallback、GLM/Luna route、Notification implementation、
    Scheduler V2 implementation）；
13. the cumulative PR diff（含 merge commit 带入的 main 文件之外）的 business 改动仅为
    本 Spec 文件；docs-only；无 implementation、acceptance、merge、production apply。

Failure of any item returns `FIX_REQUIRED`; it does not authorize an apply.

## 15. Fixed review handoff

```text
PREVIOUS_HEAD = 30ae0f5d9f5f87c0fefda933c04e4e549af0f0f7
CURRENT_MAIN_MERGED = 6ec83fa7ef0565959f26c7112de423bf5aa65680 (ordinary merge commit; no rebase, no force-push)
NEW_HEAD = <commit created by this docs-only revision>

WORKSPACE_AUTHORITY = AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3
WORKSPACE_AUTHORITY_ACCEPTED_REVISION = f02691c6e31ac60dd673f7846742e8d4c2029abf
DIRECT_ADOPT_IN_PLACE = REQUIRED
ZERO_COPY = REQUIRED
DEFINITION_MODE = VERIFY_ONLY
PATH_AUTHORITY = primary-workspaces.json
BINDING_WORKSPACE = null

CANARY_AGENT = agt_build-in-public-agent
CANARY_BINDING_KEY = feishu:oc_95bd40ab17712fe0f3a7cf7eb6f4e24a

EXACT_86_FROZEN = YES
INVENTORY_DIGEST_PINNED = YES
FINAL_AGENT_DEFINITION_COUNT = 91
EXACT_86_DEFINITIONS_PRESENT = YES

AUTH_LINE = EXTERNAL_PARALLEL
CONFLICT_BINDING_KEYS_FROZEN = YES
RUNTIME_WRITER_SEMANTICS = V3 (CTR-OW-005)

PRIMARY_WORKSPACE_READY_COUNT_TARGET = 86
BINDING_READY_COUNT_TARGET = 86
REAL_FEISHU_BASIC_REPLY_PASS_COUNT_TARGET = 86
EXACT_RERUN_RESULT = NOOP

READY_FOR_INDEPENDENT_REVIEW = YES
IMPLEMENTATION_AUTHORIZED_NOW = NO
PRODUCTION_CHANGE = NONE
AUTH_CHANGE = NONE
AGENTS_JSON_CHANGE = NONE
PRIMARY_WORKSPACES_CHANGE = NONE
BINDING_CHANGE = NONE
RUNTIME_RELOAD = NO
WORKSPACE_FILE_CHANGE = NONE
SCHEDULER_CHANGE = NONE
NEXT_TASK = 接管 审计
```

## 16. Acceptance-finalize record

```text
STATUS_AFTER_ACCEPTANCE = accepted
ACCEPTED_BY = mayf3
REVIEWED_SPEC_COMMIT = eb2189c088d12613a1ba0b55ec59037c62110d07
REVIEWED_SPEC_BLOB = 2078a11c2467aeb0bdb5b9e2abe6f8ac033da089
PREVIOUS_REVIEWED_BASE = 6ec83fa7ef0565959f26c7112de423bf5aa65680
CURRENT_REVIEWED_BASE = 0fced5bbcc4287eb20ef5f54979ccd8ef31716e8
PRIMARY_REVIEW = 接管 审计 = PASS
CURRENT_BASE_REVIEW = 漂移 审计 = PASS
REQUIRED_FIXES = NONE
SEMANTIC_DELTA_AFTER_REVIEW = NONE
ACCEPTANCE_DELTA_CLASS = LIFECYCLE_ONLY
SYNC_MERGE = YES (ordinary merge commit of current main; SPEC_BLOB_CHANGED_BY_SYNC = NO)
CHANGED_FILES = docs/specs/AGENT_TRUSTED_FLEET_CUTOVER_V1.md only
IMPLEMENTATION_AUTHORITY_AFTER_ACCEPTANCE = none
PRODUCTION_APPLY_AUTHORITY_AFTER_ACCEPTANCE = none
IMPLEMENTATION_AUTHORIZED_NOW = NO
PRODUCTION_APPLY_AUTHORIZED_NOW = NO
STILL_REQUIRED_BEFORE_PRODUCTION = PR merged into main + immutable mapping/runbook + independent runbook audit + explicit production approval + Build in Public first canary
NEXT_TASK = 采纳 审计
```
