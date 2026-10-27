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

Authority authoring underway. Neither mechanism is yet implemented, deployed, or autonomously validated. Source PR88 for the earlier acceptance-binding slice remains independently verified but unmerged at the fresh read; its existing evidence is reused, not regenerated as a new success claim.
