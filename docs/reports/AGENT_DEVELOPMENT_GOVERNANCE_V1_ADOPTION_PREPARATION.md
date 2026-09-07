# Governance v1.0.0 Consumer Adoption Preparation and Review-Fix Record

```text
INITIAL_TASK_NAME = 采用 执行
AMENDMENT_TASK_NAME = 修订 执行
TASK_TYPE = CONSUMER_GOVERNANCE_ADOPTION_PREPARATION
REPOSITORY = mayf3/dsh-agent-core
BASE_COMMIT = 840d2f4ad91f8252eb1f163330c041216a0dd9c4
INITIAL_CANDIDATE_HEAD = 669d6f40bcfe37d0e299f5b1bea3957d0f5ca785
UPSTREAM_REPOSITORY = mayf3/agent-development-governance
UPSTREAM_RELEASE_TAG = v1.0.0
UPSTREAM_SOURCE_COMMIT = 902842735a69797b54016eeaa88d2f949f5879a9
DISTRIBUTION = development-governance-v0
DISTRIBUTION_VERSION = 1.0.0
ADOPTION_STATUS = proposed
PRODUCT_CODE_CHANGE = NONE
RUNTIME_OR_PRODUCTION_CHANGE = NONE
```

## 1. Local PREFLIGHT

The Base contains accepted/current
`AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0` and an accepted V0 lock. Governance
v1.0.0 changes long-lived obligations rather than merely changing execution
mechanics, so the accepted V0 stable identity was not edited.

```text
AUTHORITY_ACTION = SUPERSEDE
PRIMARY_AUTHORITY = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0@840d2f4
SUCCESSOR = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
IMPLEMENTATION_AUTHORITY = none
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = DURABLE
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
NEXT_ACTION = independent 采用 审计
```

V0 remains accepted/current on this preparation branch. The proposed successor
contains the future atomic lifecycle transaction; this task performs none of it.

## 2. Upstream release verification

```text
TAG_REF = refs/tags/v1.0.0
TAG_OBJECT_TYPE = tag
TAG_OBJECT_SHA = bb98937d176890088da736fa4a45f48279f19d50
TAG_TARGET_TYPE = commit
TAG_TARGET_COMMIT = 902842735a69797b54016eeaa88d2f949f5879a9
TAG_SIGNATURE = UNSIGNED
TAG_VERIFIED = YES
```

The exact source tree contains upstream
`AGENT_DEVELOPMENT_GOVERNANCE_V1` and distribution identity:

```text
MANIFEST_PATH = distribution/manifest.json
MANIFEST_GIT_BLOB = d4e37f492653260aa24878af1a9208f53122db5d
MANIFEST_SHA256 = c1fa620da4a16e4073d617e49eb5080487f2a117e3bab6502fd223afee0f06e0
MANIFEST_DISTRIBUTION = development-governance-v0
MANIFEST_VERSION = 1.0.0
MANIFEST_FILE_COUNT = 25
```

The compatibility distribution ID intentionally remains
`development-governance-v0`.

## 3. Initial preparation

The exact upstream `tools/vendor.py` was inspected during initial preparation.
Its manifest-derived plan was reproduced through exact upstream Git blobs
because that first execution surface could not obtain a network checkout.

```text
INITIAL_VENDOR_CLI_EXECUTED = NO
INITIAL_LIMITATION = NETWORK_CHECKOUT_UNAVAILABLE
EXACT_RELEASE_BLOBS_APPLIED = 25/25
INITIAL_MANIFEST_VERIFICATION = PASS
```

That limitation was disclosed in the original PR and preparation record. It did
not constitute the required executed vendor gate.

The initial candidate lock recorded:

```text
source_repository = mayf3/agent-development-governance
source_commit = 902842735a69797b54016eeaa88d2f949f5879a9
version = 1.0.0
distribution = development-governance-v0
adoption.status = proposed
accepted_by = null
accepted_at = null
file entries = 25/25 exact manifest entries
```

## 4. Independent review findings addressed

An independent Review bound to:

```text
REVIEWED_BASE_COMMIT = 840d2f4ad91f8252eb1f163330c041216a0dd9c4
REVIEWED_SPEC_COMMIT = 669d6f40bcfe37d0e299f5b1bea3957d0f5ca785
CURRENT_BASE_HEAD_AT_REVIEW = 205d9f748347542eb0fc88d5689d719849d85b97
SPEC_REVIEW = REVISE
BLOCKERS = 2
```

