# Broker Capability V2 Successors — 联动 审计 V1（PR #108 / #109 / #110）

- 事务：TASK_NAME = 联动 审计（三 Draft PR 独立审计，分别输出 verdict）
- 日期：2026-08-30；AUDIT_KIND = DOCS_ONLY_INDEPENDENT_REVIEW
- 审计对象（head 均与任务 pin 逐字节一致，gh `headRefOid` 复核无漂移）：
  - PR #108 `docs/workflow-global-instances-capability-v2-successor` head
    `4f1d3b3be0530494eccc3677e5a0f1d44636e9af`（接入 = Global Instances V2 successor）
  - PR #109 `docs/workflow-domain-instances-pagination-v2-successor` head
    `b8dea71290a99d7534aa2899a5ae7440814e3c45`（分页 = Domain Pagination V2 successor）
  - PR #110 `docs/workflow-assignee-transition-test-home-amendment` head
    `d1bc0f5b4e56d0eff6a4f14c7a955c4845d1101c`（流转 = Transition focused amendment）
- 三 PR 均为 base `f54679cb1a9cb9fe5e4ca38b9b354a5d25ef6221`（authoring 时 current
  main）之上的单 commit、单 docs 文件变更（#108 +543 新增 V2；#109 +441 新增 V2；
  #110 +166/−2 修订 accepted Transition V1）。packages/、scripts/、.agents/、
  svc-workflow、production 零触碰；PR #101/#102/#107 未被修改。

## 0. 共同核验（三 PR 全部成立）

1. **正确 pin PR #107 @ deda45d = PASS。** PR #107（decomposition，
   `AGENT_CORE_BROKER_CAPABILITIES_TEST_DECOMPOSITION_V1`）当前 head =
   `deda45d87635c577be37d6402ba1c26c8a483428`；三个 Spec 引用的 pin 与之完全一致
   （含 branch 名与 §5 指向）。**8-path pin 逐字核验**：从三个 Spec各自抽取的 8 行
   `D/A` closure 块与 PR #107 §5 的 closure 块 `cmp` **byte-identical**（#109 的
   块位于头部 blockquote，剥除 `> ` 前缀后亦逐字节一致；#108、#110 为裸 fenced
   block）。DEC-003（`manifest-inventory.test.js` 为 aggregate inventory 唯一
   owner、拆分事务保持 13、后续 PR 须经 governing Spec 授权单独调数）与
   DEC-006 home 表逐行核对：三个 Spec 声明的 dedicated home 与表中三行**逐字一致**
   （含「decomposition 是否创建」的语义：Global V2 / Pagination V2 = NO（由首次
   获授权实现创建），Transition = YES（先承接 generic fixture、正式 fixture 只追加））。
2. **产品合同零变化 = PASS（逐字符级复核）。**
   - #108：whitespace-join 后 §8/§9/§10 与 V1 逐字符 diff——DEC-001..007、
     CTR-003..008、ACC-001/002/004/005/007/008/009 语义零变化；差异恰为声明的
     TEST_HOME_AND_INVENTORY_LOCATION_ONLY（CTR-001 闭包落点 + ACC-006 落点）
     加新增结构 ID（DEC-009/CTR-009/ACC-010），另有一处环境事实刷新（见 O-1）。
   - #109：全文本 diff——§1 服务端契约、§2 live proof、§3 gap 因果、§4 R1–R6
     正文**零改动**（仅标题加注）；唯一闭包差异 = §5 第 4 文件换 dedicated home +
     附加结构纪律/验收门；§1–§3 的三个产品源文件（workflow.js/schema.js/
     mapping.js）改动面逐字继承。
   - #110：整文件 whitespace-join 后对 main 版做字符级 opcode 分析 = **5 处纯
     insert、0 处 delete/replace**——严格 additive；DEC-001..006、CTR-001..008、
     §15 三项 fix、§16 acceptance 记录、frontmatter 逐字保持（frontmatter 与
     main 版 diff 为空，`status: accepted` / `implementation_authority: none`
     未翻转，与 §17 声明一致）。
