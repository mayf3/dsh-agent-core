---
status: accepted
date: 2026-10-21
type: implementation-spec
scope: agent-memory inspection, bounded history retrieval, durable idempotent consolidation
accepted_date: 2026-10-31
accepted_by: Owner (semantic authority; direct task authorization)
acceptance_ref: https://github.com/mayf3/agent-control/issues/1248
implementation_started: false
production_change_this_round: none
---

# AGENT_MEMORY_INSPECT_HISTORY_IDEMPOTENCE_V2

> 2026-10-31 ACCEPT：Owner 已接受 issue #1248 固定正文方案。下文的 proposed / 本轮只文档措辞是 2026-10-21 提案历史语境；以本 acceptance 为当前实现权限。首轮仅交付正式 codec 基线对齐、inspect/history 两个只读能力；M2 副本迁移候选、M3 幂等 writer 后续交付。未授权生产安装、manifest 落盘、迁移或 writer 切换。

本 Spec 提案解决三件事：看清实际路径与生效状态；找回合法保留的历史；让相同证据只产生一次持久归并结果。当前只编写文档，**不是 accepted Spec，不开始实现、部署或真实迁移**。

## 1. 依据、继承与明确差量

Evidence：[HR_MEMORY_ACTUAL_CHAIN_20261021](../investigations/HR_MEMORY_ACTUAL_CHAIN_20261021.md)。

继承以下 accepted authority：

- `docs/decisions/MEMORY_V1.md:20–53`：workspace-local、file-first、bounded curated MEMORY.md、历史证据分层、人类可读、不同 agent 物理隔离。
- `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md:343,675–689`：main/cron/task 可贡献同 workspace 记忆；不合并 non-main 原始轨迹到 main。daily/turn-end/debounce/search 是策略，不是新的身份权威。
- `docs/specs/AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC.md:307` 起的 memory resolver：有 session 使用冻结 header.cwd，无 session 使用 primary；正常路径两者相等。memory 不自行认识 Binding/Channel/Feishu。
- `docs/specs/AGENT_PRIMARY_WORKSPACE_IMPORT_V1.md:128–145,246–268,313–323`：imported 原 workspace 是业务权威，旧 Agent Core copy 为测试状态，禁止 merge 测试记忆回 OpenClaw；Agent Core sole active writer。
- `.agents/README.md` 与 `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1`：先接受 Spec，再 DEVELOPMENT_PREFLIGHT/实现；实现 PR 不修改本 governing Spec。

本提案在接受后替换 memory 包的**实现策略**：仅当前文件检索、volatile checkpoint、按标题覆盖式归并、固定每轮提取2–3条、没有总量门限。它不改变 primary-workspace authority、Agent/Session 模型或原 import 禁止项。当前 `memory_search` 的默认含义保持；历史检索是显式新工具。

三个能力同属本有限 scope，可按阶段落地，不要求每个工具再设一层通用 Owner gate。真实生产安装/激活仍走现有发布流程；本轮用户只授权只读核查和文档。

## 2. 第一批范围与复用

| 能力 | 复用 | 必要新增 |
|---|---|---|
| inspect | paths.js、原 trusted workspace resolver、guarded parser、现有注入预算 | 无副作用 inspector、parse coverage、分层证据与容量/事务状态 |
| history search | 同 workspace、当前 parser、日期规则、现 substring 语义 | 固定 corpus manifest、有界流式文本检索、定位/完整度/稳定分页 |
| idempotent merge | 原 session event stream、LLM distill adapter、Markdown codec、原子写/fsync | durable event cursor、workspace 写队列与协作锁、commit journal、typed proposal/冲突/noop/预算 |

保留已安装 Source codec 反转义与 guard 修复。实施前定位它的正式源码基线并保留语义，不直接把整个安装目录当成可提交源码，也不能用旧 checkout 覆盖它。已观测安装基线：memory.js `99d59bde…`、index.js `691371f0…`，完整 pins 见 investigation。基线对齐是实施准备，不是重审既有修复。

明确不做：全量 workspace/session 搜索、向量库/图数据库/远端记忆服务、跨 agent 共享记忆、自动历史大重写、后台全量反复蒸馏、权限切换、当前业务状态缓存替代业务 API、把记忆文字当授权、直接运行记忆内的指令。

