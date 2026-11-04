# RECEIPT-XATTRFIX-R4

结果：**STOPPED_REQUIRED_GATE_FAILURE**。R3 唯一失败已按 Owner R4 裁定
闭合；本轮五类合成 10/10、dry-run diff=∅、Selftest/Consumers 7/7 PASS。
完整候选 cached diff 检查因 core 文件 EOF 空行 rc2，按“失败即停”保全，
未commit/push/PR。精确停点见 [STOPPED-XATTRFIX-R4.md](STOPPED-XATTRFIX-R4.md)。
零生产接触；未运行 executor --execute；不 merge。

## 坐标与授权

- 记录时间：2026-11-04T12:23:08.477534+00:00。
- worktree：/private/tmp/dsh-fleet-window-tools；branch：chore/fleet-window-tools；
  执行者 /root；独立非作者审查者 /root/independent_review。
- 原件/父 HEAD：c4152e9a45e2f1798807492c73516d924dcaf855。
  新鲜远端 main：7a8aaac00d56c4af2892e7097731ecda86a90f1d；
  `git merge-base --is-ancestor c4152e9a 7a8aaac0` rc0，原件已在 main 历史内。
- 远端 branch 初始 HEAD=c4152e9a；旧 PR #614 为 MERGED；
  本次需新 PR，不复用旧 PR 的交付结论。
- REUSE / BRIEF / DURABLE / IMPLEMENTATION；当前 preflight 与本裁定原文见
  [BRIEF-XATTRFIX-R4.md](BRIEF-XATTRFIX-R4.md)，继承 R1/R2/R3 已授权拆分与修复范围。
  不创建或改变长期产品 Contract；结构规则/registry/治理文件未修改。
- 仅 R4 测试断言和 R4 brief/receipt 新增；四份拆分实现、R1/R2/R3 brief/receipt/stopped
  与 R4 开始时实测 SHA-256 一致，历史失败没有被重写。
- `FROZEN_BLOCKER_UNION`：R3 five-fixture required gate rc1 已按裁定由本轮rc0闭合；
  新实测 REQUIRED_GATE_FAILURE 为完整 cached diff-check rc2，阻断commit/push/PR。
  独立最终交付审查未完成；停点复核另记，不冒充交付PASS。
- 原始证据目录：`/usr/local/v5-boot-isolation/xattr-fix-test/r4-evidence-gpkt4p5c`；每个进程单独保留 argv/cwd/rc/UTC 时间/输出 SHA-256。
  `evidence-manifest.json` 绑定该时点的初始快照、断言 diff、全部日志/结果文件。

## 断言 diff（相对 R3 候选）

实际 inventory 的根级 `_xattrs_map` 是 relpath→digest；文件记录不内嵌属性表。
因此以 `xattr_values` 取原始 bytes 映射，显式证明两侧 provenance 存在和逐字节相等，
并比较完整属性映射与 inventory 内 none 摘要；原先全树 inventory 相等硬门保留。
注释锚定 BRIEF-XATTRFIX-R4.md 的裁定，不过滤或忽略 OS 属性。

```diff
--- R3/test_xattrfix_r3.py
+++ R4/test_xattrfix_r3.py
@@ -81,7 +81,19 @@
         self.assertEqual(actual['empty']['com.r3.empty'], b'')
         self.assertEqual(actual['multiple']['com.r3.second'], b'')
         self.assertEqual(actual['multiple']['com.r3.binary'], bytes.fromhex('00FF0A0D3A20' + 'AB' * 64))
-        self.assertEqual(actual.get('none', {}), {})
+        # BRIEF-XATTRFIX-R4.md, regulatory ruling: none means source/target
+        # consistency, not emptiness; macOS reapplies com.apple.provenance.
+        # inventory stores root-level per-path digests; xattr_values retains
+        # the raw bytes needed to prove both collectors saw the OS attribute.
+        source_none = xattrs.xattr_values(self.source).get('none', {})
+        target_none = actual.get('none', {})
+        provenance = 'com.apple.provenance'
+        self.assertIn(provenance, source_none)
+        self.assertIn(provenance, target_none)
+        self.assertEqual(source_none, target_none)
+        self.assertEqual(source_none[provenance], target_none[provenance])
+        self.assertEqual(self.before[xattrs.XATTRS_KEY]['none'],
+                         xattrs.inventory(self.target)[xattrs.XATTRS_KEY]['none'])
         self.assertTrue((self.target / 'dangling').is_symlink())
         self.assertEqual(os.readlink(self.target / 'dangling'), 'missing-only-in-this-fixture')
         self.assertEqual(bytes.fromhex(cli('-spx', 'com.r3.value', self.target / 'valued').stdout.decode()), b'hello')
```

