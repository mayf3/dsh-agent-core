# AGT-FORUM-ADMIN-MODERATOR-INTEGRATION-V1 — 最终交接文档

TASK_NAME = 论坛 执行 · GOAL_NAME = FORUM_ADMIN_MODERATOR_READY_FOR_INTEGRATION_V1
DATE = 2026-09-03

## GOAL_STATUS

```text
GOAL_STATUS = READY_FOR_INTEGRATION
FORUM_ADMIN_MODERATOR_READY_FOR_INTEGRATION = YES
READY_FOR_INTEGRATION = YES
PRODUCTION_DEPLOYMENT = NOT_RUN
PRODUCTION_DB_CHANGED = NO
PRODUCTION_GRANT_CHANGED = NO
PRODUCTION_CHANGED = NO
SUDO_EXECUTED = NO
OWNER_ACTION_REQUIRED = NONE
```

## 完成条件对照（goal §19）

| 条件 | 值 | 依据 |
|---|---|---|
| FORUM_BASELINE_COMPLETE | YES | FORUM_BASELINE.json + FORUM_GAP_MATRIX.json（本 repo docs/investigations/，读 committed state，机械分类） |
| CREATE_THREAD_READY | YES | svc-forum POST /api/threads + broker forum_create_thread（accepted V2 spec）；author identity trusted；server-generated id/createdAt；幂等语义已记录（broker 写路径不自动重试；Idempotency-Key seam = FOLLOW_UP_DEBT） |
| MENTIONS_NOTIFICATION_READY | YES | explicit mentions 严格 400（canonical identity 解析，禁 @name 正则）→ durable forum_notification_facts（幂等 per recipient+sourceEventKey）→ unread/read_at 自服务；mention/watch 来源可区分；disabled-principal 政策 = 已记录 FOLLOW_UP_DEBT（验收 §9 caveat） |
| WATCH_UNWATCH_READY | YES | PUT/DELETE watch 幂等 + trusted identity + reply fanout + mention/watch 不重复 + archived/hidden/deleted 通知排除 |
| MODERATOR_SCOPE_READY | YES | svc-forum forum.moderate 执行面 + broker moderator pack（closed-list fail-closed）+ auth-service supply（v1.5.0，READY_FOR_INTEGRATION_HANDOFF=YES）；生产发放 = integration 阶段 Owner 动作（本 goal 禁止 GRANT_CHANGE） |
| PIN_FEATURE_READY | YES | /pin /unpin /feature /unfeature governance-gated + audited + broker 工具 |
| THREAD_CLOSE_ARCHIVE_READY | YES | close/archive/hide/restore + resolve 全状态机化（CTR-GOV-STATE 表驱动）；archive 收敛为 creator-or-governance（原 over-privilege 修复） |
| HIDE_DELETE_SEMANTICS_READY | YES | hidden = 治理可见性 overlay（普通 404 全表面）；deleted = terminal tombstone；HARD_DELETE_ALLOWED = NO（accepted CTR-DELETE-001）；USER_VISIBLE_REMOVAL=YES + AUDITABILITY_PRESERVED=YES |
| AUDIT_TRAIL_READY | YES | forum_audit_events append-only + 唯一 runtime writer（allowlist payload）+ 每治理动作同事务 actor/target/operation/timestamp/outcome + /api/admin/audit-logs |
| NORMAL_AGENT_SCOPE_PRESERVED | YES | 375/375 全量回归 PASS（含全部既有 suite）；self-service join/leave/lastReadAt/watch/read 保留 |
| EXCESS_PRIVILEGE | NO | F1（participant role 自授 waive）+ F2（FK 毒化）已关；archive governance-gated；requireAdminScope 零路由使用 |
| EXISTING_FORUM_REGRESSION | PASS | 375/375（审计者独立复现）+ typecheck + 3 verifiers + governance tool |
| INDEPENDENT_AUDIT | PASS | 论坛 审计 = PASS（12/12 CTR-GOV，READY_FOR_LIFECYCLE_ACCEPTANCE=YES）+ 边界/权限审计 = PASS（F1-F6 关闭）+ auth-service supply 审计 = PASS（见 evidence 目录三份报告） |
| PRODUCTION_DEPLOYMENT | NOT_RUN | 无生产访问/重启/迁移/Grant 变更；仅 isolated Docker Postgres + fixture |

## 交付物（repos / branches / SHAs）

### 1. mayf3/agent-forum（svc-forum 服务端 + Forum 治理 Spec）

