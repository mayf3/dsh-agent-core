---
spec_id: DEPLOYMENT_RUNTIME_CLOSURE_INVARIANTS_V1
status: proposal
date: 2026-09-24
spec_kind: governance-invariant
authority_level: candidate_governing_spec
implementation_authority: none
production_apply_authority: none
lane: DEPLOYMENT_RUNTIME_CLOSURE_INVARIANTS_V1_AUTHORITY_CLOSURE_NIGHT
base_main: 2ee6f477 (github/main, fresh-fetched 2026-09-24)
owners:
  - mayf3
independent_spec_review: DEPLOYMENT_RUNTIME_CLOSURE_INVARIANTS_V1_NIGHT_REVIEW_R1
independent_spec_review_result: REVISE→fixes absorbed→RECHECK PASS (R1: REVISE,
  LOAD_BEARING_GAPS=2, NON_BLOCKING=3 — 证据骨架与四 invariant 覆盖 PASS; 2 gaps = 可机械
  核查的 repo 状态断言失准 [DEPLOY_RECEIPT token 先例遗漏 / trusted-cp stamp 实现已部分
  落地误述为未实现] + mapping 表漏行。R1-recheck: PASS, RESIDUAL_GAPS=0 — gap-1/gap-2
  修复与行号断言（install.sh @2ee6f477 line 482 / 443-444 / 619 / 676；零 closure-manifest
  写盘）逐项机械核实准确，3 non-blocking 全部吸收，无新引入缺陷；proposal 可进入 Owner
  acceptance)
required_fixes: absorbed 2026-09-24 (gap-1 §0/§6 重写 DEPLOY_RECEIPT 先例与 mapping 补行;
  gap-2 §4.4 如实记录 trusted-cp-install.sh 部分落地现状并将 I2 定位为窄化 reuse 门升格;
  NB 悬空指针改指 AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1 §7; NB WORKFLOW_DATA_HYGIENE 类名
  引用移除; NB evidence 锚点补全 local-arm64/pdcp/hotstandby-report@53798600)
governed_by:
  - AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1 (accepted; artifact authority model / preflight)
references:
  # additive authorities — 本 spec 扩展其覆盖面，不重复、不改写其 normative body
  - docs/specs/TRUSTED_CP_DEPLOY_ARCH_CLOSURE_V2.md (accepted 2026-08-24; branch
    docs/trusted-cp-deploy-arch-closure-v2-spec @ 613a07a2; staging 部署门 G1-G12 +
    CTR-DEP-001..018 — staging-face authority of record)
  - docs/specs/AGENT_CORE_BACKUP_RETENTION_V1.md (accepted; on main; backup lifecycle authority)
  - docs/specs/PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1.md (accepted 2026-09-08 +
    AMENDMENT_1/2; branch goal/workflow-assignee-admission-guard-v1 @ 56972087 等;
    candidate seal / apply contract / 两值验收门先例)
  - docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V1.md (accepted 2026-09-24, on main;
    production_apply_authority: none — 非干扰对象)
  - docs/specs/AGENT_CORE_SCHEDULER_PRODUCTION_RECONCILIATION_V1.md (accepted, on main
    @2ee6f477; DEPLOY_RECEIPT.json production receipt 先例 — L1 词汇命名化来源)
  - scripts/trusted-cp-deploy-install.sh (on main @2ee6f477; TRUSTED_CP V2 实现**已部分
    落地**：source-stamp 写入 + 窄化 stamp-equality reuse 门在位；G2 manifest 写盘与
    LINK_TOPOLOGY 记录未落地 — 本 spec 的 I1/I2 升格对象)
