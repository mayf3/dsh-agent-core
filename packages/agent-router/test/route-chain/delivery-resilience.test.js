import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRouteChainExecutor } from '../../src/route-chain.js'
import { makeFx } from '../helpers/fake-child.js'
import { createDeliveryFailureStore } from '../../src/reconciliation/delivery-failures.js'
import { createIngressDelivery } from '../../src/ingress-delivery.js'

const quiet = { log() {}, error() {} }
const pause = () => new Promise(resolve => setImmediate(resolve))

function rig({ failCount = 2, unsafeEvent, deadLetterDirectory, unknown = false,
  afterReceipt, shutdownFailure = false, failureCode = 'TRANSPORT', failPrepare = false } = {}) {
  const generations = []
  const waits = []
  const logs = []
  let current
  let dispatches = 0
  let promptCount = 0
  const executor = createRouteChainExecutor({
    log: { log: line => logs.push(line), error: line => logs.push(line) },
    deadLetterDirectory,
    transportRetry: { baseDelayMs: 1, maxRetries: 2, sleep: async ms => { waits.push(ms) } },
    resolveTurnDeadlineMs: () => 1000,
    ensureRunningForRoute: async () => {
      if (!current || current.proc.state === 'EXITED') {
        current = makeFx({ generation: generations.length + 1, log: quiet })
        await current.readyNow()
        current.proc.initializeEvidence.deliveryReadiness = { version: 1 }
        current.proc.initializeEvidence.websiteAdmission = { version: 1 }
        current.proc.initializeEvidence.conversationSource = { version: 1 }
        const fx = current
        if (shutdownFailure) fx.proc.shutdown = async () => { throw new Error('injected reap failure') }
        const originalWrite = fx.child.stdin.write.bind(fx.child.stdin)
        fx.child.stdin.write = (line, callback) => {
          const req = JSON.parse(line)
          const result = originalWrite(line, callback)
          queueMicrotask(() => {
            if (req.method === 'session/prepare') {
              if (failPrepare) fx.emit({ id: req.id, error: { code: 'TRANSPORT', message: 'connection refused' } })
              else fx.emit({ id: req.id, result: { version: 1, ready: true, sessionId: req.params.sessionId } })
            } else if (req.method === 'shutdown') {
              fx.emit({ id: req.id, result: {} })
              fx.childExit()
            } else if (req.method === 'session/prompt') {
              promptCount += 1
              const messageId = `message-${promptCount}`
              fx.emit({ id: req.id, result: { messageId } })
              if (afterReceipt) {
                afterReceipt(fx, messageId, promptCount)
                return
              }
              if (unknown) return
              if (promptCount > failCount) {
                fx.completeTurn('main', messageId, 'recovered')
                return
              }
              fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
              fx.emitEvent('main', { type: 'user/message', data: { id: messageId } })
              if (unsafeEvent) fx.emitEvent('main', unsafeEvent)
              fx.emitEvent('main', { type: 'turn/end', data: { turn: 1,
                reason: { kind: 'error', error: { code: failureCode, message: 'fetch failed' } } } })
              fx.emitStatus('main', 'idle')
            }
          })
          return result
        }
        generations.push(fx)
      }
      return { status: 'ready', proc: current.proc }
    },
  })
  return { executor, generations, waits, logs, promptCount: () => promptCount,
    dispatches: () => dispatches,
    admit: () => executor.admitWithRouteChain('agt_fx', { sessionId: 'main', message: 'synthetic async message', opts: {} }),
    run: (extraOpts = {}) => executor.runTurnWithRouteChain('agt_fx', { sessionId: 'main', message: 'synthetic original message',
      opts: { callerCorrelation: { requestId: 'synthetic-request' }, onDispatch: () => { dispatches += 1 }, ...extraOpts } }),
  }
}

test('CTR-R2 fresh/idle transport failure respawns twice with exponential delay, one reply/dispatch', async () => {
  const fx = rig()
  const result = await fx.run()
  assert.equal(result.reply, 'recovered')
  assert.equal(fx.generations.length, 3)
  assert.deepEqual(fx.waits, [1, 2])
  assert.equal(fx.dispatches(), 1)
  assert.equal(fx.promptCount(), 3)
  for (const generation of fx.generations.slice(0, 2)) assert.equal(generation.proc.state, 'EXITED')
  const final = fx.executor.journalSnapshot().find(row => row.kind === 'route_chain_final')
  assert.equal(final.totalRouteAttempts, 1)
  assert.equal(final.fallbackActivated, false)
  assert.equal(fx.logs.filter(line => line.startsWith('delivery-failure ')).length, 2)
})

