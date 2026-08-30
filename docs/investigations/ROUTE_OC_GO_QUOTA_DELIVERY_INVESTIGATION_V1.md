# ROUTE_OC_GO_QUOTA_DELIVERY_INVESTIGATION_V1 — agent-core delivery 进入 OpenCode Go 的路由调查

> TASK_NAME = 路由 调查（2026-08-30 晚）。本轮 **read-only 调查**：零配置修改、零重启、零部署、
> 零重放、零凭据读取输出、零 sudo。investigation artifact（evidence 层），不授予实现/生产权限。

## 0. Worktree Gate 记录

```text
主 checkout   = /Users/yanfenma/workspace/project/dsh-agent-core
               branch docs/lark-ux-phase1-v2-spec @ 9a89b944ad173f2a44e54de50096087a48cc0ad0
               dirty：9 modified（packages/broker/*）+ 46 untracked（docs/scripts）—— pre-existing WIP，未触碰
remote        = github = origin = https://github.com/mayf3/dsh-agent-core.git
github/main   = a1815f00ae6e05858d17f50de2fac91255438e74（本轮 fetch 验证）
调查 worktree = /Users/yanfenma/workspace/project/wt-route-oc-go-investigation-20260830
               detached @ a1815f0（= github/main），tree clean，全程只用该 worktree 读仓库源码
临时 worktree = /tmp/wt-fingerprint-65f0b75（部署指纹比对用，已清理）
无 stash / reset / clean 任何用户改动
```

## 1. 结论速览（唯一主根因）

**本次 delivery 走进 OpenCode Go 不是 Router 代码缺陷，也不是 glm53/luna 注册失败，而是
生产路由配置从未把该 agent 纳入 route chain**：

1. 生产 route chain 配置（`/Users/authsvc/.agent-core/agent-model-overrides.json`，8/29 glmstrict
   Stage-1 写入）**只覆盖 agt_cto-agent，且是 glm53 STRICT（fallbacks = []）**（PR #94 Amendment 1
   STAGE_1 冻结内容；Activation V2 §3.1 冻结生产终态）。
2. 失败 agent 不在 override 覆盖内 → loader 显式回退语义：“missing entry = rollback/legacy state，
   global env route applies”（model-overrides.js 头注）→ 单 route 链 =
   `{provider: oc-go, model: deepseek-v4-flash}`（LaunchDaemon env）。
3. OpenCode Go（opencode.ai workspace `wrk_01M04BZ056JPKTHY2FB8MGRD25`）月度配额耗尽
   （"Resets in 16 days" ≈ 9/15）→ turn 429 GoUsageLimitError。
4. 单 route 链无下一跳 → `hopAllowed = false` → STOP_CHAIN → 错误冒泡到
   ingress-delivery.js catch → 飞书回复 `[agent-core] delivery failed: QUOTA: 429: {...}`。

任务给定的 EXPECTED（primary=glm53, fallbacks=["luna"]）是 **ACTIVATION V2 的目标态**：
Luna fallback 从未激活（gated；blocker = harness identity stamp + OAuth provenance + P1–P4），
甚至 cto-agent 也仍是 strict 空 fallback。不存在"应 hop 到 luna 却没 hop"的执行失败。

## 2. A — 失败请求身份（含读边界声明）

```text
OBSERVED_FAILURE_TIME       = UNKNOWN-precise（authsvc 日志边界；窗口见下）
FAILING_TASK_OR_DELIVERY_ID = UNKNOWN（同上；错误文本为飞书 ingress 回复路径）
RESOLVED_AGENT_ID           = UNKNOWN ∈ 本晚活跃非-override agent 集合（见候选）
失败 agent ≠ agt_cto-agent   = 证据充分（cto = zai/glm-5.3 strict；zai 429 形态是
                                code 1308 "Usage limit reached for 5 hour"，见
                                ~/.agent-core/logs/runtime.err.log:699-755 的 8/21-22 样本；
                                本错误是 GoUsageLimitError + opencode.ai URL + Monthly）
```

时间窗证据（全部本机可读）：

