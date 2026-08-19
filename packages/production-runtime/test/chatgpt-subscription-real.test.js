import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { test } from 'node:test'

import { REPO } from '../../agent-provisioning/src/index.js'
import { writeAgentDefinition } from '../../agent-definition/src/config.js'
import { composeProductionRuntime } from '../src/compose.js'
import { CHATGPT_SUBSCRIPTION_V1 } from '../src/model-overrides.js'
import { resolveProductionLayout } from '../src/paths.js'

const TARGET = CHATGPT_SUBSCRIPTION_V1.targetAgentId
const OTHER = 'agt_real_seam_other'
const GLOBAL = Object.freeze({ provider: 'oc-go', model: 'deepseek-v4-flash' })
const OVERRIDE = {
  version: 1,
  overrides: {
    [TARGET]: {
      provider: 'openai-codex',
      model: 'gpt-5.6-luna',
      plugin: 'dsh-codex',
      pluginVersion: '0.2.3',
    },
  },
}

const SETTINGS = [
  'llm-pi-ai:',
  '  providers:',
  '    oc-go:',
  '      displayName: oc-go',
  '      apiKeyEnv: OC_GO_API_KEY',
  '      api: openai-completions',
  '      baseURL: http://127.0.0.1:9/no-network-test',
  '      models:',
  '        - id: deepseek-v4-flash',
  '',
].join('\n')

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function restoreEnv(snapshot) {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
}

async function compose(layout) {
  return composeProductionRuntime({
    layout,
    globalRoute: GLOBAL,
    productApi: { enabled: false },
    notificationIngress: { enabled: false },
    log: { log() {}, warn() {}, error() {} },
  })
}

async function credentialBoundary(proc, expectedMode) {
  const failure = await proc.turn('main', `real ${expectedMode} credential boundary`, {}, 30_000).then(
    () => { throw new Error('Luna turn unexpectedly succeeded without OAuth state') },
    (error) => error,
  )
  assert.equal(failure.class, 'credential_missing')
  assert.equal(failure.layer, 'agent/credential')
  assert.equal(failure.provider, 'openai-codex')
  assert.equal(failure.model, 'gpt-5.6-luna')
  assert.equal(proc.creations.at(-1)?.mode, expectedMode)
  const request = proc.events.filter((entry) => entry.event.type === 'request/context').at(-1)
  assert.deepEqual(
    request === undefined
      ? proc.initializeEvidence?.route
      : { provider: request.event.data?.provider, model: request.event.data?.model },
    { provider: 'openai-codex', model: 'gpt-5.6-luna' },
  )
  return failure
}

