import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { createInquiryAuthenticator } from '../src/website-inquiry/auth.js'
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'fixture', alg: 'RS256', use: 'sig' }
const now = 1800000000000
const human = { iss: 'auth-service', sub: '00000000-0000-4000-8000-000000000001', aud: 'agent-core-website-human-v1',
  principal_type: 'user', client_id: 'project-progress-desk-web-v1', token_use: 'access', type: 'access', version: 'v1',
  jti: 'synthetic-token-000000001', iat: now / 1000, nbf: now / 1000, exp: now / 1000 + 900 }
function token(claims) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fixture' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${header}.${body}.${sign('RSA-SHA256', Buffer.from(`${header}.${body}`), privateKey).toString('base64url')}`
}
test('original signed Human profile rejects invented claims and separates valid wrong client', async () => {
  const auth = createInquiryAuthenticator({ jwksUrl: 'https://keys.example/.well-known/jwks.json', now: () => now,
    fetchImpl: async () => new Response(JSON.stringify({ keys: [jwk] })) })
  assert.equal((await auth.human(`Bearer ${token(human)}`)).principalId, human.sub)
  for (const patch of [{ scope: '' }, { principal_type: 'service' }, { exp: human.iat + 901 }, { version: 1 }, { nbf: human.iat + 1 }]) {
    await assert.rejects(auth.human(`Bearer ${token({ ...human, ...patch })}`), { code: 'UNAUTHENTICATED' })
  }
  await assert.rejects(auth.human(`Bearer ${token({ ...human, client_id: 'android' })}`), { code: 'FORBIDDEN' })
})
test('controller performs new fixed no-redirect issuance per call and exact operation scope', async () => {
  let issued = 0
  const service = { ...human, aud: 'agent-core-website-transport-v1', principal_type: 'service', client_id: 'agent-control-website-inquiry-v1', exp: human.iat + 600, scope: 'conversation.own_result.read' }
  const auth = createInquiryAuthenticator({ jwksUrl: 'https://keys.example/.well-known/jwks.json', now: () => now,
    fetchImpl: async (url, options) => {
      if (url.includes('jwks')) return new Response(JSON.stringify({ keys: [jwk] }))
      issued++
      assert.equal(url, 'https://auth.mayf3.com/oauth/token')
      assert.equal(options.redirect, 'error')
      assert.equal(options.body.get('scope'), 'conversation.own_result.read')
      return new Response(JSON.stringify({ access_token: token(service), token_type: 'Bearer', expires_in: 600 }))
    } })
  const basic = `Basic ${Buffer.from('synthetic:credential').toString('base64')}`
  await auth.controller(basic, 'read')
  await auth.controller(basic, 'read')
  assert.equal(issued, 2)
})

import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import { InquiryStore } from '../src/website-inquiry/store.js'
import { createInquiryService } from '../src/website-inquiry/service.js'
import { createWebsiteInquiryHandler } from '../src/website-inquiry/http.js'
import { makeRecord, recordKey, commitProjection } from '../src/website-inquiry/records.js'

test('signed SERVICE opaque client and Principal must match current registry before protected result reads', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'whi-auth-binding-'))
  const store = new InquiryStore(join(dir, 'requests.sqlite'))
  const machine = { ...human, sub: '00000000-0000-4000-8000-000000000002', aud: 'agent-core-website-transport-v1', principal_type: 'service',
    client_id: 'synthetic-opaque-service.42', exp: human.iat + 600, scope: 'conversation.own_result.read' }
  const entry = { binding_id: 'binding', version: '1', enabled: true, site_project_id: 'site', site_owner_id: 'owner', issuer: 'auth-service',
    auth_subject: human.sub, human_principal_id: human.sub, communication_scope_id: 'scope',
    pilot_surface: { channel: 'website', external_id: 'pilot', expected_agent_id: 'agt_pilot' },
    allowed_operations: ['bound_resolve', 'preauthorize', 'own_read', 'own_events'], transport_client_id: machine.client_id,
    transport_principal_id: machine.sub, exact_web_origin: 'https://synthetic.example' }
  let resultReads = 0, targetReads = 0, issuances = 0
  try {
    store.transaction('scope', state => {
      const record = makeRecord(entry, { exp: human.exp }, { request_id: 'own-result', message: 'own question', purpose: 'workflow_facts', context_refs: [], allow_create_main: false },
        { canonical_agent_id: 'agt_pilot', main_generation: 'a'.repeat(64) }, now, 1)
      record.shell.trace.native_user_message_id = 'actual-synthetic-user'
      commitProjection(state, record, { userMessageId: 'actual-synthetic-user', message: 'own question', turnId: 1, assistantMessageId: 'actual-synthetic-reply',
        status: 'completed', complete: true, content: 'OWN_SAVED_BODY' }, now)
      state.requests[recordKey(human.sub, 'own-result')] = record
    })
    const snapshot = store.snapshot.bind(store)
    store.snapshot = scope => { resultReads++; return snapshot(scope) }
    const protectedTarget = () => { targetReads++; throw Error('unexpected target read') }
    const service = createInquiryService({ enabled: true, registry: () => [entry], store,
      router: { getBinding: protectedTarget }, definition: { getAgent: protectedTarget }, native: {}, now: () => now, cursorKey: Buffer.alloc(32, 1) })
    const auth = createInquiryAuthenticator({ jwksUrl: 'https://keys.example/.well-known/jwks.json', now: () => now,
      fetchImpl: async (url, options) => {
        if (url.includes('jwks')) return new Response(JSON.stringify({ keys: [jwk] }))
        issuances++
        assert.equal(options.redirect, 'error')
        assert.equal(options.body.get('resource'), 'agent-core-website-transport-v1')
        assert.equal(options.body.get('scope'), 'conversation.own_result.read')
        return new Response(JSON.stringify({ access_token: token(machine), token_type: 'Bearer', expires_in: 600 }))
      } })
    const handler = createWebsiteInquiryHandler({ enabled: true, auth, service })
    async function read() {
      let status, body
      await handler(Object.assign(Readable.from([]), { method: 'GET', url: '/internal/v1/website-inquiries/requests/own-result',
        headers: { authorization: `Basic ${Buffer.from('synthetic-only:fixture-secret').toString('base64')}` } }),
      { writeHead(code) { status = code }, end(bytes) { body = JSON.parse(bytes) } })
      return { status, body }
    }
    const accepted = await read()
    assert.equal(accepted.status, 200)
    assert.equal(accepted.body.body_page.content, 'OWN_SAVED_BODY')
    assert.ok(resultReads > 0)
    for (const [patch, expected] of [[{ client_id: 'unregistered-service' }, 403], [{ sub: '00000000-0000-4000-8000-000000000003' }, 403],
      [{ scope: 'conversation.own_events.read' }, 403], [{ aud: 'unregistered-resource' }, 503]]) {
      const original = { ...machine }
      Object.assign(machine, patch); resultReads = 0
      assert.equal((await read()).status, expected)
      assert.equal(resultReads, 0)
      assert.equal(targetReads, 0)
      Object.assign(machine, original)
    }
    entry.transport_client_id = 'revoked-and-replaced-client'; resultReads = 0
    assert.equal((await read()).status, 403)
    assert.equal(resultReads, 0)
    assert.equal(issuances, 6)
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }) }
})
