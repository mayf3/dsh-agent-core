import { execFileSync } from 'node:child_process'
import { lstatSync } from 'node:fs'

const PLATFORM_XATTRS = new Set(['com.apple.provenance', 'com.apple.rootless'])

export function hasUnsupportedFileXattrs(path) {
  if (process.platform !== 'darwin') return false
  return execFileSync('/usr/bin/xattr', [path], { encoding: 'utf8' }).trim().split('\n')
    .filter(Boolean).some((name) => !PLATFORM_XATTRS.has(name))
}

export function capturePlainFileMetadata(path) {
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new TypeError(`protected preimage is not a regular file: ${path}`)
  const acl = process.platform === 'darwin' ? execFileSync('/bin/ls', ['-lde', path], { encoding: 'utf8' }).split('\n')[0] : ''
  if (/^\S+\+/.test(acl) || hasUnsupportedFileXattrs(path)) throw new TypeError(`protected preimage ACL/xattrs are unsupported: ${path}`)
  return { uid: stat.uid, gid: stat.gid, mode: stat.mode & 0o777, acl: 'NONE', xattrs: 'NONE' }
}

export function clearGeneratedFileXattrs(path) {
  if (process.platform === 'darwin') execFileSync('/usr/bin/xattr', ['-c', path])
}
