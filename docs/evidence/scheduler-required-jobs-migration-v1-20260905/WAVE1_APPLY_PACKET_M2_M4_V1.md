# SCHEDULER_REQUIRED_JOBS_MIGRATION_V1 — Wave 1 Apply Packet（M2 + M4，FROZEN 字段）

> CURRENT_PHASE = APPLY_PACKET_FROZEN（创建动作仍 FORBIDDEN 直至 §0 前置全 PASS）
> 前置文档：CLOSURE_FA_WAVE0_WAVEPLAN_V1.md（§4 gate 判定、§7 payload 精读）
> 日期：2026-09-05 · ACCEPTANCE_DENOMINATOR = MIGRATE 13（本 packet 覆盖 2/13）

---

## 0. PRE-APPLY GATE（全部 PASS 才允许 §3 创建；任一 FAIL 即停，不得部分执行）

```
G1 shared production mutation slot = FREE（现为 visit-activation 持有）
G2 canonical runtime fresh readback：launchd ai.agent-core.runtime 在役，pid 与
   /health（127.0.0.1:8790 ok）双证；build/compose 与 FA2 证据链无 drift
G3 canonical store fresh readback（Owner sudo cat，或经 fleet agent scheduler.list RAW）：
   - 现存 jobs 全量清单落盘（含 disabled）
   - job-name collision：{m2-hr-daily-sync, m4-blog-daily-pipeline,
     m4-daily-thought-summary}（§1/§2 冻结名）零命中
   - idempotency key collision：零命中
   - DUPLICATE_ACTIVE_SCHEDULES 基线记录（apply 后比对增量）
G4 target agent enabled：registry 维度已闭合（2026-09-05 auth-service 生产 registry
   只读查询，全部 active——agt_hr-agent=dc702687…、agt_blog-agent=fd58881a…、
   agt_daily-thought-agent=4074e8c2…，全表见 CLOSURE §8）；剩余 readback 维度 =
   agents.json fleet 在役证明（authsvc 0700，apply 轮经 Owner 或 broker 通道）
G5 M4 专项：bip_article_pipeline_v1 生产 current definitionVersionId fresh 核验
   （legacy 硬编码 ba00866b-1a37-4911-ab00-a83f78bd9b85 是否仍 current；
    失效 → §2 payload 中该行改为「按 definitionKey 解析 current version」冻结文本，
    不得平移死引用）
G6 schedule/tz 冻结值比对（§1/§2 表）；两 job legacy schedule 均无 tz 字段，
   OpenClaw 缺省=机器本地时区（本机 Asia/Shanghai）——迁移版显式 tz=Asia/Shanghai
```

创建通道 = fleet agent 会话内置 scheduler.create（model-facing，in-process 直写
canonical store，FA2 证据链）；备用通道 = Owner sudo `agentcore-cron add`。
两 job 一次 packet、按序创建（concurrency=1），创建顺序：M4 上游（04:22）→ M4 下游
（00:07）→ M2（00:50）。

---

## 1. M2 — hr-daily-roster-sync（冻结）

```
JOB_NAME = m2-hr-daily-sync
LEGACY_SOURCE_ROWS = hr-daily-sync-001（「每日员工档案同步 - 凌晨」）×1
OWNER_AGENT = agt_hr-agent（BUSINESS identity dc702687）
TARGET_AGENT = agt_hr-agent
SCHEDULE_KIND = cron | EXPR = 50 0 * * * | TZ = Asia/Shanghai（legacy 无 tz，北京时间 00:50）
TIMEOUT = 3600s
ENABLED_AT_CREATE = true
DELIVERY_REQUIREMENT = EXECUTION_ONLY（报告落 workspace reports/；legacy FAIL 分支
  announce→oc_a5e90451… 降级：见 PAYLOAD 修改 ②，不构成 delivery gate）
DELETE_AFTER_RUN = false
IDEMPOTENCY = cron 天然幂等（每日一次 occurrence；V2 occurrence authority 防重）；
  脚本本身幂等（检查/报告型，无状态副作用——前提=修改 ① 生效）
CLASSIFICATION = EXECUTION_ONLY（FAIL 告警=条件性，同 M11 性质）
PAYLOAD_MESSAGE = legacy 原文，仅两处修改（§7 裁决落地）：
  ① 删除 Task 4 的 FAIL 自动修复分支（machine-admin client create / UPDATE
     machine_clients 等一切 auth DB 写指令），改为「❌ FAIL → 输出异常清单与建议
     修复步骤，等待人工处理，不得自动写 auth-service」
  ② 删除「有FAIL → 发详细异常清单」的群发指令，FAIL 详情写入报告文件
EXPECTED_BUSINESS_OUTCOME = 每日 00:50 四项检查（workspace 一致性 / 档案一致性 /
  飞书群注册审计 / 论坛权限巡检）产出当日 reports/，PASS/FAIL 状态真实反映
ACCEPTANCE（EXECUTION_ONLY）= 创建后首个 occurrence：DEFINITION_COUNT=1，
  ENABLED_DEFINITION_COUNT=1，run succeeded 且 reports/ 出现当日四份报告、
  内容含 ✅/❌ 真实判定 = PASS
```

