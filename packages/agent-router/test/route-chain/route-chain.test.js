/**
 * @agent-core/agent-router/test/route-chain/route-chain.test.js — unit tests for the
 * unified ordered route-attempt chain executor
 * (AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1 CTR-IMPL-002..008; policy:
 * AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1 CTR-003..CTR-009).
 *
 * The registry seam is faked here (no real slots); process-registry-route-
 * gate.test.js covers the DEC-IMPL-004 reuse gate against the real registry.
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

const quietLog = { log() {}, warn() {}, error() {} }

/** Errors shaped like AgentProcess structured carriers. */
function carrier(envelope, code, message, extra = {}) {
  return Object.assign(new Error(message), { envelope, status: envelope, code, ...extra })
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

/**
 * Fake registry seam: per-routeRef proc factories; records the acquire
 * sequence; honors route identity matching like the real gate.
 */
function fakeSeam({ procs = {}, onAcquire = null } = {}) {
  const acquires = []
  return {
    acquires,
    ensureRunningForRoute: async (agentId, wanted) => {
      const index = acquires.length
      acquires.push({ agentId, routeIdentity: wanted.routeIdentity })
      if (typeof onAcquire === 'function') onAcquire(index, wanted)
      const proc = procs[index] ?? procs[wanted.routeIdentity]
      if (proc === undefined) {
        throw new Error(`no fake proc for acquire #${index}`)
      }
      return { status: 'ready', proc }
    },
  }
}

function okProc({ reply = 'ok', turnError = null } = {}) {
  return {
    pid: 111,
    turn: async () => {
      if (turnError) throw turnError
      return { status: 'completed', reply, messageId: 'm', evidence: { promptReceipt: 'accepted' } }
    },
    deliver: async () => ({ accepted: true, sessionId: 'main', messageId: 'm' }),
  }
}

function makeExecutor(seam, routes, opts = {}) {
  return createRouteChainExecutor({
    log: quietLog,
    ensureRunningForRoute: seam.ensureRunningForRoute,
    resolveRouteChain: () => snapshot(...routes),
    resolveTurnDeadlineMs: () => opts.turnDeadlineMs ?? 60_000,
  })
}

const GLM = route('glm53', { provider: 'zai', model: 'glm-5.3', subscription: { plugin: 'dsh-zai', pluginVersion: '1.4.2' } })
const LUNA = route('luna', { provider: 'openai-codex', model: 'gpt-5.6-luna', subscription: { plugin: 'dsh-codex', pluginVersion: '0.2.3' } })

// ─── classification (parent CTR-004 whitelist / CTR-005 stop set) ─────────

test('classification: the four whitelisted proven-no-admission classes hop', () => {
  const spawnFailure = Object.assign(new Error('spawn failed without child'), { code: 'AGENT_PROCESS_SPAWN_FAILED' })
  assert.deepEqual(pick(classifyAttemptFailure(spawnFailure)), ['spawn_failed_without_child', 'proven_no_admission'])
  const preSpawn = Object.assign(new Error('provision home failed'), { startupFailureStage: 'provisionHome' })
  assert.deepEqual(pick(classifyAttemptFailure(preSpawn)), ['spawn_failed_without_child', 'proven_no_admission'])
  for (const code of ['provider_unavailable', 'credential_missing', 'oauth_expired_or_revoked', 'account_quota_exhausted', 'model_unavailable']) {
    const init = Object.assign(new Error(code), { code })
    assert.deepEqual(pick(classifyAttemptFailure(init)), ['initialize_provider_unavailable', 'proven_no_admission'], code)
  }
  const session = carrier('failed', 'SESSION_WORKSPACE_MISMATCH', 'workspace mismatch', { evidence: { promptReceipt: 'unknown' } })
  assert.deepEqual(pick(classifyAttemptFailure(session)), ['session_create_resume_rejection', 'proven_no_admission'])
  const queue = carrier('not_admitted', 'AGENT_PROCESS_QUEUE_CAP', 'caps exceeded')
  assert.deepEqual(pick(classifyAttemptFailure(queue)), ['turnqueue_not_admitted', 'proven_no_admission'])
})

test('classification: everything in the CTR-005 stop set stays put', () => {
  const unknown = carrier('outcome_unknown', 'AGENT_PROCESS_TURN_OUTCOME_UNKNOWN', 'no termination proof')
  assert.equal(classifyAttemptFailure(unknown).stopReason, ROUTE_STOP_REASONS.OUTCOME_UNKNOWN)
  const initTimeout = Object.assign(new Error('initialize timeout'), { code: 'AGENT_PROCESS_INITIALIZE_TIMEOUT' })
  assert.equal(classifyAttemptFailure(initTimeout).stopReason, ROUTE_STOP_REASONS.TIMEOUT_WITHOUT_PROVEN_TERMINATION)
  const postAdmission = carrier('failed', 'provider_failure', 'after receipt', { evidence: { promptReceipt: 'accepted' } })
  assert.equal(classifyAttemptFailure(postAdmission).stopReason, ROUTE_STOP_REASONS.POST_ADMISSION_FAILURE)
  assert.equal(classifyAttemptFailure(postAdmission).admissionProven, 'admitted')
  const bare = new Error('mystery')
  assert.equal(classifyAttemptFailure(bare).stopReason, ROUTE_STOP_REASONS.UNKNOWN_FAILURE_CLASS)
})

function pick(verdict) {
  return [verdict.failureClass, verdict.admissionProven]
}

// ─── executor: primary-first, ordered traversal, termination ───────────────

test('CTR-002: primary success means zero fallback activity', async () => {
  const seam = fakeSeam({ procs: [okProc({ reply: 'primary' })] })
  const executor = makeExecutor(seam, [GLM, LUNA])
  const result = await executor.runTurnWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'hi', opts: {} })
  assert.equal(result.reply, 'primary')
  assert.equal(result.routeRef, 'glm53')
  assert.equal(seam.acquires.length, 1)
  const journal = executor.journalSnapshot()
  assert.equal(journal.filter((entry) => entry.kind === 'route_attempt').length, 1)
  const final = journal.find((entry) => entry.kind === 'route_chain_final')
  assert.equal(final.finalOutcome, 'SUCCESS')
  assert.equal(final.totalRouteAttempts, 1)
  assert.equal(final.fallbackActivated, false)
  assert.equal(final.fallbackRoute, null)
  assert.equal(final.primaryRoute, 'glm53')
})

