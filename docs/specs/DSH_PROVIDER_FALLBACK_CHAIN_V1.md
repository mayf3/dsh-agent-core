---
spec_id: DSH_PROVIDER_FALLBACK_CHAIN_V1
status: proposed
created: 2026-08-19
amended: 2026-08-20
amendment: DSH_PROVIDER_FALLBACK_CHAIN_V1_OWNER_POLICY_AMENDMENT
scope: bounded_fallback_enabled_agents_without_explicit_per_agent_override
---

# DSH Provider Fallback Chain V1

> SPEC STATUS: **proposed**. This document is Investigation + Spec only. It grants no
> implementation, production provider change, provider cutover, existing provider-route
> implementation change, merge,
> credential movement, or deployment permission.

## 0. Frozen outcome

For an Agent enrolled by the deployment-authored fallback-enabled Agent allowlist, the
proposed default route is:

```text
PRIMARY_PROVIDER = zai
PRIMARY_MODEL = glm-5.3

SECONDARY_PROVIDER = openai-codex
SECONDARY_MODEL = gpt-5.6-luna

TERTIARY_PROVIDER = opencode-go
TERTIARY_MODEL = deepseek-v4-flash
```

This owner-policy amendment intentionally changes the previous two-route proposal
`zai/glm-5.2 -> opencode-go/deepseek-v4-flash`. The exact production-loaded pi-ai 0.82.1
catalog contains `zai/glm-5.2`, not `zai/glm-5.3`; therefore the newly frozen primary is a
target policy, not current catalog or execution-readiness evidence. Exact GLM-5.3 adapter,
catalog/config, credential, and real model execution must be proved before implementation
readiness may become YES. The existing catalog continues to contain
`opencode-go/deepseek-v4-flash`; current account readiness is separately NO due to the
observed 429 described in §2.

Route precedence is frozen:

```text
explicit per-Agent route
> global/default fallback chain
```

An explicit per-Agent route still wins. `agt_cto-agent` remains governed by accepted
`AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1` unless deployment later removes that explicit
override and separately enrolls it in this chain:

```text
agt_cto-agent
→ explicit openai-codex/gpt-5.6-luna
→ no automatic fallback
```

This amendment attaches Luna as the secondary for fallback-enabled Agents. It does not
silently change any existing explicit Luna route or production configuration.

Owner risk acceptance is frozen exactly as follows:

```text
SHARED_ZAI_KEY_ALLOWED = YES
SHARED_LUNA_ACCOUNT_ALLOWED = YES
COOPERATIVE_SHARED_HOST_TRUST_DOMAIN = ACCEPTED
```

These statements accept account sharing within the cooperative shared-host trust domain;
they do not authorize credential duplication, production activation, or implementation.

## 1. Authority and scope

### 1.1 In scope

- Agents without an explicit per-Agent model override that are explicitly enrolled in a
  bounded, deployment-authored fallback-enabled Agent allowlist.
- One ordered primary/secondary/tertiary chain.
- Provider-call failure handling before any assistant message is materialized and before
  any tool or external side effect is executed.
- Stable failure classification, bounded same-provider retry, at most two provider switches,
  process-local cooldown, and durable non-secret observability.
- One operator-owned shared ZAI key authority and one operator-owned shared Luna OAuth
  credential authority, supplied only to enrolled Agent processes within the accepted
  cooperative shared-host trust domain.

### 1.2 Non-goals

- Automatic enrollment of `agt_cto-agent` or any change to its current explicit override.
- Account pool, load balancing, quota scheduler, or provider purchasing.
- Per-Agent copies of the Luna refresh token, blind copying of auth files, or a new
  credential service.
- Dynamic Router model routing or provider-switch decisions in Agent Core Router.
- Agent Core Kernel, Binding, Session model, Feishu, or Scheduler change. The separately
  reviewed fleet proxy allowlist may extend the existing spawn-env plumbing only; it gains
  no route-selection authority.
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

The current amendment was authored after a fresh fetch with:

```text
AMENDMENT_REMOTE_BRANCH_HEAD = origin/docs/dsh-provider-fallback-chain-v1@abb87e670d9b2708d510d3b1ed6878ed58e7b9b0
AMENDMENT_REPOSITORY_HEAD_OBSERVED = origin/main@ec18774b85869ac6512b496bbeb116377e889291
TARGET_PROXY_SPEC = AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1 (accepted)
```

