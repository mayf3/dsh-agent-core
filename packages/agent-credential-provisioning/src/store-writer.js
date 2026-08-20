import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { chmod, chown, lstat, mkdir, open, rename, rm } from 'node:fs/promises'
import { dirname, isAbsolute } from 'node:path'

import {
  CREDENTIALS_STORE_ERROR,
  CREDENTIALS_STORE_VERSION,
  normalizeCredential,
} from '../../broker/src/credential-store.js'

const LOCK_RETRY_MS = 10
// One Phase A operation can legitimately span token preflight plus three
// bounded HTTPS calls. Waiters must outlive that window and then reclassify.
const LOCK_RETRIES = 18000
const PRIVATE_DIRECTORY_MODE = 0o700
const PRIVATE_FILE_MODE = 0o600
const activeLocks = new WeakSet()
const defaultFileSystem = Object.freeze({ chmod, chown, lstat, mkdir, open, rename, rm })

function storeError(message) {
  return Object.assign(new Error(message), { code: CREDENTIALS_STORE_ERROR })
}

function validateStorePath(storeFile) {
  if (typeof storeFile !== 'string' || storeFile === '' || !isAbsolute(storeFile)) {
    throw storeError('credential provisioning: AGENT_CORE_CREDENTIALS_FILE must be an absolute path')
  }
}

function trustedOwner({ ownerUid, ownerGid, identity = process } = {}) {
  const processUid = identity.getuid?.()
  const processGid = identity.getgid?.()
  const uid = ownerUid ?? processUid
  const gid = ownerGid ?? processGid
  if (!Number.isInteger(uid) || uid < 0 || !Number.isInteger(gid) || gid < 0) {
    throw storeError('credential provisioning: trusted ownerUid and ownerGid must be non-negative integers')
  }
  if ((ownerUid === undefined) !== (ownerGid === undefined)) {
    throw storeError('credential provisioning: ownerUid and ownerGid must be supplied together')
  }
  // Part G permits a root process only when it changes ownership to the trusted
  // Control Plane account. A root-owned credential store is never trusted.
  if (uid === 0) {
    throw storeError('credential provisioning: trusted Control Plane owner must not be root')
  }
  if (processUid !== 0 && (uid !== processUid || gid !== processGid)) {
    throw storeError('credential provisioning: non-root writer cannot nominate a different trusted owner')
  }
  return { uid, gid, writerUid: processUid }
}

function assertMetadata(stat, { kind, path, mode, owner }) {
  const typeOk = kind === 'directory' ? stat.isDirectory() : stat.isFile()
  if (!typeOk || stat.isSymbolicLink() || (kind === 'file' && stat.nlink !== 1)) {
    throw storeError(`credential provisioning: ${kind} must be a non-symlink single-link ${kind}: ${path}`)
  }
  if ((stat.mode & 0o7777) !== mode) {
    throw storeError(`credential provisioning: ${kind} has unsafe mode: ${path}`)
  }
  if (stat.uid !== owner.uid || stat.gid !== owner.gid) {
    throw storeError(`credential provisioning: ${kind} has untrusted owner: ${path}`)
  }
}

function sameObject(left, right) {
  return left.dev === right.dev && left.ino === right.ino
}

function assertSameObject(actual, expected, kind, path) {
  if (!sameObject(actual, expected)) {
    throw storeError(`credential provisioning: ${kind} changed during trusted operation: ${path}`)
  }
}

async function removeOwnedPath(file, expectedObject, directory, expectedDirectory, fileSystem) {
  if (expectedObject === undefined) return
  try {
    const directoryStat = await fileSystem.lstat(directory)
    if (!sameObject(directoryStat, expectedDirectory)) return
    const pathStat = await fileSystem.lstat(file)
    if (!sameObject(pathStat, expectedObject)) return
    await fileSystem.rm(file, { force: true })
  } catch {
    // Cleanup must never unlink an unowned replacement path.
  }
}

