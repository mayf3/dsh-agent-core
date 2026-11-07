# Captain A principal 绑定与任命登记准备包

本包仅准备 Owner 方案①A 的专用 Captain `release-captain-agent-core-20261107`。**待 Owner 确认创建**：auth-service 指定本机数据库只读查询成功但无匹配 principal；UUID、实际类型和 Session 绑定仍为 `UNKNOWN`。没有创建身份、登记任命、签发 Mandate 或执行生产写入。

`A` 在 Owner ①A 中是方案编号；下文职责矩阵的 `A=Author`，专用 Captain 用 `C` 表示，避免将 Mandate 作者和 Captain 混为一个角色。本包是登记草案和验证设计，不新增 Product Contract，不生成可执行 authority JSON。

## 1. 授权、坐标与本次路线

任务原件：[BRIEF-CAPTAIN-BIND.md](BRIEF-CAPTAIN-BIND.md)。Owner 原件为 `/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json`。已直接读取以下唯一 selector，选中原文及规范化算法保存于 [owner-rulings.json](docs/reports/captain-binding-20261107/owner-rulings.json)：

| 来源 | 选中条款 | 对象 canonical SHA256 |
|---|---|---|
| `$.rulings[id=owner-20261107-five-decisions]` | `items[0]`，专用 principal 方案①A | `95290062529cf24c31d3c7f6c748a22e5e369d14458cf623f562eee5c90cedc8` |
| `$.rulings[id=owner-20261107-sra-formalization]` | `items[1..3]`，五条件、四种事实和资格核验边界 | `f6ace2b1e1621da830421e57a9b886faac75de8f4bf7a895d0ecf0832438a129` |

