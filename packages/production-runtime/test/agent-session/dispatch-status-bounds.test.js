import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, writeFileSync, truncateSync } from 'node:fs'
import { readAgentSessionDispatchStatus } from '../../src/agent-session/dispatch-status.js'
import { TRACE, auditRow, records, statusRig, writeJsonl } from './fixtures/status-rig.js'

test('ACC-011: source caps are enforced even for small status replies', t => {
  for (const source of ['audit', 'archive', 'session']) {
    const fx = statusRig(t)
    const file = source === 'session' ? fx.artifact : source === 'archive' ? `${fx.auditFile}.1` : fx.auditFile
    if (source === 'archive') writeJsonl(file, [auditRow()])
    truncateSync(file, 8 * 1024 * 1024 + 1)
    assert.equal(readAgentSessionDispatchStatus(fx.deps).error.code, 'inspection_unavailable')
    assert.equal(fx.calls.some(([op, path]) => op === 'read' && path === file), false)
    if (source !== 'session') assert.equal(fx.calls.some(([, path]) => path === fx.artifact), false)
  }
  for (const mode of ['record', 'count']) {
    const fx = statusRig(t)
    const extra = mode === 'record' ? [{ type: 'padding', text: 'x'.repeat(1048576) }]
      : Array.from({ length: 10_001 }, () => ({ type: 'padding' }))
    writeJsonl(fx.artifact, [...records(), ...extra])
    assert.equal(readAgentSessionDispatchStatus(fx.deps).error.code, 'inspection_unavailable')
  }
})

test('ACC-011: partial, malformed, changed and unavailable reads fail closed', t => {
  for (const bytes of ['{}', 'not-json\n', Buffer.from([255, 10])]) {
    const fx = statusRig(t)
    writeFileSync(fx.artifact, bytes)
    assert.equal(readAgentSessionDispatchStatus(fx.deps).error.code, 'inspection_unavailable')
  }
  const fx = statusRig(t)
  fx.deps.io.readFileSync = file => {
    const bytes = readFileSync(file)
    if (file === fx.artifact) writeFileSync(file, Buffer.concat([bytes, Buffer.from('{}\n')]))
    return bytes
  }
  assert.equal(readAgentSessionDispatchStatus(fx.deps).error.code, 'inspection_unavailable')
  assert.equal(readAgentSessionDispatchStatus({ ...fx.deps, resolveTarget() { throw new Error('/private/error') } }).error.code, 'inspection_unavailable')
})

test('ACC-009: an ownership match cannot hide corrupt later audit content', t => {
  const fx = statusRig(t)
  writeFileSync(fx.auditFile, `${JSON.stringify(auditRow())}\nnot-json\n`)
  assert.equal(readAgentSessionDispatchStatus(fx.deps).error.code, 'inspection_unavailable')
  assert.equal(fx.calls.some(([, path]) => path === fx.artifact), false)
})

test('ACC-008/011: admitted multibyte coordinate remains exact and bounded on success', t => {
  const fixed = Buffer.byteLength(JSON.stringify({ ...TRACE, messageId: '' }))
  const messageId = '中'.repeat(Math.floor((2048 - fixed) / 3)) + 'x'.repeat((2048 - fixed) % 3)
  const native = records()
  native[1].data.inserted[0].id = messageId
  native[3].data.id = messageId
  const fx = statusRig(t, { rows: [auditRow({ messageId })], native })
  const out = readAgentSessionDispatchStatus({ ...fx.deps, args: { ...TRACE, messageId } })
  assert.equal(out.ok, true)
  assert.equal(out.result.messageId, messageId)
  assert.ok(Buffer.byteLength(JSON.stringify(out.result)) <= 4096)
})

test('ACC-011: exactly 10000 records and one MiB record remain readable', t => {
  const fx = statusRig(t)
  const native = records()
  const padding = { type: 'padding', text: '' }
  padding.text = 'x'.repeat(1048576 - Buffer.byteLength(JSON.stringify(padding)))
  native.push(padding)
  while (native.length < 10000) native.push({ type: 'padding' })
  writeJsonl(fx.artifact, native)
  assert.equal(readAgentSessionDispatchStatus(fx.deps).ok, true)
})
