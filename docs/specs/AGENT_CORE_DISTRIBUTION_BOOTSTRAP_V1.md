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
-> npm install
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
| Runtime cannot create its required definition | `packages/production-runtime/src/compose.js:153-160` | fails if `agents.json` is absent or lacks a default | first user must hand-author the config | deployment-side `create-agent` adapter reuses `createAgentInConfig` |
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

## 3. DSH dependency model

### 3.1 Evaluated options

| Option | Decision | Reason |
|---|---|---|
| A. Published npm packages | **SELECT** | npm registry contains `@deepseek-ai/dsh@0.1.0-rc.7` plus matching `dsh-tools`, `dsh-llm`, and `dsh-session` tarballs |
| B. Agent Core npm workspaces | **SELECT for this repo's private packages** | makes `@agent-core/*` resolution deterministic without manual root symlinks |
| C. git submodule | REJECT | duplicates source lifecycle and still requires build/install orchestration |
| D. required `DSH_HARNESS_ROOT` checkout | REJECT for distribution; KEEP as explicit dev override | preserves developer testing without making it an end-user prerequisite |
| E. DSH official install seam | **SELECT** | published `@deepseek-ai/dsh` owns the CLI `bin.dsh`; upstream has pack/verify/publish gates |

### 3.2 Frozen dependency contract

Implementation must pin one mutually compatible DSH release family and commit a
root lockfile. At implementation start the candidate family is `0.1.0-rc.7`;
the exact version must be re-verified against registry metadata and a real
profile boot before acceptance.

The runtime resolves the CLI in this order only:

1. explicit `DSH_HARNESS_ROOT` development override, validated as a built
   Harness checkout;
2. installed `@deepseek-ai/dsh` package/bin in the repository dependency
   closure;
3. fail loud with both supported remedies.

It must never scan personal directory conventions.

```text
DSH_DEPENDENCY_MODEL = OFFICIAL_NPM_RELEASE + AGENT_CORE_NPM_WORKSPACES
DSH_DEPENDENCY_SELF_CONTAINED = YES (after npm install)
DSH_HARNESS_ROOT_REQUIRED = NO
MANUAL_SYMLINK_REQUIRED_AFTER_V1 = NO
DSH_SOURCE_COPY = NO
```

## 4. Configuration and secrets

### 4.1 Canonical deployment inputs

Implementation will add repository-style examples (exact paths may be adjusted
without changing semantics):

```text
config/examples/runtime.env.example
config/examples/dsh-settings.example.yaml
config/examples/provider-credentials.example.yaml
config/examples/feishu-creds.example.json
config/examples/agents.example.json
config/examples/bindings.example.json        # shape documentation only
config/examples/primary-workspaces.example.json
```

`bindings.example.json` must not invite direct writes: the Quick Start uses
`bind-feishu`, which delegates to Router ownership. `primary-workspaces` stays
optional and preserves the existing import contract.

Every example must use placeholders, relative explanatory paths, and no real
secret or `/Users/yanfenma`. Secret files must be outside git, recommended mode
`0600`, and never overwritten by bootstrap.

### 4.2 Provider/model contract

- A provider subscription/token is an `EXTERNAL_PREREQUISITE`.
- Bootstrap requires an explicit provider, model, settings file, and credential
  source; it validates existence and shape without printing secret values.
- `DSH_AGENT_PROVIDER` / `DSH_AGENT_MODEL` remain the existing runtime selection
  seam.
- Quick Start selects one publicly obtainable DSH-supported provider only after
  an implementation-time real-model proof. It may not use the operator's
  private opencode-go subscription.
- `AUTOMATIC_MODEL_FALLBACK = NOT_SUPPORTED`.

### 4.3 Feishu contract

- User supplies their own self-built Feishu App `appId`/`appSecret` in a `0600`
  JSON/TOML credential file accepted by the existing connector.
- App must enable bot/message capabilities, subscribe to
  `im.message.receive_v1`, grant the required message receive/send permissions,
  and be present in the target conversation.
- Runtime uses the existing official SDK WebSocket long connection.
- Connection success is established by explicit connector/runtime status logs;
  bootstrap validates config but does not contact or mutate a tenant by
  default.
- Conversation id is the inbound `chat_id` (`oc_*`) surfaced by an event or
  operator inspection; no production app/secret is bundled.
- `bind-feishu` creates `feishu:<conversationId> -> agent + canonical main +
  workspace null` through Router's generic Binding seam.
- An unbound conversation remains fail-closed and receives the existing fixed
  rejection path.

## 5. Command contracts

Exact flag spelling may be refined in review, but the following behaviors are
frozen.

### 5.1 `npm run bootstrap`

Checks, in dry-run-first order:

1. supported Node/npm version;
2. installed dependency/lockfile consistency;
3. installed DSH CLI and required direct DSH packages;
4. writable, non-demo production root;
5. explicit provider/model settings and credentials;
6. Feishu credentials (required unless an explicit `--without-feishu` validation
   mode is selected; Quick Start requires them);
7. Agent Definition and Binding paths;
8. configured ports are valid and available without starting a daemon.

Mutation mode creates only missing directories and operator-selected config
copies. It never deletes files, resets a Workspace, rewrites a credential,
changes system configuration, installs supervision, or starts a background
daemon.

```text
BOOTSTRAP_IDEMPOTENT = YES
BOOTSTRAP_DRY_RUN = REQUIRED
BOOTSTRAP_FAIL_LOUD = REQUIRED
BOOTSTRAP_SECRET_OUTPUT = FORBIDDEN
```

