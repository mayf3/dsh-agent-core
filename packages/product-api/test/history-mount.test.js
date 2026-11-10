/** CTR-ARR-002: exercise the production ctx.effect and asynchronous mount boundary. */
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { generateKeyPairSync, sign } from 'node:crypto'
import { test } from 'node:test'
import { mountOptionalHistory } from '../src/history-mount.js'
import { startHistoryListener } from '../src/history-listener.js'
import { createWorkflowAdmissionHandler } from '../src/workflow-admission.js'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function fixture({ startError, profileReady = true, throwingLog = false } = {}) {
  const disposers = []
  const events = []
  const logs = []
  const errors = []
  const starts = []
  const profile = Object.freeze({ ready: profileReady, generation: 'frozen-profile-generation' })
  const server = new EventEmitter()
  server.listening = false
  // A caller bypassing listener.close would fail immediately.
  server.close = () => { throw new Error('teardown must use listener.close') }
  server.closeAllConnections = () => { throw new Error('teardown must use listener.close') }
  const listener = {
    server,
    closeCalls: 0,
    close() { this.closeCalls += 1; events.push('listener-close'); return Promise.resolve() },
  }
  const ctx = {
    effect(fn) { events.push('effect-registered'); disposers.push(fn()) },
    async dispose() { for (const dispose of disposers.splice(0)) await dispose() },
  }
  const options = {
    historyConfig: { enabled: true, host: '100.64.0.8', port: 8788, authConfigFile: '/fixture/auth.json' },
    workspaceBootstrap: { resolveWorkspace: () => '/fixture/workspace', resolveDshHome: () => '/fixture/home' },
    router: Object.freeze({ sentinel: 'router' }),
    definition: Object.freeze({ sentinel: 'definition' }),
    channel: 'mobile',
    log: {
      log(text) { logs.push(text); if (throwingLog) throw new Error('log sink failed') },
      error(text) { errors.push(text); if (throwingLog) throw new Error('error sink failed') },
    },
  }
  const service = Object.freeze({ listMessages() {} })
  const resolver = async () => ({ ok: false })
  const modules = [
    { createSessionHistoryService(input) {
      events.push('service-created')
      assert.equal(input.router, options.router)
      assert.equal(input.definition, options.definition)
      assert.equal(input.channel, 'mobile')
      return service
    } },
    { startHistoryListener(input) {
      starts.push(input)
      events.push('listener-started')
      if (startError) throw startError
      return listener
    } },
    {
      loadAuthConfigProfile: () => profile,
      createWhoIsResolver: () => resolver,
      createNodeHttpWhoIsTransport: () => ({}),
    },
  ]
  return { ctx, options, modules, events, logs, errors, starts, profile, service, resolver, server, listener }
}

function errorWithSecret() {
  return Object.assign(new Error('token=private-token profile=private-profile /private/auth.json'), { code: 'EIO' })
}

test('production effect is registered synchronously; disposal before imports prevents later mount', async () => {
  const fx = fixture()
  const load = deferred()
  const mounting = mountOptionalHistory(fx.ctx, fx.options, () => {
    fx.events.push('loader-called')
    return load.promise
  })
  assert.ok(fx.events.includes('effect-registered'), 'teardown must exist before module resolution')
  await Promise.resolve()
  assert.ok(fx.events.includes('loader-called'), 'exercise disposal during an actual pending load')
  await fx.ctx.dispose()
  load.resolve(fx.modules)
  await mounting
  assert.equal(fx.starts.length, 0)
  assert.equal(fx.events.includes('service-created'), false)
  assert.equal(fx.listener.closeCalls, 0)
})

test('production effect uses listener.close after mount and preserves mount endpoint/profile', async () => {
  const fx = fixture()
  await mountOptionalHistory(fx.ctx, fx.options, async () => fx.modules)
  assert.equal(fx.starts.length, 1)
  assert.equal(fx.starts[0].host, '100.64.0.8')
  assert.equal(fx.starts[0].port, 8788)
  assert.equal(fx.starts[0].profile, fx.profile)
  assert.equal(fx.starts[0].sessionHistory, fx.service)
  assert.equal(fx.starts[0].resolveStableNodeId, fx.resolver)
  await fx.ctx.dispose()
  assert.equal(fx.listener.closeCalls, 1)
  assert.deepEqual(fx.events.slice(-1), ['listener-close'])
})

