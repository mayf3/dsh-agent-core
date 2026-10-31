# HR Memory 第一批能力实施计划

> 状态：PROPOSED SUPPORTING PLAN；本轮只编写与审阅，不执行下面的代码、测试、迁移或生产步骤。
> 本计划不是第四套 authority；唯一拟 governing Spec 是 `docs/specs/AGENT_MEMORY_INSPECT_HISTORY_IDEMPOTENCE_V2.md`，当前 status=proposed。接受并落入正式源码基线前不得开工实现。

**目标：** 在不丢原文、不中断身份/工作区模型的前提下，提供可解释的 inspect、找得到旧记忆的历史检索，以及重复事件不重复写入的归并。先交只读价值，再解决长期写入可靠性。

**实现结构：** 复用 `packages/agent-memory`、现有resolver、Markdown codec、tool registration、session event接口与fsync写入模式；新增少量本地模块，不建新服务/数据库。不把prod-installed与checkout当同一版本。

**技术栈：** 当前仓库Node ESM、node:test、fs/promises、原Cordis/Zod接口；无需新增npm依赖。测试全部owned临时目录，LLM用确定性stub，不真实调用HR。

## 0. 当轮已做与尚未做

已完成只读调查与proposed Spec。两份保存HR session证明cwd为原OpenClaw workspace，保存请求有六个记忆工具；未核实当前loaded generation/最终自动注入。当前core又从6条增至24条；search只查core。完整证据见 `docs/investigations/HR_MEMORY_ACTUAL_CHAIN_20261021.md`。

**未做：** 代码修改、测试、插件mount、迁移工具、原记忆覆盖、生产配置、运行时发送、权限修改。下面命令全部是未来执行计划，不是已经通过的验证记录。

## 1. 依赖与交付顺序

```text
Spec接受 / 正式文档基线
       ↓
T0 版本对齐 + 测试隔离
       ↓
T1 lossless文档模型 + 纯inspect ──→ 只读能力可先交付
       ↓
T2 有界history搜索 ─────────────→ 归档可检索，可不等写入切换
       ↓
T3 evidence身份与候选规则
       ↓
T4 workspace写协调器 / journal / crash恢复
       ↓
T5 接入全部写入口 + 零新事实策略
       ↓
T6 dry-run迁移与回滚工具 / 综合验证
       ↓
原发布流程：只读canary → 受控单writer切换 → 行为验收
```

T1/T2的读功能不要求先把5,337条历史归并；不得用它们读取production来“先试出”实现期的缺口。T3/T4在owned副本完成，部署/迁移独立于代码PASS。

## 2. T0 — 确立真实开发基线和安全测试夹具

**修改范围：** 先不动产品；定位 accepted codec修复的正式source/commit；修改必要测试fixture。

1. 开始实现时输出 `DEVELOPMENT_PREFLIGHT`：绑定本Spec accepted ref、MEMORY_V1/V2/import规则、调查证据、scope及禁止项；不得将本计划当Spec接受。
2. 使用干净隔离worktree。当前共享checkout存在大量与memory无关修改，不能重置、顺手stage或提交它们。
3. 从原源码记录定位已安装 Source codec/guard修复基线；确认目标分支包含严格decode、guard、fsync和mode/uid/gid保持。只核这项真实版本差量，不重跑旧部署gate，不复制整个生产包回repo。
4. 修正测试夹具：所有测试启动时显式清除 `DSH_PRIMARY_WORKSPACE`、`DSH_AGENT_ID`、`DSH_WORKSPACE_DIR`，并把workspace/home/cache/temp指向mkdtemp。带env优先级的测试在finally恢复原env。
5. 建立每用例fs读写审计：允许路径仅临时root，越界立即失败。禁止测试依据开发者实际环境fallback到OpenClaw。

**文件：**

- `packages/agent-memory/test/plugin-workspace.test.js`
- `packages/agent-memory/test/primary-workspace.test.js`
- `packages/agent-memory/test/helpers/isolated-workspace.js`（新）

**验收：** 故意设置DSH_PRIMARY_WORKSPACE为不可触碰sentinel时，测试fixture仍只写owned目录；旧memory测试在正式基线上保持通过。未对齐基线就不开始后续语义编辑。

