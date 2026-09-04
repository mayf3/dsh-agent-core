---
spec_id: AGENT_CORE_WORKFLOW_EXECUTE_UNIFIED_DEPLOYMENT_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: contracts
date: 2026-09-02
type: implementation-spec (production deployment authority proposal; docs-only authoring round)
scope:
  - mayf3/dsh-agent-core
  - production Broker WORKFLOW_EXECUTE_UNIFIED_WRITE_TOOL 部署授权（恰好两个 runtime 文件：packages/broker/src/capabilities/workflow.js + packages/broker/src/registry.js）
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1
  - AGENT_CORE_WORKFLOW_TRANSITION_PINNED_HOTFIX_DEPLOYMENT_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_WORKFLOW_EXECUTE_UNIFIED_DEPLOYMENT_V1

> **ACCEPTED（2026-09-02，工具 部署 接受 lifecycle flip）。** 独立审计（工具
> 部署 审计）= PASS / BLOCKERS = NONE / AMENDMENT_VALID = YES（8 项 checklist
> 全过：blob pins 实测一致、preimage 分支有 accepted authority 实据、
> CTR-HD 引用逐条核对、fail-closed 完备、E2E 条款紧凑、lifecycle 合规、
> 机械验证干净、无偷偷扩权）。本 acceptance 为 lifecycle-only：normative
> 正文 byte-preserved，`status proposed -> accepted`，
> `implementation_authority: none -> contracts`，
> `production_apply_authority: none -> contracts`；执行轮另须 artifact 审计
> 与 Owner Gate。完整记录见 §10。

> **PROPOSED / NOT ACCEPTED（2026-09-02，工具 部署 authoring 轮，历史）。** 本文件是
> `workflow_execute` 统一写工具（GOAL
> `WORKFLOW_EXECUTE_UNIFIED_WRITE_ENTRY_SHIP_V1`）的生产部署 **deployment
> Authority 提案**。本轮 **docs-only**：不构建制品、不写生产目录、不 sudo、
> 不重启服务、不修改 Grant、不修改 svc-workflow / auth-service、不修改
> Broker 产品代码、不执行任何生产事务。

## 1. Goal

把已 accepted 的能力裁决（`AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1`
§21/§22，DEC-010/CTR-010/CTR-011，实现已 merge @ main `a7e732f` PR #142）
安全部署到生产 Broker：模型工具面从 `workflow_transition` 单写工具一次性切换为
唯一统一写工具 `workflow_execute`（operations 恰为 `create_instance` +
`transition`），并保留等面回滚能力。

** 为什么需要本 Authority（边界审计结论）**：既有 accepted 部署 authorities
无一覆盖本次工具面替换——`…PINNED_HOTFIX_DEPLOYMENT_V1` CTR-HD-002 冻结
`RELEASE_FEATURE_SET = workflow_transition only` 并明示任何能力组合「MUST 另建
新的发布 Authority」；CTR-HD-003 单文件 allowlist 排除 `registry.js`；
CTR-HD-004/009 blob pins 与 CTR-HD-005 post-deploy 证明面（要求
`workflow_transition` 在 catalog）与本次
`WORKFLOW_TRANSITION_STANDALONE_VISIBLE = NO` 直接矛盾；`…DEPLOYMENT_RECOVERY_V1`
是事故恢复 authority（闭集 `.env` + 同一 workflow.js），非前向发布通道；
`registry.js` 此前从未被任何 accepted authority 授权为生产可写路径。

## 2. Frozen release coordinates

- `RELEASE_SOURCE_COMMIT` = `a7e732f`（github/main merge PR #142；
  branch `feat/workflow-execute-unified-write-tool-v1` head `310d4a1` 的
  merge commit）。制品构建 MUST 从该 commit 的 detached clean worktree 进行。
- `RELEASE_FEATURE_SET` = workflow_execute unified write tool（DEC-010）：
  operations 恰为 `create_instance` + `transition`；`workflow_transition` 在
  同一次切换中退出模型工具面，不得并存（ capability spec §21 冻结语义）。
- Broker 测试基线（pinned commit 实测，执行轮须 re-run 复核）：309/309 PASS；
  `verify:structure` PASS（base `4318be3` head `310d4a1`，0 violations）。

## 3. Deployment unit（CTR-UD-001，恰为两个 runtime 文件）

| repo path | production path | TARGET_GIT_BLOB (a7e732f) | bytes | EXPECTED_PREIMAGE_GIT_BLOB（2026-09-02 fresh read-only 实测） |
|---|---|---|---|---|
| `packages/broker/src/capabilities/workflow.js` | `/usr/local/libexec/agent-core/app/packages/broker/src/capabilities/workflow.js` | `db7688fe1cc428aa1260e1372920ff744a076013` | 25211 | `577c8778cf35810ce7538aff52ab354e0c1dddc6`（transition hotfix 在位，live `git hash-object` 2026-09-02 实测一致） |
| `packages/broker/src/registry.js` | `/usr/local/libexec/agent-core/app/packages/broker/src/registry.js` | `2f5e55b772e25093b7fec480a76fe47d6993b860` | 9382 | `7cd71350226ebe63bada5bbfa1372fabd81585ee`（combined-deploy 时代 blob，live 实测一致） |

