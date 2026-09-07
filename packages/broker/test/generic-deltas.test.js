/**
 * @agent-core/broker — Forum V2 bounded generic-delta tests.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ALLOWED_METHODS,
  buildDownstreamError,
  sanitizeErrorDetail,
} from '../src/transport.js'
import { validateManifest } from '../src/schema.js'
import { validateArgumentsDetailed } from '../src/mapping.js'

function manifest(properties, method = 'GET') {
  return {
    id: 'demo_delta',
    toolName: 'demo_delta',
    description: 'Generic delta fixture.',
    requiredScopes: ['forum.read'],
    errors: [{ code: 'invalid_arguments' }],
    operations: [{
      name: 'execute',
      description: 'Execute fixture.',
      arguments: { properties, required: [] },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-forum', method, path: '/api/stats' },
    }],
  }
}

test('bounded delta 1: PATCH is allowed and unknown methods stay rejected', () => {
  assert.deepEqual([...ALLOWED_METHODS].sort(), ['DELETE', 'GET', 'PATCH', 'POST', 'PUT'])
  assert.equal(validateManifest(manifest({}, 'PATCH')).ok, true)
  const invalid = validateManifest(manifest({}, 'TRACE'))
  assert.equal(invalid.ok, false)
  assert.ok(invalid.errors.some((error) => error.includes('method')))
})

test('bounded delta 2: nonBlank is boolean-only and string-only', () => {
  assert.equal(validateManifest(manifest({ summaryMd: { type: 'string', nonBlank: true } })).ok, true)
  assert.equal(validateManifest(manifest({ summaryMd: { type: 'string', nonBlank: false } })).ok, true)
  for (const properties of [
    { summaryMd: { type: 'string', nonBlank: 'yes' } },
    { summaryMd: { type: 'string', nonBlank: 1 } },
    { page: { type: 'integer', nonBlank: true } },
    { payload: { type: 'json', nonBlank: true } },
  ]) {
    const result = validateManifest(manifest(properties))
    assert.equal(result.ok, false)
    assert.ok(result.errors.some((error) => error.includes('nonBlank')))
  }
})

test('bounded delta 2: nonBlank enforcement rejects blank, missing, and wrong-type values locally', () => {
  const schema = { properties: { summaryMd: { type: 'string', nonBlank: true } }, required: ['summaryMd'] }
  assert.deepEqual(validateArgumentsDetailed(schema, { summaryMd: '## Outcome' }).violations, [])
  for (const bad of ['', '   ', '\t\n ']) {
    const out = validateArgumentsDetailed(schema, { summaryMd: bad })
    assert.ok(out.violations.some((v) => v.includes('non-blank')), JSON.stringify(bad))
  }
  assert.ok(validateArgumentsDetailed(schema, {}).violations.some((v) => v.includes('missing required property "summaryMd"')))
  assert.ok(validateArgumentsDetailed(schema, { summaryMd: 42 }).violations.some((v) => v.includes('must be a string')))
})

test('bounded delta 3: Bearer and Basic six-case matrix is case-insensitive', () => {
  const cases = [
    ['bearer', 'dGhpcyBpcyBhIHNlY3JldA'],
    ['Bearer', 'dGhpcyBpcyBhIHNlY3JldA'],
    ['BeArEr', 'dGhpcyBpcyBhIHNlY3JldA'],
    ['basic', 'QUJDREVG'],
    ['Basic', 'QUJDREVG'],
    ['BaSiC', 'QUJDREVG'],
  ]
  for (const [scheme, credential] of cases) {
    assert.equal(
      sanitizeErrorDetail(`failed with ${scheme} ${credential}`),
      `failed with ${scheme} <AUTH_REDACTED>`,
    )
  }
})

test('sanitizer preserves stronger password/api-key and short auth-scheme protections', () => {
  const cases = [
    ['password=hunter2', 'hunter2'],
    ['api_key="sk-live-999999999999"', 'sk-live-999999999999'],
    ['Authorization: NTLM TlRMTVNTUAABAAAAAAAABgAAAAAAAQ==', 'TlRMTVNTUAABAAAAAAAABgAAAAAAAQ'],
    ['authorization: Digest response=6629fae49393a053974509785505ff5f', '6629fae49393a053974509785505ff5f'],
    ['Authorization: VAPID cHVibGljLWtleS1tYXRlcmlhbA==', 'cHVibGljLWtleS1tYXRlcmlhbA'],
    ...['NTLM', 'Digest', 'VAPID', 'DPoP'].map((scheme) => [`${scheme} abc123`, 'abc123']),
  ]
  for (const [input, secret] of cases) {
    assert.ok(!sanitizeErrorDetail(`rejected ${input}`).includes(secret), input)
  }
})

test('sanitizer applies keyed and opaque redaction idempotently', () => {
  const keyed = sanitizeErrorDetail('authorization="Bearer xyz" token=abcdef0123456789abcdef0123456789 secret="s" credential=c-1 ABCDEFGHIJKLMNOPQRSTUVWX24')
  for (const secret of ['xyz', 'abcdef0123456789', '"s"', 'ABCDEFGHIJKLMNOPQRSTUVWX24']) {
    assert.ok(!keyed.includes(secret))
  }
  const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload token=tok_1234567890abcdefghij'
  const once = sanitizeErrorDetail(input)
  assert.equal(sanitizeErrorDetail(once), once)
  assert.ok(sanitizeErrorDetail('ref abcd1234').includes('abcd1234'))
})

test('sanitizer truncation is code-point-correct at exactly 500', () => {
  const output = sanitizeErrorDetail('配置失败😀'.repeat(150))
  assert.equal([...output].length, 500)
  assert.ok(!/[\uD800-\uDBFF]$/.test(output))
  assert.equal(sanitizeErrorDetail('short'), 'short')
})

test('downstream error canaries never survive caller-visible detail', () => {
  const error = buildDownstreamError(400, JSON.stringify({
    error: {
      code: 'bad_request',
      message: 'token=abcdefghij0123456789ABCDEFGH echoed authorization: bEaReR eyJhbGciOiJIUzI1NiJ9.sig.part',
    },
  }), new Headers({ 'x-request-id': 'req-1' }))
  assert.equal(error.errorCode, 'bad_request')
  assert.equal(error.status, 400)
  assert.equal(error.requestId, 'req-1')
  assert.ok(!error.detail.includes('abcdefghij0123456789ABCDEFGH'))
  assert.ok(!error.detail.includes('eyJhbGciOiJIUzI1NiJ9'))
  assert.ok([...error.detail].length <= 500)
}
)
