---
investigation_id: AGENT_SELF_SERVICE_OPERATIONS_PRODUCTION_ROLLOUT_CENSUS_V1
status: complete
date: 2026-09-13
scope:
  - self operations source versus live production census
  - active runtime and connector lineage census
  - narrow rollout boundary
authority: evidence_only
---

# AGENT_SELF_SERVICE_OPERATIONS_PRODUCTION_ROLLOUT_CENSUS_V1

This artifact records read-only evidence. It grants no implementation, merge, restart, production apply,
Scheduler mutation, or HR incident-repair authority.

## 1. Coordinates

```text
OBSERVED_AT = 2026-09-13 Asia/Shanghai
EXACT_REOBSERVED_AT = 2026-09-13T08:58:04Z / 2026-09-13T16:58:04+08:00
OBSERVER = developer uid 502, read-only local host inspection
REPOSITORY = mayf3/dsh-agent-core
IMPLEMENTATION_REVIEWED_HEAD = 62905c1055b3d2c2459b346711f5c5aa4253001f
IMPLEMENTATION_MERGE_COMMIT = 447becfcfce708b128959b01596cf491f3fa9a60
IMPLEMENTATION_PR = 278 MERGED
LIVE_TRUSTED_APP = /usr/local/libexec/agent-core/app
LIVE_STORE = /Users/authsvc/.agent-core/scheduler/jobs.json
STORE_READ_FROM_DEVELOPER_UID = EACCES (expected protected boundary)
PRODUCTION_APPLY_AUTHORITY = none
```

## 2. Stable evidence graph

### STATE-ROL-001 — Reviewed source is merged and absent from live

- Subject: V1 self-operations source and trusted installed app.
- Revisions: reviewed head `62905c1`, merge `447becf`, live vector reobserved at the exact timestamp above.
- Environment: local Git object database plus `/usr/local/libexec/agent-core/app`.
- Assertion: source is merged; three new self-operations files are absent and every changed present seed path
  remains at the exact review-base blob.
- Basis: OBS-ROL-001, EVD-ROL-001.

### STATE-ROL-002 — Whole candidate boot generation is broader than this Goal

- Subject: candidate-versus-live relative-import boot closure.
- Revision: `62905c1`, entry `scripts/production-runtime.mjs`.
- Environment: clean isolated worktree and trusted installed app read-only snapshot.
- Assertion: 140 local files are reachable, zero relative imports are unresolved, and 37 reachable files differ
  from live, including unrelated Workflow Execution, voice, Feishu, model-route, and provisioning surfaces.
- Basis: OBS-ROL-002, EVD-ROL-002.

### STATE-ROL-003 — Exact HR target lineage remains open

- Subject: HR Feishu connector, Runtime, Scheduler store, and trusted caller binding.
- Environment: local launchd/process/plist/log inspection from developer uid.
- Assertion: three runtime lineages are active; the protected system runtime is the leading target hypothesis,
  but the developer uid cannot read its log/store and key presence is not binding proof.
- Basis: OBS-ROL-003, EVD-ROL-003.

### OBS-ROL-001 — Per-path release seed equality

- Method: for each seed path, `git rev-parse <rev>:<path>` / `git hash-object <live-path>` / exact absence;
  no file content, runtime, or store was changed.
- Result: 13 present paths equal base; 3 paths are absent in base/live and present at reviewed head.
- Provenance: observer and exact timestamp in §1; local Git objects and root-owned installed app.

