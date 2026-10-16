# #1156 v3 ops packet — 只读审查

审查时间：2026-10-16T02:04:31Z。审查对象仅下列三个文件；未编辑候选包、未发跨chat消息、未触发DS变更或B7操作、未运行旧测试。新写入只限本报告与指定的 STATUS_ADDENDUM.json。

结论：**PASS — 作为不可自动提交的 contract/effect request 材料，无阻断性发现。** 此结论不是implementation authority、生产加载、权限、drain或业务验收PASS。Auth合同/身份设计本身的合规性不在这次ops能力比对范围。

## 固定的被审字节

根目录：`/Users/yanfenma/workspace/project/dsh-agent-core-pilot-deploy-v1/deployment-artifacts/native-conversation-pilot-v3`。

| 文件 | SHA256 |
|---|---|
| README.md | ec0a9b5134704f4bf534e4c8c74e4fe7ec3e0708ddd23bced238eef6b33a0178 |
| draft/FIXED_EFFECT_REQUEST.json | aa50903359e8ffef5d1418fc13fe95d12594c87405d4936d5fdc3a53224071f1 |
| draft/ROLLBACK_REQUEST.json | 4743fe33e2a302609cf087fb1d6602b26f09ddbb85bea43dea62b32a1190a269 |

首次读取和审查末次复读三hash完全相同。两个JSON均成功解析。当前installed原DS source重新实测仍为 `dc88a927caa23ea2ab775e025732ef5c1487737056577a29461f40a8d57bf51b`，与本审计先前所读能力源一致。

## 能力与安全边界

1. README第26行正确区分：现有tree profile不会写system plist；`CONFIGURE_WEC_SYSTEM_PRODUCT_API_8788`只固定原PRODUCT_API_ENABLED/PRODUCT_API_PORT两键；通用WRITE_CONFIG不能替代两个native env的精确效果或Router Binding。FIXED_EFFECT_REQUEST对system-env/native-config/TLS/ACL/Binding分别标UNBOUND、NOT_ISSUED，且顶层 `template_only=true/apply_allowed=false`。没有伪造一个现有的native配置命令。
2. ROLLBACK_REQUEST明确 `requests_are_not_submittable_until_bound=true` 和 CONTRACT_REQUEST_NOT_EXECUTABLE_COMMAND。三个原DS动作名称与字段集合正确：CAPTURE_CURRENT_GENERATION绑定registry/tree/preserved三hash；ADMIT引用同capture且需不同admission ID；ROLLBACK的generation指向admitted capture ID而非admission ID。当前request中的NOT_ISSUED对象不是原协议可接收的string，故它们只是材料、不能直接发送；没有将其包装成可运行命令或脚本。
3. CAPTURED_UNPROVEN保持rollback_eligible=false；只有原ADMIT可信probe/复核/指针后才有资格。业务drain和B7 e30终态/custody列为独立前置，未用DS reader drain或health冒充。README仍明确不接管B7、不重放stage、不清锁/fence。
4. 常规停发仅移除DSH send，保留resolve/result、MCP enabled、TLS、credential/read Grant、Binding、ACL及全部历史数据。没有撤整个client/Grant、停止TLS或MCP=false的常规停发步骤。完整停用单列并明确结果认证/reader不可用，因此不会悄然破坏结果读取。
5. code rollback使用原DS的已ADMITTED真实字节代；没有覆盖 `/Users/authsvc/.agent-core`、整个bindings.json、ledger/fence或会话/历史。system plist比较精确postimage后按原fixed effect还原真实字节/metadata；ACL只回退本次精确ACE。Binding没有假造delete API；缺少受支持单key补偿入口时保留禁用行并报告。
6. TLS仍专属127.0.0.1:4443→4001 exact POST /oauth/token。专用issuer目录是新提出的固定效果，不是已经部署的能力；fresh absent/exact preimage、不得覆盖现有CA、UNBOUND TLS入口和apply=false都明确。没有复用现有4001业务身份或要求Owner填写UUID/secret。
7. 新env两键、TLS、ACL、native JSON、credential、Binding分别有原owner/受控回执绑定要求，没有被藏入app tree payload。未来load/readback与真实请求仍有分开的门槛。受控写入的技术实现尚不存在/尚未绑定这一缺口没有被掩盖。

## 非阻断措辞建议

**[P3] FIXED_EFFECT_REQUEST.json第177行**：`routing_version` 注释为 `1 per approved pilot proposal; verify actual receipt`。这仍是说明字符串且受apply=false约束，没有造成可执行越权；但“approved”可能被读成现有运行授权。建议后续作者将其收紧为“proposed expected routing version 1; exact authorized Router receipt required”。本审计没有编辑该文件。

README第24行把e29简写为CLOSED_PRE_TX，与先前原DS的独立disposal_terminal读面相符；其原主execution仍保留RETAINED/UNKNOWN字段。当前上下文没有宣称e29业务安装成功，故不构成阻断；保留完整读面来源会更精确。

## 一次状态刷新产生的material addendum

只执行一次 `wait_threads(timeoutMs=0)`，使用上次cursor `efd3707f-ecb6-4727-9033-6faa8284b928:2`，未向该chat发送消息。

原B7聊天 **B7 v4.9 接替 ZCode：修复、复核与上线** 的turn在2026-10-16T01:55:18Z完成，现为idle。其最新final报告：离线修复23/23回归和独立复核通过，但尚未部署；pair已COMMITTED、e29已关闭；e30仍RETAINED，1644个部分输入对象保留，B7尚未完成。下一步等待用户接受固定e30 amendment，当前只读快照可见短引用 `8f858833…`，不能把短引用冒称完整hash或accepted/merged事实。

这是原执行者报告，未替代新的DS native-terminal回执；本次未再请求DS状态。README的保守e30 blocker仍成立，建议补充“原executor当前idle等待精确amendment接受”的责任与停点即可，不得写成只剩Owner本人FD3、修复已部署或e30已合法终结。

完整compact快照、来源、已变/未变事实与证明限制保存于同目录 STATUS_ADDENDUM.json。除此一次刷新外未poll或跨chat协调。
