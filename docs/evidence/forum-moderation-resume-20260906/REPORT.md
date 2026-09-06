# FORUM_MODERATION_RESUME_RECONCILIATION_V1 — REPORT

- **Goal**: FORUM_ADMIN_MODERATOR_PRODUCTION_V1（RESUME_GOAL, P2_PARALLEL_NONPRODUCTION）
- **Phase**: FRESH_MAIN_AUTH_GRANT_AND_ARTIFACT_RECONCILIATION → READY_FOR_PRODUCTION_SLOT
- **Date**: 2026-09-06
- **Round type**: 零生产 mutation（PRODUCTION_APPLY=HOLD，Workflow P0 mainline 优先）。本轮产出 = fresh reconciliation + auth 侧有界机械适配（CASE B，含 accepted amendment）+ 测试/审计/merge + packet 刷新。
- **Terminal state of this round**: **READY_FOR_PRODUCTION_SLOT = YES / GOAL_STATUS = ACTIVE**

---

## 1. Census 判定（NEXT_EXECUTABLE_ACTION 要求的全部内部量）

| 量 | 值 | 证据 |
|---|---|---|
| DSH_MAIN | `600d4df`（PR #183 后；本轮 fresh fetch） | git |
| AUTH_MAIN | `efc808b`（**本轮 PR #59 merge 后**；reconcile 起点 a805556） | git |
| V2_AUTHORITY_CURRENT | **YES** | docs/specs/AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2.md @600d4df：status=accepted / governing_spec / supersedes=[V1] / superseded_by=null |
| SOURCE_IMPLEMENTATION_CURRENT | **YES**（dsh CASE A） | V2 12 文件闭包在 600d4df 与 census pin 4bb01e0 间仅 index.js +5 行（agent-principal-resolution wiring，PR #183，非 forum 语义）；4bb01e0 是 600d4df 祖先 |
| FORUM_MODERATION_CAPABILITY_REGISTERED_IN_SOURCE | YES | forum-moderation.js 8 manifests @main（sha 09993130… 与 census 制品逐字节同） |
| FORUM_MODERATION_PRODUCTION_GRANT | **ABSENT**（现态仍无 Grant 行；但 registry 侧已 READY——见 §2） | 生产 auth runtime contract 1.8.0 + 本轮 supply 尚未执行（apply 属生产 mutation） |
| CURRENT_MINIMAL_SOURCE_DELTA | **NONE**（broker 侧零代码改动） | 闭包 12 文件 diff 4bb01e0..600d4df 仅 index.js +5 wiring |
| CURRENT_MINIMAL_AUTH_DELTA | **已实施并 merge（PR #59）**：vehicle Bundle pin 1.7.0→1.8.0 + CTR-FMG-008 恰增一条合法前置态（见 §3） | auth github/main efc808b |
| NEW_AUTHORITY_REQUIRED | **NO 新产品权威**；auth 侧走 focused mechanical amendment（supersedes=[]，父 Spec 字节不动） | AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_BUNDLE_RETARGET_V1（accepted） |

## 2. 生产真值漂移（相对 census 20260905）——驱动本轮的三个事实

1. **auth 已重部署至 a805556 代（launchd com.auth-service，pid 16929 观测）**：runtime contract **1.8.0**、registry_version **1.8.0**（9 audiences，CCR-EAPR-001 commit 10eb345 带 agent-principal-resolution），svc-forum registered_scopes **已 = [forum.moderate, forum.read, forum.write]**。⇒ census 时的「auth 重部署」apply 步骤**已消失**；同时 vehicle 的 `BUNDLE_CONTRACT_VERSION='1.7.0'` 钉死使其 `--plan` 对现役 bundle **pre-classification 拒绝** = 车辆失配。
2. **bundle 1.8.0 重部署可能已把 DB audience 行推进到 target**（registry 携带 target entry 的合法产物）——父 CTR-FMG-008 把一切 mixed 态定为永久 conflict，将封死唯一 sanctioned 完成路径。⇒ 需要恰一条 amendment：Audience@exact-target + Grant@source + 无 FMG audit → APPLY `UPDATE_GRANT_ONLY`。真实 DB 行无需预探（凭据边界）；apply 时 `--plan` 机械分类两种合法形态。
3. **broker 生产面仍 PRE_V2 且更干净**：fresh 逐文件对照（600d4df 全量 broker src+config vs live）差异**恰 6 文件**全为 V2 forum 闭包；workflow.js live==main（cfea06cd…，WDA r2 部署后）⇒ census 时的跨 goal workflow.js 冲突 lane **自然消除**。broker runtime pid 68793（ai.agent-core.runtime）。

