# AGENT_CREDENTIAL_DRIFT_BOOT_HOOK_ROOT_CAUSE_V1 — Incident Forensics & Call-Path Census

- status: investigation（evidence authority；不授予实现权限）
- date: 2026-09-09
- phase: INCIDENT_FORENSICS_AND_CALL_PATH_CENSUS（PHASE_LOCK=ON）
- subject: agt_book-deconstructor-agent MachineClient（client mc_IbXwC…，principal 4b25917d-93df-496f-8715-afc9d734abc3）

## 1. Verdict

ROOT_CAUSE_MECHANICALLY_PROVEN = **PASS**。

**Root cause（E 类：operator/proof 脚本绕缝直写）**：
2026-09-07T12:41:37Z，`WORKFLOW_ASSIGNEE_CANONICAL_IDENTITY_RECONCILIATION_V1` goal 的 P4
dual-caller production proof（`p4-final.sh` step 2，内嵌 `p4-rotate.mjs`）以**裸 Prisma**

```js
await prisma.machineClient.update({ where: { clientId }, data: { secretHash: hashClientSecret(secret) } })
```

轮换了 agt_book-deconstructor-agent 的生产 MachineClient secret。该写：

1. 只写 `secret_hash`，**不写 `rotated_at`**（保持 NULL）；
2. **不产生任何审计/收据**（绕过 `rotateClientSecret`，无 `client.rotated` audit line）；
3. **不同步中央 credential store**（`/usr/local/libexec/agent-core/config/agent-credentials.json`，
   自 08-28 起未变）——新 secret 只写入 proof fixture
   `~/.agent-core/control/p4-agent-caller.secret`（yanfenma 0600）；
4. 目标被注释为 "ONE **unused** agent"，但该 Agent 实际持有活跃 workflow 业务（instance c4168be0，
   publishing 阶段），其 runtime 侧按调用读 store 的 credential 因此失效。

runtime boot（21:36:31Z 嫌疑）**被排除**：见 §5。修复（2026-09-08T05:06:37Z，bdcred-20260908.sh
rotate：DB hash+rotated_at+updated_at + store 原子换装 + re-mint PASS）为受控例外，语义正确。

## 2. 证据链（全部机械）

| # | 证据 | 来源 | 证明 |
|---|---|---|---|
| E1 | `=== P4 final proof 2026-09-07T12:41:37Z ===` | `~/workspace/deployment-artifacts/workflow-directory/p4-final.log:1` | proof 起始时刻与漂移行 `updated_at` **精确到秒**一致 |
| E2 | `ROTATED clientId=mc_IbXwCGnMH10uc9630c1xojFE secret_file=0600 yanfenma` | 同上 :5 | 轮换实际发生，目标是 book-deconstructor 的生产 client |
| E3 | Prisma schema `updatedAt DateTime @updatedAt` | auth-service `prisma/schema.prisma`（MachineClient） | 任何 Prisma update 必碰 `updated_at`；漂移行 updated_at=12:41:37Z（轮换时刻）且之后再未变 ⇒ 之后**无任何 Prisma 写** |
| E4 | `rotated_at` 从未设置（bdcred diagnose 输出 `rotated_at=-`） | E2E_FINAL_VERIFICATION_20260908.md | 写手未走 rotateClientSecret（canonical rotate 恒同写 rotatedAt，见 `src/lib/oauth/service.ts:315-321`） |
| E5 | 审计全史 `client.rotated` 出现次数 = **0**；无 09-07T12:41Z 邻域的任何 client 审计行 | `~/.openclaw/logs/auth-service.stderr.log`（64,993 行全量 tally） | p4 轮换零审计（脚本直接 prisma 调用，无 auditLog）——与 E3/E4 互证 |
| E6 | 12:43:01Z→21:31:38Z 连续 `v1.direct.issued`（用 P4 新 secret 的 proof 重跑/验证 mint，最后好 mint=21:31:38.441Z） | 同上审计日志 :57347-57385, 64255-64261 | 轮换后 DB 内 hash == hash(SECRET_P4)；21:31:38Z 时新 secret 仍有效 ⇒ **21:36:31Z boot 之后 hash 未再变** |
| E7 | 01:52:35.879Z/.952Z 首次 `v1.direct.failed credential_invalid`（此前该 client 从无 failed 记录） | 同上 :64343-64344 | store 侧（旧 secret）调用者首次 mint 即失败——**失败=store↔DB 失配，非 DB 再次漂移** |
| E8 | store 文件 mtime=Aug 28 09:38（bdcred preimage 备份 `agent-credentials.json.bak-bdcred-20260908T130637` 由 `cp -p` 保留原 mtime） | `/usr/local/libexec/agent-core/config/` | 漂移窗口内 store 未变 ⇒ 失配方向=DB 单侧被改 |
| E9 | 05:06:37.676Z `v1.direct.issued`（bdcred rotate 后 re-mint）；05:17:27/31Z publishing 自流转成功 | 同上 :64352-64362 | 修复收据闭环（canonical 语义恢复） |