evidence_authorities:
  - docs/investigations/trusted-cp-cross-arch-dependency-closure-v1.md (@8ca8b7aa)
  - docs/investigations/PRODUCTION_STAGE_ISOLATION_CENSUS_V1.md (@6d74a9b6)
  - docs/investigations/agent-core-backup-retention-v1-proposal.md (on main)
  - docs/evidence/deploy-9bb5b97-live-drift-v3-20260831 (@13ecf593)
  - docs/evidence/hotstandby-activation-v1-20260830 (@53798600)
  - docs/evidence/local-arm64-normalization-v1-20260907 (@28aacff0)
  - docs/evidence/fleet-eacces-p273-adoption-20260912 (primary checkout on-disk,
    UNCOMMITTED as of 2026-09-24 — 实现前置条件：evidence-only 入库)
  - docs/evidence/pdcp-release-valve-closure-v1-20260921 (on-disk UNCOMMITTED, 同上)
  - docs/evidence/v4-global-acceptance-20260924 (on-disk UNCOMMITTED, 同上)
  - docs/evidence/openai-codex-refresh-token-reused-v2-recurrence-20260920/A1_ARTIFACT_BUILD.md
    (on-disk UNCOMMITTED, 同上)
---

# DEPLOYMENT_RUNTIME_CLOSURE_INVARIANTS_V1（proposal）

> 性质：**governance/invariant Spec proposal**——冻结四个 runtime closure invariant，
> 本轮**不实现**。实现 authority 在 Owner acceptance 之前为 NONE。
> 划界声明：本 spec 只认领**installed/live runtime closure face**（已部署运行时的
> 闭包身份与只读性）+ 一条命名化的验收阶梯。staging 部署门机制属
> TRUSTED_CP_DEPLOY_ARCH_CLOSURE_V2；candidate seal/apply 属 PRODUCTION_STAGE_ISOLATION；
> backup lifecycle 属 AGENT_CORE_BACKUP_RETENTION_V1。四者均为 additive 引用，零改写。

## 0. 术语与诚实边界

- `RUNTIME_CLOSURE`：一个已部署、可运行的生产单元的完整闭包 = source tree identity +
  preserved dependencies（node-runtime / harness closure / 等价物）+ **workspace-link
  topology**（连接各 installed tree 的符号链接边，如 `app/node_modules/@deepseek-ai/* →
  harness/node_modules`、operator CLI link）+ runtime/package dependency identity
  （node version+arch、pnpm/packageManager pin、platform packages、native addon arch 集）。
- `DEPLOY_RECEIPT` / `DEPLOY_RECEIPT_PASS`：作为**验收阶梯词汇**为本 spec 新定义。字符串
  `DEPLOY_RECEIPT` 此前已存在于一处 production artifact 命名——`AGENT_CORE_SCHEDULER_
  PRODUCTION_RECONCILIATION_V1`（accepted, main @2ee6f477）落档的
  `/Users/Shared/agent-core-deployment-receipts/SCHED-20260904T054035Z-DEPLOY_RECEIPT.json`
  ——本 spec 把该既有 receipt 实践**命名化**为 L1 验收词汇，并映射到既有权威语义：
  CTR-DEP-012 的 `DEPLOY_SUCCESS` deploy-status 落档 + stage-isolation A1.2 的 apply
  receipt + scheduler reconciliation 的 DEPLOY_RECEIPT.json。§6 给出精确定义。
- `TREE_TOO_LARGE`：goal brief 提及的事件类；截至 2026-09-24 全仓库机械检索**零命中**。
  本 spec **不**基于该 phantom 构建任何不变量；若其指向 repo 外真实事件，须以
  `NEW_EVIDENCE` 按 `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1` §7（rejected-proposal reopen
  规则）重新引入。
- WEC = Workflow Execution Control（accepted 2026-09-24，非 "Execution Capture"）。
  本 spec 与 WEC surface 零交集（§9）。

## 1. Problem & incident model（evidence-anchored，不重新调查）

四个已证的空档，每个都对应真实生产事件类：

