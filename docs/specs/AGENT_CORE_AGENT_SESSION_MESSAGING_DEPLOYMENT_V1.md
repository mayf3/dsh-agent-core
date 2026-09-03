---
spec_id: AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: contracts
date: 2026-09-03
revision: r1
accepted_date: 2026-09-03
accepted_by: mayf3
accepted_at: 2026-09-03T01:29:29Z
accepted_reviewed_head: 9853b92e3c701ae4694c7b200acbabc8b3a8c6ee
independent_review_result: PASS
independent_review_blockers: NONE
acceptance_verdict: READY_FOR_ACCEPTANCE_FINALIZE
acceptance_finalize_semantic_change: none
acceptance_authority_basis: >-
  Owner ACCEPT PR #149 at exact reviewed head
  9853b92e3c701ae4694c7b200acbabc8b3a8c6ee on 2026-09-03.
scope:
  - exact production release closure for canonical agent_session_send
  - serialized Auth prerequisite, Agent Core apply, Grant, runtime proof, and A2A canary gates
governed_by:
  - AGENT_CORE_AGENT_SESSION_MESSAGING_V1
  - AGENT_WORKSPACE_SESSION_MODEL_V3
external_authorities:
  - repository: mayf3/auth-service
    authority_id: MINIMAL_AUTH_FOUNDATION_V2
    revision: 05fcf4074fe15d7f29ce1ef0f68767fbbebd54de
    relation: constrained_by
supersedes: []
superseded_by: null
owners:
  - mayf3
  - repository-maintainers
---

# AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1

> **Accepted / exact-head lifecycle authority.** Owner accepted exact reviewed
> head `9853b92e3c701ae4694c7b200acbabc8b3a8c6ee`; independent review PASS with zero blockers and semantic change none.
## 1. Goal

Authorize, only after acceptance and every prerequisite below, one bounded Agent Core production release of the already-implemented canonical capability:

```text
id = toolName = agent_session_send
operation = send
resource = agent-session-messaging
required scope = agent.session.send
target = target Agent canonical main Session
```
The release MUST preserve target-owned execution identity, trusted source derivation, canonical-main reuse-or-create-if-absent, one new target Run/Turn per accepted send, bounded receipt/reply behavior, and no automatic replay or ping-pong.

## 2. Scope and non-goals

### In scope
- the exact 17-file release closure and current production preimage census in §4;
- an immutable, hash-verifiable staging artifact and equal-face rollback artifact;
- the serial Gate sequence in `CTR-DEP-004`;
- fresh-runtime catalog/header proof and one bounded A2A canary;
- production apply and rollback authority only after this exact Spec is accepted with `production_apply_authority: contracts` by an Owner-authorized lifecycle transaction.

### Non-goals
- changing any accepted Session, identity, Auth, Broker, Router, or Scheduler semantics;
- deploying later Scheduler/history integration contained in current `github/main`;
- creating or changing an auth-service audience, registry, scope, database row, or deployment;
- creating a Principal, Client, secret, credential file, or Grant;
- fleet-wide enablement, historical-session targeting, external-channel delivery, delegation, or automatic follow-up turns;
- exposing `agent_wake`, `a2a_send`, `sessions_send`, or `send_message` as aliases.

## 3. Authority and dependencies

```text
LOCAL_PRODUCT_AUTHORITY = AGENT_CORE_AGENT_SESSION_MESSAGING_V1 r3
LOCAL_PRODUCT_AUTHORITY_STATUS = accepted
LOCAL_PRODUCT_AUTHORITY_BLOB = a2632f90ca1ab7afc5f8f864bcf2a94bfd00fb5c
LOCAL_PRODUCT_IMPLEMENTATION_AUTHORITY = contracts
LOCAL_PRODUCT_PRODUCTION_APPLY_AUTHORITY = none
GOVERNING_DECISION = AGENT_WORKSPACE_SESSION_MODEL_V3
GOVERNING_DECISION_BLOB = a5a5f02991ba6fc0973b144d5aa36dc6c2618b73
AUTHORING_BASE = 495b163caea28c4c34b1aa65d131f93184e7f068
LATEST_READ_ONLY_MAIN_RECHECK = bf2efd52f28a63c95d5b07253031ff793390bd1a
AUDITED_RELEASE_SOURCE = 7921f4aecdfe3146210bce7b4a559fe4bc8087cc
AUTH_REPOSITORY_MAIN = 05fcf4074fe15d7f29ce1ef0f68767fbbebd54de
AUTH_PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2
AUTH_SESSION_AUDIENCE_AUTHORITY = ABSENT
```
The accepted local parent owns the complete `agent_session_send` product contract but explicitly grants no production apply. This new deployment Spec is therefore `NEW`, not an amendment or successor, and does not alter the parent.

