# RECEIPT-XATTRFIX-R2

结果：**STOPPED_REPOSITORY_INVARIANT_CONFLICT；xattr 修复未实施；五类合成树测试 NOT_RUN。**
精确冲突和独立复核见 [STOPPED-XATTRFIX-R2.md](STOPPED-XATTRFIX-R2.md)。R2 已闭合旧三处消费者的 SCOPE_ESCALATION；本轮停点是已接受的结构规则与当前单文件修改范围的冲突。

## 坐标与路由

```json
{
  "recorded_at": "2026-11-04T11:59:30.242007+00:00",
  "worktree": "/private/tmp/dsh-fleet-window-tools",
  "branch": "chore/fleet-window-tools",
  "head": "c4152e9a45e2f1798807492c73516d924dcaf855",
  "local_origin_main_snapshot": "7a8aaac00d56c4af2892e7097731ecda86a90f1d",
  "executor_physical_lines": 974,
  "executor_sha256": "7af63a75ec376816dfa516c72f0edf29605725777c3564511c87ce57f5d47abe",
  "executor_equals_HEAD": true,
  "registry_rows": [],
  "generated_allowlisted": false,
  "fixed_baseline": "d506f81105e8aa05177a01b817ebe11dcc076ba5",
  "fixed_baseline_entry": "",
  "rule_acceptance_commit": "cb827a696f8cb55927555472fa38ce103592fcdd",
  "rule_commit_ancestor_HEAD_and_origin_main": [
    0,
    0
  ]
}
```

PREFLIGHT：REUSE / BRIEF / DURABLE；ROUTE_STAGE=IMPLEMENTATION；任务仍是一次性窗口工具内部保真修复，无新产品合同。执行授权见原样保留的 [BRIEF-XATTRFIX-R2.md](BRIEF-XATTRFIX-R2.md) 与前轮 [BRIEF-XATTRFIX.md](BRIEF-XATTRFIX.md)。Architecture / Current Decisions 未授权生产或放宽结构规则；当前相关 accepted 约束是 CODE_STRUCTURE_GUARDRAILS_V2 与 CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1。IMPLEMENTATION_ALLOWED=NO、MERGE_READY=NO、PRODUCTION_OPERATION_ALLOWED=NO，因新识别的结构冲突而停止依赖实施。

独立 reviewer `/root/xattr_scope_review` 的非作者只读复核：974 行、in-scope .sh、无例外/allowlist、固定基线缺失、已接受规则在 HEAD 和本地 origin/main 祖先链中；修改且仍 >500 行会成为 candidate blocker。未发现三处之外的新消费者。未写实现或执行测试。

## Patch diff（含三处适配状态）

命令：`git diff -- scripts/fleet-window/window-executor-v5.sh`；rc=0。输出为空，执行器与 HEAD 完全相同。

```diff
```

三处适配均 NOT_IMPLEMENTED：prerequisites 排除 reserved `_xattrs_map`；preserve-config 按现存文件路径比较 xattr 子集且补齐后比完整 inventory；final-binding 直接比完整属性表且只对文件记录剥 uid/gid 和检查 custody。未伪称有补丁。

## 五类合成测试输出原文

未启动测试，因此没有测试进程输出；以下仅为状态标注。

```text
NOT_RUN: stopped before implementation due to accepted code-structure invariant / bounded single-file scope conflict.
valued: NOT_RUN
empty: NOT_RUN
multiple: NOT_RUN
none: NOT_RUN
dangling: NOT_RUN
inventory + ditto + reconcile + empty-value reapply: NOT_RUN
```

未创建或修改 `/usr/local/v5-boot-isolation/xattr-fix-test/`，未运行任何 xattr/ditto，不能报告五类全 PASS。

## Dry-run 输出原文

命令：`/bin/bash /private/tmp/dsh-fleet-window-tools/scripts/fleet-window/window-executor-v5.sh --dry-run`；rc=0。这是未修改原执行器的安全边界检查，stage/helper 调用数为 0，不验证补丁。

stdout:

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

stderr:

```text
```

## Diff check 输出原文

命令：`git diff --check`；rc=0。

stdout:

```text
```

stderr:

```text
```

## Commit / push / PR

NOT_RUN / NOT_RUN / NOT_CREATED。PR URL：NOT_CREATED。停止前 HEAD 保持 `c4152e9a45e2f1798807492c73516d924dcaf855`；没有 commit/push/merge，不把文档停点当修复提交。

## UNKNOWN / 限制

- 新 CLI 解析的实际格式、nofollow、二进制/歧义路径处理、空值重贴、非空差异拒绝：NOT_RUN。
- 五类复制保真和新消费者运行行为：NOT_RUN。
- 结构 gate 的实际运行结果：NOT_RUN；报告的是已接受规则 + 既有 verifier 的确定路径推导，不是假造的失败输出。
- 全量树耗时、内存、权限/ACL/硬链接保真：UNKNOWN。
- 历史 stage_06 实际复制差异与完整因果：UNKNOWN，未升级历史 H2 证据强度。
- 生产适用性、安装/加载/运行状态、C6 解堵、新窗口 GO、认证/业务结果：UNKNOWN / 未验证，零生产接触。
- 远端分支/PR 最新状态：UNKNOWN，本轮未 fetch 或访问 GitHub；本地 tracking snapshot 不是远端新鲜读回。
- 原执行器其他逻辑及 dry-run 05b 既有漏报未改。

实际新增文件仅本回执与 STOPPED-XATTRFIX-R2.md；原四份交接文件保持原样。
