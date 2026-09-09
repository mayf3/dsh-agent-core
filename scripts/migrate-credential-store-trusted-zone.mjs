#!/usr/bin/env node
// migrate-credential-store-trusted-zone.mjs — ONE-TIME deployment migration
// that lands the production credential store into an accepted-Part-G trusted
// zone (AGENT_CORE_CANONICAL_ONBOARDING_COMPLETION_V1 §4) WITHOUT touching any
// consumer:
//
//   /usr/local/libexec/agent-core/credential-store/                      (0700, authsvc-owned)
//   /usr/local/libexec/agent-core/credential-store/agent-credentials.json (0600, authsvc-owned, REAL file)
//   /usr/local/libexec/agent-core/config/agent-credentials.json          → RELATIVE SYMLINK to the real file
//
// Semantics-preserving: the accepted store-writer keeps requiring a 0700
// trusted-owner parent (provisioning always uses the REAL path); the broker
// gateway keeps reading the pinned path per call (plain readFileSync follows
// the symlink); the LaunchDaemon plist binding and the pinned-executor path
// checks are unchanged; no restart required.
//
// Modes:
//   (no flag)   dry-run: print the plan and current state, zero mutation
//   --apply     perform the migration (root only; preimage-backed; atomic)
//   --status    read-only layout report
// Re-running after a successful migration is a NOOP (detected via symlink).

import { createHash } from 'node:crypto'
import {
  chownSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync,
  readlinkSync, renameSync, statSync, symlinkSync, writeFileSync,
} from 'node:fs'

import {
  preflightTrustedCredentialDirectory,
  readCredentialStoreDocument,
} from '../packages/agent-credential-provisioning/src/store-writer.js'

const PINNED_STORE = '/usr/local/libexec/agent-core/config/agent-credentials.json'
const ZONE_DIR = '/usr/local/libexec/agent-core/credential-store'
const ZONE_STORE = '/usr/local/libexec/agent-core/credential-store/agent-credentials.json'
const RELATIVE_TARGET = '../credential-store/agent-credentials.json'
const PREIMAGE_DIR = '/Users/yanfenma/workspace/deployment-artifacts/canonical-onboarding-v1/preimages'
const RECEIPT_FILE = '/Users/yanfenma/workspace/deployment-artifacts/canonical-onboarding-v1/migration-receipt.json'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const statusOnly = args.includes('--status')

function report(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
}

