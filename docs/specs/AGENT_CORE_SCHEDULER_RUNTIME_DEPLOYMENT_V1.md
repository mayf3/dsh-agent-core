---
spec_id: AGENT_CORE_SCHEDULER_RUNTIME_DEPLOYMENT_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: contracts
date: 2026-09-04
revision: r1
scope: [scheduler-runtime-selective-deployment, production-one-shot-canary]
governed_by:
  - AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2
  - AGENT_CORE_SCHEDULER_RUN_HISTORY_V1
  - SCHEDULER_OCCURRENCE_OUTCOME_V2
  - SCHEDULER_TIMEOUT_OUTCOME_V2
external_authorities:
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_SCHEDULER_BUNDLE_1_7_DEPLOYMENT_V1
    revision: f1dcd4b672c89e42c802d5a1460a0f8ce1c6cde8
    relation: prerequisite
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_DAILY_AUTONOMY_OPERATIONAL_GRANTS_V1
    revision: 29c3e2e32e7009d9ce0165e00aa9ba3053023c7d
    relation: prerequisite
supersedes: []
superseded_by: null
owners: [mayf3]
---

# AGENT_CORE_SCHEDULER_RUNTIME_DEPLOYMENT_V1

> **PROPOSED / NON-AUTHORITATIVE.** No artifact build, production write,
> restart, Scheduler mutation, trace, or message is authorized until independent
> exact-head review, Owner acceptance, merge, and final-head recheck.

## 1. Goal and exact transition

Deploy the accepted Scheduler closure into the sole production Agent Core
Runtime, then run exactly the one-shot self-service canary frozen by
`AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2/CTR-CANARY-001`.

```text
AUTHORING_BASE = e225d7b22e90d09f5658e267edb7c871c808434a
RELEASE_SOURCE = 18f96e25af623c1547956ee00447a664a7fba741
SCHEDULER_V2_ACCEPTANCE = 4c0a62382cabb9641dbf512a8d5f8ce8a9fed1f2
SCHEDULER_V2_IMPLEMENTATION = a420cb6895f69211f2275bc26a54bc9f8cdabf8e
HISTORY_ACCEPTANCE = a2919174338dc19ff16d9554d2f00c025d482410
HISTORY_IMPLEMENTATION = 8343f8f6bc175a6e1d3a8943e7b611992eec603a
HISTORY_LOCK_FIXES = 94f4d1a32c4d28096d860b5b756dda3b98c4073a,447e5a50162e21b571b8a557a81b0379073af9b1
TARGET_ROOT = /usr/local/libexec/agent-core/app
LAUNCHD_TARGET = system/ai.agent-core.runtime
GLOBAL_RUNTIME_LOCK = /usr/local/libexec/agent-core/.deployment.lock
```

This is a selective ten-file transition, never a checkout copy. History storage
stays dormant because production compose does not inject `history`; its five
modules are required because updated occurrence code imports the fail-soft sink.
The self-service file supplies exact `scheduler.admin`/`scheduler.audit` wire
names through the existing trusted `assertGrant` seam. This round deploys no
history HTTP/composition surface and grants no `scheduler.audit`.

## 2. Boundaries and prerequisites

The deployment transaction touches only §3 destinations. It changes no Broker,
production-runtime/compose, product-api, plist, environment, credential, Auth
row, Job/occurrence/history store, legacy path, workflow, or target workspace.

Apply begins only after: this Spec accepted/merged/final-head PASS; accepted ASM
Deployment V2 exact semantic head `e225d7b...` has terminal Stage B/D/E and temp
Grant compensation PASS; Auth Scheduler 1.7 exact semantic head `f1dcd4b...` is
accepted/merged/production PASS; permanent-Grant semantic head
`29c3e2e32e7009d9ce0165e00aa9ba3053023c7d` is independently reviewed,
accepted/merged/applied and exact `agent.session.send` plus `scheduler.admin` rows are live
only for `agt_efficiency-agent`; the sole Runtime is healthy; no production
transaction is active/authorized for the window/outcome-ambiguous; and fresh
post-ASM preimages match. Any unmet or drifted condition stops unchanged.

Prototype `/Users/yanfenma/workspace/deployment-artifacts/scheduler-runtime-deploy`
is evidence only. Manifest SHA-256 is
`9bd8245ef1511bbced7d346ac98ff237e78dd59b4190e76061a6b2f6203a7ccc`;
launcher SHA-256 is
`6240bd0c0f5f835a02efd671dbf3427fe67cbbbed55a7e9d189dc15b311e4c37`.
It is forbidden for apply because it pins the pre-ASM compose hash and uses
terminal `sudo`; rebuild after ASM under §4.

