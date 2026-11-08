# BRIEF-1370-IMPL — #1370 路由配置代政策实现（RE_PREFLIGHT 实施任务）

## 授权链
- **accepted `AGENT_CORE_ROUTING_CONFIG_GENERATION_POLICY_V1`@main `95a8e1cb`**（`implementation_authority: contracts`，`production_apply_authority: none`；Owner 裁定 `owner-20261108-phase-receipt-deltas` items[4] "然后接续实现"）
- 实施合同 = 该政策 §Contracts（CTR-RCG-001..006）+ §Acceptance（ACC-RCG-001..006）
- 辅助输入（只读）：`SEMANTIC-VERIFY-1370.md`@main（§4 现行为坐标、§6 影响面 MIGRATE/RETAIN 处置）、issue mayf3/agent-control#1370
- 零生产写入。本 worktree 实施。

## 环境事实（前次停点教训，先读后动手）
- Node = `/usr/local/bin/node`（v25.6.1，compose.js:84 版本门要求）。
- 测试运行用**文件展开**（`node --test test/xxx/*.test.js`），不用目录位置参数。
- 本 worktree 无 node_modules——可用 npm/复制品种机械安装于 worktree 内（不改 package.json/lockfile，除非变更本身需要）；R2 停点的 `@deepseek-ai/schemastery` 缺失应随全新安装解决，**实施前先证明测试可跑**（先跑一个既有 route 套件取得基线 PASS 原文）。

## 实现范围（按政策 §6 影响面 + CTR-RCG 条款）
1. `packages/production-runtime/src/model-overrides.js`（现状坐标 274–492）：
   - 复用整代 validator；新增：候选捕获（immutable snapshot）→ 发布边界整代验证 → 验证成功才原子激活为 active generation；运行侧消费绑定的 activated generation；**禁止 catch-and-skip**；保留全部既有校验与错误类别。
2. `packages/production-runtime/src/compose.js`（247–261）：
   - 启动/发布/后续消费统一：`resolveRouteChain` 不再每次全文件重建信任，改消费已激活代；global/default 上下文与失败准入状态（configInvalid journal）同代绑定。
3. `packages/agent-router/src/route-chain.js`（309–324）：
   - 消费 generation-bound snapshot；区分三态：候选整代拒绝 / 目标自身拒绝 / 合格 G0 继续消费；保留 `totalRouteAttempts:0` 零尝试 journal 与 executor/STOP_CHAIN 边界；脱敏归因可扩但不降级。
4. 资格判定（CTR-RCG-003/004 核心）：G0 继续仅当 ①目标 A 及完整输入闭包与已验证代完全一致（同 ref 的 descriptor/effort/providerEnv/artifact 变化≠未变）②完整错误集合仅为无关已注册 B 的 unknown routeRef ③G0 当前仍通过身份/资格门；其余（A 自身无效/A 显式变更/A 删除缺失/解析歧义/未知 envelope/不可读/未处理变化/无可信代）一律拒绝。

## 验收（ACC-RCG-001..006 + 反例，全部要测试原文）
- 反例1（SEMANTIC-VERIFY §5）：G1 = A→r1（合法显式变更）+ B→missing → **必须整代拒绝**（configInvalid journal、零消费 r1）。
- 反例2：G1 = A→r0 不变 + B→missing → 允许继续 G0（loud 记录候选拒绝 + G0 资格判定证据）。
- A 自身无效 / A 显式变更 / A 删除缺失 → 按 CTR-RCG-004 表拒绝。
- 无可信代（启动即坏）→ 拒绝。
- 重启/恢复 → 全量重验，不复活旧许可。
- 既有受影响 route/loader 套件 + Default/GPT6 回归全 PASS。

## 边界与完成定义
- 不改既有 accepted Spec；不动 Svc；不合并；零生产写入；不改 D-008/UNKNOWN/fence 语义。
- 完成 = 实现 commit + 新增/更新测试 + 全部验收测试原文输出 + 基线对照 → push → **PR(base main) 不合并** + `IMPL-RECEIPT-1370.md`（含：每条款→代码位置映射表、测试清单与结果原文、行为前后对照）。
- 失败即停写 `STOPPED-1370-IMPL.md`（先跑基线再动手；基线跑不起来属环境问题，如实停，不伪造 PASS）。

## 续办补充（v2，2026-11-08 监管裁定）
- v1 停点根因已定位：基线 3 项失败（native-goal-composed.test.js 的 1 断言 + 2 child spawn）同因缺 `NGC_HARNESS_ROOT` 环境变量。监管已核验本机 paired harness root 在位：`/Users/yanfenma/workspace/github/deepseek-harness`（HEAD `514ab7b002`，`packages/goal/goal-round-driver/lib/index.js` 存在）。
- 续办步骤：① 恢复依赖（删除 git 跟踪的 node_modules 符号链接后 `npm install --no-package-lock --no-audit --no-fund`，node_modules 留 worktree 内 untracked；不依赖 /private/tmp 缓存——午夜清理区）；② `NGC_HARNESS_ROOT=/Users/yanfenma/workspace/github/deepseek-harness` 注入后**重跑同一基线命令**，预期 180 PASS（原文存证据目录）；③ 若 180 PASS → 按原简报全部条款接续实现；④ 若注入后仍失败 → 再停写 STOPPED（新证据 = harness 版本配对问题，需配对分析，不盲目重试）。
- 本补充为环境坐标补证（常设授权 §6 构建失败自行修复重验），非新授权面。

## 续办补充（v3，2026-11-08 监管配对定位）
- v2 停点根因已定位到**配对版本**：app 侧 demo-server 要求 harness goal-round-driver 提供 `goalRoundDriver {protocolVersion: 1, enqueueMode}` 服务（demo-server/src/index.js:254 + native-goal-admission.js:17）；master@514ab7b002 的 driver lib（Aug 30 构建）无该服务 = 旧协议。
- **监管已核验配对根在位**：`/Users/yanfenma/workspace/worktrees/codex-native-goal-enqueue-20261027`（fork 分支 `codex/native-goal-enqueue-20261027` @ `9d8678057b`，driver lib 含 goalRoundDriver/protocolVersion:1，9 模块 lib 全部已构建）。
- v3 步骤：① `NGC_HARNESS_ROOT=/Users/yanfenma/workspace/worktrees/codex-native-goal-enqueue-20261027` 重跑同一基线命令，预期 **180 PASS**（原文存证据目录 v3/）；② 180 PASS → 按前述全部条款实施；③ 仍失败 → 再停写 STOPPED（附 child 直跑 stderr 与新谓词证据，不盲目重试）。
- 本补充为配对坐标补证（常设授权 §6 构建失败自行修复重验），非新授权面。
