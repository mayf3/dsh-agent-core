---
spec_id: AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2
status: proposed
date: 2026-08-29
type: implementation-spec (complete standalone whole-authority successor of AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1; docs only)
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
replaces_on_acceptance: AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1
parent_policy_authority: AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2
supersedes: []
superseded_by: null
governed_by:
  - AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2
  - SCHEDULER_TIMEOUT_OUTCOME_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
scope:
  - version-2 route config loader and canonical identity
  - unified three-entry ordered route-chain executor
  - admission-first failure classifier and GLM 429 regression
  - controlled one-shot target canary injection seam
  - process reuse/new-generation, single deadline, journal and Scheduler inheritance
owners:
  - repository-maintainers
references:
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1.md
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2.md
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2.md
  - docs/investigations/AGT_CTO_LUNA_COLD_BACKUP_V2_EVIDENCE.md
---

# AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2 — ordered-chain implementation contracts

> **proposed / non-authoritative。** Complete standalone whole-authority successor of
> IMPL V1。必须与 Parent V2、Activation V2 同一 atomic acceptance transaction；此前
> IMPL V1 保持唯一 active implementation authority。本轮 docs-only，不修改代码。

## 0. Authoring result

```text
TASK_NAME = 冷备 执行
IMPL_V2 = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2
STATUS = proposed
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCT_CODE_CHANGE = NONE
```

## 1. Goal and delta

V2 完整吸收 IMPL V1：v2 loader、routeKind/canonical identity、统一三入口 executor、
route-aware process reuse/new generation、closed hop/stop、one logical turn、single deadline、
fixed journal、Scheduler inheritance、strict explicit model、isolation/redaction。

新增且有界的 implementation deltas 恰为两项：(1) 修复 failure classifier precedence，
实现独立精确类 `provider_quota_rejected_before_generation`，只在明确终态 quota rejection
且零生成/零工具/零副作用的完整证据成立时 hop，任何歧义证据均 STOP；(2) 为 Activation V2
冻结默认关闭、target-only、one-shot 的 controlled terminal-429 fixture seam，消除执行轮临时
机制选择并避免靠真实额度耗尽测试。

```text
QUOTA_CLASSIFIER_FIX_REQUIRED = YES
GLM_429_FAILURE_CLASS = provider_quota_rejected_before_generation
GLM_429_HOP_ALLOWED = YES
LUNA_BACKUP_FOR_GLM_429_QUOTA = YES
```

## 2. Atomic lifecycle

proposal：IMPL V1 accepted/current；IMPL V2 proposed/supersedes[]/inactive。
future acceptance 必须与 Parent、Activation 两对 successor 同一 transaction：

```text
IMPL V2.status proposed -> accepted
IMPL V2.supersedes [] -> [AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1]
IMPL V1.status accepted -> superseded
IMPL V1.superseded_by null -> AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2
```

三份 V2 exact reviewed heads + all six backlinks + README 必须一个 docs-only acceptance
commit；merge main 前不生效。V1/V2 mixed implementation forbidden。

## 3. Exact implementation scope

授权产品文件仅：

```text
packages/production-runtime/src/model-overrides.js
packages/production-runtime/src/compose.js
packages/agent-router/src/route-chain.js
packages/agent-router/src/process-registry.js
packages/agent-router/src/ingress-delivery.js
packages/agent-router/src/index.js
packages/scheduler-router/src/index.js
```

以及直接对应测试：

```text
packages/production-runtime/test/model-overrides.test.js
packages/agent-router/test/route-chain/*.test.js
packages/agent-router/test/ingress-delivery.test.js (only if existing seam test is required)
packages/scheduler-router/test/*.test.js (only direct bridge tests)
```

实际 implementation PR 必须先冻结 exact path manifest；不需要变化的文件不得为制造
scope 而改。AgentProcess evidence envelope、provider adapter、Harness、dsh-codex、
credential/provisioning、production config、launchd、Scheduler engine/store、Binding、
Definition、Feishu connector 均不在 IMPL V2 scope。若现有 carrier evidence 不足，
implementation BLOCKED，须另行 whole-authority successor，不得扩 scope。

## 4. Loader contracts

### CTR-I2-001 — version 2 schema

