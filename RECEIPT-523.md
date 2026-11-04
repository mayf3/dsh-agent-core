# RECEIPT-523 — STOPPED, source integration only

记录 UTC：`2026-11-04T04:55:16.016853+00:00`。本轮按当前合同的“失败或 UNKNOWN 即停写”停止。guard 原样整合已在本地提交；包测试 rc=1 后未继续源码修改、提交、push 或开 PR。未 merge、未关闭 #523、未准入 #605、未部署/重启/生产写入，未访问 ac1159-deploy 活跃区。

## 授权与坐标

- 仓库 `mayf3/dsh-agent-core`；工作位 `/private/tmp/dsh-523-integration`；分支 `ac-523-guard-integration`。
- [Owner 2026-11-04 裁定](https://github.com/mayf3/dsh-agent-core/issues/523#issuecomment-6622744977)；[最后 REMOTE_FALLBACK](https://github.com/mayf3/dsh-agent-core/issues/523#issuecomment-6595432739)。本轮合同及 PREFLIGHT/runbook 在 [BRIEF-523.md](BRIEF-523.md)。
- 审定 PR #607 head：`ecff3b50195ff6f8649ff7896ac7a3f1a1b3bdd5`；堆叠 merge `e754229ba06fd76e8ef09a62487548bf009311c3`；源 parent `fa7fea60374b64b6f869c418c4c6a7a9b98b3022`。
- 整合 base / current remote main / MAIN_EXPECTED_PREIMAGE_SHA：`f767e8d6608cdb0917aad2d471ba0454d0966a0f`。
- 整合 source commit / CANDIDATE_EXPECTED_HEAD：`492d579d185a524a9b56dd91ce8c3728fe6818a2`，parent 精确为上述 main。此提交不是 main SHA。
- main 在整合后的实际 SHA：**NOT_CREATED / 未合并**。未来 merge SHA=`UNKNOWN_NOT_CREATED`；本轮不允许 merge，不能预造或把候选 SHA 记成 main。关单所需的真实 resulting-main SHA 与文件 readback 尚未成立。
- GitHub fresh readback 时间：`2026-11-04T04:53:38.662711+00:00`。远端 branch 查询 rc=0、stdout 为空；PR 查询 rc=0、结果 `[]`；#523 仍 OPEN。

## 整合 SHA 映射

“新 main blob”目前只能是候选进入 main 后的预期文件字节，不能记为已在 main。下表分别列出审定、候选与实际远端 main。

| agent-router 文件 | 审定 blob | 整合候选 / 未来 main 预期 blob | 当前远端 main 实际 blob |
|---|---|---|---|
| `src/binding-resolution.js` | `172859f387a44828c892cd090dcc15e8b081bc66` | `172859f387a44828c892cd090dcc15e8b081bc66` | `0f687f5d0b0f59f9566b2cf9b9368108f5d69c01` |
| `src/index.js` | `d0a8ca89965ab01718c34f3db93660d5bb2e1fd3` | `d0a8ca89965ab01718c34f3db93660d5bb2e1fd3` | `f8682f3b5ac5ab57cf98c5a86cd622cb3fa94921` |
| `test/route-chain/switch-workspace-guard.test.js` | `edc2fe101b63c14c27a7efaf60d83b22e5b9904e` | `edc2fe101b63c14c27a7efaf60d83b22e5b9904e` | `ABSENT` |

三文件在候选 commit 和当前工作树逐一等于审定完整 blob；额外适配 diff=`EMPTY`，适配理由=`NONE_NEEDED`。`switchAgentFromTurn` 在 binding-resolution.js；index 注入 `bindingResolution.switchAgentFromTurn`；测试文件在候选在位。

D-008 amendment 在源、base、候选、当前 main 均为 blob `0c3f6f6005794edec2faf666e4fb035a9c87b009`，未修改。源 parent..main 仅 #527 Scheduler 文件变化，受影响 Router / Product API / authority 无 delta。完整 GitHub main-tree 与本地 HEAD/worktree 对照在 [readback.json](docs/evidence/guard-integration-523-20261104/readback.json)，main tree query rc=0 / truncated=false。

## 受影响检查与原文

Node `v26.7.0`。每条检查 stdout+stderr 逐字保存为未删节 TAP；完整命令、执行时间、rc、依赖版本/实际解析路径及 package.json SHA256 见 [checks.json](docs/evidence/guard-integration-523-20261104/checks.json)。仅运行 guard 及 agent-router 包范围，没有整仓重跑或 baseline 重跑。包范围含顶层与一级子目录的全部 `.test.js`，所以也再次包含 guard。

测试子进程仅传入 PATH、TMPDIR 和位于本证据目录下的临时 PRODUCTION_RUNTIME_ROOT；未继承模型 key/凭据/生产覆盖配置。guard 用 temporary roots / fake child / loopback ephemeral HTTP。

### guard

```sh
node --test --test-reporter=tap packages/agent-router/test/route-chain/switch-workspace-guard.test.js
```

UTC `2026-11-04T04:52:01.284199+00:00` → `2026-11-04T04:52:01.441067+00:00`；rc=`0`。原始完整 stdout+stderr：[guard.tap](docs/evidence/guard-integration-523-20261104/guard.tap)，6487 bytes，SHA256 `c74e9ef6f260701997a9568ee8c4941f4551023bf54dd019c9cb3694a444421a`。

末尾原文：

```text
1..9
# tests 9
# suites 0
# pass 9
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 123.80825
```

### agent-router

```sh
node --test --test-reporter=tap 'packages/agent-router/test/*.test.js' 'packages/agent-router/test/*/*.test.js'
```

UTC `2026-11-04T04:52:01.441432+00:00` → `2026-11-04T04:52:12.681081+00:00`；rc=`1`。原始完整 stdout+stderr：[agent-router.tap](docs/evidence/guard-integration-523-20261104/agent-router.tap)，291384 bytes，SHA256 `0725db8bc5de77a29d8db961342ac71fb17f55fca67386bfbcec781aa141de59`。

末尾原文：

```text
1..608
# tests 608
# suites 0
# pass 586
# fail 20
# cancelled 0
# skipped 2
# todo 0
# duration_ms 11195.416333
```

## 失败原文索引与处置

包 gate 的 20 个 failure block 逐字存于 [failure-extract.json](docs/evidence/guard-integration-523-20261104/failure-extract.json)，每项含原 TAP 行号；完整 TAP 同上。

1. `not ok 28 - broker RPC: executed as the ACTUAL proc.agentId via the gateway`（原文行 168–182）
2. `not ok 29 - broker RPC: passes the exact immutable active-turn context beside actual agentId`（原文行 187–201）
3. `not ok 30 - broker RPC: stale generation, settled execution, and cleared turn never forward ingress context`（原文行 206–220）
4. `not ok 31 - broker RPC: delayed turn-A carrier cannot inherit live turn-B ingress context`（原文行 225–239）
5. `not ok 36 - seam: a gateway THROW resolves as mutation_outcome_unknown with zero automatic retry (true transport loss semantics kept)`（原文行 277–297）
6. `not ok 37 - seam: a structured gateway failure passes through declared codes verbatim at the correct depth`（原文行 299–319）
7. `not ok 56 - D1 main first deliver: accepted, sessionId fixed main, one process, one prompt`（原文行 439–453）
8. `not ok 57 - D2 main again: same fixed session, process reused, no second mapping`（原文行 461–475）
9. `not ok 70 - TRUSTED_INGRESS: exact Feishu chat/conversation/message fields reach the routed turn without parsing`（原文行 652–696）
10. `not ok 81 - V2 normal: first contact binds workspace=null + session main, turns in the Agent primary workspace`（原文行 853–897）
11. `not ok 82 - V2 normal: the conversation-derived workspace is NEVER chosen`（原文行 908–921）
12. `not ok 101 - E: valid canonical credential — child initializes on the openai-codex route`（原文行 1141–1157）
13. `not ok 102 - F: missing credential fails loud on the real chain — never a silent fallback`（原文行 1159–1177）
14. `not ok 103 - G: unsafe credential (group/world readable) fails loud on the real chain`（原文行 1179–1197）
15. `not ok 104 - D: imported agent — spawn hands the process the imported workspace + env mechanically`（原文行 1208–1252）
16. `not ok 21 - packages/agent-router/test/process-lifecycle/feishu-reply-delivery-result.test.js`（原文行 1946–1956）
17. `not ok 248 - R3: a settled or unknown turnExecutionId proves nothing (absent leaf)`（原文行 2186–2199）
18. `not ok 472 - scripted native rounds obtain fresh parent proof after prior settlement through real child transport`（原文行 3704–3721）
19. `not ok 473 - real child timeout removes native queued admission before old owner release`（原文行 3723–3738）
20. `not ok 474 - real child cancel removes native queued admission before old owner release`（原文行 3740–3755）

观察到 provisioning EEXIST、缺 DSH CLI、缺 native paired build、缺 `@larksuite/channel`、Broker 文案断言与 message-origin ctx 错误。原因分类只用于定位，**不是失败豁免**。没有跑 base 对照，因此新增回归集合=`UNKNOWN_NOT_EVALUATED`，不能宣称 failures ⊆ 历史五名。两个 skip 也保留原文：

```text
ok 42 - T3: real plugin boot under an untraversable parent TMPDIR — plugin tree, initialize and provider registration all pass # SKIP deepseek-harness CLI not resolvable (DSH_HARNESS_ROOT/checkout missing) — real child boot not run
ok 262 - r4 salvaged corpus adapter requires HR_R4_SALVAGE_ROOT # SKIP external immutable input not supplied
```

环境侧影响：本轮将 `node_modules` 链接到 `/tmp/dsh-523-impl/node_modules`。包里的现有 provisioning 会经此共享目录修改本地 workspace symlink；本轮 log 的 EEXIST 和只读 post-state 均显示这一路径。复用目录的可写性使测试环境隔离不足；未保留原 symlink preimage，因此其精确变更集合=`UNKNOWN`。已记录 [dependency-side-effect.json](docs/evidence/guard-integration-523-20261104/dependency-side-effect.json)。停止后未猜测还原、删除、清理、重装或重跑。本 worker 未对原 #607 工作树的 tracked 源码执行编辑；共享测试依赖状态不得称为未变。

## 既定有界独审

独立只读 reviewer `/root/review_523` 未编写 delta、未运行测试、未写文件。exact review target=`492d579d185a524a9b56dd91ce8c3728fe6818a2`，base/current main=`f767e8d6608cdb0917aad2d471ba0454d0966a0f`；范围为三文件 byte fidelity、受影响 D-008/D-004/workspace invariants、同步 guard/no-write/audit、Parent-RPC 接线及 operator API 保留、日志/坐标。

源码限定审查 PASS；独立计算两份原 TAP SHA256 与 checks.json 一致。`SOURCE_BYTE_INTEGRATION=PASS`，`DELIVERY_READINESS=FAIL`，`FROZEN_BLOCKER_UNION=[REQUIRED_GATE_FAILURE:agent-router-check]`，blocker/spec_gaps/follow_ups=`1/0/0`；`PUSH_READY=NO / PR_READY=NO / MERGE_READY=NO / OPERATION_ALLOWED=NO`。完整 reviewer 报告由本 worker 按其返回原意持久化到 [independent-review.json](docs/evidence/guard-integration-523-20261104/independent-review.json)。

唯一交付 blocker：SOURCE=当前合同“失败或 UNKNOWN 即停写”；COUNTEREXAMPLE=本轮包测试 rc=1/20 fail；IMPACT=不得继续 push/PR/merge；MINIMAL_CLOSURE=本轮 STOP 收据并等待可审定的后续环境/失败处置，不能自动套用旧 baseline 豁免。

## UNKNOWN / 未执行清单

- 将来真实合入 main 的 SHA 和 main 上三 guard blob readback：未创建，关单前置不满足。实际 main 仍是 `f767e8d6608cdb0917aad2d471ba0454d0966a0f`。
- 20 failures 相对同环境 base 的新增集合：UNKNOWN，未重跑 baseline。
- 共享测试依赖 symlink 的原 preimage / 完整被改写集合：UNKNOWN；有 post-state，无推测修复。
- external immutable r4 corpus 与 real harness/native paired-build 检验不完整，不能作 PASS。
- 结构 candidate-delta、governance integrity 及 final publication checks：因包 gate 已失败，本轮未执行，不复用历史 PASS 冒充本轮。整合前 `git diff --check` 实际 rc=0。
- Controller 活跃 reservation：不在本轮 isolated source mandate 依赖内，未访问；旧回执 UNKNOWN 不被本轮消除。
- 已安装/已启用/业务验收：NOT_RUN，无生产动作。

## 当前停点

`STOPPED-523.md`、本回执及本轮 evidence 是未提交本地停工记录；source HEAD 保持 `492d579d185a524a9b56dd91ce8c3728fe6818a2`。停止后只补证据和回执，不再 commit/push/开 PR。候选源码及停工记录留在指定隔离工作位供恢复审定；共享测试依赖的外部路径及 UNKNOWN 影响另见上述环境侧记录。不通过合并绕过 gate。
