# DEVELOPMENT_PREFLIGHT — native profile digest binding repair

BASE_HEAD=fd4b5f19bf1b5023e91dd4b674dbac1d6cb36cc6
PARENT_GOAL=PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1
PRIMARY_AUTHORITY=PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@39865536ce51005f95a98473e77c2329078512c0
AUTHORITY_ACTION=REUSE
ROUTE_STAGE=IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE=YES
IMPLEMENTATION_AUTHORITY=contracts
PLAN_LEVEL=BRIEF
ASSURANCE_LEVEL=CONTROLLED
EXECUTION_MANDATE=VALID; mayf3 authorized bounded nonproduction continuation, parent explicitly directed this directly affected regression repair
MUTATION_AUTHORIZATION=VALID; isolated dcp-first-live-binding worktree only
IMPLEMENTATION_ALLOWED=YES
OPERATION_ALLOWED=NO
SPEC_GAP_DEPENDENCY=NONE

Observed counterexample FLI-01: bootstrap::profile_digest normalizes enabled=false and validate_native_binding plus Executor::production use it, while OwnerPolicy::select hashes the active profile directly. A valid active native enrollment therefore fails ISSUER_PROFILE_BINDING before issuance. Independent reviewer confirmed reachability and superseded the prior selection-path PASS.

Done when: real active Configuration/NativeEnrollment first passes native binding but demonstrates RED in both v1/v2 source selection; one narrow shared-normalization repair passes selection, tampered digest and profile drift remain rejected, canonical v1 signatures/cache/draft formulas remain unchanged; affected tests/fmt/strict Clippy and independent exact-source re-audit pass. Prior final complete-suite evidence remains the unaffected baseline; run further suite only on concrete affected risk. No baseline feature implementation or installed-package changes.
