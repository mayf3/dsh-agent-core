# SCHEDULER_REQUIRED_JOBS_MIGRATION_V1 — FA 闭合 + Wave 0 裁决 + Wave 计划（docs-only）

> GOAL_NAME = SCHEDULER_REQUIRED_JOBS_MIGRATION_V1 · GOAL_MODE = NEW_GOAL · OWNER_DISPATCH_UNIT = GOAL
> CURRENT_PHASE = FIRST_ACTION_CLOSURE（PHASE_LOCK：零 production mutation）
> 日期：2026-09-05 · 前置：required-scheduler-jobs-inventory-v1-20260905 @ e04d9b1（READY_FOR_MIGRATION，不重做）
> 本轮边界：PRODUCTION_MUTATION = 0 · scheduler.create/update/enable/disable/remove = 0 · 生产 store 未写入

---

## 1. FA1 — candidate 计数口径修正（acceptance denominator 唯一化）

### 1.1 问题

inventory REPORT.md §8 同时写有 `TOTAL_CANDIDATES = 18`、`KEEP 4`、`MIGRATE 13`、
`RETIRE 3 组`，18 混用了两种计数单位（per-job record 与分组裁决），acceptance
denominator 不唯一。

### 1.2 裁决（CANDIDATE_COUNTING_UNITS_V1）

```
COUNT_UNIT_JOB_ROW        = OpenClaw jobs.json 逐行（279 行）——仅 inventory 映射粒度，
                            不是 acceptance 单位
COUNT_UNIT_CANDIDATE      = 迁移裁决 record：
                            MIGRATE 13 条（M1–M13，覆盖 40 legacy rows）
                            KEEP    4 条（K1–K4，现役异机制承载）
                            RETIRE  3 条分组裁决（R-A/R-B/R-C，覆盖 239 rows + 机制残留）
ACCEPTANCE_DENOMINATOR    = MIGRATE 13（唯一迁移验收分母；M5/M7/M8 为多 job 族，
                            族内逐 job 仍须逐条满足 ACCEPTANCE 才算该 M 项 migrated）
TOTAL_CANDIDATES = 18 的解读 = 13 MIGRATE record + 4 KEEP record + 3 RETIRE group record，
                            其中只有 13 进入 acceptance；KEEP/RETIRE 无验收语义
SUMMARY_COUNTS.json       = job-row 级 buckets，与上不矛盾（40 = ΣMIGRATE buckets；
                            239 = ΣRETIRE buckets），两文件口径差即 job-row vs record
```

由此本 Goal 全部后续计数（MIGRATED/BLOCKED/PARTIAL 分母）一律以 **MIGRATE 13** 为准。

## 2. FA2 — Scheduler canonical topology 机械闭合（B4 关闭条件）

### 2.1 实例清单（2026-09-05 fresh 只读）

| 实例 | 进程 | root / store | 在役 | 判定 |
|---|---|---|---|---|
| system 域生产 runtime | launchd `ai.agent-core.runtime`，pid **72082**（本轮 `ps` 实证），`production-runtime.mjs --root /Users/authsvc/.agent-core --catchup 0` | store = `/Users/authsvc/.agent-core/scheduler/jobs.json`（V2） | YES（含 broker、router、feishu 面） | **CANONICAL** |
| 用户域 scheduler-v2 | launchd gui `ai.agent-core.scheduler-v2`，pid **1696**，`--root /Users/yanfenma/.agent-core-scheduler-v2`（dsh-agent-core-main worktree 构建） | store = `~/.agent-core-scheduler-v2/scheduler/jobs.json`（本轮直接读取：恰 1 job = stock-daily-market-brief-001，**enabled=false**；2 occurrences 全 succeeded，后一次 deliveryStatus=not-delivered） | YES 但零在役业务 | **NON-CANONICAL**（历史 canary 面） |
| 本地 scratch V1 | `~/.agent-core/scheduler/`（33B 空 V1） | — | NO | 无关 |
| legacy 移动面 runtime | pid 18234（provider 已死，飞书面已摘 per feishu-splitbrain-v1） | 不含 scheduler 业务 | — | 无关 |

### 2.2 裁决

