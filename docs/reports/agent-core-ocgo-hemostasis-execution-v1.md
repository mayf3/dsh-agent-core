# AGENT_CORE_OC_GO_HEMOSTASIS_V1 — 止血 执行 报告（2026-08-30）

TASK_NAME = 止血 执行
TASK_TYPE = 执行
TASK_STATUS = **STOPPED_AT_OWNER_GATE**（全部可无特权执行的生产步骤已完成；唯一剩余步骤 = plist 全局路由翻转 + 单标签受控重启，需要 root，本轮无免密 sudo，已封装为经过 5 场景沙盘验证的 Owner runner）

> 交付语义对照任务给的 `COMPLETE | ROLLED_BACK | STOPPED`：生产权威配置未与调查报告冲突（无 STOPPED 的冲突语义）；生产 flip 因权限门槛未执行（不是回滚）。诚实口径 = 生产变更准备完成、等待 Owner 以 root 执行 runner；除该步外所有验收要求已达成或已具备达成条件。

---

## 1. OWNER_INTENT 执行结果总览

| 目标 | 状态 |
|---|---|
| 解除对已耗尽 OpenCode Go 默认路由的依赖 | 运行机制已全部就绪：canary 实证 zai/glm-5.3 全链路可用；5 个活跃 Agent 的凭证/settings 已补齐；plist 翻转 runner 已就绪（Owner 执行） |
| primary = glm53, fallbacks = [] | canary 运行时证据：`route: global:zai/glm-5.3, totalRouteAttempts=1, fallbackActivated=false`（passthrough 单路由即 strict） |
| 不启用 Luna | 未触碰；runner 对 overrides 文件 pin 且断言 luna-free（P1） |
| 不开启 OpenCode Go 余额/充值 | 未触碰任何 oc-go key/账户 |
| 新 Agent 不再静默落到 oc-go | flip 后全局 env = zai/glm-5.3（compose.js:214-217 globalRoute 唯一来源；无 fallback 概念）；runner D2 保证新 plist 无 oc-go |

## 2. PREFLIGHT_RESULT = PASS（只读，带已声明的边界）

### 2.1 已读取并快照（yanfenma 身份，全部只读）

- `/Library/LaunchDaemons/ai.agent-core.runtime.plist`（644 root:wheel，可读）：**全局默认路由 `DSH_AGENT_PROVIDER=oc-go` / `DSH_AGENT_MODEL=deepseek-v4-flash` 写在 plist env**；runtime = `node app/scripts/production-runtime.mjs --root /Users/authsvc/.agent-core --catchup 0`，UserName=authsvc，KeepAlive，ThrottleInterval=10。
- `/Users/authsvc/.agent-core/agent-model-overrides.json`（**322 字节，644 authsvc:authsvc，可读**）：v2 格式，`routeCatalog.glm53 = {routeKind: builtin, provider: zai, model: glm-5.3, credentialReadiness: zai-api-key-home}`；`overrides` 仅 `agt_cto-agent → primary=glm53, fallbacks=[]`。
- 生产 routeCatalog：见上（glm53 是唯一 catalog 条目，zai/glm-5.3 已注册）。
- 生产进程树：runtime pid 53919（authsvc，15:33 起）；**5 个常驻子 Harness（uid 502 = yanfenma，经 setuid helper spawn）**。
- 每个 Agent 的 effective route（`ps eww` 运行时证据，子进程属主为 502 故可读）。

### 2.2 PRODUCTION_ROUTE_MATRIX_BEFORE（运行时证据）

