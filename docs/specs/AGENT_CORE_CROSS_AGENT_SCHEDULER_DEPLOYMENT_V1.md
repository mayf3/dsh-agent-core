---
spec_id: AGENT_CORE_CROSS_AGENT_SCHEDULER_DEPLOYMENT_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: contracts
date: 2026-09-04
revision: r1
scope:
  - exact scheduler-only production runtime deployment
  - bounded restart, runtime proof, and equal-face rollback
governed_by:
  - AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2
  - AGENT_CORE_SCHEDULER_RUN_HISTORY_V1
external_authorities:
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_SCHEDULER_AUDIENCE_CCR_V1
    revision: 687c3b1eb3c671b1b4edf343fe96c07e9f00f92a
    relation: prerequisite
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_SCHEDULER_BUNDLE_1_7_DEPLOYMENT_V1
    revision: 15d246f2b17cffc6d8cc343d3bb148d8034d0493
    relation: prerequisite
supersedes: []
superseded_by: null
owners: [mayf3]
---

# AGENT_CORE_CROSS_AGENT_SCHEDULER_DEPLOYMENT_V1

> **PROPOSED / NON-AUTHORITATIVE.** This docs-only proposal authorizes no
> artifact rewrite, file install, restart, Grant, scheduled job, or production
> mutation until independent exact-head review, explicit Owner acceptance,
> lifecycle finalization, and merge to `main`.

## 1. Goal

Deploy the exact scheduler-only release at
`18f96e25af623c1547956ee00447a664a7fba741` into the existing Agent Core
runtime without deploying its incompatible `production-runtime` tree. Preserve
all existing jobs and keep run-history storage dormant. End with a fresh healthy
runtime process and exact ten-file readback, or restore the complete preimage.

## 2. Scope and non-goals

In scope: five exact overwrites, five exact no-clobber creates under
`packages/scheduler/src`, one restart of `system/ai.agent-core.runtime`, import
smoke, log-delta/readback proof, durable receipt, and compensated rollback.

Out of scope: `packages/production-runtime/**`, compose/config/plist changes,
history storage activation, Scheduler Grant creation, job creation/execution,
job-store rewrite, Auth DB mutation, credential access, fleet rollout, or any
source later than the pinned release.

## 3. Authority and state

```text
AUTHORING_BASE = 379ef227052752a473f6b105d8726e343d2d7f92
RELEASE_COMMIT = 18f96e25af623c1547956ee00447a664a7fba741
LIVE_ROOT = /usr/local/libexec/agent-core/app
TARGET_DIR = packages/scheduler/src
COMPOSE_GUARD_SHA256 = 54a0353c3d00e9207712d045f8226f89ae936896c20bb005921898a90fad9a79
LAUNCHD_TARGET = system/ai.agent-core.runtime
ARTIFACT_V1 = /Users/yanfenma/workspace/deployment-artifacts/scheduler-runtime-deploy
ARTIFACT_V1_MANIFEST_SHA256 = 9bd8245ef1511bbced7d346ac98ff237e78dd59b4190e76061a6b2f6203a7ccc
ARTIFACT_V1_PREIMAGE_SHA256 = 1424701f6fdad9d0a2e47dca0121ef0ad0cba9a1bb46dc2214e0f9f53abf6572
ARTIFACT_V1_RUNNER_SHA256 = 6240bd0c0f5f835a02efd671dbf3427fe67cbbbed55a7e9d189dc15b311e4c37
ARTIFACT_STATE = REUSABLE_BYTES_NEEDS_AUTHORITY_REWRAP
PRODUCTION_STATE = UNCHANGED
```

The accepted product Specs authorize implementation but retain
`production_apply_authority: none`; this child is the missing deployment
authority. Auth 1.7 deployment is an external prerequisite, not locally owned.

## 4. Observations

- `OBS-SCD-001` — At `2026-09-04`, Git inspection binds the accepted scheduler
  implementation to release `18f96e25...`; the production-runtime tree at that
  revision is not compatible with the current live tree and is excluded.
- `OBS-SCD-002` — Fresh read-only invocation of artifact V1 `CHECK` returned
  `CHECK_ALL_OK=true`; its five overwrite preimages, five create absences,
  compose guard, plist guard, and module import smoke still match production.
