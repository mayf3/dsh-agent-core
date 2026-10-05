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
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, existsSync, readdirSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as migration from './trusted-cp-fleet-config-v2v3-migration.mjs'
const { runMigration } = migration
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


const registryOnlyIds = Array.from({ length: 6 }, (_, i) => `agt_extra${i}-fixture`)

describe('B7 exact preimage and failure truth (isolated files only)', () => {
  test('current98 / frozen92 is rejected before any backup or swap', async () => {
    const root = scratch()
    try {
      const { configPath, registryPath } = fleetConfigFixture(root)
      const before = readFileSync(configPath, 'utf8')
      const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
      registry.agents.push(...registryOnlyIds.map((id) => ({ id, name: id, description: null })))
      writeFileSync(registryPath, JSON.stringify(registry))
      const result = await runMigration(migrationArgs(root, { execute: true }))
      assert.equal(result.ok, false, 'a valid loader alone must not authorize registry expansion')
      assert.equal(result.errorCode, 'FLEET_CONFIG_COHORT_DRIFT')
      assert.deepEqual(result.registryOnly, [...registryOnlyIds].sort())
      assert.equal(result.configReplaced, false)
      assert.equal(result.backupPath, undefined)
      assert.equal(readFileSync(configPath, 'utf8'), before)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('post-rename failure reports actual mutation and retains its exact preimage', async () => {
    const root = scratch()
    try {
      const { configPath } = fleetConfigFixture(root)
      const before = readFileSync(configPath, 'utf8')
      const result = await runMigration(migrationArgs(root, { execute: true }), {
        afterSwap() { throw Object.assign(new Error('injected post-swap readback failure'), { code: 'INJECTED' }) },
      })
      assert.equal(result.ok, false)
      assert.equal(result.configReplaced, true)
      assert.equal(result.errorCode, 'INJECTED')
      assert.equal(JSON.parse(readFileSync(configPath, 'utf8')).version, 3)
      assert.equal(readFileSync(result.backupPath, 'utf8'), before)
      const restored = migration.restoreMigration(result)
      assert.equal(restored.ok, true)
      assert.equal(readFileSync(configPath, 'utf8'), before)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('registry changes during preparation are refused without changing config', async () => {
    const root = scratch()
    try {
      const { configPath, registryPath } = fleetConfigFixture(root)
      const before = readFileSync(configPath, 'utf8')
      const result = await runMigration(migrationArgs(root, { execute: true }), {
        beforeSwap() {
          const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
          registry.agents.push({ id: 'agt_unapproved-late-agent', name: 'late', description: null })
          writeFileSync(registryPath, JSON.stringify(registry))
        },
      })
      assert.equal(result.ok, false)
      assert.equal(result.errorCode, 'FLEET_CONFIG_PREIMAGE_CHANGED')
      assert.equal(result.configReplaced, false)
      assert.equal(readFileSync(configPath, 'utf8'), before)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  for (const failurePoint of ['after-config-before-code', 'restart-failed']) {
    test(`${failurePoint}: recorded config restores exactly; UNKNOWN and mutable state stay untouched`, async () => {
      const root = scratch()
      try {
        const { configPath } = fleetConfigFixture(root)
        const before = readFileSync(configPath, 'utf8')
        const unknown = join(root, 'business-state.json')
        const mutable = join(root, 'mutable-store-fixture.json')
        writeFileSync(unknown, JSON.stringify({ outcome: 'UNKNOWN', effectFence: true, replayCount: 0 }))
        writeFileSync(mutable, JSON.stringify({ revision: 2 }))
        const receipt = await runMigration(migrationArgs(root, { execute: true }))
        assert.equal(receipt.ok, true)
        // Failure belongs to the caller; no service/code/plugin mutation is simulated as verified.
        writeFileSync(`${configPath}.pre-v3-99999999T999999Z`, 'unrelated newer backup')
        const recovered = migration.restoreMigration(receipt)
        assert.equal(recovered.ok, true)
        assert.equal(readFileSync(configPath, 'utf8'), before, 'use recorded backup, never latest')
        assert.equal(statSync(configPath).mode & 0o777, 0o600)
        assert.deepEqual(JSON.parse(readFileSync(unknown)), { outcome: 'UNKNOWN', effectFence: true, replayCount: 0 })
        assert.deepEqual(JSON.parse(readFileSync(mutable)), { revision: 2 })
        assert.equal(migration.restoreMigration(receipt).state, 'ALREADY_RESTORED')
        const after = await runMigration(migrationArgs(root, { execute: false }))
        assert.equal(after.ok, true, 'restored file is still a valid v2 preimage; this dry-run executes no work')
      } finally { rmSync(root, { recursive: true, force: true }) }
    })
  }

  test('foreign current config or altered backup cannot be overwritten on recovery', async () => {
    const root = scratch()
    try {
      const { configPath } = fleetConfigFixture(root)
      const receipt = await runMigration(migrationArgs(root, { execute: true }))
      assert.equal(receipt.ok, true)
      const committed = readFileSync(configPath, 'utf8')
      writeFileSync(configPath, 'another writer owns this config')
      assert.equal(migration.restoreMigration(receipt).errorCode, 'FLEET_CONFIG_RECOVERY_CONFLICT')
      assert.equal(readFileSync(configPath, 'utf8'), 'another writer owns this config')
      writeFileSync(configPath, committed)
      writeFileSync(receipt.backupPath, 'tampered preimage')
      assert.equal(migration.restoreMigration(receipt).errorCode, 'FLEET_CONFIG_BACKUP_MISMATCH')
      assert.equal(readFileSync(configPath, 'utf8'), committed)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
})


test('same-size unknown roster replacement is still refused', async () => {
  const root = scratch()
  try {
    const { configPath, registryPath } = fleetConfigFixture(root)
    const before = readFileSync(configPath, 'utf8')
    const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
    registry.agents[1].id = 'agt_unknown-replacement'
    writeFileSync(registryPath, JSON.stringify(registry))
    const result = await runMigration(migrationArgs(root, { execute: true }))
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'FLEET_CONFIG_COHORT_DRIFT')
    assert.deepEqual(result.registryOnly, ['agt_unknown-replacement'])
    assert.equal(result.configOnly.length, 1)
    assert.equal(result.configReplaced, false)
    assert.equal(readFileSync(configPath, 'utf8'), before)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('matching restored bytes do not conceal unexpected permission drift', async () => {
  const root = scratch()
  try {
    const { configPath } = fleetConfigFixture(root)
    const receipt = await runMigration(migrationArgs(root, { execute: true }))
    assert.equal(migration.restoreMigration(receipt).ok, true)
    chmodSync(configPath, 0o644)
    const result = migration.restoreMigration(receipt)
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'FLEET_CONFIG_RECOVERY_CONFLICT')
    assert.equal(statSync(configPath).mode & 0o777, 0o644, 'must not silently repair another writer metadata')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('matching config/backup permission drift cannot replace recorded metadata', async () => {
  const root = scratch()
  try {
    const { configPath } = fleetConfigFixture(root)
    const receipt = await runMigration(migrationArgs(root, { execute: true }))
    chmodSync(configPath, 0o644)
    chmodSync(receipt.backupPath, 0o644)
    const result = migration.restoreMigration(receipt)
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'FLEET_CONFIG_RECOVERY_CONFLICT')
    assert.equal(JSON.parse(readFileSync(configPath)).version, 3)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('restore collision never deletes a file created by another attempt', async () => {
  const root = scratch()
  const now = Date.now
  try {
    const { configPath } = fleetConfigFixture(root)
    const receipt = await runMigration(migrationArgs(root, { execute: true }))
    Date.now = () => 12345678
    const collision = `${configPath}.restore-${process.pid}-${Date.now()}`
    writeFileSync(collision, 'other attempt owns this')
    const result = migration.restoreMigration(receipt)
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'EEXIST')
    assert.equal(readFileSync(collision, 'utf8'), 'other attempt owns this')
    assert.equal(JSON.parse(readFileSync(configPath)).version, 3)
  } finally { Date.now = now; rmSync(root, { recursive: true, force: true }) }
})

test('durable transaction intent must succeed before config replacement', async () => {
  const root = scratch()
  try {
    const { configPath } = fleetConfigFixture(root)
    const before = readFileSync(configPath)
    const result = await runMigration(migrationArgs(root, { execute: true }), {
      beforeReplace(receipt) {
        assert.equal(readFileSync(receipt.backupPath).equals(before), true)
        throw Object.assign(new Error('transaction intent persistence failed'), { code: 'INTENT_FAILED' })
      },
    })
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'INTENT_FAILED')
    assert.equal(result.configReplaced, false)
    assert.equal(readFileSync(configPath).equals(before), true)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('migration candidate collision preserves the foreign file and original config', async () => {
  const root = scratch()
  const now = Date.now
  try {
    const { configPath } = fleetConfigFixture(root)
    const before = readFileSync(configPath)
    Date.now = () => 12345678
    const collision = join(root, `.agent-model-overrides.json.v3-candidate-${process.pid}-${Date.now()}`)
    writeFileSync(collision, 'foreign candidate')
    const result = await runMigration(migrationArgs(root, { execute: true }))
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'EEXIST')
    assert.equal(readFileSync(collision, 'utf8'), 'foreign candidate')
    assert.equal(readFileSync(configPath).equals(before), true)
  } finally { Date.now = now; rmSync(root, { recursive: true, force: true }) }
})


test('disabled extra definitions preserve the existing active-registry/config bijection', async () => {
  const root = scratch()
  try {
    const { configPath, registryPath } = fleetConfigFixture(root)
    const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
    registry.agents.push(...registryOnlyIds.map((id) => ({ id, name: id, description: null, disabled: true })))
    writeFileSync(registryPath, JSON.stringify(registry))
    const registryBefore = readFileSync(registryPath, 'utf8')
    const result = await runMigration(migrationArgs(root, { execute: true }))
    assert.equal(result.ok, true, result.error)
    assert.equal(JSON.parse(readFileSync(configPath, 'utf8')).version, 3)
    assert.equal(readFileSync(registryPath, 'utf8'), registryBefore, 'migration never disables or deletes definitions')
    assert.equal(Object.keys(JSON.parse(readFileSync(configPath, 'utf8')).overrides).length, FLEET)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
