# svc-workflow dogfood 测试残留调查 V1（残留 调查）

> TASK_NAME = 残留 调查 · TASK_TYPE = READ_ONLY_INVENTORY_AND_STAGED_CLEANUP
> 日期：2026-08-29 · 调查人：独立调查 Agent（无历史上下文）
> 性质：**只读调查 + staged cleanup**。本轮零生产变更、零删除；仅生成并验证（DRYRUN 回滚式）
> cleanup runner，交 Owner 决策执行。

## 0. 结论（TL;DR）

一次 **Global Reader 实现验证**把 `tests/23_global_coordinator.rs`（Global Reader 版，branch
`impl/global-workflow-reader-v1` @ `9e58599`，worktree `/private/tmp/svc-workflow-global-reader-impl`）
的 9 个集成测试运行到了**生产 dogfood 数据库 `svc_workflow_dogfood_clean`**（本机 PostgreSQL 5432，
服务 `/Users/yanfenma/.local/services/svc-workflow`，launchd `com.svc-workflow`）。

写入发生在**单一 7.6 秒突发窗口**：

- 窗口 = `[2026-08-29 08:17:36.396306+08, 2026-08-29 08:17:43.997024+08]`
- 窗口前最后一次业务写入 = `2026-08-27 09:07:34.972647+08`（两天前；窗口后至今无任何写入）

共 **224 行 / 13 张表**，与执行 Agent 报告的数量完全一致（24/13/8/13/19），并额外闭环了全部
关联行（visits/revisions/events/receipts/bindings/nodes/transitions）。**每行都有 7 类独立证据
证明为测试 fixture；`UNKNOWN_ROW_COUNT = 0`；FK 双向隔离零泄漏**（窗口行只引用窗口行；窗口外
没有任何行引用窗口行）。业务数据（537 个真实实例、256 个 principal 中的 232 个真实 principal、
1623 条 domain 绑定等）与测试孤岛完全无交集。

Cleanup runner 已生成并通过**全路径 DRYRUN**（在事务内真实执行检查+守卫禁用+13 表删除+
守卫恢复+零残留校验+业务 digest 对比，然后 ROLLBACK，零提交写入）：

- `/tmp/run-svc-workflow-test-fixture-cleanup.sh`
  （sha256 `9cf26d42d903b1ba71ffcef92acf34b0451f4cf370a9876777a3a2e246e391a7`）
- 归档副本：`docs/evidence/svc-workflow-test-fixture-cleanup-v1/run-svc-workflow-test-fixture-cleanup.sh`
- Owner 执行（单条命令）：`sudo bash /tmp/run-svc-workflow-test-fixture-cleanup.sh`

## 1. 事实基线（全部只读实测）

| 事实 | 值 | 证据 |
|---|---|---|
| 生产服务 | `/Users/yanfenma/.local/services/svc-workflow/svc-workflow`（launchd `com.svc-workflow`，16Aug26 起） | `launchctl list`、plist、ps |
| DATABASE_URL | `postgresql://svc_wf:***@localhost:5432/svc_workflow_dogfood_clean`（凭据不落文） | 服务 `.env`（600, yanfenma） |
| 库规模 | 19 表；principals 256 / domains 39 / instances 537 / receipts 4540 / events 2327 / security_audits 1433 … | 全表 count（read-only 会话） |
| 全库最早/最晚写入 | `2026-07-17 08:53` / `2026-08-29 08:17:43.997`（=测试窗口终点） | min/max(created_at) |
| 8/29 当天写入分布 | **全部集中在 08:17:00–08:17:59 一分钟内**（5 核心表按分钟聚合仅此一行） | date_trunc('minute') 聚合 |
| 窗口精确边界 | `08:17:36.396306` → `08:17:43.997024`（18 表 union min/max） | 全 18 表窗口聚合 |
| 窗口内总行数 | **224**（13 表之和，另 5 表为 0） | 全 18 表窗口求和 |
| 窗口前最后业务写入 | `2026-08-27 09:07:34.972647`（principals/events/receipts/security_audits 同刻） | 窗口外 max(created_at) |

