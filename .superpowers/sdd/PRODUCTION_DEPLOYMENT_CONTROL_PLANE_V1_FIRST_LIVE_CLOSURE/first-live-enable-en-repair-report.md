# EN-01/02 startup repair implementation evidence

Author report, not independent review. Same accepted PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@39865536ce51005f95a98473e77c2329078512c0; REUSE / bounded BRIEF / CONTROLLED implementation only. Parent mandate authorizes the one frozen blocker-union repair; no production effects.

Source: fdc65641d3f218a01f8bc5d31edda5b6aa00f7bc; base 948bd83f429032186cde26cde51b590412f21219. Frozen review union is EN-01/02 in parent first-live-enable-source-review.md SHA a27ed579bd7b00056942d63a4d080ec45540a919a23cf92546e7651034678760. Exactly seven service first_live source/test files changed. Host/Tailscale/namespace code is unchanged.

EN-01: native enable acquires the permanent guard before authoritative packet/grant/core/config and unloaded-service preflight. The same guard is moved into the finite enable runner and retained through plist replacement, enable, bootstrap, independent current daemon readback and durable generation admission. It is explicitly dropped immediately after admission publication and before daemon initialization/ready wait. Early errors remain consumed/UNKNOWN; there is no replay or inverse effect.

EN-02: startup preflight exclusively publishes immutable daemon-startup-intent.json before any singleton/listener effect. Its strict GenerationIntent contains {binding,process}; process is the current kernel PID/birth/UID/GID/executable identity. Readback adds startup_intent_digest and must exactly join the retained intent binding/process. Native readback verification, daemon initialization and complete-chain validation check this join. A replacement before completion cannot claim the O_EXCL intent, even if the first process died before publishing readback. Completed ordinary restarts still validate historical completion without reusing the original expiry/current PID.

These statements supersede the initial implementation-design text saying the guard is released after claim and that daemon-readback alone consumes the generation. The initial report/design remain retained historical artifacts; their old lock-release behavior is not the repaired contract.

Executed ordinary-user private-fixture evidence on macOS, 2026-09-18, CARGO_TARGET_DIR=/tmp/dcp-startup-target:
- Genuine EN-01 RED: separate test-binary child acquired the real permanent flock during effects; failed FIXTURE_MUTEX_NOT_HELD_TO_ADMISSION. Repair GREEN checks MUTEX_BUSY during all four guarded stages and successful separate-process acquisition only at ready, after durable admission.
- Genuine EN-02 RED: real private UnixListener created by child, then exit73 before readback; replacement generation incorrectly succeeded. Repair GREEN preserves socket inode and missing readback while refusing the replacement claim.
- cargo test --lib service::first_live -- --test-threads=1: 16 passed, 0 failed (includes two nested child helper entry tests; child output is not added to totals).
- cargo test --lib separate_exact_activation_requires_current_pass_and_genuine_private_canary_proof -- --test-threads=1: 1 passed, 0 failed.
- cargo clippy --all-targets -- -D warnings: exit0.
- rustfmt --edition 2021 --check on the seven owned files: exit0; git diff --check: exit0.

Logs are in enable-en-repair-evidence beside this report. No root, production socket, launchd, device login, canary, installed filesystem or network endpoint was exercised. No unchanged full suite was rerun; final whole-source package verification and independent affected-surface rereview remain separate gates. This report claims executed regression results only, not operation readiness or author PASS.
