# Unattended workflow mechanism delivery

## Mandate and outcome

Owner mayf3 requested: “按这个目标继续实际落地，把这两处机制补齐，复用现有治理工作流，最后跑一次不需要你逐节点干预的完整验证，不要停在登记任务和发消息上。” The owner previously delegated bounded design decisions with “接受，全权交给你定就行”. Codex acts as the explicitly delegated maintainer for these two bounded source changes, including docs-first acceptance after independent review, source integration, and isolated verification. The PR must persist this delegation and bind reviewed and final accepted commits. No acceptance is inferred merely from a reviewer recommendation.

The two changes are (1) deterministic, target-specific current Workflow inputs with exact source retrieval and explicit completeness; (2) native goal continuation admission through parent-owned execution identity. Existing Workflow and Router records remain authoritative. This mandate does not authorize production deployment, credential extraction, privileged identity switching, historical evidence rewriting, a new workflow engine, or relaxing source-proof checks.

Existing governance instance: `023a28ff-d46d-4bd0-bc38-a55f681a9bb4`, Context `77bfb048-8df5-489b-b56a-5d90439af985`, external reference `feat/workflow-unattended-governance-repair-v1`. Source failure instance: `b39719d8-c67f-46c4-a1e0-d405c7471645`. Registration is not closure. An HR-authored `only-after-root-agent-control-assignment` condition is not an owner requirement; ordinary execution is assigned by the existing workflow roles and accepted task scope.

## DEVELOPMENT_PREFLIGHT — authority authoring

```text
TARGET_REPOSITORY = mayf3/dsh-agent-core
BASE_HEAD = 28eee2403e92f3104fce8e153567b395ee187280
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACTION = NEW
AUTHORITY_ACCEPTED_IN_BASE = NO (new bounded contracts)
PRIMARY_AUTHORITY = AGENT_CORE_PRODUCT_ARCHITECTURE_V1
RELATED_AUTHORITIES = AGENT_PROCESS_LIFECYCLE_HARDENING_V4; AGENT_CORE_AGENT_SESSION_MESSAGING_V2; AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
EXECUTION_MANDATE = VALID (owner instruction above; source and isolated verification)
MUTATION_AUTHORIZATION = VALID (authority documents only at this stage)
ISOLATED_WRITE_SURFACE = YES (codex/workflow-unattended-20261027)
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO
IMPLEMENTATION_ALLOWED = NO until independently reviewed authority is accepted in main
OPERATION_ALLOWED = NO (production)
SPEC_GAP_DEPENDENCY = LOAD_BEARING
OWNER_DECISION_REQUIRED = NO (bounded decisions delegated; independent review still required)
EVIDENCE_REVIEWABILITY = PASS (source and sanitized public records)
LIVE_AUTHORITY_GAP = NONE claimed by this source task
DONE_WHEN = both fixes integrated, affected contracts independently verified, complete isolated unattended run recorded without per-node root intervention
EXPANSION_TRIGGER = changed identity privileges, new goal engine, production activation, or semantic evidence autoapproval
NEXT_ACTION = independent concrete-contract review, docs-first acceptance, implementation preflight
```

## Existing evidence and limits

Artifacts reside at `/Users/yanfenma/workspace/artifacts/workflow-acceptance-binding-20261027/`:

| Artifact | SHA-256 | What it establishes |
| --- | --- | --- |
| governance-testing-return-loop-observations.json | 2de46e59cdee6dae95913d7831bc4a663885da710a57f681ef9f063459a8b29a | correction existed, compaction removed it, old first-page reread resurrected RETURN |
| unattended-workflow-reuse-assessment.json | 0b0069aa239da8a610edb2d5de6b446346f1f6640e8c1d6b92032833c9fc7fcb | existing read-model reuse and bounded missing capability |
| hr-native-goal-source-proof-investigation-20261027.json | 924ec72bed473ab5dd5fae4aa2a45cb2ce188c31c4130e1b11583e96a6fa3288 | first round sends accepted; later rounds lacked valid source proof; driver/Router seam |

The exact historical missing-versus-settled handle is UNKNOWN. Installed source is not loaded-module proof. The earlier run remains `FAIL_MANUAL_CORRECTION_REQUIRED`; later work must not relabel it.

## Execution plan and bounded runbook

