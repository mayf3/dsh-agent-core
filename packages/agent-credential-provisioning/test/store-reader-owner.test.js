import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import {
  chmod, copyFile, link, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, unlink, writeFile,
} from 'node:fs/promises'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import * as fileSystem from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { finalizeReaderOwnedRestore } from '../src/store-reader-owner.js'
import { executeRotation, evaluateSeamGate, hashMachineSecret, ROTATION_OUTCOMES } from '../src/rotation-seam.js'
import {
  preflightTrustedCredentialDirectory,
  readCredentialStoreDocument,
  replaceCredentialForAgent,
  writeCredentialForAgent,
} from '../src/store-writer.js'

// ── SHARED_READER_OWNER face (Product #552 corrected contract) ────────────
// The shared openai-codex store's READER is a different account than the
// rotating writer channel; the committed store must finally be owned by the
// reader at mode 0600 (the dsh-codex reader strict-checks both) and a failed
// ownership finalization must fail closed on the preimage. The harness uses
// the process's own uid/gid as the reader so real chown(2) calls stay legal
// without root; the root-writer path itself is exercised via the injectable
// identity. This suite moved here from store-writer.test.js (plus the
// restore-candidate no-follow and seam split-state cases) under
// CODE_STRUCTURE_GUARDRAILS_V1 §6 — the touched legacy files may not grow.

const opaque = () => randomBytes(32).toString('base64url')
const rootIdentity = Object.freeze({ getuid: () => 0, getgid: () => 0 })
const readerOwnerOptions = () => ({
  readerOwner: { uid: process.getuid(), gid: process.getgid() },
  identity: rootIdentity,
})

async function fixture(t, document) {
  const directory = await mkdtemp(join(tmpdir(), 'agent-credential-reader-owner-'))
  const file = join(directory, 'credentials.json')
  t.after(async () => { await rm(directory, { recursive: true, force: true }) })
  if (document !== undefined) await writeFile(file, `${JSON.stringify(document)}\n`, { mode: 0o600 })
  return { directory, file }
}

function assertContainsExactBytes(haystack, needles) {
  for (const needle of needles) {
    assert.notEqual(haystack.indexOf(Buffer.from(needle)), -1, `missing byte-identical slice: ${needle}`)
  }
}

test('SHARED_READER_OWNER: root rotation replaces the entry and finalizes reader-owned 0600', async (t) => {
  const otherSecret = opaque()
  const { directory, file } = await fixture(t, {
    version: 1,
    credentials: {
      agt_other: { clientId: 'mc_other', clientSecret: otherSecret },
      agt_target: { clientId: 'mc_target', clientSecret: opaque() },
    },
  })
  const nextSecret = opaque()
  await replaceCredentialForAgent(file, 'agt_target', { clientId: 'mc_target', clientSecret: nextSecret }, readerOwnerOptions())

  const raw = await readFile(file, 'utf8')
  const document = JSON.parse(raw)
  assert.equal(document.credentials.agt_target.clientSecret, nextSecret)
  assert.equal(document.credentials.agt_target.clientId, 'mc_target')
  assertContainsExactBytes(raw, [JSON.stringify({ clientId: 'mc_other', clientSecret: otherSecret })])

  const reader = process.getuid()
  const fileStat = await stat(file)
  assert.equal(fileStat.mode & 0o7777, 0o600, 'final store mode is exactly 0600 — no group/other/special bits')
  assert.equal(fileStat.uid, reader, 'final store owner is the reader uid')
  assert.equal(fileStat.gid, process.getgid(), 'final store group is the reader group')
  const dirStat = await stat(directory)
  assert.equal(dirStat.mode & 0o7777, 0o700, 'shared directory stays exactly 0700 — traversal never widened')
  assert.equal(dirStat.uid, reader)
  assert.deepEqual(await readdir(directory), [join(file).slice(directory.length + 1)], 'no temp or lock leftovers')
})

