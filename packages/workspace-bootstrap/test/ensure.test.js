/**
 * Unit tests for @agent-core/workspace-bootstrap — seeding behaviour.
 *
 * Uses `node:test` and a throwaway `os.tmpdir()` tree so the real home is
 * never touched.
 */

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, describe } from 'node:test'

import { AGENTS_TEMPLATE, ensure } from '../src/index.js'
import { resolveDshHome, resolveWorkspace } from '../src/paths.js'

const AGENTS_HEAD = '# AGENTS.md'

/** Fresh temp config pointing both roots into the given tmp tree. */
function tmpConfig(dir, overrides = {}) {
  return { workspaceRoot: join(dir, 'ws'), agentsHome: join(dir, 'home'), ...overrides }
}

describe('ensure(agentId)', () => {
  test('creates workspace and seeds AGENTS.md; DSH home directory is created', async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'wsb-seed-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const cfg = tmpConfig(dir)
    const { workspace, dshHome } = await ensure('fresh', cfg)

    const entries = (await readdir(workspace)).sort()
    assert.deepEqual(entries, ['AGENTS.md'])
    const seeded = await readFile(join(workspace, 'AGENTS.md'), 'utf8')
    assert.equal(seeded, AGENTS_TEMPLATE)
    assert.ok(seeded.startsWith(AGENTS_HEAD))
    // DSH home must exist (even though it has no seeded files).
    assert.equal(resolveDshHome('fresh', cfg.agentsHome), dshHome)
    assert.equal((await readdir(dshHome)).length, 0)
  })

  test('idempotent: second run raises no error and does not overwrite or duplicate', async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'wsb-idem-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const cfg = tmpConfig(dir)
    await ensure('twice', cfg)
    const firstContent = await readFile(join(resolveWorkspace('twice', cfg.workspaceRoot), 'AGENTS.md'), 'utf8')
    const { workspace } = await ensure('twice', cfg) // must not throw
    const entries = await readdir(workspace)
    assert.equal(entries.filter(e => e === 'AGENTS.md').length, 1)
    const secondContent = await readFile(join(workspace, 'AGENTS.md'), 'utf8')
    assert.equal(secondContent, firstContent)
    assert.equal(secondContent, AGENTS_TEMPLATE)
  })

  test('do not overwrite: a pre-existing custom AGENTS.md is left untouched', async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'wsb-preserve-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const cfg = tmpConfig(dir)
    const workspace = resolveWorkspace('mine', cfg.workspaceRoot)
    await mkdir(workspace, { recursive: true })
    await writeFile(join(workspace, 'AGENTS.md'), '# my custom file\n', { encoding: 'utf8' })
    await ensure('mine', cfg)
    const content = await readFile(join(workspace, 'AGENTS.md'), 'utf8')
    assert.equal(content, '# my custom file\n')
  })

  test('idempotent even when the workspace already exists with no seed files', async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'wsb-empty-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const cfg = { workspaceRoot: dir, agentsHome: join(dir, 'home'), seedFiles: [] }
    const { workspace, dshHome } = await ensure('no-seed', cfg)
    assert.equal(workspace, join(dir, 'no-seed'))
    assert.equal(dshHome, join(dir, 'home', 'no-seed'))
    await ensure('no-seed', cfg) // no-op, no throw
  })

  test('workspace root is created even when only the parent existed', async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'wsb-mkdir-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const cfg = tmpConfig(dir)
    const { workspace, dshHome } = await ensure('deeply/nested'.replace('/', '_'), cfg)
    assert.equal(workspace, join(dir, 'ws', 'deeply_nested'))
    assert.equal(dshHome, join(dir, 'home', 'deeply_nested'))
  })

  test('env overrides flow through ensure', async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'wsb-env-ensure-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const { workspace, dshHome } = await ensure('env-agent', {
      workspaceRoot: join(dir, 'ws'),
      agentsHome: join(dir, 'home'),
    })
    assert.equal(workspace, join(dir, 'ws', 'env-agent'))
    assert.equal(dshHome, join(dir, 'home', 'env-agent'))
    assert.equal((await readdir(workspace)).join(','), 'AGENTS.md')
  })
})

test('seed file template is a plain-text marker without system-reminder framing', () => {
  assert.ok(AGENTS_TEMPLATE.includes('AGENTS.md'))
  assert.ok(!AGENTS_TEMPLATE.includes('<system-reminder>'))
})
