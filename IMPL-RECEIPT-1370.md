# #1370 v3 实施收据

已实现 accepted Routing Config Generation Policy V1 的六个合同。候选整代拒绝与 G0 继续资格分离；运行值只取已激活代。离线验收完成，交付 [PR #671](https://github.com/mayf3/dsh-agent-core/pull/671)，base `main`，不合并、零生产写入。

## 授权、路线与精确坐标

```text
schema_version = 2
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACTION = REUSE
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
AUTHORITY_ACCEPTED_IN_BASE = YES
IMPLEMENTATION_AUTHORITY = contracts
PRIMARY_AUTHORITY = AGENT_CORE_ROUTING_CONFIG_GENERATION_POLICY_V1
BASE_HEAD = 95a8e1cb512fc99dc018209d837250dd51b4d08f
CURRENT_BASE_HEAD = 95a8e1cb512fc99dc018209d837250dd51b4d08f
SEMANTIC_HEAD = ece5cce6c51cbf0c3768be534b6e35822a86688b
BRANCH = fix/1370-generation-policy-impl
WORKTREE = /Users/yanfenma/workspace/project/worktrees/h1370-impl
MUTATION_AUTHORIZATION = user continuation plus BRIEF-1370-IMPL.md v3
SPEC_GAP_DEPENDENCY = NONE
IMPLEMENTATION_STATE = IMPLEMENTED
VERIFICATION_STATE = VERIFIED_OFFLINE_AFFECTED_SCOPE
CONFORMANCE_RESULT = PASS  # exact semantic tuple and offline scope below
OPERATION_ALLOWED = NO
PRODUCTION_APPLY_AUTHORITY = none
```

政策实测 SHA-256 `e81846b01dc3f0384034e952e6a40189f7e790276f74e8bfa197c06a168e7ca0`；原 Brief v3 实测 SHA-256 `790b44698fa04807d3207376e715c0d9e251341c6c379ea453caf42e9d65b2aa`。accepted Spec、治理、D-008/UNKNOWN/fence、Svc 均未修改。启动、后续消费与新 child 共用同一发布/快照入口；既有进程查询不冒充新业务准入。

交付 HEAD 是包含本收据及证据的 Git 提交；它的精确 SHA、独立 receipt-only delta readback 和远端 head 由 PR 正文固定，避免收据自引用自身 commit。语义与执行证据仍绑定上述 SEMANTIC_HEAD。Done When 为实现、完整验收原文、独立 affected review、commit/push、PR 和本收据；没有生产激活任务或额外产品范围。

## 条款到实现及验收

路径相对于仓库；`MR` = `packages/production-runtime/src/identity/model-routing/`，`MT` = `packages/production-runtime/test/identity/model-routing/`。全部测试的完整原文在下节链接，不以测试定义代替执行结果。

| 合同 / 验收 | 代码位置 | 直接执行覆盖 |
| --- | --- | --- |
| CTR/ACC-RCG-001 | MR/inputs.js:30 单次捕获/原字节摘要；generation.js:37 完整验证、同步原子切换、sequence 防倒序；validator.js:270 共享 validator | MT/publication.test.js:5 验证后改源、激活故障、重入更新、close；generation.test.js:17 合法整代；composition.test.js:94 真实 registry 切代 |
| CTR/ACC-RCG-002 | generation.js:72/95 只从 active 取 immutable snapshot，generationId 与上下文绑定；compose.js:224 同一入口 | generation.test.js:17/37 turn snapshot 不变、整代身份独立于 chainId；composition.test.js:54 坏 C 标记值零消费 |
| CTR/ACC-RCG-003 | validator.js:391/420 所有 unknown refs 收集后仍整体 throw；generation.js:75–96 独立资格与拒绝诊断 | generation.test.js:50–100 G0 继续、B/C 拒绝、unknown 混 duplicate/超长/非法字段/未注册/catalog 错误；composition.test.js:70 零额外 fallback |
| CTR/ACC-RCG-004 | inputs.js:75 presence、全部原始 entry、顺序与完整 descriptor/context 比较；composition.js:9 默认各层显式状态；:23 实际 Harness identity | MT/context.test.js 全部；generation.test.js:102–198 全目标表、两代均 absent、合法删除/文件 absence、坏 JSON/重复键/unknown/不可读；composition.test.js:121 实际同路径 Harness stamp 改动/缺失 |
| CTR/ACC-RCG-005 | generation.js:55 fresh capture/context gate，:99 cold 验证，:107 生命周期结束；compose.js:224/423 绑定与 close | generation.test.js:201–217 cold/restart/close；publication.test.js:73 close 激活中断；composition.test.js:69/90/110 新 child/reuse/restart；既有 own-domain artifact drift 回归 |
| CTR/ACC-RCG-006 | validator.js 保留原 checks；route-chain.js:308/318 将 generation 归因加入既有 journal，失败零尝试，executor/hop 未改；credentials 仅路径身份 | route-chain 原 180 项；Default/loader/GPT6 非法矩阵；MT/composition.test.js:153/171 UNKNOWN/output/tool STOP_CHAIN、旧 UNKNOWN ledger 逐字节不变；unknown-fence-no-replay.test.js |

若路径行号需长期复读，应使用 SEMANTIC_HEAD，不能用移动的 main 推断原执行坐标。

## 行为前后对照与模型处置

| 输入 / 边界 | 原行为 | 本实现 |
| --- | --- | --- |
| 每次使用同一配置 | 每次全文件完整 loader 建立信任 | 每次捕获变更指纹/当前 context；仅变更走同一发布边界；未变消费已激活代 |
| A→r1 合法显式变更，同时 B→missing | 整体 throw | 整代拒绝；A 拒绝，configInvalid、零 spawn/路由；不消费 r1、不用旧 A 掩盖新意图 |
| A 完整未变，同时 B→missing | A 也被全文件错误阻断 | 整代拒绝 loud；仅闭包与当前 context 可证明一致时从 G0 取 A；B 零尝试拒绝 |
| A 删除/自身无效、unknown envelope、不可读、同 ref 依赖改变 | throw | 拒绝；不当 absence，不用 global/builtin 或历史代旁路 |
| 全合法 G1 / 合法删除 / 合法 absence | 下一次 reload 生效 | 完整 G1 一次激活，后续同代消费；旧 turn 快照不变 |
| G0 后坏 C，再重启 | 当前文件重载失败 | 冷启动全量重验失败；不从 receipt/cache/旧 child 恢复 G0 权限 |

MIGRATE：生产 resolver 的逐次全文件建信任入口退出；启动、process config、turn 统一到 publication。RETAIN：独立 loader 的稳定 facade、同一 validator、schema、默认优先级、单 executor、身份门与历史证据。未增加第二套 loader/executor、watcher、数据库、schema 版本或持久化信任缓存。

## 实际执行原文、环境与结果

证据目录 [v3/](docs/evidence/h1370-impl-baseline-20261108/v3/)。Node `/usr/local/bin/node` = `v25.6.1`；配对根 `/Users/yanfenma/workspace/worktrees/codex-native-goal-enqueue-20261027`，实测 HEAD `9d8678057be9bdbcc37b640ad8cb18279dc5f971`。

| 实际执行 | 原始输出 / 完整命令、时间、rc 坐标 | 结果 |
| --- | --- | --- |
| 产品修改前，同一基线命令 | [baseline-route.log](docs/evidence/h1370-impl-baseline-20261108/v3/baseline-route.log) / [coordinates.json](docs/evidence/h1370-impl-baseline-20261108/v3/coordinates.json) | 180 tests / 180 pass / 0 fail / 0 skip；rc0 |
| exact SEMANTIC_HEAD 的全部受影响 route/loader/Default/GPT6、新增 RCG、UNKNOWN-fence 回归 | [final-regression.log](docs/evidence/h1370-impl-baseline-20261108/v3/final-regression.log) / [result](docs/evidence/h1370-impl-baseline-20261108/v3/final-regression-result.json) | 278 tests / 278 pass / 0 fail / 0 skip；rc0 |
| 完整 provisioning 套件，含 GPT6-P1..P7 | [provisioning-canonical-checkout.log](docs/evidence/h1370-impl-baseline-20261108/v3/provisioning-canonical-checkout.log) / [result](docs/evidence/h1370-impl-baseline-20261108/v3/provisioning-canonical-checkout-result.json) | 29 tests / 29 pass / 0 fail / 0 skip；rc0 |
| 非作者独立重跑 composition + Default | [independent-recheck.log](docs/evidence/h1370-impl-baseline-20261108/v3/independent-recheck.log) / [result](docs/evidence/h1370-impl-baseline-20261108/v3/independent-recheck-result.json) | 16 tests / 16 pass / 0 fail / 0 skip；rc0（包含在前述278，不重复累加） |
| 治理与 diff | [governance.log](docs/evidence/h1370-impl-baseline-20261108/v3/governance.log)、[diff-check.log](docs/evidence/h1370-impl-baseline-20261108/v3/diff-check.log) | rc0 |
| 既有结构 runner / affected 指标 | [structure-runner.log](docs/evidence/h1370-impl-baseline-20261108/v3/structure-runner.log)、[structure-metrics.json](docs/evidence/h1370-impl-baseline-20261108/v3/structure-metrics.json) | rc0，`CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT`；非仓库整体 PASS |

基线原命令（不删测试、不 catch-and-skip）：

```sh
NGC_HARNESS_ROOT=/Users/yanfenma/workspace/worktrees/codex-native-goal-enqueue-20261027 /usr/local/bin/node --test packages/agent-router/test/route-chain/*.test.js
```

最终回归原命令；测试子进程设置两项 Harness 变量为上面的配对根，并仅从该子进程移除 `RECOGNIZED_PROXY_ENV_KEYS`，完整 key 列表见 result JSON；未改本机代理或全局环境：

```sh
/usr/local/bin/node --test packages/agent-router/test/route-chain/*.test.js packages/production-runtime/test/model-overrides*.test.js packages/production-runtime/test/default-model-route.test.js packages/agent-router/test/default-model-route.test.js packages/production-runtime/test/identity/model-routing/*.test.js packages/agent-router/test/process-lifecycle/unknown-fence-no-replay.test.js
```

最后两组主要执行原文结尾分别为：

```text
ℹ tests 278
ℹ suites 0
ℹ pass 278
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 8456.690417
```

```text
ℹ tests 29
ℹ suites 0
ℹ pass 29
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2132.778667
```

新增 RCG 共57项，其中10项真实 composition/registry/executor + 显式假进程传输；完整业务验收共307项，独立复跑不重复计数。它们均为隔离 fixtures，不声称真实模型/provider、安装或生产验收。

provisioning 的真实执行 checkout 是 `/Users/yanfenma/workspace/project/worktrees/h1370-verification/dsh-agent-core`，HEAD `3be316599df8b5025329414fcb75ad157a4b24db`。既有测试有 root basename 断言；未修改/跳过测试，而是另建同候选独立 checkout、独立安装依赖，完整执行。此证据明确 impact-rebind：其后 provisioning 源码/测试 diff 为空，后续只增加 composition 测试与修复 immutable copy 的字段顺序；后者直接影响的 artifact/Default 在最终 exact HEAD 新跑并由独立 reviewer 再跑。不是伪称29项在新 SHA 重新执行。

首轮 expanded 回归缺 `@deepseek-ai/dsh-tools` peer、checkout basename 不匹配，后续发现测试子进程继承代理及默认 Harness 路径不适用于本 worktree。均保留失败原文；本地 peer 连接、隔离 checkout、子进程 env 的具体机械动作见 [environment-receipt.json](docs/evidence/h1370-impl-baseline-20261108/v3/environment-receipt.json)。未改 package.json/lockfile。最终产物还修复一次真实回归：immutable 复制不得重排既有 artifact verifier 的输入字段；canonical identity 另行排序，保留所有原校验。相关修前失败见 `paired-regression.log`，不覆盖原文。

## 独立审查、结构与证据完整性

[独立语义复核](docs/evidence/h1370-impl-baseline-20261108/v3/independent-review.md) 由未写产品/测试语义的 `/root/authority_check` 执行，exact SEMANTIC_HEAD PASS，frozen union `{RCG-B1}` 已关闭，新增有效 blockers=0。B1 是同路径实际 Harness commit 变更仍获 G0 许可；修前执行见 [review-before-harness.log](docs/evidence/h1370-impl-baseline-20261108/v3/review-before-harness.log)，真实文件修复反例在 final 与独立重跑中通过。

结构检查保留 inherited debt 全单，不修改 registry/cap/allowlist。affected 文件最大500行，validator496、compose468；新文件深度4，改变 child set 的目录最大5项。原 oversized 顶层目录的 immediate child sets 未变。既有 runner 实际输出的版本标签、权威与候选结果见原文；本任务不声称另行完成 runner qualification。

全部证据实测 bytes/SHA-256 汇于 [evidence-manifest.json](docs/evidence/h1370-impl-baseline-20261108/v3/evidence-manifest.json)。主要原文 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| v3/baseline-route.log | `831bba88cbb3629bcdd8083c1094d5600a3d62cc69ad9b8a59e9beb9455f7129` |
| v3/final-regression.log | `403aef5d564b1fcc129eced7ec2e80512833f896dc1aa1ecb71d07fe1ff560ce` |
| v3/provisioning-canonical-checkout.log | `47af424a2586f40bf9b0d1d5ec9945401361b889f42d8f6845f7b3aa66341880` |
| v3/independent-recheck.log | `14bb89764f9f714ebd6c8fed7cb8d71b41108f3b9d7396e1b338c7203f82bb3a` |

v1/v2 STOPPED 和原输出保留；v3 修前 STOPPED 全字节副本另存 `v3/prior-STOPPED-1370-IMPL.md`。本地 `node_modules` 仍是 worktree 内依赖目录；原受跟踪外部链接的删除未提交。原有 untracked `packages/agent-router/test/native-goal.cordis.yml` 未纳入产品变更。原始内容、未运行和历史失败不改写为 PASS。

交付仅 source/tests/evidence。未合并、未安装产品、未重启服务、未调用真实生产 provider、未读取 credential payload、未修改生产配置/账本/身份/UNKNOWN fence 或 Svc。后续生产工作没有由本收据获得授权。
