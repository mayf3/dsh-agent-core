# INGRESS_RUNTIME_HANDOFF_MAP_V1 — Product #455 (A6) evidence map

```text
status: evidence
date: 2026-10-06
product: mayf3/dsh-agent-core#455 ([PRODUCT A6] Stable ingress / bounded runtime handoff)
baseline: origin/main 556ea5b4 (Merge PR #485)
execution: agent-control#457, claim a6-stable-ingress-r255, session sess_4208616d-82a9-47c6-b01e-ab954089c55f
PRODUCTION_MUTATION = NO (ACCEPTANCE_MODE = TEST_IDENTITY; throwaway layout roots + fake agent processes only)
```

## 0. Question this map answers

Product #455 DONE_WHEN: "Ingress/runtime handoff is explicitly mapped, bounded,
restart-safe, and independently verifiable without introducing a new platform or
becoming a prerequisite for unrelated read-only delivery."

This document is the explicit map. The handoff it maps is: **one user/business
ingress entry → admission → the one production runtime → per-Agent worker**,
including what happens to an admission that is in flight when the runtime
crosses a restart boundary.

## 1. CURRENT_MAP — the three ingress entries (origin/main 556ea5b4)

All entries feed ONE resident runtime process
(`packages/production-runtime/src/entry.js`; launchd KeepAlive supervision;
graceful SIGTERM/SIGINT only; persistent root layout `packages/production-runtime/src/paths.js`).

### Entry 1 — Feishu channel (push, long connection)

- Surface: `packages/feishu-connector/src/index.js` → `bridge.js`
  (AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2, accepted; SDK
  `@larksuite/channel` pinned git commit `ab028f9d`).
- Admission order: SDK safety pipeline (stale → dedup + lock → PolicyGate) →
  bridge admission segment (self-echo guard → bot-identity fail-closed →
  eligibility → PREBOUND_ONLY gate) → Router `onIngress`, awaited for the full
  turn (V0 semantics).
- Gate: `packages/production-runtime/src/v2-ingress-gate.js`
  (AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC §4.5/§5.5, accepted):
  `FEISHU_V2_INGRESS_MODE = PREBOUND_ONLY`; unbound conversation → fail closed
  (no default Binding ever created); non-primary Binding.workspace → blocked
  (transitional row preserved on disk). Wired at composition
  (`compose.js wireV2IngressGate`); missing gate handle fails composition loud.
- Dedup authority: the SDK safety pipeline (frozen by the accepted V2 spec,
  bridge.js header — the IngressEvent `dedupKey` is informational only). It is
  process-local; Feishu-side redelivery after a crash is bounded by Feishu's
  own redelivery window, and turn-level restart loss is reconciled by the
  TurnReconciliationStore (see §3), not by a second Agent Core dedup ledger.
  Any future durable-dedup work would need an AMEND of the V2 authority
  placement — out of scope here, explicitly not started.

### Entry 2 — HTTP notification ingress (authenticated deliver)

- Surface: `packages/notification-ingress/src/index.js` — one endpoint
  `POST /v1/deliver` (127.0.0.1:8790), `/health` for readiness.
- Contract: authenticate (service auth, `NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1`,
  accepted; allowlist svc-forum/svc-workflow) → authorize → validate →
  **durable reserve** (`(callerPrincipalId, requestId)`, payload-hash keyed,
  committed to `<root>/notification-ingress/idempotency.json` BEFORE the Router
  is ever called — C-IDM-004) → Router `deliver` (bounded by
  `routerDeadlineMs`, default 300000, C-IDM-011) → durable terminal record
  (`delivered | failed_no_admission | outcome_unknown`), settle-once, NO_LATE_REWRITE.
- Restart semantics: crash windows W1–W4 covered by the accepted idempotency
  spec; at boot every non-terminal record is atomically migrated to
  `outcome_unknown` (`restart_unresolved`) — nothing auto re-delivers; same-key
  replay REUSES the durable outcome (no second admission).
- Runtime wiring: `packages/production-runtime/src/notification-ingress-runtime.js`
  hands the plugin ONLY layout paths (`C-BND-003`) + wraps `router.deliver`
  with runtime evidence (`wireNotificationIngressDeliveryEvidence`).
- Disposal: `ctx.effect` disposer does `store.stop(); server.closeAllConnections();
  server.close()` — bounded; an in-flight caller's socket dies, and its retry
  is idempotent via the durable record (this is the designed handoff bound).

### Entry 3 — Scheduler (durable jobs; the fully bounded exemplar)

- Surface: `packages/scheduler/` over `<root>/scheduler/jobs.json` +
  `runs.jsonl` (atomic replace, single `mutate` authority).
- Restart rules (SCHEDULER_CONTROL_PLANE_RELIABILITY_V1, accepted):
  catch-up fires at most once per downtime, capped; execution decisions come
  from the durable occurrence ledger, never `runningAtMs` (scheduler.js:58;
  the V1 2h stuck-marker path was removed per ACC-030 and must not be
  referenced); startup catch-up replays at-jobs due while down. Restart drain
  of in-flight occurrences: `packages/production-runtime/src/scheduler/restart-drain.js`.

## 2. The runtime handoff boundary (controlled stop)

