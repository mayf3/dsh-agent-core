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
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { test } from 'node:test'

import {
  AGENT_PROFILE_DEFS,
  CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE,
  REPO,
  assertOAuthCredentialBoundary,
  cliBin,
  provisionAgentHome,
  provisionExactProfilePlugin,
  readHarnessIdentity,
  resolveHarnessRoot,
} from '../src/index.js'

const SUBSCRIPTION = {
  plugin: 'dsh-codex',
  pluginVersion: '0.2.3',
  sourceCommit: '75d98d5b10bb926d53108e49019668c1bde2a9eb',
  artifactSha256: '2d29f95f14ff918f90b90134353c842052e9cd2aff9cb9d1866d854fff2c50b0',
  dshVersion: '0.1.0-rc.5',
  dshCommit: 'a12bb03c6861969985f066bfbf0cb7e5dd5ac567',
  credentialFile: CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE,
}
const HARNESS_IDENTITY = { version: SUBSCRIPTION.dshVersion, commit: SUBSCRIPTION.dshCommit }
const ARTIFACT_IDENTITY = {
  version: 1,
  sourceCommit: SUBSCRIPTION.sourceCommit,
  artifactSha256: SUBSCRIPTION.artifactSha256,
}

function fakeInstall({ profilesRoot, plugin, version }) {
  const dir = join(profilesRoot, 'node_modules', plugin)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: plugin, version }), 'utf8')
}

/**
 * readHarnessIdentity source-stamp fallback family (ACTIVATION V1 CTR-ACT-A03,
 * DEC-ACT-004): git identity first; ONLY when git is unavailable does the
 * deployment-owned .source-stamp {commit 40-hex, dirtyCount >= 0} take over;
 * dirtyCount != 0 / malformed / both missing stay in the existing
 * dsh_commit_mismatch fail-loud family.
 */
const STAMP_COMMIT = '514ab7b0029141b88c807704764d0d3e1eea1da4'

function stampFixture(t) {
  const harnessRoot = mkdtempSync(join(tmpdir(), 'dsh-harness-stamp-'))
  t.after(() => rmSync(harnessRoot, { recursive: true, force: true }))
  writeFileSync(join(harnessRoot, 'package.json'), JSON.stringify({ name: 'deepseek-harness', version: SUBSCRIPTION.dshVersion }), 'utf8')
  return harnessRoot
}

function writeStamp(harnessRoot, value) {
  writeFileSync(join(harnessRoot, '.source-stamp'), typeof value === 'string' ? value : JSON.stringify(value), 'utf8')
}

function commitMismatch(error) {
  return error.code === 'dsh_commit_mismatch'
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
  // The sibling harness is shared environment that legitimately moves between
  // pinned checkouts (it has drifted from the rc.5 fixture before), so the
  // real-checkout assertion is structural — still fail-loud when the harness
  // is missing or unreadable, without pinning environment drift.
  const identity = readHarnessIdentity()
  assert.equal(typeof identity.version, 'string', 'resolved DSH version is a string')
  assert.notEqual(identity.version, '', 'resolved DSH version is non-empty')
  assert.match(identity.commit, /^[0-9a-f]{40}$/u, 'resolved DSH commit is 40-char lowercase hex')
})

