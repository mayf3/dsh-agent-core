# SVC Workflow Deploy — f0c74ee Reader Runner V2 — Focused Audit V1

> TASK_NAME = 部署 审计（2026-08-30）
> AUDIT_TARGET = `/tmp/run-svc-workflow-deploy-f0c74ee-v2.sh`
> EXPECTED_SHA256 = `e83f52afeb49809590110464fb4f29b8ace4847a1563bf630fac17e7dd9a92b0`
> VERDICT = **PASS**；READY_FOR_OWNER_RUN = **YES**
> EVIDENCE = `docs/evidence/svc-workflow-deploy-f0c74ee-reader-v2-audit-20260830/`（含 MANIFEST sha256）

## 0. DEVELOPMENT_PREFLIGHT

- **Governing authority**：Owner mandate「部署 审计」；被审对象的行为授权 = 生产侧
  accepted spec `mayf3/svc-workflow SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1`（grantee 1 =
  `dc702687-6515-4a2a-91ae-e572a9bbd766` / GLOBAL_WORKFLOW_READER，legacy
  `bc970ced-710f-4479-9ff0-e295a1c59424` byte-unmodified）。v1 runner 的准备与全部
  生产基线事实已由 `docs/reports/svc-workflow-deploy-f0c74ee-reader-v1.md`
  （commit 6a30fa3，同日）落档；本轮审计对象为其 focused amendment（v2）。
- **This-repo scope**：docs-only（1 报告 + 1 evidence dir）。无代码改动、无 Spec 变更。
- **Boundaries（本轮）**：**不执行生产**——runner 全程未被执行（连 PREFLIGHT_ONLY 也未
  运行）；生产访问仅限只读 HTTP GET（/version /healthz /readyz）与文件 sha 读取；
  零 DB 连接、ZERO sudo、`~/.local/services/**` 零写入。

## 1. 输入封存（seal）

- v2 runner 43201 B，729 行，sha256 `e83f52af…a92b0` **== EXPECTED_SHA256**（轮始比对；
  轮末复验仍相同——审计期间未被修改）。
- v1 → v2 diff 全文封存于 evidence（425 diff 行）；v1 本体
  （`dfcd2570…8e92`，619 行）仍在 `/tmp` 原位未动。

## 2. v1 → v2 变更本质（diff hunk 逐项核对）

v2 = v1 + **恰好两项 focused amendment**（与文件头声明一致，无其他语义漂移）：

1. **P4 Reader 状态分类状态机**（v1 只有 absent-or-refuse + 单一 ALREADY_APPLIED 判定）：
   - `absent`（grantee 零行、reader 零行、总数==6）→ APPLY_NEEDED，rollback mode
     `DELETE_INSERTED`；
   - `exact disabled`（grantee 恰 1 行=disabled reader、总数==7、disabled_at hex 快照）→
     APPLY_NEEDED，rollback mode `RESTORE_DISABLED`（复用既有 binding_id）；
   - `exact enabled` + 服务已在 MAIN_COMMIT 且健康 → ALREADY_APPLIED（exit 0 零写入）；
   - 其余一切形状（含 enabled+disabled 并存、多行、count 不符、baseline 漂移、
     grantee 持 COORDINATOR、目标二进制已部署但 reader absent/disabled 等）→
     CONFLICT 零写入 exit 2。
2. **统一 ERR/EXIT rollback trap**：`set -Eeuo pipefail`（-E = errtrace）；在调用
   `release.sh deploy`（第一条可变更生产的命令）**之前** `arm_unified_rollback_traps`，
   同时挂 ERR 与 EXIT trap；仅在 success ledger append 之后
   （`SUCCESS_COMMITTED=1` + `trap - ERR EXIT`）解除；期间任何失败——显式
   `fail_and_rollback`、意外 shell 错误、乃至 commit 成功但输出捕获失败——都进入同一个
   `fail_and_rollback` 入口。配套：`GRANT_WRITE_ATTEMPTED=1` 在 psql **之前**置位
   （关闭 v1 的 commit-后捕获失败无回滚窗口）；`Rb3` rollback ledger 记录由 v1 的
   `|| true` 改为**完成性必需**；Rb1 回滚 SQL 按 mode 分派（DELETE 插入行 /
   UPDATE 恢复 enabled=false + 原 disabled_at hex），并按**含 disabled_at 列**的
   pre-write 快照 digest 在同一事务内复证。

