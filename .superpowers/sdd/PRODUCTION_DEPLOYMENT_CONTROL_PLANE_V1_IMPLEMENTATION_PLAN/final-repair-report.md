# Frozen final repair report

Status: DONE_WITH_CONCERNS — all nine frozen source repairs implemented and final nonproduction gates passed; scoped independent re-audit and real prerequisites remain pending.

```text
DEVELOPMENT_PREFLIGHT
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = c5cab2eef3a5e7b502016571e1f24dd31b3e0560
BASE_HEAD = bb5327f622a0333f1e11d945319e024a3731f05a
CURRENT_BASE_HEAD = bb5327f622a0333f1e11d945319e024a3731f05a (mandate integration snapshot; no fetch)
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
GOAL_OR_TARGET = Close frozen DCP-FINAL-B01 through B09 and regenerate inert evidence
CURRENT_GAP = Nine source and verification defects in exact final-security-review
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@39865536ce51005f95a98473e77c2329078512c0
IMPLEMENTATION_AUTHORITY = contracts
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
EXECUTION_MANDATE = VALID (controller dispatch and final-repair-brief.md)
MUTATION_AUTHORIZATION = VALID
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = YES (final-repair-brief.md, nonproduction only)
SPEC_GAP_DEPENDENCY = NONE
EVIDENCE_REVIEWABILITY = PASS
LIVE_AUTHORITY_GAP = NONE
OWNER_DECISION_REQUIRED = NO
EMERGENCY_STATE = NONE
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = NO
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = Focused RED/GREEN; final serial locked suite, fmt, strict Clippy, release; structure delta; source-bound inert package
DONE_WHEN = Nine frozen repairs reported with exact source/evidence coordinates for one scoped independent reaudit
EXPANSION_TRIGGER = Concrete missing accepted contract or unavailable required real fact; no invented issuer protocol or custody
NEXT_ACTION = CONTINUE
```

All execution uses the isolated implementation worktree, euid502 fixtures and kernel private roots; no production, root, sudo, bootstrap, push or merge.

## Frozen source and disposition

SOURCE_REPAIR_HEAD=277a5e8832938e6b2232d11949aedfb92cd0e318. Source-only repair is
committed; exact complete source inventory is final-repair-evidence/26-frozen-source.json.
No executable edit occurred during the final serial run or subsequent evidence mapping.
FINAL_EXECUTABLE_HEAD is the same source commit. The final evidence commit is
recorded in the post-commit companion final-repair-evidence/44-final-ref.json; this
avoids a self-referential commit hash in a committed report. That receipt and the
controller handoff bind the final branch HEAD.