未来针对本模块执行：

```sh
env -u DSH_PRIMARY_WORKSPACE -u DSH_AGENT_ID -u DSH_WORKSPACE_DIR node --test packages/agent-memory/test/*.test.js
```

这不是本轮已运行的命令。全仓测试只在集成实际影响需要时运行，不重复B7生产门。

## 3. T1 — lossless解析和 memory.inspect

**新增/修改：** `src/memory.js`, `src/inspect.js`, `src/index.js`, `test/inspect.test.js`, `test/document.test.js`, `scripts/agent-memory-v2-inspect.mjs`。

提出的纯接口（新函数，不冒充当前已存在）：

```js
parseMemoryDocument(bytes, { limits })
// => { format, entries, spans, preservedSpans, coverage, issues, sha256 }

planDocumentEdits(document, operations)
// => { beforeSha, afterBytes, afterSha, preservedSpanProof, changes }

inspectMemory({ binding, observedRuntime, limits })
// => AGENT_MEMORY_INSPECT_V1; no mkdir, no mount, no writes
```

1. 先用synthetic文件覆盖：纯结构化、带前言/维护说明、无entry自由文本、伪metadata、损坏转义、超大field、UTF-8、尾部无LF。输出每个字节的解析/保留归属。
2. 沿原parser语法保留entry身份；不能因为标题看起来相同就消去区块。edit planner只替换目标entry span，其余字节exact unchanged。
3. inspector注入fs适配器用于owned测试；读取前检查大小、流式/有界读取并复核identity。修正同步注入路径的“先读完再限流”只限本scope真实guard差量。
4. 从原service接入 `memory_inspect`；管理CLI直接调用纯inspector，不调用plugin apply（其mount会mkdir）。
5. 在已有prompt renderer执行时记录有界receipt：resolvedworkspace/core digest/选中ID摘要/charCount/result。inspect读取receipt，不主动触发新prompt。
6. 将installed/configured/loaded/observed字段独立；无需读取受保护primary map填完它们。运行进程本来持有的resolver信息可以如实报告，未知不猜。

**验收：** I1–I3；测试前后文件内容、mtime和目录清单零变化。注入receipt测试用fakeCtx，不发真实模型请求。仅配置bundle不能测试为loaded；saved request tool list不能测试为injection success。

**交付：** 纯API、工具schema、CLI帮助、状态示例、source/test回执。部署未做时标SOURCE_ONLY。

## 4. T2 — 有界历史搜索，不先建索引平台

**文件：** 新`src/history.js`、`test/history.test.js`，原`paths.js/index.js`有限注册/派生。

```js
validateHistoryManifest(manifest, trustedBinding)
enumerateHistorySources({ binding, manifest, dateRange, limits })
searchHistory({ query, binding, manifest, sources, dateRange, cursor, limits })
// => AGENT_MEMORY_HISTORY_SEARCH_V1
```

1. manifest只允许core、直接YYYY-MM-DD.md和显式archive。拒绝path参数、symlink escape、另一workspace、测试copy、JSON/JSONL、隐藏ledger。
2. 复用substring匹配，分块解码UTF-8，维护byte/line offset；结构化entry和freeform段都能引用原文。不要为历史搜索先把原文改成统一格式。
3. 每条命中带完整源digest、size、offset；读不完/漂移不生成可消费的伪验证命中。响应报coverage与未查范围。
4. 固定稳定排序、cursor绑定完整query/scope/source版本。改变文件后旧cursor返回STALE；不要混合不同轮快照。未验证大源不保留半hash续页：返回SOURCE_VERIFICATION_BUDGET；只有显式extended选项可以使用已冻结较大预算，不能自动循环。进程缓存丢失重新验证，测试20MiB源在default/extended下的不同结果。
5. 仅可丢弃内存缓存，读工具零持久写。删除缓存不丢记忆；无indexbuild/embedding后台任务。
6. 保持原memory_search范围不变；模型只有显式调用memory_history_search才访问归档/daily，归档不整段自动注入。

**测试集：** 至少有archive-only旧事实、core纠正覆盖、daily时间窗、无匹配、同内容不同source、恶意路径、中文跨chunk、半读超时、文件变化、删除/tombstone、超限分页。默认budget下不完整必须PARTIAL；不是“没找到所以没有”。