The external Auth parent supplies grammar and issuance architecture only. It does not register or semantically authorize `agent-session-messaging`. A separate accepted auth-service bounded child CCR (or a whole successor if auth-service review requires one), its implementation, and its production deployment MUST precede any Grant or Agent Core apply. This Spec cannot create that cross-repository authority.

## 4. Current State

- `STATE-DEP-001` — Subject: canonical Session Messaging product authority and source; revisions: authoring base `495b163caea28c4c34b1aa65d131f93184e7f068`, latest read-only main recheck `bf2efd52f28a63c95d5b07253031ff793390bd1a`; environment: repository authority branch; observed at: `2026-09-03T00:57:47Z`; basis: `OBS-DEP-001`, `EVD-DEP-001`.
- `STATE-DEP-002` — Subject: Agent Core production release surface under
  `/usr/local/libexec/agent-core/app`; artifact revision: current file blobs in the table
  below; environment: production host; observed at: `2026-09-03T00:57:47Z`;
  basis: `OBS-DEP-002`, `EVD-DEP-002`.
- `STATE-DEP-003` — Subject: Auth registry support for `agent-session-messaging`;
  revisions: auth main `05fcf4074fe15d7f29ce1ef0f68767fbbebd54de` registry `1.4.0`
  and live checkout `0855dc5161309196ef0cddbf9142e22726961956` registry `1.3.0`;
  environment: auth repository main and production PID 829; observed at:
  `2026-09-03T00:36:26Z`; basis: `OBS-DEP-003`, `EVD-DEP-003`.
- `STATE-DEP-004` — Subject: production deployment authority and release artifact for
  Session Messaging; revision: repository scan at `github/main@bf2efd52...`;
  environment: Agent Core repository; observed at: `2026-09-03T00:57:47Z`;
  basis: `OBS-DEP-004`, `EVD-DEP-004`.
Production target root for every row is exactly `/usr/local/libexec/agent-core/app/`. All 17 destinations after apply MUST be non-symlink regular files owned `root:wheel` with mode `0644`; the 11 present preimages were observed with exactly that type/owner/mode, and each of the 6 `ABSENT` preimages is a required absence, not a wildcard. The rollback manifest MUST record each preimage's existence, blob, bytes, type, owner, group, mode, and destination.

