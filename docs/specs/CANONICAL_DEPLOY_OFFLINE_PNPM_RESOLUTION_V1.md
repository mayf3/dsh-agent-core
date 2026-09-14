---
spec_id: CANONICAL_DEPLOY_OFFLINE_PNPM_RESOLUTION_V1
status: proposed
date: 2026-09-14
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
scope:
  - canonical trusted-control-plane offline pnpm launcher resolution
  - exact-version and selected-Node binding before production mutation
  - one bounded G2 deploy retry followed by one separately serialized exact Human Principal projection
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
  - AGENT_CORE_HARDENING_PROGRAM_V1
  - AGENT_CORE_BACKUP_RETENTION_V1
  - DSH_NATIVE_ARM64_RUNTIME_V1
  - AGENT_CORE_WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_V0
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# Canonical Deploy Offline pnpm Resolution V1

## 1. Goal

Make the canonical trusted-control-plane deployment resolve one locally
installed pnpm launcher deterministically, enforce the Harness's exact declared
version, bind probe and install to the same selected Node and architecture, and
fail before any production mutation when that package-manager preflight cannot
be proven offline-safe.

For the current Harness declaration, success requires exactly:

```text
RESOLVED_PACKAGE_MANAGER=pnpm
DECLARED_PNPM_VERSION=11.7.0
RESOLVED_PNPM_VERSION=11.7.0
VERSION_COMPATIBLE=YES
OFFLINE_SAFE=YES
```

## 2. Scope and non-goals

In scope:

- one pnpm resolver used only by `scripts/trusted-cp-deploy-install.sh`;
- closed local candidate precedence, Corepack rejection, exact-version proof,
  selected-Node/architecture binding, source-owner package-manager execution,
  and a pre-production harness dependency stage;
- fail-before-production-mutation behavior and focused fixtures;
- after future acceptance and conforming implementation, one bounded G2 deploy
  retry and one separate exact Human Principal projection.

Out of scope:

- a generic deployment or package-manager framework;
- npm, yarn, bun, `npx`, online fallback, remote installation, or developer
  convenience tooling;
- arbitrary PATH/HOME/project/`/tmp` discovery;
- Node upgrade/downgrade, architecture migration, launchd redesign, deploy-lock
  service, backup-policy change, or directory-cap exemption;
- Broker/runtime/projection semantics, credentials, Grants, identities, raw DB,
  Workflow mutation, or exact-20 Human Workflow normalization.

## 3. Authority and dependencies

`AUTHORITY_ACTION=NEW`. No active `main` Spec authorizes package-manager
launcher resolution in the canonical installer. This Spec is docs-first and
remains non-authorizing while proposed.

`AGENT_CORE_WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_V0` owns the exact projection
operator but its implementation closure excludes release scripts and its
production apply authority remains none. `AGENT_CORE_BACKUP_RETENTION_V1` owns
backup metadata/pin/prune semantics only; those semantics remain unchanged.
`DSH_NATIVE_ARM64_RUNTIME_V1` owns any architecture migration; this resolver
validates an already-selected architecture and never chooses one.

The accepted-looking `TRUSTED_CP_DEPLOY_ARCH_CLOSURE_V2` exists only at
unmerged revision `613a07a2806a0efac779b4bc092a49258a20d425`, has
`implementation_authority=none` and `production_apply_authority=none`, and is
not active repository authority. This Spec disposes that candidate as
`SUPERSEDED_UNMERGED_CANDIDATE` in full. Its fixed x64/Corepack launcher
direction MUST NOT later become a parallel deployment truth. Useful historical
rationale remains in that branch; no active-main backlink is possible or
required because the predecessor never entered the authority branch.

## 4. Current State

- `STATE-CPM-001` — `mayf3/dsh-agent-core` authority branch `origin/main` was
  `aefb68efa73bf62ce6a07753e7a22e8c8e6f7aa1` when this candidate was frozen
  on 2026-09-14. Basis: `OBS-CPM-001`.
- `STATE-CPM-002` — production is the restored predecessor; runtime is running
  with fresh ready evidence, the G2 projection is not deployed or invoked, and
  no Workflow mutation was performed. Basis: `OBS-CPM-002` and
  `EVD-CPM-002`.
- `STATE-CPM-003` — the Harness used by the failed canonical transaction
  declares exactly `pnpm@11.7.0`. Basis: `OBS-CPM-003` and `EVD-CPM-001`.

## 5. Observations

### OBS-CPM-001 — Authority-base identity

