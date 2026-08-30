/**
 * @agent-core/agent-router/test/route-chain/quota-classifier.test.js —
 * IMPL V2 CTR-I2-008..011 regression suite for the
 * `provider_quota_rejected_before_generation` failure class.
 *
 * Two evidence layers are exercised:
 *  - REAL carrier: a genuine AgentProcess driven through the fake-child
 *    harness rejects with the real turn/end(error) quota carrier + the
 *    authoritative reconciliation snapshot (the exact production GLM 429
 *    shape of OBS-V2-005 — the executor itself drives the only turn);
 *  - controlled carriers: unit fixtures for the complete negative matrix
 *    (partial output / assistant content / tool call / tool started /
 *    external side effect / transport timeout / termination unknown /
 *    ambiguous text-only quota / initialize-origin quota).
 *
 * Task-mandated cases:
 *   A. safe terminal 429: glm53 attempt1 -> luna attempt2 -> success
 *   B. 429 + partial output: attempts=1, Luna calls=0, STOP_CHAIN
 *   C. 429 + outcome_unknown: attempts=1, Luna calls=0, STOP_CHAIN
 *   D. 429 + tool started: attempts=1, Luna calls=0, STOP_CHAIN
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  canonicalRouteIdentity,
  classifyAttemptFailure,
  createRouteChainExecutor,
  ROUTE_HOP_FAILURE_CLASSES,
  ROUTE_STOP_REASONS,
} from '../../src/route-chain.js'
import { makeFx } from '../helpers/fake-child.js'

const quietLog = { log() {}, warn() {}, error() {} }

/** Errors shaped like AgentProcess structured carriers. */
function carrier(envelope, code, message, extra = {}) {
  return Object.assign(new Error(message), { envelope, status: envelope, code, ...extra })
}

function pick(verdict) {
  return [verdict.failureClass, verdict.admissionProven]
}

function snapshot(...routes) {
  return Object.freeze({
    agentId: 'agt_cto-agent',
    override: true,
    chainId: 'chain-test',
    routes: Object.freeze(routes.map((route) => Object.freeze(route))),
  })
}

function route(routeRef, processConfig = { provider: routeRef, model: `m-${routeRef}` }) {
  return Object.freeze({
    routeRef,
    provider: processConfig.provider,
    model: processConfig.model,
    identity: canonicalRouteIdentity(processConfig),
    processConfig: Object.freeze(processConfig),
  })
}

const GLM = route('glm53', { provider: 'zai', model: 'glm-5.3', subscription: { plugin: 'dsh-zai', pluginVersion: '1.4.2' } })
const LUNA = route('luna', { provider: 'openai-codex', model: 'gpt-5.6-luna', subscription: { plugin: 'dsh-codex', pluginVersion: '0.2.3' } })

function fakeSeam({ procs = [] } = {}) {
  const acquires = []
  return {
    acquires,
    ensureRunningForRoute: async (agentId, wanted) => {
      const index = acquires.length
      acquires.push({ agentId, routeIdentity: wanted.routeIdentity })
      const proc = procs[index]
      if (proc === undefined) throw new Error(`no fake proc for acquire #${index}`)
      return { status: 'ready', proc }
    },
  }
}

function makeExecutor(seam, routes) {
  return createRouteChainExecutor({
    log: quietLog,
    ensureRunningForRoute: seam.ensureRunningForRoute,
    resolveRouteChain: () => snapshot(...routes),
    resolveTurnDeadlineMs: () => 10_000,
  })
}

/** The authoritative reconciliation-snapshot bundle of a real terminal
 * pre-generation quota failure (turnExecutionSnapshot shape). */
const authoritativeQuotaSnapshot = Object.freeze({
  phase: 'terminal',
  promptReceipt: 'accepted',
  reconciledOutcome: 'failed',
  outcomeEvidence: 'exact_turn_end_failure',
  terminationProven: true,
  terminationEvidence: 'exact_terminal_then_idle',
  finalAssistantOutputAvailable: false,
})

