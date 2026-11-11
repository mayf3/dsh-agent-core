# BUSINESS-RECON-20261108 — 无人值守真实业务恢复对账

本轮完成的是**只读对账记录**，不是“真实业务已恢复”的验收。19:54 已证 HR 调用 `workflow_execute` 且 turn 正常结束；原始请求、业务事件和实例状态仍 UNKNOWN。20:26 四笔 `COMPLETED` 无法在指定证据范围逐笔绑定，均 UNKNOWN。恢复后一个 HR **自然到期** occurrence 的 reserve、Router admission、turn 和扫描调用已证；原业务合法后继未证，因此无人值守业务全链 **未通过验证**。未把接口失败或探索空结果写成业务零进展。

## 取证范围、授权与可复核性

- 授权：Owner 本轮指令及根目录 [BRIEF-BUSINESS-RECON-20261108.md](BRIEF-BUSINESS-RECON-20261108.md)，简报 SHA-256 `7352ebc87003b904c7a718915b873fad20dd06a893f2e48a30c32126657a190e`。
- 工作树：`/Users/yanfenma/workspace/project/worktrees/recon-biz-20261108`；隔离分支 `recon/business-recovery-20261108`；父 HEAD / 集成基线 `origin/main@1d3cef866f2bac545a4aa62ca53f5b0e178dd2a1`。`git ls-remote origin refs/heads/main` 取证时同 SHA。本地旧 `main@5c7b6205…` 未作为当前集成基线或权威。
- 生产文件仅 `sudo -n -u authsvc` 只读；正式主证逐文件检查 owner=`authsvc`、uid=505。未读 token/Secret，未使用其他主体凭据，未调用写 API、发送交办、run-now、重放、重启或清 fence。生产中原有 Agent 自发活动不归为本轮动作。
- 统一时间：下表为 **2026-11-08 Asia/Shanghai（UTC+08）**。JSON 原始时间为 UTC 或 epoch 毫秒；保留原值便于转换。
- 固定证据摘录：[business-recon-20261108-evidence.json](docs/reports/business-recon-20261108-evidence.json)，SHA-256 `38287a05c9f258796c1a8dba77ce7cbc58336b7b9427e2d12acb612aea94f1ef`；采集区间 `2026-11-08T13:25:35.704039Z`–`13:25:36.018984Z`。它是脱敏选段及只读收据，不是新的业务权威。每源保留路径、属主、读取时刻、字节数、实测整文件 hash，JSONL 选段另保留行 hash。
- 文件仍由生产持续写入，各源顺序读取，**不是跨文件原子快照**。`runs.jsonl` 有大小轮转：并行初查的目标行号 40919–40924 在固定采集时已变为 **40910–40915**；本报告使用固定摘录行号，并以 occurrence/run/handle/seq 作稳定检索键。JSON 数组下标同样只属于该快照。
- `homes/agt_hr-agent/sessions/.../main/session.jsonl` 等 native 轨迹实测 owner=`yanfenma`（uid502），即使 authsvc ACL 可读，本报告也未将其内容作为指定属主主证。原始工具 call/result 的读取主体与缺口见各表。没有用投影补造原始业务事件。

### PREFLIGHT（报告内持久记录）

| 轴 / 检查 | 本轮判定 |
|---|---|
| GOAL / CURRENT_GAP | 对账四项并交付 commit→push→PR；原始业务事件、真实状态及自然槽业务后继尚缺 |
| 模式 / 路由 | `PREFLIGHT / REUSE / BRIEF / DURABLE`；`ROUTE_STAGE=OPERATION`（只读观察及报告） |
| 权威 | 已读 `.agents/README.md`、`.agents/local/README.md`、Architecture、Decision index；直接适用 D-009、`SCHEDULER_TIMEOUT_OUTCOME_V3`（occurrence/termination 不等于业务结果）、`AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V3` CTR-003/005/010（Svc 原子裁决、advisory 非执行授权、业务错误透传）；Owner Workflows V2 的 UNKNOWN / no bypass 边界 |
| Authority / implementation | 上述文件在集成基线；`AUTHORITY_ACCEPTED_IN_BASE=YES`（适用条款）；`IMPLEMENTATION_AUTHORITY=not_applicable`；不新增或修改 Product Contract |
| Mandate / 写入面 | `EXECUTION_MANDATE=VALID`、`MUTATION_AUTHORIZATION=VALID`（仅报告/证据/commit/push/PR）；`ISOLATED_WRITE_SURFACE=YES` |
| Readiness | 只读取证及报告交付允许；产品实现、生产写入、合并均不在授权范围；`MERGE_READY=NO`（Owner 明确不合并） |
| Gap / reviewability | 无本轮需改写的 authority gap；指定主证可由合法 reviewer 重读，固定选段可直接评审。业务缺口为明确 UNKNOWN，不能满足业务恢复验收 |
| DONE_WHEN / STOP | 四项表格、坐标、UNKNOWN/合法补证者、独立审阅及 commit/push/PR；交付后停止，不扩展为权限修复、生产恢复或反复等待自然槽 |

