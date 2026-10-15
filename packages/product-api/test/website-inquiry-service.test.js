import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { InquiryStore } from '../src/website-inquiry/store.js'
import { createInquiryService } from '../src/website-inquiry/service.js'

export function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'whi-service-'))
  const store = new InquiryStore(join(dir, 'db.sqlite'))
  let now = 1800000000000
  const registry = [{ binding_id: 'binding', version: '1', enabled: true, site_project_id: 'site', site_owner_id: 'owner',
    issuer: 'auth-service', auth_subject: 'human', human_principal_id: 'human', communication_scope_id: 'scope',
    pilot_surface: { channel: 'website', external_id: 'pilot', expected_agent_id: 'agt_pilot' },
    allowed_operations: ['bound_resolve', 'preauthorize', 'own_read', 'own_events'],
    transport_client_id: 'agent-control-website-inquiry-v1', transport_principal_id: 'controller', exact_web_origin: 'https://site.example' }]
  const hits = { binding: 0, definition: 0, metadata: 0, send: 0 }
  const router = { channelConversationId: (c, id) => `${c}:${id}`, getBinding: () => { hits.binding++; return { activeAgentId: 'agt_pilot', activeSessionId: 'main' } } }
  const definition = { getAgent: id => { hits.definition++; return { id, disabled: false } } }
  const native = { metadata: async () => { hits.metadata++; return { state: 'exists', generation: 'a'.repeat(64) } } }
  const human = Object.freeze({ kind: 'human', principalId: 'human', exp: now / 1000 + 900 })
  const machine = Object.freeze({ kind: 'controller', principalId: 'controller', clientId: 'agent-control-website-inquiry-v1' })
  const service = createInquiryService({ enabled: true, registry: () => registry, store, router, definition, native, now: () => now, cursorKey: Buffer.alloc(32, 1) })
  return { dir, store, registry, hits, human, machine, service, native, router, definition, advance: ms => { now += ms }, close() { store.close(); rmSync(dir, { recursive: true, force: true }) } }
}

test('bound resolve exact metadata; deferred workflow denies with zero protected reads', async () => {
  const f = fixture()
  try {
    await assert.rejects(f.service.resolve(f.human, { workflow_instance_id: '00000000-0000-4000-8000-000000000000' }), { code: 'NOT_SUPPORTED' })
    assert.deepEqual(f.hits, { binding: 0, definition: 0, metadata: 0, send: 0 })
    const { resolution } = await f.service.resolve(f.human, {})
    assert.equal(resolution.canonical_agent_id, 'agt_pilot')
    assert.equal(resolution.workflow_instance_id, null)
    assert.equal(resolution.agent_domain.agent_id, 'agt_pilot')
    assert.deepEqual(f.hits, { binding: 1, definition: 1, metadata: 1, send: 0 })
  } finally { f.close() }
})

test('durable authorization bytes and stable RID conflict/repeat before refreshed target reads', async () => {
  const f = fixture()
  try {
    const resolved = await f.service.resolve(f.human, {})
    const body = { request_id: 'rid', target_handle: resolved.target_handle, message: '原文\r\n', purpose: 'workflow_facts', context_refs: [], allow_create_main: false }
    const created = await f.service.authorize(f.human, body)
    assert.equal(created.status, 201)
    assert.equal(created.request.request_status, 'AUTHORIZED')
    const reads = f.hits.binding
    assert.equal((await f.service.authorize(f.human, body)).status, 200)
    assert.equal(f.hits.binding, reads)
    await assert.rejects(f.service.authorize(f.human, { ...body, message: '原文\n' }), { code: 'REQUEST_CONFLICT' })
    assert.equal(f.hits.send, 0)
    f.registry[0].enabled = false
    await assert.rejects(f.service.read(f.human, 'rid', {}), { code: 'FORBIDDEN' })
  } finally { f.close() }
})

test('no source custody mechanism means redeem disabled before consumption', async () => {
  const f = fixture()
  try {
    const r = await f.service.resolve(f.human, {})
    await f.service.authorize(f.human, { request_id: 'rid', target_handle: r.target_handle, message: 'x', purpose: 'workflow_facts', context_refs: [], allow_create_main: false })
    await assert.rejects(f.service.redeem(f.machine, 'rid', { message: 'x', context_refs: [] }), { code: 'NOT_PROVISIONED' })
    assert.equal((await f.service.read(f.human, 'rid', {})).request.request_status, 'AUTHORIZED')
  } finally { f.close() }
})

import { commitProjection, ownRecord } from '../src/website-inquiry/records.js'
import { digest } from '../src/website-inquiry/codec.js'

test('31-request keyset history, event tail and multibyte body remain stable across appends/revocation/expiry', async () => {
  const f = fixture()
  try {
    const resolved = await f.service.resolve(f.human, {})
    const submit = request_id => f.service.authorize(f.human, { request_id, target_handle: resolved.target_handle, message: request_id, purpose: 'workflow_facts', context_refs: [], allow_create_main: false })
    for (let i = 0; i < 31; i++) await submit(`rid-${i}`)
    const first = await f.service.history(f.human, { limit: '20' })
    assert.equal(first.requests.length, 20)
    await submit('later')
    const second = await f.service.history(f.human, { limit: '20', before: first.next_cursor })
    const ids = [...second.requests, ...first.requests].map(item => item.request_id)
    assert.equal(new Set(ids).size, 31)
    assert.equal(ids.includes('later'), false)
    const initialEvents = await f.service.events(f.human, { limit: '100' })
    await submit('later-tail')
    const tail = await f.service.events(f.human, { cursor: initialEvents.next_cursor })
    assert.deepEqual(tail.events.map(item => item.request_id), ['later-tail'])
    const content = '汉🙂'.repeat(3000)
    f.store.transaction('scope', state => {
      const record = ownRecord(state, f.registry[0], 'rid-0')
      record.shell.trace.native_user_message_id = 'native'
      commitProjection(state, record, { userMessageId: 'native', message: 'rid-0', turnId: 0, assistantMessageId: 'assistant', content, status: 'completed', complete: true }, 1800000000000)
    })
    let cursor, combined = ''
    do {
      const response = await f.service.read(f.human, 'rid-0', cursor ? { content_cursor: cursor } : {})
      assert.ok(Buffer.byteLength(response.body_page.content) <= 6144)
      combined += response.body_page.content
      cursor = response.body_page.next_cursor
    } while (cursor)
    assert.equal(digest(combined), digest(content))
    f.registry[0].enabled = false
    await assert.rejects(f.service.events(f.human, { cursor: tail.next_cursor }), { code: 'FORBIDDEN' })
    f.registry[0].enabled = true
    f.advance(7 * 86400000 + 1)
    await assert.rejects(f.service.events(f.human, { cursor: tail.next_cursor }), { code: 'EVENT_CURSOR_EXPIRED' })
    f.advance(23 * 86400000)
    await assert.rejects(f.service.read(f.human, 'rid-0', {}), { code: 'RESULT_EXPIRED' })
    assert.equal(Object.keys(f.store.snapshot('scope').requests).length, 33)
  } finally { f.close() }
})
