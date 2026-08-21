import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { createRedactingLogger, safeInspect, sdkLoggerAdapter } from '../src/log-redaction.js'
import { createStandaloneLogging, logStandaloneOutboundResult } from '../standalone.mjs'
import {
  SECONDARY_VALUE,
  TEST_CREDENTIAL,
  hostileHooksFixture,
  makeCredentialStatusError,
  standaloneResultFixture,
  tokenVariantFixture,
} from './log-redaction-adversarial.fixtures.js'

const capturedLines = []

function capture(forbiddenReferences = []) {
  const entries = []
  const sink = (level, ...args) => {
    assert.equal(typeof level, 'string')
    for (const arg of args) {
      assert.equal(typeof arg, 'string', 'raw/non-string logger argument reached sink')
      assert.equal(forbiddenReferences.includes(arg), false, 'original object reference reached sink')
    }
    const line = [level, ...args].join(' ')
    entries.push(line)
    capturedLines.push(line)
  }
  return { entries, sink, text: () => entries.join('\n') }
}

function loggerFor(captured) {
  return createRedactingLogger(captured.sink, { secrets: [TEST_CREDENTIAL] })
}

test('ERROR_STATUS_REDACTION: every retained Error diagnostic string passes exact-literal redaction', () => {
  const error = makeCredentialStatusError()
  const captured = capture([error])
  loggerFor(captured)('error', error)
  const output = captured.text()

  assert.equal(output.includes(TEST_CREDENTIAL), false)
  assert.match(output, /"status":"status-\[REDACTED\]"/)
  assert.match(output, /"code":"E_\[REDACTED\]"/)
  assert.match(output, /"phase":"phase-\[REDACTED\]"/)
  assert.match(output, /"method":"POST-\[REDACTED\]"/)
})

test('SYMBOL_DESCRIPTION_REDACTION: Symbol description is never observed or emitted', () => {
  const captured = capture()
  loggerFor(captured)('info', Symbol(TEST_CREDENTIAL))
  assert.match(captured.text(), /\[Symbol\]/)
  assert.equal(captured.text().includes(TEST_CREDENTIAL), false)
})

test('TOKEN_KEY_VARIANTS: normalized sensitive-key families redact all required variants', () => {
  const value = tokenVariantFixture()
  const captured = capture([value])
  const log = loggerFor(captured)
  log('warn', value)
  log('warn', `api$key=${SECONDARY_VALUE}`)
  log('warn', `pass/word=${SECONDARY_VALUE}`)
  log('warn', `api key=${SECONDARY_VALUE}`)
  log('warn', `pass;word=${SECONDARY_VALUE}`)
  log('warn', `prefix: api key=${SECONDARY_VALUE}`)
  log('warn', `message: pass;word=${SECONDARY_VALUE}`)
  const output = captured.text()

  assert.equal(output.includes(SECONDARY_VALUE), false)
  assert.ok((output.match(/\[REDACTED\]/g) ?? []).length >= 15)
})

test('sensitive assignments redact escaped quoted values without suffix leakage', () => {
  const doubleLeak = 'ESCAPED-DOUBLE-LEAK'
  const singleLeak = 'ESCAPED-SINGLE-LEAK'
  const unclosedLeak = 'UNCLOSED-QUOTED-LEAK'
  const trailingLeak = 'TRAILING-QUOTED-LEAK'
  const captured = capture()
  const log = loggerFor(captured)
  log('warn', `token="safe\\"${doubleLeak}"`)
  log('warn', `password='safe\\'${singleLeak}'`)
  log('warn', `credential="unfinished value,;}\ncontinued ${unclosedLeak}`)
  log('warn', `token="safe"${trailingLeak}`)

  assert.equal(captured.text().includes(doubleLeak), false)
  assert.equal(captured.text().includes(singleLeak), false)
  assert.equal(captured.text().includes(unclosedLeak), false)
  assert.equal(captured.text().includes(trailingLeak), false)
})

