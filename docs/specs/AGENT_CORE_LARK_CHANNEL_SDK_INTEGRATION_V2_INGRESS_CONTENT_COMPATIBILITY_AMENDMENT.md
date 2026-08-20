---
spec_id: AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2_INGRESS_CONTENT_COMPATIBILITY_AMENDMENT
status: proposed
type: owner-ruling child amendment (spec-only; docs-only)
amends: AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2
parent_status: accepted
date: 2026-08-20
scope: Contract C ingress text compatibility and post file-link attachment preservation only
review_base: f8ec58dad8f51ff1107326723981bb174254f74d
reviewed_implementation_head: cce18f3aa8c0836d3255c0514de86bda4dbd961b
implementation_pr: 23
references:
  - docs/specs/AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2.md
  - docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md
---

# Lark Channel SDK Integration V2 — Ingress Content Compatibility Owner Ruling

> 性质：**Owner-ruling child amendment / SPEC ONLY** · 日期：2026-08-20
> 仓库：`mayf3/dsh-agent-core`
> Parent authority：`AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2`（accepted）
> Implementation review：PR #23，`REQUEST_CHANGES`
> 本轮只记录 Owner ruling；不修改 parent accepted Spec，不修改 PR #23，不 implementation、部署或 merge。

---

## 0. Machine-readable Ruling

```text
OWNER_RULING_ID = AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2_INGRESS_CONTENT_COMPATIBILITY_OWNER_RULING
AMENDMENT_RELATION = CLARIFIES_AND_CORRECTS_CONTRACT_C_ONLY
PARENT_SPEC = AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2
PARENT_SPEC_STATUS = accepted
SUPERSEDES_PARENT_SPEC = NO
PARENT_SPEC_FILE_MODIFIED = NO

REVIEW_BASE = f8ec58dad8f51ff1107326723981bb174254f74d
REVIEWED_HEAD = cce18f3aa8c0836d3255c0514de86bda4dbd961b
IMPLEMENTATION_PR = #23
IMPLEMENTATION_REVIEW_VERDICT = REQUEST_CHANGES
IMPLEMENTATION_REVIEW_BLOCKER_COUNT = 1

INGRESS_CONTENT_COMPATIBILITY = SEMANTIC_NOT_BYTE_IDENTICAL
INGRESS_TEXT_BYTE_PARITY = NOT_REQUIRED
NORMALIZATION_AUTHORITY = @larksuite/channel
BOT_ADDRESSING_TOKEN_IN_AGENT_TEXT = STRIPPED
POST_AGENT_TEXT_AUTHORITY = SDK_NORMALIZED_MARKDOWN

TRUE_INFORMATION_LOSS_FIX_REQUIRED = YES
POST_FILE_LINK_ATTACHMENT_MUST_NOT_DISAPPEAR = YES
ATTACHMENT_INFORMATION_PARITY = FULL

AMENDMENT_STATUS = proposed
OWNER_RULING_RECORDED = YES
IMPLEMENTATION_PERMISSION = NO
AUTHORITY_EFFECTIVE_WHEN = INDEPENDENT_REVIEW_PASS_AND_ACCEPTED_AMENDMENT_MERGED_TO_IMPLEMENTATION_BASE
READY_FOR_INDEPENDENT_REVIEW = YES
```

本 amendment 不改变 V2 的 foundation-cutover 方向、SDK authority、Phase A 边界或 Phase B 禁令；它只把
Contract C 的正文兼容性从逐字节相等纠正为语义兼容，并明确附件信息仍必须完整保留。依据
`AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1` §5，这属于同一 accepted scope 内的澄清/纠正，采用独立窄
AMEND；不是需要重述整个 current truth 的架构方向变化，因此不 supersede 或重写约 800 行 parent V2。

---

## 1. Problem and Review Evidence

PR #23 的独立 Implementation Review 固定在：

```text
REVIEW_BASE = f8ec58dad8f51ff1107326723981bb174254f74d
REVIEWED_HEAD = cce18f3aa8c0836d3255c0514de86bda4dbd961b
VERDICT = REQUEST_CHANGES
```

唯一 blocker 包含两个必须分开的判断：

1. parent V2 Contract C 把 `FULL IngressEvent parity` 延伸为正文逐字节相等，要求过严。SDK 已是唯一
   normalization authority；transport mention token、Markdown、fenced code、whitespace 与 human mention 的
   SDK-normalized 表达可以在保留用户语义的同时与 V0 文本字节不同。
2. `post` 中 `<a href="file/...">` 表达的文件附件在 reviewed implementation 中消失。这不是允许的正文
   delta，而是真实 information loss，必须修复。

