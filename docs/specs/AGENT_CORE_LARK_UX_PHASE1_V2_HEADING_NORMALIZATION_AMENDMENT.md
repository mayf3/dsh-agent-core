---
spec_id: AGENT_CORE_LARK_UX_PHASE1_V2_HEADING_NORMALIZATION_AMENDMENT
status: proposed
type: owner-ruling child amendment (spec-only; docs-only)
amends: AGENT_CORE_LARK_UX_PHASE1_V2
parent_status: accepted
supersedes_parent: false
date: 2026-08-22
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
scope:
  - CTR-MARKDOWN-HEADING-001 heading-level rendering contract replacement only
  - mayf3/dsh-agent-core docs/specs authority only
governed_by:
  - AGENT_CORE_LARK_UX_PHASE1_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
references:
  - docs/specs/AGENT_CORE_LARK_UX_PHASE1_V2.md
  - docs/specs/AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2.md
  - docs/specs/AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0.md
---

# AGENT_CORE_LARK_UX_PHASE1_V2 — Heading Normalization Owner Ruling (Child Amendment)

> 性质：**Owner-ruling child amendment / SPEC ONLY（docs-only）** · 日期：2026-08-22
> 仓库：`mayf3/dsh-agent-core`
> Parent authority：`AGENT_CORE_LARK_UX_PHASE1_V2`（accepted，blob `91513d140bfeb2747326a465bdc01d72c899c864`）
> 本轮只记录 Owner 对 SDK 原生标题归一化的裁决；不修改 accepted parent Spec，不修改产品代码、SDK、SDK
> dependency coordinate 或 Phase A，不实现 Markdown 或自动 mention，不 acceptance-finalize，不 merge。

---

## 0. Machine-readable Ruling

```text
AMENDMENT_ID = AGENT_CORE_LARK_UX_PHASE1_V2_HEADING_NORMALIZATION_AMENDMENT
AMENDMENT_RELATION = REPLACES_HEADING_CONTRACT_TRIO_ONLY
PARENT_SPEC = AGENT_CORE_LARK_UX_PHASE1_V2
PARENT_SPEC_STATUS = accepted
SUPERSEDES_PARENT_SPEC = NO
PARENT_SPEC_FILE_MODIFIED = NO

OWNER_RULING = ACCEPT_SDK_NATIVE_HEADING_NORMALIZATION
SDK_HEADING_AUTHORITY = REVIEWED_@larksuite/channel_RUNTIME
REVIEWED_SDK_SOURCE = bd24f6742513769c80b5401b96ad464d74dd2027
REVIEWED_SDK_RUNTIME = ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f

H1_H6_DISTINCT_RENDERING = NOT_REQUIRED
HEADING_TEXT_PRESERVATION = REQUIRED
HEADING_ORDER_PRESERVATION = REQUIRED
HEADING_RENDERING_TREATMENT = REQUIRED
CUSTOM_MARKDOWN_CONVERTER = FORBIDDEN
CONNECTOR_HEADING_PREPROCESSOR = FORBIDDEN
NEW_SDK_REVISION = NO
DEPENDENCY_CHANGE = NONE

REPLACED_PARENT_ITEMS =
  CTR-MARKDOWN-HEADING-001
  ACC-MARKDOWN-HEADINGS-H1-H6
  TEST-LUX-MD-HEADINGS-H1-H6
REPLACEMENT_ITEMS =
  CTR-MARKDOWN-HEADING-NATIVE-001
  ACC-MARKDOWN-HEADING-NATIVE-001
  TEST-LUX-MD-HEADINGS-NATIVE

OTHER_UX_CONTRACT_CHANGE = NONE
PRODUCT_SEMANTIC_DELTA = HEADING_LEVEL_DISTINCTNESS_ONLY

AMENDMENT_STATUS = proposed
OWNER_RULING_RECORDED = YES
IMPLEMENTATION_PERMISSION = NO
AUTHORITY_EFFECTIVE_WHEN = INDEPENDENT_REVIEW_PASS_AND_OWNER_ACCEPTANCE_FINALIZE_AND_MERGED_TO_IMPLEMENTATION_BASE
READY_FOR_INDEPENDENT_REVIEW = YES
```

---

## 1. Goal

记录 Owner 裁决：accept parent `AGENT_CORE_LARK_UX_PHASE1_V2` 无法在 reviewed SDK runtime 上满足的
六级标题一一视觉区分要求，将其替换为与 SDK 原生 heading normalization 兼容、且不放松信息保真的
heading contract；其余 parent Contract、Acceptance、gate、边界与禁令逐项保持不变。本 amendment
解除的是 heading-level distinctness 这一条 blocking divergence，不授权任何实现。

