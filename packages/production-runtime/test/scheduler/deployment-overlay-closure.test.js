import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { narrowOverlayUniverse } from '../../../../scripts/lib/admission-lib.mjs'
import { adaptCandidateComposeToPinnedV2 } from '../../src/scheduler/deployment-goal-overlay.js'

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

test('overlay closure pins only an exact reviewed live dependency and updates the rest', () => {
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

  const modelPath = 'packages/production-runtime/src/model-overrides.js'
  const result = narrowOverlayUniverse({
    seedPaths: ['packages/production-runtime/src/compose.js'],
    readTarget: (path) => {
      if (!target.has(path)) throw new Error(`missing target ${path}`)
      return target.get(path)
    },
    liveHas: (path) => live.has(path),
    liveShaOf: (path) => live.has(path) ? sha256(live.get(path)) : undefined,
    preserveLiveShaByPath: new Map([[modelPath, sha256(live.get(modelPath))]]),
  })

  assert.equal(result.refuse, undefined)
  assert.deepEqual([...result.overlay.keys()].sort(), [
    'packages/production-runtime/src/compose.js',
    'packages/production-runtime/src/scheduler/health-runtime.js',
  ])
})

test('production compose keeps candidate watchdog wiring while using the pinned v2 loader contract', () => {
  const candidate = readFileSync(new URL('../../src/compose.js', import.meta.url), 'utf8')
  const adapted = adaptCandidateComposeToPinnedV2(candidate)

  assert.match(adapted, /mountConfiguredSchedulerHealthRuntime/)
  assert.match(adapted, /createSchedulerRuntimeStarter/)
  assert.match(adapted, /agent-model-overrides\.json version 2/)
  assert.match(adapted, /provider: process\.env\.DSH_AGENT_PROVIDER \?\? 'opencode-go'/)
  assert.doesNotMatch(adapted, /canonicalDefaultGlobalRoute|CANONICAL_DEFAULT_MODEL_ROUTE/)
})

test('overlay refuses when the separately governed live dependency drifts from its reviewed pin', () => {
  const composePath = 'packages/production-runtime/src/compose.js'
  const modelPath = 'packages/production-runtime/src/model-overrides.js'
  const target = new Map([
    [composePath, "import { loader } from './model-overrides.js'\n"],
    [modelPath, 'export const loader = "v3"\n'],
  ])
  const live = new Map([[modelPath, 'export const loader = "unexpected"\n']])

  const result = narrowOverlayUniverse({
    seedPaths: [composePath],
    readTarget: (path) => target.get(path),
    liveHas: (path) => live.has(path),
    liveShaOf: (path) => live.has(path) ? sha256(live.get(path)) : undefined,
    preserveLiveShaByPath: new Map([[modelPath, sha256('export const loader = "reviewed-v2"\n')]]),
  })

  assert.equal(result.refuse, `pinned live dependency drift: ${modelPath}`)
})