## 2. 误运行来源定位（provenance）

1. **来源测试**：`tests/23_global_coordinator.rs` 的 Global Reader 版
   （9 个 `#[tokio::test]`，含 3 个新增 Reader 测试），源码 worktree
   `/private/tmp/svc-workflow-global-reader-impl`，branch `impl/global-workflow-reader-v1` @ `9e58599`
   （`feat(query): add GLOBAL_WORKFLOW_READER read-only role …`）。
   主仓 main @ `6f1f546` 的 tests/23 只有 6 个测试、只有 COORDINATOR 角色 ——
   与本次 DB 中出现 `GLOBAL_WORKFLOW_READER` 绑定（3 条）不符，故来源只能是该实现分支。
2. **连接机制**：tests/common/mod.rs `create_pool()` 读环境变量 `TEST_DATABASE_URL`（缺省
   `postgres://postgres:postgres@localhost:5432/svc_workflow`）。误运行即把 `TEST_DATABASE_URL`
   指向了 dogfood DSN（无测试专用库隔离，`cargo test` 直写目标库）。
3. **DB 侧回执坐实**：窗口内 25 条 `workflow_command_receipts` 的 idempotency_key 精确等于
   测试源码字面量：
   - `create-<uuid-v4>` ×19（`create_instance()` helper：`format!("create-{}", Uuid::new_v4())`）
   - `grant-global-1` / `revoke-global-1`（coordinator lifecycle 测试）
   - `transition-coord-1`（coordinator 无写权测试，403 回执）
   - `grant-reader-1` / `revoke-reader-1` / `reader-denied-transition-1`
     （**Reader 专属**，main 版测试不存在这三个 key）
   - 422 路径（`grant-global-2`/`grant-reader-2`）不产生回执，DB 中也确实没有 ✓
4. **fixture 代数完全对账**（9 测试 × 每测试的 seed 调用推算 vs DB 实测）：

   | 量 | 推算 | DB 实测 |
   |---|---|---|
   | 'Test User' principal（HUMAN, test@example.com） | 13 | 13 |
   | 'Test Agent' principal（AGENT, email NULL） | 11 | 11 |
   | `test-domain-*` 域 / DOMAIN_OWNER 绑定 | 13 / 13 | 13 / 13 |
   | `global-test-*` 定义 / 版本 / 转移 / 节点 | 13/13/13/26 | 13/13/13/26 |
   | 全局绑定（COORDINATOR 5 + READER 3，其中 2 条 lifecycle 撤销后 enabled=f） | 8 | 8（5+3，2 条 f） |
   | 实例 | 3+5+1+1+2+1+3+2+1 = 19 | 19 |
   | events（全部 INSTANCE_CREATED） | 19 | 19 |
   | 回执 | 19 create + 6 固定 key = 25 | 25 |

## 3. 逐行归属证明（禁止仅凭"名字像 test"）

对窗口内每一行，同时满足以下**多信号交叉**（runner 的 P1–P3 检查逐表重验同一组谓词，
任何一条不满足即中止零写入）：

