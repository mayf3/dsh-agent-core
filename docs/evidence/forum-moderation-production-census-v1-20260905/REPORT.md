# FORUM_MODERATION_PRODUCTION_CENSUS_V1 — REPORT

- **Goal**: FORUM_ADMIN_MODERATOR_PRODUCTION_V1（RESUME_GOAL, P1）
- **Phase**: CURRENT_AUTHORITY_AND_PRODUCTION_CENSUS（PHASE_LOCK=ON 第一轮）
- **Date**: 2026-09-05
- **Round type**: docs-only，零生产 mutation（PRODUCTION_APPLY_ALLOWED=NO，lane 被 Workflow/HR Goals 占用）
- **Terminal boundary of this round**: READY_FOR_PRODUCTION_APPLY（packet 见 `deployment-artifacts/forum-moderation-broker-v2/OWNER_PACKET.md`）

---

## 1. CURRENT_FORUM_MODERATION_AUTHORITY = RESOLVED

| Spec | status @ dsh origin/main 4bb01e0 | disposition |
|---|---|---|
| AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2 | **accepted**, spec_kind=implementation, authority_level=governing_spec, supersedes=[V1] | **current 唯一 accepted Authority — 本 Goal production target** |
| AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V1 | superseded（superseded_by=V2） | historical，机械 disposition |
| AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V3 | **proposed**（branch `docs/forum-moderation-capabilities-v3`，commit ddd589a，**未 merge 进 main**，implementation_authority=none，supersedes=[V2] 未生效） | **不阻塞 V2**；mentions/tag/review-readiness = FOLLOW_UP_DEBT / NEXT_GOAL，本 Goal 不实现 |

V2 钉住的外部 consumer：`mayf3/agent-forum@502cfca5`（§3.1）；auth 姊妹 spec：`AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1`（auth github/main，**accepted**）。

## 2. V3_DISPOSITION = PROPOSED（不阻塞）

V3 仅存在于分支（ddd589a，"docs: propose Forum moderation capabilities V3"），`git merge-base --is-ancestor ddd589a origin/main` = false。frontmatter `status: proposed`、`implementation_authority: none`。无 accepted semantic conflict（未 accepted 即无冲突可言）。不恢复、不实现、不顺手做完。

## 3. CURRENT_MAIN_IMPLEMENTATION = READY（fresh 证据 @ 4bb01e0）

V2 CTR-FMC-014 十二文件 closure 全部在 origin/main：

- `packages/broker/src/capabilities/forum.js`（431 行 face，normal 5 工具 + V2 增量）
- `packages/broker/src/capabilities/forum-moderation.js`（8 moderator manifests：forum_pin_or_feature_thread / forum_delete_thread / forum_delete_message / forum_resolve_thread / forum_archive_thread / forum_moderation_queue / forum_handle_report / forum_admin_unread，每个恰 [forum.read, forum.write, forum.moderate]）
- `packages/broker/src/error-detail-sanitizer.js`（case-insensitive scheme redaction，CTR-FMC-012/DEC-FMC-006）
- `packages/broker/src/index.js`（forumModeratorAgentIds zod config + fail-closed child 选择逻辑）
- `packages/broker/src/schema.js`、`mapping.js`、`transport.js`（generic deltas：nonBlank、PATCH allowlist、sanitizer seam）
- `bundle-broker/cordis.patch.yml`（`forumModeratorAgentIds: ['agt_course-community-agent-2']`）
- test：`forum-capabilities.test.js`、`generic-deltas.test.js`、`broker.test.js`、`transport.test.js`

**Fresh re-run（本轮，origin/main worktree /tmp/forum-census-main）**：

- broker suite：**337/337 PASS**（历史 203/203 之后 main 经 PR #171 等 drift，本轮重跑必要全集；含 7 normal 工具 frozen-projection 零回归断言 = EXISTING_FORUM_REGRESSION = NONE）
- 结构门禁 `node scripts/verify-code-structure.mjs --base 4bb01e0~1 --head 4bb01e0`：**exit 0 PASS，violations: 0**（46 条 WARNING 全部为存量 legacy 类：FILE_WARNING_LINES / TEST_LOGIC_IN_FIXTURE / GRANDFATHERED，无新增违规）

## 4. 生产 Broker census（/usr/local/libexec/agent-core/app，runtime pid 72082）

Live broker = **pre-V2 face**：