/** The real-shape failed turn carrier (OBS-V2-006: failed + promptReceipt
 * accepted + account_quota_exhausted — the carrier the V1 classifier
 * misclassified as initialize_provider_unavailable). */
function realQuotaCarrier() {
  return carrier('failed', 'account_quota_exhausted', 'HTTP 429: Usage limit reached for 5 hours', {
    reconciliationHandle: 'turn:fixture:quota:1',
    evidence: {
      eventWatermarkSeq: 0,
      promptRequestId: 'req-1-2',
      messageId: 'm-a',
      promptReceipt: 'accepted',
      terminationEvidence: null, // stale in-flight snapshot by construction
      phase: 'running',
    },
  })
}

/** A fake luna proc that records its (must-be-exactly-one) model calls. */
function lunaProc() {
  const calls = []
  return {
    calls,
    pid: 222,
    turn: async (...args) => {
      calls.push(args)
      return { status: 'completed', reply: 'luna-ok', messageId: 'm', evidence: { promptReceipt: 'accepted' } }
    },
    deliver: async () => ({ accepted: true, sessionId: 'main', messageId: 'm' }),
  }
}

// ─── CTR-I2-008 precedence: unsafe/unknown evidence first ─────────────────

test('quota signal + full authoritative evidence => exact new class, hop candidate', () => {
  const verdict = classifyAttemptFailure(realQuotaCarrier(), authoritativeQuotaSnapshot)
  assert.deepEqual(pick(verdict), [
    ROUTE_HOP_FAILURE_CLASSES.PROVIDER_QUOTA_REJECTED_BEFORE_GENERATION,
    'provider_request_sent_generation_not_started',
  ])
  assert.equal(verdict.stopReason, null)
})

test('structured HTTP 429 status also qualifies as the quota signal', () => {
  const error = carrier('failed', 'provider_runtime_rejection', 'structured rejection', {
    httpStatus: 429,
    evidence: { promptReceipt: 'accepted', httpStatus: 429 },
  })
  const verdict = classifyAttemptFailure(error, authoritativeQuotaSnapshot)
  assert.equal(verdict.failureClass, ROUTE_HOP_FAILURE_CLASSES.PROVIDER_QUOTA_REJECTED_BEFORE_GENERATION)
})

test('B/D matrix: every unsafe flag beats the quota signal => STOP', () => {
  for (const flag of ['partialOutput', 'assistantContent', 'toolCall', 'toolStarted', 'externalSideEffect', 'transportTimeout', 'outcomeUnknown']) {
    const error = carrier('failed', 'account_quota_exhausted', '429 quota', {
      evidence: { promptReceipt: 'accepted', [flag]: true },
    })
    const verdict = classifyAttemptFailure(error, authoritativeQuotaSnapshot)
    assert.equal(verdict.failureClass, null, flag)
    assert.equal(verdict.stopReason, ROUTE_STOP_REASONS.POST_ADMISSION_FAILURE, flag)
  }
})

test('B (authoritative): captured assistant output stops even without carrier flags', () => {
  const verdict = classifyAttemptFailure(realQuotaCarrier(), {
    ...authoritativeQuotaSnapshot,
    finalAssistantOutputAvailable: true,
  })
  assert.equal(verdict.failureClass, null)
  assert.equal(verdict.stopReason, ROUTE_STOP_REASONS.POST_ADMISSION_FAILURE)
})

test('C: 429-shaped outcome_unknown carrier => STOP outcome_unknown', () => {
  const error = carrier('outcome_unknown', 'AGENT_PROCESS_TURN_OUTCOME_UNKNOWN', 'no termination proof', {
    evidence: { promptReceipt: 'accepted' },
  })
  assert.equal(classifyAttemptFailure(error).stopReason, ROUTE_STOP_REASONS.OUTCOME_UNKNOWN)
})

