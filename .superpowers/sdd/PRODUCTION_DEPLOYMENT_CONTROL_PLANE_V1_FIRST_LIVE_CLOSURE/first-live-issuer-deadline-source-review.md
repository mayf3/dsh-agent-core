# Independent issuer reply deadline source review

**PASS, bounded a4e1fb9170b12f30c13c0f122d84cd03812c9d18 delta. No new blocker found.** No issuer endpoint or production runtime was contacted.

Frozen/tested source hashes in the operator worktree:

- packages/deployment-control-plane/src/issuer/server.rs:6790a4f0e9956c3d9d15ec059e7c3669919f9895ddd5eae5b4c7bcd3484aa4b6.
- packages/deployment-control-plane/src/service/protocol.rs:74775ad4260ce03473d1ce4f3eda39f92c52578ef40425e7acaa220e7823b6de.

Both working files matched `git show` at the frozen commit. The review covers only the changed client reply-budget seam and direct framing surface, not surrounding in-progress first-live source.

Previously request() set a900-second socket read timeout, but protocol::read_frame immediately used its own one-second deadline. The fix passes a bounded900-second total budget only to the outgoing issuer client's response reader. The root-peer verification, nonroot client requirement, source/goal validation and4096-byte reply limit are unchanged. All ordinary inbound read_frame callers still receive one second. The new crate-private helper rejects zero and >900-second budgets before constructing the deadline, and uses one shared deadline across length header and payload; partial data does not renew it. Frame length bounds and depth16 validation remain in the same common path. No timeout becomes success and there is no new automatic retry/replay.

Independent command: `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml --locked --lib deadline_tests -- --nocapture`, exit0,3 PASS. Log `first-live-preparation/issuer-deadline-independent-review.log` SHAad5282be1d64421b55d88f49244e36a6b04d6f6e8e9a3b35936b6976b2bab11a. This includes an actual private UnixStream pair with1.2-second delayed review reply, oversized/deep frame negatives, a slow partial stream failing its60ms total budget, zero/901/maximum budget rejection and the unchanged one-second inbound timeout. Source inspection confirms production extended-budget use is only read_prepared_reply; no listener gained a900-second untrusted request allowance.

This corrects intended bounded waiting; it does not establish reviewer login, a genuine signed review, preparation success or issuer readiness. Full integration and exact operation review remain separately required.
