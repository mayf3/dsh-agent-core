---
spec_id: AGENT_CORE_DISTRIBUTION_BOOTSTRAP_V1
status: proposed
---

# AGENT_CORE_DISTRIBUTION_BOOTSTRAP_V1

> Status: **proposed — independent Spec review required before implementation**
>
> Repository: `mayf3/dsh-agent-core`
>
> Baseline: `origin/main` at `93f9acf67cb9b4862fc9b8ffaf593630086285ba`
>
> Change class: `NON_TRIVIAL_PRODUCT_OR_ARCHITECTURE_CHANGE`

## 0. Executive decision

Agent Core has a working production chain, but the repository is not currently a
distribution that another team can clone and operate without the original
developer machine. This Spec authorizes a narrow distribution layer over the
existing product:

```text
git clone
-> npm ci
-> npm run bootstrap
-> configure one external model provider + Feishu App
-> npm run create-agent
-> npm run bind-feishu
-> npm run start:production
-> real Feishu message -> existing Router -> native DSH Session -> reply
```

The distribution layer owns dependency installation, validation, configuration
templates, deployment-side adapters, and documentation. It owns no Agent,
Session, Workspace, Binding, Router, Memory, Scheduler, Broker, or Kernel
semantics.

```text
NORTH_STAR                         = FIRST_AGENT_TIME_TO_RUNNING <= 30 min
KERNEL_CHANGE                      = NONE
ROUTER_PRODUCT_SPECIAL_CASE        = NONE
DSH_FORK                           = NO
OPENCLAW_RUNTIME_DEPENDENCY         = NONE
DEFAULT_AGENT_FALLBACK              = NO
FEISHU_AUTO_CREATE_AGENT            = NO
FEISHU_INGRESS_MODE                 = PREBOUND_ONLY
ONE_AGENT_ONE_PRIMARY_WORKSPACE     = KEEP
NATIVE_DSH_SESSION                  = KEEP
```

## 1. Governance and authority

### 1.1 Why a new Spec is required

`OPEN_SOURCE_DOCS_CONVERGENCE_V1` is accepted, but explicitly records
`PUBLIC_QUICK_START = CURRENTLY_MISSING`, prohibits inventing a product
bootstrap inside docs convergence, and assigns a real Quick Start to a separate
product initiative (§5, §10, §16). Therefore that Spec does not authorize this
implementation.

This work adds public operational contracts (`bootstrap`, `create-agent`,
`bind-feishu`, canonical foreground start) and changes the DSH dependency model
from a developer checkout to an installed release. Those are material product
and distribution surfaces, not documentation-only or mechanical cleanup.

### 1.2 Relevant accepted authority

- `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1`: Spec is the only implementation
  authority; proposed status does not authorize implementation.
- `AGENT_WORKSPACE_SESSION_MODEL_V2` and
  `AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC`: one Agent uses one primary
  Workspace; Feishu normal ingress is PREBOUND_ONLY and may not create a
  default Binding.
- `BINDING_AND_SWITCH_V1`: Router is the sole Binding owner;
  `Router.switchAgent()` is the generic mutation seam and switching may be a
  legal first contact.
- `AGENT_CORE_LARK_TRANSPORT_PHASE1_V1`: Feishu uses the existing connector,
  `FEISHU_CREDS_PATH`, WebSocket long connection, and
  `im.message.receive_v1`.
- Existing production-runtime, agent-definition, agent-provisioning, and
  workspace-bootstrap accepted behavior remains authoritative.

### 1.3 Rejected alternatives kept closed

- Revive the historical V0 install/run scripts.
- Parse `~/.openclaw/openclaw.json` as normal runtime authority.
- Auto-create an Agent from an unknown Feishu conversation.
- Route unknown conversations to a default Agent.
- Add conversation-owned Workspaces, a Workspace registry, or a Session mapping
  database.
- Write Binding JSON directly outside the Router owner seam.
- Add Feishu-specific logic to Router.
- Fork or vendor DeepSeek Harness source.
- Make launchd, a macOS plist, `/usr/local/bin/node`, or a personal checkout a
  product-core dependency.

## 2. Fresh-machine audit (baseline evidence)

The audit assumed only macOS/Linux, git, a supported Node/npm, and operator-owned
model and Feishu credentials. It did not inherit `~/.agent-core`, `~/.dsh`,
`~/.openclaw`, an Agent registry, Binding store, Workspace, launchd unit, or an
existing `node_modules`.

### 2.1 Reproduced clean checkout

An isolated checkout of the exact baseline was created with a new empty HOME and
no `node_modules`.

```text
FRESH_REMOTE_CLONE = BLOCKED_BY_TRANSIENT_NETWORK_RESET
EXACT_SHA_CLEAN_CHECKOUT = PASS
FRESH_NPM_INSTALL = PASS (56 declared packages installed)
FRESH_NPM_TEST = FAIL
```

The test failure is distribution evidence, not a source-only inference:

- `@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-llm`, and other DSH runtime
  packages were missing after root `npm install`.
- `@agent-core/workspace-bootstrap` initially had no root resolution; an
  agent-provisioning test later created the gitignored symlink bridge as a side
  effect.
