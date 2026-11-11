# STOPPED-MERGE — required gate failure

状态：STOPPED_REQUIRED_GATE_FAILURE。2026-11-04，worktree `/private/tmp/dsh-fleet-window-tools`，
branch `chore/fleet-window-tools`；唯一写者 `/root`。

- HEAD=`d4ecf90aea0a439419d75c97fb15ad1736e3b542`，未提交合并。
- MERGE_HEAD=`7a8aaac00d56c4af2892e7097731ecda86a90f1d`；包含请求的 #615 merge `97fa15a1`。
- shell 工作副本的冲突标记已编辑消除，但 index 仍 `UU`；未 stage 解决结果、未 abort/reset。
- SyntheticTree 10/10 rc0；原 974 行版与候选 dry-run 的 stdout/stderr literal diff 均 rc0；
  Selftest+Consumers 7/7 rc0，包括双基线字节/AST对照与七份源文件 <=500 的检查。
- 首个失败：C7 定向门 `python3 -B scripts/fleet-window/test_xattrfix_r3.py C7Close` rc1。
  原文见 `docs/reports/fleet-window-merge-c7-20261104/c7-focused.stderr.log`。
  `test_focused_and_migrated_close_release` 调用 `namespace['close_checks']()` 时 KeyError。

## Blocker

- CLASS=REQUIRED_GATE_FAILURE；SOURCE=本交办完整保留 C7 的验收要求、已记录 plan 的 focused C7门及失败即停红线。
- COUNTEREXAMPLE=测试脚手架只在 `main.body` 直接查找 `close_checks`；实际函数在 main 的 try 内，
  因而未被编译进 namespace。测试未执行到原 C7 focused 主体或迁移后的 close/release 集成断言。
- IMPACT=不能声称本轮 C7 定向执行验证通过；不据此断言产品 R6/R7 逻辑本身错误。
- MINIMAL_CLOSURE=下一轮明确续作授权后，修正此嵌套函数选择（例如遍历 main 的 AST），
  再按续作合同执行相应门；本轮不修复、不重跑，也不跳过失败门发布。
- affected_readiness=[COMMIT_READY, PUSH_READY, PR_UPDATE_READY, MERGE_READY]，均 NO。
- FROZEN_BLOCKER_UNION=[REQUIRED_GATE_FAILURE: C7 focused rc1 / KeyError close_checks]。

精确 source snapshot、SHA、冲突/双父 diff、index和原始进程记录已保存在同名报告目录。
失败后仅写停点/回执/证据，停止源码和测试修改。结构门、cached diff-check、commit/push、
PR #617 更新、PR merge 均 NOT_RUN。零生产接触；未执行窗口、实际清理或新canary。
完整回执见 [RECEIPT-MERGE.md](RECEIPT-MERGE.md)。
