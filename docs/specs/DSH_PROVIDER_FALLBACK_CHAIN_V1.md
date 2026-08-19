---
spec_id: DSH_PROVIDER_FALLBACK_CHAIN_V1
status: proposed
created: 2026-08-19
scope: agents_without_explicit_per_agent_override
---

# DSH Provider Fallback Chain V1

> SPEC STATUS: **proposed**. This document is Investigation + Spec only. It grants no
> implementation, production provider change, provider cutover, existing provider-route
> implementation change, merge,
> credential movement, or deployment permission.

## 0. Frozen outcome

For an Agent with **no explicit per-Agent model override**, the proposed default route is:

```text
PRIMARY_PROVIDER = zai
PRIMARY_MODEL = glm-5.2

SECONDARY_PROVIDER = opencode-go
SECONDARY_MODEL = deepseek-v4-flash
```

The secondary model is not guessed. The exact production-loaded Harness dependency tree
(`@deepseek-ai/dsh-llm-pi-ai@0.1.0-rc.5` using
`@earendil-works/pi-ai@0.82.1`) catalogs
`opencode-go/deepseek-v4-flash` as a supported OpenAI-completions route. The same catalog
contains `zai/glm-5.2`.

Route precedence is frozen:

```text
explicit per-Agent route
> global/default fallback chain
```

`agt_cto-agent` remains governed by accepted
`AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1`:

```text
agt_cto-agent
→ explicit openai-codex/gpt-5.6-luna
→ no automatic fallback
```

This Spec does not attach Luna to this chain. A future
`Luna → GLM → opencode-go` route requires an explicit amendment and independent review.

## 1. Authority and scope

### 1.1 In scope

- Agents without an explicit per-Agent model override.
- One ordered primary/secondary chain.
- Provider-call failure handling before any assistant message is materialized and before
  any tool or external side effect is executed.
- Stable failure classification, bounded same-provider retry, one provider switch,
  process-local cooldown, and durable non-secret observability.

### 1.2 Non-goals

- Luna fallback or any change to `agt_cto-agent`.
- Account pool, load balancing, quota scheduler, provider purchasing, or credential sharing.
- Dynamic Router model routing.
- Agent Core Kernel, Binding, Session model, Feishu, or Scheduler change.
- PR #11 hardening.
- Existing provider-route implementation modification.
- Production provider/configuration change, real cutover, deploy, or merge.

## 2. Investigation baseline

The evidence snapshot for this proposal is:

```text
REPOSITORY_BASE = origin/main@eaebb28df4e5a67ecbcfe6f3990fe276ff11acd1
PRODUCTION_AGENT_CORE = 93f9acf67cb9b4862fc9b8ffaf593630086285ba
PRODUCTION_DSH_ROOT = /Users/yanfenma/workspace/github/deepseek-harness
PRODUCTION_DSH = 0.1.0-rc.5@a12bb03c6861969985f066bfbf0cb7e5dd5ac567
PI_AI_CATALOG = 0.82.1
```

The launchd runtime currently injects `oc-go/deepseek-v4-flash`. Per-home DSH settings
declare `opencode-go`, the `oc-go` compatibility route, and their supported models, but do
not declare a `zai` provider profile. The launchd environment also does not provide
`ZAI_API_KEY`, and the inspected Agent credential documents contain no ZAI credential.
An ambient `ZAI_API_KEY` in the investigator's interactive shell is not a production
credential seam and is not readiness evidence.

Therefore:

```text
GLM_PROVIDER_CONFIG_PRESENT = NO
GLM_CREDENTIAL_READY = NO
GLM_MODEL_AVAILABLE = YES
GLM_DIRECT_ROUTE_CAN_BE_ENABLED_NOW = NO
```

`GLM_MODEL_AVAILABLE = YES` means exact catalog support only. It does not imply that a
production route is registered or authenticated. A later controlled direct-route
activation may be separately proposed after the `zai` profile and Agent-owned credential
are provisioned and validated; this Spec Agent performs no such activation.

