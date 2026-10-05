// MODEL_OVERRIDES_CONFIG_GATE_V1 (G2.7) — hermetic unit + fixture tests.
//
// RED/GREEN contract (agent-control#195 Defect C, Product #414, 2026-10-02):
//  - RED:  the EXACT #195 production FATAL — a v2 fleet config under the v3
//          loader (pin b78aa30a model-overrides.js) fails closed with
//          `must be {"version":3,"routeCatalog":{...},"overrides":{...}}
//          (older files are not converted)` / AGENT_MODEL_OVERRIDE_INVALID,
//          gate exit 2. This is the class that crash-looped the restarted
//          generation for ~7 minutes because no pre-cutover gate composed
//          the runtime against the REAL production config.
//  - GREEN: the migrated v3 config (FLEET_CONFIG_V2V3_MIGRATION_V1 output,
//          92-override roster preserved) loads clean under the SAME loader —
//          gate exit 0 with filePresent=true and the override count.
//  - Legacy passthrough: config file ABSENT is a PASS (the loader's own
//    documented missing-file semantics), reported honestly as filePresent=false.
//  - Fail-closed generality: any other loader rejection (e.g. an override
//    referencing an unknown route) is a gate failure too — G2.7 stops the
//    cutover, never the restart.
//
// Fixtures are hermetic /tmp files shaped like the RECORDED production
// preimage (routeCatalog.luna = subscription/openai-codex/gpt-5.6-luna/
// dsh-codex@0.2.3 without credentialFile; 92 per-agent luna-primary
// overrides; agents.json roster). The loader under test is the SOURCE tree's
// model-overrides.js — byte-identical semantics to the installed tree the
// executor points the gate at (same pin).

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runGate, parseArgs } from './trusted-cp-model-overrides-config-gate.mjs'
import { runMigration } from './trusted-cp-fleet-config-v2v3-migration.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GATE = join(HERE, 'trusted-cp-model-overrides-config-gate.mjs')
const LOADER_MODULE = join(HERE, '../../packages/production-runtime/src/model-overrides.js')

const FLEET = 92
// The EXACT #195 FATAL line (model-overrides.js:411 at the pin, as recorded
// in PRODUCTION_EXECUTION_LOG-20261002.md).
const FATAL_195_LINE = 'must be {"version":3,"routeCatalog":{...},"overrides":{...}} (older files are not converted)'

function scratch() {
  return mkdtempSync(join(tmpdir(), 'dsh-config-gate-test-'))
}

