# R02 independent scoped security review

**DCP-REREVIEW-R02: PASS at source/nonproduction-fixture scope.** The original
starvation counterexample is closed and no new scoped ship blocker was found.
Frozen serial gates all completed successfully. This is not parent implementation
completion, bootstrap readiness, native runtime acceptance or permission to operate.
Review completed at `2026-09-17T22:59:58Z`.

## Coordinates and scope

- Goal: `PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_R02_CLOSURE`.
- Reviewer: `/root/dcp_r02_security_review`, independent of the implementation.
- Review Head: `8ab5904fc0b79ba2e565469f1127312bb36c4e58`.
- Base and current parent implementation branch:
  `1cbdaaff03fffa02bfa0394c7a7a9e9ed47ba696`.
- Accepted authority: `PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1`, accepted lifecycle
  base `bb5327f622a0333f1e11d945319e024a3731f05a`, semantics
  `39865536ce51005f95a98473e77c2329078512c0`.
- Supplied review package: `review-1cbdaaf-8ab5904.diff`, two commits, 39,241 bytes,
  SHA256 `e57d148198bf1b5fb4699444fe7f00ee87ef224b2ac3c39f4b5bf279a82acdef`.
- Only R02 and directly changed recovery gating/acceptance were reviewed, with
  directly affected mutex, authority, artifact, journal and rollback boundaries.
  Original closed findings, future 32-row debt, issuer integration, bootstrap and
  production readiness were not reopened.

The supplied diff was read without regeneration; source was read at the frozen
Head for control-flow context and exact locations. The reviewer executed read-only
hash/ref checks: all 90 entries in `evidence/14-frozen-source.json` match current
bytes; the accepted Spec matches Base bytes; the parent implementation ref remains
at Base. No test suite was rerun and no native/runtime probe was executed. Only
this review document was written. This is a separate Owner-authorized successor
lane, not another parent repair wave or a rewrite of its audit history.

Source references below are relative to `packages/deployment-control-plane/`;
evidence paths are relative to this successor lane's `evidence/`.

## R02 closure and unit/global boundary

The original reachable counterexample is healthy current Applied A awaiting its
external Goal receipt, while later B remains Blocked before mutation and retains
an expired exact signed recovery record. Previously that record aborted every
tick before A's durable verification request could be selected.

1. `src/transaction/remediation.rs:7–28` introduces `RecoveryFailure`. An ordinary
   error converts to Global; UnitLocal is granted only at named stages with an
   explicit finite set of refusal codes. There is no caller-provided safety flag
   or catch-all successful continuation.
2. `remediation.rs:37–59` retains the mutex/root binding, active-transaction guard,
   service read, execution state and every shared journal's load/terminal check
   before a retry-budget refusal can be unit-local. Journal/storage/unknown errors
   therefore propagate rather than being suppressed by the previous broad
   recovery-binding `Err` branch. Only B's absent/incomplete artifact intake is
   classified locally at the artifact-import call (`61–67`). Artifact mismatch,
   slot/metadata failure, live baseline drift and rollback proof failure retain
   Global propagation (`68–145`).
3. `src/service/intake.rs:151–165` distinguishes failure to open the protected
   recovery namespace from absence of the exact unit/revision record. Only record
   decode/depth/size refusal is local; file ownership/type/ACL/I/O errors propagate.
   This is an attempted-intake check, not a universal census of unused namespaces.
   When B is already refused for missing artifact or exhausted budget, no recovery
   record is consumed or authorized.
4. `src/service/train.rs:151–177` binds the selected mailbox to B and its current
   revision before using any identity claimed by the record. A signed record for
   A placed in B's slot cannot redirect physical recovery. The expected physical
   binding and signer scope are checked again in `remediation.rs:168–188`.
   Fresh policy observation errors remain Global (`189–194`); the retry stage's
   expiry/revision/digest/budget/revocation/preimage/dependency/profile refusals
   are local (`195–209`). The existing transactional retry gate remains intact.
5. Before any local continuation, `train.rs:141–184` requires
   `Queue::daemon_recovery_refused`. In `src/queue/service.rs:5–41`, a transaction
   rechecks B's revision and Blocked/RolledBack state and inserts a content-hashed
   receipt containing B's identity, profile, intent, expected generation, attempts,
   stage and reason. The finite internal stage/reason set and `INSERT OR IGNORE`
   prevent repeated ticks growing the same refusal indefinitely. No unit state,
   attempt count, STOP pause or recovery grant is changed. Database/commit failure
   returns before continuation (`src/queue/mod.rs:29–37`).
6. A's pending request is then selected by the original `train.rs:66–69` route.
   `train.rs:189–206` acquires the permanent mutex and invokes the unchanged
   `Executor::verify_installed`. `src/transaction/recovery.rs:294–311` performs fresh
   revalidation, current Applied/installed identity, live face, service generation,
   service proof/health and A's artifact checks. Queue revalidation still rejects
   host quarantine and a changed installed generation (`src/queue/gates.rs:41–55`).
   Goal receipts still require the configured verifier and exact expected binding
   (`train.rs:323–337`). No substitute PASS, install or mutation-recovery shortcut
   was added.

