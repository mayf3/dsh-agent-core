# AGT_CTO_OPENCLAW_RECOVERY_V6 最终生产 Runner 聚焦复审（恢复 审计，B1 修订轮）

- TASK_NAME = 恢复 审计（对 v6 的聚焦重审，输入为 v5 审计报告 `agent-core-cto-openclaw-recovery-v5-audit-v1.md` 的 B1 修订）
- 审计对象：`/tmp/run-agent-core-cto-openclaw-recovery-v6.sh`
- RUNNER_SHA256 = `ca47ef9fbbde891484798a10aeda221fa9d1ccca7c326127631b2144af3db018`（== EXPECTED_SHA256；轮末复测一致）
- 日期：2026-08-30；零 sudo、零生产写入（PRODUCTION_CHANGE = NONE）

## 最终裁定

```
恢复 审计 = PASS
RUNNER_SHA256_MATCH = YES
B1_CLOSED = YES（三处 git 全部以 yanfenma/uid502 执行，dubious ownership 结构性关闭）
SANDBOX_MATRIX = 15/15 PASS（v6 独立复跑）
V5_OTHER_LOGIC = UNCHANGED（v5→v6 diff 仅 B1 修复 + v6 命名，其余字节不变）
BLOCKERS = NONE
READY_FOR_OWNER_RUN = YES
PRODUCTION_CHANGE = NONE
```

## 1. v5→v6 diff 全量复核（逐 hunk）

diff 仅含四组变更，全部服务于 B1 或版本命名，其余（ATOMIC_JS / rollback / canary /
synthetic / 交付与健康检查 / 全部 pin）与 v5 **字节不变**：

1. `git_as_repo_owner()` = `/usr/bin/sudo -n -u yanfenma /usr/bin/git -C "$REPO" "$@"`；
   三处 authority 查询（cat-file -t / show spec blob / merge-base --is-ancestor main）全部改走该函数。
   全文已无任何裸 `git` 调用（grep 证实仅剩函数体、注释与 `.git` stat 检查）。
2. 新增六个 fail-closed repo 漂移门（在 git 调用之前）：realpath == `REPO_PIN`、repo 为普通目录、
   属主 uid == 502、`.git` 为普通目录、`.git` 非符号链接、`id -u yanfenma` == 502（名字/uid 绑定）。
3. `REPO_PIN/REPO_OWNER_NAME/REPO_OWNER_UID` pin 常量。
4. v6 命名（owner 命令、确认短语 `APPLY EXACT_CTO_OPENCLAW_RECOVERY_V6`、参数错误文案、启动日志）。

## 2. 重点项逐条结论

- **三处 git 全部以 yanfenma/uid502 执行**：YES。root 下 `sudo -n -u yanfenma` 免密成立
  （root 切换任意用户无需口令）；git 进程 euid=502。
- **pinned commit 73ec666 与 accepted Spec blob 校验**：YES 且逐项实测——以与
  `git_as_repo_owner` 完全相同的 euid 条件（uid 502，即本审计用户）执行：
  `cat-file -t 73ec666` = commit；`show 73ec666:docs/specs/AGT_CTO_AGENT_PRIMARY_WORKSPACE_OPENCLAW_IN_PLACE_V1.md`
  头部 `spec_id: AGT_CTO_AGENT_PRIMARY_WORKSPACE_OPENCLAW_IN_PLACE_V1` + `status: accepted`
  （runner 内两道精确 grep 不变）；`merge-base --is-ancestor … main` rc=0。
- **dubious ownership 已关闭**：YES（结构性）。git 2.50.1 的 CVE-2022-24765 防护仅在
  euid ≠ repo 属主时触发；此处 euid=502 == 属主 502，防护条件不成立（v5 审计的
  `GIT_TEST_ASSUME_DIFFERENT_OWNER` 失效模拟在该条件下不复现）。不再依赖任何 safe.directory 配置。
- **repo path/owner/symlink 漂移 fail-closed**：YES。六谓词在真实 repo 全部 PASS；
  负向实测（审计副本指向不存在路径）：确认门通过后**第一道漂移门即触发**
  `RESULT: PREFLIGHT_FAIL (ZERO WRITES) — repo realpath drift: … -> unresolved`，exit 2 零写入。
  `/bin/realpath` 在本机存在（100KB root 二进制），路径解析可用。
- **原 15 个 sandbox 15/15**：YES。v6 独立复跑（同一驱动、同一后置状态脚本外校验：
  完整回滚 8 例 14/14 检查位 + map==backup 字节相等 + home 755 + 无 marker 残留；
  不完整回滚 5 例 exit 4 且 UNRESTORED_STATE 原因精确；成功路径 88 项映射形状正确）。
  `bash -x` 追踪（成功 + 回滚场景）证实 synthetic 路径 0 次 sudo 执行。
- **v5 其他逻辑无变化**：YES（§1 diff 逐 hunk 证明）。

## 3. 无参数 / 确认门（v6 短语复核）

实跑（uid 502）：无参数通过参数门停在 root 门（exit 2 零写入）；错误参数拒绝并给出
v6 owner 命令原文。一行修补副本（root 门中和 + REPO 指向不存在路径；diff 与 sha 已归档，
全程零 sudo、零生产触碰）：EOF→`confirmation input unavailable`；错误短语→`confirmation phrase
mismatch`；精确短语 `APPLY EXACT_CTO_OPENCLAW_RECOVERY_V6`→`interactive Owner confirmation
accepted` 并前进至漂移门（被 bogus 路径零写入拦截，即 §2 的负向实测）。

## 4. 遗留观察（不阻断，沿承 v5 审计）

- M1（v5 审计）v4 纪元内部命名（marker/REQUEST_ID/LOG_FILE/backup 前缀、canary 标题）在 v6 未统一——
  行为一致、无冲突，纯观感。
- M2（v5 审计）操作者绑定语义：v6 仍无 SUDO_USER/SUDO_UID 白名单（交互精确短语为唯一授权门），
  与任务给定 owner 命令设计一致。

## 5. 边界

本轮 DOCS-ONLY：新增本报告与 `docs/evidence/cto-openclaw-recovery-v6-audit-20260830/`
（29 文件含 MANIFEST sha256）；零 sudo 执行；未触碰 `/Users/authsvc/**`、mapping、credential、
服务与 8790 端口；sealed v6 runner 零写入（轮始轮末 sha 一致）；本轮 scratch（matrix 目录与
审计 tmp 目录）已清理；既有 WIP 保持原样。

## 6. 最终字段

```
恢复 审计 = PASS
RUNNER_SHA256_MATCH = YES
B1_CLOSED = YES
SANDBOX_MATRIX = 15/15 PASS
V5_OTHER_LOGIC = UNCHANGED
BLOCKERS = NONE
READY_FOR_OWNER_RUN = YES
PRODUCTION_CHANGE = NONE
OWNER_COMMAND = sudo bash /tmp/run-agent-core-cto-openclaw-recovery-v6.sh（无参数 + 交互确认短语）
```
