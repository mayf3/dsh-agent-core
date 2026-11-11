import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appendFileSync, readFileSync, readdirSync, lstatSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { queryExecutionTrace } from '../src/index.js'
import { buildFixtureRoot, destroyFixtureRoot, WF_ID, VISIT_ID } from './fixtures.js'

const uid = (n) => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`
const VERSION = uid(10)
const DOMAIN = uid(11)
const DEF = uid(12)
const SOURCE = uid(13)
const TARGET = uid(14)
const TRANSITION = uid(15)
const CONTEXT = uid(16)
const SUBMISSION = uid(17)
const NEXT_VISIT = uid(18)
const OBSERVATIONS = [{ source: 'svc_detail', observedAtMs: 100, workflowStateVersion: 2 }]

function facts(effect = 'ADVANCE') {
  const detail = { visibility: 'full', detail: {
    instance: { workflow_instance_id: WF_ID, domain_id: DOMAIN, definition_version_id: VERSION,
      workflow_state_version: 2, is_terminal: true },
    current_node_visit_id: NEXT_VISIT, current_context_revision_id: CONTEXT,
    current_context: { context_revision_id: CONTEXT, workflow_instance_id: WF_ID,
      payload: { acceptanceCriteria: [{ id: 'artifact', description: 'Artifact accepted' }] } },
  } }
  const event = { event_id: uid(19), workflow_instance_id: WF_ID, event_sequence: 2,
    command_id: uid(20), event_type: 'WORKFLOW_TRANSITION_COMMITTED', transition_effect: effect,
    source_node_visit_id: VISIT_ID, target_node_visit_id: NEXT_VISIT,
    context_revision_id: CONTEXT, submission_id: SUBMISSION, from_node_id: SOURCE, to_node_id: TARGET,
    old_workflow_state_version: 1, new_workflow_state_version: 2, created_at: '2026-10-31T00:00:00Z',
    event_data: { transition_definition_id: TRANSITION, transition_effect: effect,
      source_node_id: SOURCE, target_node_id: TARGET, source_node_visit_id: VISIT_ID,
      target_node_visit_id: NEXT_VISIT, context_revision_id: CONTEXT, submission_payload_digest: 'digest' } }
  const submission = { submission_id: SUBMISSION, workflow_instance_id: WF_ID, source_node_visit_id: VISIT_ID,
    transition_id: TRANSITION, transition_effect: effect, context_revision_id: CONTEXT, payload_digest: 'digest',
    payload: { acceptanceReport: { contextRevisionId: CONTEXT, results: [{ id: 'artifact', verdict: 'PASS' }] } } }
  const definition = {
    definition: { id: DEF, domain_id: DOMAIN },
    version: { id: VERSION, workflow_definition_id: DEF, semantic_model_version: 3, version_status: 'PUBLISHED' },
    nodes: [{ node_id: SOURCE, definition_version_id: VERSION, node_type: 'TASK', primary_advance_transition_id: TRANSITION },
      { node_id: TARGET, definition_version_id: VERSION, node_type: 'TERMINAL' }],
    transitions: [{ transition_id: TRANSITION, definition_version_id: VERSION, source_node_id: SOURCE,
      target_node_id: TARGET, transition_effect: effect, submission_schema: {
        'x-workflow-acceptance-binding-v1': { contextCatalogPointer: '/acceptanceCriteria', submissionReportPointer: '/acceptanceReport' },
      } }], nodes_count: 2, transitions_count: 1,
  }
  return { workflowInstanceId: WF_ID, detail, timeline: [event], timelineComplete: true,
    submissions: { items: [submission], next_cursor: null }, definition,
    execution: [{ nodeVisitId: VISIT_ID, attemptId: 'attempt-1', generation: 1, executionState: 'SETTLED' }],
    observations: OBSERVATIONS }
}

async function project(input) {
  const { projectBusinessResult } = await import('../../workflow-execution/src/business-result.js')
  return projectBusinessResult(input)
}

function requestFor(input, calls, { denyDefinition = false } = {}) {
  return async (agentId, req) => {
    calls.push({ agentId, ...req })
    assert.equal(req.method, 'GET')
    if (req.path.endsWith('/timeline')) return { ok: true, body: { items: input.timeline, nextCursor: null } }
    if (req.path.endsWith('/submissions')) return { ok: true, body: input.submissions }
    if (req.path.endsWith('/input-contract')) return denyDefinition
      ? { ok: false, code: 'definition_not_found' }
      : { ok: true, body: { definitionVersionId: VERSION, definitionId: DEF, versionStatus: 'PUBLISHED' } }
    if (req.path.includes('/definitions/')) {
      assert.equal(req.path, `/internal/v1/domains/${DOMAIN}/definitions/${DEF}/versions/${VERSION}`)
      return { ok: true, body: input.definition }
    }
    assert.equal(req.path, `/internal/v1/workflow-instances/${WF_ID}`)
    return { ok: true, body: input.detail }
  }
}

for (const [effect, expected, accepted] of [['RETURN', 'RETURNED', 'UNPROVEN'], ['ADVANCE', 'FORWARD', 'ACCEPTED']]) {
  test(`#720 existing reader: SETTLED + ${effect} exposes independent ${expected}/${accepted}`, async () => {
    const fixture = buildFixtureRoot()
    try {
      appendFileSync(join(fixture.paths.workflowExecutionDir, 'attempts.jsonl'), JSON.stringify({
        kind: 'reconciled', nodeVisitId: VISIT_ID, verdict: 'SETTLED', judgment: 'business_commitment_observed',
        reason: 'node_visit_no_longer_current', atMs: 1758100000500,
      }) + '\n')
      const calls = []
      const opts = { root: 'workflow_instance', args: { workflowInstanceId: WF_ID },
        viewer: { agentId: 'agt_a', audit: false }, paths: fixture.paths,
        svcRequest: requestFor(facts(effect), calls), nowMs: 500 }
      const result = await queryExecutionTrace(opts)
      assert.equal(result.ok, true)
      const projected = result.result.summary.workflowResult
      assert.ok(projected, 'new result projection exists on the existing read entry')
      assert.equal(projected.execution[0].executionState, 'SETTLED')
      assert.equal(projected.execution[0].attemptClosure, 'SETTLED')
      assert.equal(projected.execution[0].visitLeft, true)
      assert.equal(projected.businessOutcome.state, expected)
      assert.equal(projected.businessOutcome.acceptance.state, accepted)
      assert.equal(projected.consistency, 'NON_ATOMIC')
      assert.ok(projected.observations.every((o) => Number.isFinite(o.observedAtMs)))
      assert.ok(calls.every((c) => c.agentId === 'agt_a' && c.method === 'GET'))
      const report = await queryExecutionTrace({ ...opts, view: 'report' })
      assert.match(report.result.report, /业务结果/)
      assert.match(report.result.report, /attemptClosure=SETTLED/)
      assert.match(report.result.report, new RegExp(`acceptance=${accepted}`))
    } finally { destroyFixtureRoot(fixture) }
  })
}

