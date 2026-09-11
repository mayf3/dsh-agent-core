/**
 * Agent-facing Scheduler V2 access layer — public face barrel
 * (AMENDMENT_3 C2). Composes the schema, projection, guard, and access
 * modules; the src/self-service.js compat path re-exports exactly this face.
 */

export { createSelfServiceSchedulerAccess } from './access.js'
export { SELF_SERVICE_ERROR_CODES } from './schema.js'
export {
  parseCriticalInventory,
  evaluateCriticalJobGuard,
  CRITICAL_GUARD_REASONS,
  DEFAULT_CRITICAL_INVENTORY_PATH,
} from './critical-job-guard.js'
