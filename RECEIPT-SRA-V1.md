# RECEIPT-SRA-V1 — R2 docs-only 起草收据

```text
STATUS = DRAFT_REVIEWED_DOCS_PUBLICATION_PENDING
GOAL = Owner预授权V2的六节可执行委托草案及docs-only PR
AUTHORITY_ACTION = NEW
ROUTE_STAGE = AUTHORITY_AUTHORING
ASSURANCE_LEVEL = CONTROLLED
IMPLEMENTATION_AUTHORITY = none
ACCEPTED / EFFECTIVE / WINDOW_ISSUED = NO / NO / NONE
PRODUCT_CODE_DELTA / PRODUCTION_READS / PRODUCTION_WRITES = 0 / 0 / 0
W7_STAGE00 / AUTHORITY_JSON / INSTALL / BOOTSTRAP = NOT_EXECUTED
MERGE_ALLOWED_THIS_TASK = NO
```

本收据记录截至候选文档冻结时的实际观察，出版后的精确 HEAD/push/PR 结果由同一 PR 的持久记录及最终 readback 绑定，不在命令执行前预填成功。独立审查结论另存 [本轮证据目录](docs/reports/sra-v1-draft-20261107/)；审查不等于正式接受。本任务没有生产读取、窗口签发、角色任命或生产操作。

## 1. 授权、坐标和实际续做

| 项 | 实际值及证据 |
|---|---|
| 仓库 / base | `mayf3/dsh-agent-core` / `main` |
| 工作面 | `/private/tmp/fleet-sra-v1-docs`；既有隔离分支 `docs/standing-release-auth-v1` |
| 原检出 | `/private/tmp/fleet-roll-src`；detached基线，未在该面写入或暂存 |
| parent / BASE_HEAD | `f6e332d7568b01c5253618449bfef5839102c851` |
| 直接任务 | 本轮用户R2：双路径任一成功可继续、六节正文+收据、commit/push/PR(base该仓main)、不合并；push仅网络瞬断可再试一次，其他失败即停 |
| 台账R2来源 | `$.history[round=sra-r1-netstop-r2]`，观察索引661，2026-11-07 14:50；canonical SHA256=`3406ca76208ec353c58b2f5ec1ff421c66eb8ffe02cc73d7f3f344c0136daa1b` |
| Owner原则 | `$.rulings[id=owner-20261107-preauth-v2]`，2026-11-07 14:43；六条款=`items[0..5]`、行动=`items[6]` |
| 首任候选 | 监管会话（uid502，台账归属）；`history[660].actions[1]`；提名而非任命 |
| 最终草案 | [STANDING-RELEASE-AUTHORIZATION-V1-DRAFT.md](STANDING-RELEASE-AUTHORIZATION-V1-DRAFT.md)，六节、SRA-C-001..006、六条验收映射、G01..G16强制门 |
| R1保全 | [STOPPED-SRA-V1.md](STOPPED-SRA-V1.md)原样保留；其STOP仅为R1历史停点，不代表R2仍停在该网络错误 |

已按顺序读取 grammar/local README、直接相关 Architecture/Decisions/Specs 与 spec-governance AUTHOR 模式。路线是新增常设委托治理的 docs-first 作者阶段；本轮没有把 accepted 实现 Contracts 或 Owner任务提示词当作现成生产许可。

### 双路径实际结果

详见 [remote-read-r2.json](docs/reports/sra-v1-draft-20261107/remote-read-r2.json)。

| 路径 / 命令 | UTC开始→完成 | 实际rc / 输出 | 能证明的结论 |
|---|---|---|---|
| 原生 Git：`git ls-remote https://github.com/mayf3/dsh-agent-core.git refs/heads/main refs/heads/docs/standing-release-auth-v1` | `2026-11-07 06:51:56→06:51:57` | **0**；`f6e332d7568b01c5253618449bfef5839102c851 refs/heads/main`；没有docs分支行 | 当次main坐标与本地parent一致；当次未列出远端docs分支 |
| API：`gh api repos/mayf3/dsh-agent-core/git/ref/heads/main --jq '.object.sha'` | `2026-11-07 06:51:56→06:51:56` | **0**；`f6e332d7568b01c5253618449bfef5839102c851` | 独立路径给出相同main坐标 |

