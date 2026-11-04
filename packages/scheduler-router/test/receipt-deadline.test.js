import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { normalizeJob, schedulerReceiptBudget } from '../../scheduler/src/job-model.js'
import { computePayloadHash } from '../../scheduler/src/occurrence-model.js'
import { createJobOp as createJob, updateJobOp as updateJob } from '../../scheduler/src/control.js'
import { JobStore } from '../../scheduler/src/store.js'
import { Scheduler } from '../../scheduler/src/scheduler.js'
import { createFakeInvoker } from '../../scheduler/src/seams.js'
import { invokeWithDeadline } from '../../scheduler/src/occurrence.js'
import { resolveDeadlineConfig } from '../../agent-router/src/deadline-config.js'
import { AgentProcess } from '../../agent-router/src/process.js'
import { createDeliveryResilience } from '../../agent-router/src/process/delivery-resilience.js'
import { makeFx } from '../../agent-router/test/helpers/fake-child.js'
import { createRouterInvoker } from '../src/index.js'
import { createScheduledReceiptBudget, scheduledReceiptDeadline } from '../../agent-router/src/process/scheduler-receipt.js'

const input = payload => ({ name: 'receipt', agentId: 'agt_fx', schedule: { kind: 'every', everyMs: 10000, anchorMs: 1000 },
  payload: { kind: 'agentTurn', message: 'work', ...payload }, delivery: { mode: 'none' } })
const request = (payload, id = 'one') => ({ agentId: 'agt_fx', sessionId: `cron-${id}`,
  occurrenceId: `occ-${id}`, runId: `run-${id}`, requestId: `occ-${id}`,
  message: 'scheduled', timeoutMs: 3600000, receiptBudget: schedulerReceiptBudget(payload) })
const options = req => ({ scheduledReceiptBudget: createScheduledReceiptBudget(req, req.receiptBudget),
  callerCorrelation: { occurrenceId: req.occurrenceId, runId: req.runId, requestId: req.requestId } })
const config = (env = {}, overrides = {}) => resolveDeadlineConfig(env, { overrides })
const processFor = deadlines => new AgentProcess({ agentId: 'agt_fx', profile: 'fixture', deadlines })
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const trace = (t, acceptance, observation) => t.diagnostic(`${acceptance} ${JSON.stringify(observation)}`)

test('D1 formula floor, crossover, default and safe-integer boundaries', t => {
  for (const [seconds, expected] of [[undefined, 180000], [1, 120000], [600, 120000],
    [2399, 120000], [2400, 120000], [2401, 120050], [3600, 180000], [7200, 360000]]) {
    const budget = schedulerReceiptBudget({ timeoutSeconds: seconds })
    assert.equal(budget.defaultMs, expected)
    trace(t, 'ACC-527D1-001', { timeoutSeconds: seconds ?? 'absent', budget })
  }
  const maxSeconds = Math.floor(Number.MAX_SAFE_INTEGER / 50)
  assert.equal(schedulerReceiptBudget({ timeoutSeconds: maxSeconds }).defaultMs, maxSeconds * 50)
  assert.throws(() => schedulerReceiptBudget({ timeoutSeconds: maxSeconds + 1 }), /safe integer/)
  assert.throws(() => schedulerReceiptBudget({ receiptTimeoutSeconds: Math.floor(Number.MAX_SAFE_INTEGER / 1000) + 1 }), /safe integer/)
})

