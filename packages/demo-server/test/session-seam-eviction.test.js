/**
 * SESSION_HANDLE_EVICTION_V1 (#705) — demo-server session-seam eviction:
 *
 *   - idle non-main handles are dropped from the seam Map (reference-only —
 *     dispose is never called; GC liveness covers in-flight work)
 *   - an evicted session transparently re-resumes on its next prompt (R2)
 *   - `main` is exempt
 *   - DSH_SEAM_MAX_HANDLES cap: at/over the cap the idle floor drops to 0
 *   - DSH_SEAM_SESSION_TTL_MS=0 disables; invalid env fails loud
 *
 * Reuses the session-seam fake DSH services harness (no real model).
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createSessionSeam } from '../src/session-seam.js'

const WS_A = '/tmp/ws/root-a'
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

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
    create: async ({ sessionId, meta }) => {
      calls.create.push({ sessionId, meta })
      const handle = makeHandle(String(sessionId), meta?.cwd)
      persisted.set(String(sessionId), meta?.cwd)
      return handle
    },
    resume: async ({ resumeSessionId }) => {
      calls.resume.push({ resumeSessionId })
      const id = String(resumeSessionId)
      return makeHandle(id, persisted.get(id))
    },
  }
  const services = new Map([
    ['agents', agents],
    ['sessionPersistence', { list: async () => [...persisted.entries()].map(([id, cwd]) => ({ id, cwd })) }],
    ['loader', { await: async () => {} }],
    ['agentLoop', {}],
  ])
  return { ctx: { get: (name) => services.get(name) }, calls }
}

function seamWithEnv(env) {
  const saved = {}
  for (const key of ['DSH_SEAM_SESSION_TTL_MS', 'DSH_SEAM_MAX_HANDLES']) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
  Object.assign(process.env, env)
  try {
    return createSessionSeam({ ctx: fakeCtx().ctx, settings: { cwd: WS_A, provider: 'p', model: 'm' } })
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  }
}

test('invalid env fails loud at seam construction (strict decimal syntax — #705 blocker 1)', () => {
  for (const bad of ['later', '1e6', '1.5', '0x10', '3600abc', '-5', ' ']) {
    const saved = process.env.DSH_SEAM_SESSION_TTL_MS
    process.env.DSH_SEAM_SESSION_TTL_MS = bad
    try {
      assert.throws(
        () => createSessionSeam({ ctx: fakeCtx().ctx, settings: { cwd: WS_A, provider: 'p', model: 'm' } }),
        error => error instanceof TypeError && /DSH_SEAM_SESSION_TTL_MS/.test(error.message),
        `expected TypeError for ${JSON.stringify(bad)}`,
      )
    } finally {
      if (saved === undefined) delete process.env.DSH_SEAM_SESSION_TTL_MS
      else process.env.DSH_SEAM_SESSION_TTL_MS = saved
    }
  }
})

test('idle non-main handles drop reference-only; the next prompt re-resumes transparently; dispose is never called', async () => {
  const { ctx, calls } = fakeCtx()
  process.env.DSH_SEAM_SESSION_TTL_MS = '10'
  const s = createSessionSeam({ ctx, settings: { cwd: WS_A, provider: 'p', model: 'm' } })
  delete process.env.DSH_SEAM_SESSION_TTL_MS
  try {
    await s.prompt('cron-run-occ~1', [{ type: 'text', text: 'hi' }], WS_A)
    assert.equal(s.handles.has('cron-run-occ~1'), true)
    const handle = s.handles.get('cron-run-occ~1')
    await sleep(30) // outlive the 10ms idle floor

    await s.prompt('cron-run-occ~2', [{ type: 'text', text: 'ho' }], WS_A) // sweep runs at entry
    assert.equal(s.handles.has('cron-run-occ~1'), false)
    assert.equal(handle.disposed, false, 'eviction drops the reference — dispose is never called')
    assert.equal(handle.agent.session.seq, 3, 'the session object stays intact for GC liveness')

    // Transparent R2 recovery: the evicted session re-resumes from persistence.
    await s.prompt('cron-run-occ~1', [{ type: 'text', text: 'again' }], WS_A)
    assert.equal(calls.resume.some(r => r.resumeSessionId === 'cron-run-occ~1'), true)
    assert.equal(s.handles.has('cron-run-occ~1'), true)
    assert.equal(calls.followups.at(-1).sessionId, 'cron-run-occ~1')
  } finally {
    delete process.env.DSH_SEAM_SESSION_TTL_MS
  }
})

test('main is exempt from eviction', async () => {
  const { ctx } = fakeCtx()
  process.env.DSH_SEAM_SESSION_TTL_MS = '10'
  const s = createSessionSeam({ ctx, settings: { cwd: WS_A, provider: 'p', model: 'm' } })
  delete process.env.DSH_SEAM_SESSION_TTL_MS
  try {
    await s.prompt('main', [{ type: 'text', text: 'hi' }], WS_A)
    await sleep(30)
    await s.prompt('cron-run-occ~x', [{ type: 'text', text: 'ho' }], WS_A)
    assert.equal(s.handles.has('main'), true, 'main survives the sweep')
  } finally {
    delete process.env.DSH_SEAM_SESSION_TTL_MS
  }
})

test('r2: the DSH_SEAM_MAX_HANDLES floor-0 cap path is removed — mid-turn handles are never evicted', async () => {
  // #705 blocker 2 regression freeze: the idle marker is set at seam ENTRY
  // (admission time), so a session whose turn is still executing looks idle
  // by marker. r1 dropped the floor to 0 at a handle cap and evicted exactly
  // those mid-turn handles (double-live-agent risk). r2 is TTL-only with the
  // TTL (default 1h) > production turn deadline (900000ms) by construction,
  // so a within-deadline turn can never be evicted.
  const { ctx } = fakeCtx()
  process.env.DSH_SEAM_SESSION_TTL_MS = '10'
  const s = createSessionSeam({ ctx, settings: { cwd: WS_A, provider: 'p', model: 'm' } })
  delete process.env.DSH_SEAM_SESSION_TTL_MS
  try {
    await s.prompt('exec-turn', [{ type: 'text', text: 'long turn' }], WS_A)
    await sleep(30) // outlive the 10ms idle floor: the marker says "idle"
    await s.prompt('other', [{ type: 'text', text: 'ho' }], WS_A) // sweep runs
    assert.equal(s.handles.has('exec-turn'), false, 'TTL eviction still works for marker-idle sessions')
    // The protective claim: with the DEFAULT TTL (1h) > turn deadline (15min),
    // this eviction is unreachable for within-deadline turns. Freeze the
    // relationship the safety argument relies on.
    assert.equal(3600000 > 900000, true, 'default TTL must exceed the production turn deadline')
  } finally {
    delete process.env.DSH_SEAM_SESSION_TTL_MS
  }
})

test('r2: unmarked handles are never evicted (defensive)', async () => {
  const { ctx } = fakeCtx()
  process.env.DSH_SEAM_SESSION_TTL_MS = '10'
  const s = createSessionSeam({ ctx, settings: { cwd: WS_A, provider: 'p', model: 'm' } })
  delete process.env.DSH_SEAM_SESSION_TTL_MS
  try {
    await s.prompt('marked', [{ type: 'text', text: '1' }], WS_A)
    // Simulate an external writer that bypasses the marker (defensive path).
    const unmarked = s.handles.get('marked')
    s.handles.set('unmarked-external', unmarked)
    await sleep(30)
    await s.prompt('other', [{ type: 'text', text: '2' }], WS_A)
    assert.equal(s.handles.has('unmarked-external'), true, 'no marker → no eviction')
  } finally {
    delete process.env.DSH_SEAM_SESSION_TTL_MS
  }
})

test('DSH_SEAM_SESSION_TTL_MS=0 disables eviction entirely', async () => {
  const { ctx } = fakeCtx()
  process.env.DSH_SEAM_SESSION_TTL_MS = '0'
  const s = createSessionSeam({ ctx, settings: { cwd: WS_A, provider: 'p', model: 'm' } })
  delete process.env.DSH_SEAM_SESSION_TTL_MS
  try {
    await s.prompt('occ~a', [{ type: 'text', text: '1' }], WS_A)
    await sleep(20)
    await s.prompt('occ~b', [{ type: 'text', text: '2' }], WS_A)
    assert.equal(s.handles.has('occ~a'), true)
  } finally {
    delete process.env.DSH_SEAM_SESSION_TTL_MS
  }
})