The launchd runtime currently injects `oc-go/deepseek-v4-flash`. Per-home DSH settings
declare `opencode-go`, the `oc-go` compatibility route, and their supported models, but do
not declare a `zai` provider profile. The launchd environment also does not provide
`ZAI_API_KEY`, and the inspected Agent credential documents contain no ZAI credential.
An ambient `ZAI_API_KEY` in the investigator's interactive shell is not a production
credential seam and is not readiness evidence.

The old GLM-5.2 readiness fields below are historical evidence only and are superseded for
the amended primary by the GLM-5.3 gate:

```text
GLM53_CATALOG_OR_ADAPTER_PROOF = NOT_PROVEN
GLM53_PROVIDER_CONFIG_PROOF = NOT_PROVEN
GLM53_REAL_MODEL_EXECUTION = PENDING
GLM53_READINESS = PENDING_REAL_MODEL_EXECUTION_VALIDATION
```

Owner permits a shared ZAI key. The future implementation must still consume it from one
operator-owned, owner-only authority and expose it only to fallback-enabled Agent
processes; it must never enter Workspace files, argv, prompts, events, or logs. This Spec
does not read, copy, validate, or activate that key.

The `opencode-go` credential is present, but configuration presence is not account
readiness. A 2026-08-19 isolated one-token diagnostic request to the exact route
returned HTTP 429 `GoUsageLimitError` with a monthly usage-limit message. No production
configuration or process was changed.

```text
OPENCODE_READINESS = NO_CURRENT_429
```

Until a fresh controlled `opencode-go/deepseek-v4-flash` probe succeeds, tertiary
availability must not be advertised as ready.

### 2.1 Luna shared credential source verification

The installed `dsh-codex@0.2.3` source was read without opening the credential document:

- `openAICodexAuthPath()` defaults strictly to
  `<DSH_HOME>/.openai-codex-auth.json`.
- `OpenAICodexCredentialStore.modify()` takes a sibling-file cross-process writer lock,
  re-reads the current credential under that lock, and writes the replacement through an
  owner-only atomic rename (`mode=0600`, created parent `dirMode=0700`).
- pi-ai OAuth resolution performs an optimistic expiry check, then a second expiry check
  inside `CredentialStore.modify()`; only the lock holder refreshes, and the rotated
  credential is persisted before release. Concurrent processes then observe the refreshed
  document rather than independently rotating the same refresh token.
- The store constructor accepts an explicit filename internally, but
  `OpenAICodexService` always constructs the default store and the public plugin `Config`
  exposes no shared auth path.

Therefore owner permission to share one Luna account does **not** permit copying the auth
document into many homes. The minimum safe model is:

```text
SHARED_LUNA_CREDENTIAL_MODEL =
  one operator-owned shared credential authority
  -> one canonical auth document outside every Agent Workspace
  -> parent directory 0700; auth document and writer lock 0600
  -> dsh-codex cross-process writer lock + double-checked refresh + atomic rewrite
  -> only fallback-enabled Agent processes receive the configured authority path
  -> no credential or token in Workspace / argv / prompt / event / logs
```

The smallest missing seam is an optional, deployment-authored `dsh-codex` config field for
an absolute shared auth path (conceptually `credentialPath`) that is passed to
`OpenAICodexCredentialStore`. It must default to the existing per-`DSH_HOME` path when
absent; reject relative paths, symlinks, paths inside an Agent Workspace, wrong ownership,
directory mode broader than 0700, or file/lock mode broader than 0600; never log the path's
contents or any token. The same canonical path must be resolved by every enrolled process
so the existing file lock actually coordinates them. This is a minimal plugin/config seam,
not a credential service, broker, copy operation, or per-home refresh-token fan-out.
An orphaned writer lock must time out fail-loud and require explicit operator recovery; a
contender must never delete a lock merely because it appears old.

```text
LUNA_SHARED_READINESS = NO_SHARED_AUTH_PATH_CONFIG_SEAM_NOT_READY
```

### 2.2 Fleet Luna proxy model

