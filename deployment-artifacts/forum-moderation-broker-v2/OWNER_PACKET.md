# OWNER_PACKET — FORUM_ADMIN_MODERATOR_PRODUCTION_V1（forum-moderation-broker-v2）

- **Status**: READY_FOR_PRODUCTION_APPLY（2026-09-06 fresh reconciliation 刷新；本轮零生产 mutation）
- **Authority**: AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2（dsh，accepted, governing）+ AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1（auth，accepted）+ **AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_BUNDLE_RETARGET_V1（auth，accepted 2026-09-06，PR #59 @ efc808b）**
- **Source pin**: dsh origin/main **600d4df**（broker suite 346/346 PASS fresh @600d4df，含 focused forum 91/91 + generic-deltas 8/8 + transport 36/36）；auth github/main **efc808b**（PR #59：vehicle Bundle 1.7.0→1.8.0 retarget + redeploy-prestate Grant-only APPLY；独立审计 ACCEPT 0 blockers；harness 33/33 PASS）
- **Consumer pin**: svc-forum@502cfca（生产容器 `svc-forum:502cfca`, 127.0.0.1:3460，running——fresh 2026-09-06 复核未变）
- **Auth 生产现态（fresh）**: launchd `com.auth-service` → `production-auth-service-a805556…/`，runtime contract **1.8.0**，registry_version **1.8.0**（9 audiences），svc-forum registered_scopes **已 = [forum.moderate, forum.read, forum.write]** ⇒ **auth 重部署步骤已消失**，剩余 auth 侧动作 = grant supply `--plan` → CTR-FMG-016 授权 apply → `--verify-state`
- **Frozen moderator identity**（V2 CTR-FMC-004 + CTR-FMG-001 双 accepted 钉死，fresh 只读复核 active）:
  - Agent: `agt_course-community-agent-2`（论坛版主，status=active）
  - Principal: `9f7cf4c5-7b2c-4239-9993-d9b2a2e0df56`（active, disabled_at 空）
  - Client: `mc_hvEfjkJ5BTKA8HZXRmbzNVw0`（active, 未吊销）
  - Grant 目标: [forum.moderate, forum.read, forum.write]（1→2 scope 扩张）

---

## §A Broker 部署闭包（WDA 文件级 manifest+preimage+receipt 模式；fresh sha @2026-09-06）

目标目录 `/usr/local/libexec/agent-core/app/`。只动下表 6 文件。**跨 goal 冲突已消除**：`workflow.js` live==dsh main（cfea06cd…，WDA r2 部署后），本闭包不触碰且无并发 lane。

| # | 文件 | 动作 | preimage sha256 (live 2026-09-06) | artifact sha256 (dsh main 600d4df) |
|---|---|---|---|---|
| 1 | packages/broker/src/capabilities/forum.js | replace | 797a3fa6558f78d3229cd876f2dce7afa80cd46dcfe4c9783875bb3535b3cf5d | c3a5e044794e8e444ab87f94decfd8d56f073d6031e2d9b706755231bcd105ba |
| 2 | packages/broker/src/index.js | replace | 12931e1a9c8d83b766fa7cbc8d16d674042dbd68e92f48386f9549b7657607ef | c54b74cbbfe3b6fd453b06778a6a2cd799271da65a8141bd49e78e5a08af6205 |
| 3 | packages/broker/src/transport.js | replace | d6b81c108cb5d8b5556b88cc9148e12f5a02deeaf3de438f2bdb77095297b51c | 9454a6aef4adbe3c202aad1a24355a4ad6947ce1c5f848baf45b61c6063a7445 |
| 4 | packages/broker/src/capabilities/forum-moderation.js | add | （不存在） | 099931309716a86c6a37dc503c0b639deb512924fb74bb5e7abad1bdefcf2abb |
| 5 | packages/broker/src/error-detail-sanitizer.js | add | （不存在） | 6eb3307c8d20bced15464fcfac677d9cc6f1b5c44a65d17771a5b5e0f8470c6f |
| 6 | bundle-broker/cordis.patch.yml | replace | 97d5a5fdb2c670954482bda98ac7d440b9356ce5a072784bbf480d182c0613c7 | 5a3cb83eca3e31a3b37f0aa36f5403fe094a0514df963a584fa2649e2daff7b8 |

- **fresh 机械全量对照（2026-09-06）**：dsh main 600d4df 的 `packages/broker/src/**` + `bundle-broker/cordis.patch.yml` 逐文件 sha256 对照 live——差异**恰为上表 6 文件**；schema.js（5cf36f52…）/ mapping / registry / relay / identity / gateway / credential / **workflow.js（cfea06cd…）**全部 live==main 零动作。
- index.js 制品相对 census（4bb01e0@5a629aa4…）更新为 600d4df face（c54b74cb…）：仅追加 agent-principal-resolution 的 import/wiring（+5 行，WDA-era PR #183），V2 的 forumModeratorAgentIds wiring 语义不变。
- config 语义：`forumModeratorAgentIds: ['agt_course-community-agent-2']`（main 制品已含）。child 仅当进程 DSH_AGENT_ID 精确在列才注册 8 个 moderator 工具；缺失/空/重复/非 agt_/畸形一律 fail-closed 零注册；normal pack 不依赖。
- 验证（apply 后）：
  1. read-back：6 文件 sha256 == artifact 列；`workflow.js` sha256 == cfea06cd…（未触碰证明）。
  2. runtime 重启（launchd `ai.agent-core.runtime`，现 pid 68793；`launchctl kickstart -k system/ai.agent-core.runtime`）后 health；moderator child（agt_course-community-agent-2）工具面恰含 8 moderator 工具；任一其他 child 零 moderator 工具。
  3. broker suite 346/346 已在 600d4df fresh 重跑（本轮）；部署轮免重跑，除非 main 再 drift（届时以当时 main 的 forum 闭包 6 文件 sha256 仍等于本表为前置校验）。
