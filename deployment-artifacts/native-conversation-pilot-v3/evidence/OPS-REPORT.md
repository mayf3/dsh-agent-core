# #1156 ops v3 — 只读门槛核实

审计状态：READ_ONLY / NO_APPLY。仅向原 DS 固定 socket 发已声明的 typed 只读请求，读取既有证据及两个指定 chat；未给这些 chat 发消息、未 steer、未操作 B7 stage/custody/锁/fence、未运行测试、未取得 writer、未改生产。所有新文件仅在 `/tmp/pilot1156-ops-v3-audit`。

## 当前结论

原 v2 文档中的“e29 尚未关闭”已经过时。2026-10-16T01:45:32Z 原 DS 只读回执确认：

- e29 `b7-packet-r27-83054332f5c352f2e-e29` 的 `disposal_terminal.native_state=CLOSED_PRE_TX`、`installed=false`、`next_action=COHERENT_CANDIDATE_NEXT`。原主记录仍保留 `phase=RETAINED/reason=EXECUTION_INTENT/tx=null/native_terminal_verified=false`；这与独立 disposal 终态并列保留，不能改写成业务已安装。
- 后继当前对象为 e30 `b7-packet-r27-758d5250f5c352f2e-e30`：`active=false/attempt=1/phase=RETAINED/reason=EXECUTION_INTENT/tx=null/native_terminal_verified=false/installed=UNKNOWN/loaded_business_proof=false/replay_allowed=false`，下一步为 `INSPECT_ORIGINAL_STAGE_CUSTODY_NO_STAGE_REPLAY`。
- 原 `DS_B7_OWNER_OUTPUT_V2(cursor=0)` 读回 5649 字节至末尾，确认 e30 `STOP_PARTIAL`、`outer_entered=false`、`ORIGINAL_ROOT_SOURCE_VALIDATION_REFUSED`，且部分代码输入目录/源码及 seed 已被原执行写入。没有 native TX 不能推出没有效果或允许重放。
- e30 lifecycle 仍为 `REGISTERED_ONLY`、`evidence_reason=NATIVE_STATE_NOT_FOUND_NO_EFFECT_INFERENCE`、`retained=true`；其 `execution_enabled=false` 与 execution 面的 true 分别来自不同证据面，均保留。

当前 sole B7 执行责任在聊天 **B7 v4.9 接替 ZCode：修复、复核与上线**（`01a1421a-5bbe-70d3-8ce0-a595ed9b9e7a`）。该聊天最新可读说明：root 无 `SUDO_UID` 的清空环境触发 Git 属主保护，包内已有属主降权读取 helper；最终一次 `wait_threads(timeoutMs=0)` 快照进一步报告：离线修复23/23真实root/uid502回归通过，使用与原DS相同环境读取真实app source的HEAD/tree/clean均通过，**修复尚未部署**；固定e30最小amendment的独立条款评审无阻断。该快照没有证明amendment已accepted/merged、控制器已加载新条款或e30已关闭。现有仅限e29的关闭条款仍不能自行泛用于e30。这里的 root cause 来自原执行者调查；本审计未复跑它的校验/测试。

**#1156 当前不能发布。阻断是 e30 同一操作的部分写入 custody/关闭语义尚未完成，不再是 e29。** 允许的下一步是由上述唯一原执行者将已准备且独立审读的最小条款按原治理落实为accepted authority，再沿固定e30原操作完成合法终结与部分输入保全，并只读核终态。本审计只能继续只读，不能删除 e30 输入、套 e29 disposal、换 op 绕过或提交 generic DEPLOY。

## 真实目标与现有能力

目标固定：`system/ai.agent-core.runtime`，app `/usr/local/libexec/agent-core/app`，root `/Users/authsvc/.agent-core`，Product API `127.0.0.1:8788`；非 8787 GUI 或 scheduler-v2。

原 DS 磁盘 SHA256：`dc88a927caa23ea2ab775e025732ef5c1487737056577a29461f40a8d57bf51b`。DS_INSPECT 返回相同 hash，但 `loaded_identity=UNKNOWN`。单元读回 `HEALTHY/ATTRIBUTED/stable=true`，registry generation `30aa3e6454a165cc975aa5660185d77bc89c70979a11f78d4f7c27303317c779`；`installation=UNKNOWN/current_runtime_verified=false`。健康和磁盘字节均不能替代 loaded JS 身份。

系统 plist 当前 SHA256 仍为 `c41e1c18ea87517df1e5674f9f63761498c653f24cd7596754ae657d6767dc59`，原 DS 证明 loaded argv 与 plist 相同。固定 argv 保持 Node→production-runtime.mjs、`--root /Users/authsvc/.agent-core --catchup 0`。公开定点读回确认 `DSH_AGENT_CHILD_UID=502/GID=20`，两个拟新增 native env 当前均 absent。现有 event-correlation 修复 SHA256 仍为 `47693d4d79af4e0643078e4f178bd341457b8418c07892d1a65d846f07af58bc`。

能力界限（原 installed source 行号见 `controller-source-excerpts.txt`）：

