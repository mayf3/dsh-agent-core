# WORKFLOW_DISPATCHABILITY_READY_FOR_INTEGRATION_V1 — 协调报告（Authority Conflict，PAUSED AT OWNER GATE）

> 日期：2026-09-02
> GOAL：WORKFLOW_DISPATCHABILITY_READY_FOR_INTEGRATION_V1
> 结论：**READY_FOR_INTEGRATION = NO — PAUSED_AT_OWNER_GATE（authority conflict，非 convergence guard）**
> 本轮为 docs-only：未修改任何 svc-workflow / dsh-agent-core 代码；未触碰用户主 checkout；无生产变更。

---

## 0. Verdict block

```text
READY_FOR_INTEGRATION = NO

DISPATCHABILITY_SPEC_ACCEPTED        = NO   (blocked: accepted V6 forbids accepting PR #19; rewrite is gated on Architecture successor)
SVC_WORKFLOW_IMPLEMENTATION_COMPLETE = NOT_RUN  (blocked by no-accepted-Spec governance + V6 Slice D sequencing)
SVC_WORKFLOW_CODE_AUDIT              = NOT_RUN  (nothing implemented)
BROKER_INTEGRATION_COMPLETE          = NOT_RUN  (blocked: no lawful service wire contract to declare against)
BROKER_CODE_AUDIT                    = NOT_RUN  (nothing implemented)
LOCAL_E2E                            = NOT_RUN  (blocked by the above)
CURRENT_EXACT_HEADS_RECORDED         = YES  (§6)
PRODUCTION_DEPLOYMENT                = NOT_RUN
PRODUCTION_CHANGED                   = NO
GRANT_CHANGED                        = NO
SUDO_EXECUTED                        = NO
MAIN_CHECKOUT_MODIFIED               = NO

PAUSE_CLASS = OWNER_GATE (spec acceptance + PR lifecycle are Owner-exclusive acts; unreachable autonomously)
MAX_AUTOMATIC_REVISIONS_PER_PHASE: not consumed — this is a first-pass authority block, not a revision-convergence failure
```

## 1. 一句话结论

GOAL 的核心交付（在现有 global/domain instance list 上加 `dispatchable: bool` +
`dispatch_blocked_reasons` + `dispatchableOnly=true`，即 svc-workflow PR #19 的语义）
与**已接受的现行 Product Direction `SVC_WORKFLOW_PRODUCT_BOUNDARY_V6`**（2026-09-01 经
PR #20 合入 svc-workflow main）直接冲突：V6 明确裁定 PR #19
"MUST NOT be accepted or implemented as this Goal's child or canonical dispatch
authority"，并把 read-time dispatchability 方向整体替换为 canonical activation model
（`DISPATCH_INTENT` + `nextEligibleAt`）。按照 GOAL 自己的最高规则（"只能使用 accepted
Authority 和真实 Workflow facts"、"具体清单以 current accepted Spec 为准"、两仓治理
"No accepted Spec → do not implement"），本轮不得实现，停在 Owner gate 并交付完整证据包。

## 2. 权威链机械验证（全部 fresh fetch 后逐条核实）

### 2.1 svc-workflow（mayf3/svc-workflow）

- fresh main = `efdfb7e1a0e6a381b2ab000d48f842991d5c0bb6`（fetch 于本轮，2026-09-02）。
- 最近合并：
  - PR #18（merge `c90d54c`）：accept Product Boundary **V5**（read-time dispatchability 方向）。
  - PR #20（merge `efdfb7e`）：accept Product Boundary **V6** lifecycle —— 原子地把
    `docs/product/SVC_WORKFLOW_PRODUCT_BOUNDARY_V6.md` 置为 `status: accepted`、
    V5 置为 `status: superseded`（`superseded_by: SVC_WORKFLOW_PRODUCT_BOUNDARY_V6`
    已在 main 上逐字验证），并切换 `.agents/local/README.md` 的 authority map 到 V6。
