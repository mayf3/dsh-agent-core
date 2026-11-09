---
spec_id: AGENT_CORE_FLEET_WINDOW_AUTHORITY_VALIDATION_V1
status: accepted
accepted_by: mayf3
accepted_date: 2026-11-09
accepted_at: 2026-11-09T09:43:57.053704+00:00
accepted_reviewed_head: f3e8340af50ae74b34612704fa1c970a31980ad0
independent_review_result: PASS_WITH_TBD
independent_review_receipt: docs/reports/fleet-window-authority-v1-20261109/independent-review.md
independent_review_receipt_sha256: 1d8be0581c91bec7d7a4c8166bd62dc99c49e7e73f1e4f9a651b4982639dfa6f
acceptance_authority: Owner mayf3 standing delegation section 3C (same-class non-privilege-escalating reliability improvement: execution identity / responsibility liveness), original eight-section ruling
acceptance_authority_source: /Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json
acceptance_authority_selector: $.rulings[id=owner-20261107-standing-delegation]
acceptance_authority_canonical_sha256: 01cc059c2bf0e0493588f00032ca06eb73e3a0a13cb33f4078996fdccb79dad3
acceptance_transaction_executor: supervision chain session (regulator-side; NOT the author of the proposed spec)
acceptance_authority_basis: >-
  Owner mayf3's standing delegation section 3 authorizes the responsible chain to draft,
  non-author review, and formally accept same-class reliability improvements with the
  delegating authority's recorded semantics. The non-author independent review of the
  exact proposed head f3e8340a returned PASS_WITH_TBD with an empty frozen blocker
  union; the factual UNKNOWNs (caller binding, reader, rollback prevention, per-write
  wiring, installed/loaded/profile facts) are carried as open facts and every
  acceptance-method row is NOT_EXECUTED until its evidence exists. The acceptor is not
  the author; no Owner personal review of this exact head is claimed; W7 and any
  window remain unsigned and OPERATION stays governed by SRA-C-002/003 and DCP.

spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - fleet-window B entry issuer and appointment validation
  - bounded effects, UTC validity and fresh revocation checks
  - existing refusal wire points and isolated acceptance definitions
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1
  - PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1
external_authorities: []
supersedes: []
superseded_by: null
owners: [mayf3]
authoring_base: 5f3133dd08dc6529279ab8adf6ba7aacac1e2fd7
---

# Fleet Window Authority Validation V1 — Δ1 / Δ2 提案

**PROPOSED，非权威；本轮不接受、不合并、不实施、不任命、不签发、不操作生产。**
`implementation_authority: contracts` 表达未来有权者独立接受且进入实现 base 后的合同用途，
当前没有实现许可。本文所有 MUST/MUST NOT 均为待审合同；不改变现行 SRA、DCP 或 stable ID。

## Goal

在现有 fleet-window B 入口提出 Δ1 issuer/appointment、Δ2 范围/期限/撤销的适配合同，
使 SRA-C-001/002/006 的既有要求有明确消费位置和可反驳的隔离验收方法。
目标是可审查的 spec 提案及 base=`main` 的 PR；工具不可用时依简报保留本地提交并停止传输。

```text
SPEC_GOVERNANCE_MODE = AUTHOR
schema_version = 2
GOAL_OR_TARGET = Δ1+Δ2 proposed spec + Brief + docs-only PR
CURRENT_GAP = B validator 未消费合法任命、角色独立性及 fresh 范围/撤销链
AUTHORITY_ACTION = NEW
AUTHORITY_OWNERSHIP = mayf3/dsh-agent-core; B authority-validator adapter only
PRIMARY_AUTHORITY = AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1@5f3133dd
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED  # 拟议身份/授权合同；本次只有 docs authoring
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO  # 指本提案；父 SRA/DCP 已存在于 B
DOCS_FIRST_REQUIRED = YES
MUTATION_AUTHORIZATION = 用户任务 + BRIEF-D1-D2-VALIDATOR-PROPOSAL.md
ISOLATED_WRITE_SURFACE = ops/fleet-window-authority-proposal @ authoring_base
PRODUCT_IMPLEMENTATION_ALLOWED = NO
OPERATION_ALLOWED = NO
MERGE_ALLOWED = NO
DONE_WHEN = 提案+简报本地 commit，push成功后创建main PR；push失败不重试并交监管传输
EXPANSION_TRIGGER = 与accepted含义冲突、需要扩权/新信任根/生产效果；停止依赖工作
```

## Scope and non-goals