时序（UTC）：

```
08-23 11:18:17  client.created（audit，principal 4b25917d）
09-07 12:41:37  ★ p4-final.sh 裸 Prisma rotate：hash 变，rotated_at 不变，零审计，store 不同步
09-07 12:43–15:10  v1.direct.issued ×20+（P4 新 secret 生效证明）
09-07 21:31:38  最后好 mint（新 secret 仍有效）
09-07 21:36:31  authsvc runtime boot（巧合事件，非写手——见 §5）
09-08 01:52:35  首次 credential_invalid（store 旧 secret 调用者首次出现）
09-08 05:06:37  bdcred rotate 修复（hash+rotated_at+store 换装+re-mint PASS）
09-08 05:17:31  publishing 自流转恢复（真实业务闭环）
```

## 3. WRITE_SURFACE census（ALL_PRODUCTION_CREDENTIAL_WRITE_PATHS = ENUMERATED）

约定：SH=UPDATES_SECRET_HASH，RA=UPDATES_ROTATED_AT，RC=WRITES_RECEIPT。

| WRITE_SURFACE | CALLER | TRIGGER | EXPECTED_USE | SH | RA | RC | IDEMPOTENT | PRODUCTION_REACHABLE |
|---|---|---|---|---|---|---|---|---|
| `service.ts rotateClientSecret` | machine-admin CLI / 服务内调用 | 显式 rotate 请求 | **唯一 canonical 轮换缝** | YES | YES（同写） | YES（`client.rotated` audit） | NO（每次真轮换） | YES（经 CLI） |
| `service.ts createClient` | machine-admin CLI | 显式 create | 新 client 新行 | 新行 | —（NULL 起点） | YES | NO | YES |
| `v1/idempotent.ts createOrGetClient`（POST /api/v1/clients） | broker provisioning 通道（`auth.identity.provision`） | agent ensure | **create-or-get 接缝**：已存在→零写返回；claim→只绑 externalRef；新建→INSERT 新行 | 仅新行 | — | YES（`client.created`/`client.resolved`） | YES | YES |
| `v1 ensureAgentCredential`（agent-credential-provisioning 包，worktree workflow-execution-v1） | Phase-A clean bootstrap | 显式供给 | store 有条目→**fail-loud** `existing_credential_resolution_required`；auth client 已存在→fail-loud；401→`rotationAllowed=false`（prerequisite-D 未就绪） | 仅新行 | — | YES | YES（同锁串行化） | 部分（包已链入 worktree 主干，生产 ensure 入口未接线） |
| `broker/src/credential.js` + `credential-store.js` | runtime broker gateway | 每次能力调用 | **只读** per-call 读 store；缺失 fail-closed | NO | NO | n/a | 读幂等 | YES |
| `production-runtime` boot（production-runtime.mjs→compose.js） | launchd `ai.agent-core.runtime`（authsvc） | runtime 启动 | 只装配 gateway/feishu 等；**零 credential 写**；store 缺失不 fail at boot、per-call fail-closed | NO | NO | n/a | n/a | YES |
| `scripts/bootstrap-provisioning-client.cjs` | operator（受控例外 TASK） | 一次性 bootstrap | raw SQL **INSERT-only** 新 `mc_prov_` 行；已存在→幂等 no-op；错 principal→EXCEPTION | 仅新行 | — | NOTICE 输出 | YES | YES（历史已执行） |
| `scripts/onboard-all-agent-runtime-credentials.ts` / `onboard-agent-clients-and-credentials.ts` | operator（08-25 fleet 播种代） | fleet onboarding | 可用即复用；否则 INSERT 新 `mc_oc_` 行；**从不覆写既有行** | 仅新行 | — | stdout 报告 | YES | YES（历史已执行） |
| `scripts/provision-domain-owner-machine-clients.ts` | operator | domain-owner 供给 | 复用 / 或 rotate（**hash+rotatedAt 同写**）/ 或新建；revoked 收拾同写 revokedAt | YES | YES（同写） | stdout（无 auditLog ⚠） | 部分 | 潜在（operator 触达） |
| `token-issuance.ts` / `token-exchange.ts` / `v1/direct.ts` / `v1/exchange.ts` | oauth /token 与 v1.direct | token 签发 | `verifyClientSecret` 只读验证；**零写** | NO | NO | `v1.direct.issued/failed` audit | 读幂等 | YES |
| `human-refresh.ts` | human OAuth v1 | refresh token 轮换 | human 域（非 MachineClient 表） | — | — | — | — | YES（不同表） |
| `p4-final.sh` / `p4-rotate.mjs`（goal proof 附件，2026-09-07） | operator/Agent proof | P4 proof | **缝外直写**：hash-only，无 rotated_at，无审计，无 store 同步 | **YES** | **NO** | **NO** | NO | **YES（本次事故写手）** |
| `bdcred-20260908.sh rotate` | operator（Owner 执行） | 事故修复 | 受控例外：raw SQL 同写 hash+rotated_at+updated_at + store 原子换装 + re-mint 验证 | YES | YES | YES（evidence dir 收据） | 有预检防重 | YES（已执行） |
| grant supply 族（temp-grant / operational-grants / grant_census 等） | operator | 授权供给 | 只写 `machine_access_grants`，不触 `secret_hash` | NO | NO | 部分 | 部分 | YES（不同列） |
| auth-service startup（server.ts） | launchd `com.auth-service` | 服务启动 | 无 machineClient 触达 | NO | NO | n/a | n/a | YES |
| Postgres 触达的其它 goal 脚本（run-b-and-supply=独立测试容器 auth_supply_test；dispose-92=只读凭据 mint+svc DB） | operator | 各 goal | 不写 machine_clients | NO | NO | — | — | 隔离/只读 |