async function assertTrustedDirectory(directory, owner, {
  create = false,
  fileSystem = defaultFileSystem,
} = {}) {
  let pathStat
  let createdByWriter = false
  try {
    pathStat = await fileSystem.lstat(directory)
  } catch (error) {
    if (error?.code !== 'ENOENT' || !create) {
      throw storeError(`credential provisioning: credential store directory is unavailable: ${directory}`)
    }
    try {
      await fileSystem.mkdir(directory, { mode: PRIVATE_DIRECTORY_MODE })
      createdByWriter = true
    } catch (mkdirError) {
      if (mkdirError?.code !== 'EEXIST') {
        throw storeError(`credential provisioning: cannot create credential store directory: ${directory}`)
      }
    }
    try {
      pathStat = await fileSystem.lstat(directory)
    } catch {
      throw storeError(`credential provisioning: credential store directory is unavailable: ${directory}`)
    }
    if (createdByWriter) {
      try {
        if (owner.writerUid === 0) await fileSystem.chown(directory, owner.uid, owner.gid)
        await fileSystem.chmod(directory, PRIVATE_DIRECTORY_MODE)
        pathStat = await fileSystem.lstat(directory)
      } catch {
        throw storeError(`credential provisioning: cannot hand off credential store directory: ${directory}`)
      }
    }
  }
  assertMetadata(pathStat, {
    kind: 'directory', path: directory, mode: PRIVATE_DIRECTORY_MODE, owner,
  })
  let handle
  try {
    handle = await fileSystem.open(
      directory,
      constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (constants.O_NOFOLLOW ?? 0),
    )
    const openedStat = await handle.stat()
    assertMetadata(openedStat, {
      kind: 'directory', path: directory, mode: PRIVATE_DIRECTORY_MODE, owner,
    })
    if (openedStat.dev !== pathStat.dev || openedStat.ino !== pathStat.ino) {
      throw storeError(`credential provisioning: credential store directory changed during validation: ${directory}`)
    }
    return { dev: openedStat.dev, ino: openedStat.ino }
  } catch (error) {
    if (error?.code === CREDENTIALS_STORE_ERROR) throw error
    throw storeError(`credential provisioning: credential store directory is unsafe: ${directory}`)
  } finally {
    await handle?.close().catch(() => {})
  }
}

/** Establish and verify the trusted direct parent before any Auth mutation. */
export async function preflightTrustedCredentialDirectory(storeFile, options = {}) {
  validateStorePath(storeFile)
  const owner = trustedOwner(options)
  const directoryIdentity = await assertTrustedDirectory(dirname(storeFile), owner, {
    create: true,
    fileSystem: options.fileSystem ?? defaultFileSystem,
  })
  return { owner, directoryIdentity }
}

function scanString(raw, start) {
  if (raw[start] !== '"') throw storeError('credential provisioning: internal JSON scan failed')
  let index = start + 1
  for (; index < raw.length; index += 1) {
    if (raw[index] === '\\') {
      index += 1
      if (raw[index] === 'u') index += 4
    } else if (raw[index] === '"') {
      return index + 1
    }
  }
  throw storeError('credential provisioning: internal JSON scan failed')
}

function skipWhitespace(raw, start) {
  let index = start
  while (/\s/u.test(raw[index] ?? '')) index += 1
  return index
}

function scanValue(raw, start) {
  const index = skipWhitespace(raw, start)
  if (raw[index] === '"') return scanString(raw, index)
  if (raw[index] === '{' || raw[index] === '[') {
    const close = raw[index] === '{' ? '}' : ']'
    let cursor = index + 1
    while (cursor < raw.length) {
      if (raw[cursor] === '"') cursor = scanString(raw, cursor)
      else if (raw[cursor] === '{' || raw[cursor] === '[') cursor = scanValue(raw, cursor)
      else if (raw[cursor] === close) return cursor + 1
      else cursor += 1
    }
    throw storeError('credential provisioning: internal JSON scan failed')
  }
  let cursor = index
  while (cursor < raw.length && !/[\s,}\]]/u.test(raw[cursor])) cursor += 1
  return cursor
}

