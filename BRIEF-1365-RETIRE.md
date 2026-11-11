# BRIEF-1365-RETIRE — 退役开发执行器解耦（审查增量③第四优先, #1363 D02）

授权: Owner 审查增量③+常设授权§3B+预授权V1§1。零生产写入。
定义来源: agent-control issue **#1365**(父#1363 D02)正文+矩阵实证坐标。
停止条件: 失败即停写STOPPED-1365-RETIRE.md; SPEC_GAP同前例停。

## 环境配方
node_modules已预链(只验证); Node v26.7.0文件展开运行器(目录参数陷阱); 九键清洁env配方; 全仓npm test结构性不可用作门; 噪声不计门。

## 矩阵实证坐标(main b6ddc2a6)
- `packages/production-runtime/src/workflow/capability-runtime.js:13-27`: Workflow 仍无条件构造完整退役执行器(构造器加载backend/创建ledger/replay)。
- `packages/production-runtime/src/workflow/development-execution-runtime.js:19-22`: 同上无条件挂载。
- `packages/development-execution/src/engine.js:62-79`: 构造器仍加载backend。

## 任务(Owner增量指令逐字)
1. **RED基线**: 隔离测试证明——退役开发writer的backend损坏/历史损坏时, Workflow启动被阻断(原D02隔离复现场景)。
2. **最小修复**: Workflow不再无条件构造完整退役执行器——改为惰性构造(仅在实际需要时创建)或独立只读查询; 保留"拒绝旧写与历史"语义不变; **不另建管理器**(#1365正文边界)。
3. 边界: 退役拒绝语义(旧写拒绝)不变; 不触#1367诊断只读分离(已合正交); 不触锁架构(#1366已合正交); 不混入#1372能力表面。
4. 测试: RED基线+修复后GREEN(backend损坏时Workflow启动不再阻断+退役写拒绝保留)+受影响既有套件rc0(文件展开)。
5. 交付: 分支fix/retire-executor-decouple→push开PR(base main)不合并→RECEIPT-1365-RETIRE.md(RED/GREEN原文+diff坐标+DONE_WHEN对照)。
红线: 失败即停; SPEC_GAP同前例停; 不动治理文档/.agents/tools; 不rebase; PR禁自合并。

## PREFLIGHT（当前执行记录，schema_version: 2）

- SPEC_GOVERNANCE_MODE=PREFLIGHT; TARGET_REPOSITORY=mayf3/dsh-agent-core。
- BASE_HEAD=b6ddc2a67ba041b8b13ed33d331104cf809d4985；隔离 worktree=/private/tmp/h1365-retire；单一写者=root；分支=fix/retire-executor-decouple。
- CURRENT_BASE_HEAD=e8d6d333743f812945d47b96ace61b817f35f9cf（远端 main fresh fetch）。不 rebase。差异未触 development-execution、production-runtime 或本任务退役权限依据；#1366 的 Workflow ledger 改动不在本修复面。
- GOAL_OR_TARGET=旧 backend/历史缺失或损坏不阻断无关 Workflow；退役旧写拒绝；历史查询仍准确/报损坏且不改历史。
- CURRENT_GAP=Workflow mount 无条件构造完整 retired Engine，构造器先加载 backend、创建 ledger/replay。
- OBSERVATIONS=#1365/#1363 正文已通过 GitHub connector fresh-read；挂载实路径为 packages/production-runtime/src/development-execution-runtime.js，Brief 矩阵多写的 workflow/ 不是另一个文件。
- AUTHORITY_ACTION=REUSE; ROUTE_STAGE=IMPLEMENTATION; AUTHORITY_ACCEPTED_IN_BASE=YES。
- PRIMARY_AUTHORITY=AGENT_CORE_DEVELOPMENT_EXECUTION_AUTHORITY_CONVERGENCE_V1 r1（基线中的 accepted/contracts/production-none），CTR-DEC-001/002；RELATED_AUTHORITIES=其保留的 CTR-DES-002 只读记录/收据。
- IMPLEMENTATION_AUTHORITY=contracts; PLAN_LEVEL=BRIEF; ASSURANCE_LEVEL=DURABLE（兼容历史读取）；独立受影响语义审查后交付。
- EXECUTION_MANDATE=VALID; MUTATION_AUTHORIZATION=VALID（Owner 本任务）；ISOLATED_WRITE_SURFACE=YES；CONTROLLED_RUNBOOK_REQUIRED=NO（仅离线源码/夹具及授权 Git 分支/PR）。
- SPEC_GAP_DEPENDENCY=NONE; LIVE_AUTHORITY_GAP=NONE; EVIDENCE_REVIEWABILITY=PASS；WORKING_GUESS=NOT_APPLICABLE；OWNER_DECISION_REQUIRED=NO。
- IMPLEMENTATION_ALLOWED=YES; MERGE_READY=NO（本任务禁止自合并）；OPERATION_ALLOWED=NO（零生产写入）。
- Model convergence：RETIRE=Workflow 启动链的完整退役 writer 初始化；RETAIN=现有 handler/engine facade、显式拒写、历史 ledger/static replay 与收据；不新增管理器/历史格式/兼容层，不重启旧 writer。
- 最小实现=mount 惰性获取现有 Engine；default-retired Engine 不加载 backend/可写 ledger，status/result 才走现有 static replay；显式 false hermetic 分支保持。
- EVIDENCE_NEEDED=同一新增隔离回归文件在源码未改时的 RED 和修复后 GREEN、两份既有 development-execution 套件、相关 Workflow composition/diagnostic 套件、现有结构门、独立审查。
- RED 是预声明的缺陷观测，不是失败豁免：仅允许固定五个用例在旧源码下按预期失败；非预期 RED、GREEN/既有门/结构门/审查失败立即 STOPPED，不继续代码修正、commit/push/PR。
- DONE_WHEN=上述证据通过，push 指定分支并开 base main 的未合并 PR，交付 RECEIPT-1365-RETIRE.md，保留原始输出/坐标。
- EXPANSION_TRIGGER=需要改权限/历史格式/管理器/锁架构/#1367/#1372 或出现 SPEC_GAP/真实失败；触发即停。
- NEXT_REAL_ACTION=先写隔离测试与九键清洁、文件展开捕获运行器，执行预声明 RED；NEXT_ACTION=CONTINUE。

## 当前停止状态

RED 测试观察为预期 rc1/fail5，但捕获运行器的额外错误文字断言失败（rc1）；已按 Owner 失败即停写入 [STOPPED-1365-RETIRE.md](STOPPED-1365-RETIRE.md)。当前 IMPLEMENTATION_ALLOWED=NO、PUBLICATION_READY=NO、NEXT_ACTION=STOP；尚无源码修复/commit/push/PR。以上 PREFLIGHT 保留为执行前记录，不覆盖当前停止状态。

## R2 恢复授权与当前路由（2026-11-08，schema_version: 2）

- ISSUER=Owner，本轮用户原文：「R2续派(失败自动继续——捕获器匹配错误修复, Owner预授权V2§5)」。明确授权精确修捕获器、不跳过诊断文本、RED 5/5 重跑，再最小实现、GREEN、受影响套件 rc0、commit/push/base main PR 不合并、RECEIPT；红线及失败即停继续适用。
- 此明确续派解除 R1 捕获器失败对本次修复的停点，不追改 R1 失败结论；`RED.tap`、`RED.json`、原停止记录原件保留。R2 运行另存 `R2-*.tap/json`。
- BASE_HEAD=REVIEW_TARGET_HEAD=b6ddc2a67ba041b8b13ed33d331104cf809d4985；CURRENT_BASE_HEAD=e8d6d333743f812945d47b96ace61b817f35f9cf（本轮 fresh fetch）；隔离 worktree/ref/唯一写者与原 PREFLIGHT 相同；不 rebase。
- BASE_IMPACT=NONE：base 到当前 main 未改动 development-execution、production-runtime、CTR-DEC governing Spec 或 .agents；原权威/范围继续有效。直接 issue #1365 已 fresh-read。
- SPEC_GOVERNANCE_MODE=PREFLIGHT；AUTHORITY_ACTION=REUSE；ROUTE_STAGE=IMPLEMENTATION；AUTHORITY_ACCEPTED_IN_BASE=YES；PRIMARY_AUTHORITY/RELATED_AUTHORITIES/GOAL_OR_TARGET/CURRENT_GAP/PLAN_LEVEL=BRIEF/ASSURANCE_LEVEL=DURABLE 与原记录相同；无新 Spec 或长期语义变化。
- MUTATION_AUTHORIZATION=VALID；EXECUTION_MANDATE=VALID；ISOLATED_WRITE_SURFACE=YES；SPEC_GAP_DEPENDENCY=NONE；LIVE_AUTHORITY_GAP=NONE；EVIDENCE_REVIEWABILITY=PASS；OWNER_DECISION_REQUIRED=NO；CONTROLLED_RUNBOOK_REQUIRED=NO。
- IMPLEMENTATION_ALLOWED=YES（产品源码必须先通过 R2 RED）；PUBLICATION_READY=NO（待全部门及独审）；MERGE_READY=NO；OPERATION_ALLOWED=NO。
- 下一动作：仅修捕获器，按五个固定 test 名称/序号精确绑定诊断、错误代码和源栈；R2 RED 通过后实现；任何非预声明失败立即停。EVIDENCE_NEEDED、DONE_WHEN、EXPANSION_TRIGGER 沿用上文。

### R2 RED 通过与验证布局

R2 RED 于 UTC 2026-11-07T23:30:22 重跑：测试 rc1/fail5，五条诊断逐项精确匹配，捕获器 rc0。三份产品源码哈希与 R1/基线相同。原始证据见 `docs/evidence/1365-retire/R2-RED.tap/json`。

结构预检发现 R1 新增测试/捕获器所在的 test 与 scripts 顶层已有宽度债务。仅把两份本任务尚未跟踪的新文件移到现有 `packages/development-execution/test/`，不改既有文件或 cap。回归文件仅调整 import；五个用例与断言保持。捕获器仅调整 ROOT、回归/自身路径；R2 RED 的旧路径/哈希仍原样保存。当前命令：`python3 packages/development-execution/test/run-retirement-gates.py GREEN|existing`。

结构门使用基线已包含的 fc518e58 适配器及标准 --base/--head。local README 的资格待定叙述是旧观察；`RECEIPT-VERIFIER-ADAPT.md` 及 `RECEIPT-1364-BUDGET.md` 已记录 V3 适配/资格（不修改治理文件）。

## R2 当前停止状态（覆盖上述恢复时 readiness）

R2 RED 捕获通过、GREEN 5/5，通过的证据保留。文件展开既有套件 child/capture rc1：71项 pass57/fail14；全部失败于 composition 的真实 Node v25.6.1 守卫，本次实测 v26.7.0。按 Owner 最终「失败即停」停止，不继续修复或提交/发布。IMPLEMENTATION_ALLOWED=NO；PUBLICATION_READY=NO；MERGE_READY=NO；OPERATION_ALLOWED=NO；NEXT_ACTION=STOP。原始证据、最低恢复条件和独立停止核验见 STOPPED-1365-RETIRE.md / docs/evidence/1365-retire/R2-STOP.json。未运行结构门，未 commit/push/开 PR，未生成完成版 RECEIPT。

## R3 恢复授权与当前路由（2026-11-08，schema_version: 2）

- ISSUER=Owner，本轮用户原文：「R3续派(Node版本守卫环境归因, 失败自动继续)」；依最终红线「失败即停」，仅解除 R2 版本配方停点，任何新的失败立即停，不自动修复或发布。
- 范围：真实 v25.6.1 重跑原受影响文件展开套件、其他受影响面定向抽查、现有结构门与独审，通过后 commit/push、base main PR 不合并、完成 RECEIPT。零生产写入；不 rebase；不动治理/.agents/tools、产品版本守卫或既有断言。
- BASE_HEAD=REVIEW_TARGET_HEAD=b6ddc2a67ba041b8b13ed33d331104cf809d4985；CURRENT_BASE_HEAD=e8d6d333743f812945d47b96ace61b817f35f9cf（本轮 git fetch origin main rc0）。两者间 development-execution、production-runtime、.agents、相关 Spec、Architecture、Decisions 无差异；BASE_IMPACT=BOUNDED：Workflow ledger-admission/plan、owner-assistance-resume-engine 与相关测试有正交变动，未改退役挂载或权限/历史契约；当前门绑定原基线候选，不声称已集成/验证 main 新代码。
- 隔离 worktree=/private/tmp/h1365-retire；ref=fix/retire-executor-decouple；唯一写者=root。spec-governance=PREFLIGHT；AUTHORITY_ACTION=REUSE；ROUTE_STAGE=IMPLEMENTATION；AUTHORITY_ACCEPTED_IN_BASE=YES；PRIMARY_AUTHORITY/RELATED_AUTHORITIES/GOAL_OR_TARGET/PLAN_LEVEL=BRIEF/ASSURANCE_LEVEL=DURABLE 沿用 R2。accepted/contracts/production-none 权威已在基线；#1365 正文已 fresh-read。
- MUTATION_AUTHORIZATION=VALID；EXECUTION_MANDATE=VALID；ISOLATED_WRITE_SURFACE=YES；SPEC_GAP_DEPENDENCY=NONE；LIVE_AUTHORITY_GAP=NONE；EVIDENCE_REVIEWABILITY=PASS；OWNER_DECISION_REQUIRED=NO；CONTROLLED_RUNBOOK_REQUIRED=NO。
- 实测 `/usr/local/bin/node --version`=`v25.6.1`，execPath=/usr/local/Cellar/node/25.6.1_1/bin/node，arch=x64。捕获器仅切换本轮实际版本检查至 v25.6.1、新证据前缀 R3，并记录 PATH/实际二进制/CLI version/哈希；清理九键仍只作用于测试子进程。运行采用 `PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`，绝不伪造 process.version。
- R1/R2 原始证据与 STOPPED 历史不覆盖；产品源码沿用 R2 的两个文件、22 additions / 13 deletions；RED/GREEN 机制证据按源码哈希复用（既有套件亦包含同一 GREEN 回归文件）。其他面定向抽查限定为 workflow-progress-runtime、workflow-progress-gateway、Workflow runtime-wiring、recovery 四份既有测试。
- IMPLEMENTATION_ALLOWED=YES（仅本轮环境捕获及证据收尾）；PUBLICATION_READY=NO（待门与独审）；MERGE_READY=NO；OPERATION_ALLOWED=NO。EVIDENCE_NEEDED/DONE_WHEN/EXPANSION_TRIGGER 沿用既有记录；NEXT_REAL_ACTION=以真实 v25.6.1 执行 existing 门；NEXT_ACTION=CONTINUE。

### R3 验证闭环与发布边界

R3 existing 71/71、targeted 91/91，均 child/capture rc0、skip/cancel0；真实 v25.6.1、execPath、PATH、CLI version 和二进制 SHA256 已落 `R3-existing.json`/`R3-targeted.json`。两份产品源码及新回归文件与 R2 GREEN 哈希相等；R1/R2 八份 raw/json 原件哈希不变。R2 existing 停点 CLOSED_BY_R3_EXISTING，不改写旧失败。

结构门在不可变验证对象 `91662c3cab497518cc875447f6641b5b2f56aa4d` rc0，0 新违规/28 旧债务。独立 `/root/independent_review` 对该精确候选 PASS、OPEN_BLOCKERS=0、SPEC_GAPS=0。实际源码 commit=`739fdd3434626b9b215fe1b1557689dfc1eea61b`，整个 tree 与验证对象相等；未 rebase，未修改红线范围。

当前 PUBLICATION_READY=YES（文档最终 HEAD 仍作 DELTA 独审）；MERGE_READY=NO；OPERATION_ALLOWED=NO。NEXT_REAL_ACTION=提交证据/收据、普通 push、开 base main 未合并 PR，真实发布读回后补齐 RECEIPT 即 STOP。详细证据见 [RECEIPT-1365-RETIRE.md](RECEIPT-1365-RETIRE.md)。

### R3 实际交付

源码 `739fdd34`；文档证据 `6a3f822174cf446eba24b9f42738db54ddc74af6` 独立 final-HEAD DELTA PASS。普通 push rc0；实际 [PR #666](https://github.com/mayf3/dsh-agent-core/pull/666) base main，fresh readback open、merged=false。RECEIPT 已补齐原始 RED/GREEN、真实版本切换、71/91 rc0、结构/独审、diff 和 DONE_WHEN 对照。仅剩这次文档补齐的 containing commit/DELTA 复核/普通 follow-up push 与最终读回，完成即 STOP；无新语义开发或可选扩展。