The `opencode-go` credential is present, but configuration presence is not account
readiness. A 2026-08-19 isolated one-token diagnostic request to the exact secondary route
returned HTTP 429 `GoUsageLimitError` with a monthly usage-limit message. No production
configuration or process was changed.

```text
SECONDARY_ACCOUNT_READY_NOW = NO
```

Until a fresh controlled probe succeeds, fallback availability must not be advertised as
ready.

## 3. Current DSH capability and missing capability

The production-loaded DSH base profile already mounts `@deepseek-ai/dsh-llm-retry`.
Provider profiles own retry policy. Normal defaults are exactly:

```text
maxRetries = 2
retryableCodes = EMPTY_RESPONSE, RATE_LIMIT, SERVER, TIMEOUT, TRANSPORT
initialDelayMs = 500
maxDelayMs = 10000
jitterRatio = 0.1
```

The retry plugin consumes the Agent loop's `agent/request-error` waterfall. The Agent loop
does not append `assistant/message` and does not call `executeToolCalls` until the model
stream ends successfully. Failed chunks remain non-surface `assistant/chunk` evidence and
are excluded from derived model messages. This is the safe recovery boundary.

The same loop exposes `agent/request` immediately before each model call, where the exact
provider/model call configuration is resolved. These two extension points together form
the correct provider-switch seam:

```text
MODEL_CALL_RETRY_SEAM =
  agent/request-error (classify and decide recovery)
  + agent/request (select the next attempt's exact provider/model)
```

DSH currently provides same-provider retry only. It does not implement an ordered
cross-provider fallback chain, fallback event, circuit breaker, or fallback count.

```text
CURRENT_DSH_FALLBACK_SUPPORT = SAME_PROVIDER_BOUNDED_RETRY_ONLY
INTEGRATION_LAYER = DSH provider runtime / Agent-loop model-call recovery plugin
PROVIDER_SELECTION_AUTHORITY = explicit per-Agent route first; otherwise DSH fallback policy
ROUTER_CHANGE_REQUIRED = NO
KERNEL_CHANGE_REQUIRED = NO
```

The future implementation belongs in a narrow DSH function plugin composed in the Agent
profile. It must not be placed in Agent Core Router, Binding, Session, Feishu, Scheduler,
or Kernel. The Router may continue passing the deployment-selected initial provider/model;
it does not select attempts dynamically.

## 4. Hard prerequisite: `TURN_END_PROVIDER_FAILURE_PROPAGATION`

The current `origin/main` Router waits for receipt + idle and then returns the last
`assistant/message` text, defaulting to `''`. It does not inspect the matching
`session.event` `turn/end.reason.kind=error`. A real production session already proves the
DSH event shape:

```text
assistant/chunk.finish.reason.kind = error
assistant/chunk.finish.reason.failure.code = QUOTA
turn/end.reason.kind = error
turn/end.reason.error.code = QUOTA
```

The prerequisite is a runtime capability, not a pull-request number, branch, or temporary
commit identity. Any implementation candidate must satisfy the complete capability chain:

```text
PREREQUISITE =
  real session.event / turn/end.reason.error
  → current-turn correlation
  → sanitize
  → stable provider failure classification
  → structured fail-loud
  → no empty-reply success

TURN_END_FAILURE_PROPAGATION_PREREQUISITE =
  independent implementation review = PASS
  AND merged to main = YES

CURRENT_PREREQUISITE_STATUS =
  independent implementation review = NOT_PASS
  merged to main = NO
FALLBACK_IMPLEMENTATION_READY = NO
```

Both gates are mandatory. Source presence, an open review, a draft change, or a candidate
commit is not proof of the capability and must not be treated as the prerequisite. Only
after an implementation independently passes review and is merged to `main` may
`FALLBACK_IMPLEMENTATION_READY` be reconsidered as `YES`.

If a primary provider failure can still be reported as a successful empty reply, fallback
implementation and rollout are prohibited regardless of configuration or provider account
readiness.

## 5. Failure taxonomy and eligibility

