# AGENT_CORE_CTO_OPENCLAW_RECOVERY_V6_REVISION_V1（恢复 执行 · FINAL_AUTHORITY_GATE_FIX）

- date: 2026-08-29
- task: 恢复 执行（TASK_TYPE = FINAL_AUTHORITY_GATE_FIX）
- closes: `docs/reports/agent-core-cto-openclaw-recovery-v5-audit-v1.md` 的唯一 blocker **B1**（root 身份裸 git 触发 Apple Git 2.50.1 dubious-ownership / CVE-2022-24765，authority gate 零写入退出 → 恢复永远无法 apply）
- evidence: `docs/evidence/cto-openclaw-recovery-v6-revision-20260829/`（MANIFEST 含全部 sha256）
- runners: OLD `/tmp/run-agent-core-cto-openclaw-recovery-v5.sh`（sha256 `f55a6069…aff5d37`，sealed 未动，轮末复验一致）→ NEW `/tmp/run-agent-core-cto-openclaw-recovery-v6.sh`（sha256 `ca47ef9fbbde891484798a10aeda221fa9d1ccca7c326127631b2144af3db018`，37199B，mode 0700，archive byte-identical）

## 1. 修订内容（唯一 seam = authority git）

v6 由 v5 经 8 处外科手术式替换生成（每处断言恰好一次匹配；`v5-v6-diff.txt` 仅 4 个 hunk；`bash -n` PASS）：

1. `git_as_repo_owner()` helper（新增）：`/usr/bin/sudo -n -u yanfenma /usr/bin/git -C "$REPO" "$@"` —— 三处 authority 查询（commit existence / accepted Spec blob 读取 / main ancestry）全部经它执行；调用方仍是 root runner，git 进程身份 = 仓库 owner uid 502。与 runner 既有 `sudo -n -u authsvc` / `sudo -n -u '#502'` 定向身份下降模式同构；sudo env_reset 同时剥离 root 环境的 `GIT_*` 注入面。
2. 调用前 fail-closed 预检（新增 6 行，任何失败 = `zero_write_exit`，零写入）：`/bin/realpath "$REPO"` 精确 == `REPO_PIN`；`stat %HT` = Directory（BSD stat 对 symlink 返回 `Symbolic Link`，天然拒绝 symlink 仓库，即使其 realpath 恰好落在 pinned 路径上）；owner uid == 502；`.git` 存在、非 symlink 且为 Directory；`id -u yanfenma` == 502（name↔uid 绑定漂移拒绝）。
3. 三处 `git -C "$REPO" …` → `git_as_repo_owner …`；Spec blob 仍读自 **pinned commit** `73ec666…` 的 `docs/specs/AGT_CTO_AGENT_PRIMARY_WORKSPACE_OPENCLAW_IN_PLACE_V1.md`（不信任 branch/ref），`spec_id` 与 `status: accepted` 逐行 grep 原样保留。
4. 版本字符串机械更新（header owner command / 无参数提示 / CONFIRM_PHRASE V6 / start log），与 v4→v5 惯例一致。

**未改动**（逐字节保持，证据 `synthetic-block-v{5,6}.txt` 112 行 cmp 一致）：无参数 Owner 命令、一次确认短语、URL pins、home 755→700、exact mapping 原子事务、FD-only credential open + zero-touch、label-scoped restart、live marker、完整 rollback / ROLLBACK_INCOMPLETE、no chown、`run_synthetic_case` 全部 15 场景逻辑。备选方案（命令级 `git -c safe.directory="$REPO"`）**未采用**：owner-identity 方案可靠（root 的 `sudo -n` 免密、目标用户存在且 uid 匹配），且不给 root 身份的 git 进程留任何 config 面。**未修改任何 root/global gitconfig**（零执行）。

## 2. 验证（全部 uid 502 执行；本轮全程零 sudo，bash -x 追踪佐证）