只新增本文和任务简报。仓内没有 `docs/specs-proposals/`，依简报及 SPEC_FORMAT_V0 使用
`docs/specs/`、以 `status: proposed` 表示生命周期。NEW 的独立责任是 B validator 的
字段、消费及失败接口；不是替换 SRA 的角色、委托范围或 DCP 的部署协议。

Δ3 完整 candidate/gates 改造、Δ4 全部旧 writer 退役、Δ5 实际资格与生效事务留给后续任务。
本文仍定位六类拒绝及它们已有的候选/门检查，但不声称 Δ1+Δ2 完成了六类端到端控制。
不建撤销服务、第二台账/队列/收据库/互斥锁、认证服务、principal、Secret、Grant、信任根、
controller、profile 或通用 privileged helper。不扩大既有 reader 的可读范围。

**D 侧 `deployment_system.py` 适配明确 out-of-scope。** #684/Δ0 的来源 repo 未定位结论
仅作为简报给定的非权威输入；本轮未证其源 repo/revision、loaded bytes、准入 profile。
不 patch installed 文件，不把 D、DCP 的 agent-deployd、B fleet-window 视为同一实现。

## Authority and dependencies

固定快照 **B**=`5f3133dd08dc6529279ab8adf6ba7aacac1e2fd7`。本文 `core`、`helper`、
`runner`、`selftest` 分别指 B 的 `scripts/fleet-window/window_helper_core.py`、
`window_helper.py`、`window-executor-v5.sh`、`window-selftest.py`，行号均是该 Git object 的 1-based 行号。

| 来源 | 固定坐标及作用 | 权威/限制 |
|---|---|---|
| Product Architecture / Current Decisions | B:`docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md`；`docs/decisions/README.md`，D-008 / D-009 | 保持架构原有冻结草案标记、Agent principal/session 所有权、UNKNOWN/不重放边界；不提升生命周期 |
| SRA V1 | B:`docs/specs/AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1.md` L151–189、L201–216、L222–242、L268–290 | accepted / ACTIVE_ON_MAIN；C-001/002/006 为主要父合同，C-003/004/005 的门与 STOP 保留 |
| DCP V1 | B:`docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md` L164–236、L255–307、L337–388 | accepted / implementation contracts；CTR-004/005/006/007/008/009/011/012/013/016/017/018 保留，production apply none |
| #683 普查 | [PR #683](https://github.com/mayf3/dsh-agent-core/pull/683)，本地对象 `5f387cf129148091f5ea828402a962eae3abec3b:CONTROL-CENSUS-SRA-EFFECTIVENESS.md` §2/§3 | 非权威设计输入；已直接读取本地对象，远端 head/状态 UNKNOWN，不以本地 ref 证明远端 |
| #684 / Δ0 | [PR #684](https://github.com/mayf3/dsh-agent-core/pull/684)，本任务简报所述结论 | 非权威普查输入；远端读取失败，原报告内容/当前 head UNKNOWN，不伪造 Git 坐标 |
| 本次授权 | [任务简报](../../BRIEF-D1-D2-VALIDATOR-PROPOSAL.md) + 用户明确执行指令 | 只约束本次 docs/commit/push/PR；不创造产品或生产权限 |

本轮 `gh pr view 683/684 --repo mayf3/dsh-agent-core` 均 rc=1，原文：
`Post "https://api.github.com/graphql": proxyconnect tcp: dial tcp 127.0.0.1:7890: connect: operation not permitted`。
不切代理、不换通道；push 必须独立按简报只尝试一次。上游原件不可达不阻止以已读 SRA 和 B 编写提案，
未知事实保持未知，不能用来证明接受、任命、生效或实际控制资格。

以下命令可以复核本文全部“现有挂点”坐标；不是执行窗口：

```sh
git show 5f3133dd:scripts/fleet-window/window_helper_core.py | nl -ba
git show 5f3133dd:scripts/fleet-window/window_helper.py | nl -ba
git show 5f3133dd:scripts/fleet-window/window-executor-v5.sh | nl -ba
git show 5f3133dd:scripts/fleet-window/window-selftest.py | nl -ba
git show 5f3133dd:docs/specs/AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1.md | nl -ba
git show 5f3133dd:docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md | nl -ba
git show 5f387cf129148091f5ea828402a962eae3abec3b:CONTROL-CENSUS-SRA-EFFECTIVENESS.md
```

## Current State

