# AGT_CTO Luna cold-backup V2 — frozen investigation evidence

- observation time: `2026-08-29 +0800`
- repository base examined: `4bab9c902931164fb6f812e46891daf9ee7bf68f`
- environment: production macOS darwin x64, Node `v25.6.1`, production root
  `/Users/authsvc/.agent-core`, target `agt_cto-agent`
- handling: read-only metadata/source/transcript inspection; no model call, OAuth operation,
  token read/hash, plugin install, config write, restart or production mutation
- purpose: stable non-secret support for the three proposed ordered-route-chain V2 authorities

This artifact freezes only observed leaf values and reproducible coordinates. Runtime paths are not
repository-controlled and therefore remain subject to mandatory execution-time revalidation.

## OBS-V2-001 — production root and target Home

Method: read-only parse of `/Library/LaunchDaemons/ai.agent-core.runtime.plist` Label and
ProgramArguments; readlink/realpath of `/Users/authsvc/.agent-core/agents.json`; lstat target Home.

Observed leaves:

```text
runtime root = /Users/authsvc/.agent-core
agents definition realpath = /usr/local/libexec/agent-core/config/agents.json
TARGET_HOME = /Users/authsvc/.agent-core/homes/agt_cto-agent
TARGET_HOME type = directory
TARGET_HOME owner uid = 502
TARGET_HOME mode = 0755
```

Limitations: metadata only; does not prove future state or credential validity.

## OBS-V2-002 — existing OAuth metadata

Method: lstat exact target path before and after offline plugin checks. Token content was not opened;
no content hash/digest was computed.

```text
path = /Users/authsvc/.agent-core/homes/agt_cto-agent/.openai-codex-auth.json
type = regular file
owner uid = 502
mode = 0600
size = 2092 bytes
mtime = 2026-08-20T06:46:21+0800
before metadata = after metadata
```

Limitations: metadata does not prove provenance or online validity. Owner acceptance and authorized
counted canaries remain mandatory. It does not authorize login/refresh/copy/rewrite/delete.

## OBS-V2-003 — existing dsh-codex profile

Coordinates:

- `/Users/authsvc/.agent-core/homes/agt_cto-agent/profiles/node_modules/dsh-codex/package.json:1-89`
- `/Users/authsvc/.agent-core/homes/agt_cto-agent/profiles/agent-core-production/package.json:7-16`

Method: read version/main/peerDependencies/bundle registration; production x64 Node
`import.meta.resolve` for every declared peer; offline ESM import with `HOME=/var/empty` and an
unreachable proxy; OAuth lstat before/after.

```text
dsh-codex version = 0.2.3
production profile registration = present
peer dependencies resolved = 19/19
plugin entry offline ESM import = PASS
OAuth metadata changed = NO
```

Limitations: offline load is not a model call and does not prove OAuth/network success.

## OBS-V2-004 — production Harness identity closure

Coordinates:

- `/usr/local/libexec/agent-core/harness/package.json:1-10`
- `/usr/local/libexec/agent-core/app/packages/agent-provisioning/src/index.js:81-143,173-190`

Method: read package/runtime leaves, `file` addon architecture, lstat `.git` and `.source-stamp`,
read-only invocation of deployed `readHarnessIdentity`.

```text
Node = v25.6.1 / darwin / x64
Harness version = 0.1.0-rc.8
expected commit = 514ab7b0029141b88c807704764d0d3e1eea1da4
production .git = absent
production .source-stamp = absent
readHarnessIdentity result = dsh_commit_mismatch
HARNESS_IDENTITY_READY = NO
```

Limitations: no deployed source-stamp was created. Installed-tree equality to the expected clean
checkout must be measured during authorized deployment before writing an honest stamp.

## OBS-V2-005 — real GLM quota transcript shape

Coordinate:
`/Users/authsvc/.agent-core/homes/agt_cto-agent/sessions/--Users-authsvc-.agent-core-workspaces-agt_cto-agent--/main/session.jsonl:600-609`.

Observed event order: turn/user transcript/request header precede terminal 429 quota error; bounded
turn contains usage 0/0 and no assistant message/tool event.

```text
provider request established = YES
user transcript present = YES
provider class = account_quota_exhausted
HTTP status = 429
response termination = proven by turn/end(error); no timeout
assistant/model output token count = 0
partial output = NO in bounded turn
assistant content = NO in bounded turn
tool call / tool started = NO in bounded turn
external side effect = NO in bounded terminal no-tool turn
outcome_unknown = NO
terminal = 429 QUOTA / Usage limit reached for 5 hour
```

Limitations: transcript does not expose or retain raw HTTP body here; zero usage is not
no-admission proof. The evidence supports classification as the distinct terminal pre-generation
quota class under the V2 policy, not credential health. It must not be reproduced by consuming
additional real quota.

## OBS-V2-006 — current classifier defect

Repository revision: `4bab9c902931164fb6f812e46891daf9ee7bf68f`.

Coordinates and immutable blobs:

```text
packages/agent-router/src/route-chain.js:104-156,276-313
blob 4c7d54416c1f0eb7736cc7c153c475d0af4b9c70
packages/agent-router/src/process/provider-errors.js:22-31,58-65
blob a89c0cf94394adf911083c259359099a95481085
packages/agent-router/test/route-chain/route-chain.test.js:93-118
blob c1ec91b3114fed701db0b8bbcc419f151f9ae941
```

