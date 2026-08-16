# Investigation — TEST_AGENT_FEISHU_PRODUCT_SEMANTICS_INVESTIGATION_V1

- **Status**: investigation only (PASS — evidence sufficient for the decision-stack asked)
- **Date**: 2026-08-16
- **Base**: `main` @ `d45d4e5a94a7009dfcb2f96421d41382fc0143cf`
- **Type**: product-semantics + credential audit artifact (evidence authority, **NOT** implementation authority)
- **Scope**: Issue A (Forum credential), Issue C (Feishu Binding → Workspace), Issue B (group mention) — **investigation only**, no code/config/model changes, no merge.

---

## 0. Final report (as requested)

```
TEST_AGENT_FEISHU_PRODUCT_SEMANTICS_INVESTIGATION_V1 = PASS

BASE_MAIN = d45d4e5a94a7009dfcb2f96421d41382fc0143cf

# Forum
FORUM_CREDENTIAL_FAILURE_LAYER = BROKER_GATEWAY_CREDENTIAL_RESOLUTION
AUTH_PRINCIPAL_EXISTS = NO_VIA_AGENT_CORE_ID (a principal exists for OpenClaw stock-agent, but NOT for the Agent Core runtime's agt_* Test Agent id)
CLIENT_CREDENTIAL_EXISTS = NO_VIA_AGENT_CORE_TRUSTED_STORE (OpenClaw MachineClients exist; nothing is bound to the Agent Core Test Agent id in AGENT_CORE_CREDENTIALS_FILE)
ROUTER_CREDENTIAL_INJECTION = GATEWAY_MODE_NO_PER_AGENT_ENTRY (broker runs in gateway mode in the 505 parent; loadCredentialFor(credentialsFile, agentId) returns undefined for the Test Agent)
FORUM_GRANTS = (forum.read / forum.write declared in manifests; no Agent Core Test Agent grant provisioned/bound)

# Workspace product semantics
CURRENT_BINDING_MODEL = {channelConversationId, activeAgentId, activeSessionId, updatedAt} — NO workspace field
CURRENT_WORKSPACE_RESOLUTION_MODEL = workspaceBootstrap.resolveWorkspace(agentId) — workspace = f(agentId) only; one DSH process per agent with a single process-level workspace/home

OPENCLAW_REFERENCE_BEHAVIOR = workspace stored per peer(group) — workspace-oc_<chatId>, carried as agent.workspace; distinct chat => distinct workspace even when the persona/role string is shared

DSH_WORKSPACE_SCOPE = SESSION (configurable per session via meta.cwd at agents.create)
ONE_AGENT_ONE_PROCESS_COMPATIBLE_WITH_MULTI_WORKSPACE = WITH_CONSTRAINTS (DSH supports it natively; Agent Core wires only a single process-level cwd today, so it is NOT exercised)

PRIVATE_AGENT_ID = <same Test Agent agt_*> (see §4; mechanism identical to group, distinct chatId)
PRIVATE_SESSION_ID = main (Binding.activeSessionId)
PRIVATE_WORKSPACE = ~/.agent-core/workspaces/<agentId> (agent-scoped, same as group)

GROUP_AGENT_ID = <Test Agent agt_*>
GROUP_SESSION_ID = main
GROUP_WORKSPACE = ~/.agent-core/workspaces/<agentId>

SAME_AGENT = YES
SAME_SESSION = YES
SAME_WORKSPACE = YES
EXPECTED_SAME_WORKSPACE = NO

MULTI_WORKSPACE_FAILURE_LAYER = BINDING_SCHEMA + PROCESS_MODEL (A: Binding schema has no workspace; E: one-ag-one-process fixes a single process-level workspace; F: no per-session workspace seam fed from Binding)

ROUTER_BUG = NOT_PROVEN (the router faithfully implements the frozen model — workspace=f(agentId); there is no workspace seam to lose)
BINDING_MODEL_GAP = YES
WORKSPACE_BOOTSTRAP_GAP = NO (bootstrap correctly derives workspace from agentId, as designed)
PROCESS_MODEL_CONFLICT = YES (with the frozen one-agent-one-process wiring, not with DSH itself)

# Feishu UX
GROUP_REQUIRE_MENTION = YES
GROUP_REQUIRE_MENTION_OWNER = LARK_TRANSPORT_INVESTIGATION

# Decision
FORUM_CREDENTIAL_BLOCKER = YES (STOCK_AGENT_CANARY F5 G2-active)
MULTI_WORKSPACE_BLOCKER = YES (frozen product-plane conflict with the stated requirement)

STOCK_AGENT_CANARY_READY = NO

NEED_GOVERNING_SPEC = YES

CODE_CHANGE = NONE
ROUTER_CHANGE = NONE
RUNTIME_CHANGE = NONE
KERNEL_CHANGE = NONE
```