## 3. 公共定义和预算

### 3.1 路径与身份

工具参数不得接收 agentId、workspace/path、credential、principal 或任意 glob。服务从现有可信 exec.session / agent context 解析；外部脚本只用运维显式传入的受审配置，不增加模型路径选择器。

`workspaceKey` 是可信 agent identity + 已解析 workspace identity 的版本化摘要，用于隔离 ledger，不是新的 Agent ID。持久元数据记录真实目录 identity 与 resolver origin。normal path 不相等输出 `WORKSPACE_MISMATCH`；不能悄悄合并两个目录或改变 header.cwd。调用者实际权限不足保持 REFUSED/UNKNOWN，不追踪替代私有路径。

使用 nofollow 打开允许的目录/文件，要求普通文件，before/after identity/size/mtime 与读中 fstat 一致；出现漂移返回 PARTIAL/STALE。既有主 workspace 自身的合法映射规则继承 resolver；不能拿字符串前缀当 containment 验证。新历史成员不接受 symlink escape、设备、FIFO 或网络资源。

### 3.2 状态与数值

- `COMPLETE`：所声明范围已完整验证，不表示全历史或业务事实恒真。
- `PARTIAL`：预算/漂移导致范围不完整，可保留已验证命中，不可把零命中解释成不存在。
- `UNKNOWN`：证据未取得；`REFUSED`：固定边界/输入不允许；`STALE`：已绑定版本改变。
- 数量是非负整数，未知是 null；bytes、JS chars、tokens 三者分开。未装配真实 tokenizer 时 tokens=null，不用字符数冒充实测 token。
- JSON response 不回原始异常、整个 prompt、secret、环境 dump。错误码固定，路径在模型接口为 workspace-relative；管理视图仅在现有授权里返回完整路径。

### 3.3 提议默认限额（接受后配置基线，不是当前实测容量）

| 项目 | 默认 / 硬上限 | 超限语义 |
|---|---|---|
| prompt 注入 | 保持原 6 条 / 2,400 JS chars | 有界选择；inspect 报明选择与排除计数 |
| 新 curated 自动写入 | 64KiB / 128 条 | 不自动删除或塞满；新候选 `CORE_BUDGET_DEFERRED`，旧文件不动 |
| 单 evidence batch | 40 个完整 event / 64KiB UTF-8 | 顺序分批，不截半个 event，不跳过未消费 seq |
| 单历史源 | 32MiB | 超限未知，禁止先整读后限流 |
| 单历史查询 | 默认8MiB/32文件/1秒；允许至64MiB/256文件/5秒 | 中止为 PARTIAL，返回续查范围；不重试放大预算 |
| 历史命中 | limit默认10、最大50；excerpt每条<=800 chars、总<=12,000 chars | 截取明确标注；不全文回显 |
| inspect 输出 | <=64KiB；默认不带正文 | 未完成项目 UNKNOWN，不能偷偷扩大扫描 |
| transaction 元数据/未确认候选/保全空间 | 每workspace64MiB独立上限（不含既有原件） | `STORE_PRESSURE`，停止新持久写；保留已存在证据，不循环压缩/删除 |

实际字节必须从最终实现和副本量测；文件32MiB runtime防崩溃上限不等于推荐core64KiB。新限额不追溯使大归档非法，不在激活时自动截断它。任何原子替换要计当前日记/core/preimage/temp 的同时驻留峰值；不能以未来删除抵扣。

## 4. 能力一：memory.inspect

### 4.1 名称和接口

产品名 `memory.inspect`；模型工具名 **`memory_inspect`**；内部 `service.inspect({session,detail='summary'})`。沿用现有下划线 tool ABI，不创建点号远程 API。

参数严格 `{detail?: 'summary'|'coverage'}`，无任意路径。summary 读取当前core的有界内容以计算结构与摘要；不读取历史正文，只报告已配置 corpus 与可读元数据。coverage 可计算当前core的完整字节区间覆盖、已选注入候选计数；不是历史回放。

纯 inspector 不能调用 plugin apply、mkdir、LLM、memory tool、业务 API、迁移/索引写函数；不存在的文件原样报告 MISSING。CLI 诊断必须调用纯函数，而不是先 mount 再 inspect。