test('CTR-R3 exhaustion durably retains original message, coordinates and explicit resend semantics', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'delivery-dead-letter-'))
  const fx = rig({ failCount: 99, deadLetterDirectory: directory })
  await assert.rejects(fx.run(), error => {
    assert.equal(error.deliveryFailure.retriesExhausted, true)
    assert.match(error.deliveryFailure.userMessage, /请重发/u)
    return true
  })
  const files = readdirSync(directory)
  assert.equal(files.length, 1)
  const record = JSON.parse(readFileSync(join(directory, files[0]), 'utf8'))
  assert.equal(record.message, 'synthetic original message')
  assert.equal(record.sessionId, 'main')
  assert.equal(record.callerCorrelation.requestId, 'synthetic-request')
  assert.equal(record.transportAttempts, 3)
  assert.equal(statSync(join(directory, files[0])).mode & 0o777, 0o600)
  assert.equal(fx.executor.getDeliveryDeadLetter(record.id).id, record.id)
  assert.equal(fx.generations.at(-1).proc.state, 'EXITED')
})

for (const unsafeEvent of [
  { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'partial' }] } } },
  { type: 'assistant/message', data: { message: { content: [{ type: 'tool-call', name: 'write' }] } } },
  { type: 'tool/start', data: {} },
  { type: 'unrecognized/provider-event', data: {} },
]) test(`CTR-R2 no replay after unsafe/unknown event ${JSON.stringify(unsafeEvent)}`, async () => {
  const fx = rig({ unsafeEvent })
  await assert.rejects(fx.run())
  assert.equal(fx.promptCount(), 1)
  assert.equal(fx.generations.length, 1)
  assert.deepEqual(fx.waits, [])
  assert.equal(fx.generations[0].proc.deliveryTransportFailed, true)
})

test('CTR-R5 final unknown increments caller-bound class without replay or respawn', async () => {
  const fx = rig({ unknown: true })
  await assert.rejects(fx.run(), error => error.envelope === 'outcome_unknown')
  assert.equal(fx.promptCount(), 1)
  assert.equal(fx.generations.length, 1)
  const snapshot = fx.executor.deliveryFailuresSnapshot()
  assert.equal(snapshot.counts.caller_bound_exceeded, 1)
  await pause()
})

function terminalFailure(fx, messageId) {
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
  fx.emitEvent('main', { type: 'user/message', data: { id: messageId } })
  fx.emitEvent('main', { type: 'turn/end', data: { turn: 1,
    reason: { kind: 'error', error: { code: 'TRANSPORT', message: 'fetch failed' } } } })
  fx.emitStatus('main', 'idle')
}

async function until(predicate) {
  const deadline = Date.now() + 1000
  while (!predicate()) {
    assert.ok(Date.now() < deadline, 'background worker did not converge')
    await pause()
  }
}

test('CTR-R2/R3 async admission returns one receipt then recovers delayed failures and persists exhaustion', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'delivery-async-dead-letter-'))
  const pending = []
  const fx = rig({ deadLetterDirectory: directory, afterReceipt: (proc, messageId) => pending.push([proc, messageId]) })
  const receipt = await fx.admit()
  assert.equal(receipt.accepted, true)
  assert.equal(fx.executor.deliveryFailuresSnapshot().counts.transport_death, 0)
  for (let i = 0; i < 3; i += 1) {
    await until(() => pending.length > i)
    terminalFailure(...pending[i])
  }
  await until(() => readdirSync(directory).length === 1)
  assert.equal(fx.generations.length, 3)
  assert.deepEqual(fx.waits, [1, 2])
  assert.equal(fx.executor.deliveryFailuresSnapshot().counts.transport_death, 3)
  assert.equal(fx.executor.journalSnapshot().filter(row => row.kind === 'route_chain_final').length, 1)
  const record = JSON.parse(readFileSync(join(directory, readdirSync(directory)[0]), 'utf8'))
  assert.equal(record.message, 'synthetic async message')
})

test('CTR-R3 failed exact generation reap still retains message and resend notice', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'delivery-reap-dead-letter-'))
  const fx = rig({ deadLetterDirectory: directory, shutdownFailure: true })
  await assert.rejects(fx.run(), error => {
    assert.equal(error.deliveryFailure.recoveryBlocked, true)
    assert.match(error.deliveryFailure.userMessage, /请重发/u)
    return true
  })
  assert.equal(readdirSync(directory).length, 1)
  assert.equal(fx.generations.length, 1)
})

test('CTR-R2 arbitrary fetch-failed text never provides replay authority', async () => {
  const fx = rig({ failureCode: 'provider_error' })
  await assert.rejects(fx.run())
  assert.equal(fx.promptCount(), 1)
})