| 证据 | 时间 |
|---|---|
| 生产 runtime（authsvc, pid 53919, launchd runs=3, last exit 0）启动 | 2026-08-30 15:33 |
| harness 子进程 spawn（hr 3501 / podcast 3941 / family-steward 8045 / shopping-list 27448 / efficiency 31147） | 18:53 / 18:55 / 19:14 / 20:29 / 20:44 |
| shopping-list workspace 最后成功产物（memory/2026-08-30.md、active.json、knowledge.md） | ≤ 21:22 |
| dsh-web.out.log 最后写入 | 21:31–21:35 |

5 个 live harness 进程 `ps eww` 全部带 `DSH_AGENT_PROVIDER=oc-go`、`DSH_AGENT_MODEL=deepseek-v4-flash`、
`OPENCODE_GO_API_KEY=<存在，本轮已脱敏>`、`HOME=/Users/authsvc`、`DSH_AGENT_CHILD_UID=502`。
注意：该 env 是继承的**默认值**，不证明 per-turn 实际路由（实际 provider 由 chain snapshot 经
initialize RPC 下发）；但它证明 runtime 级默认 = oc-go。

## 3. B — 有效模型路由（分层解析，代码证据）

部署代码（= 生产运行代码，见 §7 指纹）解析顺序：

```text
compose.js:215-224
  globalRoute = { provider: process.env.DSH_AGENT_PROVIDER ?? 'opencode-go',
                  model:    process.env.DSH_AGENT_MODEL    ?? 'deepseek-v4-flash' }   ← 层1 env + 层2 代码默认
  resolveRouteChain(agentId) = loadAgentModelOverrides(<root>/agent-model-overrides.json)
                                 .resolveChain(agentId, globalRoute)                  ← 层3 override 文件
  agent 无条目 → 链 = [globalRoute]（单 route，字节等价 legacy 行为）
agent-process.js:61-62
  this.provider = provider ?? process.env.DSH_AGENT_PROVIDER ?? 'opencode-go'
  this.model    = model    ?? process.env.DSH_AGENT_MODEL    ?? 'deepseek-v4-flash'
agent-provisioning MINIMAL_SETTINGS（每个 agent home）
  llm-pi-ai.providers.opencode-go.apiKeyEnv = OPENCODE_GO_API_KEY
  agent-default-model = opencode-go / deepseek-v4-flash                        ← 层4 harness 侧默认
```

```text
ROUTE_CONFIG_SOURCE = 层1 /Library/LaunchDaemons/ai.agent-core.runtime.plist
                        EnvironmentVariables DSH_AGENT_PROVIDER=oc-go / DSH_AGENT_MODEL=deepseek-v4-flash
                        （root:wheel，mtime 2026-08-25 21:17；备份 bak-dualpass/bak-feishu-cutover@8-22）
                      层2 代码默认 'opencode-go'/'deepseek-v4-flash'（compose.js:215 / agent-process.js:61）
                      层3 /Users/authsvc/.agent-core/agent-model-overrides.json（v2；yanfenma 不可读；
                         8/28 时点 ABSENT［docs/investigations/route-chain-fallback-canary-plan-v1.md §1］，
                         8/29 08:14 glmstrict Stage-1 后存在且仅 agt_cto-agent［PR #94 冻结 + Activation V2 §3.1］）
BINDING_SOURCE      = /Users/authsvc/.agent-core/bindings/bindings.json（不可读；V2 prebound-only gate 生效中）
PROFILE_SOURCE      = DSH profile 'agent-core-production'（每 agent home；AGENT_PROFILE_DEFS）
OVERRIDE_SOURCE     = 仅 agt_cto-agent（IMPL V1 F-1/F-3 activation scope 恰为 {agt_cto-agent}）
EFFECTIVE_ROUTE（失败 agent）= primary oc-go/deepseek-v4-flash；fallbacks = []（单 route）
EFFECTIVE_ROUTE（agt_cto-agent）= primary glm53（zai/glm-5.3 builtin）；fallbacks = []（STRICT）
```

