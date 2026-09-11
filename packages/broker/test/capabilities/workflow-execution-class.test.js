// AGENT_CORE_WORKFLOW_EXECUTION_CLASS_BROKER_V1 — implementation closure tests.
//
// Physically separate from workflow-execute.test.js (structure gate 500-line
// ceiling): this file owns the create_instance binding freeze AS EXTENDED by
// the accepted companion (optional executionClass + declared invalid_input
// error row) and the hard-evidence cases for the class semantics.
import test from 'node:test'
import assert from 'node:assert/strict'

import { manifests as workflowManifests } from '../../src/capabilities/workflow.js'
import { validateManifest } from '../../src/schema.js'
import { createHttpTransport } from '../../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../../test-support/capability-fixtures.js'

const executeManifest = () => workflowManifests.find((manifest) => manifest.id === 'workflow_execute')

const svcError = (res, status, code, message, requestId) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'x-request-id': requestId })
  res.end(JSON.stringify({ error: { code, message } }))
}

test('workflow_execute: create_instance binding freezes WITH the accepted executionClass companion', () => {
  const manifest = executeManifest()
  assert.equal(validateManifest(manifest).ok, true)
  const op = manifest.operations.find((candidate) => candidate.name === 'create_instance')
  assert.ok(op)
  assert.deepEqual(Object.keys(op.arguments.properties), [
    'domainId',
    'definitionVersionId',
    'contextPayload',
    'metadata',
    'externalReference',
    'externalUrl',
    'executionClass',
  ])
  // CTR-WECB-001/002: optional closed enum, structurally validated
  // broker-side BEFORE transport; never required; never an identity field.
  assert.equal(op.arguments.properties.executionClass.type, 'string')
  assert.deepEqual(op.arguments.properties.executionClass.enum, ['BUSINESS', 'NON_BUSINESS_TEST'])
  assert.ok(!op.arguments.required.includes('executionClass'))
  assert.deepEqual(op.arguments.required, ['domainId', 'definitionVersionId', 'contextPayload', 'metadata'])
  assert.deepEqual(op.http, {
    target: 'svc-workflow',
    method: 'POST',
    path: '/internal/v1/workflow-instances',
    body: ['domainId', 'definitionVersionId', 'contextPayload', 'metadata', 'externalReference', 'externalUrl', 'executionClass'],
    idempotencyKey: true,
  })
  // CTR-WECB-003: the three svc-owned class error codes are DECLARED for
  // verbatim passthrough (not_domain_owner / idempotency_conflict pre-date
  // this companion; invalid_input is the single new table row).
  const codes = manifest.errors.map((e) => e.code)
  for (const code of ['not_domain_owner', 'invalid_input', 'idempotency_conflict']) {
    assert.ok(codes.includes(code), `declared error family missing: ${code}`)
  }
})

test('WEC companion: legacy create (absent executionClass) maps to a body with NO executionClass key — legacy wire byte-identical', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => json(res, 201, { workflowInstanceId: 'wf-wec-1', workflowStateVersion: 1 }))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(executeManifest(), transport)

  const result = await definition.execute({
    operation: 'create_instance',
    domainId: 'domain-9',
    definitionVersionId: 'defver-3',
    contextPayload: {},
    metadata: null,
  })
  assert.equal(result.ok, true)
  // The KEY itself is absent from the serialized body (not undefined-valued):
  // the builder adds keys only when the arg !== undefined (bindRequest).
  assert.equal(Object.prototype.hasOwnProperty.call(workflow.requests[0].body, 'executionClass'), false)
  assert.deepEqual(Object.keys(workflow.requests[0].body), [
    'domainId',
    'definitionVersionId',
    'contextPayload',
    'metadata',
  ])

  await tokenServer.close()
  await workflow.close()
})

test('WEC companion: executionClass BUSINESS and NON_BUSINESS_TEST are forwarded verbatim', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => json(res, 201, { workflowInstanceId: 'wf-wec-2', workflowStateVersion: 1 }))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(executeManifest(), transport)

  for (const executionClass of ['BUSINESS', 'NON_BUSINESS_TEST']) {
    const result = await definition.execute({
      operation: 'create_instance',
      domainId: 'domain-9',
      definitionVersionId: 'defver-3',
      contextPayload: {},
      metadata: null,
      executionClass,
    })
    assert.equal(result.ok, true)
    assert.equal(workflow.requests.at(-1).body.executionClass, executionClass)
  }

  await tokenServer.close()
  await workflow.close()
})

test('WEC companion: executionClass null / unknown value fail closed as invalid_arguments BEFORE any transport', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => json(res, 201, { workflowInstanceId: 'wf-wec-3', workflowStateVersion: 1 }))
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(executeManifest(), transport)

  for (const executionClass of [null, 'SOMETHING_ELSE', 'business']) {
    const result = await definition.execute({
      operation: 'create_instance',
      domainId: 'domain-9',
      definitionVersionId: 'defver-3',
      contextPayload: {},
      metadata: null,
      executionClass,
    })
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'invalid_arguments')
  }
  // Zero HTTP requests reached svc-workflow: structural validation happens
  // before any credential mint or business call (DEC-WECB-003).
  assert.equal(workflow.requests.length, 0)

  await tokenServer.close()
  await workflow.close()
})

test('WEC companion: svc class error families preserve verbatim (not_domain_owner / invalid_input / idempotency_conflict)', async () => {
  const tokenServer = await startTokenServer()
  const failures = {
    'domain-owner-403': [403, 'not_domain_owner', 'caller is not a domain owner', 'req-wec-403'],
    'domain-422': [422, 'invalid_input', 'executionClass must be BUSINESS or NON_BUSINESS_TEST', 'req-wec-422'],
    'domain-409': [409, 'idempotency_conflict', 'idempotency key was reused', 'req-wec-409'],
  }
  const workflow = await startMockServer((req, res, entry) => {
    const failure = failures[entry.body.domainId]
    return svcError(res, ...failure)
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(executeManifest(), transport)

  for (const [domainId, [status, code, message, requestId]] of Object.entries(failures)) {
    const result = await definition.execute({
      operation: 'create_instance',
      domainId,
      definitionVersionId: 'defver-3',
      contextPayload: {},
      metadata: null,
      executionClass: 'NON_BUSINESS_TEST',
    })
    assert.equal(result.ok, false)
    // Verbatim passthrough: code/status/detail/requestId unchanged; zero
    // broker rewriting or retry (AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1).
    assert.equal(result.error.code, code)
    assert.equal(result.error.status, status)
    assert.equal(result.error.detail, message)
    assert.equal(result.error.requestId, requestId)
  }
  // One request per failure case — no broker-side retry.
  assert.equal(workflow.requests.length, 3)

  await tokenServer.close()
  await workflow.close()
})
