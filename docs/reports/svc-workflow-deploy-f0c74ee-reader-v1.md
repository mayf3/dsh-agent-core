# SVC Workflow Deploy — f0c74ee + GLOBAL_WORKFLOW_READER (grantee 1) — Runner Preparation V1

> TASK_NAME = 部署 执行（2026-08-30）
> DELIVERABLE = single Owner deployment runner（本轮**只准备 runner，不执行生产**）
> EVIDENCE = `docs/evidence/svc-workflow-deploy-f0c74ee-reader-v1/`（含 MANIFEST sha256）

## 0. DEVELOPMENT_PREFLIGHT

- **Governing authority**：本任务本身（Owner mandate「部署 执行」）是生产 apply 的授权载体；
  生产侧规范 `mayf3/svc-workflow SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1`（accepted,
  merged PR #14/#15）——§4 服务端代码闭包已实现并 merged（PR #15 @ `9e58599c`，位于
  f0c74ee 内）；§6 grant plan（grantee 1 = `dc702687-6515-4a2a-91ae-e572a9bbd766` /
  GLOBAL_WORKFLOW_READER）明确"role apply 仍需单独 owner 授权"，本任务即该授权。
- **This-repo scope**：docs-only（1 报告 + 1 evidence dir）。artifact 模型由
  `docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md`（accepted）治理；与既往
  swimlane（fixture cleanup / CTO recovery）同构。**无代码改动、无新 Spec 需求**。
- **Boundaries（本准备轮）**：不执行生产 deploy、不 grant、不 restart；
  生产访问全部只读（curl /version·healthz·readyz、git 只读、DB read-only transaction、
  pg_dump data-only of 3 tables）；ZERO sudo。

## 1. 生产当前状态与 main 差异（全部实测）

| 项 | 值 | 证明方式 |
|---|---|---|
| 运行中 source | `91fc4e40f400ee9cc17351f857a1ab2860682681` | `GET /version` gitSha；on-disk binary
  sha256 `1e3fa45c…` == `ledger.json` 末条 artifactSha256 |
| GitHub main | `f0c74eefd63ca71a1fcb670ad31ac35f19f69539`（PR #17 merge） | `refs/remotes/github/main` 解析一致 |
| READER impl | `9e58599c477fee8b599d2a797f7f85b4c446b460`（PR #15）⊂ f0c74ee | `merge-base --is-ancestor` |
| return-422 fix | `dede1f3c73209b01ce02c864b3f0e9d2736cd58d`（PR #17）⊂ f0c74ee | `merge-base --is-ancestor` |
| schemaVersion | 0022（DB `_sqlx_migrations` max=22）| `SELECT` + /version |
| migrations diff | prod(91fc4e4) ↔ main(f0c74ee) **空**（22 文件逐字节）| `git diff --stat -- migrations/` |
| src/ diff (prod→main) | 全部单向：reader 特性（query_service/query_types/
  query_visibility/global_role_bindings 小改）+ error.rs `global_read_role_required` +
  tests + 新增 trusted_fleet/event_replay 文件 | `git diff --numstat 91fc4e4 f0c74ee` |
| §4 内容 | 三个关键点均在 f0c74ee 逐字出现（见 runner P1 gates）| `git show` + grep |

**main 是生产源码的严格超集**；部署 main 不会删除任何已部署功能；migrations 无变化
（0022 == 0022），部署为纯代码行变更。

## 2. 构建（本轮完成，仅写入 releases/ 目录）

经官方唯一入口 `scripts/release.sh build`（clean detached worktree @ f0c74ee，
`cargo build --release --locked`）：

- artifact：`releases/f0c74eefd63ca71a1fcb670ad31ac35f19f69539/svc-workflow`
- `artifactSha256 = 4e633634b313f8c926ccaf7da07f3bfd9dbf25f024a4b63a3f0a88c5a0200356`
- `migrationBundleDigest = 76b89716188a52b4d3bafa378963dbc04a2a57cb42ff1d085ccb0296f2b1987d`
  （max 0022；与 live 部署目录 diff -r 逐字节一致）
- `provenance.json`：treeState clean，buildCommand 记录完整

> 注：ledger 历史上对同一 22 文件 bundle 记录的 digest 是 `80472b34…`，而今日
> 同一 `release.sh` 在同一目录上新计算为 `76b89716…`；per-file sha256 全部一致
> （diff -r 字节零差异），推测为 8 月部署时 PATH 中的 shasum 解析差异。runner 不依赖
> 该历史值（逐文件与 git blob 比对，对工具行为免疫）。

## 3. DB 基线（read-only 实测，2026-08-30）

