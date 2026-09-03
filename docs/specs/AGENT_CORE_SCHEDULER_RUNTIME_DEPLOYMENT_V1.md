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
    revision: 07c8a9c4f7ad1b76dfd1bcfd1cc4a52b9effae00
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
`07c8a9c4f7ad1b76dfd1bcfd1cc4a52b9effae00` is independently reviewed,
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
`cdd3eacf4c52c97c43249e59ffb841cb6e1801cc` with SHA-256
`be869f57ed07b01607dcab88bd36c1b3700062afc04c41095d4a5b774aed1f5a`;
its fresh readback is sealed as a
non-write guard. Release files are non-symlink `root:wheel 0644`.

The minimum static non-write compatibility vector is also a hard Gate
(`path = expected Git blob / SHA-256`):

```text
packages/scheduler/src/control.js = c3d623a487d01e95a5d7149532d490752d1c4949 / 501d1e22f95fc609764bf5d2a9182b0e7dc230583f33a277300d3e4bcf28d4bb
packages/scheduler/src/eligibility.js = 86313158ad9427c622106eb263f58aa6bba6fac9 / cc66fe26cdd688856aaf14698f0130a8b8c22f6806c5c1a60b61466074593cae
packages/scheduler/src/import-openclaw.js = bce4c4dab93a85b7a1ea8f5dfb1a20e79cd839fe / 890ccfabd4203d40eaed3cadb88885c29948db68e5a09ada744df9811a532005
packages/scheduler/src/job-model.js = 066ad9c1485993d9ff8916f89328976fd4a22178 / 25320008e3597a76cc8c5f2b1dec1539d2ece5bf79432de63fcbe61ce3dec040
packages/scheduler/src/lock.js = d681bc583ea056ffe933fbd7b15035eebcbc9092 / 7f725f4289e8f57c97c0ad7987c95e48fa0e0b8660a0ba5b92ba302bd95700f8
packages/scheduler/src/occurrence-model.js = 48b6a54569d5bd7168cf725ac39274565708c04f / 157f3b86d59cfbbc6df61bcd181ba436db1f580fea43d9c6eeea513d3dc146a7
packages/scheduler/src/reconcile.js = 9c89cef22494126f0c9f50b706199f137743f215 / 54424c728d58a939d4a21d0227424f75d3985a1547e89ddff8f64e90ae231ff8
packages/scheduler/src/schedule.js = 9af19a3d88e26d07294976018e5a8d394f1f306e / be487dfe542bb0006ed5a3443c9cacf3fbf67a665451afbd356ca80fb23e1933
packages/scheduler/src/store-migration.js = f8faade6218d85b95c0f22c92b4927900f940f95 / f5647ab196087c279782cb6f2634566fb6b6aec14edb55e4338cb82a84e5db58
packages/scheduler/src/store.js = c77a4bbcf81a3779172942db57bb6d5a0a4212d3 / 208c8a504579a1c84b6cfe1cf8b03478cc4200e2bd260f4c136837c1e55bc8fd
packages/scheduler/package.json = db0838e694f079be12db9ff400420abcf342e366 / c2ca188c4bbcc06b3a1baa31cfd92965cf326b44b2c2f8611927b0da642ec05e
packages/scheduler-router/src/index.js = b1f5563411cb55c8ddc3391d6337a30aea2e0f45 / b8ca13b573edf586dfd90060e05dde6678a793fa9ad032d9e458ffea89548bbe
packages/scheduler-router/package.json = f9642e7e2292dfa2de7260d0a544e0486a91c911 / ae3f42b21de78d61193d9968c8f239fc5648ed816d4045235982c8d86976d80d
packages/broker/src/capabilities/scheduler.js = 39b34b5bbf2cd5a66d08a896242cdd7d1a6580a1 / 1fa5181d399dc7ffe64a5b8f07bd0be70bf69c645d4bac5fbc6286da0bba8b71
packages/broker/src/registry.js = 2f5e55b772e25093b7fec480a76fe47d6993b860 / 628abde2069028c832eb76699ad2dd8521528288f396680d39dffb353d985382
packages/broker/src/mapping.js = 890d35b97700e741b0b6960049b619da03645483 / 6b737ffdeb808f9f2a84896f9b226839c0186aa7b45b64f9473b7aa120df1f08
packages/broker/src/scheduler-validation.js = da7bdf69624af020645c607bad91d6dba4e7b97b / 8c8c532df57a59b5ca2a7f0131fe211a19d4cfced050f1f9aa4cd87f60a598d8
packages/broker/src/index.js = eec8c6f9de6cb8434075fac3c984cf4a7e21f660 / 5a629aa477864b63170dff2d53ccd50f4aa2b9f53efec7df72d95d4d63981e94
packages/broker/src/gateway.js = 68ec4eecf55888fc0eb202c5fe128e3f703ce954 / 984d0d048382b31e87920b3dc85b00c9f12b7aab08a058792c7ba5ae8857e339
packages/broker/src/relay.js = 2ec4acf764d13a53d60050ba22569e51885cab4d / 730e20338544ec36871461f9f7febc43bcd50f195c38f63e0472aa97c3b4983c
packages/production-runtime/src/compose.js = cdd3eacf4c52c97c43249e59ffb841cb6e1801cc / be869f57ed07b01607dcab88bd36c1b3700062afc04c41095d4a5b774aed1f5a
```