test('429 + transport timeout evidence => STOP timeout_without_proven_termination', () => {
  const timeoutCarrier = carrier('failed', 'account_quota_exhausted', '429 quota', {
    source: 'turn_deadline_exceeded',
    evidence: { promptReceipt: 'accepted', transportTimeout: false },
  })
  assert.equal(
    classifyAttemptFailure(timeoutCarrier, authoritativeQuotaSnapshot).stopReason,
    ROUTE_STOP_REASONS.TIMEOUT_WITHOUT_PROVEN_TERMINATION,
  )
  const rpcDeadline = Object.assign(
    new Error('429 quota'),
    { code: 'AGENT_PROCESS_RPC_DEADLINE', envelope: 'failed', status: 'failed', evidence: { promptReceipt: 'accepted' } },
  )
  assert.equal(classifyAttemptFailure(rpcDeadline).stopReason, ROUTE_STOP_REASONS.TIMEOUT_WITHOUT_PROVEN_TERMINATION)
})

// ─── CTR-I2-009: whitelist closure — ambiguous/text-only never hops ───────

test('ambiguous quota (no authoritative bundle, no controlled proofs) => STOP, never initialize/no-admission', () => {
  const verdict = classifyAttemptFailure(realQuotaCarrier()) // no snapshot fetched
  assert.equal(verdict.failureClass, null)
  assert.notEqual(verdict.admissionProven, 'proven_no_admission')
  assert.equal(verdict.stopReason, ROUTE_STOP_REASONS.UNKNOWN_FAILURE_CLASS)
})

test('each missing authoritative predicate separately breaks the quota class', () => {
  const breakers = [
    { key: 'promptReceipt', value: 'unknown', stop: ROUTE_STOP_REASONS.UNKNOWN_FAILURE_CLASS },
    { key: 'reconciledOutcome', value: 'outcome_unknown', stop: ROUTE_STOP_REASONS.UNKNOWN_FAILURE_CLASS },
    { key: 'outcomeEvidence', value: 'rpc_error_response', stop: ROUTE_STOP_REASONS.UNKNOWN_FAILURE_CLASS },
    { key: 'terminationProven', value: false, stop: ROUTE_STOP_REASONS.UNKNOWN_FAILURE_CLASS },
    { key: 'terminationEvidence', value: null, stop: ROUTE_STOP_REASONS.UNKNOWN_FAILURE_CLASS },
    // Captured output is affirmative unsafe evidence (precedence 1):
    { key: 'finalAssistantOutputAvailable', value: true, stop: ROUTE_STOP_REASONS.POST_ADMISSION_FAILURE },
  ]
  for (const { key, value, stop } of breakers) {
    const verdict = classifyAttemptFailure(realQuotaCarrier(), { ...authoritativeQuotaSnapshot, [key]: value })
    assert.equal(verdict.failureClass, null, key)
    assert.equal(verdict.stopReason, stop, key)
  }
})

test('text-only quota (quota words in message, non-quota structured code) => STOP post-admission', () => {
  const error = carrier('failed', 'provider_runtime_rejection', 'HTTP 429: usage limit reached, quota exhausted for the account', {
    evidence: { promptReceipt: 'accepted' },
  })
  const verdict = classifyAttemptFailure(error, authoritativeQuotaSnapshot)
  assert.equal(verdict.failureClass, null)
  assert.equal(verdict.stopReason, ROUTE_STOP_REASONS.POST_ADMISSION_FAILURE)
})

test('session-boundary quota sync rejection (no receipt, no proof) => STOP fail-closed, never class 3', () => {
  const error = carrier('failed', 'account_quota_exhausted', '429 at session boundary', {
    evidence: { promptReceipt: 'unknown' },
  })
  const verdict = classifyAttemptFailure(error)
  assert.equal(verdict.failureClass, null)
  assert.notEqual(verdict.admissionProven, 'proven_no_admission')
  assert.equal(verdict.stopReason, ROUTE_STOP_REASONS.UNKNOWN_FAILURE_CLASS)
})