R1 的原生Git rc128/curl18和同轮API rc0仍保留在原STOP记录，不改成当时成功；R2本次两路径均成功，不需再重读来凑次数。读取成功本身不证明push权限或未来生产门通过。

## 2. 六节覆盖与 Owner 六条款对照

Owner原件的选中记录在 [owner-selected-records.json](docs/reports/sra-v1-draft-20261107/owner-selected-records.json)，保留原文字段；以下为覆盖关系，不替代原件。

| 草案节 / Contract | 完成内容 | Owner条款覆盖 | 核验落点 |
|---|---|---|---|
| §1 / SRA-C-001 | Captain可归属身份、独立性/能力、首任提名、必填任命/UTC期限/控制/撤销/替任字段；不拿旧reviewer身份补造任命 | §1角色分工、§2可归属独立受托、§3明确期限/范围/控制、§6复用责任链 | 提名source/hash、候选≠任命、无实际appointment claim |
| §2 / SRA-C-002 | 标准可恢复五判据、单一既有runtime、accepted Contracts、完整Mandate；非标准排除/bootstrap后pause/首次新面/扩权 | §1长期边界不重批、§3标准范围、§4非标准pause、§6不追认未知部署 | DCP V1不授production apply；新controller/profile不能借SRA启用 |
| §3 / SRA-C-003 | W7十节抽取G01–G16，每门有对象+证据坐标+时点+失败出口；E01–E17完整前态/恢复、installer/闭包、consumer/auth/verifier/窗口/回滚/STOP/收据 | §3每单完整技术强制门、§4旧操作终止/隔离、§5缺证禁止依赖、§6原机制复用 | 签发材料与窗口future事实分列；06a完整preimage在bootout前；不贴旧PASS |
| §4 / SRA-C-004 | 引Owner§4原意并映射stage10字段；标准类恢复原合法自然准入；非标准在bootstrap前拒绝 | §4全部语义、§3逐单有效签发、§6生效前禁令/W7不自动签 | 保留历史UNKNOWN、各域fence/认证、不重放；后续11/12不预填PASS |
| §5 / SRA-C-005 | 普通缺陷/测试/资格/构建/缺证原链补齐；最小缺件/责任人/边界/重验；四组Owner升级；未知写入先对账 | §5全部、§1不因换SHA/session反复请批、§3attempt/STOP、§6不另建平台 | 缺证readiness NO且已授权修复不变WAITING_OWNER；未知外部效果不盲重试 |
| §6 / SRA-C-006 | 草案→非作者独审→现行有权维护者正式接受→main权威落地→任命+控制资格生效→逐窗完整Mandate | §2接受委托边界、§3合法体系/可执行控制、§6禁令继续/W7不自动签；汇总§1/4/5 | reviewed commit/final accepted head绑定；PASS≠接受≠生效≠窗口签发；本轮只到PR |

反向核对：Owner§1→草案§1/2/5；§2→§1/6；§3→§1/2/3/6；§4→§2/3/4；§5→§3/5；§6→§1/2/4/6。六条均有明确落点；未将§2“既定、无实质语义变化的规范继任”扩大成任意新权威接受权。

## 3. W7十节抽取覆盖及限制

| W7来源节 | 草案强制门/章节 |
|---|---|
| §1 冻结组合/来源/治理 | G01/02/03/16；草案§2 |
| §2 fork保留行为和实际consumer | G03/04/06/16；不把#646当pause/auth替代 |
| §3 E01–E17、metadata及effects前态 | G05/07/09/15及E01–E17约束段 |
| §4 exact termination settlement与四禁止 | G06/10/11；草案§4/5 |
| §5 各阶段/PASS/STOP/预算 | G01–G15、完整阶段顺序、STOP字段 |
| §6 full preimage/R1/R2/V3回滚线 | G05/06/09/12/15；不恢复旧业务快照 |
| §7 隔离与生产验收分列/stage10 | G03/13/14/16；草案§4 |
| §8 负向矩阵/oracle/历史证据限制 | G11/16；草案验收反例 |
| §9 当次UNKNOWN和禁止项 | G01/04/06/08/10/15；草案§2/5 |
| §10 当次精确申请字段/未签发 | G01/02/07/08；草案§6不自动签W7 |