## 证据索引与启动边界

以下路径均以 `/Users/authsvc/.agent-core/` 为前缀。`E*` 指固定摘录的 `sources[相对路径]`；行号是原文件在上述采集时的行号。

| ID | 主证文件 / 坐标 | 字节数 / SHA-256（固定读取） | 用途与限制 |
|---|---|---|---|
| E1 | `logs/runtime.log` L100754、100942、101075、101195；末段 L101183–101207 | 20474680 / `7a75602baca06b5699d9e01413919def97c815f90f3c26d4c819ba1958c0d056` | 原日志无逐行时间戳；按 PID 联 E3 ready；卡片 sent 不证明业务完成 |
| E2 | `logs/runtime.err.log` L142900–142925、143034–143079 | 18120200 / `1b6db814615186e3f53d28e70bc658f0623a5231b55fbf5a7b7d1f57c5b6059b` | boot 后 capability / route 记录；未保存业务 args/result |
| E3 | `control/runtime-evidence.jsonl` L14997、15004、15027、15030–15040 | 12432316 / `e076f268852785e61a02103c9230c18ed0b6f5f7225dea585570b797e60c0f83` | ready/turn/delivery；`summary` 是 Agent 自述，非原始 Workflow event |
| E4 | `control/turn-recovery-v3.json`，以 `records[].handle` 检索 | 8526655 / `fac59e45478e9b47626aa4fc00ce69bf4cfcaace12a69fe9b1dfcaa82bff03d0` | exact turn admission/settlement；不是业务状态库 |
| E5 | `scheduler/jobs.json`，`/occurrences/5598`、`jobs[id=064ea914-…]`、`/fences` | 7889826 / `e7888610e9a5c6713e88e437d76f60059fccfeedb8317c9e5f2edab9f791da67` | occurrence authority；Job lastStatus 只是 summary |
| E6 | `scheduler/runs.jsonl` L40910–40915 | 10485745 / `4e7b967448e0f449b40ae9c6d10535671a8235a63a72f685b7f0cdb7a9e03755` | reserve/admission/start/outcome/delivery；会轮转 |
| E7 | `scheduler/history/events.jsonl` L10567–10571，seq 同行号 | 6344587 / `f63948cabfb72b785dc389a47476f8b0258c9af6c7b6963adab8577767953f99` | Scheduler event，不能当 Workflow 业务 event |
| E8 | `scheduler/history/runs-202611.json /records/2102` | 2396959 / `6527d8e864e3afd8cad4903848e5735daac6edee5ea2b9f24318ef2d1e64b714` | run projection；`result=null,result_recorded=false` |
| E9 | `scheduler/operator-receipts.jsonl`（JSON 文档，物理1行） | 6179 / `ebeff6f92dacf1f961e6a80b366659d1d888811a6502e6fa478990e46c7959b3` | 旧9月收据；目标 occurrence 无命中仅为旁证 |
| E10 | `workflow-execution/attempts.jsonl` L444–446（末尾） | 129985 / `534140ea6fcd90268523f683a4460a10ed97a5c749c3a0beceec6be1af2990d4` | 末条约07:01，不能绑定晚间两批业务；缓存非Svc全量事件库 |

