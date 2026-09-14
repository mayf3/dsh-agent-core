import test from 'node:test'
import assert from 'node:assert/strict'

import { buildPostdeployAcceptanceReceipt } from '../../src/scheduler/deployment-postdeploy-gate.js'

const sourceSha = 'a'.repeat(40)
const input = {
  sourceSha, observedAt: '2026-09-15T00:00:00Z', storeDelta: 'CANARY_ONLY',
  health: { complete: true, enabled: 3, healthy: 2, degraded: 0, blocked: 1, unknown: 0, provenance: { runtime: sourceSha, canonicalPair: true } },
  canary: { newDisposableJob: true, sideEffectFree: true, outcome: 'succeeded', unrelatedJobIsolation: 'PASS', occurrenceId: 'occ-canary' },
  passiveReplay: { syntheticEvidence: false, quarantinePreserved: true, incidentDedupe: 'PASS' },
}

test('postdeploy receipt exists only after canonical census, passive replay and fresh side-effect-free canary', () => {
  assert.equal(buildPostdeployAcceptanceReceipt(input).status, 'ACCEPTED')
  for (const bad of [
    { health: { ...input.health, complete: false } }, { health: { ...input.health, unknown: 1 } },
    { canary: { ...input.canary, sideEffectFree: false } }, { passiveReplay: { ...input.passiveReplay, syntheticEvidence: true } },
    { storeDelta: 'UNEXPECTED' },
  ]) assert.throws(() => buildPostdeployAcceptanceReceipt({ ...input, ...bad }), /gate failed/)
})
