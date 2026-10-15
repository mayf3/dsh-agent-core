import { closeSync, constants, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute } from 'node:path'
import { randomUUID } from 'node:crypto'

export function privateDirectory(path) {
  if (!isAbsolute(path)) throw new Error('absolute private storage path required')
  mkdirSync(path, { recursive: true, mode: 0o700 })
  const stat = lstatSync(path)
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()) throw new Error('private storage ownership/mode invalid')
}

export function readPrivateJson(path, maxBytes = 64 * 1024 * 1024) {
  if (!existsSync(path)) return null
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0 || stat.size > maxBytes) throw new Error('private storage invalid')
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try { return JSON.parse(readFileSync(fd, 'utf8')) } finally { closeSync(fd) }
}

export function atomicPrivateJson(path, value) {
  privateDirectory(dirname(path))
  if (existsSync(path)) readPrivateJson(path)
  const serialized = JSON.stringify(value) + '\n'
  if (Buffer.byteLength(serialized,'utf8') > 64 * 1024 * 1024) throw Object.assign(new Error('private storage capacity exceeded'),{className:'RESOURCE_LIMIT',httpStatus:429})
  const temp = path + '.tmp-' + randomUUID()
  let fd
  try {
    fd = openSync(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600)
    writeFileSync(fd, serialized, 'utf8')
    fsyncSync(fd)
    closeSync(fd)
    fd = undefined
    renameSync(temp, path)
    const dir = openSync(dirname(path), constants.O_RDONLY)
    try { fsyncSync(dir) } finally { closeSync(dir) }
  } finally {
    if (fd !== undefined) closeSync(fd)
    try { unlinkSync(temp) } catch { /* already renamed */ }
  }
}

export function lockedPrivateMutation(path, mutate) {
  privateDirectory(dirname(path))
  const lock = path + '.lock'
  let fd
  try {
    fd = openSync(lock, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600)
    writeFileSync(fd, JSON.stringify({ pid: process.pid }), 'utf8')
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    const owner = readPrivateJson(lock, 1024)
    if (!Number.isSafeInteger(owner?.pid) || owner.pid <= 0) throw new Error('storage lock unavailable')
    try { process.kill(owner.pid, 0) } catch (cause) {
      if (cause.code !== 'ESRCH') throw new Error('storage lock unavailable')
      unlinkSync(lock)
      return lockedPrivateMutation(path, mutate)
    }
    throw new Error('storage lock busy')
  }
  try { return mutate() } finally { closeSync(fd); unlinkSync(lock) }
}
