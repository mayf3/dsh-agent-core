# RECEIPT — #627 HUMAN_GATE Spec 修订与 B1/B2 blocker 修复

日期：2026-11-06（Asia/Shanghai）。**spec proposal, proposed — not acceptance**。
本回执前部保留 2026-11-06 修订历史；**当前状态以末尾 2026-11-09 B1/B2 修复段为准**。
历史 PASS 不覆盖本次 blocker，历史“本轮”均指 2026-11-06。
`RECEIPT-EKR-P1A-SPEC.md` 保留原提交时的历史观察，
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

历史修订记录将授权归于“#627 HUMAN_GATE Spec 三处小修（Owner 裁定④，2026-11-06）”
及 `BRIEF-627-REVISION.md`；该原任务指令④与 Brief 本轮均为 `NOT_LOCATED`。
不可读不等于不存在，旧路径/哈希不能替代可读原文；当前来源重锚定见末尾 B2。
本次仅修提案及回执、提交并推送的授权来自用户执行 FIX-BRIEF 的明确指令，
不沿用历史 PR 更新或额外 STOPPED 文件写入要求。

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
- 历史记录称 `git diff --check`、允许路径及原 Brief 哈希检查通过；源码/测试/accepted
  authority 无 diff。历史记载 `BRIEF-627-REVISION.md` SHA-256 为
  `476d4aade7f9c872994c613fdc0c16869055f76adf3f3226b2b7032b608c43a0`；
  旧 authoring Brief SHA-256 仍为
  `dd0d64272f2cec20aa40900b5a286e840719e5151407a0797ba55ff0af2c6cf6`。
  以上 Brief 哈希本轮未复验，不作当前原指令④可读证据。

独立 reviewer `/root/revision_review`（非作者）完成相对 revision base 的 DELTA 审查：
**PASS**，`FROZEN_BLOCKER_UNION=[]`，`BLOCKERS=0`，无新真实 authority conflict。
审查绑定上述 Spec SHA-256，及审查时回执（PENDING 版本）SHA-256
`c93d9a9cf89641c9102b3436d671fa15c94eb6a903c9d0f427036f03629d43b2`。
确认四条裁定、原 WEC008 边界与回执真实性；独立复验 schema、lifecycle、8/8 coverage、
hash、governance integrity、diff check 均 rc=0，实时评论 body hash 与本回执一致。
本次仅将审查结果写回回执；最终 commit 另做 receipt-only/final-head delta recheck。
产品/运行时/paired fixture 测试均 NOT_RUN；ACC-HG 是后续验收定义，不是本轮通过的测试。

历史 Done When：仅提交上述 Spec 与本回执，push 原分支，更新 PR #627 描述并 readback；
保持 proposed，等待 Owner 对精确 head 的接受。不得把文档审查 PASS 升格为产品实现、
安装、生产、业务闭环或跨仓解阻。

## 2026-11-09 当前修复 — HG-WEC5-LOCK-TIMING / HG-RULING4-SOURCE

```text
WORKTREE = /private/tmp/review-627/repo
BRANCH = ac-ekr-p1a-spec
REPAIR_PARENT_HEAD = 1c3371abe36bcda08da27eb901e86dd95af949bc
AUTHORITY_REFERENCE_MAIN = a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = AMEND (existing proposed authority only)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED (docs-first; no implementation or operation)
ROUTE_STAGE = AUTHORITY_AUTHORING
SPEC_STATUS = proposed
SPEC_REVISION = proposal-3-blocker-repair
AUTHORITY_ACCEPTED_IN_BASE = NO (this HUMAN_GATE proposal)
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO (pending exact-head Owner acceptance)
OPERATION_ALLOWED = NO
PRODUCTION_APPLY_AUTHORITY = none
ACCEPTED_AUTHORITY_DELTA = NONE
PRODUCT_SOURCE_OR_TEST_DELTA = NONE
PRODUCTION_ACCESS = NONE
```

