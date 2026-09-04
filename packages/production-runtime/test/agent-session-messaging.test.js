/**
 * AGENT_CORE_AGENT_SESSION_MESSAGING_V1 — trusted handler contract tests for
 * the agentSessionMessagingAccess provider:
 *
 *   R2   authoritative three-field validation (byte bounds, NUL, no default
 *        timeout) BEFORE any side effect
 *   R3   trusted runtime identity + exact source-turn proof; self-send
 *        rejected before delivery
 *   R7   timeout=0 returns {status:'accepted'} on the real inbox receipt
 *   R8   timeout>0 closed outcome mapping; timeout distinct from
 *        outcome_unknown / failed / no_output / truncated
 *   R10  exactly ONE deliver call — no replay
 *   R12  frozen audit commit order (intent BEFORE delivery; outcome after;
 *        intent append failure = zero deliveries; post-receipt outcome
 *        append failure preserves the proven business result)
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createAgentSessionMessagingAccess, validateSendArgs } from '../src/agent-session-messaging.js'
import { createAgentSessionMessagingAudit } from '../src/agent-session-messaging-audit.js'

const CALLER = 'agt_a-caller'
const TARGET = 'agt_b-target'
const PROOF = 'turn:1:a1:g1:s1'

/** Manual clock + timer seams (deterministic, no sleeps). */
function fakeClock(start = 10_000) {
  const clock = { now: start }
  const pending = new Map()
  let seq = 0
  return {
    now: () => clock.now,
    advance: (ms) => { clock.now += ms },
    timer: {
      set(fn, ms) {
        const handle = { id: ++seq }
        pending.set(handle, { at: clock.now + ms, fn })
        return handle
      },
      clear(handle) { pending.delete(handle) },
      fireDue() {
        for (const [handle, entry] of [...pending]) {
          if (entry.at <= clock.now) {
            pending.delete(handle)
            entry.fn()
          }
        }
      },
    },
  }
}

/** Fake router: deliver records once; reconciliation store is a fixture. */
function fakeRouter({ deliverImpl, states = {} } = {}) {
  const listeners = new Set()
  const router = {
    deliveries: [],
    setState: (handle, state) => { states[handle] = state },
    deliver: async (req, controlOpts) => {
      if (deliverImpl) return deliverImpl(req, controlOpts)
      router.deliveries.push({ req, controlOpts })
      return { accepted: true, sessionId: 'main', messageId: 'm1', reconciliationHandle: 'turn:1', evidence: {} }
    },
    readFinalAssistantOutput: (handle) => states[handle] ?? { state: 'pending' },
    onTurnReconciled: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    emitReconciled: (handle, event = {}) => { for (const l of [...listeners]) l({ handle, ...event }) },
  }
  return router
}

function buildAccess({ router, auditFile, audit, onAuditFailure, clock = fakeClock() } = {}) {
  const file = auditFile ?? join(mkdtempSync(join(tmpdir(), 'asm-handler-')), 'audit.jsonl')
  const surface = audit ?? createAgentSessionMessagingAudit({ auditFile: file, now: clock.now })
  const access = createAgentSessionMessagingAccess({
    router: router ?? fakeRouter(),
    audit: surface,
    onAuditFailure,
    generateRequestId: (() => { let n = 0; return () => `req-${++n}` })(),
    now: clock.now,
    timer: clock.timer,
  })
  return { access, file: auditFile ?? file, surface }
}

const VALID_ARGS = { targetAgentId: TARGET, message: 'hello there', timeoutSeconds: 0 }

function auditRows(file) {
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8').trim().split('\n').filter((line) => line !== '').map((line) => JSON.parse(line))
}

// ------------------------------------------------------------ R2 validation

test('R2: the exact three fields accept boundary values', () => {
  assert.equal(validateSendArgs({ targetAgentId: TARGET, message: 'a', timeoutSeconds: 0 }).ok, true)
  assert.equal(validateSendArgs({ targetAgentId: TARGET, message: 'é'.repeat(32768), timeoutSeconds: 300 }).ok, true, '65536 UTF-8 bytes is inside the bound')
})