function locateCredentialsObject(raw) {
  let cursor = skipWhitespace(raw, 0)
  if (raw[cursor] !== '{') throw storeError('credential provisioning: internal JSON scan failed')
  cursor += 1
  let match
  while (true) {
    cursor = skipWhitespace(raw, cursor)
    if (raw[cursor] === '}') break
    const keyStart = cursor
    const keyEnd = scanString(raw, keyStart)
    const key = JSON.parse(raw.slice(keyStart, keyEnd))
    cursor = skipWhitespace(raw, keyEnd)
    if (raw[cursor] !== ':') throw storeError('credential provisioning: internal JSON scan failed')
    const valueStart = skipWhitespace(raw, cursor + 1)
    const valueEnd = scanValue(raw, valueStart)
    if (key === 'credentials') match = { valueStart, valueEnd }
    cursor = skipWhitespace(raw, valueEnd)
    if (raw[cursor] === ',') cursor += 1
    else if (raw[cursor] !== '}') throw storeError('credential provisioning: internal JSON scan failed')
  }
  if (match === undefined || raw[match.valueStart] !== '{' || raw[match.valueEnd - 1] !== '}') {
    throw storeError('credential provisioning: internal JSON scan failed')
  }
  return { start: match.valueStart, end: match.valueEnd }
}

async function readTrustedStore(storeFile, owner, { expectedDirectoryIdentity } = {}) {
  validateStorePath(storeFile)
  const directory = dirname(storeFile)
  const directoryIdentity = await assertTrustedDirectory(directory, owner)
  if (expectedDirectoryIdentity !== undefined) {
    assertSameObject(directoryIdentity, expectedDirectoryIdentity, 'credential store directory', directory)
  }

  let pathStat
  try {
    pathStat = await lstat(storeFile)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        version: CREDENTIALS_STORE_VERSION,
        credentials: {},
        raw: undefined,
        fileIdentity: undefined,
        credentialsSpan: undefined,
      }
    }
    throw storeError(`credential provisioning: credentials store is unreadable: ${storeFile}`)
  }
  assertMetadata(pathStat, {
    kind: 'file', path: storeFile, mode: PRIVATE_FILE_MODE, owner,
  })

  let handle
  let raw
  let openedStat
  try {
    handle = await open(storeFile, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
    openedStat = await handle.stat()
    assertMetadata(openedStat, {
      kind: 'file', path: storeFile, mode: PRIVATE_FILE_MODE, owner,
    })
    if (openedStat.dev !== pathStat.dev || openedStat.ino !== pathStat.ino) {
      throw storeError(`credential provisioning: credentials store changed during validation: ${storeFile}`)
    }
    raw = await handle.readFile('utf8')
  } catch (error) {
    if (error?.code === CREDENTIALS_STORE_ERROR) throw error
    throw storeError(`credential provisioning: credentials store is unsafe or unreadable: ${storeFile}`)
  } finally {
    await handle?.close().catch(() => {})
  }

  let document
  try {
    document = JSON.parse(raw)
  } catch {
    throw storeError(`credential provisioning: credentials store is malformed: ${storeFile}`)
  }
  if (
    document?.version !== CREDENTIALS_STORE_VERSION
    || typeof document.credentials !== 'object'
    || document.credentials === null
    || Array.isArray(document.credentials)
  ) throw storeError(`credential provisioning: unsupported credentials store format: ${storeFile}`)
  for (const [agentId, entry] of Object.entries(document.credentials)) {
    if (normalizeCredential(entry) === undefined) {
      throw storeError(`credential provisioning: malformed credential entry for agent ${JSON.stringify(agentId)}`)
    }
  }
  return {
    version: CREDENTIALS_STORE_VERSION,
    credentials: document.credentials,
    raw,
    fileIdentity: { dev: openedStat.dev, ino: openedStat.ino },
    credentialsSpan: locateCredentialsObject(raw),
  }
}

/** Read and fully validate V1 contents plus trusted metadata before secret parsing. */
export async function readCredentialStoreDocument(storeFile, options = {}) {
  const owner = trustedOwner(options)
  return readTrustedStore(storeFile, owner, {
    expectedDirectoryIdentity: options.expectedDirectoryIdentity,
  })
}

