# Independent security review: local binding and first disabled genesis

SOURCE_REVISION = 65559ddb9d414d248f640f46216bd62e8068983d
BASE_HEAD = 2c59bf5169b38c90b2ea87f210bdfb453e4a7b68
ACCEPTED_SPEC = 39865536ce51005f95a98473e77c2329078512c0
PACKAGE_SHA256 = fe3d6711df190b76de32cabf3607b6de12f575803f213d6603ee1eb264c5b065
SOURCE_MANIFEST_SHA256 = 81aee70d3d96b976b55f2e92b814e876121b5f31a2dc40960247fc327e695d06
INITIAL_REGISTRY_SHA256 = 2a02f1b597c1963a1b080924d778099b6aea3c1ef345ae04643648cd8e333842
SUPERVISOR_POLICY_SHA256 = 254ac64e7c3c3f0a4026b6feab568f2090cd2701234308c5e0594f4fcbdd7bb0

## Provenance and meaning

This record retains the independent review decisions delivered in this Goal's
collaboration session by `/root/dcp_preparation_review` and
`/root/dcp_binding_authority_review`. Both reviewers were read-only on the audited
implementation; neither authored its fixes. The root coordinator transcribed and
bound their results here. This is not a production issuer signature, external
Owner authorization, achieved custody proof or proof of native root execution.
The Owner decides bootstrap authorization outside all newly generated keys.

The immutable package digest deliberately excludes this report and plan to avoid
a digest cycle. Replacing the explicitly PENDING construction report with this
record changes only review/plan pins; source, binaries, registry and policy stay
unchanged. Final packaging must reverify every byte before requesting permission.

## Issuer, registry and preparation reviewer

Reviewer: `/root/dcp_preparation_review`
Decision: **PASS**, no remaining actionable blocker in the scoped changes.
Scope: issuer/custody/source/review interface; deployment-only registry;
producer/service integration; directly affected tests; nonprivileged packager.

Independently inspected closures:

- LB-R1: exact signed policy lease reuse; durable monotonic issuance epochs;
  distinct Owner revision, revocation and equivocation checks.
- LB-R2: retained exact Draft build/review/READY evidence; atomic content-addressed
  binding; renewal changes policy/request identity; publication interruption and
  unpublished partial-Draft recovery preserve the accepted evidence.
- LB-R3: retained staging/job/proposal bytes and files counted before first write;
  failed/partial data count towards bounded quotas.
- The directly discovered pre-submit conflicting-target case: unresolved different
  artifact remains PENDING, including a persisted pre-READY Draft; same-artifact
  sharing remains possible. No caller allocates future generations or resets budget.

Historical renewal keeps its original signed builder/helper evidence. Actual
NativeEnrollment and SourcePolicy changes invalidate its resume binding; a newer
helper is never described as having performed the original build/review.

Reviewer independently rehashed all 83 builder Rust source entries and all seven
frozen source dependency entries plus release/review/accepted-contract entries
against c9ffe1d1637db2997689d8b2ef7def4fc1086b17 and tree
eb44f3fbbfeed46c2c912c439d641c0fa2fdef3d. The exact package's 152 source files match
Git objects; four executables and one support file match declared hashes. Actual
Codex/helper hashes and the concrete retained closure manifest match policy.

## Disabled installer reviewer

Reviewer: `/root/dcp_binding_authority_review`
Decision: **PASS**. GI-R1 closed; open scoped blockers = 0.
Scope: external exact Owner grant and package pins; fixed installed root runner;
identity collision/isolation; root key custody; no-follow reads and exclusive
outputs; durable intent/result journaling; disabled installation; reviewer login;
conservative rollback; directly affected acceptance mapping.

GI-R1: the actual `generated_configuration` writer now indexes the verifier by
`native-installed-readback-v1`, retaining `local-verifier` as issuer. The reviewer
independently ran the real serialization/deserialization regression: 1 PASS.
Other installer files retain their previously reviewed semantics/hashes.

Reviewer independently checked all 152 source files against the exact commit,
executable/support hashes, actual policy binary hashes and the packaged nonroot
verifier (exit 0). The complete package pins above match.

## Executed evidence and limits

Retained final suite: `final/dcp-local-binding-final-suite.log`, 256 top-level Rust
tests PASS, 0 failed, 2 explicitly manual online smoke tests ignored. Those ignored
checks are not counted as native UID612/login/custody observations. Seven packager
tests PASS; cargo fmt, clippy with warnings denied, locked release build and the
isolated actual package release build PASS. Reviewers inspected these retained
logs; they did not claim to have independently rerun the whole suite.

The repository structure verifier reports three unchanged baseline directory
violations (production-runtime/src 21, production-runtime/test 23, scripts 59).
None of these paths changed. Every Rust file in the crate is at most 500 lines;
new issuer/bootstrap/registry directories are below 20 children. Existing unrelated
structure debt is not recast as a passing global repository structure gate.

First disabled genesis readiness follows accepted Spec section 7. It means this
exact reviewed package is ready for separate Owner authorization. It does not mean
permission has been granted, keys exist, custody was achieved, runtime enrollment
is complete, legacy paths were retired, standing deployment is enabled or the
parent/business Goal is complete. The initial Broker child remains PENDING, with
Watchdog prerequisite and original business acceptance preserved.

INDEPENDENT_REVIEW_PASS = YES (scopes above)
NEW_SHIP_BLOCKERS = NONE (first disabled genesis)
PRIVILEGED_BOOTSTRAP_PERFORMED = NO
PRODUCTION_MUTATION_PERFORMED = NO

Recorded UTC: 2026-09-18T01:28:30.379825+00:00
