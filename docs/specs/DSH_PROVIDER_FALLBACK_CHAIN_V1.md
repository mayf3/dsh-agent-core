---
spec_id: DSH_PROVIDER_FALLBACK_CHAIN_V1
status: proposed
created: 2026-08-19
scope: agents_without_explicit_per_agent_override
---

# DSH Provider Fallback Chain V1

> SPEC STATUS: **proposed**. This document is Investigation + Spec only. It grants no
> implementation, production provider change, provider cutover, PR #18 change, merge,
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
- PR #18 modification.
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

## 4. Hard prerequisite: truthful terminal provider failure

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

PR #18 is currently OPEN and DRAFT, not merged. Its current head classifies JSON-RPC
response errors in Router `onStdout`; it does not make `runTurn` consume and propagate the
real `turn/end.reason.error` event. This Spec neither edits nor expands PR #18.

The following prerequisite is frozen:

```text
PREREQUISITE =
  real session.event / turn/end.reason.error provider failure classification has merged

PR18_FAILURE_CLASSIFICATION_PREREQUISITE = NOT_SATISFIED_NOT_MERGED
FALLBACK_IMPLEMENTATION_READY = NO
```

If a primary provider failure can still be reported as a successful empty reply, fallback
implementation and rollout are prohibited regardless of configuration or provider account
readiness.

## 5. Failure taxonomy and eligibility

Fallback decisions must use stable adapter/DSH codes. They must never parse raw error
messages in the fallback policy. Message parsing, if unavoidable for a provider adapter,
belongs at the adapter normalization boundary and must output a stable non-secret class.

### 5.1 Allowed fallback classes

| Stable class | Current DSH evidence | Policy |
|---|---|---|
| `account_quota_exhausted` | canonical DSH `QUOTA` | No same-provider retry; open hard-quota cooldown; switch once. |
| `provider_unavailable` | normalized from stable `SERVER`, or exhausted `TIMEOUT`/`TRANSPORT` | Apply bounded same-provider retry, then switch once. |
| `bounded_transient_network_failure` | stable `TIMEOUT` or `TRANSPORT` | Apply bounded same-provider retry, then switch once. |
| `rate_limited` | stable `RATE_LIMIT` | Respect bounded provider retry policy; after exhaustion switch once. |
| `model_unavailable` | requires a distinct stable provider-runtime `MODEL_UNAVAILABLE` class | No retry; switch once. Must not be inferred from local configuration failure. |

`MODEL_UNAVAILABLE` is an implementation prerequisite for that row. The current pi-ai
surface does not reliably distinguish provider-runtime model withdrawal from
`UNKNOWN_MODEL`, `INVALID_REQUEST`, or `PI_AI_ERROR`; until the adapter emits the stable
class, those failures are forbidden from fallback.

### 5.2 Forbidden fallback classes

| Failure | Current representative code | Policy |
|---|---|---|
| Missing credential | `MISSING_CREDENTIAL` | Fail loud. |
| Malformed/invalid credential | `INVALID_CREDENTIAL` | Fail loud. |
| OAuth/account authentication unavailable | `AUTH`, expired/revoked OAuth | Fail loud; do not hide credential/account repair. |
| Invalid provider/model configuration | `NO_ADAPTER`, `UNKNOWN_MODEL` | Fail loud at validation/startup or call preparation. |
| Invalid request | `INVALID_REQUEST` | Fail loud. |
| Context overflow | `CONTEXT_WINDOW_EXCEEDED` | Owned recovery only; never provider fallback. |
| Empty response | `EMPTY_RESPONSE` | Same-provider bounded retry only; no provider switch in V1. |
| Abort/cancellation | `ABORTED` | Stop; never fallback. |
| Unclassified provider error | `PI_AI_ERROR`, `UNKNOWN` | Fail loud; classification must be improved first. |
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
are true:

1. The failed attempt terminated through `agent/request-error`.
2. No surface `assistant/message` exists for that attempt.
3. No tool call has been materialized for execution.
4. No `tool/call`, `tool/result`, parent RPC, Forum write, Workflow transition, Feishu
   delivery, file modification, or other external-operation receipt occurred because of
   that attempt.
5. The stable failure class is allowlisted by §5.1.

Failed internal `assistant/chunk` records may exist. They are evidence, not assistant
surface output, and DSH must continue excluding them from derived messages. If any partial
assistant output has been delivered externally or otherwise treated as product-visible,
the safe boundary is lost.