| # | Relative path | Release blob @ `7921f4a` | Bytes | Production preimage blob | Bytes |
|---:|---|---|---:|---|---:|
| 1 | `packages/agent-router/src/index.js` | `c6806a423b7ba0ce1e9d7dbdba15f5e46cfe87be` | 18216 | `b37f9dac94118e53fedf332ab66b7d79eae867cd` | 18146 |
| 2 | `packages/agent-router/src/ingress-delivery.js` | `36e8674f331d394f9a96044615758e87d3f6da0e` | 19318 | `c8cdc0897b8463b0595f8c7ef03701bf54e56973` | 15893 |
| 3 | `packages/agent-router/src/parent-rpc-relay.js` | `c80eefbc99da2c1c9380390c7889153f2d7550e7` | 6183 | `367bb0b80dc383b1aa89e8a32a1ca6f973c9c3d2` | 4933 |
| 4 | `packages/agent-router/src/process/turn-execution.js` | `ac4bcd050fc4c3e5bb7c03c84678bda1783f5bf5` | 19932 | `bf1eb280d4d4d43e81f01886f3185061a74ceddf` | 19691 |
| 5 | `packages/broker/src/capabilities/agent-session-messaging.js` | `109d3ce44c9bc9fde043e48a2d9ea7b7906c9f85` | 5444 | `ABSENT` | 0 |
| 6 | `packages/broker/src/gateway.js` | `68ec4eecf55888fc0eb202c5fe128e3f703ce954` | 15130 | `100eecc2c1e4e64fcb839f24c57dd3a461c182df` | 13814 |
| 7 | `packages/broker/src/index.js` | `eec8c6f9de6cb8434075fac3c984cf4a7e21f660` | 17099 | `6c4a60af4c529dd052ad45bd641213d40ee6800c` | 12125 |
| 8 | `packages/broker/src/relay.js` | `2ec4acf764d13a53d60050ba22569e51885cab4d` | 9829 | `24c0931a839eff5c0068553f1e2dcc983f0b9ca8` | 8859 |
| 9 | `packages/demo-server/src/index.js` | `2a5af0533fd2b8a9f9f188f9be655eef1ef6054e` | 9626 | `997843fc6e30e754480d0c550bb679b3fb3506f6` | 9452 |
| 10 | `packages/demo-server/src/session-seam.js` | `4e7812e78ca00d1418cd3234e12fe3eb19317bfb` | 9352 | `71f5683c7177aa811fe878ef15536f5ba84ec165` | 7609 |
| 11 | `packages/production-runtime/src/agent-session-messaging-audit.js` | `ecd23618ece4d9d25f4b98bb1bd46ee8f7b51618` | 5144 | `ABSENT` | 0 |
| 12 | `packages/production-runtime/src/agent-session-messaging.js` | `e3420bbe85a0268f54bae149a78962f5d241215b` | 14237 | `ABSENT` | 0 |
| 13 | `packages/production-runtime/src/agent-session-reply-wait.js` | `6968cc2a1784fb82f7280264f8f6c499da6801f2` | 6484 | `ABSENT` | 0 |
| 14 | `packages/production-runtime/src/compose.js` | `cdd3eacf4c52c97c43249e59ffb841cb6e1801cc` | 24187 | `f5c7a8d379a3de020b34d1cdf67992b57dfce361` | 22362 |
| 15 | `packages/production-runtime/src/notification-ingress-runtime.js` | `5aa34d533aef285828cf54611b3f0fa0b886e2b0` | 3137 | `82b047cdd0f3c2d3285fe0f89dd658f6870802df` | 2932 |
| 16 | `packages/production-runtime/src/shared-codex-migration-executable.js` | `090f547133906c8b078e2f714a136869b8b7feaf` | 10076 | `ABSENT` | 0 |
| 17 | `packages/production-runtime/src/shared-codex-migration.js` | `70e74439d34fb58f21b093cef0ba4785cc1ca1a2` | 4620 | `ABSENT` | 0 |

## 5. Observations

### OBS-DEP-001 — Accepted source is present on main

- Subject: Session Messaging authority and implementation lineage
- Source revision: authoring base `495b163caea28c4c34b1aa65d131f93184e7f068`; read-only recheck `github/main@bf2efd52f28a63c95d5b07253031ff793390bd1a`
- Environment: local Git object database after `git fetch github main`
- Observed at: `2026-09-03T00:57:47Z`
- Method: resolve commits/blobs and run `git merge-base --is-ancestor`
- Result: acceptance `d6c781696b1c...` and implementation commits `07102da0d241...`, `8258acb8e37d...` are ancestors of main; the accepted parent blob is `a2632f90...`; all 17 release-path relationships remain 16 identical blobs plus the intentionally distinct candidate `compose.js`.
- Provenance: Git commands and reports `agt-ssend-final-head-audit-v1.md` and
  `agt-ssend-implementation-audit-revise-v1.md`.

### OBS-DEP-002 — Production has the enumerated older preimages

- Subject: the 17 production target paths in §4
- Source revision: filesystem snapshot represented by the §4 Git blob hashes
- Environment: `/usr/local/libexec/agent-core/app`
- Observed at: `2026-09-03T00:57:47Z`
- Method: existence, byte-count, and `git hash-object` census
- Result: 11 paths have the exact listed older blobs and are non-symlink regular `root:wheel` mode `0644`; 6 paths are absent; the ordered blob/absence vector SHA-256 is `ee2ac6c4aeefce900e824b157b864609f9795dd00a412d96cffccffad83b1539`.
- Provenance: read-only local filesystem commands; §4 table.

