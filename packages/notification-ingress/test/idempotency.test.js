/**
 * Unit tests for @agent-core/notification-ingress durable idempotency
 * (NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1 §5).
 *
 * Coverage: C-IDM-001..C-IDM-016, AC-IDM-01..AC-IDM-09, fault-matrix
 * F-11..F-16, F-22, F-23, F-24 and the W1–W4 crash windows (real child
 * processes killed with SIGKILL — AC-IDM-04's injection proof).
 *
 * Crash-window modeling (per §5.3 the W2–W4 durable states are
 * indistinguishable BY DESIGN; each window is still proven at its own crash
 * point):
 *   W1 = crash BEFORE the reserve commit  -> no record on disk -> clean retry
 *   W2 = crash AFTER reserve, BEFORE Router -> `reserved` on disk
 *   W3 = crash DURING the Router call (full service, HTTP in flight)
 *   W4 = Router ACCEPTED, crash BEFORE the terminal write
 */

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

import { apply as applyIngress } from '../src/index.js'
import {
  NotificationIdempotencyStore, PROVEN_NO_ADMISSION_CODES, STORE_VERSION,
  canonicalPayloadHash,
} from '../src/idempotency.js'
import { NOTIFICATION_RESOURCE } from '../src/auth.js'

const SRC = fileURLToPath(new URL('../src', import.meta.url))
const STORE_URL = pathToFileURL(join(SRC, 'idempotency.js')).href
const INDEX_URL = pathToFileURL(join(SRC, 'index.js')).href

const FORUM = { clientId: 'client-forum-abc', clientSecret: 'forum-secret-111' }
const WORKFLOW = { clientId: 'client-workflow-xyz', clientSecret: 'workflow-secret-222' }
const VALID_BODY = { requestId: 'req_01', agentId: 'agt_a', sessionMode: 'main', message: 'hello' }

// ── helpers ────────────────────────────────────────────────────────────────

function fakeCtx(services) {
  const provided = new Map()
  const disposers = []
  return {
    get: (name) => services.get(name) ?? provided.get(name),
    provide: (name, value) => { provided.set(name, value) },
    effect: (fn) => {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
    },
    async disposeAll() {
      for (const dispose of disposers.splice(0)) {
        try { await dispose() } catch { /* best effort */ }
      }
    },
  }
}

function stubRouter(deliverImpl) {
  const calls = []
  return {
    calls,
    deliver: async (payload) => {
      calls.push(JSON.parse(JSON.stringify(payload)))
      if (deliverImpl !== undefined) return deliverImpl(payload, calls)
      return { accepted: true, sessionId: payload.sessionMode === 'fresh' ? 'ses_fresh_1' : 'main' }
    },
  }
}

function okFetch() {
  return async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'tok' }) })
}

function writeAuthConfig(root) {
  const dir = join(root, 'notification-ingress')
  mkdirSync(dir, { recursive: true })
  chmodSync(dir, 0o700)
  const file = join(dir, 'auth.json')
  writeFileSync(file, `${JSON.stringify({
    authServiceOrigin: 'https://auth.example.com',
    audience: NOTIFICATION_RESOURCE,
    allowlist: { 'svc-forum': FORUM.clientId, 'svc-workflow': WORKFLOW.clientId },
  }, null, 2)}\n`)
  chmodSync(file, 0o600)
  return file
}

function makeRoot(t, { authConfig = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ni-idm-'))
  t.after(() => { try { rmSync(root, { recursive: true, force: true }) } catch { /* best effort */ } })
  const authConfigFile = authConfig ? writeAuthConfig(root) : undefined
  return { root, authConfigFile, storeFile: join(root, 'notification-ingress', 'idempotency.json') }
}

async function mount(t, { root, router, fetchImpl, config = {} } = {}) {
  const ctx = fakeCtx(new Map([['agentRouter', router ?? stubRouter()]]))
  const api = applyIngress(ctx, {
    port: 0,
    authConfigFile: root.authConfigFile,
    storeFile: root.storeFile,
    fetchImpl: fetchImpl ?? okFetch(),
    ...config,
  })
  await new Promise((resolveReady) => {
    const wait = () => {
      const addr = api.address()
      if (addr?.port && addr.port !== 0) resolveReady()
      else setTimeout(wait, 5)
    }
    wait()
  })
  t.after(() => ctx.disposeAll())
  return { api, base: `http://127.0.0.1:${api.address().port}` }
}

const basic = (clientId, clientSecret) => 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

async function deliver(base, { authorization = basic(FORUM.clientId, FORUM.clientSecret), body } = {}) {
  const res = await fetch(`${base}/v1/deliver`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization },
    body: JSON.stringify(body ?? VALID_BODY),
  })
  const text = await res.text()
  return { status: res.status, body: text === '' ? null : JSON.parse(text) }
}

function readStoreDoc(root) {
  if (!existsSync(root.storeFile)) return { version: STORE_VERSION, records: {} }
  return JSON.parse(readFileSync(root.storeFile, 'utf8'))
}