| # | 信号 | 内容 |
|---|---|---|
| S1 | 固定 key/prefix | `test-domain-<8hex>`、`global-test-<8hex>`、`create-<uuid-v4>`（正则区分，见 S6） |
| S2 | 字面 display name | principal ∈ {'Test User','Test Agent'}（HUMAN↔test@example.com / AGENT↔NULL）、domain='Test Domain'、def='Global Test Def' |
| S3 | 时间窗口 | 每行 created_at ∈ 7.6s 突发窗口；窗口外全库无任何写入 |
| S4 | 数量代数 | §2 表格逐项对账（含 COORDINATOR/READER 5:3 与 2 条 enabled=f 的撤销语义） |
| S5 | 内容字面量 | 19 条 context payload title 精确等于测试源码标题集合 {alpha-1,alpha-2,beta-1,page-0..4,summary-1,denied-1,boundary-a,boundary-b,lifecycle-1,reader-a1,reader-a2,reader-b1,reader-write-a,reader-write-b,reader-lifecycle-1}，各 1 条 |
| S6 | 回执 key 机械区分 | `^create-{uuid-v4}$` 窗口内 19 条、窗口外 **0** 条；窗口外历史 36 条 `create-%` 全是 broker 格式（`create-agent-<ms>-<nanoid>` 等），无 uuid 格式 |
| S7 | FK 双向隔离 | A：窗口行引用的每个 FK 目标都是窗口行（13 表 12 组全 0）；B：窗口外任何行的任何 FK 列都不指向窗口行（16 组全 0，含 submissions/attempt_audits/security_audits/assignees/assistance 五张零写入表） |

**窗口外同名 fixture 扫描**（证明"本次误写入"集合完备、不含历史残留）：
窗口外 'Test User'/'Test Agent' principal = 0；`test-domain-%` 域 = 0；`global-test-%`/`test-def-%`
定义 = 0；GLOBAL_WORKFLOW_READER 绑定 = 0；固定测试回执 key = 0。
历史 global_role_bindings 6 条（8/11–8/14）全部绑定真实业务 agent
（'agent-bc970ced'、'文风分析师'、4×'coordinator agent'）——**不属于本次残留，不进 allowlist**。

## 4. FK closure 与删除顺序

60 条 FK 约束全量拉取后，224 行构成完全封闭孤岛（S7）。另有两个结构事实决定 runner 设计：

1. **循环 FK**：instance ↔ node_visit/context_revision（`fk_instance_current_visit/ctx`，
   DEFERRABLE INITIALLY DEFERRED）、node ↔ transition（`primary_advance_transition_id`，同）。
   两端都在 allowlist 内整删，COMMIT 时检查通过。
2. **六个 append-only DELETE 守卫触发器**（本轮 DRYRUN 实测全部会阻断）：
   `trg_events_immutable`、`trg_context_revisions_immutable`、`trg_node_visits_immutable`
   （=fn_prevent_modification，无条件）、`trg_command_receipts_completed_immutable`
   （COMPLETED 回执禁删，本次 25 条全 COMPLETED）、`trg_node_definitions_graph_immutable`、
   `trg_transition_definitions_graph_immutable`（PUBLISHED 版本禁删）。
   Runner 在**同一事务内** disable→删除→`SET CONSTRAINTS ALL IMMEDIATE`（冲刷 deferred FK
   队列，否则 re-enable 的 ALTER 会因 pending trigger events 被拒——DRYRUN 实测发现）→enable。
   PostgreSQL DDL 事务化：任何失败/回滚都会连触发器状态一起还原。

**FK-safe 删除顺序**（全部 `WHERE pk IN (allowlist)`，无前缀删除、无 TRUNCATE）：
events → node_visits → context_revisions → instances → command_receipts →
transition_definitions → node_definitions → definition_versions → definitions →
global_role_bindings → domain_role_bindings → domains → principals。

## 5. Cleanup runner（本轮不执行）

- 路径：`/tmp/run-svc-workflow-test-fixture-cleanup.sh`（58,721 B；
  sha256 `9cf26d42d903b1ba71ffcef92acf34b0451f4cf370a9876777a3a2e246e391a7`）
