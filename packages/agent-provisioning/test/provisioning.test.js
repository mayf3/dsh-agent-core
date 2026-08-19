/**
 * Unit tests for @agent-core/agent-provisioning — the per-agent home
 * provisioning extracted from the demo path (PRODUCTION_RUNTIME_V1 Task 1):
 *
 *   - the PRODUCTION profile is a first-class table entry (demo/integration
 *     entries remain for the demo path);
 *   - the profile is REQUIRED (no silent demo default in the production
 *     package — the demo default lives only in the scripts/demo-home.mjs
 *     shim);
 *   - provisioning is idempotent and installs the profile files + farm links
 *     + settings/credentials copies the dsh CLI needs to boot self-sufficiently.
 */

import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  AGENT_PROFILE_DEFS,
  REPO,
  cliBin,
  provisionAgentHome,
  provisionExactProfilePlugin,
  readHarnessIdentity,
  resolveHarnessRoot,
} from '../src/index.js'

const SUBSCRIPTION = {
  plugin: 'dsh-codex',
  pluginVersion: '0.2.3',
  dshVersion: '0.1.0-rc.5',
  dshCommit: 'a12bb03c6861969985f066bfbf0cb7e5dd5ac567',
  credentialFile: '.openai-codex-auth.json',
}
const HARNESS_IDENTITY = { version: SUBSCRIPTION.dshVersion, commit: SUBSCRIPTION.dshCommit }

function fakeInstall({ profilesRoot, plugin, version }) {
  const dir = join(profilesRoot, 'node_modules', plugin)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: plugin, version }), 'utf8')
}

test('profile table carries the production entry beside the legacy demo ones', () => {
  assert.deepEqual(
    Object.keys(AGENT_PROFILE_DEFS).sort(),
    ['agent-core-demo', 'agent-core-integration-agent', 'agent-core-production'].sort(),
  )
  const production = AGENT_PROFILE_DEFS['agent-core-production']
  assert.equal(production.repoDir, 'profile-production')
  // The production agent stack: protocol server + guard + memory + switch +
  // broker relay (same capability set the integration agent proved).
  for (const pkg of ['demo-server', 'owner-guard', 'agent-memory', 'agent-switch', 'broker', 'workspace-bootstrap']) {
    assert.ok(production.farmLinks[pkg], `farm link ${pkg}`)
  }
})

test('profile is required — no silent demo default in the production package', () => {
  assert.throws(() => provisionAgentHome('/tmp/x-home', '/tmp/x-ws'), /options\.profile is required/)
  assert.throws(() => provisionAgentHome('/tmp/x-home', '/tmp/x-ws', { profile: 'no-such-profile' }), /unknown agent profile/)
})

test('provisionAgentHome installs profile copies + farm links idempotently', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'agent-provisioning-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const home = join(dir, 'home')
  const workspace = join(dir, 'ws')

  provisionAgentHome(home, workspace, { profile: 'agent-core-production' })
  // Profile files are COPIES from the repo's profile-production dir.
  const pkg = JSON.parse(readFileSync(join(home, 'profiles', 'agent-core-production', 'package.json'), 'utf8'))
  assert.equal(pkg.name, 'dsh-profile-agent-core-production')
  assert.ok(existsSync(join(home, 'profiles', 'agent-core-production', 'cordis.patch.yml')))
  // Farm links resolve into THIS repo (worktree-safe: REPO is the checkout
  // the module was loaded from).
  assert.ok(existsSync(join(home, 'profiles', 'node_modules', '@agent-core', 'demo-server')))
  assert.ok(existsSync(join(home, 'settings.yaml')))
  assert.ok(existsSync(workspace))

  // Idempotent: second run is a no-op that keeps the same files.
  provisionAgentHome(home, workspace, { profile: 'agent-core-production' })
  assert.equal(
    JSON.parse(readFileSync(join(home, 'profiles', 'agent-core-production', 'package.json'), 'utf8')).name,
    'dsh-profile-agent-core-production',
  )
})

test('harness resolution is worktree-aware and cliBin fails loud without a checkout', () => {
  // In this checkout the harness sibling exists; REPO is either the main
  // checkout or the worktree root, and resolveHarnessRoot must find the CLI.
  assert.ok(REPO.endsWith('dsh-agent-core') || REPO.includes('.worktree'), `repo root sanity: ${REPO}`)
  assert.ok(resolveHarnessRoot().length > 0)
  assert.ok(existsSync(cliBin()), 'cliBin resolves to the real dsh CLI entry')
  assert.deepEqual(readHarnessIdentity(), HARNESS_IDENTITY, 'resolved DSH stays at the frozen version + commit')
})

