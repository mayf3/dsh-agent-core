---
spec_id: AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1
status: accepted
accepted_by: mayf3
accepted_date: 2026-11-07
accepted_at: 2026-11-07T07:26:44.290920Z
accepted_reviewed_head: 8fdd5e9dc4f9cf525188d6ac19f986e0191e9604
independent_review_result: PASS
independent_review_receipt: docs/reports/sra-v1-formalization-20261107/independent-review.md
independent_review_receipt_sha256: 617d3179d9ff8b87a263db1ef2a9156695d5433a9ed0ff2d2b16f7e7faca9a63
acceptance_authority: Owner mayf3 ruling owner-20261107-sra-formalization items[0]
acceptance_authority_source: /Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json
acceptance_authority_selector: $.rulings[id=owner-20261107-sra-formalization]
acceptance_authority_canonical_sha256: f6ace2b1e1621da830421e57a9b886faac75de8f4bf7a895d0ecf0832438a129
acceptance_semantic_source_pr: https://github.com/mayf3/dsh-agent-core/pull/648
acceptance_semantic_source_head: 61b97d326e337057cd1f71c0a6ff0dc37ab72ec2
acceptance_transaction_executor: /root (format conversion and transaction executor only)
acceptance_authority_basis: >-
  Owner mayf3 approved the six-section semantics at PR 648 head 61b97d32
  and explicitly authorized this responsibility chain to perform the first
  formalization/acceptance transaction. The independent nonauthor review
  passed exact proposed head 8fdd5e9dc4f9cf525188d6ac19f986e0191e9604 with semantic
  delta NONE. The worker records this Owner acceptance; the worker and future
  Captain are not the acceptance authority. The acceptance commit is bound
  by its Git object and exact FINAL_ACCEPTED_HEAD in PR 648. No personal
  Owner review of the converted exact head is claimed.
acceptance_final_head_review: PASS (non-author independent, final head 9529e9a5f042a52f0e2355a3b1dc027339be374f,
  contract semantic delta NONE, session 01a1be9e-29d8-7143-b23a-e62c2600674f)
activation_boundary: main merge after independent final-HEAD review by regulator
spec_kind: invariant
authority_level: governing_spec
implementation_authority: none
production_apply_authority: conditional_controlled_operation
production_apply_conditions: >-
  Only after main acceptance, SRA effectiveness, attributable Captain appointment
  and qualified existing controls under original §§1/6 may the Captain issue
  each complete STANDARD_RECOVERABLE Mandate under original §§3/4.
  This document conversion/acceptance issues no window or production operation;
  PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1 production_apply_authority remains none.
scope:
  - mayf3/dsh-agent-core standing release delegation governance
  - existing single host fleet runtime STANDARD_RECOVERABLE release issuance
  - role registration, evidence gates, stage10, STOP and lawful effectiveness
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - SCHEDULER_OCCURRENCE_OUTCOME_V3
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3
  - SCHEDULER_TIMEOUT_OUTCOME_V3
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V4
  - PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1
external_authorities: []
supersedes: []
superseded_by: null
owners: [mayf3]
semantic_source_pr: https://github.com/mayf3/dsh-agent-core/pull/648
semantic_source_head: 61b97d326e337057cd1f71c0a6ff0dc37ab72ec2
semantic_source_path: STANDING-RELEASE-AUTHORIZATION-V1-DRAFT.md
formalization_ruling_id: owner-20261107-sra-formalization
formalization_ruling_selector: $.rulings[id=owner-20261107-sra-formalization]
formalization_ruling_canonical_sha256: f6ace2b1e1621da830421e57a9b886faac75de8f4bf7a895d0ecf0832438a129
---

# Agent Core Standing Release Authorization V1

<!-- BEGIN SRA_ACCEPTANCE_LIFECYCLE -->
> **当前生命周期：ACTIVE_ON_MAIN。** Owner mayf3 授权正式接受事务已记录（2026-11-07，PR #648 合并 `55f442c7`）；非作者独立最终 HEAD 审查 PASS（2026-11-09，审查头 `9529e9a5`，spec blob `750504f2` 自合并未变，合同语义差量 NONE）。本激活行不签发任何窗口、不任命 Captain、不改变 §§1/6 任命/生效/控制资格与 §§3/4 逐窗 Mandate 的前置要求；OPERATION 仍需其各自独立事实成立。
> 接受权威是上述 Owner 裁定；转换作者/事务 worker 不是接受权威。接受 reviewed HEAD 为 `8fdd5e9dc4f9cf525188d6ac19f986e0191e9604`，独审原文及事务绑定见 [接受收据](../reports/sra-v1-formalization-20261107/acceptance-transaction.md)。
> 原文保全的 proposed/ACCEPTED=NO 等起草时点标记是历史记录；本事务不任命 Captain、不证明控制生效、不签发 W7 或任何窗口，不做生产操作。
<!-- END SRA_ACCEPTANCE_LIFECYCLE -->

> 格式载体转换；语义来源为 PR #648 的 `61b97d326e337057cd1f71c0a6ff0dc37ab72ec2`。
> 下文十三个无编号逻辑章节满足 SPEC_FORMAT_V0；所有 `§1` 至 `§6` 均指 Contracts 中保留的原六节。
> 原文的草案标题、状态块及“本稿/本任务/本轮/R2”描述保留其原起草时点含义；当前生命周期以 frontmatter 及绑定的接受事务为准。
> 本 worker 仅执行转换与接受事务。接受权威为 Owner 裁定 `rulings[id=owner-20261107-sra-formalization]`，不是 worker 或未来 Captain 身份。

