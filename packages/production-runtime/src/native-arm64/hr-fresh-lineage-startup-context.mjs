/** One fixed DS-to-Router startup channel for the V4 HR lineage cut.
 * The ordinary Runtime remains usable without this channel; a stale public
 * PREPARED projection alone never installs a cut or opens HR admission.
 */
import { createHash } from 'node:crypto'
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'

const OPERATION = 'hr-fresh-lineage-cut-20260929-0d8235e7'
const PROJECTION = '/usr/local/libexec/agent-deploy-system/hr-fresh-lineage-cut.json'
const CONTROL = '/Users/authsvc/.agent-core/control'
export const HR_FRESH_LINEAGE_STARTUP_SOCKET =
  `${CONTROL}/hr-fresh-lineage-start-20260929-0d8235e7.sock`
const HASH = /^[a-f0-9]{64}$/
const MAX_FRAME = 1024
let installed
let attempted = false

const digest = bytes => createHash('sha256').update(bytes).digest('hex')

/** DS mints 32 random bytes and commits this 128-bit projection in nonce. */
export function fixedHrNonceFromSecret(secret) {
  if (typeof secret !== 'string' || !HASH.test(secret)) {
    throw new TypeError('HR startup: secret format invalid')
  }
  const hex = digest(Buffer.from(secret, 'hex')).slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function expectedProjection() {
  let fd
  try {
    fd = openSync(PROJECTION, constants.O_RDONLY | constants.O_NOFOLLOW)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
  try {
    const st = fstatSync(fd)
    if (!st.isFile() || st.uid !== 0 || st.gid !== 0 || st.nlink !== 1
        || (st.mode & 0o777) !== 0o644 || st.size < 1 || st.size > 4096) {
      throw new TypeError('HR startup: projection custody invalid')
    }
    const bytes = readFileSync(fd)
    const after = fstatSync(fd)
    if (after.dev !== st.dev || after.ino !== st.ino || after.size !== st.size
        || after.mtimeMs !== st.mtimeMs || after.ctimeMs !== st.ctimeMs) {
      throw new TypeError('HR startup: projection drift')
    }
    const receipt = JSON.parse(bytes.toString('utf8'))
    if (receipt?.cutOperationId !== OPERATION || receipt.phase !== 'PREPARED_CUT'
        || typeof receipt.nonce !== 'string' || typeof receipt.windowId !== 'string') {
      throw new TypeError('HR startup: fixed projection identity invalid')
    }
    return { receipt, preparedReceiptSha256: digest(bytes) }
  } finally { closeSync(fd) }
}

/** Newline framing is bounded; close or extra frames fail closed. */
export function fixedHrFrameChannel(socket) {
  let buffer = '', closed = false, waiting = null
  function fail(error) {
    closed = true
    if (waiting !== null) {
      waiting.reject(error)
      waiting = null
    }
  }
  socket.on('data', chunk => {
    if (closed || !Buffer.isBuffer(chunk) || buffer.length + chunk.length > MAX_FRAME * 2) {
      fail(new TypeError('HR startup: frame oversized'))
      socket.destroy()
      return
    }
    buffer += chunk.toString('utf8')
    for (;;) {
      const end = buffer.indexOf('\n')
      if (end < 0) break
      const line = buffer.slice(0, end)
      buffer = buffer.slice(end + 1)
      if (line.length === 0 || Buffer.byteLength(line) > MAX_FRAME || waiting === null) {
        fail(new TypeError('HR startup: unexpected frame'))
        socket.destroy()
        return
      }
      let frame
      try { frame = JSON.parse(line) } catch { frame = null }
      if (frame === null || typeof frame !== 'object' || Array.isArray(frame)) {
        fail(new TypeError('HR startup: invalid frame'))
        socket.destroy()
        return
      }
      waiting.resolve(frame)
      waiting = null
    }
  })
  socket.on('close', () => fail(new Error('HR startup: owned channel closed')))
  socket.on('error', error => fail(error))
  return {
    live: () => !closed && !socket.destroyed,
    next() {
      if (closed) return Promise.reject(new Error('HR startup: owned channel closed'))
      if (waiting !== null) return Promise.reject(new TypeError('HR startup: concurrent read'))
      return new Promise((resolve, reject) => { waiting = { resolve, reject } })
    },
    send(frame) {
      if (closed || socket.destroyed) throw new Error('HR startup: owned channel closed')
      const bytes = Buffer.from(`${JSON.stringify(frame)}\n`)
      if (bytes.length > MAX_FRAME) throw new TypeError('HR startup: outbound frame oversized')
      socket.write(bytes)
    },
    close: () => socket.destroy(),
  }
}

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === [...keys].sort().join(',')
}

export function authenticateFixedHrChallenge(frame, expected) {
  const keys = ['schema', 'cutOperationId', 'preparedReceiptSha256', 'windowId', 'secret']
  if (!exactKeys(frame, keys)
      || frame.schema !== 'HR_FRESH_LINEAGE_STARTUP_CHALLENGE_V1'
      || frame.cutOperationId !== OPERATION
      || frame.preparedReceiptSha256 !== expected.preparedReceiptSha256
      || frame.windowId !== expected.receipt.windowId
      || fixedHrNonceFromSecret(frame.secret) !== expected.receipt.nonce) {
    throw new TypeError('HR startup: challenge commitment invalid')
  }
  return true
}

/** Authenticated means the original DS has verified this socket's actual
 * launchd Runtime peer before revealing its private random secret. */
export function fixedHrContextFromChannel(channel, expected) {
  let completionRequested = false
  const receipt = expected.receipt
  return Object.freeze({
    operationId: OPERATION, preparedReceiptSha256: expected.preparedReceiptSha256,
    nonce: receipt.nonce, windowId: receipt.windowId,
    newRuntimeEpoch: receipt.newRuntimeEpoch, newSessionId: receipt.newSessionId,
    assertLive: () => channel.live(),
    async awaitComplete(routerAckSha256) {
      if (completionRequested || !channel.live() || !HASH.test(routerAckSha256 ?? '')) {
        throw new TypeError('HR startup: COMPLETE channel unavailable')
      }
      completionRequested = true
      channel.send({ schema: 'HR_FRESH_LINEAGE_MOUNT_ACK_CANDIDATE_V1',
        cutOperationId: OPERATION, preparedReceiptSha256: expected.preparedReceiptSha256,
        routerAckSha256 })
      let timer
      const complete = await Promise.race([
        channel.next(),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            channel.close()
            reject(new Error('HR startup: root COMPLETE timeout'))
          }, 60_000)
        }),
      ]).finally(() => clearTimeout(timer))
      const keys = ['schema', 'cutOperationId', 'preparedReceiptSha256',
        'disposition', 'oldFenceRetained']
      if (!exactKeys(complete, keys)
          || complete.schema !== 'HR_FRESH_LINEAGE_COMPLETE_V1'
          || complete.cutOperationId !== OPERATION
          || complete.preparedReceiptSha256 !== expected.preparedReceiptSha256
          || complete.disposition !== 'COMPLETE' || complete.oldFenceRetained !== true) {
        throw new TypeError('HR startup: root COMPLETE invalid')
      }
      return complete
    },
  })
}

