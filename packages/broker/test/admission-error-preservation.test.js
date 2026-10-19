import test from 'node:test'
import assert from 'node:assert/strict'

import { invoke } from '../src/mapping.js'
import { createHttpTransport, createHttpHandlers } from '../src/transport.js'
import { sanitizeErrorDetail } from '../src/error-detail-sanitizer.js'
import { workflowDefinitionAuthoringManifest } from '../src/capabilities/workflow-definition-authoring.js'
import { workflowExecuteManifest } from '../src/capabilities/workflow-execute.js'

// Seven sanitized svc-workflow admission codes, transcribed verbatim from
// svc-workflow @ bfc28c15320acab8cf7d7a36128cd5c9db9a1b1a
// src/auth/admission.rs sanitized_code()/sanitized_status(): business
// rejections are 422; directory config/transport failures and the
// commit-outcome-uncertain case are 503 (fail closed, never blindly retried).
const ADMISSION_CODES = [
  ['admission_configuration', 503],
  ['admission_timeout', 422],
  ['admission_commit_outcome_unknown', 503],
  ['admission_unavailable', 503],
  ['admission_denied', 422],
  ['admission_rejected', 422],
  ['admission_malformed_response', 503],
]
const ADMISSION_STATUSES = new Map(ADMISSION_CODES)
const ADMISSION_DETAIL = 'workflow assignment was not admitted'
const REQUEST_ID = 'req-admission-001'

// Representative broker paths that reach svc admission: definition authoring
// publish, instance create, instance transition (synthetic handler responses —
// no real Auth/Core/Workflow traffic).
const REPRESENTATIVE_PATHS = [
  {
    label: 'authoring publish_version',
    manifest: workflowDefinitionAuthoringManifest,
    operation: 'publish_version',
    args: { domainId: '00000000-0000-0000-0000-000000000001', definitionId: '00000000-0000-0000-0000-000000000002', versionId: '00000000-0000-0000-0000-000000000003' },
  },
  {
    label: 'execute create_instance',
    manifest: workflowExecuteManifest,
    operation: 'create_instance',
    args: { domainId: '00000000-0000-0000-0000-000000000001', definitionVersionId: '00000000-0000-0000-0000-000000000003', contextPayload: {}, metadata: {} },
  },
  {
    label: 'execute transition',
    manifest: workflowExecuteManifest,
    operation: 'transition',
    args: { workflowInstanceId: '00000000-0000-0000-0000-000000000004', transitionDefinitionId: '00000000-0000-0000-0000-000000000005', expectedWorkflowStateVersion: 1 },
  },
]

/** Run one operation through mapping.invoke with a stub handler. */
function callOp(manifest, operation, args, handlerResult) {
  const handlers = { [operation]: async () => handlerResult }
  return invoke(manifest, handlers, { operation, args }, { resolvePrincipal: () => undefined })
}

test('all seven admission codes are declared in both write manifests', () => {
  for (const manifest of [workflowDefinitionAuthoringManifest, workflowExecuteManifest]) {
    const declared = new Set(manifest.errors.map((e) => e.code))
    for (const [code] of ADMISSION_CODES) {
      assert.ok(declared.has(code), `${manifest.id} must declare ${code}`)
    }
  }
})

for (const [code, status] of ADMISSION_CODES) {
  for (const path of REPRESENTATIVE_PATHS) {
    test(`admission preservation: ${code} (${status}) kept on ${path.label}`, async () => {
      const res = await callOp(path.manifest, path.operation, path.args, {
        errorCode: code,
        status,
        detail: ADMISSION_DETAIL,
        requestId: REQUEST_ID,
      })
      assert.equal(res.ok, false, 'an admission failure must never surface as success')
      assert.equal(res.error.code, code, 'sanitized admission code must not degrade to http_4xx/http_5xx')
      assert.equal(res.error.status, status)
      assert.equal(res.error.detail, ADMISSION_DETAIL)
      assert.equal(res.error.requestId, REQUEST_ID)
    })
  }
}

test('undeclared downstream codes still fall back to http_4xx/http_5xx', async () => {
  for (const manifest of [workflowDefinitionAuthoringManifest, workflowExecuteManifest]) {
    const { operation, args } = REPRESENTATIVE_PATHS.find((p) => p.manifest === manifest)
    const four = await callOp(manifest, operation, args, { errorCode: 'admission_bogus_family', status: 422, requestId: REQUEST_ID })
    assert.equal(four.ok, false)
    assert.equal(four.error.code, 'http_4xx')
    assert.equal(four.error.status, 422)
    const five = await callOp(manifest, operation, args, { errorCode: 'totally_unknown_code', status: 503, requestId: REQUEST_ID })
    assert.equal(five.ok, false)
    assert.equal(five.error.code, 'http_5xx')
    assert.equal(five.error.status, 503)
  }
})

