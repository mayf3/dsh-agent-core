import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  createWorkflowHumanPrincipalProjectionAccess,
  validateProjectionArgs,
} from '../../src/identity/workflow-human-principal-projection.js'
import {
  TARGET_HUMAN_PRINCIPAL_ID,
  WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_CAPABILITY_ID,
} from '../../../broker/src/capabilities/workflow-human-principal-projection.js'

const ORIGIN = 'https://workflow.example.test'
const ARGS = { principalId: TARGET_HUMAN_PRINCIPAL_ID, principalType: 'HUMAN', status: 'active' }
const READY = { principalId: TARGET_HUMAN_PRINCIPAL_ID, principalType: 'human', enabled: true }
const DISABLED = { principalId: TARGET_HUMAN_PRINCIPAL_ID, principalType: 'human', enabled: false }
const AGENT = { principalId: TARGET_HUMAN_PRINCIPAL_ID, principalType: 'agent', enabled: true }
const NOT_FOUND = { error: { code: 'principal_not_found', message: 'principal not found' } }

function response(status, body, { malformed = false } = {}) {
  return { status, json: async () => { if (malformed) throw new Error('not json'); return body } }
}

function makeProvider(sequence, {
  token = { accessToken: 'secret-token' },
  tokenError,
  workflowOrigin = ORIGIN,
  key = '7b7aca43-6836-45cb-9806-6b65d242093f',
} = {}) {
  const calls = []
  const tokenCalls = []
  const queue = [...sequence]
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    const next = queue.shift()
    if (next instanceof Error) throw next
    if (typeof next === 'function') return next(url, init)
    return next
  }
  const provider = createWorkflowHumanPrincipalProjectionAccess({
    workflowOrigin,
    acquireCallerToken: async (input) => {
      tokenCalls.push(input)
      if (tokenError !== undefined) throw tokenError
      return token
    },
    fetchImpl,
    createIdempotencyKey: () => key,
  })
  return { provider, calls, tokenCalls, queue }
}

function invoke(provider, args = ARGS, context = { callerAgentId: 'hr-agent' }) {
  return provider.handlers[WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_CAPABILITY_ID].provision(args, context)
}

test('authoritative validation accepts only the exact three-key target', async () => {
  assert.equal(validateProjectionArgs(ARGS).ok, true)
  const invalid = [
    null,
    {},
    { ...ARGS, extra: true },
    { ...ARGS, principalId: '00000000-0000-0000-0000-000000000000' },
    { ...ARGS, principalType: 'AGENT' },
    { ...ARGS, principalType: 'human' },
    { ...ARGS, status: 'disabled' },
  ]
  for (const args of invalid) {
    const fixture = makeProvider([])
    const result = await invoke(fixture.provider, args)
    assert.equal(result.error.code, 'invalid_arguments')
    assert.equal(fixture.tokenCalls.length, 0, 'invalid input acquires no token')
    assert.equal(fixture.calls.length, 0, 'invalid input performs zero svc-workflow calls')
  }
  const undefinedFixture = makeProvider([])
  const undefinedResult = await undefinedFixture.provider.handlers[WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_CAPABILITY_ID]
    .provision(undefined, { callerAgentId: 'hr-agent' })
  assert.equal(undefinedResult.error.code, 'invalid_arguments')
  assert.equal(undefinedFixture.calls.length, 0)
})

test('pre-existing exact active Human returns existing after one GET and zero POST', async () => {
  const fixture = makeProvider([response(200, READY)])
  const result = await invoke(fixture.provider)
  assert.equal(result.ok, true)
  assert.deepEqual(result.result, {
    outcome: 'existing',
    workflowPrincipalProjection: 'READY',
    principalId: TARGET_HUMAN_PRINCIPAL_ID,
    principalType: 'HUMAN',
    status: 'active',
  })
  assert.deepEqual(fixture.calls.map((call) => call.init.method), ['GET'])
  assert.equal(fixture.calls[0].url, `${ORIGIN}/internal/v1/admin/principals/${TARGET_HUMAN_PRINCIPAL_ID}`)
})

