# SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 — ROOT_CAUSE_CONFIRMATION_AND_DESIGN (2026-09-07)

> Investigation（evidence authority）——不授予实现/部署权限。实现需另行 accepted Spec（协议见
> `.agents/README.md`）。PHASE_LOCK=ON：本文件只固化根因与设计，不改任何 runtime 代码。
> 生产边界：P0 WORKFLOW_ASSIGNEE_CANONICAL_IDENTITY_RECONCILIATION_V1 持有生产 mutation slot；
> 本轮零生产 mutation、零服务重启、零 credential 字节接触。

INCIDENT 模型 = DAILY_RAW_DISTILLED_SUMMARY_SCHEDULER_RECOVERY_V1（imported evidence，全部
机械复核；本轮 fresh-verify 结论与该 incident 证据一致，两处补充修正见 §2.4/§3.4）。

---

## §1 方法与证据面

只读 census，2026-09-07，OS 用户 yanfenma（无 sudo）：

| 证据 | 来源 |
|---|---|
| runtime 拓扑 | `launchctl print gui/502/ai.agent-core.runtime`、`launchctl print system/ai.agent-core.runtime`、`ps aux` |
| live 生产代码 | `/usr/local/libexec/agent-core/app`（installer subset，可直读） |
| source 真值 | 本 repo `main` 分支（`git show main:…`）；本工作树为 docs 分支（base 较旧，缺 `capabilities/scheduler.js`——census 一律以 main/live app 为准） |
| broker/scheduler 源 | `packages/broker/src/{gateway,credential-store,registry,relay,mapping}.js`、`packages/scheduler/src/{store,control,job-model,scheduler}.js`、`scripts/agentcore-cron.mjs`、`packages/production-runtime/src/{compose,paths}.js` |
| 先行 Goal 证据 | `docs/evidence/daily-summary-scheduler-recovery-v1-20260907/`（RECONNAISSANCE/CLOSURE）；scheduler-tool-surface goal（PR #167 double-envelope 根因判别 + 生产验收）；`docs/investigations/scheduler-v2-deploy-target-v1.md` |
| health 面 | `GET 127.0.0.1:8790/health` → `{"ok":true,"deliverReady":true,"authConfigured":false,"storeReady":true}` |

---

## §2 A — CONTROL PLANE（根因确认）

### §2.1 权威链（Agent → 落盘）

```
Agent（agt_ child, uid 502）
  → model-facing tool：broker capability manifest（child 侧按 app-tree 字节静态注册，
    registry.js 扁平化为 20 字段大 schema；selector=action）
  → child relay（broker/relay.js）：agentRpc.request → parent rpc-channel
  → parent broker gateway（production-runtime in-process, compose.js mode:'gateway'）
      validateInvocation（scheduler-validation.js，闭集 17 字段 + trusted-context 校验）
      → loadCredentialFor(AGENT_CORE_CREDENTIALS_FILE, agentId)（credential-store.js）
      → 无 entry ⇒ fail-closed `credential_unavailable`（每调用，绝不 boot 失败替身）
      → grant 校验（scheduler.read:self / manage:self 隐含；manage:any 需 auth-service grant）
  → scheduler self-service op（scheduler/self-service.js → control.js createJobOp/updateJobOp/…）
  → JobStore.mutateDoc：跨进程 lockfile（O_EXCL，stale 30s / timeout 15s）
      → 重读最新 → 应用 delta → 原子 persist（tmp+fsync+rename）→ 释放
  → run ledger：jobs.json 内嵌 occurrences/fences（V2）+ runs.jsonl（appendRunEvent，fsync，10MB 界）
  → 执行：Scheduler engine（tick）→ occurrence → invoker（scheduler-router → Router → AgentProcess.turn）
```

### §2.2 权威四元组（机械判定）