## Goal

<!-- BEGIN SRA_SOURCE_GOAL -->
目标是把 Owner 已决定的受托接受、标准发布签发和 stage10 原则落实为可核验的治理程序。当前缺口是角色登记、范围判定、逐门证据和现有控制的绑定尚未形成合法生效的委托。本稿只提议这项长期委托治理义务，不修改产品 Contracts，不实现或激活部署控制器。
<!-- END SRA_SOURCE_GOAL -->

## Scope and non-goals

范围与排除项逐字保留于原 §1/§2/§6。本次转换与接受事务按 [Owner 简报](../../BRIEF-SRA-FORMALIZE.md) 执行，仅文档；不任命 Captain，不签发窗口，不做生产写入。

## Authority and dependencies

<!-- BEGIN SRA_SOURCE_INPUTS -->
起草输入为 [BRIEF 原件快照](../reports/sra-v1-draft-20261107/BRIEF-SRA-V1-DRAFT.source.md)、[Owner 预授权 V2 六条款及提名/R2 记录](../reports/sra-v1-draft-20261107/owner-selected-records.json)。Owner ruling 选择器为 `$.rulings[id=owner-20261107-preauth-v2]`，规范化 SHA256=`087461a2a7424088b258940393ef4f9ad5939e59d0a1e420dfc57efd2829c006`。快照是来源证据，不是新接受记录。原件与本仓权威的精确 commit/blob/SHA256 见 [source-provenance](../reports/sra-v1-draft-20261107/source-provenance.json)。
<!-- END SRA_SOURCE_INPUTS -->

<!-- BEGIN SRA_SOURCE_AUTHORITY -->
约束来源为本仓 [local README](../../.agents/local/README.md)、[Product Architecture](../AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md)、[D-009](../decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md)、[Timeout V3](../specs/SCHEDULER_TIMEOUT_OUTCOME_V3.md)、[Lifecycle V4](../specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V4.md) 及 [Deployment Control Plane V1](../specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md)。这些接受状态以本仓 main 的实际权威为准；来源记录、运行态、测试、hash 或本草案均不能改写其含义。DCP V1 的 `production_apply_authority: none` 保持不变。
<!-- END SRA_SOURCE_AUTHORITY -->

首次接受依据为 [Owner 裁定快照](../reports/sra-v1-formalization-20261107/owner-formalization-ruling.json) 的 `items[0]`，原件、selector、规范化 hash 和观察时间见 [转换收据](../reports/sra-v1-formalization-20261107/conversion-receipt.md)。该裁定约束接受事务，快照本身不替代正式权威或生产授权。Architecture 保持其原有冻结草案标记及既有边界；本转换不改变任何父权威的状态。

## Current State

以下只保全源 HEAD 的起草状态，不将旧起草状态冒称本次接受结果。

<!-- BEGIN SRA_SOURCE_TITLE -->
# Standing Release Authorization V1 — 待审草案
<!-- END SRA_SOURCE_TITLE -->

<!-- BEGIN SRA_SOURCE_ROUTE -->
```text
SPEC_ID = STANDING-RELEASE-AUTHORIZATION-V1
STATUS = PROPOSED_DRAFT_NOT_EFFECTIVE
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = NEW
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_OPERATION_ALLOWED_NOW = NO
CAPTAIN_APPOINTED_NOW = NO
WINDOW_ISSUED_NOW = NONE
```
<!-- END SRA_SOURCE_ROUTE -->

<!-- BEGIN SRA_SOURCE_BOUNDARY -->
完成边界是六节草案、覆盖收据、非作者审查与 docs-only PR；不合并、不任命、不签发。发现与接受权威的冲突、扩张产品/权限/生产效果或证据失真，停止受影响工作并报告；普通缺证按 §5 处理。W7 始终不因本稿自动签发。
<!-- END SRA_SOURCE_BOUNDARY -->

## Observations

- `OBS-SRA-FMT-001` — 来源为 PR #648 `61b97d326e337057cd1f71c0a6ff0dc37ab72ec2` 的根目录草案与既存独立审查；环境为本隔离 docs worktree，方法为 `git show` 与逐节逆转换字节对照，实际观察时间及结果见转换收据。
- `OBS-SRA-FMT-002` — Owner 台账选中裁定及规范化 hash 已直接读取；方法、原件坐标、观察时间与快照见转换收据。这里只观察其记录，不推导任命或窗口已签发。

## Claims and assumptions

- `CLM-SRA-FMT-001` — 本文件对原六节的语义差量为零。Support state: `SUPPORTED`；由 `EVD-SRA-FMT-001` 支持。限制：格式和内容对照不证明任命、控制资格或运行结果。
- 无新增规范假设；任命、期限、控制资格和逐窗事实仍按原 §1/§3/§6 绑定。

## Evidence relations

