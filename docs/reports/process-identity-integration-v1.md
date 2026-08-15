# Process Identity Integration V1 — 接线与真实验收报告

> 目标（本轮唯一）：Router 启动 Agent process → 注入该 Agent 自己的 existing
> clientId/clientSecret → Broker credential seam 拿到它 → auth-service
> client_credentials → 该 Agent 自己的 JWT → 调一个真实 Broker capability 成功。
> 不新增 Auth 系统 / Principal Directory / credential mapping DB / mTLS /
> sidecar / OS user isolation / TPM / Kernel 改动。

## 0. 结论

```
PROCESS_IDENTITY_INTEGRATION_V1 = PASS
CREDENTIAL_SOURCE = 存量 auth-service MachineClient 凭据（knowledge-curator-agent，
                    vault ~/.openclaw/credentials/agent-*-secret 0700(authsvc)；
                    可读副本 ~/.openclaw/agents/knowledge-curator-agent/.env），
                    由控制面写入 Router 可信凭据库（0600，control-plane runtime）
SPAWN_INJECTION = AgentProcess.spawn 按 agentId 读取 AGENT_CORE_CREDENTIALS_FILE，
                  仅向该 Agent 的进程 env 注入 AGENT_CORE_BROKER_CLIENT_ID /
                  AGENT_CORE_BROKER_CLIENT_SECRET（packages/agent-router/src/
                  {credentials,process}.js）
BROKER_CREDENTIAL_SEAM = packages/broker/src/credential.js createCredentialProvider
                         （env 占位路径，取值即 Router 注入的 per-process 值）
REAL_AUTH_EVIDENCE = client_credentials 200 → JWT sub=87047adb-…（= 权威映射
                     auth_principal_id）、agent_id=knowledge-curator-agent、
                     client_id=mc_oc_AdXrOjACKpodtqSPo3HA5fq_、aud=svc-forum、
                     scope=forum.read、principal_type=agent
REAL_BROKER_EVIDENCE = A 进程内模型 turn 调 forum_my_notifications → 通用传输 →
                       auth-service token → svc-forum(127.0.0.1:3460) → 结构化
                       ok 结果（restart 后再次成功）
CROSS_AGENT_ISOLATION = A/B 独立 pid；A 进程 env 只有 A 凭据，B 进程 env 只有
                        B 凭据；B 的 fixture 凭据被 auth-service 拒绝（401）
SECRET_IN_MODEL_CONTEXT = NO
NEW_AUTH_SYSTEM = NO
NEW_MAPPING_TABLE = NO
KERNEL_CHANGE = NONE
```

## 1. 现有实现位置（调查答案）

| 问题 | 答案 |
|---|---|
| 现有 credential seam 在哪里？ | `packages/broker/src/credential.js`（Broker Transport V1 / PR #9 交付）：`createCredentialProvider({ injected, source })` → `getCredential()`；取值优先级 injected → env 占位 `AGENT_CORE_BROKER_CLIENT_ID/_SECRET` → undefined（transport fail-closed `credential_unavailable`）。PR #9 的 merge commit 原本不在 main 祖先线上（树里缺失），本轮先把已 review 通过的分支合入 main（commit eb6ccc9），恢复冻结事实。 |
| Router spawn 当前能注入哪些 per-Agent runtime values？ | `AgentProcess({ agentId, home, workspace, profile, env })`；`agentEnv(home, extra)` 拼 `DSH_HOME` + extra env（已有 `DSH_AGENT_ID`）。本轮新增：按 agentId 从可信凭据库解析并注入 `AGENT_CORE_BROKER_CLIENT_ID/_SECRET`；凭据库路径本身不进子进程 env。 |
| Agent credential 现有权威来源？ | auth-service Postgres（MachineClient scrypt secretHash，唯一签发事实）+ 部署 vault `~/.openclaw/credentials/agent-<id>-secret`（0700，authsvc 属主）+ `openclaw-adc-canary-extension/broker/{config.json,authoritative-agent-mapping.json}`（agent→clientId→principal 映射）。本轮未新增任何映射表：Router 凭据库只是把「已存在的凭据」按 registry agentId 分发给 spawn，身份裁决仍完全在 auth-service（client_credentials + JWT sub/agent_id）。 |