```text
PARTIAL_OUTPUT_POLICY =
  internal non-surface failed chunks may be retained as evidence;
  any externally visible/materialized partial assistant output forbids fallback;
  fail loud with outcome_unknown when terminal outcome cannot be proven

TOOL_SIDE_EFFECT_POLICY =
  no automatic fallback after any tool call is materialized, emitted, or executed,
  or when any external side effect may have occurred;
  never replay the turn; record outcome_unknown and fail loud
```

This rule prevents fallback from duplicating tool calls, Forum writes, Workflow
transitions, Feishu delivery, or file modifications.

## 7. Attempt, retry, and cooldown state machine

At most two provider routes may be attempted in V1, in the frozen order. The fallback
count is therefore at most one.

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

```text
RETRY_POLICY =
  QUOTA/MODEL_UNAVAILABLE: 0 same-provider retries;
  RATE_LIMIT/SERVER/TIMEOUT/TRANSPORT: existing provider-owned normal policy,
  maximum 2 retries with bounded backoff;
  maximum provider switches per turn = 1;
  always/unbounded retry mode forbidden
```

### 7.1 Process-local circuit breaker

The V1 plugin owns a process-local circuit breaker keyed by exact provider/model route:

- `QUOTA`: open for 30 minutes.
- stable `MODEL_UNAVAILABLE`: open for 10 minutes.
- exhausted `RATE_LIMIT`, `SERVER`, `TIMEOUT`, or `TRANSPORT`: open for 60 seconds.
- While open, an eligible ordinary Agent turn records `primary_cooldown_active` and goes
  directly to the secondary without waiting for the primary.
- After expiry, exactly one single-flight half-open probe is allowed; concurrent turns use
  the secondary until that probe succeeds or reopens the breaker.
- Successful primary completion closes the breaker.

```text
COOLDOWN_POLICY =
  process-local exact-route circuit breaker;
  hard quota 30m;
  model unavailable 10m;
  exhausted transient/rate/provider failure 60s;
  single-flight half-open probe;
  persistent cooldown = NO in V1
```

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
```

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
6. Partial streamed chunks followed by failure remain non-surface and do not duplicate in
   the secondary request.
7. A materialized tool call, executed tool, parent RPC, or simulated external receipt makes
   replay impossible and yields fail-loud/outcome-unknown.
8. At most one provider switch per turn and no chain restart after secondary failure.
9. Cooldown/half-open behavior is deterministic under concurrent turns and resets on
   process restart as documented.
10. Durable events prove requested, attempted, failed, selected, and final routes without
    secrets.
11. Real controlled primary and secondary account probes pass before production rollout;
    configuration presence alone fails the gate.
12. Router, Binding, Session model, Feishu, Scheduler, and Kernel diffs are empty.

## 11. Final output contract

```text
DSH_PROVIDER_FALLBACK_CHAIN_V1_SPEC = PASS

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

FALLBACK_ALLOWED_ERRORS = QUOTA; exhausted SERVER/TIMEOUT/TRANSPORT/RATE_LIMIT; stable MODEL_UNAVAILABLE
FALLBACK_FORBIDDEN_ERRORS = credential/auth/config/request/context/empty-response/abort/unclassified/Agent/tool/business errors
PARTIAL_OUTPUT_POLICY = external/materialized partial output forbids fallback; uncertain terminal outcome is outcome_unknown
TOOL_SIDE_EFFECT_POLICY = any emitted/executed tool or possible external side effect forbids replay and fallback

RETRY_POLICY = bounded provider-owned retry; max 2 transient retries; max 1 provider switch; no always mode
COOLDOWN_POLICY = process-local exact-route breaker; QUOTA 30m; MODEL_UNAVAILABLE 10m; exhausted transient 60s; persistent NO

OBSERVABILITY = durable requested/attempted/failed/selected/final route evidence; no secrets/raw provider error body

LUNA_ROUTE_CHANGED = NO
ROUTER_DYNAMIC_MODEL_ROUTER = NO
SCHEDULER_CHANGE = NONE
KERNEL_CHANGE = NONE

PR18_FAILURE_CLASSIFICATION_PREREQUISITE = NOT_SATISFIED_NOT_MERGED
FALLBACK_IMPLEMENTATION_READY = NO

SPEC_STATUS = proposed
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES
```