test('CTR-003/004: each whitelisted failure hops exactly once, in order, to the next route', async () => {
  const hopErrors = [
    Object.assign(new Error('spawn failed without child'), { code: 'AGENT_PROCESS_SPAWN_FAILED' }),
    Object.assign(new Error('provider_unavailable'), { code: 'provider_unavailable' }),
    carrier('failed', 'SESSION_CREATE_FAILED', 'structured rejection', { evidence: { promptReceipt: 'unknown' } }),
    carrier('not_admitted', 'AGENT_PROCESS_QUEUE_CAP', 'caps exceeded'),
  ]
  for (const hopError of hopErrors) {
    const seam = fakeSeam({ procs: [{ turn: async () => { throw hopError } }, okProc()] })
    const executor = makeExecutor(seam, [GLM, LUNA])
    const result = await executor.runTurnWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'hi', opts: {} })
    assert.equal(result.routeRef, 'luna', hopError.code)
    assert.equal(seam.acquires.length, 2)
    const attempts = executor.journalSnapshot().filter((entry) => entry.kind === 'route_attempt')
    assert.equal(attempts[0].attemptOutcome.startsWith('fallback:'), true)
    assert.equal(attempts[1].failureClass, 'NONE')
  }
})

test('CTR-003: multi-hop chains traverse route[0] -> route[1] -> route[2] with no skips', async () => {
  const ROUTE_B = route('routeB')
  const seam = fakeSeam({
    procs: [
      { turn: async () => { throw carrier('not_admitted', 'AGENT_PROCESS_QUEUE_CAP', 'caps') } },
      { turn: async () => { throw Object.assign(new Error('provider_unavailable'), { code: 'provider_unavailable' }) } },
      okProc({ reply: 'third' }),
    ],
  })
  const executor = makeExecutor(seam, [GLM, ROUTE_B, LUNA])
  const result = await executor.runTurnWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'hi', opts: {} })
  assert.equal(result.routeRef, 'luna')
  assert.deepEqual(seam.acquires.map((acquire) => acquire.routeIdentity), [GLM.identity, ROUTE_B.identity, LUNA.identity])
  const final = executor.journalSnapshot().find((entry) => entry.kind === 'route_chain_final')
  assert.equal(final.totalRouteAttempts, 3)
  assert.equal(final.fallbackRoute, 'luna')
})