## 拆分产物与保全

| 文件 | physical lines | SHA-256 |
|---|---:|---|
| `window-executor-v5.sh` | 292 | `c10f2cf1c3aa7f9c2fc0bd9189e921375ce006e79b1976a921576db54f6010fb` |
| `window_helper_core.py` | 314 | `513b1abf58e75c4f93671409e7fd0d01a9af13c4a913ced99767f044440a0559` |
| `window_helper.py` | 353 | `48cd455b2595ca31d98b1edeecbda383ab64da100c8c7179629786b462bef38b` |
| `window_preimage_xattr.py` | 111 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` |
| `test_xattrfix_r3.py` | 332 | `36408fea4dd5fe9ab7c674ddaeadeff8b7afaf99391dfd773c86ca21f9d8f68c` |

原件 974 行：
`c4152e9a45e2f1798807492c73516d924dcaf855:scripts/fleet-window/window-executor-v5.sh`，
SHA-256=`7af63a75ec376816dfa516c72f0edf29605725777c3564511c87ce57f5d47abe`。
原行号→新文件行号详见 [R3 receipt 拆分映射表](RECEIPT-XATTRFIX-R3.md#拆分映射表)；
四份实现的行号/字节未变；测试唯一 R4 delta 为原 :84 扩为 :84–96，后续行号加12。
本轮已实际验证 15 stage/main/rollback/traps 字节等价、其他未授权改变的 Python
operation 与 core 函数 AST 等价。四个适配 op 的语义测试按既有范围执行。
不对未变的旧 `stage_06_v2.py` controller 声称本轮测试覆盖。

## 10/10 合成测试输出原文

argv：`["/opt/homebrew/opt/python@3.14/bin/python3.14", "-B", "scripts/fleet-window/test_xattrfix_r3.py", "SyntheticTree"]`；rc=0。
合并 stdout/stderr 原文 `synthetic-output.txt`，SHA-256=`3c938989f7788c72fc921b76315ab1efae3f193c7c7f7927cbc8091aa4a35139`。

```text
ISOLATION_ROOT=/usr/local/v5-boot-isolation/xattr-fix-test/r3-h25c86ll
test_cli_errors_fail_closed (__main__.SyntheticTree.test_cli_errors_fail_closed) ... ok
test_five_fixture_classes (__main__.SyntheticTree.test_five_fixture_classes) ... EMPTY_XATTR_REAPPLIED {"attribute": "com.r3.empty", "path": "/usr/local/v5-boot-isolation/xattr-fix-test/r3-h25c86ll/test_five_fixture_classes-tf37gcmr/target/empty"}
EMPTY_XATTR_REAPPLIED {"attribute": "com.r3.second", "path": "/usr/local/v5-boot-isolation/xattr-fix-test/r3-h25c86ll/test_five_fixture_classes-tf37gcmr/target/multiple"}
FIXTURE valued: PASS (inventory + ditto + reconcile + full equality)
FIXTURE empty: PASS (inventory + ditto + reconcile + full equality)
FIXTURE multiple: PASS (inventory + ditto + reconcile + full equality)
FIXTURE none: PASS (inventory + ditto + reconcile + full equality)
FIXTURE dangling: PASS (inventory + ditto + reconcile + full equality)
DITTO_EMPTY_OMISSIONS=[["empty", "com.r3.empty"], ["multiple", "com.r3.second"]] REAPPLIED=2
ok
test_forced_empty_omission (__main__.SyntheticTree.test_forced_empty_omission) ... ok
test_nofollow_absolute_and_dangling (__main__.SyntheticTree.test_nofollow_absolute_and_dangling) ... ok
test_nonempty_changed_stops (__main__.SyntheticTree.test_nonempty_changed_stops) ... ok
test_nonempty_missing_stops_before_empty_repair (__main__.SyntheticTree.test_nonempty_missing_stops_before_empty_repair) ... ok
test_reserved_and_ambiguous_paths_rejected (__main__.SyntheticTree.test_reserved_and_ambiguous_paths_rejected) ... ok
test_single_process_batch_and_flags_only (__main__.SyntheticTree.test_single_process_batch_and_flags_only) ... ok
test_source_drift_stops (__main__.SyntheticTree.test_source_drift_stops) ... ok
test_unexpected_attribute_stops (__main__.SyntheticTree.test_unexpected_attribute_stops) ... ok

----------------------------------------------------------------------
Ran 10 tests in 0.275s

