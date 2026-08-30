# AGT_CTO_HOTSTANDBY_ACTIVATION_V1 (TASK_NAME = 热备 执行)

Round: 2026-08-30 · Author: execution agent · Docs-only（本报告 + evidence；零生产写入）

## 0. 结论

```text
RUNNER            = /tmp/run-agt-cto-hotstandby-activation-v1.sh
RUNNER_SHA256     = 926d50bf23abdda0d6673d569654549ad6d118cea90b594f05d8ef95fee59121
OWNER_COMMAND     = sudo bash /tmp/run-agt-cto-hotstandby-activation-v1.sh
                    （无参数 + 交互短语 APPLY AGT_CTO_HOTSTANDBY_ACTIVATION_V1）
ARCH_GATE         = CORRECTED（uname -m 仅记录；binary x86_64 / process.arch=x64 /
                    可加载 addon x86_64|universal 三重门 + x64 功能性冒烟）
PRODUCTION_CHANGE = NONE THIS ROUND（runner 待 Owner 执行）
NEW_PR            = NONE（Owner 指令：不再新建 PR）
```

Owner 唯一一条 sudo 命令完成后达成：clean x64 Harness → 诚实 .source-stamp →
已合入冷备代码（main e2e1e22 的 5 文件 closure）→ primary=glm53 + fallbacks=[luna]
→ 生产 canary A–D + FINAL 干净 GLM 验证 turn。

## 1. 架构门问题的确认（Owner 提问）

Owner 判断**完全正确**，且现场有历史事故佐证：

- 宿主 `uname -m = arm64`（Apple Silicon，实测）；trusted 生产 Node =
  `/usr/local/libexec/agent-core/node-runtime/bin/node`，`file` = Mach-O x86_64，
  自报 v25.6.1 / darwin / **process.arch=x64**（Rosetta，实测）。
- `/usr/local/libexec/agent-core/harness.arm64-broken-20260828-134711/` 是 08-28 一次
  arm64 harness 安装事故的残留 —— 说明真实风险方向是「装出 arm64 树」，而不是「宿主是 arm64」。
