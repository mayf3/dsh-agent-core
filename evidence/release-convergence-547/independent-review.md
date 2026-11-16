# RELEASE-CONVERGENCE-547 independent report review

Result: **PASS for the bounded documentation/evidence delivery.** No material report-accuracy, authority, scope or evidence contradiction was found. Production release, rollback, restart and merge remain unauthorized by this task.

## Exact coordinates and independence

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = AFFECTED_CONTRACT
REVIEW_TARGET_HEAD = 0f96a5e09b15e206ec7c1b8ba45b1b8558966e01
BASE_HEAD = 6ad69d1fa6fa8c7dcfb3b5b61207c7d21a80ecef
CURRENT_BASE_HEAD = 6ad69d1fa6fa8c7dcfb3b5b61207c7d21a80ecef
REPORT = RELEASE-CONVERGENCE-547.md
REPORT_SHA256 = 107a6e70ad3102927a10007698967ce4a9911b8462e93cda2849c4db8906caee
REVIEWER_ID = /root/overlay_audit
AUTHOR_ID = /root
AUTHOR_INDEPENDENCE = PASS_FOR_REPORT_CROSS_SOURCE_REVIEW
ASSURANCE_LEVEL = DURABLE
REVIEW_SCOPE = FULL
FULL_REVIEW_BASIS = INITIAL_REVIEW
SCOPE_REASON = Initial bounded review of the five requested report subjects and their persisted evidence
BASE_IMPACT = BOUNDED
```

Root authored the report; this reviewer did not author its semantic text. The reviewer authored `overlay-findings.json` earlier. This review therefore independently evaluates the report's cross-source accuracy, its use of publisher/rollback/root captures and the mandate. It does **not** claim independent re-authentication of the reviewer's own overlay capture. No new production reads, authsvc calls, live methods, store constructors, tests, installation, restart, signal or Git-ref writes were performed for this review. Only this review file was written.

## Frozen scope and findings

```text
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = PASS
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS_FOR_REQUESTED_READONLY_REPORT
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS_FOR_SANITIZED_COORDINATE_BOUND_REPORT
FROZEN_BLOCKER_UNION = []
BLOCKERS = 0
SPEC_GAPS = 0
FOLLOW_UPS = 0
TOOLING_DEBT = 0
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO                         # user requested PR without merge
OPERATION_ALLOWED = NO                   # production mutations
NEXT_ACTION = CONTINUE                   # root may complete authorized docs/Git/PR delivery
```

The applicable mandate is the user request plus `BRIEF-RELEASE-CONVERGENCE.md`. PLH V4 C-018/C-019/§12.2, Admin Abandonment V1 D6, Scheduler V3 C-038/§9 and DCP V1 supply the directly affected boundaries. Their accepted meaning was not changed. The report neither treats operational history as Product Authority nor grants itself production permission. Finding unavailable rollback combinations is an authorized investigation result; it does not require executing a rollback.

The report supports these distinctions:

- PID 16139 is absent from the current capture. Its historical argv and `etime` support an approximate start inference, explicitly not an original native `lstart`. #1374 wrote disk while that PID remained alive. The report does not certify historical loaded bytes from later disk hashes or equate a TERM request with exit.
- PID 22118 is separately bound to authsvc/PPID1, launchd identity, UTC `lstart` and the installed paths. The capture scripts explicitly set `TZ=UTC`. App mtime/ctime and sampled external times precede that start. The report labels this temporal support and retains UNKNOWN for memory bytes, trusted immutable installation and the actor/cause of that start.
- The complete named composition includes the six-file 081 delta, Gap B, external Harness #1386 and the extra three-file #1374 app delta. Provenance has five matching declarations and one stale admin hash. The 355-file selected source census explains exactly nine differences, while excluding full dependency/build attestation from its claim.
- The five target records remain UNKNOWN with absent termination/settlement evidence. Current Gap B contributes four own-record admission blockers and exempts the HR record carrying marker plus owner-risk audit. The report does not extend that one-record projection to whole-Agent admission or business recovery, and it does not reuse the old fixed95 five-of-five blocker count as current.
- The D-STORE v5 evidence is quoted at its exact fixed95 reader and snapshot coordinates: real scratch constructor, 141/141 assertions, four available correlation checks and 28 malformed-neighbor rejections. The stdout SHA matches. Current faults-sidecar consumption differs; old mechanism PASS is not promoted to current full-store or production startup PASS.
- All 11 bounded historical backups have the eight selected reader hashes identical to exact393. Four current legacy tuples necessarily hit the old cross-field rejection branches. The report correctly labels this source-proven rejection plus a historical original-state LOAD_FAIL, and explicitly says no current constructor was run. It keeps source-compatible composite variants NOT_READY, rather than claiming them either usable or globally impossible. Edited-fence and stale-state copies are excluded from lawful rollback.
- Publisher evidence identifies the recorded `agt_itops-agent` tool/result chain, with native event coordinates and hashes. Human installer, original Owner-approval authenticity and the later PID22118 causal chain remain UNKNOWN. File ownership, Git authorship and `source.kind=user` are not promoted to those missing identities.

No production convergence/retirement or new-path business success is claimed. The convergence-exit gate is therefore NOT_APPLICABLE to this docs-only delivery: the report closes the requested evidence inventory while retaining unresolved operational qualification.

## Actual local checks

Executed a local Python cross-check (rc=0) with **20 assertions**, covering:

1. Exact candidate HEAD and report SHA matching `validation.json`.
2. Two app manifests equal, 1703 entries / 1387 files / 27 links, and recomputed custom manifest digest.
3. All app ordinary-file mtime/ctime preceding PID22118 start.
4. Selected source census 355 / nine differences / no absent Git paths; all nine equal the six-file-plus-#1374 path set.
5. Six provenance declarations with exactly five matches and the explained Gap B admin delta.
6. Backup count/families 6 ce1d + 2 f917 + 3 23fb; all selected readers equal exact393, without pretending new constructor execution.
7. Protected-summary and supplement SHA binding, five target identities, four legacy + one ordinary shape, and current four-versus-one Gap B projection.
8. Fixed95 historical QA stdout SHA.
9. Four publisher components retaining human/Owner-authenticity UNKNOWN; historical `etime` distinct from `lstart`; matching tool-call/result IDs for #1386, Gap B and #1374.
10. Report local links resolving, with this not-yet-written self review path the sole permitted pending target during the check.

`git diff --check BASE..REVIEW_TARGET_HEAD` returned rc=0. The 16 changed paths are only the brief, report and evidence family; no product source, accepted authority or production file is changed. The existing validation receipt's document/syntax checks were inspected; product tests and store constructors were not rerun.

One nonblocking receipt wording note: `rollback-findings.json` repeats `1386` in the current-combination label before also saying `external Harness#1386`. The same row and the report clearly describe one two-file Harness overlay; there is no second installed #1386 component. Root may normalize this label in the final receipt-only delta. No report claim or rollback disposition depends on that duplicate label.

This review recommends completing the authorized commit/push/PR handoff. It is not Owner acceptance, merge permission, runtime admission, rollback qualification or a production business result. Any final receipt-only commit should be checked for the exact bounded delta and unchanged report SHA; it does not require repeating production capture or mechanism QA.

Reviewed at UTC: 2026-11-08T17:40:15.272596+00:00
