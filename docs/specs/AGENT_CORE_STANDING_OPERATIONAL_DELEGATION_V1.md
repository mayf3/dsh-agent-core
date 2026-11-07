---
spec_id: AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1
status: proposed
spec_kind: invariant
authority_level: governing_spec
implementation_authority: none
production_apply_authority: conditional_controlled_operation
production_apply_conditions: >-
  The framework grants no operation by its existence. Original sections 4/5/8
  require separate appointment, control effectiveness and a complete single
  Mandate through the accepted SRA. This docs-only transaction performs none.
scope:
  - mayf3/dsh-agent-core formal record of the Owner standing delegation framework
  - existing lawful responsibility chains across the four repositories named in original section 1
  - Spec acceptance, Captain identity and SRA release control bindings
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3
  - AGENT_WORKSPACE_SESSION_MODEL_V3
  - SCHEDULER_OCCURRENCE_OUTCOME_V3
external_authorities: []
supersedes: []
superseded_by: null
owners: [mayf3]
semantic_source_ruling: owner-20261107-standing-delegation
semantic_source_selector: $.rulings[id=owner-20261107-standing-delegation]
semantic_source_canonical_sha256: 01cc059c2bf0e0493588f00032ca06eb73e3a0a13cb33f4078996fdccb79dad3
semantic_source_snapshot: docs/reports/standing-delegation-formal-20261107/owner-ruling.json
authoring_base: 24974c720d634b965943e08bfd0862657b9be0e1
activation_boundary: main merge after independent final-HEAD review; operational effectiveness additionally requires original section 8 control binding
---

# Agent Core Standing Operational Delegation V1

<!-- BEGIN SOD_LIFECYCLE -->
> 当前为 proposed 格式转换，等待非作者独立审查和 Owner 授权接受事务。
> 接受权威是 Owner mayf3 的八节裁定本尊，转换作者 `/root` 只是事务执行者。
> main 激活、Auth 主体建立、Captain 任命、控制生效和单窗签发是分别核验的事实；本轮只有文档。
<!-- END SOD_LIFECYCLE -->

## 1. Goal

把 Owner 已作出的常设授权总裁定逐字转为本仓唯一正式 governing Spec 载体，并按原 §8
连接现有 Auth、Spec 接受及发布入口的控制核验。消除重复授权的决定来自原裁定；本文件
不借格式转换增加决策空间。原八项逐字保存在 §9；下文“原 §n”均指第 n 个源项。

## 2. Scope and non-goals

原 §1/§2 记载四仓长期委托范围，本文件是该裁定在 `mayf3/dsh-agent-core` 的正式记录；
不将本仓 PR 当作其他仓库已完成接受、代码加载或控制适配的证据。
本任务限 [Owner Brief](../../BRIEF-DELEGATION-FORMAL.md) 的 docs-only 面：不改产品源码，
不创建 Principal/Client/Secret/Grant，不任命 Captain，不签发 W7/窗口，不运行生产或合并 PR。
`implementation_authority: none` 限于本总框架本身；原 §3B 对配套 implementation-authorizing
合同的接受委托逐字保留，并不在本轮把任何配套权威改成 `contracts`。

## 3. Authority and dependencies

原件、唯一 selector、时间、canonical 算法、整条 ruling 及逐项 UTF-8 SHA256、固定 base
和控制源码 blob/hash 见 [source-provenance](../reports/standing-delegation-formal-20261107/source-provenance.json)。
[选中原文快照](../reports/standing-delegation-formal-20261107/owner-ruling.json) 是来源证据，
快照或台账状态不能代替本仓接受程序，也不能单独证明操作授权生效。

受本仓 [local governance](../../.agents/local/README.md)、Product Architecture、D-008/D-009
及现有 accepted 安全边界约束。原 §3/§7 的受托接受不允许重写旧 stable ID 原义；
需要整权继任时仍按现行 docs-first、独审、接受事务和互斥回链程序。