| AGENT_ID | PRIMARY | FALLBACKS | CONFIG_SOURCE | RUNNING_PROCESS |
|---|---|---|---|---|
| agt_cto-agent | zai/glm-5.3 (glm53) | [] | v2 override（overrides 文件） | 常驻子进程当前不在跑（按需拉起；main session 历史含 5 个 zai/glm-5.3 turn = 生产实证） |
| agt_hr-agent | oc-go/deepseek-v4-flash | （全局 env 单路由，无链） | plist 全局 env（无 override） | pid 3501（uid 502，env 实证 oc-go） |
| agt_podcast-producer-agent | oc-go/deepseek-v4-flash | （同上） | plist 全局 env | pid 3941（env 实证 oc-go） |
| agt_family-steward-agent | oc-go/deepseek-v4-flash | （同上） | plist 全局 env | pid 8045（env 实证 oc-go） |
| agt_shopping-list-agent | oc-go/deepseek-v4-flash | （同上） | plist 全局 env | pid 27448（env 实证 oc-go） |
| agt_efficiency-agent | oc-go/deepseek-v4-flash | （同上） | plist 全局 env | pid 31147（env 实证 oc-go） |

### 2.3 PREFLIGHT C 项验证

- glm53 provider 已注册：**是**（生产 routeCatalog，运行 overrides 文件实证）。
- zai/glm-5.3 凭证存在：**cto-agent home `.credentials.yaml` 含 `ZAI_API_KEY`**（0600, 237B, Aug 27）；生产 main session 含 5 个真实 zai/glm-5.3 turn（session.jsonl 实证）。
- agt_cto-agent 当前实际可使用 glm53：**是**（同上 session 证据 + 隔离 probe session 9×zai 记录）。
- 需保留 oc-go 的已授权例外 Agent：**未发现**（overrides 中无 oc-go 条目；调查报告亦无例外清单）。
- 同时进行的其他部署修改：**未发现**（plist sha 稳定 = preflight pin；overrides sha 稳定；runtime pid 全程未变 53919）。
- 与调查报告的实质冲突：**无**（调查结论 1-6 全部被运行时证据复核确认）。

### 2.4 权限边界（诚实声明）

yanfenma（uid 502）无免密 sudo（`sudo -n true` = password required）。以下仅 root 可读，本轮未读、由 Owner runner 在特权上下文内权威复核：`bindings/bindings.json`、`logs/`、`control/`、`config/agents.json`（inventory 权威源）、authsvc runtime 进程 env（plist 内容即其 env 来源）。`homes/`、`workspaces/` 属主为 uid 502（子进程身份），可读可写——这是本轮凭证/settings 补齐无需 root 的原因。

## 3. 关键技术发现（决定执行方案的三条链路证据）

1. **部署版 v2 override 代码硬性只接受 `agt_cto-agent`**（`model-overrides.js:376-378` scope check；任何其他 agentId → 整文件 fail-loud → 起不来）。因此「全 inventory 显式 override」在现部署代码下不可行且危险；任务授权的另一条路径成立：**调整 plist 全局默认路由**（compose.js:214-217 `globalRoute = env DSH_AGENT_PROVIDER/MODEL`，无 override 的 Agent 与未来新 Agent 的唯一路由来源，passthrough 单路由 = 天然 strict、无 oc-go fallback 可能）。
2. **zai 凭证与 provider 目录是 per-home 的两个文件**：Router 只注入 OPENCODE_GO_API_KEY（env.js:100-106），zai key 由子进程自读 `$DSH_HOME/.credentials.yaml`；provider 目录在 `$DSH_HOME/settings.yaml` 的 `llm-pi-ai.providers`。**5 个活跃 Agent 的 home 两处都缺 zai**（settings 无 `zai` stanza、credentials 无 `ZAI_API_KEY`）——直接翻 plist 会让 5 个 Agent 全部在 initialize 崩溃。canary 第一次失败实证了这一点。
3. **owner-guard 单 owner 锁**：home 内 `demo-owner.lock` 拒绝第二个 owner 进程（引用存活 PID）。运行中的常驻子进程持有各自锁；受控重启经 runtime 优雅 dispose 释放（canary 收尾实证 SIGTERM → stopped cleanly → 子进程消失）。

## 4. CANARY_RESULT = PASS（零生产写入）

