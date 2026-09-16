import { filterHealthForPrincipal } from '../../scheduler/src/watchdog/health.js'

class HttpError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function authenticate(req, verifier) {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers?.authorization ?? '')
  if (verifier === undefined || verifier === null || match === null) {
    throw new HttpError(401, 'unauthenticated', 'missing bearer token or unconfigured verification seam')
  }
  try {
    return await verifier.verify(match[1].trim())
  } catch {
    throw new HttpError(401, 'unauthenticated', 'token verification failed')
  }
}

export async function handleSchedulerHealthRequest({ req, url, health, verifier }) {
  const principal = await authenticate(req, verifier)
  const scopes = principal?.scopes instanceof Set ? principal.scopes : new Set()
  if (!scopes.has('scheduler.read') && !scopes.has('scheduler.audit')) {
    throw new HttpError(403, 'forbidden', 'token carries no scheduler.read / scheduler.audit scope')
  }
  if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed', `method not allowed: ${req.method}`)
  if (url.pathname !== '/scheduler/health') throw new HttpError(404, 'not_found', `no such scheduler endpoint: ${url.pathname}`)
  if (typeof health !== 'function') throw new HttpError(500, 'internal', 'scheduler health provider is not wired into this runtime')
  const projected = await health()
  try {
    return { status: 200, body: filterHealthForPrincipal(projected, principal) }
  } catch (error) {
    throw new HttpError(error?.status ?? 403, error?.code ?? 'forbidden', error?.message ?? 'forbidden')
  }
}