- the real production-profile DSH boot test skipped because no Harness checkout
  was resolvable.
- separate `listen EPERM` failures were caused by the test sandbox and are not
  classified as distribution defects.

### 2.2 Blockers and machine assumptions

| Blocker | Evidence | Current behavior | Why a fresh machine fails | Minimum authorized direction |
|---|---|---|---|---|
| Root install is incomplete | `package.json:7-23` | only three root dependencies; no workspaces, engine, lockfile, or bootstrap/start commands | local packages and directly imported DSH packages are not installed deterministically | npm workspace/install closure + committed lockfile |
| Harness checkout is assumed | `packages/agent-provisioning/src/index.js:42-70` | searches developer-relative `../../github/deepseek-harness`; CLI is `apps/cli/lib/bin.js` | clean clone has no sibling checkout | installed `@deepseek-ai/dsh` CLI is the default |
| Runtime silently derives checkout | `packages/production-runtime/src/compose.js:100-106` | populates `DSH_HARNESS_ROOT` from the checkout resolver | moves an implicit dev layout into every child | installed CLI resolution; explicit dev override only |
| Local package resolution uses symlink farms | `packages/agent-provisioning/src/index.js:168-199,221-244` | mutates root and per-home `node_modules` with source symlinks | `npm install` alone does not produce the runnable closure | npm workspaces for root resolution; mechanical, idempotent per-home profile assembly only where DSH requires it |
| Operator HOME is configuration authority | `packages/agent-provisioning/src/index.js:224-229` | copies `~/.dsh/settings.yaml` and `.credentials.yaml` when present; otherwise writes an opencode-go default | other teams do not own the original provider or subscription | explicit config inputs/templates; no hidden HOME fallback in bootstrap |
| Provider/model silently default to one developer route | `packages/agent-router/src/process.js:81-88,254-269` | defaults to `opencode-go/deepseek-v4-flash`; reads one named key from per-agent credentials | repository cannot promise that subscription | provider/model required by validation; provider token is external prerequisite |
| Runtime cannot create its required definition | `packages/production-runtime/src/compose.js:153-160` | fails if `agents.json` is absent or lacks a default | first user must hand-author the config | deployment-side `create-agent` adapter reuses `adoptAgents` |
| No prebinding command | `packages/agent-router/src/index.js:416-465` | Router has the correct generic first-contact Binding seam, but no operator CLI | PREBOUND_ONLY rejects the first message until manual JSON/code work | deployment adapter composes Router and calls `switchAgent`; never writes store directly |
| Feishu helper depends on legacy config | `scripts/setup-feishu-creds.mjs:15-32` | derives credentials from an OpenClaw-shaped file | clean user has neither OpenClaw nor `.openduck` | direct template/input validation; legacy import becomes optional and non-canonical |
| Canonical entry is undocumented in package scripts | `scripts/production-runtime.mjs:1-15`; `packages/production-runtime/src/entry.js:15-23` | source entry exists; no `start:production` command | user must know internal script and env contract | one foreground npm command |
| Supervision docs are macOS-first | `scripts/production-runtime-launchd.mjs:30-58`; `packages/production-runtime/README.md:53-76` | launchd adapter is emphasized | Linux user cannot identify the core foreground lifecycle | foreground is canonical; launchd optional; systemd optional example |
| Node version is unspecified | root `package.json` has no `engines`; DSH upstream root requires `^22.19.0 || >=24.0.0` | any Node appears acceptable | unsupported Node fails late | adopt and validate the DSH-compatible engine range |

```text
FRESH_MACHINE_BLOCKERS = 11 categories above
MACHINE_SPECIFIC_ASSUMPTIONS = sibling Harness checkout; operator ~/.dsh;
  opencode-go subscription; developer-relative paths; optional trusted
  authsvc/launchd deployment scripts
MANUAL_STEPS_REQUIRED_TODAY = install/link DSH packages; author agents.json;
  author Binding; create/copy provider and Feishu credentials; choose env;
  invoke internal runtime entry
BROKEN_FRESH_CLONE_STEPS = npm test; runtime boot; Agent spawn; first Feishu
  message
```

## 3. Frozen install and package dependency model

### 3.1 One install authority

The distribution uses npm workspaces and the published DSH release. There is
no remaining implementation-time choice:

```json
{
  "workspaces": ["packages/*", "bundle-*", "profile-*"]
}
```

`examples/**` and every historical V0 package are deliberately outside the
workspace set. The repository-root `package-lock.json` is the sole dependency
resolution authority and must be lockfile version 3. The canonical and only
accepted install command is `npm ci`. `npm install`, pnpm, yarn, a sibling DSH
checkout, and post-install symlink farms are not distribution install paths.

`packages/feishu-connector/package-lock.json` must be deleted in the eventual
implementation. No workspace may contain a nested lockfile. No manifest value
in the following tables may use `^`, `~`, `>=`, `*`, `workspace:*`, a git URL,
or a file/path reference. Registry tags such as `latest` and `next` are also
forbidden as runtime resolution rules.

### 3.2 Exact workspace set and direct dependency matrix