1. **Installed closure 无 standing identity**。live manifest 漂移（132-file digest
   `9ac84954…` vs 9bb5b97）只能靠事后三方重建调查发现（live-drift-v3）；生产 harness 曾
   以 117-file dirty 安装 + `.source-stamp` 缺失运行（hotstandby-activation GATE-5 根因）。
   现有 G2 closure-manifest（CTR-DEP-002）是 **staging install 时**生成、随 backup 留档——
   没有 spec 要求 **installed/live tree 上的身份可被 standing 重建与比对**，且 link
   topology 不是任何 manifest 的 required 字段。
2. **Preserved dependency closure 的 reuse 无兼容门**。Step 1b 曾把刚建成的 backup 的
   `harness/`/`node-runtime/` mv 出去复用（掏空 rollback 件，backup-retention proposal
   根因）；跨 arch pnpm 进程按 operator PATH 变化产出不同闭包、optional native binding
   被静默过滤（trusted-cp-cross-arch 根因）；`.source-stamp` 缺失使静默 reuse 失效 →
   全量重装，每次部署重新武装故障窗口。CTR-DEP-011 已把"stamp 缺失 → 静默 reuse 失效"
   转为 loud，但 reuse 的**决策规则**（何时允许复用、按什么身份比较）从未被冻结。
3. **Production provisioning 曾修复性改写 root-owned dependency topology**。ensure-symlink
   对 realpath-equivalent links 做 rmSync+symlinkSync 重写 → EACCES（fleet P273）。
   2026-09-12 永久修复（接受等价链接不重写）+ 区分性单测已 adoption，但该**类不变量**
   无 accepted spec：无 spec 冻结"provisioning 对已正确的 root-owned topology 必须收敛
   为零写入"。census 亦证明 symlink-to-dev-tree 曾让 production CLI 执行 dev dirty bytes
   （该面由 stage-isolation/SB4 收口，本 spec 不重复）。
4. **验收分层已实践、未命名**。CTR-DEP-012（install ≠ deploy）、CTR-DEP-013（health ≠
   child availability）、stage-isolation AMENDMENT_2（fixture E2E ≠ adopted production
   proof）、scheduler reconciliation 的 DEPLOY_RECEIPT.json（post-apply production
   receipt 先例）、v4-global-acceptance（BYTES_DEPLOYED=YES 而唯一剩余 gate 是 production
   business acceptance）各自冻结了一条边，但各状态从未被组成一个**命名阶梯**，
   `DEPLOY_RECEIPT_PASS ≠ RUNTIME_CLOSURE_ACCEPTED ≠ BUSINESS_ACCEPTED` 的逐对不等
   与逐层证据要求没有 single authority。pdcp-release-valve-closure 另证明了 receipt
   纪律的必要性边界：「root capture dir 存在」≠「可执行/验收字节可恢复」——receipt
   必须落**可执行字节身份**，而非仅记录制品目录存在。

## 2. Invariants（本 spec 冻结的全部内容）

| # | Invariant | Required value |
|---|---|---|
| I1 | RUNTIME_CLOSURE_MANIFEST_PRESENT | YES（每个 production runtime face） |
| I1a | LINK_TOPOLOGY_RECORDED | REQUIRED manifest 字段（现无任何 manifest 含它） |
| I1b | INSTALLED_IDENTITY_RECOMPUTABLE | YES（installed/live tree 上可 standing 重建比对） |
| I1c | MANIFEST_SECRET_BYTES | NONE（与 stage-isolation §4 同纪律） |
| I2 | DEPENDENCY_REUSE_DECIDED_BY | recorded closure identity ↔ required topology identity 比较 |
| I2a | BLIND_REUSE | FORBIDDEN（任何非身份比较驱动的 reuse） |
| I2b | REUSE_SOURCE_MUTATION | FORBIDDEN（= CTR-DEP-010 copy-not-mv，引用不重复） |
| I2c | IDENTITY_MISMATCH_OUTCOME | fresh materialization 或 loud fail；禁止 silent reuse |
| I3 | REQUIRED_BRIDGE_BEFORE_TRAFFIC | VERIFIED_EXIST（startup/business traffic 之前） |
| I3a | MISSING_BRIDGE_OUTCOME | FAIL_FAST（不 boot / 不放行 traffic），禁止 in-traffic repair |
| I3b | PROVISIONING_ON_CORRECT_TOPOLOGY | CONVERGED_ZERO_WRITE（含 realpath-equivalent links 不重写） |
| I3c | ROOT_OWNED_TOPOLOGY_REPAIR | AUTHORIZED_MAINTENANCE_ONLY（部署窗口/显式授权，非顺手修） |
| I4 | ACCEPTANCE_LADDER | `DEPLOY_RECEIPT_PASS ≠ RUNTIME_CLOSURE_ACCEPTED ≠ BUSINESS_ACCEPTED`（逐对不等） |
| I4a | LAYER_IMPLICATION | 任一层 PASS 从不蕴含更高层 PASS |
| I4b | LAYER_EVIDENCE | 逐层独立落档；高层无证据而宣称 = misdeclaration（评审必拒） |