## 3. 本轮实施（auth CASE B 有界机械适配）

**DEVELOPMENT_PREFLIGHT**：governing accepted Spec = AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1（contracts）；变更触及其 CTR-FMG-008 冻结矩阵与 bundle pin → 依协议先出 amendment Spec 再实现；产品语义权威（dsh V2）不动；V3 不复活；形态 = 最小 mechanical retarget，禁止 refactor。

三个 commit（branch `agent/fmg-grant-supply-bundle-retarget-v1` → **PR #59 merged @ efc808b**）：

1. `41b9f19` **spec authored (proposed)**：`docs/specs/AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_BUNDLE_RETARGET_V1.md`（162 行；CTR-FMR-001 pin / 002 前置态矩阵 / 003 plan 文档判别域与 digest 两两相异 / 004 conformance 矩阵扩展；ALT 三项拒绝记录；production boundary 继承 none）。
2. `b22785c` **implementation**（恰 3 文件，+126/−31）：supply 脚本（pin 常量、classify() `audiencePreSynced`、canonicalPlanDocument 判别域 `UPDATE_GRANT_ONLY`、target 态 audit 接受恰两个 APPLY digest、applyChange 条件跳过 Audience UPDATE——行字节不动、reportPlan/runPlan surface）；测试（冲突矩阵移出「Audience target with source Grant」、新增 2 正向用例：redeploy-prestate 只读 plan digest 相异 + Grant-only apply 全链断言、bundle 字面量 1.8.0）；harness 前置 pin。
3. `fc2bf0c` **exact-head acceptance 事务**：status proposed→accepted + index 行 + 审计 minor 措辞吸收。

**测试（本轮 fresh）**：conformance harness（一次性 tmpfs postgres，sha 钉镜像）**33/33 PASS**（原矩阵 31 + 新 2），含 14 个 drift fixtures 全零写、`FMG_TEMP_DB_CONFORMANCE=PASS`、`FMG_CONFORMANCE_CONTAINER_ABSENT=true`。

## 4. 独立审计（INDEPENDENT AUDIT r1——本 Goal 本轮恰一次）

read-only subagent（fresh context）：**VERDICT = ACCEPT，BLOCKERS = []**。

- A diff 恰 4 文件、无越界 hunk；B 父不变量逐项字节 preservation（identity/scope 常量、envelope keys、`PRODUCTION_APPLY_AUTHORITY='none'` pre-connection 拒绝序、7 锁+advisory+Serializable、反向 mixed 仍 conflict、audience 非范围字段检查含 version===1、foreign forum.moderate 检查）；C 判别域/digest 两两相异（机械复算 3fc7198f…/0a1f2337…/8c137397…）+ target 态 audit 恰接受两个 APPLY digest；D 测试无弱化、removed 场景被两个正向用例覆盖；E 审计员**独立复跑 harness 33/33 PASS**；F 零 secret。
- **对抗性探测全负**（6 条）：不存在使 Audience 行被非字节精确谓词写入、Grant 更新被跳过、audit 双写、无 governed audit 到达 NOOP、反向 mixed 放行的状态。
- 4 项 minor（措辞×2、index 行、判别域复用确认）非事实性错误，acceptance commit 一轮吸收，按 census 先例免 re-audit。**BLOCKER_UNION = []（本轮冻结）**。