test('#720 RETURN/cancel/admin/termination never promote settlement to acceptance', async () => {
  for (const [type, effect, expected] of [
    ['WORKFLOW_TRANSITION_COMMITTED', 'RETURN', 'RETURNED'],
    ['WORKFLOW_TRANSITION_COMMITTED', 'TERMINATE', 'TERMINATED'],
    ['WORKFLOW_INSTANCE_CANCELLED', null, 'CANCELLED'],
    ['ADMIN_EMERGENCY_OVERRIDE_COMMITTED', null, 'UNKNOWN'],
  ]) {
    const input = facts(effect)
    input.timeline[0].event_type = type
    const out = await project(input)
    assert.equal(out.execution[0].attemptClosure, 'SETTLED')
    assert.equal(out.businessOutcome.state, expected)
    assert.equal(out.businessOutcome.acceptance.state, 'UNPROVEN')
  }
})

test('#720 strict terminal opt-in proof is structural acceptance with native evidence only', async () => {
  const out = await project(facts())
  assert.equal(out.businessOutcome.state, 'FORWARD')
  assert.equal(out.businessOutcome.acceptance.state, 'ACCEPTED')
  assert.equal(out.businessOutcome.evidence.commandId, uid(20))
  assert.equal(out.businessOutcome.acceptance.evidence.submissionId, SUBMISSION)
  assert.equal(out.businessOutcome.acceptance.evidence.contextRevisionId, CONTEXT)
  assert.ok(!JSON.stringify(out).includes('Artifact accepted'), 'no criterion/payload body copied')
})