### 4.2 返回schema

`schema=AGENT_MEMORY_INSPECT_V1`，顶层固定：

```text
status, observedAt, scope,
binding {workspaceKey,resolverOrigin,primary,session,injection,writeTarget,equality},
version {configuredProfile,installedSource,loadedSource,attestationKind},
core {exists,bytes,sha256,format,entries,parsedByteCoverage,unparsedBytes,
      guardStatus,budgetStatus,readOnlyReason},
injection {configured,configuredMaxEntries,configuredMaxChars,
           predictedSelectionCount,lastObservedAssembly},
history {enabled,manifestDigest,sourceKinds,sourceCount,lastQueryCoverage},
writer {mode,ownerKnown,pendingTransaction,cursorState,lastCommit,pressure},
checks[], reasons[]
```

每个有证据字段带 `evidenceKind`（CONFIGURED / INSTALLED / IN_PROCESS / SAVED_REQUEST / OBSERVED_FILE / UNKNOWN）及 asOf/ref。没有 loaded digest 就 null；不得使用 installed digest 填 loaded。`lastObservedAssembly` 仅来自原进程真实 prompt 装配 hook 的有界 receipt（workspaceKey、core digest、选中ID摘要、charCount、成功/拒绝原因、time），不含记忆正文。未实施/未发生该 hook 时 UNKNOWN，不能为得到它主动发一轮模型请求。

format 是 MISSING / STRUCTURED / FREEFORM / MIXED / INVALID。coverage 必须能标出所有未被 parser 覆盖的字节；禁止“parse返回[]所以empty”。metadata相似文本不是合法entry锚点。当前人工维护说明/自由文本必须可见于coverage而不作为记忆条目误计。

追加 in-process receipt 是本 Spec 的有限可观察性差量；不开新 daemon/API/网络，不探测其他进程。receipt只在既有prompt装配发生时更新有界内存状态，必要持久写计入ledger预算；默认 inspect 自身零写。

## 5. 能力二：明确范围的历史检索

### 5.1 corpus

旧 `memory_search({query,limit?})` 保持搜索当前 curated 文件的兼容行为。新增 **`memory_history_search`**：

```text
{query, sources?: ['core','daily','archive'], fromDate?, toDate?,
 limit?:1..50, scanBudget?: 'default'|'extended', cursor?}
```

query 为1..256字符字面文本（不是正则/代码），sources默认三类；daily默认最近7个UTC日期，显式日期最大366天但仍受扫描预算。未显式选择的日期不暗中扩大。archive无对应事件日期的记录不能因归档文件名强行落入某天，返回 `eventTime=null`。

只允许：

1. 当前 `<workspace>/MEMORY.md`；
2. 该 workspace 的直接 `memory/YYYY-MM-DD.md`，严格实际UTC日期校验；
3. 经迁移 manifest 显式登记、在同权威 workspace 内的只读归档。本轮拟登记 **唯一** `MEMORY.md.bloated-20261022`，2,112,509B / `537b40d62731536e58ec66853e2e24a656098370716c52e281c31cef44919a03`；执行时必须重新核相同原件，不把本快照当永久可用。

manifest由原memory维护者在后续受审迁移生成，不由模型提供路径。禁止通配全部 .bloated文件、dispatcher JSON/JSONL、session原始轨迹、另一Agent、测试副本、settings/credentials、隐藏状态目录。历史加入搜索不是将内容重新晋升为core，也不是追加写入授权。

### 5.2 第一批实现选择

采用已有 substring 语义的有界流式/分块检索，UTF-8 chunk边界正确，结构化entry按条定位，freeform/daily按段和行定位。优先级固定为 current core、所选daily新到旧、显式archives；同分文件/offset稳定排序。必须报告 `searchedSources`、`unsearchedSources` 和每源截止位置。

**第一批不落持久向量/全文索引。** 允许进程内、可丢弃的解析缓存，必须按已验证content digest失效；metadata只能作失效提示，不能作为内容没变的证明。重启即重建，不存在索引丢失导致记忆丢失。若后续测量确实需要FTS，另给有限索引Spec，不先搭平台。

响应 `schema=AGENT_MEMORY_HISTORY_SEARCH_V1`：