3. **dedicated test home 正确 = PASS。** 三 home 均为 decomposition DEC-006 冻结
   path 的逐字采用：#108 `capabilities/workflow-global-instances-v2.test.js`；
   #109 `capabilities/workflow-domain-pagination-v2.test.js`；#110
   `capabilities/workflow-transition.test.js`（且 #110 正确表述了该文件是 8-path
   成员、由 decomposition 创建、正式 fixture **只追加**职责——与另两个「实现时
   新建」的 home 语义差异被准确区分）。
4. **不再触碰 capabilities.test.js = PASS。** 逐处语境审计：#108 内该字面路径
   出现 12 处、#109 出现 4 处、#110 出现 3 处，全部位于非授权语境——8-path pin 的
   D 行、死锁动机、STATE/OBS 历史事实坐标（744 行/18 blocks/:116-118 断言坐标
   均实测复核成立）、负面禁止纪律、rejected-alternative 记录、§14/§8 前置描述、
   #110 AMEND-1 的旧条目对照引用——**零处作为实现落点授权**；#110 §2 In-scope
   已不再包含该路径。
5. **inventory 顺序 13→14→15 = PASS。** 基线 13 在 PR head 上实测（forum 7 +
   workflow 5 + okr 1 = 13，live import 计数；legacy 文件 :116-118 的
   `assert.equal(all.length, 13)` 亦在位）。三 Spec + decomposition 的协调序
   表述一致：decomposition 保持 13 → Global Instances V2（#108）授权 13→14 →
   Transition amendment（#110）授权 14→15（偏离时按 then-current+1，终态 15）；
   Domain Pagination V2（#109）计数 delta = 0（`manifest-inventory.test.js`
   不在其闭包内）。无冲突、无双重计数、无漏计。
6. **governance / structure / diff-check = PASS ×3。** 三个 head 各自在独立
   detach worktree 实测：`verify_governance.py --target .` exit 0（vendored
   bytes match）；`npm run verify:structure` exit 0 / 0 violations（仅 main
   上既存的 FILE_WARNING_LINES 警告，与 docs-only diff 无关）；`git diff
   --check origin/main..<head>` 干净。frontmatter YAML 解析 PASS（两个 V2 的
   status=proposed / implementation_authority=none / production_apply_authority=
   none / supersedes=[V1] / superseded_by=null；#110 与 main 逐字节相同）。
   governed_by 引用（Error Preservation V1 / Credential Provisioning V1 /
   Adoption V0 / Domain Instances Broker V1）在 main 上均为 accepted。
7. **无代码、无生产变化 = PASS。** 三 diff 均恰 1 个 docs 文件；无
   packages/scripts/.agents 变更；无 merge、无 acceptance 事务、无 Grant 变更、
   无部署。broker 基线复核：PR head 上 `node --test packages/broker/test/
   *.test.js` = **173/173 PASS**（与 Spec 声明一致）。
8. **治理路径合规性复核。** #108/#109 选 whole successor：其 V1 均为
   `implementation_authority: contracts` 的在权 authority，闭包变更按
   SPEC_FORMAT_V0 §14.1/§14.3 属 SUPERSEDE 边界（#108 ALT-009 论证成立）；
   backlink 翻转按 §2.7 留给原子 acceptance 事务，本轮 V1 不动（实测两 V1 文件
   在 PR diff 中零出现）。#110 选 focused in-place amendment：Transition V1 为
   `implementation_authority: none`（从未授予实现权、无任何 Transition 实现
   PR 存在），decomposition DEC-006/§8 步骤 3 明文允许该路径；修订严格 additive
   符合 §14.2（Goal/scope/governed_by/既有 DEC-CTR-ACC 全部不变，新增内容为
   bounded elaboration），且不 flip lifecycle 字段、将 authority flip 后置于
   独立审计 gate（AMEND-3）。

## 1. PR #108 — 接入 审计

**VERDICT：接入 审计 = PASS。**

- pin/合同/落点/inventory（13→14 唯一调整点 = manifest-inventory.test.js）/
  非授权语境/验证器全部 PASS（见 §0）。
- §14 与 decomposition §8 的序列逐字对齐（步骤 3-4 同原子事务选项、V1 backlink
  原子翻转、PR #101 处置与失败语义）核验一致。
