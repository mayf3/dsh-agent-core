/** CTR-ARR-002: bind budget, cancellation, containment and disposable sockets. */
import assert from 'node:assert/strict'
import { EventEmitter, once } from 'node:events'
import { createServer, get } from 'node:http'
import { test } from 'node:test'
import { startHistoryListener } from '../src/history-listener.js'

class FakeClock {
  now = 0
  pending = new Set()
  created = []
  cleared = []
  setTimeout = (callback, delay) => {
    const timer = { callback, delay, at: this.now + delay, unrefs: 0 }
    timer.unref = () => { timer.unrefs += 1; return timer }
    this.pending.add(timer)
    this.created.push(timer)
    return timer
  }
  clearTimeout = (timer) => { this.cleared.push(timer); this.pending.delete(timer) }
  advance(ms) {
    const until = this.now + ms
    while (true) {
      const due = [...this.pending].filter((timer) => timer.at <= until).sort((a, b) => a.at - b.at)[0]
      if (!due) break
      this.now = due.at
      this.pending.delete(due)
      due.callback()
    }
    this.now = until
  }
}

class FakeServer extends EventEmitter {
  listening = false
  calls = []
  closeCalls = 0
  connectionCloses = 0
  inFlight = 0
  maxInFlight = 0
  constructor(clock) { super(); this.clock = clock }
  listen(port, host) {
    this.calls.push({ port, host, at: this.clock.now })
    this.inFlight += 1
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight)
    if (this.listenError) { this.inFlight = 0; throw this.listenError }
    return this
  }
  emit(event, ...args) {
    if (event === 'error' || event === 'listening') this.inFlight = 0
    if (event === 'listening') this.listening = true
    return super.emit(event, ...args)
  }
  address() { return this.listening ? { address: '100.64.0.8', port: 8788 } : null }
  closeAllConnections() { this.connectionCloses += 1 }
  close(callback) {
    this.beforeClose?.()
    this.closeCalls += 1
    this.listening = false
    callback?.()
    return this
  }
}

function fixture({ listenError, writeLog } = {}) {
  const clock = new FakeClock()
  const server = new FakeServer(clock)
  server.listenError = listenError
  const logs = []
  const profile = Object.freeze({ ready: false, generation: 'immutable-test-generation' })
  const listener = startHistoryListener({
    host: '100.64.0.8', port: 8788, profile,
    sessionHistory: { listMessages() { throw new Error('bind must not request history') } },
    resolveStableNodeId() { throw new Error('bind must not resolve identity') },
    createServerImpl: (handler) => { server.requestHandler = handler; return server },
    setTimeoutImpl: clock.setTimeout,
    clearTimeoutImpl: clock.clearTimeout,
    writeLog: writeLog ?? ((line) => logs.push(line)),
  })
  return { clock, server, logs, profile, listener }
}
const bindError = (code, message = 'fixture error') => Object.assign(new Error(message), { code })

for (const code of ['EADDRNOTAVAIL', 'EADDRINUSE', 'EACCES']) {
  test(`${code}: one unref retry at exactly 60 seconds and original endpoint`, async () => {
    const { clock, server, listener, profile } = fixture()
    assert.equal(server.calls.length, 1)
    server.emit('error', bindError(code))
    assert.equal(clock.pending.size, 1)
    assert.equal(clock.created[0].delay, 60_000)
    assert.equal(clock.created[0].unrefs, 1)
    clock.advance(59_999)
    assert.equal(server.calls.length, 1)
    clock.advance(1)
    assert.deepEqual(server.calls, [
      { port: 8788, host: '100.64.0.8', at: 0 },
      { port: 8788, host: '100.64.0.8', at: 60_000 },
    ])
    assert.equal(clock.pending.size, 0)
    clock.created[0].callback() // a duplicate already-queued callback cannot overlap listen
    clock.advance(120_000)
    assert.equal(server.calls.length, 2, 'an unfinished listen must not overlap another')
    assert.equal(server.maxInFlight, 1)
    assert.equal(profile.generation, 'immutable-test-generation')
    await listener.close()
  })
}

