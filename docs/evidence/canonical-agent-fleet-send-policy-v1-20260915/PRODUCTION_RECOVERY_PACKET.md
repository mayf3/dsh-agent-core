# CANONICAL_AGENT_FLEET_SEND — PRODUCTION_RECOVERY_PACKET v1

- date: 2026-09-16
- stage: WAITING_FOR_PRODUCTION_RECOVERY_GATE（SOURCE_FIXED=YES / PRODUCTION_FIXED=NO）
- 前置已完成：PR #75 merged @ merge commit 587c7199c0d626c595c4da8603a6135a7677305f
  （exact reviewed head 7741b76 逐字进入 main；fresh gate 三条件在 merge 前全绿：
  head=7741b76 ∧ main=2e660cd ∧ MERGEABLE）
- 本 packet 覆盖 Owner 指定的准备步骤 1–6；**步骤 7（--apply）及之后全部需要新的
  production authorization，本 packet 不构成授权**。

## 1. Fresh deployed-version / current-main readback（09-16，只读）

```text
CURRENT_MAIN_SHA                = 587c7199c0d626c595c4da8603a6135a7677305f
MERGE_COMMIT_SHA                = 587c7199c0d626c595c4da8603a6135a7677305f
ACCEPTED_DSH_R4_AUTHORITY_PRESENT      = YES（dsh origin/main 79efa45，status=accepted）
ACCEPTED_AUTH_LOCAL_AUTHORITY_PRESENT   = YES（auth main，status=accepted）
MAKE_LAWFUL_IMPLEMENTATION_PRESENT      = YES（main: fleet-send-grant.ts 符号 10 处）
TRANSACTIONAL_CREATE_GRANT_PRESENT      = YES（main: idempotent.ts L530 store.$transaction）
P2002_CONVERGENCE_PRESENT               = YES（isUniqueViolation + 胜者收敛）
RECONCILE_APPLY_USES_PLAN_SCOPES        = YES（main: L396 scopes=[...entry.planScopes]）

DEPLOYED_RUNTIME（生产）：
  plist            = /Library/LaunchDaemons/com.auth-service.plist
  ProgramArguments = /usr/local/bin/node
                     /Users/yanfenma/workspace/project/
                     production-auth-service-session-trace-v2-r2-4e68f83ee4d3/
                     dist/src/server.js
  WorkingDirectory = 同目录（目录名钉住 4e68f83e 世代；目录非 git repo=导出拷贝）
  FLEET_SEND_CODE_IN_DEPLOYED = NO（src 与 dist 均无 fleet-send-grant.*——
                                 部署世代早于全部 fleet 实现）
  DEPLOYED_LAGS_MAIN = YES（4e68f83e 世代 ← main 587c719）
  HEALTH = OK（GET :4001/.well-known/jwks.json → kid=key-v1-20260721）
```

## 2. Production mutation lane / conflicting operation check（只读）

```text
MUTATION_CLASS_AUDIT_EVENTS_TODAY = 0（client.*/principal.*/fleet_send/grant 类零事件）
LAST_AUDIT_ACTIVITY = 2026-09-15T13:20:23Z（agt_hr-agent 正常 token issuance）
LANE = FREE（无进行中的生产 mutation / 无冲突操作）
备注：审计流自 09-15T13:20Z 后静默（hr-agent 常规 ~30min issuance 停止）——
不阻塞本 packet；若 DRY_RUN 前 lane 状态变化，执行前需重新确认。
```

## 3. auth-service redeploy plan + rollback（Owner 执行；sudo 墙）