- V6 frontmatter（blob `fecca7168b8a9e043664842cd92557fd09615c82`）：
  `status: accepted`、`supersedes: [SVC_WORKFLOW_PRODUCT_BOUNDARY_V5]`、
  `PRODUCT_DIRECTION_AUTHORIZES_IMPLEMENTATION_DIRECTLY = NO`、
  `CHILD_IMPLEMENTATION_SPEC_REQUIRED = YES`、`ARCHITECTURE_RECONCILIATION_REQUIRED = YES`。
- 现行 acceptance 规则（`.agents/local/README.md` on main）：
  `SPEC_ACCEPTANCE_ACTORS = repository owner mayf3, or an explicitly authorized maintainer`；
  "Authoring, independent semantic review, and acceptance are distinct acts. A review
  recommendation does not perform acceptance."

### 2.2 V6 对本 GOAL 的直接裁定（逐字引用）

1. §3 / §3.1（PR #19 处置）：
   > "The current Spec is non-authoritative and MUST NOT be accepted or implemented as
   > this Goal's child or canonical dispatch authority. Any useful query semantics
   > retained in the future must be re-investigated and rewritten under accepted V6 and
   > the later lawful Architecture/implementation authority, without competing with
   > canonical activation."
   >
   > `CURRENT_DISPATCHABILITY_DISPOSITION = REWRITE_REQUIRED_NOT_ACCEPTABLE_OR_IMPLEMENTABLE_FOR_THIS_GOAL`
2. §8（Scheduler 主体）：
   > "its canonical new-model subject is `DISPATCH_INTENT`, **not `Page<DomainInstanceSummary>`
   > and not a computed `dispatchable` flag**"
   >
   > "No second Scheduler-facing wait status, **blocked-reason enum**, DRAFT convention,
   > timer node, event-wait node, metadata key, retry flag, or business-node exception may
   > determine eligibility."
   >
   > `CURRENT_GLOBAL_READER_ROUTE = COMPATIBILITY_AND_DIAGNOSTIC_ONLY`；`CURRENT_GLOBAL_READER_ROUTE_IS_DISPATCH_FEED = NO`
3. V6 §5.14 / 提案的 Architecture v0.4.0（PR #21）§5.14 同句式：
   > "no existing list field, dispatchable projection, node key, or current assignee row
   > becomes canonical activation"；现有 list 是 "diagnostic ... not Dispatch Intent feeds"。
4. V6 §18 Slice D（实现排序）：
   > "After V6 is accepted on `main`, one independently reviewed Architecture
   > successor/refinement must reconcile v0.3.1 node/Principal/fact/transaction semantics
   > with §§5 and 8. **Only after that authority is accepted** may an independently
   > reviewed implementation Spec authorize the bounded new model. ... Current PR #19 ...
   > cannot serve this role."

即：V6 不仅换了产品方向，还冻结了实现顺序 —— **Architecture 调和（候选 =
`SVC_WORKFLOW_ARCHITECTURE_V0_4_0`，svc-workflow PR #21，OPEN/head `cb06f9a`，2059 行，
尚未接受）→ 实现 Spec（implementation_authority: contracts）→ 实现**。
GOAL 所要的 wire 面在该顺序完成前没有合法实现入口。

### 2.3 dsh-agent-core（mayf3/dsh-agent-core）

