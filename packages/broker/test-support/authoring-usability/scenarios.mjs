import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { createBrokerGateway } from '../../src/gateway.js'
import { buildToolDefinition } from '../../src/registry.js'
import { createRelayHandlers } from '../../src/relay.js'
import { manifests } from '../../src/capabilities/workflow.js'
import { mockTargets } from '../capability-fixtures.js'

export async function runScenarios({ origin, auth, sql, principal, domainId, temp, version }) {
  const credentialsFile = `${temp}/credentials.json`
  writeFileSync(credentialsFile, JSON.stringify({ version: 1, credentials: {
    'local-model3': { clientId: 'mc_local_model3', clientSecret: 'local-only' },
  } }), { mode: 0o600 })
  const gateway = createBrokerGateway({ manifests, targets: mockTargets({ 'svc-workflow': origin }),
    authServiceOrigin: auth.origin, credentialsFile })
  const tool = id => {
    const manifest = manifests.find(m => m.id === id)
    const handlers = createRelayHandlers(manifest, async call => ({ ok: true,
      result: await gateway.execute(call, { agentId: 'local-model3' }) }))
    return buildToolDefinition({ manifest, handlers }).definition
  }
  const author = tool('workflow_definition_authoring')
  const observations = []
  const wires = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith(origin)) wires.push({ url: String(url), method: options?.method,
      body: options?.body ? JSON.parse(options.body) : undefined })
    return originalFetch(url, options)
  }
  const success = async args => {
    const result = await author.execute(args)
    assert.equal(result.ok, true, JSON.stringify(result))
    return result.result
  }
  const makeDraft = async model => {
    const def = await success({ operation: 'create_definition', domainId,
      definitionKey: `local_${randomUUID().replaceAll('-', '')}`, displayName: 'Local conformance' })
    const draft = await success({ operation: 'create_draft_version', domainId,
      definitionId: def.workflowDefinitionId, semanticModelVersion: model })
    return { domainId, definitionId: def.workflowDefinitionId, definitionVersionId: draft.definitionVersionId }
  }
  const steps = [{ displayName: '准备标题', assigneePrincipalId: principal, instructions: '准备 3 个标题' },
    { displayName: '整理建议', assigneePrincipalId: principal, instructions: '整理 3 条行动建议' }]
  const snapshot = id => sql(`SELECT json_build_object('version',(SELECT row_to_json(v) FROM workflow_definition_versions v WHERE definition_version_id='${id}'),'nodes',(SELECT json_agg(n ORDER BY node_key) FROM workflow_node_definitions n WHERE definition_version_id='${id}'),'edges',(SELECT json_agg(t ORDER BY transition_key) FROM workflow_transition_definitions t WHERE definition_version_id='${id}'))`)
  const rejected = async (args, code, rule) => {
    const before = snapshot(args.definitionVersionId)
    const start = wires.length
    const result = await author.execute(args)
    assert.equal(result.ok, false, JSON.stringify(result))
    assert.equal(result.error.code, code, JSON.stringify(result))
    if (rule) assert.ok(result.error.detail.includes(rule.replaceAll('_', ' ')), JSON.stringify(result))
    assert.equal(snapshot(args.definitionVersionId), before, 'rejection preserves complete canonical graph/version')
    assert.equal(wires.length - start, code === 'invalid_arguments' ? 0 : 1, 'no blind HTTP retry')
    assert.equal(result.error.details, undefined, 'no raw downstream details forwarding')
    const visible = JSON.stringify(result)
    for (const secret of ['PRIVATE_MARKER', principal, 'local-only', 'postgres://', 'Bearer ', 'SELECT ', 'stack trace']) {
      assert.ok(!visible.includes(secret), `private marker exposed: ${secret}`)
    }
    observations.push({ kind: 'rejection', code, rule, requests: wires.length - start, result })
    return result
  }
  try {
    assert.equal(manifests.filter(m => m.id === 'workflow_definition_authoring').length, 1)
    assert.equal(manifests.find(m => m.id === 'workflow_definition_authoring').operations.length, 4)
    const draft = await makeDraft(3)
    const linear = { operation: 'replace_draft_graph', ...draft, steps, terminalOutcome: '完成' }
    await success(linear)
    const canonical = structuredClone(wires.at(-1).body)
    assert.equal(canonical.steps, undefined)
    assert.equal(canonical.terminalOutcome, undefined)
    assert.equal(canonical.nodes.length, 3)
    assert.equal(canonical.transitions.length, 2)
    assert.equal(canonical.nodes[0].fixed_principal_id, principal)
    assert.equal(canonical.nodes[0].instructions, steps[0].instructions)
    await success(linear)
    assert.deepEqual(wires.at(-1).body, canonical, 'same linear input gives identical canonical wire')
    observations.push({ kind: 'linear', deterministic: true, canonical })
    for (const mutate of [x => { x.steps = [] }, x => { x.nodes = [] },
      x => { x.steps[0].assigneePrincipalId = '博客 Agent' }, x => { x.steps[0].loop = true },
      x => { x.steps[0].instructions = ' ' }, x => { x.steps = Array(33).fill(x.steps[0]) }]) {
      const malformed = structuredClone(linear)
      mutate(malformed)
      const count = wires.length
      const authCount = auth.requests.length
      await rejected(malformed, 'invalid_arguments')
      assert.equal(wires.length, count, 'invalid linear emits zero svc HTTP')
      assert.equal(auth.requests.length, authCount, 'invalid linear emits zero credential HTTP')
    }
    const unknown = structuredClone(linear)
    unknown.steps[0].assigneePrincipalId = randomUUID()
    await rejected(unknown, 'service_unavailable')
    const disabled = randomUUID()
    sql(`INSERT INTO principals(principal_id,principal_type,display_name,enabled) VALUES('${disabled}','AGENT','Disabled fixture',false)`)
    unknown.steps[0].assigneePrincipalId = disabled
    await success(unknown)
    const disabledBefore = snapshot(draft.definitionVersionId)
    const disabledPublish = await author.execute({ operation: 'publish_version', domainId, definitionId: draft.definitionId, versionId: draft.definitionVersionId })
    assert.equal(disabledPublish.ok, false)
    assert.equal(disabledPublish.error.code, 'definition_not_found', JSON.stringify(disabledPublish))
    assert.equal(snapshot(draft.definitionVersionId), disabledBefore, 'disabled publication does not mutate graph/version')
    observations.push({ kind: 'disabled_principal_publish', result: disabledPublish })
    await success(linear)
    const otherDomain = randomUUID()
    sql(`INSERT INTO domains(domain_id,domain_key,display_name,enabled) VALUES('${otherDomain}','other_${randomUUID().replaceAll('-', '')}','Other',true)`)
    const forbidden = await author.execute({ operation: 'create_definition', domainId: otherDomain,
      definitionKey: 'denied', displayName: 'Denied' })
    assert.equal(forbidden.ok, false)
    assert.equal(forbidden.error.code, 'definition_not_found', JSON.stringify(forbidden))
    assert.equal(sql(`SELECT count(*) FROM workflow_definitions WHERE domain_id='${otherDomain}'`), '0')
    observations.push({ kind: 'unauthorized_domain', result: forbidden })
    const full = { operation: 'replace_draft_graph', ...draft, ...canonical }
    for (const [rule, mutate] of [
      ['v1_node_kind_forbidden', x => {
        x.nodes[2].node_type = 'NORMAL'
        x.nodes[2].assignee_ref_type = 'WORKFLOW_CREATOR'
        x.nodes[2].node_key = 'PRIVATE_MARKER'
        x.transitions[1].target_node_key = 'PRIVATE_MARKER'
      }],
      ['v1_primary_advance_required', x => { delete x.nodes[0].primary_advance_transition_key }],
      ['TERMINAL_HAS_ASSIGNEE', x => { x.nodes[2].assignee_ref_type = 'WORKFLOW_CREATOR' }],
    ]) {
      const invalid = structuredClone(full)
      mutate(invalid)
      await rejected(invalid, 'graph_validation_failed', rule)
    }
    const model2 = await makeDraft(2)
    await rejected({ ...linear, ...model2 }, 'graph_validation_failed', 'v2_entry_task_required')
    const model2Graph = { operation: 'replace_draft_graph', ...model2, nodes: [
      { node_key: 'work', display_name: 'Work', order_index: 0, node_type: 'NORMAL', assignee_ref_type: 'WORKFLOW_CREATOR' },
      { node_key: 'done', display_name: 'Done', order_index: 1, node_type: 'TERMINAL' },
    ], transitions: [{ transition_key: 'finish', display_name: 'Finish', source_node_key: 'work', target_node_key: 'done', transition_effect: 'ADVANCE' }] }
    await success(model2Graph)
    assert.deepEqual(wires.at(-1).body, { definitionVersionId: model2.definitionVersionId, nodes: model2Graph.nodes, transitions: model2Graph.transitions }, 'existing full graph wire unchanged')
    for (const [target, model] of [[draft, 3], [model2, 2]]) {
      const stale = await author.execute({ operation: 'publish_version', domainId,
        definitionId: target.definitionId, versionId: target.definitionVersionId, expectedRevision: 'stale-revision' })
      assert.equal(stale.ok, false)
      assert.equal(stale.error.code, 'revision_conflict')
      const published = await success({ operation: 'publish_version', domainId,
        definitionId: target.definitionId, versionId: target.definitionVersionId })
      assert.equal(published.definitionVersionId, target.definitionVersionId)
      const instance = await tool('workflow_execute').execute({ operation: 'create_instance', domainId,
        definitionVersionId: target.definitionVersionId, contextPayload: {}, metadata: null })
      assert.equal(instance.ok, true, JSON.stringify(instance))
      const workflowInstanceId = instance.result.workflowInstanceId
      const readback = await tool('workflow_instance_detail').execute({ operation: 'read', workflowInstanceId })
      assert.equal(readback.ok, true, JSON.stringify(readback))
      assert.ok(JSON.stringify(readback.result).includes(target.definitionVersionId))
      const stored = JSON.parse(sql(`SELECT row_to_json(x) FROM (SELECT i.definition_version_id,i.semantic_model_version,v.version_status,v.semantic_model_version AS version_model FROM workflow_instances i JOIN workflow_definition_versions v USING(definition_version_id) WHERE i.workflow_instance_id='${workflowInstanceId}') x`))
      assert.equal(stored.definition_version_id, target.definitionVersionId)
      assert.equal(stored.semantic_model_version, model)
      assert.equal(stored.version_model, model)
      assert.equal(stored.version_status, 'PUBLISHED')
      await rejected(model === 3 ? linear : model2Graph, 'definition_version_immutable')
      observations.push({ kind: 'published_exact_instance', model, stored, readback: readback.result })
    }
    console.log(JSON.stringify({ result: 'PASS', environment: 'disposable localhost service + PostgreSQL + ephemeral RS256 + actual Broker gateway/relay/tool',
      productionUsed: false, normalAgentProductionProof: false, serviceVersion: version,
      observations, requests: wires.length, wireSha256: createHash('sha256').update(JSON.stringify(wires)).digest('hex') }, null, 2))
  } finally { globalThis.fetch = originalFetch }
}