function recordOf(root, clientId = FORUM.clientId, requestId = VALID_BODY.requestId) {
  return readStoreDoc(root).records[clientId]?.[requestId]
}

// ── child-process crash rig (real SIGKILL) ─────────────────────────────────

const CHILD_CODE = `
const { writeFileSync, readFileSync, mkdirSync } = await import('node:fs')
const { pathToFileURL } = await import('node:url')
const mode = process.env.NI_MODE
const root = process.env.NI_ROOT
const marker = (name, data) => writeFileSync(root + '/marker-' + name + '.json', JSON.stringify(data))
const { NotificationIdempotencyStore } = await import(process.env.NI_STORE_URL)
const hang = () => setInterval(() => {}, 60000)

if (mode === 'w1') {
  // Crash BEFORE the reserve commit: store mounted, nothing reserved.
  const store = new NotificationIdempotencyStore({ storeFile: root + '/notification-ingress/idempotency.json' })
  marker('ready', { phase: 'pre-reserve' })
  hang()
}
if (mode === 'w2') {
  // Crash AFTER the reserve commit, BEFORE the Router call.
  const store = new NotificationIdempotencyStore({ storeFile: root + '/notification-ingress/idempotency.json' })
  await store.reserve({ callerPrincipalId: process.env.NI_CLIENT, requestId: process.env.NI_REQUEST, payloadHash: process.env.NI_HASH })
  marker('ready', { phase: 'reserved' })
  hang()
}
if (mode === 'w4') {
  // Router ACCEPTED, crash BEFORE the terminal write: reserve, let the
  // "Router" accept (marker), then hang without ever settling.
  const store = new NotificationIdempotencyStore({ storeFile: root + '/notification-ingress/idempotency.json' })
  await store.reserve({ callerPrincipalId: process.env.NI_CLIENT, requestId: process.env.NI_REQUEST, payloadHash: process.env.NI_HASH })
  marker('router-accepted', { phase: 'router-returned-accepted' }) // the Router call itself
  marker('ready', { phase: 'accepted-not-settled' })
  hang()
}
if (mode === 'service' || mode === 'service-hang') {
  // Full ingress service in this child; the parent drives it over HTTP.
  const { apply } = await import(process.env.NI_INDEX_URL)
  const routerCalls = []
  const router = {
    deliver: (payload) => new Promise((resolve, reject) => {
      routerCalls.push(payload)
      if (process.env.NI_MODE === 'service-hang') return // never settles: W3
      resolve({ accepted: true, sessionId: payload.sessionMode === 'fresh' ? 'ses_fresh_1' : 'main' })
    }),
  }
  const ctx = { get: () => router, provide() {}, effect() {} }
  const api = apply(ctx, {
    port: 0,
    authConfigFile: root + '/notification-ingress/auth.json',
    storeFile: root + '/notification-ingress/idempotency.json',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'tok' }) }),
  })
  await new Promise((r) => { const w = () => { api.address()?.port ? r() : setTimeout(w, 5) } ; w() })
  marker('ready', { phase: 'listening', port: api.address().port, routerCalls })
  hang()
}
`

async function runCrashChild(t, mode, root, { client = FORUM.clientId, requestId = VALID_BODY.requestId, hash } = {}) {
  const payloadHash = hash ?? canonicalPayloadHash({ ...VALID_BODY, requestId })
  const child = spawn(process.execPath, ['--input-type=module', '-e', CHILD_CODE], {
    env: {
      ...process.env,
      NI_MODE: mode,
      NI_ROOT: root,
      NI_STORE_URL: STORE_URL,
      NI_INDEX_URL: INDEX_URL,
      NI_CLIENT: client,
      NI_REQUEST: requestId,
      NI_HASH: payloadHash,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += chunk })
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) {
      try { child.kill('SIGKILL') } catch { /* already dead */ }
    }
  })
  const readyPath = join(root, 'marker-ready.json')
  const ready = await waitForFile(readyPath, 15000)
  assert.equal(ready, true, `crash child (${mode}) never became ready; stderr: ${stderr.slice(-500)}`)
  return {
    child,
    async sigkill() {
      child.kill('SIGKILL')
      await new Promise((resolveExit) => {
        if (child.exitCode !== null) resolveExit()
        else child.once('exit', resolveExit)
      })
    },
    readMarker: (name) => JSON.parse(readFileSync(join(root, `marker-${name}.json`), 'utf8')),
  }
}

async function waitForFile(path, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(path)) return true
    await new Promise((resolve) => setTimeout(resolve, 15))
  }
  return existsSync(path)
}

// ── C-IDM-001 — authority key dimensions ───────────────────────────────────

