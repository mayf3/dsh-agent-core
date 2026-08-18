/**
 * AGENT_PRIMARY_WORKSPACE_IMPORT_V1 (accepted @d823750) implementation tests.
 *
 * Frozen Primary Workspace Resolution Rule (§3):
 *
 *   primaryWorkspaces[agentId] present (imported agent)
 *     → the explicit validated absolute directory (adopted in place)
 *   absent (default agent — everything as today)
 *     → <workspaceRoot>/<sanitizeAgentId(agentId)> (byte-identical derivation)
 *
 * Coverage (Spec §11 AC map in brackets):
 *   A  default agents keep the exact pre-Spec derivation        [AC1]
 *   B  an explicit existing absolute directory is returned as-is [AC2]
 *   C  invalid entries fail LOUD at config load
 *      (PRIMARY_WORKSPACE_INVALID; never degrade, never ignore)  [AC8]
 *   G  resolveWorkspacePath / ensureWorkspace stay UNPOLLUTED by
 *      the per-agent primary override (Binding.workspace keeps the
 *      generic <workspaceRoot>/<workspaceId> derivation)          [§3, AC6]
 *   H  ensure() on an imported agent is ZERO-WRITE on the workspace
 *      side (no mkdir, no AGENTS.md seeding) while the DSH home is
 *      provisioned as before                                     [AC7]
 *   I  the same static config deterministically yields the same
 *      primary workspace across calls and restarts               [§3]
 */

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, describe } from 'node:test'

import {
  PRIMARY_WORKSPACE_INVALID,
  apply,
  ensure,
  resolveWorkspacePath,
  validatePrimaryWorkspaces,
} from '../src/index.js'
import { lookupPrimaryWorkspace, resolveWorkspace } from '../src/paths.js'

/** Mount the plugin service over a throwaway ctx (provide-only surface). */
function mountService(config) {
  const holder = {}
  apply({ provide: (name, value) => { holder[name] = value } }, config)
  return holder.workspaceBootstrap
}

/** A fresh tmp tree with an EXISTING imported directory inside. */
async function tmpImported(t, { marker = 'imported-here' } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'wsb-import-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const imported = join(dir, 'workspace-oc_imported')
  await mkdir(imported, { recursive: true })
  await writeFile(join(imported, marker), 'from before the import\n', 'utf8')
  return { dir, imported }
}

// ---------------------------------------------------------------------------
// A — default agents: byte-identical derivation (AC1)
// ---------------------------------------------------------------------------

describe('A: default agents (no entry)', () => {
  test('no primaryWorkspaces argument → derivation unchanged, byte-identical', async (t) => {
    const { dir } = await tmpImported(t)
    const root = join(dir, 'ws')
    const env = {}
    for (const agentId of ['agt_plain', 'agt_stock_agent', 'A1-b_2']) {
      assert.equal(resolveWorkspace(agentId, root, env), join(root, agentId))
    }
  })

  test('empty record / other agents’ entries never affect an unlisted agent', async (t) => {
    const { dir, imported } = await tmpImported(t)
    const root = join(dir, 'ws')
    const env = {}
    assert.equal(resolveWorkspace('agt_other', root, env, {}), join(root, 'agt_other'))
    assert.equal(
      resolveWorkspace('agt_other', root, env, { agt_imported: imported }),
      join(root, 'agt_other'),
      'an entry for one agent must not leak into another agent',
    )
  })

  test('lookupPrimaryWorkspace: undefined for absent/blank/foreign entries', async (t) => {
    const { imported } = await tmpImported(t)
    assert.equal(lookupPrimaryWorkspace('a', undefined), undefined)
    assert.equal(lookupPrimaryWorkspace('a', null), undefined)
    assert.equal(lookupPrimaryWorkspace('a', {}), undefined)
    assert.equal(lookupPrimaryWorkspace('a', { b: imported }), undefined)
    assert.equal(lookupPrimaryWorkspace('a', { a: imported }), imported)
  })
})

// ---------------------------------------------------------------------------
// B — imported agents: the exact configured existing directory (AC2)
// ---------------------------------------------------------------------------

describe('B: imported agents (explicit entry)', () => {
  test('resolveWorkspace returns the exact imported directory', async (t) => {
    const { dir, imported } = await tmpImported(t)
    assert.equal(
      resolveWorkspace('agt_imported', join(dir, 'ws'), {}, { agt_imported: imported }),
      imported,
    )
  })

  test('the explicit entry wins over every root/env derivation input', async (t) => {
    const { dir, imported } = await tmpImported(t)
    // A configured root AND a $DSH_WORKSPACE_DIR are both overridden by the
    // explicit import entry (§3: primaryWorkspaces 存在 → 使用该目录).
    assert.equal(
      resolveWorkspace('agt_imported', join(dir, 'other-root'), { DSH_WORKSPACE_DIR: join(dir, 'env-root') }, { agt_imported: imported }),
      imported,
    )
  })

  test('service closure: resolveWorkspace / ensure use the validated map', async (t) => {
    const { dir, imported } = await tmpImported(t)
    const service = mountService({
      workspaceRoot: join(dir, 'ws'),
      agentsHome: join(dir, 'homes'),
      primaryWorkspaces: { agt_imported: imported },
    })
    assert.equal(service.resolveWorkspace('agt_imported'), imported)
    assert.equal(service.resolveWorkspace('agt_default'), join(dir, 'ws', 'agt_default'))
    assert.deepEqual(service.primaryWorkspaces, { agt_imported: imported })
  })
})

