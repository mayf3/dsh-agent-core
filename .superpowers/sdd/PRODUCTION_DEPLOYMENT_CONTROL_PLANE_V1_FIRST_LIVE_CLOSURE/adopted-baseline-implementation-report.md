# First-target baseline and acceptance implementation evidence

SOURCE_HEAD=ac8193ed5219c846007aaebd3e371db751653c1e
SEMANTIC_SOURCE_HEAD=2d74fa351c79dd0564c158341a0d5f5033fb1435
BASE_HEAD=e8f863fdb5d3b95dc45cd202acee5c1c69124551
ACCEPTED_SPEC=39865536ce51005f95a98473e77c2329078512c0
INDEPENDENT_DESIGN=f88fb71ea79e8795260056758f333e93447460e6
INDEPENDENT_SOURCE_REVIEW=PENDING
PRODUCTION_MUTATION_PERFORMED=NO
PRIVILEGED_BOOTSTRAP_PERFORMED=NO
FIRST_REAL_AUTOMATIC_DEPLOYMENT_COMPLETE=NO

This is author evidence for the bounded REUSE design, not independent source approval or native execution authority. Source is frozen and the worktree was clean after its commit. Helper implementation commits 64690d5 and 80894e1 precede the integration commit; their pure evaluator/strict codec work is included in the source review scope.

## Implemented boundary

- A signed, exact first-target grant can establish one `ObservedExistingInstallation` baseline from a genuinely reviewed Proposal and the authenticated complete native face/current service generation. Its receipt reports attempt 0, install count 0 and restart count 0. It does not synthesize an old mutation transaction or import arbitrary receipts.
- Reservation, exact Proposal pin, baseline observation/publication/finalization and separate standing activation are durable. Crashes at five publication boundaries retain the same operation and preserve the activation fence. Global unknown remains blocked. Configuration's default-omitted operation ID also blocks ordinary startup before any Queue reservation exists.
- Typed installed-receipt readers and physical restoration preserve origin. A rollback to the adopted target records the actual restored generation; its old Goal PASS cannot prove the new service generation.
- Before Broker effects, an exact same-target predecessor proof pins the genuine Watchdog installation and required signed PASS receipts, attachment digests, journal coordinates and retained facet. Only finalized current Broker read-only acceptance may consume it. New mutation, retry, noncurrent/unknown/rolled-back Broker, absent/tampered proof and changed retained facet do not gain a waiver.
- The fixed native Watchdog observer uses the held permanent guard, protected static/dynamic bytes, authenticated canonical read-only health/history, actual Router admission and durable no-effect result, current full face and native service generation. The pure evaluator checks accepted semantic invariants and fresh W1/W2 health. Source equality or old ACCEPTED bytes alone cannot mint PASS. Periodic PIDs/counters remain observations rather than a new service generation.
- Operation-local immutable plan/creator/store records are joined by actual raw hashes and exact fixed canary job definition. Historical CONTROL plans and ACCEPTED records are never rewritten. Unknown capture stays unknown. The separate future operator, not this observer, must create and CAS-clean the real canary under its Owner-authorized budget.
- A default-omitted typed `runtime_startup` preserves legacy canonical bytes; `catchup-zero` binds only the actual observed fixed `--catchup 0` suffix consistently across plist/process/census checks. No arbitrary argv is introduced.

The exact materializer/one-operation lifecycle/canary executor is parent-owned work, separately reviewed. The interface and custody paths are frozen in `adopted-baseline-operation-contract.md`. Neither this report nor fixture results claim the actual target is already protected, current canary PASS exists, new Goals are enrolled, or standing production is enabled.

## Test-first evidence

Logs reside beside this report, retained locally with the hashes below. The original D-03 RED is an executed existing-path regression: A applies, B applies and waits, then B's read-only acceptance fails `DEPENDENCY_NOT_CURRENT`. Empty-queue adoption and scoped canary plan REDs exercise initially missing new APIs returning explicit NOT_IMPLEMENTED; they are not misrepresented as historical production failures. Runtime startup RED uses the real observed fixed argv convention. The first full run found a real CLI compatibility regression (unknown `--root` reached root-refusal instead of `ARGUMENTS`), which was corrected before the passing full run.

