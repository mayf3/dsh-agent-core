/**
 * @agent-core/agent-router/src/reconciliation/index.js — barrel of the
 * Router reconciliation store split (AGENT_PROCESS_LIFECYCLE_HARDENING_V2
 * C-017..C-019 + CLAUSE-PROC-BOUNDED reconciliation caps).
 *
 * capacity.js      ceilings + fail-loud capacity errors + byte accounting
 * state-machine.js settle-once direct/late machines + evidence vocabulary
 * query.js         non-consuming handle/output/correlation queries
 * store.js         TurnReconciliationStore — the single query authority
 *
 * Legacy import path `src/reconciliation-store.js` re-exports this barrel.
 */

export { RECONCILIATION_CAPS, ReconciliationCapacityError } from './capacity.js'
export { LATE_OUTCOMES, DIRECT_OUTCOMES, TERMINATION_EVIDENCE_TYPES } from './state-machine.js'
export { TurnReconciliationStore } from './store.js'
