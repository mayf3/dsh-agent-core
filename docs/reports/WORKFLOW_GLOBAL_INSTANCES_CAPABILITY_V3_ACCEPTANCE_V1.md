# Workflow global instances capability V3 acceptance

Repository: `mayf3/dsh-agent-core`. Recorded on 2026-09-16.

The Owner explicitly accepted exact reviewed dsh candidate head
`58abd3c593da208d8301341697be91a2a5656501` after the focused independent
semantic review returned:

```text
FOCUSED_INDEPENDENT_REVIEW=PASS
SHIP_BLOCKERS=NONE
SEMANTIC_DELTA_FROM_PREVIOUSLY_REVIEWED_V3=NONE
```

The reviewed V3 pins separately accepted svc-workflow authority head
`07d9117358113c89dc9bd4d483695c8d34b21efb`.

Before lifecycle editing, fresh fetch and readback established:

```text
CURRENT_HEAD=58abd3c593da208d8301341697be91a2a5656501
REMOTE_MAIN=4053e60c1217be3c913d49cd7b467d5f6eec6fba
STALE_REVIEW_TARGET=NO
PINNED_SVC_HEAD=07d9117358113c89dc9bd4d483695c8d34b21efb
V3_STATUS=proposed
V3_IMPLEMENTATION_AUTHORITY=none
```

This single docs-only transaction performs the complete lifecycle closure:

- `AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V3`: proposed to accepted
  and `implementation_authority: none` to `contracts`;
- `AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V2`: accepted to superseded,
  reciprocal successor backlink to V3, and effective implementation authority
  to none. Its historical `implementation_authority: contracts` frontmatter
  value remains byte-stable because the repository lifecycle validator treats
  accepted authority fields as immutable; `status: superseded` removes active
  implementation authority;
- the governing-Spec index records V3 as the current off-main successor and V2
  as its historical predecessor.

The reviewed V3 normative body and V2 body remain byte-identical. Only lifecycle
frontmatter, the reciprocal predecessor backlink, the navigation index, and this
acceptance provenance record change. Authoring-time proposed/readiness wording
inside the preserved bodies remains historical provenance; frontmatter owns the
current lifecycle.

The accepted lifecycle is not effective repository authority until merged into
`main`. The pinned svc acceptance head is also not merged into svc-workflow
`main`. Therefore this transaction does not authorize implementation, PR merge,
deployment, credential change, production cleanup, Workflow data mutation, HR
runtime change, or real HR dispatch.

## Reviewed document SHA-256

- `docs/specs/AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V3.md`:
  `0aea84a69fe0c5b710503ff23768a4900432db7787058d649e70d6552468f212`
- `docs/specs/AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V2.md`:
  `019b081463184d8d54ca726e9766aea59f4a60c774643a98f89191441a4b28f1`