identified:

1. incomplete internal fields for load-bearing State, Observation, Evidence,
   and Acceptance entries;
2. missing actually executed consumer vendor/verifier/route evidence.

The amendment changes no accepted Decision or Contract meaning. It expands only
the descriptive coordinates, provenance, evidence relations, and Acceptance
execution fields in the proposed successor, then records actual command
execution.

```text
DECISION_SEMANTIC_DELTA = NONE
CONTRACT_SEMANTIC_DELTA = NONE
AMENDMENT_AUTHORITY_ACTION = AMEND
ADOPTION_SUCCESSOR_ACTION = SUPERSEDE
ADOPTION_STATUS = proposed
```

## 5. Executed evidence surface

Because the model execution container could not create a network-backed local
checkout, the amendment used a dedicated GitHub Actions evidence branch as an
equivalent isolated execution surface:

```text
AUXILIARY_EVIDENCE_BRANCH = audit/pr140-adoption-v1-execution
AUXILIARY_BRANCH_IS_IN_PR140 = NO
AUXILIARY_BRANCH_CHANGES_PRODUCT = NO
SUCCESSFUL_WORKFLOW_RUN = 33683264969
SUCCESSFUL_JOB = 100424581220
EVIDENCE_BRANCH_COMMIT = 3a86f6d78534df4519639137b51faebf59b16f8b
ARTIFACT_NAME = pr140-adoption-execution-receipt
ARTIFACT_ID = 9867075055
ARTIFACT_ZIP_SHA256 = 1a7fe302333e3131ca74351b040068246eeccab9140a03bb034d6a6547cb26e3
RUNNER = GitHub-hosted Ubuntu 24.04
PYTHON_VERSION = Python 3.12.3
EXECUTED_AT = 2026-09-02T21:06:49Z
```

A preliminary workflow run `33683125675` failed before any vendor command
because it compared the auxiliary branch commit to the consumer candidate SHA.
The workflow was corrected to use separate exact checkouts. The successful run
above is the evidence-bearing run; the preliminary failure is retained as
tooling history and is not counted as product or adoption evidence.

### 5.1 Exact checkouts

```text
CONSUMER_CHECKOUT_HEAD =
669d6f40bcfe37d0e299f5b1bea3957d0f5ca785

UPSTREAM_CHECKOUT_HEAD =
902842735a69797b54016eeaa88d2f949f5879a9

CONSUMER_CHECKOUT_CLEAN =
YES

UPSTREAM_CHECKOUT_CLEAN =
YES
```

### 5.2 Actual vendor dry-run

Executed command:

```text
python3 upstream/tools/vendor.py \
  --target consumer \
  --source-commit 902842735a69797b54016eeaa88d2f949f5879a9 \
  --prepared-by "PR140 execution evidence" \
  --prepared-at "2026-09-02T21:15:00Z" \
  --adoption-status proposed
```

The command intentionally omitted `--apply`.

Observed result:

```text
VENDOR_DRY_RUN_EXIT = 0
PLANNED_OPERATIONS = 26
MANIFEST_MANAGED_OPERATIONS = 25
LOCK_OPERATIONS = 1
WRITE_DELTA = NONE
CONSUMER_CHECKOUT_AFTER_DRY_RUN = CLEAN
```

The complete operation plan contained the 25 manifest-managed paths plus
`.agents/governance.lock.json`, all as existing-path replacements. It contained
no `AGENTS.md`, `.agents/local/**`, product, runtime, production, permission,
credential, or Secret path.

### 5.3 Candidate governance verifier

Executed command:

```text
python3 consumer/.agents/tools/verify_governance.py --target consumer
```

Observed result:

```text
GOVERNANCE_VERIFIER_EXIT = 0
GOVERNANCE_VERIFIER_OUTPUT =
vendored governance bytes match governance.lock.json
```

The verifier was intentionally not run with `--require-accepted`, because this
preparation must remain proposed.

### 5.4 Python entrypoint compilation

Executed command:

```text
python3 -m py_compile \
  consumer/.agents/tools/verify_governance.py \
  consumer/.agents/tools/validate_spec_transition.py \
  consumer/.agents/tools/validate_governance_route.py
```

