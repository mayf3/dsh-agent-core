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
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  AGENT_PROFILE_DEFS,
  REPO,
  cliBin,
  provisionAgentHome,
  resolveHarnessRoot,
} from '../src/index.js'

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
})