Accepted `AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1` scopes its `providerEnv`
schema to exactly `agt_cto-agent`; it does not authorize fleet Luna fallback. This
amendment selects the smallest follow-up model:

```text
LUNA_PROXY_MODEL =
  bounded fallback-enabled Agent allowlist proxy env at AgentProcess spawn;
  reuse the accepted providerEnv validation, inherited-proxy stripping, target-only
  respawn/reload, no-log/no-argv rules;
  extend authority from the single target only through a separately reviewed accepted
  Spec/implementation;
  production-runtime global proxy forbidden
```

Every non-enrolled Agent process must remain proxy-free and byte-identical in route/env.
Because this model is process-scoped rather than provider-call-scoped, its review must
explicitly accept that the enrolled process's ZAI and opencode calls inherit the same proxy
environment; otherwise the alternative is a provider-scoped Luna dispatcher seam and a
new owner decision. No production-runtime global proxy is permitted under either model.

The amendment readiness conjunction is:

```text
FALLBACK_IMPLEMENTATION_READY = YES only if all are closed independently:
  turn/end failure propagation reviewed and merged = YES (currently closed)
  GLM-5.3 exact adapter/catalog/config and real execution = PASS (currently pending)
  shared Luna credentialPath seam and multiprocess tests = PASS (currently NO)
  bounded fleet proxy allowlist Spec/review/implementation = PASS (currently NO)
  opencode-go real readiness probe = PASS (currently 429 / NO)
  this fallback Spec independently reviewed and accepted = YES (currently proposed / NO)
otherwise FALLBACK_IMPLEMENTATION_READY = NO
```

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
  implementation present on origin/main = YES
  correlated turn/end.reason.error = YES
  sanitized structured fail-loud / no empty-reply success = YES
  merged to main = YES
FALLBACK_IMPLEMENTATION_READY = NO
```

Both gates remain mandatory. Source presence, an open review, a draft change, or a candidate
commit is not proof of the capability. This amendment source-verifies the merged
`origin/main` path: the Router correlates receipt -> `turn/start` -> matching
`user/message` -> same-turn `turn/end`; an error reason is sanitized and thrown before the
empty-reply return path. This prerequisite is therefore closed, but it does not close the
independent GLM-5.3, shared Luna, fleet proxy, fallback-plugin, or opencode readiness gates.

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

At most three provider routes may be attempted in V1, in the frozen order. The fallback
count is therefore at most two. `@deepseek-ai/dsh-llm-retry` retains sole ownership of
same-provider retry. The fallback layer runs only after `llm-retry` delegates a terminally
exhausted eligible error. For `QUOTA` and stable `MODEL_UNAVAILABLE`, the configured retry
budget is zero and is therefore terminal on the first failure. The fallback layer must
never retry the same provider itself.

```text
requested route = zai/glm-5.3

primary attempt
  → QUOTA or stable MODEL_UNAVAILABLE
      → no primary retry
      → open cooldown
      → secondary Luna attempt

  → RATE_LIMIT/SERVER/TIMEOUT/TRANSPORT
      → reuse provider-owned normal retry policy
         (max 2 retries; 500ms exponential start; 10s cap; 0.1 jitter;
          bounded Retry-After only)
      → if exhausted, open cooldown
      → secondary Luna attempt

  → forbidden/unclassified error
      → no switch; fail loud

secondary failure
  → apply only secondary's own bounded same-provider retry where eligible
  → after terminal exhaustion, re-run the whole-turn safety gate
  → only for an allowlisted stable class, switch once to tertiary opencode-go
  → forbidden/unclassified/auth/credential failure: no tertiary; fail loud

tertiary failure
  → apply only tertiary's own bounded same-provider retry where eligible
  → never restart the chain and never switch provider again
  → fail loud with the tertiary's truthful terminal class
