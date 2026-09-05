# REQUIRED_SCHEDULER_JOBS_MIGRATION_V1 — READ_ONLY_INVENTORY 报告

> GOAL_NAME = REQUIRED_SCHEDULER_JOBS_MIGRATION_V1 · GOAL_MODE = NEW_GOAL · OWNER_DISPATCH_UNIT = GOAL · PRIORITY = P1_OVERNIGHT
> CURRENT_PHASE = READ_ONLY_INVENTORY（PHASE_LOCK = ON · PRODUCTION_MUTATION = FORBIDDEN）
> 日期：2026-09-05 · 执行者：Agent Core read-only inventory owner
> GOAL_TERMINAL_BOUNDARY = READY_FOR_MIGRATION

---

## 0. 边界合规声明

```
PRODUCTION_MUTATION = NONE
scheduler.create/update/enable/disable/remove = 0 次
cron write / launchd write / OpenClaw restore / agent_wake = 0 次
production config mutation / production DB mutation = 0 次
```

本轮全部动作 = 只读：repo docs 解析、`~/.openclaw/cron/jobs.json` 与
`~/.agent-core-scheduler-v2/scheduler/` 只读解析、`launchctl print`、`ps`、`crontab -l`、
plist 读取、既有 evidence 比对。生产 Scheduler store（`/Users/authsvc/.agent-core/scheduler/`）
按设计对本 shell 不可读（sudo -n 需密码，未取），其现态以 2026-09-05 ASM goal 证据
（scheduler.list RAW 返回恰 1 个一次性 canary job）+ 本轮进程/launchd 实证交叉记录。

## 1. 两个历史数字的裁决（OWNER WARNING 项）

| 历史主张 | 裁决 | 证据 |
|---|---|---|
| TOTAL = 280 | **不是 current truth**。这是 2026-08-26 调查时 OpenClaw jobs.json 的**库存总数**（当时 enabled 140）；今日 fresh 只读解析 = **279 总数 / enabled 126**（期间 −1 清理）。且"库存数"≠"必需数"：其中 153 条已 disabled | `docs/investigations/scheduler-v2-deploy-target-v1.md` §0；本轮 `run-inventory-map-v1.py` |
| TOTAL = 6 | **不是全局迁移清单**。这是 2026-08-15/16 stock-agent **canary 单 agent** 的 6 个 enabled job（7 总）清单，属 stock 割接准备产物；今日 stock-agent enabled 已余 5（每日市场简报在割接纪律下双侧 disabled） | `docs/reports/openclaw-scheduler-caller-migration-v1.md` §1；`docs/reports/stock-cutover-preparation-v1.md` Task 3 |

**Current candidate universe 由本轮 fresh 只读证据重建**（§2），两个历史数字均不采信为全集。

## 2. CANDIDATE UNIVERSE（来源 × 现态 × 收口）

调查共三轮，第三轮无新增 materially relevant candidate，按 ANTI_CHURN 收口为 CLOSED_ENOUGH：