test('non-allowlist bind failure terminates budget without retry', async () => {
  const { clock, server, listener } = fixture()
  server.emit('error', bindError('EINVAL'))
  assert.equal(clock.pending.size, 0)
  server.emit('error', bindError('EADDRINUSE'))
  clock.advance(60_000 * 40)
  assert.equal(server.calls.length, 1)
  assert.equal(listener.address(), null)
  await listener.close()
})

test('exactly 30 additional attempts; exhaustion stays unavailable and never resets budget', async () => {
  const { clock, server, listener } = fixture()
  for (let attempt = 0; attempt <= 30; attempt += 1) {
    assert.equal(server.calls.length, attempt + 1)
    assert.equal(clock.pending.size, 0)
    server.emit('error', bindError('EADDRNOTAVAIL'))
    assert.equal(clock.pending.size, attempt < 30 ? 1 : 0)
    if (attempt < 30) clock.advance(60_000)
  }
  assert.equal(clock.created.length, 30)
  assert.ok(clock.created.every((timer) => timer.delay === 60_000 && timer.unrefs === 1))
  assert.deepEqual(server.calls.map((call) => call.at), Array.from({ length: 31 }, (_, i) => i * 60_000))
  server.emit('error', bindError('EACCES'))
  clock.advance(60_000 * 40)
  assert.equal(server.calls.length, 31)
  assert.equal(server.maxInFlight, 1)
  assert.equal(listener.address(), null)
  await listener.close()
  const fresh = fixture()
  fresh.server.emit('error', bindError('EADDRINUSE'))
  fresh.clock.advance(60_000)
  assert.equal(fresh.server.calls.length, 2, 'a legitimate new mount owns a new budget')
  await fresh.listener.close()
})

test('duplicate errors cannot multiply pending retry timers', async () => {
  const { clock, server, listener } = fixture()
  server.emit('error', bindError('EADDRINUSE'))
  server.emit('error', bindError('EADDRINUSE'))
  server.emit('error', bindError('EADDRNOTAVAIL'))
  assert.equal(clock.pending.size, 1)
  assert.equal(clock.created.length, 1)
  clock.advance(60_000)
  assert.equal(server.calls.length, 2)
  assert.equal(server.maxInFlight, 1)
  await listener.close()
})

test('listening cancels pending retry and an already queued callback cannot listen again', async () => {
  const { clock, server, listener } = fixture()
  server.emit('error', bindError('EADDRINUSE'))
  const queued = clock.created[0]
  server.emit('listening')
  assert.equal(clock.pending.size, 0)
  assert.ok(clock.cleared.includes(queued))
  queued.callback()
  clock.advance(60_000)
  assert.equal(server.calls.length, 1)
  assert.notEqual(listener.address(), null)
  await listener.close()
})

test('successful bind permanently ends this mount budget; serve errors remain contained', async () => {
  const { clock, server, listener, logs } = fixture()
  server.emit('error', bindError('EADDRNOTAVAIL'))
  clock.advance(60_000)
  server.emit('listening')
  for (const code of ['EADDRNOTAVAIL', 'EADDRINUSE', 'EACCES', 'EIO']) {
    assert.doesNotThrow(() => server.emit('error', bindError(code)))
  }
  clock.advance(60_000 * 40)
  assert.equal(server.calls.length, 2)
  assert.equal(clock.pending.size, 0)
  assert.ok(logs.length > 0)
  await listener.close()
})

test('close stops and cancels before server teardown; close is idempotent while unbound', async () => {
  const { clock, server, listener } = fixture()
  server.emit('error', bindError('EACCES'))
  const queued = clock.created[0]
  server.beforeClose = () => {
    assert.equal(clock.pending.size, 0, 'timer must be cleared before server.close')
    queued.callback()
    server.emit('error', bindError('EADDRNOTAVAIL'))
    assert.equal(server.calls.length, 1, 'mount must already be stopped')
  }
  await listener.close()
  await listener.close()
  assert.equal(server.closeCalls, 1)
  assert.equal(server.connectionCloses, 1)
  assert.equal(clock.pending.size, 0)
  queued.callback()
  clock.advance(60_000)
  assert.equal(server.calls.length, 1)
})

