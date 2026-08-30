# Broker Capability 测试拆分实现审计 V1（拆测 审计）

> TASK_NAME = 拆测 审计 · REPO = mayf3/dsh-agent-core · PR = #112（Draft/OPEN/MERGEABLE）
> HEAD pin = `6f8a06e7c8953d42194dd6820e9ff0fdbb87c94a`（审计开始与结束两次 gh headRefOid
> 核对无漂移）· BASE = `a1815f00ae6e05858d17f50de2fac91255438e74`（= 审计时 current main）
> Governing Spec = `AGENT_CORE_BROKER_CAPABILITIES_TEST_DECOMPOSITION_V1`（status: accepted，
> implementation_authority: contracts；PR #107 merge commit `1fc3ad64`，已在 main）
> 审计方式：独立 detached worktree（/tmp/audit112/wt @ head）全量机械核验 + 实跑测试/验证器。
> 证据：`docs/evidence/broker-capabilities-test-decomposition-impl-audit-20260830/`（含 MANIFEST sha256）。

---

## 0. 结论（TL;DR）

**拆测 审计 = PASS；READY_FOR_MERGE = YES。**

七项任务 pin 全部通过，Spec §7 ACC-001..008 全部满足，DEC-001..007 全部合规：

| # | 任务确认项 | 结果 |
|---|---|---|
| 1 | exact 8 paths | **PASS** — diff name-status 恰为 §5 的 8 paths（1 delete + 7 add），extra path count = 0，单 commit |
| 2 | 18/18 test blocks byte-identical | **PASS** — 逐 block sha256 一一配对相等（multiset 相等）；名集与 base 完全一致；且用作者同款 recipe 复算排序连接 sha = `e4c0e797…f02901a4` == Spec §6 `SCRATCH_TEST_BLOCK_SHA256`（before == after） |
| 3 | manifest inventory = 13 | **PASS** — `assert.equal(all.length, 13)` 原样保留，且 aggregate 校验唯一 owner = `manifest-inventory.test.js` |
| 4 | svcError 留在 workflow-my-tasks.test.js | **PASS** — 定义（含 JSDoc）逐字节一致，全树唯一出现于该文件；shared helper 与其他 5 个拆分文件零出现 |
| 5 | Broker 173/173 | **PASS** — worktree 实跑 `npm test`：tests 173 / pass 173 / fail 0 / cancelled 0 / skipped 0 / todo 0，rc=0；18 个搬迁 test 名各 ✔ 恰一次 |
| 6 | structure 0 violations | **PASS** — `verify-code-structure.mjs --base github/main --head HEAD` exit 0，violations: 0，warnings 36（全部 pre-existing，无一涉及 8 个闭包路径） |
| 7 | 无 production source 变化 | **PASS** — `packages/*/src`、`scripts/`、`.agents/`、根/broker package.json diff = 0 行；5 个 capabilities manifest src blob id base==head；`git diff --check`（两种 range 形式）干净 |

PRODUCT_CODE_CHANGE = NONE（PR 本身是 test-only 拆分，不改任何产品源）；
PRODUCTION_CHANGE = NONE；本轮审计 DOCS ONLY。

---

## 1. 权威与闭包核对

- PR #112 head = `6f8a06e7…` == 任务 pin（开始/结束两次核对）。单 commit on base `a1815f00`
  （= 审计时 github/main，即 fresh-main 实现基线，符合 Spec §8 步骤 5 "fresh-main" 要求）。
- Governing Spec 在 main 上 frontmatter：`status: accepted`、`implementation_authority: contracts`、
  `production_apply_authority: none`、accepted_date 2026-08-30（§10 Owner-directed 协调 acceptance，
  实现轮审计即本轮）。
- **GOVERNING_SPEC_UNMODIFIED**：Spec blob base == head == `d763aca29f82ebd8ca1e6d544a81f94a8bc23623`
  （PR 不含该文件，闭包证明 + blob id 双重确认）。
- Governance 验证器：`python3 .agents/tools/verify_governance.py --target .` exit 0，
  "vendored governance bytes match governance.lock.json"。

## 2. ACC-001 exact 8 paths

`git diff --name-status a1815f00 6f8a06e7` 恰好 8 条，与 §5 冻结列表逐条一致：

```text
D packages/broker/test/capabilities.test.js                    (-744)
A packages/broker/test-support/capability-fixtures.js          (+83)
A packages/broker/test/capabilities/manifest-inventory.test.js (+28)
A packages/broker/test/capabilities/forum.test.js              (+143)
A packages/broker/test/capabilities/okr.test.js                (+39)
A packages/broker/test/capabilities/workflow-instances.test.js (+180)
A packages/broker/test/capabilities/workflow-my-tasks.test.js  (+198)
A packages/broker/test/capabilities/workflow-transition.test.js(+78)
```

