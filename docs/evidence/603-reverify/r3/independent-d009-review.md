# R3 independent D-009 static affected-path review

Recorder: `/root`; reviewer: `/root/d009_audit`, who did not author the candidate. This preserves the returned read-only review; it is not an Owner acceptance or a shell command rc.

```text
SPEC_GOVERNANCE_MODE = REVIEW
REVIEW_KIND = AFFECTED_CONTRACT
REVIEW_SCOPE = DELTA
REVIEWER_ID = /root/d009_audit
AUTHOR_INDEPENDENCE = PASS
REVIEW_TARGET_HEAD = 91e224bc079f26cef285cba6da0872cb640ed330 + reviewed working diff
BASE_HEAD = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed
CURRENT_BASE_HEAD = NOT_FRESHLY_RECHECKED_BY_REVIEWER
OBSERVED_AT = 2026-11-07T04:40:54Z
AUTHORITY_REVIEW = PASS
CONTRACT_REVIEW = PASS (static affected paths)
BLOCKERS = 0
SPEC_GAPS = 0
MERGE_READY = NO (not authorized)
OPERATION_ALLOWED = NO
```

Four-product-file diff SHA256 `0648557ec25d8be06447fff0b29ff9af61bc234ab0fcaa5170fcc3f333c0b5ad` equals R2; runtime/canary/shutdown bytes equal R2. No Scheduler/Router source or D-009/Alignment authority diff. Review reused the passing source result after byte checks; it did not run dynamic gates.

- `packages/scheduler/src/auto-reconcile.js:35-76`: current trusted Router, settled/fresh/exact identity/epoch/coherence gate; `failed` only from `exact_turn_end_failure` (59-70). Termination-only chooses `terminated_without_outcome` (73-74).
- Same file 110-122: only terminationSettlement, terminalEvidence, UNKNOWN-to-UNKNOWN history and endedAt; no state=failed, executionOutcome or lateSettlement. Lines 144-175 re-read and re-fetch under lock; 168 NoWrite; 162 rebuild aggregate fences.
- `packages/production-runtime/src/scheduler/auto-reconcile-runtime.js:41-59,72-76`: DEFAULT OFF, `_readDocRaw()` only; non-V3 UNKNOWN; lock-time OFF/stop recheck.
- `packages/scheduler-router/src/index.js:266-307`: termination readback keeps status=outcome_unknown, attaches termination evidence.
- `packages/scheduler/src/self-ops/invoker-outcome.js:70-76,137-178`, `occurrence.js:228-232,398-424`: UNKNOWN priority and separate termination/business writers.
- `packages/scheduler/src/self-ops/index.js:174-228` and `control.js:377-423`: self/operator termination append preserves UNKNOWN.
- `packages/scheduler/src/occurrence-model.js:64-67`: aggregate fence contribution remains for UNKNOWN with neither settlement.
- Canary definitions at 253-276,279-313,348-366,369-382 cover ordered three-way mapping, zero-write, V2 byte hashes, late append and aggregate fence; definition review is not dynamic full-suite evidence.

## Accepted authority binding (present in base)

| Authority | Git blob |
|---|---|
| D-009 sections 8.3-8.5 | `fd4ee0df516fd1cda800e586dd05cab8bfc355eb` |
| Timeout V3 C-001..004/C-028/C-039..045 | `89e15887a5a98a9a4b4162731852866bbcf0dca6` |
| D009 Alignment CTR-527D2-002..004 | `00924a3a83cf0a5fa28c8a15f8c2267726071fcf` |
| Watchdog CTR-RECON-001 | `27cfdb7b8ead2c42a6f3a1b7f5646ac199610b9e` |

Full Scheduler/D-009 dynamics and final-HEAD verification remain NOT_RUN after the R3 gate failed. Static PASS cannot substitute for them.
