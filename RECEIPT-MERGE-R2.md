# RECEIPT-MERGE-R2 — C7 PASS / source delivery stopped

状态：STOPPED_REQUIRED_GATE_FAILURE；不是提交或推送完成回执。
2026-11-04；worktree `/private/tmp/dsh-fleet-window-tools`；branch `chore/fleet-window-tools`；唯一写者 `/root`。

- HEAD=`d4ecf90aea0a439419d75c97fb15ad1736e3b542`，本轮未产生提交。
- MERGE_HEAD=`7a8aaac00d56c4af2892e7097731ecda86a90f1d`；合并解决现已 stage，`git ls-files -u` 为空。
- 此回执及停止后的补充证据未再 stage；遵守失败后不写 index。

## 脚手架修复与产品冻结

`ast.walk(tree)` 对六个精确函数名筛选 `FunctionDef`，覆盖 `main → try → close_checks`；
增加函数名集合完整性断言，再使用原 namespace/compile/exec 路径。未执行 main/try；
仅四行删除、三行新增的函数选择变化，所有原测试断言保持。R2-only diff 原文：

```diff
--- merge-resolution/test_xattrfix_r3.py
+++ merge-r2/test_xattrfix_r3.py
@@ -367,10 +367,9 @@
         print('C7_ISOLATION_ROOT=' + str(out), flush=True)
         source = (HERE / 'window-selftest.py').read_text()
         tree = ast.parse(source)
-        main = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'main')
-        selected = [n for n in tree.body if isinstance(n, ast.FunctionDef)
-                    and n.name in {'require', 'sha', 'save', 'rejected', 'pure_functions'}]
-        selected += [n for n in main.body if isinstance(n, ast.FunctionDef) and n.name == 'close_checks']
+        names = {'require', 'sha', 'save', 'rejected', 'pure_functions', 'close_checks'}
+        selected = [n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name in names]
+        self.assertEqual({n.name for n in selected}, names)
         namespace = dict(Path=Path, dt=dt, hashlib=hashlib, json=json, importlib=importlib, ast=ast,
                          math=core.math, os=os, re=core.re, stat=core.stat, sys=sys, time=core.time,
                          executor=HERE / 'window-executor-v5.sh', out=out)
```

本轮 SHA256 / 行数（六份产品/自测文件均与 STOPPED-MERGE 快照字节一致）：

| 文件 | 行数 | SHA256 | 原产品快照一致 |
|---|---:|---|---|
| window-executor-v5.sh | 300 | `54e13bd198c970bef60433900bb70bd32c7f2d45d76d169da0507bedf79b9ddd` | YES |
| window_helper_core.py | 329 | `8d09be1a716ed95893653678cf2b6afa040359ac1e5269d00714b65a81ff2632` | YES |
| window_helper.py | 356 | `69de6831818b51828489d1d927155cfb45d4e27d3363f2421655072075e977da` | YES |
| window_preimage_xattr.py | 111 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` | YES |
| window_close.py | 146 | `6488b91e382dfadf9bf0022d11747beb85071a5e70142e92e6c7348c9bef6465` | YES |
| window-selftest.py | 383 | `b45a672a6dfde88046676ff0f73e55902a2dc6fc03200968b691d747d5b3d8ab` | YES |
| test_xattrfix_r3.py | 432 | `4c69c4a5c6430b2783a56783b34f17b7cb403b5cf7dfb632eb67be3083edc83c` | 脚手架提取修复 |

独立 delta 复核：`/root/r2_review`，PASS；完整记录在报告目录 `INDEPENDENT-DELTA-REVIEW.md`。
这一 PASS 仅覆盖提取修复及未受影响证据的复用，不能代替下述失败的交付门。

## C7 定向门 fresh PASS 原文

```json
{
  "argv": [
    "/opt/homebrew/opt/python@3.14/bin/python3.14",
    "-B",
    "scripts/fleet-window/test_xattrfix_r3.py",
    "C7Close"
  ],
  "cwd": "/private/tmp/dsh-fleet-window-tools",
  "started_at": "2026-11-04T12:50:55.445582+00:00",
  "finished_at": "2026-11-04T12:50:55.605432+00:00",
  "rc": 0,
  "stdout_sha256": "611d35675d8c985ad8129386b73c852e412b4a8c9fc0efa1cb13c6c3bee90011",
  "stderr_sha256": "fc46e72b116c2daa2517fb37cc2df37e92504ec3debfcc33ba841b099bd65965",
  "harness_sha256": "4c69c4a5c6430b2783a56783b34f17b7cb403b5cf7dfb632eb67be3083edc83c"
}
```

stdout 原文：

```text
C7_ISOLATION_ROOT=/usr/local/v5-boot-isolation/xattr-fix-test/merge-c7-hllhhls0
C7_FOCUSED_AND_DISPATCH: R6/R7 original cases + stage11 refusal + JSON/NUL + owned release receipt PASS; deletion NOT_EXECUTED
```

stderr 原文：

```text
test_focused_and_migrated_close_release (__main__.C7Close.test_focused_and_migrated_close_release) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.081s