| Path | Live blob | Review-base blob | Reviewed-candidate blob |
|---|---|---|---|
| `packages/agent-router/src/index.js` | `c6806a423b7ba0ce1e9d7dbdba15f5e46cfe87be` | `c6806a423b7ba0ce1e9d7dbdba15f5e46cfe87be` | `f5c634037804ba00dbe2edc917d7b37239190734` |
| `packages/broker/src/capabilities/self-ops.js` | `ABSENT` | `ABSENT` | `eba80def9ac92140e4af2298a3d4cc672c71951f` |
| `packages/broker/src/gateway.js` | `150fac99fd40523e9468d19981d9b55db3db5684` | `150fac99fd40523e9468d19981d9b55db3db5684` | `45d3b8fed8a1ef056c29e1277f5d99acc158a015` |
| `packages/broker/src/index.js` | `d923405dfb6ed90aeb3ea0898693d989c6287a5a` | `d923405dfb6ed90aeb3ea0898693d989c6287a5a` | `b3122bdcffd008953be361b8f5fcf1cb66cfb8e8` |
| `packages/broker/src/schema.js` | `c54205c3f60355236b7efcde74ba34d3fd01c8a4` | `c54205c3f60355236b7efcde74ba34d3fd01c8a4` | `36cdf4f7f7af295807beb5659a519e36d121b9ac` |
| `packages/production-runtime/src/scheduler/self-service-runtime.js` | `ABSENT` | `ABSENT` | `53467a9ffc4092589592703c5d080aec213673db` |
| `packages/scheduler/package.json` | `e16621c96eb1a988f8b35fd27124deb41dd46195` | `e16621c96eb1a988f8b35fd27124deb41dd46195` | `f8740bfe2a4b03f716cd4e892148d38d4ff89bae` |
| `packages/scheduler/src/control.js` | `fb011b6207bea750b0963ea9fa1cffd6301e26fb` | `fb011b6207bea750b0963ea9fa1cffd6301e26fb` | `360f44ba240cdac3a48b533b0043c4e5d5b078f8` |
| `packages/scheduler/src/eligibility.js` | `86313158ad9427c622106eb263f58aa6bba6fac9` | `86313158ad9427c622106eb263f58aa6bba6fac9` | `401bf0acc261a74f807f37cfd9728971c0dcec3a` |
| `packages/scheduler/src/index.js` | `ae6cc4829ee2ff42fd81edbc53899da0ac67f12e` | `ae6cc4829ee2ff42fd81edbc53899da0ac67f12e` | `1bb43ed61caccebac07f93a54b53a43f7ac332e9` |
| `packages/scheduler/src/occurrence-model.js` | `48b6a54569d5bd7168cf725ac39274565708c04f` | `48b6a54569d5bd7168cf725ac39274565708c04f` | `8585bdbb2ab3640129e71cbb0740d25a07eca7bd` |
| `packages/scheduler/src/occurrence.js` | `d147e5ab2cd838bbcefed5a528cd3d2394aad94a` | `d147e5ab2cd838bbcefed5a528cd3d2394aad94a` | `d949654d18c3ceea7aa93d73958223a58e117ee8` |
| `packages/scheduler/src/scheduler.js` | `d5aec7af60028f547d87a373a89759cf2676a410` | `d5aec7af60028f547d87a373a89759cf2676a410` | `c6056b0ac19d532b09028ca5f617e98a4ce9816f` |
| `packages/scheduler/src/self-ops/index.js` | `ABSENT` | `ABSENT` | `07447d4a63b605b91cb46e97006ecda5a7afa4fa` |
| `packages/scheduler/src/store-migration.js` | `f8faade6218d85b95c0f22c92b4927900f940f95` | `f8faade6218d85b95c0f22c92b4927900f940f95` | `a7af7ea101b23685f1f035395fbb5d232b151214` |
| `packages/scheduler/src/store.js` | `c77a4bbcf81a3779172942db57bb6d5a0a4212d3` | `c77a4bbcf81a3779172942db57bb6d5a0a4212d3` | `014f1fbda96149c7b6edc0fc76d13cffb179da00` |

### OBS-ROL-002 — Boot-closure comparison

- Method: breadth-first relative `import|export|dynamic import|require` resolution from the candidate entry,
  followed by Git-blob comparison with the same relative live path.
- Result: `REACHABLE=140`, `UNRESOLVED=0`, `DIFFERING=37`, vector SHA-256
  `2864324fdfb0829924455433122e9db0af767113b33214062b60b4e2eeb48d8c`.
- Limitation: this establishes why full-generation deployment is too broad; it is not an executable release
  manifest and does not prove named-export or boot compatibility of the future narrow overlay.

### OBS-ROL-003 — Runtime and connector census

- Method: `launchctl print`, plist ProgramArguments/environment-key-name inspection, `ps`, `lsof`, health
  reads, and secret-filtered runtime/connector log excerpts.
- Result: the three rows in the lineage table below; system plist Feishu/store keys exist; current user
  runtime reports Feishu channel off; protected system log/store reads fail with `EACCES`.
- Limitation: developer-uid visibility cannot prove the system runtime's live socket, HR binding, or store
  contents. `TARGET_LINEAGE_PROVEN=NO` remains open.

