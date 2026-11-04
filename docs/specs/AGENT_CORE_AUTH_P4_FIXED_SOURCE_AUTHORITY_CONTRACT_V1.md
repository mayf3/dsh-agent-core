---
spec_id: AGENT_CORE_AUTH_P4_FIXED_SOURCE_AUTHORITY_CONTRACT_V1
status: proposed
spec_kind: implementation_contract
implementation_authority: none
owners:
  - mayf3
---

# Auth P4 fixed source and authority contract — proposed

This docs-only PR packages the unchanged reviewed v2 unit below and its exact source-closure index. It does not accept the contract or authorize implementation, activation, configuration, runtime, or production effects.

The proposed B5 finite trust/activation exception is for repository owner `mayf3`, or a maintainer explicitly authorized for this exact PR, to decide against the reviewed head. The B7 technical delegate is not substituted for that actor. R is the only selected existing carrier; the product-source change set is empty. This unit cannot restore the current independent UID502 gateway. Actual activation requires its separate applicable authority and concrete bindings.

The packaged JSON files preserve their original local evidence coordinates and pins; they are archived review provenance, not a claim that those paths exist in another checkout. Their repository locations and byte equality are mapped in [PACKAGING-VERIFICATION.json](../reports/auth-p4-fixed-source-authority-20261019/PACKAGING-VERIFICATION.json).

## Exact original contract

<!-- ORIGINAL-CONTRACT-BEGIN -->
---
status: proposed
source_revision: 4114c55e7a393904756b47b1967d786fd4a72e1c
unit: AUTH_P4_FIXED_ORIGIN_BROKER_RESULT_PATH_V1
implementation_spec_ready: false
implementation_authorized: false
activation_or_production_authorized: false
---

# 固定 P4 source / authority 合同提案

本单元是原1437 DSH源码角色受托准备的文档，不是新MC合同接受、实现许可或生产恢复manifest。原Auth01a0d846只给custody对口约束。B7技术委托、协调转述“通过”、JWT或旧store/profile join均不授本合同接受资格。独审材料通过也不是接受。本文与BLOCKED的R41容量事务独立，不改其状态、source、op或history。

## 1. 固定问题与选择

P4主证986b71c2的时间切片是gui/502/ai.agent-core.runtime、UID502/GID20/PPID1、PID62717；磁盘wrapper从home credentials.json取源，script/root为production4114与/Users/yanfenma/.agent-core。PID、磁盘export及env SHA都不是调用身份/loaded-code/activation证明；当前live pointer仍UNKNOWN。canonical505 credential custody和当前502 home空文件不能靠换credentialsFile合并。没有已证的当前505 activation或parent-owned关系，不推全系统无此模型，也不重做profile匹配/名单/caller调查。

选择R：复用已存在的**真实505受信parent拥有502子进程**的BROKER RPC与505 gateway；只提出本修复固定origin的信任/activation适用差量，不造mint服务。选择I（保留独立502进程并外部attach505 gateway）目前没有可信producer或已装channel，不能称配置恢复；它需要另一个真实的认证/委托接口与信任根，未被本文选择。复制secret、把token交给502或整体88域切505均排除。

**当前所有限制同时保留时，没有可用的可信producer可接到现独立502 gateway；source-only patch不能恢复这次实例。** R的最低必要效果是让该固定origin的实际Agent进程、Session/turn/generation与停止屏障归于真实受保护parent的管理，并由对应原profile的合法activation建立；不能事后给PID贴child标签。若这要求改变现役UID/root/domain/runtime归属或新增目标，则超出本次文档任务及其效果边界，须把那一项具体activation影响另行裁决，本文不允许执行。没有该影响的正面接受/适用binding时，R保持不可激活。这不是默认Owner门或永久无权结论。

## 2. B1 — producer / 身份闭包

