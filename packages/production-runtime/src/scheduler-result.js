/**
 * Structured business-result ingestion (AGENT_CORE_SCHEDULER_RUN_HISTORY_V1
 * §3 R4). This runs in the TRUSTED production-runtime wrapper — the scheduler
 * core stays product-ignorant and persists whatever lands on the outcome
 * envelope verbatim (opaque JSON, R-H7).
 *
 * Contract (frozen by R4): the agent turn reply may end with a
 * ```scheduler-result fenced block carrying
 *
 *   { "final_status": "PASS" | "PARTIAL" | "FAIL",   // required
 *     "counters": { "<name>": <integer>, ... },      // required, FLAT string->integer
 *     "notes": "<optional, <=500 chars, non-secret>",
 *     "wake_sent": [ { "target_agent_id", "workflow_instance_id",
 *                      "request_id", "session_id" } ]  // optional (R9 J1 join face)
 *   }
 *
 * Ingestion is FAIL-SOFT (R4 step 4): a rejected block yields
 * `{ result_error_code }` and NEVER affects the execution outcome or the
 * delivery. Business counter keys are an OPEN map — this module validates the
 * envelope, never the business meaning of any key.
 */

export const SCHEDULER_RESULT_BLOCK_LIMIT_BYTES = 16 * 1024
export const SCHEDULER_RESULT_NOTES_LIMIT_CHARS = 500
export const RESULT_FINAL_STATUSES = new Set(['PASS', 'PARTIAL', 'FAIL'])

/** Any key matching this is refused — history rows and API responses carry zero secrets (R-H8). */
const SECRET_KEY_PATTERN = /secret|password|passwd|credential|token|api[-_]?key|private[-_]?key|authorization/i

const WAKE_SENT_FIELDS = ['target_agent_id', 'workflow_instance_id', 'request_id', 'session_id']

function invalid(code, reason) {
  return { result: undefined, result_error_code: code, reason }
}

function findSecretKey(value, path = '$') {
  if (value === null || typeof value !== 'object') return null
  for (const [key, child] of Object.entries(value)) {
    const here = `${path}.${key}`
    if (SECRET_KEY_PATTERN.test(key)) return here
    const found = findSecretKey(child, here)
    if (found !== null) return found
  }
  return null
}

/**
 * Ingest the final ```scheduler-result fenced block of a turn reply.
 * @param {string|undefined} summary - the agent turn reply text
 * @returns {{ result?: object, result_error_code?: string, reason?: string }}
 *   `{ result }` when a valid block was ingested; `{ result_error_code }`
 *   when a block was present but rejected; `{}` when no block exists.
 */
export function ingestSchedulerResult(summary) {
  if (typeof summary !== 'string' || summary === '') return {}
  const matches = [...summary.matchAll(/```scheduler-result[ \t]*\r?\n([\s\S]*?)```/g)]
  if (matches.length === 0) return {}
  const block = matches[matches.length - 1][1]
  if (Buffer.byteLength(block, 'utf8') > SCHEDULER_RESULT_BLOCK_LIMIT_BYTES) {
    return invalid('OVERSIZE', `scheduler-result block exceeds ${SCHEDULER_RESULT_BLOCK_LIMIT_BYTES} bytes`)
  }
  let parsed
  try {
    parsed = JSON.parse(block)
  } catch {
    return invalid('UNPARSEABLE', 'scheduler-result block is not valid JSON')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return invalid('INVALID_SCHEMA', 'scheduler-result block must be a JSON object')
  }
  if (findSecretKey(parsed) !== null) {
    return invalid('INVALID_SCHEMA', 'scheduler-result block must not carry secret-shaped fields')
  }
  const { final_status: finalStatus, counters, notes, wake_sent: wakeSent } = parsed
  if (!RESULT_FINAL_STATUSES.has(finalStatus)) {
    return invalid('INVALID_SCHEMA', `final_status must be PASS|PARTIAL|FAIL, got ${JSON.stringify(finalStatus)}`)
  }
  if (counters === null || typeof counters !== 'object' || Array.isArray(counters)) {
    return invalid('INVALID_SCHEMA', 'counters must be a flat string->integer map')
  }
  for (const [key, value] of Object.entries(counters)) {
    if (!Number.isInteger(value)) {
      return invalid('INVALID_SCHEMA', `counters.${key} must be an integer, got ${JSON.stringify(value)}`)
    }
  }
  if (notes !== undefined && (typeof notes !== 'string' || notes.length > SCHEDULER_RESULT_NOTES_LIMIT_CHARS)) {
    return invalid('INVALID_SCHEMA', `notes must be a string of at most ${SCHEDULER_RESULT_NOTES_LIMIT_CHARS} chars`)
  }
  if (wakeSent !== undefined) {
    if (!Array.isArray(wakeSent)) return invalid('INVALID_SCHEMA', 'wake_sent must be an array of wake-link entries')
    for (const entry of wakeSent) {
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
        return invalid('INVALID_SCHEMA', 'wake_sent entries must be objects')
      }
      for (const field of WAKE_SENT_FIELDS) {
        if (typeof entry[field] !== 'string' || entry[field] === '') {
          return invalid('INVALID_SCHEMA', `wake_sent entry field ${field} must be a non-empty string`)
        }
      }
    }
  }
  const result = { final_status: finalStatus, counters }
  if (notes !== undefined) result.notes = notes
  if (wakeSent !== undefined) result.wake_sent = wakeSent
  return { result, result_error_code: undefined, reason: undefined }
}

/** Attach a validated business result to a successful router outcome in place. */
export function attachSchedulerResult(outcome) {
  if (outcome?.status !== 'ok' || typeof outcome.summary !== 'string') return outcome
  const ingested = ingestSchedulerResult(outcome.summary)
  if (ingested.result !== undefined) outcome.result = ingested.result
  else if (ingested.result_error_code !== undefined) outcome.result_error_code = ingested.result_error_code
  return outcome
}