The artifact MUST build a synthetic post-ASM tree, overlay only the ten release
rows, and execute a composed proof that the model catalog contains exactly one
`scheduler`, every action schema validates, child relay reaches the Parent
handler, and cross-Agent control reaches exactly
`createSelfServiceSchedulerAccess` → `assertGrant(agentId, scope, resource)`
with `scheduler.admin`; self create reaches the same production JobStore with
zero Auth call. The proof MUST instrument module loading and emit an exhaustive
catalog of every loaded local source/package/config file across catalog, relay,
Parent, self, and admin paths—including credential/transport plumbing. It seals
path/type/blob/SHA-256/bytes for that entire dynamic closure and re-verifies
every row under the production lock immediately before apply; any extra,
missing, or changed loaded row stops. The 21 named rows are mandatory minimums,
not a claim that static inspection alone enumerates the transitive closure.

## 4. State, observations, claims, evidence, decisions

- `STATE-SRD-001` — Accepted Scheduler V2 and History authorities permit their
  exact implementations but retain `production_apply_authority:none`; source
  implementations are merged through `18f96e2...`. Basis: `OBS-SRD-001`,
  `EVD-SRD-001`.
- `STATE-SRD-002` — The present production scheduler face is the 15-file
  pre-history tree captured by the prototype; ASM will change Broker/compose but
  not scheduler files. Basis: `OBS-SRD-002`, `EVD-SRD-002`.
- `STATE-SRD-003` — The candidate selective target is ten writes plus the
  minimum static vector and future exhaustive loaded-source Gate above; its
  sufficiency remains INFERRED until that Gate passes, and history is designed
  to remain dormant. Basis: `OBS-SRD-003`,
  `CLM-SRD-001`, `EVD-SRD-003`.
- `STATE-SRD-004` — The accepted canary requires one self Job and whole-host
  legacy-path evidence after deployment, without restart or Auth. Basis:
  `OBS-SRD-004`, `EVD-SRD-004`.

### OBS-SRD-001 — Accepted lineage and complete history ancestry

- Subject/revision/environment/observed_at: dsh Git objects in this isolated
  worktree, `2026-09-04`; V2 accepted `4c0a623...`, implementation `a420cb6...`,
  release merge `18f96e2...`; History accepted `a291917...`, implementation
  `8343f8f...`, structural refactor `2e54d0a...`, lock fixes `94f4d1a...` and
  `447e5a5...`
- Method/result: ancestry, path/blob, and accepted-closure census; all are
  ancestors/subsumed by `RELEASE_SOURCE`, while both parent Specs reserve deploy.

### OBS-SRD-002 — Current production face and stale prototype

- Subject/revision/environment/observed_at: `/usr/local/libexec/agent-core/app`,
  production Mac, read-only census prepared `2026-09-03` and refreshed during
  authoring `2026-09-04`
- Method/result: 15 scheduler source files; five future history paths absent;
  prototype census SHA-256
  `1424701f6fdad9d0a2e47dca0121ef0ad0cba9a1bb46dc2214e0f9f53abf6572`.
  Its pre-ASM compose guard/terminal-sudo launcher make it non-executable here.
- Limitation: ASM changes compose/Broker later, so the apply artifact must
  fresh-read and seal the exact post-ASM vector rather than inherit this census.

### OBS-SRD-003 — Ten-file necessity and post-ASM compatibility

- Subject/revision/environment/observed_at: exact Git blobs in §3 plus accepted
  ASM V2 release blob `cdd3eacf...`, isolated worktree, `2026-09-04`
- Method/result: import/reverse-dependency inspection. Five overwrites carry
  History integration and exact wire scopes; occurrence imports history-sink,
  requiring five creates. Post-ASM compose retains the trusted
  `assertGrant(agentId,scope,resource)` seam and does not mount history.
- Limitation: static sufficiency is conditional on the required synthetic
  overlay/catalog/relay/composed proof in `CTR-SRD-001`.

### OBS-SRD-004 — Accepted production canary contract

- Subject/revision/environment/observed_at: Scheduler V2
  `4c0a623.../CTR-HOT-001/CTR-CANARY-001`, Git worktree, `2026-09-04`
- Method/result: authority inspection freezes exact one-shot request, current
  trusted Feishu conversation, stable Runtime PID, delivery/deletion/evidence,
  and whole-host `fs_usage` legacy exclusion.

### CLM-SRD-001 — Selective activation is sufficient but history stays dormant

- Support state: INFERRED.
- Support: `EVD-SRD-003` relates the exact import/dependency inspection to this
  claim; the synthetic proof required by `CTR-SRD-001` is a future conformance
  Gate and is not misclassified as present authoring evidence.
- Uncertainty: no production behavior is claimed until the post-ASM artifact
  proof and target-bound deployment/canary receipts pass.