- CANARY_AGENT = agt_shopping-list-agent（隔离副本）
- CANARY_DELIVERY_ID = 无（scheduler 无投递 job；`deliveryStatus=not-requested`；未触碰 Feishu，未重发任何业务任务）
- CANARY_ACTUAL_PROVIDER = **zai**（三层运行时证据：router route-chain 日志 `route=global:zai/glm-5.3`；子进程 env `DSH_AGENT_PROVIDER=zai`；session.jsonl 7×`"provider":"zai"`）
- CANARY_ACTUAL_MODEL = **glm-5.3**（route-chain + session.jsonl 7×`"model":"glm-5.3"`）
- CANARY_RESULT = **PASS**：
  - 新进程实际启动：pid 2193，经生产 setuid helper `/usr/local/libexec/dsh-agent-spawn-helper` 以 uid 502 spawn（与生产完全同路径）。
  - effective primary = glm53、fallbacks = []：`route_chain_final: finalRoute=global:zai/glm-5.3, finalOutcome=SUCCESS, totalRouteAttempts=1, fallbackActivated=false`。
  - 证据来自运行时而非配置文件：见上三层证据 + `runtime-evidence.jsonl` invocation `status=ok, summary="ZHIXUE_OK", routerProcessPid=2193, terminationEvidence=exact_terminal_then_idle`。
  - 隔离诊断 turn 完成：部署版 `production-runtime.mjs --root <隔离root> --catchup 0`（zai 全局 env、Feishu off、product-api off、ingress 换端口），scheduler job `77d9a4f6` → `state=succeeded, reason=invoker returned terminal success`，回复内容 ZHIXUE_OK。
  - 未进入 oc-go：session.jsonl 中 opencode/oc-go 引用 = 0；route 证据单路由。
  - 无双重投递/任务重放：`--catchup 0`、delivery not-requested、单 occurrence。
  - canary 过程中实证两个前置失败根因（settings 缺 zai stanza → initialize exit 1；home 副本携带陈旧 owner-lock → owner-guard 拒启），修复后转绿——这两个根因直接决定了 rollout 方案。

## 5. ROLLOUT_RESULT = 分层完成

### 5.1 已完成（yanfenma 文件权限内，canary 验证后的模式）

**5 个活跃 Agent home 补齐 zai 能力**（agt_shopping-list-agent / agt_hr-agent / agt_podcast-producer-agent / agt_family-steward-agent / agt_efficiency-agent）：

- `.credentials.yaml` 追加 `ZAI_API_KEY` 行（自 cto 文件逐字节复制，值从未回显/入日志；172→237 字节）。
- `settings.yaml` 插入 zai stanza（4 行，与 cto 字节一致；500→574 字节；**5 份 settings diff cto = IDENTICAL**）。
- 权限保持：两文件 0600、属主 yanfenma:staff（uid 502 子进程身份）不变。
- 备份：`/Users/authsvc/.agent-core/homes/.zhixue-backup-20260830/<agent>/`（原文件 + mtime + sha256，回滚 = 原样拷回）。
- 生效语义：当前全局路由仍 oc-go，此改动对运行中进程零影响（settings/credentials 在 spawn 时读取）；flip 后下一次 spawn 生效——即 canary 验证过的精确形态。
- agt_cto-agent：未触碰（本来就完整）。

**为什么这是生产变更却是安全的**：改动的两个文件对当前运行进程不可见（子进程已 boot），对 oc-go 路由无语义影响（多一个未使用 provider 条目与 key）。

### 5.2 已就绪、Owner 执行（root 门槛）

`/tmp/run-agent-core-ocgo-hemostasis-v1.sh`（sha256 见 MANIFEST）：

