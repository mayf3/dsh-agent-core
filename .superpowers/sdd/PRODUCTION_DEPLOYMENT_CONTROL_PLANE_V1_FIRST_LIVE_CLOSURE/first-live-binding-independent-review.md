# Independent first-live binding security review

SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = AFFECTED_CONTRACT
SPEC_REVIEW = NOT_APPLICABLE
REVIEW_TARGET_HEAD = 730d4a0539cc758eb8c0440e9ceddbefde4c017d
REVIEW_TARGET_TREE = dcfc5c84b663da8b1713627757d29503d89aba99
BASE_HEAD = 78daf3699346f6f68264921443d42552d9157dae
CURRENT_BASE_HEAD = 78daf3699346f6f68264921443d42552d9157dae
REVIEWER_ID = dcp_first_live_binding_review
AUTHOR_ID = dcp_first_live_binding_impl
AUTHOR_INDEPENDENCE = PASS
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
BASE_IMPACT = NONE
BLOCKERS = 0
SPEC_GAPS = 0
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = NOT_APPLICABLE
OPERATION_ALLOWED = NO
NEXT_ACTION = CONTINUE
INDEPENDENT_AFFECTED_SURFACE_REVIEW = PASS

Review date: 2026-09-18. This reviewer did not author the design or semantic implementation. No production endpoint, root command, real key, installed package or existing runtime was used or changed. Only this report and independent nonroot test evidence were written. Integration and separately authorized disabled genesis are not operations covered by this verdict.

## Scope and authority

The review covers only the diff from the exact base above to source commit 730d4a0: signed optional business-prerequisite child mapping, authenticated registry resolution/READY validation, private Owner-policy v2 source selection, immutable draft reservation and lease-cache compatibility. Accepted PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1 semantics at 39865536ce51005f95a98473e77c2329078512c0, CTR-DCP-001/004/010/014/015 govern this REUSE implementation. No accepted Spec changed; no receipt import, migration facet, caller-selected recipe, signer identity, queue schema, mutex, rollback authority, artifact admission or bootstrap package delta is present.

The remote main observation was cfc272967ab3dd3842079596628371b636c3aac4. It is not this isolated candidate's integration base, and its unrelated movement is not treated as invalidation. Any future integration with changed authority, affected code or actual conflicts requires a bounded impact recheck.

## Checked security and compatibility paths

- `registry/types.rs:35` preserves the original prerequisite and provenance while optionally signing an exact deployment-child ID and full Signed<Enrollment> digest. Omission preserves legacy canonical serialization. `registry/dependencies.rs:5` traverses only explicit IDs, checks exact authenticated child digest/business parent/repo/target/profile/producer/standing authority, rejects duplicate effective IDs and cycles, and never uses a business-label search or fallback. `registry/storage.rs:92` verifies enrollment signatures from protected ledger history before resolution. Enrollment immutability remains enforced.
- `registry/mod.rs:109`, `:125` and `:172` validate resolution under the existing registry lock at enrollment, issuer resolution and READY activation. `registry/validation.rs:131` requires the explicit effective child in signed READY/proposal dependencies; mapped children require LiveInstallation and cannot downgrade to HistoricalReceipt. The queue continues to supply exact unit/capability/transaction identity and current safe-finalized Goal PASS. No transport-only success path was introduced.
- `issuer/owner_policy.rs:42` decodes only finite strict v1 or v2 shapes without Value buffering that would erase duplicate keys. Unknown/mixed/null source fields, duplicate map entries and oversized maps fail. `:195` selects only the exact enrolled Goal digest; repo, accepted authority source hash, activation profile and mutable/executable target slots must agree. There is no caller source-map input or default selection for an unknown Goal.
- `issuer/coordinator.rs:95` resolves policy/enrollment/dependency bindings before queue prerequisite lookup, source observation, staging and review. The public request remains only Goal ID and source SHA. Catalog/profile/configuration trust and the existing isolated review/signing path remain mandatory.
- `issuer/owner_policy.rs:267` binds v2 issuance to the whole protected Owner policy, selected source, authenticated signed enrollment and native activation digest. Legacy v1/no-mapping drafts retain their previous binding formula. `issuer/issuance.rs:34` verifies retained binding-index/draft hashes and rejects a changed binding for the same Goal before creating a second draft. Exact resumptions remain possible; reconciliation of a changed outstanding binding is explicitly still required.
- `issuer/policy.rs:25`, `:96` and `:182` preserve v1 serialized cache/signature semantics while binding v2 to the full source map and existing monotonic Owner policy epoch/equivocation controls. Existing revocation, cache metadata and clock rollback checks remain in force.

