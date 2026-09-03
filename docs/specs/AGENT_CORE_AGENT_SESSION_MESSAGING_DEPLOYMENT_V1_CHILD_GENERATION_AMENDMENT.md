---
spec_id: AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1_CHILD_GENERATION_AMENDMENT
status: proposed
type: child amendment (spec-only; docs-only)
amends:
  - AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1
parent_status: accepted
supersedes_parent: false
date: 2026-09-04
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
scope:
  - reconcile the fresh relevant child proof with the accepted B-C-D stage order
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1_CHILD_GENERATION_AMENDMENT

> **PROPOSED / NO IMPLEMENTATION OR PRODUCTION-APPLY AUTHORITY.** This
> docs-only child amendment resolves one mechanically proven ordering conflict.
> It edits no accepted parent, changes no code or artifact, runs no privileged
> command, and authorizes no production mutation until independently reviewed,
> explicitly accepted by the Owner at an exact head, and merged to `main`.

## 0. Machine-readable summary

```text
AMENDMENT_STATUS = proposed
AUTHORING_BASE = 379ef227052752a473f6b105d8726e343d2d7f92
PARENT_SPEC = AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1
PARENT_BLOB = ab7a793fef8aa1a8c113282f6b4b54e58d10b008
PARENT_SHA256 = 09ee99d18b8fa2605972e86ddb197b452f17f97a99174f07f6fe40ad64ffbd6e
PARENT_FILE_MODIFIED = NO

NEW_EVIDENCE =
  Stage-B exact-artifact independent review proved that CTR-DEP-005 requires
  fresh relevant child generation before Stage B PASS, while CTR-DEP-004 and
  CTR-DEP-007 place the ordinary source Session/header proof after the
  temporary Grant in Stage D. Production exposes no zero-business-write,
  pre-Grant endpoint that can mechanically instantiate a Router-owned child.

SOLE_SEMANTIC_DELTA =
  Split Stage B into B1 file-face apply and B2 child-generation closure; allow
  the already-authorized temporary Grant Stage C after B1, then require Stage D
  to close B2 and CTR-DEP-005 before Stage E.
```

## 1. Problem and goal

The accepted parent simultaneously requires:

1. `CTR-DEP-005`: fresh parent **and fresh relevant child generation** before
   the bounded Agent Core apply is complete; and
2. `CTR-DEP-004` / `CTR-DEP-007`: the fresh ordinary source Session/header and
   target runtime coordinates are Stage D, after the Stage C temporary Grant.

The production health endpoint proves the parent only. Existing child PIDs can
be shown terminated by restart, but termination is not a new generation. A new
Router-owned child requires a real Agent turn and therefore cannot be invented
by the deployment runner without adding an unauthorized business write.

This amendment makes the smallest safe ordering correction: Stage B's exact
file face may be installed and held as `B1`, Stage C may supply only the already
authorized temporary Grant, and Stage D must instantiate and bind the fresh
relevant child while proving the fresh header. Stage B is not fully PASS until
that D proof closes `B2`.

## 2. Scope and non-goals

In scope:

- define `B1 = exact file face + fresh parent + old-child termination + health`;
- define `B2 = fresh relevant Router-owned child generation and coordinates`;
- permit the exact existing temporary Grant transaction after B1 solely so D
  can mechanically close B2;
- retain fail-closed rollback plus mandatory Grant compensation if D fails.

Out of scope:

- no change to the 17 paths, source commit, preimage, ownership, modes, hashes,
  lock, restart count, receipt, or no-unrelated-mutation rules;
- no change to the Grant tuple, target prohibition, token scope, credential
  handling, tombstone revoke, canary, canonical-main, exactly-once, or
  no-privilege-propagation semantics;
- no synthetic child, process-table inference, natural-traffic assumption, or
  replacement Session may satisfy B2;
- no Scheduler, Workflow, Auth registry, permanent Grant, or other production
  authority is introduced.

## 3. Contracts

### CTR-CG-001 — B1 is not Stage B completion

After the exact 17-file transaction verifies the release face, fresh parent
PID/start coordinate, termination of every captured pre-restart child PID,
health, workflow pins, receipt, and unrelated-tree equality, it MAY record:

```text
STAGE_B_FILE_FACE_APPLIED = PASS
STAGE_B_CHILD_GENERATION = PENDING_STAGE_D
```

It MUST NOT yet record `CTR_DEP_005=PASS`, `STAGE_B=PASS`,
`LANE_B=PRODUCTION_READY`, or any equivalent terminal claim.

### CTR-CG-002 — Narrow ordering exception

The serialized order is refined only as follows:

```text
A Auth prerequisite PASS
→ B1 exact Agent Core file-face apply / parent restart / health PASS
→ C exact accepted temporary Grant apply + positive/negative proofs PASS
→ D fresh ordinary source Session/header + fresh Router-owned child generation
     closes B2 and CTR-DEP-005
→ E one bounded A2A canary
→ mandatory temporary Grant compensation
```

Stage C's exception is limited to the exact temporary tuple and compensation
already governed by the accepted Auth authority. No permanent or target Grant
may use this exception.

### CTR-CG-003 — Fresh child proof

Stage D MUST bind at least:

```text
new_parent_pid
child_pid
child_ppid = new_parent_pid
child_uid = configured Agent child uid
agent_id = trusted Router-owned target/source coordinate for the proof
process_generation = fresh post-restart generation
session_id + persisted header coordinate
catalog contains agent_session_send exactly once
```

No pre-restart PID, orphan, manually spawned CLI, process-name-only inference,
or Agent prose is sufficient.

### CTR-CG-004 — D failure compensation

If D cannot prove every `CTR-CG-003` field, the transaction MUST fail closed:

1. revoke the temporary Grant with the accepted `revoked_at + version=0`
   tombstone compensation and prove enforcement;
2. restore the complete 17-path byte-and-metadata preimage face;
3. restart once and prove baseline parent health; and
4. record `STAGE_B_CHILD_GENERATION=FAIL` and no Stage-B/Lane-B success claim.

### CTR-CG-005 — Parent preservation

Outside `CTR-CG-001..004`, every parent clause remains unchanged. In
particular, CTR-DEP-001..003 and CTR-DEP-006..008 remain fully binding, and
Stage E cannot begin until B2 is PASS.

## 4. Acceptance and lifecycle

Acceptance requires one independent exact-head review proving:

- the ordering conflict is real and no existing pre-Grant, zero-business-write
  child-generation seam was overlooked;
- the delta is limited to the B1/C/D/B2 sequencing above;
- all file, Grant, compensation, canary, identity, and rollback boundaries are
  unchanged; and
- `BLOCKER_UNION=NONE` and `SEMANTIC_DELTA` equals the declared sole delta.

Only an explicit Owner acceptance bound to that reviewed head may authorize a
lifecycle-only change from `proposed/none/none` to
`accepted/contracts/contracts`. Merge-to-main readback is required before any
artifact or production action consumes this amendment.

```text
CURRENT_STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none
PRODUCTION_CHANGE = NONE
NEXT = independent exact-head review
```
