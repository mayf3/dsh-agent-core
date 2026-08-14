/**
 * Unit tests for @agent-core/agent-memory — path mapping.
 *
 * Covers: memory file/dir/daily-note resolution inside a workspace, the
 * agentId↔workspace delegation to workspace-bootstrap, and agentIdFromCwd.
 * Uses `node:test`; the mapping itself never touches the filesystem.
 */

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  agentIdFromCwd,
  resolveAgentWorkspace,
  resolveDailyNoteFile,
  resolveMemoryDir,
  resolveMemoryFile,
} from '../src/paths.js'

test('memory files resolve inside the agent workspace', () => {
  const workspace = '/tmp/ws/agent-demo'
  assert.equal(resolveMemoryFile(workspace), join(workspace, 'MEMORY.md'))
  assert.equal(resolveMemoryDir(workspace), join(workspace, 'memory'))
})

test('daily note file uses the UTC date part, deterministically', () => {
  const workspace = '/tmp/ws/agent-demo'
  const d = new Date('2026-08-15T10:00:00Z')
  assert.equal(resolveDailyNoteFile(workspace, d), join(workspace, 'memory', '2026-08-15.md'))
  assert.equal(resolveDailyNoteFile(workspace, '2026-08-15T23:59:00Z'), join(workspace, 'memory', '2026-08-15.md'))
  // Same instant → same file.
  assert.equal(resolveDailyNoteFile(workspace, d), resolveDailyNoteFile(workspace, new Date(d.getTime())))
})

test('resolveAgentWorkspace delegates to workspace-bootstrap (single owner)', () => {
  const workspace = resolveAgentWorkspace('agent-demo', '/tmp/ws-root')
  assert.equal(workspace, join('/tmp/ws-root', 'agent-demo'))
  // Different agents never collide (isolation is physical, at the directory).
  assert.notEqual(resolveAgentWorkspace('agent-a', '/tmp/ws-root'), resolveAgentWorkspace('agent-b', '/tmp/ws-root'))
})

test('resolveAgentWorkspace rejects unsafe ids (workspace-bootstrap sanitize)', () => {
  for (const bad of ['../evil', 'a/b', 'a b', '']) {
    assert.throws(() => resolveAgentWorkspace(bad), TypeError)
  }
})

test('agentIdFromCwd derives the last path component', () => {
  assert.equal(agentIdFromCwd('/tmp/ws-root/agent-demo'), 'agent-demo')
  assert.equal(agentIdFromCwd('C:\\ws\\agent-demo'), 'agent-demo')
  assert.equal(agentIdFromCwd('/'), undefined)
  assert.equal(agentIdFromCwd(''), undefined)
  // No argument → process.cwd() basename (the per-agent process runs with
  // cwd = its workspace, so this is the agent id).
  assert.equal(agentIdFromCwd(), process.cwd().split(/[\\/]/).filter(Boolean).at(-1))
})