| # | 源 | 现态（2026-09-05 fresh 只读） |
|---|---|---|
| S1 | repo docs / reports / runbooks / specs | 调度族文档完整（scheduler-replacement-v1、caller-migration-v1、cutover-closure-v1、stock-cutover-preparation-v1、scheduler-v2-deploy-target-v1、feishu-stock-canary-v1、HR_DISPATCHER_V1=proposed、BACKUP_RETENTION_V1=accepted 未实施） |
| S2 | OpenClaw legacy cron（`~/.openclaw/cron/jobs.json`） | **279 jobs / enabled 126 / disabled 153；全部 lastRun ≤ 2026-08-30 23:37，之后零执行**。en masse error 与 legacy 模型 provider 死亡（opencode 429 月配额 / openai-codex 401 refresh_token_reused）时间线吻合 |
| S3 | 当前 Scheduler store | **生产（system 域 runtime，authsvc store）：零 recurring job**——09-05 ASM 验证 A 实证 store 仅含一次性 canary job（f1dda993，deleteAfterRun，已消费）。**用户域 scheduler-v2 实例**（pid 1696，root=`~/.agent-core-scheduler-v2`）：恰 1 job = 每日市场简报迁移副本（**disabled**；08-30 canary 执行 succeeded / delivery not-delivered）。本地旧 scratch store（`~/.agent-core/scheduler/`）= 空 V1（33B）。⇒ **当前 Scheduler 无任何在役 recurring work** |
| S4 | launchd / cron / 系统 automation | system 域：`com.openclaw.{gateway,workflow-dispatcher,forum-scheduler,host-exec-runner}` 全部 **disabled**，gateway 进程不存在；在役 = `ai.agent-core.runtime`(72082)、`com.auth-service`(56983)。gui 域在役 = `ai.agent-core.runtime`(18234，legacy/移动面，模型 provider 已死)、`ai.agent-core.scheduler-v2`(1696)、`com.svc-workflow`(63514)+`com.svc-workflow-monitor`、`com.xiaomusic`。用户 crontab：health-check.sh（06:30，今日有产出）、openclaw-backup backup-all.sh（03:00，今日完成）、xiaomusic 播放/停止/健康 ×5、GATE0-FROZEN（已注释）、clawhub 一次性（/tmp 文件已不存在）。authsvc 用户 crontab 不可读（权限边界，如实记录） |
| S5 | Agent 历史 recurring work | OpenClaw fleet 87 配置 / 77 活跃（08-16 口径）即历史 recurring 宇宙的 owner 集；payload 实证大量 job 已使用 Broker（workflow_read/execute、forum_read）= 与现行 svc-workflow/svc-forum 栈耦合，仅触发器死亡 |
| S6 | 过去 migration/cutover 文档 | caller-migration-v1（当日回滚）、stock-cutover-preparation-v1（冻结 manifest + 单侧 enabled 纪律 + DO_NOT_RESTORE 旧派发链先例） |
| S7 | 已被 Workflow/HR 取代的任务 | workflow 派发旧链（launchd workflow-dispatcher + unified-dispatcher.py + check-dispatch-health.py）disabled 且 authority 记录 DO_NOT_RESTORE；successor = VISIT_ACTIVATION dispatch（svc PR#24 @22e862a，READY_FOR_DEPLOYMENT，HOLD） |
| S8 | 一次性 canary/audit jobs | ASM canary f1dda993（已消费）、历史 Lane canary 67d3cd73、feishu-stock-canary f6 冒烟 job（runbook 内、已 rm）、墙体开裂提醒（at 09-01，**从未执行**即失效）、欢欢复诊提醒（**at 2026-09-07 未触发，仍有效**） |

**CANDIDATE_UNIVERSE = CLOSED_ENOUGH**（per-job 全映射见 `APPENDIX_JOB_MAP.md`，生成器
`run-inventory-map-v1.py` 可复跑；279 行逐 job 赋 candidate/disposition）。

## 3. 现状一句话（inventory 的核心结论）

**全部 recurring 业务今天只有一份定义（OpenClaw cron，126 enabled），而它的执行器已死 6 天；
当前 Agent Core Scheduler 生产面已验证可用（09-05）但 store 为空。因此"迁移"不是去重两个活系统，
而是从单一死亡宇宙中重建 truly-required 的最小集。**

## 4. DUPLICATES（已解决的去重）

| 重复面 | 裁决 |
|---|---|
| GitHub 泄露扫描 ×2（open-source-agent daily + security-agent 3d full） | DUPLICATE_OF 彼此 → 合并为 M11 取一 |
| 线上服务健康巡检 ×2（crontab health-check.sh alive + itops-agent OpenClaw job dead） | 巡检本体 = KEEP-K1（crontab 在役）；itops job = RETIRE（duplicate-of K1） |
| workflow 唤醒 ×2 机制（30min dispatcher 集中派发 + per-agent worklist-poller 轮询） | 同果去重 → M1 一项承载；worklist-poller 记 DUPLICATE_OF M1 |
| 需求信号调研（needs-radar 周度 7 job + biz-explorer 每周需求信号扫描） | DUPLICATE_OF M12 并入 |
| 每日市场简报三处定义（OpenClaw disabled + v2 store 迁移副本 disabled + repo manifest） | 同一 logical job → M5 单条记录，副本互为证据 |
| forum 派发双机制（launchd forum-scheduler.sh + 论坛动态调度器 v6 Agent 侧 hourly） | 同果 → M6 承载 Agent 侧 job，launchd 链 RETIRE |
| fleet 自进化三件套（每日学习/周内化/应用检查 ≈ 70+ per-agent job） | 同一框架实例化 → 整体一个 RETIRE 裁决（非 70 条独立业务） |

