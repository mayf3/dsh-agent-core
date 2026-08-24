import { createHash } from 'node:crypto'

/** Store document version; bumped only on breaking format changes. */
export const STORE_VERSION = 1

/** Error code for a corrupt / unsupported authority document (fail-loud). */
export const CORRUPT_STORE = 'IDEMPOTENCY_STORE_CORRUPT'

export const STATE_RESERVED = 'reserved'
export const STATE_DELIVERED = 'delivered'
export const STATE_FAILED_NO_ADMISSION = 'failed_no_admission'
export const STATE_OUTCOME_UNKNOWN = 'outcome_unknown'

export const RECORD_STATES = Object.freeze([
  STATE_RESERVED, STATE_DELIVERED, STATE_FAILED_NO_ADMISSION, STATE_OUTCOME_UNKNOWN,
])

export const TERMINAL_STATES = new Set([
  STATE_DELIVERED, STATE_FAILED_NO_ADMISSION, STATE_OUTCOME_UNKNOWN,
])

/** The only Router errors that prove no admission happened (C-IDM-008). */
export const PROVEN_NO_ADMISSION_CODES = Object.freeze(['VALIDATION_ERROR', 'AGENT_NOT_FOUND'])

export const HISTORY_CAP = 16
export const DEFAULT_RETENTION_MS = 604800000
export const DEFAULT_MAX_RECORDS = 100000
export const DEFAULT_SWEEP_INTERVAL_MS = 3600000
export const DEFAULT_ROTATE_BYTES = 10485760
export const EVIDENCE_GENERATIONS = 2

export function storeError(message, code = CORRUPT_STORE) {
  return Object.assign(new Error(message), { code })
}

/**
 * Canonical payload hash over exactly the four frozen wire fields in fixed
 * insertion order. Unknown request fields never participate (C-IDM-002).
 */
export function canonicalPayloadHash({ requestId, agentId, sessionMode, message }) {
  return createHash('sha256')
    .update(JSON.stringify({ agentId, message, requestId, sessionMode }), 'utf8')
    .digest('hex')
}

function validateRecord(record, clientId, requestId, storeFile) {
  const at = `${JSON.stringify(clientId)}/${JSON.stringify(requestId)}`
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw storeError(`notification-ingress: idempotency record is not an object at ${at} in ${storeFile}`)
  }
  if (record.callerPrincipalId !== clientId || record.requestId !== requestId) {
    throw storeError(`notification-ingress: idempotency record identity mismatch at ${at} in ${storeFile}`)
  }
  if (typeof record.payloadHash !== 'string' || record.payloadHash === '') {
    throw storeError(`notification-ingress: idempotency record payloadHash missing at ${at} in ${storeFile}`)
  }
  if (!RECORD_STATES.includes(record.state)) {
    throw storeError(`notification-ingress: idempotency record has unknown state ${JSON.stringify(record.state)} at ${at} in ${storeFile}`)
  }
  if (typeof record.createdAt !== 'string' || typeof record.updatedAt !== 'string') {
    throw storeError(`notification-ingress: idempotency record timestamps missing at ${at} in ${storeFile}`)
  }
  if (record.sessionId !== undefined && (typeof record.sessionId !== 'string' || record.sessionId === '')) {
    throw storeError(`notification-ingress: idempotency record sessionId invalid at ${at} in ${storeFile}`)
  }
  if (record.failure !== undefined) {
    const { code, httpStatus } = record.failure ?? {}
    if (typeof code !== 'string' || code === '' || !Number.isInteger(httpStatus)) {
      throw storeError(`notification-ingress: idempotency record failure invalid at ${at} in ${storeFile}`)
    }
  }
  if (record.outcomeUnknown !== undefined) {
    if (record.outcomeUnknown === null || typeof record.outcomeUnknown !== 'object' || Array.isArray(record.outcomeUnknown)) {
      throw storeError(`notification-ingress: idempotency record outcomeUnknown invalid at ${at} in ${storeFile}`)
    }
  }
  if (record.history !== undefined) {
    if (!Array.isArray(record.history)) {
      throw storeError(`notification-ingress: idempotency record history must be an array at ${at} in ${storeFile}`)
    }
    for (const entry of record.history) {
      if (typeof entry?.at !== 'string' || typeof entry?.from !== 'string' || typeof entry?.to !== 'string') {
        throw storeError(`notification-ingress: idempotency record history entry invalid at ${at} in ${storeFile}`)
      }
    }
  }
}

export function parseDocument(raw, storeFile) {
  let document
  try {
    document = JSON.parse(raw)
  } catch (error) {
    throw storeError(`notification-ingress: idempotency store is not valid JSON: ${storeFile} (${error.message})`)
  }
  if (document?.version !== STORE_VERSION) {
    throw storeError(`notification-ingress: unsupported idempotency store version ${JSON.stringify(document?.version)} in ${storeFile}`)
  }
  if (document.records === null || typeof document.records !== 'object' || Array.isArray(document.records)) {
    throw storeError(`notification-ingress: idempotency store records table invalid in ${storeFile}`)
  }
  for (const [clientId, perRequest] of Object.entries(document.records)) {
    if (perRequest === null || typeof perRequest !== 'object' || Array.isArray(perRequest)) {
      throw storeError(`notification-ingress: idempotency records row invalid at ${JSON.stringify(clientId)} in ${storeFile}`)
    }
    for (const [requestId, record] of Object.entries(perRequest)) {
      validateRecord(record, clientId, requestId, storeFile)
    }
  }
  return document
}

export function snapshotRecords(records) {
  const out = new Map()
  for (const [clientId, perRequest] of records.entries()) {
    out.set(clientId, new Map([...perRequest.entries()].map(([rid, row]) => [
      rid,
      { ...row, history: row.history === undefined ? undefined : [...row.history] },
    ])))
  }
  return out
}