本框架与 [SRA V1](AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1.md) 互补：前者记录总委托，
后者保持标准发布子机制及其完整 G01–G16 门、任命和逐窗 Mandate；`supersedes: []`，
不 supersede 或修改任何现有权威。原 §4 的 canonical Principal 决定不把 SRA 历史提名
变成已任命事实。[DCP V1](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md) 的
`production_apply_authority: none` 保持；不激活新 controller/profile/trust root。
§3B 列举的 #643/#655/#657/#658 只是原决定原文，不证明各候选已接受、配对或可实施；
#643 的现行限定接受与配套 WEC/Svc 前置保持，详见 provenance 的 Base movement。

## 4. Current State

`STATE-SOD-001` — Subject: 本次正式化工作面；as_of_commit: `24974c720d634b965943e08bfd0862657b9be0e1`；
environment: 隔离 worktree `/private/tmp/h-delegation-formal`；observed_at: `2026-11-07T15:03:30.507148+00:00`；
basis: `OBS-SOD-001/002/003` 及 provenance。源 ruling 有八项，指定正式 Spec 尚未存在于
该 base。控制点状态是文档/源码查证结果，不是生产验证或 Captain 任命结果。
本候选当前生命周期见 frontmatter 和接受事务，后续状态不可倒灌到上述观察时点。

## 5. Observations

- `OBS-SOD-001` — Subject: Owner 八节原文；source: provenance 中唯一选中 ruling，
  canonical SHA256=`01cc059c2bf0e0493588f00032ca06eb73e3a0a13cb33f4078996fdccb79dad3`；environment: 只读本地来源；
  observed_at: `2026-11-07T15:03:30.507148+00:00`；method: JSON exact id selector、唯一性检查和逐项 SHA256；
  result: 唯一记录、八项；provenance: source-provenance 和原文快照。
- `OBS-SOD-002` — Subject: 本仓治理和接受事务先例；source revision: 上述 base，另核远端
  main `9df5bd2fdea17f04bcd1762cd6800c350efcf9c3`；environment: docs worktree/GitHub 只读；observed_at: 同 provenance；
  method: 固定 Git 对象与 #648/#643 回执；result: 接受者可为 mayf3，worker 不成为接受权威，
  reviewed/final HEAD 和 main 激活分开；provenance: conversion-receipt 与 source-provenance。
- `OBS-SOD-003` — Subject: Auth/Spec/window 控制；source revision: 上述 base；
  environment: 本地源码/权威只读，无生产调用；observed_at: 同 provenance；method: 精确文件/行查证；
  result: 通用身份读取已有源码，Spec 为手工政策，window helper 未消费 SRA G01 授权链；
  provenance: [控制绑定清单](../reports/standing-delegation-formal-20261107/control-bindings.md)。

## 6. Claims and assumptions

- `CLM-SOD-001` — 八项裁定的转换语义差量为零。Support state: `SUPPORTED`；
  evidence: `EVD-SOD-001`；uncertainty: 逐字检查仅覆盖转换，正式接受还需非作者独审。
- `CLM-SOD-002` — 本次文档接受不证明实际委托控制已生效。Support state: `SUPPORTED`；
  evidence: `EVD-SOD-002`；uncertainty: 未检查生产，具体主体/任命/运行资格保持未验证。
- 没有新增规范假设；实际 UUID、Session、任命、生效和单窗事实是待合法核验的事实，
  不能用假设填充，也不阻止本次 docs-only 记录已决定的语义。

## 7. Evidence relations

- `EVD-SOD-001` — Source observations: `OBS-SOD-001/002`；Target: `CLM-SOD-001`；
  Relation: `SUPPORTS`；Bound coordinates: ruling canonical hash、逐项 hash、proposed Git commit
  和独审 reviewed HEAD；Strength/sufficiency: 八项反提取逐字相等及非作者语义审查；
  Limitations: 不证明生产资格；Provenance: conversion-receipt、验证原文及独审收据。
- `EVD-SOD-002` — Source observations: `OBS-SOD-003`；Target: `CLM-SOD-002`；
  Relation: `SUPPORTS`；Bound coordinates: 控制清单固定源码 blob/hash、观察时点；
  Strength/sufficiency: 足以区分政策要求与现有消费逻辑；Limitations: 未执行运行时负向测试，
  不声明具体部署状态；Provenance: control-bindings 与 source-provenance。

## 8. Decisions