test('D1 per-job > static > env > legacy > formula; interactive default stays 30000', t => {
  const combinations = [
    [{ DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS: '120000', DSH_AGENT_DELIVER_TIMEOUT: '70000' },
      { agt_fx: { promptReceiptTimeoutMs: 80000 } }, { receiptTimeoutSeconds: 90 }, 90000],
    [{ DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS: '120000' }, { agt_fx: { promptReceiptTimeoutMs: 80000 } }, {}, 80000],
    [{ DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS: '120000', DSH_AGENT_DELIVER_TIMEOUT: '70000' }, {}, {}, 120000],
    [{ DSH_AGENT_DELIVER_TIMEOUT: '70000' }, {}, {}, 70000],
    [{}, {}, {}, 180000],
    [{}, {}, { receiptTimeoutSeconds: 1 }, 1000],
  ]
  for (const [env, overrides, payload, expected] of combinations) {
    const proc = processFor(config(env, overrides).perAgent('agt_fx'))
    const req = request(payload)
    const resolvedMs = scheduledReceiptDeadline(proc, req.sessionId, options(req))
    assert.equal(resolvedMs, expected)
    const source = payload.receiptTimeoutSeconds !== undefined ? 'job'
      : overrides.agt_fx ? 'static' : env.DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS ? 'env'
        : env.DSH_AGENT_DELIVER_TIMEOUT ? 'legacy' : 'formula'
    trace(t, 'ACC-527D1-002', { env, overrides, payload, source, resolvedMs, config: proc.deadlines })
    assert.equal(scheduledReceiptDeadline(proc, req.sessionId, { scheduledReceiptBudget: { timeoutMs: 1 } }), proc.deadlines.promptReceiptTimeoutMs)
    assert.equal(scheduledReceiptDeadline(proc, req.sessionId, {}), proc.deadlines.promptReceiptTimeoutMs)
  }
  const interactiveMs = processFor(config().perAgent('agt_fx')).deadlines.promptReceiptTimeoutMs
  assert.equal(interactiveMs, 30000)
  trace(t, 'ACC-527D1-001', { caller: 'non-Scheduler', resolvedMs: interactiveMs })
  const req = request({})
  assert.throws(() => scheduledReceiptDeadline(processFor(config().perAgent('agt_fx')), 'other-session', options(req)), /identity mismatch/)
})

test('D1 deployment is captured at configuration boundary and never hot-read or mutated', t => {
  const env = { DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS: '70000' }
  const overrides = { agt_fx: { promptReceiptTimeoutMs: 80000 } }
  const resolved = config(env, overrides)
  const proc = processFor(resolved.perAgent('agt_fx'))
  const before = JSON.stringify(proc.deadlines)
  env.DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS = '1'
  overrides.agt_fx.promptReceiptTimeoutMs = 2
  const req = request({})
  assert.equal(scheduledReceiptDeadline(proc, req.sessionId, options(req)), 80000)
  assert.equal(JSON.stringify(proc.deadlines), before)
  assert.equal(Object.isFrozen(proc.deadlines), true)
  trace(t, 'ACC-527D1-002', { before: JSON.parse(before), after: proc.deadlines, changedInputs: { env, overrides }, frozen: Object.isFrozen(proc.deadlines) })
  let spawns = 0
  t.mock.method(AgentProcess.prototype, 'spawn', () => { spawns += 1 })
  for (const invalid of ['0', '-1', '1.5', 'NaN', 'Infinity', '9007199254740992']) {
    const reject = operation => assert.throws(operation, error => {
      trace(t, 'ACC-527D1-003', { deployment: invalid, rejection: error.message, spawns })
      return /positive safe integer/.test(error.message)
    })
    reject(() => processFor(config({ DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS: invalid }).perAgent('agt_fx')).spawn())
    reject(() => processFor({ promptReceiptTimeoutMs: Number(invalid) }).spawn())
    assert.equal(spawns, 0)
  }
})

