# Deployment control plane evidence relations

These stable EVD identities qualify the observations linked from all fourteen
conformance rows. **Each relation supports only its stated F/M subclaim; every
P-only result remains NOT EXECUTED. No whole-ACC production PASS is asserted.**

## Shared exact coordinates and provenance

A = accepted [Spec](../specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md), semantics
`39865536ce51005f95a98473e77c2329078512c0`, accepted base
`bb5327f622a0333f1e11d945319e024a3731f05a`. Every record below binds A unchanged.
`ACC-nnn` and `CTR-nnn` abbreviate the Spec's `ACC-DCP-nnn` / `CTR-DCP-nnn`.
Worktree = `/Users/yanfenma/workspace/worktrees/production-deployment-control-plane-v1-impl`.
Package paths below are relative to `packages/deployment-control-plane/`.

F/M environment = macOS arm64, nonroot euid502, Rust1.98.1, real SQLite/files/
locks/Unix sockets/owned children as applicable; service driver simulates launchd.
Fixture catalog/profile inputs are `test/common/mod.rs::fixture_catalog`,
`catalog`, `policy`, `proposal` (profile `fixture`, `profile-1`, `verify-1`;
deterministic fixture role keys), and `test/common/service.rs::start_with`
(signed mailbox/real process transport). Task4 bootstrap inputs instead use
`test/adoption/bootstrap.rs::macho`, `bundle`, `sources`, and the exact named tests:
synthetic x86_64 runtime graphs, host-architecture controller, fixture hashes;
no such keys/hashes are production authority. Prospective package is P4 below.

| Coordinate | Exact execution / original provenance |
|---|---|
| S1 | Source `9dc5e3c381e5229a70011fe8f65ac0430f872175`; Task1 `repair-final-tests.log`37/37 plus final ACK ordering `repair-final-ack.log`1/1. [Report][t1] and [independent re-audit][r1] bind original commands and scope. These are inherited observations, not new Task4 executions. |
| S2 | Source `c56925a034315c414e2cc1e8f1a9c7e8947b6d11`: `46-repair-final-suite.log`72/72 including4096; subsequent R01 source `2ea68163b627d1b6a1a09333fc0606eb8f275172`: `49-r01-affected-suite.log`73/73, unchanged4096 excluded. [Report][t2] / [R01 re-audit][r2] retain original boundaries. |
| S3 | Source `0c4ec56f518394557042445dfd796e439797774f`, review head `b01e8d4872011233ecf4fe2ac7103f23554a7e26`: logs37+38 cover96 affected tests. Log37 is a failed invocation (migration expectation); log38 passes Train17+transactions9 after fixture correction. Earlier log22 full89 retains unchanged4096 evidence; it predates later final-key/readiness and repair changes and is not a final-source whole-suite claim. [Report][t3] / [independent re-audit][r3]. |
| F4 | Source `3f59cf3aa4c11ae2dbec107e1284487b45bac099`; [35 full raw log][full], command at lines1–3: full locked suite105/105, UTC2026-09-17 16:02:29–16:07:06, [timing/result receipt][gates]. This is a new Task4 re-execution of inherited code plus then-current Task4 tests. Later adoption changes are not covered by this run. |
| A4 | Source `8db5ada86ce13f5f22727cd8fc6d8734afad35a9`; [49 adoption log][a4] bootstrap6/e2e3,9/9. Preserved historical execution, including the then-unfixed fixture boundary. The review's [EVD-T4R-002][review] contradicts fixture safety at that coordinate; it is not deleted or relabeled. |
| R4 | Repair source `a263c8089e16b3614f37b5c4766af50f4d449275`; [64 adoption log][repair] records timestamp/command/euid502/TMPDIR=/private/tmp;15 passing executions,12 unique cases (the same3 helper cases appear in both targets). Exact tested source was committed unchanged after execution. Only affected bootstrap/e2e targets reran; no full suite or4096 rerun. |
| P4 | Repair source as R4; [replacement package receipt][package], [prepare][prepare] and [verify][verify]; source map84 files, independently supplied manifest/source digests, integrity=true/readiness=false. [Binary equivalence][equivalence] records unchanged production/build inputs and exact reused release binaries originally built at8db5ada; no claim of a newly built binary. Historical package remains pinned to8db5ada. |

Raw outputs are implementer-produced observations. Independent reports are retained
review provenance only, not this author's independent verdict. Original logs with
no embedded wall-clock timestamp retain their original task/source/report coordinates;
no time is invented. The new record assignment does not rerun inherited tests.
Full-source line coordinates in named test links are at F4; repaired adoption
coordinates are at R4. Passing assertion cases establish only the inputs encoded
at those coordinates, not arbitrary production configurations.

## EVD-DCP-T4-001

**Target/relation:** ACC-001, CTR-001; SUPPORTS the bounded F/M subclaim below under A.
**Source/provenance:** src/queue/producer.rs; src/service/intake.rs; original mechanisms S1, S3; F4 re-execution where listed, R4 for adoption.
**Exact executed observations (each `... ok` in F4):**

