import test from 'node:test'
import assert from 'node:assert/strict'
import { buildToolDefinition } from '../src/registry.js'
import { agentDefinitionReadManifest } from '../src/capabilities/agent-definition.js'

const agents = [{ id: 'agt_cto', name: '技术研发总监', disabled: false }]
function tool() {
  return buildToolDefinition({ manifest: agentDefinitionReadManifest,
    handlers: { list: () => ({ agents }), get: (_op, args) => ({ agent: agents.find(a => a.id === args.agentId) }) },
    deps: { resolvePrincipal: () => ({ id: 'test-only-principal' }) },
  }).definition
}

test('directory discovery exposes useful text and permits list without a guessed id', async () => {
  const t = tool()
  assert.ok(!t.description.includes('undefined'))
  assert.match(t.description, /which Agents exist/)
  assert.equal(t.parameters.operation.required, true)
  assert.notEqual(t.parameters.agentId.required, true)
  const result = await t.execute({ operation: 'list' })
  assert.equal(result.ok, true)
  assert.deepEqual(result.result, { agents })
})

test('get still requires a real id and unsupported operation stays rejected', async () => {
  const t = tool()
  assert.equal((await t.execute({ operation: 'get' })).ok, false)
  assert.equal((await t.execute({ operation: 'unknown' })).ok, false)
  const result = await t.execute({ operation: 'get', agentId: 'agt_cto' })
  assert.equal(result.ok, true)
  assert.equal(result.result.agent.id, 'agt_cto')
})