## 5. PER-CANDIDATE RECORDS

（字段缺省约定：CURRENT_SOURCE=OpenClaw 指 OpenClaw cron；EXECUTION_MECHANISM 现值全部为
「OpenClaw gateway cron → agentTurn」且已死；LAST_KNOWN_USE 取 per-job lastRun， mass 误差
sweep 日 = 2026-08-30。）

### MIGRATE（13 项，覆盖 40 rows）

**M1 工作流唤醒派发**
```
JOB_LOGICAL_NAME = workflow-wake-dispatch
BUSINESS_OUTCOME = svc-workflow 中有待处理任务的 agent 每 30 分钟被唤醒推进，停滞工作不依赖人肉催办
CURRENT_OWNER_AGENT = hr-agent（job workflow-dispatcher-hr-agent）+ 各业务 agent（worklist-poller-learning-expert 等）
CURRENT_SOURCE = OpenClaw | CURRENT_SCHEDULE = every 30min（+ per-agent hourly 变体）
CURRENT_EXECUTION_MECHANISM = 旧链 launchd com.openclaw.workflow-dispatcher → unified-dispatcher.py / check-dispatch-health.py → openclaw cron add → gateway（全部 disabled）
LAST_KNOWN_USE = 2026-08-30 21:43（error）| CURRENTLY_ACTIVE = NO
REPLACED_BY_WORKFLOW = YES(设计上) | REPLACED_BY_OTHER_MECHANISM = NO
DUPLICATE_OF = NONE（worklist-poller 并入本项）
DISPOSITION = MIGRATE
REASON = svc-workflow(63514) 与 broker workflow_execute 生产在役，仅触发器死亡；删除即失去"工作流自推进"
MIGRATION_BLOCKER = 生产 successor（VISIT_ACTIVATION dispatch）READY_FOR_DEPLOYMENT 但 HOLD（WDA gate + Owner 两决定）；旧链 DO_NOT_RESTORE。过渡形态可为当前 Scheduler 单个 30min recurring job（效率管家已实证 scheduler.create/list 可用）
```

**M2 HR 每日员工档案同步**
```
JOB_LOGICAL_NAME = hr-daily-roster-sync | BUSINESS_OUTCOME = 员工档案/workspace 一致性每日核对并出报告
CURRENT_OWNER_AGENT = hr-agent（现役 bc970ced）| CURRENT_SOURCE = OpenClaw | CURRENT_SCHEDULE = cron 50 0 * * *
CURRENT_EXECUTION_MECHANISM = OpenClaw gateway → agentTurn（workspace scripts）| LAST_KNOWN_USE = 2026-08-30（error）
CURRENTLY_ACTIVE = NO | REPLACED_BY_WORKFLOW = NO | REPLACED_BY_OTHER_MECHANISM = NO | DUPLICATE_OF = NONE
DISPOSITION = MIGRATE
REASON = HR 编排是现役产品方向（hr-dispatch goal 链）；档案漂移若无人巡检将静默累积
MIGRATION_BLOCKER = NONE（scheduler 工具面已验证；workspace 脚本路径对等在迁移执行轮核验）
```

**M3 效率管家每日任务早报（Broker 版）**
```
JOB_LOGICAL_NAME = efficiency-morning-brief | BUSINESS_OUTCOME = Owner 每晨收到全量待办/工作流任务早报
CURRENT_OWNER_AGENT = efficiency-agent（现役 mc_cF81DF）| CURRENT_SOURCE = OpenClaw | CURRENT_SCHEDULE = cron 10 4 * * *
CURRENT_EXECUTION_MECHANISM = OpenClaw gateway → agentTurn，全程 Broker workflow_read/execute（= 当前栈）
LAST_KNOWN_USE = 2026-08-30（error）| CURRENTLY_ACTIVE = NO | REPLACED_BY_WORKFLOW = NO | REPLACED_BY_OTHER_MECHANISM = NO | DUPLICATE_OF = NONE
DISPOSITION = MIGRATE
REASON = payload 即当前 Broker 栈；efficiency-agent 是 scheduler 工具面 canary actor，迁移阻力最小
MIGRATION_BLOCKER = NONE
```

