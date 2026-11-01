---
spec_id: AGENT_CORE_D14_FLEET_GENERATION_SUCCESSION_V1
status: proposed
acceptance_status: ACCEPTED-under-Owner-D14-directive-20261101
acceptance_status_scope: semantic direction A accepted by supplied Owner directive; exact-byte acceptance and lifecycle activation pending
spec_kind: program
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-11-01
scope:
  - atomic whole-authority D14 generation succession and four complete replacement Specs
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3
external_authorities:
  - repository: mayf3/dsh-codex
    authority_id: DSH_CODEX_SHARED_AUTH_PROTECTION_RESTORE_V1
    revision: 7cfa139e111956a7193622afc734126b52d7bf07
    relation: constrained_by
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# D14 fleet generation whole-authority successor transaction V1

## 1. Goal

Accept direction A's exact `gen-032-20261031-123906 / dsh-codex@0.3.2` as the legitimate fleet
plugin version, and prevent a rollout from leaving admission on an independently pinned version.
All directly conflicting authorities are disposed of together through four complete successors.
The fleet generation selection applies to ordinary fleet `gpt-5.6-luna` artifact admission. The
separately retained dormant GPT6 tuple is excluded from automatic migration and cannot use gen-032
as a substitute for its exact derivative.
This coordinating Program grants no implementation authority; the four implementation Specs
incorporate CTR-D14-001–008 as their common requirements after the atomic acceptance transaction.

`acceptance_status = ACCEPTED-under-Owner-D14-directive-20261101` is the requested Owner-direction
designation. It does not invent acceptance of bytes not yet reviewed. Formal lifecycle is
`status: proposed`, and `AUTHORITY_ACCEPTED_IN_BASE=NO`. Until exact-head Owner acceptance,
reciprocal lifecycle updates and merge to main, the old authorities remain active. This is a
reviewable draft of that transaction, not a declaration that the transaction has occurred.

## 2. Scope and non-goals

