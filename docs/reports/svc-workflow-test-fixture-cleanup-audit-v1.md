# svc-workflow dogfood 测试残留清理方案 独立审计 V1（残留 审计）

> TASK_NAME = 残留 审计 · TASK_TYPE = PRODUCTION_CLEANUP_PLAN_REVIEW
> 日期：2026-08-29 · 审计人：独立 Reviewer（未参与调查与 runner 编写，无历史上下文）
> 审计对象：
> - 调查产物 `docs/investigations/svc-workflow-dogfood-test-fixture-residue-v1.md`
> - 证据目录 `docs/evidence/svc-workflow-test-fixture-cleanup-v1/`
> - 待审 runner `/tmp/run-svc-workflow-test-fixture-cleanup.sh`
>   （sha256 `9cf26d42d903b1ba71ffcef92acf34b0451f4cf370a9876777a3a2e246e391a7`，
>   与归档副本 `docs/evidence/svc-workflow-test-fixture-cleanup-v1/run-svc-workflow-test-fixture-cleanup.sh` 字节一致）
> 性质：**只读审计 + DRYRUN（事务内全路径 + ROLLBACK）重跑**。本轮零真实删除、零提交写入。

## 0. 结论（TL;DR）

**REVISE（单一 blocker B1，数据侧声称全部独立证实）。**

核心声称 **全部通过独立复核**：224 行 / 13 表的 allowlist 与 DB 当前窗口行**逐 ID 四方一致**
（DB 窗口 = allowlist.tsv = runner 内嵌 = 调查文档附录）；窗口、回执 key、context title、
fixture 代数、60 个 FK 双向隔离全部由本审计**从 DB 与测试源码独立重推导**且与声称逐项相同；
DRYRUN 由本审计**独立重跑**通过且前后快照**字节级零净变更**。

唯一 blocker（B1）是 runner 的**漂移中止盲区**：P2 的"窗口外同模式行 = 0"检查被限定在
7.6 秒窗口内，**窗口之外**新出现的 fixture 模式行（最现实的场景：同一误配置再次把测试跑进
生产库——TEST_DATABASE_URL 缺陷尚未修复）不会使 runner 中止；runner 会照常 COMMIT 并打印
"CLEANUP COMMITTED / remaining 全 0"，让 Owner 误以为残留已清空，而新的孤岛残留静默留存。
这不危及业务数据（digest + FK 引擎双向兜底完好），但违反本轮审计要求 #13
"任一 pre-state 漂移必须零写入中止"，且修复是每表一行级的机械补强（建议 P2b，见 §8）。

## 1. 十五项强制复核结果