**M4 博客随想流水线**
```
JOB_LOGICAL_NAME = blog-daily-pipeline（daily-thought 每日随想总结 04:22 上游 + blog-agent 每日随想素材检测 00:07 下游）
BUSINESS_OUTCOME = 随想记录持续转译为博客文章工作流输入，内容管线不断流
CURRENT_OWNER_AGENT = daily-thought-agent + blog-agent（agt_blog-agent 现役，A2A canary target）
CURRENT_SOURCE = OpenClaw | CURRENT_SCHEDULE = cron 22 4 * * * / cron 7 0 * * *
CURRENT_EXECUTION_MECHANISM = OpenClaw gateway → agentTurn → workflow 触发 | LAST_KNOWN_USE = 2026-08-30（error）
CURRENTLY_ACTIVE = NO | REPLACED_BY_WORKFLOW = NO（workflow_execute 生产可用，仅调度缺失）
REPLACED_BY_OTHER_MECHANISM = NO | DUPLICATE_OF = NONE
DISPOSITION = MIGRATE
REASON = blog-agent 现役 + workflow_execute 生产 READY（Lane A COMPLETE）；上游断供则内容管线枯竭
MIGRATION_BLOCKER = NONE
```

**M5 stock-agent 割接包（R1+R2，6 jobs）**
```
JOB_LOGICAL_NAME = stock-cutover-pack（每日市场简报 44 2 * * 1-5 / 周内化 15 3 * * 6 / 应用检查 00 4 1,15 * * / 股票分析学习 25 1 * * * / 商业分析每日学习 20 1 */2 * * / 每周一收盘后更新股票价格跟踪 40 3 * * 1）
BUSINESS_OUTCOME = 交易日晨间市场简报送达股票群；34 只≥80 分股票价格跟踪周更；stock agent 元循环
CURRENT_OWNER_AGENT = stock-agent（agt_stock_agent 已 authored）| CURRENT_SOURCE = OpenClaw（+ v2 store 迁移副本）
CURRENT_SCHEDULE = 见上（Asia/Shanghai）| CURRENT_EXECUTION_MECHANISM = OpenClaw gateway（旧）/ 当前 Scheduler V2（新，仅简报副本存在）
LAST_KNOWN_USE = 简报 08-30 canary 执行 succeeded（delivery not-delivered）；其余 08-17/08-30
CURRENTLY_ACTIVE = NO（割接纪律双侧 disabled）| REPLACED_BY_WORKFLOW = NO | REPLACED_BY_OTHER_MECHANISM = NO | DUPLICATE_OF = NONE（三处定义同一 job）
DISPOSITION = MIGRATE
REASON = 唯一已有冻结迁移 manifest + 实际 canary 执行成功证据的 job 族；不迁自进化（disabled，manifest 明示）
MIGRATION_BLOCKER = 定时任务 announce/deliver 面未在生产证明（08-30 canary not-delivered 收尾）+ stock 群 binding 需在当前 runtime 重建
```

**M6 论坛动态调度与版主周报**
```
JOB_LOGICAL_NAME = forum-hourly-dispatch + forum-weekly-mod-report
BUSINESS_OUTCOME = 论坛被@/未读每小时触达对应 agent；论坛健康度周报每周日产出
CURRENT_OWNER_AGENT = course-community-agent-2 | CURRENT_SOURCE = OpenClaw | CURRENT_SCHEDULE = every 1h / cron 30 9 * * 0
CURRENT_EXECUTION_MECHANISM = Agent 侧 hourly job（forum_read Broker 面）；旧链 launchd com.openclaw.forum-scheduler（disabled）
LAST_KNOWN_USE = 2026-08-30 23:18（ok，全宇宙最后一次成功业务执行）/ 08-30 10:17（error）
CURRENTLY_ACTIVE = NO | REPLACED_BY_WORKFLOW = NO | REPLACED_BY_OTHER_MECHANISM = NO | DUPLICATE_OF = NONE（launchd 链并入）
DISPOSITION = MIGRATE
REASON = svc-forum(localhost:3460) 在役、forum_read 面可用；论坛治理是活跃 goal 方向
MIGRATION_BLOCKER = forum 生产 supply 轮未完成（auth bundle forum.moderate grant 未 apply）
```

