# DEVELOPMENT_PREFLIGHT — current governance-review reference implementation

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = d99ae8fda4a23ca540cfcbfee0881262254fef2e
BASE_HEAD = origin/main 01c1cd0c4a980e1a37878ea5ad05f4d46fb3ba99
CURRENT_BASE_HEAD = origin/main 01c1cd0c4a980e1a37878ea5ad05f4d46fb3ba99
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
GOAL_OR_TARGET = Implement the explicit current-governance-review resolve operation and trusted invocation-local read-to-body projection under CTR-GCR-006 / ACC-GCR-003.
CURRENT_GAP = Broker does not bind an authorized current detail-read result to resolve; an Owner must transcribe service-owned proof values and A68 observed a one-character digest transcription error.
OBSERVATIONS = PR #574 is merged in current main; accepted Spec reviewed head c6d851aa. Existing workflow_assistance_read.detail uses workflow.read and action uses workflow.execute. Existing native allowlist matches exact tool/operation and uses existing {version,agentId,policyDigest} initialization acknowledgement. Worktree was clean; branch codex/gcr-typed-review-impl merged accepted main to HEAD d99ae8fd.
WORKING_GUESS = NONE
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1@accepted AMENDMENT_2 / CTR-GCR-006 / ACC-GCR-003
RELATED_AUTHORITIES = AGENT_CORE_TRUSTED_NATIVE_TOOL_POLICY_V1; AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V2; accepted Svc governance-child companion
IMPLEMENTATION_AUTHORITY = contracts
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = YES
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
EXECUTION_MANDATE = VALID (root authorized source and isolated tests only)
MUTATION_AUTHORIZATION = VALID (owned source worktree, tests, and this preflight; no production)
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = NO
SPEC_GAP_DEPENDENCY = NONE
EVIDENCE_REVIEWABILITY = PASS
LIVE_AUTHORITY_GAP = NONE
OWNER_DECISION_REQUIRED = NO
EMERGENCY_STATE = NONE
BASE_IMPACT = RELEVANT (accepted amendment is now in implementation base)
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = NO
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = TDD RED/GREEN tests for manifest/schema registration, same-caller read authorization, actual DTO predicates, pre-read collision rejection, no POST on read failure/stale evidence, actual emitted-GET counts, byte-exact projection, original CAS preservation, typed/opaque compatibility, no replay; focused Broker tests; structure guard result; independent source review.
DONE_WHEN = Minimal manifest-driven generic mechanism and operation with focused meaningful tests are committed on this branch; no service, run, home, or production activity; exact head and test evidence reported to root.
EXPANSION_TRIGGER = Required behavior cannot fit existing Broker gateway authorization, manifest registration, or HTTP transport without a new scope/service API/authority; stop and report.
NEXT_ACTION = CONTINUE
```

## Implementation validation

- `npm test -- --test-reporter=spec` from `packages/broker`: PASS, 654 tests, 633 pass, 21 skipped, 0 failed.
- Focused Owner-wake regression: PASS; it requires the new operation in the review instruction.
- `python3 .agents/tools/verify_governance.py --target .`: PASS; vendored governance bytes match the lock.
- `git diff --check`: PASS.
- `node scripts/verify-code-structure.mjs --base origin/main --head HEAD --json`: blocked by the pre-existing registry entry for `packages/agent-credential-provisioning/src/store-writer.js`; the base file is 458 lines, so it does not satisfy the registry's `>500` baseline condition. No new directories were added; changed source and test files remain below 500 lines.

## Bounded implementation brief

Follow CTR-GCR-006 and ACC-GCR-003 exactly. Add a distinct operation; leave `resolve` typed and opaque paths unchanged. Use trusted static manifest configuration for an invocation-local, same-caller detail read, validate the concrete Svc detail DTO predicates, and project only the five service-owned fields. Preserve the caller's expected version unchanged and the existing idempotency/no-replay behavior. Keep normal `workflow.read` and `workflow.execute` authorization; do not add scopes, grants, routes, service APIs, persistent result stores, automatic correction, or automatic resolve.

TDD sequence: first prove missing operation/schema registration and missing read projection; then cover positive byte-exact projection and errors/request-count boundaries, run focused Broker tests, run structural guard and governance integrity checks. No live run, service, database, home, production, or model calls are authorized.