async function acquireLock(lockFile, directory, expectedDirectory, owner, fileSystem) {
  for (let attempt = 0; attempt <= LOCK_RETRIES; attempt += 1) {
    let handle
    try {
      handle = await fileSystem.open(
        lockFile,
        constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | (constants.O_NOFOLLOW ?? 0),
        PRIVATE_FILE_MODE,
      )
      if (owner.writerUid === 0) await handle.chown(owner.uid, owner.gid)
      const stat = await handle.stat()
      assertMetadata(stat, { kind: 'file', path: lockFile, mode: PRIVATE_FILE_MODE, owner })
      const pathStat = await fileSystem.lstat(lockFile)
      assertMetadata(pathStat, { kind: 'file', path: lockFile, mode: PRIVATE_FILE_MODE, owner })
      assertSameObject(pathStat, stat, 'credential store lock', lockFile)
      const directoryStat = await fileSystem.lstat(directory)
      assertMetadata(directoryStat, {
        kind: 'directory', path: directory, mode: PRIVATE_DIRECTORY_MODE, owner,
      })
      assertSameObject(directoryStat, expectedDirectory, 'credential store directory', directory)
      return { handle, object: { dev: stat.dev, ino: stat.ino } }
    } catch (error) {
      if (handle !== undefined) {
        const lockObject = await handle.stat().catch(() => undefined)
        await handle.close().catch(() => {})
        await removeOwnedPath(lockFile, lockObject, directory, expectedDirectory, fileSystem)
      }
      if (error?.code !== 'EEXIST') {
        if (error?.code === CREDENTIALS_STORE_ERROR) throw error
        throw storeError(`credential provisioning: cannot create store lock: ${lockFile}`)
      }
      if (attempt === LOCK_RETRIES) {
        throw Object.assign(new Error(`credential provisioning: credentials store writer is busy: ${lockFile}`), {
          code: 'CREDENTIALS_STORE_LOCKED',
        })
      }
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS))
    }
  }
  throw new Error('unreachable')
}

async function fsyncDirectory(directory, fileSystem = defaultFileSystem) {
  let handle
  try {
    handle = await fileSystem.open(directory, constants.O_RDONLY)
    await handle.sync()
  } catch (error) {
    if (!['EINVAL', 'ENOTSUP', 'EISDIR'].includes(error?.code)) throw error
  } finally {
    await handle?.close().catch(() => {})
  }
}

/** Serialize the complete Phase A operation, not merely its final write. */
export async function withCredentialStoreLock(storeFile, options = {}, operation) {
  validateStorePath(storeFile)
  const directory = dirname(storeFile)
  const fileSystem = options.fileSystem ?? defaultFileSystem
  const { owner, directoryIdentity } = await preflightTrustedCredentialDirectory(storeFile, options)
  const lockFile = `${storeFile}.lock`
  const acquiredLock = await acquireLock(lockFile, directory, directoryIdentity, owner, fileSystem)
  const lock = Object.freeze({ storeFile, owner, directoryIdentity })
  activeLocks.add(lock)
  try {
    return await operation(lock)
  } finally {
    activeLocks.delete(lock)
    await acquiredLock.handle.close().catch(() => {})
    await removeOwnedPath(lockFile, acquiredLock.object, directory, directoryIdentity, fileSystem)
  }
}

function serializeWithAddedCredential(current, agentId, credential) {
  const entry = `${JSON.stringify(agentId)}:${JSON.stringify({
    clientId: credential.clientId,
    clientSecret: credential.clientSecret,
  })}`
  if (current.raw === undefined) {
    return `${JSON.stringify({
      version: CREDENTIALS_STORE_VERSION,
      credentials: { [agentId]: { clientId: credential.clientId, clientSecret: credential.clientSecret } },
    }, null, 2)}\n`
  }
  const { start, end } = current.credentialsSpan
  const body = current.raw.slice(start + 1, end - 1)
  const separator = body.trim() === '' ? '' : ','
  return `${current.raw.slice(0, end - 1)}${separator}${entry}${current.raw.slice(end - 1)}`
}

async function assertTargetUnchanged(storeFile, expectedIdentity, fileSystem = defaultFileSystem) {
  let current
  try {
    current = await fileSystem.lstat(storeFile)
  } catch (error) {
    if (error?.code === 'ENOENT' && expectedIdentity === undefined) return
    throw storeError(`credential provisioning: credentials store changed before commit: ${storeFile}`)
  }
  if (
    expectedIdentity === undefined
    || !current.isFile()
    || current.isSymbolicLink()
    || current.dev !== expectedIdentity.dev
    || current.ino !== expectedIdentity.ino
  ) throw storeError(`credential provisioning: credentials store changed before commit: ${storeFile}`)
}