Fallback decisions must use stable adapter/DSH codes. They must never parse raw error
messages in the fallback policy. Message parsing, if unavoidable for a provider adapter,
belongs at the adapter normalization boundary and must output a stable non-secret class.

### 5.1 One-to-one normalization and disposition

Every raw DSH/provider code must map to **exactly one** stable failure class and exactly one
retry/fallback disposition. The fallback implementation may not reclassify a code based on
message text, provider preference, or retry exhaustion. The frozen mapping is:

| Raw DSH/provider code | Exactly one stable failure class | Exactly one V1 disposition |
|---|---|---|
| `QUOTA` | `account_quota_exhausted` | No same-provider retry; if the §6 turn-safety gate passes, open the 30m breaker and switch once. |
| `RATE_LIMIT` | `rate_limited` | Same-provider retry owned by `llm-retry`; after terminal exhaustion, if §6 passes, open the 60s breaker and switch once. |
| `SERVER` | `provider_unavailable` | Same-provider retry owned by `llm-retry`; after terminal exhaustion, if §6 passes, open the 60s breaker and switch once. |
| `TIMEOUT` | `bounded_transient_network_failure` | Same-provider retry owned by `llm-retry`; after terminal exhaustion, if §6 passes, open the 60s breaker and switch once. |
| `TRANSPORT` | `bounded_transient_network_failure` | Same-provider retry owned by `llm-retry`; after terminal exhaustion, if §6 passes, open the 60s breaker and switch once. |
| stable provider-runtime `MODEL_UNAVAILABLE` | `model_unavailable` | No same-provider retry; if §6 passes, open the 10m breaker and switch once. |
| `EMPTY_RESPONSE` | `empty_response` | Same-provider bounded retry only; after exhaustion fail loud, never fallback in V1. |
| `MISSING_CREDENTIAL` | `credential_missing` | Fail loud; never fallback. |
| `INVALID_CREDENTIAL` | `credential_invalid` | Fail loud; never fallback. |
| `AUTH` | `authentication_unavailable` | Fail loud; never fallback. |
| `NO_ADAPTER` | `provider_configuration_invalid` | Fail loud at startup or call preparation; never fallback. |
| `UNKNOWN_MODEL` | `model_configuration_invalid` | Fail loud at startup or call preparation; never fallback. |
| `INVALID_REQUEST` | `invalid_request` | Fail loud; never fallback. |
| `CONTEXT_WINDOW_EXCEEDED` | `context_window_exceeded` | Owned recovery only; never fallback. |
| `ABORTED` | `aborted` | Stop; never fallback. |
| `PI_AI_ERROR`, `UNKNOWN`, or any unmapped code | `unclassified` | Fail loud; never fallback. Classification must be amended and reviewed before use. |

`SERVER` is the sole current raw code normalized as `provider_unavailable`.
`TIMEOUT` and `TRANSPORT` normalize only as `bounded_transient_network_failure`; they do
not also normalize as `provider_unavailable`. Retry exhaustion changes disposition and
breaker origin, not the stable class of the failed attempt.

`MODEL_UNAVAILABLE` is an implementation prerequisite for that row. The current pi-ai
surface does not reliably distinguish provider-runtime model withdrawal from
`UNKNOWN_MODEL`, `INVALID_REQUEST`, or `PI_AI_ERROR`; until the adapter emits the stable
class, those failures are forbidden from fallback.

### 5.2 Forbidden non-provider failures

| Failure | Current representative code | Policy |
|---|---|---|
| Agent, tool, permission, business, Workflow, Forum, Feishu, filesystem, or Scheduler error | non-model-call failure | Never fallback. |

The frozen sets are:

```text
FALLBACK_ALLOWED_ERRORS =
  account_quota_exhausted;
  provider_unavailable after bounded retry;
  bounded_transient_network_failure after bounded retry;
  rate_limited after bounded retry;
  stable provider-runtime model_unavailable

FALLBACK_FORBIDDEN_ERRORS =
  missing/invalid credential;
  AUTH/OAuth expired or revoked;
  NO_ADAPTER/UNKNOWN_MODEL/invalid configuration;
  INVALID_REQUEST/CONTEXT_WINDOW_EXCEEDED/EMPTY_RESPONSE;
  ABORTED/PI_AI_ERROR/UNKNOWN;
  arbitrary Agent/tool/business/external-operation error
```

