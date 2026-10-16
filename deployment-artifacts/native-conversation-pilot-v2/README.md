# #1156 — 单 Agent MCP 固定部署包 v2

本包只完成源码、候选、配置/权限草案、隔离验证和最终批准材料。生产加载、持久身份/权限、Binding、TLS 服务及首次业务发送均未执行，也没有由本包授予。

## 唯一推荐方案

以真实承载 BIP 的 system 实装 `/usr/local/libexec/agent-core/app` 的逐文件字节为基线，回移已接受通信合同的最小完整实现：18 个运行时文件（11 新增、7 局部修改），另有 10 个测试/fixture 文件。保留原 Router、原 `turn-recovery-v3.json` 恢复权威、HR 启动门槛、Scheduler `47693d4d…` 修复、所有非通信字节和原依赖。无需 main 整树替换。

真实 system runtime root 为 `/Users/authsvc/.agent-core`，Product API 为 `http://127.0.0.1:8788`；MCP 8950，auth-service 4001。旧 8787 进程是另一实例；禁止将本试点发往旧入口。旧 `native-conversation-pilot-v1` 包、分支、哈希和 #1156 历史 failed 回执全部保留。

固定产物根目录：`/Users/yanfenma/workspace/project/pilot1156-fixed-v2`。精确源码 commit/tree、物化闭包、包与回退字节哈希见 `COORDINATES.json` 和根目录 `FINAL_RECEIPT.json`。本地生产字节快照不是一个历史源码提交；新建的 baseline commit 明确记录其来源，不把 launchd 的旧 SHA stamp 当源码证据。

## 交付内容

- `real-baseline/source`：真实 system app 源码和完整已安装依赖快照。
- `real-candidate/source`：在该快照上的最小通信差量、对应测试、完整可离线导入依赖。没有部署时 npm install、外部工作树机器桥接或新 runtime npm 依赖。
- `mcp`：远端 main `90cc8eddfc75fa149cc71210181e8f825f59c601` 的源码及已安装依赖；原本地检出仍为 `46cbba8…`，未覆盖其工作区。两版差异仅已修正的一份文档。
- `deploy-tree`：供原 DS profile 的独立代码载荷。按原 `preserve=["node_modules"]` 语义排除依赖目录；完整离线依赖另存，加载前必须与原依赖读回一致。
- `rollback-private/system-preimage.tar.gz`：已实际保存真实 app、依赖、system plist 字节，含 uid/gid/mode/mtime/symlink/ACL/xattr 元数据；没有复制业务运行根目录。此离线副本尚未被原 DS 承认为 ADMITTED 回退代。
- `packet`：本批准单、RUNBOOK、依赖/overlay/身份/TLS 审计、安全辅助脚本、配置生成规则、auth owning CCR 草案及独立评审。
- `legacy-baseline`：旧 8787 的完整源码快照与原 67-overlay 比较证据，只作历史保留，不作部署基线。

## 授权范围及真实缺项

请按同一个推荐方案审核以下精确变更；它们是分属原 owning authority 的必要前置，批准源码包不能替代其接受与实际读回。

1. **Auth owning CCR 与候选准备**：新增且仅新增 resource `agent-core-mcp-conversation-v1` / scope `conversation.access`，service-only client_credentials。当前 v1.12.0 冻结 runtime 无此 audience，DB 插行也不能启用；先由 auth owning authority 接受 `AUTH_CCR_DRAFT.md`、产生具体冻结源码/生成物并验证，再申请其生产加载。拟定 v1.13.0 只是版本申请，不是已接受产物。
2. **身份与权限**：原连接器 subject 与调用方 product principal 当前 `NOT_ESTABLISHED`。由原身份执行者 attestation 并系统生成一个 connector subject、一个 service/product principal、一个专用 client 和一个 MachineAccessGrant；不复用 reader/Agent 凭据。secret 只由原安全流程直送 MCP 的 0600 文件，公开回执只有生成的非 secret 坐标，自动生成配置，Owner 无需填写 UUID。
3. **固定目标与 Binding**：canonical BIP `agt_build-in-public-agent` / principal `d5b3aeb2-e754-49a9-9914-b963521c0985` / domain `f9b5682c-1c9c-5ace-a7b1-01b9a3be5965`。原 Router 创建专用 `mcp:dot-native-conversation-pilot-v1` → 同一 BIP/main；不用现飞书 Binding。目标 active/domain 已只读重核；其他 membership 不推定为本试点范围。
4. **TLS**：批准后新增固定 loopback `https://127.0.0.1:4443` → 4001 的窄 POST `/oauth/token` sidecar、专用 CA/127.0.0.1 IP-SAN 叶证书与 system Node `NODE_EXTRA_CA_CERTS`。证书/服务实际安装和真实 client_credentials POST 均未执行。精确路径、属主、mode、校验与撤回见 `IDENTITY_AND_HTTPS.md`。
5. **DSH 配置与源保管**：单 client/单 target，operations=resolve/send/result，7 天结果保留，maxRecords=1000。DSH auth 配置仍严格 0600/私有目录；父 UID505 / 子 UID502 的源保管必须有单独精确权限与验证证据，不能靠放宽通用私有文件校验。详见 `SOURCE_CUSTODY_ACL_DRAFT.md`：只给两个父目录 child search、source 叶目录指定父 read/search、文件继承只读 ACE；ACK 保持父私有。源码和真实双 UID 隔离验证已完成，生产实际 ACL/source readiness 仍未执行。
6. **原发布流程**：复用唯一 system profile、原 host mutex、drain、真实 preimage 与 DS rollback admission。当前 e29 retained stage custody 要求原执行者只检查原 stage，禁止 replay；健康、inactive 或锁路径缺失不能解除该门槛。system env/config 固定 effect 也须准确绑定，不能暗藏在代码树里。RUNBOOK 列明 exact 原操作与 STOP 条件。
7. **首次真实往返**：在上述前置接受、加载、权限和原执行线读回全部完成后，另批一条新稳定 request_id。只联系原 BIP，保留 #1135/EP49/旧 UNKNOWN，按原号取回结果，再独立核查博客发布证据/后续分发。源码 fixture 不构成 dot 或业务验收。

## 验证与状态

最终具体测试、负向控制、源码与执行环境坐标见 `VALIDATION.md`。旧包 38/38、DSH 6/6、复制 MCP schema 7/7 作为历史隔离证据保留，不挪作本轮结论。本轮 MCP 草案通过真实 loader 验证，不使用复制 schema。已验收的 HR 聚合、网站、read_artifact 分页未重复运行。

当前没有无条件可运行的生产 apply 命令：auth owning 冻结产物、身份 attestation、原 B7 custody 与 system config effect 都必须由原执行者闭合。这里不给出绕过它们的裸 launchctl 或生产 checkout/install。对这些真实缺项，最终批准应采用文中固定方案及可核验前置，不能以一次批准隐含扩大合同或清除旧 fence。

## 停发与回退

常规停发仅从 DSH operations 移除 `send`，保留 `result`（可保留 resolve），MCP 保持 enabled=true；保留所有原请求、幂等墓碑、UNKNOWN、source 和 result。MCP enabled=false、撤销整个 client 或停止 TLS 都是全停用，会同时阻断补取。

代码回退由原 profile 使用原 DS 已 ADMITTED 的真实字节代完成，数据根不随代码恢复。回退前优先停发；旧代码若无 result API，只能记“字节已保留、reader 暂不可用”，不能冒称结果仍可查询。system 无 wrapper；plist 变化必须恢复其真实 preimage 字节与元数据。详见 RUNBOOK。
