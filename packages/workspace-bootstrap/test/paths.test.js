/**
 * Unit tests for @agent-core/workspace-bootstrap — path mapping.
 *
 * Cover: mapping stability, path safety (traversal/absolute/empty/overlong),
 * env-var overrides, and direct sanitizeAgentId behavior.
 * Uses `node:test` (node v25 built-in). No real home is touched: the
 * configured roots in these tests always point at os.tmpdir().
 */

import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  resolveDshHome,
  resolveWorkspace,
  sanitizeAgentId,
} from '../src/paths.js'

import { ensure } from '../src/index.js'

test('mapping stability: same agentId resolves identically every time', () => {
  const id = 'alice-42'
  const a = resolveWorkspace(id)
  const b = resolveWorkspace(id)
  assert.equal(a, b)
  const ah = resolveDshHome(id)
  assert.equal(resolveDshHome(id), ah)
  // Different agents never collide.
  assert.notEqual(resolveWorkspace('alice'), resolveWorkspace('bob'))
  assert.notEqual(resolveDshHome('alice'), resolveDshHome('bob'))
})

test('mapping stability: ensure twice returns identical roots (idempotent paths)', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'wsb-map-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const opts = { workspaceRoot: join(dir, 'ws'), agentsHome: join(dir, 'home'), seedFiles: [] }
  const first = await ensure('stability', opts)
  const second = await ensure('stability', opts)
  assert.deepEqual(first, second)
  assert.equal(second.workspace, join(dir, 'ws', 'stability'))
  assert.equal(second.dshHome, join(dir, 'home', 'stability'))
})

test('path safety: traversal, separators, absolute, empty, hidden, overlong are rejected', () => {
  const bad = [
    '../evil',      // parent traversal
    'a/b',          // path separator
    'a\\b',         // windows separator
    '',             // empty
    '   ',          // whitespace only
    '..',           // pure parent
    '.',            // current dir
    '/abs/path',    // absolute
    'a b',          // embedded space
    '.hidden',      // hidden-file smuggling
    'trail.',       // trailing dot (windows silently strips)
    'x'.repeat(201),// overlong
    null,
    undefined,
    42,
    {},
  ]
  for (const input of bad) {
    assert.throws(() => sanitizeAgentId(input), /agentId/, `expected rejection for ${JSON.stringify(input)}`)
    assert.throws(() => resolveWorkspace(input), /agentId/)
    assert.throws(() => resolveDshHome(input), /agentId/)
  }
})

test('path safety: a resolved workspace can never escape its root', () => {
  const id = 'safe-id_1'
  const ws = resolveWorkspace(id, '/tmp/root')
  assert.equal(ws, join('/tmp/root', id))
  const home = resolveDshHome(id, '/tmp/home')
  assert.equal(home, join('/tmp/home', id))
})

test('env overrides: DSH_WORKSPACE_DIR / DSH_AGENTS_HOME take effect', () => {
  const dir = join(tmpdir(), 'wsb-env')
  const env = {
    DSH_WORKSPACE_DIR: join(dir, 'custom-workspaces'),
    DSH_AGENTS_HOME: join(dir, 'custom-agents'),
  }
  assert.equal(resolveWorkspace('kid', undefined, env), join(dir, 'custom-workspaces', 'kid'))
  assert.equal(resolveDshHome('kid', undefined, env), join(dir, 'custom-agents', 'kid'))
  // Blank env override is treated as unset → falls back to the default root
  // (the real home's `.dsh/workspaces`), never to the custom dir or cwd.
  const blank = { DSH_WORKSPACE_DIR: '   ', DSH_AGENTS_HOME: '' }
  const fallbackWs = resolveWorkspace('kid', undefined, blank)
  assert.ok(fallbackWs.endsWith(join('.dsh', 'workspaces', 'kid')))
  assert.ok(!fallbackWs.includes('custom-workspaces'))
  const fallbackHome = resolveDshHome('kid', undefined, blank)
  assert.ok(fallbackHome.endsWith(join('.dsh', 'agents', 'kid')))
  assert.ok(!fallbackHome.includes('custom-agents'))
})

test('sanitizeAgentId accepts safe ids unchanged', () => {
  assert.equal(sanitizeAgentId('alice_bob-2x'), 'alice_bob-2x')
  assert.equal(sanitizeAgentId('A1'), 'A1')
})