```text
TARGET = main @ 587c719（含 fleet birth-stamp + make-lawful + P2002 收敛）

STAGE（零停机准备）：
  S1 mkdir /Users/yanfenma/workspace/project/auth-deploy-fleet-send-587c719
     git clone https://github.com/mayf3/auth-service.git <dir> && cd <dir>
     git checkout 587c7199c0d626c595c4da8603a6135a7677305f
  S2 npm ci && npm run build        # contract:v1:prepare + tsc → dist/
  S3 预检（不动生产）：
     node -e "import('./dist/src/lib/oauth/v1/fleet-send-grant.js').then(m=>\
       console.log('FLEET_MODULE_OK', m.FLEET_SEND_SCOPE, m.ENUMERATED_INDEPENDENT_SCOPES))"
     # 期望输出含 agent.session.send 与 agent.session.inspect_own_dispatch
  S4 sudo cp -p <现行部署目录>/.env <dir>/.env   # 保持 authsvc:authsvc 0600

SWITCH（一次交互）：
  X1 sudo cp /Library/LaunchDaemons/com.auth-service.plist \
       /Library/LaunchDaemons/com.auth-service.plist.bak-fleet-send-$(date +%Y%m%d%H%M%S)
  X2 sudo plutil -replace ProgramArguments.1 -string \
       "<dir>/dist/src/server.js" /Library/LaunchDaemons/com.auth-service.plist
     sudo plutil -replace WorkingDirectory -string "<dir>" \
       /Library/LaunchDaemons/com.auth-service.plist
  X3 sudo launchctl kickstart -k system/com.auth-service
  X4 readback：curl -s localhost:4001/.well-known/jwks.json | jq -r '.keys[0].kid'
     # 期望 key-v1-20260721；tail stderr log 无 boot error

ROLLBACK（等价恢复）：
  R1 sudo cp <X1 的 .bak> /Library/LaunchDaemons/com.auth-service.plist
  R2 sudo launchctl kickstart -k system/com.auth-service
  R3 health + audit 流恢复确认（回到 4e68f83e 世代；零数据后果——部署不含 DB 迁移；
     本实现零 prisma schema 变更，redeploy 是纯进程代切换）
```

## 4. reconcile --selftest（已执行，merged tree @587c719）

```text
RECONCILE_SELFTEST = PASS / SELFTEST_ALL_OK（3 fixtures：
  make_lawful_add_keep_normalize_multi_client / empty_fleet / audience_absent）
```

## 5. reconcile DRY_RUN（Owner 执行；DB/.env 墙=authsvc 侧）

```text
命令（在含 587c719 的 checkout 内、可读 .env 的身份下）：
  npx tsx scripts/reconcile-fleet-send-grants.ts          # 默认 DRY_RUN，零写
预期 readback（fresh 时点重算；09-15 基线 join=89）：
  PRODUCTION_CANONICAL_AGENT_COUNT ≈ 89（fixture 结构性缺席=4）
  SEND_ENTITLEMENT_MISSING_COUNT   ≈ 87（hr/efficiency 已有行→KEEP；
    若 HR inspection grant 已激活则其行为 KEEP[send+inspect lawful]——make-lawful 语义）
  plan 仅 ADD（+可能极少量 NORMALIZE）；零 DELETE；SKIP-nonfleet 计数即输出
回贴 stdout（census+plan JSON）给我做步骤 6 的 disposition review。
```

## 6. Disposition review gate（DRY_RUN 输出回贴后由本 Agent 出冻结 disposition）

```text
DISPOSITION_REVIEW_PENDING（等 5 的 stdout）
其后顺序（每步均需新的 production authorization）：
  7  reconcile --apply（须 exit 0 + POST_APPLY_VERIFICATION_OK:
     SEND_ENTITLEMENT_MISSING_COUNT=0）
  8  post-apply readback（audit 行 census 复算）
  9  §10.1 三路径（NEW_AGENT_PROVISIONING / EXISTING_FLEET_RECONCILIATION /
     DISABLE_REVOKE[disable 单向]）
  10 E2E A–F + readback 六阶梯 + Done When
```

## 当前状态

```text
PRODUCTION_DEPLOY=NO   AUTH_SERVICE_RESTART=NO   PRODUCTION_DB_MUTATION=NO
RECONCILE_APPLY=NO     GRANT_PRODUCTION_CHANGE=NO
PRODUCTION_MUTATION_PERFORMED=NO
NEXT_SINGLE_ACTION=PREPARE_PRODUCTION_RECOVERY_PACKET（本文件；随后=
Owner 按本 packet §3/§5 执行 redeploy 与 DRY_RUN 并回贴输出）
```