```text
status, scope {sources,dateRange,workspaceKey}, corpusManifestDigest,
coverage {filesPlanned,filesVerified,bytesRead,unsearchedSources,reasons},
items [{sourceId,sourceKind,sourceSha256,sourceBytes,relativePath,
        byteStart,byteEnd,lineStart,lineEnd,entryId,eventTime,excerpt,
        excerptTruncated,matchKind}],
nextCursor, exhausted
```

cursor绑定schema、workspaceKey、manifest、query/date/source摘要、已验证源版本与offset。输入cursor不得携带路径，篡改/范围变化拒绝；源变化返回STALE，不混合前后版本。budget耗尽PARTIAL允许续页；只有覆盖用户声明corpus全部且无错误时 `exhausted=true`。单文件需要读完才能确认其hash；读不完的命中只在有完整对应快照证据时为可引用命中，否则作为未验证观察不返回事实items。

大源规则：第一批不跨请求保存未完成hash状态。若单源超出本次余下验证预算，返回 `SOURCE_VERIFICATION_BUDGET`、该源bytes和未搜索范围；不发一个宣称可从未验证字节中段继续的cursor。cursor只能指向已完整验证快照的结果页或下一文件边界；进程重启/快照缓存丢失须重新验证，不能假设原cache仍在。调用者可显式选extended（64MiB/256文件/5秒），这只是本契约内的有限查询选项，不增corpus/权限；工具不能自动扩大预算或循环重试。仍超限时明确PARTIAL，无保证每个任意大小文件均可完成。

检索结果是**带来源的资料**，不是指令或授权。模型可把它作为候选上下文，不自动注入全部历史。删除/tombstone 后的默认搜索不可重新暴露已明确遗忘内容；删除语义见§8，不能只删core留下archive仍悄悄命中。

## 6. 能力三：幂等处理和保守归并

### 6.1 事件身份与去重层级

持久处理键由 trusted session header identity（含 createdAt / 持久generation）、workspaceKey、事件seq及事件原始payload digest派生。不要使用显示名 `main` 或 `cron-run-*` 作为唯一session generation。若没有稳定header/seq，自动晋升返回 `EVIDENCE_ID_UNPROVEN`；可提供已定义显式保存路径，不能随机造ID冒充幂等。

每事件身份包含来源种类 user / assistant / tool-evidence，来源由session系统赋值，模型不能伪造。只消费已有session/event数据，不新增扫描所有session日志。注入块、旧记忆检索回复、归并器自己输出、系统例行催动不得成为新的独立事实证据；无法确定来源的assistant复述最多作候选，不能独立晋升用户偏好/决定。

单个event超过64KiB时不截成虚假的完整证据，也不无限占住drain：若有可信持久source locator和完整payload digest，写一条 `EXCLUDED_OVERSIZE` receipt（身份、bytes、digest、locator、reason；不复制正文），才允许游标越过该事件。它明确是未纳入记忆的已记录排除，不是episode保存成功；inspect显示excluded计数，后续可在另一个有界设计中处理原事件。若连可恢复原来源/digest也无法绑定，则 `BLOCKED_OVERSIZE` 停在该事件、停止定时重试并报告，不能丢弃。验收必须覆盖这两条分支。

两个层级分别实现：

- **处理幂等**：同一证据事件重复turn/end、显式consolidate、重启重放、重叠batch，只能产生一次episode和一次已确认promotion。cursor记录已提交事件，而不是timer已发出的事件。
- **事实归并**：同一语义字段冲突不凭相似度自动覆盖。先按已存在entryId或显式稳定factKey定位；同规范化content为NOOP，不改updatedAt。不同内容必须有同一subject的可信新revision/明确纠正关系才UPDATE，否则 `CONFLICT_PENDING`。新事实可CREATE，但每个条目必须引用本批evidenceIds。

factKey是保守精确键（workspace内subject/type/key），模型建议不直接建立事实同一性；无可信key的新内容只能按规范化type/title/content精确匹配去重。相似title、embedding或LLM“看着一样”只生成建议，不能DELETE/MERGE。第一批允许漏掉一些语义重复，不能以丢真事实换压缩率。

### 6.2 蒸馏与增长控制

