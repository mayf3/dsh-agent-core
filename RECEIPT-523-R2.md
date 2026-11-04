# RECEIPT-523-R2 — STOPPED，整合失败集合比基线多 7 项

记录 UTC：`2026-11-04T05:09:15.194980+00:00`。**相等 gate 失败：共同失败 13、整合独有 7、基线独有 0；未 push、未开 PR。** [STOPPED-523-R2.md](STOPPED-523-R2.md) 已记录停点与七项差集。guard 源码因果归因为 `UNKNOWN`；本轮没有以环境解释豁免失败。

## 授权、范围与坐标

当前用户合同原文和 R2 PREFLIGHT/runbook 保留于 [BRIEF-523-R2.md](BRIEF-523-R2.md)。本轮仅独立 baseline 安装、原命令包检查一次、集合比较和本地回执；无源码/断言修改、无整仓检查、无候选重跑、无生产命令。原 [STOPPED-523.md](STOPPED-523.md) / [RECEIPT-523.md](RECEIPT-523.md) 保留不改写。

- 仓库：`mayf3/dsh-agent-core`；候选 worktree：`/private/tmp/dsh-523-integration`；branch：`ac-523-guard-integration`。
- 候选 HEAD：`492d579d185a524a9b56dd91ce8c3728fe6818a2`；parent / 选定基线：`f767e8d6608cdb0917aad2d471ba0454d0966a0f`。
- 基线 worktree：`/private/tmp/dsh-523-baseline`，新建 detached exact base；安装前与测试后 `git status --porcelain=v1 --untracked-files=all` 原文均为空字符串。安装后亦为空；没有改基线源码/manifest。
- Node `v26.7.0` / pnpm `11.7.0`。候选三 guard blob 仍为 `172859f387a44828c892cd090dcc15e8b081bc66` / `d0a8ca89965ab01718c34f3db93660d5bb2e1fd3` / `edc2fe101b63c14c27a7efaf60d83b22e5b9904e`；D-008 blob `0c3f6f6005794edec2faf666e4fb035a9c87b009` 未变。
- [local-readback.json](docs/evidence/guard-integration-523-r2-20261104/local-readback.json)：HEAD/parent、四文件 commit/worktree blob、空 tracked/staged diff、未调用 push/merge、PR 未创建。R2 在 gate 失败后未查询/改变远端 main；R1 的 main 快照不充作当前远端读数。

## 独立依赖安装来源

在基线 worktree 中执行一次：

```sh
/opt/homebrew/bin/pnpm install --ignore-scripts --no-lockfile --node-linker=hoisted --package-import-method=copy --store-dir /private/tmp/dsh-523-r2-dependencies/store --registry=https://registry.npmjs.org --reporter=append-only
```

安装 UTC `2026-11-04T05:05:45.817794+00:00` → `2026-11-04T05:06:08.949049+00:00`，rc=`0`。完整未删节 stdout+stderr：[pnpm-install.raw.txt](docs/evidence/guard-integration-523-r2-20261104/pnpm-install.raw.txt)（1807 bytes；SHA256 `f98dcd673cada2ac916e2ecc36a7dfd9c1bf7fcf69650404cb6e59bf30e894da`）；命令、时间、环境及 clean pre/post 状态：[install.json](docs/evidence/guard-integration-523-r2-20261104/install.json)。

来源为 `https://registry.npmjs.org`，全新 store `/private/tmp/dsh-523-r2-dependencies/store`，独立 HOME `/private/tmp/dsh-523-r2-dependencies/home`，独立实际目录 `baseline/node_modules`，不链接/复用 R1 mutable dependency dir。使用 copy 导入、不执行安装脚本；hoisted 布局对应原 npm 平铺的解析策略。根无 committed lock，本次不生成 lock。root package.json SHA256 `d57644033f2ed7458272262dedad91c1cabc86aa51bc75bcc1f35184029299cd`。