- `OBS-SCD-003` — Artifact V1 is not itself executable authority: its manifest
  names an earlier Goal, its prerequisites are not enforced, it has no global
  mutation lock or closed receipt schema, and its non-root path can be modified.

## 5. Claims

- `CLM-SCD-001` — SUPPORTED: the exact ten-file scheduler delta is the narrowest
  deployable closure and loads against current live dependencies. Runtime proof
  remains required after restart.
- `CLM-SCD-002` — SUPPORTED: V1 staged release/preimage bytes can be reused only
  as sealed inputs to a new accepted-authority wrapper; direct execution is not
  authorized.

## 6. Evidence

- `EVD-SCD-001` — `OBS-SCD-001` SUPPORTS `CLM-SCD-001`; coordinates release
  `18f96e25...`, accepted Specs, and exact Git blobs; limitation: not live proof.
- `EVD-SCD-002` — `OBS-SCD-002/003` SUPPORT `CLM-SCD-002`; coordinates artifact
  hashes and fresh CHECK; limitation: every preimage must be reread under lock.

## 7. Decisions

- `DEC-SCD-001` — Select scheduler-only deployment; reject the incompatible
  current-release compose/runtime closure.
- `DEC-SCD-002` — Keep HistoryStore code present but unwired (`deps.history=null`);
  reject config or persistent-history activation in this round.
- `DEC-SCD-003` — Rewrap the reusable bytes behind a native Owner gate and
  closed transaction; reject direct V1 execution and terminal sudo prompting.

## 8. Contracts

### CTR-SCD-001 — Exact release set

The only file mutations are:

| Action | Path | Before SHA-256 | After SHA-256 |
|---|---|---|---|
| overwrite | `index.js` | `aaf939bde3671281227b5e31d24f15c47353c9f2824a4dbd76a3ec17b60173df` | `eb2f0c1d82a716b1ddcacf09ce916bb0fb74dc07340338c2ede061e091a6abd1` |
| overwrite | `occurrence.js` | `878080beeee83388b2975988cbf833d990d72d6ea74f6c486013b9fd1f3b2cb2` | `7c5f184e475bf8782c24dd96fc6a9750a6c24b6f7f867621667faecb000de215` |
| overwrite | `scheduler.js` | `e934f5fdf514f7e265e3a6edaaa9102157b69173e7c1c0cec16668b5282180e3` | `0ee7816fb2af7e07ee3a039b91347db0f4fa5acd78052836d497fd875ddda144` |
| overwrite | `seams.js` | `6a622503c9634565616154440e0de60df74acc8e37dcf02a84059e3a9639fb77` | `ea1c836821ae4e7bb9b50ec075522251c94691de179447d0221085297ee7e2f8` |
| overwrite | `self-service.js` | `dd4daf9f599a48bf6ecb715a334fd9d2b9337b80ad21cfd3b05ca8296719ac08` | `af5ed565131001aedf4d6b3f659d6a0db30a9616c0f2de6adc06dda34ed172f7` |
| create | `history.js` | absent | `2f21c7fd366fd08ddd4be621eb2377286a6566bd28f37f2d80b7c78306b0d085` |
| create | `history-model.js` | absent | `3acaeeba8e734a0cdb8d30724c82188609d77961b022768eaf76246ba881f68d` |
| create | `history-projection.js` | absent | `59149bbbe9d4c2be02fd55fd04a2d94650dc60c670eddda92fa1e9aeae4ba9c9` |
| create | `history-sink.js` | absent | `7d7469aa57b8566d1279c6e1c13b5c350269a839da80650d962b4955835ba97f` |
| create | `history-storage.js` | absent | `ba742f6f7f30930260835fd77d3af2e3d17723256f6db882d10a24c63b968519` |

All paths are relative to `LIVE_ROOT/TARGET_DIR`. The other ten existing
scheduler files, compose guard, plist, config, jobs, credentials, and all other
paths must remain byte-equivalent. Every installed file is regular
`root:wheel 0644`; symlinks and special files stop.

### CTR-SCD-002 — Post-accept immutable artifact