机械性更新（v1→v2 命名、日志前缀、`DEPLOY_INSTALLED`→`DEPLOY_ATTEMPTED`、
FAILED_BEFORE_INSTALL 分支并入统一回滚）均随上述两项自洽。seals/P1/P2/P3/G0/R1 授权 SQL/
R2 终验/exit code 语义与 v1（已经独立验证）保持不变。

## 3. 重点审计项逐项结论

### 3.1 enabled=false Reader 不误判 ALREADY_APPLIED — **PASS**

ALREADY_APPLIED 分支（v2 :533-545）要求 `grantee_reader_enabled=1` **且**
`grantee_reader_disabled=0` **且** `grantee_rows=1`/`reader_rows=1`/总数==7 **且**
服务 `/version.gitSha==MAIN_COMMIT` 且 healthz/readyz==200，四组条件缺一即零写入。
disabled reader（enabled=0, disabled=1）只能落入第三分支 = **APPLY_NEEDED**
（`RESTORE_DISABLED`），且若目标二进制已部署（`ALREADY_DEPLOYED=1`）则直接 CONFLICT
零写入。分类矩阵 C02（disabled@prod → APPLY_REENABLE）、C04（disabled@target →
CONFLICT）独立复跑通过。**不存在任何 disabled 判为 ALREADY_APPLIED 的路径。**

### 3.2 最终 Reader 必须 enabled=true — **PASS**

R1 upsert 恒为 `enabled=true, disabled_at=NULL`（与 store 层
`upsert_global_role_binding` enabled=true 分支逐字等价，见 §3.6）；事务内断言
"reader row not exactly-1 enabled" 即 RAISE 回滚；R2 fresh read-only 会话
`reader=1` 仅统计 `AND enabled` 行（失败文案即 "reader row not enabled"）；
SUCCESS 日志显式 `enabled=true`。ALREADY_APPLIED 分支同样以 enabled=1 为前提。

### 3.3 第一次写入后任何失败进入统一 rollback — **PASS**

- trap 在 `bash $RELEASE_SH deploy` 之前武装（:583-585），成功 ledger append 之后才解除
  （:723-725），期间从不收窄；
- ERR trap（errtrace 生效）覆盖意外失败：最关键的是 R1 输出捕获失败（v1 缺口）——
  `GRANT_WRITE_ATTEMPTED=1` 先于 psql 置位，COMMIT 成功而捕获/解析失败时 trap 精确知道
  按何 mode 恢复 pre-write 状态；
- EXIT trap 覆盖非 ERR 退出（`if` 条件抑制 ERR 的路径由显式 else 分支处理）；
  `ROLLBACK_RUNNING` + 入口 `trap - ERR EXIT` 双保险防递归；
- 全部显式失败路径（D1/D2/R1/R2/ledger 共 23 处 needle，见矩阵 R01-R23）调同一
  `fail_and_rollback`；`reconcile_deploy_state` 在 ERR 猜不到的时点重找 backup dir，
  Rb2 在无 backup 时接受"旧 sha 原样未动"作为等价恢复。
- 残余缺口仅剩不可捕获信号（SIGKILL 必然；未 trap 的 SIGINT/SIGTERM，即 Owner 运行中
  Ctrl+C）——shell 固有限制，v1 同样存在且本轮任务焦点未含；此类中断后的 rerun 仍
  fail-closed（CONFLICT 零写入或 ALREADY_APPLIED），见 O-1。

### 3.4 rollback 不完整不得宣称成功 — **PASS**

`fail_and_rollback` 要求 **5/5** 检查位（GRANT_STATE_RESTORED、BINARY_MIGRATIONS_RESTORED、
RESTART_EXECUTED、OLD_SERVICE_HEALTHY、**ROLLBACK_LEDGER_APPENDED**）全为 1 才输出
`FAILED_AND_ROLLED_BACK`（exit 1）；任一缺失 → `ROLLBACK_INCOMPLETE; UNRESTORED_STATE:`
+ 具名条目（exit 4）。Rb3 由 `|| true` 改为必需项是 v2 的正确收紧。SUCCESS 字样仅在
`SUCCESS_COMMITTED=1`、trap 解除之后出现；两处提前 exit 0（ALREADY_APPLIED /
PREFLIGHT_ONLY）都在 trap 武装之前。

