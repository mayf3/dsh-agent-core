# RECEIPT — #627 HUMAN_GATE Spec 修订（Owner 裁定④）

日期：2026-11-06（Asia/Shanghai）。**spec proposal, proposed — not acceptance**。
本回执记录本次修订；`RECEIPT-EKR-P1A-SPEC.md` 保留原提交时的历史观察，
其中 #1352 待核验及旧 Spec 哈希不再代表本轮状态。最终提交、push 和 PR readback
以 Git/PR 元数据为准，不在自身提交中预报成功或制造自引用 SHA。

## 坐标、授权与路由

```text
REPOSITORY = mayf3/dsh-agent-core
WORKTREE = /private/tmp/dsh-ekr-p1a-spec
BRANCH = ac-ekr-p1a-spec
REVISION_BASE_HEAD = 858736033e683f4116f9b971ea437b04b50ed424
ORIGINAL_PROPOSAL_BASE = f6a1f77a8b7b878bcb9821a68836925755ca7076
PR = https://github.com/mayf3/dsh-agent-core/pull/627
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = AMEND (existing proposed authority only)
ROUTE_STAGE = AUTHORITY_AUTHORING
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED (reply authorization / cross-repository protocol)
DOCS_FIRST_REQUIRED = YES
SPEC_STATUS = proposed
SPEC_REVISION = proposal-2
AUTHORITY_ACCEPTED_IN_BASE = NO (this HUMAN_GATE proposal)
PRODUCTION_APPLY_AUTHORITY = none
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO (pending exact-head Owner acceptance)
OPERATION_ALLOWED = NO
ACCEPTED_AUTHORITY_DELTA = NONE
PRODUCT_SOURCE_OR_TEST_DELTA = NONE
PRODUCTION_WRITES = 0
```

授权是用户本轮“#627 HUMAN_GATE Spec 三处小修（Owner 裁定④，2026-11-06）”
合同式交办，持久输入为已有 `BRIEF-627-REVISION.md`。允许修改该 Spec 与本回执、
提交 push 并更新 PR 描述；不实现代码、不自我接受。失败即停并写
`STOPPED-627-REVISION.md`，不继续依赖写入。

初始 PR readback：OPEN、未合并，head 与 `REVISION_BASE_HEAD` 一致。
修订仅作用于 `docs/specs/AGENT_CORE_WORKFLOW_HUMAN_GATE_PROTOCOL_V1.md`
和本回执；两个已有未跟踪 Brief 保留原样、不纳入提交。

## 修订点 → 裁定条款映射

| 本次裁定 | 修订落点 | 可审阅结果 |
|---|---|---|
| ① 引文补正：#1352 comment-6622750077，mayf3，2026-11-04 12:42:18 +08，监管代记，三点持久记录 | §3、OBS-HG-003、EVD-HG-003；CTR-HG-002/003；移除 §13 的评论 UNKNOWN | 精确链接、作者、UTC/+08 时间和“监管代记”已记录；HUMAN_GATE 群含上下文/已尝试清单、仅 Owner 指定域 owner 可代答/resolve、24h 无 resolve 升级再提醒均明确。身份验真不授予代答权 |
| ② 24h 为未 resolve 处置期限，回复/ACK/VERIFIED 不取消责任，从原 escalationAt 起算，Svc 持久升级提醒及重发现 | DEC-HG-003、CTR-HG-005/008、§10、ACC-HG-008 | 逻辑字段改为 escalationAt/resolutionDueAt（原 escalationAt + 24h）；第 1 小时回复且验证成功但未 resolve 到期仍提醒；重启、丢事件、通知失败保留责任/原期限及发送结果；仅 OVERDUE 不合格。均为验收定义，NOT_RUN |
| ③ 普通/managed 分拆，不放宽 guard；managed 合法后继归 Svc #1378/#1352 | DEC-HG-002、CTR-HG-004 路径表、§10、ACC-HG-004、§13/13A | 普通 owner_action 支持 HUMAN_REQUIRED→RESOLVED；opted-in managed 走 require_effect/真实 STARTED REVIEW effect，现有可达路径下直接 Owner resolve 被 guard 拦。Core 仅消费；不把路径约束输入冒充 Svc 实现或运行验收 |
| ④ 依赖边界：收件面、身份映射、resolve link、持久重发现等 UNKNOWN；Core 合同接受≠全链路解阻 | 新增 §13A；同步 §6/§13 | 六项外部依赖保持 UNKNOWN，包含 managed 合法后继、24h 实际接线、paired accepted revision 与真实 DB 证据；文档接受不能宣称 HUMAN_GATE 可用或 managed 已解阻 |

## 来源核验与权威边界

通过 GitHub connector `github_fetch` 只读访问
`https://api.github.com/repos/mayf3/agent-control/issues/comments/6622750077`，
本轮核验截至 `2026-11-06T03:37:56Z`（11:37:56 +08）。返回 `isError:false`：

