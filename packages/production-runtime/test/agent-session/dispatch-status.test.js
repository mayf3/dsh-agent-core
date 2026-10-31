import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { readAgentSessionDispatchStatus } from '../../src/agent-session/dispatch-status.js'
import { projectExactTurn } from '../../src/agent-session/turn-inspection.js'
import { CALLER, TRACE, WORKSPACE, auditRow, records, statusRig, writeJsonl } from './fixtures/status-rig.js'

test('ACC-008: exact input closure and UTF-8 bound reject before any read', t => {
  const fx = statusRig(t)
  for (const args of [null, {}, { ...TRACE, callerAgentId: CALLER }, { ...TRACE, sessionId: '' },
    { ...TRACE, targetAgentId: 'agt_BAD' }, { ...TRACE, messageId: '中'.repeat(700) }]) {
    assert.equal(readAgentSessionDispatchStatus({ ...fx.deps, args }).error.code, 'invalid_arguments')
    assert.deepEqual(fx.calls, [])
  }
  const length = Buffer.byteLength(JSON.stringify({ ...TRACE, messageId: '' }))
  const messageId = '中'.repeat(Math.floor((2048 - length) / 3)) + 'x'.repeat((2048 - length) % 3)
  const exact = { ...TRACE, messageId }
  assert.equal(Buffer.byteLength(JSON.stringify(exact)), 2048)
  assert.equal(readAgentSessionDispatchStatus({ ...fx.deps, args: exact }).error.code, 'not_found_or_not_owned')
  assert.equal(readAgentSessionDispatchStatus({ ...fx.deps, args: { ...exact, messageId: messageId + 'x' } }).error.code, 'invalid_arguments')
})

test('ACC-010: completed status is a closed small projection with exact native reply seq', t => {
  const fx = statusRig(t)
  const before = [readFileSync(fx.auditFile), readFileSync(fx.artifact)]
  const result = readAgentSessionDispatchStatus(fx.deps)
  assert.deepEqual(result, { ok: true, result: {
    status: 'found', ...TRACE, resolvedTurnId: 7, turnState: 'completed', startedAt: 20, endedAt: 30,
    stopReason: { kind: 'completed', abortCause: null }, reply: { state: 'available', reference: { assistantMessageSeq: 4 } },
  } })
  assert.deepEqual(Object.keys(result.result), ['status', 'targetAgentId', 'sessionId', 'messageId', 'resolvedTurnId', 'turnState', 'startedAt', 'endedAt', 'stopReason', 'reply'])
  assert.deepEqual([readFileSync(fx.auditFile), readFileSync(fx.artifact)], before)
  assert.equal(JSON.stringify(result).includes('private prompt'), false)
  assert.equal(JSON.stringify(result).includes('HIDDEN_MARKER'), false)
})

for (const [options, state, turn, start, reply] of [
  [{ started: false }, 'accepted_not_started', null, null, 'pending'],
  [{ end: false }, 'running', 7, 20, 'pending'],
  [{ text: '' }, 'completed', 7, 20, 'absent'],
]) test(`ACC-010: ${state}/${reply} is honest without fabricated times/reply`, t => {
  const out = readAgentSessionDispatchStatus(statusRig(t, { native: records(options) }).deps).result
  assert.equal(out.turnState, state)
  assert.equal(out.resolvedTurnId, turn)
  assert.equal(out.startedAt, start)
  assert.deepEqual(out.reply, { state: reply, reference: null })
  if (state !== 'completed') { assert.equal(out.endedAt, null); assert.equal(out.stopReason, null) }
})

for (const kind of ['aborted', 'blocked', 'error', 'max-tokens', 'interrupted', 'SECRET_UNKNOWN_REASON']) {
  test(`ACC-010: ${kind} cannot become successful despite visible text or Router label`, t => {
    const fx = statusRig(t, { native: records({ reason: { kind, reason: { kind: 'disposed', detail: '/secret/private' } } }) })
    const out = readAgentSessionDispatchStatus({ ...fx.deps, late_completed: true }).result
    assert.equal(out.turnState, 'failed')
    assert.deepEqual(out.stopReason, { kind: kind === 'SECRET_UNKNOWN_REASON' ? 'other' : kind, abortCause: kind === 'aborted' ? 'disposed' : null })
    assert.deepEqual(out.reply, { state: 'not_successful', reference: null })
    assert.equal(JSON.stringify(out).includes('SECRET_UNKNOWN_REASON'), false)
    assert.equal(JSON.stringify(out).includes('/secret/private'), false)
  })
}

test('ACC-010: aborted causes are typed, including unknown/missing', t => {
  for (const kind of ['user', 'parent', 'hook', 'disposed', 'legacy', 'secret-kind', undefined]) {
    const fx = statusRig(t, { native: records({ reason: { kind: 'aborted', reason: { kind } } }) })
    assert.equal(readAgentSessionDispatchStatus(fx.deps).result.stopReason.abortCause,
      kind === undefined || kind === 'secret-kind' ? 'other' : kind)
  }
})