extra path count = 0（8 条白名单之外的 diff 行数 = 0）。行数与 §5 职责映射表逐项一致，
7 个新文件全部 `<500` physical lines（ACC-002）。

## 3. ACC-004 行为等价：18/18 byte-identical

抽取方法（与作者 scratch recipe 反向对齐，脚本存档于 evidence `block-extract.mjs`）：
block = 自 `^test(` 行起、至其后首个列 0 的 `});` / `})` 行止（含），不带尾随换行。

- 旧文件 18 blocks（L116–744），新 6 个测试文件合计 18 blocks，**逐 block sha256 一一配对相等**
  （18/18 BYTE_IDENTICAL，multiset 相等，见 `BLOCK-EXTRACTION.txt` 逐块清单）。
- test 名集合与 base 完全一致（NAME_SETS_EQUAL=true）；各职责文件内部保持旧相对顺序
  （forum 2→3→4→17；instances 5→7→8→9→11；my-tasks 6→12→13→14→15→16；跨文件按职责重分组，
  全局顺序变化为拆分设计本身）。
- **Spec §6 SHA 复现**：blocks 排序后逐块 +`\n` 连接取 sha256 ——
  旧文件 = `e4c0e7971f43c7f5ad0e7f25d30f371da9da9fa584ef4d2444b52b4ef02901a4`，
  新文件 = 同值（`SPEC-SHA-REPRODUCTION.txt`）——与 Spec 冻结的
  `SCRATCH_TEST_BLOCK_SHA256_BEFORE_AFTER` 完全一致，before==after 在作者同款 recipe 下独立复现。
- 旧文件 block 之外区域扫描：除注释/空行外唯一顶层代码 = `svcError` const（含 JSDoc），
  已逐字节迁入 my-tasks；其余 prelude（doc header、imports、6 个 helper）分别由各新文件
  header/imports 与 shared helper 承接，无内容丢失。
- 实跑：18 个搬迁 test 名在 broker 全量测试输出中各 `✔` 恰一次。

## 4. DEC-002/003/004：helper 与 inventory

- **Shared helper**（`test-support/capability-fixtures.js`，83 行）：位于 `test-support/`、
  非 `.test.js`、零 `node:test` import、零 `test(` 注册、零 capability-specific fixture、
  零 manifest count / 产品合同断言。成员恰为 Spec 冻结的 6 个：
  `startMockServer`/`safeJson`/`json`/`startTokenServer`/`wire`/`mockTargets`，
  其中 5 个导出成员**各被 5 个拆分测试文件使用**（≥2 满足共享成员合同），
  `safeJson` 仅 helper 内部使用故不导出。函数体与旧文件逐字节一致（差异仅 `export` 前缀，
  见 §7 O-1 的一个 `async` 关键字例外）。
- **svcError**：定义 + JSDoc 逐字节一致，唯一出现于 `workflow-my-tasks.test.js`（:40-46）；
  `test-support/` 与其余 5 文件 `grep svcError` 零命中（块内使用随 byte-identical block 原样保留）。
- **Inventory**：`assert.equal(all.length, 13)` 原样保留于 `manifest-inventory.test.js`（:14）；
  全 capabilities 目录 `all.length` 断言普查唯一命中该文件（DEC-003 sole aggregate owner）。

## 5. ACC-005/006：实跑结果

- **Broker 173/173**（`cd packages/broker && npm test`，worktree @ head，rc=0）：
  tests 173 / pass 173 / fail 0 / cancelled 0 / skipped 0 / todo 0；`node --test` 递归发现
  `test/capabilities/*.test.js` 六个嵌套文件（ACC-005 反窄 glob 条款满足）。
  环境注记：worktree 初跑失败为**环境性**缺 `node_modules`（scheduler 的 `croner` 传递依赖），
  以第三方依赖符号链接（排除主树 stale `@agent-core`/dangling `@deepseek-ai`）补齐后全绿；
  PR head 的 broker src 不 import 任何 `@agent-core/*`/`@deepseek-ai/*`（全相对路径），与主树
  未提交 WIP 无关。
- **Structure**（`node scripts/verify-code-structure.mjs --base github/main --head HEAD`）：
  exit 0，`PASS (base=a1815f00 head=6f8a06e7)`，in-scope 270 files，violations: 0，
  warnings: 36。36 条 warning 经 grep 证明无一涉及 8 个闭包路径，且 head 树在闭包外与 base
  逐字节相同（8-path 证明），故全部为 pre-existing（scheduler/scripts 等历史文件）——
  无新增 anti-evasion warning/violation（ACC-006）。
- `git diff github/main...HEAD --check` 与 `git diff --check a1815f00 6f8a06e7` 均 rc=0。

## 6. ACC-007/008 与 DEC-001/006/007 边界