```
CANONICAL_AGENT_FACING_SCHEDULER_INSTANCE =
  system 域 launchd ai.agent-core.runtime（pid 72082，root=/Users/authsvc/.agent-core）

CANONICAL_STORE =
  /Users/authsvc/.agent-core/scheduler/jobs.json（V2 store，authsvc 属主）

MODEL_FACING scheduler.create 写入哪个实例 =
  canonical 实例，in-process 直写 canonical store。证据链（deployed app
  /usr/local/libexec/agent-core/app 逐文件核对）：
  broker capabilities/scheduler.js（schedulerManifest）→ broker gateway.js
  （scheduler trusted-context + mutation 面内联处理）→ production-runtime
  compose.js:373-383（同一 runtime 内 new JobStore(layout.jobsStore) +
  createSelfServiceSchedulerAccess 复用同一 store，无第二实例、无远端 store）；
  layout.jobsStore = join(root,'scheduler','jobs.json')（paths.js:89），
  root = /Users/authsvc/.agent-core。

previous successful create/run evidence 属于哪个实例 =
  09-05 ASM 验证 A canary f1dda993（create 直回 jobId/nextRunAt、deleteAfterRun
  已消费）= canonical 实例（生产 store 经 scheduler.list RAW 读取，ASM goal 证据）。
  08-30 stock 简报 canary（run succeeded / delivery not-delivered）= 用户域
  NON-CANONICAL 实例（其 store 本轮字节级在证）。

B4 裁决 = CLOSED（机械）：拓扑唯一化规则生效——
  T1 全部迁移 job 一律只写 CANONICAL_STORE；对用户域 scheduler-v2 store（pid 1696）
     DO_NOT_WRITE。
  T2 其上现存 disabled 简报副本 = 历史证据，不启用、不删除（归属 M5 记录）。
  T3 实例退役（bootout ai.agent-core.scheduler-v2）= 独立 Owner 决策，记
     FOLLOW_UP_DEBT（B6 类），不阻塞本 Goal（它已零在役业务，无双写风险）。
BULK_JOB_CREATION 解禁状态 = 保持 FORBIDDEN 直至每 Wave apply 前 fresh readback
  完成（见 §5 前置清单）；本闭合只是解除"拓扑不明"这一禁止理由。
```

生产 store 对本 shell 不可读（`ls /Users/authsvc/.agent-core/scheduler/` → Permission
denied，本轮如实记录）——apply 轮的 fresh readback 须经 Owner sudo 只读通道（先例：
ASM goal scheduler.list RAW）。

## 3. Wave 0 — M8 欢欢复诊提醒（at 2026-09-07T01:00Z = 北京 09:00）裁决

### 3.1 兜底核查（只读，本轮完成）

| 检查面 | 结果 |
|---|---|
| legacy OpenClaw 定义（`~/.openclaw/cron/jobs.json`） | 存在且 enabled：`658c11d2…`「欢欢腰突第6周复诊评估提醒」，at 2026-09-07T01:00:00Z，deleteAfterRun，delivery=announce——但执行器已死，**必然静默失效** |
| 用户域 scheduler-v2 store | 无任何 09-07 提醒（本轮全文读取：仅 disabled 简报副本） |
| canonical 生产 store | 本 shell 不可读（sudo 需 Owner 密码）→ **无法机械排除已存在副本；同时无任何证据表明存在**（无 goal 曾创建它） |
| production Workflow（svc-workflow） | 全 docs/evidence 检索零命中（复诊/提醒/reminder）；生产凭据锁死 authsvc，Agent 无法直查 workflow 实例表 → 无 Workflow reminder 兜底的任何证据 |

**兜底判定 = ABSENT（基于可达证据面）；canonical store 与 workflow 实例面存在不可读
盲区，apply 前置 fresh readback 必须覆盖"防重复"检查。**

### 3.2 裁决：本轮不创建 reminder

三条独立依据，任一条单独即 BLOCK：

1. **B2（DELIVERY JOB BLOCKER）**：该提醒业务价值 = 家庭群送达（USER_VISIBLE_DELIVERY_REQUIRED）。
   唯一 delivery 证据 = 08-30 canary `not-delivered`；announce/deliver 面未在生产证明。
   Goal 明令「不得把 run=succeeded 误写为 user received result」且「不得使用真实家庭提醒
   作为未验证 delivery channel 的 canary」→ 现在创建 = 高概率 run 成功但零送达的假兜底，
   比"确定漏提醒"更危险（它会关闭人为补救窗口）。
2. **PRODUCTION_MUTATION_CONCURRENCY = 1**：shared mutation slot 由 Visit Activation
   goal 持有（r4/r5 均 FAILED_NO_MUTATION 收尾但 goal 未释放 slot）。
