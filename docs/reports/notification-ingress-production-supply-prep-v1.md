# NOTIFICATION_INGRESS_PRODUCTION_SUPPLY_PREP — 注册 执行 (prep round) 报告

日期：2026-08-31 · TASK_NAME = 注册 执行 · TASK_TYPE = NOTIFICATION_INGRESS_PRODUCTION_SUPPLY_PREP
本轮产物：runner 准备 + 沙箱验证 + 只读生产盘点 + 两个真实公开 clientId 冻结。
**零生产写入、零部署、零 secret 落库/落盘（生产）、未执行任何生产 runner。**

## 1. Authority 核对（dispatch 目标 1/2）

| Authority | 状态（本轮盘点时） | 实现 merge 状态 |
|---|---|---|
| Audience CCR `AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1` | accepted（main） | — |
| 实现闭包 `..._IMPLEMENTATION_CLOSURE_V2` | accepted / contracts（main） | **PR #29 已 merge** @ `7110463`（Bundle 1.3.0→1.4.0，registry 6 Audiences，validate.mjs 单行 first-wave delta） |
| Client/Grant `..._SERVICE_CREDENTIAL_GRANT_V1` | 盘点时 **proposed**（PR #28 OPEN/Draft，未 merge；本轮报告如实记录） | §10 三文件 operator 闭包**未实现** |
| （后续事实）| 同一 Spec 经 PR #38（amend head `8bfb767` + acceptance `98518d5`）于 merge `05fcf40` **accepted / contracts**；冻结了与本轮相同的两个 clientId；`production_apply_authority = none`；integrated WIP runner 判定为 BLOCKED（CTR-NSC-005/006 Phase A/B 分离、DEC-NSC-003 拒绝采纳、DEC-NSC-004 Phase B 单一 all-or-nothing 单元） | 三文件闭包仍未实现（下一轮授权并执行） |

## 2. 生产事实（只读；auth_ro SELECT seam + HTTP GET + 文件元数据）

- `auth_audiences` 恰 5 行（adc-v2/svc-auth/svc-forum/svc-okr/svc-workflow，全部 active v1），与 main 1.3.0 registry 一致；NI audience 不存在；NI grant / `notification.deliver` scope 全库 0 行。
- `service:v1:*` principal/client 0 行；冻结 clientId 碰撞 0/318；principal census 198+10 agent、4+2 service。
- 生产 auth-service = LaunchDaemon `com.auth-service`（authsvc 用户）→
  `~/workspace/project/production-auth-service-3b2ae71c`（detached `0855dc5`，clean），`/api/health` 200 ·
  contract v1 · 1.3.0 · digest `15f9a591…`；54 条 migration 全应用，main 无新 migration（PR #29 为 bundle-only）。
- 部署先例 = 独立 deploy 目录（worktree，SHA 命名）+ plist 翻转 + bootout/bootstrap；`.env` authsvc 0600。
- bundle↔DB 校验为 per-audience 查找（`direct.ts`/`findV1AudienceMismatch`）：旧 binary 运行中先行插入第 6 行
  DB audience 不影响既有 5 个 audience 的 mint —— 这是 runner「DB 行先行、binary 后切」顺序的依据。

## 3. 冻结的两个真实公开 clientId（dispatch 目标 4）

生成规则 = §9.3/`STAGE_W_EXECUTION_V2` 格式（`mc_` + 24 字符 URL-safe base64，crypto RNG，独立 draw）：

```text
FORUM_CLIENT_ID    = mc_Ez8kTAKKvcf2pF40aoUM4q9M
WORKFLOW_CLIENT_ID = mc_uYu1fDfNHjzUlRQGJdTajz9n
```

生成时对生产库 live 校验 0 碰撞（318 clients）。**后续 PR #38 accepted Spec 已把这两个值原值冻结为
authority（`8bfb767` spec §Frozen/§9），即 clientId 供应目标已由 accepted Spec 确认。**

## 4. Runner（dispatch 目标 3）

`/tmp/run-authsvc-ni-supply-7110463-v1.sh`（Phase A 部署+audience 行 / Phase B client+grant 供应；
plan 默认只读、apply 需 root+确认短语、verify 只读；幂等 NOOP、冲突 fail-closed、Phase A 自动回滚、
secret 仅内存+单次原子写 destination、DB 只存 scrypt salt:hash）。

### 4.1 沙箱验证（一次性 postgres:16-alpine 容器 + stub launchd/health + VARIANT-A/B git 树）