test('R2: byte-length, NUL, grammar, and range violations reject with invalid_arguments detail', () => {
  const cases = [
    [{ targetAgentId: TARGET, message: 'x'.repeat(65537), timeoutSeconds: 0 }, 'byte bound'],
    [{ targetAgentId: TARGET, message: 'bad\u0000nul', timeoutSeconds: 0 }, 'NUL'],
    [{ targetAgentId: 'agt_!bad', message: 'x', timeoutSeconds: 0 }, 'grammar'],
    [{ targetAgentId: `agt_${'a'.repeat(200)}`, message: 'x', timeoutSeconds: 0 }, 'too long'],
    [{ targetAgentId: TARGET, message: '', timeoutSeconds: 0 }, 'empty message'],
    [{ targetAgentId: TARGET, message: 'x' }, 'missing timeout'],
    [{ targetAgentId: TARGET, message: 'x', timeoutSeconds: -1 }, 'negative timeout'],
    [{ targetAgentId: TARGET, message: 'x', timeoutSeconds: 301 }, 'timeout above 300'],
    [{ targetAgentId: TARGET, message: 'x', timeoutSeconds: 1.5 }, 'fractional timeout'],
    [{ targetAgentId: TARGET, message: 'x', timeoutSeconds: '0' }, 'string timeout'],
    [{ targetAgentId: TARGET, timeoutSeconds: 0 }, 'missing message'],
    [{ message: 'x', timeoutSeconds: 0 }, 'missing targetAgentId'],
    [{ targetAgentId: TARGET, message: 'x', timeoutSeconds: 0, sessionId: 'main' }, 'undeclared property'],
    [{ targetAgentId: TARGET, message: 'x', timeoutSeconds: 0, sourceAgentId: CALLER }, 'forbidden identity property'],
  ]
  for (const [args, label] of cases) {
    const checked = validateSendArgs(args)
    assert.equal(checked.ok, false, `${label} must reject`)
  }
})

// -------------------------------------------------- R3 trusted derivation

test('R3: a missing or stale source-turn proof fails BEFORE Router delivery', async () => {
  const router = fakeRouter()
  const { access, file } = buildAccess({ router })
  for (const context of [{ callerAgentId: CALLER }, { callerAgentId: CALLER, sourceTurnExecutionId: '' }, {}]) {
    const envelope = await access.handlers.agent_session_send.send(VALID_ARGS, context)
    assert.equal(envelope.error.code, 'internal_error')
  }
  assert.equal(router.deliveries.length, 0, 'zero Router deliveries')
  const rows = auditRows(file)
  assert.equal(rows.length, 3, 'every unprovable call has one L0 denial row')
  assert.ok(rows.every((row) => row.phase === 'denial' && row.code === 'internal_error'))
})

test('R3: self-send is rejected before delivery and before any audit intent', async () => {
  const router = fakeRouter()
  const { access, file } = buildAccess({ router })
  const envelope = await access.handlers.agent_session_send.send(
    { targetAgentId: CALLER, message: 'x', timeoutSeconds: 0 },
    { callerAgentId: CALLER, sourceTurnExecutionId: PROOF },
  )
  assert.equal(envelope.error.code, 'self_send_not_supported')
  assert.equal(router.deliveries.length, 0)
  assert.deepEqual(auditRows(file).map((row) => [row.phase, row.code]), [['denial', 'self_send_not_supported']])
})

test('R3/R4: a trusted legal opaque source id with underscores is preserved exactly', async () => {
  const router = fakeRouter()
  const { access } = buildAccess({ router })
  const sourceAgentId = 'agt_stock_agent'
  const envelope = await access.handlers.agent_session_send.send(
    VALID_ARGS,
    { callerAgentId: sourceAgentId, sourceTurnExecutionId: PROOF },
  )
  assert.deepEqual(envelope, { ok: true, result: { status: 'accepted' } })
  assert.equal(router.deliveries[0].controlOpts.messageOrigin.sourceAgentId, sourceAgentId)
})