**M7 LLM Wiki 维护族**
```
JOB_LOGICAL_NAME = wiki-maintenance（wiki-executor every 4h / 日度审查 27 4 * * * / 周度 Synthesis 52 0 * * 0 / 月度全量审计 0 5 1 * *）
BUSINESS_OUTCOME = LLM Wiki 任务被推进、日审、周 Synthesis、月审计，知识库不腐化
CURRENT_OWNER_AGENT = knowledge-curator-agent | CURRENT_SOURCE = OpenClaw
CURRENT_EXECUTION_MECHANISM = OpenClaw gateway → agentTurn（workflow_read my_tasks 模式）
LAST_KNOWN_USE = wiki-executor 2026-08-30 18:40（ok）；审查类 08-30（error）
CURRENTLY_ACTIVE = NO | REPLACED_BY_WORKFLOW = NO | REPLACED_BY_OTHER_MECHANISM = NO | DUPLICATE_OF = NONE
DISPOSITION = MIGRATE
REASON = llm-wiki 项目在役（wiki-lint 等 skill 生态活跃）；4h 执行器停摆 = 任务积压无人处理
MIGRATION_BLOCKER = NONE（前提：knowledge-curator agent 身份迁入当前 fleet——全局前置见 §7）
```

**M8 家庭提醒与健康管理**
```
JOB_LOGICAL_NAME = family-reminders（购物清单每日提醒 9 2 * * * / 欢欢腰突第6周复诊评估提醒 at 2026-09-07T01:00 / 家庭医生每周健康回顾 31 0 * * 0 / 家庭月度健康回顾提醒 42 0 1 * * / 家庭医生每日健康知识学习 30 1 */3 * *）
BUSINESS_OUTCOME = 家庭日常义务型提醒与健康回顾自动送达（购物、复诊、健康回顾）
CURRENT_OWNER_AGENT = shopping-list-agent / family-doctor-2-agent | CURRENT_SOURCE = OpenClaw
LAST_KNOWN_USE = 2026-08-30 / 复诊提醒 NEVER（将在 09-07 静默失效）| CURRENTLY_ACTIVE = NO
REPLACED_BY_WORKFLOW = NO | REPLACED_BY_OTHER_MECHANISM = NO | DUPLICATE_OF = NONE
DISPOSITION = MIGRATE
REASON = 义务型（有真实待购清单、有真实 09-07 复诊安排）；其中 at one-shot 已在死亡窗口内，不重建则必然漏提醒
MIGRATION_BLOCKER = NONE（09-07 前必须落地 = 迁移 Goal 首个紧急项）
```

**M9 每日数学练习生成+打印**
```
JOB_LOGICAL_NAME = daily-math-worksheet | BUSINESS_OUTCOME = 孩子每日数学练习页生成并送打印机（每日 10:00）
CURRENT_OWNER_AGENT = 3d-print-agent | CURRENT_SOURCE = OpenClaw | CURRENT_SCHEDULE = cron 0 10 * * *
LAST_KNOWN_USE = 2026-08-30 10:17（error）| CURRENTLY_ACTIVE = NO
REPLACED_BY_WORKFLOW = NO | REPLACED_BY_OTHER_MECHANISM = NO | DUPLICATE_OF = NONE
DISPOSITION = MIGRATE
REASON = 家庭义务型日常产出（skill 工作流明确：生成→打印），停摆即断供
MIGRATION_BLOCKER = NONE（前提：3d-print-agent 迁入 + 打印机面在当前 runtime 可达）
```

**M10 播客流水线**
```
JOB_LOGICAL_NAME = podcast-pipeline（喜马拉雅每日搬运 0 10 * * * + 每日主题推荐 59 0 * * *）
BUSINESS_OUTCOME = 公开频道（喜马拉雅专辑「用AI搞学术」）连载内容每日自动推进
CURRENT_OWNER_AGENT = podcast-producer-agent | CURRENT_SOURCE = OpenClaw
LAST_KNOWN_USE = 2026-08-30（搬运 error / 推荐队列停）| CURRENTLY_ACTIVE = NO
REPLACED_BY_WORKFLOW = NO | REPLACED_BY_OTHER_MECHANISM = NO | DUPLICATE_OF = NONE
DISPOSITION = MIGRATE
REASON = 公开内容生产且有自续集数脚本（EP 序列推进中）；断更对外可见
MIGRATION_BLOCKER = NONE（上传凭据/脚本路径对等在执行轮核验）
```

