import test from 'node:test'
import assert from 'node:assert/strict'

import { validateManifest } from '../src/schema.js'
import { manifests as workflowManifests } from '../src/capabilities/workflow.js'
import { DEFAULT_MANIFESTS } from '../src/index.js'
import { buildToolDefinition } from '../src/registry.js'
import { createHttpTransport } from '../src/transport.js'
import { json, mockTargets, startMockServer, startTokenServer, wire } from '../test-support/capability-fixtures.js'

const executeManifest = () => workflowManifests.find((manifest) => manifest.id === 'workflow_execute')

const svcError = (res, status, code, message, requestId) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'x-request-id': requestId })
  res.end(JSON.stringify({ error: { code, message } }))
}

// ─── WORKFLOW_DOMAIN_OWNER_ARCHIVE_CAPABILITY_REPAIR_V1 (§8 regression) ─────
// Production incident 2026-09-14: six archive calls arrived as
// {operation:'archive_instance', workflowInstanceId} — the required `reason`
// was omitted because nothing model-visible declared it (description dropped
// as "undefined"; per-operation required invisible in the flat schema), and
// the bare invalid_arguments failure line hid the violation detail, so the
// retry mis-added a domainId instead. The tests below pin the repaired
// contract end-to-end.

test('REPAIR §8-A/F: archive_instance({workflowInstanceId, reason}) posts body exactly {reason} to the archive path and forwards the outcome', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.method === 'POST' && entry.pathname === '/internal/v1/workflow-instances/wf-repair-1/archive') {
      return json(res, 200, {
        workflow_instance_id: 'wf-repair-1',
        workflow_state_version: 11,
        event_sequence: 12,
        replayed: false,
      })
    }
    json(res, 404, { error: { code: 'instance_not_found', message: 'missing' } })
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(executeManifest(), transport)

  const res = await definition.execute({
    operation: 'archive_instance',
    workflowInstanceId: 'wf-repair-1',
    reason: 'Domain Owner directed cleanup of verified test instances',
  })
  assert.equal(res.ok, true)
  assert.equal(res.result.workflow_instance_id, 'wf-repair-1')

  assert.equal(tokenServer.requests[0].body.scope, 'workflow.execute')
  const request = workflow.requests[0]
  assert.equal(request.method, 'POST')
  assert.equal(request.pathname, '/internal/v1/workflow-instances/wf-repair-1/archive')
  assert.deepEqual(request.body, { reason: 'Domain Owner directed cleanup of verified test instances' })
  assert.ok(request.headers['idempotency-key'])
  assert.equal(Object.keys(request.body).length, 1)

  await tokenServer.close()
  await workflow.close()
})

test('REPAIR §8-B: the exact incident shape (reason omitted) fails locally with a detail naming the missing argument and zero downstream HTTP', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer(() => { throw new Error('no HTTP request may happen for invalid args') })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(executeManifest(), transport)

  // Byte-for-byte the production incident invocation shape.
  const res = await definition.execute({
    operation: 'archive_instance',
    workflowInstanceId: 'de9a45aa-08cc-46d2-8907-dc52ec8f2bbc',
  })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'invalid_arguments')
  assert.match(res.error.detail, /missing required property "reason"/)

  // The model-visible failure line must carry the detail (self-correction).
  const [rendered] = definition.output.render(
    { operation: 'archive_instance', workflowInstanceId: 'de9a45aa-08cc-46d2-8907-dc52ec8f2bbc' },
    res,
  )
  assert.match(rendered.text, /failed: invalid_arguments: missing required property "reason"/)

  assert.equal(tokenServer.requests.length, 0)
  assert.equal(workflow.requests.length, 0)

  await tokenServer.close()
  await workflow.close()
})

test('REPAIR §8-C: extra legacy arguments (domainId on archive) are deterministic local invalid_arguments, never forwarded', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer(() => { throw new Error('no HTTP request may happen for invalid args') })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(executeManifest(), transport)

  // The production mis-retry shape: domainId added, reason still missing.
  const res = await definition.execute({
    operation: 'archive_instance',
    domainId: '22222222-0000-0000-0000-000000000100',
    workflowInstanceId: 'de9a45aa-08cc-46d2-8907-dc52ec8f2bbc',
  })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'invalid_arguments')
  assert.match(res.error.detail, /unknown property "domainId"/)
  assert.match(res.error.detail, /missing required property "reason"/)
  assert.equal(tokenServer.requests.length, 0)
  assert.equal(workflow.requests.length, 0)

  await tokenServer.close()
  await workflow.close()
})

