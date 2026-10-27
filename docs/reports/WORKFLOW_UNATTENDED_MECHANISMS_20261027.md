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

Both mechanisms are implemented and independently source-reviewed. Trial a6 recorded actual native rounds 1 and 2 with distinct peer nonces and complete current-input byte delivery, but the full business run failed at a recoverable role-input error and an overly restrictive fixture deduplication rule. Subsequent investigation also found that production-managed plugin projection touched the test homes; complete filesystem isolation and historical module-path provenance are not established. Complete unattended business acceptance remains NOT_PROVEN. The prior account-wide request for Owner reauthentication was incorrect and is withdrawn: a2 used a different deployment credential domain from working HR. No production deployment or old-instance remediation is claimed. The earlier acceptance-binding PR88 is separate and is not present in the current-input service candidate.

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

Native admission and service implementation use separate worktrees and writers. Root implements only this Broker slice. Original authority-authoring state above is retained as history, not a current blocker. At that historical point, composed model/workflow validation was NOT_RUN; subsequent actual trials are recorded below.

## Broker implementation evidence — 2026-10-27

The candidate adds `workflow_current_task_input` once to the default inventory and binds the accepted GET protocol through the existing generic transport. It preserves service qualification/errors and gives body assembly, digest and stale-input guidance. It adds no write, identity input, retry or semantic verdict.

Executed evidence is under `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/`:

- `broker-red-capability.log` / `.json`: four new cases fail against the missing capability (exit 1). The earlier dependency-import failure is separately retained in `broker-red.log`, not counted as behavioral RED.
- `broker-regression-final.log` / `.json`: 538 Broker tests pass, zero failures/skips, exit 0. The JSON binds the tested file hashes. Log SHA-256: `6460f87e8739c38d701060fadfc5670f84e6c1f6aef32c609d6132c1f9bf35ea`.
- `packages/broker/test-support/current-task-input-responses.json` preserves two actual isolated service HTTP response captures with provenance. Tests replay them through real loopback HTTP and the generic Broker transport, including an 8190-byte Unicode chunk. This proves transport fidelity, not a live composed workflow verdict.
- `structure-baseline-result.json` records the unmodified integration base `c1cbd750` failing the structure verifier with exit 2: a stale registry entry for `packages/agent-credential-provisioning/src/store-writer.js`. This is an existing configuration failure, not PASS. Affected source/test files remain below 500 lines; no new child is added to the existing 26-child capability directory or 20-child capability-test directory. Existing read-manifest and instance-test modules are reused. Registry repair and unrelated directory migration are outside this bounded capability change.

Source review and actual paired autonomous validation were pending at that historical record. Subsequent reviews and trials follow; no installed or production remediation is claimed.


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

Non-secret filesystem metadata shows the refresh intent was created during this trial, while the canonical credential file generation was not replaced and no lock remained. The refresh wrapper hides the underlying provider exception; the specific refresh failure cause remains UNKNOWN. No credential contents were read/copied into evidence, no pending marker was removed, and the unknown refresh was not replayed. The original inference that the user must reauthenticate is withdrawn. Fresh routing evidence below distinguishes this separate credential domain from the working HR domain; the unknown a2 refresh was not replayed.

After recording the already-failed idle execution, root stopped only the owned HR test child. Its actual exit, runtime exit and service/auth cleanup are recorded; runtime exit 0 means successful cleanup, not business success. All test databases and failed-attempt evidence remain preserved. Production installations and existing workflows were not mutated by this trial.

Raw evidence: `run-freeze.json` SHA-256 `00fad768230d7bc28cbb07ca9cc10e2040287c643f07c6510f83c2518e302817`; `control/native-public.jsonl` records the error and exact terminal events; `failed-trial-stop.json`, `runtime-execution.json`, `final-db-facts.json`, and `infra-final-cleanup.json` preserve the outcome and actual cleanup. This is historical a2 evidence, not an account-wide reauthentication requirement. Registration and source PASS do not close this task.


### Route correction and subsequent actual trials

Production HR completed a real `openai-codex/gpt-5.6-luna` turn at 04:50:45Z through the `authsvc` deployment. A2 had selected the separate `yanfenma` deployment credential. `auth-route-correction-20261027.json` (SHA-256 `83d89d233627de2e0623ed89087ae0b32c4f949e3cc39540f123ee4cbec7263b`) withdraws the request for user re-login. Existing canonical credential references are reused normally; no credential contents were copied/read into evidence, no OS identity switch or existing Agent restart occurred.

- **A3:** corrected domain, transport failure before model progress. Its isolated configuration lacked provider proxy settings; the specific provider failure cause remains UNKNOWN.
- **A4:** explicit public macOS proxy configuration passed a credential-free connectivity check, but required Node 25.6.1 x64 exposed missing exact optional native dependencies before model progress. Four version/integrity-pinned packages were installed only into task-owned artifacts and ignored candidate dependencies. Tracked source, locks and original build outputs stayed unchanged.
- **A5:** actual model ran four automatic rounds and retrieved complete current input. The isolated auth/service processes disappeared; actual exit/signal/cause remains UNKNOWN. The second peer probe failed because its token endpoint was unreachable, not a demonstrated fresh-session permission loss. HR autonomously blocked and model/runtime cleanup completed.
- **A6:** detached task-only service and runtime supervisors survived launch-tool exit and autonomously recorded actual exits. A preliminary real service survived 333.577 seconds and cleaned up normally. The actual model trial entered five native rounds, proved the first two distinct-nonce peer exchanges, and made three real workflow submissions without root intervention. A stopped at PM/v2; B reconciled the old RETURN against the corrected original and reached QA pre-release/v15. Neither case became terminal; local merge/install were not performed.

