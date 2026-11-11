# D-STORE-QA-547 — v5 当前副本隔离 QA 终版

本次完成白名单一致采集与固定 reader 的真实 scratch 加载；141 项断言通过。当前文件实际有 **5 条目标异常（4 legacy + 1 普通 blocker）**，全部可识别且继续阻断。4 条有 caller correlation 的旧记录通过同一 no-replay 入口；dev-engineer 缺 correlation，保留覆盖缺项。**这是当前副本的本地机制 QA；生产切换未执行、不在本任务授权内，业务恢复 UNKNOWN，SAFE_TO_PUBLISH=NO。**

## 坐标、授权与复用

- Repository `mayf3/dsh-agent-core`；worktree `/Users/yanfenma/workspace/project/worktrees/h547-store-diag`；branch `diag/547-durable-store`；执行 parent `f6b988232ce218e7b85ea1853d4d0f8b47a4032a`；前序 [PR #670](https://github.com/mayf3/dsh-agent-core/pull/670) 已被外部在旧 Head 合并；本轮由后续 draft [PR #672](https://github.com/mayf3/dsh-agent-core/pull/672) 承接，base main，不合并。
- 用户本次 v5 指令及 [BRIEF v5](BRIEF-547-STORE-DIAG.md) 预授权按续办配方执行。`PREFLIGHT / REUSE / BRIEF / DURABLE / OPERATION`；仅本地证据/报告及 git 交付；生产写入、restart、signal、旧 UNKNOWN 业务重放为 0。
- Primary authority 沿用 accepted PLH V4 C-018/C-019/BOUNDED、HR trusted recovery V2 RQ-003/RQ-006；不改 Product Contract 或产品源码。固定 reader base `95a8e1cb512fc99dc018209d837250dd51b4d08f`，已包含 D 三件套 `42487e65`。fresh remote main `206e19c17c268c7513e5a4d8b2135ac496cf7daf` 已 fetch；固定 base..该 main 的相关 Architecture、Decisions、两份 Specs、local grammar 和 reconciliation 路径无差异。既有候选/作者/PR 查重复用 v3 有界观察，未发布工作和该观察之后的新候选 UNKNOWN；没有重复实现 D。
- [一次路径自检](docs/evidence/h547-store-diag/path-selfcheck-v5.json)：35 个本地路径逐一 `test -e`，18 个旧源码快照逐一 hash 匹配；authsvc 只读 `test -e` active 与三可选 sidecar。r28 history 不存在属于可选缺席；用户自引用名修正为本文件实名，未作为失败。
- v1/v2 原件、源码和 v1–v4 停止记录全部保留。`capture-v3.py` 文件名是脚本版本，**本次首次执行属于 v5 授权**；旧 capture.py/capture-v2.py 未重跑。

## 新鲜白名单与一致性

采集窗口 `2026-11-08T07:45:10.188505+00:00..2026-11-08T07:45:10.599670+00:00`。36 条 authsvc 命令全 rc=0，仅 ls/stat/cat；加上自检 4 次只读 test，共 40 次 authsvc 只读调用。每文件每遍两读三 stat，两个 pass 的成员、hash、stat 向量全相等。它是两遍稳定观察，不是 atomic snapshot 或 loaded-byte 证明。

| 生产路径（目录 `/Users/authsvc/.agent-core/control/`） | 字节 | SHA-256 |
|---|---:|---|
| `turn-recovery-v3.json` | 8513146 | `ce231b88d6a5cca631ad074523aa493e328846cdc66587075733d35d22a0a243` |
| `turn-recovery-v3.json.abandonment-declarations.json` | 3137 | `28ba4a74693d23ad0fc3338d77d2f5c72a35c1ae43970dfb2b4f854d6c727cc1` |
| `turn-recovery-v3.json.faults.json` | 633 | `7d3406c02b601c34f3a033e3f003b2e62b5adfe701ed2ee5e6e4affe1b5a4591` |

副本在 `docs/evidence/h547-store-diag/private/v3/pass-{1,2}/`（0700 目录/0600 文件，Git ignored，禁止 force-add）；r28 history 与 active `.tmp-*` 当次未出现；白名单外内容未采。根路径来自旧 deployed `paths.js:107`，faults 由 `store.js:65`，registry 实际由 `durable-file.js:72-73`，history 由 `index.js:196-197` 拼装。不是猜测同名 JS 模块。

[原始 capture stdout](docs/evidence/h547-store-diag/capture-v5.stdout.txt)、[完整采集收据](docs/evidence/h547-store-diag/capture-v3-receipt.json)、[本地 allowlist 检查原文](docs/evidence/h547-store-diag/capture-preflight-v5.stdout.txt)。结束后六个采集原件再次 hash 全匹配，见 [postrun](docs/evidence/h547-store-diag/postrun-v5.json)。

## 实际 reader、构造器与 epoch 行为

固定 base 完整 `git archive` 的 3236 文件及 SHA 见 [reader manifest](docs/evidence/h547-store-diag/reader-manifest-v5.json)，全部解压在 ignored `private/v5/reader/`，末次全量 hash 无变化。旧 deployed 源码快照已复用，[只读原谓词输出](docs/evidence/h547-store-diag/predicates-v5.stdout.txt) 显示当前 5322 records、256 epochs、16 registry entries 解码全部通过：本次没有从当前文件复现过去的 `durable_store_invalid`，不据此断言生产已恢复。

真实 `TurnReconciliationStore` 仅指向独立可写 `private/v5/scratch-3/turn-recovery-v3.json`。构造器/registry 的正常 startup recovery 会持久化，因此从未指向采集原件。macOS [sandbox profile](docs/evidence/h547-store-diag/sandbox-v5.sb) 拒绝全部文件写，仅允许该 scratch；拒绝 network 与 process-fork。[沙箱原文](docs/evidence/h547-store-diag/sandbox-probe-v5.stdout.txt) 证明 scratch 内 file/directory fsync 成功、无害本地越界写被 EPERM 拒绝，没有向生产路径试写。

实际 constructor `businessAdmissionStatus={"ready":true,"reason":null}`，records=5322。全新默认 UUID `af638042-3d67-4e17-9322-7503595d571c`，没有传旧 epoch、手工预处理/删改 epoch 或改变上限。输入 256 epochs，79 个被当前记录引用；**未改 reader 的 `compactRuntimeEpochs()` 在 scratch 正常持久化时自然替换了一个无记录历史 epoch `c3896f43-0e73-48a0-980e-161376797a14`，输出仍 256**。全部记录引用 epoch 保留。这是实际 native scratch 行为，不能写成“epoch 完全不变”；生产和采集原件均未变。

scratch constructor 后 active SHA `14cd62ca7e23fcdadf714237740110001a2ab86e1254782a2d20353638db4b43`，process registry 挂载完成后最终 SHA `84ace0832c55f1f3563d902b925649b4fb011b8dd3dec489d7e4449ed1e5872d`。与原件相比仅 7 条记录的 bytes/updatedAt/attemptedActions 有 native 差异，顶层 runtimeEpoch/runtimeEpochs 更新；五个目标的 UNKNOWN、outcome/lateOutcome、terminationEvidence、settlementResult、exitObservedAt、fenceState 均逐字段保持。registry/fault sidecar SHA 不变。详见 postrun，不把 startup 审计写误称第二次业务效果。

## 逐 handle 四事实实填

以下直接从本次 raw 内容与实际方法返回派生，没有使用旧索引/预定数量。所有目标 raw 均 `initialOutcome=outcome_unknown, queryState=pending, state=blocked`，`exitObservedAt/terminationEvidence/settlementResult=null`，`failureReason=runtime_restart_ownership_unavailable`。四条 legacy 的 `fenceState=cleared`，普通 stock 的 `fenceState=active`。当前文件实际枚举五条，较旧文四个待核槽位多一条；旧槽位未认证身份或数量，不据此推断生产数量随时间变化，不丢弃任何当前目标。

| Agent / handle | 原始记录精确 SHA-256 | 0-based UTF-8 byte offset / length |
|---|---|---:|
| `agt_stock_agent`<br>`turn:a7e296e6-22cd-4205-a366-2e915fb7f22e:a32:g9:s16` | `48e55b5f28c33fc5ce9a72e0dd4c2b3e94a897111fdc3b12f55e4e7e12cb304f` | 6717676 / 5857 |
| `agt_needs-radar-agent`<br>`turn:74a5adf3-2701-435e-8927-7a56a9530d2f:a11:g23:s76` | `a8224055c3ced0b892961aa34bf56922300c6ba6e55bc12c99da9547c0a7341c` | 7002294 / 3613 |
| `agt_lobster-agent`<br>`turn:74a5adf3-2701-435e-8927-7a56a9530d2f:a54:g23:s43` | `0589b1c60ef720938fe61a3b3b468d1647794a12bb3f79024282ba6b20e6bee0` | 7005908 / 3605 |
| `agt_agent-dev-engineer`<br>`turn:74a5adf3-2701-435e-8927-7a56a9530d2f:a40:g84:s397` | `4575b826431f566b3278532bd592d7d719812fd294b97f1f263efae6f4338427` | 7010870 / 3760 |
| `agt_hr-agent`<br>`turn:60129522-4196-44bb-a644-52a255dde15d:a2:g70:s3581` | `3495585aefa3fa596c35844eb01df180fcbb7258629fec555590356da6364e78` | 7940273 / 1833 |

每行绑定同一 active 文件 SHA `ce231b88d6a5cca631ad074523aa493e328846cdc66587075733d35d22a0a243`。raw-record SHA 是原文件中该 JSON object 的精确字节，不是重新序列化后的 SHA。

| Agent | ①可识别/reader兼容 | ②持续阻断（实际首 blocker） | ③同一 no-replay 入口 | ④窄容忍 |
|---|---|---|---|---|
| `agt_stock_agent` | `recovering`，exact handle 保留；普通 blocked | `turn:a7e296e6-22cd-4205-a366-2e915fb7f22e:a32:g9:s16`；prompt gate/registry 均同值并拒绝 | 原 correlation 精确返回同 handle；duplicate mint 拒绝；零第二次效果 | predicate=false，N/A，不借用 legacy 例外 |
| `agt_needs-radar-agent` | `recovering`，exact handle 保留；legacyFormat=unproven_fence_clear | `turn:74a5adf3-2701-435e-8927-7a56a9530d2f:a11:g23:s76`；prompt gate/registry 均同值并拒绝 | 原 correlation 精确返回同 handle；duplicate mint 拒绝；零第二次效果 | raw/loaded predicate=true；7/7 malformed neighbors TypeError |
| `agt_lobster-agent` | `recovering`，exact handle 保留；legacyFormat=unproven_fence_clear | `turn:74a5adf3-2701-435e-8927-7a56a9530d2f:a54:g23:s43`；prompt gate/registry 均同值并拒绝 | 原 correlation 精确返回同 handle；duplicate mint 拒绝；零第二次效果 | raw/loaded predicate=true；7/7 malformed neighbors TypeError |
| `agt_agent-dev-engineer` | `recovering`，exact handle 保留；legacyFormat=unproven_fence_clear | `turn:74a5adf3-2701-435e-8927-7a56a9530d2f:a40:g84:s397`；prompt gate/registry 均同值并拒绝 | **correlation=null，覆盖缺项**；仅验证 admission quarantine，未捏造 correlation | raw/loaded predicate=true；7/7 malformed neighbors TypeError |
| `agt_hr-agent` | `recovering`，exact handle 保留；legacyFormat=unproven_fence_clear | `turn:60129522-4196-44bb-a644-52a255dde15d:a2:g70:s3581`；prompt gate/registry 均同值并拒绝 | 原 correlation 精确返回同 handle；duplicate mint 拒绝；零第二次效果 | raw/loaded predicate=true；7/7 malformed neighbors TypeError |

`admissionBlockerForAgent` 只返回同 Agent 首 blocker；上表逐次保留实际返回值，本次五条恰好都等于自身，未假定一般情况下逐条独立返回。`createRecoveryAdmission.assertUnfenced` 与 `processRegistry.ensureRunning` 均拒绝 `AGENT_PROCESS_TURN_FENCED`，最后 prompt gate 同样取该 blocker。

no-replay 复用既有 compat 矩阵的**同一源码入口** `resolveCallerCorrelation → mintTurnExecution`（重复 correlation 抛 `RECONCILIATION_CORRELATION_CONFLICT`）和 `registry.ensureRunning`；输入全部换成本次真实记录，未用旧矩阵/固定计数作 QA。每条记录/磁盘/记录数5322/索引数3982 的 no-replay 前后摘要相等；`processFactoryCalls=0, workspaceWrites=0, effects=0`。这证明隔离机制未产生第二次执行，不认证旧 worker/tools 已在生产终止。

四条 legacy 各测试 7 个相邻坏值：state=pending_unknown、queryState=settled、initialOutcome=null、exitObservedAt=1、terminationEvidence=child_real_exit、settlementResult=terminated_without_outcome、failureReason=null，全部 TypeError。每个负例只改独立 scratch negative 文件，不改原件或主 scratch。共28个负例证明当前 tuple 的豁免没有取消这些交叉字段校验。

## registry / marker / faults 实测关系

| Agent | marker 与 registry | faults 精确 generation key |
|---|---|---|
| `agt_stock_agent` | 无 marker，此 handle 不在 registry scope | `agt_stock_agent:9` 存在 |
| `agt_needs-radar-agent` | marker对应声明的 agent/time/handle匹配；共有3个历史 scope含此handle | `agt_needs-radar-agent:23` 存在 |
| `agt_lobster-agent` | marker对应声明的 agent/time/handle匹配；共有3个历史 scope含此handle | `agt_lobster-agent:23` 存在 |
| `agt_agent-dev-engineer` | marker对应声明的 agent/time/handle匹配；共有3个历史 scope含此handle | `agt_agent-dev-engineer:84` 存在 |
| `agt_hr-agent` | 无 marker，此 handle 不在 registry scope | `agt_hr-agent:70` 存在 |

registry 共16 declarations；三条有 marker 的 legacy 均匹配其 b 声明，但 registry 同时保留 c/final 历史声明，不声称全局一对一一致。独立 raw 复核还看到全局 CTO 的 marker 时间与同 ID registry 不等，以及一条旧 HR scope 已无当前记录；作为历史关系观察保留，没有擅自删除或裁定需改。

faults 共5个 generation keys，逐项 value SHA/字段名见 stdout；key 不是 handle，不应靠 handle 子串查找。**固定 main reader 的 store 不消费 faults sidecar**，本次独立只读解析并 hash；它不是终止证明、结算事实或 admission authority。registry 由真实 constructor 读取，标记不解除 legacy 的 fail-closed blocker。

## 原始输出、已解释 harness 失败与独立复核

最终执行 `2026-11-08T07:51:21.973444+00:00..2026-11-08T07:51:26.049449+00:00`，rc=0，141/141 assertions PASS；原始 stdout SHA `c5380e46323ecd4eff82fd60c8672a4d9a8debc551c0e63778a5bdec0f9879f5`。完整逐项 actual/expected 见 [原始 stdout JSON](docs/evidence/h547-store-diag/qa-v5.stdout.json)，[执行收据](docs/evidence/h547-store-diag/qa-run-v5-receipt.json) 绑定 exact argv、Node v26.7.0、runner SHA、sandbox SHA；stderr为空。

两次本地 harness 问题均原样保留，未伪装 PASS：attempt1 在复制前被尚不存在的 scratch 路径权限拦住，未 constructor；attempt2 已 constructor，但 Node permission model 禁用 fsync，返回 durable_store_unavailable（不是当前 store 校验失败）。独立无害 probe 得到精确错误 `fsync API is disabled when Permission Model is enabled.`；最终改用允许 scratch fsync 的 OS sandbox，**没有修改 reader 或数据来消除失败**。按 v5 可解释本地 harness 错误记录后继续；未发生必需输入缺失、无法解释的非预期谓词、生产写入被拒或一致性失败。

见 [harness 解释收据](docs/evidence/h547-store-diag/harness-correction-v5.json)、attempt1/attempt2 的 `.mjs`/stdout/receipt。两次 rc=1 保留；原始内部状态字符串 STOPPED 仅表示该次 invocation 退出，不覆盖本次后续有依据的 v5 续办。未重新采生产或重放业务。

独立采集及最终受影响面复核见 [independent-review-v5.md](docs/evidence/h547-store-diag/independent-review-v5.md)：PASS，独立执行证据复核通过，执行交付 Head `75f1e80e41bcd7600ca38d11795d702d8a113181` 的独立 delta recheck PASS；后续仅措辞/复核记录 delta 单独复核；不将代码作者的自检当作独立 QA。

## D 安全发布条件终版

| 条件 | 已满足项 | 缺项 / 结论 |
|---|---|---|
| 当前副本独立 QA | 白名单范围/一致性独立核验通过；真实 constructor、5条事实、4份correlation no-replay、28窄容忍负例已执行 | dev-engineer correlation覆盖缺项；独立受影响面复核 PASS；不是生产QA全覆盖 |
| 精确制品 pin | source commit、完整本地archive SHA/3236文件manifest、Node版本及实际runner/sandbox哈希已固定 | 生产可安装包及依赖/Node制品digest、目标loaded bytes/启动绑定未认证；NOT_SATISFIED |
| 在途排空 | 本次未发生产业务请求、未重放旧UNKNOWN；本地effect/spawn计数0 | 生产旧worker/已发tools在实际写边界的终止/隔离、唯一写者排空和切换窗口授权均缺；UNKNOWN |
| 回滚方案 | 原始store/sidecar和v1–v4历史证据保留；本次sidecar解析/哈希已核 | 精确rollback制品、生产sidecar兼容性、回滚后可用性与不重放尚未核实；NOT_READY |
| 生产操作授权 | v5只读诊断和隔离分析授权有效 | 切生产/restart/写账本/清fence均不在本任务；OUT_OF_SCOPE |

`CAPTURE_SCOPE=PASS; CAPTURE_CONSISTENCY=PASS; FULL_STORE_LOAD=PASS; CURRENT_TARGETS=5; CONTINUED_BLOCKING=5/5; CORRELATION_NO_REPLAY=4/4_AVAILABLE; MISSING_CORRELATION=1; NARROW_TOLERANCE=4_LEGACY/28_NEGATIVES_PASS; SAFE_TO_PUBLISH=NO; PRODUCTION_CUTOVER=NOT_EXECUTED; BUSINESS_RECOVERED=UNKNOWN; MERGE_READY=NO`。

交付时 fresh readback 核实前序 PR #670 于 07:58:05Z 合并的是旧 Head f6b98823，merge f8b7a0e4 的树仍是 v4 STOPPED，未包含 v5；merge subject 不作 v5 集成证明。本操作者未调用 merge，外部 actor UNKNOWN；因此用同分支后续 draft PR #672 承接，零并行开发。独立 base-impact recheck PASS，相关 authority/reader 源码不变，不重跑 QA。详见 [交付变化收据](docs/evidence/h547-store-diag/delivery-transition-v5.json)。

本次文档/输出交付已通过本地/独立复核；发布缺项属于下一次有界维护操作的必要条件，不授权在本任务切换、修复或扩大诊断。v1–v4 原报告如下，保留其当时的 STOPPED 和 UNKNOWN，不作为当前状态。

---

## v4/v3 历史报告（原文保留）

# D-STORE-QA-547 — v4 STOPPED，当前快照 QA 未完成

v4 在 root 本地预检查询阶段停止，**白名单新鲜采集与 scratch 真实 store 验证均未执行，D QA 未完成**。这是本地路径查询错误，不是生产 store 校验结果。生产切换未执行、不在本任务授权内。

## v4 执行坐标、授权与实际停点

- Worktree `/Users/yanfenma/workspace/project/worktrees/h547-store-diag`，branch `diag/547-durable-store`，执行 parent `71fce950e249ef8e36a9d255e4cfdc97fdc70532`；沿用 [PR #670](https://github.com/mayf3/dsh-agent-core/pull/670)，base main，不合并。
- 用户本轮指令及 BRIEF v4 授权采集、固定 main reader `95a8e1cb512fc99dc018209d837250dd51b4d08f`（含 `42487e65`）、可写 scratch 验证和报告交付；不授权生产修改或恢复。当前 remote-main tip 未 fresh-read，该 SHA 仍只是授权固定的 integration snapshot。
- `schema_version=2; SPEC_GOVERNANCE_MODE=PREFLIGHT; AUTHORITY_ACTION=REUSE; PLAN_LEVEL=BRIEF; ASSURANCE_LEVEL=DURABLE; ROUTE_STAGE=OPERATION`。本轮停止于预检，未完成 accepted authorities 重读或白名单规则验证，没有作新的 authority/reader 合规通过声明。
- root 用 `rg --files docs/architecture docs/decisions docs/specs` 查询了不存在的 `docs/architecture`。错误逐字原文及完整命令保存在 [stop-v4-receipt.json](docs/evidence/h547-store-diag/stop-v4-receipt.json) 和 [STOPPED v4](STOPPED-547-STORE-DIAG.md)。实际 Architecture 入口由 local README 声明为 `docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md`；本轮没有修正后重试。
- 当时只转发了 output，未保留外层或内部命令退出码，均 `UNKNOWN_NOT_RETAINED`；不伪造 rc，不为补收据重跑。错误时刻 UNKNOWN，停止收据时钟 `2026-11-08 07:28:00 UTC` 不是错误时刻。
- 观察 stderr 后停止依赖工作，打断白名单独立复核 helper；helper 已完成的四次本地只读 exec_command 均 rc=0，无生产调用或写入，未完成复核结论。此后只整理/复核停止材料并更新 PR。
- 本轮操作者生产读取=0、authsvc 调用=0、生产写入=0、restart/signal=0、旧 UNKNOWN 重放请求=0。不推断活跃 runtime 自身的动作或历史业务结果。

## v4 四条事实与验证状态

尚未从当前文件识别任何一条目标记录；下表仅保留四个待核槽位，不认证数量、身份或异常组合。

| 目标 | handle / 当前文件 SHA / raw-record SHA | registry/fault/marker 一致性 | 可识别 / 持续阻断（实际返回 handle） | 同一 no-replay 入口 / 窄容忍 |
|---|---|---|---|---|
| 待核 1 | UNKNOWN / UNKNOWN / UNKNOWN | NOT_VERIFIED | NOT_RUN / NOT_RUN | NOT_RUN / NOT_RUN |
| 待核 2 | UNKNOWN / UNKNOWN / UNKNOWN | NOT_VERIFIED | NOT_RUN / NOT_RUN | NOT_RUN / NOT_RUN |
| 待核 3 | UNKNOWN / UNKNOWN / UNKNOWN | NOT_VERIFIED | NOT_RUN / NOT_RUN | NOT_RUN / NOT_RUN |
| 待核 4 | UNKNOWN / UNKNOWN / UNKNOWN | NOT_VERIFIED | NOT_RUN / NOT_RUN | NOT_RUN / NOT_RUN |

唯一执行错误输出原文（不是 validator/test stdout）：

```text
rg: docs/architecture: No such file or directory (os error 2)
```

没有 v4 capture receipt、constructor/test stdout 或验证 rc 可交付。`capture-v3.py` 连 `--check` 也未运行；没有实例化 store，没有向采集原件或 scratch 写入，没有重用 runtimeEpoch 或裁 epoch。v1/v2/v3 原件保持不变，旧矩阵不充当当前 QA。

## v4 D 安全发布条件终态（本轮停止）

| 条件 | 现有事实 | 缺项 / 本轮结论 |
|---|---|---|
| 独立当前快照 QA | 独立 helper 只读过文档和脚本，随后停止 | 白名单核对、新鲜一致副本、四条精确事实、真实 store 加载、持续阻断、no-replay、窄容忍及独立复核均缺失；NOT_SATISFIED |
| 精确制品 pin | 沿用 v3 source commit/三文件 SHA 的历史观察；本轮未刷新 | 完整安装包/Node/依赖 manifest、可信 pack digest、loaded bytes/启动绑定缺失；NOT_SATISFIED |
| 在途排空 | 本轮没有发生产请求或重放 | 旧 worker/tools 在实际效果边界的终止/隔离、写者排空及切换窗口授权无证据；UNKNOWN |
| 回滚方案 | 历史 evidence 保留 | 精确 rollback 制品、store/sidecar 兼容性、回滚后可用性与不重放未核实；NOT_READY |
| 生产操作授权 | v4 仅授权只读诊断及本地副本分析 | 生产切换权限不存在；OUT_OF_SCOPE |

`D_QA_COMPLETE=NO; SAFE_TO_PUBLISH=NO; BUSINESS_RECOVERED=UNKNOWN; DONE_WHEN=NOT_MET; OPERATION_ALLOWED=NO; NEXT_ACTION=STOP; MERGE_READY=NO`。停止记录的包装检查仅支持报告交付，不代表 D QA 通过。本轮不继续下方历史续办配方。

## v3 历史报告（以下原文保留）

本次已消费 BRIEF v3 / Owner Watch3 五点并复核 v1/v2 STOPPED。**没有完成当前快照采集或隔离验证，不是 D QA PASS，不具备生产发布结论。生产切换未执行、不在本任务授权内。**

## 执行坐标与停点

- Repository `mayf3/dsh-agent-core`；worktree `/Users/yanfenma/workspace/project/worktrees/h547-store-diag`；branch `diag/547-durable-store`；执行 parent `c8036802f1543b108eddce3f8fce474bdc2d4d99`。
- integration snapshot `origin/main=95a8e1cb512fc99dc018209d837250dd51b4d08f`；本轮没有 fresh remote-main tip readback，不能将其称为实时 remote tip。本地旧 `main=5c7b62055e40e3ad0c7ec80a2896a51fd0e33814` 未用于 D reader。
- 授权为本次用户 v3 指令与 [BRIEF](BRIEF-547-STORE-DIAG.md)；`PREFLIGHT / REUSE / BRIEF / DURABLE / OPERATION`。不变更 Product Contract，不实现第二份 D，不执行 A 二次手术或 C transport 诊断。
- v3 本地源码核查子任务引用不存在的 `reconciliation/dispatch-faults.js`，`rg` 返回 rc=2。按失败再停，root 停止新鲜采集与离线验证；详见 [停止原文](STOPPED-547-STORE-DIAG.md) v3 及 [错误收据](docs/evidence/h547-store-diag/stop-v3-receipt.json)。这是查询错误，**不是生产 store 失败谓词**。
- 错误精确发生时刻 UNKNOWN；root 固定停点时钟为 `2026-11-08 07:13:49 UTC`，不能回填成错误时间。同一 helper exec 在错误后还完成三条已安排的本地 Spec 读取，均 rc=0；不声称逐命令即时停止。
- v3 生产读取命令=0、生产写入=0、authsvc 调用=0、restart/signal=0、旧 UNKNOWN 重放请求=0。这里的 0 是本次操作边界，不是历史副作用的判定。

## Watch3 五点落实状态

| 要求 | 本轮事实 | 状态 |
|---|---|---|
| 精确白名单与复用 | 按 paths.js + store.js + durable-file.js + index.js 组合规则形成新脚本草稿；旧 v1/v2 原件和 receipt 不改、不重跑、不重采目录 | 已读取规则；草稿未验证/未执行 |
| 当前新鲜一致副本与四条事实 | 尚未发起 v3 采集，也未解析保护副本核实四条异常 | NOT_RUN |
| D 查重 | 已定位 main 中的既有三件套、作者和 PR；公开 open PR 未见重叠实现 | 已完成限定范围查重 |
| 完整离线加载、持续阻断、no-replay、窄容忍 | 未执行任何 constructor、validator 或测试 | NOT_RUN |
| 安全发布条件与交付 | 本报告明确缺项；既有 PR #670 仅交停止证据 | 未达到 QA 完成条件 |

精确消费集合是 `control/turn-recovery-v3.json`，及存在时的 `.faults.json`、`.abandonment-declarations.json`、`.r28-history.jsonl`、`turn-recovery-v3.json.tmp-*`；不接纳 `.lock`、泛 `history`、`.bak*` 或 `pre-fleet-unblock`。这里声明的是授权范围，不是已经观察到的 v3 membership。

保留的 v1 单读 active SHA `85c4b0ce0957c03d6074edd7624ae33e8c2678feb9796087d27c5b7f7cd4b508` 不具一致性证明；v2 active SHA `682f7d8af8c537a341346b880f99ce75135f21ce71e48992a97936f9771a5a2b` 是 07:00:23..24Z 的历史稳定观察，且 v2 范围 FAIL。它们均不替代当前快照。

## 四条文件事实核实矩阵

以下序号仅是用户要求的四个待核槽位，不声称已从当前文件发现四个对象。不会用历史投影或旧矩阵的固定 indices 补充身份。

| 目标 | 精确 handle | 当前文件 SHA / raw-record SHA | sidecar/marker 一致性 | reader 兼容性 | `admissionBlockerForAgent` 实际返回 |
|---|---|---|---|---|---|
| 待核 1 | UNKNOWN | UNKNOWN / UNKNOWN | NOT_VERIFIED | NOT_RUN | NOT_RUN |
| 待核 2 | UNKNOWN | UNKNOWN / UNKNOWN | NOT_VERIFIED | NOT_RUN | NOT_RUN |
| 待核 3 | UNKNOWN | UNKNOWN / UNKNOWN | NOT_VERIFIED | NOT_RUN | NOT_RUN |
| 待核 4 | UNKNOWN | UNKNOWN / UNKNOWN | NOT_VERIFIED | NOT_RUN | NOT_RUN |

四条内容摘要、字节坐标、原始 tuple、caller correlation 与 UNKNOWN 保留证明均未取得。该表不认证异常数量、三条 legacy 加一条普通 blocked 的组合，或任何个体仍被阻断。

## D 最小候选与重复开发核查

实现 `42487e65b36f049811b0e83f90178510a3da28b7`，作者 `mayf3`；已由 [PR #646](https://github.com/mayf3/dsh-agent-core/pull/646) 合入，merge `bc69bff131c50af7357d39045b6d3084e5fd6fca`，时间 `2026-11-07T04:53:03Z`。PR final head `131cadcd3baf0e745c5d636b86c21eef5dc2e50b`。本次 helper 对 `42487e65`、`95a8e1cb`、执行 parent 比较，三件套内容相同；`42487e65..origin/main` 的三个路径无后续 commit。

路径均以 `packages/agent-router/src/reconciliation/` 为前缀：

| 文件 | 源码观察 | SHA-256 |
|---|---|---|
| `state-machine.js` | :27 窄识别；:169 clear 前检查 settlement/termination，未证实抛 `RECONCILIATION_FENCE_CLEAR_UNPROVEN` | `516abc6eb5176d606b2673ad8b5d50564b7f9fc344261b370809a6d84e16fb3f` |
| `durable-file.js` | :211-221 仅豁免 exact legacy tuple 的部分交叉字段限制，其余 schema/cap 校验保留 | `db854ee6061c7f8a56d48f686905d667353c9930bfcd64c95464752075542a1c` |
| `admin-abandonment.js` | :105-115 cleared UNKNOWN 属 legacy tuple 时仍返回 blocker | `62237fb500694f95d894f0f75516ee97fee05cd961971156783120bcbe059710` |

窄 tuple 是 cleared + outcome_unknown + pending query + blocked recovery + exitObservedAt/terminationEvidence/settlementResult 全 null。**不是四条当前记录已匹配的证据。** commit/PR 还含其他改动，不能把完整 commit 说成只有三个文件；三文件摘要也不是可安装制品 pin。

查重时间 `2026-11-08T07:12:08..07:12:31Z`：全部公开 open PR 69 个；超过 100 文件的 #486/#530/#591/#600 已补全分页。未发现触及 reconciliation 源码、`recovery-compat.test.js`、`scripts/availability-recovery/compat*` 的 open PR。未发布工作 UNKNOWN。详见 [candidate-audit-v3.md](docs/evidence/h547-store-diag/candidate-audit-v3.md)。

## 隔离验证输出原文与限制

```text
V3_FRESH_CAPTURE = NOT_RUN
FULL_STORE_CONSTRUCTOR_LOAD = NOT_RUN
FOUR_EXACT_RECORDS_IDENTIFIED = NOT_VERIFIED
CONTINUED_ADMISSION_BLOCKING = NOT_RUN
OLD_UNKNOWN_NO_REPLAY = NOT_RUN
NARROW_LEGACY_TOLERANCE = NOT_RUN
INDEPENDENT_CURRENT_SNAPSHOT_QA = NOT_RUN
PRODUCTION_CUTOVER = NOT_EXECUTED / OUT_OF_SCOPE
```

上面是执行状态声明，没有伪装为程序输出。唯一失败工具输出的逐字原文保留在停止收据。没有测试 stdout、rc 或 validator 成功输出可附。

续办须另有恢复调查指令后才可执行：先审核未执行的 `capture-v3.py`，验证精确 allowlist 反例，复用旧源码 hash，采当前白名单一致副本；用固定 main reader 完整依赖集，只对另一份可写 scratch 实例化真实 store，读取 registry/fault sidecar，逐 handle 核实。构造器会执行 startup recovery 并可能持久化，不能指向采集原件；不能重用旧 runtimeEpoch 或裁 epoch 来制造 PASS。`admissionBlockerForAgent` 只返回同 Agent 首条 blocker，需保留实际 handle，不能假定逐条都独立返回。旧 caller correlation 须通过同一 no-replay 入口验证；缺少 correlation 时明确覆盖缺项。旧固定索引/计数的 sanitized 矩阵不能充当当前快照 QA。

## D 安全发布条件清单

| 条件 | 已满足部分 | 缺项 / 结论 |
|---|---|---|
| 独立 QA | 独立候选源码与公开 PR 查重已执行；停点有复核 | 当前快照四事实、完整加载、持续阻断、no-replay、窄容忍的独立执行证据缺失；NOT_SATISFIED |
| 精确制品 pin | 已固定 source commit 与三文件 SHA | 完整安装包/Node/依赖 manifest、可信 pack digest、目标 loaded bytes 与启动绑定缺失；NOT_SATISFIED |
| 在途排空 | 本次未发新请求或重放 | 旧 worker/已发出 tools 在实际效果边界的终止或隔离证明、写者排空与切换窗口授权缺失；UNKNOWN |
| 回滚方案 | 原始证据保留；已知旧 reader 可能 fail-closed | 精确 rollback 制品、store/sidecar 兼容性、回滚后可用性与不重放方案未核实；不能称 rollback ready |
| 生产操作授权 | 本次诊断权限明确 | 生产切换授权不存在，亦非本次交付；禁止执行 |

`D_QA_COMPLETE=NO; SAFE_TO_PUBLISH=NO; BUSINESS_RECOVERED=UNKNOWN; OPERATION_ALLOWED=NO`（只读诊断停点以后）。保留 UNKNOWN 与历史 fence/evidence；不依据 reader 源码推断现场已恢复。