- Subject: `mayf3/dsh-agent-core` authority branch
- Source revision: `aefb68efa73bf62ce6a07753e7a22e8c8e6f7aa1`
- Environment: clean detached `origin/main` worktree
- Observed at: 2026-09-14
- Method: fresh fetch, exact revision and ancestry readback
- Result: main contains the reviewed G2 projection implementation and prior Git
  probe repair; it contains no active pnpm-launcher authority
- Provenance: Git object database and `docs/specs/` census

### OBS-CPM-002 — Failed deploy and restored production

- Subject: canonical trusted-control-plane deployment attempt
- Source revision: `49a5d42c053401036550aac84d2427a61832a457`
- Environment: production host, root transaction
- Observed at: 2026-09-14
- Method: installer/rollback receipt plus launchd and fresh ready readback
- Result: `/usr/local/bin/pnpm` attempted a registry fetch and failed with
  `UND_ERR_INVALID_ARG` after backup; rollback restored the predecessor; the
  new projection bytes remained absent and projection was not invoked
- Provenance: `/tmp/g2-projection-20260914-49a5d42.{receipt,log}`

### OBS-CPM-003 — Declared and installed package-manager identities

- Subject: Harness declaration and host pnpm/Node candidates
- Source revision: Harness `514ab7b0029141b88c807704764d0d3e1eea1da4`
- Environment: production host, read-only probes
- Observed at: 2026-09-14
- Method: parse `package.json`; resolve symlinks; execute version/architecture
  probes without changing installation state
- Result: Harness declares `pnpm@11.7.0`; `/usr/local/bin/pnpm` resolves into
  Corepack and attempts network bootstrap; `/opt/homebrew/bin/pnpm` resolves to
  an installed pnpm distribution and reports `11.7.0`; observed Node candidates
  differ in version/architecture
- Provenance: local filesystem metadata and version-probe transcript

## 6. Claims and assumptions

### CLM-CPM-001 — Path existence did not prove offline executability

- Support state: SUPPORTED
- Supported by evidence: `EVD-CPM-001`
- Contradicted by evidence: none known
- Uncertainty: future host candidates require fresh admission

### CLM-CPM-002 — Pre-mutation resolution prevents this rollback class

- Support state: SUPPORTED
- Supported by evidence: `EVD-CPM-002`
- Contradicted by evidence: none known
- Uncertainty: it prevents package-manager preflight failure from entering the
  production transaction; unrelated installer failures retain existing rollback
  semantics

## 7. Evidence relations

### EVD-CPM-001 — Candidate probes support the launcher Claim

- Source observations: `OBS-CPM-003`
- Target: `CLM-CPM-001`, `STATE-CPM-003`
- Relation: SUPPORTS
- Bound coordinates: Harness `514ab7b...`, host observations on 2026-09-14
- Strength/sufficiency: direct declaration, realpath, version and failure probes
- Limitations: installed paths and versions are time-indexed
- Provenance: local package.json, filesystem, and probe transcript

### EVD-CPM-002 — Failed transaction supports pre-mutation admission

- Source observations: `OBS-CPM-002`
- Target: `CLM-CPM-002`, `STATE-CPM-002`
- Relation: SUPPORTS
- Bound coordinates: Agent Core `49a5d42...`, failed attempt receipt dated
  2026-09-14
- Strength/sufficiency: exact causal boundary and rollback outcome observed
- Limitations: does not prove the future resolver implementation
- Provenance: bounded deployment receipt/log and post-rollback readback

## 8. Decisions

### DEC-CPM-001 — Harness declaration is the version authority

- Decision owner: mayf3
- Decision: parse exactly `pnpm@<semver>` from the selected Harness
  `packageManager`; require exact version equality, not range compatibility
- Rejected alternative: accept any working pnpm or auto-upgrade/downgrade
- Reason: reproducible offline closure requires one declared tool version

### DEC-CPM-002 — Candidate discovery is finite and deterministic

- Decision owner: mayf3
- Decision: use only one explicit trusted configuration path followed by two
  fixed local installation entrypoints; never search PATH or arbitrary trees
- Rejected alternative: `command -v`, HOME/project search, or new platform
  discovery framework
- Reason: the result must be auditable and invariant under root shell PATH

### DEC-CPM-003 — Corepack bootstrap is not an offline launcher

- Decision owner: mayf3
- Decision: reject Corepack forwarding/shim candidates even if their pathname is
  `pnpm`; prohibit every network/bootstrap fallback