## 3. Exact ten-file release

All bytes come from `RELEASE_SOURCE`; destinations are under `TARGET_ROOT`.

| Action | Path | Git blob | SHA-256 |
|---|---|---|---|
| overwrite | `packages/scheduler/src/index.js` | `ae6cc4829ee2ff42fd81edbc53899da0ac67f12e` | `eb2f0c1d82a716b1ddcacf09ce916bb0fb74dc07340338c2ede061e091a6abd1` |
| overwrite | `packages/scheduler/src/occurrence.js` | `ef3e4cbefae8db2492c953d150ae9e502fb5c9fd` | `7c5f184e475bf8782c24dd96fc6a9750a6c24b6f7f867621667faecb000de215` |
| overwrite | `packages/scheduler/src/scheduler.js` | `d5aec7af60028f547d87a373a89759cf2676a410` | `0ee7816fb2af7e07ee3a039b91347db0f4fa5acd78052836d497fd875ddda144` |
| overwrite | `packages/scheduler/src/seams.js` | `ed9dbc2229288d7a35909fa6818b8a0344fcf02f` | `ea1c836821ae4e7bb9b50ec075522251c94691de179447d0221085297ee7e2f8` |
| overwrite | `packages/scheduler/src/self-service.js` | `95c9e8d12c6dab06d9281026296a245deef7671a` | `af5ed565131001aedf4d6b3f659d6a0db30a9616c0f2de6adc06dda34ed172f7` |
| create | `packages/scheduler/src/history.js` | `4aff2b28505f7d64de6bd4dacc1e6792eefbb058` | `2f21c7fd366fd08ddd4be621eb2377286a6566bd28f37f2d80b7c78306b0d085` |
| create | `packages/scheduler/src/history-model.js` | `c763fa7d7678d1133d2c212c03a0a7faa05e1523` | `3acaeeba8e734a0cdb8d30724c82188609d77961b022768eaf76246ba881f68d` |
| create | `packages/scheduler/src/history-projection.js` | `51d7675ea79a661d45f301b029018d7e4fead53b` | `59149bbbe9d4c2be02fd55fd04a2d94650dc60c670eddda92fa1e9aeae4ba9c9` |
| create | `packages/scheduler/src/history-sink.js` | `846eabe7e802c7d8bb37014f2976f80739e6aa74` | `7d7469aa57b8566d1279c6e1c13b5c350269a839da80650d962b4955835ba97f` |
| create | `packages/scheduler/src/history-storage.js` | `d039072fb7ae8d6afb055d90bc63f01329251ce9` | `ba742f6f7f30930260835fd77d3af2e3d17723256f6db882d10a24c63b968519` |

Create paths must be absent. Overwrite preimages are freshly sealed after ASM
with hash/bytes/type/owner/group/mode. Post-ASM compose must equal Git blob
`f5c7a8d379a3de020b34d1cdf67992b57dfce361`; its fresh SHA-256 is sealed as a
non-write guard. Release files are non-symlink `root:wheel 0644`.

## 4. Contracts

### CTR-SRD-001 — Reproducible post-ASM artifact

Build twice from clean detached `18f96e2...`; require identical ten-file
manifests. Under the runtime lock fresh-read post-ASM live preimages/compose and
seal release/rollback manifests, source/blob/hash/metadata, native launcher,
root helper, simulator, receipt schema. No secret/env dump. Stale prototype,
source mismatch, symlink/special file, missing rollback byte, or drift stops.

### CTR-SRD-002 — Native serialized transaction

Only Owner-approved macOS native authorization may invoke the helper; no
password input/storage/fallback. Hold `GLOBAL_RUNTIME_LOCK` from first target
read through receipt. Goal ledger, process/receipt census, and Owner attestation
prove no concurrent/ambiguous Agent Core/Auth mutation. Atomically install only
ten rows via no-clobber create or hash-guarded overwrite, fsync, exact metadata,
and readback. No other path changes.

### CTR-SRD-003 — One restart and runtime proof

Restart exactly `system/ai.agent-core.runtime` once. Prove old PID terminated;
one fresh parent PID/start; health; ten hashes; unchanged compose/plist/
credential/workflow/JobStore/legacy digests; zero history-directory creation;
clean new stderr; import-only HistoryStore/access smoke. Create no Job,
occurrence, run, child session, or message during deployment proof.

