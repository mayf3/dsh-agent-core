/**
 * T8 — WRITE_PATH_AMENDMENT_1 (AGENT_CORE_EXECUTION_HISTORY_QUERY_V1 §6):
 * archive-on-rotate for the ASM L1 audit surface. Semantics under test:
 *   - archive-before-rename (no loss window),
 *   - checkpoint reset at rename (no stale-offset slicing),
 *   - archive failure keeps rotation running + reports via onArchiveFailure,
 *   - findInvocation (reconcile) reads exactly live + .1 — unchanged.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { createAgentSessionMessagingAudit, auditArchivePaths } from '../../src/agent-session/audit.js'

function tempAuditFile(name) {
  const dir = join(tmpdir(), `asm-archive-test-${process.pid}-${name}`)
  mkdirSync(dir, { recursive: true })
  return join(dir, 'agent-session-messaging-audit.jsonl')
}

test('rotation archives the outgoing generation before the .1 rename (no loss window)', () => {
  const auditFile = tempAuditFile('a')
  try {
    const audit = createAgentSessionMessagingAudit({ auditFile, maxBytes: 512 })
    for (let i = 0; i < 40; i += 1) {
      assert.equal(audit.appendIntent({ sourceAgentId: 'agt_x', targetAgentId: 'agt_y', requestId: `r${i}`, correlation: `t${i}`, timeoutMode: 'receipt_only' }), 'appended')
    }
    const { archiveFile } = auditArchivePaths(auditFile)
    assert.ok(existsSync(archiveFile), 'archive file exists after rotation')
    assert.ok(existsSync(`${auditFile}.1`), '.1 rotation still happens')
    const archived = readFileSync(archiveFile, 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l))
    assert.ok(archived.length >= 2, 'outgoing generation fully archived')
    assert.ok(archived.every((row) => row.kind === 'agent_session_send'))
    // The union live+.1+archive must contain every appended requestId.
    const union = new Set([
      ...archived.map((r) => r.requestId),
      ...readFileSync(`${auditFile}.1`, 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l).requestId),
      ...readFileSync(auditFile, 'utf8').trimEnd().split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l).requestId),
    ])
    for (let i = 0; i < 40; i += 1) assert.ok(union.has(`r${i}`), `requestId r${i} preserved somewhere`)
  } finally { rmSync(join(auditFile, '..'), { recursive: true, force: true }) }
})

test('checkpoint resets at rename: the new generation is never sliced by a stale offset', () => {
  const auditFile = tempAuditFile('b')
  try {
    const audit = createAgentSessionMessagingAudit({ auditFile, maxBytes: 512 })
    for (let i = 0; i < 80; i += 1) {
      audit.appendIntent({ sourceAgentId: 'agt_x', targetAgentId: 'agt_y', requestId: `rr${i}`, correlation: `t${i}`, timeoutMode: 'receipt_only' })
    }
    const { archiveFile, posFile } = auditArchivePaths(auditFile)
    assert.ok(existsSync(posFile))
    const checkpoint = JSON.parse(readFileSync(posFile, 'utf8'))
    assert.equal(checkpoint.archivedUpToBytes, 0, 'checkpoint reset to 0 for the new live generation')
    const archived = readFileSync(archiveFile, 'utf8')
    const live = readFileSync(auditFile, 'utf8')
    assert.ok(!archived.includes('rr79'), 'newest generation row not double-archived by a stale offset')
    assert.ok(live.includes('rr79'))
  } finally { rmSync(join(auditFile, '..'), { recursive: true, force: true }) }
})

test('archive failure keeps rotation running, reports once, send path unaffected', () => {
  const auditFile = tempAuditFile('c')
  try {
    // Make the archive path un-writable: create a DIRECTORY where the archive
    // file would go (openSync('a') on a directory throws on macOS/linux).
    const { archiveFile } = auditArchivePaths(auditFile)
    mkdirSync(archiveFile, { recursive: true })
    const failures = []
    const audit = createAgentSessionMessagingAudit({
      auditFile,
      maxBytes: 512,
      onArchiveFailure: (info) => failures.push(info),
    })
    for (let i = 0; i < 40; i += 1) {
      assert.equal(audit.appendIntent({ sourceAgentId: 'agt_x', targetAgentId: 'agt_y', requestId: `rf${i}`, correlation: `t${i}`, timeoutMode: 'receipt_only' }), 'appended', 'send-path append unaffected by archive failure')
    }
    assert.ok(existsSync(`${auditFile}.1`), 'rotation continued despite archive failure')
    assert.ok(failures.length >= 1, 'ASM_ARCHIVE_APPEND_FAILED reported')
    assert.equal(failures[0].reason, 'ASM_ARCHIVE_APPEND_FAILED')
  } finally { rmSync(join(auditFile, '..'), { recursive: true, force: true }) }
})

test('reconcile window unchanged: findInvocation reads exactly live + .1, never the archive', () => {
  const auditFile = tempAuditFile('d')
  try {
    const audit = createAgentSessionMessagingAudit({ auditFile, maxBytes: 512 })
    // Old archived invocation (pre-rotation) must NOT satisfy reconcile.
    const first = { sourceAgentId: 'agt_old', targetAgentId: 'agt_y', requestId: 'r-old', correlation: 't-old', timeoutMode: 'receipt_only', invocationCorrelation: 'inv-old' }
    audit.appendIntent(first)
    for (let i = 0; i < 40; i += 1) {
      audit.appendIntent({ sourceAgentId: 'agt_x', targetAgentId: 'agt_y', requestId: `rq${i}`, correlation: `t${i}`, timeoutMode: 'receipt_only', invocationCorrelation: `inv${i}` })
    }
    assert.ok(audit.findInvocation({ sourceAgentId: 'agt_old', invocationCorrelation: 'inv-old' }).intentFound === false, 'archived row outside reconcile window (live+.1 only)')
    const recent = audit.findInvocation({ sourceAgentId: 'agt_x', invocationCorrelation: 'inv39' })
    assert.equal(recent.intentFound, true, 'recent live/.1 row still reconcilable')
    assert.equal(recent.retentionIntegrity, 'clean')
  } finally { rmSync(join(auditFile, '..'), { recursive: true, force: true }) }
})