### OBS-DEP-003 — Auth rejects the required audience before Grant lookup

- Subject: auth-service registry and direct-token authorization path
- Source revision: auth main `05fcf407...`; production checkout `0855dc516...`
- Environment: auth repository and production PID 829 (started 2026-08-30)
- Observed at: `2026-09-03T00:36:26Z`
- Method: inspect both audience registries and `src/lib/oauth/v1/direct.ts:85-90`
- Result: main registry `1.4.0` and production registry `1.3.0` contain no
  `agent-session-messaging`; authorization rejects an unknown/non-machine audience before
  querying machine-client Grants.
- Provenance: auth-service Git/filesystem reads and process listing; no credential access.

### OBS-DEP-004 — No Session Messaging production authority/artifact exists

- Subject: Agent Core Specs, reports, and deployment tooling
- Source revision: `github/main@bf2efd52f28a63c95d5b07253031ff793390bd1a`
- Environment: Agent Core repository
- Observed at: `2026-09-03T00:57:47Z`
- Method: repository path/name/content census for the capability and deployment records
- Result: product authority and implementation audits exist; no production-apply authority
  or capability-specific deployment artifact exists.
- Provenance: `rg`/`git` read-only census.

### OBS-DEP-005 — Current main compose includes later Scheduler integration

- Subject: `packages/production-runtime/src/compose.js`
- Source revision: candidate `7921f4a...` blob `cdd3eacf...`; main `bf2efd52...`
  blob `c407b064...`
- Environment: local Git object database
- Observed at: `2026-09-03T00:57:47Z`
- Method: compare blobs and revision history
- Result: the current-main compose differs after later Scheduler/history integration; the
  audited candidate contains the bounded Session Messaging composition.
- Provenance: `git rev-parse <rev>:<path>` and main history.

## 6. Claims and assumptions

### CLM-DEP-001 — Session Messaging is source-complete but not production-ready

- Support state: SUPPORTED
- Supported by evidence: `EVD-DEP-001`, `EVD-DEP-002`, `EVD-DEP-003`, `EVD-DEP-004`
- Contradicted by evidence: none known
- Uncertainty: runtime behavior remains unproved until an authorized fresh-runtime canary.

### CLM-DEP-002 — A Grant alone cannot activate the capability

- Support state: SUPPORTED
- Supported by evidence: `EVD-DEP-003`
- Contradicted by evidence: none known
- Uncertainty: database contents were not read and are immaterial while the audience is absent.

### CLM-DEP-003 — The audited candidate is the narrow release source

- Support state: SUPPORTED
- Supported by evidence: `EVD-DEP-005`
- Contradicted by evidence: none known
- Uncertainty: a final pre-apply source/blob recheck is still mandatory.

## 7. Evidence relations

### EVD-DEP-001 — Main lineage supports source-complete state

- Source observations: `OBS-DEP-001`
- Target: `STATE-DEP-001`
- Relation: SUPPORTS
- Bound coordinates: Agent Core authoring base `495b163...`, main recheck `bf2efd52...`, observed `2026-09-03T00:57:47Z`
- Strength/sufficiency: strong for merge presence and exact authority blob
- Limitations: does not prove production load
- Provenance: Git ancestry/blob commands and accepted audit reports.

### EVD-DEP-002 — Filesystem census supports old production state

- Source observations: `OBS-DEP-002`
- Target: `STATE-DEP-002`
- Relation: SUPPORTS
- Bound coordinates: `/usr/local/libexec/agent-core/app`, 17 §4 paths, observation time above
- Strength/sufficiency: strong for the observed host snapshot
- Limitations: preimages can drift after observation and MUST be rechecked under the apply lock
- Provenance: existence, byte-count, and `git hash-object` output.

### EVD-DEP-003 — Registry and code order support the hard Auth prerequisite

