# Governing Specs

Governing Specs live at stable paths:

```text
docs/specs/<SPEC_ID>.md
```

Syntax and lifecycle are governed by:

```text
.agents/protocol/SPEC_FORMAT_V0.md
.agents/protocol/SPEC_GOVERNANCE_V0.md
```

Lifecycle:

```text
proposed | accepted | superseded
```

Implementation progress, verification coverage, runtime state, and conformance are separate dimensions and are not written into Spec lifecycle.

Before non-mechanical implementation:

```text
status in implementation base = accepted
implementation_authority = contracts
requested work within active Contract scope = yes
```

This index is a navigation aid, not a second authority. File frontmatter and explicit supersession links are authoritative. Existing historical Specs are not bulk-rewritten or bulk-indexed during the pilot adoption.

## Governance transition

| Spec ID | Status in this branch | Kind | Scope | Supersedes on acceptance |
|---|---|---|---|---|
| `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0` | accepted / current governance | invariant / governance adoption | `mayf3/dsh-agent-core` | `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1` |
| `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1` | superseded | legacy governance | repository knowledge model | — |

Other existing Specs remain at their stable filenames and keep their current lifecycle until explicitly reviewed.

## Agent primary Workspace authority

| Spec | Current lifecycle | Implementation authority | Authority role |
|---|---|---|---|
| `AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3` | accepted / current | contracts | exact 86-Agent historical OpenClaw Workspace in-place reuse authority; implementation only via bounded Contracts + PR #47 frozen plan + independent production approval |
| `AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2` | superseded | none | historical curated-import authority replaced whole by V3 |
| `AGENT_PRIMARY_WORKSPACE_IMPORT_V1` | superseded | historical legacy field | historical adopt-in-place / zero-copy authority replaced whole by V2 |

The V3 acceptance transaction is lifecycle-only relative to reviewed head
`401962beccdebb94e0f1ddc062b3d3f7efb49b0a` (reviewed base
`622cb7b6bae7b0b5a9a8713bb5a843ad6a7dc5f1`; 复用 审计 = PASS); it performs no
Workspace migration or production change, and `production_apply_authority` stays
`none`. PR #47's separate revision and Auth blocker work remains downstream.

## AgentProcess lifecycle authority

| Spec | Current lifecycle | Implementation authority | Authority role |
|---|---|---|---|
| `AGENT_PROCESS_LIFECYCLE_HARDENING_V2` | accepted / current | contracts | current AgentProcess lifecycle authority |
| `AGENT_PROCESS_LIFECYCLE_HARDENING_V1` | superseded | none | historical replaced authority |

`accepted / current` plus `implementation_authority: contracts` means bounded Contracts may authorize a later implementation only after its exact-base preflight and compliance gates pass. It does **not** mean implementation is complete, production is deployed, or an implementation PR has automatic merge authority.

## agt_cto-agent model-route authority

| Spec | Current lifecycle | Implementation authority | Authority role |
|---|---|---|---|
| `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2` | accepted lifecycle in PR #103 / effective on merge into main | contracts (gated; effective only after coordinated acceptance commit merges) | complete standalone whole-authority successor of Activation V1: GLM primary with exact terminal-quota Luna backup, existing Luna reuse, Harness identity, audited IMPL V2 classifier, and controlled candidate/final canaries |
| `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V1` | superseded by Activation V2 in PR #103 / remains effective on current main until merge | historical contracts only after successor merge | historical activation authority; backlink = `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2` |
| `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2` | accepted lifecycle in PR #103 / effective on merge into main | contracts (effective only after coordinated acceptance commit merges) | complete standalone IMPL V1 successor: preserves loader/executor/reuse/deadline/journal/Scheduler contracts and adds the exact terminal pre-generation quota class, unsafe-429 STOP precedence, and a closed controlled-429 canary seam |
| `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1` | superseded by IMPL V2 in PR #103 / remains effective on current main until merge | historical contracts only after successor merge | historical implementation authority; backlink = `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2` |
| `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2` | accepted lifecycle in PR #103 / effective on merge into main | none | complete standalone Parent V1 successor: preserves ordered-chain policy and freezes existing OAuth/plugin reuse, Home 0755, exact `provider_quota_rejected_before_generation` hop, and ambiguous/unsafe 429 STOP |
| `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1` | superseded by Parent V2 in PR #103 / remains effective on current main until merge | none | historical parent authority after successor merge; backlink = `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2` |
| `AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1` | superseded | none | historical model-route authority replaced whole by `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1` |
| `AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1` | superseded | none | historical v1 providerEnv seam authority replaced whole by `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1` (safety contracts absorbed by CTR-010/CTR-014) |

