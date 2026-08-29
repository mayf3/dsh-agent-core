# svc-workflow dogfood 测试残留清理 runner 修订 V1（残留 修订）

> TASK_NAME = 残留 修订 · TASK_TYPE = CLEANUP_RUNNER_PRESTATE_HARDENING
> 日期：2026-08-29 · 修订人：独立修订 Agent（未参与原调查 01063e1 与原 runner 编写）
> 修订对象：独立审计 344cce3 的唯一 blocker **B1**（P2 漂移检查被 7.6 秒窗口合取限定）
> 输入封存：v1 runner `/tmp/run-svc-workflow-test-fixture-cleanup.sh`
> （sha256 `9cf26d42d903b1ba71ffcef92acf34b0451f4cf370a9876777a3a2e246e391a7`，与审计封存值一致）
> 性质：**docs + runner 修订**。本轮**未执行真实 cleanup**（无 COMMIT，DRYRUN 全路径 + ROLLBACK only）。

## 0. 结论（TL;DR）

**B1 已关闭**：v2 runner 新增 **P2b LIFETIME_FIXTURE_PATTERN_DRIFT_GATE** —— 不带任何时间窗、
覆盖数据库全生命周期的 fixture-signature 扫描，要求逐表 lifetime 匹配集合与 224 行 allowlist
**精确相等**；任何窗口外新 fixture 行（EXTRA）或 allowlist 行缺失/变形（MISSING）都会在
**禁用任何 trigger、执行任何 DELETE 之前**零写入中止，且绝不自动扩展 allowlist。

- 新 runner：`/tmp/run-svc-workflow-test-fixture-cleanup-v2.sh`
  （72,781 B；sha256 `b77802236525bb8fd22bdf7f94e59b777e208f30ef7b24aa0a475c894bbd21d6`；
  归档副本字节一致：`docs/evidence/svc-workflow-test-fixture-cleanup-v1/revision-20260829/`）
- 结构证明：v2 = v1 + 头部注释重写 + **恰好一个 71 行的 P2b 插入块**（P3 之后、P4 之前）；
  其余 SQL 字节相同（分段 diff 全等）；13 条 DELETE / 6 禁用 + 6 恢复 / SET CONSTRAINTS /
  224 UUID allowlist / digest / rollback 全部不变。
- 验证（详见 §3）：**A 生产 DRYRUN = PASS**（P2b 报告 224/224，extra=0 missing=0）；
  **B 合成孤岛 = PASS**（真实 tests/23 套件在 disposable 副本上生成窗口外完整第二孤岛 224 行，
  P2b 以 `EXTRA_FIXTURE_ROW_COUNT=224` fail closed，删除面零执行）；
  **C1/C2 missing/changed allowlist = PASS**（P1/P3 先行中止，P2b missing 视角同步=1）；
  **D 前后快照字节一致**（生产库 18 表 digest + 18 触发器 + max(created_at)，轮末复检仍一致）。
- `EXTRA_FIXTURE_ROW_COUNT_CURRENT = 0`（生产库当前 lifetime 扫描与 allowlist 精确相等）。

## 1. P2b 设计（唯一修订，其余安全模型保持）

审计 B1 修复建议为"每表一个不限定时间窗的模式计数 == allowlist 期望数"。v2 按该建议实现并
做两点强化：

1. **lifetime 集合互引（关键）**：13 个 `lf_*` 集合的跨表引用一律指向**其他 lifetime 集合**，
   绝不引用 `allow_*`。若引用 allow_*（v1 P2 的做法），一个**自洽的第二孤岛**（只引用自己
   的 principal/domain/definition）会在绑定/定义/实例等所有下游表上不可见 —— 那正是 B1 的
   盲区。互引后，孤岛自身的 principal/domain 命中会级联点亮其全部关联行。
2. **集合相等（双向）**：不仅要求 EXTRA（lifetime − allowlist）= 0，也要求 MISSING
   （allowlist − lifetime）= 0，并要求逐表计数相等。任何方向的漂移都视为 pre-state 漂移。

P2b 在脚本中的位置：P1/P2/P3 逐表检查之后、P4 隔离检查之前 —— 远早于任何
`ALTER TABLE … DISABLE TRIGGER` 与任何 DELETE。失败时输出逐表报告
（`lifetime / allowlist / extra / missing` + TOTAL 行）、诊断 ID 列表（前 50 条），然后
`RAISE EXCEPTION`（ON_ERROR_STOP → 事务中止回滚，零写入），HINT 明示
"never auto-extends its allowlist; escalate to a new investigation round"。

