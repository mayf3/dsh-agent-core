# Fixed native denial component handoff

COMPONENT_COMMIT = 524bc2e3423c627ba3724134aceb07a8deb51c5b
COMPONENT_BASE = e67ccf7f5c2dc495f3488165a86a23283e5a6ce1
ACCEPTED_SPEC = 39865536ce51005f95a98473e77c2329078512c0
AUTHORITY_ACTION = REUSE
ROUTE_STAGE = IMPLEMENTATION
ASSURANCE_LEVEL = CONTROLLED
OPERATION_ALLOWED = NO

This is a bounded component of the existing first-live operation, under the independently reviewed lifecycle/denial design and the parent's explicit nonproduction implementation dispatch. Only `native_effects/denial.rs`, its private `denial_child.rs`, and `test/first_live/denial.rs` were authored. The parent approved the natural child/reaper split to remain below the repository file limit. Source lengths are 445 and 191; tests are 337 lines. Module/callsite/packet/inventory producers belong to the native operator author. No independent self-review PASS is asserted.

## Fixed contract

`Targets::from_inventory` derives paths from the three validated fixed app/harness/node-runtime inventories, fixed actual service plists, the controller and retired lw-pilot executable, and the four existing DCP JSON configurations. Names, parent device/inode and target-set digest are closed internal data, not an external command/path protocol. The operator must supply authenticated actual post-isolation tree identities; a new-inode transition cannot reuse old inode coordinates. Protected state/key isolation and installed-entry/lifecycle/sudo denial remain separate driver duties. This component neither reads key contents nor claims those other probes passed.

`Context::new` requires root, the borrowed real DCP MutationGuard, exact installed protected controller SHA/current-executable identity, immutable `first-live-intent.json` raw SHA and mode, and the frozen caller groups. The native child rechecks proof descriptors before resetting its environment and dropping groups/GID/UID to caller502/GID20. It executes only the compiled syscall classes and returns fixed-size typed data. No external program, candidate code, shell or caller CLI is executed.

There is one fixed child per probe class, with a five-second class deadline and bounded termination/reaping. This is stricter than five seconds per individual target; actual whole-inventory timing has not been proved and a timeout must stop without silently increasing the bound. Inherited descriptors are closed through the native descriptor limit; only the result pipe and, when needed, one authenticated read-only DCP configuration-directory descriptor remain. That descriptor permits exact openat permission tests in root0700 without passing any writable file or key descriptor.

Open-write uses no create/truncate/write. Ancestor tests create only the fixed dedicated probe name with exclusive/no-follow flags. Only actual EACCES/EPERM constitutes file denial; signal0 requires actual EPERM. Missing paths/processes, stale identities, existing probe objects, generic nonzero or incomplete observations fail closed. Fresh kernel process identity is checked before and after signal0. The full typed result is durably recorded before later identity gates or cleanup, so a subsequent failure cannot erase the observation.

Unexpected creation is recorded before cleanup. Only an exact owned empty regular inode under the matching protected parent can be removed and fsynced; foreign, replaced, nonempty or otherwise changed objects are retained. An unexpected success always fails denial proof even if its exact cleanup succeeds. A consumed intent cannot be replayed. The bounded reaper never signals a PID after ECHILD/ownership loss.

## Executed evidence

Initial compiling scaffold RED: 0 passed / 10 failed for missing behavior. Additional genuine fixture REDs reproduced: a successful syscall observation not yet durably recorded before the next gate; a bounded reaper signaling a sibling fixture process it did not own; and failure to prove exact config-leaf denial through an already-held read-only parent. These were corrected without weakening permission classification. Darwin's unavailable closefrom symbol was replaced with the native bounded descriptor loop; linking now succeeds.

Final command `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml --locked --lib first_live::native_effects::denial::tests -- --test-threads=1` exited0: 15 passed, 0 failed. Fixtures use genuine nonroot filesystem permissions and owned local processes: EACCES, zero-write writable success, ENOENT/ESRCH, parent identity drift, stale context/root-entry refusal, exact empty-probe cleanup versus foreign retention, real timeout/reap and nonchild preservation. The tests do not execute UID transitions as root or probe any real production service. `rustfmt --check --edition 2021` on the three owned files exited0.

Strict crate clippy was attempted on the shared operator tree and exited101 while its composition remained incomplete. The final owned-file diagnostics are only dead-code from unwired callsites; no suppression was added. This report therefore does not claim final strict clippy, full suite, release build or independent operator source review. The enclosing exact integrated source must perform those gates.

The operator author confirmed the four fixed JSON names already exist in the exact disabled genesis and are pinned by native preflight, so their inclusion does not rely on future materialization. Missing files still fail. That statement concerns the known package contract; this component performed no current protected-host census.

| Retained evidence | SHA256 |
|---|---|
| `native-denial-red.log` | `60a0d0ff0c4ca2422a440a7789867104bf38ec1de158129f41b118398c4753f2` |
| `native-denial-order-red.log` | `c48d5bce36892c5f14b55fdb7458b341688facc551fa61c72307a75f3c3b1da6` |
| `native-denial-reaper-red.log` | `107880acc9b75bee1b1b5f0f315cb132a9570dc8fc61234566f28276eb488cb1` |
| `native-denial-held-parent-red.log` | `23db94ec318863b9b90a7940aa7d5cad662992e4759e815cc6a2e96159294f08` |
| `native-denial-final.log` | `baab013a835af45ea671739ce120061b88cfd6e28202fba72b42377c2fcc3176` |
| `native-denial-fmt.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `native-denial-clippy-final.log` | `68a2dfc00ef0de468985bc7f2faef900759fe851001541a615737e37374392b1` |

| Exact component source | SHA256 |
|---|---|
| `src/first_live/native_effects/denial.rs` | `ceb160c3644f7c78676c4542fb252f6237adc59cbdc9b6ff15eb401c44d0b78b` |
| `src/first_live/native_effects/denial_child.rs` | `1647814dfe023e53c95a43f3b0681731b7d327976bb465e557193db56df3a496` |
| `test/first_live/denial.rs` | `2f2446ed53a2db35e8a63acc028627fb6195acc9a862af78bba98636655f1d10` |

PRODUCTION_MUTATION_PERFORMED = NO
PRIVILEGED_ACTION_PERFORMED = NO
REAL_PRODUCTION_PROBE_PERFORMED = NO
INDEPENDENT_COMPONENT_REVIEW = PENDING_INTEGRATED_SOURCE_REVIEW
PARENT_GOAL_COMPLETE = NO