- Source observations: `OBS-DEP-003`
- Target: `CLM-DEP-002`
- Relation: SUPPORTS
- Bound coordinates: auth main `05fcf407...`, live checkout `0855dc516...`, PID 829
- Strength/sufficiency: strong; rejection occurs before the Grant query
- Limitations: does not authorize or specify the missing auth-service change
- Provenance: both registry files, `direct.ts:85-90`, process listing.

### EVD-DEP-004 — Repository census supports missing deployment authority

- Source observations: `OBS-DEP-004`
- Target: `STATE-DEP-004`
- Relation: SUPPORTS
- Bound coordinates: Agent Core `github/main@bf2efd52...`
- Strength/sufficiency: strong for tracked repository artifacts
- Limitations: excludes untracked/private operator drafts, which confer no repository authority
- Provenance: repository `rg` and Git path census.

### EVD-DEP-005 — Compose divergence supports the narrow candidate pin

- Source observations: `OBS-DEP-001`, `OBS-DEP-005`
- Target: `CLM-DEP-003`
- Relation: SUPPORTS
- Bound coordinates: candidate `7921f4a...`; main `bf2efd52...`; compose blobs in OBS-DEP-005
- Strength/sufficiency: strong for excluding later main-only Scheduler composition
- Limitations: final review MUST mechanically verify all 17 source blobs and feature equivalence
- Provenance: Git blob and history comparison.

## 8. Decisions

### DEC-DEP-001 — Pin the audited 17-file candidate release

- Decision owner: repository Owner
- Decision: release exactly the §4 blobs from `7921f4a...`; do not deploy current-main
  `compose.js`, because it contains later serialized-lane work.
- Rejected alternative: deploy the current main tree wholesale.
- Reason: preserve Lane B isolation while retaining the independently audited implementation.

### DEC-DEP-002 — Treat Auth registration as Phase A, not as a Grant detail

- Decision owner: repository Owner plus auth-service authority owner
- Decision: Phase A ends with accepted/deployed audience configuration and a no-Grant negative token proof; only Phase C may add the minimal Grant and prove positive token claims.
- Rejected alternative: insert a Grant first or infer audience support from scope grammar.
- Reason: current issuance rejects the missing audience before Grant lookup.

### DEC-DEP-003 — Use one fail-closed transaction with equal-face rollback

- Decision owner: repository Owner
- Decision: stage and verify release plus rollback faces, apply all 17 regular `root:wheel` `0644` files under a lock, restart once, then prove health; any mismatch or failure stops or rolls back the whole face.
- Rejected alternative: piecemeal copy, partial restart, or best-effort continuation.
- Reason: mixed Broker/Router/runtime versions violate the accepted composition boundary.

### DEC-DEP-004 — Canonical name is exclusive

- Decision owner: accepted parent authority
- Decision: expose only `agent_session_send`; aliases are forbidden in source, catalog, header,
  invocation, receipts, and evidence.
- Rejected alternative: compatibility aliases such as `a2a_send`, `sessions_send`, or `send_message`.
- Reason: aliases create unreviewed capability surfaces and ambiguous provenance.

## 9. Contracts

### CTR-DEP-001 — Exact source and closure

An authorized builder MUST extract exactly the 17 §4 blobs from
`7921f4aecdfe3146210bce7b4a559fe4bc8087cc`, record an ordered manifest with path,
blob, SHA-256, byte count, mode, owner, and destination, and prove all non-compose
feature blobs are present identically in `github/main@495b163...`. It MUST prove the
candidate compose contains the accepted Session Messaging composition and excludes the
later Scheduler/history composition. Any mismatch MUST stop before staging.

### CTR-DEP-002 — Auth audience/config hard prerequisite

Before Agent Core staging or Grant supply, auth-service MUST have separate accepted authority and a deployed active machine-only agent audience with exact resource `agent-session-messaging` and exact scope `agent.session.send`. Phase A MUST use a disposable agent principal with no Grant to prove that the exact request and wrong resource/scope, human/delegated, wildcard, and alias forms all yield no token; it MUST NOT perform a positive issuance. Grammar, an implementation branch, a database Grant, or this Spec alone MUST NOT satisfy the Gate.

### CTR-DEP-003 — Immutable staging and preimage gate

