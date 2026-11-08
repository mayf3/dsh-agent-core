# BRIEF-547-STORE-DIAG — 生产 Router 持久 Store `durable_store_invalid` 故障定位（只读+隔离副本分析）

## 授权链
- Owner 2026-11-08 Path A 指令："由 #547 原维护责任链利用不依赖故障 Router 的既有合规维护入口，处理持久 Store 启动故障。先做一致副本、实际失败谓词定位与隔离验证，不擅自裁剪 epoch、修改生产账本、清 fence 或盲目重启。"
- 常设授权 §2（调查/复现/诊断）。**零生产写入**——本任务只读 + 隔离副本分析，不做任何恢复动作。

## 已知事实（监管已核实）
- 生产 runtime：PID 396，authsvc 属主，`/usr/local/libexec/agent-core/app/scripts/production-runtime.mjs --root /Users/authsvc/.agent-core --catchup 0`，live SHA `393a0afc`（dsh-agent-core 谱系）。
- 症状：飞书交办消息送达成功，但 Agent 接单被 `durable_store_invalid` 拦截。
- 错误串来源谱系：`packages/agent-router/src/reconciliation/`（store.js / durable-file.js / startup-recovery.js 在 deployed app 内）。
- `/Users/authsvc/.agent-core/` 顶层对 UID502 可读（drwxr-xr-x authsvc）；`dev-execution/ledger` 为空（非目标）；`control/`、部分子目录 0700 不可读。
- authsvc 上下文可用：`sudo -n -u authsvc <cmd>`（部署链同款既有权限机制，**仅限只读访问**）。

## 任务
1. **读 deployed 源码**（`/usr/local/libexec/agent-core/app/packages/agent-router/src/reconciliation/*.js`）：找出产生 `durable_store_invalid` 的精确校验谓词（引用原文+行坐标），及 store 文件的路径解析规则（文件名/目录约定）。
2. **定位实际 store 文件**：按源码路径规则在 `/Users/authsvc/.agent-core/` 下找到实际持久 store（authsvc 0700 处用 `sudo -n -u authsvc ls/cat` 只读访问）。
3. **一致副本先行**：将实际 store 文件（含相邻 meta/锁文件）整体复制到隔离工作区（本 worktree 下 `docs/evidence/h547-store-diag/`），记录 SHA-256 + 复制时刻；**绝不修改原文件**。
4. **谓词定位（离线分析副本）**：在副本上运行 deployed 源码同一校验逻辑（只读 import，沙箱隔离，不连生产进程），定位到精确失败点（文件/记录/字节坐标 + 谓词原文 + 实际值 vs 期望值）。
5. **根因假设 + 最小恢复提案**（不执行）：写明每个候选修复动作会改什么、依据哪条规则、需要什么授权面。

## 硬边界
- 零生产写入：不改 /Users/authsvc/.agent-core 任何文件、不重启 PID 396、不裁剪 epoch、不清 fence、不写生产账本。
- sudo -u authsvc 仅用于只读（ls/cat/find/cp-out）；不得以 authsvc 执行任何写命令。
- 失败即停写 `STOPPED-547-STORE-DIAG.md`。

## 完成定义
`DURABLE-STORE-DIAG-547.md`：谓词原文+坐标、store 文件路径+SHA、副本坐标+SHA、离线复现输出原文、根因假设、最小恢复提案（分级：无需授权可逆动作 / 需维护链动作 / 需 Owner 最小操作）。commit → push → PR(base main) 不合并。