test('real production seam: local exact package, create/resume restart, and rollback', { timeout: 240_000 }, async (t) => {
  const artifact = process.env.DSH_CODEX_PACKAGE_TARBALL
  if (artifact === undefined || artifact === '') {
    t.skip('DSH_CODEX_PACKAGE_TARBALL is required for deterministic real-package acceptance')
    return
  }
  assert.equal(isAbsolute(artifact), true, 'DSH_CODEX_PACKAGE_TARBALL must be absolute')
  assert.equal(existsSync(artifact), true, `local package artifact missing: ${artifact}`)
  const packed = readFileSync(artifact)
  assert.equal(sha256(packed), '8c3d4e3418c8e267a7b61dc4ad4cd982eaf1c1ec93a4e580961e0292579c23dc')

  const root = mkdtempSync(join(tmpdir(), 'chatgpt-production-real-'))
  const isolatedUserHome = join(root, 'operator-home')
  const settingsSource = join(root, 'settings.yaml')
  const layout = resolveProductionLayout(join(root, 'runtime'))
  mkdirSync(isolatedUserHome, { recursive: true, mode: 0o700 })
  mkdirSync(join(layout.root, 'scheduler'), { recursive: true })
  writeFileSync(settingsSource, SETTINGS, 'utf8')
  await writeAgentDefinition(layout.agentsConfig, {
    defaultAgentId: TARGET,
    agents: [{ id: TARGET, name: 'CTO' }, { id: OTHER, name: 'Other' }],
  })
  writeFileSync(layout.agentModelOverrides, JSON.stringify(OVERRIDE), 'utf8')
  // Activation prerequisite: workspace-bootstrap may create homes with the
  // deployment default 0755; the subscription credential directory must be
  // operator-prepared as 0700 (production provisioning never chmods an
  // existing home implicitly).
  mkdirSync(join(layout.homesRoot, TARGET), { recursive: true, mode: 0o700 })

  const envNames = [
    'HOME', 'DSH_SETTINGS_SOURCE', 'DSH_CODEX_PACKAGE_TARBALL', 'OPENAI_API_KEY',
    'OC_GO_API_KEY', 'OPENCODE_GO_API_KEY', 'DSH_MEMORY_WORKSPACE_ROOT',
  ]
  const envBefore = Object.fromEntries(envNames.map((name) => [name, process.env[name]]))
  process.env.HOME = isolatedUserHome
  process.env.DSH_SETTINGS_SOURCE = settingsSource
  process.env.DSH_CODEX_PACKAGE_TARBALL = artifact
  delete process.env.OPENAI_API_KEY
  delete process.env.OC_GO_API_KEY
  delete process.env.OPENCODE_GO_API_KEY
  delete process.env.DSH_MEMORY_WORKSPACE_ROOT

  const sharedProfile = join(REPO, 'profile-production', 'package.json')
  const sharedBefore = readFileSync(sharedProfile)
  const runtimes = []
  const processes = []
  t.after(async () => {
    for (const proc of processes.reverse()) await proc.shutdown(5_000).catch(() => {})
    for (const runtime of runtimes.reverse()) await runtime.stop().catch(() => {})
    restoreEnv(envBefore)
    rmSync(root, { recursive: true, force: true })
  })

  // First real production composition: exact package + provider registration
  // + session create reaching only the missing-credential boundary.
  const first = await compose(layout)
  runtimes.push(first)
  const firstTarget = await first.router.ensureRunning(TARGET)
  processes.push(firstTarget)
  assert.deepEqual(firstTarget.initializeEvidence?.route, { provider: 'openai-codex', model: 'gpt-5.6-luna' })
  assert.equal(firstTarget.initializeEvidence?.pluginServices?.openAICodex, true)
  assert.ok(firstTarget.initializeEvidence?.registeredProviders?.includes('openai-codex'))
  await credentialBoundary(firstTarget, 'created')

  const targetHome = join(layout.homesRoot, TARGET)
  const otherHome = join(layout.homesRoot, OTHER)
  const installed = JSON.parse(readFileSync(join(targetHome, 'profiles', 'node_modules', 'dsh-codex', 'package.json'), 'utf8'))
  assert.equal(installed.version, '0.2.3')
  assert.equal(statSync(targetHome).mode & 0o777, 0o700)
  assert.equal(existsSync(join(targetHome, '.openai-codex-auth.json')), false)
  await firstTarget.shutdown(5_000)
  await first.stop()

  // Full runtime restart: the same persistent home reloads the plugin and
  // resumes the same session with the same immutable route.
  const second = await compose(layout)
  runtimes.push(second)
  const secondTarget = await second.router.ensureRunning(TARGET)
  processes.push(secondTarget)
  assert.equal(secondTarget.initializeEvidence?.pluginServices?.openAICodex, true)
  assert.ok(secondTarget.initializeEvidence?.registeredProviders?.includes('openai-codex'))
  await credentialBoundary(secondTarget, 'resumed')
  const secondOther = await second.router.ensureRunning(OTHER)
  processes.push(secondOther)
  assert.deepEqual(secondOther.initializeEvidence?.route, GLOBAL)
  assert.ok(secondOther.initializeEvidence?.registeredProviders?.includes('oc-go'))
  assert.equal(existsSync(join(otherHome, 'profiles', 'node_modules', 'dsh-codex')), false)

  // Mechanical target-only rollback in the SAME production runtime: the
  // non-target process remains alive while only the target is replaced.
  const runtimeIdentity = second
  const targetPidBefore = secondTarget.pid
  const otherPidBefore = secondOther.pid
  unlinkSync(layout.agentModelOverrides)
  await secondTarget.shutdown(5_000)
  const rolledTarget = await second.router.ensureRunning(TARGET)
  processes.push(rolledTarget)
  const rolledOther = await second.router.ensureRunning(OTHER)
  assert.equal(second, runtimeIdentity)
  assert.notEqual(rolledTarget.pid, targetPidBefore)
  assert.equal(rolledOther.pid, otherPidBefore)
  assert.deepEqual(rolledTarget.initializeEvidence?.route, GLOBAL)
  assert.deepEqual(rolledOther.initializeEvidence?.route, GLOBAL)
  assert.ok(rolledTarget.initializeEvidence?.registeredProviders?.includes('oc-go'))
  assert.ok(rolledOther.initializeEvidence?.registeredProviders?.includes('oc-go'))

  // Both native session paths after rollback carry the new process route:
  // persisted main resumes; a new session is created. The test provider is
  // deliberately unreachable, so both turns fail rather than call a model.
  for (const [sessionId, mode] of [['main', 'resumed'], ['rollback-fresh', 'created']]) {
    await assert.rejects(rolledTarget.turn(sessionId, `rollback ${mode}`, {}, 30_000))
    assert.equal(rolledTarget.creations.at(-1)?.mode, mode)
    assert.deepEqual(rolledTarget.initializeEvidence?.route, GLOBAL)
  }

  // A malformed deployment file blocks only a later target respawn. The
  // already-running non-target process remains the exact same process/route.
  writeFileSync(layout.agentModelOverrides, '{malformed', 'utf8')
  await rolledTarget.shutdown(5_000)
  await assert.rejects(
    second.router.ensureRunning(TARGET),
    (error) => error.code === 'AGENT_MODEL_OVERRIDE_INVALID',
  )
  assert.equal((await second.router.ensureRunning(OTHER)).pid, otherPidBefore)
  assert.deepEqual(rolledOther.initializeEvidence?.route, GLOBAL)
  assert.deepEqual(readFileSync(sharedProfile), sharedBefore)
})