```

The mandatory waterfall is:

1. Primary provider attempt.
2. Existing same-provider bounded retry by `llm-retry`; resolved `maxRetries` must be `<= 2`.
3. Same-provider retry terminal exhaustion.
4. Only for one allowlisted stable class, zero current-turn materialized output, and zero
   current-turn tool/external side effect: switch from primary to secondary once.
5. Secondary provider execution, with its own independently bounded same-provider retry.
6. After secondary terminal exhaustion, run the same allowlist and entire-turn safety gate
   again; if it passes, switch from secondary to tertiary once.
7. Tertiary provider execution, with its own independently bounded same-provider retry.
8. No third provider switch and no chain restart.

Startup must resolve every configured retry policy used by all three routes. A resolved
`maxRetries > 2`, an unbounded policy, or `mode: always` is invalid and must reject startup.
The retry and fallback layers must not each retry the same failure; retry multiplication is
forbidden.

```text
RETRY_POLICY =
  QUOTA/MODEL_UNAVAILABLE: 0 same-provider retries;
  RATE_LIMIT/SERVER/TIMEOUT/TRANSPORT: existing provider-owned normal policy,
  maximum 2 retries with bounded backoff;
  maximum provider switches per turn = 2;
  always/unbounded retry mode forbidden

SAME_PROVIDER_RETRY_OWNER = @deepseek-ai/dsh-llm-retry
MAX_TRANSIENT_RETRIES = 2
MAX_PROVIDER_SWITCHES = 2
```

### 7.1 Process-local circuit breaker

The V1 plugin owns a process-local circuit breaker keyed by exact provider/model route for
each nonterminal route (`zai/glm-5.3` and `openai-codex/gpt-5.6-luna`).
The following durations are **V1 policy constants**, not existing DSH defaults:

- `QUOTA`: open for 30 minutes.
- stable `MODEL_UNAVAILABLE`: open for 10 minutes.
- exhausted `RATE_LIMIT`, `SERVER`, `TIMEOUT`, or `TRANSPORT`: open for 60 seconds.
- While the primary breaker is open, an eligible enrolled Agent turn goes directly to the
  secondary without waiting for primary. Because there is no primary call in that turn,
  the complete mandatory `llm/fallback` evidence is:

  ```text
  requestedProvider = zai
  requestedModel = glm-5.3

  primaryAttempted = false
  attemptedProvider = NONE
  attemptedModel = NONE

  routeState = primary_cooldown_active
  stableFailureClass = NONE

  breakerOriginStableFailureClass = <exact historical stable class from §5.1>

  selectedProvider = openai-codex
  selectedModel = gpt-5.6-luna
  fallbackCount = 1
  ```

  Selecting the secondary in this state means the primary was skipped because an existing
  breaker was open. It does not mean the current turn attempted and failed the primary.
- If the secondary breaker is already open when the chain reaches Luna, Luna is likewise
  skipped without a fabricated current Luna attempt. A second `llm/fallback` event records
  `primaryAttempted` unchanged, `attemptedProvider=NONE`, `attemptedModel=NONE`,
  `routeState=secondary_cooldown_active`, `stableFailureClass=NONE`, exact historical
  `breakerOriginStableFailureClass`, selected
  `opencode-go/deepseek-v4-flash`, and `fallbackCount=2`.
- After expiry, exactly one single-flight half-open probe per exact route is allowed;
  concurrent turns use that route's next downstream route until the probe succeeds or
  reopens the breaker.
- Successful completion on a nonterminal route closes that exact route's breaker.

```text
COOLDOWN_POLICY =
  process-local exact-route circuit breaker with V1 policy constants;
  account_quota_exhausted 30m;
  model_unavailable 10m;
  rate_limited/provider_unavailable/bounded_transient_network_failure 60s;
  single-flight half-open probe;
  persistent cooldown = NO in V1

PRIMARY_COOLDOWN_ROUTE_STATE = primary_cooldown_active
SECONDARY_COOLDOWN_ROUTE_STATE = secondary_cooldown_active
BREAKER_ORIGIN_STABLE_FAILURE_CLASS =
  account_quota_exhausted / rate_limited / provider_unavailable /
  bounded_transient_network_failure / model_unavailable