- `EVD-SRA-FMT-001` — Source: `OBS-SRA-FMT-001`；Target: `CLM-SRA-FMT-001`；Relation: `SUPPORTS`。Bound coordinates: 上述源 HEAD、源路径及本文件的 proposed 转换提交；逐节逆转换 hash 与实际检查见转换收据。Strength/sufficiency: 原六节内容的字节同一及独立语义审查共同支持零语义差量；Limitations: 不证明生产资格、接受完成或 main 生效。Provenance: [原独立审查](../reports/sra-v1-draft-20261107/independent-review.md) 与本次转换收据。

## Decisions

无新增 Decision；保留 Owner 已认可的六节决定。角色登记见原 §1，标准范围见 §2，强制门见 §3，stage10 见 §4，STOP/升级见 §5，合法接受/生效见 §6。首次接受的责任链按上述 Owner 裁定办理，worker 不成为接受权威。

## Contracts

以下六节保留全部原文，只改变标题层级和相对链接；`SRA-C-001` 至 `SRA-C-006` 不重命名、不复用为其他含义。

<!-- BEGIN SRA_SOURCE_CONTRACTS -->
### 1. 受托角色定义、登记与撤销（SRA-C-001）

Owner 决定长期边界及重大新决策；受托维护者负责获准范围内的正式接受；Release Captain 负责标准可恢复发布的逐单签发；执行 Agent/ITOps 负责获准操作；QA/独立 verifier 负责独立核验。复用现有 HR、Root、ITOps、QA、Issue、PR、Mandate、Runbook、Receipt，不另建审批平台。

**Release Captain 资格必须同时满足：**身份可归属到具体 principal/session 与现有授权登记，具备读取适用权威、审阅实际 installer/闭包/回滚证明、判断 UNKNOWN 和 STOP、理解实际执行入口与收据的能力；独立于本单候选或 installer 的实质作者，且不兼任本单生产 writer 或独立 verifier。相同 UID 不是独立性证明；只写角色名或自报身份不合格。各角色与独立性须有可复核记录。

首任候选是**监管会话（uid 502，DISPATCH-REGISTRY 台账归属）**。来源为 `$.history[round=sra-v1-draft-dispatched]`（观察索引 660），`actions[1]`，2026-11-07 14:44，规范化子记录 SHA256=`0498d4a65f2eb5d66cc3ec686a377ccbbbc3a779d79460a7ba6569233dc004e5`。这是提名，尚非任命；精确 principal/session 尚未在本任务证据中确认。不得用历史 `reviewer_session.id`、uid 502 本身或当前执行 Agent 的身份补造任命。

任命由现行体系中有权授予该角色的 Owner/明确受托维护者登记，不能由候选自授。复用已有台账/PR 中的一条可归属记录，至少包含：

| 登记字段 | 强制内容 |
|---|---|
| 授权者与依据 | issuer 的真实 principal、明确授权来源/范围及可追溯坐标；本 SRA accepted revision 和生效记录 |
| 被任命者 | Captain 的 principal/session、UID、台账归属；必要的跨 session 身份延续证明 |
| 可签范围 | 本仓、既有单一 fleet runtime、标准发布类、排除项；不得转委托或自行扩域 |
| 有效期 | 明确的 UTC `validFrom`、`validUntil`；未知、缺省、无限期均不得生效 |
| 能力和独立性 | 实际入口/收据消费与 STOP 能力证据；与单次作者、writer、verifier 的职责分离 |
| 控制绑定 | 现有执行控制如何验证 issuer/范围/时效/撤销及 Mandate；绑定入口版本/hash、资格收据 |
| 生命周期 | 任命 ID、登记时间、登记者、续任/替换/撤销来源及生效时间，保留历史 |

更换 session 或 worker 本身不重新请求已经给出的边界决定，但必须证明新 actor 属于原授权身份及范围；不能证明时暂停其签发能力，由原责任链补齐登记。续任必须有新的明确期限，不默认延长。

Owner 或原有权任命者可在同一登记链撤销/缩窄委托，记录 actor、时间、范围、理由和受影响 Mandate。每次签发及每个依赖生产写入边界均重核有效期与撤销状态；过期/撤销后不得启动新窗口或新写入阶段。在飞操作保留 phase、mutex、UNKNOWN，按当次已批准的安全停止/恢复配方处置；撤销不自动授权 kill、回滚或重放。替任不得夺锁、覆盖旧记录或追认既有未知部署。

### 2. 签发范围与标准发布判据（SRA-C-002）

Owner V2 §3 的委托限于期限和范围明确的 SRA 下，Captain 签发符合 accepted Contracts 的**标准可恢复生产发布**。全部下列判据成立才可归类 `STANDARD_RECOVERABLE`：

1. 候选语义在实际 main 已接受的 Contracts 内，来源和接受可追溯；无未授权长期语义、身份、认证、权限或产品边界改变。
2. 复用现有完整 Execution Mandate / Runbook 框架，只作用于已获准的单一 fleet runtime 面；现有执行入口已经合法准入并能强制执行本次限制。
3. app、harness、Node/平台、实际 installer/完整闭包、预期旧版与生产身份精确绑定，全部适用兼容门、回滚及负向证明可核验。
4. 一次有界窗口、一名 writer、独立 verifier、明确 UTC 期限/最大尝试、完整 effects 和恢复路径；不以全局清 fence、业务快照回灌或重放作为恢复手段。
5. 符合 §4：停机后旧 runtime 和已派发外部操作终止或有效隔离；stage10 结束停机 containment 后，只恢复原有合法自然准入。

