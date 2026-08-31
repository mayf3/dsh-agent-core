/**
 * IMPL V2 CTR-I2-015 canary seam suite: disabled/absent zero-effect,
 * exact-binding consume (agent+route+channel+authenticated sender+whole
 * marker), every mismatch family, expiry, the <=5min ceiling, schema
 * fail-loud matrix (extra/duplicate/type, nonce grammar, maxUses), metadata
 * drift, one-shot race (exactly one rename winner), crash-after-rename,
 * nonce collision, other-Agent isolation, quota-mode flow (acquire/dispatch
 * boundary -> fixed terminal 429 -> hop luna -> success) with exact observer
 * counts, outcome_unknown pre-acquire STOP, duplicate Luna call = NO, and
 * journal/observer redaction. Never contacts a real provider, never touches
 * credentials; descriptors follow the install contract (temp write + 0600 +
 * atomic rename) in an isolated temp root.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  canonicalRouteIdentity,
  createRouteChainExecutor,
  ROUTE_HOP_FAILURE_CLASSES,
  ROUTE_STOP_REASONS,
  CANARY_DESCRIPTOR_FILENAME,
} from '../../src/route-chain.js'

const AGENT = 'agt_cto-agent'
const NONCE = 'canary-nonce-abcdefghijklmnop'
const SENDER = 'ou_owner-authenticated-sender-id'
const MARKER = 'CANARY-B exact terminal quota prompt'

function makeLog() {
  const lines = []
  return { lines, log(line) { lines.push(String(line)) }, warn() {}, error() {} }
}

function snapshot(...routes) {
  return Object.freeze({
    agentId: AGENT,
    override: true,
    chainId: 'chain-test',
    routes: Object.freeze(routes.map((route) => Object.freeze(route))),
  })
}

function route(routeRef, processConfig) {
  const config = processConfig ?? { provider: routeRef, model: `m-${routeRef}` }
  return Object.freeze({
    routeRef,
    provider: config.provider,
    model: config.model,
    identity: canonicalRouteIdentity(config),
    processConfig: Object.freeze(config),
  })
}

const GLM = route('glm53', { provider: 'zai', model: 'glm-5.3', subscription: { plugin: 'dsh-zai', pluginVersion: '1.4.2' } })
const LUNA = route('luna', { provider: 'openai-codex', model: 'gpt-5.6-luna', subscription: { plugin: 'dsh-codex', pluginVersion: '0.2.3' } })

function feishuIngressOpts({ sender = SENDER, namespace = 'feishu' } = {}) {
  return { ingressContext: Object.freeze({ channelNamespace: namespace, feishuSenderOpenId: sender }) }
}

/** Identity-keyed registry seam: each DISTINCT route identity maps to the
 * next proc (race-safe — concurrent same-route turns hit the same proc). */
function fakeSeam({ procs = [] } = {}) {
  const acquires = []
  const byIdentity = new Map()
  let next = 0
  return {
    acquires,
    ensureRunningForRoute: async (agentId, wanted) => {
      acquires.push(wanted.routeIdentity)
      if (!byIdentity.has(wanted.routeIdentity)) {
        byIdentity.set(wanted.routeIdentity, procs[next])
        next += 1
      }
      const proc = byIdentity.get(wanted.routeIdentity)
      if (proc === undefined) throw new Error(`no fake proc for route identity ${wanted.routeIdentity}`)
      return { status: 'ready', proc }
    },
  }
}

function plainProc({ reply = 'ok' } = {}) {
  return {
    pid: 111,
    turn: async () => ({ status: 'completed', reply, messageId: 'm', evidence: { promptReceipt: 'accepted' } }),
    deliver: async () => ({ accepted: true, sessionId: 'main', messageId: 'm' }),
  }
}

function lunaCountingProc() {
  const calls = []
  return {
    calls,
    pid: 222,
    turn: async () => {
      calls.push(1)
      return { status: 'completed', reply: 'luna-ok', messageId: 'm', evidence: { promptReceipt: 'accepted' } }
    },
    deliver: async () => ({ accepted: true, sessionId: 'main', messageId: 'm' }),
  }
}

function makeExecutor({ runtimeRoot, log, procs, routes = [GLM, LUNA] }) {
  const seam = fakeSeam({ procs })
  const executor = createRouteChainExecutor({
    log,
    ensureRunningForRoute: seam.ensureRunningForRoute,
    resolveRouteChain: () => snapshot(...routes),
    resolveTurnDeadlineMs: () => 10_000,
    ...(runtimeRoot === undefined ? {} : { canaryRuntimeRoot: runtimeRoot }),
  })
  return { executor, seam }
}

