# DEVELOPMENT_PREFLIGHT — GCR typed review projection implementation

SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = f63eaf6e000d2bbf4343c727d38474147db7f6cb (fresh origin/main)
BASE_HEAD = f63eaf6e000d2bbf4343c727d38474147db7f6cb
CURRENT_BASE_HEAD = f63eaf6e000d2bbf4343c727d38474147db7f6cb (fresh fetch + rev-parse origin/main)
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
GOAL_OR_TARGET = Implement accepted CTR-GCR-005 with focused broker tests and isolated linked-resolve acceptance evidence.
CURRENT_GAP = Resolve currently forwards only its declared body args; it has no trusted static projection from an optional top-level typed review reference into the existing nested service field.
OBSERVATIONS = Accepted Core GCR AMENDMENT_1 is on origin/main at f63eaf6; `workflow_assistance_action.resolve` currently declares only assistanceCaseId, expectedWorkflowStateVersion, resolution, and body binding `['expectedWorkflowStateVersion','resolution']`; current HTTP transport constructs body from a manifest allowlist and has no typed projection; A65 exact rejection is pinned in `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/gcr-typed-review-spec-20261029/a65-resolve-excerpt.json` (SHA-256 `48579b65d5d47174037c740123800362ad154b1843e2e0d83142bfca07b83350`).
WORKING_GUESS = NONE
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1@AMENDMENT_1 (accepted 2026-10-29)
RELATED_AUTHORITIES = CTR-GCR-005; ACC-GCR-002; existing Broker schema/transport contracts
IMPLEMENTATION_AUTHORITY = contracts
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = YES (accepted authority in base)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
EXECUTION_MANDATE = VALID (explicit root authorization for source and isolated tests only)
MUTATION_AUTHORIZATION = VALID (this worktree source/tests/docs; production none)
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = NO
SPEC_GAP_DEPENDENCY = NONE
EVIDENCE_REVIEWABILITY = PASS
LIVE_AUTHORITY_GAP = NONE
OWNER_DECISION_REQUIRED = NO
EMERGENCY_STATE = NONE
EMERGENCY_ACTION = NONE
INCIDENT_REFERENCE = A65 excerpt only; do not operate or modify original A65 instance
BASE_IMPACT = BOUNDED
IMPLEMENTATION_ALLOWED = YES (source and isolated tests only)
MERGE_READY = NO
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = TDD RED for A65 extra fields and projection negatives; GREEN focused manifest/schema/HTTP/compatibility tests; structure guard; A67 real Core-to-Svc linked resolve/readback coordinated by root; independent source review.
DONE_WHEN = Minimal static trusted projection is validated by manifest/schema and exercises the accepted behavior, with focused tests and exact commit evidence; cross-service acceptance remains gated on A67; no production/A65 effects.
EXPANSION_TRIGGER = Required contract behavior cannot be expressed in the existing Broker schema/manifest/transport without a broader authority change.
NEXT_REAL_ACTION = Independent review of the exact candidate commit; after review, root coordinates A67 linked Core-to-Svc acceptance.
NEXT_ACTION = REVIEW

## Implementation brief

Use a closed five-string top-level `governanceChildReview` schema only on resolve and a static manifest-owned mapping into `resolution.supportingPayload.governanceChildReview`. The mapping must not be model-configurable. Typed absence preserves current body behavior. When present, create an absent payload object only in a new body projection; reject malformed typed/container values as `invalid_arguments`, and reserved-target collisions as `binding_error`, before HTTP. Preserve all siblings and caller-owned inputs. No scope, route, service, idempotency, UUID/digest subsystem, A65, or production changes.

TDD begins with the exact A65 shape plus missing/extra fields, invalid containers, collision, copy-on-write identity preservation, and no-fetch checks. Keep changes within existing Broker capability/schema/transport/test surfaces and run the structure guard against this exact base to detect baseline registry inconsistencies without editing the registry. After focused source tests pass and independent source review, coordinate the real linked resolve proof as A67 with root; do not use the A65 instance or invent a duplicate service fixture.

## Implementation evidence

- TDD RED was observed before implementation: the resolve manifest lacked a static projection, typed fields were absent from the outbound body, and malformed/colliding values were not rejected locally.
- GREEN focused: `env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy node --test --test-reporter=spec packages/broker/test/workflow-assistance-capability.test.js` — 13 passed, 0 failed.
- GREEN Broker package: from `packages/broker`, `env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy npm test` — 645 tests, 624 passed, 21 skipped, 0 failed.
- Governance: `python3 .agents/tools/verify_governance.py --target . --require-accepted` — PASS.
- `git diff --check` — PASS. Changed-file line counts: schema.js 499; body-projection.js 97; workflow-assistance.js 272; http.js 291; focused test 401.
- Structure guard was run against base `f63eaf6e000d2bbf4343c727d38474147db7f6cb`; it stopped on the existing registry inconsistency that `packages/agent-credential-provisioning/src/store-writer.js` is registered as a baseline file over 500 lines. That unrelated registry/file was not changed. The full repository `npm test` attempt was interrupted after its production-runtime tests rejected ambient `HTTP_PROXY` (`AGENT_MODEL_OVERRIDE_INVALID`); it is not used as a pass/fail claim for this change.
- A67 linked Core-to-Svc acceptance and independent source review remain pending. This candidate has not been merged, and no production or A65 operation was performed.

## Independent review delta — optional projection-only body

- Reviewer found that `bindRequest` gated projections on at least one direct body argument. A valid manifest with an optional object body root and an optional projection source therefore silently omitted a supplied projection.
- RED wire regression: `node --test --test-reporter=spec packages/broker/test/transport.test.js --test-name-pattern='optional projection source creates'` failed because the observed response lacked the projected body.
- Fix: always apply trusted projections to the copy-on-write body, then serialize only when the final body has at least one own key. With both direct body values and projection sources absent, the result remains `undefined` and no body/content-type is sent.
- GREEN: `env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy node --test --test-reporter=spec packages/broker/test/transport.test.js` — 37 passed, 0 failed; same command for `packages/broker/test/workflow-assistance-capability.test.js` — 13 passed, 0 failed.