非标准排除项包括：bootstrap 后仍需全局暂停；新语义/危险迁移；任何扩权、跨域、首次新 runtime/目标面；新装或激活 controller/profile/trust root/setuid helper；改变运行身份/认证策略/Node 架构；无法安全回退或超出已定发布策略的重大风险。Captain 不得以本 SRA 签发这些类。缺少普通资格材料不等于新产品决策，按 §5 自行补齐后重判；真实非标准需求则明确其机制/权限缺口和适用的 Owner 升级类别。

本 SRA 不把一次发布与业务状态恢复、控制器/profile 升级合并。不授予 Router 写 Scheduler 的权力，不授予清除他人 fence/锁、Secret/Grant 变更或真实业务重投。DCP V1 的 source implementation 接受不证明其 controller/profile 已在生产激活；不得借 SRA 绕过独立 bootstrap/adoption 和权限边界。

Captain 签的是**每单完整、精确、可审查的 Mandate**，不是概括性的“可发布”口令。冻结的合法候选不因无关 main 前移、新 commit/session/window/PR/worker 自动要求 Owner 重批；仍须影响复核。相关接受权威、候选语义、闭包、当前状态或安全条件变化时，重核失效的门并更新精确绑定；不可将旧 PASS 贴到新 tuple。

### 3. 每次签发的强制门 checklist（SRA-C-003）

抽取来源为 [W7 Mandate 十节快照](../reports/sra-v1-draft-20261107/EXECUTION-MANDATE-W7-DRAFT.source.md)，SHA256=`ffe1088eca1df5b63ae8e1a4e4897d5c390aa38cf76021fcc45e323fad96c911`。下表的来源节号均指该快照；W7 的 `DRAFT_NOT_ISSUED`、`NOT_SELECTED_NOT_QUALIFIED` 只是该来源时点状态，本任务没有核验后来的 installer 资格件，不能宣称当前已合格或仍未合格。

**签发前材料门与执行边界事实门分开记录。** Captain 签发前必须逐项核验下表规定的当时可得资格、范围、证据坐标和后续强制阻断；不能把未来 05/07/10/11/12 的结果提前填 PASS。窗口内证据只能在指定边界 fresh 取得，记录 `NOT_EXECUTED / REQUIRED_AT_STAGE` 和取得方式、责任人、失败出口；这不是豁免。缺少签发前必需材料不得签发，缺少执行前必需事实不得越过对应阶段。未来事实不明不能用“Captain 已签”替代。

每门 receipt 都绑定 `gateID / target / authorityRevision / candidateTuple / method / environment / observedAtUTC / actor / command-or-operation / rawRC / evidencePath / sha256 / result / limitations`，给 verifier 可读取的坐标。涉及 Secret 的前镜像只在既有私有授权面保存，对外保留脱敏清单、hash、受权 verifier 的可复核收据；不通过公开 Secret 证明 reviewability。hash 只识别内容，不证明资格、身份或执行。

