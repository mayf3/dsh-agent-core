# 首个真实 dsh 自动部署闭环：当前交付状态

更新：2026-09-18。父 Goal 仍是 PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1，沿用 Owner 已接受 Spec3986553。本页维护当前状态；旧观察、失败和审查记录保留在 `.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_FIRST_LIVE_CLOSURE/`，不重写历史。

**禁用安装已完成。首个真实自动部署尚未完成。Owner 已授权 p2 exact package/plan，但最终执行前核验发现生产字节、Runtime 代际及包外 root preflight 活动与冻结前态不一致，因此在进入 package launcher 前安全停止。** 本次没有请求管理员认证、没有消耗 package attempt，也没有执行本 Goal 的生产 mutation。该 exact 授权不得对漂移后的状态重放。

## 2026-09-18 exact 操作安全停止

授权绑定 operation `first-live-dsh-20260918-01`、package SHA256 `4a83c4c36828f593fdc4419ae6eef8470fb7f918b5334b360b8b451690edcc1a`、plan SHA256 `fffde6f6bd4da74e3058acfa0ae24b7062db087a6507c471656fecb96c4fe4cf`、attempt limit 1。package 和 plan 自身摘要匹配，但执行前环境不再匹配其冻结前态：

- app content 从冻结的 `e1edd673bb422ee4d5a58d8ccfb9b5d0cb4577ff79978d118813ffaf63f84af9` 变为 `57a14f9c07ab036cc241191654de9eb96a884dd809aae579ce10adcce5e427df`；唯一变化文件为 `packages/broker/src/capabilities/workflow.js`，当前 SHA256 `ecddc1b7cb07addf4890bdb39a0314da0570b992e13ba67bc6e0f3928026932e`，既不等于包的 preimage `d76791b7ebbacc872343ba8a26d13ce1f4f2315f4ff5a53fc8744f445b1e65ee`，也不等于授权 target `6f116d94b58a739216d2af2b25dfd51b32268aba26dcea281f16199f70ff93b2`；
- 观察到包外 root 进程 PID 43760，命令 `sudo ./deploy-auto-recovery-cfc2729-g2.sh --preflight`，PPID 1；本 Goal 未终止、清理或接管该进程；
- Runtime PID 在核验窗口内从 47575 变为 59762，说明服务代际仍被外部执行线改变。

实际回读：controller 仍为 Disabled=true、RunAtLoad=false、KeepAlive=false 且未加载；Runtime PID 59762 健康，部署 SHA 仍读为 `d602b592fad345fb1c9adebe2bc6611a6f5cfdc2`；W1/W2 均处于一次性任务的空闲态且 last exit 0；Tailscale PID 836 持续运行，仍使用 `/usr/local/bin/tailscaled`。Watchdog 真实验收、部署义务关闭和 outbox 完成均未执行。production lock 目录为空，operator journal 不存在。

安全停止证据为 `first-live-preparation/preexec-safe-stop-20260918T133752Z/observation.json`（SHA256 `b0b5b13291ec97d06f1de10925552f960a2fe38c4f512365307b503f155a7d91`）和同目录 `final-readback.json`（SHA256 `b696572d22876b8ba020897a7c1ae399b7d8769b65d5d39e10f0e73cc08e7c20`）。

## 首个真实交付

接管实际已有的 Watchdog 基线 → 真实当前代际验收和 canary → 放行 Broker 的真实待部署字节 → 自动安装、回读及更新后验收 → 原部署义务回执/CAS关闭。业务 Goal 是否完成仍由原业务权威判断。

Watchdog 实际冻结来源为 `d602b592fad345fb1c9adebe2bc6611a6f5cfdc2`，所选 incident-lifecycle.js 与已安装字节相同，故基线采用零业务重装。Broker 选择 `59472b631129d1ea3ca1202cbcbbc0799b083114`，workflow.js 候选 SHA256 `6f116d94b58a739216d2af2b25dfd51b32268aba26dcea281f16199f70ff93b2`；最新普通回读仍为 `d76791b7ebbacc872343ba8a26d13ce1f4f2315f4ff5a53fc8744f445b1e65ee`，确有待部署事项。执行前若其他受权流程已装同一字节，则在维护前停止并按真实状态做接管验收准备；本次固定提交包不会为证明部署而重复安装。

注意：零业务重装不等于整个接管维护零停机。撤销旧写权限及替换 Node/loader 闭包需要按最终包对既有 dsh Runtime/W1/W2 做精确维护停启；其后 Watchdog 基线验收不再额外安装相同业务文件。计划中另外一次 Tailscale 同版本保护路径切换会影响其网络连接。两者都须在最终 Owner 包明确授权和恢复边界。