## 5. dsh 侧验证（CASE A 复验）

- broker suite @600d4df fresh worktree：**346/346 PASS**（census 337 后 main 经 WDA/authoring 增量，零失败）；focused：forum-capabilities **91/91**、generic-deltas **8/8**、transport **36/36**。
- 结构门禁 drift 窗口 `--base 4bb01e0 --head origin/main`：**1 VIOLATION** = `DIRECTORY_CHILD_LIMIT packages/production-runtime/test 21>20`——WDA-era 既有增量（非 forum 闭包、非本 Goal 造成）→ **FOLLOW_UP_DEBT**，不越界修。
- moderator Principal fresh 只读复核：agt_course-community-agent-2 / 9f7cf4c5-… / 论坛版主 / **active**，client mc_hvEfj… active 未吊销。
- svc-forum 容器：`svc-forum:502cfca` running（Up 7 days）= V2 §3.1 pin 未变。

## 6. Grant readiness（预置，未 apply）

TARGET_PRINCIPAL/AGENT/CLIENT = frozen tuple（fresh active 复核）；CAPABILITY = forum.moderate（唯一增量，禁 forum.admin/通配）；GRANT_PREIMAGE = source `[forum.read,forum.write]@v1`（apply 时 `--plan` 机械分类 audience 半区形态）；UNRELATED_GRANTS_DIGEST = `INVARIANT_GRANTS_SHA256`（client 全集 + 非 target/workflow grant 行 canonical sha256，apply 时绑定校验）；CREATE_OR_REACTIVATE = mechanically determined by plan；ROLLBACK = forward-migration（CTR-FMG-017）；apply 授权 = CTR-FMG-016 独立 Owner 授权引用（15 字段 descriptor 校验内建）。**本轮零 DB 写。**

## 7. Artifact / Packet

`deployment-artifacts/forum-moderation-broker-v2/OWNER_PACKET.md` 已刷新（2026-09-06）：§A 6 文件新 preimage/artifact 表（index.js 更新为 600d4df face c54b74cb…）+ 全量对照恰 6 文件声明 + kickstart 重启；§B 简化为 supply-only（plan→CTR-FMG-016 apply→verify-state，两种合法分类）；§C canary 不变（FORUM-MOD-CANARY-20260906-8QK4T）；§D OWNER_ACTION_REQUIRED=NONE（本轮）。无 secret。

## 8. BLOCKER UNION / FOLLOW_UP_DEBT

- **SHIP_BLOCKER = []**；**MECHANICAL_FIX = 无**（本轮零 blocker）。
- FOLLOW_UP_DEBT：① dsh 结构门禁 production-runtime/test 21>20（既有，WDA-era）；② agent-forum main b9f11af governance amendment 未部署（census 已记）；③ V3 mentions/tag/review-readiness（NEXT_GOAL，不复活）。

## 9. 本轮边界声明

零生产 mutation：未改 /usr/local/libexec/agent-core/app、未动任何 launchd、未写 auth DB/Grant/audit、未动 docker svc-forum、未 apply Grant、未写任何凭据。新增 = auth 三 commit（PR #59）+ dsh docs（本目录 + packet 刷新）。临时 worktrees /tmp/forum-resume-main、/tmp/fmg-retarget（测试/实现用，不入库）。

## 10. 终态

GOAL_STATUS = ACTIVE / CURRENT_PHASE = READY_FOR_PRODUCTION_SLOT / READY_FOR_PRODUCTION_SLOT = YES / SOURCE = READY / GRANT_VEHICLE = READY（accepted amendment 在 auth main）/ ARTIFACT = FROZEN / PACKET = READY / ROLLBACK = READY / WRONG_TARGET_NEGATIVES = PASS（harness 负矩阵 + broker fail-closed 设计）/ BLOCKERS = 0 / PRODUCTION_APPLY = HOLD（等生产 slot；slot 空闲后按 packet §A→§B→§C 自动 resume SAME GOAL）/ OWNER_ACTION_REQUIRED = NONE。