Method: construct a real-shape `failed + promptReceipt=accepted +
account_quota_exhausted` carrier and invoke current classifier.

```text
actual current classification = initialize_provider_unavailable / proven_no_admission
expected policy classification = provider_quota_rejected_before_generation
expected hop decision = YES only with all terminal/zero-generation safety evidence
defect = CONFIRMED
```

Limitations: bounded classifier reproduction; does not execute a provider call. The correction and
full regression suite require an independently audited implementation.

## OBS-V2-007 — GLM strict success baseline

Coordinate: the same production session file `:610-625`.

```text
request provider/model = zai / glm-5.3
assistant terminal success = present
Owner ruling GLM_STRICT_PRODUCTION_READY = YES
```

Limitations: one bounded success observation; activation must revalidate strict health immediately
before and after deployment/canary operations.

## Stable claims supported by this investigation

```text
CLM-V2-001 [SUPPORTED; backlink EVD-V2-001] TARGET_HOME_CURRENT_METADATA = path + directory 0755/uid502 at observed_at
CLM-V2-002 [SUPPORTED; backlink EVD-V2-002] EXISTING_LUNA_ASSET_OFFLINE_READY = OAuth metadata valid + dsh-codex 0.2.3 offline load ready
CLM-V2-003 [SUPPORTED; backlink EVD-V2-003] HARNESS_IDENTITY_BLOCKED_CURRENT = deployed identity returns dsh_commit_mismatch; fix required
CLM-V2-004 [SUPPORTED; backlink EVD-V2-004] REAL_GLM_429_TERMINAL_PREGEN_EVIDENCE = provider request precedes terminal quota rejection with zero generation/tool/side-effect evidence
CLM-V2-005 [SUPPORTED; backlink EVD-V2-005] CURRENT_CLASSIFIER_FIX_REQUIRED = pinned base misclassifies accepted quota carrier
CLM-V2-006 [SUPPORTED; backlink EVD-V2-006] GLM_STRICT_BOUNDED_SUCCESS_OBSERVED = one zai/glm-5.3 terminal success at coordinate
```

These Claims describe observed state only. Parent/IMPL/Activation Contracts independently impose
the exact quota-hop predicates, ambiguous/unsafe STOP rules, fix, readiness and activation consequences.

## Qualified evidence relations

| Evidence ID | source_observations | target_type / target_id | relation | pinned revision | environment / observed_at | strength / sufficiency | limitations | provenance |
|---|---|---|---|---|---|---|---|---|
| EVD-V2-001 | OBS-V2-001 | Claim / `CLM-V2-001` | SUPPORTS | runtime state observed 2026-08-29; reviewed spec commit pins claim/artifact | production macOS x64 / 2026-08-29 +0800 | DIRECT metadata; sufficient only for proposal current-state premise | future drift possible; revalidate before apply | this artifact §OBS-V2-001 + listed plist/definition/Home paths |
| EVD-V2-002 | OBS-V2-002, OBS-V2-003 | Claim / `CLM-V2-002` | SUPPORTS | runtime state observed 2026-08-29; dsh-codex exact 0.2.3 | production target Home / 2026-08-29 +0800 | DIRECT metadata/load; sufficient for reuse-gate proposal | not provenance or online validity; Owner+canaries required | this artifact §OBS-V2-002/003 + listed package paths |
| EVD-V2-003 | OBS-V2-004 | Claim / `CLM-V2-003` | SUPPORTS | Harness rc.8 expected commit `514ab7b...`; reviewed spec commit pins claim/artifact | production Harness / 2026-08-29 +0800 | DIRECT failure reproduction; sufficient to establish current blocker/fix need | does not prove future stamp or satisfy readiness gate | this artifact §OBS-V2-004 + listed package/source paths |
| EVD-V2-004 | OBS-V2-005 | Claim / `CLM-V2-004` | SUPPORTS | transcript lines 600-609 as observed 2026-08-29; reviewed spec commit pins claim | production target session / 2026-08-29 +0800 | DIRECT lifecycle order; sufficient for observed admission claim | does not itself impose policy STOP; no raw HTTP body; usage 0 is not no-admission proof | this artifact §OBS-V2-005 + exact session coordinate |
| EVD-V2-005 | OBS-V2-006 | Claim / `CLM-V2-005` | SUPPORTS | repository base `4bab9c902931164fb6f812e46891daf9ee7bf68f` + three exact blobs | clean repository test harness / 2026-08-29 +0800 | DIRECT deterministic reproduction; sufficient to establish current fix need | does not satisfy future implementation Contracts; implementation/audit required | this artifact §OBS-V2-006 + exact repository paths/blobs |
| EVD-V2-006 | OBS-V2-007 | Claim / `CLM-V2-006` | SUPPORTS | transcript lines 610-625 as observed; reviewed spec commit pins claim | production target session / 2026-08-29 +0800 | DIRECT bounded success; sufficient only for bounded observed baseline | Owner policy is separate authority; must revalidate before/after apply | this artifact §OBS-V2-007 + exact session coordinate |

No relation claims OAuth online validity, future production state, implementation correctness or
activation completion. Those remain explicit gates.