E3 ready 实测：L14997 **13:56:43.508 PID396**；L15004 **15:03:02.498 PID23085**；L15027 **19:35:43.138 PID9036**；L15030 **19:52:19.651 PID16139**。简报中的13:56/15:02为线索，正式时间以这些记录为准。未认证 pack `08102a55` 的 loaded bytes，不把简报安装记录当本轮运行加载证明。以下晚间链使用19:52 boot，E1 L101195与E3 L15030按 PID 对齐。

## ① 19:54 HR `EXECUTE_WORKFLOW_TRANSITION COMPLETED`

| 对账项 | 实测值 / 判定 | 证据坐标 |
|---|---|---|
| 入口与责任主体 | Feishu main M7 ingress；Dispatch-ID `dc062eab-f4ec-4f56-8e02-4b40c14da236`；`agt_hr-agent`，Agent PID16690；不是自然 Scheduler 槽 | E2 L142910–142914 |
| exact turn | `turn:db8d8d0d-1ef5-4e36-8749-799eb6f9de28:a2:g72:s3586`；session=`main`；prompt=`req-72-2`；message=`244c968f-2776-45f2-87a4-a085b3849945` | E4 `records[handle=上述值]`，快照 `/records/5317` |
| 时间 / turn前后 | 创建19:53:36.425（1794138816425）→settled19:54:22.819（1794138862819）；`admitted=true,outcome=completed,state=settled`，`exact_turn_end_success / exact_terminal_then_idle` | E4 同 selector；E2 L142920–142922 route SUCCESS19:54:22.891、1035B回复 |
| 原始请求 | 能确认 `workflow_execute` capability 被调用；`operation`、workflowInstanceId、transitionDefinitionId、expectedWorkflowStateVersion、submissionPayload、trusted key、Svc request ID **全部 UNKNOWN** | E2 L142915–142919只有调用顺序：dispatch_intents→my_tasks→instance_detail→workflow_execute→assistance_read |
| 原始事件 ID / 类型 | Owner 引述 `EXECUTE_WORKFLOW_TRANSITION COMPLETED`；指定主证未承载原始业务事件，event ID、event time、event actor **UNKNOWN** | E2 L142918不含args/result；E3/E10无可绑定记录 |
| 业务响应逐字段 | HTTP status、code、`assistance_open` 原始值、response body、CAS结果 **UNKNOWN**；不能将引述中的 `assistance_open` 解释为完成转移 | 现有主证只到工具调用/turn；无原始Svc响应 |
| 实例前后状态 / 真实当前状态 / 后继 | 实例ID未取得；source/target nodeVisit、stateVersion前后、当前节点/assignee、后继event及终态 **UNKNOWN** | 缺原始请求→实例精确绑定→Svc detail/history链 |
| 产物 / 输出 | turn回复1035B的 SHA-256=`d79510cdb2902c3559bffd92dbf01dcf11418eb32ef4f0b4c779a02a4ec0a239`；`finalAssistantOutput=null`。业务artifact/输出 **UNKNOWN** | E4 `finalAssistantOutputEvidence`；回复hash不是业务artifact |

结论：**工具调用及 turn 终结已观察，业务转移是否成功仍 UNKNOWN**。按 CTR-003/005，`assistance_open` 是服务端可返回的拒绝码；即使工具外层标为 `COMPLETED`，也须核响应及原始事件，不能提升为合法状态变化。本轮没有证据认定该实例失败、成功或已到后继。

合法补证者：native session 的合法属主/获授权生产日志读取者导出该 call/result 脱敏坐标；随后由拥有现有 `workflow.read` 的 HR 原 Principal或Svc合法管理员，按精确实例读取 detail及完整事件史。候选原始路径为 `/Users/authsvc/.agent-core/homes/agt_hr-agent/sessions/--Users-yanfenma-.openclaw-groups-workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74--/main/session.jsonl`（owner yanfenma）；该路径只是缺口定位，不是本报告业务主证。

## ② 20:26 `adc-backend-dev-v1` 四笔新 `COMPLETED`

下列编号只对应简报所述“四笔”的待核槽位，不是编造的事件序号；目前无法确认顺序或排除引用间重合。