OK
EMPTY_XATTR_REAPPLIED {"attribute": "com.r3.empty", "path": "/usr/local/v5-boot-isolation/xattr-fix-test/r3-h25c86ll/test_forced_empty_omission-o_av_g7v/target/empty"}
EMPTY_XATTR_REAPPLIED {"attribute": "com.r3.second", "path": "/usr/local/v5-boot-isolation/xattr-fix-test/r3-h25c86ll/test_forced_empty_omission-o_av_g7v/target/multiple"}
EMPTY_XATTR_REAPPLIED {"attribute": "com.r3.empty", "path": "/usr/local/v5-boot-isolation/xattr-fix-test/r3-h25c86ll/test_nofollow_absolute_and_dangling-q9j8zaj8/target/empty"}
EMPTY_XATTR_REAPPLIED {"attribute": "com.r3.second", "path": "/usr/local/v5-boot-isolation/xattr-fix-test/r3-h25c86ll/test_nofollow_absolute_and_dangling-q9j8zaj8/target/multiple"}
```

## dry-run diff=∅

原件 argv：`["/bin/bash", "/dev/stdin", "--dry-run"]`（stdin 为 Git 原件）。
候选 argv：`["/bin/bash", "scripts/fleet-window/window-executor-v5.sh", "--dry-run"]`。
两者 rc=0；stdout SHA-256 均为
`e7e1500a2b9d43cc8017596aeb404c6d04e032a2c0211f517c031a6a99f608b7`；
stderr 均空，SHA-256=`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`。
两个 `/usr/bin/diff -u` 进程均 rc0，stdout/stderr diff 文件各0字节。
原文分别保存在 dry-run-original.stdout/stderr 与 dry-run-candidate.stdout/stderr；
完整 argv/rc/hash 在 dry-run-result.json。边界输出原文：

```text
DRY_RUN_ONLY productionExecution=NOT_EXECUTED stageFunctionsCalled=0
BEGIN stage_00_authority_mutex [§4] authorization/expiry/unique writer; own mutex
END   stage_00_authority_mutex
BEGIN stage_01_integrity_clean [§1] pinned manifests; enumerate/hash/backup/delete ONLY untracked pnpm-lock.yaml; clean status
END   stage_01_integrity_clean
BEGIN stage_02_fresh_read [§1–2,4 + r5] source/Harness; plist/env/old PID; static hashes; live schema/identity/bindings + diff receipt
END   stage_02_fresh_read
BEGIN stage_03_dual_prerequisites [§3] accepted canary + full runtime; complete file/link membership; candidate binding
END   stage_03_dual_prerequisites
BEGIN stage_04_quiet_gate [§4 + r4] mtime >=150s AND read-only recovery census; unresolved/inflight/unknown refuses
END   stage_04_quiet_gate
BEGIN stage_05_old_exit [§4–5] final census; bootout; old PID + worker exit; supervisor absent
END   stage_05_old_exit
BEGIN stage_06_full_preimage [§5–6 + r5] live schema/identity/bindings + diff receipt; full current tree/config/plist/env/metadata + reused copies
END   stage_06_full_preimage
BEGIN stage_07_pinned_install [§5] root-owned physical WINDOW_BUNDLE; pinned THREE arguments + R3_BINDING_PAYLOAD; real rc
END   stage_07_pinned_install
BEGIN stage_08_install_receipt [§2,5–6] THIS install.log backup + reuse marker + completed §5b; closure PASS AND rc=0; carry forward omitted current config
END   stage_08_install_receipt
BEGIN stage_09_final_binding [§3,5 + r5] final closure/config bound to both receipts; live schema/identity/bindings + diff receipt
END   stage_09_final_binding
BEGIN stage_10_plist_bootstrap [§2,5] preserve all plist/env; deployed SHA only; bootstrap
END   stage_10_plist_bootstrap
BEGIN stage_11_production_verify [§5] exact new PID/env/listener owner/log features/public health; authenticated canonical UNKNOWN
END   stage_11_production_verify
BEGIN stage_12_hr_watch [r4] full 600s window; NEW broker execute as agent agt_hr-agent lines
END   stage_12_hr_watch
BEGIN stage_13_close [§7] bounded results; authentication/business NOT_TESTED; release own mutex
END   stage_13_close
FAILURE_BOUNDARY any failure -> STOP + phase receipt + §6 recipe; NO automatic recovery
```

## Selftest / Consumers 输出原文

argv：`["/opt/homebrew/opt/python@3.14/bin/python3.14", "-B", "scripts/fleet-window/test_xattrfix_r3.py", "Selftest", "Consumers"]`；rc=0；
`selftest-output.txt` SHA-256=`042716f9d4f4a388c434fd09e6fc004965d6c836450b41124694ea4a5e844409`。
fixture setUp 严格验证固定根是物理目录，并仅写其唯一子树。
Consumers 仅编译所选 AST 分支，注入合成路径/authority/service_absent；
不调用生产 dispatcher、不访问生产目录、服务/端口/launchd/模型。

```text
test_dry_run_and_help_identity (__main__.Selftest.test_dry_run_and_help_identity) ... DRY_RUN_DIFF=EMPTY; default/help/invalid-argument output+rc: IDENTICAL
ok
test_parser_fail_closed (__main__.Selftest.test_parser_fail_closed) ... ok
test_split_limits_and_syntax (__main__.Selftest.test_split_limits_and_syntax) ... ok
test_stage_and_dispatch_identity (__main__.Selftest.test_stage_and_dispatch_identity) ... IDENTITY 15 stage functions + main/rollback/traps: BYTE_IDENTICAL; other Python operations: AST_IDENTICAL
ok
ISOLATION_ROOT=/usr/local/v5-boot-isolation/xattr-fix-test/r3-bka0r4oa
test_consumer_final_binding_full_attribute_map (__main__.Consumers.test_consumer_final_binding_full_attribute_map) ... ok
test_consumer_prerequisites (__main__.Consumers.test_consumer_prerequisites) ... ok
test_consumer_preserve_config_missing_attributed_file (__main__.Consumers.test_consumer_preserve_config_missing_attributed_file) ... ok

