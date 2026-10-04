// FLEET_CONFIG_V2V3_MIGRATION_V1 (STAGE 1M) — hermetic unit + fixture tests.
//
// RED/GREEN contract (agent-control#195 Defect C, Product #414, 2026-10-02):
//  - GREEN: the exact declared delta — version 2→3 + canonical credentialFile
//    on openai-codex subscription routes, overrides byte-semantics preserved
//    (count/keys/chains), file mode preserved, content-exact preimage backup
//    `<config>.pre-v3-<ts>` written before the atomic swap; the result loads
//    clean under the REAL source-tree v3 loader (G2.7 gate PASS).
//  - RED (zero mutation on EVERY refusal): wrong base version; route key the
//    deployed v2 base never allowed (drift, incl. pre-existing credentialFile /
//    reasoningEffort); duplicate JSON key; missing openai-codex route; and the
//    decisive one — a v2-shape-legal route the REAL v3 loader rejects
//    (dsh-codex plugin without provider openai-codex), proving the loader, not
//    the migrator, is the final authority before any byte lands.
//
// Fixtures mirror the RECORDED authsvc preimage shape: routeCatalog.luna =
// subscription/openai-codex/gpt-5.6-luna/dsh-codex@0.2.3 (no credentialFile),
// 92 luna-primary per-agent overrides (the exact production cardinality the
// carrier G3 binds), agents.json CONFIG_VERSION=1 roster. The loader under
// test is the SOURCE tree's model-overrides.js (the pin's bytes).

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runMigration } from './trusted-cp-fleet-config-v2v3-migration.mjs'
import { runGate } from './trusted-cp-model-overrides-config-gate.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const LOADER_MODULE = join(HERE, '../../packages/production-runtime/src/model-overrides.js')

const FLEET = 92

function scratch() {
  return mkdtempSync(join(tmpdir(), 'dsh-config-migration-test-'))
}

function registryFixture(root, count = FLEET) {
  const agents = Array.from({ length: count }, (_, i) => ({
    id: `agt_fix${String(i).padStart(2, '0')}-agent`,
    name: `fixture-${i}`,
    description: null,
  }))
  const registryPath = join(root, 'agents.json')
  writeFileSync(registryPath, `${JSON.stringify({ version: 1, defaultAgentId: agents[0].id, agents }, null, 2)}\n`)
  return { registryPath, agentIds: agents.map((a) => a.id) }
}

function fleetConfigFixture(root, { version = 2, route, overrides } = {}) {
  const { registryPath, agentIds } = registryFixture(root)
  const finalOverrides = overrides ?? Object.fromEntries(agentIds.map((id) => [id, { model: { primary: 'luna', fallbacks: [] } }]))
  const finalRoute = route ?? {
    routeKind: 'subscription',
    provider: 'openai-codex',
    model: 'gpt-5.6-luna',
    plugin: 'dsh-codex',
    pluginVersion: '0.2.3',
    credentialReadiness: 'bridge-store-bound',
  }
  const config = { version, routeCatalog: { luna: finalRoute }, overrides: finalOverrides }
  const configPath = join(root, 'agent-model-overrides.json')
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
  return { configPath, registryPath, agentIds }
}

function migrationArgs(root, extra = {}) {
  return {
    config: join(root, 'agent-model-overrides.json'),
    registry: join(root, 'agents.json'),
    deploymentRoot: root,
    modelOverridesModule: LOADER_MODULE,
    execute: false,
    ...extra,
  }
}

