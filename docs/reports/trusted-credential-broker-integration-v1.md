# TRUSTED_CREDENTIAL_BROKER_INTEGRATION_V1

> 状态：已完成实现 + 真实验收；**结论 = BLOCKED**（唯一阻塞 = 一次性 root
> bootstrap：本环境无法把 Router parent 以 uid 505 运行、无法把凭据 store 变为
> 505-owned —— 二者同源，代码与验收全部就绪，root 就位后同一脚本直接转 PASS）
> 日期：2026-08-15 · 分支：feat/trusted-credential-broker-v1（独立 worktree）
> 验收驱动：`scripts/trusted-credential-broker-v1-verify.mjs`（真实控制面进程 +
> 真实 per-agent DSH + 真实模型 turn + 真实 auth-service + 真实 svc-forum）
> Kernel：**KERNEL_CHANGE = NONE**（deepseek-harness checkout 零改动）

## 0. 一句话总结

把 Process Identity 的「child 进程内持凭据」模型替换为**冻结架构**：DSH
Agent child（无凭据无 token）→ 既有 parent RPC → trusted Router parent
（部署 uid authsvc/505）→ 进程内 trusted Broker gateway（505）→ 既有
client_credentials → JWT → Forum/Workflow/OKR。child 的 Broker 工具变成纯
relay，parent 依据**实际 proc.agentId**（而非 child 自报）决定 caller，从
505-private store 读取该 Agent 的既有 MachineClient credential。复用
`@agent-core/broker` 的 transport / client_credentials / token cache /
targets/manifests，零重新实现。

## 1. 冻结架构 vs 本轮交付

```text
DSH Agent child (uid 502, NO credential, NO token)
  → existing parent RPC (agentRpc → demo-server → Router.onRpcRequest)
  → trusted Router parent (deployment uid authsvc/505)
  → trusted Broker / credential boundary (in-process gateway, 505)
  → existing client_credentials → JWT → Forum / Workflow / OKR
```

| 要求 | 交付 |
|---|---|
| child 无 AGENT_CORE_BROKER_CLIENT_ID/_SECRET env 注入 | ✅（该注入已被 main 上的审计 Revert 移除；child 组合只挂 relay 模式 broker） |
| child Broker 工具 = relay：`{capabilityId, operation, args}` → `agentRpc.request('agent-core/broker', …)` | ✅ `packages/broker/src/relay.js`；child 不构造 transport、不读 env 凭据、不持 token |
| parent 依据**实际 proc.agentId** 决定 caller；不接受 child 自报 agentId/principalId/clientId/scope/audience/Authorization | ✅ Router `onRpcRequest` 用闭包里的 proc.agentId，伪造字段记录并忽略（`[broker] IGNORING child-supplied identity fields: …`）；gateway 签名只收 `{agentId}` |
| parent 从 505-private store 读取对应 MachineClient credential | ✅ `packages/broker/src/credential-store.js`（0600、fail-loud、每次调用重读支持轮换）；store 值永不进 child env/fs/wire/模型 |
| 复用 @agent-core/broker transport、client_credentials、token cache、targets/manifests、Auth/JWT/grants | ✅ `gateway.js` 直接复用 `createHttpTransport`/`createHttpHandlers`/`invoke`/`buildTargetMap`；BROKER_TRANSPORT_REUSED = YES |
| Broker 与 Router parent 进程内组合（优先进程内，无 localhost HTTP IPC） | ✅ gateway 是控制面同一进程的 `ctx.brokerGateway`；child 只经 parent-RPC 到达，无 socket 可连（A_DIRECT_TCB_ACCESS 实测无 listener） |
| Router spawn DSH child 降权到普通 Agent runtime uid/gid（502，非 per-Agent OS user） | ✅ `childSpawnConfig()`：DSH_AGENT_CHILD_UID/GID + DSH_AGENT_SPAWN_HELPER seam（505→502 需要 setuid-root helper，同属一次性 root bootstrap）；PER_AGENT_OS_USER = NO |
| 不做：新 Auth / 新 MachinePrincipal / 新 mapping table / per-Agent OS user / mTLS / TPM / keyring / container / Broker V2 / Kernel | ✅ AUTH_SYSTEM_CHANGE = NONE；唯一身份权威仍是 auth-service（client↔principal↔agent_id 映射原样） |

