# RECEIPT-523-R3 — 七项环境噪声处置；发布门通过

本轮结果：七个 R2 整合独有失败在独立安装依赖后逐项 **7/7 PASS**，最终并发包检查中也全部 PASS。按当前 [523-r3 合同](BRIEF-523-R3.md) 归类为环境噪声。**没有产品源码修复、没有测试语义修正、没有 guard 弱化。** 最终包 rc=1 / 10 fail，全属固定基线的 13 项；`F_final ⊆ F_baseline`，新增失败 0。guard 单独和包内均 9/9。

PR URL：`PENDING_PUBLICATION`（本记录先随证据提交；创建后补写实际 URL）。不 merge、不关 #523、不访问 ac1159-deploy、不部署/重启或生产写入。旧 R1/R2 STOPPED 和原始输出保留为历史，不改写成当时通过。

## 坐标、安装与环境

- 仓库 `mayf3/dsh-agent-core`；worktree `/private/tmp/dsh-523-integration`；branch `ac-523-guard-integration`。
- 执行测试的 source HEAD：`492d579d185a524a9b56dd91ce8c3728fe6818a2`；固定 integration/base：`f767e8d6608cdb0917aad2d471ba0454d0966a0f`。R3 后续 commits 只持久化证据，源码和测试 bytes 不变。
- 当前远端 main 读数：`29d1cd86fd823a8d51bde9d0b3a58ccc56965912`。相对 base 仅新增 #527 三份 docs；独审确认不改变 SWITCH/Binding/workspace。本轮**未在 current main 上运行测试**、未重基；future resulting-main SHA=`NOT_CREATED`。
- Node `v26.7.0`，pnpm `11.7.0`。新 `node_modules` 是本 worktree 的实际目录，realpath=`/private/tmp/dsh-523-integration/node_modules`。旧 symlink 原样移到 `/private/tmp/dsh-523-r3-dependencies/original-node_modules-link`，target 仍 `/tmp/dsh-523-impl/node_modules`；未操作旧 target。
- 一次独立安装：`pnpm install --ignore-scripts --no-lockfile --node-linker=hoisted --package-import-method=copy --store-dir /private/tmp/dsh-523-r3-dependencies/store --registry=https://registry.npmjs.org --reporter=append-only`；private HOME=`/private/tmp/dsh-523-r3-dependencies/home`，rc0；未执行 install scripts、未改 manifest/lockfile。包含网络自动重试的 stdout/stderr 逐字保留在 [安装原文](docs/evidence/guard-integration-523-r3-20261104/pnpm-install.raw.txt)，命令/环境/时间/哈希见 [install.json](docs/evidence/guard-integration-523-r3-20261104/install.json)。
- 全部 **71** 个 registry 依赖的 name/version/package.json SHA256 与 R2 pretest 集合精确相等，差异 0：[dependency-comparison.json](docs/evidence/guard-integration-523-r3-20261104/dependency-comparison.json)。pre/post-focused、pre/post-package snapshots 另记录 provisioning links。
- 测试只传 R2 相同 PATH/TMPDIR 加各命令独立空起点的 `PRODUCTION_RUNTIME_ROOT`（路径在各 JSON），不继承 HOME、模型 key、生产配置或凭据。
- 逐个 exact-title 选择、每项独立 Node 进程、无 skip，再执行原始并发包命令。测试会 provisioning 本地依赖链接及硬编码 `/tmp/home` fixtures；这些 fixtures 未清理或猜测恢复，仍是环境限制。独立安装加执行时序变化足以按合同判定“本轮重跑通过的环境噪声”，**未证明某包版本或某一 EEXIST race 是唯一根因**，旧 preimage UNKNOWN 保留。

## 七项逐条归因与处置

下表的原文身份/位置来自 R2；每项选中测试恰好 1 个、pass=1/fail=0/skip=0，rc0；最终包再验 PASS。逐字 log 和命令 metadata 均可回读。

