# RECEIPT-1365-RETIRE — R3 Node 环境归因与退役执行器解耦

交付状态：`DELIVERED / PR_OPEN_UNMERGED`。[PR #666](https://github.com/mayf3/dsh-agent-core/pull/666)，base main，实际 push rc0，fresh PR readback 为 open、merged=false。真实 Node v25.6.1 下原受影响套件 71/71、其他面定向抽查 91/91，均 child/capture rc0；本次结构违规 0、独审 PASS。零生产写入，不 rebase，不合并 PR。

## 授权、权威与坐标

- Owner 本轮 R3 续派解除 R2 的 Node 版本配方停点；最终「失败即停」继续生效。原始 R1/R2 失败不改写。[Brief](BRIEF-1365-RETIRE.md)、[历史停止记录](STOPPED-1365-RETIRE.md)。目标来自 [agent-control #1365](https://github.com/mayf3/agent-control/issues/1365)，本轮 fresh-read。
- `schema_version=2; PREFLIGHT / REUSE / BRIEF / DURABLE / IMPLEMENTATION`。Product Authority 为基线已接受的 `AGENT_CORE_DEVELOPMENT_EXECUTION_AUTHORITY_CONVERGENCE_V1 r1`，`implementation_authority=contracts; production_apply_authority=none`。适用 `CTR-DEC-001/002` 及保留的 `CTR-DES-002` 历史记录/收据契约，无新增 Spec 或长期语义变化。
- worktree=`/private/tmp/h1365-retire`；branch=`fix/retire-executor-decouple`；单一写者=root；原基线/测试时 HEAD=`b6ddc2a67ba041b8b13ed33d331104cf809d4985`。
- 本轮 fetch/远端读回 main=`e8d6d333743f812945d47b96ace61b817f35f9cf`。`BASE_IMPACT=BOUNDED`：main 有正交 Workflow admission/plan、owner-assistance、recovery 等变动；退役两源码、production-runtime、相关权威及 `.agents` 无变化。本候选未集成 main 后续代码，不声称已验证合并结果。
- 不动治理文档/`.agents/tools`、依赖、产品版本守卫、既有测试断言、历史格式、权限、管理器、锁架构；不混入 #1367/#1372。

## 实现与绑定

产品源码保持 R2 候选，仅 2 文件、22 additions / 13 deletions。

| 路径与当前行 | 实际改变 |
|---|---|
| `packages/development-execution/src/engine.js:75–83,110–116` | 默认退役构造不加载 backend、不创建可写 ledger、不 replay/recover；status/result 才调用现有 static replay。hermetic `writerAuthorityRetired:false` 分支保持原 writer 初始化。 |
| `packages/production-runtime/src/development-execution-runtime.js:19–45` | 现有 Engine 惰性构造，保留 handler 与 engine facade；Workflow mount 不初始化旧 backend/历史。 |

[完整候选 patch](docs/evidence/1365-retire/R3-candidate.patch)；[不可变验证坐标、源码/回归/捕获器哈希及原件绑定](docs/evidence/1365-retire/R3-candidate.json)。验证 commit object=`91662c3cab497518cc875447f6641b5b2f56aa4d`，tree=`474a2dc0e647492bf5d4ceade39c69b69202947c`，parent=原基线；创建该验证对象未移动分支或真实 index。

实际源码 commit=`739fdd3434626b9b215fe1b1557689dfc1eea61b`，其完整 tree 与上述验证 tree 逐字相同，commit rc0；[提交命令、原文、rc 和 tree 读回](docs/evidence/1365-retire/R3-implementation.json)。后续 Brief/STOPPED 历史/raw/receipt 为文档证据提交，不改变源码 tree。

| 文件 | SHA256 |
|---|---|
| `engine.js` | `d281bbc0e2822f8e7748fae32d55aa5da3a0e78eb37286f1e3845b4a6710226a` |
| `development-execution-runtime.js` | `62a9ac87887bfb4a7246793dea7f451f8094d4250e5573ddf3ccc29f0eef43af` |
| `development-retirement.test.js` | `ca3fa6c78d1a4583f2b5798a899e026683204a203af2a807f15ca7f974968c8b` |
| R3 `run-retirement-gates.py` | `5589571430f290511c00ddbc397a0f092642fbbd96c20777d4c960589b98a20f` |

## RED / GREEN 原文与历史

R1 RED 测试是预期 fail5，但捕获器额外字符串断言失败，实际 capture rc1；该次停止及原件完整保留。Owner R2 仅授权修正五条诊断精确匹配，随后 R2 RED 的 child rc1 为预声明缺陷观测，capture rc0、逐项诊断 5/5。R2 RED 运行时产品源码与基线相同；修复之后 R2 GREEN child/capture rc0。

```text
R2 RED (expected child rc1; capture rc0; diagnostic_matched 5/5)
1..5
# tests 5
# suites 0
# pass 0
# fail 5
# cancelled 0
# skipped 0
# todo 0

R2 GREEN (child rc0; capture rc0)
1..5
# tests 5
# suites 0
# pass 5
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

完整原文：[R2 RED.tap](docs/evidence/1365-retire/R2-RED.tap)、[R2 RED.json](docs/evidence/1365-retire/R2-RED.json)、[R2 GREEN.tap](docs/evidence/1365-retire/R2-GREEN.tap)、[R2 GREEN.json](docs/evidence/1365-retire/R2-GREEN.json)。RED TAP SHA256=`68bdad663042f1b4751e8f2440e658a193279697699da3343b7246fcf1822360`；GREEN TAP SHA256=`82a9c86d2764a0e00b4f17196c7e6baea95e24800f874e6b18a71862a46ed505`。

五例覆盖 backend/history 缺失、backend 损坏而历史完好、history 损坏、两者均损坏、直接默认 Engine；验证 Workflow mount/poll 可用、旧写明确拒绝、历史正确/明确报损坏、无信号、原文件及目录快照不变、失败历史查询后再次 Workflow poll。R2 GREEN 的两源码、Workflow capability 与回归文件哈希本轮逐项实测相等；R1/R2 八份 raw/json 原件哈希全部与 R2-STOP.json 相等。R3 的 71 项门再次执行同五例且全部通过。

R2 新增测试/捕获器曾仅机械移到 `packages/development-execution/test/` 以避开顶层目录宽度债务；R2 RED 的旧路径和哈希仍按当次原样保留，回归断言没有弱化。

## Node 版本切换与 R3 rc0 原文

| 观察 | R2 停点 | R3 实际配方 |
|---|---|---|
| 选中 Node | `/opt/homebrew/bin/node` | `/usr/local/bin/node` |
| 真实 execPath | `/opt/homebrew/Cellar/node/26.7.0/bin/node` | `/usr/local/Cellar/node/25.6.1_1/bin/node` |
| 实际 version / arch | `v26.7.0 / arm64` | `v25.6.1 / x64` |
| existing | 71 tests / pass57 / fail14，child/capture rc1 | 71 tests / pass71 / fail0，child/capture rc0 |

R2 14 项均在未修改的 `compose.js:84,97,144` 真实 Node 守卫失败。R3 两生产源码/原套件文件逐字相同，仅换合法运行环境与捕获器版本要求/新证据前缀，实跑清除停点；不伪造 process.version、跳过失败项或修改产品守卫。R2 失败仍是失败，状态为 `CLOSED_BY_R3_EXISTING`。

```sh
PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin python3 packages/development-execution/test/run-retirement-gates.py existing
PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin python3 packages/development-execution/test/run-retirement-gates.py targeted
```

实际 `node --version` stdout：

```text
v25.6.1
```

version 命令 rc0，实际 Node 二进制 SHA256=`c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b`。父环境未修改；测试子进程清除 HTTP_PROXY/HTTPS_PROXY/http_proxy/https_proxy/ALL_PROXY/all_proxy/NO_PROXY/no_proxy/NODE_USE_ENV_PROXY 九键，probe 实测残留为 []。明确展开 8 份 existing 与 4 份 targeted 文件，不使用目录参数或全仓 npm test。

```text
R3 existing: child rc0; capture rc0
1..71
# tests 71
# suites 0
# pass 71
# fail 0
# cancelled 0
# skipped 0
# todo 0

R3 targeted: child rc0; capture rc0
1..91
# tests 91
# suites 0
# pass 91
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

- existing：development-execution 三份（含新回归）、composition 两份、Workflow shutdown、diagnostic-read/missing-trace。UTC `2026-11-07T23:36:08.968131+00:00` 至 `23:36:20.247217+00:00`。完整 [TAP](docs/evidence/1365-retire/R3-existing.tap) / [命令、环境、时间、rc、哈希 JSON](docs/evidence/1365-retire/R3-existing.json)。TAP SHA256=`375611eae655da7b9dc24b3658296d95614cddb1410fe87e0b5eecc70259522e`。
- targeted：workflow-progress-runtime/gateway、Workflow runtime-wiring/recovery。UTC `2026-11-07T23:36:23.654937+00:00` 至 `23:36:32.947441+00:00`。完整 [TAP](docs/evidence/1365-retire/R3-targeted.tap) / [命令、环境、时间、rc、哈希 JSON](docs/evidence/1365-retire/R3-targeted.json)。TAP SHA256=`15ce03d360a353524f1ff9552337cc2cac95bf45a8228405d5d719f53240648c`。

## 结构与独立审查

```sh
/usr/local/bin/node scripts/verify-code-structure.mjs --base b6ddc2a67ba041b8b13ed33d331104cf809d4985 --head 91662c3cab497518cc875447f6641b5b2f56aa4d --json
```

实际 rc0，`CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT`，candidate violations=0、baseline debt=28、resolved debt=0、in-scope files=988；真实 governing authority=`CODE_STRUCTURE_GUARDRAILS_V3`。不是全仓无债务 PASS，不更改 registry/cap。完整 [JSON stdout](docs/evidence/1365-retire/R3-structure.json.txt)、[stderr](docs/evidence/1365-retire/R3-structure.stderr)、[命令/时间/rc/哈希](docs/evidence/1365-retire/R3-structure.command.json)。stdout SHA256=`5ab2f5808ab341a11d9b8fd116ffe2cd0e6bebba15dc6591e7762f4d7667e8b9`。该 runner 的基线已含 V3 适配（原 Brief 引用 RECEIPT-VERIFIER-ADAPT），本轮不改工具或治理。

独立 reviewer=`/root/independent_review`，未创作本轮源码、测试、捕获器或证据，不运行第二写者。[完整独审记录](docs/evidence/1365-retire/R3-independent-review.md) 对上述不可变验证 commit PASS：CTR-DEC-001/002、保留只读契约、生产 opt-out 边界、环境/全部 hash 与结构证据均通过；R2 existing blocker 已 CLOSED_BY R3-existing，OPEN_BLOCKERS=0、SPEC_GAPS=0、PUBLICATION_READY=YES。最终交付 HEAD 仅文档/证据增量须独立 DELTA 复核。

[发布前 final-HEAD DELTA PASS](docs/evidence/1365-retire/R3-prepublication-head-review.md) 绑定 `6a3f822174cf446eba24b9f42738db54ddc74af6`：源树不变、25 文档/证据增量、21 manifest 项 fresh hash 全匹配、工作区 clean；无新 blocker/SPEC_GAP。未重跑不变产品套件。

## 实际提交、推送与 PR

- 源码提交：`739fdd3434626b9b215fe1b1557689dfc1eea61b`，完整 tree 与测试/结构/独审对象相等。
- 首次文档证据 HEAD：`6a3f822174cf446eba24b9f42738db54ddc74af6`，独立 final-HEAD DELTA PASS 后发布。
- 普通 `git push -u origin fix/retire-executor-decouple` 实际 rc0，创建远端分支；UTC `2026-11-07T23:41:40.888261+00:00` 至 `23:41:43.738305+00:00`。[完整命令/stdout/stderr/rc](docs/evidence/1365-retire/R3-initial-push.json)。无 force push。
- GitHub connector 实际创建 [PR #666](https://github.com/mayf3/dsh-agent-core/pull/666)，created_at=`2026-11-07T23:41:53Z`，base=`main`，head=`fix/retire-executor-decouple`，open、merged=false。[创建结果](docs/evidence/1365-retire/R3-pr-create.json)。
- 随后独立 get_pr_info fresh readback：head_sha=`6a3f822174cf446eba24b9f42738db54ddc74af6`、base_sha=`e8d6d333743f812945d47b96ace61b817f35f9cf`、state=open、merged=false、mergeable=true、merged_at=null。[读回结果](docs/evidence/1365-retire/R3-pr-initial-readback.json)。mergeable 是服务端当时的冲突计算，不是合并或业务验收；初次创建时尚未完成的 mergeability 观察原样保留。
- 本次收据补齐只添加实际发布事实和证据。其最终 containing commit、自身独立 DELTA 复核、普通后续 push rc 与 fresh PR head/open/unmerged 读回，在实际发生后绑定于 PR body 和最终交接；不把 commit 自己的哈希写入自己的内容，不为该文档增量重跑不变产品套件。

## DONE_WHEN 对照

| 项目 | 证据/结果 |
|---|---|
| 固定五例真实 RED，诊断逐项匹配 | DONE，R2 child rc1（预期）/capture rc0，旧源码哈希与 raw 保留 |
| 最小惰性构造、退役拒写及历史只读 GREEN | DONE，R2 pass5；R3 existing 再次执行 pass5，源码哈希绑定 |
| 真实 Node v25.6.1 下原受影响门 rc0 | DONE，71/71；version 命令、PATH、execPath、二进制 hash 与 raw |
| 其他受影响面定向抽查 rc0 | DONE，四文件 91/91 |
| 结构门及独立受影响审查 | DONE，0 新违规/28 旧债务；独审 exact-candidate 与发布前文档 HEAD DELTA PASS |
| commit → push → base main PR，不合并 | DONE，source 739fdd34；6a3f8221 普通 push rc0；#666 open/unmerged、base main |
| 完成收据、保留停止/原始证据 | DONE，发布事实已回填；R1/R2 原件保留；最终 containing commit 绑定见 PR body/最终交接 |

这些是离线源码与夹具证据，不表示安装、生产启动、运行时 admission 或业务验收。`MERGE_READY=NO; OPERATION_ALLOWED=NO`。发布完成且无 EXPANSION_TRIGGER 后即停止。