`compose.js stop()` (C11-R3 / Product #426 A4):

```text
writeBoundary('quiesce_begin')   ← <root>/control/restart-boundary.jsonl receipt:
                                    previous epoch + lifecycle slots + unresolved
                                    handle classes + in-flight occurrences census
  await workflowExecution.stop()   bounded drain (DSH_SHUTDOWN_CONTRACT)
  await scheduler.stop()
  await ctx.disposeAll()           registered disposers: Router (agent processes),
                                   notification-ingress (store.stop + closeAllConnections
                                   + close), product-api, …
writeBoundary('quiesce_end')
```

- The receipt is EVIDENCE ONLY — read-only over the recovery store; the next
  boot's classification reads the durable TurnReconciliationStore
  (`<root>/control/turn-recovery-v3.json`), never the receipt.
- Turn-level restart safety: `TurnReconciliationStore`
  (`packages/agent-router/src/reconciliation/store.js`,
  AGENT_PROCESS_LIFECYCLE_HARDENING_V4, accepted — supersedes V3, whose
  C-017..C-019 reconciliation semantics the store implements): durable,
  settle-once (`late_completed | late_failed | terminated_without_outcome`),
  runtime-epoch discipline — an epoch-mismatched unresolved record classifies
  `restart_lost` only when the epoch was never durably observed; never
  auto-replayed (UNKNOWN is never replayed).
- Ingress attribution: COHERENT_DURABLE_INGRESS_RECEIPT_ATTRIBUTION_V1
  (accepted, `implementation_scope: bounded_nonproduction_only`) — optional
  authenticated `ingressCorrelation` on the pre-prompt record + protected
  readback. No production authority granted by that spec.

## 3. GAP — what was missing, and what this change adds

Piecewise, every mechanism above had tests: idempotency crash windows W1–W4
(real SIGKILL, but plugin-standalone with a STUB router); quiesce receipts
(compose-level, but `notificationIngress: { enabled: false }`); graceful stop
closing HTTP surfaces (but with no delivery in flight).

The SEAM was unpinned: **an authenticated delivery durably reserved and parked
in flight INSIDE the full composed runtime, crossing the controlled stop, and
the next boot on the same root reusing it idempotently**. That is exactly the
"bounded runtime handoff" of A6 — and it is now pinned by:

- `packages/production-runtime/test/ingress-restart-handoff.test.js` (NEW,
  test-only; zero source change):
  1. delivery parked in flight (durable `reserved`, Router call held inside
     `proc.deliver`) at `SIGTERM` → quiesce_begin/quiesce_end receipts with
     full census, reservation survives the boundary exactly as reserved,
     ingress HTTP surface closed;
  2. restart on the SAME root → boot sweep migrates the carried-over
     reservation to `outcome_unknown` (`restart_unresolved`) with evidence →
     same-(caller, requestId) replay is idempotent (200, `duplicate: true`,
     `outcome_unknown`, `accepted: false`) with ZERO Router re-admission.

RED-first evidence: two temporary source mutations (reverted; final tree has
zero source change) each turned the new test RED —
M1 decoupling the idempotency store from the production layout (persistent
handoff wiring broken → 2/2 fail); M2 dropping the `quiesce_begin` receipt
(boundary evidence lost → receipt test fails). See the acceptance packet.

## 4. Remaining boundary (explicitly frozen, not claimed)

- BUSINESS_VERIFIED stays `no`: this map and test are TEST_IDENTITY evidence on
  throwaway roots. Production enablement/verification of the ingress surface
  (real Feishu entry, real authenticated caller, real restart) remains gated by
  the standing production rules (PROD_AUTH; serialized DS surface; canary +
  rollback contract).
- Durable Feishu-side dedup ledger: intentionally NOT built — dedup authority
  is frozen inside the SDK safety pipeline by the accepted V2 spec; changing
  that needs an AMEND, not a silent addition.
- A6 stays NOT a prerequisite for read-only delivery: nothing in this change
  sits in front of any read surface (product-api / history / broker reads are
  untouched pass-throughs).

## 5. Governing authorities (all accepted; none modified)

| Authority | Relevance |
|---|---|
| NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1 | HTTP entry: auth + durable idempotency + crash windows (the handoff contract pinned here) |
| HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V2 | Turn-level restart-lost classification (reconciliation store) |
| AGENT_PROCESS_LIFECYCLE_HARDENING_V4 (accepted; supersedes V3 — the reconciliation semantics cited by the store's own header) | Reconciliation store semantics (settle-once / epoch discipline / bounded queries) |
| AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC | Feishu PREBOUND_ONLY gate |
| AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2 | Feishu SDK cutover; dedup authority placement |
| SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 | Scheduler catch-up / no-dup restart rules |
| COHERENT_DURABLE_INGRESS_RECEIPT_ATTRIBUTION_V1 | Ingress correlation evidence scope (bounded non-production) |
| AVAILABILITY_DEPLOYMENT_ROADMAP_20260930 (docs/reports) | §3 target structure (stable ingress ordering), §12 稳定入口 acceptance row |

## 6. Verification summary (2026-10-06, this worktree, /usr/local/bin/node v25.6.1)

| Suite | Result |
|---|---|
| new `ingress-restart-handoff.test.js` | 2/2 pass, 10/10 consecutive runs, deterministic |
| packages/production-runtime | 175 pass / 0 fail / 1 skip |
| packages/notification-ingress | 60 pass / 0 fail / 1 skip |
| packages/scheduler | 399 pass / 0 fail |
| packages/agent-router | 477 pass / 5 fail — all 5 reproduced on PRISTINE origin/main (broker-rpc 2 seam + luna-credential-chain 3 real-child/credential environment seams); unrelated to this change |

Env note: this worktree needed a local `npm install` plus the machine-local
`@deepseek-ai/dsh-tools` and `@larksuite/channel` artifacts to run main's test
graph; installs are worktree-local only (node_modules is not tracked).
