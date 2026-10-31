# D14 R3：方向 A 已裁定；Core pin 权威冲突停止实现

方向 A 已定：接受 `gen-032-20261031-123906 / dsh-codex@0.3.2` 为正当舰队版本，不回滚 117 个 current-linked home。本轮未重开 A/B 裁定。依用户“语义性失败/spec 冲突即停”要求，发现下述具体冲突后，**接受路径、流程防护代码及行为测试的语义改动停止**。本报告是非权威证据和后续设计建议，不是新 Spec，也不是已修复或可发布声明。

## 工作位和本轮授权

- 指定工作位 `/tmp/proddsh-d14-fix` 已从 R2 事实分支切回 `ac-D14D13-spawn-proof@1921f8795e2212506a7a833bc79b84c17ba50ea1`；保留 `ac1159-deploy` 生产线，不移植到 main 实现。
- Git 使用 worktree 内独立 `.git-r2-isolated`，依赖延用 R2 的 worktree 内复制品。未向共享 checkout、home/current、credential 或生产配置写入，未部署、重启或 spawn。
- R3 直接用户任务授权隔离实现、验证、commit/push、PR 和 `mayf3/agent-control#1345` 回填，并明确 Spec 冲突停止。该执行授权不替代 accepted Product Contract 的 successor 接受事务。
- 已精读 [R2 PR #599](https://github.com/mayf3/dsh-agent-core/pull/599) 的报告、expected 读取链、provenance 和保护/回滚前提。R2 的“方向待裁定”是历史状态；本轮方向为 A，剩余是其权威及互操作前提。
- Fresh fetch 的 authority/integration main 为 `3a1282b35e7b852f51cd14284ea91fd77a13543e`。远程没有 `ac1159-deploy` 或 `ac-D14D13-spawn-proof` 分支；本轮 push 创建后者，PR base 使用 main，部署目标仍为 ac1159 生产线，PR 保持 draft。

生产分支相对 main merge-base 既有 8 提交、7 文件差异：`bundle-broker/cordis.patch.yml`、Broker registry/transport、Product API history listener 及其测试、production entry 及其测试。这些是本轮之前的生产修复，未撤销、重做或计为 R3 实现。`shared-codex.js`、provisioning `index.js`、`model-overrides.js` 三个关键文件，以及下列三个直接权威文件，在生产 HEAD 和 main 的 blob 完全相同。完整坐标和既有差异见 [coordinates.json](../evidence/d14-r3-20261101/coordinates.json)。本轮产品源码 delta 为零。

## 具体冲突与停止边界

| accepted 权威 | 当前义务 | 与方向 A 所需实现的冲突 |
|---|---|---|
| `AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3` CTR-SCA-004，L638–650 | 新 Luna generation 必须证明 compatibility line=`0.2.3`；不符必须拒绝 | gen-032 的 `0.3.2` 应被放行，改变现有拒绝语义 |
| 同 Spec CTR-SCA-013，L831–834 | package compatibility version remains `0.2.3`；later feature/version 不得隐含进入 incident recovery | 保护通过不等于获得新版本 admission 权威 |
| `DEFAULT_MODEL_ROUTING_CONFIG_V1` §2，L102–107 | built-in default 复用 `0.2.3` exact pin 和完整 source/archive/Harness 身份 | 仅从 current/package.version 派生 expected 将替换其冻结身份 |
| `AGENT_CORE_GPT6_LUNA_REASONING_ROUTE_V1` CTR-G6R-001/002，L109–123、167–171 | legacy resolved config、route/provisioned identity 保持相同；另允的 dormant tuple 为 `0.2.3-dshr1` | 全局改 pin 或让旧 tuple 解析为新 artifact 均非 REUSE |

可达反例就是本任务要求的 fixture：`route.pluginVersion=0.2.3`、home 指向 gen-032/`0.3.2`。当前 Contract 要求拒绝，修复后的要求是放行；即使 R1/R2/R3 全部 PASS，也无法同时满足互斥版本身份义务。生产源码 `packages/agent-provisioning/src/index.js:202–212` 确实先比较该版本并抛 `plugin_version_mismatch`；`:402–404` 从 subscription 携入 expected。`model-overrides.js:218–224/319–346` 另有 tuple/pin 选择及 catalog gate，不能只改一处字符串。

Authsvc 域的 `AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2` A1 L55–59 仍限 `75d98d5b…`，A4 L90–92 要求 normal provisioning 使用相同 accepted exact artifact。它是既有 Product 414/B7 的有界操作权威，不是 D14 的通用授权；后续若复用该 installer/marker 路径，必须显式处置此约束。域外 Activation V2 及无关 lifecycle/routing 契约不因此重审。

独立只读审查由 `/root/authority_check` 完成，结论同上，冻结发现为 `D14-R3-AUTH-001`（`SPEC_GAP / LOAD_BEARING`）。见 [审查记录](../evidence/d14-r3-20261101/independent-authority-review.json) 和 [PREFLIGHT/完整依赖诊断](../evidence/d14-r3-20261101/preflight-r3.json)：`SUPERSEDE + BRIEF + CONTROLLED`，`IMPLEMENTATION_ALLOWED=NO`、`MERGE_READY=NO`、`OPERATION_ALLOWED=NO`、`NEXT_ACTION=RE_PREFLIGHT`。证据提交本身可继续。

停止依据不仅是本轮红线：`.agents/local/README.md` 禁止在原 stable ID 下改写 accepted 意义；`.agents/skills/spec-governance/modes/PREFLIGHT.md:112–122` 要求 `SUPERSEDE -> docs-first whole-authority successor; no same-stage implementation/operation`。没有据此索要部署许可或重新裁定方向 A。

最小闭合：在 authority main 接受 pin/身份的 whole-authority successor 事务，明确新的完整 tuple、current 与 expected 同源的信任边界，并处置上述 Default/GPT6 直接义务；保持 dormant GPT6 身份独立。接受记录须进入生产实现 base，之后作为 REUSE 恢复同一生产分支的实现。不能把本报告、PR 或方向任务文本自标为该接受事务。

## 流程防护设计建议（未接受、未实现）

以舰队发布事务选中的**经过接受及校验的 generation**作为唯一版本/身份输入：在 generation 内携带完整不可变描述符，绑定 generation ID、plugin version、source commit、archive SHA-256、Harness 及依赖 closure、保护与兼容 evidence。`current` 的受控原子切换同时选择这份描述符；runtime admission 从同一 generation 派生 expected，验证 home 解析到同一 artifact。禁止用任意 home/package.json 或 current 指向的任意磁盘包自行创造准入资格。

实现接缝应复用生产 `compose.js:250` 的 artifactContext、`deployment-artifact.js:40–74` 的 root/source/archive/custody 校验、`plugin-artifact.js:92–98` 的 tuple gate，以及 `process-registry.js:287–309` 的 processConfig/routeIdentity 传递；这些当前仍有 legacy 硬绑定，须在权威接受后同步修正。`compose.js` 在 main 已有后续重构差异，不能用 main 整文件覆盖生产版本。

共享 generation 的接受分支必须只读验证。现 provisioning `index.js:232` 的 `stampInstalledArtifact(installedRoot, ...)` 会沿 home symlink 写到共享 generation，不能直接复用为 immutable-generation 接受路径；安装、stamp 和 peer-link 修复也不能借 admission 写共享 payload。这是当前可达写路径，不是已执行的生产写入。

读取应固定一次 generation 身份；在 admission/child reuse 边界确认 current 和 home 仍与它一致。不存在、描述符/证据缺失、未接受身份、哈希不符、保护失败或切换中的混合状态均 fail-closed；不得回退旧常量、猜版本、删除检查或静默改用另一 provider。发布预检应验证 canonical default、显式 catalog tuple、正常 home rebuild 和 child reuse 都使用同一选择结果，避免只更新 default 而留下显式 `pluginVersion=0.2.3`。

回滚对象应是完整经过批准的 generation 与对应描述符，不能单独改 expected 或复活旧 credential lineage。本任务已否决撤走现行修复的 home 回滚；此处只是后续事务一致性设计要求，不执行任何回滚。

当前 gen-032 身份据 R2：source `7cfa139e111956a7193622afc734126b52d7bf07`，release archive `8755ae67673ddc08ba7511a8b11582151763972cb5c00e733f4e94f87717daf2`。R2 的 14,299 个 archive regular-file 字节一致证据可通过影响检查复用；它不是权限、完整 runtime tuple、保护执行或当前进程加载身份的证明。本轮未重读生产 credential。

接受前提仍须逐项证明：

- R1：真实 Loader/apply/config 传递 canonical credentialFile；relative/component-symlink/hardlink/private-parent 负例拒绝；不引入 per-home credential fallback。
- R2：canonical-filename 跨进程锁、锁内重读、remote fixture callback 前 durable intent；多进程同世代最多一次 synthetic refresh；崩溃边界保留 intent，commit/clear durability 不退化。
- R3：same-generation pending intent 在 read/use/refresh 前 fail-closed；无旧 token 重试；replacement document 及权限先验证；显式 Owner recovery 走真实 login 入口，无自动 refresh 越权，稳定错误身份和脱敏不变。
- 兼容：用合成当前 credential document、pending intent、无效/有效 replacement 与显式 Owner recovery fixture，验证新 reader、保留字段及恢复行为。外部 restoration Spec 明示不建立完整 Core V3 互操作；这些 Core admission 组合证据与完整新 Harness/依赖 tuple 在本轮仍 **UNKNOWN/NOT_EXECUTED**，不得以 build 成功或版本标签替代。

## 验证、快照与交付范围

R1 留存失败名清单原样复用，SHA-256 `e259ec5017a7f13ab9a1148c97bc87f7393242fdc974fa7f64554bba29ece2a9`。在生产源码 HEAD `1921f879`、worktree 内复制依赖下执行同一 123 文件命令，结果 **938 tests：867 passed / 62 failed / 9 skipped；exit 1**。对 r1 新增/移除失败名均 0；r1、r2 全量 named-status diff 均 `[]`。这仅是基线一致，整体不是 GREEN。命令、逐项结果、失败名、raw 可检索路径及哈希见 [comparison-result.json](../evidence/d14-r3-20261101/comparison-result.json)、[named-results.json](../evidence/d14-r3-20261101/named-results.json)、[provenance.json](../evidence/d14-r3-20261101/provenance.json)。执行前后 83 条依赖 symlink 均解析到本 worktree，外部依赖链接 0。

本任务要求的“旧 expected+新 home 修复前拒/修复后放行且执行保护”“一致时语义不变”“不存在 generation fail-closed”三组**修复回归未实现、未执行**，受上述权威冲突阻塞；不能用旧命名集通过项冒充这些 fixture，也没有 D14 RED→GREEN。

共享 checkout 开工/收工 link 和 `ls -la` 快照见 [shared-links-comparison.json](../evidence/d14-r3-20261101/shared-links-comparison.json)：30 条链接的 path/target/inode/mtimeNs 和目录快照字节均相同，双边 SHA-256 `4346ef42597f0209f06a7c7280751dcebdb333b0d3adfdb91c8fac7eb468adaf`。边界仅证明列出的 symlink/目录元数据不变，不冒称全盘全时写入审计。R3 没有产品、Spec 或行为测试语义改动，没有部署/重启或运行验收。该 draft PR 和 #1345 回填交付的是准确停止点、验证和防护设计，**D14 修复目标仍未完成**。