/** Production-shaped registry fixture (agents.json, CONFIG_VERSION=1). */
function registryFixture(root, count = FLEET) {
  const agents = Array.from({ length: count }, (_, i) => ({
    id: `agt_fix${String(i).padStart(2, '0')}-agent`,
    name: `fixture-${i}`,
    description: null,
  }))
  const registry = { version: 1, defaultAgentId: agents[0].id, agents }
  const registryPath = join(root, 'agents.json')
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`)
  return { registryPath, agentIds: agents.map((a) => a.id) }
}

/** Production-shaped fleet config fixture. version=2 reproduces the deployed
 *  preimage; the migrator turns it into the v3 GREEN counterpart. */
function fleetConfigFixture(root, { version = 2 } = {}) {
  const { registryPath, agentIds } = registryFixture(root)
  const overrides = Object.fromEntries(agentIds.map((id) => [id, { model: { primary: 'luna', fallbacks: [] } }]))
  const config = {
    version,
    routeCatalog: {
      luna: {
        routeKind: 'subscription',
        provider: 'openai-codex',
        model: 'gpt-5.6-luna',
        plugin: 'dsh-codex',
        pluginVersion: '0.2.3',
        credentialReadiness: 'bridge-store-bound',
      },
    },
    overrides,
  }
  const configPath = join(root, 'agent-model-overrides.json')
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
  return { configPath, registryPath, agentIds }
}

function gateArgs(root, extra = {}) {
  return {
    config: join(root, 'agent-model-overrides.json'),
    registry: join(root, 'agents.json'),
    deploymentRoot: root,
    modelOverridesModule: LOADER_MODULE,
    definitionModule: join(HERE, '../../packages/agent-definition/src/definition.js'),
    ...extra,
  }
}

describe('MODEL_OVERRIDES_CONFIG_GATE_V1 hermetic fixtures', () => {
  test('RED: v2 config vs v3 loader = the exact #195 FATAL line, exit 2', async () => {
    const root = scratch()
    try {
      const { configPath } = fleetConfigFixture(root, { version: 2 })
      const result = await runGate(gateArgs(root))
      assert.equal(result.ok, false)
      assert.equal(result.errorCode, 'AGENT_MODEL_OVERRIDE_INVALID')
      assert.ok(result.error.includes(configPath), 'error names the real config path')
      assert.ok(result.error.includes(FATAL_195_LINE), `error carries the exact #195 line, got: ${result.error}`)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('GREEN: migrated v3 config (92-override roster preserved) loads clean', async () => {
    const root = scratch()
    try {
      fleetConfigFixture(root, { version: 2 })
      const migrated = await runMigration({
        config: join(root, 'agent-model-overrides.json'),
        registry: join(root, 'agents.json'),
        deploymentRoot: root,
        modelOverridesModule: LOADER_MODULE,
        execute: true,
      })
      assert.equal(migrated.ok, true, `migration refused: ${migrated.error}`)
      const result = await runGate(gateArgs(root))
      assert.equal(result.ok, true, `gate failed on migrated config: ${result.error}`)
      assert.equal(result.filePresent, true)
      assert.equal(result.overrideCount, FLEET)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('config file absent = PASS with filePresent=false (loader legacy-passthrough semantics)', async () => {
    const root = scratch()
    try {
      registryFixture(root)
      const result = await runGate(gateArgs(root))
      assert.equal(result.ok, true)
      assert.equal(result.filePresent, false)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('fail-closed generality: non-version loader rejection also stops the gate', async () => {
    const root = scratch()
    try {
      const { configPath } = fleetConfigFixture(root, { version: 2 })
      const migrated = await runMigration({
        config: configPath,
        registry: join(root, 'agents.json'),
        deploymentRoot: root,
        modelOverridesModule: LOADER_MODULE,
        execute: true,
      })
      assert.equal(migrated.ok, true, `migration refused: ${migrated.error}`)
      const broken = JSON.parse(readFileSync(configPath, 'utf8'))
      broken.overrides[Object.keys(broken.overrides)[0]].model.primary = 'no-such-route'
      writeFileSync(configPath, JSON.stringify(broken, null, 2))
      const result = await runGate(gateArgs(root))
      assert.equal(result.ok, false)
      assert.equal(result.errorCode, 'AGENT_MODEL_OVERRIDE_INVALID')
      assert.ok(result.error.includes('unknown routeCatalog entry'))
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('CLI contract: --json + exit 2 on the RED fixture (executor invocation shape)', async () => {
    const root = scratch()
    try {
      fleetConfigFixture(root, { version: 2 })
      const cli = spawnSync(process.execPath, [
        GATE,
        '--installed-root', join(HERE, '../..'),
        '--config', join(root, 'agent-model-overrides.json'),
        '--registry', join(root, 'agents.json'),
        '--deployment-root', root,
        '--json',
      ], { encoding: 'utf8' })
      assert.equal(cli.status, 2, `cli stderr: ${cli.stderr}`)
      const verdict = JSON.parse(cli.stdout)
      assert.equal(verdict.gate, 'MODEL_OVERRIDES_CONFIG_GATE_V1')
      assert.equal(verdict.ok, false)
      assert.equal(verdict.errorCode, 'AGENT_MODEL_OVERRIDE_INVALID')
      assert.ok(verdict.error.includes(FATAL_195_LINE))
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('parseArgs derives the definition module from the loader module (same-tree layout)', () => {
    const args = parseArgs([
      '--installed-root', '/usr/local/libexec/agent-core/app',
      '--config', '/x/agent-model-overrides.json',
      '--registry', '/x/agents.json',
      '--deployment-root', '/x',
    ])
    assert.equal(args.modelOverridesModule, '/usr/local/libexec/agent-core/app/packages/production-runtime/src/model-overrides.js')
    assert.equal(args.definitionModule, '/usr/local/libexec/agent-core/app/packages/agent-definition/src/definition.js')
    assert.ok(existsSync(LOADER_MODULE))
  })
})
