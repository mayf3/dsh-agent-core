/**
 * Unit tests for the AGENT_CORE_BINDING_WORKSPACE_V1 workspace seams in
 * @agent-core/workspace-bootstrap:
 *
 *   - validateWorkspaceId   (§WorkspaceIdValidation, AC11): reuse of the
 *     sanitizeAgentId safe-id rules — single safe path component only;
 *     invalid ids are STRUCTURED_REJECTed (code WORKSPACE_ID_INVALID),
 *     never truncated or reshaped.
 *   - resolveWorkspacePath  (§WorkspaceResolution): the ultra-thin
 *     workspaceId -> <workspaceRoot>/<sanitized id> derivation; the same
 *     function object as resolveWorkspace (no parallel mapping system).
 *   - ensureWorkspace       (§"Workspace 不存在怎么办"): a VALID id with a
 *     missing directory is the NORMAL bootstrap path — idempotent mkdir +
 *     seed, never a rejection; the DSH home is NOT touched (workspaces are
 *     binding cwd surfaces, homes stay agent-keyed).
 */

import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  ensureWorkspace,
  resolveWorkspacePath,
  validateWorkspaceId,
  WORKSPACE_ID_INVALID,
} from '../src/index.js'

/** Every id the Spec calls legal (AC11): normal conversation/agent shapes. */
const VALID_IDS = [
  'feishu-oc_92332c45c1cac2ef89857abfee8ed762',
  'secretary',
  'investment',
  'paper',
  'feishu-ou_8f2b1c',
  'A-b_C9',
]

/** Every id the Spec calls illegal (AC11) — one per rejection rule. */
const INVALID_IDS = [
  'a/b',          // path separator
  '..',           // traversal
  '.',            // current dir
  ' lead',        // leading space
  'trail ',       // trailing space
  'a\\b',         // windows separator
  '/abs',         // absolute path
  'a.b',          // embedded dot
  'a b',          // embedded space
  'a\0b',         // NUL
  '',             // empty
  'x'.repeat(201), // overlong (> MAX_AGENT_ID_LENGTH = 200)
  42,             // not a string
  null,
  undefined,
]

test('AC11: valid workspaceIds resolve through the same sanitize-backed derivation', () => {
  for (const id of VALID_IDS) {
    assert.equal(validateWorkspaceId(id), id, `${id} must validate unchanged (never reshaped)`)
  }
})

test('AC11: invalid workspaceIds are STRUCTURED_REJECTed, never truncated or reshaped', () => {
  for (const id of INVALID_IDS) {
    assert.throws(
      () => validateWorkspaceId(id),
      (error) => error.code === WORKSPACE_ID_INVALID,
      `expected WORKSPACE_ID_INVALID for ${JSON.stringify(id)}`,
    )
  }
})

test('AC11: rejection is fail-loud — the invalid input is never returned in another shape', () => {
  for (const id of ['a/b', '..', 'x'.repeat(201)]) {
    try {
      validateWorkspaceId(id)
      assert.fail(`expected rejection for ${JSON.stringify(id)}`)
    } catch (error) {
      assert.notEqual(error.code, undefined)
      // The message names the problem; the VALUE never comes back reshaped.
      assert.ok(error instanceof Error)
    }
  }
})

test('resolveWorkspacePath: <workspaceRoot>/<workspaceId>, deterministic (no mapping layer)', () => {
  const root = '/tmp/ws-root-x'
  assert.equal(resolveWorkspacePath('feishu-oc_A', root), join(root, 'feishu-oc_A'))
  assert.equal(resolveWorkspacePath('feishu-oc_A', root), resolveWorkspacePath('feishu-oc_A', root), 'deterministic')
  assert.notEqual(resolveWorkspacePath('feishu-oc_A', root), resolveWorkspacePath('feishu-oc_B', root))
})

test('ensureWorkspace: a valid id with a missing directory bootstraps (mkdir + seed), idempotent', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'wb-ws-'))
  t.after(() => rm(root, { recursive: true, force: true }))

  const first = await ensureWorkspace('feishu-oc_missing', { workspaceRoot: root })
  const dir = join(root, 'feishu-oc_missing')
  assert.equal(first.workspace, dir)
  assert.ok(existsSync(dir), 'missing directory was created (normal init path, not a reject)')
  assert.ok(existsSync(join(dir, 'AGENTS.md')), 'AGENTS.md seeded')
  const seeded = await readFile(join(dir, 'AGENTS.md'), 'utf8')

  // Second pass is a no-op: nothing re-seeded, nothing overwritten.
  await ensureWorkspace('feishu-oc_missing', { workspaceRoot: root })
  assert.equal(await readFile(join(dir, 'AGENTS.md'), 'utf8'), seeded, 'never overwritten')

  // An operator-authored AGENTS.md survives a later ensure untouched.
  const authored = join(root, 'feishu-oc_authored', 'AGENTS.md')
  await mkdir(join(root, 'feishu-oc_authored'), { recursive: true })
  await writeFile(authored, 'OPERATOR CONTENT', 'utf8')
  await ensureWorkspace('feishu-oc_authored', { workspaceRoot: root })
  assert.equal(await readFile(authored, 'utf8'), 'OPERATOR CONTENT')
})

test('ensureWorkspace: does NOT create a workspace-keyed DSH home (homes stay agent-keyed)', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'wb-ws2-'))
  const agentsHome = join(root, 'agents')
  t.after(() => rm(root, { recursive: true, force: true }))

  await ensureWorkspace('feishu-oc_A', { workspaceRoot: root })
  const entries = await readdir(root)
  assert.deepEqual(entries, ['feishu-oc_A'], 'exactly one workspace dir — no stray home tree')
  assert.ok(!existsSync(join(agentsHome, 'feishu-oc_A')))
})

test('ensureWorkspace: an invalid workspaceId still fails loud (only FORMAT is rejected)', async () => {
  await assert.rejects(
    () => ensureWorkspace('a/b'),
    (error) => error.code === WORKSPACE_ID_INVALID,
  )
})