describe('FLEET_CONFIG_V2V3_MIGRATION_V1 hermetic fixtures', () => {
  test('dry-run: validates the exact delta and mutates NOTHING', async () => {
    const root = scratch()
    try {
      const { configPath } = fleetConfigFixture(root)
      const before = readFileSync(configPath, 'utf8')
      const result = await runMigration(migrationArgs(root))
      assert.equal(result.ok, true, `dry-run refused: ${result.error}`)
      assert.equal(result.mode, 'dry-run')
      assert.deepEqual(result.routesTouched, ['luna'])
      assert.equal(result.overridesBefore, FLEET)
      assert.equal(result.overridesAfter, FLEET)
      assert.equal(result.backupPath, undefined)
      assert.equal(readFileSync(configPath, 'utf8'), before, 'dry-run must not mutate the config')
      assert.equal(readdirSync(root).filter((name) => name.startsWith('agent-model-overrides.json.pre-v3')).length, 0)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('execute: exact delta committed, preimage backup content-exact, mode preserved, overrides untouched', async () => {
    const root = scratch()
    try {
      const { configPath, agentIds } = fleetConfigFixture(root)
      const beforeText = readFileSync(configPath, 'utf8')
      const beforeJson = JSON.parse(beforeText)
      const result = await runMigration(migrationArgs(root, { execute: true }))
      assert.equal(result.ok, true, `execute refused: ${result.error}`)
      assert.equal(result.mode, 'execute')
      assert.ok(result.backupPath && existsSync(result.backupPath), 'backup exists')
      assert.equal(readFileSync(result.backupPath, 'utf8'), beforeText, 'backup is the content-exact preimage')
      assert.equal(result.preSha256, createHash('sha256').update(beforeText).digest('hex'), 'preSha256 is the preimage digest')
      assert.equal(result.postSha256, createHash('sha256').update(readFileSync(configPath)).digest('hex'), 'postSha256 is the committed digest')
      const after = JSON.parse(readFileSync(configPath, 'utf8'))
      assert.equal(after.version, 3)
      assert.equal(after.routeCatalog.luna.credentialFile, join(root, 'shared-credentials/openai-codex/.openai-codex-auth.json'))
      const { canonicalOpenAICodexCredentialFileFor } = await import(join(HERE, '../../packages/agent-provisioning/src/shared-codex.js'))
      assert.equal(after.routeCatalog.luna.credentialFile, canonicalOpenAICodexCredentialFileFor(root))
      const expectedRoute = { ...beforeJson.routeCatalog.luna, credentialFile: after.routeCatalog.luna.credentialFile }
      assert.deepEqual(after.routeCatalog.luna, expectedRoute)
      assert.deepEqual(after.overrides, beforeJson.overrides, 'overrides byte-semantics preserved')
      assert.equal(Object.keys(after.overrides).length, FLEET)
      assert.deepEqual(Object.keys(after.overrides), agentIds)
      assert.equal(statSync(configPath).mode & 0o777, 0o600, 'file mode preserved')
      assert.deepEqual(Object.keys(after), Object.keys(beforeJson), 'top-level key set unchanged')
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('execute result passes the G2.7 gate under the same loader', async () => {
    const root = scratch()
    try {
      fleetConfigFixture(root)
      const migrated = await runMigration(migrationArgs(root, { execute: true }))
      assert.equal(migrated.ok, true)
      const gate = await runGate({
        config: join(root, 'agent-model-overrides.json'),
        registry: join(root, 'agents.json'),
        deploymentRoot: root,
        modelOverridesModule: LOADER_MODULE,
        definitionModule: join(HERE, '../../packages/agent-definition/src/definition.js'),
      })
      assert.equal(gate.ok, true, `gate failed: ${gate.error}`)
      assert.equal(gate.overrideCount, FLEET)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('RED: base version 3 refuses (not a migration input) with zero mutation', async () => {
    const root = scratch()
    try {
      const { configPath } = fleetConfigFixture(root, { version: 3, route: { routeKind: 'subscription', provider: 'openai-codex', model: 'gpt-5.6-luna', plugin: 'dsh-codex', pluginVersion: '0.2.3', credentialReadiness: 'bridge-store-bound', credentialFile: join(root, 'shared-credentials/openai-codex/.openai-codex-auth.json') } })
      const before = readFileSync(configPath, 'utf8')
      const result = await runMigration(migrationArgs(root, { execute: true }))
      assert.equal(result.ok, false)
      assert.equal(result.errorCode, 'FLEET_CONFIG_BASE_VERSION_INVALID')
      assert.equal(readFileSync(configPath, 'utf8'), before)
      assert.equal(result.backupPath, undefined)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('RED: v3-only route key (reasoningEffort) = drift, refuses with zero mutation', async () => {
    const root = scratch()
    try {
      const { configPath } = fleetConfigFixture(root, {
        route: {
          routeKind: 'subscription', provider: 'openai-codex', model: 'gpt-5.6-luna',
          plugin: 'dsh-codex', pluginVersion: '0.2.3', credentialReadiness: 'bridge-store-bound',
          reasoningEffort: 'minimal',
        },
      })
      const before = readFileSync(configPath, 'utf8')
      const result = await runMigration(migrationArgs(root, { execute: true }))
      assert.equal(result.ok, false)
      assert.equal(result.errorCode, 'FLEET_CONFIG_UNEXPECTED_ROUTE_KEY')
      assert.ok(result.error.includes('reasoningEffort'))
      assert.equal(readFileSync(configPath, 'utf8'), before)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('RED: pre-existing credentialFile in a v2 base = drift, refuses with zero mutation', async () => {
    const root = scratch()
    try {
      const { configPath } = fleetConfigFixture(root, {
        route: {
          routeKind: 'subscription', provider: 'openai-codex', model: 'gpt-5.6-luna',
          plugin: 'dsh-codex', pluginVersion: '0.2.3', credentialReadiness: 'bridge-store-bound',
          credentialFile: '/somewhere/else.json',
        },
      })
      const before = readFileSync(configPath, 'utf8')
      const result = await runMigration(migrationArgs(root, { execute: true }))
      assert.equal(result.ok, false)
      assert.equal(result.errorCode, 'FLEET_CONFIG_UNEXPECTED_ROUTE_KEY')
      assert.equal(readFileSync(configPath, 'utf8'), before)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('RED: duplicate JSON key in the input refuses', async () => {
    const root = scratch()
    try {
      const { configPath } = fleetConfigFixture(root)
      const text = readFileSync(configPath, 'utf8')
      const duplicated = `${text.replace(/\}\s*$/, ',\n  "version": 2\n}\n')}`
      JSON.parse(duplicated) // JSON.parse itself keeps the last — the textual scanner must still refuse
      writeFileSync(configPath, duplicated)
      const result = await runMigration(migrationArgs(root))
      assert.equal(result.ok, false)
      assert.equal(result.errorCode, 'FLEET_CONFIG_DUPLICATE_KEY')
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('RED: no openai-codex subscription route refuses', async () => {
    const root = scratch()
    try {
      fleetConfigFixture(root, { route: { routeKind: 'builtin', provider: 'oc-go', model: 'deepseek-v4-flash', credentialReadiness: 'n/a' } })
      const result = await runMigration(migrationArgs(root))
      assert.equal(result.ok, false)
      assert.equal(result.errorCode, 'FLEET_CONFIG_NO_CODEX_ROUTE')
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('RED: the REAL v3 loader is the final authority — a v2-legal route it rejects refuses the swap with zero mutation', async () => {
    const root = scratch()
    try {
      const { configPath } = fleetConfigFixture(root)
      const config = JSON.parse(readFileSync(configPath, 'utf8'))
      // v2-loader-legal (its pin check keys off plugin, not provider), but the
      // v3 loader rejects it: plugin dsh-codex ⇒ openai-codex shared mode ⇒
      // provider must be openai-codex + canonical credentialFile.
      config.routeCatalog.legacy = {
        routeKind: 'subscription', provider: 'legacy-sub', model: 'gpt-5.6-luna',
        plugin: 'dsh-codex', pluginVersion: '0.2.3', credentialReadiness: 'bridge-store-bound',
      }
      writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
      const before = readFileSync(configPath, 'utf8')
      const result = await runMigration(migrationArgs(root, { execute: true }))
      assert.equal(result.ok, false, 'candidate that the real loader rejects must not commit')
      assert.equal(result.errorCode, 'AGENT_MODEL_OVERRIDE_INVALID')
      assert.ok(result.error.includes('routeCatalog.legacy must contain'), `loader error surfaced: ${result.error}`)
      assert.equal(readFileSync(configPath, 'utf8'), before, 'production bytes untouched')
      assert.equal(result.backupPath, undefined, 'no backup written on refusal')
      assert.equal(readdirSync(root).filter((name) => name.includes('.v3-candidate-')).length, 0, 'candidate staged file cleaned up')
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
})
