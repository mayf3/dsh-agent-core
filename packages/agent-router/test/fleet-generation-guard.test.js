import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AgentProcess } from '../src/process/agent-process.js'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('D14 unqualified generation is rejected before child construction or dispatch', t => {
  const harness = mkdtempSync(join(tmpdir(), 'd14-guard-harness-'))
  const previous = process.env.DSH_HARNESS_ROOT
  t.after(() => { if (previous === undefined) delete process.env.DSH_HARNESS_ROOT; else process.env.DSH_HARNESS_ROOT = previous; rmSync(harness, { recursive: true, force: true }) })
  writeFileSync(join(harness, 'package.json'), JSON.stringify({ version: 'synthetic-fixture' }))
  writeFileSync(join(harness, '.source-stamp'), JSON.stringify({ commit: '1'.repeat(40), dirtyCount: 0 }))
  process.env.DSH_HARNESS_ROOT = harness
  assert.throws(() => new AgentProcess({
    agentId: 'fixture', home: '/private/tmp/fixture-home', workspace: '/private/tmp/fixture-ws',
    profile: 'agent-core-production', fleetGeneration: { deploymentRoot: '/private/tmp/unknown-fleet' },
  }), { code: 'FLEET_GENERATION_INVALID' })
})

import { readFleetGeneration } from '../../agent-provisioning/src/fleet-generation.js'
import { createFleetGenerationFixture, FIXTURE_HARNESS, RELEASE_FIXTURE_AVAILABLE } from '../../agent-provisioning/test/fleet-generation-fixture.js'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

test('D14 child imports stay on immutable payload and switched current rejects queued dispatch', { skip: !RELEASE_FIXTURE_AVAILABLE }, async t => {
  const fx = createFleetGenerationFixture()
  t.after(fx.cleanup)
  const harness = join(fx.deploymentRoot, 'synthetic-harness')
  mkdirSync(harness)
  writeFileSync(join(harness, 'package.json'), JSON.stringify({ version: FIXTURE_HARNESS.version }))
  writeFileSync(join(harness, '.source-stamp'), JSON.stringify({ commit: FIXTURE_HARNESS.commit, dirtyCount: 0 }))
  const previous = process.env.DSH_HARNESS_ROOT
  process.env.DSH_HARNESS_ROOT = harness
  t.after(() => { if (previous === undefined) delete process.env.DSH_HARNESS_ROOT; else process.env.DSH_HARNESS_ROOT = previous })
  const snapshot = readFleetGeneration(fx.deploymentRoot)
  const proc = new AgentProcess({ agentId: 'synthetic-agent', home: fx.home, workspace: fx.deploymentRoot,
    profile: 'agent-core-production', fleetGeneration: snapshot })
  const unknown = join(fx.control, 'unknown/node_modules')
  mkdirSync(unknown, { recursive: true })
  const hook = fileURLToPath(new URL('../../agent-provisioning/src/fleet-import-hook.js', import.meta.url))
  const result = spawnSync(process.execPath, ['--import', hook, '--input-type=module', '-e', `
    import {unlinkSync,symlinkSync} from 'node:fs';
    const before = import.meta.resolve('dsh-codex');
    unlinkSync(process.env.FIXTURE_CURRENT);
    symlinkSync(process.env.FIXTURE_UNKNOWN, process.env.FIXTURE_CURRENT);
    const plugin = await import('dsh-codex');
    console.log(JSON.stringify({before,after:import.meta.resolve('dsh-codex'),actualApply:typeof plugin.apply}));
  `], { encoding: 'utf8', env: { ...process.env, DSH_HOME: fx.home, DSH_CODEX_FLEET_SNAPSHOT: JSON.stringify(snapshot),
    FIXTURE_CURRENT: join(fx.control, 'current'), FIXTURE_UNKNOWN: unknown } })
  assert.equal(result.status, 0, result.stderr)
  const observation = JSON.parse(result.stdout)
  assert.equal(observation.before, pathToFileURL(join(fx.pluginRoot, 'lib/index.js')).href)
  assert.equal(observation.after, observation.before)
  assert.equal(observation.actualApply, 'function')
  let writes = 0
  proc.request = async () => { writes += 1 }
  await assert.rejects(() => proc.promptWrite({}, 'main', 'fixture', {}), { code: 'FLEET_GENERATION_INVALID' })
  assert.equal(writes, 0)
  assert.throws(() => proc.assertFleetGeneration(), { code: 'FLEET_GENERATION_INVALID' })
})