**性能测量：** owned synthetic生成2.1MB archive与7日日记规模，记录冷热查询P50/P95、bytesRead、峰值内存和partial率，不拿文件名伪造真实用户历史。若预算不够，先明确成本和分页行为，不能加无限扫描。

**交付：** H1–H3通过的source-only结果。正式安装后可先启用只读能力，不强制等待幂等写入上线。

## 5. T3 — 证据身份、去重与候选归并

**文件：** 新`src/evidence.js`、`test/evidence.test.js`；`memory.js`纯归并策略与`index.js`distill wrapper。

```js
deriveEventIdentity({ workspaceKey, headerIdentity, event })
selectEvidenceBatch({ events, committedCursor, limits })
validateCandidates({ candidates, evidenceIds, currentDocument })
planPromotion({ document, candidates, budget })
// operations: CREATE | UPDATE | NOOP | CONFLICT_PENDING | DEFERRED_BUDGET
```

1. 测试同名main的新generation、相同seq不同payload、重复event、跨batch重叠、40条边界。持久header来源不明则不造假key。单event超过64KiB时测试durable EXCLUDED_OVERSIZE（原来源可恢复）与BLOCKED_OVERSIZE（不可绑定原来源），不截断/假saved/无限重试。
2. 过滤injected memory、memory工具回显、系统催动与归并自身；assistant复述不能单独成为新的用户事实。保留每个可晋升statement的evidence引用。
3. 改prompt为0..3，不要求每轮产出；empty是成功NO_NEW_FACT；模型异常/无效JSON是DISTILL_FAILED。
4. 精确内容重复NOOP不刷新timestamp；同title不同事实冲突保留，不做LLM/embedding自动破坏式merge。stablefactKey需要来源，不拿模型随手写的key直接授权覆盖。
5. core预算测试：64KiB/128entry边界拒绝自动promotion，保留候选但不删原文；候选存储也有上限，满则backpressure。

**验收：** W4/W5的纯函数部分。使用确定性distill stub统计调用次数，无新证据时0次。此任务本身不接生产写入口。

## 6. T4 — 单writer事务与恢复

**文件：** 新`src/store.js`, `test/store.test.js`, `test/store-crash.test.js`；复用原fsync/metadata保持工具。

```js
openWorkspaceStore({ binding, limits, io })
store.prepare({ eventBatch, beforeRevision, promotionPlan })
store.commit(preparedId)
store.receipt(eventIds)
store.recoverPending()
store.pauseForEdit() / store.resumeAfterEdit(expectedRevision)
```

1. 冻结manifest/checkpoint/transaction schema与版本；记录source输入、pre/post hash、stage和receipt。不建第二个可写facts表。
2. 同workspace队列覆盖所有write，跨进程排他owner协议。锁存在但身份不明返回BUSY/READ_ONLY；不得按mtime自动清锁。
3. PREPARED持久后才更新episode；episode block使用唯一ID和digest，有界原子日文件替换保留原非机器字节。候选core原子发布后再推进cursor，ACK最后。
4. 保存完整pre/post和固定候选，恢复时不要再跑模型改计划。已发布但checkpoint落后只补receipt；基线变化CONFLICT，禁止覆盖。
5. 所有真实write失败均报告明确stage与retained路径（管理面），模型只拿receiptId/reason，不暴露payload。
6. 明确人工维护协议：pause→编辑→校验revision→resume。测试直接外部编辑的冲突探测，但不声称POSIX hash+rename能原子阻止不合作writer。
7. 单事务临时空间量测含current daily/core、保全preimage、candidate、journal同时占用；不足不写，不能靠未来删除释放额度。

**故障矩阵：** 在PREPARED fsync、episode temp/fsync/rename、core temp/fsync/rename、checkpoint前后、ACK前后逐点kill owned child；重启后验证hash与条目次数。并行启动两个owned进程同workspace，一个只能BUSY；多个session共享原writer必须串行。绝不在真实HR进程上kill/restart。

**验收：** W1–W3/W5、M1事务部分。测试名atomic必须真覆盖故障，不沿用旧串行读写测试代替。

## 7. T5 — 接入旧API，消除旁路

