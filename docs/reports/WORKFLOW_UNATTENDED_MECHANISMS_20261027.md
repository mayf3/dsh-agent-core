# Unattended workflow mechanism delivery

## Mandate and outcome

Owner mayf3 requested: “按这个目标继续实际落地，把这两处机制补齐，复用现有治理工作流，最后跑一次不需要你逐节点干预的完整验证，不要停在登记任务和发消息上。” The owner previously delegated bounded design decisions with “接受，全权交给你定就行”. Codex acts as the explicitly delegated maintainer for these two bounded source changes, including docs-first acceptance after independent review, source integration, and isolated verification. The PR must persist this delegation and bind reviewed and final accepted commits. No acceptance is inferred merely from a reviewer recommendation.

The two changes are (1) deterministic, target-specific current Workflow inputs with exact source retrieval and explicit completeness; (2) native goal continuation admission through parent-owned execution identity. Existing Workflow and Router records remain authoritative. This mandate does not authorize production deployment, credential extraction, privileged identity switching, historical evidence rewriting, a new workflow engine, or relaxing source-proof checks. Subsequent a8 evidence prompted an accepted-V4 terminal-classifier correction and the separately accepted ASM V2 r5 compact status amendment described below. The later explicit authorization for nine-directory preparation is recorded separately; this source mandate did not itself authorize that administrator operation.

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

The original current-input and native-admission mechanisms are implemented and independently source-reviewed. A8 made seven real submissions but failed complete unattended acceptance at HR’s hard deadline. The subsequent terminal-classifier correction and compact owned-dispatch status capability passed independent affected-source review at `7a2ba8f36f38a8bb86777d98434e6074a31ea815`. A9 completed without per-node root intervention: A traversed all 14 nodes, B completed its six remaining transitions, and HR completed 26 native rounds. Independent business review is PARTIAL: required original-body consumption and exact copied digest fields remain unproved/incorrect, as detailed below. The prior account-wide reauthentication request is withdrawn. No production rollout or original business recovery is claimed. PR88 acceptance-binding is separate and absent from the service candidate `4eabe824` used in a9.

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

The existing provisioning code supports a same-domain flat layout directly under the deployment root. It preserves canonical credential/artifact checks and falls outside the identified scanner glob. At the a7 checkpoint, that root was UID505/mode0755 and UID502 could not create fresh flat homes; a bounded administrator setup required authorization and no later trial had yet run. The following a8 section records the subsequently authorized setup and actual execution. User re-login was not indicated. Production activation remains excluded.


### A8: explicit directory preparation, real progress and failed full E2E

After the Owner's separate authorization, the bounded a8 setup created exactly the nine fresh flat task homes; the creation and ordinary-user admission preflight both exited 0. The parent root metadata remained unchanged. This operation is distinct from the original source-only mandate. The flat layout avoids the identified production watchdog glob; it does not establish continuous exclusion of every possible writer or historical in-memory module identity. Existing credential/artifact checks remained in force, and the earlier account-wide reauthentication inference remains withdrawn.

The actual a8 pair was Agent Core 56309ed4bd3a7be724bd9f2da3050d85bf37c49c, native 9d8678057be9bdbcc37b640ad8cb18279dc5f971 and service 4eabe824cc4a36bd4c8ac6584adb0aa5a56cd266. These pins are retained; the later classifier/status fixes were not running in a8. One external HR trigger began the trial, with no per-node root intervention. A made four post-cutoff submissions and stopped at arch_review/v5. B made three post-cutoff submissions, excluding its twelve bootstrap rows, and stopped at cto_review/v16. Neither reached terminal, and no role performed the task-local merge or installation.

Current-input delivery and role-side verification have different evidence scopes. Six current-detail hash executions passed. The observer reconstructed complete submission-body bytes, but the submission assembler omitted preview bytes and produced actual body-gap errors for security, dev and QA. Observer byte equality does not prove those roles executed a successful full submission-body hash. A8 had no rejected workflow-execute call, so the bounded transition-correction branch was NOT_EXERCISED. Its correction budget remains fixture guidance, not a runtime-enforced per-visit binding.

Native round 6 (turn 7 including the initial task) reached the existing 300000ms hard deadline at 10:10:55.789Z. Exact-generation graceful reap followed; the raw terminal reason was aborted/disposed, and the native goal paused after six of sixty possible rounds. HR PID 11323 actually exited 0 at 10:10:55.959Z. The observer then stopped after this attributable process exit; runtime PID 11121 exited 0 at 10:11:05.660853Z. Eight tracked agent children, the infra worker and service have actual exit 0 records, and both loopback ports closed. Supervisor-own exit and untracked descendants remain UNKNOWN where no waiter recorded them. These cleanup facts do not mean business completion or max-round exhaustion.