// ─── CTR-I2-011 (6): initialize-origin quota keeps class 2 (V1 carry-over)

test('explicit initialize-origin quota + never READY + no prompt attempt => existing class 2', () => {
  const init = Object.assign(new Error('account_quota_exhausted: quota'), { code: 'account_quota_exhausted' })
  const verdict = classifyAttemptFailure(init)
  assert.deepEqual(pick(verdict), [ROUTE_HOP_FAILURE_CLASSES.INITIALIZE_PROVIDER_UNAVAILABLE, 'proven_no_admission'])
})

test('the other three no-admission classes still hop (closed V1 whitelist intact)', () => {
  const spawnFailure = Object.assign(new Error('spawn failed without child'), { code: 'AGENT_PROCESS_SPAWN_FAILED' })
  assert.equal(classifyAttemptFailure(spawnFailure).failureClass, ROUTE_HOP_FAILURE_CLASSES.SPAWN_FAILED_WITHOUT_CHILD)
  const session = carrier('failed', 'SESSION_WORKSPACE_MISMATCH', 'workspace mismatch', { evidence: { promptReceipt: 'unknown' } })
  assert.equal(classifyAttemptFailure(session).failureClass, ROUTE_HOP_FAILURE_CLASSES.SESSION_CREATE_RESUME_REJECTION)
  const queue = carrier('not_admitted', 'AGENT_PROCESS_QUEUE_CAP', 'caps exceeded')
  assert.equal(classifyAttemptFailure(queue).failureClass, ROUTE_HOP_FAILURE_CLASSES.TURNQUEUE_NOT_ADMITTED)
})

// ─── Executor level with the REAL AgentProcess carrier ────────────────────

test('A (real process): terminal pre-generation 429 hops glm53 -> luna -> success', async () => {
  const fx = makeFx()
  await fx.readyNow()
  const luna = lunaProc()
  const seam = fakeSeam({ procs: [fx.proc, luna] })
  const executor = makeExecutor(seam, [GLM, LUNA])
  const resultPromise = executor.runTurnWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'quota prompt', opts: {} })
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-a' })
  await fx.tick()
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
  fx.emitEvent('main', { type: 'user/message', data: { id: 'm-a' } })
  fx.emitEvent('main', {
    type: 'turn/end',
    data: { turn: 1, reason: { kind: 'error', error: { code: 'HTTP_429', message: 'Usage limit reached for 5 hours (quota exhausted)' } } },
  })
  fx.emitStatus('main', 'idle')
  const result = await resultPromise
  // A: TOTAL_ROUTE_ATTEMPTS=2, FALLBACK_ACTIVATED=true, FINAL_ROUTE=luna,
  // LUNA_MODEL_CALL_COUNT=1.
  assert.equal(result.reply, 'luna-ok')
  assert.equal(result.routeRef, 'luna')
  assert.equal(luna.calls.length, 1)
  assert.equal(seam.acquires.length, 2)
  const journal = executor.journalSnapshot()
  const final = journal.find((entry) => entry.kind === 'route_chain_final')
  assert.equal(final.finalOutcome, 'SUCCESS')
  assert.equal(final.finalRoute, 'luna')
  assert.equal(final.totalRouteAttempts, 2)
  assert.equal(final.fallbackActivated, true)
  assert.equal(final.fallbackRoute, 'luna')
  const quotaAttempt = journal.filter((entry) => entry.kind === 'route_attempt')[0]
  assert.equal(quotaAttempt.failureClass, ROUTE_HOP_FAILURE_CLASSES.PROVIDER_QUOTA_REJECTED_BEFORE_GENERATION)
  assert.equal(quotaAttempt.admissionProven, 'provider_request_sent_generation_not_started')
  assert.equal(quotaAttempt.attemptOutcome, `fallback:${ROUTE_HOP_FAILURE_CLASSES.PROVIDER_QUOTA_REJECTED_BEFORE_GENERATION}`)
})

