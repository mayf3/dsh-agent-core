# Final scoped security re-audit

**Spec/conformance: FIX_REQUIRED. Quality/security: FIX_REQUIRED.** Eight original
findings close at source/nonproduction-fixture scope. B06 is partially repaired:
the protected recovery route exists, but its error handling introduces the
production-reachable late-verification starvation described in R02 below.
The complete remaining blocking union is **DCP-REREVIEW-R02 (P2)**. R01 is
separately qualified, nonblocking future multi-resource debt. No privilege escape,
fabricated acceptance, or new production execution is asserted by either finding.

## Scope and evidence boundary

- Accepted Spec semantics: `39865536ce51005f95a98473e77c2329078512c0`;
  accepted base: `bb5327f622a0333f1e11d945319e024a3731f05a`.
- FIX_BASE: `c5cab2eef3a5e7b502016571e1f24dd31b3e0560`.
- Reviewed FINAL_HEAD: `301dbc5ad433ca7954a99cc64750956fcba07b3c`.
- Executable/source freeze: `277a5e8832938e6b2232d11949aedfb92cd0e318`.
- Supplied package: `review-final-repair-c5cab2e-301dbc5.diff`, two commits,
  523,928 bytes. All changed source, test, configuration and report semantics
  inspected; retained raw logs navigated by their hunk/file indexes and relevant
  final observations. No new diff, suite rerun, production probe or source edit.
- This is the one scoped re-audit of `final-security-review.md`, governed by
  `final-repair-brief.md`; it does not repeat the original whole-branch review.
  The original report remains unchanged, SHA256
  `0ec8183704755c2340d46a1f0c8ab71e10a165fb57553cebb8dc6217c3cd4f14`.

Source coordinates below are relative to `packages/deployment-control-plane/`.
Evidence coordinates are relative to this directory's `final-repair-evidence/`.
PASS means the named original counterexample is closed in inspected code with
the stated retained F/M evidence, not native production acceptance.

## Original findings, in order

| Finding | Verdict | Closure and evidence assessed | Remaining qualification |
|---|---|---|---|
| DCP-FINAL-B01 | PASS — source/F/M | `src/bootstrap/preparation.rs` validates typed resolved inputs, an independently pinned trust set, nine role/domain-specific prerequisite statements, exact package/source/configuration/enrollment/subjects and freshness. `binding.rs` requires the disabled preparation profile. `verify-resolved` can return ready while activation remains false. `28-final-full-suite.log:586–587` executes the positive fixture and signed negative cases. | Actual trust/custody, integration bridges, selected release and protected facts remain absent. Synthetic signers are not authorities. A future activation receipt is no longer a circular prerequisite to preparation. |
| DCP-FINAL-B02 | PASS — source/F/M | `src/transaction/slots.rs`, `native_profile.rs`, `apply.rs`, and `fs/target.rs` enforce enrolled mutable slots, exact executable/mode/GID, root ownership and existing no-ACL checks; explicit ABSENT is representable. Complete faces are retained and compared across partial overlays. Log28:494–495,499–500,516 covers outside slots, metadata, retained-face drift, ABSENT rollback and 4096 slots. | Only the explicitly supported app-slot mutation face and retained Node/plist facets exist. A meaningful complete real release remains to be selected and attested. |
| DCP-FINAL-B03 | PASS — source/F/M | `src/bootstrap/binding.rs` is called from resolved preparation, production intake and Executor construction. It binds the kernel-observed host, exact repo/runtime/root/strategies, normalized profile digest/revision and caller/service UID separation; multiple native physical profiles reject. Log28:587 exercises re-signed foreign mappings and caller502/service502. | Production enrollment/lifecycle-denial evidence remains required; a digest or fixture identity is not that evidence. |
| DCP-FINAL-B04 | PASS — source/F/M | `src/bootstrap/socket.rs` and `service/server.rs` retain canonical `/private/var/run/agent-deployd`; the sole ancestor exception checks root:daemon0775, device/inode, flags, absent ACL and fresh nonroot identity groups, then retains/rechecks the dedicated child. Generic `Dir` remains strict. Log28:9,587 covers equivalent descriptor checks and structural rejection. | No privileged socket bind was executed. The fixture parent cannot pass the production root-owner policy. Public metadata census is not protected proof; W2 remains trusted root code. |
| DCP-FINAL-B05 | PASS — source/F/M | `src/transaction/apply.rs:73` classifies definite final policy refusal, flushes `NoMutation`, then atomically writes Blocked/removes the executor fence through `queue/executor_finalization.rs:4`, before clearing active state. Log28:496,501–508 covers expiry, corrected-policy retry and failed-flush fencing. | Storage/commit uncertainty intentionally remains fenced; this is not an automatic crash-ambiguity clearance. Attempt budgets remain intact. |
| DCP-FINAL-B06 | PARTIAL / FIX_REQUIRED | `src/service/intake.rs`, `service/train.rs:132`, `transaction/remediation.rs` and `queue/service.rs` now consume real protected mailbox records under the mutex, bind failure/status/physical restoration/operations and call the signed retry gate with fresh policy. Log28:693–704 proves same-daemon Blocked/RolledBack recovery and invalid/exhausted proof refusal. | R02 introduces starvation of unrelated eligible late verification. Those single-failed-unit tests do not cover it. R01 is nonblocking for the present single-resource native driver. Real upstream issuer bridges remain an independent external-contract gap. |
| DCP-FINAL-B07 | PASS — source/F/M | `src/transaction/recovery.rs:212` separates precommit known health/readback refusals from finalization commit uncertainty. Known failure records its cause and rolls back; commit/fsync uncertainty retains the latch. Log28:497–498,509–511 covers restored bytes/no closure and the retained finalization ambiguity boundary. | Native launchd rollback remains unexecuted. The passing final-health tests inject the typed error at the final proof seam; the HTTP parser is separately exercised. |
| DCP-FINAL-B08 | PASS — source/F/M | `src/transaction/health.rs` uses one monotonic deadline across connection, partial writes and each read, with a 64KiB response limit; `native.rs` retains fixed loopback8790. Log28:512–513 covers healthy/known-failure responses and a dribbling ephemeral peer; log28:498 covers timeout rollback. | No production8790 request occurred. OS scheduling precision is not an exact wall-clock guarantee. |
| DCP-FINAL-B09 | PASS — source/F/M | `src/fs/mod.rs` and `test/common/private.rs` guard before allocation/effects, use the kernel-selected0700 parent and owned0700 child, and ignore TMPDIR. All changed adoption, queue, service, transaction and filesystem constructors use the shared guard; workers validate FixtureRoots before effects. Log28:10–14 and repeated helper cases cover hostile TMPDIR, outside-base refusal and injected-root no-effect. | Root refusal is safely injected, not an actual root execution. Repeated helper executions are not distinct test definitions. |

