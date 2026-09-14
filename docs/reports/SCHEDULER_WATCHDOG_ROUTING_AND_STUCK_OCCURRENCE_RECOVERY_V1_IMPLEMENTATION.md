---
artifact_type: implementation_report
goal: SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1
spec_head: a8c763067a9b461a75669036dfade96a023f8864
integration_base: 68008e83142bdb637c4fa61c2a65db73c64b2eb1
implementation_code_commit: 225e6f5ef0ae819aa3437c5d90c52cf4cda99935
status: candidate_twelfth_exact_review_pending
production_mutation: false
---

# Scheduler watchdog routing and stuck occurrence recovery — implementation packet

## 0. Exact binding and authority boundary

This packet describes the candidate whose code commit is
`225e6f5ef0ae819aa3437c5d90c52cf4cda99935`, based on the accepted-Spec merge
`68008e83142bdb637c4fa61c2a65db73c64b2eb1`. The governing Spec bytes are the exact
accepted candidate `a8c763067a9b461a75669036dfade96a023f8864`.

No production store, occurrence, fence, incident state, route manifest, launchd service, current-six
row, or external notification was read or mutated during candidate implementation. Production
execution remains conditional on the gates in Spec §12.2–§12.4 and the Owner acceptance mandate.

## 1. Candidate implementation

| Contract | Implementation evidence |
|---|---|
| same-Job quarantine | `watchdog/reconciliation.js` implements the ordered evidence classifier; existing V3 settlement seams remain the only mutation path; no age/timeout release branch exists |
| root-cause incident | `incident-compiler.js` collapses paired unknown symptoms; `incident-lifecycle.js` owns exact root/episode state, closure and deterministic outbox keys |
| durable no-repeat | owner-aware locked atomic incident state and durable outbox in `durable-state.js`; attempt-start is committed before provider I/O; unchanged state creates no new intent; acknowledgment and recovery are mutually exclusive |
| route confinement | `routing.js` validates a closed deployment-owned manifest and resolves the three classes; control-plane incidents never inspect Job delivery or session/chat state |
| fail-loud delivery | `delivery.js` preserves the full 64-hex logical notification key and immutable producer/route/payload/provider binding; an ambiguous attempt remains `OUTCOME_UNKNOWN`; restart reads provider history and sends only after a complete readback proves the exact marker absent |
| canonical health | `health.js`, production `health-runtime.js`, authenticated Product API `/scheduler/health`, self-ops, and W1 consume the same projector; version, complete Job schema, unique identities, exact occurrence/fence authority, sources and SHA/store provenance fail closed |
| runtime readiness | production entry requires a complete canonical health snapshot before Scheduler admission starts; a Job-local block remains per-Job and does not become global startup failure |
| executable convergence | W1/W2 producer ownership prevents peer false-recovery; formal protected routing installer, frozen legacy migration CLI, and evidence-bound postdeploy finalizer are wired into reviewed executable paths; the finalizer uses authenticated canonical health plus one retained `delivery:none` canary through a closed Scheduler control op and cannot publish acceptance from caller booleans |

The admission script is exactly 500 lines after moving runtime restart, incident migration, and
fixture orchestration into focused modules. The
production compose file remains at its 503-line baseline through an equivalent focused extraction.
No structure exception was added.

## 2. Acceptance matrix

All Spec tests T01–T34 have explicit named coverage under
`packages/scheduler/test/watchdog/`, `packages/product-api/test/scheduler-health*.test.js`, and
`packages/production-runtime/test/scheduler/health-runtime.test.js`.

Key results:

```text
Scheduler/Product/Broker affected suite             847/847 PASS
focused twelfth-review blocker matrix                 59/59 PASS
focused Scheduler/deployment matrix                   51/51 PASS
combined affected/deployment run                     898/898 PASS
git diff --check                                PASS
vendored governance / accepted adoption         PASS
production admission fixture selftest           PASS twice, including resumable replay
T34 executable path census                      PASS
```