- fresh main = `4318be332834a501069ee1bfa1e5f2192f798cdc`（本轮 fetch，840d2f4 → 4318be3）。
- Broker 现状（github/main，`packages/broker/src/capabilities/workflow.js`
  blob `83df50eb9947c865a2df531b05285c5e0f3eae0c`）：
  - `workflow_global_instances`：GET `/internal/v1/workflow-instances/global`，query =
    `limit, lifecycle, status, definitionKey, currentNodeKey, assigneePrincipalId,
    beforeCreatedAt, beforeId`；**无任何 dispatchability 参数**；scope `workflow.read`；
    授权（GLOBAL_WORKFLOW_READER / COORDINATOR）server-side enforce 的声明与实现一致。
  - `workflow_domain_instances`：GET `/internal/v1/workflow-instances/domain`，同族 keyset 分页。
  - 测试在 main：`packages/broker/test/capabilities/workflow-global-instances-v2.test.js`、
    `workflow-domain-pagination-v2.test.js`、`workflow-instances.test.js` 等。
- governing specs（均 accepted on main）：
  `AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V2`（blob `86ef0f599a5d3bdc8a2ba249354b9f2f9e827cdc`，
  supersedes V1）、`AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_PAGINATION_V2`、
  `AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1`。
- dsh main 上没有（也从未合入）dispatchability 相关 accepted spec；
  `AGENT_CORE_HR_DISPATCHER_V1` 仅存在于本地未合并分支，不在 main。

## 3. PR #19 及其独立审计（GOAL 第一步要求的核对）

- PR #19：`codex/workflow-dispatchability-v1-r2` @ `0c63d35a6e1291e7187e693e2a0ed1fec231eaf2`
  （remote branch tip 与 PR head 一致，无漂移；base `c90d54c` 已验证为 main 祖先）。
- 唯一文件 `docs/specs/SVC_WORKFLOW_DISPATCHABILITY_PROJECTION_V1.md`
  （blob `cc6b9ac87cb2f86f54ddc38031addf13e94994f9`，1029 行）。
- PR 记录的评审历史：head `fd774ad` 曾 REVISE（ACC-DISP-001..008 缺 Environment /
  Required evidence、EVD-011 陈旧），follow-up `0c63d35` 关闭；PR body 自述
  "Independent exact-head re-review and Owner acceptance are required before implementation"。
  GitHub 上无额外 review/comment 记录；本地存在对应 audit worktree
  （audit-worktrees/svc-workflow-pr19-head-fd774ad、svc-workflow-pr19-final-0c63d35）。
- **本轮独立 exact-head 审计结论（本人独立完成，非沿用）**：
  - 内部质量：PASS —— 14 个 CTR-DISP-001..014 + 8 个 ACC-DISP-001..008 齐备；
    closed reason enum（ARCHIVED/CANCELLED/TERMINAL/DRAFT_NODE/NO_ASSIGNEE/
    ASSIGNEE_DISABLED/DEFINITION_VERSION_REVOKED/DEFINITION_VERSION_DRAFT/ASSISTANCE_OPEN）；
    `dispatchableOnly=true` 在 ordering/limit+1/cursor 之前过滤（CTR-DISP-005）；
    省略参数保持 legacy shape（CTR-DISP-013）；无 offset/total pagination（CTR-DISP-006）；
    `OPS_LOCK_AUTHORITY = GAP`、拒绝 metadata/title 伪造（DEC-007/CTR-DISP-011）——
    与 GOAL 的 Pagination/兼容性/OPS_LOCK 约束完全吻合。
  - 可接受性：**FAIL（权威冲突）** —— `governed_by: SVC_WORKFLOW_PRODUCT_BOUNDARY_V5`，
    而 V5 已被 accepted V6 whole-authority supersede；V6 §3/§3.1/§18-Slice D 明文禁止
    本 Spec 被接受或实现。其 `DRAFT_NODE` 语义绑定 legacy 节点模型（V6 新流量为
    `TASK|TERMINAL`，DRAFT 不再是 node kind）。审计通过 ≠ 可接受：acceptance 是 Owner 专属行为。

## 4. 阻断链（为什么实现阶段不能开工）

