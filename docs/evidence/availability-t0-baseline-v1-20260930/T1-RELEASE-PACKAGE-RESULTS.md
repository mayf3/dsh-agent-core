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

---

# Round 2（同日接续，agent-control #97）：补齐 round-1 如实标注的三项未完成

前置接管核对：agent-control #97 的控制器 status 回执指认本会话 pid；原作者终态 = `5701d165` 终 commit + PR 正文终报，其后 worktree 零变更、零进程持有。以下全部结果为本会话实际执行。

## R2.1 依赖闭包固定（失败测试先行）

命令与结果（受控 node v25.6.1，未清代理不影响此纯文件级测试集）：

```text
node --test scripts/lib/deployment-reuse/test/release-package.test.mjs
  实现前（新增5个缺口测试）: 12 tests / 7 pass / 5 fail（真实 RED：未固定依赖照常放行）
  实现后:                   13 tests / 13 pass / 0 fail（含冻结快照豁免新测试）
scripts/availability-recovery/recovery.acceptance.test.mjs: 4 tests / 4 pass / 0 fail（既有harness未动）
```

实现要点（`release-package.mjs`）：声明外部依赖而无 out-of-band lockfile ⇒ `DEPENDENCY_LOCK_MISSING` 拒绝；lockfile 覆盖不全 ⇒ `DEPENDENCY_LOCK_INCOMPLETE`；registry 依赖以 integrity pin、git 依赖以 commit-sha pin（不伪造 integrity）、workspace link 单列；lockfile 随包交付（`app/package-lock.json`，manifest.generated）；manifest 新增 `dependencies{declared,packageManager,registry,lockfile,resolved,workspaceLinks}` + 内容绑定 `dependencyDigest` + `assembly` 配方自述；toolchain 绑定 node 二进制 sha256 + **有界 harness 锚**（apps/cli 入口包摘要+版本，范围如实标注"非全树"）；`includeTestTree`/`includeArchives` 进 recipe 并与包内容一致性校验（矛盾即拒绝）。新增 `release-candidate-cli.mjs`（配方=文件，构建命令可复现）。

真实树暴露并修复（前两类为**工具误报**，如实记为工具误报而非产品缺陷）：

1. `docs/evidence/**/postimage/*.js` 冻结取证快照引用其**原布局**相对模块 → 模块闭包检查按 deployment-artifacts 同类豁免 `docs/evidence/`（快照仍入包）。工具误报。
2. harness 锚摘要误入 harness 自身 `node_modules`（pnpm symlink store）→ 锚摘要与打包器同款排除语义（依赖安装目录不是锚的一部分）。工具误报。
3. **真实解析缺口**：`agent-memory`/`agent-switch` 的 peer `@deepseek-ai/dsh-llm`/`dsh-tools` `>=0` 在 npm prerelease 规则下**永不可解析**（这两个包只有 rc 版本）→ pin `0.1.0-rc.8`（与 root 已钉 dsh-session 同代，与现网受控根实际安装版本一致）。union 解析即暴露（`npm error notarget`），非产品行为缺陷，属声明面缺口。

## R2.2 候选包 v2 构建与全闭包组装（干净隔离，零现网复用）

```text
# stageA: 干净 union workspace（root package.json + workspaces packages/* + packages/ 源码拷贝）
npm install --package-lock-only --ignore-scripts --cache <stageA>/npm-cache --no-audit --no-fund
  -> package-lock.json 58,969B（首次失败: @deepseek-ai/dsh-llm@>=0 notarget → 修复后成功）
# stageB: 候选构建
node scripts/lib/deployment-reuse/release-candidate-cli.mjs --recipe <assembly>/candidate-recipe.json  (exit 0)
  artifactDigest=34335422c545024a54dce4056b959e1fbc84b5a609573cf90fe4d011c232de1c
  dependencyDigest=3f7e8dff1dbc790e295b966e7d956a821dff875392304c22dc24f373017aff1c
  files=1288 / 16,417,999B   resolvedDependencies=102   sourceSha=eb2b1a21（构建时 HEAD）
  toolchain: node v25.6.1（二进制 sha256 已绑定）+ harness apps/cli 入口包锚
# stageC: 干净目录组装（cp 候选 app -> 补 workspaces delta -> npm ci）
npm ci --ignore-scripts --cache <assembly>/assemble-cache   (exit 0, "added 102 packages in 6m")
  npm warn: skipping integrity check for git dependency (git 依赖按 commit-sha 锚定，npm 不做 integrity 复核——如实记录)
  @larksuite/channel@0.5.0 @ pinned commit ab028f9 落位
# stageD: 入口导入（env -i, 无 HOME/代理）
import('packages/production-runtime/src/entry.js') -> ENTRY_IMPORT_OK
```

