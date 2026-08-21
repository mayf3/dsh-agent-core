import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createStandaloneLogging } from '../standalone.mjs'

// Sentinel standing in for the credential literal loaded from the local
// OpenClaw config. Nothing below may ever let it reach the console sink.
const SENTINEL = 'standalone-test-credential-literal-9f3ac2'

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function axiosLikeError() {
  const error = new Error(`tenant_access_token request failed after token=${SENTINEL}`)
  error.name = 'AxiosError'
  error.code = 'ETIMEDOUT'
  error.status = 503
  error.config = {
    method: 'post',
    url: `https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal?token=${SENTINEL}`,
    headers: {
      Authorization: `Bearer ${SENTINEL}`,
      cookie: `sid=${SENTINEL}`,
    },
    data: JSON.stringify({ app_id: 'cli_standalone_test', app_secret: SENTINEL }),
    appSecret: SENTINEL,
  }
  error.response = { status: 503, data: JSON.stringify({ app_secret: SENTINEL }) }
  return error
}

// Aggregate every captured console line across all scenarios; the closing
// audit test proves the four mandatory zero-match counters over the whole
// corpus, not per scenario.
const capturedLines = []

function capture() {
  const rawLog = (level, ...args) => {
    capturedLines.push([level, ...args].join(' '))
  }
  return { rawLog }
}

function standalone(rawLog) {
  return createStandaloneLogging({ creds: { appId: 'cli_standalone_test', appSecret: SENTINEL }, rawLog })
}

test('standalone SDK logger redacts the full Axios-like startup error and keeps safe diagnostics', () => {
  const { rawLog } = capture()
  const { sdkLogger } = standalone(rawLog)
  sdkLogger.error('ws bootstrap failed', axiosLikeError())

  const line = capturedLines.at(-1)
  assert.match(line, /\[lark-channel\]/)
  assert.match(line, /ws bootstrap failed/)
  assert.match(line, /AxiosError/)
  assert.match(line, /tenant_access_token request failed/)
  assert.match(line, /ETIMEDOUT/)
  assert.match(line, /503/)
  assert.match(line, /POST/)
  assert.match(line, /\/open-apis\/auth\/v3\/tenant_access_token\/internal/)
  assert.doesNotMatch(line, /headers|appSecret/)
})

test('Authorization header values never reach the standalone console on either logging path', () => {
  const { rawLog } = capture()
  const { log, sdkLogger } = standalone(rawLog)
  sdkLogger.warn('auth rejected', axiosLikeError())
  log('error', `handshake rejected: Authorization=Bearer ${SENTINEL}`)
  log('info', { authorization: `Bearer ${SENTINEL}` })

  for (const line of capturedLines.slice(-3)) {
    assert.doesNotMatch(line, new RegExp(`Bearer[\\s":]+${escapeRegex(SENTINEL)}`))
    assert.equal(line.includes(SENTINEL), false)
  }
})

test('JSON request body app_secret is redacted on the standalone SDK logger path', () => {
  const { rawLog } = capture()
  const { sdkLogger } = standalone(rawLog)
  sdkLogger.info('retrying bootstrap', {
    data: JSON.stringify({ app_id: 'cli_standalone_test', app_secret: SENTINEL }),
    body: { app_secret: SENTINEL },
  })

  const line = capturedLines.at(-1)
  assert.doesNotMatch(line, new RegExp(`app[_-]?secret"?\\s*[:=]\\s*"?${escapeRegex(SENTINEL)}`))
  assert.match(line, /\[REDACTED\]/)
  assert.equal(line.includes(SENTINEL), false)
})