- Owner 单命令：`sudo bash /tmp/run-svc-workflow-test-fixture-cleanup.sh`
- 演练（零提交写入）：`SVC_WF_CLEANUP_DRYRUN=1 bash /tmp/run-svc-workflow-test-fixture-cleanup.sh`
- 安全机制（全部已实测）：
  - 门禁：仅 root(sudo)/yanfenma；DSN 解析后校验 host∈{localhost,127.0.0.1,::1}、
    dbname==svc_workflow_dogfood_clean；`current_database()` 事务内二次校验；
    密码仅经 PGPASSWORD env，**不打印 DSN/凭据**（日志只含库名/host/user）
  - 单一 SERIALIZABLE 事务 + `lock_timeout=15s`/`statement_timeout=120s`
  - 精确 row allowlist（224 个内嵌 UUID，13 张临时表）
  - P1/P2/P3：allowlist 在位计数 + 每行满足 §3 全部模式谓词 + **窗口内不存在 allowlist 之外
    的同模式行**（漂移即中止）
  - P4：S7-B 双向隔离 16 组在事务内重验（出现任何额外引用 → 零写入中止）
  - P5：五张零写入表窗口计数 == 0
  - P6：18 表业务行（非 allowlist）count+md5 digest 预钉 → 删除后重算比对（不相等即整体回滚）
  - P7：6 个守卫触发器在位校验；disable/enable 同事务
  - POST：13 表 allowlist 计数全 0 + digest 全等 → 才 COMMIT
  - 留痕：完整 transcript → `/tmp/svc-workflow-test-fixture-cleanup-<ts>.log`
- **本轮验证**：DRYRUN（全路径含删除与守卫操作，最终 ROLLBACK）exit 0 全绿；演练后复查
  生产库 24/13/19/25/19 原样、total principals=256、6 触发器全部 enabled —— 零净变更。

## 6. 边界与不做的事

- 本轮 **PRODUCTION_CHANGE = NONE**：全部数据库访问为只读（会话级
  `default_transaction_read_only=on`）或事务内演练后 ROLLBACK；未停服务、未改配置、未删任何行。
- 不删除也无法证明者：无（UNKNOWN_ROW_COUNT = 0）。
- 历史 36 条 broker 格式 `create-%` 回执、6 条历史业务 global 绑定：**不在本次范围**，未纳入
  allowlist，不做任何处置建议外的动作。
- svc-workflow 仓库代码 0 改动；dsh-agent-core packages/scripts 0 改动。
- 测试隔离缺陷（TEST_DATABASE_URL 可指向生产 DSN）仅记录，修复属 svc-workflow 仓库治理，
  由 Owner 另行决定。

## 7. 最终字段

```
CONFIRMED_TEST_PRINCIPALS = 24
CONFIRMED_TEST_DOMAINS = 13
CONFIRMED_TEST_ROLE_BINDINGS = 21   # 13 domain DOMAIN_OWNER + 8 global (5 COORDINATOR + 3 READER)
CONFIRMED_TEST_DEFINITIONS = 13     # 另有 13 versions / 26 nodes / 13 transitions 归属闭环
CONFIRMED_TEST_INSTANCES = 19       # 另有 19 visits / 19 revisions / 19 events / 25 receipts
RELATED_ROW_TOTAL = 224             # 13 表全部窗口行（含上述关联行）
UNKNOWN_ROW_COUNT = 0
CLEANUP_RUNNER = /tmp/run-svc-workflow-test-fixture-cleanup.sh  # sha256 9cf26d42…391a7, DRYRUN 已验证
PRODUCTION_CHANGE = NONE
READY_FOR_OWNER_CLEANUP = YES
```

## 附录 A：完整 row ID allowlist（224 行）

机器可读版：`docs/evidence/svc-workflow-test-fixture-cleanup-v1/allowlist.tsv`（table→pk→id）。
证据目录还含：runner 归档副本（与 /tmp 字节一致）、全路径 DRYRUN 回显 transcript
（`dryrun-transcript-echoed-20260829.txt`）。

### principals (24)

