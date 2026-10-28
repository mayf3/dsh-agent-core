import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  workflowAssistanceActionManifest,
  workflowAssistanceReadManifest,
} from '../src/capabilities/workflow-assistance.js'
import { createBrokerGateway } from '../src/gateway.js'
import { buildToolDefinition } from '../src/registry.js'
import { validateManifest } from '../src/schema.js'

const ID = Object.freeze({
  caller: 'agt_current-review-owner',
  case: '11111111-1111-4111-8111-111111111111',
  sourceWorkflow: '22222222-2222-4222-8222-222222222222',
  sourceVisit: '33333333-3333-4333-8333-333333333333',
  binding: '44444444-4444-4444-8444-444444444444',
  childDefinitionVersion: '55555555-5555-4555-8555-555555555555',
  transition: '66666666-6666-4666-8666-666666666666',
  terminalEvent: '77777777-7777-4777-8777-777777777777',
  submission: '88888888-8888-4888-8888-888888888888',
})
const ACCEPTANCE_DIGEST = '9'.repeat(64)
const SUBMISSION_DIGEST = 'a'.repeat(64)

function detailDto(overrides = {}) {
  return {
    assistanceCaseId: ID.case,
    workflowInstanceId: ID.sourceWorkflow,
    nodeVisitId: ID.sourceVisit,
    status: 'OWNER_PENDING',
    workflowStateVersion: 3,
    governanceBinding: {
      assistanceCaseId: ID.case,
      status: 'BOUND',
      bindingId: ID.binding,
      acceptanceContractDigest: ACCEPTANCE_DIGEST,
      source: { workflowInstanceId: ID.sourceWorkflow, nodeVisitId: ID.sourceVisit },
      child: {
        definitionVersionId: ID.childDefinitionVersion,
        acceptanceTransitionId: ID.transition,
      },
      currentReview: { deliveryStatus: 'DELIVERED', reviewStatus: 'OUTSTANDING' },
    },
    governanceTerminalProof: {
      definitionVersionId: ID.childDefinitionVersion,
      transitionId: ID.transition,
      acceptanceContractDigest: ACCEPTANCE_DIGEST,
      terminalEventId: ID.terminalEvent,
      submissionId: ID.submission,
      submissionDigest: SUBMISSION_DIGEST,
      verdict: 'ACCEPTED',
    },
    ...overrides,
  }
}

async function gatewayFixture(t, { detail = detailDto(), detailStatus = 200, denyScopes = [] } = {}) {
  const tokenRequests = []
  const svcRequests = []
  const tokenServer = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      const fields = new URLSearchParams(raw)
      const scope = fields.get('scope')
      tokenRequests.push({ authorization: req.headers.authorization, scope })
      if (denyScopes.includes(scope)) {
        res.writeHead(403, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'insufficient_scope' }))
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ access_token: `token-${scope}`, expires_in: 3600 }))
    })
  })
  await new Promise((resolve) => tokenServer.listen(0, '127.0.0.1', resolve))

  const svcServer = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      const entry = {
        method: req.method,
        path: req.url,
        authorization: req.headers.authorization,
        idempotencyKey: req.headers['idempotency-key'],
        body: raw === '' ? undefined : JSON.parse(raw),
      }
      svcRequests.push(entry)
      if (req.method === 'GET') {
        res.writeHead(detailStatus, { 'content-type': 'application/json' })
        res.end(detailStatus === 200 ? JSON.stringify(typeof detail === 'function' ? detail() : detail) : JSON.stringify({ error: { code: 'http_503' } }))
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ status: 'RESOLVED' }))
    })
  })
  await new Promise((resolve) => svcServer.listen(0, '127.0.0.1', resolve))

  const dir = await mkdtemp(join(tmpdir(), 'gcr-current-review-'))
  t.after(async () => {
    await new Promise((resolve) => { tokenServer.closeAllConnections?.(); tokenServer.close(resolve) })
    await new Promise((resolve) => { svcServer.closeAllConnections?.(); svcServer.close(resolve) })
    await rm(dir, { recursive: true, force: true })
  })
  const credentialsFile = join(dir, 'credentials.json')
  await writeFile(credentialsFile, JSON.stringify({
    version: 1,
    credentials: { [ID.caller]: { clientId: 'gcr-owner-client', clientSecret: 'synthetic-secret' } },
  }))
  const svcAddress = svcServer.address()
  const tokenAddress = tokenServer.address()
  const gateway = createBrokerGateway({
    manifests: [workflowAssistanceReadManifest, workflowAssistanceActionManifest],
    targets: [{ targetId: 'svc-workflow', allowedOrigin: `http://127.0.0.1:${svcAddress.port}`, audience: 'svc-workflow' }],
    authServiceOrigin: `http://127.0.0.1:${tokenAddress.port}`,
    credentialsFile,
  })
  return { gateway, tokenRequests, svcRequests }
}