A6's PM requested a transition ID with one incorrect character (`...b94f74f0600a` instead of the authoritative `...b94e74f0600a`). The service correctly rejected it. The fixture's instruction to dispatch each visit at most once then prevented bounded correction, and HR incorrectly repeated the role's claim of a service gate. This identifies an isolated fixture-policy defect, not a demonstrated production policy defect. A separate fixture helper also discarded the exact first preview bytes when assembling later body pages; real delivered bytes were complete. Models' prose hash claims were not promoted into executed hash checks.

A6 independent evidence:

| Artifact | SHA-256 | Result |
| --- | --- | --- |
| e2e-runs/trial-20261027-a6/trial-result.json | 81659f3d355bb5ab2b03eab1ef93180c1d111ab6687264a407458ee338d770cb | FAIL_GOVERNANCE_FIXTURE_RECOVERY_POLICY |
| e2e-runs/trial-20261027-a6/native-terminal-independent-review.json | 0e49568fa0e687856939b4e8d5a088e9d621c3371373a8c24f51e47b5942ea77 | Real native continuation PASS; goal BLOCKED |
| e2e-runs/trial-20261027-a6/independent-business-audit.json | 438836b30aa9f48a589e596f47fac4866a7ba4b44bafd164107dd7a0cfbaf135 | Three Broker-to-database submission joins; full business E2E FAIL |
| e2e-runs/trial-20261027-a6/independent-business-audit-helper-supplement.json | 43c95195defdc6ddc7e4dff0cf04455542081718db06bbc3f29524eb5d3438b8 | Preview-prefix helper limitation, not missing service bytes |

A6 ended without external rescue: 12 executions settled, all five owned model children exited with code 0, runtime exit 0 and owned service/auth cleanup were observed. These are termination facts, not business completion. Forty-eight frozen files stayed unchanged; the remaining case-bindings file received only the two cutoff annotations from the already-frozen startup code before initial delivery.

### Bounded fixture correction pending a fresh trial

`governance-recovery-policy-v1.md` replaces per-visit at-most-once dispatch with receipt-based deduplication. Running or unknown attempts remain non-replayable. Only an exact rejection proving no business transition, settled prior execution, and a fresh unchanged visit/state/assignee permit at most two corrective followups per visit across all native rounds. Failed receipt/audit writes may exist; this is not a claim of zero storage writes. A read-only helper compares the actual rejected request against authoritative outgoing IDs without choosing a business verdict or a fuzzy match. The role still makes every explicit write under existing CAS and permissions. The body assembler is corrected to include matching preview bytes and reject conflicting overlaps, gaps or mixed bindings.

This changes task-owned role guidance and verification helpers only. The published 14-node/15-transition graph and the reviewed product candidates remain fixed. A fresh a7 trial is required; this section does not predeclare its outcome.


### A7 pre-admission failure and isolation-scope correction

A7 froze the reviewed recovery policy and helpers but failed before any role child or model call: `provisionHome` could not write `.agent-core-artifact-identity.json.tmp-59828` through the test home's redirected plugin path. Runtime actual exit was 1. A/B retained their bootstrap states, and the owned service/worker automatically exited 0 with auth closed. The model recovery policy was not exercised. `e2e-runs/trial-20261027-a7/trial-result.json` SHA-256: `9f92aa5a5e0f7aedb8c8208b445963ae005d6a11bf13f3fb495727cb6104eef3`.

The installed `artifacts-watchdog.sh` scans `/Users/authsvc/.agent-core/homes/agt_*/profiles/node_modules` without consulting agent registration, every 120 seconds. A6 and A7 task homes matched that scope. Their original plugin directories have the watchdog's backup naming pattern and are now root-owned links whose raw target is `control/codex-plugin-runtime/current/dsh-codex`; the resolved target is a shared generation. A6's five actual roles were redirected after their first observed native session status; A7 was redirected during provisioning before admission. The exact executing writer PID is UNKNOWN. No watchdog, permission or existing production Agent was changed by this task.

This withdraws any implication that unregistered homes were necessarily outside production management, or that the top-level freeze covered every runtime path. The top-level freezes contained 49/52 entries with indirect native151 and Agent Core318 source/artifact pins; they did not continuously record task-home links or historical module URLs/hashes. A read-only comparison found the current shared plugin payload's 21,737 entries identical to the frozen archive, with archive SHA-256 `869b8e64095a796a0fe6cfbe7bc09e5cf49dfa35defba7b69d621cfec0d0290f`. There is no observed payload-byte substitution, but current equality is not historical in-memory load proof. A6's actual native/peer and workflow receipts remain facts; they cannot support a complete isolation/provenance claim.

Scope correction: `a6-a7-loaded-provenance-correction.json`, SHA-256 `e8cc718dd25560ae24622bb63a225ec5a9cd429b126beee6cb6900902b17e247`. Scanner/layout investigation: `a7-home-projection-isolation-investigation.json`, SHA-256 `06925ec97291db05dd25d20a429809eef8d4140b96d5c4f29a89649bc9cec3c2`. The original reports retain their bytes and hashes; the explicit scope correction supersedes only overbroad isolation/loading statements.

The existing provisioning code supports a same-domain flat layout directly under the deployment root. It preserves canonical credential/artifact checks and falls outside the identified scanner glob. However, that root is UID505/mode0755 and the current UID502 cannot create new flat homes. Preparing nine fresh, unregistered, task-only directories requires an explicit administrator operation; no chmod/chown, identity switch, credential relocation or further trial has been performed. A concrete bounded setup is being prepared. User re-login is not indicated. Complete unattended end-to-end acceptance remains NOT_PROVEN, and production activation is excluded.