## 6. Safe replay boundary

Fallback is permitted only inside the open DSH model-request step when all of the following
are true for the **entire current logical turn**, from turn start through the provider
failure being evaluated:

1. The failed attempt terminated through `agent/request-error`.
2. No materialized or externally visible assistant output exists anywhere in the current
   turn.
3. No tool call has been emitted, materialized, or executed anywhere in the current turn.
4. No file mutation, Forum write, Workflow transition, Feishu delivery, parent RPC, or any
   possible external side effect has occurred anywhere in the current turn.
5. The stable failure class is allowlisted by §5.1.

Failed internal `assistant/chunk` records may exist. They are evidence, not assistant
surface output, and DSH must continue excluding them from derived messages. The gate must
inspect current-turn history, not merely records attributed to the latest provider attempt.
If any listed event already occurred, a subsequent provider failure must not trigger
fallback or replay. It must terminate as `outcome_unknown` when an external outcome may be
uncertain, otherwise as structured fail-loud with the truthful provider error.

```text
PARTIAL_OUTPUT_POLICY =
  internal non-surface failed chunks may be retained as evidence;
  any externally visible/materialized partial assistant output forbids fallback;
  fail loud with outcome_unknown when terminal outcome cannot be proven

TOOL_SIDE_EFFECT_POLICY =
  no automatic fallback after any current-turn tool call is materialized, emitted, or
  executed, or when any current-turn external side effect may have occurred;
  never replay the turn; record outcome_unknown and fail loud
```

This rule prevents fallback from duplicating tool calls, Forum writes, Workflow
transitions, Feishu delivery, or file modifications.

## 7. Attempt, retry, and cooldown state machine

At most two provider routes may be attempted in V1, in the frozen order. The fallback
count is therefore at most one. `@deepseek-ai/dsh-llm-retry` retains sole ownership of
same-provider retry. The fallback layer runs only after `llm-retry` delegates a terminally
exhausted eligible error. For `QUOTA` and stable `MODEL_UNAVAILABLE`, the configured retry
budget is zero and is therefore terminal on the first failure. The fallback layer must
never retry the same provider itself.

```text
requested route = zai/glm-5.2

primary attempt
  → QUOTA or stable MODEL_UNAVAILABLE
      → no primary retry
      → open cooldown
      → one secondary attempt

  → RATE_LIMIT/SERVER/TIMEOUT/TRANSPORT
      → reuse provider-owned normal retry policy
         (max 2 retries; 500ms exponential start; 10s cap; 0.1 jitter;
          bounded Retry-After only)
      → if exhausted, open cooldown
      → one secondary attempt

  → forbidden/unclassified error
      → no switch; fail loud

secondary failure
  → never restart the chain
  → apply only secondary's own bounded same-provider retry where eligible
  → fail loud with the secondary's truthful terminal class
```

The mandatory waterfall is:

1. Primary provider attempt.
2. Existing same-provider bounded retry by `llm-retry`; resolved `maxRetries` must be `<= 2`.
3. Same-provider retry terminal exhaustion.
4. Only for one allowlisted stable class, zero current-turn materialized output, and zero
   current-turn tool/external side effect: switch provider once.
5. Secondary provider execution, with its own independently bounded same-provider retry.
6. No second provider switch and no chain restart.

Startup must resolve every configured retry policy used by either route. A resolved
`maxRetries > 2`, an unbounded policy, or `mode: always` is invalid and must reject startup.
The retry and fallback layers must not each retry the same failure; retry multiplication is
forbidden.

```text
RETRY_POLICY =
  QUOTA/MODEL_UNAVAILABLE: 0 same-provider retries;
  RATE_LIMIT/SERVER/TIMEOUT/TRANSPORT: existing provider-owned normal policy,
  maximum 2 retries with bounded backoff;
  maximum provider switches per turn = 1;
  always/unbounded retry mode forbidden

SAME_PROVIDER_RETRY_OWNER = @deepseek-ai/dsh-llm-retry
MAX_TRANSIENT_RETRIES = 2
MAX_PROVIDER_SWITCHES = 1
```