No concrete security or logic blocker was found in these affected paths. This is a bounded review conclusion, not an assertion that all future policy contents or operational integrations are safe.

## Executed evidence

`independent-focused-checks.json` records this reviewer's direct execution of the exact candidate's compiled nonroot test binaries, binary SHA256 values, arguments, exit status and output. All six filtered executions passed, 27 top-level focused cases: Owner-policy decoding/source selection/custody binding, draft persistence/resume/conflict, policy lease/replay/equivocation, mapped-child real fixture transaction/finalization/producer closure, issuer dependency lookup and registry mapping adversarial cases. No source edits were required.

Author-produced `full-final.log` was inspected at SHA256 `ebd97c1d47ef32dcbb3abe8acda645ece9cc5189e7667a7a7f5f4687edd8407a`: fresh locked full-suite exit 0, 272 top-level passed, zero failed, two pre-existing manual probes ignored. The log also contains 64 nested worker successes; these are not additional top-level tests. The exact tree remained unchanged from review start through source commit. `fmt.log`, strict all-target `clippy.log` and locked `release.log` cover the same source and show no failure; their digests are retained in the evidence index below.

`structure.json` reports three unchanged baseline directory failures outside this candidate: production-runtime/src 21 to 21, production-runtime/test 23 to 23, scripts 59 to 59. This is not a global structure PASS. No changed DCP surface caused a reported structure violation; this review does not expand into unrelated baseline cleanup.

## Required first-live boundaries retained

1. Mapping authenticity does not prove that a chosen child semantically covers the Watchdog prerequisite. The exact later enrollment/profile/verifier operation must bind genuine admission, W1/W2 freshness, health, outbox and applicable canary/provenance/finalization requirements. Registry has no Configuration::VerifierBinding and cannot prove those observations by itself. NativeInstalledReadback must not be used as a generic substitute. The fixture's signed PASS proves only state-machine/transport behavior.
2. Actual Watchdog/Broker child IDs, signed enrollments, v2 policy contents, trusted semantic verifier, complete current protected target preimage and pending legacy enrollment/draft/queue disposition remain operational preparation gates. No IDs or production records were fabricated by this candidate. The old Broker enrollment and sealed v1 package remain unchanged.
3. Parent reported later filesystem rollback and reappearance of selected runtime files in the owning recovery task. That is outside this code review and is not protected whole-target generation/health/Watchdog semantic acceptance evidence here. Fresh protected proof and exact upstream/accepted-authority compatibility remain necessary before adoption/deployment. An earlier missing-file snapshot must not be repeated as confirmed-current state.
4. V2 policy or mapped ledger rows cannot be blindly consumed by old v1 software. Provisioning, activation, rollback compatibility and necessary legacy retirement need the separately reviewed exact operation package and existing Owner permission boundary. This review grants no production authority and does not assert BOOTSTRAP_READY, first-live readiness or parent-Goal completion.

Final delivery-coordinate recheck: evidence-only descendant `7c3c037a2b420243de46775de397b6283823f306` has zero package source/test delta from reviewed `730d4a0`; `git diff --exit-code 730d4a0 7c3c037 -- packages/deployment-control-plane` returned 0. The source verdict therefore remains bound to 730d4a0/tree dcfc5c8, with evidence delivery at 7c3c037. This separate independent review was not authored or committed by the implementer.