- DB：`svc_workflow_dogfood_clean` @ 127.0.0.1:5432（user `svc_wf`，DSN 形状已 pin）
- `global_role_bindings`：**恰 6 行**（5 个 enabled GLOBAL_WORKFLOW_COORDINATOR +
  1 个 disabled），digest `94d8249cb24587ac75bb3d46c8ddefdb`；
  **zero** GLOBAL_WORKFLOW_READER rows；**zero** rows for grantee `dc702687…`
- principals：232 行；grantee = `HR助手`/AGENT/enabled；legacy `bc970ced…`
  = `agent-bc970ced`/AGENT/enabled（且持有 08-11 起 enabled COORDINATOR 行——保持不变）
- receipts：4518 行；`command_type LIKE '%global%'` = **0** → 既有 6 条 global
  binding 均为直接 SQL 写入（runner 采用 SQL grant 路径的生产先例，见 §5）
- schema_migrations：max 22（0022）

## 4. Runner 设计概要（/tmp/run-svc-workflow-deploy-f0c74ee-v1.sh）

单一 Owner runner，声明式 pins + fail-closed gates + 原子语义 + 全自动回滚：

```
G0 identity/args      仅 yanfenma(502) 非 sudo；无参数；交互 exact phrase
                       APPLY SVC_WORKFLOW_DEPLOY_F0C74EE_READER_V1
P1 git authority      repo realpath pin；MAIN_COMMIT resolves；github/main==MAIN；
                       READER/FIX ancestry；§4 三处内容逐字比对
P2 production state   /version==prod pin(或已部署 main → P4 幂等分支)，healthz/readyz
                       200，binary/ledger sha 一致，old pid
P3 artifact           provenance 全字段 pin；artifact sha；22 个 bundle .sql 逐文件
                       与 git blob 比对；bundle digest 重算比对
P4 DB preflight (RO)  库名 in-tx pin；migmax 22；grantee AGENT/enabled；legacy 存在；
                       6 行 baseline 参数 pin；无 READER rows；grantee 零 rows；
                       principals digest + receipts 计数快照；
                       ALREADY_APPLIED 幂等短路（精确重跑 → 验证后 exit 0）
D1 deploy             bash scripts/release.sh deploy MAIN（官方唯一入口：备份→安装
                       binary+migrations→ledger→kickstart）；捕获新备份目录
D2 deploy verify      /version==MAIN+clean+0022；healthz AND readyz==200；new pid≠old；
                       old pid 死亡；on-disk sha==artifact
R1 grant (1 tx)       store-layer exact upsert（principal-enabled 前置 + INSERT ...
                       ON CONFLICT DO UPDATE + 4 项 in-tx 校验：reader enabled、
                       coordinator absent、count==7、baseline digest 不变）→ COMMIT；
                       记录真实 binding_id
R2 final verify (RO)  reader==1；coord==0；grantee 恰 1 行；6 baseline 行 digest 不变；
                       legacy coordinator 行仍在；principals digest==快照；receipts
                       append-only；healthz/readyz 200；/version==MAIN；
                       ledger append-only 成功记录
ROLLBACK (任何 writes 后失败)
  Rb1  DELETE 精确 binding_id；同 tx 内重证 6 行 + digest==pin
  Rb2  备份 binary+migrations 还原；kickstart；等 /version==PROD_SHA + 健康
  Rb3  ledger append-only rollback 记录
  退出码：0 成功/已应用；1 FAILED_AND_ROLLED_BACK；2 拒绝(零写)；4 ROLLBACK_INCOMPLETE
```

安全属性：无 sudo（服务/文件/launchd gui domain 均属 yanfenma）；DB 密码仅 PGPASSWORD 环境；
唯一 URL `http://127.0.0.1:8989/…`；唯一 launchd label `gui/502/com.svc-workflow`
（print + kickstart -k，与 release.sh 同型）；kill 仅 `-0`；`rm -rf` 仅
`$SERVICE_DIR/migrations`（镜像 release.sh）；ledger append-only。

**SQL grant 路径说明（对规范 §6 API 草图的记录性偏差）**：`SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1`
§6 将 apply 描述为 admin-API PUT，需一台本机不存在的 workflow.admin provisioning 凭据
（`~/.openclaw/credentials/` 为空，实测）；6/6 现有生产 global binding 均为直接 SQL、
receipts 表中 0 条 global-role 记录 → 直接 SQL 是生产先例。runner 执行 store layer 的
逐字 upsert SQL 语义（`provisioning_repository/mod.rs @ f0c74ee`），终态与 API 路径一致
（仅少一条 receipt 行，与 6 条现有 binding 完全一致）。

## 5. 验证（零生产变更）

1. **Live PREFLIGHT（生产，只读）**：G0→P4 全绿（P1 git authority、P2 生产态、
   P3 artifact 22 文件逐字节、P4 baseline），`RESULT: PREFLIGHT_ONLY PASSED; WRITES=NONE`；
   （re-verified 在最终 runner sha 上）
