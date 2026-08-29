---
spec_id: AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2
status: proposed
date: 2026-08-29
type: implementation-spec (complete standalone policy-authority successor of AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1; docs only)
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
replaces_on_acceptance: AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1
supersedes: []
superseded_by: null
governed_by:
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2
  - SCHEDULER_TIMEOUT_OUTCOME_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
scope:
  - agt_cto-agent ordered model-route policy
  - route schema, ordering, hop and stop semantics
  - Luna existing OAuth/plugin reuse policy
  - GLM terminal pre-generation quota-rejection policy
owners:
  - repository-maintainers
references:
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1.md
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2.md
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2.md
  - docs/investigations/AGT_CTO_LUNA_COLD_BACKUP_V2_EVIDENCE.md
---

# AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2 — ordered route-chain current policy

> **proposed / non-authoritative。** 本文件是 Parent V1 的 complete standalone
> whole-authority successor。它与 IMPL V2、Activation V2 必须在同一 future atomic
> acceptance transaction 中 accepted 并 merge；此前三份 V1 继续是唯一 active
> authorities，不允许 V1/V2 混合生效。本轮 docs-only。

## 0. Authoring result

```text
TASK_NAME = 冷备 执行
PARENT_V2 = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2
STATUS = proposed
REPLACEMENT_FORM = COMPLETE_STANDALONE_WHOLE_AUTHORITY
PARTIAL_SUPERSESSION = NONE
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCTION_CHANGE = NONE
```

## 1. Goal and V1→V2 delta

V2 完整吸收 Parent V1 的 ordered chain、routeKind、canonical identity、closed hop
whitelist、STOP_CHAIN、ONE_LOGICAL_TURN、single deadline、Scheduler inheritance、
journal/redaction、fleet isolation、Harness/plugin pins 与 providerEnv 安全合同。

唯一 policy delta：

1. 根据现有生产资产新证据，允许 agt_cto-agent 原位复用既有 Luna OAuth 与
   dsh-codex@0.2.3，不重新 OAuth、不安装；
2. 生产 Home current mode 冻结为 0755/uid502，credential files 保持 0600/uid502；
3. 新增独立、精确的 `provider_quota_rejected_before_generation` hop class：provider
   request 已发出，但明确终态 quota rejection 在任何模型生成前返回；仅完整安全证据成立时
   允许 GLM→Luna，任何歧义、partial output、tool、side effect、timeout 或 unknown 均 STOP。

```text
LUNA_EXISTING_OAUTH_REUSE = ALLOWED
LUNA_REAUTH_REQUIRED = NO
DSH_CODEX_REINSTALL_REQUIRED = NO
HOME_DIRECTORY_MODE = 0755
CREDENTIAL_FILES_MODE = 0600
CREDENTIAL_OWNER_UID = 502
LUNA_BACKUP_FOR_PROVEN_NO_ADMISSION = YES
GLM_429_FAILURE_CLASS = provider_quota_rejected_before_generation
GLM_429_HOP_ALLOWED = YES
LUNA_BACKUP_FOR_GLM_429_QUOTA = YES
```

## 2. Atomic authority lifecycle

proposal 阶段：

```text
PARENT_V1 = accepted/current
PARENT_V2 = proposed/non-authoritative
PARENT_V2.supersedes = []
PARENT_V1.superseded_by = null
V1_V2_MIXED_EFFECT = FORBIDDEN
```

future transaction 必须与 IMPL/Activation 两对 successor 一起原子完成：

```text
Parent V2.status proposed -> accepted
Parent V2.supersedes [] -> [AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1]
Parent V1.status accepted -> superseded
Parent V1.superseded_by null -> AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2
```

同时绑定 reviewed base/spec commit、reviewer、final accepted head、acceptance actor/time；
缺任一 edge 或三份 V2 任一未 accepted，整个 transaction abort。只有完整 transaction
merge main 后 V2 生效。

## 3. Route configuration authority

### POL-V2-001 — config-owned order