## 2. 代码变更（最小 delta）

- `packages/broker/src/relay.js`（新）：child 侧 relay handlers —— 转发
  `{capabilityId, operation, args}`，解两层信封（transport `{ok,result}` +
  business `{ok,result|error}`），失败 reshape 为
  `{errorCode,status,detail}`，RPC 通道异常 fail-closed。
- `packages/broker/src/gateway.js`（新）：parent 侧 trusted gateway ——
  按 capabilityId 找 http manifest（非 http 能力 fail-closed
  unsupported）；按 agentId 读 store（无条目 → credential_unavailable；
  store 损坏 → fail-closed 不 crash）；每 agent 一个 transport（token
  cache 按身份隔离）；产出与本地执行**字节一致**的 wire 形状。
- `packages/broker/src/credential-store.js`（新）：505-private store 读取
  （版本 1、绝对路径、fail-loud、每次调用重读）。
- `packages/broker/src/index.js`：新增 `mode: child|gateway` 配置；child
  模式（默认）= relay handlers + 本地 calculator；gateway 模式 =
  `ctx.brokerGateway`（不注册工具）；验收 fixture
  `broker_self_assert_test`（`fixtureSelfAssert` 配置门控，仅验收环境）。
- `packages/agent-router/src/process.js`：`childSpawnConfig()` —— 子进程
  uid/gid 降权（gid 缺省 = 父进程主组；不同 uid 且非 root 且无 helper →
  fail-loud 拒绝静默提权）。
- `packages/agent-router/src/index.js`：`BROKER_RPC_METHOD =
  'agent-core/broker'` 分发 —— 实际 agentId + 伪造字段忽略 + gateway
  缺失 fail-closed；business envelope 走 transport 成功信封（RPC 失败通道
  只传字符串）。
- `bundle-broker/`（恢复并改造）：child 组合挂 broker relay。
- `bundle-integration/cordis.patch.yml`：控制面挂 broker gateway
  （AGENT_CORE_CREDENTIALS_FILE / BROKER_AUTH_ORIGIN）。
- `profile-integration-agent/package.json` + `scripts/demo-home.mjs`：
  child profile 恢复 bundle-broker + broker farm links；
  `ensureRepoCoreBridge()` 恢复（worktree/仓库 dev 解析桥）。
- 单元测试 14 项新增（relay 5、gateway 5、router RPC 4）；全仓 255/255。

## 3. 真实验收（全部真实：DSH 进程 + 模型工具调用 + parent RPC + 真实
auth-service + 真实 svc-forum）

```
A_REAL_BROKER_CALL          = PASS  （A 进程内模型调用 forum_my_notifications
                                      → relay → gateway → 真实 auth → 真实
                                      svc-forum → 业务结果出现在模型回复）
B_REAL_BROKER_CALL          = PASS  （B 自身进程，同一链路）
CHILD_SECRET_ENV            = ABSENT（2 个 child pid 的 OS env 无任何凭据）
CHILD_SECRET_FS             = ABSENT（home/workspace 无凭据/token 字符串）
CHILD_TOKEN_VISIBLE         = NO    （JWT 只存在于 parent 进程内存）
A_SELF_ASSERT_B             = DENIED/IGNORED（fixture 工具携带伪造
                                      agentId/principalId/clientId/scope/
                                      audience/authorization → parent 日志
                                      IGNORING + 按实际 agent A 执行成功）
A_DIRECT_TCB_ACCESS         = DENIED（child 无任何 broker/auth 端口 listener；
                                      gateway 进程内不可直连）
A_READ_CREDENTIAL_STORE     = DENIED（**本环境 FAIL**，见 §4）
JWT_A.agent_id / JWT_B.agent_id = knowledge-curator-agent（A/B 均绑定部署
                                      真实 MachineClient；JWT 身份永远跟随
                                      凭据而非自报）
RESTART                     = PASS  （控制面重启后真实调用成功，token 重新签发）
PARENT_UID = 502（**本环境 FAIL，目标 505**，见 §4）
CHILD_UID  = 502
```