## 2. M4 — blog-daily-pipeline（两条 job，冻结）

### 2.1 上游 m4-daily-thought-summary

```
JOB_NAME = m4-daily-thought-summary
LEGACY_SOURCE_ROWS = daily-thoughts-summary-001（「每日随想总结 - 22点」，04:22 执行）×1
OWNER_AGENT / TARGET_AGENT = agt_daily-thought-agent（principal 4074e8c2-67f1-409f-
  830c-1690cc7c64f2，active @ auth-service 生产 registry，2026-09-05 G4 readback 实证；
  非 legacy `daily-thought-agent`/2a24b855。G4 剩余维度：agents.json fleet 在役证明
  apply 前 readback，FAIL 才摘除降 BLOCKED(B5-runtime)）
SCHEDULE_KIND = cron | EXPR = 22 4 * * * | TZ = Asia/Shanghai
TIMEOUT = 3600s | ENABLED_AT_CREATE = true | DELETE_AFTER_RUN = false
DELIVERY_REQUIREMENT = EXECUTION_ONLY（7 天回溯补总结是业务本体；汇报 announce
  →随想群尽力而为，不 gate）
IDEMPOTENCY = 天然幂等（已存在 summary 即跳过；脚本语义自防重）
PAYLOAD_MESSAGE = legacy 原文不改（7 天回溯逻辑自包含）
EXPECTED_BUSINESS_OUTCOME = distilled/ 目录与 raw/ 差集每日收敛为 0
ACCEPTANCE = 首个 occurrence run succeeded 且（若 raw/ 有未总结日期）新 summary
  文件出现，或（无差集）输出「均已总结」= PASS
```

### 2.2 下游 m4-blog-daily-pipeline

```
JOB_NAME = m4-blog-daily-pipeline
LEGACY_SOURCE_ROWS = blog-daily-writing-001（「每日随想素材检测 + 触发文章工作流」）×1
OWNER_AGENT / TARGET_AGENT = agt_blog-agent（现役，A2A canary target）
SCHEDULE_KIND = cron | EXPR = 7 0 * * * | TZ = Asia/Shanghai（legacy 无 tz，北京时间 00:07）
TIMEOUT = 3600s | ENABLED_AT_CREATE = true | DELETE_AFTER_RUN = false
DELIVERY_REQUIREMENT = EXECUTION_ONLY（业务本体=workflow 实例创建；群汇报 announce
  →博客群尽力而为，不 gate——packet 显式声明，验收不看它）
IDEMPOTENCY = daily-thought-sync.md lastSyncDate 自防重 + workflow 实例按天创建；
  occurrence 级防重由 V2 authority 承担
PAYLOAD_MESSAGE = legacy 原文，仅一处修改：
  ① workflow_execute 指令行改为「使用内置 workflow_execute 按
     definitionKey=bip_article_pipeline_v1 解析生产 current definitionVersionId
     （G5 readback 值直接写入冻结文本），principal UUID 五元组按原文保留」
EXPECTED_BUSINESS_OUTCOME = 每日 00:07 随想差量被读取，有素材日创建
  bip_article_pipeline_v1 实例（workflow 派发接手写作），无素材日安静收尾
ACCEPTANCE = 首个有素材 occurrence：run succeeded 且 workflow 实例创建成功
  （instance id 记录于 daily-thought-sync.md）= PASS；无素材 occurrence：
  run succeeded 且输出「今日无新内容」= PASS
```

---

## 3. APPLY 步骤（slot FREE 后执行）

1. §0 G1–G6 全 PASS，readback 证据落本目录 `APPLY_RECEIPT_M2_M4.json`。
2. 按序 scheduler.create ×3（2.1 → 2.2 → 1），create 响应直回 jobId/nextRunAt
   落 receipt（非 unknown-mutation 形状，relay envelope 已修）。
3. Post-create readback：scheduler.list 确认 DEFINITION_COUNT、ENABLED、
   nextRunAt 与冻结 schedule 精确一致；对比 G3 基线，DUPLICATE_ACTIVE_SCHEDULES=0。
4. 首个 occurrence 后按 §1/§2 ACCEPTANCE 判定；EXECUTION_ONLY 双 job 判定 PASS
   才记 MIGRATED，任一 FAIL 记 BLOCKED(原因) 并 disable 该新 job（不回退 OpenClaw）。
5. 本 Goal 终态报告按 GOAL TERMINAL 清单产出（MIGRATED/BLOCKED/…/
   PARTIAL_WITH_EXPLICIT_DEPENDENCIES）。

## 4. 禁止项（沿 Goal 原文）

不恢复 OpenClaw / 旧 forum scheduler / 旧 workflow dispatcher；不写 NON-CANONICAL
store（pid 1696）；不批量复制 disabled 长尾；不迁移 fleet 自进化 73 rows；
不搭车 backup-retention；Wave 0 提醒不在本 packet（独立 Owner 决策，见 CLOSURE §3.3）。