7 个关键包在当前原依赖目录与新 baseline 中的版本和 package.json SHA256 逐一相等：schemastery `3.18.5`、cordis `4.0.5`、dsh-session 与 persistence-jsonl `0.1.0-rc.8`、Lark SDK `1.76.0`、croner `10.0.1`、sherpa `1.13.7`。原轮执行时已有的 schemastery/cordis 两份哈希也与此次新安装一致。完整对照：[dependency-comparison.pretest.json](docs/evidence/guard-integration-523-r2-20261104/dependency-comparison.pretest.json)。其余包的旧目录读数是 R2 当前观测，并非伪造为 R1 执行前快照。

安装产物保留于新 baseline/node_modules、任务专用 store 与隔离 HOME/cache。测试本身会 provisioning：repo `node_modules/@agent-core` 与硬编码 `/tmp/home/agt_a` fixtures 仍是测试写面。已记录本次前后 package inventory / symlink targets：[pretest](docs/evidence/guard-integration-523-r2-20261104/dependency-and-links.pretest.json)、[posttest](docs/evidence/guard-integration-523-r2-20261104/dependency-and-links.posttest.json)。本轮没有清理或猜测恢复任何旧共享 fixture/link。**独立安装不等于所有硬编码 fixture 均完全隔离**；R1 共享依赖 preimage UNKNOWN 仍保留。

## 基线检查命令与输出原文

cwd=`/private/tmp/dsh-523-baseline`，精确使用 R1 的 argv（通配符由 Node 处理，保持原样）：

```sh
node --test --test-reporter=tap 'packages/agent-router/test/*.test.js' 'packages/agent-router/test/*/*.test.js'
```

测试进程只传入 R1 记录的相同 `PATH`、`TMPDIR`，加此次 evidence 下空起点的临时 `PRODUCTION_RUNTIME_ROOT`；无 HOME/模型 key/凭据/生产配置继承。完整环境键值与时间：[baseline-check.json](docs/evidence/guard-integration-523-r2-20261104/baseline-check.json)。

UTC `2026-11-04T05:06:42.036319+00:00` → `2026-11-04T05:06:53.161445+00:00`；rc=`1`。完整未删节 stdout+stderr：[baseline-agent-router.tap](docs/evidence/guard-integration-523-r2-20261104/baseline-agent-router.tap)，276802 bytes，SHA256 `678673687b8e6f2e0e2c9b86b5cb5bfc342b6e4ba9c5556671e3661179cc0b06`。末尾原文：

```text
1..599
# tests 599
# suites 0
# pass 584
# fail 13
# cancelled 0
# skipped 2
# todo 0
# duration_ms 11086.017458
```

原整合输出未经重跑或修改：[agent-router.tap](docs/evidence/guard-integration-523-20261104/agent-router.tap)，291384 bytes，SHA256 `0725db8bc5de77a29d8db961342ac71fb17f55fca67386bfbcec781aa141de59`；608 tests / 586 pass / 20 fail / 2 skipped。原 guard 9/9 的 R1 证据保留，R2 不重复标成新执行。

## fail 集合精确对照

比较键为日志中的完整原文测试标题；两份日志均无重名，失败源文件/行号另行保留并核对。只归一化 location 的 worktree 前缀，不删除失败、不按错误类型合并；不使用可能移动的 TAP 序号充作测试身份。完整 pass/fail/skip 集合与原始行号分别见 [integration-results.json](docs/evidence/guard-integration-523-r2-20261104/integration-results.json)、[baseline-results.json](docs/evidence/guard-integration-523-r2-20261104/baseline-results.json)。[comparison.json](docs/evidence/guard-integration-523-r2-20261104/comparison.json) 保留每个标题的两侧状态及双向差集；可仅解析既有日志复现：`python3 docs/evidence/guard-integration-523-r2-20261104/compare-tap.py`。