| 门及来源 | 签发前必须核验什么、证据坐标要求 | 执行到边界的 fresh 事实与失败出口 |
|---|---|---|
| G01 合法委托与范围（§1/9/10） | SRA accepted revision、生效收据、Captain 任命/撤销 selector、身份/独立性与有效期；当次 `STANDARD_RECOVERABLE` 判定和完整 Mandate 最终 hash；无自签 | 00 前及后续写入边界验证控制识别同一授权；不被现行体系承认或控制不可执行即 NO，不创建有效 authority JSON |
| G02 精确候选及旧版（§1；§5/02） | app commit/tree、harness commit/tree、固定 Node binary/platform/hash、source→artifact manifest/stamp、expected old SHA；最新合法生产观察的时间/来源；候选接受坐标 | 02 核 exact PID/UID/GID/lstart/plist/env/Binding/helper 和旧 SHA；不用历史 PID7188。UNKNOWN/漂移停，不现场切身份 |
| G03 installer 与闭包资格（§1/2 K10、K26–30；§5/01、03；§7/8） | **实际执行** installer SHA256、完整 bundle manifest/custody、逐文件/hash、限定效果和资格回执；lock/tarball/seed；源→装配→scratch byte/link/mode 与双启动；SDK/optional package/20项x64 seed 全实际 nonzero regular bytes、lstat no-follow census；真实 stamp writer→reader→reuse→backup 兼容 | 01/03 重核封印、工具收据消费及限定清洁；旧 W6、stock hash、单次 import、旧 R5 PASS 不能替代当次资格；缺成员/不兼容停止安装，不临场补包/伪造 stamp |
| G04 保留行为与实际 consumer（§2；§5/03b） | 当次 behavior-map revision/hash、每项 RETAIN/RETIRE/MIGRATE/TEMPORARY_BRIDGE 的实际消费者和依赖；配置握手及必要 consumer 的测试收据；不以 #646 替代 pause/auth | 03b 对真实形状的授权脱敏 Workflow 历史词汇、Router/Scheduler 各自 reader、auth 实际 producer→consumer/aud/scope 验读；不改事件凑兼容，不将空 fixture 当生产副本 |
| G05 E01–E17 effects（§3） | 实际 installer 逐路径/行号效果、附属 plist/env/directory/backup 清单；全成员/逐叶 preimage、postimage、restore-verification 的配方/路径/hash 与覆盖资格；不能只覆盖 live+R2 冒称全量 | 06a 在旧 runtime 仍活时取得当次每叶存在性、UID/GID/mode/mtime/link/ACL/xattr 和完整可恢复前态；bootout 前缺一即停。09/恢复后核后态与恢复证明，不扩大 chmod/chown |
| G06 状态、认证与 fence 兼容（§2/4；§5/03b；§9） | 当前 recovery-v3/jobs-v3/Workflow 副本的合法来源、时间/hash、真实 reader/oracle 版本/方法和结果；按 Agent fence/既有认证不变的覆盖；V3-aware rollback 路线 | 03b/06 及 bootstrap 前核当前 schema/Agent/Binding 与 auth consumer；旧 UNKNOWN 保留。V3 提交后禁 downgrade、strip 字段、旧业务快照覆盖 |
| G07 writer、verifier 与互斥（§3/5/9/10） | 唯一 writer principal/UID/登记坐标、非作者独立 verifier 身份与职责、真实收据解析/核验入口版本/hash 和能力证明；环境、权限范围和 mutex 方案 | 00 确认只持本人 mutex；各边界 verifier 可达可读。缺 verifier/冲突 writer 停，不夺锁、不清他人锁、不接受字符串 PASS |
| G08 窗口、尝试、预算（§5/9/10） | windowID、UTC validFrom/Until、每动作最大尝试、精确命令、总期限/各阶段/恢复可达性证据；本框架 install/bootstrap 各最多一次；预算须实际可实现 | 00/各阶段重核时效。W7 建议 05→11 为20min/硬上限30min、恢复30min/累计停机申请上限60min、HR另600s；不可无证明承诺 SLA。超时停，不推 child 已终止，不重装/第二 bootstrap |
| G09 full rollback preimage（§3；§5/06a、06；§6） | 完整 app/harness/node-runtime/.cache/config/home/generations、plist/env/identity、全部 E01–E17/树外 effects 的复制及恢复方案；实际 helper 覆盖资格与容量/时间证明 | 06a 旧 runtime 仍活时封印本次 `rollback-preimage.json`、source→copy→source inventory/ACL/xattr，`preparedBeforeBootout=true`、`businessSnapshotRestoreAllowed=false`。06 仅复核，不停机后临时复制 |
| G10 quiet、停机及已派发 effects（§4；§5/04、05） | quiet 观察、一次 bootout、exact worker/tool/effect census 与隔离/拒绝边界的合法方法、收据位置和必要权限；恢复前的并发排除证明 | 04 mtime≥180s、可读 census/日志稳定，允许非空；不能结算制造 quiet。05 后 supervisor/exact旧进程/ports 消失且旧 workers 和已派发写/投递操作终止或有效隔离有正证；PID absence/EMPTY/取消请求不证明 remote cancel |
| G11 05b exact settlement（§4；§5/05b；§8） | current epoch、agent/handle/attempt/generation、exitObservedAt、可信 exit_wait succeeded/child_real_exit 的正反例方法与 exact operation/commit/readback 收据 | 05b 只处理无冲突 exact 记录，只解除其拥有域合法 fence contribution；保留其他贡献。禁批量结算、推断结果、重放、重新投递。CAS/第二writer/内存部分失败不发布；rename/readback 不明则 mutationTruth=UNKNOWN→停 |
| G12 安装及最终组合（§5/07–09；§6） | 精确 W/argv/source/payload、installer+tee 分别真实 rc 的采集；本次 BAK/reuse marker/section5b/installLog 及 failed/success rollback 收据模型 | 07/08 核实际 rc0 和本次 unique BAK/§5b/closure；started/interrupted 不二次 install。09 核 bytes/link/mode/ACL/config/Node外部依赖、effects 前后/恢复、stamp/必要 consumer 与同一 sealed tuple；缺证 bootstrap 前停 |
| G13 stage10 边界（§5/10；§7；Owner §4） | §4 的标准类字段完整、前置证据取得和拒绝配方；plist 仅 deployed SHA；一次 bootstrap 与25s稳定方法 | 所有 bootstrap 前置事实 PASS 才结束停机 containment；如还需全局 pause 而未证明跨 restart 全入口机制，STOP 于 bootstrap 前。失败不重试，先核新实例/worker/effect 隔离 |
| G14 live 验证及自然HR（§5/11、12；§7/9） | 指定独立新 PID/SHA/env/UID/GID/listener owner、公开 health/capability（W7为50 HTTP/19 local）、Scheduler ready 的 readback 方法；自然 HR 完整600s观察法，不人为触发 | 11 必需 readiness 独立核验；auth 只写实测，未证仍 UNKNOWN。12 新PID稳定且可归属新HR broker execute 才过该门；没观察写 HR_NOT_OBSERVED，不重投，不从 health/ACK 推业务完成 |
| G15 STOP、回滚和终收据（§5/13；§6/9/10） | 每阶段 STOP/恢复入口、attempt/权限、失败树保全与恢复证据；§5 的字段、独立 post-state、所有门/UNKNOWN矩阵；retention只列不删 | 13 未齐不宣布成功。install前只在原树完整/无并发且获准时一次old bootstrap；started/interrupted 先核真实child/log/mutation；失败/成功回退各用本次收据。R1只本次marker允许子树；R2只两精确树GID20、不改UID/mode/内容；完整旧closure+当前状态兼容/metadata恢复后才可获准old bootstrap |
| G16 负向矩阵和证据复用（§8及§1–10限制） | 错epoch/null exit/竞争writer/partial settlement/bootstrap失败/旧v2 reader等必需拒绝场景的 test/fixture/tuple/version/hash/rc/限制；未变证据通过实际影响复核重绑定 | 变更影响门则重验受影响项；不能从历史75ece/R5隔离 PASS推出当前生产 PASS；不可为凑活动重跑未失效门；未知不填0或PASS |

