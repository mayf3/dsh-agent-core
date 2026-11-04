# RECEIPT-XATTRFIX-R3

结果：**STOPPED_REQUIRED_GATE_FAILURE**。拆分与 xattr 候选已写入；五类夹具门失败，
未取得完整拆分等价性证明，未 commit/push/PR/merge。
精确停点见 [STOPPED-XATTRFIX-R3.md](STOPPED-XATTRFIX-R3.md)。

## 坐标、授权与修改范围

记录时间 2026-11-04T12:11:51.124708+00:00；worktree `/private/tmp/dsh-fleet-window-tools`；branch
`chore/fleet-window-tools`；HEAD/base `c4152e9a45e2f1798807492c73516d924dcaf855`。本地 origin/main 快照
`7a8aaac00d56c4af2892e7097731ecda86a90f1d`，本轮未刷新远端。
REUSE / BRIEF / DURABLE / IMPLEMENTATION；Owner 执行授权与 preflight 在
[BRIEF-XATTRFIX-R3.md](BRIEF-XATTRFIX-R3.md)。REPOSITORY_INVARIANT 的拆分范围已授权，
但必要验收失败使交付 readiness 为 NO。

| 候选文件 | 实测 physical lines | 实测 SHA-256 |
|---|---:|---|
| `window-executor-v5.sh` | 292 | `c10f2cf1c3aa7f9c2fc0bd9189e921375ce006e79b1976a921576db54f6010fb` |
| `window_helper_core.py` | 314 | `513b1abf58e75c4f93671409e7fd0d01a9af13c4a913ced99767f044440a0559` |
| `window_preimage_xattr.py` | 111 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` |
| `window_helper.py` | 353 | `48cd455b2595ca31d98b1edeecbda383ab64da100c8c7179629786b462bef38b` |
| `test_xattrfix_r3.py` | 320 | `a1f1dc9e47511fbdfcff7db28b0642bdb6771517a8cef3ca5a04dd7b85a59679` |

原件 974 行，Git `c4152e9a45e2f1798807492c73516d924dcaf855:scripts/fleet-window/window-executor-v5.sh`；SHA-256
`7af63a75ec376816dfa516c72f0edf29605725777c3564511c87ce57f5d47abe`。原件未在 Git 历史中替换/删除。

候选逻辑范围：extended 只留 flags；inventory 保留普通文件记录并增加 reserved
`_xattrs_map`，单进程 `/usr/bin/xattr -lrsx`（-s nofollow，-x 完整 hex）；歧义路径、
解析错误、非零rc与stderr均拒绝。preimage ditto 后对比完整源/目的属性，非空差异
拒绝，只有缺失空值允许 `xattr -s -w key '' target`，逐项日志与重算表相等。
prerequisites / preserve-config / final-binding 按授权适配 reserved。
这些是当前 diff 的实现描述，不是所有分支已验证的声明。

## 拆分映射表

行号以 base 原件与当前未提交候选为准。公共函数是移动重导出；verify 原720的
密集行仅物理换行以满足移动文件结构约束；完整 AST 等价测试定义尚未运行。

| 原件行号 | 新文件行号 | 范围 / 状态 |
|---|---|---|
| 1–88 | window-executor-v5.sh:1–88 | 声明/usage/boundaries 原文移动范围 |
| 89–97、781–782 | window-executor-v5.sh:89–100 | helper 包装器；内嵌 stdin 调用改为相邻文件调用 |
| 783–974 | window-executor-v5.sh:101–292 | rollback/traps/15 stages/main 整块保留；等价性硬门 NOT_RUN |
| 98–138 | window_helper_core.py:2–42 | imports/context/require/digest/receipt/run/meta 原文 |
| 154 | window_helper_core.py:43 | regular 原文 |
| 170–440 | window_helper_core.py:44–314 | ACL/manifest/authority/process/state/census/health 等公共定义原文 |
| 139–153 | window_preimage_xattr.py:11–13 | extended；授权 xattr 修复 |
| 155–169 | window_preimage_xattr.py:71–87 | inventory；授权 xattr 修复 |
| 441–454 | window_helper.py:4–17 | authority；移动分派原文；硬门 NOT_RUN |
| 455–460 | window_helper.py:18–23 | mutex；移动分派原文；硬门 NOT_RUN |
| 461–462 | window_helper.py:24–25 | mutex-check；移动分派原文；硬门 NOT_RUN |
| 463–472 | window_helper.py:26–35 | integrity；移动分派原文；硬门 NOT_RUN |
| 473–496 | window_helper.py:36–59 | clean；移动分派原文；硬门 NOT_RUN |
| 497–509 | window_helper.py:60–72 | sources；移动分派原文；硬门 NOT_RUN |
| 510–528 | window_helper.py:73–91 | fresh；移动分派原文；硬门 NOT_RUN |
| 529–539 | window_helper.py:92–102 | bundle；移动分派原文；硬门 NOT_RUN |
| 540–563 | window_helper.py:103–126 | prerequisites；授权修复/消费者适配 |
| 564–578 | window_helper.py:127–141 | quiet；移动分派原文；硬门 NOT_RUN |
| 579–588 | window_helper.py:142–151 | before-stop；移动分派原文；硬门 NOT_RUN |
| 589–601 | window_helper.py:152–164 | exit-check；移动分派原文；硬门 NOT_RUN |
| 602–619 | window_helper.py:165–183 | preimage；授权修复/消费者适配 |
| 620–626 | window_helper.py:184–190 | install-start；移动分派原文；硬门 NOT_RUN |
| 627–636 | window_helper.py:191–200 | install-failed；移动分派原文；硬门 NOT_RUN |
| 637–652 | window_helper.py:201–216 | install-success；移动分派原文；硬门 NOT_RUN |
| 653–676 | window_helper.py:217–243 | preserve-config；授权修复/消费者适配 |
| 677–703 | window_helper.py:244–275 | final-binding；授权修复/消费者适配 |
| 704–718 | window_helper.py:276–290 | plist-update；移动分派原文；硬门 NOT_RUN |
| 719–745 | window_helper.py:291–318 | verify；仅物理换行；AST硬门 NOT_RUN |
| 746–758 | window_helper.py:319–331 | hr-check；移动分派原文；硬门 NOT_RUN |
| 759–761 | window_helper.py:332–334 | hr-start；移动分派原文；硬门 NOT_RUN |
| 762–763 | window_helper.py:335–336 | hr-remaining；移动分派原文；硬门 NOT_RUN |
| 764–770 | window_helper.py:337–343 | rollback-summary；移动分派原文；硬门 NOT_RUN |
| 771–774 | window_helper.py:344–347 | phase；移动分派原文；硬门 NOT_RUN |
| 775–779 | window_helper.py:348–352 | release；移动分派原文；硬门 NOT_RUN |
| 780 | window_helper.py:353 | unknown operation 拒绝保留 |
| 无 | window_preimage_xattr.py:16–66、90–111 | 新增 fail-closed 批量解析/属性digest/空值重贴 |
| 无 | window_helper.py:1–3；window_helper_core.py:1 | imports / 来源说明 |
| 无 | test_xattrfix_r3.py:1–320 | 新 helper 自测与消费者隔离测试定义；仅 SyntheticTree 已运行 |

## 合成测试输出原文

实际 argv：`["/opt/homebrew/opt/python@3.14/bin/python3.14", "-B", "scripts/fleet-window/test_xattrfix_r3.py", "SyntheticTree"]`；rc=1。
原文件 `/usr/local/v5-boot-isolation/xattr-fix-test/r3-synthetic-output.txt`；
SHA-256 `918876faff6d2fd2f276daf9b0d7b67d0ea9a93a246267415eb60702a9bf4cb3`。
这是新拆分 helper 的 SyntheticTree 批次；不是旧 `stage_06_v2.py` 的控制器测试。
消费者测试与完整 Selftest 未运行。

```text
ISOLATION_ROOT=/usr/local/v5-boot-isolation/xattr-fix-test/r3-pc7hpigy
test_cli_errors_fail_closed (__main__.SyntheticTree.test_cli_errors_fail_closed) ... ok
test_five_fixture_classes (__main__.SyntheticTree.test_five_fixture_classes) ... FAIL
test_forced_empty_omission (__main__.SyntheticTree.test_forced_empty_omission) ... ok
test_nofollow_absolute_and_dangling (__main__.SyntheticTree.test_nofollow_absolute_and_dangling) ... ok
test_nonempty_changed_stops (__main__.SyntheticTree.test_nonempty_changed_stops) ... ok
test_nonempty_missing_stops_before_empty_repair (__main__.SyntheticTree.test_nonempty_missing_stops_before_empty_repair) ... ok
test_reserved_and_ambiguous_paths_rejected (__main__.SyntheticTree.test_reserved_and_ambiguous_paths_rejected) ... ok
test_single_process_batch_and_flags_only (__main__.SyntheticTree.test_single_process_batch_and_flags_only) ... ok
test_source_drift_stops (__main__.SyntheticTree.test_source_drift_stops) ... ok
test_unexpected_attribute_stops (__main__.SyntheticTree.test_unexpected_attribute_stops) ... ok