| 测试原文标题 | 测试文件与位置 | 整合 R1 | 基线 R2 | 集合判定 |
|---|---|---|---|---|
| packages/agent-router/test/process-lifecycle/feishu-reply-delivery-result.test.js | `packages/agent-router/test/process-lifecycle/feishu-reply-delivery-result.test.js:1:1` | FAIL / TAP 21 / L1946 | FAIL / TAP 21 / L1853 | 共同失败 |
| broker RPC: executed as the ACTUAL proc.agentId via the gateway | `packages/agent-router/test/broker-rpc.test.js:81:1` | FAIL / TAP 28 / L168 | FAIL / TAP 28 / L168 | 共同失败 |
| broker RPC: passes the exact immutable active-turn context beside actual agentId | `packages/agent-router/test/broker-rpc.test.js:112:1` | FAIL / TAP 29 / L187 | PASS / TAP 29 / L188 | 整合独有失败 |
| broker RPC: stale generation, settled execution, and cleared turn never forward ingress context | `packages/agent-router/test/broker-rpc.test.js:146:1` | FAIL / TAP 30 / L206 | PASS / TAP 30 / L200 | 整合独有失败 |
| broker RPC: delayed turn-A carrier cannot inherit live turn-B ingress context | `packages/agent-router/test/broker-rpc.test.js:170:1` | FAIL / TAP 31 / L225 | PASS / TAP 31 / L210 | 整合独有失败 |
| seam: a gateway THROW resolves as mutation_outcome_unknown with zero automatic retry (true transport loss semantics kept) | `packages/agent-router/test/broker-rpc.test.js:322:1` | FAIL / TAP 36 / L277 | FAIL / TAP 36 / L252 | 共同失败 |
| seam: a structured gateway failure passes through declared codes verbatim at the correct depth | `packages/agent-router/test/broker-rpc.test.js:334:1` | FAIL / TAP 37 / L299 | FAIL / TAP 37 / L274 | 共同失败 |
| D1 main first deliver: accepted, sessionId fixed main, one process, one prompt | `packages/agent-router/test/delivery.test.js:147:1` | FAIL / TAP 56 / L439 | PASS / TAP 56 / L414 | 整合独有失败 |
| D2 main again: same fixed session, process reused, no second mapping | `packages/agent-router/test/delivery.test.js:163:1` | FAIL / TAP 57 / L461 | PASS / TAP 57 / L429 | 整合独有失败 |
| TRUSTED_INGRESS: exact Feishu chat/conversation/message fields reach the routed turn without parsing | `packages/agent-router/test/feishu-regression.test.js:159:1` | FAIL / TAP 70 / L652 | FAIL / TAP 70 / L610 | 共同失败 |
| V2 normal: first contact binds workspace=null + session main, turns in the Agent primary workspace | `packages/agent-router/test/feishu-v2-normal.test.js:129:1` | FAIL / TAP 81 / L853 | FAIL / TAP 81 / L811 | 共同失败 |
| V2 normal: the conversation-derived workspace is NEVER chosen | `packages/agent-router/test/feishu-v2-normal.test.js:147:1` | FAIL / TAP 82 / L908 | PASS / TAP 82 / L865 | 整合独有失败 |
| E: valid canonical credential — child initializes on the openai-codex route | `packages/agent-router/test/luna-credential-chain.test.js:157:1` | FAIL / TAP 101 / L1141 | FAIL / TAP 101 / L1089 | 共同失败 |
| F: missing credential fails loud on the real chain — never a silent fallback | `packages/agent-router/test/luna-credential-chain.test.js:169:1` | FAIL / TAP 102 / L1159 | FAIL / TAP 102 / L1107 | 共同失败 |
| G: unsafe credential (group/world readable) fails loud on the real chain | `packages/agent-router/test/luna-credential-chain.test.js:186:1` | FAIL / TAP 103 / L1179 | FAIL / TAP 103 / L1127 | 共同失败 |
| D: imported agent — spawn hands the process the imported workspace + env mechanically | `packages/agent-router/test/primary-workspace.test.js:159:1` | FAIL / TAP 104 / L1208 | PASS / TAP 104 / L1155 | 整合独有失败 |
| R3: a settled or unknown turnExecutionId proves nothing (absent leaf) | `packages/agent-router/test/process-lifecycle/message-origin.test.js:175:1` | FAIL / TAP 248 / L2186 | FAIL / TAP 248 / L2093 | 共同失败 |
| scripted native rounds obtain fresh parent proof after prior settlement through real child transport | `packages/agent-router/test/route-chain/native-goal-composed.test.js:14:1` | FAIL / TAP 472 / L3704 | FAIL / TAP 472 / L3611 | 共同失败 |
| real child timeout removes native queued admission before old owner release | `packages/agent-router/test/route-chain/native-goal-composed.test.js:74:43` | FAIL / TAP 473 / L3723 | FAIL / TAP 473 / L3630 | 共同失败 |
| real child cancel removes native queued admission before old owner release | `packages/agent-router/test/route-chain/native-goal-composed.test.js:74:43` | FAIL / TAP 474 / L3740 | FAIL / TAP 474 / L3647 | 共同失败 |