test('mount attempts do not claim listening before the actual event', async () => {
  const fx = fixture()
  await mountOptionalHistory(fx.ctx, fx.options, async () => fx.modules)
  assert.equal(fx.logs.some((line) => /listening/i.test(line)), false)
  fx.server.listening = true
  fx.server.emit('listening')
  assert.equal(fx.logs.filter((line) => /listening/i.test(line)).length, 1)
  await fx.ctx.dispose()
})

test('late listening after disposal cannot advertise success', async () => {
  const fx = fixture()
  await mountOptionalHistory(fx.ctx, fx.options, async () => fx.modules)
  await fx.ctx.dispose()
  fx.server.emit('listening')
  assert.equal(fx.logs.some((line) => /listening/i.test(line)), false)
})

test('synchronous listener creation errors stay inside the optional mount', async () => {
  const fx = fixture({ startError: errorWithSecret() })
  await assert.doesNotReject(async () => mountOptionalHistory(fx.ctx, fx.options, async () => fx.modules))
  assert.equal(fx.starts.length, 1)
  assert.ok(fx.errors.length > 0)
  assert.equal(/private-token|private-profile|\/private\/auth/.test(fx.errors.join('\n')), false)
  await fx.ctx.dispose()
})

test('rejected module loader stays inside optional mount and diagnostics omit raw secrets', async () => {
  const fx = fixture()
  await assert.doesNotReject(async () => mountOptionalHistory(fx.ctx, fx.options, async () => { throw errorWithSecret() }))
  assert.equal(fx.starts.length, 0)
  assert.ok(fx.errors.length > 0)
  assert.equal(/private-token|private-profile|\/private\/auth/.test(fx.errors.join('\n')), false)
  await fx.ctx.dispose()
})

test('synchronous module loader throw is contained', async () => {
  const fx = fixture()
  await assert.doesNotReject(async () => mountOptionalHistory(fx.ctx, fx.options, () => { throw errorWithSecret() }))
  assert.equal(fx.starts.length, 0)
  await fx.ctx.dispose()
})

test('unready-profile log failure cannot prevent listener containment or teardown', async () => {
  const fx = fixture({ profileReady: false, throwingLog: true })
  await assert.doesNotReject(async () => mountOptionalHistory(fx.ctx, fx.options, async () => fx.modules))
  assert.equal(fx.starts.length, 1, 'logging must not block the fail-closed mount')
  assert.equal(fx.starts[0].profile, fx.profile)
  assert.doesNotThrow(() => fx.server.emit('listening'))
  await fx.ctx.dispose()
  assert.equal(fx.listener.closeCalls, 1)
})

test('throwing error logger cannot turn a failed optional mount into a rejected task', async () => {
  const fx = fixture({ startError: errorWithSecret(), throwingLog: true })
  await assert.doesNotReject(async () => mountOptionalHistory(fx.ctx, fx.options, async () => fx.modules))
  await fx.ctx.dispose()
})


test('immediate disposal can prevent the module loader from starting', async () => {
  const fx = fixture()
  let loads = 0
  const mounting = mountOptionalHistory(fx.ctx, fx.options, async () => { loads += 1; return fx.modules })
  await fx.ctx.dispose()
  await mounting
  assert.equal(loads, 0)
  assert.equal(fx.starts.length, 0)
})

test('disposal during synchronous listener creation immediately closes its returned listener', async () => {
  const fx = fixture()
  const start = fx.modules[1].startHistoryListener
  fx.modules[1].startHistoryListener = (input) => {
    void fx.ctx.dispose()
    return start(input)
  }
  await mountOptionalHistory(fx.ctx, fx.options, async () => fx.modules)
  assert.equal(fx.listener.closeCalls, 1)
  assert.equal(fx.logs.some((line) => /listening/i.test(line)), false)
})

for (const [name, config, noBootstrap] of [
  ['default-off', {}, false],
  ['explicitly disabled', { enabled: false }, false],
  ['empty host', { enabled: true, host: '' }, false],
  ['IPv4 wildcard', { enabled: true, host: '0.0.0.0' }, false],
  ['IPv6 wildcard', { enabled: true, host: '::' }, false],
  ['star wildcard', { enabled: true, host: '*' }, false],
  ['missing bootstrap', { enabled: true, host: '100.64.0.8' }, true],
]) {
  test(`${name}: activation remains absent without loading history modules`, async () => {
    const fx = fixture()
    fx.options.historyConfig = config
    if (noBootstrap) fx.options.workspaceBootstrap = undefined
    let loads = 0
    await mountOptionalHistory(fx.ctx, fx.options, async () => { loads += 1; return fx.modules })
    assert.equal(loads, 0)
    assert.equal(fx.starts.length, 0)
    await fx.ctx.dispose()
    assert.equal(fx.listener.closeCalls, 0)
  })
}