test('ACC-010: last empty visible reply is absent, chunks/earlier text cannot substitute', t => {
  const native = records({ text: '' })
  native.splice(4, 0, { seq: 35, time: 25, type: 'assistant/chunk', data: { turn: 7, chunk: { text: 'not a complete reply' } } })
  native.splice(3, 0, { seq: 0, time: 21, type: 'assistant/message', data: { turn: 7, message: { content: [{ type: 'text', text: 'earlier' }] } } })
  assert.deepEqual(readAgentSessionDispatchStatus(statusRig(t, { native }).deps).result.reply, { state: 'absent', reference: null })
})

test('ACC-009: missing, foreign, duplicate, wrong Session and unsupported origin have identical opaque pre-Session denial', t => {
  const variants = [[], [auditRow({ sourceAgentId: 'agt_Other' })], [auditRow(), auditRow({ requestId: 'request-2' })],
    [auditRow({ sessionId: 'other' })], [auditRow({ kind: 'workflow_execution' })]]
  const denials = variants.map(rows => {
    const fx = statusRig(t, { rows })
    const out = readAgentSessionDispatchStatus(fx.deps)
    assert.equal(fx.calls.some(([, path]) => path === fx.artifact), false)
    assert.deepEqual(fx.calls.filter(([op]) => op === 'exists').map(([, path]) => path.replace(fx.root, 'ROOT')), ['ROOT/control/audit.jsonl.1', 'ROOT/control/audit.jsonl'])
    return JSON.stringify(out)
  })
  assert.equal(new Set(denials).size, 1)
  assert.equal(JSON.parse(denials[0]).error.code, 'not_found_or_not_owned')
})

test('ACC-009: ambiguous native association and malformed terminal never return a status', t => {
  const corruptions = [
    native => { native[0].id = 'other' },
    native => { native.splice(2, 0, structuredClone(native[1])) },
    native => { native[1].data.inserted.push({ id: 'competing' }) },
    native => { native[3].data.id = 'different-user' },
    native => { native[5].data.reason = {} },
    native => { native[2].time = 'bad' },
  ]
  for (const corrupt of corruptions) {
    const native = records(); corrupt(native)
    const out = readAgentSessionDispatchStatus(statusRig(t, { native }).deps)
    assert.equal(out.ok, false)
    assert.ok(['inspection_unavailable', 'trace_unresolvable'].includes(out.error.code))
  }
})

test('ACC-011: >100KiB tool transcript never enters small projection', t => {
  const native = records()
  native.splice(4, 0, { seq: 40, time: 22, type: 'tool/call', data: { turn: 7, callId: 'big', name: 'read', arguments: 'SECRET_BODY'.repeat(20_000) } },
    { seq: 41, time: 23, type: 'tool/result', data: { turn: 7, message: { content: [{ type: 'tool-result', toolCallId: 'big', isError: false, content: [{ type: 'text', text: 'BODY中'.repeat(20_000) }] }] } } })
  const out = readAgentSessionDispatchStatus(statusRig(t, { native }).deps)
  assert.equal(out.ok, true)
  assert.ok(Buffer.byteLength(JSON.stringify(out.result)) <= 4096)
  assert.equal(JSON.stringify(out).includes('BODY'), false)
  assert.equal(Object.hasOwn(out.result, 'toolCalls'), false)
})

test('ACC-011: status does not render tool properties even with adversarial getters in parsed records', async () => {
  const { projectDispatchStatus } = await import('../../src/agent-session/dispatch-status.js')
  const native = records()
  native.splice(4, 0, { seq: 40, time: 22, type: 'tool/call', data: { turn: 7,
    get arguments() { throw new Error('FULL_RENDERER_USED') }, get name() { throw new Error('FULL_RENDERER_USED') } } })
  assert.equal(projectDispatchStatus({ records: native, callerAgentId: CALLER, ...TRACE, canonicalWorkspace: WORKSPACE }).ok, true)
})

test('ACC-012: original full inspector remains byte-equivalent to pre-refactor characterization', () => {
  const native = readFileSync(new URL('./fixtures/three-turn-workflow-read.session.jsonl', import.meta.url), 'utf8').trim().split('\n').map(JSON.parse)
  const out = JSON.stringify(projectExactTurn({ records: native, callerAgentId: CALLER, ...TRACE, messageId: 'm-fixture-owned', canonicalWorkspace: WORKSPACE }))
  assert.equal(createHash('sha256').update(out).digest('hex'), '52166bb585d213b28a74dd6b1845b489df07ccee281d548e99f26c85f957cb96')
  native.find(r => r.type === 'assistant/message' && r.data?.turn === 67).data.message.content = [{ type: 'text', text: 'x'.repeat(1048576) }]
  const large = JSON.stringify(projectExactTurn({ records: native, callerAgentId: CALLER, ...TRACE, messageId: 'm-fixture-owned', canonicalWorkspace: WORKSPACE }))
  assert.equal(createHash('sha256').update(large).digest('hex'), 'f786aadeebf1a97cd41e91a7cf07fc682a7b7178675eb37b2ceddc706d450bad')
})
