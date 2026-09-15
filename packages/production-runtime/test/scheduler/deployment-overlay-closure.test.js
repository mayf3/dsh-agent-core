import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import { narrowOverlayUniverse } from '../../../../scripts/lib/admission-lib.mjs'

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

test('overlay closure preserves existing dependencies outside the exact goal seeds', () => {
  const target = new Map([
    ['packages/production-runtime/src/compose.js', [
      "import { health } from './scheduler/health-runtime.js'",
      "import { loader } from './model-overrides.js'",
      '',
    ].join('\n')],
    ['packages/production-runtime/src/scheduler/health-runtime.js', 'export const health = "target"\n'],
    ['packages/production-runtime/src/model-overrides.js', 'export const loader = "v2-compatible"\n'],
  ])
  const live = new Map([
    ['packages/production-runtime/src/compose.js', 'old compose\n'],
    ['packages/production-runtime/src/scheduler/health-runtime.js', 'old health\n'],
    ['packages/production-runtime/src/model-overrides.js', 'export const loader = "production-v2"\n'],
  ])

  const result = narrowOverlayUniverse({
    seedPaths: ['packages/production-runtime/src/compose.js'],
    readTarget: (path) => {
      if (!target.has(path)) throw new Error(`missing target ${path}`)
      return target.get(path)
    },
    liveHas: (path) => live.has(path),
    liveShaOf: (path) => live.has(path) ? sha256(live.get(path)) : undefined,
  })

  assert.equal(result.refuse, undefined)
  assert.deepEqual([...result.overlay.keys()], ['packages/production-runtime/src/compose.js'])
})

test('goal delta merges into the exact live predecessor without overwriting unrelated live changes', async () => {
  const { mergeGoalDeltaIntoLive } = await import('../../src/scheduler/deployment-goal-overlay.js')
  const base = 'route=v3-source\nunchanged=yes\nstart=old\n'
  const live = 'route=v2-production\nunchanged=yes\nstart=old\n'
  const target = 'route=v3-source\nunchanged=yes\nstart=watchdog-health\n'

  const merged = mergeGoalDeltaIntoLive({ base, live, target })

  assert.equal(merged, 'route=v2-production\nunchanged=yes\nstart=watchdog-health\n')
  assert.equal(mergeGoalDeltaIntoLive({ base, live: merged, target }), merged)
})
