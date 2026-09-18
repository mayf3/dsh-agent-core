# Disabled genesis census repair within the parent Goal

## Development preflight

```text
GOAL_OR_TARGET = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1
CURRENT_GAP = authorized exact disabled installation stopped at compressed sudoers census
TARGET_REPOSITORY = mayf3/dsh-agent-core
BASE_HEAD = eb7e72f2bc75c8842492b2b90cac31263dd583ea
REVIEW_TARGET_HEAD = successor to eb7e72f, exact commit pinned after tests
CURRENT_BASE_HEAD = 5c7b62055e40e3ad0c7ec80a2896a51fd0e33814
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@39865536ce51005f95a98473e77c2329078512c0 CTR004/005/017 section7
AUTHORITY_ACCEPTED_IN_BASE = YES
IMPLEMENTATION_AUTHORITY = contracts
ROUTE_STAGE = IMPLEMENTATION
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
EXECUTION_MANDATE = VALID Owner continued nonproduction preparation
MUTATION_AUTHORIZATION = VALID_NONPRODUCTION_ONLY
ISOLATED_WRITE_SURFACE = YES existing isolated bootstrap-preparation worktree
SPEC_GAP_DEPENDENCY = NONE
EVIDENCE_REVIEWABILITY = PASS
LIVE_AUTHORITY_GAP = NONE
OWNER_DECISION_REQUIRED = NO for nonproduction repair; YES for any changed exact privileged package
IMPLEMENTATION_ALLOWED = YES
OPERATION_ALLOWED = NO for corrected package
DONE_WHEN = narrow regression and negative tests, full validation, independent affected review, exact corrected package and same-attempt reconciliation request
EXPANSION_TRIGGER = unsafe new public/permission contract or unexplained live prefix
```

Bounded design: the read-only census of an existing root-owned OS configuration
must read kernel-decompressed bytes without treating that file as an installable
artifact. Add a census-only protected reader permitting only the macOS
UF_COMPRESSED flag in addition to zero; all owner/type/link/mode/ACL/xattr/size,
no-follow, bounded stable descriptor reads and pre/post digest comparisons remain.
Artifact, grant, executable and key readers retain their existing stricter rules.
No host metadata is changed to make checks pass. Existing accepted Spec is unchanged.

## Global Constraints

- No privileged installation, login, retry, service operation, sudoers modification,
  lock deletion, key generation or package/installed-runner replacement in this work.
- Preserve exact failed package fe3d6711df190b76de32cabf3607b6de12f575803f213d6603ee1eb264c5b065,
  plan7c516b2f349226b258e5289cd5c8ac3e9c879ae19d9ecf5d0c284698598895ab and
  attempt genesis-65559dd-20260918-01. A future request retains this same attempt.
- The failure happened before any InstallStep. Protected diagnostic confirmed
  journal contains only root0600 zero-byte flags0 bootstrap.lock. sudoers is
  root0440 single-link flags32 with old mtime/ctime. No identities/state/keys/plist.
- No blanket flags/xattrs permission relaxation; no change to generic artifact trust.
- No unrelated R02/closed findings, future multi-resource debt, or new Goal.
- Tests are nonroot disposable fixtures; no real privileged files are read by tests.

### Task 1: Correct the read-only sudoers census

Work in packages/deployment-control-plane. First add a real macOS compressed-file
regression proving the current sudoers census reader rejects a safe compressed
fixture. Suggested fixture: create ordinary compressible text in kernel private temp
and Apple ditto --hfsCompression to a separate file; prove flags32 and byte readback.
Use an existing production census reader entry, factoring narrowly if necessary;
retain RED command/output before implementation. Never alter real /private/etc.

Introduce the smallest census-only reader preserving descriptor/no-follow/path
owner rules, root UID/GID in native invocation, regular/single-link/nonwritable
metadata, ACL rejection and allowed xattrs. Permit only UF_COMPRESSED (0x20) for
existing configuration census. Read bounded logical bytes twice from the same
opened fd; check metadata/flags/xattrs before/after and stable bytes. Use it only
for sudoers and its explicitly parsed include graph. Keep ordinary artifact,
key/grant/executable readers strict. Keep include syntax/cycles/count fail closed.

Add negative tests for links/unsafe writable metadata/disallowed flags/xattrs,
size limits and artifact rejection of the compressed fixture. Make minimal
phase-specific error context so the same census failure is attributable without
printing secret/config contents; only if it can preserve existing error contracts.
Do not add an arbitrary root read API or a generic resume/override flag.

Run focused tests, full Rust suite, fmt, strict Clippy and release build; retain
exact logs and self-review. Commit only your source/test files; controller owns
documents and operation reports. Report scope and test provenance.

### Task 2: Independently review and package exact continuation

Controller retains failure evidence, existing-task metadata, root grants/lock and
source-only repair. Independent reviewer checks Task1 and directly affected
census/installer boundary; no unrelated closed-surface restart.

Build a new inert real release package from reviewed source. Prepare one
reconciliation runbook that binds original attempt, original root runner/grant/lock
preimages and exact replacement package. Before any future replacement prove code
contains only original runner, journal contains only lock, all native-step paths
and identities remain absent, and grants/host match. A mismatch stops; no cleanup,
new attempt, arbitrary resume or native replay. Preserve original grant/runner
rollback bytes outside live write surface, require a separately exact Owner grant
for new pins. This is a bounded execution mandate, not new Product Authority.

The old package is not reissued or overwritten. No new privileged action occurs
until a concrete exact corrected package authorization is given. Parent completion
and activation readiness remain NO.