### 1.1 lifetime signature（逐表谓词，全部源自 tests/23_global_coordinator.rs @ 9e58599 与 tests/common/mod.rs）

| 表 | lifetime 谓词（无 created_at 约束） | 源码依据 |
|---|---|---|
| principals | `display_name IN ('Test User','Test Agent')` 且（HUMAN↔`test@example.com` 或 AGENT↔email NULL）且 `enabled` | common `seed_principal_and_domain` / tests/23 `seed_agent` |
| domains | `domain_key ~ '^test-domain-[0-9a-f]{8}$'` 且 `display_name='Test Domain'` 且 `enabled` | common（`Uuid[..8]` 恰 8 位小写 hex） |
| domain_role_bindings | `role_key='DOMAIN_OWNER'` 且 enabled 且 domain∈lf_dom 且 principal∈lf_p | common `seed_domain_owner` |
| global_role_bindings | `role_key IN ('GLOBAL_WORKFLOW_COORDINATOR','GLOBAL_WORKFLOW_READER')` 且 principal∈lf_p（不要求 enabled —— 2 条 lifecycle 撤销行 enabled=f） | `grant_global_*` + PUT/DELETE lifecycle |
| workflow_definitions | `definition_key ~ '^global-test-[0-9a-f]{8}$'` 且 `display_name='Global Test Def'` 且 domain∈lf_dom | `seed_published_definition` |
| workflow_definition_versions | version=1 且 PUBLISHED 且 `context_schema IS NULL` 且 def∈lf_def | 同上（终态 PUBLISHED；schema 恒 NULL） |
| workflow_node_definitions | ver∈lf_ver 且（draft/Draft/0/DRAFT/WORKFLOW_CREATOR 或 done/Done/1/TERMINAL/assignee NULL）且 `fixed_principal_id IS NULL` | 同上两条 INSERT |
| workflow_transition_definitions | advance/'Advance'/ADVANCE 且 ver∈lf_ver 且 source/target∈lf_n | 同上 |
| workflow_instances | domain∈lf_dom 且 ver∈lf_ver 且 creator∈lf_p 且未 cancel/archive（含 by 列 NULL） | `create_instance` + create 路径终态 |
| workflow_command_receipts | COMPLETED 且（`^create-<uuid-v4>$`（v4 严格式：version nibble 4 + variant [89ab]）或 6 个固定测试 key）且 principal∈lf_p | `format!("create-{}", Uuid::new_v4())` + grant/revoke/transition/denied key 字面量 |
| workflow_context_revisions | revision=1 且 previous NULL 且 creator∈lf_p 且 instance∈lf_i 且 `payload->>'title'` ∈ 19 值标题集 | `json!({"title": title})`；19 个标题逐字来自 9 个测试 |
| workflow_node_visits | visit=1 且 entered_by NULL 且 instance∈lf_i 且 assignee∈lf_p 且 node∈lf_n | create 路径首访问（draft 节点） |
| workflow_events | INSTANCE_CREATED 且 instance∈lf_i 且 command∈lf_c 且 actor∈lf_p | create 路径唯一事件 |

补充事实（修订轮实测/复核）：

- **principals 表没有 `auth_subject` 列**（migration 0001：principal_id/principal_type/
  display_name/email/enabled/metadata/时间戳）——任务所述 "email/auth_subject 组合" 在本
  schema 中即 display_name+principal_type+email（+enabled）配对，P2b 按此实现。
- 6 个固定 key：`grant-global-1 / revoke-global-1 / transition-coord-1 / grant-reader-1 /
  revoke-reader-1 / reader-denied-transition-1`（v1 P2 同款；本轮回执拆分实测 19 uuid-v4 + 6 固定）。
- **勘误**：调查文档 §3 S5 写 "16-value title set"，实际源码与 DB 均为 **19 个互异标题、各恰好
  1 条**（alpha-1/alpha-2/beta-1/page-0..4/summary-1/denied-1/boundary-a/boundary-b/lifecycle-1/
  reader-a1/reader-a2/reader-b1/reader-write-a/reader-write-b/reader-lifecycle-1）。P2b 使用精确
  19 值列表；该笔误不影响 v1 结论（多重集逐字节相等的核心声称成立）。
- v4 严格正则在本库的机械区分度已复核：全库 lifetime `^create-<uuid-v4>$` 恰 19 条、固定 key
  恰 6 条（历史 36 条 broker 格式 `create-<kind>-<ts>-<nanoid>` 零误报）。