唯一 route order authority 是 deployment-owned
`/Users/authsvc/.agent-core/agent-model-overrides.json` version 2：

```text
ROUTE_CHAIN = [primary, ...fallbacks]
MAX_CONFIGURED_ROUTES = 4
MAX_ROUTE_ATTEMPTS = chain length
MAX_FALLBACK_ATTEMPTS = chain length - 1
ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN
```

JSON parser 必须在 schema parse 前递归拒绝每层 duplicate key：top-level、routeCatalog、
route entry、providerEnv、overrides、agent、model。provider/model/credentialReadiness 与
subscription plugin/pluginVersion 必须为 non-empty strings；routeRef 必须 non-empty。
unknown routeRef、duplicate routeRef、两个 ref 解析为同一 canonical identity、cycle、
chain length >4、type/schema extra/missing key 均 startup fail-loud。credentialReadiness
unsatisfied ⇒ activation fail-loud，不静默 skip/degrade。每 canonical route 每 logical turn
至多 attempt 一次；禁止 return、restart chain、unbounded attempt。

closed key sets：top-level exact `{version,routeCatalog,overrides}`；agent override exact
`{model}`；model exact `{primary,fallbacks}`。routeCatalog value 是 route entry；common exact
required keys `{routeKind,provider,model,credentialReadiness}` + optional `providerEnv`；builtin
不得有 plugin/pluginVersion，subscription 额外 exact required `{plugin,pluginVersion}`。
所有其他 key forbidden。

### POL-V2-002 — route kinds

```text
routeKind = builtin | subscription
builtin: plugin/pluginVersion ABSENT
subscription: plugin + exact pluginVersion REQUIRED
providerEnv: both route kinds optional; ABSENT/present both have deterministic canonical form
```

initial exact routes：

```text
glm53 = builtin / zai / glm-5.3 / plugin ABSENT / providerEnv ABSENT
luna = subscription / openai-codex / gpt-5.6-luna / dsh-codex / 0.2.3
```

fake dsh-zai/plugin carrier 禁止；glm53 必须使用 Harness builtin zai。

### POL-V2-003 — exact seven-field canonical identity

canonical identity 恰为：

1. routeKind；2. provider；3. model；4. plugin-or-ABSENT；
5. pluginVersion-or-ABSENT；6. credentialReadiness reference；
7. canonical providerEnv。

providerEnv canonical form：ABSENT 用唯一 sentinel；present 时固定 key order
`HTTP_PROXY,HTTPS_PROXY,NO_PROXY,NODE_USE_ENV_PROXY`，每个 value 使用经 schema
验证后的 exact string bytes，不 trim/case-fold/URL-normalize/default-port rewrite；因此值或
presence 任一差异即 identity mismatch。不得增删七字段。process reuse 仅当七字段完全
相同；否则 new generation。

## 4. Hop and stop semantics

### POL-V2-004 — closed hop classes

route_i → route_i+1 只允许以下两条互斥路径之一：

1. prompt admission 被 attempt-local machine evidence 证明为 false，且 failureClass 恰为：
   - `spawn_failed_without_child`；
   - `initialize_provider_unavailable`：explicit initialize origin、never READY、
     prompt admission=false；
   - `session_create_resume_rejection`：structured、terminal、非 timeout/unknown；
   - `turnqueue_not_admitted`：validation/capacity 或 proven pre-send zero-byte rejection；
2. failureClass 恰为独立类别 `provider_quota_rejected_before_generation`，并满足
   POL-V2-006 的全部终态、零生成、零工具、零副作用证据。

`provider_quota_rejected_before_generation` 不是 `initialize_provider_unavailable`，也不得
伪装成 `proven_no_admission`。除 POL-V2-006 的完整结构化证据外，provider HTTP
status/message/taxonomy 不是 lifecycle proof。白名单外类别默认 STOP；新增类别必须由未来
Parent whole-authority successor，禁止运行时发明。

### POL-V2-005 — STOP_CHAIN closed set