test('B (real process): 429 after partial assistant output STOPs, zero luna acquires', async () => {
  const fx = makeFx()
  await fx.readyNow()
  const luna = lunaProc()
  const seam = fakeSeam({ procs: [fx.proc, luna] })
  const executor = makeExecutor(seam, [GLM, LUNA])
  const resultPromise = executor.runTurnWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'quota prompt', opts: {} })
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-a' })
  await fx.tick()
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
  fx.emitEvent('main', { type: 'user/message', data: { id: 'm-a' } })
  fx.emitEvent('main', { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'partial output before the quota hit' }] } } })
  fx.emitEvent('main', {
    type: 'turn/end',
    data: { turn: 1, reason: { kind: 'error', error: { code: 'HTTP_429', message: 'quota exhausted' } } },
  })
  fx.emitStatus('main', 'idle')
  await assert.rejects(resultPromise, (error) => {
    assert.equal(error.envelope, 'failed')
    assert.equal(error.routeChain.finalOutcome.includes(ROUTE_STOP_REASONS.POST_ADMISSION_FAILURE), true)
    return true
  })
  const journal = executor.journalSnapshot()
  const final = journal.find((entry) => entry.kind === 'route_chain_final')
  assert.equal(final.totalRouteAttempts, 1)
  assert.equal(final.finalRoute, 'NONE')
  assert.equal(final.fallbackActivated, false)
  assert.equal(seam.acquires.length, 1)
  assert.equal(luna.calls.length, 0)
})

test('C (real process): quota turn never terminates => outcome_unknown STOP, zero luna acquires', async () => {
  const fx = makeFx({ deadlines: { turnTimeoutMs: 60 } })
  await fx.readyNow()
  const luna = lunaProc()
  const seam = fakeSeam({ procs: [fx.proc, luna] })
  const executor = makeExecutor(seam, [GLM, LUNA])
  const resultPromise = executor.runTurnWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'quota prompt', opts: {} })
  await fx.tick()
  fx.respondTo('session/prompt', { messageId: 'm-a' })
  await fx.tick()
  fx.emitEvent('main', { type: 'turn/start', data: { turn: 1 } })
  fx.emitEvent('main', { type: 'user/message', data: { id: 'm-a' } })
  // No turn/end, no idle: the turn deadline fires => outcome_unknown.
  await assert.rejects(resultPromise, (error) => {
    assert.equal(error.envelope, 'outcome_unknown')
    assert.equal(error.routeChain.finalOutcome, `stop:${ROUTE_STOP_REASONS.OUTCOME_UNKNOWN}`)
    return true
  })
  const journal = executor.journalSnapshot()
  const final = journal.find((entry) => entry.kind === 'route_chain_final')
  assert.equal(final.totalRouteAttempts, 1)
  assert.equal(final.finalRoute, 'NONE')
  assert.equal(seam.acquires.length, 1)
  assert.equal(luna.calls.length, 0)
})

test('D (controlled carrier): 429 + tool started => STOP, zero luna acquires', async () => {
  const glmProc = {
    pid: 111,
    turn: async () => {
      throw carrier('failed', 'account_quota_exhausted', '429 after tool started', {
        evidence: { promptReceipt: 'accepted', toolStarted: true },
      })
    },
    deliver: async () => ({ accepted: true }),
  }
  const luna = lunaProc()
  const seam = fakeSeam({ procs: [glmProc, luna] })
  const executor = makeExecutor(seam, [GLM, LUNA])
  await assert.rejects(executor.runTurnWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'x', opts: {} }))
  const final = executor.journalSnapshot().find((entry) => entry.kind === 'route_chain_final')
  assert.equal(final.totalRouteAttempts, 1)
  assert.equal(final.finalRoute, 'NONE')
  assert.equal(final.fallbackActivated, false)
  assert.equal(seam.acquires.length, 1)
  assert.equal(luna.calls.length, 0)
})