test('pre-existing non-Human Principal fails closed after one GET and zero POST', async () => {
  const fixture = makeProvider([response(200, AGENT)])
  const result = await invoke(fixture.provider)
  assert.equal(result.error.code, 'principal_type_conflict')
  assert.deepEqual(fixture.calls.map((call) => call.init.method), ['GET'])
})

test('absent and disabled-Human states each perform GET -> one fixed POST -> GET', async () => {
  for (const preflight of [response(404, NOT_FOUND), response(200, DISABLED)]) {
    const fixture = makeProvider([preflight, response(200, { principalId: TARGET_HUMAN_PRINCIPAL_ID, enabled: true }), response(200, READY)])
    const result = await invoke(fixture.provider)
    assert.equal(result.ok, true)
    assert.equal(result.result.outcome, 'provisioned')
    assert.deepEqual(fixture.calls.map((call) => call.init.method), ['GET', 'POST', 'GET'])
    const post = fixture.calls[1]
    assert.equal(post.url, `${ORIGIN}/internal/v1/admin/principals`)
    assert.deepEqual(JSON.parse(post.init.body), {
      principalId: TARGET_HUMAN_PRINCIPAL_ID,
      principalType: 'human',
      enabled: true,
      source: 'auth-service',
    })
    assert.equal(post.init.headers['Idempotency-Key'], '7b7aca43-6836-45cb-9806-6b65d242093f')
    assert.equal(post.init.headers.Authorization, 'Bearer secret-token')
    assert.equal(post.init.redirect, 'error')
  }
})

test('lost POST response is never retried; exact readback alone may prove READY', async () => {
  const fixture = makeProvider([response(404, NOT_FOUND), new Error('lost'), response(200, READY)])
  const result = await invoke(fixture.provider)
  assert.equal(result.ok, true)
  assert.equal(result.result.workflowPrincipalProjection, 'READY')
  assert.deepEqual(fixture.calls.map((call) => call.init.method), ['GET', 'POST', 'GET'])
  assert.equal(fixture.queue.length, 0)
})

test('every uncertain or failed POST gets one readback and never a blind retry', async () => {
  const cases = [
    {
      label: 'lost + absent',
      sequence: [response(404, NOT_FOUND), new Error('timeout'), response(404, NOT_FOUND)],
      code: 'projection_outcome_unknown',
    },
    {
      label: 'malformed response + absent',
      sequence: [response(404, NOT_FOUND), response(200, undefined, { malformed: true }), response(404, NOT_FOUND)],
      code: 'projection_outcome_unknown',
    },
    {
      label: 'success + disabled readback',
      sequence: [response(200, DISABLED), response(200, {}), response(200, DISABLED)],
      code: 'readback_mismatch',
    },
    {
      label: 'idempotency conflict + absent',
      sequence: [response(404, NOT_FOUND), response(409, { error: { code: 'idempotency_conflict' } }), response(404, NOT_FOUND)],
      code: 'idempotency_conflict',
    },
    {
      label: 'still processing + absent',
      sequence: [response(404, NOT_FOUND), response(425, { error: { code: 'command_still_processing' } }), response(404, NOT_FOUND)],
      code: 'command_still_processing',
    },
  ]
  for (const fixtureCase of cases) {
    const fixture = makeProvider(fixtureCase.sequence)
    const result = await invoke(fixture.provider)
    assert.equal(result.error.code, fixtureCase.code, fixtureCase.label)
    assert.deepEqual(fixture.calls.map((call) => call.init.method), ['GET', 'POST', 'GET'], fixtureCase.label)
    assert.equal(fixture.queue.length, 0, fixtureCase.label)
  }
})

test('a racing conflicting Principal is reported after POST with no further write', async () => {
  const fixture = makeProvider([
    response(404, NOT_FOUND),
    response(409, { error: { code: 'principal_type_conflict' } }),
    response(200, AGENT),
  ])
  const result = await invoke(fixture.provider)
  assert.equal(result.error.code, 'principal_type_conflict')
  assert.deepEqual(fixture.calls.map((call) => call.init.method), ['GET', 'POST', 'GET'])
})

