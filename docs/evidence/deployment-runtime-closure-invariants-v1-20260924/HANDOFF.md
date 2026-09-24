# HANDOFF — DEPLOYMENT_RUNTIME_CLOSURE_INVARIANTS_V1（night lane → 未来 implementation lane）

> date 2026-09-24 · branch `spec/deployment-runtime-closure-invariants-v1`（base = github/main @ 2ee6f477）
> 本轮 = governance/spec/review only。**IMPLEMENTATION_STARTED = NO。**

## 交付物

| 文件 | 说明 |
|---|---|
| `docs/specs/DEPLOYMENT_RUNTIME_CLOSURE_INVARIANTS_V1.md` | spec proposal（status: proposal）。冻结 I1 Runtime Closure Manifest（新增 LINK_TOPOLOGY required 字段 + installed-tree standing recompute）、I2 Candidate↔Dependency Compatibility Gate（reuse 仅由 recorded-identity 比较决策；BLIND_REUSE=FORBIDDEN）、I3 Production Runtime Read-Only（bridge before traffic / FAIL_FAST / converged-zero-write provisioning / repair=authorized maintenance only）、I4 Acceptance Ladder（`DEPLOY_RECEIPT_PASS ≠ RUNTIME_CLOSURE_ACCEPTED ≠ BUSINESS_ACCEPTED`，逐层独立证据）。7 条 required failure tests。 |
| `docs/evidence/deployment-runtime-closure-invariants-v1-20260924/DEVELOPMENT_PREFLIGHT.md` | 治理 preflight（含 r1 评审修正记录）。 |

## 状态

```text
SPEC_PROPOSAL_READY          = YES（含独立评审 R1 全部修复吸收）
INDEPENDENT_REVIEW           = R1 REVISE (LOAD_BEARING_GAPS=2, NON_BLOCKING=3) → fixes absorbed → R1-recheck PASS (RESIDUAL_GAPS=0；行号断言逐项机械核实)。记录见 spec frontmatter `independent_spec_review_result`。
OWNER_ACCEPTANCE_REQUIRED    = YES（冻结生产部署不变量 + 新增验收词汇；治理先例 = 四条邻接 spec 均经评审 + accepted_by mayf3）
IMPLEMENTATION_STARTED       = NO（无 accepted authority；standing order §4 / merge-gate G2）
BLOCKER                      = NONE（对任何现有 rollout；本 lane 本身无 blocker）
ROLLOUT_NON_INTERFERENCE     = WEC / Router / Archive 不受影响（spec §9）
```

## 未来 implementation lane 的开工清单（acceptance 之后）

1. **获得 authority**：Owner acceptance 使 `status: accepted`（按 AGENT_REPO_KNOWLEDGE_
   GOVERNANCE_V1 语义）。在那之前任何实现 = 越权。
2. **evidence 入库前置**：把 spec 引用的 4 个 on-disk 未提交 evidence（fleet-eacces-p273、
   pdcp-release-valve-closure、v4-global-acceptance、openai-codex-v2 A1 文档）evidence-only
   提交，消除悬空引用。
3. **I1/I2 主落点**：TRUSTED_CP V2 既有实现 lane（`scripts/trusted-cp-deploy-install.sh`
   族）——additive：G2 closure-manifest 写盘（该 spec 已授权，尚未落地）+ LINK_TOPOLOGY
   记录（本 spec 新增 required）+ 把既有 lines 443-444 窄化 stamp-equality reuse 门升格为
   required-topology 全量比较（本 spec I2）。G8 仍为 BLOCKED_BY_EXTERNAL_AUTHORITY 时，
   staging 全绿止步于 staging（CTR-DEP-012 前置守卫原样适用；本 spec 不提供 G8 出口）。
4. **I3b 落点**：`packages/agent-provisioning`——把 EACCES P273 修复已有的幂等语义
   （realpath-equivalent 不重写；第二次运行零写入）升格为 gate + 回归测试保留。
5. **I4 落点**：零新机制；各面既有 receipt/deploy-status 落档时采用阶梯词汇 +
   逐层独立证据；审计面拒绝 misdeclaration。
6. **验收**：spec §7 的 7 条 failure tests 全部机械可重跑为 PASS；§10 的 Owner acceptance
   判断已内嵌。
7. **扩面纪律**：`TREE_TOO_LARGE` 或任何新事件类 → 走
   AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1 §7（NEW_EVIDENCE → amendment），不顺手扩 scope。

## 明确不做（对齐 goal brief 禁止清单）

新 package manager = NO · generic workspace manager = NO · 新 deployment control plane = NO ·
本轮修改 installed Deployment System = NO（本轮 docs-only，零脚本/零产品代码改动）·
成为当前 rollout blocker = NO。