test('current review resolve is registered with the declared exact operation schema', () => {
  const operationName = 'resolve_current_governance_review'
  const op = workflowAssistanceActionManifest.operations.find((item) => item.name === operationName)
  assert.ok(op, 'the trusted current-review action must exist as a registered manifest operation')
  assert.deepEqual(op.arguments.required, [
    'assistanceCaseId', 'expectedWorkflowStateVersion', 'resolution',
  ])
  assert.equal(op.arguments.additionalProperties, false)

  const { definition } = buildToolDefinition({ manifest: workflowAssistanceActionManifest, handlers: {} })
  assert.ok(definition.parameters.operation.enum.includes(operationName))
  assert.ok(definition.description.includes(operationName))
})

test('HTTP manifest validates trusted response reads, response checks and projection paths', () => {
  const input = {
    id: 'test.read_projection',
    description: 'Trusted read projection fixture.',
    requiredScopes: ['write.scope'],
    errors: [{ code: 'invalid_arguments' }],
    operations: [{
      name: 'write',
      arguments: { properties: {
        id: { type: 'string' }, version: { type: 'integer' }, payload: { type: 'object' },
      }, required: ['id', 'version', 'payload'], additionalProperties: false },
      errors: ['invalid_arguments'],
      http: {
        target: 'svc', method: 'POST', path: '/cases/{id}', pathParams: ['id'],
        body: ['version', 'payload'], idempotencyKey: true,
        readProjection: {
          capabilityId: 'test.detail', operation: 'detail',
          argumentBindings: [{ targetArg: 'caseId', sourceArg: 'id' }],
          responseChecks: [{ responsePath: ['caseId'], equalsArg: 'id', errorCode: 'invalid_arguments' }],
          bodyProjections: [{ responsePath: ['proof', 'digest'], destinationBodyPath: ['payload', 'proof', 'digest'], valueType: 'string' }],
          collisionBodyPath: ['payload', 'proof'],
        },
      },
    }],
  }
  const valid = validateManifest(input)
  assert.equal(valid.ok, true)
  assert.deepEqual(valid.manifest.operations[0].http.readProjection, input.operations[0].http.readProjection)

  for (const mutate of [
    (readProjection) => { readProjection.capabilityId = '' },
    (readProjection) => { readProjection.argumentBindings[0].sourceArg = 'undeclared' },
    (readProjection) => { readProjection.responseChecks[0].responsePath = ['__proto__'] },
    (readProjection) => { readProjection.bodyProjections[0].destinationBodyPath = ['payload', '__proto__', 'digest'] },
    (readProjection) => { readProjection.collisionBodyPath = ['unbound', 'proof'] },
  ]) {
    const invalid = structuredClone(input)
    mutate(invalid.operations[0].http.readProjection)
    assert.equal(validateManifest(invalid).ok, false)
  }

  const nonObjectParent = structuredClone(input)
  nonObjectParent.operations[0].arguments.properties.payload.properties = { meta: { type: 'string' } }
  nonObjectParent.operations[0].http.readProjection.bodyProjections[0].destinationBodyPath = ['payload', 'meta', 'digest']
  assert.equal(validateManifest(nonObjectParent).ok, false)

  const closedParent = structuredClone(input)
  closedParent.operations[0].arguments.properties.payload.additionalProperties = false
  assert.equal(validateManifest(closedParent).ok, false)
})

test('gateway registration rejects unresolved or undeclared read sources and argument bindings', () => {
  const invalidCases = [
    (action) => { action.operations[1].http.readProjection.capabilityId = 'missing_read' },
    (action) => { action.operations[1].http.readProjection.operation = 'missing' },
    (action) => { action.operations[1].http.readProjection.argumentBindings[0].targetArg = 'undeclared' },
    (action) => { action.operations[1].http.readProjection.argumentBindings[0].targetArg = 'limit' },
  ]
  for (const mutate of invalidCases) {
    const action = structuredClone(workflowAssistanceActionManifest)
    mutate(action)
    assert.throws(() => createBrokerGateway({
      manifests: [workflowAssistanceReadManifest, action],
      targets: [], authServiceOrigin: '', credentialsFile: undefined,
    }), /invalid read projection/)
  }
})