| Frozen finding | Source disposition and directly affected implementation | Directed observations |
|---|---|---|
| B01 | Implemented typed ResolvedPreparation, independently pinned preparation trust, nine role-separated signed prerequisite statements, exact source/package/config/enrollment/release/custody/plan bindings, review independence and freshness. Disabled profile and activation_allowed=false even for ready synthetic input. Owner receipt moved to subsequent activation boundary. bootstrap/preparation.rs, binding.rs, verify.rs and prepare CLI. | 09/14/17 preparation logs: synthetic ready, omission/forgery/cross-binding/expiry and inert candidate rejection. Final full run passed at the frozen source. |
| B02 | Protected enrollment now owns exact regular-file slots, explicit ABSENT, mutable/retained overlay semantics, mode/GID, root owner and absent ACL. Executor resolves manifest slots before service effects, preserves complete required face and checks unchanged files, bounds whole face and retains metadata/rollback. Native unsupported required facets block. transaction/slots.rs, native_profile.rs, apply.rs, journal.rs; fs/target.rs. | 05 exact extra-slot RED, 06 GREEN; 12 expanded test had missing Goal receipt (a legitimate fixture failure), corrected15 and16 pass. Extra existing/ABSENT sibling, metadata/executable, unchanged drift, private0600, explicit absence restoration. Final4096 mapping is affected and included. |
| B03 | One shared structural binding for preparation, intake and physical executor; fixed repo/runtime/root/strategy/launchd mapping, kernel-observed host UUID digest, exact profile revision/digest and caller/service disjointness; protected lifecycle-denial receipt remains required. bootstrap/binding.rs; intake and production Executor. | Preparation negative cases reject foreign host/root/repo/strategy/overlap and caller502/service502;505/root accepted structurally. No actual privileged identity/lifecycle proof. |
| B04 | Only canonical /private/var/run can use root:daemon0775 exception. Exact device/inode/flags/no-ACL and fresh membership exclusion for nonroot enrolled callers/services; dedicated root-owned0750 child and retained descriptor rechecks. Root W2 explicitly trusted root code. Generic Dir checks unchanged. bootstrap/socket.rs; service/server.rs. | 13 descriptor fixture: equivalent metadata accepted, replacement/mode/ACL rejected and generic Dir still rejects0775. Preparation cases refuse absent proof/group-write/ACL/wrong group. No privileged production socket bind. |
| B05 | Final definite policy refusal appends durable NoMutation, atomically BLOCKED/fence cleanup, then drops active state. Storage errors retain recovery fence; no preflight/mutation budget reset. transaction/apply.rs; queue/executor_finalization.rs. | 01 RED PRECHECK vs BLOCKED;02/16 GREEN, same-daemon corrected-policy retry,0 initial mutations; injected NoMutation fsync failure remains PRECHECK/active/fenced and no write. |
| B06 | Protected bounded signed recovery mailbox consumed by Train under permanent mutex; exact current failed status/cause, byte/service restoration and owned operation binding, fresh policy, receipt dedupe and existing budgets. Known failure cause is durable before rollback. External issuer transport remains unimplemented pending real contract. transaction/remediation.rs; service/intake.rs/train.rs; queue/service.rs. | 11/20/24 real private daemon/socket cases: same-daemon preflight and rollback recovery, wrong revision/cause/signature/expiry/unknown disposition refusal, replay and exhausted second mutation budget cannot install. No direct Queue::retry call substitutes for daemon integration. |
| B07 | Known precommit physical/health failure records cause and invokes exact guarded rollback; failed finalization commit/fsync stays latched with fence. transaction/recovery.rs; service/train.rs. | 01 RED VERIFYING vs ROLLED_BACK;02/16 GREEN. Actual fixture bytes restored, signed Goal PASS never closes, known HEALTH_TIMEOUT restores; retained finalization ambiguity tests in final suite. |
| B08 | Shared health reader uses absolute monotonic deadline over connect/partial write/every read and bounds response bytes. Fixed production8790 route unchanged. transaction/health.rs/native.rs. | 03 dribbling-peer RED (0.53s completion with generic IO refusal for100ms budget);04 GREEN (~0.14s), ephemeral loopback only. Final suite includes healthy/known-failure parse and timeout rollback cases. |
| B09 | All owned fixture allocations now use shared early nonroot guard and kernel-selected0700 parent/child policy; TMPDIR cannot select roots. Existing worker entries validate FixtureRoots before effects. Common/adoption/queue/filesystem/transaction/service helpers consolidated. fs/mod.rs and test/common/private.rs. | 21 safe injected-euid0 closure does not run, outside kernel base refuses before creation, hostile TMPDIR child runs only in kernel-private0700 root. No actual root execution. |

Directed01–25 logs are development working-tree observations, not independent
reviews or final committed-source full-suite results. The exact historical frozen
counterexamples remain final-security-review.md at FIX_BASE. Logs12,18 and22 retain
actual fixture/lint failures; no pass is retroactively attributed to those invocations.
The decisive final-source execution is separately pinned in26 and27–32, with all
new test definitions present in the committed source. Child worker summaries must
not be counted twice.

## External readiness and production facts still required

RP-01: real accepted host/native enrollment, numeric identities, exact slot face and
protected socket/ancestor/readback; public metadata is time-bound, not protected proof.
RP-02: actual six issuer contracts/public keys/isolated custody and authenticated
upstream-to-protected-mailbox bridges. Generic typed validation and daemon-side
recovery consumption do not invent those services. Adjacent-source census absence
is not a claim the services do not exist.
RP-03: authentic canonical source/tree/build/toolchain/dependency and independent
review attestations for the exact meaningful release and package.
RP-04: selection of that meaningful complete release. Supported app regular slots
and unchanged Node/service-plist facets are explicit; required config/routing,
external harness, incident migration, directories or other unsupported facets block.
No actual release selection is inferred from the positive synthetic fixture.
RP-05: protected exhaustive legacy writer/sudoers/job/lifecycle inventory, exact
retirement plan and later real caller negative writes/launchctl/signals. Existing
four source guards do not prove global adoption; child502 remains distinct.
RP-06: authentic transformed x86_64 Node provenance/signature and later native
loader/process/runtime/readback proof. The local inert closure is structural only.
RP-07: original final review remains FIX_REQUIRED at FIX_BASE; controller must run
its one scoped independent re-audit. Implementer supplies no independent PASS.
RP-08: future exact Owner authorization, protected staging/rollback and signed
activation epoch/receipt, then real enrollment/canary/standing enablement. RP-08
is an operation prerequisite, not a circular offline-readiness prerequisite.

No production/root/sudo/bootstrap/install/legacy cutover/push/merge was executed.
F01/F02 and preexisting repository structure debt remain outside the frozen union.

## Final serial verification and package

