/** Same executable test is run at the unmodified Base and candidate. No network. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRouteChainExecutor } from '../../src/route-chain.js'
import { makeFx } from '../helpers/fake-child.js'

test('#1332 fresh spawn + suspended 59243-event resume: no prompt before application readiness', async () => {
  const fx = makeFx()
  await fx.readyNow()
  fx.proc.initializeEvidence.deliveryReadiness = { version: 1 }
  let resumeComplete = false
  let prepareRequest
  let earlyPrompts = 0
  const write = fx.child.stdin.write.bind(fx.child.stdin)
  fx.child.stdin.write = (line, callback) => {
    const request = JSON.parse(line)
    // Own the preparation response so the test can hold the application
    // resume boundary; ready pid alone must not release a prompt.
    if (request.method === 'session/prepare') {
      fx.child.writes.push(request)
      prepareRequest = request
      queueMicrotask(() => callback?.(null))
      return true
    }
    const result = write(line, callback)
    if (request.method === 'session/prompt') queueMicrotask(() => {
      const id = 'synthetic-race-message'
      fx.emit({ id: request.id, result: { messageId: id } })
      if (resumeComplete) fx.completeTurn('main', id, 'one reply after resume')
      else {
        earlyPrompts += 1
        fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
        fx.emitEvent('main', { type: 'user/message', data: { id } })
        fx.emitEvent('main', { type: 'turn/end', data: { turn: 1,
          reason: { kind: 'error', error: { code: 'TRANSPORT', message: 'fetch failed' } } } })
        fx.emitStatus('main', 'idle')
      }
    })
    return result
  }
  const executor = createRouteChainExecutor({ log: { log() {}, error() {} },
    ensureRunningForRoute: async () => ({ status: 'ready', proc: fx.proc }) })
  const observed = executor.runTurnWithRouteChain('agt_fx', {
    sessionId: 'main', message: 'synthetic fresh-spawn message', opts: {}, deadlineMs: 1000,
  }).then(result => ({ result }), error => ({ error }))
  await fx.tick()
  const promptsBeforeResume = fx.child.writes.filter(row => row.method === 'session/prompt').length
  resumeComplete = true
  if (prepareRequest) fx.emit({ id: prepareRequest.id,
    result: { version: 1, ready: true, sessionId: 'main' } })
  const outcome = await observed
  assert.equal(promptsBeforeResume, 0, 'process-ready released a prompt while application resume was suspended')
  assert.equal(earlyPrompts, 0)
  assert.equal(outcome.error, undefined)
  assert.equal(outcome.result.reply, 'one reply after resume')
  assert.equal(fx.counts().promptWriteAttempts, 1)
  assert.equal(fx.counts().spawnAttempts, 1)
})