`npm test` is not a clean repository-wide signal in this checkout: it fails in unchanged packages
because `@larksuite/channel` is absent and the host uses Node 26.7.0 rather than the frozen native
closure. The same environment failures were present at baseline; no failing stack points to a
candidate Scheduler watchdog module. Focused candidate and Scheduler suites above are green.

The structure verifier at exact code commit reports only the inherited `scripts/` direct-child ceiling violation already
present when comparing base to itself. Candidate-introduced violations are zero: `compose.js` did
not grow, `scheduler-cp-admission.mjs` is no longer an over-500 touched legacy file, every new source
is below 500 lines, and no registry exception was introduced.

## 3. Safety properties for independent review

Review must bind to one exact commit containing this packet and answer Spec R1–R12.

- An unresolved `outcome_unknown` remains unchanged and contributes only to its exact Job fence.
- Reconciliation classification is zero-write; only the existing exact V3 settlement seam can
  settle trusted business or termination evidence.
- Aggregate fence release is derived after all exact Job contributions; settling one of two unknown
  occurrences does not release the other.
- Unknown, stale, conflicting, route, or cross-occurrence evidence cannot derive a terminal result.
- Incident facts, lifecycle state, notification intent, delivery readback and routing decision are
  separate structures.
- Local ops persistence is not treated as successful external delivery.
- Credential readiness is reduced immediately to per-Agent booleans; health exposes route target
  hashes/provenance, never secrets or raw destinations.
- Missing secondary health input keeps stable Job rows but forces `complete=false` and `UNKNOWN`;
  an unreadable Job authority yields null counts and no fabricated rows.
- W1/W2 share the exact incident-state authority with explicit owner/group coordinates while staying
  distinct failure domains.

### First independent review and closure

Both independent reviewers bound their first review to `091cb3b7863713741fe36b7c5e13b28c95909ca2`
and their second review to `a8ca511d44ca371390cdc978e34e027bda3f4b1c`; both rounds returned `REVISE`.
The current code commit closes their concrete counterexamples:

| First-review blocker | Revised exact closure |
|---|---|
| stale/conflicting evidence release | closed trusted-source set, exact epoch, bounded observation age, and termination/live plus business/live conflict quarantine |
| W1/W2 false closure/reopen | producer-owned incident closure plus alternating-role regression |
| crash-after-send duplicate or crash-before-I/O silence | durable immutable binding; `OUTCOME_UNKNOWN` remains eligible; exact provider-history marker yields MARK_DELIVERED, proven absence yields SEND, incomplete readback yields HOLD |
| false-green health | canonical occurrence validation, exact rebuilt fence equality, closed sources, exact SHA/store provenance, shared W1/self-ops projector |
| caller-injected migration evidence | closed evidence JSONL parsed from frozen protected bytes; conflict/duplicate/drift fail before commit; formal migration CLI |
| unsafe incident/sink persistence | no-follow owner/group/mode/ACL checks, owner-token dead-PID lock recovery, atomic replace, file and directory fsync |
| incomplete routing/deployment closure | exact Goal diff including deletions, protected routing candidate coordinates, formal migration phase, runtime/W1/W2 bootout-bootstrap, first-predecessor receipts, generation-safe rollback and resumable replay selftest |
| missing epoch / false-green malformed census | nonempty epoch is mandatory for every reconciliation decision; canonical health requires V3, full normalized Jobs, and unique jobId/logicalKey |
| peer outbox claim / double stale-lock reaper | outbox retry is producer-filtered; stale locks move atomically to a unique quarantine name before replacement publication, with a two-process regression |

The third independent review bound to `88d2f8a05a2588ba15fd2acf01bb8c61b817fbee`
returned `REVISE`. The fourth candidate closes its exact blockers:

| Third-review blocker | Fourth-candidate exact closure |
|---|---|
| rollback required future receipts and restarted too early | root-protected phase progress is the only mandatory authority; optional receipts generate a closed action plan; all disk preimages restore before runtime/watchdog bootstrap; phase-interruption matrix covers every optional receipt frontier |
| migrated W1 incident could be stranded under W2 | legacy migration derives and persists the canonical producer for both incident record and opening/recovery intent; regression covers pending and recovery delivery ownership |
| routing accepted unsafe ancestors or wrote through absent-target symlink parents | deployment validates the full ancestor chain to an explicit trusted boundary before target read/write; symlink-parent and world-writable-grandparent tests prove zero target creation |
| definitive provider rejection collapsed to unknown | transport adapter distinguishes pre-send/explicit rejection `FAILED` from ambiguous post-send loss; recovered runner reads complete provider history before resend and has a fake-adapter send-count matrix |
| canonical health could false-green recent failure | the production health projector itself derives terminal failure/stuck/unknown/missed facts; W1 consumes only the projector findings; runtime failure is one global canonical finding while each otherwise-ready Job degrades |
| user-writable deployment receipts and cutover race | control receipts, rollback preimages and sealed operator generations live under the root-only control directory; admission quiesces W1/W2 before backfill, overlay, routing or migration and asserts that ordering in the replay selftest |

The fourth exact-head review of `63f887f3970c18e92e1c305490f1da073cfae59d`
returned `REVISE`. The fifth candidate closes the executed counterexamples:

| Fourth-review blocker | Fifth-candidate exact closure |
|---|---|
| age-only recovery, missed stuck deadline and missing paired symptom | terminal failure remains until later successful evidence; running uses canonical `executionDeadlineAtMs`; unknown admission derives the expected slot from schedule+ledger, occurrence-binds the missed fact, and projector-to-compiler-to-lifecycle proves one incident/no unchanged alert |
| control receipt ancestor redirection | a protected-tree primitive walks each component from a pinned root-owned boundary, rejecting symlink/writable/ACL components before creation; control reads/writes revalidate the tree and tests prove zero writes for symlink/writable ancestors |
| bootout error treated as success | shared launchd quiescence distinguishes exact not-loaded state, propagates other errors, and positively proves every service absent; prior loaded states are frozen once and rollback restores only those states |
| incomplete rollback surfaces/generation checks | desired-state now has exact preimage/postimage receipt and restore action; runtime receipt freezes exact installed hash; unrelated advanced bytes fail closed; all disk restoration precedes a single service restart phase |
| boundary stopped below root | routing target validation is fixed to `/`; unsafe ancestors above the deployment subtree reject before write |
| premature terminal cutover claim | admission emits only `PENDING_CANONICAL_HEALTH_AND_CANARY`; a separate generation-bound gate can emit acceptance only after complete canonical counts/provenance, passive non-synthetic quarantine/dedupe replay, fresh disposable side-effect-free canary, unrelated-Job isolation and canary-only store delta |

That fifth candidate was submitted to both independent reviewers at the packet commit above; its
result is recorded next rather than inferred from the closure table.

The fifth exact-head review of `01e2ab9a4bdfbe81022b42e01b78d3a72000db68`
returned `REVISE`. The sixth candidate closes every executed counterexample:

| Fifth-review blocker | Sixth-candidate exact closure |
|---|---|
| later success hid a durable failed occurrence | every terminal failed occurrence remains a canonical `RUN_FAILED` fact; a regression proves later success cannot suppress it |
| runtime still active during early mutations | admission now freezes loaded state and positively quiesces W1, W2, and runtime before any store, code, config, routing, or incident-state mutation |
| desired-state `INSTALLING` replay could substitute predecessor bytes | the candidate is frozen once in the protected control tree with file/directory fsync; replay reads that exact candidate and verifies the exact original preimage before install |
| rollback changed predecessor metadata | runtime, watchdog, routing, and desired receipts bind uid/gid/mode plus absence of ACL/unsupported xattrs; restore reapplies and reads back exact bytes and metadata with file/directory fsync |
| pure postdeploy helper trusted booleans and minted current-six authority | the pure gate is deleted; an executable root-controlled finalizer reads the pending deployment receipt, authenticated canonical health, exact API/store SHA binding, and one retained side-effect-free canary created by a closed control op; it proves bounded store delta, unchanged fences/quarantines, and passive incident replay before publishing an atomic receipt |
| current-six authority was not identity-bound | the sixth candidate attempted a six-root binding; the sixth review correctly rejected cardinality as insufficient and the seventh candidate removes that authority mint entirely |

