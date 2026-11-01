#!/usr/bin/env node
/**
 * Reviewed administration config only; no environment path inference.
 * --config ABSOLUTE_JSON defaults to dry-run; --create-copy creates a NEW copy.
 * Config: {reviewed:true, sourceText:string, destination?:absolute, operations?:[]}
 * OR {reviewed:true, sourceRoot:absolute, sourceFile:absolute, ...}.
 * sourceRoot is the operator-reviewed owned task copy, never a production root.
 * sourceFile must be exactly sourceRoot/MEMORY.md. Fixed regular files only; no glob, symlink, session or credential discovery.
 */
import { constants } from 'node:fs'
import { open, lstat, realpath } from 'node:fs/promises'
import { isAbsolute, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMemoryDocument, planDocumentEdits } from './document.js'
import { createMigrationCopy } from './migration.js'

const SOURCE_LIMIT = 32 * 1024 * 1024
const CONFIG_LIMIT = 64 * 1024 * 1024
const within = (root, path) => {
  const part = relative(root, path)
  return part === '' || (part !== '..' && !part.startsWith('..' + sep) && !isAbsolute(part))
}
const failure = (reason) => ({ status: 'REFUSED', reason, writerActive: false })
async function protectedPath(path) {
  if (path.split(sep).some((part) => part.toLowerCase() === '.openclaw' || part.toLowerCase() === '.agent-core')) return true
  const primary = process.env.DSH_PRIMARY_WORKSPACE
  if (typeof primary !== 'string' || !isAbsolute(primary)) return false
  if (within(resolve(primary), path)) return true
  try { return within(await realpath(primary), path) } catch { return false }
}
async function validatePath(path, directory = false) {
  if (typeof path !== 'string' || !isAbsolute(path) || path.includes('\0')) throw failure('UNSAFE_PATH')
  const target = resolve(path)
  if (await protectedPath(target)) throw failure('PROTECTED_PATH')
  let current = resolve(sep)
  const parts = target.split(sep).filter(Boolean)
  for (let index = 0; index < parts.length; index++) {
    current = resolve(current, parts[index])
    const info = await lstat(current)
    if (info.isSymbolicLink() || (index < parts.length - 1 && !info.isDirectory())) throw failure('UNSAFE_PATH')
    if (index === parts.length - 1 && (directory ? !info.isDirectory() : !info.isFile())) throw failure('UNSAFE_PATH')
  }
  const canonical = await realpath(target)
  if (canonical !== target || await protectedPath(canonical)) throw failure('PROTECTED_PATH')
  return target
}
async function readBounded(path, limit) {
  const target = await validatePath(path)
  const before = await lstat(target)
  if (before.size > limit) throw failure('INPUT_LIMIT')
  const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const opened = await handle.stat()
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size > limit) throw failure('STALE_INPUT')
    const bytes = Buffer.alloc(opened.size)
    let offset = 0
    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, offset)
      if (!result.bytesRead) throw failure('STALE_INPUT')
      offset += result.bytesRead
    }
    const after = await handle.stat()
    const observed = await lstat(target)
    if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs ||
      observed.dev !== opened.dev || observed.ino !== opened.ino || observed.size !== opened.size || observed.mtimeMs !== opened.mtimeMs) throw failure('STALE_INPUT')
    await validatePath(target)
    return bytes
  } finally { await handle.close() }
}
function parseArgs(args) {
  let config
  let create = false
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--config' && !config && typeof args[index + 1] === 'string') config = args[++index]
    else if (args[index] === '--create-copy' && !create) create = true
    else throw failure('INVALID_ARGUMENTS')
  }
  if (!config) throw failure('INVALID_ARGUMENTS')
  return { config, create }
}
async function sourceBytes(config) {
  const hasText = Object.hasOwn(config, 'sourceText')
  const hasFile = Object.hasOwn(config, 'sourceFile')
  if (hasText === hasFile) throw failure('INVALID_CONFIG')
  if (hasText) {
    if (typeof config.sourceText !== 'string' || Buffer.byteLength(config.sourceText) > SOURCE_LIMIT) throw failure('INPUT_LIMIT')
    return Buffer.from(config.sourceText)
  }
  const root = await validatePath(config.sourceRoot, true)
  if (typeof config.sourceFile !== 'string' || !isAbsolute(config.sourceFile) || resolve(config.sourceFile) !== resolve(root, 'MEMORY.md')) throw failure('UNSAFE_PATH')
  return readBounded(config.sourceFile, SOURCE_LIMIT)
}
async function main(args) {
  try {
    const options = parseArgs(args)
    const config = JSON.parse((await readBounded(options.config, CONFIG_LIMIT)).toString('utf8'))
    if (!config || typeof config !== 'object' || Array.isArray(config) || config.reviewed !== true) return failure('UNREVIEWED_CONFIG')
    const allowed = new Set(['reviewed', 'sourceText', 'sourceRoot', 'sourceFile', 'destination', 'operations', 'agentId'])
    if (Object.keys(config).some((key) => !allowed.has(key))) return failure('INVALID_CONFIG')
    if (config.destination !== undefined) {
      if (typeof config.destination !== 'string' || !isAbsolute(config.destination) || config.destination.includes('\0')) return failure('INVALID_CONFIG')
      if (await protectedPath(resolve(config.destination))) return failure('PROTECTED_PATH')
    }
    const bytes = await sourceBytes(config)
    const operations = config.operations ?? []
    if (!Array.isArray(operations)) return failure('INVALID_CONFIG')
    if (options.create) return createMigrationCopy({ sourceBytes: bytes, destination: config.destination, operations, agentId: config.agentId })
    const document = parseMemoryDocument(bytes)
    const plan = planDocumentEdits(document, operations)
    return { status: 'DRY_RUN', writerActive: false, published: false,
      source: { bytes: bytes.length, sha256: document.sha256, format: document.format, readOnlyReason: document.readOnlyReason },
      planStatus: plan.status, beforeSha256: plan.beforeSha256, afterSha256: plan.afterSha256 ?? null,
      reasons: plan.reasons ?? [] }
  } catch (error) {
    const reason = typeof error?.reason === 'string' && /^[A-Z_]{1,64}$/.test(error.reason) ? error.reason : 'INVALID_CONFIG_OR_INPUT'
    return failure(reason)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await main(process.argv.slice(2))
  process.stdout.write(JSON.stringify(result) + '\n')
}