test('URL query tokens are stripped to the endpoint pathname', () => {
  const { rawLog } = capture()
  const { sdkLogger } = standalone(rawLog)
  sdkLogger.error(axiosLikeError())

  const line = capturedLines.at(-1)
  assert.doesNotMatch(line, new RegExp(`[?&][a-z_]*token=${escapeRegex(SENTINEL)}`))
  // The retained endpoint must be the bare pathname — no query survives.
  assert.doesNotMatch(line, /endpoint":"[^"]*\?/)
  assert.match(line, /\/open-apis\/auth\/v3\/tenant_access_token\/internal/)
})

test('circular objects render bounded and never leak the credential', () => {
  const { rawLog } = capture()
  const { sdkLogger } = standalone(rawLog)
  const circular = { config: { nested: [{ appSecret: SENTINEL }] } }
  circular.self = circular

  assert.doesNotThrow(() => sdkLogger.info('state dump', circular))
  const line = capturedLines.at(-1)
  assert.match(line, /\[CIRCULAR\]/)
  assert.equal(line.includes(SENTINEL), false)
})

test('throwing getters and thenables are contained without invoking them', () => {
  const { rawLog } = capture()
  const { sdkLogger, log } = standalone(rawLog)
  const hostile = { appSecret: SENTINEL }
  Object.defineProperty(hostile, 'badGetter', {
    enumerable: true,
    get() { throw new Error(`getter exposed ${SENTINEL}`) },
  })
  hostile.then = () => { throw new Error('thenable must not be invoked') }

  assert.doesNotThrow(() => sdkLogger.error('bootstrap state', hostile))
  assert.doesNotThrow(() => log('warn', hostile))
  for (const line of capturedLines.slice(-2)) {
    assert.match(line, /\[UNAVAILABLE\]/)
    assert.equal(line.includes(SENTINEL), false)
  }
})

test('a throwing console sink never breaks the standalone driver logging paths', () => {
  const throwing = () => { throw new Error('console unavailable') }
  const { log, sdkLogger } = createStandaloneLogging({
    creds: { appId: 'cli_standalone_test', appSecret: SENTINEL },
    rawLog: throwing,
  })

  assert.doesNotThrow(() => log('info', `appSecret=${SENTINEL}`))
  assert.doesNotThrow(() => log('error', axiosLikeError()))
  for (const level of ['debug', 'info', 'warn', 'error']) {
    assert.doesNotThrow(() => sdkLogger[level]('sdk sink gone', axiosLikeError()))
  }
})

test('the loaded credential exact literal is redacted in every position it appears', () => {
  const { rawLog } = capture()
  const { log, sdkLogger } = standalone(rawLog)
  log('info', `connected with appSecret=${SENTINEL}`)
  log('warn', ['token refreshed to', SENTINEL, { apiKey: SENTINEL }])
  sdkLogger.debug('raw echo', `secret literal: ${SENTINEL}`)
  sdkLogger.info({ credentials: { appSecret: SENTINEL } }, `url https://open.feishu.cn/x?access_token=${SENTINEL}`)
  log('error', new Error(`connect failed with password ${SENTINEL}`))

  for (const line of capturedLines.slice(-5)) {
    assert.equal(line.includes(SENTINEL), false)
  }
})

test('standalone forwards all four SDK logger levels through the shared adapter', () => {
  const { rawLog } = capture()
  const { sdkLogger } = standalone(rawLog)
  sdkLogger.debug('verbose frame', { appSecret: SENTINEL })

  const line = capturedLines.at(-1)
  // The previous bypass dropped debug silently; the shared seam keeps the
  // level, the [lark-channel] prefix and full redaction.
  assert.match(line, /debug \[lark-channel\] verbose frame/)
  assert.equal(line.includes(SENTINEL), false)
})

test('aggregate audit: CAPTURED_SECRET / AUTHORIZATION_VALUE / REQUEST_BODY_SECRET / URL_QUERY_SECRET matches are all zero', () => {
  const corpus = capturedLines.join('\n')
  const count = (pattern) => (corpus.match(pattern) ?? []).length

  assert.ok(corpus.length > 0, 'expected captured scenario output')

  const CAPTURED_SECRET_MATCHES = count(new RegExp(escapeRegex(SENTINEL), 'g'))
  const AUTHORIZATION_VALUE_MATCHES = count(new RegExp(`Bearer[\\s":]+${escapeRegex(SENTINEL)}`, 'g'))
  const REQUEST_BODY_SECRET_MATCHES = count(new RegExp(`app[_-]?secret"?\\s*[:=]\\s*"?${escapeRegex(SENTINEL)}`, 'g'))
  const URL_QUERY_SECRET_MATCHES = count(new RegExp(`[?&][a-z_]*token=${escapeRegex(SENTINEL)}`, 'g'))

  assert.equal(CAPTURED_SECRET_MATCHES, 0)
  assert.equal(AUTHORIZATION_VALUE_MATCHES, 0)
  assert.equal(REQUEST_BODY_SECRET_MATCHES, 0)
  assert.equal(URL_QUERY_SECRET_MATCHES, 0)
})
