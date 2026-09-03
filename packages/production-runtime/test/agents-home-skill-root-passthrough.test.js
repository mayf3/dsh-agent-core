/**
 * Shared skill root pass-through regression tests (AGENT_SHARED_SKILL_ROOT_
 * MINIMAL_FIX_READY_FOR_INTEGRATION_V1).
 *
 * Production incident: the Agent child inherited no DSH_AGENTS_HOME, so the
 * DeepSeek Harness skill-filesystem resolved its shared user skill root as
 * config.agentsHome ?? $DSH_AGENTS_HOME ?? ~/.agents against the runtime
 * uid's home (/Users/authsvc/.agents) and never saw the canonical shared
 * skills under /Users/yanfenma/.agents/skills (e.g. brave-browser-agent).
 *
 *   ACC-1 — renderPlist forwards DSH_AGENTS_HOME when the installing shell
 *           carries it, and stays absent (no hardcoded user path) when unset.
 *   ACC-2 — the real agentEnv() spread carries a parent-env DSH_AGENTS_HOME
 *           into the child env while DSH_HOME / TMPDIR / proxy / HOME
 *           semantics are byte-identical to the pre-fix policy.
 *   ACC-2b — per-agent DSH-home resolution is unaffected: workspace-bootstrap
 *           mounted with a configured agentsHome (the production compose
 *           shape) outranks the env var, so the pass-through cannot move
 *           agent homes.
 *   ACC-5 — negative regression: without the env var the child env carries
 *           no DSH_AGENTS_HOME (harness fallback semantics preserved), and a
 *           bootstrap WITHOUT a configured agentsHome still honours the env
 *           var (the documented workspace-bootstrap override knob).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

import { renderPlist } from '../../../scripts/production-runtime-launchd.mjs'
import { AGENT_CHILD_TMPDIR, agentEnv } from '../../agent-router/src/process/env.js'
import { apply as applyBootstrap } from '../../workspace-bootstrap/src/index.js'

const FIXTURE_AGENTS_HOME = '/Users/yanfenma/.agents'
const PLIST_ARGS = {
  root: '/fixtures/agent-core',
  label: 'ai.agent-core.runtime',
  nodeBin: '/usr/local/libexec/agent-core/node-runtime/bin/node',
  harness: '/usr/local/libexec/agent-core/harness',
  runtimeScript: '/usr/local/libexec/agent-core/app/scripts/production-runtime.mjs',
  workingDir: '/usr/local/libexec/agent-core/app',
}

/** Save/clobber/restore one process.env key around a test body. */
function withEnv(name, value, body) {
  const previous = process.env[name]
  try {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
    body()
  } finally {
    if (previous === undefined) delete process.env[name]
    else process.env[name] = previous
  }
}

// ---------------------------------------------------------------------------
// ACC-1 — launchd render
// ---------------------------------------------------------------------------

test('ACC-1: plist forwards DSH_AGENTS_HOME when set at install time', () => {
  withEnv('DSH_AGENTS_HOME', FIXTURE_AGENTS_HOME, () => {
    const plist = renderPlist(PLIST_ARGS)
    assert.match(plist, new RegExp(`<key>DSH_AGENTS_HOME</key><string>${FIXTURE_AGENTS_HOME.replace(/\./g, '\\.')}</string>`))
  })
})

test('ACC-1: unset at install time -> key absent, value only ever comes from the install-time env', () => {
  withEnv('DSH_AGENTS_HOME', undefined, () => {
    const plist = renderPlist(PLIST_ARGS)
    assert.ok(!plist.includes('<key>DSH_AGENTS_HOME</key>'), 'unset env must not render the key')
    // The trusted unit's other fixed env keys are untouched.
    assert.match(plist, /<key>DSH_HARNESS_ROOT<\/key>/)
    assert.match(plist, new RegExp(`<key>HOME</key><string>${homedir().replace(/\./g, '\\.')}</string>`))
  })
  // The value follows the installing shell's env exactly — nothing is baked
  // into the script itself: a different install-time value renders verbatim.
  withEnv('DSH_AGENTS_HOME', '/fixtures/other-agents-home', () => {
    const plist = renderPlist(PLIST_ARGS)
    assert.match(plist, /<key>DSH_AGENTS_HOME<\/key><string>\/fixtures\/other-agents-home<\/string>/)
  })
})

