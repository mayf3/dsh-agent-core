/**
 * Unit tests for @agent-core/demo-server's session seam — the
 * AGENT_CORE_BINDING_WORKSPACE_V1 SESSION_WRITE_CONTRACT, driven with FAKE
 * DSH services (agents factory + persistence) so no real model/process is
 * needed:
 *
 *   R1  cold session           -> agents.create({sessionId, meta:{cwd}}) —
 *                                 the ONLY creation contract; the resolved
 *                                 effective workspace freezes into the header.
 *   R2  persisted session      -> agents.resume(...) with NO meta; the
 *                                 persisted header.cwd is the authority;
 *                                 equal -> the message is queued normally.
 *   R3  cross-workspace        -> structured SESSION_WORKSPACE_MISMATCH:
 *                                 cwd stays persisted, the message is never
 *                                 queued, no second session is created.
 *
 * Together with the Router-level workspace-binding tests (which assert the
 * resolved effective workspace is what reaches this seam) these cover the
 * frozen session-cwd invariants end to end at the seam level; the
 * real-process chain remains the acceptance drivers' territory.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createSessionSeam, SESSION_WORKSPACE_MISMATCH } from '../src/session-seam.js'

const WS_A = '/tmp/ws/root-a'
const WS_B = '/tmp/ws/root-b'

/**
 * Fake DSH service context. `persisted` is a Map sessionId -> cwd (the
 * persisted session headers); the fake agents factory records every
 * create/resume call and returns handles whose header.cwd mirrors the
 * persisted entry (or the requested creation cwd for fresh sessions) —
 * exactly the DSH-native semantics the contract relies on (create freezes
 * meta.cwd into the header; resume restores the persisted header).
 */
function fakeCtx({ persisted = new Map() } = {}) {
  const calls = { create: [], resume: [] }
  const makeHandle = (sessionId, cwd) => ({
    agent: { session: { id: sessionId, seq: 3, header: { cwd } }, followup: (message) => { calls.followups = [...(calls.followups ?? []), { sessionId, message }] } },
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
    ['agentLoop', {}],
    ['sessionPersistence', persistence],
    ['agents', agents],
  ])
  return {
    calls,
    persisted,
    get: (name) => services.get(name),
  }
}

/** A seam over the fake ctx with initialize-time process cwd = WS_A. */
function makeSeam(fake, route = { provider: 'opencode-go', model: 'deepseek-v4-flash' }) {
  return createSessionSeam({
    ctx: fake,
    settings: {
      get cwd() { return WS_A },
      get provider() { return route.provider },
      get model() { return route.model },
      get maxTokens() { return undefined },
    },
  })
}

test('R1: cold session is CREATED with meta:{cwd = resolved workspace} — the only creation contract', async () => {
  const fake = fakeCtx()
  const seam = makeSeam(fake)

  const receipt = await seam.prompt('main', [{ type: 'text', text: 'hello' }], WS_B)

  assert.ok(typeof receipt.messageId === 'string' && receipt.messageId !== '', 'the message was queued')
  assert.equal(fake.calls.create.length, 1, 'exactly one create')
  assert.equal(fake.calls.create[0].sessionId, 'main')
  assert.equal(fake.calls.create[0].meta.cwd, WS_B, 'resolved workspace froze into the session header')
  assert.equal(fake.calls.resume.length, 0)
})

test('R1: a prompt with no cwd falls back to the initialize-time process cwd', async () => {
  const fake = fakeCtx()
  const seam = makeSeam(fake)

  await seam.prompt('main', [{ type: 'text', text: 'hello' }], undefined)

  assert.equal(fake.calls.create[0].meta.cwd, WS_A, 'legacy/scheduler prompts keep the process-level cwd')
})

test('R2: a persisted session is RESUMED with no meta; equal cwd -> the message is queued', async () => {
  const fake = fakeCtx({ persisted: new Map([['main', WS_A]]) })
  const seam = makeSeam(fake)

  await seam.prompt('main', [{ type: 'text', text: 'again' }], WS_A)

  assert.equal(fake.calls.resume.length, 1, 'persisted artifact -> resume')
  assert.equal(fake.calls.resume[0].resumeSessionId, 'main')
  assert.deepEqual(fake.calls.create, [], 'no second session is created')
  assert.equal(fake.calls.followups.length, 1, 'equal cwd -> routed normally')
})

test('R3: persisted cwd != resolved workspace -> STRUCTURED_REJECT, cwd unchanged, no second session', async () => {
  const fake = fakeCtx({ persisted: new Map([['main', WS_A]]) })
  const seam = makeSeam(fake)

  await assert.rejects(
    () => seam.prompt('main', [{ type: 'text', text: 'go to B' }], WS_B),
    (error) => error.code === SESSION_WORKSPACE_MISMATCH,
  )

  // The cwd stays as persisted; the message never entered the session; no
  // other session was created or registered.
  assert.equal(fake.persisted.get('main'), WS_A, 'persisted cwd NOT mutated')
  assert.equal(fake.calls.followups?.length ?? 0, 0, 'message never queued')
  assert.deepEqual(fake.calls.create, [], 'no silently-created replacement session')
  assert.equal(seam.handles.size, 0, 'mismatched handle not registered')
})