## 2. Scope and non-goals

### In scope

- 仅替换 parent 的 `CTR-MARKDOWN-HEADING-001`、`ACC-MARKDOWN-HEADINGS-H1-H6`、
  `TEST-LUX-MD-HEADINGS-H1-H6` 三个 stable item 的 normative effect；
- 冻结 Owner 裁决 `ACCEPT_SDK_NATIVE_HEADING_NORMALIZATION` 及其全部参数；
- 记录支撑该裁决的可复现实证（implementation preflight 发现的确定性 SDK 行为）；
- 逐项声明 parent 其余 UX 合同 UNCHANGED。

### Out of scope（Non-goals）

- 不修改 accepted parent Spec 文件（accepted immutability；parent 文本保留为历史 authority 记录）；
- 不修改产品代码、SDK、SDK dependency coordinate、Phase A foundation；
- 不实现 Markdown 成功回复或自动 mention（parent 实现轮在 parent 前置条件满足后另行授权）；
- 不做 acceptance-finalize、不 merge、不部署；
- 不引入 custom markdown converter、connector heading preprocessor 或第二渲染 authority。

## 3. Authority and dependencies

```text
GOVERNED_BY =
  AGENT_CORE_LARK_UX_PHASE1_V2
  AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
LOCAL_AUTHORITY_BOUNDARY =
  MAY_REPLACE_PARENT_HEADING_CONTRACT_TRIO_ONLY
  MUST_NOT_CHANGE_ANY_OTHER_PARENT_CONTRACT_OR_ACCEPTANCE_OR_GATE
  MUST_NOT_GRANT_IMPLEMENTATION_PERMISSION
AMENDMENT_MECHANISM = NARROW_CHILD_AMEND_WITH_NEW_STABLE_IDS
WHY_NOT_EDIT_PARENT_IN_PLACE =
  accepted stable IDs may not be narrowed or reversed in place (SPEC_FORMAT_V0 §14.1)
WHY_NOT_SUPERSEDE_PARENT =
  the parent's Goal, scope, authority ownership and every other Decision remain unchanged;
  only one contract trio's acceptance meaning changes (same accepted scope correction as the
  V2 ingress-content child amendment precedent)
```

SDK reviewed source `bd24f6742513769c80b5401b96ad464d74dd2027` 与 runtime
`ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f` 是 dependency/source-evidence 坐标（parent §3 冻结），
不是本地 governing authority；本 amendment 不改变它们。

## 4. Current State

### STATE-LUXHN-001 — Parent UX Spec accepted on main; implementation round blocked by heading contract

- Subject: `AGENT_CORE_LARK_UX_PHASE1_V2` authority 与其 implementation preflight 结果
- As of commit/artifact: main `d506f81105e8aa05177a01b817ebe11dcc076ba5`；parent spec blob
  `91513d140bfeb2747326a465bdc01d72c899c864`（`a46e81c` 与 `d506f81` 两点一致）
- Environment: `mayf3/dsh-agent-core` origin/main；实现 preflight worktree
  `.worktree/ux-exec-lark-phase1-v2-implementation`（branch `feat/lark-ux-phase1-v2`）
- Observed at: 2026-08-22
- Projection: parent 前置条件（accepted exact content + Phase A foundation 同 base）全部满足、D-U1 seam
  无漂移；preflight 在 pinned runtime 上发现 `CTR-MARKDOWN-HEADING-001` 确定性不可满足，实现按
  parent §12 停止，PRODUCT_CODE_CHANGE = NONE。
- Basis: `OBS-LUXHN-001`、`OBS-LUXHN-002`、`CLM-LUXHN-001`；blocker evidence commit `659bab3`。

### STATE-LUXHN-002 — Reviewed SDK runtime performs native heading style optimization

- Subject: `@larksuite/channel` markdown→post 转换
- As of commit/artifact: source `bd24f6742513769c80b5401b96ad464d74dd2027`
  （`src/outbound/markdown/optimize-style.ts:30-43`）；runtime
  `ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f`（= bd24f67 + built dist，`git diff --stat` 仅 dist 文件）
- Environment: 离线实证（stub transport 的真实 SDK `channel.send({ markdown })`），无网络
- Observed at: 2026-08-22
- Projection: 文档含任一 H1–H3 标题时，SDK 在发送载荷（客户端渲染前、字节级、确定性）执行
  `##`–`######` → `##### ` 与 `#` → `#### ` 的归一化；六级输入至多产生两级可区分视觉样式。