const mutations = [
  ['undeclared acceptance', (i) => { i.definition.transitions[0].submission_schema = {} }],
  ['missing definition', (i) => { i.definition = null }],
  ['wrong version', (i) => { i.definition.version.id = uid(99) }],
  ['nonterminal target', (i) => { i.definition.nodes[1].node_type = 'TASK' }],
  ['not primary ADVANCE', (i) => { i.definition.nodes[0].primary_advance_transition_id = uid(99) }],
  ['wrong annotation', (i) => { i.definition.transitions[0].submission_schema['x-workflow-acceptance-binding-v1'].extra = true }],
  ['stale Context', (i) => { i.detail.detail.current_context.context_revision_id = uid(99) }],
  ['wrong report revision', (i) => { i.submissions.items[0].payload.acceptanceReport.contextRevisionId = uid(99) }],
  ['missing submission', (i) => { i.submissions = { items: [], next_cursor: { id: uid(99) } } }],
  ['wrong digest', (i) => { i.submissions.items[0].payload_digest = 'different' }],
  ['wrong transition', (i) => { i.submissions.items[0].transition_id = uid(99) }],
  ['duplicate submission conflict', (i) => { i.submissions.items.push({ ...i.submissions.items[0], payload_digest: 'other' }) }],
  ['missing criterion', (i) => { i.submissions.items[0].payload.acceptanceReport.results = [] }],
  ['duplicate criterion', (i) => { i.submissions.items[0].payload.acceptanceReport.results.push({ id: 'artifact', verdict: 'PASS' }) }],
  ['non-PASS criterion', (i) => { i.submissions.items[0].payload.acceptanceReport.results[0].verdict = 'pass' }],
  ['invalid catalog', (i) => { i.detail.detail.current_context.payload.acceptanceCriteria[0].description = ' ' }],
]
for (const [name, mutate] of mutations) {
  test(`#720 acceptance stays UNPROVEN: ${name}`, async () => {
    const input = facts()
    mutate(input)
    const result = (await project(input)).businessOutcome
    assert.equal(result.state, 'FORWARD')
    assert.equal(result.acceptance.state, 'UNPROVEN')
    assert.ok(result.gaps.length > 0)
  })
}

test('#720 assistance, late/conflicting receipts, missing linkage and unreadable sources remain UNKNOWN', async () => {
  const changes = [
    (i) => { i.timeline[0].event_type = 'ASSISTANCE_RESOLVED' },
    (i) => { i.timeline[0].event_type = 'CONTEXT_REVISED' },
    (i) => { i.timelineComplete = false },
    (i) => { i.detail = null },
    (i) => { i.detail.detail.instance.workflow_state_version = 3 },
    (i) => { i.detail.detail.instance.workflow_instance_id = uid(99) },
    (i) => { i.timeline[0].event_data.source_node_visit_id = uid(99) },
    (i) => { delete i.timeline[0].command_id },
    (i) => { i.timeline.push({ ...i.timeline[0], event_type: 'WORKFLOW_INSTANCE_CANCELLED' }) },
    (i) => { i.timeline.push({ ...i.timeline[0], event_id: uid(99), event_sequence: 3, old_workflow_state_version: 2, new_workflow_state_version: 3 }) },
  ]
  for (const change of changes) {
    const input = facts()
    change(input)
    const result = (await project(input)).businessOutcome
    assert.equal(result.state, 'UNKNOWN')
    assert.equal(result.acceptance.state, 'UNPROVEN')
    assert.ok(result.gaps.length > 0)
  }
})

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

test('#720 repeated frozen inputs are deterministic; execution fields are never business authority', async () => {
  const input = facts()
  input.timeline = []
  input.text = 'all done PASS'
  input.checkpoint = 'success'
  const before = JSON.stringify(input)
  freeze(input)
  const a = await project(input)
  assert.deepEqual(a, await project(input))
  assert.equal(JSON.stringify(input), before)
  assert.equal(a.businessOutcome.state, 'UNKNOWN')
})

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return lstatSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