1. Freeze each repository's contracts, API/protocol coordinates, authority relationships, scope, and acceptance cases. Independently review the exact docs commits; persist delegated acceptance, final-head delta review, and docs-only merges before implementation.
2. Implement current-input service projection and Broker capability. First execute regression tests showing the current missing behavior. Reuse actor visibility, transaction snapshot, immutable source records, error transport, and existing CAS on writes. Cover long history, old RETURN, explicit correction, oversized source retrieval, stale coordinates, and cross-instance/nonvisible references.
3. Implement native goal admission at the existing driver/Router seam. First reproduce second-round invalid proof. Bind each admitted round to a fresh parent-owned execution, normal settlement and stop/deadline fences; retain negative controls for forged, stale, settled, duplicate and cancelled requests. Do not patch installed production files.
4. Independently review the bounded candidate diff, contract mapping and executed tests. Fix real blockers and review affected deltas. Integrate source only after gates pass; preserve exact SHAs and logs.
5. Freeze an isolated end-to-end trial using the existing governance definition and roles. Bind source/binary/configuration/model/initial input and intended final state. Start once, then allow only read-only external observation. Drive actual execution through native continuation and the new input capability, including a seeded obsolete RETURN and corrected evidence. Count external messages, forced transitions, root fixes and restarts during the trial. Any per-node root intervention fails unattended acceptance.
6. Record genuine termination, remaining UNKNOWNs, receipts and cleanup. Task intake, accepted message, source tests, scheduler activity and terminal business outcome are separate observations. If the trial fails, preserve it; repair a concrete mechanism before a separately identified new trial. Do not replay unknown writes or reset keys/budgets to obtain PASS.

All test execution uses task-owned worktrees, homes, database names, ports and synthetic principals. No production writes, real external business effects or existing scheduler mutation. Secrets must remain in supported credential providers and never enter artifacts. Stop the affected operation on unintended external target, missing binding, unknown mutation outcome, conflicting writer or authority expansion. Test processes and fault objects must be removed with exact ownership checks; test facts and failed-attempt evidence remain available.

## Delivery state

Both mechanisms are implemented and independently source-reviewed. The first actual real-provider trial failed before model progress because normal canonical credential refresh required Owner reauthentication. Complete unattended acceptance is NOT_PROVEN; no production deployment or old-instance remediation is claimed. See the final paired evidence below. The earlier acceptance-binding PR88 is separate and is not present in the current-input service candidate.

## Broker implementation preflight — 2026-10-27

```text
DEVELOPMENT_PREFLIGHT = REUSE / IMPLEMENTATION / BRIEF / CONTROLLED
BASE_HEAD = c1cbd7506ca58c0abace216e651e1cceb98e030d
PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_CURRENT_INPUT_BROKER_V1 at BASE_HEAD
AUTHORITY_ACCEPTED_IN_BASE = YES (PR558; svc protocol PR89 at 52fcb13e63ac7c6696f2c3353ab5a09302cf2014)
IMPLEMENTATION_AUTHORITY = contracts
EXECUTION_MANDATE = VALID (owner mandate above)
ISOLATED_WRITE_SURFACE = codex/workflow-current-input-broker-impl-20261027
IMPLEMENTATION_ALLOWED = YES (new manifest, default registration, focused transport tests, this record)
OPERATION_ALLOWED = NO (production)
ACCEPTED_SPEC_MUTATION = FORBIDDEN
DONE_WHEN = affected Broker contracts verified, independently reviewed source integrated, paired isolated trial evidence attached
NEXT_REAL_ACTION = failing current-input capability tests, implementation, generic-transport regression, independent source review
```

Native admission and service implementation use separate worktrees and writers. Root implements only this Broker slice. Original authority-authoring state above is retained as history, not a current blocker. Required composed model/workflow validation is still NOT_RUN.

## Broker implementation evidence — 2026-10-27

The candidate adds `workflow_current_task_input` once to the default inventory and binds the accepted GET protocol through the existing generic transport. It preserves service qualification/errors and gives body assembly, digest and stale-input guidance. It adds no write, identity input, retry or semantic verdict.

Executed evidence is under `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/`:

- `broker-red-capability.log` / `.json`: four new cases fail against the missing capability (exit 1). The earlier dependency-import failure is separately retained in `broker-red.log`, not counted as behavioral RED.
- `broker-regression-final.log` / `.json`: 538 Broker tests pass, zero failures/skips, exit 0. The JSON binds the tested file hashes. Log SHA-256: `6460f87e8739c38d701060fadfc5670f84e6c1f6aef32c609d6132c1f9bf35ea`.
- `packages/broker/test-support/current-task-input-responses.json` preserves two actual isolated service HTTP response captures with provenance. Tests replay them through real loopback HTTP and the generic Broker transport, including an 8190-byte Unicode chunk. This proves transport fidelity, not a live composed workflow verdict.
- `structure-baseline-result.json` records the unmodified integration base `c1cbd750` failing the structure verifier with exit 2: a stale registry entry for `packages/agent-credential-provisioning/src/store-writer.js`. This is an existing configuration failure, not PASS. Affected source/test files remain below 500 lines; no new child is added to the existing 26-child capability directory or 20-child capability-test directory. Existing read-manifest and instance-test modules are reused. Registry repair and unrelated directory migration are outside this bounded capability change.

Source review and actual paired autonomous validation remain pending at this record. No installed or production remediation is claimed.


## Paired implementation and real trial — 2026-10-27