`STATE-FWAV-001` — subject=B fleet-window source，environment=本地隔离 worktree 静态读取，
observed_at=2026-11-09T05:44:15Z，as_of_commit=B，basis=OBS-FWAV-001/002。
`validate_authority` 尚未核 SRA 任命，`authority()` 只核 receipt 副本的 window UTC。
source/installed/loaded/profile/控制资格各自独立；除 B source 外均未由本轮证明，保持 UNKNOWN。

## Observations

- `OBS-FWAV-001` — B core L25–38 的 `validate_authority` 核字段、writer UID、固定旧 SHA、
  scopes 必含集合和 window UTC；L88–91 的 `authority()` 重读 `rd/authority.json` 后只核 window UTC。
  方法为上述 `git show`；本轮静态读取，无生产探测。helper L5–11 在 validate 后保存 authority。
- `OBS-FWAV-002` — B runner L305–318 在每阶段前走 `mutex-check`，helper L18–19 再调 authority；
  runner L165–170、L201、L217–220、L234–239、L263 有直接效果调用。
  helper L364–369 的 release 未调用 authority。静态源码不证明这些入口已准入/不可旁路。
- `OBS-FWAV-003` — #683 的上述本地 object §2 六类为未任命/越界/过期/撤销/候选漂移/缺门，
  §3 Δ1/Δ2 是非权威建议；#683/#684 远端查询为前述 rc=1。观察时点为本次 2026-11-09 authoring，
  provenance=固定 Git object 和上列 gh 错误；没有远端接受/合并观察。

## Claims and assumptions

- `CLM-FWAV-001`，SUPPORTED：仅给 authority JSON 新增自报字段不能形成合法任命或 fresh 撤销检查；
  支持 EVD-FWAV-001，限制为 B 已读调用链，不推导全主机不存在其他控制。
- `CLM-FWAV-002`，SUPPORTED：只增强 `authority()` 并保留阶段首检查，仍不能证明每个实际写边界重核；
  支持 EVD-FWAV-002。实际受信 caller 适配、reader 可达性及内部 child 写边界能力 UNKNOWN，
  它们是未来资格前提，不是假设已存在的权限或本提案接受的前提事实。

## Evidence relations

- `EVD-FWAV-001`：OBS-FWAV-001 → CLM-FWAV-001，SUPPORTS；coordinates=B core L25–38/L88–91、
  helper L5–11，本地静态读取；足以证明所读函数无对应 consumer，不证明 installed/loaded 控制状态。
- `EVD-FWAV-002`：OBS-FWAV-002 → CLM-FWAV-002，SUPPORTS；coordinates=B runner L165–170/
  L198–220/L223–265/L305–318、helper L364–369；足以界定 wrapper 与实际效果之间的缺口，
  内部 installer/settlement 原子提交的完整源码资格未在本提案宣称覆盖。

## Decisions

- `DEC-FWAV-001`（proposed；decision owner=mayf3）：以 B 原 validator/authority 链消费原有任命登记，
  不以自写 JSON 或 hash 代替身份认证，不建立另一任命/撤销权威。
- `DEC-FWAV-002`（proposed；decision owner=mayf3）：Δ1/Δ2 在签发和实际写/生命周期边界 fail closed，
  使用原错误出口；完整六类资格、main 接受、实际 EFFECTIVE 与逐窗 Mandate 分别证明。

## Contracts

### CTR-FWAV-001 — 提案和生效边界

本文 MUST 保持 proposed，当前任务 MUST NOT 修改 accepted 文件、代码、索引、任命或生产状态。
未来接受须独立有权事务及 main 落地；即使接受本实现 spec，也 MUST NOT 自动登记 SRA EFFECTIVE、
批准 controller/profile、启用窗口或自动签发 W7。DCP 的 production apply none 不变。

### CTR-FWAV-002 — SRA revision 与合法 issuer

Mandate MUST 引用 `sraRef={specId, acceptedCommit, path, blob, sha256, effectivenessRef}` 和
`issuerRef={principal, session, authoritySource, selector, canonicalSha256}`。
consumer MUST 从现有受信接受记录证明该 SRA revision 已进入实际 main 且仍适用，读取真实生效收据，
并从原有权授予链证明 issuer 的角色、范围和有效性；main 无关前移不自动使冻结 revision 失效。
签发前材料与生效收据不得互相循环自证；自写 EFFECTIVE、任意 URL、hash、角色名或 UID 不授角色。

### CTR-FWAV-003 — 唯一 appointment 引用

