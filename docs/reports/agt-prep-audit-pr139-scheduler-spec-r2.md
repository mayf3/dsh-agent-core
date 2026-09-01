# agt-prep-audit-pr139-scheduler-spec-r2 — independent audit of PR #139 (AGENT_CORE_SCHEDULER_RUN_HISTORY_V1 r1 → r2)

- AUDITOR: independent audit subagent, goal PRODUCTION_RND_PARALLEL_PREPARATION_V1 (PREPARATION TRACK); did not author the audited artifacts
- AUDIT OBJECT: branch `prep/scheduler-spec-revision-v1` @ 4c285c6 (merge of 33ae996 investigation + 691e722 spec r2); OPEN Draft PR #139 — NOT merged by this audit
- BASELINE: github/main 840d2f4ad91f8252eb1f163330c041216a0dd9c4; original r1 draft read from the maintainer checkout (`/Users/yanfenma/workspace/project/dsh-agent-core/docs/specs/AGENT_CORE_SCHEDULER_RUN_HISTORY_V1.md`, staged, read-only)
- METHOD: full r1→r2 diff (870 diff lines) reviewed hunk-by-hunk; every code citation in the revised fact table independently re-read at BASE in the audit worktree, including the four citation groups the author report admits it did NOT re-check (store.js:251-304, lock.js, scheduler-router:260-308, eligibility.js)

## VERDICT: PASS (0 blockers, 0 majors, 2 minors, 3 notes)

---

## A. Frontmatter / perimeter — PASS (with 1 minor form finding)

- `status: proposed`; `implementation_authority: none`; `production_apply_authority: none`; `spec_id: AGENT_CORE_SCHEDULER_RUN_HISTORY_V1` unchanged; `supersedes: []`; `superseded_by: null`; `owners` unchanged; banner reiterates zero authority and zero code/store/production change. No authority elevation anywhere in r2.
- **F-A1 (minor, form):** there is no structured `change_log` key — the r2 change description is embedded in the frontmatter `revision:` field (house style inherited from r1) plus the §9 `R2_FACT_FIXES` line. The session spec's r3 (PR #138) uses a structured `change_log`; the two revised specs are therefore stylistically inconsistent. Content-wise the revision record is complete, so this is form only.

## B. Fix traceability — PASS (S1/S2/S3 located, match the investigation, citations reproduce)

Author report `docs/reports/agt-prep-scheduler-spec-revision-v1.md` claims S1, S2, S3 + logged associate fixes.

