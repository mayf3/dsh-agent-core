/**
 * Compat barrel (AMENDMENT_3 C2, REWRITTEN_IN_PLACE / REMOVED = NO): the
 * history family moved to src/history/ as a mechanical, byte-verbatim
 * restructure. Every export of the former single-module implementation is
 * re-exported unchanged, so src/index.js, the scheduler history tests,
 * scripts/agentcore-cron.mjs, and packages/product-api stay zero-touch.
 * This module carries no logic.
 */

export {
  HISTORY_STORE_VERSION,
  HISTORY_OUTCOMES,
  STATUS_VIEW_VOCABULARY,
  ERROR_CODES,
  RESULT_ERROR_CODES,
  RESULT_STATUSES,
  deriveStatusView,
  deriveErrorCode,
  buildRunRecord,
  applyRunFilters,
  HistoryStore,
} from './history/history.js'