test('malformed or mismatched readback never reports READY', async () => {
  const cases = [
    [response(200, { ...READY, extra: true }), 'malformed_response'],
    [response(200, { ...READY, principalId: '00000000-0000-0000-0000-000000000000' }), 'malformed_response'],
    [response(200, undefined, { malformed: true }), 'malformed_response'],
    [new Error('offline'), 'service_unavailable'],
  ]
  for (const [preflight, code] of cases) {
    const fixture = makeProvider([preflight])
    const result = await invoke(fixture.provider)
    assert.equal(result.ok, false)
    assert.equal(result.error.code, code)
    assert.deepEqual(fixture.calls.map((call) => call.init.method), ['GET'])
  }
  const postFixture = makeProvider([response(404, NOT_FOUND), response(200, {}), response(200, { ...READY, extra: true })])
  const postResult = await invoke(postFixture.provider)
  assert.equal(postResult.error.code, 'readback_mismatch')
})

test('declared svc-workflow consistency failures are preserved without a POST', async () => {
  const fixture = makeProvider([
    response(500, { error: { code: 'internal_consistency_error' } }),
  ])
  const result = await invoke(fixture.provider)
  assert.equal(result.error.code, 'internal_consistency_error')
  assert.deepEqual(fixture.calls.map((call) => call.init.method), ['GET'])
})

test('caller/token failures are sanitized and perform zero service I/O', async () => {
  const noCaller = makeProvider([])
  assert.equal((await invoke(noCaller.provider, ARGS, {})).error.code, 'internal_error')
  assert.equal(noCaller.calls.length, 0)

  for (const code of ['credential_unavailable', 'credential_invalid', 'access_denied', 'transport_failure']) {
    const fixture = makeProvider([], { tokenError: Object.assign(new Error('TOP-SECRET'), { code }) })
    const result = await invoke(fixture.provider)
    assert.equal(result.error.code, code)
    assert.equal(JSON.stringify(result).includes('TOP-SECRET'), false)
    assert.equal(fixture.calls.length, 0)
  }
  const empty = makeProvider([], { token: { accessToken: '' } })
  assert.equal((await invoke(empty.provider)).error.code, 'transport_failure')
})

test('constructor enforces trusted seams and the bounded deadline', () => {
  const base = { workflowOrigin: ORIGIN, acquireCallerToken: async () => ({ accessToken: 'x' }) }
  assert.throws(() => createWorkflowHumanPrincipalProjectionAccess({ ...base, workflowOrigin: 42 }), /workflowOrigin/)
  assert.throws(() => createWorkflowHumanPrincipalProjectionAccess({ ...base, acquireCallerToken: undefined }), /acquireCallerToken/)
  assert.throws(() => createWorkflowHumanPrincipalProjectionAccess({ ...base, timeoutMs: 5001 }), /timeoutMs/)
  assert.throws(() => createWorkflowHumanPrincipalProjectionAccess({ ...base, createIdempotencyKey: null }), /idempotency/)
})

test('compose wires the provider to the existing caller credential and workflow.admin token primitive', () => {
  const source = readFileSync(new URL('../../src/compose.js', import.meta.url), 'utf8')
  const start = source.indexOf("ctx.provide('workflowHumanPrincipalProjectionAccess'")
  assert.notEqual(start, -1)
  const block = source.slice(start, source.indexOf('  }))', start) + 5)
  assert.match(block, /loadCredentialFor\(brokerCredentialsFile, agentId\)/)
  assert.match(block, /authServiceOrigin: brokerAuthServiceOrigin/)
  assert.match(block, /resource: 'svc-workflow'/)
  assert.match(block, /scope: 'workflow\.admin'/)
  for (const forbidden of ['clientSecret:', 'principalId:', 'TARGET_HUMAN_PRINCIPAL_ID']) {
    assert.equal(block.includes(forbidden), false, `compose does not embed ${forbidden}`)
  }
})