loader startup-only 同步读取 deployment config；version 必须=2；合法 top-level exact
keys `{version,routeCatalog,overrides}`。在 schema parse 前递归检测 duplicate JSON key，
逐层覆盖 top-level/routeCatalog/route entry/providerEnv/overrides/agent/model；任一 duplicate
立即 fail-loud。routeCatalog/override 必须 plain objects；unknown、extra、missing/type error
fail-loud。合法 Agent override key 恰 `{agt_cto-agent}`。

model override exact keys `{primary,fallbacks}`；fallbacks array；
`ROUTE_CHAIN=[primary,...fallbacks]`，长度1..4。所有 refs exist，无 duplicate ref，
无 duplicate canonical identity。

### CTR-I2-002 — route schema

common required：routeKind、provider、model、credentialReadiness；后三者必须 non-empty
strings，routeKind closed enum。credentialReadiness reference 必须 resolve 且 ready，否则
activation fail-loud，无 silent skip/degrade。

- builtin：plugin/pluginVersion forbidden；
- subscription：plugin/pluginVersion required、non-empty strings，version exact；
- providerEnv optional for both；present 时 exact four-key validated object；
- unknown keys fail-loud。

initial glm53 builtin tuple 的 providerEnv/plugin/pluginVersion 均 ABSENT；Luna tuple 为
openai-codex/gpt-5.6-luna/dsh-codex/0.2.3。

### CTR-I2-003 — exact canonical identity

恰好七字段：routeKind、provider、model、plugin-or-ABSENT、pluginVersion-or-ABSENT、
credentialReadiness、canonical providerEnv。present providerEnv 固定顺序
`HTTP_PROXY,HTTPS_PROXY,NO_PROXY,NODE_USE_ENV_PROXY` 且保留 validated exact string bytes，
不 trim/normalize；ABSENT 用唯一 sentinel。stable deterministic serialization 不依赖 object
insertion order。duplicate canonical identities config fail-loud。

### CTR-I2-004 — providerEnv

逐字执行 Parent V2 POL-V2-012，包括 NO_PROXY 的 ASCII hostname/domain、IPv4/IPv6/
bracketed IPv6/localhost/`*` + optional port closed grammar，以及 empty/whitespace/quote/
backtick/`$`/interpolation/shell prohibitions。runtime inherited proxy key 任一 present 即
startup fail-loud；Node 25.6.1 exact gate；通过后 child spawn 才 strip 全集并 target-only 注入 exact map；
process-lifetime immutable、target-only reload、proxy/full rollback、独立 HTTP/WebSocket/
auxiliary live observers 全部保留。errors/redaction 不回显 value。

## 5. One unified executor

### CTR-I2-005 — entry convergence

以下入口必须调用同一个 ordered route executor，不得各自复制 policy：

```text
onIngress -> runTurnWithRouteChain
Delivery deliver/admit -> admitWithRouteChain
Scheduler invokeAgent -> published Router runTurnWithRouteChain
```

scheduler-router 只依赖 published surface，不 import executor internals。

### CTR-I2-006 — chain snapshot and order

turn/admission entry 创建 immutable chain snapshot；strict explicit model request = one route,
zero fallback。遍历严格 index order；每 canonical identity attempt once；成功立即终止。
下一 turn 从 primary 开始。

### CTR-I2-007 — route-aware process acquisition

registry reuse gate 比较 exact seven-field identity。match 才 reuse；mismatch 永不复用，
为 attempt spawn new generation，route 不 mutate。mismatched idle process 必须走既有
controlled shutdown（bounded grace、await real exit）；busy mismatched process 永不 force-kill，
只是不复用并留待自身 lifecycle 收敛。old generation 不得接收该 logical turn；reuse 与
turn-local attempted-once accounting 正交。

## 6. Failure classifier

### CTR-I2-008 — evidence precedence

分类优先级精确冻结为：

1. assistant/model output、partial output、tool call/tool started、external side effect、
   outcome_unknown、transport timeout 或 termination uncertainty evidence；任一 unsafe/unknown
   均立即 STOP；
2. 明确终态 quota rejection evidence：status=429 或结构化 code 明确 quota exhausted，且
   response 完整终止、output tokens=0、partial/content/tool/side-effect/unknown/timeout 全部为
   proven NO；全部成立才归 `provider_quota_rejected_before_generation`；