## 已跨过的关口

- exact 禁用安装成功；原 attempt `genesis-65559dd-20260918-01` 未重置。受保护安装后回读结果 SHA256 `5168000958f4778e1a9adfa06db1ddee576f890c204c292d4c7a384edf7e52cf`，独立核验通过。一次登录超时，UNKNOWN 保留；未重试。
- 最新普通禁用状态观察仍为 Disabled=true/RunAtLoad=false/KeepAlive=false、system/ai.agent-deployd absent。它不替代新的受保护前置，也不宣称所有现有进程持续未变。
- 真实业务绑定、已安装基线接管、同目标合法替换后的延后验收及 Watchdog 语义验证已实现并完成相应独立审查。上游 svc-workflow 当前实现兼容性已核验；不纳管、不重启它。
- 已冻结实际库存、22项 Node loader 文件、三条实际旧入口和两条缺失源入口。四条准确的可选依赖缺失边及旧 Node 探针已独立审查通过；完整退役接线仍随最终顺序审查。
- Tailscale 同版本真实发布来源已独立核验：官方 Homebrew registry index→manifest→bottle→唯一文件，字节与现安装一致。静态候选只改变 plist 的 ProgramArguments[0] 至新受保护路径；未安装。
- 新发现的 issuer 完整结果在 peer 关闭后误判失败已确定性复现并修复于 `76fff5c`，独立限定源码审查 PASS。保留原完整测试失败记录，不将它改报通过。
- 原登记空前缀桥接已在 `e45ede6` 独立复核 PASS，RB01/02/03 全部关闭；六角色托管发布已在 `44baf38` 独立复核 PASS，CT01 发布前过期检查也已复现并关闭。均未生成生产新钥。
- 新专用登录及真实公钥/回执绑定已在 `0941781` 独立组件审查 PASS：原 UNKNOWN 不变，不预填成功，子进程 FD 隔离和 partial/crash 禁止重试已验证。
- 当前有限 root 角色、运行加载环境、主流程顺序及 Tailscale 固定一次切换已在 `32767f0` 独立复审通过；HT-01 当前旧字节校验及 HT-02 Darwin FIN 后 peer 身份回读均以真实失败复现关闭。14个 XPC 动态域和实际网络/进程读回仍是未来授权内前置，未把夹具当真实读回。

## 唯一剩余路径

| 关口 | 具体剩余工作 | 当前状态 |
|---|---|---|
| 关闭实际 root 入口 | LW helper 首先退役；其他实际入口拒绝或被现有锁序列化；Tailscale 同版本新 inode/保护路径、精确代际停启和回读 | 原生接线32767f0独立复审通过；未获新操作授权 |
| 证明当前无遗留 root 写入者 | 有限固定 OS/服务角色；完整 PID 枚举并覆盖 real/effective/saved UID0；实际启动角色、出生代际、闭包与重复回读，未知即停 | 有限条件策略和原生源码32767f0已独立通过；14个 XPC 动态域需要未来受保护前置，不能用普通读取失败或基线 PID 充当通过 |
| 安全托管及一次登录 | 上述边界闭合后生成六个新角色材料，保留原 state1，追加同 payload 的 PENDING state2，并为原空 snapshot1重新签名保持CAS0→1→2；旧钥只验证精确历史；再进行一次独立 reviewer 登录 | REUSE设计、迁移与登录组件已独立通过；最终 native92f4ace 主流程及终验已独立通过；实际包已通过包级复核。不是重做genesis或清空历史 |
| 真实 Watchdog 前置 | 同一mutex下完成维护/权限拒绝/回读；真实独立issuer构建评审；接管已有基线，实际canary及逐项验收 | 必要原生顺序和验证已实现并受审；真实 canary 与依赖 PASS 只在未来授权操作产生 |
| 首个 Broker 自动部署 | 条件成立才启用controller；普通producer提交真实候选；自动Train安装、健康/代际/语义验收、回执回写 | 普通Broker wrapper35c784d独立复审通过，真实594 manifest已离线绑定；startup/enable的EN-01/02已于fdc6564独立复审通过；固定只读终验92f4ace独立通过；原 exact 授权已因执行前生产前态漂移安全停止，当前未执行 |
| 完整操作授权包 | 最终源码、测试/fmt/clippy/release、受影响安全面独立审查、exact包及有效期/一次预算/失败恢复/本机动作 | package `4a83c4c36828f593fdc4419ae6eef8470fb7f918b5334b360b8b451690edcc1a`、plan `fffde6f6bd4da74e3058acfa0ae24b7062db087a6507c471656fecb96c4fe4cf` 曾冻结并独立复核 PASS，且已获 exact 授权；执行前因生产前态漂移安全停止，不能在当前状态重放。旧 package/plan 继续保持废弃 |

