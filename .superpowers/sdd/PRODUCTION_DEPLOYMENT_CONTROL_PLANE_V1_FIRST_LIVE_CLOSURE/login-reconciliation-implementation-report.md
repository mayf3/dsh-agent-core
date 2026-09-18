# Exact reviewer login reconciliation — author implementation report

Status: implementation and nonproduction validation complete; independent source review and any real operation remain separate gates. This is an author report, not an independent approval or a production login receipt.

## Authority and coordinates

Accepted authority: `PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@39865536ce51005f95a98473e77c2329078512c0`, existing CTR017/020 semantics, REUSE / BRIEF / CONTROLLED. Approved exact-operation design SHA256 `b6c0db9d6ff88282e3a8233b6e20aa52beb5e170d37fbb53ff7dfdce8009c3a4`; independent design review SHA256 `29fe49dc2de957628230e08d2f7d850479e0b3237b12816bfb7adf6b9919c8d9`. Source base `1d92fb3aefc8dc7e00ea5ac499bf2758468b3cd0`; intervening parent commits only added evidence/documents. Implementation source is the commit containing this report; no circular self-commit identifier is claimed here.

Owned changes: new bootstrap/login_reconciliation.rs and binding/native/process/state children, new agent-deploy-login-reconcile binary, bootstrap/mod.rs exports, and test/login_reconciliation/{main,safety,faults}. No original genesis runner/package source or installed bytes were modified.

## Fixed operation

The compiled manifest SHA256 is `829054c0a16c9b5784bc9c124b6310bf17f055c3c9f31b46046f06a931331f47` (exact UTF-8 RAW constant, no added newline). It binds the existing host, attempt, original six package pins, four installed executables, public receipts/configuration/preexisting plists, existing lock device/inode, original login intent and fixed ps tool. It comes from the ordinary public exports under `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/genesis-65559dd-20260918-01/reconciliation-bcfd929/login-failure-readback/observation-once`, whose readback-result.json SHA256 is `5168000958f4778e1a9adfa06db1ddee576f890c204c292d4c7a384edf7e52cf`, the reviewed reconciliation-plan/operator-manifest, and retained readonly-prefix-continuation-01 public plist hash output. These historical exports select the exact operation; native preflight must independently recheck current protected state.

The inert release helper SHA256 from this build is `185ea8351830776cdd29fcc2ba795836a938d361e66763bc944545b83833e1e6`. It has not been installed or run as root. A new protected grant at the fixed attempt must have exactly version/owner/scope/manifest_digest/helper_digest/issued_at/expires_at, owner mayf3, scope EXACT_REVIEWER_LOGIN_RECONCILIATION_ONLY, exact manifest and actual helper digests, and a positive validity interval no longer than one hour. The original grant is never reused or rewritten. This report supplies no grant and no authorization to execute.

Only fixed run/child actions exist; there is no caller-selected plan, path, attempt, command or recipe. The existing bootstrap lock is opened without create and checked by identity, with a nonblocking exclusive parent lock. Original records and exact attempt/steps inventory are checked. Any preexisting new intent/result/failure blocks another attempt. A sole exclusive, flushed recovery intent is appended before spawn. Partial writes, crash after intent, failed child, timeout and uncertain poststate consume the budget and retain original external UNKNOWN.

The child binds its actual live parent PID/start identity and immutable intent/grant while the fixed parent holds the lock, rechecks protected state, closes root descriptors, drops groups/GID/UID to 612, and execs only pinned Codex login --device-auth with cleared fixed environment and inherited terminal streams. Parent duration is fixed at 600 seconds. Timeout cleanup only kills/reaps its directly owned child; it never sweeps descendants. Fresh fixed ps census rejects any remaining UID612 process before a success receipt. No auth/key contents are read; auth and six key files receive metadata-only checks. Success records separate local login completion and safe auth metadata, explicitly retaining original provider UNKNOWN and false independent-review/activation fields. It is not reviewer approval, model transport proof, activation, or deployment readiness.

## Validation

Test-first evidence is retained alongside this report: login-reconciliation-red.log (2 passed, 4 failed), login-reconciliation-safety-red.log (8 passed, 6 failed), and login-reconciliation-inventory-red.log (0 passed, 1 failed). The failures exercised missing durable budget/grant guards, public byte and private metadata checks, lock/process binding, and unexpected protected state. Fixed fixture setup errors were corrected before capturing these behavioral RED logs.

- Focused evaluator/state/process/fault suite: 21 passed, 0 failed (login-reconciliation-focused.log).
- Full package `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml --locked`: 295 passed, 0 failed, 2 ignored (login-reconciliation-full-test.log). Totals use the final summary of each root harness, excluding nested fault subprocess summaries. The two existing ignored tests are explicit manual local CLI compatibility and authorized model transport probes, not worker entry tests.
- `cargo fmt --manifest-path packages/deployment-control-plane/Cargo.toml -- --check`: PASS.
- `cargo clippy --manifest-path packages/deployment-control-plane/Cargo.toml --all-targets -- -D warnings`: PASS.
- `cargo build --manifest-path packages/deployment-control-plane/Cargo.toml --release --locked`: PASS (login-reconciliation-release.log).

Tests use ordinary temporary fixtures, real exclusive file writes/flock and controlled crash/fsync/partial-record faults. Effects seams simulate login/poststate outcomes; no root transition, real device login, real credential contents, production endpoint, service activation, installation or provider success was tested or claimed. Process checks use fixed parsed rows in tests; current runtime observation remains an operator gate. Existing genesis_install.rs, genesis_install_actions.rs, genesis_install_native.rs, genesis_install_io.rs and agent-deploy-bootstrap.rs were independently byte-compared with source base and remain unchanged. No sealed package artifact was edited.

## Remaining gates

Independent source/security review must assess the exact frozen commit and operation bindings. Only after that review may a separately reviewed exact helper/grant delivery and Owner-authorized visible operation be considered. Missing/drifted current state, residual processes, malformed/expired grant, lost lock or consumed intent must stop; no replay/reinstall/activation is implied. Any actual login result still requires independent protected postreadback and reviewer CLI/model validation.
