import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { performance } from 'node:perf_hooks'

import {
  INSPECTION_AUDIT_MAX_BYTES,
  INSPECTION_RECORD_MAX_BYTES,
  INSPECTION_RESPONSE_MAX_BYTES,
  INSPECTION_SESSION_MAX_BYTES,
  INSPECTION_SESSION_MAX_RECORDS,
  encodeSessionSegment,
  inspectAgentSessionTurn,
  locateSessionArtifact,
  projectExactTurn,
  redactInspectionText,
  scanAuditEligibility,
  sessionProjectKey,
  validateInspectArgs,
} from '../../src/agent-session/turn-inspection.js'
import { createAgentSessionMessagingAudit } from '../../src/agent-session/audit.js'

const SOURCE = 'agt_Source_A'
const FOREIGN = 'agt_Other_A'
const TARGET = 'agt_target-agent'
const SESSION = 'main'
const MESSAGE = 'm-owned'
const WORKSPACE = '/srv/workspaces/target'
const CHARACTERIZATION_FIXTURE = new URL('./fixtures/three-turn-workflow-read.session.jsonl', import.meta.url)
const CHARACTERIZATION_FIXTURE_SHA = new URL('./fixtures/three-turn-workflow-read.session.sha256', import.meta.url)

function auditRow(overrides = {}) {
  return {
    kind: 'agent_session_send', phase: 'outcome', sourceAgentId: SOURCE,
    targetAgentId: TARGET, requestId: 'req-1', result: 'accepted',
    sessionId: SESSION, messageId: MESSAGE, ts: 10,
    ...overrides,
  }
}

function sessionRecords({ message = MESSAGE, source = SOURCE, turn = 7, end = true } = {}) {
  return [
    { type: 'session', version: 1, id: SESSION, createdAt: 1, cwd: WORKSPACE, delegationDepth: 0 },
    { seq: 1, time: 10, type: 'assistant/message', data: { turn: 6, message: { content: [{ type: 'text', text: 'previous secret' }] } } },
    { seq: 2, time: 20, type: 'agent/inbox/spliced', data: { inserted: [{ id: message, role: 'user', source: { kind: 'inter_agent', sourceAgentId: source, correlation: 'source-turn' }, content: [{ type: 'text', text: 'prompt' }] }] } },
    { seq: 3, time: 21, type: 'turn/start', data: { turn } },
    { seq: 4, time: 22, type: 'user/message', data: { id: message, role: 'user', source: { kind: 'inter_agent', sourceAgentId: source, correlation: 'source-turn' }, content: [{ type: 'text', text: 'prompt' }] } },
    { type: 'text-chunks', data: { turn, step: 0, index: 0, dt: [1], texts: ['packed hidden chunk'] } },
    { seq: 5, time: 23, type: 'assistant/message', data: { turn, usage: { secret: true }, message: { source: { replayState: 'secret' }, content: [{ type: 'reasoning', text: 'hidden' }, { type: 'text', text: 'checking ' }, { type: 'tool-call', id: 'ignored' }] } } },
    { seq: 6, time: 24, type: 'tool/call', data: { turn, callId: 'call-1', name: 'workflow_read', arguments: '{"z":1,"a":{"y":2,"x":1},"access_token":"secret-value"}' } },
    { seq: 7, time: 25, type: 'tool/result', data: { turn, message: { source: { kind: 'tool', callId: 'call-1' }, content: [{ type: 'tool-result', toolCallId: 'call-1', isError: false, content: [{ type: 'text', text: 'read ok' }] }] } } },
    { seq: 8, time: 26, type: 'assistant/chunk', data: { turn, chunk: { text: 'hidden chunk' } } },
    { seq: 9, time: 27, type: 'assistant/message', data: { turn, message: { content: [{ type: 'text', text: 'done' }] } } },
    ...(end ? [{ seq: 10, time: 28, type: 'turn/end', data: { turn, reason: { kind: 'completed', raw: 'hidden' } } }] : []),
    ...(end ? [{ seq: 11, time: 29, type: 'assistant/message', data: { turn, message: { content: [{ type: 'text', text: 'post-end secret' }] } } }] : []),
    { seq: 12, time: 30, type: 'assistant/message', data: { turn: turn + 1, message: { content: [{ type: 'text', text: 'next secret' }] } } },
  ]
}