Mandate MUST 引用 `appointmentRef={source, selector, canonicalSha256, appointmentId, lifecycleState,
revision, lifecycleRef}`。source 只能解析到现有准入登记链/PR，不能由调用者指定任意文件/网络地址。
selector MUST 以稳定 ID 唯一选中完整任命记录，匹配数必须为 1；数组下标不是身份。
canonical 复用 B:`docs/reports/sra-v1-formalization-20261107/conversion-receipt.md` L3–5 的算法：
UTF-8 `json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(',', ':'))`，无末尾换行，SHA-256；
拒绝 duplicate JSON keys、非 JSON 常量和不符合登记 schema 的类型，不能先丢键再 hash。
静态 hash 固定原任命内容；当前生命周期必须另沿同一权威链 fresh 解析续任/替换/缩窄/撤销，
不能把历史 `ACTIVE` 或 `revoked:false` 当最新状态。提名/条件未齐/未生效/替换/撤销/未知均拒绝。

### CTR-FWAV-004 — caller、执行身份与跨 session 延续

Mandate MUST 声明真实 `callerRef={principal, session, uid, continuityRef}`，并与现有进程外受信 caller
关系和原身份链核对。签发 actor=C、实际写 actor=W；root sudo 子过程的 euid 不是 Captain，
也不产生新的授权 principal。请求体的 principal/session、writer、writer_uid、PID 或环境变量
只作待核声明；核不出实际 caller 就拒绝，禁止降级为 UID 相等即通过。
session/worker 变化只有原身份链的可归属延续证明才能承继原范围/期限；不得靠新 session、同 UID、
历史 reviewer_session 或候选自报证明独立性，也不得由此延长任命或重置 attempt。

### CTR-FWAV-005 — A/W/V/C 冲突声明与验真

Mandate MUST 列出全部实质候选/installer 作者 A、生产 writer W、独立 verifier V、Captain C 的
principal/session、角色来源及可核独立性，并给出以下矩阵；声明必须由受信来源交叉核实。

| 配对 | 判定规则 |
|---|---|
| C–A、C–W、C–V | SRA-C-001 明确冲突；相同实质 actor 即拒绝，换 session/UID 标签不能消除 |
| W–V | 同一生产写入的独立验证不能由其 writer 自证；冲突即拒绝独立资格 |
| A–W | SRA 未单独禁止；仍须满足原 profile/本单既有职责政策，不由此新增或放宽权限 |
| A–V | 不能用作者自证充当非作者独立审查/资格收据；按既有 verifier/profile 独立性要求核对 |

任何参与者身份、角色政策或独立性必需证据 UNKNOWN MUST 拒绝依赖的签发/写入；同 UID 不足以证明相同或不同 actor。

### CTR-FWAV-006 — effects 交集

consumer MUST 从固定调用/已准入 profile 的实际操作提取 `requestedEffects`，逐项证明：
`requestedEffects ⊆ appointmentScope ∩ mandateScope ∩ admittedProfileEffects`。
三个集合都必须来自已认证对象，不是调用者自报的同名 scope 数组；比较至少覆盖 repo、host/runtime、
launchd domain/label、目标路径、操作类别、身份/metadata、参数及恢复效果，禁止隐式通配/前缀扩域。
profile 未准入/不明、任何效果未分类、调用实际参数漂移或任一集合不含该效果均拒绝。
现有 core L34–35 的必含 scopes 校验必须保留其已有边界，不能冒充交集；本提案不激活 DCP profile。

### CTR-FWAV-007 — STANDARD_RECOVERABLE 分类

Mandate MUST 给 `releaseClass=STANDARD_RECOVERABLE`、`standardCriteria[1..5]` 和 `exclusions`，
每项含真实对象/证据坐标/状态。机械规则为五项全成立、证据可核且所有排除项 false 才可签发；
自报五个 true 无效。以下逐项承接 SRA-C-002，不扩写 accepted 含义：

| 判据 | 签发材料及实际阶段要求 |
|---|---|
| 1 | 候选语义在实际 main accepted Contracts 内，来源可追溯，无未授权语义/身份/认证/权限/产品边界变化 |
| 2 | 原完整 Mandate/Runbook、已获准单一 fleet runtime、合法准入且可执行限制的现有入口 |
| 3 | app/harness/Node/平台/实际installer/完整闭包/旧版/生产身份精确绑定；兼容、回滚及负向证明可核 |
| 4 | 一次有界窗口、一个 writer、独立 verifier、UTC/最大尝试、完整 effects/恢复路径；不清全局 fence/回灌业务快照/重放 |
| 5 | §4 的旧runtime和已派发effects终止/隔离、stage10只恢复合法自然准入；签发时先核可强制的配方与证据取得方法，到该边界再核实际证明 |

