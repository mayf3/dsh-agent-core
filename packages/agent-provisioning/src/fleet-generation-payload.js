// Read-only exact payload comparison. Only scratch extraction is written; the
// generation, peer links, package and installed stamps are never changed.
import { lstatSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const archivePayloads = new Map()
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

export function payloadDigest(root, ownerUid) {
  const files = []
  const directories = []
  function visit(relative = '') {
    for (const name of readdirSync(join(root, relative)).sort()) {
      const child = relative ? `${relative}/${name}` : name
      const path = join(root, child)
      const before = lstatSync(path)
      const mode = before.mode & 0o7777
      if ((mode & 0o022) || (ownerUid !== undefined && ![0, ownerUid].includes(before.uid))) throw Error('unprotected payload')
      if (before.isDirectory()) {
        directories.push([child, mode])
        visit(child)
      } else if (before.isFile() && before.nlink === 1) {
        const sha256 = digest(readFileSync(path))
        const after = lstatSync(path)
        if (before.ino !== after.ino || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw Error('payload changed during read')
        files.push([child, sha256, mode])
      } else throw Error('nonregular or linked payload')
    }
  }
  visit()
  files.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
  directories.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
  const dependencyFiles = files.filter(([path]) => path.startsWith('node_modules/'))
  const dependencyLines = dependencyFiles.map(([path, sha256, mode]) => `${path.slice('node_modules/'.length)}\0${sha256}\0${mode & 0o111 ? '755' : '644'}\n`)
  return { digest: digest(JSON.stringify({ files, directories })),
    dependencyDigest: digest(dependencyLines.join('')), dependencyFileCount: dependencyFiles.length }
}

export function releasedPayloadDigest(archive) {
  // Caller checks this exact hash against the accepted authority before entry.
  const key = digest(readFileSync(archive))
  if (archivePayloads.has(key)) return archivePayloads.get(key)
  const scratch = mkdtempSync(join(tmpdir(), 'fleet-generation-archive-'))
  try {
    const unpack = spawnSync('/usr/bin/tar', ['-xzf', archive, '-C', scratch], { encoding: 'utf8' })
    if (unpack.status !== 0) throw Error('released archive extraction failed')
    const result = payloadDigest(join(scratch, 'package')).digest
    archivePayloads.set(key, result)
    return result
  } finally { rmSync(scratch, { recursive: true, force: true }) }
}