## 续办补充（v2，2026-11-08 监管裁定）
- v1 停点已核：root 属主 `.bak-pre-epoch-fix2-20261106` 等历史备份**排除**出副本集（非启动依赖，`paths.js` 源码消费集不含它们）；不扩大 sudo 身份读 root 文件。
- **副本边界（v2）** = `control/turn-recovery-v3.json` + `control/turn-recovery-v3.json.faults.json`（若存在）+ `control/turn-recovery-v3.json.abandonment-declarations.json`（若存在）+ 目录内现存 `.tmp-*`/lock/history 文件（仅 authsvc 可读者）。逐文件：采集前 stat → 复制 → 采集后 stat → 双 hash 一致性判定。
- 首轮已取得的 active store 单读副本（SHA `85c4b0ce…`）保留为参考；v2 需建立一致性副本后在其上离线复现。
- **离线复现（必须项）**：用 deployed 源码（/usr/local/libexec/agent-core/app）同一校验谓词集（store.js:111-121 分类 + durable-file.js 候选校验 + capacity.js 上限 256）对一致性副本运行只读校验，输出**实际失败谓词 + 记录/字段坐标 + 实际值 vs 期望值**。
- 新线索纳入分析：① root 属主 `.bak-pre-epoch-fix2-20261106` 文件名表明 2026-11-06 曾对生产 store 做过"epoch fix2"手术（是谁/依据什么授权 = UNKNOWN，如实记录）；② PID 396 于今日 13:56:34 重启（--catchup 0，重启者 UNKNOWN）。若当前 store 已通过校验（离线复现无失败），则如实报告"durable_store_invalid 现象可能已被重启清掉/或只在启动窗口出现"，并给出验证方法。
- 纪律不变：零生产写入、authsvc 只读、失败再停。

### v2 执行坐标与预检（2026-11-08）
- `schema_version=2; SPEC_GOVERNANCE_MODE=PREFLIGHT; AUTHORITY_ACTION=REUSE; PLAN_LEVEL=BRIEF; ASSURANCE_LEVEL=DURABLE; ROUTE_STAGE=OPERATION`。
- 原隔离分支 `diag/547-durable-store`，v2 parent `7d5979a94096ea4ffd41bbc5f2e29e0773916fb9`；integration/current remote main `95a8e1cb512fc99dc018209d837250dd51b4d08f`（本轮 ls-remote 核实）。现有 PR #670 续交付，不新建平行 PR。
- `PRIMARY_AUTHORITY=AGENT_PROCESS_LIFECYCLE_HARDENING_V4` C-018/C-019/BOUNDED；相关 `HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V2` RQ-003/RQ-006（production_apply_authority=none）。两者 accepted 于 base；本轮不改长期 Contract。
- `EXECUTION_MANDATE=VALID; MUTATION_AUTHORIZATION=VALID` 仅适用于用户 v2 授权的本地隔离采集/分析/报告及 commit/push/PR；生产写入、恢复、merge 禁止。`ISOLATED_WRITE_SURFACE=YES; IMPLEMENTATION_ALLOWED=NO; OPERATION_ALLOWED=YES`（只读诊断）；`MERGE_READY=NO`（用户要求不合并）。
- `SPEC_GAP_DEPENDENCY=NONE; LIVE_AUTHORITY_GAP=NONE; OWNER_DECISION_REQUIRED=NO`。历史备份 RETAIN（历史证据，排除启动消费集），不 RETIRE/MIGRATE/新增 bridge。
- `CURRENT_GAP`：v1 一致性/离线复现未完成。`EVIDENCE_NEEDED`：三遍稳定文件集、每遍逐文件 pre-stat/copy/post-stat/第二读取 hash、源码字节绑定、同谓词离线输出、独立受影响面复核。
- `DONE_WHEN` 沿用上文诊断文档 + 不合并 PR。`EXPANSION_TRIGGER`：任一读取/一致性/工具执行失败、需超出只读身份/副本边界或真实 authority 冲突；立即停止依赖动作，追加 v2 STOPPED，保留 v1 历史，不自动重试。
- `NEXT_ACTION=CONTINUE; NEXT_REAL_ACTION`：单次三遍只读采集；无 atomic snapshot 声称。当前磁盘 provenance 已变为 `08102a550cf2f5e14646c6858786d7fe7a50c61d`（main_repo_head 仍声明 `393a0afc…`）；PID 396 loaded bytes 未认证，列为 UNKNOWN，不把磁盘版本当加载证明。