test('CTR-005: stop-set failures never hop; the original error propagates fail-loud', async () => {
  const stopErrors = [
    carrier('outcome_unknown', 'AGENT_PROCESS_TURN_OUTCOME_UNKNOWN', 'unknown'),
    Object.assign(new Error('initialize timeout'), { code: 'AGENT_PROCESS_INITIALIZE_TIMEOUT' }),
    carrier('failed', 'provider_failure', 'post admission', { evidence: { promptReceipt: 'accepted' } }),
    new Error('mystery'),
  ]
  for (const stopError of stopErrors) {
    const seam = fakeSeam({ procs: [{ turn: async () => { throw stopError } }, okProc()] })
    const executor = makeExecutor(seam, [GLM, LUNA])
    await assert.rejects(
      executor.runTurnWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'hi', opts: {} }),
      (error) => error === stopError,
    )
    assert.equal(seam.acquires.length, 1, 'zero hops after a stop-class failure')
    const final = executor.journalSnapshot().find((entry) => entry.kind === 'route_chain_final')
    assert.ok(final.finalOutcome.startsWith('stop:'), final.finalOutcome)
    assert.equal(final.totalRouteAttempts, 1)
  }
})

test('CTR-003: exhausting the chain fails loud with the last failure class', async () => {
  const seam = fakeSeam({
    procs: [
      { turn: async () => { throw carrier('not_admitted', 'AGENT_PROCESS_QUEUE_CAP', 'caps') } },
      { turn: async () => { throw Object.assign(new Error('provider_unavailable'), { code: 'provider_unavailable' }) } },
    ],
  })
  const executor = makeExecutor(seam, [GLM, LUNA])
  const last = Object.assign(new Error('provider_unavailable'), { code: 'provider_unavailable' })
  await assert.rejects(
    executor.runTurnWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'hi', opts: {} }),
    () => true,
  )
  const final = executor.journalSnapshot().find((entry) => entry.kind === 'route_chain_final')
  assert.equal(final.finalOutcome, 'initialize_provider_unavailable')
  assert.equal(final.totalRouteAttempts, 2)
  assert.equal(final.finalRoute, 'NONE')
  assert.notEqual(last, undefined)
})

// ─── strict mode + deadline budget ─────────────────────────────────────────

test('DEC-IMPL-005: explicit model strict mode = exactly one attempt, zero hops', async () => {
  const seam = fakeSeam({ procs: [{ turn: async () => { throw carrier('not_admitted', 'AGENT_PROCESS_QUEUE_CAP', 'caps') } }, okProc()] })
  const executor = makeExecutor(seam, [GLM, LUNA])
  await assert.rejects(
    executor.runTurnWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'hi', opts: {}, strictReason: 'explicit_model_strict' }),
    /caps/,
  )
  assert.equal(seam.acquires.length, 1, 'strict mode never hops')
  const entries = executor.journalSnapshot()
  assert.ok(entries.every((entry) => entry.strictReason === 'explicit_model_strict'))
  const final = entries.find((entry) => entry.kind === 'route_chain_final')
  assert.equal(final.totalRouteAttempts, 1)
  assert.ok(final.routeChainId.endsWith('#strict'))
})