test('REPAIR §8-D: authority failures stay downstream verbatim (not_domain_owner 403 with status + request id)', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res) => {
    svcError(res, 403, 'not_domain_owner', 'caller is not the domain owner', 'req-archive-403')
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(executeManifest(), transport)

  const res = await definition.execute({
    operation: 'archive_instance',
    workflowInstanceId: 'wf-repair-2',
    reason: 'cleanup archive',
  })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'not_domain_owner')
  assert.equal(res.error.status, 403)
  assert.equal(res.error.requestId, 'req-archive-403')

  await tokenServer.close()
  await workflow.close()
})

test('REPAIR §8-G: cancel and archive keep distinct lifecycle contracts (archived blocks cancel; non-terminal blocks archive)', async () => {
  const tokenServer = await startTokenServer()
  const workflow = await startMockServer((req, res, entry) => {
    if (entry.pathname.endsWith('/cancel')) {
      return svcError(res, 409, 'instance_archived', 'instance is archived', 'req-cancel-archived')
    }
    if (entry.pathname.endsWith('/archive')) {
      return svcError(res, 409, 'instance_not_terminal', 'instance is not in a terminal state', 'req-archive-nonterm')
    }
    svcError(res, 404, 'instance_not_found', 'missing', 'req-404')
  })
  const transport = createHttpTransport({
    credentialProvider: { getCredential: async () => ({ clientId: 'wf-client', clientSecret: 'wf-secret' }) },
    targets: mockTargets({ 'svc-workflow': workflow.origin }),
    authServiceOrigin: tokenServer.origin,
  })
  const { definition } = wire(executeManifest(), transport)

  const cancelOnArchived = await definition.execute({
    operation: 'cancel_instance', workflowInstanceId: 'wf-repair-3', reason: 'late cancel',
  })
  assert.equal(cancelOnArchived.ok, false)
  assert.equal(cancelOnArchived.error.code, 'instance_archived')
  assert.equal(cancelOnArchived.error.status, 409)

  const archiveOnActive = await definition.execute({
    operation: 'archive_instance', workflowInstanceId: 'wf-repair-3', reason: 'late archive',
  })
  assert.equal(archiveOnActive.ok, false)
  assert.equal(archiveOnActive.error.code, 'instance_not_terminal')
  assert.equal(archiveOnActive.error.status, 409)

  await tokenServer.close()
  await workflow.close()
})

test('REPAIR §8-H: the model-visible generated schema exposes archive_instance with its real description and per-operation required args', () => {
  const { definition } = buildToolDefinition({ manifest: executeManifest(), handlers: {} })

  // No "undefined" placeholder; the frozen manifest text is fully visible.
  assert.doesNotMatch(definition.description, /undefined/)
  assert.match(definition.description, /archive a terminal\/cancelled instance/)

  // Per-operation required-args guidance (the incident's missing signal).
  assert.match(definition.description, /cancel_instance: workflowInstanceId, reason/)
  assert.match(definition.description, /archive_instance: workflowInstanceId, reason/)
  assert.match(definition.description, /create_instance: domainId, definitionVersionId, contextPayload, metadata/)
  assert.match(definition.description, /transition: workflowInstanceId, transitionDefinitionId, expectedWorkflowStateVersion/)

  // The coarse host schema stays exactly as pinned by CTR-011: only the
  // discriminator is required; per-operation strictness stays in mapping.
  assert.deepEqual(definition.parameters.operation.enum, ['create_instance', 'transition', 'cancel_instance', 'archive_instance'])
  const requiredToolArgs = Object.entries(definition.parameters)
    .filter(([, spec]) => spec.required === true)
    .map(([name]) => name)
  assert.deepEqual(requiredToolArgs, ['operation'])
})

test('REPAIR §8-I: canonical manifest preserves the validated description and name for every registered manifest', () => {
  for (const manifest of DEFAULT_MANIFESTS) {
    const res = validateManifest(manifest)
    assert.equal(res.ok, true, `${manifest.id}: ${res.errors?.join('; ')}`)
    assert.equal(res.manifest.description, manifest.description, `${manifest.id}: description must survive canonicalization`)
    if (manifest.name !== undefined) {
      assert.equal(res.manifest.name, manifest.name, `${manifest.id}: name must survive canonicalization`)
    }
  }
})