| 待核笔 | 精确实例 ID / definitionVersion | 原始业务事件 ID / actor | 时间 | 合法前状态→后状态（node/visit/version） | artifact / 输出 / 后继 | 证据坐标与判定 |
|---|---|---|---|---|---|---|
| 1 | UNKNOWN / UNKNOWN | UNKNOWN / UNKNOWN | 20:26为Owner线索；精确时间UNKNOWN | UNKNOWN→UNKNOWN | UNKNOWN | 简报§1.2；E2/E3/E4/E10未能逐笔绑定；UNKNOWN |
| 2 | UNKNOWN / UNKNOWN | UNKNOWN / UNKNOWN | 同上 | UNKNOWN→UNKNOWN | UNKNOWN | 同上；UNKNOWN |
| 3 | UNKNOWN / UNKNOWN | UNKNOWN / UNKNOWN | 同上 | UNKNOWN→UNKNOWN | UNKNOWN | 同上；UNKNOWN |
| 4 | UNKNOWN / UNKNOWN | UNKNOWN / UNKNOWN | 同上 | UNKNOWN→UNKNOWN | UNKNOWN | 同上；UNKNOWN |

指定属主证据的探索：E1/E2最新boot后段、E3 L15030起及E10末尾未取得可逐笔绑定的原始业务事件。固定摘录保留的全文件字面计数中，E3大写 `COMPLETED` 为1（历史摘要），不能把它误报为全文件零命中，也不能当作本轮业务事件。E10最后记录为另一个实例 `4a43e23f-5640-4dae-af95-c8b6fb560bcd` 的旧recheck/escalation。E3 L15039含 `adc-backend-dev-v1 21`，属于HR摘要中的active数量，不能替代四笔事件或证明四笔不存在。

E3 L15034于 **20:25:39.682** 记录一次给 `agt_agent-dev-engineer` 的交办 `not_admitted`，旧handle=`turn:74a5adf3-2701-435e-8927-7a56a9530d2f:a40:g84:s397`。它只证明该条新prompt被拒，不能推翻其他执行身份、会话或时间中的四笔业务结果。

合法补证者：Svc-workflow对应实例/事件的授权读取主体，或该实例当前获授权责任人，经现有读路径提供四笔原始请求/结果、event ID、definitionVersion、source/target visit、stateVersion CAS、submission及artifact位置；再核真实当前状态。**缺失证据不是业务零进展。**

## ③ 恢复后自然到期 HR Scheduler occurrence 全链

目标job=`064ea914-5d6e-4a13-93be-13cafa952768`（HR v8）；revision=6；schedule=`every 1800000ms`，anchor=`1791818788888`。nominal与anchor差值除以1800000为整数1290，和持久化natural来源一致。目标 occurrence=`occ:18d2b4ffe491e4b2`，run=`run:occ:18d2b4ffe491e4b2`，request/idempotency=`occ:18d2b4ffe491e4b2`，session=`cron-run-occ:18d2b4ffe491e4b2`。

