---
spec_id: DSH_MCP_NATIVE_CONVERSATION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-10-15
revision: r2
scope:
  - authenticated MCP product-surface conversation facade inside the existing DSH runtime
  - principal-scoped request reservation, exact native reply result and resumable event projection
  - authorized business history projection and thin dot-read-mcp consumer contract
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_WORKSPACE_SESSION_MODEL_V3
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - repository owner mayf3
---

# DSH_MCP_NATIVE_CONVERSATION_V1

## 1. Goal

让 dot 经现有 MCP connector 直接向获准业务 Agent 提问、核对准确对应回复、分页读取获准上下文，并在断连或重启后补取原结果。用户2026-10-15需求是 authoring/source mandate；本 proposed Spec 尚非 implementation authority，且永不构成生产变更或 grant 授权。

## 2. Scope and non-goals

首段仅一个经核定的 BIP canonical Agent、一个原 connector subject、原合法 main 策略及本主体发起的 request/result。先实现并验收发送/回复，再 history/events/恢复，最后扩大获准目标。Workflow解析只在独立数据源可见性内执行。

MUST NOT 使用网页或飞书作该链中转、建立第二Router/调度器、直接读取会话文件的MCP适配器、复用别人凭据、改变Workflow状态、重放EP49/UNKNOWN、改原取消/归档记录。现有ASM、Notification、mobile history和旧只读MCP仍保留其独立责任，不改变或部分supersede其合同。

## 3. Authority and dependencies

本产品边界归DSH；薄客户端由 `mayf3/dot-read-mcp` Owner 单独接受其 `docs/DSH_NATIVE_CONVERSATION_INTEGRATION_V1.md`。仅继承已accepted的Architecture/D-008不变式：Router拥有Binding和会话选择，单AgentProcess、原准入/队列/fence/UNKNOWN。

复用参考：ASM V2的native坐标及协调、Notification持久幂等模式、Mobile History安全投影、EH exact correlation规则。它们不授予新外部caller、他者历史或新Grant。新Spec为NEW/CONTROLLED，必须docs-first accepted in main，随后另开REUSE实施任务；不修改自身governing Spec。任何 auth-service/client/grant 变更须其owning authority与明确运行批准，不由本文件自授权。

## 4. Current State

STATE-001：DSH main `04cd3b066116041a7be9663417775a2ac8dd331c`；MCP source `485262f`，运行0.2.0；2026-10-15T01:03:36.996Z connector `get_message_result` 返回 NOT_PROVISIONED。环境为本机只读源码与现有connector。依据OBS-002..008。

## 5. Observations

OBS-001..008及完整方法/时间/限制见 [核查记录](../investigations/DOT_NATIVE_DIALOGUE_GAPS_20261015.md)。无生产send、原始会话读取或新授权。EP49的send/reply、最终Workflow处置仅Owner回填；无parent/reference，非本Spec exact reply验收。

## 6. Claims and assumptions

CLM-001 = SUPPORTED：没有现成已授权外部native对话链覆盖目标；现有primitive可复用，不能绕caller边界。CLM-002 = SUPPORTED：post-receipt UNKNOWN/正文回传失败需要原操作查询，不是另一次send。CLM-003 = OPEN_ASSUMPTION：本机已装服务的所有引用路径与main相同；实现/加载验收必须新核，不据此操作。

## 7. Evidence relations

EVD-001：OBS-003..008 SUPPORTS CLM-001，在上述两个exact源码revision上足以支持合同缺口判断；不证明运行可调用。EVD-002：OBS-001、002 SUPPORTS CLM-002，在原1135评论及connector读取时点上说明回传缺口；不证明另一新请求已往返。

## 8. Decisions

DEC-001（待Owner接受）：使用现有runtime内的受鉴权Product Surface facade复用Router内部primitive，MCP仅薄适配；不把MCP冒充真实Agent/source turn，也不扩大Notification caller名单。

DEC-002（待Owner接受）：DSH journal保持内容权威。持久请求记录仅保存主体/范围/request_id、规范payload digest、native坐标、分维状态、正文/产物引用和增量序号；回复可读前必须提交有界immutable回复投影或同等retention的受控产物，以跨journal换代补取。它是request-owned结果产物，禁止变成第二聊天库或查询未经授权历史。

DEC-003（待Owner接受）：pilot默认current main且只读自己请求关联内容；完整main历史、新fresh/归档上下文是独立read授权。若fresh没有合法接续能力，则明确NOT_SUPPORTED，不先建再要求换入口。既存UNKNOWN不换会话或入口重发。