- Rejected alternative: warm or download Corepack's cache during deployment
- Reason: the observed shim crossed the offline boundary after mutation began

### DEC-CPM-004 — The selected Node executes both probe and install

- Decision owner: mayf3
- Decision: invoke the admitted pnpm JS entrypoint with the exact selected Node;
  do not use pnpm's shebang or caller PATH
- Rejected alternative: infer architecture from prefix or launcher filename
- Reason: process architecture belongs to the interpreter, not a JS path

### DEC-CPM-005 — Package-manager work precedes production mutation

- Decision owner: mayf3
- Decision: resolve, probe, and complete the offline Harness dependency stage
  before backup, launchd change, active-root move, or trusted-root write
- Rejected alternative: rely on rollback after discovering launcher failure
- Reason: a preflight failure must have zero production mutation

### DEC-CPM-006 — Preserve the existing privileged trust boundary

- Decision owner: mayf3
- Decision: when root orchestrates a user-owned source, package-manager probes
  and install execute as that exact source owner in a nonce-scoped
  non-production stage; root validates and adopts the completed stage only
  after package-manager success
- Rejected alternative: execute uid-502-writable pnpm distribution bytes as
  root merely because the path is allowlisted
- Reason: launcher repair must not weaken the trusted control plane

## 9. Contracts

### CTR-CPM-001 — Exact declaration parsing

The resolver MUST read `HARNESS_SOURCE/package.json`, require exactly one string
matching `pnpm@<exact semver>`, and return the declared version. Missing,
malformed, non-pnpm, ranged, tagged, or extra package-manager syntax MUST fail
before production mutation.

### CTR-CPM-002 — Closed candidate precedence

The complete precedence MUST be: trusted operator configuration
`AGENT_CORE_CANONICAL_PNPM_BIN` when present; `/opt/homebrew/bin/pnpm` when
present; `/usr/local/bin/pnpm` when present. No PATH lookup or other candidate
is permitted. An explicit candidate failure MUST fail the resolution rather
than fall through. Automatic duplicate realpaths MUST be evaluated once at
their earliest position.

### CTR-CPM-003 — Candidate admission and Corepack rejection

Each candidate MUST canonicalize to an absolute readable executable file. The
resolver MUST reject a Corepack forwarder/shim or a realpath inside a Corepack
distribution before selection. It MUST preserve sanitized stderr for each
rejection and fail loud if no candidate passes.

### CTR-CPM-004 — Exact version and offline probe

The resolver MUST run `SELECTED_NODE_BIN PNPM_BIN --version` with
`COREPACK_ENABLE_NETWORK=0`, proxy/bootstrap variables absent, a bounded
timeout, and no shell PATH resolution. Output MUST be one exact semver equal to
the declaration. Timeout, malformed output, mismatch, bootstrap attempt, or
nonzero exit MUST reject the candidate.

### CTR-CPM-005 — Node and architecture binding

`SELECTED_NODE_BIN`, `EXPECTED_NODE_VERSION`, and `EXPECTED_NODE_ARCH` MUST be
trusted installer inputs from the current accepted deployment transaction or a
separately accepted architecture cutover. Fresh Node version and `process.arch`
MUST equal those expected values. Probe and install MUST use that exact Node and
pnpm realpath pair. A native-arm64 target MUST reject x64; an ordinary x64
predecessor-preserving refresh MUST NOT silently migrate architecture.

### CTR-CPM-006 — Source-owner execution

When root orchestrates a user-owned Harness source, the helper MUST derive its
filesystem owner mechanically and execute declaration, version, and install
work as that same uid in a clean environment. The nonce-scoped dependency stage
MUST remain outside production paths until package-manager success. The root
phase MUST NOT execute the user-writable pnpm distribution directly.

### CTR-CPM-007 — Offline install and frozen result

The pre-production stage MUST use the admitted pair for
`pnpm install --offline --frozen-lockfile --ignore-scripts
--config.package-import-method=copy`, with Corepack networking disabled and
proxy/bootstrap variables absent. It may consume only existing local cache/store
content. After success, the installer MUST freeze and revalidate the exact Node
realpath/version/arch, pnpm realpath/version, declaration, source uid, resolution
source, and stage identity before root adoption.

### CTR-CPM-008 — Fail before production mutation

