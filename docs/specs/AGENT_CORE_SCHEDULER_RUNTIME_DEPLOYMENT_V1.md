---
spec_id: AGENT_CORE_SCHEDULER_RUNTIME_DEPLOYMENT_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: contracts
date: 2026-09-04
revision: r1
scope: [scheduler-runtime-selective-deployment, production-cross-agent-one-shot-canary]
governed_by:
  - AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2
  - AGENT_CORE_SCHEDULER_RUN_HISTORY_V1
  - SCHEDULER_OCCURRENCE_OUTCOME_V2
  - SCHEDULER_TIMEOUT_OUTCOME_V2
external_authorities:
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_SCHEDULER_BUNDLE_1_7_DEPLOYMENT_V1
    revision: c708b37cbfa1e577f80da40439bf18cfc259c84d
    relation: depends_on
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_DAILY_AUTONOMY_OPERATIONAL_GRANTS_V1
    revision: 5e8b391339da0d03474f708debab2c7138259360
    relation: interoperates_with
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
Runtime, pause for the exact Phase-C operational Grant, then run exactly one
cross-Agent one-shot canary required by `CORE_RUNTIME_DAILY_AUTONOMY_OVERNIGHT_V1`.

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
AUTH_MUTATION_LOCK = /var/run/auth-service-production-mutation.lock
GLOBAL_RUNTIME_LOCK = /var/run/agent-core-production-mutation.lock
SCHEDULER_ENGINE_LOCK = /Users/authsvc/.agent-core/scheduler/jobs.json.engine.lock
ARTIFACT_V2 = /Users/yanfenma/workspace/deployment-artifacts/scheduler-runtime-deploy-v2
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

The runtime-deployment stage begins only after: this Spec
accepted/merged/final-head PASS; accepted ASM
Deployment V2 exact semantic head `e225d7b...` has terminal Stage B/D/E and temp
Grant compensation PASS; Auth Scheduler 1.7 exact semantic head `c708b37...` is
byte-equivalent apart from its declared lifecycle-only acceptance to an
accepted/merged descendant and has production PASS; permanent-Grant semantic
head `5e8b391339da0d03474f708debab2c7138259360` is independently reviewed and
accepted/merged, with its Phase B terminal and exact permanent
`agent.session.send` live, but Phase C `scheduler.admin` not yet applied. The
sole Runtime is healthy; no production
transaction is active/authorized for the window/outcome-ambiguous; and fresh
post-ASM preimages match. Any unmet or drifted condition stops unchanged. After
the runtime receipt is terminal `FORWARD_ACTIVE`, Auth Phase C may add the exact
permanent `scheduler.admin` row. Only after its terminal `C_ACTIVE` receipt may
this Spec's canary stage execute. Thus the single order is Lane B terminal →
Auth 1.7 → Runtime deployment → Phase C Grant → one cross-Agent canary; no stage
waits on its own downstream result.

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
- `STATE-SRD-004` — The Master Goal requires exactly one cross-Agent Job from
  the authorized orchestrator to a safe target fresh non-main session after
  runtime deployment and Phase C Grant, with whole-host legacy-path evidence.
  Basis:
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

### OBS-SRD-004 — Governing production canary contract

- Subject/revision/environment/observed_at: `CORE_RUNTIME_DAILY_AUTONOMY_OVERNIGHT_V1`
  plus Scheduler V2 wire contracts, Git worktree, `2026-09-04`
- Method/result: the Goal freezes one disposable `at` Job created through
  `scheduler.admin`, correct target Agent, fresh non-main session, exactly one
  occurrence/run, target-owned identity/credential, no privilege propagation,
  cleanup/retained evidence, and whole-host legacy-path exclusion. The older
  self-only canary shape is not used in this Goal.

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

### DEC-SRD-003 — Separate deployment smoke from the one cross-Agent canary

Deployment proof is import-only with one restart and zero Jobs. Auth Phase C
then activates the one exact orchestrator Grant. Only afterward does the sole
Scheduler business mutation create one cross-Agent `at` Job; no self-only Job
is also created.