The operator MUST create non-secret root-owned release and rollback artifacts before apply. Every release hash MUST equal `CTR-DEP-001`; every live target MUST equal its exact §4 preimage including required absence. Both manifests MUST bind absolute destination, existence, blob, SHA-256, bytes, type, owner, group, and mode; all release destinations MUST be non-symlink regular files `root:wheel` `0644`, while rollback MUST reproduce each recorded present file or absence. Artifacts MUST contain no credential, token, Grant material, or environment dump. Any symlink, directory, special file, unexpected metadata/path, or incomplete rollback face MUST stop without production mutation.

### CTR-DEP-004 — Strict serialized stages

The only order is:

```text
A Auth audience/config Authority + implementation + production deployment + pre-Grant negative proof
→ B this Agent Core production Authority + immutable artifact + preimage Gate + apply
→ C separately authorized minimal Grant supply + positive token/claim proof
→ D fresh runtime/catalog/header proof
→ E one bounded A2A canary
```

A stage MUST NOT borrow authority from later stages. No stage may start before every prior
stage records PASS at its exact head/runtime coordinates. Failure MUST stop; apply-time or
post-apply failure MUST invoke `CTR-DEP-008`.

### CTR-DEP-005 — Bounded Agent Core apply

Only an authorized actor using an Owner-approved native privileged path MAY atomically replace the 11 present files and create the 6 absent files in §4. Every destination MUST finish as a non-symlink regular file owned `root:wheel` mode `0644`; staged files/directories MUST be fsynced. The actor MUST restart the Agent Core parent exactly once after complete apply and verify a fresh parent plus fresh relevant child generation and health. No unrelated file, config, data, launch definition, or service may change.

### CTR-DEP-006 — Minimal Grant supply

Only after `CTR-DEP-002` and `CTR-DEP-005` PASS, a separate accepted Grant-supply authority and Owner gate MAY grant exact `(resource=agent-session-messaging, scope=agent.session.send)` to one named disposable source Agent principal. It MUST NOT grant the target, fleet, human/service principals, aliases, wildcards, broader scopes, or new credentials. Phase C, and not Phase A, MUST prove Grant readback and positive token claims. Before apply, the same or another explicit accepted authority MUST authorize exact compensation: on D/E failure or terminal canary completion, revoke/delete only this temporary Grant and prove it absent; retention requires a later separate accepted activation authority naming the principal and purpose. No compensation may be improvised, and Grant work is outside the 17-file artifact.

### CTR-DEP-007 — Fresh catalog/header and A2A proof

After the verified restart, a fresh ordinary source Session/header and fresh post-restart target header/Run coordinates MUST show `agent_session_send` exactly once with operation `send`; the messaging aliases MUST be absent. The target MUST reuse its existing canonical `main` Session, creating it atomically only if absent; the Gate MUST record which branch occurred and MUST NOT create a replacement merely to obtain fresh evidence. Across the entire D/E transaction, one authorized source MUST issue exactly one nonce-marked `agent_session_send` request to a different target Agent: one Broker request, one parent-RPC/delivery attempt, one receipt, zero retry, zero replay, and no second receipt even after timeout or `outcome_unknown`. Evidence MUST bind request/correlation, source, target, canonical `main`, receipt, one target-owned Run/Turn, terminal outcome, and any bounded reply. The target MUST use target-owned identity/config/credential; source token, Grant, credential, authorization header, or authority MUST NOT propagate. Duplicate Run/Turn, automatic reply-send, external delivery, or hidden second attempt MUST fail.

### CTR-DEP-008 — Failure and rollback

Any failed preimage, integrity, Auth, restart, health, header, identity, delivery, exactly-once, or leakage check MUST fail closed. If files changed, the operator MUST restore the complete 17-path §4 preimage face and metadata (deleting only the six `ABSENT` preimages), restart once, and re-prove baseline health/hashes. If Phase C applied a Grant, D/E failure or terminal completion MUST trigger only the separately authorized compensation in `CTR-DEP-006` and prove absence. Evidence/audit rows MAY remain; secrets MUST NOT be recorded. A Gate, dialog, artifact, restart, or receipt alone MUST NOT be reported as success.