| 文件 | live sha256 | main@4bb01e0 sha256 | 状态 |
|---|---|---|---|
| src/capabilities/forum.js | 797a3fa6…f3cf5d | c3a5e044…d105ba | DRIFT（live 246 行无 V2 增量） |
| src/capabilities/forum-moderation.js | — | 09993130…cf2abb | **MISSING** |
| src/error-detail-sanitizer.js | — | 6eb3307c…0c6f | **MISSING** |
| src/index.js | 420a1032…0bc656 | 5a629aa4…81e94 | DRIFT（无 forumModeratorAgentIds wiring） |
| src/transport.js | d6b81c10…97b51c | 9454a6ae…3a7445 | DRIFT（inline sanitizer 旧 face、ALLOWED_METHODS 无 PATCH） |
| src/schema.js | 5cf36f52…68a994 | 5cf36f52…68a994 | **已一致**（无需动作） |
| bundle-broker/cordis.patch.yml | 97d5a5fd…0613c7 | 5a3cb83e…aff7b8 | DRIFT（无 moderator list config；现态 fail-closed 零 moderator 工具） |
| src/capabilities/workflow.js | 53286178…2c6c6c（authoring face, sha256） | blob 7a3df429（git blob id；对应 visit-activation staged artifact sha256 cfea06cd…） | **本 Goal 不触碰**——workflow.js drift 属 VISIT_ACTIVATION goal 的 staged 制品，两 goal 文件不相交，谁先部署另一个 rebase |
| mapping/registry/relay/identity/gateway/credential.js | — | — | 已一致 |

结论：生产 Broker 目前 normal Forum pack 正常、**8 个 moderator 工具零暴露**（缺文件 + 无 config，V2 OBS-FMC-002 默认行为成立）。

## 5. FORUM_MODERATE_GRANT_CLOSURE = AUDITED（路径审计，apply 本身属生产 mutation）

**生产 auth**：pid 56983，`/Users/yanfenma/workspace/project/production-auth-service-57258ec33…/`（launchd `com.auth-service`，system domain）。57258ec（PR #44 scheduler CCR merge）是 github/main ae6da9a 的祖先。

**Registry 现状**：

- 生产 57258ec：registry_version **1.7.0**，8 audiences，svc-forum registered_scopes = **[forum.read, forum.write]（无 forum.moderate）**。
- github/main ae6da9a：registry_version 1.7.0，8 audiences，svc-forum = **[forum.moderate, forum.read, forum.write]** ✓（grant supply 分支 3d60fdb 已 merge 进 main）。
- 机械证明：生产 executable 冻结 registry 不含 forum.moderate ⇒ wire 层不可能为 svc-forum 签发该 scope ⇒ 无论 DB 有无 grant 行，**moderation 前提当前硬不可用**（CTR-FMC-015 fail-closed 成立）。DB 直查不可行（.env 0700 authsvc、PG 密码不可得）——与既有 gotcha 一致；wire 门控已给出更强结论。

**Grant supply 机制（main 已备）**：

- `scripts/supply-forum-moderator-grant-v1.ts`：frozen tuple = agt_course-community-agent-2 / principal 9f7cf4c5-7b2c-4239-9993-d9b2a2e0df56 / client mc_hvEfjkJ5BTKA8HZXRmbzNVw0；TARGET_SCOPES=[forum.moderate, forum.read, forum.write]；单 Serializable 事务只更新 svc-forum audience registered_scopes + 该 client Grant 1→2 + 13-field grant_change_audits（CTR-FMG-004/007/010）；exact rerun = NOOP（CTR-FMG-008/009）。
- **`--apply` 在本 build 无条件拒绝（before any DB connection，CTR-FMG-016）**：生产 apply 需要后续独立授权（绑定 implementation commit、bundle digest、APPLY-plan digest、pre-state snapshot、operator、window、stop/start、rollback、state-verification——packet §B 已按此预置）。
- 与 accepted supply spec 的版本叙事差异（诚实记录）：spec/实现 authoring 时 bundle 版本为 1.5.0（RESERVED），后因 1.6.0/1.7.0 被会话/scheduler 占用，merge 3d60fdb 将内容并入 **1.7.0**（script 常量 BUNDLE_CONTRACT_VERSION='1.7.0'，registry 含 forum.moderate + scheduler 8 audiences）；change-log 1.5.0 条目保留历史语义增量记录、1.7.0 条目记 scheduler。这是已发生的 reconcile 结果，非本 Goal 冲突。