```text
BRANCH = agent/forum-admin-moderator-integration-v1（worktree wt-agent-forum-admin-v1，基于 svc-forum clone）
BASE = origin/main e0f220f9bd4e72ece6697d2c8b4de15f614fd8d5
HEAD = b9f11af1ec44dd1f5c623c6e151b9a2bca6b425f
提交序列（e0f220f..HEAD）：
  bc6c99b feat: Forum governance V1（moderation lifecycle/mentions/notifications/audit/admin audit-log/CLI scope）
  a776cf4 fix: thread soft-delete 非空 reason（CTR-DELETE-001）
  5e2e311 fix: message soft-delete 非空 reason + 同事务 derived repair（CTR-DELETE-002）
  8990036 test: npm test 门禁确定性（H-1）
  fdfda7b fix: participant PATCH/DELETE 可见性+线程绑定（M-1）
  4cd84c0 refactor: 删除 unguarded status-writer 死代码（DEC-GOV-003）
  6f811e3 docs: 治理文档 editorial alignment（M-2/L-1）
  d2635ed fix: 边界审计 F1-F6 关闭（participant authority/FK poison/cross-thread reactions/hidden oracle/tombstone writes/pagination）
  b9f11af AGENT_FORUM_GOVERNANCE_AMENDMENT_V1_ACCEPTANCE（lifecycle/provenance-only，3 docs 文件）
NOT PUSHED（本环境无实例创建通道；L1 commit-msg 门禁按 ci-gate-guide.md Q1 披露式紧急通道提交，L2 实例补录与 L0 PR 门禁在 push/PR 时履行）
```

Governing Spec 状态：
- `AGENT_FORUM_GOVERNANCE_AMENDMENT_V1` = **accepted**（b9f11af 落章，§9 Acceptance Record：REVIEWED_SPEC_COMMIT=6f811e32，FINAL_ACCEPTED_HEAD=d2635edf，SEMANTIC_DELTA_AFTER_REVIEW=NONE，12 CTR-GOV-* contracts 激活，implementation_authority=contracts）
- `INV-AGENT-FORUM-NOTIFICATION-GOVERNANCE-EXTENSION-AMENDMENT-V1` = **adopted**（同事务；verifier 断言即生效断言）
- `AGENT_FORUM_CORE_INVARIANTS_V1` / `AGENT_FORUM_PRODUCT_DIRECTION_V1` 不变（accepted）

### 2. mayf3/auth-service（moderator scope 发放）

```text
BRANCH = audit/forum-moderator-grant-supply-v1 @ 8029c5f17a0ee2c1ace3c34ea64eceda88a96345（worktree wt-auth-forum-supply-audit-v1）
BASE = github/main @ 审计时点（其后 3 个 docs-only 提交，零产品文件漂移）
STATUS = 独立实现审计 PASS（REGISTRY_DELTA_CLEAN / FREEZE_GATES_PASS / SUPPLY_SCRIPT_SAFE / BOUNDARY_RESPECTED / READY_FOR_INTEGRATION_HANDOFF 全 YES，BLOCKERS=NONE）
内容 = minimal-auth-v1 bundle 1.4.0 -> 1.5.0：svc-forum registered_scopes + forum.moderate；supply script（frozen 单 principal、fail-closed、幂等、--apply 拒绝执行、PRODUCTION_APPLY_AUTHORITY=none）；32/32 conformance + 45/45 + 22/22 + 104/104 + tsc clean
```

### 3. mayf3/dsh-agent-core（本 repo，协调轮记录）

```text
BRANCH = forum/admin-moderator-integration-v1（worktree wt-dsh-forum-admin-v1，基于 github/main 205d9f74）
内容 = docs-only：FORUM_BASELINE.json + FORUM_GAP_MATRIX.json + 本 evidence 目录（3 份独立审计报告）
broker 侧零变更（accepted AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2 已覆盖 13 工具面）
```

## changed paths（agent-forum 分支，e0f220f..b9f11af）

svc-forum/src/{routes/{moderation,notifications,participants,reactions,reports,threads,messages,admin}.ts, lib/{governance.ts,data-access/{audit-store,notification-store,reactions,reports}.ts,middleware/{scope-guard,auth,forum-writer}.ts}}、svc-forum/src/utils/pagination.ts（新增）、svc-forum/prisma/migrations/20260831090000_add_governance_v1、17 个测试文件、openclaw-skills/agent-forum-access（CLI scope env）、docs/specs + docs/investigations（治理文档）。总计 51 文件量级（7 candidate commits 48 文件 + F1-F6 修复 17 文件 + acceptance 3 文件，有重叠）。