All commands ran serially with one Cargo writer at SOURCE_REPAIR_HEAD, euid502.
Exact command arrays/start/end/source/status are in32-final-gates.json.

| Gate | Result | Raw evidence |
|---|---|---|
| `cargo build --locked --manifest-path packages/deployment-control-plane/Cargo.toml --bins` | exit0 | final-repair-evidence/27-final-debug-build.log |
| `cargo test --locked --manifest-path packages/deployment-control-plane/Cargo.toml --all-targets -- --test-threads=1` | exit0 | final-repair-evidence/28-final-full-suite.log |
| `cargo clippy --locked --manifest-path packages/deployment-control-plane/Cargo.toml --all-targets -- -D warnings` | exit0 | final-repair-evidence/29-final-clippy.log |
| `cargo fmt --manifest-path packages/deployment-control-plane/Cargo.toml -- --check` | exit0 | final-repair-evidence/30-final-fmt.log |
| `cargo build --locked --manifest-path packages/deployment-control-plane/Cargo.toml --release` | exit0 | final-repair-evidence/31-final-release.log |

The final all-targets run passed168 top-level executions: lib35, authority17,
bootstrap13, e2e8, filesystem17, queue30, socket9, train25, transactions14;
three binary targets contain0 tests. Nested worker result lines are not added
to168. Shared helper definitions execute in several targets. Physical4096 slots,
all fixture surfaces, crash/fsync/finalization ambiguity and unknown-no-replay
regressions execute in this final suite. No repeat suite after documentation edits.

Governance integrity passes; accepted Spec is byte-identical tobb5327f. Structure
verifier exits1 for exactly three unchanged baseline directory violations:
packages/production-runtime/src21children, packages/production-runtime/test23children, scripts59children.
Supplemental87Rust files max479lines/max20immediatechildren/depth2. See33–37;
no global structure PASS.

Package assembly used freshly built release controller and prepare CLI at277a5e8;
no older binary is presented as new-source output. All96 bound source files and
23payloads are verified. The22 existing transformed Node files were rehashed and
reused byte-for-byte, without claiming a trusted transform signature or live proof.
Historical packages and original build claims remain preserved. Exact recipe38,
prepare39, verify40, manifest/plist copies and package receipt41 are retained.

- `source_commit`: `277a5e8832938e6b2232d11949aedfb92cd0e318`.
- `binary_build_source`: `277a5e8832938e6b2232d11949aedfb92cd0e318`.
- `manifest_digest`: `6e6411dda70109e27a21fd7200e4d3e8acf4132ff42bfbf289b2331ed3a8f202`.
- `source_digest`: `de530f88605ac12d5267af9e40fed0195f9629eec7dca76bfc871d00e7eb9af6`.
- `controller_sha256`: `09219f333fc0864197d024a8178ad7bee27a3c31c35585fbcbca7834deaaee30`.
- `prepare_cli_sha256`: `b9a4bba70208fc2150d964d38aa096004abd163616868927118f983977b27cae`.
- `package_path`: `/private/var/folders/jh/5k4x44w12ps1kbrch8__f6b80000gp/T/agent-deployd-final-repair-j_4n_knv`.

Actual result: INTEGRITY_VERIFIED=true / BOOTSTRAP_READY=false /
ACTIVATION_ALLOWED=false / preparation_digest=null. Current package has seven
readiness blockers (RP-01–07); RP-08 is future execution authority only. Disabled
profile, null issuer keys/custody and empty transition policy remain intact.

## Evidence and handoff

Tracked docs/reports/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md adds stable
EVD-DCP-FR-B01–B09 and EVD-DCP-FR-010, each with target/source/current test and raw
log coordinates, environment, inputs/results/rejections, sufficiency and limits.
Its final-source supplement maps every inherited ACC-001–014 observation to the
current final execution. CONFORMANCE.md identifies current versus historical
status. Previous EVD records and all failed logs remain intact.

Controller-owned final-security-review.md is original contrary evidence atFIX_BASE.
issuer-public-input-handoff.md, issuer-adjacent-source-census.json and
socket-parent-public-observation.json remain bounded public-input observations,
not authentic issuers, protected facts or production authority. final-repair-brief.md
is the frozen execution mandate. All are retained with this evidence commit.

No new concrete implementation ambiguity remains within the frozen nine. F01/F02
follow-ups remain outside scope. Implementer supplies no independent PASS.
The controller receives exclusive index/ref ownership after final commit and runs
ONE scoped original-reviewer re-audit. No further source/evidence mutation will be
performed by this implementer after handoff.

Staged diff whitespace check reports only native raw log trailing spaces/terminal
blank lines (43-raw-log-whitespace.json); raw output is preserved byte-exact.
Earlier42 predates staging ignored raw logs and is not a staged-all-files PASS.