2. **Real-DB grant SQL dryrun**：与 runner R1 逐字相同的 SQL 在真实生产 DB 上
   `BEGIN → INSERT → 4 项 in-tx 校验 → ROLLBACK`；psql rc=0；
   pre==post（6|`94d8249c…`）逐字节一致。
3. **Real-DB rollback SQL dryrun**：同 tx 内 INSERT→DELETE→baseline 重证→ROLLBACK；rc=0；
   pre==post 一致。
4. **二进制 boot smoke**：真实 f0c74ee artifact 以 disposable DB 运行 `--migrate`：
   22 个 migrations 全部 apply（schema 完整），随后 seed 生产数据副本
   （principals 232 / grb 6 / receipts 4518，digest==pin）——artifact 非 DOA。
5. **Sandbox matrix（TESTVARIANT）**：一次性 Docker postgres:16.14-alpine（名一致
   `svc_workflow_dogfood_clean`）+ 真实 build 产物 + sandbox SERVICE_DIR + stub HTTP
   服务（/version·healthz·readyz 由真实 installed binary sha 驱动）+ 打补丁的
   release.sh（仅 REPO_ROOT pin + kickstart 中和，2 hunks）+ 6 处文档化 TESTVARIANT
   单行 patch（SERVICE_DIR/BASE_URL/RELEASE_SH/restart/service_pid/D1 env）。
   **46/46 PASS**：
   - S4 baseline drift → P4 zero-write 拒绝（exit 2，binary/backup/DB 未动）
   - S5 grant SQL 失败（drop unique index）→ 部署后失败 → 全量回滚（exit 1，4/4
     ROLLBACK_CHECK，ledger rollback 记录）
   - S6 回滚后仍不健康 → ROLLBACK_INCOMPLETE（exit 4，UNRESTORED_STATE 具名）
   - S3 /version 永不翻转 → 90s 超时 → 回滚（exit 1）
   - S2 新 binary 不健康（healthz 500）→ 回滚 → 旧服务恢复健康（exit 1）
   - S1 全链路成功：deployed main、reader enabled、coordinator absent、legacy+baseline
     不变、ledger 记录、备份目录含旧 binary（exit 0）
   - S7 幂等重跑 → ALREADY_APPLIED，零写入（exit 0）
   - 生产不变式：真实 binary/grb digest/服务 pid 1687/ledger 12 行 全部未动
6. **静态扫描**：bash3.2 语法 OK；`sudo` 仅 3 处为拒绝文案/注释；无 chown/eval/
   base64/ssh/scp/kill -9；URL 唯一；`rm -rf` 唯一且 pin 域内。

## 6. 边界与残留（non-blocking observations）

- API 路径凭据缺失（§5 记因）；SQL 路径与 store-layer 语义逐字一致并具生产先例。
- ledger 历史 digest 与今日工具重算值不同（§2 注）：per-file 已证一致，历史值不参与
  runner 判定。
- `AGENT_CORE_HR_DISPATCHER_V1`（dsh-agent-core，proposed）的 G2 门槛引用本部署的
  grantee 1；dispatcher grantee 2 仍需 auth identity 与 amendment 回填——本轮不碰。
- 准备轮遗留 `/tmp/run-svc-workflow-deploy-f0c74ee-v1.sh`（sealed）；`/tmp/*` 与
  docker 容器清理见 §7 记录。
- prod `svc_workflow_dogfood_clean` 中 4518 receipts 不涉及 global role（0 条），
  无既有 API 滥用迹象。

## 7. 清理

- Docker 容器 `svc-wf-deploy-sbx`（port 5433）已删除；stub server 已停止；
  `/tmp/svc-wf-deploy-sbx/` 与方证各 harness /tmp 文件删除。
- `/tmp/run-svc-workflow-deploy-f0c74ee-v1.sh` 保留（Owner 执行物），字节与
  evidence 内副本一致（cmp 通过）。

## 8. 输出

```
DEPLOY_RUNNER     = /tmp/run-svc-workflow-deploy-f0c74ee-v1.sh
DEPLOY_RUNNER_SHA256 = dfcd25707d7260f7d2b8e83aa31f37f2964e3c7e74a8a48a32e01722d4128e92
OWNER_COMMAND     = bash /tmp/run-svc-workflow-deploy-f0c74ee-v1.sh   (interactive confirmation phrase; NO sudo)
PREFLIGHT_ONLY    = SVC_WF_DEPLOY_PREFLIGHT_ONLY=1 bash /tmp/run-svc-workflow-deploy-f0c74ee-v1.sh
ARTIFACT_SHA256   = 4e633634b313f8c926ccaf7da07f3bfd9dbf25f024a4b63a3f0a88c5a0200356 (f0c74ee, clean)
READY_FOR_OWNER_RUN = YES
PRODUCTION_CHANGE = NONE
```