集合算式：`|F_I|=20`，`|F_B|=13`，`|F_I ∩ F_B|=13`，`|F_I − F_B|=7`，`|F_B − F_I|=0`。`F_B` 是 `F_I` 的真子集，**相等条件不成立**。

两侧测试标题全集仅相差新增的 9 个 #523 guard tests（全部在整合侧 PASS），无基线独有测试；两个 SKIP 标题和理由一致。对共同的 599 项：577 同时 PASS、13 同时 FAIL、2 同时 SKIP、7 项整合 FAIL / 基线 PASS；没有整合 PASS / 基线 FAIL。因此测试总数差异不是凭数量猜测或漏算失败。

## 结论、归因限度与停止动作

结论：**整合侧新增失败集合非空（7 项），按合同停止，零回归未成立。** 七项完整失败原文与对应基线 PASS 行号：[integration-only-failures.raw.txt](docs/evidence/guard-integration-523-r2-20261104/integration-only-failures.raw.txt)。其中 6 项原文含 provisioning symlink `EEXIST`，`V2 normal: the conversation-derived workspace is NEVER chosen` 是 undefined.turns；同文件前一项存在 provisioning failure。此观察说明测试环境状态影响归因，但不构成任何失败豁免。

`SOURCE_CODE_INTRODUCTION_CAUSALITY=UNKNOWN`：原整合轮复用可写依赖目录，本轮按授权独立安装；即使关键版本一致，拓扑、历史 fixture 状态及并发交错仍不能视为受控相同。没有本轮独立环境候选结果，不能仅凭差集断言 guard 源码致因；也不能把差集称为全部既有。候选重跑/修复没有本轮授权且失败后应停，因此未做。

`PUSH_READY=NO / PR_READY=NO / MERGE_READY=NO / OPERATION_ALLOWED=NO`。PR URL=`NOT_CREATED_STOPPED`。未 push、未 PR、未 merge、未关闭 #523、未部署/重启/生产写入，未访问 ac1159-deploy。按失败停点，剩余 structure/integrity/publication checks 未执行，没有虚报 PASS。候选 HEAD 保持 492d579d；所有 R2 evidence、receipt、stop 为本地未提交材料。

独立复核：`/root/failure_audit` 只读独立解析两份原始 TAP，未运行比较脚本或任何测试；验证所有 outcome、双向差集、9 项 guard、两个 SKIP、依赖 manifest 和本地 HEAD。证据复核 PASS；相等 gate FAIL，维持 STOP / 不 push / 不开 PR；新增 review blocker=0，原 REQUIRED_GATE_FAILURE 保留。完整逐字回报：[independent-review.json](docs/evidence/guard-integration-523-r2-20261104/independent-review.json)。

全部 R2 顶层证据及本回执/停工记录的 SHA256：[MANIFEST.sha256](docs/evidence/guard-integration-523-r2-20261104/MANIFEST.sha256)。