// ---------------------------------------------------------------------------
// ACC-2 — parent -> child env through the real agentEnv()
// ---------------------------------------------------------------------------

test('ACC-2: agentEnv carries parent DSH_AGENTS_HOME into the child env', () => {
  withEnv('DSH_AGENTS_HOME', FIXTURE_AGENTS_HOME, () => {
    const childEnv = agentEnv('/fixtures/homes/agt_demo')
    assert.equal(childEnv.DSH_AGENTS_HOME, FIXTURE_AGENTS_HOME)
    // Unchanged child-env policy, asserted on the same object:
    assert.equal(childEnv.DSH_HOME, '/fixtures/homes/agt_demo')
    assert.equal(childEnv.TMPDIR, AGENT_CHILD_TMPDIR)
    assert.equal(childEnv.HOME, process.env.HOME)
    assert.equal(childEnv.DSH_TELEMETRY_DISABLED, '1')
    for (const proxy of ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy']) {
      assert.equal(childEnv[proxy], undefined)
    }
    // The Router parent's own process.env is untouched by agentEnv.
    assert.equal(process.env.DSH_AGENTS_HOME, FIXTURE_AGENTS_HOME)
  })
})

test('ACC-5: unset parent env -> child env carries no DSH_AGENTS_HOME (fallback root semantics preserved)', () => {
  withEnv('DSH_AGENTS_HOME', undefined, () => {
    const childEnv = agentEnv('/fixtures/homes/agt_demo')
    assert.equal(childEnv.DSH_AGENTS_HOME, undefined)
    assert.equal(childEnv.DSH_HOME, '/fixtures/homes/agt_demo')
    assert.equal(childEnv.TMPDIR, AGENT_CHILD_TMPDIR)
  })
})

// ---------------------------------------------------------------------------
// ACC-2b — DSH-home semantics: configured agentsHome outranks the env var
// ---------------------------------------------------------------------------

test('ACC-2b: configured agentsHome (production compose shape) ignores env DSH_AGENTS_HOME', () => {
  const ctx = { provided: {}, provide(name, value) { this.provided[name] = value } }
  applyBootstrap(ctx, { workspaceRoot: '/fixtures/workspaces', agentsHome: '/fixtures/homes' })
  withEnv('DSH_AGENTS_HOME', FIXTURE_AGENTS_HOME, () => {
    assert.equal(
      ctx.provided.workspaceBootstrap.resolveDshHome('agt_demo'),
      resolve('/fixtures/homes', 'agt_demo'),
      'configured agentsHome must outrank the skill-root env var',
    )
  })
})

test('ACC-5b: bootstrap WITHOUT configured agentsHome still honours the env var (documented override knob)', () => {
  const ctx = { provided: {}, provide(name, value) { this.provided[name] = value } }
  applyBootstrap(ctx, { workspaceRoot: '/fixtures/workspaces' })
  withEnv('DSH_AGENTS_HOME', '/fixtures/env-homes', () => {
    assert.equal(
      ctx.provided.workspaceBootstrap.resolveDshHome('agt_demo'),
      resolve('/fixtures/env-homes', 'agt_demo'),
    )
  })
  withEnv('DSH_AGENTS_HOME', undefined, () => {
    assert.equal(
      ctx.provided.workspaceBootstrap.resolveDshHome('agt_demo'),
      resolve(homedir(), '.dsh/agents', 'agt_demo'),
    )
  })
})