当前授权与冻结范围：用户明确要求执行 `/tmp/review-627/FIX-BRIEF.md`，只修 B1/B2，
只改提案 Spec、本修订回执及必要验收定义，单 commit 推 `origin ac-ekr-p1a-spec`；
push 失败则生成 bundle 交接，不重试。该修复简报本地实测 SHA-256：
`ce6c64f53d5cc80e54dbdfc044b214b5ec6ac1e86648030d63e557cee2030bdf`。
GOAL/CURRENT_GAP 为修复锁时序冲突和不可核的原指令④归因；DONE_WHEN 为两处闭合、
文档校验与独立 delta 复核后单 commit 推送，失败则 bundle。
EXPANSION_TRIGGER 为新增真实权威冲突、超出这两个 blocker 的语义改动或生产访问需求；
本轮不重开产品裁定。最终 commit、push 或 bundle 结果由 Git/交付元数据报告，
本回执不预报提交 SHA 或推送成功。

### B1 — HG-WEC5-LOCK-TIMING（CONTRACT_VIOLATION）

只读 `git show <AUTHORITY_REFERENCE_MAIN>:docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md`
及 V3/V4 的生命周期记录，核到 V3→V4→V5，WEC5 status=accepted、accepted_by=mayf3、
production_apply_authority=none。固定可读坐标：
[WEC5 CTR-WEC1-008 两类 collection](https://github.com/mayf3/dsh-agent-core/blob/a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b/docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md#L653-L699)、
[CTR-WEC4-010](https://github.com/mayf3/dsh-agent-core/blob/a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b/docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md#L759-L815)、
[ACC-WEC4-003](https://github.com/mayf3/dsh-agent-core/blob/a242f8e1b622bdbc9a2d3518ecbcc6f976478a2b/docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5.md#L953-L968)。
WEC5 文件实测 SHA-256 为
`e2160a5eff748d03daa199b08517bb89e1efaa64008020e27d0344385adf331a`。
这是已存在的本地 origin/main 快照读取；未 fetch/rebase，不宣称已刷新远端 main。

修复将提案 governed_by/§3 有效 WEC 引用改为该 WEC5，原 authoring base 保留。
CTR-HG-007 明确锁内 detached capture → 锁外 pre-plan/evidence collection → 重获同锁
→ CURRENT ledger replay → fresh trusted 权威等值终检 → 单次 planned append。
两份旧 read/local revision/TTL 不能替代终检；相关 drift/缺证据一律本轮零 plan/消费/投递，
原 refusal 与正常 sweep 保持。ACC-HG-007 同步要求两段实际 barrier 下无关 B 先完成、
真实独立双 writer、全部 append 保留及终检等待证据；禁止锁内重跑整套采集。
原 DTO、sequence/baseline、单次 permit、budget/STOP、恢复边界均保留。
这些是提案语义/验收定义修复，双 writer 产品测试仍 NOT_RUN、性能 UNMEASURED。

### B2 — HG-RULING4-SOURCE（REQUIRED_GATE_FAILURE）

本轮 root 与非作者 reviewer 分别只读本地持久文件：
`/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json`。
源文件本轮 SHA-256 为
`6afd34a5b035113a919737dee4afa0ef777169c4e9c2bbb4041308a39774f2ea`。
读取方法为 Python `json.loads`，按 ruling `id` 精确选择 `items[3]`；以下摘录直接持久化于
本回执，独立审阅不依赖临时 Brief。registry 时间按原记录保留，不推断未标注时区。

| 持久坐标 / source status | 本轮可读内容及证明范围 |
|---|---|
| `$.rulings[id=owner-20261108-three-unified].items[3]`；ts=`2026-11-08 06:11`；本地读取 VERIFIED | 原文必要摘录：“范围内缺证/引用/构建/测试/网络/合并问题原责任链自主处理, 不以新SHA/Session/SpecID/普通失败为由重复请批; 仅常设授权§7所列新风险/新决策才最小差量HUMAN_GATE”。支持 HUMAN_GATE 政策语义及原责任链修复，不补写原④ |
| `$.rulings[id=owner-20261108-backlog-convergence].items[3]`；ts=`2026-11-08 09:05`；本地读取 VERIFIED | 原文必要摘录：“#1352复用已裁定不重请”。支持复用既有裁定，不重决产品语义 |
| [agent-control #1352 评论 6622750077](https://github.com/mayf3/agent-control/issues/1352#issuecomment-6622750077)；历史独立核验 REUSED | 作者 `mayf3`、created/updated=`2026-11-04T04:42:18Z`、三点裁定及 body hash `0552d8c8c6e3620145dcf641acedfe70249e59477c45356336cc763fa1f2f435` 见前部历史核验记录；2026-11-09 独立审查修复简报也明确其已独立核实。当前未重新请求评论，不将三点冒充原④全文 |
| 2026-11-06 原任务指令④、`BRIEF-627-REVISION.md` | NOT_LOCATED；不可读≠不存在。旧 Brief 哈希仅历史记录，不证明本轮可审阅原文；不虚构、不重建原文 |

两个完整 `items[3]` 的 canonical SHA-256（UTF-8，
`json.dumps(item, ensure_ascii=False, sort_keys=True, separators=(',', ':'))`，包括 JSON 字符串引号）
依表中顺序为：
`bc504d55a11b3581377a0fc188c704ac1f0b7e4b88465646904e9b4347dc1cb9`、
`78eb96d162b9845470a4c575d1e5aec911cb9aa7fcbe6368d7414789ef59ccbd`。

据此修正回执旧归因及提案 §3/CTR-HG-004：普通/managed 路径、24h 未 resolve 期限、
§13A 依赖边界保留为原提案内容；不声称两条 registry 或三点评论包含这些细节，
不追认不可读原④，也未重新审计 Svc 源码/DB。政策语义重锚定与具体路径的证明范围
分开，不增加执行权限，不解除原 UNKNOWN/STOP。

### 当前文档校验与独立 delta 复核

修复 Spec SHA-256：
`e19b8f3ec51d9bb3b6b92dcf3c8bce22b355ba36bf32472bb035a8c51fc6f37e`。

实际文档检查全部 rc=0：

- `jsonschema.Draft202012Validator` 按仓内 frontmatter schema 校验；
  `validate_transition([parent_proposal], [repaired_proposal])` 验证 proposed→proposed。
- 8 个稳定 CTR-HG ID 与 8 个 ACC-HG 对应；原 DTO、CTR-HG-001/002/003/005/006/008
  bytes 不变，CTR-HG-007 前驱资格及后半 permit/replay/budget/STOP 段不变，
  §13 起的迁移/依赖/authoring 边界不变；CTR-HG-004 仅修来源归因。
- WEC5 accepted 状态、固定 main/文件哈希、registry 文件及两个完整 item canonical
  hashes、selector 与回执绑定均实核；原 Brief 本 checkout 未找到。
- `python3 .agents/tools/verify_governance.py --target .`：vendored bytes 匹配 lock；
  `git diff --check` 与允许路径检查通过，只有本提案与回执两文件。

非作者 `/root/source_review` 独立 DELTA 复核：**PASS**，`FROZEN_BLOCKER_UNION=[]`。
绑定 repair parent、authority main、上述 Spec SHA-256，以及写回检查结果前的回执
SHA-256 `e6d6e5a028add4e66d3dd98946520a22fb3b9b189b2a88ad0e8061c27edeafcd`。
独立复读 registry/hashes、对比 DTO/恢复/permit 边界并核对两段 collection 时序及验收，
确认 B1/B2 闭合且无新增 blocker；写回结果后仅作 receipt-only/final-head delta recheck。
本结论仅为提案修复审查推荐，仍待 Owner 对精确 head 接受；产品/运行/paired fixture
验收均 NOT_RUN，未测并发性能或业务结果。
