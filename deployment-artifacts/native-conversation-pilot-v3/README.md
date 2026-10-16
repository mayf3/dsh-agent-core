# #1156 v3 — Auth owning 合同与原发布线批准材料增量

本版本追加 v2 的缺口准备；不重做 v2、不改变其源码、包或历史回执。v2 的41/41、loader/TLS19/19是既有隔离证据，本轮不重跑、不升级为生产或 dot 往返验收。v3不包含任何生产/DB/身份/权限/Binding/TLS/ACL写入，不发送消息。

## 本次可以具体决定的事项

推荐接受并合入 Auth owning 仓库的两份精确 proposed 合同：

1. `AUTH_SERVICE_AGENT_CORE_MCP_CONVERSATION_AUDIENCE_CCR_V1`：单一 SERVICE-only resource `agent-core-mcp-conversation-v1` / scope `conversation.access`，未来15路径注册/Bundle/真实loader/针对性测试闭包。当前源码1.12.0、12个audience；已接受网站CCR预留1.13.0，MCP推荐1.14.0，不依赖网站上线，也不顺带实现网站entries。
2. `AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V1`：单一MCP audience的受控DB reconciliation、单SERVICE principal/client/MachineAccessGrant与安全首次secret交付的有界实现合同。明确DB与文件非原子窗口、nonce/CAS/audit/escrow/原号UNKNOWN补查与原secret恢复；未来命令目前不存在，不能冒称现成工具。

两者的 `implementation_authority: contracts` 只声明未来精确接受且进入main后可实施的闭包；当前status均proposed，实施/运行许可均NO。外部v2 `AUTH_CCR_DRAFT.md` 的none状态保留，未被自行接受。现有Auth AGENTS要求accepted Spec在implementation Base中；因此本轮没有改Auth registry、Bundle、generated runtime或产品源码。下一步是Owner对独立评审后的精确合同Head作接受决定，不是让Owner填写UUID/版本/端口。

## 已收敛的身份与效果方案

- connector_subject是DSH/MCP受控配置生成并持久保存的稳定opaque UUID，映射原authenticated transport与一个verified client。它不是Auth token sub，也不是CSESB的enrollment business_subject_id。CSESB temporary source-binding不能变成永久运行时auth/routing lookup。
- Auth新SERVICE client的legacy allowedResources/allowedScopes保持空；授权只来自该audience的精确MachineAccessGrant。v2草案要求填legacy allowlists的部分由本增量明确纠正，不改旧包。
- 现有enrollment CLI缺少生产trustedEvidenceProvider，machine-admin会输出一次性secret，generic client API重试不返回原secret；它们都不足以完成本试点安全供应。新的有界vehicle需先有owning acceptance与独立隔离证据；不复用reader7711…或目标Agent d5…作caller。
- 专用Binding固定 `mcp:dot-native-conversation-pilot-v1`→原system BIP/main；真实endpoint8788。目标principal/domain沿v2 pin，执行前重核。所有新UUID由获批原流程生成和读回，非模型/用户填写。
- TLS仍是 `https://127.0.0.1:4443`→4001 exact POST `/oauth/token`，沿用已冻结v2 sidecar与证据。专用CA私钥固定准备为root:wheel0700目录 `/usr/local/var/agent-core-native-auth-tls/issuer`，key0600；没有生成或安装。system两项新增env、native配置、证书、source ACL与Binding分别列成原owner的固定effect request，禁止自动apply。

## 原发布门槛更新

v2的e29阻断已经过期：原DS在2026-10-16T01:45:32Z读回e29为 `CLOSED_PRE_TX`。当前e30是 `STOP_PARTIAL / RETAINED`、outer未进入、native_terminal未证、replay=false；部分源码输入已写。原B7聊天仍是唯一执行者，已报告离线修复与最小条款独审进展，不等于修复部署、条款接受/合入或e30关闭。

原B7执行者在2026-10-16T01:55:18Z结束本轮并idle，报告离线23/23和独立复核通过、修复尚未部署、e30仍RETAINED且1644个部分输入对象保留；下一步是其固定e30 amendment的接受门槛。这是原执行者报告，不是新DS native-terminal读回，也不是本#1156可以接管的授权。

实际system仍8788、原app/root不变。原DS当前不覆盖两个native env的精确plist effect；WRITE_CONFIG不能代替plist变化或Router Binding，CONFIGURE_WEC只覆盖它的原有两键。业务drain、原CAPTURE→ADMIT rollback资格和各原配置/权限effect须分别读回。此处不接管B7、不重放stage、不清锁/fence、不另建部署器。

## 交付索引

- `AUTH_IMPLEMENTATION_PLAN.md`：15路径未来源码/生成/测试步骤与准确的NOT_RUN状态；旧1.8测试漂移不暗修。
- `AUTH_SPECS/`：owning proposed合同的完整副本，exact commit/tree/hash见最终坐标。
- `draft/FIXED_EFFECT_REQUEST.json`、`draft/ROLLBACK_REQUEST.json`：原owner需绑定的固定范围、前后像、metadata、读回和退出语义。新批准/op/测量字段来自原受控回执，非Owner手填值；未绑定处是已指明的接口缺项。
- `evidence/AUTH-*`：现有accepted authority审计及新合同独立评审。
- `evidence/OPS-*`：最新原执行线状态和效果能力审计；原始owner-output仅留私有引用，不进入Git。
- `V2_LINK.json`：v2源码/包/回执hash依赖；无v2重制。
- `FINAL_APPROVAL.md`：精确待决定边界和后续原owner任务。

## 停发与回退

常规停发只移除DSH send，保留result、MCP enabled=true、TLS与read Grant、原credential、Binding和全部requests/source/ACK/result/UNKNOWN/tombstone。撤整个client/Grant、停TLS、MCP=false均是全停用，结果认证也会失败。

代码回退走原DS已ADMITTED真实字节代；不恢复整个业务根或bindings.json，不清旧UNKNOWN，不为恢复另mint client/request。原plist恢复真实字节/元数据，ACL只按精确postimage回退本次ACE。旧代码缺result reader时，明确“数据保留但暂不可查询”。
