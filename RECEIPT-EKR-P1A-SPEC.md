# RECEIPT — EKR P1-A HUMAN_GATE Spec AUTHOR

日期：2026-11-06（Asia/Shanghai）。交付性质：**spec proposal, proposed — not acceptance**。
本回执冻结 authoring、核验和提交前审阅证据；最终 commit/push/PR 坐标由 Git/PR 元数据
及最终交接给出，不在自身 commit 内伪造自引用 SHA 或预报发布成功。

## 坐标、授权和实际产物

```text
REPOSITORY = mayf3/dsh-agent-core
WORKTREE = /private/tmp/dsh-ekr-p1a-spec
BRANCH = ac-ekr-p1a-spec
BASE_HEAD = f6a1f77a8b7b878bcb9821a68836925755ca7076
ORIGINAL_HEAD = f6a1f77a8b7b878bcb9821a68836925755ca7076
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = NEW
ROUTE_STAGE = AUTHORITY_AUTHORING
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
DOCS_FIRST_REQUIRED = YES
AUTHORITY_ACCEPTED_IN_BASE = NO (new HUMAN_GATE protocol only)
SPEC_STATUS = proposed
SPEC_KIND = implementation
IMPLEMENTATION_AUTHORITY = contracts (proposal only; no active implementation permission)
PRODUCTION_APPLY_AUTHORITY = none
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO (no authorized acceptance)
OPERATION_ALLOWED = NO
PRODUCT_SOURCE_OR_TEST_DELTA = NONE
PRODUCTION_WRITES = 0
WINDOW_TOOLS_USED = NO
ACCEPTED_AUTHORITY_DELTA = NONE
```

授权来自本轮用户合同式交办，目标/范围/禁区/Done When 与本地
`BRIEF-EKR-P1A-SPEC.md` 一致（原文件未修改、未纳入本轮提交，原 SHA-256
`dd0d64272f2cec20aa40900b5a286e840719e5151407a0797ba55ff0af2c6cf6`）。
允许起草 proposed Spec、回执、docs-only commit/push 和可用时 PR；不含产品、生产或 acceptance。

新增 Spec 为 `docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md`，
SHA-256 `ffedd945f3fc7c2d332c675821b5b49e8e0eef6a2f8c9173a5ca86a413b5d2e7`。
8 条拟议合同分别有 8 条 Acceptance；验收定义均为 NOT_RUN，未运行产品测试。
协议补齐通知→答复验真/Domain/case→有权 Owner 显式合法 resolve→原 WEC008 单次消费链，
没有给真人回复赋予权限，没有新增 Core 持久 case/phase/permit 引擎。

## 本地优先权威与第 3 派停止记录

已读 AGENTS 交办入口、`.agents/README.md`、`.agents/local/README.md`、Product
Architecture、Current Decision index 与 D-008 相关边界、直接 governing Specs，及
`.agents/skills/spec-governance/SKILL.md` 和唯一选定 AUTHOR mode。格式参照
`.agents/protocol/SPEC_FORMAT_V0.md` 与现有 accepted Spec；未改动治理/权威文件。

| 输入（base 中本地文件） | 实测 SHA-256 |
|---|---|
| `docs/specs/AGENT_CORE_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V2.md` | `f8e8b0d48f8e2a682897c98f5003a1ffbd608ed722fb653a01bde81417767e7b` |
| `docs/specs/AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3.md` | `c5d39e390026807b9e471a6875f5e0e9d15432f21a3d177733bf422fc751a1e6` |
| `docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3.md` | `03469e9f53ccf53f23de3a552270a4bb82f1922b6979108fe01083488c3335d4` |

第 3 派输入只读位置：`/private/tmp/dsh-ekr-p1-new/STOPPED-EKR-P1IMPL.md`；SHA-256
`7dcaf3792a8561caf2779d4e336cc48a935144e5646931f94113e430624a1466`。
其 `spec_gap_detail` 反例与 minimum_closure 已在 Spec §10 重述；没有修改该 worktree，
没有重做其已通过的 P1-B/合法 resolve-resume 修复，也不承接其 writer。

## gh 交叉核验（部分可用，不能将正文等同 Owner 评论）

只读核验由独立子任务 `/root/gh_crosscheck` 完成，观察截至
`2026-11-05T20:17:49Z`（本地 `2026-11-06T04:17:49+08:00`），每请求有 35 秒期限。
无远端发消息、fetch/rebase、身份切换、生产或窗口操作。

