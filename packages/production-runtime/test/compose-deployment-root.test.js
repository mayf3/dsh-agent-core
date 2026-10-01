/**
 * B7 compose wiring test: the composition pins the shared credentialFile
 * reference to the runtime's OWN deployment root (CTR-ACT2-001 anticipated
 * the "minimal compose adjustment": loadAgentModelOverrides receives
 * deploymentRoot: layout.root). Proves that a deployment-owned route catalog
 * referencing the layout root's OWN canonical store loads at composition,
 * and a foreign surface's lineage fails closed — on a root that is neither
 * the executing user's default root nor any hardcoded domain path.
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { canonicalOpenAICodexCredentialFileFor } from '../../agent-provisioning/src/shared-codex.js'
import { composeProductionRuntime } from '../src/compose.js'
import { resolveProductionLayout } from '../src/paths.js'

const TARGET = 'agt_cto-agent'
const OTHER = 'agt_other'
const GLOBAL = Object.freeze({ provider: 'oc-go', model: 'deepseek-v4-flash' })

class FakeProc {
  constructor(options) {
    Object.assign(this, options)
    this.pid = 9100 + FakeProc.nextPid++
    this.exit = undefined
    this.exitPromise = new Promise(() => {})
    this.creations = []
  }
  spawn() { return this }
  async ready() { return 1 }
  async shutdown() {
    this.exit = { code: 0, signal: null }
    this.exitPromise = Promise.resolve(this.exit)
    return this.exit
  }
  async turn() { return { reply: 'ok', ms: 1, promptMs: 1, messageId: 'm' } }
  async deliver() { return { accepted: true, sessionId: 'main', messageId: 'm' } }
}
FakeProc.nextPid = 100

async function composeWith(t, layout, credentialFile) {
  mkdirSync(join(layout.root, 'scheduler'), { recursive: true })
  await writeAgentDefinition(layout.agentsConfig, {
    defaultAgentId: TARGET,
    agents: [{ id: TARGET, name: 'CTO' }, { id: OTHER, name: 'Other' }],
  })
  mkdirSync(dirname(layout.agentModelOverrides), { recursive: true })
  writeFileSync(layout.agentModelOverrides, `${JSON.stringify({
    version: 3,
    routeCatalog: {
      luna: {
        routeKind: 'subscription', provider: 'openai-codex', model: 'gpt-5.6-luna',
        plugin: 'dsh-codex', pluginVersion: '0.2.3',
        credentialReadiness: 'shared-canonical-oauth',
        credentialFile,
      },
    },
    overrides: { [TARGET]: { model: { primary: 'luna', fallbacks: [] } } },
  }, null, 2)}\n`, { mode: 0o644 })
  const spawned = []
  const provisioned = []
  const runtime = await composeProductionRuntime({
    layout,
    globalRoute: GLOBAL,
    productApi: { enabled: false },
    notificationIngress: { enabled: false },
    processFactory: (options) => { const proc = new FakeProc(options); spawned.push(proc); return proc },
    provisionHome: (home, workspace, options) => provisioned.push({ home, workspace, options }),
    log: { log() {}, warn() {}, error() {} },
  })
  t.after(() => runtime.stop())
  return { runtime, spawned, provisioned }
}

test('composition pins the credentialFile to the runtime deployment root (own root accepted)', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'compose-dep-root-own-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const layout = resolveProductionLayout(root)
  const own = canonicalOpenAICodexCredentialFileFor(layout.root)
  const { runtime, provisioned } = await composeWith(t, layout, own)
  await runtime.router.ensureRunning(TARGET)
  // The subscription provisioning block (with the pinned credentialFile) rides
  // provisionHome, not the child process (DEC-IMPL-011 spawn boundary).
  assert.equal(provisioned[0].options.subscription.credentialFile, own)
})

test('composition refuses a foreign surface lineage in the deployment-owned catalog (fail closed)', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'compose-dep-root-fx-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const layout = resolveProductionLayout(root)
  const foreign = canonicalOpenAICodexCredentialFileFor(join(root, 'elsewhere'))
  await assert.rejects(
    () => composeWith(t, layout, foreign),
    (e) => e?.code === 'AGENT_MODEL_OVERRIDE_INVALID',
  )
})