test('target-home plugin provisioning is exact, idempotent and leaves the shared profile byte-unchanged', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'agent-subscription-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const home = join(dir, 'home')
  const workspace = join(dir, 'ws')
  mkdirSync(home, { recursive: true, mode: 0o700 })
  chmodSync(home, 0o700)
  const sharedBefore = readFileSync(join(REPO, 'profile-production', 'package.json'))
  let installs = 0
  const installer = (input) => { installs += 1; fakeInstall(input) }

  const options = {
    profile: 'agent-core-production',
    subscription: SUBSCRIPTION,
    harnessIdentity: HARNESS_IDENTITY,
    pluginInstaller: installer,
    artifactIdentity: ARTIFACT_IDENTITY,
    credentialBoundary(_home, credentialFile) {
      assert.equal(credentialFile, CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE)
    },
  }
  provisionAgentHome(home, workspace, options)
  provisionAgentHome(home, workspace, options)

  assert.equal(installs, 1, 'exact installed plugin is reused on rerun')
  const installed = JSON.parse(readFileSync(join(home, 'profiles', 'node_modules', 'dsh-codex', 'package.json'), 'utf8'))
  assert.equal(installed.version, '0.2.3')
  const profile = JSON.parse(readFileSync(join(home, 'profiles', 'agent-core-production', 'package.json'), 'utf8'))
  assert.equal(profile.dsh.profile.bundles.filter((bundle) => bundle === 'dsh-codex').length, 1)
  const patch = readFileSync(join(home, 'profiles', 'agent-core-production', 'cordis.patch.yml'), 'utf8')
  assert.equal(patch.match(/BEGIN AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1/gu)?.length, 1)
  assert.ok(patch.includes(`credentialFile: ${JSON.stringify(CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE)}`))
  assert.equal(existsSync(join(home, '.openai-codex-auth.json')), false, 'per-home OAuth store is never created or read')
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
    sourceCommit: SUBSCRIPTION.sourceCommit,
    artifactSha256: SUBSCRIPTION.artifactSha256,
    dshVersion: SUBSCRIPTION.dshVersion,
    dshCommit: SUBSCRIPTION.dshCommit,
  }
  assert.throws(
    () => provisionExactProfilePlugin(home, 'agent-core-production', requirement, {
      harnessIdentity: HARNESS_IDENTITY,
      artifactIdentity: ARTIFACT_IDENTITY,
      pluginInstaller() {},
    }),
    (error) => error.code === 'plugin_missing',
  )

  fakeInstall({ profilesRoot: join(home, 'profiles'), plugin: 'dsh-codex', version: '0.2.4' })
  assert.throws(
    () => provisionExactProfilePlugin(home, 'agent-core-production', requirement, { harnessIdentity: HARNESS_IDENTITY, artifactIdentity: ARTIFACT_IDENTITY }),
    (error) => error.code === 'plugin_version_mismatch',
  )
  rmSync(join(home, 'profiles', 'node_modules', 'dsh-codex'), { recursive: true, force: true })
  assert.throws(
    () => provisionExactProfilePlugin(home, 'agent-core-production', requirement, {
      harnessIdentity: { ...HARNESS_IDENTITY, version: '0.1.0-rc.6' },
      artifactIdentity: ARTIFACT_IDENTITY,
      pluginInstaller: fakeInstall,
    }),
    (error) => error.code === 'dsh_version_mismatch',
  )
  assert.throws(
    () => provisionExactProfilePlugin(home, 'agent-core-production', requirement, {
      harnessIdentity: { ...HARNESS_IDENTITY, commit: 'deadbeef' },
      artifactIdentity: ARTIFACT_IDENTITY,
      pluginInstaller: fakeInstall,
    }),
    (error) => error.code === 'dsh_commit_mismatch',
  )

  fakeInstall({ profilesRoot: join(home, 'profiles'), plugin: 'dsh-codex', version: '0.2.3' })
  const canonicalRoot = join(realpathSync(dir), 'canonical')
  mkdirSync(canonicalRoot, { mode: 0o700 })
  chmodSync(canonicalRoot, 0o700)
  const canonicalFile = join(canonicalRoot, '.openai-codex-auth.json')
  assert.throws(() => assertOAuthCredentialBoundary(home, canonicalFile, { expectedCredentialFile: canonicalFile }),
    (error) => error.code === 'credential_missing')
  writeFileSync(canonicalFile, '{}', { mode: 0o644 })
  assert.throws(
    () => assertOAuthCredentialBoundary(home, canonicalFile, { expectedCredentialFile: canonicalFile }),
    (error) => error.code === 'credential_permission_invalid',
  )
  chmodSync(canonicalFile, 0o600)
  assert.equal(assertOAuthCredentialBoundary(home, canonicalFile, { expectedCredentialFile: canonicalFile }), canonicalFile)
  assert.throws(() => assertOAuthCredentialBoundary(home, join(home, '.openai-codex-auth.json')),
    (error) => error.code === 'credential_path_invalid')
})