CURRENT_ATTEMPT_STABLE_FAILURE_CLASS = NONE when primaryAttempted=false
```

`breakerOriginStableFailureClass` is the exact normalized class that opened the relevant
route breaker.
It must be copied verbatim from §5.1 and preserves the one-to-one provenance from the
original normalized failure to its cooldown. It must not be replaced by a coarse category
such as `exhausted_transient_failure`. A cooldown bypass must never fabricate a current-turn
`QUOTA`, `RATE_LIMIT`, `SERVER`, `TIMEOUT`, `TRANSPORT`, or `MODEL_UNAVAILABLE`, and must
never claim that `zai/glm-5.3` or `openai-codex/gpt-5.6-luna` was attempted when that route
was not called.

Persistent cross-process cooldown would introduce shared fleet/account coordination and a
new durable authority adjacent to the explicitly excluded quota scheduler/account pool.
It is deferred. V1 limits repeated waiting per Agent process; a process restart may perform
one new primary probe and must remain observable.

## 8. Configuration, credential authority, and proxy boundary

The fallback plugin configuration must be deployment-authored and fail loud. Conceptually:

```yaml
scope: deployment-authored-fallback-enabled-agent-allowlist
routes:
  - provider: zai
    model: glm-5.3
  - provider: openai-codex
    model: gpt-5.6-luna
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

Enrollment is an explicit deployment decision. An empty/missing allowlist means the chain
is disabled; unknown/duplicate Agent IDs or an Agent with an explicit route appearing in
the allowlist fail startup. Fleet size must never be inferred from discovered homes.

Credential and proxy configuration must satisfy §2.1-§2.2 before startup:

- shared ZAI key and shared Luna auth stay in operator-owned authorities outside every
  Workspace; no secret value in config, argv, prompt, events, or logs;
- every Luna-enabled process resolves the same canonical auth path through the minimal
  `dsh-codex` config seam; copying into per-Agent homes is forbidden;
- proxy env is injected only into explicitly enrolled AgentProcess children through the
  separately accepted bounded-allowlist extension; production-runtime global proxy and
  launchd-global proxy are forbidden;
- absent/unreadable/wrong-mode authorities, an unimplemented shared-path seam, or an
  unaccepted fleet proxy extension reject enablement fail-loud.

## 9. Observability and evidence

Fallback must append one non-surface durable `llm/fallback` event before each downstream
provider selection (secondary or tertiary). Its schema must contain at least:

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

For a normal primary or secondary call, `attemptedProvider`, `attemptedModel`, and
`stableFailureClass` describe that actual call and its one-to-one class from §5.1. For a
cooldown bypass they
are exactly `NONE`, `NONE`, and `NONE`; `breakerOriginStableFailureClass` separately explains
why the process-local route breaker was already open. Session evidence, logs, and acceptance
reports must preserve this distinction and must not synthesize an attempted primary or
secondary route or current-turn failure. `stableFailureClass` exclusively describes an actual
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
  + every selected downstream provider/model + monotonic fallback count (1 then at most 2)
  + cooldown state;
  final provider/model proven by request context and assistant message provenance;
  secrets and raw provider error bodies forbidden
