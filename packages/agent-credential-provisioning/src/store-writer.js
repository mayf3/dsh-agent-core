import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, readFile, rename, rm } from 'node:fs/promises'
import { dirname, isAbsolute } from 'node:path'

import {
  CREDENTIALS_STORE_ERROR,
  CREDENTIALS_STORE_VERSION,
  normalizeCredential,
} from '../../broker/src/credential-store.js'

const LOCK_RETRY_MS = 10
const LOCK_RETRIES = 200

function storeError(message) {
  return Object.assign(new Error(message), {
    code: CREDENTIALS_STORE_ERROR,
  })
}

function validateStorePath(storeFile) {
  if (typeof storeFile !== 'string' || storeFile === '' || !isAbsolute(storeFile)) {
    throw storeError('credential provisioning: AGENT_CORE_CREDENTIALS_FILE must be an absolute path')
  }
}

/** Read and fully validate the V1 document while preserving entry objects. */
export async function readCredentialStoreDocument(storeFile) {
  validateStorePath(storeFile)
  try {
    const directoryStat = await lstat(dirname(storeFile))
    if (!directoryStat.isDirectory() || (directoryStat.mode & 0o077) !== 0) {
      throw storeError(`credential provisioning: credential store directory must be private (0700): ${dirname(storeFile)}`)
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  let raw
  try {
    raw = await readFile(storeFile, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return { version: CREDENTIALS_STORE_VERSION, credentials: {} }
    throw storeError(`credential provisioning: credentials store is unreadable: ${storeFile}`)
  }
  let document
  try {
    document = JSON.parse(raw)
  } catch (error) {
    throw storeError(`credential provisioning: credentials store is malformed: ${storeFile}`)
  }
  if (
    document?.version !== CREDENTIALS_STORE_VERSION
    || typeof document.credentials !== 'object'
    || document.credentials === null
    || Array.isArray(document.credentials)
  ) {
    throw storeError(`credential provisioning: unsupported credentials store format: ${storeFile}`)
  }
  for (const [agentId, entry] of Object.entries(document.credentials)) {
    if (normalizeCredential(entry) === undefined) {
      throw storeError(`credential provisioning: malformed credential entry for agent ${JSON.stringify(agentId)}`)
    }
  }
  return { version: CREDENTIALS_STORE_VERSION, credentials: document.credentials }
}

async function assertTrustedDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const stat = await lstat(directory)
  if (!stat.isDirectory() || (stat.mode & 0o077) !== 0) {
    throw storeError(`credential provisioning: credential store directory must be private (0700): ${directory}`)
  }
}

async function acquireLock(lockFile) {
  for (let attempt = 0; attempt <= LOCK_RETRIES; attempt += 1) {
    try {
      return await open(lockFile, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR, 0o600)
    } catch (error) {
      if (error?.code !== 'EEXIST') throw storeError(`credential provisioning: cannot create store lock: ${lockFile}`)
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

async function fsyncDirectory(directory) {
  let handle
  try {
    handle = await open(directory, constants.O_RDONLY)
    await handle.sync()
  } catch (error) {
    if (!['EINVAL', 'ENOTSUP', 'EISDIR'].includes(error?.code)) throw error
  } finally {
    await handle?.close().catch(() => {})
  }
}

/**
 * Serialize one trusted-store mutation under a private same-directory lock.
 * `beforeRename` is a test-only crash seam and receives no credential data.
 */
async function mutateCredentialStore(storeFile, mutate, { beforeRename, ownerUid, ownerGid } = {}) {
  validateStorePath(storeFile)
  const directory = dirname(storeFile)
  await assertTrustedDirectory(directory)
  const lockFile = `${storeFile}.lock`
  const lockHandle = await acquireLock(lockFile)
  const tempFile = `${storeFile}.tmp-${process.pid}-${randomUUID()}`
  let tempHandle
  try {
    const current = await readCredentialStoreDocument(storeFile)
    const nextCredentials = { ...current.credentials }
    mutate(nextCredentials)
    const serialized = `${JSON.stringify({ version: CREDENTIALS_STORE_VERSION, credentials: nextCredentials }, null, 2)}\n`
    tempHandle = await open(tempFile, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600)
    if (process.getuid?.() === 0 && ownerUid === undefined) {
      throw storeError('credential provisioning: root writer requires explicit trusted ownerUid/ownerGid')
    }
    if (ownerUid !== undefined || ownerGid !== undefined) {
      if (!Number.isInteger(ownerUid) || !Number.isInteger(ownerGid)) {
        throw storeError('credential provisioning: ownerUid and ownerGid must be supplied together as integers')
      }
      await tempHandle.chown(ownerUid, ownerGid)
    }
    await tempHandle.writeFile(serialized, 'utf8')
    await tempHandle.sync()
    await tempHandle.close()
    tempHandle = undefined
    await beforeRename?.()
    await rename(tempFile, storeFile)
    await fsyncDirectory(directory)
  } catch (error) {
    if (error?.code === CREDENTIALS_STORE_ERROR || error?.code === 'CREDENTIALS_STORE_LOCKED') throw error
    throw storeError(`credential provisioning: atomic credentials store update failed: ${storeFile}`)
  } finally {
    await tempHandle?.close().catch(() => {})
    await rm(tempFile, { force: true }).catch(() => {})
    await lockHandle.close().catch(() => {})
    await rm(lockFile, { force: true }).catch(() => {})
  }
}

export async function writeCredentialForAgent(storeFile, agentId, credential, options) {
  if (typeof agentId !== 'string' || agentId === '' || normalizeCredential(credential) === undefined) {
    throw storeError('credential provisioning: target agent and credential must be valid')
  }
  await mutateCredentialStore(storeFile, (credentials) => {
    credentials[agentId] = { clientId: credential.clientId, clientSecret: credential.clientSecret }
  }, options)
}

export async function removeCredentialForAgent(storeFile, agentId, options) {
  if (typeof agentId !== 'string' || agentId === '') throw storeError('credential provisioning: target agent must be valid')
  await mutateCredentialStore(storeFile, (credentials) => {
    delete credentials[agentId]
  }, options)
}
