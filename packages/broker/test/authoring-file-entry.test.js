/**
 * AGENT_CORE_WORKFLOW_AUTHORING_FILE_ENTRY_V1 (candidate) — unit tests for
 * the narrow file→`workflow_definition_authoring.replace_draft_graph` entry
 * tool. Every rejection path must fire BEFORE the relay (requestFn stays
 * uncalled); the happy path must relay the EXACT parsed object and persist
 * untruncated request/response evidence.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

import { workflowDefinitionAuthoringManifest } from '../src/capabilities/workflow-definition-authoring.js'
import {
  AUTHORING_FILE_ENTRY_TOOL_NAME,
  createAuthoringFileEntryTool,
} from '../src/authoring-file-entry.js'

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

/** A closed graph whose schemas carry deep properties/required (the #562
 *  loss shape: required kept, properties dropped). */
function graphArgs(overrides = {}) {
  return {
    domainId: 'd-1111',
    definitionId: 'def-2222',
    definitionVersionId: 'ver-3333',
    contextSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      additionalProperties: false,
      required: ['budget', 'items'],
      properties: {
        budget: { type: 'integer', minimum: 1 },
        items: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' } }, required: ['name'] } },
      },
    },
    nodes: [
      { node_key: 'requirements', display_name: '需求', order_index: 0, node_type: 'DRAFT', assignee_ref_type: 'WORKFLOW_CREATOR', instructions: '冻结需求', primary_advance_transition_key: 'to_review' },
      { node_key: 'review', display_name: '复核', order_index: 1, node_type: 'TASK', assignee_ref_type: 'DOMAIN_OWNER', instructions: '复核', primary_advance_transition_key: 'to_done' },
      { node_key: 'done', display_name: '完成', order_index: 2, node_type: 'TERMINAL' },
    ],
    transitions: [
      { transition_key: 'to_review', display_name: '提交复核', source_node_key: 'requirements', target_node_key: 'review', transition_effect: 'ADVANCE', submission_schema: { type: 'object', additionalProperties: false, required: ['confirm'], properties: { confirm: { type: 'boolean' } } } },
      { transition_key: 'to_done', display_name: '完成', source_node_key: 'review', target_node_key: 'done', transition_effect: 'ADVANCE' },
    ],
    ...overrides,
  }
}