E01–E17 的精确路径和 metadata 以上述 W7 §3 快照作抽取来源，每单再绑定实际 installer 和合法清单。至少保留：E05 递归树排除 E07/E08；E06 只能是指向 `/usr/local/libexec/agent-core/config/agents.json` 的同目标 symlink，普通/未知 authority 文件不删；E07/E08 当次已存在且 GID20，RESTORE-R2 只重申两树 GID20、UID/mode/内容不改；E09/E10 只根 metadata、不递归接管 Agent 子树；E13/E14 reuse 也核 metadata；E15 只权限、不改/露 Secret；E16 实际 JSON 逐名私有清单；E17 root:wheel 且仅根0700。缺少任一实际 effects 前态/恢复覆盖不得进入 bootout。

本框架保持阶段顺序 `00→01→02→03→03b→06a→04→05→05b→06→07→08→09→10→11→12→13`。改阶段、效果、尝试或安全失败语义不得靠签发时口头豁免。签发前、每个受影响依赖边界与最终收据分别保存判断；隔离机制、生产加载、认证能力、历史恢复、业务完成分列，任何前者不自动证明后者。

### 4. stage10 通用原则及 Mandate 字段（SRA-C-004）

Owner V2 §4 原文语义为：**标准可恢复发布在旧 runtime + 已派发外部操作终止或有效隔离 + 全部技术与合同门通过后，stage10 bootstrap 可作停机 containment 结束点；只恢复原有合法自然准入，不清历史 UNKNOWN、不绕 fence、不重放、不放宽认证；需 bootstrap 后继续全局暂停的发布属于非标准类，须另行证明机制。**

“全部门通过”在 stage10 指到该边界应完成的全部适用技术、合同、安全及兼容门；11/12 的后续 live 验证必须已有强制执行/失败出口，尚未执行不能被预先宣称 PASS，也不能在后续失败时宣布整窗成功。

每单 Mandate 必须明确填写以下字段并由现行执行控制验证。字段表是要求，不是本轮生成的 authority JSON：

| 字段 | 标准类要求 |
|---|---|
| `releaseClass / issuerRef / sraRevision / appointmentRef` | `STANDARD_RECOVERABLE`；合法生效 SRA、Captain 身份/范围/有效期/未撤销证明 |
| `stage10.containmentEnd / admissionAfterBootstrap` | `true / EXISTING_LAWFUL_NATURAL_ONLY`；现有各域 admission/fence/auth consumer 保持有效 |
| `oldRuntimeTerminationOrIsolationRef` | exact旧runtime/worker/epoch 与所有已派发 tool/write/delivery/effect 边界终止或有效隔离正证据；单纯停 supervisor 不够 |
| `preBootstrapGateRefs` | §3 到09的全部适用 fresh PASS 证据，包括 full preimage/效果/状态/认证/闭包/回滚兼容，无缺失/冲突 |
| `deployedSHA / plistRef / bootstrapMaxAttempts` | 精确已装载候选绑定；plist只deployed SHA；1次bootstrap，记录真实rc及25s稳定证明 |
| `historicalUnknown / fences / authentication / replay` | `PRESERVE / PRESERVE_DOMAIN_RULES / UNCHANGED / FORBIDDEN`；不清他人/全局 fence，不放宽disabled域，不补跑错过slot |
| `postBootstrapGlobalPauseRequired` | 标准类必须 `false`；如为true则非标准，本SRA拒绝签发 |
| `postBootstrapVerificationAndFailureRefs` | 11/12独立readback及HR观察、bootstrap失败/后续失败时exact新worker/effect隔离、STOP/恢复收据和授权范围 |

如果要求 bootstrap 后仍零准入，而旧 pause 文件在新 runtime 无真实 reader/checkpoints，必须在 bootstrap 前 STOP；不能“先开再停”，不能把配置文件存在、响应抑制或一条字符串当作跨 restart 全入口零准入证明。非标准需求先证明机制并取得其适用授权，不能由 Captain 以标准类豁免。

W7 来源 §5/§7 的“未来 Owner 明确批准 stage10”是其未签发状态的原要求。本机制只有在 §6 合法接受、生效且真实控制识别后，才允许有权 Captain 按本标准类原则在**新的完整当次 Mandate**中签发这一边界；不是修改或追认旧 W7 签名。本任务不改原 W7、不运行 stage00、不创建 authority JSON。

### 5. 失败处理、原责任链补齐与 Owner 升级（SRA-C-005）

