import test from 'node:test'
import assert from 'node:assert/strict'

import { manifests as okrManifests } from '../../src/capabilities/okr.js'
import { createHttpTransport } from '../../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../../test-support/capability-fixtures.js'

// ─── Fixture 5: OKR read (GET, no params, okr.read) ────────────────────────

test('okr_read: no-param GET with okr.read scope (svc-okr target)', async () => {
  const tokenServer = await startTokenServer()
  const okr = await startMockServer((req, res, entry) => {
    if (entry.method === 'GET' && entry.pathname === '/api/goals/mine') {
      return json(res, 200, { goals: [{ id: 'g-1', title: 'Ship Broker V1' }] })
    }
    json(res, 404, { error: 'not_found' })
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'okr-client', clientSecret: 'okr-secret' }) },
    targets: mockTargets({ 'svc-okr': okr.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const manifest = okrManifests.find((m) => m.id === 'okr_read')
  const { definition } = wire(manifest, transport)

  const res = await definition.execute({ operation: 'read' })
  assert.equal(res.ok, true)
  assert.equal(res.result.goals[0].title, 'Ship Broker V1')

  assert.equal(tokenServer.requests[0].body.resource, 'svc-okr')
  assert.equal(tokenServer.requests[0].body.scope, 'okr.read')
  const bizReq = okr.requests[0]
  assert.equal(bizReq.pathname, '/api/goals/mine')
  assert.equal(bizReq.headers.authorization, 'Bearer tok-real')

  await tokenServer.close()
  await okr.close()
})
