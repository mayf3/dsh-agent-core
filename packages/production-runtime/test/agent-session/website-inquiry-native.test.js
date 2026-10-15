import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionSeam } from '../../../demo-server/src/session-seam.js'

test('real native message allocation remains user and durable mapping must finish before followup', async () => {
  const calls = []
  const agent = { session: { header: { cwd: '/synthetic' }, seq: 0 }, followup: message => calls.push(['followup', message]) }
  const services = { loader: { await: async () => {} }, agentLoop: {}, sessionPersistence: { list: async () => [] },
    agents: { create: async () => ({ agent }) } }
  const carrier = { namespace: 'website-human-inquiry-v1', human_principal_id: 'human', communication_scope_id: 'scope', request_id: 'rid', payload_digest: 'a'.repeat(64), site_owner_binding_version: 'v1' }
  const seam = createSessionSeam({ ctx: { get: name => services[name] }, settings: { cwd: '/synthetic' },
    websiteAdmission: async (value, message) => { calls.push(['map', message.id]); assert.deepEqual(value, carrier) } })
  const receipt = await seam.prompt('main', [{ type: 'text', text: 'hello' }], '/synthetic', undefined, carrier)
  assert.equal(calls[0][0], 'map')
  assert.equal(calls[1][0], 'followup')
  assert.equal(calls[0][1], receipt.messageId)
  assert.deepEqual(calls[1][1].source, { kind: 'user' })
  assert.equal(Object.hasOwn(calls[1][1], 'website_request'), false)
  services.agents.create = async () => ({ agent })
  const failing = createSessionSeam({ ctx: { get: name => services[name] }, settings: { cwd: '/synthetic' }, websiteAdmission: async () => { throw Error('durability failed') } })
  await assert.rejects(failing.prompt('main', [{ type: 'text', text: 'hello' }], '/synthetic', undefined, carrier))
  assert.equal(calls.filter(([kind]) => kind === 'followup').length, 1)
})

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WebsiteSourceCustody, readCustodyProjection } from '../../../demo-server/src/website-custody.js'

test('source owner retains exact completed final after observer loss and restart; unrelated/tool content excluded', () => {
  const root = mkdtempSync(join(tmpdir(), 'whi-custody-'))
  const carrier = { namespace: 'website-human-inquiry-v1', human_principal_id: 'human', communication_scope_id: 'scope', request_id: 'rid', payload_digest: 'a'.repeat(64), site_owner_binding_version: '1' }
  const message = { id: 'native-user', source: { kind: 'user' }, content: [{ type: 'text', text: 'question' }] }
  try {
    const custody = new WebsiteSourceCustody(root)
    custody.register(carrier, message)
    let seq = 0
    const push = (type, data) => custody.observe('main', { type, seq: seq++, time: Date.now(), data })
    push('agent/inbox/spliced', { inserted: [message] })
    push('turn/start', { turn: 7 })
    push('user/message', message)
    push('tool/result', { turn: 7, secret: 'PRIVATE_TOOL_SENTINEL' })
    push('assistant/message', { turn: 7, message: { id: 'assistant-old', content: [{ type: 'text', text: 'intermediate' }] } })
    push('assistant/message', { turn: 7, message: { id: 'assistant-final', content: [{ type: 'text', text: 'answer' }, { type: 'reasoning', text: 'PRIVATE_REASONING' }] } })
    push('turn/end', { turn: 7, reason: { kind: 'completed' } })
    const proof = readCustodyProjection(root, carrier)
    assert.equal(proof.content, 'answer')
    assert.equal(proof.assistantMessageId, 'assistant-final')
    assert.equal(proof.userMessageId, 'native-user')
    assert.equal(proof.status, 'completed')
    assert.equal(JSON.stringify(proof).includes('PRIVATE'), false)
    const reopened = new WebsiteSourceCustody(root)
    assert.deepEqual(readCustodyProjection(root, carrier), proof)
    assert.equal(reopened.pending.size, 0)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
