# #1370 原设计、有效合同与实际差量核对

结论：**`loud skip` 无关无效条目，不等价于原 Issue 的“整代验证／原子激活／可信配置快照”。不能据此直接实施 skip。** 当前代码也尚未实现 skip；它在解析目标前重新验证整个可变配置文件，任一无关条目失败仍会阻断目标。实际修复需要分离配置代发布与运行消费，并先明确无效候选代出现后的消费政策。

本报告是 Owner 授权的只读语义核对，不是新的 Product Authority、政策接受事务或产品修复完成回执。

## 1. 授权、坐标与核对范围

| 项目 | 本次绑定 |
| --- | --- |
| 执行授权 | Owner `BRIEF-1370-R3-SEMANTIC-VERIFY`／worktree 修正④：“由原作者核对有效合同及实际差量”；允许核对文档 commit、push、PR 到 main，不合并；零生产写入 |
| Repository / worktree | `mayf3/dsh-agent-core` / `/Users/yanfenma/workspace/project/worktrees/h1370-route` |
| 输入与分支 parent | `b6ddc2a67ba041b8b13ed33d331104cf809d4985`（下称 B） |
| main 只读快照 | `1d5bda0d6301995806f33d0d15e46673acfb4c13`（下称 M）；`git ls-remote origin refs/heads/main` 与本地 `origin/main` 一致 |
| 输出分支 | `docs/1370-semantic-verify`，从 B 新建；PR base 为 main，不 rebase、不合并 |
| 时间 / 核对执行者 | `2026-11-08T02:43:06Z` 源码与 main 快照核对；Codex `/root`，并有两个独立只读子代理分别核对源码和权威 |
| 原设计来源 | [mayf3/agent-control#1370](https://github.com/mayf3/agent-control/issues/1370)，GitHub 记录作者 `mayf3`，`updated_at=2026-11-04T14:42:06Z`；本轮经 GitHub connector 读取正文 |
| 文档路线 | `COMPLIANCE / REUSE`（复用现有权威作核对，不改变合同）`/ BRIEF / DURABLE`；本节及 Owner 任务构成该有界文档工作的 Brief |

已读治理入口、local precedence、spec-governance 的 COMPLIANCE 模式、Product Architecture、Decision index / D-008、直接相关 Fleet V3、Default V1 和 WEC V4。架构和 D-008 保留 ownership、Session 与薄层边界，不提供配置代接纳政策。候选 Fleet V4 / Default V2 不作为已接受权威。

`GOAL_OR_TARGET`：判定 skip 是否语义等价，并给出证据和最小接受路径。`CURRENT_GAP`：前次把 skip 当作修复方向，但未证明整代信任与失败政策等价。`EVIDENCE_NEEDED`：Issue 正文、精确权威版本、真实调用链、可达反例。`DONE_WHEN`：本报告完成核对并提交指定分支与 PR。`EXPANSION_TRIGGER`：只有本核对依赖的证据不可访问或矛盾影响论证时，停止该依赖；产品实现、治理改写、依赖修复与生产操作均不在本次授权范围。

## 2. 原 Issue 要求：没有“无关坏条目可丢弃”的设计

Issue 正文的“定性”明确：

> 全量校验对**配置原子发布**是合理要求；问题在把每次使用时的可变整文件重校验和故障域绑定。

“最小修复”明确：

> 配置发布边界完成整代验证 → 原子激活已验证的不可变代 → 运行边界只消费绑定的可信快照。是否继续用旧代由既有授权政策决定——**不可静默忽略错误或使用未经验证的 fallback**。

据此提取的任务约束是：

1. 全量验证保留在配置发布边界；不是把全量验证改成目标局部验证。
2. 激活对象必须是已通过整代验证的不可变配置代；不能从失败候选中挑出可用部分当作该代已经生效。
3. 运行消费绑定可信快照，避免每次使用都重读可变整文件并重新耦合无关故障。
4. 候选失败必须可见；旧可信代能否继续需要既有授权政策，Issue 没有自行选择“总是继续”或“总是停止”。

早先 `BRIEF-1370-ROUTE` 提出的“无关条目错误降级为跳过，保留日志”，只满足错误可见性的一部分，没有承接第 1–3 项。Issue 是本次任务定义与约束，不能仅凭其产品文字认定缺失的长期政策已经获得 accepted Contract。

## 3. WEC V4 的定义与权威边界

### 3.1 在输入 B 中：accepted/contracts，但不定义模型路由解析

[WEC V4@B](https://github.com/mayf3/dsh-agent-core/blob/b6ddc2a67ba041b8b13ed33d331104cf809d4985/docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4.md#L1-L71) 的 frontmatter 为 `status: accepted`、`implementation_authority: contracts`、`production_apply_authority: none`，并保留 reviewed head 和接受记录。PR #655 的 merge `48a2c6769a8e4f3b18b86182d7c98a8b1eb59db5` 是 B 的祖先（本轮祖先检查 rc0）。

其 [§1–2](https://github.com/mayf3/dsh-agent-core/blob/b6ddc2a67ba041b8b13ed33d331104cf809d4985/docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4.md#L73-L129) 管 Workflow execution ledger、状态投影、continuation、Owner assistance，以及两类远程 collection read 的解锁／重新校验时序。107–108 行明确 Router admission seam、reconciliation store 和 Session semantics 对该 Spec 是只读面。§9 的十个 Contract（308–630 行）没有定义模型配置代发布、无关条目 skip 或旧可信代继续资格。

全文检索 `resolveRouteChain`、`loadAgentModelOverrides`、`agent-model-overrides`、`routeCatalog`、`可信配置` 均为 0 匹配；结合 Scope 与 Contracts，**任务所问的“WEC V4 对 resolveRouteChain 的行为定义”实际不存在**。其中 Workflow snapshot / generation 不能挪作模型配置代政策。WEC V4 不能证明 loud skip 等价或授予该变更实施权。

### 3.2 在当前 M 中：存在后继及互相冲突的记录

不能沿用任务输入“WEC V4 当前 accepted@main”的描述：

- [WEC V4@M](https://github.com/mayf3/dsh-agent-core/blob/1d5bda0d6301995806f33d0d15e46673acfb4c13/docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4.md#L1-L43) 第 4–5 行已是 `status: superseded` / `superseded_by: ...V5`，第 29 行仍有第二个 `superseded_by: null`。
- [WEC V5@M](https://github.com/mayf3/dsh-agent-core/blob/1d5bda0d6301995806f33d0d15e46673acfb4c13/docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md#L1-L58) 第 3 行是 accepted，第 17 行却是 `implementation_authority: none`；45–47 行仍称 PROPOSED，并明确要求正式接受时改为 contracts、不得 none 原样接受后声称实施权。
- [Spec index@M:459](https://github.com/mayf3/dsh-agent-core/blob/1d5bda0d6301995806f33d0d15e46673acfb4c13/docs/specs/README.md#L459-L462) 则称 WEC V5 已接受且有 implementation contracts。

这是具体 lifecycle／实施权冲突，本报告不选择 YAML 重复键的解释、不替 Owner 改写接受含义。任何依赖这组记录取得新 WEC 实施权的动作保持停止，最小关闭是由 authority owner 对齐精确已接受 head、frontmatter、正文、索引及 reciprocal links。该冲突不影响对 B 中 WEC V4 的历史核对，也不影响下述独立的路由语义反例；本次只读核对文档可完成。

### 3.3 实际相关的模型路由合同

以下权威在 B 与 M 的文件字节相同，仍为 accepted/contracts：

| 来源 | 已决定的边界 | 没有据此决定的事项 |
| --- | --- | --- |
| [Fleet V3 `CTR-SCA-003/004`](https://github.com/mayf3/dsh-agent-core/blob/b6ddc2a67ba041b8b13ed33d331104cf809d4985/docs/specs/AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3.md#L624-L650) | schema 拒绝 duplicate/unknown keys；startup 和每个新 Luna child generation 验证 credential/plugin/provider 身份；不匹配阻止启动／准入 | credential generation 的身份要求不是旧路由配置代继续消费政策 |
| [Fleet V3 `CTR-SCA-012`](https://github.com/mayf3/dsh-agent-core/blob/b6ddc2a67ba041b8b13ed33d331104cf809d4985/docs/specs/AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3.md#L787-L810) | deployment-owned chain、closed route kinds、duplicate/unknown/cycle rejection、immutable turn-start snapshot；既有 fallback 和 STOP_CHAIN 边界保留 | 没有规定候选整代失败时旧可信代可继续的资格、目标自身无效显式项的处理和代失效条件 |
| [Default V1 §3](https://github.com/mayf3/dsh-agent-core/blob/b6ddc2a67ba041b8b13ed33d331104cf809d4985/docs/specs/DEFAULT_MODEL_ROUTING_CONFIG_V1.md#L115-L154) | closed 配置优先级；explicit configuration always wins；§4 明确原任务不改变 schema/loader 校验 | 不能自行把显式无效配置当作 absence，也没有授权永久冻结启动配置或无条件使用旧代 |

候选 Fleet V4 / Default V2 仍为 proposed、exact-head acceptance pending，并明示旧权威继续控制；其 plugin generation 议题不能补成已经接受的路由配置代政策。已搜索的当前 authority inventory 未找到 Issue 所依赖的旧可信代继续政策；不把“未找到”扩大为对所有历史记录的穷尽性结论。

## 4. 当前源码行为：全文件重载后才解析目标

以下链接固定于 B；相关两份 production-runtime 源码在 M 中完全相同：

| 源码坐标 | 直接观察 |
| --- | --- |
| [compose.js:247–261](https://github.com/mayf3/dsh-agent-core/blob/b6ddc2a67ba041b8b13ed33d331104cf809d4985/packages/production-runtime/src/compose.js#L247-L261) | 252 行启动全载；253–254 行每次 `resolveRouteChain(agentId)` 都重新调用完整 loader，然后才 `resolveChain(agentId, globalRoute)`；`initialModelOverrides` 没有作为失败后的可信代接管 |
| [model-overrides.js:274–302](https://github.com/mayf3/dsh-agent-core/blob/b6ddc2a67ba041b8b13ed33d331104cf809d4985/packages/production-runtime/src/model-overrides.js#L274-L302) | 每次验证 artifact context、读文件、JSON parse、duplicate-key scan、顶层 v3 schema；错误直接 throw |
| [302–424](https://github.com/mayf3/dsh-agent-core/blob/b6ddc2a67ba041b8b13ed33d331104cf809d4985/packages/production-runtime/src/model-overrides.js#L302-L424) | 校验完整 routeCatalog，再遍历全部 overrides；即使条目与目标无关也参与；411 行 unknown routeRef 抛 `AGENT_MODEL_OVERRIDE_INVALID`，没有 catch-and-skip |
| [425–492](https://github.com/mayf3/dsh-agent-core/blob/b6ddc2a67ba041b8b13ed33d331104cf809d4985/packages/production-runtime/src/model-overrides.js#L425-L492) | 只有完整 load 成功后才返回冻结对象；474 行的 `resolveChain` 从该对象选目标、返回冻结 routes；无 override 才走 globalRoute；443–448 行 `chainId` 只哈希目标 route identities，不是完整配置代身份 |
| [route-chain.js:309–324](https://github.com/mayf3/dsh-agent-core/blob/b6ddc2a67ba041b8b13ed33d331104cf809d4985/packages/agent-router/src/route-chain.js#L309-L324) | resolver 错误写入 `configInvalid:true`、`totalRouteAttempts:0`、`fallbackActivated:false` 的 journal 后 rethrow；没有在 catch 中继续旧代 |

**已有冻结对象／turn snapshot，不等于已有独立的整代发布及原子激活机制。** loader 仅读配置、不负责发布；本次检查的 resolver 路径没有候选代与 active trusted generation 的分离。此结论限定于该调用链，不断言仓库外所有部署工具都没有原子文件写入。原子写文件本身也不能证明 runtime 正在绑定消费同一个已验证不可变代。

## 5. 非等价论证

设 `Valid(G)` 表示候选 G 的 catalog 和所有 overrides 均通过验证，`Active` 表示已激活可信代。原设计要求：新的 G 进入 `Active` 及被消费，前提是 `Valid(G)`；消费不能从失败候选中局部取值。`loud` 只改变诊断可见性，不能使 `Valid(G)` 变真。

可达静态反例（假定 artifact context、注册 Agent 和 r0/r1 均合法，B 为已注册无关 Agent）：

| 时点 / 动作 | 配置 | 当前代码 | 假设改为 skip B | 原设计要求 |
| --- | --- | --- | --- | --- |
| G0 已验证 | A→r0，B→合法路由 | 可解析 A→r0 | 同左 | 可绑定 G0 |
| 文件变为 G1 | A→r1（合法显式变更），B→`missing` | 对 A 解析也在 loader:411 throw | 丢弃 B 后消费 G1 的 A→r1 | G1 整代验证失败，不能将其作为已验证新代激活，也不能部分消费其中 A→r1 |

因此 skip 的可观察结果包含“从整代失败候选取得新的 A→r1”，原设计禁止此路径，二者不等价。即使换用 Issue 的更小反例，保持 A→r0 不变，目标路由输出偶然相同也只说明该次输出相同，不能证明配置代来源、激活原子性或可信边界相同。

另外两种实现也不能直接当作等价解：

- 拒绝 G1 并继续 G0：保留了整代拒绝，但仍需证明 G0 当前有资格继续、A 的显式变化／自身无效条目如何处理及何时停止消费；现有 inventory 没有关闭这一政策。
- 永久只用启动 G0：避开后续坏文件，也改变后续配置生效与 explicit-wins 的适用行为；不能凭缓存方式自行决定。

若所谓“skip”仅指发布边界报告 G1 整代失败，而运行侧依照已接受政策继续消费 G0，则可能符合原设计；但那已经是“拒绝候选＋有资格的旧代消费”，不是“忽略 G1 的 B 后使用 G1 的 A”。当前证据未提供所需旧代政策，故不能在本轮判为可安全实施。

## 6. 实际差量与最小接受路径

实际差量应围绕同一个配置发布／消费模型，至少关闭这些可测试语义，不预先规定新 schema、数据库或新的控制服务：

1. **发布与运行分离**：候选在发布边界完整验证；失败不得部分接纳。运行 resolver 只消费绑定的 active trusted generation，不能每次对可变全文件重新建立信任。
2. **验证与激活绑定**：成功验证的精确内容才可一次激活；运行 snapshot 可归因到该不可变代，并避免验证内容与消费内容不一致。现有目标 `chainId` 不能单独证明该关系。
3. **失败政策**：无效候选如何显式拒绝；已有可信代是否继续、适用 Agent／条件、失效或停止边界；没有可信代时如何拒绝。
4. **目标显式项**：A 自身无效、A 显式修改、A 删除或缺失与“B 无效且 A 未变”分别如何选代／拒绝；保持 unknown rejection、closed priority 和身份验证，不能把无效项伪装成未配置。
5. **路径一致性**：启动、后续消费、child generation 和重启／恢复使用同一信任边界；保留既有 turn snapshot、fallback/STOP_CHAIN、credential/plugin 校验和脱敏诊断。

最短可接受顺序：

1. 先由 owning routing Product Authority 对第 3–4 项作出持久、可评审的决定，明确与 Fleet V3 `CTR-SCA-003/004/012`、Default V1 §3 的关系。本报告列出缺口，不代 Owner 选择“继续旧代”政策。
2. 若改变现行 rejection 的通过集合或失败含义，按 local governance 走 **whole-authority `SUPERSEDE`、docs-first**，保持 reciprocal links；若改变 Default 的 explicit-wins／生效含义，对应 authority 也需要完整后继。只有严格新增且不改变现有含义的决定，才可经重新 PREFLIGHT 判定有界 `AMEND/NEW`；不能把 skip 直接标为 REUSE。
3. 对 `SUPERSEDE`／其他 docs-first 路线，精确 Spec delta 经独立语义评审及 Owner／授权 maintainer 接受，并进入实施 base 后，另开 `REUSE` 实施任务。若重新 PREFLIGHT 确认为有界 `AMEND/NEW + ROUTINE/DURABLE` 且本地原子权限已激活，可按该权限在同一 PR 提交 delta 与实现，独立接受后才可合并；本次只读任务不授权该实现。若有人主张已有政策足够，先提供该 accepted 精确合同与本反例的映射；可据此缩短路线，不能用代码、测试、Issue 或本报告代替合同。
4. 实施验收至少覆盖整代失败不部分接纳、合法整代一次激活、运行消费代绑定、A/B 两类无效项、旧代资格／终止、启动／重启及既有受影响路由套件。前次 RED 在依赖载入阶段失败，不是有效业务 RED；本轮不补依赖、不复跑，不把既往活动换成通过证据。

WEC lifecycle 冲突另由该 authority owner 关闭；它不提供路由政策，也不作为改写 Fleet／Default 的理由。本次文档不接受任一后继、不改治理或产品代码、不部署、不合并。

## 7. 证据、限度与最终状态

| Evidence | 来源 / 坐标 / 结果 | 支持及限度 |
| --- | --- | --- |
| EVD-1370-001 | 本轮 connector 读取 agent-control#1370 正文及作者、更新时间；§2 保留关键原文 | 支持原设计约束；不是长期政策接受证据 |
| EVD-1370-002 | B 的 WEC V4 §1–2、§9 全面查找上述函数／配置名称无命中，并核对 scope；同时读取 M 的 V4/V5/index | 支持 WEC 不定义该路由政策及 main 冲突；不裁决冲突、不赋新实施权 |
| EVD-1370-003 | 源码调用链，B/M 两个 production-runtime 文件 `git diff --quiet` rc0；§4 精确坐标 | 支持当前全量加载、错误传播、冻结后选目标；静态证据，不是本轮运行复现 |
| EVD-1370-004 | Fleet V3 / Default V1 精确合同、候选后继状态、§5 可达反例 | 支持 NOT_EQUIVALENT 及 load-bearing policy gap；不宣称完整 runtime conformance |

Git blob 绑定（本次读取，不是文件内容的 SHA-256）：

| 文件 | B blob | M blob |
| --- | --- | --- |
| `packages/production-runtime/src/model-overrides.js` | `084109744b00eb55e9c4211d1d466b93cc5ef06a` | 同左 |
| `packages/production-runtime/src/compose.js` | `400f993f2a95f9c5c772adce359f74d7b45930a8` | 同左 |
| `docs/specs/AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3.md` | `aa471c58867f2b9225d9872d396c54009f220bd1` | 同左 |
| `docs/specs/DEFAULT_MODEL_ROUTING_CONFIG_V1.md` | `6d9a97f7e114f0039e574a4550aeec044af66891` | 同左 |
| `docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4.md` | `291635710a6ede6671931d0687cc7bde4b2a4f7b` | `5f765b827a920652bdd1498f0f0f0a7ad41e7a10` |

适用合同为 Fleet `CTR-SCA-003/004/012` 和 Default §3；源码为本论证提供支持，但四项完整运行 conformance 均保留 UNKNOWN。WEC 的十项 Workflow Contracts 对本次模型配置语义判定为 NOT_APPLICABLE，不冒充已通过复验。

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = COMPLIANCE
REVIEW_SCOPE = AFFECTED
SEMANTIC_EQUIVALENCE = NOT_EQUIVALENT
SEMANTIC_FINDING = SUPPORTED_BY_SOURCE_AND_COUNTEREXAMPLE
IMPLEMENTATION_STATE = NOT_STARTED  # #1370 修复，非本报告
VERIFICATION_STATE = PARTIAL        # 源码/权威核对；runtime/tests NOT_RUN
CONFORMANCE_RESULT = UNKNOWN       # 不把静态语义结论冒充完整运行合规
SPEC_GAP_DEPENDENCY = LOAD_BEARING   # 候选失败后的代消费政策
IMPLEMENTATION_ALLOWED = NO        # 直接 loud skip 或自行选择新政策
IMPLEMENTATION_READY_TO_MERGE = NO
OPERATION_ALLOWED = NO
OPERATION_COMPLETE = NOT_APPLICABLE
NEXT_PRODUCT_ACTION = RE_PREFLIGHT
NEXT_DOCUMENT_ACTION = COMMIT_PUSH_PR_BASE_MAIN_NO_MERGE
```

原有 `STOPPED-1370-ROUTE.md` 是前次实现尝试的停点；本次语义核对没有解除其依赖门或产品实施停点。非等价是本次任务允许的结论，不是修复失败后继续写产品。核对交付限本报告及指定 Git/PR 动作；产品源码、测试、配置、治理、原始 Brief 和前次 STOPPED 均保持原样，生产写入为零。