Restated as review questions（实现后必须全部可机械回答 NO）：

- CAN_INSTALLED_RUNTIME_BE_SERVED_WITHOUT_RECOMPUTABLE_CLOSURE_IDENTITY = NO
- CAN_LINK_TOPOLOGY_DRIFT_GO_UNDETECTED_BY_THE_CLOSURE_GATE = NO
- CAN_PRESERVED_DEPENDENCY_CLOSURE_BE_REUSED_WITHOUT_IDENTITY_COMPARISON = NO
- CAN_REUSE_SILENTLY_SUCCEED_ON_IDENTITY_MISMATCH = NO
- CAN_REUSE_MUTATE_THE_CLOSURE_IT_REUSES_FROM = NO
- CAN_BUSINESS_TRAFFIC_START_WITH_A_REQUIRED_BRIDGE_MISSING = NO
- CAN_PROVISIONING_REWRITE_AN_ALREADY_CORRECT_ROOT_OWNED_LINK = NO
- CAN_A_HIGHER_ACCEPTANCE_LAYER_BE_DECLARED_WITHOUT_ITS_OWN_EVIDENCE = NO

## 3. I1 — Runtime Closure Manifest

任何 production runtime face（现 trusted-cp install；未来 stage-isolation generation apply
的各 surface）MUST 具备一份 runtime closure manifest，**至少**包含：

```text
SOURCE_IDENTITY        # app source commit + tree state（= CTR-DEP-011 source stamp 语义）
PRESERVED_DEPENDENCIES # node-runtime / harness closure 等的 identity（= CTR-DEP-002 字段超集）
LINK_TOPOLOGY          # 每条 workspace-link：{link_path, resolved_target, target_identity,
                       #   link_kind(symlink|copy|hardlink), creation_contract}
RUNTIME_IDENTITY       # node version+arch / pnpm+packageManager pin / platform packages /
                       #   native addon arch 集（= CTR-DEP-002/015 既有字段，引用）
MANIFEST_DIGEST        # manifest 自身 sha256；随闭包/backup 留档
```

规则：

1. **Additive，不重复**：CTR-DEP-002 `harness/.closure-manifest.json` 的既有字段与其
   G2 gate 语义原样有效；本 spec 新增的 required 组件只有 **LINK_TOPOLOGY**（census 的
   `DEPENDENCY_INSTALL_LOCATION` 与 hotstandby 激活的"绝对 symlink 机械重定向 + 无残留
   断言"——`docs/reports/agt-cto-hotstandby-activation-v1.md` @53798600，该 report 已自
   现 main 移除、以 commit 锚点解析——证明它是真实 load-bearing 面，却从未进 manifest）。
