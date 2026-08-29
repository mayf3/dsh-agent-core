# AGT_CTO_OPENCLAW_RECOVERY_V5 最终生产 Runner 独立审计（恢复 审计）

- TASK_NAME = 恢复 审计（FINAL_PRODUCTION_RUNNER_REVIEW）
- 审计对象：`/tmp/run-agent-core-cto-openclaw-recovery-v5.sh`（697 行，36120 B）
- RUNNER_SHA256 = `f55a6069d3b819d879b767066d75469464224bf50e1e3051519925ff9aff5d37`（与本轮任务 EXPECTED_SHA256 逐字节一致；轮末复测仍一致）
- 日期：2026-08-29
- 审计约束遵守：本轮 **零 sudo 执行**、零生产写入（PRODUCTION_CHANGE = NONE）。

## 最终裁定

```
恢复 审计 = REVISE
RUNNER_SHA256_MATCH = YES
NO_ARGUMENT_OWNER_COMMAND = GATE_CONFIRMIRMED / BLOCKED_AT_AUTHORITY_GATE（B1）
SANDBOX_MATRIX = 15/15 PASS（独立复跑）
BLOCKERS = B1（root 下 authority gate 的 git dubious-ownership 失效：fail-closed、零写入，但 owner run 无法完成恢复）
READY_FOR_OWNER_RUN = NO（B1 修订 + 快速复审后可翻转）
PRODUCTION_CHANGE = NONE
```

## 0. 审计范围与方法

按任务清单逐项独立复核：静态逐行阅读全 697 行；对每条安全性质做定向 grep 清点；对本机 git
行为做实证模拟；无参数/参数/确认门做非 root 动态测试（对 root 检查使用**仅改一行的审计副本**，
diff 与 sha 已归档，副本从未触碰任何生产路径）；以 `--synthetic-case` 独立复跑 15 个 sandbox
场景并逐项校验退出码、FINAL 行、14 项 ROLLBACK_CHECK、以及**脚本外**的后置状态
（map==backup 字节相等 / home 755 / marker 无残留 / 成功路径 88 项映射形状）。
v4→v5 diff 全量复核（变更仅：头部 owner 命令、URL 由 BASE_URL 派生 + 精确 pin、授权模型从
env-ruling+receipt+`--apply` 换成交互确认短语；ATOMIC_JS / rollback / canary / synthetic 全部字节不变）。

## 1. 通过项（全部独立复核）

| 要求 | 结论 | 证据 |
|---|---|---|
| 禁止字符串计数 = 0 | PASS | `chown/chflags/rm -r/kill -9/base64/xxd/openssl/osascript/eval/ssh/scp/rsync/nc/diskutil/bless/spctl/csrutil/su` 全部 0 匹配；`launchctl` 仅 `print`（只读）+ `kickstart -k system/ai.agent-core.runtime`；`kill` 仅 `-0` 存活探测；URL 仅 `http://127.0.0.1:8790`；`sudo` 全部为 `-n -u <指定用户>` 定点命令 |
| 无参数执行能进入确认门 | PASS | 无参数：实跑（uid 502）通过参数门、停在 root 门（确认提示的紧邻上一条语句）；一行修补副本（仅中和 root 门 + REPO 指向不存在路径）：EOF→`confirmation input unavailable`、错误短语→`confirmation phrase mismatch`、精确短语→`interactive Owner confirmation accepted` 并前进到 authority 门。带参数实跑→`unexpected arguments; run exactly: sudo bash /tmp/run-agent-core-cto-openclaw-recovery-v5.sh`（exit 2，零写入） |
| Delivery URL | PASS | `BASE_URL="http://127.0.0.1:8790"`、`DELIVER_URL="${BASE_URL}/v1/deliver"`，且 537-539 行运行时再 pin 三元组，任何漂移零写入退出 |
| FD-only credential open | PASS | runner 自身对 credential 只做 `stat` 元数据 pin（inode/uid/gid/mode/mtime，全流程 5 次复核）；唯一内容级 open 在 canary shell 内 `exec 3<"$CREDENTIAL_FILE"` 后立即关闭，只记录 OPEN_OK/OPEN_FAILED；提示词明令不读取/显示/复制内容；canary 后验证 authsvc 不可读、uid 502 可读 |
| no chown | PASS | 全文 0 处；属主不变量用 pin（map 505:601/600）+ restore 后复核达成 |
| 原子 mapping + 父目录 fsync | PASS | ATOMIC_JS `secureInstall`：同目录 `O_WRONLY\|O_CREAT\|O_EXCL\|O_NOFOLLOW` 0600 临时文件 → writeAll → `fsyncSync(fd)` → 回读校验 → promote 前对 live 文件按 fd 做 dev/ino/sha 身份复核（防 TOCTOU）→ `renameSync` → **`fsync` 父目录** → 终态回读+mode 校验；失败路径 finally 清理临时文件。15 个场景中的 promote/restore 全部走此路径 |
| 仅重启 system/ai.agent-core.runtime | PASS | 唯一重启动词 `launchctl kickstart -k`，唯一目标 `system/ai.agent-core.runtime`；无 unload/load/bootout/bootstrap；新旧 PID 更替 + 旧 PID 必须死亡双验证 |
| 成功后等待真实 marker | PASS | Router 受理（accepted:true）只记 ok，不作为成功；随后以 900s 轮询等待真实子进程 marker（uid=502、mode=600、与期望字节 `cmp` 精确相等，含 cwd=TARGET_WS 与 credential read-open=OPEN_OK），marker 缺失/不精确 → fail → 回滚 |
| rollback 完整才输出 FAILED_AND_ROLLED_BACK | PASS | 14 项 ROLLBACK_CHECK（map 精确 pre 字节、SHA、key 缺席、owner/group/mode、条目数、home 755、credential pin、重启、健康、新 PID 稳定、boot 证据无映射、fallback 证明、marker 缺席、无残留进程）**全部=1 且 bad 为空**才输出，exit 1 |
| rollback 不完整必须输出 ROLLBACK_INCOMPLETE | PASS | 任一项失败即 `RESULT: ROLLBACK_INCOMPLETE` + `UNRESTORED_STATE` 明细，exit 4；5 个注入场景实测输出预期原因 |
| 独立复跑 15 个 sandbox 场景 | 15/15 PASS | 见 §2 |

