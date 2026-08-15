# TRUSTED_CREDENTIAL_505_FINAL_ACCEPTANCE_V2

> 状态：**PASS（VERDICT = MERGE）** · 日期：2026-08-15 ·
> 分支：feat/trusted-credential-broker-v1 · 验收驱动：
> `scripts/trusted-credential-505-final-v2-run.mjs`（root 编排，控制面
> `sudo -u authsvc` 以 505 运行，child 经冻结 spawn helper 降权 502/20）
> 证据：`.demo/trusted-credential-505-v2/evidence.md`（20/20 checks + CP/child
> stderr 诊断尾巴；`.demo` 为 gitignored 运行时区）

## 0. 一句话总结

冻结架构的**最终特权边界验收全部通过**：Router/control plane 以
authsvc/505 运行，DSH Agent child 经 root-owned setuid helper（冻结契约：
仅 502/20、清 supplemental groups、execv 固定 argv、无 shell）降权到
502/20；credential store 落在 505-private zone（`~/.openclaw/credentials/`
authsvc 0700，store 文件 authsvc 0600），uid 502 三种读法全部 DENIED。
Agent A/B 绑定**两个互不相同的真实 MachineClient**（A=knowledge-curator-agent，
B=arch-reviewer），A 以 B 的**真实** agentId/principalId/clientId 伪造身份攻击，
parent 全部忽略并按实际 proc.agentId 执行。全链真实：auth-service(4001) →
svc-forum(3460) → 真实业务结果。控制面重启后链路依旧（RESTART = PASS）。

## 1. 一次性 root bootstrap（本次完成，无新增机制）

- `/usr/local/libexec/dsh-agent-spawn-helper`（root:wheel 4755，源码
  `scripts/dsh-agent-spawn-helper.c`）：只接受冻结 child uid/gid 502/20；
  `setgroups(0,NULL)` 清 supplemental groups；setgid→setuid→execv 固定
  argv；冒烟测试（降权 id 输出 groups=20(staff)、拒绝 501/80、502 调用
  无增益）全部通过。
- `/Users/yanfenma/.openclaw/credentials/dsh-agent-core/`（authsvc:authsvc
  0700）：505-private 验收 store 目录；store 文件 0600 authsvc-owned。
- 未新建任何 daemon / IPC / 通用 sudo 框架 / Auth。

## 2. 与 V1 验收的差异（Task 3 强化）

V1 的 A/B 共用同一个真实 MachineClient（knowledge-curator-agent）；
V2 从 505-private zone（`agent-arch-reviewer-secret`）+ auth-service DB
（machine_clients × machine_principals）配对出第二个真实凭据：
**B = arch-reviewer**（`mc_oc_R2SNVsMtaNLBfbIvGoCC3K41`，
sub `4684680a-…`），先经真实 token 交换 + 真实 svc-forum 探测验证后才
进入验收。store 中 A→A 凭据、B→B 凭据，gateway 按实际 proc.agentId
选取（per-agent transport，token cache 隔离）。

攻击升级：A 的 fixture 调用伪造 **B 的真实 agentId（registry id）+
真实 principalId（JWT sub）+ 真实 clientId**，外加 fake scope/audience/
Authorization——parent 日志 `IGNORING child-supplied identity fields: …`，
最终按 A 执行（JWT 身份 = knowledge-curator-agent）。

## 3. 运行中修复的记录（验收驱动/验收 fixture，产品代码零改动）

1. fixture `broker_self_assert_test` 新增可选参数 `forgedPrincipalId /
   forgedClientId`（V2 伪造 B 真实标识所需）；harness 工具 schema 编译器
   要求参数 `required` 必须为 `true`——首次写成 `required:false` 导致
   child 插件树加载失败（症状：child 启动后静默死亡、router 请求挂起、
   /v1/message 空回复/500）。已修正并本地复现验证。
2. child home 的 `.credentials.yaml` 必须保持 0600（harness
   `@deepseek-ai/dsh-credentials-local` 强制 owner-only）；模型 key 改经
   CP env 传递（`agentEnv()` 见 env 有 key 即不读文件），router 不再读取
   child 的 0600 文件。
3. 验收驱动增加：CP stderr / child stderr 诊断尾巴落盘、每请求 240s
   超时（防假死循环）、陈旧进程与端口预检（8787/4001/3460 fail-fast）。

## 4. 真实验收结果（20/20 PASS）

```text
V2_REGISTRY_AB / V2_STORE_505_PRIVATE / V2_CP_GATEWAY_UP / PARENT_UID
V2_REAL_AUTH_A / V2_REAL_AUTH_B / V2_DISTINCT_IDENTITIES
A_REAL_BROKER_CALL / A_BROKER_EXECUTED_AS_A
B_REAL_BROKER_CALL / B_BROKER_EXECUTED_AS_B
CHILD_UID / CHILD_SECRET_ENV / CHILD_SECRET_FS / CHILD_TOKEN_VISIBLE
CROSS_AGENT_IMPERSONATION
A_READ_CREDENTIAL_STORE / A_DIRECT_TCB_ACCESS
V2_CP_RESTART_UP / RESTART
```

业务结果差异即身份证据：A 返回 0 条通知，B 返回 3 条 arch-reviewer 的
真实未读通知；svc-forum 日志同时出现 A/B 两个 sub。

## 5. Verdict fields

```text
TRUSTED_CREDENTIAL_505_FINAL_ACCEPTANCE_V2 = PASS
PARENT_UID = 505
CHILD_UID = 502
CHILD_HAS_SECRET = NO
CHILD_HAS_TOKEN = NO
A_READ_CREDENTIAL_STORE = DENIED
A_JWT_IDENTITY = knowledge-curator-agent
B_JWT_IDENTITY = arch-reviewer
CROSS_AGENT_IMPERSONATION = DENIED/IGNORED
REAL_AUTH = PASS
REAL_BROKER = PASS
REAL_DOWNSTREAM = PASS
RESTART = PASS
AUTH_SYSTEM_CHANGE = NONE
BROKER_TRANSPORT_CHANGE = NONE
PER_AGENT_OS_USER = NO
KERNEL_CHANGE = NONE
VERDICT = MERGE
```

## 6. 卫生备注（非阻塞）

- 诊断期间形状侦察脚本曾打印 505 zone 内 secret 文件前 40 字符前缀到
  会话记录（自有凭据、本机用户可见）；zone 内 `agent-*-secret` 文件
  建议在合适时机统一轮换一次。
- 观测到（未修，不在本验收范围）：router 的 JSON-RPC pending 请求在
  child 进程死亡时不会立即 reject，需等 turn 超时兜底——既有行为，
  与本次验收无关。