2. **Standing recomputability（I1b）**：installed/live tree 上的闭包身份 MUST 可被
   重新计算并与记录比对（live-drift-v3 的 132-file recompute 证明了机械可行性；本 spec
   把"事后调查手段"升格为"standing gate 语义"）。重算不匹配 ⇒ drift = loud（处置归属
   各既有 authority：staging 面归 TRUSTED_CP G-gates，candidate 面归 stage-isolation
   FAILED_NO_MUTATION，backup 面归 BACKUP_RETENTION）。
3. **零 secret**：manifest 只记 hash/path/identity（stage-isolation §4 纪律引用）。
4. Historical trees 不回填、不重分类（`ZERO_SEPARATE_BACKFILL`）：首个带完整 manifest
   的部署自然起算（与 CTR-DEP-011 `source_commit_absent_legacy` 一次性落档同型）。

## 4. I2 — Candidate↔Dependency Compatibility Gate

对**任何** preserved dependency closure 的复用决策（前一版 node_modules / node-runtime /
harness closure / backup closure / 闭包 store），决策输入 MUST 且只能是：

```text
REUSE_ALLOWED ⇔ recorded closure identity（I1 manifest / CTR-DEP-002 / stamps）
              == candidate 当前 required topology identity
required topology identity = 解释器身份链（CTR-DEP-015） + arch（G1）
                           + platform-package 集合 + workspace/package graph identity
                           （package.json / workspace manifest / lockfile identity）
                           + 本 candidate 的 LINK_TOPOLOGY 要求
```

规则：

1. **BLIND_REUSE = FORBIDDEN（I2a）**：凡不是由上述身份比较驱动的 reuse（按存在性、
   按路径、按"上次成功"、按 mtime、按习惯）一律禁止。身份不匹配 ⇒ fresh
   materialization，或 loud fail 由 operator 显式决策（I2c）；**禁止静默复用错误拓扑**。
2. **reuse 不得伤害 reuse 来源（I2b）**：CTR-DEP-010 copy-not-mv 语义原样引用——
   backup 在任何 reuse 之后 MUST 保持完整可回滚（BACKUP_RETENTION 语义不动）。
3. **无新工具（frozen boundary）**：本 gate 是**决策规则**，不是新 package manager、
   不是 generic workspace manager、不是新 control plane。其载体是既有/未来部署与
   provisioning 流程内的一个比较步骤 + 一条落档记录（reuse_used / reuse_refused_reason）。
4. **scope 诚实性**：trusted-cp staging face 的 stamp/manifest 语义由 CTR-DEP-002/011
   权威。实现现状（main @2ee6f477，如实记录）：`scripts/trusted-cp-deploy-install.sh`
   **已部分落地**——line 482 已写 `harness/.source-stamp`，lines 443-444 已存在一个
   **仅比对 harness stamp 的窄化 reuse 门**；G2 closure-manifest 写盘与任何 LINK_TOPOLOGY
   记录（install 在 line 619/676 创建 link 但不记录）仍在未来实现 lane。本 invariant
   正是把该既有窄化 reuse 门**升格并冻结**为 required-topology 全量身份比较的决策规则，
   并把同一规则 binding 到该 spec 不拥有的面（含 packages/agent-provisioning 的 link
   provisioning、以及未来 generation-model faces），使"跨面 blind reuse"无合法落脚点。

## 5. I3 — Production Runtime Read-Only

1. **Readiness ordering（I3/I3a）**：每个 startup / business traffic 所需的 bridge /
   dependency / link MUST 在进入 traffic 前验证存在且身份匹配（I1 manifest 为比对基准）。
   缺失/不匹配 ⇒ FAIL_FAST（进程不启动或 traffic 不放行）。**禁止 in-traffic repair**
   ——带病启动后顺手补链接/补依赖是本 invariant 的核心禁止项。先例：CTR-DEP-013/014
   （deploy 面）、hotstandby 激活门（bridge 就绪先于激活）、`harness.arm64-broken-`
   事件类（坏闭包曾被 serve）。