The exact workspace set is the following 25 rows: all 15 `packages/*`, all five
`bundle-*`, and all five `profile-*` manifests shown below—no more and no less.
Every listed item is an exact production `dependencies` entry owned by the
package that imports or names it. `—` means none. Dev-only dependencies are
`—` for every V1 workspace; canonical manifests also have no
`peerDependencies`. This prevents root-hoist and accidental-transitive
resolution from satisfying a direct import. Names in the two scoped columns
are suffixes of the column scope: for example `dsh` means
`@deepseek-ai/dsh`, and `agent-router` means `@agent-core/agent-router`.

Root (not itself a workspace):

| Package | Direct `@agent-core/*` | Direct `@deepseek-ai/*` | Other direct runtime | Dev-only |
|---|---|---|---|---|
| `dsh-agent-core` | — | `dsh: 0.1.0-rc.7` | — | — |

`packages/*` workspaces:

| Package | Direct `@agent-core/*` | Direct `@deepseek-ai/*` | Other direct runtime | Dev-only |
|---|---|---|---|---|
| `@agent-core/agent-definition` | — | `schemastery: 3.18.1` | — | — |
| `@agent-core/agent-memory` | `workspace-bootstrap: 0.0.0` | `dsh-tools: 0.1.0-rc.7`; `schemastery: 3.18.1` | — | — |
| `@agent-core/agent-provisioning` | — | — | — | — |
| `@agent-core/agent-router` | `agent-provisioning: 0.0.0` | `schemastery: 3.18.1` | — | — |
| `@agent-core/agent-switch` | — | `dsh-tools: 0.1.0-rc.7`; `schemastery: 3.18.1` | — | — |
| `@agent-core/broker` | — | `cordis: 4.0.1`; `dsh-tools: 0.1.0-rc.7`; `schemastery: 3.18.1` | — | — |
| `@agent-core/demo-server` | — | `dsh-llm: 0.1.0-rc.7`; `dsh-session: 0.1.0-rc.7`; `schemastery: 3.18.1` | — | — |
| `@agent-core/feishu-connector` | — | `schemastery: 3.18.1` | `@larksuiteoapi/node-sdk: 1.73.0` | — |
| `@agent-core/notification-ingress` | — | `schemastery: 3.18.1` | — | — |
| `@agent-core/owner-guard` | — | — | — | — |
| `@agent-core/product-api` | — | `schemastery: 3.18.1` | — | — |
| `@agent-core/production-runtime` | `agent-definition: 0.0.0`; `agent-provisioning: 0.0.0`; `agent-router: 0.0.0`; `broker: 0.1.0`; `feishu-connector: 0.0.0`; `notification-ingress: 0.0.0`; `product-api: 0.0.0`; `scheduler: 0.0.0`; `scheduler-router: 0.0.0`; `workspace-bootstrap: 0.0.0` | — | — | — |
| `@agent-core/scheduler` | — | — | `croner: 10.0.1` | — |
| `@agent-core/scheduler-router` | — | — | — | — |
| `@agent-core/workspace-bootstrap` | — | `schemastery: 3.18.1` | — | — |

`bundle-*` workspaces:

| Package | Direct `@agent-core/*` | Direct `@deepseek-ai/*` | Other direct runtime | Dev-only |
|---|---|---|---|---|
| `@agent-core/bundle-agent-switch` | `agent-switch: 0.0.0` | — | — | — |
| `@agent-core/bundle-broker` | `broker: 0.1.0` | — | — | — |
| `@agent-core/bundle-demo` | `owner-guard: 0.0.0`; `demo-server: 0.0.0` | — | — | — |
| `@agent-core/bundle-integration` | `workspace-bootstrap: 0.0.0`; `agent-definition: 0.0.0`; `feishu-connector: 0.0.0`; `agent-router: 0.0.0`; `broker: 0.1.0`; `product-api: 0.0.0`; `notification-ingress: 0.0.0` | — | — | — |
| `@agent-core/bundle-memory` | `agent-memory: 0.0.0` | — | — | — |

`profile-*` workspaces (the dependencies exactly match each
`dsh.profile.bundles` list):

| Package | Direct `@agent-core/*` | Direct `@deepseek-ai/*` | Other direct runtime | Dev-only |
|---|---|---|---|---|
| `dsh-profile-agent-core-demo` | `bundle-demo: 0.0.0` | `dsh-base: 0.1.0-rc.7` | — | — |
| `dsh-profile-agent-core-integration-agent` | `bundle-demo: 0.0.0`; `bundle-memory: 0.0.0`; `bundle-agent-switch: 0.0.0`; `bundle-broker: 0.0.0` | `dsh-base: 0.1.0-rc.7` | — | — |
| `dsh-profile-agent-core-integration` | `bundle-integration: 0.0.0` | `dsh-base: 0.1.0-rc.7` | — | — |
| `dsh-profile-agent-core-memory` | `bundle-demo: 0.0.0`; `bundle-memory: 0.0.0` | `dsh-base: 0.1.0-rc.7` | — | — |
| `dsh-profile-agent-core-production` | `bundle-demo: 0.0.0`; `bundle-memory: 0.0.0`; `bundle-agent-switch: 0.0.0`; `bundle-broker: 0.0.0` | `dsh-base: 0.1.0-rc.7` | — | — |