test('sensitive assignment family fuzz covers separators, operators and preceding labels', () => {
  const families = ['secret', 'token', 'authorization', 'auth', 'bearer', 'cookie', 'password', 'passwd', 'apikey', 'credential']
  const separators = ['', '_', '-', ' ', '$', '/', ';', '.', ':', '::', '💥']
  const prefixes = ['', 'prefix: ', 'message=value; ', 'context, ', 'label: adjacent ']
  for (const [familyIndex, family] of families.entries()) {
    for (const [separatorIndex, separator] of separators.entries()) {
      const key = family.split('').join(separator)
      for (const prefix of prefixes) {
        for (const operator of ['=', ':']) {
          const marker = `FUZZ-LEAK-${familyIndex}-${separatorIndex}`
          const output = safeInspect(`${prefix}${key}${operator}${marker}`)
          assert.equal(output.includes(marker), false, `${prefix}${key}${operator}`)
        }
      }
    }
  }
})

test('Authorization Bearer values are removed from object and string inputs', () => {
  const captured = capture()
  const log = loggerFor(captured)
  log('error', { Authorization: `Bearer ${TEST_CREDENTIAL}` })
  log('error', `authorization_header=Bearer ${TEST_CREDENTIAL}`)

  assert.equal(captured.text().includes(TEST_CREDENTIAL), false)
  assert.doesNotMatch(captured.text(), new RegExp(`Bearer\\s+${TEST_CREDENTIAL}`))
})

test('JSON string bodies containing app_secret are redacted as strings', () => {
  const captured = capture()
  loggerFor(captured)('error', `{"app_secret":"${TEST_CREDENTIAL}","ok":true}`)
  const output = captured.text()
  assert.equal(output.includes(TEST_CREDENTIAL), false)
  assert.match(output, /\[REDACTED\]/)
})

test('Error URL query values are discarded while safe pathname is retained', () => {
  const captured = capture()
  loggerFor(captured)('error', makeCredentialStatusError())
  const output = captured.text()
  assert.match(output, /\/open-apis\/auth\/v3\/token/)
  assert.doesNotMatch(output, /private_token|\?/)
  assert.equal(output.includes(TEST_CREDENTIAL), false)
})

test('throwing getters are represented as unavailable and are never invoked', () => {
  const calls = { getter: 0, toJSON: 0, toPrimitive: 0, toString: 0 }
  const value = hostileHooksFixture(calls)
  const captured = capture([value])
  loggerFor(captured)('error', value)

  assert.deepEqual(calls, { getter: 0, toJSON: 0, toPrimitive: 0, toString: 0 })
  assert.match(captured.text(), /\[UNAVAILABLE\]/)
  assert.equal(captured.text().includes(TEST_CREDENTIAL), false)
})

test('throwing or secret-bearing toJSON is never invoked', () => {
  const calls = { toJSON: 0 }
  const value = {
    ordinary: 'safe',
    toJSON() {
      calls.toJSON += 1
      throw new Error(TEST_CREDENTIAL)
    },
  }
  const captured = capture([value])
  assert.doesNotThrow(() => loggerFor(captured)('info', value))
  assert.equal(calls.toJSON, 0)
  assert.equal(captured.text().includes(TEST_CREDENTIAL), false)
})

test('circular objects render bounded without leaking sensitive values', () => {
  const value = { nested: tokenVariantFixture() }
  value.self = value
  const captured = capture([value])
  loggerFor(captured)('debug', value)

  assert.match(captured.text(), /\[CIRCULAR\]/)
  assert.equal(captured.text().includes(SECONDARY_VALUE), false)
})

