# RECEIPT-MERGE

结果：**STOPPED_REQUIRED_GATE_FAILURE**。移植工作副本已形成，合成10/10、dry-run字节diff=∅、
Selftest+Consumers 7/7通过；新增 C7 定向门因测试提取脚手架 KeyError rc1，按红线立即停。
未stage冲突解决、未commit/push、未更新PR #617、未merge PR。不能声称全门完成。

## 坐标与范围

- worktree `/private/tmp/dsh-fleet-window-tools`；branch `chore/fleet-window-tools`；writer `/root`。
- 原分支 HEAD=`d4ecf90aea0a439419d75c97fb15ad1736e3b542`，停点未变。
- 原974行语义基线=`c4152e9a45e2f1798807492c73516d924dcaf855`；原shell SHA-256
  `7af63a75ec376816dfa516c72f0edf29605725777c3564511c87ce57f5d47abe`。
- C7权威实现对照=#615 merge `97fa15a138e4aafe7d566fc3c3d387c3594e87ba`；仅作为已接受实现对照，
  不把代码提升为长期产品权威。
- 本轮新鲜 fetch main=`7a8aaac00d56c4af2892e7097731ecda86a90f1d`；与请求97fa之间
  只有#616新增独立Spec。`git merge --no-commit --no-ff origin/main`返回预期的冲突rc1。
  MERGE_HEAD即7a8；只有shell内容冲突。手工移植后尚未stage，index仍UU，合并未完成。
- REUSE / BRIEF / DURABLE / IMPLEMENTATION；授权和门见 BRIEF-MERGE-C7.md。
  不授予生产操作、实际删除、PR merge或窗口GO。

## 冲突解决 diff 与双语义确认

完整原冲突在 `docs/reports/fleet-window-merge-c7-20261104/merge-conflict.json`；
相对分支父及main父的完整源码diff在 `conflict-resolution.json`，当前七份源码原文在
`source-snapshot.json`，精确index、状态和源哈希在 `stopped-state.json`。

- 保留本分支唯一实现模型：window_helper_core / window_helper / window_preimage_xattr。
  #615两份重复可执行模块已从工作副本退役，其真实 selftest 消费者全部迁到当前模块。
  历史 C7-EXTRACTION-MAP.json 原样保留，并注明不是当前模块映射。
- 原15节点/main/rollback/traps以原件逐字节比较，仅允许 #615 明确的等待提示、stage13
  `close → release`、`--selftest`入口delta；原全部core函数AST保留（xattr专属函数按既有
  授权已拆到xattr模块），新增validate_authority/quiet_ready逐条等同#615。
- dispatcher四个xattr消费者保持本分支修复；authority/quiet/close/release四分支AST与#615
  完全相等；其它op与原件AST相等，op集合=原件集合+close。window_close.py整文件字节等同#615。
  上述已在本轮7/7门执行通过，并获独立源码只读预核（不是最终交付验收）。
- stage00在取互斥前保存权威绑定的人工before快照、SHA、scope和改名映射；stage13重核
  before/c7输入不漂移，要求stage11 PASS、after时序/窗口/同口径；一对一改名无碰撞且
  映射后 added/removed同时为空，保留原始增删和改名映射。
- R7保留显式最新两代、人工保护代、四种保护marker、current目标及025/.bak材料；
  显式代际顺序精确覆盖直接.ds-old-*物理目录，拒绝symlink/非目录；JSON/NUL候选含精确
  路径及lstat身份，只列清单无删除。完成收据绑定c7-close摘要和NOT_EXECUTED_LIST_ONLY。
- 按本合同保留原dry-run字节文本，未把#615展示更新并入；旧文本150s/不列05b是已明确的
  展示债务，实际静默门原本即180s，执行仍含05b；C7实际逻辑和selftest/help已迁入。

## 工作副本源码绑定（失败后冻结）

