# AGENT_CORE_DEPLOY_9BB5B97_RUNNER_AUDIT_V1

TASK_NAME = 接入 审计（DEPLOY_RUNNER_REVIEW）
Date: 2026-08-30
Runner: `/tmp/run-agent-core-deploy-9bb5b97-v1.sh`（401 行）
RUNNER_SHA256 = `181c35d4741255f391235d0f8a5ea88e2d47a375d9d90333ddd572bcd4ad5ece`（== EXPECTED，审计开始与结束两次核对一致）
TARGET_COMMIT = `9bb5b97442c7155da36f06e867d1a655410544ac`（= 审计时 github/main = PR #114 merge commit）
本审计仅运行 `--check`（read-only，rc=0）；**--apply 未执行，生产零改动**（结尾 spot check：live workflow.js 仍为 BASE blob `289a76c`，131 文件）。

VERDICT = **PASS**；READY_FOR_OWNER_RUN = **YES**（附 2 项非阻断发现，见下）。

Evidence: `docs/evidence/agent-core-deploy-9bb5b97-runner-audit-20260830/`（7 files + MANIFEST sha256）。

---

## 重点确认逐项

1. **生产→目标增量恰好 6 文件 — 数学证明**。以 runner 同算法独立复算 live 树 manifest =
   **131 文件 / digest `15793b0e…`**（== BASE_MANIFEST_SHA256 精确匹配，live 树全局可读、
   非只读不可写的独立复算）；将 BASE manifest 做**恰好 5 个 OID 替换 + 1 行 canary 插入**
   （path 排序位）后 digest = **132 文件 / `6ea0b614…`**（== TARGET_MANIFEST_SHA256 精确匹配）。
   两 pin 之间只有这 6 行之差 ⇒ 增量恰好 6 文件，且**其余 126 文件零漂移**（任一其他文件
   若有差异，派生 digest 不可能命中 pin）。
2. **5 文件来源 — 任务陈述需更正（F-1）**。`workflow.js`（`289a76c→04ca855`）确来自
   **PR #114**（merge = TARGET_COMMIT 本身，diff base index 交叉证实）。但其余 4 文件
   （index.js / ingress-delivery.js / route-chain.js / compose.js）+ canary 新增来自
   **PR #111**（merge `b53ebd6`，branch impl/luna-cold-backup-v2，MERGED，7 文件中 5 个
   app 面 + 2 个测试），**不是 PR #103**——PR #103（merge `f54679c`）对 main 的 diff 为
   docs-only 8 文件，其内容恰是这 5 文件的 BASE 侧。runner 头注「PR #103 merge f54679c
   content」同此误标。**全部 6 文件仍可溯源到已 merge 的 PR（#111 + #114），机械 pin
   不受注释影响**——授权性无缺口，纯出处标注错误。
3. **其余生产文件无漂移** — 见第 1 项证明；--check 亦实测 LIVE_STATE=BASE。
4. **manifest 131→132** — 双侧独立复算（131=`15793b0e`、132=`6ea0b614`）+ --check 输出。
5. **备份** — apply 前 `cp -p` 5 个 BASE 副本 + 逐文件 blob==MOD_BASE_OIDS 验证 + README
   provenance（路径 $BACKUP_ROOT/agent-core-9bb5b97-<ts>）；回滚以该 backup 为源。
   **原子安装** — `atomic_install`：install 到 `.<name>.deploy9bb.$$` 临时文件 → `mv -f`
   rename 原子替换；staging 亦逐文件 blob==MOD/ADD_TARGET_OIDS 验证。
   **父目录 fsync — 缺失（F-2）**：全脚本无 fsync（文件与父目录均无）。影响仅限
   崩溃/掉电窗口内的 rename 持久性；任何此类中间态在重跑时 fail-closed（manifest
   unapproved → exit 2 零写；或 lock 残留 → exit 2）。建议 v2 补 `fsync(tmp)` + 父目录
   fsync。
6. **只重启 system/ai.agent-core.runtime** — 唯一 restart 动作为
   `launchctl kickstart -k system/ai.agent-core.runtime`（成功路径 + 回滚路径各一次）；
   `launchctl print` 只读；无其他服务/label 触及。
7. **/health 验证** — preflight 要求 healthy 才允许 apply；重启后 45×2s 轮询
   `http://127.0.0.1:8790/health` + launchd print 双检；失败 → exit 1 → 完整回滚。
