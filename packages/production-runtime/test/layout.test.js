/**
 * Unit tests for the Production Runtime persistent layout
 * (PRODUCTION_RUNTIME_V1 Task 3): one root owns every durable path, the
 * default root is the real production directory (~/.agent-core — the same
 * root agentcore-cron defaults to), and demo state (.demo) is rejected
 * fail-loud so production persistence can never depend on it.
 */

import assert from 'node:assert/strict'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  PRODUCTION_RUNTIME_ROOT_ENV,
  defaultProductionRoot,
  resolveProductionLayout,
} from '../src/paths.js'

test('default production root is ~/.agent-core (agentcore-cron store root, NOT .demo)', () => {
  const previous = process.env[PRODUCTION_RUNTIME_ROOT_ENV]
  delete process.env[PRODUCTION_RUNTIME_ROOT_ENV]
  try {
    const layout = resolveProductionLayout()
    assert.equal(layout.root, join(homedir(), '.agent-core'))
    assert.equal(layout.root, defaultProductionRoot())
    assert.equal(layout.jobsStore, join(homedir(), '.agent-core', 'scheduler', 'jobs.json'))
    assert.ok(!layout.root.includes('.demo'), 'no .demo anywhere in the production root')
  } finally {
    if (previous !== undefined) process.env[PRODUCTION_RUNTIME_ROOT_ENV] = previous
  }
})

test('layout derives every durable path under one root', () => {
  const layout = resolveProductionLayout('/opt/agent-core-root')
  assert.equal(layout.root, '/opt/agent-core-root')
  assert.equal(layout.agentsConfig, join(layout.root, 'agents.json'))
  assert.equal(layout.bindingsStore, join(layout.root, 'bindings', 'bindings.json'))
  assert.equal(layout.jobsStore, join(layout.root, 'scheduler', 'jobs.json'))
  assert.equal(layout.runsLog, join(layout.root, 'scheduler', 'runs.jsonl'))
  assert.equal(layout.workspacesRoot, join(layout.root, 'workspaces'))
  assert.equal(layout.homesRoot, join(layout.root, 'homes'))
  assert.equal(layout.evidenceLog, join(layout.root, 'control', 'runtime-evidence.jsonl'))
  assert.equal(layout.logsDir, join(layout.root, 'logs'))
  for (const value of Object.values(layout)) {
    assert.ok(value.startsWith(layout.root), `${value} stays under the root`)
  }
})

test('explicit root wins over the env; the env wins over the default', () => {
  const previous = process.env[PRODUCTION_RUNTIME_ROOT_ENV]
  process.env[PRODUCTION_RUNTIME_ROOT_ENV] = '/from-env/root'
  try {
    assert.equal(resolveProductionLayout().root, '/from-env/root')
    assert.equal(resolveProductionLayout('/explicit/root').root, '/explicit/root')
  } finally {
    if (previous === undefined) delete process.env[PRODUCTION_RUNTIME_ROOT_ENV]
    else process.env[PRODUCTION_RUNTIME_ROOT_ENV] = previous
  }
})

test('.demo roots are rejected fail-loud (production state is never demo state)', () => {
  assert.throws(() => resolveProductionLayout(join(homedir(), 'repo', '.demo', 'runtime')), /\.demo/)
  assert.throws(() => resolveProductionLayout('/x/.demo/y'), /refusing \.demo root/)
})