**结论**：接受缝内（service/v1 idempotent/v1 ensure）**不存在**任何 "改 hash 不改 rotated_at" 的路径；
能做到这一点的只有绕缝直写（operator 脚本/裸 SQL），而生产上唯一实例即 p4-rotate（已证明）。
辅助系统性事实：审计全史 `client.rotated` = 0 ⇒ 生产从未走过 canonical 轮换缝——fleet 现存全部
credential lineage 都不是 rotate 形态，这正是缝外脚本得以成为"习惯路径"的土壤。

## 4. Root cause discrimination（A–H）

| 假设 | 判定 | 机械依据 |
|---|---|---|
| A. runtime boot hook 每次 ensure 误轮换 | **排除** | boot 路径 census：production-runtime/compose 只挂只读 gateway seam（compose.js:249-256），无任何 ensure/写；时序：漂移写发生在 12:41:37Z（boot 前 ~9h），且 boot 后 21:31:38Z 仍有新 secret 的成功 mint（若 boot 再改 hash，该 mint 必失败） |
| B. provisioning helper create-or-overwrite | **排除** | v1 `createOrGetClient` 本体审读：fast path 零写、claim 只绑 externalRef、secret 只随新行 INSERT（idempotent.ts:373-580）；book-deconstructor client 行 08-23 创建后从未重建（audit 仅一条 client.created） |
| C. legacy migration 重写 | **排除** | migrations 目录无 09-07 邻域迁移；漂移写有精确归因（E1/E2），无需 migrator 假设 |
| D. test/canary fixture 意外指向 production | **部分成立（放大器，非写手）** | p4 proof 本就是蓄意的 production proof（非"意外指向"）；事故点是它做了超出 proof 必要性的**破坏性轮换**且无恢复/同步设计 |
| E. direct SQL/operator bypass | **✔ 判定成立（root cause）** | §2 证据链 E1–E9 |
| F. 并发 provisioning race | **排除** | 单次单行写；updated_at 单点；无重复行/重复 client.created |
| G. store↔DB reconciliation 方向错误 | **排除（反向缺口成立）** | 不存在任何 reconciliation 作业（census 零命中）——正因"无对账"，DB 单侧轮换才得以潜伏 13h；这是缺口，不是写手 |
| H. 其它 | — | 无剩余假设 |

## 5. "boot hook" 嫌疑的正式开释

前轮时间线仅凭邻近性（最后好 mint 21:31:38Z → boot 21:36:31Z → 首失败 01:52:35Z）锁定 boot。
本轮机械证据推翻该归因：

1. **写点先于 boot 9 小时**且被 E1/E2/E3 精确归因于 p4-final.sh（updated_at 冻结在写点秒级，
   之后零 Prisma 写——若 boot 曾再写，updated_at 必然前移）。
2. boot 后 21:31:38Z 的成功 mint 证明 DB hash 仍是 p4 新 secret；首次失败（01:52:35Z）是
   **store 旧 secret 调用者第一次出现**，属必然失败，无需第二个写手。
3. boot 代码路径 census：零 credential 写（§3 行 6）。

## 6. Systemic fleet census（metadata-only）

方法：auth 审计日志全量（64,993 行）按 clientId 前缀聚类 issued/failed 形态学。DB 级复核
（`updated_at > created_at AND rotated_at IS NULL` 全表扫描）因生产 .env 为 authsvc 0600、
本地 trust 窗口需 Owner 授权而**挂起为 PENDING_OWNER_READ_ONLY_CHANNEL**；审计形态学已足以分类：