3. **fresh readback 前置**：canonical store 本 shell 不可读，创建前的 job-name/idempotency
   collision 与 DUPLICATE_ACTIVE_SCHEDULES=0 检查无法执行。

### 3.3 OWNER_ACTION_REQUIRED（唯一有硬截止的升级项）

DEADLINE = 2026-09-07T01:00Z。请 Owner 在 09-06 内二选一：

- **Option A（推荐，零 mutation 风险）**：Owner 人工在家庭群发一次提醒，或口头告知欢欢——
  立即消除硬截止风险，迁移侧随后在 B2 关闭后走正常 M8 迁移（提醒转为 M8 族内普通项，
  即使错过 09-07 时点也有业务对账价值）。
- **Option B（slot 释放后 agent 创建）**：释放 shared mutation slot + 提供 canonical store
  只读 readback（sudo cat jobs.json / 或确认 scheduler.list RAW 通道）+ 确认接受
  delivery 未证明下的创建；Agent 随后按 ONE reminder packet 创建（legacy payload 原文冻结，
  tz Asia/Shanghai，single-side-enabled，OpenClaw 侧绝不重启）。

在 Owner 未行动前：Agent 不创建、不 bulk、不碰 OpenClaw。

## 4. Wave 1 — M2/M3/M4/M7/M9/M11 逐项 gate 重判定

（推翻 inventory §9 "零 blocker 直迁" 的整体默认；逐项如下。GATE 结论只有
ELIGIBLE（无 unresolved gate）与 BLOCKED(gate) 两态。）

| M | 项 | 分类裁决 | delivery 语义 | gate | 说明 |
|---|---|---|---|---|---|
| M2 | HR 每日档案同步 | **EXECUTION_ONLY** | 无（报告落 workspace/内部） | **ELIGIBLE**（附执行轮核验项） | hr-agent=dc702687 现役（BUSINESS identity 已裁定）；workspace 脚本路径对等在执行轮核验；无身份 gate |
| M3 | 效率管家每日早报 | **USER_VISIBLE_DELIVERY_REQUIRED** | Owner 每晨飞书收到早报 = 业务本体 | **BLOCKED(B2)** | inventory 原记 NONE 是把 delivery 语义漏判；早报不送达 = 无业务结果 |
| M4 | 博客随想流水线 | **EXECUTION_ONLY** | 无（内容入 workflow 管线） | **ELIGIBLE**（附执行轮核验项） | agt_blog-agent 现役（A2A canary target）；workflow_execute 生产 READY（Lane A）；上游/下游两个 cron 时点两条 job 定义 |
| M7 | LLM Wiki 维护族 | **EXECUTION_ONLY** | 无（wiki 任务推进/审计产物在知识库内） | **BLOCKED(B5)** | owner=knowledge-curator-agent 未在当前 fleet 有现役实证 → 须先完成 canonical per-agent identity migration |
| M9 | 每日数学练习生成+打印 | **EXECUTION_ONLY** | 打印机出纸 = 物理 side effect（非消息 delivery，不落 B2） | **BLOCKED(B5)** | owner=3d-print-agent 未迁入；打印机面可达性随执行轮核验 |
| M11 | GitHub 泄露扫描 | **EXECUTION_ONLY**（发现泄露时的告警 = 条件性升级，不构成每日 delivery gate） | 无日常送达 | **BLOCKED(B5, 轻度)** | owner open-source-agent/security-agent 均未在当前 fleet 有现役实证；gh CLI 可达性执行轮核验 |

**Wave 1 apply packet 现值 = {M2, M4}（2/6 ELIGIBLE，非整体 ZERO_BLOCKER）。**
执行轮核验项（apply 前 fresh readback，全部只读）：canonical runtime pid/store 现态、
job-name collision、idempotency key collision、target agent（dc702687 / agt_blog-agent）
enabled 状态、schedule/tz 冻结值比对、shared mutation slot = FREE、
canonical store 防重复盲区消除（§3.1）。

single-side-enabled discipline 适用：新 job 验证成功前后 OpenClaw 侧一律零动作
（宇宙保持历史原样，DO_NOT_RESTORE）。

## 5. Wave 2 现状（不被本 Goal 主动推进，依赖驱动）

