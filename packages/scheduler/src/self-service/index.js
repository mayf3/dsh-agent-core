/**
 * Public surface of the self-service Scheduler access layer (AMENDMENT_3
 * structure closure). Pre-split importers use the compatibility barrel at
 * src/self-service.js.
 */
export { createSelfServiceSchedulerAccess } from './access.js';
export { SELF_SERVICE_ERROR_CODES } from './schema.js';
export {
  CRITICAL_GUARD_REASONS,
  DEFAULT_CRITICAL_INVENTORY_PATH,
  parseCriticalInventory,
  evaluateCriticalJobGuard,
} from './critical-job-guard.js';
