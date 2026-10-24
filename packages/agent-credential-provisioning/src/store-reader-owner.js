/**
 * @agent-core/agent-credential-provisioning/src/store-reader-owner.js — the
 * shared-store READER-OWNER face (Product #552 corrected contract; extracted
 * from store-writer.js under CODE_STRUCTURE_GUARDRAILS_V1 §6).
 *
 * A shared store whose CONSUMER is a different account than the writer (the
 * fleet worker reads the shared openai-codex store; the rotating provisioning
 * channel runs cross-uid) must finally carry owner = reader + mode 0600 — the
 * dsh-codex reader strict-checks both. Only the root-driven privileged channel
 * may finalize that foreign ownership; this module owns the three face
 * operations: trust-face resolution, type-scoped directory adoption, and the
 * restore-candidate finalization.
 */

import { constants } from 'node:fs'

import { CREDENTIALS_STORE_ERROR } from '../../broker/src/credential-store.js'

import {
  PRIVATE_DIRECTORY_MODE, PRIVATE_FILE_MODE,
  assertMetadata, assertSameObject, defaultFileSystem, storeError,
} from './store-trust.js'

/**
 * Validate the shared-store reader-owner face: the final store file MUST carry
 * owner = reader + mode 0600, so the writer may not keep ownership. Only the
 * root-driven privileged channel can finalize a foreign reader owner; any
 * other writer shape refuses loud. Returns the reader identity (the store's
 * final owner) plus writerUid.
 */
export function sharedReaderOwner(readerOwner, { ownerUid, ownerGid, identity = process } = {}) {
  if (readerOwner === null || typeof readerOwner !== 'object'
    || !Number.isInteger(readerOwner.uid) || readerOwner.uid < 0
    || !Number.isInteger(readerOwner.gid) || readerOwner.gid < 0) {
    throw storeError('credential provisioning: readerOwner must supply a non-negative integer uid/gid pair')
  }
  if (ownerUid !== undefined || ownerGid !== undefined) {
    throw storeError('credential provisioning: readerOwner and ownerUid/ownerGid are mutually exclusive trust faces')
  }
  // A root-owned store is never trusted (same rule as the trusted-CP face);
  // the reader is a real consumer account.
  if (readerOwner.uid === 0) {
    throw storeError('credential provisioning: shared-store reader owner must not be root')
  }
  const writerUid = identity.getuid?.()
  if (writerUid !== 0) {
    throw storeError('credential provisioning: finalizing a shared-store reader owner requires the root provisioning channel')
  }
  return { uid: readerOwner.uid, gid: readerOwner.gid, writerUid }
}

/**
 * Shared-store reader face: a root-owned leftover directory is this privileged
 * channel's own artifact — converge it to the reader instead of failing. Any
 * OTHER foreign ownership is returned untouched and refuses loud in the
 * caller's trust assertion. Adoption is type-scoped to a real directory:
 * chown/chmod follow symlinks, so a root-owned symlink at the directory path
 * must fall through to that refusal, never mutate its resolved target.
 */
export async function adoptRootOwnedStoreDirectory(pathStat, directory, owner, fileSystem) {
  if (!(pathStat.uid === 0 && pathStat.isDirectory() && !pathStat.isSymbolicLink())) return pathStat
  try {
    await fileSystem.chown(directory, owner.uid, owner.gid)
    await fileSystem.chmod(directory, PRIVATE_DIRECTORY_MODE)
    return await fileSystem.lstat(directory)
  } catch {
    throw storeError(`credential provisioning: cannot hand off credential store directory: ${directory}`)
  }
}

/**
 * Finalize a RESTORE candidate (the rotation seam's preimage backup) to the
 * reader owner before it is renamed onto the store. The backup was copied by
 * the driver process — under the reader face that is the root channel — so
 * restoring it as-is would commit a channel-owned store that the reader cannot
 * open and that this face's own gate then refuses.
 *
 * The candidate pathname is PREDICTABLE (`*.preimage-<operationId>.bak`) and
 * lives in a directory the reader OWNS, so the reader can swap it for a
 * symlink at any moment and chown(2) follows symlinks: a path-based chown
 * could transfer ownership of an arbitrary target before any post-check
 * notices (PR #553 review blocker 4355526928). The candidate is therefore
 * validated via lstat WITHOUT following links and refused before the FIRST
 * privileged call, then opened O_NOFOLLOW and re-owned through the pinned fd
 * (fchown) — a path swap after validation can no longer redirect the
 * privileged ownership mutation. Post-chown, both the fd and the pathname are
 * verified to still be the same non-symlink single-link 0600 reader-owned
 * inode; ANY failure throws the CREDENTIALS_STORE_ERROR family so the caller's
 * recovery receipts the failure instead of committing an unownable store
 * (fail closed).
 */
export async function finalizeReaderOwnedRestore(file, owner, { fileSystem = defaultFileSystem } = {}) {
  if (owner?.writerUid !== 0) {
    throw storeError('credential provisioning: reader-owner restore finalization requires the root channel owner')
  }
  let handle
  try {
    const pathStat = await fileSystem.lstat(file)
    assertRestoreCandidateShape(pathStat, file)
    handle = await fileSystem.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
    const openedStat = await handle.stat()
    assertRestoreCandidateShape(openedStat, file)
    await handle.chown(owner.uid, owner.gid)
    const finalFdStat = await handle.stat()
    assertMetadata(finalFdStat, { kind: 'file', path: file, mode: PRIVATE_FILE_MODE, owner })
    const finalPathStat = await fileSystem.lstat(file)
    assertMetadata(finalPathStat, { kind: 'file', path: file, mode: PRIVATE_FILE_MODE, owner })
    assertSameObject(finalPathStat, finalFdStat, 'restore candidate', file)
    return finalFdStat
  } catch (error) {
    if (error?.code === CREDENTIALS_STORE_ERROR) throw error
    throw storeError(`credential provisioning: cannot finalize reader-owned restore candidate: ${file}`)
  } finally {
    await handle?.close().catch(() => {})
  }
}

function assertRestoreCandidateShape(stat, file) {
  if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1) {
    throw storeError(`credential provisioning: restore candidate must be a non-symlink single-link file: ${file}`)
  }
}