Observed result:

```text
PY_COMPILE_EXIT = 0
```

### 5.5 Route validator fixtures

Executed commands used the exact candidate
`.agents/tools/validate_governance_route.py`.

Observed results:

```text
VALID_PROPOSED_SUPERSEDE_EXIT = 0
VALID_OUTPUT = Governance V1 route is internally consistent

CONTRADICTORY_SUPERSEDE_WITH_IMPLEMENTATION_ALLOWED_EXIT = 1
CONTRADICTORY_OUTPUT_INCLUDED = [
  implementation_authority=none cannot permit implementation
  authority-authoring stage cannot permit implementation or operation
  SUPERSEDE cannot permit same-stage implementation or operation
  allowed implementation or operation requires write_surface.mutation_planned=true
]

MALFORMED_JSON_EXIT = 2
MALFORMED_OUTPUT = cannot read route record
```

The receipt artifact contains the command transcript, vendor plan, and all
three fixture files. This is author-side executed Evidence on an isolated
machine surface; it does not replace an independent Review.

## 6. Local preservation

The candidate tree is based directly on consumer Base tree
`530c3f9d80342f44b45f1ee21db0b90c1a1445f9` and changes only shared
manifest-managed governance paths, the lock, the proposed successor Spec, and
this report. The review-fix amendment itself changes only the proposed
successor Spec and this report.

```text
AGENTS.md = 38b134e4de175b8dce9cf72d0e5bc8205bb1eaeb (preserved)
.agents/local/README.md = 20f96026994fbcb5795cf81a6812aab7ab7f910e (preserved)
.agents/local/CODE_STRUCTURE_GUARDRAILS_V1.md =
d7648f64e8cee42308e944759c6440bc79134d97 (preserved)
AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0.md =
4c7e59cc1a759222b05cd839f4bfc71fbf727ef4 (preserved)
PRODUCT_CODE_CHANGED = NO
RUNTIME_CONFIGURATION_CHANGED = NO
PRODUCTION_STATE_CHANGED = NO
```

No product Spec, historical Review, permission, Grant, credential, Secret, or
GitHub setting is changed.

## 7. Proposed Spec format closure

The proposed successor now records:

```text
REQUIRED_SECTIONS = 13/13
STATE_ITEMS_WITH_SUBJECT_REVISION_ENVIRONMENT_TIME_BASIS = 3/3
OBSERVATIONS_WITH_SUBJECT_REVISION_ENVIRONMENT_TIME_METHOD_RESULT_PROVENANCE = 6/6
CLAIMS_WITH_SUPPORT_STATE_AND_EVIDENCE = 3/3
EVIDENCE_RELATIONS_WITH_SOURCE_TARGET_RELATION_COORDINATES_SUFFICIENCY_LIMITATIONS_PROVENANCE = 5/5
CONTRACTS = 5
CONTRACTS_WITH_ACCEPTANCE = 5/5
ACCEPTANCE_ITEMS_WITH_METHOD_ENVIRONMENT_REQUIRED_EVIDENCE_EXPECTED_RESULT_FAILURE_CONDITION = 3/3
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
```

The existing Decision and Contract texts retain their meaning. The amendment
does not accept V1, supersede V0, or alter the lock lifecycle.

## 8. Current Base movement

At the independent Review's final impact check, `main` had advanced to:

```text
CURRENT_BASE_HEAD =
205d9f748347542eb0fc88d5689d719849d85b97

BASE_IMPACT =
BOUNDED
```

The intervening changes did not touch the shared vendored governance files,
V0 authority, `AGENTS.md`, or `.agents/local/**`. A later Owner acceptance
transaction must integrate the then-current `docs/specs/README.md` rather than
overwrite newer navigation. This amendment does not merge current `main` into
the candidate and performs no acceptance transaction.

## 9. Scope and lifecycle result

```text
REVIEW_FIXES_CLOSED_BY_CANDIDATE = 2/2
V1_STATUS = proposed
V0_STATUS = accepted_current
LOCK_STATUS = proposed
accepted_by = null
accepted_at = null
PR_READY_STATE = DRAFT
THIS_AMENDMENT_ACCEPTS_ADOPTION = NO
THIS_AMENDMENT_MERGES_PR = NO
PRODUCT_CODE_CHANGE = NONE
RUNTIME_OR_PRODUCTION_CHANGE = NONE
PERMISSION_OR_CREDENTIAL_CHANGE = NONE
```