矩阵 **65/65 PASS**（sealed run，transcript 见 evidence）：
S1 plan 零写入；S2/S2R 部署幂等（A2 CREATED→ALREADY_APPLIED，审计零新增）；S3 双 caller COMMITTED
（principal/client/grant/audit 同事务、legacy 数组恒空、destination 0600、**repo 自身 `verifyClientSecret`
对两份 secret 双 true**）；S4 精确重跑双 NOOP、destination 字节不变；S5a-d 四类冲突（audience 行漂移 /
scope 碰撞 / P4 冒名 / clientId 抢注）全部 exit 2 零写入；S6 单 caller P5 拒绝 + 另一 caller 独立成功；
S7 新版本不健康 → plist 字节还原 + audience 行补偿 + 回滚审计事件，exit 1；S10 secret handoff 失败 →
同 run 补偿删除、另一 caller 不受影响；S8 全部输出零 secret 泄露 + DB 仅 salt:hash。
S11（extra）：真实 `npm run build` 全流程（worktree@7110463 + 生产 node_modules 拷贝 + tsc +
contract:v1:prepare + validate PASS + built snapshot 6 Audiences + A4 digest 实测一致）。

### 4.2 并发会话对 runner 的外来加固（如实记录）

盘点后（PR #38 轮）发现 `/tmp` runner 被并发会话（Spec amendment 作者）加入保守修改：
(1) apply 前置硬门——Phase B authority 未 accepted 即 `fail "apply gated before first write"`；
(2) apply 后逐 caller `VERIFY_CALLER`/`SECRET_VERIFY` 校验失败强制 `RC=1`。两者与 accepted Spec 的
Phase A/B 分离语义一致、方向更保守。本轮 65/65 矩阵在「外来加固版去掉 (1) 硬门」的
`runner-validated.sh`（sha `9c25a5e3…`）上重跑通过；S6 的 rc 期望按外来语义（=1）更新并注记。
**当前 `/tmp` 文件（sha `5e6525b6…`）apply 被硬门完全封锁。**

### 4.3 与 accepted Spec 的关系（重要）

accepted Spec（`05fcf40`）判定本 integrated WIP runner **BLOCKED**：Phase A 与 Phase B 不得合并于一个
生产写事务/runner（CTR-NSC-005）；Phase B 的授权载体是 in-repo 三文件闭包（CTR-NSC-006，
`scripts/supply-notification-ingress-service-credentials-v1.ts` + conformance + test）；Phase B 为单一
all-or-nothing 单元（DEC-NSC-004，严于本 runner 的 per-caller 隔离）；`production_apply_authority = none`。
**结论：本 runner 的验证资产（矩阵、SQL 语义、冻结 clientId、生产事实）移交下一轮；runner 本身不得作为
生产执行载体。**

## 5. 最终字段（dispatch 要求）

```text
AUDIENCE_IMPLEMENTATION_STATUS = MERGED_TO_MAIN (PR #29 @7110463; 生产未部署: prod=0855dc5/1.3.0/5 audiences)
CLIENT_SUPPLY_STATUS = AUTHORITY_NOW_ACCEPTED (PR #38 merge 05fcf40; 冻结 clientId 与本 runner 一致);
                       三文件闭包未实现; 生产供应未执行; production_apply_authority=none
PRODUCTION_RUNNER = /tmp/run-authsvc-ni-supply-7110463-v1.sh (sha256 5e6525b6a5d50c3f24221414743b8da6bcd9b75f6e3591b57380b02b2236c3aa;
                    BLOCKED per accepted Spec —— 不得运行; 仅供 语义/验证资产 参考与下一轮三文件闭包实现)
OWNER_COMMAND = NONE (runner BLOCKED; 生产 apply 无授权)
FORUM_CLIENT_ID = mc_Ez8kTAKKvcf2pF40aoUM4q9M   (accepted Spec 冻结值)
WORKFLOW_CLIENT_ID = mc_uYu1fDfNHjzUlRQGJdTajz9n (accepted Spec 冻结值)
PRODUCTION_CHANGE = NONE
READY_FOR_INDEPENDENT_REVIEW = YES (验证资产与事实可供 注册 审计/执行 复核)
NEXT_TASK = 注册 执行 (CTR-NSC-006 三文件闭包实现, 已获 implementation_authority: contracts)
```

## 6. 边界

- 本轮零生产写入：生产 DB 仅 auth_ro SELECT；生产服务仅 HTTP GET /api/health；未运行任何 apply；
  未创建 Principal/Client/secret/Grant/Audience。
- 沙箱全部在一次性 docker 容器 + /tmp stub 中完成，已清理（容器删除、stub 进程停止、worktree prune）。
- `/tmp` 现存 runner 的外来修改未回滚（更保守，保留原状并封存副本入 evidence）。
- auth-service 仓库与 PR 未被本轮修改；dsh-agent-core 预存 WIP 未触碰；新增文件按显式路径提交。
