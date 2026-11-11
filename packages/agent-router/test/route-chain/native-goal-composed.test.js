/** Real OS child, native Loader/driver/loop, AgentProcess queue and unchanged messaging proof guard. */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { AgentProcess } from '../../src/process/agent-process.js'
import { createParentRpcHandler, BROKER_RPC_METHOD } from '../../src/parent-rpc-relay.js'
import { createAgentSessionMessagingAccess } from '../../../production-runtime/src/agent-session-messaging.js'

const nativeRoot = process.env.NGC_HARNESS_ROOT
const fixture = new URL('../helpers/native-goal-child.js', import.meta.url)
test('scripted native rounds obtain fresh parent proof after prior settlement through real child transport', { timeout: 15000 }, async t => {
  assert.ok(nativeRoot && existsSync(join(nativeRoot, 'packages/goal/goal-round-driver/lib/index.js')),
    'paired native build is required; this conformance test must not silently skip')
  const workspace = mkdtempSync(join(tmpdir(), 'ngc-composed-'))
  const diagnostics = [], deliveries = [], calls = [], publicEvents = []
  const proc = new AgentProcess({ agentId: 'agt_isolated-source', home: workspace, workspace,
    profile: 'isolated-scripted', provider: 'scripted', model: 'scripted', processGeneration: 17,
    deadlines: { initializeTimeoutMs: 5000, promptReceiptTimeoutMs: 2000, turnTimeoutMs: 5000, shutdownGraceMs: 1000 },
    log: { log: line => diagnostics.push(line), error: line => diagnostics.push(line) },
  })
  const access = createAgentSessionMessagingAccess({
    router: { async deliver(request, control) {
      deliveries.push({ request, control })
      return { accepted: true, sessionId: 'main', messageId: `peer-${deliveries.length}`, reconciliationHandle: `isolated-peer-${deliveries.length}` }
    }, readFinalAssistantOutput: () => ({ state: 'pending' }), onTurnReconciled: () => () => {} },
    audit: { appendIntent: () => 'appended', appendOutcome: () => 'appended', appendDenial: () => 'appended' },
  })
  const handler = createParentRpcHandler({ agentId: proc.agentId, getProc: () => proc, log: { log() {} },
    getBrokerGateway: () => ({ execute: async (input, context) => {
      calls.push({ context, records: [...proc.store.records.values()].map(r => ({ handle: r.handle, outcome: r.outcome })) })
      return access.handlers.agent_session_send.send(input.args, { callerAgentId: context.agentId, sourceTurnExecutionId: context.sourceTurnExecutionId })
    } }),
  })
  proc.onRpcRequest = handler
  const child = spawn(process.execPath, [fixture.pathname], { cwd: workspace,
    env: { PATH: process.env.PATH, NGC_HARNESS_ROOT: nativeRoot }, stdio: ['pipe', 'pipe', 'pipe'] })
  child.stdout.on('data', chunk => { publicEvents.push(String(chunk)) })
  proc.attachChild(child)
  t.after(async () => {
    if (!proc.exit) await proc.shutdown().catch(() => {})
    if (!proc.exit) { child.kill('SIGKILL'); await proc.exitPromise }
    rmSync(workspace, { recursive: true, force: true })
  })
  await proc.ready()
  assert.deepEqual(proc.initializeEvidence.nativeGoalContinuation, { version: 1 })
  const initial = await proc.turn('main', 'Start the isolated two-round goal')
  const deadline = Date.now() + 5000
  while ((deliveries.length < 2 || proc.turnInFlight) && Date.now() < deadline) await new Promise(r => setTimeout(r, 10))
  assert.equal(deliveries.length, 2, diagnostics.join('\n'))
  const proofs = calls.map(call => call.context.sourceTurnExecutionId)
  assert.equal(new Set(proofs).size, 2)
  assert.ok(proofs.every(proof => proof && proof !== initial.reconciliationHandle))
  for (let index = 0; index < calls.length; index++) {
    const previous = index === 0 ? initial.reconciliationHandle : proofs[index - 1]
    assert.equal(calls[index].records.find(record => record.handle === previous)?.outcome, 'completed')
  }
  for (const proof of proofs) assert.equal(proc.store.records.get(proof).outcome, 'completed')
  assert.deepEqual(deliveries.map(value => value.request.message), ['nonce-round-1', 'nonce-round-2'])
  const old = await handler(BROKER_RPC_METHOD, { args: { targetAgentId: 'agt_isolated-peer', message: 'forbidden stale', timeoutSeconds: 0 } }, { turnExecutionId: proofs[0] })
  assert.equal(old.ok, false)
  assert.equal(deliveries.length, 2, 'settled proof must not reach target delivery')
  const events = publicEvents.join('').trim().split('\n').map(line => JSON.parse(line))
  const rounds = events.filter(e => e.method === 'session.event' && e.params.event.type === 'user/message' && e.params.event.data.source?.kind === 'goal')
  assert.deepEqual(rounds.map(e => e.params.event.data.source.round), [1, 2])
  assert.equal(proc.activeUnknownFence, null)
  t.diagnostic(JSON.stringify({ kind: 'scripted_native_conformance', processGeneration: proc.processGeneration,
    initial: initial.reconciliationHandle, rounds: rounds.map((e, i) => ({ messageId: e.params.event.data.id, source: e.params.event.data.source, handle: proofs[i] })), peerDeliveries: deliveries.length }))
})


