# SCHEDULER_SELF_HEALING_REAL_EVENT_ACCEPTANCE_V2 — live-bytes re-freeze and target re-identification (2026-10-06)

Lane: docs-only acceptance-packet re-freeze (Product #459, command `mayf3/agent-control#445`).
Production mutation performed by this lane: **NO**. No redeploy, no restart, no sudo, no
scheduler-job create/modify, no run-now/forced slot, no real Feishu event sent, no credential or
durable-store mutation, no raw store read (gated surfaces recorded as gated, not forced).

Purpose: the frozen real-event acceptance packet V1
(`docs/evidence/scheduler-self-healing-real-event-acceptance-packet-v1-20260925/`, freeze commit
`88866df7`, branch `docs/scheduler-self-healing-from-feishu-v1-acceptance-closure`, Sep 25) is
STALE against the current generation per the VERIFY_ONLY census `mayf3/agent-control#441`
(completed 2026-10-05T17:29:25Z, PRODUCTION_MUTATION=NO). This file re-freezes the live-byte
binding and re-identifies the target; `ACCEPTANCE_PACKET.md` in this directory is the
corresponding V2 packet.

Freeze head: branch `docs/selfops-v4-acceptance-refreeze-20261006` from `origin/main` `4a666777`
(Merge PR #453). No source files are modified by this lane.

## 0. Governing accepted authorities (fresh sha256 from this freeze head)

```text
docs/specs/SCHEDULER_SELF_HEALING_FROM_FEISHU_V1.md        sha256 c2d9f0fddea9353895a4b3349613653f8bcfd4fa2fd66d2a72f845b17a20a21f  status: accepted
docs/specs/AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V4.md   sha256 919e53d4b349866fbd742e6bcca9720661cfbf76e2dc8c23ff8d31f04f8acc01  status: accepted
docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md       sha256 c46b84ef91637a88929dd0f297bfb794ca80ee6b2719f495f90d0034aaa84e25  status: accepted
docs/specs/SCHEDULER_CONTROL_PLANE_RELIABILITY_V1.md       sha256 065a0626632754488a6f86d543347aa82fb7ab9d4084740a727ecf6e31d65138  status: accepted
docs/specs/AGENT_CORE_SCHEDULER_RUN_HISTORY_V1.md          sha256 a54344a5a9d8d773b975b1bbb3220359af62ae701fc60cfd40e9f45074872968  status: accepted
docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md          sha256 1c37687e473df7ce977e5cc571f74d9a6dc0470f3aca95a599d4c9066e52321f  status: accepted (D-007 successor)
```

All three V1-packet authority digests are byte-identical to the Sep-25 freeze (specs unchanged);
the reliability/run-history specs and the occurrence-outcome decision are added because the V2
packet's leg-4 durable-accounting predicates cite them.

## 1. LIVE_BYTES re-verified — 2026-10-05T18:07Z capture window (2026-10-06 02:07 +08:00)

Fresh read-only `shasum -a 256` over tree `/usr/local/libexec/agent-core/app` (user-owned by
`authsvc`, world-readable; no elevation was needed or used):

| Live path under app | Live SHA-256 (fresh 2026-10-06) | #441 report | Sep-25 V1 packet | Match |
|---|---|---|---|---|
| `packages/scheduler/src/eligibility.js` | `939863a5d706c74c9129a443b00445ea638dd7791c60609259ee80d11006627b` | — | same | EXACT |
| `packages/scheduler/src/occurrence.js` | `86f547f3ee51b291999432aab119916e98696f1dd4b5a3a9dccb505bc2b9a5a7` | — | same | EXACT |
| `packages/scheduler/src/scheduler.js` | `e3e8dce0fd8959336521147b639007b82e8ce98d932eca82ca2b98ac2506770d` | `e3e8dce0` | same | EXACT |
| `packages/scheduler/src/store.js` | `a8eacf4f16edd207b7181a5fcc47b30a4b26c9e852d335ca2746c88fd4ac3fcc` | `a8eacf4f` | same | EXACT |
| `packages/scheduler/src/self-ops/diagnosis.js` | `4038e4f88086f49bae3e367b1df669e9f874286231b50606397ba5b6c90540df` | one line behind main | same | EXACT |
| `packages/scheduler/src/self-ops/index.js` | `0fcb6811f53278f23bca7bfed1cd841a1034874054533453935e4c75da4c4293` | == main | same | EXACT |
| `packages/scheduler/src/watchdog/admission-isolation.js` | `5c770d5e99ebc20f794284020aa9cf5471609e9bf7c9e1e2ff3c2be5a8671d25` | — | same | EXACT |
| `packages/broker/src/capabilities/self-ops.js` | `e7f6105de4be81e37ccc60e983fe005751880d9b8a0af93c9e0602a78da87620` | `e7f6105d` | same | EXACT |
| `packages/broker/src/gateway.js` | `4c341db4d0369811b3df4a4eb7e711af33fdf84abe17a39349c5f75e7830490e` | `4c341db4` | same | EXACT |
| `packages/broker/src/registry.js` | `9dab1da617e9856f99020f0d1c4fd533997f31713e1941bb1a33e3d543216534` | `9dab1da6` | (new binding in V2) | EXACT |
| `packages/broker/src/capabilities/workflow.js` | `ed96a4c97fa2c69a90000aa66055185f929c2670d6d0b11d1bb51148f10e8bdf` | — | same (WEC generation canary) | EXACT |

Every digest #441 reported is re-confirmed byte-exact TODAY. The nine V1-bound files plus
`workflow.js` are byte-identical to the Sep-25 V1 freeze; V2 adds `packages/broker/src/registry.js`
as a tenth binding (the model-visible registration surface #441 added to the frozen set; it is
also byte-equal to `origin/main`).

The four #441-reported identities, bound verbatim:

```text
self-ops.js (broker capability manifest)  e7f6105d…
registry.js (model-visible registration)  9dab1da6…
gateway.js  (broker gateway)              4c341db4…
scheduler.js (engine)                     e3e8dce0…
```

Generation identity at re-freeze (read-only `launchctl print system/ai.agent-core.runtime`, fresh
2026-10-06):

```text
runtime      = system/ai.agent-core.runtime state=running, pid 64187, started 2026-10-04 11:12:00 +08:00
command      = /usr/local/libexec/agent-core/app/scripts/production-runtime.mjs
               --root /Users/authsvc/.agent-core --catchup 0
catchup      = startup catch-up intentionally OFF; natural slots fire from persisted nextRunAtMs
store        = /Users/authsvc/.agent-core jobs.json + runs.jsonl  (ROOT-GATED: direct read from
               this lane returns Permission denied — see §3; least-privilege readback is LEG-1)
watchdogs    = system/ai.agent-core.scheduler-watchdog-w1 / -w2 both registered (loaded launchd
               services, program /usr/local/libexec/agent-core/node-runtime/bin/node; periodic
               services read "not running" between kicks — firing liveness stays a LEG-1 item)
health 8790  = {"ok":true,"service":"agent-core-notification-ingress","deliverReady":true,"authConfigured":false,"storeReady":true}
health 8788  = {"ok":true,"service":"agent-core-product-api"}
handoff      = /Users/yanfenma/workspace/artifacts/scheduler-self-healing-deployment-handoff-20260923/HANDOFF.txt
               sha256 eef37f5a4a73c31cf6946c8d54c29bd73f23699df0a3d9ef1b25c96ee693212c (unchanged vs Sep-25 record)
```

Natural-slot liveness corroboration (read-only `ps` census of pid-64187 agent children, fresh
2026-10-06): surviving child start-times sit on exact `:00:01` schedule marks — Oct 4 16:00:01,
22:00:01; Oct 5 00:00:01, 00:07:01, 07:00:01, 08:00:01 (×2), 09:00:01, 09:30:01 — i.e. persisted
natural slots are firing on this runtime. Completed slots exit and therefore do not appear in a
`ps` snapshot; this census is corroboration only, never job evidence.

## 2. Live generation vs `origin/main` — drift characterized (adds nothing to the packet's risk)

`origin/main` `4a666777` is ahead of the live generation (base `d602b592` + slot-units per #441).
Diffing live bytes against `origin/main` blobs (read-only):

```text
scheduler.js        live e3e8dce0… vs main 778a8ebc… — main ADDS the C11-R1 trusted
                    late-outcome self-heal consult (reconciliationReadback + _reconcileTrustedOutcomes,
                    merged in 47aadec1 Oct-1, not yet deployed). Main's own comment: without it
                    "every unknown stays exactly as fail-closed as before" — the LIVE engine is the
                    conservative side; no V4 semantics are weaker live than on main.
occurrence.js       live 86f547f3… vs main 2e62f842… — main ADDS C11-R1 reconciliation plumbing +
                    SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1 (CTR-SCT-005 jobId plumb, S1
                    proven-pre-start terminal evidence). Additive on main only.
diagnosis.js        live 4038e4f8… vs main 57fe9cf4… — exactly ONE line: main adds the
                    'restart_quiescence_proven' vocabulary (c0c1752b, HR-restart safety). This is
                    the #441-known one-line delta; NOT a V4 semantic. LEG-2 handling frozen in the
                    packet: a live disposition that would be restart-quiescence on main is treated
                    as evidence-insufficient → fail-closed UNKNOWN/stop, never interpreted favorably.
gateway.js          live 4c341db4… vs main 00ee5bce… — main ADDS fixed_operation direct-RPC
                    re-validation and widens the credential-free LOCAL set to
                    {self_ops, fixed_operation}. Live already keeps self_ops credential-free;
                    V4 surface semantics identical live.
```

Acceptance binding is to the LIVE generation (digest set §1), exactly as in V1; `origin/main`
deltas are recorded as known generation notes and are NOT deployed by this Product
(#441 gap G5: no deploy is required for acceptance, so the Oct-5 B7 RETENTION_CAP refusal does
not block this Product).

## 3. Target re-identification (fresh, 2026-10-06, read-only only)

Target: **agt_3d-print-agent — 「3D打印专家 - 生活」**, its own real recurring daily job at
10:00 Asia/Shanghai.

```text
IDENTITY (fresh)  = authsvc directory readback 2026-10-06 (lookup-principal.py --all):
                    agt_3d-print-agent  principal ed55e35c-f0a1-43fe-a2db-f6b7c45b7005  status ACTIVE
                    (display name 3D打印专家; the bare 3d-print-agent/30ec9983 legacy row also
                    exists — the runtime census name is the agt_-prefixed agent_id, as in V1)
REAL OWNED JOB    = the bot's own Feishu announcement of record (2026-09-24 10:04):
                    「3D打印专家 - 生活」「已设置每日 10:00 (Asia/Shanghai) 自动任务。 - 生成：…」
                    screenshot /Users/yanfenma/workspace/artifacts/feishu-selfheal-reply-check.png
                    sha256 ac9037526f59ed4f96233076c22a986fbbf721766032980ad88966a9a16cbc2d,
                    re-opened and re-verified visually 2026-10-06 (full-window capture 2026-09-24
                    20:38, message-list sidebar; the -crop file e8c86921… evidences only the HR
                    delivery-failure exchange). No store read was performed or claimed. Current
                    existence is re-confirmed in-window by the bot's own self_ops.status
                    (NO_OWNED_SCHEDULER_JOB otherwise). Mis-targeting is fail-closed.
RUNTIME LIVENESS  = pid 64187 alive with exact-:00:01 natural-slot child starts (§1).
STILL-GATED       = /Users/authsvc/.agent-core jobs.json per-job enablement/nextRunAtMs, runs.jsonl
                    history, watchdog firing liveness, and the real live-turn model tool list remain
                    authsvc/root-gated (#441 gap G1) — LEG-1 of the V2 packet closes exactly this
                    with one read-only elevated identity readback. Nothing was forced from this lane.
EXCLUSIONS        = 「HR助手 - 管理」 stays FORBIDDEN as target/reconcile-coordinate regardless of
                    incident status (conservative carry-over of the V1 rule); Product #458 is
                    user-paused and its worktree is untouched; the #454 writer lane is
                    conflict-disjoint and not implicated by this target.
```

## 4. Superseded packets and #441 gap-closure map

```text
SUPERSEDED  = ACCEPTANCE_PACKET V1 (88866df7, side branch
              docs/scheduler-self-healing-from-feishu-v1-acceptance-closure) and its Sep-25
              LIVE_BYTES_AND_EVENT_RECONCILIATION: superseded by V2 (this dir). V1's nine-file
              digests carry over byte-identically; V1's Owner-wording messages carry over
              verbatim; V1's outcome/fence/authorization semantics carry over with the leg
              renumbering and additions frozen in ACCEPTANCE_PACKET.md.
#441 G1     → V2 LEG-1 (read-only elevated identity/tool-list readback) — closed at execution.
#441 G2     → V2 §5 diagnosis-vocabulary rule: live diagnosis.js lacks only
              'restart_quiescence_proven'; such a disposition fails closed (UNKNOWN/stop).
#441 G3     → V2 binds the live digest set (§1) + records main-ahead additive deltas (§2).
#441 G4     → this re-freeze itself (stale Sep-25 packets superseded).
#441 G5     → recorded in §2 (no deploy needed; retention-cap refusal non-blocking).
TEST BASIS  = #441: 407/407 PASS at origin/main 4a666777 (node v26.7.0, temp stores only, zero
              production contact) — scheduler battery 399/399 (incl. durable accounting,
              UNKNOWN/no-replay fencing, duplicate suppression, restart matrix, natural-slot
              projection), broker self-ops-v3 5/5 (model tool list contains self_ops with exactly
              three actions, keeps scheduler, excludes agent_session_send_reconcile),
              production-runtime self-service mount 3/3 (missing Router seams withhold self_ops
              fail-closed). The live generation shares byte-identical self-ops/store/eligibility/
              admission-isolation/registry/self-ops-capability/gateway files with that tested
              tree (§1); live occurrence.js/scheduler.js are the conservative (pre-C11-R1) side.
```
