#!/usr/bin/env node
/** R67 offline darwin-x64 seed materializer. Fail closed on every seed gap. */
import { createHash } from 'node:crypto'
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const [seedDirArg, pnpmRootArg] = process.argv.slice(2)
if (!seedDirArg || !pnpmRootArg) {
  console.error('usage: materialize-darwin-x64.mjs SEED_DIR PNPM_ROOT')
  process.exit(2)
}
const seedDir = resolve(seedDirArg)
const pnpmRoot = resolve(pnpmRootArg)
const manifest = JSON.parse(readFileSync(join(seedDir, 'SEEDS.json'), 'utf8'))
if (manifest.schema !== 'R67_PNPM_DARWIN_X64_SEED_V1' || manifest.platform !== 'darwin' || manifest.arch !== 'x64'
    || !Array.isArray(manifest.seeds) || manifest.seeds.length !== 20) {
  throw new Error('R67 seed manifest is invalid or incomplete; expected exactly 20 darwin-x64 seeds')
}
function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}
function packageJson(seed) {
  const result = spawnSync('tar', ['-xOf', seed, 'package/package.json'], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`cannot read package.json from ${seed}: ${result.stderr.trim()}`)
  const pkg = JSON.parse(result.stdout)
  if (typeof pkg.name !== 'string' || typeof pkg.version !== 'string') throw new Error(`seed package metadata invalid: ${seed}`)
  return pkg
}
function bytes(path) {
  const info = statSync(path)
  if (info.isFile()) return info.size
  if (!info.isDirectory()) return 0
  return readdirSync(path).reduce((sum, entry) => sum + bytes(join(path, entry)), 0)
}
for (const row of manifest.seeds) {
  const seed = join(seedDir, row.file)
  if (!statSync(seed, { throwIfNoEntry: false })) throw new Error(`R67 seed missing: ${row.file}`)
  if (sha256(seed) !== row.sha256) throw new Error(`R67 seed SHA256 mismatch: ${row.file}`)
  const pkg = packageJson(seed)
  const encoded = `${pkg.name.replace('/', '+')}@${pkg.version}`
  const target = join(pnpmRoot, encoded, 'node_modules', pkg.name)
  if (!target.startsWith(`${pnpmRoot}/`) || !statSync(join(pnpmRoot, encoded), { throwIfNoEntry: false })) {
    throw new Error(`R67 pnpm stub target missing for ${pkg.name}@${pkg.version}: ${target}`)
  }
  const temp = mkdtempSync(join(tmpdir(), 'r67-seed-'))
  try {
    const extracted = spawnSync('tar', ['-xzf', seed, '-C', temp])
    if (extracted.status !== 0) throw new Error(`cannot extract seed: ${row.file}`)
    const source = join(temp, 'package')
    cpSync(source, target, { recursive: true, force: true })
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
  if (bytes(target) === 0) throw new Error(`R67 seed materialization remained empty: ${pkg.name}@${pkg.version}`)
  process.stdout.write(`MATERIALIZED ${pkg.name}@${pkg.version} ${bytes(target)} bytes\n`)
}