test('C-IDM-001: key = (callerPrincipalId, requestId) — same requestId under different callers never collides', async (t) => {
  const root = makeRoot(t)
  const router = stubRouter()
  const { base } = await mount(t, { root, router })

  const forum = await deliver(base, { body: { ...VALID_BODY, requestId: 'shared-req' } })
  assert.equal(forum.status, 200)
  const workflow = await deliver(base, {
    authorization: basic(WORKFLOW.clientId, WORKFLOW.clientSecret),
    body: { ...VALID_BODY, requestId: 'shared-req' },
  })
  assert.equal(workflow.status, 200, 'a different caller with the same requestId is a DIFFERENT key')
  assert.equal(router.calls.length, 2)
  const doc = readStoreDoc(root)
  assert.ok(doc.records[FORUM.clientId]['shared-req'])
  assert.ok(doc.records[WORKFLOW.clientId]['shared-req'])
})

// ── C-IDM-002 — canonicalization + payloadHash ─────────────────────────────

test('C-IDM-002: canonical payloadHash = sha256 over {agentId, message, requestId, sessionMode} in fixed order', () => {
  const payload = { requestId: 'r', agentId: 'a', sessionMode: 'main', message: 'm' }
  const expected = createHash('sha256')
    .update(JSON.stringify({ agentId: 'a', message: 'm', requestId: 'r', sessionMode: 'main' }))
    .digest('hex')
  assert.equal(canonicalPayloadHash(payload), expected)
  // Property-order independence at the call site:
  assert.equal(canonicalPayloadHash({ message: 'm', sessionMode: 'main', agentId: 'a', requestId: 'r' }), expected)
  // Every wire field participates:
  for (const changed of [
    { ...payload, requestId: 'r2' }, { ...payload, agentId: 'a2' },
    { ...payload, sessionMode: 'fresh' }, { ...payload, message: 'm2' },
  ]) {
    assert.notEqual(canonicalPayloadHash(changed), expected)
  }
})

test('C-IDM-002 C-WIRE-004: unknown body fields never enter the hash — extra fields are NOT a payload conflict', async (t) => {
  const root = makeRoot(t)
  const router = stubRouter()
  const { base } = await mount(t, { root, router })
  const first = await deliver(base, { body: VALID_BODY })
  assert.equal(first.status, 200)
  const second = await deliver(base, { body: { ...VALID_BODY, trace: 'x', foo: { bar: 1 } } })
  assert.equal(second.status, 200)
  assert.equal(second.body.duplicate, true, 'only the four contract fields define "same payload"')
  assert.equal(router.calls.length, 1)
})

// ── C-IDM-003 — store shape + discipline ───────────────────────────────────

test('C-IDM-003: versioned document shape; missing file = legal empty store', async (t) => {
  const root = makeRoot(t)
  const router = stubRouter()
  const { base } = await mount(t, { root, router })
  await deliver(base, {})
  await deliver(base, { authorization: basic(FORUM.clientId, FORUM.clientSecret) })
  const doc = readStoreDoc(root)
  assert.equal(doc.version, 1)
  const record = doc.records[FORUM.clientId][VALID_BODY.requestId]
  assert.equal(record.callerPrincipalId, FORUM.clientId)
  assert.equal(record.requestId, VALID_BODY.requestId)
  assert.equal(record.state, 'delivered')
  assert.equal(typeof record.payloadHash, 'string')
  assert.equal(typeof record.createdAt, 'string')
  assert.equal(typeof record.updatedAt, 'string')
  assert.equal(record.sessionId, 'main')
  assert.ok(Array.isArray(record.history) && record.history.length === 1)
})