排除项 MUST 穷举 SRA-C-002 已列类别：bootstrap 后需全局暂停；新语义/危险迁移；扩权、跨域、
首次新 runtime/目标面；新装/激活 controller/profile/trust root/setuid helper；运行身份/认证策略/
Node 架构改变；无安全回退或超过既定策略重大风险。任一 true 或 UNKNOWN 不按标准类签发。
普通缺材料归原责任链补齐；不把缺证自动当新产品决定或统一 WAITING_OWNER。
未来事实只能 `REQUIRED_AT_STAGE` 并具有强制 gate/失败出口，不能签发前伪填 PASS；实际边界未过不执行。

### CTR-FWAV-008 — UTC 交集

有效区间 MUST 为 `[max(window.valid_from, appointment.validFrom), min(window.valid_until,
appointment.validUntil))`；沿用 core `stamp` 的明确 UTC 解析，缺失、非 UTC、非有限值、反向/空交集、
未知或无限期限拒绝。取有归属的当前 UTC，起点可含、终点不含，签发和每次边界重新判定。
`validFrom=EFFECTIVE收据时刻` 等引用必须解析成真实收据的 UTC，不得补造。
时钟不可核、回退使期限判断不可信或现在不在交集内均不签发/不启动下一写；换窗口不续任。

### CTR-FWAV-009 — fresh 撤销、缩窄与代际

每次签发及每个依赖写/生命周期边界之前 MUST 从原有可归属登记链完成 fresh 读取，核查询时点、
source revision/epoch、完整生命周期、授权 actor、受影响范围与生效时间，重新求范围/UTC交集。
缺失、重复 selector、hash 不符、读失败、缓存过期、未读完整后续事件、版本/epoch 回退、撤销、
缩窄后不含当前效果或任何 UNKNOWN 均拒绝；失败不能退回旧快照或继续凭已存 authority.json 执行。
采用原 reader 的版本/新鲜性规则，若无法证明当前性或防回退则不具资格；不能新建签名根/台账填洞。
DCP CTR-006 适用的受保护单调签名政策/最长五分钟 lease 必须保持；lease 不替代逐边界读取。
原 window receipt 可记录已见 revision/查询结果作审计和防回退比较，不能成为新的授权来源。

### CTR-FWAV-010 — 挂点、互斥与内部写边界

下表是未来适配位置，**不是当前能力声明**。签发指合法 C 签署完整 Mandate；B authority 分支
只验证输入，不自行签发。C 签署前须消费同一核验语义，helper 则必须在保存有效 authority 前重核。
除取得自身 mutex 前的初始验证外，依赖写须在真实持有原 mutex 时重核并执行；不得另造锁或夺锁。
每个实际效果前消费同一 Δ1/Δ2 校验，不能只在阶段首或一个长命令前读一次。

| B 的现有函数/行号挂点 | 拟议接线及覆盖限制 |
|---|---|
| core `validate_authority` L25–38；helper `authority` 分支 L5–11 | 扩充输入验证；在 helper L8 首次 `save('authority.json',a)` 前拒绝无效输入；签发前材料核验与入场重核分开 |
| core `authority()` L88–91；helper `mutex` L12–17、`mutex-check` L18–19；runner stage00 L157–160/main L314 | authority 消费受信当前上下文；mutex创建前核资格，取得后锁内重核，阶段首检查仅作补充 |
| runner stage01 L165–170；helper `clean` L30–51 | root staging 每个 mktemp/cp/chown/chmod 与每个删除前；不得把阶段首核验当循环内核验 |
| helper `preimage` L159–182；runner stage06a L185 | ditto 与 metadata/xattr 效果逐边界；复制期间变更不可沿用旧授权继续下一效果 |
| runner `stage_05_old_exit` L198–209，bootout L201 | before-stop L199 以后、实际 bootout 之前重核，且保持适用的终止/隔离证据门 |
| runner `stage_05b_settle_unresolved` L211–220 | 外部 settlement 调用前及子过程实际提交前重核；不新增业务状态恢复/结算权限 |
| helper `install-start` L191–198；runner `stage_07_pinned_install` L223–239 | installer调用前重核；其内部每个写/生命周期边必须由同一已准入控制强制拒绝；外层一次检查不足 |
| helper `preserve-config` L225–251，ditto L246 | 每项复制前重核；不覆盖业务快照或越出既有目标 |
| helper `plist-update` L284–298，open/chown/chmod/replace L289–291 | 每个实际写与替换前；保留原 SHA-only delta 与metadata门 |
| runner `stage_10_plist_bootstrap` L261–265，bootstrap L263 | plist更新后、bootstrap实际调用前再核；两者之间撤销须阻止bootstrap |
| helper `close` L356–363 / `release` L364–369；runner stage13 L282 | 关闭证据与释放条件独立；release当前无authority，不得漏掉生命周期资格/安全终态判定 |

