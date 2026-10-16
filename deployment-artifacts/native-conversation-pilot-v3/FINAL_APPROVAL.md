# #1156 v3 精确决定单

## 当前可决定的事项

推荐 Owner 接受 Auth owning [Draft PR #90](https://github.com/mayf3/auth-service/pull/90) 的两份合同正文，并在独立复核记录约束下完成 acceptance lifecycle / main 合入。当前精确候选：

```text
BASE = 57f459804df1b6526a164016ea3aefa12836286d
HEAD = c04599b301f3e757475bc20960992cb5d024106a
TREE = 41a627e290e2139afd6b32202f66a527e3810726
STATUS = proposed
SOURCE_IMPLEMENTED = NO
PRODUCTION_APPLIED = NO
```

| 合同 | SHA256 | 接受后的精确实现边界 |
|---|---|---|
| AUTH_SERVICE_AGENT_CORE_MCP_CONVERSATION_AUDIENCE_CCR_V1 | a052790b5df80b35f9f3020dbb76bf811954798d28b29623a4bafd1079bd16fd | 单SERVICE audience/scope，15路径注册/Bundle/真实issuer与loader验证；MCP拟用1.14.0，保留网站1.13.0预留 |
| AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V1 | b9fa7e0af3ccdad98e2d76ec4dfe0822032d8353429d8698c4952189dca2c76a | 3个新实现文件；独立registry、registry-disable与SERVICE供给/原secret安全交付模式，隔离DB/OS/UNKNOWN一致性验证 |

独立 review 绑定上述 Head，blocker union为空；报告见 `evidence/AUTH-REVIEW.md` / `AUTH-REVIEW-COORDINATES.json`。正文没有被自行标accepted。本决定不合并业务源码，也不代表工具已存在；accepted snapshot进入Auth main后才能另开实现分支。若Base、版本预留或正文变化，重新绑定受影响的精确评审坐标。

建议接受语句：

> 接受 Auth PR #90 在 c04599b301f3e757475bc20960992cb5d024106a 的两份 MCP 合同正文，允许按独立评审完成接受记录及合入 main，并继续其15+3路径源码候选与隔离验证。生产加载、registry/身份/Grant/secret供给、TLS/ACL/Binding配置和首次真实业务往返继续另批。

这次接受请求来自 Auth [AGENTS.md](https://github.com/mayf3/auth-service/blob/57f459804df1b6526a164016ea3aefa12836286d/AGENTS.md)：

> “implementation PR 的 base branch 已经包含一份 `status: accepted`、`implementation_authority: contracts` 且覆盖该变更的 Spec，否则不得开始非机械性实现。”

因此当前可以完成 owning 提案和评审，不能用本聊天的源码准备授权替代 owning 产品合同。其余独立准备已经完成，没有让 Owner 填写UUID、secret、端口或版本。

## 已完成的准备与证据限制

v2 的实际system生产字节基线、18路径通信差量、依赖闭包、跨UID source custody补丁、真实回退字节和185MiB固定归档保持原hash；引用见 `V2_LINK.json`。v3仅为增量批准材料，没有重制v2，也没有重复运行其41/41、实际loader/TLS19/19或renderer9项隔离检查。

Auth此次只有4个文档路径变化；两新Spec schema、13节、20 Contracts完整Acceptance映射通过，治理分发完整性通过。全仓transition仍因旧metadata不通过：Base→Base与Base→本Head同样20项旧错误，新错误delta零；旧HR Dispatcher YAML解析限制对称披露。所有既有Spec正文逐字节保留。Auth产品测试/构建/生成全部NOT_RUN，不能拿旧1.12.0文件或v2 fixture冒充MCP1.14.0实现证据。

## 原执行线后续顺序

1. Owner接受上述owning合同后，实施并固定Auth注册与供给的源码候选，独立验证实际issuer/loader、隔离PostgreSQL、真实UID安全交付和故障恢复。先得到真实包/生成摘要，不能预填未来hash。
2. 原Auth发布Owner在另批的停服窗口内执行未来registry单row+audit事务，原发布线加载并证明source/generated/loaded-runtime/DB一致。供给使用另一批准/nonce/事务；secret只进获批私有escrow与MCP0600文件。connector UUID由原DSH/MCP配置流程生成并读回，不走CSESB永久runtime lookup。
3. 原B7执行者继续其e30条款/修复/原DS链。最新来源为2026-10-16T01:55:18Z原聊天final：离线23/23、未部署、e30 RETAINED、1644个部分输入对象保留。不是新native-terminal证明；本#1156不得重放或接管。
4. 原DS取得业务turn/worker/external-effect/HR写入者的真实drain证明，CAPTURE→ADMIT同一真实rollback generation，再绑定 `draft/FIXED_EFFECT_REQUEST.json` 中system两env、TLS/CA、escrow权限、native配置、source ACL和单Binding的分别批准与读回。现有CONFIGURE_WEC/WRITE_CONFIG不覆盖这些缺项；请求材料目前apply=false，不能直接提交。
5. 全部门槛满足后才另批加载/启用。受信HTTPS `https://127.0.0.1:4443` 的真实POST client_credentials正负协议验收、原Router/BIP/main关联、dot首轮发送/回复/原request_id补取仍需真实证据；health不能代替。

准确运行目标始终为system8788：`/usr/local/libexec/agent-core/app`，root `/Users/authsvc/.agent-core`；不是旧GUI8787。target BIP principal/domain沿v2 pin并在应用前重核。

## 停发、退出与零效果声明

常规停发只移除DSH send，保留resolve/result、MCP enabled、TLS、原credential/read Grant、Binding与全部request/source/ACK/result/UNKNOWN/tombstone。全client/Grant撤销、TLS停用、MCP=false属于全停用。代码回退只走原DS已ADMITTED真实字节代；不覆盖业务根、整个bindings store，不清UNKNOWN/fence，不另mint credential。

本轮未修改生产源码/指针/plist/权限/Binding、未写DB、未生成任何身份/secret、未做生产加载/重启、未发送业务消息、未更改Workflow。原#1156失败session与历史回执保留；无重排队、重放start或同目的新Issue。