| 文件 | physical lines | SHA-256 |
|---|---:|---|
| `window-executor-v5.sh` | 300 | `54e13bd198c970bef60433900bb70bd32c7f2d45d76d169da0507bedf79b9ddd` |
| `window_helper_core.py` | 329 | `8d09be1a716ed95893653678cf2b6afa040359ac1e5269d00714b65a81ff2632` |
| `window_helper.py` | 356 | `69de6831818b51828489d1d927155cfb45d4e27d3363f2421655072075e977da` |
| `window_preimage_xattr.py` | 111 | `b093eac8edf24fadee4309d755d04da06ae5fa1ab3d0df27c38bf9dc1ada2e0f` |
| `window_close.py` | 146 | `6488b91e382dfadf9bf0022d11747beb85071a5e70142e92e6c7348c9bef6465` |
| `window-selftest.py` | 383 | `b45a672a6dfde88046676ff0f73e55902a2dc6fc03200968b691d747d5b3d8ab` |
| `test_xattrfix_r3.py` | 433 | `7420767dc0ee8113f85c8b281b58ed4b64140de93dac1f6bbca2a91d37c2e8c2` |

七份拆分/移植/测试文件均<=500，此项在7/7门中通过。未触碰的stage_06_v2.py已有1116行；
不能声称全仓库或本目录所有历史文件<=500。正式exact-tree结构门尚未运行，不冒充候选结构PASS。

## 全门实际输出原文

每个进程argv/cwd/UTC起止/rc/stdout和stderr SHA在同目录 `*.command.json`，总索引在gates.json。
以下分别保留stdout与stderr；不声称跨stream时间顺序。测试中ERROR为真实进程结果，未修复重跑。

### 合成10/10

argv: `["/opt/homebrew/opt/python@3.14/bin/python3.14", "-B", "scripts/fleet-window/test_xattrfix_r3.py", "SyntheticTree"]`；rc=0。

stdout 原文：

```text
ISOLATION_ROOT=/usr/local/v5-boot-isolation/xattr-fix-test/r3-uwhdpbsl
EMPTY_XATTR_REAPPLIED {"attribute": "com.r3.empty", "path": "/usr/local/v5-boot-isolation/xattr-fix-test/r3-uwhdpbsl/test_five_fixture_classes-wg_mv0g9/target/empty"}
EMPTY_XATTR_REAPPLIED {"attribute": "com.r3.second", "path": "/usr/local/v5-boot-isolation/xattr-fix-test/r3-uwhdpbsl/test_five_fixture_classes-wg_mv0g9/target/multiple"}
FIXTURE valued: PASS (inventory + ditto + reconcile + full equality)
FIXTURE empty: PASS (inventory + ditto + reconcile + full equality)
FIXTURE multiple: PASS (inventory + ditto + reconcile + full equality)
FIXTURE none: PASS (inventory + ditto + reconcile + full equality)
FIXTURE dangling: PASS (inventory + ditto + reconcile + full equality)
DITTO_EMPTY_OMISSIONS=[["empty", "com.r3.empty"], ["multiple", "com.r3.second"]] REAPPLIED=2
EMPTY_XATTR_REAPPLIED {"attribute": "com.r3.empty", "path": "/usr/local/v5-boot-isolation/xattr-fix-test/r3-uwhdpbsl/test_forced_empty_omission-ajz4_xj7/target/empty"}
EMPTY_XATTR_REAPPLIED {"attribute": "com.r3.second", "path": "/usr/local/v5-boot-isolation/xattr-fix-test/r3-uwhdpbsl/test_forced_empty_omission-ajz4_xj7/target/multiple"}
EMPTY_XATTR_REAPPLIED {"attribute": "com.r3.empty", "path": "/usr/local/v5-boot-isolation/xattr-fix-test/r3-uwhdpbsl/test_nofollow_absolute_and_dangling-d_t5q2o3/target/empty"}
EMPTY_XATTR_REAPPLIED {"attribute": "com.r3.second", "path": "/usr/local/v5-boot-isolation/xattr-fix-test/r3-uwhdpbsl/test_nofollow_absolute_and_dangling-d_t5q2o3/target/multiple"}
```