- **T1 dubious ownership 复现**（v5 seam 身份）：`GIT_TEST_ASSUME_DIFFERENT_OWNER=1 /usr/bin/git -C $REPO` 对 cat-file / show / merge-base 三查询全部 rc=128、stdout 空、stderr `fatal: detected dubious ownership` —— 与审计 B1 同构复现。
- **T2 repo-owner 身份成功**：uid 502（= `sudo -n -u yanfenma` 的产出身份，`id -u yanfenma`=502 = 仓库 owner uid）直连同批查询：`cat-file -t` = commit、pinned blob frontmatter `spec_id`/`status: accepted` grep 命中、`merge-base --is-ancestor main` rc=0。
- **T2b 完整 gate 正向**（`gate-pos`）：真实仓库 + 真实 pinned 常量的 v6 副本（仅中和 root gate + helper 身份直连 uid 502 + authority ok 后受控停止）喂入确切短语 → 确认接受 → 预检全过 → `OK accepted governing Spec is in main` → 受控停止 rc=0；bash -x 追踪 sudo 出现次数 = 0。
- **T3 commit 缺失**（synthetic repo 无 73ec666 对象）：`PREFLIGHT_FAIL (ZERO WRITES) — authority commit missing`，rc=2。
- **T4 Spec 非 accepted**（synthetic repo HEAD blob `status: draft`）：`— authority spec not accepted`，rc=2。
- **T5 漂移 ×5**：path 漂移（resolved 但 ≠ pin）、path unresolved、owner 漂移（`/Users/Shared` uid 0，realpath/type 均过、专杀 owner 检查）、REPO symlink（realpath 恰好 == pin 仍被 `%HT` 拒绝）、`.git` symlink —— 全部 `FAILED_PRE_FLIGHT; WRITES=NONE` rc=2，且均未打出 authority ok 行。
- **真实仓库零写入**：round 前后 HEAD + `git status --porcelain` sha + TARGET_WS marker 缺失状态逐字节一致。
- **SANDBOX_MATRIX = 15/15 PASS**（`run-matrix-v6.sh`，与审计驱动同构）：baseline / fault-env-pollution-ignored / restart-fail / health-fail / delivery-404 / delivery-accepted-false / marker-timeout / marker-open-failed / marker-cwd-wrong / mapping-promote-fail（10 例：8 例 FAILED_AND_ROLLED_BACK 14/14 检查 + 2 例 SUCCESS）+ 5 例 ROLLBACK_INCOMPLETE（exit 4 + 精确 UNRESTORED_STATE 理由）；success 与 rollback 的 bash -x 追踪零 sudo。
- **静态分析**：禁用字符串（chown/chflags/rm -r/kill -9/base64/xxd/openssl/osascript/eval/ssh/scp/rsync/nc/diskutil/bless/spctl/csrutil/su）零匹配；sudo 清单全部 `-n -u <authsvc|#502|yanfenma>` 定向（新增唯一一处 = helper）；git seam 收敛为 helper 定义 + 恰好 3 个调用点、helper 外零裸 `git -C`；launchctl print+kickstart、kill -0、URL `127.0.0.1:8790` 与 v5 完全一致。

### 已知留验点（非 blocker，交独立审计/Owner run）

本轮按任务约束**未执行任何 sudo**，故 `sudo -n -u yanfenma → uid 502` 这一 uid 映射链接未在本轮实测；其等价性由 (a) `id -u yanfenma` = 502 = 仓库 owner uid，(b) T2 的 uid 502 直连 git 全绿，(c) helper 与 runner 既有 `-n -u` 定向调用同构，三件事机械推出。即使该链接意外失败，helper 返回空/非零 → 既有 `[ = "commit" ]`/grep/rc 检查全部 fail-closed 为零写入中止，不存在 fail-open 路径。

## 3. 边界

PRODUCTION_CHANGE = NONE（未执行生产 runner；未触碰 /Users/authsvc/**、mapping、credential、服务、端口 8790；真实仓库只读 git 查询）；未执行 sudo；未修改任何 gitconfig；sealed v5 未动；packages/ 与 scripts/ 零改动；既有 WIP（broker 修改 + 未跟踪 docs）原样保留；本轮 26 个 /tmp runner 日志与 17 个 matrix scratch 目录已按 before/after 差集精确清理（清单入 evidence）。

**20260830 事件补记**：提交（20260829 ~22:00）之后、次日 07:49 之前，外部动作清除了 /tmp 下全部 cto 前缀工件（含两个 runner 与早前轮次日志；非本 round 清理所致——本 round 清理发生在提交前且清理后 seal 复验通过）。已做 sha 验证恢复：v6 自 git 归档字节复制（ca47ef9f… 复验一致）；v5 由 8 处正向替换的精确逆运算重建（f55a6069… 复验一致）。/tmp 副本与 sealed 字节相同；git 归档仍是 v6 的权威字节。evidence 的 matrix 转录文件名同期由 `case-case-*` 修正为 `case-*`（归档循环 basename 笔误，纯外观，MANIFEST 已重生成并 63/63 复验）。

## 4. FINAL

- OLD_RUNNER = /tmp/run-agent-core-cto-openclaw-recovery-v5.sh（f55a6069…aff5d37）
- NEW_RUNNER = /tmp/run-agent-core-cto-openclaw-recovery-v6.sh
- NEW_RUNNER_SHA256 = ca47ef9fbbde891484798a10aeda221fa9d1ccca7c326127631b2144af3db018
- ROOT_GIT_DUBIOUS_OWNERSHIP_CLOSED = YES（owner-identity seam；T1 复现 + T2/T2b 通过）
- AUTHORITY_GIT_IDENTITY = yanfenma / uid 502
- PINNED_COMMIT_BLOB_VERIFICATION = PASS（73ec666 blob：spec_id 正确 + status accepted + main ancestry）
- SANDBOX_MATRIX = 15/15 PASS
- OTHER_SEMANTIC_DELTA = NONE（v5→v6 仅 4 hunk，全部位于 authority git seam；synthetic 块逐字节一致）
- PRODUCTION_CHANGE = NONE
- READY_FOR_INDEPENDENT_REVIEW = YES
- NEXT_TASK = 恢复 审计