已有source：S5的Router `index.js:257–269`把固定agentId、getProc、getBrokerGateway交给 `createParentRpcHandler`；`parent-rpc-relay.js:57–130`在实际parent内处理BROKER_RPC_METHOD。真实producer是该parent持有的proc对象/其原RPC通道及execution map，不是child发来的Agent/session字段。`getProc()`先排除DRAINING/EXITED/已观察exit；随后由parent核active ingress、processGeneration、rpcMeta.turnExecutionId、未settled execution；`provenSourceTurnExecutionId(proc,rpcMeta)`提供源turn。gateway不存在就原错误返回，无credential或业务调用。必须区分：active ingress/sourceTurn不成立时，原parent会把缺失context继续传gateway；gateway的credential/Grant校验先于LOCAL send handler。send随后在handler内拒绝无可信sourceTurn，保证无Router delivery，**不保证此前零credential getter/Auth调用**。lookup按原caller-owned审计语义，不额外套send的active-turn门。

调用：原parent-owned RPC(method,params,rpcMeta) → createParentRpcHandler → gateway.execute({capabilityId,operation,args},{agentId,ingressContext,sourceTurnExecutionId,invocationCorrelation?})。agentId由闭包实际spawn归属给定；params中的身份、scope、token、generation等按原source忽略，不作为授权。invocationCorrelation只作原trusted-channel逻辑关联，不赋身份。

拟议authority差量：允许**为本固定origin形成R所要求的真实parent-owned activation归属**，而不是允许独立502自报身份。未来可用binding必须在原受保护profile/launcher与实际parent生命周期内给出：原authority/activation ref及期限撤销、固定origin enrollment、原target/root/domain、protected app/node/harness generation、parent-owned proc/RPC handle与实际Session/turn映射。当前这些实例值未形成，不能由本稿构造。UID/PID/socket、可写wrapper、JWT或store join均不能填此tuple。此项是实际信任/activation差量，不是待补一个caller ID。

失败：现独立502或尚未准入的activation binding不能凭本文接入505 credential-use；不新Session补资格。真实parent-owned路径的DRAINING/EXITED/已观察exit按原barrier在gateway前拒绝。已进入原合法gateway但sourceTurn/generation证明过时的send按原handler在Router delivery前拒绝，不额外承诺零Auth调用、不加新校验次序。原Session与未知请求不因activation变化自动继承到新generation。

## 3. B2 — 唯一 credential-use / call-return 闭包

已有receiver仅为原505 parent中的 `createBrokerGateway(...).execute`。compose → mountBrokerGateway → applyBroker(gateway) → createBrokerGateway使用本地file-backed provider；gateway原credential/Grant校验先于LOCAL handler。transport.getCredential返回raw Client credential的JS接口，不是外部认证channel，不能接给独立502。现有client_credentials、Auth origin及manifest派生resource/scopes全部原样。

R的carrier就是**现有parent-owned broker RPC**，没有新HTTP/socket/mint endpoint、外部token provider或任意代理方法。调用505 gateway后，raw secret与access token始终只在原505受信侧；502子进程仅获得该业务invocation envelope。原 `createParentRpcHandler`直接返回gateway的invoke-shaped `{ok:true,result}` / `{ok:false,error}`；wire外包一层，child relay按原两层unwrap。不得再包一层、透传credential/token、把gateway内部Authorization/header/cache日志返回。

当前没有已激活505 receiver实例被本文证明；源码能力不能代installed/loaded/profile事实。R所需receiver activation/profile必须与B1同一信任域及原业务目标匹配，不把旧authsvc activation转借当前88域。若无法复用现有合法receiver，新增receiver/runtime/target效果不在本文授予之内。

失败：原credential_unavailable、Grant拒绝、Auth/transport错误按原envelope返回；没有credential时不能绕过前置校验直调LOCAL handler。原error detail的安全边界不扩大。Auth对口0bbf6fca的NONE_IDENTIFIED仅在接口/claims/权限/custody不变时成立，不证明active DB generation、credential有效或B1已闭合。

## 4. B3 — 固定业务 / 同号读取闭包

本修复仅复用现有 `agent_session_send / send` 与已独立授予时的 `agent_session_send_reconcile / lookup`；不新增Client、Grant、resource、scope、目标名单、任意HTTP/数据库查询。现manifest的完整Git blob绑定在SOURCE-CLOSURE-INDEX中，resource/scopes直接由原manifest消费者派生，不用本文新造字符串。原目标仍按既有definition/Router/Grant解析；原caller由B1产生，不调查旧失败调用的caller或creator。