The Agent Core integration combines reviewed Broker `1d8bcc91be4e6593ac77093942901842876493c8` and native admission bridge `489d6a203b91783b6ff2b51dbbe6401c10eb51df` into `4231c9f1532f8e4740d8becbe45953d872b2c8ae`. Real profile boot then exposed an identical duplicate YAML key already present in the base. Mechanical commit `3e7816929845df82850757ece40339647c519ab9` removes that duplicate, preserves its original value, and passed independent Luna review and actual child READY/exit checks.

Paired source coordinates:

- native harness fork PR5: `9d8678057be9bdbcc37b640ad8cb18279dc5f971`, clean post-commit build and actual `readHarnessIdentity` match. Native goal ownership remains in the original driver; an awaited external admission hook supplies the existing Router queue with the original message and a fresh execution handle. Cancellation removes the exact queued parent request; monotonically ordered reservations prevent replay after old reconciliation records expire.
- svc-workflow PR90: `4eabe824cc4a36bd4c8ac6584adb0aa5a56cd266`, independently reviewed. Actual clean candidate binary SHA-256 `7a26fc4e21a86d4fa5a84c44a392d3c2a9d724e9822266a9f980f81a19dfbce3`; real localhost `/version` reports this commit. The snapshot read supplies exact entry/current Context, bounded recent/RETURN/explicit originals, complete body retrieval and stale-coordinate checks without changing workflow writes.

Executed checks: 538 Broker tests; 25 new real service HTTP/database cases plus 38 query, 12 submission, 9 model3 and 212 library regression cases; 413 native related cases and 2 assembled snapshot cases. Root independently ran 22 native enqueue cases and 14 integrated pair cases, all passing with actual exit 0. These tests use scripted models where documented and do not establish real-provider autonomy. The expanded Agent Core regression retained 337 pass, 1 skip and 1 optional Feishu dependency import failure; structure verification retains its unrelated baseline registry error. No aggregate full-suite PASS is claimed.

Independent source reports under the artifact root:

- `broker-source-review-1d8bcc9.json`
- `svc-current-input-source-review-4eabe82.json`
- `native-admission-source-review-489d6a2.json`
- `native-upstream-source-review-9d86780.json`
- `integration-mechanical-fix-3e78169.json`

### Actual unattended trial outcome

`e2e-runs/trial-20261027-a2` used the exact published existing governance graph: 14 nodes, 15 transitions, semantic model 1, with only fixed role principal IDs mapped to isolated test identities. A began at draft/v1 with no submissions. B began at testing/v13 with 12 explicitly excluded fixture submissions, including an obsolete RETURN and a later corrected original exceeding the old history window. Stage contracts refer to actual reviewed artifacts, a task-owned local merge target and localhost installation/health checks. They never predeclare a role verdict or require an early node to prove a future stage.

The frozen pair was Agent Core `3e781692`, native `9d867805`, service `4eabe824`, actual catalog model `openai-codex/gpt-5.6-luna`. The runner issued exactly one external HR instruction at 02:22:18Z. It did not supply node prompts, transitions, forced retries or workflow repairs. The first HR execution failed at 02:22:18.468Z with the public error:

> canonical credential outcome is unknown; Owner reauth is required

The exact execution settled `failed` with `exact_terminal_then_idle`. No goal was created, no native continuation was admitted and no Broker tool was called. Final A remains draft/v1/zero submissions; B remains testing/v13 with only its 12 bootstrap submissions. Consequently `ACC-NGC-006` and the complete autonomous governance acceptance remain **NOT_PROVEN**. The run classification is **FAIL_PROVIDER_AUTH_BEFORE_MODEL_PROGRESS**, not successful unattended closure.

Non-secret filesystem metadata shows the refresh intent was created during this trial, while the canonical credential file generation was not replaced and no lock remained. The refresh wrapper hides the underlying provider exception; the specific refresh failure cause remains UNKNOWN. No credential contents were read/copied into evidence, no pending marker was removed, and the unknown refresh was not replayed. Continuing requires the existing Owner reauthentication flow and a separately frozen fresh trial.

After recording the already-failed idle execution, root stopped only the owned HR test child. Its actual exit, runtime exit and service/auth cleanup are recorded; runtime exit 0 means successful cleanup, not business success. All test databases and failed-attempt evidence remain preserved. Production installations and existing workflows were not mutated by this trial.

Raw evidence: `run-freeze.json` SHA-256 `00fad768230d7bc28cbb07ca9cc10e2040287c643f07c6510f83c2518e302817`; `control/native-public.jsonl` records the error and exact terminal events; `failed-trial-stop.json`, `runtime-execution.json`, `final-db-facts.json`, and `infra-final-cleanup.json` preserve the outcome and actual cleanup. The current next action is account Owner reauthentication followed by a fresh one-trigger trial; registration and source PASS do not close this task.