/** Add exactly one absent target entry while preserving every pre-existing byte. */
export async function writeCredentialForAgent(storeFile, agentId, credential, options = {}) {
  if (typeof agentId !== 'string' || agentId === '' || normalizeCredential(credential) === undefined) {
    throw storeError('credential provisioning: target agent and credential must be valid')
  }
  const execute = async (lock) => {
    if (!activeLocks.has(lock) || lock?.storeFile !== storeFile) {
      throw storeError('credential provisioning: invalid store lock context')
    }
    const { owner, directoryIdentity } = lock
    const current = await readTrustedStore(storeFile, owner, {
      expectedDirectoryIdentity: directoryIdentity,
    })
    if (current.credentials[agentId] !== undefined) {
      throw storeError(`credential provisioning: target credential entry already exists for ${agentId}`)
    }
    const serialized = serializeWithAddedCredential(current, agentId, credential)
    const directory = dirname(storeFile)
    const fileSystem = options.fileSystem ?? defaultFileSystem
    const tempFile = `${storeFile}.tmp-${process.pid}-${randomUUID()}`
    let tempHandle
    let tempIdentity
    try {
      tempHandle = await fileSystem.open(
        tempFile,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0),
        PRIVATE_FILE_MODE,
      )
      if (owner.writerUid === 0) await tempHandle.chown(owner.uid, owner.gid)
      const tempStat = await tempHandle.stat()
      assertMetadata(tempStat, { kind: 'file', path: tempFile, mode: PRIVATE_FILE_MODE, owner })
      tempIdentity = { dev: tempStat.dev, ino: tempStat.ino }
      const tempPathStat = await fileSystem.lstat(tempFile)
      assertMetadata(tempPathStat, { kind: 'file', path: tempFile, mode: PRIVATE_FILE_MODE, owner })
      assertSameObject(tempPathStat, tempIdentity, 'credential store temp file', tempFile)
      const directoryAfterTemp = await fileSystem.lstat(directory)
      assertMetadata(directoryAfterTemp, {
        kind: 'directory', path: directory, mode: PRIVATE_DIRECTORY_MODE, owner,
      })
      assertSameObject(directoryAfterTemp, directoryIdentity, 'credential store directory', directory)
      // Metadata and parent identity are final before the first secret byte is persisted.
      await tempHandle.writeFile(serialized, 'utf8')
      await tempHandle.sync()
      await tempHandle.close()
      tempHandle = undefined
      await options.beforeRename?.()
      const directoryNow = await assertTrustedDirectory(directory, owner, { fileSystem })
      if (directoryNow.dev !== directoryIdentity.dev || directoryNow.ino !== directoryIdentity.ino) {
        throw storeError(`credential provisioning: credential store directory changed before commit: ${directory}`)
      }
      await assertTargetUnchanged(storeFile, current.fileIdentity, fileSystem)
      await fileSystem.rename(tempFile, storeFile)
      const finalStat = await fileSystem.lstat(storeFile)
      assertMetadata(finalStat, { kind: 'file', path: storeFile, mode: PRIVATE_FILE_MODE, owner })
      if (finalStat.dev !== tempIdentity.dev || finalStat.ino !== tempIdentity.ino) {
        throw storeError(`credential provisioning: final credential store changed after commit: ${storeFile}`)
      }
      await fsyncDirectory(directory, fileSystem)
      await options.afterRename?.()
    } catch (error) {
      if (error?.code === CREDENTIALS_STORE_ERROR || error?.code === 'CREDENTIALS_STORE_LOCKED') throw error
      throw storeError(`credential provisioning: atomic credentials store update failed: ${storeFile}`)
    } finally {
      if (tempHandle !== undefined && tempIdentity === undefined) {
        const stat = await tempHandle.stat().catch(() => undefined)
        if (stat !== undefined) tempIdentity = { dev: stat.dev, ino: stat.ino }
      }
      await tempHandle?.close().catch(() => {})
      await removeOwnedPath(tempFile, tempIdentity, directory, directoryIdentity, fileSystem)
    }
  }
  if (options.lock !== undefined) return execute(options.lock)
  return withCredentialStoreLock(storeFile, options, execute)
}