test('gateway reads the exact current proof then resolves as the same actual caller with separate scopes', async (t) => {
  const { gateway, tokenRequests, svcRequests } = await gatewayFixture(t)
  const result = await gateway.execute({
    capabilityId: 'workflow_assistance_action',
    operation: 'resolve_current_governance_review',
    args: {
      assistanceCaseId: ID.case,
      expectedWorkflowStateVersion: 3,
      resolution: { message: 'Owner explicitly accepted the reviewed child result.', supportingPayload: { preserved: true } },
    },
  }, { agentId: ID.caller })

  assert.deepEqual(result, { ok: true, result: { status: 'RESOLVED' } })
  assert.deepEqual(tokenRequests.map(({ scope }) => scope).sort(), ['workflow.execute', 'workflow.read'])
  assert.equal(new Set(tokenRequests.map(({ authorization }) => authorization)).size, 1)
  assert.deepEqual(svcRequests.map(({ method }) => method), ['GET', 'POST'])
  assert.equal(svcRequests[0].path, `/internal/v1/assistance-cases/${ID.case}`)
  assert.equal(svcRequests[0].authorization, 'Bearer token-workflow.read')
  assert.equal(svcRequests[1].authorization, 'Bearer token-workflow.execute')
  assert.equal(svcRequests[1].body.expectedWorkflowStateVersion, 3)
  assert.deepEqual(svcRequests[1].body.resolution, {
    message: 'Owner explicitly accepted the reviewed child result.',
    supportingPayload: {
      preserved: true,
      governanceChildReview: {
        bindingId: ID.binding,
        terminalEventId: ID.terminalEvent,
        submissionId: ID.submission,
        submissionDigest: SUBMISSION_DIGEST,
        acceptanceContractDigest: ACCEPTANCE_DIGEST,
      },
    },
  })
  assert.match(svcRequests[1].idempotencyKey, /^ik-workflow-assistance-action-/)
})

test('read-scope denial uses the same actual credential and sends no detail GET or resolve POST', async (t) => {
  const { gateway, tokenRequests, svcRequests } = await gatewayFixture(t, { denyScopes: ['workflow.read'] })
  const result = await gateway.execute({
    capabilityId: 'workflow_assistance_action', operation: 'resolve_current_governance_review',
    args: {
      assistanceCaseId: ID.case, expectedWorkflowStateVersion: 3,
      resolution: { message: 'Owner decision.' },
    },
  }, { agentId: ID.caller })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'authorization_denied')
  assert.deepEqual(tokenRequests.map(({ scope }) => scope), ['workflow.execute', 'workflow.read'])
  assert.equal(new Set(tokenRequests.map(({ authorization }) => authorization)).size, 1)
  assert.deepEqual(svcRequests, [])
})

test('pre-existing reserved target is rejected before any authorization or source read', async (t) => {
  const { gateway, tokenRequests, svcRequests } = await gatewayFixture(t)
  const result = await gateway.execute({
    capabilityId: 'workflow_assistance_action', operation: 'resolve_current_governance_review',
    args: {
      assistanceCaseId: ID.case, expectedWorkflowStateVersion: 3,
      resolution: { message: 'Owner decision.', supportingPayload: { governanceChildReview: { forged: true } } },
    },
  }, { agentId: ID.caller })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'binding_error')
  assert.deepEqual(tokenRequests, [])
  assert.deepEqual(svcRequests, [])
})

test('failed authoritative read never reaches resolve POST', async (t) => {
  const { gateway, svcRequests } = await gatewayFixture(t, { detailStatus: 503 })
  const result = await gateway.execute({
    capabilityId: 'workflow_assistance_action', operation: 'resolve_current_governance_review',
    args: {
      assistanceCaseId: ID.case, expectedWorkflowStateVersion: 3,
      resolution: { message: 'Owner decision.' },
    },
  }, { agentId: ID.caller })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'http_5xx')
  assert.deepEqual(svcRequests.map(({ method }) => method), ['GET'])
})

test('stale version and inconsistent current-review detail stop after one GET and before POST', async (t) => {
  const wrongCase = detailDto({ assistanceCaseId: '99999999-9999-4999-8999-999999999999' })
  const staleVersion = detailDto({ workflowStateVersion: 4 })
  const wrongSource = detailDto()
  wrongSource.governanceBinding.source.workflowInstanceId = '99999999-9999-4999-8999-999999999999'
  const closedReview = detailDto()
  closedReview.governanceBinding.currentReview.reviewStatus = 'SETTLED'
  const nonAccepted = detailDto()
  nonAccepted.governanceTerminalProof.verdict = 'REJECTED'
  const incompleteProof = detailDto()
  delete incompleteProof.governanceTerminalProof.submissionDigest
  const responses = [wrongCase, staleVersion, wrongSource, closedReview, nonAccepted, incompleteProof]
  let detailIndex = 0
  const { gateway, svcRequests } = await gatewayFixture(t, { detail: () => responses[detailIndex++] })
  const expectedErrors = [
    'authoritative_reference_unavailable',
    'workflow_state_version_conflict',
    'authoritative_reference_unavailable',
    'authoritative_reference_unavailable',
    'authoritative_reference_unavailable',
    'authoritative_reference_unavailable',
  ]
  for (const expectedCode of expectedErrors) {
    const result = await gateway.execute({
      capabilityId: 'workflow_assistance_action', operation: 'resolve_current_governance_review',
      args: {
        assistanceCaseId: ID.case, expectedWorkflowStateVersion: 3,
        resolution: { message: 'Owner decision.' },
      },
    }, { agentId: ID.caller })
    assert.equal(result.ok, false)
    assert.equal(result.error.code, expectedCode)
  }
  assert.deepEqual(svcRequests.map(({ method }) => method), ['GET', 'GET', 'GET', 'GET', 'GET', 'GET'])
})