## DB migration requirements

- 17 个迁移全链（origin/main 16 + 20260831090000_add_governance_v1）。
- `forum_app` 角色必须先于 migrate deploy 存在（迁移 SQL 引用；一次性 DB 预备）。
- 迁移后执行 `node scripts/apply-lifecycle-indexes.mjs`（SQL-047/048 CIC 索引）。
- 全部 additive-only，无破坏性 DDL；回滚 = 恢复前一制品 + （如需）删 governance 索引/列（verifier 与迁移同进退）。

## scope/Grant delta（integration 阶段才执行，本 goal 未做）

1. auth-service：合入 supply 分支 -> 生产 DB 执行 supply 脚本 conformance 同款流程（真实 operator/approval 元数据）——audience scopes + 目标 moderator principal 的 machine_access_grants 1→2 + grant_change_audits。
2. broker：给目标 moderator agent 的 profile 增加 moderator manifest pack（forumModeratorAgentIds closed-list 配置，fail-closed）。
3. svc-forum：无 Grant 语义（scope 全从 JWT 读取）。

## production apply order（建议）

1. PR + 合入 agent-forum 分支（PR 描述带 Workflow: <实例ID>；L0 门禁 + L2 实例补录）。
2. PR + 合入 auth-service supply 分支；生产执行 supply script（先 PLAN，后显式 APPLY；真实元数据）。
3. svc-forum 部署新制品（17 迁移 + forum_app 角色预备 + apply-lifecycle-indexes）。
4. broker moderator pack 配置（forumModeratorAgentIds）+ 重载。
5. E2E 验证：moderator token 可见 moderator 工具面；close/hide/restore/pin/feature 审计行落库；mention -> notification fact -> read_at 闭环。
回滚：svc-forum 上一制品 + 迁移 additive（可保留）；auth-service grant 1→2 可逆（脚本幂等语义 + grant_change_audits 记录）；broker pack 移除即失效。

## notification delivery assumptions

- Forum 只记录事实（PD §4）：notification = forum_notification_facts 行（reason ∈ mention/watch/reaction/thread_notice/moderator_notice；read_at 自服务）。
- 无内建推送；外部 Feishu puller 未来消费 API/表——本 goal 未实现任何 sender（边界审计确认零外发代码）。
- 及时触达 = 轮询 /api/notifications（或 /api/me/notifications），不由 Forum 主动 ping。

## FOLLOW_UP_DEBT

1. disabled-principal mention 政策入 Contract（验收 §9 L3 caveat）。
2. transition-matrix 测试补全为字面穷举（action × status）循环（L1）。
3. batchMarkRead 统一可见性 guard + 测试（L2）。
4. hidden-reactions / hidden-derived-notification 专项探针（L4）。
5. thread-create participants[] 校验失败的整单回滚语义（L5：当前零 participant 行成立但 thread 行留存）。
6. /api/admin/audit-logs 分页测试补齐（F6 同 helper 已覆盖 notifications 侧）。
7. create_thread Idempotency-Key seam（当前契约：broker 写路径不自动重试）。
8. broker 面向 close/hide/restore/audit-query 的新 manifest（需对 AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2 家族做一次 amendment）。
9. broadcast：无 accepted audience contract——若 Owner 需要一次性受众通知，先最小 Spec（本 goal 按 §6/§15 记账未实现，无任意 prompt→全员通知路径）。
10. L1 workflow 实例补录（3 个 candidate 提交 + 本轮 2 提交共 5 次 Q1 紧急通道披露）。
11. 测试每文件常驻 server（消除 loopback churn 后可恢复并行）。
12. identity verifier SQL-029 阶段边界断言在全链迁移 DB 上必失败（origin/main 同样复现）——阶段边界设计债。

## 边界遵守声明

PRODUCTION_DEPLOYMENT=NOT_RUN；PRODUCTION_DB_CHANGED=NO；PRODUCTION_GRANT_CHANGED=NO；PRODUCTION_CHANGED=NO；SUDO=NO；osascript=NO；无生产重启/迁移/Grant/credential 变更；无真实 moderation/broadcast/notification blast。仅使用：isolated Docker Postgres（postgres:16-alpine，127.0.0.1:5591，conformance 自清理容器）+ fixture + 测试套件。用户主 checkout（dsh-agent-core/svc-forum/agent-forum/auth-service 的工作副本 WIP）零触碰；全部工作在独立 worktree（wt-agent-forum-admin-v1 / wt-auth-forum-supply-audit-v1 / wt-dsh-forum-admin-v1）一任务一分支完成。