test('CTR-R5 all four categories and threshold are recomputable from structured log events', () => {
  const logs = []
  let now = 1000
  const store = createDeliveryFailureStore({ log: { error: line => logs.push(line) },
    alertThreshold: 2, windowMs: 100, now: () => now })
  for (const error of [ { transportFailure: 'connection_failure' }, { source: 'caller_wait_exceeded' },
    { code: 'AGENT_PROCESS_CHILD_EXITED' }, { code: 'unclassified' } ]) store.failure(error, { agentId: 'agt_fx' })
  const counts = Object.fromEntries(Object.keys(store.snapshot().counts).map(category => [category, 0]))
  for (const line of logs.filter(line => line.startsWith('delivery-failure '))) {
    counts[JSON.parse(line.slice('delivery-failure '.length)).category] += 1
  }
  assert.deepEqual(counts, store.snapshot().counts)
  assert.deepEqual(Object.values(counts), [1, 1, 1, 1])
  assert.equal(store.snapshot().alerts, 2)
  now += 101
  store.failure({}, { agentId: 'agt_fx' })
  assert.equal(store.snapshot().windowCount, 1)
  assert.equal(store.snapshot().alerts, 2)
})

test('CTR-R5 real child exit after receipt counts child_exit_without_outcome and never retries', async () => {
  const fx = rig({ afterReceipt: proc => proc.childExit(1) })
  await assert.rejects(fx.run(), error => error.code === 'AGENT_PROCESS_CHILD_EXITED')
  assert.equal(fx.executor.deliveryFailuresSnapshot().counts.child_exit_without_outcome, 1)
  assert.equal(fx.generations.length, 1)
})

test('CTR-R2 parent RPC observation denies replay even without assistant/tool events', async () => {
  const fx = rig({ afterReceipt: (proc, id) => {
    proc.emit({ method: 'rpc.request', params: { requestId: 'synthetic-rpc', method: 'possible.write' } })
    terminalFailure(proc, id)
  } })
  await assert.rejects(fx.run())
  assert.equal(fx.promptCount(), 1)
  assert.equal(fx.generations[0].proc.deliveryTransportFailed, true)
})

test('accepted original-source custody forbids a second prompt and retains failed original', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'delivery-source-dead-letter-'))
  const fx = rig({ deadLetterDirectory: directory, afterReceipt: (proc, id) => terminalFailure(proc, id) })
  await assert.rejects(fx.run({ conversationSource: { requestId: 'synthetic-source' } }), error => {
    assert.equal(error.deliveryFailure.replayForbidden, true)
    assert.equal(error.deliveryFailure.retriesExhausted, false)
    return true
  })
  assert.equal(fx.promptCount(), 1)
  assert.equal(fx.generations.length, 1)
  assert.equal(readdirSync(directory).length, 1)
})

test('CTR-R1 never-serviceable preparation respawns twice and dead-letters without any prompt', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'delivery-prepare-dead-letter-'))
  const fx = rig({ deadLetterDirectory: directory, failPrepare: true })
  await assert.rejects(fx.run(), error => error.deliveryFailure.retriesExhausted === true)
  assert.equal(fx.generations.length, 3)
  assert.equal(fx.promptCount(), 0)
  assert.deepEqual(fx.waits, [1, 2])
  assert.equal(readdirSync(directory).length, 1)
})

test('CTR-R3 real ingress failure reply keeps its prefix and explicitly says 请重发', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'delivery-ingress-dead-letter-'))
  const fx = rig({ deadLetterDirectory: directory, failCount: 99 })
  let terminalError
  try { await fx.run() } catch (error) { terminalError = error }
  const replies = []
  const ingress = createIngressDelivery({ log: quiet,
    feishu: { replyTargetFor: () => ({ replyTo: id => id }), reply: async (_target, text) => replies.push(text) },
    workspaceBootstrap: {}, store: {},
    reconciliationStore: { assertMintCapacity() {}, assertBusinessAdmissionReady() {} },
    routeChain: { runTurnWithRouteChain: async () => { throw terminalError } },
    resolveChannelConversation: async () => ({ channelConversation: { id: 'synthetic-group' },
      binding: { activeAgentId: 'agt_fx', activeSessionId: 'main' } }),
    resolveEffectiveWorkspace: () => ({ workspaceId: null, workspacePath: '/tmp/synthetic-workspace' }),
  })
  const result = await ingress.onIngress({ channel: 'group', conversationId: 'synthetic-group',
    messageId: 'synthetic-message', sender: { openId: 'synthetic-user' }, text: 'synthetic message' })
  assert.equal(result.error, terminalError)
  assert.equal(replies.length, 1)
  assert.match(replies[0], /^\[agent-core\] delivery failed: .*请重发/u)
})