| # | 要求 | 结果 | 证据 |
|---|---|---|---|
| 1 | 224 个 exact row ID | ✅ 四方逐 ID identical | §3.2 |
| 2 | 13 张表 allowlist | ✅ 13 表计数 24/13/13/8/13/13/26/13/19/19/19/19/25；另 5 表窗口=0 | §3.1 |
| 3 | 7.6 秒时间窗 | ✅ 窗口行 min/max = `08:17:36.396306`/`08:17:43.997024`；窗口前后全库无写入 | §3.3 |
| 4 | idempotency key ↔ 测试源码 | ✅ 19×`create-<uuid-v4>` + 6 固定 key，全 COMPLETED；其余 8 个测试 key 全库 0 回执 | §2/§3.4 |
| 5 | context title ↔ fixture | ✅ 19 条 = 源码 19 title 多重集（16 值）逐字节相等 | §2/§3.5 |
| 6 | 60 FK 双向隔离 | ✅ constraints=60，dirA=0，dirB=0，violating=0（全内联动态校验，复合 FK 按 confkey 全列） | §4 |
| 7 | 窗口外行引用窗口内行 = 0 | ✅ dirB=0 | §4 |
| 8 | 窗口内行引用未知行 = 0 | ✅ dirA=0（含 MATCH SIMPLE 语义：全非空才判违例） | §4 |
| 9 | 非目标业务表 digest | ✅ runner P6 事务内预钉+比对；本审计 DRYRUN 前后 18 表 count+md5 快照字节相同 | §6 |
| 10 | 6 触发器禁用/恢复完整性 | ✅ 同事务 disable→删除→恢复（事务化 DDL）；全库 18 个非内部触发器中仅禁用 6 个守卫，其余 12 个保持 enabled 且经 DRYRUN 实证不阻断本删除集 | §5 |
| 11 | SET CONSTRAINTS ALL IMMEDIATE 必要性 | ✅ 本库 12 条 DEFERRABLE INITIALLY DEFERRED FK 的删除事件挂在被 ALTER 的表上；PostgreSQL SQLSTATE 55006 "cannot ALTER TABLE … because it has pending trigger events"（官方文档 + 社区实证），删除后、恢复前的冲刷位置正确 | §5.2 |
| 12 | DRYRUN 真实执行完整删除路径后 ROLLBACK | ✅ 本审计独立重跑：ON_ERROR_STOP 全绿 → "DRYRUN PASSED"；归档 echoed transcript 显示 6 禁用(:466-471)→13 DELETE→SET CONSTRAINTS(:488)→6 恢复(:489-494)→POST→ROLLBACK(:552)；重跑后快照零净变更 | §6 |
| 13 | 任一 pre-state 漂移 → 零写入中止 | ⚠️ **部分**：D1/D2/D4/D5/D6 全覆盖；**D3（窗口外 fixture 模式行）不中止 → B1**；D7（守卫预先 disabled）不钉不中止（当前全 'O'，记 M1） | §7 |
| 14 | cleanup 后触发器全部 enabled | ✅ 恢复语句位于 POST 校验与 COMMIT 之前、同一事务；DRYRUN 后实测 18/18 tgenabled='O'；真实执行若中途失败整体回滚连触发器状态一并还原 | §5 |
| 15 | 无 TRUNCATE / 前缀删除 / 非 allowlist DELETE | ✅ 静态扫描：0 TRUNCATE/DROP/UPDATE/GRANT/REVOKE；恰好 13 条 DELETE，全部 `WHERE pk IN (SELECT … FROM allow_*)`；对永久表的写仅有 13 条 allow_* 临时表 INSERT | §7.1 |

## 2. 源码侧独立重建（provenance）

从 worktree `/private/tmp/svc-workflow-global-reader-impl`（HEAD == `9e58599`，branch
`impl/global-workflow-reader-v1`，`git branch --contains` 证实）提取
`tests/23_global_coordinator.rs` 与 `tests/common/mod.rs`：

- **9 个 `#[tokio::test]`**；main `6f1f546` 的同文件仅 6 个测试且 **0 个** Reader key
  → 来源只能是该实现分支（调查 §2.1 成立）。
- 逐测试 seed 台账（T1 多域可见 / T2 分页 / T3 summary / T4 无角色拒绝 / T5 域边界 /
  T6 COORDINATOR 生命周期 / T7 Reader 跨域 / T8 Reader 无写权 / T9 Reader 生命周期）独立求和：
  HUMAN `'Test User'`(test@example.com) **13**；AGENT `'Test Agent'`(email NULL，tests/23 自有
  `seed_agent`；common 的 `seed_second_principal` 用 agent@example.com 但该文件 **0 次调用**) **11**
  → principals **24**；domains/DRB **13/13**；defs/versions/nodes/transitions **13/13/26/13**；
  global 绑定 **5 COORD + 3 READER**，其中恰 **2 条 enabled=false**（T6/T9 的 API 授予后被 DELETE
  撤销，行保留）；instances **19**（title 集 16 值）；events **19**（全部 INSTANCE_CREATED）；
  receipts **19 + 6 固定 = 25**。
- **回执面精确闭合**：源码中另有 `grant-global-2`/`grant-reader-2`（422）与
  `cancel-coord-1`/`archive-coord-1`/`reader-denied-{create,owner,cancel,archive}-1`（403）共 8 个
  key —— 均不走产生回执的路径；DB 全库检索这 8 个 key **0 条回执**（§3.4），反向证明没有
  额外的测试写入面。
- 与声称对账：24/13/13/8/13/19 与 `RELATED_ROW_TOTAL=224` 的每表拆分**全部由源码独立复算一致**。

## 3. DB 侧独立复核（全部会话级 `default_transaction_read_only=on`）

### 3.1 窗口重建