2. **Converged zero-write provisioning（I3b）**：production provisioning 面对已是
   **正确**的 root-owned dependency topology 时 MUST 收敛为零写入；realpath-equivalent
   links MUST 被接受，**禁止** rmSync+symlinkSync 式重写（fleet EACCES P273 类，2026-09-12
   修复 + `provisioning.test.js` 区分性单测为回归锚）。幂等性判据 = 第二次运行零写入。
3. **Repair = authorized maintenance only（I3c）**：真正错误的 root-owned topology 的
   修复 MUST 走部署窗口 / 显式授权维护动作（带 preimage 与 receipt，按各面既有纪律），
   禁止 opportunistic 顺手修。先例锚点：local-arm64-normalization-v1 普查
   （@28aacff0）已把生产 runtime 依赖图（D1 = agent-core closure）冻结为
   DO NOT MUTATE——本 invariant 把该单次普查结论升格为跨面常设不变量。
   CTR-DEP-016（live 树永不成为 pnpm 目标）在**全部** provisioning 面（含
   agent-provisioning）上同理成立并在此重申为跨面不变量。
4. 判定纪律沿用 EACCES 修复先例：**detection 与机械证据是 authority**（mtime/inode/
   hash 蕴含），机制级 prevention 尽力而为不作宣称。

## 6. I4 — Acceptance layering（命名阶梯）

```text
L1  DEPLOY_RECEIPT_PASS       = 机械层：sealed candidate 被消费 + 面内 gates 全绿 +
                                production bytes read-back == expected + receipt 落档。
                                （= CTR-DEP-012 DEPLOY_SUCCESS 落档 / stage-isolation
                                A1.2 apply receipt 的面内等价物；install exit 0 单独
                                永不构成 L1。）
L2  RUNTIME_CLOSURE_ACCEPTED  = 闭包层：L1 之后，installed/live tree 按 I1 manifest
                                standing 重算 == 记录身份（含 LINK_TOPOLOGY 在位、
                                stamps 可验证、I3b 幂等复跑零写入）。
L3  BUSINESS_ACCEPTED         = 业务层：真实 production-path 业务证据，按 stage-isolation
                                AMENDMENT_2 的 7-item 生产路径纪律；fixture / 仿真 /
                                staging 证据永不构成 L3。（v4-global-acceptance = L3
                                先例：BYTES_DEPLOYED=YES 后唯一剩余 gate。）
```

规则：

1. **逐对不等（I4）**：`L1 ≠ L2 ≠ L3`；任一层 PASS **从不**蕴含更高层 PASS（I4a）。
2. **逐层独立证据（I4b）**：每层证据独立落档（receipt / 重算记录 / business-path
   evidence）。无本层证据而记录本层 PASS = **misdeclaration**，评审与后续 audit MUST 拒绝，
   与 AMENDMENT_2 "A1.3 demonstration 不得记为 adoption PASS" 同纪律。
3. **不加机制**：本 invariant 是**词汇/语义冻结**，零新 runner、零新 control plane。
   各面既有 gate（G-gates / apply contract / 两值 surface gates）继续按其 authority
   运转，本 spec 只要求它们的结论被放进同一阶梯命名空间，使跨面汇报不可偷层。
4. mapping 表（供未来汇报/审计使用）：

| 既有结论 | 阶梯位置 |
|---|---|
| install exit 0（G2 manifest 生成、staging 建成） | < L1（仅为 L1 前置） |
| CTR-DEP-012 `DEPLOY_SUCCESS` deploy-status | L1（其面） |
| stage-isolation apply receipt（A1.2） | L1（其面） |
| scheduler reconciliation `SCHED-*DEPLOY_RECEIPT.json`（accepted, main @2ee6f477） | L1（其面，production post-apply receipt 先例） |
| stage-isolation `IMPLEMENTED_NOT_ADOPTED` | < L1（字节就绪、未消费） |
| stage-isolation `ADOPTED_PASS` | ≥ L1 且（若含 live 重算）≥ L2，L3 仍需独立证据 |
| live-drift-v3 式 standing recompute == 记录 | L2 证据形态 |
| `HEALTH_IS_NOT_DEPLOY_SUCCESS`（CTR-DEP-013） | L1 内部判据，引用不重复 |
| v4 `BUSINESS_ACCEPTED=YES` harness 输出 | L3 证据形态 |

