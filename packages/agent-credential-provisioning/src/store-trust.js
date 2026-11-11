/**
 * @agent-core/agent-credential-provisioning/src/store-trust.js — the
 * trusted-credential-store metadata vocabulary shared by the store writer and
 * the reader-owner face (extracted from store-writer.js under
 * CODE_STRUCTURE_GUARDRAILS_V1 §6; no behavior change).
 *
 * `storeError` is THE refusal family: every trust violation refuses loud with
 * the CREDENTIALS_STORE_ERROR code so callers fail closed.
 */

import { CREDENTIALS_STORE_ERROR } from '../../broker/src/credential-store.js'
import { chmod, chown, lstat, mkdir, open, rm } from 'node:fs/promises'

export const PRIVATE_DIRECTORY_MODE = 0o700
export const PRIVATE_FILE_MODE = 0o600

export const defaultFileSystem = Object.freeze({ chmod, chown, lstat, mkdir, open, rm })

export function storeError(message) {
  return Object.assign(new Error(message), { code: CREDENTIALS_STORE_ERROR })
}

export function assertMetadata(stat, { kind, path, mode, owner }) {
  const typeOk = kind === 'directory' ? stat.isDirectory() : stat.isFile()
  if (!typeOk || stat.isSymbolicLink() || (kind === 'file' && stat.nlink !== 1)) {
    throw storeError(`credential provisioning: ${kind} must be a non-symlink single-link ${kind}: ${path}`)
  }
  if ((stat.mode & 0o7777) !== mode) {
    throw storeError(`credential provisioning: ${kind} has unsafe mode: ${path}`)
  }
  if (stat.uid !== owner.uid || stat.gid !== owner.gid) {
    throw storeError(`credential provisioning: ${kind} has untrusted owner: ${path}`)
  }
}

export function sameObject(left, right) {
  return left.dev === right.dev && left.ino === right.ino
}

export function assertSameObject(actual, expected, kind, path) {
  if (!sameObject(actual, expected)) {
    throw storeError(`credential provisioning: ${kind} changed during trusted operation: ${path}`)
  }
}
