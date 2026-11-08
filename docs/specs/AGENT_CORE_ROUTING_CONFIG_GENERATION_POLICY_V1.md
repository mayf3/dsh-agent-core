---
spec_id: AGENT_CORE_ROUTING_CONFIG_GENERATION_POLICY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-11-08
authoring_base_main: 45d008a5e4df2c8a44f83fe5d4dca150d2772c7f
scope:
  - routing configuration candidate publication, exact-content activation and immutable runtime generation binding
  - bounded continuation of an existing trusted generation after an unrelated override references an unknown route
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_WORKSPACE_SESSION_MODEL_V3
  - AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3
  - DEFAULT_MODEL_ROUTING_CONFIG_V1
  - AGENT_CORE_GPT6_LUNA_REASONING_ROUTE_V1
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V4
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_ROUTING_CONFIG_GENERATION_POLICY_V1

> #1370 的 docs-first 政策提案。`proposed / none` 如实表示本候选不授予实现权；
> 未作政策接受、不更改既有 accepted authority、不实施、不合并、零生产写入。

## 1. Goal

在完整验证配置发布候选、一次激活精确不可变代的前提下，解除“无关 B 的坏引用
必然中断 A 使用已有可信配置”的耦合。只为可证明未变的目标规定有界继续资格；
不把日志、局部有效条目或一次相同的路由输出当作整代信任。

## 2. Scope and non-goals

范围是现有 deployment-owned model route 配置的发布和运行消费边界，覆盖启动、后续
消费、新 child generation 和重启恢复。沿用现有 v3 schema、默认优先级、单一 chain
executor 与身份校验。generation 是配置内容及其验证上下文的身份，不是 Agent、
Session、process generation、OAuth refresh generation 或新的授权主体。

本提案不规定数据库、文件格式新版本、独立控制服务、watcher 或发布 CLI；不改路由
内容、fallback 分类、credential/plugin 协议、Grant、身份、Session、Workflow、
Scheduler、生产配置或运行进程。发布失败的继续政策仅覆盖 §9 的封闭错误类别。

## 3. Authority and dependencies