| # | Blocker | 依据 | 性质 |
|---|---------|------|------|
| B1 | 无可接受的 dispatchability 实现 authority：唯一候选 PR #19 被 accepted V6 明文禁止接受/实现；重写版被 V6 门在 "re-investigated and rewritten under accepted V6 **and the later lawful Architecture/implementation authority**" 之后 | svc-workflow main V6 §3/§3.1/§18 | 权威硬阻断（不可自主修复） |
| B2 | Architecture 未调和：frozen v0.3.1（`DRAFT\|NORMAL\|TERMINAL`）与 V6（`TASK\|TERMINAL`）冲突；候选 `SVC_WORKFLOW_ARCHITECTURE_V0_4_0`（PR #21）OPEN 未接受 | V6 `ARCHITECTURE_RECONCILIATION_REQUIRED = YES`、Slice D | Owner acceptance gate |
| B3 | Spec acceptance / PR lifecycle = Owner 专属（mayf3），review 不能代替 acceptance | `.agents/local/README.md` on main；V6 §3 "repository owner mayf3 retains its lifecycle authority" | Owner gate（不可自主跨越） |

即使取对 GOAL 最友好的解读（把 projection 定位为纯诊断、不与 canonical activation 竞争），
B1–B3 仍然成立：任何 wire 变更都需要 accepted implementation-authorizing Spec
（v0.4.0 §5.14 原文 "Future wire/schema changes require an accepted
implementation-authorizing Spec"），而该 Spec 的前置（Architecture successor）尚未接受。
两仓治理一致："No accepted Spec → do not implement"。
强行实现 = 违反 GOAL 自己的最高规则，故不执行。

## 5. 现状 wire/兼容性事实（供 Owner 决策参考）

- 现行 global list wire（svc-workflow main `src/http/handlers/instances.rs::global_list`
  + `src/application/workflow_instance/query_types.rs::DomainInstanceSummary`）：
  返回 `Page<DomainInstanceSummary>`，summary 字段 = workflow_instance_id, domain_id,
  definition_version_id, definition_key, created_by_principal_id,
  current_assignee_principal_id, current_node(PublicNodeSummary), is_terminal, title,
  created_at, updated_at；分页 `items + next_cursor`（keyset `beforeCreatedAt+beforeId`
  成对 cursor，422 invalid_cursor）；lifecycle/status 参数 422 校验；默认 status=active。
- Broker 侧对该 wire 做原样透传 + declared error preservation
  （AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1 governed）。
- 若未来在 V6 链路下合法落地等价能力：canonical 主体是 `DISPATCH_INTENT`
  （dispatchIntentId/nodeVisitId/workflowInstanceId/ownerPrincipalId/nextEligibleAt/
  createdAt/updatedAt）+ `GLOBAL_SCHEDULER_READ`；现有 list 只能保持
  compatibility/diagnostic 语义。**若 Owner 决定恢复 read-time projection 方向，
  属于 Product Direction 级变更（V6 whole-authority successor 或 Owner 裁决 +
  NEW_EVIDENCE），不是 child Spec 能自选的路径。**
- OPS_LOCK：在 fresh main（efdfb7e）上对 `src/` + `migrations/` 做
  `ops-lock|ops_lock|OPS_LOCK`（-i）机械搜索 = **0 命中** →
  `OPS_LOCK_AUTHORITY = GAP` 在当前 main 上重新成立（与 PR #19 在 c90d54c 的观察一致）。

## 6. Exact coordinates（CURRENT_EXACT_HEADS_RECORDED = YES）

