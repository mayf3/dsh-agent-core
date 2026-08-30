# WORKFLOW_GLOBAL_INSTANCES_V2_IMPLEMENTATION_AUDIT_V1

TASK_NAME = 接入 审计（INDEPENDENT_IMPLEMENTATION_REVIEW）
Date: 2026-08-30
Audited PR: #114 `feat(broker): workflow_global_instances global read-only enumeration capability (Global Instances V2)`
REVIEW_HEAD pin: `137fa9fc4c9ba49b64a96fb89465dfb443409d21`
Governing Spec: `AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V2`（accepted，`implementation_authority: contracts`）
Base: `e2e1e22efabe99896bc0f83e02ac5e93d2c97f8d`（= github/main at audit time；即 PR #112 分解实现的 merge commit——§14 步骤 5 实现前置成立的直接坐标）

VERDICT = **PASS**；READY_FOR_MERGE = **YES**。

Evidence: `docs/evidence/workflow-global-instances-v2-implementation-audit-20260830/`（13 files + MANIFEST sha256）。

---

## 审计环境与方法

独立 worktree（`/tmp/audit-114` detached @ head；`/tmp/audit-114-base` detached @ base）复跑全部
机械化验证；测试注入仅第三方依赖 symlink（`@deepseek-ai/dsh-tools`、`@deepseek-ai/schemastery`、
`croner`——后者为 broker 既有 `scheduler-validation.js → scheduler/src/schedule.js` 基线链路的
传递依赖，与前轮拆测审计的环境先例相同）；broker src/test 代码全部经 worktree 自身相对路径
导入，主树 pre-existing WIP 零参与。零 sudo、零生产访问。

## 逐项独立确认（任务 19 项）

1. **HEAD_DRIFT = NONE** — gh `headRefOid` = 本地 `implementation/workflow-global-instances-v2` =
   `github/implementation/workflow-global-instances-v2` = `137fa9f...`（三源一致）；PR = base 上
   **单一 commit**；merge-base = base = e2e1e22。审计结尾再次 fresh 核对（见下）。
