# D-009 amendment / CTR-S4 preparation — r2 checkpoint

This is a preparation receipt and continuation plan, not Product Authority or a
deployment authorization. Owner's ruling is dated **2026-11-02 as supplied in the
task**; the observations below were collected on **2026-11-01 UTC**. These are
different dates, not a claimed future execution.

## Coordinates and mandate

```text
TARGET_REPOSITORY = mayf3/dsh-agent-core
WORKTREE = /tmp/ctr-s4-prep (physical /private/tmp/ctr-s4-prep)
BRANCH = ac-ctr-s4-runtime-prep
TASK_BASE_HEAD = 1921f8795e2212506a7a833bc79b84c17ba50ea1
REVIEW_TARGET_HEAD = 67d2bb08e6ec56a3bd2067266fda3be3b7635eec
PR_BASE = main
DEPLOYMENT_TARGET_LINE = ac1159-deploy
CURRENT_REMOTE_MAIN_OBSERVED = 26178b4f459cdc2737724f6614b5e2bc9bdc77b0
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = DURABLE (source preparation only)
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO (this amendment)
IMPLEMENTATION_ALLOWED = NO (dependent policy conflict below)
MERGE_READY = NO
OPERATION_ALLOWED = NO
```

Owner authorized this worktree's sole writer, GitHub writes and an open-only PR;
no deployment, restart, production write or shared-checkout write. The Owner
explicitly selected an append-only D-009 amendment and co-integration with CTR-S2;
the amendment records this task-specific route exception rather than claiming an
ordinary additive AMEND under unchanged accepted meaning.

The repository's local `origin/main` was stale at `0d3a2d6c`; remote main was read
via GitHub/ls-remote without changing either shared checkout. At observation,
the inherited task base was 8 commits ahead / 242 behind remote main. Its seven
already-changed files are outside this task's delta; they are not new work or
evidence of this task's integration readiness.

## Completed source preparation

1. `5049c6cd`: append 45 lines to D-009. Original bytes remain an exact prefix.
   Termination-only policy failed is scoped to recurring CTR-S2, while Router
   business uncertainty, history, exact evidence gates and no-replay/no-retry
   remain. Activation requires the amendment and implementation accepted into
   the same implementation base; an open PR does not activate it.
2. `67d2bb08`: add only `scheduler-watchdog.mjs` to the trusted installer's shared
   `APP_SCRIPTS_WHITELIST`. The prescan and installation copy loops both consume
   that variable. No startup or execution action was added.