8. **任一步失败完整回滚** — `set -Eeuo pipefail` + EXIT/INT/TERM trap 统一入口
   cleanup_apply：写后任何非零退出 → 恢复 5 文件（backup 源 + atomic_install）→ 删除
   canary → `verify_tree BASE` 全树复验 → kickstart → wait_for_health；5 项全过才
   ROLLBACK=OK。写前失败（backup/staging blob mismatch 等）零生产写直接拒。
   SIGKILL 不可 trap（shell 固有）：lock 残留使重跑 fail-closed。
9. **回滚不完整不得宣称成功** — 任一恢复步骤失败 → rollback_ok=0 →
   `ROLLBACK_INCOMPLETE` + exit 3 + lock/backup 保留给 operator；SUCCESS_COMMITTED
   仅在 verify TARGET + health + print + ledger append 全部通过后输出。
   （细节：cleanup 内 verify_tree 失败时经 fail() 以 exit 2 而非 3 退出，错误信息仍明示、
   lock/backup 仍保留——语义等价 fail-closed，记 O-3。）
10. **不修改 auth.json、credentials、角色或其他服务** — 写面有界：LIVE_ROOT 下 6 个
    delta 路径 + $BACKUP_ROOT/$LEDGER/$lock/$stage（均在 TRUSTED_ROOT 内）；plist 只读；
    无 sudo 调用（uid-0 直跑）；curl 仅 127.0.0.1:8790；rm 有界（mktemp manifest、ADD_PATH、
    $stage）；无 eval/base64/ssh/scp/chmod/chown/kill；`bash -n` OK。

## --check 独立复跑（本轮唯一 runner 执行）

```text
TASK_NAME=接入 执行 (deploy preparation)
TARGET_COMMIT=9bb5b97… (= fresh-fetch github/main pin)
LIVE_STATE=BASE / LIVE_FILES=131 / DELTA_FILES=6 (5 modified + 1 added)
SERVICE=system/ai.agent-core.runtime / HEALTH_URL=http://127.0.0.1:8790/health
CHECK=PASS (rc=0)
```

含：repo 权威（github/main==pin、6 个 target blob 逐一对 pin）、live BASE manifest、
服务 preflight（plist 存在、launchd 可用、/health 200、delta 路径 regular file 0:0/644）。

## 非阻断发现

- **F-1 出处误标**（见第 2 项）：4 router 文件 + compose.js + canary 实际来自 PR #111，
  非 PR #103（#103 为 docs-only）。runner 头注同误。机械 pin 与授权性不受影响；建议在
  任何后续修订中更正注释（修订将改变 sha256，需重新封存）。
- **F-2 无 fsync**（见第 5 项）：建议 v2 在 atomic_install 中 fsync 临时文件 + rename 后
  fsync 父目录；现实现的残余风险仅为崩溃窗口持久性，恢复路径 fail-closed。
- **O-3** cleanup 内 verify_tree 失败路径以 exit 2 代替 exit 3（错误信息仍明示、
  lock/backup 保留、无假成功）。
- **O-4** 写前失败时已创建的 $backup 目录不清理（无害残留，位于 BACKUP_ROOT）。

## Boundaries

DOCS ONLY（本报告 + 1 evidence 目录 8 文件含 MANIFEST）；本轮生产访问 = --check 的
只读操作（find/hash 读 live 树、launchctl print、curl GET /health、git fetch github）+
非 root manifest 复算；ZERO sudo、ZERO 写、--apply 未执行；runner sha 审计前后一致；
主树 pre-existing WIP 未动；新文件按显式路径 stage。

## Final

```text
接入 审计 = PASS
BLOCKERS = NONE
READY_FOR_OWNER_RUN = YES
RUNNER = /tmp/run-agent-core-deploy-9bb5b97-v1.sh
RUNNER_SHA256 = 181c35d4741255f391235d0f8a5ea88e2d47a375d9d90333ddd572bcd4ad5ece
TARGET_COMMIT = 9bb5b97442c7155da36f06e867d1a655410544ac
DELTA = EXACTLY 6 FILES (math-proven: BASE 131/15793b0e + 5 swaps + 1 insert == TARGET 132/6ea0b614)
PROVENANCE = PR #111 (4 mod + canary; NOT #103 as stated — F-1) + PR #114 (workflow.js)
MANIFEST = 131 -> 132
CHECK = PASS (rc=0, independently rerun this round)
PRODUCTION_CHANGE = NONE
OWNER_COMMAND = sudo bash /tmp/run-agent-core-deploy-9bb5b97-v1.sh --apply
                (interactive phrase APPLY AGENT_CORE_DEPLOY_9BB5B97_V1)
```
