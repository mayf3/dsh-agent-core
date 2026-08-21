import { test } from 'node:test'
import assert from 'node:assert/strict'

import { apply } from '../src/index.js'
import { createRedactingLogger, sdkLoggerAdapter } from '../src/log-redaction.js'

const TEST_SECRET = 'test-only-secret-value-12345'

function axiosLikeError() {
  const error = new Error(`request failed for token=${TEST_SECRET}`)
  error.name = 'AxiosError'
  error.code = 'ENOTFOUND'
  error.status = 503
  error.config = {
    appSecret: TEST_SECRET,
    data: JSON.stringify({ app_id: 'cli_test', app_secret: TEST_SECRET }),
    headers: {
      Authorization: `Bearer ${TEST_SECRET}`,
      cookie: `sid=${TEST_SECRET}`,
    },
    url: `https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal?token=${TEST_SECRET}`,
    method: 'post',
  }
  return error
}

function capture() {
  const entries = []
  return {
    entries,
    log: (level, ...args) => entries.push([level, ...args].join(' ')),
    text: () => entries.join('\n'),
  }
}

test('SDK logger redacts Axios config, credentials, authorization and body while retaining safe diagnostics', () => {
  const captured = capture()
  const logger = sdkLoggerAdapter(captured.log, { secrets: [TEST_SECRET] })
  logger.error('startup request failed', axiosLikeError())

  const output = captured.text()
  assert.equal(output.includes(TEST_SECRET), false)
  assert.equal(output.includes(`Bearer ${TEST_SECRET}`), false)
  assert.equal(output.includes(`"app_secret":"${TEST_SECRET}"`), false)
  assert.match(output, /AxiosError/)
  assert.match(output, /request failed/)
  assert.match(output, /ENOTFOUND/)
  assert.match(output, /503/)
  assert.match(output, /POST/)
  assert.match(output, /\/open-apis\/auth\/v3\/tenant_access_token\/internal/)
  assert.doesNotMatch(output, /config|headers|data/)
})

test('redacting logger handles nested arrays, circular values, throwing getters and thenables without throwing', () => {
  const captured = capture()
  const log = createRedactingLogger(captured.log, { secrets: [TEST_SECRET] })
  const circular = { nested: [{ apiKey: TEST_SECRET }] }
  circular.self = circular
  Object.defineProperty(circular, 'badGetter', {
    enumerable: true,
    get() { throw new Error(`getter exposed ${TEST_SECRET}`) },
  })
  circular.then = () => { throw new Error('thenable must not be invoked') }

  assert.doesNotThrow(() => log('error', circular))
  const output = captured.text()
  assert.equal(output.includes(TEST_SECRET), false)
  assert.match(output, /\[CIRCULAR\]/)
  assert.match(output, /\[UNAVAILABLE\]/)
})

test('logger failure never changes connector startup error handling', async () => {
  const error = axiosLikeError()
  const throwingLog = () => { throw new Error('logger unavailable') }
  const logger = sdkLoggerAdapter(throwingLog, { secrets: [TEST_SECRET] })
  assert.doesNotThrow(() => logger.error(error))

  let options
  const channel = {
    on() {},
    connect: async () => { options.logger.error('connect failed', error); throw error },
    disconnect: async () => {},
    getBotIdentity: () => undefined,
  }
  const ctx = { effect() {}, provide() {} }
  const handle = apply(ctx, {
    enabled: true,
    appId: 'cli_test',
    appSecret: TEST_SECRET,
    log: throwingLog,
  }, {
    createChannel(value) { options = value; return channel },
  })

  await assert.rejects(handle.ready(), (received) => received === error)
})

test('apply production startup path installs the redacting SDK logger adapter', async () => {
  const captured = capture()
  const error = axiosLikeError()
  let options
  const channel = {
    on() {},
    connect: async () => { options.logger.error('connect failed', error); throw error },
    disconnect: async () => {},
    getBotIdentity: () => undefined,
  }
  const ctx = { effect() {}, provide() {} }
  const handle = apply(ctx, {
    enabled: true,
    appId: 'cli_test',
    appSecret: TEST_SECRET,
    log: captured.log,
  }, {
    createChannel(value) { options = value; return channel },
  })

  await assert.rejects(handle.ready(), (received) => received === error)
  const output = captured.text()
  assert.equal(output.includes(TEST_SECRET), false)
  assert.match(output, /AxiosError/)
  assert.match(output, /ENOTFOUND/)
  assert.doesNotMatch(output, /Authorization|appSecret|app_secret/)
})
