# #1277 — T0 integration candidate and BLOCKED delivery

GOAL: execute [agent-control#1277](https://github.com/mayf3/agent-control/issues/1277) in its T0–T5 order, source only. STATE: **BLOCKED at T0 database verification**. This record is evidence and a resumable checkpoint, not Product Authority or production authorization.

## Source, base and ownership

| Repository | Isolated surface / branch | Selected base | Candidate |
| --- | --- | --- | --- |
| svc-workflow | `/tmp/ac1277-svc-workflow`, `ac-task/1277-identity-convergence` | `35c3b685db4ac91bc7a216d840fcf19a0fa1a890` | `cf2397b048d84b1c6eadd1170b3cda1c102de11b` |
| dsh-agent-core | `/tmp/ac1277-dsh-agent-core`, `ac-task/1277-identity-convergence` | `0b64aca3615aec203b95aa960eff39d635bd26c1` | documentation/evidence only; Git commit containing this report |

Current source author: `/root` Codex executor. `/root/svc_t0_audit` and `/root/dsh_contract_audit` performed read-only investigation; the former also independently reviewed the fixed svc source candidate. No delegate authored source. Shared checkouts and their dirty files were preserved. Finite local/remote branch and PR checks found no competing #1277 delivery; this does not prove global writer availability.

Prior creator-draft owner/worktree was found rather than replaced: `codex/identity-convergence-p1i-creator-sql` at `c125f39fc995feff3370ca337e1415d07cb3e7e3`, parent `c09dbf86735ca76cef2ab1822dbd0ee1e77ba47b`, clean worktree `/Users/yanfenma/workspace/project/svc-workflow/.worktrees/p1i-creator-sql`. Its report identifies the prior Codex executor and non-author review. **SKIP_REUSE**: use its two existing query tests; do not repeat the creator SQL repair, which is already present on selected main.

`10310a4` versus selected main now has merge-base `18fb2f8bc80983a36b15e65bf51d8f5c4b64fb78`, old side ahead 3 / main ahead 84. Old-only commits are auditor `18a80ad`, provisioning `3a7d5c0`, and continuity `10310a4`. The candidate integrates only the continuity implementation and tests, plus c09's assignee subpredicate. It neither merges the auditor branch nor reintroduces c09's creator-successor SQL OR. Current main's later features remain intact.

## DEVELOPMENT_PREFLIGHT / runbook

- Mandate: user's source authorization and issue plan, with an explicit stop on a BLOCKED step. Product effects, deployment, credentials, sessions, grants and production DB work are forbidden.
- svc authority: accepted `SVC_WORKFLOW_CANONICAL_IDENTITY_RECONCILIATION_V2` (`implementation_authority: contracts`) and existing P9 immutable one-edge `resolve_current_principal`. Its file at selected base has SHA-256 `8d873a72c6d231b5eff689d2f26e0ba6039af638b67216951657a51198c63e5f`. Applicable parent authority is current Product V13 / Architecture v0.4.7, read alongside inherited query visibility and exact-creator constraints. Relevant investigations: `WORKFLOW_ASSIGNEE_CANONICAL_IDENTITY_RECONCILIATION_V1` and `INTERNAL_IDENTITY_DIRECTORY_RECONCILIATION_V1`.
- T0 route: `REUSE / EXEC_PLAN / CONTROLLED`, `ROUTE_STAGE=IMPLEMENTATION`, `AUTHORITY_ACCEPTED_IN_BASE=YES`. Scope is minimum integration of already repaired behavior. No new/amended Spec is needed for this bounded T0 delta.
- Runbook: reuse original tests; copy only the four continuity call sites, shared helper and creator-draft assignee subpredicate; keep exact creator and independent role checks; compile affected targets; run affected tests exclusively against a new owned loopback PostgreSQL cluster; independently review fixed HEAD and receipts. Abort readiness on missing DB evidence or semantic scope expansion. Do not redirect tests to a shared database.
- RETAIN immutable visits/events/creators, Auth facts, role grants, existing directory and audit lineage. TEMPORARY_BRIDGE is the existing supported P9 assignee continuity, with retirement conditions still owned by T4/T5. No new bridge, identity mapping service, history rewrite, alias login or permission cache is introduced.
- T1 route is separate: canonical-only new responsibilities and intentional T62 replacement are a load-bearing Spec delta. No accepted/main change for those semantics was found in the existing CIR V2 history or related PRs. Current svc `.agents/README.md` and `SPEC_GOVERNANCE_V1` require **SUPERSEDE / docs-first** for changing accepted meaning; this is the lifecycle vehicle for the plan's limited semantic amendment, not a redesign. `AUTHORITY_ACCEPTED_IN_BASE=NO`, `IMPLEMENTATION_ALLOWED=NO`. Governing Spec files were not changed.
- DSH current authority is accepted `AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V3`, not the now-superseded V1/V2. Accepted WAE V3 / WEC V3 and `AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1` remain in force. Its current source has split `workflow.js` into `workflow/{reads,execute,dispatch,index}.js`; `workflow-execution/src/engine.js` remains the real dispatcher. Existing descriptions already preserve nullable lineage metadata, ADVISORY_ONLY, service authorization and UNKNOWN readback-only. These are reused, not reimplemented. T3's new current-projection meaning remains unimplemented.
- DONE_WHEN for this attempt: either the required source/test/review gates pass, or a real blocker and exact resumable candidate are delivered to #1277. No readiness claim may substitute for tests. After the owned-DB failure, later T1–T5 implementation stays stopped in the issue's required order.

## Step completion

| Plan step | State | Completed delta / reason and next lawful action |
| --- | --- | --- |
| T0 | **BLOCKED** | Owner/base/reuse/preflight DONE; minimum main integration committed; fixed-HEAD source review complete; seven integration targets compile. Required DB execution and current-base regression evidence are missing. Restore a permitted owned test PostgreSQL environment, then test this exact candidate. |
| T1 | **BLOCKED** | Not entered after T0 stop. Canonical-only new writes and T62 replacement still require the limited docs-first accepted/main authority. No new-write behavior or behavior-defining T62 expectation was changed. |
| T2 | **BLOCKED** | Depends on ordered T0/T1 completion. Only previously repaired assignee subpredicate was integrated under T0. Assigned-list OR and assistance role matrix are unchanged and not declared fixed. |
| T3 | **BLOCKED** | Depends on preceding steps and accepted complete native/successor/unresolved projection semantics plus consumer window. Existing DSH descriptions are reused; no JS behavior or DTO change. |
| T4 | **BLOCKED** | No migration inventory/dry-run/owned-DB retirement rehearsal executed. Existing frozen repair scope is not expanded. |
| T5 | **BLOCKED** | Retirement prerequisites and required test evidence are unmet. No compatibility path, legacy auth capability or production guard was retired. |

## Candidate and verification

The svc candidate changes five source files plus two existing-home test files, +600/-5. Source tree: `65fcd731491cb1d23fa9cea20f550c1f0b14d524`. SHA-256 of **Git binary diff** `git diff --binary BASE HEAD` (not executable bytes): `7e1a50f4d7c1d05d1c25a235b1f7c051570a8e42b808f32919b1145d75ee2c89`.

The helper uses only existing single-edge immutable server lineage. It is shared by detail/history visibility, advisory, transition, combined transaction and creator-draft assignee qualification. Exact creator SQL and write guard, enabled actor checks, state/CAS, assistance, business validation and request/idempotency processing remain. `tests/32_canonical_assignee_continuity.rs` is byte-identical to the original `10310a4` blob `38d73bae2b8ea12f163d06c6f270dcbb146e3d28`; the worklist test file matches `c125f39` exactly.

| Executed check | Result | Evidence / limit |
| --- | --- | --- |
| Owned PostgreSQL `initdb` | rc 1 | `shmget ... Operation not permitted`; cluster bootstrap failed before any test fixture. Original stdout log lacks stderr; full mmap-attempt stderr is retained separately. |
| Explicit mmap `initdb` configuration | rc 1 | Same `shmget` failure, recorded in `initdb-mmap.log`. No shared/production DB substitution. |
| `cargo test --test 32_canonical_assignee_continuity -- --test-threads=1` | rc 101; 0 passed / 1 failed; 97.480s including compilation | `canonical_assignee_reads_and_advances_where_stale_uuid_stored` fails at `tests/common/mod.rs:346` with `PoolTimedOut`. **Infrastructure failure only**, not a behavioral RED. Source was not frozen across this initial compilation; it supplies no baseline/candidate semantic evidence. |
| `cargo test --no-run --test 17_workflow_runtime --test 19_domain_owner_definition_governance --test 23_global_coordinator --test 31_admission_wiring --test 32_definition_publish_admission --test 32_canonical_assignee_continuity --test 34_identity_repair_operator` | rc 0; 20.275s at fixed `cf2397b` | All seven targets compile; **none is a DB test PASS**. Compiler warnings retained. |
| svc governance integrity `python3 .agents/tools/verify_governance.py --target . --require-accepted` | rc 0 | Exact accepted vendored bytes match lock. |
| `git diff --check BASE HEAD` | rc 0 | Source formatting/diff integrity only. |

Exact raw logs and the source diff are stored losslessly as `.gz`; the SHA-256 values in command/review records refer to their decompressed bytes. Exact argv, monotonic command durations, hashes and runner are in [checks](../evidence/identity-convergence-1277-20261031/checks/). `commands.jsonl`'s DB identity label names the intended task-only DSN, not a successful server identity readback: the cluster never started. Both `DATABASE_URL` and `TEST_DATABASE_URL` were explicitly bound to `postgres://ac1277_test@127.0.0.1:57277/ac1277_test`; inherited DB/Auth connection variables were excluded. No test could recover a production `.env` from these isolated clones.

Baseline comparison: **current-base runtime baseline NOT_RUN** because the owned DB cannot start. The single new failure is the named infrastructure failure; no pre-existing product failure or all-green regression is inferred. The older P1-I report's 1,042 passing tests across multiple invocations belongs to its unchanged old source tree, not this new main integration. Its historical SQLx environment mistake/denied setup connections remain in that original report and are not erased by this attempt's zero-production-write claim.

## Independent review and readiness

`/root/svc_t0_audit` independently reviewed exact svc `cf2397b`, tree and diff; author independence YES. AUTHORITY / PRIMITIVE / CONTRACT / MANDATE passed for the bounded source delta; SOURCE_SEMANTIC_REVIEW=PASS, no source-code blockers. ACCEPTANCE execution is BLOCKED; initial EVIDENCE review was partial while command logs were still completing. The evidence completion delta is recorded separately; it does not change the DB blocker.

Frozen blocker union for T0 contains one `REQUIRED_GATE_FAILURE`: current-main integration lacks executed DB acceptance/regression evidence. Source is the user's completion definition 2 and T0 affected verification requirement. Counterexample is the named PoolTimedOut test. Minimum closure: permitted task-owned PostgreSQL cluster, fresh cluster identity readback, both DB environment variables bound, targeted `creator_sql_` plus continuity and affected query/transition/combined/assistance/Domain Owner/coordinator/admission/publish/repair tests, honest baseline failure comparison, and an independent exact-HEAD receipt recheck. Do not replay production work or alter permissions to obtain a test pass.

T1's authority gap is separately recorded for the future step; it does not invalidate authorized T0 source integration. Authority inventory: CIR V2 unchanged; existing related PRs #30/#31/#32/#48/#52 do not accept canonical-only persistence/T62 replacement. Reachable counterexample is current T62's deliberate validation of Q while the new Visit/receipt retain P. Minimum closure is the plan's limited canonical-write contract accepted in the implementation base through current repository lifecycle, preserving historical P, raw request hashes/provenance and all independent role grants.

SPEC_COMPLIANCE: bounded source review found no out-of-scope behavior or reintroduced rejected alternative; full executed conformance is **NOT_VERIFIED**. `TESTS_PASS=NO`, `SOURCE_READY=NO`, `MERGE_READY=NO`. Draft PRs are reviewable checkpoints, not readiness or adoption.

## Delivery and remaining work

SOURCE=T0_CANDIDATE_COMMITTED; COMPILE=PASS; DB_TESTS=BLOCKED; REVIEW=BOUNDED_SOURCE_ONLY; MERGED=NO; INSTALLED=NO; ENABLED=NO; ADOPTED=NO; BUSINESS_VERIFIED=NOT_TESTED.

**PRODUCTION_CHANGE=0 / PRODUCTION_DB_WRITES=0.** This attempt performed no production DB access, session reset, credential/grant change, real business transition, deployment, installation, restart or guard removal. The only database attempt targeted the newly designated task-only loopback endpoint. Git commits, branch publication, Draft PRs and the explicitly requested #1277 delivery comment are the external source-delivery effects.

NEXT: preserve the frozen source candidate and evidence; resolve the owned PostgreSQL environment blocker and complete T0 verification before advancing T1. T1 then follows its finite docs-first authority step; T2–T5 retain the issue's order and retirement conditions. Do not merge or deploy this blocked candidate.
