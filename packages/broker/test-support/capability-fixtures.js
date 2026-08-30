import { createServer } from 'node:http'

import { buildToolDefinition } from '../src/registry.js'
import { createHttpHandlers } from '../src/transport.js'
import { targets } from '../src/targets.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

export function startMockServer(handler) {
  const requests = []
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      const url = new URL(req.url, 'http://127.0.0.1')
      const entry = {
        method: req.method,
        pathname: url.pathname,
        query: Object.fromEntries(url.searchParams.entries()),
        headers: req.headers,
        rawBody: raw,
        body: raw === '' ? undefined : safeJson(raw) ?? Object.fromEntries(new URLSearchParams(raw)),
      }
      requests.push(entry)
      handler(req, res, entry)
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({
        origin: `http://127.0.0.1:${port}`,
        requests,
        close: () =>
          new Promise((r) => {
            server.closeAllConnections?.()
            server.close(r)
          }),
      })
    })
  })
}

function safeJson(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

export const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** Mock auth-service token endpoint; records every token request. */
export async function startTokenServer() {
  return startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname === '/oauth/token') {
      return json(res, 200, { access_token: 'tok-real', token_type: 'Bearer', expires_in: 300 })
    }
    json(res, 404, { error: 'not_found' })
  })
}

/** Wire a manifest through buildToolDefinition + the real transport. */
export function wire(manifest, transport) {
  return buildToolDefinition({
    manifest,
    handlers: createHttpHandlers(manifest, transport),
    deps: { resolvePrincipal: () => undefined },
  })
}

/**
 * Targets with the REAL deployed origins replaced by mock-server origins, so
 * fixtures stay hermetic (the real svc-forum/workflow/okr may be running on
 * this machine and would answer with 401 TOKEN_INVALID_OR_EXPIRED otherwise).
 */
export function mockTargets(overrides) {
  return targets.map((t) => (overrides[t.targetId] ? { ...t, allowedOrigin: overrides[t.targetId] } : t))
}