test('commit-outcome-unknown stays 503 UNKNOWN-class, not a retryable 4xx', async () => {
  for (const manifest of [workflowDefinitionAuthoringManifest, workflowExecuteManifest]) {
    const { operation, args } = REPRESENTATIVE_PATHS.find((p) => p.manifest === manifest)
    const res = await callOp(manifest, operation, args, { errorCode: 'admission_commit_outcome_unknown', status: 503, requestId: REQUEST_ID })
    assert.equal(res.error.code, 'admission_commit_outcome_unknown')
    assert.equal(res.error.status, 503)
    assert.ok(!manifest.errors.some((e) => e.code === 'admission_commit_outcome_unknown' && /422/.test(e.description)))
  }
})

test('sentinel: sanitizer redacts auth material before detail reaches the wire', () => {
  const dirty = 'admission failed for secret=agent-secret-abc with Authorization: Bearer tok_123456 near token=short'
  const clean = sanitizeErrorDetail(dirty)
  assert.ok(!clean.includes('agent-secret-abc'))
  assert.ok(!clean.includes('tok_123456'))
  assert.ok(!clean.includes('Bearer tok_123456'))
})

// End-to-end through the real HTTP binding with a stubbed fetch: svc answers
// with the sanitized admission family; the wire must keep the exact code.
async function e2e(manifest, operation, args, status, svcCode, svcMessage) {
  let fetchCalls = 0
  const svcResponse = () => new Response(JSON.stringify({ error: { code: svcCode, message: svcMessage } }), {
    status,
    headers: { 'content-type': 'application/json', 'x-request-id': REQUEST_ID },
  })
  const fetchImpl = async (url) => {
    if (String(url).includes('/oauth/token')) {
      return new Response(JSON.stringify({ access_token: 'tok-test', token_type: 'Bearer', expires_in: 3600 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    fetchCalls += 1
    return svcResponse()
  }
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'client-a', clientSecret: 'secret-a' }) },
    targets: [{ targetId: 'svc-workflow', allowedOrigin: 'http://127.0.0.1:1', audience: 'demo-aud' }],
    fetchImpl,
  })
  const handlers = createHttpHandlers(manifest, transport)
  const res = await invoke(manifest, handlers, { operation, args }, { resolvePrincipal: () => undefined })
  return { res, fetchCalls }
}

test('e2e authoring publish: admission_commit_outcome_unknown (503) survives the wire, single call, sanitized detail', async () => {
  const p = REPRESENTATIVE_PATHS[0]
  const { res, fetchCalls } = await e2e(
    p.manifest, p.operation, p.args, 503, 'admission_commit_outcome_unknown',
    `workflow assignment was not admitted (secret=agent-secret-abc, Authorization: Bearer tok_123456)`,
  )
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'admission_commit_outcome_unknown', 'must not degrade to http_5xx')
  assert.equal(res.error.status, 503)
  assert.equal(res.error.requestId, REQUEST_ID)
  assert.ok(res.error.detail.includes('workflow assignment was not admitted'))
  assert.ok(!res.error.detail.includes('agent-secret-abc'))
  assert.ok(!res.error.detail.includes('tok_123456'))
  assert.equal(fetchCalls, 1, '503 admission must not be auto-retried')
})

test('e2e execute transition: admission_denied (422) survives the wire, single call', async () => {
  const p = REPRESENTATIVE_PATHS[2]
  const { res, fetchCalls } = await e2e(p.manifest, p.operation, p.args, 422, 'admission_denied', ADMISSION_DETAIL)
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'admission_denied', 'must not degrade to http_4xx')
  assert.equal(res.error.status, 422)
  assert.equal(res.error.detail, ADMISSION_DETAIL)
  assert.equal(fetchCalls, 1)
})

test('e2e execute create_instance: admission_unavailable (503) survives the wire, single call', async () => {
  const p = REPRESENTATIVE_PATHS[1]
  const { res, fetchCalls } = await e2e(p.manifest, p.operation, p.args, 503, 'admission_unavailable', ADMISSION_DETAIL)
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'admission_unavailable', 'must not degrade to http_5xx')
  assert.equal(res.error.status, 503)
  assert.equal(fetchCalls, 1)
})