Contracts `CTR-CPM-001` through `CTR-CPM-007` MUST complete before backup
creation, launchd mutation, active-root rename/copy, trusted-root creation, or
any other production write. Any failure MUST return `PNPM_PREFLIGHT_FAILED`
with `PRODUCTION_BACKUP_CREATED=NO`, `ACTIVE_ROOT_MUTATED=NO`,
`LAUNCHD_MUTATED=NO`, and `PRODUCTION_MUTATION_PERFORMED=NO`.

### CTR-CPM-009 — Exact implementation closure

After lifecycle acceptance is merged, implementation may change only:

```text
A scripts/lib/trusted-pnpm-resolver.sh
M scripts/trusted-cp-deploy-install.sh
A packages/production-runtime/test/native-arm64/trusted-pnpm-resolver.test.js
```

No other implementation or test path is authorized. The helper owns Contracts
001-007; the installer owns pre-mutation integration and existing-flow
consumption; the test owns behavioral fixtures and integration evidence.

### CTR-CPM-010 — Existing deployment semantics remain intact

After package-manager preflight succeeds, existing Git source-stamp, backup,
pin, rollback, trusted Node selection, config/credential preservation,
ownership, symlink audit, and post-install verification semantics MUST remain
unchanged. This Spec authorizes no deploy lock, backup helper change, launchd
redesign, secret read/export, or manual production bypass.

### CTR-CPM-011 — Review, lifecycle, and merge

The proposed candidate grants no implementation or production permission. An
independent reviewer MUST bind exact base, head, and Spec SHA-256 and return
ACCEPT with no blockers. Owner acceptance may then atomically change only
`status: proposed -> accepted`, `implementation_authority: none -> contracts`,
`production_apply_authority: none -> controlled_operation`, acceptance
provenance, and the index lifecycle row; normative IDs and §§1-13 remain
byte-identical. Accepted authority becomes active only after merge to `main`.

### CTR-CPM-012 — Bounded downstream controlled operation

After accepted authority and conforming implementation are independently
reviewed and merged, production work MUST remain serialized. One canonical G2
deploy retry may run with fresh preimage/rollback/readiness gates. Only after
deployed provenance, runtime, fresh ready, restart-safety, and capability
availability pass may a separate mutation invoke the existing exact Human
Principal projection once for
`8902db0d-429a-4e37-985c-f8b92d4b78fb`. Persisted `HUMAN/active` readback is
required. Deploy failure/unknown outcome forbids projection. Workflow and
exact-20 normalization remain forbidden.

## 10. Acceptance

