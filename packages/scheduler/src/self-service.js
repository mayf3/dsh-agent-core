/**
 * Compatibility barrel (AMENDMENT_3 structure closure, C2/C3): the self-service
 * implementation lives in ./self-service/ (index/access/schema/projections/
 * critical-job-guard). Pre-split importers keep this specifier untouched.
 */
export { createSelfServiceSchedulerAccess, SELF_SERVICE_ERROR_CODES } from './self-service/index.js';