| 环节 | 实测时间 / 前后状态 / 产物 | 精确事件或身份 | 证据坐标 / 验证结果 |
|---|---|---|---|
| 自然到期 | nominal **20:26:28.888**（1794140788888）；`kind=natural,origin=natural,retryOf=null`；恢复后未来槽 | Scheduler seq10567；payloadHash=`sha256:f6b08c9afe44b973dbebabbfe43b56813da8126ec26cef98bfcaf194e9f2d1f6` | E5 `/occurrences/5598`；E7 L10567。自然来源已证，不用“未查到run-now”替代 |
| 触发 / durable reserve | **20:51:18.222**（1794142278222），无记录→`admitted`，reason=`natural occurrence reserved` | 同occ/run；history记录落盘20:51:18.620 | E6 L40910；E5 history[0]；E7 L10567。迟于nominal **24分49.334秒**，具体延迟原因UNKNOWN |
| Router admission attempt | **20:51:18.649**（1794142278649） | 同occ/run/request | E6 L40911，已证attempt |
| Agent turn start | **20:51:18.723**（1794142278723），`admitted→running` | handle=`turn:db8d8d0d-1ef5-4e36-8749-799eb6f9de28:a2:g72:s3592`；prompt=`req-72-101`；message=`5a19ee94-9043-4a9e-854d-ebb052d2de51` | E6 L40912；E4对应handle `/records/5325`。E7 L10568在20:51:19.029记录running，不能覆盖exact start |
| HR扫描调用 | 同session创建后5次global_instances、6次resolve_principal、7次instance_detail | capability调用记录；未携带各call的业务返回event ID | E2 L143059–143077。扫描动作已证；返回字段及84张/7候选仅E3 L15039自述 |
| exact turn终结 / admission receipt | turn settled **20:54:05.560**；route success **20:54:05.625/626**；accepted回执落盘 **20:54:05.628** | E4=`completed/settled,exact_turn_end_success,exact_terminal_then_idle`；终结回执非业务事件 | E4；E2 L143078–143079；E6 L40913。accepted的记录时间晚于start，不能误作开始时间 |
| Scheduler outcome / delivery | **20:54:08.823**，`running→succeeded`；`executionOutcome=succeeded,deliveryStatus=delivered` | Scheduler seq10569–10571；E8 `result=null,result_recorded=false` | E5/E6 L40914–40915；E7 L10569–10571；E8 `/records/2102`。只验证执行/送达 |
| 原业务合法后继 | 业务实例精确ID、Workflow event ID、前后业务状态、业务artifact **UNKNOWN**；不能给全链PASS | E3摘要自述“计划7、实际派发0”，原因dispatch读取agents.json PermissionError；没有原始业务事件绑定 | E3 L15039是失败线索，不能将其自述提升为全量零进展或权威失败归因 |

**判定：自然到期→reserve→Router→exact turn→扫描动作已证；扫描返回与原业务合法后继未证，业务全链验证未通过。** Scheduler succeeded、delivery delivered、Agent存活或只读扫描成功都不替代最后一环。E9无目标ID匹配只是探索空结果。此自然槽的20:26 nominal也不等于②四笔COMPLETED的业务事件时间。

## ④ 仍未继续的合法业务清单、责任人、触发与恢复路径

此清单分清“主证确认的运行阻塞”和“HR摘要指向的业务待核项”。**无法取得Svc detail/history，因此没有权威的全量未继续业务清单，也不能把自述ACTIONABLE_NOW当作执行许可。** 下面逐项保留责任人证据等级；省略号是源文本原有截断，未补造完整UUID。合法性、当前责任人与是否已在摘要后继续，仍须Svc fresh-read；恢复路径是下一步条件，不是本轮执行授权。

### 已确认的运行阻塞与读证缺口

| 项目 / 原始身份 | 实际责任人（证据等级） | 仍未继续 / 失败事实与坐标 | 下一触发机制 | 合法恢复路径 |
|---|---|---|---|---|
| dev旧turn `turn:74a5adf3-2701-435e-8927-7a56a9530d2f:a40:g84:s397`，session main | `agt_agent-dev-engineer`（E4确切Agent）；修复actor为Owner授权运维，具体人UNKNOWN | E4 `blocked/pending,runtime_restart_ownership_unavailable,terminationEvidence=null,missing live_generation_ownership`；E3 L15034真实拒绝新prompt | 当前新交办被admission拒绝；没有证明可自动恢复的触发 | 授权运维恢复exact ownership并核旧turn及已派工具的终止/副作用，再按已接受受控路径处置；fresh-read真实业务后由其当前assignee继续。不得重放旧turn/盲清fence |
| HR L2 job `cdcba8f3-b961-417a-86b4-bd47735bf1dd` / `occ:03a22a610f0f57f4` | job owner=`agt_hr-agent`（E5）；旧turn gen70 | E5 `/fences[该job]`存在；occ=`outcome_unknown`；E4旧handle s3581=`blocked/pending`且Router fenceState=cleared。两个投影不能互相抹消 | 同job自然后继受Scheduler fence约束；具体下一准入时刻UNKNOWN | 由合法operator按exact occurrence查终止与业务结果；只有符合现有reconcile条件的证据才结算。Router cleared不证明Scheduler可运行，不代本轮清fence |
| HR L0 job `aefae23a-a59e-4069-96c6-6586a752469b` / `occ:b06ed5982d4e8af0` | job owner=`agt_hr-agent`（E5） | E5该occ及fence仍`outcome_unknown`，无terminationSettlement | 同job自然槽不能据enabled/存活判定已继续 | 同上，保留业务UNKNOWN；心跳即使恢复也不证明原业务恢复 |
| M7派发路径 | 本轮扫描actor=`agt_hr-agent`（E3/E4）；权限修复实际actor UNKNOWN，需授权运维承担 | E3 L15037/L15039自述dispatch PermissionError；E2证明扫描但不保存dispatch异常原文 | HR v8已存在自然every30min；不是承诺任一未来槽必可派发 | 先由日志合法属主导出原始失败回执并核实际运行UID/只读权限，再走现有批准的修复路径；之后自然槽fresh-read节点→正式dispatch→精确摄入→Svc业务event。不得手写旁路消息 |
| ①与②原始业务证据 | native日志合法属主；Svc `workflow.read`合法Principal/管理员（确切执行人UNKNOWN） | 原始事件/响应缺失；两次匿名GET401，见下表 | 现有授权只读导出机制；本轮没有为补证而发新Agent turn | 提供精确call/result和实例完整事件史，按event而非updated_at判断后继；未取到前保留UNKNOWN |