同源旁证：yanfenma 侧 `ai.agent-core.scheduler-v2.plist` 与已退役 `ai.agent-core.runtime.plist`
同样注入 oc-go/deepseek-v4-flash env；`.bak-glm53-global-primary-20260820T213500` 等备份显示
glm53-global 时代只存在于已退役的 yanfenma wrapper 路径（agent-core-runtime-glm53-wrapper.zsh）。

## 4. C — OpenCode Go 的进入路径

**进入方式 = env 全局 route（非 override agent 的单 route primary），非错误 fallback，非 binding 绕过，
非外部 Harness capability。**

- 部署版 route-chain.js（IMPL V1）按 `snapshot.routes` 顺序执行；非 override agent 快照 =
  `[globalRoute]` = oc-go —— OpenCode Go 是**primary 本身**。
- `oc-go` 在 harness 已注册（5 个 live 进程 initialize 通过 `registeredProviders.includes('oc-go')`
  检查且持续出活为证）；注册面在 agent home settings（authsvc 侧不可读），凭证经
  `.credentials.yaml` 顶层键 `OPENCODE_GO_API_KEY` / `OC_GO_API_KEY`（env.js:100-107 读取路径）。
- provider 别名事实：agent-core 侧命名 `oc-go`，DSH settings/harness 侧命名 `opencode-go`
  （MINIMAL_SETTINGS 逐字）；历史 transcript 两种名字交替出现（dsh-web.out.log:649，
  headers 里 `opencode-go` 与 `oc-go` 混见于同一 session）。这是**命名并存**，不是错配——
  两个名字都解析到同一 OpenCode Go 云端（错误 URL opencode.ai/workspace/wrk_01M04BZ…/go）。
- 旧 profile `provider=oc-go, model=deepseek-v4-flash` 仍存在于：LaunchDaemon env、compose/agent-process
  代码默认、agent-home agent-default-model 三层 —— 即“旧默认仍是全局兜底”。
- 内核/coding-harness（com.agent-core.kernel / capability-host，yanfenma 侧 Rust 栈）与本次 delivery
  无关：错误路径是 production-runtime router 的 ingress-delivery.js（`[agent-core]` 前缀唯一来源，
  部署版 :163）。

## 5. D — GLM 与 Luna 可用状态

```text
GLM_REGISTERED   = YES — routeKind=builtin / provider=zai / model=glm-5.3（A1.4 冻结 tuple；
                    settings.yaml llm-pi-ai.providers.zai 块 + ZAI_API_KEY 存在且非空，
                    canary plan §2 2026-08-28 只读核验）
GLM_INITIALIZED  = YES（对 agt_cto-agent）— Activation V2 §3.1 冻结生产终态
                    primary=glm53 / FINAL_OUTCOME=success（8/29 真实生产 turn 证据）。
                    注：15:33 重启后无 cto harness 进程 = 无 cto 流量，非失败信号。
LUNA_REGISTERED  = NO（生产 routeCatalog）— Stage-1 = glm53-only（PR #94 冻结）；
                    资产存在：dsh-codex@0.2.3 插件 + .openai-codex-auth.json（0600/2092B/uid502，
                    OBS-V2-002/003）
LUNA_INITIALIZED = NO — 从未 spawn。blocker（Activation V2 §3.5 + canary plan §3）：
                    (1) harness 无 .git 且 .source-stamp 已消失（8/28 13:47 重部署清掉；
                    此前内容为裸 hex ce98f68… ≠ pin 514ab7b…，非法 JSON 格式）
                    → luna subscription spawn 必 dsh_commit_mismatch fail-loud（非 hop 类）；
                    (2) OAuth provenance 未关闭；(3) activation gates P1–P4 未满足。
路由选择前过滤    = 不存在。glm53 未被注册/初始化失败过滤；luna 是“从未配置”，不是“被过滤”。
```

## 6. E — 部署与源码一致性