3. provider taxonomy/message 文本只可作为 subtype，绝不单独构成 hop proof；otherwise
   unknown STOP。

既有 explicit startup/initialize、structured session rejection 与 turnQueue not_admitted 仍按其
结构化 lifecycle evidence 分类，但不得覆盖第1项，也不得借 provider taxonomy 伪造 origin。
不得仅凭错误消息包含 `quota`、`limit` 或 `429` 跳转。provider request、prompt receipt 或
user transcript 本身不等于 generation；但也不证明 generation 未开始。`FAIL_LOUD_PROVIDER_ERRORS`
不得覆盖上述优先级。

### CTR-I2-009 — whitelist implementation

non-null hop class 只可来自两条互斥路径：(a) Parent V2 四类，且 admission=
`proven_no_admission`；或 (b) 独立类 `provider_quota_rejected_before_generation`，且
CTR-I2-008 的全部 terminal/zero evidence predicates 为真。该 quota class 不是
`initialize_provider_unavailable`，admission 也不得伪装成 `proven_no_admission`。
`initialize_provider_unavailable` 仍要求 explicit initialize origin + never READY + no prompt
attempt。bare provider error、HTTP code/message、quota text 不足。

### CTR-I2-010 — exact terminal GLM 429 result

对 controlled exact quota carrier：

```text
providerClass = account_quota_exhausted
failureClass = provider_quota_rejected_before_generation
admissionProven = provider_request_sent_generation_not_started
hopAllowed = true
attemptOutcome = hop:provider_quota_rejected_before_generation
TOTAL_ROUTE_ATTEMPTS = 2
FALLBACK_ACTIVATED = true (derived)
LUNA_MODEL_CALL_COUNT = 1
FINAL_ROUTE = luna
FINAL_OUTCOME = success
```

该 carrier 必须证明 status/code quota、response terminal、output tokens=0、无 partial/content、
无 tool call/start、无 external side effect、无 outcome_unknown、无 transport timeout。任一字段
缺失、false/unknown 或 termination 未证明时，glm53 attempt 1 后 STOP，second acquire=0、
Luna call=0、FINAL_ROUTE=NONE。

### CTR-I2-011 — exact regression tests

至少覆盖：

A. config primary glm53/fallbacks[luna] + exact terminal 429、零输出、零工具 fixture：
   glm53 attempt1 → luna attempt2 → success；`TOTAL_ROUTE_ATTEMPTS=2`、
   `FALLBACK_ACTIVATED=true`、`FINAL_ROUTE=luna`、`LUNA_MODEL_CALL_COUNT=1`；
B. 429 + partial output：attempts=1、Luna calls=0、STOP_CHAIN；
C. 429 + outcome_unknown：attempts=1、Luna calls=0、STOP_CHAIN；
D. 429 + tool started：attempts=1、Luna calls=0、STOP_CHAIN；
5. 429 + assistant content、tool call、external side effect、transport timeout、termination unknown
   或 ambiguous/text-only quota 各自 attempts=1、Luna calls=0、STOP；
6. explicit initialize-origin quota + never READY + admission=false 只按既有 class 2 hop，
   不得误用新 quota class；
7. all four valid no-admission classes each hop once；
8. no next route/budget exhaustion stop；
9. journal contains only frozen fields and no raw error body。

## 7. Executor safety

### CTR-I2-012 — hop gate

hopAllowed = next route exists AND deadline budget remains AND 以下互斥条件之一成立：

- failureClass 为既有四类之一 AND admission=`proven_no_admission`；或
- failureClass=`provider_quota_rejected_before_generation` AND CTR-I2-008 全部精确 quota
  predicates proven true。

否则 STOP/terminal。last route failure terminal；no cycle/restart。quota class 不得通过
`proven_no_admission` 分支。

### CTR-I2-013 — one deadline

entry computes one monotonic deadline；every spawn/initialize/session/admission/turn receives
remaining budget。hop 不刷新。budget exhausted before admission STOP；termination unknown
never hop。

### CTR-I2-014 — ONE_LOGICAL_TURN

