# Finite legacy lock component: implementation handoff

COMPONENT_COMMIT = 2b0a927003f6dc351531bd61a10f6c5a290bb44c
COMPONENT_BASE = eeedbd5448ce9e74a85f95c62141766a24167fb8
WORKTREE = /Users/yanfenma/workspace/worktrees/dcp-first-live-operator
PRIMARY_AUTHORITY = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@39865536ce51005f95a98473e77c2329078512c0, CTR-DCP-009/018
AUTHORITY_ACTION = REUSE
ROUTE_STAGE = IMPLEMENTATION
ASSURANCE_LEVEL = CONTROLLED
OPERATION_ALLOWED = NO

Only `src/first_live/legacy_locks.rs` and `test/first_live/legacy_locks.rs` in the deployment-control-plane package were authored and committed in this component. The operator author owns the enclosing module, signed packet schema, real privilege/override census, native callsites and final handover receipt. Other authors' unstaged files were not committed or edited.

The governing `first-live-legacy-lock-handover-design.md` SHA256 `9ff65efce583337a569d3f1bbd76a40d47cadb4985698131fb53d716c6b0cf67`, independent design review SHA256 `8ce853c8e8320a077d137b205b66d1a20cf68e9aba96c6caf6974c2f30c71caf`, and source-binding record SHA256 `85f5f0d9ba1439bc41c06ef2f8d6725fc20378aa116f52a79f639d0f68b0e961` were read and rehashed; all four referenced legacy source hashes matched. These records live in the parent worktree's same SDD lane. No current protected lock state is inferred from that source evidence.

## Implemented behavior

The production constructor refuses nonroot and inherited-lock environment overrides before opening production paths, binds the borrowed existing DCP MutationGuard to the fixed DCP root, then opens four fixed protected parents. Exact parent device/inode/uid/gid/mode and permanent lock presence/identity are packet preconditions. `AbsentCreate` is explicit permission to create an absent permanent inode exclusively, journaled before creation. Existing permanent metadata is checked, never repaired. Nonblocking flock holds the same permanent inode until descriptor close, without unlink.

The two actual legacy ephemeral locks are acquired with exclusive mkdirat in deterministic order. Immutable intent precedes each effect; exact created directory and holder identities follow. The global holder retains pid/uid/cmd/started lines. Its operation hash and immutable journal bind the exact operation without permitting an operation ID to masquerade as the fixed old parent's grep pattern. Scheduler lock evidence is DCP-specific and does not forge a freeze receipt. The fourth path is only an absent conflict guard, never a claimed acquired protocol.

`LegacyLocks<'guard>` keeps the DCP guard borrowed. Verification reopens fixed parent paths, checks permanent and directory identities, exact holder metadata/bytes and content sets, and continued fourth-guard absence. Dropping or returning an error never removes ephemeral evidence. Any earlier legacy intent rejects reacquisition; no stale/PID-age/new-attempt cleanup is provided.

Normal release consumes the object only after an existing protected closed-schema `legacy-retirement-result.json` matches both operation binding and retirement digest. The operator must write this only after final successful controlled readback, including retired-entry denial verification. Both directories are checked before either is touched. Release removes only exact owned holders, fsyncs, rechecks identities/empty content sets, removes those directories, fsyncs parents and appends a release result. All partial or crash outcomes retain durable intent and remaining evidence; permanent inode stays.

## Executed evidence and limitations

Initial behavioral RED: 4 passed / 8 failed with the compiling missing-feature scaffold. A second real `/usr/bin/grep` RED proved a raw operation ID could match the fixed legacy inheritance pattern; replacing only the readable holder's operation representation with SHA256 closed that case while retaining the original ID in the immutable journal.

Final `cargo test --locked --lib first_live::legacy_locks::tests -- --test-threads=1`: exit 0, 15 tests passed. Real nonroot temp-directory fixtures prove mkdir/flock exclusion, explicit existing/absent permanent handling, foreign/symlink/inode/holder/content preservation, fourth-guard refusal, missing/mismatched completion rejection, and normal exact release. Thirteen subprocess crash points cover acquisition and release; each terminates at the real checkpoint and durable state rejects replay. `rustfmt --check --edition 2021` on both owned files passed. File lengths are 404 and 471, within the 500-line limit.

Strict crate clippy was attempted and exited 101 while the enclosing finite operator was still unwired. The owned module had only dead-code diagnostics from that missing composition; no lint suppression was added. Shared incomplete source also had actionable lints that were sent to the operator author. This is not a final strict-clippy PASS, full-suite PASS or operator build assertion; those belong to the subsequently frozen integrated operator source and must be executed there.

No holder format can prevent arbitrary caller-selected regex/path overrides in the old shell installer. The native operator must prove those privilege/override routes unavailable or refused before target effects. Locks alone, this test pass, or this component commit do not establish that census, installed retirement, current root state or operation authorization. Independent component/integrated source review remains required.

| Evidence retained in this lane | SHA256 |
|---|---|
| `legacy-locks-red.log` | `7ecea0ba354673bc5f36786bff936b471d6322b7f6697485cd0583fc6a33d8ba` |
| `legacy-locks-pattern-red.log` | `4dc161ed270ec875244c8cb55386bd5e69683473342dd6a02d8d4f492586cf49` |
| `legacy-locks-final.log` | `7339f73e6619cf5fa07e96a8fad7667ad708cde19230b2e45fa5b0c47e0c8b8b` |
| `legacy-locks-fmt.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `legacy-locks-clippy.log` | `fb5cf90cd5b9a5ad8c97f93a1aa0519d489e782c9c8e8507293b61b662988b8e` |

PRODUCTION_MUTATION_PERFORMED = NO
REAL_PRODUCTION_LOCKS_OPENED = NO
PRIVILEGED_ACTION_PERFORMED = NO
PARENT_GOAL_COMPLETE = NO
