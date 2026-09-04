---
spec_id: AGENT_SESSION_SEND_STANDALONE_DEPLOYMENT_AUTHORITY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: contracts
date: 2026-09-04
revision: r1
accepted_date: null
accepted_by: null
accepted_reviewed_head: null
independent_review_result: PENDING
independent_review_blockers: PENDING
acceptance_verdict: PENDING
owner_goal: AGENT_SESSION_SEND_STANDALONE_PRODUCTION_V1
governed_by:
  - AGENT_CORE_AGENT_SESSION_MESSAGING_V1 (accepted r3 — capability semantics, unchanged)
external_authorities:
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_AGENT_SESSION_SEND_OPERATIONAL_GRANT_V1
    relation: covers_current_grant_state (PR #50 MERGED; tuple-exact; no DB write)
supersedes: []
superseded_by: null
historical_input_only:
  - AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1 (accepted r3; its 28-file
    exact closure is STALE for this ruling — Fleet/Forum/History bytes are
    forbidden by the new Owner decision; recorded per that spec's own evidence
    value, NOT superseded: it remains the authority OF RECORD for the paused
    Lane B generation)
owners:
  - mayf3
  - repository-maintainers
---

# AGENT_SESSION_SEND_STANDALONE_DEPLOYMENT_AUTHORITY_V1

> 目的（Owner 已裁定的产品决定，见 goal §11，本 spec 不再询问）：
> `ASM_INDEPENDENT_SHIPPING_REQUIRED=YES`、`DO_NOT_WAIT_FOR_MODEL_FLEET=YES`、
> `NO_FLEET_PRODUCTION_CHANGE=YES`、`TARGET_SESSION_SEMANTICS=CANONICAL_MAIN`、
> `DAILY_ORCHESTRATOR=agt_efficiency-agent`、`INITIAL_CANARY_TARGET=blog-agent`。
> 本 spec 冻结让 agent_session_send 在**不迁移 Model Fleet、不触碰 Forum/Scheduler/Workflow
> 生产面**的前提下独立生产可用所需的最小部署 closure 与全部安全合同。

## 1. CASE 判定与 source 处置

- **CASE A = SELECTIVE_COMPOSED_CLOSURE**（goal §9）：普查（见
  `docs/investigations/ASM_STANDALONE_COUPLING_CENSUS_V1.md`）机械证明 accepted source 中的
  ASM 必需字节可与 Fleet/Forum/History 字节按 hunk 机械分离，无需任何新逻辑。
- **AGENT_SESSION_SEND_SOURCE = REUSED**（goal §25 允许）：全部 NEW/WHOLESALE 文件与
  main@7c7c03a 字节一致（其中 26/28 与 ASM@7921f4a 一致）；两个 COMPOSED 文件是部署组合产物，
  **不回写 main**（回写将删除 main 的 forum v2 与 scheduler-history 世代，违反 §5 禁区）。
  组合配方由 `compose_face.py` 冻结并可复现。
- 能力语义唯一 governed by 已 accepted 的 `AGENT_CORE_AGENT_SESSION_MESSAGING_V1` r3；
  本 spec 零产品语义变更。

## 2. AUTHORIZED_RELEASE_SOURCE

```text
SOURCE_BLOBS        = mayf3/dsh-agent-core @ 7c7c03afa53703cbad9cc686e18fa7f5658eb8e6
LIVE_BASE           = /usr/local/libexec/agent-core/app @ FRESH_PRODUCTION_PREIMAGE（部署时点冻结）
COMPOSER            = deployment-artifacts/asm-standalone-candidate-v1/compose_face.py
                      （锚点唯一性断言 + 双向 diff 验证内建）
```

## 3. EXACT_FILE_CLOSURE（17 文件）

face 的 blob/组合定义以普查文档 §4 为准（此处为部署冻结清单，sha256 在 artifact
MANIFEST 中全量冻结）：

```text
NEW ×4          broker/src/capabilities/agent-session-messaging.js
                production-runtime/src/agent-session-messaging.js
                production-runtime/src/agent-session-reply-wait.js
                production-runtime/src/agent-session-messaging-audit.js
WHOLESALE ×11   broker/src/{gateway,relay,mapping,schema}.js
                agent-router/src/{index,ingress-delivery,parent-rpc-relay}.js
                agent-router/src/process/turn-execution.js
                production-runtime/src/notification-ingress-runtime.js
                demo-server/src/{index,session-seam}.js
COMPOSED ×2     broker/src/index.js        = LIVE + 恰 4 个 ASM hunks
                production-runtime/src/compose.js = LIVE + 恰 ASM wiring（纯增量）
KEEP LIVE       其余全部文件——含 agent-provisioning/*、model-overrides.js、route-chain.js、
                transport.js、registry.js、forum.js、workflow.js、scheduler*、
                feishu-connector、scheduler-router、demo-server 以外一切
```

`DEPLOYMENT_CLOSURE != latest-main whole tree`；目标是 `live baseline + ASM-only delta`。

## 4. FRESH_LIVE_PREIMAGE 与 ROLLBACK

- 部署 vehicle 在执行任何写之前必须 fresh 冻结全部 17 路径的 preimage
  （bytes+owner+group+mode+tz 证据；任一路径 preimage 与普查时点 blob 不同 → STOP，
  仅允许经 fresh 复核后按 §7 差异分类继续或终止）。
- **ROLLBACK = equal-face restore**（17 路径 byte+metadata 精确恢复；NEW×4 = 删除），
  失败即 ROLLBACK_INCOMPLETE 终态并保留现场。沿用已验证的
  RESTORE_ASM_RELEASE_OWNER.sh 等价机械（r3 轮五次干净回滚 + 一次部署后恢复的先例）。

## 5. ASM_NO_FLEET_COUPLING_GATE（全为 NO 才可部署）

```text
DEPLOYMENT_CLOSURE_TOUCHES_MODEL_OVERRIDES        = NO（face 无 model-overrides）
DEPLOYMENT_CHANGES_FLEET_CREDENTIAL_TOPOLOGY      = NO（face 无 agent-provisioning/credential）
DEPLOYMENT_REQUIRES_DSH_CODEX_STAMP_CHANGE        = NO（face 无 six-field/stamp 字节）
DEPLOYMENT_REQUIRES_HARNESS_IDENTITY_CHANGE       = NO（harness 在 repo 外，零改动）
DEPLOYMENT_ACTIVATES_SUBSCRIPTION_SIX_FIELD_DISCIPLINE = NO（六字段校验仅存在于
                                      main 世代 agent-provisioning——本 face 保留 live 4 字段版）
DEPLOYMENT_CHANGES_GLM_LUNA_ROUTE                 = NO（route-chain/model-overrides 不在 face）
DEPLOYMENT_CHANGES_PER_AGENT_CREDENTIALS          = NO
IMPORT_CLOSURE                                    = PASS（boot + 三套件 + census 证据）
另外（等义禁带）：Forum 面 = NO（forum.js/forum-moderation/sanitizer/registry 保留 live）；
Scheduler/History 面 = NO（scheduler*、scheduler-history*、scheduler-invoker 保留 live）；
Workflow 面 = NO（workflow.js 保留 live）。
```

## 6. CURRENT_GRANT_STATE = LEGALLY_RESOLVED（§15 case 1：复用，不写 DB）

- live 行：mc_cF81DF-XND9Zmzao4F08rOK_（uuid 695d1eeb…）× agent-session-messaging ×
  {agent.session.send} × version 2 × revoked_at NULL（唯一行；client/principal active）。
- 覆盖 authority：auth PR #50 MERGED
  `AUTH_SERVICE_AGENT_SESSION_SEND_OPERATIONAL_GRANT_V1`（PERMANENT_OPERATIONAL，
  tuple 精确匹配）。version 1→2 为单调再激活计数（车辆写 v1；部署 assertGrantState 仅
  version<1 fail-closed）→ 功能等价，MISMATCH=NO。
- 本 spec 零 Grant/audience/credential 变更；禁止重复插入、fleet-wide grant、
  target-side grant、顺手 scheduler.audit。

## 7. DEPLOYMENT_VEHICLE 与 OWNER_EXECUTION_PLAN

- 复用 r3 已验证 vehicle 形态（stage-first、census、sealed inputs、preimage gate、
  temp+rename 原子替换、launchd 单次 kickstart、read-back 验证、失败→preimage 恢复、
  root-owned receipt），以 17-file manifest 重建：
  `RUN_ASM_STANDALONE_OWNER.sh`（Owner 本机 sudo 授权执行，一次交互）。
- 车辆在任何 mutation 前依次强制：fresh preimage census → §5 Gate 终判 →
  stage closure 校验 → 才进入写阶段；任何一步失败 = 零写 STOP。
- FULL_PREMUTATION_SIMULATION 必须在零生产 mutation 沙盒先 PASS（§18 failure
  families 全覆盖）后才允许生成最终制品。

## 8. RECEIPT_SCHEMA 与 POST_DEPLOY_PROOFS

receipt（root-owned，/Users/Shared/agent-core-deployment-receipts/）至少含：
schema id、result、17 文件 before/after sha256+mode、apply/rollback restart counts、
health、fresh generation 证明。

部署后必须从**真实 runtime**（非 source grep / 非 Agent 自述）证明：

```text
ASM_RUNTIME_VISIBLE     = YES（catalog 20 manifests 含 agent_session_send）
ASM_SCHEMA              = accepted AGENT_CORE_AGENT_SESSION_MESSAGING_V1 逐字段一致
ASM_ALIASES             = ABSENT（a2a_send/sessions_send/send_message 不存在）
WORKFLOW_EXECUTE        = 仍可用（7 workflow manifests 在场）
SCHEDULER               = 仍可用（scheduler manifest 在场，loop online）
FORUM_FACE              = UNCHANGED（仍 7，moderator=0）
FLEET_GENERATION        = UNCHANGED；MODEL_OVERRIDES = UNCHANGED（hash 对比）
RUNTIME_HEALTH          = PASS（/health ok；旧 pid 退出 + 新 pid 存活）
```

## 9. CANARY（ONE real A2A）

- source = agt_efficiency-agent（生产凭据走 mc_cF81DF × agent.session.send token；
  负向对照：wrong-scope/wrong-audience 不得出 token）。
- target = blog-agent canonical main；消息 `A2A-CANARY-<uuid>`，只确认收到。
- 机械证明：SOURCE/TARGET 身份、TARGET_SESSION=canonical main、NEW_RUN_COUNT=1、
  NEW_TURN_COUNT=1、DELIVERY_COUNT=1、TARGET_OWN_PRINCIPAL/ CREDENTIAL=PASS、
  SOURCE_CREDENTIAL_PROPAGATED=NO、AUTO_PING_PONG=NO、EXACTLY_ONCE=PASS。
- 部署后最小回归（只读/轻量）：auth health、runtime health、workflow_execute、
  scheduler、agent_session_send 面——不重跑 Scheduler production canary。

## 10. Lifecycle

author（本 spec）→ ONE independent review（仅回答
`SAFE_TO_DEPLOY_ASM_WITHOUT_MODEL_FLEET_CHANGE = YES|NO`，一次冻结 blocker union）→
one repair → ONE re-audit → Owner exact-head acceptance → lifecycle/merge（docs）→
artifact + FULL_PREMUTATION_SIMULATION → Owner 执行包（sudo 部署 + 飞书 canary 压到
一次 Owner interaction）→ §8/§9 证明 → PRODUCTION_READY。

STOP 条件：fresh main 移动触碰 face 文件 blob；fresh preimage 与普查 blob 漂移；
§5 Gate 任一翻转；sim 任一 family FAIL——任一触发即终止本轮并重出证据，不得带伤部署。

## 11. BOUNDARIES

- 本 spec 为 docs-only 改动（goal branch goal/asm-standalone-production-v1）；
  packages/ 源码零改动（SOURCE=REUSED；组合产物仅存在于 deployment-artifacts 并被本 spec
  blob-pin）。svc-workflow/auth-service/生产零访问超出只读；GRANT_CHANGE=NONE；
  PRODUCTION_CHANGE=NONE（本 spec 自身）。
- 反耦合（goal §26）：本 spec 不引入通用 plugin framework、不重构 compose、不改 Session
  Model、不加 model-facing alias；extra telemetry/文档美化 = FOLLOW_UP_DEBT。