### HR L3 摘要列明的10项业务（候选清单，当前状态/真实assignee未获Svc核实）

共同主证坐标为 **E3 L15037（20:26:19.660）summary**；该摘要明确区分责任人和缺失证据，仍属于线索，不能证明摘要之后没有进展。

| 实例线索 / 业务 | 摘要所列责任人；实际当前owner | 未继续的线索 | 下一触发 | 恢复路径 / 必须读回 |
|---|---|---|---|---|
| `728b64a6…` Definition修复 | `agt_cto-agent`；当前UNKNOWN | 缺Definition修复，摘要最近事件11-02 12:35 | E3 L15036已接收CTO prompt，但无绑定业务结果；未来触发UNKNOWN | CTO依法fresh-read自身节点，交付修复及Svc receipt；不能以消息accepted结案 |
| `bd8c5b18…` M20 delivery | `agt_agent-dev-engineer`；当前UNKNOWN | E2E delivery/Workflow receipt缺 | dev新prompt被拒；待exact恢复后合法新触发 | 先解决上表admission，核真实下游receipt再由assignee继续 |
| `52bd45aa…` M1-M6/D1-D9 | 同上 | 实现、测试、隔离readback缺 | 同上 | 实现/测试/readback产物与Svc事件绑定后继续 |
| `0bb10100…` 60-stuck治理 | 同上 | 逐实例处置、观察快照缺 | 同上；亦为M7候选 | 对每实例核真实事件/合法处置，不能批量投影代结案 |
| `a2afbd43…` M1-M6机制修复 | 同上 | commit、单测、隔离证据缺 | 同上 | 提交可复核产物及原业务transition receipt |
| `e086d50e…` D14 plugin mismatch | 同上 | 真实spawn/receipt/transition缺 | 同上 | 核源、安装/加载、实际spawn和Svc业务变化，各层分别证实 |
| `023a28ff…` 无人值守续轮 | `agt_arch-reviewer`；当前UNKNOWN | E2E/source-proof缺 | E3 L15035接受arch prompt；精确业务后继UNKNOWN | 责任人fresh-read并交付source-proof/合法业务event；投递不替代完成 |
| `36403d46…` single_platform修订 | 同上 | 发布/存量CAS receipts缺 | 同上 | 由合法actor执行既有路径并读回CAS/发布事实，未授权不发布 |
| `3cdff891…` delivery EACCES | 同上 | build/canary/readback缺 | 同上 | 区分源码修复和实际受控canary/读回，不以build代生产验收 |
| `0e31f767…` admission单点依赖 | 同上 | 实现、failover/canary证据缺 | 同上 | 由当前assignee给实现及既有授权下的隔离/运行证据 |

E2 L143050–143053还观察到arch `workflow_execute`调用，**没有参数/结果**，故既不能记为这些业务已完成，也不能用L3“无新增done”覆盖随后可能发生的事件。CTO assistance_request调用同理（E2 L143054）。

### HR M7自然槽列明的7个候选精确度缺口

共同坐标 **E3 L15039（20:54:05.627）summary**；所有当前assignee、合法可执行状态、业务event及前后状态均UNKNOWN。

