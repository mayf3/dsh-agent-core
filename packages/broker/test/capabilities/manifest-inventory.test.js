import test from 'node:test'
import assert from 'node:assert/strict'

import { validateManifest } from '../../src/schema.js'
import { targets } from '../../src/targets.js'
import { manifests as forumManifests } from '../../src/capabilities/forum.js'
import { manifests as workflowManifests } from '../../src/capabilities/workflow.js'
import { manifests as okrManifests } from '../../src/capabilities/okr.js'

// ─── Schema: all 18 shipped manifests are valid ─────────────────────────────
// (15 first-batch + the 2 VISIT_ACTIVATION_V1 activation-model tools from
// AGENT_CORE_WORKFLOW_DISPATCH_INTENT_BROKER_V1: due poll + wake.)

test('schema: all 18 shipped manifests validate', () => {
  const all = [...forumManifests, ...workflowManifests, ...okrManifests]
  assert.equal(all.length, 18)
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
      assert.ok(['GET', 'POST', 'PUT', 'DELETE'].includes(op.http.method), `${manifest.id}: bad method`)
    }
  }
})
