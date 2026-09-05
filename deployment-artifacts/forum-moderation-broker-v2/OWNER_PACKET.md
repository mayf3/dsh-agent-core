# OWNER_PACKET — FORUM_ADMIN_MODERATOR_PRODUCTION_V1（forum-moderation-broker-v2）

- **Status**: READY_FOR_PRODUCTION_APPLY（本轮零生产 mutation）
- **Authority**: AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2（accepted, governing）+ AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1（accepted, auth github/main ae6da9a）
- **Source pin**: dsh origin/main 4bb01e0（broker 337/337 + 结构门禁 PASS fresh 重跑）；auth github/main ae6da9a
- **Consumer pin**: svc-forum@502cfca（生产容器 svc-forum:502cfca, 127.0.0.1:3460，运行中）
- **Frozen moderator identity**（V2 CTR-FMC-004 + CTR-FMG-001 双 accepted 钉死，无 Owner 选择项）:
  - Agent: `agt_course-community-agent-2`
  - Principal: `9f7cf4c5-7b2c-4239-9993-d9b2a2e0df56`
  - Client: `mc_hvEfjkJ5BTKA8HZXRmbzNVw0`
  - Grant 目标: [forum.moderate, forum.read, forum.write]（1→2 scope 扩张）

---

## §A Broker 部署闭包（WDA 文件级 manifest+preimage+receipt 模式）

目标目录 `/usr/local/libexec/agent-core/app/`。**只动下表 6 文件；`workflow.js`（live 53286178…）明确不触碰**（VISIT_ACTIVATION goal 拥有其 staged face 7a3df429… 的部署；两闭包文件不相交，后部署方 rebase）。

| # | 文件 | 动作 | preimage sha256 (live) | artifact sha256 (main@4bb01e0) |
|---|---|---|---|---|
| 1 | packages/broker/src/capabilities/forum.js | replace | 797a3fa6558f78d3229cd876f2dce7afa80cd46dcfe4c9783875bb3535b3cf5d | c3a5e044794e8e444ab87f94decfd8d56f073d6031e2d9b706755231bcd105ba |
| 2 | packages/broker/src/index.js | replace | 420a103223da402901fd5d4bf5dfb3d0676e7db18c5bbd3977722402140bc656 | 5a629aa477864b63170dff2d53ccd50f4aa2b9f53efec7df72d95d4d63981e94 |
| 3 | packages/broker/src/transport.js | replace | d6b81c108cb5d8b5556b88cc9148e12f5a02deeaf3de438f2bdb77095297b51c | 9454a6aef4adbe3c202aad1a24355a4ad6947ce1c5f848baf45b61c6063a7445 |
| 4 | packages/broker/src/capabilities/forum-moderation.js | add | （不存在） | 099931309716a86c6a37dc503c0b639deb512924fb74bb5e7abad1bdefcf2abb |
| 5 | packages/broker/src/error-detail-sanitizer.js | add | （不存在） | 6eb3307c8d20bced15464fcfac677d9cc6f1b5c44a65d17771a5b5e0f8470c6f |
| 6 | bundle-broker/cordis.patch.yml | replace | 97d5a5fdb2c670954482bda98ac7d440b9356ce5a072784bbf480d182c0613c7 | 5a3cb83eca3e31a3b37f0aa36f5403fe094a0514df963a584fa2649e2daff7b8 |

- `src/schema.js` live==main（5cf36f52…68a994）零动作；mapping/registry/relay/identity/gateway/credential 已一致零动作。
- config 语义：`forumModeratorAgentIds: ['agt_course-community-agent-2']`（main 制品已含）。child 仅当进程 DSH_AGENT_ID 精确在列才注册 8 个 moderator 工具；缺失/空/重复/非 agt_/畸形一律 fail-closed 零注册；normal pack 不依赖。
- 验证（apply 后）：
  1. read-back：6 文件 sha256 == artifact 列；`workflow.js` sha256 == 53286178…（未触碰证明）。
  2. runtime 重启后 health；moderator child（agt_course-community-agent-2）工具面恰含 8 moderator 工具；任一其他 child 零 moderator 工具。
  3. broker suite 在 4bb01e0 worktree 已 337/337（本轮 fresh）；部署轮免重跑，除非 main 再 drift。
