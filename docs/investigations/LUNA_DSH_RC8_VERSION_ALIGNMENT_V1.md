---
investigation_id: LUNA_DSH_RC8_VERSION_ALIGNMENT_V1
date: 2026-08-21
status: complete
related_specs:
  - AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1 (accepted; Amendment 2 proposed)
  - AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1 (accepted, untouched)
---

# Luna DSH rc.8 Version Alignment — 兼容性调查记录（evidence authority）

> 本文件只承载 evidence，不授予实现权限。授权边界见
> `AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1` Amendment 2（proposed）。
> 本轮：COMPATIBILITY INVESTIGATION + SPEC AMENDMENT ONLY —— 不修改生产、
> 不写 Luna override、不重新 OAuth、不修改 credential、不发飞书消息、
> 不修改产品代码、不 merge。

## 1. 触发

2026-08-21 `LUNA_MANUAL_BACKUP_CONTROLLED_ACTIVATION_V1` 执行轮中，Luna
激活在 AgentProcess spawn 前被 provisioning fail-loud 阻断：

```text
agent-provisioning: expected DSH 0.1.0-rc.5, resolved 0.1.0-rc.8
```

生产已完全回滚（route = zai/glm-5.3，override 删除，credential/plugin 保留）。
本轮按 Owner Direction 调查：对齐 rc.8 还是 BLOCKED。

## 2. 精确生产坐标（2026-08-21 只读核实，全 SHA）

```text
PRODUCTION_DSH_VERSION    = 0.1.0-rc.8
PRODUCTION_DSH_FULL_COMMIT= 514ab7b0029141b88c807704764d0d3e1eea1da4
                             （本地 merge 提交；树上无指向它的 tag；
                               ahead of origin/master 13；含 1 个未跟踪目录）
PRODUCTION_NODE_VERSION   = v25.6.1
PRODUCTION_AGENT_CORE_MAIN= 34d7c73456f2b177b8ad042e67359bc86fae8861（clean）
HARNESS_ROOT              = /Users/yanfenma/workspace/github/deepseek-harness
                             （launchd DSH_HARNESS_ROOT 直接指向的活跃 dev checkout）
```

rc.8 到达时间线：`1bc866ba7b` "Merge upstream dsh-v0.1.0-rc.8"
（2026-08-20 08:58:12 +0800）之后另有本地开发提交至 `514ab7b002…`。
非订阅 Agent（GLM 全局路径）无版本 pin，不受影响。

## 3. Plugin 版本调查（source-verified，非版本号猜测）

- npm registry 可得 `dsh-codex` 版本：`0.2.1 / 0.2.2 / 0.2.3 / 0.2.4 / 0.2.5`。
- 生产已安装：`~/.agent-core/homes/agt_cto-agent/profiles/node_modules/dsh-codex`
  = `0.2.3`（08-20 21:58 起，其 profile symlink farm 已重指向 rc.8 harness 树）。
- `dsh-codex@0.2.3` peerDependencies 共 20 项；在 rc.8 checkout 的
  `node_modules/.pnpm/node_modules` 与 `apps/cli/node_modules` 两个候选布局下
  **全部可解析且版本满足 range**：`@earendil-works/pi-ai@0.82.1`、
  `@deepseek-ai/cordis@4.0.1`、`@deepseek-ai/schemastery@3.18.1`、
  `react@18.3.1`、`react-dom@18.3.1`、其余 `@deepseek-ai/dsh-*` 均为
  `0.1.0-rc.8`（peer range `*`）。
- 真实 artifact 核验：`npm pack dsh-codex@0.2.3` 所得 tarball sha256 =
  `8c3d4e3418c8e267…`（与实现轮 `chatgpt-subscription-real.test.js` 冻结的
  artifact hash 一致）；tarball 内 `lib/*.js` 与生产已安装副本 **6/6 文件
  byte-identical**。
- 结论：无需考虑其他 plugin 版本；优先组合 rc.8 + 0.2.3 直接进入真实测试。

## 4. 隔离真实兼容测试（方法与结果）

驱动：`scripts/luna-dsh-rc8-compat-driver.mjs`（随本分支提交，可复现）。

