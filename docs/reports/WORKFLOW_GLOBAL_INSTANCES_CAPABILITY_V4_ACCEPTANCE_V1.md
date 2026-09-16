# Workflow global instances capability V4 acceptance

Repository: `mayf3/dsh-agent-core`. Recorded on 2026-09-16.

The Owner explicitly accepted exact reviewed dsh candidate head
`ea38081abac6cf6ce36ad4ae4bcf723578763bc4` after the focused independent
semantic review returned:

```text
FOCUSED_INDEPENDENT_REVIEW=PASS
SHIP_BLOCKERS=NONE
DSH_V4_REVIEWED_HEAD=ea38081abac6cf6ce36ad4ae4bcf723578763bc4
PINNED_SVC_V2_ACCEPTANCE_HEAD=5976d3900c8f0b8c2afe96d9d30d14d5811ca1fa
DECISIONS_UNCHANGED=YES
CONTRACTS_UNCHANGED=YES
ACCEPTANCE_UNCHANGED=YES
IMPLEMENTATION_CLOSURE_UNCHANGED=YES
SEMANTIC_DELTA_FROM_PREVIOUSLY_REVIEWED_V4=NONE
OWNER_ACCEPTS_DSH_V4_HEAD=ea38081abac6cf6ce36ad4ae4bcf723578763bc4
```

Before lifecycle editing, fresh fetch and readback established:

```text
REVIEWED_BASE_COMMIT=aa4caf449b9e999b0b932a2ab1b0a7768c23f877
REVIEWED_SPEC_COMMIT=ea38081abac6cf6ce36ad4ae4bcf723578763bc4
REMOTE_MAIN=aa4caf449b9e999b0b932a2ab1b0a7768c23f877
STALE_REVIEW_TARGET=NO
PINNED_SVC_V2_HEAD=5976d3900c8f0b8c2afe96d9d30d14d5811ca1fa
CURRENT_ACCEPTED_PREDECESSOR=AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V3
REVIEWER_ID=focused_independent_semantic_review
ACCEPTANCE_ACTOR=mayf3
ACCEPTED_AT=2026-09-16
SEMANTIC_DELTA_AFTER_REVIEW=NONE
FINAL_ACCEPTED_HEAD=external_commit_readback
```

This single docs-only transaction performs the complete lifecycle closure:

- `AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V4`: proposed to accepted
  and `implementation_authority: none` to `contracts`;
- `AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V3`: accepted to superseded,
  with reciprocal
  `superseded_by: AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V4` backlink;
- the governing-Spec index records V4 as the current off-main successor and V3
  as its historical predecessor.

The accepted V3 historical `implementation_authority: contracts` field remains
byte-stable. Under the repository lifecycle protocol, `status: superseded`
removes its effective authority for new implementation while preserving its
historical accepted bytes.

The reviewed V4 normative body and V3 body remain unchanged. Only lifecycle
frontmatter, the reciprocal predecessor backlink, the navigation index, and
this acceptance provenance record change. Authoring-time proposed/readiness
wording inside the preserved bodies remains historical provenance; frontmatter
owns the current lifecycle.

The accepted lifecycle is not effective repository authority until merged into
`main`. The pinned svc V2 acceptance head is also not merged into svc-workflow
`main`. The existing Broker implementation head
`8c2c81e81da99123bc55eaaae1218628d53f520b` remains frozen and has no automatic
merge authority. Therefore this transaction does not authorize implementation,
PR merge, deployment, credential change, production cleanup, Workflow data
mutation, HR runtime change, or real HR dispatch.

## Reviewed document SHA-256

- `docs/specs/AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V4.md`:
  `54690d183668bd35e8542e95cab266f908415ec4843e9c1b28794e1d852531cf`
- `docs/specs/AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V3.md`:
  `02b74a9014a317f4d625371fd5acb11b36b69de1cfa64370c6c537c10d5e4bce`
