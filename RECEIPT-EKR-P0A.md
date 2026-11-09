# RECEIPT-EKR-P0A

STATUS=STOPPED_REQUIRED_GATE_FAILURE; source implementation is staged and UNVERIFIED.

## Coordinates

- Repository: mayf3/dsh-agent-core; branch `ac-ekr-p0a`; worktree `/private/tmp/dsh-ekr-p0a`.
- Base SHA: `8011b5a5e776fa92eba79c1ede067b9e762311f9`.
- Current HEAD SHA: `8011b5a5e776fa92eba79c1ede067b9e762311f9` (no new commit).
- Staged candidate diff SHA-256: `a313182152e5212f4462b44df206086a78198249eb8b71aae61e9cc9e6e5a464`.
- PR URL: NOT_CREATED. Push/commit/merge: NOT_DONE. Production writes: 0.
- Mandate: [#1374 §2](https://github.com/mayf3/agent-control/issues/1374) + user P0-A contract. Accepted authority reused: WAE V3 CTR-WAE-002/004/005, SRE V2 CTR-SRE-001/002/003/005, WEC V3 CTR-WEC1-004/005/008. No Spec changed.

## Implemented candidate design (not execution proof)

Five public atomic settlement methods require explicit `expectedAttemptId` and positive integer `expectedGeneration`: recordReconciled, recordStaleSuperseded, recordEscalationRequested, recordDeliveryFailed and recordRecoveryRefused. The pair is copied from the observer snapshot; comparison occurs after fresh replay under the existing mutation lock and before terminal/source-state guards. Generation is the WAE attempt generation, with legacy generation-1 replay preserved; Router processGeneration/epoch is not substituted.

Identity mismatch returns `committed:false`, `action:'stale_observation'`, `cause:'stale_observation'`, the old observation fields and a current-attempt snapshot. It appends no event. Normal reconcile, pending/terminal stale, retry and escalation propagate the original observation identity. Helpers return the full result to the engine's `staleObservations` summary; admission-limit escalation can return the action directly. No replacement request or retry is introduced. Private admission/recovery writers remain inside their original fresh-read locked callbacks; lock scope and UNKNOWN judgments are unchanged.

Diff: five source files (`attempt-identity.js`, `engine.js`, `ledger-records.js`, `ledger.js`, `terminal-attempt-operations.js` under workflow-execution), existing test caller identity migration, pure test identity helper, new deterministic disk-ledger/child-process interleaving tests, and old stale tests relocated/split below 500 lines. Exact list and hashes: [candidate-state.json](docs/evidence/ekr-p0a/candidate-state.json); original patch: [candidate-staged.patch](docs/evidence/ekr-p0a/candidate-staged.patch); [diff/status](docs/evidence/ekr-p0a/diff-status.raw.txt).

## Actual gates and raw outputs

[Raw working/cached output](docs/evidence/ekr-p0a/precommit-diff.raw.txt):

```text
COMMAND: git diff --check

EXIT_CODE: 0
COMMAND: git diff --cached --check
packages/workflow-execution/test/observation-cas/stale-reentry.test.js:472: new blank line at EOF.

EXIT_CODE: 2
```

The working check preceded staging and did not cover previously untracked new files. The cached check first exposed the extra EOF blank in the relocated test file. This is a whitespace failure, not a reproduced semantic failure. Under the explicit failure-stop redline, no repair or later product write was performed.

- Interleaving regression output: NOT_RUN (no output exists). Prepared cases: normal turn, pending stale same phase+timestamp, terminal stale, run-ended retry, Owner-resume escalation, concurrent pollOnce across two real ledger handles, separate child process with actual disk replay, independent ID/generation mismatch, five-method malformed input, same-generation commits and terminal refusal.
- Existing workflow and scheduler/scheduler-router regressions: NOT_RUN.
- Full structure verifier: NOT_RUN. Read-only staged code line inventory has max 487 lines; this is not a complete structure PASS. [Inventory](docs/evidence/ekr-p0a/changed-lines.raw.txt).
- Independent `/root/authority_review` authority and source static review: no concrete semantic blocker found, no tests executed, no exact committed-Head review possible. DURABLE assurance is INCOMPLETE.
- Local isolated test dependency installed: croner@10.0.1 under `/private/tmp/ekr-p0a-test-deps`, ignored worktree node_modules symlink; no tracked package files changed.

## Stop and UNKNOWN

[STOPPED-EKR-P0A.md](STOPPED-EKR-P0A.md) binds the required-gate failure to matrix G1 lines 33–41. Minimal next work after resumption is one EOF whitespace removal, followed by the original required gates and independent executed review; no additional product requirement is proposed.

SOURCE_VERIFIED=NO; IMPLEMENTATION_ALLOWED=NO_AFTER_STOP; MERGE_READY=NO; OPERATION_ALLOWED=NO. Runtime loading, installation, cross-service E2E, production enablement and business acceptance remain UNKNOWN. No production writes, no 15-node window-tool changes, no accepted Spec changes, and no UNKNOWN recovery/replay were performed.