不新增 Owner 决定。`DEC-SOD-001` 记录原 §1/§2 的长期委托和既有链复用；
`DEC-SOD-002` 记录原 §3 的 A/B/C 接受范围和独立性；`DEC-SOD-003` 记录原 §4/§5 的
canonical 身份、条件任命及 SRA 单窗门；`DEC-SOD-004` 记录原 §6/§7/§8 的自主补证、
四类升级、职责分离及实际控制绑定。Decision owner: Owner mayf3；决定原句见下一节，
此索引不扩充或压缩决定含义。拒绝的替代与理由见 §11。

## 9. Contracts

以下八块各自逐字保留源 `items[0..7]`；只在块外增加标题、稳定 Contract ID 和来源索引。
原 §6 的“六要素”及其全部括号列项均原样保留，不在转换中编辑。规范用词保留 Owner
原中文义务表达；这些原文为本 Spec 的 MUST / MUST NOT / MAY 约束，不作强弱改写。

### CTR-SOD-001 — 原 §1（items[0]）

<!-- BEGIN SOD_SOURCE_001 -->
常设授权总裁定(八节): 既有四仓(agent-control/dsh-agent-core/svc-workflow/auth-service)的工程开发/规范接受/跨仓协调/标准生产发布/业务验收长期委托现有合法治理与执行责任链自主推进; 消除重复授权; 不新增Goal/审批平台/调度器/控制器/第二事实账本; 授权长期有效至Owner明示撤销
<!-- END SOD_SOURCE_001 -->

### CTR-SOD-002 — 原 §2（items[1]）

<!-- BEGIN SOD_SOURCE_002 -->
§2范围: 允许自主=调查/复现/修复/重构/删无效代码/测试回归+Issue创建更新关联关闭+backlog收敛+起草审查合并合规PR+Owner已决定范围的整权继任/引用更新/正式接受/旧权威退休+跨仓Core/Svc协调/独立验证/合法实施/真实业务验收+SRA下标准可恢复发布完整链+普通缺证/构建失败/installer未资格/检查器误报/版本漂移自行修复重验; 不因SHA/PR号/Session/worker/窗口变化自动生成新Owner审批
<!-- END SOD_SOURCE_002 -->

### CTR-SOD-003 — 原 §3（items[2]）