本轮只把W7作为来源快照，不修改原W7及其Owner签发字样。快照中installer/bundle=`NOT_SELECTED_NOT_QUALIFIED`、R5隔离PASS保留原时点含义；后续installer资格worker的结果本任务未审查，不断言其当前成败。真实窗口的app/installer/闭包/生产状态/效果/期限/readiness都必须另核。

## 4. 来源保全与可复核坐标

| 来源 | 选择器/实际SHA256 | 复核说明 |
|---|---|---|
| 原BRIEF | `61f75cc7cd88c14193e419bc68762b2f09a3858b99d0efc19cf69347d1be4b47` | 字节副本纳入证据目录；授权范围未扩大 |
| W7十节原稿 | `ffe1088eca1df5b63ae8e1a4e4897d5c390aa38cf76021fcc45e323fad96c911` | 26921 bytes字节副本；不是生产运行门证明 |
| Owner V2 | `rulings[id=owner-20261107-preauth-v2]`；canonical=`087461a2a7424088b258940393ef4f9ad5939e59d0a1e420dfc57efd2829c006` | 与R1子记录一致 |
| 首任提名 | `history[round=sra-v1-draft-dispatched]`；canonical=`0498d4a65f2eb5d66cc3ec686a377ccbbbc3a779d79460a7ba6569233dc004e5` | 与R1子记录一致；无精确任命身份 |
| R2续派 | `history[round=sra-r1-netstop-r2]`；canonical=`3406ca76208ec353c58b2f5ec1ff421c66eb8ffe02cc73d7f3f344c0136daa1b` | 持久台账记录和当前用户直接R2指令相符 |
| 台账整文件 | 本次=`12e36c70d9a0f7d87b084f6079d1b4727054c54ecc9f1b8adaae3a549d8e7181` | 整文件随历史追加前移；R1整文件hash不同不代表Owner子记录漂移 |
| 本仓适用权威 | [source-provenance.json](docs/reports/sra-v1-draft-20261107/source-provenance.json)中的精确parent、git blob及SHA256 | Architecture保持其原状态/边界；Decision/accepted Spec以main可见状态为准 |

规范化算法：UTF-8、`json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))`、无末尾换行。Owner快照只选取六条款/行动、提名、R2三记录，未复制完整台账或Secret。来源观察时间为 `2026-11-07T06:53:23.346534+00:00`。本地原件路径在 provenance 中保留；PR reviewer可直接读取随PR提交的快照。

## 5. 开放问题与原责任链下一动作

这些是**接受/生效/逐窗操作的事实前置项**，不阻止本轮docs起草和PR，不构造新的泛化Owner请批。参数必填和失败规则在正文已定义，无靠执行者临时决定的规范TBD。