| 来源 | 结果及 provenance | 已核验内容 / 限制 |
|---|---|---|
| [agent-control #1374](https://github.com/mayf3/agent-control/issues/1374) | GraphQL rc=0；author `mayf3`；created `2026-11-04T15:41:55Z`，updated `2026-11-04T23:32:39Z` | 正文和 1 条评论已核验；§4 区分 wake ACK/failed 与义务满足并要求 HUMAN_REQUIRED 通知/答复/验证/重唤醒；§6 要求消费者、持久触发、权限、失败责任和重启重发现 |
| [#1374 Owner comment](https://github.com/mayf3/agent-control/issues/1374#issuecomment-6645155614) | author `mayf3`，`2026-11-04T23:32:39Z`；GraphQL ID `IC_kwDOUxeJgs8AAAABjBUHHg` | 重申关联 #1379/#1352 的通知答复闭环；禁止第二套票据库、scheduler、effect ledger 和权限模型；保留 source/install/enable/business 分层 |
| [agent-control #1352](https://github.com/mayf3/agent-control/issues/1352) 正文 | REST rc=0；author `mayf3` / OWNER；created `2026-11-02T11:52:08Z`，updated `2026-11-04T04:42:18Z`；报告 3 条评论 | 正文的 B-gap、真人渠道通知/上下文/可 resolve 继续的答复路径已核验；正文未证明指定 Domain Owner、24h、B 项 AUTHOR 的评论裁定 |
| #1352 Owner 评论 | GraphQL 与 REST comments 均 rc=1：TLS handshake timeout | **引文待 gh 恢复核验**；没有取得评论 ID/原话，不虚构引语；HUMAN_GATE/指定域 Owner/24h 三项意向仅按本轮用户交办记录，不请求重决 |
| [agent-control #1378](https://github.com/mayf3/agent-control/issues/1378) 正文 | GraphQL rc=1 EOF；REST rc=0；author `mayf3` / OWNER；created/updated `2026-11-04T15:45:38Z`；0 评论 | 实施仓库为 svc-workflow、保留 writer/生产权限边界，未完成责任需有授权后继/可靠交接；撤权/Owner replacement 不自动复活；历史 Rust/DB 抽象未冒称实际 PostgreSQL 故障注入或生产事故 |
| dsh-agent-core main | REST rc=0；SHA `4b865cce8ee8880ec1503c856a1eddcd0d40cdaa`，commit time `2026-11-05T19:58:11Z` | 与固定 base 不同，影响核验如下；不是本地 HEAD，未切换 base |

实际命令形态：`gh issue view <1352|1374|1378> --repo mayf3/agent-control --json
number,title,url,author,createdAt,updatedAt,state,body,comments`；失败时只读 REST 对应
`gh api repos/mayf3/agent-control/issues/<number>` 和 #1352 的
`gh api 'repos/mayf3/agent-control/issues/1352/comments?per_page=100'`。
原失败为 `Post "https://api.github.com/graphql": net/http: TLS handshake timeout`、
`Post "https://api.github.com/graphql": EOF` 和 comments REST 的 TLS handshake timeout。
本回执使用核验后的摘要，不伪造 Owner 直接引文。

Base movement 交叉核验：[GitHub compare](https://github.com/mayf3/dsh-agent-core/compare/f6a1f77a8b7b878bcb9821a68836925755ca7076...4b865cce8ee8880ec1503c856a1eddcd0d40cdaa)
REST rc=0，`ahead_by=3/behind_by=0/total_commits=3`。变化仅为 P1-B
BRIEF/RECEIPT/evidence 和 `owner-obligation-attempt.test.js`；未涉及直接 governing
Specs、Decisions、Architecture、本地治理或 HUMAN protocol。没有以不相关 base 移动
重开权威/已通过修复；本 proposal 保持原隔离 base。

## 独立审阅与文档检查

独立语义 reviewer `/root/contract_review`，author `/root`；初始 FULL semantic review
绑定上述 base 和 Spec exact SHA-256（未提交 bytes），结果 **PASS**：
`FROZEN_BLOCKER_UNION=NONE`，`BLOCKERS=0`，无新增 SPEC_GAP/FOLLOW_UP。
确认 proposed NEW、无 accepted 含义变更、Svc/Core ownership、HUMAN 身份≠resolve 权限、
WEC008 exact DTO/两种 ingress/settled/sequence/锁内单次消费、managed STOP/UNKNOWN/预算
保留，且第 3 派反例在拟议验证链中闭合。8/8 Contract→Acceptance 一一覆盖。
已披露 Svc 依赖只阻止依赖实现，不阻止提交 proposed 草案；审阅不是 acceptance。

文档检查实际 rc 均为 0：frontmatter JSON Schema、`validate_transition([], [proposal])`
（仅本新增 proposed 生命周期）、8/8 Acceptance 与审阅哈希重绑；vendored governance
完整性；原 BRIEF 哈希；源码/测试/治理/Decisions 零 diff；`git diff --cached --check`。

Diff stat（base → 暂存两个交付文件；不含原未跟踪 BRIEF）：`2 files changed, 478 insertions(+)`；回执 `122 + / 0 -`，Spec `356 + / 0 -`。

## UNKNOWN 与交付边界

- #1352 指定 Owner 评论原文未核验；可读 issue 正文不填补该证据。
- Svc 实际收件/API/身份映射/授权答复关系、HUMAN_REQUIRED 合法 resolve 细节、accepted
  协议修订、receipt/read projection、持久 obligation/到期后继与重发现接线均未现场验证。
- 真实 DB 唯一性、并发、崩溃原子 join、重启、实际真人送达/答复/resolve/原任务重唤醒与
  业务满足均 UNKNOWN / NOT_RUN。Spec 验收定义与文档审阅不是这些结果。
- 本轮不接受 Spec，不实施产品、不安装/启用、不合并、不做生产写入、不动窗口工具。
- gh 部分可用不预判 git push/PR 成败。提交后执行已授权交付；若 gh 不可用，依交办
  完成提交即停并交监管补推/建 PR，不将网络不可用算作 Spec authoring 失败。

Done When：提交 proposed Spec 和本回执，docs-only commit；网络允许时 push 到
`origin/ac-ekr-p1a-spec` 并建 PR 引 #1374/#1352，显式标注
`spec proposal, proposed — not acceptance`。其后停止，不越过 acceptance/实施边界。