新增有限source证据：`agent-session/runtime.js:9–46`经mount提供 `createAgentSessionMessagingAccess`；`agent-session-messaging.js:54–80,174–339,354–390`给实际业务闭包。send模型参数严格仅 `{targetAgentId,message,timeoutSeconds}`：UTF8消息1..65536B且无NUL，timeout为整数0..300，self-send拒绝。callerAgentId/sourceTurnExecutionId来自可信context；handler自己生成fresh runtime requestId，固定target canonical main，一次send只一次router.deliver，不新Session，不让target继承source Principal或Grant。

重要区分：runtime requestId、parent RPC/原调用的sameRID、invocationCorrelation不是同一个字段。`send`重入会生成fresh requestId，源码没有“再发一次同ID就自动幂等”的保证。不得发明caller可填requestId、以重复send充当结果查询或借此生成新Run。

同号读取实际ABI是 `lookup({invocationCorrelation}, trustedContext)` → audit.findInvocation({sourceAgentId,invocationCorrelation}) → 原 `{invocationCorrelationFound,outcome,oldestRetainedIntentTs,retentionIntegrity}`。仅既有相同owner和原trusted-channel关联；Grant缺失照旧拒绝，不自动授read。`agent_session_turn_inspect`虽由原runtime挂载，但其独立权限/更广读取不纳入本新修复范围；原合法使用权限保持，不借本稿扩展。

## 5. B4 — retention / failure / 撤销闭包

原顺序保持：authoritative args+trusted source-turn校验 → appendIntent返回appended → 一次router.deliver → 首个带真实session/message坐标的appendOutcome → 原回复等待/结果。intent append失败，原internal_error且零Router deliveries；已经取得receipt后的坐标/audit/handle问题保留DELIVERED+UNKNOWN，不改成未派发。这里只使用既有append/lookup合同，不额外宣称底层fsync或建立另一SSOT。

wait-reply timeout停止等待，target Run继续；原timeout/replied/target_run_failed/not_admitted/reply_unavailable/outcome_unknown逐类保持。UNKNOWN/失联/EOF/超时禁止重发send、换RID、重开Session、清fence或推定已回滚。原入口若已派发则同号查询其原结果；没有可用owner/handle、retentionIntegrity不足、not-found或lookup失败都不能推“从未发送”。不自动升级old UNKNOWN为success。

源进程stop/已观察exit在gateway lookup前由原parent barrier阻止；过时generation/sourceTurn会缺失有效send context并在原handler中阻止Router delivery，不能将两者合称零credential-use。此单元不修改其对lookup的原适用或把send的active-turn校验强加给lookup、不凭token建立新owner；已停止child不能通过新child/新Session继承原请求。原其他已经合法的sameRID恢复/结果读取authority保留；若本carrier无可用原owner read入口就诚实UNKNOWN，不补造一个接口。target已派发效果与source撤销分开，不取消或重发target Run。

## 6. B5 — 请求接受的最小条文

以下文字为**拟议例外**，目前未接受；不是把CredentialV1 Scope1708–1714的Runtime/Router NONE解释成已有许可：

> 仅为AUTH_P4_FIXED_ORIGIN_BROKER_RESULT_PATH_V1，在与原业务授权和原PDC activation相符的固定origin上，允许形成真实受保护505 parent-owned Agent/proc/RPC及Session/turn/generation/stop-barrier信任归属，以复用原broker的send及已独立获准的同号lookup。此为有限Runtime/Router activation归属例外，不是独立502 reader/外部attach、整体域切换或新token服务。无法保持本单元UID/root/domain/runtime/目标限制时不准激活；其具体必要影响须由有权角色另列接受。原B770–772/786的ACTUAL身份、child无secret/token，以及G.1/H custody、Auth签发、原Client/Grant/resource/scope均不变。