## 7. Required failure tests（未来实现 lane 的最低验收——机械、可重跑）

1. **Installed identity recompute**：对 installed tree 重算 I1 manifest → == 记录 ⇒ PASS；
   注入一处 link 漂移 → loud FAIL。
2. **Link topology drift**：把一条 `@deepseek-ai` 链接替换为真实拷贝（或错目标）→
   closure gate FAIL（topology ≠ recorded，即使字节内容等价）。
3. **Blind reuse negative**：构造 required topology delta（package graph/lockfile identity
   变化）+ reuse 尝试 → reuse 被拒 / fresh materialization，落档 `reuse_refused_reason`；
   任何静默复用错误拓扑 = FAIL。
4. **Reuse source preservation**：任何 reuse 执行后，backup/来源闭包仍完整可回滚
   （CTR-DEP-010 既有测试语义，引用复跑，不重复定义）。
5. **Equivalent-link no-rewrite**：provisioning 对 realpath-equivalent root-owned link
   连续运行两次 → 第二次零写入、零 EACCES（fleet P273 回归单测为锚，升格为 gate）。
6. **Missing bridge fail-fast**：必需 bridge 缺失 → 进程不进入 traffic（或 boot 失败），
   无部分启动、无 in-traffic 补装。
7. **Layer confusion negative**：存在 L1 receipt 但无 L2 重算证据的记录宣称
   `RUNTIME_CLOSURE_ACCEPTED` → 审计/gate 拒绝；L3 无 production-path 证据同理。

## 8. Scope boundaries & 禁止清单（frozen）

```text
NEW_PACKAGE_MANAGER            = 禁止（gate 是决策规则，不是工具）
GENERIC_WORKSPACE_MANAGER      = 禁止
NEW_DEPLOYMENT_CONTROL_PLANE   = 禁止（复用各面既有 runner/gate 载体）
MODIFY_INSTALLED_DEPLOYMENT_SYSTEM_THIS_ROUND = 禁止（本轮 docs-only）
BECOME_CURRENT_ROLLOUT_BLOCKER = 禁止（§9）
AMEND_NEIGHBOR_NORMATIVE_BODY  = 禁止（TRUSTED_CP / BACKUP_RETENTION / STAGE_ISOLATION /
                                 WEC / CREDENTIAL_PROVISIONING 全部 additive 引用）
HISTORICAL_RECLASSIFICATION    = 禁止（ZERO_SEPARATE_BACKFILL）
```

## 9. Rollout 非干扰声明

- WEC（AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V1，accepted 2026-09-24，
  `production_apply_authority: none`）与其 Router/Archive 面的当前 rollout **不依赖本
  spec 的任何未接受内容**；本 spec 不触碰 workflow/broker/scheduler surface。
- 本 spec 的实现（若未来被接受并授权）属 trusted-cp V2 既有实现 lane 的 additive 字段/
  门 + agent-provisioning 面的幂等收敛，slot-gated 于各面既有授权窗口；
  **不为本 spec 开新生产窗口、不插队、不重排任何已排期 rollout**。
- 本轮证据读取全部 read-only；零 sudo、零 production 写入。

## 10. Owner acceptance 与实现授权

- `OWNER_ACCEPTANCE_REQUIRED = YES`：本 spec 冻结生产部署不变量并新增验收词汇，
  按治理先例（四条邻接 spec 均经独立评审轮 + `accepted_by: mayf3`）须 Owner acceptance
  方得 `status: accepted`，方产生 implementation authority。