## Remaining blocking finding

### DCP-REREVIEW-R02 — P2 — rejected recovery record starves late verification

**Affected repair:** B06. **Contracts:** CTR-DCP-014/015 (late per-Goal acceptance
and durable closure), with CTR-DCP-010/011 preserving B's STOP/retry restrictions;
ACC-DCP-011. This is a source/control-flow deduction, not a newly executed test.

**Reachable supported one-profile counterexample:**

1. A safely finalizes and remains the current healthy physical installation, with
   a Goal in `WAITING_EXTERNAL_ACCEPTANCE`. No ambiguous mutation/canary exists.
2. A later, accepted B for that same native profile expects A's generation but
   fails precheck before mutation, for example because its staged artifact is
   incomplete. B becomes Blocked; A's bytes/service and installed projection stay
   current. Restoring B's exact artifact makes `recovery_binding` succeed. B's
   preflight/mutation counts remain below their limits.
3. A correctly signed, otherwise exactly matching B recovery record remains in
   `intake/recovery/B-REVISION.json`, but is now older than300seconds. Protected
   policy is fresh. An authorized caller requests A's late verification; that
   request is durably accepted because A is still Applied.
4. Every tick selects B. `consume_recovery` reaches `Queue::retry`, which returns
   `RECOVERY_EXPIRED` without changing B's state/revision. The `?` at
   `src/service/train.rs:156` propagates through `tick:65`, before
   `daemon_next_verification` at66. Nothing consumes or changes the rejected
   record. Thus A's durable verification request is never attempted while that
   record remains, even though A still passes the independent installed gates.

**Exact binding:** `src/transaction/remediation.rs:138–154` reconstructs and checks
the physical binding, verifies the signer, observes policy and invokes retry;
`src/queue/lifecycle.rs:77–81` rejects stale recovery; `src/queue/service.rs:3–8`
selects B again, and28–65 accepts/retains A's separate verification request.
`src/transaction/recovery.rs:287–316` checks A's actual current installation for
late verification; it does not require clearing B's STOP pause.

**Impact:** a stale protected recovery record turns a unit-scoped safe refusal
into indefinite loss of the existing late-verification/Goal-closure route. No
forged key, unsupported second native profile, root attacker or mutation replay
is needed. Keeping B stopped is correct; preventing A's eligible acceptance is
not required by STOP. The existing test at `test/common/remediation.rs:49` observes
invalid records only while waiting on B, then replaces them; it does not establish
isolation from A's accepted pending verification.

**Minimal closure:** give definite record-validation refusals a bounded,
unit/record-scoped durable rejection disposition and let the tick reach eligible
late verification. Preserve all STOP pauses, current physical gates, retry counts
and unknown/storage-failure fencing; do not blanket-ignore all errors or replay
B. A focused integration assertion should retain an expired/mismatched B proof,
prove A's current installed late verification completes without reinstall, and
prove B remains Blocked with unchanged attempts. This requires no new Product
Authority or external issuer protocol. It is a repair requirement, not permission
for a second repair wave in this completed bounded workflow.