```

## 10. Required implementation acceptance (future, not authorized now)

An implementation may begin only after this Spec is independently reviewed, accepted, and
the §4 prerequisite is merged. Its acceptance must include:

1. Exact DSH source/version and exact provider catalogs pinned.
2. No explicit-override or non-enrolled Agent is intercepted; the existing `agt_cto-agent`
   explicit Luna route has zero fallback events unless a later deployment separately
   removes that override and enrolls it.
3. Primary success produces no secondary or tertiary call.
4. Each allowed stable class follows §5/§7 exactly.
5. Every forbidden class fails loud with zero additional downstream calls.
6. Partial streamed chunks followed by failure remain non-surface; any current-turn
   materialized assistant output forbids fallback and replay.
7. Any current-turn emitted/materialized/executed tool call, file mutation, Forum write,
   Workflow transition, Feishu delivery, parent RPC, or possible external side effect
   makes fallback/replay impossible and yields fail-loud/outcome-unknown.
8. At most two provider switches per turn, exact order
   `zai/glm-5.3 -> openai-codex/gpt-5.6-luna -> opencode-go/deepseek-v4-flash`, and no
   chain restart after tertiary failure.
9. Cooldown/half-open behavior is deterministic under concurrent turns and resets on
   process restart as documented.
10. Durable events prove requested, attempted, failed, selected, and final routes without
    secrets.
11. Real controlled primary, secondary, and tertiary account/model probes pass before
    production rollout; configuration presence alone fails the gate.
12. The fallback-switch implementation has no Router, Binding, Session model, Feishu,
    Scheduler, or Kernel diff. The independently governed fleet proxy prerequisite may
    contain only its accepted minimal spawn-env plumbing diff and no routing semantics.
13. Startup rejects `mode: always`, unbounded retry, and resolved `maxRetries > 2`; tests
    prove no multiplicative retry between `llm-retry` and fallback.
14. Every raw code in §5.1 has exactly one class and disposition; unmapped codes fail loud
    without a secondary call.
15. A primary cooldown bypass proves `primaryAttempted=false`, `attemptedProvider=NONE`,
    `attemptedModel=NONE`, `stableFailureClass=NONE`, the exact §5.1
    `breakerOriginStableFailureClass`, selected secondary route, and fallback count without
    fabricating a current primary attempt or failure.
16. A secondary cooldown bypass uses the same no-fabrication rule, selects the tertiary,
    and records `fallbackCount=2` without claiming a current Luna attempt.
17. Multi-process Luna tests point multiple processes to one temporary canonical auth
    document and prove one refresh under contention, lock timeout fail-loud, atomic complete
    readers, rotated refresh persistence, and 0600/0700 enforcement; tests never use or copy
    a real OAuth credential.
18. Fleet proxy tests prove only bounded allowlisted AgentProcess children receive the
    accepted four-key proxy env, non-enrolled children remain proxy-free, and runtime-global
    proxy is absent; real proxy acceptance remains a separately authorized gate.
19. GLM-5.3 exact adapter/catalog/config plus real model execution succeeds; Luna shared
    auth-path seam and bounded allowlist proxy extension are independently accepted and
    implemented; opencode-go no longer returns the current 429.

## 11. Final output contract

```text
FALLBACK_POLICY_AMENDMENT = PASS

BASE_REMOTE_HEAD = abb87e670d9b2708d510d3b1ed6878ed58e7b9b0
SCOPE = bounded deployment-authored fallback-enabled Agent allowlist; explicit overrides excluded

PRIMARY_ROUTE = zai / glm-5.3
SECONDARY_ROUTE = openai-codex / gpt-5.6-luna
TERTIARY_ROUTE = opencode-go / deepseek-v4-flash

SHARED_ZAI_KEY_ALLOWED = YES
SHARED_LUNA_ACCOUNT_ALLOWED = YES
COOPERATIVE_SHARED_HOST_TRUST_DOMAIN = ACCEPTED

SHARED_LUNA_CREDENTIAL_MODEL = one operator-owned canonical shared auth document; dsh-codex configurable absolute credentialPath seam; cross-process lock + double-checked refresh + 0600 atomic rewrite under 0700 directory; enrolled processes only; no per-home copies; no Workspace/argv/prompt/event/log secrets; no credential service
LUNA_PROXY_MODEL = bounded fallback-enabled Agent allowlist providerEnv at AgentProcess spawn, extending the accepted target-only seam only after separate accepted review/implementation; non-enrolled processes proxy-free; production-runtime/launchd global proxy forbidden

FALLBACK_WATERFALL = zai/glm-5.3 -> openai-codex/gpt-5.6-luna -> opencode-go/deepseek-v4-flash -> fail-loud
WHOLE_TURN_SIDE_EFFECT_GATE = any current-turn materialized/external output, emitted/materialized/executed tool call, file mutation, external side effect, or uncertain external outcome forbids fallback and replay; fail loud/outcome_unknown

CURRENT_DSH_FALLBACK_SUPPORT = SAME_PROVIDER_BOUNDED_RETRY_ONLY
INTEGRATION_LAYER = DSH provider runtime / Agent-loop model-call recovery plugin
MODEL_CALL_RETRY_SEAM = agent/request-error + agent/request
PROVIDER_SELECTION_AUTHORITY = explicit per-Agent route first; otherwise explicit fallback-enabled allowlist + DSH fallback policy
FALLBACK_ROUTER_CHANGE_REQUIRED = NO
LUNA_PROXY_ROUTER_CODE_CHANGE_REQUIRED = YES_MINIMAL_FUTURE_ACCEPTED_SPEC
ROUTER_ROUTING_SEMANTIC_CHANGE = NONE

