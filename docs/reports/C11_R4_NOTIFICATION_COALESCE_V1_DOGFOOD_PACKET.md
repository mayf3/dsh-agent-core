# C11-R4 NOTIFICATION_COALESCE_V1 — Production Dogfood Packet (FROZEN, DO NOT DEPLOY)

> status: **READY_FOR_PRODUCTION_PACKET = YES** · **READY_FOR_PRODUCTION_APPLY = NO** ·
> **PRODUCTION_APPLY = HOLD（本命令 DO_NOT_DEPLOY）** · **PRODUCTION_MUTATION = NO**
> Product: mayf3/dsh-agent-core#428（[PRODUCT C11-R4] Scheduler watchdog actionable
> notifications — correlate, coalesce, and suppress derived alert noise）
> governing（均 accepted，fresh-read 于 main `d54b8f70`）:
> `SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1`（CTR-INCIDENT-001 /
> CTR-ALERT-001 / CTR-ROUTE-001 / CTR-QUARANTINE-001 / CTR-DURABILITY-001；生产适用走其
> §12.2 conditional controlled operation）+ `SCHEDULER_CONTROL_PLANE_RELIABILITY_V1`
> （§5.4–§5.7 检测 / fail-loud / evidence）
> coordinates:
> - `IMPLEMENTATION_CANDIDATE` = `f1853c6ca299213085ae913405abb6a953acd872`
>   （base main `d54b8f70a920398e8101c8c3630a82bc70baa391`；branch
>   `c11-r4-notification-coalesce-v1`）
> - `PACKET_EXACT_HEAD` = 本冻结提交（snapshot 再生成 + 本 packet；无新代码 delta）
> - `INDEPENDENT_REVIEW` @ `f1853c6c`：**PASS / load_bearing_gaps = 0**（记录见 §5）

## 1. 本包冻结什么

外部投递投影（delivery projection v2）——唯一改动面在「内部事实/事件 → 外部用户消息」之间：

- 内部不变：detector facts、root-cause incidents（CTR-INCIDENT-001 精确身份，禁止的
  name/agent/chat/time-window 分组只属于编译层，编译层零改动）、每次 material transition
  的 durable intent（CTR-ALERT-001）全部原样保留并可查询；单一 outbox，无第二投递账本。
- 外部投影（`packages/scheduler/src/watchdog/delivery-projection.js`，纯函数、只读）：
  1. R-STALE 现值重读——incident 已恢复的 NEW 不再以 OPEN 页面（`stale_new_incident_recovered`），
     仅发真实的那条 RECOVERED；
  2. R-JOB——同 Job 的 CONSECUTIVE_FAILURE 活跃窗口吸收窗口内新开的 RUN_FAILED 子事件
     （首个失败与恢复后的新失败仍照常页面）；
  3. R-RUNTIME——SCHEDULER_RUNTIME_UNHEALTHY 窗口按机械锚点吸收 occurrence 类事件
     （RUN_FAILED=endedAt 点、RUN_STUCK=[startedAt, 观察点]、RUN_STUCK_OUTCOME_UNKNOWN=
     blockedSince 点、EXPECTED_RUN_MISSED=dueAt 点）；锚点在窗口外的失败一律保持独立用户事件；
  4. R-PAIR——同 occurrence 的 RUN_STUCK + RUN_STUCK_OUTCOME_UNKNOWN 合并为一个用户事件：
     至多一条 OPEN（先开者）+ 一条 RECOVERED（全体成员真正闭合时才发）；
  5. 人类可读文本（Agent/Job、首检时间、当前状态、行动/恢复状态、单一 evidence id；
     notification-key 降为唯一 debug 尾行，保留 provider readback marker）；legacy 记录
     永不带 v2 marker，保持旧 wire 格式，既有不可变投递 binding 逐字节有效。
- Runner 接线：`annotateFindingsWithJobs` 以**精确持久化 jobId** join 出 logicalKey/agentId
  （禁止 name/模糊）；投递循环只迭代 `projection.deliverable`；`w1_incident_delivery`
  evidence 行记录 `deliveredNotificationKeys` + `suppressedNotifications{notificationKey,code}`。