test('PRE_REDACTION_STRINGIFICATION: template-interpolation candidates are never coerced', () => {
  const calls = { getter: 0, toJSON: 0, toPrimitive: 0, toString: 0 }
  const value = hostileHooksFixture(calls)
  const captured = capture([value])
  const sdkLogger = sdkLoggerAdapter(captured.sink, { secrets: [TEST_CREDENTIAL] })
  sdkLogger.error('candidate follows as raw argument', value)

  assert.deepEqual(calls, { getter: 0, toJSON: 0, toPrimitive: 0, toString: 0 })
  assert.equal(captured.text().includes(TEST_CREDENTIAL), false)
})

test('STANDALONE_LOGGER_REDACTION: outbound result object crosses the shared sanitizer before formatting', () => {
  const calls = { toJSON: 0 }
  const result = standaloneResultFixture(calls)
  const captured = capture([result])
  const { log } = createStandaloneLogging({
    creds: { appId: 'cli_fixture', appSecret: TEST_CREDENTIAL },
    rawLog: captured.sink,
  })

  logStandaloneOutboundResult(log, result)
  assert.equal(calls.toJSON, 0)
  assert.equal(captured.text().includes(TEST_CREDENTIAL), false)
  assert.equal(captured.text().includes(SECONDARY_VALUE), false)

  const source = readFileSync(new URL('../standalone.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /JSON\.stringify\s*\(\s*result\s*\)/)
  assert.doesNotMatch(source, /console\.(?:log|error|warn)\s*\(\s*result/)
})

test('logger sink failure is contained and cannot change caller behavior', () => {
  const throwingSink = () => { throw new Error('sink unavailable') }
  const log = createRedactingLogger(throwingSink, { secrets: [TEST_CREDENTIAL] })
  const sdkLogger = sdkLoggerAdapter(throwingSink, { secrets: [TEST_CREDENTIAL] })

  assert.doesNotThrow(() => log('error', makeCredentialStatusError()))
  assert.doesNotThrow(() => sdkLogger.error(makeCredentialStatusError()))
})

test('INPUT_OBJECT_MUTATION: sanitizer preserves frozen inputs, descriptors and nested references', () => {
  const nested = Object.freeze({ access_token: SECONDARY_VALUE, safe: 'value' })
  const value = Object.freeze({ nested, array: Object.freeze([nested]), ordinary: 'safe' })
  const beforeDescriptors = Object.getOwnPropertyDescriptors(value)
  const nestedBeforeDescriptors = Object.getOwnPropertyDescriptors(nested)
  const captured = capture([value])

  assert.doesNotThrow(() => loggerFor(captured)('info', value))
  assert.equal(value.nested, nested)
  assert.equal(value.array[0], nested)
  assert.deepEqual(Object.getOwnPropertyDescriptors(value), beforeDescriptors)
  assert.deepEqual(Object.getOwnPropertyDescriptors(nested), nestedBeforeDescriptors)
  assert.equal(nested.access_token, SECONDARY_VALUE)
})

test('aggregate captured-output audit has zero credential, Authorization, body and query matches', () => {
  const corpus = capturedLines.join('\n')
  assert.ok(corpus.length > 0)

  const EXACT_CREDENTIAL_MATCHES = corpus.split(TEST_CREDENTIAL).length - 1
  const AUTHORIZATION_VALUE_MATCHES = (corpus.match(new RegExp(`Bearer\\s+${TEST_CREDENTIAL}`, 'g')) ?? []).length
  const RAW_REQUEST_BODY_MATCHES = corpus.split(`"app_secret":"${TEST_CREDENTIAL}"`).length - 1
  const RAW_QUERY_VALUE_MATCHES = (corpus.match(new RegExp(`[?&][^=]*(?:token|secret)=${TEST_CREDENTIAL}`, 'g')) ?? []).length

  assert.equal(EXACT_CREDENTIAL_MATCHES, 0)
  assert.equal(AUTHORIZATION_VALUE_MATCHES, 0)
  assert.equal(RAW_REQUEST_BODY_MATCHES, 0)
  assert.equal(RAW_QUERY_VALUE_MATCHES, 0)
})