```
AUTHORITATIVE_RUNTIME            = launchd system domain `ai.agent-core.runtime`
                                   （user authsvc 505:601；live app /usr/local/libexec/agent-core/app；
                                   2026-09-07 实测 pid 51361，--catchup 0）
AUTHORITATIVE_STORE              = /Users/authsvc/.agent-core/scheduler/jobs.json
                                   （V2 doc：jobs+occurrences+fences）+ 同目录 runs.jsonl
AUTHORITATIVE_MUTATION_ENTRYPOINT =
   双面孔、单一落盘权威（JobStore.mutateDoc 锁）：
   (a) Agent 面：broker capability `scheduler`（create/list/runs/enable/disable/remove/update），
       身份=trusted Router context（绝无 request 输入身份）
   (b) Operator 面：`agentcore-cron` CLI（live app scripts/agentcore-cron.mjs，字节 b476038a），
       身份=effective OS user；canonical 用法=authsvc 身份运行（先例：`sudo -u authsvc env -i …`）
AUTHORITATIVE_CREDENTIAL_SOURCE  = AGENT_CORE_CREDENTIALS_FILE=
                                   /usr/local/libexec/agent-core/config/agent-credentials.json
                                   （0600 authsvc，launchctl print system 实证注入）
                                   + BROKER_AUTH_ORIGIN=http://127.0.0.1:4001
```

单一性判定：`PRODUCTION_SCHEDULER_MUTATION_AUTHORITIES = 1` **在 store 层成立**（一切合法写
必经 `mutateDoc` 锁；V1 时代设计即"one machine, one lockfile"，store.js 头注 D-005）。
**不成立的是 surface 层纪律**（见 §2.4 隐患）——实现期需把纪律编码化，而非改造 store。

### §2.3 全部 Scheduler-like mutation surface 枚举（2026-09-07 实测）

| # | SURFACE | CAN_MUTATE_PRODUCTION | SHOULD | WHY |
|---|---|---|---|---|
| S1 | system 域 runtime engine（authsvc，pid 51361） | YES | YES | 权威 runtime；engine 经同一 mutateDoc 锁写 job state/occurrence |
| S2 | broker `scheduler` capability（经 S1 的 gateway） | YES | YES | Agent 面权威入口；身份/credential/grant 三重门 |
| S3 | `agentcore-cron` CLI **以 authsvc 身份**（live app 字节） | YES | YES | Operator 面权威入口（incident 修复通道） |
| S4 | `agentcore-cron` CLI 以其他 OS user（$HOME 解析） | NO（权限） | NO | 落到**非生产 store**（$HOME/.agent-core/...）；"看似成功"实为写错库——split-brain 错觉之源 |
| S5 | gui 域 runtime engine（yanfenma，pid 35940，glm53 wrapper） | NO | NO | 写 `/Users/yanfenma/.agent-core/scheduler/jobs.json`（33B 空 V1）；非生产权威 |
| S6 | gui 域 scheduler-v2 runtime（yanfenma，pid 60339，dsh-agent-core-main 树） | NO | NO | 写 `~/.agent-core-scheduler-v2/`（恰 1 disabled stock job）；NON-CANONICAL 历史证据，DO_NOT_WRITE |
| S7 | root/任意进程直写 /Users/authsvc/.agent-core（如历史 PIV1 run6） | YES（需 root） | NO | 用户 store 目录中遗留 `jobs.json.piv1-run6-leftover-authsvc`（authsvc 属主）实证"跨域直写路径曾经存在"；必须保持关闭 |

### §2.4 census 发现的实质隐患（MECHANICAL_FIX 级）

1. **`/usr/local/bin/agentcore-cron` symlink → 本 dev 工作树**（`scripts/agentcore-cron.mjs`
   sha 7a4e4864），≠ live app / main 的权威字节（b476038a）。operator 敲 `agentcore-cron`
   实际执行的是**落后且可变**的代码（当前缺 `update`/`--channel`/V2 对齐），且 store 解析
   =`$HOME/.agent-core/...` → 身份错配时静默写错库。**修复 = 改为 live app 字节的稳定安装
   （byte-pinned copy）+ mutation 输出恒回显 resolved store path。**