```
  0d165312-b1d5-4798-82cd-96e2f12300ab, 12724050-12a8-4c64-a5f3-93055797f5fa, 21380fce-3d81-47a0-b8b4-045560ef8175, 2416f5fa-bd4f-4650-9b85-0ffcd6a00e0d,
  2e0baa99-bbc3-434f-80ec-02c48a6e0e7f, 37344ace-bcb4-4948-becf-9ae52979fca3, 4839e512-600a-40c4-810d-f16a9e7386c1, 7792815b-66cb-46f2-b255-872fc71ee5dc,
  82b03705-adab-4b8b-8262-cb2f61aea1bb, 95d375c5-a93d-42ba-8a0b-eff7c8314c00, 9691f4be-e367-4e00-ba8a-8ba6509c837b, ad395450-d9c2-4498-882c-41543e8fea0b,
  b9e9243e-d263-48c0-912d-cf24ac3c2b69, bd1a2421-2a9b-4563-97fc-536b1b57dcf0, bef740f6-7b4c-4a79-b571-786874069909, c24bdad3-5b38-4445-b8c0-c50d295c524d,
  c5252e19-dbef-4dc5-8756-2b1bb711762d, c70d479d-d4c7-4bae-9946-07de3712d34d, ca571ede-3bbc-432e-a2eb-db32510ed852, d58b5396-3e7b-411b-a4b1-7bc0ad5bf5ca,
  e29aa560-6d2b-4e90-89b6-2f571086d4c4, e2b939de-0338-43f1-9444-c6d218baa8c0, e3bd7ac3-927d-4357-820d-9116c1b5c7c7, ffc80044-4de4-4c7e-9cc5-de3aa4c306b0
```

### domains (13)

```
  09c16593-feb5-43cd-b68b-f8fa3950601f, 1d1fd277-3f6d-4aa3-be78-8d1270961b4e, 38d2919b-7564-4716-a70a-2b45b000092f, 39976002-c267-4452-87dd-36a0b5fb6be8,
  42474d42-f5f5-40a0-9217-aac4740e203c, 4b5f911e-ec09-45b1-8120-24e5d61b9260, 8ba22c39-1e3d-4afa-ae1f-178e9953abe0, 96ae11eb-1df3-4bdb-9c64-0bb967589280,
  9d7a34e1-5c60-4f57-a211-80651a7393b4, a9b880e3-271c-48fe-b3b6-df414a85f06e, b2a48a6a-1b59-42c2-90b6-fb0beb40e6da, ca2d8b53-909b-4b50-b216-75efc8985b56,
  f01c2f86-330a-4553-a33f-12c4ad8a94e5
```

### domain_role_bindings (13)

```
  03fea453-cea3-46f5-a766-834bc5c49d3a, 12df5562-0ed2-4929-891e-36577b1914f8, 268ecc84-8827-4671-93bd-3663930e37b2, 27417e68-c9fb-4441-8938-7cad0623a485,
  41ec6bb1-321b-43ba-bc29-77c01593bcc8, 53ca3636-fd49-4dd3-aa42-353205124e70, 5ed97e80-43df-4582-ac95-e7ba43454f62, 75cfff84-c759-41c2-aef8-4f7582872a9d,
  c3525be4-38f5-4b0f-be68-c28ff95c7584, c7e007d6-5ca7-48e5-9f60-5ab268c626c8, e7997ce3-c049-47cd-ba1a-3537208b6cf8, ef6e008d-cb6d-4d9b-b8a6-c73711db1e84,
  f2d14073-5d69-4abe-91ea-b53707b7740b
```

### global_role_bindings (8)

```
  02ced9fa-5a80-482e-b748-7ef3c2aadd62, 0bff8278-8f72-4700-83af-ac92447ad5d5, 0c4475db-adbf-460a-80ea-023a5b3bdfd5, 577ee7a2-c224-49c0-b83e-09f69ade8420,
  60517727-0702-4e72-9f8d-72d900a88834, 69a2b5a3-064f-4184-9b5d-c9bf9cc97ff1, c376231b-5280-4530-8b87-50e864bd5096, cff5354c-1926-4b07-ad58-7b0185128279
```

### workflow_definitions (13)

