# @agent-core/production-runtime — PRODUCTION_RUNTIME_V1

The Production Runtime: one startable, long-lived, crash-recoverable process
that composes the EXISTING Agent Core components over one production
persistent root. It is WIRING/LIFECYCLE ONLY — no domain logic, no second
authorities, no Workflow/Forum/OKR semantics.

## What it composes (all existing components, bundle-integration row order)

| Component | Role (unchanged) |
|---|---|
| workspace-bootstrap | per-agent workspace / DSH_HOME mapping + `ensure()` |
| agent-definition | Agent existence authority — config LOADED, never written |
| feishu-connector | channel; mounted ONLY with real credentials (`FEISHU_CREDS_PATH`) |
| agent-router | process lifecycle + Binding + Delivery V0 admission |
| broker (gateway mode) | capability authorization boundary (Trusted CP seam) |
| product-api | thin mobile surface over the Router (127.0.0.1:8787) |
| notification-ingress | thin `POST /v1/deliver` over `agentRouter.deliver` (127.0.0.1:8790) |
| scheduler + scheduler-router | JobStore on the production store + engine loop |

Entry: `scripts/production-runtime.mjs` (thin launcher over
`src/entry.js`). Acceptance: `scripts/production-runtime-v1-verify.mjs`.

## Persistent root (Task 3)

Default `~/.agent-core` — the SAME root `agentcore-cron` defaults to, so
external job writers and the resident engine share one store with zero env
wiring (`PRODUCTION_RUNTIME_ROOT` / `--root` to override):

```
~/.agent-core/
  agents.json                    # Agent Definition config (deployment-authored)
  bindings/bindings.json         # Router BindingStore (+bookmarks +fresh mappings)
  scheduler/jobs.json            # Scheduler JobStore (agentcore-cron default path)
  scheduler/runs.jsonl
  workspaces/<agentId>/          # persona / AGENTS.md authority
  homes/<agentId>/               # per-agent DSH_HOME (settings/creds/profile/sessions)
  control/runtime-evidence.jsonl
  logs/                          # supervised stdout/stderr
```

`.demo` roots are rejected fail-loud (`src/paths.js`): production state is
never demo state.

## Per-agent profile

`agent-core-production` (`profile-production/`): dsh-base + demo-server
(the resume-aware JSON-RPC process protocol server the Router speaks) +
owner-guard + agent-memory + agent-switch + broker relay. The runtime passes
it explicitly; the Router has NO profile default anymore
(PRODUCTION_RUNTIME_V1 removed the historical `agent-core-demo` fallback).

## Supervision (Task 4, macOS)

`scripts/production-runtime-launchd.mjs` renders/installs a plain launchd
LaunchAgent (`ai.agent-core.runtime`, the posture this machine already uses
for OpenClaw):

```
node scripts/production-runtime-launchd.mjs --print     # render plist
node scripts/production-runtime-launchd.mjs --install   # write + bootstrap
node scripts/production-runtime-launchd.mjs --status
node scripts/production-runtime-launchd.mjs --uninstall # bootout + remove
```

`RunAtLoad` starts the runtime at boot/login; `KeepAlive` restarts it after
a crash (ThrottleInterval 10s). No container platform, no Kubernetes, no VM
manager, no supervisor framework — launchd only.

Crash semantics: the runtime handles graceful SIGTERM/SIGINT (engine stop →
every plugin disposer → agent processes shut down). After a hard crash the
next boot replays at-jobs that came due while down (startup catch-up,
at-most-once) and restores Binding / bookmark / fresh-mapping tables from
disk. Orphaned per-agent DSH children of a crashed runtime either die with
their stdio pipes or are reaped by the supervisor restart; the owner-guard's
stale-PID takeover lets the respawned agent take the home lock.

## Trusted CP seam (Task 6 — thin, future PRODUCTION_INTEGRATION_V1)

The runtime performs NO 505/502 hardening itself. The entire Trusted CP
compat surface is ENV, passed straight through to the existing Router /
Broker code paths:

- `AGENT_CORE_CREDENTIALS_FILE` — 505-private credential store for the
  broker gateway (absent => every capability call fails closed with
  `credential_unavailable`; the gateway never fakes authorization).
- `BROKER_AUTH_ORIGIN` — auth-service origin.
- `DSH_AGENT_CHILD_UID` / `DSH_AGENT_CHILD_GID` / `DSH_AGENT_SPAWN_HELPER` —
  the trusted child-identity spawn config (fails loud when the parent cannot
  drop privileges).

`production-runtime-launchd.mjs --install` bakes every one of these that is
set in the installing shell into the plist `EnvironmentVariables`, so
TRUSTED_CP_AGENT_DEFINITION_COMPAT_V1 integrates by setting env at install
time — zero runtime code change, zero duplication of the hardening scripts
(`trusted-cp-deploy-install.sh` / `trusted-cp-hardening-v1-verify.mjs` are
untouched by this package).

## Explicitly NOT here

- No second Agent registry (Agent Definition config is the only authority).
- No second session mapping layer (Router BindingStore owns it).
- No runtime framework / dashboard / config service.
- No second scheduler, broker, or auth.
- No fake/recording Feishu seam: without credentials the channel stays OFF
  and delivery-requesting jobs are marked not-delivered (honest failure).