executor owns one logical result promise/receipt/delivery。route hop 只可发生于 proven-no-admission
路径，或 provider request 已发出但 generation 从未开始且完整终态 quota evidence 成立的精确
例外；两者均不得生成 duplicate user transcript/reply/tool/external delivery。Delivery
accepted=true 本身不覆盖 quota 例外，但任何 assistant/model output、tool、side effect、unknown
或 termination uncertainty 均 ends chain domain 并 STOP。

### CTR-I2-015 — controlled one-shot production canary injection seam

为 Activation V2 的生产 B/C canary 授权一个 closed、默认禁用、非 credential seam；不得在
执行轮临时选择机制。descriptor path 固定为
`<runtimeRoot>/route-chain-canary-injection.json`；production runtimeRoot 实例化为
`/Users/authsvc/.agent-core`，isolated candidate 使用其独立 candidate runtimeRoot，因此同一
代码/path rule 不触碰 production root。descriptor owner=该 runtime owner（production
=authsvc505）、mode0600，exact schema `{version:1,agentId:"agt_cto-agent",routeRef:"glm53",mode,nonce,expiresAt,
maxUses:1,binding:{channel:"feishu",senderOpenId,marker}}`；mode 仅
`provider_quota_rejected_before_generation | outcome_unknown`；nonce 必须匹配
`^[A-Za-z0-9_-]{16,64}$`（无 dot/slash/percent/control，作为 basename suffix 安全）；
senderOpenId non-empty ≤256 chars；marker non-empty UTF-8 ≤128 bytes 且恰为 Owner 发送的
整个 canary prompt。expiresAt 必须 canonical RFC3339 UTC `YYYY-MM-DDTHH:mm:ssZ` string，
创建时 `now < expiresAt <= now+5 minutes`，consume 时必须仍未过期；wall-clock parse/error
fail-loud。exact used marker 已存在、nonce collision 或任一 object extra/duplicate/type error
均 fail-loud，不覆盖。senderOpenId 由既有 authenticated
Feishu ingress metadata 提供，不信任 prompt 自报。

executor 在每个 target logical-turn entry、任何 process acquire 前 lstat/read/validate
runtime-root-relative descriptor；absent 是普通 fast path。install/clear 必须在 target admission
quiesced，随后只放行 exact bound canary turn，不要求 runtime/process reload。executor 仅当
exact target+route + channel + authenticated senderOpenId + whole-prompt marker
全部匹配时消费。消费原语固定为把 descriptor 原子 rename 到 exact
`route-chain-canary-injection.used.<nonce>`，成功 rename 的唯一 process 才可激活 fixture。

quota mode 必须进入正常 glm53 attempt/acquire/dispatch 边界，在 provider request 已被 observer
证明发出后、任何 generation/output/tool 前，由 controlled fixture 返回固定结构化 terminal
response：HTTP 429 + quota-exhausted code、termination proven、output tokens=0、partial/content=
NO、tool call/start=NO、external side effect=NO、outcome_unknown=NO、transport timeout=NO；它
不得向真实 GLM 网络端制造额度耗尽。classifier 必须据此产生
`provider_quota_rejected_before_generation` 并 hop。outcome_unknown mode 仍在 provider/model
acquire 前生成 STOP carrier。fixture 不读/改 credential；普通 turn、任一 binding mismatch、
absent/expired/used descriptor 均不得注入；used marker 禁止 second consume，crash 后也
fail-closed。

除 fixed route journal 外，既有 durable non-surface ops audit 必须为 matching canary nonce
记录 bounded observer：`providerDispatchCount/modelCallStartCount/providerRetryCount/onStartCount/
onDispatchCount/transcriptCount/externalDeliveryCount/injectionConsumeCount`；由 lifecycle
points 机械计数，禁止推算 route attempt=模型调用，禁止 prompt/sender/token/raw body。
该 observer 只用于 canary exact-once/duplicate proof，不扩张 route journal。

install/clear/verify 只能是同目录 atomic create/remove + lstat/read-back exact metadata/schema；
clear 后 descriptor/temp/exact used marker 全 absent 才可切 case/resume。测试覆盖 disabled
zero-effect、target/route/channel/sender/marker/nonce mismatch、expiry、one-shot race、crash
post-rename、clear、observer exact counts、other-Agent isolation、exact terminal-quota hop once、
outcome_unknown zero hop，以及 partial output/tool started negative fixtures。seam 不得成为通用
fault API/model router，且不得通过真实额度耗尽制造 429。