修改现有 prompt：输出 **0..3 条**候选；没有新、稳定、可复用信息时必须 `[]`。例行检查无变化、重复心跳、仅部署中间态一般只留episode，不自动成为长期项目事实。当前业务状态优先查业务工具；记忆存规则/偏好/长期决定与证据引用，不宣称最新部署状态。

区分 `NO_NEW_FACT`（成功零候选）、`DISTILL_FAILED`、`DEFERRED_BUDGET`，不能全部叫fallback。模型合法结果也必须过source/type/size校验。无新证据不再调用LLM；相同已处理事件不再append daily。模型失败时可保留一次episode和失败状态，不自动反复调用；显式重处理已有episode只可创建新proposal revision，不能重复证据副本。

自动core总量遵守§3预算。达到上限时保留当前core，生成有界候选/原因并停止自动晋升；不得按“最近三条”覆写，不把高重要度当逐条永久豁免。历史整理/人工删改通过单独受控步骤，不能让普通memory_save顺便压缩历史。

### 6.3 持久存储不是第二个事实库

新增 workspace-local `memory/.agent-memory-v2/`，只存 protocol state：

```text
manifest.json                 # schema/owner epoch/corpus与功能状态
checkpoint.json               # 已提交事件游标与generation
transactions/<txid>.json      # 固定输入/前后摘要/阶段/receipt
transactions/<txid>.candidate # 未提交core候选，临时且不可作为当前事实
history-sources.json          # 显式只读归档登记
```

当前事实仍仅来自 MEMORY.md，daily/归档是历史。ledger不提供另一套任意fact upsert接口。模型工具不能访问这些原始文件或删除transaction；检索必须排除此目录。

每workspace内所有 save/update/delete/consolidate（main/cron/task/显式触发）共用一条串行队列。跨进程使用同workspace协作锁/owner epoch，排他创建、固定token、真实owner验证；第二writer BUSY。不能仅凭超时或PID不存在就删锁；owner不明时只读并由原维护生命周期在确认旧writer退出后恢复，不新增泛化Owner审批。

**人工编辑一致性边界**：单纯“写前重读＋rename”不具备与任意外部编辑器的原子CAS。机器写入保证以单writer和同锁/维护暂停协议为前提；支持人工编辑时先进入 `PAUSED_FOR_EDIT`，保留revision，编辑完成后校验/恢复。无协议直接编辑只能尽力检测，不宣称无丢写；检测到hash/identity变化立即CONFLICT，不覆盖。老版本writer同时运行不受支持。该边界必须在inspect和运维文档显式可见。

### 6.4 提交与恢复状态机

```text
COLLECTED -> PREPARED -> EPISODE_PERSISTED -> CORE_PUBLISHED
          -> COMMITTED(checkpoint) -> ACK
无core变化分支：EPISODE_PERSISTED -> COMMITTED_NOOP
任意异常：RETAINED / CONFLICT / READ_ONLY；不返回成功、不抹原件
```

1. 从既有session stream取连续未处理事件，冻结eventIds/batchDigest和core前镜像摘要；持久PREPARED intent + 候选计划，fsync文件和父目录。
2. 在同锁下写一次episode，使用固定machine marker `episodeId` 和完整block digest。采用有界原子日文件更新以避免半个append；保留既有非机器字节。已经存在相同完整marker为NOOP；存在partial/冲突不可再append假成功。
3. 在同一受控写窗口确认core基线未变、候选覆盖合法后，沿原codec/guard/metadata保持方式写temp、fsync、rename、fsync父目录。保存before/after digest。
4. durable transaction记录完整post-state后再推进checkpoint，返回receipt。ACK丢失后相同event重交返回原receipt，不再改文件。
5. 崩溃恢复只验证PREPARED中已固定的输入/plan与实际pre/post哈希：已写完就补receipt/checkpoint，未写就从已保存候选恢复，不再次蒸馏生成不同结果。遇人工或其他未知字节变化保持CONFLICT；不覆盖、不“以最新为准”。

这是可恢复的多文件协议，**不是宣称多个rename原子提交**。daily可能先出现，core仍旧；read工具只认可已完成的core文件，inspect展示pending；在恢复完成前新机器写停下。每一故障点都有测试。