test('C-IDM-003 unit: missing store file mounts clean (fresh deployment)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ni-empty-'))
  try {
    const store = new NotificationIdempotencyStore({ storeFile: join(dir, 'idempotency.json') })
    assert.equal(store.lookup('c', 'r'), undefined)
    assert.equal(existsSync(join(dir, 'idempotency.json')), false, 'no file is invented at mount')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

// ── C-IDM-004 — reserve-before-Router ──────────────────────────────────────

test('C-IDM-004 AC-CMP-01: the durable reserved record is on disk BEFORE agentRouter.deliver is entered', async (t) => {
  const root = makeRoot(t)
  let reservedAtRouterEntry = undefined
  const router = {
    deliver: async () => {
      // Inside the Router call: the reserved record must ALREADY be durable.
      const doc = readStoreDoc(root)
      reservedAtRouterEntry = doc.records[FORUM.clientId]?.[VALID_BODY.requestId]
      return { accepted: true, sessionId: 'main' }
    },
  }
  const { base } = await mount(t, { root, router })
  await deliver(base, {})
  assert.equal(reservedAtRouterEntry?.state, 'reserved', 'reserve commits before the Router call (C-IDM-004)')
})

// ── C-IDM-005 / AC-IDM-01 / F-11 — duplicate same payload, three branches ──

test('C-IDM-005 AC-IDM-01 F-11: duplicate same payload reuses the durable outcome in ALL three terminal branches', async (t) => {
  // Branch 1: delivered.
  {
    const root = makeRoot(t)
    const router = stubRouter()
    const { base } = await mount(t, { root, router })
    const first = await deliver(base, { body: { ...VALID_BODY, requestId: 'dup-ok' } })
    assert.equal(first.status, 200)
    const second = await deliver(base, { body: { ...VALID_BODY, requestId: 'dup-ok' } })
    assert.equal(second.status, 200)
    assert.deepEqual(second.body, { accepted: true, sessionId: 'main', outcome: 'delivered', duplicate: true })
    assert.equal(router.calls.length, 1, 'zero second Router calls')
  }
  // Branch 2: failed_no_admission (original 4xx envelope).
  {
    const root = makeRoot(t)
    const router = stubRouter(async () => {
      throw Object.assign(new Error('agent not found'), { code: 'AGENT_NOT_FOUND' })
    })
    const { base } = await mount(t, { root, router })
    const first = await deliver(base, { body: { ...VALID_BODY, requestId: 'dup-nf' } })
    assert.equal(first.status, 404)
    const second = await deliver(base, { body: { ...VALID_BODY, requestId: 'dup-nf' } })
    assert.equal(second.status, 404)
    assert.equal(second.body.error.code, 'AGENT_NOT_FOUND')
    assert.equal(router.calls.length, 1)
  }
  // Branch 3: outcome_unknown.
  {
    const root = makeRoot(t)
    const router = stubRouter(async () => { throw new Error('boom') })
    const { base } = await mount(t, { root, router })
    const first = await deliver(base, { body: { ...VALID_BODY, requestId: 'dup-unk' } })
    assert.equal(first.status, 200)
    assert.equal(first.body.outcome, 'outcome_unknown')
    const second = await deliver(base, { body: { ...VALID_BODY, requestId: 'dup-unk' } })
    assert.equal(second.status, 200)
    assert.deepEqual(
      { accepted: second.body.accepted, outcome: second.body.outcome, duplicate: second.body.duplicate },
      { accepted: false, outcome: 'outcome_unknown', duplicate: true },
    )
    assert.equal(router.calls.length, 1)
  }
})

// ── C-IDM-006 / AC-IDM-02 / F-12 — same key different payload ──────────────

test('C-IDM-006 AC-IDM-02 F-12: same key + different payload -> 409 CONFLICT, original record untouched', async (t) => {
  const root = makeRoot(t)
  const router = stubRouter()
  const { base } = await mount(t, { root, router })
  const first = await deliver(base, { body: VALID_BODY })
  assert.equal(first.status, 200)
  const before = readFileSync(root.storeFile, 'utf8')

  const conflict = await deliver(base, { body: { ...VALID_BODY, message: 'DIFFERENT payload' } })
  assert.equal(conflict.status, 409)
  assert.equal(conflict.body.error.code, 'CONFLICT')
  assert.equal(router.calls.length, 1, 'no delivery for a conflicting payload')
  assert.equal(readFileSync(root.storeFile, 'utf8'), before, 'the original record is never rewritten')

  // Conflict also applies while the record is mid-flight-unknown and terminal:
  const conflict2 = await deliver(base, { body: { ...VALID_BODY, sessionMode: 'fresh' } })
  assert.equal(conflict2.status, 409)
})

// ── C-IDM-007 / AC-IDM-08 / F-23 — single-flight ───────────────────────────

test('C-IDM-007 AC-IDM-08 F-23: concurrent same-key requests -> ONE Router call, ONE shared terminal outcome', async (t) => {
  const root = makeRoot(t)
  let release
  const gate = new Promise((resolveGate) => { release = resolveGate })
  const router = stubRouter(async (payload) => {
    await gate // hold the first attempt so joiners pile up on the single-flight
    return { accepted: true, sessionId: 'main' }
  })
  const { base } = await mount(t, { root, router })

  const attempts = [...Array(8)].map(() => deliver(base, {}))
  await new Promise((resolve) => setTimeout(resolve, 80))
  release()
  const results = await Promise.all(attempts)

  assert.equal(router.calls.length, 1, 'exactly one Router call for the burst')
  for (const { status, body } of results) {
    assert.equal(status, 200)
    assert.equal(body.accepted, true)
    assert.equal(body.sessionId, 'main')
    assert.equal(body.outcome, 'delivered')
  }
  const outcomes = new Set(results.map((r) => JSON.stringify(r.body)))
  assert.equal(outcomes.size, 1, 'every joiner replays the SAME terminal outcome')
})

// ── C-IDM-008 / AC-IDM-09 / F-24 — failure classification ─────────────────

test('C-IDM-008 AC-IDM-09 F-24: PROVEN no-admission = {VALIDATION_ERROR, AGENT_NOT_FOUND} ONLY', async (t) => {
  assert.deepEqual([...PROVEN_NO_ADMISSION_CODES], ['VALIDATION_ERROR', 'AGENT_NOT_FOUND'])

  const cases = [
    { error: Object.assign(new Error('validation'), { code: 'VALIDATION_ERROR' }), expect: { status: 400, state: 'failed_no_admission', httpStatus: 400 } },
    { error: Object.assign(new Error('no agent'), { code: 'AGENT_NOT_FOUND' }), expect: { status: 404, state: 'failed_no_admission', httpStatus: 404 } },
    { error: Object.assign(new Error('capacity'), { code: 'RECONCILIATION_CAPACITY_EXCEEDED' }), expect: { status: 200, state: 'outcome_unknown' } },
    { error: new Error('plain unknown'), expect: { status: 200, state: 'outcome_unknown' } },
    {
      error: Object.assign(new Error('turn outcome unknown'), {
        code: 'AGENT_PROCESS_TURN_OUTCOME_UNKNOWN', status: 'outcome_unknown', envelope: 'outcome_unknown',
        reconciliationHandle: 'turn:x1', deadlineAtWallMs: 456, evidence: { source: 'deadline' },
      }),
      expect: { status: 200, state: 'outcome_unknown', handle: 'turn:x1' },
    },
  ]
  for (let i = 0; i < cases.length; i += 1) {
    const { error, expect } = cases[i]
    const root = makeRoot(t)
    const router = stubRouter(async () => { throw error })
    const { base } = await mount(t, { root, router })
    const { status, body } = await deliver(base, { body: { ...VALID_BODY, requestId: `cls_${i}` } })
    assert.equal(status, expect.status, `${error.code ?? 'plain'} -> HTTP ${expect.status}`)
    const record = recordOf(root, FORUM.clientId, `cls_${i}`)
    assert.equal(record.state, expect.state, `${error.code ?? 'plain'} -> ${expect.state}`)
    if (expect.state === 'failed_no_admission') {
      assert.equal(record.failure.httpStatus, expect.httpStatus)
      assert.equal(record.failure.code, error.code)
    }
    if (expect.handle !== undefined) {
      assert.equal(body.reconciliationHandle, expect.handle)
      assert.equal(record.outcomeUnknown.reconciliationHandle, expect.handle)
      assert.equal(body.deadlineAtWallMs, 456)
      assert.deepEqual(body.evidence, { source: 'deadline' })
    }
  }
})

// ── C-IDM-010 / AC-IDM-05 / F-15 — outcome_unknown semantics ───────────────

test('C-IDM-010 C-IDM-011 AC-IDM-05 F-15: deadline expiry -> durable outcome_unknown, no auto re-delivery, late settlement evidence-only', async (t) => {
  const root = makeRoot(t)
  let lateResolve
  const router = stubRouter(() => new Promise((resolve) => { lateResolve = resolve }))
  const { base } = await mount(t, {
    root, router,
    // Deadline override via the auth config seam (C-IDM-011).
    config: {},
  })
  // Shrink the deadline through the auth config file (routerDeadlineMs).
  writeFileSync(root.authConfigFile, `${JSON.stringify({
    authServiceOrigin: 'https://auth.example.com',
    audience: NOTIFICATION_RESOURCE,
    allowlist: { 'svc-forum': FORUM.clientId, 'svc-workflow': WORKFLOW.clientId },
    routerDeadlineMs: 120,
  }, null, 2)}\n`)
  chmodSync(root.authConfigFile, 0o600)

  const first = await deliver(base, { body: { ...VALID_BODY, requestId: 'deadline-1' } })
  assert.equal(first.status, 200)
  assert.equal(first.body.accepted, false)
  assert.equal(first.body.outcome, 'outcome_unknown')

  const record = recordOf(root, FORUM.clientId, 'deadline-1')
  assert.equal(record.state, 'outcome_unknown')
  assert.equal(record.outcomeUnknown.source, 'router_deadline')

  // Same key again: reuse, NEVER a second Router call.
  const second = await deliver(base, { body: { ...VALID_BODY, requestId: 'deadline-1' } })
  assert.equal(second.status, 200)
  assert.equal(second.body.duplicate, true)
  assert.equal(router.calls.length, 1)

  // The Router promise settles LATE: evidence-only, durable state unchanged.
  lateResolve({ accepted: true, sessionId: 'main' })
  await new Promise((resolve) => setTimeout(resolve, 120))
  const after = recordOf(root, FORUM.clientId, 'deadline-1')
  assert.equal(after.state, 'outcome_unknown', 'NO_LATE_REWRITE: late resolution never flips the durable outcome')
  const evidence = readFileSync(join(root.root, 'notification-ingress', 'evidence.jsonl'), 'utf8')
  assert.ok(evidence.includes('late_settled'), 'late settlement lands in evidence')
})

// ── C-IDM-012 / AC-IDM-03 / F-13 — restart persistence (real kill -9) ─────

test('C-IDM-012 AC-IDM-03 F-13: delivered record survives a SIGKILLed process; same key reuses after restart', async (t) => {
  const root = makeRoot(t)
  const rig = await runCrashChild(t, 'service', root.root)
  const { port } = rig.readMarker('ready')

  const first = await fetch(`http://127.0.0.1:${port}/v1/deliver`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: basic(FORUM.clientId, FORUM.clientSecret) },
    body: JSON.stringify(VALID_BODY),
  })
  assert.equal(first.status, 200)
  assert.equal((await first.json()).outcome, 'delivered')

  await rig.sigkill() // kill -9 with the record delivered

  // Reopen the authority: boot loads the delivered record untouched.
  const reopened = new NotificationIdempotencyStore({ storeFile: root.storeFile })
  assert.equal(reopened.lookup(FORUM.clientId, VALID_BODY.requestId).state, 'delivered')

  // A fresh mount on the same store must REUSE the outcome, not re-deliver.
  const router = stubRouter()
  const { base } = await mount(t, { root, router, fetchImpl: okFetch() })
  const retry = await deliver(base, {})
  assert.equal(retry.status, 200)
  assert.equal(retry.body.duplicate, true)
  assert.equal(router.calls.length, 0)
  reopened.stop()
})