- 产品源/结构面零变化：`packages/broker/src`、`packages/*/src`、`production-runtime`、
  `scripts/`、`.agents/`、根与 broker `package.json` 的 diff = 0 行；
  `src/capabilities/{forum,okr,workflow,scheduler,agent-definition}.js` 5 个 manifest 源文件
  blob id base==head（manifest bytes unchanged）。
- `capabilities.test.js` 已删除且全 packages 无任何 shim/re-export/loader/同名替代引用
  （`grep -rn "capabilities.test" packages/ --include='*.js'` = 0 命中，DEC-001）。
- `test/capabilities/` 目录恰含 6 个拆分 home；**无** `workflow-global-instances-v2.test.js` /
  `workflow-domain-pagination-v2.test.js` placeholder（ACC-008）；Forum V2 顶层冻结 home
  `test/forum-capabilities.test.js` 未触碰（diff 0 行，DEC-004 嵌套命名隔离成立）；
  transition-shaped idempotency fixture 唯一落点 = `workflow-transition.test.js`（DEC-006 表）。
- `.agents/structure-registry.json` 与 guardrail 文件不在 diff 中（DEC-007：无 registry/rule
  workaround；verifier 未修改——`scripts/` diff = 0）。

## 7. 非阻塞观察

- **O-1 helper `async` 关键字**：旧 `async function startTokenServer()` → 新
  `export function startTokenServer()`（去掉 `async`）。函数体仅 `return startMockServer(...)`
  （返回 Promise），调用方 `await` 语义完全一致，行为零差异；DEC-005 枚举的结构性差异未逐字
  覆盖"删关键字"这一写法，但 DEC-005 管辖的是 18 个 test block（全部 byte-identical），
  helper 归 DEC-002 管（成员/位置合同满足）。记录在案，不建议返工。
- **O-2 全局 block 顺序**：18 块按职责跨文件重排（设计使然），各文件内保持旧相对顺序；
  Spec 未要求全局顺序，ACC-004 只要求名集一致 + 逐块保留——均满足。
- **O-3 warning 计数漂移**：Spec authoring 期 baseline 为 33/34 条 warning（旧 base），
  本审计 base `a1815f00` 上为 36 条——main 自身演进所致，与本 PR 无关，无一涉及闭包路径。
- **O-4 PR 状态**：PR #112 为 Draft，PR body 自述 "Draft only. Do not merge or deploy."；
  本审计 PASS 后按 Owner 编排 `READY_FOR_MERGE = YES`，merge 时机由 Owner 决定
  （Spec §8 步骤 6：decomposition audit + merge）。merge 后 PR #101/#102 可按步骤 7
  rebase 到 stable dedicated paths。

## 8. 审计边界

- DOCS ONLY：1 report + 1 evidence dir（12 files 含 MANIFEST sha256）；零 sudo；
  不访问 `/Users/authsvc/**`、mapping、credential、services、production。
- 审计 worktree `/tmp/audit112/wt` 与 scratch 完全清理；被审计 PR 分支/文件零修改
  （worktree detached 只读 + 实跑测试；`node_modules` 为审计侧注入的第三方符号链接，
  未进入任何 commit）。
- 主树 pre-existing WIP（broker src 修改 + untracked docs）原样保留，未纳入本次 commit。
- `git diff --cached --check` 于提交前复核。

---

## FINAL

```text
拆测 审计 = PASS
READY_FOR_MERGE = YES
PR112_HEAD = 6f8a06e7c8953d42194dd6820e9ff0fdbb87c94a (no drift)
EXACT_8_PATHS = PASS (1 delete + 7 add; extra = 0)
TEST_BLOCKS = 18/18 BYTE_IDENTICAL (per-block sha pairing; name sets equal)
SCRATCH_SHA_REPRODUCED = e4c0e7971f43c7f5ad0e7f25d30f371da9da9fa584ef4d2444b52b4ef02901a4 (before == after)
MANIFEST_INVENTORY = 13 (sole owner manifest-inventory.test.js)
SVCERROR_PLACEMENT = workflow-my-tasks.test.js only (byte-identical def)
BROKER_TESTS = 173/173 PASS (0 fail/cancelled/skipped/todo; nested discovery live)
STRUCTURE = PASS / 0 violations (warnings 36, all pre-existing)
GOVERNANCE = PASS (vendored bytes match)
GOVERNING_SPEC_UNMODIFIED = YES (blob d763aca2 identical base/head)
PRODUCT_SOURCE_DIFF = 0; REGISTRY_RULE_DIFF = 0; MANIFEST_BYTES = unchanged
BLOCKERS = NONE
PRODUCT_CODE_CHANGE = NONE (PR is test-only; audit is docs-only)
PRODUCTION_CHANGE = NONE
NEXT_TASK = merge PR #112 (Owner orchestration), then PR #101/#102 reconcile per Spec §8 step 7
```