<!-- BEGIN SOD_SOURCE_003 -->
§3规范接受委托: A=既有合同修复与等价继任; B=Owner已决定语义(#643/#655/#657/#658显式列出+必需WEC/WAE/Liveness整权继任+Core/Svc配套合同, implementation_authority:contracts允许, 生产none); C=同类非扩权可靠性改进(执行身份/防重副作用/责任活性/公平调度/故障隔离/只读恢复/可观测性); 每次须非作者独立语义审查+接受者真实身份权限+reviewed HEAD+最终接受事务+互斥权威; 作者不得自我接受新增权限; 超范围产品政策变化才§7升级
<!-- END SOD_SOURCE_003 -->

### CTR-SOD-004 — 原 §4（items[3]）

<!-- BEGIN SOD_SOURCE_004 -->
§4 Captain: 批准Auth现有合法路径创建专用Principal release-captain-agent-core-20261107(canonical身份方案; 仅身份绑定, 不附赠Client/Secret/Grant/特权helper/生产写权限); 授权责任链在五条件(唯一Principal+Session绑定/能力资格/独立性/体系承认/实际控制负向)完成后任命; validUntil=2026-12-07T16:00:00Z不追溯; 续任/替换由不同有权维护者办理(新期限+新身份核验+可撤销记录, 不候选自授自续); 若现有控制不支持委托→原责任链在现有合法机制完成适配+负向验证; 生效前不得提示词/角色名/自写JSON假装签发权
<!-- END SOD_SOURCE_004 -->

### CTR-SOD-005 — 原 §5（items[4]）

<!-- BEGIN SOD_SOURCE_005 -->
§5常设标准发布: SRA accepted+Captain appointed+control effective+单Mandate issued=四独立事实; 全成立后Captain获单一fleet runtime STANDARD_RECOVERABLE签发权不再逐窗请批; 每次绑定完整清单(真实前态/精确候选harness installer Node制品/接受权威时效范围唯一writer独立verifier/installer资格效果清单真实前态可恢复证明/原进程及已派发外部效果终止隔离/UNKNOWN fence认证状态兼容/一次性install bootstrap/阶段STOP回退读回终收据); stage10仅全部前置满足后结束containment恢复自然准入; W7=机制生效后首单候选(Captain完整核验分类签发; 本裁定不直接签发W7不承认未执行门为PASS); 同窗内已授权STOP/隔离/恢复/回退按原Mandate自主; 未知外部效果先读回不盲重试
<!-- END SOD_SOURCE_005 -->

### CTR-SOD-006 — 原 §6（items[5]）

<!-- BEGIN SOD_SOURCE_006 -->
§6缺证自主处置: 普通工程问题原链自行补齐不一律升级WAITING_OWNER; 每阻塞保留六要素(原因/受影响动作/责任主体/现有授权/最小补证/下次合法触发/恢复关闭条件); 缺证只禁依赖该证的危险动作不冻结其他无冲突已授权工作; 已决定语义不因检查失败/修复提交/新reviewer/新session/main前移重复请批
<!-- END SOD_SOURCE_006 -->

### CTR-SOD-007 — 原 §7（items[6]）

<!-- BEGIN SOD_SOURCE_007 -->
§7仅四类升级Owner: 1新生产目标/特权身份/Grant/trust root/控制器profile/安全边界扩大 2不可逆迁移/破坏性删除受保护数据/解除保留pin/无可靠恢复路径高风险 3实质改变业务归属/人工决策政策/认证模型/降低UNKNOWN-no-replay-fence安全保证 4全部合法补证与恢复途径用尽后确需Owner承担新风险或业务判断; 升级只交最小差量+事实+备选+后果; 真实HUMAN_GATE走原有可信链不伪造同意不超时默认
<!-- END SOD_SOURCE_007 -->

### CTR-SOD-008 — 原 §8（items[7]）

<!-- BEGIN SOD_SOURCE_008 -->
§8执行验收与防授权循环: 复用HR/Root/Architect/QA/ITOps/Auth/Release Captain分工; 职责分离(作者不自验收/Captain不兼writer/verifier不兼被审动作作者writer/受托维护者不自造未有权接受); 责任链须将本裁定经有权维护者正式记录与实际Auth/Spec/发布入口授权控制绑定(不得仅本地台账声明生效); 一次性制度适配后同范围操作只核现行授权与执行资格; 以真实交付衡量(源码合并/实际加载/功能启用/业务见证分列+记录重复Owner审批次数与无下一动作等待责任); 禁新建平行平台/第二生产控制/第二调度/因治理延误无关交付; 本裁定=决策空间常设授权非任意未验证操作的安全证明
<!-- END SOD_SOURCE_008 -->

## 10. Acceptance

下列是每个原文 Contract 的验收定义，非运行测试已执行声明。所有项的方法环境为精确
候选/固定 main 的非作者文档审查；涉及 Auth、任命及发布控制的实际验证，须未来在
已有合法授权环境由对应责任链执行并持久绑定，当前为 `NOT_EXECUTED`。
每项 Required evidence 均含源 selector/hash、Spec revision、reviewed/final HEAD、实际方法、
actor、环境、时间、原文结果与 raw RC；运行项另含原权限收据及相关前后态，不能以本文替代。

| Acceptance | Contracts | Method | Expected result | Failure condition |
|---|---|---|---|---|
| ACC-SOD-001 长期边界与复用 | CTR-SOD-001 | 比对源 item[0] 及四仓/原链范围 | 长期至明示撤销，不建并行平台或第二账本 | 把常设授权当任意操作安全证明或新平台许可 |
| ACC-SOD-002 自主推进范围 | CTR-SOD-002 | 逐项比对 item[1] 与相关既有合同 | 普通工程/协作和已决定语义按原范围自主，不因新 SHA/worker 重复请批 | 缺普通材料即无限 WAITING_OWNER，或借自主推进扩权 |
| ACC-SOD-003 A/B/C 规范接受 | CTR-SOD-003 | 核 item[2]、非作者独审、接受者真实权限、reviewed/final HEAD 与互斥权威 | 作者不能自我接受新增权限；配套合同按合法事务接受 | 把审查 PASS 当接受，或用本框架追认 #643 配套未过的门 |
| ACC-SOD-004 Captain 条件任命 | CTR-SOD-004 | 核 item[3] 和控制清单 Auth 行；未来由原有权链取真实身份/任命/负向收据 | 只作 canonical 身份决定，五条件齐才任命；指定 validUntil，不自授自续 | 用 uid502/角色名/自写 JSON 造身份、授 Client/Grant 或追溯任命 |
| ACC-SOD-005 SRA 标准生产发布 | CTR-SOD-005 | 核 item[4] 与 SRA G01–G16/完整 Mandate；未来实际边界 fresh 核验 | 四事实独立、stage10 前置和 UNKNOWN 保留；W7 未直接签发 | 以 accepted/main merge 代替 control effective、未执行门填 PASS 或盲重试 |
| ACC-SOD-006 普通缺证自主处置 | CTR-SOD-006 | 逐字核 item[5] 的全部字段、责任主体、下一合法触发和恢复条件 | 仅停止依赖缺证的危险动作，其他授权工作继续 | 缺证全局冻结、漏责任/下一动作或因修复提交重请已定语义 |
| ACC-SOD-007 四类 Owner 升级 | CTR-SOD-007 | 逐项对照 item[6] 与真实 HUMAN_GATE 信任链 | 只有原四类触发升级，提交最小差量/事实/备选/后果 | 超时默认人工同意、降低 UNKNOWN/no-replay/fence 或隐匿新风险 |
| ACC-SOD-008 制度适配与真实交付 | CTR-SOD-008 | 核 item[7]、控制清单和分列交付证据；未来由合法控制所有者实际资格验证 | 正式记录与 Auth/Spec/入口绑定；明确源码/加载/启用/业务见证不同 | 本地台账自称 EFFECTIVE、作者自验收、Captain兼writer 或第二控制面 |

覆盖为 CTR-SOD-001..008 → 同号 ACC-SOD-001..008，8/8；不增加原文之外的授权。

## 11. Alternatives and disposition

- RETAIN：原 HR/Root/Architect/QA/ITOps/Auth/Captain 分工、原账本/PR/Issue、SRA 标准发布子机制。
- REJECT：以文档、提示词、UID、JSON 或 hash 单独制造接受/任命/生效；理由见原 §3/§4/§8。
- REJECT：因 SHA/session/window 漂移反复请 Owner；理由见原 §2/§6/§8；相关失效证据仍须核验。
- REJECT：新增平台、第二生产控制或调度、任意扩大风险承担；理由见原 §1/§7/§8。
- 无现有权威退休、MIGRATE 或 TEMPORARY_BRIDGE：本次为独立总框架正式化，`supersedes: []`。

## 12. Migration, compatibility, and rollback

本轮没有产品或运行时迁移。格式 proposed → 独立 reviewed HEAD → Owner 裁定授权的
accepted 事务 → 独立 final-HEAD 复核 → push/PR；按任务到 PR 为止，不合并。
规范在 main 落地后才按本仓规则激活；原 §8 的实际绑定及原 §4/§5 的任命/控制/单窗事实
继续各自核验。控制缺口的合法适配属于原责任链后续工作，不能由本次 docs-only 写源码。

八项原文、旧接受记录、SRA 和 DCP 原义保留；不批量重写历史，不回灌业务或清 fence。
若需撤回本候选，在原 docs PR 做 attributable disposition；未来撤销委托按原 Owner/任命链，
不因撤销自动授权 kill、回滚或重放未知外部效果。

## 13. Open questions

```text
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = NEW
PRIMARY_AUTHORITY = Owner mayf3 ruling owner-20261107-standing-delegation + accepted local governance
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_AUTHORITY = none
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 8
CONTRACTS_WITH_ACCEPTANCE = 8
PRODUCTION_OPERATION_ALLOWED_NOW = NO
```

实际 Auth 唯一主体/Session、正式任命、控制资格和运行负向证据尚未在本任务验证；
属于原链应补齐的执行事实，不能改写为新的 Owner 语义待裁。失败按 Brief 停止并写
`STOPPED-DELEGATION-FORMAL.md`。接受和交付的实际坐标见 conversion-receipt、acceptance-transaction
及根目录最终 RECEIPT；这些收据不新增规范授权。
