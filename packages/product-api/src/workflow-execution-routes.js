/**
 * /workflow-execution/* routes for product-api (WORKFLOW_EXECUTION_CONTROL_V1
 * CTR-WEC1-003 / CTR-WEC1-006).
 *
 *   GET  /workflow-execution/traces   execution trace read model
 *                                     ?workflowInstanceId=<uuid>[&nodeVisitId=<uuid>]
 *   POST /workflow-execution/kicks    push-first poll trigger
 *                                     {workflowInstanceId, nodeVisitId, dispatchIntentId}
 *
 * Both routes pass the Bearer token gate FIRST (the scheduler-routes R-H9
 * discipline, reused verbatim): the verification seam unconfigured or any
 * verification failure = 401 fail-closed; the token must carry
 * `workflow.execute`. The loopback-only bind is the transport boundary; the
 * token gate is the authorization boundary — there is no unauthenticated
 * path.
 *
 * The kick is a LATENCY OPTIMIZATION ONLY: it triggers one coalesced engine
 * poll (kicks never stack; a poll already running absorbs them). The due
 * poll loop remains the correctness path, and the one-attempt fence makes
 * any double trigger harmless. 4xx kicks are permanent outcomes (no retry
 * value); only transport-level failures could be retried by the sender.
 *
 * Error envelope = the product-api frozen { error: { code, message } }.
 */

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

class HttpError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

function requireAccess(access) {
  if (access === undefined || access === null || typeof access !== 'object') {
    throw new HttpError(503, 'not_ready', 'workflow execution runtime is not wired into this runtime')
  }
  return access
}

async function verifyToken(verifier, req) {
  const header = req.headers?.authorization ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (verifier === undefined || verifier === null || match === null) {
    throw new HttpError(401, 'unauthenticated', 'missing bearer token or unconfigured verification seam')
  }
  try {
    const principal = await verifier.verify(match[1].trim())
    const scopes = principal?.scopes instanceof Set ? principal.scopes : new Set()
    if (!scopes.has('workflow.execute')) {
      throw new HttpError(403, 'forbidden', 'token carries no workflow.execute scope')
    }
    return principal
  } catch (error) {
    if (error instanceof HttpError) throw error
    // Fail-closed: every verification failure is 401; the error detail is
    // never echoed to the caller.
    throw new HttpError(401, 'unauthenticated', 'token verification failed')
  }
}

function requireUuidQuery(url, name) {
  const value = url.searchParams.get(name)
  if (value === null || value === '') {
    throw new HttpError(400, 'invalid_query', `${name} is required`)
  }
  if (!UUID_RE.test(value)) {
    throw new HttpError(400, 'invalid_query', `${name} must be a UUID`)
  }
  return value
}

function requireUuidBodyField(body, name) {
  const value = body?.[name]
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new HttpError(400, 'invalid_arguments', `${name} must be a UUID`)
  }
  return value
}

/** Read a bounded JSON request body. */
function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 64_000) {
        rejectBody(new HttpError(400, 'invalid_arguments', 'request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (text.trim() === '') {
        rejectBody(new HttpError(400, 'invalid_arguments', 'JSON body is required'))
        return
      }
      try {
        resolveBody(JSON.parse(text))
      } catch {
        rejectBody(new HttpError(400, 'invalid_arguments', 'body must be JSON'))
      }
    })
    req.on('error', () => rejectBody(new HttpError(400, 'invalid_arguments', 'request stream failed')))
  })
}

/**
 * Gate + dispatch one /workflow-execution/* request.
 * @param {object} input
 * @param {import('node:http').IncomingMessage} input.req
 * @param {URL} input.url
 * @param {{traces:Function, kick:Function}|null} input.access - compose-provided
 *   workflowExecutionAccess service (resolved at request time).
 * @param {{verify:Function}|null} input.verifier - the shared scheduler token verifier seam.
 * @returns {Promise<{status:number, body:object}>}
 */
export async function handleWorkflowExecutionRequest({ req, url, access, verifier }) {
  await verifyToken(verifier, req)
  const path = url.pathname.replace(/\/+$/, '') || url.pathname

  if (req.method === 'GET' && path === '/workflow-execution/traces') {
    const store = requireAccess(access)
    if (typeof store.traces !== 'function') throw new HttpError(503, 'not_ready', 'trace seam is not wired')
    const workflowInstanceId = requireUuidQuery(url, 'workflowInstanceId')
    const nodeVisitId = url.searchParams.get('nodeVisitId')
    if (nodeVisitId !== null && nodeVisitId !== '' && !UUID_RE.test(nodeVisitId)) {
      throw new HttpError(400, 'invalid_query', 'nodeVisitId must be a UUID')
    }
    const trace = await store.traces({ workflowInstanceId, ...(nodeVisitId ? { nodeVisitId } : {}) })
    if (trace === null) {
      throw new HttpError(404, 'not_found', 'no execution attempts recorded for this workflow instance on this runtime')
    }
    return { status: 200, body: { ...trace, generatedAtMs: Date.now() } }
  }

  if (req.method === 'POST' && path === '/workflow-execution/kicks') {
    const store = requireAccess(access)
    if (typeof store.kick !== 'function') throw new HttpError(503, 'not_ready', 'kick seam is not wired')
    const body = await readJsonBody(req)
    const kick = store.kick({
      workflowInstanceId: requireUuidBodyField(body, 'workflowInstanceId'),
      nodeVisitId: requireUuidBodyField(body, 'nodeVisitId'),
      dispatchIntentId: requireUuidBodyField(body, 'dispatchIntentId'),
    })
    // The kick result carries no semantics beyond latency: kicked vs
    // coalesced are both successes, and the payload is not echoed back.
    return { status: 200, body: { ok: true, ...(kick?.coalesced ? { coalesced: true } : { kicked: true }) } }
  }

  throw new HttpError(404, 'not_found', `no such workflow-execution endpoint: ${req.method} ${path}`)
}