- Basis: `OBS-LUXHN-002`、`OBS-LUXHN-003`、`EVD-LUXHN-001`。

## 5. Observations

### OBS-LUXHN-001 — Parent preconditions verified; blocker isolated to the heading trio

- Subject: UX implementation preflight re-inventory
- Repository/source: `mayf3/dsh-agent-core`
- Commit/artifact: base `a46e81ce26b443b76e6c3a3a133dc0ea7f16639c`；evidence commit `659bab3`（docs-only，本地）
- Environment: fresh worktree，未复用任何历史 worktree
- Observed at: 2026-08-22
- Method: blob 校验、Phase A foundation 文件清点、D-U1 seam（`packages/agent-router/src/index.js:692/:700`）
  清点、baseline suites（agent-router 107/107、feishu-connector 136/136 PASS）、逐 Contract 的
  pinned-runtime 可满足性验证。
- Result: 除 heading trio 外，parent 其余 Markdown/mention/retry 合同在 pinned runtime 上验证可满足；
  实现停止于开工前，无产品代码变更。
- Provenance: `docs/reports/lark-ux-phase1-v2-implementation-blocker.md`（commit `659bab3`，
  本地未 push；仅作 evidence source，不是 implementation commit 或产品 PR）。

### OBS-LUXHN-002 — optimize-style heading rewrite is deterministic and pre-client

- Subject: SDK `src/outbound/markdown/optimize-style.ts`
- Repository/source: `mayf3/channel-sdk-node` @ `bd24f6742513769c80b5401b96ad464d74dd2027`
- Environment: 源码检视（`git show bd24f67:src/outbound/markdown/optimize-style.ts`）
- Observed at: 2026-08-22
- Method: 直接读取 `markdownToPost` → `optimizeMarkdownStyle` 调用链与 heading 替换分支。
- Result: `if (/^#{1,3} /m.test(text)) { r = r.replace(/^#{2,6} (.+)$/gm, "##### $1");
  r = r.replace(/^# (.+)$/gm, "#### $1") }` — 触发条件是原文含任一 H1–H3（含 code fence 内的
  `#` 行）；该变换作用于发送载荷文本本身。
- Provenance: SDK repo pinned source；runtime dist `index.mjs` 同逻辑行级核对。

### OBS-LUXHN-003 — Empirical send payload collapses six levels to two

- Subject: pinned runtime `channel.send(to, { markdown })` 输出
- Repository/source: `@larksuite/channel` @ `ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f`
  （`packages/feishu-connector` npm ci 安装的真实 dist）
- Environment: 离线（stub `rawClient.im.v1.message.create`），无网络、无真实 Feishu App
- Observed at: 2026-08-22
- Method: 发送含 `# H1 label` … `###### H6 label` 的文档，读取 `msg_type` 与 post 内 `tag: 'md'`
  元素的 `text`。
- Result: `msg_type = 'post'`；text =
  `"#### H1 label\n\n##### H2 label\n\n##### H3 label\n\n##### H4 label\n\n##### H5 label\n\n##### H6 label\n"`；
  H2–H6 共享同一 `##### ` 前缀；六个标题的文字、顺序、存在性完整保留。
- Provenance: blocker round 可复现脚本（记录于 blocker report §2）。

### OBS-LUXHN-004 — No public opt-out exists in the SDK send surface

- Subject: `LarkChannelOptions` / `OutboundConfig`
- Repository/source: SDK pinned dist `index.d.mts`
- Environment: 类型面全量检视
- Observed at: 2026-08-22
- Method: 逐字段读取 `OutboundConfig`（`textChunkLimit`、`markdownConverter`、stream throttle、
  `streamMaxElementChars`、`ssrfGuard`、`allowedFileDirs`、`retry`）与 `LarkChannelOptions` 其余字段。
- Result: 不存在禁用或配置 heading style optimization 的选项；唯一函数式出口是自定义
  `config.markdownConverter`，而 parent `CTR-MARKDOWN-002` 要求 `config.markdownConverter` 保持
  unset 且禁止 custom converter（该出口同时收不到 `SendOptions.mentions`，会破坏 parent
  `CTR-AUTO-MENTION-003` 冻结的 SDK-native mention 原语）。
- Provenance: blocker report §2 "No in-scope escape exists"。

### OBS-LUXHN-005 — Other parent contracts verified satisfiable on the same runtime

