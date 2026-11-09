# Captain 专用身份创建核验与五条件证据包

本次结论为 **STOPPED_BEFORE_CREATE**。`release-captain-agent-core-20261107` 保持 `NOMINATED_NOT_APPOINTED`；未创建、未绑定、未任命、未生效、未签发。Owner 已批准身份创建目的，当前缺的是合法执行身份及 Auth canonical 方案的权威证明。详细差量见 [STOP 报告](STOPPED-CAPTAIN-CREATE.md)，任务原文见 [Brief](BRIEF-CAPTAIN-CREATE.md)。

## 1. 授权、基线与路由

Owner 原件 `DISPATCH-REGISTRY.json` 的 `$.rulings[id=owner-20261107-standing-delegation].items[3]`（§4）已直接读取；整条 ruling 的 canonical SHA256 为 `01cc059c2bf0e0493588f00032ca06eb73e3a0a13cb33f4078996fdccb79dad3`。原文及算法见 [owner-authority.json](docs/reports/captain-principal-creation-20261107/owner-authority.json)。这是一次身份记录创建授权；本任务另明确禁止任命、Client/Secret/Grant/helper/生产写权限和 runtime/8788 操作。

复用 [PR #656](https://github.com/mayf3/dsh-agent-core/pull/656) `fcaba5fa6c948a0871478181f8e3bdd262aa43ee` 的绑定准备及角色矩阵。本次后来的 §4 已解除此前“创建目的待 Owner 确认”，无需重复请批；旧包仍只作证据，不能充当 accepted authority。当前唯一 governing SRA 为 [AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1](docs/specs/AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1.md) 的 SRA-C-001..006。

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
WORKTREE = /private/tmp/h-captain-create
ENTRY_HEAD = 24974c720d634b965943e08bfd0862657b9be0e1
BASE_HEAD = 9df5bd2fdea17f04bcd1762cd6800c350efcf9c3
CURRENT_BASE_HEAD = 9df5bd2fdea17f04bcd1762cd6800c350efcf9c3
ISOLATED_REF = docs/captain-principal-creation
REVIEW_TARGET_HEAD = NOT_APPLICABLE  # precommit; independent receipt binds actual commit
GOAL_OR_TARGET = identity-only creation if lawful, otherwise exact STOP delta and docs PR
CURRENT_GAP = no authenticated management actor; canonical pair/session not established
OBSERVATIONS = EVD-CC-001..004 below
WORKING_GUESS = NONE; proposed spelling is not identity evidence
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1 / SRA-C-001..006
RELATED_AUTHORITIES = Auth accepted Foundation/CSESB/Ownerless; Minimal Auth V2
AUTHORITY_ACCEPTED_IN_BASE = YES
IMPLEMENTATION_AUTHORITY = none for Core SRA; no product implementation requested
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO
ROUTE_STAGE = OPERATION
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
EXECUTION_MANDATE = VALID  # conditional Owner mandate; actual create gate failed
MUTATION_AUTHORIZATION = VALID  # docs/STOP delivery; not API authentication
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = YES
CONTROLLED_RUNBOOK_STATE = NO_EXECUTABLE_CREATE_RUNBOOK; ZERO_CREATE_ATTEMPTS
SPEC_GAP_DEPENDENCY = NONE  # existing entry and evidence gates located
EVIDENCE_REVIEWABILITY = PASS  # only source and sanitized observations
LIVE_AUTHORITY_GAP = DETECTED
OWNER_DECISION_REQUIRED = NO  # same purpose approved; new effects require separate decision
EMERGENCY_STATE = NONE
EMERGENCY_ACTION = NONE
INCIDENT_REFERENCE = NOT_APPLICABLE
BASE_IMPACT = BOUNDED; entry-to-base delta does not change relevant authorities
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO; task forbids merge
OPERATION_ALLOWED = NO; docs delivery remains authorized
EVIDENCE_NEEDED = existing Auth administrator/custody, exact typed identity, loaded entry/readback
DONE_WHEN = STOP delta and five-condition package committed, pushed, PR main open, receipt
EXPANSION_TRIGGER = new credential/Grant/helper/Core/runtime effect or authority conflict
NEXT_REAL_ACTION = complete STOP documentation and unmerged PR
NEXT_ACTION = STOP  # identity operation; authorized STOP/docs delivery continues
```

这些字段是本次资格解释，不送入任何执行控制。没有创建 authority JSON、控制 provider 或可执行任命载荷。若后续确需改变长期 Contract，原责任链重新 PREFLIGHT；本包不预先认定必须新建 Spec。

SRA 接受坐标已在本 base：accepted-by `mayf3`，at `2026-11-07T07:26:44.290920Z`，reviewed proposed head `8fdd5e9dc4f9cf525188d6ac19f986e0191e9604`，final accepted head `459c7de7a98a96c43cbea34cc315cc9a49ddbe12`，[PR #648](https://github.com/mayf3/dsh-agent-core/pull/648) merge `55f442c74414dc723306a6d8e0cdba73d78eb8da` 是本 base 祖先。文件 SHA256=`a0b5959ce5a3ef0007c86b486670598216f11c3c62eaac70693dbc7f3cfb3427`。SRA accepted、Captain appointed、control effective、每单 Mandate issued 是四个独立事实；本次只证实第一项。

## 2. Auth 合法入口与仅身份隔离

已读安装态 [auth-service skill](/Users/yanfenma/.openclaw/skills/auth-service/SKILL.md) 与其 API reference，并核对 Auth accepted main `2228195f53d603a961b033bdcd600ec5a83ba12d`。本地 Auth checkout `862eab36677d214b2ce340f49bb141173b51efea` 落后 35；没有从该 checkout 执行管理命令或修改其文件。精确 blob/hash 见 [source-provenance.json](docs/reports/captain-principal-creation-20261107/source-provenance.json)。skill 的旧端点清单不覆盖当前 S1 管理 API，脚本 name lookup 不能建立 canonical 归属。

| 事实 | Auth main 源码 / accepted authority | 本次结论 |
|---|---|---|
| 类型 | Minimal Auth V2 exact-incorporated V1 root §6：`user/agent/service`；schema MachinePrincipal 为 `agent/service` | 专用 Agent 路线必须显式 `principal_type=agent`，不能依赖默认 `service` |
| S1 管理入口 | `src/routes/idempotent.ts:112-139`，`POST /api/v1/principals`，仅调用 `createOrGetPrincipal` | 源码存在身份与 Client 分离的路径；已加载精确版本绑定未证明 |
| 认证 | `src/middleware/v1-management-auth.ts:59-115` | 既有合法 V1 RS256 machine access token，`aud=svc-auth`、scope `auth.identity.provision`，active Principal/Client 且所属相符；本 actor 未建立此资格 |
| 新建分支效果 | `src/lib/oauth/v1/idempotent.ts:278-312` | INSERT 一个 `machine_principals` 身份和 `principal.created` audit；不创建 Client/凭据/Grant/lifecycle |
| 幂等及冲突 | 同文件 `114-275,314-362` | resolve 可回填旧记录 requestDigest；显式 expectedPrincipalId 可 claim；POST 不能当只读探测，未知结果不能盲重试 |
| 禁止入口 | `src/routes/idempotent.ts:143-189`，`POST /api/v1/clients` | 会创建一次性 secret，并可能补 fleet/history Grant；本任务完全不调用 |
| 旧 CLI | `src/cli/machine-admin.ts:87-96`；`src/lib/oauth/service.ts:78-85` | deprecated 管理路径，不能用它绕过缺失的现行 API 认证和 canonical 门 |
| Auth status | `prisma/schema.prisma:93-119` | `active/disabled`；`created_not_appointed` 是交付记录状态，不是可写入 Auth enum 的新值 |

Canonical AGENT 的语法是 `^agt_[a-z0-9-]+$`、长度 5..128；故候选 spelling 为 `agt_release-captain-agent-core-20261107`。accepted Foundation 的 CTR-CIF-001/003 要求 exact typed pair、active AGENT、显式 canonical lifecycle、反向唯一；缺 lifecycle 是 unresolved。accepted CSESB 的 CTR-CSESB-002/004 要求合法 exact-pair attestation、fresh unique enabled Core Definition，并且不创建 Principal/Definition。`scripts/canonical-subject-enrollment.ts:21-29,55-56` 无可信 evidence provider 时拒绝；不能自己造 provider 或用 SQL 代替。以上只证明源合同和源码，不证明任何生产 pair 已满足。

Owner 授权使用 Auth 权威验证的方案，未指定 UUID、external_ref、owner_user_id 或 Session。因此这些字段保持 UNKNOWN，交 Auth 原责任链核定；不因角色名、当前 OS UID、同名 Session 或 `agt_` 前缀推定身份。若所需 Core Definition 尚不存在，创建它超出本任务工作面，不在此处顺带执行。

## 3. 只读结果、创建状态与 Evidence

2026-11-07T15:01:17Z，`GET /api/health` HTTP 200，`authContractVersion=1.15.0`、digest=`78e51dc942356da289840dbae1c79c753925f0acc7ea566e55c06614545cb291`。管理 GET 无 Bearer 返回 HTTP 401。安装 skill 的 `auth_ro` 数据库查询 rc0，read-only=on、SELECT=true、INSERT=false，精确候选查询 `[]`，无状态过滤。完整原文及限制见 [只读观察](docs/reports/captain-principal-creation-20261107/auth-readonly-observations.json)。

早先对非文档路径 `/health` 的诊断 GET 返回 404；随后按源码记录的 `/api/health` 更正读回。该 404 不用于判断服务故障或权限。所有 HTTP 操作都是 GET，没有创建尝试或失败写入待对账。health 的版本和 plist 路径不证明完整 loaded code、actor custody 或 canonical readiness。

```text
AUTH_CREATE_POST_ATTEMPTS = 0
CREATION_RECEIPT = NONE
IDENTITY_CREATION_STATE = NOT_CREATED_BY_THIS_TASK
PRINCIPAL_UUID / ACTUAL_TYPE / ACTUAL_AGENT_ID = UNKNOWN
SESSION_BINDING / CANONICAL_LIFECYCLE = UNKNOWN
APPOINTMENT_STATE = NOMINATED_NOT_APPOINTED
APPOINTMENT_RECORDED / CONTROL_EFFECTIVE / MANDATE_ISSUED = NO
CREATED_NOT_APPOINTED = NOT_REACHED
```

| Evidence | Observation → 支持的断言 | 充分性及限制 |
|---|---|---|
| EVD-CC-001 | Owner 选中原文、selector/hash → 本次条件创建及 STOP/docs 交付已授权 | 可复核来源；不授权新凭据、任命、控制激活或生产效果 |
| EVD-CC-002 | Auth accepted main blob/hash、独立源码核验 → 存在隔离 S1，canonical 与创建分离 | 只证明源层；不推导已加载或当前操作者有权 |
| EVD-CC-003 | 带 rawRC/原文的 HTTP/READ ONLY SQL → 当前请求无认证被拒绝、auth_ro 无 INSERT、局部无匹配 | 不宣称管理员全局不存在，不凭零行推导其他主机无身份 |
| EVD-CC-004 | main 祖先关系、SRA 内容 hash、独立权威核验 → SRA accepted/main 子项成立 | 不证明任命、控制资格、签发或生产结果 |

## 4. 五条件状态与下一动作

以下按 standing §4 的简写分五项，并保留早先 `owner-20261107-sra-formalization.items[1]` 的完整门。尤其 SRA accepted main 和独立控制资格未被简写省略。

| 条件 | 已有证据 | 当前状态 | 最小缺件 / 责任主体 |
|---|---|---|---|
| ①唯一 Principal + Session / 跨会话绑定 | §2 类型、语法及局部无匹配观察 | NOT_ESTABLISHED | Auth 管理员一次合法身份创建回执、exact typed/canonical 读回；可信 Session/worker 归属来源 |
| ②能力资格 | §5 验收清单、SRA-C-001 | NOT_VERIFIED | 指定 principal 的实际任务收据，独立 V 核验；本 worker 的能力不转移给候选 |
| ③独立性 | §5 A/W/V/C 矩阵；既有 #649/#656 方案仅作输入 | NOT_VERIFIED | 每单四类真实 UUID/session、创作归属和执行权限的独立核对 |
| ④体系承认及任命/签发/撤销/审计路径 | SRA-C-001/006；SRA accepted main 已满足 | PARTIAL_SOURCE_ONLY | 有权登记者真实身份和委托、现有路径消费证明；本次登记草案不是任命记录 |
| ⑤实际控制负向 + 独立资格 | §7 N01–N07 设计 | NOT_EXECUTED | 合法隔离入口的版本/hash、正向对照及逐变体拒绝/无效果读回、非作者 V 回执 |

五条件未全部满足；任命、签发和后续生产依赖资格全部为 NO。普通缺证交原责任链补齐；若补齐确需新 Client/Grant/Core runtime/helper 等禁止效果，仅升级具体最小差量。

## 5. 职责分离矩阵与能力资格清单

`C=Captain`、`A=本单候选/installer/Mandate实质作者`、`W=生产writer`、`V=独立verifier`。每个角色须填真实 principal/session、任务与授权；相同 UID 不能证明不同身份。此矩阵是要求，实际绑定均 UNKNOWN。

| 工作 | C | A | W | V |
|---|---|---|---|---|
| 候选、installer、Mandate 实质创作 | 本单禁止兼任 | 负责获准创作 | 不以执行身份自授接受 | 不创作受审语义 |
| 核权威、标准类、完整证据 | 任命生效后审阅并签发 | 提供材料与修复 | 提供实际入口/效果/前态 | 独立核验 |
| install/bootstrap/其他生产写 | 禁止兼任 | 不凭作者身份执行 | 依当次 Mandate 唯一执行 | 禁止兼任 W |
| 独立后态与资格验收 | 不兼本单 V | 不自验收 | 不自验收 | 负责可归属核验 |
| 任命、续任、替换、撤销 | 不自授、自续或转委托 | 无自动资格 | 无自动资格 | 无自动资格；由不同有权维护者处理 |

每项能力由被提名主体在合法、无生产效果环境完成，收据必须含 exact actor/session、输入与权威版本、实际判断、证据坐标、UTC、独立 V。全部状态为 NOT_VERIFIED：

| 能力 | 可审核任务与通过要求 |
|---|---|
| 读取适用权威 | 找出实际 main 接受链、SRA 范围和优先级，不以源码/PASS/分支文档代替权威 |
| installer / 完整闭包 / 回滚 | 对真实冻结材料逐项核 app/harness/Node/installer/effects/preimage，指出缺件与失效门 |
| UNKNOWN / STOP | 解释未知写入、旧 worker/tool/effects 与 no-replay/fence 边界，给出精确停止和对账动作 |
| 入口与收据 | 按入口合同解析真实 rc/receipt/readback，区分 started、source PASS、loaded、业务结果 |
| 分类、时效、撤销与角色 | 标准/非标准及 G01–G16 审阅；拒绝过期/撤销/越界/缺门/漂移/角色冲突；证实职责分离 |

## 6. 任命、撤销及审计登记草案

这是 **APPOINTMENT_DRAFT_ONLY**，不提交给运行入口，不产生 appointmentRef。

| 字段 | 草案 / 待证事实 |
|---|---|
| state / designation | `NOMINATED_NOT_APPOINTED` / `release-captain-agent-core-20261107` |
| principal / canonical pair | UUID、实际 type/agentId、lifecycle、exact Auth readback=`UNKNOWN`；仅语法候选见 §2 |
| session / host / UID / worker | 可信绑定及跨 session continuity=`UNKNOWN`；不使用本 worker、历史 reviewer_session 或 uid502 顶替 |
| appointment ID / issuer / registrar | `UNASSIGNED`；issuer 与不同有权维护者的真实 principal/session、委托范围/时效/撤销证明待填；依据 §4 原件与 SRA |
| SRA revision | 本包 §1 exact accepted/main 坐标；控制生效另填实际收据 |
| scope | `mayf3/dsh-agent-core`、既有单一 fleet runtime、`STANDARD_RECOVERABLE`；实际 target/入口坐标待登记，不得扩域 |
| exclusions | 不任本单 A/W/V，不转委托；无 Client/Secret/Grant/helper/新 controller/profile/trust root/生产写权；不清 fence/锁、不重放 |
| validFrom | `UNKNOWN_PENDING_ATTRIBUTABLE_EFFECTIVENESS_RECEIPT`；不得用身份创建/任务/PR 时间代填，不追溯 |
| validUntil | **`2026-12-07T16:00:00Z`**；续任/替换由不同有权维护者登记新期限、身份核验和可撤销记录 |
| capability / independence | §5 实际主体资格与每单 C/A/W/V 证据；目前 NOT_VERIFIED |
| control binding | 现有签发及写边界如何消费 issuer/scope/time/revocation/Mandate；入口 version/hash、控制 owner、§7 资格收据待填 |
| appointment path | 复用现有可归属台账/PR 的唯一登记链，由有权者办理；五条件完成后方可任命；本包不登记、不授予角色 |
| audit path | 同链保存 nominated/created/bound/qualified/appointed/effective/revoked/expired 的实际事件、actor、UTC、前继、证据和受影响 Mandate；不建第二生产账本 |
| revocation path | Owner/原有权任命者同链追加撤销/缩窄；签发及每个依赖写边界 fresh 重核；在飞状态按原 Mandate STOP/恢复，保留 mutex/UNKNOWN |
| current effect | `APPOINTMENT_RECORDED=NO`、`CONTROL_EFFECTIVE=NO`、`MANDATES_ISSUED=[]`、`W7_ISSUED=NO` |

## 7. §6.5 负向验证清单

清单全部 **NOT_EXECUTED**，`rawRC=null`，没有生产探测授权。原控制责任链须先提供能无生产效果运行的合法隔离入口与正向对照，绑定 exact version/hash、fixture/clock、pre/post readback、actor 与独立 V。所有变体分别留收据；连接失败/401本身不能证明业务门正确。

| ID | 输入变体 | 必须观察的拒绝与无效果边界 | 实测 |
|---|---|---|---|
| N01 未任命 | 无/伪 appointmentRef、只有 NOMINATED | 拒绝签发及依赖写入；不产生有效 Mandate | NOT_EXECUTED |
| N02 过期/未知时效 | now=validUntil 及以后、未来 validFrom、缺失或未知期限 | 拒绝新签发及新写阶段；不自动续期/追溯 | NOT_EXECUTED |
| N03 越界 | 其他仓/host/runtime、非标准类、bootstrap后全局pause、权限/Grant/controller改动 | scope/class 边界拒绝，不进入 install/bootstrap | NOT_EXECUTED |
| N04 缺门 | 逐一移除签发必需材料/独立V；在每阶段边界移除应已完成的fresh证据 | 拒签或拒越该阶段；未来未执行门不能填 PASS | NOT_EXECUTED |
| N05 错 SHA | 分别改 app/harness/Node/installer/manifest/expected-old/Mandate hash | 精确绑定漂移拒绝；不能复贴旧 tuple 的 PASS | NOT_EXECUTED |
| N06 错执行者/冲突 | 非登记 C/W、新 session无continuity、C=A/W/V、V=A/W | 按可信身份及职责拒绝；不相信 UID/角色名/自报JSON | NOT_EXECUTED |
| N07 撤销/缩窄 | 签发前与两个写边界之间追加有效同链撤销/缩窄 | fresh revocation 检查拒绝新阶段，保全在飞状态 | NOT_EXECUTED |

每个子例留 `caseID/variant/authorityRevision/appointmentRef/requestHash/fixtureHash/candidateTuple/entrypointVersion+hash/environment/clock+observedAtUTC/actor/verifier/exactInvocation/rawRC/rawOutputRef+hash/decision/reason/preReadback/postReadback/mutationTruth/result/limitations`。正向对照只证明合法隔离入口到达授权逻辑，不产生真实签发。若入口不能隔离、不能消费某门或结果未知，记 CONTROL_GAP/UNKNOWN 并停止对应资格，不增建 helper 或权限来凑 PASS。

## 8. 后续责任链与本次交付

Auth 原管理员优先使用既有管理身份完成 exact identity-only 路径核定和一次受控执行，提供 UUID/type/agentId/external_ref、actor、授权、请求 hash、rawRC/HTTP、审计、创建后反查与独立 readback。未知结果先对账，不重试；若需要外工作面效果，按 STOP 表只提交最小差量。本 worker 无创建尝试，不保留重试计数伪装成成功。

身份回执到达后，原任命链补齐 Session、能力、职责、体系承认、实际控制负向和独立资格。创建、任命、控制生效、逐单签发分别登记；本包和 PR 不能自动激活其中任何一步。本次只完成 STOP 证据交付，最终 commit/远端/PR 与独审见 [交付收据](RECEIPT-CAPTAIN-CREATE.md)。