- O-1（非阻塞观察）：V2 的 CTR-002/ACC-003 删除了 V1 的 dual-path 条件分支
  （「未落 error-preservation 基线上由下游 422 兜底」）——该分支的前提已被
  V2 §3/CLM-003 显式声明消灭（error-preservation 已于 PR #82 合入 main），
  属环境事实刷新，任何可实现基线上的产品语义不变；whitespace-join 复核确认
  无其他未声明差异。

## 2. PR #109 — 分页 审计

**VERDICT：分页 审计 = PASS。**

- pin/合同（R1–R6 与三源文件改动面逐字继承）/落点/inventory delta = 0/
  非授权语境/验证器全部 PASS（见 §0）。
- §8 序列与 PR #102 处置、失败语义与 decomposition §8 一致。
- O-2（非阻塞观察）：8-path pin 位于头部 blockquote（带 `> ` 前缀）而非裸
  fenced block——剥前缀后 byte-identical 已证；纯排版差异。

## 3. PR #110 — 流转 审计

**VERDICT：流转 审计 = PASS。**

- pin/合同（严格 additive，产品合同零变化）/落点（含 append-only 语义）/
  inventory（14→15 唯一调整点）/非授权语境/验证器全部 PASS（见 §0）。
- AMEND-3 授权方案（audit-gate → 单 commit 单文件 lifecycle-only flip，可与
  姊妹 spec/decomposition acceptance 同原子事务）语义自洽；本轮 lifecycle 字段
  零变化已实测（frontmatter diff 为空）。
- O-4（非阻塞论证记录）：§14.3「changed acceptance meaning」边界对测试落点
  翻转的适用性——Transition V1 从未授予实现权（implementation_authority:
  none）且旧落点结构性不可实现（guardrails 死锁），不存在任何「先前可通过」
  的实现会被翻转影响；decomposition DEC-006/§8 步骤 3 明文要求该 amendment
  路径。判据成立，不构成 blocker。
- O-5（非阻塞观察）：AMEND-2 的「then-current 值 +1」偏离回退语义合理，终态
  15 不变。

## 4. 环境观察（非阻塞，全部三 PR）

- O-3：authoring base `f54679c` 之后 main 已前进至 `b53ebd6`（PR #111 合并，
  agent-router/production-runtime 范围）。实测 `f54679c..origin/main` 对
  packages/broker、scripts/、.agents/ 的 diff 为空——三 Spec 的全部 broker
  结构事实（13 manifests / 173 tests / 744 行 legacy / guardrails 状态）在
  current main 上仍然成立；AUTHORING_BASE pin 作为历史事实不受影响。

## 5. 边界

- DOCS ONLY：本审计新增 1 报告 + 1 evidence 目录（含 verifier transcripts、
  broker facts、pin 对照、occurrence census、合同 delta 分析）；未执行任何
  sudo；未触碰 /Users/authsvc/**、mapping、credential、services、production；
  三个审计对象 Spec 文件未被修改；PR #101/#102/#107 未被修改；主 worktree
  既有 WIP（broker 修改 + 未跟踪 docs）原样保留；/tmp 审计 worktree 与 scratch
  已清理。
- `git diff --cached --check` = PASS。

## 6. 最终字段

```text
接入 审计 = PASS
分页 审计 = PASS
流转 审计 = PASS
PR107_PIN = deda45d87635c577be37d6402ba1c26c8a483428 (verified, no drift)
EIGHT_PATH_PIN_BYTE_MATCH = YES x3
PRODUCT_CONTRACT_DELTA = #108 TEST_HOME_AND_INVENTORY_LOCATION_ONLY / #109 TEST_HOME_ONLY / #110 NONE (strictly additive)
DEDICATED_TEST_HOME = DEC-006 verbatim x3
CAPABILITIES_TEST_JS_AUTHORIZED_TOUCH = 0 (all occurrences non-authorizing)
INVENTORY = 13 baseline live-verified; 13->14 (#108); 14->15 (#110); +0 (#109)
GOVERNANCE/STRUCTURE/DIFF_CHECK = PASS x3
BROKER_TESTS = 173/173
PRODUCT_CODE_CHANGE = NONE; PRODUCTION_CHANGE = NONE
BLOCKERS = NONE (observations O-1..O-5 non-blocking)
READY_FOR_ACCEPTANCE_COORDINATION = YES (per each spec's sequenced lifecycle)
```
