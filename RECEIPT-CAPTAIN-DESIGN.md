# RECEIPT — Release Captain 受托核定方案

```text
TASK = BRIEF-CAPTAIN-DESIGN
DELIVERY_STATE = DOCS_CANDIDATE_PRE_PUBLICATION
AUTHOR = /root (Codex under this attributable Owner task)
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
BASE_HEAD = f6e332d7568b01c5253618449bfef5839102c851
CURRENT_BASE_HEAD_AT_INITIAL_READ = f6e332d7568b01c5253618449bfef5839102c851
WORKTREE = /private/tmp/fleet-captain-design-docs
BRANCH = docs/captain-design-proposal
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = existing accepted repository governance; no Product Contract changed
MUTATION_AUTHORIZATION = user BRIEF + owner-20261107-preauth-v2-supplement + user R2/R3b continuation (docs only)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NOT_APPLICABLE
ISOLATED_WRITE_SURFACE = YES
IMPLEMENTATION_AUTHORITY = none
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO_THIS_TASK_PROHIBITS_MERGE
OPERATION_ALLOWED = NO
```

GOAL 是交付可供 mayf3 核定的 Captain 具体身份/职责/范围/期限/撤销/控制方案及逐项回执。CURRENT_GAP 是 uid502 只有提名/台账归属，真实 principal 与任命、session 延续及真实工具签发校验尚未形成可依赖的资格链。本文不填补真实身份、权限或生产观察；它将这些未知保留为未来任命/激活的明确依赖。

EVIDENCE_NEEDED 为 Owner 精确记录、本仓相关 accepted authorities、SRA 提案坐标、实际 validator 源码/隔离探针、非作者文档审查、docs-only 及出版读回。DONE_WHEN 为方案+本回执逐项覆盖、独立审查、commit/push 和未合并 PR。EXPANSION_TRIGGER 为真实 authority 冲突、扩身份/权限/产品/生产效果、证据失真或交付验证/出版失败；触发则停相关工作，仅按任务写 STOPPED 文件。NEXT_REAL_ACTION 是独立精确 Head 审查后推送开 PR，绝不任命、接受、签发、合并或生产执行。

## 1. Owner 补充①及 BRIEF 七项覆盖

主交付为 [CAPTAIN-DESIGN-PROPOSAL.md](CAPTAIN-DESIGN-PROPOSAL.md)。Owner 来源为 [owner-selected-records.json](docs/reports/captain-design-20261107/owner-selected-records.json)，补充 canonical SHA256=`6b734043df5d6f0314ac426450ad449a1c0afd601721aa27a16ef570cf0bbada`；V2 canonical SHA256=`087461a2a7424088b258940393ef4f9ad5939e59d0a1e420dfc57efd2829c006`。选择记录仅作来源证据，没有向 DISPATCH-REGISTRY 写任何任命或归属。

| 要求 | 文档坐标 | 覆盖结果与限制 |
|---|---|---|
| 1 职责分离、角色图、禁止兼任与冲突矩阵 | §1.1/1.2 | 四个不同 principal；三主体需兼任的风险；推荐独立 C；uid502 Mandate 审查/作者相邻性如实披露，六项缓解或排除；这是待核定设计，未伪称已任命 |
| 2 具体受托 Principal 核定表 | §2 | A/W/V/C 四组三元组、逻辑候选名、稳定 principal→Agent→session 延续、能力/拟注册坐标；真实 ID 与现存实现未证均保持 UNRESOLVED，不以 UID/clientId/session 造身份 |
| 3 授权仓/发布类/排除项 | §3 | 仅本仓 accepted Contracts、既有单 fleet runtime、STANDARD_RECOVERABLE；沿 SRA §2 全部排除与无新控制器/Grant/恢复重放权 |
| 4 有效期、续任/撤销 | §4 | 建议截止2026-12-07T00:00:00Z，明确时区/排他界、非 Owner 已定时刻；四期限交集、原链追加登记、fresh 撤销、在飞安全停止不自动回滚 |
| 5 实际工具执行控制与负向测试 | §5.1–5.3 | 现有缺口/精确源码与隔离诊断；JSON+任命/签发登记+真实身份/权限/封印/撤销绑定；未任命/过期/越界等 N01–N08；未来控制未实现未资格，不混成 PASS |
| 6 任命与接受时序图、授权者/登记坐标 | §6 | T0–T5 和 Mermaid；mayf3 首次接受 PR648→main、mayf3 任命、身份/真实控制齐备后资格激活、W7逐单全门签发/执行/独立收据；不循环授权 |
| 7 开放问题 | §7 Q1–Q7 | principal 可用性/真实 scope、跨session证明、真实入口控制、uid502参与程度、唯一 SRA 生效文本、UTC/撤销、W7当次事实；逐项给责任链下一动作与阻断范围 |