- Subject: pinned runtime 上的 parent Contract 可满足性
- Environment: 同 OBS-LUXHN-003 的离线实证 + sender/retry/errors 源级检视
- Observed at: 2026-08-22
- Method: 真实 SDK 管线发送/失败注入（mention 前缀、fence 跨界、链接、表格、长文分块；
  `sendOneWithFallback`/`retry`/`classifyError` 源级核对）。
- Result: `md` post 元素、`<at user_id>` mention 前缀（首块 only、fence 外）、fence 关闭/重开且保留
  language tag、链接 query/fragment/percent-encoding 字节稳定、表格 markdown 字节完整、3500 原生
  分块、in-limit 单条、`target_revoked` 同 chat 一次逻辑 fallback、`format_error` 一次逻辑
  post→text fallback、`permission_denied` fail-loud、transport retry `maxAttempts=3` 仅
  `rate_limited`/`unknown` — 全部满足。
- Provenance: blocker report §3 表格。

### OBS-LUXHN-006 — No later SDK revision changes the behavior

- Subject: `mayf3/channel-sdk-node` 历史
- Environment: `git log --all -- src/outbound/markdown/optimize-style.ts`
- Observed at: 2026-08-22
- Method: SDK repo 全历史检视该文件。
- Result: 该文件自 initial commit 后无改动；`ab028f9..HEAD` 无后续 commit。
- Provenance: blocker round 检视记录。

## 6. Claims and assumptions

### CLM-LUXHN-001 — The heading collapse is deterministic, pre-client, and unfixable in scope

- Support state: SUPPORTED
- Supported by evidence: `EVD-LUXHN-001`
- Contradicted by evidence: none known
- Uncertainty: none for the pinned coordinates; future SDK revisions are outside this amendment.

### CLM-LUXHN-002 — The parent heading trio is the sole blocker

- Support state: SUPPORTED
- Supported by evidence: `EVD-LUXHN-002`
- Contradicted by evidence: none known
- Uncertainty: table/mention/notification 等 real-client gates 仍需 dedicated test-app 执行证据；
  本 amendment 不声称它们已 PASS。

### CLM-LUXHN-003 — Replacing the trio removes the blocker without touching other semantics

- Support state: SUPPORTED
- Supported by evidence: `EVD-LUXHN-003`
- Contradicted by evidence: none known
- Uncertainty: 实现轮的 fresh preflight 仍必须按 parent `CTR-PHASE-A-PRECONDITION-001` 重验 base。

### CLM-LUXHN-004 — Historical six-level distinctness proposition

- Support state: OPEN_ASSUMPTION
- Supported by evidence: none
- Contradicted by evidence: `EVD-LUXHN-001`
- Uncertainty: 该历史命题（parent `CTR-MARKDOWN-HEADING-001` 的六级一一视觉区分）被
  `DEC-LUXHN-001` 裁决取代，不构成 open normative TBD。

## 7. Evidence Relations

### EVD-LUXHN-001 — Source + runtime observations support the determinism Claim

- Source observations: `OBS-LUXHN-002`, `OBS-LUXHN-003`, `OBS-LUXHN-004`, `OBS-LUXHN-006`
- Target: `CLM-LUXHN-001`, `STATE-LUXHN-002`
- Relation: SUPPORTS
- Bound coordinates: SDK source `bd24f67…`、runtime `ab028f9…`、observed 2026-08-22、离线 stub 实证
- Strength/sufficiency: 对 pinned 坐标充分（字节级、确定性、无随机性）
- Limitations: 不外推到未来 SDK revision
- Provenance: blocker report §2（commit `659bab3`）

### EVD-LUXHN-002 — Preflight inventory supports the sole-blocker Claim

- Source observations: `OBS-LUXHN-001`, `OBS-LUXHN-005`
- Target: `CLM-LUXHN-002`
- Relation: SUPPORTS
- Bound coordinates: base `a46e81c…`、parent blob `91513d1…`、observed 2026-08-22
- Strength/sufficiency: 覆盖 parent 全部 frozen Contract 的可满足性验证
- Limitations: real-client 行为（表格渲染、mention 通知等）仍属 dedicated test-app gates
- Provenance: blocker report §1/§3

### EVD-LUXHN-003 — Scope-isolation supports the replacement Claim

- Source observations: `OBS-LUXHN-005`
- Target: `CLM-LUXHN-003`
- Relation: SUPPORTS
- Bound coordinates: 同 `EVD-LUXHN-002`
- Strength/sufficiency: 逐合同可满足性 + parent 合同清单逐项 UNCHANGED 声明（§14）
- Limitations: 实现轮仍需完整 SPEC_COMPLIANCE
- Provenance: 本 amendment §14