/** Isolated runtime root; install() = temp write + 0600 + atomic rename. */
function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'route-chain-canary-'))
  const descriptorPath = join(root, CANARY_DESCRIPTOR_FILENAME)
  return {
    root,
    descriptorPath,
    usedPathFor: (nonce) => join(root, `route-chain-canary-injection.used.${nonce}`),
    install(descriptor, { source, mode = 0o600 } = {}) {
      const tmp = join(root, `.tmp-canary-${Math.random().toString(36).slice(2)}`)
      writeFileSync(tmp, source ?? JSON.stringify(descriptor), { flag: 'wx' })
      chmodSync(tmp, mode)
      renameSync(tmp, descriptorPath)
    },
    cleanup() { rmSync(root, { recursive: true, force: true }) },
  }
}

const canonicalExpiresAt = (msFromNow) => new Date(Date.now() + msFromNow).toISOString().replace(/\.\d{3}Z$/u, 'Z')

function validDescriptor(overrides = {}) {
  return {
    version: 1,
    agentId: AGENT,
    routeRef: 'glm53',
    mode: 'provider_quota_rejected_before_generation',
    nonce: NONCE,
    expiresAt: canonicalExpiresAt(4 * 60_000),
    maxUses: 1,
    binding: { channel: 'feishu', senderOpenId: SENDER, marker: MARKER },
    ...overrides,
  }
}

const turnArgs = (opts) => ({ sessionId: 'main', message: MARKER, opts })

test('default off: no canaryRuntimeRoot => zero filesystem effect, normal turn', async () => {
  const log = makeLog()
  const { executor, seam } = makeExecutor({ log, procs: [plainProc()] })
  const result = await executor.runTurnWithRouteChain(AGENT, turnArgs(feishuIngressOpts()))
  assert.equal(result.reply, 'ok')
  assert.equal(result.canaryNonce, undefined)
  assert.equal(seam.acquires.length, 1)
})

test('absent descriptor is the ordinary fast path (no injection, no marker)', async () => {
  const box = makeRoot()
  try {
    const log = makeLog()
    const { executor, seam } = makeExecutor({ runtimeRoot: box.root, log, procs: [plainProc()] })
    const result = await executor.runTurnWithRouteChain(AGENT, turnArgs(feishuIngressOpts()))
    assert.equal(result.reply, 'ok')
    assert.equal(existsSync(box.descriptorPath), false)
    assert.equal(seam.acquires.length, 1)
  } finally { box.cleanup() }
})

