---
spec_id: AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
status: proposed
spec_kind: invariant
authority_level: governing_spec
implementation_authority: none
scope:
  - mayf3/dsh-agent-core development governance adoption
  - shared vendored governance integrity and local activation lifecycle
governed_by: []
external_authorities:
  - repository: mayf3/agent-development-governance
    authority_id: AGENT_DEVELOPMENT_GOVERNANCE_V1
    revision: 902842735a69797b54016eeaa88d2f949f5879a9
    relation: constrained_by
supersedes:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
superseded_by: null
owners:
  - mayf3
---

# Agent Development Governance v1.0.0 Adoption V1

## 1. Goal

Adopt the exact upstream `development-governance-v0` distribution released as
annotated tag `v1.0.0` at source commit
`902842735a69797b54016eeaa88d2f949f5879a9`, through this repository's own
independent Review and Owner acceptance. After activation, future applicable
work independently classifies Authority, Plan, and Assurance, and stops when
`DONE_WHEN` is met unless an `EXPANSION_TRIGGER` fires.

## 2. Scope and non-goals

In scope: exact manifest-managed shared governance bytes, the governance lock,
local adoption/supersession lifecycle, route validation, and forward-only use.

Out of scope: changes to `AGENTS.md`, `.agents/local/**`, local Product Direction,
Architecture, product Specs, acceptance actor, product code, runtime, production,
permissions, Grants, credentials, Secrets, historical records, or
`AGENT_OPERATIONAL_LAYER_V1`; this preparation does not accept or merge itself.

## 3. Authority and dependencies

### DEC-ADOPT-001 — Whole-authority successor

The accepted/current `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0` owns local
adoption today. Governance v1.0.0 changes long-lived routing obligations
(Authority/Plan/Assurance, Execution Mandates, isolated writes, route stages,
load-bearing gaps, and stop controls), so V0 MUST NOT be rewritten in place.
This proposed V1 is its complete successor.

### DEC-ADOPT-002 — Local acceptance remains authoritative

Upstream release status does not activate local authority. The consumer owns
independent Review, Owner acceptance, atomic lifecycle transition, and merge.
`.agents/local/**` remains higher-precedence repository-local extension.

## 4. Current State

- `STATE-ADOPT-001` — At Base
  `840d2f4ad91f8252eb1f163330c041216a0dd9c4`, V0 is accepted/current and the
  lock pins `0.1.0-draft.1@46f78c3f00d768d99a4c8c2da975b124bce042f9`.
- `STATE-ADOPT-002` — On this Draft PR, exact v1.0.0 bytes and proposed metadata
  are prepared, but V1 is not active local authority.

## 5. Observations

### OBS-ADOPT-001 — Consumer Base

- Source revision: `840d2f4ad91f8252eb1f163330c041216a0dd9c4`.
- Method: read Base branch and local governance files.
- Result: V0/lock are accepted; local extensions exist and are separate.
- Provenance: preparation report Git coordinates and blob matrix.

### OBS-ADOPT-002 — Upstream release identity

- Source: annotated tag object `bb98937d176890088da736fa4a45f48279f19d50`.
- Result: tag `v1.0.0` resolves exactly to
  `902842735a69797b54016eeaa88d2f949f5879a9`.
- Provenance: upstream tag ref and annotated tag object.

### OBS-ADOPT-003 — Distribution manifest

- Source revision: `902842735a69797b54016eeaa88d2f949f5879a9`.
- Result: distribution=`development-governance-v0`, version=`1.0.0`, files=25,
  manifest Git blob=`d4e37f492653260aa24878af1a9208f53122db5d`, SHA-256=
  `c1fa620da4a16e4073d617e49eb5080487f2a117e3bab6502fd223afee0f06e0`.

### OBS-ADOPT-004 — Vendor plan

The exact upstream `tools/vendor.py` plan changes only manifest-managed shared
governance bytes and `.agents/governance.lock.json`; it excludes `AGENTS.md`,
`.agents/local/**`, and local product authorities. The network-isolated execution
environment could not run the CLI against a fresh upstream checkout, so the
preparation applied the same exact manifest plan using verified upstream Git
blobs; this limitation is explicit and MUST be independently reviewed.

## 6. Claims and assumptions

- `CLM-ADOPT-001` (`SUPPORTED`) — The obligation change requires
  `SUPERSEDE`, supported by `EVD-ADOPT-001`.
- `CLM-ADOPT-002` (`SUPPORTED`) — Exact manifest vendoring preserves local
  authority boundaries, supported by `EVD-ADOPT-002`.
- Open assumptions affecting normative meaning: none.

## 7. Evidence relations