### 3.5 target commit = f0c74eefd63ca71a1fcb670ad31ac35f19f69539 — **PASS**

sealed pin :115；P1 要求 `refs/remotes/github/main == MAIN_COMMIT`（无漂移）+
READER_COMMIT `9e58599c…` 与 FIX_RETURN_COMMIT `dede1f3c…` ancestry + §4 内容 grep；
D2/R2 终验 `/version.gitSha == MAIN_COMMIT`。本轮实测 svc-workflow 仓中该 commit 可解析，
migration 0020 与 provisioning_repository 内容与 pin 一致。

### 3.6 HR 只获 GLOBAL_WORKFLOW_READER、不获 Coordinator — **PASS**

全脚本唯一写路径 = R1 单事务：`INSERT … VALUES ('$BINDING_ID','$GRANTEE','GLOBAL_WORKFLOW_READER',true)
ON CONFLICT (principal_id, role_key) DO UPDATE SET enabled=true, disabled_at=NULL`。
与 f0c74ee 的 store 层 `upsert_global_role_binding` 比对：principal 存在且 enabled 的
前置检查（store: `SELECT enabled … FOR UPDATE`；runner: 事务内 `IF NOT EXISTS … AND enabled
RAISE`）、enabled=true 分支的 SET 子句（store `CASE WHEN $4 THEN NULL ELSE now() END` 在
$4=true 时归约为 `NULL`）**语义逐字等价**；`ON CONFLICT (principal_id, role_key)` 依赖的
唯一索引 `idx_grb_principal_role` 在 migration 0020 确实存在。`ROLE_COORD` 常量只出现在
**读侧断言**（P4/R1/R2 三处 coordinator count==0 + grantee_total==1），无任何写路径引用。

### 3.7 legacy principal 不变 — **PASS**

LEGACY pin `bc970ced…`；P4 断言 legacy principal 行存在 + non-grantee 基线恰 6 行
digest `94d8249c…`（legacy 的 COORDINATOR 行在基线内 byte-pinned）；R1 事务内复证
non-grantee digest==基线；R2 终验 non_grantee_count=6 + digest==基线 +
`legacy_coord=1`（legacy 既有 coordinator 行原样在位）+ principals 全表 digest ==
pre-write 快照。v1 轮实测基线事实（6 行/232 principals/4518 receipts）今日只读复核
/version·binary·ledger 无漂移。

### 3.8 sandbox 46/46 — **PASS（独立复跑）**

- 本审计独立重跑 `/tmp/test-svc-workflow-deploy-f0c74ee-v2-matrix.sh`：
  **46/46 PASS**（C01-C23 分类 + R01-R23 统一回滚路由；transcript 封存）。
- 分类模型与 runner 实际谓词**逐字段一致**（deployed↔ALREADY_DEPLOYED、
  total/enabled/disabled↔grantee_reader_*、grows↔grantee_rows、rrows↔reader_rows、
  allcount↔SNAP_GRB_COUNT、coord↔grantee_coord、baseline_ok↔non-grantee pins），
  23 个场景含全部歧形（双 reader 行、enabled+disabled 并存、count 错位、其他 principal
  的 reader、baseline 漂移）均 CONFLICT。
- 覆盖性质说明（非阻塞，见 O-2）：v2 矩阵 = 分类模型 + trap 机制 sandbox（合成子 shell +
  源码 needle grep），非 v1 的 S1-S7 端到端容器矩阵；v2 新增的 RESTORE_DISABLED 回滚 SQL
  与 disabled_at hex 往返未在真实 DB 上端到端执行。缓解：Rb1 在**同一事务内**按含
  disabled_at 的 pre-write 快照 digest 复证——任何往返异常（含会话时区假设失效）都会
  RAISE → ROLLBACK_INCOMPLETE（exit 4）fail-closed，不存在 fail-open 面。Postgres
  datetime 输出→解析往返精确，且快照与回滚会话同进程同 TZ 环境。

## 4. 静态安全扫描 — 全部 PASS

sudo 仅出现在注释/拒绝文案；唯一 URL `http://127.0.0.1:8989`；launchd 仅
`print` + `kickstart -k`（label-scoped `com.svc-workflow`，与 release.sh 自身一致）；
`kill` 仅 `kill -0`；`rm -rf` 仅 `$SERVICE_DIR/migrations`（备份恢复路径）；无
eval/base64/chmod/chown/ssh/scp；`bash -n` 语法通过；`psql_rw` 仅两处调用
（R1 grant、Rb1 回滚），P4/R2 均 `BEGIN TRANSACTION READ ONLY`。

