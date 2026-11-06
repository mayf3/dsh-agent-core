import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDeliveryFailureStore } from '../../packages/agent-router/src/reconciliation/delivery-failures.js'
import { createRecoveryLogMonitor } from './recovery-monitor.mjs'

const cli = fileURLToPath(new URL('./recovery-monitor.mjs', import.meta.url))
const privateText = 'PRIVATE_PROMPT_Bearer_secret_monitor_fixture'
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), '1257-monitor-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const logFile = join(root, 'runtime.err.log')
  writeFileSync(logFile, '', { mode: 0o600 })
  const notify = []
  const monitor = createRecoveryLogMonitor({ logFile, notify: entry => notify.push(entry), now: () => 123 })
  // Match the real router's default stderr logger in src/index.js.
  const failures = createDeliveryFailureStore({ log: { error: line => appendFileSync(logFile, `[router] ERROR ${line}\n`) }, now: () => 100 })
  return { root, logFile, notify, monitor, failures }
}

test('R3 monitor: injected blocked delivery immediately emits one governance notice, alert does not double count', t => {
  const f = fixture(t)
  f.failures.blocked(Object.assign(new Error(privateText), { code: 'AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED' }),
    { agentId: 'agt_monitor', reason: 'durable_store_invalid' })
  f.failures.blocked(Object.assign(new Error(privateText), { code: 'AGENT_PROCESS_TURN_FENCED' }),
    { agentId: 'agt_monitor' })
  const before = digest(readFileSync(f.logFile))
  const result = spawnSync(process.execPath, [cli, 'monitor', '--log', f.logFile, '--once'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const rows = result.stdout.trim().split('\n').map(line => JSON.parse(line))
  const notices = rows.filter(row => row.kind === 'recovery_governance_notice')
  assert.equal(notices.length, 2)
  assert.equal(notices[0].code, 'AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED')
  assert.deepEqual(notices[0].counts, { recoveryStartupBlocked: 1, outcomeUnknownFence: 0 })
  assert.deepEqual(notices[1].counts, { recoveryStartupBlocked: 1, outcomeUnknownFence: 1 })
  assert.equal(rows.at(-1).kind, 'recovery_monitor_summary')
  assert.equal(rows.at(-1).countScope, 'observed_blocked_delivery_events')
  assert.equal(digest(readFileSync(f.logFile)), before)
  assert.ok(!result.stdout.includes(privateText))
  assert.ok(!result.stdout.includes('agt_monitor'), 'notification uses bounded category metadata only')
})

test('R3 monitor: repeated polling is non-consuming over input and counts each complete line once', t => {
  const f = fixture(t)
  f.monitor.poll()
  f.failures.blocked({ code: 'AGENT_PROCESS_TURN_FENCED' }, { agentId: 'agt_monitor' })
  f.monitor.poll()
  f.monitor.poll()
  assert.equal(f.notify.length, 1)
  assert.deepEqual(f.monitor.snapshot().counts, { recoveryStartupBlocked: 0, outcomeUnknownFence: 1 })
})

test('R3 monitor: partial line waits for newline; rotation never joins two different log generations', t => {
  const f = fixture(t)
  const line = 'delivery-failure {"kind":"delivery_failure","category":"other","sequence":1,"tsWallMs":100,'
    + '"code":"AGENT_PROCESS_TURN_FENCED","reason":"unresolved_turn_fence"}\n'
  writeFileSync(f.logFile, line.slice(0, -1))
  f.monitor.poll()
  assert.equal(f.notify.length, 0)
  appendFileSync(f.logFile, '\n')
  f.monitor.poll()
  assert.equal(f.notify.length, 1)
  appendFileSync(f.logFile, line.slice(0, 60))
  f.monitor.poll()
  renameSync(f.logFile, join(f.root, 'runtime.err.log.1'))
  writeFileSync(f.logFile, line)
  f.monitor.poll()
  assert.equal(f.notify.length, 2)
  assert.equal(f.monitor.snapshot().generation, 2)
})

test('R3 monitor: truncation resets the local cursor and preserves observed counts', t => {
  const f = fixture(t)
  f.failures.blocked({ code: 'AGENT_PROCESS_TURN_FENCED' })
  f.monitor.poll()
  writeFileSync(f.logFile, '')
  f.monitor.poll()
  f.failures.blocked({ code: 'AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED' })
  f.monitor.poll()
  assert.equal(f.notify.length, 2)
  assert.deepEqual(f.monitor.snapshot().counts, { recoveryStartupBlocked: 1, outcomeUnknownFence: 1 })
})

test('R3 monitor: arbitrary text and transport failures never become recovery notices', t => {
  const f = fixture(t)
  appendFileSync(f.logFile, 'a user discussed RECOVERY_STARTUP_BLOCKED and outcome_unknown fence\n')
  appendFileSync(f.logFile, '{"message":"RECOVERY_STARTUP_BLOCKED outcome_unknown fence"}\n')
  f.failures.failure({ transportFailure: 'connection_failure' }, { agentId: 'agt_monitor' })
  appendFileSync(f.logFile, 'delivery-failure {"kind":"chat","code":"RECOVERY_STARTUP_BLOCKED"}\n')
  f.monitor.poll()
  assert.deepEqual(f.notify, [])
})

test('R3 monitor: truncate and rewrite beyond the old offset is detected by bounded cursor readback', t => {
  const f = fixture(t)
  f.failures.blocked({ code: 'AGENT_PROCESS_TURN_FENCED' })
  f.monitor.poll()
  writeFileSync(f.logFile, 'unrelated diagnostic\n'.repeat(50))
  f.failures.blocked({ code: 'AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED' })
  f.monitor.poll()
  assert.equal(f.notify.length, 2)
  assert.deepEqual(f.monitor.snapshot().counts, { recoveryStartupBlocked: 1, outcomeUnknownFence: 1 })
  assert.equal(f.monitor.snapshot().generation, 2)
})

test('R3 monitor: memory is bounded for oversized lines and initial tail reports skipped bytes', t => {
  const f = fixture(t)
  writeFileSync(f.logFile, 'x'.repeat(1_100_000))
  const result = f.monitor.poll()
  assert.ok(result.skippedInitialBytes > 0)
  assert.equal(result.partialBytes, 0)
  appendFileSync(f.logFile, '\n')
  f.failures.blocked({ code: 'AGENT_PROCESS_TURN_FENCED' })
  f.monitor.poll()
  assert.equal(f.notify.length, 1)
  appendFileSync(f.logFile, 'y'.repeat(70_000))
  f.monitor.poll()
  assert.equal(f.monitor.snapshot().partialBytes, 0)
  assert.equal(f.monitor.snapshot().oversizedLines, 1)
})

test('R3 monitor: read failure and symlink refuse without exposing input bytes or creating files', t => {
  const f = fixture(t)
  const missing = join(f.root, 'does-not-exist')
  const result = spawnSync(process.execPath, [cli, 'monitor', '--log', missing, '--once'], { encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'recovery-monitor: MONITOR_LOG_UNAVAILABLE\n')
  const link = join(f.root, 'log-link')
  symlinkSync(f.logFile, link)
  const monitor = createRecoveryLogMonitor({ logFile: link, notify: () => assert.fail('cannot notify') })
  assert.throws(() => monitor.poll(), { code: 'MONITOR_LOG_UNAVAILABLE' })
})