| 能力 | 当前实际覆盖 | 对 #1156 的含义 |
|---|---|---|
| `scheduler-whole-main` tree DEPLOY | 固定 app tree、uid505/gid601、preserve=node_modules；要求 admitted rollback ID；受 mutation.lock | 能装批准的窄 app 差量；不顺带改 plist/TLS/ACL/Binding |
| `CAPTURE_CURRENT_GENERATION` | expected registry/tree/preserved 三 hash，固定生产对象；保存字节、依赖、metadata；返回 CAPTURED_UNPROVEN | 存在真实捕获动作，但未等于可回退 |
| `ADMIT_CAPTURED_SCHEDULER_ROLLBACK` | 同 capture；固定受限 cold boot/import probe、生产运行 UID、复核前像与闭包、fsync、trusted proof 和 pointer | 只有 ADMITTED 后的 capture 才能作本次部署 rollback generation |
| `CONFIGURE_WEC_SYSTEM_PRODUCT_API_8788` | build 函数只设置 PRODUCT_API_ENABLED=1 / PRODUCT_API_PORT=8788，旧固定 preimage/receipt/rollback 语义 | 不能复用来添加 native config/CA 两键；当前本来已 8788 |
| `WRITE_CONFIG` | 通用 root 下 JSON，0600/chown505:601；无所需精确 preimage、postimage、语义范围及配套 rollback | 技术上存在，但不能当本次批准的 fixed effect，更不能写系统 plist |
| `DS_UPDATE` 的 `drain_reads` | 只等待 DS 的并发观察读者 | 不是 Router/Scheduler/HR/worker/effect 的业务 drain |
| Binding | installed BindingStore/Router 为唯一 owner；公开 Product API switch 是现有 channel 的 surface/targetAgentId-only | 未发现可据此直接创建/删除固定 mcp key 的已绑定操作；禁止以整个 JSON 重写代替 |

没有发现 installed DS source 中 `PRODUCT_API_CONVERSATION_AUTH_CONFIG_FILE` 或 `NODE_EXTRA_CA_CERTS` 的任何 literal。不能声称已有原配置动作覆盖这两键。需要先由原治理接受并绑定精确 fixed effect；本审计只列效果，不增设/实现控制面。

## 真实 drain 与 rollback 前置

1. e30 部分写入先由其原执行线完成终态/custody证明；无重放、无 fence 清理。一次 `active=false` 或不存在 mkdir lock 不释放这项义务。
2. 发布时由原执行者提供同一批受影响 Router turns、Scheduler workers、已派发外部效果、刷新 writer、HR cut/qualification 的当前有界 census；关闭新 admission 并证明 quiescent。不可读、UNKNOWN 或未证明项必须停；保留所有旧 UNKNOWN/fence/journal。
3. actual app 当前不存在 `packages/agent-router/src/restart-drain.js`。原 DS `restart_runtime` 只有 launchd bootout/bootstrap/有限卸载等待，没有上项业务 drain 证明。不能用 dev tree 模块、DS reader drain 或 health 补此证据。若原执行线另有已接受 drain 路径，须明确其调用及回执，不能假定。
4. 原 executor 在其 mutation domain 内捕获固定当前 app + preserved node_modules + required metadata，提交 CAPTURE 后保持 `rollback_eligible=false`；再对同 capture 提交 ADMIT 并实际获得 `ADMITTED`、trusted proof 与 rollback pointer。
5. DEPLOY 必须引用该 admitted capture ID 并绑定新测量的 registry/preimage/artifact tree hashes。当前 registry hash 可作为审计 pin，不可在以后不复读而直接套用。未知 restart/回执丢失进入同 op 只读分类，不能重试。
6. 只可由原 ROLLBACK 克隆 admitted capture 的完整独立 `.ds-rb-*` 闭包、切换及受控 restart。v2 `rollback-capture.json` 明确 `DS_rollback_admitted=false`；离线 tar/preimage 完整不授予生产回退。
7. 回退不恢复/替换 `/Users/authsvc/.agent-core` 业务状态。保留 source/result/ACK、requests、tombstone、UNKNOWN、bindings/bookmarks、jobs/runs、sessions、credentials、B7 transaction/fence。旧代码若缺 result reader，只能明确报告读取不可用。

`release-runtime-fence-census.json` 里的路径是旧 `/Users/yanfenma/.agent-core`，不覆盖真实 authsvc root，不能当本次 drain/无 fence 证明。

## 效果清单与责任方

以下为可以据此形成原操作的精确效果模板，均 `apply_allowed=false`。未绑定的入口必须如实留 UNBOUND；当前没有安全可直接执行的完整生产命令。