补充②由 §0/6 明确首次合法接受者只能是 mayf3，候选 C 不能接受自己的权源；补充③由 §3/5/6 保持 W7 首单候选及关键门 UNKNOWN 不自动签发，未来边界事实不预填；补充④由 §2/5/6 复用现有 Spec/PR/Mandate/Receipt/台账/控制，未建第二平台。`OPERATION_ALLOWED_NOW=NO` 贯穿全部章节。

## 2. 实际执行与证据

| 观察/检查 | 实际结果 | 证据与适用限制 |
|---|---|---|
| main 坐标读取 | GitHub `git/ref/heads/main` rc0，返回本回执 BASE_HEAD；local 同一 commit | initial source provenance；出版前另 fresh 复核，不用候选分支冒充 main |
| PR648 读取 | open、merged=false、head=61b97d326e337057cd1f71c0a6ff0dc37ab72ec2 | [source-provenance](docs/reports/captain-design-20261107/source-provenance.json)；该草案仅输入、没有接受效果 |
| Owner 补充与 V2 来源 | 只读解析两个 ruling、记录 source file hash/selector/canonical hash | [选择记录](docs/reports/captain-design-20261107/owner-selected-records.json)；原文件可继续变化，选择记录hash独立绑定 |
| 权威/工具源 | 精确 base commit/blob/SHA256 | [source-provenance](docs/reports/captain-design-20261107/source-provenance.json)；代码只能证明实现缺口，不创建 authority |
| 现有 validator 隔离诊断 | raw rc0；三项缺任命/越界/自报过期任命均 ACCEPTED；窗口过期控制例 REJECTED | [完整可复制探针](docs/reports/captain-design-20261107/control-probe.md)、[实际 stdout/rc/时间/hash](docs/reports/captain-design-20261107/control-probe-result.json)；AST仅运行三个纯函数，不import原模块、不调用生产、不代表整窗执行 |
| 新 Captain 控制 N01–N08 | NOT_EXECUTED；现有实现不具该准入，资格 NO | 只交测试定义，不伪称负例已拒绝；未来独立验证须绑定实际受信入口/零效果证据 |
| 文档/来源/链接/范围、git diff check、governance integrity | R2 全量静态检查 raw_rc=0；原始 stdout/stderr 与时间见 [checks.json](docs/reports/captain-design-20261107/checks.json) | 仅覆盖该次执行坐标；R3b 追加字节另作受影响检查。文档成功不证明安装、身份、任命、生效、runtime 或业务结果 |

本轮工作树从 exact base 新建。原 `/private/tmp/fleet-roll-src` 有其他 worker 的脚本改动及未跟踪文件，`/private/tmp/fleet-sra-v1-docs` 承载已有 SRA 分支；没有切换、覆盖或提交它们。所有本轮提交只允许方案、回执、STOPPED 记录和 `docs/reports/captain-design-20261107/` 下 Markdown/JSON 来源/诊断/审查证据。无产品代码、配置、Schema、行为测试或既有 authority 改动。

零生产写入依据为本轮实际动作范围：本地 Git/Markdown/JSON、只读本仓/来源台账/GitHub 元数据与 AST 合成诊断；没有调用生产 API/DB/store、credential resolver、token mint、Grant、sudo、launchctl、安装器、window --execute、privileged selftest、业务请求、mutex、生产读取或写入。没有用生产 before/after hash 冒充本轮执行证明，因为本轮没有获准/需要读取这些前态。

## 3. 独立审查、出版与状态