- `EVD-SRD-001` — source `OBS-SRD-001`; target `STATE-SRD-001`; relation
  SUPPORTS; coordinates the exact commits above; environment isolated dsh Git
  worktree; provenance local Git object database and the two accepted Specs;
  conclusive for lineage/authority gap, not runtime behavior.
- `EVD-SRD-002` — source `OBS-SRD-002`; target `STATE-SRD-002`; relation
  SUPPORTS; coordinates prototype manifest/census hashes and exact live root;
  environment production Mac read-only census; provenance prototype artifact;
  strong historical preface, intentionally stale after ASM.
- `EVD-SRD-003` — source `OBS-SRD-003`; target `CLM-SRD-001`; relation SUPPORTS;
  coordinates all ten mutation and now 21 non-write blobs; environment isolated
  dsh worktree plus read-only live blob census; provenance Git objects, accepted
  ASM V2 §4, and prototype manifest; sufficient for INFERRED design selection,
  not execution—the synthetic proof remains a mandatory conformance Gate.
- `EVD-SRD-004` — source `OBS-SRD-004`; target `STATE-SRD-004`; relation
  SUPPORTS; coordinates accepted Contract IDs and exact V2 acceptance commit;
  environment isolated dsh worktree; provenance Scheduler V2 Spec; conclusive
  for canary shape, not future production execution.

### DEC-SRD-001 — Rebuild after ASM; never reuse the prototype

Select a fresh native-gated artifact with post-ASM guards. Reject the stale
prototype, terminal sudo, checkout copy, and compose deployment.

### DEC-SRD-002 — Ten writes plus static and dynamic compatibility closure

Select the minimum import-complete ten-file set, freeze the named static vector,
then seal/reverify the exhaustive instrumented loaded-source closure. Reject a
static-list-only claim, dormant partial copy without imported modules, and
broader history-runtime activation.

### DEC-SRD-003 — Separate deployment smoke from the one business canary

Deployment proof is import-only with one restart and zero Jobs; after PASS, the
accepted self one-shot is the sole Scheduler business mutation and uses hot
reload with no restart/Auth request.

## 5. Contracts

### CTR-SRD-001 — Reproducible post-ASM artifact

Build twice from clean detached `18f96e2...`; require identical ten-file
manifests. Under the runtime lock fresh-read post-ASM live preimages/compose and
seal release/rollback manifests, source/blob/hash/metadata, native launcher,
root helper, simulator, receipt schema. No secret/env dump. Stale prototype,
source mismatch, symlink/special file, missing rollback byte, or drift stops.
The artifact MUST verify every §3 non-write vector row and run the required
synthetic post-ASM overlay proof for single catalog registration, schema
validation, child relay, Parent handler, exact admin `assertGrant` mapping, and
self-operation zero-Auth JobStore path. It MUST record the full History ancestry
including `2e54d0a...`; an import-only smoke cannot substitute for this proof.
The synthetic proof's instrumented exhaustive loaded-source catalog MUST be
sealed and every row reverified under the production lock immediately before
apply as required by §3; no unsealed loaded local dependency is allowed.

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
`action=create`, `name=15分钟提醒`, `schedule_kind=at`, `at=15m`, `message=`
`⏰ Agent Core Scheduler 自助任务触发成功`, announce/current conversation,
`delivery_mode=announce`, `delivery_target=current_conversation`,
`delete_after_run=true`, `auto_retry=false`. No omitted/defaulted substitute is
accepted. Prove future definition, resident
tick hot reload without restart, exactly one succeeded/delivered occurrence,
visible message, automatic definition deletion, retained evidence, no retry.
Correlation-bound Parent instrumentation plus Auth access-log delta MUST prove
exactly zero `assertGrant`, OAuth/token, credential-store read, or other Auth
request for this self operation. Any such access fails the canary.

### CTR-SRD-007 — Legacy zero-access and non-propagation

Owner runs whole-host `fs_usage -w -f filesystem` before create through
deletion through the same native authorization-dialog/no-password/no-fallback
boundary as deployment, retaining start/end markers and untruncated zero-exit
trace. Prove directory-wide zero access at/below
`/Users/yanfenma/.openclaw/cron/`; separately prove exact before/after
existence/size/mtime/inode/SHA-256 for
`/Users/yanfenma/.openclaw/cron/jobs.json`. The trace also proves zero access to
`/usr/local/libexec/agent-core/config/agent-credentials.json` in the canary
window. The permanent `scheduler.admin` credential/
token is unnecessary for self canary and must never enter a Job, run, child,
target, message, trace, or receipt.

### CTR-GSRD-001 — Lifecycle only

Acceptance may change only this Spec lifecycle/provenance/banner/footer and
README row, with no
normative semantic delta. No artifact/production byte changes before accepted
exact-head merge and final-head recheck.

## 6. Acceptance

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
  Auth/credential access or authority copy; otherwise fail.

### ACC-GSRD-001 — Lifecycle

- Contracts: `CTR-GSRD-001`
- Environment/evidence: clean governance worktree; UTC time, reviewed base/head,
  reviewer/Owner, allowlist diff, verifier, merge ancestry
- Pass/fail: accepted merged exact head, zero semantic drift/early effect;
  otherwise fail.

## 7. Authoring status

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