内部 installer/settlement 代码的完整边界、现有受信 caller 注入及 fresh reader 可执行资格在本轮
均未获证，记录 UNKNOWN。后续若不能在既有权限内证明每边界接线，必须拒绝该路径的写入资格，
不能靠“child已启动”授予后续无限写入，也不能借本文扩大到 Δ0/D 或新 controller 任务。
仅写到本次隔离运行的诊断/STOP收据可沿原出口保全，不授生产/授权台账写权限。

### CTR-FWAV-011 — 六类拒绝与现有 gates 保留

每类 MUST 在初始 validate/authority 链及其依赖边界有明确拒绝；候选/门的既有检查不因 Δ1/Δ2 删除。

| 类别 | B 现有坐标（均可由上列 git show 复核） | 拟议拒绝条件 / 出口 |
|---|---|---|
| 未任命 | core L25–38；helper L5–8 | CTR-002..005 任一失败；保存有效authority之前拒绝，后续实际caller/任命失配也拒绝 |
| 越界 | core L34–35；helper authority/各实际效果表 | CTR-006/007 交集或标准类不成立；不执行效果 |
| 过期 | core `stamp` L21–24、validate L36–37、authority L88–91 | CTR-008 window/appointment任一失效或时钟未知；不发新签发/写入 |
| 撤销 | core authority L88–91；runner main L314及各实际效果表 | CTR-009 fresh生命周期/缩窄/代际失败；不回退旧副本 |
| 候选漂移 | core `manifest` L77–87；helper `sources` L54–66、`fresh` L67–85、`bundle` L86–96、`final-binding` L252–283 | 保留字节/来源/live绑定拒绝；Δ1/Δ2还须拒绝Mandate绑定SRA/任命/已准入入口版本漂移；无关main前移不自动拒绝 |
| 缺门 | helper `prerequisites` L97–120、`before-stop` L133–142、`preimage` L159–182、`install-start` L191–198、`final-binding` L252–283；runner stage10 L261–265 | 签发材料不齐拒绝签发；未来阶段材料只作REQUIRED_AT_STAGE，到相应边界未核即拒绝；不以历史或自报PASS代替 |

六类都用 CTR-012 的同一原错误通道。本表是定位与验收定义；完整 sealed tuple、G01–G16 consumer、
旧路径不可旁路证明没有因此获证，Δ3–Δ5 未做就不得宣称 SRA-C-006 第5步已闭合。

### CTR-FWAV-012 — 原错误输出与在飞安全处置

拒绝 MUST 通过 core `require` L13–14 的 `RuntimeError(message)`/现有异常路径传播为 stderr及非零退出，
消息只含类别/非敏感对象坐标/缺件，不输出凭据。沿 runner helper L105–111、main traps L300–302、
`stop_on_error` L148–154 保存原 phase FAIL，`rollback_recipe` L114–145 打印原
`STOP stage=... install_state=... stop_state=...`、Evidence及配方。不新增错误通道/队列/自动重试；
授权拒绝 MUST NOT 返回用于 quiet/exit-check pending 轮询的 rc10（helper L127/L147，runner L190–207）。

撤销/过期时 MUST 停止下一普通写/生命周期动作，保留真实 phase、mutex、owned child/effects、
原 UNKNOWN 和 attempt。已在飞调用按原获准安全停止/恢复配方对账；撤销本身不授权 kill、回滚、
重新 bootstrap、重放、清 fence 或释放他人锁。若原配方明确授予必要安全动作，须另核该动作的
原授权/对象/界限，不把它当被撤销普通授权的延续；缺证则保持停止、UNKNOWN和mutex。
失败证据/诊断的原出口不得被授权失败递归阻断。release 仅在原安全终态和自身释放条件已证明时可做，
不能自动将撤销解释为完成，也不能用保留mutex掩盖仍在飞的外部效果。

### CTR-FWAV-013 — 验收、资格与状态区分