2. 权威 runtime 以 `DSH_AGENT_CHILD_UID=502` spawn agent child → child 内 shell `$HOME=/Users/yanfenma`
   → agent 在 turn 里若直接跑 `agentcore-cron` 会命中 S4（用户 store）而非生产。**纪律：agent
   面一律走 S2 capability；CLI 面仅 operator 以 authsvc 身份走 S3。**
3. 三 runtime × 三 store 长期共存（S1/S5/S6）+ 非 canonical store 命名不携带"非生产"标记 →
   每次调查都要重新做 store 归属考古（本次 incident 即是）。**修复 = 归属标注与退役决策入
   FOLLOW_UP_DEBT（非本 Goal 阻塞项）；watchdog 的 duplication 检测只看 canonical store。**

---

## §3 B — CAPABILITY READINESS（根因确认）

### §3.1 为什么无 credential 的 runtime 仍暴露 scheduler mutation tool

机械链：manifest 是**纯数据**（capabilities/scheduler.js 头注），child 侧 broker plugin 以
**静态 app-tree 字节**注册 model-facing tool（broker/index.js `config.manifests` → registry
扁平化）；credential 只存在于 **parent gateway** 进程内（`AGENT_CORE_CREDENTIALS_FILE` env）。
⇒ **tool 的"可用性"与"credential readiness"分布在两个进程，present 阶段无任何 gate**——
模型看到的 scheduler tool 永远"看起来正常"，直到调用才在 parent fail-closed。
这就是 incident 观察 2 的完整机制：用户域 runtime（glm53 wrapper 全文在证）不注入
`AGENT_CORE_CREDENTIALS_FILE`/`BROKER_AUTH_ORIGIN` → 经其 relay 的每次 mutation 恒
`credential_unavailable`（与 caller 是谁无关——FAILURE_LAYER=credential injection 层）。

补充修正（对 imported evidence 的 fresh-verify）：用户域 **checkout**（production-dsh-agent-core）
的 broker capabilities 目录**无 scheduler.js**（实测仅 agent-definition/forum/okr/workflow）；
child 之所以"看得到" scheduler tool，是因为 child 的 tool 字节来自 **app 树 symlink**
（live app capabilities 含 scheduler.js）。即"暴露面"由 app 树统一供给，"可用性"由各 parent
进程 env 决定——两者解耦正是缺陷结构。

### §3.2 设计：readiness gate（fail-before-tool-exposure，零 credential 复制）

原则：**可用性由 parent 单方判定，经既有 rpc 通道下发；绝不复制 credential、绝不在 child
侧猜。** 两个层次（Spec 期二选一或叠加，首选 1）：

1. **HANDSHAKE AVAILABILITY MASK（首选）**：child↔parent 既有 rpc 通道的会话建立/能力查询
   应答中增加一个 capability-availability 列表；parent gateway 对每个 manifest 计算
   `available = credentialsFile 已配置 && loadCredentialFor(callerAgentId) 有 entry`；
   child broker plugin 注册 tool 前按 mask **过滤**——credential 不具备的 runtime 里
   scheduler mutation tool **根本不出现**（模型不可见 ⇒ 不可误用）。
2. **EXPLICIT UNAVAILABLE STATE（兜底/叠加）**：mask 未及或 mask 漂移时，parent 对不可用
   capability 的调用返回结构化 `capability_unavailable`（明确"此 runtime 未配置 Scheduler
   控制面"，语义 ≠ `credential_unavailable` 的身份层、≠ `mutation_outcome_unknown`），
   绝不落入通用 ambiguous 渲染。

验收口径：TEST-1（§8）——无 credential runtime 中模型可见工具集不含 scheduler mutation，
或调用返回显式 unavailable；`credential_unavailable` 不再可能作为 mutation 的首次反馈出现。

---

## §4 C — OUTCOME CERTAINTY（根因确认）

### §4.1 `mutation_outcome_unknown` 的全部机械生成点