Owner V2 §5 授权普通缺陷、测试失败、installer 未资格、构建不兼容、缺证由原责任链自行补齐重验。操作纪律如下：

1. 当场冻结受影响依赖操作，保存真实 phase/rc/候选/环境/证据和 `affected_readiness=NO`；不把未执行、未知、失败互相替换。
2. 按现有 Issue/PR/Mandate/Runbook/Receipt 指回原负责角色：候选作者修缺陷；installer/闭包责任人补资格；ITOps 补合法前态/恢复覆盖；QA/verifier 补验读/独立readback；Root/治理维护者补身份、既有权限登记和控制适配证据。继续无依赖的已授权修复，不另开第二审批链。
3. 写清最低缺件、可执行下一动作、责任人、禁止依赖边界和证据坐标；状态用 `BLOCKED_REQUIRED_EVIDENCE / REPAIR_IN_PROGRESS / READY_FOR_RECHECK` 等真实原因，不把普通修复停成 `WAITING_OWNER`。这些标签本身不创造授权。
4. 修复后复核变更及失效依赖，保留仍有效证据，按候选和当前base实际影响复核；独立审查通过与正式接受分开。新 SHA 或换 worker 本身不产生新 Owner 请批。
5. 原因解除、当次有效期/attempt/actor/控制和所有适用门满足才继续。`outcome_unknown`、未知 install/bootstrap 或外部效果不明时，先证明 exact child/tool/effect 终止/隔离并按原 Mandate 对账，不能盲重试、换ID、清锁、清 fence、覆盖业务快照或回放。

仅以下四组升级 Owner，提交具体反例、受影响边界、已有授权及最小决定：

| 升级组 | 触发事实 | 原责任链仍可继续的工作 |
|---|---|---|
| O1 未授权语义变化 | accepted 长期含义必须新建、修改或 supersede，超出既定决定；不能把 §2 继任委托扩大为任意新权威接受 | 只读诊断、docs-first提案、既有范围内隔离修复 |
| O2 危险迁移 | 需要破坏性/不可逆数据迁移或安全状态回退；例如已写V3仍要求V2降级 | 保留当前业务状态、构建V3-aware安全方案与离线证据 |
| O3 扩权 | 新controller/profile/trust root/特权helper、运行身份/目标/跨域/认证或Grant边界扩大，或当前actor确无所需接受/任命权限 | 检索既有授权、准备精确scope/效果/控制方案；不得自授或先启用 |
| O4 无安全回退或超策略重大风险 | 证明无法安全恢复，或发布风险超过既定策略；包括标准路径无法满足的必要bootstrap后全局pause | 收敛非标准机制证明/替代可恢复方案，不强行按标准类签发 |

网络瞬断等普通失败按已有重试授权处理，记录每条路径实际 rc；本任务 R2 明确允许重读远端，push 如遇同类瞬断仅再试一次。这个任务级重试边界不改变未来生产 install/bootstrap 的 attempt 上限。若写操作远端结果不明，先读回确认，不把连接断开当作远端未写。

STOP/恢复收据至少包含 `window / writer / stage / UTC / rawRC / install_state / stop_state / exactChild / mutation_truth / affected_readiness / evidenceHashes / lastRealAction / nextSafeAction`。保留 mutex 和证据，不自动恢复/重试/切身份；仅当当次安全终态得到证明并满足原释放条件时释放自己的 mutex。缺可执行控制时不做生产依赖操作；原责任链先核已有合法机制，确需新权限才归 O3，不凭本稿新建平台。

### 6. 合法接受、生效程序与验收（SRA-C-006）

依 Owner V2 §2，Owner 已决定且语义无实质变化的规范继任，可由**明确授权、可归属、独立于作者**的维护者按现行规则正式接受；必须先核身份、权限、委托范围、可接受 Spec 类型。独审 PASS 不自动接受，执行者不得自我签发。本 SRA 是新增委托机制，不能仅用“既定继任”四字推导任何维护者已有接受新机制的权限。

本稿进入现行本仓程序，不发明第二接受渠道：

1. **草案提交。** docs-only PR 以 `main` 为 base，冻结来源、候选 commit、六节语义、开放事实和零生产边界。本轮到 PR 为止，不接受或合并。
2. **非作者独立语义审查。** reviewer 明确未创作受审语义，绑定 reviewed commit/base，覆盖 SRA-C-001..006、Owner六条、W7十节适配、负向反例与现行权威；记录 blocker union。修复后审查受影响delta，最终head即使只含收据变化也做独立delta复核；未通过不得接受。
3. **有权维护者正式接受。** 按 `.agents/local/README.md`，接受者为 `mayf3` 或在 PR 明确获授权的维护者；其权限必须明确覆盖**本机制/此类规范**，可归属且独立于作者。核对授权来源、principal、scope、期限和撤销状态，持久登记 accepted-by/at、授权坐标、reviewed commit、最终 accepted head。若既有委托足够，由原责任链补全记录；若确无此权限，归 §5 O3，不能从独审PASS或提名补造。
4. **main 接受与生命周期落地。** 有权者在独立受控的 docs-only 接受事务中将正式权威存入现行治理位置（本仓 governing Spec 位置为 `docs/specs/`），登记发现入口并将本草案链接到唯一正式权威；`proposed→accepted` 和最终接受head绑定齐备，合入 main 后才成为本仓接受权威。保留草案/审查/收据，不保留两个可独立生效模型。本轮不修改治理索引、accepted状态或现行禁令。
5. **委托实际生效。** 另核 §1 任命/UTC期限/撤销链、§2 范围、现行授权体系对该委托的承认，以及真实执行控制能拒绝未任命/越界/过期/撤销/候选漂移/缺门的签发或写入。绑定实际入口版本/hash、控制所有者、负向资格和独立verifier回执。只有全部成立才能登记 `EFFECTIVE`；只有接受、只有merge、提示词、自写JSON或hash均不足以生效。此步不授权新装controller/profile或权限扩张。
6. **逐单签发和终止。** 生效后，每单仍依 §3 完整 Mandate、§4 stage10 和 §5 STOP；条件全过由有权 Captain 签发，不逐单重复请批。不合条件即停依赖操作、原链补齐。任命过期/撤销或控制失效则停止相应签发/写入资格。W7 是生效后可能的首单标准发布，仍须重新核当次事实与完整 Mandate，**不自动签发**。