### v2 当前状态：STOPPED（采集范围错误）
- 三遍采集于 `2026-11-08T07:00:23.742502Z..07:00:24.956394Z` 完成，但事后本地范围复核发现 `capture-v2.py:54` 将历史文件名中的 `unblock` 错当 `lock`，额外读了 authsvc 可读的 `turn-recovery-v3.pre-fleet-unblock-20261002-111745.json`。
- `CONTENT_CONSISTENCY=THREE_PASS_STABLE; CAPTURE_SCOPE=FAIL; OPERATION_ALLOWED=NO; NEXT_ACTION=STOP`。不自动重采，不再读取生产，不继续离线同谓词校验；仅保存/复核停止记录并更新 PR。该范围错误不改变实际 hash 一致的观察，也不构成诊断通过。
- `DONE_WHEN=NOT_MET`；见 [STOPPED-547-STORE-DIAG.md](STOPPED-547-STORE-DIAG.md) 的 v2 节。原始执行脚本和 receipt 原样留存，不改成“正确执行”的版本。

## 续办补充（v3，2026-11-08 监管裁定——消费 Owner Watch3 指令）
### A. 副本范围精确修正（复用已有证据，不做第三次全目录采集）
- v2 停点根因 = 采集脚本 `'lock' in name.lower()` 误纳历史 `pre-fleet-unblock` 文件。v3 精确白名单 = 源码实际组合的文件名（paths.js:78-79,107 + store.js:65 + durable-file.js:71-72 + index.js:196-197）：
  - `control/turn-recovery-v3.json`（active store）
  - `control/turn-recovery-v3.json.faults.json`（存在才采）
  - `control/turn-recovery-v3.json.abandonment-declarations.json`（存在才采）
  - `control/turn-recovery-v3.json.r28-history.jsonl`（存在才采）
  - `control/turn-recovery-v3.json.tmp-*`（原子写残留，存在才采）
  - **白名单外一律不采**（.bak*/pre-fleet-unblock/historical 均排除）
- v1 首轮副本（SHA 85c4b0ce）、v2 三遍稳定副本、源码快照**全部复用**，不丢弃；v3 只补缺失文件的精确采集 + 当前快照新鲜一致性读。
### B. Watch3 消费（Owner 2026-11-08 comment 6718344408 五点）
1. **当前生产新快照固定**（只读，等价 ITOps 快照职责的诊断代行）：对 A 白名单文件做新鲜一致性采集（前 stat→复制→后 stat→双 hash），记录 4 条异常记录的精确 handle/内容摘要/文件哈希/sidecar 一致性——**不得仅据观察投影断言**，以实际文件内容为准。
2. **D 最小线查重先行**：核实 main `42487e65`（已含于 95a8e1cb）三件套（state-machine.js markFenceCleared 写侧 guard / durable-file.js isLegacyUnprovenFenceClear 窄容忍 / admin-abandonment.js:105-115 admissionBlockerForAgent 持续阻断）就是既定候选；grep 在途候选/作者/PR 确认无重复开发。
3. **隔离环境验证（本任务核心交付）**：用当前真实快照副本 + main 新 reader 代码离线运行完整 store 加载：① 全量加载成功 ② 4 条异常全部可识别且**继续阻断**（admissionBlockerForAgent 返回记录）③ 旧 UNKNOWN 不产生第二次效果（no-replay）④ isLegacyUnprovenFenceClear 对旧毒态受限读取生效。全部结果输出原文。
4. A 二次修复不作默认步骤；C transport 独立诊断不在本任务范围。
5. 交付 `D-STORE-QA-547.md`：四条事实核实结果（逐条：handle/哈希/兼容性/阻断状态）+ D 候选安全发布条件清单（已满足项/缺项逐项列明：独立 QA/精确制品 pin/在途排空/回滚方案）+ 明确"生产切换未执行、不在本任务授权内"。
- 纪律不变：零生产写入（不切生产、不重启、不改文件）、authsvc 只读、失败再停。