- **Harness**：真实 production rc.8 checkout（只读引用）。
- **隔离**：临时 DSH_HOME / workspace / operator `HOME`（`mkdtemp`）；真实
  生产 agent-core 模块（bit-identical 34d7c73，只读 import；REPO 侧
  `ensureRepoCoreBridge` 对已存在的正确 bridge 为 no-op，零写入生产）。
- **Plugin**：真实 npm artifact（见 §3）经 `provisionAgentHome` 的
  `npm install --offline --legacy-peer-deps` 路径安装进临时 home。
- **Credential**：fixture OAuth 文档 `{version:1, credential:{type:"oauth",
  access, refresh, expires, accountId}}`；access 为**假 JWT**（payload 携带
  `https://api.openai.com/auth.chatgpt_account_id`，pi-ai
  `extractAccountId` 的真实解析形状）。绝不读取/复制生产 refresh token。
- **网络 observer**：本地 HTTP 代理（ephemeral port）记录
  `CONNECT chatgpt.com:443` 并拒绝隧道；child 的
  `HTTP_PROXY/HTTPS_PROXY` 指向它（`NODE_USE_ENV_PROXY=1`、
  `NO_PROXY=localhost,127.0.0.1,::1`）→ 最终运行零真实外网。
- **候选 pin 直通**：订阅 tuple 由调用方传入（rc.8 + 514ab7b…），不改任何
  产品常量 —— 即 Amendment 2 将要冻结的值。

两轮执行均 `RESULT=PASS CHECKS=22 FAILED=0`。关键检查点：

```text
A1-A5  环境/身份/artifact（harness identity、agent-core HEAD clean、node
       v25.6.1、tarball sha256 = 实现轮冻结 artifact、lib byte-identical 6/6）
B1-B4  真实 provisioning 于 rc.8（候选 pin 通过；0.2.3 安装核对；
       dsh.profile.bundles 追加；peers 从 farm 解析）
C1-C3  initialize route = openai-codex/gpt-5.6-luna；
       pluginServices.openAICodex = true；registeredProviders 含 openai-codex
C4-C6  无 credential turn → credential_missing / agent/credential 边界
       （session created）；child env 四个 providerEnv 键在场、
       OPENAI_API_KEY absent
D1/D5/D6 fixture credential turn → 越过 credential 检查（JWT accountId
       解析通过），observer 捕获 CONNECT chatgpt.com:443 ×6（fetch+WS），
       失败干净归类 provider 侧（TRANSPORT: fetch failed）
E1-E4  完整退出 code=0；冷重启后 plugin 重载、provider 重注册、
       session main resumed、credential 复用、observer 再次捕获
```

负向确认（任务要求逐项）：API shape mismatch = NONE、profile bundle
incompatibility = NONE、provider registration mismatch = NONE、session
create/resume incompatibility = NONE、credential store schema
incompatibility = NONE。

## 5. 过程性发现（如实记录，非验收依赖）

1. 调查早期一次中间运行中，settings 曾含 `openai-codex` 条目但未重定向
   adapter 的 baseUrl（adapter 自注册、拥有 chatgpt.com URL；settings 条目
   不能重定向它），fixture token 到达了真实 chatgpt.com 后端并被回以
   可解析 401（"Could not parse your authentication token"），错误经
   sanitize/classify 干净透传 —— 顺带佐证真实 wire shape 兼容。最终验收
   运行已全部本地化，无真实网络、无真实 token。
2. pi-ai 版本未变（`0.82.1`，与 rc.5 验收轮相同）：请求构造代码路径
   在 rc.5→rc.8 之间未动，兼容风险集中在 DSH↔plugin 服务面（cordis
   ctx），而该面已被真实 boot/重启测试覆盖。
3. 群聊 @提及 gate：与本调查无关，但 08-21 执行轮曾因消息未 @bot 被
   `group_not_mentioned` 静默丢弃 —— 操作者 runbook 已记录。

## 6. 结论

```text
DSH_CODEX_0_2_3_COMPATIBLE = YES
RECOMMENDED_VERSION_TUPLE  =
  DSH_VERSION  = 0.1.0-rc.8
  DSH_COMMIT   = 514ab7b0029141b88c807704764d0d3e1eea1da4
  DSH_CODEX    = dsh-codex@0.2.3
授权边界：AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1 Amendment 2（proposed，
waiting independent review；实现轮随后独立执行常量更新）。
```
