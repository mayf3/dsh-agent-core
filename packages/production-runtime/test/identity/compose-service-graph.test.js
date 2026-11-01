// Existing service-graph test split mechanically to satisfy structural V2.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { composeProductionRuntime, PRODUCTION_AGENT_PROFILE } from '../../src/compose.js'
import { AGT_ID, FakeProc, seedRuntime, silentLog } from '../compose-fixture.js'
const GLOBAL_ROUTE = Object.freeze({ provider: 'oc-go', model: 'deepseek-v4-flash' })

test('composition provides the full existing service graph over the production layout', async (t) => {
  const { root, layout } = await seedRuntime(t)
  const spawned = []
  const runtime = await composeProductionRuntime({
    globalRoute: GLOBAL_ROUTE,
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: true, host: '127.0.0.1', port: 0 },
    processFactory: (opts) => { const p = new FakeProc(opts); spawned.push(p); return p },
    log: silentLog,
  })
  t.after(() => runtime.stop())

  for (const svc of ['workspaceBootstrap', 'agentDefinition', 'agentRouter', 'brokerGateway', 'notificationIngress']) {
    assert.notEqual(runtime.ctx.get(svc), undefined, `${svc} provided`)
  }
  assert.equal(runtime.definition.getAgent(AGT_ID).id, AGT_ID, 'definition loaded from the production agents.json')
  assert.equal(runtime.agentProfile, PRODUCTION_AGENT_PROFILE)
  assert.equal(PRODUCTION_AGENT_PROFILE, 'agent-core-production', 'default composition is the PRODUCTION profile, not a demo one')

  // The definition config is authority: compose must not rewrite it.
  const doc = JSON.parse(readFileSync(layout.agentsConfig, 'utf8'))
  assert.equal(doc.agents[0].id, AGT_ID)
})

test('composition forwards the trusted exact-agent native policy resolver into process startup', async (t) => {
  const { layout } = await seedRuntime(t)
  const spawned = []
  const resolvedAgentIds = []
  const runtime = await composeProductionRuntime({
    globalRoute: GLOBAL_ROUTE,
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: false, port: 0 },
    processFactory: (opts) => {
      const proc = new FakeProc(opts)
      proc.nativeToolPolicy = opts.nativeToolPolicy
      spawned.push(proc)
      return proc
    },
    resolveNativeToolPolicy: (agentId) => {
      resolvedAgentIds.push(agentId)
      return {
        version: 1,
        agentId,
        mode: 'native-allowlist',
        allowedCalls: [{ toolName: 'read' }],
      }
    },
    log: silentLog,
  })
  t.after(() => runtime.stop())

  const process = await runtime.ctx.get('agentRouter').ensureRunning(AGT_ID)
  assert.equal(process.nativeToolPolicy.agentId, AGT_ID)
  assert.equal(process.nativeToolPolicy.allowedCalls[0].toolName, 'read')
  assert.deepEqual(resolvedAgentIds, [AGT_ID, AGT_ID])
  assert.equal(spawned.length, 1)
})