After this Spec is accepted and merged, construct exactly
`/Users/yanfenma/workspace/deployment-artifacts/scheduler-runtime-deploy-v2`.
It may reuse V1's five release and five preimage payloads only after matching
the hashes above. Its exhaustive closure is: those ten release payloads, five
preimage payloads, one exact manifest/catalog, one canonical
`RUN_SCHEDULER_RUNTIME_DEPLOY_OWNER.sh`, one read-only checker, and SHA-256 lists;
no other file. Manifest rows bind path/type/bytes/mode/hash and source Git blob.
Inputs are read-only regular files; no secret, credential, token, environment,
job data, log content, symlink, or special file is allowed.

The canonical runner and inputs are copied to a nonce-scoped
`/private/var/root/agent-core-scheduler-deploy-v1-*` directory owned
`root:wheel 0700`; data are regular `0600`, runner `0700`. Only an
Owner-approved macOS native authorization dialog may launch it as root. It must
not invoke `sudo`, accept a password fallback, or execute from the user-owned
artifact directory.

### CTR-SCD-003 — Gates and serialization

Before mutation, prove: this exact accepted semantic body/merge/final-head PASS;
Lane B terminal `PRODUCTION_READY` with permanent ASM permission active; Auth
Scheduler bundle exact `15d246f...` accepted/merged and production PASS; no
Scheduler permanent Grant yet; V1 and V2 seals; fresh exact live preimages;
compose/plist/other-file invariants; launchd state/PID/start time; job-store hash;
and no incomplete/ambiguous participant receipt.

Acquire `/var/run/agent-core-production-mutation.lock` before the first target
read and hold it through receipt publication. Also acquire the shared
`/var/run/auth-service-production-mutation.lock` in fixed order (Auth lock first,
then Agent Core lock) so this restart cannot overlap the Scheduler Auth deploy or
permanent-Grant phases. Lock acquisition is bounded to 30 seconds; contention or
drift stops before mutation. No automatic retry is allowed.

### CTR-SCD-004 — Bounded apply and runtime proof

Install the ten files atomically from root-owned sealed inputs, with create
operations no-clobber and overwrite operations guarded by fresh hashes. Fsync
files/directories, prove the exact twenty-file scheduler catalog and unchanged
compose guard, then restart `system/ai.agent-core.runtime` exactly once. Prove
old PID termination, fresh PID/start time, running state, import of the scheduler
index with `HistoryStore` and exactly 69 exports, no new fatal module/syntax log
delta, unchanged job-store bytes, no new job/occurrence/history storage, and
HistoryStore unwired. Bounds: native dialog 120 seconds; install 30 seconds;
stop/start 30/90 seconds; proof 60 seconds with at most one poll per second.

### CTR-SCD-005 — Reconcile and rollback

After any signal, interruption, timeout, or failed proof, enter read-only
reconciliation under both locks. Classify every target file as exact preimage,
exact release, or unknown; bind loaded job, PID/start time, receipt, staging, and
logs. `PRESTATE` (all preimage, creates absent, old healthy) stops unchanged.
`PARTIAL_INSTALL` (only exact preimage/release faces) restores all overwrites and
removes only exact-hash creates, then performs exactly one restart because the
old process may have loaded changed modules. `FORWARD_STARTED_UNVERIFIED`
(all release plus new/absent PID but incomplete proof) restores the same way and
restarts old exactly once. `FORWARD_ACTIVE` is success only when every runtime
proof passed. `COMPENSATED` is read-only terminal. Any unknown hash, process,
loaded-job, or receipt face is `OUTCOME_UNKNOWN`: no write/restart/replay and
manual recovery. Staging is removed only by exact sealed catalog; otherwise it
remains quarantined. Rollback proves full preimage, absent five creates, fresh
healthy PID, unchanged jobs/compose/plist/config, and durable receipt.

Signals are deferred from immediately before the first file-write attempt until
success/compensation receipt. Repeated signals do not change the action. A
missing receipt forces reconciliation-only on the next invocation.

### CTR-SCD-006 — Durable receipt and no overclaim