OK
```

隔离路径：`/usr/local/v5-boot-isolation/xattr-fix-test/merge-c7-hllhhls0`；产物副本位于
`docs/reports/fleet-window-merge-r2-20261104/isolated-c7-evidence/`。命名集diff空、五项拒绝用例、
最近两代/pinned/025保护、仅列清单和自有mutex释放均来自这次隔离测试。隔离
`completion.json` 内 `productionExecution=EXECUTED` 为消费者的合成输出，不表示真实生产执行。

## Stage 与首个失败门

- `git add -A` rc0；`git add -f docs/reports/fleet-window-merge-c7-20261104 docs/reports/fleet-window-merge-r2-20261104` rc0。
- `git diff --cached --check` rc2（要求rc0）；之后停止源码/index/发布写入。

```json
{
  "argv": [
    "git",
    "diff",
    "--cached",
    "--check"
  ],
  "cwd": "/private/tmp/dsh-fleet-window-tools",
  "started_at": "2026-11-04T12:52:58.805278+00:00",
  "finished_at": "2026-11-04T12:52:58.821117+00:00",
  "rc": 2,
  "stdout_sha256": "63ae898c1b95b650466bdf3f54d4e6e482ddcb643d7f0ec373ba8fe77cf16242",
  "stderr_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

stdout 原文：

```text
docs/reports/c7-selftest-20261104/SOURCE.diff:235: trailing whitespace.
+
docs/reports/c7-selftest-20261104/SOURCE.diff:254: trailing whitespace.
+
docs/reports/c7-selftest-20261104/SOURCE.diff:291: trailing whitespace.
+
docs/reports/c7-selftest-20261104/SOURCE.diff:990: trailing whitespace.
+
docs/reports/c7-selftest-20261104/SOURCE.diff:1007: trailing whitespace.
+
```

stderr 原文：

```text

```

失败文件来自 MERGE_HEAD，工作副本/index/该父提交同blob `89e7151d024130de40432c0339d94d260b90a37e`，
SHA256=`fe03b79b898a0622ddd1f19196aff4b0bc7a7b0ed46b2845e91b2d62fd3bc5c1`；五行均为单个ASCII空格。
未修改该历史证据、未绕过检查、未重跑。具体 SOURCE/COUNTEREXAMPLE/IMPACT/MINIMAL_CLOSURE 与
受影响 readiness 见 `STOPPED-MERGE-R2.md`；本轮唯一冻结 blocker 是该 cached diff-check失败。

## 复用、提交推送与PR状态

- 先前 SyntheticTree 10/10、Selftest+Consumers 7/7、原974行版dry-run stdout/stderr diff空：
  本轮仅复核原记录/日志hash与不受影响AST，27项归档证据hash一致；标记 REUSED，未新执行。
- 七文件当前最大432行，逐文件行数与编译门先前证据可复用；仓库 exact-tree 结构门本轮 NOT_RUN。
- 结构门、candidate commit-tree、git commit（含双语义消息）、git push、PR描述更新：均 NOT_RUN。
- 没有新commit SHA或push成功回执；HEAD仍为 `d4ecf90aea0a439419d75c97fb15ad1736e3b542`。
- PR #617：https://github.com/mayf3/dsh-agent-core/pull/617 。失败后fresh readback：OPEN、
  merged=false、mergeable=false，head=`d4ecf90aea0a439419d75c97fb15ad1736e3b542`，
  base=`7a8aaac00d56c4af2892e7097731ecda86a90f1d`；描述与初查一致，未更新。
  原PR描述中的历史验证语句不能当作本次merge-r2完整通过证据。PR merge=NOT_RUN（明确禁止）。
- C7语义移植现状（本轮冻结未修改）：`window-executor-v5.sh:259` stage_13先close后release；
  `window_helper.py` close/release分派与 `window_close.py` 承载R6/R7；
  `window_helper_core.py` 提供迁移验证函数；`window-selftest.py:291`保留原close_checks。

## UNKNOWN / 边界

- 实际安装/加载/认证/运行/生产preimage性能与ACL/hardlink/混合属主保真、业务结果：UNKNOWN。
- C6解堵、C7生产接受、新窗口GO：UNKNOWN；零生产接触、未清理、未删除代际/bak/025材料。
- 完整C7 selftest及fresh canary本轮 NOT_RUN。C7 focused PASS不代表这些结果。
- 独立完整交付/最终HEAD审查 NOT_COMPLETED；当前只完成提取修复的限定delta复核。
- COMMIT_READY=PUSH_READY=PR_UPDATE_READY=MERGE_READY=NO；NEXT_ACTION=STOP。

报告目录：`docs/reports/fleet-window-merge-r2-20261104/`。历史失败回执及原证据均保留。

## 独立停点复核

`/root/r2_review` 只读复核 STOPPED_RECORD_RECHECK=PASS（不是交付PASS）：
失败日志/行字节/历史blob同一性、产品冻结、HEAD/MERGE_HEAD和stage状态均吻合；
其fresh `git ls-remote`确认远端仍为 `d4ecf90aea0a439419d75c97fb15ad1736e3b542`。
完整记录：`docs/reports/fleet-window-merge-r2-20261104/INDEPENDENT-STOP-REVIEW.md`。
唯一blocker、全部交付readiness=NO与NEXT_ACTION=STOP保持不变。