- 因此架构门**绝不能**用 `uname -m` 断言运行时必须 x64（会恒假拦截）；正确门 =
  三重机械证明 + 功能性冒烟，runner G2 已按此实现并实测通过：
  1. trusted Node binary 必须 Mach-O x86_64（file -b）；
  2. 该 binary 自报 process.arch=x64（且版本 pin v25.6.1）；
  3. 可加载 darwin addon 必须 x86_64 或 universal —— 区分两类形状：
     架构风味包（安装架构选定，arm64-only 即 FAIL）与多平台 prebuild 菜单
     （node-pty 等：仅当前元组 prebuilds/darwin-x64/* 可加载，其余兄弟条目 dormant，
     与 PE/ELF 同类忽略）。朴素「所有 Mach-O 必须 x86_64」规则会误杀 dormant 的
     prebuilds/darwin-arm64/pty.node —— 已修正并在 3 棵真实树上全部 PASS；
  4. 功能性证明：clean harness CLI 在 trusted x64 node 下启动并报 0.1.0-rc.8（实测）。
- 「若脚本因 uname -m=arm64 停止」：本轮不存在既有 runner（上会话只留下未提交的
  candidate WIP，见 §5）；新建的 runner 从第一行起就不含 uname 门（uname 仅 informational）。

## 2. 现场事实（全部只读采集；详见 evidence/deployment-facts.txt）

- **冷备代码已合入**：bd0eeae 经 PR #111（merge b53ebd6）进 main；main = e2e1e22；
  Activation V2 @ main 为 accepted / production_apply_authority: contracts。
- **生产 harness 为 dirty 安装**：原始安装脚本从 dirty 主 worktree tar 导出，
  117 个 tracked 文件漂移（含 packages/client/runtime 源码 + pnpm-lock），无
  .source-stamp → GATE-5 的 dsh_commit_mismatch 根因。诚实 stamp 不可对 dirty 树伪造，
  唯一合法路径 = 换上 clean 514ab7b 树。
- **clean x64 Harness 源已就绪**：deepseek-harness-clean-coldbackup-514ab7b @
  HEAD=514ab7b（pin 命中）、porcelain 干净、CLI 已构建、856MB node_modules 全部
  darwin-x64/universal。
- **部署面恰为 5 文件**（route-chain.js / route-chain-canary.js[new] / index.js /
  ingress-delivery.js / compose.js），其余生产包已 == main（model-overrides.js
  Phase A 补丁即 main blob，实测 cmp PASS）。
- providerEnv 现场值（PROXY_SEAM spec 冻结值）：7890 代理 + localhost,127.0.0.1,::1。

## 3. Runner 结构（798 行，bash 3.2 兼容，shellcheck error 级零告警）

G0–G5 零写预检（身份/权威 pin/架构门/clean 源门/生产态 pin/交互确认，含 Owner
senderOpenId 提取——log 提取优先，粘贴为兜底；错 id 安全：binding mismatch = 零效果）
→ W1 clean harness 安装 + 逐 tracked 文件比对（7817 文件 cmp，dirty=0 才准写
dirtyCount:0 —— 反伪造）+ .source-stamp（505:601/0644）+ 部署侧 readHarnessIdentity
回读验证（GATE-5 PASS 证明）→ W2 5 文件 closure（唯一提取源 `git show e2e1e22:<path>`，
逐文件 before/after sha + blob sha 记入 manifest）→ W3 strict 配置下受控重启
（health + 新 pid + boot 行 `glm53 (length 1)` 三重证明）→ W4 原子写 v2 配置
（备份先行；已部署 loader 回读：routes=[glm53,luna]、subscription.dshCommit==pin；
无秘密扫描）→ W5 canary A/B/C/D + FINAL（CTR-I2-015 一次性描述符，逐 case 新 nonce、
4 分钟过期、maxUses=1、0600/505；A 干净主路由；B 受控 429 fixture → 恰一次真实
Luna call（全程 Luna 调用总数=1）；C outcome_unknown STOP；D 聚合不变量
（恰 3 个 logical turn、luna final 恰 1）；FINAL 干净 GLM turn 后恢复正常放行）。
任一写后失败 → 统一回滚（overrides/app/harness 原位恢复 + 注入清理 + 受控重启 +
strict 验证；零变更失败不重启；exit 1/4 语义与 ROLLBACK_INCOMPLETE 命名状态）。

## 4. 边界

DOCS ONLY（1 报告 + 1 evidence 目录）；零 sudo 执行；零生产变更（runner 从未运行，
仅在 yanfenma 身份下验证 root 门 exit 2）；候选 worktree 与主 repo 既有 WIP 原样保留。

## 5. 非阻断观察

- **O-1 遗留 WIP**：`.worktree-luna-fallback-candidate`（impl/luna-fallback-candidate-v1）
  有未提交的 subscription omitEnv 扩展（OC_GO_API_KEY/OPENCODE_GO_API_KEY 屏蔽）+ 2 个
  测试文件。属超出三份 V2 spec 契约的加固（spec 无此要求），且 CTR-V2-006 禁止部署
  worktree 源 → 本轮不部署。建议 Owner 后续决定其去向（独立 authority 或废弃）。
- **O-2 GATE-7 candidate canary 未单独执行**：Owner 指令（不再调查/不新建 PR）+
  production A–D 直接授权（GATE-8）。受控 429 fixture 的分类/hop 行为由 CANARY-B
  在生产上直接证明；如 B 失败即整体回滚至 strict。
- **O-3 drain 证明**：无机械 drain 面（spec 亦未定义控制面）；W3 重启前 Owner 确认
  + 运行时日志快照留证。重启会杀 5 个既有 agent child（下次消息自动重生）——
  维护窗口语义与 v7 recovery 相同。
- **O-4 W1→W3 窗口**：harness 目录 mv 后、重启前，新 spawn 的 child 会用新树（runtime
  父进程仍持旧代码）。窗口为分钟级，rc.8↔rc.8 同版本协议，风险记录在案。

## 6. FINAL

热备 执行 = RUNNER_READY；ARCH_GATE = uname-free（三重机械 + 功能冒烟，实测 PASS）；
READY_FOR_OWNER_RUN = YES；PRODUCTION_CHANGE = NONE（本轮）；LUNA_CALLS_PLANNED = 1（仅 CANARY-B）。