The direct shutdown mechanism is established; why HR did not finish within its deadline remains UNKNOWN. Turn7 received three full inspection results of 60841,93944 and34097 bytes and streamed an incomplete 53408-byte ledger-write argument for 224935ms. The write tool did not execute, no retry/compaction event occurred inside that turn, and final-step usage is unavailable. Large input and output generation are observations, not proof of the underlying cause. The parent's historical late_completed classification was incorrect for aborted/disposed and is not success evidence.

The a8 classification remains FAIL_HR_HARD_DEADLINE_DURING_UNFINISHED_LEDGER_WRITE / FAIL_UNATTENDED_FULL_E2E_INCOMPLETE. Failed originals and hashes are preserved. The freeze's case-bindings difference is limited to cutoff metadata added by the already-frozen runner before initial delivery; it is not described as every frozen byte remaining unchanged.

### Accepted-V4 terminal-classifier correction

Source commit 656367cdfa2d8a8c72e63ab16d1932c895396b2b reuses accepted AGENT_PROCESS_LIFECYCLE_HARDENING_V4. Its five changed files and governing Spec hash remain identical in integrated source 7a2ba8f36f38a8bb86777d98434e6074a31ea815. Only an explicit native completed reason supplies successful native outcome evidence. Aborted/unknown results preserve the existing termination-only/unknown reconciliation and no-replay boundaries; actual process exit alone is not promoted to business success.

Independent review passed 55 focused classifier tests plus 15 admission/fence/no-replay tests, each command exiting0. The author's broader Router/Scheduler run was 572 pass / 6 fail / 1 skip, exit 1; those same six failures were reproduced against the original base by the author. The full-project run was 2975 pass / 71 fail / 12 skip, exit 1. The other broad failures were not all independently baseline-replayed, and a lifecycle persistence test hit its deadline before write under broad concurrent load. There is no all-suite PASS or all-failures-are-baseline claim. This source correction neither rewrites a8 nor proves its slow-turn cause fixed.

### ASM V2 r5 compact owned-dispatch status: source and isolated integration complete

The proposed amendment caf21a2 was independently reviewed, attributable delegated acceptance bound final docs d8fa36d468a05d6b05494d31002a00ed04998e1a, and PR560 merged as 4716a9142dbd84fe6aafe0e0dde4fa705481d980 before implementation. Accepted AGENT_CORE_AGENT_SESSION_MESSAGING_V2 r5 §14 SHA-256 is a315761013147c1941c5e67b9b0e63985a7b2288523e3825715d6a5e139016c6. The implementation REUSE base is a7ef046098efb111e5d41fbdd4ceff4226358c57, with final reviewed source 7a2ba8f36f38a8bb86777d98434e6074a31ea815. No governing Contract was changed during implementation.

The added agent_session_dispatch_status capability uses the existing agent.session.inspect_own_dispatch grant and the same canonical owned-trace reader/exact native association. It accepts only target/session/message coordinates within 2048 UTF-8 bytes. Closed success and error results stay within 4096 bytes and contain typed lifecycle/reply-reference metadata, not message bodies, tool arguments, paths or business verdicts. Native failed is a terminal observation only; it does not override Router reconciliation or decide workflow success. There is no target start, send, retry, full-inspect fallback or new durable ledger. The existing full inspector keeps its exact three-argument/full-output contract and existing source retention caps.

Independent final validation on 7a2ba8f3 passed 126/126 affected tests with actual exit 0, including real child relay → trusted Parent RPC → Broker gateway → composed runtime → canonical reader using isolated synthetic auth and native artifacts. An additional 55-case baseline comparison found the old inspector's serialized outputs byte-identical; all 16 changed JavaScript files passed syntax checks. These are separate verification scopes, not a unique aggregate test count. Tests proved the closed input/output limits, ownership masking, typed native terminals, no side effects and old API compatibility. The actual direct-gateway pre-reader error leak found during review was reproduced and fixed narrowly; the original unknown-key leak conjecture was disproved and withdrawn.