3. [Tracking update on #417](https://github.com/mayf3/dsh-agent-core/issues/417#issuecomment-6557804027).
   The title and prior CTR-S4/r1 comments identify this as the intended issue;
   `mayf3/dsh-core` itself does not resolve as a repository.

Independent reviewer `/root/authority_audit` reviewed the two-file task delta at
exact head `67d2bb08e6ec56a3bd2067266fda3be3b7635eec`: final-head recheck PASS,
zero blockers **for this preparation delta**. This is a review recommendation,
not Owner acceptance or implementation/operation permission.

## Stop condition: remaining evidence-policy conflict

```text
FINDING = SPEC_GAP
SPEC_GAP_DEPENDENCY = LOAD_BEARING
AFFECTED_READINESS = CTR-S2 implementation, CTR-S4 wiring, deployable package
NEXT_ACTION = RE_PREFLIGHT
```

Source `825664850abce61e821eb505063241341d419907`,
`packages/scheduler/src/auto-reconcile.js:49-53`, maps both null and undefined to
`failed / no_registry_record_admission_unproven`. Its governing
`AGENT_DELIVERY_RESILIENCE_V1` CTR-S2 also explicitly selects failed when the
authoritative registry has no occurrence record. D-009 §8.5 requires zero writes
for `never_existed` or missing evidence; §6 distinguishes unknown from proven
failure. The new Owner ruling changes **termination-only**, not missing-record
evidence. This is an additional conflict, not a re-opening of the resolved
termination-only ruling.

Reachable counterexample: a recurring unresolved unknown is present in the
Scheduler ledger, the readable turn registry has no matching record, and the
source policy returns failed. No `child_real_exit` or
`terminated_without_outcome` proof is supplied. Applying the termination-only
exception to this case would expand the Owner ruling. Tests cannot settle this
authority conflict. The dependent transplant was stopped before source writes.

Minimum closure: explicitly reconcile the missing-record branch, either retaining
UNKNOWN and amending the conflicting CTR-S2 branch, or making a separate scoped
Owner decision authorizing that branch. Meanwhile default OFF is preserved;
there is no replacement executor, production cleanup or stopgap retirement.

## Source coordinate correction still required

- `2d28545b3a17818e4a0b9481827fd56a18cd4c3c` is a Spec-acceptance commit. Its tree
  does **not** contain `auto-reconcile.js`, the runtime mount or its test.
- `825664850abce61e821eb505063241341d419907` introduces those files. The source
  checkout was accessed only by `git show`, `ls-tree` and other read operations.
- A clarification was requested before substituting a different final source
  coordinate. No claim is made that implementation files came from `2d28545b`.

## Executed offline checks

Environment: macOS arm64, Node `v26.7.0`, scheduler-local `croner 10.0.1`.
The worktree initially had no dependencies; the first scheduler attempt failed
with `ERR_MODULE_NOT_FOUND: croner`. Installed only the scheduler dependency with
`npm install --prefix packages/scheduler --ignore-scripts --no-package-lock
--no-audit --no-fund`; no tracked manifest or lockfile changed.

| Check | Actual result |
|---|---|
| `npm run test:scheduler` after dependency setup | **419 PASS / 2 FAIL**, 421 tests, rc=1 |
| Re-run the two affected files with `node --test --test-concurrency=1` | **14 PASS / 0 FAIL**, rc=0 |
| `bash -n scripts/trusted-cp-deploy-install.sh` | PASS |
| `node --check scripts/scheduler-watchdog.mjs` | PASS |
| Copy only the whitelist into a temporary staging directory; compare bytes | PASS; exactly the watchdog added, no removals |
| D-009 original byte prefix compared with task base | PASS; append only |
| `git diff --check` | PASS |
| Structure verifier, `--base 1921f879 --head 67d2bb08 --json` | **rc=1**, 11 directory violations; all 11 have identical base/head counts |
| Scheduler / production-runtime source diff from task base | Empty; neither package was transplanted |

The two full-suite failures occurred while fixture setup expected an occurrence
but got undefined (`stuck.state`):

- `watchdog/late-outcome-selfheal.test.js`: “C11-R1 mismatch/conflict/pending/incomplete
  evidence is zero-write and stays fenced + HUMAN_REQUIRED”.
- `watchdog/restart-convergence-matrix.test.js`: “row 9 edge: a settled ONE-SHOT late
  outcome receipts one_shot_disabled, never a recurring disposition”.

The serial rerun does not establish the full concurrent suite is green or prove
a root cause. No existing test was changed or failure concealed. Full logs and
the structure-check receipt are in
[`docs/evidence/ctr-s4-prep-r2/`](../evidence/ctr-s4-prep-r2/).
The structure failures are pre-existing directory limits in `packages`, Router
tests, Broker source/tests, runtime source/tests and `scripts`/`scripts/lib`;
the complete 11 paths, limits and unchanged base/head counts are in the receipt.
No unrelated structure or test repair was attempted. The independent source
delta PASS above does not turn these executed gate failures into PASS.
No Postgres fixture, auto-reconcile transplant test, wiring acceptance, post-port
test-name-set comparison, runtime test or production acceptance was performed.

Verified watchdog SHA-256:
`6ab88171142a386664aa9b9a230fff83a9e01f09c1467e32c661a1aea6a9e522`.

## Continuation and deployment boundary

After resolving the source coordinate and missing-record semantics:

1. Finish the D-009/CTR-S2 authority reconciliation before implementation.
2. Transplant the bounded policy and dependencies into the deployment-line
   scheduler, respecting structure limits and the existing exact Router
   reconciliation/mutation authority; then connect the registry read-only.
3. Persist enable flag default OFF. Verify default-off, exact correlation,
   termination-only policy failed with UNKNOWN business provenance, one-shot and
   ambiguous exclusions, drift, receipts and lifecycle stop behavior.
4. Run the requested isolated fixture validation and compare all pre-existing
   scheduler test names; retain real executed results, including failures.
5. Produce a pinned deployment artifact/manifest and proven enable/disable
   procedure. This checkpoint is **not a deployable CTR-S4 package**.
6. Leave PR open for review and hand release/explicit activation to the regulator
   for its separately authorized low-traffic window. No auto-merge.

The intended source flag in the untransplanted implementation is
`AGENT_CORE_FENCE_AUTO_RECONCILE=on`; leaving it unset/off is the required default.
This is not an instruction to enable it now. The final configuration-off rollback
must be verified to stop further passes, including timer/lifecycle handling;
that proof and the executable deployment/rollback steps remain outstanding.