任一成立即 no further fallback、no replay：

- outcome_unknown；
- transport timeout 或 response termination 未证明；
- partial assistant/model output，或任何 assistant content；
- tool call emitted/materialized，或 tool started/executed；
- external side effect 或 side-effect uncertainty；
- 已有模型生成/assistant transcript；
- quota rejection 不明确、非终态，或缺少 POL-V2-006 任一证据；
- unknown class/evidence missing。

provider request、prompt receipt 或 user transcript 本身不等于模型生成，也不单独否决
POL-V2-006；但不得据此推断零输出、终态或安全 hop。

### POL-V2-006 — terminal quota rejection before generation

精确 failure class：

```text
GLM_429_FAILURE_CLASS = provider_quota_rejected_before_generation
GLM_429_HOP_ALLOWED = YES
LUNA_BACKUP_FOR_GLM_429_QUOTA = YES
```

该类语义为 provider request 已发出，provider 已完整、终态返回明确 quota rejection，且
模型生成从未开始。只有以下证据**全部**成立才允许 hop：

- HTTP status=429，或结构化错误码明确为 quota exhausted；
- provider response 已完整、终态返回，response termination 已被证明；
- assistant/model output token count=0；
- partial output=NO，assistant content=NO；
- tool call=NO，tool started=NO；
- external side effect=NO；
- outcome_unknown=NO；
- transport timeout=NO。

分类必须先看 output/tool/side-effect/outcome_unknown evidence，再看明确终态 quota
rejection evidence，最后才可把 provider taxonomy 文本作为 subtype；不得仅凭消息含
`quota`、`limit` 或 `429` 跳转。已有 partial output、assistant content、tool call/tool
started、transport timeout、termination 不确定、outcome_unknown 或无法确认明确 quota
rejection 的 429 全部 STOP_CHAIN。

现有真实 production 429 transcript 可作为 classifier 形状证据；不得重复消耗真实额度制造
429。它不得被误归为 `initialize_provider_unavailable` 或 `proven_no_admission`。

## 5. ONE_LOGICAL_TURN and deadline

整条 chain 对外恰好一个 logical turn、user transcript、external delivery、business reply
或 failure receipt。禁止 duplicate reply、duplicate tool side effect、duplicate occurrence。
所有 route 共用 entry 的 single deadline budget；per-hop refresh 禁止。下一 turn 总从
primary 开始，不做跨 turn fallback stickiness。

route switch 必须 new process attempt 且保持同一 logical session identity；旧 generation
不得继续 admission。

## 6. Entry points and Scheduler

onIngress、Delivery admission、Scheduler invokeAgent 三入口必须汇入一个 executor。
Scheduler 未显式 model 时仅继承 Agent chain；显式 model/route = strict one route；
job/request schema 禁止 fallback arrays。Scheduler、Dispatcher、Workflow 不得硬编码
route tuple/order或建立独立 quota router。

## 7. Journal and redaction

每 attempt 必须写入既有 durable、non-surface structured evidence/log sink；silent fallback、
transient-only 或 UI/surface-only evidence 禁止。每 attempt 固定字段：

```text
ROUTE_CHAIN_ID
ATTEMPT_INDEX
ROUTE
FAILURE_CLASS
ADMISSION_PROVEN
ATTEMPT_OUTCOME
```

final fixed fields：

```text
FINAL_ROUTE
FINAL_OUTCOME
TOTAL_ROUTE_ATTEMPTS
```

`FINAL_ROUTE` 只表示成功 route；整链失败/STOP 时必须为 `NONE`，terminal failed route
仅可由最后 attempt row 派生，不得写入 FINAL_ROUTE。canary 的 primary/fallback/activated/
count 可由 immutable chain snapshot + attempt rows 机械派生，不扩张 durable schema。
禁止 raw provider body、prompt body、token、
credential、Authorization、OAuth object。错误只记录 stable closed class。

## 8. Credential and Home policy