```
  5d2aad87-1069-4cc7-91d5-b06b03b33e15, 6e406081-268a-42f0-832a-b3887976999c, 85d22e72-f7f1-4166-b5b7-79deb50ab77e, a4c2ff7a-d17e-466e-a34b-c65f15afec60,
  a5b91e45-3562-4377-b0e7-ea1ca755e8f7, b4670fe4-8506-4fc7-abfe-95c5e7b1d0f9, b59a37c4-9e5f-4323-b419-cd08228ed6ee, bad23466-3444-41aa-89fc-c4d9b018f250,
  bfdc90d0-0c26-4502-b7e4-163aadc03596, c778728f-f2fa-469c-9d39-eb48c4f55944, e1a8c197-c0ed-4750-adc9-44268c20fb68, fc2cb98d-69bb-4172-a69e-0ac33114c73c,
  fe758916-6997-474b-92ce-fee1b0423015
```

### workflow_definition_versions (13)

```
  1e0c5863-23ef-4328-8224-18a6957a9867, 22b8d384-267c-4469-b431-59795c834dd2, 362a2185-e9e8-4ada-a69e-3cf2e43b5f9c, 36c3b015-3578-483b-8c12-40a2186a0527,
  54fe4ed4-7431-4e8f-bfc8-bb0f6a6f3f3f, 7396ac7a-b166-40f2-9f92-48e5ca887638, 85fd994d-f35a-4b0d-8504-7476a8f6e714, 940a085e-1a3f-4a83-9703-70608f0d2289,
  a2bf5360-c3f8-4b77-833b-9439f5a4d1dc, b9d81fa7-d999-4598-8db9-920a64bb866f, d3ae2f95-7fcb-438a-929e-28a67c7ac63e, d4c04e56-4d4e-43e2-bd32-392b59554176,
  ea14d175-a086-4427-8ba7-fe93c9e31ed2
```

### workflow_node_definitions (26)

```
  0af5d7f6-c40b-418f-bad1-fdb308d76006, 12b77177-1ae5-4a11-9587-085953669125, 34e0c08b-3c56-4593-b3b2-3525dd56847b, 39f28ae5-8256-4701-95c7-8bafcdb2e93d,
  49fce116-83cb-4df8-89c5-7a7bcebc693f, 522d2575-01ba-48c6-afd9-2d2d5e4f36b2, 59f87a78-9b72-4e4b-b8b6-35f69506b076, 610c70b3-b4cd-4e94-b841-9a2b78733505,
  66da20bc-65f8-4939-afe3-be6a6efb143c, 6a9341b0-675d-4630-9009-da000c011b50, 811c2c79-2f19-43e4-b7c1-922a723a8c29, 8257b009-f413-4f08-85af-6ca87a60c5ea,
  83dff530-f08d-411e-825f-fe08860f7afd, 887843fe-d810-4353-9d83-79a58b79227d, 8e3de483-614a-46a4-99b3-cef4f8b61036, a92ddb33-5f25-4207-85c1-894f45d8b983,
  afb2d6a7-56b2-424c-8a05-1ab8078898bd, c37c2153-b4b3-4819-a9fd-5878747e546e, cb127c6c-8816-44f8-a5c4-fb3f8ada383b, cb4f0991-329a-48a8-a947-bea07fbfdee0,
  d9edea54-90c2-4106-b8f0-dd8737f82926, dab87fe8-d877-49b5-b0ff-3f2d1cc2d761, dcdbdbb0-d5e6-4325-85eb-f3422aa42a46, dd545ff8-7278-406b-86ae-a5edf288ef04,
  f2f6f77c-2abc-423b-aad0-5944099a7a0d, fda231e3-35f2-4008-bdf1-5820da561b8a
```

### workflow_transition_definitions (13)