test('quota mode: acquire/dispatch boundary crossed, fixed terminal 429, hop luna, exact counts', async () => {
  const box = makeRoot()
  try {
    box.install(validDescriptor())
    const log = makeLog()
    const glm = plainProc({ reply: 'glm-must-not-run' })
    const luna = lunaCountingProc()
    const onDispatch = []
    const { executor, seam } = makeExecutor({ runtimeRoot: box.root, log, procs: [glm, luna] })
    const opts = { ...feishuIngressOpts(), onDispatch: () => onDispatch.push(1) }
    const result = await executor.runTurnWithRouteChain(AGENT, turnArgs(opts))
    // The fixture never invoked the real glm model turn:
    assert.equal(result.reply, 'luna-ok')
    assert.equal(result.canaryNonce, NONCE)
    assert.equal(luna.calls.length, 1, 'LUNA_MODEL_CALL_COUNT = 1, no duplicate')
    assert.equal(onDispatch.length, 1, 'caller onDispatch fired exactly once')
    // Exactly one glm acquire (the normal attempt boundary), one luna acquire:
    assert.equal(seam.acquires.length, 2)
    // Journal: TOTAL=2, fallback=true, FINAL_ROUTE=luna, exact new class.
    const journal = executor.journalSnapshot()
    const final = journal.find((entry) => entry.kind === 'route_chain_final')
    assert.equal(final.finalOutcome, 'SUCCESS')
    assert.equal(final.finalRoute, 'luna')
    assert.equal(final.totalRouteAttempts, 2)
    assert.equal(final.fallbackActivated, true)
    const quotaAttempt = journal.filter((entry) => entry.kind === 'route_attempt')[0]
    assert.equal(quotaAttempt.failureClass, ROUTE_HOP_FAILURE_CLASSES.PROVIDER_QUOTA_REJECTED_BEFORE_GENERATION)
    assert.equal(quotaAttempt.admissionProven, 'provider_request_sent_generation_not_started')
    assert.equal(quotaAttempt.attemptOutcome, `fallback:${ROUTE_HOP_FAILURE_CLASSES.PROVIDER_QUOTA_REJECTED_BEFORE_GENERATION}`)
    // One-shot consume: descriptor renamed to the exact used marker.
    assert.equal(existsSync(box.descriptorPath), false)
    assert.equal(existsSync(box.usedPathFor(NONCE)), true)
    // Observer: injectionConsume=1, providerDispatch=2, modelCallStart=1
    // (the fixture attempt starts no model call), retry=0, onStart=1,
    // onDispatch=1, transcript=1; external delivery is a separate line.
    const observerLine = log.lines.find((line) => line.startsWith('route-chain-canary-observer '))
    assert.ok(observerLine !== undefined, 'observer line emitted')
    const observer = JSON.parse(observerLine.slice('route-chain-canary-observer '.length))
    assert.equal(observer.nonce, NONCE)
    assert.equal(observer.injectionConsumeCount, 1)
    assert.equal(observer.providerDispatchCount, 2)
    assert.equal(observer.modelCallStartCount, 1)
    assert.equal(observer.providerRetryCount, 0)
    assert.equal(observer.onStartCount, 1)
    assert.equal(observer.onDispatchCount, 1)
    assert.equal(observer.transcriptCount, 1)
    assert.equal(observer.terminalOutcome, 'success')
    executor.noteCanaryExternalDelivery(NONCE)
    const deliveryLine = log.lines.find((line) => line.startsWith('route-chain-canary-delivery '))
    assert.ok(deliveryLine !== undefined, 'delivery observer line emitted')
    assert.deepEqual(JSON.parse(deliveryLine.slice('route-chain-canary-delivery '.length)), {
      nonce: NONCE, externalDeliveryCount: 1,
    })
    // Redaction: no prompt/marker/sender anywhere in journal or observer lines.
    const allEvidence = `${JSON.stringify(executor.journalSnapshot())}\n${log.lines.join('\n')}`
    assert.equal(allEvidence.includes(MARKER), false)
    assert.equal(allEvidence.includes(SENDER), false)
  } finally { box.cleanup() }
})

test('quota mode on a length-1 chain: fixture 429 stays terminal (no next route)', async () => {
  const box = makeRoot()
  try {
    box.install(validDescriptor())
    const log = makeLog()
    const { executor, seam } = makeExecutor({ runtimeRoot: box.root, log, procs: [plainProc()], routes: [GLM] })
    await assert.rejects(
      executor.runTurnWithRouteChain(AGENT, turnArgs(feishuIngressOpts())),
      (error) => error.canaryNonce === NONCE,
    )
    const final = executor.journalSnapshot().find((entry) => entry.kind === 'route_chain_final')
    assert.equal(final.finalOutcome, ROUTE_HOP_FAILURE_CLASSES.PROVIDER_QUOTA_REJECTED_BEFORE_GENERATION)
    assert.equal(final.totalRouteAttempts, 1)
    assert.equal(seam.acquires.length, 1)
  } finally { box.cleanup() }
})

test('outcome_unknown mode: STOP before acquire — zero acquires, no generation', async () => {
  const box = makeRoot()
  try {
    box.install(validDescriptor({ mode: 'outcome_unknown' }))
    const log = makeLog()
    const { executor, seam } = makeExecutor({ runtimeRoot: box.root, log, procs: [plainProc(), lunaCountingProc()] })
    await assert.rejects(
      executor.runTurnWithRouteChain(AGENT, turnArgs(feishuIngressOpts())),
      (error) => error.envelope === 'outcome_unknown' && error.canaryNonce === NONCE,
    )
    // CANARY-C: process acquire=0, no new generation, dispatch=0.
    assert.equal(seam.acquires.length, 0)
    const journal = executor.journalSnapshot()
    const final = journal.find((entry) => entry.kind === 'route_chain_final')
    assert.equal(final.finalOutcome, `stop:${ROUTE_STOP_REASONS.OUTCOME_UNKNOWN}`)
    assert.equal(final.totalRouteAttempts, 1)
    assert.equal(final.finalRoute, 'NONE')
    const observerLine = log.lines.find((line) => line.startsWith('route-chain-canary-observer '))
    const observer = JSON.parse(observerLine.slice('route-chain-canary-observer '.length))
    assert.equal(observer.providerDispatchCount, 0)
    assert.equal(observer.onDispatchCount, 0)
    assert.equal(observer.onStartCount, 0)
    assert.equal(observer.modelCallStartCount, 0)
    assert.equal(observer.transcriptCount, 1, 'one failure receipt')
    assert.equal(existsSync(box.usedPathFor(NONCE)), true)
    // CANARY-C delivery note: exactly one failure-receipt delivery.
    executor.noteCanaryExternalDelivery(NONCE)
    assert.equal(log.lines.filter((line) => line.startsWith('route-chain-canary-delivery ')).length, 1)
  } finally { box.cleanup() }
})