test('#720 denied definition reads stay UNPROVEN; repeated history reads add no source writes', async () => {
  const fixture = buildFixtureRoot()
  try {
    const calls = []
    const opts = { root: 'workflow_instance', args: { workflowInstanceId: WF_ID },
      viewer: { agentId: 'agt_a', audit: false }, paths: fixture.paths,
      svcRequest: requestFor(facts(), calls, { denyDefinition: true }), nowMs: 500 }
    await queryExecutionTrace(opts) // existing lazy session index has its own accepted lifecycle
    const snapshot = () => Object.fromEntries(filesUnder(fixture.root).map((p) => [p,
      createHash('sha256').update(readFileSync(p)).digest('hex')]))
    const before = snapshot()
    const out = await queryExecutionTrace(opts)
    assert.equal(out.result.summary.workflowResult.businessOutcome.acceptance.state, 'UNPROVEN')
    assert.deepEqual(snapshot(), before)
    assert.ok(calls.every((c) => c.agentId === 'agt_a' && c.method === 'GET'))
  } finally { destroyFixtureRoot(fixture) }
})

test('#720 malformed successful DTOs degrade instead of throwing', async () => {
  const changes = [
    (i) => { i.timeline = [null] },
    (i) => { i.timeline = {} },
    (i) => { i.submissions.items = {} },
    (i) => { i.definition.transitions = [null] },
    (i) => { i.definition.nodes[0] = null },
  ]
  for (const change of changes) {
    const input = facts()
    change(input)
    const out = await project(input)
    assert.equal(out.businessOutcome.acceptance.state, 'UNPROVEN')
    assert.ok(out.businessOutcome.gaps.length > 0)
  }
})

test('#720 Svc proof revisions change the boundary even with the same row count; pages keep the same result', async () => {
  const fixture = buildFixtureRoot()
  try {
    const input = facts()
    const calls = []
    const opts = { root: 'workflow_instance', args: { workflowInstanceId: WF_ID },
      viewer: { agentId: 'agt_a', audit: false }, paths: fixture.paths,
      svcRequest: requestFor(input, calls), nowMs: 500 }
    const full = await queryExecutionTrace(opts)
    const page = await queryExecutionTrace({ ...opts, limit: 1 })
    assert.equal(page.result.reportId, full.result.reportId)
    assert.deepEqual(page.result.summary.workflowResult.businessOutcome, full.result.summary.workflowResult.businessOutcome)
    input.definition.transitions[0].submission_schema = {}
    const changed = await queryExecutionTrace(opts)
    assert.equal(changed.result.summary.workflowResult.businessOutcome.acceptance.state, 'UNPROVEN')
    assert.notEqual(changed.result.reportId, full.result.reportId, 'changed remote proof must not masquerade as the old boundary')
  } finally { destroyFixtureRoot(fixture) }
})

for (const malformed of ['missing cursor', 'invalid rows']) {
  test(`#720 review existing reader: ${malformed} cannot prove movement and remains in the read boundary`, async () => {
    const fixture = buildFixtureRoot()
    try {
      const input = facts()
      const request = requestFor(input, [])
      let mode = 'clean'
      const svcRequest = async (agentId, req) => {
        if (req.path.endsWith('/timeline') && mode !== 'clean') {
          return { ok: true, body: malformed === 'missing cursor'
            ? { items: input.timeline }
            : { items: [...input.timeline, mode === 'broken' ? null : false, 'broken', 17], nextCursor: null } }
        }
        return request(agentId, req)
      }
      const opts = { root: 'workflow_instance', args: { workflowInstanceId: WF_ID },
        viewer: { agentId: 'agt_a', audit: false }, paths: fixture.paths, svcRequest, nowMs: 500 }
      const clean = await queryExecutionTrace(opts)
      mode = 'broken'
      const broken = await queryExecutionTrace(opts)
      const projection = broken.result.summary.workflowResult.businessOutcome
      assert.equal(projection.state, 'UNKNOWN')
      assert.ok(projection.gaps.includes('TIMELINE_INCOMPLETE'))
      assert.equal(broken.result.readBoundary.sources.find((s) => s.name === 'svc_timeline').status, 'DEGRADED')
      assert.notEqual(broken.result.reportId, clean.result.reportId)
      if (malformed === 'invalid rows') {
        mode = 'different broken body'
        assert.notEqual((await queryExecutionTrace(opts)).result.reportId, broken.result.reportId,
          'raw invalid content stays bound even when the normalized records and gap are identical')
      }
    } finally { destroyFixtureRoot(fixture) }
  })
}