======================================================================
FAIL: test_five_fixture_classes (__main__.SyntheticTree.test_five_fixture_classes)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/private/tmp/dsh-fleet-window-tools/scripts/fleet-window/test_xattrfix_r3.py", line 84, in test_five_fixture_classes
    self.assertEqual(actual.get('none', {}), {})
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: {'com.apple.provenance': b'\x01\x02\x00aYZ\xf3\xdb\xa1t\xa4'} != {}
- {'com.apple.provenance': b'\x01\x02\x00aYZ\xf3\xdb\xa1t\xa4'}
+ {}

----------------------------------------------------------------------
Ran 10 tests in 0.258s

FAILED (failures=1)
EMPTY_XATTR_REAPPLIED {"attribute": "com.r3.empty", "path": "/usr/local/v5-boot-isolation/xattr-fix-test/r3-pc7hpigy/test_five_fixture_classes-g87eu9vb/target/empty"}
EMPTY_XATTR_REAPPLIED {"attribute": "com.r3.second", "path": "/usr/local/v5-boot-isolation/xattr-fix-test/r3-pc7hpigy/test_five_fixture_classes-g87eu9vb/target/multiple"}
EMPTY_XATTR_REAPPLIED {"attribute": "com.r3.empty", "path": "/usr/local/v5-boot-isolation/xattr-fix-test/r3-pc7hpigy/test_forced_empty_omission-z97sak1i/target/empty"}
EMPTY_XATTR_REAPPLIED {"attribute": "com.r3.second", "path": "/usr/local/v5-boot-isolation/xattr-fix-test/r3-pc7hpigy/test_forced_empty_omission-z97sak1i/target/multiple"}
EMPTY_XATTR_REAPPLIED {"attribute": "com.r3.empty", "path": "/usr/local/v5-boot-isolation/xattr-fix-test/r3-pc7hpigy/test_nofollow_absolute_and_dangling-r4cic571/target/empty"}
EMPTY_XATTR_REAPPLIED {"attribute": "com.r3.second", "path": "/usr/local/v5-boot-isolation/xattr-fix-test/r3-pc7hpigy/test_nofollow_absolute_and_dangling-r4cic571/target/multiple"}
```

五类全 PASS：FAIL。valued / empty / multiple 的内容断言与全 inventory 比较在失败行前
完成；none 类拒绝于 :84；dangling 在独立 nofollow 测试中通过。没有输出伪造的五类
PASS 原文。空值修复与非空差异拒绝有上述批次证据，但不能提升为完整交付 PASS。

## dry-run / selftest / diff-check / structure 原文状态

```text
dry-run baseline vs candidate: NOT_RUN (stopped after synthetic batch rc=1)
Selftest: NOT_RUN
Consumers: NOT_RUN
exact base/head structure gate: NOT_RUN (candidate not committed)
```

第一次合成进程之前 `git diff --check` 已运行 rc=0，stdout/stderr为空；
该次仅覆盖当时 tracked diff，不声称最终未提交/未跟踪候选全部通过。

```text
stdout: <empty>
stderr: <empty>
exit_code: 0
```

无新 dry-run/selftest 的进程输出，未复制 R1/R2 原件 dry-run 来充当前证据。

## Commit / push / PR

NOT_RUN / NOT_RUN / NOT_CREATED；PR URL=NOT_CREATED；merge=NOT_RUN。
HEAD保持 `c4152e9a45e2f1798807492c73516d924dcaf855`；没有改分支，没有启动生产阶段。
R1/R2 brief/receipt/stopped 文件保持原样；R3 brief 追加本轮 preflight。

## UNKNOWN 与限制

- 本机 `com.apple.provenance` 在所谓无属性夹具中持续存在的精确原因：UNKNOWN；
  不能由 `xattr -crs` rc=0 推断完全清空；本轮停止后未进一步调查。
- 新 helper 的 Selftest、三消费者完整运行、dry-run 原件diff、15stage字节/其他op AST
  硬门、精确结构gate：NOT_RUN，拆分等价性未成立。
- 长路径/无法解析的属性名或输出/控制字符路径：候选 fail-closed；真实生产兼容性 UNKNOWN。
- 全量树性能、内存、ACL/hardlink/混合属主/实际生产preimage保真：UNKNOWN。
- 安装/加载/运行验收、C6解堵、新窗口GO、认证与业务结果：UNKNOWN；零生产接触。
- 远端branch/PR新鲜状态：UNKNOWN；本轮无远端发布或查询。
- 独立 review：R3 范围授权初审通过；最终候选验收被本必需门阻断，未声称最终 PASS。

## 独立停点复核

非作者 `/root/authority_review` 只读核对当前 HEAD/base、失败 :84、10 tests/9ok/1fail、
日志原文与 SHA-256、五份候选文件哈希/行数、cached diff 为空，以及 R1/R2/旧 stage06/
治理文件未改，结论为停点记录准确；未运行测试/xattr/生产访问、未改文件。
该复核只认证 STOPPED/RECEIPT 的准确性，不认证候选通过最终验收；
FROZEN_BLOCKER_UNION=[REQUIRED_GATE_FAILURE: five-fixture batch rc=1]。