The DSH CLI resolves from the root-installed `@deepseek-ai/dsh` package/bin.
`DSH_HARNESS_ROOT` remains an explicit, validated developer-only override and
is absent from Quick Start and acceptance. Runtime code may not scan personal
directory conventions. Cross-workspace source imports may remain mechanically
unchanged in V1, but each imported workspace must still appear in the importing
package's manifest above.

```text
DSH_RELEASE_FAMILY = 0.1.0-rc.7 EXACT
DSH_DEPENDENCY_MODEL = OFFICIAL_NPM_RELEASE + NPM_WORKSPACES
CANONICAL_CLEAN_INSTALL = npm ci
ROOT_PACKAGE_LOCK = SOLE_INSTALL_AUTHORITY
NESTED_LOCKFILE_ALLOWED = NO
MANUAL_SYMLINK_REQUIRED_AFTER_V1 = NO
```

## 4. Frozen public model and configuration contract

### 4.1 Pre-Spec real-model proof

Before this revision was authored, a clean temporary npm project installed
`@deepseek-ai/dsh`, `dsh-llm`, `dsh-session`, and `dsh-tools`, each at exact
`0.1.0-rc.7`. The official `dsh --profile headless` CLI then made a real public
network request with this route:

```text
provider = huggingface
model = zai-org/GLM-4.7-Flash
credential reference = HF_TOKEN
endpoint authority = the installed pi-ai Hugging Face catalog
expected assistant text = AGENT_CORE_RC7_HF_NATIVE_PASS
exit code = 0
```

The durable DSH session recorded `request/context` with the same provider/model,
an `assistant/message` whose model source and response model were Hugging Face /
GLM-4.7-Flash, the exact expected text, and `turn/end.kind = completed`. This is
the sole model route authorized for the V1 public Quick Start. Failed probes of
private/region-blocked routes are not fallbacks.

### 4.2 Public provider prerequisite and exact files

The operator needs a normal Hugging Face account, remaining Inference Providers
credits (the provider documents a free tier), and a fine-grained access token
with the exact permission **Make calls to Inference Providers**. No DeepSeek
private account, opencode-go subscription, Agent Core auth-service, or private
gateway is required for basic chat.