- `producer_cas_snapshot_watermark_and_pagination_are_persistent` — [log line783](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L783); [test definition](../../packages/deployment-control-plane/test/queue.rs#L168) at F4.
- `authenticated_producer_watermark_and_forged_build_cannot_be_bypassed` — [log line825](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L825); [test definition](../../packages/deployment-control-plane/test/train.rs#L255) at F4.

**Environment/input/result/negative cases:** F/M inputs above. Signed fixture producer snapshots, revision CAS, watermark and paginated census; durable registry survives reopen. Missing watermark/forged build rejects instead of admission.
**Sufficiency:** executed assertions support these named cases; inherited review scope stays S1/S2/S3, not a new independent audit.
**Limitations:** RP-02: no real exhaustive upstream producer integration or authenticated bridge.

## EVD-DCP-T4-002

**Target/relation:** ACC-002, CTR-002,003; SUPPORTS the bounded F/M subclaim below under A.
**Source/provenance:** src/queue/admission.rs; src/service/train.rs; original mechanisms S1, S3; F4 re-execution where listed, R4 for adoption.
**Exact executed observations (each `... ok` in F4):**

- `concurrent_duplicates_survive_reopen_and_actor_idempotency_conflicts` — [log line792](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L792); [test definition](../../packages/deployment-control-plane/test/queue.rs#L87) at F4.
- `a_b_a_allocates_daemon_intents_from_trusted_desired_state` — [log line797](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L797); [test definition](../../packages/deployment-control-plane/test/queue.rs#L149) at F4.
- `repairs::b01_supersession_preserves_all_late_goal_and_actor_links` — [log line790](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L790); [test definition](../../packages/deployment-control-plane/test/queue_repairs.rs#L82) at F4.
- `service_cases::late_coverage_reuses_exact_original_attachment_and_never_reinstalls` — [log line834](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L834); [test definition](../../packages/deployment-control-plane/test/service_cases.rs#L51) at F4.

**Environment/input/result/negative cases:** F/M inputs above. Concurrent same-artifact requests, A-B-A desired revisions and late signed coverage collapse/attach with preserved Goal/actor links. Changed request payload and omitted late Goal reject; late acceptance does not reinstall.
**Sufficiency:** executed assertions support these named cases; inherited review scope stays S1/S2/S3, not a new independent audit.
**Limitations:** RP-04/06: actual complete release faces and native installation/restart counts unproved.

## EVD-DCP-T4-003

**Target/relation:** ACC-003, CTR-004,006; SUPPORTS the bounded F/M subclaim below under A.
**Source/provenance:** src/trust/admission.rs; src/queue/gates.rs; src/bootstrap/verify.rs; original mechanisms S1; F4 re-execution where listed, R4 for adoption.
**Exact executed observations (each `... ok` in F4):**

- `forged_or_changed_signed_payload_is_rejected` — [log line728](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L728); [test definition](../../packages/deployment-control-plane/test/authority.rs#L5) at F4.
- `key_role_and_scope_are_enforced` — [log line729](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L729); [test definition](../../packages/deployment-control-plane/test/authority.rs#L25) at F4.
- `admission_rejects_untrusted_release_bindings_without_inserting` — [log line738](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L738); [test definition](../../packages/deployment-control-plane/test/authority.rs#L46) at F4.
- `freshness::source_inclusion_requires_signed_exact_face_not_release_ancestry` — [log line736](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L736); [test definition](../../packages/deployment-control-plane/test/authority_freshness.rs#L28) at F4.
- `freshness::observed_revocation_epoch_survives_rejected_admission_and_reopen` — [log line737](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L737); [test definition](../../packages/deployment-control-plane/test/authority_freshness.rs#L4) at F4.

**Adoption observation:** R4 `package_rejects_source_binary_metadata_and_unallowlisted_target`; for CTR008 also R4 `loader_rejects_transitive_homebrew_rpath_environment_and_wrong_architecture`, `fixed_apple_utility_accepts_os_protection_flags_but_rejects_hash_drift`, `plist_loader_environment_is_rejected_from_the_exact_supplied_bytes`. See [EVD-DCP-T4-016](#evd-dcp-t4-016).
**Environment/input/result/negative cases:** F/M inputs above. Deterministic fixture role keys, exact source/face/build/review bindings and policy epochs; bad signatures/roles/scopes/coverage or retained revocation reject with no admitted unit. R4 package cases additionally reject changed source/binary and fixture trust substitution (EVD-DCP-T4-016).
**Sufficiency:** executed assertions support these named cases; inherited review scope stays S1/S2/S3, not a new independent audit.
**Limitations:** RP-02/03: fixture key separation is not real issuer custody or authenticated source/build/review provenance.

## EVD-DCP-T4-004

**Target/relation:** ACC-004, CTR-005,008; SUPPORTS the bounded F/M subclaim below under A.
**Source/provenance:** src/fs/secure.rs; src/fs/artifact.rs; src/fs/target.rs; original mechanisms S2; F4 re-execution where listed, R4 for adoption.
**Exact executed observations (each `... ok` in F4):**

- `bundle_rejects_escape_collision_extra_missing_and_oversize` — [log line776](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L776); [test definition](../../packages/deployment-control-plane/test/filesystem.rs#L91) at F4.
- `rejects_real_acl_hardlink_fifo_and_writable_payload` — [log line775](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L775); [test definition](../../packages/deployment-control-plane/test/filesystem.rs#L140) at F4.
- `every_nested_target_ancestor_is_descriptor_checked` — [log line772](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L772); [test definition](../../packages/deployment-control-plane/test/filesystem.rs#L219) at F4.
- `payload_replacement_during_hash_cannot_change_sealed_bytes` — [log line771](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L771); [test definition](../../packages/deployment-control-plane/test/filesystem.rs#L247) at F4.

**Adoption observation:** R4 `package_rejects_source_binary_metadata_and_unallowlisted_target`; for CTR008 also R4 `loader_rejects_transitive_homebrew_rpath_environment_and_wrong_architecture`, `fixed_apple_utility_accepts_os_protection_flags_but_rejects_hash_drift`, `plist_loader_environment_is_rejected_from_the_exact_supplied_bytes`. See [EVD-DCP-T4-016](#evd-dcp-t4-016).
**Environment/input/result/negative cases:** F/M inputs above. Private actual files and injected path/ACL/link/FIFO/case/bounds/replacement inputs. Unsafe inputs reject; sealed bytes remain the exact opened descriptor bytes despite source replacement. R4 adds exact package inventory/mode/destination rejection.
**Sufficiency:** executed assertions support these named cases; inherited review scope stays S1/S2/S3, not a new independent audit.
**Limitations:** RP-04: no protected initial app-slot census or complete required release-facet coverage.

## EVD-DCP-T4-005

**Target/relation:** ACC-005, CTR-007; SUPPORTS the bounded F/M subclaim below under A.
**Source/provenance:** src/service/server.rs; src/service/protocol.rs; original mechanisms S3; F4 re-execution where listed, R4 for adoption.
**Exact executed observations (each `... ok` in F4):**

- `real_socket_rejects_identity_paths_unknown_fields_and_deep_frames` — [log line815](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L815); [test definition](../../packages/deployment-control-plane/test/socket.rs#L31) at F4.
- `peer_scope_and_connection_quota_are_enforced_by_real_transport` — [log line816](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L816); [test definition](../../packages/deployment-control-plane/test/socket.rs#L74) at F4.
- `partial_disconnect_is_bounded_and_does_not_starve_status` — [log line817](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L817); [test definition](../../packages/deployment-control-plane/test/socket.rs#L59) at F4.
- `durable_disconnected_ack_reopens_after_intake_disappears` — [log line828](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L828); [test definition](../../packages/deployment-control-plane/test/train.rs#L193) at F4.

**Environment/input/result/negative cases:** F/M inputs above. Real local daemon, kernel Unix peer identity and scoped fixture config; unknown fields, caller paths, depth/quota violations reject. Partial disconnect is bounded; committed ACK survives daemon restart and removed intake without new apply authority.
**Sufficiency:** executed assertions support these named cases; inherited review scope stays S1/S2/S3, not a new independent audit.
**Limitations:** Production caller supplementary group and protected socket ownership/ACL not provisioned; RP-01/05.

## EVD-DCP-T4-006

**Target/relation:** ACC-006, CTR-008,017,019; SUPPORTS the bounded F/M subclaim below under A.
**Source/provenance:** src/transaction/native.rs; src/bootstrap/loader.rs; src/bootstrap/plist.rs; original mechanisms S2; Task4 new bootstrap; F4 re-execution where listed, R4 for adoption.
**Exact executed observations (each `... ok` in F4):**

- `launchd_periodic_parser_does_not_confuse_nested_pid_with_generation` — [log line856](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L856); [test definition](../../packages/deployment-control-plane/test/transactions.rs#L70) at F4.

**Adoption observation:** R4 `package_rejects_source_binary_metadata_and_unallowlisted_target`; for CTR008 also R4 `loader_rejects_transitive_homebrew_rpath_environment_and_wrong_architecture`, `fixed_apple_utility_accepts_os_protection_flags_but_rejects_hash_drift`, `plist_loader_environment_is_rejected_from_the_exact_supplied_bytes`. See [EVD-DCP-T4-016](#evd-dcp-t4-016).
**Environment/input/result/negative cases:** F/M inputs above. F4 native parser rejects misleading nested PID. R4 executes synthetic transitive Mach-O graphs (Homebrew, rpath, environment load commands, architecture, missing/extra images), hashed real Apple tools, supplied plist JSON/XML entities and eight dangerous environment keys: safe input accepts, each unsafe variant rejects. EVD-DCP-T4-016 pins exact package/closure.
**Sufficiency:** executed assertions support these named cases; inherited review scope stays S1/S2/S3, not a new independent audit.
**Limitations:** Only static non-system Mach-O closure and tested environment subset; RP-04/05/06. Empty emitted transition policy is not proof of installed sudoers absence.

## EVD-DCP-T4-007

**Target/relation:** ACC-007, CTR-009,010; SUPPORTS the bounded F/M subclaim below under A.
**Source/provenance:** src/fs/mutex.rs; src/transaction/mod.rs; src/service/train.rs; original mechanisms S2, S3; F4 re-execution where listed, R4 for adoption.
**Exact executed observations (each `... ok` in F4):**

- `killed_holder_releases_kernel_lock_without_unlinking_inode_or_intent` — [log line769](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L769); [test definition](../../packages/deployment-control-plane/test/filesystem.rs#L292) at F4.
- `a_different_fixture_mutex_cannot_authorize_apply` — [log line857](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L857); [test definition](../../packages/deployment-control-plane/test/transactions.rs#L120) at F4.
- `simultaneous_targets_use_one_host_mutex_and_distinct_private_targets` — [log line841](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L841); [test definition](../../packages/deployment-control-plane/test/train.rs#L293) at F4.
- `three_goals_share_one_install_two_close_one_fails_and_mutex_covers_acceptance` — [log line842](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L842); [test definition](../../packages/deployment-control-plane/test/train.rs#L109) at F4.

**Environment/input/result/negative cases:** F/M inputs above. Real processes/FD flock, two private target subtrees and three signed Goals. Wrong-root guard rejects; killed holder releases kernel lock without inode deletion. Two targets serialize through one host mutex, including acceptance/finalization. EVD-DCP-T4-015 repairs safety of the four legacy-source guard fixtures.
**Sufficiency:** executed assertions support these named cases; inherited review scope stays S1/S2/S3, not a new independent audit.
**Limitations:** RP-05: no installed legacy exclusion or actual caller lifecycle-denial proof.

## EVD-DCP-T4-008

**Target/relation:** ACC-008, CTR-010; SUPPORTS the bounded F/M subclaim below under A.
**Source/provenance:** src/queue/dependencies.rs; src/queue/lifecycle.rs; original mechanisms S1; F4 re-execution where listed, R4 for adoption.
**Exact executed observations (each `... ok` in F4):**

- `scheduling::supersession_inherits_fifo_and_rejects_cycles_without_partial_writes` — [log line803](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L803); [test definition](../../packages/deployment-control-plane/test/queue_scheduling.rs#L86) at F4.
- `scheduling::dependency_requires_exact_capability_receipt_and_goal_pass` — [log line805](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L805); [test definition](../../packages/deployment-control-plane/test/queue_scheduling.rs#L133) at F4.
- `scheduling::fifo_and_continue_independent_obey_persisted_failure_disposition` — [log line807](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L807); [test definition](../../packages/deployment-control-plane/test/queue_scheduling.rs#L21) at F4.
- `repairs::b04_replaced_runtime_cannot_satisfy_live_installation_dependency` — [log line806](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L806); [test definition](../../packages/deployment-control-plane/test/queue_repairs.rs#L216) at F4.
- `repairs::b05_revoked_recovery_and_cancel_cannot_clear_stop` — [log line799](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L799); [test definition](../../packages/deployment-control-plane/test/queue_repairs.rs#L259) at F4.

**Environment/input/result/negative cases:** F/M inputs above. Signed replacement/dependency/receipt and STOP/CONTINUE inputs retain FIFO and exact live capability semantics. Cycles, obsolete installed generation, revoked recovery and cancel-based STOP erasure reject; explicitly permitted independent continuation remains possible.
**Sufficiency:** executed assertions support these named cases; inherited review scope stays S1/S2/S3, not a new independent audit.
**Limitations:** RP-02: operational desired-state/dependency issuers not integrated.

## EVD-DCP-T4-009

**Target/relation:** ACC-009, CTR-010,011,020; SUPPORTS the bounded F/M subclaim below under A.
**Source/provenance:** src/transaction/recovery.rs; src/service/mailbox.rs; src/queue/service.rs; original mechanisms S2, S3; F4 re-execution where listed, R4 for adoption.
**Exact executed observations (each `... ok` in F4):**

- `transaction::faults::failed_sync_and_partial_records_are_retained_and_never_replayed` — [log line699](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L699); [test definition](../../packages/deployment-control-plane/test/transaction_faults.rs#L369) at F4.
- `transaction::repair::prior_rolled_back_mutation_cannot_quarantine_current_no_effect_preflight` — [log line72](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L72); [test definition](../../packages/deployment-control-plane/test/transaction_repair.rs#L269) at F4.
- `service::mailbox_tests::visible_rename_with_failed_directory_flush_is_reflushed_on_retry` — [log line14](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L14); [test definition](../../packages/deployment-control-plane/test/common/mailbox.rs#L64) at F4.
- `repair::admitted_temporary_records_resume_after_real_daemon_restart_and_concurrent_submit` — [log line835](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L835); [test definition](../../packages/deployment-control-plane/test/common/service_repair.rs#L28) at F4.
- `repair::newer_late_coverage_survives_completion_of_an_older_verification_claim` — [log line849](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L849); [test definition](../../packages/deployment-control-plane/test/common/service_repair.rs#L181) at F4.

**Environment/input/result/negative cases:** F/M inputs above. Owned child crash exits, failed fsync/partial durable records, prior terminal journals, concurrent complete/partial mailbox residuals and overlapping verification generations. Recovery retains exact budgets/evidence and no blind replay; prefix mismatch refuses; old completion cannot delete newer acknowledged work. publication.lock remains permanent/protected in the prospective layout.
**Sufficiency:** executed assertions support these named cases; inherited review scope stays S1/S2/S3, not a new independent audit.
**Limitations:** Emulated syscall faults/reachable crash residue are not hardware power loss or production mutation proof. Original failed T3 log37 stays failed; only unaffected passing sections plus log38 supply final affected coverage.

## EVD-DCP-T4-010

**Target/relation:** ACC-010, CTR-012,013; SUPPORTS the bounded F/M subclaim below under A.
**Source/provenance:** src/transaction/apply.rs; src/transaction/recovery.rs; src/transaction/process.rs; original mechanisms S2; F4 re-execution where listed, R4 for adoption.
**Exact executed observations (each `... ok` in F4):**

- `partial_install_disk_failure_restores_exact_preimage_without_unrelated_writes` — [log line858](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L858); [test definition](../../packages/deployment-control-plane/test/transactions.rs#L178) at F4.
- `rollback_deletes_only_exact_transaction_created_absent_slot` — [log line863](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L863); [test definition](../../packages/deployment-control-plane/test/transactions.rs#L232) at F4.
- `unrelated_post_apply_drift_quarantines_and_preserves_bytes` — [log line860](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L860); [test definition](../../packages/deployment-control-plane/test/transactions.rs#L44) at F4.
- `restored_generation::restored_a_uses_fresh_process_for_late_verification_without_reclosing_original_goal` — [log line864](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L864); [test definition](../../packages/deployment-control-plane/test/restored_generation.rs#L32) at F4.
- `transaction::repair::maximum_admitted_slots_roundtrip_success_and_rollback_journal` — [log line702](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L702); [test definition](../../packages/deployment-control-plane/test/transaction_repair.rs#L93) at F4.

**Environment/input/result/negative cases:** F/M inputs above. Actual private slot bytes, ABSENT creation, injected disk failure/drift, owned child identity and 4096 slots. Exact preimage/metadata restores; unrelated drift quarantines and remains intact. Full F4 run reloads 12298 apply and 20494 rollback lifecycle records. Restored A binds its fresh process without reclosing the original Goal.
**Sufficiency:** executed assertions support these named cases; inherited review scope stays S1/S2/S3, not a new independent audit.
**Limitations:** RP-01/04/06: fixture service driver simulates launchd; actual Runtime/W1/W2 generation/exit/rollback remains P-only. The slow test was not rerun in this repair.

## EVD-DCP-T4-011

**Target/relation:** ACC-011, CTR-014,015; SUPPORTS the bounded F/M subclaim below under A.
**Source/provenance:** src/queue/receipts.rs; src/service/train.rs; src/service/mailbox.rs; original mechanisms S1, S3; F4 re-execution where listed, R4 for adoption.
**Exact executed observations (each `... ok` in F4):**

- `receipts::outbox_closure_is_signed_idempotent_and_never_reinstalls` — [log line793](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L793); [test definition](../../packages/deployment-control-plane/test/queue_receipts.rs#L4) at F4.
- `repairs::b02_current_attempt_needs_its_own_transaction_and_goal_readback_receipts` — [log line796](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L796); [test definition](../../packages/deployment-control-plane/test/queue_repairs.rs#L119) at F4.
- `absent_verifier_finalizes_waiting_without_local_success_and_late_pass_closes_once` — [log line839](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L839); [test definition](../../packages/deployment-control-plane/test/train.rs#L18) at F4.
- `unknown_external_canary_is_never_reissued_or_overwritten` — [log line840](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L840); [test definition](../../packages/deployment-control-plane/test/train.rs#L174) at F4.
- `repair::closure_temporary_records_resume_after_real_daemon_restart_without_reinstall` — [log line848](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L848); [test definition](../../packages/deployment-control-plane/test/common/service_repair.rs#L73) at F4.

**Environment/input/result/negative cases:** F/M inputs above. Separate signed fixture Goal outcomes, WAITING without external verifier, immutable attempt/generation receipts, producer CAS ACK and restart residuals. Stale attempt/process/Goal ACK rejects; signed late PASS closes once with no reinstall; unknown quarantines and cannot be overwritten or reissued.
**Sufficiency:** executed assertions support these named cases; inherited review scope stays S1/S2/S3, not a new independent audit.
**Limitations:** RP-02: no real external business/canary observations or protected transport bridges. No messages, Grants or external canary writes executed.

## EVD-DCP-T4-012

**Target/relation:** ACC-012, CTR-016,017; SUPPORTS the bounded F/M subclaim below under A.
**Source/provenance:** src/service/intake.rs; src/transaction/mod.rs; src/bootstrap/verify.rs; original mechanisms S1, S3; Task4 package; F4 re-execution where listed, R4 for adoption.
**Exact executed observations (each `... ok` in F4):**

- `authenticated_policy_epoch_cannot_roll_back_or_equivocate` — [log line735](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L735); [test definition](../../packages/deployment-control-plane/test/authority.rs#L87) at F4.
- `production_entry_refuses_unprivileged_and_path_overrides` — [log line814](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L814); [test definition](../../packages/deployment-control-plane/test/socket.rs#L6) at F4.

**Adoption observation:** R4 `package_rejects_source_binary_metadata_and_unallowlisted_target`; for CTR008 also R4 `loader_rejects_transitive_homebrew_rpath_environment_and_wrong_architecture`, `fixed_apple_utility_accepts_os_protection_flags_but_rejects_hash_drift`, `plist_loader_environment_is_rejected_from_the_exact_supplied_bytes`. See [EVD-DCP-T4-016](#evd-dcp-t4-016).
**Environment/input/result/negative cases:** F/M inputs above. Signed fixture policy epoch replay/equivocation rejects; nonroot production entry and caller path overrides reject. R4 package disabled plist/no activation/no private keys and null trust fields remain nonready; injection of fixture keys or clearing blockers rejects (EVD-DCP-T4-016).
**Sufficiency:** executed assertions support these named cases; inherited review scope stays S1/S2/S3, not a new independent audit.
**Limitations:** RP-01–08 remain open. This is no signed Owner bootstrap receipt and grants no activation or per-head approval authority.

## EVD-DCP-T4-013

**Target/relation:** ACC-013, CTR-018; SUPPORTS the bounded F/M subclaim below under A.
**Source/provenance:** four guarded legacy sources; src/bootstrap/prospective.rs; original mechanisms Task4 adoption/census; F4 re-execution where listed, R4 for adoption.
**Exact observations:** R4 e2e three named source-guard/lock tests, [EVD-DCP-T4-015](#evd-dcp-t4-015); controller [known-path metadata/hash refresh][census] at2026-09-17T15:36:27Z and [census investigation](../investigations/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_CENSUS.md).
**Environment/input/result/negative cases:** F/M inputs above. R4 runs complete copied legacy sources with marker present and guard excerpts for absent versus caller-owned/unreadable parents. All four deny exercised enrolled/unsafe states; true absent marker-parent permits only the sentinel. Known-path controller inventory records six external and four installed helper coordinates; no exhaustive host claim. EVD-DCP-T4-015 supersedes the unsafe fixture execution boundary only.
**Sufficiency:** executed assertions support these named cases; inherited review scope stays S1/S2/S3, not a new independent audit.
**Limitations:** RP-05: actual sudoers/jobs/writers/write/launchctl/signal denial unproved. Service-parent505/root lifecycle and agent-child502 are separate; gui/502 svc-workflow ineligible, auth-service disabled. F-02 broader shell lookup/non-directory handling is deferred.

## EVD-DCP-T4-014

**Target/relation:** ACC-014, CTR-019,020; SUPPORTS the bounded F/M subclaim below under A.
**Source/provenance:** src/service/server.rs; src/queue/receipts.rs; src/bootstrap/verify.rs; original mechanisms S1, S2, S3; Task4 package; F4 re-execution where listed, R4 for adoption.
**Exact executed observations (each `... ok` in F4):**

- `receipts::queue_quota_rejects_new_work_and_wrong_revision_cannot_move_state` — [log line785](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L785); [test definition](../../packages/deployment-control-plane/test/queue_receipts.rs#L164) at F4.
- `receipts::transport_request_rate_limit_is_persisted_even_when_units_collapse` — [log line788](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L788); [test definition](../../packages/deployment-control-plane/test/queue_receipts.rs#L185) at F4.
- `transaction::faults::owned_action_timeout_reaches_transaction_quarantine_and_no_replay` — [log line47](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log#L47); [test definition](../../packages/deployment-control-plane/test/transaction_faults.rs#L463) at F4.

**Adoption observation:** R4 `package_rejects_source_binary_metadata_and_unallowlisted_target`; for CTR008 also R4 `loader_rejects_transitive_homebrew_rpath_environment_and_wrong_architecture`, `fixed_apple_utility_accepts_os_protection_flags_but_rejects_hash_drift`, `plist_loader_environment_is_rejected_from_the_exact_supplied_bytes`. See [EVD-DCP-T4-016](#evd-dcp-t4-016).
**Environment/input/result/negative cases:** F/M inputs above. Quota/rate/revision bounds and owned-operation timeout reject/quarantine without replay. R4 rejects enlarged/malformed loader/plist/package inputs and nonempty transition sudoers, retains explicit nonreadiness. F4 durable journals/outbox/preimages remain retained; no new cleanup or privileged command path.
**Sufficiency:** executed assertions support these named cases; inherited review scope stays S1/S2/S3, not a new independent audit.
**Limitations:** RP-05: actual installed-rule absence/protected retention/disk state and native lifecycle remain unproved. F-01 recipe read-before-size-bound remains a declared nonprivileged follow-up; this row does not claim every input read is bounded.

## EVD-DCP-T4-015

**Target/relation:** T4-B01 and ACC-007/013 fixture safety; SUPPORTS repaired boundary;
retains [EVD-T4R-002][review] as CONTRADICTS the old8db5ada boundary.
**Source/coordinates:** R4 `test/adoption/fixture.rs` entire77-line helper;
`bootstrap.rs::bundle` and both fixed-tool tests; `e2e.rs` all3 entries.
**Environment/input/result:** [64][repair], euid502, hostile TMPDIR=/private/tmp;
`fixture::root_refusal_precedes_effect_without_root_execution` injects0 into the
same guard used before real fixture effects and verifies its harmless closure is
never reached. This is not a root process/probe. `outside_kernel_temp_is_rejected_before_creation`
returns FIXTURE_OUTSIDE_TEMP for explicit `/private/tmp` without creating/opening
an outside directory. `kernel_selected_temp_ignores_caller_tmpdir` creates0700
inside Darwin confstr root and passes FixtureRoots descriptor validation.
These are distinct observations: hostile TMPDIR is ignored, explicit outside base
is rejected; the old selected selftest may now safely pass in the kernel root.
`original_nonroot_lock_selftest_remains_available_before_enrollment` runs the full
copied installer after replacing only its scratch stamp literal (plus existing
marker relocation); inverse replacement recovers every original source byte,
SELFTEST_LOCK=PASS, cleanup leaves only the copied script. Production script unchanged.
`enrolled_legacy_sources_refuse_before_any_effect` and
`unreadable_or_caller_owned_parent_denies_but_true_absence_preserves_legacy` preserve
four-source marker and0700/000 parent rejection versus absent-parent sentinel.
**Sufficiency/provenance:** implementer executed15/15 (12 unique); logs61/62/63 retain
failed intermediate test scaffolds.61 fails3 boundary cases;62 unexpectedly fails
UNSAFE_MODE because tempfile defaults0755;63 reaches the intended unrelocated-stamp
assertion after explicit creation-mode0700. All are pre-R4 working-tree states,
not executions of the final commit; only R4 GREEN is final-source proof.
**Limitations:** no root execution, production marker, live retirement or blanket
shell lookup-error proof; F-02/RP-05 remain open. No universal fixture claim about
unmodified prior-task harnesses is added.

## EVD-DCP-T4-016

**Target/relation:** ACC-003/004/006/012/014 and T4-B02 exact preparation binding;
SUPPORTS integrity and explicitly REFUTES readiness inference from inert output.
**Source/coordinates:** P4; `src/bootstrap/{bundle,verify,loader,plist,prospective}.rs`
unchanged from8db5ada; R4 `test/adoption/bootstrap.rs`6 behavioral cases (plus3
fixture helper cases). [64][repair] exact named positives/negatives pass;
[70 prepare][prepare]/[71 verify][verify] bind the real replacement package.
**Environment/input:** nonroot macOS; source revisionR4,84 source files; retained
22 x86_64 Node/dylib images, original controller/prepare binary build8db5ada,
fixed platform hashes, unchanged unresolved prospective dsh-runtime profile.
[Equivalence receipt][equivalence] proves only3 test files differ in the package;
all production source/Cargo inputs are identical, both binary hashes rechecked.
**Observed result:**23 payloads/25 files exact; manifest
`1b4b4e1608f9335eb4db8aba319b0e19a0e8610ccefac2c1df2c25e6bbe949c6`, source digest
`da70fad9b07a064a07489c14aff006cc1781a66ca359e7d44522bb7fed1bebb7`;
local directory `/private/var/folders/jh/5k4x44w12ps1kbrch8__f6b80000gp/T/agent-deployd-task4-repair-wscow2bn`.
Source/binary/hash/metadata, arbitrary target, GUI enablement, nonempty sudoers,
missing lifecycle/legacy entries, fixture keys, cleared blockers and extra secret
file all reject in R4; disabled plist and ordinary supplied environment accept;
unsafe load/environment inputs reject. P4 is integrity_verified=true and
bootstrap_ready=false with8 unchanged blockers. Old package `ea4e075f…f18d`
remains historical8db5ada evidence and is not claimed to match the repaired checkout.
**Sufficiency/provenance:** implementer command outputs plus per-payload hash/size
readback in retained `assemble-repair-package.py`; [recipe][recipe]/[manifest][manifest]
provide full reviewable inputs. Independent trust/build/provenance is not inferred.
**Limitations:** RP-01–08 all remain open: host enrollment/startup enforcement;
real issuer contracts/custody and **unimplemented upstream-to-mailbox bridges**;
authenticated source/build/review; complete app/JS/addon/harness release closure;
protected legacy/lifecycle denial; transformed Node trust/runtime validation;
controller-owned whole-branch review; separately signed exact Owner bootstrap.
No Node candidate execution, activation, privileged action or P-only PASS occurred.

[t1]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-1-report.md
[r1]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-1-rereview.md
[t2]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-2-report.md
[r2]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-2-r01-rereview.md
[t3]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-3-report.md
[r3]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-3-rereview.md
[review]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-review.md
[census]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task4-legacy-file-observation.json
[full]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/35-final-full-suite.log
[gates]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/final-gates.json
[a4]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/49-final-adoption-green.log
[repair]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/64-repair-adoption-green.log
[package]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/repair-artifacts.json
[prepare]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/70-repair-package-prepare.log
[verify]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/71-repair-package-verify.log
[equivalence]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/69-repair-binary-source-equivalence.json
[recipe]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/repair-recipe.json
[manifest]: ../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-evidence/repair-manifest.json


## Frozen final repair coordinates (current)

These new relations supplement, and do not rewrite, historical EVD-DCP-T4-001–016.
The original review findings EVD-DCP-FINAL-B01–B09 remain contrary evidence at
FIX_BASE `c5cab2eef3a5e7b502016571e1f24dd31b3e0560`. The new FR relations below
support the proposed closure at exact source `277a5e8832938e6b2232d11949aedfb92cd0e318`;
only the controller's scoped independent re-audit can issue a review verdict.
A is unchanged. F/M environment remains nonroot macOS arm64/euid502, with kernel
private0700 fixtures, synthetic fixture signers and simulated launchd services.
No P execution, production issuer bridge, authentic custody or actual readiness is claimed.

Source and SHA256 inventory: [26-frozen-source.json](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/26-frozen-source.json). Serial commands, UTC timestamps, source and exit statuses: [32-final-gates.json](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/32-final-gates.json). All five build/test/quality/release commands exit0; no executable edit occurred during these gates. [28-final-full-suite.log](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log) records **168 passing top-level test executions**: lib35, authority17, bootstrap13, e2e8, filesystem17, queue30, socket9, train25, transactions14; three binary targets contain0 tests. Child-worker summaries are excluded; shared helper cases appear in multiple targets. Directed01–25 working-tree observations retain genuine failures and do not claim commit-bound final execution.

Structure/governance: [36-structure-authority.json](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/36-structure-authority.json) and [37-rust-structure.json](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/37-rust-structure.json). Governance integrity and exact accepted Spec identity pass. Repository structure exits1 for three unchanged baseline directory violations (production-runtime/src21, production-runtime/test23, scripts59); no global PASS. Supplemental87 Rust files have maximum479lines/20immediatechildren/depth2.

## EVD-DCP-FR-B01

**Target/relation:** ACC-012; CTR-017; SUPPORTS bounded F/M closure of DCP-FINAL-B01 under A.

**Source/mechanism:** Implemented typed ResolvedPreparation, independently pinned preparation trust, nine role-separated signed prerequisite statements, exact source/package/config/enrollment/release/custody/plan bindings, review independence and freshness. Disabled profile and activation_allowed=false even for ready synthetic input. Owner receipt moved to subsequent activation boundary. bootstrap/preparation.rs, binding.rs, verify.rs and prepare CLI.

**Executed observations at the frozen source:**

- `resolved_tests::resolved_fixture_is_ready_to_authorize_but_cannot_activate` — [final log line586](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L586); [definition at source freeze](../../packages/deployment-control-plane/test/common/preparation.rs#L203).
- `package_has_no_activation_or_secrets_and_parses_as_disabled_plist` — [final log line582](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L582); [definition at source freeze](../../packages/deployment-control-plane/test/adoption/bootstrap.rs#L133).

**Inputs/results/rejecting cases and development provenance:** 09/14/17 preparation logs: synthetic ready, omission/forgery/cross-binding/expiry and inert candidate rejection. Final full run is pinned above.

**Sufficiency:** named assertions executed in final log28 support only these fixture inputs and rejection boundaries. The source inventory and command manifest above bind the final result; development failures remain separately retained. No independent verdict is supplied by the implementer.

**Limitations:** RP-01–07 are real missing readiness inputs. The signed positive fixture is test-only; RP-08 is subsequent exact Owner activation authorization, never a preauthorization-readiness requirement.

## EVD-DCP-FR-B02

**Target/relation:** ACC-004,010; CTR-005,008; SUPPORTS bounded F/M closure of DCP-FINAL-B02 under A.

**Source/mechanism:** Protected enrollment now owns exact regular-file slots, explicit ABSENT, mutable/retained overlay semantics, mode/GID, root owner and absent ACL. Executor resolves manifest slots before service effects, preserves complete required face and checks unchanged files, bounds whole face and retains metadata/rollback. Native unsupported required facets block. transaction/slots.rs, native_profile.rs, apply.rs, journal.rs; fs/target.rs.

**Executed observations at the frozen source:**

- `transaction::final_repair_tests::manifest_cannot_expand_protected_mapping` — [final log line499](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L499); [definition at source freeze](../../packages/deployment-control-plane/test/common/final_transaction.rs#L117).
- `transaction::final_repair_tests::metadata_executable_and_absent_sibling_reject_before_write` — [final log line500](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L500); [definition at source freeze](../../packages/deployment-control-plane/test/common/final_transaction.rs#L209).
- `transaction::final_repair_tests::exact_mapping_rejects_metadata_drift_and_allows_explicit_absent_addition` — [final log line494](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L494); [definition at source freeze](../../packages/deployment-control-plane/test/common/final_transaction.rs#L238).
- `transaction::final_repair_tests::exact_slots_retain_private_mode_and_complete_unchanged_face` — [final log line495](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L495); [definition at source freeze](../../packages/deployment-control-plane/test/common/final_transaction.rs#L139).
- `transaction::repair::maximum_admitted_slots_roundtrip_success_and_rollback_journal` — [final log line516](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L516); [definition at source freeze](../../packages/deployment-control-plane/test/transaction_repair.rs#L93).

**Inputs/results/rejecting cases and development provenance:** 05 exact extra-slot RED, 06 GREEN; 12 expanded test had missing Goal receipt (a legitimate fixture failure), corrected15 and16 pass. Extra existing/ABSENT sibling, metadata/executable, unchanged drift, private0600, explicit absence restoration. Final4096 mapping is exercised below.

**Sufficiency:** named assertions executed in final log28 support only these fixture inputs and rejection boundaries. The source inventory and command manifest above bind the final result; development failures remain separately retained. No independent verdict is supplied by the implementer.

**Limitations:** Actual meaningful release selection/complete initial face remains RP-04. Only regular app slots plus retained Node and service-plist facets are supported; required unsupported facets block. Simulated launchd cannot prove native generations.

## EVD-DCP-FR-B03

**Target/relation:** ACC-002,006,013; CTR-002,003,008,018; SUPPORTS bounded F/M closure of DCP-FINAL-B03 under A.

**Source/mechanism:** One shared structural binding for preparation, intake and physical executor; fixed repo/runtime/root/strategy/launchd mapping, kernel-observed host UUID digest, exact profile revision/digest and caller/service disjointness; protected lifecycle-denial receipt remains required. bootstrap/binding.rs; intake and production Executor.

**Executed observations at the frozen source:**

- `resolved_tests::signed_foreign_driver_and_socket_counterexamples_refuse` — [final log line587](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L587); [definition at source freeze](../../packages/deployment-control-plane/test/common/preparation.rs#L287).

**Inputs/results/rejecting cases and development provenance:** Preparation negative cases reject foreign host/root/repo/strategy/overlap and caller502/service502;505/root accepted structurally. No actual privileged identity/lifecycle proof.

**Sufficiency:** named assertions executed in final log28 support only these fixture inputs and rejection boundaries. The source inventory and command manifest above bind the final result; development failures remain separately retained. No independent verdict is supplied by the implementer.

**Limitations:** RP-01/05 require authentic protected enrollment and lifecycle exclusion. Local host/UID metadata and fixture identity do not prove production authority.

## EVD-DCP-FR-B04

**Target/relation:** ACC-005,006,012; CTR-007,008,017; SUPPORTS bounded F/M closure of DCP-FINAL-B04 under A.

**Source/mechanism:** Only canonical /private/var/run can use root:daemon0775 exception. Exact device/inode/flags/no-ACL and fresh membership exclusion for nonroot enrolled callers/services; dedicated root-owned0750 child and retained descriptor rechecks. Root W2 explicitly trusted root code. Generic Dir checks unchanged. bootstrap/socket.rs; service/server.rs.

**Executed observations at the frozen source:**

- `resolved_tests::signed_foreign_driver_and_socket_counterexamples_refuse` — [final log line587](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L587); [definition at source freeze](../../packages/deployment-control-plane/test/common/preparation.rs#L287).
- `bootstrap::socket::tests::equivalent_private_descriptor_binding_rejects_replacement_mode_and_acl` — [final log line9](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L9); [definition at source freeze](../../packages/deployment-control-plane/test/common/socket_ancestor.rs#L5).

**Inputs/results/rejecting cases and development provenance:** 13 descriptor fixture: equivalent metadata accepted, replacement/mode/ACL rejected and generic Dir still rejects0775. Preparation cases refuse absent proof/group-write/ACL/wrong group. No privileged production socket bind.

**Sufficiency:** named assertions executed in final log28 support only these fixture inputs and rejection boundaries. The source inventory and command manifest above bind the final result; development failures remain separately retained. No independent verdict is supplied by the implementer.

**Limitations:** Fixture descriptor proof uses nonroot equivalent metadata and cannot satisfy the root-owned production policy. Public /private/var/run census is time-bound metadata only; startup still requires protected exact facts and fresh group membership. Root W2 remains a trusted root-code boundary.

## EVD-DCP-FR-B05

**Target/relation:** ACC-003,008,009; CTR-006,010,011; SUPPORTS bounded F/M closure of DCP-FINAL-B05 under A.

**Source/mechanism:** Final definite policy refusal appends durable NoMutation, atomically BLOCKED/fence cleanup, then drops active state. Storage errors retain recovery fence; no preflight/mutation budget reset. transaction/apply.rs; queue/executor_finalization.rs.

**Executed observations at the frozen source:**

- `transaction::final_repair_tests::final_prewrite_expiry_releases_active_with_durable_blocked` — [final log line496](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L496); [definition at source freeze](../../packages/deployment-control-plane/test/common/final_transaction.rs#L4).
- `transaction::final_repair_tests::no_mutation_failed_flush_never_reports_safe_blocked` — [final log line501](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L501); [definition at source freeze](../../packages/deployment-control-plane/test/common/final_transaction.rs#L326).

**Inputs/results/rejecting cases and development provenance:** 01 RED PRECHECK vs BLOCKED;02/16 GREEN, same-daemon corrected-policy retry,0 initial mutations; injected NoMutation fsync failure remains PRECHECK/active/fenced and no write.

**Sufficiency:** named assertions executed in final log28 support only these fixture inputs and rejection boundaries. The source inventory and command manifest above bind the final result; development failures remain separately retained. No independent verdict is supplied by the implementer.

**Limitations:** The injected failed flush deliberately retains PRECHECK, active state and recovery fence; definite policy refusal alone is safe BLOCKED. No hardware power-loss guarantee or automatic unknown replay is inferred.

## EVD-DCP-FR-B06

**Target/relation:** ACC-008,009; CTR-010,011; SUPPORTS bounded F/M closure of DCP-FINAL-B06 under A.

**Source/mechanism:** Protected bounded signed recovery mailbox consumed by Train under permanent mutex; exact current failed status/cause, byte/service restoration and owned operation binding, fresh policy, receipt dedupe and existing budgets. Known failure cause is durable before rollback. External issuer transport remains unimplemented pending real contract. transaction/remediation.rs; service/intake.rs/train.rs; queue/service.rs.

**Executed observations at the frozen source:**

- `remediation_tests::protected_recovery_mailbox_resumes_preflight_without_daemon_restart` — [final log line695](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L695); [definition at source freeze](../../packages/deployment-control-plane/test/common/remediation.rs#L49).
- `remediation_tests::protected_recovery_mailbox_resumes_known_rollback` — [final log line693](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L693); [definition at source freeze](../../packages/deployment-control-plane/test/common/remediation.rs#L93).
- `remediation_tests::recovery_mailbox_cannot_reset_exhausted_mutating_budget` — [final log line702](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L702); [definition at source freeze](../../packages/deployment-control-plane/test/common/remediation.rs#L130).

**Inputs/results/rejecting cases and development provenance:** 11/20/24 real private daemon/socket cases: same-daemon preflight and rollback recovery, wrong revision/cause/signature/expiry/unknown disposition refusal, replay and exhausted second mutation budget cannot install. No direct Queue::retry call substitutes for daemon integration.

**Sufficiency:** named assertions executed in final log28 support only these fixture inputs and rejection boundaries. The source inventory and command manifest above bind the final result; development failures remain separately retained. No independent verdict is supplied by the implementer.

**Limitations:** RP-02 actual issuer protocol/authentication/custody and upstream-to-mailbox bridge remain unknown. The daemon-side route is implemented; tests use synthetic keys and real private daemon/socket transport. Unknown canary and exhausted budget stay blocked.

## EVD-DCP-FR-B07

**Target/relation:** ACC-010,011; CTR-011,014; SUPPORTS bounded F/M closure of DCP-FINAL-B07 under A.

**Source/mechanism:** Known precommit physical/health failure records cause and invokes exact guarded rollback; failed finalization commit/fsync stays latched with fence. transaction/recovery.rs; service/train.rs.

**Executed observations at the frozen source:**

- `transaction::final_repair_tests::known_final_health_failure_restores_without_closure` — [final log line497](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L497); [definition at source freeze](../../packages/deployment-control-plane/test/common/final_transaction.rs#L58).
- `transaction::final_repair_tests::known_final_health_timeout_restores` — [final log line498](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L498); [definition at source freeze](../../packages/deployment-control-plane/test/common/final_transaction.rs#L274).
- `transaction::finalization_tests::internal_applied_is_not_public_success_or_dependency_until_finalized` — [final log line509](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L509); [definition at source freeze](../../packages/deployment-control-plane/test/transaction_finalization.rs#L8).

**Inputs/results/rejecting cases and development provenance:** 01 RED VERIFYING vs ROLLED_BACK;02/16 GREEN. Actual fixture bytes restored, signed Goal PASS never closes, known HEALTH_TIMEOUT restores; retained finalization ambiguity tests in final suite.

**Sufficiency:** named assertions executed in final log28 support only these fixture inputs and rejection boundaries. The source inventory and command manifest above bind the final result; development failures remain separately retained. No independent verdict is supplied by the implementer.

**Limitations:** Known precommit failures are distinct from ambiguous commit/fsync outcomes, which retain the fence/latch. All native launchd/production rollback proof remains unexecuted.

## EVD-DCP-FR-B08

**Target/relation:** ACC-006,007,011,014; CTR-008,009,014,020; SUPPORTS bounded F/M closure of DCP-FINAL-B08 under A.

**Source/mechanism:** Shared health reader uses absolute monotonic deadline over connect/partial write/every read and bounds response bytes. Fixed production8790 route unchanged. transaction/health.rs/native.rs.

**Executed observations at the frozen source:**

- `transaction::health::tests::bounded_reader_accepts_health_and_rejects_known_failure` — [final log line512](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L512); [definition at source freeze](../../packages/deployment-control-plane/test/common/health.rs#L26).
- `transaction::health::tests::dribbling_peer_cannot_extend_total_deadline` — [final log line513](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L513); [definition at source freeze](../../packages/deployment-control-plane/test/common/health.rs#L4).
- `transaction::final_repair_tests::known_final_health_timeout_restores` — [final log line498](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L498); [definition at source freeze](../../packages/deployment-control-plane/test/common/final_transaction.rs#L274).

**Inputs/results/rejecting cases and development provenance:** 03 dribbling-peer RED (0.53s completion with generic IO refusal for100ms budget);04 GREEN (~0.14s), ephemeral loopback only. Final suite includes healthy/known-failure parse and timeout rollback cases.

**Sufficiency:** named assertions executed in final log28 support only these fixture inputs and rejection boundaries. The source inventory and command manifest above bind the final result; development failures remain separately retained. No independent verdict is supplied by the implementer.

**Limitations:** Ephemeral loopback tests only; no production8790 probe. A bounded fixture driver cannot establish native launchd acceptance.

## EVD-DCP-FR-B09

**Target/relation:** Fixture confinement required by implementation mandate; supports execution validity across ACC-001–014; SUPPORTS bounded F/M closure of DCP-FINAL-B09 under A.

**Source/mechanism:** All owned fixture allocations now use shared early nonroot guard and kernel-selected0700 parent/child policy; TMPDIR cannot select roots. Existing worker entries validate FixtureRoots before effects. Common/adoption/queue/filesystem/transaction/service helpers consolidated. fs/mod.rs and test/common/private.rs.

**Executed observations at the frozen source:**

- `common::private::hostile_tmpdir_is_ignored_before_first_fixture_effect` — [final log line10](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L10); [definition at source freeze](../../packages/deployment-control-plane/test/common/private.rs#L82).
- `common::private::kernel_selected_temp_ignores_caller_tmpdir` — [final log line12](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L12); [definition at source freeze](../../packages/deployment-control-plane/test/common/private.rs#L59).
- `common::private::outside_kernel_temp_is_rejected_before_creation` — [final log line13](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L13); [definition at source freeze](../../packages/deployment-control-plane/test/common/private.rs#L50).
- `common::private::root_refusal_precedes_effect_without_root_execution` — [final log line14](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L14); [definition at source freeze](../../packages/deployment-control-plane/test/common/private.rs#L40).

**Inputs/results/rejecting cases and development provenance:** 21 safe injected-euid0 closure does not run, outside kernel base refuses before creation, hostile TMPDIR child runs only in kernel-private0700 root. No actual root execution.

**Sufficiency:** named assertions executed in final log28 support only these fixture inputs and rejection boundaries. The source inventory and command manifest above bind the final result; development failures remain separately retained. No independent verdict is supplied by the implementer.

**Limitations:** Root refusal is exercised by a safe injected effective UID with a no-effects closure; no actual root process runs. Shared helper cases execute in multiple test targets and are not unique test definitions.

## EVD-DCP-FR-010

**Target/relation:** ACC-003,006,012; CTR-004,006,008,017,019. SUPPORTS source/package identity and inertness; does not support actual BOOTSTRAP_READY.

**Source/provenance:** freshly built controller and prepare CLI at `277a5e8832938e6b2232d11949aedfb92cd0e318`; [31-final-release.log](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/31-final-release.log), [38-final-recipe.json](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/38-final-recipe.json), [39-package-prepare.log](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/39-package-prepare.log), [40-package-verify.log](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/40-package-verify.log) and [41-final-package.json](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/41-final-package.json). All96 bound source files were rehashed against the checkout; all23 payloads verified. The22 transformed Node closure files retain their prior exact bytes and were rehashed; no new trusted transform attestation is invented. Historical package and build-source claims remain preserved.

- `manifest_digest`: `6e6411dda70109e27a21fd7200e4d3e8acf4132ff42bfbf289b2331ed3a8f202`.
- `source_digest`: `de530f88605ac12d5267af9e40fed0195f9629eec7dca76bfc871d00e7eb9af6`.
- `controller_sha256`: `09219f333fc0864197d024a8178ad7bee27a3c31c35585fbcbca7834deaaee30`.
- `prepare_cli_sha256`: `b9a4bba70208fc2150d964d38aa096004abd163616868927118f983977b27cae`.
- `package_path`: `/private/var/folders/jh/5k4x44w12ps1kbrch8__f6b80000gp/T/agent-deployd-final-repair-j_4n_knv`.

**Result/negative boundary:** integrity_verified=true, bootstrap_ready=false, activation_allowed=false, preparation_digest=null. Disabled profile, null issuer keys/custody and empty transition_sudoers remain enforced. Current unresolved verifier reports seven readiness blockers; the historical eight-item output is historical because Owner execution authorization is a future activation prerequisite.

**Sufficiency/limits:** exact inert package is inspectable and bound to current code; actual RP-01–06 facts and RP-07 scoped independent verdict remain pending. RP-08 exact Owner execution/staging/rollback/activation/canary remains a later operation gate. No install, bootstrap, privileged mutation or live acceptance occurs.

## Final re-execution of inherited acceptance observations

These supplemental coordinates re-execute the named assertion subclaims inherited
from T4 at the new frozen source. Historical EVD scopes and limitations remain;
no whole-ACC or P PASS follows. Each name links its exact current definition and
final raw observation; additional repair relations above qualify affected boundaries.

### ACC-001 / EVD-DCP-T4-001 final-source supplement

- `producer_cas_snapshot_watermark_and_pagination_are_persistent` — [final log line640](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L640); [definition at source freeze](../../packages/deployment-control-plane/test/queue.rs#L168).
- `authenticated_producer_watermark_and_forged_build_cannot_be_bypassed` — [final log line683](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L683); [definition at source freeze](../../packages/deployment-control-plane/test/train.rs#L255).

### ACC-002 / EVD-DCP-T4-002 final-source supplement

- `concurrent_duplicates_survive_reopen_and_actor_idempotency_conflicts` — [final log line637](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L637); [definition at source freeze](../../packages/deployment-control-plane/test/queue.rs#L87).
- `a_b_a_allocates_daemon_intents_from_trusted_desired_state` — [final log line631](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L631); [definition at source freeze](../../packages/deployment-control-plane/test/queue.rs#L149).
- `repairs::b01_supersession_preserves_all_late_goal_and_actor_links` — [final log line648](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L648); [definition at source freeze](../../packages/deployment-control-plane/test/queue_repairs.rs#L82).
- `service_cases::late_coverage_reuses_exact_original_attachment_and_never_reinstalls` — [final log line715](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L715); [definition at source freeze](../../packages/deployment-control-plane/test/service_cases.rs#L51).

### ACC-003 / EVD-DCP-T4-003 final-source supplement

- `forged_or_changed_signed_payload_is_rejected` — [final log line560](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L560); [definition at source freeze](../../packages/deployment-control-plane/test/authority.rs#L5).
- `key_role_and_scope_are_enforced` — [final log line568](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L568); [definition at source freeze](../../packages/deployment-control-plane/test/authority.rs#L25).
- `admission_rejects_untrusted_release_bindings_without_inserting` — [final log line552](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L552); [definition at source freeze](../../packages/deployment-control-plane/test/authority.rs#L46).
- `freshness::source_inclusion_requires_signed_exact_face_not_release_ancestry` — [final log line566](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L566); [definition at source freeze](../../packages/deployment-control-plane/test/authority_freshness.rs#L28).
- `freshness::observed_revocation_epoch_survives_rejected_admission_and_reopen` — [final log line563](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L563); [definition at source freeze](../../packages/deployment-control-plane/test/authority_freshness.rs#L4).

### ACC-004 / EVD-DCP-T4-004 final-source supplement

- `bundle_rejects_escape_collision_extra_missing_and_oversize` — [final log line608](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L608); [definition at source freeze](../../packages/deployment-control-plane/test/filesystem.rs#L93).
- `rejects_real_acl_hardlink_fifo_and_writable_payload` — [final log line622](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L622); [definition at source freeze](../../packages/deployment-control-plane/test/filesystem.rs#L142).
- `every_nested_target_ancestor_is_descriptor_checked` — [final log line609](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L609); [definition at source freeze](../../packages/deployment-control-plane/test/filesystem.rs#L221).
- `payload_replacement_during_hash_cannot_change_sealed_bytes` — [final log line615](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L615); [definition at source freeze](../../packages/deployment-control-plane/test/filesystem.rs#L249).

### ACC-005 / EVD-DCP-T4-005 final-source supplement

- `real_socket_rejects_identity_paths_unknown_fields_and_deep_frames` — [final log line675](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L675); [definition at source freeze](../../packages/deployment-control-plane/test/socket.rs#L31).
- `peer_scope_and_connection_quota_are_enforced_by_real_transport` — [final log line673](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L673); [definition at source freeze](../../packages/deployment-control-plane/test/socket.rs#L74).
- `partial_disconnect_is_bounded_and_does_not_starve_status` — [final log line672](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L672); [definition at source freeze](../../packages/deployment-control-plane/test/socket.rs#L59).
- `durable_disconnected_ack_reopens_after_intake_disappears` — [final log line689](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L689); [definition at source freeze](../../packages/deployment-control-plane/test/train.rs#L193).

### ACC-006 / EVD-DCP-T4-006 final-source supplement

- `launchd_periodic_parser_does_not_confuse_nested_pid_with_generation` — [final log line739](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L739); [definition at source freeze](../../packages/deployment-control-plane/test/transactions.rs#L70).

### ACC-007 / EVD-DCP-T4-007 final-source supplement

- `killed_holder_releases_kernel_lock_without_unlinking_inode_or_intent` — [final log line612](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L612); [definition at source freeze](../../packages/deployment-control-plane/test/filesystem.rs#L294).
- `a_different_fixture_mutex_cannot_authorize_apply` — [final log line731](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L731); [definition at source freeze](../../packages/deployment-control-plane/test/transactions.rs#L120).
- `simultaneous_targets_use_one_host_mutex_and_distinct_private_targets` — [final log line721](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L721); [definition at source freeze](../../packages/deployment-control-plane/test/train.rs#L293).
- `three_goals_share_one_install_two_close_one_fails_and_mutex_covers_acceptance` — [final log line722](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L722); [definition at source freeze](../../packages/deployment-control-plane/test/train.rs#L109).

### ACC-008 / EVD-DCP-T4-008 final-source supplement

- `scheduling::supersession_inherits_fifo_and_rejects_cycles_without_partial_writes` — [final log line660](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L660); [definition at source freeze](../../packages/deployment-control-plane/test/queue_scheduling.rs#L86).
- `scheduling::dependency_requires_exact_capability_receipt_and_goal_pass` — [final log line657](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L657); [definition at source freeze](../../packages/deployment-control-plane/test/queue_scheduling.rs#L133).
- `scheduling::fifo_and_continue_independent_obey_persisted_failure_disposition` — [final log line658](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L658); [definition at source freeze](../../packages/deployment-control-plane/test/queue_scheduling.rs#L21).
- `repairs::b04_replaced_runtime_cannot_satisfy_live_installation_dependency` — [final log line651](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L651); [definition at source freeze](../../packages/deployment-control-plane/test/queue_repairs.rs#L216).
- `repairs::b05_revoked_recovery_and_cancel_cannot_clear_stop` — [final log line652](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L652); [definition at source freeze](../../packages/deployment-control-plane/test/queue_repairs.rs#L259).

### ACC-009 / EVD-DCP-T4-009 final-source supplement

- `transaction::faults::failed_sync_and_partial_records_are_retained_and_never_replayed` — [final log line118](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L118); [definition at source freeze](../../packages/deployment-control-plane/test/transaction_faults.rs#L369).
- `transaction::repair::prior_rolled_back_mutation_cannot_quarantine_current_no_effect_preflight` — [final log line520](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L520); [definition at source freeze](../../packages/deployment-control-plane/test/transaction_repair.rs#L284).
- `service::mailbox_tests::visible_rename_with_failed_directory_flush_is_reflushed_on_retry` — [final log line16](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L16); [definition at source freeze](../../packages/deployment-control-plane/test/common/mailbox.rs#L65).
- `repair::admitted_temporary_records_resume_after_real_daemon_restart_and_concurrent_submit` — [final log line705](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L705); [definition at source freeze](../../packages/deployment-control-plane/test/common/service_repair.rs#L28).
- `repair::newer_late_coverage_survives_completion_of_an_older_verification_claim` — [final log line711](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L711); [definition at source freeze](../../packages/deployment-control-plane/test/common/service_repair.rs#L181).

### ACC-010 / EVD-DCP-T4-010 final-source supplement

- `partial_install_disk_failure_restores_exact_preimage_without_unrelated_writes` — [final log line740](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L740); [definition at source freeze](../../packages/deployment-control-plane/test/transactions.rs#L178).
- `rollback_deletes_only_exact_transaction_created_absent_slot` — [final log line743](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L743); [definition at source freeze](../../packages/deployment-control-plane/test/transactions.rs#L232).
- `unrelated_post_apply_drift_quarantines_and_preserves_bytes` — [final log line744](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L744); [definition at source freeze](../../packages/deployment-control-plane/test/transactions.rs#L44).
- `restored_generation::restored_a_uses_fresh_process_for_late_verification_without_reclosing_original_goal` — [final log line742](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L742); [definition at source freeze](../../packages/deployment-control-plane/test/restored_generation.rs#L32).
- `transaction::repair::maximum_admitted_slots_roundtrip_success_and_rollback_journal` — [final log line516](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L516); [definition at source freeze](../../packages/deployment-control-plane/test/transaction_repair.rs#L93).

### ACC-011 / EVD-DCP-T4-011 final-source supplement

- `receipts::outbox_closure_is_signed_idempotent_and_never_reinstalls` — [final log line642](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L642); [definition at source freeze](../../packages/deployment-control-plane/test/queue_receipts.rs#L4).
- `repairs::b02_current_attempt_needs_its_own_transaction_and_goal_readback_receipts` — [final log line649](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L649); [definition at source freeze](../../packages/deployment-control-plane/test/queue_repairs.rs#L119).
- `absent_verifier_finalizes_waiting_without_local_success_and_late_pass_closes_once` — [final log line682](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L682); [definition at source freeze](../../packages/deployment-control-plane/test/train.rs#L18).
- `unknown_external_canary_is_never_reissued_or_overwritten` — [final log line723](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L723); [definition at source freeze](../../packages/deployment-control-plane/test/train.rs#L174).
- `repair::closure_temporary_records_resume_after_real_daemon_restart_without_reinstall` — [final log line706](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L706); [definition at source freeze](../../packages/deployment-control-plane/test/common/service_repair.rs#L73).

### ACC-012 / EVD-DCP-T4-012 final-source supplement

- `authenticated_policy_epoch_cannot_roll_back_or_equivocate` — [final log line553](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L553); [definition at source freeze](../../packages/deployment-control-plane/test/authority.rs#L87).
- `production_entry_refuses_unprivileged_and_path_overrides` — [final log line674](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L674); [definition at source freeze](../../packages/deployment-control-plane/test/socket.rs#L6).

### ACC-013 / EVD-DCP-T4-013 final-source supplement

- `enrolled_legacy_sources_refuse_before_any_effect` — [final log line599](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L599); [definition at source freeze](../../packages/deployment-control-plane/test/adoption/e2e.rs#L74).
- `unreadable_or_caller_owned_parent_denies_but_true_absence_preserves_legacy` — [final log line601](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L601); [definition at source freeze](../../packages/deployment-control-plane/test/adoption/e2e.rs#L101).
- `original_nonroot_lock_selftest_remains_available_before_enrollment` — [final log line600](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L600); [definition at source freeze](../../packages/deployment-control-plane/test/adoption/e2e.rs#L123).

### ACC-014 / EVD-DCP-T4-014 final-source supplement

- `receipts::queue_quota_rejects_new_work_and_wrong_revision_cannot_move_state` — [final log line643](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L643); [definition at source freeze](../../packages/deployment-control-plane/test/queue_receipts.rs#L164).
- `receipts::transport_request_rate_limit_is_persisted_even_when_units_collapse` — [final log line645](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L645); [definition at source freeze](../../packages/deployment-control-plane/test/queue_receipts.rs#L185).
- `transaction::faults::owned_action_timeout_reaches_transaction_quarantine_and_no_replay` — [final log line486](../../.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/final-repair-evidence/28-final-full-suite.log#L486); [definition at source freeze](../../packages/deployment-control-plane/test/transaction_faults.rs#L463).