| Fix | Changed text located | Matches investigation | Citations re-verified at BASE |
|---|---|---|---|
| S1 — "engine = pre-D-007" FALSE → rewritten D-007-conformant | §0 rewritten; §2.1 engine row fully rewritten with file:line; §1 preflight, §2.3, R1/R1a/R2/R4/R5/R6/R10/R11 wording, §4 closure hooks renamed to real functions (`reserveOccurrence`/`markOccurrenceRunning`/`writeOccurrenceOutcome`/`deliverOccurrence`/`applyJobCompletion`); r1's fictional hooks (`_fireJobs`, `applyRunState`, `isRunnableJob`, `runningAtMs`) purged | matches investigation §A.3/A.4/A.5 and finding D.2 first bullet | `occurrence-model.js:64-75` `occ:`+sha256(len-prefixed coords)[:16] (encodeCoords at :56 confirms len-prefix); `:78-80` run: derivation; `:263` idempotencyKey=occurrenceId; `occurrence.js:34-121` reserveOccurrence entirely inside `store.mutateDoc` (store.js:119-192) with coords dedup :51-61, OCCURRENCE_PAYLOAD_CONFLICT :54-58, eligibility recheck :65-84, assertRunnable :97, admitted push :86-99; five states `occurrence-model.js:21` + `:35-41` (outcome_unknown → succeeded\|failed only); running from start evidence `occurrence.js:124-141`; classification :237-271; deadline→outcome_unknown :213-233 (+ `:317-333` fences); restart sweep `scheduler.js:211-232`; late settlement :354-424; operator reconcile `control.js:175-243` (control.js exists — r1 claimed it did not); `scheduler.js:35` "occurrence ledger, never runningAtMs" — ALL REPRODUCED |
| S2 — "execution records have no occurrence/run identity" FALSE → gap restated as true delta (8 items) | §0 rewritten as "existing facts + honest delta ①-⑧"; §2.1 new rows for occurrence authority ledger / runs.jsonl identity / CLI / self-service; R1 job_snapshot marked real gap; R2 per-field BASE-has / truly-missing annotations; R5 rewrite (definition-side delete already holds; the missing part is post-delete query self-containment); R6 coexistence discipline; R11 R-H2 restated; §5 ACC-001a/007/010 assertions restated to `{version:2, jobs[], occurrences[], fences{}}` shape; ALT-005/006 premises updated | matches investigation §B.1/B.2 (G1-G22) verbatim in substance | `store.js:12` STORE_VERSION=2; doc literal `{version:2, jobs:[], occurrences:[], fences:{}}` at store.js:26 (see F-B1); runs.jsonl append+fsync+10MB `store.js:33-34, 399-448` (sync at :405, truncate at :409); events with occurrenceId/runId: occurrence_reserved `occurrence.js:104-118`, turn_start :140, router_admission :150/:160, outcome :334, delivery :345, late_settlement :412, store_upgrade `store.js:179`; summary NOT persisted (classify :243 feeds delivery text :282-283 only; writeback :293-351 carries no summary); best-effort evidence :426-432; deleteJobOp definition-only `control.js:119-126`; HTTP absence: product-api routes exactly /health + /v1/{binding,agents,switch-agent,message} at `product-api/src/index.js:233-258`, notification-ingress :161/:172; self-service local entitlements non-token-scopes (accepted spec; self-service.js + compose.js:418-429 wiring reproduced); correlationId/parentRunId 0-hit claim consistent with the worktree; CLI occurrence dimension `scripts/agentcore-cron.mjs:20-24, 257-283` — ALL REPRODUCED |
| S3 — governed_by D-006 → D-008 | frontmatter governed_by + related_specs; §2.1 session row; R7/R9 D-006 references replaced; §7 consistency table gains D-008 + SELF_SERVICE rows; associate: SCHEDULER_TIMEOUT_OUTCOME_V1→V2 (V1 marked superseded), wake/dispatcher marked staged WIP not-at-BASE | matches investigation finding D.2 third bullet | D-008 accepted 2026-09-01 via commit b2e3eb1 (git-verified); V3:3 "整份取代 D-006 / V2"; D-006 file carries `superseded_by: D-008` — REPRODUCED |
| Associate fixes (logged in report §2) | R8 gateway.js citation corrected r1 "L164-186" → `gateway.js:153-155, 226-249` (verified: 150-155 doc comment, 226-253 grant-check-before-handler); requiredScopes precedent set updated (workflow.js:92, forum.js:38/66/90/117/161, okr.js:26, agent-definition.js:80 — all reproduce); R8 new reconciliation duty 1 (local entitlement labels ≠ token scopes; ACC-005 negative assertion); R2 request_id_source default 'execution-authority'; R10 AGENT_START_FAILED reclassified as reserved value with no BASE emitter (BASE emits only AGENT_NOT_FOUND / AGENT_DISABLED at scheduler-router:123-131 — reproduced); §4 lifecycle hook names; §7 rows | all internally consistent with S1/S2 | verified |

Citations I could NOT reproduce: NONE — including the four groups the author report flagged as not re-checked: `store.js:251-304` (`_validateDocument` fail-loud), `lock.js:172/:208/:248` (lock_recovery / lock_unverifiable), `scheduler-router:260-308` (createFeishuDeliver), `eligibility.js` rows. All reproduce.

**F-B1 (minor, citation precision):** the claim "jobs.json 是 version:2 文档 `{version:2, jobs[], occurrences[], fences{}}`（store.js:12-16）" is correct in substance but the literal doc shape sits at `store.js:26` (and `store-migration.js:97`); lines 12-16 hold `STORE_VERSION = 2` + module constants. No factual error; anchor range slightly off. Same class of nit: `occurrence.js:213-233` for the deadline timer (resolve at 220-229) is fine; no other imprecision found.