test('SHARED_READER_OWNER directory contract: fresh create reader-owned; root-owned leftover adopted; foreign owner refused untouched', async (t) => {
  // (1) fresh shared directory is created reader-owned 0700 by the root face.
  const { directory } = await fixture(t, undefined)
  const freshDirectory = join(directory, 'shared-openai-codex')
  const freshFile = join(freshDirectory, 'credentials.json')
  await writeCredentialForAgent(freshFile, 'agt_target', { clientId: 'mc_target', clientSecret: opaque() }, readerOwnerOptions())
  const freshStat = await stat(freshDirectory)
  assert.equal(freshStat.mode & 0o7777, 0o700)
  assert.equal(freshStat.uid, process.getuid(), 'created directory lands reader-owned')

  // (2) a root-owned leftover directory (this channel's own artifact) is
  // adopted to the reader before the trust assertion.
  const operations = []
  const rootOwnedStat = {
    dev: 10, ino: 20, mode: 0o40700, uid: 0, gid: 0,
    isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false,
  }
  const adoptionFileSystem = {
    async lstat(path) { operations.push(`lstat:${path}`); return rootOwnedStat },
    async chown(path, uid, gid) { operations.push(`chown:${uid}:${gid}`); rootOwnedStat.uid = uid; rootOwnedStat.gid = gid },
    async chmod(path, mode) { operations.push(`chmod:${mode.toString(8)}`) },
    async open(path) {
      operations.push(`open:${path}`)
      return { stat: async () => ({ ...rootOwnedStat }), close: async () => {} }
    },
  }
  const result = await preflightTrustedCredentialDirectory('/shared/credentials.json', {
    ...readerOwnerOptions(),
    fileSystem: adoptionFileSystem,
  })
  assert.deepEqual(result.owner, { uid: process.getuid(), gid: process.getgid(), writerUid: 0 })
  assert.deepEqual(operations, [
    'lstat:/shared',
    `chown:${process.getuid()}:${process.getgid()}`,
    'chmod:700',
    'lstat:/shared',
    'open:/shared',
  ])

  // (3) a foreign-owned directory refuses loud with ZERO mutation (fail
  // closed on ownership the channel does not own).
  const foreignStat = { ...rootOwnedStat, uid: 999, gid: 999 }
  const refusedOperations = []
  const foreignFileSystem = {
    async lstat() { refusedOperations.push('lstat'); return foreignStat },
    async chown() { refusedOperations.push('chown'); return assert.fail('foreign directory must not be mutated') },
    async chmod() { refusedOperations.push('chmod'); return assert.fail('foreign directory must not be mutated') },
    async open() { refusedOperations.push('open'); return assert.fail('foreign directory must not be opened') },
  }
  await assert.rejects(
    preflightTrustedCredentialDirectory('/shared/credentials.json', {
      ...readerOwnerOptions(),
      fileSystem: foreignFileSystem,
    }),
    /has untrusted owner/,
  )
  assert.deepEqual(refusedOperations, ['lstat'], 'refusal mutates nothing')
})