- G0：root + 无参 + 交互短语 `APPLY AGENT_CORE_OC_GO_HEMOSTASIS_V1`。
- P1：overrides 文件 sha pin（b9d301a7…，必须字节不动）+ luna-free 断言。
- P2：幂等（已 flip → ALREADY_APPLIED exit 0）；plist sha pin（9019f071…）+ 双值形状断言（oc-go/deepseek 各恰 1 处、zai/glm 零处）。
- P3：**权威 inventory 扫描**（root 读 `config/agents.json`）：对每个注册 Agent 校验 zai stanza + ZAI key，缺失则以同样模式修复（备份 + chown 502:20 + 0600）——补齐我读不到 agents.json 而可能遗漏的注册 Agent。
- P4：静默检查（180s 内无新子进程 = 无在途 turn；5 分钟重试后仍忙则拒绝）。
- D1/D2：plist 备份（`*.bak-ocgo-hemostasis-<ts>`，遵循该目录既有惯例）→ sed 双值翻转 → `plutil -lint` → diff 必须恰好 2 行 → 原地写入（保 inode/owner/mode）。
- D3：`launchctl bootout system/ai.agent-core.runtime` + `bootstrap`（**单标签**，不触碰其他服务）。
- V：新 pid ≠ 旧 pid 且存活；**runtime env = zai/glm-5.3**（root 可读 authsvc 进程 env）；boot log 含 `agent model route chain loaded for agt_cto-agent: glm53 (length 1)`（cto strict 保持的运行时证明）+ `production runtime ready` + 无 overrides 解析错误；稳定性（15s 后仍单进程）。
- R：任意写后失败 → 统一回滚（plist 字节恢复 + chown/chmod + 重启 + oc-go env 复核）；回滚不全 → exit 4 并点名 UNRESTORED_STATE。
- 出口：0 成功/已应用、1 已回滚、2 零写拒绝、4 回滚不全。
- 沙盘矩阵（TESTVARIANT：内容驱动 launchctl shim + 真 node 假 runtime）：**S1 成功 / S2 幂等 / S3 drift 拒绝 / S4 验证失败→干净回滚 / S5 bootstrap 失败→干净回滚，5/5 绿**；沙盘抓出并修复 runner 两个真 bug（macOS `ps eww` 参数顺序；P1/P2 幂等顺序）。

## 6. 验收字段

```
TEMPORARY_TARGET                  primary=glm53, fallbacks=[]   [canary 实证；生产待 Owner flip]
ALL_PRODUCTION_AGENTS_EXPLICITLY_ACCOUNTED_FOR
                                  = YES（5 活跃 Agent 运行时矩阵 + cto override 实证；
                                    全量注册清单由 runner P3 以 agents.json 权威复核）
GLOBAL_DEFAULT_NO_LONGER_OC_GO    = PENDING_OWNER_RUN（plist flip 已封装，沙盘实证）
NEW_AGENT_CANNOT_SILENTLY_INHERIT_OC_GO
                                  = PENDING_OWNER_RUN（flip 后 globalRoute=zai/glm-5.3 单路由
                                    passthrough，新 Agent 无 oc-go 路径；代码级 compose.js:214-217）
CTO_GLM_STRICT_PRESERVED          = YES（overrides 字节未动 + runner P1 pin + V3 日志门）

CANARY_AGENT                      = agt_shopping-list-agent
CANARY_DELIVERY_ID                = none（无投递诊断 job 77d9a4f6-146e-46ba-b6e3-2b352ba11c32）
CANARY_ACTUAL_PROVIDER            = zai
CANARY_ACTUAL_MODEL               = glm-5.3
CANARY_RESULT                     = PASS

PRODUCTION_ROUTE_MATRIX_AFTER     = flip 前生产矩阵见 §2.2（未变）；flip 后投影：
                                    全部 Agent → primary zai/glm-5.3, fallbacks []
                                    （cto 经 override 链，其余经全局 env passthrough；
                                     由 Owner run 后 runtime.log + 首个重生子进程 env 实证补录）

OC_GO_SELECTED_BY_ANY_AGENT_AFTER = PENDING_OWNER_RUN（预期 NO；新 plist 无 oc-go 值）
LUNA_CONFIGURED_AFTER             = NO（从未配置；pin 断言 luna-free）
FAILED_BUSINESS_TASK_RETRIED      = NO（未发送任何消息；canary 为隔离无投递 turn）
OPENCODE_BALANCE_ENABLED          = NO（未触碰）

ROLLBACK_TESTED                   = YES（沙盘 S4/S5：plist 字节恢复 + oc-go runtime 复核；5 home 备份在位）
RUNTIME_RESTARTED                 = NOT_YET（Owner-gated；沙盘实证重启门逻辑）
SERVICES_RESTARTED                = NONE（canary runtime 为隔离实例，非生产服务）

RUNNING_AGENT_CORE_IDENTITY       = launchd ai.agent-core.runtime @ authsvc，pid 53919（Aug 30 15:33 起），
                                    node v25.6.1，app=/usr/local/libexec/agent-core/app
RUNNING_HARNESS_IDENTITY          = 5 常驻 apps/cli 子进程 @ uid 502（yanfenma）经 setuid
                                    dsh-agent-spawn-helper，harness=/usr/local/libexec/agent-core/harness
SOURCE_STAMP_TRUSTWORTHY          = NO（混合基线：app 主体 = 4cf9b3e [Aug 27, ROUTE_CHAIN_ACTIVATION_
                                    PHASE_A_EXECUTE]，compose.js = 3dae32e [Aug 28]；7 文件哈希逐一
                                    比对定位。跟进 blocker：从单一 commit 重部署。未伪造身份）
```