test('binding mismatches: wrong agent / route / channel / sender / partial marker / no ingress', async () => {
  const box = makeRoot()
  try {
    const cases = [
      { name: 'wrong agent', descriptor: validDescriptor({ agentId: 'agt_other-agent' }), args: [AGENT, turnArgs(feishuIngressOpts())] },
      { name: 'wrong routeRef', descriptor: validDescriptor({ routeRef: 'luna' }), args: [AGENT, turnArgs(feishuIngressOpts())] },
      { name: 'wrong channel', descriptor: validDescriptor(), args: [AGENT, { sessionId: 'main', message: MARKER, opts: feishuIngressOpts({ namespace: 'mobile' }) }] },
      { name: 'wrong sender', descriptor: validDescriptor(), args: [AGENT, turnArgs(feishuIngressOpts({ sender: 'ou_someone-else' }))] },
      { name: 'no ingress context (scheduler/deliver shape)', descriptor: validDescriptor(), args: [AGENT, { sessionId: 'main', message: MARKER, opts: {} }] },
      { name: 'marker prefix only (not the whole prompt)', descriptor: validDescriptor(), args: [AGENT, { sessionId: 'main', message: `prefix ${MARKER}`, opts: feishuIngressOpts() }] },
      { name: 'marker suffix only', descriptor: validDescriptor(), args: [AGENT, { sessionId: 'main', message: `${MARKER} suffix`, opts: feishuIngressOpts() }] },
    ]
    for (const { name, descriptor, args } of cases) {
      box.install(descriptor)
      const log = makeLog()
      const { executor, seam } = makeExecutor({ runtimeRoot: box.root, log, procs: [plainProc()] })
      const result = await executor.runTurnWithRouteChain(...args)
      assert.equal(result.reply, 'ok', name)
      assert.equal(result.canaryNonce, undefined, name)
      assert.equal(seam.acquires.length, 1, name)
      // Descriptor untouched (unconsumed) and no used marker.
      assert.equal(existsSync(box.descriptorPath), true, name)
      assert.equal(existsSync(box.usedPathFor(descriptor.nonce)), false, name)
      assert.equal(log.lines.some((line) => line.startsWith('route-chain-canary-observer ')), false, name)
      rmSync(box.descriptorPath)
    }
  } finally { box.cleanup() }
})

test('other-Agent isolation: a matching descriptor never affects another agent turn', async () => {
  const box = makeRoot()
  try {
    box.install(validDescriptor())
    const log = makeLog()
    const { executor, seam } = makeExecutor({ runtimeRoot: box.root, log, procs: [plainProc()] })
    const result = await executor.runTurnWithRouteChain('agt_other-agent', {
      sessionId: 'main',
      message: MARKER,
      opts: feishuIngressOpts(),
    })
    assert.equal(result.reply, 'ok')
    assert.equal(existsSync(box.descriptorPath), true)
    assert.equal(seam.acquires.length, 1)
  } finally { box.cleanup() }
})

test('expired descriptor: no injection, not consumed, ordinary turn', async () => {
  const box = makeRoot()
  try {
    const descriptor = validDescriptor({ expiresAt: canonicalExpiresAt(-60_000) })
    box.install(descriptor)
    const log = makeLog()
    const { executor, seam } = makeExecutor({ runtimeRoot: box.root, log, procs: [plainProc()] })
    const result = await executor.runTurnWithRouteChain(AGENT, turnArgs(feishuIngressOpts()))
    assert.equal(result.reply, 'ok')
    assert.equal(existsSync(box.descriptorPath), true, 'expired descriptor left for the operator')
    assert.equal(existsSync(box.usedPathFor(NONCE)), false)
    assert.equal(seam.acquires.length, 1)
  } finally { box.cleanup() }
})