事件cursor不在收集/timer调度时前推；不可因40条上限跳过队尾事件。触发期间的新事件合并为同session待处理队列，当前提交后继续有界drain；每次工作预算到达时保留pending，不无期限占用前台。explicit与auto使用同一协调器，不保留两个绕开幂等的写入口。

### 6.5 兼容现有工具

旧工具名/基本参数保留：memory_save/search/list/update/delete/consolidate。读工具不触发迁移/repair。写工具进入上述单协调器；可选 `expectedRevision` 与稳定调用receipt由trusted tool-call context产生，模型不能伪造历史source。

现有返回的成功字段保持，新增 `status,receiptId,revision,reason`；旧调用者只有完成commit才收到原成功action/id。NOOP明确返回，冲突/只读/预算不足是typed non-success；不把保存候选当saved。内部显式 API `consolidate(evidence)` 缺trusted event envelope时改为候选模式，不能给任意字符串自动补“session已证实”的来源。

## 7. 格式、迁移与回滚

### 7.1 不覆盖原记忆的分阶段迁移

M0 **dry-run**：只读snapshot manifest记录current/归档/日期源的path、bytes、hash、身份、结构覆盖、双写状态；生成报告在独立owned候选目录。归档可核读，不重复蒸馏整份2.1MB文件，不加载生产plugin。原文件无写。

M1 **历史只读启用**：在后续获准的安装/配置阶段仅新增受审的workspace-local history manifest/config元数据，先开启inspect/history；core/daily/archive原字节不变，仍关闭v2机器归并。历史query自身不得改任一源或manifest。先验证能找到core已移出的指定事实和对应来源。

M2 **协议迁移候选**：在副本上创建ledger，分类STRUCTURED/FREEFORM/MIXED。解析器必须输出lossless document model：前言、维护说明、未知区块及分隔符均保留原字节；只修改明确entry span。无法无损重写则READ_ONLY_FORMAT、保留候选，不走旧render全文件重建。不把原归档全量写回core。

M3 **受控单writer切换**：确认生产writer静止、snapshot仍一致和所有新写都经过v2协调器；记录rollback前镜像，配置generation明确。仅此阶段才允许切换writer并更新既有core/daily记忆文件；M1仅有显式元数据新增。两者都属于后续原发布/迁移执行，当前未授权执行。不要让OpenClaw旧writer与Agent Core同时写。

### 7.2 rollback

- 只启用inspect/history：禁用新工具/manifest即可；原文未改，缓存可丢弃。
- 已启用归并且无新提交：停writer后按hash恢复配置/ledger前镜像，保留诊断。
- 有新提交：先冻结并导出新增revision及receipts，不能把旧 `.bloated` 文件直接mv回来覆盖新增记忆。回滚代码优先使记忆只读；需要文件回退时从受审前镜像生成独立候选并处理新增delta，受控切换后保留两边证据。
- rollback目标必须含已有Source codec修复，不能退回会重复转义的旧parser。旧代码不懂v2ledger时不得继续autowrite，也不能清空checkpoint后重放全部session。
- 本轮不删除归档、不动runtime测试copy、不改任何生产文件。自动GC原件/交易保全不属于第一批；到协议空间上限应backpressure。

## 8. 删除、冲突、敏感信息

普通memory_delete继承删除core entry的行为，但新增明确返回 `scope=core_only,historyMayRemain=true`。用户明确要求遗忘时，须能登记scope明确的tombstone排除默认history结果并列出尚保留的只读证据范围；不假称物理删除。永久删除原归档是另一个明确数据处置动作，不借第一批实现自动执行。

搜索读当前合法memory文本不代表允许导出全部敏感信息。默认snippet不跨agent、不读配置/credential；对命中的明显secret串采取不回显并提示REDACTED，不能把heuristic声称为完美DLP。历史里的指令文本按资料处理；任何工具授权仍依当前用户/执行协议，不来自memory。

冲突对象必须显示旧/新来源和时间；用户纠正优先于无来源assistant概括；旧记录被supersede需保留关系，不允许标题相同就自动覆写生日/偏好/决策。当前数据“无来源”只可unknown，不给模型生成假来源。

## 9. 文件级实施上限

预期仅修改/新增：