test('closing an in-flight mount prevents a late listening event leaving a listener alive', async () => {
  const { clock, server, listener } = fixture()
  await listener.close()
  server.emit('listening')
  assert.equal(server.listening, false)
  server.emit('error', bindError('EADDRINUSE'))
  clock.advance(60_000)
  assert.equal(server.calls.length, 1)
  assert.equal(clock.pending.size, 0)
})

test('synchronous listen throws in initial and timer attempts are contained and bounded', async () => {
  const { clock, server, listener } = fixture({ listenError: bindError('EADDRNOTAVAIL') })
  assert.equal(clock.pending.size, 1)
  assert.doesNotThrow(() => clock.advance(60_000))
  assert.equal(server.calls.length, 2)
  assert.equal(clock.pending.size, 1)
  server.listenError = bindError('EINVAL')
  assert.doesNotThrow(() => clock.advance(60_000))
  assert.equal(server.calls.length, 3)
  assert.equal(clock.pending.size, 0)
  await listener.close()
})

test('throwing log sink cannot escape error handlers, timer callbacks, or serve containment', async () => {
  const { clock, server, listener } = fixture({ writeLog() { throw new Error('log sink unavailable') } })
  assert.doesNotThrow(() => server.emit('error', bindError('EACCES')))
  server.listenError = bindError('EADDRINUSE')
  assert.doesNotThrow(() => clock.advance(60_000))
  server.listenError = null
  clock.advance(60_000)
  assert.doesNotThrow(() => server.emit('listening'))
  assert.doesNotThrow(() => server.emit('error', bindError('EACCES')))
  assert.equal(clock.pending.size, 0)
  await listener.close()
})

test('bind diagnostics never expose raw error text, credentials, profile or paths', async () => {
  const { server, listener, logs } = fixture()
  server.emit('error', bindError('EACCES', 'token=private-token profile=private-profile /private/config.json'))
  assert.ok(logs.length > 0)
  const text = logs.join('\n')
  assert.equal(/private-token|private-profile|\/private\/config|immutable-test-generation/.test(text), false)
  await listener.close()
})

function httpGet(port) {
  return new Promise((resolve, reject) => {
    get({ host: '127.0.0.1', port, path: '/' }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (part) => { body += part })
      response.on('end', () => resolve({ status: response.statusCode, body }))
    }).on('error', reject)
  })
}

test('disposable real loopback bind serves and close releases the socket', { timeout: 5_000 }, async () => {
  const listener = startHistoryListener({
    host: '127.0.0.1', port: 0, profile: { ready: false },
    sessionHistory: {}, resolveStableNodeId: async () => ({ ok: false }), writeLog() {},
  })
  try {
    await once(listener.server, 'listening')
    const result = await httpGet(listener.address().port)
    assert.equal(result.status, 403)
  } finally { await listener.close() }
  assert.equal(listener.address(), null)
})

test('real unavailable TEST-NET bind schedules retry while independent runtime remains responsive', { timeout: 5_000 }, async () => {
  const runtime = createServer((_request, response) => response.end('runtime-alive'))
  runtime.listen(0, '127.0.0.1')
  await once(runtime, 'listening')
  const clock = new FakeClock()
  const listener = startHistoryListener({
    host: '192.0.2.254', port: 0, profile: { ready: false },
    sessionHistory: {}, resolveStableNodeId: async () => ({ ok: false }), writeLog() {},
    setTimeoutImpl: clock.setTimeout, clearTimeoutImpl: clock.clearTimeout,
  })
  try {
    const error = await new Promise((resolve) => listener.server.once('error', resolve))
    assert.equal(error.code, 'EADDRNOTAVAIL')
    assert.equal(listener.address(), null)
    assert.equal(clock.pending.size, 1)
    assert.equal(clock.created[0].unrefs, 1)
    assert.deepEqual(await httpGet(runtime.address().port), { status: 200, body: 'runtime-alive' })
    await listener.close()
    assert.equal(clock.pending.size, 0)
    assert.deepEqual(await httpGet(runtime.address().port), { status: 200, body: 'runtime-alive' })
  } finally {
    await listener.close()
    await new Promise((resolve) => runtime.close(resolve))
  }
})
