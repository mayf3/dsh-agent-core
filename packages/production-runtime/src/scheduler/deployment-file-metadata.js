import { execFileSync } from 'node:child_process'
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'

const PLATFORM_XATTRS = new Set(['com.apple.provenance', 'com.apple.rootless'])
const hasExtendedAcl = (path) => process.platform === 'darwin'
  && /^\S+\+/.test(execFileSync('/bin/ls', ['-lde', path], { encoding: 'utf8' }).split('\n')[0] ?? '')

export function hasUnsupportedFileXattrs(path) {
  if (process.platform !== 'darwin') return false
  return execFileSync('/usr/bin/xattr', [path], { encoding: 'utf8' }).trim().split('\n')
    .filter(Boolean).some((name) => !PLATFORM_XATTRS.has(name))
}

export function capturePlainFileMetadata(path) {
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new TypeError(`protected preimage is not a regular file: ${path}`)
  if (hasExtendedAcl(path) || hasUnsupportedFileXattrs(path)) throw new TypeError(`protected preimage ACL/xattrs are unsupported: ${path}`)
  return { uid: stat.uid, gid: stat.gid, mode: stat.mode & 0o777, acl: 'NONE', xattrs: 'NONE' }
}

export function clearGeneratedFileXattrs(path) {
  if (process.platform === 'darwin') execFileSync('/usr/bin/xattr', ['-c', path])
}

export function readProtectedPlainFile(path, { boundary, expectedUid, expectedGid, mode }) {
  if (!isAbsolute(path) || resolve(path) !== path || !isAbsolute(boundary) || resolve(boundary) !== boundary) throw new TypeError('protected file path must be canonical and absolute')
  let current = dirname(path)
  for (;;) {
    const stat = lstatSync(current)
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== expectedUid
      || (stat.mode & 0o022) !== 0 || hasExtendedAcl(current) || hasUnsupportedFileXattrs(current)) throw new TypeError('protected file ancestor chain is unsafe')
    if (current === boundary) break
    const next = dirname(current)
    if (next === current || !current.startsWith(`${boundary}/`)) throw new TypeError('protected file is outside boundary')
    current = next
  }
  const before = lstatSync(path)
  capturePlainFileMetadata(path)
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const after = fstatSync(fd)
    if (!after.isFile() || before.dev !== after.dev || before.ino !== after.ino
      || after.uid !== expectedUid || after.gid !== expectedGid || (after.mode & 0o777) !== mode) {
      throw new TypeError('protected file identity or metadata mismatch')
    }
    return { bytes: readFileSync(fd), stat: after }
  } finally { closeSync(fd) }
}