stderr 原文：

```text
test_cli_errors_fail_closed (__main__.SyntheticTree.test_cli_errors_fail_closed) ... ok
test_five_fixture_classes (__main__.SyntheticTree.test_five_fixture_classes) ... ok
test_forced_empty_omission (__main__.SyntheticTree.test_forced_empty_omission) ... ok
test_nofollow_absolute_and_dangling (__main__.SyntheticTree.test_nofollow_absolute_and_dangling) ... ok
test_nonempty_changed_stops (__main__.SyntheticTree.test_nonempty_changed_stops) ... ok
test_nonempty_missing_stops_before_empty_repair (__main__.SyntheticTree.test_nonempty_missing_stops_before_empty_repair) ... ok
test_reserved_and_ambiguous_paths_rejected (__main__.SyntheticTree.test_reserved_and_ambiguous_paths_rejected) ... ok
test_single_process_batch_and_flags_only (__main__.SyntheticTree.test_single_process_batch_and_flags_only) ... ok
test_source_drift_stops (__main__.SyntheticTree.test_source_drift_stops) ... ok
test_unexpected_attribute_stops (__main__.SyntheticTree.test_unexpected_attribute_stops) ... ok

----------------------------------------------------------------------
Ran 10 tests in 0.246s

OK
```

### 原974行dry-run

argv: `["/bin/bash", "/dev/stdin", "--dry-run"]`；rc=0。

stdout 原文：

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

stderr 原文：

```text
<empty>
```

### 候选dry-run

argv: `["/bin/bash", "scripts/fleet-window/window-executor-v5.sh", "--dry-run"]`；rc=0。

stdout 原文：

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

stderr 原文：

```text
<empty>
```

### stdout literal diff

argv: `["/usr/bin/diff", "-u", "/private/tmp/dsh-fleet-window-tools/docs/reports/fleet-window-merge-c7-20261104/dry-run-original.stdout.log", "/private/tmp/dsh-fleet-window-tools/docs/reports/fleet-window-merge-c7-20261104/dry-run-candidate.stdout.log"]`；rc=0。

stdout 原文：

```text
<empty>
```

stderr 原文：

```text
<empty>
```

### stderr literal diff

argv: `["/usr/bin/diff", "-u", "/private/tmp/dsh-fleet-window-tools/docs/reports/fleet-window-merge-c7-20261104/dry-run-original.stderr.log", "/private/tmp/dsh-fleet-window-tools/docs/reports/fleet-window-merge-c7-20261104/dry-run-candidate.stderr.log"]`；rc=0。

stdout 原文：

```text
<empty>
```

stderr 原文：

```text
<empty>
```

### Selftest+Consumers 7/7

argv: `["/opt/homebrew/opt/python@3.14/bin/python3.14", "-B", "scripts/fleet-window/test_xattrfix_r3.py", "Selftest", "Consumers"]`；rc=0。

stdout 原文：

```text
DRY_RUN_DIFF=EMPTY vs original; C7 help/invalid-argument output+rc: IDENTICAL
DUAL_IDENTITY: original 15 stages/main/rollback/traps + exact declared C7 delta; core/op AST matches both baselines; window_close BYTE_IDENTICAL to #615
ISOLATION_ROOT=/usr/local/v5-boot-isolation/xattr-fix-test/r3-_olatx_4
```

stderr 原文：

```text
test_dry_run_and_help_identity (__main__.Selftest.test_dry_run_and_help_identity) ... ok
test_parser_fail_closed (__main__.Selftest.test_parser_fail_closed) ... ok
test_split_limits_and_syntax (__main__.Selftest.test_split_limits_and_syntax) ... ok
test_stage_and_dispatch_identity (__main__.Selftest.test_stage_and_dispatch_identity) ... ok
test_consumer_final_binding_full_attribute_map (__main__.Consumers.test_consumer_final_binding_full_attribute_map) ... ok
test_consumer_prerequisites (__main__.Consumers.test_consumer_prerequisites) ... ok
test_consumer_preserve_config_missing_attributed_file (__main__.Consumers.test_consumer_preserve_config_missing_attributed_file) ... ok

----------------------------------------------------------------------
Ran 7 tests in 0.378s

OK
```