The global structure verifier still exits2 at its unchanged stale baseline registry entry. This was reproduced with base=head. Changed-file measurements found no new file/depth/dense-line limit violation; the new Broker test was moved into the existing gateway directory rather than increasing the already-overfull top-level test directory. This limited result is not a whole-repository structure PASS. The final independent report supersedes only the author's then-pending review state, preserving the original conformance record.

### Historical pre-a9 boundary

At this preparation checkpoint A9 remained PENDING. Its eventual verdict must bind its own frozen source/configuration, actual public calls, business terminal receipts and actual exits; passing source tests or accepted docs cannot fill missing runtime evidence. The compact status read and task-only exact dispatch index reduce coordination payloads without adding a second ledger, automatic semantic approval or workflow driver. The default 300000ms turn deadline is not claimed fixed by increasing it. Production deployment, existing workflow remediation and long-term unattended reliability remain separate, unproved outcomes.

## Evidence references

All paths below are relative to /Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027. Hashes were read back while preparing this draft. These hashes were checked independently before report integration; none of the sealed originals was rewritten.

| Artifact | SHA-256 |
| --- | --- |
| `e2e-runs/trial-20261027-a8/trial-result.json` | `bc89bd1a558b5bbdac89e1fce754aead9037cabb63f93c0283747b9499e61fa8` |
| `e2e-runs/trial-20261027-a8/independent-business-audit.json` | `cd09384f9fc990782a257f53286f280be355b6f798e1349314bafc587fdfa296` |
| `a8-native-terminal-independent-review.json` | `aa8aed3acda722ea7200d1c75d28f265e3ae80ef4f1e90820b114489663671d1` |
| `a8-hr-turn7-public-metadata-analysis.json` | `169e66c682dc27f68d998770c8e12b0f567c5216e0a5bf4c5fd61720f70c7bb5` |
| `a8-flat-home-setup/creation-execution.json` | `54d2b1f4315e0492253dcadb4343c7ecff95ce3bf72e5aae977374d3afb4258b` |
| `a8-flat-home-setup/creation-receipt.json` | `e10c900ef87bf12dbc9fc500d4d9be3d501ee1412de59391ee20b2f83975f5fc` |
| `classifier-independent-review.json` | `12edfd6b114c1b054381e02b500c4d9573ec0a30ab2038efb1f706918720b27e` |
| `aborted-outcome-implementation/source-conformance-656367c.json` | `4786e11204fecb2df041c93d5313c102e3e1f728f9a3ce96f54ffeb412938926` |
| `owned-dispatch-status-docs-merge-receipt.json` | `2d095ccd9358a68312048d01d3bd14de5af735056a907d1d09752be9554aa0bf` |
| `owned-dispatch-status-impl-a7ef046/conformance-7a2ba8f3.json` | `b128c8769baa42601f5efb5450af9883593a545be1599870433d92925092e6c4` |
| `owned-dispatch-status-independent-review-7a2ba8f.json` | `034dd444db670b3b80d9f81d18a3d55e12f1e42386ad714bf93b7d4568457fa5` |


## A9 final result — 2026-10-27: autonomous traversal, incomplete strict acceptance

The frozen Agent Core candidate was `7a2ba8f36f38a8bb86777d98434e6074a31ea815`, native `9d8678057be9bdbcc37b640ad8cb18279dc5f971`, service `4eabe824cc4a36bd4c8ac6584adb0aa5a56cd266`, and actual provider/model `openai-codex/gpt-5.6-luna`. The run freeze SHA is `6cecc4cd656395e9389a8ead8be20fcd123ea254eb7252c0c07b76df44e55810`. It received one initial external HR task at 11:19:12.311Z, with no later root actor message, per-node transition, repair or role restart. Every post-cutoff business submission joins to a model-owned Broker call. Default 300000ms per-turn deadlines were unchanged.

A (`4336a635-d134-41fa-95b7-7888d149777e`) reached done/v14 with all 14 original nodes and 13 real submissions. B (`0d005baa-c627-46d1-a5f8-4a3a0f77c3e8`) reached done/v19 with six real submissions; its twelve bootstrap submissions are excluded. All 19 actor/assignee/Visit/Context/transition/payload-digest/CAS joins passed. Roles actually performed task-local Git fast-forward and ALREADY_PRESENT reconciliation, three task-owned binary installations, and localhost health/version checks. Installed bytes match the candidate. The service was started before cutoff: copying a file is not proof that the service loaded that copy, and no production merge/deploy is claimed.