| 测试完整标题 / 原位置 | R1 错误 | R3 focused / 最终包 | 归因 | 处置 diff 与理由 |
|---|---|---|---|---|
| broker RPC: passes the exact immutable active-turn context beside actual agentId<br>`packages/agent-router/test/broker-rpc.test.js:112:1` | provisionHome symlink EEXIST | [1 PASS / rc0](docs/evidence/guard-integration-523-r3-20261104/focused-1.tap) · [argv/时间/hash](docs/evidence/guard-integration-523-r3-20261104/focused-1.json)；包 PASS | 环境 | `EMPTY`；原断言无需修改，独立重跑通过，未调用 SWITCH |
| broker RPC: stale generation, settled execution, and cleared turn never forward ingress context<br>`packages/agent-router/test/broker-rpc.test.js:146:1` | provisionHome symlink EEXIST | [1 PASS / rc0](docs/evidence/guard-integration-523-r3-20261104/focused-2.tap) · [argv/时间/hash](docs/evidence/guard-integration-523-r3-20261104/focused-2.json)；包 PASS | 环境 | `EMPTY`；原断言无需修改，独立重跑通过，未调用 SWITCH |
| broker RPC: delayed turn-A carrier cannot inherit live turn-B ingress context<br>`packages/agent-router/test/broker-rpc.test.js:170:1` | provisionHome symlink EEXIST | [1 PASS / rc0](docs/evidence/guard-integration-523-r3-20261104/focused-3.tap) · [argv/时间/hash](docs/evidence/guard-integration-523-r3-20261104/focused-3.json)；包 PASS | 环境 | `EMPTY`；原断言无需修改，独立重跑通过，未调用 SWITCH |
| D1 main first deliver: accepted, sessionId fixed main, one process, one prompt<br>`packages/agent-router/test/delivery.test.js:147:1` | provisionHome symlink EEXIST | [1 PASS / rc0](docs/evidence/guard-integration-523-r3-20261104/focused-4.tap) · [argv/时间/hash](docs/evidence/guard-integration-523-r3-20261104/focused-4.json)；包 PASS | 环境 | `EMPTY`；原断言无需修改，独立重跑通过，未调用 SWITCH |
| D2 main again: same fixed session, process reused, no second mapping<br>`packages/agent-router/test/delivery.test.js:163:1` | provisionHome symlink EEXIST | [1 PASS / rc0](docs/evidence/guard-integration-523-r3-20261104/focused-5.tap) · [argv/时间/hash](docs/evidence/guard-integration-523-r3-20261104/focused-5.json)；包 PASS | 环境 | `EMPTY`；原断言无需修改，独立重跑通过，未调用 SWITCH |
| V2 normal: the conversation-derived workspace is NEVER chosen<br>`packages/agent-router/test/feishu-v2-normal.test.js:147:1` | undefined.turns（未生成 FakeProc） | [1 PASS / rc0](docs/evidence/guard-integration-523-r3-20261104/focused-6.tap) · [argv/时间/hash](docs/evidence/guard-integration-523-r3-20261104/focused-6.json)；包 PASS | 环境 | `EMPTY`；原断言无需修改，独立重跑通过，未调用 SWITCH |
| D: imported agent — spawn hands the process the imported workspace + env mechanically<br>`packages/agent-router/test/primary-workspace.test.js:159:1` | provisionHome symlink EEXIST | [1 PASS / rc0](docs/evidence/guard-integration-523-r3-20261104/focused-7.tap) · [argv/时间/hash](docs/evidence/guard-integration-523-r3-20261104/focused-7.json)；包 PASS | 环境 | `EMPTY`；原断言无需修改，独立重跑通过，未调用 SWITCH |

语义测试修正=`NONE`；语义产品修正=`NONE`。处置 diff：`git diff 492d579d -- packages/agent-router docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md` 原文为空，见 [disposition.diff](docs/evidence/guard-integration-523-r3-20261104/disposition.diff)。本轮 commit 仅 Brief、既有历史停工证据和 R3 回执/证据；不宣称有源码修复。

## D-008 amendment 原文锚点与判定

