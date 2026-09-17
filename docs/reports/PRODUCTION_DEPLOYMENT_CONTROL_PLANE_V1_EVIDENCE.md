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