| 效果 | 固定范围 / preimage | 负责方与允许的下一步 | 回退模板 |
|---|---|---|---|
| systemconfig / env | 仅原 system plist 两键：`PRODUCT_API_CONVERSATION_AUTH_CONFIG_FILE=/Users/authsvc/.agent-core/config/native-conversation.json`；`NODE_EXTRA_CA_CERTS=/usr/local/etc/agent-core-native-auth-tls/ca.crt`。当前两键 absent；完整 plist 原字节、uid/gid/mode/ACL/xattr/flags 要私下留存 | 原 system 配置/发布 authority。先接受并固定两键 effect + 受控 load + readback；原 UID/GID/helper、HR、BROKER_AUTH_ORIGIN 及其它 env 全保留 | 验证预期 postimage 后，原入口恢复确切 plist 字节和 metadata，再受控 load；不只删两行，不用 GUI wrapper |
| native JSON + MCP | DSH 配置固定 authsvc root/config，dir0700、file0600、owner505:601；MCP public config 固定 yanfenma read-mcp，endpoint8788；生成时 enabled=false。secret 单独直达0600 credential file，绝不进入本模板 | 原 auth identity authority 提供真实 attested receipt，再用现成 offline renderer；原配置 executor 安装/读回。无 receipt 不猜 ID；不能复用 Workflow reader client | 普通停发只去掉 DSH operations 的 send，保留 resolve/result 与 MCP enabled；完整退出用单对象比较后补偿，保留凭据/授权用于结果读取，除非另批 full disable |
| TLS facade | 固定 app `/usr/local/libexec/agent-core-native-auth-tls/proxy.mjs`；专属 plist `com.agentcore.native-auth-tls`；仅127.0.0.1:4443→4001 exact POST /oauth/token。专属 CA/leaf SAN IP127.0.0.1；root issuance key0700；dir0750 root:authsvc、leaf key0600 authsvc | 原 TLS/system executor。三个公开目标本次 lstat 均 absent；安装前重新核全部 preimage/4443 port、hash、证书和 trust。已有 v2 fixture 证据无需本审计重跑。生产 OAuth POST 单独批准后，由同 DSH Node/authsvc 环境做 | 普通停发保留 TLS 以读 result。full disable 先声明结果不可读，再停专属 unit，恢复独立 env preimage；不动4001、既有隧道或其他 TLS/CA，私钥按保留政策处理 |
| source ACL/ACK | control、native-conversation 仅给502 named search无继承；source writer502:20/0700，parent505 dir search/readattr/readsecurity 与独立 file-only inherit read/readattr/readsecurity；source0600；ACK505:601/0700与文件0600，无502权限 | 原 runtime permission executor。逐对象完整 ordered ACL/preimage、symlink rejection、真实两 UID；先保持native disabled/send去除，再对真实路径做零业务 custody probe。/tmp测试不替代真实路径 proof | 普通停发保留权限和 source/ACK。full withdrawal 保留历史对象，只按预期 postimage 移除本次精确 ACE或还原同对象旧 metadata；不清全 ACL/递归 chown/删除历史数据 |
| dedicated Binding | 仅系统 root 中 `mcp:dot-native-conversation-pilot-v1`→`agt_build-in-public-agent`/原main；现有飞书 Binding保持不变。目标 principal/domain 使用 v2权威并在执行前重证 | 原 Router/supervision executor；先确认可用的固定 mutation入口、当前main generation、单key pre/post与routing_version。无已接受操作则是 UNBOUND blocker，不能用 WRITE_CONFIG | 停发时保留 Binding与bookmarks。若另批移除，只能原Router按单key预期版本补偿；不恢复整个 bindings.json，不伪造 delete API。没有受支持单key退出入口则保留禁用 Binding并报告 |

Auth audience/client/grant、connector attestation、caller product principal 等不由 systemconfig/TLS/ACL/Binding 效果隐式创建；它们仍是原 auth-service owning contract、runtime bundle、guarded reconcile/release 与新权限批准的责任。真实 token POST 与首次 BIP send/result acceptance 不在本次授权中。

另一个活跃聊天 **接续私有网站固定 Agent 问答上线**（`01a1421a-2d8f-7fc0-9450-38715d26e9fe`）正为旧8787网站上游、本机Auth模式准备适配与条款；该聊天的 Auth/TLS 方案、测试及修复不等于 #1156 的8788加载或授权。4001 Auth是共享依赖，任何最终 effect应绑定唯一原 authority 与实际前像。本审计没有与其协调或发送信息。

## 交付与证据限制

- `observations/*.json`：本次原 DS 完整只读响应；原 output base64 被保留在私有0600证据内，安全错误摘要在 `e30-output-safe-error-lines.txt`。
- `system-plist-public-facts.json`：仅公开字段，无其他 env 或 secret；`installed-controller-source-pin.json`、`authority-pins.json`：实测 hash。
- `EFFECTS.template.json` 与 `ROLLBACK.template.json`：具体效果/回退请求模板，明确禁止自动 apply；所有新 op ID/测量 hash/批准引用留待原 authorized step 实测绑定。
- 两个 chat 的摘要只读保存。原 B7 root-cause 结论来源清楚标为原执行者，不冒称本审计复测。v2身份/Binding/auth数据库证据是既有包事实，未在本审计重新查库；启用前必须新读回。未执行任何旧测试、未重做 v2。