## 5. 现场事实（本轮只读实测，2026-08-30）

`/version` = 91fc4e40… clean 0022（== PROD_SHA pin）；healthz/readyz 200；
live binary sha = 1e3fa45c…（== PROD_ARTIFACT_SHA256）；release artifact sha =
4e633634…（== ARTIFACT_SHA256）；ledger 末条 artifactSha256 == live binary。
runner 的 P2/P3 pins 全部 live-valid——Owner 运行时不会因基线漂移被误拒。

## 6. Non-blocking observations

- **O-1（信号缺口）**：未 trap 的 SIGINT/SIGTERM（Owner 运行中 Ctrl+C）在写入开始后
  会绕过 ERR/EXIT trap，留下无自动回滚的部分状态。shell 固有限制，v1 相同；中断后
  rerun 分类 fail-closed（CONFLICT 零写入 / ALREADY_APPLIED），不会盲目重写。
  建议 Owner 在 D1 之后避免中断运行。
- **O-2（矩阵深度）**：见 §3.8 覆盖性质说明。若未来再触碰回滚引擎，建议为
  RESTORE_DISABLED 路径补一次端到端容器演练（含 disabled_at 非 NULL 的往返）。
- **O-3（确认短语版本）**：CONFIRM_PHRASE 仍为
  `APPLY SVC_WORKFLOW_DEPLOY_F0C74EE_READER_V1`（v1 字样）——它指向冻结 spec
  （SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1 的部署授权）而非 runner 版本，属有意沿用；
  Owner 按脚本提示原样输入即可。
- **O-4（歧形报错文案）**：理论上多行歧形会在 P4 会话层以通用
  "P4 read-only session failed"（exit 2 零写入）而非形状专属 CONFLICT 文案呈现；
  因 `idx_grb_principal_role` 使 (principal, role) 重复不可能，实际不可达，纯文案问题。

## 7. 边界（本轮）

- **docs-only**：1 报告 + 1 evidence dir（6 文件含 MANIFEST sha256）。`v1-to-v2.diff`
  按先例做了行尾空白规范化（继承自封存 v2 runner 的空格空行；复现命令
  `diff v1 v2 | sed -E 's/[[:space:]]+$//'` 与工件 byte-identical，已在 MANIFEST 记录；
  权威 fidelity 以两个 runner 的封存 sha256 为准）。
- **零生产执行**：v2 runner 与 v1 runner 均未运行（连 PREFLIGHT_ONLY 亦未运行）；
  生产访问 = 3 个只读 HTTP GET + 文件 sha 读取 + ledger 读取；零 DB 连接。
- **ZERO sudo**；`/Users/authsvc/**`、mapping、credential、`~/.local/services/**` 零写入；
  svc-workflow 仓只读（git show / cat）；审计 scratch（/tmp diff 文本、提取的 mod.rs）
  已清理；matrix 复跑产生的 /tmp marker 文件为 harness 自身产物，保留原状。
- 既有 WIP（broker 修改 + 未跟踪 docs）原样未动；本轮新增文件显式逐一路径 stage，
  未携带任何并发会话文件。

## 8. 最终字段

- 部署 审计 = **PASS**
- READY_FOR_OWNER_RUN = **YES**
- RUNNER = `/tmp/run-svc-workflow-deploy-f0c74ee-v2.sh`
- RUNNER_SHA256 = `e83f52afeb49809590110464fb4f29b8ace4847a1563bf630fac17e7dd9a92b0`（轮始==轮末）
- TARGET_COMMIT = `f0c74eefd63ca71a1fcb670ad31ac35f19f69539`（== pin）
- OWNER_COMMAND = `bash /tmp/run-svc-workflow-deploy-f0c74ee-v2.sh`（无参数 + 交互短语
  `APPLY SVC_WORKFLOW_DEPLOY_F0C74EE_READER_V1`）
- PREFLIGHT_ONLY = `SVC_WF_DEPLOY_PREFLIGHT_ONLY=1 bash /tmp/run-svc-workflow-deploy-f0c74ee-v2.sh`
- SANDBOX_MATRIX = 46/46 PASS（独立复跑）
- BLOCKERS = NONE；PRODUCTION_CHANGE = NONE