test('R3: hot path — a LIVE session resumed/created earlier rejects a different resolved workspace', async () => {
  const fake = fakeCtx()
  const seam = makeSeam(fake)

  await seam.prompt('main', [{ type: 'text', text: 'first' }], WS_A)
  await assert.rejects(
    () => seam.prompt('main', [{ type: 'text', text: 'second' }], WS_B),
    (error) => error.code === SESSION_WORKSPACE_MISMATCH,
  )
  // And back on the right workspace it continues (cwd immutability, not a
  // permanent lock-out).
  const receipt = await seam.prompt('main', [{ type: 'text', text: 'third' }], WS_A)
  assert.ok(typeof receipt.messageId === 'string' && receipt.messageId !== '')
})

test('R3: a persisted session WITHOUT a header.cwd also rejects (never silently adopts one)', async () => {
  const fake = fakeCtx({ persisted: new Map([['legacy', undefined]]) })
  const seam = makeSeam(fake)

  await assert.rejects(
    () => seam.prompt('legacy', [{ type: 'text', text: 'x' }], WS_A),
    (error) => error.code === SESSION_WORKSPACE_MISMATCH,
  )
})

test('same workspace, multiple sessions: independent handles, same frozen cwd (AC2/AC7 seam level)', async () => {
  const fake = fakeCtx()
  const seam = makeSeam(fake)

  await seam.prompt('main', [{ type: 'text', text: 'a' }], WS_A)
  await seam.prompt('cron-daily', [{ type: 'text', text: 'b' }], WS_A)
  await seam.prompt('memory-maintenance', [{ type: 'text', text: 'c' }], WS_A)

  assert.equal(fake.calls.create.length, 3, 'three distinct native sessions')
  const cwds = fake.calls.create.map(c => c.meta.cwd)
  assert.deepEqual(cwds, [WS_A, WS_A, WS_A], 'same cwd — they share one workspace by construction')
  assert.equal(seam.handles.size, 3, 'trajectory/context stays per-session')
})

test('restart semantics (AC5 seam level): resume restores the persisted cwd and never re-passes meta', async () => {
  // Process 1 creates both sessions in two different workspaces.
  const persisted = new Map()
  const fake1 = fakeCtx({ persisted })
  const seam1 = makeSeam(fake1)
  await seam1.prompt('main-A', [{ type: 'text', text: 'a' }], WS_A)
  await seam1.prompt('main-B', [{ type: 'text', text: 'b' }], WS_B)

  // Process 2 (fresh seam, same persistence) resumes each: no meta is ever
  // passed on resume, and the resolved workspace must MATCH the persisted
  // one for the turn to proceed.
  const fake2 = fakeCtx({ persisted })
  const seam2 = makeSeam(fake2)
  await seam2.prompt('main-A', [{ type: 'text', text: 'a2' }], WS_A)
  await seam2.prompt('main-B', [{ type: 'text', text: 'b2' }], WS_B)
  assert.equal(fake2.calls.resume.length, 2)
  for (const call of fake2.calls.resume) {
    assert.equal('meta' in call, false, 'resume carries NO meta:{cwd}')
  }
  assert.equal(persisted.get('main-A'), WS_A, 'cwd from the persisted header, never re-guessed')
  assert.equal(persisted.get('main-B'), WS_B)

  // A control plane that resolves the WRONG workspace for a persisted
  // session is rejected instead of silently migrating it.
  await assert.rejects(
    () => seam2.prompt('main-A', [{ type: 'text', text: 'x' }], WS_B),
    (error) => error.code === SESSION_WORKSPACE_MISMATCH,
  )
  assert.equal(persisted.get('main-A'), WS_A)
})

test('resolved Luna route is identical for session create and restart resume', async () => {
  const route = { provider: 'openai-codex', model: 'gpt-5.6-luna' }
  const persisted = new Map()
  const first = fakeCtx({ persisted })
  await makeSeam(first, route).prompt('main', [{ type: 'text', text: 'create' }], WS_A)
  assert.deepEqual(first.calls.create[0].agentOptions, route)

  const restarted = fakeCtx({ persisted })
  await makeSeam(restarted, route).prompt('main', [{ type: 'text', text: 'resume' }], WS_A)
  assert.deepEqual(restarted.calls.resume[0].agentOptions, route)
  assert.deepEqual(restarted.calls.create, [], 'resume never creates a replacement with another route')
})