**M11 GitHub 公开仓库隐私泄露扫描（去重合并）**
```
JOB_LOGICAL_NAME = github-leak-scan（open-source-agent 每日 0 5 * * * 与 security-agent github-full-leak-scan 每 3 天 0 5 */3 * *，取一）
BUSINESS_OUTCOME = mayf3 名下公开仓库的密钥/隐私泄露每日被发现与告警
CURRENT_OWNER_AGENT = open-source-agent / security-agent | CURRENT_SOURCE = OpenClaw
LAST_KNOWN_USE = 2026-08-30 05:09（error）| CURRENTLY_ACTIVE = NO
REPLACED_BY_WORKFLOW = NO | REPLACED_BY_OTHER_MECHANISM = NO | DUPLICATE_OF = 彼此（合并为一）
DISPOSITION = MIGRATE
REASON = 对外安全暴露面检查；开仓/推码持续发生，扫描停摆 = 风险窗口无限开放
MIGRATION_BLOCKER = NONE（gh 面在当前 runtime 可用性执行轮核验）
```

**M12 需求调研族**
```
JOB_LOGICAL_NAME = needs-radar-weekly（周一 Reddit/Dev.to、周二 V2EX/CSDN、周三 知乎/36氪、周四 Reddit技术/Quora、周五 开源中国/头条、周六 付费意愿、周日 主动发帖挖掘；biz-explorer 每周需求信号扫描并入去重）
BUSINESS_OUTCOME = 每周多渠道需求信号/产品点子研究汇总给 Owner
CURRENT_OWNER_AGENT = needs-radar-agent（当前 fleet 有运行实证）/ biz-explorer | CURRENT_SOURCE = OpenClaw
LAST_KNOWN_USE = 2026-08-30（error）；生产 stderr 见 needs-radar 近期 stop 记录（agent 活着）
CURRENTLY_ACTIVE = NO | REPLACED_BY_WORKFLOW = NO | REPLACED_BY_OTHER_MECHANISM = NO | DUPLICATE_OF = NONE（biz-explorer 并入）
DISPOSITION = MIGRATE
REASON = 唯一的系统性外部需求输入源；agent 已在当前 fleet（迁移阻力低）
MIGRATION_BLOCKER = NONE（置信度注记：业务优先级属 Owner 可低成本翻案项）
```

**M13 Owner 管线监督**
```
JOB_LOGICAL_NAME = ceo-oversight（每日管线方向审核 6 1 * * * + 龙虾合伙人每周待办回顾 0 2 * * 6）
BUSINESS_OUTCOME = Owner 级管线方向每日复核 + 每周主线偏差检查自动产出
CURRENT_OWNER_AGENT = ceo-agent（08-16 调查标记「业务最关键，明确排除出 canary」）
CURRENT_SOURCE = OpenClaw | LAST_KNOWN_USE = 2026-08-30 04:12（error）| CURRENTLY_ACTIVE = NO
REPLACED_BY_WORKFLOW = NO | REPLACED_BY_OTHER_MECHANISM = NO | DUPLICATE_OF = NONE
DISPOSITION = MIGRATE
REASON = 历史口径业务最关键的监督回路；管线（内容/工作流）现役存在
MIGRATION_BLOCKER = NONE（前提：ceo-agent 迁入当前 fleet）
```

### KEEP（4 项，现状已由非 OpenClaw 机制正确承载）