Provider prerequisite authority: [Hugging Face Inference Providers](https://huggingface.co/docs/inference-providers/index).

Tracked examples and live files are exactly:

| Purpose | Tracked placeholder | Live canonical path |
|---|---|---|
| DSH settings | `config/examples/dsh-settings.yaml` | `<root>/config/dsh/settings.yaml` |
| provider credential | `config/examples/dsh-credentials.yaml` | `<root>/config/dsh/.credentials.yaml` |
| Feishu credential | `config/examples/feishu-credentials.json` | `<root>/config/feishu/credentials.json` |
| runtime env documentation | `config/examples/runtime.env` | operator shell/service environment; no live `.env` required |

`<root>` is the absolute `--root` passed to every distribution command. The
two credential files and every per-Agent credential copy are mode `0600`; their
parent directories are mode `0700`. Tracked examples contain placeholders only.

The settings file schema is frozen to:

```yaml
llm-pi-ai:
  providers:
    huggingface:
      apiKeyEnv: HF_TOKEN

agent-default-model:
  provider: huggingface
  model: zai-org/GLM-4.7-Flash
```

The credentials file is a YAML mapping with no wrapper/version field:

```yaml
HF_TOKEN: "<fine-grained-token-with-inference-providers-permission>"
```

The exact Feishu JSON schema is:

```json
{
  "appId": "<self-built-app-id>",
  "appSecret": "<self-built-app-secret>"
}
```

Bootstrap rejects missing/empty/additional keys and never prints values.

### 4.3 Source precedence, assembly, and drift

DSH credential precedence is frozen to the rc.7 credential seam:

```text
inherited process environment
> $DSH_HOME/.credentials.yaml
> invocation-cwd/.env
> $DSH_HOME/.env
```

The canonical Quick Start instructs the operator to unset
`HF_TOKEN` in the launching environment and does not create either
`.env`; therefore the effective source is the canonical credential file. If an
inherited value exists it wins by upstream contract, and bootstrap/status must
report only `source=env`, never the value. Missing or invalid credentials fail
loud; there is no provider or model fallback.

Runtime selection is exact and redundant by design:

```text
DSH_AGENT_PROVIDER=huggingface
DSH_AGENT_MODEL=zai-org/GLM-4.7-Flash
```

Those runtime values are authoritative and must exactly match
`agent-default-model` in the settings source. Any mismatch fails bootstrap and
spawn; no CLI override silently wins.

Required/derived input contract:

| Input | Rule |
|---|---|
| CLI `--root` | required on every Quick Start command; sole location selector |
| `PRODUCTION_RUNTIME_ROOT` | start adapter derives it from `--root`; a pre-existing different value is an error, not a lower-priority fallback |
| `DSH_AGENT_PROVIDER` | required exact value `huggingface`; no provider CLI flag |
| `DSH_AGENT_MODEL` | required exact value `zai-org/GLM-4.7-Flash`; no model CLI flag |
| `DSH_SETTINGS_SOURCE` | bootstrap/start derive `<root>/config/dsh/settings.yaml`; operator override is not supported in V1 |
| `DSH_CREDENTIALS_SOURCE` | bootstrap/provision derive `<root>/config/dsh/.credentials.yaml`; operator override is not supported in V1 |
| `FEISHU_CREDS_PATH` | start derives `<root>/config/feishu/credentials.json`; operator override is not supported in V1 |
| `HF_TOKEN` | canonical launching environment leaves it unset so the `0600` file wins; if inherited, upstream precedence applies and source-only status is mandatory |

The public CLI accepts no token, App Secret, provider, model, settings path, or
credential path. Consequently precedence is singular: `--root` selects the
canonical files; provider/model env must equal their settings values; and only
the rc.7 credential layers decide the value behind `HF_TOKEN`.

For Agent `agt_*`, `create-agent` assembles:

```text
<root>/workspaces/<agt_id>/AGENTS.md
<root>/homes/<agt_id>/settings.yaml
<root>/homes/<agt_id>/.credentials.yaml
<root>/homes/<agt_id>/profiles/agent-core-production/{package.json,cordis.patch.yml}
<root>/homes/<agt_id>/profiles/node_modules/@agent-core/*
```

The settings and credential files are copied from the live canonical paths on
first provisioning. A second run verifies byte identity and modes; it never
overwrites. Existing-but-different content is `CONFIG_DRIFT` and fails loud.
Profile/workspace ensure remains idempotent and never overwrites `AGENTS.md`.

Acceptance proves this assembly by spawning the production Agent with
`DSH_HOME=<root>/homes/<agt_id>` and its primary workspace, then requires the
child initialize request, DSH session `request/context`, model-authored reply,
and `turn/end.kind=completed` all to name/match the frozen provider/model. A
standalone root-home probe is supporting evidence, not acceptance.

```text
AGENT_CORE_AUTH_SERVICE_REQUIRED_FOR_BASIC_CHAT = NO
MODEL_PROVIDER_CREDENTIAL_REQUIRED = YES
AUTOMATIC_MODEL_FALLBACK = NOT_SUPPORTED
PRIVATE_OPENCODE_GO_REQUIRED = NO
```

## 5. Frozen command and owner-seam contracts

### 5.1 `bootstrap`

Canonical invocation:

```text
npm run bootstrap -- --root <absolute-root> --dry-run
npm run bootstrap -- --root <absolute-root>
```

Before mutation it validates Node `^22.19.0 || >=24.0.0`, current npm,
`npm ci`/lock consistency, installed DSH CLI, a non-demo writable root, the
three canonical live config files and modes, exact provider/model agreement,
Feishu schema, Agent Definition/Binding target paths, and local ports. Mutation
creates missing production directories only; the operator authors live config
from tracked placeholders before bootstrap. It never installs a placeholder as
a live secret, overwrites credentials/config, deletes state, starts a daemon,
mutates a Feishu tenant, or installs supervision. First and second successful runs must
produce the same durable content.

### 5.2 `create-agent`: `adoptAgents` is canonical

Canonical invocation:

```text
npm run create-agent -- --root <absolute-root> --name <display-name>
```

The adapter must call existing
`adoptAgents({ configFile: <root>/agents.json, agents: [{ name }] })`; it may
not call `createAgentInConfig`. Name matching is the existing case-insensitive
`name.toLowerCase()` rule. An existing name reuses exactly the same opaque ID
and existing display fields. The existing `defaultAgentId` is preserved; when
none exists, the first Agent in config order becomes default.

After both `created` and `reused` outcomes, the adapter always resolves the
returned Agent ID, calls the existing `workspaceBootstrap.ensure(agentId)` for
the primary workspace, and calls existing `provisionAgentHome` with profile
`agent-core-production`. Thus the second invocation is not an early return: it
re-validates/ensures workspace, home, config copies, and profile while retaining
the same Agent ID. Ambiguous/corrupt config fails loud.

```text
CREATE_AGENT_OWNER_SEAM = adoptAgents
CREATE_AGENT_NAME_REUSE = CASE_INSENSITIVE
SAME_NAME_SECOND_RUN = RETURN_SAME_AGENT_ID
EXISTING_DEFAULT_AGENT = PRESERVE
FIRST_AGENT_WHEN_NO_DEFAULT = BECOMES_DEFAULT
```

### 5.3 `bind-feishu`: offline minimal composition only

Canonical invocation:

```text
npm run bind-feishu -- --root <absolute-root> --agent <agt_id-or-name> --conversation <oc_id>
```

The adapter creates the existing minimal plugin context and mounts, in order,
only existing `workspaceBootstrap`, `agentDefinition`, and `agentRouter` over
the production layout. Feishu is deliberately absent, so Router does not open a
WebSocket or dispatch a message. It must not compose the full Production
Runtime (no Scheduler, HTTP port, Broker/Auth, or live connector).

The only legal algorithm is:

1. resolve the enabled target through `agentDefinition.resolveAgentRef`;
2. compute `ccId = router.channelConversationId('feishu', conversation)`;
3. read `existing = router.getBinding(ccId)`;
4. if absent, call exactly
   `router.switchAgent(ccId, target.id, { targetSessionId: 'main', workspace: null })`;
5. if the existing triple is exactly target ID / `main` / `null`, return it as
   a no-op without calling `switchAgent`;
6. otherwise fail loud with `BINDING_CONFLICT`, report both non-secret triples,
   and leave the existing Binding untouched.

There is no `--force`. The adapter may not import `BindingStore`, read/write
Binding JSON, create another mutation helper/service, add a Feishu branch to
Router, or start a process. It disposes its minimal context before exit.

```text
NO_EXISTING_BINDING = CREATE
SAME_AGENT_MAIN_NULL_BINDING = NO_OP
CONFLICTING_EXISTING_BINDING = FAIL_LOUD
IMPLICIT_REBIND = FORBIDDEN
FORCE_REBIND = NOT_SUPPORTED_IN_V1
```

### 5.4 Canonical runtime lifecycle

```text
FOREGROUND_START_COMMAND = npm run start:production -- --root <absolute-dir>
HEALTH = GET http://127.0.0.1:<notification-ingress-port>/health
LOGS = stdout/stderr + <root>/control/runtime-evidence.jsonl
GRACEFUL_STOP = SIGINT or SIGTERM

LAUNCHD_REQUIRED = NO
LAUNCHD_EXAMPLE = KEEP_AS_OPTIONAL_ADAPTER
SYSTEMD_REQUIRED = NO
SYSTEMD_EXAMPLE = NO; OUT_OF_SCOPE_FOR_V1
```

Foreground start is the product contract on macOS and Linux. Supervision may
only wrap that command.

## 6. Frozen Feishu first-use closure and Quick Start

### 6.1 Exact Feishu tenant prerequisites

The operator performs these console steps for exactly this minimal text-chat
surface:

1. Sign in to Feishu Open Platform, choose **Create enterprise self-built
   application**, set an operator-chosen name/icon/description, and create it.
2. On **Credentials & Basic Info**, copy App ID and App Secret into the exact
   §4.2 JSON file, then set the file to mode `0600`; never paste either value
   into the repository, settings YAML, command line, or logs.
3. Under **Add Features**, add/enable the **Bot** capability.
4. Under **Permissions & Scopes**, add the application scopes
   `im:message.p2p_msg:readonly`, `im:message.group_at_msg:readonly`, and
   `im:message:send_as_bot`. These three identifiers are exhaustive for V1
   text chat.
5. Under **Events & Callbacks -> Event Configuration**, choose **Receive events
   through persistent connection**, save it, and subscribe to the event
   `im.message.receive_v1`.
6. Under **Version Management & Release**, create a version, submit/publish it,
   complete tenant-admin approval when required, and verify the app is enabled
   and its availability range includes the test user.
7. For a group test, add the published bot to the target group and address it
   with `@bot`. A direct-message test needs no group. Non-`@` group traffic is
   outside V1 and `im:message.group_msg` is neither requested nor required.

The runtime uses the existing official SDK WebSocket client. No public callback
URL, webhook, discovery endpoint, or discovery service is introduced.

Feishu authority: [receive-message event and scopes](https://open.feishu.cn/document/server-docs/im-v1/message/events/receive),
[persistent-connection event configuration](https://open.feishu.cn/document/ukTMukTMukTM/uYDNxYjL2QTM24iN0EjN/event-subscription-configure-/request-url-configuration-case),
and [send-message bot prerequisite](https://open.feishu.cn/document/server-docs/im-v1/message/create).

### 6.2 Exact first-use sequence under `PREBOUND_ONLY`

The public Quick Start is the following complete sequence:

1. Clone the repository at the documented release and run `npm ci`.
2. Create the Hugging Face account/token prerequisite, copy the exact settings
   and credential schemas to the canonical live paths, and `chmod 600` secrets.
3. Create/publish/enable the Feishu app using §6.1 and write its canonical JSON.
4. Run bootstrap dry-run, bootstrap, and bootstrap again.
5. Run `create-agent` twice with the same name and record the identical `agt_*`.
6. Start the foreground runtime with no Binding for the chosen conversation;
   require `GET /health` to return HTTP 200 with
   `{"ok":true,"service":"agent-core-notification-ingress","deliverReady":true}`
   and require the exact log line `feishu-transport: connected`.
7. In Feishu send a direct message, or add the bot to a group and send an
   `@bot` text message.
8. The existing PREBOUND_ONLY gate derives the ID through
   `router.channelConversationId('feishu', chat_id)`, rejects before model
   dispatch/Binding creation, and emits one structured log record containing
   the **full**, untruncated `channelConversationId` (`feishu:oc_*`):

   ```json
   {"event":"feishu_binding_required","reason":"unbound","channelConversationId":"feishu:oc_<full-id>","bindingCreated":false,"modelDispatched":false}
   ```

   The connector sends exactly the existing fixed rejection receipt:
   `[agent-core] 该会话未完成绑定（not bound）：消息未送达任何 Agent，也未创建任何绑定。请联系管理员完成会话与 Agent 的预绑定。`
   Message content, app secret, token, and sender credential are not logged.
9. Stop the foreground runtime completely before mutation.
10. Pass the logged external `oc_*` portion to `bind-feishu`; the offline
    adapter creates exactly target Agent / `main` / `null`.
11. Run `bind-feishu` a second time and prove exact no-op behavior.
12. Restart the same foreground runtime/root and require the same HTTP health
    response plus exact `feishu-transport: connected` log again.
13. Send a second addressed text message in the same Feishu conversation.
14. Prove the persisted Binding is still the selected target Agent / native DSH
    Session `main` / `workspace: null`, whose effective path is that Agent's
    primary workspace; prove the child uses that workspace and its own home.
15. Prove a model-authored response is sent back to that conversation and an
    unrelated unbound conversation still fails closed without a Binding.

The discovery log is an observability change in the composition/gate only. It
does not mutate Router/Binding/Feishu semantics and is not an API.

Architecture, decisions, reports, launchd/trusted-control-plane hardening, and
historical V0 paths stay behind `Learn more`; none is a Quick Start prerequisite.

## 7. Portability and secret audit

### 7.1 Classification of baseline hits

| Classification | Baseline paths | Disposition |
|---|---|---|
| `LEGITIMATE_TEST_FIXTURE` | `packages/scheduler/fixtures/openclaw-jobs-enabled.json`; test temp paths/ids | keep as historical/import fixture; never use as bootstrap default |
| `DOCUMENTATION_EXAMPLE` | specs, investigations, reports that quote `~/.agent-core`, `~/.dsh`, old deployments | keep or archive per docs authority; label historical where appropriate |
| `DEVELOPMENT_ONLY` | verification scripts, `examples/v0-vertical-slice`, explicit `DSH_HARNESS_ROOT` override | keep out of Quick Start and production defaults |
| `DISTRIBUTION_BLOCKER` | root dependency closure; `agent-provisioning` checkout discovery and HOME copies; legacy Feishu import helper; root-only/authsvc trusted deployment defaults when presented as ordinary install | fix only under this accepted Spec |
| `SECRET_RISK` | tracked code/docs naming credential paths or fields | values scan required; paths/field names alone are not secrets |

Personal-path hits in current runtime/acceptance scripts must either become
explicit inputs, remain clearly historical/development-only, or be excluded from
the normal distribution journey. Historical evidence is not rewritten merely to
make search results zero.

### 7.2 Baseline secret result

A tracked-file scan found no high-confidence API-token/private-key shapes, no
assigned JSON secret values, and no tracked `.pem`, `.key`, `.p12`, `.pfx`,
`.env`, credential, or secret payload file. Files whose names contain
`credential` are implementation/docs, not credential material.

```text
REAL_SECRET_COMMITTED = NO (baseline scan; must be re-run at implementation HEAD)
SECRET_VALUE_OUTPUT = FORBIDDEN
REAL_SECRET_FOUND_LATER = BLOCK + ROTATE/INCIDENT PROCESS OUTSIDE THIS SPEC
```

## 8. Implementation scope

Allowed changes after this Spec becomes accepted:

- root and workspace `package.json` files exactly covered by §3, root workspaces,
  engine declaration, root lockfile, and removal of the nested Feishu lockfile;
- installation/bootstrap glue under `scripts/`;
- the four exact safe config examples in §4.2;
- thin deployment adapters implementing only §5 over existing Agent Definition,
  Workspace Bootstrap, Agent Provisioning, and Router seams;
- DSH CLI resolution in agent-provisioning/process wiring;
- explicit DSH settings/credential source assembly and provider/model mismatch
  validation in provisioning/process wiring;
- the structured full ChannelConversation discovery log in the existing V2
  ingress composition/gate;
- focused tests for the distribution contracts;
- root README and one canonical Quick Start/config/deployment guide;
- the existing launchd example only, as an optional wrapper over the foreground
  command; a systemd example is out of V1 scope.

Forbidden without a new/amended Spec:

- changes to Agent/Session/Workspace/Binding/Memory/Scheduler/Broker semantics;
- Router entry-specific policy or a second Binding writer;
- Feishu first-contact auto-create/default fallback;
- Workspace/Session registries or databases;
- Kernel/DSH source changes or forks;
- automatic model fallback;
- a discovery API/service, direct BindingStore/JSON access, `--force`, or a
  second Agent/Binding mutation owner;
- Dashboard, SaaS, Kubernetes, Auth provisioning closure, fleet migration, or
  OpenClaw compatibility.

## 9. Acceptance gates

Implementation must run from a new clone/check-out and a new temporary HOME and
production root. It may explicitly supply only Node/npm, the committed install
closure, test provider credentials, and test Feishu credentials.

Required gates:

```text
fresh clone / exact remote SHA checkout
empty HOME
empty production root
nested package-lock files absent
manifest/workspace/dependency matrix exactly equals §3 (no ranges)
every non-node direct import resolves from its declaring workspace manifest
root package-lock is consistent with every workspace manifest
npm ci
npm test
node --check for every changed JS/MJS file
lint/typecheck when repository scripts exist

bootstrap dry-run
bootstrap first run
bootstrap second run (byte-identical durable state; no destructive delta)
unsupported Node -> fail loud
lockfile/manifest drift -> npm ci fails
missing DSH package -> fail loud
DSH_HARNESS_ROOT absent -> installed CLI selected
invalid provider config -> fail loud
missing provider credential -> fail loud
provider/model settings-env mismatch -> fail loud
inherited credential source -> source=env reported without value
missing/invalid Feishu credential -> fail loud
fresh production root
first Agent creation through adoptAgents
case-varied same-name second run -> same ID + default preserved
second create-agent run still ensures workspace/home/profile
first Feishu Binding through offline Router owner composition
exact second bind -> no-op
conflicting bind -> BINDING_CONFLICT + zero mutation
bind adapter opens no port/WebSocket/process and imports no BindingStore
unknown Feishu conversation -> PREBOUND_ONLY fail closed
unknown conversation -> full structured feishu:oc_* binding_required log
unknown conversation -> no Binding and no model dispatch
foreground runtime boot + health + SIGTERM shutdown
per-Agent production DSH profile boot from <root>/homes/<agt_id>
per-Agent config copies/modes/byte identity + CONFIG_DRIFT rejection
real DSH initialize/request context = huggingface/zai-org/GLM-4.7-Flash
real DSH model-authored reply + completed turn
AGENT_CORE_AUTH_SERVICE_REQUIRED_FOR_BASIC_CHAT = NO
missing provider credential still fails (no fallback)
```

The real Feishu gate is required for deployment readiness and follows §6.2:

```text
published/enabled self-built app + exact three scopes
official SDK persistent WebSocket connected
first addressed message -> discover full ccId + fail closed
stop runtime -> offline bind -> restart
second message -> persisted target/main/null -> primary workspace
second message -> real model -> Feishu reply
separate unbound conversation remains fail closed
```

If a test Feishu tenant/credential is not authorized for the isolated run, the
minimum honest result is:

```text
REAL_DSH_MODEL_SPAWN = PASS
FEISHU_CONFIG_VALIDATION = PASS
REAL_FEISHU_TEST = BLOCKED_BY_EXTERNAL_CREDENTIAL
```

The timer starts immediately before clone and stops at the first successful
model reply. Waiting for app approval or provider purchase is excluded; install,
bootstrap, config, Agent creation, Binding, runtime boot, and model response are
included.

```text
FIRST_AGENT_TIME_TO_RUNNING_TARGET = <= 30 min
OTHER_TEAM_SOURCE_READY = YES only after all non-external gates pass
OTHER_TEAM_DEPLOYMENT_READY = YES only after real model + real Feishu pass
```

## 10. Revision V2 blocker closure map

The prior independent review's decisions are no longer open questions:

| Original blocker | Frozen resolution in this revision |
|---|---|
| workspace/install closure and non-exact DSH family | §3.1 sole root lock + canonical `npm ci`; §3.2 exhaustive exact manifest matrix and DSH `0.1.0-rc.7` pins |
| nested Feishu lockfile / multiple install authorities | §3.1 requires its deletion and forbids every nested lockfile |
| create-agent could mint duplicate name IDs or skip second-run ensure | §5.2 mandates `adoptAgents`, case-insensitive reuse, stable ID/default rules, and ensure/provision after both outcomes |
| bind-feishu owner seam and idempotency were undecided | §5.3 freezes the three-component offline composition, `channelConversationId`, `getBinding`, conditional exact `switchAgent`, no-op/conflict/no-force rules, and forbids BindingStore/JSON/new helper/full runtime |
| no public provider/model/credential proof | §4.1 records the real formal rc.7 model proof; §4.2 freezes Hugging Face account/token and exact route/files/schema |
| credential precedence and per-Agent home assembly were incomplete | §4.3 freezes rc.7 precedence, env/settings agreement, copy/no-overwrite/drift behavior, exact home tree, and per-Agent proof |
| auth-service/basic-chat and fallback posture were ambiguous | §4.3 freezes auth-service `NO`, external provider credential `YES`, and automatic fallback `NO` |
| Feishu console scopes and first-use discovery were incomplete | §6.1 freezes the exact three scope identifiers, persistent connection, publish/enable/availability/bot steps; §6.2 freezes discover-stop-bind-restart proof with a full structured ccId and no discovery service |
| acceptance permitted `npm install` and omitted negative/idempotency gates | §9 makes `npm ci` the only install and enumerates manifest, bootstrap, create, bind, credential, per-Agent model, PREBOUND_ONLY, lifecycle, and real Feishu gates |

## 11. Gate result

```text
GOVERNING_SPEC = AGENT_CORE_DISTRIBUTION_BOOTSTRAP_V1
SPEC_STATUS = proposed
TECHNICAL_FEASIBILITY_WITH_CURRENT_DSH = YES
DSH_DISTRIBUTION_DIRECTION = OPTION_A_EXACT_NPM_RC7 + AGENT_CORE_NPM_WORKSPACES
SPEC_HANDOFF_READY = YES
REQUIRED_CHANGE_CLASSIFICATION = NON_TRIVIAL_PRODUCT_OR_ARCHITECTURE_CHANGE
IMPLEMENTATION_AUTHORIZED = NO
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES
KERNEL_CHANGE = NONE
ROUTER_PRODUCT_SPECIAL_CASE = NONE
SPEC_REVISION_V2_FROZEN_CHOICES_COMPLETE = YES
```