## 2. 冻结的 payload 快照再生成（B1 reviewed snapshot regeneration）

`scripts/lib/watchdog-payload-snapshot.mjs` → `payloadCommit = f1853c6c`（base 沿用
`68008e83` goal 谱系）。这是 drift 门自身要求的「显式 reviewed 再生成」，仅冻结字节：

| 类别 | 路径 | 说明 |
|---|---|---|
| 改动 | `scripts/scheduler-watchdog.mjs`、`watchdog/delivery.js`、`watchdog/incident-lifecycle.js`、`watchdog/index.js` | 本次实现的 4 个已列路径新摘要 |
| 新增 | `watchdog/delivery-projection.js` | delivery.js/incident-lifecycle.js/index.js 的新 import；必须入 overlay universe，否则 narrow REFUSED |
| 刷新 | `product-api/src/index.js`、`production-runtime/src/{entry.js,paths.js,scheduler-invoker.js}`、`scheduler/src/{occurrence-model.js,self-ops/index.js}` | **先于本包即已漂移**（main 在 0bfbfb9d 后由其他已合并 lane 演进，drift 门在 pristine main 已红）；按 §B1 语义刷新为 SOURCE_SHA=`f1853c6c` 树字节 |
| 保持 | `production-runtime/src/compose.js`（embedded） | 冻结 payload compose 世代原样保留——见 §6 部署前阻塞 |
| 配套 | `scripts/lib/admission-lib.mjs` universe 22→23；`deployment-overlay-closure.test.js` 权威 census 22→23 | 单一 reviewed 事务 |

## 3. 验证证据（全部在本 worktree 实测，命令可重放）

```text
RED-first        packages/scheduler/test/watchdog/delivery-projection.test.js T-DP-1..9 = 9/9 PASS
                 （先 RED：模块缺席整文件 fail；GREEN 后覆盖 #428 全部必需 case a–h）
changed-surface  npm run test:scheduler = 399/399 PASS（含全部 watchdog 回归）
deployment gates node --test deployment-overlay-closure.test.js deployment-incident-migration.test.js
                 = 13/13 PASS（再生成前：closure 1 红=runner 摘要漂移【本包引起，由再生成闭合】；
                 migration 在 pristine main 即红=occurrence-model 等先存漂移【本包修复】）
repo-wide        全仓失败集与 pristine main 的差异 = deployment 两门（上述）+ 无其他新增；
                 其余失败（@larksuite/channel 缺依赖、credential/worktree 依赖用例）两侧相同。
                 更正：实现提交信息中「failure set identical」措辞不成立，准确表述以此为准。
live smoke       双循环 dry-run（无路由/凭据沙箱）：incidents/outbox 零重复 transition、
                 evidence 行含投影决策、route-missing 仍 park + exit 1（fail-loud 原样）
admission selftest = PRE-EXISTING BROKEN ON MAIN：pristine main 即红（先存 drift）；
                 本包后再进一步、止于 §6 的 embedded compose 世代墙（见 §6，部署前必修）
```

## 4. Dogfood 程序（一次真实 NEW→RECOVERED 生命周期；授权后由生产 lane 执行）

1. 前置：§6 阻塞修复 + CTR §12.2 既有门（implementation gates、serialization slot、
   provenance、canary、sequential readback）全部满足；SOURCE_SHA = 本包 head。
2. 观察一次**真实** incident（禁止合成 incident、禁止制造 outcome_unknown——CTR §12.2），
   期望用户面消息 census（对 #428 生产序列 HR v5：14 条 → 6 条）：
   - 每个因果事件 ≤1 OPEN + ≤1 RECOVERED；被吸收/合并子事件零用户消息；
   - `w1_incident_delivery` 行中 suppressedNotifications 逐条带码可查；
   - incidents.json/outbox 含全部 transitions（证据完整性 readback）；
   - 重启/重放 watchdog：已投递 transition 不重发，投影决策逐字节一致。
