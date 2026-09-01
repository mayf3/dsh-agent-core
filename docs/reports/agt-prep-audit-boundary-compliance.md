# agt-prep-audit-boundary-compliance — checklist E across all six preparation-track branches

- AUDITOR: independent audit subagent, goal PRODUCTION_RND_PARALLEL_PREPARATION_V1 (PREPARATION TRACK)
- SCOPE: every commit on the six local prep branches; verified from the audit worktree at BASE github/main `840d2f4ad91f8252eb1f163330c041216a0dd9c4` via `git merge-base`, `git log`, `git diff --name-status`, blob-hash comparison, and content scans. No network, no remote ops, no live queries.

## VERDICT: PASS — combined boundary compliance for the preparation goal so far (0 violations; 1 note)

## 1. Commit census and base-commit check

| Branch | Tip | merge-base with 840d2f4 | Commits on branch (840d2f4..tip) |
|---|---|---|---|
| prep/session-messaging-investigation-v1 | 04e0c81 | 840d2f4 (OK) | 04e0c81 PREP_SESSION_MESSAGING_INVESTIGATION_V1 |
| prep/scheduler-semantics-investigation-v1 | 33ae996 | 840d2f4 (OK) | 33ae996 PREP_SCHEDULER_SEMANTICS_INVESTIGATION_V1 |
| prep/session-spec-revision-v1 | eaa3e3d | 840d2f4 (OK) | 04e0c81 (inherited) + 037249f PREP_SESSION_SPEC_REVISION_V1 + eaa3e3d merge |
| prep/scheduler-spec-revision-v1 | 4c285c6 | 840d2f4 (OK) | 33ae996 (inherited) + 691e722 PREP_SCHEDULER_SPEC_REVISION_V1 + 4c285c6 merge |
| prep/forum-fleet-investigation-v1 | a4fbaf3 | 840d2f4 (OK) | a4fbaf3 PREP_FORUM_FLEET_INVESTIGATION_V1 |
| prep/workflow-readiness-investigation-v1 | 66fcb7f | 840d2f4 (OK) | 66fcb7f PREP_WORKFLOW_READINESS_INVESTIGATION_V1 |

Every branch bases exactly on 840d2f4; every tip sha matches the goal-state manifest.

## 2. Changed-path census — zero product code anywhere

Changed paths per branch (all `A` = new files; no existing file modified on any branch):

- session-messaging-investigation: `docs/investigations/AGENT_SESSION_MESSAGING_PREP_INVESTIGATION_V1.md`, `docs/reports/agt-prep-session-messaging-investigation-v1.md`, `evidence/session-messaging-code-excerpts.md`
- scheduler-semantics-investigation: `docs/investigations/SCHEDULER_SEMANTICS_PREP_INVESTIGATION_V1.md`, `docs/reports/agt-prep-scheduler-semantics-investigation-v1.md`, `evidence/scheduler-code-excerpts.md`
- session-spec-revision (= investigation + ): the 3 above + `docs/reports/agt-prep-session-spec-revision-v1.md`, `docs/specs/AGENT_CORE_AGENT_SESSION_MESSAGING_V1.md`
- scheduler-spec-revision (= investigation + ): the 3 above + `docs/reports/agt-prep-scheduler-spec-revision-v1.md`, `docs/specs/AGENT_CORE_SCHEDULER_RUN_HISTORY_V1.md`
- forum-fleet-investigation: `docs/investigations/FORUM_FLEET_PREP_INVESTIGATION_V1.md`, `docs/reports/agt-prep-forum-fleet-investigation-v1.md`, `evidence/forum-fleet-code-excerpts.md`
- workflow-readiness-investigation: `docs/investigations/WORKFLOW_READINESS_PREP_INVESTIGATION_V1.md`, `docs/reports/agt-prep-workflow-readiness-investigation-v1.md`, `evidence/workflow-readiness-code-excerpts.md`

Every changed path lives under `docs/investigations/`, `docs/reports/`, `docs/specs/`, or `evidence/`. Zero `packages/**`, zero `scripts/**`, zero manifest/config changes anywhere.

## 3. workflow.js integrity

`packages/broker/src/capabilities/workflow.js` blob hash on all six branches = `83df50eb9947c865a2df531b05285c5e0f3eae0c` = BASE 840d2f4 blob. UNMODIFIED on every branch. (This file is another goal's exclusive surface; no prep branch touched it.)

## 4. Protected-doc check

No branch modifies any transition-closure, Recovery/Rollback/Deployment-Authority, or other pre-existing governance doc: the diff of every branch vs BASE contains ONLY additions listed in §2 — no `M`/`D` entries at all, hence no existing decision/spec/runbook/report file was altered (in particular nothing under docs/decisions/, and none of the workflow-transition specs/runbooks).

## 5. Secret scan

All added content on all six branches scanned for: `sk-`, `ghp_`, `mc_[A-Za-z0-9]{24}`, `BEGIN (RSA|EC) PRIVATE KEY`, `password=`, `token=` (value form). Raw hits and disposition:

- prep/forum-fleet-investigation-v1: 1 hit — prose "a denied token = deny (fail closed, never an error surface)" (quoting the compose.js fail-closed comment). False positive.
- prep/workflow-readiness-investigation-v1: 3 hits — "task-language ALIAS of workflow_transition" lines (regex `sk-` matching inside "ta**sk-**language"; false positive) and an evidence excerpt line `accessToken = await getAccessToken(credential, target, scope)` (quoting code shape; no credential value). False positives.
- All other branches: 0 raw hits.

**RESULT: NO secrets in any added file.**

- NOTE (N-1, note severity, not a secret): the scheduler investigation copy (branches prep/scheduler-semantics-investigation-v1 and prep/scheduler-spec-revision-v1) embeds production identifiers `chat:oc_0480991b97f1e27c96514ac66b4f122c` and `cli_a9d7` in migration row C1, quoted from staged runbook documents. Identifiers are not credentials and were already in repo-owned docs, but the recovery-track owner should be aware production-surface identifiers now sit on prep branches.

## 6. Investigation-evidence integrity (cross-check)

The two investigation documents on their branches are byte-identical to the sealed copies at `reports/2026-09-02-R1/` (diff-verified: SESSION_INV_SEALED_MATCH, SCHED_INV_SEALED_MATCH). The spec-revision branches merge those investigation commits unchanged (eaa3e3d and 4c285c6 are pure merges; `git diff` of each spec branch vs its investigation branch shows only the spec + revision-report additions).

## 7. Verdict

**PASS.** All six prep branches: correct base, docs/evidence-only changes, zero product code, workflow.js untouched, protected docs untouched, no secrets. Combined boundary-compliance verdict for PRODUCTION_RND_PARALLEL_PREPARATION_V1 so far: COMPLIANT. Findings: none above note severity (N-1 identifier note only).