后续实现 MUST 在隔离环境对真实候选 validator/authority 链及实际调用边界做负向验收，
不以另写一个 mock validator 的 PASS 代替被测逻辑。证据记录 spec/implementation/base/入口版本hash、
control owner、fixture/input hash、真实 caller 来源、selector/canonical hash、query UTC/revision、
stage/effect、rawRC、调用次数、输出与限制，保存于原 PR/receipt 位置，并取得非作者独立 verifier 回执。
SRA-C-006 第5步还需 source→installed→loaded→已准入profile/实际写边界绑定及全部六类资格；
隔离通过、代码合并、文档接受、PR创建均不足以登记 EFFECTIVE 或授予生产权限。

## Acceptance

以下 **全部 NOT_EXECUTED**，是后续可执行方法；本次只验提案结构、源坐标、范围和独立文档审查。
环境 F=可丢弃非特权临时目录、受控 UTC/原登记链fixture、固定 caller 证明输入；
环境 I=隔离 runner 的真实候选调用链，所有外部 mutation/launchctl/child 由可计数拒绝桩接管，禁止真实生产调用。
桩只替代外部边界，不重写被测授权逻辑；以 selftest L56–67 的 AST 提取方式避免 import core 顶层副作用，
或使用后续已审隔离入口。现有整套 `--selftest` 不是本节纯 validator 干跑，不在本轮运行。

所有行的必需证据 **E**：CTR-013 所列坐标/输入/调用计数/rawRC/stderr及独立回执；
所有拒绝行预期是非零、原错误出口、目标效果调用数=0（已在飞的另记未决状态），否则失败。

| Acceptance | Contracts / 语义 | Method / Environment / Required evidence | Expected result / Failure condition |
|---|---|---|---|
| ACC-FWAV-001 | 001 提案隔离 | 文档diff/frontmatter/路径核对；本地B→候选；E中的Git坐标和清单 | 只新增spec+简报、proposed；任何accepted/代码/生产改动即失败 |
| ACC-FWAV-002 | 002 accepted SRA/issuer | F：合法接受/生效/issuer证明正例，未merge revision、自写EFFECTIVE、无权issuer负例；E | 正例可继续纯校验，负例拒签；仅hash/URL即通过失败 |
| ACC-FWAV-003 | 003 selector/hash/lifecycle | F：唯一记录正例；0/2命中、变更字节、重复键、提名/条件未齐/替换、历史ACTIVE但后撤销；E | 仅完整唯一可归属且当前有效记录通过；历史副本放行失败 |
| ACC-FWAV-004 | 004 caller/延续 | F/I：伪principal/UID/PID/env、sudo euid冒Captain、同UID新session无延续证明；另给真实原链延续正例；E | 伪造/缺证拒绝；证明齐备者保持原范围期限/attempt；换session变独立或续期失败 |
| ACC-FWAV-005 | 005 冲突矩阵 | F：枚举C–A/C–W/C–V/W–V相同actor、改session标签、遗漏A、未知政策；A–W按原政策正例；E | 冲突/未知拒绝，既有可兼任情形不被凭空禁止；把同UID当独立证明失败 |
| ACC-FWAV-006 | 006 effects | F/I：交集内正例；只在三个集合任意两个内、额外目标/路径/参数、未准入profile/通配、实际调用与声明不同负例；E | 仅完整子集通过；额外效果任一调用失败 |
| ACC-FWAV-007 | 007 五判据 | F：五项全有可核材料正例，逐项删证据/置false/UNKNOWN、仅五个true；I：第5项阶段证明缺失；E | 缺任一签发材料拒签，未来事实不预填PASS；未过阶段门仍调用失败 |
| ACC-FWAV-008 | 007 排除项 | F：对每个列明排除项逐一置true/UNKNOWN，包括bootstrap后pause、新controller、身份/Node架构变更；E | 全部拒绝标准类；缺普通材料如实归原链，自动豁免或统一要求Owner失败 |
| ACC-FWAV-009 | 008 UTC | F：window/appointment交集起点、终点、空集、缺失/非UTC/无限期、EFFECTIVE引用无真实时刻、时钟回退/未知；E | 起点含、终点拒绝；最早到期者生效；未知或延长任命放行失败 |
| ACC-FWAV-010 | 009 fresh/回退 | I：初始通过后，在每个效果前撤销/缩窄/替换；注入reader失联、重复selector、stale lease、缺后续页、epoch回退；E | 下一效果零调用，旧authority副本不兜底；只初始读取或缓存失败仍继续即失败 |
| ACC-FWAV-011 | 010 全边界/互斥 | I：按挂点表枚举每个复制/删除/metadata/replace/bootout/install/bootstrap/内部child提交/release，检查持自身mutex且紧邻核验；E+边界trace | 无阶段首检查冒充逐写；内部边界未接线即不具写资格，不得报告全覆盖 |
| ACC-FWAV-012 | 011 六类定位 | I：逐类注入未任命/越界/过期/撤销/候选漂移/缺门，覆盖初始与相应后续挂点；E+六类trace | 六类均拒绝；只报告UID/字节局部PASS或混称SRA EFFECTIVE失败 |
| ACC-FWAV-013 | 011 漂移与门保留 | F/I：改source/tree/harness/manifest/expected-live/控制版本；删适用gate/伪历史PASS；另做无关main前移正例；E | 保留原拒绝和当次绑定，stage未执行不冒PASS；无关main前移不要求重批；任一反向失败 |
| ACC-FWAV-014 | 012 错误输出 | I：每类拒绝收集RuntimeError/stderr/rawRC/phase FAIL/原STOP与Evidence；E；fixture故障收据写失败另记 | 非零且非rc10、不被轮询吞掉；不增错误通道、不泄密；诊断失败不能反转拒绝 |
| ACC-FWAV-015 | 012 在飞/释放 | I：install已发出后撤销、child结果UNKNOWN；仅给/不给原安全配方授权，分别核恢复动作计数和mutex；E | 下一普通写停止，原UNKNOWN保留，安全动作只在原授权内；自动kill/replay/回滚/清锁/宣布完成失败 |
| ACC-FWAV-016 | 013 资格区分 | 非作者核F/I证据与实际入口资格清单；本次仅文档方法，未来实际资格须另授权；E+缺失项矩阵 | source/isolated/installed/loaded/EFFECTIVE/单窗分别结论；任一用前者替代后者失败 |

