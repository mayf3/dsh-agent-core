# Bounded complete Workflow original implementation

The new `workflow_current_task_body_complete` LOCAL capability retrieves one exact original through the existing per-actor authorized HTTP transport. It returns full UTF-8 text only after contiguous page validation and whole-body SHA-256 verification. It does not evaluate evidence, choose originals, advance Workflow, or authorize production adoption.

## Authority and scope

`DEVELOPMENT_PREFLIGHT`: **REUSE / EXEC_PLAN / CONTROLLED / IMPLEMENTATION**. Accepted authority is `AGENT_CORE_WORKFLOW_CURRENT_INPUT_BROKER_V1.md`, CTR-CIB-006–011, merged by PR561 at `adab4358b070980c9b7e1d9e3943f643c2ac6074`. Spec SHA-256 is `ff299e9080016f570638aaf1d06cbde137cc0d27556e50ddb30698f2f936d116` and is unchanged. Implementation base `9c7e95aed02b5095f1711d55205d42b141880b09` merges that authority into delivery `84bb2c012e78bf14cf9756d6c214bc254d15fb8f`, retaining the a9 report and its partial business result.

Work is isolated on `codex/workflow-complete-body-impl-20261027`; no production process, credential, old trial, governing Spec, or a10 database was changed. Tests use loopback fixtures and task-created synthetic credentials. No model was called. Root owns independent source review, integration and unattended a10 acceptance. The separate paired-service canary is owned by an independent executor.

## Implementation and conformance

- **CTR-CIB-006:** One default manifest/tool, LOCAL read, `workflow.read`, eight closed required arguments. UUID identity is parsed and canonicalized; state/digest/current-detail identity are checked before credentials or HTTP. No model-controlled limit, offset, actor or endpoint.
- **CTR-CIB-007:** The gateway's built-in handler uses its existing `transportFor(actualAgentId)`. Every page uses the existing current-input body GET and token/cache/target seams. Shared trusted transport controls disable redirect and 401 reissue for this operation only; ordinary HTTP behavior remains unchanged. No harness `localHandlerResolver` injection is needed.
- **CTR-CIB-008:** Closed page/binding/body shapes, exact request identity, stable metadata, strict wire UTF-8 and well-formed text, contiguous progress and terminal status. Any denial, malformed page, drift, gap, overlap or OMITTED body discards assembly without restart.
- **CTR-CIB-009:** Exact full text, canonical binding, requested SHA, complete metadata and verification count. Parent relay success and mapped handler success are also validated rather than treating partial data as a complete result. No artifact file or durable read ledger is created.
- **CTR-CIB-010:** Fixed 131072 body bytes, 8192 content bytes/page, 65536 decoded entity bytes before JSON parsing, 2097152 total decoded entity bytes, 32 body attempts, 30000ms monotonic shared deadline, 1048576-byte success and bounded fixed failure. Token entities count toward decoded budgets. Credential/token/header/body waits share cancellation; late resolutions cannot start another request. Mapping, relay, gateway and rendering errors do not echo arguments, originals, paths or arbitrary exception text.
- **CTR-CIB-011:** Guidance requires exact authoritative descriptors and separate retrieval of every required distinct original; full retrieval is not semantic QA PASS. No workflow business write, dispatch, activation, evidence authority or read-to-ADVANCE gate is added.

`transport.js` retains its existing exported API behind smaller token/binding/error/HTTP modules. The internal sanitizer moved byte-for-byte; its old path was not a package export and all repository importers were updated. The workflow read module moved into a directory while retaining old manifest exports and behavior; both repository direct importers were updated. No dependency or lock file changed.

## Executed verification

Node: `/usr/local/libexec/agent-core/node-runtime/bin/node` v25.6.1. Full affected Broker suite ran with all `packages/broker/test/**/*.test.js`: **609/609 PASS, actual exit 0**, with no skipped/cancelled tests. This includes 64 new complete-body cases and old current-input, transport, gateway, grants, relay, mapping and registry behavior, including the old GET 401 refresh/reissue contract. No unrelated repository-wide or model suite is claimed.

The suite ran before the candidate commit. `tested-source-files.json` binds the exact source/test bytes; the final candidate binding checks those bytes against the commit. It is not described as a post-commit test execution. Raw command, timestamps, actual subprocess exit and log hash are in `broker-final-observed.json`; raw log SHA-256 is `808aad72c1ce861e4d812303379a2caa992776b86b97ea5b9d66f4d9aee67dd4`.

Actual RED→GREEN evidence includes the initial corrected 21-failure missing-feature run; redirect extra-request and relay exception failures; credential-family mismatch; corrected real HTTP200 error-code injection and non-JSON token-denial status failures; partial relay success; and mapped pre-handler/partial-success failures. Original unsuccessful fixture attempts remain preserved and are not relabeled product RED: the first credentials fixture used the wrong store key, the first HTTP200 case accidentally set HTTP409, and the first partial-relay assertion threw while dereferencing null. Each has a separately corrected failing execution before its relevant fix.

Resource tests exercise exact body/entity/cumulative/page boundaries and +1, strict Unicode, second-page metadata/pagination drift, fake-clock credential/token/header/final-body deadlines, late credential suppression, real streaming HTTP cancellation/deadline, redirects and no401 retry. The valid worst-escaped 131072-byte body is below the 1MiB success limit: a +1-over-success-cap case cannot be constructed while satisfying the closed schema/body cap, so no fabricated reachable output-boundary test is claimed. The implementation still checks serialized success before publication. Failure and rendered failure tests stay below4096 bytes without caller content.

Structure baseline check at the exact base returns **exit2 INVALID_CONFIGURATION_OR_REGISTRY**, because `packages/agent-credential-provisioning/src/store-writer.js` is listed as a legacy >500-line file but no longer qualifies. This is retained baseline debt, not structure PASS. Final-head verifier output is recorded separately. Changed handwritten files are <=500 lines; source root remains20 children, capabilities remains26, test root remains28 and test/capabilities remains20 (existing wide directories do not grow). New transport/read subdirectories stay below limits; test/gateway grows from3 to5.

## Acceptance boundary

ACC-CIB-004 and the instrumented-source portions of006/007/008 have executed evidence above. ACC-CIB-005 and real-service portions of006/008 remain **PENDING independent paired HTTP canary**. ACC-CIB-009 remains **PENDING root-owned unattended role trial**. This source delivery is not all-acceptance PASS, business QA PASS, production installation, or deployment authorization. Old a9 missing-original and digest-transcription facts remain unchanged.

Evidence directory: `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/workflow-complete-body-implementation-20261027/`. The external candidate/conformance JSON binds final source HEAD, file hashes, test exits and remaining acceptance work.