### Evidence relation index

| Evidence | Source | Relation | Target |
|---|---|---|---|
| `EVD-LUXHN-001` | `OBS-LUXHN-002/003/004/006` | SUPPORTS | `CLM-LUXHN-001`, `STATE-LUXHN-002` |
| `EVD-LUXHN-002` | `OBS-LUXHN-001/005` | SUPPORTS | `CLM-LUXHN-002` |
| `EVD-LUXHN-003` | `OBS-LUXHN-005` | SUPPORTS | `CLM-LUXHN-003` |
| `EVD-LUXHN-001` | `OBS-LUXHN-002/003` | CONTRADICTS | `CLM-LUXHN-004` |

## 8. Decisions

### DEC-LUXHN-001 — Owner accepts SDK native heading normalization

- Decision owner: `mayf3`
- Decision: `OWNER_RULING = ACCEPT_SDK_NATIVE_HEADING_NORMALIZATION`。
  heading 合同不再要求六个输入级别产生六种不同视觉样式（`H1_H6_DISTINCT_RENDERING = NOT_REQUIRED`）；
  必须保留的是标题文字（`HEADING_TEXT_PRESERVATION = REQUIRED`）、顺序
  （`HEADING_ORDER_PRESERVATION = REQUIRED`）与原生 heading 渲染处理
  （`HEADING_RENDERING_TREATMENT = REQUIRED`，不得全部退化为无格式正文）。
- Rejected alternatives: `ALT-LUXHN-001`, `ALT-LUXHN-002`, `ALT-LUXHN-004`
- Reason: reviewed runtime 的归一化是确定性原生行为，恢复六级区分只能引入第二渲染 authority
  （`CUSTOM_MARKDOWN_CONVERTER = FORBIDDEN`、`CONNECTOR_HEADING_PREPROCESSOR = FORBIDDEN`）或更换
  SDK revision（`NEW_SDK_REVISION = NO`、`DEPENDENCY_CHANGE = NONE`），两者都被 Owner 拒绝。
- Owner decision remaining: NONE

### DEC-LUXHN-002 — Replace exactly the parent heading trio via new stable IDs

- Decision owner: `mayf3`
- Decision: 本 amendment（accepted 并进入 implementation base 后）以下列新 stable ID 取代 parent
  `CTR-MARKDOWN-HEADING-001`、`ACC-MARKDOWN-HEADINGS-H1-H6`、`TEST-LUX-MD-HEADINGS-H1-H6` 的
  normative effect：`CTR-MARKDOWN-HEADING-NATIVE-001`、`ACC-MARKDOWN-HEADING-NATIVE-001`、
  `TEST-LUX-MD-HEADINGS-NATIVE`。parent 文件不改（accepted immutability）；parent 原三 ID 的文本
  保留为历史 authority 记录。
- Rejected alternatives: `ALT-LUXHN-003`
- Reason: accepted stable ID 不得原地收窄/反转（SPEC_FORMAT_V0 §14.1）；窄 child amendment + 新 ID 是
  仓库既有合法机制（V2 ingress-content amendment 先例）。
- Owner decision remaining: NONE

### DEC-LUXHN-003 — Every other parent semantic is frozen unchanged

- Decision owner: `mayf3`
- Decision: parent 除被取代三 ID 外的全部 Contract、Acceptance、gate、Decision、边界与禁令逐项
  UNCHANGED（清单见 §14）；`PRODUCT_SEMANTIC_DELTA = HEADING_LEVEL_DISTINCTNESS_ONLY`，其余
  `SEMANTIC_CHANGE = NONE`。
- Rejected alternatives: `ALT-LUXHN-004`
- Reason: 裁决只解除 heading-level distinctness 这一条 divergence。
- Owner decision remaining: NONE

## 9. Contracts

### CTR-MARKDOWN-HEADING-NATIVE-001 — SDK-native heading normalization is compliant

（取代 parent `CTR-MARKDOWN-HEADING-001` 的 normative effect。）

输入中的六个标题标签（`#` 到 `######`）MUST 满足：

1. 六个标题标签的文本（label 文字）全部保留在 SDK 发送载荷中，不得丢失、截断或改写；
2. 标题相对顺序全部保留，不得重排；
3. SDK 发送载荷对每个标题仍使用 Markdown heading treatment（heading 标记行），MUST NOT 全部
   退化为普通无格式正文；
4. 六个输入级别产生六种不同视觉样式 NOT REQUIRED —— SDK reviewed runtime 的原生 style
   optimization（含 `# → ####`、`##`–`###### → #####` 归一化）是合规渲染；
