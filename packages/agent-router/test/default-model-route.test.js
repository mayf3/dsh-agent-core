/**
 * DEFAULT_MODEL_ROUTING_CONFIG_V1 A-D6: the non-production AgentProcess
 * construction surface resolves explicit args > env > the canonical built-in
 * default (openai-codex/gpt-5.6-luna) — never a hardcoded provider literal.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentProcess } from '../src/process/agent-process.js'
import { CANONICAL_DEFAULT_MODEL_ROUTE } from '../../agent-provisioning/src/shared-codex.js'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'agent-default-route-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return {
    agentId: 'agt_default-route',
    home: join(root, 'home'),
    workspace: join(root, 'ws'),
    profile: 'agent-core-demo',
    log: { log() {}, error() {} },
  }
}

function withRouteEnv(t, value) {
  const previousProvider = process.env.DSH_AGENT_PROVIDER
  const previousModel = process.env.DSH_AGENT_MODEL
  if (value === undefined) {
    delete process.env.DSH_AGENT_PROVIDER
    delete process.env.DSH_AGENT_MODEL
  } else {
    process.env.DSH_AGENT_PROVIDER = value.provider
    process.env.DSH_AGENT_MODEL = value.model
  }
  t.after(() => {
    if (previousProvider === undefined) delete process.env.DSH_AGENT_PROVIDER
    else process.env.DSH_AGENT_PROVIDER = previousProvider
    if (previousModel === undefined) delete process.env.DSH_AGENT_MODEL
    else process.env.DSH_AGENT_MODEL = previousModel
  })
}

test('zero-config construction resolves the canonical Luna built-in default', (t) => {
  withRouteEnv(t, undefined)
  const proc = new AgentProcess(fixture(t))
  assert.equal(proc.provider, CANONICAL_DEFAULT_MODEL_ROUTE.provider)
  assert.equal(proc.model, CANONICAL_DEFAULT_MODEL_ROUTE.model)
})

test('explicit constructor route wins over env; env wins over the default', (t) => {
  withRouteEnv(t, { provider: 'zai', model: 'glm-5.3' })
  const explicit = new AgentProcess({ ...fixture(t), provider: 'opencode-go', model: 'deepseek-v4-flash' })
  assert.deepEqual({ provider: explicit.provider, model: explicit.model }, { provider: 'opencode-go', model: 'deepseek-v4-flash' })

  const fromEnv = new AgentProcess(fixture(t))
  assert.deepEqual({ provider: fromEnv.provider, model: fromEnv.model }, { provider: 'zai', model: 'glm-5.3' })
})