```
K1 线上服务健康巡检 | OUTCOME = 远端生产服务（8.163.44.127 nginx/SSO）每日健康核验报告
   CURRENT_MECHANISM = 用户 crontab health-check.sh daily 06:30 → /tmp/health-check-report.txt
   CURRENTLY_ACTIVE = YES（2026-09-05 06:30 有产出）| DUPLICATE_OF = NONE
   DISPOSITION = KEEP | REASON = 巡检本体在役；itops-agent OpenClaw 变体 RETIRE（duplicate）。agent 侧报告解读层缺失属可选增强，非义务缺口

K2 全平台数据备份 | OUTCOME = 本机各平台数据每日 03:00 全量备份留存
   CURRENT_MECHANISM = 用户 crontab openclaw-backup/backup-all.sh | CURRENTLY_ACTIVE = YES（今日完成）
   DISPOSITION = KEEP | REASON = 业务连续性自动化在役。相邻事实：AGENT_CORE_BACKUP_RETENTION_V1（accepted，未实施）属 deployment .bak-* 保留策略，非本清单 scope，记 FOLLOW_UP

K3 xiaomusic 儿童音乐时刻表 | OUTCOME = 工作日 7:40/8:20/19:00/22:00 播放-停止 + 30min 健康检查
   CURRENT_MECHANISM = 用户 crontab ×5 + com.xiaomusic + smart-home bridges（常驻）
   CURRENTLY_ACTIVE = YES | DISPOSITION = KEEP | REASON = 智能家庭自动化在役且不属 Agent Core 调度域

K4 svc-workflow 服务保活监控 | OUTCOME = svc-workflow(63514) 异常自动拉起
   CURRENT_MECHANISM = launchd com.svc-workflow-monitor StartInterval=60 | CURRENTLY_ACTIVE = YES
   DISPOSITION = KEEP | REASON = 基础设施 keepalive 在役，非 scheduler 业务 job
```

### RETIRE（分组裁决，覆盖 239 rows + 机制残留）

```
R-A fleet 自进化框架（73 rows enabled）：全部 per-agent 每日学习 / 周内化 / 应用检查 / 学习评分卡 /
    Skill 巡检-优化-推送-安全扫描 / PPT设计师 3 条 broken（无 agentId，36 runs 全 error）等
    REASON = 停摆 6 日无可观察业务影响；框架本体（daily-learning / learning-review skill）仍在
    当前 harness 可按需调用；自主自进化如需恢复应作为单一设计决策重建，而非复活 70+ 噪声 cron
R-B 生活方式/情报内容（12 rows enabled）：羊毛扫描、旅行推荐×2、好物学习、求职情报、灵魂拷问、
    战略分析、进化日报、商业化方案×2、学用回顾等
    REASON = nice-to-have 内容产出，义务缺失未造成影响；能力保留可经对话按需唤起
R-C 已死/已废机制与一次性（其余 rows + 非 cron 机制）：
    - 153 disabled 长尾（含股票自进化：manifest 明示不迁；stagnation-alert）
    - 墙体开裂提醒（at 09-01，从未执行，时点已过）
    - ASM/Lane canary 一次性 job（f1dda993 已消费、67d3cd73 历史证据）
    - launchd：com.openclaw.{gateway,workflow-dispatcher,forum-scheduler,host-exec-runner,
      control-api,auto-repair,agent-node-502}（disabled；业务果由 M1/M6 承接；旧派发链 DO_NOT_RESTORE）
    - gui 域 com.agent-core.{feishu-connector,kernel,coding-harness,capability-host}（disabled 残留，上一代项目）
    - crontab：GATE0-FROZEN（已注释）、clawhub /tmp 一次性（文件已不存在）
    REASON = 已停用/已消费/被 successor 语义取代；恢复属显式 Owner 决策，不在默认清单
```

## 6. OWNER_GATE_POLICY 执行情况

UNKNOWN_COUNT = 0。全部 candidate 均以「删除后哪个仍成立的业务结果会失去自动执行」机械裁决：
义务型/对外暴露型/现役管线型 → MIGRATE（13 项）；在役异机制承载 → KEEP（4 项）；
自进化噪声/nice-to-have/已死面 → RETIRE。三个低置信度注记（Owner 可低成本翻案）：
M12 需求调研、M13 管线监督、M10 播客推荐——均已在 REASON 标注。

## 7. 全局迁移前置（跨 candidate，非单 job blocker）

1. **agent 身份迁移**：OpenClaw 87-agent fleet 与当前 agt_* fleet 的差集——M 系 owner 中
   efficiency/blog/stock/hr/needs-radar 有现役实证；knowledge-curator/3d-print/podcast/
   family-doctor/shopping-list/ceo 等需按 AGENT_DEFINITION_CONFIG_V1 authored-id 迁入。
2. **双 Scheduler 实例收敛**：system 域生产 store 与用户域 scheduler-v2 store 并存
   （分叉风险）；迁移 job 必须落生产 store，实例拓扑需在迁移 Goal 显式收敛。