### 1.2 保持不变（与 v1 字节一致）

224 exact row allowlist（13 张临时表 UUID 集合 diff = 0）、13 张删除表与 FK-safe 顺序、
SERIALIZABLE 单事务、lock/statement timeout、P1–P7 原检查、trigger 同事务 disable→删除→
`SET CONSTRAINTS ALL IMMEDIATE`→restore 模型、P4/P5/P6 隔离与 digest、POST 全零校验、
DRYRUN=ROLLBACK、身份/DSN/dbname/`current_database()` 门禁、PGPASSWORD-only 凭据纪律。
禁止项依旧：无 TRUNCATE、无 LIKE/prefix/范围/时间窗 DELETE、无 UPDATE 永久表、无动态
allowlist 扩展。M1（P7 补 `tgenabled='O'` 钉扎）为审计建议级，**按任务范围本轮未纳入**，
留给审计轮裁量；M2 的证据目录引用勘误（缺 `-v1` 后缀）已在 v2 头部注释顺带修正（注释级）。

## 2. 修订方法（结构可审性）

- v2 由封存 v1 逐字节复制后做**两处**编辑：头部注释重写（含 v2/审计/B1 说明 + 用法路径 +
  日志文件名 `-v2-`）与 P2b 块插入。分段 diff 证明：P2b 之前的 SQL 段与 P2b 之后的 SQL 段
  与 v1 **逐字节相同**；UUID 全集 diff = 0（未增删任何 allowlist ID）。
- 计数不变式复核：`DELETE FROM` 13/13、`DISABLE TRIGGER` 6/6、`ENABLE TRIGGER` 6/6、
  `SET CONSTRAINTS ALL IMMEDIATE;` 语句 1/1、`INSERT INTO allow_*` 13/13、TRUNCATE 0/0。
- `bash -n` 语法通过；v1（sha `9cf26d42…`）本轮未改动。

## 3. 验证（本轮全部执行）

### A. 当前真实生产快照 DRYRUN —— PASS

`SVC_WF_CLEANUP_DRYRUN=1 bash /tmp/run-svc-workflow-test-fixture-cleanup-v2.sh` → exit 0，
`RESULT: DRYRUN PASSED`。transcript 中 P2b 报告：13 表全部 `lf=al`（24/13/13/8/13/13/26/13/
19/25/19/19/19），`TOTAL 224/224 extra=0 missing=0`，诊断 ID 列表空；全路径（P1–P7 + 13 守卫
删除 + POST + digest）在事务内执行后 ROLLBACK。

### D. DRYRUN 前后快照字节一致 —— PASS

快照 = 18 表全表 count+md5(sorted ids) + 18 个非内部触发器状态 + 全库 max(created_at)。
DRYRUN 前后 diff = **0 行**；轮末（全部测试 B/C 与容器拆除之后）再检一次仍与 A 前快照
**字节一致** → 全轮生产零净变更。

### B. synthetic drift（窗口外第二孤岛）→ DELETE 前 fail closed —— PASS

disposable 环境：本机 Docker `postgres:16.14-alpine`（与生产 16.14 同版）绑定 127.0.0.1:5433；
以 svc_wf 对生产 `pg_dump -Fc`（3.2 MB，只读）恢复为同名库 `svc_workflow_dogfood_clean`，
恢复后 18 表 digest + 18 触发器与生产快照**逐字节一致**（auth_ro GRANT 报错为缺失角色的
ACL 噪声，数据已 digest 证明；时区渲染差异以 PGTZ 归一）。

- **harness 自检**：TESTVARIANT runner 与 v2 **仅一行差异**（`ENV_FILE` 指向测试 .env；
  sha256 `0401fcef232812c6e3bdae5ffc981decb7471a3d29b5f7ab7a95a9ba61edf4c3`）在**未注入**的
  副本上 DRYRUN = PASS（与生产行为一致）。
- **注入**：将**真实测试套件** `cargo test --test 23_global_coordinator`（worktree
  /private/tmp/svc-workflow-global-reader-impl @ 9e58599）的 `TEST_DATABASE_URL` 指向该
  disposable 库 —— 与事故完全相同的机制，9/9 测试通过（11.3s），产生完整第二孤岛，且
  created_at 在旧窗口之外（24/13/13/8/13/13/26/13/19/25/19/19/19 = 恰 224 行）。