test('target-home plugin provisioning is exact, idempotent and leaves the shared profile byte-unchanged', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'agent-subscription-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const home = join(dir, 'home')
  const workspace = join(dir, 'ws')
  mkdirSync(home, { recursive: true, mode: 0o700 })
  chmodSync(home, 0o700)
  writeFileSync(join(home, SUBSCRIPTION.credentialFile), '{"fixture":"not-a-token"}\n', { mode: 0o600 })
  const sharedBefore = readFileSync(join(REPO, 'profile-production', 'package.json'))
  let installs = 0
  const installer = (input) => { installs += 1; fakeInstall(input) }

  const options = {
    profile: 'agent-core-production',
    subscription: SUBSCRIPTION,
    harnessIdentity: HARNESS_IDENTITY,
    pluginInstaller: installer,
  }
  provisionAgentHome(home, workspace, options)
  provisionAgentHome(home, workspace, options)

  assert.equal(installs, 1, 'exact installed plugin is reused on rerun')
  const installed = JSON.parse(readFileSync(join(home, 'profiles', 'node_modules', 'dsh-codex', 'package.json'), 'utf8'))
  assert.equal(installed.version, '0.2.3')
  const profile = JSON.parse(readFileSync(join(home, 'profiles', 'agent-core-production', 'package.json'), 'utf8'))
  assert.equal(profile.dsh.profile.bundles.filter((bundle) => bundle === 'dsh-codex').length, 1)
  assert.deepEqual(readFileSync(join(REPO, 'profile-production', 'package.json')), sharedBefore)
})

test('plugin missing, plugin mismatch, DSH mismatch and credential boundaries fail loud', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'agent-subscription-fail-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const home = join(dir, 'home')
  const workspace = join(dir, 'ws')
  provisionAgentHome(home, workspace, { profile: 'agent-core-production' })

  const requirement = {
    plugin: SUBSCRIPTION.plugin,
    version: SUBSCRIPTION.pluginVersion,
    dshVersion: SUBSCRIPTION.dshVersion,
    dshCommit: SUBSCRIPTION.dshCommit,
  }
  assert.throws(
    () => provisionExactProfilePlugin(home, 'agent-core-production', requirement, {
      harnessIdentity: HARNESS_IDENTITY,
      pluginInstaller() {},
    }),
    (error) => error.code === 'plugin_missing',
  )

  fakeInstall({ profilesRoot: join(home, 'profiles'), plugin: 'dsh-codex', version: '0.2.4' })
  assert.throws(
    () => provisionExactProfilePlugin(home, 'agent-core-production', requirement, { harnessIdentity: HARNESS_IDENTITY }),
    (error) => error.code === 'plugin_version_mismatch',
  )
  rmSync(join(home, 'profiles', 'node_modules', 'dsh-codex'), { recursive: true, force: true })
  assert.throws(
    () => provisionExactProfilePlugin(home, 'agent-core-production', requirement, {
      harnessIdentity: { ...HARNESS_IDENTITY, version: '0.1.0-rc.6' },
      pluginInstaller: fakeInstall,
    }),
    (error) => error.code === 'dsh_version_mismatch',
  )
  assert.throws(
    () => provisionExactProfilePlugin(home, 'agent-core-production', requirement, {
      harnessIdentity: { ...HARNESS_IDENTITY, commit: 'deadbeef' },
      pluginInstaller: fakeInstall,
    }),
    (error) => error.code === 'dsh_commit_mismatch',
  )

  fakeInstall({ profilesRoot: join(home, 'profiles'), plugin: 'dsh-codex', version: '0.2.3' })
  assert.throws(
    () => provisionAgentHome(home, workspace, {
      profile: 'agent-core-production', subscription: SUBSCRIPTION, harnessIdentity: HARNESS_IDENTITY,
    }),
    (error) => error.code === 'credential_missing',
  )
  writeFileSync(join(home, SUBSCRIPTION.credentialFile), '{}', { mode: 0o644 })
  assert.throws(
    () => provisionAgentHome(home, workspace, {
      profile: 'agent-core-production', subscription: SUBSCRIPTION, harnessIdentity: HARNESS_IDENTITY,
    }),
    (error) => error.code === 'credential_permission_invalid',
  )
  chmodSync(join(home, SUBSCRIPTION.credentialFile), 0o600)
  chmodSync(home, 0o755)
  assert.throws(
    () => provisionAgentHome(home, workspace, {
      profile: 'agent-core-production', subscription: SUBSCRIPTION, harnessIdentity: HARNESS_IDENTITY,
    }),
    (error) => error.code === 'credential_permission_invalid',
  )
})
