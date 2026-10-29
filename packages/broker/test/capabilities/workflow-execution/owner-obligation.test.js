import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { canonicalJSON } from '../../../../fixed-operation/src/canonical.js'
import { DEFAULT_MANIFESTS } from '../../../src/index.js'
import { createBrokerGateway } from '../../../src/gateway.js'
import { json, mockTargets, startMockServer, startTokenServer } from '../../../test-support/capability-fixtures.js'

const id = n => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`
const managedId = id(1), visitId = id(2), caseId = id(3), sourceId = id(4), sourceVisit = id(5)
const targetVersion = id(6)
const createDescriptor = { key: 'workflow.create_instance', version: 1,
  hash: 'c1769e5ff7a0b41d3493405beafdbdce26a1b73cb960e52d5c544a0b658bcb44' }
const provenance = { kind: 'workflow_execution', workflowInstanceId: managedId,
  nodeVisitId: visitId, attemptId: 'wfeat-' + 'a'.repeat(24) }
const relation = () => ({ version: 1, managedKind: 'INTAKE', workflowInstanceId: managedId,
  definitionVersionId: id(7), caseId, policyDigest: 'a'.repeat(64), state: 'ACTIVE',
  currentNode: { nodeVisitId: visitId, nodeDefinitionId: id(8), workflowStateVersion: 9,
    operation: { slotKey: 'supplier', allowedOperations: [createDescriptor],
      targetDefinitionVersionId: targetVersion, targetDefinitionDigest: 'b'.repeat(64), effect: { state: 'NOT_STARTED' } } } })
const detail = () => ({ assistanceCaseId: caseId, workflowInstanceId: sourceId, nodeVisitId: sourceVisit,
  currentNodeVisitId: sourceVisit, workflowStateVersion: 12, status: 'OWNER_PENDING',
  governanceBinding: { assistanceCaseId: caseId, bindingId: id(9), status: 'BOUND',
    source: { workflowInstanceId: sourceId, nodeVisitId: sourceVisit, definitionVersionId: id(10) },
    child: { workflowInstanceId: managedId, definitionVersionId: id(7) } } })
const createCall = () => ({ capabilityId: 'workflow_execute', operation: 'create_instance', args: {
  domainId: id(11), definitionVersionId: targetVersion, contextPayload: { actual: true }, metadata: {} } })
const business = { workflowInstanceId: id(12), workflowStateVersion: 1, admissionObservation: { status: 'WAITING' } }
const resultDigest = createHash('sha256').update(canonicalJSON(business)).digest('hex')

async function fixture(t, { managed = relation(), source = detail(), trusted = provenance, readError, writeError, effectReply, replayIntent, principalId = id(15), context = {} } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'owner-obligation-broker-'))
  const credentialsFile = join(root, 'credentials.json')
  await writeFile(credentialsFile, JSON.stringify({ version: 1,
    credentials: { agt_test: { clientId: 'synthetic', clientSecret: 'fixture-only' } } }))
  const auth = await startTokenServer()
  const service = await startMockServer((req, res, entry) => {
    if (entry.pathname.endsWith('/owner-obligation')) return readError ? json(res, 404, { error: { code: readError, message: 'read denied' } }) : json(res, 200, managed)
    if (entry.pathname === `/internal/v1/assistance-cases/${caseId}`) return json(res, 200, source)
    if (writeError) return json(res, 409, { error: { code: writeError, message: 'actual service rejection' } })
    // Match the Svc semantic receipt check, which precedes active/CAS admission.
    if (replayIntent && canonicalJSON({ operation: entry.body.operation, arguments: entry.body.arguments }) !== canonicalJSON(replayIntent)) {
      return json(res, 409, { error: { code: 'idempotency_conflict', message: 'different business intent' } })
    }
    return json(res, 201, effectReply ?? (entry.pathname.includes('/operation-effects/')
      ? { effectId: id(13), state: 'SUCCEEDED', commandId: id(14), result: business, resultDigest, replayed: false }
      : business))
  })
  t.after(async () => { await service.close(); await auth.close(); await rm(root, { recursive: true, force: true }) })
  const gateway = createBrokerGateway({ manifests: DEFAULT_MANIFESTS,
    targets: mockTargets({ 'svc-workflow': service.origin }), authServiceOrigin: auth.origin, credentialsFile,
    resolveWorkflowProvenance: () => trusted,
    localHandlers: { agent_resolve_principal_by_agent: { resolve: async args => {
      assert.equal(args.agentId, 'agt_test'); return { ok: true, result: { agentId: args.agentId, principalId } }
    } } } })
  return { call: (c = createCall()) => gateway.execute(c, { ...context, agentId: 'agt_test' }), requests: service.requests }
}

test('Owner obligation read is a closed, read-only capability', () => {
  const manifest = DEFAULT_MANIFESTS.find(m => m.id === 'workflow_owner_obligation')
  assert.ok(manifest)
  assert.deepEqual(manifest.requiredScopes, ['workflow.read'])
  assert.deepEqual(manifest.operations.map(o => o.name), ['read', 'read_effect'])
  for (const op of manifest.operations) {
    assert.equal(op.arguments.additionalProperties, false)
    assert.equal(op.http.method, 'GET')
    assert.equal(op.http.idempotencyKey, undefined)
    assert.equal(op.http.body, undefined)
  }
})

test('managed create uses exact slot + one same-caller detail CAS, preserving original response', async t => {
  const f = await fixture(t)
  assert.deepEqual(await f.call(), { ok: true, result: business })
  assert.deepEqual(f.requests.map(r => r.pathname), [
    `/internal/v1/workflow-instances/${managedId}/owner-obligation`,
    `/internal/v1/assistance-cases/${caseId}`,
    `/internal/v1/workflow-instances/${managedId}/node-visits/${visitId}/operation-effects/supplier:execute`,
  ])
  assert.equal(f.requests[2].headers['idempotency-key'], undefined, 'Svc owns the stable operation key')
  assert.deepEqual(f.requests[2].body, { expectedWorkflowStateVersion: 9,
    expectedSourceWorkflowStateVersion: 12, operation: createDescriptor, arguments: createCall().args })
})

test('dependency leaf cannot fork and UNKNOWN cannot write or fall through', async t => {
  for (const kind of ['DEPENDENCY', 'UNKNOWN']) {
    const m = relation()
    if (kind === 'DEPENDENCY') m.managedKind = kind
    else m.currentNode.operation.effect = { state: 'UNKNOWN', effectId: id(13) }
    const f = await fixture(t, { managed: m })
    assert.equal((await f.call()).ok, false)
    assert.equal(f.requests.filter(r => r.method === 'POST').length, 0)
  }
})

function succeeded(data, operation, args, result = business) {
  const digest = v => createHash('sha256').update(canonicalJSON(v)).digest('hex')
  data.replayIntent = { operation, arguments: structuredClone(args) }
  const body = { expectedWorkflowStateVersion: 9, expectedSourceWorkflowStateVersion: 12, ...data.replayIntent }
  const effect = { state: 'SUCCEEDED', effectId: id(13), commandId: id(14),
    requestDigest: digest({ managedInstanceId: managedId, nodeVisitId: visitId,
      slotKey: data.managed.currentNode.operation.slotKey, body }), result, resultDigest: digest(result) }
  data.managed.currentNode.operation.effect = effect
  const { requestDigest, ...reply } = effect
  data.effectReply = { ...reply, replayed: true }
  return data
}

test('successful create after RETURN verifies original semantic intent without creating a new effect', async t => {
  const data = succeeded({ managed: relation(), source: detail() }, createDescriptor, createCall().args)
  data.managed.currentNode.workflowStateVersion = 19
  data.source.workflowStateVersion = 22
  const f = await fixture(t, data)
  assert.deepEqual(await f.call(), { ok: true, result: business })
  assert.equal(f.requests.length, 3)
  assert.equal(f.requests.at(-1).body.expectedWorkflowStateVersion, 19)
  assert.equal(f.requests.at(-1).body.expectedSourceWorkflowStateVersion, 22)
  assert.deepEqual(f.requests.at(-1).body.arguments, createCall().args)
  assert.ok(f.requests.at(-1).pathname.endsWith('/operation-effects/supplier:execute'))
})

test('successful create cannot credit changed business body, target, or unknown arguments', async t => {
  for (const change of ['body', 'target', 'extra']) {
    const data = succeeded({ managed: relation(), source: detail() }, createDescriptor, createCall().args)
    const f = await fixture(t, data), call = createCall()
    if (change === 'body') call.args.contextPayload = { changed: true }
    if (change === 'target') call.args.definitionVersionId = id(99)
    if (change === 'extra') call.args.inventedField = 'invalid'
    const result = await f.call(call)
    assert.equal(result.ok, false)
    assert.equal(f.requests.filter(r => r.method === 'POST').length, change === 'body' ? 1 : 0)
    if (change === 'body') assert.equal(result.error.code, 'idempotency_conflict')
  }
})

const resolveDescriptor = { key: 'workflow.assistance.resolve_current_review', version: 1,
  hash: '92657cb2435928ea84f2b0040606f8fc46d9f464e189aae6e19211e7e2f35a29' }
const escalateDescriptor = { key: 'workflow.assistance.escalate_to_human', version: 1,
  hash: '86aad94d5dfa3f543278d9e0a5260a1b0bd93ef7e04e2cf66cbaaf45598d08e8' }
function reviewFixture() {
  const managed = relation(), source = detail()
  managed.managedKind = 'REVIEW'
  managed.currentNode.operation = { slotKey: 'review', allowedOperations: [resolveDescriptor, escalateDescriptor], effect: { state: 'NOT_STARTED' } }
  const proof = { bindingId: id(9), terminalEventId: id(16), submissionId: id(17),
    submissionDigest: 'e'.repeat(64), acceptanceContractDigest: 'f'.repeat(64) }
  source.governanceBinding.child.acceptanceTransitionId = id(18)
  source.governanceBinding.acceptanceContractDigest = proof.acceptanceContractDigest
  source.governanceTerminalProof = { ...proof, verdict: 'ACCEPTED', definitionVersionId: id(7), transitionId: id(18) }
  managed.currentNode.reviewAdmission = { version: 1, status: 'ADMISSIBLE',
    source: source.governanceBinding.source, owner: { principalId: id(15), bindingId: id(19) }, proof }
  return { managed, source }
}
const resolveCall = () => ({ capabilityId: 'workflow_assistance_action', operation: 'resolve_current_governance_review',
  args: { assistanceCaseId: caseId, expectedWorkflowStateVersion: 12, resolution: { message: 'Reviewed actual acceptance', supportingPayload: { note: 'inspect' } } } })

test('managed REVIEW uses actual admission + same-caller detail without inventing DELIVERED', async t => {
  const data = reviewFixture(), f = await fixture(t, data)
  const call = resolveCall()
  assert.equal(data.source.governanceBinding.currentReview, undefined)
  assert.deepEqual(await f.call(call), { ok: true, result: business })
  const posts = f.requests.filter(r => r.method === 'POST')
  assert.equal(posts.length, 1)
  assert.equal(f.requests.filter(r => r.pathname.includes('/assistance-cases/')).length, 1)
  assert.deepEqual(posts[0].body, { expectedWorkflowStateVersion: 9, expectedSourceWorkflowStateVersion: 12,
    operation: resolveDescriptor, arguments: { ...call.args,
      resolution: { ...call.args.resolution, supportingPayload: { note: 'inspect', governanceChildReview: data.managed.currentNode.reviewAdmission.proof } } } })
  assert.equal(call.args.resolution.supportingPayload.governanceChildReview, undefined)
})

test('managed REVIEW independently rejects each wrong Owner/lineage/proof/CAS and caller collision', async t => {
  const corruptions = [
    (d, c) => { c.args.expectedWorkflowStateVersion = 11 },
    (d, c) => { c.args.assistanceCaseId = id(99) },
    (d, c) => { c.args.resolution.supportingPayload.governanceChildReview = {} },
    d => { d.managed.currentNode.reviewAdmission.owner.principalId = id(99) },
    d => { d.managed.currentNode.reviewAdmission.owner.bindingId = 'not-a-binding-id' },
    d => { d.managed.currentNode.reviewAdmission.source = { ...d.managed.currentNode.reviewAdmission.source, definitionVersionId: id(99) } },
    d => { d.managed.currentNode.reviewAdmission.proof.submissionId = id(99) },
    d => { d.source.governanceTerminalProof.transitionId = id(99) },
    d => { d.source.currentNodeVisitId = id(99) },
    d => { delete d.managed.currentNode.reviewAdmission },
  ]
  for (const corrupt of corruptions) {
    const data = reviewFixture(), call = resolveCall(); corrupt(data, call)
    const f = await fixture(t, data)
    assert.equal((await f.call(call)).ok, false)
    assert.equal(f.requests.filter(r => r.method === 'POST').length, 0)
  }
})

test('managed escalation retains explicit stale CAS and the existing business payload', async t => {
  const call = { capabilityId: 'workflow_assistance_action', operation: 'escalate_to_human',
    args: { assistanceCaseId: caseId, expectedWorkflowStateVersion: 12, escalation: { message: 'Needs a decision' } } }
  const f = await fixture(t, reviewFixture())
  assert.equal((await f.call(call)).ok, true)
  assert.deepEqual(f.requests.at(-1).body.arguments, call.args)
  assert.deepEqual(f.requests.at(-1).body.operation, escalateDescriptor)
  const stale = await fixture(t, reviewFixture())
  call.args.expectedWorkflowStateVersion = 11
  assert.equal((await stale.call(call)).error.code, 'workflow_state_version_conflict')
  assert.equal(stale.requests.filter(r => r.method === 'POST').length, 0)
})

function resolvedReview() {
  const data = reviewFixture()
  const args = resolveCall().args
  args.resolution.supportingPayload.governanceChildReview = data.managed.currentNode.reviewAdmission.proof
  data.source.resolution = structuredClone(args.resolution)
  delete data.managed.currentNode.reviewAdmission
  data.source.status = 'RESOLVED'
  data.source.workflowStateVersion = 13
  data.source.currentNodeVisitId = id(20)
  return succeeded(data, resolveDescriptor, args, { assistanceCaseId: caseId, status: 'RESOLVED', workflowStateVersion: 13 })
}

test('own resolve replay uses immutable original proof and explicit old CAS without new ADMISSIBLE', async t => {
  const data = resolvedReview()
  const f = await fixture(t, data)
  assert.deepEqual(await f.call(resolveCall()), { ok: true, result: data.effectReply.result })
  assert.equal(f.requests.length, 3)
  const body = f.requests.at(-1).body
  assert.equal(body.expectedSourceWorkflowStateVersion, 12)
  assert.deepEqual(body.arguments, data.replayIntent.arguments)
})

test('own resolve replay rejects changed message, changed allowed descriptor and wrong case', async t => {
  for (const change of ['message', 'descriptor', 'case']) {
    const data = resolvedReview(), f = await fixture(t, data)
    let call = resolveCall()
    if (change === 'message') call.args.resolution.message = 'Different business request'
    if (change === 'case') call.args.assistanceCaseId = id(99)
    if (change === 'descriptor') call = { capabilityId: 'workflow_assistance_action', operation: 'escalate_to_human',
      args: { assistanceCaseId: caseId, expectedWorkflowStateVersion: 12, escalation: { message: 'Escalate instead' } } }
    const result = await f.call(call)
    assert.equal(result.ok, false)
    assert.equal(f.requests.filter(r => r.method === 'POST').length, change === 'case' ? 0 : 1)
    if (change !== 'case') assert.equal(result.error.code, 'idempotency_conflict')
  }
})

test('own resolve replay cannot synthesize missing proof or trust mismatched immutable lineage', async t => {
  for (const corrupt of [d => { delete d.source.resolution },
    d => { d.source.resolution.supportingPayload.governanceChildReview.submissionId = id(99) },
    d => { d.source.governanceTerminalProof.transitionId = id(99) },
    d => { d.source.governanceBinding.source.workflowInstanceId = id(99) }]) {
    const data = resolvedReview(); corrupt(data)
    const f = await fixture(t, data)
    assert.equal((await f.call(resolveCall())).ok, false)
    assert.equal(f.requests.filter(r => r.method === 'POST').length, 0)
  }
})

test('a claimed replay must bind the same original command, result and effect', async t => {
  for (const corrupt of [r => { r.replayed = false }, r => { r.effectId = id(99) },
    r => { r.commandId = id(99) }, r => { r.result = {}; r.resultDigest = createHash('sha256').update('{}').digest('hex') }]) {
    const data = resolvedReview(); corrupt(data.effectReply)
    const f = await fixture(t, data)
    assert.equal((await f.call(resolveCall())).ok, false)
    assert.equal(f.requests.filter(r => r.method === 'POST').length, 1)
  }
})

test('only authoritative not-managed permits fallback; opaque 404/storage and malformed relations do not', async t => {
  for (const code of ['owner_obligation_not_managed', 'workflow_instance_not_found_or_not_visible', 'service_unavailable']) {
    const f = await fixture(t, { readError: code })
    assert.equal((await f.call()).ok, code === 'owner_obligation_not_managed')
    assert.equal(f.requests.filter(r => r.method === 'POST').length, code === 'owner_obligation_not_managed' ? 1 : 0)
  }
  for (const corrupt of [m => { m.workflowInstanceId = id(99) }, m => { delete m.caseId },
    m => { m.currentNode.nodeVisitId = id(99) }, m => { m.currentNode.operation.allowedOperations[0] = { ...createDescriptor, hash: '0'.repeat(64) } },
    m => { m.currentNode.operation.targetDefinitionDigest = 'invalid' }, m => { m.currentNode.operation.targetDefinitionVersionId = id(99) },
    m => { m.state = 'STOPPED' }, m => { m.currentNode.operation.effect = { state: 'REJECTED_ZERO_FACTS', effectId: id(13) } }]) {
    const m = relation(); corrupt(m)
    const f = await fixture(t, { managed: m })
    assert.equal((await f.call()).ok, false)
    assert.equal(f.requests.filter(r => r.method === 'POST').length, 0)
  }
})

test('Svc rejection or malformed success is not retried or claimed as success', async t => {
  const f = await fixture(t, { writeError: 'workflow_state_version_conflict' })
  assert.equal((await f.call()).error.code, 'workflow_state_version_conflict')
  assert.equal(f.requests.filter(r => r.method === 'POST').length, 1)
  const bad = await fixture(t, { effectReply: { effectId: id(13), state: 'SUCCEEDED', commandId: id(14), result: business,
    resultDigest: '0'.repeat(64), replayed: false } })
  assert.equal((await bad.call()).ok, false)
  assert.equal(bad.requests.filter(r => r.method === 'POST').length, 1)
})

test('missing resolver for a proven workflow turn fails closed; generic managed assistance cannot bypass', async t => {
  const noContext = await fixture(t, { trusted: null, context: { workflowProvenance: provenance } })
  assert.equal((await noContext.call()).ok, false)
  assert.equal(noContext.requests.length, 0)
  const generic = await fixture(t)
  const call = resolveCall(); call.operation = 'resolve'
  assert.equal((await generic.call(call)).error.code, 'governed_operation_required')
  assert.equal(generic.requests.filter(r => r.method === 'POST').length, 0)
})

test('read capability rejects extra arguments and invalid UUID before transport', async t => {
  for (const args of [{ workflowInstanceId: managedId, slotKey: 'model-slot' }, { workflowInstanceId: 'bad' }]) {
    const f = await fixture(t)
    assert.equal((await f.call({ capabilityId: 'workflow_owner_obligation', operation: 'read', args })).ok, false)
    assert.equal(f.requests.length, 0)
  }
})

test('unmanaged REVIEW preserves DELIVERED/OUTSTANDING legacy requirement', async t => {
  const data = reviewFixture(), f = await fixture(t, { ...data, readError: 'owner_obligation_not_managed' })
  const result = await f.call(resolveCall())
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'authoritative_reference_unavailable')
  assert.equal(f.requests.filter(r => r.method === 'POST').length, 0)
})

test('opaque service slot keys are URL encoded, never model selected or concatenated as paths', async t => {
  const m = relation(); m.currentNode.operation.slotKey = '创建/first slot'
  const f = await fixture(t, { managed: m })
  assert.equal((await f.call()).ok, true)
  assert.ok(f.requests.at(-1).pathname.endsWith('/operation-effects/%E5%88%9B%E5%BB%BA%2Ffirst%20slot:execute'))
})

test('managed and leaf turns cannot open nested assistance through the separate existing request tool', async t => {
  for (const kind of ['INTAKE', 'REVIEW', 'DEPENDENCY']) {
    const m = relation(); m.managedKind = kind
    const f = await fixture(t, { managed: m })
    const result = await f.call({ capabilityId: 'workflow_assistance_request', operation: 'open', args: {
      workflowInstanceId: managedId, currentNodeVisitId: visitId, expectedWorkflowStateVersion: 9,
      request: { message: 'try recursive governance' } } })
    assert.equal(result.error.code, 'governed_operation_required')
    assert.equal(f.requests.filter(r => r.method === 'POST').length, 0)
  }
})

test('existing write manifests preserve managed refusal codes through the child invoke mapper', async () => {
  for (const capabilityId of ['workflow_execute', 'workflow_assistance_action', 'workflow_assistance_request']) {
    const manifest = DEFAULT_MANIFESTS.find(m => m.id === capabilityId)
    assert.ok(manifest.errors.some(e => e.code === 'governed_operation_required'))
    // Mapping preservation is independent of the already-tested argument validator.
    const { resolveCode } = await import('../../../src/mapping.js')
    assert.equal(resolveCode(manifest, 'governed_operation_required', 'invalid_arguments').code, 'governed_operation_required')
  }
})
