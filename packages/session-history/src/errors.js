/**
 * Frozen post-auth history error set (MOBILE_SESSION_HISTORY_V1 CTR-SH-002).
 * Every error carries exactly the contract code and its fixed HTTP status;
 * messages are safe non-empty constants — no path, cause, stack or internal ID
 * may enter the envelope (CTR-SH-008 / CTR-SH-014).
 */

const STATUS_BY_CODE = {
  VALIDATION_ERROR: 400,
  AGENT_NOT_FOUND: 404,
  SESSION_NOT_FOUND: 404,
  HISTORY_CURSOR_STALE: 409,
  HISTORY_RESOURCE_LIMIT: 413,
  INTERNAL_ERROR: 500,
}

export class HistoryError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'HistoryError'
    this.code = code
    this.status = STATUS_BY_CODE[code]
  }
}

export const validationError = (message = 'invalid request') => new HistoryError('VALIDATION_ERROR', message)
export const agentNotFound = () => new HistoryError('AGENT_NOT_FOUND', 'agent not found')
export const sessionNotFound = () => new HistoryError('SESSION_NOT_FOUND', 'session not found')
export const cursorStale = () => new HistoryError('HISTORY_CURSOR_STALE', 'cursor is not part of the current session history')
export const resourceLimit = () => new HistoryError('HISTORY_RESOURCE_LIMIT', 'session history exceeds frozen resource limits')
export const internalError = (message = 'internal error') => new HistoryError('INTERNAL_ERROR', message)