## 5. Contracts

### CTR-SRD-001 — Reproducible post-ASM artifact

Build twice from clean detached `18f96e2...`; require identical artifacts at
exactly `ARTIFACT_V2`. Its closure is exactly ten release payloads, five
overwrite preimages, `ARTIFACT_MANIFEST.json`, `RELEASE_SHA256.txt`,
`PREIMAGE_SHA256.txt`, `RUN_SCHEDULER_RUNTIME_DEPLOY_OWNER.sh`,
`CHECK_SCHEDULER_RUNTIME_DEPLOY.sh`, and
`SIMULATE_SCHEDULER_RUNTIME_DEPLOY.sh`; no other path. The manifest schema is
exactly `{schema_version,authority,release_commit,target,files,loaded_sources,locks,timeouts,receipt_schema}`;
every row binds relative path, action, type, byte count, mode, SHA-256, and Git
blob where applicable. Under both locks fresh-read post-ASM live
preimages/compose and seal release/rollback manifests, source/blob/hash/metadata,
native launcher, root helper, simulator, receipt schema. No secret/env dump. Stale prototype,
source mismatch, symlink/special file, missing rollback byte, or drift stops.
The artifact MUST verify every §3 non-write vector row and run the required
synthetic post-ASM overlay proof for single catalog registration, schema
validation, child relay, Parent handler, exact admin `assertGrant` mapping, and
self-operation zero-Auth JobStore path. It MUST record the full History ancestry
including `2e54d0a...`; an import-only smoke cannot substitute for this proof.
The synthetic proof's instrumented exhaustive loaded-source catalog MUST be
sealed and every row reverified under the production lock immediately before
apply as required by §3; no unsealed loaded local dependency is allowed.
Two clean builds, a secret/extra-path scan, fresh read-only CHECK, and the full
simulator MUST pass before an Owner execution packet may be formed.

### CTR-SRD-002 — Native serialized transaction

Only Owner-approved macOS native authorization may invoke the helper; no
password input/storage/fallback. Before any artifact code executes, a literal
bootstrap made only from `/bin` and `/usr/bin` tools creates a nonce-scoped
`/private/var/root/agent-core-scheduler-deploy-v1-<nonce>` directory as
`root:wheel 0700`, copies the externally reviewed manifest and every input
without following symlinks, and verifies source/destination device, inode,
link-count, type, owner, group, mode, bytes, and SHA-256. Data are root:wheel
0600 and the runner 0700. A separate native authorization may execute only that
sealed root-owned runner by its frozen external digest. User-owned artifact code
never executes as root.

Acquire `AUTH_MUTATION_LOCK` then `GLOBAL_RUNTIME_LOCK` before the first target
read and hold both through terminal receipt publication. Each is opened without
symlink following and must remain a regular `root:wheel 0600` file with stable
device/inode/link-count. Acquisition is bounded to 30 seconds; no retry. Goal
ledger, process/receipt census, and Owner attestation prove no concurrent or
ambiguous Agent Core/Auth participant. Atomically install only ten rows via
no-clobber create or hash-guarded overwrite, fsync file and parent directory,
prove exact metadata/readback, and change no other path.

The only non-secret output is the atomic regular `root:wheel 0644` file
`/private/var/tmp/agent-core-scheduler-deploy-v1/<nonce>.result.json`, beneath an
exclusively created root:wheel 0755 parent, with exact scalar keys
`schema_version,nonce,correlation_id,outcome,receipt_sha256,transaction_journal_sha256,event_details_sha256,publication_journal_sha256,finished_at`.
UUIDs are lowercase, times RFC3339 UTC, hashes lowercase 64-hex; only
`receipt_sha256` may be null after bounded publication failure. stdout/stderr
are sanitized and never carry logs, inputs, secrets, or credentials.

### CTR-SRD-003 — One restart and runtime proof