test('R3/R4: one deliver carries the frozen inter_agent messageOrigin built from trusted context', async () => {
  const router = fakeRouter()
  const { access } = buildAccess({ router })
  const envelope = await access.handlers.agent_session_send.send(VALID_ARGS, { callerAgentId: CALLER, sourceTurnExecutionId: PROOF })
  assert.deepEqual(envelope, { ok: true, result: { status: 'accepted' } })
  assert.equal(router.deliveries.length, 1)
  const { req, controlOpts } = router.deliveries[0]
  assert.equal(req.agentId, TARGET)
  assert.equal(req.sessionMode, 'main')
  assert.equal(req.message, 'hello there')
  assert.match(req.requestId, /^req-\d+$/, 'requestId is fresh and runtime-owned')
  assert.deepEqual(controlOpts.messageOrigin, { kind: 'inter_agent', sourceAgentId: CALLER, correlation: PROOF })
  assert.equal(Object.isFrozen(controlOpts.messageOrigin), true, 'the sidecar is detached/frozen')
})

// ------------------------------------------------------- R7 + R12 receipt

test('R12: authoritative argument validation denial writes one L0 row and zero deliveries', async () => {
  const router = fakeRouter()
  const { access, file } = buildAccess({ router })
  const envelope = await access.handlers.agent_session_send.send(
    { ...VALID_ARGS, sessionId: 'forged' },
    { callerAgentId: CALLER, sourceTurnExecutionId: PROOF },
  )
  assert.equal(envelope.error.code, 'invalid_arguments')
  assert.equal(router.deliveries.length, 0)
  const rows = auditRows(file)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].phase, 'denial')
  assert.equal(rows[0].sourceAgentId, CALLER)
  assert.equal(rows[0].code, 'invalid_arguments')
})

test('R12: intent row precedes delivery; outcome row follows the receipt', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'asm-order-')), 'audit.jsonl')
  const clock = fakeClock()
  const surface = createAgentSessionMessagingAudit({ auditFile: file, now: clock.now })
  const intentsAtDelivery = []
  const router = fakeRouter({
    deliverImpl: async (req) => {
      // What the Router can already see when delivery runs = the durable proof.
      intentsAtDelivery.push(auditRows(file).filter((row) => row.phase === 'intent' && row.requestId === req.requestId).length)
      return { accepted: true, sessionId: 'main', messageId: 'm1', reconciliationHandle: 'turn:x1' }
    },
  })
  const access = createAgentSessionMessagingAccess({
    router, audit: surface, now: clock.now, timer: clock.timer,
    generateRequestId: (() => { let n = 0; return () => `req-${++n}` })(),
  })
  await access.handlers.agent_session_send.send(VALID_ARGS, { callerAgentId: CALLER, sourceTurnExecutionId: PROOF })
  assert.deepEqual(intentsAtDelivery, [1], 'the intent row is durable BEFORE Router delivery')
  const rows = auditRows(file)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].phase, 'intent')
  assert.equal(rows[1].phase, 'outcome')
  assert.equal(rows[1].result, 'accepted')
  assert.equal(rows[1].timeoutMode, 'receipt_only')
  assert.ok(rows[1].durationMs !== undefined)
})

test('R12: an intent append failure returns internal_error with ZERO Router deliveries', async () => {
  const router = fakeRouter()
  const failures = []
  const { access } = buildAccess({
    router,
    audit: {
      appendIntent: () => 'append_failed',
      appendOutcome: () => 'appended',
      appendDenial: () => 'appended',
    },
    onAuditFailure: (info) => failures.push(info),
  })
  const envelope = await access.handlers.agent_session_send.send(
    { targetAgentId: TARGET, message: 'x', timeoutSeconds: 0 },
    { callerAgentId: CALLER, sourceTurnExecutionId: PROOF },
  )
  assert.equal(envelope.error.code, 'internal_error')
  assert.equal(router.deliveries.length, 0, 'zero deliveries when the intent append fails')
  assert.deepEqual(failures, [{ phase: 'intent', requestId: 'req-1' }])
})

test('R12: an outcome append failure after the receipt preserves the proven accepted result', async () => {
  const router = fakeRouter()
  const failures = []
  const { access } = buildAccess({
    router,
    audit: {
      appendIntent: () => 'appended',
      appendOutcome: () => 'append_failed',
      appendDenial: () => 'appended',
    },
    onAuditFailure: (info) => failures.push(info),
  })
  const envelope = await access.handlers.agent_session_send.send(VALID_ARGS, { callerAgentId: CALLER, sourceTurnExecutionId: PROOF })
  assert.deepEqual(envelope, { ok: true, result: { status: 'accepted' } }, 'the proven business result stands')
  assert.deepEqual(failures, [{ phase: 'outcome', requestId: 'req-1' }])
})