## 2. 最小改动（全部在 dsh-agent-core）

1. **合并 Broker Transport V1（PR #9）**：commit eb6ccc9；transport/credential seam/
   capabilities/targets + 55 项测试。
2. **`packages/agent-router/src/credentials.js`（新）**：可信凭据库加载器
   `{version:1, credentials:{agentId:{clientId,clientSecret}}}`，绝对路径、
   fail-loud（损坏/不可读 → CREDENTIALS_STORE_ERROR，绝不静默无凭据 spawn）、
   每次 spawn 重读（轮换立即生效）。
3. **`packages/agent-router/src/process.js`**：spawn 时按 `this.agentId` 解析
   凭据 → 注入子进程 env；`AGENT_CORE_CREDENTIALS_FILE` 不进子进程 env。
4. **`bundle-broker/`（新）+ `profile-integration-agent/package.json` +
   `scripts/demo-home.mjs`**：per-agent 组合挂载 `@agent-core/broker`
   （默认 manifests = calculator + Forum×7 + Workflow×4 + OKR×1；
   authServiceOrigin=127.0.0.1:4001；凭据来自进程 env seam）。
5. **`scripts/demo-home.mjs`**：`ensureRepoCoreBridge()` — dev 解析桥
   （repo/node_modules/@agent-core → packages/ 与 bundle-*，镜像既有
   @deepseek-ai bridge）。必要背景：per-home farm 是 symlink，Node ESM 按
   realpath 解析，导致 agent-memory 的传递导入 `@agent-core/workspace-bootstrap`
   在全新 home 上 boot 即崩（HEAD 上已存在、与凭据无关）；桥修复后
   真实模型 turn 可跑。gitignored，幂等。
6. **`scripts/process-identity-v1-verify.mjs`（新）**：真实验收驱动。

## 3. 真实验收（运行证据）

运行命令：
```
node scripts/process-identity-v1-verify.mjs
```
完整断言输出：`.demo/process-identity-v1/evidence.md`；本次运行日志
`.demo/pi1-run2.log`。

关键链路证据：

- A = registry agent（display name 知识管家），凭据 = 真实 knowledge-curator
  MachineClient；B = 隔离对照（fixture 凭据）。
- `ensureRunning(A)` → 独立 pid 的 DSH 进程；`ps eww` 直接读子进程 OS env：
  `AGENT_CORE_BROKER_CLIENT_ID=mc_oc_AdXrOjACKpodtqSPo3HA5fq_`、
  `AGENT_CORE_BROKER_CLIENT_SECRET=<真实值>`（断言与 .env 逐字节相等）；
  `AGENT_CORE_CREDENTIALS_FILE` 不在子进程 env。
- A 进程内模型真实调用 `forum_my_notifications`：broker seam → auth-service
  client_credentials（resource=svc-forum, scope=forum.read）→ Bearer →
  svc-forum `GET /api/me/notifications` → `ok: true` 结构化结果回给模型。
- JWT claims 与 `authoritative-agent-mapping.json` 一致（sub = principal UUID，
  agent_id = canonical id）。
- kill -9 A → ensureRunning 再起新 pid → env 重新注入（每次 spawn 重读凭据库）
  → 再次真实 broker 调用成功（新进程新 token）。
- 隔离：A env 无 B 的 clientId/secret；B env 无 A 的；A≠B 凭据；
  B 的 fixture 凭据在 auth-service 换 token 被拒（401/400）。
- secret 卫生：A 的 workspace / home / session 轨迹（model context）/
  进程 stderr / 模型可见回复中均无 client secret。

## 4. 边界与后续（不属于本轮）

- 多 Agent 同 OS user 时进程凭据文件可被同 user 代码读取（TRUST-BOUNDARY-REPORT
  §6 已知边界）：per-agent OS user 隔离是后续 gate，本轮明确不做。
- Broker credential→principal 绑定表 / ACL（Plan B 最终形态）未实现——本轮
  冻结为复用现有 MachineClient + JWT 链。
- 部署侧把 `AGENT_CORE_CREDENTIALS_FILE` 配置进控制面组合（bundle-integration）
  属部署接线，由移动 gate 会话持有该文件期间未动。
