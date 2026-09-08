/**
 * WORKFLOW_AGENT_EXECUTION_V1 — demo-server session-seam tests for the new
 * trusted `workflow_execution` message-source sidecar:
 *
 *   - a valid sidecar becomes the durable createUserMessage source verbatim
 *     (the Run's session journal carries the NodeVisit/attempt association)
 *   - malformed sidecars reject the prompt BEFORE any message is queued
 *   - unknown kinds stay rejected (only inter_agent | workflow_execution)
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createSessionSeam } from '../src/session-seam.js'

const WS_A = '/tmp/ws/root-a'

/** Same fake DSH context as session-seam.test.js (create/resume/followup). */
function fakeCtx() {
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
      return makeHandle(String(sessionId), meta?.cwd)
    },
    resume: async ({ resumeSessionId, agentOptions }) => {
      calls.resume.push({ resumeSessionId, agentOptions })
      return makeHandle(String(resumeSessionId), undefined)
    },
  }
  const persistence = { list: async () => [] }
  const services = new Map([
    ['agents', agents],
    ['sessionPersistence', persistence],
    ['loader', { await: async () => {} }],
    ['agentLoop', {}],
  ])
  return { ctx: { get: (name) => services.get(name) }, calls }
}

function seam(ctx) {
  return createSessionSeam({ ctx, settings: { cwd: WS_A, provider: 'p', model: 'm' } })
}

const UUID_A = '6f9619ff-8b86-d011-b42d-00c04fc964ff'
const UUID_B = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
const VALID_WORKFLOW_ORIGIN = {
  kind: 'workflow_execution',
  workflowInstanceId: UUID_A,
  nodeVisitId: UUID_B,
  attemptId: `wfeat-${'b'.repeat(24)}`,
}

test('workflow_execution origin: valid provenance becomes the durable message source verbatim', async () => {
  const { ctx, calls } = fakeCtx()
  const s = seam(ctx)
  await s.prompt('main', [{ type: 'text', text: 'execute the node' }], WS_A, VALID_WORKFLOW_ORIGIN)
  assert.equal(calls.followups.length, 1)
  assert.deepEqual(calls.followups[0].message.source, VALID_WORKFLOW_ORIGIN)
})

test('workflow_execution origin: validateMessageOrigin contract checks', () => {
  const { ctx } = fakeCtx()
  const s = seam(ctx)
  assert.deepEqual(s.validateMessageOrigin(undefined), { kind: 'user' })
  assert.deepEqual(s.validateMessageOrigin(VALID_WORKFLOW_ORIGIN), VALID_WORKFLOW_ORIGIN)
  const malformed = [
    { ...VALID_WORKFLOW_ORIGIN, extra: 1 },
    { kind: 'workflow_execution', workflowInstanceId: UUID_A, nodeVisitId: UUID_B },
    { ...VALID_WORKFLOW_ORIGIN, workflowInstanceId: 'nope' },
    { ...VALID_WORKFLOW_ORIGIN, attemptId: 'wfeat-x' },
  ]
  for (const origin of malformed) {
    assert.throws(() => s.validateMessageOrigin(origin), TypeError)
  }
  assert.throws(
    () => s.validateMessageOrigin({ kind: 'mystery', sourceAgentId: 'agt_a', correlation: 'c' }),
    /must be "inter_agent" or "workflow_execution"/,
  )
})

test('workflow_execution origin: malformed provenance queues zero messages', async () => {
  const { ctx, calls } = fakeCtx()
  const s = seam(ctx)
  await assert.rejects(
    () => s.prompt('main', [{ type: 'text', text: 'x' }], WS_A, { ...VALID_WORKFLOW_ORIGIN, attemptId: 'bogus' }),
    TypeError,
  )
  assert.equal(calls.followups.length, 0, 'prompt rejected before any message creation')
})