- `DEPLOYMENT_PATH_ALLOWLIST` = 恰为上表两个 production path。部署面 MUST
  恰为 allowlist 中的两个文件；MUST NOT 部署、触碰、删除任何其他生产文件
  （`DEPLOYMENT_SCOPE = EXACTLY_TWO_RUNTIME_FILES`）。
- 权属策略保持 root:wheel 0644（与 live 现状一致）。
- **preimage 分支语义**：期望 preimage 如上表。若执行轮 fresh preflight 发现
  live workflow.js = `04ca8550…`（recovery authority 的
  `ROLLBACK_TO_FROZEN_PREIMAGE` terminal 已执行）或任何其他值 →
  `DEPLOYMENT = STOPPED`，MUST NOT 就地改 pin；须回到本 Spec 修订轮重新
  冻结坐标。registry.js preimage 任何非 `7cd71350…` 值 → 同样 STOPPED。
- **漂移与意外文件**：执行轮 fresh preflight 若发现 allowlist 两路径之外任何
  broker 相关生产文件与预期基线不符、或两路径带非预期 ACL/xattr 内容差异 →
  STOPPED（安全加固清单 CTR-UD-005 承接 CTR-HD-009 全部机械纪律）。

## 4. Rollback（CTR-UD-002，等面两文件回滚）

- 制品轮 MUST 同时产出 equal-face rollback bundle：两文件的 exact preimage
  bytes + owner/group/mode/mtime/ACL/xattr 元数据（PREIMAGE_META），以及
  可从 bundle tar 直接恢复的 rollback tar。`ROLLBACK_MATCHES_DEPLOYMENT_SCOPE
  = REQUIRED`（回滚恰恢复两文件，不多不少）。
- 回滚触发：部署后两文件 read-back 任一 ≠ target blob、runtime read-back
  失败、或部署后证明面（§5）任一 YES/NO 断言失败。
- 回滚执行含单次 exact `launchctl kickstart system/ai.agent-core.runtime`；
  回滚后 read-back MUST 等于 preimage blobs。

## 5. Post-deploy proof surface（CTR-UD-003，全部只读）

部署成功的唯一判定面（与 capability spec §21 冻结断言一致）：

- `WORKFLOW_EXECUTE_VISIBLE = YES`
- `WORKFLOW_EXECUTE_OPERATIONS = [create_instance, transition]`
- `WORKFLOW_EXECUTE_CREATE_INSTANCE_CALLABLE = YES`
- `WORKFLOW_EXECUTE_TRANSITION_CALLABLE = YES`
- `WORKFLOW_TRANSITION_STANDALONE_VISIBLE = NO`
- 两文件 runtime read-back == TARGET blobs；production catalog/inventory
  read-back 一致
- `GRANT_CHANGED = NO`；`CREDENTIAL_CHANGED = NO`；
  `UNRELATED_PRODUCTION_MUTATION = NONE`（allowlist 外全部生产文件 byte-level
  不变）
- runtime health PASS（具体 health surface 以执行轮 fresh preflight 冻结为准；
  不得以本轮文档中的端口/服务名假设替代 fresh 核实）

## 6. Dedicated E2E authorization（CTR-UD-004）

本 Authority 授权且仅授权以下一个 E2E 事务（部署成功后立即执行）：

- 经真实生产 broker 工具面执行
  `workflow_execute(operation="create_instance", ...)` 于 **disposable 测试
  fixture domain/definition**（不污染真实业务 Workflow），断言 initial
  `workflowStateVersion = 1`、entry node visit、`eventSequence = 1`、
  服务端 assignee 解析、trusted Idempotency-Key、无重复 create；
- 随后对该 fixture 执行恰好一次
  `workflow_execute(operation="transition", ...)`，断言 V→V+1 exactly once、
  no retry、no duplicate、event/receipt/audit 完整；
- `WORKFLOW_EXECUTE_CREATE_INSTANCE_E2E / TRANSITION_E2E / EXACTLY_ONCE = PASS`
  后本轮终止，fixture 可保留为审计证据。

授权依据：Owner fleet-open write ruling（commit `fe1bed8`，governing Owner
ruling）+ GOAL dispatch §10 明令。本条不重开 CTR-009 canary 闸门设计
（写闸门已由该 ruling Owner-direct 打开），亦不授权任何真实业务数据的 create
或 transition。

## 7. Machinery and roles（CTR-UD-005）

- 复用 `…PINNED_HOTFIX_DEPLOYMENT_V1` 已验证的部署机制，按引用继承：
  CTR-HD-006 的 build → artifact audit → Owner execution → deployment audit
  四角色链（Author 与 Reviewer 独立；生产写事务串行）；CTR-HD-009 的九步
  safe-deploy 加固清单（user-side + root-side 双 hash、`sudo install` 非 cp、
  root-owned 0700 同盘 staging、safe-archive allowlist、exact preimage gate、
  temp+rename 原子替换、单次 exact kickstart、read-back 链、失败→preimage
  恢复 + 二次重启）全部适用于本两文件闭包（单文件条目按两文件等比展开）。
