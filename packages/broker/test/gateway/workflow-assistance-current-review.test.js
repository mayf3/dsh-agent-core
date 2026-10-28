import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  workflowAssistanceActionManifest,
  workflowAssistanceReadManifest,
} from '../../src/capabilities/workflow-assistance.js'
import { createBrokerGateway } from '../../src/gateway.js'
import { buildToolDefinition } from '../../src/registry.js'
import { validateManifest } from '../../src/schema.js'

const ID = Object.freeze({
  caller: 'agt_current-review-owner',
  case: 'c5f1ce95-5938-4fae-81e5-171f38b45c5b',
  sourceWorkflow: 'eab83afb-cf78-4cca-a426-0952ed8a5baa',
  sourceVisit: 'fbbbde10-cb0b-46e7-8e98-f3041589606a',
  binding: '543f602a-2c46-46d3-af99-a361d97eb8ca',
  childDefinitionVersion: 'b612f2a2-204d-46d8-b222-4e430d4d1e97',
  transition: 'f08591b0-b5d7-4674-8f8f-9a2a7ec75b0c',
  terminalEvent: '22b20ba8-d31e-4ee8-8c33-70013cd52b85',
  submission: 'ac7ec06e-7e43-4e96-a154-43b71add4684',
})
const ACCEPTANCE_DIGEST = '9f6f81160cc724ba102fb71007e948a9ffaef219c737b2b1784de1fa2c8db570'
const SUBMISSION_DIGEST = 'd532cb26d292de518f3a5b9890c15147c50895520319d4a5a265555868b1934a'

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

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

async function gatewayFixture(t, { detail = detailDto(), detailStatus = 200, denyScopes = [], unknownPostOutcome = false } = {}) {
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
        const errorCode = detailStatus === 404 ? 'assistance_case_not_found_or_not_visible' : 'http_503'
        res.end(detailStatus === 200 ? JSON.stringify(typeof detail === 'function' ? detail() : detail) : JSON.stringify({ error: { code: errorCode } }))
        return
      }
      if (unknownPostOutcome) {
        req.socket.destroy()
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
  const call = deepFreeze({
    capabilityId: 'workflow_assistance_action',
    operation: 'resolve_current_governance_review',
    args: {
      assistanceCaseId: ID.case,
      expectedWorkflowStateVersion: 3,
      resolution: { message: 'Owner explicitly accepted the reviewed child result.', supportingPayload: { preserved: true } },
    },
  })
  const originalArgs = structuredClone(call.args)
  const result = await gateway.execute(call, { agentId: ID.caller })

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
  assert.deepEqual(call.args, originalArgs, 'the trusted read projection must not mutate the caller-owned argument object')
})

test('invalid current-review invocation fails before source GET or resolve POST', async (t) => {
  const { gateway, tokenRequests, svcRequests } = await gatewayFixture(t)
  const result = await gateway.execute({
    capabilityId: 'workflow_assistance_action', operation: 'resolve_current_governance_review',
    args: { assistanceCaseId: ID.case, expectedWorkflowStateVersion: 3 },
  }, { agentId: ID.caller })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'invalid_arguments')
  assert.deepEqual(tokenRequests, [])
  assert.deepEqual(svcRequests, [])
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

test('source 404 preserves its declared error and never reaches resolve POST', async (t) => {
  const { gateway, svcRequests } = await gatewayFixture(t, { detailStatus: 404 })
  const result = await gateway.execute({
    capabilityId: 'workflow_assistance_action', operation: 'resolve_current_governance_review',
    args: {
      assistanceCaseId: ID.case, expectedWorkflowStateVersion: 3,
      resolution: { message: 'Owner decision.' },
    },
  }, { agentId: ID.caller })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'assistance_case_not_found_or_not_visible')
  assert.deepEqual(svcRequests.map(({ method }) => method), ['GET'])
})

test('unknown resolve POST outcome is never replayed or followed by a read', async (t) => {
  const { gateway, svcRequests } = await gatewayFixture(t, { unknownPostOutcome: true })
  const result = await gateway.execute({
    capabilityId: 'workflow_assistance_action', operation: 'resolve_current_governance_review',
    args: {
      assistanceCaseId: ID.case, expectedWorkflowStateVersion: 3,
      resolution: { message: 'Owner decision.' },
    },
  }, { agentId: ID.caller })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'transport_failure')
  assert.deepEqual(svcRequests.map(({ method }) => method), ['GET', 'POST'])
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
  const missingBinding = detailDto()
  delete missingBinding.governanceBinding.bindingId
  const missingTerminalRef = detailDto()
  delete missingTerminalRef.governanceTerminalProof.terminalEventId
  const nonStringSubmissionRef = detailDto()
  nonStringSubmissionRef.governanceTerminalProof.submissionId = 123
  const wrongDefinition = detailDto()
  wrongDefinition.governanceTerminalProof.definitionVersionId = '99999999-9999-4999-8999-999999999999'
  const wrongTransition = detailDto()
  wrongTransition.governanceTerminalProof.transitionId = '99999999-9999-4999-8999-999999999999'
  const wrongContractDigest = detailDto()
  wrongContractDigest.governanceTerminalProof.acceptanceContractDigest = '8f6f81160cc724ba102fb71007e948a9ffaef219c737b2b1784de1fa2c8db570'
  const incompleteProof = detailDto()
  delete incompleteProof.governanceTerminalProof.submissionDigest
  const nonStringBindingRef = detailDto()
  nonStringBindingRef.governanceBinding.bindingId = 123
  const responses = [wrongCase, staleVersion, wrongSource, closedReview, nonAccepted, missingBinding,
    missingTerminalRef, nonStringSubmissionRef, wrongDefinition, wrongTransition, wrongContractDigest,
    incompleteProof, nonStringBindingRef]
  let detailIndex = 0
  const { gateway, svcRequests } = await gatewayFixture(t, { detail: () => responses[detailIndex++] })
  const expectedErrors = [
    'authoritative_reference_unavailable',
    'workflow_state_version_conflict',
    ...Array(responses.length - 2).fill('authoritative_reference_unavailable'),
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
  assert.deepEqual(svcRequests.map(({ method }) => method), responses.map(() => 'GET'))
})
