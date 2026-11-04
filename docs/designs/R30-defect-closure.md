# R30 Recovery Defect Closure

Status: isolated implementation; production deployment remains `NOT_APPLIED`.

## 1. Open-fault reconciliation

`ProcessHealthWatch` now maintains an open-fault registry keyed by exact agentId/generation. It still edge-alerts once, but every polling round reconciles every unresolved exit and invokes recovery again. Fault attempt/first-seen/last-seen data is observable. Healthy state closes the corresponding fault. `RecoveryRecurrenceMonitor` escalates by fault age, not an arbitrary second callback; failed recovery attempts remain open and are retried.

## 2. Escalation closure

`GovernanceEscalationDispatcher` requires injected governance operations: persist an item, resolve a legal owner, notify that owner, and confirm a delivery receipt. It retries the complete chain three times and returns an explicit undelivered result if dependencies or receipts fail. The router composition uses `cfg.r30EscalationDeps`; a log line is only a diagnostic after the durable delivery path fails.

## 3. Production composition and durable history

The router creates a file-backed recovery history next to the durable reconciliation file (`<reconciliationStoreFile>.r28-history.jsonl`). `runR28Recovery` injects that store into the executable state machine and fails closed if `cfg.workflowRecoveryDeps` is absent. This is the production composition seam: deployment must provide detect/evidence/recover/KICK/verify/continue adapters; no in-memory-only execution path is accepted for production.

## 4. Honest tests

The former synthetic file is now `r28-recovery-state-machine.test.js` and is explicitly named as a composition test; injected verify/continue answers are not claimed as cross-system evidence. `r30-real-workflow-recovery.test.js` is the release-rehearsal path, gated on real `R30_REAL_WORKFLOW_BASE_URL` and `R30_REAL_WORKFLOW_TOKEN`; without those immutable external inputs it remains visibly skipped. It cannot silently substitute fake Workflow receipts.
