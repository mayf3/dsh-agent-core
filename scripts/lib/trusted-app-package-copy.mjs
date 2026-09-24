#!/usr/bin/env node
/**
 * Copy one Agent Core package into the trusted app closure.
 *
 * The trusted app packs source packages, not their tests or development
 * node_modules. Runtime resolution therefore needs three tracked surfaces:
 * package.json, src/**, and exact package-root files referenced by main or
 * exports. This helper derives that closure from package metadata so adding a
 * new public root entry never requires another feature-specific installer edit.
 */

import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
} from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'

function fail(message) {
  process.stderr.write('trusted-app-package-copy: ' + message + '\n')
  process.exit(2)
}

const [sourceArg, destinationArg] = process.argv.slice(2)
if (!sourceArg || !destinationArg) {
  fail('usage: trusted-app-package-copy.mjs <source-package-dir> <destination-package-dir>')
}

const sourceRoot = resolve(sourceArg)
const destinationRoot = resolve(destinationArg)
const packageFile = resolve(sourceRoot, 'package.json')
if (!existsSync(packageFile)) fail('package.json missing under ' + sourceRoot)

let manifest
try {
  manifest = JSON.parse(readFileSync(packageFile, 'utf8'))
} catch (error) {
  fail('cannot parse ' + packageFile + ': ' + (error?.message ?? String(error)))
}

function collectStrings(value, out) {
  if (typeof value === 'string') {
    out.add(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out)
    return
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, out)
  }
}

function safeRelativeTarget(raw, sourceField) {
  if (typeof raw !== 'string' || raw.length === 0) return null
  if (raw.includes('*')) return null

  const normalized = raw.startsWith('./') ? raw.slice(2) : raw
  if (normalized.length === 0 || isAbsolute(normalized)) {
    fail(sourceField + ' contains unsafe package target ' + JSON.stringify(raw))
  }

  const source = resolve(sourceRoot, normalized)
  const rel = relative(sourceRoot, source)
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
    fail(sourceField + ' escapes package root: ' + JSON.stringify(raw))
  }
  return { rel, source }
}

mkdirSync(destinationRoot, { recursive: true })
copyFileSync(packageFile, resolve(destinationRoot, 'package.json'))

const sourceSrc = resolve(sourceRoot, 'src')
if (existsSync(sourceSrc)) {
  const stat = lstatSync(sourceSrc)
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('src must be a real directory: ' + sourceSrc)
  cpSync(sourceSrc, resolve(destinationRoot, 'src'), { recursive: true })
}

const declared = new Set()
if (typeof manifest.main === 'string') declared.add(manifest.main)
collectStrings(manifest.exports, declared)

const copiedRootEntries = []
for (const raw of [...declared].sort()) {
  const target = safeRelativeTarget(raw, raw === manifest.main ? 'main' : 'exports')
  if (target === null) continue
  if (target.rel === 'package.json' || target.rel.startsWith('src' + sep)) continue
  if (!existsSync(target.source)) fail('declared public target missing: ' + target.rel)

  const stat = lstatSync(target.source)
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail('declared public target must be a real file: ' + target.rel)
  }

  const destination = resolve(destinationRoot, target.rel)
  mkdirSync(dirname(destination), { recursive: true })
  copyFileSync(target.source, destination)
  copiedRootEntries.push(target.rel)
}

process.stdout.write(JSON.stringify({
  package: manifest.name ?? null,
  copiedRootEntries,
}) + '\n')