**闭包判定**：GRANT 闭包 = auth 重部署到 main（带来 executable registry + supply 脚本）→ `--plan` 出 APPLY 文档 → Owner 按 CTR-FMG-016 授权 apply（或 Owner 直接授权的等价写入路径）→ `--verify-state`。前三步的全部材料已就绪/审计；第四步 = 生产 mutation，等 lane。

## 6. SVC_FORUM_DEPENDENCY = READY

生产 svc-forum = docker 容器 `svc-forum`，image `svc-forum:502cfca`，127.0.0.1:3460，Up 6 days——**恰为 V2 §3.1 钉住的 deployed consumer commit 502cfca5**。

Wire 探针（unauthenticated，本轮）：

- `PATCH /api/threads/{id}` → 401（存在，auth-gated）
- `DELETE /api/threads/{id}` → 401
- `POST …/resolve` → 401；`POST …/archive` → 401
- `GET /api/reports` → 401；`GET /api/stats` → 401；`GET /api/admin/notifications/unread` → 401

§9.1 冻结 13 路由清单中被探针覆盖者全部 401（路由存在、由服务端 scope guard 把守）= 路由面 READY。repo main b9f11af（governance amendment accepted，触及 svc-forum/src+tests）**未部署**，不改变 deployed pin；若未来升级 consumer，需走既有 V2 零回归面——FOLLOW_UP_DEBT，非本 Goal blocker。

## 7. BLOCKER UNION（分类）

无 SHIP_BLOCKER。全部剩余项 = 生产 apply 轮的机械步骤（ packet 化完毕）：

| # | 项 | 分类 |
|---|---|---|
| 1 | Broker 5 文件部署（forum.js / index.js / transport.js 替换 + forum-moderation.js / error-detail-sanitizer.js 新增）+ bundle config 加 moderator list + runtime 重启 | PRODUCTION_APPLY 步骤（lane 占用） |
| 2 | auth 重部署到 ae6da9a + supply `--plan` + CTR-FMG-016 授权 apply + verify-state | PRODUCTION_APPLY 步骤（lane 占用） |
| 3 | moderator canary（定义完毕，见 packet §C） | PRODUCTION_APPLY 步骤 |
| 4 | agent-forum repo main（b9f11af）未部署的 governance amendment | FOLLOW_UP_DEBT |
| 5 | V3 mentions/tag/review-readiness | FOLLOW_UP_DEBT / NEXT_GOAL |

## 8. ONE_REAL_MODERATION_CANARY = DEFINED

见 `deployment-artifacts/forum-moderation-broker-v2/OWNER_PACKET.md` §C。要点：moderator child 恰见 8 工具 / 非 moderator child 零 moderator 工具 / `forum_admin_unread` 全链 200（forum.moderate-gated 只读）/ 自建一次性 thread 的 pin→unpin 真实写往返；negative = writer-only client 打 moderation 路由 → 403。canary id 必须 concrete（教训：勿用尖括号占位符）。

## 9. PRODUCTION_PACKET = READY

`deployment-artifacts/forum-moderation-broker-v2/OWNER_PACKET.md`：制品 sha256 前后像、部署顺序、验证命令、回滚（WDA preimage 模式）、CTR-FMG-016 apply 授权要素清单、两 goal 并发协调点（workflow.js 不触碰）。

## 10. 本轮边界声明

零生产 mutation：未改 /usr/local/libexec/agent-core/app、未动 launchd、未动 auth DB/Grant/registry、未动 docker svc-forum、未写任何凭据。新增仅 docs（本目录）+ packet 文件。临时 worktree /tmp/forum-census-main（测试用，不入库）。

## 11. 独立审计记录（INDEPENDENT AUDIT r1）

read-only subagent 全项机械复核（A Authority / B main 实现 / C 测试门禁复跑 / D 12 项 sha256 全查 / E auth 侧 / F svc-forum 探针 / G packet 语义一致性）：**全部 PASS，blocker 列表空，verdict READY**。3 项 minor（workflow.js 标识类型标注、门禁 warning 措辞、upstream 漂移）已在一轮修复内吸收（§3/§4 措辞修正），无需 re-audit（非事实性结论错误）。

Upstream 漂移备注（审计发现，pin 不失效）：census 后 origin/main 前移 4bb01e0 → 513c691（PR #121，仅 agent-router 测试文件，broker/spec 零变化）；auth github/main 前移 ae6da9a → bb5b6f2（docs-only lifecycle），registry 内容实测不变。packet 制品 pin（4bb01e0）与 auth pin（ae6da9a）继续有效；部署轮执行时以当时 main 的 broker/forum 面仍为上述 sha256 为前置校验。