test('journal redaction: quota attempts never journal raw provider bodies or prompts', async () => {
  const glmProc = {
    pid: 111,
    turn: async () => { throw realQuotaCarrier() },
    deliver: async () => ({ accepted: true }),
    turnExecutionSnapshot: () => ({ ...authoritativeQuotaSnapshot }),
  }
  const luna = lunaProc()
  const seam = fakeSeam({ procs: [glmProc, luna] })
  const executor = makeExecutor(seam, [GLM, LUNA])
  const result = await executor.runTurnWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'secret-prompt-body', opts: {} })
  assert.equal(result.reply, 'luna-ok')
  const serialized = JSON.stringify(executor.journalSnapshot())
  assert.equal(serialized.includes('secret-prompt-body'), false)
  assert.equal(serialized.includes('Usage limit'), false)
  assert.equal(serialized.includes('HTTP 429'), false)
})

test('no next route: exact quota class on a length-1 chain stays terminal (no cycle/restart)', async () => {
  const glmProc = {
    pid: 111,
    turn: async () => {
      throw carrier('failed', 'account_quota_exhausted', '429', {
        evidence: {
          promptReceipt: 'accepted', terminationProven: true, outputTokens: 0,
          partialOutput: false, assistantContent: false, toolCall: false, toolStarted: false,
          externalSideEffect: false, outcomeUnknown: false, transportTimeout: false,
        },
      })
    },
    deliver: async () => ({ accepted: true }),
  }
  const seam = fakeSeam({ procs: [glmProc] })
  const executor = makeExecutor(seam, [GLM])
  await assert.rejects(executor.runTurnWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'x', opts: {} }))
  const final = executor.journalSnapshot().find((entry) => entry.kind === 'route_chain_final')
  assert.equal(final.finalOutcome, ROUTE_HOP_FAILURE_CLASSES.PROVIDER_QUOTA_REJECTED_BEFORE_GENERATION)
  assert.equal(final.totalRouteAttempts, 1)
  assert.equal(final.finalRoute, 'NONE')
})

test('budget exhaustion: exact quota class with no remaining deadline STOPs (no refresh)', async () => {
  const glmProc = {
    pid: 111,
    turn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      throw carrier('failed', 'account_quota_exhausted', '429', {
        evidence: {
          promptReceipt: 'accepted', terminationProven: true, outputTokens: 0,
          partialOutput: false, assistantContent: false, toolCall: false, toolStarted: false,
          externalSideEffect: false, outcomeUnknown: false, transportTimeout: false,
        },
      })
    },
    deliver: async () => ({ accepted: true }),
  }
  const luna = lunaProc()
  const seam = fakeSeam({ procs: [glmProc, luna] })
  const executor = createRouteChainExecutor({
    log: quietLog,
    ensureRunningForRoute: seam.ensureRunningForRoute,
    resolveRouteChain: () => snapshot(GLM, LUNA),
    resolveTurnDeadlineMs: () => 1, // single deadline exhausted by the attempt
  })
  await assert.rejects(executor.runTurnWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'x', opts: {} }))
  const final = executor.journalSnapshot().find((entry) => entry.kind === 'route_chain_final')
  assert.equal(final.finalOutcome.includes(ROUTE_STOP_REASONS.TIMEOUT_WITHOUT_PROVEN_TERMINATION), true)
  assert.equal(luna.calls.length, 0)
})

// ─── Task-mandated candidate scenarios 5 and 7 ────────────────────────────

/** Full-evidence terminal pre-generation quota carrier (controlled proofs). */
function provenQuotaCarrier() {
  return carrier('failed', 'account_quota_exhausted', 'HTTP 429: quota exhausted', {
    evidence: {
      promptReceipt: 'accepted', terminationProven: true, outputTokens: 0,
      partialOutput: false, assistantContent: false, toolCall: false, toolStarted: false,
      externalSideEffect: false, outcomeUnknown: false, transportTimeout: false,
    },
  })
}

