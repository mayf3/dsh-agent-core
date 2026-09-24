# DEVELOPMENT_PREFLIGHT — DEPLOYMENT_RUNTIME_CLOSURE_INVARIANTS_V1 (authority closure night lane)

> Lane: `DEPLOYMENT_RUNTIME_CLOSURE_INVARIANTS_V1_AUTHORITY_CLOSURE_NIGHT` · date 2026-09-24
> 模板：`.agents/templates/development-preflight.md`（来自 `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1` §8, accepted）
> 本轮 = governance / spec / review only。零实现、零 production mutation、零 rollout 阻塞。

```text
DEVELOPMENT_PREFLIGHT

Problem =
  Installed/live deployment runtime closure 没有任何 accepted invariant authority：
  (1) installed runtime 没有 standing closure identity（source tree + preserved dependencies
      + workspace-link topology + runtime/package dependency identity）——live manifest 漂移
      只能靠事后调查发现（deploy-9bb5b97-live-drift-v3）；生产 harness 曾以 117-file dirty
      安装 + 无 .source-stamp 运行（hotstandby-activation-v1）；
  (2) preserved dependency closure 的 reuse 没有 topology-identity 兼容门——Step 1b 曾把
      刚建成的 backup 的 harness/node-runtime mv 出去复用（掏空 rollback 件）；跨 arch
      pnpm 闭包曾被静默过滤（trusted-cp-cross-arch 调查根因）；.source-stamp 缺失导致
      静默 reuse 失效 → 全量重装（每次部署重新武装故障窗口）；
  (3) production provisioning 曾重写 realpath-equivalent root-owned links 引发 EACCES
      （fleet P273, 2026-09-12 永久修复 + 回归单测，但该类不变量无 accepted spec 冻结）；
      census 证明 symlink-to-dev-tree 曾让 production operator CLI 执行 dev dirty bytes；
  (4) 验收分层（deploy receipt ≠ runtime closure ≠ business acceptance）在三个 accepted
      authority 里分散实践（CTR-DEP-012/013、stage-isolation AMENDMENT_2、v4-global-
      acceptance BYTES_DEPLOYED≠business）但从未被命名为一个 frozen ladder。

Governing Spec =
  NONE YET for this lane（全仓库无 DEPLOYMENT_RUNTIME_CLOSURE_INVARIANTS / *CLOSURE_INVARIANT*
  spec/decision/proposal —— 已机械核实）。最近邻 accepted authorities（本 proposal 只做
  additive 引用，不改其 normative body）：
  - TRUSTED_CP_DEPLOY_ARCH_CLOSURE_V2（accepted 2026-08-24, governing_spec；分支
    docs/trusted-cp-deploy-arch-closure-v2-spec @ 613a07a2）—— staging 部署门 G1-G12 +
    CTR-DEP-001..018（closure manifest / stamps / live 树不跑 pnpm / install≠deploy /
    copy-not-mv reuse）
  - AGENT_CORE_BACKUP_RETENTION_V1（accepted, on main）—— backup lifecycle / retention
  - PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1（accepted 2026-09-08 + AMENDMENT_1/2；
    分支 goal/workflow-assignee-admission-guard-v1 @ 56972087 等）—— candidate seal / apply
    contract / 两值验收门先例
  - AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V1（accepted 2026-09-24, on main,
    production_apply_authority: none）—— 本 lane 不得阻塞其 rollout

Spec status = proposal（本轮产出）；implementation authority = NONE until Owner accepted

Relevant investigations =
  docs/investigations/trusted-cp-cross-arch-dependency-closure-v1.md (@8ca8b7aa)
  docs/investigations/PRODUCTION_STAGE_ISOLATION_CENSUS_V1.md (@6d74a9b6)
  docs/investigations/agent-core-backup-retention-v1-proposal.md (on main)
Relevant evidence =
  docs/evidence/deploy-9bb5b97-live-drift-v3-20260831 (@13ecf593)
  docs/evidence/hotstandby-activation-v1-20260830 (@53798600)
  docs/evidence/local-arm64-normalization-v1-20260907 (@28aacff0)
  docs/evidence/fleet-eacces-p273-adoption-20260912（primary checkout on-disk，截至
    2026-09-24 未提交 —— handoff 前置条件：先 evidence-only 入库）
  docs/evidence/pdcp-release-valve-closure-v1-20260921（on-disk 未提交，同上）
  docs/evidence/v4-global-acceptance-20260924（on-disk 未提交，同上）
  docs/evidence/openai-codex-refresh-token-reused-v2-recurrence-20260920/A1_ARTIFACT_BUILD.md
    （on-disk 未提交，同上；node_modules 平铺闭包 + sha 三方一致门防旧 drift 件的先例）
Relevant decisions =
  docs/decisions/ 下无 runtime-closure / workspace-link 主题 decision（已核实）
Previously rejected alternatives =
  TRUSTED_CP ALT-001..006（含 ALT-005 手工 verify 维持现状 = 否决；ALT-006 corepack 搬迁
  = deferred 非否决）；BACKUP_RETENTION alternatives（retention 服务/DB、keep-newest-3
  一次到位、data-copy pin、successor 归属、flock/lock）—— 本 proposal 不重开任何一条

Frozen boundaries =
  新 package manager = 禁止 · generic workspace manager = 禁止 ·
  新 deployment control plane = 禁止 · 本轮修改 installed Deployment System = 禁止 ·
  成为当前 WEC/Router/Archive rollout blocker = 禁止 ·
  amend TRUSTED_CP / BACKUP_RETENTION / STAGE_ISOLATION normative body = 禁止（additive only）

Implementation scope = NONE（本轮 governance/spec/review only）
Out-of-scope = 任何 gate/script 实现；production mutation；WEC surface；historical reclassification

New evidence =
  fleet-eacces-p273（2026-09-12）、pdcp-release-valve-closure（2026-09-21）、
  v4-global-acceptance（2026-09-24）晚于最近邻 accepted specs，证明分层已在实践但未被
  命名/冻结；live-drift-v3 + hotstandby + census 证明 installed-closure identity 空档真实存在。
  诚实记录（r1 评审后修正）：TREE_TOO_LARGE 全仓库（docs/scripts/packages/tests）无任何
  evidence 命中（机械检索 2026-09-24）——本 proposal 不基于 phantom incident 构建不变量；
  若指 repo 外事件，须按 AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1 §7 以 NEW_EVIDENCE 显式引入。
  DEPLOY_RECEIPT 作为验收阶梯词汇为本 proposal 新定义；字符串先例已存在于
  AGENT_CORE_SCHEDULER_PRODUCTION_RECONCILIATION_V1（accepted, main @2ee6f477）的
  `SCHED-20260904T054035Z-DEPLOY_RECEIPT.json` artifact（初稿误称"repo 此前无此 token"，
  评审 R1 gap-1 修正）；语义映射 = apply receipt（stage-isolation A1.2）+ deploy-status
  （CTR-DEP-012）+ 该 scheduler receipt。另：TRUSTED_CP V2 的部署脚本实现已**部分落地**
  （main 上 trusted-cp-deploy-install.sh 已写 source-stamp、已含窄化 stamp-equality
  reuse 门；G2 manifest 写盘与 LINK_TOPOLOGY 记录未落地）——初稿误述为"实现仍在未来
  lane"，评审 R1 gap-2 修正；I2 定位为把窄化 reuse 门升格为全量 topology-identity 比较。

Need new/amended Spec = YES
  形态 = NEW spec proposal（DEPLOYMENT_RUNTIME_CLOSURE_INVARIANTS_V1），非 AMEND/SUPERSEDE：
  四个 invariant 落在"installed/live runtime closure face"——没有任何 accepted spec 的方向
  需要纠正或重定，故不构成 amendment；方向无冲突，只是空白面。
  ⇒ 无 accepted authority 之前 IMPLEMENTATION_STARTED = NO。
```