```
  0f79f43b-7e5d-4761-956d-4bc46eac3705, 124d09c9-3a6b-40ec-8588-e475f1c3f20b, 2ef05d77-22b4-4f1c-a577-6e6fba2af40b, 3706b7ae-7f41-459b-afea-1d81a92fb953,
  5d1e6b1e-1b99-4043-ac3a-a260cc0bb1b5, 843aaecd-198d-491a-9b18-2162f836b91b, bba2c5c8-7107-4492-9880-35613a0fffd4, bc4d6529-9e7a-4a87-805c-07693d2bfda8,
  c2a542c7-80da-4a4e-9de8-d10f69c2ecbd, c358ce2b-42e1-4e65-bd37-370dd8e0685f, d0c634b7-b49d-4e76-8035-01327e5a792c, d23ad190-29ec-4755-af9c-b1ea68b593c3,
  dd131ce9-9375-467e-87d4-0e7ad3ae73c4
```

### workflow_instances (19)

```
  0da857fb-e2fb-4d94-8b80-e749db28b5bb, 292ad1f2-3ae2-4150-9a45-86981f2e04a7, 4adc82e2-d06c-41ab-a147-48b3756a5bae, 508bd330-5a26-4201-aeb6-6d547a96b5e5,
  5e5b6d30-22ac-4539-bbd4-0a8b4e3dabb3, 67ea5229-8b54-424c-84f1-5fd5607375d1, 6c648a0c-adc6-45c2-8ef1-09459f092f36, 6ed185e2-8a87-4181-841c-16a344a216a2,
  73757057-0c5d-4768-968b-74b3563ccccf, 9cd6f651-24bd-48c3-902e-8e6188fc6f32, a9ee105b-4932-4fc9-bf7e-46a8db5eef4c, c3c4fe13-e7eb-4018-bbe4-c8945bb2aece,
  c751782e-157c-49e8-80c3-e86d207c8896, cc398199-0591-47c2-a3a6-7f29fd33c594, d7ed541c-1802-466f-b132-c1f5bfea7d2a, d9913dac-6c08-48ac-bb5a-aa33c9cc0c34,
  dd812209-afd7-4ea8-bcca-18271a5bc497, f18d704a-8711-4bd4-89ff-9c10dc93316a, fc272b85-e003-4f34-8fce-084cc4474d70
```

### workflow_node_visits (19)

```
  0826c4ed-2c2f-4277-adca-ba944e3ac7f4, 0f4e1880-df11-4656-a4c0-584ec41047f8, 16ed7dc5-c823-4e0b-8027-4de4c2c52d65, 24245304-2db9-47ff-9565-4cd3dd7e0ac4,
  4c3f143a-9604-42ce-9889-32c0af407406, 7ccd1993-4248-4a2f-bf32-bf63077e5f13, 7e2093eb-d26c-4f51-ae82-166d1c999482, 83325f65-d762-4fe6-86bd-73b6982332a2,
  92bf0f4c-c3a0-4886-9380-68967a3438a1, a0552355-63dc-4a20-b1ec-13f8eb35fe93, a43011d7-4dc4-4fd3-8cc1-11fdcbe8f9b2, c6641274-b4e7-4635-811a-c1ce7a6810d7,
  c8857a13-f325-4b50-ad54-932b24fbdf4d, d6196b05-1ff1-42b1-acb3-1967e02e8de3, d74375b1-6827-4e53-acc8-4e5937b53698, dab7a91b-b94c-442f-b2ed-29faf4d93f44,
  ea05edba-fb37-45c9-a58e-022aed90f45b, ed736fd8-67c8-406d-aa6e-1a2b8b42f1a2, f94234b0-f4fe-4525-aca5-a5f323408438
```

### workflow_context_revisions (19)