test('D1 invalid new fields fail before create/update persistence and old-definition dispatch', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'receipt-validation-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const store = new JobStore(join(dir, 'jobs.json'))
  const job = await createJob(store, input({}), { nowMs: 1000 })
  const before = readFileSync(store.filePath)
  let calls = 0
  let persistenceWrites = 0
  const originalWrite = store._writeAtomicDoc.bind(store)
  t.mock.method(store, '_writeAtomicDoc', async (...args) => { persistenceWrites += 1; return originalWrite(...args) })
  for (const value of [0, -1, 1.5, '90', null, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => normalizeJob(input({ receiptTimeoutSeconds: value })), /receipt/)
    const reject = async (boundary, operation) => assert.rejects(operation, error => {
      trace(t, 'ACC-527D1-003', { boundary, invalid: String(value), type: typeof value,
        rejection: error.message, persistenceWrites, dispatches: calls,
        beforeSha256: digest(before), afterSha256: digest(readFileSync(store.filePath)) })
      return /receipt/.test(error.message)
    })
    await reject('create', () => createJob(store, input({ receiptTimeoutSeconds: value })))
    await reject('update', () => updateJob(store, job.id, { payload: { ...job.payload, receiptTimeoutSeconds: value } }))
    await reject('old-definition dispatch', () => invokeWithDeadline.call({ invoker: { invokeAgent() { calls += 1 } } },
      {}, input({ receiptTimeoutSeconds: value })))
    assert.equal(persistenceWrites, 0)
    assert.deepEqual(readFileSync(store.filePath), before)
  }
  assert.equal(calls, 0)
  const valid = await updateJob(store, job.id, { payload: { ...job.payload, receiptTimeoutSeconds: 90 } })
  assert.equal(valid.payload.receiptTimeoutSeconds, 90)
  assert.notEqual(computePayloadHash(job), computePayloadHash(valid))
  const raw = input({ receiptTimeoutSeconds: 0 })
  await store.mutateDoc(doc => { doc.jobs.push({ ...raw, id: 'invalid-old-job' }) })
  const scheduler = new Scheduler({ store, invoker: createFakeInvoker() })
  const rawBefore = readFileSync(store.filePath)
  await scheduler.load()
  assert.deepEqual(readFileSync(store.filePath), rawBefore)
  trace(t, 'ACC-527D1-003', { boundary: 'load corrupt old definition', dispatches: scheduler.invoker.invokeAgent.calls.length,
    beforeSha256: digest(rawBefore), afterSha256: digest(readFileSync(store.filePath)) })
  assert.equal(scheduler.doc.jobs.some(entry => entry.id === 'invalid-old-job'), false)
  assert.equal(scheduler.invoker.invokeAgent.calls.length, 0)
})

test('D1 Scheduler freezes the selected budget into the real invocation request', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'receipt-scheduler-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const invoker = createFakeInvoker()
  let now = 1000
  const scheduler = new Scheduler({ store: new JobStore(join(dir, 'jobs.json')), invoker, nowMs: () => now })
  t.after(() => scheduler.stop())
  await scheduler.start({ autoStart: false, catchup: false })
  await scheduler.createJob(input({ timeoutSeconds: 7200, receiptTimeoutSeconds: 91 }))
  now = 11000
  await scheduler.tick()
  await scheduler.whenIdle()
  assert.equal(invoker.calls.length, 1)
  assert.deepEqual(invoker.calls[0].receiptBudget, { defaultMs: 360000, overrideMs: 91000 })
  trace(t, 'ACC-527D1-002', { boundary: 'real Scheduler request', request: {
    occurrenceId: invoker.calls[0].occurrenceId, runId: invoker.calls[0].runId,
    receiptBudget: invoker.calls[0].receiptBudget, timeoutMs: invoker.calls[0].timeoutMs } })
})

