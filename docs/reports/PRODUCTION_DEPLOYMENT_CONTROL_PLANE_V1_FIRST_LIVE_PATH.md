# 首个真实 dsh 自动部署闭环：当前交付状态

更新：2026-09-18。父 Goal 仍是 PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1，沿用 Owner 已接受 Spec3986553。本页维护当前状态；旧观察、失败和审查记录保留在 `.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_FIRST_LIVE_CLOSURE/`，不重写历史。

**禁用安装已完成。首个真实自动部署尚未完成；当前仍有必要代码接线和最终整体审查，不能说只差授权。** 目前不需要 Owner 补 issuer/registry 资料或执行命令。准备完成后提交一次完整 exact 操作包。所有新增建钥、登录、停启、入口退役和部署均尚未执行。

## 首个真实交付

接管实际已有的 Watchdog 基线 → 真实当前代际验收和 canary → 放行 Broker 的真实待部署字节 → 自动安装、回读及更新后验收 → 原部署义务回执/CAS关闭。业务 Goal 是否完成仍由原业务权威判断。

Watchdog 实际冻结来源为 `d602b592fad345fb1c9adebe2bc6611a6f5cfdc2`，所选 incident-lifecycle.js 与已安装字节相同，故基线采用零业务重装。Broker 选择 `59472b631129d1ea3ca1202cbcbbc0799b083114`，workflow.js 候选 SHA256 `6f116d94b58a739216d2af2b25dfd51b32268aba26dcea281f16199f70ff93b2`；最新普通回读仍为 `d76791b7ebbacc872343ba8a26d13ce1f4f2315f4ff5a53fc8744f445b1e65ee`，确有待部署事项。执行前若其他受权流程已装同一字节，则改为接管验收，不能为证明部署而重复安装。

注意：零业务重装不等于整个接管维护零停机。撤销旧写权限及替换 Node/loader 闭包需要按最终包对既有 dsh Runtime/W1/W2 做精确维护停启；其后 Watchdog 基线验收不再额外安装相同业务文件。计划中另外一次 Tailscale 同版本保护路径切换会影响其网络连接。两者都须在最终 Owner 包明确授权和恢复边界。

## 已跨过的关口

- exact 禁用安装成功；原 attempt `genesis-65559dd-20260918-01` 未重置。受保护安装后回读结果 SHA256 `5168000958f4778e1a9adfa06db1ddee576f890c204c292d4c7a384edf7e52cf`，独立核验通过。一次登录超时，UNKNOWN 保留；未重试。
- 最新普通禁用状态观察仍为 Disabled=true/RunAtLoad=false/KeepAlive=false、system/ai.agent-deployd absent。它不替代新的受保护前置，也不宣称所有现有进程持续未变。
- 真实业务绑定、已安装基线接管、同目标合法替换后的延后验收及 Watchdog 语义验证已实现并完成相应独立审查。上游 svc-workflow 当前实现兼容性已核验；不纳管、不重启它。
- 已冻结实际库存、22项 Node loader 文件、三条实际旧入口和两条缺失源入口。四条准确的可选依赖缺失边及旧 Node 探针已独立审查通过；完整退役接线仍随最终顺序审查。
- Tailscale 同版本真实发布来源已独立核验：官方 Homebrew registry index→manifest→bottle→唯一文件，字节与现安装一致。静态候选只改变 plist 的 ProgramArguments[0] 至新受保护路径；未安装。
- 新发现的 issuer 完整结果在 peer 关闭后误判失败已确定性复现并修复于 `76fff5c`，独立限定源码审查 PASS。保留原完整测试失败记录，不将它改报通过。
- 六角色一次性发布组件已冻结于 `1f9279a`：保留原登记和旧钥档案，绑定真实新公钥，逐阶段中断后保留准入关闭且不得重建第二组钥；仅私有非生产夹具验证，源码独立审查进行中。登记桥接独立审查发现的三项具体问题已完成一次窄修复，等待 exact-head 复核，未提前报告通过。

## 唯一剩余路径

| 关口 | 具体剩余工作 | 当前状态 |
|---|---|---|
| 关闭实际 root 入口 | LW helper 首先退役；其他实际入口拒绝或被现有锁序列化；Tailscale 同版本新 inode/保护路径、精确代际停启和回读 | 静态真实输入已备；原生受审执行接线未完成，未获新操作授权 |
| 证明当前无遗留 root 写入者 | 有限固定 OS/服务角色；完整 PID 枚举并覆盖 real/effective/saved UID0；实际启动角色、出生代际、闭包与重复回读，未知即停 | 有限条件策略已独立通过，原生实现中；14个 XPC 动态域需要未来受保护前置，不能用普通读取失败或基线 PID 充当通过 |
| 安全托管及一次登录 | 上述边界闭合后生成六个新角色材料，保留原 state1，追加同 payload 的 PENDING state2，并为原空 snapshot1重新签名保持CAS0→1→2；旧钥只验证精确历史；再进行一次独立 reviewer 登录 | REUSE设计已独立通过；非生产迁移和顺序接线正在实现。不是重做genesis或清空历史 |
| 真实 Watchdog 前置 | 同一mutex下完成维护/权限拒绝/回读；真实独立issuer构建评审；接管已有基线，实际canary及逐项验收 | 组件已实现，需在最终顺序内集成验证并在未来授权操作中执行 |
| 首个 Broker 自动部署 | 条件成立才启用controller；普通producer提交真实候选；自动Train安装、健康/代际/语义验收、回执回写 | 不存在已完成生产结果；外层一次操作包和该全链路仍需补齐 |
| 完整操作授权包 | 最终源码、测试/fmt/clippy/release、受影响安全面独立审查、exact包及有效期/一次预算/失败恢复/本机动作 | 未冻结最终包，未向Owner索取碎片审批 |

## 本轮收敛与权限

当前 native checkpoint `1f9279a1709dfa4254ecc8d7edd221f10fe44c99` 及正在集成的 host/login 是非生产候选，不是完整执行器 PASS。先前2753ab3 完整测试记录为328通过/1失败/3忽略；唯一已定位失败为上文 peer-close 问题，修复后有定向独立验证，最终源码的完整重跑仍待剩余集成完成。

Owner最新指示的辅助推理分工已启用：使用 Codex 侧栏现有普通 ChatGPT 对话“部署流程优化方案”进行一次绑定这些源码/事实的 GOAL_DRIFT_CHECK，替代重复辅助分析；不转 Work、不用 Brave，不发送秘密，也不把聊天结论当正式评审、签发或授权。正式审查与本地复现/测试保持原边界。

该普通对话已返回“收窄后继续”：保留首发必需的入口、托管及空前缀迁移，禁止将有限当前角色核验扩成历史无入侵或整机无漏洞证明。本地采纳该范围边界并继续实施，没有再叠加一轮相同辅助审计。对话坐标和处分见 `first-live-chatgpt-scope-check.md`。

本次准备未执行 privileged bootstrap、建生产钥、登录重试、sudoers变更、服务启用/重启、入口切换或真实部署。后续 exact 包必须说明 Tailscale 网络影响、dsh现有任务维护影响、已知失败如何恢复、UNKNOWN如何保留，以及 Owner 一次授权和本机认证/登录的具体动作。

未纳管目标、auth-service/gui svc-workflow权限分离、未来multi-resource事项及父Goal其余验收条件另行保留。首个闭环成功不会自动宣称父Goal完成。

证据入口：`first-live-preparation-checkpoint-index.json`、`first-live-custody-transition-design-review.md`、`first-live-issuer-peer-close-source-review.md`；真实外部记录位于 `workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/`，每项报告保留其完整路径与摘要。