## 9. Contracts

### CTR-NC-001 — Identity and authorization

服务MUST从现有connector的server-side身份映射取得原subject及通信scope；凭据只经原安全文件引用/短命服务端获取，不在模型参数、响应或日志。DSH facade MUST独立验证resource/audience、subject与operation/target/session范围。MCP登录成功、workflow reader或单纯loopback访问均不是该权限。默认OFF、没有完整绑定时零目标读取/零Router调用；不得公开本机接口。

每次调用MUST按当前授权复核；target/session/cursor/request handle不是bearer授权。失败返回脱敏diagnostic_id及错误分类，不泄露不存在/越权目标的正文、会话路径或身份映射。最窄pilot只授resolve、send、own-result/own-events给一个已验证BIP；不得因其是业务Owner自动开放其他Workflow详情或全main正文。返回正文/ref沿现有输出安全策略脱敏，redaction显式；投影hash绑定实际返回bytes，与native source hash分列，不返回内部推理或凭据。

### CTR-NC-002 — Resolve, main and concurrency

resolve输入恰一种canonical agent_id或workflow_instance_id，禁止显示名模糊匹配。MUST核Agent↔principal/domain唯一映射；Workflow Owner、node assignee、domain Owner分列，合法source无字段则unknown，404不可分存在/可见时不猜负责人。只在合法数据源可见范围生成opaque target_handle，绑定主体/scope/目标/路由版本。解析只读，不选择或切换共享surface Binding。

send只接handle；runtime MUST复用原Router准入、单AgentProcess、队列/并发/冲突控制，默认main。每个允许目标使用Owner经原Router流程预置的专用Product Surface Binding；MCP不传surfaceId，resolve/send核绑定Agent与handle一致，缺失/不一致即拒绝且不自动switch。该Binding与手机/其他原surface分离，Router仍唯一拥有它；没有Binding的target不能绕过Binding直接当human发送。

MCP不得提交sessionId/sourceAgent/sourceTurn/路径/URL；native call身份与human/product-surface provenance由trusted facade派生，不伪装inter_agent。main首次创建/换代原因、session generation和合法后续handle必须返回；没有授权续读的旧代不能悄悄切换。fresh/历史session初版明确不支持，只有获准且有合法continuation合同后才能声明可用。任何询问不直接调用Workflow变更。

### CTR-NC-003 — Durable admission and idempotency

send MUST在Router副作用前，持久reserve `(subject_id, communication_scope_id, request_id)` 和canonical digest。digest覆盖目标canonical ID、正文UTF-8、reply_to及已验证Workflow/node refs；JSON排序固定、不得有语义改写。scope稳定ID不因进程/transport重启或普通配置revision改变。native requestId由trusted runtime从该坐标命名空间化，保留原correlation第二mint保护。

同key同digest返回原operation及原状态/ref，零重投；同key不同目标/正文/refs返回REQUEST_CONFLICT，零副作用。reserve后未知或超时MUST只查询原操作，重启未证明not_executed的reservation置unknown且不可route；明确not_executed的原结果仍按原号读回，不自动复投。回复回传失败只补取。tombstone不自动过期；达到Owner配置资源上限时拒新key为RESOURCE_LIMIT，不能删除未知记录以腾容量，旧key/result仍可查。原生处理已started/completed不等于业务目标完成。

### CTR-NC-004 — Exact reply and persistent results

成功receipt MUST持久绑定原request到native `Agent ID + SessionRef/generation + request messageId` 及native turn/reconciliation坐标。回复MUST按同native turn/原message坐标精确关联；禁止同群/同session/时间邻近/文本相似匹配。reply_to若由native turn关系投影生成，须标 `relation_source=native_turn` 并分列原native parent_id，不能伪称源消息本有parent。

在admission前注册原runtime协调观察，复用 `onTurnReconciled` 并在重启补扫有界本主体request坐标。回复出现后MUST自动提交request-owned的可补取result/body ref与事件，之后才声明reply available；不能另起任务导出答案。只有hash/bytes而无可读正文/ref时reply_status不可available。持久化失败标RESULT_PERSIST_FAILED、执行/回复状态分别保留，只经正式exact reader修复原result，不send。结果正文/ref按授权读取；journal路径永不传给MCP。正文/ref保留期须在启动配置和结果中明示，未配置则disabled；保留期内重启、main换代或reset不使结果消失，期满明确RESULT_EXPIRED且不删除幂等tombstone。未完成/UNKNOWN请求不得因保留期删除。

