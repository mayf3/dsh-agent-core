# ROOT CAUSE — self_ops is NOT model-visible (2026-09-19, Phase D forensics)

## Symptom
Feishu chat: agt_hr-agent (fresh worker + rolled session) answers "当前会话没有可用的
self_ops.job_disposition 工具". The model-visible tool list captured from the live turn
request header (session.jsonl request/header, 73 tools) contains `scheduler`, all
`workflow_*`, `forum_*`, `agent_*` — **self_ops is entirely absent**.

## Eliminated layers (all verified sound)
broker manifest (b302810c: 3 ops incl. job_disposition) · gateway readiness (4c341db4:
conjunct true when handlers complete — handlers DO complete, provider
self-service-runtime.js live≡cfc2729 sha acfde749, scheduler createSelfOpsAccess returns
handlers.self_ops.job_disposition) · router (live agent-router/index.js ≡ cfc2729 byte-identical;
resolveCallerCorrelation/reconciliationRuntimeStatus present → mount guard passes) ·
session freeze (rolled) · worker memory (killed+respawned).

## ROOT CAUSE
`packages/broker/src/registry.js` registerCapabilities():
  `.filter((capability) => capability?.manifest?.infrastructure !== true)`
The model-visible tool registry EXCLUDES every capability flagged `infrastructure: true`.
Exactly two capabilities carry the flag: **self-ops.js** and agent-session-reconcile.js
(both absent from the 73-tool list — consistent). The flag on self_ops is frozen by the
ACCEPTED spec AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V3 line 214:
  `self_ops   # new LOCAL, infrastructure=true, selector=action`
and the filter is identical in cfc2729 (line 255) — i.e. self_ops has NEVER been
model-visible in ANY lineage, including current main.

## Authority conflict (Owner-level)
- AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V3 (accepted): self_ops infrastructure=true (hidden).
- SCHEDULER_SELF_HEALING_FROM_FEISHU_V1 (accepted) §0/§3: the product premise is the
  model-facing self_ops.job_disposition surface (Feishu UX); its `preserves:` keeps V3's
  frozen authority and never explicitly amends the infrastructure=true line.
Two accepted specs conflict. Per repo governance (AGENTS.md), resolving it = spec
amendment/ruling by Owner — NOT an implementation-side change.

## Minimal candidate (pending Owner ruling)
Remove `infrastructure: true` from packages/broker/src/capabilities/self-ops.js (one line)
→ registerCapabilities registers self_ops as a normal model-visible tool (caller-scoped
safety unchanged: all three ops remain strictly caller-owned). Then: manifest-inventory
test check + full suites + review + V8 two-file→one-file deployment (self-ops.js only;
gateway/registry unchanged). agent-session-reconcile.js keeps its flag (different lane).

## Deployment-lineage note (acceptance-gap disclosure)
V7/V7C reviews verified the §5.3.1 availabilitySnapshot seam but did not trace the
registry's model-visible filter — the reviews validated the surfaces their scope
defined; the hidden-filter interaction predates all candidate packets (62905c1-era).