### 5.2 `npm run create-agent -- --name <name>`

This is a deployment/bootstrap adapter, not a runtime auto-creation policy. It:

1. calls the existing `createAgentInConfig` writer against the production
   `agents.json` authority;
2. returns the minted opaque `agt_*` id and preserves/defaults per existing
   Agent Definition semantics;
3. calls the existing workspace-bootstrap ensure seam to create the primary
   Workspace and seed `AGENTS.md` without overwrite;
4. provisions the selected production DSH home/profile through the existing
   idempotent provisioner;
5. is safe to rerun only with an explicit idempotency rule (recommended:
   `--name` reuse through existing `adoptAgents`, or fail loud on ambiguity).

It does not add Agent fields, credentials, Workspace registries, runtime Agent
creation, or Feishu behavior.

### 5.3 `npm run bind-feishu -- --agent <ref> --conversation <oc_id>`

The adapter composes or invokes the existing generic Router service and calls
its `switchAgent` first-contact seam. It does not write Binding JSON directly.
It validates the target Agent exists/enabled, persists canonical `main`, and
uses `workspace = null` so the Agent primary Workspace remains authoritative.

### 5.4 Canonical runtime lifecycle

```text
FOREGROUND_START_COMMAND = npm run start:production -- --root <absolute-dir>
HEALTH = GET http://127.0.0.1:<notification-ingress-port>/health
LOGS = stdout/stderr + <root>/control/runtime-evidence.jsonl
GRACEFUL_STOP = SIGINT or SIGTERM

LAUNCHD_REQUIRED = NO
LAUNCHD_EXAMPLE = KEEP_AS_OPTIONAL_ADAPTER
SYSTEMD_REQUIRED = NO
SYSTEMD_EXAMPLE = OPTIONAL; NOT_REQUIRED_FOR_V1_ACCEPTANCE
```

Foreground start is the product contract on macOS and Linux. Supervision may
only wrap that command.

## 6. Quick Start information architecture

The first-user path is exactly nine steps:

1. clone;
2. install/bootstrap;
3. configure provider;
4. configure Feishu;
5. create Agent;
6. bind conversation;
7. start foreground runtime;
8. send first Feishu message;
9. verify real reply and fail-closed behavior for an unbound conversation.

Architecture, decisions, reports, launchd/trusted-control-plane hardening, and
historical V0 paths move behind `Learn more`; none is a Quick Start prerequisite.

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

- root `package.json`, workspaces, engine declaration, lockfile;
- installation/bootstrap glue under `scripts/`;
- safe config examples;
- thin deployment adapters over existing Agent Definition, Workspace Bootstrap,
  Agent Provisioning, and Router seams;
- DSH CLI resolution in agent-provisioning/process wiring;
- focused tests for the distribution contracts;
- root README and one canonical Quick Start/config/deployment guide;
- optional supervision examples that wrap the foreground command.

Forbidden without a new/amended Spec:

- changes to Agent/Session/Workspace/Binding/Memory/Scheduler/Broker semantics;
- Router entry-specific policy or a second Binding writer;
- Feishu first-contact auto-create/default fallback;
- Workspace/Session registries or databases;
- Kernel/DSH source changes or forks;
- automatic model fallback;
- Dashboard, SaaS, Kubernetes, Auth provisioning closure, fleet migration, or
  OpenClaw compatibility.

## 9. Acceptance gates

Implementation must run from a new clone/check-out and a new temporary HOME and
production root. It may explicitly supply only Node/npm, the committed install
closure, test provider credentials, and test Feishu credentials.

Required gates:

```text
fresh clone / exact remote SHA checkout
npm install or npm ci
npm test
node --check for every changed JS/MJS file
lint/typecheck when repository scripts exist

bootstrap dry-run
bootstrap first run
bootstrap second run (no destructive delta)
missing DSH package -> fail loud
invalid provider config -> fail loud
missing provider credential -> fail loud
missing/invalid Feishu credential -> fail loud
fresh production root
first Agent creation + second-run idempotency
first Feishu Binding through Router owner seam
unknown Feishu conversation -> PREBOUND_ONLY fail closed
foreground runtime boot + health + SIGTERM shutdown
real DSH profile boot
real DSH model spawn and reply
```

Best-effort external gate:

```text
test Feishu message -> Agent -> real model -> Feishu reply
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

## 10. Review questions

Independent review must resolve these before changing status to accepted:

1. Confirm the exact DSH release family and whether direct packages should be
   pinned individually in addition to `@deepseek-ai/dsh`.
2. Confirm npm workspaces versus a narrower local-package link manifest; no
   manual symlink is acceptable either way.
3. Confirm `create-agent` idempotency by name uses existing `adoptAgents` rather
   than inventing another identity rule.
4. Confirm the deployment adapter may compose Router solely to call
   `switchAgent`, or require a narrower existing-owner helper extracted without
   changing Binding semantics.
5. Select the Quick Start provider using a real credential available to the
   independent acceptance environment; do not freeze opencode-go by default.
6. Decide whether a systemd example is useful in V1; foreground Linux support is
   mandatory regardless.

## 11. Gate result

```text
GOVERNING_SPEC = AGENT_CORE_DISTRIBUTION_BOOTSTRAP_V1
SPEC_STATUS = proposed
REQUIRED_CHANGE_CLASSIFICATION = NON_TRIVIAL_PRODUCT_OR_ARCHITECTURE_CHANGE
IMPLEMENTATION_AUTHORIZED = NO
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES
KERNEL_CHANGE = NONE
ROUTER_PRODUCT_SPECIAL_CASE = NONE
```