5. 不得丢字、合并标题或重排标题；
6. MUST NOT 启用 custom markdown converter（`CUSTOM_MARKDOWN_CONVERTER = FORBIDDEN`，
   parent `CTR-MARKDOWN-002` 继续有效）；
7. MUST NOT 在 connector 侧引入 heading preprocessor 或任何第二渲染 authority
   （`CONNECTOR_HEADING_PREPROCESSOR = FORBIDDEN`）；
8. MUST NOT 修改 SDK pin / dependency coordinate（`NEW_SDK_REVISION = NO`，
   `DEPENDENCY_CHANGE = NONE`）。

本 Contract 只适用于 parent `CTR-MARKDOWN-001` 已适用的 Agent 成功回复 Markdown 路径；excluded
receipt/proactive 路径不受影响（parent `CTR-RECEIPT-001` 继续有效）。

被取代的旧失败条件 `any heading level flattened` 不再构成失败；新的失败条件见
`ACC-MARKDOWN-HEADING-NATIVE-001`。

### CTR-LUXHN-BOUNDARY-001 — Amendment boundary stays narrow

本 amendment 的 normative effect MUST 限于 `CTR-MARKDOWN-HEADING-001`、
`ACC-MARKDOWN-HEADINGS-H1-H6`、`TEST-LUX-MD-HEADINGS-H1-H6` 三项的取代与本文新 ID 的定义。它
MUST NOT 被解读为修改 parent 任何其他 Contract、Acceptance、gate、Decision、Scope、SDK 坐标、
Phase A/B 边界或 implementation 前置条件，MUST NOT 授予任何实现权限
（`IMPLEMENTATION_PERMISSION = NO`）。

## 10. Acceptance

### ACC-MARKDOWN-HEADING-NATIVE-001 — Native heading fidelity gate

（取代 parent `ACC-MARKDOWN-HEADINGS-H1-H6` 的 normative effect。）

- Contracts: `CTR-MARKDOWN-HEADING-NATIVE-001`, parent `CTR-MARKDOWN-002`,
  parent `CTR-TEST-APP-001`, `CTR-LUXHN-BOUNDARY-001`
- Method: 发送一份包含 H1–H6 唯一标签文本的文档（每个级别带可核对的唯一 label），在 dedicated
  test-app 真实客户端检视渲染结果，并核对 SDK 发送载荷。
- Environment: dedicated non-production test app（沿用 parent §13 的 dedicated test-app 门槛；
  禁止 production App 与 standalone pilot App）。
- Required evidence: 精确输入、message ID、发送载荷（post md 元素 text）、客户端 capture。
- Expected result:
  - 六个标签文本全部出现（text preservation）；
  - 顺序与输入一致（order preservation）；
  - 每个标题以可识别的原生标题样式渲染（heading treatment；SDK 归一化后的 `####`/`#####`
    属于合规样式）；
  - 无标题内容丢失；不以"六级各自 distinct"作为通过条件。
- Failure condition（取代旧 `any heading level flattened`）:
  - `heading text missing`（任一标题 label 文本缺失/被改写）；
  - `heading order changed`（标题相对顺序变化）；
  - `all heading treatment lost`（全部退化为无格式正文）;
  - `second renderer introduced`（启用 custom converter / connector heading preprocessor /
    更改 SDK pin 来恢复视觉区分）。

### Contract coverage

| Contract | Acceptance coverage | Covered |
|---|---|---|
| `CTR-MARKDOWN-HEADING-NATIVE-001` | `ACC-MARKDOWN-HEADING-NATIVE-001`, `TEST-LUX-MD-HEADINGS-NATIVE` | YES |
| `CTR-LUXHN-BOUNDARY-001` | 本 amendment §14 逐项 UNCHANGED 清单 + review protocol §16 | YES |

（parent 其余 Contract 的 coverage 维持 parent §11 原表不变。）

## 11. Alternatives and disposition

### ALT-LUXHN-001 — Fix the SDK and re-pin

- Disposition: rejected by Owner（本轮）
- Reason: 唯一能保住六级视觉区分的路径，但要求修改 SDK 与 dependency coordinate
  （`NEW_SDK_REVISION = NO`、`DEPENDENCY_CHANGE = NONE`）。
- Evidence/Claims considered: `CLM-LUXHN-001`
- What would reopen: 新的 SDK authority round（独立 Spec 授权 SDK 变更与新 pin）。

### ALT-LUXHN-002 — Custom markdownConverter or connector heading preprocessor

