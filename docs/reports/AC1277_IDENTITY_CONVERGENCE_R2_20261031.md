# #1277 R2 — local DB validation and bounded T1 proposal

This is the continuation of the [R1 delivery](https://github.com/mayf3/agent-control/issues/1277#issuecomment-6536376777), not a restart of the existing fixes. Production changes and production DB access are zero. The source task remains incomplete at T1's real authority gap.

## Exact source and ownership

| Repository / purpose | Worktree and branch | Base | Bound HEAD |
| --- | --- | --- | --- |
| Svc T0 source | `/tmp/ac1277-svc-workflow`, `ac-task/1277-identity-convergence` | `35c3b685db4ac91bc7a216d840fcf19a0fa1a890` | `cf2397b048d84b1c6eadd1170b3cda1c102de11b` / Draft #107 |
| Svc T1 proposal only | `/tmp/ac1277-svc-spec`, `codex/identity-convergence-1277-spec` | same | `27747607937ecaa032982bd1a81301601633791d` / Draft #108 |
| DSH report / evidence only | `/tmp/ac1277-dsh-agent-core`, `ac-task/1277-identity-convergence` | `0b64aca3615aec203b95aa960eff39d635bd26c1` | commit containing this report / Draft #591; R2 parent `4c8fe59133395a1cb21d29f0dc1b0553d18a4828` |

Root is the only product/document author. Delegates independently inspected authority, executed existing mock tests and reviewed evidence in separate task-owned evidence files. No shared dirty checkout was changed. All prior R1 evidence remains intact.

Svc source tree remains `65fcd731491cb1d23fa9cea20f550c1f0b14d524`; binary Git diff SHA-256 remains `7e1a50f4d7c1d05d1c25a235b1f7c051570a8e42b808f32919b1145d75ee2c89`. The original non-author T0 source review is reused without rewriting the continuity or creator SQL fixes. The new review covers R2's executed evidence and T1 proposal only.

## DEVELOPMENT_PREFLIGHT / controlled local test runbook

The current user mandate authorizes source work and a new local PostgreSQL only. T0 verification is `REUSE / EXEC_PLAN / CONTROLLED`; accepted CIR V2 and P9 plus DSH capability V3 remain governing. R1's exact-head source preflight remains applicable. No new product source or behavior-defining test expectation was changed in R2.

Create a new cluster and socket under `/tmp/ac1277-r2-*`, bind only loopback, read back database/user/address/port/data directory, explicitly set both `DATABASE_URL` and `TEST_DATABASE_URL`, use existing tests serially and record command/head/rc/monotonic time/hash. Abort on database identity mismatch, scope expansion or unexplained regression. The runner passes an allowlisted environment and does not inherit production connection or proxy variables. Local test writes, local mock requests and local repair-operator fixtures are the only database effects.

T1 is a separate docs-first `SUPERSEDE / EXEC_PLAN / CONTROLLED` route: the issue's finite semantic amendment is represented in the repository's current required whole-authority vehicle, not a redesign. T1 implementation remains disallowed until the exact missing decision is resolved and the bounded authority is accepted/main. The existing frozen repair apply scope does not expand.

## Local PostgreSQL / evidence coordinates

The R1 `shmget` restriction is resolved in R2: `initdb` and task-cluster startup returned rc0. Fresh identity is `ac1277_r2_test | ac1277_r2_test | 127.0.0.1 | 57278 | /tmp/ac1277-r2-pg`, PostgreSQL 16.15. Candidate DSN uses `ac1277_r2_test`; baseline DSN uses separate `ac1277_r2_baseline` in that same exclusively owned cluster. Setup wall-clock duration was not instrumented; it is not fabricated. Test command durations are monotonic and recorded.

Raw logs and receipts are in `../evidence/identity-convergence-1277-r2-20261031/checks/`. Compressed `.log.gz` files are lossless; each command receipt's log hash refers to decompressed bytes. `MANIFEST.sha256` hashes the stored files. The cluster is stopped after verification; its task data and evidence are retained.

## Executed tests and baseline

| Target / command | Result | Duration |
| --- | --- | --- |
| `cargo test --test 17_workflow_runtime -- --test-threads=1` (combined invocation) | 453 PASS / 0 FAIL | 537.28s test time |
| `cargo test --test 19_domain_owner_definition_governance -- --test-threads=1` (combined invocation) | 25 PASS / 0 FAIL | 0.52s test time |
| `cargo test --test 23_global_coordinator -- --test-threads=1` (combined invocation) | 10 PASS / 0 FAIL | 37.89s test time |
| `cargo test --test 31_admission_wiring -- --test-threads=1` (combined invocation) | 7 PASS / 0 FAIL | 14.90s test time |
| `cargo test --test 32_canonical_assignee_continuity -- --test-threads=1` (combined invocation) | 1 PASS / 0 FAIL | 1.52s test time |
| `cargo test --test 32_definition_publish_admission -- --test-threads=1` (combined invocation) | 4 PASS / 0 FAIL | 7.20s test time |
| `cargo test --test 34_identity_repair_operator -- --test-threads=1` (combined invocation) | 2 PASS / 0 FAIL | 0.98s test time |
| Complete seven-target invocation | **rc0 / 502 PASS / 0 FAIL** | **623.368s command wall time** |
| `baseline-creator` on base source plus the identical reused tests | rc101; 1 PASS / 1 expected regression FAIL | 28.155s including compilation |
| `baseline-continuity` on base source plus the identical reused tests | rc101; 0 PASS / 1 expected regression FAIL | 10.340s including compilation |


The six common targets are existing regression suites; the continuity target and two creator SQL cases are reused unchanged from the original repairs. The baseline's production source is the exact selected main: only the same two test files are copied into a detached task worktree. `baseline-test-oracle.json` records those test hashes and confirms no `src/` change. It supplies a bounded regression contrast for the integrated fixes; it is not a full-baseline-suite claim. Any existing common-suite failures are named below rather than hidden.

The selected-main baseline reproduces exactly these two repaired failures:

- `query_worklists::creator_sql_exact_creator_with_legacy_assignee_lists_and_combines`: `item.combined_executable` is false at `worklists.rs:64` (baseline-creator rc101, 1 pass/1 fail).
- `canonical_assignee_reads_and_advances_where_stale_uuid_stored`: canonical successor detail returns 404 instead of 200 at test line 277 (baseline-continuity rc101, 0 pass/1 fail).

Both pass on candidate `cf2397b`. The non-creator successor denial case also passes on both. No failing common existing candidate test was observed across the seven targets; no full all-repository baseline run is claimed.

DSH execution mock suite: 69 passed, zero failed, rc0, 4.632343s at `4c8fe591`. Broker's principal manifest tests passed 3; `workflow-instances.test.js`, `workflow-my-tasks.test.js` and `workflow-transition.test.js` failed to load because `croner` is unavailable. This is `ERR_MODULE_NOT_FOUND`, not an executed business-case regression. A root lockfile is absent, so the authorized locked dependency restore and broker retry were NOT_RUN; no dependency version, lock or global install was changed. No R2 JavaScript product delta exists. These mock results do not establish T3 warm-context model behavior.

## T1 exact gap and concrete proposal

[Draft Svc #108](https://github.com/mayf3/svc-workflow/pull/108) carries V2's complete body byte-for-byte and retains all three external pins, history, grants and frozen repair membership. It proposes only #1277 §4.2: reject explicit legacy input; resolve supported internal historical targets, validate Q and persist Q in new responsibility; return a validated target to writers; keep original request/hash/provenance and actual actor receipts. T62's old Q-validated/P-persisted assertion remains unchanged in product source and is not presented as the desired T1 behavior.

**OQ-NW-001** is a real, unresolved product failure/activation decision: with admission disabled, should assignment-producing commands fail closed, or may dormant behavior remain only for named finite consumers and an objective version/exit boundary? Neither branch is selected by the implementation agent. The user was asked this exact question after the reviewable proposal existed. No answer/acceptance is inferred from elapsed time.

Independent proposal review is `PASS_AS_PROPOSAL_NON_READY`, not acceptance. The full frontmatter syntax check fails on a pre-existing authority-ID/schema mismatch: V2's real Architecture `V0_4_1` and V3's real Architecture `V0_4_7` each fail the stock strict `_V[0-9]+` reference regex. This is recorded as `TD-NW-001`, with exact base/candidate errors; no authority is renamed, gate modified or full syntax PASS claimed. It needs lawful resolution before future acceptance, rather than an invented new product gate here.

## Step-by-step delivery

| Step | State | Completed delta / blocker and exact next action |
| --- | --- | --- |
| T0 | **DONE (source/local verification)** | R1 minimal integration preserved; seven targets 502/0; exact reused baseline contrast; unchanged source review reused. R2 final report receipt review is recorded below. |
| T1 | **BLOCKED (implementation)** | Finite docs-first proposal #108 authored and independently reviewed as NON_READY. OQ-NW-001 plus accepted/main authority remain missing; no write-site/admission/T62 policy code changed. |
| T2 | **BLOCKED** | Ordered dependency on T1; assigned-list OR and assistance role matrix unchanged. Prior assignee/creator subpredicate repair stays integrated. |
| T3 | **BLOCKED** | Ordered dependency plus native/successor/unresolved projection and consumer-window decision; no Rust DTO or JS behavior change, no warm-context model acceptance claim. |
| T4 | **BLOCKED** | No new migration inventory or disable-legacy rehearsal completed. Existing repair regression 2/2 passes, which does not itself fulfill T4 or expand its closed scope. |
| T5 | **BLOCKED** | Actual retirement dependencies and preceding steps unresolved; no legacy Auth, current bridge or guard removal, no release/merge/deployment. |

## Independent review and readiness

R1 exact `cf2397b` source semantic review is reused. `/root/t1_authority_audit` independently reviewed proposal `2774760` as `PASS_AS_PROPOSAL_NON_READY`; it is not acceptance and explicitly preserves OQ-NW-001 / syntax FAIL. `/root/r2_evidence_audit` independently reviewed DSH report HEAD `566ef99a6a81ad6438881924048cf4d5e7fa4e79` / tree `b43517f49982328d53b7465e2d2c8fe14d2f567c` and exact Svc `cf2397b`, returning **PASS_BOUNDED_R2_EVIDENCE**, with all six review groups passing in the bounded T0/local evidence scope. It verified 28/28 manifest entries, all 10 gzip archives, six command/mock/precheck log hashes, the initdb hash, unchanged source and same-test baseline contrast. `B1277-T0-DB` is closed. Overall source/merge/operation readiness remains NO for the named T1 and later gaps. The accompanying receipt-only delta receives a final bounded HEAD recheck; its result is linked from the issue delivery.

Final base readback: Svc main remains `35c3b685`; DSH main moved to `0386b34a3d1054c71cbe51a2310fdff4d55c992b` by merging PR #590 / #1332 delivery recovery. `checks/base-impact.json` records the changed paths and confirms zero diff in identity authority, broker/execution source and the five executed mock-test files. No R2 documentation-path conflict is observed. The 69 mock passes remain bound to the actual `4c8fe591` test snapshot, not relabeled as a fresh latest-main run. Existing #1332 work is not repeated or merged into this source task.

The six check groups follow the existing #896/#1332-style structure: AUTHORITY_REVIEW, PRIMITIVE_BOUNDARY_REVIEW, CONTRACT_REVIEW, ACCEPTANCE_COVERAGE_REVIEW, MANDATE_SCOPE_REVIEW and EVIDENCE_REVIEWABILITY. R1's unchanged source review is reused. R2 never equates a proposed Spec, compilation, mock code test or source review with installation/adoption/business acceptance.

SPEC_COMPLIANCE: bounded T0 source and executed local regression PASS; T1–T5 complete conformance NOT_VERIFIED; no out-of-scope product implementation.

`T1_IMPLEMENTATION_ALLOWED=NO; OVERALL_SOURCE_READY=NO; MERGE_READY=NO; MERGED=NO; INSTALLED=NO; ENABLED=NO; BUSINESS_VERIFIED=NOT_TESTED`.

**PRODUCTION_CHANGE=0 / PRODUCTION_DB_WRITES=0 / PRODUCTION_DB_ACCESS=NO.** No session reset, real business transition, deployment, installation, production restart, credential/grant change, production inventory scan or legacy-auth/guard disablement occurred. The original source branches and Draft PRs remain reviewable; no PR is merged.

The next dependent action is the finite T1 disabled-mode decision and accepted/main authority, followed by T1 implementation and its changed T62/write-path tests. T2→T5 remain ordered and blocked on those dependencies. No production operation is authorized by this handoff.