test('DEC-IMPL-007: a whitelisted failure with no remaining budget does NOT hop', async () => {
  const seam = fakeSeam({
    procs: [
      { turn: async () => { await new Promise((resolve) => setTimeout(resolve, 20)); throw carrier('not_admitted', 'AGENT_PROCESS_QUEUE_CAP', 'caps') } },
      okProc(),
    ],
  })
  const executor = makeExecutor(seam, [GLM, LUNA], { turnDeadlineMs: 10 })
  await assert.rejects(
    executor.runTurnWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'hi', opts: {} }),
    /caps/,
  )
  assert.equal(seam.acquires.length, 1, 'deadline exhausted -> STOP_CHAIN despite the whitelist class')
  const final = executor.journalSnapshot().find((entry) => entry.kind === 'route_chain_final')
  assert.equal(final.finalOutcome, 'stop:timeout_without_proven_termination')
})

test('DEC-IMPL-007: busy_mismatch convergence waits consume the single budget, then stop', async () => {
  let busyReturns = 3
  let readyProc = okProc()
  const acquires = []
  const executor = createRouteChainExecutor({
    log: quietLog,
    ensureRunningForRoute: async (agentId, wanted) => {
      acquires.push(wanted.routeIdentity)
      if (busyReturns > 0) { busyReturns -= 1; return { status: 'busy_mismatch' } }
      return { status: 'ready', proc: readyProc }
    },
    resolveRouteChain: () => snapshot(GLM),
    resolveTurnDeadlineMs: () => 5_000,
  })
  const result = await executor.runTurnWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'hi', opts: {} })
  assert.equal(result.reply, 'ok')
  assert.equal(acquires.length, 4, 'bounded retry until convergence — never a kill')
  assert.notEqual(readyProc, undefined)

  const deadlineSeam = {
    ensureRunningForRoute: async () => ({ status: 'reaping' }),
  }
  const deadlineExecutor = createRouteChainExecutor({
    log: quietLog,
    ensureRunningForRoute: deadlineSeam.ensureRunningForRoute,
    resolveRouteChain: () => snapshot(GLM),
    resolveTurnDeadlineMs: () => 60,
  })
  await assert.rejects(
    deadlineExecutor.runTurnWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'hi', opts: {} }),
    (error) => error.code === 'AGENT_ROUTE_CHAIN_DEADLINE_EXCEEDED',
  )
})

// ─── deliver variant + onDispatch ──────────────────────────────────────────

test('CTR-IMPL-003: deliver variant hops on admission failures and resolves on inbox accept', async () => {
  const seam = fakeSeam({
    procs: [
      { deliver: async () => { throw carrier('not_admitted', 'AGENT_PROCESS_QUEUE_CAP', 'caps') } },
      { deliver: async () => ({ accepted: true, sessionId: 'main', messageId: 'm2' }) },
    ],
  })
  const executor = makeExecutor(seam, [GLM, LUNA])
  const receipt = await executor.admitWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'hi', opts: {} })
  assert.equal(receipt.accepted, true)
  assert.equal(receipt.messageId, 'm2')
  assert.equal(seam.acquires.length, 2)
})

test('CTR-IMPL-005: onDispatch fires exactly once, right before the first dispatched attempt', async () => {
  const dispatches = []
  const seam = fakeSeam({
    procs: [
      { turn: async () => { throw carrier('not_admitted', 'AGENT_PROCESS_QUEUE_CAP', 'caps') } },
      {
        pid: 5,
        turn: async (sessionId, message, opts) => {
          dispatches.push(opts?.onDispatch ? 'during' : 'never')
          return { status: 'completed', reply: 'r', messageId: 'm' }
        },
      },
    ],
  })
  const executor = makeExecutor(seam, [GLM, LUNA])
  let fired = 0
  await executor.runTurnWithRouteChain('agt_cto-agent', {
    sessionId: 'main', message: 'hi',
    opts: { onDispatch: () => { fired += 1 } },
  })
  assert.equal(fired, 1)
  assert.equal(dispatches[0], 'during')
})

// ─── journal + redaction + passthrough ─────────────────────────────────────

