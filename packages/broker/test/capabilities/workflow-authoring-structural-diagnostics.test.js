// ERROR_PRESERVATION_V1 AMENDMENT_1 focused tests (R6 structural diagnostics).
//
// Production root cause (docs/investigations/
// WDA_AUTHORING_STRUCTURAL_DIAGNOSTICS_ROOT_CAUSE_V1.md): structural
// rejections on replace_draft_graph returned a BARE invalid_arguments
// envelope because mapping.js discarded the violation strings whenever no
// `validationError` leaf resolved. CTR-WDA-007(b) already authorizes the
// model-visible detail rendering; R6 lets the authoring manifest opt the
// operation in so the violations actually reach that rendering path.
// Scope discipline (SD-4/SD-5): operations and capabilities that do not
// declare `structuralDiagnostics: true` keep byte-identical envelopes.

import test from 'node:test'
import assert from 'node:assert/strict'
import { validateInvocation, assertValidManifest } from '../../src/mapping.js'
import { validateManifest } from '../../src/schema.js'
import { workflowDefinitionAuthoringManifest as rawAuthoringManifest } from '../../src/capabilities/workflow-definition-authoring.js'
import { buildToolDefinition } from '../../src/registry.js'
import { manifest as calculatorManifest } from '../../src/calculator.manifest.js'

const authoring = assertValidManifest(rawAuthoringManifest)
const op = (name) => authoring.operations.find((candidate) => candidate.name === name)
const base = { domainId: 'd1', definitionId: 'def1', definitionVersionId: 'v1' }
const call = (args) => validateInvocation(authoring, { operation: 'replace_draft_graph', args })

test('SD-1 unknown root property on replace_draft_graph carries the violated property path', () => {
  const res = call({ ...base, graph: { nodes: [], transitions: [] }, contextSchema: { type: 'object' } })
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'invalid_arguments')
  assert.match(res.error.detail, /unknown property "graph"/)
})

test('SD-2 missing required property is named in detail', () => {
  const res = validateInvocation(authoring, { operation: 'replace_draft_graph', args: { domainId: 'd1', definitionId: 'def1' } })
  assert.equal(res.ok, false)
  assert.match(res.error.detail, /missing required property "definitionVersionId"/)
})

test('SD-3 cross-operation argument carryover (semanticModelVersion on replace) is named', () => {
  const res = call({ ...base, semanticModelVersion: 3, steps: [], terminalOutcome: 'done' })
  assert.equal(res.ok, false)
  assert.match(res.error.detail, /unknown property "semanticModelVersion"/)
})

test('SD-4 non-opted operations keep bare envelopes (no detail)', () => {
  for (const name of ['create_definition', 'create_draft_version', 'publish_version']) {
    const res = validateInvocation(authoring, { operation: name, args: { unrelated: true } })
    assert.equal(res.ok, false)
    assert.deepEqual(res.error, { code: 'invalid_arguments' })
  }
})

test('SD-5 calculator V0 fixture envelopes stay byte-identical', () => {
  const res = validateInvocation(calculatorManifest, { operation: 'divide', args: { a: 1 } })
  assert.deepEqual(res, { ok: false, error: { code: 'invalid_arguments' } })
  const badType = validateInvocation(calculatorManifest, { operation: 'add', args: { a: 'x', b: 2 } })
  assert.deepEqual(badType, { ok: false, error: { code: 'invalid_arguments' } })
})

test('SD-6 schema fail-closed: only explicit true is accepted; canonical form keeps it', () => {
  const clone = () => JSON.parse(JSON.stringify(rawAuthoringManifest))
  const bad = clone()
  bad.operations.find((o) => o.name === 'replace_draft_graph').arguments.structuralDiagnostics = false
  assert.equal(validateManifest(bad).ok, false)
  const typo = clone()
  typo.operations.find((o) => o.name === 'replace_draft_graph').arguments.structuralDiagnostics = 'yes'
  assert.equal(validateManifest(typo).ok, false)
  const good = validateManifest(clone())
  assert.equal(good.ok, true)
  const replace = good.manifest.operations.find((o) => o.name === 'replace_draft_graph')
  assert.equal(replace.arguments.structuralDiagnostics, true)
  const untouched = good.manifest.operations.find((o) => o.name === 'create_definition')
  assert.equal(untouched.arguments.structuralDiagnostics, undefined)
})

test('SD-7 detail is capped at 500 characters', () => {
  const wide = { ...base }
  for (let i = 0; i < 40; i++) wide[`unknown_property_with_a_reasonably_long_name_${String(i).padStart(3, '0')}`] = true
  const res = call(wide)
  assert.equal(res.ok, false)
  assert.ok(res.error.detail.length > 400, 'the cap must actually engage for this fixture')
  assert.ok(res.error.detail.length <= 500)
})

test('R6 detail reaches the authorized CTR-WDA-007(b) model-visible rendering', () => {
  const { definition } = buildToolDefinition({ manifest: rawAuthoringManifest, handlers: {} })
  const args = { operation: 'replace_draft_graph', ...base, graph: { nodes: [], transitions: [] } }
  const rendered = definition.output.render(args, call({ ...base, graph: { nodes: [], transitions: [] } }))
  assert.match(rendered[0].text, /invalid_arguments: unknown property "graph"/)
})

test('R6 leaves every manifest-level schema surface byte-identical (CTR-WDA-002 untouched)', () => {
  const replace = op('replace_draft_graph').arguments
  assert.deepEqual(Object.keys(replace.properties).sort(), [
    'contextSchema', 'definitionId', 'definitionVersionId', 'domainId',
    'nodes', 'steps', 'terminalOutcome', 'transitions',
  ])
  assert.deepEqual(replace.required, ['domainId', 'definitionId', 'definitionVersionId'])
  assert.equal(replace.additionalProperties, false)
})