### C7定向门 首败

argv: `["/opt/homebrew/opt/python@3.14/bin/python3.14", "-B", "scripts/fleet-window/test_xattrfix_r3.py", "C7Close"]`；rc=1。

stdout 原文：

```text
C7_ISOLATION_ROOT=/usr/local/v5-boot-isolation/xattr-fix-test/merge-c7-hy57iovy
```

stderr 原文：

```text
test_focused_and_migrated_close_release (__main__.C7Close.test_focused_and_migrated_close_release) ... ERROR

======================================================================
ERROR: test_focused_and_migrated_close_release (__main__.C7Close.test_focused_and_migrated_close_release)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/private/tmp/dsh-fleet-window-tools/scripts/fleet-window/test_xattrfix_r3.py", line 386, in test_focused_and_migrated_close_release
    namespace['close_checks']()
    ~~~~~~~~~^^^^^^^^^^^^^^^^
KeyError: 'close_checks'

----------------------------------------------------------------------
Ran 1 test in 0.057s

FAILED (errors=1)
```

## 停点、未运行与 UNKNOWN

C7Close只直接遍历main.body，漏掉try中的close_checks，导致KeyError。该错误由本轮新增测试
脚手架引入。已完成其前置的迁移纯函数/phase校验，但原C7 focused主体、close/release集成断言
未运行，不能把源码等同/7门通过扩称C7动态验证PASS。最小续作是修嵌套AST选取并按新授权续跑。

- 结构exact-tree门、cached diff-check：NOT_RUN（首败后停止）；不借用历史结果。
- stage冲突解决、commit、push、PR #617 update：NOT_RUN；PR保持原远端HEAD的本轮初查结果。
- PR #617初查为OPEN、CONFLICTING、head=d4ecf90a；失败后未再次远端查验，最新状态UNKNOWN。
  URL：https://github.com/mayf3/dsh-agent-core/pull/617 。PR merge=NOT_RUN。
- 完整C7 --selftest/fresh canary：本轮NOT_RUN；未重放#615的历史日志充新执行。
- 真实生产preimage规模/性能/ACL/hardlink/混合属主保真、实际安装/加载/运行/认证/业务结果：UNKNOWN。
- C6解堵、C7生产接受、新窗口GO：UNKNOWN；PRODUCTION_OPERATION_ALLOWED=NO；零生产接触。
- 未删除代际目录、bak或025材料；仅测试自建隔离mutex的释放在C7首败前未执行到。
- 独立最终交付审查：NOT_COMPLETED；独立停点复核另记，只认证停点准确性。
- FROZEN_BLOCKER_UNION=[REQUIRED_GATE_FAILURE: C7 focused rc1 / KeyError close_checks]。
  COMMIT_READY=PUSH_READY=PR_UPDATE_READY=MERGE_READY=NO。

详见 [STOPPED-MERGE.md](STOPPED-MERGE.md)。失败后仅保存证据、停点和本回执，未修源码、
未重跑门、未发布。原历史R1-R4/C7回执与失败记录不被重写。

## 独立停点复核

非作者 `/root/c7_review` 只读复核 STOPPED_RECORD_RECHECK=PASS：26项归档SHA/字节一致，
14段回执stdout/stderr逐段等同原日志；七源原文/哈希/行数及HEAD/MERGE_HEAD/未解决index
与冻结记录一致。首败诊断准确；仅认证停点记录，不认证全门通过或交付。
FROZEN_BLOCKER_UNION保持1项；COMMIT/PUSH/PR_UPDATE/MERGE_READY均NO，NEXT_ACTION=STOP。
完整schema_version2结果见 `docs/reports/fleet-window-merge-c7-20261104/INDEPENDENT-STOP-REVIEW.md`。
失败后源码/index没有再写，仅追加本独立证据。