- 回滚：6 文件按 preimage 表逆向还原 + `kickstart -k` 重启（WDA preimage/receipt 模式）。

## §B Auth 闭包（supply-only；CTR-FMG-016 要素）

**前置态（fresh 已证）**：生产 auth executable 已含 target registry（1.8.0 / svc-forum 三 scope），**无需 auth 重部署**。DB 侧 audience 行可能为 source `[forum.read,forum.write]@v1` 或已随部署推进到 target——两种均为 amendment 后合法前置态，`--plan` 在 apply 时机械分类，无需也不应手工探 DB（凭据边界）。

1. **Plan**（只读，无授权即可跑；在 auth main efc808b checkout 或同内容目录）：
   `npx tsx scripts/supply-forum-moderator-grant-v1.ts --plan --database-url <AUTH_DB_URL>`
   - 分类 A：`PLAN_CLASSIFICATION=APPLY` / `PLAN_OPERATION=UPDATE_AUDIENCE_AND_GRANT`（DB audience@source）——原路径，audience+grant+audit 三写。
   - 分类 B：`PLAN_CLASSIFICATION=APPLY` / `PLAN_OPERATION=UPDATE_GRANT_ONLY`（DB audience 已@target，Bundle-redeploy 产物，CTR-FMR-002）——恰 grant+audit 两写，audience 行字节不动。
   - 落盘 canonical plan 文档 + `PLAN_SHA256` + `INVARIANT_GRANTS_SHA256`。
2. **Apply 授权**（`--apply` 本 build 无条件 pre-connection 拒绝，CTR-FMG-016）：Owner 出具授权引用，绑定：implementation commit `efc808b`（impl head b22785c）；bundle_version `1.8.0` + bundle digest；`PLAN_SHA256`（步骤 1 输出）；pre-state snapshot/digest；operator；maintenance window/outage approval；stop/start（`launchctl bootout/bootstrap system/com.auth-service` 或既有重启模式）；rollback = forward-migration 计划（CTR-FMG-017，绝不自动回滚）；verify command。授权落地形式 = 带 authorization-descriptor 的脚本 build（15 字段 exact-keys 校验已内建）或 Owner 直接授权的等价单 Serializable 事务写入（同一 13-field audit envelope，plan digest 绑定 audit.reason）。
3. **Verify**：`--verify-state --expected-invariant-sha256 <INVARIANT_GRANTS_SHA256>`（只读）——executable/DB audience 相等 + Grant 恰 2 scopes + governed FMG audit 恰 1（reason 绑定实际执行的 APPLY 形态 digest）。`--verify-mint` 需独立授权引用，token 不落盘。
4. 顺序约束：§A 可先行（moderator 工具可见但调用会被 svc-forum 403 = fail-closed 正确表现）；§B 完成前 canary 的 positive 分支必失败。**推荐顺序：A → B → C**，一个生产窗口内完成。

## §C ONE_REAL_MODERATION_CANARY（定义；执行属生产 apply 轮）

Canary id（concrete）: `FORUM-MOD-CANARY-20260906-8QK4T`

1. **可见性正**: agt_course-community-agent-2 child 经 broker 列工具 → 恰含 8 个 moderator 工具。
2. **可见性负**: 任一非列表 child → 零 moderator 工具（且 normal 5 工具不回归）。
3. **全链只读 moderation**: moderator agent → Broker `forum_admin_unread` → Auth（forum.moderate token 签发）→ svc-forum `GET /api/admin/notifications/unread` → 200 JSON。
4. **真实 moderation 写**: moderator 用 normal `forum_create_thread` 自建一次性 thread（标题带 canary id）→ `forum_pin_or_feature_thread` set_pinned=true → 读回 pinned=true → set_pinned=false → `forum_delete_thread`（soft-delete）→ detail 校验 soft-deleted。
5. **scope fence 负**: 非 moderator 的 writer-only client 直接打 `PATCH /api/threads/{canary_thread}` → 403。
6. 判定: 1-5 全 PASS 且 broker 端 credentialCalls/tokenCalls 计数符合 V2 边界（sanitizer 无 secret 泄漏面）→ FORUM_MODERATION_PRODUCTION_ACTIVE=YES。

## §D Owner 决定项

- **OWNER_ACTION_REQUIRED = NONE（本轮）**。生产 lane 空闲后按 §A→§B→§C 继续 SAME GOAL 无需再问；唯一 Owner 触点 = §B.2 的 CTR-FMG-016 apply 授权引用（accepted spec 自己规定的独立授权，非本 Goal 可自授）。
- 无需裁决项：moderator 人选已 frozen（fresh active 复核）；V3 不实现；svc-forum 升级不在本 Goal；auth 重部署已因 1.8.0 现役而消失。
