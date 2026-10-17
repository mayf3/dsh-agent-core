import test from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { integratedFixture } from './website-inquiry-harness.js'

test('real HTTP/store/Router chain/AgentProcess FIFO/native message/source observer produces one own final', async () => {
  const f = await integratedFixture()
  try {
    const resolved = await f.http('POST', '/v1/website-inquiries/resolve', {})
    assert.equal(resolved.status, 200)
    const authorized = await f.http('POST', '/v1/website-inquiries/authorizations', { request_id: 'native-wire-1', target_handle: resolved.output.target_handle, message: 'Synthetic native inquiry', purpose: 'workflow_facts', context_refs: [], allow_create_main: false })
    assert.equal(authorized.status, 201)
    const attempts = await Promise.all([1, 2].map(() => f.http('POST', '/internal/v1/website-inquiries/requests/native-wire-1/redeem', { message: 'Synthetic native inquiry', context_refs: [] })))
    assert.equal(attempts.filter(item => item.status === 202).length, 1)
    let output
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setImmediate(resolve))
      output = (await f.http('GET', '/v1/website-inquiries/requests/native-wire-1')).output
      if (output.request?.reply_status === 'AVAILABLE') break
    }
    assert.equal(f.sends(), 1)
    assert.ok(f.logs.length > 0)
    assert.equal(f.logs.some(line => /agt_pilot|Synthetic native inquiry|synthetic-scope|native-wire-1/.test(line)), false, JSON.stringify(f.logs))
    assert.equal(output.request.reply_status, 'AVAILABLE', JSON.stringify(output))
    assert.equal(output.request.delivery_status, 'DELIVERED')
    assert.equal(output.request.execution_status, 'COMPLETED')
    assert.equal(typeof output.request.trace.native_turn_id, 'number')
    assert.equal(output.result.reply_to, output.request.trace.native_user_message_id)
    assert.equal(output.body_page.content, 'Native synthetic answer 中文')
    assert.ok(output.request.times.inbox_accepted_at)
    if (process.env.WHI_FIXTURE_OUTPUT) writeFileSync(process.env.WHI_FIXTURE_OUTPUT, JSON.stringify(output, null, 2))
    assert.equal((await f.http('POST', '/internal/v1/website-inquiries/requests/native-wire-1/redeem', { message: 'Synthetic native inquiry', context_refs: [] })).status, 200)
    assert.equal(f.sends(), 1)
  } finally { f.close() }
})

test('retained original projection repairs result-commit loss after canonical main reset without resend', async () => {
  const f = await integratedFixture()
  try {
    const resolved = await f.service.resolve(f.human, {})
    await f.service.authorize(f.human, { request_id: 'crash', target_handle: resolved.target_handle, message: 'crash recovery', purpose: 'workflow_facts', context_refs: [], allow_create_main: false })
    await f.service.redeem(f.machine, 'crash', { message: 'crash recovery', context_refs: [] })
    let original
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setImmediate(resolve))
      original = await f.service.read(f.human, 'crash', {})
      if (original.request.reply_status === 'AVAILABLE') break
    }
    assert.equal(original.request.reply_status, 'AVAILABLE')
    f.store.transaction('synthetic-scope', state => {
      const record = Object.values(state.requests)[0]
      record.result = null
      record.content = null
      record.shell.reply_status = 'UNKNOWN'
    })
    rmSync(join(f.home, 'sessions'), { recursive: true, force: true })
    const repaired = await f.service.read(f.human, 'crash', {})
    assert.equal(repaired.body_page.content, original.body_page.content)
    assert.equal(repaired.result.projection_id, original.result.projection_id)
    assert.equal(f.sends(), 1)
    f.registry[0].enabled = false
    await assert.rejects(f.service.read(f.human, 'crash', {}), { code: 'FORBIDDEN' })
  } finally { f.close() }
})

test('default OFF runtime composition performs no dependency IO or service access', async () => {
  const { mountWebsiteInquiryRuntime } = await import('../../src/agent-session/website-inquiry/runtime.js')
  const bomb = new Proxy({}, { get() { throw Error('unexpected access') } })
  assert.equal(await mountWebsiteInquiryRuntime({ ctx: bomb, router: bomb, definition: bomb, workspaceBootstrap: bomb }), null)
  assert.equal(await mountWebsiteInquiryRuntime({ ctx: bomb, config: { enabled: false }, router: bomb }), null)
})

 test('lost real receipt preserves UNKNOWN delivery independently from exact completed reply; never resends', async () => {
  const f = await integratedFixture()
  try {
    const original = f.router.admitWebsiteInquiry
    f.router.admitWebsiteInquiry = async args => { await original(args); throw Error('receipt lost after native followup') }
    const r = await f.service.resolve(f.human, {})
    await f.service.authorize(f.human, { request_id: 'receipt-lost', target_handle: r.target_handle, message: 'one lost receipt', purpose: 'workflow_facts', context_refs: [], allow_create_main: false })
    await f.service.redeem(f.machine, 'receipt-lost', { message: 'one lost receipt', context_refs: [] })
    let response
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setImmediate(resolve))
      response = await f.service.read(f.human, 'receipt-lost', {})
      if (response.request.reply_status === 'AVAILABLE') break
    }
    assert.equal(response.request.reply_status, 'AVAILABLE')
    assert.equal(response.request.execution_status, 'COMPLETED')
    assert.equal(response.request.delivery_status, 'UNKNOWN')
    assert.equal(response.request.times.inbox_accepted_at, null)
    assert.equal(response.result.reply_to, response.request.trace.native_user_message_id)
    await f.service.redeem(f.machine, 'receipt-lost', { message: 'one lost receipt', context_refs: [] })
    assert.equal(f.sends(), 1)
  } finally { f.close() }
})