| 生成点 | 状态 |
|---|---|
| G1 capability manifest `errors[]` 声明（main capabilities/scheduler.js baseErrors："The mutation may have committed; inspect before any manual retry"） | 契约面（保留，语义=真不确定） |
| G2 **历史假 unknown 主根因 = double transport envelope**（parent-rpc-relay broker 分支多包 `{ok,result}` → child 侧 `validSchedulerMutationResult` 严格 11 字段校验必死 → ambiguousError） | **已判别+已修+生产已验**（PR #167→main 9ea30c8；2026-09-05 部署 relay ed183a77 后 create 直回 jobId、list 单层）——不再是开放根因 |
| G3 真实传输丢失/超时（child→parent rpc、response loss）→ relay.js `SCHEDULER_MUTATIONS` 分类为 unknown | **按设计保留**（CTR-FAIL-001：零自动重试）——需补"自动收敛"半环（§4.3） |
| G4 relay 校验拒绝（`validSchedulerFailure` 白名单外形状）→ ambiguous 归类 | 契约面，随 G2 修复后应罕见；异常形状记 FOLLOW_UP 观测 |

Store 本身**不可能产生不确定**：`_writeAtomic` = tmp+fsync+rename（原子），任何 throw 前磁盘
未动 ⇒ **CLI exit 0 ⇔ APPLIED；exit ≠0 ⇔ NOT_APPLIED**（幂等 oracle）。真正的不确定窗口仅
"commit 成功后、响应返回前"调用方死亡/断连（G3）。

### §4.2 incident 第一次 mutation（unknown → 读回 NOT_APPLIED）的定性

确切调用通道已不可恢复（前会话 rollout 清理，RECONNAISSANCE §3 诚实边界）。机械上与 G3/G4
类一致：调用方在**无法区分"未落盘"与"落盘但响应丢失"**的通道上得到了 unknown。设计上无需
复活该通道——需要的是让**任何** unknown 都自动收敛（下节），使 unknown 永不为终态。

### §4.3 设计：mutation 确定性收敛（APPLIED / NOT_APPLIED / STILL_UNKNOWN_WITH_ALERT）

1. **幂等身份（前置，最关键）**：现 `createJobOp` 仅按**新生成 uuid** 判重（control.js 实测：
   `latest.jobs.some(j => j.id === job.id)`——恒不命中）⇒ 同名重试必产重复。**MECHANICAL_FIX：
   create 增加 name 级幂等锚**（同 name 已存在 ⇒ 返回结构化 `already_present`（附 existing
   jobId），不写盘；CLI `add` 同语义）。update/delete 天然以 jobId 为锚（NOT_APPLIED=job 不
   存在，可安全重放）。⇒ 盲重试从"危险"变为"安全但冗余"，singleton 由 store 保证。
2. **unknown 后自动 read-back/reconcile（自动，非人工）**：
   relay/self-service 层捕获 unknown ⇒ 立即以**幂等身份**对 canonical store 做只读 read-back：
   命中 ⇒ 上抛 APPLIED（附真实 jobId）；未命中 ⇒ NOT_APPLIED（是否重放由调用方策略决定，
   **框架永不自动重放**）；read-back 本身失败 ⇒ `STILL_UNKNOWN_WITH_ALERT`（进 §6 告警面）。
   CLI 侧同构：`agentcore-cron reconcile --name <n>`（复用 list 读路径）。
3. **禁止**：盲目 mutation retry（现 MUTATION_RULE 升级为机械保证）；把 unknown 计为终态。

---

## §5 D/E — DESIRED-STATE 与 RUN-TIME 监测（设计）

### §5.1 desired-state 清单（机器可读，Owner 拥有）

- 文件：`/usr/local/libexec/agent-core/config/scheduler-desired-state.json`（**在 store 目录外**；
  只读消费；版本化 + sha256 入 watchdog 证据）。schema（最小）：
  `{version, jobs:[{logicalId /*= job name*/, expectedEnabled, expectedSchedule{kind,expr|at|everyMs},
  expectedTimezone, expectedAgentId, nextRunPolicy{graceMinutes, maxConsecutiveFailures}}]}`
- 初始内容：以 09-07 canonical store 22 jobs 中 Owner 认定的 critical 集（至少
  `每日摘要检查`/fa13b0ea）起步；由 Owner 评审后冻结，**不由 watchdog 生成或回写**。
