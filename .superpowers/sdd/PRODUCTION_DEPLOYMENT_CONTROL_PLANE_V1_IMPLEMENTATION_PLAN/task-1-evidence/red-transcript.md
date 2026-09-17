# RED evidence excerpts (transcribed tool outputs)

These are retained excerpts of actual terminal tool results in this task, not a
second execution or a claim that raw console files were captured during iteration.
The corresponding command outputs remain in the task tool transcript. Final GREEN
output is captured directly in `final-tests.log`.

## Initial verifier RED — tool session 10544, exit 101

Command: `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml --test authority`

Before verifier implementation, the real API scaffold returned Ok. Three tests ran:
`caller_fields_cannot_inject_paths_or_commands` passed serde's rejection;
`forged_or_changed_signed_payload_is_rejected` and
`key_role_and_scope_are_enforced` failed with
`called Result::unwrap_err() on an Ok value: ()`.
After real Ed25519 strict verification: 3 passed, 0 failed (tool chunk a13f9f).

## Admission RED — tool chunk dc556e, exit 101

Command: same authority target.

3 passed, 2 failed. `admission_rejects_untrusted_release_bindings_without_inserting`
expected `SELF_REVIEW` and observed `NOT_IMPLEMENTED`.
`authenticated_policy_epoch_cannot_roll_back_or_equivocate` rejected its authentic
baseline with `NOT_IMPLEMENTED`. Both became GREEN after signed structured
admission and transactional epoch pinning (tool session 59588).

## Queue RED — tool session 58600, exit 101

Command: `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml --test queue`

0 passed, 6 failed against concrete unimplemented Queue API. Failures covered
producer census/CAS, bounded retries, late attachment, A→B→A, concurrent requests,
and dependencies/coverage. Dependency assertion expected `MISSING_DEPENDENCY`
and observed `NOT_IMPLEMENTED`; positive paths rejected with `NOT_IMPLEMENTED`.

After implementation 5/6 passed; the remaining failure was an incorrect helper
assertion that the global outbox was empty during the second installation. It was
corrected to assert that no entry for the currently unfinalized Goal exists.
This was a test correction, not a production behavior fix.

## FIFO phase-bypass RED — tool chunk 2aeb84, exit 101

Command: `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml --test queue scheduling`

3 passed, 1 failed. The second queued unit entered PRECHECK (unexpected Ok
UnitStatus) although the first unit was dependency-ready. Moved eligibility
selection into the PRECHECK transaction. GREEN 4/4 (chunk b1d7d0).

## Persisted revocation RED — tool chunk 03513c's preceding authority run / chunk b43e88

Command: `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml --test authority freshness`

2 passed, 1 failed. A policy revocation denied revalidation but its epoch rolled
back with the transaction; after reopen the old policy returned Ok. Persisting
validated policy observations separately fixed it. GREEN 3/3 (chunk b79900).

## Cross-profile epoch and request-rate RED — tool session 1863, exit 101

Commands: authority filter `authority_registry_epoch`, queue filter
`transport_request_rate_limit`.

Each failed 0/1 because old epoch in another profile and a third collapsed request
returned Ok. A global observed epoch floor and persisted 60-second per-actor
request count fixed them. A first mechanical edit missed the formatted SQL (same
RED repeated); corrected edit GREEN 1/1 (chunk f662eb). Rate GREEN 1/1 (session 1564).

## Root ownership and revision overflow RED — tool chunk 49307a, exit 101

Commands: authority filters `overlapping_enabled`, `producer_revision_overflow`.

Each failed 0/1. Overlapping enabled profiles admitted independent runtime owners;
producer revision `u64::MAX + 1` panicked. Catalog collision rejection and checked
revision addition fixed the reachable counterexamples. Final full suite confirms
both GREEN.

Additional receipt/recovery tests exercise branches implemented during the initial
queue RED/GREEN cycle; they passed on first execution and are supplemental
regression coverage, not separate claimed RED cycles.

## Signed evidence retention RED — chunks baf648 and 2a37a1, exit 101

Commands: queue filter `signed_recovery_proof`, authority filter
`superseded_signed_policy`.

The accepted signed recovery proof existed only as a journal digest, so readback
returned `UNKNOWN_RECEIPT`; an older signed policy after an epoch update returned
`UNKNOWN_POLICY`. Added immutable signed recovery receipts and policy history.
The justified final full rerun captured directly in `final-tests.log` is GREEN:
authority 12/12 and queue 17/17, 29 total.