### 7.1 Process-local circuit breaker

The V1 plugin owns a process-local circuit breaker keyed by exact provider/model route.
The following durations are **V1 policy constants**, not existing DSH defaults:

- `QUOTA`: open for 30 minutes.
- stable `MODEL_UNAVAILABLE`: open for 10 minutes.
- exhausted `RATE_LIMIT`, `SERVER`, `TIMEOUT`, or `TRANSPORT`: open for 60 seconds.
- While open, an eligible ordinary Agent turn goes directly to the secondary without
  waiting for the primary. Because there is no primary call in that turn, the complete
  mandatory `llm/fallback` evidence is:

  ```text
  requestedProvider = zai
  requestedModel = glm-5.2

  primaryAttempted = false
  attemptedProvider = NONE
  attemptedModel = NONE

  routeState = primary_cooldown_active
  stableFailureClass = NONE

  breakerOriginStableFailureClass = <exact historical stable class from §5.1>

  selectedProvider = opencode-go
  selectedModel = deepseek-v4-flash
  fallbackCount = 1
  ```

  Selecting the secondary in this state means the primary was skipped because an existing
  breaker was open. It does not mean the current turn attempted and failed the primary.
- After expiry, exactly one single-flight half-open probe is allowed; concurrent turns use
  the secondary until that probe succeeds or reopens the breaker.
- Successful primary completion closes the breaker.

```text
COOLDOWN_POLICY =
  process-local exact-route circuit breaker with V1 policy constants;
  account_quota_exhausted 30m;
  model_unavailable 10m;
  rate_limited/provider_unavailable/bounded_transient_network_failure 60s;
  single-flight half-open probe;
  persistent cooldown = NO in V1

PRIMARY_COOLDOWN_ROUTE_STATE = primary_cooldown_active
BREAKER_ORIGIN_STABLE_FAILURE_CLASS =
  account_quota_exhausted / rate_limited / provider_unavailable /
  bounded_transient_network_failure / model_unavailable
CURRENT_ATTEMPT_STABLE_FAILURE_CLASS = NONE when primaryAttempted=false
```

`breakerOriginStableFailureClass` is the exact normalized class that opened the breaker.
It must be copied verbatim from §5.1 and preserves the one-to-one provenance from the
original normalized failure to its cooldown. It must not be replaced by a coarse category
such as `exhausted_transient_failure`. A cooldown bypass must never fabricate a current-turn
`QUOTA`, `RATE_LIMIT`, `SERVER`, `TIMEOUT`, `TRANSPORT`, or `MODEL_UNAVAILABLE`, and must
never claim that `zai/glm-5.2` was attempted when the primary was not called.

Persistent cross-process cooldown would introduce shared fleet/account coordination and a
new durable authority adjacent to the explicitly excluded quota scheduler/account pool.
It is deferred. V1 limits repeated waiting per Agent process; a process restart may perform
one new primary probe and must remain observable.

## 8. Configuration and Luna exclusion

The fallback plugin configuration must be deployment-authored and fail loud. Conceptually:

```yaml
scope: agents-without-explicit-override
routes:
  - provider: zai
    model: glm-5.2
  - provider: opencode-go
    model: deepseek-v4-flash
```

The implementation must receive or derive an immutable boolean stating whether the Agent
has an explicit per-Agent override. If true, the plugin must not intercept, rewrite,
retry-as-fallback, or cool down that Agent's route. Merely matching a provider/model string
is not sufficient authority to override the explicit-route precedence rule.

Invalid chain length, duplicate route, missing provider/model, unregistered provider,
unsupported configured model, or missing credential fails loud. It must never silently
remove a route or run the remaining route as if the chain were healthy.

## 9. Observability and evidence

Fallback must append a non-surface durable `llm/fallback` event before the secondary call.
Its schema must contain at least:

```text
chainId
turn
step
requestedProvider
requestedModel
attemptedProvider
attemptedModel
stableFailureClass
selectedProvider
selectedModel
fallbackCount
cooldownState
primaryAttempted
routeState
breakerOriginStableFailureClass
```

For a normal primary call, `attemptedProvider`, `attemptedModel`, and `stableFailureClass`
describe that actual call and its one-to-one class from §5.1. For a cooldown bypass they
are exactly `NONE`, `NONE`, and `NONE`; `breakerOriginStableFailureClass` separately explains
why the process-local route breaker was already open. Session evidence, logs, and acceptance
reports must preserve this distinction and must not synthesize an attempted primary route
or current-turn primary failure. `stableFailureClass` exclusively describes an actual
provider attempt in the current turn and must never carry historical breaker provenance.

Each attempt is also evidenced by the existing `request/header` and `request/context`
route records. The successful `assistant/message.source.provider/model` is the final proof
of which provider/model produced the answer. A final failure is evidenced by
`turn/end.reason.error` after the prerequisite in §4 lands.

Logs/events must not contain tokens, credential values, Authorization headers, credential
file contents, or raw secret-bearing provider errors. A safe event may retain stable class,
HTTP status, bounded provider retry delay, and opaque provider request id only if their
schemas are verified non-secret.

```text
OBSERVABILITY =
  durable requested route + every attempted provider/model + stable failure class
  + selected fallback provider/model + fallback count + cooldown state;
  final provider/model proven by request context and assistant message provenance;
  secrets and raw provider error bodies forbidden
```

## 10. Required implementation acceptance (future, not authorized now)

An implementation may begin only after this Spec is independently reviewed, accepted, and
the §4 prerequisite is merged. Its acceptance must include:

1. Exact DSH source/version and exact provider catalogs pinned.
2. No override Agent is intercepted; `agt_cto-agent` Luna route has zero fallback events.
3. Primary success produces no secondary call.
4. Each allowed stable class follows §5/§7 exactly.
5. Every forbidden class fails loud with zero secondary calls.
6. Partial streamed chunks followed by failure remain non-surface; any current-turn
   materialized assistant output forbids fallback and replay.
7. Any current-turn emitted/materialized/executed tool call, file mutation, Forum write,
   Workflow transition, Feishu delivery, parent RPC, or possible external side effect
   makes fallback/replay impossible and yields fail-loud/outcome-unknown.
8. At most one provider switch per turn and no chain restart after secondary failure.
9. Cooldown/half-open behavior is deterministic under concurrent turns and resets on
   process restart as documented.
10. Durable events prove requested, attempted, failed, selected, and final routes without
    secrets.
11. Real controlled primary and secondary account probes pass before production rollout;
    configuration presence alone fails the gate.
12. Router, Binding, Session model, Feishu, Scheduler, and Kernel diffs are empty.
13. Startup rejects `mode: always`, unbounded retry, and resolved `maxRetries > 2`; tests
    prove no multiplicative retry between `llm-retry` and fallback.
14. Every raw code in §5.1 has exactly one class and disposition; unmapped codes fail loud
    without a secondary call.
15. A cooldown bypass proves `primaryAttempted=false`, `attemptedProvider=NONE`,
    `attemptedModel=NONE`, `stableFailureClass=NONE`, the exact §5.1
    `breakerOriginStableFailureClass`, selected secondary route, and fallback count without
    fabricating a current primary attempt or failure.

## 11. Final output contract