①A 原文要求“auth-service身份绑定核验→任命登记→§6.5控制生效验证→生效”。本任务只准备材料；后续合法链须同时保留条件任命裁定的资格限制，不能凭登记草案或任命记录跳过实际控制资格。条件未齐保持 `NOMINATED_NOT_APPOINTED`、不得签发；本包没有决定或执行任命时点。

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
WORKTREE = /private/tmp/h-captain-bind
ENTRY_HEAD = 2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648
BASE_HEAD = 24974c720d634b965943e08bfd0862657b9be0e1
CURRENT_BASE_HEAD = 24974c720d634b965943e08bfd0862657b9be0e1
ISOLATED_REF = docs/captain-binding
REVIEW_TARGET_HEAD = NOT_APPLICABLE  # precommit; review receipt binds real commit
GOAL_OR_TARGET = reviewable binding evidence + creation request + appointment draft
CURRENT_GAP = no matched dedicated principal; capability/control binding not verified
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1 / SRA-C-001..006
AUTHORITY_ACCEPTED_IN_BASE = YES
ROUTE_STAGE = AUTHORITY_AUTHORING
IMPLEMENTATION_AUTHORITY = none
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
EXECUTION_MANDATE = VALID
MUTATION_AUTHORIZATION = VALID
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = NO
SPEC_GAP_DEPENDENCY = NONE
EVIDENCE_REVIEWABILITY = PASS  # sanitized sources accessible; semantic review pending
LIVE_AUTHORITY_GAP = NONE  # this preparation only
OWNER_DECISION_REQUIRED = YES  # creation request only; not this docs delivery
EMERGENCY_STATE = NONE
BASE_IMPACT = BOUNDED
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = five-condition inventory, exact reads, independent docs review
DONE_WHEN = package committed on docs/captain-binding, pushed, PR to main, no merge
EXPANSION_TRIGGER = authority conflict, failed required step, production write need
NEXT_REAL_ACTION = prepare and review docs, then authorized push and PR
NEXT_ACTION = CONTINUE
```

`AUTHORITY_AUTHORING` 在此仅指编制非权威登记材料，`REUSE` 不改变已接受合同。文档持久交付按 DURABLE 审查；将来身份创建、实际任命和控制适配须各自在合法授权下走适用的 CONTROLLED 边界。本任务不实施这些操作。查询成功后“需创建”属于 Brief 明确允许的输出分支；实际步骤失败时停止并写 `STOPPED-CAPTAIN-BIND.md`。

## 2. 五条件证据与状态

| 条件 | 本次可复核材料 | 实际结论及缺件 |
|---|---|---|
| ①唯一 Principal / Session / 跨会话身份 | §3；`EVD-CB-002` | 本机 Auth 无匹配；需创建请求。UUID、类型、Session、跨会话归属 `UNKNOWN`，条件未满足 |
| ②能力及独立性 | §4 职责矩阵与能力验收项目；SRA-C-001 | 要求及证据格式已准备；被提名 principal 尚不存在于查询结果，实际能力和独立性证明 `NOT_VERIFIED` |
| ③任命/签发/撤销/审计路径 | §5 与 §7 草案；`EVD-CB-001/003` | 合同和合法载体已定位；登记者权限、实际身份绑定及控制消费能力待合法链回执；没有执行登记 |
| ④实际控制 | §6 可逐项执行清单 | 仅设计；全部 `NOT_EXECUTED`。真实入口/版本/hash、控制所有者、独立 verifier 收据待补 |
| ⑤SRA accepted 坐标 | §2.1；`EVD-CB-003` | **SRA accepted 且已合 main 子项已满足**。原裁定⑤还含“控制资格独立验证”，该子项未执行，不能将整项写成实际控制 PASS |

### 2.1 已满足的 SRA 坐标

唯一正式权威：[AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1](docs/specs/AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1.md)，发现入口为 [Spec 索引](docs/specs/README.md)。

| 事实 | 精确坐标 |
|---|---|
| accepted-by / at | `mayf3` / `2026-11-07T07:26:44.290920Z` |
| reviewed proposed HEAD | `8fdd5e9dc4f9cf525188d6ac19f986e0191e9604` |
| final accepted HEAD | `459c7de7a98a96c43cbea34cc315cc9a49ddbe12` |
| 非作者最终差量复核 | PR #648 正文 `FINAL_HEAD_RECHECK=PASS`、语义差量 NONE、blockers 0 |
| 已合并 PR / main merge | [PR #648](https://github.com/mayf3/dsh-agent-core/pull/648) / `55f442c74414dc723306a6d8e0cdba73d78eb8da`，`2026-11-07T07:31:39Z` |
| 本次 main snapshot | `24974c720d634b965943e08bfd0862657b9be0e1`；上述 merge 为其祖先，`git merge-base --is-ancestor` rc0 |
| Spec Git blob / SHA256 | `750504f2d9c27202543a70c6e68d3aba1001928e` / `a0b5959ce5a3ef0007c86b486670598216f11c3c62eaac70693dbc7f3cfb3427` |

[sra-main-observation.json](docs/reports/captain-binding-20261107/sra-main-observation.json) 保存 live PR 读回及提交坐标。旧接受收据保留其当时 pending-main 状态；后续 merge 由本次读回和 Git 祖先关系补证。只证明 SRA 接受/合入，不证明任命、控制生效或 W7 获批。

### 2.2 Evidence 关系

| Evidence | Observation → 支持的 Claim | 充分性、限制与来源 |
|---|---|---|
| EVD-CB-001 | Owner 选中对象只读观察 → 此任务获准准备①A材料 | `SUPPORTED`；原件路径/selector/hash/UTC 在 owner-rulings.json；不授权本 worker 创建或任命 |
| EVD-CB-002 | Skill lookup + 带底层 rc 的只读 SQL → 本机指定 Auth 坐标没有匹配记录 | `SUPPORTED`；auth-readonly-observations.json 保存查询/结果/时间/hash；不证明其他主机或未知别名不存在 |
| EVD-CB-003 | Spec Git 对象 + live PR #648 + main 祖先检查 → SRA accepted/main 子项满足 | `SUPPORTED`；sra-main-observation.json；不推导实际控制资格或生产许可 |

## 3. 条件①：Auth 核定与创建请求规格

使用已读 [auth-service skill](/Users/yanfenma/.openclaw/skills/auth-service/SKILL.md) 的 `lookup-principal.py --json release-captain-agent-core-20261107 --include-disabled`，结果 `[]`、rc0。该脚本不透出 psql 错误，故另外通过同一连接配置执行 `psql -X -v ON_ERROR_STOP=1`、`PGOPTIONS=-c default_transaction_read_only=on` 和 `BEGIN READ ONLY`，检查真实返回码后才判无匹配。

完整脱敏观察：[auth-readonly-observations.json](docs/reports/captain-binding-20261107/auth-readonly-observations.json)。补证观察时刻 `2026-11-07T12:58:53.288492Z`，数据库 `agent_dev_center`，连接 `localhost` / server `::1:5432`，用户 `auth_ro`，`transaction_read_only=on`，底层 rc0、stderr 为空。按以下条件查询、未过滤状态，实际结果零行：

```sql
agent_id IN ('release-captain-agent-core-20261107',
             'agt_release-captain-agent-core-20261107')