### CTR-GOV-001 — Lifecycle and final-head authority

This proposal authorizes no code, artifact apply, restart, Auth change, Grant, or canary. After independent exact-head review and explicit Owner authority, one lifecycle-only docs commit MAY change only this exhaustive allowlist: (1) V1 frontmatter `status: proposed→accepted`, `implementation_authority: none→contracts`, `production_apply_authority: none→contracts`; (2) add frontmatter `accepted_date`, `accepted_by`, `accepted_at`, `accepted_reviewed_head`, `independent_review_result`, `independent_review_blockers`, `acceptance_verdict`, `acceptance_finalize_semantic_change`, and `acceptance_authority_basis`; (3) replace only the two-line Proposed banner with accepted lifecycle/review provenance; (4) footer values `CURRENT_STATUS`, `IMPLEMENTATION_AUTHORITY`, and `PRODUCTION_APPLY_AUTHORITY`; (5) this Spec's README row cells `Current lifecycle` and `Implementation authority`. No other byte may change.

Before that commit, the authorized actor MUST fetch current main, bind its exact head, prove the accepted parents/external authority have not drifted, and recheck the 17 release paths against current main (16 exact-equal candidate blobs plus separately reviewed compose delta) and all 17 production preimages/metadata. After the lifecycle commit, an independent reviewer MUST verify every changed byte is allowlisted; all non-allowlisted normative bytes are identical; new values match Owner authority and review identity/outcome; `SEMANTIC_DELTA=NONE` means product/deployment behavior is unchanged; and the current-main/17-path checks remain PASS. `FINAL_HEAD_RECHECK=PASS` binds that exact accepted head; the head MUST NOT change before merge. Merge activates only these contracts.

## 10. Acceptance

### ACC-DEP-001 — Source, closure, and artifact

- Contracts: `CTR-DEP-001`, `CTR-DEP-003`
- Method: rebuild manifests twice, compare hashes, inspect all path/blob/type/owner/group/mode fields, dry-run apply
- Environment: isolated builder with read-only Git source and non-production staging root
- Required evidence: exact commits, 17 source blobs, SHA-256 manifest, preimage/rollback manifest,
  zero-secret scan, dry-run transcript
- Expected result: exact 17/17 regular `root:wheel` `0644` release face and exact rollback metadata/absence face; zero extra paths
- Failure condition: any mismatch, mutable source, missing rollback byte/metadata, symlink/directory/special file, secret, or extra path.

### ACC-DEP-002 — Auth prerequisite

- Contracts: `CTR-DEP-002`
- Method: verify accepted auth authority/deployed registry, confirm the disposable agent has no Grant, then run only negative token requests
- Environment: deployed auth-service and disposable no-Grant agent client authorized for negative proof
- Required evidence: exact auth head/deployment, registry/audience readback, Grant-absence readback, sanitized denial matrix
- Expected result: audience is deployed but exact and malformed/alias/wildcard requests issue no token before Phase C
- Failure condition: any positive token, missing authority/deployment, existing Grant, or Grant used to satisfy Phase A.

### ACC-DEP-003 — Apply, generation, and health

- Contracts: `CTR-DEP-004`, `CTR-DEP-005`
- Method: execute audited wrapper after A PASS; verify hashes, process start times/generations, and health
- Environment: production Agent Core host under Owner-approved privileged operation
- Required evidence: phase receipts, authorization identity, before/after manifests with metadata, restart receipt, fresh parent/child coordinates, health output, unrelated-path no-change proof
- Expected result: exactly one complete apply/restart; all 17 targets equal release blobs and are regular `root:wheel` `0644`
- Failure condition: skipped/out-of-order phase, partial/wrong-metadata face, stale child, extra restart/change, or failed health.

### ACC-DEP-004 — Grant, header, and canary

