# ISSUE-TRIAGE-20261109 — 四仓 open issue 逐项甄别

本轮基线为 76 项：**CLOSE 1 / KEEP 75**。简报标题“70”与四仓分项相加不符；实时全量结果是 30 + 40 + 6 + 0 = 76。CLOSE 低于预期 5–15；该预期不作为配额，缺证、有效业务、人类门、发布验收和活跃提案均保留。

## 授权、路线与执行边界

- 授权：Owner 2026-11-09“先执行甄别”及常设授权③；[原始简报](BRIEF-ISSUE-TRIAGE.md) 原文保留，SHA-256 `a08d8201540c0f1ebd333dbd5d55886ea4d41c21342e3f3b592731e93d51db6b`。关闭限于核实完成/过时的 GitHub 生命周期操作，每笔附至少两行依据及可重开声明。
- `schema_version=2; MODE=PREFLIGHT; AUTHORITY_ACTION=REUSE; PLAN_LEVEL=BRIEF; ASSURANCE_LEVEL=DURABLE; ROUTE_STAGE=OPERATION`。现有本地 accepted governance V3 为工作约束；本轮不创建或改写产品 Contract，`IMPLEMENTATION_AUTHORITY=not_applicable`。执行授权有效，独立复核后逐笔操作。
- 工作位：`/Users/yanfenma/workspace/project/worktrees/ops-issue-triage`；隔离分支 `ops/issue-triage-20261109`；`BASE_HEAD=6ad69d1fa6fa8c7dcfb3b5b61207c7d21a80ecef`。只提交简报与本报告，push、开 base-main PR，不合并。
- 全部本轮 `gh` 调用由 Root 串行执行；三个独立只读分析者只消费捕获文件及固定 Git 对象。没有向生产 Agent 派发任务、代码/Spec 实现、生产读取/写入、身份切换、重启或发布。
- Done When：四仓全量 list、76 项逐项 view/分类、充分证据项带说明关闭并回读、全清单提交/push/PR。Expansion Trigger：新活动或证据冲突使关闭依据不充分则保留；仅持续 gh API 失败停受影响操作，探索空结果不算失败。

## 采样与核实方法

首次采集开始：`2026-11-08T23:34:13.734164+00:00`；下表 main 是各仓只读核实坐标。全量 `--limit 1000` 均未触顶；对列表每个编号均独立执行 `gh issue view`，共 76 项及 2036 条评论捕获。正文、当前实质回执和引用的交付状态逐项核对；超长历史线程以逐条元数据/证据索引定位有效回执，未把历史活动视为闭环。CLOSE 另完整核读原范围及负载证据，交叉核查合并 PR、祖先关系和固定 main 文件。

```sh
gh issue list --repo mayf3/<repo> --state open --limit 1000 --json number,title,url,updatedAt,createdAt,labels,assignees
gh issue view <n> --repo mayf3/<repo> --json number,title,url,body,state,createdAt,updatedAt,closedAt,labels,assignees,comments,closedByPullRequestsReferences
gh pr list --repo mayf3/<repo> --state open --limit 1000 --json number,title,url,headRefName,headRefOid,baseRefName,updatedAt
gh pr list --repo mayf3/<repo> --state merged --limit 200 --json number,title,url,body,mergedAt,mergeCommit,baseRefName
```

PR 列表用于交叉核查，未将近 200 个 merged PR 当完整历史；关闭候选另定向 `pr view`。auth-service 的 0 项是有效结果。采集中两次 `unexpected EOF`（Core #383 view、agent-control merged PR list）均单次重读成功，无持续 gh API 失败；其余空搜索不作错误判定。既有测试结果只引用固定回执，本轮未重跑产品测试。

