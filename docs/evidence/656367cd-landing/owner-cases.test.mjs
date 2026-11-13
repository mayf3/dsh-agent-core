/** Offline synthetic fixtures; only real event/state/provider modules from frozen app copies. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, realpathSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const evidence = path.dirname(fileURLToPath(import.meta.url))
const build = JSON.parse(readFileSync(path.join(evidence, 'build-receipt.json')))
const mode = process.env.LANDING_TEST_MODE
assert.ok(['red', 'green', 'regression'].includes(mode))
const root = mode === 'red' ? build.installed : build.candidate
const processDir = path.join(root, 'packages/agent-router/src/process')
for (const name of ['event-correlation.js', 'state-machine.js', 'provider-errors.js']) {
  const target = path.join(processDir, name)
  assert.equal(realpathSync(target), target, 'test imports must never traverse Harness or production symlinks')
}
const { eventCorrelationMethods: methods } = await import(pathToFileURL(path.join(processDir, 'event-correlation.js')))
console.log(JSON.stringify({ mode, importedFrom: root, source: build.source, fullAppBooted: false, realStoreConstructors: 0 }))

function fixture(reason, unknown = true) {
  const history = { state: 'outcome_unknown', sideEffects: 'UNKNOWN', deadlineAtWallMs: 111, fence: true }
  const rows = new Map([['old-history', structuredClone(history)], ['h', { initialOutcome: unknown ? 'outcome_unknown' : null }]])
  const calls = [], resolved = [], rejected = []
  const counters = { promptWrites: 0, answerResends: 0, sideEffectReplays: 0, newAdmissions: 0, queueReleases: 0 }
  const mutate = (method, handle, value) => {
    calls.push({ method, handle, value: structuredClone(value) })
    const row = rows.get(handle)
    assert.ok(row && !row.settled, 'synthetic store rejects duplicate/unknown writes')
    if (method === 'markOutcomeUnknown') Object.assign(row, { initialOutcome: 'outcome_unknown', source: value.source })
    else Object.assign(row, value, { settled: true })
  }
  const store = {
    markOutcomeUnknown: (h, v) => mutate('markOutcomeUnknown', h, v),
    settleLate: (h, v) => mutate('settleLate', h, v),
    settleDirect: (h, v) => mutate('settleDirect', h, v),
    markFenceCleared: h => { calls.push({ method: 'markFenceCleared', handle: h }); rows.get(h).fence = false },
    updateFinalOutput: (h, value) => { rows.get(h).output = structuredClone(value) },
  }
  const owner = Object.assign({
    store, executions: new Map(), status: { main: 'busy' }, activeUnknownFences: new Map(), activeUnknownFence: null,
    agentId: 'synthetic-agent', provider: 'synthetic-provider', model: 'synthetic-model', eventSeq: 0,
    observationSeq: 0, eventLog: new Map(), scheduleUnknownRecovery: () => calls.push({ method: 'scheduleUnknownRecovery' }),
    rejectQueuedTurns: () => calls.push({ method: 'rejectQueuedTurns' }),
    sendPrompt: () => { counters.promptWrites++; throw new Error('unexpected prompt write') },
  }, methods)
  const execution = {
    handle: 'h', sessionId: 'main', receiptMessageId: 'synthetic-message', watermarkSeq: 0, lastFedSeq: 0,
    terminalEvent: null, terminalReason: null, terminalObservationSeq: null, turnStartObservationSeq: null,
    idleObservationSeq: null, currentTurnNumber: undefined, laterTurnStartSeen: false, streamGapSeen: false,
    settled: false, unknownMarked: unknown, phase: unknown ? 'outcome_unknown' : 'running',
    hardDeadlineAt: 222, receiptMessageSeen: false, replaying: false, text: '',
    appendAssistantText(text) { this.text += text }, hasOutput() { return this.text.length > 0 },
    outputSnapshot() { return { text: this.text, synthetic: true } }, finalAssistantText() { return this.text },
    receiptCorrelated() { return this.receiptMessageSeen },
    releaseQueueOwnership() { counters.queueReleases++ },
    evidenceSnapshot() { return { phase: this.phase, unknownMarked: this.unknownMarked, terminationEvidence: this.terminationEvidence } },
    terminalResolve: result => resolved.push(result), terminalReject: error => rejected.push(error),
  }
  owner.executions.set('h', execution)
  if (unknown) {
    owner.activeUnknownFences.set('h', { handle: 'h', sessionId: 'main' })
    owner.activeUnknownFence = owner.activeUnknownFences.get('h')
  }
  let seq = 0
  const feed = event => { seq++; owner.observationSeq = seq; owner.feedExecution(execution, event, seq, seq) }
  const start = () => {
    feed({ type: 'turn/start', data: { turn: 7 } })
    feed({ type: 'user/message', data: { id: 'synthetic-message' } })
    feed({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'SYNTHETIC PARTIAL' }] } } })
  }
  const terminal = () => feed({ type: 'turn/end', data: { turn: 7, reason } })
  const idle = () => { seq++; owner.status.main = 'idle'; execution.idleObservationSeq = seq; owner.trySettleExecution(execution) }
  const invariant = () => {
    assert.deepEqual(rows.get('old-history'), history, 'historical UNKNOWN and side-effect uncertainty retained')
    assert.deepEqual([counters.promptWrites, counters.answerResends, counters.sideEffectReplays, counters.newAdmissions], [0, 0, 0, 0])
  }
  return { owner, execution, rows, calls, resolved, rejected, counters, feed, start, terminal, idle, invariant }
}
const aborted = { kind: 'aborted', reason: { kind: 'disposed' } }

if (mode === 'red') {
  test('OWNER_RED aborted/disposed late terminal must NOT fabricate completed', () => {
    const f = fixture(aborted)
    f.start(); f.terminal(); f.idle()
    const actual = f.rows.get('h')
    console.log('OWNER_RED_ACTUAL ' + JSON.stringify(actual))
    assert.equal(actual.outcomeEvidence, 'exact_turn_end_success', 'confirm installed defect fingerprint')
    f.invariant()
    assert.equal(actual.lateOutcome, 'terminated_without_outcome', 'Owner expected termination-only; installed code fabricates success')
  })
}

if (mode === 'green') {
  for (const [name, reason] of [
    ['aborted/disposed', aborted], ['aborted/user', { kind: 'aborted', reason: { kind: 'user' } }],
    ['disposed-kind', { kind: 'disposed' }], ['null', null], ['missing', undefined],
    ['unrecognized', { kind: 'future-reason' }], ['completed', { kind: 'completed' }],
    ['failed', { kind: 'error', error: { code: 'QUOTA', message: 'synthetic quota failure' } }],
  ]) for (const late of [false, true]) {
    test(`OWNER_GREEN ${name} ${late ? 'late' : 'direct'}`, () => {
      const f = fixture(reason, late)
      f.start(); f.terminal()
      assert.equal(f.execution.settled, false, 'terminal without idle cannot settle')
      f.idle()
      const row = f.rows.get('h'), kind = reason?.kind
      const outcome = kind === 'completed' ? 'completed' : kind === 'error' ? 'failed' : null
      if (outcome === null) {
        assert.equal(row.initialOutcome, 'outcome_unknown')
        assert.equal(row.lateOutcome, 'terminated_without_outcome')
        assert.equal(row.outcomeEvidence, undefined)
        assert.equal(f.resolved.length, 0)
        assert.equal(f.rejected.length, 1)
        assert.equal(f.rejected[0].status, 'outcome_unknown')
        assert.equal(f.rejected[0].code, 'AGENT_PROCESS_TURN_OUTCOME_UNKNOWN')
        assert.equal(f.rejected[0].reconciliationHandle, 'h')
        assert.equal(f.rejected[0].evidence.phase, 'terminal')
        assert.deepEqual(f.calls.filter(c => ['markOutcomeUnknown', 'settleLate', 'settleDirect'].includes(c.method)).map(c => c.method), late ? ['settleLate'] : ['markOutcomeUnknown', 'settleLate'])
        assert.equal(row.finalAssistantOutput.text, 'SYNTHETIC PARTIAL')
      } else {
        assert.equal(late ? row.lateOutcome : row.outcome, late ? `late_${outcome}` : outcome)
        assert.equal(row.outcomeEvidence, outcome === 'failed' ? 'exact_turn_end_failure' : 'exact_turn_end_success')
        assert.equal(f.calls.filter(c => c.method === 'markOutcomeUnknown').length, 0)
        if (!late && outcome === 'failed') {
          assert.equal(f.rejected[0].status, 'failed')
          assert.equal(f.rejected[0].evidence.phase, 'terminal')
          assert.equal(f.rejected[0].evidence.terminationEvidence, 'exact_terminal_then_idle')
        }
        if (!late && outcome === 'completed') assert.equal(f.resolved[0].reply, 'SYNTHETIC PARTIAL')
      }
      assert.equal(row.terminationEvidence, 'exact_terminal_then_idle')
      assert.equal(f.execution.settled, true)
      assert.equal(f.owner.executions.size, 0)
      assert.equal(f.owner.activeUnknownFences.has('h'), false)
      console.log('OWNER_GREEN_ACTUAL ' + JSON.stringify({ name, late, row, waiterStatus: f.rejected[0]?.status ?? (f.resolved.length ? 'completed' : 'already_returned') }))
      f.invariant()
    })
  }
}

if (mode === 'regression') {
  test('closure exports exist in exact candidate', async () => {
    const state = await import(pathToFileURL(path.join(processDir, 'state-machine.js')))
    for (const name of ['envelopeCarrier', 'exactTurnOutcome']) assert.equal(typeof state[name], 'function')
    assert.equal(state.exactTurnOutcome(aborted), null)
    assert.equal(state.exactTurnOutcome(null), null)
  })
  test('no idle: terminal cannot settle', () => {
    const f = fixture(aborted); f.start(); f.terminal()
    assert.equal(f.execution.settled, false); f.invariant()
  })
  test('stale pre-start idle cannot settle', () => {
    const f = fixture(aborted); f.idle(); f.start(); f.terminal()
    assert.equal(f.execution.settled, false); f.invariant()
  })
  test('later same-session turn prevents terminal-idle proof', () => {
    const f = fixture(aborted); f.start(); f.terminal(); f.feed({ type: 'turn/start', data: { turn: 8 } }); f.idle()
    assert.equal(f.execution.settled, false); f.invariant()
  })
  test('replay matcher ignores other session and wrong turn/receipt', () => {
    const f = fixture(aborted)
    const events = [
      ['other', { type: 'turn/start', data: { turn: 7 } }],
      ['main', { type: 'turn/start', data: { turn: 7 } }],
      ['main', { type: 'user/message', data: { id: 'wrong' } }],
      ['main', { type: 'turn/end', data: { turn: 7, reason: aborted } }],
      ['main', { type: 'user/message', data: { id: 'synthetic-message' } }],
      ['main', { type: 'turn/end', data: { turn: 99, reason: aborted } }],
      ['other', { type: 'turn/end', data: { turn: 7, reason: aborted } }],
    ]
    events.forEach(([sessionId, event], i) => f.owner.eventLog.set(i + 1, { params: { sessionId, event }, observationSeq: i + 1 }))
    f.owner.eventSeq = events.length; f.owner.replayExecutionFromWatermark(f.execution)
    assert.equal(f.execution.terminalEvent, null); assert.equal(f.execution.settled, false); f.invariant()
  })
  test('terminal flushed after current idle still settles exact matched turn', () => {
    const f = fixture({ kind: 'completed' }); f.start(); f.idle(); f.terminal()
    assert.equal(f.rows.get('h').lateOutcome, 'late_completed'); f.invariant()
  })
  for (const variant of ['exact', 'gap', 'missing-receipt', 'multiple-executions', 'not-unknown']) {
    test(`termination-only no-terminal predicate ${variant}`, () => {
      const f = fixture(null, variant !== 'not-unknown'); f.start()
      f.owner.status.main = 'idle'; f.execution.idleObservationSeq = 9
      if (variant === 'gap') f.execution.streamGapSeen = true
      if (variant === 'missing-receipt') f.execution.receiptMessageSeen = false
      if (variant === 'multiple-executions') f.owner.executions.set('other', {})
      f.owner.trySettleExecution(f.execution, true)
      assert.equal(f.execution.settled, variant === 'exact')
      if (variant === 'exact') {
        assert.equal(f.rows.get('h').lateOutcome, 'terminated_without_outcome')
        assert.equal(f.rows.get('h').terminationEvidence, 'exact_started_then_idle')
        assert.equal(f.rows.get('h').outcomeEvidence, undefined)
      }
      f.invariant()
    })
  }
  test('settle once: duplicate/conflicting terminal cannot rewrite or replay', () => {
    const f = fixture(aborted); f.start(); f.terminal(); f.idle()
    const before = structuredClone(f.rows.get('h')), count = f.calls.length
    f.feed({ type: 'turn/end', data: { turn: 7, reason: { kind: 'completed' } } }); f.idle()
    assert.deepEqual(f.rows.get('h'), before); assert.equal(f.calls.length, count); f.invariant()
  })
  test('settling target leaves another unresolved UNKNOWN fence intact', () => {
    const f = fixture(aborted)
    f.owner.activeUnknownFences.set('old-history', { handle: 'old-history', sessionId: 'old' })
    f.start(); f.terminal(); f.idle()
    assert.equal(f.owner.activeUnknownFences.has('old-history'), true)
    assert.equal(f.owner.activeUnknownFence.handle, 'old-history'); f.invariant()
  })
}
