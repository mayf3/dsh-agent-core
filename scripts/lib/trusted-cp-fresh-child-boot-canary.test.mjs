// FRESH_CHILD_BOOT_CANARY_V1 — classifier tests (hermetic, fake child process).
//
// The classifier is the regression contract for the 2026-10-02 rollback:
//  - RED:  the exact failed-generation output ("plugin tree failed to load" +
//          `Cannot find package '@deepseek-ai/cordis-plugin-timer' imported
//          from .../vendor/loader/lib/index.js`) must classify as FAILURE;
//  - GREEN: the proven preimage boot shape ("[demo-server] ready pid=…" +
//          at most an allowlisted external-plugin miss, dsh-codex) is PASS.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCanary } from './trusted-cp-fresh-child-boot-canary.mjs'

/** Fake spawn: emits `output` on stderr after a tick, then closes. */
function fakeSpawn(output) {
  const children = []
  const spawnImpl = (cmd, args, opts) => {
    const child = {
      stdout: { on: (_e, cb) => queueMicrotask(() => cb('')) },
      stderr: { on: (_e, cb) => queueMicrotask(() => cb(output)) },
      kill: () => {},
      on: (event, cb) => { if (event === 'close') queueMicrotask(cb) },
    }
    children.push({ cmd, args, opts })
    return child
  }
  return { spawnImpl, children }
}

const baseArgs = (over = {}) => ({
  trustedRoot: '/tmp/does-not-matter-for-classifier',
  profile: 'production',
  readyRegex: '\\[demo-server\\] ready pid=',
  timeoutMs: 5000,
  allowMissing: ['dsh-codex'],
  ...over,
})

const RED_OUTPUT = `Error: dsh: plugin tree failed to load: failed to apply loader entry include (cordis:include): loader entries failed to apply
    [cause]: Error: failed to import loader entry timer (@deepseek-ai/cordis-plugin-timer): Cannot find package '@deepseek-ai/cordis-plugin-timer' imported from /usr/local/libexec/agent-core/harness/vendor/loader/lib/index.js
        [cause]: Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@deepseek-ai/cordis-plugin-timer' imported from /usr/local/libexec/agent-core/harness/vendor/loader/lib/index.js
    [cause]: Error: failed to import loader entry openai-codex-tui (dsh-codex/tui): Cannot find package 'dsh-codex' imported from /usr/local/libexec/agent-core/harness/vendor/loader/lib/index.js`

const GREEN_OUTPUT = `[demo-server] ready pid=17946
[agent-memory] mounted for agent dsh-agent-core (workspace /tmp/x/MEMORY.md)
[broker] forum moderator pack: 0 tools (DSH_AGENT_ID is absent)
[broker] scheduler mutation operations withheld: no credential provider configured in this runtime (fail-before-exposure)
Cannot find package 'dsh-codex' imported from /tmp/candidate/harness/vendor/loader/lib/index.js`

describe('fresh-child boot canary classifier', () => {
  test('RED: exact 2026-10-02 plugin-tree failure classifies as FAILURE with cordis-plugin-timer named', async () => {
    const { spawnImpl } = fakeSpawn(RED_OUTPUT)
    const result = await runCanary(baseArgs(), { spawnImpl, homeFactory: () => mkdtempSync(join(tmpdir(), 'canary-red-')), delay: () => Promise.resolve() })
    assert.equal(result.ok, false)
    assert.equal(result.pluginTreeFailed, true)
    const specs = result.disallowedMissing.map((m) => m.spec)
    assert.ok(specs.includes('@deepseek-ai/cordis-plugin-timer'), `expected cordis-plugin-timer in ${JSON.stringify(specs)}`)
    assert.equal(result.ready, false)
  })

  test('GREEN: ready marker + only allowlisted external miss classifies as PASS', async () => {
    const { spawnImpl } = fakeSpawn(GREEN_OUTPUT)
    const home = mkdtempSync(join(tmpdir(), 'canary-green-'))
    const result = await runCanary(baseArgs(), { spawnImpl, homeFactory: () => home, delay: () => Promise.resolve() })
    assert.equal(result.ok, true)
    assert.equal(result.ready, true)
    assert.equal(result.pluginTreeFailed, false)
    assert.deepEqual(result.missingPackages.map((m) => m.spec), ['dsh-codex'])
    assert.deepEqual(result.disallowedMissing, [])
  })

  test('allowlist can be tightened: an external miss becomes disallowed', async () => {
    const { spawnImpl } = fakeSpawn(GREEN_OUTPUT)
    const result = await runCanary(baseArgs({ allowMissing: [] }), { spawnImpl, homeFactory: () => mkdtempSync(join(tmpdir(), 'canary-tight-')), delay: () => Promise.resolve() })
    assert.equal(result.ok, false)
    assert.equal(result.disallowedMissing.length, 1)
  })

  test('home is cleaned up unless --keep-home', async () => {
    const { spawnImpl } = fakeSpawn(GREEN_OUTPUT)
    const disposable = mkdtempSync(join(tmpdir(), 'canary-clean-'))
    const result = await runCanary(baseArgs(), { spawnImpl, homeFactory: () => disposable, delay: () => Promise.resolve() })
    assert.equal(result.ok, true)
    assert.equal(existsSync(disposable), false, 'disposable home must be removed after the run')
  })
})