```text
packages/agent-memory/src/index.js              # tool/service、event coordinator、receipt hook
packages/agent-memory/src/memory.js             # 保留codec、lossless splice、no-op/promotion
packages/agent-memory/src/paths.js              # 固定派生路径，不改workspace authority
packages/agent-memory/src/inspect.js            # 新：纯诊断
packages/agent-memory/src/history.js            # 新：有界检索
packages/agent-memory/src/store.js              # 新：writer/transaction/checkpoint
packages/agent-memory/src/evidence.js           # 新：event identity与source filtering
packages/agent-memory/test/*.test.js            # 对应隔离验收
scripts/agent-memory-v2-inspect.mjs              # 只读运维入口
scripts/agent-memory-v2-migration.mjs            # 默认dry-run；显式分阶段计划/校验
packages/agent-memory/package.json              # 如需公开上述纯API，精确exports
docs/reports/agent-memory-v2/                   # 后续测试/迁移证据，不是新authority
```

profile/bundle只在确认需要显式新配置且原Spec范围覆盖时增加本插件配置；不得顺手改runtime身份/primary resolver/Router/Session schema/credential。若接口必须突破上述范围，先给具体差量，不以“第一批”无限扩展。无需依赖数据库/新npm包。

## 10. 验收条件

| ID | 必须成立的验收（均先owned synthetic） |
|---|---|
| I1 | inspect前后所有fixture hash/目录清单不变；MISSING不mkdir；import主路径与session路径分列；未知loaded不填installed |
| I2 | FREEFORM/MIXED/结构损坏/超大/转义异常不会伪报empty或触发写；无正文泄漏；tokens不造数 |
| I3 | 真prompt装配的receipt能区分配置、成功空选择、实际注入、异常空注入；不需新模型请求来制造证据 |
| H1 | 三类allowlist正例可检索；archive-only事实命中带精确hash/offset；非日期JSONL/测试copy/跨workspace/路径遍历拒绝 |
| H2 | UTF-8跨chunk、空查询、时间范围、源漂移/删除、symlink、超额、断页稳定性正确；零命中但未覆盖返回PARTIAL |
| H3 | 原memory_search仍只查core；history工具不触发写/LLM/npm/network；新旧版本兼容 |
| W1 | 同事件重复100次、auto+explicit竞态、跨session同workspace并发、重启重放：episode与promotion各至多一次 |
| W2 | 在每个fsync/rename/checkpoint/ACK边界注入失败：恢复后old或new完整文件、无双追加、无半事实成功、可返回原receipt |
| W3 | 协作人工编辑/第二writer冲突不覆写；外部不合作编辑不虚称CAS；owner未知不删除锁 |
| W4 | 0条候选不增长core；相同内容NOOP不改时间；标题相同冲突不丢旧事实；来源不足不晋升 |
| W5 | 40事件批次边界不丢队尾；cursor只随commit或明确的durable exclusion；单event超限的EXCLUDED/BLOCKED不冒充saved且不空转；继承Source codec/guard回归和metadata保持 |
| M1 | migration dry-run字节守恒，原件hash不变；混合正文保留；新写后的rollback不丢delta；测试copy永不merge |
| B1 | 注入/搜索/队列/存储限额可实测；查询和大文件超限明确PARTIAL，不OOM/静默截断/持续反复蒸馏 |

性能报告必须给硬件、fixture大小、冷热读、P50/P95及预算终止比例；第一批目标是当前2.1MB归档+7日真实规模的synthetic corpus在默认预算内可用，不捏造生产延迟承诺。后续受控canary才验证实际loaded版本、路径一致、自动注入、读写/检索行为与增长率。source/test PASS不等于production verified。

## 11. 交付与接受边界

配套计划：[2026-10-21-agent-memory-inspect-history-idempotence](../superpowers/plans/2026-10-21-agent-memory-inspect-history-idempotence.md)。

本轮交付是 proposed Spec + 已核查证据 + 支持计划；无实现/测试/安装/真实迁移。接受本Spec后，只需沿现有原review/发布流程推进有限实现；未来实际source revision、query结果、迁移效果是实施验收对象，不倒置成当前文档必须先产生的前提。任何未被观察到的权限/loaded状态继续UNKNOWN，不构造新的泛化Owner等待门。