以下为本稿的 Contract→Acceptance 对照。方法均为非作者文档/权限证据审查；环境为精确 docs 候选+main基线。运行时控制和窗口结果须另在合法授权环境验证，不在本稿虚称已执行。

| Contract | 验收方法与必需证据 | 通过预期 | 失败反例 |
|---|---|---|---|
| SRA-C-001 | 核角色/任命字段、台账提名、任命/续任/撤销及身份延续负例 | 候选与任命分开；可归属、明确期限、职责独立；缺登记不生效 | 用uid502或历史reviewer_session直接当已任命Captain |
| SRA-C-002 | 用accepted范围、既有runtime和可恢复证明逐项分类；核DCP边界 | 只签标准类；非标准拒绝；不激活新控制面 | bootstrap后需全局pause却以标准类签发；新controller借SRA启动 |
| SRA-C-003 | 核G01–G16对W7十节覆盖、每门对象/坐标/时点/失败出口及E01–E17 | 签发材料门齐，未来事实保留未执行；依赖动作前fresh核验 | 用R5 PASS代替当次installer资格；缺06a full preimage仍bootout |
| SRA-C-004 | 核Owner§4和stage10字段、precondition及后续验证；测非标准反例 | 仅恢复合法自然准入，保留UNKNOWN/fence/auth、不重放 | 用EMPTY或PID不在证明remote effects停止；先bootstrap再补pause |
| SRA-C-005 | 对普通失败、未知写入、四组升级逐项桌面推演并核收据字段 | 原责任链补齐、受影响readiness NO；不盲重试、不一律WAITING_OWNER | installer未资格一律请Owner；curl断开后不读回就重放未知生产写入 |
| SRA-C-006 | 核独立review、受托接受权限、reviewed/final head、main落地、任命及控制资格链 | 草案/审查/接受/生效/单次签发可分辨；W7未自动签发 | PASS当接受；§2继任委托无限扩展；PR创建或merge当生产许可 |

```text
CONTRACT_COUNT = 6
CONTRACTS_WITH_ACCEPTANCE = 6
PARTIAL_SUPERSESSION = NONE
NORMATIVE_TBD = NONE  # 参数的必填及拒绝规则已定义，实际任命/期限/控制证据尚待合法绑定
OPEN_OWNER_DECISIONS_FOR_THIS_DOCS_AUTHORING = NONE
AUTHORING_READY_FOR_REVIEW = YES
ACCEPTED = NO
EFFECTIVE = NO
OPERATION_ALLOWED = NO
NEXT_ACTION = INDEPENDENT_REVIEW_THEN_DOCS_PR_ONLY
```
<!-- END SRA_SOURCE_CONTRACTS -->

## Acceptance

原 §6 的 Contract→Acceptance 表为六个合同的唯一验收映射；原文方法为非作者文档/权限证据审查，环境为精确 docs 候选+main 基线，表中逐项规定必需证据、通过预期及失败反例。六项全覆盖；运行时控制与窗口结果仍须另在合法授权环境验证。

## Alternatives and disposition

无新增替代方案或决定。原 §1 排除自授/虚构身份，§2 排除非标准类和控制面激活，§4 排除未经证明的 bootstrap 后暂停，§5 排除盲重试，§6 排除 PASS/merge 自动产生接受或生产许可；均保留原处置。

## Migration, compatibility, and rollback

这是现有草案的唯一正式 governing Spec 载体，`supersedes: []`；原草案及来源/审查/STOP 收据保留为历史证据。接受事务登记索引和草案至本文件的发现链接，不产生第二个可独立生效模型。生产兼容、回滚与 UNKNOWN 边界完整保留于原 §2–§5；本次无运行迁移或生产回滚。

## Open questions

规范参数的必填及拒绝规则保持原 §6，`NORMATIVE_TBD = NONE`，本次 docs 接受已有 Owner 裁定。实际任命/身份、期限、控制资格与每窗事实仍是原文要求的操作前置事实，不在本转换中填造；未齐不任命、不生效、不签发。accepted 状态仅在指定 main 收入精确内容后成为本仓权威；merge 由监管在独立最终 HEAD 审查 PASS 后执行。