- Disposition: rejected（维持 parent `ALT-LUX-001` / `CTR-MARKDOWN-002` 拒绝）
- Reason: 第二渲染 authority；且 converter 出口收不到 `SendOptions.mentions`，会破坏
  SDK-native mention 原语（parent `CTR-AUTO-MENTION-003`）。
- Evidence/Claims considered: `CLM-LUXHN-001`, `OBS-LUXHN-004`
- What would reopen: 新的独立 governed authority；本轮 none。

### ALT-LUXHN-003 — Edit the accepted parent in place

- Disposition: rejected
- Reason: 违反 accepted immutability（SPEC_FORMAT_V0 §14.1：accepted stable ID 不得原地收窄或反转）。
- Evidence/Claims considered: `CLM-LUXHN-003`
- What would reopen: never（governance invariant）。

### ALT-LUXHN-004 — Do nothing (leave implementation blocked)

- Disposition: rejected by Owner
- Reason: parent 其余全部合同已在 pinned runtime 验证可满足，仅 heading trio 阻断整个第一轮 UX；
  不裁决将使 accepted parent 长期不可实现。
- Evidence/Claims considered: `CLM-LUXHN-002`
- What would reopen: none。

## 12. Migration, compatibility, and rollback

| Parent item（被取代，文本保留） | Replacement（本 amendment 新 ID） |
|---|---|
| `CTR-MARKDOWN-HEADING-001` | `CTR-MARKDOWN-HEADING-NATIVE-001` |
| `ACC-MARKDOWN-HEADINGS-H1-H6` | `ACC-MARKDOWN-HEADING-NATIVE-001` |
| `TEST-LUX-MD-HEADINGS-H1-H6` | `TEST-LUX-MD-HEADINGS-NATIVE` |

```text
PARTIAL_SUPERSESSION = CONTRACT_FRAGMENT_TRIO_ONLY（whole-Spec supersedes 保持空）
PRODUCT_SEMANTIC_DELTA = HEADING_LEVEL_DISTINCTNESS_ONLY
OTHER_SEMANTIC_CHANGE = NONE
COMPATIBILITY = 依据 parent 旧 trio 曾判定 FAIL 的实现不得再因此 FAIL；
                依据旧 trio 曾判定 PASS 的 heading 断言需按新 ID 复核
ROLLBACK = OWNER 新裁决 + superseding authority（本 amendment 自身可被 supersede）
MIGRATION = NONE（无代码、无状态、无依赖变更）
```

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
```

`CLM-LUXHN-004` 是被 `DEC-LUXHN-001` 取代的历史命题，不是 open normative choice。真实 Feishu
heading gate（`TEST-LUX-MD-HEADINGS-NATIVE`）尚未执行：本 amendment 不声称任何 dedicated
test-app gate 已经 PASS。

## 14. Unchanged inventory（parent 其余合同逐项冻结）

以下 parent 语义在本 amendment 生效后逐项 `UNCHANGED`：

```text
UNCHANGED =
  Markdown success-reply activation                (CTR-MARKDOWN-001)
  Markdown surface 除 H1–H6 distinctness 外全部     (CTR-MARKDOWN-001/002/003)
  nested ordered/unordered list                    (CTR-MARKDOWN-NESTED-LIST-001)
  language-tagged fenced code                      (CTR-MARKDOWN-CODE-LANGUAGE-001)
  link URL byte stability                          (CTR-MARKDOWN-LINK-001)
  table mandatory real-client gate                 (ACC-MARKDOWN-TABLE)
  >3500 long-content gate                          (CTR-MARKDOWN-003, CTR-MARKDOWN-LONG-TABLE-001)
  mention outside code fence                       (CTR-AUTO-MENTION-CODE-FENCE-001)
  group/topic auto-mention                         (CTR-AUTO-MENTION-001)
  native clickable mention                         (CTR-AUTO-MENTION-NOTIFICATION-001)
  native notification                              (CTR-AUTO-MENTION-NOTIFICATION-001)
  topic continuity                                 (CTR-TOPIC-CONTINUITY-001)
  D-U1 minimal Router seam                         (CTR-ROUTER-INTENT-001/002/003)
  openId identity authority                        (CTR-AUTO-MENTION-003, DEC-LUX-003)
  target-revoked same-chat fallback                (CTR-TARGET-REVOKED-001/002)
  bounded transport retry                          (CTR-TRANSPORT-RETRY-001/002)
  permission fail-loud                             (CTR-PERMISSION-ERROR-001)
  format fallback                                  (CTR-FORMAT-FALLBACK-001)
  p2p/failure/unbound/proactive no mention         (CTR-AUTO-MENTION-002, CTR-RECEIPT-001)
  no rawClient                                     (CTR-MARKDOWN-002)
  no second transport                              (CTR-MARKDOWN-002)
  no dependency change                             (parent §12 dependency freeze)