| 摘要实例 / nodeVisit线索 | 业务 | 实际责任人 | 下一触发 / 恢复路径 |
|---|---|---|---|
| `2a5c8a00…ab6f / 2561ce5d…a9bb` | 内容发布 | UNKNOWN；由Svc detail给出 | M7既有自然槽；先核dispatch失败及精确节点，再由正式dispatch到合法assignee |
| `e6b49415…2d8 / ad95e399…6bf0` | ADC | UNKNOWN | 同上；不能与②四笔凭definition名称拼接 |
| `4ac69c1c…3d66 / 5bc6a659…ac34` | 机制/定义 | UNKNOWN | 同上；探索GET401不证明实例状态 |
| `97cbc554…4d90 / 78ba3034…0f39` | family-education conduct | UNKNOWN | 同上 |
| `938ecac8…10ba / 9972fce7…2c3e` | idea_pool | UNKNOWN | 同上 |
| `0bb10100…43b9 / dcf6ec3a…9977` | 机制 | UNKNOWN；L3同前缀列dev，未做完整UUID/visit联结 | 同上；不按前缀合并身份 |
| `8197537d…0efe / ab688552…7611` | 内容分发 | UNKNOWN | 同上 |

E3 L15033另报 `d6f5a17a… step_3`、`7cd02846… deploying` 为active/ACTIONABLE_NOW，但截断ID、实际owner、最近业务event、下一执行触发均UNKNOWN；其Canary只读job `3050573b-c285-4c30-a3c9-e1236a9a08ee`下一扫描投影21:34:56.410不构成业务推进。E3 L15031还报4个HR自负责meta实例缺execute scope及assistance `OWNER_PENDING 5 / HUMAN_REQUIRED 2`，未给精确实例/责任人，因此只能列为待Svc补全的未枚举集合，不能授权HR代推进/resolve。M7自报84 active对61基线多23也未获原始全量读回，**本清单不声称覆盖全部84或全部合法未继续业务**。

## 接口失败、429与停止边界

| 时间（UTC） | 本轮只读请求 | 实测结果 | 正确解释 / 合法读取者 |
|---|---|---|---|
| 13:21:57 | `GET http://127.0.0.1:8989/internal/v1/workflow-instances/4ac69c1c-9adf-4278-8df2-a5c8f0d94366`（探索实例，不冒充①目标） | 401，`unauthenticated / bearer token is required`；x-request-id=`7e255d5b-b6ef-4466-be2b-9fd2e3fc2aee` | 接口失败/无凭据，实例业务状态UNKNOWN；现有workflow.read主体可合法读取 |
| 13:23:02 | `GET http://127.0.0.1:8989/internal/v1/workflow-instances/global?status=active&limit=100` | 401；`{"error":{"code":"unauthenticated","message":"bearer token is required"}}`；x-request-id=`f06ed237-7ce0-4c16-a1c1-a5ec7613910a` | 无全量读回；不得写成active=0或业务零进展 |

本轮两个探针实测是401，未遇429。E2固定快照L142900至末尾143095检索字面 `429 / rate_limit / Too Many Requests` 无匹配；这仅是**该段日志可见性**，不证明Svc、模型或native轨迹中不存在429。若后续读回出现429，必须记录接口、时间、request ID、响应及重试限制，继续保留既有进展事实，不能改写成“没有业务进展”。

原始必读简报及指定属主源可读取，故交付本四项UNKNOWN对账报告；没有把探索空结果写为STOPPED。受限数据、合法读取者和最小补证已逐项列出。**业务恢复未验收；不代Owner修复权限、重试旧请求、合并PR或继续扩大生产动作。**

## 交付与验证

文档/证据改动，无产品代码或配置变更，不运行无关产品测试。交付前检查：JSON解析、选段逐行hash、源owner、自然槽身份/时间/状态一致性、四项表格/缺口完备性、`git diff --check`及独立证据审阅。评审结果与最终commit/PR坐标记录在PR；本文件不通过自引用commit/hash伪造交付事实。执行 commit→push→PR(base=`main`)，**不合并**；PR交付与无人值守真实业务验收分别报告。