### CTR-NC-005 — Result envelope and errors

至少返回 `request_id, agent_id, session_handle, session_generation, message_id, reply_to, workflow_refs`；`submitted_at, accepted_at, started_at, finished_at, reply_created_at, result_persisted_at, served_at`；独立 `request_status, execution_status, reply_status`；`reply_message_id, reply_body/reply_ref`；`error.class, diagnostic_id, retryable, retry_preconditions`。没有source字段时用unknown＋field_availability/reason，不补0或false。

请求状态区分reserved/accepted/not_executed/unknown/failed；执行区分not_started/running/completed/failed/interrupted/unknown；回复区分pending/available/incomplete/unavailable/failed/unknown。accepted、进程exit0与Owner声称完成不互相升级。Owner报告保留 `provenance=OWNER_REPORT`；Workflow提交/transition/产物独立列refs及验证状态。错误至少区分NO_ACCESS、NOT_FOUND_OR_NOT_VISIBLE、REQUEST_CONFLICT、CURSOR_STALE、SESSION_GENERATION_CHANGED、TRUNCATED、RESOURCE_LIMIT、UPSTREAM_UNAVAILABLE、RESULT_PERSIST_FAILED、NOT_SUPPORTED；未实现不得返回空成功。

### CTR-NC-006 — History and reply content coverage

history只接受获准opaque session_handle及older/newer cursor、limit；不接任意sessionId。初版可先只支持本主体request-bound turn上下文；扩大到完整业务main必须单独grant及隐私范围核定，不能因session属于获准Agent推定全部内容可读。只能经DSH正式投影服务，MCP不读原始文件。

每个可见消息返回稳定message ID、原native ID（缺失则unknown）、session generation、role、created_at、reply relation及有限产物refs。稳定projection ID须声明namespace，不能转成native turn ID。cursor绑定subject/scope、session generation、query fingerprint、冻结source边界与native排他位置；同边界多页无重复漏项。新增读取另用after增量边界；source换代、不可重建边界或cursor失效必须显式报错，不能按offset继续另一段历史。has_more、coverage_start/end、message/content完整性、truncation与resource caps分列。不得复用已发现的EH offset cursor宣称此保证。

可读内容为获准用户文本与业务Agent可见回复；不含内部推理、凭据、私有tool参数或无关turn。附件初版仅安全metadata/ref，二进制不支持。message列表默认50、最多200且响应最多1MiB；长正文以可授权内容cursor继续，每页最多6144 UTF-8字节，或明确content_truncated与不可补取范围。失败/未完成轮次可返回已持久用户消息与状态；未落盘assistant文本保持incomplete，不当最终回复。fresh/archive/reset旧代在无明确授权/实现时返回NOT_SUPPORTED，不能声称完整聊天记录。

### CTR-NC-007 — Incremental discovery

事件在结果提交后进入原runtime持久request事件投影，具稳定event_id、单scope递增seq、request_id、native关联、kind、occurred_at/persisted_at。MUST原子地维护状态/ref与可重读事件，重复native回调不得制造不同业务回复。事件不是调度指令；客户端按cursor/limit读取、去重，重启/断线继续原cursor。

cursor范围外返回EVENT_CURSOR_EXPIRED和retained coverage，允许从原request快照补取再取得新cursor，禁止重新send。事件重复/漏通知不影响canonical结果读取。现connector无已验主动唤醒合同，因此只承诺poll/恢复查询；不声称主动通知或固定发现延迟。须分别记录回复产生、持久可查询及dot实际看到时间。

### CTR-NC-008 — Workflow truth and aggregate scope

Workflow raw lifecycle、cancelled、archived、node/Owner/assignee、state version及时间只取合法权威字段；不可用非终态/updated_at/实例计数替代。源缺字段注明not_projected。查询filters与raw状态分列；`lifecycle=active,status=all`只说明非终态查询且包含status-all，不证明未取消/归档；改窄的active-filter观察须新的范围/version，不改写历史290行回执。聚合标scope、页数/游标、complete、失败项及非冻结时窗。读取/询问不改变Workflow。

### CTR-NC-009 — Staged activation and rollback

Source、安装/加载、身份grant、dot实际往返分别记账。所有新route默认disabled；生产source/profile/grant启用不由Spec或本任务授予。先一Agent一条新稳定请求，保留原1135只读；其余验收再运行。关闭native adapter或撤销send grant必须立即拒新admission；原结果/UNKNOWN记录不删除，合法read grant仍可补取。回退不得恢复第二writer、旧不受控send、未知重发或将旧生成cursor静默映射到新代。