// ------------------------------------------------------------- R8 waiting

test('R8: the exact Run completing in time returns exactly one replied with the full text', async () => {
  const router = fakeRouter({ states: { 'turn:1': { state: 'pending' } } })
  const clock = fakeClock()
  const { access, file } = buildAccess({ router, clock })
  const promise = access.handlers.agent_session_send.send(
    { targetAgentId: TARGET, message: 'x', timeoutSeconds: 5 },
    { callerAgentId: CALLER, sourceTurnExecutionId: PROOF },
  )
  await Promise.resolve(); await Promise.resolve()
  // The Run settles at t=2000, inside the receipt-anchored 5s deadline.
  clock.advance(2000)
  router.setState('turn:1', { state: 'available', text: 'final answer', truncated: false, originalBytes: 12, terminalState: 'completed' })
  router.emitReconciled('turn:1')
  const envelope = await promise
  assert.deepEqual(envelope, { ok: true, result: { status: 'replied', reply: 'final answer' } })
  const rows = auditRows(file)
  assert.equal(rows.at(-1).result, 'replied')
  assert.equal(rows.at(-1).timeoutMode, 'wait_reply')
})

test('R8: reply-wait timeout returns {status:timeout} and never cancels or replays', async () => {
  const router = fakeRouter({ states: { 'turn:1': { state: 'pending' } } })
  const clock = fakeClock()
  const { access, file } = buildAccess({ router, clock })
  const promise = access.handlers.agent_session_send.send(
    { targetAgentId: TARGET, message: 'x', timeoutSeconds: 5 },
    { callerAgentId: CALLER, sourceTurnExecutionId: PROOF },
  )
  await Promise.resolve(); await Promise.resolve()
  clock.advance(5001)
  clock.timer.fireDue()
  const envelope = await promise
  assert.deepEqual(envelope, { ok: true, result: { status: 'timeout' } })
  assert.equal(router.deliveries.length, 1, 'no replay after timeout')
  assert.equal(auditRows(file).at(-1).result, 'timeout')
})

test('R8: the reply deadline starts AT the receipt (pre-receipt queue time excluded)', async () => {
  // The fake deliver burns 4000ms of wall clock (bounded-queue wait) BEFORE
  // the receipt resolves; the 3s reply deadline must start only afterwards.
  const router = fakeRouter({
    deliverImpl: async () => ({ accepted: true, sessionId: 'main', messageId: 'm1', reconciliationHandle: 'turn:slow' }),
    states: { 'turn:slow': { state: 'pending' } },
  })
  const clock = fakeClock()
  const { access } = buildAccess({ router, clock })
  const promise = access.handlers.agent_session_send.send(
    { targetAgentId: TARGET, message: 'x', timeoutSeconds: 3 },
    { callerAgentId: CALLER, sourceTurnExecutionId: PROOF },
  )
  await Promise.resolve(); await Promise.resolve()
  // deliver (queue wait) consumes 4000ms BEFORE resolving the receipt...
  clock.advance(4000)
  // ...so firing timers at receipt+2999 must NOT time out yet.
  clock.advance(2999)
  clock.timer.fireDue()
  await Promise.resolve(); await Promise.resolve()
  router.setState('turn:slow', { state: 'available', text: 'in time', truncated: false, originalBytes: 7, terminalState: 'completed' })
  router.emitReconciled('turn:slow')
  const envelope = await promise
  assert.deepEqual(envelope, { ok: true, result: { status: 'replied', reply: 'in time' } },
    '4000ms of pre-receipt queue time did not consume the 3s reply deadline')
})

