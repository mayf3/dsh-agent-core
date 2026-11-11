import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'

import { assertValidManifest, invoke } from '../../src/mapping.js'
import { createHttpHandlers, createHttpTransport, withTransportErrors } from '../../src/transport.js'

function listen(handler) {
  const requests = []
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      let body
      try { body = JSON.parse(raw) } catch { body = undefined }
      const entry = { method: req.method, pathname: new URL(req.url, 'http://127.0.0.1').pathname, headers: req.headers, body }
      requests.push(entry)
      handler(req, res, entry)
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        origin: `http://127.0.0.1:${server.address().port}`,
        requests,
        close: () => new Promise((done) => {
          server.closeAllConnections?.()
          server.close(done)
        }),
      })
    })
  })
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

test('optional projection source creates an optional body root; absent root and source send no body', async (t) => {
  const tokenServer = await listen((req, res, entry) => {
    if (entry.method !== 'POST' || entry.pathname !== '/oauth/token') return json(res, 404, { error: 'not_found' })
    json(res, 200, { access_token: 'tok-1', token_type: 'Bearer', expires_in: 300 })
  })
  const bizServer = await listen((_req, res, entry) => json(res, 200, { body: entry.body }))
  t.after(async () => { await tokenServer.close(); await bizServer.close() })

  const manifest = assertValidManifest(withTransportErrors({
    id: 'demo.items',
    description: 'Demo HTTP capability for body projection tests.',
    requiredScopes: ['demo.write'],
    errors: [
      { code: 'invalid_arguments', description: 'Invalid.' },
      { code: 'unsupported_operation', description: 'Unsupported.' },
    ],
    operations: [{
      name: 'project',
      description: 'Project declared review evidence.',
      arguments: {
        properties: {
          id: { type: 'string' },
          optionalEnvelope: { type: 'object', additionalProperties: false, properties: { label: { type: 'string' } } },
          reviewRef: { type: 'object', additionalProperties: false, properties: { bindingId: { type: 'string' } }, required: ['bindingId'] },
        },
        required: ['id'],
      },
      errors: ['invalid_arguments'],
      http: {
        target: 'demo-target', method: 'POST', path: '/v1/items/{id}', pathParams: ['id'],
        body: ['optionalEnvelope'],
        bodyProjections: [{ sourceArg: 'reviewRef', destinationBodyPath: ['optionalEnvelope', 'review'] }],
      },
    }],
  }))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'client-a', clientSecret: 'secret-a' }) },
    targets: [{ targetId: 'demo-target', allowedOrigin: bizServer.origin, audience: 'demo-aud' }],
    authServiceOrigin: tokenServer.origin,
  })
  const handlers = createHttpHandlers(manifest, transport)
  const invokeProjection = (args) => invoke(manifest, handlers,
    { operation: 'project', args }, { resolvePrincipal: () => undefined })

  const withProjection = await invokeProjection({ id: 'item-1', reviewRef: { bindingId: 'binding-1' } })
  assert.deepEqual(withProjection.result, { body: { optionalEnvelope: { review: { bindingId: 'binding-1' } } } })
  assert.deepEqual(bizServer.requests[0].body, { optionalEnvelope: { review: { bindingId: 'binding-1' } } })

  const withoutBody = await invokeProjection({ id: 'item-2' })
  assert.deepEqual(withoutBody.result, {})
  assert.equal(bizServer.requests[1].body, undefined)
  assert.equal(bizServer.requests[1].headers['content-type'], undefined)
})