## Nonblocking affected limitation

**DCP-REREVIEW-R01 — future multi-resource pagination debt.**
`src/queue/service.rs:5` always chooses the first32 Blocked/RolledBack rows ordered
by sequence/id. `service/train.rs:132–161` has no cursor; exhausted or no-evidence
rows remain selected. In the generic/sandbox multi-resource Train,32 retained
failures can indefinitely hide an otherwise eligible33rd recovery. The final
native binding permits exactly one fixed physical profile/resource, and the
existing scheduler prevents subsequent conflicting applies after its failure;
this review does **not** establish the33-row state through that supported native
route. Therefore this is not a present native deployment blocker. Before enabling
multiple resources, use bounded fair pagination that advances across ineligible
rows without skipping STOP or weakening budgets, and exercise more than32 failures.

## Retained verification and coverage

The reviewed `26-frozen-source.json` hashes match current source bytes. The accepted
Spec is byte-identical to the accepted base. `32-final-gates.json` binds all five
serial commands to277a5e8; logs27–31 show debug build, locked all-target tests,
strict Clippy, fmt and freshly compiled release all exit0. Log28 contains168
primary executions:35/0/0/0/17/13/8/17/30/9/25/14;66 nested result summaries were
excluded. No suites were rerun. Development logs01–25 retain the initial red
counterexamples, missing-Goal fixture failure and lint failures without
retroactive PASS. The32-row and late-verification counterexamples were not
executed; the latter follows directly from the cited control flow and gates.

All96 recipe source hashes and23 package payload hashes were independently
re-read and matched; retained and actual manifest bytes match SHA256
`6e6411dda70109e27a21fd7200e4d3e8acf4132ff42bfbf289b2331ed3a8f202`.
Source digest is `de530f88605ac12d5267af9e40fed0195f9629eec7dca76bfc871d00e7eb9af6`.
Logs39–40 and receipt41 retain integrity=true, ready=false, activation=false and
preparation_digest=null. The22 reused Node closure payloads do not become trusted
transform attestations through hashing. Governance evidence passes; structure
evidence33/36 retains exactly the three unchanged directory violations
production-runtime/src21, production-runtime/test23 and scripts59. Supplemental
Rust inventory37 reports87files, max479lines/20children/depth2. Raw-log whitespace
exceptions in43 are preserved as observations, not source-format failures.

| Coverage | Scoped conclusion / limit |
|---|---|
| CTR001–003; ACC001–002 | Original producer/intent/coverage assessment retained; current inherited observations re-executed. No actual upstream producer bridge claimed. |
| CTR004–006; ACC003–004 | Original signed authority/artifact gates retained; repaired resolved preparation, slots and final prewrite refusal reviewed. Actual authority/build/review inputs remain absent. |
| CTR007–009; ACC005–007 | Canonical socket exception, native mapping, whole face and bounded health reviewed; mutex/security inherited evidence retained. No privileged runtime proof. |
| CTR010–011; ACC008–009 | Recovery intake and budgets improve B06, but R02 prevents complete closure; R01 is future multi-resource debt. Unknowns remain fenced. |
| CTR012–013; ACC010 | Exact slots/metadata/ABSENT/whole-face and known final-health rollback reviewed; native physical proof remains pending. |
| CTR014–016; ACC011 | Existing late verification and closure observations remain evidence for their tested cases, but R02 refutes their composition with invalid recovery intake. No whole-ACC PASS. |
| CTR017–019; ACC012–013 | Resolved preparation is distinct from activation; original trust/legacy boundaries retained. Actual issuer custody, complete legacy retirement and caller denial remain unproven. |
| CTR020; ACC014 | Health's per-operation bound and existing quotas remain supported; R02 is a progress defect despite each tick being finite. |

The original whole-review attack-list conclusions stand except the specific
closures/qualification above: no generic privilege exception, arbitrary slot
expansion, same-UID native parent, unsigned recovery, fresh retry budget or unknown
replay was introduced. Optional F01/F02 and unchanged unrelated structure debt
remain outside this scoped blocking union.

## Readiness and authority

**BOOTSTRAP_READY=NO; ACTIVATION_ALLOWED=NO; OPERATION_ALLOWED=NO.** RP01–06 still
require authentic host/enrollment, real issuer contracts/custody and implemented
authenticated bridges, exact accepted source/build/review and meaningful release,
protected legacy/lifecycle facts, and trusted Node-transform/native proof. Generic
enforcement is implemented; unavailable external contracts are not fixtures and
the missing bridges are not finished integration. RP07 remains FIX_REQUIRED due
to R02. The immutable package41 keeps its seven unresolved prerequisites; this
report neither rewrites it nor supplies independently signed preparation proofs.

Future exact Owner authorization, protected installation/rollback, signed
activation and real canary/readback are the later RP08 operation boundary. They
are not prerequisite receipts for an otherwise complete offline preparation.
This review performs and authorizes none of those operations. No second source
repair or expanded re-audit is implied by this report.