test('malformed descriptors fail loud with zero attempts', async () => {
  const box = makeRoot()
  try {
    const malformed = [
      { name: 'extra top-level key', descriptor: { ...validDescriptor(), extra: 1 } },
      { name: 'extra binding key', descriptor: validDescriptor({ binding: { ...validDescriptor().binding, extra: 1 } }) },
      {
        name: 'duplicate JSON key',
        source: '{"version":1,"version":1,"agentId":"agt_cto-agent","routeRef":"glm53","mode":"provider_quota_rejected_before_generation","nonce":"canary-nonce-abcdefghijklmnop","expiresAt":"2999-01-01T00:00:00Z","maxUses":1,"binding":{"channel":"feishu","senderOpenId":"ou_x","marker":"m"}}',
      },
      { name: 'wrong version', descriptor: validDescriptor({ version: 2 }) },
      { name: 'unknown mode', descriptor: validDescriptor({ mode: 'spawn_failure' }) },
      { name: 'bad nonce grammar (dot)', descriptor: validDescriptor({ nonce: 'canary.nonce.bad' }) },
      { name: 'bad nonce grammar (short)', descriptor: validDescriptor({ nonce: 'short' }) },
      { name: 'nonce with slash (path traversal)', descriptor: validDescriptor({ nonce: 'canary-nonce-../../etc' }) },
      { name: 'maxUses 2', descriptor: validDescriptor({ maxUses: 2 }) },
      { name: 'non-canonical expiresAt (milliseconds)', descriptor: validDescriptor({ expiresAt: new Date(Date.now() + 60_000).toISOString() }) },
      { name: 'creation ceiling exceeded (>5min)', descriptor: validDescriptor({ expiresAt: canonicalExpiresAt(10 * 60_000) }) },
      { name: 'marker exceeds 128 bytes', descriptor: validDescriptor({ binding: { channel: 'feishu', senderOpenId: SENDER, marker: 'x'.repeat(129) } }) },
      { name: 'empty marker', descriptor: validDescriptor({ binding: { channel: 'feishu', senderOpenId: SENDER, marker: '' } }) },
      { name: 'sender exceeds 256 chars', descriptor: validDescriptor({ binding: { channel: 'feishu', senderOpenId: 'o'.repeat(257), marker: MARKER } }) },
      { name: 'non-feishu channel', descriptor: validDescriptor({ binding: { channel: 'mobile', senderOpenId: SENDER, marker: MARKER } }) },
    ]
    for (const { name, descriptor, source } of malformed) {
      box.install(descriptor ?? {}, { source })
      const log = makeLog()
      const { executor, seam } = makeExecutor({ runtimeRoot: box.root, log, procs: [plainProc()] })
      await assert.rejects(
        executor.runTurnWithRouteChain(AGENT, turnArgs(feishuIngressOpts())),
        (error) => error.code === 'AGENT_ROUTE_CHAIN_CANARY_DESCRIPTOR_INVALID',
        name,
      )
      assert.equal(seam.acquires.length, 0, name)
      assert.equal(executor.journalSnapshot().length, 0, name)
      rmSync(box.descriptorPath)
    }
  } finally { box.cleanup() }
})

test('metadata drift (wrong mode bits) fails loud', async () => {
  const box = makeRoot()
  try {
    box.install(validDescriptor(), { mode: 0o644 })
    const log = makeLog()
    const { executor, seam } = makeExecutor({ runtimeRoot: box.root, log, procs: [plainProc()] })
    await assert.rejects(
      executor.runTurnWithRouteChain(AGENT, turnArgs(feishuIngressOpts())),
      (error) => error.code === 'AGENT_ROUTE_CHAIN_CANARY_DESCRIPTOR_INVALID',
    )
    assert.equal(seam.acquires.length, 0)
    rmSync(box.descriptorPath)
  } finally { box.cleanup() }
})