Before stop, require no in-flight occurrence, unresolved/ambiguous run,
already-due slot, or next due slot through the 300-second worst-case deployment
window. Stop the exact old PID, acquire `SCHEDULER_ENGINE_LOCK` through the
accepted OwnerLock primitive, re-read the census and JobStore hash, and release
that engine lock only immediately before the new start. A failed/uncertain stop
while the old PID remains healthy performs zero restart; after confirmed stop
but before a write, failure starts the unchanged old runtime once. No Job is
edited to manufacture quiescence. Any later JobStore change forbids success and
enters the closed reconcile classifier.

Restart exactly `system/ai.agent-core.runtime` once. Prove old PID terminated;
one fresh parent PID/start; health; ten hashes; unchanged compose/plist/
credential/workflow/JobStore/legacy digests; zero history-directory creation;
clean new stderr; import-only HistoryStore/access smoke. Create no Job,
occurrence, run, child session, or message during deployment proof.

### CTR-SRD-004 — Equal-face compensation and signals

Post-mutation failure restores five exact preimages, removes create paths only
when hashes equal sealed release, performs exactly one rollback restart, and
proves full post-ASM preface/unrelated invariants. Ambiguous write/restart is
read back, never replayed. A root-owned fsynced transaction journal records
`INIT,PRECHECK_PASS|PRECHECK_FAIL,STOP_BEGIN,STOP_CONFIRMED,QUIESCENCE_PASS,WRITE_BEGIN,FILE_INSTALLED,INSTALL_PASS,START_BEGIN,START_CONFIRMED,PROOF_PASS,SIGNAL,COMPENSATION_BEGIN,FILE_RESTORED,COMPENSATION_START_CONFIRMED,COMPENSATION_PASS`.
Each canonical JSONL record has exact keys
`schema_version,sequence,previous_sha256,event,at,correlation_id,details_sha256`;
sequence begins at 1, genesis previous hash is 64 zeroes, and later records hash
the preceding exact UTF-8 line without newline. A companion root-owned 0600
`EVENT_DETAILS.jsonl` has exactly one same-sequence/event record whose canonical
details hash equals `details_sha256`. Install ordinals are 1..10 in manifest
order; restore ordinals are only mutated targets in strict reverse order.
The exact root output closure is `TRANSACTION_JOURNAL.jsonl`,
`EVENT_DETAILS.jsonl`, `PUBLICATION_JOURNAL.jsonl`, `RECEIPT.json` or its one
failed temp, and nothing else; every file is regular non-symlink root:wheel 0600.
Canonical details have these exact keys: `INIT` =
`nonce,artifact_manifest_sha256,authority_semantic_head`;
`PRECHECK_PASS|PRECHECK_FAIL` =
`preimage_catalog_sha256,jobs_sha256,old_pid,result_code`; `STOP_BEGIN` =
`old_pid`; `STOP_CONFIRMED` = `old_pid,stopped_at`; `QUIESCENCE_PASS` =
`jobs_sha256,next_due_at,in_flight_count,unresolved_count,engine_lock_token_sha256`;
`WRITE_BEGIN` = `target_count`; `FILE_INSTALLED|FILE_RESTORED` =
`ordinal,path,action,before_sha256,after_sha256`; `INSTALL_PASS` =
`postimage_catalog_sha256`; `START_BEGIN` = `intended_face`;
`START_CONFIRMED|COMPENSATION_START_CONFIRMED` = `pid,started_at`;
`PROOF_PASS|COMPENSATION_PASS` =
`catalog_sha256,jobs_sha256,compose_sha256,plist_sha256,launchd_running,import_export_count,fatal_log_delta_count,history_storage_created_count,job_occurrence_delta_count`;
`SIGNAL` = `signal,after_event`; and `COMPENSATION_BEGIN` =
`reason,from_event`. Extra/missing keys or evidence lines are corruption.

Ignoring `SIGNAL` self-loops, legal transaction paths are exactly:

```text
INIT -> PRECHECK_FAIL
INIT -> PRECHECK_PASS -> STOP_BEGIN -> STOP_CONFIRMED -> QUIESCENCE_PASS
QUIESCENCE_PASS -> WRITE_BEGIN -> FILE_INSTALLED{1..10} -> INSTALL_PASS
INSTALL_PASS -> START_BEGIN -> START_CONFIRMED -> PROOF_PASS
PROOF_PASS -> COMPENSATION_BEGIN
STOP_CONFIRMED|QUIESCENCE_PASS|WRITE_BEGIN|FILE_INSTALLED|INSTALL_PASS|START_BEGIN|START_CONFIRMED
  -> COMPENSATION_BEGIN
COMPENSATION_BEGIN -> FILE_RESTORED{0..10} -> START_BEGIN
  -> COMPENSATION_START_CONFIRMED -> COMPENSATION_PASS
```

`INIT`, `PRECHECK_FAIL`, `PRECHECK_PASS`, and `STOP_BEGIN` are legal prestop
terminal prefixes when the old PID remains healthy. A compensation resume
continues only the uncompleted, hash-guarded suffix. After first mutation,
signals are journaled/deferred through rollback/receipt; repeats cannot abort or
retarget. Unknown face, invalid edge/hash/ordinal, or drift during cleanup is
`OUTCOME_UNKNOWN`/`MANUAL_RECOVERY_REQUIRED`, never guessed deletion, restart,
or success.

### CTR-SRD-005 — Bounds and receipt

Lock/dialog/install/restart/health bounds are 30/120/30/90/60 seconds; health
polls at most once/second. Premutation timeout exits unchanged; later timeout
compensates. Reconcile under both locks uses this exhaustive precedence:

| Priority | Exact face | Sole action |
|---|---|---|
| 1 | valid receipt and matching recorded state | return same outcome read-only |
| 2 | receipt contradicts state/journal/proof | no mutation; `OUTCOME_UNKNOWN` |
| 3 | no journal/receipt, exact preimage, old healthy, jobs exact | forward may begin |
| 4 | legal prestop prefix, exact preimage, old healthy, jobs exact | zero restart; `STOPPED_PREMUTATION` |
| 5 | stopped before write, exact preimage/jobs, no PID | start old once; `QUIESCENCE_ABORTED` |
| 6 | `COMPENSATION_PASS`, exact preimage/old healthy/jobs, no receipt | publish `COMPENSATED` only |
| 7 | compensation in progress, every target exact preimage/release, jobs exact | resume unfinished compensation only |
| 8 | targets known but JobStore drifted | stop if running, restore known code, no restart; `MANUAL_RECOVERY_REQUIRED` |
| 9 | `PROOF_PASS`, release/new healthy/jobs exact, success receipt absent/failed | compensate; never infer success |
| 10 | write begun, no proof/compensation, targets known, jobs exact | compensate |
| 11 | every other face | no mutation/replay; `OUTCOME_UNKNOWN` |

Receipt publication has its own root:wheel 0600 hash-chained canonical
`PUBLICATION_JOURNAL.jsonl` with exact events `PUB_BEGIN,PUB_SIGNAL,PUB_PUBLISHED,PUB_FAILED,PUB_RESUME`.
`PUB_BEGIN/PUB_RESUME` bind outcome, fixed `RECEIPT.json.tmp` path, current
transaction/evidence prefix hashes, and receipt-payload hash. Transaction and
evidence prefixes are fsynced before construction; publication events never
enter those prefixes, preventing self-reference. Legal paths are one begin to
published/failed; one evidence-only resume is allowed only for a non-success
outcome with identical payload. A failed `FORWARD_ACTIVE` publication must
advance the transaction through compensation and begin a new `COMPENSATED`
publication, never retry success. If rename succeeded before the published
marker, re-entry may validate the exact pending payload and append only
`PUB_PUBLISHED`. A second non-success failure is terminal with null receipt hash.
Publication records use the same exact envelope/hash rules; details keys are
`PUB_BEGIN|PUB_RESUME` =
`outcome,temporary_path,transaction_prefix_sha256,event_details_prefix_sha256,receipt_payload_sha256`,
`PUB_SIGNAL` = `signal,after_event`, `PUB_PUBLISHED` =
`outcome,receipt_sha256`, and `PUB_FAILED` = `outcome,error_class`.

