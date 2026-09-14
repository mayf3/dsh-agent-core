/**
 * DEFAULT_MODEL_ROUTING_CONFIG_V1 prerequisite — REAL-CHAIN credential
 * resolution after the parent-side boundary probe removal (A–G characterization
 * of the child-time model):
 *
 *   parent provisioning = PATH_ONLY (writes the credentialFile reference into
 *   the child profile patch; never stats/reads the canonical secret)
 *   → child (uid502 execution identity) dsh-codex store reader enforces the
 *   security invariants (assertOwnerOnly mode 0600 + strict document
 *   validation) and resolves/reads the canonical store itself.
 *
 * E valid credential initializes · F missing credential fails loud ·
 * G unsafe credential (group/world readable) fails loud. Every branch must
 * stay on the openai-codex route — a silent OpenCode Go fallback is a
 * spec violation (H).
 *
 * Skipped (not failed) when the real pinned dsh-codex install, the canonical
 * store, or uid502 readability is unavailable on this host.
 */
import assert from 'node:assert/strict'
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AgentProcess } from '../src/process/agent-process.js'
import { CHATGPT_SUBSCRIPTION_V1 } from '../../production-runtime/src/model-overrides.js'
import { CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE, provisionAgentHome } from '../../agent-provisioning/src/index.js'

const REAL_PLUGIN = '/Users/authsvc/.agent-core/homes/agt_hr-agent/profiles/node_modules/dsh-codex'
const PROFILE = 'agent-core-production'
const PINNED_HARNESS = '/usr/local/libexec/agent-core/harness'
const ABSENT_STORE = () => join(mkdtempSync(join(tmpdir(), 'luna-absent-')), 'missing', '.openai-codex-auth.json')

function gates(t) {
  if (!existsSync(REAL_PLUGIN)) { t.skip('real pinned dsh-codex install not available on this host'); return false }
  if (!existsSync(CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE)) { t.skip('canonical credential store not present on this host'); return false }
  if (!existsSync(join(PINNED_HARNESS, 'apps', 'cli', 'lib', 'bin.js'))) { t.skip('pinned production harness not present (peer closing needs it)'); return false }
  try {
    readFileSync(CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE)
  } catch {
    t.skip('canonical credential store not readable by this (child-identity) uid')
    return false
  }
  const version = JSON.parse(readFileSync(join(REAL_PLUGIN, 'package.json'), 'utf8')).version
  if (version !== CHATGPT_SUBSCRIPTION_V1.pluginVersion) {
    t.skip(`real plugin is ${version}, not the pinned ${CHATGPT_SUBSCRIPTION_V1.pluginVersion}`)
    return false
  }
  return true
}

/** Install the REAL production-verified dsh-codex artifact into a test home. */
function realInstaller(input) {
  const target = join(input.profilesRoot, 'node_modules', input.plugin)
  rmSync(target, { recursive: true, force: true })
  cpSync(REAL_PLUGIN, target, { recursive: true })
}