### CTR-SRD-004 — Equal-face compensation and signals

Post-mutation failure restores five exact preimages, removes create paths only
when hashes equal sealed release, performs exactly one rollback restart, and
proves full post-ASM preface/unrelated invariants. Ambiguous write/restart is
read back, never replayed. After first mutation signals are recorded/deferred
through rollback/receipt; repeats cannot abort/retarget. Drift during cleanup is
`MANUAL_RECOVERY_REQUIRED`, not destructive removal or success.

### CTR-SRD-005 — Bounds and receipt

Lock/dialog/install/restart/health bounds are 30/120/30/90/60 seconds; health
polls at most once/second. Premutation timeout exits unchanged; later timeout
compensates. Atomic root-owned receipt binds Owner, authority/artifact/seal,
manifests, signals, PIDs/restarts, health/smoke/stderr, invariant digests, and
terminal outcome. No individual Gate/dialog/file/PID/health/receipt is success.

### CTR-SRD-006 — Exact one-shot canary

After deployment PASS, with Runtime PID/start unchanged, `agt_efficiency-agent`
in the current trusted Feishu conversation invokes only unified `scheduler`:
`create`, name `15分钟提醒`, `schedule_kind=at`, `at=15m`, message
`⏰ Agent Core Scheduler 自助任务触发成功`, announce/current conversation,
`delete_after_run=true`, `auto_retry=false`. Prove future definition, resident
tick hot reload without restart, exactly one succeeded/delivered occurrence,
visible message, automatic definition deletion, retained evidence, no retry.

### CTR-SRD-007 — Legacy zero-access and non-propagation

Owner runs whole-host `fs_usage -w -f filesystem` before create through
deletion, retaining start/end markers and untruncated zero-exit trace. Prove zero
access at/below `/Users/yanfenma/.openclaw/cron/` and exact before/after
existence/size/mtime/inode/SHA-256. The permanent `scheduler.admin` credential/
token is unnecessary for self canary and must never enter a Job, run, child,
target, message, trace, or receipt.

### CTR-GSRD-001 — Lifecycle only

Acceptance may change only this Spec lifecycle/provenance/banner/footer and
README row, with no
normative semantic delta. No artifact/production byte changes before accepted
exact-head merge and final-head recheck.

## 5. Acceptance

### ACC-SRD-001 — Closure and simulator

- Contracts: `CTR-SRD-001`, `CTR-SRD-004`, `CTR-SRD-005`
- Environment/evidence: two clean worktrees plus disposable filesystem/process/
  signal harness; UTC time, toolchain/source/blob hashes, builds, secret scan,
  every failure boundary and repeated-signal transcript
- Pass/fail: deterministic exact ten rows, complete rollback/bounds/no secret;
  fail on extra path, stale guard, nondeterminism, interruption, ambiguity.

### ACC-SRD-002 — Production deployment

- Contracts: `CTR-SRD-002`, `CTR-SRD-003`
- Environment/evidence: production Mac exact root/launchd; UTC time, Goal/process/
  receipt census, native authorization, manifests, PID/start/restart, health,
  smoke/stderr/invariant digests
- Pass/fail: ten files, one healthy generation, zero business/unrelated change;
  fail on overlap/drift/extra path/restart/mutation/bad metadata/evidence.

### ACC-SRD-003 — Hot-reload canary

- Contracts: `CTR-SRD-006`, `CTR-SRD-007`
- Environment/evidence: production Runtime/current trusted Feishu group; UTC
  time, unchanged PID/start, exact request/result, occurrence/delivery/deletion,
  visible-message coordinate, trace hash/bytes/markers/exit, legacy metadata
- Pass/fail: one delivery, deletion/evidence, no restart/retry/legacy access or
  authority copy; otherwise fail.

### ACC-GSRD-001 — Lifecycle

- Contracts: `CTR-GSRD-001`
- Environment/evidence: clean governance worktree; UTC time, reviewed base/head,
  reviewer/Owner, allowlist diff, verifier, merge ancestry
- Pass/fail: accepted merged exact head, zero semantic drift/early effect;
  otherwise fail.

## 6. Authoring status

```text
SPEC_GOVERNANCE_MODE = AUTHOR
STATUS = proposed
CONTRACT_COUNT = 8
CONTRACTS_WITH_ACCEPTANCE = 8
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
AUTHORING_READY_FOR_REVIEW = YES
PRODUCTION_CHANGE_THIS_ROUND = NONE
```