### v3 本次执行坐标与预检
- `schema_version=2; SPEC_GOVERNANCE_MODE=PREFLIGHT; AUTHORITY_ACTION=REUSE; PLAN_LEVEL=BRIEF; ASSURANCE_LEVEL=DURABLE; ROUTE_STAGE=OPERATION`。
- `REVIEW_TARGET_HEAD=c8036802f1543b108eddce3f8fce474bdc2d4d99; BASE_HEAD=95a8e1cb512fc99dc018209d837250dd51b4d08f`；沿用隔离分支/worktree/PR #670。本轮未 fresh-read remote tip，`origin/main` 仅为 integration snapshot；本地旧 `main` 不用作候选。
- 本次用户 v3 指令恢复只读采集/隔离验证/报告授权；v1/v2 STOPPED 保留原文。`AUTHORITY_ACCEPTED_IN_BASE=YES; EXECUTION_MANDATE=VALID; MUTATION_AUTHORIZATION=VALID; ISOLATED_WRITE_SURFACE=YES`（仅本地诊断产物与既有 PR 交付）。`IMPLEMENTATION_ALLOWED=NO; OPERATION_ALLOWED=YES`（诊断）；生产切换/恢复/merge 均禁止。
- Primary authority 沿用 accepted PLH V4 C-018/C-019/BOUNDED 与 HR trusted recovery V2 RQ-003/RQ-006；不改 Contract，`SPEC_GAP_DEPENDENCY=NONE; LIVE_AUTHORITY_GAP=NONE`。旧证据 RETAIN；D 重用 main，零重复实现。
- `CURRENT_GAP`：v3 当前一致副本、4 异常文件事实与 main reader 完整加载尚未验证。`DONE_WHEN`：D-STORE-QA-547.md、全部离线输出、独立受影响面复核及既有 PR 更新；生产发布条件允许记录缺项，不等于发布通过。
- `EVIDENCE_NEEDED`：精确 allowlist 本地反例；当前逐文件 pre-stat/copy/post-stat/二次源读/final stat 与跨遍向量；复用源码 hash；完整 constructor + sidecar + 4 records 阻断/UNKNOWN/no-replay/窄容忍证据。
- `EXPANSION_TRIGGER`：命令、读取、一致性、验证失败或越界/authority 冲突，停止依赖工作；不自动重试。预期负向断言捕获的拒绝是验证成功，不是意外失败。`MERGE_READY=NO; NEXT_ACTION=CONTINUE`。

### v3 当前状态：STOPPED（本地查询引用不存在的文件）
- helper 本地 `rg` 命令引用 `packages/agent-router/src/reconciliation/dispatch-faults.js`，rc=2 / No such file or directory；并非生产读取或 validator 错误。同一 exec 还完成三条已安排的本地 Spec 读取，之后停止；root 未启动采集/验证，不自动改名重试。
- `V3_FRESH_CAPTURE=NOT_RUN; FULL_STORE_LOAD=NOT_RUN; FOUR_RECORD_QA=NOT_VERIFIED; OPERATION_ALLOWED=NO; NEXT_ACTION=STOP; DONE_WHEN=NOT_MET`。报告为 [D-STORE-QA-547.md](D-STORE-QA-547.md)，仅如实交付已完成查重与缺项，不宣称核心 QA 完成。

## 续办补充（v4，2026-11-08 监管裁定）
- v3 停点 = 子任务引用不存在的 `reconciliation/dispatch-faults.js`（rg rc=2）——引用笔误，非生产失败谓词。**修正**：faults sidecar 实名 = `turn-recovery-v3.json.faults.json`（store.js:65 拼装规则）；abandonment 注册表实名 = `turn-recovery-v3.json.abandonment-declarations.json`（durable-file.js:71-72）。以此执行 `capture-v3.py`（先核对白名单与源码拼装规则逐项一致）。
- **授权执行 D-STORE-QA-547.md 自列续办配方**：白名单一致副本采集（前/后 stat+双hash）→ 固定 main reader（95a8e1cb 含 42487e65）完整依赖集 → 只对**可写 scratch 副本**实例化真实 store（构造器 startup recovery 可能持久化 → 绝不指向采集原件）→ 读取 registry/fault sidecar → 逐 handle 核实四条异常：可识别 / admissionBlockerForAgent 持续阻断（该函数只返回同 Agent 首条 blocker——保留实际 handle，不假定逐条独立返回）/ 旧 UNKNOWN 经同一 no-replay 入口不产生第二次效果（缺 correlation 的如实标注覆盖缺项）/ isLegacyUnprovenFenceClear 受限读取生效。
- 不重用旧 runtimeEpoch、不裁 epoch 制造 PASS；旧固定索引/计数的 sanitized 矩阵不充当当前快照 QA。
- 完成定义 = D-STORE-QA-547.md 更新（四事实核实矩阵实填 + 安全发布条件清单已满足/缺项终版）+ 测试/验证输出原文 + commit/push/PR 不合并。失败再停。