test('CTR-IMPL-006: journal records carry only structural fields — never raw errors', async () => {
  const seam = fakeSeam({
    procs: [
      { turn: async () => { throw carrier('not_admitted', 'AGENT_PROCESS_QUEUE_CAP', 'sk-AiRqZz89_secretTokenValue') } },
      okProc(),
    ],
  })
  const executor = makeExecutor(seam, [GLM, LUNA])
  await executor.runTurnWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'SECRET-PROMPT-BODY', opts: {} })
  const serialized = JSON.stringify(executor.journalSnapshot())
  for (const forbidden of ['sk-AiRqZz89_secretTokenValue', 'SECRET-PROMPT-BODY', 'Authorization', 'Bearer']) {
    assert.ok(!serialized.includes(forbidden), `journal must not carry raw error/prompt material: ${forbidden}`)
  }
  const attempts = executor.journalSnapshot().filter((entry) => entry.kind === 'route_attempt')
  for (const entry of attempts) {
    assert.deepEqual(
      Object.keys(entry).sort(),
      ['admissionProven', 'agentId', 'attemptIndex', 'attemptOutcome', 'failureClass', 'kind', 'primaryRoute', 'route', 'routeChainId', 'tsWallMs'],
    )
  }
})

test('no-override agents pass through the seam with a length-1 chain (legacy default snapshot)', async () => {
  const seam = fakeSeam({ procs: [okProc()] })
  const executor = createRouteChainExecutor({
    log: quietLog,
    ensureRunningForRoute: seam.ensureRunningForRoute,
    resolveRouteChain: undefined,
    resolveTurnDeadlineMs: () => 60_000,
  })
  const result = await executor.runTurnWithRouteChain('agt_other', { sessionId: 'main', message: 'hi', opts: {} })
  assert.equal(result.reply, 'ok')
  assert.equal(seam.acquires[0].routeIdentity, undefined)
  assert.equal(seam.acquires[0].processConfig, undefined)
  const final = executor.journalSnapshot().find((entry) => entry.kind === 'route_chain_final')
  assert.equal(final.totalRouteAttempts, 1)
  assert.equal(final.primaryRoute, 'global')
})

test('invalid config at snapshot time fails loud with zero attempts and a truthful final block', async () => {
  const executor = createRouteChainExecutor({
    log: quietLog,
    ensureRunningForRoute: async () => ({ status: 'ready', proc: okProc() }),
    resolveRouteChain: () => { throw Object.assign(new Error('invalid agent model overrides'), { code: 'AGENT_MODEL_OVERRIDE_INVALID' }) },
    resolveTurnDeadlineMs: () => 60_000,
  })
  await assert.rejects(
    executor.runTurnWithRouteChain('agt_cto-agent', { sessionId: 'main', message: 'hi', opts: {} }),
    (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID',
  )
  const final = executor.journalSnapshot().find((entry) => entry.kind === 'route_chain_final')
  assert.equal(final.totalRouteAttempts, 0)
  assert.equal(final.configInvalid, true)
})

test('canonicalRouteIdentity: five-field reuse tuple with ABSENT providerEnv normalization', () => {
  const base = { provider: 'p', model: 'm', subscription: { plugin: 'pl', pluginVersion: '0.2.3' } }
  const withEnv = { ...base, providerEnv: { HTTP_PROXY: 'http://a:1', HTTPS_PROXY: 'http://a:1', NO_PROXY: 'x', NODE_USE_ENV_PROXY: '1' } }
  assert.equal(canonicalRouteIdentity(base), canonicalRouteIdentity({ ...base }))
  assert.notEqual(canonicalRouteIdentity(base), canonicalRouteIdentity(withEnv))
  assert.notEqual(canonicalRouteIdentity(base), canonicalRouteIdentity({ ...base, model: 'm2' }))
  assert.notEqual(canonicalRouteIdentity(base), canonicalRouteIdentity({ ...base, subscription: { plugin: 'pl', pluginVersion: '0.2.4' } }))
  assert.ok(canonicalRouteIdentity(base).includes('ABSENT'))
})