The sixth exact-head review of `85af2d04b71451e546206baee48dae8d0a50a83a`
returned `REVISE`. The seventh candidate closes every executed counterexample:

| Sixth-review blocker | Seventh-candidate exact closure |
|---|---|
| cardinality-only current-six authority | postdeploy acceptance always leaves `currentSixAuthorized=false`; recovery remains gated on later exact Owner-suffix-to-full-identity resolution |
| synthetic empty incident replay | finalizer protected-reads the real before/after `incidents.json`, binds both hashes to canonical health provenance, requires each exact open root, and proves zero notification on read-only replay |
| prompt-only side-effect-free canary | a fixed generation-bound reserved identity executes as a Scheduler-native no-op that cannot reach Router, AgentProcess, tools, credentials or delivery; durable Run result and event evidence prove zero tool calls/external effects and exact deployed SHA |
| token leaf-only validation | audit credential moved to one fixed control-tree path; canonical path, every ancestor, leaf no-follow identity, uid/gid/mode, ACL and xattrs are verified before the single fd read |
| route generation and unrelated-Job isolation gaps | before/after canonical routing hashes must equal the protected routing install receipt; every pre-existing Job retains its admission surface without health regression, while regression coverage proves an unrelated healthy Job can complete normally during the canary |
| runtime/watchdog plist durability gaps | the shared plist installer fsyncs rollback bytes and directory before any install receipt, fsyncs candidate before rename and target directory after rename, validates existing preimages/generations on replay, and has crash-frontier coverage |

The seventh exact-head review of `858bd55be7190684cd324f4e0c31658dcd5c6bef`
returned `REVISE`. The eighth candidate closes every executed counterexample:

| Seventh-review blocker | Eighth-candidate exact closure |
|---|---|
| reserved canary rejected before reserve | synchronous eligibility now admits only the exact reserved canary identity; a full Scheduler tick proves one succeeded occurrence while Router, Agent definition and delivery remain zero-call |
| empty/corrupt incident state looked deduplicated | durable load and postdeploy verification now require exact episode, transition, alert, deterministic notification key, outbox and delivery coherence; before/after notification-attempt surfaces must be identical |
| no deployed unrelated execution required | acceptance now requires at least one new successful occurrence for a pre-existing unrelated Job in the same proof window, in addition to unchanged fences and non-regressed health/credential/blocker/route surfaces |
| token walk stopped early and allowed platform xattrs | token and routing receipt use physical `/private/...` paths; the reader is fixed to `/`, rejects every symlink/writable/ACL ancestor and rejects every xattr including platform attributes |
| final preimage could be partial after crash | runtime and both watchdog plists copy to a validated fixed temp, restore metadata, fsync, atomically rename and fsync the directory; abandoned temp and unreceipted partial legacy preimages rebuild, while a post-rename crash resumes by validating and syncing the complete final |

The eighth exact-head review of `916bec1c3954b968ec4bb3d2fe44b8ef07faf09f`
returned `REVISE`. The ninth candidate closes every executed counterexample:

| Eighth-review blocker | Ninth-candidate exact closure |
|---|---|
| invalid incident lifecycle or absent delivery could pass | durable state now validates closed lifecycle/delivery enums, every record, every outbox intent, deterministic key, embedded transition snapshot, unique transition identity, orphan rejection and current open/closure binding; the postdeploy finalizer invokes the same validator before dedupe replay |
| same-byte runtime preimage could carry wrong metadata | runtime replay now exact-compares the predecessor and preimage uid/gid/mode/ACL/xattr metadata before accepting same bytes; the counterexample rejects before any receipt or install |
| quarantined occurrence counted as unrelated success | postdeploy acceptance rejects every appended occurrence for a fenced or before/after quarantined Job; the required proof occurrence must belong to a pre-existing Job classified healthy in both canonical snapshots |

The ninth exact-head review of `519c27c58f3ddc57cbdc12093632ad3b842071ab`
returned `REVISE`. The tenth candidate closes every executed counterexample:

| Ninth-review blocker | Tenth-candidate exact closure |
|---|---|
| nested arrays, future transitions or forged migration accepted | incident state requires plain containers and a closed hash-bound migration schema; transition revision/kind history is bounded and current-episode future intents, orphan intents and incomplete histories reject fail-closed |
| runtime and W1/W2 receipt replay did not bind rollback preimages | shared no-follow verification binds the exact fixed path, bytes hash, uid/gid/mode, ACL and exact xattr-name set before sync/bootstrap or a replacement receipt; watchdog receipt roles, labels, target paths and both W1/W2 rollback generations are closed and exact |
| advancing `overdueMs` broke a passive dedupe proof | postdeploy correlation excludes only the derived time-varying `overdueMs` field while retaining exact root, occurrence/run coordinates, due time, symptoms, episode, transition, deterministic outbox key and before/after attempt equality |

The tenth exact-head review of `3ee18091c1f0bd57c870d3e60c96eabaedf3928b`
returned `REVISE`. The eleventh candidate closes every executed counterexample:

| Tenth-review blocker | Eleventh-candidate exact closure |
|---|---|
| valid-shaped but invented migration hashes waived the outbox | migration authority now requires exact protected legacy/evidence/canonical-facts backups and the root-controlled migration receipt; canonical health verifies backup generations, and postdeploy requires the receipt-bound authority before allowing any migration exception |
| persisted delivery binding could redirect control-plane alerts | the binding schema is closed over producer, canonical stable payload, provider idempotency key, route, route source, routing SHA and finite timestamp; canonical health, postdeploy and every watchdog restart re-resolve against the exact protected routing generation, so a business-chat redirect fails closed with zero delivery |

The eleventh exact-head review of `eeadf7950d7cadbc42050f7874c4c552737c4f03`
returned `REVISE`. The twelfth candidate closes every executed counterexample:

| Eleventh-review blocker | Twelfth-candidate exact closure |
|---|---|
| delivery timestamps accepted negative, fractional, pre-transition or future values | durable state and lifecycle operations require monotonic safe-integer binding/attempt/update times at or after the incident transition; canonical health, postdeploy and watchdog compare every persisted delivery time to one trusted observation time and fail closed on future evidence |
| attempted unknown/delivered intent could lack binding or attempt evidence | `OUTCOME_UNKNOWN` and `DELIVERED` require an immutable canonical binding plus durable first-attempt and update timestamps; a bound `FAILED` also requires attempt evidence; malformed attempted intents throw during outbox inspection instead of disappearing silently |
| attempted unbound alert could be rebound to the current route | watchdog validates the complete persisted delivery authority before any route resolution, binding, provider readback or send; an invalid attempted state produces only local evidence and a failed tick, with zero external notification I/O |

This exact packet is intentionally submitted to both independent reviewers for a twelfth exact-head
review; the closure table is implementation evidence, not a self-issued PASS.

## 4. Controlled production migration plan

This is an execution plan, not evidence that production gates have passed.