### POL-V2-007 — Luna existing OAuth reuse

允许 exact path `<TARGET_HOME>/.openai-codex-auth.json` 原位复用，前提：

- regular file exists；owner uid502；mode0600；
- Owner 显式接受 exact path/size/uid/mode/mtime provenance；
- operator/audit 只核验 metadata，不读取 token、不计算/输出 hash/digest；
- 禁止 OAuth login、refresh、auto-refresh、delete、copy、link、rewrite；
- 禁止读取/修改/复制 `~/.codex/auth.json` 或旧 root OAuth；
- 禁止 OPENAI_API_KEY/API credits route。

仅 exact dsh-codex@0.2.3 可在经授权的 target Luna route process 内存读取 credential，
范围包括 candidate canary、production CANARY-B，以及 ACTIVATED_TERMINAL 后普通合法
proven-no-admission 或 `provider_quota_rejected_before_generation` fallback 的 Luna attempt；
token 不得外显或持久改写。canary call count
限制不限制 future ordinary authorized fallback，但每个 ordinary logical turn 仍执行 chain
attempt/retry contract。protocol 若要求 refresh，
call fail-loud，activation rollback；不得 refresh。

metadata 不证明在线 token validity；有效性只能由被授权且计数的 canary call 成功证明。
失效只形成 blocker，不自动修复。

### POL-V2-008 — Home permissions

```text
TARGET_HOME = /Users/authsvc/.agent-core/homes/agt_cto-agent
HOME_DIRECTORY_MODE = 0755
HOME_OWNER_UID = 502
SENSITIVE_FILES_MODE = 0600
SENSITIVE_FILES_OWNER_UID = 502
```

0755 是 authsvc provisioner traverse 的生产要求；隐私边界由 file-level 0600 + uid502
保证。Parent V1 的历史 0700 bootstrap state 不再是 current requirement。

### POL-V2-009 — dsh-codex reuse

只允许既有 target-Home profile 中 exact dsh-codex@0.2.3：package exists、production
profile registered、entry loadable、19/19 peers resolvable。禁止 install/reinstall/upgrade、
其他版本、从旧 root/tmp copy、shared profile/template/global bundles 修改。

## 9. Harness and providerEnv policy

### POL-V2-010 — pins

```text
DSH_VERSION_PIN = 0.1.0-rc.8
DSH_COMMIT_PIN = 514ab7b0029141b88c807704764d0d3e1eea1da4
DSH_CODEX_PIN = 0.2.3
```

version/commit/plugin mismatch fail-loud，非 hop 类。

### POL-V2-011 — trusted identity

有 `.git` 时 git identity 优先；production 无 `.git` 时只读 deployment-owned
`.source-stamp` exact `{commit,dirtyCount}`。commit 40 lowercase hex；dirtyCount integer
且=0。missing/malformed/dirty/commit mismatch=`dsh_commit_mismatch`；version mismatch=
`dsh_version_mismatch`。禁止复制 `.git`，禁止伪造 dirtyCount=0。

### POL-V2-012 — providerEnv

providerEnv ABSENT 或 exact keys：HTTP_PROXY、HTTPS_PROXY、NO_PROXY、
NODE_USE_ENV_PROXY。present 时四值 non-empty strings；Node flag=`"1"`；proxy URL 仅
http/https、合法 host/port、无 userinfo/query/fragment/credential；NO_PROXY 必须 non-empty
comma-separated list，每 entry 只允许 `*`、合法 ASCII hostname/domain、IPv4、IPv6、
bracketed IPv6、`localhost`，以及各自合法 optional port；禁止 empty entry、任何
whitespace/control/newline、quote、backtick、`$`、interpolation 或 shell syntax。错误只
回显 key+invalid class，不回显 value。

