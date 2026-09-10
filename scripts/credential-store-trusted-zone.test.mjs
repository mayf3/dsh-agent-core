// Fixture state-machine suite for the trusted-zone migration (DECISION_3).
// Unprivileged: fixtures are owned by the test uid; the root gate is satisfied
// via the injected identity and the parent-trust gate via trustedLinkParentUid
// (production defaults keep both gates at real root). Covers the owner ruling's
// migration review checklist mechanically: crash at every boundary, idempotent
// rerun, generation-safe rollback (CASE A / CASE B / BLOCKED), parent-link
// trust gate, duplicate refusal, per-call-reread semantics, no-secret-output.

import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { chmod, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { existsSync, lstatSync, readFileSync, readlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { applyMigration, classifyLayout, MigrationError, relativeTarget, rollbackMigration } from './credential-store-trusted-zone-lib.mjs'

const ROOT = { getuid: () => 0 }

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'trusted-zone-'))
  const pinnedParent = join(dir, 'config')
  const zoneDir = join(dir, 'credential-store')
  await mkdir(pinnedParent, { recursive: true })
  chmod(pinnedParent, 0o755)
  const secretOne = randomBytes(32).toString('base64url')
  const secretTwo = randomBytes(32).toString('base64url')
  const store = {
    version: 1,
    credentials: {
      agt_one: { clientId: 'mc_one', clientSecret: secretOne },
      agt_two: { clientId: 'mc_two', clientSecret: secretTwo },
    },
  }
  const pinnedStore = join(pinnedParent, 'agent-credentials.json')
  await writeFile(pinnedStore, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 })
  const parentUid = lstatSync(pinnedParent).uid
  const faces = {
    pinnedStore,
    zoneDir,
    zoneStore: join(zoneDir, 'agent-credentials.json'),
    preimageFile: join(dir, 'preimages', 'agent-credentials.json.preimage'),
    preimageDir: join(dir, 'preimages'),
    receiptFile: join(dir, 'migration-receipt.json'),
    identity: ROOT,
    trustedLinkParentUid: parentUid,
  }
  t.after(async () => { await rm(dir, { recursive: true, force: true }) })
  return { dir, pinnedParent, pinnedStore, zoneDir, zoneStore: faces.zoneStore, faces, store, secretOne, secretTwo }
}

function assertMigratedLayout(f) {
  const pinned = lstatSync(f.pinnedStore)
  assert.equal(pinned.isSymbolicLink(), true)
  assert.equal(readFileSync(f.pinnedStore, 'utf8'), `${JSON.stringify(f.store, null, 2)}\n`) // read-through + bytes
  assert.equal(readlinkSync(f.pinnedStore), relativeTarget(f.pinnedStore, f.zoneStore))
  const real = lstatSync(f.zoneStore)
  assert.equal(real.isSymbolicLink(), false)
  assert.equal((real.mode & 0o7777), 0o600)
  const zone = lstatSync(f.zoneDir)
  assert.equal((zone.mode & 0o7777), 0o700)
  assert.equal(JSON.parse(readFileSync(f.zoneStore, 'utf8')).credentials.agt_one.clientSecret, f.secretOne)
}

test('fresh apply migrates; layout, read-through and modes verified; no secret output', async (t) => {
  const f = await fixture(t)
  const result = applyMigration(f.faces)
  assert.equal(result.outcome, 'migrated')
  assertMigratedLayout(f)
  // preimage + receipt exist; receipt pins the generation
  assert.equal(existsSync(f.faces.preimageFile), true)
  const receipt = JSON.parse(await readFile(f.faces.receiptFile, 'utf8'))
  assert.equal(receipt.postimageSha256, receipt.preimageSha256)
  assert.equal(receipt.entryCount, 2)
  // no-secret-output: the structured result carries no credential material
  assert.equal(JSON.stringify(result).includes(f.secretOne), false)
  assert.equal(JSON.stringify(result).includes(f.secretTwo), false)
})

test('idempotent rerun is a noop', async (t) => {
  const f = await fixture(t)
  applyMigration(f.faces)
  const rerun = applyMigration(f.faces)
  assert.equal(rerun.outcome, 'noop_already_migrated')
  assertMigratedLayout(f)
})

test('crash boundary: MOVED_NO_LINK with receipt resumes to migrated', async (t) => {
  const f = await fixture(t)
  applyMigration(f.faces)
  // simulate the crash artifact by rewinding ONLY the symlink
  await unlink(f.pinnedStore)
  assert.equal(classifyLayout(f.faces).state, 'MOVED_NO_LINK')
  const result = applyMigration(f.faces)
  assert.equal(result.outcome, 'migrated_resumed_after_crash')
  assertMigratedLayout(f)
})