- `EVD-ADOPT-001` — `OBS-ADOPT-001..003` SUPPORT `CLM-ADOPT-001` at the exact
  consumer/upstream coordinates; sufficient for PREFLIGHT, not acceptance.
- `EVD-ADOPT-002` — `OBS-ADOPT-003..004` SUPPORT `CLM-ADOPT-002`; sufficient
  for candidate-byte preparation, with the stated vendor-CLI limitation.

## 8. Decisions

### DEC-ADOPT-003 — Exact pin

The local lock MUST pin source repository `mayf3/agent-development-governance`,
source commit `902842735a69797b54016eeaa88d2f949f5879a9`, version `1.0.0`, and
compatibility distribution ID `development-governance-v0`. Mutable upstream
branches or a different commit MUST NOT substitute.

### DEC-ADOPT-004 — Proposed preparation only

Preparation MUST retain V0 as current, retain all local/product authority, and
leave both the new Spec and lock proposed. A later transaction may accept V1,
supersede V0 with reciprocal backlinks, populate acceptance metadata, update
the index, pass final-Head recheck, and merge into `main`.

## 9. Contracts

### CTR-ADOPT-001 — Exact release and bytes

The tag, source commit, manifest identity, 25 managed paths, hashes, sizes,
version, and distribution ID MUST match upstream v1.0.0 exactly.

### CTR-ADOPT-002 — Proposed lifecycle

On this preparation Head, `adoption.status=proposed`, `accepted_by=null`, and
`accepted_at=null`; V0 MUST remain accepted/current and unchanged. The Agent
MUST NOT mark the PR ready, accept, or merge it.

### CTR-ADOPT-003 — Local preservation

`AGENTS.md`, `.agents/local/**`, local Product Direction, Architecture,
invariants, product Specs, acceptance actors, product code, runtime, and
production state MUST remain unchanged.

### CTR-ADOPT-004 — Three-axis forward route

After activation, every applicable non-trivial task MUST classify Authority,
Plan, and Assurance independently, bind `DONE_WHEN`, and stop unless an
`EXPANSION_TRIGGER` fires. Every mutation requires attributable authorization
and an isolated write surface. Historical artifacts MUST NOT be bulk rewritten.

### CTR-ADOPT-005 — Independent local activation

The preparation Head MUST receive independent exact-Head Review. Only a later
Owner-authorized atomic transaction may accept V1, supersede V0, accept the
lock, update navigation, pass final-Head recheck, and merge.

## 10. Acceptance

### ACC-ADOPT-001 — Release identity

- Contracts: `CTR-ADOPT-001`.
- Method: inspect tag ref/object and recompute manifest identity.
- Required evidence: exact tag object, commit, manifest hash, and 25-path matrix.
- Failure: any lightweight/different/missing tag, path, hash, size, pin, or ID.

### ACC-ADOPT-002 — Lifecycle and preservation

- Contracts: `CTR-ADOPT-002`, `CTR-ADOPT-003`, `CTR-ADOPT-005`.
- Method: compare Base/candidate paths and blobs; inspect lock, Specs, PR state.
- Required evidence: changed-file list; hashes for `AGENTS.md`, `.agents/local/**`,
  V0, product/runtime paths; exact Draft PR Head.
- Failure: premature acceptance/supersession/merge or any unauthorized local,
  product, runtime, or production change.

### ACC-ADOPT-003 — Governance validation

- Contracts: `CTR-ADOPT-001`, `CTR-ADOPT-004`.
- Method: validate lock/schema/managed bytes and run route validator fixtures.
- Expected: valid route exits 0, contradiction exits 1, malformed input exits 2.
- Failure: mismatch, false pass/fail, or unavailable route validator.

## 11. Alternatives and disposition

Rejected: in-place V0 rewrite; pinning upstream `main`; renaming the compatibility
distribution ID; auto-accepting during vendoring; bulk historical rewrite.

## 12. Migration, compatibility, and rollback

`PRODUCT_CODE_MIGRATION=NONE`, `DATA_MIGRATION=NONE`,
`RUNTIME_MIGRATION=NONE`, `PRODUCTION_MIGRATION=NONE`.
Existing product authorities and local extensions retain meaning. Before
acceptance, rollback is closing the Draft PR. After acceptance, rollback requires
a new accepted successor; accepted V1 meaning is not rewritten.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

## Final proposed output

```text
AUTHORITY_ACTION = SUPERSEDE
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = DURABLE
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
ADOPTION_STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
PRODUCT_CODE_CHANGE = NONE
RUNTIME_OR_PRODUCTION_CHANGE = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
READY_FOR_OWNER_ACCEPTANCE = NO
```