Publish the atomic root-owned 0600 receipt at
`/private/var/root/agent-core-scheduler-deploy-v1-<nonce>/RECEIPT.json`. Its
exact keys are
`schema_version,outcome,correlation_id,started_at,finished_at,owner_id,approval_ref,authority_spec,authority_semantic_head,authority_accepted_head,auth_semantic_head,auth_accepted_head,artifact_manifest_sha256,runner_sha256,transaction_prefix_sha256,event_details_prefix_sha256,journal_last_sequence,authorization_method,auth_lock_dev_inode,agent_core_lock_dev_inode,old_pid,new_pid,old_started_at,new_started_at,preimage_catalog_sha256,postimage_catalog_sha256,compose_sha256,plist_sha256,jobs_sha256_before,jobs_sha256_after,forward_restart_count,rollback_restart_count,launchd_running,import_export_count,fatal_log_delta_count,history_storage_created_count,job_occurrence_delta_count,signal_event_count,signal_events_sha256,unavailable_fields_sha256`.
No extra key/array/object is permitted. Schema version is integer 1; UUIDs are
lowercase; heads 40-hex; non-null SHA fields 64-hex; times RFC3339 UTC; lock
identities decimal `device:inode`; PIDs positive safe integers; counts
nonnegative safe integers; launchd is boolean; authorization method exactly
`macos_native_authorization`. Null is legal only when the field name appears in
the sorted canonical string-array hashed by `unavailable_fields_sha256`.
The one closed outcome is:
`STOPPED_PREMUTATION|QUIESCENCE_ABORTED|FORWARD_ACTIVE|COMPENSATED|OUTCOME_UNKNOWN|MANUAL_RECOVERY_REQUIRED`.
Only `FORWARD_ACTIVE` is deployment success. The manifest duplicates the exact
field/type/nullability schema and these invariants byte-for-byte: forward means
release catalog/new healthy PID/restart 1:0/all proofs zero-or-69/jobs equal;
compensated means preimage/old healthy face/rollback restart exactly one/jobs
equal; prestop means preimage/old healthy/0:0; quiescence-aborted means
preimage/fresh old healthy/0:1; manual means known Job drift and stopped restored
code; unknown makes no success claim and records every unavailable coordinate.
No individual
Gate/dialog/file/PID/health/receipt is success.

### CTR-SRD-006 — Exact one-shot canary

After deployment `FORWARD_ACTIVE` and Auth Phase C terminal `C_ACTIVE`, with
Runtime PID/start unchanged, source `agt_efficiency-agent` invokes only unified
`scheduler` with `action=create`, `schedule_kind=at`, one future bounded UTC
instant, `delete_after_run=true`, `auto_retry=false`, target `blog-agent`, and a
fresh non-main target session. The correlation-bound message is exactly
`SCHEDULER-CANARY-<lowercase-uuid>: acknowledge receipt only; perform no other business action`.
The accepted wire path requests only `scheduler.admin` for the source; no
alias/local-manage/two-scope request is allowed.

Prove exact target Agent/session, one definition, one occurrence, one run, one
delivery/target turn, target-owned principal and credential, no source
credential/scope/token propagation, no automatic ping-pong, exactly-once, and
unchanged Runtime health/PID. The target must not execute workflow or another
business tool. On pre-fire failure, disable then remove the exact
correlation-bound definition. On post-due ambiguity, first fence it disabled,
wait through the bounded late-fire window, census occurrence/run/delivery, and
remove only when no future fire is possible. Receipt publication may never
leave an enabled late Job. This is the Goal's only Scheduler Job; no self-only
canary is also run.

### CTR-SRD-007 — Legacy zero-access and non-propagation

