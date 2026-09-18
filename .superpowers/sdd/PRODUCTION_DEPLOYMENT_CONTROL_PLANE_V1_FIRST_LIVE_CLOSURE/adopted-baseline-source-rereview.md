# Independent focused source rereview: AB-01

REVIEW_RESULT=PASS_FOR_THE_REVIEWED_SOURCE_SCOPE
AB_01=CLOSED
FROZEN_SOURCE_BLOCKER_UNION=AB-01_CLOSED
NEW_SOURCE_SHIP_BLOCKERS=NONE_IDENTIFIED
REVIEW_TARGET_HEAD=d0a6a1f8698344f07268f47db08b904a9982b660
REVIEW_TARGET_TREE=2fae018d4823b227dd4c8fd9e7db4968223c9f39
PRIOR_REVIEW_HEAD=ac8193ed5219c846007aaebd3e371db751653c1e
GOVERNING_DESIGN=f88fb71ea79e8795260056758f333e93447460e6
AUTHORITY_ACTION=REUSE
PRODUCTION_MUTATION_PERFORMED=NO
PRIVILEGED_OPERATION_PERFORMED=NO
OPERATION_AUTHORIZATION=NOT_GRANTED_BY_REVIEW
FIRST_REAL_AUTOMATIC_DEPLOYMENT_COMPLETE=NO

This independent rereview closes only the frozen AB-01 finding and checks its directly affected helper/call site/tests. The historical `adopted-baseline-source-independent-review.md` remains unchanged. Its complete initial scope, independently executed tests and operation limitations still apply. The reviewer did not author either candidate or repair. Source comparison confirms that the only executable changes after the previously reviewed source are the native history-observation extraction/order and three regression tests; intervening `dc55d21` is documentation only.

## Closure evidence

`verification/native.rs:307–319` now supplies the authenticated fixed-job response to the internal `native_run::observe` helper before evaluating the fixed protected event reader. `verification/native_run.rs:12–38` first refuses retained unknown, strictly parses the response, requires exactly one run and the exact job identity, and handles UNKNOWN by exclusive durable `unknown.json` publication plus Queue quarantine. Only a succeeded response can invoke the one-shot event-read closure and the unchanged strict history/event derivation. The production closure remains the fixed `runs.jsonl` read with the frozen runtime UID/GID; no caller-selected I/O, callback endpoint or generic retry interface exists.

The same durable marker prevents later success substitution after reopen. Malformed or unrelated-job responses neither create the marker nor invoke the event reader. Successful reads still pass canonical history derivation, plan interval, raw document joins, complete face/service identity and semantic validation at the original call site. No admission, mutation, predecessor, rollback, custody or standing activation guard was relaxed.

The author retained an executed RED against the extracted helper with the old ordering: one pass, two failures. The exact UNKNOWN case returned `UNREADABLE_EVENTS` instead of `UNKNOWN_CANARY`; malformed/wrong-job cases improperly reached the event callback. Retained RED log SHA256 is `6a7b52c190121ff74e00a26b475ae80e337e1ad8b7096182f3685ddc05670578`. This is the targeted historical counterexample, not a live canary experiment.

Independently ran on exact `d0a6a1f`:

- `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml --locked --lib verification::native::run -- --nocapture`: exit 0, all three new tests passed. This covers read-order failure, immutable evidence and quarantine after reopen, later-success refusal, malformed/wrong-job non-poisoning, and exactly-once successful event read.
- `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml --locked --lib verification:: -- --nocapture`: exit 0, 50 passed, zero failed. All new and prior strict document, canary plan, current-generation semantic, native HTTP and history-readback tests passed.
- `git diff --check ac8193e..d0a6a1f`: exit 0. Compared the entire production delta, not only the test result.

Author observer GREEN log SHA256 is `07d2c32e7294643788af43427541c991e286aec310fee97add7abff8f57fc280`. At this report's creation, the author reported strict all-target Clippy and fmt PASS and was completing the exact-source full suite/release. Those remaining validation observations must be retained with their actual source/log coordinates before integration/package freeze; this independent security conclusion does not invent their results.

## Verdict and limits

AB-01 is closed and no new blocker was found in the minimal repair. Combined with the prior full scoped review, the adoption/Watchdog/predecessor source at this exact revision passes independent source review. Closed R02, prior issuer binding and dedicated login-helper reviews are not reopened. The separately designed actual-inventory compatibility addition and parent lifecycle/materializer/canary operator are not covered by this source PASS and require their own affected-source review.

No root, production endpoint, real credential, service, device login, deployment or canary operation was performed. Authentic issuer review, actual protected inventory/loader/legacy-denial proof, scoped canary/PASS, exact operation packaging and Owner permission remain necessary. This is neither a runtime success claim nor first-live readiness nor completion of the parent Goal.