- 检测（纯读 canonical store，S1 同机同身份）：`JOB_MISSING / JOB_DUPLICATED（同名>1）/
  JOB_DISABLED / SCHEDULE_DRIFT / TIMEZONE_DRIFT / TARGET_AGENT_DRIFT`。
  **绝不直接 mutate jobs.json**——watchdog 是只读核对器 + 告警器。

### §5.2 run-time 可靠性检测（用真实 occurrence/run ledger）

数据面：jobs.json 内嵌 occurrences（idempotencyKey、nominal 时间、status 链
attempted→…→succeeded/failed）+ runs.jsonl（appendRunEvent：started/finished/error，fsync）。

| 检测 | 判据（机械） |
|---|---|
| EXPECTED_RUN_MISSED | 按 expectedSchedule 推导的 nominal occurrence 已过 `graceMinutes` 而无对应 run 记录 |
| RUN_FAILED | run/occurrence 终态 = failed/error（含 timeout 文案 `cron: job execution timed out`） |
| RUN_STUCK | job `state.runningAtMs` 存在且 > stuckRunMs（引擎 2h 界），或 run started 无 finished |
| CONSECUTIVE_FAILURE | `state.consecutiveErrors ≥ maxConsecutiveFailures` |
| SCHEDULER_RUNTIME_UNHEALTHY | `launchctl print system/…` state≠running / `GET 127.0.0.1:8790/health` 非 200-ok / control/runtime-evidence.jsonl 心跳超阈 |

"job 在 store 里"≠健康——以上全部以 ledger/health 为准，不留"静默缺跑"通道。

---

## §6 F — OWNER NOTIFICATION + WATCHDOG 形态（设计）

**不建新框架**：watchdog = 一个 launchd **system domain** 定时任务（独立 label，如
`ai.agent-core.scheduler-watchdog`，StartInterval=300s，以 authsvc 身份运行单脚本）。
独立性论证：由 launchd/pid 1 直接监督，**不经 Scheduler 调度自己**；与 runtime 无共享进程、
无共享 socket；store 读为文件直读（非 gateway）。

```
launchd watchdog timer（system 域，authsvc）
  ├─ 读 desired-state 清单（config，只读）
  ├─ 读 canonical store + runs.jsonl + occurrences（文件直读）
  ├─ 读 runtime health（8790 /health + launchctl state + evidence 心跳）
  ├─ 评估 §5.1/§5.2 全部检测器
  └─ 告警：飞书 im.message.create 直连 API（复用既有 feishu 凭据文件，只读、字节零外泄）
       → Owner 群；发送失败 ⇒ 落盘 alert 文件 + 退出码非零（launchd 可见）＝最后手段可见性
  └─ 自证：每轮追加 watchdog-evidence.jsonl（含轮次/判定/告警结果）
```

告警覆盖类（goal 列举的每一类都有 Owner 可见出口）：credential_unavailable（watchdog 自身
health/credential 探测失败即告警）、mutation reconcile 后仍 unknown、critical job missing/
duplicated/disabled/drift、missed run、failed run、scheduler unhealthy、**watchdog 自身连续
失败**（evidence 心跳断档由 Owner 侧既有每日检查面可见——已在每日摘要任务的视野内）。

`SILENT_CRITICAL_SCHEDULER_FAILURE = IMPOSSIBLE_BY_DESIGN` 的成立条件 = 上述检测器全实现 +
告警通道独立 + TEST-5..9 全 PASS（§8）。

---

## §7 测试计划（对齐 goal TEST REQUIREMENTS 1–10）