## 2. 独立 sandbox 矩阵（15/15 PASS）

场景清单（本审计自定矩阵，覆盖 runner 全部 13 个识别名 + 2 个补充场景；运行用户 uid 502，
`bash -x` 追踪证实 synthetic 路径 **0 次 sudo 执行**）：

1. `baseline`（成功路径）→ SUCCESS exit 0；map=88 项且 `agt_cto-agent → target` 精确、marker 已清、ROLLBACK_CALLS=0
2. `fault-env-pollution-ignored`（未识别名 + 导出 `RECOVERY_ATOMIC_TEST_FAULT=rename` 与 `RECOVERY_ATOMIC_TEST_CANDIDATE`）→ SUCCESS；证明 synthetic harness 在 promote 前 unset 注入钩子、强制候选路径文件从未被创建（生产路径另有 `env -i` 双重剥离）
3. `restart-fail` → FAILED_AND_ROLLED_BACK exit 1（**执行者 20:24 的矩阵未包含此场景**，本矩阵补齐）
4. `health-fail` → FAILED_AND_ROLLED_BACK
5. `delivery-404` → FAILED_AND_ROLLED_BACK
6. `delivery-accepted-false` → FAILED_AND_ROLLED_BACK
7. `marker-timeout` → FAILED_AND_ROLLED_BACK
8. `marker-open-failed` → FAILED_AND_ROLLED_BACK
9. `marker-cwd-wrong` → FAILED_AND_ROLLED_BACK
10. `mapping-promote-fail`（rename 注入）→ FAILED_AND_ROLLED_BACK
11. `rollback-primary-mapping-restore-fail`（restore 注入 parent-sync fault）→ ROLLBACK_INCOMPLETE exit 4（`mapping restore transaction failed`；注意字节虽已还原，事务完整性未证明即保守判 INCOMPLETE——正确的 fail-safe 方向）
12. `rollback-home-mode-restore-fail` → ROLLBACK_INCOMPLETE（home 保持 700）
13. `rollback-restart-fail` → ROLLBACK_INCOMPLETE
14. `rollback-health-fail` → ROLLBACK_INCOMPLETE
15. `rollback-fallback-proof-fail` → ROLLBACK_INCOMPLETE

全部 FAILED_AND_ROLLED_BACK 案例实测 14/14 ROLLBACK_CHECK=1，且脚本外独立复核
map 与 backup 字节相等、home 755、无 marker 残留。逐场景日志归档于 evidence。

## 3. BLOCKER B1 — root 下 authority gate 被 git dubious-ownership 阻断（可用性，fail-closed）

**现象**：`sudo bash /tmp/run-agent-core-cto-openclaw-recovery-v5.sh` 输入确认短语后，runner 以
root（euid 0）执行 541/542/545 行的三个**裸 `git`** 调用，操作 yanfenma（uid 502）所有的仓库
`/Users/yanfenma/workspace/project/dsh-agent-core`。本机 `/usr/bin/git` 2.50.1（无任何其他 git：
`/opt/homebrew/bin/git`、`/usr/local/bin/git` 均不存在）执行 CVE-2022-24765 所有权防护。