## 7. 交付字段

```
TASK_NAME             = 止血 执行
TASK_STATUS           = STOPPED_AT_OWNER_GATE（生产写入待 Owner root；其余全部完成）
PREFLIGHT_RESULT      = PASS（含边界声明；与调查报告零冲突）
PRODUCTION_CONFIG_BEFORE = §2.2 矩阵（运行时证据）
PRODUCTION_CONFIG_AFTER  = 5 home zai-ready（已生效于下次 spawn）+ plist flip 待 Owner
CANARY_RESULT         = PASS（三层运行时证据）
ROLLOUT_RESULT        = 凭证/settings 补齐 COMPLETE（5/5）；全局 flip READY_FOR_OWNER_RUN
ROLLBACK_RESULT       = TESTED（沙盘干净回滚 ×2；home 备份 ×5；runner 自动回滚）
REMAINING_BLOCKERS    = (B1) Owner 执行 runner（唯一剩余生产步骤）；
                        (B2) source stamp 混合基线（4cf9b3e+3dae32e）→ 单一 commit 重部署；
                        (B3) Owner run 后首个真实重生子进程 env 观察（验证钩子，非阻塞）
RECOMMENDED_NEXT_TASK = Owner: sudo bash /tmp/run-agent-core-ocgo-hemostasis-v1.sh → 备用 审计 或 路由 执行
```

## 8. 边界与安全性声明

- **生产写入清单（本轮已发生）**：仅 5 个 Agent home 的 `.credentials.yaml` + `settings.yaml`（yanfenma 属主文件），全部有备份/哈希/权限保持；额外创建备份目录 `.zhixue-backup-20260830/`（homes/ 内，非 inventory 扫描路径）。
- **生产零触碰**：plist、overrides、agents.json、bindings、scheduler store、Feishu、OpenCode Go 账户/余额、任何业务消息。runtime pid 全程 53919 未变。
- **凭证安全**：ZAI key 仅 file-to-file 复制（grep 追加），任何日志/报告/证据不含值；证据文件只含 key 名（[REDACTED] 形式）。
- **canary 隔离性**：独立 root + home/workspace 副本 + Feishu off + 无投递 job；对生产状态的唯一读取 = 复制源文件。
- **runner 静态审计**：sudo 仅出现在头注释/说明；无 eval/base64/ssh；rm 仅限 /tmp 临时文件；kill 零调用（重启经 launchctl 单标签）；plist 修改原地保 inode。
- **仓库**：docs-only，全部产出位于独立 worktree 分支 `zhixue-exec-20260830-records`（@ 9a89b94）；主 checkout 的用户 WIP（broker 修改 + 未跟踪 docs）零触碰、零 stash/reset/clean。
- 无 sudo 执行；未冒充/伪造任何 commit 身份（source stamp 如实标 NO）。