## 4. 阻塞条件（BLOCKED 的唯一原因 —— 一次性 root bootstrap）

两个失败项同源：**本会话无 root / 无免密 sudo**（`sudo -n` 需密码、
`launchctl asuser/bootstrap user/505` EPERM、无 setuid helper、无存储口令；
2026-08-08 uid505 cutover 也是当时 root 一次性完成的）。

1. `PARENT_UID = 502 ≠ 505`：trusted Router parent 必须以 authsvc/505 运行
   （LaunchDaemon `UserName=authsvc` 或等价一次性 bootstrap）。
2. `A_READ_CREDENTIAL_STORE = READABLE`：store 文件须 505-owned 0600 落在
   505-private 区（`~/.openclaw/credentials` 已实证对 502 EPERM）；502 无
   chown 权限，当前 store 与 child 同 uid，OS 层无法区分（与
   OPENCLAW_TRUSTED_CREDENTIAL_STORE_AND_HOST_EXEC_V1 报告的
   「502 可读边界」同一结论）。
3. 附属：505→502 的子进程降权需要 setuid-root spawn helper
   （`DSH_AGENT_SPAWN_HELPER` seam 已实现）；同样需要一次性 root 安装。

root 就位后（一次性）：把控制面以 505 运行 + store chown 505 + 安装
spawn helper → 同一 `scripts/trusted-credential-broker-v1-verify.mjs`
全部转 PASS。**代码侧无需再改**。

## 5. 复用清单

| 组件 | 复用 |
|---|---|
| @agent-core/broker transport（client_credentials → token cache → 钉死 downstream fetch） | ✅ gateway 直接调用 |
| targets/manifests（capability → target/origin/audience/scope） | ✅ 原样 |
| Auth/JWT/grants（auth-service 唯一权威） | ✅ 零改动，AUTH_SYSTEM_CHANGE = NONE |
| parent-RPC relay（demo-server ↔ AgentProcess） | ✅ 原样，新增一个 method |
| switchAgent seam | ✅ 未动 |

## 6. 关键产物

- `packages/broker/src/{relay,gateway,credential-store}.js` + `fixtures/self-assert.js`
- `packages/broker/src/index.js`（mode 配置）
- `packages/agent-router/src/{index,process}.js`（RPC 分发 + 降权 spawn）
- `bundle-broker/`（relay child）+ `bundle-integration/cordis.patch.yml`（gateway）
- `scripts/trusted-credential-broker-v1-verify.mjs` + 单元测试
- 证据：`.demo/trusted-credential-broker-v1/evidence.md`

## 7. Verdict fields

```text
TRUSTED_CREDENTIAL_BROKER_INTEGRATION_V1 = BLOCKED
PARENT_UID = 502            （目标 505 —— 需一次性 root bootstrap）
CHILD_UID  = 502
CHILD_HAS_SECRET = NO
CHILD_HAS_TOKEN = NO
REAL_AUTH = PASS
REAL_BROKER = PASS
CROSS_AGENT_IMPERSONATION = DENIED/IGNORED
RESTART = PASS
AUTH_SYSTEM_CHANGE = NONE
BROKER_TRANSPORT_REUSED = YES
PER_AGENT_OS_USER = NO
KERNEL_CHANGE = NONE
```