These source deductions close the reported starvation path while retaining
CTR-DCP-010/011 STOP, attempts and unknown-outcome restrictions. The ordinary A
path retains CTR-DCP-009/012/013 physical safety and CTR-DCP-014/015 per-Goal
acceptance/closure. Caller API, ownership and privilege boundaries remain unchanged
under CTR-DCP-007. Bounded refusal storage is consistent with CTR-DCP-020.

## Executed evidence inspected

These are retained author-run observations at nonroot kernel-private sandbox
daemon/socket fixtures, independently inspected here. The reviewer did not execute
these tests; source deductions above are not described as runtime observations.

| Evidence | Observed result and coverage |
|---|---|
| `02-regression-red.log` | Original expired-B case failed by A acceptance timeout before the fix; quarantine negative passed. |
| `03-expanded-red.log` | Expired, malformed and mismatched B cases failed; unbound shared journal incorrectly reached A's verifier. Two other global controls passed. |
| `06-identity-red.log`, `07-namespace-red.log` | Intermediate repair still failed cross-unit mailbox isolation and treated missing recovery namespace as record absence; both failures remain retained. |
| `10-scope-green.log` | All 8 focused cases pass: expired, malformed, mismatched and cross-unit B records allow A's normal read-only acceptance; host quarantine, unbound shared transaction, refusal-storage failure and missing recovery namespace prevent it. |
| `11-recovery-related.log` | All 3 related protected-mailbox tests pass: known rollback recovery, same-daemon preflight recovery, exhausted mutation budget refusal. |
| `12-acceptance-related.log` | Existing late external acceptance closes once without local fabricated success. |
| `13-development-clippy.log` | Development strict Clippy exits successfully; final frozen Clippy also passes in log18. |

The new tests in `test/common/recovery_isolation.rs:184–227` wait for A's actual
late-verification request, supply a test-verifier-signed exact receipt, and observe
one durable A outbox row plus one deduplicated record-refusal for B. Their unchanged
assertions (`134–175`) bind B's state/revision, attempts `(1,0)`, retained STOP,
A's one mutating attempt, installed projection, target bytes and absence of a
pending executor finalization. Global-negative assertions (`321–338`) observe no
late request and no closure over 700ms across the daemon's 100ms ticks, then recheck
the same invariants. Finite fixture observations supplement the source proof; they
are not a claim of exhaustive fault coverage or native production health.

Retained governance integrity21 passes. Structure23 reports the same three
unchanged Base violations in `production-runtime/src`, `production-runtime/test`
and `scripts`; it is not an overall structure PASS and creates no new scoped
blocker. No Spec change, rollback authority expansion, issuer contract completion,
root action, launchd operation or production8790 observation is claimed.

## Final gates and disposition

Independently inspected `20-final-gates.json` and logs15–19: all five serial commands
bind executable `8ab5904` and exit0 between `2026-09-17T22:52:19Z` and
`2026-09-17T22:58:28Z`. The commands are locked debug-binary build, locked
all-target tests with one test thread, fmt check, locked all-target Clippy with
`-D warnings`, and locked release build. Release log19 shows a fresh package
compilation. Full log16 contains 176 primary executions across
`35/0/0/0/17/13/8/17/30/9/33/14`, all passing; 66 nested fixture result summaries
are excluded. Its lines693–713 execute all eight R02 isolation/global-negative
cases successfully. No suite or compiler-error failure marker was present.

After gate completion, the reviewer repeated the read-only hash comparison: all
90 frozen entries still match, package tracked status is clean and Head remains
`8ab5904`. The daemon and preparation release binary hashes independently match
receipt26. Environment25 binds the execution to macOS arm64, euid502, Rust/Cargo
1.98.1. Manual Rust inventory24 reports 88 files, maximum479 physical lines,
20 directory children and depth2. These are nonroot fixture/build observations,
not production or privileged proof.

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = AFFECTED_CONTRACT
SPEC_REVIEW = NOT_APPLICABLE
REVIEW_TARGET_HEAD = 8ab5904fc0b79ba2e565469f1127312bb36c4e58
BASE_HEAD = 1cbdaaff03fffa02bfa0394c7a7a9e9ed47ba696
CURRENT_BASE_HEAD = 1cbdaaff03fffa02bfa0394c7a7a9e9ed47ba696
REVIEWER_ID = /root/dcp_r02_security_review
AUTHOR_INDEPENDENCE = PASS
ASSURANCE_LEVEL = CONTROLLED
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
BASE_IMPACT = NONE
BLOCKERS = 0
SPEC_GAPS = 0
FOLLOW_UPS = 0
TOOLING_DEBT = 0
IMPLEMENTATION_ALLOWED = NOT_APPLICABLE
MERGE_READY = NOT_APPLICABLE
OPERATION_ALLOWED = NO
R02_VERDICT = PASS_SOURCE_AND_SANDBOX
BOOTSTRAP_READY = NO
ACTIVATION_ALLOWED = NO
NEXT_ACTION = STOP
```

Readiness flags are scoped: no integration/merge operation is assessed or granted;
the fixed parent implementation branch is the Base coordinate. Existing unrelated
structure and future multi-resource debt are retained, not counted as new findings.
This review closes only R02 and its directly affected safety composition. Real
issuer bridges, selected production release/prerequisites, privileged bootstrap,
canary/readback and parent-wide completion remain separate.