async function workspaceWithFile(t, name, content) {
  const dir = await mkdtemp(join(tmpdir(), 'afe-unit-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const file = join(dir, name)
  await mkdir(join(dir, 'sub'), { recursive: true })
  await writeFile(join(dir, 'sub', name), content)
  return { workspace: dir, file: join(dir, 'sub', name) }
}

function harness({ workspace, evidenceFile, requestFnResult, manifest } = {}) {
  const relayCalls = []
  const evidenceLines = []
  const requestFn = async (call) => {
    relayCalls.push(call)
    return requestFnResult ?? { ok: true, result: { status: 'ok' } }
  }
  const log = []
  const { definition } = createAuthoringFileEntryTool({
    manifest: manifest ?? workflowDefinitionAuthoringManifest,
    requestFn,
    workspaceRoot: workspace,
    evidenceFile,
    log: (m) => log.push(m),
  })
  const readEvidence = async () => {
    const raw = await readFile(evidenceFile, 'utf8')
    return raw.trim().split('\n').map((line) => JSON.parse(line))
  }
  return { definition, relayCalls, evidenceLines, log, readEvidence }
}

test('tool registers under the proposed single-operation name with one bounded parameter pair', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'afe-shape-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  assert.equal(AUTHORING_FILE_ENTRY_TOOL_NAME, 'workflow_definition_authoring_file')
  const { definition } = harness({ workspace: dir })
  assert.equal(definition.name, 'workflow_definition_authoring_file')
  assert.deepEqual(Object.keys(definition.parameters), ['path', 'expectedSha256'])
  assert.equal(definition.parameters.path.required, true)
  assert.equal(definition.parameters.expectedSha256.required, undefined)
})

test('happy path: relayed args are deep-equal to the parsed file, field by field', async (t) => {
  const args = graphArgs()
  const { workspace, file } = await workspaceWithFile(t, 'args.json', JSON.stringify(args, null, 2))
  const { definition, relayCalls, readEvidence } = harness({ workspace, evidenceFile: join(workspace, '.afe', 'evidence.jsonl') })

  const envelope = await definition.execute({ path: file })
  assert.equal(envelope.ok, true)
  assert.deepEqual(envelope.result, { status: 'ok' })
  assert.equal(relayCalls.length, 1)
  assert.deepEqual(relayCalls[0], {
    capabilityId: 'workflow_definition_authoring',
    operation: 'replace_draft_graph',
    args,
  })
  // deep-equal already proves field-by-field; pin the loss-sensitive leaves explicitly.
  assert.deepEqual(relayCalls[0].args.contextSchema.properties, args.contextSchema.properties)
  assert.deepEqual(relayCalls[0].args.contextSchema.required, args.contextSchema.required)
  assert.deepEqual(relayCalls[0].args.transitions[0].submission_schema, args.transitions[0].submission_schema)

  const [request, response] = await readEvidence()
  assert.equal(request.stage, 'request')
  assert.equal(request.sha256, sha256(JSON.stringify(args, null, 2)))
  assert.equal(request.bytes, Buffer.byteLength(JSON.stringify(args, null, 2)))
  assert.deepEqual(request.args, args)
  assert.equal(response.stage, 'response')
  assert.deepEqual(response.envelope, { ok: true, result: { status: 'ok' } })
})

test('envelope passthrough keeps code/status/requestId and records the requestId coordinate', async (t) => {
  const args = graphArgs()
  const { workspace, file } = await workspaceWithFile(t, 'args.json', JSON.stringify(args))
  const failure = { ok: false, error: { code: 'graph_validation_failed', status: 422, detail: 'safe-rule', requestId: 'req-42' } }
  const { definition, readEvidence } = harness({ workspace, evidenceFile: join(workspace, 'ev.jsonl'), requestFnResult: failure })
  const envelope = await definition.execute({ path: file })
  assert.deepEqual(envelope, failure)
  const [, response] = await readEvidence()
  assert.deepEqual(response.envelope, failure)
  assert.equal(response.envelope.error.requestId, 'req-42')
})

test('nonexistent file rejected before the relay', async (t) => {
  const { workspace } = await workspaceWithFile(t, 'args.json', '{}')
  const { definition, relayCalls } = harness({ workspace, evidenceFile: join(workspace, 'ev.jsonl') })
  const envelope = await definition.execute({ path: join(workspace, 'absent.json') })
  assert.equal(envelope.ok, false)
  assert.equal(envelope.error.code, 'invalid_arguments')
  assert.match(envelope.error.detail, /absent\.json/)
  assert.equal(relayCalls.length, 0)
})

test('invalid JSON and non-object JSON rejected before the relay', async (t) => {
  for (const [name, content] of [['broken.json', '{"nodes": ['], ['array.json', '[1,2]'], ['null.json', 'null']]) {
    const { workspace, file } = await workspaceWithFile(t, name, content)
    const { definition, relayCalls } = harness({ workspace, evidenceFile: join(workspace, 'ev.jsonl') })
    const envelope = await definition.execute({ path: file })
    assert.equal(envelope.ok, false, name)
    assert.equal(envelope.error.code, 'invalid_arguments', name)
    assert.equal(relayCalls.length, 0, name)
  }
})

test('file outside the workspace rejected before the relay (absolute path + symlink escape)', async (t) => {
  const args = graphArgs()
  const outsideDir = await mkdtemp(join(tmpdir(), 'afe-outside-'))
  t.after(() => rm(outsideDir, { recursive: true, force: true }))
  const outsideFile = join(outsideDir, 'args.json')
  await writeFile(outsideFile, JSON.stringify(args))

  const { workspace, file } = await workspaceWithFile(t, 'args.json', JSON.stringify(args))
  await symlink(outsideFile, join(workspace, 'sub', 'escape.json'))
  const { definition, relayCalls } = harness({ workspace, evidenceFile: join(workspace, 'ev.jsonl') })

  const direct = await definition.execute({ path: outsideFile })
  assert.equal(direct.ok, false)
  assert.equal(direct.error.code, 'invalid_arguments')
  assert.match(direct.error.detail, /workspace/)
  assert.equal(relayCalls.length, 0)

  const viaSymlink = await definition.execute({ path: join(workspace, 'sub', 'escape.json') })
  assert.equal(viaSymlink.ok, false)
  assert.equal(viaSymlink.error.code, 'invalid_arguments')
  assert.equal(relayCalls.length, 0)
})

test('relative path rejected; oversize file rejected before the relay', async (t) => {
  const { workspace, file } = await workspaceWithFile(t, 'args.json', JSON.stringify(graphArgs()))
  const { definition, relayCalls } = harness({ workspace, evidenceFile: join(workspace, 'ev.jsonl') })
  const relative = await definition.execute({ path: 'sub/args.json' })
  assert.equal(relative.ok, false)
  assert.equal(relayCalls.length, 0)

  const bigFile = join(workspace, 'sub', 'big.json')
  await writeFile(bigFile, JSON.stringify({ pad: 'x'.repeat(1048577) }))
  const big = await definition.execute({ path: bigFile })
  assert.equal(big.ok, false)
  assert.match(big.error.detail, /1 MiB|1048576|too large|size/)
  assert.equal(relayCalls.length, 0)
  assert.ok(file)
})

test('unknown top-level field and identity-field injection rejected by the existing validation before the relay', async (t) => {
  const { workspace, file } = await workspaceWithFile(t, 'args.json', JSON.stringify(graphArgs({ agentId: 'agt_mallory' })))
  const { definition, relayCalls } = harness({ workspace, evidenceFile: join(workspace, 'ev.jsonl') })
  const envelope = await definition.execute({ path: file })
  assert.equal(envelope.ok, false)
  assert.equal(envelope.error.code, 'invalid_arguments')
  assert.match(envelope.error.detail, /agentId/)
  assert.equal(relayCalls.length, 0)

  const { workspace: ws2, file: file2 } = await workspaceWithFile(t, 'args2.json', JSON.stringify(graphArgs({ surprise: 1 })))
  const h2 = harness({ workspace: ws2, evidenceFile: join(ws2, 'ev.jsonl') })
  const envelope2 = await h2.definition.execute({ path: file2 })
  assert.equal(envelope2.ok, false)
  assert.match(envelope2.error.detail, /surprise/)
  assert.equal(h2.relayCalls.length, 0)
})

test('mixed full+linear form passes child validation and the gateway-owned rejection passes through verbatim', async (t) => {
  const missing = graphArgs()
  delete missing.definitionVersionId
  const { workspace, file } = await workspaceWithFile(t, 'args.json', JSON.stringify(missing))
  const { definition, relayCalls } = harness({ workspace, evidenceFile: join(workspace, 'ev.jsonl') })
  const envelope = await definition.execute({ path: file })
  assert.equal(envelope.ok, false)
  assert.match(envelope.error.detail, /definitionVersionId/)
  assert.equal(relayCalls.length, 0)

  // Exactly-one-form is a gateway contract (prepareWorkflowDraft), not a
  // child schema predicate: the mixed form relays and the rejection is
  // returned verbatim (no retry, no rewrite).
  const mixed = graphArgs({ steps: [{ displayName: 's', assigneePrincipalId: 'p-1', instructions: 'i' }], terminalOutcome: 'done' })
  const gatewayRejection = { ok: false, error: { code: 'invalid_arguments', detail: 'Supply exactly one form: nodes + transitions OR steps + terminalOutcome.' } }
  const h2 = harness({ workspace, evidenceFile: join(workspace, 'ev2.jsonl'), requestFnResult: gatewayRejection })
  const f2 = join(workspace, 'sub', 'mixed.json')
  await writeFile(f2, JSON.stringify(mixed))
  const envelope2 = await h2.definition.execute({ path: f2 })
  assert.deepEqual(envelope2, gatewayRejection)
  assert.equal(h2.relayCalls.length, 1)
})

test('expectedSha256 mismatch rejected before the relay; matching hash relays', async (t) => {
  const raw = JSON.stringify(graphArgs())
  const { workspace, file } = await workspaceWithFile(t, 'args.json', raw)
  const { definition, relayCalls } = harness({ workspace, evidenceFile: join(workspace, 'ev.jsonl') })
  const mismatch = await definition.execute({ path: file, expectedSha256: '0'.repeat(64) })
  assert.equal(mismatch.ok, false)
  assert.match(mismatch.error.detail, /sha256|hash/i)
  assert.equal(relayCalls.length, 0)

  const ok = await definition.execute({ path: file, expectedSha256: sha256(raw) })
  assert.equal(ok.ok, true)
  assert.equal(relayCalls.length, 1)
})

test('evidence write failure aborts the call before the relay (no partial submission)', async (t) => {
  const { workspace, file } = await workspaceWithFile(t, 'args.json', JSON.stringify(graphArgs()))
  const { definition, relayCalls } = harness({ workspace, evidenceFile: join(workspace, 'no-such-dir', 'sub', 'evidence.jsonl') })
  // mkdir recursive handles the absent dir — force failure via a DIRECTORY at the file path.
  await mkdir(join(workspace, 'evidence-dir-block'), { recursive: true })
  const { definition: blocked } = harness({ workspace, evidenceFile: join(workspace, 'evidence-dir-block') })
  const envelope = await blocked.execute({ path: file })
  assert.equal(envelope.ok, false)
  assert.equal(relayCalls.length, 0)
  assert.ok(definition)
})

test('response-evidence write failure never alters the returned envelope', async (t) => {
  const raw = JSON.stringify(graphArgs())
  const { workspace, file } = await workspaceWithFile(t, 'args.json', raw)
  const { definition } = harness({ workspace, evidenceFile: join(workspace, 'evidence-dir-block') })
  const envelope = await definition.execute({ path: file })
  assert.equal(envelope.ok, true)
  assert.deepEqual(envelope.result, { status: 'ok' })
})