## 本轮收敛与权限

最终原生源码 `92f4ace4152e8ac734ce005f8b344ca41ad2fea2` 已完成完整测试641 PASS、4 ignored、0 failure，fmt/clippy/release均通过；原始716个PASS计数包含75个嵌套子测试输出，不重复计数。四个实际release二进制与源树、日志已冻结在 `first-live-preparation/92f4ace-build/`。OP-02当前代际/最新真实PASS/签名Closed CAS/已投递outbox只读终验及旧HOST_IMPLEMENTATION_INCOMPLETE scaffold移除已独立通过；并未调用真实生产终验。

外层初审冻结OS-01 socket目录缺失接线与OS-02 Python缓存可执行未受审字节两项，已完成同轮修复：独占创建固定新目录并绑定同一inode/OS父目录；Owner/Broker双入口均直接编译已验哈希源码，隔离缓存和本地模块遮蔽。V7 后另一个已授权 Goal 将生产 app 更新到 G2 sealed content `e1edd673bb422ee4d5a58d8ccfb9b5d0cb4577ff79978d118813ffaf63f84af9`；本 Goal 未执行该 mutation，但已将清单与受影响绑定更新到实际当前基线。外层最终源码 `87962bd29d4262a228927869cc9c57850620485e` 的109项联合测试与5个负例通过，源码/数据聚合评审 SHA256 `499618bdb8549e3b5f18f2599d8b886e137b1d047f3eeb5867afd8fc11350dc6`。G2 自身 process generation 仍未验证、真实 Feishu E2E 仍 PENDING，不在本 Goal 中冒充完成。

第一次组包由包级复核发现 manifest 顶层遗漏 `controller_sha256`，WP-01 确定性复现后淘汰旧包。修复后的 p2 包对 Packet、manifest 与 agent-deployd 文件摘要做三方等值绑定；48文件清单、权限、操作器本地校验、原生严格 Packet shape 和拒绝 effect 的 execute fixture 均通过。整包独立复核报告 SHA256 `172f3d50e39bbc490684b720e3a87cc149b8f69b8e239e99666f461eae5467f5`，记录 SHA256 `968797abf99b00772b45105a5afe2d67a193931bceac7389d53f6dece5b3f56f`；`NEW_SHIP_BLOCKERS=NONE`，结论仅为可以提交 exact Owner 授权，不是运行成功。

native checkpoint b18cf29 的599 PASS、4 ignored与2753ab3的328通过/1失败/3忽略均保留为历史；后续PASS不覆盖当时结果。

Owner最新指示的辅助推理分工已启用：使用 Codex 侧栏现有普通 ChatGPT 对话“部署流程优化方案”进行一次绑定这些源码/事实的 GOAL_DRIFT_CHECK，替代重复辅助分析；不转 Work、不用 Brave，不发送秘密，也不把聊天结论当正式评审、签发或授权。正式审查与本地复现/测试保持原边界。

该普通对话已返回“收窄后继续”：保留首发必需的入口、托管及空前缀迁移，禁止将有限当前角色核验扩成历史无入侵或整机无漏洞证明。本地采纳该范围边界并继续实施，没有再叠加一轮相同辅助审计。对话坐标和处分见 `first-live-chatgpt-scope-check.md`。第二次普通对话只审查启用交接，核对真实缺口后本地采纳，见 `first-live-chatgpt-enable-scope-check.md`；正式审查仍独立执行。第三次只读终验范围检查未收到可用侧栏答复，已按Owner指示记录并本地继续，未转Work/Brave或等待。

本次准备未执行 privileged bootstrap、建生产钥、登录重试、sudoers变更、服务启用/重启、入口切换或真实部署。后续 exact 包必须说明 Tailscale 网络影响、dsh现有任务维护影响、已知失败如何恢复、UNKNOWN如何保留，以及 Owner 一次授权和本机认证/登录的具体动作。

未纳管目标、auth-service/gui svc-workflow权限分离、未来multi-resource事项及父Goal其余验收条件另行保留。首个闭环成功不会自动宣称父Goal完成。

证据入口：`first-live-preparation-checkpoint-index.json`、`first-live-custody-transition-design-review.md`、`first-live-issuer-peer-close-source-review.md`；真实外部记录位于 `workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/`，每项报告保留其完整路径与摘要。
