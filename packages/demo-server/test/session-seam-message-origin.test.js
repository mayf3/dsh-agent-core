/**
 * AGENT_CORE_AGENT_SESSION_MESSAGING_V1 R4 — demo-server session-seam tests
 * for the trusted inter_agent message-source sidecar:
 *
 *   - absent sidecar keeps the historical `source: {kind:'user'}` (R4)
 *   - a valid sidecar becomes the durable createUserMessage source verbatim
 *   - malformed sidecars reject the prompt BEFORE any message is queued
 *     (exact-allowlist, bound, fail-loud)
 *
 * Reuses the session-seam.test.ts fake DSH services harness (no real model).
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createSessionSeam } from '../src/session-seam.js'

const WS_A = '/tmp/ws/root-a'

/** Same fake DSH context as session-seam.test.js (create/resume/followup). */
function fakeCtx({ persisted = new Map() } = {}) {
  const calls = { create: [], resume: [], followups: [] }
  const makeHandle = (sessionId, cwd) => ({
    agent: {
      session: { id: sessionId, seq: 3, header: { cwd } },
      followup: (message) => { calls.followups.push({ sessionId, message }) },
    },
    disposed: false,
    dispose: async function () { this.disposed = true },
  })
  const agents = {
    create: async ({ sessionId, meta, agentOptions }) => {
      calls.create.push({ sessionId, meta, agentOptions })
      const handle = makeHandle(String(sessionId), meta?.cwd)
      persisted.set(String(sessionId), meta?.cwd)
      return handle
    },
    resume: async ({ resumeSessionId, agentOptions }) => {
      calls.resume.push({ resumeSessionId, agentOptions })
      const id = String(resumeSessionId)
      return makeHandle(id, persisted.get(id))
    },
  }
  const persistence = { list: async () => [...persisted.entries()].map(([id, cwd]) => ({ id, cwd })) }
  const services = new Map([
    ['agents', agents],
    ['sessionPersistence', persistence],
    ['loader', { await: async () => {} }],
    ['agentLoop', {}],
  ])
  const ctx = { get: (name) => services.get(name) }
  return { ctx, calls }
}

function seam(ctx) {
  return createSessionSeam({ ctx, settings: { cwd: WS_A, provider: 'p', model: 'm' } })
}

const VALID_ORIGIN = { kind: 'inter_agent', sourceAgentId: 'agt_stock_agent', correlation: 'turn:1:a1:g1:s9' }

test('R4: an absent sidecar keeps the historical user source', async () => {
  const { ctx, calls } = fakeCtx()
  const s = seam(ctx)
  await s.prompt('main', [{ type: 'text', text: 'hi' }], WS_A)
  assert.equal(calls.followups.length, 1)
  assert.deepEqual(calls.followups[0].message.source, { kind: 'user' })
})

test('R4: a valid inter_agent sidecar becomes the durable message source verbatim', async () => {
  const { ctx, calls } = fakeCtx()
  const s = seam(ctx)
  await s.prompt('main', [{ type: 'text', text: 'hello B' }], WS_A, VALID_ORIGIN)
  assert.equal(calls.followups.length, 1)
  assert.deepEqual(calls.followups[0].message.source, VALID_ORIGIN)
  assert.equal(calls.followups[0].message.source.kind, 'inter_agent')
  assert.equal(calls.followups[0].message.source.sourceAgentId, 'agt_stock_agent')
  assert.equal(calls.followups[0].message.source.correlation, 'turn:1:a1:g1:s9')
})

test('R4: resume path (persisted main) carries the sidecar identically', async () => {
  const { ctx, calls } = fakeCtx({ persisted: new Map([['main', WS_A]]) })
  const s = seam(ctx)
  await s.prompt('main', [{ type: 'text', text: 'resume' }], WS_A, VALID_ORIGIN)
  assert.equal(calls.resume.length, 1)
  assert.equal(calls.create.length, 0)
  assert.deepEqual(calls.followups[0].message.source, VALID_ORIGIN)
})

const MALFORMED = [
  [null, 'null origin'],
  ['inter_agent', 'string origin'],
  [{}, 'empty object'],
  [{ kind: 'user', sourceAgentId: 'agt_a-caller', correlation: 'c' }, 'wrong kind'],
  [{ kind: 'inter_agent', correlation: 'c' }, 'missing sourceAgentId'],
  [{ kind: 'inter_agent', sourceAgentId: 'agt_a-caller' }, 'missing correlation'],
  [{ kind: 'inter_agent', sourceAgentId: 'agt_a-caller', correlation: '' }, 'empty correlation'],
  [{ kind: 'inter_agent', sourceAgentId: 'not-an-agent', correlation: 'c' }, 'bad agent id grammar'],
  [{ kind: 'inter_agent', sourceAgentId: 'agt_a-caller', correlation: 'c', extra: 1 }, 'undeclared extra field'],
]

test('R4: malformed sidecars reject the prompt before any message is queued', async () => {
  for (const [origin, label] of MALFORMED) {
    const { ctx, calls } = fakeCtx()
    const s = seam(ctx)
    await assert.rejects(
      () => s.prompt('main', [{ type: 'text', text: 'x' }], WS_A, origin),
      TypeError,
      `${label} must reject`,
    )
    assert.equal(calls.followups.length, 0, `${label}: zero queued messages`)
  }
})

test('R4: validateMessageOrigin is exported for direct contract checks', () => {
  const { ctx } = fakeCtx()
  const s = seam(ctx)
  assert.deepEqual(s.validateMessageOrigin(undefined), { kind: 'user' })
  assert.deepEqual(s.validateMessageOrigin(VALID_ORIGIN), VALID_ORIGIN)
  assert.throws(() => s.validateMessageOrigin({ kind: 'inter_agent' }), TypeError)
})