**N-B1 (note):** the inherited investigation copy on this branch embeds production identifiers `chat:oc_0480991b97f1e27c96514ac66b4f122c` and `cli_a9d7` (migration row C1, quoted from staged runbooks). Identifiers, not credentials — outside every mandated secret pattern — but they are production-surface identifiers now committed on a prep branch; the recovery-track owner may wish to note this.

## C. Semantic drift — PASS (0 undeclared semantic changes; frozen semantics intact)

Every substantive r1→r2 delta maps to S1/S2/S3 or a logged associate fix. The frozen target semantics are byte-for-byte preserved in meaning:
- frozen field sets: R1 OccurrenceRecord and R2 RunRecord ten-group field lists unchanged (diff touches comments/annotations only); the r1 R1a fallback derivation formula (`schocc:` / `rev:` / `ph:`) preserved verbatim, repositioned as an edge-case fallback with an explicit "never writes back to the authority ledger" clause;
- D-007 state mapping (R3): vocabulary and mapping unchanged; only BASE-conformance annotations added;
- structured-result contract (R4), deleteAfterRun semantics (R5), history store layout (R6), query API surface (R7 — still exactly GET /scheduler/runs, /scheduler/runs/{run_id}, /scheduler/occurrences/{occurrence_id}), permission model names (R8 — still scheduler.read / scheduler.audit / scheduler.admin), correlation joins J1/J2/J3 (R9), R10 classification value set, R-H1..R-H9 red lines, §2.2 gate chain, ACC-001..010, ALT-001..015 numbering and rulings: all unchanged.

One delta not explicitly itemized in the author report:
- **F-C1 (minor):** §9 summary line `OCCURRENCE_FIELDS = ... payload_hash / admitted_at` gains `/ updated_at`. This aligns the §9 summary with the r1-frozen R1 record, which always contained `updated_at` (r1 L238) — a consistency fix, not a field-set change — but it is not in the report's "additional consistency fixes" log. Zero semantic impact.

## D. Internal consistency — PASS

- No superseded authority is cited as current: D-006 appears only as superseded-by-D-008; SCHEDULER_TIMEOUT_OUTCOME_V1 appears only as superseded by V2; wake/dispatcher related_specs are labeled staged WIP / not at BASE.
- frontmatter governed_by ↔ §2.1 session row ↔ §7 consistency table agree (all D-008); local entitlement vs token-scope separation is stated consistently in R8, ACC-005 and §9.
- §0/§1/§2.1/§4/§6/§9 all tell the same corrected story (engine D-007-conformant; ledger exists; delta = query/semantic layer).

## Findings

- F-A1 (minor): no structured change_log key (see A).
- F-B1 (minor): store.js:12-16 citation range for the v2 doc shape; substance correct (see B).
- F-C1 (minor): §9 `updated_at` summary-line addition not logged in the revision report (see C).
- N-B1 (note): production chat/app identifiers embedded in the inherited investigation row C1 (see B).
- N-B2 (note): the author report's own "verification method" section honestly lists the citation groups it did not re-check; this audit closed all four with positive results.

## E. Boundary compliance (this branch)

`prep/scheduler-spec-revision-v1` @ 4c285c6: merge-base with 840d2f4 = 840d2f4 (base correct); 3 commits (33ae996, 691e722, 4c285c6); changed paths = 5 ADDED files only, all under `docs/investigations/`, `docs/reports/`, `docs/specs/`, `evidence/`. Zero product-code changes; `packages/broker/src/capabilities/workflow.js` blob identical to BASE (83df50eb); no transition-closure/recovery/rollback/deployment-authority doc touched; secret scan clean (see N-B1 for identifiers). See agt-prep-audit-boundary-compliance.md.

## F. Verdict

**PASS.** r2 is a faithful fact-refresh: it corrects exactly the three proven-stale claims (S1/S2/S3) plus logged associates, strengthens the draft's honesty (the delta is now stated against a D-007-conformant BASE), and changes none of the frozen target semantics. Recommended: proceed to the draft's G1 audit round on the r2 baseline with F-A1/F-B1/F-C1 noted (none blocks the audit).