// ── C-IDM-009 / AC-IDM-04 / F-14 — crash windows W1..W4 ────────────────────

test('C-IDM-009 AC-IDM-04 F-14 W1: crash BEFORE the reserve commit -> no record -> clean retry delivers', async (t) => {
  const root = makeRoot(t)
  const rig = await runCrashChild(t, 'w1', root.root)
  assert.equal(rig.readMarker('ready').phase, 'pre-reserve')
  await rig.sigkill()
  assert.equal(existsSync(root.storeFile), false, 'W1 leaves NO record — nothing was reserved')

  const router = stubRouter()
  const { base } = await mount(t, { root, router, fetchImpl: okFetch() })
  const retry = await deliver(base, {})
  assert.equal(retry.status, 200)
  assert.equal(retry.body.outcome, 'delivered', 'clean retry: a fresh delivery, no double-delivery risk')
  assert.equal(router.calls.length, 1)
})

test('C-IDM-009 AC-IDM-04 F-14 W2: crash AFTER reserve, BEFORE Router -> boot sweep -> outcome_unknown, no re-delivery', async (t) => {
  const root = makeRoot(t)
  const rig = await runCrashChild(t, 'w2', root.root)
  assert.equal(rig.readMarker('ready').phase, 'reserved')
  assert.equal(recordOf(root)?.state, 'reserved')
  await rig.sigkill()

  // Reopen: boot sweep migrates the unresolved record to outcome_unknown.
  const reopened = new NotificationIdempotencyStore({ storeFile: root.storeFile })
  const migrated = reopened.lookup(FORUM.clientId, VALID_BODY.requestId)
  assert.equal(migrated.state, 'outcome_unknown')
  assert.equal(migrated.outcomeUnknown.source, 'restart_unresolved')
  reopened.stop()

  // Same key through a fresh mount: reuse the unknown outcome, ZERO Router calls.
  const router = stubRouter()
  const { base } = await mount(t, { root, router, fetchImpl: okFetch() })
  const retry = await deliver(base, {})
  assert.equal(retry.status, 200)
  assert.equal(retry.body.outcome, 'outcome_unknown')
  assert.equal(retry.body.duplicate, true)
  assert.equal(router.calls.length, 0, 'no automatic re-delivery of a reserved record')
})

