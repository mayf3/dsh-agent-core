/**
 * Compat barrel (AMENDMENT_3 C2, REWRITTEN_IN_PLACE / REMOVED = NO): the
 * self-service access layer moved to src/self-service/ as a mechanical,
 * byte-verbatim restructure. Every export of the former single-module
 * implementation is re-exported unchanged, so compose.js,
 * cross-agent.test.js, scheduler-reliability.test.js, and the scheduler test
 * suite stay zero-touch. This module carries no logic.
 */

export {
  createSelfServiceSchedulerAccess,
  SELF_SERVICE_ERROR_CODES,
  parseCriticalInventory,
  evaluateCriticalJobGuard,
  CRITICAL_GUARD_REASONS,
  DEFAULT_CRITICAL_INVENTORY_PATH,
} from './self-service/index.js'
