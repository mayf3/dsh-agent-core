/** Copy-only M2 protocol candidates. No runtime writer imports or activation. */
import { constants } from 'node:fs'
import { open, lstat, realpath, mkdir } from 'node:fs/promises'
import { dirname, basename, resolve, isAbsolute, relative, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { parseMemoryDocument, planDocumentEdits } from './document.js'

const SOURCE_LIMIT = 32 * 1024 * 1024
const STORE_LIMIT = 64 * 1024 * 1024
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const refused = (reason) => ({ status: 'REFUSED', reason, writerActive: false })
const jsonBytes = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n')
const sameIdentity = (a, b) => a.dev === b.dev && a.ino === b.ino
const within = (root, path) => {
  const part = relative(root, path)
  return part === '' || (part !== '..' && !part.startsWith('..' + sep) && !isAbsolute(part))
}
async function protectedPath(path) {
  if (path.split(sep).some((part) => part.toLowerCase() === '.openclaw' || part.toLowerCase() === '.agent-core')) return true
  const primary = process.env.DSH_PRIMARY_WORKSPACE
  if (typeof primary !== 'string' || !isAbsolute(primary)) return false
  if (within(resolve(primary), path)) return true
  try { return within(await realpath(primary), path) } catch { return false }
}
async function realDirectory(path) {
  const absolute = resolve(path)
  const canonical = await realpath(absolute)
  const info = await lstat(absolute)
  return canonical === absolute && info.isDirectory() ? info : null
}
async function validateDestination(destination) {
  if (typeof destination !== 'string' || !isAbsolute(destination) || destination.includes('\0')) return refused('INVALID_DESTINATION')
  const target = resolve(destination)
  if (target === resolve(sep) || basename(target) === '' || await protectedPath(target)) return refused('PROTECTED_PATH')
  const parent = dirname(target)
  try {
    const identity = await realDirectory(parent)
    if (!identity) return refused('UNSAFE_PATH')
    try {
      await lstat(target)
      return refused('DESTINATION_EXISTS')
    } catch (error) {
      if (error.code !== 'ENOENT') return refused('UNSAFE_PATH')
    }
    return { target, parent, identity }
  } catch { return refused('UNSAFE_PATH') }
}
async function syncDirectory(path) {
  const handle = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
  try { await handle.sync() } finally { await handle.close() }
}
async function writeOwnedFile(path, bytes) {
  const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
  try {
    await handle.writeFile(bytes)
    await handle.chmod(0o400)
    await handle.sync()
  } finally { await handle.close() }
}
function prepare(sourceBytes, operations, agentId) {
  if (!(sourceBytes instanceof Uint8Array) || sourceBytes.byteLength > SOURCE_LIMIT || !Array.isArray(operations) ||
    typeof agentId !== 'string' || agentId.length === 0 || agentId.length > 256) return refused('INVALID_INPUT')
  const bytes = Buffer.from(sourceBytes)
  let ownedOperations
  try {
    const encoded = JSON.stringify(operations)
    if (Buffer.byteLength(encoded) > STORE_LIMIT) return refused('STORE_PRESSURE')
    ownedOperations = JSON.parse(encoded)
  } catch { return refused('INVALID_INPUT') }
  let document
  let plan
  try {
    document = parseMemoryDocument(bytes)
    plan = planDocumentEdits(document, ownedOperations)
  } catch { return refused('INVALID_INPUT') }
  const candidate = plan.afterBytes === null ? null : Buffer.from(plan.afterBytes)
  if (candidate && candidate.length > SOURCE_LIMIT) return refused('STORE_PRESSURE')
  return { bytes, operations: ownedOperations, agentId, document, plan, candidate }
}
function protocolFiles(prepared, identity) {
  const { bytes, operations, agentId, document, plan, candidate } = prepared
  const txid = 'migration-' + hash(JSON.stringify({ beforeSha256: hash(bytes), operations }))
  const candidateFile = candidate ? txid + '.candidate' : null
  const manifest = { schema: 'AGENT_MEMORY_V2_MANIFEST', mode: 'MIGRATION_COPY',
    factSource: 'MEMORY.md', resolverOrigin: 'EXPLICIT_AUTHORIZED_BYTES',
    directoryIdentity: { dev: String(identity.dev), ino: String(identity.ino) },
    agentId, writer: { active: false, ownerEpoch: null },
    features: { runtimeInstalled: false, automaticWrites: false, historyRegistered: false },
    core: { bytes: bytes.length, sha256: hash(bytes), format: document.format, readOnlyReason: document.readOnlyReason },
    transactionMetadataLimitBytes: STORE_LIMIT }
  const checkpoint = { schema: 'AGENT_MEMORY_V2_CHECKPOINT', state: 'UNKNOWN',
    generation: null, eventCursor: null, eventIds: [] }
  const transaction = { schema: 'AGENT_MEMORY_V2_MIGRATION_TRANSACTION', txid,
    phase: 'CANDIDATE_ONLY', planStatus: plan.status, beforeSha256: hash(bytes),
    afterSha256: plan.afterSha256 ?? null, candidateFile, operations,
    reasons: plan.reasons ?? [], changes: plan.changes ?? [], preservedSpanProof: plan.preservedSpanProof ?? [],
    sourceEvents: { state: 'UNKNOWN', eventIds: [] }, published: false }
  const files = [
    ['manifest.json', jsonBytes(manifest)], ['checkpoint.json', jsonBytes(checkpoint)],
    ['transactions/' + txid + '.json', jsonBytes(transaction)],
  ]
  if (candidate) files.push(['transactions/' + candidateFile, candidate])
  return { files, txid, totalBytes: files.reduce((total, [, value]) => total + value.length, 0) }
}

/**
 * Create a new absent owned copy under an existing real parent. Caller must
 * authorize the supplied bytes and own the parent; this API never reads a core.
 * A retained proposal is not a committed fact or permission for a writer.
 */
export async function createMigrationCopy({ sourceBytes, destination, operations = [], agentId = 'migration-copy' } = {}) {
  const prepared = prepare(sourceBytes, operations, agentId)
  if (prepared.status === 'REFUSED') return prepared
  const checked = await validateDestination(destination)
  if (checked.status === 'REFUSED') return checked
  // Include directory identity without inventing an active workspace binding.
  const budgetFiles = protocolFiles(prepared, checked.identity)
  if (budgetFiles.totalBytes > STORE_LIMIT) return refused('STORE_PRESSURE')
  let created = false
  try {
    const currentParent = await realDirectory(checked.parent)
    if (!currentParent || !sameIdentity(currentParent, checked.identity)) return refused('UNSAFE_PATH')
    await mkdir(checked.target, { mode: 0o700 })
    created = true
    const current = await realDirectory(checked.target)
    const afterParent = await realDirectory(checked.parent)
    if (!current || !afterParent || !sameIdentity(afterParent, checked.identity)) return refused('COPY_INCOMPLETE')
    const stored = protocolFiles(prepared, current)
    if (stored.totalBytes > STORE_LIMIT) return refused('COPY_INCOMPLETE')
    await mkdir(resolve(checked.target, 'memory'), { mode: 0o700 })
    const ledger = resolve(checked.target, 'memory', '.agent-memory-v2')
    await mkdir(ledger, { mode: 0o700 })
    await mkdir(resolve(ledger, 'transactions'), { mode: 0o700 })
    await writeOwnedFile(resolve(checked.target, 'MEMORY.md'), prepared.bytes)
    for (const [name, bytes] of stored.files) await writeOwnedFile(resolve(ledger, name), bytes)
    await syncDirectory(resolve(ledger, 'transactions'))
    await syncDirectory(ledger)
    await syncDirectory(resolve(checked.target, 'memory'))
    await syncDirectory(checked.target)
    await syncDirectory(checked.parent)
    return { status: 'CREATED_COPY', mode: 'MIGRATION_COPY', writerActive: false,
      source: { bytes: prepared.bytes.length, sha256: hash(prepared.bytes), format: prepared.document.format },
      planStatus: prepared.plan.status, beforeSha256: prepared.plan.beforeSha256,
      afterSha256: prepared.plan.afterSha256 ?? null, txid: stored.txid, protocolBytes: stored.totalBytes,
      ledger: 'memory/.agent-memory-v2', published: false }
  } catch (error) {
    if (!created && error.code === 'EEXIST') return refused('DESTINATION_EXISTS')
    return refused(created ? 'COPY_INCOMPLETE' : 'UNSAFE_PATH')
  }
}