## 8. Journal implementation

fixed attempt record only：routeChainId、attemptIndex、route、failureClass、
admissionProven、attemptOutcome。fixed final only：finalRoute、finalOutcome、
totalRouteAttempts。sink 必须是既有 durable、non-surface structured audit/log；不新增
persistent store，也不得降级为 transient/surface-only output。

route-derived metrics（primaryRoute/fallbackRoute/fallbackActivated）从 chain snapshot +
records 计算；Luna model call/retry/duplicate/delivery 只能由 CTR-I2-015 lifecycle observer
证明，不得从 route attempt 推算。两者均不写入 frozen journal schema。raw error、token、
credential、prompt、Authorization、provider response body 不存。

## 9. Scheduler and explicit requests

Scheduler request 无 explicit model → inherited Agent snapshot；有 explicit model/route → strict。
本 authority 不授权新增 model→routeCatalog resolution seam；沿用 base 既有 opaque/strict
resolution behavior，无法解析则既有 fail-loud，绝不为显式 model 发明 chain/hop。job/request
fallback arrays rejected。每 occurrence 对外恰好一个 outcome envelope；chain hops
不改变 requestId/idempotency fingerprint，hop 不是 transport retry。任一 attempt 已 dispatch
则 started=true；delivery outcome 与 execution outcome 分离；outcome_unknown + original
reconciliationHandle 原样 passthrough，不折叠 ordinary error。chain execution 必须在 Scheduler
store lock 外。Scheduler engine/store/outcome authority 与 fence semantics 不改。

## 10. Isolation

implementation generic schema 支持 max4，但不得硬编码 agt_cto-agent tuple/order。production
scope enforcement 保持 target-only；其他 Agents unchanged。禁止 quota router、account pool、
load balancing、provider body text router、second transport/consumer、dsh-zai fake carrier。

## 11. Tests and gates

```text
GATE-I2-1 Parent V2 + IMPL V2 + Activation V2 accepted atomically and merged
GATE-I2-2 exact-base preflight + path manifest
GATE-I2-3 loader/canonical tests PASS
GATE-I2-4 classifier quota regressions PASS
GATE-I2-5 four hop + all STOP families PASS
GATE-I2-6 ingress/delivery/scheduler convergence PASS
GATE-I2-7 deadline/duplicate/journal/redaction PASS
GATE-I2-8 one-shot canary seam disabled/isolation/race/cleanup tests PASS
GATE-I2-9 independent implementation audit PASS
```

ordinary tests 禁止 network/OAuth/model/production files。fake Luna process 只验证 mechanics；
任何真实 model canary 属 Activation V2。

## 12. Out of scope

production config/write/restart/deploy/source-stamp generation、OAuth/plugin install、credential、
Harness changes、ARM64、HR Dispatcher、Workflow、Scheduler engine/store、other Agent config。

## 13. Governance primitive record

### 13.1 Current State

IMPL V1 is accepted/current；base classifier at pinned blobs violates admission-first quota behavior；
no canary injection seam is active。V2 is proposed and authorizes no code until the coordinated
acceptance is merged。

### 13.2 Observations, Claims and Evidence

OBS-V2-005/006 support CLM-V2-004/005 through EVD-V2-004/005 in the frozen investigation；
other OBS/CLM/EVD qualify assets/identity/baseline but are not implementation-conformance proof。
All Claims are `SUPPORTED` with backlinks；future implementation evidence is required below。

### 13.3 Decisions

DEC-I2-001=closed loader/canonical contracts CTR-I2-001..004；DEC-I2-002=single executor,
snapshot and Q-4 lifecycle CTR-I2-005..007；DEC-I2-003=admission-first classifier
CTR-I2-008..011；DEC-I2-004=hop/deadline/one-turn CTR-I2-012..014；DEC-I2-005=closed
one-shot seam CTR-I2-015；DEC-I2-006=fixed durable journal and Scheduler preservation §§8-9。

### 13.4 Scope/non-goals, authority/dependencies, migration/rollback, open questions

Scope/non-goals are §§2/12；authority/dependencies are frontmatter and §2 atomic lifecycle。
Implementation migration must use exact base/path manifest, staged tests then independent audit；
code rollback restores audited before blobs, while production rollback belongs only to Activation
V2。`OPEN_QUESTIONS = NONE`；insufficient carrier evidence is an explicit blocker, not permission
to widen scope。

