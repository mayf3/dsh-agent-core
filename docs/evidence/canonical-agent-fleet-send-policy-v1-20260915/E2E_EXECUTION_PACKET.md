# FLEET_SEND — §10.1/§10.2 E2E EXECUTION PACKET v1（冻结待授权）

- date: 2026-09-17
- 基线冻结：AUTH_SERVICE_DEPLOYED_MAIN @ **785d743** · FLEET_BACKFILL_APPLY=PASS（01:02:28Z，87 ADD/2 KEEP）·
  COUNT=89 · MISSING=0 · HR_INSPECTION_PRESERVED=YES · NORMALIZE=0 · DELETE=0
- 本 packet 只含准备与 fresh preflight；**不授权任何 mutation**。

## 0. Fresh safety gate（2026-09-17 09:0x 已实跑 + 执行时复跑项）

```text
PRODUCTION_HEALTH        = PASS（JWKS kid=key-v1-20260721，fresh）
AUTH_MUTATION_LANE       = FREE（apply 后审计仅 hr-agent 常规 issuance；零新 mutation 事件）
LIVE_SHA                 = 785d743（plist → auth-deploy-fleet-send-785d743/dist；fleet 模块在场）
CURRENT_MAIN             = 3cf7f684（已前进；bounded drift=纯 docs 2 文件
                           [machine credential rotation authority spec + README 索引]，
                           与 fleet/provisioning/runtime 零代码交集 → 已部署 785d743 仍有效；
                           下次维护窗口 re-sync）
MISSING_COUNT            = 0（01:02 apply 自验；此后零写入。执行时用 dbprobe 复跑确认）
PG_STATE                 = 稳定（checkpoint 正常；崩溃循环已终结；postmaster=yanfenma）
PARALLEL_AUTH_MUTATION   = 无（审计扫描；注意存在并行 auth-service lane[packet v2 作者]，
                           执行前需其确认无在途 mutation）
EXEC-TIME GATES（root，跑 E2E 前最后执行）：
  G1 vehicle dbprobe → tbl_insert/missing 复核（期望 KEEP=89 含 2 KEEP+87 新 ADD、MISSING=0）
  G2 审计扫描无新 mutation-class 事件
  G3 plist 未被第三方改动
```

## 1. NEW_AGENT_PROVISIONING_PATH（§10.1-1）

```text
TEST TARGET   agent_id = agt_fleetsend-e2e-agent（canonical 语法）
              external_ref = test:fleetsend-e2e-<run-uuid>
              principal_type = agent · display_name = "Fleet Send E2E Test"
CHANNEL       真实 HTTP provisioning 通道（必须走带 birth-stamp 的路由，禁用 DB 直连 CLI）：
              ① POST /api/v1/principals（external_ref+agent_id, type=agent）
              ② POST /api/v1/clients（同 external_ref → create+stamp 原子事务 T1）
              管理令牌 = svc-auth provisioner client（AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
              体系，凭据在部署侧 provisioning 包持久化存储；root 可读）换
              RS256(scope=auth.identity.provision, aud=svc-auth)
EXPECTED      ② 成功后 grant 行自动存在（birth-stamp，无任何手工 grant 步骤）：
              { audience='agent-session-messaging', scopes=['agent.session.send'], version=1 }
ACCEPTANCE    A1 SQL 断言 grant 行在场
              A2 OAuth client_credentials（scope=agent.session.send,
                 resource=agent-session-messaging）→ 200 issued（ entitlement 实证）
              A3 POST /v1/clients 响应 created=true 且 secret 正常返回（T1 无孤儿）
NOTE          本测试 agent 不注册 agents.json（auth 侧闭环；不进 runtime fleet/G1 集合）
```

## 2. DISABLE_REVOKE_PATH（§10.1-2）

```text
TEST TARGET   = §1 的同一测试 agent（专用测试主体，非业务 Agent）
PRE-STATE     active principal + active client + fleet grant（§1 产物）
ACTION        npx tsx src/cli/machine-admin.ts principal disable（root，staging tree；
              直接 DB 面——disable 无 HTTP 路由，spec 已冻结单向语义）
EXPECTED      再取 client_credentials token → DENY
              （v1.direct issuance invalidClient 'client_or_principal_inactive'，
               direct.ts L102 既有路径；broker 侧即 access_denied/credential_invalid）
终态/恢复规则  不恢复（disable 单向；该 agent 留存为 disabled 测试 fixture 并在
              evidence 记录）——不触碰任何真实业务 Agent
```

## 3. §10.2 E2E CASES（两层：L1 授权面=脚本化确定性；L2 投递面=真实 Agent 触发）