test('one-shot race: exactly one of two concurrent matching turns gets the injection', async () => {
  const box = makeRoot()
  try {
    box.install(validDescriptor())
    const log = makeLog()
    const glm = plainProc({ reply: 'glm-normal' })
    const luna = lunaCountingProc()
    const { executor, seam } = makeExecutor({ runtimeRoot: box.root, log, procs: [glm, luna] })
    const results = await Promise.all([
      executor.runTurnWithRouteChain(AGENT, turnArgs(feishuIngressOpts())),
      executor.runTurnWithRouteChain(AGENT, turnArgs(feishuIngressOpts())),
    ])
    const withNonce = results.filter((result) => result.canaryNonce !== undefined)
    assert.equal(withNonce.length, 1)
    assert.equal(withNonce[0].reply, 'luna-ok')
    const withoutNonce = results.filter((result) => result.canaryNonce === undefined)
    assert.equal(withoutNonce.length, 1)
    assert.equal(withoutNonce[0].reply, 'glm-normal')
    // Two glm acquires (both turns cross the boundary; only the winner's
    // attempt is fixture-injected) + exactly one luna acquire.
    const [primaryIdentity] = seam.acquires
    assert.equal(seam.acquires.filter((identity) => identity === primaryIdentity).length, 2)
    assert.equal(seam.acquires.filter((identity) => identity !== primaryIdentity).length, 1)
    assert.equal(luna.calls.length, 1)
    assert.equal(existsSync(box.descriptorPath), false)
    assert.equal(existsSync(box.usedPathFor(NONCE)), true)
    assert.equal(log.lines.filter((line) => line.startsWith('route-chain-canary-observer ')).length, 1)
  } finally { box.cleanup() }
})

test('crash after rename: used marker alone never re-consumes; ordinary turn', async () => {
  const box = makeRoot()
  try {
    // Post-rename crash state: descriptor already consumed, used marker left.
    mkdirSync(box.root, { recursive: true })
    writeFileSync(box.usedPathFor(NONCE), '{}', { mode: 0o600 })
    const log = makeLog()
    const { executor, seam } = makeExecutor({ runtimeRoot: box.root, log, procs: [plainProc()] })
    const result = await executor.runTurnWithRouteChain(AGENT, turnArgs(feishuIngressOpts()))
    assert.equal(result.reply, 'ok')
    assert.equal(result.canaryNonce, undefined)
    assert.equal(seam.acquires.length, 1)
    assert.equal(existsSync(box.descriptorPath), false)
  } finally { box.cleanup() }
})

test('nonce collision: new descriptor whose used marker already exists fails loud', async () => {
  const box = makeRoot()
  try {
    writeFileSync(box.usedPathFor(NONCE), '{}', { mode: 0o600 })
    box.install(validDescriptor())
    const log = makeLog()
    const { executor, seam } = makeExecutor({ runtimeRoot: box.root, log, procs: [plainProc()] })
    await assert.rejects(
      executor.runTurnWithRouteChain(AGENT, turnArgs(feishuIngressOpts())),
      (error) => error.code === 'AGENT_ROUTE_CHAIN_CANARY_DESCRIPTOR_INVALID',
    )
    assert.equal(seam.acquires.length, 0)
    assert.equal(existsSync(box.descriptorPath), true, 'collision never overwrites')
  } finally { box.cleanup() }
})

test('admission (deliver) entries never match the canary binding', async () => {
  const box = makeRoot()
  try {
    box.install(validDescriptor())
    const log = makeLog()
    const { executor, seam } = makeExecutor({ runtimeRoot: box.root, log, procs: [plainProc()] })
    const receipt = await executor.admitWithRouteChain(AGENT, { sessionId: 'main', message: MARKER, opts: {} })
    assert.equal(receipt.accepted, true)
    assert.equal(existsSync(box.descriptorPath), true, 'descriptor untouched')
    assert.equal(seam.acquires.length, 1)
  } finally { box.cleanup() }
})

test('after clear (descriptor + used marker absent) the seam is inert', async () => {
  const box = makeRoot()
  try {
    box.install(validDescriptor())
    const first = makeExecutor({ runtimeRoot: box.root, log: makeLog(), procs: [plainProc(), lunaCountingProc()] })
    await first.executor.runTurnWithRouteChain(AGENT, turnArgs(feishuIngressOpts()))
    assert.equal(existsSync(box.descriptorPath), false)
    // Operator clear: unlink the used marker too.
    rmSync(box.usedPathFor(NONCE))
    const second = makeExecutor({ runtimeRoot: box.root, log: makeLog(), procs: [plainProc()] })
    const result = await second.executor.runTurnWithRouteChain(AGENT, turnArgs(feishuIngressOpts()))
    assert.equal(result.reply, 'ok')
    assert.equal(result.canaryNonce, undefined)
  } finally { box.cleanup() }
})