// ---------------------------------------------------------------------------
// C — invalid config fails LOUD (AC8)
// ---------------------------------------------------------------------------

describe('C: invalid entries → PRIMARY_WORKSPACE_INVALID at config load', () => {
  test('relative path', async (t) => {
    const { imported } = await tmpImported(t)
    assert.throws(
      () => validatePrimaryWorkspaces({ agt_x: imported.slice(1) }),
      (error) => error.code === PRIMARY_WORKSPACE_INVALID && /absolute/.test(error.message),
    )
  })

  test('bare relative segment (no leading slash)', () => {
    assert.throws(
      () => validatePrimaryWorkspaces({ agt_x: 'relative/dir' }),
      (error) => error.code === PRIMARY_WORKSPACE_INVALID,
    )
  })

  test('missing directory', async (t) => {
    const { dir } = await tmpImported(t)
    assert.throws(
      () => validatePrimaryWorkspaces({ agt_x: join(dir, 'no-such-dir') }),
      (error) => error.code === PRIMARY_WORKSPACE_INVALID && /existing directory/.test(error.message),
    )
  })

  test('existing FILE (not a directory)', async (t) => {
    const { dir } = await tmpImported(t)
    const file = join(dir, 'plain-file')
    await writeFile(file, 'x', 'utf8')
    assert.throws(
      () => validatePrimaryWorkspaces({ agt_x: file }),
      (error) => error.code === PRIMARY_WORKSPACE_INVALID && /directory/.test(error.message),
    )
  })

  test('symlink target (alias farms forbidden)', async (t) => {
    const { dir, imported } = await tmpImported(t)
    const link = join(dir, 'alias-link')
    await symlink(imported, link)
    assert.throws(
      () => validatePrimaryWorkspaces({ agt_x: link }),
      (error) => error.code === PRIMARY_WORKSPACE_INVALID && /symlink/.test(error.message),
    )
  })

  test('illegal agentId key (same sanitize rules)', () => {
    for (const badKey of ['a/b', '..', ' lead', 'a b', 'a.b', '', 'x'.repeat(201)]) {
      assert.throws(
        () => validatePrimaryWorkspaces({ [badKey]: '/tmp' }),
        (error) => error.code === PRIMARY_WORKSPACE_INVALID,
        `expected PRIMARY_WORKSPACE_INVALID for key ${JSON.stringify(badKey)}`,
      )
    }
  })

  test('non-string / empty values and non-record input', () => {
    assert.throws(() => validatePrimaryWorkspaces({ agt_x: '' }), (e) => e.code === PRIMARY_WORKSPACE_INVALID)
    assert.throws(() => validatePrimaryWorkspaces({ agt_x: 42 }), (e) => e.code === PRIMARY_WORKSPACE_INVALID)
    assert.throws(() => validatePrimaryWorkspaces(['a']), (e) => e.code === PRIMARY_WORKSPACE_INVALID)
    assert.throws(() => validatePrimaryWorkspaces('x'), (e) => e.code === PRIMARY_WORKSPACE_INVALID)
  })

  test('a ~-prefixed value expands against the OS home (missing target still fails)', () => {
    assert.throws(
      () => validatePrimaryWorkspaces({ agt_x: '~/.no-such-wsb-import-target' }),
      (error) => error.code === PRIMARY_WORKSPACE_INVALID && /existing directory/.test(error.message),
    )
  })

  test('apply() mount itself fails loud — the plugin never starts degraded', async (t) => {
    const { dir } = await tmpImported(t)
    assert.throws(
      () => mountService({ workspaceRoot: join(dir, 'ws'), primaryWorkspaces: { agt_x: 'relative' } }),
      (error) => error.code === PRIMARY_WORKSPACE_INVALID,
    )
  })

  test('valid imports do not affect default agents (不牵连 default Agent)', async (t) => {
    const { dir, imported } = await tmpImported(t)
    const root = join(dir, 'ws')
    const validated = validatePrimaryWorkspaces({ agt_imported: imported })
    assert.deepEqual(validated, { agt_imported: imported })
    // A default agent under the SAME config keeps the plain derivation.
    assert.equal(resolveWorkspace('agt_default', root, {}, validated), join(root, 'agt_default'))
  })

  test('absent config validates to {} (no imports, no IO)', () => {
    assert.deepEqual(validatePrimaryWorkspaces(undefined), {})
    assert.deepEqual(validatePrimaryWorkspaces(null), {})
    assert.deepEqual(validatePrimaryWorkspaces({}), {})
  })
})

// ---------------------------------------------------------------------------
// G — resolveWorkspacePath / ensureWorkspace stay unpolluted (§3, AC6)
// ---------------------------------------------------------------------------