function provision(t) {
  const root = mkdtempSync(join(tmpdir(), 'luna-cred-chain-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const home = join(root, 'home')
  const workspace = join(root, 'ws')
  provisionAgentHome(home, workspace, {
    profile: PROFILE,
    subscription: {
      plugin: CHATGPT_SUBSCRIPTION_V1.plugin,
      pluginVersion: CHATGPT_SUBSCRIPTION_V1.pluginVersion,
      sourceCommit: CHATGPT_SUBSCRIPTION_V1.sourceCommit,
      artifactSha256: CHATGPT_SUBSCRIPTION_V1.artifactSha256,
      dshVersion: CHATGPT_SUBSCRIPTION_V1.dshVersion,
      dshCommit: CHATGPT_SUBSCRIPTION_V1.dshCommit,
      credentialFile: CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE,
    },
    // The real plugin install came from a home provisioned under exactly the
    // pinned rc.8 identity — assert against that identity, not the moving
    // dev-harness checkout this test process resolves by default.
    harnessIdentity: {
      version: CHATGPT_SUBSCRIPTION_V1.dshVersion,
      commit: CHATGPT_SUBSCRIPTION_V1.dshCommit,
    },
    pluginInstaller: realInstaller,
    // Close external peer deps against the pinned rc.8 harness (the moving
    // dev checkout cannot satisfy dsh-codex's dsh-* peers).
    harnessRoot: PINNED_HARNESS,
    artifactIdentity: {
      version: 1,
      sourceCommit: CHATGPT_SUBSCRIPTION_V1.sourceCommit,
      artifactSha256: CHATGPT_SUBSCRIPTION_V1.artifactSha256,
    },
  })
  return { root, home, workspace }
}

function patchFile(home) {
  return join(home, 'profiles', PROFILE, 'cordis.patch.yml')
}

/** Point the child credential reference somewhere else (test-crafted patch). */
function repointCredential(home, credentialFile) {
  const file = patchFile(home)
  const next = readFileSync(file, 'utf8').replace(
    `credentialFile: ${JSON.stringify(CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE)}`,
    `credentialFile: ${JSON.stringify(credentialFile)}`,
  )
  assert.notEqual(next, readFileSync(file, 'utf8'), 'repoint must change the patch')
  writeFileSync(file, next, 'utf8')
}

function boot(t, home, workspace) {
  const proc = new AgentProcess({
    agentId: 'agt_luna-cred-chain',
    home,
    workspace,
    profile: PROFILE,
    provider: 'openai-codex',
    model: 'gpt-5.6-luna',
    log: { log() {}, error() {} },
  })
  t.after(() => { proc.kill9().catch(() => {}) })
  proc.spawn()
  return proc
}

/** The child must fail loud on the openai-codex route — never silently succeed. */
async function assertFailsLoud(t, proc, expectedText) {
  let failure
  try {
    await proc.ready(120_000)
    try {
      await proc.turn('main', 'health probe', {}, 45_000)
      assert.fail('silent turn success — credential failure was not loud')
    } catch (error) {
      failure = error
    }
  } catch (error) {
    failure = error
  }
  assert.ok(failure, 'expected a loud failure')
  assert.equal(proc.provider, 'openai-codex', 'route must stay on the explicit Luna provider (H: no oc-go fallback)')
  const haystack = `${failure.message ?? ''}\n${failure.code ?? ''}\n${proc.stderr}`
  if (expectedText !== undefined) {
    assert.ok(haystack.includes(expectedText), `failure must surface ${JSON.stringify(expectedText)}; got:\n${haystack.slice(-800)}`)
  }
  return failure
}

test('E: valid canonical credential — child initializes on the openai-codex route', { timeout: 240_000 }, async (t) => {
  if (!gates(t)) return
  const { home, workspace } = provision(t)
  const proc = boot(t, home, workspace)
  await proc.ready(120_000)
  assert.ok(
    Array.isArray(proc.initializeEvidence?.registeredProviders)
    && proc.initializeEvidence.registeredProviders.includes('openai-codex'),
    `openai-codex registered after real boot (got ${JSON.stringify(proc.initializeEvidence?.registeredProviders)})`,
  )
})

test('F: missing credential fails loud on the real chain — never a silent fallback', { timeout: 240_000 }, async (t) => {
  if (!gates(t)) return
  const { home, workspace } = provision(t)
  const absent = ABSENT_STORE()
  repointCredential(home, absent)
  assert.equal(existsSync(absent), false, 'fixture store must be absent')
  const proc = boot(t, home, workspace)
  const failure = await assertFailsLoud(t, proc)
  assert.ok(
    !/reply|completed/i.test(String(failure.message ?? '')),
    'failure must not carry a successful reply shape',
  )
})

test('G: unsafe credential (group/world readable) fails loud on the real chain', { timeout: 240_000 }, async (t) => {
  if (!gates(t)) return
  const { home, workspace } = provision(t)
  const unsafeDir = join(mkdtempSync(join(tmpdir(), 'luna-unsafe-')), 'store')
  mkdirSync(unsafeDir, { recursive: true })
  const unsafe = join(unsafeDir, '.openai-codex-auth.json')
  // Synthetic document (never a copy of the real secret): valid shape,
  // deliberately wrong permission bits — the child reader must reject it.
  writeFileSync(unsafe, `${JSON.stringify({
    version: 1,
    credential: {
      type: 'oauth',
      access: 'synthetic-access-token',
      refresh: 'synthetic-refresh-token',
      expires: 4_102_444_800_000,
      accountId: 'acc_synthetic',
    },
  }, null, 2)}\n`, { mode: 0o644 })
  chmodSync(unsafe, 0o644)
  repointCredential(home, unsafe)
  const proc = boot(t, home, workspace)
  // The harness classifies the owner-only rejection as credential_missing
  // ("Provider is not configured: openai-codex") — the unsafe document is
  // refused and its rejection detail is redacted; the route still fails loud
  // and never falls back to OpenCode Go.
  await assertFailsLoud(t, proc, 'credential_missing')
})