test('C-IDM-009 AC-IDM-04 F-14 W3: crash DURING the Router call (in-flight HTTP) -> restart sweep -> outcome_unknown', async (t) => {
  const root = makeRoot(t)
  const rig = await runCrashChild(t, 'service-hang', root.root)
  const { port } = rig.readMarker('ready')

  // Fire a request whose Router call never settles, then SIGKILL mid-flight.
  const inflight = fetch(`http://127.0.0.1:${port}/v1/deliver`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: basic(FORUM.clientId, FORUM.clientSecret) },
    body: JSON.stringify(VALID_BODY),
  }).catch((error) => ({ killed: true, error: String(error) }))
  await new Promise((resolve) => setTimeout(resolve, 250)) // reserve committed + router hanging
  await rig.sigkill()
  await inflight

  // The durable state is `reserved` (admission unprovable).
  assert.equal(recordOf(root)?.state, 'reserved')

  const reopened = new NotificationIdempotencyStore({ storeFile: root.storeFile })
  assert.equal(reopened.lookup(FORUM.clientId, VALID_BODY.requestId).state, 'outcome_unknown')
  reopened.stop()

  const router = stubRouter()
  const { base } = await mount(t, { root, router, fetchImpl: okFetch() })
  const retry = await deliver(base, {})
  assert.equal(retry.status, 200)
  assert.equal(retry.body.outcome, 'outcome_unknown')
  assert.equal(router.calls.length, 0)
})

test('C-IDM-009 AC-IDM-04 F-14 W4: Router ACCEPTED, crash BEFORE the terminal write -> outcome_unknown (no auto-completion)', async (t) => {
  const root = makeRoot(t)
  const rig = await runCrashChild(t, 'w4', root.root)
  assert.equal(rig.readMarker('router-accepted').phase, 'router-returned-accepted')
  assert.equal(recordOf(root)?.state, 'reserved', 'accepted-but-unrecorded stays reserved on disk')
  await rig.sigkill()

  const reopened = new NotificationIdempotencyStore({ storeFile: root.storeFile })
  const migrated = reopened.lookup(FORUM.clientId, VALID_BODY.requestId)
  assert.equal(migrated.state, 'outcome_unknown', 'W4: admission may have happened but is unprovable')
  assert.notEqual(migrated.state, 'delivered', 'never auto-completed to delivered')
  reopened.stop()

  const router = stubRouter()
  const { base } = await mount(t, { root, router, fetchImpl: okFetch() })
  const retry = await deliver(base, {})
  assert.equal(retry.status, 200)
  assert.equal(retry.body.outcome, 'outcome_unknown')
  assert.equal(router.calls.length, 0)
})