- Contracts: `CTR-DEP-006`, `CTR-DEP-007`
- Method: apply/read back the separately authorized minimal Grant, prove positive token claims, inspect fresh post-restart source header and target header/Run coordinates, execute one nonce-bound request, then perform authorized terminal Grant compensation
- Environment: production Agent Core plus deployed Auth audience and disposable authorized source/target
- Required evidence: sanitized Grant/token claims, compensation authority/readback, fresh headers and target Run coordinates, main reuse-or-create branch, one request/RPC/delivery/receipt/correlation chain, target identity and terminal/replay/leak checks
- Expected result: canonical tool only; existing main reused or absent main created once; exactly one request/receipt creates one target-owned Run/Turn; temporary Grant ends absent
- Failure condition: Phase-A positive token, retained unauthorized Grant, replacement main, alias, retry/second receipt, missing/duplicate Run/Turn, source-owned execution, leakage/external delivery/ping-pong, or inconclusive target-bound evidence.

### ACC-DEP-005 — Failure and rollback

- Contracts: `CTR-DEP-008`
- Method: inject non-secret staging and D/E failures in rehearsal; verify file rollback plus separately authorized Grant compensation
- Environment: isolated rehearsal; production only if a real authorized apply fails
- Required evidence: injected-failure transcript, rollback hashes/metadata, six-path deletion list, restart/health receipt, compensation authority and Grant-absence readback, preserved audit evidence
- Expected result: zero partial face; exact preimage/metadata restoration, healthy baseline, and temporary Grant absent
- Failure condition: mixed face, metadata drift, unauthorized/missing compensation, retained Grant, deletion outside six paths, missing health, or lost evidence.

### ACC-GOV-001 — Authority lifecycle

- Contracts: `CTR-GOV-001`
- Method: independent exact-head semantic review, current-main/17-path drift recheck, Owner acceptance, allowlisted lifecycle diff, final-head recheck
- Environment: isolated docs branch against current authority branch and pinned auth external head
- Required evidence: reviewer identity/verdict, Owner authority, exact allowlist diff, non-allowlisted digest, current-main and 17 source/production path proofs, external-authority proof, `SEMANTIC_DELTA=NONE`, `FINAL_HEAD_RECHECK=PASS`
- Expected result: accepted/contracts/contracts and README lifecycle cells only; exact accepted head remains unchanged until merge; no production mutation
- Failure condition: any non-allowlisted byte, inconsistent provenance/value, drift, changed head after recheck, missing Owner authority, or pre-merge action.

## 11. Alternatives and disposition

- `ALT-DEP-001` — Deploy current `github/main` wholesale: REJECTED; it couples later Scheduler work.
- `ALT-DEP-002` — Treat missing audience as a Grant-only issue: REJECTED; issuance rejects first.
- `ALT-DEP-003` — Reuse `agent-wake` audience/scope: REJECTED; obsolete product and wrong authority.
- `ALT-DEP-004` — Publish aliases: REJECTED; canonical identity is closed and exact.
- `ALT-DEP-005` — Deploy before Auth then test later: REJECTED; violates serial fail-closed Gates.
- `ALT-DEP-006` — Create an auth-service change from this repository: REJECTED; cross-repo authority gap.

## 12. Migration, compatibility, and rollback

There is no Session or credential migration. Existing behavior is preserved. The six new paths are valid only within the complete face. Rollback restores eleven blobs with recorded metadata, deletes only six `ABSENT` paths, restarts once, and proves baseline health. The target canonical main is reused and never migrated. Auth rollback and temporary-Grant terminal compensation belong to separate accepted authorities and MUST NOT be improvised here.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
CURRENT_STATUS = accepted
IMPLEMENTATION_AUTHORITY = contracts
PRODUCTION_APPLY_AUTHORITY = contracts
AUTH_AUDIENCE_AUTHORITY = MISSING_EXTERNAL_PREREQUISITE
AUTH_AUDIENCE_DEPLOYMENT = MISSING_EXTERNAL_PREREQUISITE
AGENT_CORE_RELEASE_ARTIFACT = NOT_BUILT
GRANT_SUPPLY = NOT_AUTHORIZED
GRANT_TERMINAL_DISPOSITION = ABSENT_AFTER_CANARY_OR_FAILURE_UNLESS_SEPARATE_ACTIVATION_AUTHORITY
RUNTIME_HEADER_PROOF = NOT_RUN
A2A_CANARY = NOT_RUN
PRODUCTION_CHANGE_THIS_ROUND = NONE
```