对照 round-1 缺口的闭合：901 文件/9.2MB 无依赖摘要 → 1288 文件 + **102 个解析依赖全部 version+integrity（git 依赖 commit-sha）+ registry 来源 + lockfile sha256 + 组装配方自述**；round-1 的候选内 `pnpm install`（本地 store 493ms、版本无锚）→ 现在重建 = `npm ci` 按 lockfile 完整性校验安装。`pnpm-lock.yaml`（round-1 遗留、未跟踪）不入包（recipe.exclude 显式排除，文件本身未动，采纳与否仍属 Owner）。

## R2.3 成功启动 + 请求闭环（entry 级 bar，真实进程）

新驱动 `scripts/availability-recovery/release-startup-closure.mjs`（复用 availability-recovery harness 的 worker.mjs fixture 与 LocalWorker 模式，未另造运行时）：

- **启动**：完整 compose + `schedulerReadinessRequired=true`（scheduler health census 五源：jobs/routing/incidents/credentials/history 全部一致快照 + provenance 40-hex 生成绑定 `AGENT_CORE_DEPLOYED_SHA`）。round-1 的 exit=2 缺 agents.json 只作为负例保留在文档史。
- **请求**：notification-ingress HTTP（Basic → 在线 verifier → allowlist）→ Router deliver → **真实 OS worker 子进程**（tool-free fixture，无模型/网络/生产数据）。
- **受控重启**：`--full` 编排两个全新 OS 进程跑在同一持久根；第二进程发**新**请求 + 重放 phase-1 请求（durable idempotency，`duplicate:true`）。
- **隔离**：独立持久根（合成测试名册：agt_hr-agent 默认 + agt_availability-control；合成凭据 store；0600/0700 auth config；0640 routing manifest）、瞬时 127.0.0.1 端口、子进程最小 env（无代理 env，符合 compose fail-closed 断言）。

实际执行（受控 node v25.6.1）：

```text
--selftest: PASS（种子合同: jobs.json canonical shape / auth config 0600+allowlist / routing manifest shape）
--full:     PASS, exit 0
  phase1 (pid 72236): startup gate ON -> ready; ingress /health 200 (deliverReady/authConfigured/storeReady)
    normalAgent 200 delivered; hrAgent 200 delivered; 错误凭据 401 INVALID_CREDENTIAL
    worker 子进程 pid 72244/72245；fixture-prompts.jsonl 各 1 条回执
  phase2 (pid 72246, 全新进程同一持久根): 再次 ready; 新请求均 200 delivered
    phase-1 请求重放: 200 {outcome:'delivered', duplicate:true}（durable 幂等跨重启）
    worker pid 72254/72255（4 个互异 worker pid）; 错误凭据 401
  证据根: /Users/yanfenma/.agent-core-closure/closure-Qy2E2Y（runtime-evidence.jsonl 含 composed/deliver 行）
```

调试期如实记录的合同事实（已化为驱动设计，不是产品缺陷）：macOS home 默认 ACL 使 `$HOME` 下任何路径无法过 watchdog 父链校验（生产以 root-owned `/usr/local/...` routing manifest 满足；隔离根经 compose 的 `schedulerRoutingSecurity` seam 只放宽 `parentBoundary`，uid/gid/maxMode 校验保持生产默认）；fixture provider 身份必须与子进程 `registeredProviders` 一致（`ready()` 门校验）。

## R2.4 身份等价性与限制（如实清单）

- **等价**：uid/gid=调用者本人（gui 域生产服务同为 yanfenma）；受控 node v25.6.1 与生产 runtime 同款；配置结构（agents.json/凭据 store/auth config/routing manifest/ incident state）与生产同构；entry 级启动门（含 readiness census）与生产 launcher 同bar。
- **不等价（明确列出，不以 root 结果替代）**：①worker 为 tool-free fixture provider（无真实模型路由）；②notification 认证的 token endpoint 为 fetchImpl 本地替身（verifier 全链真实执行，无网络 auth-service）；③飞书通道 OFF（无凭据，诚实离线）；④authsvc（uid 505）与 root 域（W2/DS/shim）服务身份**未**复制——需要 sudo，不在本轮授权内；⑤未接生产 Feishu/Scheduler/真实写入工具，未发生产 canary。
- 无生产凭据的完整隔离成功路径已实测通过——"没有生产凭据"不再是不做的理由，但**用户服务已验证仍不成立**（须 T2 部署后以真实身份验收）。

## R2.5 制品与源绑定

closure 构建绑定 `sourceSha=eb2b1a21`；文档终版 commit 后按同一配方重建（rebuild 命令 = `release-candidate-cli.mjs --recipe candidate-recipe.json`，recipe 文件在 `/Users/yanfenma/workspace/worktrees/t1-closure-assembly-20260930/`），最终候选以 `t1-release-candidate-v2-20260930/manifest.json` 为权威摘要；终版重建与最后一次 `--full` 实测结果记录于 PR 终态评论。