production-runtime 启动继承 env 若含任一 uppercase/lowercase HTTP(S)_PROXY、NO_PROXY、
ALL_PROXY 或 NODE_USE_ENV_PROXY（即使空）则 startup fail-loud；不得静默 strip 后继续。
通过 startup gate 后，每次 child spawn 仍先从 child env strip 全集，再只向当前 target
canonical route 注入 exact uppercase four-key map；runtime/non-target child 全 absent。
providerEnv 不进入 initialize/turn/deliver/Binding/Session/Channel/argv/log/evidence，process
lifetime immutable。`NODE_RUNTIME_VERSION=25.6.1 exact`，mismatch startup fail-loud before
child。reload 仅 controlled target restart/new spawn；no watcher/hot update。proxy-only rollback
移除 target route providerEnv + target restart；full route rollback 移除 target override + target
restart，不改 launchd/credential/plugin。live acceptance 必须分别证明 HTTP fetch、WebSocket
CONNECT、dsh-codex auxiliary fetch 经既有单一 proxy，且 non-target proxy keys absent；再独立
证明 Feishu Luna reply、cold restart、rollback、final re-enable。单一 curl/model roundtrip
不得替代这些独立 observers。禁止 generic arbitrary per-Agent env、global proxy、proxy
 auto-discovery/health switching；禁止第二 outbound transport/daemon。providerEnv reload
不得重启其他 Agent。

## 10. Fleet and production isolation

scope 恰为 `agt_cto-agent`。其余 Agent provider/model/env/network path 零变化；
overrides 合法 Agent key 恰 `{agt_cto-agent}`。不改 Definition、Binding、launchd、
Scheduler store/job、global env、第二 Feishu consumer。raw credential 不进 override。

## 11. Delegated authorities

Parent V2 不授权产品实现或 production apply：

- IMPL V2 独占 route-chain implementation contracts 与 classifier correction；
- Activation V2 独占 readiness、deployment、config、restart、canary、rollback；
- 三者必须同一 atomic acceptance transaction，禁止 mixed V1/V2 execution。

## 12. Governance primitive record

### 12.1 Current State

Parent V1/IMPL V1/Activation V1 are accepted and sole active authorities；production is GLM
strict with no Luna fallback。Observed runtime state is frozen by CLM-V2-001..006；identity and
classifier are blocked。V2 proposal has no runtime effect。

### 12.2 Observations, Claims and Evidence

OBS-V2-001..007, CLM-V2-001..006（all `SUPPORTED`）and EVD-V2-001..006 are defined with
coordinates, revisions, environments, strength and limitations in
`docs/investigations/AGT_CTO_LUNA_COLD_BACKUP_V2_EVIDENCE.md`。Policy decisions do not convert
observations into implementation conformance evidence。

### 12.3 Decisions

DEC-P2-001=ordered config authority (POL-V2-001..003)；DEC-P2-002=closed hop/STOP/429
(POL-V2-004..006)；DEC-P2-003=existing Luna reuse and 0755/0600 boundary
(POL-V2-007..009)；DEC-P2-004=pins/identity/providerEnv (POL-V2-010..012)；
DEC-P2-005=three-V2 atomic lifecycle (§2/§11)。

### 12.4 Scope, non-goals, dependencies, migration/rollback, open questions

Scope is frontmatter + §§1/3-10；non-goals are no implementation/apply/fleet/second transport and
§13 alternatives。Authority/dependencies are frontmatter, §2 and §11。Migration is the §2
atomic transaction；runtime migration/rollback is delegated exclusively to Activation V2 and
POL-V2-012。`OPEN_QUESTIONS = NONE`；identity/classifier are gates, not unresolved policy。

## 13. Contract-by-contract acceptance

Required executed evidence must be attached to the future implementation/activation review at exact
commits; absent evidence is failure。