```text
svc-workflow fresh main        = efdfb7e1a0e6a381b2ab000d48f842991d5c0bb6
  V6 blob                      = fecca7168b8a9e043664842cd92557fd09615c82 (docs/product/SVC_WORKFLOW_PRODUCT_BOUNDARY_V6.md, status: accepted)
  V5                           = superseded (superseded_by: SVC_WORKFLOW_PRODUCT_BOUNDARY_V6, verified on main)
  PR #19 head                  = 0c63d35a6e1291e7187e693e2a0ed1fec231eaf2 (branch tip == PR head, no drift)
  PR #19 spec blob             = cc6b9ac87cb2f86f54ddc38031addf13e94994f9 (SVC_WORKFLOW_DISPATCHABILITY_PROJECTION_V1, status: proposed)
  PR #21 (arch v0.4.0) head    = cb06f9ae084a4cb50b3e58b84a59ac4395b6b955 (OPEN, proposed)
  broker-relevant route        = GET /internal/v1/workflow-instances/global|domain (src/http/mod.rs:115-120)

dsh-agent-core fresh main      = 4318be332834a501069ee1bfa1e5f2192f798cdc
  broker workflow.js blob      = 83df50eb9947c865a2df531b05285c5e0f3eae0c
  GLOBAL_INSTANCES_V2 spec blob= 86ef0f599a5d3bdc8a2ba249354b9f2f9e827cdc (status: accepted)

本轮工作分支（clean worktree，非用户主 checkout）:
  repo    = mayf3/dsh-agent-core
  worktree= /Users/yanfenma/workspace/worktrees/dsh-wf-dispatchability-rfi-v1
  branch  = docs/workflow-dispatchability-rfi-v1 (based on 4318be3)
  change  = docs-only: 本报告一个文件；explicit pathspec 提交；未 push、未开 PR、未 merge
```

### 6.1 Baseline 测试命令（LOCAL_E2E 未运行；供后续实现轮复用）

```bash
# svc-workflow（Rust）：单元 + 集成（需要本地 PostgreSQL，见仓库 docker-compose.yml / tests/）
cargo test --workspace                       # in mayf3/svc-workflow

# dsh-agent-core Broker（Node）：
cd packages/broker && npm test               # node --test（含 capabilities/workflow-global-instances-v2.test.js）
```

未来实现轮的 combined local E2E 将在此基础上加：
`workflow_global_instances(lifecycle=active, dispatchableOnly=true)` 分页到
`next_cursor=null` + blocked/dispatchable fixture 断言（仅在第 7 节路径合法打通后执行）。

### 6.2 Baseline readiness probe（2026-09-02 实测，gate-neutral，无任何 dispatchability 实现）

在 pinned heads 上实际执行了 §6.1 的命令，全部通过：

```text
[dsh-agent-core @ 4318be3]  packages/broker: npm install（worktree 内）+ npm test
  → tests 301 / pass 301 / fail 0（node v26.7.0）

[svc-workflow @ efdfb7e]    cargo test --workspace --no-run
  → exit 0，全部测试目标编译通过
[svc-workflow @ efdfb7e]    cargo test --lib
  → 149 passed / 0 failed
[svc-workflow @ efdfb7e]    TEST_DATABASE_URL='postgres://postgres:postgres@127.0.0.1:55432/svc_workflow_rfi_probe'
                            cargo test --test 23_global_coordinator
  → 9 passed / 0 failed（含 coordinator_list_pagination_is_continuous，
    即未来要扩展的 global list keyset 分页面；隔离 DB + 幂等 migrations）
```

- 测试 DB 约定：`TEST_DATABASE_URL`（tests/common/mod.rs，默认
  `postgres://postgres:postgres@localhost:5432/svc_workflow`，可用 env 覆盖）；
  本轮用本地 docker 测试容器 `svc-workflow-test-pg`（127.0.0.1:55432）上的专属
  DB `svc_workflow_rfi_probe`，probe 后已 DROP，无残留。
- probe worktrees（均 detached、主 checkout 未动）：
  - svc: /Users/yanfenma/workspace/worktrees/svc-wf-dispatch-rfi-baseline @ efdfb7e
  - dsh: /Users/yanfenma/workspace/worktrees/dsh-wf-dispatchability-rfi-v1 @ f925f55（4318be3 + 本报告）