3. BUSINESS_VERIFIED：真实 OPEN→RECOVERED 全程无重复子消息 + 恢复后 24h 内历史失败零复报。
4. Abort/rollback：按 §12.2；注意单向门——一旦产生 v2-marker 记录+binding，仅回滚代码而保留
   新 state 文件会 fail-loud（`corrupt incident state`），回滚必须连同 state backup 还原。

## 5. 独立 changed-surface review 记录（@ f1853c6c，评审者非作者）

```json
{"verdict":"PASS","load_bearing_gaps":[],
 "r1":"PASS diff census 6 文件均在 §12.1 授权面；detector/fence/routing/adapter 零改动",
 "r2":"PASS 投影只读（deepEqual 证明）；annotate 仅 +2 身份字段、精确 jobId join；无第二账本",
 "r3":"PASS CTR-INCIDENT-001 分组禁令属编译层，编译层不变；投递分组仅用精确 UUID+父事件自身
      durable 窗口；建议后续小型 Spec amendment 永久消除文义张力",
 "r4":"PASS 窗口/outPrimary/closePrimary 全部秩序无关；T-DP-4 纯度 + T-DP-6 真实 commit/load 回放等值",
 "r5":"PASS 实证构造 legacy state（无 marker+旧 binding）在新代码下 load/validate 通过；
      v2 文本确定、readback marker 保留；回滚单向门见 N6",
 "r6":"PASS 必需 case (a)–(h) 逐一有断言（缺口见 N5，均非阻塞）",
 "r7":"PASS suppressed 保持 PENDING（诚实）；park+非零+evidence 行不缺",
 "r8":"PASS 新文件 300<500；目录 12/17<20；watchdog runner 495/500 贴顶（N3）",
 "r9":"PASS #428 生产序列消息 14→6；恢复态 HR v5 不可被重开/变更（occurrence 不重开+投影纯函数）",
 "r10":"PASS 文本仅 logicalKey/agentId/UUID/ISO/类名/incidentId/key 尾行，无目标 ID/秘密",
 "non_blocking":["N1 实现提交『failure set identical』措辞失实——两个 deployment 门受影响，
   已由本 §3 更正并由 snapshot 再生成闭合","N2 建议小型 Spec amendment","N3 runner 495/500 贴顶",
   "N4 verify:structure 在 main 即红（registry 先存损坏）+ index barrel 潜在增长",
   "N5 未测：W2 投影路径、EXPECTED_RUN_MISSED 运行时吸收、episode-2 重开、pair ACK 角",
   "N6 v2-marker 后代码回滚单向门（fail-loud 非静默）","N7 迁移态父窗口不可枚举时过通知（保守向）",
   "N8 runW2 无投影 evidence 行（先存不对称）","N9 旧记录 post-deploy transition 永远旧文本（混排）"]}
```

## 6. 部署前阻塞（本 lane 不修，移交生产 lane / Owner）

**EMBEDDED_COMPOSE_STALE_GENERATION**：冻结 payload 的 compose.js（payload commit `0bfbfb9d`
世代）import `./identity/agent-principal-resolution.js`，该文件已被 main `b6ecc52a`
（identity capability slice）移除/重构。后果：`admission --selftest` 在 NARROW CLOSURE
REFUSED（pristine main 上 selftest 因先存 drift 同样不可用）；真实 apply 仅在 live 树仍服务该
import 时可容忍，否则不可安装。**任何下一次 watchdog 部署前**，生产 lane 必须以 reviewed
snapshot 再生成更新 embedded compose 世代（或确认 live 世代 pin 仍为 PRE/POST 之一）——本 lane
无 payload 字节裁决权，未动 embedded 字节。

## 7. PRODUCTION_MUTATION

```text
本命令 PRODUCTION_MUTATION = NO：无 deploy、无 restart、无 sudo、无凭据接触、
无 raw-store/fence/UNKNOWN replay、无 Remote Desktop；全部验证为源码/测试/hermetic。
production apply 仅在 §4–§6 全链满足后由 Owner 显式授权的序列化 lane 执行。
```