## 10. Acceptance

每项须记录exact源码/运行版本、主体与scope（不含secret）、时间、原请求/回复native坐标、调用记录和否定对照。源码fixture、加载与dot connector验收独立；未运行明确NOT_RUN。

| Acceptance | Contracts | 方法／环境 | Required evidence与Expected result | Failure condition |
|---|---|---|---|---|
| ACC-001 | CTR-NC-001,002 | 隔离auth/registry/Router fixture；获批pilot后dot connector | 合法BIP resolve/send；错误principal/target/scope/伪session拒绝，diagnostic脱敏且目标读/Router调用0 | 冒充Agent、仅凭transport放行、泄露内容或修改共享Binding |
| ACC-002 | CTR-NC-003 | 隔离并发、crash-window/restart；获批pilot同号重试 | 同号同payload原receipt且Router一次；同号异payload409；reserve后超时未知只补查；跨客户端、重启不丢key | 任意第二send/UNKNOWN清零/资源压力删除tombstone |
| ACC-003 | CTR-NC-004,005 | 隔离乱序双request及回传失败；获批pilot真实回复 | 两回复乱序仍按native turn对应；自动持久后原号可取正文/ref；Owner_REPORT与Workflow证据分列 | 时间/文本匹配，exit0冒回复，额外导出任务，只有hash即available |
| ACC-004 | CTR-NC-006 | 隔离多页/增长/换代/长内容/失败turn；获批history grant | 不重复漏页，稳定边界；cursor失效明确；caps/附件/未完成/Archive限制可见；零任意路径读 | 旧EH offset行为重复，静默换代、空成功或完整聊天误述 |
| ACC-005 | CTR-NC-007 | 隔离事件重复、断连、restart、retention gap；获批dot查询 | seq/cursor可恢复、原结果常可补取，过期明示；只查询不宣称主动notify | 丢event即丢结果、自动重发、错误wake保证 |
| ACC-006 | CTR-NC-008 | 隔离Workflow取消/归档/终态/partial与合法resolve；获批独立读 | raw缺项unknown；filter与object状态分列；问Owner不触状态；失败项/覆盖如实 | 再次cancel验证、updated计节点停滞、实例算进程 |
| ACC-007 | CTR-NC-005,007,009 | 获批单Agentdot往返及关闭send | 分测提交→接收、接收→回复、回复→dot可见；精度/clock/skew限制；disabled零新admission，read仍按grant | 用Owner分钟值造毫秒、fixture当live、回退重放或改授权 |

## 11. Alternatives and disposition

ALT-001 REJECTED：直接套ASM caller/借Agent credential，违反source-turn身份。ALT-002 REJECTED：把dot加入Notification名单，跨已有caller/resource边界且无reply保证。ALT-003 REJECTED：继续飞书+任务导出，EP49暴露延迟/关联不足且不达Goal。ALT-004 REJECTED：MCP直接读session文件或内存幂等/第二scheduler，不能满足正式授权、重启与唯一执行线。保留现有合法路径历史，不重放旧动作。

## 12. Migration, compatibility, and rollback

现MCP读工具、原Router/ASM/Notification/Mobile契约与关闭开关不变。工具名可复用resolve_agent_target/send_agent_message/get_message_result，新增read_agent_history/get_agent_message_events；参数合同由薄客户端Spec定义，当前三个仍NOT_PROVISIONED、后两未注册。接受/实施后导出真实tools/list和版本核对，不把草案当运行schema。

每个新request保持原principal/scope/native坐标；UNKNOWN不能因升级或session generation变化迁移成not_executed。更旧legacy结果只按其实际Owner报告/原引用读，不补造reply_to。Source回退保留durable记录；配置/grant停用只由运行Owner执行，result读权限另管。

## 13. Open questions

产品决策已作具体proposal，待Owner接受DEC-001..003及CTR-NC-001..009。运行待批准值独立：原connector subject UUID→DSH principal/scope、唯一pilot BIP绑定、受控服务端credential/resource、结果/事件/内容retention及容量配置、单次加载与dot验收mandate。尚无这些值时保持disabled；Source实施不读取secret来补值。完整业务历史及Workflow对象读授权另列，不默认随send放开。

实施计划：[2026-10-15原生对话计划](../reports/DSH_MCP_NATIVE_CONVERSATION_IMPLEMENTATION_PLAN_20261015.md)。SOURCE authoring结束不等于目标已交付。