- `id=6622750077`，`issue_url=https://api.github.com/repos/mayf3/agent-control/issues/1352`；
- `user.login=mayf3`，`author_association=OWNER`；
- `created_at=updated_at=2026-11-04T04:42:18Z`，即 2026-11-04 12:42:18 +08；
- 正文标题明确“监管代记”，三项裁定与本次交办一致；
- 解码后原始 body 的 UTF-8 SHA-256：
  `0552d8c8c6e3620145dcf641acedfe70249e59477c45356336cc763fa1f2f435`。

稳定来源：[Owner 评论](https://github.com/mayf3/agent-control/issues/1352#issuecomment-6622750077)。
这证明裁定记录存在，不证明通知、身份、Svc effect/resolve 或运行结果已经实现。
普通/managed 具体路径约束归因于本次 Owner 交办输入；未声称本轮重新审计 Svc 源码/DB。

已按入口读取共享 grammar、local authority、Product Architecture、Current Decisions 的
D-008/Workflow notification、accepted Owner V2 §§2/6/8/9、WAE001b、WEC005/008，
以及 spec-governance Skill 和 AUTHOR mode。未修改 accepted 文件或稳定 accepted 含义。

| accepted 输入 | 本轮实测 SHA-256 |
|---|---|
| Core Owner Workflows V2 | `f8e8b0d48f8e2a682897c98f5003a1ffbd608ed722fb653a01bde81417767e7b` |
| Core WAE V3 | `c5d39e390026807b9e471a6875f5e0e9d15432f21a3d177733bf422fc751a1e6` |
| Core WEC V3 | `03469e9f53ccf53f23de3a552270a4bb82f1922b6979108fe01083488c3335d4` |

本轮 GitHub compare（原 proposal base→main）观察到 main
`75ece578301b014a23b987568d1eb8af96795300`，ahead 7 / behind 0。
变化为 P1-B 记录/测试及 window 工具/记录，不涉及上述 accepted governing authorities、
Architecture、Decisions 或本地治理。未 fetch/rebase，未操作窗口工具；不重开已通过修复。

## 文档检查与独立审查

修订 Spec 实测 SHA-256：
`dff7a653b918adfc442d7f9f49b8346675e02f44154cab1d4b9cf7c298681896`。
相对 revision base 的 Spec diff：85 additions / 29 deletions。

以下实际检查 rc 均为 0：

- Python `jsonschema.Draft202012Validator` 对仓内 `spec-frontmatter.schema.json`
  验证修订 frontmatter；`validate_transition([base_proposal], [revised_proposal])`
  验证 proposed→proposed 生命周期；status/prod authority 保持 proposed/none。
- 8 个稳定 CTR-HG ID 与 8 个 ACC-HG 对应；CTR-HG-006/007 整段与 revision base
  bytes 相同，原 WEC008 DTO/单次消费证明未改。
- 旧 responseDueAt/escalatedAt 与“引文待 gh 恢复核验”表述已移除；authoring 语义复核
  由独立 reviewer 完成，机械字符串检查不代替语义审查。
- `python3 .agents/tools/verify_governance.py --target .`：vendored bytes 匹配 lock。
- `git diff --check`、允许路径检查及原 Brief 哈希检查通过；源码/测试/accepted authority
  无 diff。`BRIEF-627-REVISION.md` SHA-256 为
  `476d4aade7f9c872994c613fdc0c16869055f76adf3f3226b2b7032b608c43a0`；
  旧 authoring Brief SHA-256 仍为
  `dd0d64272f2cec20aa40900b5a286e840719e5151407a0797ba55ff0af2c6cf6`。

独立 reviewer `/root/revision_review`（非作者）完成相对 revision base 的 DELTA 审查：
**PASS**，`FROZEN_BLOCKER_UNION=[]`，`BLOCKERS=0`，无新真实 authority conflict。
审查绑定上述 Spec SHA-256，及审查时回执（PENDING 版本）SHA-256
`c93d9a9cf89641c9102b3436d671fa15c94eb6a903c9d0f427036f03629d43b2`。
确认四条裁定、原 WEC008 边界与回执真实性；独立复验 schema、lifecycle、8/8 coverage、
hash、governance integrity、diff check 均 rc=0，实时评论 body hash 与本回执一致。
本次仅将审查结果写回回执；最终 commit 另做 receipt-only/final-head delta recheck。
产品/运行时/paired fixture 测试均 NOT_RUN；ACC-HG 是后续验收定义，不是本轮通过的测试。

Done When：仅提交上述 Spec 与本回执，push 原分支，更新 PR #627 描述并 readback；
保持 proposed，等待 Owner 对精确 head 的接受。不得把文档审查 PASS 升格为产品实现、
安装、生产、业务闭环或跨仓解阻。