直接上位分析输入是 main 上 [SEMANTIC-VERIFY-1370.md](../../SEMANTIC-VERIFY-1370.md)
§5–6（[PR #667](https://github.com/mayf3/dsh-agent-core/pull/667)，merge
`deb5d223484c81d9c20b04bf4b219803e7c29638`）。它证明 NOT_EQUIVALENT 并指出政策
缺口，不是本提案的 Product Authority。任务来源是 Owner 的
`BRIEF-1370-POLICY-AUTHOR.md` 和
[agent-control#1370](https://github.com/mayf3/agent-control/issues/1370)。

以下坐标均绑定 main `45d008a5e4df2c8a44f83fe5d4dca150d2772c7f`；既有规范保持原义。

| 既有条款 | 本提案关系与逐条处置 |
| --- | --- |
| [Fleet V3 CTR-SCA-003](AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3.md#ctr-sca-003--agent-core-routeprofile-wiring)，624–634 行 | PRESERVE：v3、duplicate/unknown rejection、route order 和 canonical credential wiring 不变。§9 拒绝 G1 整代，绝不让 G1 的局部条目进入通过集合 |
| [Fleet V3 CTR-SCA-004](AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3.md#ctr-sca-004--shared-mode-fail-loud-invariant)，636–650 行 | PRESERVE：startup、每个 Luna child 及 running-child reuse 的当前身份证明不变；G0 可信不豁免当前 credential/plugin/provider/artifact 校验 |
| [Fleet V3 CTR-SCA-012](AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3.md#ctr-sca-012--ordered-route-policy-carried-forward-unchanged)，787–810 行 | PRESERVE：部署拥有顺序、最多四路、closed kinds、canonical identity、duplicate/unknown/cycle rejection、turn snapshot、每路最多一次、closed hop、STOP_CHAIN、single executor、脱敏均不变。配置代选择是新增政策面 |
| Default V1 §3，115–134 行 | PRESERVE：request/session > agent/profile > runtime/global > builtin；explicit always wins。目标显式修改、删除、自身无效均不能用旧代或低层默认掩盖 |
| Default V1 §4，136–158 行 | PRESERVE：原 default 任务的实现范围/non-goals 保留；本政策不删减 loader 校验谓词，不改 schema 键。该历史任务的“loader 校验零改动”不被改写为允许 skip，也不被扩大为永久禁止新发布边界 |
| Default V1 §2、§6 ACC-D1/D2/D3/D5 | PRESERVE：无配置的 canonical default、opts/env 优先、显式 agent 和 request 路由含义不变；缺失与无效不能互换 |
| GPT6 V1 CTR-G6R-001/002/003/005/006、ACC-G6R-005 | PRESERVE：legacy bytes、tuple-specific pin、effective effort identity、全部既有 checks/拒绝和 credential custody 不变；其非法字段矩阵不属于本提案的继续类别 |
| D-008 §7–12、§22、§27.6.2；Process Lifecycle V4 C-013–C-016；D-009 §0/§6 | PRESERVE：target Agent ownership、primitive 所选 Session、UNKNOWN/termination/no-replay 保持，配置代身份不授予业务 admission 或 fence 解除权 |
| Product Architecture §3–5 | PRESERVE：沿用薄 composition/Router 边界；不建第二套 LLM executor、Session engine 或凭据管理器 |

**路由：NEW / BRIEF / DURABLE / AUTHORITY_AUTHORING。** §8 的配置代发布和有界继续
资格是既有 Decision 未蕴含的新独立决定，不是同 ID 下的 AMEND。表中没有既有条款
被改变，故不宣告 Fleet/Default 整权继任；`supersedes: []`。当前源码遇 B 错误全局
throw 是 Observation，不能单凭该行为判定旧 authority 已决定永久全局停止政策。

若实际条款/审查发现改变了既有 rejection 通过集合、failure 意义、explicit-wins
或身份门，必须停止依赖路线并 RE_PREFLIGHT，对实际被改变的 authority 起草完整
SUPERSEDE；不能以 NEW 名称覆盖冲突。候选 Fleet V4/Default V2/GPT6 V2 不作 active
依据。WEC/Svc 接受链不定义本政策，与本任务互不设前置，也不重做 PR #668。

## 4. Current State

`STATE-RCG-001`：在上述 base、隔离 worktree `h1370-policy`、2026-11-08T03:17:59Z
的源码/权威读取中，§5 所列调用链仍逐次全量重载；缺少本政策定义的配置代发布及
旧代继续资格。依据 `OBS-RCG-001/002`。运行部署、产品测试及真实恢复结果均 UNKNOWN。

## 5. Observations

- `OBS-RCG-001`：main 上 SEMANTIC-VERIFY 的 SHA-256 为
  `7fe9507d161ca0cc1020f6867e3cb7a56cf259cdd48cf6162a3009a9cdd3b0f6`；本轮 connector
  读取 PR #667 得 merged=true；Issue #1370 正文仍要求整代验证/原子激活/可信快照，
  `updated_at=2026-11-08T02:51:54Z`。来源/时间为 §4 坐标，本轮读取，不是运行试验。
- `OBS-RCG-002`：base 的 `compose.js:252–254` 在启动及 resolver 调 loader；
  `model-overrides.js:274–424` 校验全文件，411 行 unknown routeRef throw，425–492 行
  成功后冻结并选目标；`route-chain.js:309–324` 对错误记录零尝试并传播。
  静态只读方法，精确路径为 `packages/production-runtime/src/{compose,model-overrides}.js`
  和 `packages/agent-router/src/route-chain.js`。Git blobs 依次为
  `400f993f2a95f9c5c772adce359f74d7b45930a8`、
  `084109744b00eb55e9c4211d1d466b93cc5ef06a`、
  `bbcd86575572ddf2126777538b85a7a336eb0527`。
- `OBS-RCG-003`：本轮读取 §3 accepted 文本；Fleet/Default blobs 分别为
  `aa471c58867f2b9225d9872d396c54009f220bd1`、
  `6d9a97f7e114f0039e574a4550aeec044af66891`。本轮 `ls-remote main` 与 authoring base
  相等；文档内容和来源均可由该固定 commit 重读，不读取真实 credential 内容。

## 6. Claims and assumptions

`CLM-RCG-001`（SUPPORTED，`EVD-RCG-001`）：日志加 skip 不能代替整代信任；拒绝
G1 与允许具资格的 G0 是两个决定。证据限静态反例和权威，不声称实现已通过。

`CLM-RCG-002`（INFERRED，`EVD-RCG-002`）：§9 的封闭继续资格保持 §3 既有规范，
可用 NEW 补齐独立政策；必须由非作者独审和真实受托维护者裁定，作者不自签接受。
没有需要运行实现依赖的 OPEN_ASSUMPTION；新政策本身明确写为提案 Decision。

## 7. Evidence relations

| Evidence | Source → Target / relation | 坐标、充分性与限制 |
| --- | --- | --- |
| EVD-RCG-001 | OBS-RCG-001/002 → CLM-RCG-001 / SUPPORTS | §4 base、SEMANTIC-VERIFY §5 的 A→r1/B→missing 反例和源码；足以支持非等价，非 runtime conformance |
| EVD-RCG-002 | OBS-RCG-003 与 §3 逐条关系 → CLM-RCG-002 / SUPPORTS | §4 固定 base 和 accepted 条款；支持有界 NEW 判断，不能替代精确候选的独立语义审查或接受事务 |

## 8. Decisions

`DEC-RCG-001`（proposed）：发布候选与运行代分离；只有完整验证的精确内容一次激活。

`DEC-RCG-002`（proposed）：候选失败显式整代拒绝；仅对无关 Agent 的 unknown routeRef
故障，在目标完整输入未变且当前信任资格持续满足时允许旧代消费。其他失败拒绝新消费。

Decision owner：repository owner `mayf3`，或 PR 中具有真实接受权限且记录授权来源的
受托原路由维护者。方向授权来自简报；以上精确条款尚未接受。拒绝无条件继续、局部
skip 和永久启动缓存，理由及 alternatives 见 §11。

## 9. Contracts

### CTR-RCG-001 — 整代发布与精确激活

发布边界 MUST 从一次捕获的不可变候选 C，对 catalog、全部 overrides 和其验证
上下文完整执行既有校验；任何失败 MUST 显式拒绝整个 C，MUST NOT 部分激活或
部分消费。只有全部通过的精确内容和绑定上下文可作为新的 trusted generation G
一次原子激活；验证后重新读取可变文件的内容不得顶替它。合法发布 MUST 对后续
消费切换为完整新 G，不能永久固定启动 G0。并发/失败发布不得出现混代或旧提交
覆盖已确认的更新；有序发布结果和运行准入资格须在同一可归因边界生效。

G MUST 绑定完整配置内容、明确的 file-present/absence 状态、部署/验证上下文及
运行取值所需的 global/default 配置；generationId 必须能归因到这些精确非秘密输入。
不得只用目标 chainId 证明整代身份；不得哈希/读取 credential payload 作为证明。
不要求增加 JSON schema 字段或持久化服务。

### CTR-RCG-002 — 运行快照只取可信代

resolver MUST 只从绑定且有资格的 active G 生成 immutable turn-start snapshot；
snapshot 的 generationId、Agent、chainId、上下文和内容来源须可追溯。候选诊断中
的目标条目或局部解析结果 MUST NOT 成为运行值来源。每个 turn 的 routes 在该 turn
内保持不变；新代只影响后续消费，配置发布不能重放、转移或重新准入已有 turn。
运行不得通过每次读取可变全文件重新“建立信任”；变化须先经同一发布边界处理。
未处理/无法归因的输入变化不得被当作已验证更新或继续资格证明。

### CTR-RCG-003 — 无效候选与旧代继续资格

失败发布 MUST 记录 candidate identity、拒绝类别/范围、active generation identity
及目标 continuation/refusal 决定；失败候选不变成 active。已有 G0 不自动等于可继续。

仅当以下条件全部成立时，后续目标 A 消费 MAY 继续绑定 G0：

1. G0 曾整代验证并原子激活，来源/完整性/当前上下文可证明，未被替代或撤销。
2. 本次候选 C 可无歧义解析，既有 schema/duplicate/exact-key/注册身份及 catalog
   验证全部通过；完整错误集合**仅**是一个或多个其他已注册 Agent 的 override
   引用不存在的 routeRef。该封闭类别不含 unknown Agent、unknown key、catalog
   失败、cycle、artifact/plugin/credential 或 reasoningEffort 非法项。
3. §CTR-RCG-004 的 A 完整输入闭包有效且与 G0 完全相同，所有错误均在该闭包之外。
4. A 的当前准入、credential/plugin/provider/artifact 与 child reuse 资格仍全部通过；
   任何现有 UNKNOWN fence/其他准入门继续独立生效。

只可从 G0 取值，不可将 C 的任何字段拼入 G0。无 G0、G0 身份/内容不可证明、
错误集合不完整、任一条件失败或未知时 MUST 拒绝该目标新消费，零路由尝试，
不得用 builtin/global/另一 provider 或另一历史代绕过。无效候选的受影响目标
（包括坏引用所属 B）MUST 拒绝，不能因诊断 loud 而获得继续资格。

继续资格终止于：新有效代激活；G0 撤销/损坏/上下文失配；目标或其闭包变动；
新失败不在封闭类别；输入变化尚未被发布边界处理；当前身份/准入资格失效或
不可证明；持有 G0 的 runtime 生命周期结束。资格不靠时间流逝自动恢复，不以
任意 TTL 代替这些条件。每次后续发布都须重新计算资格，不继承上一拒绝的许可。

### CTR-RCG-004 — 目标显式项与完整输入闭包

A 的闭包 MUST 包括：A override 存在/缺失状态、全部原始条目字段、primary/fallback
顺序、引用到的全部 descriptor 字段、canonical identity、effective reasoningEffort、
providerEnv、subscription/plugin/version、artifact/source/Harness 绑定及 credential
路径身份；还包括适用的 request/session、agent/profile、runtime/global 和 builtin
层的显式状态及值。不能只比 routeRef、provider/model、chainId 或最终输出。
候选投影仅用于否定/证明继续资格，不能作为选路值来源。无法完整比较 MUST 拒绝。

| C 的情形 | 选代/拒绝义务 |
| --- | --- |
| 整代合法，A 显式修改 | 完整激活 G1；后续消费按同一 closed priority 取 G1；不继续 G0 |
| A 未变，只有 B unknown routeRef | C 整代拒绝；仅满足 CTR-RCG-003 全部条件时消费 G0 |
| A 自身无效，或 A 引用了未知/无效 descriptor | 拒绝 A；不得当 absence 或走低层默认 |
| A 显式修改，B 同时无效 | C 拒绝且 A 拒绝；既不消费 C 的新 A，也不继续 G0 的旧 A |
| A 原有 override 被删除，B 同时无效 | C 拒绝且 A 拒绝；既不保留旧显式项，也不从坏 C 部分采用 global/default |
| A 在 G0 和 C 均缺失，B 无效 | 缺失状态及适用全部默认/显式层同一才可能继续 G0；不是新建 absence |
| 合法整代删除 A，或可证明文件缺失的合法无 override 候选 | 整体激活包含该 absence 的 G1，按既有 closed priority 解析；保留 Default ACC-D1 等含义 |
| JSON 坏/重复键/unknown envelope、整文件不可读、无法判断闭包 | 拒绝新消费；不得猜 A 未变或当文件不存在 |

request/session 显式配置始终保留其既有优先级与 strict 语义；不得作为坏候选、
generation 资格失败或身份门失败的旁路。这里不新增 Router per-turn 配置层。

### CTR-RCG-005 — 启动、child 与恢复一致

启动 MUST 先整代验证并激活当前候选；无 override 文件可按既有合法 absence 构成
代，坏/不可读文件不能构成 absence。新 child generation、running-child reuse 与
后续 resolver MUST 受相同 G/上下文/目标资格及既有身份校验约束。

本最小政策的 G0 继续资格仅限持有它的当前 runtime 生命周期。重启/恢复 MUST
重新整代验证当前候选后激活；MUST NOT 凭缓存、磁盘残留、历史 receipt、旧 chainId
或旧 child 复活 G0 的继续资格。冷启动候选无效时拒绝；跨重启保留可信代及其准入
状态不在本政策授权内。原子激活前后崩溃不得得到半个 G；无法证明精确内容/完成
激活时拒绝，不能猜成功。配置代切换本身不授权重启或终止任何业务执行。

### CTR-RCG-006 — 既有执行、身份与诊断边界

MUST 保留 §3 全部既有 rejection、closed priority、身份、turn snapshot、fallback/
STOP_CHAIN 和 redaction。候选失败不是新的 hop class，继续 G0 不是 fallback attempt。
诊断必须区分“C 被拒绝/G0 被有条件消费/A 被拒绝”，不得把发布失败计为发布成功。
仅记录非秘密配置身份、代/目标、稳定失败类别及结果；不得输出 Secret、credential
内容/摘要、原始 provider body 或未脱敏配置全文。

D-008 的 Agent/Workspace/Principal/grants、main/Messaging/Delegation/cron Session
选择 MUST 不变。配置有效、重新发布、恢复或新 generationId MUST NOT 证明旧 turn
已终止、改变 `outcome_unknown`、解除旧 fence、重放旧 prompt/tools、修改业务账本，
或绕过 Process Lifecycle V4/D-009 的独立准入条件。只在既有执行门已允许的请求上
评估本配置资格；本政策不发行 new-lineage cut 或跨 Agent 权限。

## 10. Acceptance

以下是未来实现的验收定义，本轮产品测试 **NOT_RUN**；不是执行 Evidence。
所有案例环境均为隔离 fixture、无真实 Secret、无生产网络/状态，绑定未来实现
HEAD、政策接受 revision、base、命令及退出码、输入和脱敏结果。

| Acceptance / Contracts | Method | Required evidence | Expected result | Failure condition |
| --- | --- | --- | --- | --- |
| ACC-RCG-001 / CTR-RCG-001 | G0→合法 G1；验证后篡改源；并发发布/激活前后故障注入 | 精确输入身份、验证/激活/消费顺序及 snapshots | 成功只整代激活精确已验证内容；失败无半代/倒序覆盖 | TOCTOU、混代、部分接纳、永久停在 G0 |
| ACC-RCG-002 / CTR-RCG-002 | 在 turn 中发布下一代；只给失败 C 目标条目设置标记值 | turn 与后续 snapshot 的 generation/source 绑定 | 已有 snapshot 不变；运行值从 G0/G1 之一整体取得 | 标记值泄漏、只以 chainId 认定整代身份、配置变化触发 replay |
| ACC-RCG-003 / CTR-RCG-003 | G0 后 C 仅 B unknown routeRef、A 完整未变；再取消任一继续条件；cold invalid | 全量错误集合、G0来源、逐目标资格、路由尝试计数 | C 明确拒绝，A 有资格时从 G0 消费，B 拒绝；无信任/未知/超范围均零尝试 | 静默 skip、错误仍激活、无 G0 放行、上一许可永久沿用 |
| ACC-RCG-004 / CTR-RCG-004 | 执行 §9 全部目标表；另测同 ref 改 descriptor/effort/proxy/artifact、两代均 absent | 各配置层存在性/内容比较、选代/拒绝结果及 provider 调用数 | 显式变更/删除/自身无效在坏 C 下拒绝；合法 G1 整体生效 | 旧显式覆盖新意图、无效当 absence、部分使用 C、漏依赖 |
| ACC-RCG-005 / CTR-RCG-005 | 启动/后续/新 child/reuse/重启；G0后坏 C再重启；篡改当前身份 | 各边界代身份/当前校验证据、零 spawn/零路由断言 | 仅当前runtime合格 G0 可继续；重启全验证，坏候选拒绝；身份失配拒绝 | 从残留恢复信任、child旁路、旧身份续用、半激活 |
| ACC-RCG-006 / CTR-RCG-006 | 受影响 route suites 与 Default ACC-D1/D2/D3/D5、GPT6非法矩阵；注入 UNKNOWN、输出/工具开始、credential失配 | closed hop/STOP/journal、Session/identity与旧turn账本前后对比，脱敏输出 | 原有拒绝、优先级、单 executor及UNKNOWN/fence/no-replay保持 | 增加hop/默认降级、UNKNOWN重标/重放/解除fence、Secret泄漏 |

Reverse coverage：CTR-RCG-001→ACC-RCG-001；002→002；003→003；004→004；
005→005；006→006。六个 Contract 均有映射；全部测试定义，执行覆盖 UNKNOWN。

## 11. Alternatives and disposition

- `ALT-RCG-001`：loud skip B 后从 C 取 A，REJECTED；A→r1/B→missing 会部分接纳坏代。
- `ALT-RCG-002`：坏 C 无条件继续 G0，REJECTED；会掩盖 A 变更/删除/自身无效与资格失效。
- `ALT-RCG-003`：永久缓存启动 G0，REJECTED；合法整代更新无法生效。
- `ALT-RCG-004`：所有发布失败都拒绝所有旧代消费，不选为本新政策；可以保持安全但
  不关闭 #1370 的无关 B 故障耦合。本政策只选择 CTR-RCG-003 的封闭例外，未扩大为
  所有局部故障可继续。扩大类别或跨重启恢复须另行 RE_PREFLIGHT。
- `ALT-RCG-005`：预设 Fleet/Default 全部继任，当前不选；只有实际改变 accepted 意义
  时才对相应 authority 完整 SUPERSEDE，不能靠文件名或当前实现差异代判。

## 12. Migration, compatibility, and rollback

| 受影响模型 | Disposition |
| --- | --- |
| 既有 v3 schema/validator、默认层级、单 chain executor、credential/plugin校验 | RETAIN，复用同一规则；不增加永久双 loader/双 executor |
| 每次 resolver 全文件重载并自行建立信任 | MIGRATE：未来实现把消费者移至发布后的绑定代；正常、child、恢复路径一起排除旧信任入口 |
| 现有错误和历史 UNKNOWN、旧代/发布拒绝证据 | RETAIN：可审计历史，不提供当前资格 |

本次无数据迁移、无 runtime 安装或恢复动作。未来 code rollback 不得让坏 C 变成可信；
配置 rollback 本身视为新候选，仍需整代验证/原子激活及当前身份门，不复活历史许可。
实现细节、部署 runbook 和生产授权在其各自任务处理，不由本提案产生。

## 13. Open questions and acceptance boundary

```text
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = NEW
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_PRODUCT_ARCHITECTURE_V1
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_AUTHORITY = none
IMPLEMENTATION_ALLOWED = NO
IMPLEMENTATION_READY_TO_MERGE = NO
OPERATION_ALLOWED = NO
CONTRACT_COUNT = 6
CONTRACTS_WITH_ACCEPTANCE = 6
OPEN_OWNER_DECISIONS = NONE  # 无留白产品选择；不表示本提案已被接受
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE  # 本政策依赖范围
AUTHORING_READY_FOR_REVIEW = YES
READY_TO_MARK_ACCEPTED = NO
NEXT_ACTION = REVIEW
```

正式接受的前置清单：

- [ ] 非作者独立语义审查，明确裁定 §3 的路由和全部六个 Contract，绑定 reviewed HEAD、
  Spec 内容摘要、base、受影响面和 blocker union；审查建议不等于接受。
- [ ] PR 中记录原路由维护者/受托接受者的实际身份和真实授权来源；作者、子代理或
  GitHub 技术写权限不能代替接受权限，不重复请求 Owner 批准既定目标。
- [ ] 有权受托维护者对精确条款作正式接受事务，绑定 reviewed semantic HEAD 与最终
  accepted HEAD，并完成最终差量复核；有实质漂移重新审查受影响项。
- [ ] `implementation_authority: none` 原样接受仍不授权实现。如接受事务拟授予未来
  `contracts`，必须在接受前的最终候选明示并独立复核该差量；不得事后把 none 解释成
  contracts。政策只有在 exact accepted revision 进入 main 后生效。
- [ ] 实施另开任务 RE_PREFLIGHT，核对 active accepted/contracts base、实际代码面与
  当前 authority；生产仍需独立 mandate。当前任务只交付提案、commit/push/PR 和报告，
  不执行以上接受/合并/实现动作。