### v4 当前状态：STOPPED（root 本地目录查询错误）
- 本轮执行 parent `71fce950e249ef8e36a9d255e4cfdc97fdc70532`，隔离分支/worktree/PR #670 不变。用户 v4 明确恢复本地采集/验证授权；沿用 `PREFLIGHT / REUSE / BRIEF / DURABLE / OPERATION`，不改变 Product Contract，不扩展生产权限。
- root 预检 `rg --files docs/architecture docs/decisions docs/specs | rg ...` 引用了不存在的 `docs/architecture`，输出 `rg: docs/architecture: No such file or directory (os error 2)`。本仓库 Architecture 实际入口已由 local README 声明为 `docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md`；本轮没有改路径后重试。错误是本地查询问题，不是生产 store 失败谓词。
- 当时工具只转发 output，未保留外层或内部命令的 exit status；二者均 `UNKNOWN_NOT_RETAINED`，不能回填 rc=0 或 rc=2。错误时间 UNKNOWN；停止收据时钟为 `2026-11-08 07:28:00 UTC`，不是错误时间。
- 收到 stderr 后停止依赖诊断、打断只读复核 helper；不启动采集或任何 store 实例化。helper 已安排的四次本地只读 exec_command 完成，均 rc=0；本轮生产读取/authsvc 调用/生产写入/restart/旧 UNKNOWN 重放均为 0（本次操作者边界）。
- `V4_FRESH_CAPTURE=NOT_RUN; FULL_STORE_LOAD=NOT_RUN; FOUR_RECORD_QA=NOT_VERIFIED; OPERATION_ALLOWED=NO; NEXT_ACTION=STOP; DONE_WHEN=NOT_MET; MERGE_READY=NO`。只继续保存停止证据、独立复核包装并 commit/push/更新现有 PR；不将材料包装校验算作 D QA。

## 续办补充（v5，2026-11-08 监管裁定——失败语义修正）
- **失败语义重定义（覆盖前版"失败即停"的模糊性）**：
  - **构成失败需停**：①必需输入缺失（active store/源码快照/main reader 基线不可得）②验证谓词返回非预期结果且无法解释 ③生产写入尝试被拒 ④数据一致性校验失败
  - **不构成失败，记录后继续**：①探索性查找空结果（rg/grep/ls 未命中）——改为从 store.js/durable-file.js/paths.js 源码拼装规则推导实名后继续 ②自身计划草稿引用了错误路径——现场查源码修正后继续 ③子代理跑偏——纠正后继续
  - 开工前置自检（一次）：把本任务计划引用的全部文件路径先逐一 `test -e` 核对，从源码拼装规则得出实名清单，再开始采集/验证
- v4 已有成果复用：D-STORE-QA-547.md 的续办配方 = **预授权按文执行**（无需重推导）；v1-v4 的副本、源码快照、清单全部复用
- 交付与红线不变：D-STORE-QA-547.md 实填终版 + 输出原文 + commit/push/PR 不合并；零生产写入/authsvc 只读/不裁 epoch