- `IMPLEMENTATION_STARTED = NO`（本轮及任何后续 lane，在 acceptance 之前）。
- 实现落点预判（供 acceptance 后的 handoff，非本轮授权）：
  - I1/I2 主落点 = TRUSTED_CP V2 未来实现内的 additive manifest 字段与 reuse 决策步
    （`scripts/trusted-cp-deploy-install.sh` 族，该 spec 已列为 expected future
    implementation file）；
  - I3b 落点 = `packages/agent-provisioning`（EACCES 修复已有的幂等语义升格为 gate）；
  - I4 = 汇报/落档词汇，随各面既有 receipt 落地，零独立机制。

## 11. Handoff（给未来 implementation lane 的 clean 输入）

前置条件（任何实现分支开工前）：

1. 本 proposal 经独立评审 + Owner acceptance（`status: accepted`）。
2. 所引 on-disk 未提交 evidence **evidence-only 入库**（fleet-eacces-p273、
   pdcp-release-valve-closure、v4-global-acceptance、openai-codex-v2 的 A1 文档）——
   spec 引用不得悬空于 untracked 文件。
3. 确认 TRUSTED_CP V2 实现 lane 状态：其 G8 仍为
   `BLOCKED_BY_EXTERNAL_AUTHORITY` 时，staging 全绿止步于 staging（CTR-DEP-012 前置守卫
   原样适用；本 spec 不改变该门槛，也不提供 G8 出口）。
4. `TREE_TOO_LARGE` 若有 repo 外实证 → 按 `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1` §7
   以 `NEW_EVIDENCE` 引入，本 spec 届时以 amendment 承接；实现 lane 无权顺手扩 scope。

## 12. Final Output（本轮 token 记录）

```text
DEPLOYMENT_RUNTIME_CLOSURE_INVARIANTS_V1 = PROPOSAL_READY (docs-only)

FOUR_INVARIANTS_FROZEN =
  I1 RUNTIME_CLOSURE_MANIFEST (source identity + preserved dependencies +
     LINK_TOPOLOGY[新增 required 字段] + runtime/package identity; standing recomputable)
  I2 CANDIDATE_DEPENDENCY_COMPATIBILITY_GATE (reuse decided ONLY by recorded-identity
     comparison; BLIND_REUSE=FORBIDDEN; mismatch→fresh materialization or loud fail;
     reuse source preserved [CTR-DEP-010 referenced])
  I3 PRODUCTION_RUNTIME_READ_ONLY (required bridge verified BEFORE traffic;
     missing→FAIL_FAST, no in-traffic repair; provisioning converged-zero-write on
     correct root-owned topology; repair=authorized maintenance only)
  I4 ACCEPTANCE_LADDER (DEPLOY_RECEIPT_PASS ≠ RUNTIME_CLOSURE_ACCEPTED ≠
     BUSINESS_ACCEPTED, pairwise; layer PASS never implies higher; per-layer evidence;
     misdeclaration rejected)

NEIGHBOR_AUTHORITIES = additive-only（TRUSTED_CP_DEPLOY_ARCH_CLOSURE_V2 @613a07a2 ·
  AGENT_CORE_BACKUP_RETENTION_V1 · PRODUCTION_STAGE_ISOLATION_V1+AM1/2 @56972087 ·
  WEC_V1 non-interference）
HONEST_GAPS = TREE_TOO_LARGE: ZERO in-repo evidence（不构建 phantom 不变量）·
  DEPLOY_RECEIPT: 阶梯词汇新定义；字符串先例 = scheduler reconciliation
  DEPLOY_RECEIPT.json artifact；语义映射 = CTR-DEP-012 deploy-status + A1.2 apply receipt
REQUIRED_FAILURE_TESTS = 7（§7）
PRODUCTION_CHANGE = NONE · SCRIPT_CHANGE = NONE · RUNTIME_CODE_CHANGE = NONE
IMPLEMENTATION_STARTED = NO · OWNER_ACCEPTANCE_REQUIRED = YES
ROLLOUT_BLOCKER = NO
```