```text
RUNNING_AGENT_CORE_COMMIT = 混合部署，无单一可信 commit：
  主体 = 2026-08-28 07:34-07:35 安装 ≈ main 2f1b18b（8/28 07:33；
    route-chain.js = 65f0b75 blob、ingress-delivery/agent-process/parent-rpc-relay/rpc-channel
    = 3dae32e blob、agent-provisioning/index.js 旧版）
  补丁 = 2026-08-29 08:14（app.pre-glmstrict-20260829-081457 备份为证）就地替换 2 文件：
    model-overrides.js + agent-provisioning/src/index.js = 4cf9b3e blob（Phase A，
    routeKind 七字段 schema + stamp fallback）
  ≠ main（a1815f0）：main 已是 IMPL V2（route-chain.js 500 行 + canary seam，
    compose.js 含 canaryRuntimeRoot）—— V2 未部署
RUNNING_HARNESS_COMMIT = 不可信/未知 — @deepseek-ai/dsh-root 0.1.0-rc.8，
  /usr/local/libexec/agent-core/harness（authsvc 属主，mtime 8/28 13:47），
  无 .git、无 .source-stamp（本轮实测 ls）
SOURCE_STAMP_TRUSTWORTHY = NO（app 无版本 stamp 机制；harness identity fail；
  8/30 上午的 deploy-p0 source-stamp 候选 PR 尚未合并部署）
RUNTIME_CONFIG_MATCHES_REPOSITORY = NO — (a) 代码层：仓库 V2 vs 生产 V1+PhaseA 混合；
  (b) 配置层：生产生效的 agent-model-overrides.json 内容不在仓库任何位置（repo 从不含生产配置）
启动参数 = node app/scripts/production-runtime.mjs --root /Users/authsvc/.agent-core --catchup 0
  （/Library/LaunchDaemons/ai.agent-core.runtime.plist；UserName=authsvc(uid505)；
  子进程经 /usr/local/libexec/dsh-agent-spawn-helper 降到 uid502）
dirty build = 无（部署文件均为 git blob 精确匹配；但混合基线本身无 stamp 记录）
```

## 7. F — fallback 状态机（四层区分）

```text
1. 设计文档声称支持   = YES（Parent V1/V2 CTR-003..007：ordered chain + 四类白名单 hop）
2. 仓库代码实现支持   = YES（main IMPL V2：route-chain.js 500 行 + quota 证据类 + canary seam；
                        测试 route-chain/route-chain.test.js）
3. 测试证明支持       = YES（V1 65f0b75 自带 16 用例；V2 bd0eeae 增补两套件；
                        本轮未重跑——只读边界，采信 commit 内验证记录）
4. 当前部署实际启用   = PARTIAL — 部署的 V1 executor 支持 ordered fallbacks（机制在线），
                        但生产配置只有两条链：
                        agt_cto-agent = [glm53]（strict 空 fallback）
                        其余 agent     = [oc-go]（env 全局，单 route）
                        ⇒ 全生产不存在任何长度 ≥2 的链；luna 在任何链中都不存在
本次为什么没进 Luna   = 不是状态机拒绝 hop——是失败 agent 的链根本没有第二跳
                        （hopAllowed 需要 nextRouteExists；route-chain.js V1 部署版 executeChain）
旧生产状态 primary=glm53 fallbacks=[] 是否仍是现实 = 对 cto YES；对失败 agent 从未有过 glm53
```

## 8. 因果链（WHY_OC_GO_WAS_SELECTED 完整版）

```text
[配置层] activation scope 冻结为 {agt_cto-agent}（IMPL V1 F-1/F-3；PR #94 Stage-1 routeCatalog
  glm53-only）→ 失败 agent 在 /Users/authsvc/.agent-core/agent-model-overrides.json 无条目
  → loader 显式 legacy passthrough（missing entry = global env route，设计行为）
[env 层] LaunchDaemon（8/25 21:17）注入 DSH_AGENT_PROVIDER=oc-go / DSH_AGENT_MODEL=deepseek-v4-flash
  → globalRoute = oc-go 单 route；代码默认 'opencode-go' 同向兜底
[进程层] route gate 以 canonicalRouteIdentity 复用/新代 spawn；initialize RPC 下发 oc-go
  → harness 经 agent-home settings 的 OpenCode provider + OPENCODE_GO_API_KEY 直连 opencode.ai 云端
  （本地 com.opencode.serve/server 未运行、opencode.db 停在 8/27 —— 非本地代理路径）
[配额层] 该 OpenCode workspace 月度配额耗尽（16 天后 ≈ 9/15 重置）→ 429 GoUsageLimitError
[状态机] sanitizeProviderError → "QUOTA: 429: {…}" / class=account_quota_exhausted
  （FAIL_LOUD 集）→ classifyAttemptFailure 给出 hop 候选类，但 routes.length=1
  → nextRouteExists=false → STOP_CHAIN（无重放，符合既定约束 5）
[投递层] ingress-delivery.js catch → 飞书回复 "[agent-core] delivery failed: QUOTA: 429: …"
```

