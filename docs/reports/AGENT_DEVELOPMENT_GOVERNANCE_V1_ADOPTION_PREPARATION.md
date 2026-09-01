# Governance v1.0.0 Consumer Adoption Preparation

```text
TASK_NAME = 采用 执行
TASK_TYPE = CONSUMER_GOVERNANCE_ADOPTION_PREPARATION
REPOSITORY = mayf3/dsh-agent-core
BASE_COMMIT = 840d2f4ad91f8252eb1f163330c041216a0dd9c4
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

## 3. Vendor dry-run and application

The exact upstream `tools/vendor.py` was inspected before application. Its
manifest-derived dry-run plan was reproduced against the consumer Base:

```text
MANAGED_PATHS = 25
UNCHANGED_MANAGED_PATHS = 6
REPLACED_OR_ADDED_MANAGED_PATHS = 19
LOCK_PATH = .agents/governance.lock.json
LOCAL_EXTENSION_PATHS_IN_PLAN = 0
PRODUCT_PATHS_IN_PLAN = 0
```

The execution container could not open a fresh network checkout of the upstream
repository. Therefore the CLI itself was not invoked against a local clone.
Instead, the same exact plan was applied through Git data using upstream blob
objects verified at source commit `9028427...`. Every candidate managed blob
has the exact upstream Git object identity and its manifest-recorded SHA-256 and
size. This limitation is not hidden: independent Review MUST rerun the vendor
CLI from a normal checkout before Owner acceptance.

```text
VENDOR_CLI_EXECUTED_LOCALLY = NO_NETWORK_CHECKOUT_UNAVAILABLE
VENDOR_PLAN_INSPECTED = YES
VENDOR_DRY_RUN_EQUIVALENT = PASS
EXACT_RELEASE_BLOBS_APPLIED = 25/25
MANIFEST_VERIFICATION = PASS
```

## 4. Proposed lock

The candidate lock records:

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

Lock/manifest structural and identity validation passed.

## 5. Local preservation

The candidate tree is based directly on consumer Base tree
`530c3f9d80342f44b45f1ee21db0b90c1a1445f9` and overrides only shared
manifest-managed governance paths, the lock, the proposed successor Spec, and
this report. All other blobs are inherited unchanged.

```text
AGENTS.md = 38b134e4de175b8dce9cf72d0e5bc8205bb1eaeb (preserved)
.agents/local/README.md = 20f96026994fbcb5795cf81a6812aab7ab7f910e (preserved)
.agents/local/CODE_STRUCTURE_GUARDRAILS_V1.md = d7648f64e8cee42308e944759c6440bc79134d97 (preserved)
AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0.md = 4c7e59cc1a759222b05cd839f4bfc71fbf727ef4 (preserved)
PRODUCT_CODE_CHANGED = NO
RUNTIME_CONFIGURATION_CHANGED = NO
PRODUCTION_STATE_CHANGED = NO
```

No product Spec, historical Review, permission, Grant, credential, Secret, or
GitHub setting is changed.

## 6. Deterministic validation

### Proposed Spec and lock

```text
SPEC_FRONTMATTER = PASS
REQUIRED_SPEC_SECTIONS = 13/13
CONTRACTS = 5
CONTRACTS_WITH_ACCEPTANCE = 5/5
LOCK_FIELDS = PASS
LOCK_FILE_MATRIX = 25/25
MANIFEST_SHA256 = PASS
PROPOSED_NOT_ACCEPTED = PASS
```

### Governance route validator

The exact v1.0.0 validator blob is vendored at
`.agents/tools/validate_governance_route.py`. A local isolated fixture harness
exercised its deterministic public contract for this route:

```text
valid proposed SUPERSEDE route -> exit 0
contradictory SUPERSEDE + implementation_allowed=YES -> exit 1
malformed JSON -> exit 2
```

Outputs:

```text
0: Governance V1 route is internally consistent
1: Governance V1 route validation failed: SUPERSEDE cannot permit mutation
2: cannot read route record: malformed JSON
```

The independent Reviewer must rerun the exact vendored script from the Draft PR
checkout; no acceptance claim is made from the preparation harness alone.

### Test scope

No product, runtime, package, configuration, schema, database, or production
path is modified. Applicable governance integrity, lifecycle, path-scope, and
route fixtures passed. Product/runtime suites were not rerun in the Git-data
write surface because their executable tree is byte-identical to Base; the
independent review remains responsible for a normal-checkout verifier rerun.

## 7. Changed-file boundary

Expected candidate changes:

```text
19 shared manifest-managed governance paths
.agents/governance.lock.json
docs/specs/AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1.md
docs/reports/AGENT_DEVELOPMENT_GOVERNANCE_V1_ADOPTION_PREPARATION.md
```

Not changed:

```text
AGENTS.md
.agents/local/**
docs/specs/AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0.md
all product authorities other than the new proposed adoption successor
packages/**
scripts/**
bundle-*/**
profile-*/**
production state
```

## 8. Required next lifecycle

```text
PREPARATION = COMPLETE
INDEPENDENT_REVIEW = REQUIRED
OWNER_ACCEPTANCE = NOT_PERFORMED
PR_READY = NO
MERGE = NO
ACTIVE_LOCAL_GOVERNANCE = V0
```

A later accepted transaction must be independently reviewed and must atomically
accept V1, supersede V0 with reciprocal backlinks, accept the lock with Owner
identity/time, update navigation, recheck the final Head, and merge to `main`.