以 runner 实际窗口 `[08:17:36+08, 08:17:45+08)` 逐表计数：
24/13/13/8/13/13/26/13/**19/19/19/19/25**，五张零写入表 0，合计 **224** ✅。
（审计插曲，已裁决：本审计最初用半开精确窗口 `[36.396306, 43.997024)` 计数得 219，差额恰为
**共享 `created_at = 08:17:43.997024` 的 5 行**——最后一笔实例创建事务的
instance/visit/revision/event/receipt 同事务同 now()。调查的突发区间是闭区间，runner 的秒级窗口
安全包含之。此非数据问题，是窗口端点语义；记录在案以防后续审计踩坑。）

### 3.2 224 exact ID 四方比对

DB 窗口行（本审计自 DB 推导，不信任 allowlist）vs `allowlist.tsv` vs runner 13 个
`INSERT INTO allow_*` vs 调查文档附录 A —— **四方 224/224 逐 ID identical**（sorted diff = 0）。
→ `ALLOWLIST_ROWS = 224` 且 `UNKNOWN_ROW_COUNT = 0`（窗口内不存在 allowlist 之外的行；
allowlist 内不存在窗口之外的行）。

### 3.3 时间窗冻结

- 窗口行 min/max = `08:17:36.396306` / `08:17:43.997024`（与声称逐字相同）。
- 2026-08-29 当天窗口外写入（18 表全查）= **0**；全库 last business write =
  `2026-08-27 09:07:34.972647`；全库最新写入 = 窗口终点（至今零新增）。

### 3.4 回执与 key 机械区分

- 窗口内 25 条：19 个**互异** `create-<uuid-v4>` + `grant-global-1`/`revoke-global-1`/
  `transition-coord-1`/`grant-reader-1`/`revoke-reader-1`/`reader-denied-transition-1`，全部
  `COMPLETED`，逐 key 与源码字面量对应 ✅。
- `^create-{uuid-v4}$` 窗口外 = **0**（历史 36 条 `create-%` 为 broker 格式，不匹配 uuid 正则）；
  6 个固定 key 全库仅窗口内各 1 条；8 个"不产回执"key 全库 0 条（§2）。

### 3.5 内容与形状

- 19 条 context `payload->>'title'` 多重集 = 源码 title 集（alpha-1/alpha-2/beta-1/page-0..4/
  summary-1/denied-1/boundary-a/boundary-b/lifecycle-1/reader-a1/reader-a2/reader-b1/
  reader-write-a/reader-write-b/reader-lifecycle-1）逐字节相等 ✅。
- principals 拆分 13 HUMAN + 11 AGENT（email 配对正确）；domains 13 全 `test-domain-%`+'Test Domain'；
  defs 13 全 `global-test-%`+'Global Test Def'；visits 全 visit 1/entered_by NULL；revisions 全
  revision 1/previous NULL；instances 0 cancelled/0 archived；events 19 全 INSTANCE_CREATED；
  global 绑定 5:3 且恰 2 条 enabled=f ✅。
- **窗口外 lookalike 终身扫描全 0**（Test User/Agent、test@example.com、test-domain-%、
  global-test-%、test-def-%、'Global Test Def'、READER 绑定）；窗口外 6 条历史 COORDINATOR 绑定
  （08-11..08-14，真实业务 principal）与 allowlist 8 ID 不相交，确认不在清理范围。

## 4. 60 FK 双向隔离（本审计自实现）

对 public schema 全部 `contype='f'`（**恰 60 条**，与声称一致）动态生成双向计数
（窗口集合全内联自 created_at，不依赖 allowlist；复合 FK 按 confkey 全列；MATCH SIMPLE 语义 =
引用列全非空才判违例）：

```
RESULT constraints=60 total_dirA=0 total_dirB=0 violating_constraints=0
```

- dirA=0：窗口行引用的每个 FK 目标都在窗口集内 → **无未知引用**。
- dirB=0：窗口外任何行的任何 FK 列都不指向窗口行 → **无窗口外引用**。
- 结构事实两条，均已评估：
  - 唯一 `ON DELETE CASCADE` FK = `workflow_instance_node_assignees.workflow_instance_id →
    workflow_instances`。assignees 表全库仅 3 行、窗口 0 行、P4 全时向 allowlist 引用检查 = 0、
    P6 对该表整表 digest 预钉 → 级联删除面为空，且即便意外级联也会撞 digest 比对整体回滚。
  - 12 条 DEFERRABLE INITIALLY DEFERRED FK（instance↔visit/ctx、node↔transition、event/submission/
    assistance 的 same-instance 复合键、previous_revision）→ §5.2 的 SET CONSTRAINTS 依据。

## 5. 触发器与守卫恢复模型

### 5.1 全量清单（本审计实测）

全库** 18 个**非内部触发器、当前全部 `tgenabled='O'`。runner 只禁用 6 个 append-only 守卫
（events/context_revisions/node_visits 三者 = `fn_prevent_modification` 无条件禁改；
command_receipts_completed = COMPLETED 回执禁删；node/transition graph = PUBLISHED 版本图禁删）；
**其余 12 个在删除期间保持 enabled**（receipts 的 4 个状态/身份触发器、version 的 2 个、
instance_immutable、node_visit_assignee、assistance×3、submissions×1）——DRYRUN 在不禁用它们的
情况下成功删除 19 回执/13 版本/19 实例/19 访问，实证它们对本删除集不阻断（其语义面向 UPDATE）。

### 5.2 恢复模型与 SET CONSTRAINTS ALL IMMEDIATE 的必要性

恢复模型 = **同一 SERIALIZABLE 事务内** disable → 13 DELETE → `SET CONSTRAINTS ALL IMMEDIATE`
→ enable → POST 校验 → COMMIT/ROLLBACK。PostgreSQL DDL 事务化：任何中途失败/回滚连触发器状态
一并还原；COMMIT 前恢复语句已执行，故"cleanup 后 6 守卫全部 enabled"由构造保证（DRYRUN 后实测
18/18 'O'）。

`SET CONSTRAINTS ALL IMMEDIATE` **必要而非装饰**：本库 12 条 INITIALLY DEFERRED FK 的删除会在
被 ALTER 的表上留下待决 trigger 事件；PostgreSQL 对有待决事件的表执行 `ALTER TABLE … ENABLE
TRIGGER` 将以 SQLSTATE 55006（`object_in_use`，"cannot ALTER TABLE … because it has pending
trigger events"）拒绝。删除后、恢复前的冲刷既是通行修复模式，也顺带把 FK 违例提前到守卫恢复
之前暴露。调查"DRYRUN 实测发现"的叙述与该文档化行为一致。

## 6. DRYRUN 独立重跑（本轮唯一非只读动作，事务内回滚）

- 重跑命令：`SVC_WF_CLEANUP_DRYRUN=1 bash /tmp/run-svc-workflow-test-fixture-cleanup.sh`
  → **RESULT: DRYRUN PASSED**（ON_ERROR_STOP 下全路径语句逐一成功，含 P1–P7、13 DELETE、
  POST 计数+digest）。
- 前后快照（18 表 count+md5、18 触发器 tgenabled、全库 max(created_at)）**字节级相同** →
  **零净变更**；`NON_TARGET_DIGEST_STABLE = YES`。
- 归档 echoed transcript（调查轮）与本轮日志均已入证据目录。

## 7. Runner 静态审计

### 7.1 破坏面扫描（item 15）

0 TRUNCATE / 0 DROP / 0 UPDATE / 0 GRANT / 0 REVOKE；DELETE 恰 13 条且每条
`WHERE <pk> IN (SELECT <pk> FROM allow_*)` —— 无前缀 LIKE 删除、无整表删除；对永久表无任何
INSERT/UPDATE。门禁：身份(root/yanfenma)+DSN 形状(本地 host)+dbname 钉死+事务内
`current_database()` 复核+密码仅走 PGPASSWORD 不打印。单一 SERIALIZABLE 事务 +
lock_timeout=15s/statement_timeout=120s + ON_ERROR_STOP + 失败即回滚零提交。

### 7.2 漂移中止矩阵（item 13）

| 漂移类 | runner 行为 | 结论 |
|---|---|---|
| D1 allowlist 行缺失/被改 | P1 计数 / P3 逐行模式证明 → 中止 | ✅ |
| D2 窗口内出现 allowlist 外同模式行 | P2 → 中止 | ✅ |
| **D3 窗口外出现 fixture 模式行（如测试重跑）** | **P2 限定窗口 → 不中止；照常 COMMIT** | ❌ **B1** |
| D4 业务行引用 allowlist 行 | P4（窗口前）+ FK 引擎在 DELETE/SET CONSTRAINTS 时强制（任意时刻，含窗口后新增）→ 中止 | ✅ |
| D5 五张零写入表窗口内出现行 | P5 → 中止 | ✅ |
| D6 守卫触发器缺失/改名 | P7 → 中止 | ✅ |
| D7 守卫预先处于 disabled | P7 只查在位不查状态 → 不中止，且会在结束时将其 enable（状态漂移顺带"修复"） | ⚠️ M1（当前实测全 'O'，不触发） |
| D8 新 schema/FK 指向 allowlist 表 | FK 引擎兜底 → 中止 | ✅ |

D4/D8 的引擎兜底论证：删除被引用行时 FK 立即（或经 SET CONSTRAINTS ALL IMMEDIATE 冲刷时）校验，
任何引用存在即事务中止——P4 的窗口前限定不构成漏洞。

## 8. 发现与整改要求

**B1（blocker，REVISE 的唯一原因）**：P2 的"fixture 模式行必须全部在 allowlist 内"检查携带
`created_at ∈ 窗口` 合取项，窗口外的同模式行完全不可见。后果链：误配置重跑 → 新孤岛（自引用
自洽，P4/FK/digest 均不设警）→ runner 照常 COMMIT 并报 remaining 全 0 → Owner 被误导残留已清空。
整改（机械、一处模式）：**新增 P2b，每表一个不限定时间窗的模式计数 == allowlist 期望数**
（如 principals：全库 `display_name IN ('Test User','Test Agent')` 且类型/email 配对 = 24；
receipts：全库 uuid-create ∪ 6 固定 key = 25；依此类推）。本审计终身 lookalike 扫描全 0（§3.5），
故 P2b 在当前数据上恒过、零行为变化，只补上"冻结态"防线。修订后需一轮快速复审（只需验证
sha256 变更 + P2b 语义 + 重跑 DRYRUN）。

**M1（建议，非 blocker）**：P7 同时断言 6 个守卫 `tgenabled='O'`（当前实测全部 'O'），使
"恢复 = 原状"从事后实测升为事务内构造性保证。

**M2（文档勘误，非 blocker）**：调查文档 §5 载 runner 体积 "58,721 B"，实测 **58,761 B**
（sha256 封印不受影响）；runner 头部注释引用证据目录写作 `svc-workflow-test-fixture-cleanup/`
（缺 `-v1` 后缀）。

## 9. 边界

- 本轮 **PRODUCTION_CHANGE = NONE**：所有 DB 访问为只读（会话级
  `default_transaction_read_only=on`，服务端强制，连临时表 DDL 都被拒绝）或 DRYRUN 事务内
  全路径后 ROLLBACK；未停服务、未改配置、未删任何行、未执行真实 cleanup。
- svc-workflow 仓库 0 改动；dsh-agent-core packages/ + scripts/ 0 改动；工作区既有 WIP
  （broker 修改 + 未跟踪文档）原样保留；本审计产物仅新增 docs/ 文件。
- 本轮新增证据：`docs/evidence/svc-workflow-test-fixture-cleanup-v1/audit-20260829/`
  （FK 隔离结果、DB 推导窗口 ID、DRYRUN 前后快照与 diff、重跑日志、全部审计 SQL）。

## 10. 最终字段

```
残留 审计 = REVISE            # 唯一 blocker B1（P2 窗口限定）；数据/安全声称全部证实
ALLOWLIST_ROWS = 224           # 四方逐 ID identical；逐表 24/13/13/8/13/13/26/13/19/19/19/19/25
UNKNOWN_ROW_COUNT = 0
OUTSIDE_REFERENCE_COUNT = 0    # 60 FK dirA=0 dirB=0
TRIGGER_RESTORE_MODEL = SAME_TRANSACTION_DISABLE_SET_CONSTRAINTS_IMMEDIATE_RESTORE  # 事务化 DDL；55006 必要性证实
NON_TARGET_DIGEST_STABLE = YES # DRYRUN 前后 18 表快照字节相同
DRYRUN = PASS                  # 本审计独立重跑，全路径 + ROLLBACK，零净变更
BLOCKERS = B1（P2 建议加不窗口限定的 P2b 模式计数）；M1/M2 建议级
READY_FOR_OWNER_CLEANUP = NO   # 待 B1 修订 + 快速复审后翻转
PRODUCTION_CHANGE = NONE
```