| Observation | SHA256 |
|---|---|
| adoption-d03-red.log | 8449f5e7c7790a267b001d1e38ec0e57370775323411043682357709858383ec |
| adoption-empty-queue-red.log | b59ba269d29616b4261d4a25963d93ad2c87e695ad22f825ac66f4d01ece5f6e |
| runtime-startup-red.log | ec87748a1104d860703e96a202a5eb54bc2d0a3592fc3750e66425ea1b2b82f2 |
| adoption-scoped-canary-red.log | 13f6ae8320d49927b80e9f470a8a202b5c63685133bfe7b1670671637fd46041 |
| adoption-full-tests.log, earlier failing run | af2db212bfe995688acc82b19dfd4b8d7be7a053503fce38874a4854ec67a3df |

Focused positives and negatives cover empty Queue adoption, signature/expiry/face/generation/global-unsafe refusal, actual non-root process crash at reserved/admitted/observed/published/finalized edges, persistent activation gate, separate activation receipt, native startup compatibility, real fixture adopted-A→Broker-B→late-PASS without reinstall, rollback origin/generation, missing/tampered executed PASS proof, incomplete/unknown/rolled-back B, immutable unknown capture, strict duplicate JSON/raw hashes, canonical history derivation and real admission evidence. Fixtures use explicit synthetic identities and private roots, not production trust material or runtime endpoints.

## Executed validation and exact coordinates

All Cargo commands used `--manifest-path packages/deployment-control-plane/Cargo.toml`; test/build/clippy commands also used `--locked`.

| Check | Result and coordinates | Retained log SHA256 |
|---|---|---|
| `cargo test` full crate | exit 0 at semantic source 2d74fa3; 336 top-level passed, 0 failed, 2 ignored; nested crash-worker executions are not added to this count | adoption-full-final.log: 80f6e89f07eb1453fc05f5d3d7fc9955a4b48746e6f1eb21b4d8c4cd0979ea3d |
| `cargo test --lib verification::` | exit 0, 47 passed on final relocated source ac8193e | adoption-observer-relocated.log: 9b75fc974ad9d7b3d33b6833066bf031b7f45add56c96a9bc6cd1ecaec39c304 |
| `cargo fmt -- --check` | exit 0 on final source | adoption-fmt-final.log: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| `cargo clippy --all-targets -- -D warnings` | exit 0 on final source | adoption-clippy-final.log: 04485a6f677f307f8e67d667e0a3777f8ae32b276e264ac195bc01ef6ef8b2c9 |
| `cargo build --release` | exit 0 on final source | adoption-release-final.log: e1e1c29efd51af619a364b794dacdc54b7c4e9a2e3f12462763ba437ba6a3bd3 |

The only change after the full suite is commit ac8193e: eleven test files moved with 100%-identical blobs into the existing adoption test directory, plus eleven `#[cfg(test)]` module path strings. No production logic, test body or test name changed. Fresh observer execution and all-target compilation/Clippy verify the relocated wiring. The full log remains explicitly attributed to 2d74fa3; it is not relabelled as a new run at ac8193e. The expensive maximum-slot stress test was not duplicated solely for these mechanical moves.

Final release `agent-deployd` SHA256 is `0469572e9f0d7741c448b74a020b0e279362b3d94a726a1205359a0356ae45a5`. It is an uninstalled build output, not the authorized production package.

The required repository structure command (`node scripts/verify-code-structure.mjs --base e8f863f --head ac8193e --json`) exits 1 on exactly the three unchanged baseline violations: production-runtime/src children 21→21, production-runtime/test 23→23, scripts 59→59. No new machine finding is introduced. Its report SHA is `f112fb395ea50d86a96f4948068d4e5bd567fb4667dabcb7196d8a3596dafcf6`. The verifier omits Rust extensions, so manual tracked-tree validation is retained separately: 172 Rust files, maximum 486 lines, no new/grown over-limit directory, and unchanged pre-existing test/ width 25. The initial test-layout growth was corrected by the mechanical relocation. Manual record SHA is `5e5394a1bfc13b7996923ab1044dce6b92cf66ef62516034a84d4c8009a4f2b6`. These are disclosed baseline tooling/structure conditions, not a false global STRUCTURE_PASS.

## Remaining real gates

Fresh independent source review is required on ac8193e and its directly affected native privilege/receipt/activation surface. The parent must complete and independently review exact materializer/lifecycle/canary operation code, authentic login reconciliation, actual protected target/loader/legacy lock/denial evidence, real isolated build/review, current canary and deployment-only Goal receipts, then request the single exact Owner operation authorization. Existing installed genesis and all real production services were untouched by this implementation. The parent Goal is not complete.