TURN_END_FAILURE_PROPAGATION_PREREQUISITE = real correlated sanitized turn/end.reason.error → stable class → structured fail-loud → no empty-reply success; independent implementation review PASS and merged main YES required
CURRENT_PREREQUISITE_STATUS = implementation present and merged on origin/main YES

FALLBACK_ALLOWED_ERRORS = account_quota_exhausted; exhausted rate_limited/provider_unavailable/bounded_transient_network_failure; stable model_unavailable
FALLBACK_FORBIDDEN_ERRORS = credential/auth/config/request/context/empty-response/abort/unclassified/Agent/tool/business errors
PARTIAL_OUTPUT_POLICY = external/materialized partial output forbids fallback; uncertain terminal outcome is outcome_unknown
TOOL_SIDE_EFFECT_POLICY = any emitted/executed tool or possible external side effect forbids replay and fallback

RETRY_POLICY = bounded provider-owned retry first; max 2 transient retries per route; max 2 provider switches; no always mode
RETRY_FALLBACK_ORDER = each route → llm-retry bounded same-provider retry → terminal exhaustion → allowlist and entire-turn safety gate → next route; after tertiary fail-loud
SAME_PROVIDER_RETRY_OWNER = @deepseek-ai/dsh-llm-retry
MAX_TRANSIENT_RETRIES = 2
MAX_PROVIDER_SWITCHES = 2

FAILURE_NORMALIZATION = one raw code → exactly one stable class → exactly one disposition; unmapped fail-loud and never fallback

COOLDOWN_POLICY = process-local exact-route breaker using V1 policy constants; account_quota_exhausted 30m; model_unavailable 10m; rate_limited/provider_unavailable/bounded_transient_network_failure 60s; persistent NO
PRIMARY_COOLDOWN_BYPASS_EVENT_SCHEMA = requestedProvider=zai; requestedModel=glm-5.3; primaryAttempted=false; attemptedProvider=NONE; attemptedModel=NONE; routeState=primary_cooldown_active; stableFailureClass=NONE; breakerOriginStableFailureClass=<exact §5.1 class>; selectedProvider=openai-codex; selectedModel=gpt-5.6-luna; fallbackCount=1
SECONDARY_COOLDOWN_BYPASS_EVENT_SCHEMA = attemptedProvider=NONE; attemptedModel=NONE; routeState=secondary_cooldown_active; stableFailureClass=NONE; breakerOriginStableFailureClass=<exact §5.1 class>; selectedProvider=opencode-go; selectedModel=deepseek-v4-flash; fallbackCount=2
PRIMARY_ATTEMPTED = false
ATTEMPTED_PROVIDER = NONE
ATTEMPTED_MODEL = NONE
CURRENT_ATTEMPT_STABLE_FAILURE_CLASS = NONE
BREAKER_ORIGIN_STABLE_FAILURE_CLASS = exact §5.1 class
HISTORICAL_FAILURE_PROVENANCE_ONE_TO_ONE = YES
PRIMARY_COOLDOWN_ROUTE_STATE = primary_cooldown_active
SECONDARY_COOLDOWN_ROUTE_STATE = secondary_cooldown_active

CURRENT_TURN_SIDE_EFFECT_POLICY = any current-turn materialized output, tool event, file mutation, or possible external side effect forbids subsequent fallback/replay

OBSERVABILITY = every switch records actual attempted route or NONE on cooldown bypass, exact current/historical class separation, selected downstream route, monotonic fallbackCount <= 2, and final route; no secrets/raw provider error body

GLM53_READINESS = PENDING_REAL_MODEL_EXECUTION_VALIDATION
LUNA_SHARED_READINESS = NO_SHARED_AUTH_PATH_CONFIG_SEAM_AND_FLEET_PROXY_EXTENSION_NOT_READY
OPENCODE_READINESS = NO_CURRENT_429

ROUTER_DYNAMIC_MODEL_ROUTER = NO
SCHEDULER_CHANGE = NONE
KERNEL_CHANGE = NONE

PREVIOUS_REQUIRED_FIXES_REGRESSION = NONE

FALLBACK_IMPLEMENTATION_READY = NO

SPEC_STATUS = proposed
READY_FOR_INDEPENDENT_REVIEW = YES
```