The native/compact-status independent review passed 20 executed assertions: 26 fresh native admissions with prior exact settlement; the first two distinct-nonce PM exchanges joined to their true source turns; 61 owned status responses, maximum369 UTF-8 bytes (gateway390), with closed fields; all48 native turns completed and all48 owned executions settled. HR set goal complete at11:45:24.058Z. The runner observed real completion at11:45:40.701Z and automatically disposed all nine role processes. Runtime actual exit0 at11:45:40.875890Z, without timeout or supervisor signal. Infra worker/service actual exits0 and closed auth/service ports were observed. The two supervisors' own actual exit codes remain UNKNOWN where no external waiter exists. Non-completed native branches were not exercised live in this run.

Strict full acceptance is **NOT_PROVEN**, despite autonomous traversal:

- B's designated correctedOriginal Submission was50033 bytes, but only its2084-byte input preview reached a role. No role fetched the rest or computed its complete SHA. Complete currentCorrection detail and the old1001-byte RETURN are different evidence subjects and cannot replace this original.
- Three role-authored installation JSON reports and several submissions copied a63-character binary digest, omitting the final `3`. The same role's original shell hash and actual installed files have the correct64-character digest. This is a real report transcription defect, not observed installed-byte drift; it was not autonomously corrected.
- Tester A/B body-SHA verification lacks role-side execution proof. Observer reconstruction cannot supply it retroactively.

Security did autonomously recover from a separate fixture-helper defect: the assembler treated a legal OMITTED zero-byte preview as a chunk. Without root input, the role selected the COMPLETE1001-byte RETURN record and executed the correct hash, then continued. That local recovery is evidence of bounded adaptation, not a substitute for the missing correctedOriginal proof. The helper remains unchanged in this sealed run. Frozen case-bindings differ only by cutoff fields written by the frozen runner before initial delivery; the report does not claim every frozen byte remained unchanged.

Final classification: `PARTIAL_UNATTENDED_STRUCTURAL_COMPLETION_WITH_EVIDENCE_GAPS`. Preserve this result and repair the minimum evidence-consumption/transcription path before a distinct trial. Root must not fill the old missing role proofs or relabel the run after editing its inputs.

| Final artifact under the artifact root | SHA-256 |
| --- | --- |
| `e2e-runs/trial-20261027-a9/trial-result.json` | `6b2df262c00711f667bd73237e4a0bd98e0f19975aab6b726f04cb9c9a4eb140` |
| `e2e-runs/trial-20261027-a9/independent-business-audit.json` | `b2233d9eda85f9a8384564bf5e5008870a35355ce7ec2b35347531d6a43a3c01` |
| `a9-native-compact-final-independent-review.json` | `dbaa115d114af6197bcfe84574f49f22670e6967d0582a9958039ffa14ab1e2d` |

## Separate service source integration and original-governance observation

A fresh source-only worktree combines service current-input4eabe824 and acceptance-binding74ed13fa at `f4a1ed85e96936155e551eea6ac8b209ef360cda`, tree `7bd5879354b71541ca47166072d197effeaae23e`. It exactly equals Git's automatic merge, with no manual semantic resolution, product/test file overlap or accepted-Spec change. Eight focused suites passed367/367 and a fresh task-only build exited0. Binary SHA is `cb60bda02e467bd548ac55e90bcc75d46d49225f93da614b0c89fb2dd87c11ce`. The executor authored the original CTI slice and is not its non-author semantic reviewer; root's separate mechanical/interaction review reuses both original independent reviews. Old-binary downgrade was not rerun against the combined tree;15 references to the earlier independent evidence were verified. No standalone combined serving runtime or new cross-feature HTTP scenario is claimed. A9 did not load this combined source. Execution report SHA: `d40735ebff2c256897cb036d185fe6c4a44a9f1f960ad95c6e046d45f82f6471` at `svc-combined-integration-20261027/final-execution-report.json`.

The original governance instanceb39719d8 separately advanced to deploying using a MERGE_REPORT that cited accepted Spec PR87/main371ea815. Fresh GitHub/Git readback still showed implementation PR88 open/unmerged. This proves the workflow advanced and a Spec merge was cited; it does not prove implementation merge. No production deployment is inferred. The precise public tool-call observation is `original-binding-workflow-stage-artifact-observation-20261027.json`, SHA `692e55f423f73824a3b7531f8017f82031c4950b164bcd9f4d04859dbb80ddfc`. Native connector429 prevented a fresh direct ledger read; public role receipts are explicitly scoped. This reinforces the need to verify actual stage artifacts rather than treating node movement or a narrative report as its postcondition.