该例外若不获接受，原NONE与原activation边界继续控制。FleetOAuthV3不会变成MC reader权；PDC family表不使profile启用。canonical parent0:0/0755与G.1的差异仅交原Auth custody适用，既不是send根因证明，也不授权本线chmod/chown/ACL/搬store。Auth source change ceiling为空；若以后真实触及其接口/claims/权限/custody，只裁那一项，不用本对口“通过”追认新policy。

## 7. B6 — source ceiling / 生命周期 / 可核验证明

**选择R的最小产品source变更集为空。** 已有createParentRpcHandler、gateway.execute、messaging send/lookup和原child relay已给该真实parent-owned模型完整call/return/failure路径；不为本稿加包装层/模块/ACK或新实现来制造进展。所有19个固定source/dependency pin保持原4114字节；source-closure列明旧13证据复用、两项新增业务source与四项仅metadata依赖边界，不称完整部署包或全程序传递闭包已审。

真正最低缺口是B1/B2的**实际信任生产者及profile activation归属变化**：现有独立502 launcher没有外部attach API，不能仅改compose.js:383/433 credentialsFile；现有505parent如何真实取得该固定origin/session/target-domain管理权必须由具体activation manifest说明，不能在本文编造。原trusted installer/launchd只是被引用的能力，本单元不改、调用或安装它们。若要求保留独立502运行形态，则最少缺的具体source ABI为：(i)当前Router实际ownership到受保护issuer的不可伪造证明producer，(ii)505gateway接收/撤销该证明的认证入口，(iii)两边generation/stop-barrier与结果owner消费。现有四文件seam compose / parent-rpc-relay / gateway / broker index均不提供这种外部attach闭包；没有可据实选择的认证根，本文不把它写成现有接口或可实现Spec。该I分支未选择、未授code ceiling，不展开一般平台。

未来必要离线核对仅在接受物明确后办理：原4114各保留模块whole-byte/inverse；真实owned-parent RPC正例与独立502/PID/env/self-ID伪装负例；exit barrier在gateway/credential getter前拒绝，stale sourceTurn/generation按原gateway→handler顺序保证deliver0而不伪称Auth0；two-envelope unwrap逐字等价；同一次send仅deliver1、intent失败0、后receipt失败UNKNOWN且不重发；原owner同invocationCorrelation lookup不越权；无Grant时原deny；token/secret不进入502输出。不得以这些fixture或源码模型代实际loaded/activation/DB/currentcredential。此任务不跑这些测试或新probe。

实际恢复阶段仍由原部署角色在已接受且确实适用的profile内核current target/root/domain/code generation、单writer/window/撤销、预像与rollback、实际parent关系及原UNKNOWN隔离；当前没有admitted activation manifest。对普通既有恢复效果不泛化重批，但不能把本设计当新profile启动或跨域许可。现业务恢复未完成；此稿不输出apply命令。

## 8. 单一可裁接受物与归属

接受物是本完整固定文档及其source-closure pin，具体可裁点：(1)接受或拒绝B5的有限trust/activation归属例外；(2)确认R是唯一选定既有carrier、现source变更集为空、当前P4不能直接激活；(3)确认若R的实际activation影响超出固定限制，必须先以该具体影响形成有权接受物，不能把缺profile当已获外部attach权。不存在隐含新Auth批准、全域迁移或实施许可。

本稿 **READY_FOR_DOCS_REVIEW，NOT_READY_FOR_IMPLEMENTATION_OR_APPLY**。作者为原1437委托的 `/root/sol_execution_continuation`（requested gpt-6.1-sol/ultra，native effective UNKNOWN）；非作者材料审为既有 `/root/sol_e40_independent_reader`。新MC接受者仅repository owner mayf3或此精确docs-only PR中明确授权的maintainer，绑定reviewed final head；本线不自认资格、不自行route1378/协调、不新worker。该角色的native线程未持也不妨碍先交完整固定材料；不是要求泛化Owner重批原恢复。

用途期限仅本次P4+4114文档准备；更换source、origin、target、效果或扩大权限均不继承。源码模型、accepted合同、actual installed/loaded、live invocation和业务结果分账。B1未成立以前绝不称executable ready。
<!-- ORIGINAL-CONTRACT-END -->
