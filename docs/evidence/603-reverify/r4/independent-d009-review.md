# R4 independent D-009 affected-path review

Recorder `/root`; independent read-only reviewer `/root/d009_review` did not author the candidate, run tests, or write files. This records the returned semantic review, not a shell rc or Owner acceptance.

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEWER_ID = /root/d009_review
REVIEW_KIND = AFFECTED_CONTRACT
REVIEW_SCOPE = DELTA
AUTHOR_INDEPENDENCE = PASS
OBSERVED_AT = 2026-11-07T04:51:11Z
REVIEW_TARGET_HEAD = 91e224bc079f26cef285cba6da0872cb640ed330 + working diff
BASE_HEAD = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed
CURRENT_BASE_HEAD = NOT_FRESHLY_RECHECKED_BY_REVIEWER (root fetched same base)
AUTHORITY_REVIEW = PASS
CONTRACT_REVIEW = PASS (static affected paths)
BLOCKERS = 0
SPEC_GAPS = 0
MERGE_READY = NO (not authorized)
OPERATION_ALLOWED = NO
```

Six product/test/installer SHA256 and Git blobs match `r2/candidate-coordinates.json`. Four-product diff SHA256 remains `0648557ec25d8be06447fff0b29ff9af61bc234ab0fcaa5170fcc3f333c0b5ad`. Scheduler and Scheduler-Router source and four authorities have no diff against the base. This rebinds passing R2/R3 source review to unchanged bytes; R4 dynamic results are separate.

| Accepted authority, present in implementation base | Git blob |
|---|---|
| D-009, SCHEDULER_OCCURRENCE_OUTCOME_V3 | `fd4ee0df516fd1cda800e586dd05cab8bfc355eb` |
| SCHEDULER_TIMEOUT_OUTCOME_V3 | `89e15887a5a98a9a4b4162731852866bbcf0dca6` |
| AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1 | `00924a3a83cf0a5fa28c8a15f8c2267726071fcf` |
| SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1 | `27cfdb7b8ead2c42a6f3a1b7f5646ac199610b9e` |

Reviewer read Architecture ownership boundaries, D-009 sections 8.3-8.5, Timeout C-001..004/C-028/C-039..046, Alignment CTR-527D2-001..004 and Watchdog CTR-RECON-001.

- `packages/scheduler/src/auto-reconcile.js:35-76`: exact/trusted/current-epoch/coherence gate; only `exact_turn_end_failure` chooses business failed. Termination-only chooses `terminated_without_outcome`.
- Same file `110-122`: only terminationSettlement, terminalEvidence, UNKNOWN-to-UNKNOWN history and endedAt; no failed, executionOutcome or lateSettlement write. `144-175` preserves locked reread, renewed evidence fetch, NoWrite and aggregate fence recomputation through the existing sole writer.
- `packages/production-runtime/src/scheduler/auto-reconcile-runtime.js:41-59,72-76`: DEFAULT OFF, only `_readDocRaw()`, non-V3 returns UNKNOWN without writer; OFF/stop rechecked during locked evidence lookup.
- `packages/scheduler/src/store.js:218-245`: `_readDocRaw()` reads/parses/validates, defaults repairFences=false, no migration or persistence.
- `packages/scheduler-router/src/index.js:266-307`: termination readback keeps outcome_unknown and adds termination evidence.
- `packages/scheduler/src/self-ops/invoker-outcome.js:70-76,137-178`: UNKNOWN precedence and separate trusted termination/business branches; ordinary error branch is distinct from Router termination-only UNKNOWN envelope.
- `packages/scheduler/src/occurrence.js:228-232,398-424`: late UNKNOWN enters termination seam, ordered dispatch separates business and termination writers.
- `packages/scheduler/src/self-ops/index.js:174-228` and `control.js:377-423`: self/operator termination appends UNKNOWN projection; business settlement is separate.
- `packages/scheduler/src/occurrence-model.js:64-67`: another unresolved UNKNOWN retains aggregate fence contribution.
- Canary `253-276,279-313,348-382`: definitions cover three-way mapping, V2 hash zero-write, late outcome append, aggregate fence and no repeated admission. Definition review is not dynamic rc0.

No termination-only-to-failed write path found in the current affected call paths. DEFAULT OFF, UNKNOWN, sole writer, no replay and fence protections remain. The conclusion is scoped static evidence, complemented by root's separately executed Scheduler and changed-runtime gates.