| 开放项 / 当前证据状态 | 原责任链最低动作 | 未齐时禁止的依赖 |
|---|---|---|
| Q1 首任候选只到uid502/台账提名；精确principal/session与正式任命未证 | 现有Root/HR/治理维护者核原授权下身份、角色独立性、能力、任命者权限，登记可归属appointment | 不把候选当Captain签发；不取历史reviewer_session补身份 |
| Q2 接受本新增SRA机制的受托维护者身份/明确scope未绑定 | 按local README检索/登记PR中的既有授权、可接受Spec类型、期限/撤销；已有权限则自行补齐，确无所需权限才按O3升级 | 不正式接受、不用Owner§2继任委托无限扩权 |
| Q3 SRA与任命的实际UTC期限未填写 | 有权任命/接受者在现有授权范围内登记明确validFrom/Until、续任/撤销链 | 不生效、不签单；不得默认为永久 |
| Q4 现行体系对委托的承认及可执行控制资格尚无本轮验证 | 原治理/ITOps/QA核真实已准入入口、issuer/范围/expiry/revocation/candidate/缺门拒绝及独立收据；仅补证适配，不自装新controller/profile | 委托不得标EFFECTIVE，不执行生产写入；若需新增权限才按O3 |
| Q5 非作者审查、正式接受、main落地尚未发生 | 本任务先独审并提交docs PR；后续有权接受者按正文§6独立完成接受事务 | 不把review PASS、PR创建或merge单独当生产许可 |
| Q6 W7当次installer资格/最终bundle/production facts未在本任务验证 | W7原责任链消费真实资格件，重核候选/旧版/consumer/auth/effects/preimage/window/verifier/回滚及全部G门 | 不自动签发W7、不stage00、不install/bootstrap |
| Q7 需要bootstrap后全局pause的发布 | 先归非标准，证明跨restart全入口机制及其权限；按真实需要归O1/O3/O4 | 不按标准SRA签发，不先bootstrap再补pause |

## 6. 验证与出版状态

适用验证是文档语义独审、来源hash/selector复核、六节/六条/十节覆盖、Markdown本地链接、docs-only diff、`git diff --check` 和 vendored integrity；不运行产品测试或生产工具来冒充文档审查。初始实际检查见 [checks-initial.json](docs/reports/sra-v1-draft-20261107/checks-initial.json)，所有检查通过；对实际新增文件还执行了暂存区 `git diff --cached --check`（rc0）和9文件docs-only白名单核验。

语义候选 commit=`67723399ee801d3262b92969a8c016ff53c8a7d2`，parent=`f6e332d7568b01c5253618449bfef5839102c851`；草案实际 SHA256=`5c1bb2567bd2ca04a2743d6c871934204fe511023aec340058f02df0477531e2`。两名非作者 `/root/sra_source_audit`、`/root/w7_gate_audit` 对同一候选独立审查均 PASS，`FROZEN_BLOCKER_UNION=[]`。前者核Owner六条/身份/接受/生效，后者核W7十节/门/阶段/回滚；两者都未创作受审语义或操作生产。结论见 [independent-review.md](docs/reports/sra-v1-draft-20261107/independent-review.md)。本次后续提交仅记录审查与收据，不改草案语义，仍需非作者 final-HEAD delta recheck，结果绑定于PR出版记录。

出版前再次 API 读取 main 实际rc0，仍为同一 `f6e332d7568b01c5253618449bfef5839102c851`。当前隔离worktree检查干净；原检出只读status显示3个installer相关tracked修改及既有untracked文件，均未由本任务写入、暂存或纳入本分支；不对其内容或资格作结论。

提交/推送/PR均遵守本轮直接授权；本地没有配置remote，使用明确仓库URL推送，`gh pr create --repo mayf3/dsh-agent-core --base main` 明确base仓库。不合并。普通失败停止并记录真实错误；仅push同类瞬断允许一次重试，写入结果不明先原生/API读回。

```text
SOURCE_AUTHORING = COMPLETE
INDEPENDENT_REVIEW = PASS_AT_67723399_NONAUTHOR_X2
FROZEN_BLOCKER_UNION = []
CHECKS = PASS
SEMANTIC_COMMIT = 67723399ee801d3262b92969a8c016ff53c8a7d2
PUBLICATION_HEAD = BOUND_BY_PR_HEAD_AND_FINAL_DELTA_REVIEW
PUSH / PR = NOT_EXECUTED_AT_THIS_RECORD_POINT
SPEC_ACCEPTANCE / DELEGATION_EFFECTIVE / W7_ISSUANCE = NOT_EXECUTED
NEXT_REAL_ACTION = RECEIPT_COMMIT_FINAL_HEAD_DELTA_RECHECK_PUSH_AND_PR
```