### CLM-ROL-001 — A narrow overlay is required

- Support state: SUPPORTED.
- Supported by: EVD-ROL-001 and EVD-ROL-002.
- Claim: exact reviewed seed bytes plus a separately reviewed live-derived minimal compose are the maximum
  candidate surface this Goal may prepare without unrelated activation.

### CLM-ROL-002 — System runtime is only a hypothesis

- Support state: INFERRED / OPEN.
- Supported by: system plist key presence in OBS-ROL-003.
- Contradicted/limited by: protected log/store and binding are unreadable from developer uid.
- Claim: no apply decision may rely on this inference; trusted target-bound readback is mandatory.

### EVD-ROL-001

- Source: OBS-ROL-001. Target: STATE-ROL-001 and CLM-ROL-001. Relation: SUPPORTS.
- Sufficiency: exact for release-seed source/preimage equality at the observation time.
- Limitation: live preimage can drift and must be rechecked under the apply lock.

### EVD-ROL-002

- Source: OBS-ROL-002. Target: STATE-ROL-002 and CLM-ROL-001. Relation: SUPPORTS.
- Sufficiency: exact for local relative-import reachability and blob difference count.
- Limitation: does not itself prove runnable production closure.

### EVD-ROL-003

- Source: OBS-ROL-003. Target: STATE-ROL-003 and CLM-ROL-002. Relation: SUPPORTS_WITH_LIMITATION.
- Sufficiency: exact for observed process/plist/user-runtime facts.
- Limitation: explicitly insufficient for exact HR lineage; no secret or protected store was read.

## 3. Source versus live result

The reviewed source is merged, but the trusted installed tree is pre-feature:

```text
packages/broker/src/capabilities/self-ops.js = LIVE ABSENT
packages/production-runtime/src/scheduler/self-service-runtime.js = LIVE ABSENT
packages/scheduler/src/self-ops/index.js = LIVE ABSENT
packages/production-runtime/src/compose.js = LIVE blob 940c21653303b70df782c82a125809edca2b37a1
packages/production-runtime/src/compose.js = CANDIDATE blob 1ce4eee9e8ca3992f598240c2c6f8dd9b2df9103
packages/scheduler/src/store.js = LIVE blob c77a4bbcf81a3779172942db57bb6d5a0a4212d3
packages/scheduler/src/store.js = CANDIDATE blob 014f1fbda96149c7b6edc0fc76d13cffb179da00
HR_SELF_REPAIR_SOURCE_MERGED = YES
HR_SELF_REPAIR_LIVE_FEISHU = NO
```

Every present inspected live source file was a non-symlink regular file with `root:wheel 0644`.

## 4. Active lineage census

Three independent Agent Core runtime lineages are currently active:

| Label / role | PID | OS user | Source and root | Listener |
|---|---:|---|---|---|
| `system/ai.agent-core.runtime` | 83094 | `authsvc` | trusted app, `/Users/authsvc/.agent-core` | socket state not observable from developer uid |
| `gui/502/ai.agent-core.runtime` | 53309 | `yanfenma` | `production-dsh-agent-core`, `/Users/yanfenma/.agent-core` | `127.0.0.1:8787`, `:8791` |
| `gui/502/ai.agent-core.scheduler-v2` | 60339 | `yanfenma` | `dsh-agent-core-main`, `/Users/yanfenma/.agent-core-scheduler-v2` | `127.0.0.1:8795` |

The standalone Feishu connector `gui/502/dev.omdsh.dsh-lark` is PID 60341 and runs the `lark-pilot`
DSH profile. Its current log proves a past `client ready` / `event-dispatch is ready`, followed by a failed
bot-identity resolution at its 2026-09-07 start. The read-only evidence does not prove which runtime/store
the current HR chat ingress targets. Therefore a rollout that merely refreshes the trusted app is not enough:
target runtime, Scheduler store, connector, and HR identity binding must be proved as one lineage before apply.

The system runtime plist contains keys for `FEISHU_CREDS_PATH`, `AGENTCORE_EXPECTED_STORE`, Broker credentials,
and Scheduler reconciliation evidence; their values were intentionally not read or emitted. The current user
runtime plist contains no Feishu credential key, and the current PID 53309 start record says its Feishu channel
is off. This makes the protected system runtime the leading target hypothesis, not target proof. Exact HR
binding/store proof still requires the trusted operator boundary.