test('modified 0.2.3 artifact requires an exact digest and source stamp', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'agent-subscription-artifact-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const home = join(dir, 'home')
  provisionAgentHome(home, join(dir, 'ws'), { profile: 'agent-core-production' })
  const artifact = join(dir, 'dsh-codex-0.2.3.tgz')
  writeFileSync(artifact, 'synthetic-package-artifact', 'utf8')
  const artifactSha256 = createHash('sha256').update(readFileSync(artifact)).digest('hex')
  const requirement = {
    plugin: SUBSCRIPTION.plugin,
    version: SUBSCRIPTION.pluginVersion,
    sourceCommit: SUBSCRIPTION.sourceCommit,
    artifactSha256,
    dshVersion: SUBSCRIPTION.dshVersion,
    dshCommit: SUBSCRIPTION.dshCommit,
  }
  const sourceStamp = join(dir, 'dsh-codex-source-stamp.json')
  writeFileSync(sourceStamp, JSON.stringify({ version: 1, sourceCommit: SUBSCRIPTION.sourceCommit, artifactSha256 }), 'utf8')
  assert.equal(provisionExactProfilePlugin(home, 'agent-core-production', requirement, {
    harnessIdentity: HARNESS_IDENTITY,
    packageArtifact: artifact,
    sourceStamp,
    pluginInstaller: fakeInstall,
  }).version, '0.2.3')

  rmSync(join(home, 'profiles', 'node_modules', 'dsh-codex'), { recursive: true, force: true })
  writeFileSync(sourceStamp, JSON.stringify({ version: 1, sourceCommit: '0'.repeat(40), artifactSha256 }), 'utf8')
  assert.throws(() => provisionExactProfilePlugin(home, 'agent-core-production', requirement, {
    harnessIdentity: HARNESS_IDENTITY,
    packageArtifact: artifact,
    sourceStamp,
    pluginInstaller: fakeInstall,
  }), (error) => error.code === 'plugin_source_mismatch')
})