test('D1 cold receipt at 34.5s succeeds through bridge and real AgentProcess; no cross-job/interactive leak', async t => {
  const fx = makeFx({ generation: 2, deadlines: { turnTimeoutMs: 3600000 } })
  await fx.readyNow()
  const first = makeFx({ generation: 1 })
  await first.readyNow()
  const hr = process.hrtime.bigint()
  let elapsedMs = 0
  t.mock.method(process.hrtime, 'bigint', () => hr + BigInt(elapsedMs) * 1000000n)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const retryTrace = []
  for (const fixture of [first, fx]) {
    const prepare = fixture.proc.prepareDelivery
    fixture.proc.prepareDelivery = function (sessionId, opts, bounds) {
      retryTrace.push({ phase: 'prepare', generation: this.processGeneration, deadlineMono: bounds.deadlineMono })
      return prepare.call(this, sessionId, opts, bounds)
    }
    const write = fixture.child.stdin.write.bind(fixture.child.stdin)
    fixture.child.stdin.write = (line, callback) => {
      const wireRequest = JSON.parse(line)
      const result = write(line, callback)
      queueMicrotask(() => {
        if (wireRequest.method === 'session/prepare') fixture.emit({ id: wireRequest.id,
          result: { version: 1, ready: fixture === fx, sessionId: wireRequest.params.sessionId } })
        if (wireRequest.method === 'shutdown') {
          fixture.emit({ id: wireRequest.id, result: {} })
          fixture.childExit()
        }
      })
      return result
    }
  }
  const resilience = createDeliveryResilience({
    log: { error: line => retryTrace.push({ phase: 'log', line }) },
    transportRetry: { baseDelayMs: 250, sleep: async delay => {
      retryTrace.push({ phase: 'retry_wait', delay })
      elapsedMs += delay
      t.mock.timers.tick(delay)
    } },
  })
  let acquireCount = 0
  const bridge = createRouterInvoker({ runTurnWithRouteChain(agentId, args) {
    const deadlineMono = Number(process.hrtime.bigint() / 1000000n) + args.deadlineMs
    return resilience.run({
      agentId, route: { routeRef: 'fixture' }, sessionId: args.sessionId,
      message: args.message, opts: args.opts, deadlineMono,
      acquire: async (_agent, _route, bound) => {
        const proc = ++acquireCount === 1 ? first.proc : fx.proc
        retryTrace.push({ phase: 'acquire', requestId: args.opts.callerCorrelation.requestId,
          generation: proc.processGeneration, deadlineMono: bound })
        return proc
      },
      onAcquired() {},
      invoke: proc => {
        args.opts.onDispatch()
        return proc.turn(args.sessionId, args.message,
          { ...args.opts, admissionDeadlineMono: deadlineMono }, args.deadlineMs)
      },
    })
  } }, { admissions: new Map() })
  const before = { ...fx.proc.deadlines }
  const req = request({ timeoutSeconds: 3600 })
  let settled = false
  const pending = bridge(req).then(outcome => { settled = true; return outcome })
  await fx.tick()
  const execution = [...fx.proc.executions.values()][0]
  const absoluteDeadline = execution.promptReceiptDeadlineMono
  assert.equal(absoluteDeadline - execution.startMono, 180000)
  assert.deepEqual(retryTrace.filter(row => row.phase === 'acquire').map(row => row.generation), [1, 2])
  const bounds = retryTrace.filter(row => ['acquire', 'prepare'].includes(row.phase)).map(row => row.deadlineMono)
  assert.equal(new Set(bounds).size, 1)
  assert.equal(first.proc.state, 'EXITED')
  assert.equal(first.counts().promptWriteAttempts, 0)
  const pendingPrompt = [...fx.proc.pending.values()].find(row => row.method === 'session/prompt')
  assert.equal(pendingPrompt.deadlineMono, Math.min(execution.promptReceiptDeadlineMono, execution.turnDeadlineMono, bounds[0]))
  trace(t, 'ACC-527D1-004', { phase: 'safe preparation retry / original admission deadline', retryTrace,
    firstExit: first.proc.exit, firstCounters: first.counts(), promptRpcDeadlineMono: pendingPrompt.deadlineMono })
  trace(t, 'ACC-527D1-004', { phase: 'prompt write', clock: 'virtual process.hrtime.bigint', startMono: execution.startMono,
    promptReceiptDeadlineMono: absoluteDeadline, turnDeadlineMono: execution.turnDeadlineMono })
  elapsedMs += 34500
  t.mock.timers.tick(34500)
  await fx.tick()
  assert.equal(settled, false)
  assert.equal(execution.promptReceiptDeadlineMono, absoluteDeadline)
  const receiptMono = Number(process.hrtime.bigint() / 1000000n)
  const receiptDelayAfterPromptMs = receiptMono - execution.startMono
  assert.equal(receiptDelayAfterPromptMs, 34500)
  trace(t, 'ACC-527D1-004', { phase: 'receipt arrives', elapsedMs, receiptMono,
    receiptDelayAfterPromptMs, settledBeforeReceipt: settled, promptReceiptDeadlineMono: execution.promptReceiptDeadlineMono })
  fx.respondTo('session/prompt', { messageId: 'cold-message' })
  fx.completeTurn(req.sessionId, 'cold-message', 'cold success')
  assert.equal((await pending).status, 'ok')
  for (const [id, payload, expected] of [['two', { receiptTimeoutSeconds: 90 }, 90000], ['three', {}, 180000]]) {
    const next = request(payload, id)
    const result = bridge(next)
    await fx.tick()
    const active = [...fx.proc.executions.values()][0]
    assert.equal(active.promptReceiptDeadlineMono - active.startMono, expected)
    trace(t, 'ACC-527D1-002', { sameProcess: true, job: id, payload, startMono: active.startMono,
      promptReceiptDeadlineMono: active.promptReceiptDeadlineMono, resolvedMs: active.promptReceiptDeadlineMono - active.startMono })
    fx.respondTo('session/prompt', { messageId: id })
    fx.completeTurn(next.sessionId, id, 'success')
    assert.equal((await result).status, 'ok')
  }
  const interactive = fx.proc.turn('main', 'hello')
  await fx.tick()
  const active = [...fx.proc.executions.values()][0]
  assert.equal(active.promptReceiptDeadlineMono - active.startMono, before.promptReceiptTimeoutMs)
  fx.respondTo('session/prompt', { messageId: 'interactive' })
  fx.completeTurn('main', 'interactive', 'ok')
  await interactive
  assert.deepEqual(fx.proc.deadlines, before)
  assert.equal(fx.proc.counters.replayAdmissions, 0)
  trace(t, 'ACC-527D1-002', { before, after: fx.proc.deadlines, interactiveReceiptMs: active.promptReceiptDeadlineMono - active.startMono,
    counters: fx.counts() })
})

