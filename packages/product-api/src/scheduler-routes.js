/**
 * /scheduler/* read routes for product-api (AGENT_CORE_SCHEDULER_RUN_HISTORY_V1
 * §3 R7/R8, frozen GET-only contract).
 *
 *   GET /scheduler/runs                    list + filters + cursor pagination
 *   GET /scheduler/runs/{run_id}           run detail (job_snapshot / session /
 *                                          output / error / trace.wake_links)
 *   GET /scheduler/occurrences/{id}        occurrence + runs[] + retry_chain
 *
 * Every /scheduler/* request passes the Bearer token gate FIRST (R-H9, no
 * bypass): verify seam unconfigured or any verification failure = 401
 * fail-closed. scheduler.audit sees globally; scheduler.read is structurally
 * restricted to the caller's own agent_id (403 on anything else — not a
 * filtered list). No mutating route exists (R-H6). Local entitlement labels
 * (scheduler.read:self etc.) are NOT token scopes and never accepted here.
 *
 * Error envelope = the product-api frozen { error: { code, message } } with
 * the spec's error vocabulary: 400 invalid_query / 401 unauthenticated /
 * 403 forbidden / 404 not_found / 500 internal.
 */

const STATUS_VOCABULARY = new Set([
  'success', 'failed', 'timeout', 'cancelled', 'running', 'admitted', 'scheduled', 'outcome_unknown',
])

const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

class HttpError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

function requireHistory(history) {
  if (history === undefined || history === null || typeof history.queryRuns !== 'function') {
    throw new HttpError(500, 'internal', 'scheduler history store is not wired into this runtime')
  }
  return history
}

/**
 * Gate + dispatch one /scheduler/* request.
 * @returns {Promise<{status:number, body:object}>}
 */
export async function handleSchedulerRequest({ req, url, history, verifier }) {
  // ── gate (R8/R-H9): ALWAYS before any handler logic ────────────────────
  const header = req.headers?.authorization ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (verifier === undefined || verifier === null || match === null) {
    throw new HttpError(401, 'unauthenticated', 'missing bearer token or unconfigured verification seam')
  }
  let principal
  try {
    principal = await verifier.verify(match[1].trim())
  } catch {
    // Fail-closed: every verification failure is 401 (spec R8) — the error
    // detail is never echoed to the caller.
    throw new HttpError(401, 'unauthenticated', 'token verification failed')
  }
  const scopes = principal?.scopes instanceof Set ? principal.scopes : new Set()
  const globalAudit = scopes.has('scheduler.audit')
  const ownRead = scopes.has('scheduler.read')
  if (!globalAudit && !ownRead) {
    throw new HttpError(403, 'forbidden', 'token carries no scheduler.read / scheduler.audit scope')
  }
  const callerAgentId = globalAudit ? null : principal.agentId
  if (!globalAudit && (typeof callerAgentId !== 'string' || callerAgentId === '')) {
    // A read-scope principal without an agent binding owns no runs.
    throw new HttpError(403, 'forbidden', 'token has scheduler.read but no agent binding')
  }

  // ── routing (GET-only, frozen) ─────────────────────────────────────────
  if (req.method !== 'GET') {
    throw new HttpError(405, 'method_not_allowed', `method not allowed: ${req.method}`)
  }
  const store = requireHistory(history)
  const path = url.pathname.replace(/\/+$/, '') || url.pathname
  if (path === '/scheduler/runs') {
    return listRuns({ store, url, callerAgentId, globalAudit })
  }
  const runMatch = /^\/scheduler\/runs\/([^/]+)$/.exec(path)
  if (runMatch !== null) {
    return runDetail({ store, runId: decodeURIComponent(runMatch[1]), callerAgentId, globalAudit })
  }
  const occMatch = /^\/scheduler\/occurrences\/([^/]+)$/.exec(path)
  if (occMatch !== null) {
    return occurrenceDetail({ store, occurrenceId: decodeURIComponent(occMatch[1]), callerAgentId, globalAudit })
  }
  throw new HttpError(404, 'not_found', `no such scheduler endpoint: ${req.method} ${path}`)
}

// ── route bodies ─────────────────────────────────────────────────────────

function parseIsoInstant(url, name) {
  const raw = url.searchParams.get(name)
  if (raw === null) return undefined
  if (!ISO_INSTANT_PATTERN.test(raw) || Number.isNaN(Date.parse(raw))) {
    throw new HttpError(400, 'invalid_query', `${name} must be an ISO instant`)
  }
  return Date.parse(raw)
}