Task authorization: Owner 2026-11-01 D14 version-alignment and deployment-process repair directive,
direction A already ruled by supervision, and this explicit docs-only task. Persistent incident:
[agent-control#1345](https://github.com/mayf3/agent-control/issues/1345) and its
[R3 stopping record](https://github.com/mayf3/agent-control/issues/1345#issuecomment-6550903952).
This request authorizes authoring, independent review, commit/push, a main-targeted PR and the
specified issue backfill. It does not grant production effects in this task.

Allowed tree delta: new files in `docs/specs/` and `docs/evidence/` only. No product source/tests,
production branch, home/current, credential, process, permission, business message or deployment
change. D13 is outside scope. Direction A is not reopened. The 117 current-linked homes are not
rolled back by this task. The rollback Contract below specifies a future controlled failure path.

## 3. Authority, coordinates and acceptance transaction

```text
REPOSITORY = mayf3/dsh-agent-core
WORKTREE = /tmp/proddsh-d14-fix
BRANCH = ac-d14-successor-spec
BASE_HEAD = 3a1282b35e7b852f51cd14284ea91fd77a13543e
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = SUPERSEDE
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_ALLOWED_NOW = NO
OPERATION_ALLOWED_NOW = NO
```

Product Architecture's thin-runtime, per-Agent ownership and credential custody remain. Current
Decisions D-008/D-009 keep Session selection, UNKNOWN, effect fences and no-replay meaning.
The direct conflict is `D14-R3-AUTH-001 / SPEC_GAP / LOAD_BEARING`, independently frozen in
[PR600](https://github.com/mayf3/dsh-agent-core/pull/600). Runtime observations and that review do
not themselves replace any accepted Contract. Each successor below restates the complete owning
authority rather than leaving readers to merge old clauses with an overlay.

### SUPERSEDES whole-authority mapping

| Whole old authority | Complete successor in this transaction | Treatment |
|---|---|---|
| `AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3` | [SCA V4](AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V4.md) | all 17 protocol Contracts and full acceptance/rollback/bootstrap definitions carried; selected artifact identity replaced |
| `DEFAULT_MODEL_ROUTING_CONFIG_V1` | [Default V2](DEFAULT_MODEL_ROUTING_CONFIG_V2.md) | complete default/precedence/observability/acceptance; artifact tuple becomes same-generation input |
| `AGENT_CORE_GPT6_LUNA_REASONING_ROUTE_V1` | [GPT6 V2](AGENT_CORE_GPT6_LUNA_REASONING_ROUTE_V2.md) | explicit ordinary-fleet identity migration; exact dormant GPT6 derivative remains independently dormant |
| `AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V2` | [Reconciliation V3](AGENT_CORE_AUTHSVC_SHARED_CODEX_ACTIVATION_RECONCILIATION_V3.md) | all A1–A4, cohort/transaction/acceptance rules; D14 reuse requires newly bound installer/marker identity |

This Program's empty `supersedes` is intentional: its four peer successors carry whole old IDs
in their own metadata. No fragment ID is superseded independently.

### D14-DOCS-LIFECYCLE-001 — concrete activation conflict

`.agents/local/README.md` prohibits new partial supersession, and
`.agents/protocol/SPEC_FORMAT_V0.md` §2.7 requires: “backlinks change atomically in the same docs-only
change.” Old authorities must become `status: superseded` with `superseded_by` equal to the
respective successor. Owner acceptance must bind reviewed content and final accepted head.
The task's additions-only restriction forbids those old-file mutations. No new manifest can stand
in for them. Therefore this draft has **AUTHORITY_ACTIVATION_READY=NO**, not a self-certified PASS.

The concrete later mechanical lifecycle skeleton is prepared as
[atomic-activation.patch](../evidence/d14-successor-spec-20261101/atomic-activation.patch), unexecuted.
It changes only old lifecycle metadata and the existing index, plus proposed→accepted on the five
new Specs. Applying it requires scope covering those existing docs and exact-head Owner acceptance;
review-record digest/head/time provenance must then be recorded with the actual values. No patch
here fabricates that acceptance. A later authority branch move requires affected-impact recheck.

## 4. Current State

STATE-D14-001: at main `3a1282b3`, four direct authorities still require old artifact semantics;
expected0.2.3 + gen-032/0.3.2 must reject. Basis OBS-D14-002/EVD-D14-002. In this authoring branch,
replacement candidates exist; none is an accepted authority in the production implementation base.

STATE-D14-002: PR599's filesystem observation is frozen at `2026-10-31T23:24:37.921830+00:00`.
117 readable homes resolve current→gen-032, among123 readable packages (6 were0.2.3). This is not
registry membership, 118 historical rollout receipts, loaded-process proof or business acceptance.
No live production reread is performed in this docs-only task.

## 5. Observations

OBS-D14-001: [PR599](https://github.com/mayf3/dsh-agent-core/pull/599), exact head
`6750b8dc8adeb228796cd8fd2c7d865ce989b9a3`, records source/build/archive and four-home readbacks.
Method: prior authorized metadata/provenance audit and14,299 archive regular-file byte comparisons;
result mismatch=[] for that set. It does not cover extra files, modes or runtime acceptance.
Byte-exact source copies and original hashes are in
[source-inputs.json](../evidence/d14-successor-spec-20261101/source-inputs.json).

OBS-D14-002: PR600 exact head `857e0f0d29c5837ace7ee40f0f121c67cbbca0b6` records production parent
`1921f8795e2212506a7a833bc79b84c17ba50ea1`, same direct authorities as main, and independent
`D14-R3-AUTH-001`. It explicitly leaves full new Harness/dependency tuple and Core admission
combination compatibility UNKNOWN/NOT_EXECUTED. Its baseline938 tests (867pass/62fail/9skip,
exit1) establish baseline consistency only, not D14 repair acceptance. No repeated test run or
production observation is claimed here.

## 6. Claims and assumptions

CLM-D14-001 / SUPPORTED: the task called “0.2.5-r3” built the genuine0.3.2 main artifact, not a
four-home independent upgrade. Basis EVD-D14-001. Historical writer identity and118 rollout receipts
remain UNKNOWN; this inference cannot authorize a current operation.

CLM-D14-002 / SUPPORTED: direction A needs whole-authority succession before dependent implementation.
Basis EVD-D14-002 and accepted governance. All R1/R2/R3 PASS would still not satisfy mutually
exclusive0.2.3/0.3.2 version identities.

CLM-D14-003 / OPEN_ASSUMPTION as execution fact only: the exact gen-032 artifact can satisfy all
Core combination and current-document/recovery checks. This is not assumed for eligibility:
CTR-D14-003/004 make missing proof a hard refusal. No normative choice is left to guess.

## 7. Evidence relations

| Evidence | Source observation → target | Coordinates, sufficiency and limits |
|---|---|---|
| EVD-D14-001 / SUPPORTS | OBS-D14-001 → CLM-D14-001, STATE-D14-002 | PR599 exact head and observation time above; strong for source/archive/home identity only; not process-loaded identity or protection execution |
| EVD-D14-002 / SUPPORTS | OBS-D14-002 + original clauses → CLM-D14-002, STATE-D14-001 | main3a1282b3 / production1921f879 / PR600 review; sufficient for concrete semantic conflict, not new acceptance |
| EVD-D14-003 / SUPPORTS | OBS-D14-001/002 → compatibility UNKNOWN | same source coordinates; external restoration explicitly disclaims full Core compatibility/admission; no production credential contents read |

## 8. Decisions and exact old/new clause disposition

DEC-D14-001: Owner direction A selects gen-032/0.3.2 as the legitimate fleet plugin version. It
replaces the old normal-fleet0.2.3 compatibility restriction; it does not approve arbitrary later
versions, current disk state as authority, a GPT6 switch or any production operation in this task.

DEC-D14-002: supervision's already-selected direction is implemented through one whole-authority
transaction. All retained safety obligations remain binding. No pin/guard removal or per-home
credential fallback is permitted.

Original quotations below are from main3a1282b3. The complete exact source blocks with line ranges
and whole-file SHA-256 are in [original-clauses.json](../evidence/d14-successor-spec-20261101/original-clauses.json).
The mapping covers changed Decisions and Acceptance, not just the two headline Contracts.

| Original source and verbatim clause | New meaning and retained constraint |
|---|---|
| SCA CTR-SCA-002: “The dsh-codex 0.2.3 compatibility line MUST add:” | CTR-SCA4-002 requires selected0.3.2 Loader/apply credentialFile passthrough; optional nonshared default and canonical shared-mode prohibition remain |
| SCA CTR-SCA-004: `plugin compatibility line = 0.2.3`; “Any mismatch MUST prevent that child from starting or admitting a Luna request.” | CTR-SCA4-004 checks exact accepted generation plus canonical identity and compatibility proof; mismatch rejection remains, expected input changes |
| SCA CTR-SCA-013: “package compatibility version remains `0.2.3`”; “No later dsh-codex feature/version may enter incident recovery by implication.” | CTR-SCA4-013 explicitly selects0.3.2/source/archive; honest source/stamp and recovery exclusion remain; no later version implied |
| SCA §0/§1/§2 compatibility literals, DEC-SCA-002 “Reuse the 0.2.3 store and refresh implementation”, ACC-SCA-011 “compatibility line 0.2.3 with honest distinct build” | §0/§1/§2 and DEC/ACC-SCA4 namespace select0.3.2, retain complete lock/intent/Owner recovery protocol and update source acceptance identity |
| Default §2: “复用 `CHATGPT_SUBSCRIPTION_V1` 冻结身份（`dsh-codex@0.2.3` exact pin + canonical credentialFile + sourceCommit/artifactSha256/dshVersion/dshCommit）” | Default V2 §2/§9 requires same-generation full identity; provider/model, explicit precedence, canonical custody and fail-loud/no silent fallback retained |
| GPT6 CTR-G6R-001: “MUST remain byte-equivalent to the pre-change source”; “MUST NOT globally replace the V3 plugin pin” | CTR-G6R2-001 allows only explicit D14 ordinary-fleet artifact identity migration; absent effort, provider/model/credential/proxy/order preserved; stale unconverted pin rejects |
| GPT6 CTR-G6R-002: “preserve the V3 `dsh-codex@0.2.3` artifact identity for legacy routes” | ordinary fleet becomes exactgen-032 after controlled migration; dormant GPT6 stays distinct, never satisfied by gen-032 |
| GPT6 DEC-G6R-002/003: `pluginVersion = 0.2.3-dshr1`, source `42f14343e1506d7d06216d7fa580cae5161001dc` and archive `160bbefcc8ebe8a1a2c966ec89cdc3a723c0a0ef8cb90fe121772b18970830b5` | RETAIN whole exact dormant tuple including patch/source-stamp/pi-ai0.87.1/Harness rc.8 hashes; no GPT6 activation or reasoning graft to gen-032. ACC-G6R2-001/002/005 and §7 reflect separation and qualified rollback |
| GPT6 §7: `CURRENT_PRODUCTION_TARGET_REMAINS = gpt-5.6-luna / dsh-codex@0.2.3`; `ROLLBACK = restore legacy V3 tuple; no credential mutation` | ordinary target after D14 gates is gen-032/0.3.2; rollback is full qualified generation+descriptor, never label-only downgrade or credential mutation |
| Reconciliation A1: “Rebuild from the already accepted plugin source commit `75d98d5b10bb926d53108e49019668c1bde2a9eb`; this proposal does not authorize a new source pin.” | A1 explicitly accepts D14 gen-032/source/archive only in a newly bound D14 invocation; existing B7 fixed packet is untouched |
| Reconciliation A4: “install the exact accepted plugin/dependency artifacts”; CTR-COHORT-004: “Use A4's normal own-domain provisioning and exact pin.” | same new descriptor/artifact/marker/consumed identity for D14; own-domain path, all A2/A3, fixed R/F, six cohort Contracts and all acceptance retained; no old-marker reuse |
| Reconciliation CTR-COHORT-001: “The only configuration delta in `F` is v2-to-v3 schema version plus own-domain canonical `credentialFile`” | CTR-COHORT3-001 keeps original restriction for original B7; separately bound D14 may explicitly migrate plugin identity only; no provider/model/effort/order/membership change |

Unchanged SCA Contracts001/003/005–012/014–017 and all their full Acceptance are restated under
SCA4 IDs. Changed002/004/013 use new IDs and revised acceptance. Default ACC-D1–D7 remain and D8
adds identity tests. GPT6's six Contracts/seven Acceptance and Reconciliation's six cohort
Contracts/six Acceptance are restated under new namespaces, with the explicit changes above.
Old globally qualified stable IDs keep their original accepted meaning in historical files.

### Additional accepted-authority inventory and disposition

| Authority / exact scope | Disposition |
|---|---|
| `AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V2`, external pin75d98d5b, §3 and CTR-ACT2-002/005 exact artifact receipt | **RETAIN** its original yanfenma/88-member bounded activation packet. D14 authsvc does not execute/rebind this path or substitute gen-032 for its artifact. Any such reuse needs a complete successor first; not a silent fifth amendment |
| Activation V1's authsvc reserved operation scope, retained explicitly by Activation V2 §3 | **RETAIN** that historical bounded scope, not blanket current deployment authority. D14 does not inherit its apply permission or mutate its packet |
| `AGENT_CORE_B7_FIXED_FRESH_SIX_TARGET_OFFLINE_CARRIER_V1` C-FRESH-1/2 and catalog0.2.3/archive869b8e…; `AGENT_CORE_B7_FIXED_OFFLINE_CARRIER_CONTINUATION_V1` | **RETAIN** distinct fixed six-target offline candidate, original writer/inputs and operation restrictions. D14 does not rebuild/admit that candidate, replace its pin or claim its acceptance |
| Reconciliation V2's accepted B7 E31/E32/E33 elaborations | **RETAIN** their original bounded candidate/transaction conditions; no D14 execution, old packet or unresolved permission is converted into D14 eligibility |
| Reconciliation capture-admission amendment | proposed only, **NO_AUTHORITY_RELIANCE** |
| SCA V1/V2, Provider/Proxy and Ordered-route superseded ancestors | **HISTORICAL_EVIDENCE**; no resurrection, no second active version classifier |
| External `DSH_CODEX_SHARED_AUTH_PROTECTION_RESTORE_V1` | **RETAIN** every R1/R2/R3 obligation; Core cannot supersede it or claim its restoration PASS is Core admission PASS |

This is a bounded inventory of version/identity obligations reachable from D14, not a global corpus
re-audit. If D14 execution discovers a real consumer of a retained fixed operation path, stop that
dependent reuse and re-PREFLIGHT; unrelated authoring can continue.

## 9. Contracts

### CTR-D14-001 — selected exact tuple and honest unresolved proof

The new legitimate fleet plugin identity MUST be:

```text
generationId = gen-032-20261031-123906
plugin = dsh-codex
pluginVersion = 0.3.2
sourceRepository = mayf3/dsh-codex
sourceRef = refs/heads/main
sourceCommit = 7cfa139e111956a7193622afc734126b52d7bf07
sourceTree = 5f144d38a10eb40ce5cf33c597a72a81bd21e537
archiveSha256 = 8755ae67673ddc08ba7511a8b11582151763972cb5c00e733f4e94f87717daf2
packageJsonSha256 = f9a6ea3e647901ea1f6b218bc27aa2e3cd9ff9a9579b9036489a12354363f5bc
dependencyTreeDigest = 119f74e67b61a1ecace6219ebcf7f2df8874ce71d27cc2170d8e91667d1990b0
dependencyFileCount = 14224
dependencyArchiveSha256 = c994dff1b4ec771cb955ccb109a1100a9be4c71835308eac9c5b70d25c2e1abc
frozenLockSha256 = 6dd2d6f923b3ceb2714223c62f7c76ebf50861c4ad06dfeb5d616090db5034b6
FULL_HARNESS_VERSION_COMMIT_AND_RUNTIME_CLOSURE_PROOF = UNKNOWN / REQUIRED_BEFORE_ADMISSION
CORE_COMBINATION_COMPATIBILITY_PROOF = UNKNOWN / REQUIRED_BEFORE_ADMISSION
```

The known tuple accepts this artifact identity, not an unproven Harness or executable configuration.
The immutable descriptor MUST bind the actual Harness version/commit, dependencies/closure,
accepted authority coordinate, protection/compatibility evidence and its own digest before admission.
The actual Harness identity must be recovered from this exact candidate's provenance and proven;
old rc.8 identity cannot be invented as the new value. Missing fields/proof mean refusal. Adding the
verified actual identity to the execution descriptor cannot silently change accepted plugin bytes;
any candidate source/archive/meaning change requires re-PREFLIGHT.

### CTR-D14-002 — one trusted generation source and coherent transaction

Admission expected identity MUST derive from the accepted immutable generation selected by fleet
`current`, or be updated atomically with that same rollout transaction. Independent constant pinning
is forbidden. `current` is a selector, not authority: only a descriptor anchored to the accepted
source/archive and reviewed release evidence in the controlled trust domain is eligible. A root-owned
link or self-reported disk package.version alone does not establish trust.

Default, explicit catalog, provisioning/rebuild and running-child reuse MUST consume one generation
snapshot. Actual loader/import paths MUST remain bound to that immutable generation through admission
and dispatch (a retained immutable path or equivalent switch exclusion), with boundary readback.
Missing/unaccepted generation, stale catalog pin, descriptor/hash/closure mismatch, changed current/home,
mixed snapshots or wrong loaded child identity MUST fail closed before dispatch. No fallback to old
constants, per-home credential, alternate provider or guessed artifact. Admission MUST NOT stamp,
install, repair peers or mutate the shared generation along home symlinks. Release switching and
rollback MUST update selection/expected/config identity coherently and keep failed mixed state closed.

### CTR-D14-003 — R1/R2/R3 remain load-bearing

Production acceptance MUST prove, against this exact0.3.2 artifact and actual Core wiring:

- R1: real Loader/config/apply→service→store passes canonical credentialFile; absolute identity,
  every component non-symlink, single-link regular credential/intent, private parent and owner-only
  modes; no per-home fallback; normal nonshared default retained only outside shared mode.
- R2: canonical-filename cross-process lock, lock-internal reread, durable pending intent before
  callback/network dispatch (file+parent fsync), atomic credential commit durability then durable
  intent removal. Same generation allows at most one synthetic refresh; waiters never refresh again.
  Preserve decode/update, idToken/email/other provider fields, concurrent-edit detection, proxy,
  policy/settings/usage-cache behavior and stable REFRESH_IN_PROGRESS identity.
- R3: same-generation pending intent rejects before read/use/refresh, no old-token retry; validate
  replacement document and permissions before controlled intent clear with zero refresh. Owner recovery
  uses actual authorized login entrypoints (service/Web/CLI coverage accurately attributed), never
  automatic refresh scope. Preserve redacted stable error identity across store/usage/root exports
  and existing401/403 handling. Lock age alone cannot remove a lock.

### CTR-D14-004 — current document, intent and recovery compatibility phase lock

```text
IMPLEMENTATION_PHASE_PREREQUISITE = COMPATIBILITY_PROOF
PHASE_LOCK_SCOPE = production admission acceptance and implementation delivery as admissible
```

Before production admission can accept0.3.2, the implementation phase MUST produce coordinate-bound
R1/R2/R3 and current credential-document/pending-intent/explicit Owner recovery compatibility proof.
Use synthetic representations of current document shapes, preserving established fields, with
same-generation pending, valid/invalid replacement, crash/durability and cancellation/proxy fixtures.
No real credential read or mutation is authorized to fill the proof. Unknown/failed proof keeps
production acceptance NO. This gate does not prohibit isolated implementation/fixtures needed to
obtain the proof after accepted authority is in base. Build success/version equality is insufficient.

### CTR-D14-005 — controlled migration without collateral agent changes

The later exact mandate MUST bind production line, active single writer, entire shared-current impact
set, registry/effective routes, home/current/config preimages, actual workers/dispatched effects and
fresh descriptor. The four named homes are initial business targets, not the entire affected fleet.
Current-linked117 is an observation to reconcile fresh, never a fixed registry or success count.
Migrate obsolete explicit version fields intentionally in the same release snapshot. Preserve
provider/model/order/effort/credential domain and existing ac1159 fixes. Do not replace production
compose wholesale with main, roll back117 homes as the default repair, or execute an old B7 packet.

The artifacts-watchdog's reachable120-second directory→current-link behavior MUST be accounted for
in the operation's writer/exclusion and rollback plan. Script existence is not live-daemon or
historical-writer proof. Unknown old worker/tool effects, business outcome and fences remain UNKNOWN;
software alignment never authorizes replay, fence deletion or fabricated message success.

### CTR-D14-006 — ordered readiness boundaries

Required order: **Spec atomic acceptance into main → import accepted authority into existing production
implementation line → isolated implementation → exact compatibility proof → regulator acceptance →
controlled publication**. No phase may promote a source/review/build result to installation, loaded
runtime or business acceptance. Later operation must use its valid exact mandate/runbook, actor,
window/attempt, protected preimages, abort controls, rollback and receipts. This task grants none of
those live effects. The four successors and their common gates must activate together.

### CTR-D14-007 — one standard reversible rollback

One standard rollback transaction MUST restore a previously qualified complete generation and its
matching expected descriptor/config pin, plus only the recorded owned home-link/software/config
preimages. Order: stop new affected admission; establish actual worker/tool/refresh quiescence or
accepted effect rejection; preserve UNKNOWN/fences; take the same writer/mutex; restore matching
immutable target and descriptor (and authorized home links) coherently; read back current→generation,
source/archive/closure, each scoped home and effective expected identity; restore only authorized
runtime; run the authorized new-request canary and obtain terminal receipt. Watchdog must not undo
restored links. A failed/mixed rollback keeps admission closed and uses same-transaction recovery;
no blind retry/new transaction after lost output.

A0.2.3 label alone is never a qualified rollback target. The accessible old archive869b8e… has only
hash/version proof, not full R1/R2/R3/current-document/intent/Owner recovery compatibility. The old
runtime constant archive2d29f95… is a different coordinate. Before choosing either, prove exact
source/archive/Harness/closure, retained protections and current reader/recovery compatibility and
bind it in the rollback manifest. Without a qualified target, safe stop is quiesce/disable affected
Luna while retaining canonical evidence; it is not an unconditional downgrade. Never restore
credential lineage, clear pending intent, revive per-home writable stores, replay business or erase
fences as an effect of software rollback.

### CTR-D14-008 — exact docs-only acceptance and finite stop

This authoring branch MUST contain only new Spec/evidence files. Preserve source hashes and exact
original quotations, independent non-author four-authority completeness review and final-head delta
recheck. Current blockers/readiness must remain explicit. Completion of this task is the committed,
pushed draft PR and requested issue link, with truthful activation gap; not D14 runtime repair.
Any later atomic lifecycle patch requires the separately clarified old-doc scope and actual Owner
exact-head acceptance. Do not fabricate acceptance actor/time/hash or claim main has adopted a branch.

## 10. Acceptance

Definitions below are future checks, not executed results. No implementation/production test PASS
is claimed in this authoring task. Four successor files also retain their complete acceptance suites.

| Acceptance / Contracts | Method / environment | Required evidence / expected result | Failure |
|---|---|---|---|
| ACC-D14-001 /001 | exact provenance and artifact/closure audit; isolated released candidate | source/archive/descriptor/Harness/dependency coordinates match; protected external Spec digest retained; UNKNOWN blocks production | guessed Harness, label-only approval or unrelated artifact |
| ACC-D14-002 /002 | actual loader/provisioning/reuse fixtures, synthetic homes, switch race injection | before: old expected+new home rejects; after explicit migration and gates: accepted same snapshot succeeds; consistent tuple behavior retained; unknown gen/stale pin/mixed snapshot rejects; zero negative dispatch and payload writes | current grants trust, fallback, stamp write or mixed load |
| ACC-D14-003 /003 | real Loader plus independent10/20/50-process synthetic refresh and slow-writer/crash fixtures | R1 negatives; ≤1 remote refresh per generation; durable intent/commit/clear; pending UNKNOWN and stable redaction/error exports | token retry, per-home fallback, lost intent, missing entrypoint coverage claimed universal |
| ACC-D14-004 /004 | isolated current-document shapes and Owner login seams with fake provider | retained fields; pending rejects before use; invalid replacement preserves intent; valid recovery no auto refresh; actual front-door coverage and exact candidate hashes/logs | build-only evidence, current data incompatibility, credential read to prove compatibility |
| ACC-D14-005 /005 | controlled-operation preparation and isolated full-impact/readback fixtures | fresh explicit target/route/writer/effect/preimages; watchdog handling; existing production fixes and route semantics preserved |117 called registry/PASS, unknown effect cleared or production compose overwritten |
| ACC-D14-006 /006 | review stage records at each exact revision/environment | main acceptance, production-line import, implementation, compatibility, regulator then release recorded independently | phase skip or source PASS called production PASS |
| ACC-D14-007 /007 | one isolated standard rollback and failure injection; later authorized operation receipt | qualified whole generation+expected restored, exact home readbacks, intents/UNKNOWN/fences/credential lineage unchanged; unsafe old target refuses | pin-only rollback, watchdog reversal, false terminal or credential restore |
| ACC-D14-008 /008 | exact base/head docs manifest, source hashes/quotes, independent non-author review and final delta recheck | all changed paths added under allowed dirs; four complete dispositions; draft PR/issue readback; activation NO until missing transaction closed | old-file edit, missing authority, fake acceptance or fabricated execution |

## 11. Alternatives and disposition

ALT-D14-001: change one expected string / delete mismatch check — REJECTED; leaves catalog,
provisioning, child reuse and future rollout drift, violates exact identity/protection obligations.
ALT-D14-002: trust whatever current/package.version reports — REJECTED; observation self-authorizes.
ALT-D14-003: normal repair by downgrading117 homes — REJECTED by direction A; only a separately
qualified controlled failure rollback remains available under CTR-D14-007.
ALT-D14-004: promote dormant GPT6 derivative or alias it to gen-032 — REJECTED; distinct supported
capability/identity remains dormant. No permanent fallback/mapping layer is created.
ALT-D14-005: mark only two old clauses superseded — REJECTED; all four owners and extra fixed-pin
operations need the complete explicit disposition above.

## 12. Migration, compatibility, rollback and handoff

Implementation route after activation is REUSE against the accepted four-successor base. The existing
ac1159 writer imports authority first and changes only the required seams and direct fixtures.
Unknown full Harness identity and compatibility proof are hard execution gates; no payload or
credential edit belongs in this docs task. The one standard rollback is CTR-D14-007, with exact
operation binding later. Historical evidence and old candidates remain readable, never implicitly
eligible. The current PR must not merge as an active successor without closing lifecycle conflict.

## 13. Open items and stop boundary

```text
OPEN_OWNER_DIRECTION_DECISIONS = NONE (A already selected)
NORMATIVE_TBD = NONE (missing execution facts are defined refusal gates)
D14_R3_AUTH_001 = closure designed; not closed in main
D14_DOCS_LIFECYCLE_001 = OPEN / REQUIRED_GATE_FAILURE for authority activation
AUTHORITY_ACTIVATION_READY = NO
IMPLEMENTATION_ALLOWED = NO
PRODUCTION_ADMISSION_ACCEPTANCE = NO
OPERATION_ALLOWED = NO
DOCS_DRAFT_PUBLICATION_ALLOWED = YES
NEXT_REAL_ACTION = publish reviewed docs draft; obtain old-doc scope/exact-head acceptance for atomic activation
DONE_WHEN = five Spec candidates + exact source evidence + non-author review + commit/push/PR + issue link
EXPANSION_TRIGGER = newly reachable conflicting accepted version owner or actual provenance contradiction
```
