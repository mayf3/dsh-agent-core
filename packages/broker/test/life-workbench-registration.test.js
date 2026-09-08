/**
 * @agent-core/broker — Life Workbench registration closure test.
 *
 * LIFE_WORKBENCH_BROKER_DEPLOYMENT_CLOSURE_V1: the life-workbench target and
 * the workbench_read / workbench_propose manifests are part of the canonical
 * source closure, so ANY clean stage/deploy from this tree carries the tool
 * surface (the 2026-09-08 regression: a live-tree-only registration was wiped
 * by a clean redeploy and Feishu agents lost the capability while every grant
 * stayed intact).
 *
 * Text-assertion form (same CI constraint as index-bindings.test.js): the
 * worktree cannot resolve index.js's full import graph, so the assertions pin
 * the SOURCE composition instead of importing it.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { test } from 'node:test'
import assert from 'node:assert/strict'

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

test('targets registry contains the pinned life-workbench target', () => {
  const targets = readFileSync(join(src, 'targets.js'), 'utf8')
  assert.match(
    targets,
    /\{ targetId: 'life-workbench', allowedOrigin: 'http:\/\/127\.0\.0\.1:7781', audience: 'life-workbench' \},/,
    'targets.js must register the life-workbench target verbatim',
  )
})

test('capability file exists with the registration markers', () => {
  const capability = readFileSync(join(src, 'capabilities', 'life-workbench.mjs'), 'utf8')
  assert.match(capability, /targetId:\s*'life-workbench'/)
  assert.match(capability, /workbench_read/)
  assert.match(capability, /workbench_propose/)
})

test('DEFAULT_MANIFESTS composes the life-workbench manifests', () => {
  const index = readFileSync(join(src, 'index.js'), 'utf8')
  assert.match(
    index,
    /import \{ lifeWorkbenchManifests \} from '\.\/capabilities\/life-workbench\.mjs'/,
    'index.js must import the life-workbench manifests',
  )
  assert.match(
    index,
    /\.\.\.lifeWorkbenchManifests,/,
    'DEFAULT_MANIFESTS must spread the life-workbench manifests',
  )
})
