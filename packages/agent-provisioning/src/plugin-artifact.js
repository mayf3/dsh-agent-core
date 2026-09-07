import {
  existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, renameSync, rmSync, writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const INSTALLED_ARTIFACT_STAMP = '.agent-core-artifact-identity.json'

export function installedPluginVersion(packageFile) {
  if (!existsSync(packageFile)) return undefined
  try { return JSON.parse(readFileSync(packageFile, 'utf8')).version } catch { return null }
}

function exactObject(actual, expected) {
  return actual !== null && typeof actual === 'object'
    && Object.keys(actual).length === Object.keys(expected).length
    && Object.entries(expected).every(([key, value]) => actual[key] === value)
}

function entries(root, relative = '') {
  const result = []
  for (const name of readdirSync(join(root, relative)).sort()) {
    if (name === INSTALLED_ARTIFACT_STAMP) continue
    const child = join(relative, name)
    const stat = lstatSync(join(root, child))
    if (stat.isDirectory()) result.push(...entries(root, child))
    else if (stat.isSymbolicLink()) result.push([child, 'link', readlinkSync(join(root, child))])
    else if (stat.isFile()) result.push([child, 'file', createHash('sha256').update(readFileSync(join(root, child))).digest('hex')])
    else result.push([child, 'unsupported', null])
  }
  return result
}

/** Prove installed payload bytes are exactly the payload in the frozen npm artifact. */
export function installedArtifactMatches(installedRoot, packageArtifact, identity) {
  if (!existsSync(installedRoot)) return false
  if (packageArtifact === undefined) {
    try {
      return exactObject(JSON.parse(readFileSync(join(installedRoot, INSTALLED_ARTIFACT_STAMP), 'utf8')), identity)
    } catch {
      return false
    }
  }
  const scratch = mkdtempSync(join(tmpdir(), 'agent-core-plugin-artifact-'))
  try {
    const unpack = spawnSync('/usr/bin/tar', ['-xzf', packageArtifact, '-C', scratch], { encoding: 'utf8' })
    if (unpack.status !== 0 || !existsSync(join(scratch, 'package'))) return false
    return JSON.stringify(entries(installedRoot)) === JSON.stringify(entries(join(scratch, 'package')))
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

export function stampInstalledArtifact(installedRoot, identity) {
  const target = join(installedRoot, INSTALLED_ARTIFACT_STAMP)
  const temp = `${target}.tmp-${process.pid}`
  writeFileSync(temp, `${JSON.stringify(identity)}\n`, { mode: 0o444 })
  renameSync(temp, target)
}
