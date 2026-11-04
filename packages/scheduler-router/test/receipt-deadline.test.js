import assert from 'node:assert/strict'
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

test('D1 formula floor, crossover, default and safe-integer boundaries', () => {
  for (const [seconds, expected] of [[undefined, 180000], [1, 120000], [600, 120000],
    [2399, 120000], [2400, 120000], [2401, 120050], [3600, 180000], [7200, 360000]]) {
    assert.equal(schedulerReceiptBudget({ timeoutSeconds: seconds }).defaultMs, expected)
  }
  const maxSeconds = Math.floor(Number.MAX_SAFE_INTEGER / 50)
  assert.equal(schedulerReceiptBudget({ timeoutSeconds: maxSeconds }).defaultMs, maxSeconds * 50)
  assert.throws(() => schedulerReceiptBudget({ timeoutSeconds: maxSeconds + 1 }), /safe integer/)
  assert.throws(() => schedulerReceiptBudget({ receiptTimeoutSeconds: Math.floor(Number.MAX_SAFE_INTEGER / 1000) + 1 }), /safe integer/)
})

test('D1 per-job > static > env > legacy > formula; interactive default stays 30000', () => {
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
    assert.equal(scheduledReceiptDeadline(proc, req.sessionId, options(req)), expected)
    assert.equal(scheduledReceiptDeadline(proc, req.sessionId, { scheduledReceiptBudget: { timeoutMs: 1 } }), proc.deadlines.promptReceiptTimeoutMs)
    assert.equal(scheduledReceiptDeadline(proc, req.sessionId, {}), proc.deadlines.promptReceiptTimeoutMs)
  }
  assert.equal(processFor(config().perAgent('agt_fx')).deadlines.promptReceiptTimeoutMs, 30000)
  const req = request({})
  assert.throws(() => scheduledReceiptDeadline(processFor(config().perAgent('agt_fx')), 'other-session', options(req)), /identity mismatch/)
})

test('D1 deployment is captured at configuration boundary and never hot-read or mutated', () => {
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
  for (const invalid of ['0', '-1', '1.5', 'NaN', 'Infinity', '9007199254740992']) {
    assert.throws(() => config({ DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS: invalid }), /positive safe integer/)
  }
})

test('D1 invalid new fields fail before create/update persistence and old-definition dispatch', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'receipt-validation-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const store = new JobStore(join(dir, 'jobs.json'))
  const job = await createJob(store, input({}), { nowMs: 1000 })
  const before = readFileSync(store.filePath)
  let calls = 0
  for (const value of [0, -1, 1.5, '90', null, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => normalizeJob(input({ receiptTimeoutSeconds: value })), /receipt/)
    await assert.rejects(createJob(store, input({ receiptTimeoutSeconds: value })), /receipt/)
    await assert.rejects(updateJob(store, job.id, { payload: { ...job.payload, receiptTimeoutSeconds: value } }), /receipt/)
    await assert.rejects(invokeWithDeadline.call({ invoker: { invokeAgent() { calls += 1 } } },
      {}, input({ receiptTimeoutSeconds: value })), /receipt/)
    assert.deepEqual(readFileSync(store.filePath), before)
  }
  assert.equal(calls, 0)
  const valid = await updateJob(store, job.id, { payload: { ...job.payload, receiptTimeoutSeconds: 90 } })
  assert.equal(valid.payload.receiptTimeoutSeconds, 90)
  assert.notEqual(computePayloadHash(job), computePayloadHash(valid))
  const raw = input({ receiptTimeoutSeconds: 0 })
  await store.mutateDoc(doc => { doc.jobs.push({ ...raw, id: 'invalid-old-job' }) })
  const scheduler = new Scheduler({ store, invoker: createFakeInvoker() })
  await scheduler.load()
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
})

test('D1 cold receipt at 34.5s succeeds through bridge and real AgentProcess; no cross-job/interactive leak', async t => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 3600000 } })
  await fx.readyNow()
  const hr = process.hrtime.bigint()
  let elapsedMs = 0
  t.mock.method(process.hrtime, 'bigint', () => hr + BigInt(elapsedMs) * 1000000n)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const bridge = createRouterInvoker({ runTurnWithRouteChain(agentId, args) {
    args.opts.onDispatch()
    return fx.proc.turn(args.sessionId, args.message, args.opts, args.deadlineMs)
  } }, { admissions: new Map() })
  const before = { ...fx.proc.deadlines }
  const req = request({ timeoutSeconds: 3600 })
  let settled = false
  const pending = bridge(req).then(outcome => { settled = true; return outcome })
  await fx.tick()
  const execution = [...fx.proc.executions.values()][0]
  const absoluteDeadline = execution.promptReceiptDeadlineMono
  assert.equal(absoluteDeadline - execution.startMono, 180000)
  elapsedMs = 34500
  t.mock.timers.tick(34500)
  await fx.tick()
  assert.equal(settled, false)
  assert.equal(execution.promptReceiptDeadlineMono, absoluteDeadline)
  fx.respondTo('session/prompt', { messageId: 'cold-message' })
  fx.completeTurn(req.sessionId, 'cold-message', 'cold success')
  assert.equal((await pending).status, 'ok')
  for (const [id, payload, expected] of [['two', { receiptTimeoutSeconds: 90 }, 90000], ['three', {}, 180000]]) {
    const next = request(payload, id)
    const result = bridge(next)
    await fx.tick()
    const active = [...fx.proc.executions.values()][0]
    assert.equal(active.promptReceiptDeadlineMono - active.startMono, expected)
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
})

test('D1 longer receipt never extends earlier active-turn deadline; no receipt stays UNKNOWN/fenced', async t => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 34000 } })
  await fx.readyNow()
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const req = request({ timeoutSeconds: 3600 })
  const pending = fx.proc.turn(req.sessionId, req.message, options(req), req.timeoutMs)
  const rejection = assert.rejects(pending, error => error.status === 'outcome_unknown')
  await fx.tick()
  const execution = [...fx.proc.executions.values()][0]
  assert.equal(execution.promptReceiptDeadlineMono - execution.startMono, 180000)
  assert.equal(execution.turnDeadlineMono - execution.startMono, 34000)
  t.mock.timers.tick(34001)
  await rejection
  assert.equal(fx.store.getTurnReconciliation(execution.handle).snapshot.initialOutcome, 'outcome_unknown')
  assert.equal(fx.fence(), execution.handle)
  await assert.rejects(fx.proc.turn('main', 'no replay'), error => error.status === 'not_admitted')
  assert.equal(fx.proc.counters.promptWriteAttempts, 1)
  assert.equal(fx.proc.counters.replayAdmissions, 0)
})