- 旧制品（含 `67e5e183…` / `fe290f9f…` transition tars）REJECTED for reuse：
  本轮制品 MUST 从 `RELEASE_SOURCE_COMMIT` 全新构建（CTR-REC-016 同纪律）。
- 执行链 Gate：candidate → 本 Authority 下独立 artifact 审计 → Owner
  Gate（`/usr/bin/osascript` macOS 原生管理员授权，Owner 只在系统弹窗认证，
  不得要求聊天提供密码）→ 执行 → deployment audit。
- CTR-HD-011 retirement：本部署成功执行即构成 transition hotfix 的 retirement
  record（`HOTFIX_RETIRED_BY = 本 spec 执行轮`；在该 Spec 文件 byte-unchanged
  前提下，由本 Spec 继承其机制并替代其活跃部署面）。

## 8. Non-goals and boundaries

- 不授权 Grant 变更、credential 变更、svc-workflow / auth-service 任何改动；
- 不授权本两文件之外的任何生产写入；不授权 workflow_query / read tools 收敛 /
  Forum / Scheduler / assign-cancel-archive（FOLLOW_UP_DEBT）；
- 不修改任何既有 Spec 文件（含 `…PINNED_HOTFIX_DEPLOYMENT_V1`）；
- 本 Spec acceptance（lifecycle flip）不等于执行授权完成——执行轮还须完成
  §7 的 artifact 审计与 Owner Gate。

## 9. Acceptance scheme

Authoring（本轮）：`status: proposed`，`implementation_authority: none`，
`production_apply_authority: none`。独立审计（工具 部署 审计）PASS 后，
lifecycle acceptance 轮以 ONE-commit ONE-file 语义执行
`status: proposed -> accepted` + `production_apply_authority: none ->
contracts`（`implementation_authority` 同步 `none -> contracts`），provenance
字段写入 acceptance record；正文 normative bytes byte-preserved。

## 10. Acceptance record (2026-09-02, 工具 部署 接受)

- 事务：TASK_NAME = 工具 部署 接受，TASK_TYPE = ACCEPTANCE_FINALIZE（lifecycle
  flip）；对象 = 本 Spec authoring 轮 commit `a8bbdd6`（parent = main
  `a7e732f`）。
- 独立审计（工具 部署 审计）= **PASS**；BLOCKERS = NONE。8 项 checklist：
  (1) TARGET blobs / bytes / RELEASE_SOURCE_COMMIT 实测一致（a7e732f =
  origin/main tip；310d4a1 为其祖先）；(2) preimage 分支实据成立——
  577c8778 = PINNED_HOTFIX line 388 EXPECTED_TARGET_GIT_BLOB（f4bc431 内容
  实测该 blob），04ca8550 = line 389 EXPECTED_PRODUCTION_PREIMAGE_BLOB 且为
  recovery FROZEN_PREIMAGE，registry.js 7cd71350 = 2392a41 实测；main 态
  workflow.js blob 83df50eb 与生产态 577c8778 的差异由 CTR-HD-007 无关漂移
  政策覆盖，不构成本 Spec 瑕疵；(3) 对 PINNED_HOTFIX 的 CTR-HD 引用逐条
  核对准确，零既有 Spec 文件改动，README 纯追加；(4) fail-closed 完备
  （preimage mismatch / allowlist 外漂移 → STOPPED，回滚触发面完整，证明面
  为 capability spec §21 断言的严格超集）；(5) CTR-UD-004 E2E 条款紧凑
  （disposable fixture、恰好一次 transition、fe1bed8 Owner ruling +
  GOAL dispatch §10 授权依据、不重开 CTR-009）；(6) lifecycle 形态与
  PINNED_HOTFIX CTR-HD-001 先例一致；(7) 机械验证干净（2 文件、170
  insertions / 0 deletions、diff --check、frontmatter YAML 解析）；(8) 无
  偷偷扩权。
- Lifecycle flip（本 commit，single-commit）：`status: proposed -> accepted`；
  `implementation_authority: none -> contracts`；
  `production_apply_authority: none -> contracts`。normative 正文
  byte-preserved（flip 触及 frontmatter 三字段 + 头部 banner + 本节）。
- FOLLOW_UP_DEBT（审计记录，非阻断）：GOAL §10 文本入执行轮 evidence 存档；
  fe1bed8 不在 main lineage（PR #137 proposed）——执行轮 evidence 须 pin 其
  commit/PR provenance；CTR-HD-011 successor 措辞早于 DEC-010——retirement
  record 须写明 transition 能力经 `workflow_execute` transition operation
  交付；CTR-HD-008 须由 artifact 审计轮显式点名。
- 边界：DOCS_ONLY；无制品、无生产写入、无 sudo、无 Grant 变更。
  PRODUCT_CODE_CHANGE = NONE；GRANT_CHANGE = NONE；PRODUCTION_CHANGE = NONE。
- Merge：本 commit 经单一 PR merge 至 main。