反向覆盖：001→001；002→002；003→003；004→004；005→005；006→006；007→007/008；
008→009；009→010；010→011；011→012/013；012→014/015；013→016。
对应 SRA-C-006 第5步六类拒绝、入口版本/hash、control owner、负向资格与独立 verifier，
本提案提供定义和坐标，实际执行结果及生效判定仍待后续任务。

## Alternatives and disposition

拒绝只扩模板、仅校UID/自报principal、只存revoked:false、用hash当签名、只阶段首检查、
权限失败返回rc10、拿mock validator PASS证明真实入口。拒绝为reader缺口另建撤销服务/第二台账。
D侧适配 DEFER 至来源归属与独立任务；原SRA/DCP/历史Mandate及收据 RETAIN。
本提案不新增第二可执行模型，也不退休现有writer；未证明不可旁路不得作全局拒绝能力结论。

## Migration, compatibility, and rollback

本轮只有文档新增，无运行迁移/回滚。未来实现必须经独立接受后新任务路由，仍在原B入口消费，
旧Mandate缺新必需证明时 fail closed，不伪造任命、不默认无限期、不设永久兼容放行。
该拒绝不改变 accepted SRA 既有要求；如发现某份有效accepted授权与新增规则实际冲突，
停止依赖适配并 RE_PREFLIGHT，不能在相同stable ID下改写父合同。
在飞窗口不自动重启或补签，保留原Mandate/attempt/phase/UNKNOWN；只按原安全配方处置。
独立接受后仍须证明安装/加载及profile资格，不允许借本spec激活DCP或修改privilege。

## Open questions

实际任命selector/真实caller延续、受信reader的可达与防回退能力、控制所有者、内部installer/
settlement的逐写接线及source→installed→loaded/profile绑定均 UNKNOWN，未来必须实证；
这些不是本轮填造的“已通过”事实。#684原报告与当前远端head待监管可达时核对。
无本轮接受/生产授权待决；所列拒绝规则使缺事实不产生默认许可。

```text
STATUS = proposed
IMPLEMENTATION_AUTHORITY = contracts_after_independent_acceptance_in_base_only
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1@5f3133dd
EXTERNAL_AUTHORITIES = NONE
OPEN_OWNER_DECISIONS_FOR_THIS_PROPOSAL = NONE
NORMATIVE_TBD = NONE  # 实际资格未知按拒绝规则处理，不预先宣称可执行
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 13
CONTRACTS_WITH_ACCEPTANCE = 13
AUTHORING_READY_FOR_REVIEW = YES
RUNTIME_ACCEPTANCE = NOT_EXECUTED
SRA_EFFECTIVENESS_CLOSED = NO
NEXT_ACTION = INDEPENDENT_REVIEW_AND_DOCS_PR_ONLY
```
