// credential-store-trusted-zone-lib.mjs — generation-safe trusted-zone state
// machine for AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 deployment
// conformance (DECISION_3, owner ruling union 2026-09-09).
//
// Moves the authoritative credential file into an accepted-Part-G zone
// (0700 trusted-owner dir + 0600 file) and leaves a STABLE RELATIVE SYMLINK at
// the pinned logical path (broker readFileSync follows; plist/executor
// bindings unchanged; no restart). Provisioning/rotation writers address the
// REAL path (the accepted store-writer lstat-refuses symlinks).
//
// ROLLBACK IS GENERATION-SAFE (owner ruling CRITICAL_ROLLBACK_CORRECTION):
//   CASE A — no credential mutation since migration (current zone-file sha ==
//            receipt.postimageSha256): mechanical restore of the original layout.
//   CASE B — credential state advanced since migration: the CURRENT
//            authoritative bytes are moved back to the canonical old location;
//            the stale preimage is NEVER restored over them.
//   generation not provable (receipt missing/corrupt, zone file missing,
//            unexpected layout) → BLOCKED_REQUIRES_RECONCILIATION. Layout
//            restoration never wins over credential state.
//
// Crash-safe at every boundary: the layout is classified BEFORE any mutation;
// the migration receipt is written at apply START (so any later crash is
// classifiable as resume, never as external tampering); every resume path
// converges or fails loud.