test('scenario 5: Luna initialize failure after a quota hop stays terminal — no back-hop to glm53', async () => {
  const glmProc = {
    pid: 111,
    turn: async () => { throw provenQuotaCarrier() },
    deliver: async () => ({ accepted: true }),
  }
  const acquires = []
  const seam = {
    acquires,
    ensureRunningForRoute: async (agentId, wanted) => {
      const index = acquires.length
      acquires.push({ agentId, routeIdentity: wanted.routeIdentity })
      if (index === 0) return { status: 'ready', proc: glmProc }
      // Luna initialize fails loud (bare fail-loud provider carrier: explicit
      // initialize origin, never READY, no prompt attempt — V1 class 2 shape).
      throw Object.assign(new Error('provider_unavailable: openai-codex unreachable at initialize'), { code: 'provider_unavailable' })
    },
  }
  const executor = makeExecutor(seam, [GLM, LUNA])
  await assert.rejects(executor.runTurnWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'x', opts: {} }), (error) => {
    assert.equal(error.code, 'provider_unavailable')
    assert.equal(error.routeChain.totalRouteAttempts, 2)
    return true
  })
  const journal = executor.journalSnapshot()
  const attempts = journal.filter((entry) => entry.kind === 'route_attempt')
  assert.deepEqual(attempts.map((entry) => entry.route), ['glm53', 'luna'])
  assert.equal(attempts[1].failureClass, ROUTE_HOP_FAILURE_CLASSES.INITIALIZE_PROVIDER_UNAVAILABLE)
  const final = journal.find((entry) => entry.kind === 'route_chain_final')
  // Terminal on the LAST route: no third acquire, no return to glm53, no restart.
  assert.equal(seam.acquires.length, 2)
  assert.equal(final.totalRouteAttempts, 2)
  assert.equal(final.finalRoute, 'NONE')
  assert.equal(final.finalOutcome, ROUTE_HOP_FAILURE_CLASSES.INITIALIZE_PROVIDER_UNAVAILABLE)
})

test('scenario 7: fallback never duplicates work — zero tools on the failed glm53 attempt, exactly one tool run and one result on Luna', async () => {
  const toolRuns = []
  const providerRequests = []
  const glmProc = {
    pid: 111,
    turn: async () => {
      providerRequests.push('glm53')
      // Terminal pre-generation 429: the provider request went out, zero
      // generation, zero tool executions on this attempt.
      throw provenQuotaCarrier()
    },
    deliver: async () => ({ accepted: true }),
  }
  const luna = {
    pid: 222,
    turn: async () => {
      providerRequests.push('luna')
      toolRuns.push(`tool-on-luna-${toolRuns.length}`)
      return { status: 'completed', reply: 'luna-ok', messageId: 'm', evidence: { promptReceipt: 'accepted' } }
    },
    deliver: async () => ({ accepted: true }),
  }
  const seam = fakeSeam({ procs: [glmProc, luna] })
  const executor = makeExecutor(seam, [GLM, LUNA])
  const dispatches = []
  const result = await executor.runTurnWithRouteChain('agt_cto-agent', {
    sessionId: 'main', message: 'x', opts: { onDispatch: () => dispatches.push('dispatch') },
  })
  assert.equal(result.reply, 'luna-ok')
  assert.equal(result.routeRef, 'luna')
  // One provider request per route, each route attempted exactly once.
  assert.deepEqual(providerRequests, ['glm53', 'luna'])
  // Tools executed ONLY on the successful Luna attempt — the failed attempt
  // proved zero tool activity before the hop was allowed.
  assert.deepEqual(toolRuns, ['tool-on-luna-0'])
  // One logical turn: one dispatch notification, one final journal block.
  assert.deepEqual(dispatches, ['dispatch'])
  const finals = executor.journalSnapshot().filter((entry) => entry.kind === 'route_chain_final')
  assert.equal(finals.length, 1)
  assert.equal(finals[0].finalRoute, 'luna')
  assert.equal(finals[0].totalRouteAttempts, 2)
  assert.equal(finals[0].fallbackActivated, true)
})