1. Acquire the one serialized Scheduler production mutation slot. Freeze merge SHA, artifact hashes,
   actor, canonical runtime/store paths, route/incident preimages, launchd preimages, enabled-Job
   census, and rollback bytes. Abort on any mismatch or unavailable formal read surface.
2. Build a sealed deployment closure from the reviewed merge commit. Validate that it includes all
   changed Scheduler, product-api, production-runtime, runner and deployment-template bytes; do not
   reuse the prior reliability overlay's intentionally narrow closure as proof for this goal.
3. Materialize the redacted external routing manifest with an explicit canonical Scheduler ops
   target. Install it atomically as a regular no-follow file with root ownership, authorized reader
   group and mode no broader than `0640`. Do not change any Job delivery target.
4. Freeze predecessor incident/alert state and delivery evidence. Run the content-addressed migration
   with exact expected hashes. Ambiguous identity, delivery evidence, ownership or source drift aborts
   before commit; retain predecessor bytes and immutable hash-addressed backups.
5. Deploy code, route config and migrated incident state in the same serialized operation, then
   restart W1, W2 and runtime in the prescribed order. Do not touch the Scheduler occurrence/fence
   authority.
6. Read back deployed SHA, runtime/store/config provenance, protected-file metadata, W1/W2 health,
   and the complete enabled-Job census. Abort on `complete=false`, any `UNKNOWN`, route leakage,
   unexpected store delta, or lost rollback ability.
7. Create one new disposable side-effect-free canary Job through the formal Scheduler surface. Prove
   normal execution, route/health, and unrelated-Job admission. Prove dedupe and quarantine isolation
   only by passive readback and read-only replay of a frozen real quarantined snapshot; never force an
   `outcome_unknown` or synthesize an incident.
8. Accept the deployment only after all readbacks pass. Otherwise restore exact code/config/launchd
   preimages atomically while preserving incident evidence and leaving every occurrence/fence byte
   unchanged.

Required receipts: slot acquisition/release, source and artifact hashes, each preimage/postimage,
protected metadata, service transitions, complete health census, canary occurrence/result, store
byte comparison, rollback availability and terminal decision.

## 5. Current-six recovery plan

Only after the deployment and side-effect-free canary pass:

1. Resolve each approved suffix through authenticated formal surfaces to exactly one full
   occurrenceId/jobId/run/session/fence tuple. Zero or multiple matches abort the entire read phase.
2. Capture exact business outcome, termination, live process/lease, external side-effect, credential,
   route, incident and runtime evidence. Age and alert text are never evidence.
3. Apply ordered dispatch independently. Trusted exact business outcome may settle success/failure;
   otherwise trusted exact termination uses the existing termination-only seam; fresh exact live
   evidence remains `STILL_IN_FLIGHT`; every absent/stale/conflicting/unproven case is
   `QUARANTINED_UNKNOWN` and zero-write.
4. Select one evidence-backed mutable row as the recovery canary. Mutate once through the exact
   formal settlement operation, then read back occurrence, aggregate same-Job fence, audit, incident,
   health and next future natural schedule. Abort on mismatch.
5. Continue sequentially, one row and receipt at a time. Never bulk clear, replay an old occurrence,
   manufacture failure, edit raw store bytes or release a fence directly. A quarantined row remains
   fenced and visible.

At candidate time the six have not been read or classified. Their future production classification
must come from fresh exact evidence; this report intentionally records no guessed result.

## 6. Candidate disposition

```text
IMPLEMENTATION_COMPLETE_CANDIDATE = YES
ACCEPTANCE_MATRIX                 = PASS
SAME_JOB_FENCE_ONLY               = YES
UNRELATED_JOB_ISOLATION           = PASS (candidate integration test)
OLD_EXECUTABLE_PATH_CENSUS        = PASS
PRODUCTION_DEPLOYED               = NO
CURRENT_SIX_MUTATED               = NO
INDEPENDENT_IMPLEMENTATION_REVIEW = TWELFTH_EXACT_HEAD_PENDING
```