Publish exactly one atomic regular non-symlink `root:wheel 0600` JSON receipt in
the root staging directory. Exact keys: `schema_version`, `outcome`,
`correlation_id`, `started_at`, `finished_at`, `authority_spec`,
`authority_semantic_head`, `artifact_manifest_sha256`, `runner_sha256`,
`authorization_method`, `lock_identities`, `old_pid`, `new_pid`,
`preimage_catalog_sha256`, `postimage_catalog_sha256`, `compose_sha256`,
`plist_sha256`, `jobs_sha256_before`, `jobs_sha256_after`, `restart_counts`,
`runtime_checks`, `signal_events`, and `evidence_sha256`. Closed outcomes are
`STOPPED_PREMUTATION|FORWARD_ACTIVE|COMPENSATED|OUTCOME_UNKNOWN|MANUAL_RECOVERY_REQUIRED`.
Only `FORWARD_ACTIVE` can support Scheduler runtime readiness. A dialog, install,
restart, import smoke, or receipt alone is not success.

### CTR-GSCD-001 — Lifecycle boundary

Acceptance may change only: (1) frontmatter `status: proposed -> accepted`; (2)
add `accepted_date`, `accepted_by`, `accepted_at`, `accepted_reviewed_base`,
`accepted_reviewed_head`, `independent_review_result`,
`independent_review_blockers`, `acceptance_verdict`,
`acceptance_semantic_delta`, and `acceptance_authority_basis`; (3) replace the
opening banner with exactly:

```text
> **ACCEPTED / PRODUCTION DEPLOYMENT AUTHORITY.** Accepted by `mayf3` at the
> exact independently reviewed base/head recorded in frontmatter. Contracts
> become active only after this lifecycle commit merges to `main`; every Gate,
> native authorization, rollback, and runtime proof remains mandatory.
```

(4) authoring footer `STATUS: proposed -> accepted` and
`OPEN_OWNER_DECISIONS: EXACT_HEAD_ACCEPTANCE -> NONE`, leaving its production-
authority line byte-identical; and (5) README row Current lifecycle only
`proposed -> accepted`. Every other byte remains identical. Added values bind
exact base/head, reviewer identity/result/blockers, Owner identity/time/decision,
`acceptance_verdict: accepted`, and
`acceptance_semantic_delta: none_after_review`. Final-head check and merge
precede artifact construction or apply.

## 9. Acceptance

- `ACC-SCD-001` (`CTR-SCD-001/002`): two clean artifact builds are byte-identical;
  exact closure/catalog/seals pass; secret/extra/symlink/writable-input tests deny.
- `ACC-SCD-002` (`CTR-SCD-003/004`): isolated harness and locked read-only CHECK
  prove prerequisites, no overlap, exact 10-file plan, one restart, 69-export
  import, unchanged jobs/compose/plist, and dormant history.
- `ACC-SCD-003` (`CTR-SCD-005/006`): failure injection at every file/restart/
  health/receipt/signal boundary proves closed classification, exact compensation,
  no blind replay, correct restart count, and honest unknown outcome.
- `ACC-GSCD-001`: independent exact-head review, Owner acceptance, exhaustive
  lifecycle diff, final-head recheck, and merge ancestry; no early production.

## 10. Migration, compatibility, and rollback

This is an in-place scheduler module migration only. Existing job schemas,
jobs.json, occurrence semantics, runtime compose, configuration, and APIs remain
compatible. New history modules are dormant. Rollback restores the exact fifteen-
file preimage and restarts once; unknown state never triggers guessed deletion.

## 11. Alternatives

- Deploy all of `18f96e25...`: rejected; live production-runtime dependencies
  are absent and would crash.
- Directly run artifact V1: rejected; authority, native gate, locks, and receipt
  are incomplete.
- Activate history now: rejected; it requires a separate wiring/config authority.

## 12. Open questions and authoring status

```text
SPEC_GOVERNANCE_MODE = AUTHOR
STATUS = proposed
IMPLEMENTATION_AUTHORITY = contracts
PRODUCTION_APPLY_AUTHORITY = contracts (inactive until accepted and merged)
OPEN_OWNER_DECISIONS = EXACT_HEAD_ACCEPTANCE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 7
CONTRACTS_WITH_ACCEPTANCE = 7
AUTHORING_READY_FOR_REVIEW = YES
PRODUCTION_CHANGE_THIS_ROUND = NONE
```