| ID | Contracts | Method | Environment | Required evidence / expected result | Failure condition |
|---|---|---|---|---|---|
| `ACC-CPM-001` | `CTR-CPM-001`, `CTR-CPM-003`, `CTR-CPM-004` | Scenario A: exact Harness declaration plus a real executable pnpm `11.7.0` | controlled no-network fixture | returns the frozen direct launcher and literal version `11.7.0` | exact declaration/direct launcher rejected, or ambiguous declaration accepted |
| `ACC-CPM-002` | `CTR-CPM-003`, `CTR-CPM-004` | Scenario B: Corepack shim that requires network bootstrap | controlled no-network fixture | rejected before selection; bootstrap attempt is observable | shim selected, fetch succeeds, or error hidden |
| `ACC-CPM-003` | `CTR-CPM-004` | Scenario C: canonical direct launcher with a non-declared pnpm version | isolated shell fixture | rejected with exact expected/actual versions | wrong version accepted or auto-remediated |
| `ACC-CPM-004` | `CTR-CPM-005` | Scenario D: trusted arm64 Node plus direct pnpm `11.7.0` on an arm64 target | isolated multi-arch fixture | same arm64 Node runs version probe and install | shebang/PATH interpreter or x64 fallback runs |
| `ACC-CPM-005` | `CTR-CPM-005` | Scenario E: expected/observed Node architecture or version mismatch | isolated multi-arch fixture | rejected before package-manager selection completes | mismatch passes or silently changes the expected architecture |
| `ACC-CPM-006` | `CTR-CPM-002`, `CTR-CPM-003` | Scenario F: no valid local canonical candidate | isolated filesystem | returns `PNPM_PREFLIGHT_FAILED` before mutation | PATH/network fallback or arbitrary search occurs |
| `ACC-CPM-007` | `CTR-CPM-003`, `CTR-CPM-004` | Scenario G: candidate probe exits nonzero with diagnostic stderr | isolated shell fixture | sanitized actionable stderr is visible in the failure receipt | stderr suppressed or replaced by path-only error |
| `ACC-CPM-008` | `CTR-CPM-004`, `CTR-CPM-006`, `CTR-CPM-007` | Scenario H: successful declaration, probe, and install with execution-uid/environment recorders plus bootstrap/network sentinels | isolated offline-store stage owned by a uid distinct from root | every package-manager operation runs as the mechanically derived source uid in a clean environment outside production; install completes only from local content; root never executes the user-writable launcher; sentinels prove no package-manager network/bootstrap | wrong/root uid, inherited unsafe environment, production-path staging, bootstrap, remote fetch, or unfrozen install occurs |
| `ACC-CPM-009` | `CTR-CPM-002`, `CTR-CPM-007` | Scenario I: repeat resolution with identical inputs plus duplicate-realpath fixtures | isolated filesystem | byte-identical frozen resolution; explicit precedence stable; duplicate evaluated once | nondeterminism, PATH influence, or fallback after explicit failure |
| `ACC-CPM-010` | `CTR-CPM-006`, `CTR-CPM-008` | Scenario J: inject failure at every declaration/discovery/source-owner/probe/install/freeze boundary, including forced incorrect/root execution | isolated installer fixture with execution-uid and production-mutation sentinels | incorrect/root execution is rejected; no backup exists and every production sentinel remains unchanged | package-manager work runs under the wrong uid, or any backup/production/launchd/active-root write occurs |
| `ACC-CPM-011` | `CTR-CPM-009`, `CTR-CPM-010` | Scenario K: run existing backup/rollback suites and exact implementation-closure audit | exact implementation head | prior backup/rollback semantics pass; only three allowlisted paths differ; no structure regression | regression, extra path, secret output, or bypass |
| `ACC-CPM-012` | `CTR-CPM-010`, `CTR-CPM-011`, `CTR-CPM-012` | Scenario L: run existing trusted-source Git-stamp suite, exact-head reviews, and later serialized receipts/readbacks | exact candidate/implementation heads; production only after authorization | Git stamp unchanged; reviews ACCEPT; deploy and later exact Principal mutation remain separate and prove required readbacks | stamp regression, blocker, combined mutation, wrong target, deploy failure, or exact-20 start |

## 11. Alternatives and disposition

- `ALT-CPM-001` — Keep `/usr/local/bin/pnpm`: rejected; pathname identity did
  not prove offline execution and the observed Corepack shim attempted fetch.
- `ALT-CPM-002` — Hardcode `/opt/homebrew/bin/pnpm` as the sole answer:
  rejected; it excludes Intel/non-Homebrew explicit installations and would
  replace one path accident with another.
- `ALT-CPM-003` — PATH/`command -v`/recursive discovery: rejected; result would
  depend on caller/root environment and could select unknown code.
- `ALT-CPM-004` — Corepack prepare, npm global install, npx, curl, or online
  retry: rejected; they violate the offline production boundary.
- `ALT-CPM-005` — Execute uid-502-writable pnpm as root: rejected; it weakens
  the trusted control-plane boundary.
- `ALT-CPM-006` — Let the resolver select Node or architecture: rejected; those
  decisions remain independently governed.
- `ALT-CPM-007` — Merge `TRUSTED_CP_DEPLOY_ARCH_CLOSURE_V2`: rejected; it is an
  unmerged, non-authorizing candidate with conflicting fixed x64/Corepack
  direction. Its future merge is forbidden after this authority is accepted.

## 12. Migration, compatibility, and rollback

The implementation is a forward-only installer change. Existing production is
not rewritten by authority authoring or code merge. A failed package-manager
preflight performs zero production mutation and needs no rollback. Failures
after the existing production transaction begins retain the current exact
predecessor rollback semantics and receipts.

The resolver records host and selected Node architecture but does not migrate
it. A separately accepted native-arm64 cutover supplies its target Node/arch;
an ordinary predecessor-preserving refresh uses its currently accepted target.
No implicit x64 fallback or arm64 upgrade is allowed.

G2 deployment and the exact Principal projection remain separate mutations.
Projection cannot run unless deployment and capability readbacks pass. No
Workflow assignee or business state is touched in this authority.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS=NONE
NORMATIVE_TBD=NONE
UNRESOLVED_AUTHORITY_CONFLICT=NONE
PARTIAL_SUPERSESSION=NONE
```

The next gate is independent exact-head authority review. Review does not
accept the Spec. Only Owner acceptance of the reviewed exact head, followed by
merge to `main`, activates implementation and the bounded controlled operation.