**文件：** `src/index.js`, `test/plugin-workspace.test.js`, 新`test/consolidation-integration.test.js`。

1. save/update/delete/consolidate全部经store；旧service调用无trusted envelope的自动归并退候选，不编造session来源。
2. auto与explicit同一调度器。watermark从内存Map迁至committed cursor；timer不前推；inflight新event放pending，提交后有界drain。
3. 旧工具成功字段仅在真正commit后出现；NOOP/CONFLICT/READ_ONLY/DEFERRED是新typed状态，不能返回saved来兼容表象。
4. sourcecodec、默认注入预算、session-aware resolver、import优先级等旧行为做inverse测试；不更改Router/Agent identity。
5. 增加inspect可见指标：eventsSeen/committed/noop/conflict、明确excluded与blocked、silentDropped=0、core bytes/entries、daily bytes、LLM calls、historycoverage、pendingage。指标不包含记忆正文。

**验收：** 重复100次同事件，core与daily各只有一次结果；重启后重复同事件不再调用LLM/写文件。周期性无变化任务产生0新core；新明确用户纠正生成可追踪revision，不能被旧摘要覆盖。

## 8. T6 — 迁移dry-run与回滚

**文件：** `scripts/agent-memory-v2-migration.mjs`、`test/migration.test.js`、后续`docs/reports/agent-memory-v2/`。

1. 默认命令仅plan；固定输入清单、原hash、parse coverage、pending writer状态、输出owned候选目录；没有隐式apply。
2. 用完整owned副本做dry-run。当前core和归档分别登记；归档read-onlysearch，不全量归并。runtime testcopy永不加入。
3. 校验所有原字节在current/归档/preserved spans/receipt中有明确归属，不只比较entry数。人工维护说明必须保留。
4. 做两种rollback演练：未新写可恢复原状态；已新写必须保留delta，回滚代码后仍只读直到兼容处理。直接mv大归档盖新MEMORY必须被拒绝。
5. 退出migration前所有task outputs有manifest、bytes/hash、版本；原件不改；拟真实迁移另走已接受scope内的正常发布执行。

未来命令形式（实现后才存在）：

```text
agent-memory-v2-migration plan --manifest <受审owned输入清单> --out <owned候选目录>
agent-memory-v2-migration verify-plan --plan <固定计划>
```

真实activation不伪装plan命令；它要实际已静止单writer、当前preimage匹配、正确installed/loaded版本与rollback可用。本轮不创建真实迁移journal或改workspace配置。

## 9. 后续原发布生命周期与业务验收

1. Spec/文档按现有review落main；每个实现提交带SPEC_COMPLIANCE和本scope测试，不反复打开不变身份/权限议题。
2. 完成source-only后经原安装流程发布。先不开自动写，只启inspect/history，验证HR实际resolver、loaded版本和history source whitelist。
3. 在授权canary窗口用专用测试workspace完成真实读写；绝不向HR写假偏好来“验证记忆”。
4. 单writer受控切换后观察真实正常流量：重复event无重复条目；NO_NEW_FACT不增长；用户明确新事实能保存；history能找到指定归档内容并引用精确来源。观察不得靠额外无目的Agent发送制造业务事件。
5. 记录24小时等实际覆盖窗口与样本量，不能把短期0error当长期保证。出现冲突/异常增长时暂停自动promotion并保留可用只读检索，按已准备rollback处理。

**完成分层：** DOCS_PROPOSED → SPEC_ACCEPTED → SOURCE_TEST_PASS → INSTALLED → LOADED → MIGRATION_VERIFIED → BEHAVIOR_VERIFIED。不能把某一层改名为全部完成。

## 10. 原任务的具体完成标准

本次文档交付应有：

- 真实HR路径/配置/保存请求/文件统计与未证明项；
- 一份有限Spec，含inspect schema、history corpus/API、幂等状态机、limits；
- 文件级实施顺序与可执行验收；
- migration/rollback及无生产动作声明；
- 没有覆盖MEMORY、没有在生产运行测试、没有提交或改动原repo无关文件。

当以上文档就绪后，本次请求即交付；后续实现需要该proposed Spec走原接受流程，而不是本轮擅自编写产品代码。