因此：正文实行 semantic compatibility；identity、metadata 与 attachment information 继续实行 FULL
preservation。不得用前者放松后者。

---

## 2. Contract C Narrow Replacement

本节在本 amendment accepted 且进入 implementation base 后，只替换 parent V2 Contract C 中与
`IngressEvent.text` 逐字节 parity 冲突的要求。parent V2 其余 Contract、AC、scope、review history、
SDK revision、Phase A/Phase B 边界全部保留。

### 2.1 Text compatibility

```text
INGRESS_EVENT_IDENTITY_AND_METADATA_PARITY = FULL
INGRESS_ATTACHMENT_INFORMATION_PARITY = FULL
INGRESS_TEXT_COMPATIBILITY = SEMANTIC_NOT_BYTE_IDENTICAL
INGRESS_TEXT_BYTE_PARITY = NOT_REQUIRED
NORMALIZATION_AUTHORITY = @larksuite/channel
SECOND_TEXT_NORMALIZER = FORBIDDEN
RAW_TEXT_REPARSE_FOR_V0_BODY = FORBIDDEN
ELIGIBILITY_FROM_REPARSED_RAW_CONTENT = FORBIDDEN
```

允许且只允许以下正文差异：

- bot mention transport placeholder 被移除；
- Markdown styling 保留；
- fenced code block 保留；
- SDK whitespace normalization；
- normalized human mention text 保留。

冻结的 Agent-facing text 结果：

```text
BOT_ADDRESSING_TOKEN_IN_AGENT_TEXT = STRIPPED
POST_AGENT_TEXT_AUTHORITY = SDK_NORMALIZED_MARKDOWN
HUMAN_SEMANTIC_CONTENT_PRESERVED = YES
```

`@bot` 是 transport addressing signal，不是必须暴露给 Agent 的用户正文。去除该 placeholder 是显式
accepted delta，不得再由 differential test 当作 blocker。相反，Markdown styling、fenced code 与规范化
human mention 文本属于 SDK-normalized Agent text，bridge 不得为了模仿 V0 flat text 而二次剥离或改写。

### 2.2 Fields that remain FULL

以下内容不得因 semantic-text ruling 降级：

```text
CONVERSATION_AND_BINDING_IDENTITY = FULL
SENDER_IDENTITY = FULL
MENTION_METADATA = FULL
ROOT_THREAD_PARENT_MESSAGE_IDENTITY = FULL
TIMESTAMP_AND_DEDUP_IDENTITY = FULL
ATTACHMENT_INFORMATION = FULL
```

具体包括但不限于：

- `channel` / `chatType` / `conversationId` / `chatId` 与既有 Binding key continuity；
- sender `openId` / `unionId` / `userId` / `senderType` 及既有 sender flags；
- mentions 的 key、identity triple、name、type 与 addressed/mentioned metadata；
- `rootMsgId` / `threadId` / `parentMsgId` / `messageId` / message type/subtype；
- timestamp units/fallback、event/dedup identity；
- 每个 attachment 的 type、`fileKey`、name、`sizeBytes`、duration、cover image 与 `downloadHint` 中
  对该 attachment 适用的信息。

---

## 3. Post File-link Information-loss Fix

`post` 中 `<a href="file/...">` 表达的文件资源必须进入 `IngressEvent.attachments[]`；不得因 SDK 的公开
normalized resource surface 未携带该 link resource 而消失。

允许在 `SDK_INCLUDE_RAW_EVENT = true` 下，对 SDK 已选定的 `post` message type 做最小机械 metadata
投影：

```text
POST_FILE_LINK_RAW_PROJECTION = ALLOWED_METADATA_ONLY
ALLOWED_PROJECTED_FIELDS = fileKey, name, sizeBytes, downloadHint
RAW_PROJECTION_MAY_SELECT_TEXT_NORMALIZER = NO
RAW_PROJECTION_MAY_DECIDE_MENTION_ELIGIBILITY = NO
RAW_PROJECTION_MAY_REBUILD_POST_TEXT = NO
RAW_PROJECTION_MAY_CREATE_SECOND_MSG_TYPE_DISPATCH_AUTHORITY = NO
```

机械投影的唯一目标是补齐已经存在于 raw event、但 SDK public attachment descriptor 未暴露的文件附件
信息。实现不得借此重新 parse raw text、重新决定正文、mention eligibility、conversation identity 或
supported message dispatch。

```text
ATTACHMENT_INFORMATION_LOSS = FORBIDDEN
POST_FILE_LINK_ATTACHMENT_LOSS = IMPLEMENTATION_BLOCKER
```