- **结果**：TESTVARIANT DRYRUN exit 3，`P2b LIFETIME_FIXTURE_PATTERN_DRIFT_GATE FAILED:
  EXTRA_FIXTURE_ROW_COUNT=224 ALLOWLIST_MISSING=0 drifted_tables=13`（逐表 lifetime 恰为
  原孤岛两倍），中止点在任何 trigger disable/DELETE 之前，`RESULT: FAILED (transaction
  rolled back; zero rows committed)`。
- **零写入证明**：中止后副本内 224 行 allowlist 全部在位、孤岛全部在位、18 触发器全部
  enabled（`triggers_not_enabled=0`）。v1 在此状态下会照常 COMMIT 并打印 remaining=0
  —— 即审计 B1 的完整反例，v2 不再可能。

### C. missing / changed allowlist → DELETE 前 fail closed —— PASS

（均在恢复后的干净副本上注入单一漂移后运行 TESTVARIANT）

- **C1 missing**：删除 1 条 allowlist `domain_role_bindings` 行（叶表、无守卫）→
  `P1 domain_role_bindings: allowlist present=12 expected=13`，exit 3，零提交。
- **C2 changed**：将 1 条 allowlist principal `display_name` 改为 'Test User DRIFT-CHANGED' →
  `P3 principals: 1 allowlist rows fail pattern proof`，exit 3，零提交。
- P2b 视角：C2 状态下 lifetime=23 / allowlist=24 / **missing=1**（同一漂移在 P2b 报告中亦
  可见；因 P3 谓词与本轮 P2b 谓词同源且 P3 在前，P2b 的 MISSING 分支被 P3 构造性遮蔽 ——
  双重防线，EXTRA 分支则是 P2b 独有贡献，已由 B 证明）。

## 4. 边界

- **PRODUCTION_CHANGE = NONE**：生产库访问仅 (a) 只读 SELECT 探针/lifetime 扫描/快照，
  (b) 单次 DRYRUN 全路径 + ROLLBACK（继承调查/审计轮先例）；未停服务、未改配置、未删任何行、
  未执行真实 cleanup、无 COMMIT。
- disposable 资源已拆除（容器 removed；生产 dump `prod-snapshot.dump` 仅存 /tmp，**不入库**
  —— 见 MANIFEST 排除声明）；测试套件运行仅发生在 disposable 副本，svc-workflow 仓库源码
  0 改动（worktree 仅产生 gitignored 的 target/ 构建产物）。
- dsh-agent-core：仅新增/修改 docs/（报告、evidence、investigation 更新）；packages/ 与
  scripts/ 0 改动；工作区既有 WIP 原样保留。
- 本轮未触碰：36 条历史 broker 格式回执、6 条历史业务 global 绑定、TEST_DATABASE_URL
  隔离缺陷修复（仍属 svc-workflow 仓库治理）。

## 5. 审计交接（快速复审范围）

复审只需核验四点：(1) v2 对 v1 的差异**仅为**头部注释 + P2b 块（分段 diff 已提供）；
(2) P2b 谓词逐条等于 §1.1 的 tests/23 signature（对照源码 worktree @ 9e58599）；
(3) 生产 lifetime 扫描 extra=0/missing=0 且 DRYRUN 重跑 PASS；(4) 合成孤岛中止路径
（evidence: `testvariant-island-dryrun.txt`）在任何 DISABLE/DELETE 之前。开放项：M1
（P7 钉 `tgenabled='O'`）仍为建议级未实施；调查文档 §3 S5 的 "16-value" 标题数笔误
（实为 19 值）已在本文 §1.1 记录勘误。

## 6. 最终字段

```
OLD_RUNNER  = /tmp/run-svc-workflow-test-fixture-cleanup.sh            # sha256 9cf26d42…391a7（未改动）
NEW_RUNNER  = /tmp/run-svc-workflow-test-fixture-cleanup-v2.sh         # sha256 b7780223…21d6, 72781B
LIFETIME_DRIFT_GATE = IMPLEMENTED                                      # P2b，13 表 lifetime 集合 == 224 allowlist（双向）
EXTRA_FIXTURE_ROW_COUNT_CURRENT = 0
ALLOWLIST_ROWS = 224
CURRENT_DRYRUN = PASS                                                 # 生产全路径 + ROLLBACK
SYNTHETIC_EXTRA_ISLAND_TEST = PASS                                    # 真实 tests/23 副本注入，EXTRA=224，DELETE 前中止，零写入
MISSING_ALLOWLIST_TEST = PASS                                         # C1(P1 中止) + C2(P3 中止)，DELETE 前，零写入
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
READY_FOR_FOCUSED_REVIEW = YES
NEXT_TASK = 残留 审计
```