| M | 依赖 | 现值 |
|---|---|---|
| M1 | visit-activation dispatch readiness（或先落 30min 过渡 job 的 Owner 决策） | BLOCKED(B1)；slot 持有方 |
| M5 | B2 delivery 面生产证明 + stock 群 binding 重建；manifest/canary 证据可复用但须对 canonical closure 重验 | BLOCKED(B2)；其 disabled 副本在 NON-CANONICAL store，迁移 = 在 canonical store 新建，非启用旧副本（T1/T2） |
| M6 | forum.moderate production readiness（forum goal READY_FOR_PRODUCTION_GATE，slot 冻结中） | BLOCKED(B3) |
| M10/M12/M13 | 各自 agent identity 迁入（podcast-producer / needs-radar有实证+低置信度 / ceo） | BLOCKED(B5)；M12/M13 为 Owner 可低成本翻案项 |

## 6. GOAL 状态冻结（本轮收口）

```
GOAL_STATUS = READY_FOR_WAVE1_APPLY_PACKET（pending slot + fresh readback）
B4 = CLOSED（§2.2 裁决；topology 唯一化规则 T1/T2/T3 生效）
ACCEPTANCE_DENOMINATOR = MIGRATE 13
WAVE0 = BLOCKED(3 独立依据) + OWNER_ACTION_REQUIRED(§3.3, deadline 09-07T01:00Z)
WAVE1_ELIGIBLE = [M2, M4]
WAVE1_BLOCKED = [M3(B2), M7(B5), M9(B5), M11(B5)]
WAVE2 = 依赖驱动（§5）
OPENCLAW_RESTORED = NO · 生产 store 写入 = 0 · mutation slot 状态 = HELD(visit-activation)
PRODUCTION_MUTATION = 0（本轮全程）
```

证据文件：本文件 + `MANIFEST.sha256`。legacy 定义原文、v2 store 全文见各自路径
（`~/.openclaw/cron/jobs.json`、`~/.agent-core-scheduler-v2/scheduler/jobs.json`，
只读引用未改动）。

## 7. 执行轮补充发现（本轮 legacy payload 精读，2026-09-05）

Wave 1 两个 ELIGIBLE 项的 legacy 定义精读（jobs.json 原文）暴露以下必须进入
apply packet 的事实，均不改变 §4 的 gate 判定，但修正其分类细节并新增核验项：

**M2（hr-daily-sync-001，cron `50 0 * * *` 无 tz 字段）：**
1. **不是纯静默 EXECUTION_ONLY**：payload 输出要求「有 FAIL → 发详细异常清单」，
   delivery = announce → 飞书群 `oc_a5e90451…`（条件性告警面，与 M11 同性质）。
   分类维持 EXECUTION_ONLY（日常无送达），但 acceptance 的 business side effect
   检查须覆盖 FAIL 路径的告警语义。
2. **⚠️ Task 4 含特权修复步骤**：`audit_forum_permissions.py` 的 FAIL 分支被指示做
   machine-admin client create / UPDATE machine_clients（auth-service 写操作）。
   迁移 packet 必须裁决：迁移版本是否保留自动修复，或降级为只报告+人工修复
   （自动写 auth DB 的 recurring job 与「生产 mutation 并发=1」治理相抵触，
   推荐 packet 采 FAIL→只报告形态）。
3. 核验项新增：legacy schedule 无 tz 字段（OpenClaw 缺省行为 vs canonical tz
   显式 Asia/Shanghai），冻结时点须以 00:50 北京时间为准显式写 tz。

**M4（blog-daily-writing-001 `7 0 * * *` 无 tz + daily-thoughts-summary-001
`22 4 * * *` tz=Asia/Shanghai）：**
1. blog 侧 payload 硬编码 workflow_execute 参数含 `definitionVersionId=ba00866b-…`
   与五 principal UUID——执行轮必须 fresh 核验该 definitionVersionId 仍是生产
   current（workflow-definition-authoring goal 后版本可能已前移），失效则迁移
   payload 改为按 definitionKey 解析 current version，不得平移死引用。
2. blog 侧 delivery = announce → 博客群 `oc_21ced618…`（汇报性送达，非用户义务
   型；维持 EXECUTION_ONLY，但如果该汇报群送达长期失败不应记迁移失败——
   acceptance 以 workflow 实例创建成功为准，announce 尽力而为并在 packet 显式声明）。
3. daily-thought 上游（04:22）delivery → 随想群 `oc_f2a66066…` 同上处理。
4. 核验项新增：随想源目录路径 `/Users/yanfenma/.openclaw/groups/workspace-…/daily-thoughts/`
   在 canonical runtime fresh session 下的可达性（OpenClaw workspace 路径 ≠ 当前
   agent workspace，可能需要路径迁移或 symlink 裁决）。