test('D1 longer receipt never extends earlier active-turn deadline; no receipt stays UNKNOWN/fenced', async t => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 34000 } })
  await fx.readyNow()
  const hr = process.hrtime.bigint()
  let elapsedMs = 0
  t.mock.method(process.hrtime, 'bigint', () => hr + BigInt(elapsedMs) * 1000000n)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const req = request({ timeoutSeconds: 3600 })
  const pending = fx.proc.turn(req.sessionId, req.message, options(req), req.timeoutMs)
  const rejection = assert.rejects(pending, error => error.status === 'outcome_unknown')
  await fx.tick()
  const execution = [...fx.proc.executions.values()][0]
  assert.equal(execution.promptReceiptDeadlineMono - execution.startMono, 180000)
  assert.equal(execution.turnDeadlineMono - execution.startMono, 34000)
  elapsedMs = 34001
  trace(t, 'ACC-527D1-004', { phase: 'earlier turn deadline', startMono: execution.startMono,
    promptReceiptDeadlineMono: execution.promptReceiptDeadlineMono, turnDeadlineMono: execution.turnDeadlineMono,
    injectedElapsedMs: elapsedMs })
  t.mock.timers.tick(elapsedMs)
  await rejection
  assert.equal(fx.store.getTurnReconciliation(execution.handle).snapshot.initialOutcome, 'outcome_unknown')
  assert.equal(fx.fence(), execution.handle)
  await assert.rejects(fx.proc.turn('main', 'no replay'), error => error.status === 'not_admitted')
  assert.equal(fx.proc.counters.promptWriteAttempts, 1)
  assert.equal(fx.proc.counters.replayAdmissions, 0)
  trace(t, 'ACC-527D1-004', { phase: 'no receipt / blocked subsequent request', elapsedMs,
    reconciliation: fx.store.getTurnReconciliation(execution.handle), fence: fx.fence(), counters: fx.counts() })
})