### v5 本次执行坐标与预检
- `schema_version=2; SPEC_GOVERNANCE_MODE=PREFLIGHT; AUTHORITY_ACTION=REUSE; PLAN_LEVEL=BRIEF; ASSURANCE_LEVEL=DURABLE; ROUTE_STAGE=OPERATION`。执行 parent `f6b988232ce218e7b85ea1853d4d0f8b47a4032a`；隔离 worktree/分支/PR #670 沿用，用户提供的 v5 原文保留。
- `BASE_HEAD=95a8e1cb512fc99dc018209d837250dd51b4d08f` 固定 reader；fresh ls-remote main 观察 `206e19c17c268c7513e5a4d8b2135ac496cf7daf`，不偷换 reader。两份 accepted Spec 在固定 base 可得，相关 Contract 沿用上文，不改长期语义。
- `AUTHORITY_ACCEPTED_IN_BASE=YES; EXECUTION_MANDATE=VALID; MUTATION_AUTHORIZATION=VALID; ISOLATED_WRITE_SURFACE=YES; IMPLEMENTATION_ALLOWED=NO; OPERATION_ALLOWED=YES; MERGE_READY=NO; SPEC_GAP_DEPENDENCY=NONE; LIVE_AUTHORITY_GAP=NONE; OWNER_DECISION_REQUIRED=NO`。权限仅为本地采集/隔离分析/文档/commit/push/既有 PR；authsvc 只读。
- 一次完整路径自检见 `path-selfcheck-v5.json`：35 个本地必需路径逐一 test -e、18 个旧源码 hash 校验、生产 active + 三种可选 sidecar 逐一只读 test -e；r28 history 缺席为可选输入，不是失败。用户自引用 D-STORE-STORE-QA-547.md 修正为实际 D-STORE-QA-547.md。
- 独立执行前范围复核 PASS：capture-v3.py 精确白名单、authsvc 只读 ls/stat/cat、10 个正反例、18 个旧源码 hash；实际算法两遍，每文件每遍两读三 stat，不声称三遍或 atomic。脚本原样复用，文件名 v3 表示脚本版本，本次 invocation 属 v5。
- `CURRENT_GAP`：本次新鲜一致采集及真实 store/scratch 四事实 QA 尚待执行。`EVIDENCE_NEEDED` 与 `DONE_WHEN` 按 v5 与预授权续办配方。历史原件 RETAIN，不迁移、清理或重采历史备份。
- `EXPANSION_TRIGGER` 采用 v5 明确失败语义；仅必需输入缺失、无法解释的非预期谓词、生产写入被拒、数据一致性失败停止依赖工作。路径草稿错误、探索空结果和子代理纠偏记录后继续。`NEXT_ACTION=CONTINUE; NEXT_REAL_ACTION=精确白名单单次采集，然后只在新 scratch 实例化固定 reader`。


### v5 实际结果（交付复核中）
- 单次新鲜 capture PASS；两遍稳定，3 个精确白名单文件，36 条 authsvc ls/stat/cat 全 rc0；加自检4次 test 共40次只读调用。六个原件末次hash未变，v1/v2原件保持。
- 固定 main 完整 reader 的真实 scratch constructor PASS（5322 records），141 checks全通过；当前真实异常为5条（4legacy+1ordinary），全部识别且持续阻断，4份已有correlation精确查回/duplicate mint拒绝，dev-engineer缺correlation明确记覆盖缺项；28窄容忍反例均预期TypeError。
- 两次本地harness问题均保留原始rc1/输出/源码并具体解释：缺省scratch路径权限、Node permission禁用fsync。最终OS sandbox只允许scratch3写、拒绝network/process-fork，rc0；无未解释谓词失败，未重采生产。见 harness-correction-v5.json。
- 无手工epoch编辑或旧epochoverride；正常原生compactRuntimeEpochs在scratch中用fresh UUID替换1个无记录历史epoch，输入/输出均256，全部79个record引用epoch保留。真实差异明确记录，不称scratch epoch字节全不变；生产/采集原件不变。
- 独立capture/源码/输出/受影响Contract复核 PASS，FROZEN_BLOCKER_UNION=[]；最终committed Head另做delta recheck。SAFE_TO_PUBLISH=NO；精确生产制品/loaded bytes、在途排空、rollback和生产操作授权均仍缺；BUSINESS_RECOVERED=UNKNOWN; MERGE_READY=NO。D-STORE-QA-547.md 已实填终版与发布缺项；待commit/push/PR交付后停止，不做生产操作。
