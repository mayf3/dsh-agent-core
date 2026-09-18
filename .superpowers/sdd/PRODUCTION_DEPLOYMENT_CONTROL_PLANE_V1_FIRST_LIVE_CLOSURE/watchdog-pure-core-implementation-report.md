# Pure Watchdog evaluator implementation report

Author: delegated component implementer `/root/dcp_census_repair_review` (author role, not independent reviewer of this change).

Scope: only the seven listed Rust source/test files and this report. Accepted authority remains `PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@39865536ce51005f95a98473e77c2329078512c0`. Approved D02 design: `f88fb71`, document SHA-256 `50575fe39ef19258f230f24d26c7f1449352fd34fb1c6ed5ab84931b0e28e020`. Shared isolated checkout observed parent HEAD `e994f8fef98939aab9a5fca271e879d2f17ac947`; concurrent main implementation is outside this component snapshot.

## Result and boundary

`evaluate(&Value, &Value, now_ms) -> Result<WatchdogVerdict>` implements a pure fixed semantic/correlation evaluator. Missing contemporaneous capture gives Waiting; an unknown canary outcome gives Unknown; invalid proof gives Fail with a fixed reason; only the conjunction returns Pass with a digest binding the whole evidence, current readback, request digest, profile, and observation time. It contains no file, network, subprocess, signing, runtime, activation, queue mutation or key access. No production acceptance is established by these fixture tests.

The main author owns module wiring, authenticated bounded readers, raw-byte hashes, custody/metadata, actual operation authorization/capture provenance, canonical GET, guard, request identity, signer, activation and queue consumption. This Value API is not a trust boundary: it must never receive caller-asserted booleans or identity fields as independently authenticated proof. Reader must reject duplicate JSON keys before Value conversion; verify all original raw document hashes, finalization/plan provenance and exact capture custody; normalize timestamp representations without losing their bound original raw bytes. Historical source equality and file mtime cannot authenticate a capture. Source/module linkage does not authorize a production call.

## Frozen integration schema

Canonical schema contract SHA-256: `eeb23594e062452fc330b886ba9945eaf3911e39a9d1da8831eacfa98cae363d`. Digest input is the following one-line UTF-8 JSON without trailing newline:

```json
{"capture":["before:identity","after:identity","started_at_ms","completed_at_ms","authorized_from_ms","authorized_until_ms","semantic_digest","canary_job_id","canary_occurrence_id","outcome"],"current":["native_enrollment_digest","complete_face_digest","service_generation","target_runtime","host_identity","installation_binding_digest","source_sha","routing_digest","migration_digest","observed_at_ms","request_digest","health_max_age_ms","heartbeat_max_age_ms"],"evidence":["capture","semantic","fresh_health","fresh_store","fresh_incident_state","heartbeats"],"heartbeats":{"entry_optional":["pid","run_count"],"entry_required":["observed_at_ms","last_exit_code","healthy"],"required":["w1","w2"]},"identity":["native_enrollment_digest","complete_face_digest","service_generation","target_runtime","host_identity","installation_binding_digest","source_sha","routing_digest","migration_digest"],"migration_digest":"sha256(canonical JSON incidentMigrationAuthority or null)","profile":"watchdog-current-observation-v1","semantic":"original verifyPostdeployEvidence camelCase bundle; numeric normalized endedAt; mandatory exact router_admission accepted event","semantic_digest":"sha256(canonical JSON complete semantic bundle)"}
```

Envelope, current, capture, identity and heartbeat fields are closed; original semantic document objects preserve their accepted payload fields. All integer timestamps/counts checked by the core are nonnegative JavaScript-safe integers. Identity digests are lower-case SHA-256 except source_sha (40 hex). Nonempty target_runtime and host_identity are exact equality bindings. current.observed_at_ms equals now_ms, supplied from the same trusted observation snapshot. Age limits are positive and supplied only from authenticated accepted policy; the evaluator invents no freshness defaults. Periodic pid/run_count are optional validated observations, excluded from generation identity. Service generation must be computed by the unchanged native ServiceImage logic in the authoritative reader.

Capture before/after identities must equal current. The authorized interval encloses the capture interval; capture encloses before health, real canary admitted/started/ended times and after health; completion precedes current observation. Semantic digest and exact canary job/occurrence must match. Migration identity is bound to canonical migration authority, including explicit null for no migration. Fresh canonical health, W1/W2 health/last-exit/age, fresh durable incident/outbox invariants and routing bindings are checked separately; normal fresh store/incident evolution is not required to equal historical snapshots.