test('SHARED_READER_OWNER: failed temp chown fails closed on the preimage with zero leftovers', async (t) => {
  const originalSecret = opaque()
  const { directory, file } = await fixture(t, {
    version: 1,
    credentials: { agt_target: { clientId: 'mc_target', clientSecret: originalSecret } },
  })
  const original = await readFile(file)
  const injected = Object.assign(new Error('injected chown failure'), { code: 'EPERM' })
  let chownAttempts = 0
  const failingChownFileSystem = {
    ...fileSystem,
    async open(path, flags, mode) {
      const handle = await fileSystem.open(path, flags, mode)
      if (!String(path).includes('.tmp-')) return handle
      return new Proxy(handle, {
        get(target, prop, receiver) {
          if (prop === 'chown') {
            return async (...args) => {
              chownAttempts += 1
              throw injected
            }
          }
          const value = Reflect.get(target, prop, target)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
    },
  }
  await assert.rejects(
    replaceCredentialForAgent(file, 'agt_target', { clientId: 'mc_target', clientSecret: opaque() }, {
      ...readerOwnerOptions(),
      fileSystem: failingChownFileSystem,
    }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  // Discriminator: the refusal is the CHOWN failure on the temp finalization
  // (attempted exactly once — the reader face reached the temp), not an
  // earlier validation refusal, which would attempt zero chowns.
  assert.equal(chownAttempts, 1)
  assert.deepEqual(await readFile(file), original, 'preimage store bytes survive the failed finalization')
  const raw = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(raw.credentials.agt_target.clientSecret, originalSecret, 'rotation did not land')
  assert.deepEqual(await readdir(directory), [join(file).slice(directory.length + 1)], 'temp and lock cleaned up')
})

test('SHARED_READER_OWNER: idempotent repeated rotations keep the reader-owner contract', async (t) => {
  const { directory, file } = await fixture(t, {
    version: 1,
    credentials: { agt_target: { clientId: 'mc_target', clientSecret: opaque() } },
  })
  const first = opaque()
  const second = opaque()
  await replaceCredentialForAgent(file, 'agt_target', { clientId: 'mc_target', clientSecret: first }, readerOwnerOptions())
  await replaceCredentialForAgent(file, 'agt_target', { clientId: 'mc_target', clientSecret: second }, readerOwnerOptions())

  const document = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(document.credentials.agt_target.clientSecret, second, 'the newest generation is committed')
  const fileStat = await stat(file)
  assert.equal(fileStat.mode & 0o7777, 0o600)
  assert.equal(fileStat.uid, process.getuid())
  const dirStat = await stat(directory)
  assert.equal(dirStat.mode & 0o7777, 0o700)
  assert.deepEqual(await readdir(directory), [join(file).slice(directory.length + 1)], 'converges with zero leftovers')
})

test('SHARED_READER_OWNER validation: non-root writer, root reader, mixed owner options, malformed input all refuse pre-mutation', async (t) => {
  const { directory, file } = await fixture(t, undefined)
  const reader = { uid: process.getuid(), gid: process.getgid() }
  const refusals = [
    // A non-root channel can never finalize a foreign reader owner — it must
    // not fall back to a writer-owned write either.
    { options: { readerOwner: reader } },
    // A root-owned store is never trusted (same rule as the trusted-CP face).
    { options: { readerOwner: { uid: 0, gid: 0 }, identity: rootIdentity } },
    // The two owner faces are mutually exclusive.
    { options: { readerOwner: reader, ownerUid: reader.uid, ownerGid: reader.gid, identity: rootIdentity } },
    // Malformed reader identities.
    { options: { readerOwner: { uid: -1, gid: reader.gid }, identity: rootIdentity } },
    { options: { readerOwner: { uid: reader.uid }, identity: rootIdentity } },
    { options: { readerOwner: null, identity: rootIdentity } },
    { options: { readerOwner: { uid: 1.5, gid: reader.gid }, identity: rootIdentity } },
  ]
  for (const { options } of refusals) {
    await assert.rejects(
      writeCredentialForAgent(file, 'agt_target', { clientId: 'mc_target', clientSecret: opaque() }, options),
      { code: 'CREDENTIALS_STORE_ERROR' },
    )
  }
  // Every refusal happened before any store byte existed — no fallback write.
  assert.equal(await readdir(directory).then((names) => names.length), 0)

  // No exposure widening: an existing group-readable store is refused under
  // the reader face too — the face never relaxes the exact-mode contract.
  await writeFile(file, `${JSON.stringify({ version: 1, credentials: {} })}\n`, { mode: 0o640 })
  await assert.rejects(
    replaceCredentialForAgent(file, 'agt_target', { clientId: 'mc_target', clientSecret: opaque() }, readerOwnerOptions()),
    /unsafe mode/,
  )
  assert.equal((await stat(file)).mode & 0o777, 0o640, 'refused store left byte- and mode-untouched')
})

test('RESTORE_CANDIDATE finalization: the backup is re-owned through the pinned fd, never a path chown', async (t) => {
  // The restore candidate is finalized to the reader BEFORE any rename. The
  // pathname is predictable and the directory is reader-owned, so the reader
  // can swap it for a symlink: the ownership mutation must therefore be
  // fd-based (fchown) behind a no-follow open, with a no-follow lstat shape
  // check refusing BEFORE the first privileged call (review blocker
  // 4355526928) — never a path-based chown that symlinks could redirect.
  const readerOwner = { uid: process.getuid(), gid: process.getgid(), writerUid: 0 }
  const operations = []
  const backupStat = { dev: 7, ino: 9, mode: 0o100600, uid: 0, gid: 0, nlink: 1, isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }
  const recordingFileSystem = {
    async lstat(path) { operations.push(`lstat:${path}`); return backupStat },
    async open(path) {
      operations.push(`open:${path}`)
      return {
        stat: async () => { operations.push('fd:stat'); return { ...backupStat } },
        chown: async (uid, gid) => { operations.push(`fd:chown:${uid}:${gid}`); backupStat.uid = uid; backupStat.gid = gid },
        close: async () => { operations.push('close') },
      }
    },
  }
  const finalized = await finalizeReaderOwnedRestore('/shared/credentials.json.preimage.bak', readerOwner, { fileSystem: recordingFileSystem })
  assert.equal(finalized.uid, readerOwner.uid)
  assert.equal(finalized.gid, readerOwner.gid)
  assert.deepEqual(operations, [
    'lstat:/shared/credentials.json.preimage.bak',
    'open:/shared/credentials.json.preimage.bak',
    'fd:stat',
    `fd:chown:${readerOwner.uid}:${readerOwner.gid}`,
    'fd:stat',
    'lstat:/shared/credentials.json.preimage.bak',
    'close',
  ], 'no-follow shape check precedes the fd-pinned chown; no path-based chown exists')

  // A symlinked (or otherwise non-single-link-regular) candidate refuses at
  // the shape check — before open, before ANY privileged call.
  operations.length = 0
  const symlinkFileSystem = {
    ...recordingFileSystem,
    async lstat(path) { operations.push(`lstat:${path}`); return { ...backupStat, isSymbolicLink: () => true } },
  }
  await assert.rejects(
    finalizeReaderOwnedRestore('/shared/credentials.json.preimage.bak', readerOwner, { fileSystem: symlinkFileSystem }),
    /non-symlink single-link file/,
  )
  assert.deepEqual(operations, ['lstat:/shared/credentials.json.preimage.bak'], 'zero privileged calls on the symlink refusal')

  // A failed fchown refuses in the CREDENTIALS_STORE_ERROR family — the
  // caller's recovery then receipts instead of committing an unownable store.
  await assert.rejects(
    finalizeReaderOwnedRestore('/shared/credentials.json.preimage.bak', readerOwner, {
      fileSystem: {
        async lstat() { return backupStat },
        async open() {
          return { stat: async () => ({ ...backupStat }), chown: async () => { throw Object.assign(new Error('EPERM'), { code: 'EPERM' }) }, close: async () => {} }
        },
      },
    }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  // A post-chown fd stat that still disagrees with the reader refuses loud.
  const rootOwnedBackup = { dev: 7, ino: 9, mode: 0o100600, uid: 0, gid: 0, nlink: 1, isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false }
  await assert.rejects(
    finalizeReaderOwnedRestore('/shared/credentials.json.preimage.bak', readerOwner, {
      fileSystem: {
        async lstat() { return rootOwnedBackup },
        async open() {
          return { stat: async () => ({ ...rootOwnedBackup }), chown: async () => {}, close: async () => {} }
        },
      },
    }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
  // A post-chown PATH swap (dev/ino no longer the pinned fd's object) refuses.
  let chownDone = false
  await assert.rejects(
    finalizeReaderOwnedRestore('/shared/credentials.json.preimage.bak', readerOwner, {
      fileSystem: {
        async lstat() { return chownDone ? { ...backupStat, ino: 424242 } : backupStat },
        async open() {
          return {
            stat: async () => ({ ...backupStat, uid: readerOwner.uid, gid: readerOwner.gid }),
            chown: async () => { chownDone = true },
            close: async () => {},
          }
        },
      },
    }),
    /restore candidate changed during trusted operation/,
  )
  // The helper is the root channel's face only.
  await assert.rejects(
    finalizeReaderOwnedRestore('/shared/credentials.json.preimage.bak', { uid: 1, gid: 2, writerUid: 1 }),
    { code: 'CREDENTIALS_STORE_ERROR' },
  )
})

test('RESTORE_CANDIDATE on the real fs: symlink, directory, and hardlinked candidates refuse with the target untouched', async (t) => {
  const { directory } = await fixture(t, undefined)
  const readerOwner = { uid: process.getuid(), gid: process.getgid(), writerUid: 0 }
  const backupFile = join(directory, 'credentials.json.preimage-op.bak')

  // Symlink at the predictable backup pathname: the escalated chown must
  // never reach the symlink's TARGET — the refusal fires on the lstat shape.
  const outside = join(directory, 'outside-sentinel.json')
  const outsideBytes = Buffer.from('{"sentinel":"must-never-be-reowned"}\n')
  await writeFile(outside, outsideBytes, { mode: 0o600 })
  await symlink(outside, backupFile)
  await assert.rejects(
    finalizeReaderOwnedRestore(backupFile, readerOwner),
    /non-symlink single-link file/,
  )
  assert.deepEqual(await readFile(outside), outsideBytes, 'the symlink target is untouched')
  await unlink(backupFile)

  // A directory at the candidate path refuses the same way.
  await mkdir(backupFile, { mode: 0o700 })
  await assert.rejects(
    finalizeReaderOwnedRestore(backupFile, readerOwner),
    /non-symlink single-link file/,
  )
  await rm(backupFile, { recursive: true, force: true })

  // A hardlinked candidate refuses: re-owning it would mutate the shared inode.
  const linked = join(directory, 'credentials.json')
  await writeFile(linked, `${JSON.stringify({ version: 1, credentials: {} })}\n`, { mode: 0o600 })
  await link(linked, backupFile)
  await assert.rejects(
    finalizeReaderOwnedRestore(backupFile, readerOwner),
    /non-symlink single-link file/,
  )
  await unlink(backupFile)

  // And the happy path on the real fs: a genuine single-link backup copy is
  // finalized to the reader (here: the process identity) at exactly 0600.
  await copyFile(linked, backupFile)
  await chmod(backupFile, 0o600)
  const finalized = await finalizeReaderOwnedRestore(backupFile, readerOwner)
  assert.equal(finalized.uid, process.getuid())
  assert.equal(finalized.gid, process.getgid())
  const onDisk = await stat(backupFile)
  assert.equal(onDisk.mode & 0o7777, 0o600, 'the finalized candidate is exactly 0600')
  assert.equal(onDisk.uid, process.getuid())
})

// ── T13c: the seam must not receipt ROLLED_BACK on an unproven restore ────

const AGENT = 'agt_rotation-fixture-agent'
const CLIENT = 'mc_rotation_fixture_client'
const INITIAL_SECRET = 'initial-secret-material-0123456789abcdef'

function seamFixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'store-reader-owner-seam-'))
  const storeFile = join(dir, 'credentials.json')
  const receiptsFile = join(dir, 'rotation-receipts.jsonl')
  writeFileSync(storeFile, JSON.stringify({
    version: 1,
    credentials: { [AGENT]: { clientId: CLIENT, clientSecret: INITIAL_SECRET } },
  }), { mode: 0o600 })
  const db = {
    state: { clientId: CLIENT, secretHash: hashMachineSecret(INITIAL_SECRET, 'aabbccdd00112233') },
    applyCalls: 0,
    rollbackCalls: 0,
  }
  const channels = {
    readDbState: async () => ({ ...db.state }),
    applyDbRotation: async ({ clientId: c, newSecretHash }) => {
      db.applyCalls += 1
      db.state = { clientId: c, secretHash: newSecretHash }
    },
    rollbackDbRotation: async () => {
      db.rollbackCalls += 1
      db.state = { clientId: CLIENT, secretHash: hashMachineSecret(INITIAL_SECRET, 'aabbccdd00112233') }
    },
  }
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return { dir, storeFile, receiptsFile, db, channels }
}

function ledgerLines(receiptsFile) {
  const raw = readFileSync(receiptsFile, 'utf8').trim()
  return raw === '' ? [] : raw.split('\n').map((l) => JSON.parse(l))
}

test('T13c: restore-finalization failure after a proven DB rollback receipts SPLIT_STATE_OPEN — never ROLLED_BACK', async (t) => {
  const fx = seamFixture(t)
  // The swap commits (rename) and THEN fails — the store carries the NEW
  // generation while recovery begins. The DB rolls back cleanly, but the
  // restore's reader-owned finalization of the preimage backup is injected to
  // fail: the store restore is never proven, so the honest receipt is
  // SPLIT_STATE_OPEN even though the DB half succeeded (review blocker
  // 4355526935 — ROLLED_BACK would claim a preimage store that never landed).
  const failingRestoreFs = {
    ...fileSystem,
    async open(path, flags, mode) {
      const handle = await fileSystem.open(path, flags, mode)
      if (!String(path).endsWith('.bak')) return handle
      return new Proxy(handle, {
        get(target, prop) {
          if (prop === 'chown') {
            return async () => { throw Object.assign(new Error('injected restore finalization failure'), { code: 'EPERM' }) }
          }
          const value = Reflect.get(target, prop)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
    },
  }
  let threw
  try {
    await executeRotation({
      agentId: AGENT, clientId: CLIENT, storeFile: fx.storeFile, receiptsFile: fx.receiptsFile,
      ...fx.channels,
      mintVerify: async () => ({ ok: true, status: 200 }),
      realAuthCallVerify: async () => ({ ok: true, detail: 'pass' }),
      storeWriteOptions: {
        ...readerOwnerOptions(),
        fileSystem: failingRestoreFs,
        afterRename: async () => { throw Object.assign(new Error('injected post-rename swap failure'), { code: 'CREDENTIALS_STORE_ERROR' }) },
      },
    })
  } catch (error) { threw = error }

  assert.equal(threw?.code, 'split_state_open', `got ${threw?.code}: ${threw?.message}`)
  assert.equal(fx.db.rollbackCalls, 1, 'the DB half of the recovery DID run and succeed')
  assert.equal(fx.db.state.secretHash, hashMachineSecret(INITIAL_SECRET, 'aabbccdd00112233'), 'DB is back at the preimage')
  const storeGeneration = JSON.parse(readFileSync(fx.storeFile, 'utf8')).credentials[AGENT].clientSecret
  assert.notEqual(storeGeneration, INITIAL_SECRET, 'the store still carries the NEW generation — the restore never landed')
  const storeStat = statSync(fx.storeFile)
  assert.equal(storeStat.mode & 0o7777, 0o600, 'the committed store keeps its exact 0600 mode')
  assert.equal(storeStat.uid, process.getuid(), 'the committed store keeps its reader owner')

  const outcomes = ledgerLines(fx.receiptsFile).map((r) => r.outcome)
  assert.ok(outcomes.includes(ROTATION_OUTCOMES.SPLIT_STATE_OPEN), `split receipted: ${outcomes.join(',')}`)
  assert.ok(!outcomes.includes(ROTATION_OUTCOMES.ROLLED_BACK), 'ROLLED_BACK is never claimed for an unproven restore')
  const split = ledgerLines(fx.receiptsFile).find((r) => r.outcome === ROTATION_OUTCOMES.SPLIT_STATE_OPEN)
  assert.match(split.reason, /restore incomplete/, 'the receipt names the failed half')
  assert.match(split.reason, /NEW generation/, 'the receipt names the inverted split direction')
  assert.equal(split.recovery.available, true, 'the preimage backup artifact is still recorded as recoverable')

  // The inherited gate refuses further seam contact until reconciliation.
  const gate = evaluateSeamGate({
    dbSecretHash: fx.db.state.secretHash,
    storeSecret: storeGeneration,
    receipts: ledgerLines(fx.receiptsFile),
  })
  assert.equal(gate.ok, false)
  assert.equal(gate.code, 'unreconciled_rotation')
})
