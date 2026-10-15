# DSH 原生 MCP 对话 Implementation Plan

> 实施者：本Codex任务直接完成；只用小范围子任务和独立审查，不交给本地ZCode。此计划非Product Authority；仅在对应Spec被Owner接受并纳入authority branch后执行。执行方法沿用用户已指定的当前任务，不另询问执行方法。

**Goal:** 一个获准Agent通过现有connector可靠收发及补取，再补授权历史与断线恢复。

**Architecture:** 现有DSH runtime中受鉴权的Product Surface facade复用Router与原幂等reservation机制。DSH保存request-owned结果/native refs并提供安全投影，MCP只调正式接口。

**Tech Stack:** 现有Node ESM、Router/reconciliation、原持久存储与MCP SDK；不新增数据库产品、调度器或Web平台。

**Spec:** `docs/specs/DSH_MCP_NATIVE_CONVERSATION_V1.md` accepted r3，及已获Owner接受的dot-read-mcp integration；两仓合入权威基线后执行首段。生产加载与新增权限仍不在授权内。

## Global Constraints

- 不部署/加载/扩权，不读取token、原session/log或修改旧1135、B7/UNKNOWN；原workflow actions不在此计划。
- 外部principal不可伪造AgentProcess；shared surface Binding不可被解析目标修改。
- 任意sessionId/URL/path不入模型参数；相同request_id只读原结果；UNKNOWN禁止重投。
- user/Agent可见内容与内部推理/私有资料分离；known source缺字段明确unknown。
- 三份证据分别报告：源码fixtures、加载/授权、dot实际往返。

## Review Focus

- reserve已落盘、Router已接收、receipt未保存时crash：原key unknown且零重投。
- 两请求native reply乱序：不得用时间/内容/同session归属。
- revoke/grant或registry移动：查原request不改native归属，新admission按新权限检查。
- source在分页间增长/换代：冻结vector边界或明确cursor失效，不能offset续另一快照。
- reply已产生但persist/query失败：只修原result，Owner报告及实际Workflow证据分列。

## Task 1 — 首个Agent的受控发送与持久回复

**Files:** `packages/product-api/src/conversation/{handler,auth,result-store}.js`（新，遵守结构限制）；`packages/product-api/src/index.js`（默认OFF wiring）；`packages/production-runtime/src/compose.js`（复用原Router事件/seams）。受控storage helper若从Notification抽取，须保留其caller限制及现有测试，不改原notification schema。

**Interfaces:** resolve(scope,target)→opaque target handle；send(scope,{request_id,target_handle,message,reply_to?,workflow_refs?})→request result；getResult(scope,request_id,reply_cursor?)→同原native坐标的三维状态/正文页。

- [ ] 先RED验证Auth/handle/并发reserve、同号冲突、UNKNOWN、两个乱序reply、persist失败及restart读回。
- [ ] 复用原Auth verifier与Router；实现已接受的principal/target/operation合同，禁用配置时零目标读/Router调用。
- [ ] 先reserve再原Router，持久native refs，原reconciliation event驱动reply存档/refs；正常及restart同号读回。
- [ ] 只做相关GREEN/回归和独立exact-head审查，出Source receipt。
- [ ] 更新MCP三个原stub为正式typed adapter并导出真实tools/list；缺实现/缺授权仍明确unsupported/denied。
- [ ] 取得独立的运行grant/加载mandate后，由运行Owner加载，再让dot在现有connector发一条新稳定业务问题并原号读回；记录时间与native reply关系。未批准保持NOT_RUN。

## Task 2 — 获准上下文、事件与恢复

**Files:** `packages/product-api/src/conversation/{history,events}.js`；正式projection reader复用`packages/session-history`/runtime exact reader的安全机制，不借旧mobile profile，也不把EH offset cursor当snapshot。

**Interfaces:** listHistory(scope,session_handle,{cursor?,direction,limit,content_cursor?})→稳定消息/page coverage；listEvents(scope,{cursor?,request_id?,limit})→seq/events/retained coverage。

- [ ] RED多页增长/换代/长期回复分块、权限隔离、cursor过期、事件重复/缺页与断线restart。
- [ ] 默认request-bound范围；更多business history只用单独read grant。长内容和unsupported archive/fresh明确返回支持范围。
- [ ] 结果与event atomic durable；event只发现结果，不消费、不派发。断线恢复查询原request，无跨入口重试。
- [ ] GREEN和独立affected-contract review；原connector逐项live acceptance另按批准执行，不重复Task1正常一轮当全恢复验收。

## Task 3 — Workflow目标与扩展

- [ ] 已有合法Workflow详情/Owner读路内核真实lifecycle、node assignee/Owner、version与refs；无权返回diagnostic，禁猜或Owner替身代理被拒身份。
- [ ] 问负责人进度并取exactreply，只读；新增Agent/grant逐项经Owner批准，不全域放开。
- [ ] 对照Spec ACC-001..007提交版本、合同、范围、request/reply证据、PASS/NOT_RUN及停用/回退receipt；满足bounded交付后停止。
