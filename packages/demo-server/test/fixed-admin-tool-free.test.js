import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createFixedAdminChildPolicy, FIXED_ADMIN_CANARY_TEXT } from '../src/fixed-admin-tool-free.js'

const BINDING = Object.freeze({
  role: 'fixed_admin_qualification', agentId: 'agt_efficiency-agent', phase: 'deployment_start',
  hostId: 'FF99ABD5-79A0-5EE0-9E0B-B62671271560', packageSha256: 'a'.repeat(64),
  consumingBinarySha256: 'b'.repeat(64), startupNonce: 'c'.repeat(64), processGeneration: 1,
})

function fixture() {
  let assembly, guard
  const ctx = {
    tools: { guard(fn) { guard = fn; return () => {} } },
    on(name, fn) {
      assert.equal(name, 'system-prompt/assemble')
      assembly = fn
      return () => {}
    },
  }
  return { policy: createFixedAdminChildPolicy(ctx), assemble: (...args) => assembly(...args), deny: (...args) => guard(...args) }
}

test('fixed admin child installs empty model tool set and pre-dispatch deny before one prompt', async () => {
  const fx = fixture()
  assert.equal(fx.policy.armed(), false)
  fx.policy.arm(BINDING)
  const assembled = await fx.assemble(null, null, async () => ({ tools: [{ name: 'broker' }, { name: 'shell' }], sections: [] }))
  assert.deepEqual(assembled.tools, [])
  assert.equal(fx.deny({ name: 'broker' }), 'FIXED_ADMIN_CANARY_TOOLS_DENIED')
  assert.equal(fx.deny({ name: 'shell' }), 'FIXED_ADMIN_CANARY_TOOLS_DENIED')
  assert.equal(fx.deny({ name: 'run_code' }), 'FIXED_ADMIN_CANARY_TOOLS_DENIED')
  fx.policy.consumePrompt('main', [{ type: 'text', text: FIXED_ADMIN_CANARY_TEXT }], undefined)
  assert.throws(() => fx.policy.consumePrompt('main', [{ type: 'text', text: FIXED_ADMIN_CANARY_TEXT }], undefined),
    error => error.code === 'FIXED_ADMIN_CANARY_PROMPT_REJECTED')
  assert.throws(() => fx.policy.arm(BINDING), error => error.code === 'FIXED_ADMIN_CANARY_NO_REPLAY')
  assert.equal(fx.deny({ name: 'broker' }), 'FIXED_ADMIN_CANARY_TOOLS_DENIED')
})

test('fixed admin child rejects caller text, source metadata, and wrong session before prompt write', () => {
  for (const [sessionId, blocks, origin] of [
    ['other', [{ type: 'text', text: FIXED_ADMIN_CANARY_TEXT }], undefined],
    ['main', [{ type: 'text', text: 'caller prompt' }], undefined],
    ['main', [{ type: 'text', text: FIXED_ADMIN_CANARY_TEXT }], { kind: 'user' }],
    ['main', [{ type: 'text', text: FIXED_ADMIN_CANARY_TEXT, extra: true }], undefined],
  ]) {
    const fx = fixture()
    fx.policy.arm(BINDING)
    assert.throws(() => fx.policy.consumePrompt(sessionId, blocks, origin),
      error => error.code === 'FIXED_ADMIN_CANARY_PROMPT_REJECTED')
    assert.equal(fx.deny({ name: 'broker' }), 'FIXED_ADMIN_CANARY_TOOLS_DENIED')
  }
})

test('failed assembly remains fail closed after arming', async () => {
  const fx = fixture()
  fx.policy.arm(BINDING)
  await assert.rejects(fx.assemble(null, null, async () => { throw Error('assembly failed') }))
  assert.equal(fx.deny({ name: 'switch' }), 'FIXED_ADMIN_CANARY_TOOLS_DENIED')
})

test('child refuses wrong fixed identity before arming or prompt write', () => {
  for (const change of [
    { agentId: 'agt_hr-agent' }, { phase: 'arbitrary' }, { startupNonce: 'bad' },
    { packageSha256: null }, { processGeneration: 0 }, { extra: true },
  ]) {
    const fx = fixture()
    assert.throws(() => fx.policy.arm({ ...BINDING, ...change }),
      error => error.code === 'FIXED_ADMIN_CANARY_NO_REPLAY')
    assert.equal(fx.policy.armed(), false)
    assert.equal(fx.deny({ name: 'broker' }), 'FIXED_ADMIN_CANARY_TOOLS_DENIED')
    assert.throws(() => fx.policy.consumePrompt('main', [{ type: 'text', text: FIXED_ADMIN_CANARY_TEXT }]),
      error => error.code === 'FIXED_ADMIN_CANARY_PROMPT_REJECTED')
  }
})