```
  214bf1cf-1baa-45f1-b29a-cfd185b04708, 29264522-cc28-4619-a364-6f52e910b8e9, 4eaceb23-77ee-4c04-9a5f-b764404604d9, 50a39ba8-0d0f-4c6f-b0b4-6a4939dadaaf,
  5b0b3b09-04ea-419f-a66b-8b595826ac6e, 67a4e2ca-df44-4525-9332-9450b3767213, 750cde8f-6ecc-4600-8e43-e7a5c63a3b41, 758f2a5e-c189-4411-9a09-ee075cc77c45,
  7d809ef4-ae79-4712-bf31-99eded671764, 90e816ef-fa7a-4399-9cc4-14b668d82a08, 93f18403-fd3f-4b26-9302-902dcbf38cd7, 963cc4f1-2cd5-4042-b3b9-341fe9cdf1da,
  a6474db7-5ee2-4a88-9ca6-3ad505696e2a, a665001a-470d-4e1a-97dc-8b2105912ccb, b0093436-0e89-4841-9087-f4e427de550b, bfc377d3-a3d1-45db-971b-f93ed5968cce,
  d5317d07-582d-4e4e-8068-ca2a4d6e83f4, d9f3e43a-9efd-45e4-b09d-31b50dc9a9b0, ec79b28b-af90-47cb-85dc-505d3636b412
```

### workflow_events (19)

```
  056c1e10-b939-479a-8e2f-8dbdeefe1a75, 26f494d5-fee2-4ebe-bbef-c38d31509885, 272990ca-b7f1-4cd5-b810-78b3a4b525ed, 2b48eccc-b648-4cd9-bf71-4786c5cd2fec,
  50df2f57-7718-4819-8676-5b1be4a59845, 566bf9ad-d016-47b5-971f-6032c7cfd90a, 71fd6e64-d81b-45d2-b06c-cb6258121cb0, 7619241d-6316-4512-a3bb-660de1f7ded3,
  7853ce4d-6264-4978-b464-2298d1229fad, 80cdde98-5992-4d5f-bbaf-509b6cf8ff93, 9674b2ec-c4f4-4e90-9806-d9f3e1393fe8, 9d3ea94a-c507-4ea3-80e2-af031f9a1ddf,
  bca454f1-3a1b-4595-b4cc-67f4edc5510d, c59d74dd-8cc6-49b7-9520-f3bf8998229a, cad834da-5cb7-4efb-9127-4354f8417430, e9b4e148-5e82-4380-9d76-adeea52685ff,
  f7aa34ab-daf4-4150-8cab-12cc1c2c4863, f843cb32-9dbf-40e1-a9a1-f1f3675371b4, fd6a4f04-7aa1-4bb0-9369-0f33bb68c7d5
```

### workflow_command_receipts (25)

```
  0bc95d31-dca8-4a71-bbb5-2c61334ba848, 156d0713-97b6-4b3f-8e7c-955b5acdc41c, 1fe6a96a-ebdb-42bb-9d54-72f609d8ca46, 25249e93-21a7-4c00-94f3-cbd332ea2dad,
  27f1b1f0-4cad-45f9-a407-bfe6eab52aa7, 2aff9e4b-6e17-4466-aa87-e979e52cee25, 2fe5c85e-452f-462f-af90-5008e7f40012, 3b6dded6-d5e0-440d-9d14-af6ecbd415f5,
  474d63b7-5136-4b15-8b90-e8a03714daac, 4f2b9c0c-ac03-44d6-92a8-5adc6d645ce8, 78e97bb6-6c90-4786-8686-6db179a3fe63, 87688a81-7911-49e6-86fc-19f0be033f47,
  957d9d84-f735-4654-8471-59a0da8d33c7, 9924292a-5fcc-45f5-bcc7-9f5387077879, a066d1c3-5f7e-46e3-85c1-bf55c5ef09f6, b172257a-8898-40ce-b69f-80c828d21f1f,
  b1f05f5a-e5a2-4575-b73d-ca269a0294c1, b8a3aebb-83a3-4ac3-a360-4b675c57cb3f, bb9f2974-0635-4c4d-a43d-aeb6d1ca2240, d45df76f-0a03-4e89-ace9-8583673eff25,
  dbc87a56-14f0-4c3d-a4bc-84cfa31132a7, de696711-7109-4fe2-ad7b-3b436fbec0fb, e102b54a-fb2f-4ebf-a83b-423c14be1895, effd58a5-618b-4d84-b67d-8430039c0cf2,
  f98df7ff-44a2-429d-9985-df95690af7ed
```