2. **GOVERNING_SPEC_UNMODIFIED = YES** — V2 Spec 位于 base（frontmatter `status: accepted`、
   `implementation_authority: contracts`、`accepted_date: 2026-08-30`、supersedes V1）；spec blob
   base==head 均为 `86ef0f599a5d3bdc8a2ba249354b9f2f9e827cdc`（逐字节一致）；且 3-file closure
   之外全树无任何路径变化（docs/specs、.agents/**、scripts 均未触及）。
3. **EXACT_FILE_CLOSURE = PASS** — `git diff --name-status base..head` 恰为 CTR-001/ACC-010 闭包：
   - `M packages/broker/src/capabilities/workflow.js`（+76/-0）
   - `M packages/broker/test/capabilities/manifest-inventory.test.js`（+3/-3）
   - `A packages/broker/test/capabilities/workflow-global-instances-v2.test.js`（+317）
   `capabilities.test.js` 不在 diff（base 已不存在该文件，前置条件实测确认）。
4. **workflow.js 纯追加、既有 manifest 不变** — diff 0 deletions；两处插入点均在既有 manifest
   对象之外（`workflowDomainInstancesManifest` 之后、`manifests` 数组末尾追加
   `workflowGlobalInstancesManifest`）。forum.js/okr.js 等 manifest 源不在闭包内 → blob 不变。
   base 实测 aggregate = 13（5 workflow + 7 forum + 1 okr，inventory 断言 live 确认）。
   注：Spec CTR-007 措辞「既有 12 个 manifest」为 V1 冻结时点的历史计数表述，语义（全部既有
   manifest 字节不变）按 13 实测成立——非阻断 O-3。
5. **工具名** — `id`/`toolName` 均为 `workflow_global_instances`；唯一 operation `list`。
6. **HTTP binding** — `{ target: 'svc-workflow', method: 'GET', path: '/internal/v1/workflow-instances/global' }`
   逐字段符合 DEC-001；fixture 断言实收 GET 该路径。
7. **requiredScopes = ['workflow.read'] 精确** — manifest 声明 + 测试 `deepEqual` 断言 + token
   请求体 `scope === 'workflow.read'` 三重确认；无 scope 提升。
8. **无硬编码身份** — 全 diff 扫描 `agt_|hr-agent|dispatcher|dc702687|bc970ced|6515-4a2a|710f-4479`
   唯一命中为新测试文件内的**否定断言**（assert 不存在）；manifest 正文仅含服务端角色名
   （GLOBAL_WORKFLOW_READER/COORDINATOR，DEC-004 要求的声明面）。
9. **assigneePrincipalId 仅结果过滤** — manifest 描述「Result filter only — never affects the
   caller identity」；ACC-005 测试证明两次不同 filter 值调用 token 请求体逐字节相同、
   credential 调用不变、参数仅出现在业务 query；身份唯一来源 = trusted seam（OBS-007）。
10. **limit 1..20 本地 fail-fast** — 复用共享 `limitProperty`（`{type:'integer', minimum:1,
    maximum:20, validationError:'invalid_pagination'}`，与 CTR-002 逐字一致）；ACC-003 测试
    `limit ∈ {0,-1,21}` → `invalid_pagination` 且 token 请求数 = 0、业务 HTTP 数 = 0。
11. **lifecycle/status 非法值交服务端** — 两参数声明为 plain string（无本地 enum 校验，schema
    仅对声明的 minimum/maximum/validationError fail-fast，OBS-008 机制），描述明示
    「validated server-side」；`invalid_lifecycle`/`invalid_status` 在错误表声明；测试证明合法
    枚举值原样转发（half-cursor 同机制测试证明非校验参数可透传到下游）。
12. **cursor 原样透传** — `beforeCreatedAt`/`beforeId` 均在 `http.query` 声明集；ACC-004 双测试：
    half-cursor 按声明转发、下游 422 `invalid_cursor` 端到端保留（status/request-id/detail）；
    成对 cursor 正常翻页且 `next_cursor` 透传（DEC-002 显式偏差 + DEC-007 不 reshape）。
13. **双 403 码完整保留** — `global_read_role_required` 与 `global_coordinator_required` 均在
    manifest 错误表（覆盖 §3 双码时序声明）；两个独立 fixture 分别端到端断言 code+status=403+
    requestId 保留，未被降级为 `forbidden`/`invalid_arguments`/`http_4xx`。
14. **GET-only、无 body、无 Idempotency-Key、无 Scheduler 写面** — 测试断言实收 method=GET、
    `rawBody === ''`、`JSON.stringify(manifest).includes('idempotency') === false`；diff 中无
    任何 scheduler 面（唯一 scheduler 命中为否定断言）；无 POST/PUT/DELETE 绑定。
15. **MANIFEST_INVENTORY 13→14** — `manifest-inventory.test.js` 改动恰 3 行（注释/测试名/断言值
    13→14），validation 语义不变（CTR-009）；head 实测 `schema: all 14 first-batch manifests
    validate` PASS；base 实测 13。
16. **BROKER_TESTS 独立复跑** — head `npm test`（packages/broker，`node --test`）=
    **182/182 PASS / 0 fail / 0 cancelled / 0 skipped / 0 todo，rc=0**；base 复跑 = **173/173**；
    delta = 恰 +9 = dedicated home 的 9 个 test（逐一 ✔ 确认，含名字清单）。与 ACC-006
    「数值基线以实现时 fresh main 为准」的 173 基线 + 9 精确自洽。
17. **STRUCTURE_GATE** — `node scripts/verify-code-structure.mjs --base e2e1e22 --head 137fa9f`
    **exit 0 / PASS / violations 0**（271 in-scope files；36 warnings 全部为既有 FILE_WARNING_LINES/
    TEST_LOGIC_IN_FIXTURE，无一触及 3 个闭包路径）。
18. **GOVERNANCE + DIFF-CHECK** — `python3 .agents/tools/verify_governance.py --target .`
    exit 0（vendored governance bytes match）；`git diff --check`（base..head 与
    merge-base..head 两形式）rc=0。
19. **PRODUCTION_CHANGE = NONE** — 审计全程零生产连接（无 HTTP 到任何服务、无 DB、无 ssh、
    无 deploy/restart）；PR 本身为 broker manifest + 测试的纯加法，`production_apply_authority = none`。

## Spec 合同细目核对（§8/§9/§10）

- **CTR-001 错误表**：spread（baseErrors×2 + authErrors×2 + queryErrors×4）+ 显式 6 码 =
  恰 14 码，与 Spec 声明集合逐码一致（测试内 Set 断言全 14 码存在）；canonical http_4xx/http_5xx
  由 `withTransportErrors` 既有机制保证。
- **CTR-009 / ACC-010**：dedicated home 为 base 不存在的新建文件（实测）；317 physical lines < 500；
  使用 decomposition 冻结的 shared helper（`test-support/capability-fixtures.js` 的
  `wire/json/mockTargets/startMockServer/startTokenServer`），`wire` 走真实
  `buildToolDefinition + createHttpHandlers` 代码路径（非 mock 绕行）。
- **实现前置（§14 步骤 5）**：base = PR #112 merge commit，`capabilities.test.js` 已删除、
  `manifest-inventory.test.js` 为 aggregate owner（13）、dedicated home 不存在——前置成立。
- **ACC-008（非回归）**：既有 manifest 字节不变（纯加法 diff + 全树闭包外零变化）；
  173 个既有测试在 head 全部继续 PASS（0 回归）。

## Non-blocking observations

- **O-1** PR 为 Draft——与前序实现 PR 编排一致（审计后由 Owner mark ready + merge）。
- **O-2** 无「非法 lifecycle 值转发→422 invalid_lifecycle」的显式 fixture——Spec ACC 未要求
  （ACC-004 仅覆盖 invalid_cursor）；透传机制已由 schema 无枚举约束 + 合法值转发测试 +
  half-cursor 透传测试结构性证明。
- **O-3** Spec CTR-007「既有 12 个 manifest」为 V1 时点历史计数（实现时实测 13）；语义
  （全部既有 manifest 字节不变）实测成立。Spec 侧措辞，非实现缺陷。
- **O-4** 测试对 workflow.js 源码的 generic-tool 静态断言（readFileSync + 正则）为本文件新增
  模式（既有 dedicated home 无此先例），但与 decomposition helper 纪律兼容且只读源码。

## Boundaries

DOCS ONLY（本报告 + 1 evidence 目录 14 文件含 MANIFEST sha256）；ZERO sudo；零生产连接与
生产变更；audited PR 分支/文件未修改；两个审计 worktree 与 /tmp scratch 全部清理；主树
pre-existing WIP（broker src 修改 + 未跟踪 docs）保持原样；evidence .txt transcripts 按仓库
惯例做行尾空白规范化；新文件按显式路径 stage。

## Final

```text
接入 审计 = PASS
REVIEW_HEAD = 137fa9fc4c9ba49b64a96fb89465dfb443409d21
HEAD_DRIFT = NONE (gh headRefOid == local == github remote, re-verified at round end)
EXACT_FILE_CLOSURE = PASS (3 files: M workflow.js +76/-0, M manifest-inventory.test.js +3/-3, A workflow-global-instances-v2.test.js +317)
SPEC_COMPLIANCE = PASS (CTR-001..009 / DEC-001..009 / ACC-001..010 全项核对)
MANIFEST_INVENTORY = 13 -> 14 (base live 13, head live 14, sole aggregate owner)
BROKER_TESTS = 182/182 PASS (base 173/173 + 9 new, rc=0, isolated worktree)
STRUCTURE_GATE = PASS / 0 violations (36 warnings all pre-existing)
GOVERNING_SPEC_UNMODIFIED = YES (blob 86ef0f59 base==head)
GOVERNANCE = PASS (vendored bytes match) ; GIT_DIFF_CHECK = PASS
BLOCKERS = NONE
READY_FOR_MERGE = YES (Owner to mark ready + merge; then姊妹 PR #109/#110 per §14 coordination)
PRODUCTION_CHANGE = NONE
```