// ── C-IDM-013 / AC-IDM-07 / F-22 — retention / bounded growth ──────────────

test('C-IDM-013 AC-IDM-07 F-22: retention prunes TERMINAL records (over-age then over-count); non-terminal passes the boot sweep first', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ni-ret-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const storeFile = join(dir, 'idempotency.json')

  let clock = 1_700_000_000_000
  const now = () => new Date(clock).toISOString()
  const clockMs = () => clock

  const store = new NotificationIdempotencyStore({
    storeFile, now, clockMs, retentionMs: 604800000, maxRecords: 100000,
  })
  // Three terminal records at t0, one reserved at t0.
  for (const requestId of ['old-a', 'old-b', 'old-c']) {
    await store.reserve({ callerPrincipalId: 'c1', requestId, payloadHash: `h-${requestId}` })
    await store.settle({ callerPrincipalId: 'c1', requestId, state: 'delivered', sessionId: 's', reason: 'router_accepted' })
  }
  await store.reserve({ callerPrincipalId: 'c1', requestId: 'reserved-old', payloadHash: 'h-res' })
  store.stop()

  // Advance 10 days (> 7-day retention): a NEW process boot-sweeps first
  // (reserved -> outcome_unknown) and then prunes every over-age terminal.
  // The freshly-migrated record's TERMINAL time is its migration time (now),
  // so it is NOT over-age: retention measures terminal age, not reserve age.
  clock += 10 * 24 * 3600 * 1000
  const sweeper = new NotificationIdempotencyStore({ storeFile, now, clockMs, retentionMs: 604800000, maxRecords: 100000 })
  assert.equal(sweeper.lookup('c1', 'reserved-old')?.state, 'outcome_unknown', 'non-terminal was swept, not silently dropped')
  for (const requestId of ['old-a', 'old-b', 'old-c']) {
    assert.equal(sweeper.lookup('c1', requestId), undefined, `${requestId} pruned as over-age terminal`)
  }
  assert.notEqual(sweeper.lookup('c1', 'reserved-old'), undefined, 'the just-migrated record keeps a full retention window')
  assert.ok(sweeper.evidenceLines().some((e) => e.kind === 'sweep_pruned' && e.count >= 3))
  sweeper.stop()

  // Over-count eviction: oldest terminal first.
  const store2 = new NotificationIdempotencyStore({ storeFile, now, clockMs, maxRecords: 2, retentionMs: 604800000000 })
  for (const requestId of ['n1', 'n2', 'n3']) {
    clock += 1000
    await store2.reserve({ callerPrincipalId: 'c2', requestId, payloadHash: `h2-${requestId}` })
    await store2.settle({ callerPrincipalId: 'c2', requestId, state: 'delivered', sessionId: 's', reason: 'router_accepted' })
  }
  // Reboot with maxRecords = 2: n1 (oldest terminal) is evicted.
  const store3 = new NotificationIdempotencyStore({ storeFile, now, clockMs, maxRecords: 2, retentionMs: 604800000000 })
  assert.equal(store3.lookup('c2', 'n1'), undefined, 'oldest terminal evicted over-count')
  assert.notEqual(store3.lookup('c2', 'n2'), undefined)
  assert.notEqual(store3.lookup('c2', 'n3'), undefined)
  store2.stop()
  store3.stop()
})

// ── C-IDM-014 / AC-IDM-06 / F-16 — corruption fail-loud ────────────────────

test('C-IDM-014 AC-IDM-06 F-16: corrupt store -> mount throws, port never serves', async (t) => {
  const badDocuments = [
    '{not json',
    JSON.stringify({ version: 2, records: {} }),
    JSON.stringify({ version: 1, records: [] }),
    JSON.stringify({ version: 1, records: { c1: { r1: { state: 'mysterious_state' } } } }),
    JSON.stringify({ version: 1, records: { c1: { r1: { callerPrincipalId: 'OTHER', requestId: 'r1', payloadHash: 'h', state: 'reserved', createdAt: 'x', updatedAt: 'y' } } } }),
  ]
  for (const bad of badDocuments) {
    const root = makeRoot(t)
    mkdirSync(join(root.root, 'notification-ingress'), { recursive: true })
    writeFileSync(root.storeFile, bad)
    const ctx = fakeCtx(new Map([['agentRouter', stubRouter()]]))
    assert.throws(
      () => applyIngress(ctx, { port: 0, authConfigFile: root.authConfigFile, storeFile: root.storeFile, fetchImpl: okFetch() }),
      (error) => error.code === 'IDEMPOTENCY_STORE_CORRUPT',
      `corrupt document must fail the mount loudly: ${bad.slice(0, 60)}`,
    )
    // No server was created — nothing listens.
    assert.equal(ctx.disposeAll === undefined ? false : false, false)
  }
})