[D-008 §20, L563–574](docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md#L563-L574)，已接受 amendment commit `fa7fea60374b64b6f869c418c4c6a7a9b98b3022` 在 base ancestry 内，base/candidate/current-main blob 均为 `0c3f6f6005794edec2faf666e4fb035a9c87b009`。直接约束为：

> chat/agent-turn 路径无条件先执行治理 guard（不按 channel 区分）：
> `resolveWorkspace(target.id) != resolveEffectiveWorkspace(current).workspacePath`
> 时，以 `SWITCH_WORKSPACE_MISMATCH` 结构化拒绝，并记录一行审计（ccId、from、to、
> code、双方路径）。guard 同步先于 `setLastSession` / `persistBinding`，拒绝时 Binding
> 与 bookmark 均不改动；同工作区切换保持原语义。

同段保留 `product-api POST /v1/switch-agent` 直接调用 `Router.switchAgent` 的操作员路径。现有 guard 和接线保持三文件完整字节：

| 文件 | R3 commit/worktree blob（与审定源相同） |
|---|---|
| `src/binding-resolution.js` | `172859f387a44828c892cd090dcc15e8b081bc66` |
| `src/index.js` | `d0a8ca89965ab01718c34f3db93660d5bb2e1fd3` |
| `test/route-chain/switch-workspace-guard.test.js` | `edc2fe101b63c14c27a7efaf60d83b22e5b9904e` |

七项分别只调用 BROKER_RPC / deliver / route，均没有 SWITCH 请求；guard callback 的实际调用只在 `parent-rpc-relay.js` SWITCH 分支。现有七项断言验证可信 ingress、canonical main、进程复用、primary/imported workspace，与 amendment 没有冲突，不能据 amendment 顺手改断言。独审同意；没有新增 Spec 或 authority delta。

## 最终包检查输出原文与精确基线对照

cwd=`/private/tmp/dsh-523-integration`，原始 argv：

```sh
node --test --test-reporter=tap 'packages/agent-router/test/*.test.js' 'packages/agent-router/test/*/*.test.js'
```

UTC `2026-11-04T05:23:17.781732+00:00` → `2026-11-04T05:23:28.566774+00:00`，rc=`1`。完整未删节 stdout/stderr：[agent-router.tap](docs/evidence/guard-integration-523-r3-20261104/agent-router.tap)，276716 bytes，SHA256 `336d5af67d235631d3545b34b962b6ecd14c7b9facbcb81a78482f4253b9c760`；[命令/环境/时间](docs/evidence/guard-integration-523-r3-20261104/agent-router.json)。末尾原文：

```text
1..608
# tests 608
# suites 0
# pass 596
# fail 10
# cancelled 0
# skipped 2
# todo 0
# duration_ms 10733.773
```

固定 base R2 原输出：[baseline-agent-router.tap](docs/evidence/guard-integration-523-r2-20261104/baseline-agent-router.tap)，SHA256 `678673687b8e6f2e0e2c9b86b5cb5bfc342b6e4ba9c5556671e3661179cc0b06`，599/584 pass/13 fail/2 skip。按唯一完整标题逐项比较，保存原始位置；不以 TAP 序号比较、不过滤失败：[comparison.json](docs/evidence/guard-integration-523-r3-20261104/comparison.json)、[final-results.json](docs/evidence/guard-integration-523-r3-20261104/final-results.json)。

| 检查 | tests | pass | fail | skip |
|---|---:|---:|---:|---:|
| R1 整合 / shared deps | 608 | 586 | 20 | 2 |
| R2 固定 base / independent deps | 599 | 584 | 13 | 2 |
| R3 整合 / independent deps | 608 | 596 | 10 | 2 |

`|F_final ∩ F_baseline|=10`，`|F_final − F_baseline|=0`，`|F_baseline − F_final|=3`。后者三项是 actual proc agentId、TRUSTED_INGRESS、V2 first contact；本轮转为 PASS，不宣称源码修复。标题全集仅多 9 guard，基线无独有测试；两 SKIP 标题和理由不变。**包检查并非全绿，发布门按本轮授权的 subset 标准通过**。十项既有失败明细：

- `E: valid canonical credential — child initializes on the openai-codex route`
- `F: missing credential fails loud on the real chain — never a silent fallback`
- `G: unsafe credential (group/world readable) fails loud on the real chain`
- `R3: a settled or unknown turnExecutionId proves nothing (absent leaf)`
- `packages/agent-router/test/process-lifecycle/feishu-reply-delivery-result.test.js`
- `real child cancel removes native queued admission before old owner release`
- `real child timeout removes native queued admission before old owner release`
- `scripted native rounds obtain fresh parent proof after prior settlement through real child transport`
- `seam: a gateway THROW resolves as mutation_outcome_unknown with zero automatic retry (true transport loss semantics kept)`
- `seam: a structured gateway failure passes through declared codes verbatim at the correct depth`

standalone guard 原命令：`node --test --test-reporter=tap packages/agent-router/test/route-chain/switch-workspace-guard.test.js`，rc0；[完整 guard.tap](docs/evidence/guard-integration-523-r3-20261104/guard.tap)、[metadata](docs/evidence/guard-integration-523-r3-20261104/guard.json)，SHA256 `6e6dd340b8aa8b0a009746adfbfeeb1e746c6d15187a7b3d777ff0c75c9beab1`。末尾原文：

```text
1..9
# tests 9
# suites 0
# pass 9
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 112.111875
```

## 其他门、独审、发布状态

- [gates.json](docs/evidence/guard-integration-523-r3-20261104/gates.json)：结构检查 `--base f767e8d6 --head 492d579d --json` rc0，`CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT`，candidate violations 0 / inherited debt 31；不是仓库全局无债务。[原文](docs/evidence/guard-integration-523-r3-20261104/structure.raw.txt)。
- governance `--require-accepted` rc0，[原文](docs/evidence/guard-integration-523-r3-20261104/governance.raw.txt)；`git diff --check base HEAD` rc0，[空原文](docs/evidence/guard-integration-523-r3-20261104/diff-check.raw.txt)。证据-only 后续 Head 对代码无增量，不重跑已通过产品 tests。
- 独立 reviewer `/root/authority_audit` 未写代码/断言、未跑 tests，直接解析原始 TAP 和依赖 manifests；subset、七项、guard、哈希、原文锚点和 remote-main doc delta 复核 PASS。报告：[independent-review.json](docs/evidence/guard-integration-523-r3-20261104/independent-review.json)。最终证据 commit 还须 docs-only delta recheck。
- [远端预读](docs/evidence/guard-integration-523-r3-20261104/pre-publication-readback.json)：main=`29d1cd86...`，branch 尚无远端 ref、PR 列表空，#523 OPEN；[源码/base/blob 回读](docs/evidence/guard-integration-523-r3-20261104/source-and-base-readback.json)。最终发布后另保留实际 URL/head/base 读回。
- 生产安装/启用/业务结果=`NOT_RUN`；旧共享 fixture preimage 与具体唯一环境根因=`UNKNOWN`；future merged main=`NOT_CREATED`。本轮只完成 source/offline gate，MERGE_READY=NO / OPERATION_ALLOWED=NO。

附：额外的 `git diff --cached --check` 原始证据格式诊断 rc2，24 处尾空格仅来自 R1/R2/R3 的四份不可改写 TAP／raw extract；完整命令、stdout、路径与 hash 见 [raw-evidence-whitespace.json](docs/evidence/guard-integration-523-r3-20261104/raw-evidence-whitespace.json)。独审依据 `.agents/README.md:247,251,288` 判定为 nonblocking Observation formatting，不是新增产品 required gate；保留所有原始字节、Git 规则不变。源码及人工文档使用显式排除这四份 raw 的检查，结果另记 [source-manual-doc-diff.json](docs/evidence/guard-integration-523-r3-20261104/source-manual-doc-diff.json)；不声称 unscoped staged diff 全绿。