----------------------------------------------------------------------
Ran 7 tests in 0.338s

OK
```

## git diff --check / 结构门 / 独立审查

全部16份候选文件 stage 后（包括4份新source/test文件与完整历史记录），
working diff-check rc0 不覆盖已暂存新文件；cached同款检查实际失败，不能省略。

```text
$ git diff --check
stdout: <empty>
stderr: <empty>
exit_code: 0

$ git diff --cached --check
scripts/fleet-window/window_helper_core.py:314: new blank line at EOF.
stderr: <empty>
exit_code: 2
```

原始进程数据：`diff-check-result.json`，SHA-256=
`57ab0f79ee5ddbc81e9e25ce0f0d4e92cba4498222c6fdae2b87d822c41a5617`；
`diff-check-cached.stdout` SHA-256=
`1a17823c6e7d69f300a67a64363a98a42c83359355ea50713811e60dea3a8900`。
失败时完整index快照 `stopped-cached.diff` SHA-256=
`c5c9c059a1a473c8b1130c83762efc7064734482ed8a046415f0ce465eab022e`。
此后仅写停点与回执证据，没有修源文件、复跑门或发布。
精确 base/head 结构门=NOT_RUN（尚无新commit），独立最终交付审查=NOT_COMPLETED；
独立初审未发现新具体 blocker，不替代实际必需门。

## commit / push / PR

commit=NOT_RUN；push=NOT_RUN；PR URL=NOT_CREATED；merge=NOT_RUN。
HEAD仍为 `c4152e9a45e2f1798807492c73516d924dcaf855`。
COMMIT_READY=PUSH_READY=PR_READY=MERGE_READY=NO；
PRODUCTION_OPERATION_ALLOWED=NO。本轮失败后按红线停止，不以旧 PR #614 充数。

## UNKNOWN 与限制

- 本机 OS provenance 自动重贴的因果判断为 Owner R4 裁定；本轮只验证两侧实际属性均存在、
  原始字节与 digest 一致，不声称识别所有 macOS 内部行为。
- 全量树性能、内存、ACL/hardlink/混合属主、特殊路径及实际生产 preimage 保真：UNKNOWN。
  非支持路径/输出保留 fail-closed，合成测试不替代生产兼容性验收。
- 实际安装/加载/运行验收、C6 解堵、新窗口 GO、认证和业务结果：UNKNOWN；
  PRODUCTION_OPERATION_ALLOWED=NO；零生产接触。
- 本轮无新PR/CI/合并，最终交付未完成；停止后远端未再次查询，当前远端新鲜状态
  UNKNOWN；不把旧PR合并、10/10或活动日志算作本轮发布成功。

## 独立停点复核

非作者 `/root/independent_review` 只读复核通过：HEAD未变；五份候选
index/worktree一致；四份实现与历史记录初始哈希未变；断言符合R4裁定；
10/10、dry-run空diff、7/7原文与哈希均匹配；cached失败原文和快照哈希匹配。
STOPPED/RECEIPT对未运行结构门、未完成交付审查及未commit/push/PR的表述准确。
复核未写文件、未修复、未重跑测试或diff-check；仅认证停点记录，不认证交付PASS。
FROZEN_BLOCKER_UNION=[REQUIRED_GATE_FAILURE: cached diff-check rc2]。