for (const stop of ['timeout', 'cancel']) test(`real child ${stop} removes native queued admission before old owner release`, { timeout: 10000 }, async t => {
  const workspace = mkdtempSync(join(tmpdir(), 'ngc-cancel-composed-'))
  const proc = new AgentProcess({ agentId: 'agt_cancel-source', home: workspace, workspace,
    profile: 'isolated-scripted', provider: 'scripted', model: 'scripted',
    deadlines: { initializeTimeoutMs: 5000, promptReceiptTimeoutMs: 2000, turnTimeoutMs: 5000, shutdownGraceMs: 1000 },
    log: { log() {}, error() {} },
  })
  proc.onRpcRequest = createParentRpcHandler({ agentId: proc.agentId, getProc: () => proc, log: { log() {} } })
  const held = [], writes = []
  let cancelled = false, sawQueued = false, holding = true, lineBuffer = ''
  const parse = proc.onStdout.bind(proc)
  proc.onStdout = chunk => {
    lineBuffer += chunk
    let end
    while ((end = lineBuffer.indexOf('\n')) >= 0) {
      const line = lineBuffer.slice(0, end); lineBuffer = lineBuffer.slice(end + 1)
      const message = JSON.parse(line)
      if (holding && ((message.method === 'session.event' && message.params.event.type === 'turn/end')
        || (message.method === 'session.status' && message.params.status === 'idle'))) held.push(line)
      else {
        if (message.method === 'rpc.cancel') {
          sawQueued = proc.turnQueueEntries.some(entry => entry.opts?.nativeGoalContinuation)
          cancelled = true
        }
        parse(line + '\n')
      }
    }
  }
  const child = spawn(process.execPath, [fixture.pathname], { cwd: workspace,
    env: { PATH: process.env.PATH, NGC_HARNESS_ROOT: nativeRoot, NGC_CANCEL_PENDING: stop }, stdio: ['pipe', 'pipe', 'pipe'] })
  const write = child.stdin.write.bind(child.stdin)
  child.stdin.write = (chunk, ...args) => { writes.push(JSON.parse(String(chunk))); return write(chunk, ...args) }
  proc.attachChild(child)
  t.after(async () => {
    if (!proc.exit) await proc.shutdown().catch(() => {})
    if (!proc.exit) { child.kill('SIGKILL'); await proc.exitPromise }
    rmSync(workspace, { recursive: true, force: true })
  })
  await proc.ready()
  const initial = proc.turn('main', 'create goal with delayed parent terminal')
  const deadline = Date.now() + 3000
  while (!cancelled && Date.now() < deadline) await new Promise(r => setTimeout(r, 10))
  assert.equal(cancelled, true, 'real child must transport its aborted signal')
  assert.equal(sawQueued, true, 'cancellation must occur behind the prior real execution')
  assert.equal(proc.turnQueueEntries.length, 0)
  holding = false
  for (const line of held) parse(line + '\n')
  await initial
  await new Promise(r => setTimeout(r, 100))
  assert.equal(writes.filter(message => message.method === 'session/prompt').length, 1,
    'old owner release must not cause even a late rejected native prompt write')
  assert.equal(proc.nativeGoalRpcControllers.size, 0)
})