**Verdict**: `PASS` — enough evidence recovered from main source, the live production runtime env, the OpenClaw migration archive, and the DSH harness `packages/workspace`, `packages/fs/tool-fs/session-cwd.ts`, and `packages/core/agent-loop` to fully answer the three issue classification buckets and the core architectural question. **No implementation authority created.**

---

## 1. Test Agent identification / real production runtime

The real chain was already PASS on the basic path (`FEISHU_TEST_BOT_REAL_SLICE_V1`, 2026-08-15; group `oc_92332c45c1cac2ef89857abfee8ed762`「大侠 - 小虾米」).

The live Production Runtime is running today under the deployment:

```
root         76424  sudo -n -u authsvc env HOME=/Users/authsvc DSH_HARNESS_ROOT=/usr/local/libexec/agent-core/harness \
                     FEISHU_CREDS_PATH=/Users/authsvc/.dsh/feishu-creds.json \
                     DSH_AGENT_CHILD_UID=502 DSH_AGENT_CHILD_GID=20 DSH_AGENT_SPAWN_HELPER=/usr/local/libexec/dsh-agent-spawn-helper \
                     DSH_AGENT_PROVIDER=oc-go DSH_AGENT_MODEL=deepseek-v4-flash \
                     PRODUCT_API_PORT=17987 NOTIFICATION_INGRESS_PORT=17990 \
                     BROKER_AUTH_ORIGIN=http://127.0.0.1:4001 \
                     AGENT_CORE_CREDENTIALS_FILE=/usr/local/libexec/agent-core/config/agent-credentials.json \
                     ... production-runtime.mjs --root /Users/authsvc/.agent-core
```

Production persistent layout (production-runtime `src/paths.js`): root `/Users/authsvc/.agent-core`; per-agent **`workspaces/<agentId>/`** and **`homes/<agentId>/`**; `agents.json`, `bindings/bindings.json`, `scheduler/…`, `control/…`.

Live per-agent trees observed (today, most recent last): `agt_27df…`, `agt_305c…`, `agt_b7d8…`, `agt_edc3…`, `agt_fb78…`. Memory confirms the exercised test-agent surface is the **acceptance / PIV1** and **forum_my_notifications** protocols (PIV1_OK/RECOVER + "check unread notifications via forum_my_notifications") — i.e. Forum was exercised against a real `/v1` runtime and returned `credential_unavailable`.

> Certainty note: the production `agents.json`, `bindings.json`, the trusted `agent-credentials.json` and `logs/` / `control/runtime-evidence.jsonl` are authsvc-private (`0700` / `drwx--x--x`), so their *exact live row content* is not observable by this session. All mechanism-level and configuration-level conclusions below are source-derived and high-confidence; only the exact per-row values at live-time are marked as inferred.

---

## 2. Issue A — Forum credential_unavailable

### 2.1 The exact path (source-verified, all in Agent Core packages)

```
DSH per-agent process
  -> parent-RPC 'agent-core/broker'          (agent-router/src/process.js handleRpcRequest)
  -> Router dispatches with ACTUAL proc.agentId  (agent-router/src/index.js onRpcRequest BROKER_RPC_METHOD;
                                                 self-reported identity fields ignored)
  -> brokerGateway.execute({capabilityId,operation,args}, {agentId})   (broker/src/gateway.js)
  -> loadCredentialFor(credentialsFile, agentId)                        (broker/src/credential-store.js)
  -> credential === undefined  =>  fail closed credential_unavailable   (gateway.js lines 156-159)
```

The `credential_unavailable` for the production/trusted path is raised **only** by the broker **gateway** in the Router parent:

```js
// broker/src/gateway.js
credential = loadCredentialFor(credentialsFile, agentId)      // undefined here
if (credential === undefined) {
  return { ok:false, error:{ code:'credential_unavailable', detail:`no MachineClient credential bound to agent ${agentId}` } }
}
```

