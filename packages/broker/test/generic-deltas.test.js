/**
 * @agent-core/broker — bounded generic-delta tests
 * (AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2 CTR-FMC-013).
 *
 * Sole test owner of the three bounded generic Broker deltas: the PATCH
 * method allowlist, schema `nonBlank` leaf validation, and the full
 * error-detail sanitizer matrix incl. the frozen six-case case-insensitive
 * Bearer/Basic matrix (CTR-FMC-012).
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { validateManifest } from '../src/schema.js'
import {
  ALLOWED_METHODS,
  sanitizeErrorDetail,
  buildDownstreamError,
} from '../src/transport.js'

// ═══ AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2 — generic transport deltas ═

test('ALLOWED_METHODS includes PATCH (bounded delta 1)', () => {
  assert.ok(ALLOWED_METHODS.includes('PATCH'))
  assert.deepEqual([...ALLOWED_METHODS].sort(), ['DELETE', 'GET', 'PATCH', 'POST', 'PUT'])
})

test('schema: PATCH http binding validates; unknown method still rejected', () => {
  const base = {
    id: 'demo_patch', toolName: 'demo_patch', description: 'd',
    requiredScopes: ['forum.read'],
    errors: [{ code: 'invalid_arguments' }],
    operations: [{
      name: 'patch_it', description: 'd',
      arguments: { properties: { threadId: { type: 'string' } }, required: ['threadId'] },
      result: { type: 'json' }, errors: ['invalid_arguments'],
      http: { target: 'svc-forum', method: 'PATCH', path: '/api/threads/{threadId}', pathParams: ['threadId'], body: [] },
    }],
  }
  assert.equal(validateManifest(base).ok, true)
  const bogus = structuredClone(base)
  bogus.operations[0].http.method = 'TRACE'
  const res = validateManifest(bogus)
  assert.equal(res.ok, false)
  assert.ok(res.errors.some((e) => e.includes('method')))
})

test('schema: nonBlank accepted only as a boolean on string leaves', () => {
  const mk = (props) => ({
    id: 'demo_nb', toolName: 'demo_nb', description: 'd',
    requiredScopes: ['forum.read'],
    errors: [{ code: 'invalid_arguments' }],
    operations: [{
      name: 'go', description: 'd',
      arguments: { properties: props, required: [] },
      result: { type: 'json' }, errors: ['invalid_arguments'],
      http: { target: 'svc-forum', method: 'GET', path: '/api/stats' },
    }],
  })
  assert.equal(validateManifest(mk({ summaryMd: { type: 'string', nonBlank: true } })).ok, true)
  assert.equal(validateManifest(mk({ summaryMd: { type: 'string', nonBlank: false } })).ok, true)
  for (const bad of [
    { summaryMd: { type: 'string', nonBlank: 'yes' } }, // non-boolean
    { summaryMd: { type: 'string', nonBlank: 1 } },
    { page: { type: 'integer', nonBlank: true } }, // non-string leaf
    { payload: { type: 'json', nonBlank: true } },
  ]) {
    const res = validateManifest(mk(bad))
    assert.equal(res.ok, false, `nonBlank ${JSON.stringify(bad)} must be rejected`)
    assert.ok(res.errors.some((e) => e.includes('nonBlank')), res.errors.join('; '))
  }
})

test('sanitizer: spec CTR-FMC-012 rules + existing wider rules, additively', () => {
  // Step 1: Bearer/Basic scheme credentials → <AUTH_REDACTED> (scheme kept,
  // matched case-insensitively — CTR-FMC-012 V2; see the six-case matrix below).
  assert.equal(sanitizeErrorDetail('failed with Bearer abc123'), 'failed with Bearer <AUTH_REDACTED>')
  assert.equal(sanitizeErrorDetail('failed with Basic QUJDREVG'), 'failed with Basic <AUTH_REDACTED>')
  // Step 2: sensitive-keyed assignments (quoted and bare) → <SENSITIVE_REDACTED>.
  const keyed = sanitizeErrorDetail('rejected: authorization="Bearer xyz" token=abcdef0123456789abcdef0123456789 secret="s" credential=c-1')
  assert.ok(!keyed.includes('xyz'), 'authorization value must go')
  assert.ok(!keyed.includes('abcdef0123456789'))
  assert.ok(!keyed.includes('"s"'))
  assert.ok(!keyed.includes('c-1') || keyed.includes('credential=<'), 'credential value must go')
  // Step 3: opaque runs (24+) → <OPAQUE_REDACTED>; short runs survive spec step.
  const opaque = sanitizeErrorDetail('id ABCDEFGHIJKLMNOPQRSTUVWX24 and ok')
  assert.ok(opaque.includes('<OPAQUE_REDACTED>'))
  assert.ok(sanitizeErrorDetail('ref abcd1234').includes('abcd1234'))
  // EXISTING wider rules stay effective (no security regression):
  const legacy = sanitizeErrorDetail('rejected because api_key="sk-live-999999999999" password=hunter2')
  assert.ok(!legacy.includes('sk-live-999999999999'))
  assert.ok(!legacy.includes('hunter2'))
  const scheme = sanitizeErrorDetail('authorization=NTLM TlRMTVNTUAABAAAAAAAABgAAAAAAAQ==')
  assert.ok(!scheme.includes('TlRMTVNTUAABAAAAAAAABgAAAAAAAQ'))
  // Idempotency: a second pass is a fixed point.
  const once = sanitizeErrorDetail('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.token=abc token=tok_1234567890abcdefghij')
  assert.equal(sanitizeErrorDetail(once), once)
})

test('sanitizer: truncation is code-point-correct at exactly 500', () => {
  const emoji = '配置失败😀'.repeat(150) // 900 code points (7 UTF-16 units per group of 6 cps)
  const out = sanitizeErrorDetail(emoji)
  assert.equal([...out].length, 500)
  assert.ok(out.length >= 500 && out.length <= 1000)
  assert.ok(!/[\uD800-\uDBFF]$/.test(out), 'must not end with a split surrogate')
  assert.equal([...sanitizeErrorDetail('short')].length, 5)
})

test('buildDownstreamError: sanitized detail never carries auth canaries', () => {
  const headers = new Headers({ 'x-request-id': 'req-1' })
  const err = buildDownstreamError(400, JSON.stringify({
    error: { code: 'bad_request', message: 'token=abcdefghij0123456789ABCDEFGH echoed Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.sig.part' },
  }), headers)
  assert.equal(err.errorCode, 'bad_request')
  assert.equal(err.status, 400)
  assert.equal(err.requestId, 'req-1')
  assert.ok(!err.detail.includes('eyJhbGciOiJIUzI1NiJ9'))
  assert.ok(!err.detail.includes('abcdefghij0123456789ABCDEFGH'))
  assert.ok([...err.detail].length <= 500)
})

// ═══ CTR-FMC-012 frozen six-case matrix: step 1 is case-insensitive (V2) ════

test('sanitizer: six-case matrix — every casing of Bearer/Basic redacts via step 1', () => {
  const token = 'dGhpcyBpcyBhIHNlY3JldA'
  const cases = [
    ['bearer', `failed with bearer ${token}`],
    ['Bearer', `failed with Bearer ${token}`],
    ['BeArEr', `failed with BeArEr ${token}`],
    ['basic', 'failed with basic QUJDREVG'],
    ['Basic', 'failed with Basic QUJDREVG'],
    ['BaSiC', 'failed with BaSiC QUJDREVG'],
  ]
  for (const [scheme, input] of cases) {
    const out = sanitizeErrorDetail(input)
    assert.equal(out, `failed with ${scheme} <AUTH_REDACTED>`, `${scheme}: scheme spelling preserved + redacted`)
  }
})