test('signed exact directory stays fresh and fail-closed throughout production history retry/exhaustion/dispose', async () => {
  const fx = fixture()
  let clock = 0
  let listens = 0
  let definitionReads = 0
  let disabled = false
  const timers = new Set()
  fx.server.listen = () => { listens += 1; return fx.server }
  fx.server.closeAllConnections = () => {}
  fx.server.close = (callback) => { callback?.(); return fx.server }
  fx.server.address = () => null
  fx.options.definition = {
    listAgents() { definitionReads += 1; return [{ id: 'agt_target', disabled }] },
  }
  fx.modules[1].startHistoryListener = (input) => startHistoryListener({
    ...input,
    createServerImpl: () => fx.server,
    setTimeoutImpl(callback, delay) {
      assert.equal(delay, 60_000)
      const timer = { callback, unrefs: 0, unref() { this.unrefs += 1; return this } }
      timers.add(timer)
      return timer
    },
    clearTimeoutImpl: (timer) => timers.delete(timer),
    writeLog() {},
  })
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwk = { ...keys.publicKey.export({ format: 'jwk' }), kid: 'arr002-directory', alg: 'RS256', use: 'sig' }
  const now = () => 1788690000000 + clock
  const directory = createWorkflowAdmissionHandler({
    definition: fx.options.definition,
    jwksUrl: 'http://127.0.0.1/fixture-jwks', nowMs: now,
    fetchImpl: async () => ({ ok: true, json: async () => ({ keys: [jwk] }) }),
  })
  const query = async (bearer) => directory({
    method: 'GET', headers: { authorization: `Bearer ${bearer}` },
  }, new URL('http://localhost/v1/directory/agents/agt_target'))
  const signedQuery = async () => {
    const seconds = Math.floor(now() / 1000)
    const claims = {
      iss: 'auth-service', aud: 'agent-directory',
      sub: '20000000-0000-4000-8000-000000000002', principal_type: 'service',
      client_id: 'arr002-continuity-client', scope: 'agent.directory.read',
      token_use: 'access', type: 'access', version: 'v1',
      jti: `arr002-directory-${seconds}`, iat: seconds, nbf: seconds, exp: seconds + 300,
    }
    const input = [JSON.stringify({ alg: 'RS256', kid: jwk.kid }), JSON.stringify(claims)]
      .map((part) => Buffer.from(part).toString('base64url')).join('.')
    const bearer = input + '.' + sign('RSA-SHA256', Buffer.from(input), keys.privateKey).toString('base64url')
    assert.deepEqual(await query(bearer), {
      status: 200, body: { agentId: 'agt_target', exists: true, enabled: !disabled },
    })
    const reads = definitionReads
    assert.deepEqual(await query('invalid-token'), { status: 401, body: { error: 'UNAUTHORIZED' } })
    assert.equal(definitionReads, reads, 'unauthorized request must not read Definition')
  }
  await signedQuery()
  await mountOptionalHistory(fx.ctx, fx.options, async () => fx.modules)
  try {
    for (let attempt = 0; attempt <= 30; attempt += 1) {
      const readsBeforeError = definitionReads
      fx.server.emit('error', Object.assign(new Error('bind unavailable'), { code: 'EADDRNOTAVAIL' }))
      assert.equal(definitionReads, readsBeforeError, 'history bind must not retry a directory request')
      assert.equal(timers.size, attempt < 30 ? 1 : 0)
      disabled = attempt % 2 === 1
      await signedQuery()
      if (attempt < 30) {
        const [timer] = timers
        assert.equal(timer.unrefs, 1)
        timers.delete(timer)
        clock += 60_000
        timer.callback()
      }
    }
    assert.equal(listens, 31)
    assert.equal(timers.size, 0)
    assert.equal(definitionReads, 32, 'each authorized observation takes a fresh snapshot')
    await fx.ctx.dispose()
    await signedQuery()
    assert.equal(listens, 31)
    assert.equal(timers.size, 0)
  } finally { await fx.ctx.dispose() }
})
