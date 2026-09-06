import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { workflowDefinitionAuthoringManifest as manifest } from '../../src/capabilities/workflow-definition-authoring.js'
import { manifest as calculator } from '../../src/calculator.manifest.js'
import { createBrokerGateway } from '../../src/gateway.js'
import { createRelayHandlers } from '../../src/relay.js'
import { registerCapability } from '../../src/registry.js'
import { json, mockTargets, startMockServer, startTokenServer } from '../../test-support/capability-fixtures.js'

function register(manifest, handlers = {}) {
  let registered
  const tool = registerCapability({ manifest, handlers }, {
    register(definition) { registered = definition },
  }, definition => definition)
  assert.equal(tool, registered)
  return tool
}

const args = {
  operation: 'replace_draft_graph', domainId: 'domain', definitionId: 'definition',
  definitionVersionId: 'version',
  steps: [{ displayName: '准备标题', assigneePrincipalId: '00000000-0000-4000-8000-000000000001', instructions: '生成三个标题' }],
  terminalOutcome: '完成',
}

test('registered authoring description retains validated summary, model3 and linear/publish guidance', () => {
  const tool = register(manifest)
  assert.equal(tool.description, `Agent Core capability \`${manifest.id}\`: ${manifest.description} Supported operations: create_definition, create_draft_version, replace_draft_graph, publish_version.`)
  assert.match(tool.description, /semanticModelVersion=3/)
  assert.match(tool.description, /steps \+ terminalOutcome/)
  assert.match(tool.description, /Publish separately and instantiate the exact published version/)
  assert.match(tool.description, /workflow_my_domains/)
  assert.doesNotMatch(tool.description, /undefined/)
  assert.match(tool.parameters.semanticModelVersion.description, /Omitted means Legacy/)
  assert.deepEqual(tool.parameters.operation.enum, ['create_definition', 'create_draft_version', 'replace_draft_graph', 'publish_version'])
  assert.throws(() => register({ ...manifest, description: {} }), /description/)
})

test('registered output renderer preserves safe service rule through gateway and real relay', async t => {
  const token = await startTokenServer()
  const svc = await startMockServer((_req, res) => {
    res.setHeader('x-request-id', 'req-rule-render')
    json(res, 422, { error: {
      code: 'graph_validation_failed',
      message: 'graph validation failed (rule: v1 primary advance required): Set one primary ADVANCE for each TASK. token=private-token password=private-password',
      details: { rawValidator: 'private-validator-marker', sql: 'private-sql-marker', stack: 'private-stack-marker' },
    } })
  })
  t.after(async () => { await token.close(); await svc.close() })
  const dir = await mkdtemp(join(tmpdir(), 'authoring-render-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const credentialsFile = join(dir, 'credentials.json')
  await writeFile(credentialsFile, JSON.stringify({ version: 1, credentials: { agent: { clientId: 'client', clientSecret: 'secret' } } }))
  const gateway = createBrokerGateway({ manifests: [manifest], targets: mockTargets({ 'svc-workflow': svc.origin }), authServiceOrigin: token.origin, credentialsFile })
  const relayed = []
  const handlers = createRelayHandlers(manifest, async call => {
    relayed.push(call)
    return { ok: true, result: await gateway.execute(call, { agentId: 'agent' }) }
  })
  const tool = register(manifest, handlers)
  const failure = await tool.execute(args)
  // This is the exact registry output.render callback consumed by defineTool,
  // not merely the structured gateway/relay error tested by earlier coverage.
  const text = tool.output.render(args, failure)[0].text
  assert.match(text, /failed: graph_validation_failed \(status=422, request_id=req-rule-render\)/)
  assert.match(text, /rule: v1 primary advance required/)
  assert.match(text, /Set one primary ADVANCE for each TASK/)
  assert.doesNotMatch(text, /private-token|private-password|private-validator-marker|private-sql-marker|private-stack-marker/)
  assert.equal(svc.requests.length, 1, 'canonical rejection is never automatically retried')
  assert.equal(relayed.length, 1)
  assert.deepEqual(Object.keys(relayed[0]).sort(), ['args', 'capabilityId', 'operation'])
  assert.equal(svc.requests[0].method, 'PUT')
  assert.equal(svc.requests[0].pathname, '/internal/v1/domains/domain/definitions/definition/draft')
  assert.deepEqual(Object.keys(svc.requests[0].body).sort(), ['definitionVersionId', 'nodes', 'transitions'])
})

test('malformed linear input renders bounded index and correction before credentials or HTTP', async () => {
  const gateway = createBrokerGateway({ manifests: [manifest], targets: [], credentialsFile: '/nonexistent/authoring-render-test-credentials.json' })
  let calls = 0
  const tool = register(manifest, createRelayHandlers(manifest, async call => {
    calls++
    return { ok: true, result: await gateway.execute(call, { agentId: 'agent' }) }
  }))
  const malformed = { ...args, steps: [{ ...args.steps[0], instructions: ' ' }] }
  const failure = await tool.execute(malformed)
  assert.equal(failure.error.code, 'invalid_arguments')
  assert.equal(failure.error.status, undefined)
  assert.equal(calls, 1)
  assert.ok(failure.error.detail.length <= 250)
  const text = tool.output.render(malformed, failure)[0].text
  assert.match(text, /failed: invalid_arguments: steps\[0\]\.instructions must be nonblank text of 1\.\.4000 characters/)
  assert.doesNotMatch(text, /credential_unavailable|nonexistent/)
})

test('only authoring diagnostics render bounded sanitized detail; unrelated text stays byte-identical', () => {
  const tool = register(manifest)
  const generic = register(calculator)
  assert.equal(generic.description, 'Agent Core capability `external.calculator`: undefined Supported operations: add, subtract, multiply, divide.')
  const value = { ok: false, error: { code: 'graph_validation_failed', status: 422, requestId: 'req', detail: 'secret=private-secret '+ '😀'.repeat(600) } }
  const authoring = tool.output.render({ operation: 'publish_version' }, value)[0].text
  assert.doesNotMatch(authoring, /private-secret/)
  const prefix = 'workflow_definition_authoring: publish_version() failed: graph_validation_failed (status=422, request_id=req): '
  assert.ok(authoring.startsWith(prefix))
  assert.equal([...authoring.slice(prefix.length)].length, 500)
  assert.equal(generic.output.render({ operation: 'divide', a: 6, b: 0 }, value)[0].text,
    'external.calculator: divide(6, 0) failed: graph_validation_failed (status=422, request_id=req)')
  assert.equal(generic.output.render({ operation: 'multiply', a: 6, b: 7 }, { ok: true, result: 42 })[0].text,
    'external.calculator: multiply(6, 7) = 42 (ok: true)')
  for (const error of [
    { code: 'credential_unavailable', status: 401, detail: 'private-secret' },
    { code: 'graph_validation_failed', status: 500, detail: 'private-secret' },
    { code: 'graph_validation_failed', status: 422, detail: { raw: 'private-secret' } },
    { code: 'invalid_arguments', status: 400, detail: 'private-secret' },
  ]) {
    const text = tool.output.render({ operation: 'publish_version' }, { ok: false, error })[0].text
    assert.equal(text, `workflow_definition_authoring: publish_version() failed: ${error.code} (status=${error.status})`)
  }
})