test('crash boundary: MOVED_NO_LINK without receipt is BLOCKED (generation unprovable)', async (t) => {
  const f = await fixture(t)
  applyMigration(f.faces)
  await unlink(f.pinnedStore)
  await rm(f.faces.receiptFile)
  assert.throws(() => applyMigration(f.faces), (e) => e instanceof MigrationError && e.code === 'BLOCKED_REQUIRES_RECONCILIATION')
})

test('dangling symlink is BLOCKED for apply and rollback', async (t) => {
  const f = await fixture(t)
  applyMigration(f.faces)
  await rm(f.zoneStore)
  assert.equal(classifyLayout(f.faces).state, 'DANGLING_SYMLINK')
  assert.throws(() => applyMigration(f.faces), (e) => e.code === 'BLOCKED_REQUIRES_RECONCILIATION')
  assert.throws(() => rollbackMigration(f.faces), (e) => e.code === 'BLOCKED_REQUIRES_RECONCILIATION')
})

test('duplicate files (pinned file AND zone file) are BLOCKED', async (t) => {
  const f = await fixture(t)
  applyMigration(f.faces)
  await unlink(f.pinnedStore) // remove the link, then plant a real file: true duplicate state
  await writeFile(f.pinnedStore, 'duplicate', { mode: 0o600 })
  assert.equal(classifyLayout(f.faces).state, 'DUPLICATE_FILES')
  assert.throws(() => applyMigration(f.faces), (e) => e.code === 'BLOCKED_REQUIRES_RECONCILIATION')
})

test('rollback CASE A: unchanged generation restores the original layout', async (t) => {
  const f = await fixture(t)
  applyMigration(f.faces)
  const result = rollbackMigration(f.faces)
  assert.equal(result.outcome, 'rollback_case_a_layout_restored')
  assert.equal(result.generation, 'unchanged')
  assert.equal(lstatSync(f.pinnedStore).isSymbolicLink(), false)
  assert.equal((lstatSync(f.pinnedStore).mode & 0o7777), 0o600)
  assert.equal(readFileSync(f.pinnedStore, 'utf8'), `${JSON.stringify(f.store, null, 2)}\n`)
  assert.equal(existsSync(f.zoneStore), false)
  // and the layout can be migrated again
  assert.equal(applyMigration(f.faces).outcome, 'migrated')
})

test('rollback CASE B: advanced generation PRESERVES current credentials (never stale preimage)', async (t) => {
  const f = await fixture(t)
  applyMigration(f.faces)
  // provisioning/rotation writer mutates the REAL authoritative file
  const advanced = JSON.parse(await readFile(f.zoneStore, 'utf8'))
  advanced.credentials.agt_three = { clientId: 'mc_three', clientSecret: randomBytes(32).toString('base64url') }
  await writeFile(f.zoneStore, `${JSON.stringify(advanced, null, 2)}\n`, { mode: 0o600 })
  const result = rollbackMigration(f.faces)
  assert.equal(result.outcome, 'rollback_case_b_current_generation_preserved')
  assert.equal(result.generation, 'advanced')
  const restored = JSON.parse(readFileSync(f.pinnedStore, 'utf8'))
  assert.equal(restored.credentials.agt_three.clientId, 'mc_three') // CURRENT generation preserved
  assert.equal(existsSync(f.zoneStore), false)
  assert.equal(readFileSync(f.pinnedStore, 'utf8').includes(f.secretOne), true) // pre-existing state intact too
})

test('rollback without a receipt is BLOCKED', async (t) => {
  const f = await fixture(t)
  applyMigration(f.faces)
  await rm(f.faces.receiptFile)
  assert.throws(() => rollbackMigration(f.faces), (e) => e.code === 'BLOCKED_REQUIRES_RECONCILIATION')
})

test('parent-link trust gate: writable parent refuses; non-root refuses', async (t) => {
  const f = await fixture(t)
  await chmod(f.pinnedParent, 0o777)
  assert.throws(() => applyMigration(f.faces), (e) => e.code === 'LINK_PARENT_WRITABLE')
  await chmod(f.pinnedParent, 0o755)
  assert.throws(() => applyMigration({ ...f.faces, identity: { getuid: () => 12345 } }), (e) => e.code === 'ROOT_REQUIRED')
  // trustedLinkParentUid mismatch refuses (production default is uid 0)
  assert.throws(() => applyMigration({ ...f.faces, trustedLinkParentUid: 99999 }), (e) => e.code === 'LINK_PARENT_NOT_ROOT_OWNED')
})
