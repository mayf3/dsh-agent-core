import test from 'node:test'
import assert from 'node:assert/strict'

import { validateManifest } from '../../src/schema.js'
import { targets } from '../../src/targets.js'
import { manifests as forumManifests } from '../../src/capabilities/forum.js'
import { manifests as workflowManifests } from '../../src/capabilities/workflow.js'
import { manifests as workflowHumanPrincipalProjectionManifests } from '../../src/capabilities/workflow-human-principal-projection.js'
import { manifests as okrManifests } from '../../src/capabilities/okr.js'

// ─── Schema: bounded Forum/Workflow/OKR inventory is valid ──────────────────
// Includes the exact Human projection LOCAL capability from
// AGENT_CORE_WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_V0.

test('schema: all 22 bounded inventory manifests validate', () => {
  const all = [...forumManifests, ...workflowManifests, ...workflowHumanPrincipalProjectionManifests, ...okrManifests]
  assert.equal(all.length, 22)
  for (const manifest of all) {
    const res = validateManifest(manifest)
    assert.equal(res.ok, true, `${manifest.id}: ${res.errors?.join('; ')}`)
  }
  // every http op pins a known target and declares its scopes
  for (const manifest of all) {
    for (const op of manifest.operations) {
      if (!op.http) continue
      assert.ok(targets.some((t) => t.targetId === op.http.target), `${manifest.id}: unknown target`)
      assert.ok(manifest.requiredScopes.length > 0, `${manifest.id}: missing requiredScopes`)
      assert.ok(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(op.http.method), `${manifest.id}: bad method`)
    }
  }
})