| clientId 前缀 | Agent | 形态 | 分类 |
|---|---|---|---|
| mc_IbXwC | agt_book-deconstructor-agent | 长期成功 → 12:41:37Z 后 store 侧全失败（新 secret mint 持续成功至 21:31:38Z） | **TRUE DRIFT（唯一）**，已修复+收据 |
| mc_cF81D | agt_efficiency-agent | 09-07 23:09/23:10 两次失败，前后同 credential 成功继续 | 调用侧噪声（dispose-92 邻域误用副本），非漂移 |
| mc_FdRIJ | hr-agent（legacy 命名） | 09-05/09-06 密集失败与成功交替，最后 issued (09-06 07:45Z) 晚于最后 failed (09-06 03:42Z) | 调用侧噪声（WDA/HR goal 配对作业期），非漂移 |
| mc_4Ud_9 | （无 issued 史） | 08-21→09-08 慢性 credential_invalid，从未成功过（svc-workflow + agent-session-messaging 两个 resource） | 调用侧永久错凭据（某 caller 配置陈旧），非 DB 漂移；建议定位并清理该 caller |
| svc-work… | svc-workflow-backend-v1 | 单次失败（09-07 21:31:56，supply 作业期） | 噪声 |
| 其余 fleet | agt_cto/hr/ceo/efficiency/itops/blog/… | 截至 09-09 持续 issued 成功 | store↔DB 一致 |

**AFFECTED_PRINCIPAL_COUNT = 1**
**BOOK_DECONSTRUCTOR_ISOLATED = YES**（同族根因=单一 p4 脚本单次执行；无其它 Agent 呈
"成功→失败突变且无轮换收据"签名；通用修复见 §7，无需逐 Agent 处置）

## 7. 不变量现状与最小修复候选（下一阶段输入，需 accepted Spec 后方可实现）

| 不变量 | 现状 |
|---|---|
| NORMAL_RUNTIME_BOOT_CHANGES_CREDENTIAL | **YES = NO-change**（census 证明） |
| NORMAL_AGENT_SPAWN_CHANGES_CREDENTIAL | **YES = NO-change**（agent-provisioning 只做 home/文件；child 零凭据，broker relay） |
| PROVISIONING_EXISTING_AGENT = IDEMPOTENT_NOOP | **YES**（v1 fast path 零写；v1 ensure 对既有条目 fail-loud 更强） |
| EXPLICIT_ROTATION_REQUIRED_FOR_SECRET_CHANGE | **形式上 YES，机制上 NO** —— 唯一缺口 |
| SECRET_HASH_CHANGE_WITHOUT_ROTATION_RECEIPT = IMPOSSIBLE_BY_DESIGN | **NO（本次事故即反例）** |
| ROTATED_AT_MATCHES_SECRET_GENERATION | 仅 canonical 缝成立；生产 rotate 史=0，实际由例外脚本承担 |
| CONCURRENT_PROVISIONING_CANNOT_ROTATE | YES（externalRef UNIQUE + 同锁；v1 契约测试在册） |
| NO_SECRET_DISCLOSURE | PASS（本轮全程零 secret bytes；仅 fingerprint/metadata） |

最小修复候选（按 goal 偏好"最低层"排序，均为 Spec 提案材料，未实现）：

1. **DB 层 fail-closed trigger**（auth 库，Prisma migration 携带）：`BEFORE UPDATE ON machine_clients`
   —— `NEW.secret_hash IS DISTINCT FROM OLD.secret_hash AND NEW.rotated_at IS NOT DISTINCT FROM OLD.rotated_at`
   → `RAISE EXCEPTION`。使 SECRET_HASH_CHANGE_WITHOUT_ROTATION_RECEIPT 在存储层即不可能；
   canonical rotate 与受控例外（同写 rotated_at）不受影响；p4 形态写直接被拒。
2. **轮换收据/对账作业缺失**：canonical `rotateClientSecret` 从未被生产使用（client.rotated=0）
   —— 运营面需要一个"DB+store 原子轮换 + 收据"的受控 helper（bdcred 模式产品化），
   并将该通道登记为唯一 operator 轮换入口。
3. **proof/测试脚本治理**：凡触达生产的脚本，破坏性 mutation（轮换/删除/授权变更）必须走
   显式授权缝 + 恢复设计（p4 教训）；建议在 .agents 协议层追加 checklist 项。

## 8. 本轮边界（诚实记录）

- DB 级全表 metadata 复核挂起（Owner 只读通道）；审计形态学结论在其覆盖面内完整。
- authsvc 生产 runtime 日志（/Users/authsvc/.agent-core/logs/）不可读（0700）；21:36:31Z boot
  锚点沿用前轮 E2E 文档记录，本轮以其代码路径 census + 时序矛盾完成开释，未重复取证。
- 未执行任何 production mutation；未读取任何 secret 明文；client_id 为标识符非机密。