| 仓库 | 核实 main SHA | 初始 OPEN | CLOSE | KEEP |
|---|---|---:|---:|---:|
| [mayf3/agent-control](https://github.com/mayf3/agent-control) | `3fdebbefe84cd01331f14979fd6d5f0b78e92274` | 30 | 1 | 29 |
| [mayf3/dsh-agent-core](https://github.com/mayf3/dsh-agent-core) | `6ad69d1fa6fa8c7dcfb3b5b61207c7d21a80ecef` | 40 | 0 | 40 |
| [mayf3/svc-workflow](https://github.com/mayf3/svc-workflow) | `b5096782f666ad22aa3508fdbf9562278a977c0f` | 6 | 0 | 6 |
| [mayf3/auth-service](https://github.com/mayf3/auth-service) | `2228195f53d603a961b033bdcd600ec5a83ba12d` | 0 | 0 | 0 |

## 关闭依据及逐笔执行回执

状态：独立受影响范围复核 **PASS（0 blocker）** 后，已逐笔执行唯一关闭；关闭前再读原文/评论与初始捕获一致，关闭后回读状态及发布正文匹配。

### mayf3/agent-control #1364

[原 issue](https://github.com/mayf3/agent-control/issues/1364)；下文为[已发布关闭说明](https://github.com/mayf3/agent-control/issues/1364#issuecomment-6728824601)原文：

按 2026-11-09 四仓逐项甄别及常设授权③，将本单已完成的有限源码缺陷关闭。
依据 1：Core [PR #652](https://github.com/mayf3/dsh-agent-core/pull/652) 已于 2026-11-07 合入 main，merge SHA `2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`；区分有限扫描/失败/实际新准入预算，并保留跨轮公平轮转、WAL、去重及 UNKNOWN 边界。该合并为当前核实 main `6ad69d1fa6fa8c7dcfb3b5b61207c7d21a80ecef` 的祖先。
依据 2：[固定版本交付回执](https://github.com/mayf3/dsh-agent-core/blob/9ac64282de67d954b27708ba5796b838e8b55034/RECEIPT-1364-BUDGET.md) 保留同一反例 RED→GREEN 7/7、250 异常前缀跨页轮转、整合回归 265/265 rc0 及独立审查；[本单监管验收](https://github.com/mayf3/agent-control/issues/1364#issuecomment-6705149367) 明确源码范围完成，生产加载/业务见证不属本单验收。
可重开：若同一有限预算/公平性缺陷仍可复现，或上述证据未覆盖原验收条件，可随时重新打开并附反例；本关闭不结清父 #1374 或其他运行/业务验收项。

实际动作：`gh issue comment 1364 --repo mayf3/agent-control --body-file <reviewed-file>` rc0 → `gh issue close 1364 --repo mayf3/agent-control --reason completed` rc0 → `gh issue view` 回读 `CLOSED`，`closedAt=2026-11-08T23:43:10Z`（北京时间 2026-11-09 07:43:10）。发布正文 SHA-256 `a174f2e6cfae5093dadee53c6fd3793023966cb66be00271fdeaeabda4bd8465` 与独审文件逐字一致。

### 独立复核后的保守收窄

svc-workflow #80 原列候选：10-22 有角色交付/读200写403回执，但更晚的 [PR #113](https://github.com/mayf3/svc-workflow/pull/113)（11-01）明确部署 35c3b685 缺 auditor 可见性、HR detail 返回404/not_visible。PR 合入与当前 main 含实现不足以单独证明该次运行回归恢复，现有材料缺更晚对应生产读回。因此改为 **KEEP**，未发布关闭评论、未关闭；不以旧 PASS 覆盖较新相反观察。

## 四仓全清单

每项 KEEP 后附当前现状及一处可读证据；没有额外给 KEEP 发评论。编号集合严格对应首次全量 list，后续并发变化另记。

### mayf3/agent-control（30 项）

| Issue | 结论 | 一行现状 / 依据 |
|---|---|---|
| [#1386](https://github.com/mayf3/agent-control/issues/1386) [P1][SESSION-RESUME] 长驻旧会话 inbox splice 缺锚导致 CTO 投递拒绝：安全重锚／接续与防重 | **KEEP** | 陈旧 session inbox 缺锚的精确 RED→最小修复→GREEN、独立 QA 与原请求合法接续尚无交付，近期有效工程单。 [证据](https://github.com/mayf3/agent-control/issues/1386) |
| [#1384](https://github.com/mayf3/agent-control/issues/1384) [P0][HARNESS-SESSION] 长寿命会话自动 Compaction 未生效：headless 交付路径缺压力检查与溢出钩子（CTO/HR 连续 CONTEXT_WINDOW_EXCEEDED 实证） | **KEEP** | headless compaction 触发/溢出有界恢复及 CTO/HR 真实成功回合仍缺完整交付；外科恢复不等于自动机制完成。 [证据](https://github.com/mayf3/agent-control/issues/1384) |
| [#1383](https://github.com/mayf3/agent-control/issues/1383) [P1][ACCEPTANCE] 最小无人值守纵向验收：业务提交→503→控制器重启→自动读回，零重复业务效果（父 #1374） | **KEEP** | 业务提交→503→真实控制器重启→正式调度自动读回且效果计数1的最小纵向验收尚无结果回执。 [证据](https://github.com/mayf3/agent-control/issues/1383) |
| [#1381](https://github.com/mayf3/agent-control/issues/1381) [P2][R3-09] READY due 分页避免每页全量重算：保留公平性和就绪前过滤（父 #1374） | **KEEP** | READY due 分页 N/M/B 计数、性能收益和公平性回归尚未交付；外部源码参考不等于本系统验证。 [证据](https://github.com/mayf3/agent-control/issues/1381#issuecomment-6645142218) |
| [#1380](https://github.com/mayf3/agent-control/issues/1380) [P1-B][R3-08] 跨 attempt 的业务效果安全：稳定 operation identity、幂等读回与 UNKNOWN 边界（父 #1374） | **KEEP** | 跨 attempt 稳定 operation identity、效果读回/去重及 UNKNOWN 矩阵尚无选定受支持入口的完整纵向交付。 [证据](https://github.com/mayf3/agent-control/issues/1380#issuecomment-6645130804) |
| [#1379](https://github.com/mayf3/agent-control/issues/1379) [P1-A][R3-07] Owner wake 的传输 ACK 与业务责任分离：失败后监测、接续及人类门交接（父 #1374） | **KEEP** | Owner wake ACK 与实际业务责任分离/治理回接仍有未交付缺口；最近凭据接线与生产旧源码采样回执均不支持业务恢复完成。 [证据](https://github.com/mayf3/agent-control/issues/1379#issuecomment-6716233929) |
| [#1378](https://github.com/mayf3/agent-control/issues/1378) [P1-A][R3-06] Owner obligation 不失责：单候选错误隔离与 STOPPED/BLOCKED_KNOWN 合法后继（父 #1374） | **KEEP** | Owner producer 逐候选错误隔离及 STOPPED/BLOCKED_KNOWN 合法后继尚无真实隔离 PG 公平性/持久恢复的完整交付证据。 [证据](https://github.com/mayf3/agent-control/issues/1378) |
| [#1377](https://github.com/mayf3/agent-control/issues/1377) [P0-B2/B3][R3-03/04] 将 blocked/planned 的合法恢复接回持久自动触发，避免等待人工继续（父 #1374） | **KEEP** | blocked 半 PR #644 已合并；ordinary planned 合法续接与 RTH 配套完整实现/验收仍缺，文档 PR #658/#664 合入不等于整单交付。 [证据](https://github.com/mayf3/dsh-agent-core/pull/664) |
| [#1376](https://github.com/mayf3/agent-control/issues/1376) [P0-B1/B4][R3-02/05] 保留结果观察责任：临时读回失败、基线缺失和同 visit 版本变化不得永久失活（父 #1374） | **KEEP** | RTH 配套文档 PR #664/#658 已合入，但临时503再观察、缺失基线和同 visit version 变化的持续观察责任仍无完整实现/验收交付。 [证据](https://github.com/mayf3/dsh-agent-core/pull/658) |
| [#1374](https://github.com/mayf3/agent-control/issues/1374) [EXEC-KERNEL][TRACKING] Execution Kernel Reliability V1——多 Agent 无人值守执行内核可靠性任务书（S1/L1/L2/E1 + P0×2 + P1×2） | **KEEP** | Execution Kernel 父任务仍有 503/ordinary planned/Owner 活性/业务效果等未完成切片；最新全量任务与 Human 门实证仍要求实际原业务后继。 [证据](https://github.com/mayf3/agent-control/issues/1374#issuecomment-6728671969) |
| [#1372](https://github.com/mayf3/agent-control/issues/1372) [P3][CAP-D09] 默认能力表含 fixture 操作与已退役写操作描述（追踪 #1363 D09） | **KEEP** | 默认能力表的 fixture/退役 writer 描述清理仍缺受支持消费者盘点与完整修复证明。 [证据](https://github.com/mayf3/agent-control/issues/1372) |
| [#1369](https://github.com/mayf3/agent-control/issues/1369) [P2][DEPLOY-D06] 重启函数用固定主机路径覆盖传入部署配置（追踪 #1363 D06） | **KEEP** | restart 固定主机路径覆盖 ctx/layout 配置的缺陷尚无参数化或明确限域校验交付证明。 [证据](https://github.com/mayf3/agent-control/issues/1369) |
| [#1368](https://github.com/mayf3/agent-control/issues/1368) [P2][COMPOSE-D05] Node 精确版本+代理变量门禁放大为全局启动限制（追踪 #1363 D05） | **KEEP** | compose 无条件精确 Node/代理环境门禁的产品范围问题尚无已交付修复或无需修改的充分现状证明。 [证据](https://github.com/mayf3/agent-control/issues/1368) |
| [#1364](https://github.com/mayf3/agent-control/issues/1364) [P1][WF-D01] 无效预检消耗准入预算：前 25 条异常饿死第 26 条正常任务（三轮隔离复现）（追踪 #1363 D01） | **CLOSE** | 有限准入预算公平性源码缺陷已由 Core PR #652 完整修复并合 main；同反例 RED→GREEN 7/7，整合回归265/265，独审通过。 [证据](https://github.com/mayf3/dsh-agent-core/blob/6ad69d1fa6fa8c7dcfb3b5b61207c7d21a80ecef/packages/workflow-execution/src/ledger-admission.js#L14-L57) |
| [#1357](https://github.com/mayf3/agent-control/issues/1357) [P1][WATCHDOG-H03] transport-watchdog 日志驱动 SIGKILL 构成第二进程管理者（30s 注册运行中）（追踪 #1354 H03） | **KEEP** | 外置 30s 日志驱动 SIGKILL 管理者尚无退役回执；Router 内置路径存在不能证明第二 kill 权威已移除。 [证据](https://github.com/mayf3/agent-control/issues/1357) |
| [#1356](https://github.com/mayf3/agent-control/issues/1356) [P1][FENCE-H02] 外置 fence-janitor 子串匹配+缺记录/仅终止判 failed（900s 注册运行中）（追踪 #1354 H02） | **KEEP** | 外置 fence-janitor 错判 UNKNOWN 的现场启用事实未有退役/正确内置替代的 fresh 生命周期证据；main 修复不等于现场纠正。 [证据](https://github.com/mayf3/agent-control/issues/1356) |
| [#1352](https://github.com/mayf3/agent-control/issues/1352) [MECHANISM] 两个机制缺口：实例创建时输入契约未强制 + 卡住时不会自动升级到人类 | **KEEP** | Owner 通知/resolve/24h 意向已裁定；B 项 PR #1353 仍 proposed 接受链，A 项诊断清单随其接续，不能关闭。 [证据](https://github.com/mayf3/agent-control/issues/1352#issuecomment-6716361130) |
| [#1351](https://github.com/mayf3/agent-control/issues/1351) [PROD-BREAKFIX GHOST] agent 离册不留债：删除前 holdings 门禁 + 幽灵身份巡检 + 域 owner 活性校验 + 离职过户 runbook | **KEEP** | 删除/离册 holdings 门禁、含 role 的幽灵巡检、owner 活性校验和过户 runbook 四道闸仍在 backlog，未完整实现。 [证据](https://github.com/mayf3/agent-control/issues/1351#issuecomment-6716360936) |
| [#1349](https://github.com/mayf3/agent-control/issues/1349) [PROD-BREAKFIX M1-M6] M1-M6 机制实现 Spec 立项 + 实现授权（dev worktree 已就绪，生产 8 张 adc 单冻结等待） | **KEEP** | Spec #1350 已接受合并并解除开工闸；最新称 dev 已真实实施，未见原八单 dev_self_check→QA/架构审查完整流转验收。 [证据](https://github.com/mayf3/agent-control/issues/1349#issuecomment-6564539783) |
| [#1345](https://github.com/mayf3/agent-control/issues/1345) [PROD-BREAKFIX D14] agent spawn plugin_version_mismatch：版本对齐 + 发布流程防护（Owner 批评立案） | **KEEP** | 0.2.3 回滚恢复了 spawn，但 Owner 同时要求的版本钉与舰队滚动同源流程防护仅留作休眠框架，尚无完整交付。 [证据](https://github.com/mayf3/agent-control/issues/1345#issuecomment-6555192473) |
| [#1277](https://github.com/mayf3/agent-control/issues/1277) [PLAN/HANDOFF] canonical 身份收敛与 legacy 执行逻辑退役：复用 #82、先隔离实现，禁止生产改动 | **KEEP** | T1/T2 已有合并与生产行为回执；最新明确只余 T3 合同停点 PR #591 与 T4/T5，整单未齐。 [证据](https://github.com/mayf3/agent-control/issues/1277#issuecomment-6584468488) |
| [#1248](https://github.com/mayf3/agent-control/issues/1248) [memory] HR 记忆治理第一批：inspect、历史检索与幂等归并（Spec 提案） | **KEEP** | M1/M2 源码已交付；issue 明确保留 M3（幂等写入口/受控单 writer 切换）及实际安装/加载/行为验收。 [证据](https://github.com/mayf3/agent-control/issues/1248#issuecomment-6544233545) |
| [#960](https://github.com/mayf3/agent-control/issues/960) [BUG] 本地 Codex read_thread 返回 -32000，目标状态读取未恢复 | **KEEP** | 2026-11-03 调查因原 native 入口不可调用而停止；原 target 的同参数成功只读状态返回仍无证据。 [证据](https://github.com/mayf3/agent-control/issues/960#issuecomment-6607764275) |
| [#895](https://github.com/mayf3/agent-control/issues/895) [bug] controller解析失败缺少阶段与来源证据 | **KEEP** | SOURCE PR #900 已合并，但当前正文仍保留正式安装/加载阻塞，CURRENT_LOADED=UNKNOWN，未证明运行诊断能力生效。 [证据](https://github.com/mayf3/agent-control/issues/895) |
| [#801](https://github.com/mayf3/agent-control/issues/801) [缺陷] 通用 Agent 基础身份发现与 AgentID / Principal 双向解析 | **KEEP** | 身份解析实现已存在；原 caller 的 canonical→Principal 工具暴露缺口、实际 loaded build 和真实查询验收仍缺。 [证据](https://github.com/mayf3/agent-control/issues/801#issuecomment-6099229852) |
| [#726](https://github.com/mayf3/agent-control/issues/726) 闭环改造 4/4：用现有 Workflow＋Forum 跑通一次复盘到效果验证 | **KEEP** | 离线 SOURCE PR #831 已合并，但真实 Workflow/Forum 发布、试点启用、自然效果验收尚未完成。 [证据](https://github.com/mayf3/agent-control/issues/726#issuecomment-6101235665) |
| [#725](https://github.com/mayf3/agent-control/issues/725) 闭环改造 3/4：Fixed Operation 异步完成与回执边界，保持现有同步接口 | **KEEP** | 异步实现 PR #502 的 accepted Contract 映射及 P1 disposition 尚无闭合证明，不能以 Promise 测试替代接口权威。 [证据](https://github.com/mayf3/agent-control/issues/725#issuecomment-6115396708) |
| [#724](https://github.com/mayf3/agent-control/issues/724) 闭环改造 2/4：解释并减少 run_ended_no_submission，不另建重试器 | **KEEP** | 诊断源码 PR #500 已合并；最新回填明确“减少 run_ended_no_submission”的业务收敛验证仍待 MRDP 后续。 [证据](https://github.com/mayf3/agent-control/issues/724#issuecomment-6544865980) |
| [#681](https://github.com/mayf3/agent-control/issues/681) 发布输入缺少精确产物绑定：后续原 Definition 图验收项 | **KEEP** | 发布 payload 到实际审核产物的不可变 artifact/version/hash 绑定仍缺；历史输入来源和批准保持 UNKNOWN。 [证据](https://github.com/mayf3/agent-control/issues/681#issuecomment-6071352649) |
| [#547](https://github.com/mayf3/agent-control/issues/547) HR 自身周期调度持续运行与安全自恢复（复用普通调度恢复） | **KEEP** | R129-D 六文件安装/重启/health 已核；最新仍有精确发布溯源与可加载回退 GAP，自然 HR 业务推进 UNVERIFIED，持续自愈未验收。 [证据](https://github.com/mayf3/agent-control/issues/547#issuecomment-6718592213) |

### mayf3/dsh-agent-core（40 项）

| Issue | 结论 | 一行现状 / 依据 |
|---|---|---|
| [#605](https://github.com/mayf3/dsh-agent-core/issues/605) [DEPLOY] ce1d13c1 舰队滚动四缺口清单（2026-11-02 窗口事故）+ canary 先行要求 | **KEEP** | 四缺口/canary 已吸收进 SOP，#646 兼容 reader/writer guard 源码完成；W6 mandate #629 仍 OPEN，尚缺本发布链完整 installed/loaded/生产验收回执。 [证据](https://github.com/mayf3/dsh-agent-core/issues/605#issuecomment-6702484011) |
| [#554](https://github.com/mayf3/dsh-agent-core/issues/554) [P1] history 监听器 bind 失败杀死整个 runtime（admission core 陪葬）+ admission 单点依赖辅 runtime 的终态方案 | **KEEP** | A 面 containment #555 已交付；B 面 admission 终态迁移/aux 退出及 failover/canary 仍未验，#609 提案仍 OPEN，不以 A 面完成关闭整单。 [证据](https://github.com/mayf3/dsh-agent-core/issues/554#issuecomment-6705755897) |
| [#552](https://github.com/mayf3/dsh-agent-core/issues/552) [P1] 共享 codex 凭据库轮换后对 fleet worker（uid 502）不可读：store-writer 模式契约缺失 | **KEEP** | reader-owner writer 修复 #553 已合，release-prep #556 仍 OPEN；原发布链的精确接线、真实轮换 A1–A6 与 loaded/business 验收未证。 [证据](https://github.com/mayf3/dsh-agent-core/issues/552#issuecomment-6552309837) |
| [#546](https://github.com/mayf3/dsh-agent-core/issues/546) 调度器事故新形态：部署窗口后 router 进程注册 stale 无自愈 + queued-but-never-materialized turn 无法被 self_ops 结算（HR 派发器 2026-10-21 实证） | **KEEP** | D1 源码部分已合；D2 never-materialized 正向终止证据在 accepted C-040/CTR-V3-RECON-002 仍未证明获授权，且真实闭环验收未证。 [证据](https://github.com/mayf3/dsh-agent-core/issues/546#issuecomment-6604539984) |
| [#545](https://github.com/mayf3/dsh-agent-core/issues/545) [PRODUCT] 启用 execution_history_audit_query 作为 HR 跨 agent 只读查询工具：部署含 execution-history 的构建到生产 runtime + 物化 audit 授权（替代 B 档裸文件读） | **KEEP** | Auth #95 接受合同、#96 实现已合；但真实 HR audit 授权、目标 generation 脱敏跨 agent 查询、拒绝负例及 B 档裸文件桥退役的完整验收未证，旧 #94 未接受阻点已解除。 [Auth交付与未执行范围](https://github.com/mayf3/auth-service/pull/96) |
| [#525](https://github.com/mayf3/dsh-agent-core/issues/525) [PRODUCT] 部署缝加固：fail-closed 故障静默积累（10-08~10-19 三起事故复盘）——接线探针/告警/错误可操作性 | **KEEP** | #604 源码已合，#605 发布尝试曾回滚；缺当前生产接线/跨服务 admission 探针与业务闭环的完整验收，保留既有发布责任。 [证据](https://github.com/mayf3/dsh-agent-core/issues/525#issuecomment-6575916674) |
| [#490](https://github.com/mayf3/dsh-agent-core/issues/490) [PRODUCT E14-F1] 跨任务 A→B 调度交接耗时与空窗归因 | **KEEP** | 自然 #1326→#1327 全 18-stage 原始链已存在、anchor 修复 PR1340 已合；新 loaded reader 的 ≥1 PROVABLE 全链、receipt-credit split 与分代 before/after 指标未验。 [证据](https://github.com/mayf3/dsh-agent-core/issues/490#issuecomment-6591610951) |
| [#484](https://github.com/mayf3/dsh-agent-core/issues/484) [PRODUCT G11] Mobile/Tailnet shared-backend path closure | **KEEP** | 仍缺真实 Mobile/Tailnet 经 canonical backend 的 auth/model 请求与 reauth 验收；早期 emulator Gate1 不覆盖本范围。 [证据](https://github.com/mayf3/dsh-agent-core/issues/484#issuecomment-6591609653) |
| [#483](https://github.com/mayf3/dsh-agent-core/issues/483) [PRODUCT G10] Local native-arm64 platform normalization | **KEEP** | 仅 C1 irbridge ARM/健康层完成；C2 两次回滚、C3 意图及 D4/D6/retirement 余项仍在，逐服务 readback/canary 未全交付。 [证据](https://github.com/mayf3/dsh-agent-core/issues/483#issuecomment-6591608513) |
| [#482](https://github.com/mayf3/dsh-agent-core/issues/482) [PRODUCT G9] DSH native arm64 runtime migration | **KEEP** | Spec/实现已合；生产 parent/child/harness/Node 全链 arm64、无 Rosetta、真实 Agent 执行与 x64 rollback 整体验收未证。 [证据](https://github.com/mayf3/dsh-agent-core/issues/482#issuecomment-6591607494) |
| [#481](https://github.com/mayf3/dsh-agent-core/issues/481) [PRODUCT G8] Two-phase maintenance / PR #360 | **KEEP** | 条件性 PR360 维护债务仍保留：缺明确撤销/完整替代 disposition；未出现具体 release 不足时保持 deferred，不启动实现。 [证据](https://github.com/mayf3/dsh-agent-core/issues/481#issuecomment-6591606674) |
| [#480](https://github.com/mayf3/dsh-agent-core/issues/480) [PRODUCT G7] Workflow collaboration | **KEEP** | Core #493 与 Svc #60 提案仍需按现行权威重建/接受与冲突收敛；真实协作流 installed/enabled/business 验收未证。 [证据](https://github.com/mayf3/dsh-agent-core/issues/480#issuecomment-6591605672) |
| [#479](https://github.com/mayf3/dsh-agent-core/issues/479) [PRODUCT G6] Mobile Session History | **KEEP** | Mobile/Life 显式暂停，#499 已由 #502 支持停止；history source 存在，但真实 mobile history 装载/启用/恢复验收未证。 [证据](https://github.com/mayf3/dsh-agent-core/issues/479#issuecomment-6591604369) |
| [#478](https://github.com/mayf3/dsh-agent-core/issues/478) [PRODUCT G5] Human Work Item Feishu action ingress | **KEEP** | #492 候选 review gap 已修，但 Human-principal canonical actor authority/Spec 与真实 Feishu query-complete/reject→Workflow provenance 尚未交付。 [证据](https://github.com/mayf3/dsh-agent-core/issues/478#issuecomment-6591603369) |
| [#476](https://github.com/mayf3/dsh-agent-core/issues/476) [PRODUCT G3] SMV3 family / retro / adc / journal migrations | **KEEP** | SMV3 engine 不等于 D1–D3 迁移验收；本项仍是等待真实 Product 依赖的冷库存，尚无撤销/完整替代决定。 [证据](https://github.com/mayf3/dsh-agent-core/issues/476#issuecomment-6591602586) |
| [#471](https://github.com/mayf3/dsh-agent-core/issues/471) [PRODUCT F2] Workflow publish + real Instance/Task + dispatch | **KEEP** | publish/create 源码与历史旧路径已有；当前 canonical dispatch 的授权 driver/vehicle、feed→wake 消费及 durable result 完整验收未证。 [证据](https://github.com/mayf3/dsh-agent-core/issues/471#issuecomment-6591601669) |
| [#464](https://github.com/mayf3/dsh-agent-core/issues/464) [PRODUCT C4] Trusted Progress Checkpoint — verify write/resume boundaries | **KEEP** | checkpoint hermetic A–K/边界已验；当前 loaded generation 及真实 trusted Workflow attempt 内 write/read_current canary 未证，待共享发布验收。 [证据](https://github.com/mayf3/dsh-agent-core/issues/464#issuecomment-6591600686) |
| [#463](https://github.com/mayf3/dsh-agent-core/issues/463) [PRODUCT B10] Model routing / Luna → GPT-6-Luna / reasoning — independent rollout | **KEEP** | GPT-6-Luna/reasoning dormant 源码与 selection 测试完成；精确 loaded tuple/config 与独立 scoped rollout/canary 未证，B7 reauth 仍应单列。 [证据](https://github.com/mayf3/dsh-agent-core/issues/463#issuecomment-6591599685) |
| [#462](https://github.com/mayf3/dsh-agent-core/issues/462) [PRODUCT B5] Agent ID → Principal UUID reverse lookup — install and verify | **KEEP** | reverse lookup 源码/Auth/provider/manifest 与一次真实只读查询已验；仍缺所装 generation 的 loaded provenance 及 post-deploy 授权只读验收。 [证据](https://github.com/mayf3/dsh-agent-core/issues/462#issuecomment-6591598485) |
| [#459](https://github.com/mayf3/dsh-agent-core/issues/459) [PRODUCT B2] Scheduler Self-Healing / Self-Ops V4 — real due-slot acceptance | **KEEP** | Owner 于 11-07/11-08 明确重登记 PAUSED_BY_OWNER；真实 bounded recovery→下一自然 due-slot 的完整关联验收未完成，仅 Owner 显式恢复可唤醒。 [证据](https://github.com/mayf3/dsh-agent-core/issues/459#issuecomment-6715408358) |
| [#458](https://github.com/mayf3/dsh-agent-core/issues/458) [PRODUCT B1] Workflow V4 / currentExecutorType — real business acceptance | **KEEP** | Workflow 范围保留用户暂停；缺 fresh installed/loaded 绑定与真实 Workflow/HR currentExecutorType E2E，非生产 11/11 不构成业务验收。 [证据](https://github.com/mayf3/dsh-agent-core/issues/458#issuecomment-6591596542) |
| [#456](https://github.com/mayf3/dsh-agent-core/issues/456) [PRODUCT A7] Transactional reconciliation-state backend | **KEEP** | PR #489 已合并，源码/测试完成；bounded rollout/acceptance 仍 PREPARED，缺安装、启用及业务回执。 [证据](https://github.com/mayf3/dsh-agent-core/issues/456#issuecomment-6591595669) |
| [#455](https://github.com/mayf3/dsh-agent-core/issues/455) [PRODUCT A6] Stable ingress / bounded runtime handoff | **KEEP** | PR #487 已合并且源码证据完成；真实 ingress/runtime handoff rollout/acceptance 尚未执行。 [证据](https://github.com/mayf3/dsh-agent-core/issues/455#issuecomment-6591594812) |
| [#449](https://github.com/mayf3/dsh-agent-core/issues/449) Workflow v5: distribution nodes loop on missing targetPlatforms and lack scoped recovery | **KEEP** | 创建时 targetPlatforms 校验已由 svc PR #72 覆盖；creator 切换及两个滞留 v5 实例的 Owner assistance 处置仍未闭环。 [证据](https://github.com/mayf3/dsh-agent-core/issues/449#issuecomment-6591594019) |
| [#442](https://github.com/mayf3/dsh-agent-core/issues/442) [PRODUCT] 审计短期 C — 可选能力退出基础启动依赖，收窄健康检查故障范围 | **KEEP** | 2026-11-04 Owner ACCEPT V2 已解除 implementation 门；effect-boundary 实现、PR #451 整合及发布业务验收仍有差额。 [证据](https://github.com/mayf3/dsh-agent-core/blob/6ad69d1fa6fa8c7dcfb3b5b61207c7d21a80ecef/packages/production-runtime/src/compose.js#L250-L274) |
| [#441](https://github.com/mayf3/dsh-agent-core/issues/441) [PRODUCT] 审计长期 — 收敛现有架构规范与反例回归，删除无效治理 | **KEEP** | 当前治理 V3 和结构规则已覆盖部分原则；原六反例的跨仓 direct-consumer/check 执行与 OLD-BAD→NEW-GOOD 全量闭环证据仍缺。 [证据](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-6622749231) |
| [#440](https://github.com/mayf3/dsh-agent-core/issues/440) [PRODUCT] 审计短期 B — 执行绑定竞争与 Git 安装版本归属修复 | **KEEP** | agent-control PR #1341 切片已合并；最终 read→write 的 whole-body 非 CAS 竞争窗口仍被明确保留为源码残余。 [证据](https://github.com/mayf3/dsh-agent-core/issues/440#issuecomment-6591590867) |
| [#434](https://github.com/mayf3/dsh-agent-core/issues/434) [PRODUCT] Core runtime 去特例 — HR 一次性恢复代码退出通用启动与准入路径 | **KEEP** | HR 特例源码退役和 PR #491 适配已合并；实际 runtime 退役、loaded 版本及业务/回退验收仍无完整闭环证据，沿 #383 原发布线。 [证据](https://github.com/mayf3/dsh-agent-core/pull/676) |
| [#428](https://github.com/mayf3/dsh-agent-core/issues/428) [PRODUCT C11-R4] Scheduler watchdog actionable notifications — correlate, coalesce, and suppress derived alert noise | **KEEP** | 历史 cutover 有 installed/loaded/enabled 证据；真实同 incident NEW→RECOVERED、恢复后 24h 零复报及重启幂等验收仍缺。 [证据](https://github.com/mayf3/dsh-agent-core/issues/428#issuecomment-6591587084) |
| [#426](https://github.com/mayf3/dsh-agent-core/issues/426) [PRODUCT C11-R3] Restart-safe runtime maintenance — drain before restart and deterministic previous-epoch recovery | **KEEP** | 2026-11-08 重登记 WAITING_DEPENDENCY：封印 parent-context 备份保留权属待 Owner 单独裁定，restart/业务验收未完成。 [证据](https://github.com/mayf3/dsh-agent-core/pull/662) |
| [#417](https://github.com/mayf3/dsh-agent-core/issues/417) [PRODUCT C11-R1] Scheduler trusted late-outcome self-heal — close RECONCILED_SUCCESS fence without human prompt | **KEEP** | 2026-11-08 重登记 WAITING_RELEASE：等待 managed-runtime/fleet 或 W7 发布窗口，真实 rollout/occurrence 验收仍未闭环。 [证据](https://github.com/mayf3/dsh-agent-core/pull/676) |
| [#414](https://github.com/mayf3/dsh-agent-core/issues/414) [PRODUCT B7] Shared Codex permanent closure — deploymentRoot-safe re-freeze and fleet acceptance | **KEEP** | 临时 92-home 恢复不等于永久 B7 拓扑完成；actual-delta blocker、永久安装/loaded、新 home/canary/回退证据仍未闭环。 [证据](https://github.com/mayf3/dsh-agent-core/issues/414#issuecomment-6591583111) |
| [#408](https://github.com/mayf3/dsh-agent-core/issues/408) [PRODUCT C10] Workflow Active Pool V2 — census and bounded real-rollout preparation | **KEEP** | 正向 quiescence PR #444 与测试身份 E2E 已完成；poller principal、3 条 BIP due intent 处置及真实安装/启用/canary 仍待完成。 [证据](https://github.com/mayf3/dsh-agent-core/issues/408#issuecomment-6591581455) |
| [#407](https://github.com/mayf3/dsh-agent-core/issues/407) [PRODUCT C7] Domain Owner Assistance production rollout — census and prepare | **KEEP** | svc PR #71 当前仍 OPEN；Owner-assistance/outbox/release 修复整合、poller principal/grant 选择及真实 rollout/业务验收仍待完成。 [证据](https://github.com/mayf3/svc-workflow/pull/71) |
| [#402](https://github.com/mayf3/dsh-agent-core/issues/402) [PRODUCT C1] Session-Centric Traceability / MY_SESSIONS — install or verify | **KEEP** | 2026-11-07 重登记为部分安装、业务验收待完成；缺生产真实 credentialed MY_SESSIONS 查询与对应安装代际的完整回执。 [证据](https://github.com/mayf3/dsh-agent-core/issues/402#issuecomment-6705325565) |
| [#394](https://github.com/mayf3/dsh-agent-core/issues/394) [PRODUCT E9] Progress Sync + event-driven ChatGPT supervisor | **KEEP** | 新一代 agent-control PR #1339 已合并；新代 installed/loaded 及自然 first-delivery/transient-retry 闭环仍 NOT VERIFIED。 [证据](https://github.com/mayf3/dsh-agent-core/issues/394#issuecomment-6591577901) |
| [#389](https://github.com/mayf3/dsh-agent-core/issues/389) [PRODUCT A5] Scope candidate/canary qualification away from ordinary fleet admission | **KEEP** | PR #392 测试身份 coexistence 已完成且曾纠正误自动关闭；共享 W1 实际部署和 A5 业务 canary 尚未有完成回执。 [证据](https://github.com/mayf3/dsh-agent-core/issues/389#issuecomment-6591576426) |
| [#386](https://github.com/mayf3/dsh-agent-core/issues/386) [GOAL] CONTINUOUS_BACKLOG_DELIVERY_V1 — continuously ship #382 through MRDP | **KEEP** | 长期 backlog delivery Goal 仍承载多项未完成产品与发布/业务验收；队列空或历史命令完成不满足整个 Goal。 [证据](https://github.com/mayf3/dsh-agent-core/issues/386#issuecomment-6552275829) |
| [#384](https://github.com/mayf3/dsh-agent-core/issues/384) [PRODUCT D1/D2] HR abandonment active-cap + permanent tombstones | **KEEP** | active-only cap 与 permanent tombstones 仍未实现；当前 main 源码及持久校验仍按 distinct declaration 总量限 32。 [证据](https://github.com/mayf3/dsh-agent-core/blob/6ad69d1fa6fa8c7dcfb3b5b61207c7d21a80ecef/packages/agent-router/src/reconciliation/admin-abandonment.js#L215-L217) |
| [#383](https://github.com/mayf3/dsh-agent-core/issues/383) [PRODUCT A1] Availability-first T0/T1 closure — target mapping, rebuildable release, isolated startup | **KEEP** | 可重建包和隔离重启验证已通过；后续正式交付缺 fresh CAPTURE/ADMIT/DEPLOY、loaded 读回及 HR/ordinary Agent 业务验收，历史磁盘阻塞未有本轮解除证据。 [证据](https://github.com/mayf3/dsh-agent-core/pull/676) |

### mayf3/svc-workflow（6 项）

| Issue | 结论 | 一行现状 / 依据 |
|---|---|---|
| [#127](https://github.com/mayf3/svc-workflow/issues/127) GOAL-SVC-WORKFLOW-ZERO-OPS-001 注册（长期 ACTIVE / P0）：svc-workflow 全系统无人值守运营 | **KEEP** | 长期无人值守 Goal 尚缺 A–J 完整验收及 7 天/20 周期稳定观察和 Owner 确认，不能因首次业务终态关闭。 [证据](https://github.com/mayf3/svc-workflow/issues/127#issuecomment-6619089114) |
| [#126](https://github.com/mayf3/svc-workflow/issues/126) [DEPLOY_ACTOR_UNKNOWN] 18:20 生产发布执行者归因缺陷与防复发（P0-B 阶段 A） | **KEEP** | 执行者已识别，但防复发 PR #128 仍 OPEN；发布责任链及相关恢复未完整结清。 [证据](https://github.com/mayf3/svc-workflow/pull/128) |
| [#84](https://github.com/mayf3/svc-workflow/issues/84) [CONTRACT] RETURN 引擎契约（rootCauseNodeVisitId/reasonCode/reason）不可发现：schema 合法 ≠ 提交合法 + broker detail 截断 | **KEEP** | D1 主投影已上线；投影/validator 一致性、完整回归及 D2 broker detail 现状仍有明确剩余缺口。 [证据](https://github.com/mayf3/svc-workflow/issues/84#issuecomment-6622025087) |
| [#83](https://github.com/mayf3/svc-workflow/issues/83) [PLAN] 身份语义收敛：停止产生旧数据 → 收敛消费者 → 退役旧入口（Owner 裁决 2026-10-24） | **KEEP** | C2 部分消费者已修，C1 新数据入口、dispatcher/history 收敛及 legacy 认证退役仍未完整验收。 [证据](https://github.com/mayf3/svc-workflow/issues/83) |
| [#81](https://github.com/mayf3/svc-workflow/issues/81) canonical 身份迁移收尾：三个授权面漏项（provisioning 允许名单/admin grant/admission 依赖） | **KEEP** | canonical provisioning 名单、workflow.admin grant 与 admission 单点迁移三项尚无全部交付证据。 [证据](https://github.com/mayf3/svc-workflow/issues/81) |
| [#80](https://github.com/mayf3/svc-workflow/issues/80) [SPEC][AUTHZ] HR 全域治理可见性：新增 GLOBAL_WORKFLOW_AUDITOR 只读角色（跨域实例详情/提交历史/Definition 读） | **KEEP** | auditor 源码与旧10-22验收存在；更晚 PR #113 记录部署缺实现/HR详情404，缺对应恢复读回，保留发布验收。 [证据](https://github.com/mayf3/svc-workflow/pull/113) |

### mayf3/auth-service（0 项）

全量 `gh issue list --state open --limit 1000` 返回 `[]`；无待甄别 open issue。PR 不纳入 issue 数。

## 证据保存与限制

原始 list、每项 view、PR/main 回读及顺序命令日志保留在本机 `/tmp/issue-triage-20261109.J5Z91K`；报告以 GitHub 原 issue/comment、固定 SHA 文件和合并 PR 作为可复核坐标。历史生产回执只证明其记录时间的观察；本轮未重测当前生产 loaded/business，未以 UNKNOWN、ACK、安装文件或源码 PASS 伪作业务完成。

| 首次清单快照 | SHA-256 |
|---|---|
| `agent-control/open-before.json` | `1d53f734f23a9451a8155a694ecdde339c79c1c11f370e73c6aa2dae77b83702` |
| `dsh-agent-core/open-before.json` | `d1d85e2114c2d58a367307e729fa2c18c09a21f673561afd3e70b545ee8261b9` |
| `svc-workflow/open-before.json` | `4ae2aa243f19e22c40e39ce2f01b80601f03c6207be563c66566805d94879c2d` |
| `auth-service/open-before.json` | `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570` |

## 独立复核与最终 fresh-read

独立审查者 `/root/core_older` 未作者关闭决策/说明或本报告。初审指出 #80 较新404反证后，已通过 KEEP 收窄关闭范围；复核最终为 **PASS / blockers=0**，只允许 #1364。被审关闭前报告 SHA-256 `a4f563333fb1d869e1e558d6e6eaf820eea4f5c6e1e2818a2e7cdad06f981a41`；原简报与唯一关闭说明 hash 如上。审查原始记录保留在本机 `lifecycle-review-initial.json` / `lifecycle-review.json`。本次仅添加实际回执，最终提交另作收据差量复核。

关闭后再次执行同样四仓全量 `gh issue list`，逐仓比较编号集合；唯一差量为 agent-control #1364，新增/意外消失均为0。所有 KEEP 仍在 OPEN 集合，svc #80、#126、agent-control #1351/#1352/#1377 均保留。

| 仓库 | 关闭后 OPEN | 对预期集合校验 | 回读快照 SHA-256 |
|---|---:|---|---|
| mayf3/agent-control | 29 | PASS | `6332a56527642301acdf60e96f97bc7c4d361fd25c9c7ae9d6dcf6fb0834116f` |
| mayf3/dsh-agent-core | 40 | PASS | `d1d85e2114c2d58a367307e729fa2c18c09a21f673561afd3e70b545ee8261b9` |
| mayf3/svc-workflow | 6 | PASS | `4ae2aa243f19e22c40e39ce2f01b80601f03c6207be563c66566805d94879c2d` |
| mayf3/auth-service | 0 | PASS | `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570` |

最终 Core main 仍为 `6ad69d1fa6fa8c7dcfb3b5b61207c7d21a80ecef`，与工作基线一致。机械报告核对：76 个唯一编号与初始清单完全相等；1 CLOSE / 75 KEEP；关闭说明两行依据和可重开声明；Git diff 空白校验。无代码变更，本轮无需产品测试。