function listRuns({ store, url, callerAgentId, globalAudit }) {
  const params = url.searchParams
  const filters = {}
  const jobId = params.get('job_id')
  if (jobId !== null) filters.jobId = jobId
  const agentId = params.get('agent_id')
  if (agentId !== null) {
    if (!globalAudit && agentId !== callerAgentId) {
      throw new HttpError(403, 'forbidden', 'scheduler.read may only query its own agent_id')
    }
    filters.agentId = agentId
  } else if (!globalAudit) {
    filters.agentId = callerAgentId // read scope: always forced to self (R8)
  }
  const status = params.get('status')
  if (status !== null) {
    if (!STATUS_VOCABULARY.has(status)) {
      throw new HttpError(400, 'invalid_query', `unknown status vocabulary: ${status}`)
    }
    filters.status = status
  }
  const from = parseIsoInstant(url, 'from')
  if (from !== undefined) filters.from = from
  const to = parseIsoInstant(url, 'to')
  if (to !== undefined) filters.to = to
  const sessionId = params.get('session_id')
  if (sessionId !== null) filters.sessionId = sessionId
  const correlationId = params.get('correlation_id')
  if (correlationId !== null) filters.correlationId = correlationId
  const occurrenceId = params.get('occurrence_id')
  if (occurrenceId !== null) filters.occurrenceId = occurrenceId
  const limitRaw = params.get('limit')
  if (limitRaw !== null) {
    const limit = Number(limitRaw)
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new HttpError(400, 'invalid_query', 'limit must be an integer between 1 and 200')
    }
    filters.limit = limit
  }
  const cursor = params.get('cursor')
  if (cursor !== null && cursor !== '') filters.cursor = cursor
  const { runs, next_cursor: nextCursor, notice } = store.queryRuns(filters)
  return { status: 200, body: { runs, next_cursor: nextCursor, ...(notice !== undefined ? { notice } : {}) } }
}

function outputFace(run) {
  if (run.result_recorded !== true && run.result_error_code === null) return null
  return {
    result: run.result ?? null,
    result_status: run.result_status ?? null,
    result_recorded: run.result_recorded === true,
    ...(run.result_error_code !== null ? { result_error_code: run.result_error_code } : {}),
  }
}

/** trace.wake_links derived from the structured result's wake_sent entries (R7/R9 J1). */
function wakeLinks(run) {
  const entries = run.result?.wake_sent
  if (!Array.isArray(entries) || entries.length === 0) return []
  return entries.map((entry) => ({
    target_agent_id: entry.target_agent_id,
    workflow_instance_id: entry.workflow_instance_id,
    request_id: entry.request_id,
    session_id: entry.session_id,
  }))
}

function runDetail({ store, runId, callerAgentId, globalAudit }) {
  const run = store.getRun(runId)
  if (run === null) throw new HttpError(404, 'not_found', `unknown run: ${runId}`)
  if (!globalAudit && run.agent_id !== callerAgentId) {
    throw new HttpError(403, 'forbidden', 'run belongs to another agent')
  }
  return {
    status: 200,
    body: {
      run,
      job_snapshot: store.getJobSnapshot(run.occurrence_id),
      session: { session_id: run.session_id, agent_id: run.agent_id, native: true },
      output: outputFace(run),
      error: run.error_code !== null || run.error_message !== null
        ? { error_code: run.error_code, error_message: run.error_message }
        : null,
      trace: {
        correlation_id: run.correlation_id,
        parent_run_id: run.parent_run_id,
        request_id: run.request_id,
        wake_links: wakeLinks(run),
      },
    },
  }
}

function occurrenceDetail({ store, occurrenceId, callerAgentId, globalAudit }) {
  const view = store.getOccurrence(occurrenceId)
  if (view === null) throw new HttpError(404, 'not_found', `unknown occurrence: ${occurrenceId}`)
  const snapshotAgentId = view.occurrence.job_snapshot?.agent_id
  if (!globalAudit && snapshotAgentId !== callerAgentId) {
    throw new HttpError(403, 'forbidden', 'occurrence belongs to another agent')
  }
  const firstRun = view.runs[0]
  return {
    status: 200,
    body: {
      occurrence: view.occurrence,
      runs: view.runs,
      retry_chain: view.retry_chain,
      session_links: view.runs.map((run) => ({ session_id: run.session_id, agent_id: run.agent_id, native: true })),
      output: firstRun !== undefined ? outputFace(firstRun) : null,
    },
  }
}
