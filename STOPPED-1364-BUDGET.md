# STOPPED-1364-BUDGET

停止时间：2026-11-07T08:10:33Z。状态：`STOPPED / REQUIRED_GATE_FAILURE`。

## 触发依据

当前用户执行指令的停止条件为「失败即停写 STOPPED-1364-BUDGET.md」。首次修复后定向门禁实际 rc=1，已立即停止后续源码/测试修改、测试执行及交付。本停止不属于 LOAD_BEARING SPEC_GAP，也不是自动审批拒绝。

```text
node --test --test-name-pattern='#1364' packages/workflow-execution/test/continuation.test.js
tests 7
pass 6
fail 1
GREEN_RC=1

test at packages/workflow-execution/test/continuation.test.js:94:1
AssertionError [ERR_ASSERTION]: already admitted tail is never delivered again
2 !== 3
at TestContext.<anonymous> (.../continuation.test.js:115:12)
actual: 2
expected: 3
```

完整原文：[green.tap](/private/tmp/h1364-budget-evidence/green.tap)，SHA-256 `800feb4afa8686e4336615bad2a075d244b4839e243469719a23c3f302ec7c65`。

## 只读定位与边界

失败前，该用例已经通过 250 个稳定异常队首跨三页、11 轮内两个正常项获得机会的断言。失败发生在随后模拟队首依赖恢复的部分；不能因此宣称整个用例或修复后套件为绿。

源码推断（根代理与独立只读审查一致，未额外复测）：`continuation.test.js:31` 的 `bad` Set 仍包含 firstHead；`:111–112` 只替换了 ledger policy，未同步调整 Set；`:50` 的模拟 deliverRun 断言仍拒绝该项，且发生在 `:52` 计数之前。`engine.js:124–128,152–153` 捕获异常并映射到 needs_review，可以解释「已有 mint、计数仍为 2」。这是夹具状态不一致的推断，尚未用修正后的执行证明。

## 保留坐标

- worktree：`/private/tmp/h1364-budget`
- branch：`fix/admission-budget-fairness`
- HEAD / 固定 base：`3c1bcf98bc40a2c34cca24f241c87d1b12cea216`
- 候选未提交、未 push、未建 PR、未合并；相关既有套件和结构门尚未运行，均为 UNKNOWN/未完成。
- 三个已跟踪文件的工作区 diff：224 additions / 8 deletions；`git diff --binary` SHA-256：`32b2867dcd7494e9f00b9251a7a6a2da5e78d28e0fe45274e9547484bc4a6508`。
- `src/engine.js` SHA-256：`9b11830dc968ae83b7a2d6f5e3a93105ce4bd479ebb0ab4b187eabe331273ef1`
- `src/ledger-admission.js` SHA-256：`d28bfea85dcec82c4bfa03beb86e0db123618e73c834eff8b4a40f37dd6f11ed`
- `test/continuation.test.js` SHA-256：`41830c052f0e0c00ad03eed9ea714f1c75ac25905a89d1ba1a0c481f69b47619`

上述 src/test 路径均相对 `packages/workflow-execution/`。详细回执见 [RECEIPT-1364-BUDGET.md](RECEIPT-1364-BUDGET.md)。

## 最小恢复条件

需要用户新的恢复指令解除本次「失败即停」，授权仅修正夹具的恢复状态一致性，再重跑同一定向门、文件展开的既有相关套件、结构门和独立候选审查；全部通过后才可 commit/push/建 PR。本轮不实施该修正，不以推断豁免失败。

总 feed 行数/页数上限仍与 WAE V3 CTR-WAE-001b:190–203,218 冲突；本候选通过完整分页、仅限制准入探测来移除该依赖。如后续要求的是总扫描上限，最低接受路径为 docs-first whole successor，精确替换扫描终止/跨轮延续语义，独审并接受入 base；本轮未改任何治理文件或 accepted 意义。

停止后仅做只读定位及本停止记录/回执收尾。无依赖重建、rebase、治理文档或 `.agents/tools` 修改；生产写入数为 0。

## R2 authorized continuation — fixture stop closed (2026-11-07)

The current user explicitly resumed the single fixture failure. R2 restored one shared bad Set rather than weakening assertions, then obtained targeted7/7 and affected219/219 rc0. Fresh main55f442c7 was fast-forward merged and the exact candidate restored without conflict; integrated targeted7/7 and affected265/265 rc0 (23 explicit files, including #644 blocked-recovery suites). Structure rc0 reports violations0 with visible inherited debt28; independent affected-contract review PASS. Original R1 STOP above remains history, and is archived byte-identically in docs/evidence/1364-admission-budget-r2/STOPPED-1364-R1.md. R2 has no newly triggered stop. Source committed; publication and final-HEAD coordinates are recorded in the current receipt/PR after actual readback. No production/governance edits, dependency rebuild, rebase or PR merge.

R2 publication completed: ordinary branch push rc0; PR https://github.com/mayf3/dsh-agent-core/pull/652 was created open/unmerged against main. Current receipt contains the actual readback; final receipt-only HEAD/push/review coordinates are bound in PR metadata.
