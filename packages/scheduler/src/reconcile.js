/**
 * Dedicated control-only reconciliation seam (C-029).
 * The implementation remains in control.js so all Job/occurrence control
 * mutations share one domain module and one store mutation authority.
 */
export { reconcileOccurrence } from './control.js'
