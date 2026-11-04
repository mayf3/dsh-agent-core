import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const materializer = join(here, 'materialize-darwin-x64.mjs')
const manifest = join(here, 'darwin-x64/SEEDS.json')

test('R67 seed materializer fails closed when any seed tarball is missing', () => {
  const root = mkdtempSync(join(tmpdir(), 'r67-seed-missing-'))
  try {
    const seedDir = join(root, 'seeds'); const pnpmRoot = join(root, 'pnpm')
    mkdirSync(seedDir, { recursive: true }); mkdirSync(pnpmRoot, { recursive: true }); cpSync(manifest, join(seedDir, 'SEEDS.json'))
    const result = spawnSync(process.execPath, [materializer, seedDir, pnpmRoot], { encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout}\n${result.stderr}`, /R67 seed missing|ENOENT/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('R67 seed manifest itself is not silently replaced by a hand patch', () => {
  const root = mkdtempSync(join(tmpdir(), 'r67-seed-manifest-'))
  try {
    const seedDir = join(root, 'seeds'); const pnpmRoot = join(root, 'pnpm')
    mkdirSync(seedDir, { recursive: true }); mkdirSync(pnpmRoot, { recursive: true })
    writeFileSync(join(seedDir, 'SEEDS.json'), JSON.stringify({ schema: 'R67_PNPM_DARWIN_X64_SEED_V1', platform: 'darwin', arch: 'x64', seeds: [] }))
    const result = spawnSync(process.execPath, [materializer, seedDir, pnpmRoot], { encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout}\n${result.stderr}`, /exactly 20 darwin-x64 seeds/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