## Semantic port

Ported applicable `deployment-postdeploy-finalize.js::verifyPostdeployEvidence` semantics and its durable-state/routing dependencies: pending phase/source/no current-six authorization; complete canonical health/count/provenance; routing install linkage; health/raw-document digest linkage (raw bytes authenticated by reader); one disposable successful zero-effect canary; unchanged job definitions except state; preserved preexisting occurrences/fences; successful unrelated healthy execution and no fenced/quarantined admission; no health/admission/quarantine regression; one compiled unknown root per quarantined occurrence; stable-fact dedupe ignoring overdueMs; coherent lifecycle/episode/notification keys/history/delivery chronology; exact route/provider/payload bindings and times; verified migration exceptions; unchanged passive notification attempt proof. Existing OPEN roots are proven to take the original no-notification refresh branch without executing a mutation replay.

The native profile is deliberately fail-closed for ambiguous run aliases, duplicate identities, extra unexplained store admissions and missing Scheduler admission events. Unlike the original JS optional-events branch, D02 requires an actual exact accepted router_admission event plus the durable zero-effect result. Numeric normalized run timestamps must match the durable occurrence. The original test fixture timestamps were adjusted only to establish physically ordered before-health/canary/after-health for the new contemporaneous-capture tests. No canary execution or synthetic signed receipt was produced.

## Test evidence

1. First RED: Waiting-only scaffold with 12 tests: 8 pass / 4 fail, exit 101. Failures were correlated positive proof, periodic PID/dynamic-store evolution, honest Unknown, and state-only evolution.
2. Initial implementation GREEN: 20 focused tests pass.
3. Additional genuine RED: missing fresh durable documents and unbound migration identity: 20 pass / 2 fail, exit 101; then corrected and 22 pass.
4. Additional genuine RED: absent native Scheduler admission event: 0 pass / 1 fail, exit 101; then corrected.
5. Final focused run: `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml --lib verification::watchdog -- --nocapture`: **26 pass, 0 fail, 0 ignored**, exit 0. Tests include bound delivery and migration-positive vectors, malformed/future/fractional ages, current durable-state corruption, outbox attempt mutation, source/capture drift, and the original applicable semantic regressions.
6. Owned Rust formatting and structure checked; every file is below 500 physical lines; five direct children under watchdog/. Frozen data fixture is test-only.
7. Strict `cargo clippy --lib --tests -- -D warnings` was attempted, not claimed green: normal-lib evaluator is not yet called by the main integration (dead_code), and concurrent main source had `queue/dependencies.rs:40` needless_borrow. Main author was notified. No warning suppression was added. Final integrated strict Clippy/full suite/release and independent review remain main-lane gates.

No root command, runtime endpoint, privileged read, production mutation, credential read, package change or full test-suite rerun occurred in this component work.

## Exact owned source snapshot

| Path | SHA-256 | Lines |
|---|---|---|
| `packages/deployment-control-plane/src/verification/watchdog.rs` | `2643cf10d62b6161567eb21580651ec99249f26ac447da06d7f525d859196b70` | 231 |
| `packages/deployment-control-plane/src/verification/watchdog/checks.rs` | `c8b0d86b08748638d089c9f7b27192f83de5ada94043a93032857543ec99a138` | 71 |
| `packages/deployment-control-plane/src/verification/watchdog/fixture.rs` | `e77022a45757c7abe05361b3742f98153b19d35e37f065be1bdb7e66312ff494` | 376 |
| `packages/deployment-control-plane/src/verification/watchdog/incidents.rs` | `535a708e1e34d65a9b6f7dd24b901f260ee70b31d778b31c73cad4c321c8a710` | 214 |
| `packages/deployment-control-plane/src/verification/watchdog/routing.rs` | `29d732e069dee116b140458e8c329fce7ad7262a53d89b88024761108606b560` | 168 |
| `packages/deployment-control-plane/src/verification/watchdog/semantic.rs` | `626575ebadac0a4b157893516700c3e3f0bab9da81d2ac9799b8b678d84d40b5` | 317 |
| `packages/deployment-control-plane/test/verification/watchdog.rs` | `35a45d870d1bf03c110d9994c8b045b20f98bf46db29cb95f007080ce2d2c82e` | 383 |
