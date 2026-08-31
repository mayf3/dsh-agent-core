import test from 'node:test'
import assert from 'node:assert/strict'

import { validateManifest } from '../../src/schema.js'
import { manifests as forumManifests } from '../../src/capabilities/forum.js'
import { createHttpTransport } from '../../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../../test-support/capability-fixtures.js'

// ─── Fixture 1: Forum reply (POST, path param, JSON body, forum.write) ─────

test('forum_reply: kind is restricted to the reviewer-safe enum (no moderator-only kinds)', async () => {
  const manifest = forumManifests.find((m) => m.id === 'forum_reply')
  const REVIEWER_SAFE = ['comment', 'proposal', 'challenge', 'clarification', 'evidence']

  // tool schema exposes ONLY kinds a forum.write credential can post
  const { definition } = wire(manifest, { execute: async () => ({ errorCode: 'credential_unavailable' }) })
  const kindSpec = definition.parameters.kind
  assert.deepEqual(kindSpec.enum, REVIEWER_SAFE)
  assert.ok(!kindSpec.enum.includes('system'))
  assert.ok(!kindSpec.enum.includes('decision'))

  // mapping rejects a moderator-only kind BEFORE any transport call
  let calls = 0
  const spy = {
    execute: async () => {
      calls += 1
      return { errorCode: 'credential_unavailable' }
    },
  }
  const { definition: def2 } = wire(manifest, spy)
  const out = await def2.execute({ operation: 'reply', threadId: 't-1', content: 'hi', kind: 'system' })
  assert.equal(out.ok, false)
  assert.equal(out.error.code, 'invalid_arguments')
  assert.equal(calls, 0, 'transport must not run for a moderator-only kind')

  // reviewer-safe kind passes validation and reaches the transport
  const out2 = await def2.execute({ operation: 'reply', threadId: 't-1', content: 'hi', kind: 'comment' })
  assert.equal(out2.ok, false)
  assert.equal(out2.error.code, 'credential_unavailable')
  assert.equal(calls, 1)
})

test('forum_search_threads: q is required (manifest schema + tool schema + mapping)', async () => {
  const manifest = forumManifests.find((m) => m.id === 'forum_search_threads')

  // manifest schema: q in required
  const res = validateManifest(manifest)
  assert.equal(res.ok, true)
  assert.deepEqual(res.manifest.operations[0].arguments.required, ['q'])

  // tool schema: q.required === true
  const { definition } = wire(manifest, { execute: async () => ({ errorCode: 'credential_unavailable' }) })
  assert.equal(definition.parameters.q.required, true)

  // mapping: missing q → invalid_arguments, transport never runs
  let calls = 0
  const spy = {
    execute: async () => {
      calls += 1
      return { errorCode: 'credential_unavailable' }
    },
  }
  const { definition: def2 } = wire(manifest, spy)
  const out = await def2.execute({ operation: 'search', page: 1 })
  assert.equal(out.ok, false)
  assert.equal(out.error.code, 'invalid_arguments')
  assert.equal(calls, 0)

  // with q → passes validation and reaches the transport
  const out2 = await def2.execute({ operation: 'search', q: 'okr', page: 1 })
  assert.equal(out2.ok, false)
  assert.equal(out2.error.code, 'credential_unavailable')
  assert.equal(calls, 1)
})

test('forum_reply: manifest → tool → authorized POST → structured result', async () => {
  const tokenServer = await startTokenServer()
  const forum = await startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname === '/api/threads/t-1/messages') {
      return json(res, 201, { message: { id: 'm-1', content: entry.body.content, threadId: 't-1' } })
    }
    json(res, 404, { error: 'not_found' })
  })

  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'forum-client', clientSecret: 'forum-secret' }) },
    targets: mockTargets({ 'svc-forum': forum.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const manifest = forumManifests.find((m) => m.id === 'forum_reply')
  const { definition, capabilityId } = wire(manifest, transport)

  // manifest → DSH tool: name / parameters / no identity fields
  assert.equal(capabilityId, 'forum_reply')
  assert.equal(definition.name, 'forum_reply')
  assert.deepEqual(definition.parameters.operation.enum, ['reply'])
  assert.equal(definition.parameters.content.required, true)
  assert.ok(!JSON.stringify(definition.parameters).toLowerCase().includes('agentid'))
  assert.ok(!JSON.stringify(definition.parameters).toLowerCase().includes('principalid'))

  // execute through the real tool definition
  const res = await definition.execute({ operation: 'reply', threadId: 't-1', content: 'hello', kind: 'proposal' })
  assert.deepEqual(res, { ok: true, result: { message: { id: 'm-1', content: 'hello', threadId: 't-1' } } })

  // authorization propagation: audience + scope on the wire
  const tokenReq = tokenServer.requests[0]
  assert.equal(tokenReq.body.resource, 'svc-forum')
  assert.equal(tokenReq.body.scope, 'forum.write')
  assert.equal(tokenReq.headers.authorization, `Basic ${Buffer.from('forum-client:forum-secret').toString('base64')}`)

  // business request: pinned path + JSON body + Bearer
  const bizReq = forum.requests[0]
  assert.equal(bizReq.method, 'POST')
  assert.equal(bizReq.pathname, '/api/threads/t-1/messages')
  assert.equal(bizReq.headers.authorization, 'Bearer tok-real')
  assert.deepEqual(bizReq.body, { content: 'hello', kind: 'proposal' })

  await tokenServer.close()
  await forum.close()
})
test('F. forum broker non-regression: undeclared service code still degrades to declared http_4xx', async () => {
  const tokenServer = await startTokenServer()
  const forum = await startMockServer((req, res) => json(res, 404, { error: 'not_found', message: 'no such thread' }))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'forum-client', clientSecret: 'forum-secret' }) },
    targets: mockTargets({ 'svc-forum': forum.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const manifest = forumManifests.find((m) => m.id === 'forum_reply')
  const { definition } = wire(manifest, transport)

  const res = await definition.execute({ operation: 'reply', threadId: 'missing', content: 'hi' })
  assert.equal(res.ok, false)
  // `not_found` is not in forum_reply's declared table → fail-closed fallback
  // to the declared canonical code, with status + detail still preserved.
  assert.equal(res.error.code, 'http_4xx')
  assert.equal(res.error.status, 404)
  assert.equal(res.error.detail, 'no such thread')
  assert.equal(res.error.requestId, undefined)

  await tokenServer.close()
  await forum.close()
})