- 回滚：6 文件按 preimage 表逆向还原 + 重启（WDA preimage/receipt 模式，与 deploy-r2 同族）。

## §B Auth 闭包（CTR-FMG-016 要素预置）

1. **重部署**：构建/部署 auth github/main ae6da9a → 新 `production-auth-service-ae6da9a…/` 目录 + launchd `com.auth-service` 重启（既有模式）。executable registry 随代码带 forum.moderate。
2. **Plan**（只读，无授权即可跑）：`npx tsx scripts/supply-forum-moderator-grant-v1.ts --plan --database-url <AUTH_DB_URL>` → 产出 canonical APPLY 文档 + sha256。
3. **Apply 授权**（`--apply` 本 build 无条件拒绝，需 Owner 出具 CTR-FMG-016 授权引用，绑定）：implementation commit `ae6da9a`；bundle 1.7.0 digest；APPLY-plan digest（步骤 2 输出）；pre-state snapshot/digest（svc-forum audience row + 该 client Grant 1 scope 现态）；operator；maintenance window；stop/start 命令；rollback = forward-migration 计划（CTR-FMG-017，绝不自动回滚）；state-verification 命令。授权落地形式 = 未来带 authorization-descriptor 的脚本 build 或 Owner 直接授权的等价单事务写入（同一 13-field audit envelope）。
4. **Verify**：`--verify-state`（只读）executable/DB audience 相等 + Grant 恰 2 scopes；`--verify-mint` 需独立授权引用，token 不落盘。
5. 顺序约束：§A 可先行（moderator 工具可见但调用会被 svc-forum 403 = fail-closed 正确表现）；§B 完成前 canary 的 positive 分支必失败。**推荐顺序：A → B → C**，一个生产窗口内完成。

## §C ONE_REAL_MODERATION_CANARY（定义；执行属生产 apply 轮）

Canary id（concrete）: `FORUM-MOD-CANARY-20260906-8QK4T`

1. **可见性正**: agt_course-community-agent-2 child 经 broker 列工具 → 恰含 8 个 moderator 工具。
2. **可见性负**: 任一非列表 child → 零 moderator 工具（且 normal 5 工具不回归）。
3. **全链只读 moderation**: moderator agent → Broker `forum_admin_unread` → Auth（forum.moderate token 签发）→ svc-forum `GET /api/admin/notifications/unread` → 200 JSON。
4. **真实 moderation 写**: moderator 用 normal `forum_create_thread` 自建一次性 thread（标题带 canary id）→ `forum_pin_or_feature_thread` set_pinned=true → 读回 pinned=true → set_pinned=false → `forum_delete_thread`（soft-delete）→ detail 校验 soft-deleted。
5. **scope fence 负**: 非 moderator 的 writer-only client 直接打 `PATCH /api/threads/{canary_thread}` → 403。
6. 判定: 1-5 全 PASS 且 broker 端 credentialCalls/tokenCalls 计数符合 V2 边界（sanitizer 无 secret 泄漏面）→ FORUM_MODERATION_PRODUCTION_ACTIVE=YES。

## §D Owner 决定项

- **OWNER_ACTION_REQUIRED = NONE（本轮）**。生产 lane 空闲后按 §A→§B→§C 继续 SAME GOAL 无需再问；唯一 Owner 触点 = §B.3 的 CTR-FMG-016 apply 授权引用（这是 accepted spec 自己规定的独立授权，非本 Goal 可自授）。
- 无需裁决项：moderator 人选已 frozen；V3 不实现；svc-forum 升级不在本 Goal。
