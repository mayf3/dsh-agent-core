---
spec_id: HR_FIXED_S256_MAINTENANCE_INSTALLATION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
owners: [mayf3]
governed_by: [HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V1]
external_authorities:
  - fixed s256 R2 accepted operation profile 35dbaeb6938c81f3101506efd42d065caf4ea7ad47010a52e5a906bb5c252a7c
supersedes: []
superseded_by: null
scope:
  - fixed s256 same-DS maintenance-installation phase only
owner_direction: accepted 2026-09-26; exact authored Spec review/activation pending
owner_acceptance_sha256: 9c6dc608e50340046a61df4e6d4e3a59e17856349c82a94f1c7dced3a91e06bf
owner_decision_candidate_sha256: 08334543fe980f6da7b95c5ef958e0eb068b02e2ff52d2c5d58e306e5c55467b
---

# HR_FIXED_S256_MAINTENANCE_INSTALLATION_V1

## Decision and boundary

This standalone additive amendment defines ONLY installation of the fixed HR
candidate under the same DS's maintained canonical custody/inhibition, before
the existing one-use private startup. It leaves the accepted r4 body, R2 cut
operation, V2 consumer/replay commitment, and MF1 staging contracts unchanged.
In particular the cut still never writes app/config/plist bytes. Historical
texts, acceptance records and seals are not rewritten or partially superseded.

Owner mayf3 accepted A1–A4 of the immutable decision candidate on 2026-09-26.
That authorizes this narrow amendment, nonproduction implementation/tests and
the same independent reviewer's changed-surface review. It authorizes NO live
read, install, bootstrap, restart, recovery, fence clear or compiled activation.
This proposed text needs exact-head independent review and authority activation
before implementation relies on it; accepted direction is not source review.

The fixed subject remains
`turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256`, agent `agt_hr-agent`.
The recovery operation remains `hr-s256-trusted-quiescence-cut-20260925-v1`.
The existing installation publisher identity and two-field recovery request
remain unchanged. There is no generic installation/defer-restart action,
caller-selected path/ID/manifest/custodian, new caller, credential or grant.

## Typed identity observation

The signed candidate's A1/R1 calls `873393…` an app digest. Its frozen INPUT-PINS
and publisher package identify those bytes as a **daemon**. Root's attributable
technical ruling resolves this as a factual type correction within accepted
scope, not a changed target or new acceptance. Preserve the signed text verbatim.

| Object | Exact identity | Role |
|---|---|---|
| HR staged app338 | DS tree digest `05607ce1e384b11984c163b138dabac9d7655abe5665ccc224a40a97f6c6617a` | reference candidate; not current-host preimage |
| Retained current daemon | `908941f28a851d4a323be1870b6e8e9a6c29da841b7706817f0d9189557987cb` | composition base; V5/E7 preserved |
| Retained client | `88505ceb28ef360e01777ae128a4bf2b8cc92002f35428014c4c6163e1a3c76c` | unchanged |
| Publisher predecessor daemon | `8733931a082171ee2b32b9dafc5ec5f4851782965a1c38e9f365f5416a2a8e27` | immutable historical output, not app |
| Reviewed F228 repaired daemon | `089e1763ab3b21388a4ff750635d9a1ae2dd86b9b145953276348edfc5581cf4` | pre-amendment composition |

Any new amended daemon has its own frozen/reviewed output identity. None of
these identities grants installation. The app identity uses the retained DS
tree-manifest algorithm, never a daemon digest or path-map hash. Binding an
input of another object type must fail before promotion.

## Contracts

**MI-C01 — Fixed installation effect.** Only the exact reviewed app and the two
existing routes `gui/505/ai.agent-core.runtime` and
`system/ai.agent-core.runtime` may be promoted by a private same-DS installation
seam. Preserve current V5/client/E7, DS_UPDATE allowlist, registry, public API,
request/subject, unrelated source bytes and existing route topology. No whole
old-daemon replacement, arbitrary command/path API or registry reinterpretation.

**MI-C02 — Entry closure.** Both routes use the reviewed gated entry as their
sole runtime ProgramArguments target, with every other supervision/topology
setting preserved. The ordinary entry is the reviewed
`HR_UNGATED_ENTRY_RETIRED` stub. Reject extra/missing/wrong routes, wrong entry,
wrong app/daemon type, unknown base, changed candidate or topology before effect.
Candidate staging is not installed source closure or LE1 proof.