PR #103 atomic acceptance lineage: Parent/IMPL/Activation V2 are accepted together at reviewed
head `85431b5aa61493d9e472ab9b731ef58e896e581b` (PASS, 0 blockers, normative body change NONE)；
each V2 names its V1 predecessor in `supersedes` and each V1 has the reciprocal `superseded_by`
backlink in the same acceptance commit. Until that commit merges main, the three V1 remain the
effective authorities on current main and the accepted V2 contracts remain off-main；no mixed
V1/V2 implementation or production apply is authorized.

The ordered-route-chain acceptance transaction (2026-08-25) is lifecycle-only
relative to reviewed head `ee13cb224660416c9044203610b93cb8f13873bb`
(链路 审计 = PASS，0 blockers；OWNER_DECISION MAX_CONFIGURED_ROUTES = 4；fresh
current main `b296558` merge-tree clean): the new Spec becomes the current
authority, both former main authorities are superseded with backlinks, and
`implementation_authority` / `production_apply_authority` stay `none` — the
transaction authorizes no implementation, configuration, or production change.

The child implementation-authorizing acceptance (2026-08-26, 链路 授权采纳执行) is
lifecycle-only relative to reviewed head `a3f787e673276942371bd0b5d8bb5b94d1302595`
(链路 授权审计 = PASS, 0 blockers; accepted_by = mayf3): `proposed -> accepted` with
provenance only, normative body byte-preserved; `implementation_authority:
contracts` / `production_apply_authority: none` unchanged. Per
SPEC_GOVERNANCE_V0 §2.1 the accepted content becomes active repository authority on
merge into main (PR #74 stays OPEN, unmerged); the implementation gate additionally
requires its presence in an implementation base that includes Scheduler V2.

PR #60 / `AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1` 从未进入 main，定性为
`ABANDONED_UNMERGED_CANDIDATE`，不是 active authority；PR #70 不 supersede 它。
PR #60 必须关闭且永不 merge。

`AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V1`（accepted，2026-08-27；
accepted_by = mayf3；reviewed_head = `f4e1e04aa6725f9652cfabe86ef8c044a92e4e6e`；
review_verdict = PASS；blocker_count = 0；normative_body_change = NONE）把激活所需的
三个有顺序阶段（实现补齐 / 凭据准备 / 生产激活）冻结为单一统一 child authority。PR #78 /
`AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_CREDENTIAL_V1`（Draft/OPEN，从未 accepted、
从未进入 main，不是 active authority）的「仅凭据授权」拆分形态被 Owner 指令
2026-08-27 否决，其授权内容被本统一 Spec 吸收重冻，定性
`CONSOLIDATED_UNMERGED_CANDIDATE`：推荐关闭且永不 merge；该 activation
acceptance 轮对其执行零 lifecycle mutation。逐阶段 gate 冻结为：Phase A =
GATE-1 AND GATE-2；Phase B = GATE-1 AND GATE-2 AND GATE-3；Phase C = GATE-1
AND GATE-2 AND GATE-3 AND GATE-4。`PR77_IN_MAIN = YES`；GATE-2 已由 PR #77
merge commit `b620907fc6f58292b6ee096c977f0071921d747e` 满足。GATE-5 = Phase C 强制
canary A–D 全 PASS，是 production activation 最终完成判据，不是启动任一 Phase
的前置条件；GATE-5 未完成前不得宣称 `ACTIVATION_COMPLETE`。Home mode 唯一为
0755 / uid502，0700 deferred；raw credential 只允许进入两个 0600 / uid502 专用
store（`.credentials.yaml` 的 `ZAI_API_KEY` 与 Owner OAuth 新生成的
`.openai-codex-auth.json`），禁止进入 override、launchd、settings、日志/输出、
PR、证据或其他配置。严格阶段顺序 A→B→C 不变。

Activation Amendment 1（2026-08-28，GLM Strict Staging；**accepted** —
acceptance finalize 2026-08-28，模型 执行：accepted_by = mayf3 ·
reviewed_head = 4e71fd2db78db9f8b80b8636d6c8255d7764d39a · 模型 审计 =
PASS · blocker 0 · NORMATIVE_BODY_CHANGE = NONE；PR #94 Draft 保持
OPEN / 未 merge，active-authority 语义按 SPEC_GOVERNANCE_V0 §2.1 on
merge into main）对本 Spec 追加 in-place Amendment 节：把激活
重排为两个 Stage——STAGE_1 = GLM_STRICT（GLM 以 strict 单路由正式上线：
builtin / zai / glm-5.3 / primary = glm53 / `fallbacks = []`，Stage-1
routeCatalog 仅含 glm53 entry）与 STAGE_2 = LUNA_COLD_FALLBACK_DEFERRED
（Luna 冷备候选推迟，不阻塞 Stage 1；Owner 再次明确授权前禁止重新安装 /
重新 OAuth / 刷新凭据 / 生产 Luna model call / 进入 fallbacks[]）。GATE-4
重定义为 Stage-1 的 GLM（zai-api-key-home）readiness 单边；CTR-ACT-C103
的两 entry 配置形态与 CANARY-B/C 的 luna 判据保留为 Stage-2 目标形态。
Phase A（已执行 @ `a708fc3`，GATE-3 = PASS 任务给定；已随 PR #95 merge
commit `1f40896` 进入 main）与 §9.1 安全语义、
父 Spec / IMPL 全部 ruling（MAX_CONFIGURED_ROUTES = 4、STOP_CHAIN、
proven-no-admission 白名单、ONE_LOGICAL_TURN、Scheduler
INHERIT_AGENT_CHAIN_ONLY、ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN、
raw credential 边界、dsh-codex fake carrier 禁止）逐字保持。基础正文
（§1–§14）与 Amendment 节 normative 内容（A1.0–A1.7）逐字保留；
不新建第二套 Route Chain Spec（Owner 指令 2026-08-28）。

Amendment 1（2026-08-26，Builtin Route Kind；accepted — acceptance finalize
2026-08-27，链路 内建路由采纳执行，accepted_by = mayf3 · reviewed_head =
8b76909c33dfc39693c6f8e760eb1a29c80d0727 · 链路 内建路由审计 = PASS ·
blocker 0 · NORMATIVE_BODY_CHANGE = NONE；PR #77 已由 merge commit
`b620907fc6f58292b6ee096c977f0071921d747e` 进入 main）对两份 route-chain
authority 各追加一个 in-place Amendment 节：引入
`routeKind = builtin | subscription`（builtin route 的 plugin/pluginVersion =
ABSENT/FORBIDDEN；subscription route 必填 + exact pin），把
`CANONICAL_ROUTE_IDENTITY` 扩为七字段（routeKind + plugin-or-ABSENT/
pluginVersion-or-ABSENT），以新证据（zai/glm-5.3 受控探针 PASS、ZAI 为
Harness 内建 provider、无真实 dsh-zai 插件、dsh-codex fake carrier 禁止）
关闭父 Spec Q-2 并冻结初始链 tuple（glm53 builtin + luna subscription）。
两份 Spec 基础正文逐字保留；Amendment 已随 PR #77 进入 main。
MAX_CONFIGURED_ROUTES = 4、primary + fallbacks[]、STOP_CHAIN、
ONE_LOGICAL_TURN、Scheduler INHERIT_AGENT_CHAIN_ONLY、
ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN 等全部 ruling 不重开。

## Agent Core global-route hemostasis proposal (amendment R2)

| Spec | Current lifecycle | Implementation authority | Authority role |
|---|---|---|---|
| `AGENT_CORE_GLOBAL_ROUTE_HEMOSTASIS_V1` | proposed / not accepted (amended after review `5062138118` = REVISE) | none (pure Governing Program) | freezes goals, fail-closed boundaries, a named-node/explicit-edge prerequisite DAG, five generation→audit→exact-digest Owner artifact chains, source-stamp-before-write ordering, registry-union targets, restore branches, credential byte preservation, drain identity, diagnostic cleanup prerequisite, pre-unpause expiry monitor, and exactly 14 freshness classes |

The former CTO compatibility-amendment candidate was removed from PR #120's final tree.
CTO shared-environment compatibility is an **unresolved prerequisite** owned by a future,
separately reviewed child Authority; this Program creates no carve-out, precedence rule,
or supersession conclusion and permits no global environment mutation before that child
is accepted and merged. PR #117 and review `5061248705` remain historical evidence only;
its runner is forbidden, the five prior writes are not retroactively authorized, and the
main Program authorizes no code or production execution. Await a new exact-head
independent **“授权 审计”**; **DO NOT MERGE**.

## Forum moderation capabilities authority

| Spec | Current lifecycle | Implementation authority | Authority role |
|---|---|---|---|
| `AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2` | accepted / current | contracts | whole successor: 5 normal + 8 moderator Forum Broker tools, closed-list moderator visibility, case-insensitive auth-scheme sanitizer, twelve-file implementation closure |
| `AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V1` | superseded | none | historical authority replaced whole by V2 (2026-08-29 atomic acceptance; backlink in V1 frontmatter) |

V2 was accepted against independently reviewed head `8d2f591a5d2e9df78f39b5d40afb6219d7377258`
(版管 审计 = PASS, BLOCKERS = NONE) after a mechanical base reconciliation merge
with zero semantic delta (V2 §19). `production_apply_authority` stays `none`:
code merge, bundle deployment, moderator-list configuration, runtime reload,
Forum deployment, and Grant apply each remain separately authorized actions.