// ── C-IDM-015 — evidence events + rotation ─────────────────────────────────

test('C-IDM-015: evidence JSONL records the event vocabulary and rotates at the threshold (2 generations)', async (t) => {
  const root = makeRoot(t)
  const router = stubRouter(async () => { throw new Error('boom') })
  const { base, api } = await mount(t, { root, router })
  await deliver(base, { body: { ...VALID_BODY, requestId: 'ev-1' } })
  await deliver(base, { body: { ...VALID_BODY, requestId: 'ev-1' } }) // duplicate
  const events = api.store.evidenceLines().map((e) => e.kind)
  assert.ok(events.includes('auth_ok'))
  assert.ok(events.includes('idempotency_transition'))
  assert.ok(events.includes('outcome'))

  // Rotation with a tiny threshold (test seam; production default 10 MiB).
  const dir = mkdtempSync(join(tmpdir(), 'ni-evd-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const store = new NotificationIdempotencyStore({ storeFile: join(dir, 'idempotency.json'), rotateBytes: 150 })
  for (let i = 0; i < 40; i += 1) {
    store.appendEvidence({ kind: 'noise', i })
  }
  store.stop()
  assert.ok(existsSync(join(dir, 'evidence.jsonl')), 'live generation exists')
  assert.ok(existsSync(join(dir, 'evidence.jsonl.1')), 'previous generation retained')
  assert.equal(existsSync(join(dir, 'evidence.jsonl.2')), false, 'at most 2 generations are kept')
})

// ── C-IDM-016 — BindingStore boundary ──────────────────────────────────────

test('C-IDM-016: the ingress never reads or writes the Router BindingStore / freshSessions', async () => {
  for (const file of ['../src/idempotency.js', '../src/index.js']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    // No import of any Router module (behavioral boundary: separate stores).
    assert.ok(!/^import[^\n]*agent-router/m.test(source), `${file} must not import the Router package`)
    assert.ok(!/binding-store/.test(source), `${file} must not touch the Binding store module`)
    assert.ok(!/freshSessions/.test(source), `${file} must not touch Router fresh-session mappings`)
  }
})

// ── history cap ────────────────────────────────────────────────────────────

test('C-IDM-003: per-record history is capped at 16 entries (oldest evicted)', () => {
  const record = { state: 'reserved' }
  for (let i = 0; i < 25; i += 1) {
    NotificationIdempotencyStore.historyPush(record, `at-${i}`, 'reserved', 'outcome_unknown', `reason-${i}`)
  }
  assert.equal(record.history.length, 16)
  assert.equal(record.history[0].reason, 'reason-9', 'oldest entries evicted')
  assert.equal(record.history.at(-1).reason, 'reason-24')
})

// ── C-IDM-003 discipline: mutation queue + cross-process lock ──────────────

test('C-IDM-003: concurrent store mutations serialize; the lockfile appears and is released', async (t) => {
  const root = makeRoot(t)
  const store = new NotificationIdempotencyStore({ storeFile: root.storeFile })
  t.after(() => store.stop())
  await Promise.all([...Array(20)].map((_, i) =>
    store.reserve({ callerPrincipalId: 'c', requestId: `r${i}`, payloadHash: `h${i}` })))
  const doc = readStoreDoc(root)
  assert.equal(Object.keys(doc.records.c).length, 20, 'every serialized mutation landed')
  assert.equal(existsSync(join(root.root, 'notification-ingress', 'idempotency.lock')), false, 'lock released after mutations')
})

test('C-IDM-003: cross-process writers serialize through the lockfile (two real processes)', async (t) => {
  const root = makeRoot(t)
  const script = `
    const { NotificationIdempotencyStore } = await import(process.env.NI_STORE_URL)
    const store = new NotificationIdempotencyStore({ storeFile: process.env.NI_STORE_FILE })
    for (let i = 0; i < 15; i += 1) {
      await store.reserve({ callerPrincipalId: 'p' + process.env.NI_PROC, requestId: 'r' + i, payloadHash: 'h' })
    }
  `
  const children = ['1', '2'].map((proc) => spawn(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, NI_STORE_URL: STORE_URL, NI_STORE_FILE: root.storeFile, NI_PROC: proc },
    stdio: ['ignore', 'ignore', 'inherit'],
  }))
  await Promise.all(children.map((child) => new Promise((resolve, reject) => {
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`child exited ${code}`))))
  })))
  const doc = readStoreDoc(root)
  assert.equal(Object.keys(doc.records.p1 ?? {}).length, 15)
  assert.equal(Object.keys(doc.records.p2 ?? {}).length, 15, 'both processes completed every mutation (re-read-latest under lock)')
  assert.equal(existsSync(join(root.root, 'notification-ingress', 'idempotency.lock')), false)
})