describe('G: generic Binding.workspace resolution is decoupled', () => {
  test('resolveWorkspacePath never consults the primary override — even when workspaceId == agentId', async (t) => {
    const { dir, imported } = await tmpImported(t)
    const root = join(dir, 'ws')
    assert.equal(resolveWorkspacePath('agt_imported', root), join(root, 'agt_imported'))
    // The pure function with an override in hand still derives generically.
    assert.equal(resolveWorkspace('agt_imported', root, {}, undefined), join(root, 'agt_imported'))
  })

  test('service seams: resolveWorkspacePath + ensureWorkspace keep the generic derivation', async (t) => {
    const { dir, imported } = await tmpImported(t)
    const service = mountService({
      workspaceRoot: join(dir, 'ws'),
      agentsHome: join(dir, 'homes'),
      primaryWorkspaces: { agt_imported: imported },
    })
    assert.equal(service.resolveWorkspace('agt_imported'), imported)
    assert.equal(service.resolveWorkspacePath('agt_imported'), join(dir, 'ws', 'agt_imported'),
      'Binding.workspace == agentId must NOT resolve to the imported primary (V2 gate stays intact)')
    const { workspace } = await service.ensureWorkspace('agt_imported')
    assert.equal(workspace, join(dir, 'ws', 'agt_imported'))
    const entries = await readdir(join(dir, 'ws', 'agt_imported'))
    assert.ok(entries.includes('AGENTS.md'), 'generic binding workspaces still bootstrap + seed')
  })
})

// ---------------------------------------------------------------------------
// H — ensure() zero-write semantics for imported agents (AC7)
// ---------------------------------------------------------------------------

describe('H: ensure() adopts the imported directory with ZERO workspace-side writes', () => {
  test('no mkdir, no AGENTS.md seeding, directory listing unchanged; dshHome provisioned', async (t) => {
    const { dir, imported } = await tmpImported(t)
    const before = (await readdir(imported)).sort()
    assert.ok(!before.includes('AGENTS.md'), 'precondition: the imported dir ships WITHOUT AGENTS.md')

    const { workspace, dshHome } = await ensure('agt_imported', {
      workspaceRoot: join(dir, 'ws'),
      agentsHome: join(dir, 'homes'),
      primaryWorkspaces: { agt_imported: imported },
    })
    assert.equal(workspace, imported)
    assert.equal(dshHome, join(dir, 'homes', 'agt_imported'))

    const after = (await readdir(imported)).sort()
    assert.deepEqual(after, before, 'zero copy / zero merge / zero seed / zero rewrite / zero delete')
    const marker = await readFile(join(imported, 'imported-here'), 'utf8')
    assert.equal(marker, 'from before the import\n', 'existing file content untouched')
    const homeEntries = await readdir(dshHome)
    assert.deepEqual(homeEntries, [], 'dshHome provisioned (empty), independent of the import')
  })

  test('idempotent: a second ensure is still a no-op on the imported dir', async (t) => {
    const { dir, imported } = await tmpImported(t)
    const cfg = {
      workspaceRoot: join(dir, 'ws'),
      agentsHome: join(dir, 'homes'),
      primaryWorkspaces: { agt_imported: imported },
    }
    await ensure('agt_imported', cfg)
    await ensure('agt_imported', cfg)
    const entries = (await readdir(imported)).sort()
    assert.ok(!entries.includes('AGENTS.md'), 'SEED_IMPORTED_WORKSPACE = NO, even on repeat calls')
  })

  test('mixed fleet: default agents in the same config still mkdir + seed', async (t) => {
    const { dir, imported } = await tmpImported(t)
    const cfg = {
      workspaceRoot: join(dir, 'ws'),
      agentsHome: join(dir, 'homes'),
      primaryWorkspaces: { agt_imported: imported },
    }
    const { workspace } = await ensure('agt_default', cfg)
    assert.equal(workspace, join(dir, 'ws', 'agt_default'))
    const entries = await readdir(workspace)
    assert.ok(entries.includes('AGENTS.md'), 'default agent keeps full bootstrap behavior')
  })
})

// ---------------------------------------------------------------------------
// I — determinism across calls and restarts (§3)
// ---------------------------------------------------------------------------

describe('I: the same static config deterministically yields the same primary', () => {
  test('repeated resolution + a simulated restart (fresh apply) agree', async (t) => {
    const { dir, imported } = await tmpImported(t)
    const config = {
      workspaceRoot: join(dir, 'ws'),
      agentsHome: join(dir, 'homes'),
      primaryWorkspaces: { agt_imported: imported },
    }
    const first = mountService(config)
    const paths = new Set([
      first.resolveWorkspace('agt_imported'),
      first.resolveWorkspace('agt_imported'),
      resolveWorkspace('agt_imported', config.workspaceRoot, {}, config.primaryWorkspaces),
    ])
    // "Restart": a fresh mount over the SAME static config.
    const second = mountService(config)
    paths.add(second.resolveWorkspace('agt_imported'))
    assert.equal(paths.size, 1)
    assert.equal([...paths][0], imported)
  })
})