## 14. Contract-by-contract acceptance

Every row requires attached executed evidence at exact implementation commit；missing evidence or a
Reject condition fails acceptance。

| Acceptance | Contract | Method | Environment | Expected result / required executed evidence | Reject when |
|---|---|---|---|---|---|
| ACC-I2-001 | CTR-I2-001 | recursive duplicate/schema fixture suite | clean unit runtime | exact top/agent/model keys, version2, max4, all malformed fail | parser accepts duplicate/unknown/type error |
| ACC-I2-002 | CTR-I2-002 | route-kind/ref/readiness fixtures | clean unit runtime | builtin/subscription exact and readiness fail-loud | silent skip/degrade or schema drift |
| ACC-I2-003 | CTR-I2-003 | canonical golden vectors | clean unit runtime | fixed seven fields/order/exact values | normalize/alias collision not rejected |
| ACC-I2-004 | CTR-I2-004 | env grammar/startup/spawn/reload tests | Node25.6.1 test runtime | Parent POL-V2-012 exact behavior + redacted errors | inherited env allowed/value leak/global injection |
| ACC-I2-005 | CTR-I2-005 | structural call graph + three-entry tests | repository + test runtime | one published executor called by all entries | duplicated local chain/internal import |
| ACC-I2-006 | CTR-I2-006 | order/snapshot/restart-turn tests | deterministic executor | immutable turn snapshot, once/route, next turn primary | mid-turn config effect/stickiness |
| ACC-I2-007 | CTR-I2-007 | READY/idle/busy mismatch lifecycle injection | process-registry harness | match reuse; idle controlled exit; busy no force-kill | wrong reuse/kill/mutate route |
| ACC-I2-008 | CTR-I2-008 | precedence table tests | classifier harness | unsafe/unknown evidence first; exact terminal quota second; taxonomy last | text overrides evidence or unsafe 429 hops |
| ACC-I2-009 | CTR-I2-009 | four no-admission classes + exact quota class + negatives | classifier/executor harness | only closed classes hop under their distinct evidence gates | quota mislabeled no-admission or text/bare provider hops |
| ACC-I2-010 | CTR-I2-010 | controlled exact terminal-429 carrier | classifier/executor harness | glm attempt1 → luna attempt2 success, FINAL_ROUTE luna, Luna call1 | initialize/no-admission class, STOP despite full proof, or real quota exhaustion |
| ACC-I2-011 | CTR-I2-011 | A-D plus complete negative matrix | clean test runtime | exact quota success; partial/outcome_unknown/tool-started and every ambiguous case STOP; redaction PASS | any case absent/fails/raw body logged |
| ACC-I2-012 | CTR-I2-012 | hop truth-table/property test | deterministic executor | hop only all four predicates true | hop when predicate false/restart cycle |
| ACC-I2-013 | CTR-I2-013 | monotonic deadline injection | deterministic clock | one decreasing budget, no refresh | per-hop reset or unknown hop |
| ACC-I2-014 | CTR-I2-014 | multi-attempt transcript/tool/delivery counters | integration harness | one logical result/delivery; only exact zero-generation terminal quota exception may hop after request dispatch | duplicate, unsafe post-request hop, or quota hop with incomplete proof |
| ACC-I2-015 | CTR-I2-015 | schema/path/binding/race/crash/observer/isolation suite | candidate root + production-like harness | default-off; exact binding; rename winner1; bounded counters; cleanup | path traversal, collision overwrite, wrong consume, missing counts |
| ACC-I2-016 | §§8-9 | journal sink + Scheduler bridge tests | durable audit + Scheduler harness | fixed fields, durable non-surface; idempotency/started/reconcile/store-lock preserved; no model→catalog seam | field expansion/transient sink/envelope drift |
| ACC-I2-017 | §3/§11 | exact path manifest + independent code audit | implementation PR | in-scope only, all gates PASS, no network/OAuth | scope expansion or missing audit |

## 15. Final

```text
TASK_NAME = 冷备 执行
IMPL_V2 = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2
QUOTA_CLASSIFIER_FIX_REQUIRED = YES
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