## 10. Independent re-review requirements

The next independent Reviewer must bind the amended exact PR Head and:

1. verify the proposed Spec's State/Observation/Evidence/Acceptance fields;
2. verify Decision and Contract semantic delta remains `NONE`;
3. inspect or reproduce successful run `33683264969`, job `100424581220`,
   and artifact `9867075055`;
4. verify all 25 managed bytes and the proposed lock;
5. recheck current Base impact and PR Draft state;
6. confirm V0 remains current and V1 remains proposed.

```text
READY_FOR_INDEPENDENT_RE_REVIEW = YES
READY_FOR_OWNER_ACCEPTANCE = NO
ADOPTION_ACCEPTED = NO
MERGE_READY = NO
```

---

## v1.0.3 forward update (2026-09-05, MASTER GOAL GOVERNANCE_TRANSITION_CHAIN_CONFORMANCE_RECONCILIATION_V1, LANE_D)

Honest continuation of this preparation narrative. The v1.0.1 adoption was
merged (PR #140, `237d422`), and an independent post-merge conformance audit
established `OWNER_MANDATE_CONFORMANCE = FAIL` for that round: the raw
accepted-state full-graph transition exited 1 (4 errors) and was downgraded
to "TOOLING_DEBT" without Owner authorization before merge. The Owner ruled
FORWARD_RECONCILE_WITHOUT_AUTOMATIC_ROLLBACK and issued Master Goal
`GOVERNANCE_TRANSITION_CHAIN_CONFORMANCE_RECONCILIATION_V1`. The persistent
record is `docs/investigations/GOVERNANCE_V1_0_1_MANDATE_CONFORMANCE_RECONCILIATION_V1`;
the original v1.0.1-round records above are retained unchanged, including
their reliance on input normalization and the non-blocking classification —
they are historical facts, not precedents.

This update prepares the consumer adoption of the exact upstream v1.0.3
patch (annotated tag object `008214f673d11dd345fa1d4416036d1c0f25314a`
peeling to `0d61433339ef563f82307b70120d9fcee168cdab`, manifest SHA-256
`f4aa7779623e670a384195ccc40e509fb5600ddfb97363f8b907386fffbceca2`), whose
validator fix removes the tool-side need for any normalization or exemption.
Proposed successor: `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2`
(`supersedes = [AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1]`; V1 is accepted
on main, so the direct successor edge is legal).

### Executed this round (author-side, supporting evidence)

```text
PREPARATION_BASE = aa8fbe5 (current main; includes 237d422)
VENDOR_DRY_RUN = exit 0, "No files written", zero-dirty tree
VENDOR_APPLY = exit 0; 25/25 manifest paths byte-exact vs upstream v1.0.3
CONTENT_DELTA_VS_V1_0_1_VENDORED_SET = 3 files (.agents/README.md version line;
  validate_spec_transition.py fix dec8944->7f95666; governance.lock.json)
MODE_BIT_NOTE = vendor CLI dropped exec bits on verify_governance.py /
  validate_governance_route.py (content unchanged); committed modes restored 100755
  (upstream TOOLING_DEBT, recorded since the v1.0.0 round)
VERIFY_GOVERNANCE_PROPOSED = exit 0
PY_COMPILE = exit 0
ROUTE_FIXTURES = 0 / 1 / 2 PASS
RAW_TRANSITION_PROPOSED_FULL_GRAPH = exit 0 (RKGV1+V0+V1 base -> +V2 proposed, zero normalization)
RAW_TRANSITION_MAIN_SELF = exit 0
OLD_V1_0_1_VALIDATOR_SAME_INPUTS = exit 1 (governed_by/supersedes array failures) —
  the obligation gap this adoption closes
LOCK = proposed / accepted_by=null / accepted_at=null;
  prepared_by="ZCode / re-vendor-adoption-preparation-agent"; prepared_at=2026-09-04T23:54:32Z
ADOPTION_STATUS = proposed
NON_WAIVABLE_GATE_AHEAD = raw full-graph exit 0 required on accepted candidate AND merged main
```