## 9. 判定

```text
IS_THIS_A_ROUTING_DRIFT           = NO（无配置被绕过/漂移；是配置覆盖面不足）
IS_THIS_A_STALE_DEPLOYMENT        = PARTIAL（生产落后 main 一个 V2 版本，但 V1 已含
                                     ordered-fallback 机制；部署落后不是本次失败成因）
IS_THIS_AN_AGENT_SPECIFIC_OVERRIDE= NO（恰恰相反：失败 agent 是"无 override"的那个集合；
                                     cto 的 override 正常生效）
IS_THIS_A_PROVIDER_ALIAS_PROBLEM  = NO（oc-go/opencode-go 双名并存但同解析，无错配证据）
IS_THIS_ONLY_AN_OC_GO_QUOTA_PROBLEM = NO（配额是触发器；根因是预期路由链从未对该 agent 激活，
                                     且 luna fallback 全局未激活）
```

## 10. 安全修复选项（不执行；仅列出）

1. **扩大 route chain 覆盖**：按 ACTIVATION V2 的 gate 链把预期 agent 纳入 v2 override
   （glm53 primary + luna fallbacks），或至少给非-cto agent 配 glm53，切断对 OpenCode Go
   全局默认的依赖 —— 属生产配置变更，须 Owner 走 gated activation。
2. **换全局默认 route**：修改 LaunchDaemon env `DSH_AGENT_PROVIDER/DSH_AGENT_MODEL`
   （现 oc-go）→ 改为可用 provider；同样属生产变更，且只是兜底移位。
3. **完成 Luna activation**（解除 harness identity stamp blocker：合法 JSON {commit,dirtyCount}
   stamp 重生成 + pin 校验；OAuth provenance 关闭；P1–P4）→ 让 fallback 真实存在。
4. **落地 deploy-p0 source-stamp 机制**（今日候选 PR）让 RUNNING_COMMIT 可信可审计。
5. 禁止项重申：开启 OpenCode available balance / 充值会掩盖覆盖面问题，不做。

RECOMMENDED_NEXT_TASK = 路由 执行（gated：先 Owner 决策覆盖面 —— 哪些 agent 进
glm53→luna 链；或最低限度把全局默认 route 从 oc-go 切走；均需 accepted Spec/Owner 授权）。

## 11. 边界与证据保全

- 零 sudo；零重启（launchctl 仅 print 读取）；零配置写入；零模型调用/探针；零重放。
- authsvc home（/Users/authsvc/.agent-core/**）全程 Permission denied —— 失败请求精确身份
  （agent ID / 时间戳 / task ID）标记 UNKNOWN，不用猜测替代；候选集与时间窗如实给出。
- OPENCODE_GO_API_KEY 等密钥仅报告存在性，值未输出（报告内一律脱敏）。
- 只读 HTTP：GET 127.0.0.1:8790/health（200 ok）与 /version（404），无 POST。
- EXPECTED（任务给定）/ REPOSITORY（main a1815f0）/ DEPLOYED（V1+PhaseA 混合）/
  EFFECTIVE（失败 agent = oc-go 单 route；cto = glm53 strict）/ OBSERVED（GoUsageLimitError）
  五层在本报告各节分开陈述。
- 本文件为唯一新增 artifact；生产、服务、配置零改动。