`loadCredentialFor` (broker/src/credential-store.js): `storeFile === undefined || '' → undefined`; otherwise loads `AGENT_CORE_CREDENTIALS_FILE` and returns `store[agentId]` (absent → `undefined`).

### 2.2 Distinguishing the "collapse it into one problem" trap

All the following are **different** layers and the evidence cleanly separates them:

| Question | Answer |
|---|---|
| credential 不存在 (agent no credential at all) | **For the Agent Core Test Agent id: YES** — nothing is bound to its `agt_*` id in the trusted store today. A credential DOES exist under OpenClaw ids (below), but under a different identity key. |
| credential 没 provision (never written to store) | **Unproven-to-bound** — `agent-credentials.json` (authsvc-private) may exist, but no Agent Core agent is shown bound; readiness report F5 G2 classed this as the expected untested surface. |
| Router 没注入 (Router didn't pass credential) | **Not the failure layer** — production runs the router in gateway mode; the Router correctly forwards `{agentId}` from the trusted proc relationship. No `injected`-style seam is in play. |
| Broker 没读取 (Broker didn't read store) | **It reads** — `loadCredentialFor` runs on every call; it returns `undefined` for the Test Agent id. |
| auth-service 拒绝 (token mint denied) | **Not reached** — mint (`requestAccessToken` / `/oauth/token`) would only run after a credential was found; here the credential is undefined so the transport fails closed *before* any token request. |
| grant/scope 不够 (scope denied) | **Not reached for this path** — forum.read/write are declared in manifests and a scope exists on the OpenClaw machine client (`{forum.read, forum.write}`), but the Agent Core Test Agent has no bound client to even attempt the grant exchange. |

### 2.3 Answers to the A-block

```
TEST_AGENT_ID = agt_* Test Agent of the live production runtime (exact live row authsvc-private; mechanism source-verified)

AUTH_PRINCIPAL_EXISTS = YES-FOR-OPENCLAW / NO-FOR-AGENT-CORE-ID
  - auth-service principal b09f1417-d26c-4f77-a3ac-8dc4fb4a18f9 (agent_id=stock-agent, active)
    exists for the OpenClaw stock-agent identity. The Agent Core runtime's agt_* Test Agent
    id is not the same principal key.
CLIENT_CREDENTIAL_EXISTS = YES-FOR-OPENCLAW / NO-FOR-AGENT-CORE-TRUSTED-STORE
  - machine client mc_oc_o6JuJjGAoIcv-cWBoBYd6Gw8 {forum.read, forum.write} and
    mc_wf_1jQPKhkR6MuIKP4xfvm5gA {workflow.*} exist (auth-service + OpenClaw credentialRefs).
    Nothing is bound to the Agent Core Test Agent id in AGENT_CORE_CREDENTIALS_FILE.

PROCESS_RECEIVED_CREDENTIAL_REFERENCE = N/A (gateway mode) — the Agent child never holds the
  secret; the 505 parent holds the store path only.
BROKER_CREDENTIAL_RESOLUTION = loadCredentialFor(credentialsFile, agentId) -> undefined
  (no entry for the agt_* Test Agent id; store re-read every call)

AUTH_TOKEN_MINT_ATTEMPTED = NO (credential undefined => fail-closed before any /oauth/token call)
AUTH_TOKEN_MINT_RESULT = NOT_REACHED

FORUM_GRANTS_PRESENT =
  forum.read = DECLARED (manifest) / NOT_BOUND (no Agent Core Test Agent client)
  forum.write = DECLARED (manifest) / NOT_BOUND

CREDENTIAL_UNAVAILABLE_EXACT_SOURCE =
  broker gateway (broker/src/gateway.js:156-159) — loadCredentialFor(credentialsFile, agentId)
  returned undefined for the calling Agent Core Test Agent.
  Concretely: NO MachineClient credential is bound to the Agent Core Test Agent id in the
  trusted 505 credential store (AGENT_CORE_CREDENTIALS_FILE). It is a
  "credential not provisioned for THIS Agent Core identity" failure — NOT a Router injection
  drop, NOT an auth-service denial, NOT a scope/grant insufficiency.
```

**No bypass used / correct model preserved** (hardcoded Forum token, moderator token, manual injected bearer, secret-in-workspace all rejected). The intended seam is intact: Agent identity → real credential seam (`loadCredentialFor`) → Broker gateway → auth-service `client_credentials` → scoped JWT → Forum.

### 2.4 Category verdict

```
FORUM_CREDENTIAL_FAILURE_LAYER = BROKER_GATEWAY_CREDENTIAL_RESOLUTION
FORUM_CREDENTIAL_BLOCKER      = YES (matches readiness F5 G2; STOCK_AGENT_CANARY not green)
```

---

## 3. Issue C — Feishu Binding → Workspace

### 3.1 Current model (source-verified)

**Binding schema** (agent-router `binding-store.js`, `persistBinding` in `index.js`):

```
BindingRow = { channelConversationId, activeAgentId, activeSessionId, updatedAt }
```

- **No `workspace` field.** The store document is `{version, bindings, lastSessions, freshSessions}`.
- `agentId` resolved in: `resolveChannelConversation` (first-contact default) and `switchAgent` — via `agentDefinition.resolveAgentRef(target)`.
- `sessionId` resolved in `switchAgent` (`targetSessionId ?? store.getLastSession ?? defaultSessionId 'main'`).
- **workspace decided** in `ensureRunning(agentId)`:

```js
const workspace = workspaceBootstrap.resolveWorkspace(agentId)   // ~/.agent-core/workspaces/<agentId>
const home      = workspaceBootstrap.resolveDshHome(agentId)     // ~/.agent-core/homes/<agentId>
// workspace + home are baked into the ONE AgentProcess and NEVER vary per binding/session
```

**Where workspace root comes from** (`workspace-bootstrap/src/paths.js`):

```
resolveWorkspace(agentId) = <workspaceRoot>/<agentId>
  workspaceRoot = configured workspaceRoot ?? $DSH_WORKSPACE_DIR ?? ~/.dsh/workspaces
  (production compose passes layout.workspacesRoot = <prod-root>/workspaces)
```

So the workspace root is **derived from the Agent Definition id only** (a "Workspace Bootstrap derivation", indirectly driven by the agent id; NOT a Binding field, NOT a Session field, NOT a Router launch arg, NOT $DSH_HOME).

```
CURRENT_BINDING_MODEL            = {ccId, activeAgentId, activeSessionId, updatedAt}; NO workspace
CURRENT_WORKSPACE_RESOLUTION_MODEL = workspace = f(agentId) via workspaceBootstrap.resolveWorkspace; one process per agent with one workspace/home baked at spawn
```

### 3.2 The architectural question (core finding)

**Does one DSH process carry Session A → Workspace A and Session B → Workspace B?**

- **DSH scope: SESSION.** Source-verified in the DSH harness:
  - `packages/fs/tool-fs/src/session-cwd.ts`: file tools resolve relative paths against **`exec.agent.session.header.cwd`** (the per-session cwd), not a process global.
  - `packages/context/agent-instructions/src/index.ts:124`: the instruction surface (AGENTS.md baseline) is derived from **`agent.session.header.cwd`**.
  - `packages/workspace/workspace/src/index.ts`: the `WorkspaceRegistry` **groups sessions by canonical header.cwd** into workspaces — multiple distinct cwd paths naturally become multiple workspaces.
  - `packages/core/agent-loop/src/index.ts`: `create(id, opts, meta: {cwd})` — the per-session cwd is a **configurable per-session value** (`meta.cwd`); `systemPrompt` exposes `session.header.cwd`.
- **DSH supports it natively** ⇒ per-session workspace is real, NOT process-global in DSH.

**But Agent Core does not feed it.** The per-agent `AgentProcess` spawns `dsh --profile <agentProfile>` with a single `workspace` as cwd and single `home` as DSH_HOME (`process.js`). The `demo-server` (the JSON-RPC entry) captures ONE `cwd` at `initialize({cwd})` and passes that **same** cwd as `meta:{cwd}` to **every** session it creates/resumes (`demo-server/src/index.js` `getOrCreateSession` / `agents.create({meta:{cwd}})`). There is **no** per-session (or per-binding) workspace seam in `turn()` / `runTurn()` / `deliver()`.

```
DSH_WORKSPACE_SCOPE = SESSION (CONFIGURABLE per session via meta.cwd)
ONE_AGENT_ONE_PROCESS_COMPATIBLE_WITH_MULTI_WORKSPACE = WITH_CONSTRAINTS
  - DSH side: fully compatible (sessions carry distinct cwd) — NO kernel conflict.
  - Agent Core side: NOT currently exercised — the Router routes every session of an agent into
    the agent's single process whose single cwd came from resolveWorkspace(agentId).
    The one-agent-one-process wiring is only a *constraint* because Agent Core hard-codes the
    single process cwd, not because DSH forbids multi-workspace.
```

So the honest architectural answer: **the conflict is in Agent Core's wiring, not a DSH kernel ceiling.** "One Agent = one process" and "same Agent + different Binding → different workspace" are compatible **if** the Router passes a per-binding/per-session workspace instead of always `resolveWorkspace(agentId)`. `ONE_AGENT_ONE_PROCESS_COMPATIBLE_WITH_MULTI_WORKSPACE = WITH_CONSTRAINTS` (constraint = a workspace seam must be added to the Router; nothing in DSH blocks it).

### 3.3 Workspace-loss layering (the "find it in which layer" question)

```
Binding Store      -> Binding resolution  -> Router   -> Agent process lifecycle
   -> Workspace Bootstrap  -> DSH process/session
```

Walk:

- **A. Binding schema has no workspace** → **YES** (BindingRow = ccId/agent/session/updatedAt only). Even the pre-seeded canary binding in the readiness report (`feishu:oc_... → agt_stock_agent / main`) carries no workspace.
- **B. Binding has workspace but store didn't save** → N/A (no such field exists).
- **C. Store has it but resolver didn't return** → N/A.
- **D. Resolver returned but Router lost it** → N/A (router never requests/threads a workspace).
- **E. Router passed it but one-agent-one-process fixes it** → **YES (the operative layer)**: `ensureRunning(agentId)` computes workspace from agentId **once** at spawn and reuses the process (`registry` keyed by agentId) for every binding/session. All bindings of the same agent share the single process's single workspace. This is the concrete place "different workspace configured anywhere would collapse".
- **F. Session created without a workspace seam** → **YES**: `demo-server` pins one process-level `cwd` into every session's `meta.cwd`; `turn()`/`deliver()` have no workspace argument.
- **G. DSH supports it but Agent Core didn't wire it** → **YES** (DSH session-cwd model supports per-session workspace; Agent Core feeds only the single agent cwd).
- **H. Just config error** → **NO** (no configuration exists that could express per-binding workspace; it is a model/wiring gap, not a config typo).

```
MULTI_WORKSPACE_FAILURE_LAYER = BINDING_SCHEMA (A) + PROCESS_MODEL (E) + SESSION_SEAM (F)
ROUTER_BUG = NOT_PROVEN        (router faithfully implements the frozen model; no workspace seam to mishandle)
BINDING_MODEL_GAP = YES
WORKSPACE_BOOTSTRAP_GAP = NO   (bootstrap does exactly what its doc says: workspace = f(agentId))
PROCESS_MODEL_CONFLICT = YES   (in Agent Core wiring, not in DSH kernel)
```

---

## 4. OpenClaw reference behavior

Recovered from the migration archive (`~/.hermes/migration/openclaw/20260415T090156/archive/`):

- **bindings.json**: `[ { agentId, match: {channel:'feishu', peer:{kind:'group', id:'oc_...'}} }, … ]` — route **each Feishu group** to a named agent.
- **agents-list.json**: each agent carries an explicit **`workspace`** field:
  - `stock-agent` → `/Users/yanfenma/.openclaw/groups/workspace-oc_0480991b97f1e27c96514ac66b4f122c`
  - `research-agent` → `.../workspace-oc_099bde440b2e9a09fcacbca420568439`
  - … one `workspace-oc_<chatId>` per (agent × group).
- The on-disk dirs confirm it: 90 × `~/.openclaw/groups/workspace-oc_*`, each a fully-stuffed cwd (AGENTS.md, MEMORY.md, SOUL.md, USER.md, …).
- Identity reuse across chats is visible: e.g. `lobster-agent` (group `oc_832c…`) vs `lobster-guide-agent` (group `oc_d05a…`); `feishu-expert-agent` (group `oc_9855…`) vs `feishu-expert-2-agent` (group `oc_c6f7…`) — same role string, **two distinct working directories**.

```
OPENCLAW_REFERENCE_BEHAVIOR =
  The working directory is stored PER PEER/GROUP (workspace-oc_<chatId>), carried as the agent's
  `workspace` field, with each (channel-peer) binding 1:1 to its own agent + own workspace.
  Net product semantic: same/similar role + different chat => different working directory.
  NOTE: OpenClaw never literally bound the SAME agent id to two peers — it cloned per-peer agents —
  so it does not prove the same-agent-multi-workspace case either; it proves the
  "distinct chat => distinct working directory" product goal. Only that product semantics is adopted
  here, NOT the OpenClaw runtime.
```

---

## 5. Real Private / Group trace for the same Test Agent

Mechanism (source-verified; exact live chatIds for this deployment's Test Agent are authsvc-private, so chatId shown is the known canary group — private p2p chatId is opaque/pair-specific):

```
PRIVATE (p2p)
  ingress: channel='p2p', chatType='p2p', conversationId=<p2p chatId>
  binding namespace: 'feishu' (ingressBindingNamespace — every Feishu ingress binds under 'feishu')
  bindingKey = feishu:<p2p chatId>
  agentId    = resolved from binding -> Test Agent agt_*
  sessionId  = 'main' (Binding.activeSessionId)
  workspace  = ~/.agent-core/workspaces/<agentId>  (agent-scoped)
  DSH native session = 'main' (same native session id as group, same process)
  replyTarget = feishu.reply(replyTargetFor(ingress).replyTo(messageId))

GROUP (大侠 - 小虾米, oc_92332c45c1cac2ef89857abfee8ed762)
  ingress: channel='group', chatType='group', conversationId=oc_92332c45c1cac2ef89857abfee8ed762
  bindingKey = feishu:oc_92332c45c1cac2ef89857abfee8ed762
  agentId    = Test Agent agt_*
  sessionId  = 'main'
  workspace  = ~/.agent-core/workspaces/<agentId>  (agent-scoped — SAME as private)
  DSH native session = 'main' (same native session, same process — private and group share it)
  replyTarget = feishu.reply(replyTargetFor(ingress).replyTo(messageId))
```

Cross-checks:

- `ingressBindingNamespace` returns `'feishu'` for both p2p and group (subtype `p2p/group/thread` is a message-subtype, never a Binding namespace — merge audit FIX 1, frozen semantics). So **private and group map to DIFFERENT binding keys** (`feishu:<p2pChatId>` vs `feishu:oc_9233…`) but both resolve to the **same (agent, session=main)** and hence the **same workspace**.
- The readiness report confirms the group key form is `feishu:oc_92332c45c1cac2ef89857abfee8ed762` (not the older `group:` prefix of FEISHU_TEST_BOT_REAL_SLICE_V1).

```
SAME_AGENT   = YES
SAME_SESSION = YES
SAME_WORKSPACE = YES     ← the product violation: EXPECTO SAME_WORKSPACE = NO
MULTI_WORKSPACE_FAILURE_LAYER = BINDING_SCHEMA + PROCESS_MODEL (see §3.3)
```

The blocked product state: 群 A → 小虾米 → workspace A, 群 B → 小虾米 → workspace B, 私聊 → 小虾米 → workspace C **is NOT expressible** in the current binding/session/workspace model, and even if a workspace were somehow attached to a binding, the one-process-one-workspace bake-in (E) would collapse it.

---

## 6. Candidate models (compare only — no decision, no implementation)

| Model | Shape | Reuses | Fit vs target |
|---|---|---|---|
| **A. Agent → one process → per-session workspace** | Router passes a per-binding-derived workspace into each session's `meta.cwd` within the one agent process | Binding + Session (`activeSessionId`) + DSH session-cwd | **Fits DSH natively.** Requires a workspace resolution seam (Binding or config) + passing it into `agents.create({meta:{cwd}})`/demo-server per session. Smallest delta; matches DSH's session-scoped workspace. |
| **B. Agent Definition → multiple Runtime Instances** | Same Agent Definition, multiple process instances, one per Binding/workspace; agent identity no longer strictly 1:1 with a process | AgentProcess spawn already exists; registry keyed by (agentId, workspace) instead of agentId | Works, but breaks the frozen "registry keyed by agentId" and per-agent single-flight assumptions; heavier lifecycle change. |
| **C. Binding → Agent Profile / Workspace Instance** | A Binding carries its own workspace/profile; a new product entity per binding | Binding store rows | Closest to OpenClaw's per-group workspace dir, but introduces a new product entity — only justified if A proves insufficient. |

**Recommended direction to evaluate first (not deciding):** Model A, because DSH already scopes workspace per session and the current block is purely that the Router/demo-server hard-code a single agent cwd. It reuses Binding (the existing workspace-bearing seam would need a new optional field) + Session + the existing `workspaceBootstrap` path functions, with the smallest surface. Before any implementation, the governing Spec must amend the frozen AGENT_SESSION_CHANNEL_MODEL_V1 decision (agent-owned workspace / Binding shape) — see §8.

---

## 7. Group @ behavior (Issue B — deferred ownership, records only)

Source-verified current behavior in `feishu-connector/src/core.js` `classifyIngress`:

```
p2p                -> forward (reason 'p2p')
group + mentioned  -> forward (reason 'group_mentioned')
group + not mentioned -> NOT forward (reason 'group_not_mentioned')   // requireMention = true
thread + addressed -> forward ('thread_addressed')
thread + not addressed -> NOT forward ('thread_not_addressed')
```

So: `GROUP_MESSAGE_WITHOUT_MENTION = NO_REPLY`, `GROUP_MESSAGE_WITH_MENTION = REPLY`. This is in the Feishu transport (connector), previously documented as the intended requireMention=true semantics (readiness report Task 4, runbook). Any change (e.g. groupPolicy=open / requireMention=false) is a Feishu-transport policy change and is explicitly **out of scope for this round**; it is owned by:

```
GROUP_REQUIRE_MENTION = YES
GROUP_REQUIRE_MENTION_OWNER = LARK_TRANSPORT_INVESTIGATION (OPENCLAW_LARK_TRANSPORT_REUSE_INVESTIGATION_V1)
```

---

## 8. Decision stack

```
NEED_GOVERNING_SPEC = YES
  - The frozen D-002 AGENT_SESSION_CHANNEL_MODEL_V1 declares "Agent 固定拥有自己的 workspace /
    DSH_HOME / credential / memory" and the Binding is (agent, session) only. The stated product goal
    "same Agent + different Binding => different workspace" contradicts that frozen invariant. It must be
    amended/superseded by a governing Spec BEFORE any implementation. This investigation grants no
    authority — it only records evidence.
  - The Forum credential fix is likewise governed: Agent Core identities need MachineClient binding in
    the trusted store (AGENT_CORE_CREDENTIALS_FILE) + auth-service principal/grants for agt_* ids; the
    touched layer is the trusted-deployment boundary, also needing a Spec/runbook decision.

CODE_CHANGE = NONE
ROUTER_CHANGE = NONE
RUNTIME_CHANGE = NONE
KERNEL_CHANGE = NONE
  (This round is INVESTIGATION ONLY — nothing was modified.)
```

---

## 9. Evidence index (read-only reference)

- Agent Core Binding/store: `packages/agent-router/src/{index,binding-store,process}.js`
- Workspace mapping: `packages/workspace-bootstrap/src/{index,paths}.js`
- Production composition/layout: `packages/production-runtime/src/{compose,paths}.js`
- Broker credential path: `packages/broker/src/{gateway,credential-store,credential,transport,capabilities/forum}.js`
- Feishu ingress/mention: `packages/feishu-connector/src/{core,index}.js`
- DSH session-cwd: `packages/fs/tool-fs/src/session-cwd.ts`, `packages/core/agent-loop/src/index.ts`, `packages/context/agent-instructions/src/index.ts`, `packages/workspace/workspace/src/index.ts`
- `demo-server`: `packages/demo-server/src/index.js`
- Frozen model: `docs/decisions/AGENT_SESSION_CHANNEL_MODEL_V1.md`, `docs/decisions/BINDING_AND_SWITCH_V1.md`
- Readiness: `docs/reports/feishu-stock-canary-readiness-v1.md`, `docs/reports/stock-cutover-preparation-v1.md`, `docs/reports/feishu-test-bot-real-slice-v1-evidence.md`, `docs/runbooks/feishu-stock-canary-v1.md`
- OpenClaw archive: `~/.hermes/migration/openclaw/20260415T090156/archive/{bindings,agents-list}.json`