function die(message, extra = {}) {
  report({ ok: false, fail_code: 'MIGRATION_FAILED', message, ...extra })
  process.exit(2)
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function lstatSafe(path) {
  try { return lstatSync(path) } catch { return undefined }
}

function currentLayout() {
  const st = lstatSafe(PINNED_STORE)
  if (st === undefined) return { pinned: 'absent', migrated: false }
  if (st.isSymbolicLink()) {
    let target
    try { target = readlinkSync(PINNED_STORE) } catch { /* unreadable link */ }
    return { pinned: 'symlink', target, realFile: ZONE_STORE, migrated: target === RELATIVE_TARGET }
  }
  const s = statSync(PINNED_STORE)
  return {
    pinned: 'file',
    mode: (s.mode & 0o7777).toString(8),
    ownerUid: s.uid,
    ownerGid: s.gid,
    bytes: s.size,
    migrated: false,
  }
}

function assertRoot() {
  if (process.getuid?.() !== 0) {
    die('ROOT_REQUIRED', { message: '--apply must run as root (the store is authsvc-owned; trusted-zone creation requires privileged chown)' })
  }
}

function verifyEndState(preimageBytes, owner) {
  // (a) broker face: pinned path reads through the symlink, bytes identical.
  const throughPinned = readFileSync(PINNED_STORE)
  if (!throughPinned.equals(preimageBytes)) die('POST_VERIFY_BYTES', 'pinned-path read-through does not match the preimage')
  JSON.parse(throughPinned.toString('utf8'))
  // (b) provisioning face: accepted library accepts the real path.
  preflightTrustedCredentialDirectory(ZONE_STORE, { ownerUid: owner.uid, ownerGid: owner.gid })
  const document = readFileSync(ZONE_STORE, 'utf8')
  const parsed = JSON.parse(document)
  if (parsed?.version !== 1 || typeof parsed.credentials !== 'object') die('POST_VERIFY_SHAPE', 'real store fails V1 shape')
  // (c) layout metadata.
  const link = lstatSync(PINNED_STORE)
  if (!link.isSymbolicLink()) die('POST_VERIFY_LINK', 'pinned path is not a symlink')
  if (readlinkSync(PINNED_STORE) !== RELATIVE_TARGET) die('POST_VERIFY_TARGET', `unexpected link target`)
  const real = lstatSync(ZONE_STORE)
  if (real.isSymbolicLink() || (real.mode & 0o7777) !== 0o600) die('POST_VERIFY_REAL', 'real store is not a 0600 regular file')
  const dir = lstatSync(ZONE_DIR)
  if ((dir.mode & 0o7777) !== 0o700) die('POST_VERIFY_DIR', 'trusted zone is not 0700')
  return {
    pinnedReadThrough: 'ok',
    libraryPreflight: 'ok',
    entryCount: Object.keys(parsed.credentials).length,
    linkTarget: RELATIVE_TARGET,
    realStore: { mode: '0600', ownerUid: real.uid, ownerGid: real.gid },
    zone: { mode: '0700', ownerUid: dir.uid, ownerGid: dir.gid },
  }
}

function main() {
  const layout = currentLayout()
  if (statusOnly) {
    report({ ok: true, mode: 'status', layout, zoneDirExists: existsSync(ZONE_DIR) })
    return
  }

  if (layout.migrated) {
    report({ ok: true, mode: apply ? 'apply' : 'dry-run', outcome: 'noop_already_migrated', layout })
    return
  }
  if (layout.pinned === 'absent') die('STORE_ABSENT', `pinned store not found: ${PINNED_STORE}`)
  if (layout.pinned !== 'file') die('UNEXPECTED_PINNED_STATE', 'pinned path is neither the plain file nor the expected symlink')

  const preimageBytes = readFileSync(PINNED_STORE)
  const preimageSha = sha256(preimageBytes)
  const preimageJson = JSON.parse(preimageBytes.toString('utf8'))
  const owner = { uid: layout.ownerUid, gid: layout.ownerGid }
  const plan = {
    preimage: { path: `${PREIMAGE_DIR}/agent-credentials.json.preimage`, sha256: preimageSha },
    zone: { dir: ZONE_DIR, mode: '0700', ownerUid: owner.uid, ownerGid: owner.gid },
    move: { from: PINNED_STORE, to: ZONE_STORE },
    symlink: { at: PINNED_STORE, target: RELATIVE_TARGET },
    entryCount: Object.keys(preimageJson.credentials ?? {}).length,
  }

  if (!apply) {
    report({ ok: true, mode: 'dry-run', plan, layout, note: 'no mutation performed; pass --apply (as root) to execute' })
    return
  }

  assertRoot()
  // Re-read owner from the live file at apply time (dry-run output may be stale).
  const live = statSync(PINNED_STORE)
  if ((live.mode & 0o7777) !== 0o600) die('UNSAFE_STORE_MODE', `pinned store mode is ${(live.mode & 0o7777).toString(8)}, expected 600`)
  owner.uid = live.uid
  owner.gid = live.gid
  if (owner.uid === 0) die('TRUSTED_OWNER_ROOT', 'the existing store is root-owned; a trusted Control Plane owner must exist first')

  // 1. preimage (bytes + digest recorded before anything moves)
  mkdirSync(PREIMAGE_DIR, { recursive: true })
  const preimagePath = `${PREIMAGE_DIR}/agent-credentials.json.preimage`
  copyFileSync(PINNED_STORE, preimagePath)
  writeFileSync(`${preimagePath}.sha256`, `${preimageSha}  agent-credentials.json.preimage\n`, { mode: 0o600 })

  // 2. trusted zone (0700, trusted CP owner) — created only if absent; a
  // pre-existing non-conforming zone fails loud instead of being "fixed".
  if (!existsSync(ZONE_DIR)) {
    mkdirSync(ZONE_DIR, { mode: 0o700 })
    chownSync(ZONE_DIR, owner.uid, owner.gid)
  }
  const zoneStat = lstatSync(ZONE_DIR)
  if (!zoneStat.isDirectory() || (zoneStat.mode & 0o7777) !== 0o700 || zoneStat.uid !== owner.uid || zoneStat.gid !== owner.gid) {
    die('ZONE_NOT_TRUSTED', `zone dir exists with non-conforming metadata: mode ${(zoneStat.mode & 0o7777).toString(8)} owner ${zoneStat.uid}:${zoneStat.gid}`)
  }

  // 3. move the real file into the zone (same filesystem → rename atomic;
  //    owner/mode preserved by rename).
  if (existsSync(ZONE_STORE)) die('ZONE_STORE_EXISTS', 'refusing to overwrite an existing file in the trusted zone')
  renameSync(PINNED_STORE, ZONE_STORE)

  // 4. symlink at the pinned path (temp + rename over = atomic replace).
  const tempLink = `${PINNED_STORE}.migrate-tmp-${process.pid}`
  symlinkSync(RELATIVE_TARGET, tempLink)
  renameSync(tempLink, PINNED_STORE)

  // 5. dual-face verification.
  const verified = verifyEndState(preimageBytes, owner)

  // 6. receipt.
  const receipt = {
    task: 'CANONICAL_ONBOARDING_COMPLETION_V1 trusted-zone migration',
    appliedAt: new Date().toISOString(),
    preimage: { path: preimagePath, sha256: preimageSha },
    owner,
    verified,
  }
  writeFileSync(RECEIPT_FILE, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 })
  report({ ok: true, mode: 'apply', outcome: 'migrated', receipt: RECEIPT_FILE, verified })
}

try {
  main()
} catch (error) {
  die(error?.message ?? String(error), { code: error?.code })
}