- 结论：裁决后无论走 (a)/(b)，两条路径的实现-测试-审计链条在本地均即时可执行；
  LOCAL_E2E 的全部前置（build、test runner、DB 容器、分页测试目标）已实证就绪。

## 7. 通往 READY_FOR_INTEGRATION = YES 的合法路径（merge dependencies / order）

```text
1. Owner 裁决方向（Owner gate，二选一）:
   a) 维持 accepted V6：放弃 read-time dispatchable flag 路线；
      dispatch 能力按 Slice D→F 走 DISPATCH_INTENT + nextEligibleAt + GLOBAL_SCHEDULER_READ；
      Broker 侧后续按 Slice F 另立 dsh-agent-core authority（PR #87 关系按 V6 §8A 处理）。
   b) Owner 显式 NEW_EVIDENCE / Product Direction successor 恢复 read-time projection：
      先做 V6 whole-authority successor（或 Owner ruling），再重写
      SVC_WORKFLOW_DISPATCHABILITY_PROJECTION_V1（base 迁到当时 main），
      独立 exact-head 复审 + Owner acceptance。
2. 若走 (a)：Owner 接受 PR #21（SVC_WORKFLOW_ARCHITECTURE_V0_4_0）→
   accepted implementation Spec（Slice D，可单 Spec 覆盖 activation/Intent/wake/cutover）
   → svc-workflow 实现 + 独立代码审计 → dsh-agent-core Broker 集成（新 capability 或
   现有 manifests 扩展，独立 spec + 审计）→ combined local E2E。
3. 若走 (b)：重写 Spec accepted 后即可按 GOAL 原计划实现 service + broker + E2E
   （PR #19 的 14 CTR / 8 ACC 结构可直接复用，需把 governed_by 改挂新 Product Direction）。
4. 任何路径下：GOAL 的完成条件（IMPLEMENTATION_COMPLETE / 两级 CODE_AUDIT / LOCAL_E2E /
   READY_FOR_INTEGRATION = YES）只能在上述 acceptance 之后的实现轮里达成。
```

## 8. FOLLOW_UP_DEBT

1. **OPS_LOCK gap**（本 main 已复验）：无 Workflow-owned primitive；未来能力必须先定义
   authoritative primitive + lifecycle + writer authorization + audit（PR #19 DEC-007 结论仍有效）。
2. **Architecture reconciliation**：PR #21（v0.4.0）OPEN 未接受 —— Slice D 的前置。
3. **PR #19 lifecycle**：Owner 保留处置权（accept / rewrite / close 均可，但按 V6 不得照原样 accept）。
4. **Slice F（dsh-agent-core dispatch & Scheduler management）**：Reconciler-only 周期恢复 +
   Scheduler 管理与正常 dispatch 分离，是 svc-workflow 侧认可的互操作条件。
5. **GLOBAL_SCHEDULER_READ permission mapping**：Reader/Coordinator 兼容语义与新 surface
   的 fail-closed 映射需在实现 Spec 中冻结（V6 §8）。
6. HR/Scheduler policy（fairness/quota/retry/agent_wake/Principal→Agent mapping）持续 out of scope
   （GOAL 明确不做清单与 V6 §2.2/§8A 一致，无变化）。

## 9. 本轮边界自证

- docs-only：本 worktree 仅新增本报告一个文件；`git diff` 对 4318be3 仅含该文件。
- 未修改用户主 checkout（/Users/yanfenma/workspace/project/dsh-agent-core 与
  .../svc-workflow 均未触碰，其 pre-existing WIP 保持原样）。
- svc-workflow 侧零写入：所有检查经 `git show`/`git grep` 于 fetch 后的本地对象完成。
- 无 production 访问、无 sudo/osascript、无 push、无 PR 操作、无 merge。
- 两仓 agentic 治理（DEVELOPMENT_PREFLIGHT / No accepted Spec → do not implement）被遵守：
  实现未开工正是因为其 governing authority 不存在且被 V6 显式禁止。