Owner runs whole-host `fs_usage -w -f filesystem` before create through
deletion through the same native authorization-dialog/no-password/no-fallback
boundary as deployment, retaining start/end markers and untruncated zero-exit
trace. Prove directory-wide zero access at/below
`/Users/yanfenma/.openclaw/cron/`; separately prove exact before/after
existence/size/mtime/inode/SHA-256 for
`/Users/yanfenma/.openclaw/cron/jobs.json`. The trace also proves zero access to
`/usr/local/libexec/agent-core/config/agent-credentials.json` from any target
process. The source credential may be read only by the trusted source-side Auth
seam and must not appear in the Job, run, target session, message, trace, or
receipt. Target credential access must be solely target-owned. Correlation-bound
Auth, relay, Parent, JobStore, occurrence, run, session, and delivery evidence
proves the exact source `scheduler.admin` decision and no privilege propagation.

### CTR-GSRD-001 — Lifecycle only

Acceptance may change only: (1) frontmatter `status: proposed -> accepted`; (2)
add `accepted_date,accepted_by,accepted_at,accepted_reviewed_base,accepted_reviewed_head,independent_review_result,independent_review_blockers,acceptance_verdict,acceptance_semantic_delta,acceptance_authority_basis`;
(3) replace the opening banner with `ACCEPTED / PRODUCTION DEPLOYMENT AUTHORITY`
and the exact recorded Owner/reviewed-head statement; (4) authoring footer
`STATUS: proposed -> accepted` and `OPEN_OWNER_DECISIONS: EXACT_HEAD_ACCEPTANCE -> NONE`;
and (5) the README row lifecycle cell `proposed -> accepted`. Every other byte
must remain identical; added values bind exact base/head, reviewer PASS/zero
blockers, Owner identity/time/decision, `acceptance_verdict: accepted`, and
`acceptance_semantic_delta: none_after_review`. No artifact/production byte
changes before accepted exact-head merge and final-head recheck.

## 6. Acceptance

### ACC-SRD-001 — Closure and simulator

- Contracts: `CTR-SRD-001`, `CTR-SRD-004`, `CTR-SRD-005`
- Environment/evidence: two clean worktrees plus disposable filesystem/process/
  signal harness; UTC time, toolchain/source/blob hashes, builds, secret scan,
  and injection before/after each copy/fsync/rename, both global locks, engine
  lock, stop/start and old/new/absent/ambiguous PID, health/import/log proof,
  JobStore drift, every signal/journal marker, bad chain/schema/ordinal/details,
  receipt temp/fsync/rename/lost-publication, legal single evidence-only resume,
  forbidden success retry, and re-entry after every compensation step
- Pass/fail: fresh read-only CHECK plus full simulator PASS, deterministic exact
  ten rows, one exhaustive classifier action at every boundary, complete
  rollback/bounds/no secret/no replay; fail on extra path, stale guard,
  nondeterminism, interruption, ambiguity, enabled late Job, or overclaim.

### ACC-SRD-002 — Production deployment

- Contracts: `CTR-SRD-002`, `CTR-SRD-003`
- Environment/evidence: production Mac exact root/launchd; UTC time, Goal/process/
  receipt census, native authorization, manifests, PID/start/restart, health,
  smoke/stderr/invariant digests
- Pass/fail: ten files, one healthy generation, zero business/unrelated change;
  fail on overlap/drift/extra path/restart/mutation/bad metadata/evidence.

### ACC-SRD-003 — Cross-Agent canary

- Contracts: `CTR-SRD-006`, `CTR-SRD-007`
- Environment/evidence: production Runtime and fresh target session; UTC time,
  Phase-C receipt, unchanged PID/start, exact source/target request/result,
  definition/occurrence/run/session/delivery/deletion, target principal and
  credential ownership, Auth decision, trace hash/bytes/markers/exit, legacy metadata
- Pass/fail: exactly one occurrence/run/delivery/turn, correct fresh non-main
  target, deletion/retained evidence, no restart/retry/ping-pong/legacy access,
  privilege propagation, or enabled late Job; otherwise fail.

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
OPEN_OWNER_DECISIONS = EXACT_HEAD_ACCEPTANCE
NORMATIVE_TBD = NONE
AUTHORING_READY_FOR_REVIEW = YES
PRODUCTION_CHANGE_THIS_ROUND = NONE
```