| Acceptance | Contract | Method | Environment | Expected result / required executed evidence | Reject when |
|---|---|---|---|---|---|
| ACC-P2-001 | POL-V2-001 | recursive parser + reorder/max/duplicate tests | clean test runtime | test log: closed schema, max4, config order, once/route | any malformed accepted/order hardcoded/retry |
| ACC-P2-002 | POL-V2-002 | builtin/subscription positive+negative fixtures | clean test runtime | exact key/type/ref results | extra/missing/wrong kind accepted |
| ACC-P2-003 | POL-V2-003 | canonical golden vectors + reuse gate test | clean test runtime | seven-field bytes and mismatch/new-generation evidence | normalization/field drift/wrong reuse |
| ACC-P2-004 | POL-V2-004 | inject four no-admission classes plus exact terminal quota class at first/middle hop | deterministic executor | each advances exactly once only under its complete evidence contract | text-derived/ambiguous hop or quota mislabeled no-admission |
| ACC-P2-005 | POL-V2-005 | inject every STOP family, including partial output/tool started/outcome_unknown/ambiguous 429 | deterministic executor | journal + acquire count prove zero next route | any replay/hop/unknown collapse |
| ACC-P2-006 | POL-V2-006 | controlled terminal-429 fixture + negative evidence matrix | pinned implementation test | exact quota/zero-output/zero-tool/terminal fixture reaches Luna attempt2 and success; every missing/unsafe predicate acquire1/Luna0 | initialize/no-admission misclassification, text-only hop, or unsafe second acquire |
| ACC-P2-007 | POL-V2-007 | lstat before/after + candidate/final/ordinary route authorization tests | target Home + isolated/production canaries | metadata unchanged; exact authorized reads; no refresh/login/copy | operator exposure, mutation, unauthorized read |
| ACC-P2-008 | POL-V2-008 | lstat/traverse test | production target Home | Home0755 uid502; sensitive0600 uid502 | mode/owner mismatch |
| ACC-P2-009 | POL-V2-009 | exact package/registration/peer/import checks | production x64 offline | 0.2.3, 19/19, import PASS, install count0 | version/load/peer/install mismatch |
| ACC-P2-010 | POL-V2-010 | resolved pin probes | candidate + production | exact Node/Harness/plugin pins; mismatch fail-loud | mismatch starts child or hops |
| ACC-P2-011 | POL-V2-011 | git/stamp positive+negative suite + deployed read-back | test + production installed tree | valid clean identity; missing/malformed/dirty fail-loud | version-only trust/forged dirty0 |
| ACC-P2-012 | POL-V2-012 | grammar/env/startup/reload/rollback + independent live observers | test + controlled target production | inherited-env reject; target-only exact map; HTTP/WS/aux/Feishu/cold/rollback evidence | value leak/global env/other restart/missing observer |
| ACC-P2-013 | §2/§11 | exact-head governance diff review | repository | all three pairs and backlinks in one acceptance commit | partial/mixed authority or missing link |

## 14. Rejected alternatives

partial supersession、fresh OAuth、0700 current requirement、plugin install/upgrade、ambiguous或
text-only quota hop、把 quota class 伪装成 initialize/no-admission、partial-output/tool-started/
outcome_unknown fallback、post-generation replay、hardcoded route、per-hop deadline reset、second
transport、fleet rollout 均 REJECTED。

## 15. Final

```text
TASK_NAME = 冷备 执行
PARENT_V2 = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2
LUNA_REAUTH_REQUIRED = NO
DSH_CODEX_REINSTALL_REQUIRED = NO
HOME_DIRECTORY_MODE = 0755
LUNA_BACKUP_FOR_PROVEN_NO_ADMISSION = YES
GLM_429_FAILURE_CLASS = provider_quota_rejected_before_generation
GLM_429_HOP_ALLOWED = YES
LUNA_BACKUP_FOR_GLM_429_QUOTA = YES
AMBIGUOUS_429_STOP_CHAIN = YES
PARTIAL_OUTPUT_429_STOP_CHAIN = YES
TOOL_STARTED_429_STOP_CHAIN = YES
OUTCOME_UNKNOWN_429_STOP_CHAIN = YES
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
LUNA_MODEL_CALL = NO
LUNA_OAUTH_TOUCHED = NO
NEXT_TASK = 冷备 审计
```