export function getFixedHrFreshCutContext() { return installed }

/** Used only after the root-owned DS verifies the kernel peer identity of
 * this exact launchd Runtime and delivers its unpublished window secret. */
export async function acceptFixedHrStartupChallenge(channel, expected,
  runtimePid = process.pid) {
  const frame = await channel.next()
  authenticateFixedHrChallenge(frame, expected)
  const context = fixedHrContextFromChannel(channel, expected)
  channel.send({ schema: 'HR_FRESH_LINEAGE_STARTUP_READY_V1',
    cutOperationId: OPERATION, preparedReceiptSha256: expected.preparedReceiptSha256,
    runtimePid })
  return context
}

/** Called by the ordinary launchd entry before loading Router code. Absence,
 * timeout or wrong challenge leaves the old HR fence intact and permits the
 * other Agents to mount. No stale socket/projection is cleared or replayed. */
export async function authenticateFixedHrFreshCutStartup() {
  if (attempted) throw new TypeError('HR startup: one attempt per Runtime')
  attempted = true
  if (process.getuid?.() !== 505) return undefined
  const expected = expectedProjection()
  if (expected === null) return undefined
  const control = lstatSync(CONTROL)
  if (!control.isDirectory() || control.isSymbolicLink() || control.uid !== 505
      || (control.mode & 0o777) !== 0o700) {
    throw new TypeError('HR startup: control directory custody invalid')
  }
  return new Promise((resolve, reject) => {
    const server = createServer()
    let resolved = false
    const finish = (value, error) => {
      if (resolved) return
      resolved = true
      clearTimeout(timer)
      server.close()
      if (error) reject(error)
      else resolve(value)
    }
    const timer = setTimeout(() => finish(undefined), 10_000)
    server.on('error', error => finish(undefined, error))
    server.on('connection', socket => {
      const channel = fixedHrFrameChannel(socket)
      void acceptFixedHrStartupChallenge(channel, expected).then(context => {
        installed = context
        finish(installed)
      }).catch(error => {
        channel.close()
        finish(undefined, error)
      })
    })
    server.listen(HR_FRESH_LINEAGE_STARTUP_SOCKET, () => {})
  })
}