**实证**（evidence/b1-dubious-ownership-simulation.txt）：以
`GIT_TEST_ASSUME_DIFFERENT_OWNER=1` 在同一仓库、同一 git 二进制上强制触发 euid≠owner 代码路径：
`fatal: detected dubious ownership in repository at '/Users/yanfenma/workspace/project/dsh-agent-core'`，
rc=128，stdout 为空 → runner 捕获空串 → `zero_write_exit "authority commit missing"`。这正是
root 在 502 属主仓库上运行的结果，除非 root 的 gitconfig 已含 safe.directory。

**逃生通道逐一排查**：系统级 `/etc/gitconfig`、`/usr/local/etc/gitconfig` 均不存在；
yanfenma 的 `~/.gitconfig` 只有 `.openclaw` 与 canary-extension 两条 safe.directory（不含本仓库），
故即使 sudo 保留 HOME 也无效；`/var/root` 为 `drwxr-xr--- root:wheel`，root 的 gitconfig
内容对本审计不可读（零证据表明存在该条目）；repo 内 `.git/config` 的 safe.directory 被 git
设计性忽略。历史上无任何版本本 runner 以 root 运行过（/tmp 全部日志属主 uid 502），
v4 同款 gate 同样从未在 root 下验证。

**影响**：Owner 全新执行最可能在 authority gate 处 fail-closed 退出（exit 2、零写入、
`FINAL: FAILED_PRE_FLIGHT`）——安全性无损，但恢复永远无法落地，“最终 Owner 命令确实可用”
无法确认 → READY_FOR_OWNER_RUN = NO。

**机械修复（任选其一，随后快速复审翻转本裁定）**：
- runner 侧：三处 git 调用改为 `git -c safe.directory="$REPO" -C "$REPO" ...`（命令行 -c 配置
  对 safe.directory 有效），或统一改用绝对 `/usr/bin/git` + `-c`；
- 环境侧：Owner 预先执行
  `sudo git config --global --add safe.directory /Users/yanfenma/workspace/project/dsh-agent-core`
  并在下轮审计中出示证据。

## 4. 次要发现（不阻断）

- M1（命名残留）：v5 内部字符串仍是 v4 纪元——`MARKER_FILE=.agent-core-cto-recovery-v4-canary.txt`、
  `REQUEST_ID=cto-openclaw-recovery-v4-*`、`LOG_FILE=/tmp/agent-core-cto-openclaw-recovery-v4-*`、
  backup mktemp 前缀 `agent-core-cto-recovery-v4.`、canary 提示词标题 `..._RECOVERY_V4`。行为一致、
  无冲突（marker 前置缺席 + 后置清理均强制），纯观感问题；若修 B1 时顺手统一为宜。
- M2（治理观察）：v5 移除了 v4 的 SUDO_USER/SUDO_UID 操作者绑定与 approval-receipt sha pin
  （盘面 `/tmp/agent-core-cto-openclaw-recovery-v4-owner-approval.txt` 仍按 sha 绑定 v4），
  改为交互精确短语。与本任务给定的 owner 命令设计一致，记录备查，不阻断。
- M3（执行者矩阵标签）：执行者 v5 汇总标签（health-endpoint-fail / accepted-marker-timeout /
  primary-mapping-restore-fail / home-mode-restore-fail）与实际识别名不一致（实际日志用的是
  health-fail / marker-timeout / rollback-*-fail，故其结果有效），且缺少 `restart-fail`；
  本审计矩阵已按正确识别名全覆盖补齐。

## 5. 边界

本轮 DOCS-ONLY：除新增 `docs/reports/agent-core-cto-openclaw-recovery-v5-audit-v1.md` 与
`docs/evidence/cto-openclaw-recovery-v5-audit-20260829/`（31 文件 + MANIFEST）外零改动；
未执行任何 sudo；未触碰 `/Users/authsvc/**`、mapping、credential、服务与 8790 端口；
sealed runner 零写入（轮始轮末 sha 一致）；审计产生的 17 个 `/tmp/cto-v4-runner-matrix.*`
scratch 目录已清理，执行者历史产物未动；工作树既有 WIP（broker 修改 + 未跟踪 docs）保持原样。

## 6. 最终字段

```
恢复 审计 = REVISE
RUNNER_SHA256_MATCH = YES（f55a6069d3b819d879b767066d75469464224bf50e1e3051519925ff9aff5d37）
NO_ARGUMENT_OWNER_COMMAND = 确认门已证实可达；root 全程被 B1 阻断在 authority gate（fail-closed 零写入）
SANDBOX_MATRIX = 15/15 PASS（独立复跑，含执行者缺失的 restart-fail 与 env 注入隔离场景）
BLOCKERS = B1（git dubious-ownership@root：owner run 无法完成恢复；机械修复 + 快速复审）
READY_FOR_OWNER_RUN = NO
PRODUCTION_CHANGE = NONE
NEXT_TASK = 恢复 修订（B1）
```