test('readHarnessIdentity prefers git: a working git repo ignores the .source-stamp entirely', (t) => {
  const harnessRoot = stampFixture(t)
  for (const args of [
    ['init'],
    ['-c', 'user.email=provisioning@test.invalid', '-c', 'user.name=provisioning-test', 'commit', '--allow-empty', '-m', 'fixture'],
  ]) {
    const git = spawnSync('git', ['-C', harnessRoot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    assert.equal(git.status, 0, `git ${args[0]} failed: ${git.stderr}`)
  }
  const expected = spawnSync('git', ['-C', harnessRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
  // A stamp with a DIFFERENT commit (and dirt) must not influence the result.
  writeStamp(harnessRoot, { commit: STAMP_COMMIT, dirtyCount: 5 })
  assert.deepEqual(readHarnessIdentity(harnessRoot), { version: SUBSCRIPTION.dshVersion, commit: expected })
})

test('readHarnessIdentity: no .git + valid stamp (dirtyCount = 0) resolves the stamp commit', (t) => {
  const harnessRoot = stampFixture(t)
  writeStamp(harnessRoot, { commit: STAMP_COMMIT, dirtyCount: 0 })
  assert.deepEqual(readHarnessIdentity(harnessRoot), { version: SUBSCRIPTION.dshVersion, commit: STAMP_COMMIT })
})

test('readHarnessIdentity: no .git + stamp dirtyCount != 0 fails loud (identity not exact)', (t) => {
  const harnessRoot = stampFixture(t)
  for (const dirtyCount of [1, 3, 47]) {
    writeStamp(harnessRoot, { commit: STAMP_COMMIT, dirtyCount })
    assert.throws(
      () => readHarnessIdentity(harnessRoot),
      (error) => commitMismatch(error) && error.message.includes(`dirtyCount ${dirtyCount}`) && error.message.includes(STAMP_COMMIT),
    )
  }
})

test('readHarnessIdentity: malformed stamps fail loud (extra/missing keys, bad types, non-JSON)', (t) => {
  const harnessRoot = stampFixture(t)
  const malformed = [
    '{not json',
    '"just a string"',
    '[1, 2]',
    JSON.stringify({ commit: STAMP_COMMIT }),
    JSON.stringify({ dirtyCount: 0 }),
    JSON.stringify({ commit: STAMP_COMMIT, dirtyCount: 0, extra: 1 }),
    JSON.stringify({ commit: STAMP_COMMIT, dirtyCount: -1 }),
    JSON.stringify({ commit: STAMP_COMMIT, dirtyCount: 1.5 }),
    JSON.stringify({ commit: STAMP_COMMIT, dirtyCount: '0' }),
    JSON.stringify({ commit: STAMP_COMMIT, dirtyCount: null }),
    JSON.stringify({ commit: 514, dirtyCount: 0 }),
    JSON.stringify({ commit: '514AB7B0029141B88C807704764D0D3E1EEA1DA4', dirtyCount: 0 }),
    JSON.stringify({ commit: '514ab7b', dirtyCount: 0 }),
    JSON.stringify({ commit: 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz', dirtyCount: 0 }),
  ]
  for (const value of malformed) {
    writeStamp(harnessRoot, value)
    assert.throws(() => readHarnessIdentity(harnessRoot), commitMismatch, value)
  }
})

test('readHarnessIdentity: no .git and no .source-stamp fails loud', (t) => {
  const harnessRoot = stampFixture(t)
  assert.throws(
    () => readHarnessIdentity(harnessRoot),
    (error) => commitMismatch(error) && error.message.includes('.source-stamp missing'),
  )
})

test('stamp identity feeds the dshVersion/dshCommit pin check unchanged (mismatch is fail-loud, never a hop class)', (t) => {
  const harnessRoot = stampFixture(t)
  writeStamp(harnessRoot, { commit: STAMP_COMMIT, dirtyCount: 0 })
  const dir = mkdtempSync(join(tmpdir(), 'agent-stamp-pin-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const home = join(dir, 'home')
  const workspace = join(dir, 'ws')
  // The profile package.json must exist for the success path's bundles step.
  provisionAgentHome(home, workspace, { profile: 'agent-core-production' })
  const requirement = {
    plugin: SUBSCRIPTION.plugin,
    version: SUBSCRIPTION.pluginVersion,
    sourceCommit: SUBSCRIPTION.sourceCommit,
    artifactSha256: SUBSCRIPTION.artifactSha256,
    dshVersion: SUBSCRIPTION.dshVersion,
    dshCommit: SUBSCRIPTION.dshCommit,
  }
  // The stamp commit differs from the pinned dshCommit -> the SAME
  // dsh_commit_mismatch failure the git path produces on a pin mismatch.
  assert.throws(
    () => provisionExactProfilePlugin(home, 'agent-core-production', requirement, {
      harnessRoot,
      artifactIdentity: ARTIFACT_IDENTITY,
      pluginInstaller: fakeInstall,
    }),
    (error) => commitMismatch(error) && error.message.includes(`expected DSH commit ${SUBSCRIPTION.dshCommit}`)
      && error.message.includes(STAMP_COMMIT),
  )
  // With the pin matching the stamp, identity verification passes and the
  // install path proceeds (fake installer satisfies the exact-plugin check).
  const pinned = provisionExactProfilePlugin(home, 'agent-core-production', {
    ...requirement, dshCommit: STAMP_COMMIT,
  }, { harnessRoot, pluginInstaller: fakeInstall, artifactIdentity: ARTIFACT_IDENTITY })
  assert.equal(pinned.version, SUBSCRIPTION.pluginVersion)
})