test('R8: failed / no_output / truncated / outcome_unknown never become success', async () => {
  const cases = [
    [{ state: 'available', text: 'partial', truncated: true, originalBytes: 7, terminalState: 'completed' }, 'reply_unavailable'],
    [{ state: 'no_output', terminalState: 'completed' }, 'reply_unavailable'],
    [{ state: 'no_output', terminalState: 'failed' }, 'target_run_failed'],
    [{ state: 'no_output', terminalState: 'terminated_without_outcome' }, 'outcome_unknown'],
    [{ state: 'available', text: 'pre-failure text', truncated: false, originalBytes: 16, terminalState: 'late_failed' }, 'target_run_failed'],
    [{ state: 'evicted' }, 'reply_unavailable'],
    [{ state: 'restart_lost' }, 'reply_unavailable'],
  ]
  for (const [settled, expectedCode] of cases) {
    const router = fakeRouter({ states: { 'turn:1': { state: 'pending' } } })
    const clock = fakeClock()
    const { access } = buildAccess({ router, clock })
    const promise = access.handlers.agent_session_send.send(
      { targetAgentId: TARGET, message: 'x', timeoutSeconds: 2 },
      { callerAgentId: CALLER, sourceTurnExecutionId: PROOF },
    )
    await Promise.resolve(); await Promise.resolve()
    router.setState('turn:1', settled)
    router.emitReconciled('turn:1')
    const envelope = await promise
    assert.equal(envelope.ok, false, `${JSON.stringify(settled)} must not succeed`)
    assert.equal(envelope.error.code, expectedCode)
  }
})

// -------------------------------------------------------- deliver errors

test('deliver failures map to exact §5 classes and never retry', async () => {
  const cases = [
    [Object.assign(new Error('cap'), { envelope: 'not_admitted', code: 'AGENT_PROCESS_QUEUE_CAP' }), 'queue_capacity_exceeded'],
    [Object.assign(new Error('fence'), { envelope: 'not_admitted' }), 'not_admitted'],
    [Object.assign(new Error('nf'), { code: 'AGENT_NOT_FOUND' }), 'target_not_found'],
    [Object.assign(new Error('disabled'), { code: 'AGENT_DISABLED', proven: 'zero_byte' }), 'target_disabled'],
    [Object.assign(new Error('unknown'), { envelope: 'outcome_unknown' }), 'outcome_unknown'],
    [new Error('process exploded'), 'outcome_unknown'],
  ]
  for (const [error, expectedCode] of cases) {
    const router = fakeRouter({ deliverImpl: async () => { throw error } })
    const { access, file } = buildAccess({ router })
    const envelope = await access.handlers.agent_session_send.send(VALID_ARGS, { callerAgentId: CALLER, sourceTurnExecutionId: PROOF })
    assert.equal(envelope.error.code, expectedCode)
    assert.equal(router.deliveries.length, 0)
    const rows = auditRows(file)
    assert.equal(rows.at(-1).phase, 'outcome')
    assert.equal(rows.at(-1).result, 'failed', `${expectedCode}: the failed outcome is audited`)
  }
})

test('a malformed receipt after proven acceptance is internal_error, not a delivery failure', async () => {
  const router = fakeRouter({ deliverImpl: async () => ({ accepted: false }) })
  const { access } = buildAccess({ router })
  const envelope = await access.handlers.agent_session_send.send(VALID_ARGS, { callerAgentId: CALLER, sourceTurnExecutionId: PROOF })
  assert.equal(envelope.error.code, 'internal_error')
})

test('wait mode without a reconciliation handle returns honest outcome_unknown', async () => {
  const router = fakeRouter({ deliverImpl: async () => ({ accepted: true, sessionId: 'main', messageId: 'm1' }) })
  const { access } = buildAccess({ router })
  const envelope = await access.handlers.agent_session_send.send(
    { targetAgentId: TARGET, message: 'x', timeoutSeconds: 3 },
    { callerAgentId: CALLER, sourceTurnExecutionId: PROOF },
  )
  assert.equal(envelope.error.code, 'outcome_unknown')
})

test('the provider requires the full Router reconciliation seam', () => {
  assert.throws(() => createAgentSessionMessagingAccess({ router: {}, audit: createAgentSessionMessagingAudit({ auditFile: '/tmp/x.jsonl' }) }), TypeError)
  assert.throws(() => createAgentSessionMessagingAccess({ router: fakeRouter(), audit: undefined }), TypeError)
})
