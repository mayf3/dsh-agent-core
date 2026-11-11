# STOPPED-XATTRFIX-R4

状态：**STOPPED_REQUIRED_GATE_FAILURE**；记录时间：2026-11-04T12:24:51.497965+00:00。

worktree=/private/tmp/dsh-fleet-window-tools；branch=chore/fleet-window-tools；
HEAD/base=c4152e9a45e2f1798807492c73516d924dcaf855（未变）。
执行授权与 Owner R4 裁定见 [BRIEF-XATTRFIX-R4.md](BRIEF-XATTRFIX-R4.md)。

## 精确停点

- SOURCE：用户 R4 任务顺序第3项 `git diff --check rc0` 与红线“失败即停”。
  本轮全部拆分+xattr 产物包含4份新文件；只检查 tracked working diff 不覆盖它们，
  故 stage 全部候选后还必须对 cached diff 执行同款检查。
- COUNTEREXAMPLE：`git diff --check` rc0、stdout/stderr为空；
  `git diff --cached --check` **rc=2**，stderr为空，stdout原文：

```text
scripts/fleet-window/window_helper_core.py:314: new blank line at EOF.
```

- 失败坐标：`scripts/fleet-window/window_helper_core.py:314`。
  该文件从 R3 继承，当前314行、SHA-256=
  `513b1abf58e75c4f93671409e7fd0d01a9af13c4a913ced99767f044440a0559`，
  与 R4 开始时相同；本轮没有删掉 EOF 空行或继续修复。
- IMPACT：REQUIRED_GATE_FAILURE；
  affected_readiness=[COMMIT_READY, PUSH_READY, PR_READY] 全部 NO；
  MERGE_READY=NO；PRODUCTION_OPERATION_ALLOWED=NO。
  不能以 working diff rc0 代替包含所有新文件的 cached 必需门。
- MINIMAL_CLOSURE：后续续办授权下，只移除该文件额外 EOF 空行、保留正常末尾换行；
  对完整候选重新执行 diff --check 并绑定新哈希/行数；独立审查该机械 delta，
  然后完成尚未执行的精确 commit 结构门、最终候选审查、push+新 PR。
  已通过的测试证据可经影响核对复用，不能声称未执行门已 PASS。
  这里没有实施该后续动作，也没有放宽验收门。

## 已通过证据与剩余状态

- SyntheticTree：10 tests / 10 ok / rc0，五类夹具均实际输出 PASS。
  R4 none 改为双侧 provenance 存在、完整原始映射与 provenance bytes 相等，
  同时比较 inventory none digest；原全树 inventory 相等硬门保留。
- 原件/candidate dry-run：两者rc0，stdout+stderr逐字节相同；
  两个 diff rc0且0字节；stageFunctionsCalled=0。
- Selftest + Consumers：7 tests / 7 ok / rc0；
  15 stage/main/rollback/traps BYTE_IDENTICAL，未授权改变的 Python operation/core
  AST_IDENTICAL，三处消费者在合规唯一合成树通过。
- 全部通过输出原文、断言 diff、文件哈希见
  [RECEIPT-XATTRFIX-R4.md](RECEIPT-XATTRFIX-R4.md)。
- 精确 commit 结构门=NOT_RUN；独立最终交付审查=NOT_COMPLETED；
  commit/push=NOT_RUN；PR URL=NOT_CREATED；merge=NOT_RUN。
  旧 PR #614 为 MERGED，不是本次交付；远端初始 branch 仍为原HEAD。
- 不运行 executor --execute，不访问生产树/服务/端口/launchd，不改旧stage06 controller，
  无生产接触。安装/加载/运行、C6 解堵、新窗口GO、认证/业务结果均 UNKNOWN。

## 原始证据与保全

- 证据根：`/usr/local/v5-boot-isolation/xattr-fix-test/r4-evidence-gpkt4p5c`。
- `diff-check-result.json` 绑定两个命令、UTC、真实rc和输出字节数；
  SHA-256=`57ab0f79ee5ddbc81e9e25ce0f0d4e92cba4498222c6fdae2b87d822c41a5617`。
- `diff-check-cached.stdout` 为71字节失败原文；
  SHA-256=`1a17823c6e7d69f300a67a64363a98a42c83359355ea50713811e60dea3a8900`；
  `diff-check-cached.stderr` 为空。
- `stopped-cached.diff` 保全失败时完整 index diff（包括当时尚待更新的R4回执）；
  SHA-256=`c5c9c059a1a473c8b1130c83762efc7064734482ed8a046415f0ce465eab022e`，185817字节；
  `stopped-state.json` 绑定停点时间和HEAD。
- 实现与断言保持失败时字节；暂存候选未commit。失败后的写入仅限停点证据、
  本 STOPPED 与更新 R4 RECEIPT；历史R1/R2/R3记录和原件保留。

## 独立停点复核

非作者 `/root/independent_review` 只读复核通过：HEAD未变；五份候选
index/worktree一致；四份实现与历史记录初始哈希未变；断言符合R4裁定；
10/10、dry-run空diff、7/7原文与哈希均匹配；cached失败原文和快照哈希匹配。
STOPPED/RECEIPT对未运行结构门、未完成交付审查及未commit/push/PR的表述准确。
复核未写文件、未修复、未重跑测试或diff-check；仅认证停点记录，不认证交付PASS。
FROZEN_BLOCKER_UNION=[REQUIRED_GATE_FAILURE: cached diff-check rc2]。