OR external_ref IN ('release-captain-agent-core-20261107',
                    'agt_release-captain-agent-core-20261107')
OR display_name = 'release-captain-agent-core-20261107'
```

本次还观察到 `PrincipalType` 枚举为 `agent/service`，`id/agent_id/external_ref` 各有唯一索引。schema 唯一约束不证明身份归属。未查询 Secret 列，未获取 token、创建 Client/Grant 或操作任何生产 writer。

以下是**待 Owner 确认创建**的请求规格，不是创建命令或生产授权；Auth 合法责任链收到确认后须选择其既有合法创建入口及运行资格，不在本仓发明管理 API。

| 请求字段 | 拟议值 / 待补事实 |
|---|---|
| request purpose / designation | 专用 Captain 身份；`release-captain-agent-core-20261107`；不复用作者、writer、verifier principal |
| requester / authority | mayf3；①A 与条件任命裁定 selector/hash；本包仅为准备者记录 |
| principal UUID | `UNKNOWN`，由合法 Auth 创建收据返回；不得预填或用 UID/Session 替代 |
| principal_type | 拟 `agent`，**待 Owner/Auth 责任链确认**；不得从角色名推定数据库实际类型 |
| agent_id | 若采用 canonical AGENT 路线，拟 `agt_release-captain-agent-core-20261107`，须显式确认它与 designation 的绑定；不做静默前缀转换或 canonical 宣称 |
| 其他类型的处理 | 若合法链选择 `service`，须按 Auth 合同填写 `agent_id=NULL`，重新明确主体与 Session 归属；不得称作 AGENT；此包未选定此路线 |
| display_name / external_ref / request_digest | 展示名拟 designation；external_ref、digest 由 Auth 现行路径及确认后的 exact 请求决定，当前 `UNKNOWN`，不自造映射 |
| owner_user_id / custody | `UNKNOWN_PENDING_AUTH_CUSTODIAN_CONFIRMATION`；不从当前 OS 用户推导 Owner，也不凭 accepted ownerless Spec 假设生产已准入 |
| status / lifecycle | 初始状态及可签资格由 Auth 合法生命周期决定；principal 存在不等于 Captain 任命或生效 |
| Client / credential / scopes / Grants | 本创建准备请求不要求创建或发放；不新增 release scope/audience；如后续确需，另列 exact 差量和授权，不能随身份创建附赠 |
| UID / host / Session | 仅候选来源提及 uid502；目标实际 UID/主机/session/worker 绑定及可信归属收据 `UNKNOWN` |
| cross-session continuity | 由可归属控制/认证来源绑定同一 UUID、具体 session/worker、时间和登记；仅同 UID、同名称或历史 reviewer_session 无效 |
| exclusions | 无生产写权、无 verifier 任职、无 Mandate 实质创作、无转委托、无新控制器/profile/trust root/认证策略变更 |
| future receipt / verification | 合法操作者、授权 selector、exact 请求/hash、UTC、原始 rc、返回 UUID/type/agentId、创建后只读反查、跨会话证明、独立复核坐标；未知结果先对账不得盲重试 |

designation、Auth UUID、principal_type、agent_id、OS UID、Session 是不同字段。Auth canonical AGENT 与既有 provisioning ID 的适用语法不同；最终创建路径须由 Auth 权威核定，不能仅加 `agt_` 就证明 canonical lifecycle。此处两种 spelling 的查询仅用于避免遗漏，不建立别名或第二身份模型。

创建请求的类型/语法参考为 Auth 已接受 main 快照 `2228195f53d603a961b033bdcd600ec5a83ba12d` 的 [OWNERLESS_AGENT_PRINCIPAL 类型规则](https://github.com/mayf3/auth-service/blob/2228195f53d603a961b033bdcd600ec5a83ba12d/docs/specs/AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1.md#L147)、[REVERSE_RESOLUTION CTR-IDR-003](https://github.com/mayf3/auth-service/blob/2228195f53d603a961b033bdcd600ec5a83ba12d/docs/specs/AUTH_SERVICE_IDENTITY_DIRECTORY_REVERSE_RESOLUTION_V1.md#L125) 与 [既有 provisioning discovery](https://github.com/mayf3/auth-service/blob/2228195f53d603a961b033bdcd600ec5a83ba12d/docs/specs/AUTH_SERVICE_AGENTCORE_IDENTITY_RESOLUTION_V1.md#L355)。本次 `git ls-remote github refs/heads/main` rc0 与该快照一致。它们约束不同路径，不等于已核实本次生产创建入口或 ownerless profile 生效；后者仍待 Auth 责任链核定。

## 4. 条件②：能力及职责分离

本矩阵是本次任务要求与 SRA-C-001 的证据清单；**不是不存在的 principal 已具备能力或已完成独立性核验的证明**。各实际身份和每单关联记录待合法链填写。

| 职责 | C 专用 Captain | A 实质作者 | W 生产 writer | V 独立 verifier |
|---|---|---|---|---|
| 候选/installer、Mandate 实质创作 | 禁止；可指出缺件、退回原作者 | 负责其获准创作范围 | 按当单角色授权，不代替 Captain | 不创作受审语义 |
| 核权威、完整材料、标准类判断 | 任命生效后负责签发审阅 | 提供接受及资格证据 | 提供执行入口和实际效果材料 | 独立核验分配证据 |
| 签发逐单完整 Mandate | 仅合法任命+控制生效后、范围内签发 | 不自签本单 | 不以 writer 资格自签 | 独验不替代合法签发 |
| 执行生产写入/持 writer mutex | 禁止 | 不由作者身份自动获权 | 唯一获准 writer | 禁止兼任本单 writer |
| 独立验读、控制资格及最终核验 | 不兼任独立 verifier | 不审自己的实质创作 | 提供原始 rc/收据供 V 核验 | 独立执行并签收据 |

每单先记录 C/A/W/V 的真实 UUID、session、职责和创作范围，核 `C≠A/W/V`，以及 V 与受审作者/生产 writer 的独立性。作者参与记录、身份延续和执行权限证明均须可复核；新建 Session 不消除同 principal 的角色冲突。C 不持生产 writer 权限的实际证明目前缺失，不能以本矩阵代替 Auth/执行控制读回。

| 能力项目 | 合法链应取得的可复核验收证据 | 当前状态 |
|---|---|---|
| 读取适用权威 | 被提名主体按 exact Spec/main revision 指出 SRA-C-001..006、相关 Contracts、合法范围与生效条件 | NOT_VERIFIED |
| 审阅 installer/闭包/回滚 | 对当次 installer hash、manifest/custody、E01–E17、full preimage 和兼容门逐项给引用；能识别缺成员或旧 PASS 误用 | NOT_VERIFIED |
| 判断 UNKNOWN / STOP | 对未知安装/远端效果/exit 证据缺失的演练作 STOP，保留 phase、mutex、fence 和 UNKNOWN；不给推测性 PASS | NOT_VERIFIED |
| 理解实际入口和收据 | 指认实际入口版本/hash、控制 owner、参数、rc、独立 readback 和失败出口；正确消费结构化收据 | NOT_VERIFIED |
| 职责独立 | 指定 principal/session 的履职记录与权限清单，核对未创作本单实质内容、不持生产 writer、不任 V | NOT_VERIFIED |

演练须由被提名主体完成、独立 V 观察并绑定候选/环境/UTC/原始结果；本 worker 的文档编写能力不转算为 C 的能力证明。

## 5. 条件③：合法登记、签发、撤销与审计路径

依据 SRA-C-001/003/006，复用 `DISPATCH-REGISTRY.json` 的可归属 `rulings` 记录及本仓 `docs/specs/AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1.md` 绑定。此包不修改 registry 或 Spec；真实 appointment ID/selector 尚未分配，不把占位符当可解析的现行记录。

1. **任命准备至登记**：mayf3 依据已选裁定确认创建请求；Auth 原合法链创建/核定身份并回读；mayf3 或明确获本裁定覆盖的有权维护者核资格、独立性、现行体系承认和条件完成情况，填写 §7，按合法链登记。不得候选自授。实际登记者 principal、权限来源和生效时刻必须可归属。
2. **控制资格与生效**：另由适用合法链绑定真实入口/版本/hash、控制 owner、负向结果和独立 V 回执；未全齐不得登记 `EFFECTIVE`。登记、SRA accepted、控制生效、逐单 Mandate 四种事实分别记账。①A 的时序不能省掉原五条件及 §6.5 的实际资格。
3. **逐单签发**：生效后 C 核期限/撤销、身份延续、范围、C/A/W/V 分离、G01–G16 签发材料及未来阶段强制门，绑定完整 Mandate 最终 hash、candidate tuple、writer、verifier、窗口/attempt；记录一次签发回执。缺签发前门即拒绝；未来事实仍标 `NOT_EXECUTED / REQUIRED_AT_STAGE`。
4. **逐写入边界**：W 与实际控制在 stage00 及每个依赖写边界重新核同一委托、期限、撤销、候选/执行者/门；C 签名不能替代控制。新 worker 必须证明属于原授权身份和范围，否则暂停相应能力。
5. **撤销/缩窄/续任/替换**：mayf3 或原有权任命者在同一 registry 链追加可追溯 ruling，绑定原 appointment ID、actor/权限、UTC、生效时间、范围、理由及受影响 Mandate；本仓留相应绑定坐标和历史。续任必须新明确期限，不自动续期；替换不覆盖旧登记、不夺锁或追认未知部署。
6. **撤销后的在飞操作**：停止新窗口和新写入阶段，保留 phase、mutex、UNKNOWN，按该单已授权 STOP/恢复配方处理；撤销本身不授权 kill、回滚、重放或清 fence。

审计不另建平台。每次签发绑定现有 Mandate/Runbook/Receipt 与 registry 台账，至少保存：`appointmentRef / issuer principal+session / sraRevision / windowID / releaseClass / candidateTuple / mandateHash / writerRef / verifierRef / gateRefs / validFrom+Until / issuedAt / revocationReadRef / entrypointVersion+hash / rawRC / result / evidenceHashes / limitations`。拒绝请求也保留脱敏拒绝原因与可核验收据，不记 Secret；执行结果、历史 UNKNOWN 和业务结果分别记录。

## 6. 条件④：实际控制的可执行验证清单

**全部为设计，当前 NOT_EXECUTED；没有可执行控制资格 PASS。** 本清单供后续实际控制适配任务逐项执行，不安装控制器、不调用生产签发/写入口，不臆造已经存在的 CLI 或错误码。

### 6.1 执行前绑定及统一步骤

- 在后续获准的隔离环境固定真实 issuance entrypoint 和各写入边界的入口路径、version/hash、控制 owner、验证命令、独立 V、环境/时钟来源；当前均 `UNKNOWN_PENDING_CONTROL_BINDING`。
- 建立一份所有必需条件合法齐备的 baseline request/fixture，固定其 SHA256、SRA/appointment/revocation snapshot、candidate/installer/Node tuple、writer/V、有效期和 gate receipts。只用隔离 fixture，不创建真实生效任命或生产 Mandate。
- 对每行从 baseline 复制，仅施加列出的输入差量；向**同一真实控制代码的隔离入口**提交一次，保存请求 hash、调用/原始 rc/stdout/stderr、机器可解析决定/原因和执行前后读回。不得用手写“拒绝”字符串或仅 mock 判定代替实际控制。
- 每例都断言：控制明确拒绝；没有有效 authority JSON/有效签发/入队执行结果；没有新生产或隔离模拟写效果、writer/mutex 状态改变；只有既有审计机制允许的拒绝记录。rc 与结果须按真实入口合同共同解释，不能仅看 HTTP 200 或 shell rc。
- V 独立复核入口版本、输入差量、拒绝原因和无效果读回。若入口无法隔离验证或根本不消费某限制，记 `NOT_TESTABLE/CONTROL_GAP` 并 STOP 对应资格；不得把此设计转换成生产探测授权。

| ID / 合同依据 | 输入差量与具体操作 | 必须观察的拒绝及边界 | 实际结果 |
|---|---|---|---|
| N01 未任命；C-001、G01、§6.5 | 使用无 appointment selector、伪造 selector、仅 NOMINATED 的 C 分别提交签发请求 | 身份/任命不成立即拒绝，不产生有效 Mandate；写边界亦不可凭请求体自报获权 | NOT_EXECUTED |
| N02 过期/未知期限；C-001、G08 | 将 now 置于 validUntil 及之后；另测 validFrom 未来、期限缺失/未知，分别请求签发；隔离在飞 fixture 到下一写边界再检查 | 不允许不在明确有效期内的签发或新写阶段；过期不自动续期，不恢复旧 UNKNOWN | NOT_EXECUTED |
| N03 越界；C-002 | 分别将目标改为其他仓/主机/runtime、releaseClass 改非标准、要求 bootstrap 后全局 pause、增加新 controller/profile/身份或 auth/Grant 改动 | 每个变体明确因超范围拒绝；不把标准签发当新权限，不到 install/bootstrap | NOT_EXECUTED |
| N04 缺门；C-003、G01–G16 | 逐一移除签发前必需材料/资格/独立 V；对未来阶段证据留 NOT_EXECUTED 并分别在该阶段前移除 fresh receipt | 缺签发材料拒签；未来事实不伪填 PASS，缺 fresh 事实拒越对应阶段；不把未来未执行一律当已通过 | NOT_EXECUTED |
| N05 错 SHA；G02/03/12/16 | 分别替换 app/harness/Node/installer/manifest、expected-old 或最终 Mandate hash 中一项，保留其他 baseline 绑定，提交签发及受影响边界验证 | 绑定漂移明确拒绝；不得将旧 tuple 的 PASS 重贴至新候选，不临场修包 | NOT_EXECUTED |
| N06 错执行者/角色冲突；C-001、G07 | 分别用非登记 C、非登记 W、新 session 无身份延续、C=A/W/V、V=作者或 writer 的 fixture 请求 | 真实身份、continuity 或分离校验拒绝；不信 UID502/请求体/角色名，不现场切身份绕过 | NOT_EXECUTED |
| N07 已撤销/缩窄；C-001、§6.5 | 为 baseline appointment 增加同链有效 revocation 或缩窄到不含本请求；分别在签发前和两写边界之间更新后提交 | 读取最新有效撤销链并拒绝新签发/新写阶段；不使用旧缓存放行，不夺锁或自动回滚 | NOT_EXECUTED |

每个“分别”变体单列子收据，不能一例通过代表整行。另用不产生真实签发效果的合法 baseline 证明隔离入口确实到达授权判定逻辑，排除“所有请求均连接失败”造成的假拒绝；此结果也不能证明生产准入。

### 6.2 每例收据和退出规则

收据至少包含：`caseID / variant / authorityRevision / appointmentRef / fixtureHash / requestHash / candidateTuple / entrypointPath+version+SHA256 / boundary / environment / clock+observedAtUTC / actor / verifier / exactInvocation / rawRC / rawOutputRef+hash / parsedDecision / reason / preReadbackRef / postReadbackRef / mutationTruth / result / limitations`。

当前所有 `rawRC=null`、`parsedDecision=NOT_EXECUTED`、verifier/资格收据为空；不能填零或 PASS。任一错误放行、未知效果、证据不可复核或角色冲突即 `affected_readiness=NO`、STOP，保存现场和原因，原责任链补具体缺件。只有全部实际结果和独立资格收据齐备，合法链才可继续生效登记。没有新控制器/profile/权限扩张授权。

## 7. 任命登记全字段草案（未登记、未任命）

下表是交 Owner/原合法链的字段稿；`UNKNOWN/PENDING` 必须由真实证据替换后再依裁定处理，不能直接作为有效任命载荷提交。

| 字段组 | 草案内容 |
|---|---|
| record kind / state | `APPOINTMENT_DRAFT_ONLY`；当前主体状态 `NOMINATED_NOT_APPOINTED`；`EFFECTIVE=NO` |
| appointment ID / selector | `UNASSIGNED`；未来 DISPATCH-REGISTRY 的唯一 ruling ID/selector 由有权登记者分配；本包路径不能充当 appointmentRef |
| 授权者 / basis | `mayf3` 依据①A与条件任命裁定；issuer 真实 Auth principal/可信身份坐标 `UNKNOWN_PENDING_LAWFUL_REGISTRAR_READBACK`；selector/hash 见 §1 |
| 登记者 / delegation | mayf3 或明确获本裁定覆盖的合法维护者；实际 principal/session、授权范围、委托期限/撤销核验与登记时间 `PENDING`；非候选自授 |
| 被任命者 / identity | designation=`release-captain-agent-core-20261107`；UUID/type/实际 agent_id/host/UID/session/worker=`UNKNOWN`；绑定收据与跨 session 延续坐标 `PENDING`；旧 uid502 仅为提名来源 |
| SRA binding | Spec 路径、accepted HEAD、main snapshot、blob/hash、PR #648 与 `EVD-CB-003`；SRA 生效/委托控制收据另填，不能用 merge 替代 |
| scope | `mayf3/dsh-agent-core`、本机**既有单一 fleet runtime**、`STANDARD_RECOVERABLE`；实际 host/runtime/入口的 exact 识别坐标待填；每单仍受 C-002 与 G01–G16 约束 |
| exclusions | 不转委托、不扩域/扩权、不任作者/生产 writer/独立 verifier、不激活新 controller/profile/trust root/helper；不授权 Secret/Grant、清 fence/锁、业务重投、危险迁移或 bootstrap 后必须全局 pause 的非标准类 |
| validFrom | `UNKNOWN_PENDING_ATTRIBUTABLE_EFFECTIVENESS_RECEIPT`；由合法可归属生效收据提供 UTC；不得用任务时间/创建时间/PR时间代填或回溯签发 |
| validUntil | **`2026-12-07T16:00:00Z`**；不自动续期；续任须新的明确授权期限和同链记录 |
| capability / independence | §4 五项实际能力收据、逐单 C/A/W/V UUID/session 与创作/权限核对、独立 V 结论；目前全部 `NOT_VERIFIED` |
| control binding | issuance/写入入口 path/version/hash、控制 owner、现行体系承认回执、身份/范围/时间/撤销/Mandate 消费关系、N01–N07逐变体结果及独立 V 资格收据；目前 `UNKNOWN / NOT_EXECUTED` |
| issuance / audit | 每单完整 Mandate、最终 hash、范围/tuple/actor/门/期限、真实签发与逐边界复核；关联 registry 台账、Runbook、Receipt；当前 `MANDATES_ISSUED=[]` |
| lifecycle | nominated 来源+①A；created/bound/qualified/registered/effective/revoked/expired 各记录实际时间、actor、来源、前继 ID、证据与受影响 Mandate；只有真实发生才登记 |
| revocation / replacement | mayf3/原有权任命者同链追加；每签发/每依赖写边界重核；在飞状态依原单 STOP/恢复配方保全；无自动 kill/回滚/重放、夺锁或追认 UNKNOWN |
| effectiveness / operation | `APPOINTMENT_RECORDED=NO`、`CONTROL_EFFECTIVE=NO`、`OPERATION_ALLOWED_NOW=NO`、`W7_ISSUED=NO` |

## 8. 开放项、责任人与交付边界

| 开放项 | 最小下一动作 / 责任人 | 禁止依赖边界 |
|---|---|---|
| 专用 principal 无匹配 | **Owner 确认创建请求**的类型、精确 ID 绑定和 custody；Auth 原合法链按其既有合法入口创建并只读反查、提供 UUID/Session/跨会话归属收据 | 本 worker 不创建；身份未唯一确认不得称已绑定或签发 |
| 能力/独立性尚无实际证据 | 原任命链组织被提名主体完成 §4 项目并由独立 V 出具可归属收据 | 不以矩阵、角色名、同 UID 或本 worker 能力代替证明 |
| 路径的运行承认和实际控制资格 | 原控制责任链在后续授权任务绑定现有入口并逐项跑 §6，V 独立核验；普通缺证回原链补齐，确需新权限仅提交 exact 新增差量 | 不把设计、accepted、任命草案或 hash 当 EFFECTIVE；不激活新特权控制器 |
| 正式任命与生命周期记录 | mayf3/合法任命链据完整证据确认字段并执行同链登记；已给条件授权不重复创造请批环节，创建请求本身按 Brief 交 Owner 确认 | 本任务不登记任命、不合并 PR、不签窗口 |

本次准备包的完成是 docs 分支提交、push 和 base=`main` 的 PR；创建、正式任命、控制实际生效、逐单签发及生产结果均未完成。独立文档审查与实际交付 HEAD 以本 PR 和 [独立审查收据](docs/reports/captain-binding-20261107/independent-review.md) 为准；文档审查不代替后续控制资格。