3. **定时任务 announce/deliver 面**：唯一 canary（08-30 简报）execution ok / not-delivered
   收尾；M5/M8 等含"送达飞书群"语义的 job 依赖该面在生产证明。
4. **模型路由**：死亡宇宙的 lastRun error sweep 根因 = legacy provider 死亡；当前生产
   luna/GLM 路由已换血（08-31 route-glm53 evidence），迁移 job 天然规避该根因。

## 8. FINAL HANDOFF（冻结）

```
GOAL_STATUS = READY_FOR_MIGRATION
CANDIDATE_UNIVERSE = CLOSED_ENOUGH（三轮收口；279 行逐 job 映射可复跑）
DUPLICATES = RESOLVED（§6 七组）
TOTAL_CANDIDATES = 18（KEEP 4 + MIGRATE 13 + RETIRE 分组 R-A/R-B/R-C 计 3 组；job 级 279 + v2 副本 1 + canary/机制行）
KEEP_COUNT = 4
MIGRATE_COUNT = 13（覆盖 40 rows：39 enabled + 1 disabled 迁移副本标记）
RETIRE_COUNT = 3 组（239 cron rows + launchd/crontab 机制残留）
UNKNOWN_COUNT = 0
KEEP_LIST = [K1 线上服务健康巡检, K2 全平台数据备份, K3 xiaomusic 音乐时刻表, K4 svc-workflow 保活监控]
MIGRATE_LIST = [M1 工作流唤醒派发, M2 HR档案同步, M3 每日任务早报, M4 博客随想流水线,
                M5 stock-agent割接包(6), M6 论坛动态与周报, M7 Wiki维护族(4), M8 家庭提醒与健康(5),
                M9 数学练习打印, M10 播客流水线, M11 GitHub泄露扫描, M12 需求调研族, M13 Owner管线监督]
RETIRE_LIST = [R-A fleet自进化框架(73), R-B 生活方式/情报内容(12), R-C 已死机制与一次性(154 rows + launchd/crontab 残留)]
FOLLOW_UP_BLOCKERS =
  B1 M1: 生产 dispatch successor（VISIT_ACTIVATION）HOLD 中；旧链 DO_NOT_RESTORE
  B2 M5/M8: 定时任务 announce/deliver 面缺生产证明（唯一 canary not-delivered 收尾）
  B3 M6: forum 生产 supply（forum.moderate grant）未 apply
  B4 双 Scheduler 实例拓扑并存（system 域 authsvc store vs 用户域 scheduler-v2 store）
  B5 per-agent 身份迁移面（§7.1 差集）
  B6 相邻债务（非本 Goal scope）：AGENT_CORE_BACKUP_RETENTION_V1 accepted 未实施
OWNER_DECISION_REQUIRED = NONE（UNKNOWN=0；三个低置信度 MIGRATE 注记可翻案不阻塞）
```

## 9. NEXT_GOAL_RECOMMENDATION

**需要执行 Scheduler migration，最小 migration set = MIGRATE 13 项（约 40 job 定义），
建议三波：**

1. **Wave 0（紧急，≤48h）**：M8 中的欢欢复诊提醒 at 2026-09-07 —— 单个一次性 job，
   当前 scheduler.create 已验证可用，是全清单唯一有硬截止时间的项。
2. **Wave 1（零 blocker 直迁）**：M3 早报、M2 档案同步、M4 博客流水线、M7 Wiki、M9 打印、
   M11 泄露扫描 —— 机制面全部已验证（scheduler 工具面 + broker + workflow_execute），
   主要工作是 per-agent 身份/工作区迁入。
3. **Wave 2（blocker 解除后）**：M1（等 visit-activation 部署或先落 30min 过渡 job）、
   M5（等 announce/deliver 面证明）、M6（等 forum supply）、M10/M12/M13（随 agent 迁入排期）。

同时建议：RETIRE 面不做任何"清空 jobs.json"动作（本 Goal 零 mutation；OpenClaw 宇宙保持
原样作为历史事实），迁移 Goal 只在当前 Scheduler 侧新建、绝不回写 OpenClaw。

---
*证据文件：REPORT.md（本文件）+ APPENDIX_JOB_MAP.md（279 行逐 job 映射）+ SUMMARY_COUNTS.json
+ run-inventory-map-v1.py（只读生成器，可复跑）+ MANIFEST.sha256*