---

## 4. Mandatory PR #23 Revision Acceptance

PR #23 的后续 implementation revision 必须新增并通过以下证据；在本 amendment 独立 review、acceptance
及合入 PR #23 implementation base 前不得开始该 revision：

1. `POST_FILE_LINK_ATTACHMENT_DIFFERENTIAL`：覆盖 `post` 中 `a href="file/..."`，逐字段断言
   `fileKey`、name、`sizeBytes`、`downloadHint` 不丢失；
2. `BOT_PLACEHOLDER_STRIPPING_EXPLICIT_ACCEPTED_DELTA`：`@bot` transport placeholder 从 Agent text
   移除，并明确不再要求 text byte parity；mention metadata 与 eligibility 仍正确；
3. `COMPLEX_POST_SEMANTIC_CONTENT_MATRIX`：至少覆盖 Markdown styling、fenced code、SDK whitespace
   normalization、normalized human mentions，断言 SDK-normalized semantic content 被保留；
4. `NO_ATTACHMENT_INFORMATION_LOSS`：所有 V0-supported attachment information 与 post file-link
   attachment 均完整；
5. `NO_RAW_TEXT_RENORMALIZATION`：production source inspection/test 证明 raw projection 仅补 attachment
   metadata，不重建正文、不形成第二 text normalizer、不从 raw content 决定 eligibility。

```text
POST_FILE_LINK_ATTACHMENT_DIFFERENTIAL_REQUIRED = YES
BOT_PLACEHOLDER_ACCEPTED_DELTA_TEST_REQUIRED = YES
COMPLEX_POST_SEMANTIC_CONTENT_MATRIX_REQUIRED = YES
NO_ATTACHMENT_INFORMATION_LOSS_TEST_REQUIRED = YES
NO_RAW_TEXT_RENORMALIZATION_TEST_REQUIRED = YES

PR23_REVISION_IN_THIS_ROUND = NO
PR23_CHANGE = NONE
READY_FOR_PR23_REVISION = NO
```

---

## 5. Frozen Non-goals

本 ruling 不授权或启用：

```text
MARKDOWN_OUTBOUND = NO
AUTO_MENTION_OUTBOUND = NO
TYPING_UI = NO
CARD_UI = NO
MEDIA_DELIVERY = NO
QUESTION_PLAN_APPROVAL_UI = NO
PHASE_B_UX = NO
RAW_CLIENT = NO
SECOND_WEBSOCKET = NO
```

默认 outbound 仍为既有 text seam。不得把“POST Agent text 采用 SDK normalized Markdown”误读为
Markdown outbound、post outbound、card、streaming 或 media delivery 权限。

---

## 6. Review and Activation Protocol

独立 reviewer 必须读取 parent accepted V2、本 amendment、PR #23 精确 review base/head，并验证：

- authority artifact 确为单一新增 docs file；parent accepted V2 字节未改；
- ruling 只纠正 Contract C text compatibility 与 post file-link information loss；
- FULL identity/metadata/attachment preservation 未被弱化；
- raw lookup 权限严格限制为 attachment metadata mechanical projection；
- Phase B 与 outbound exclusions 全部保留；
- PR #23 Head/description/branch 未修改。

review 输出：

```text
REVIEW_VERDICT = PASS | FIX_REQUIRED
BLOCKERS = NONE | detail
SEMANTIC_REVIEW_COMPLETE = YES | NO
READY_TO_ACCEPT_OWNER_RULING_AMENDMENT = YES | NO
```

只有 `PASS + BLOCKERS=NONE + SEMANTIC_REVIEW_COMPLETE=YES` 后，才允许独立 acceptance-finalize 将
本 artifact `status: proposed -> accepted` 并记录 review provenance。只有该 accepted artifact 合入 PR #23
的 implementation base 后，PR #23 才可按 §4 做限定 revision。

本轮状态：

```text
OWNER_RULING_RECORDED = YES
TEXT_BYTE_PARITY_REMOVED = YES
TRUE_INFORMATION_LOSS_FIX_REQUIRED = YES
PRODUCT_CODE_CHANGE = NONE
DEPENDENCY_CHANGE = NONE
IMPLEMENTATION_PERMISSION = NO
PR23_CHANGE = NONE
DEPLOYMENT = NONE
MERGE = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
```

---

## 7. Related

- `docs/specs/AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2.md`
- `docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md`
- PR #23 historical reviewed implementation Head `cce18f3aa8c0836d3255c0514de86bda4dbd961b`
