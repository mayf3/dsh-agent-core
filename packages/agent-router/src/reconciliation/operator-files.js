/** Offline candidate IO only. The live recovery file is never a write target. */
import { createHash } from 'node:crypto'
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const digest = bytes => createHash('sha256').update(bytes).digest('hex')
export function refuse(code) { throw Object.assign(new Error(code), { code }) }

export function privateFile(path, unavailable = 'UNSAFE_FILE') {
  let fd
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    const stat = fstatSync(fd)
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 134217728
        || (stat.mode & 0o022) !== 0) refuse('UNSAFE_FILE')
    return { bytes: readFileSync(fd), stat }
  } catch (error) {
    if (error.code === 'UNSAFE_FILE') throw error
    refuse(unavailable)
  } finally { if (fd !== undefined) closeSync(fd) }
}

export function assertAbsent(path) {
  try { lstatSync(path); refuse('OUTPUT_EXISTS') } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

export function writeNewDurable(path, bytes) {
  const fd = openSync(path, 'wx', 0o600)
  try { writeFileSync(fd, bytes); fsyncSync(fd) } finally { closeSync(fd) }
  const dir = openSync(dirname(path), 'r')
  try { fsyncSync(dir) } finally { closeSync(dir) }
}
