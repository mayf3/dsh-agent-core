# STOPPED-523-R2 — REQUIRED_GATE_FAILURE

Stopped UTC: `2026-11-04T05:09:15.194980+00:00`. Contract: current `523-r2`, preserved verbatim in [BRIEF-523-R2.md](BRIEF-523-R2.md).

SOURCE = 当前用户合同：只有整合 20 fail 与独立基线 fail 集合精确相等才 push+PR；失败即停。
COUNTEREXAMPLE = 整合 608/586 pass/20 fail/2 skip；基线 599/584 pass/13 fail/2 skip。共同失败 13；整合独有失败 7；基线独有失败 0。`F_integration` 严格包含 `F_baseline`，相等 gate 不成立。
IMPACT = PUSH_READY=NO / PR_READY=NO / MERGE_READY=NO / OPERATION_ALLOWED=NO。未 push、未创建 PR、未 merge、无生产动作。
MINIMAL_CLOSURE = 保留本停工记录及完整比较；后续要恢复发布，需另行明确授权同等独立环境的候选复核/失败处置。本轮不修复、不重跑、不豁免。

结论：整合侧新增失败集合非空，按合同走失败停工分支；**不能宣称零回归**。六项原始错误包含 provisioning `EEXIST`，另一项为读取 undefined.turns；候选原轮共享依赖与本轮独立安装状态不同，**guard 源码引入这些失败的因果仍为 UNKNOWN**，本比较不能把环境差异包装成已确认源码回归，也不能据此放行。

## 整合独有的七个失败

1. `packages/agent-router/test/broker-rpc.test.js:112:1` — broker RPC: passes the exact immutable active-turn context beside actual agentId（整合 FAIL / 基线 PASS）。
2. `packages/agent-router/test/broker-rpc.test.js:146:1` — broker RPC: stale generation, settled execution, and cleared turn never forward ingress context（整合 FAIL / 基线 PASS）。
3. `packages/agent-router/test/broker-rpc.test.js:170:1` — broker RPC: delayed turn-A carrier cannot inherit live turn-B ingress context（整合 FAIL / 基线 PASS）。
4. `packages/agent-router/test/delivery.test.js:147:1` — D1 main first deliver: accepted, sessionId fixed main, one process, one prompt（整合 FAIL / 基线 PASS）。
5. `packages/agent-router/test/delivery.test.js:163:1` — D2 main again: same fixed session, process reused, no second mapping（整合 FAIL / 基线 PASS）。
6. `packages/agent-router/test/feishu-v2-normal.test.js:147:1` — V2 normal: the conversation-derived workspace is NEVER chosen（整合 FAIL / 基线 PASS）。
7. `packages/agent-router/test/primary-workspace.test.js:159:1` — D: imported agent — spawn hands the process the imported workspace + env mechanically（整合 FAIL / 基线 PASS）。

候选 HEAD 仍为 `492d579d185a524a9b56dd91ce8c3728fe6818a2`，parent=`f767e8d6608cdb0917aad2d471ba0454d0966a0f`；三 guard 文件与 D-008 的工作树 blob 均等于候选提交，tracked/staged diff 均为空。未修改源码、测试断言或基线；未触碰 ac1159-deploy。

基线 worktree `/private/tmp/dsh-523-baseline`，独立 pnpm install rc0，干净起点与测试后 tracked/untracked status 均为空；唯一包检查 rc1。完整命令、输出原文、20 项对照及环境限制见 [RECEIPT-523-R2.md](RECEIPT-523-R2.md)。

原整合 TAP SHA256 `0725db8bc5de77a29d8db961342ac71fb17f55fca67386bfbcec781aa141de59`；基线 TAP SHA256 `678673687b8e6f2e0e2c9b86b5cb5bfc342b6e4ba9c5556671e3661179cc0b06`。PR URL = `NOT_CREATED_STOPPED`。