**MI-C03 — Preconditions and custody.** Default unqualified/unbootstrapped
configuration is inert before protected IO. Before promotion require exact
trusted package/base bindings and maintained private canonical/window ownership
and applicable inhibition. Preserve causally independently justified deployed
floor, validator-before-producer/stop and compatible rollback prerequisites.
Never mint these facts from current bytes, timestamps, caller PASS, point census
or synthetic metadata. Unknown preconditions reject zero-effect. Recheck owned
custody/inhibition across effects; loss is sticky UNKNOWN, not release permission.

**MI-C04 — Durable truthful installation.** Reserve durable UNKNOWN in the
existing fixed installation receipt namespace before any promoted byte, with
closed strictly typed receipt validation. Use root-custody/no-follow fixed
outputs and ancestors, bounded exact bytes, file and parent fsync, and pre/post
identity/hash readback. A completed promotion is `INSTALLED_WAITING`, never
ordinary DEPLOY `HEALTHY`/`COMPLETE` or recovery success. A crash/torn write,
race, mismatch or incomplete publication retains UNKNOWN and actual partial
outputs; no claim of multi-file atomicity or automatic rollback is permitted.

**MI-C05 — No premature launch.** The installation phase issues no ordinary
bootstrap, restart or health-success path. Existing ordinary DEPLOY remains
unchanged and cannot consume `INSTALLED_WAITING` as COMPLETE. Only after exact
promotion/readback and continuous custody/inhibition may the private phase
handoff reach the existing one-use authenticated startup with nonce/window FD.
This amendment adds no launch or evidence protocol. Descriptorless gated entry
and retired ordinary entry reject before Router import.

**MI-C06 — No replay and honest UNKNOWN.** No repeated promotion, retry, second
launch, auto-release or repair of reserved UNKNOWN is allowed. Completed
reattachment is read-only and must reverify promoted app/routes and the existing
four publisher artifacts/closed receipt; any drift disables handoff/activation.
Preserve known child, actual observed durable state and owned custody. Deadline
expiry stops active execution without proving safety release. Existing bounded
UNKNOWN custody and original phase budgets remain unchanged.

**MI-C07 — Qualification and effect separation.** Compiled trust/activation and
OPERATION_ALLOWED remain unset for this nonproduction increment. No synthetic
result becomes current preimage, installed inventory, floor/validator proof,
rollback, LE1, sourceClosureComplete, child_real_exit or H2–H6 actual credit.
H5 is actual fence AND owned Runtime admission readback; H6 is completion of one
genuinely NEW HR request with attributable native/Broker outcome, max attempts
one and no old-turn replay. Actual installation and the cut require a separate
exact ordered production mandate; this authority does not supply it.

## Acceptance matrix

Every row uses disposable filesystem/command-cell fixtures under process hard
denial before imports/setup through teardown. No host adapter or real process
is invoked. Required evidence is exact-head executed RED/GREEN logs, effect
sequence and byte/digest readback; synthetic success is not host proof.

| Acceptance | Contracts | Method and expected result | Failure condition |
|---|---|---|---|
| MI-ACC-R1 | C01–C03 | actual current-daemon composition; typed app/tree/daemon/client drift rejects before promotion; unchanged base strips back byte-identically | confused digest accepted, V5/E7/client change or any promoted byte on precheck failure |
| MI-ACC-R2 | C01–C02 | both fixed rendered routes select exact gated target; unrelated topology preserved; extra/missing/wrong route or retired entry drift rejects | wrong route/entry/topology accepted |
| MI-ACC-R3 | C04,C06 | sequence oracle: UNKNOWN reservation before effects, strict version integer, no-follow/fsync/readback; torn write/crash remains UNKNOWN with honest partial state | activation/installed-success after incomplete write, false multi-file atomic claim or replay |
| MI-ACC-R4 | C03–C04 | owner/mode/ancestor/symlink/directory race and lost custody/inhibition negatives; no further route effect after observed loss | unsafe output or continued effect after loss |
| MI-ACC-R5 | C04,C06 | second invocation/foreign or boolean-version receipt/UNKNOWN reject; valid completed reattachment read-only | replay/rewrite/new launch or bool-version accepted |
| MI-ACC-R6 | C03,C06 | tamper each existing publisher artifact and promoted app/route before handoff; reject and activation unavailable | cached prior success authorizes changed bytes |
| MI-ACC-R7 | C05,C07 | actual confined assembled sequence; no ordinary startup/health cells; descriptorless parser rejects; waiting state never COMPLETE | premature startup, fabricated live proof or ordinary DEPLOY success substituted |

Reuse accepted publisher12, profile, fixed-IO/private-admission18, Node9 and
repinned independent36 fixtures as directed by A3; bind new results to the
new frozen head, without reopening closed H5/F228 reviews. Same reviewer checks
only this amendment and affected implementation/evidence. No additional gates,
historical scan or generalized source/host hardening are included.