```text
CASE A  BIP → content-ops
        sender=agt_build-in-public-agent(mc_ohDTy) receiver=agt_content-ops-agent
        L1: token mint(scope=agent.session.send) → 200 ALLOW
        L2: Owner 发一条飞书给 BIP（要求把标记消息 agent_session_send 给
            agt_content-ops-agent）→ 验证 audit 出现 mc_ohDTy×agent-session-messaging
            issued + content-ops 收到（run/session 证据）
CASE B  learning-expert 转绿（原 29 次被拒路径）
        sender=agt_learning-expert(mc_rl_DL) receiver=agt_content-ops-agent
        L1: token mint → 200 ALLOW（对照：09-14/15 曾连续 machine_grant_missing）
        L2: Owner 飞书触发 learning-expert 真实首发 → audit issued + 送达
CASE C  canonical fleet ALLOW 对
        sender=agt_stock-agent receiver=agt_daily-thought-agent
        L1: 双向 token mint → 200 ALLOW
        L2: 常态 hr dispatch lane（每 ~30min 的 fleet 投递）= 持续共存证明
CASE D  fixture DENY
        sender=3 个 UUID fixture（agt_16cf59bc…/agt_f38685f2…/agt_fb7837711…）
        结构性 DENY：无 principal/clients（apply census notProvisionedAgentIds 在案）
        → 无凭据可发起 = credential 层即拒；SQL 证明零 client 行
CASE E  legacy/非规范 DENY
        legacy 主体（blog-agent 81c7fc7e 系、非 agt_ 老 principal 等）
        试图 agent-session-messaging token → machine_grant_missing DENY
        （live 证据：mc_LDcrv… 09-16T14:47Z machine_grant_missing——backfill 后
         非 fleet client 依旧被正确拒绝）
CASE F  HR inspection 共存
        SQL: HR grant 行 scopes 仍 = send(+inspect 若已授) 双 scope 且 version 未被
        reconcile 抬升（normalizeCount=0 已证）+ hr-agent issuance 审计持续
```

## 4. Production readback 六阶梯（goal §12）

```text
L1 SOURCE_PRESENT        git: main 含 fleet 实现（fleet-send-grant.ts 等）      [只读]
L2 AUTHORITY_ACCEPTED    dsh r4 @5dd41e2 + Auth 本地 spec @a7ca28e 均在 base    [只读]
L3 DEPLOYED_PRESENT      plist→staging@785d743；dist fleet 模块在场             [只读]
L4 MODEL_VISIBLE         agent_session_send 在 runtime 目录 + hr 持续发送实证     [只读]
L5 RUNTIME_READY         auth health PASS + PG 稳定 + issuance 流动              [只读]
L6 PRODUCTION_E2E        §10.2 A–F 全绿                                         [含 mutation]
失败条件：任一 L1-L5 值偏离冻结值 → STOP，不带伤进 L6。
```

## 5. CLEANUP_PLAN

```text
- 测试 agent：终态=disabled fixture 留存（无删除面；evidence 记档）
- external_ref/UUID：幂等通道记录留存（无害）
- pg_hba：已还原原状 ✓（AUTH_DB_CREDENTIAL_CLOSEOUT 格式）；grantfix 备份文件留存
- 5GB 膨胀文件：已消除 ✓（根因=grantfix 原地重写；vehicle 已改 tmp+mv 模式，教训记档）
- plist ProgramArguments 4 元素异常（node+staging×2+旧路径惰性 argv）：
  功能无损；列为 FOLLOW_UP_DEBT——清理需重启 auth 服务，随下次维护窗口执行
- 其余零清理（全程零 DELETE 承诺保持）
```

## 6. 冻结字段

```text
NEW_AGENT_TEST_TARGET   = agt_fleetsend-e2e-agent / test:fleetsend-e2e-<uuid>
                          （经 HTTP 幂等通道，验 birth-stamp+entitlement，终态 disabled）
DISABLE_TEST_TARGET     = 同上（principal disable → DENY 实证；不恢复）
E2E_CASES               = A–F（见 §3；L1 全脚本化，L2 需 Owner 飞书触发 2 条）
READBACK_LADDER         = §4 六阶梯（L1-L5 只读，L6 含 mutation）
CLEANUP_PLAN            = §5（测试 agent 留存 disabled；其余零清理）
PRODUCTION_MUTATION_REQUIRED = YES（①创建测试 principal+client[birth-stamp 自动 grant]
                              ②disable 该测试 principal ③L2 真实 Agent 发送[Owner 触发]）
CURRENT_BLOCKER         = NONE（技术面无阻塞；等待一次性 E2E production authorization）
READY_FOR_E2E_MUTATION_GATE  = YES
```
