# #1370 independent affected-Contract re-audit

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = AFFECTED_CONTRACT
REVIEW_SCOPE = DELTA
SCOPE_REASON = frozen blocker RCG-B1 closure plus changed semantics and invalidated dependencies after initial independent review
REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = ece5cce6c51cbf0c3768be534b6e35822a86688b
BASE_HEAD = 95a8e1cb512fc99dc018209d837250dd51b4d08f
CURRENT_BASE_HEAD = 95a8e1cb512fc99dc018209d837250dd51b4d08f  # local origin/main readback; no separate remote fetch claimed
REVIEWER_ID = /root/authority_check
AUTHOR_ID = /root
AUTHOR_INDEPENDENCE = PASS
PRIMARY_AUTHORITY = AGENT_CORE_ROUTING_CONFIG_GENERATION_POLICY_V1 accepted/contracts at BASE_HEAD
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
BASE_IMPACT = NONE
FROZEN_BLOCKER_UNION = [RCG-B1]
FROZEN_BLOCKERS_CLOSED = [RCG-B1]
BLOCKERS = 0
NEW_BLOCKERS = 0
SPEC_GAPS = 0
IMPLEMENTATION_REVIEW = PASS
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = YES  # affected source and evidence review only; no merge authorization or action
OPERATION_ALLOWED = NO
NEXT_ACTION = CONTINUE  # complete authorized receipt/push/PR delivery; do not merge or operate production
```

Review recorded at 2026-11-08T07:03:07.632966+00:00. The reviewer authored no product implementation or behavior test; writes are confined to review evidence. The prior initial review covered the bounded RCG implementation and inherited Architecture, D-008, Fleet CTR-SCA-003/004/012, Default priority/absence, GPT6 field/pin/effort constraints, and Process V4 UNKNOWN/fence/no-replay boundaries. This re-audit retains that scope and tests changed semantics and affected dependencies; it does not restart unrelated product audits.

## Frozen blocker RCG-B1: CLOSED

- Class/source: `CONTRACT_VIOLATION`, CTR-RCG-003(1,4), CTR-RCG-004/005 and ACC-RCG-004/005.
- Prior reachable counterexample: at the same Harness root, `.source-stamp` commit changed from `aaaa...` to `bbbb...`; A was unchanged and B referenced a missing route. The initial implementation still returned G0 with `decision=continue` and `closureUnchanged=true`. Original script and executed output are retained in `review-before-harness.log`; that historical failure is not relabeled as a post-repair run.
- Repair: `composition.js` reads the actual `readHarnessIdentity(process.env.DSH_HARNESS_ROOT)` inside each `readContext` capture. Candidate context and target closure now bind the actual version/commit. Same-root source changes fail the equality requirement under rejected C; unreadable/unprovable identity enters whole-candidate refusal.
- Executed closure: the real composition tests `real same-path Harness identity changed_commit cancels G0 continuation` and `... missing_stamp ...` first establish qualified G0 continuation, mutate actual isolated fixture files, then assert rejection, unchanged fake-child turn count, and `configInvalid=true / totalRouteAttempts=0`. These run through production composition and registry/executor; the process transport is an explicit offline fake. Both pass in exact-Head `final-regression.log` and the reviewer's independent rerun.
- Disposition: CLOSED at reviewed HEAD. No additional installed-profile blocker was established in the initial review; speculative hardening has not been added to the frozen union.

## Changed semantics and dependent checks

| Surface | Independent assessment |
| --- | --- |
| Immutable candidate and publication | One captured file/source digest plus immutable context, one shared validator, synchronous activation, sequence guard against older reentrant commits. Refused C never supplies running values. Activation faults and close/reentrant cases are covered. |
| Complete error class | `unknownReferences` is attached only after all catalog, key, duplicate, registration, chain and field checks complete. Reference-only qualification is recorded separately from activation-hook failure. Mixed-error counterexamples refuse A. No catch-and-skip or partial validator success path found. |
| Complete target closure | Presence/raw entry/ordered refs/full referenced descriptors and captured context are compared. Context contains default/explicit layers, registered set, artifact path/digests and actual Harness identity. Same-ref descriptor/effort/providerEnv changes, A changes/deletion, and malformed/unknown/unreadable inputs are refused under bad C. Runtime routes remain sourced from active G. |
| Runtime lifecycle and executor | Cold invalid and restart refuse; lifecycle close removes active trust. Generation attribution adds no hop class. G0 continuation, target refusal and candidate rejection remain distinct. Composed UNKNOWN, partial-output and tool-start tests preserve STOP; old UNKNOWN ledger bytes remain unchanged. |
| Artifact-order repair | `ece5cce6` preserves input property insertion order while cloning/freeze still visits all keys. Canonical `identity()` independently sorts keys, so generation comparison remains deterministic. This preserves the existing artifact verifier's `JSON.stringify` equality expectations without weakening its checks. The previously failing own-domain artifact/default regression now passes. |
| Loader migration | The old public loader facade reexports the shared validator for supported standalone callers. Production startup, process config and turn snapshots consume the new publication boundary; no second validator/executor was added. |

## Executed evidence read and integrity checked

| Evidence | Bound coordinates and actual result |
| --- | --- |
| `coordinates.json` / `baseline-route.log` | pristine implementation base `95a8e1cb...`, paired root `9d8678057be9bdbcc37b640ad8cb18279dc5f971`, original route command: 180 PASS / 0 FAIL / 0 SKIP, rc0; log SHA-256 `831bba88cbb3629bcdd8083c1094d5600a3d62cc69ad9b8a59e9beb9455f7129` |
| `final-regression-result.json` / `final-regression.log` | exact reviewed HEAD `ece5cce6...`, route suite + loader/Default/GPT6 matrix + all new RCG tests + UNKNOWN fence/no-replay: 278 PASS / 0 FAIL / 0 SKIP, rc0; SHA-256 `403aef5d564b1fcc129eced7ec2e80512833f896dc1aa1ecb71d07fe1ff560ce` |
| `independent-recheck-result.json` / `independent-recheck.log` | independently executed by this reviewer at exact `ece5cce6...`; composition and Default tests: 16 PASS / 0 FAIL / 0 SKIP, rc0; SHA-256 `14bb89764f9f714ebd6c8fed7cb8d71b41108f3b9d7396e1b338c7203f82bb3a` |
| `provisioning-canonical-checkout-result.json` / `.log` | isolated canonical-named verification checkout at `3be316599df8b5025329414fcb75ad157a4b24db`, 29 PASS / 0 FAIL / 0 SKIP, rc0; SHA-256 `47af424a2586f40bf9b0d1d5ec9945401361b889f42d8f6845f7b3aa66341880` |

All four log hashes above were independently recomputed and matched their coordinate metadata. The reviewer's rerun removed proxy variables only in its child test environment and used the specified paired Harness for both environment bindings; this changes no host network or production configuration. Full commands, timestamps and rc are in the corresponding result JSON files. Existing earlier failed logs remain historical failed observations.

Provisioning evidence is explicitly impact-rebound, not falsely claimed rerun at the new HEAD: `git diff 3be31659..ece5cce6 -- packages/agent-provisioning` is empty. The only later files are added composition tests and the one-line immutable-copy ordering repair; provisioning test entrypoints import provisioning code directly, not the new copy helper. The copy helper's affected composition/artifact dependency is freshly executed at exact HEAD in both the final suite and independent rerun.

## Structure and delivery limits

The actual existing runner result in `structure-runner.log` is rc0 with `rules_version=CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1`, accepted governing authority V3, and `candidate_result=CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT`. The reviewer does not relabel this as repository-wide PASS, erase listed inherited debt, or claim this task separately qualified the runner for a new policy. The runner is unchanged.

Independently inspected affected file metrics agree with `structure-metrics.json`: maximum 500 physical lines (route-chain.js); validator 496, compose 468; new source/test modules at depth 4. Changed immediate child sets have widths 5, 4, 4 and 5, below 20; the oversized legacy top-level directories' child sets are unchanged. No registry, cap, baseline, scope or allowlist mutation is part of the implementation. `git diff --check BASE..HEAD` returned rc0.

The accepted RCG Spec and other authorities remain unchanged. This is offline source/evidence conformance and a recommendation for the bounded implementation delivery. It is not an installation, real model/provider request, human acceptance, production recovery, deployment, or merge. Final receipt-only delivery HEAD still needs the stipulated independent delta readback; the reviewed semantic HEAD above remains fixed.
