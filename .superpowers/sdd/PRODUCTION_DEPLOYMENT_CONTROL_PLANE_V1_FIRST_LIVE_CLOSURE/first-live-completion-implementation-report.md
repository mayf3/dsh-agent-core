# OP-02 fixed completion export implementation

DEVELOPMENT_PREFLIGHT: same parent accepted PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@39865536ce51005f95a98473e77c2329078512c0; REUSE / bounded BRIEF within existing EXEC_PLAN / CONTROLLED implementation only. Explicit parent mandate follows design fd3f3c0d49b6630562d5d15a5123889db28e817812965a7ecb2bc3efa2c78013 and independent design review 026808c6d387469a37fbec996a8ee67773acb59a9e0b6c884a13a2c663402970. Author evidence, not independent PASS.

Source 914a0085409713a0443999f3c548f0993e62b815; base fdc65641d3f218a01f8bc5d31edda5b6aa00f7bc. Exactly17 owned source/test files. HOST_IMPLEMENTATION_INCOMPLETE is unchanged. No root, production endpoint/service/socket, device login, keys, install or business effect executed. Ordinary fixtures only, all Cargo uses /tmp/dcp-startup-target.

## Implemented boundary

Fixed same-binary --first-live-completion takes no additional argument. It requires real root/fixed executable, exact packet and fresh14400-second grant, complete authenticated enable chain, public configured Catalog and actual native enrollment. It obtains the existing permanent inode/flock through a crate-private read-only no-create/no-fsync seam, plus the existing Registry lock opened read-only. Original lock acquire and Registry writer durability are preserved.

Queue readonly-existing uses SQLITE_OPEN_READ_ONLY/query_only and Deferred transactions. It performs no DDL/migration/checkpoint/recovery and never uses immutable. Before/after every read it rejects any queue.db-wal/shm/journal sidecar, verifies protected database metadata and named/descriptor inode. Only rollback/delete mode is admitted. The complete projection is one Deferred snapshot; it is re-read after physical observation. Delivery is outside the permanent mutex, so the retained Registry lock and monotonic ack projection comparison prevent a mixed COMPLETE from a racing ack. A changed projection refuses; this command does not retry.

Registry public reader shares exact history/bridge/signature validation with normal writers but does not initialize, sign, load keys or fsync. It retains the existing Registry lock and explicitly verifies the closure signature. ArtifactStore::open_existing extracts existing sealed validation without staging fallback; original import retains its prior behavior and refuses an existing sealed directory missing its manifest. Native Executor::native_observation supplies actual current complete-face/service generation under the retained permanent guard. No verify_installed/import/recover/initialize/verify_goals/deliver/ack path is called by this command.

COMPLETE joins the fixed Broker tuple, current Applied unit/attempt/target generation, no executor_pending/quarantine, latest authentic Goal PASS and attachment/acceptance/verifier, real current physical service/installation binding, signed Registry Ready/Closed row and exact CAS, exact outbox SHA and delivered1. Latest receipt is selected before joining receipts, so a dangling latest row cannot fall back to an older PASS. Signed row.business_goal_complete remains false. Valid missing/pending evidence produces PENDING with a bounded reason and null evidence. Fail/OutcomeUnknown/quarantine, corrupt evidence, ambiguous state, lease expiry or drift refuse with nonzero BLOCKED; no repair or authority assertion is invented.

## Public stdout schema

One canonical JSON object, <=65536bytes: version:1; state COMPLETE|PENDING; reason:null|fixed string; operation_id; package_digest; controller_digest; configuration_digest; activation_digest; enable_result_digest; fixed goal_id/source_sha/artifact_sha256/target_runtime/deployment_profile; business_goal_complete:false; evidence:null|object.

COMPLETE evidence object: unit_id:string, attempt:u32, target_generation:u64, service_generation:string, installation_binding_digest:string, native_observation_digest:string, goal_receipt_digest:string, registry_ledger_digest:string, registry_revision:u64 (ledger), registry_row_revision:u64 (child CAS), closure_digest:string, outbox_id:string (SHA256 hex, NOT integer), delivered:true. This is an observed point-in-time export, not a signed GoalReceipt or future guarantee. Outer must join actual ordinary Broker results and retained enable/configuration artifacts.

## Executed evidence

Four retained RED observations: readonly constructor scaffold could not read valid existing DB (3pass/1fail); old import-backed existing-only seam copied valid staging and failed its no-import assertion; initially permissive join failed5 substantive mutants with1positive; actual corrupt latest Goal DB row exposed prior PASS through an inner join and failed before latest-first repair. Intermediate compile/fixture-setup errors are not claimed as behavior RED.

Final ordinary macOS results,2026-09-18:
- cargo test --lib completion -- --test-threads=1:21pass/0fail (includes3 matching existing tests; not21 newly added tests).
- cargo test --lib registry:: -- --test-threads=1:24pass/0fail, including public-only history/no-keys/real lock exclusion.
- cargo test --test registry -- --test-threads=1:26pass/0fail, preserving normal signing/closure/durability behavior.
- cargo test --lib service::first_live -- --test-threads=1:24pass/0fail checkpoint; latest completion-specific subsequent changes passed final completion filter.
- cargo test --test filesystem --test queue --test transactions -- --test-threads=1:17/30/14pass respectively,0fail.
- all-target Clippy -D warnings:exit0; owned rustfmt check:exit0; git diff --check:exit0.

Fixtures execute actual rollback SQLite readonly connections, forced write rejection, missing DB noncreation, schema nonmigration, real uncheckpointed WAL preservation/refusal, sidecar appearance refusal, Deferred concurrent commit exclusion, real ack0→1 projection change, real signed apply/finalize/Registry closure, readonly lock exclusion, missing/corrupt sealed proof and ordinary-process native refusal. DB bytes/identity/mode/owner/link/size/mtime/ctime remain unchanged in valid readonly fixture (atime is not used as a mutation claim). No simulated physical JSON in pure join tests is claimed as actual native runtime verification; actual native observation is future protected execution only.

Raw logs beside this report in completion-implementation-evidence. No unchanged full suite/release is claimed for this component. Parent final native/whole-package integration and independent exact-source review remain required. No source change beyond this approved completion surface was made.
