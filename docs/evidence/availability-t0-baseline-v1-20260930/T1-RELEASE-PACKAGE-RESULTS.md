# T1 完整可重建发布包：结果记录（availability rollout 第一轮）

日期：2026-09-30。依据 PR #373 T1。前置：T0 回流浪 `live-restore/t0-backflow-20260930`（commit `1dbfb70b` + evidence `9c6d9edb`）。

## 交付物

- `scripts/lib/deployment-reuse/release-package.mjs` — `buildRelease({sourceRoot, recipe, outputRoot}) -> {manifest, artifactDigest}`；同目录 `test/release-package.test.mjs`。与既有 `receipt.py` 同 surface，纯 Node 标准库，不触碰特权执行器。
- `packages/development-execution/package.json` — 真实安装缺口的修复（见下）。

## 失败测试（RED→GREEN，实际执行）

`node --test scripts/lib/deployment-reuse/test/release-package.test.mjs`

- **实际 RED 记录**：实现存在前 7 tests / 0 pass / 7 fail，全部 `ERR_MODULE_NOT_FOUND`（真实 RED，非编造 PASS 表）。
- 实现后 **7/7 GREEN**。覆盖计划指定五类：模块缺失拒绝、无 package.json 的包目录拒绝（不被静默漏装）、Node/harness 缺失拒绝、同 sourceSha 不同内容 ⇒ 不同 artifactDigest、秘密命名文件拒绝且不静默丢弃；另加重建确定性（同源两次构建同 digest）与排除树不入包。

## 真实树构建的七轮拒绝（工具在真实仓库上的价值记录）

对回流分支真实源码树构建时，完整性检查逐轮拒绝并暴露真实问题：

1. `deployment-artifacts/` 含代码无 package.json → 决策：工件归档**入包**（git 跟踪内容，被测试 import），不排除。
2. **`packages/development-execution/` 有 src/test 代码但无 package.json，且受控根 app 树中整包缺失**——compose.js/development-execute capability 引用它，任何按包安装的机制都会漏装它。修复：补最小 package.json（零外部依赖，纯 node 内置）。
3. `broker/test/index-bindings.test.js` 的 `./y.js` 为注释示例文本 → 检测剥离注释。
4. `hr-post-coherent-overlay.mjs` 的 `importAnchor` 字符串字面量为延迟导入锚文本 → 检测收紧到语句位置 + 真实 `import()` 调用。
5. `deployment-overlay-closure.test.js` 的断链 report 来自模板字符串内的 fixture 文本（相对路径基准是 fixture 落点）→ 反引号奇偶跟踪跳过模板内行；**期间曾误改该测试文件，已 `git checkout` 恢复**，最终该文件与 main 逐字一致。
6. test 树 import 被排除的工件目录 → 决策：**test 树入包**（延续受控根 app 现网全树布局，部署后可跑回归）。
7. `deployment-artifacts` 归档快照内部相对引用断（非活代码）→ 入包但豁免闭包检查（固定、显式、有注释）。

## 候选构建结果（可重建）

```text
sourceRoot = /Users/yanfenma/workspace/worktrees/t0-backflow-20260930 (branch live-restore/t0-backflow-20260930)
outputRoot = /Users/yanfenma/workspace/worktrees/t0-release-candidate-20260930
artifactDigest = bd2307e453337efe…（完整值见 out/manifest.json）
files=901  bytes=9,212,271（不含 node_modules）
deps summary=8 外部依赖  configStructure=20  sourceSha=9c6d9edb
toolchain: node v25.6.1（受控 /usr/local/libexec/agent-core/node-runtime）+ harnessRoot（deepseek-harness）
```

manifest 绑定：recipe（name/exclude/coveredGoals/compat）、toolchain、逐文件 sha256/bytes/mode、依赖摘要、非秘密配置结构清单、`builtAt`。干净重建不读任何现网目录。

## 候选包独立工作区验证（实际执行）

1. 依赖安装：候选 `app/` 内 `pnpm install --prefer-offline --ignore-scripts`（493ms）+ `@deepseek-ai`/`@larksuite` 作用域链接——成功。
2. 导入验证：包内 `node --test packages/broker/test/capabilities/*.test.js` → **108/108 pass**（受控 node v25.6.1）；`import('packages/production-runtime/src/entry.js')` → **ENTRY IMPORT OK**（完整启动模块链可加载）。
3. 受控启动：`env -i`（空 HOME/空 root，无代理）启动 `scripts/production-runtime.mjs --root <空目录>` → 启动链完整走到 compose，fail-closed 于设计内边界：`agent definition config missing: agents.json (provision the runtime first)`，**exit=2**（launcher FATAL 约定），无缺模块、无栈崩。

## 如实标注的未完成项

- **等价服务身份（uid/gid/mode）下的完整启动 + 测试凭据业务验证：未完成**。无 HR/飞书测试凭据、无隔离服务账户条件；以受控启动的 fail-closed 边界 + 导入链完整为替代证据，不冒称启动成功。
- 真实树测试的预存失败（非本轮引入，基线复现）：`deployment-incident-migration.test.js` 1/6（fixture 拷贝白名单缺 `packages/scheduler/src/occurrence-model.js`，真实文件在树）；`agent-switch/test/switch.test.js` 1 项（harness dsh-tools schema 形状）；product-api 4 项真实 TTS 引擎用例（headless 设计性失败）。
- `pnpm-lock.yaml` 由本地安装生成，**未提交**（仓库无 lockfile 是现状，采纳与否属 Owner 决定）；重建依赖由 manifest.dependencies 摘要锚定。
- 制品回退目标（rollbackTarget）标 `unverified-until-T2`——回退闭环属 T2。