```text
DSH_PROVIDER_FALLBACK_CHAIN_V1_SPEC_AMENDMENT_2 = PASS

BASE_REVIEWED_HEAD = b1e1b013

SCOPE = Agents without explicit per-Agent override

PRIMARY_PROVIDER = zai
PRIMARY_MODEL = glm-5.2
SECONDARY_PROVIDER = opencode-go
SECONDARY_MODEL = deepseek-v4-flash

GLM_PROVIDER_CONFIG_PRESENT = NO
GLM_CREDENTIAL_READY = NO
GLM_MODEL_AVAILABLE = YES
GLM_DIRECT_ROUTE_CAN_BE_ENABLED_NOW = NO
SECONDARY_ACCOUNT_READY_NOW = NO

CURRENT_DSH_FALLBACK_SUPPORT = SAME_PROVIDER_BOUNDED_RETRY_ONLY
INTEGRATION_LAYER = DSH provider runtime / Agent-loop model-call recovery plugin
MODEL_CALL_RETRY_SEAM = agent/request-error + agent/request
PROVIDER_SELECTION_AUTHORITY = explicit per-Agent route first; otherwise DSH fallback policy
ROUTER_CHANGE_REQUIRED = NO

TURN_END_FAILURE_PROPAGATION_PREREQUISITE = real correlated sanitized turn/end.reason.error → stable class → structured fail-loud → no empty-reply success; independent implementation review PASS and merged main YES required
CURRENT_PREREQUISITE_STATUS = independent implementation review NOT_PASS; merged to main NO

FALLBACK_ALLOWED_ERRORS = account_quota_exhausted; exhausted rate_limited/provider_unavailable/bounded_transient_network_failure; stable model_unavailable
FALLBACK_FORBIDDEN_ERRORS = credential/auth/config/request/context/empty-response/abort/unclassified/Agent/tool/business errors
PARTIAL_OUTPUT_POLICY = external/materialized partial output forbids fallback; uncertain terminal outcome is outcome_unknown
TOOL_SIDE_EFFECT_POLICY = any emitted/executed tool or possible external side effect forbids replay and fallback

RETRY_POLICY = bounded provider-owned retry; max 2 transient retries; max 1 provider switch; no always mode
RETRY_FALLBACK_ORDER = primary attempt → llm-retry bounded same-provider retry → terminal exhaustion → allowlist and entire-turn safety gate → one secondary switch → secondary execution → stop
SAME_PROVIDER_RETRY_OWNER = @deepseek-ai/dsh-llm-retry
MAX_TRANSIENT_RETRIES = 2
MAX_PROVIDER_SWITCHES = 1

FAILURE_NORMALIZATION = one raw code → exactly one stable class → exactly one disposition; unmapped fail-loud and never fallback

COOLDOWN_POLICY = process-local exact-route breaker using V1 policy constants; account_quota_exhausted 30m; model_unavailable 10m; rate_limited/provider_unavailable/bounded_transient_network_failure 60s; persistent NO
COOLDOWN_BYPASS_EVENT_SCHEMA = requestedProvider=zai; requestedModel=glm-5.2; primaryAttempted=false; attemptedProvider=NONE; attemptedModel=NONE; routeState=primary_cooldown_active; stableFailureClass=NONE; breakerOriginStableFailureClass=<exact §5.1 class>; selectedProvider=opencode-go; selectedModel=deepseek-v4-flash; fallbackCount=1
PRIMARY_ATTEMPTED = false
ATTEMPTED_PROVIDER = NONE
ATTEMPTED_MODEL = NONE
CURRENT_ATTEMPT_STABLE_FAILURE_CLASS = NONE
BREAKER_ORIGIN_STABLE_FAILURE_CLASS = exact §5.1 class
HISTORICAL_FAILURE_PROVENANCE_ONE_TO_ONE = YES
PRIMARY_COOLDOWN_ROUTE_STATE = primary_cooldown_active

CURRENT_TURN_SIDE_EFFECT_POLICY = any current-turn materialized output, tool event, file mutation, or possible external side effect forbids subsequent fallback/replay

OBSERVABILITY = cooldown bypass records no attempted route and no current failure, plus exact historical breaker stable class and selected secondary route; no secrets/raw provider error body

LUNA_ROUTE_CHANGED = NO
ROUTER_DYNAMIC_MODEL_ROUTER = NO
SCHEDULER_CHANGE = NONE
KERNEL_CHANGE = NONE

PREVIOUS_REQUIRED_FIXES_REGRESSION = NONE

FALLBACK_IMPLEMENTATION_READY = NO

SPEC_STATUS = proposed
READY_FOR_FOCUSED_RE_REVIEW = YES
```