No process was stopped, signalled, restarted, or reconfigured during this census.

## 5. Why current-main full install is unsafe for this Goal

The trusted live app is a selectively deployed mixed generation, not an exact historical Git tree. A static
relative-import traversal from `scripts/production-runtime.mjs` at reviewed head `62905c1` reaches 140 local
files; 37 differ from live. Those 37 include unrelated Workflow Execution, voice-transcription, Feishu,
model-override, and provisioning changes. A full current-main overlay would therefore expand this Goal's
production effect beyond self operations.

The reviewed candidate `compose.js` also adds `mountWorkflowExecutionRuntime` and other changes absent from
the live compose. Deploying it byte-for-byte would not be a self-operations-only release.

```text
FULL_CURRENT_MAIN_INSTALL = REJECTED_FOR_THIS_GOAL
REVIEWED_COMPOSE_DIRECT_OVERLAY = REJECTED_FOR_THIS_GOAL
REASON = unrelated production activation and mixed-generation closure risk
```

## 6. Narrow release seed

The self-operations implementation changes 18 production-copyable paths. Two are excluded from the narrow
release seed:

- `packages/production-runtime/src/scheduler/history-runtime.js` is the rename target for a separate history
  composition and is not required by the self-operations provider;
- `packages/production-runtime/src/compose.js` must be replaced by a separately reviewed minimal wiring delta
  against the exact live preimage, not by the reviewed whole-file candidate.

The remaining 16 exact reviewed-source paths form the release seed:

```text
packages/agent-router/src/index.js
packages/broker/src/capabilities/self-ops.js
packages/broker/src/gateway.js
packages/broker/src/index.js
packages/broker/src/schema.js
packages/production-runtime/src/scheduler/self-service-runtime.js
packages/scheduler/package.json
packages/scheduler/src/control.js
packages/scheduler/src/eligibility.js
packages/scheduler/src/index.js
packages/scheduler/src/occurrence-model.js
packages/scheduler/src/occurrence.js
packages/scheduler/src/scheduler.js
packages/scheduler/src/self-ops/index.js
packages/scheduler/src/store-migration.js
packages/scheduler/src/store.js
```

For all 13 seed paths already present in live, the live Git blob equals the implementation review base
`e01ea3494d0b382bab0fbf636fdd55a590d2bfdc` exactly. The other three seed paths are absent in both that base
and live and are added by the reviewed candidate. Therefore the complete seed overlay is exactly the
independently audited `e01ea349 -> 62905c1` implementation delta; it does not carry unrelated earlier or later
main drift. This equality must be rechecked under the deployment lock.

These paths are necessary but not sufficient. A release vehicle must overlay them plus the reviewed minimal
compose result onto an exact live-tree copy, then prove relative-import resolution, named-export compatibility,
candidate boot, existing-capability retention, and self-operations positive/negative behavior before any live
write.

## 7. Safety findings

- The current developer uid cannot read the trusted Scheduler store. This is a correct privilege boundary,
  not a reason to copy the store or bypass ownership.
- Fresh HR job/fence counts are unavailable until the formal caller-scoped tool is live or an authorized
  trusted operator performs the read. Historical `TEST_ACTIVE=7` is not current evidence.
- A restart would destroy current-epoch in-memory reconciliation evidence. Any existing `restart_lost` handle
  cannot satisfy HR self-reconcile dogfood.
- V3 store commit is an absolute rollback boundary: only when no V3 document/evidence has ever been committed
  may the generation restore exact code+V2 store preimages. After any V3 commit, old V2 readers/writers must
  fail loudly with byte-for-byte zero write and recovery is V3-aware forward-fix only; no downgrade exception.
- The four disabled Workflow domains must remain disabled. They are not a canary surface and cannot be
  re-enabled for cleanup.

## 8. Conclusion

```text
SOURCE_READY = YES
LIVE_READY = NO
NARROW_ROLLOUT_DESIGN_AVAILABLE = YES
TARGET_LINEAGE_PROVEN = NO
PRODUCTION_APPLY_AUTHORITY = none
NEXT_AUTHORITY = AGENT_SELF_SERVICE_OPERATIONS_PRODUCTION_ROLLOUT_V1
```