| # | 要求 | 机械测试形态（隔离夹具，零生产接触） |
|---|---|---|
| 1 | 无 credential runtime 不暴露可用 mutation | 夹具双进程（gateway 无 credentialsFile）+ availability mask 断言：tool 未注册 / 调用返回 capability_unavailable |
| 2 | canonical 有 credential → create/list/update 成功 | 现有 self-service canary 配方 + temp store（已有 18/18 先例）回归 |
| 3 | commit-before-response-loss → reconcile 至正确态、无重复 create | 注入"commit 后响应丢失"seam（beforeCommit 后抛）→ 断言 read-back 命中 → APPLIED 且 jobs 恰 1 |
| 4 | 同一逻辑 create 重试 → singleton | 同 name create ×2 → 第二次 `already_present`，store 恰 1 |
| 5 | critical job 缺失 → watchdog 检测 | temp store 删除 desired job → detector=JOB_MISSING |
| 6 | disabled/drift → 检测 | 改 enabled/schedule/tz/agentId → 四类 DRIFT/DISABLED 断言 |
| 7 | 宽限期后 occurrence 缺失 → missed run | 构造 nominal 过期无 run → EXPECTED_RUN_MISSED |
| 8 | run 失败 → 告警路径触发 | 注入 failed run 事件 → 断言告警 adapter 收到（recording seam） |
| 9 | watchdog 不依赖被监控 Scheduler | watchdog 进程树独立 + 断言其判定只读文件/launchd/health，不经 gateway；杀掉 engine 进程 watchdog 仍出 SCHEDULER_RUNTIME_UNHEALTHY |
| 10 | user-domain/legacy store 不会成为生产 mutation 目标 | CLI store 解析断言（非 authsvc $HOME ⇒ 拒绝或显式 --store 才继续）+ S5/S6 写路径零接触断言 |

---

## §8 分类（ANTI-CHURN）

**SHIP_BLOCKER（达到 PRODUCTION_READY 前必须闭合）**
- SB1 readiness gate（§3.2）缺失 —— 非 canonical runtime 可呈现"看似可用"的 mutation tool。
- SB2 mutation 幂等身份 + unknown 自动收敛（§4.3）缺失 —— unknown 仍可能是终态。
- SB3 desired-state/run watchdog + 独立 Owner 告警（§5/§6）缺失 —— 失败仍可静默。

**MECHANICAL_FIX（实现轮顺带）**
- MF1 `/usr/local/bin/agentcore-cron` 改 live app 字节稳定安装 + mutation 回显 resolved store path（§2.4-1）。
- MF2 name 级幂等锚落入 createJobOp/CLI add（SB2 的载体，单独列出防遗漏）。
- MF3 reconcile 子命令/路径（SB2 的收敛载体）。

**FOLLOW_UP_DEBT（不阻塞本 Goal）**
- 用户域 store（S5）与 scheduler-v2 store（S6）退役/命名标注裁决（Owner）。
- manifest 扁平 20 字段大 schema 的模型面可用性优化（既有 FOLLOW_UP）。
- G4 异常形状观测（envelope 修复后应趋零，仅计数）。

## §9 完成条件 ↔ 机制映射

AUTHORITATIVE=1（§2.2，store 层已成立）／NON_AUTH_PATHS DISABLED_OR_FAIL_BEFORE_USE（§3.2，
SB1）／CREDENTIAL_GATE（TEST-1）／IDEMPOTENCY（TEST-3/4，SB2）／UNKNOWN_AUTO_RECONCILE（§4.3-2）
／DESIRED_MONITOR（§5.1）／MISSED+FAILED+UNHEALTHY（§5.2）／OWNER_ALERT（§6）／WATCHDOG_
INDEPENDENT（TEST-9）／NO_SECRET_BROADENING（watchdog 只读凭据、零复制零日志字节）／NO_STORE_
SPLIT_BRAIN（MF1+TEST-10+§2.4-3 裁决）⇒ **SCHEDULED_TASK_FAILURE_CAN_BE_SILENT = NO**。

## §10 下一步（非本文件授权）

实现需 accepted Spec（建议 `docs/specs/SCHEDULER_CONTROL_PLANE_RELIABILITY_V1.md`，scope=
SB1+SB2+SB3+MF1–3，test plan=§7）。生产 apply 类步骤（CLI 重装、watchdog launchd 安装、
desired-state 冻结）全部等 P0 slot 释放 + fresh census；实现/测试/夹具可立即开工。