PRODUCT_SEMANTIC_DELTA = HEADING_LEVEL_DISTINCTNESS_ONLY
ALL_OTHER_SEMANTIC_CHANGE = NONE
```

## 15. Test-App gate replacement

| Case | Acceptance | Required live result |
|---|---|---|
| `TEST-LUX-MD-HEADINGS-NATIVE` | `ACC-MARKDOWN-HEADING-NATIVE-001` | 一份含 H1–H6 唯一 label 的文档：六个 label 全部出现、顺序一致、每个标题有可识别原生标题样式（SDK 归一化样式合规）、无内容丢失；不以六级 distinct 为通过条件 |

（取代 parent §13 表中 `TEST-LUX-MD-HEADINGS-H1-H6` 行与 semantic closure matrix 对应行的通过
语义；parent 文件本身不改。该 gate 与 parent 其余全部 §13 gates 一样，是 future implementation
轮的 mandatory test-app 定义，本轮未执行。）

## 16. Review and activation protocol

独立 reviewer 必须读取 parent accepted Spec、本 amendment、SDK pinned source/runtime 坐标与
blocker evidence（commit `659bab3`，仅 evidence source，不是 implementation commit 或产品 PR），并
验证：

- 本轮 authority artifact 确为单一新增 docs 文件；parent accepted Spec 字节未改；
- 裁决参数与 §0 冻结值一致；取代范围严格限于三 ID；§14 清单覆盖 parent 全部其余合同；
- 未授予实现权限；未修改 SDK / dependency coordinate / Phase A；
- 未声称任何真实 Feishu heading gate 或其他 test-app gate 已经 PASS。

review 输出：

```text
REVIEW_VERDICT = PASS | FIX_REQUIRED
BLOCKERS = NONE | detail
SEMANTIC_REVIEW_COMPLETE = YES | NO
READY_TO_ACCEPT_OWNER_RULING_AMENDMENT = YES | NO
```

只有 `PASS + BLOCKERS=NONE + SEMANTIC_REVIEW_COMPLETE=YES` 后，才允许独立的 acceptance-finalize
轮将本 artifact `status: proposed -> accepted` 并记录 provenance；只有 accepted artifact 进入
implementation base 后，parent 的实现轮才可依据本 amendment 的新 heading trio 执行。本轮
（authoring round）不做 acceptance-finalize。

## 17. Final Output / Lifecycle

```text
SPEC_ID = AGENT_CORE_LARK_UX_PHASE1_V2_HEADING_NORMALIZATION_AMENDMENT
SPEC_FORMAT = SPEC_FORMAT_V0（amendment 先例结构）
SPEC_STATUS = proposed
PARENT_SPEC = AGENT_CORE_LARK_UX_PHASE1_V2 (accepted, 未修改)
SUPERSEDES_PARENT = NO
OWNER_RULING = ACCEPT_SDK_NATIVE_HEADING_NORMALIZATION
H1_H6_DISTINCT_RENDERING = NOT_REQUIRED
HEADING_TEXT_PRESERVATION = REQUIRED
HEADING_ORDER_PRESERVATION = REQUIRED
HEADING_RENDERING_TREATMENT = REQUIRED
CUSTOM_MARKDOWN_CONVERTER = FORBIDDEN
CONNECTOR_HEADING_PREPROCESSOR = FORBIDDEN
NEW_SDK_REVISION = NO
DEPENDENCY_CHANGE = NONE
OTHER_UX_CONTRACT_CHANGE = NONE
PRODUCT_SEMANTIC_DELTA = HEADING_LEVEL_DISTINCTNESS_ONLY
IMPLEMENTATION_PERMISSION = NO
REAL_TEST_APP_GATE_CLAIMED_PASS = NONE
PRODUCT_CODE_CHANGE = NONE
SDK_CHANGE = NONE
PHASE_A_CHANGE = NONE
DEPLOYMENT = NONE
MERGE = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
```

---

## 18. Related

- `docs/specs/AGENT_CORE_LARK_UX_PHASE1_V2.md`（parent，accepted，未修改）
- `docs/specs/AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2.md` 及其 ingress-content child
  amendment（机制先例）
- blocker evidence：`docs/reports/lark-ux-phase1-v2-implementation-blocker.md`
  （本地 commit `659bab3`，docs-only evidence source）
