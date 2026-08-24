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

import {
  FORUM, STORE_URL, VALID_BODY, WORKFLOW, basic, deliver, makeRoot, mount, okFetch,
  readStoreDoc, recordOf, runCrashChild, stubRouter,
} from './idempotency-test-support.js'

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