function writeJsonl(path, records) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`)
}

function paddingLine(totalBytes) {
  const prefix = '{"type":"padding","pad":"'
  const suffix = '"}\n'
  assert.ok(totalBytes >= Buffer.byteLength(prefix + suffix))
  const line = `${prefix}${'x'.repeat(totalBytes - Buffer.byteLength(prefix + suffix))}${suffix}`
  assert.equal(Buffer.byteLength(line), totalBytes)
  return line
}

function rig(t, { rows = [auditRow()], records = sessionRecords(), caller = SOURCE } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'turn-inspect-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const auditFile = join(root, 'control', 'agent-session-messaging-audit.jsonl')
  writeJsonl(auditFile, rows)
  const home = join(root, 'homes', TARGET)
  const artifact = locateSessionArtifact({ dshHome: home, canonicalWorkspace: WORKSPACE, sessionId: SESSION })
  writeJsonl(artifact, records)
  const counters = { reads: [], stats: [], exists: [] }
  const io = {
    existsSync(path) { counters.exists.push(path); return existsSync(path) },
    statSync(path) { counters.stats.push(path); return statSync(path) },
    readFileSync(path) { counters.reads.push(path); return readFileSync(path) },
  }
  const inspect = (args = { targetAgentId: TARGET, sessionId: SESSION, messageId: MESSAGE }) => inspectAgentSessionTurn({
    args, callerAgentId: caller, auditFile,
    resolveTarget: (id) => ({ id }),
    resolveDshHome: () => home,
    resolveCanonicalWorkspace: () => WORKSPACE,
    io,
  })
  return { inspect, counters, auditFile, artifact, root }
}

test('exact argument closure and DSH path encoding reject path interpretation', () => {
  assert.equal(validateInspectArgs({ targetAgentId: TARGET, sessionId: SESSION, messageId: MESSAGE }).ok, true)
  for (const args of [null, {}, { targetAgentId: 'agt_BAD', sessionId: SESSION, messageId: MESSAGE },
    { targetAgentId: TARGET, sessionId: '', messageId: MESSAGE },
    { targetAgentId: TARGET, sessionId: SESSION, messageId: MESSAGE, callerAgentId: SOURCE }]) {
    assert.equal(validateInspectArgs(args).ok, false)
  }
  assert.equal(encodeSessionSegment('../x'), '..~002Fx')
  assert.equal(encodeSessionSegment('..'), '~002E~002E')
  assert.equal(sessionProjectKey('/Users/a:b'), '--Users-a-b--')
  assert.match(locateSessionArtifact({ dshHome: '/safe/home', canonicalWorkspace: '/workspace', sessionId: '../../x' }), /^\/safe\/home\/sessions\//)
})

test('audit eligibility scans .1 then live to EOF, groups one request, and makes negatives identical', () => {
  const files = new Map([
    ['/audit.1', `${JSON.stringify(auditRow())}\n${JSON.stringify(auditRow({ result: 'replied' }))}\n`],
    ['/audit', `${JSON.stringify(auditRow({ targetAgentId: 'agt_other-agent' }))}\n`],
  ])
  function run(callerAgentId, messageId) {
    const trace = []
    const io = {
      existsSync(path) { trace.push(['exists', path]); return files.has(path) },
      statSync(path) { trace.push(['stat', path]); return { size: Buffer.byteLength(files.get(path)) } },
      readFileSync(path) { trace.push(['read', path]); return Buffer.from(files.get(path)) },
    }
    return { result: scanAuditEligibility({ auditFile: '/audit', callerAgentId, targetAgentId: TARGET, sessionId: SESSION, messageId, io }), trace }
  }
  assert.equal(run(SOURCE, MESSAGE).result.status, 'eligible', 'repeated rows for the same request are one dispatch')
  const missing = run(SOURCE, 'missing')
  const foreign = run(FOREIGN, MESSAGE)
  assert.equal(missing.result.status, 'not_found_or_not_owned')
  assert.equal(foreign.result.status, 'not_found_or_not_owned')
  assert.deepEqual(missing.trace, foreign.trace, 'same bounded stages and no early exit')
})

test('audit append preflights the serialized row and keeps live bytes at or below N', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'asm-audit-cap-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const probeFile = join(root, 'probe.jsonl')
  const probe = createAgentSessionMessagingAudit({ auditFile: probeFile, now: () => 10, maxBytes: 4096 })
  assert.equal(probe.appendDenial({ capabilityId: 'x', agentId: 'agt_a', code: 'denied' }), 'appended')
  const rowBytes = statSync(probeFile).size

  const exactFile = join(root, 'exact.jsonl')
  writeFileSync(exactFile, Buffer.alloc(rowBytes, 0x20))
  const exact = createAgentSessionMessagingAudit({ auditFile: exactFile, now: () => 10, maxBytes: rowBytes * 2 })
  assert.equal(exact.appendDenial({ capabilityId: 'x', agentId: 'agt_a', code: 'denied' }), 'appended')
  assert.equal(statSync(exactFile).size, rowBytes * 2, 'N bytes stays live without rotation')

  const rotateFile = join(root, 'rotate.jsonl')
  writeFileSync(rotateFile, Buffer.alloc(rowBytes + 1, 0x20))
  const rotate = createAgentSessionMessagingAudit({ auditFile: rotateFile, now: () => 10, maxBytes: rowBytes * 2 })
  assert.equal(rotate.appendDenial({ capabilityId: 'x', agentId: 'agt_a', code: 'denied' }), 'appended')
  assert.equal(statSync(rotateFile).size, rowBytes, 'N+1 preimage rotates before append')
  assert.equal(statSync(`${rotateFile}.1`).size, rowBytes + 1)

  const tinyFile = join(root, 'tiny.jsonl')
  const tiny = createAgentSessionMessagingAudit({ auditFile: tinyFile, now: () => 10, maxBytes: rowBytes - 1 })
  assert.equal(tiny.appendDenial({ capabilityId: 'x', agentId: 'agt_a', code: 'denied' }), 'append_failed')
  assert.equal(existsSync(tinyFile), false, 'one over-cap row writes zero bytes')
})

test('audit generations enforce the exact byte cap and ambiguous dispatch ownership fails closed', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'turn-audit-bound-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const auditFile = join(root, 'audit.jsonl')
  const base = auditRow()
  const withoutPad = JSON.stringify({ ...base, pad: '' })
  const padBytes = INSPECTION_AUDIT_MAX_BYTES - Buffer.byteLength(withoutPad) - 1
  writeFileSync(auditFile, `${JSON.stringify({ ...base, pad: 'x'.repeat(padBytes) })}\n`)
  assert.equal(statSync(auditFile).size, INSPECTION_AUDIT_MAX_BYTES)
  assert.equal(scanAuditEligibility({
    auditFile, callerAgentId: SOURCE, targetAgentId: TARGET, sessionId: SESSION, messageId: MESSAGE,
  }).status, 'eligible', 'exactly 8 MiB remains readable')

  writeFileSync(auditFile, Buffer.alloc(INSPECTION_AUDIT_MAX_BYTES + 1, 0x20))
  assert.equal(scanAuditEligibility({
    auditFile, callerAgentId: SOURCE, targetAgentId: TARGET, sessionId: SESSION, messageId: MESSAGE,
  }).status, 'unavailable', '8 MiB + 1 fails before parsing')

  writeJsonl(auditFile, [auditRow(), auditRow({ requestId: 'req-2' })])
  assert.equal(scanAuditEligibility({
    auditFile, callerAgentId: SOURCE, targetAgentId: TARGET, sessionId: SESSION, messageId: MESSAGE,
  }).status, 'not_found_or_not_owned', 'two native dispatches claiming one coordinate never authorize')
})

test('exact turn projection has frozen schema/order and excludes adjacent/reasoning/replay/usage/chunks', () => {
  const projected = projectExactTurn({ records: sessionRecords(), callerAgentId: SOURCE, targetAgentId: TARGET, sessionId: SESSION, messageId: MESSAGE, canonicalWorkspace: WORKSPACE })
  assert.equal(projected.ok, true)
  const out = projected.result
  assert.deepEqual(Object.keys(out), ['status', 'targetAgentId', 'sessionId', 'messageId', 'resolvedTurnId', 'turnState', 'startedAt', 'endedAt', 'stopReason', 'messages', 'toolCalls', 'toolResults', 'finalResponse', 'truncated', 'originalBytes', 'omittedRecords'])
  assert.deepEqual(out.messages, [
    { seq: 4, role: 'user', messageId: MESSAGE, text: 'prompt' },
    { seq: 5, role: 'assistant', messageId: null, text: 'checking ' },
    { seq: 9, role: 'assistant', messageId: null, text: 'done' },
  ])
  assert.deepEqual(out.toolCalls, [{ seq: 6, callId: 'call-1', name: 'workflow_read', argumentsJson: '{"a":{"x":1,"y":2},"access_token":"[REDACTED]","z":1}' }])
  assert.deepEqual(out.toolResults, [{ seq: 7, callId: 'call-1', text: 'read ok', isError: false }])
  assert.equal(out.finalResponse, 'done')
  assert.equal(out.turnState, 'completed')
  assert.equal(out.resolvedTurnId, 7)
  const raw = JSON.stringify(out)
  for (const forbidden of ['previous secret', 'post-end secret', 'next secret', 'hidden', 'replayState', 'usage']) assert.ok(!raw.includes(forbidden))
  const measurement = { ...out, originalBytes: 0 }
  assert.equal(out.originalBytes, Buffer.byteLength(JSON.stringify(measurement)))
})

test('accepted-not-started, running, failed, ambiguous and foreign durable provenance are honest', () => {
  const header = sessionRecords()[0]
  const splice = sessionRecords()[2]
  const prestart = projectExactTurn({ records: [header, splice], callerAgentId: SOURCE, targetAgentId: TARGET, sessionId: SESSION, messageId: MESSAGE, canonicalWorkspace: WORKSPACE })
  assert.equal(prestart.result.turnState, 'accepted_not_started')
  assert.equal(prestart.result.resolvedTurnId, null)
  const running = projectExactTurn({ records: sessionRecords({ end: false }), callerAgentId: SOURCE, targetAgentId: TARGET, sessionId: SESSION, messageId: MESSAGE, canonicalWorkspace: WORKSPACE })
  assert.equal(running.result.turnState, 'running')
  const failedRecords = sessionRecords()
  failedRecords.find((r) => r.type === 'turn/end').data.reason.kind = 'error'
  const failed = projectExactTurn({ records: failedRecords, callerAgentId: SOURCE, targetAgentId: TARGET, sessionId: SESSION, messageId: MESSAGE, canonicalWorkspace: WORKSPACE })
  assert.equal(failed.result.turnState, 'failed')
  const duplicate = [...sessionRecords(), sessionRecords()[2]]
  assert.equal(projectExactTurn({ records: duplicate, callerAgentId: SOURCE, targetAgentId: TARGET, sessionId: SESSION, messageId: MESSAGE, canonicalWorkspace: WORKSPACE }).error.code, 'trace_unresolvable')
  const competingAnchor = sessionRecords()
  competingAnchor[2].data.inserted.push({ id: 'm-competing', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'other' }] })
  assert.equal(projectExactTurn({ records: competingAnchor, callerAgentId: SOURCE, targetAgentId: TARGET, sessionId: SESSION, messageId: MESSAGE, canonicalWorkspace: WORKSPACE }).error.code, 'trace_unresolvable')
  assert.equal(projectExactTurn({ records: sessionRecords({ source: FOREIGN }), callerAgentId: SOURCE, targetAgentId: TARGET, sessionId: SESSION, messageId: MESSAGE, canonicalWorkspace: WORKSPACE }).error.code, 'not_found_or_not_owned')
})

test('messages, tool arguments/results and final response redact filesystem paths and environment', () => {
  assert.equal(redactInspectionText('HOME=/Users/alice secret at /tmp/key.txt or ../key via $HOME'), 'HOME=[REDACTED] secret at [REDACTED] or [REDACTED] via [REDACTED]')
  const records = sessionRecords()
  records.find((record) => record.type === 'user/message').data.content = [{ type: 'text', text: 'read /Users/alice/input.txt with HOME=/Users/alice' }]
  records.find((record) => record.seq === 6).data.arguments = JSON.stringify({ cwd: '/Users/alice/work', nested: { env: { TOKEN: 'not-visible' }, note: '/tmp/input' }, query: 'safe' })
  const resultEvent = records.find((record) => record.type === 'tool/result')
  resultEvent.data.message.content[0].content = [{ type: 'text', text: 'wrote /var/tmp/output and PATH=/usr/bin' }]
  records.find((record) => record.seq === 9).data.message.content = [{ type: 'text', text: 'final file /private/tmp/result.txt' }]
  const projected = projectExactTurn({ records, callerAgentId: SOURCE, targetAgentId: TARGET, sessionId: SESSION, messageId: MESSAGE, canonicalWorkspace: WORKSPACE })
  assert.equal(projected.ok, true)
  const raw = JSON.stringify(projected.result)
  for (const forbidden of ['/Users/alice', '/tmp/input', '/var/tmp', '/usr/bin', '/private/tmp', 'not-visible']) assert.ok(!raw.includes(forbidden), forbidden)
  assert.match(projected.result.toolCalls[0].argumentsJson, /"cwd":"\[REDACTED\]"/)
  assert.match(projected.result.toolCalls[0].argumentsJson, /"env":"\[REDACTED\]"/)
  assert.equal(projected.result.finalResponse, 'final file [REDACTED]')
})

test('full inspection reads both audit generations and exactly one selected artifact', (t) => {
  const { inspect, counters, artifact } = rig(t)
  const result = inspect()
  assert.equal(result.ok, true)
  assert.deepEqual(counters.reads, [counters.reads[0], artifact])
  assert.ok(counters.reads[0].endsWith('agent-session-messaging-audit.jsonl'))
  assert.equal(counters.reads.filter((path) => path === artifact).length, 1)
})

test('ACC-ASM2-007 committed fixture resolves only the middle Workflow-read turn', (t) => {
  const fixtureBytes = readFileSync(CHARACTERIZATION_FIXTURE)
  const pinnedSha = readFileSync(CHARACTERIZATION_FIXTURE_SHA, 'utf8').trim().split(/\s+/)[0]
  assert.equal(createHash('sha256').update(fixtureBytes).digest('hex'), pinnedSha)

  const root = mkdtempSync(join(tmpdir(), 'asm2-characterization-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const auditFile = join(root, 'control', 'agent-session-messaging-audit.jsonl')
  writeJsonl(auditFile, [auditRow({ messageId: 'm-fixture-owned', requestId: 'req-fixture' })])
  const canonicalWorkspace = '/fixture/workspaces/agt_target-agent'
  const home = join(root, 'homes', TARGET)
  const artifact = locateSessionArtifact({ dshHome: home, canonicalWorkspace, sessionId: SESSION })
  mkdirSync(dirname(artifact), { recursive: true })
  writeFileSync(artifact, fixtureBytes)

  const inspected = inspectAgentSessionTurn({
    args: { targetAgentId: TARGET, sessionId: SESSION, messageId: 'm-fixture-owned' },
    callerAgentId: SOURCE,
    auditFile,
    resolveTarget: (id) => ({ id }),
    resolveDshHome: () => home,
    resolveCanonicalWorkspace: () => canonicalWorkspace,
  })
  assert.equal(inspected.ok, true)
  assert.equal(inspected.result.resolvedTurnId, 67)
  assert.equal(inspected.result.turnState, 'completed')
  assert.equal(inspected.result.startedAt, 1700000000011)
  assert.equal(inspected.result.endedAt, 1700000000017)
  assert.deepEqual(inspected.result.toolCalls.map(({ seq, callId, name }) => ({ seq, callId, name })), [
    { seq: 9, callId: 'call-fixture-workflow-read', name: 'workflow_read' },
  ])
  assert.deepEqual(inspected.result.toolResults.map(({ seq, callId, isError }) => ({ seq, callId, isError })), [
    { seq: 10, callId: 'call-fixture-workflow-read', isError: false },
  ])
  assert.equal(inspected.result.finalResponse, 'The Workflow was readable; no transition was issued in this fixture.')
  const visible = JSON.stringify(inspected.result)
  assert.ok(!visible.includes('ADJACENT_PREVIOUS_MARKER'))
  assert.ok(!visible.includes('ADJACENT_NEXT_MARKER'))
})

test('missing/foreign audit coordinate performs no Session read and uses byte-identical error', (t) => {
  const missing = rig(t)
  const a = missing.inspect({ targetAgentId: TARGET, sessionId: SESSION, messageId: 'missing' })
  const foreign = rig(t, { caller: FOREIGN })
  const b = foreign.inspect()
  assert.deepEqual(a, b)
  assert.equal(missing.counters.reads.includes(missing.artifact), false)
  assert.equal(foreign.counters.reads.includes(foreign.artifact), false)
})

test('ACC-ASM2-004 negative coordinates have identical bounded work and coarse latency', (t) => {
  const unsupported = { kind: 'workflow_execution', phase: 'outcome', sourceAgentId: SOURCE,
    targetAgentId: TARGET, requestId: 'req-unsupported', result: 'accepted',
    sessionId: SESSION, messageId: 'unsupported', ts: 11 }
  const rows = Array.from({ length: 31 }, (_, index) => auditRow({
    requestId: `noise-${index}`,
    targetAgentId: 'agt_noise-agent',
    messageId: `noise-${index}`,
  })).concat(unsupported)
  const split = Math.ceil(rows.length / 2)
  const files = new Map([
    ['/audit.1', Buffer.from(`${rows.slice(0, split).map(JSON.stringify).join('\n')}\n`)],
    ['/audit', Buffer.from(`${rows.slice(split).map(JSON.stringify).join('\n')}\n`)],
  ])
  const cases = [
    ['missing', { callerAgentId: SOURCE, targetAgentId: TARGET, sessionId: SESSION, messageId: 'missing' }],
    ['foreign', { callerAgentId: FOREIGN, targetAgentId: TARGET, sessionId: SESSION, messageId: MESSAGE }],
    ['wrong_session', { callerAgentId: SOURCE, targetAgentId: TARGET, sessionId: 'other', messageId: MESSAGE }],
    ['unsupported', { callerAgentId: SOURCE, targetAgentId: TARGET, sessionId: SESSION, messageId: 'unsupported' }],
  ]
  function run(coordinate, trace) {
    const io = {
      existsSync(path) { trace?.push(['exists', path]); return files.has(path) },
      statSync(path) { trace?.push(['stat', path, files.get(path).byteLength]); return { size: files.get(path).byteLength } },
      readFileSync(path) {
        const buffer = files.get(path)
        trace?.push(['read', path, buffer.byteLength, buffer.toString('utf8').trim().split('\n').length])
        return buffer
      },
    }
    return scanAuditEligibility({ auditFile: '/audit', ...coordinate, io })
  }
  const traces = cases.map(([name, coordinate]) => {
    const trace = []
    assert.equal(run(coordinate, trace).status, 'not_found_or_not_owned', name)
    return trace
  })
  for (const trace of traces.slice(1)) assert.deepEqual(trace, traces[0])
  assert.deepEqual(traces[0].filter(([stage]) => stage === 'read').map((entry) => entry.slice(2)), [
    [files.get('/audit.1').byteLength, split],
    [files.get('/audit').byteLength, rows.length - split],
  ])

  const batch = 100
  const samples = 31
  for (let warm = 0; warm < batch; warm += 1) for (const [, coordinate] of cases) run(coordinate)
  const elapsed = new Map(cases.map(([name]) => [name, []]))
  for (let sample = 0; sample < samples; sample += 1) {
    const ordered = sample % 2 === 0 ? cases : [...cases].reverse()
    for (const [name, coordinate] of ordered) {
      const started = performance.now()
      for (let iteration = 0; iteration < batch; iteration += 1) run(coordinate)
      elapsed.get(name).push(performance.now() - started)
    }
  }
  const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)]
  const summary = Object.fromEntries(cases.map(([name]) => [name, {
    p50Ms: percentile(elapsed.get(name), 0.50),
    p95Ms: percentile(elapsed.get(name), 0.95),
  }]))
  t.diagnostic(`bounded negative-path timing ${JSON.stringify(summary)}`)
  for (const metric of ['p50Ms', 'p95Ms']) {
    const values = Object.values(summary).map((entry) => entry[metric])
    assert.ok(Math.max(...values) <= Math.max(10, Math.min(...values) * 4), `${metric} diverged beyond the coarse characterization bound`)
  }
})

test('Session resource bounds fail closed without partial results', (t) => {
  const cases = [
    { name: 'record-count', records: Array.from({ length: INSPECTION_SESSION_MAX_RECORDS + 1 }, (_, i) => ({ type: i === 0 ? 'session' : 'x', id: i === 0 ? SESSION : undefined, cwd: i === 0 ? WORKSPACE : undefined, seq: i - 1 })) },
    { name: 'one-record', records: [{ type: 'session', id: SESSION, cwd: WORKSPACE, pad: 'x'.repeat(INSPECTION_RECORD_MAX_BYTES) }] },
  ]
  for (const item of cases) {
    const fx = rig(t, { records: item.records })
    assert.equal(fx.inspect().error.code, 'inspection_unavailable', item.name)
  }
  const fx = rig(t)
  writeFileSync(fx.artifact, Buffer.alloc(INSPECTION_SESSION_MAX_BYTES + 1, 0x20))
  assert.equal(fx.inspect().error.code, 'inspection_unavailable', 'artifact byte cap +1')
})

test('exact Session record, record-count and artifact-byte boundaries remain readable', (t) => {
  const exactRecords = sessionRecords()
  while (exactRecords.length < INSPECTION_SESSION_MAX_RECORDS) {
    exactRecords.push({ seq: exactRecords.length + 100, time: 100, type: 'ignored', data: { turn: 99 } })
  }
  const recordFx = rig(t, { records: exactRecords })
  assert.equal(recordFx.inspect().ok, true, 'exactly 10,000 decoded records')

  const oneRecordFx = rig(t)
  const core = `${sessionRecords().map((record) => JSON.stringify(record)).join('\n')}\n`
  const oneRecordTotal = INSPECTION_RECORD_MAX_BYTES + 1 // record bytes plus newline
  writeFileSync(oneRecordFx.artifact, core + paddingLine(oneRecordTotal))
  assert.equal(oneRecordFx.inspect().ok, true, 'exactly 1 MiB for one record')

  const byteFx = rig(t)
  let exact = core
  let remaining = INSPECTION_SESSION_MAX_BYTES - Buffer.byteLength(exact)
  const minLine = Buffer.byteLength('{"type":"padding","pad":""}\n')
  while (remaining > 0) {
    let take = Math.min(oneRecordTotal, remaining)
    if (remaining - take > 0 && remaining - take < minLine) take -= minLine - (remaining - take)
    exact += paddingLine(take)
    remaining -= take
  }
  assert.equal(Buffer.byteLength(exact), INSPECTION_SESSION_MAX_BYTES)
  writeFileSync(byteFx.artifact, exact)
  assert.equal(byteFx.inspect().ok, true, 'exactly 8 MiB artifact')
})

test('response truncation is deterministic, whole-record and under the byte cap', () => {
  const records = sessionRecords()
  const assistant = records.find((record) => record.seq === 9)
  assistant.data.message.content = [{ type: 'text', text: 'x'.repeat(INSPECTION_RESPONSE_MAX_BYTES) }]
  const projected = projectExactTurn({ records, callerAgentId: SOURCE, targetAgentId: TARGET, sessionId: SESSION, messageId: MESSAGE, canonicalWorkspace: WORKSPACE })
  assert.equal(projected.ok, true)
  assert.equal(projected.result.truncated, true)
  assert.equal(projected.result.finalResponse, null)
  assert.ok(projected.result.omittedRecords.some((entry) => entry.kind === 'finalResponse'))
  assert.ok(Buffer.byteLength(JSON.stringify(projected.result)) <= INSPECTION_RESPONSE_MAX_BYTES)
  assert.deepEqual(
    projectExactTurn({ records, callerAgentId: SOURCE, targetAgentId: TARGET, sessionId: SESSION, messageId: MESSAGE, canonicalWorkspace: WORKSPACE }),
    projected,
  )
})