import { createHash } from 'node:crypto'
import {
  chownSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync,
  readlinkSync, renameSync, statSync, symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'

export class MigrationError extends Error {
  constructor(code, message, fields = {}) {
    super(message)
    this.name = 'MigrationError'
    this.code = code
    Object.assign(this, fields)
  }
}

function fail(code, message, fields = {}) {
  throw new MigrationError(code, message, fields)
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function lstatSafe(path) {
  try { return lstatSync(path) } catch { return undefined }
}

export function relativeTarget(pinnedStore, zoneStore) {
  const zoneDir = zoneStore.slice(0, zoneStore.lastIndexOf('/'))
  return `../${zoneDir.split('/').pop()}/${zoneStore.slice(zoneStore.lastIndexOf('/') + 1)}`
}

// ── layout classification (pure read; no mutation) ──────────────────────────

export function classifyLayout({ pinnedStore, zoneStore }) {
  const pinned = lstatSafe(pinnedStore)
  const zoneStoreStat = lstatSafe(zoneStore)
  if (pinned === undefined && zoneStoreStat === undefined) return { state: 'STORE_ABSENT' }
  if (pinned?.isSymbolicLink()) {
    let target
    try { target = readlinkSync(pinnedStore) } catch { /* unreadable */ }
    if (target !== relativeTarget(pinnedStore, zoneStore)) return { state: 'UNEXPECTED_SYMLINK', target }
    if (zoneStoreStat === undefined) return { state: 'DANGLING_SYMLINK', target }
    return { state: 'MIGRATED', target }
  }
  if (pinned?.isFile() && zoneStoreStat !== undefined) return { state: 'DUPLICATE_FILES' }
  if (pinned?.isFile()) {
    const stat = statSync(pinnedStore)
    return { state: 'FRESH', mode: stat.mode & 0o7777, ownerUid: stat.uid, ownerGid: stat.gid }
  }
  if (pinned === undefined && zoneStoreStat !== undefined) {
    // Crash window after the authoritative rename, before the symlink existed.
    return { state: 'MOVED_NO_LINK', mode: zoneStoreStat.mode & 0o7777, ownerUid: zoneStoreStat.uid, ownerGid: zoneStoreStat.gid }
  }
  return { state: 'UNRECOGNIZED' }
}

// ── shared gates ────────────────────────────────────────────────────────────

function assertTrustedParentForLink(pinnedStore, trustedLinkParentUid = 0) {
  // The symlink lives in the pinned parent; it must NOT be replaceable by the
  // credential-store owner (authsvc) — root-owned (uid 0; test fixtures inject
  // their own uid via trustedLinkParentUid), not group/world writable.
  const parent = lstatSync(dirname(pinnedStore))
  if (!parent.isDirectory()) fail('LINK_PARENT_NOT_DIR', 'pinned parent is not a directory')
  if (parent.uid !== trustedLinkParentUid) fail('LINK_PARENT_NOT_ROOT_OWNED', `pinned parent must be owned by the trusted link manager (uid=${parent.uid}, expected ${trustedLinkParentUid})`)
  if (parent.mode & 0o022) fail('LINK_PARENT_WRITABLE', `pinned parent must not be group/world writable (mode ${(parent.mode & 0o7777).toString(8)})`)
}

function readReceipt(receiptFile) {
  if (!existsSync(receiptFile)) return undefined
  try {
    const receipt = JSON.parse(readFileSync(receiptFile, 'utf8'))
    if (receipt?.preimageSha256 && receipt?.postimageSha256 && Number.isInteger(receipt?.owner?.uid)) return receipt
    return undefined
  } catch {
    return undefined
  }
}

function verifyMigrated({ pinnedStore, zoneStore, preimageBytes, expectedEntries }) {
  const throughPinned = readFileSync(pinnedStore) // follows the symlink (broker face)
  JSON.parse(throughPinned.toString('utf8'))
  const realStat = lstatSync(zoneStore)
  if (realStat.isSymbolicLink() || (realStat.mode & 0o7777) !== 0o600) fail('POST_VERIFY_REAL', 'real store is not a 0600 regular file')
  const dir = lstatSync(dirname(zoneStore))
  if ((dir.mode & 0o7777) !== 0o700) fail('POST_VERIFY_DIR', 'trusted zone is not 0700')
  const parsed = JSON.parse(readFileSync(zoneStore, 'utf8'))
  if (expectedEntries !== undefined && Object.keys(parsed.credentials ?? {}).length !== expectedEntries) {
    fail('POST_VERIFY_ENTRIES', 'credential entry count changed during migration')
  }
  if (preimageBytes !== undefined && !throughPinned.equals(preimageBytes)) {
    fail('POST_VERIFY_BYTES', 'pinned-path bytes do not match the migration generation')
  }
  return {
    pinnedReadThrough: 'ok',
    entryCount: Object.keys(parsed.credentials ?? {}).length,
    realStore: { mode: '0600', ownerUid: realStat.uid, ownerGid: realStat.gid },
    zone: { mode: (dir.mode & 0o7777).toString(8), ownerUid: dir.uid, ownerGid: dir.gid },
  }
}

// ── apply (idempotent, crash-resumable) ─────────────────────────────────────

export function applyMigration({ pinnedStore, zoneDir, zoneStore, preimageFile, receiptFile, preimageDir, identity = process, trustedLinkParentUid }) {
  const layout = classifyLayout({ pinnedStore, zoneStore })
  if (layout.state === 'MIGRATED') return { outcome: 'noop_already_migrated', layout }
  if (layout.state === 'DANGLING_SYMLINK') fail('BLOCKED_REQUIRES_RECONCILIATION', 'pinned path is a dangling symlink — external state change; reconcile before migrating')
  if (layout.state === 'DUPLICATE_FILES') fail('BLOCKED_REQUIRES_RECONCILIATION', 'credential file exists at BOTH the pinned and zone paths')
  if (layout.state === 'STORE_ABSENT') fail('STORE_ABSENT', `authoritative store not found at ${pinnedStore}`)
  if (layout.state === 'UNRECOGNIZED') fail('UNRECOGNIZED_LAYOUT', 'layout does not match any known migration state')

  if (identity.getuid?.() !== 0) fail('ROOT_REQUIRED', 'apply must run as root (trusted-zone creation + chown)')
  assertTrustedParentForLink(pinnedStore, trustedLinkParentUid)

  // Resume discipline: a pre-existing receipt belongs to THIS migration
  // attempt only when its preimage digest matches the current authoritative
  // bytes; anything else is a stale receipt from an earlier generation and is
  // replaced (a fresh migration starts a fresh receipt).
  const staleReceipt = readReceipt(receiptFile)

  if (layout.state === 'FRESH') {
    const bytes = readFileSync(pinnedStore)
    const digest = sha256(bytes)
    const parsed = JSON.parse(bytes.toString('utf8'))
    if (parsed?.version !== 1 || typeof parsed.credentials !== 'object') fail('STORE_SHAPE', 'store fails V1 shape')
    if (layout.mode !== 0o600) fail('UNSAFE_STORE_MODE', 'store must be 0600 pre-migration')
    const owner = { uid: layout.ownerUid, gid: layout.ownerGid }
    if (owner.uid === 0) fail('TRUSTED_OWNER_ROOT', 'store owner is root; a trusted control-plane owner must exist first')
    const resuming = staleReceipt !== undefined && staleReceipt.preimageSha256 === digest && staleReceipt.completedAt === undefined
    const receipt = resuming ? staleReceipt : {
      task: 'CANONICAL_ONBOARDING trusted-zone migration (DECISION_3, generation-safe)',
      startedAt: new Date().toISOString(),
      preimageSha256: digest,
      postimageSha256: digest,
      preimageFile,
      owner,
      entryCount: Object.keys(parsed.credentials).length,
    }
    mkdirSync(preimageDir, { recursive: true })
    copyFileSync(pinnedStore, preimageFile)
    writeFileSync(`${preimageFile}.sha256`, `${digest}  agent-credentials.json.preimage\n`, { mode: 0o600 })
    writeFileSync(receiptFile, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 })

    if (!existsSync(zoneDir)) {
      mkdirSync(zoneDir, { mode: 0o700 })
      chownSync(zoneDir, owner.uid, owner.gid)
    }
    const zoneStat = lstatSync(zoneDir)
    if (!zoneStat.isDirectory() || (zoneStat.mode & 0o7777) !== 0o700 || zoneStat.uid !== owner.uid || zoneStat.gid !== owner.gid) {
      fail('ZONE_NOT_TRUSTED', `zone dir non-conforming: mode ${(zoneStat.mode & 0o7777).toString(8)} owner ${zoneStat.uid}:${zoneStat.gid}`)
    }
    if (!existsSync(zoneStore)) renameSync(pinnedStore, zoneStore)
    const moved = lstatSync(zoneStore)
    if ((moved.mode & 0o7777) !== 0o600 || moved.uid !== owner.uid) fail('MOVE_CHANGED_METADATA', 'moved store changed owner/mode')
    if (lstatSafe(pinnedStore) === undefined) {
      const tempLink = `${pinnedStore}.migrate-${process.pid}`
      symlinkSync(relativeTarget(pinnedStore, zoneStore), tempLink)
      renameSync(tempLink, pinnedStore)
    }
    const verified = verifyMigrated({ pinnedStore, zoneStore, preimageBytes: bytes, expectedEntries: receipt.entryCount })
    const completed = { ...receipt, completedAt: new Date().toISOString(), verified }
    writeFileSync(receiptFile, `${JSON.stringify(completed, null, 2)}\n`, { mode: 0o600 })
    return { outcome: 'migrated', layoutBefore: layout, verified }
  }

  // MOVED_NO_LINK: crash after the authoritative rename, before the symlink.
  // The receipt MUST exist (it is written before the rename) and the zone file
  // is the authoritative generation — verify it, then complete the link.
  if (layout.state === 'MOVED_NO_LINK') {
    const receipt = readReceipt(receiptFile)
    if (receipt === undefined) fail('BLOCKED_REQUIRES_RECONCILIATION', 'moved layout without a migration receipt — generation unprovable')
    if (layout.mode !== 0o600) fail('UNSAFE_STORE_MODE', 'moved store must be 0600')
    if (lstatSafe(pinnedStore) === undefined) {
      const tempLink = `${pinnedStore}.migrate-${process.pid}`
      symlinkSync(relativeTarget(pinnedStore, zoneStore), tempLink)
      renameSync(tempLink, pinnedStore)
    }
    const verified = verifyMigrated({ pinnedStore, zoneStore })
    const completed = { ...receipt, resumedAt: new Date().toISOString(), verified }
    writeFileSync(receiptFile, `${JSON.stringify(completed, null, 2)}\n`, { mode: 0o600 })
    return { outcome: 'migrated_resumed_after_crash', layoutBefore: layout, verified }
  }

  fail('UNREACHABLE_STATE', `unhandled state ${layout.state}`)
}

// ── generation-safe rollback ────────────────────────────────────────────────

export function rollbackMigration({ pinnedStore, zoneDir, zoneStore, receiptFile, identity = process, trustedLinkParentUid }) {
  const layout = classifyLayout({ pinnedStore, zoneStore })
  if (layout.state !== 'MIGRATED' && layout.state !== 'DANGLING_SYMLINK') {
    fail('ROLLBACK_NOT_APPLICABLE', `rollback applies to a migrated layout (current: ${layout.state})`)
  }
  const receipt = readReceipt(receiptFile)
  if (receipt === undefined) fail('BLOCKED_REQUIRES_RECONCILIATION', 'no parsable migration receipt — generation cannot be proven')
  if (layout.state === 'DANGLING_SYMLINK') fail('BLOCKED_REQUIRES_RECONCILIATION', 'zone store missing while pinned is a symlink — credential state unprovable')
  if (identity.getuid?.() !== 0) fail('ROOT_REQUIRED', 'rollback must run as root')
  assertTrustedParentForLink(pinnedStore, trustedLinkParentUid)

  const currentBytes = readFileSync(zoneStore)
  const currentSha = sha256(currentBytes)
  JSON.parse(currentBytes.toString('utf8')) // never propagate a corrupt file anywhere

  let outcome
  if (currentSha === receipt.postimageSha256) {
    // CASE A: no credential mutation since migration — mechanical layout restore.
    outcome = { outcome: 'rollback_case_a_layout_restored', generation: 'unchanged', sha256: currentSha }
  } else {
    // CASE B: credential state advanced (create/rotate/...) — move the CURRENT
    // authoritative generation back; the stale preimage is never restored.
    outcome = {
      outcome: 'rollback_case_b_current_generation_preserved',
      generation: 'advanced',
      sha256: currentSha,
      migratedGenerationSha256: receipt.postimageSha256,
    }
  }
  atomicReplaceWithRealFile({ pinnedStore, zoneStore })
  unlinkSync(zoneStore)
  return outcome
}

function atomicReplaceWithRealFile({ pinnedStore, zoneStore }) {
  // Keep the broker face continuously readable: write a 0600 real file at a
  // temp name in the pinned parent, then rename over the symlink (atomic).
  const bytes = readFileSync(zoneStore)
  const zoneStat = lstatSync(zoneStore)
  const tempFile = `${pinnedStore}.rollback-${process.pid}`
  writeFileSync(tempFile, bytes, { mode: 0o600 })
  chownSync(tempFile, zoneStat.uid, zoneStat.gid)
  renameSync(tempFile, pinnedStore)
}