非作者审查将在语义 commit 冻结后绑定 exact Head/base；初稿意见不冒充 final-Head 审查。收据/审查证据后续 commit 也需独立 final-Head delta 复核。最终 PR body 承载真实 reviewer 返回、最终 SHA、push 与远端/PR fresh readback，以避免在文件中自引用未来 HEAD。

```text
DOCS_COVERAGE = 7_OF_7
REAL_PRINCIPAL_BINDINGS = UNKNOWN_NOT_CREATED
SRA_ACCEPTANCE = NOT_PERFORMED
CAPTAIN_APPOINTMENT = NOT_PERFORMED
DELEGATION_ACTIVATION = NOT_PERFORMED
W7_ISSUANCE = NOT_PERFORMED
PRODUCTION_READS / PRODUCTION_WRITES = NONE / NONE
IMPLEMENTATION / INSTALLATION / RUNTIME_ACCEPTANCE / BUSINESS_ACCEPTANCE = NONE / NONE / NONE / NONE
```

当前这份收据的时间边界是出版前候选。commit、push 和 PR 创建的最终实测坐标及未合并状态以本任务 PR 出版记录为准；不把本轮文档交付视为 mayf3 正式接受或任何生产许可。

## 4. R2 机械续接记录

本次用户明确授权修正代码围栏误报、重跑全量静态检查、从当前 main 基创建
`docs/captain-design-proposal`，commit/push 并 `gh pr create --base main`，不合并；
零生产写入、失败即停继续适用。R1 的 [STOPPED](STOPPED-CAPTAIN-DESIGN.md)
保留原始 rc1 和当时状态，不将历史停点改写成成功。

误报坐标为 [control-probe.md:32](docs/reports/captain-design-20261107/control-probe.md#L32)，
处于 :5–41 的 Python 围栏。函数调用 `namespace["validate_authority"](item, ...)`
没有 Markdown 链接标签，原正则只找右方括号加左括号造成误判。
[修正后的检查器](docs/reports/captain-design-20261107/static-checks.md)
先屏蔽围栏和行内代码，再匹配完整 Markdown 链接，并登记排除围栏坐标及理由。
外链仅登记，未声称网络可达；章节 slug 不作语义验证。

R2 开始时，STOPPED 所列七个 R1 文件的 SHA256 全部与保存值一致。
方案保持逐字节不变：SHA256=`bff562271cd15af449c1c0542a1386b340956a9db48fbd1a16a972e0948faa7a`。
GitHub main fresh readback 仍为本回执 BASE_HEAD；PR #648 仍 OPEN、未合并且 head
仍为 `61b97d326e337057cd1f71c0a6ff0dc37ab72ec2`。本地仓没有配置 remote 或本地 main，
因此不改共享 worktree 的 remote/main，后续直接向本仓 URL 推送明确分支；
拟建分支的父提交必须等于 fresh main，其他 checkout 不被切换或修改。

本次静态检查、冻结 commit、独立审查和出版结果在执行后登记；当前仍为出版前状态。

## 5. R3b 重写式机械续接

用户 R3b 明确授权以 Python 读取现文后整体重写，处置 R2 回执更新的上下文不匹配，
追加 STOPPED 检查原文与哈希、提交指定文档、推送并 `gh pr create --base main`，
不合并，零生产写入，后续实际失败仍立即停止。R2 已成功创建目标分支，
本轮核实当前分支与 exact parent 后原地续接，不重复执行会因同名分支已存在而失败的创建。
本地未配置 remote；沿 R2 已记录方式向 `https://github.com/mayf3/dsh-agent-core.git`
推送精确分支，不修改共享 Git remote 或其他 worktree。

R1 围栏假阳性与 R2 apply_patch 上下文不匹配是两个不同事件；原始失败保留于
[STOPPED](STOPPED-CAPTAIN-DESIGN.md) 的历史节。当前 R2 停点已由 R3b 重写方式处置，
全量检查复用 [checks.json](docs/reports/captain-design-20261107/checks.json) 的实际 rc0，
不重执行已通过的来源校验或隔离探针。只对追加文档、链接/围栏、JSON、允许路径与
Git 空白作受影响复核；原 checks.json 的时间边界和字节保持不变。

本节写入时尚未 commit/push/创建 PR；实际出版坐标将在 PR 成功读回后追加。
