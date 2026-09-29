/** Fixed, read-only root-to-Router projection for the one V4 HR cut.
 *
 * This is a startup input, never a public Router/Feishu/agent argument. The
 * root producer keeps intent and protected evidence in its separate 0700
 * namespace; only its bounded, nonsecret PREPARED receipt is projected here.
 * A valid projection is not itself business admission: the Router still has
 * to load the exact old durable record, commit/read back the Binding cut and
 * pass its final prompt/tool gates while ingress remains closed.
 */
import { createHash, randomUUID } from 'node:crypto'
import {
  closeSync, constants, fstatSync, fsyncSync, linkSync, lstatSync,
  openSync, readFileSync, readSync, unlinkSync, writeSync,
} from 'node:fs'
import { hostname } from 'node:os'
import { fileURLToPath } from 'node:url'

export const HR_CUT_PROJECTION_DIRECTORY = '/usr/local/libexec/agent-deploy-system'
export const HR_CUT_PROJECTION_FILE = `${HR_CUT_PROJECTION_DIRECTORY}/hr-fresh-lineage-cut.json`
export const HR_CUT_OPERATION_ID = 'hr-fresh-lineage-cut-20260929-0d8235e7'
export const HR_CUT_OLD_HANDLE = 'turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256'
export const HR_CUT_AGENT_ID = 'agt_hr-agent'
export const HR_CUT_MOUNT_ACK_DIRECTORY = '/Users/authsvc/.agent-core/control'
export const HR_CUT_MOUNT_ACK_FILE = `${HR_CUT_MOUNT_ACK_DIRECTORY}/hr-fresh-lineage-mount-ack-20260929-0d8235e7.json`
export const HR_CUT_V4_SPEC_SHA256 = '4bf8511905551ffae6d255844e893deb45dcd2844eed28078804b37f394eaf7a'
const MAX_BYTES = 4096
const HASH = /^[a-f0-9]{64}$/
const RESERVED_ID = /^[a-f0-9-]{36}$/
const RECEIPT_KEYS = [
  'schema', 'phase', 'cutOperationId', 'hostId', 'authoritySha256',
  'producerSha256', 'consumerSha256', 'oldAgentId', 'oldTurnHandle',
  'oldRuntimeEpoch', 'oldProcessGeneration', 'oldSessionId',
  'oldRecordSha256', 'oldFenceRetained', 'newRuntimeEpoch', 'newSessionId',
  'issuanceFloor', 'sourceProofSha256', 'localCutProofSha256',
  'preimageSha256', 'rollbackSha256', 'windowId', 'nonce', 'sequence',
  'committedAtMs',
].sort().join(',')

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
function selfSha256() {
  const fd = openSync(fileURLToPath(import.meta.url),
    constants.O_RDONLY | constants.O_NOFOLLOW | (constants.O_CLOEXEC ?? 0))
  try {
    const before = fstatSync(fd, { bigint: true })
    if (!before.isFile() || before.nlink !== 1n) {
      throw new TypeError('HR cut projection: installed consumer source invalid')
    }
    const bytes = readFileSync(fd)
    const after = fstatSync(fd, { bigint: true })
    if (before.dev !== after.dev || before.ino !== after.ino
        || before.size !== after.size || before.mtimeNs !== after.mtimeNs
        || before.ctimeNs !== after.ctimeNs) {
      throw new TypeError('HR cut projection: installed consumer source drift')
    }
    return sha256(bytes)
  } finally {
    closeSync(fd)
  }
}
const nonempty = value => typeof value === 'string' && value.length > 0
  && Buffer.byteLength(value, 'utf8') <= 256

/** Pure closed-schema validator. It does not establish root custody; only the
 * fixed-path, no-follow reader below may pass its result into Router startup. */
export function validatePreparedHrCutBytes(bytes, { hostId = hostname(),
  consumerSha256 = selfSha256() } = {}) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_BYTES) {
    throw new TypeError('HR cut projection: bounded bytes required')
  }
  const receipt = JSON.parse(bytes.toString('utf8'))
  if (receipt === null || typeof receipt !== 'object' || Array.isArray(receipt)
      || Object.keys(receipt).sort().join(',') !== RECEIPT_KEYS
      || receipt.schema !== 'HR_FRESH_LINEAGE_CUT_RECEIPT_V1'
      || receipt.phase !== 'PREPARED_CUT'
      || receipt.cutOperationId !== HR_CUT_OPERATION_ID
      || receipt.hostId !== hostId
      || receipt.authoritySha256 !== HR_CUT_V4_SPEC_SHA256
      || receipt.consumerSha256 !== consumerSha256
      || receipt.oldAgentId !== HR_CUT_AGENT_ID
      || receipt.oldTurnHandle !== HR_CUT_OLD_HANDLE
      || receipt.oldFenceRetained !== true
      || !nonempty(receipt.oldRuntimeEpoch)
      || !Number.isSafeInteger(receipt.oldProcessGeneration)
      || receipt.oldProcessGeneration < 1
      || !nonempty(receipt.oldSessionId)
      || !RESERVED_ID.test(receipt.newRuntimeEpoch ?? '')
      || receipt.newRuntimeEpoch === receipt.oldRuntimeEpoch
      || !RESERVED_ID.test(receipt.newSessionId ?? '')
      || receipt.newSessionId === receipt.oldSessionId
      || !Number.isSafeInteger(receipt.issuanceFloor)
      || receipt.issuanceFloor < receipt.oldProcessGeneration
      || !RESERVED_ID.test(receipt.windowId ?? '')
      || !RESERVED_ID.test(receipt.nonce ?? '')
      || receipt.sequence !== 1
      || !Number.isSafeInteger(receipt.committedAtMs) || receipt.committedAtMs < 1
      || ![receipt.authoritySha256, receipt.producerSha256, receipt.consumerSha256,
        receipt.oldRecordSha256, receipt.sourceProofSha256,
        receipt.localCutProofSha256, receipt.preimageSha256,
        receipt.rollbackSha256].every(value => HASH.test(value ?? ''))) {
    throw new TypeError('HR cut projection: exact PREPARED receipt invalid')
  }
  const receiptSha256 = sha256(bytes)
  return Object.freeze({ receipt: Object.freeze(receipt), receiptSha256,
    cut: Object.freeze({
      version: 1, operationId: receipt.cutOperationId, agentId: receipt.oldAgentId,
      oldHandle: receipt.oldTurnHandle, oldRuntimeEpoch: receipt.oldRuntimeEpoch,
      oldProcessGeneration: receipt.oldProcessGeneration,
      oldSessionId: receipt.oldSessionId,
      issuanceFloor: receipt.issuanceFloor,
      newRuntimeEpoch: receipt.newRuntimeEpoch, newSessionId: receipt.newSessionId,
      cutCommittedAtMs: receipt.committedAtMs,
      schedulerDisabledReceiptSha256: receipt.sourceProofSha256,
      oldWorkerIsolationReceiptSha256: receipt.localCutProofSha256,
      rootReceiptSha256: receiptSha256,
    }),
  })
}

function nonWritableRootDirectory(path, exactMode = null) {
  const st = lstatSync(path)
  if (!st.isDirectory() || st.isSymbolicLink() || st.uid !== 0
      || (st.mode & 0o002) !== 0
      || ((st.mode & 0o020) !== 0 && process.getgroups().includes(st.gid))
      || (exactMode !== null && (st.mode & 0o777) !== exactMode)) {
    throw new TypeError('HR cut projection: directory custody invalid')
  }
}

/** Hash the same pre-start durable file bytes the fixed root producer saw
 * after the old Runtime stopped. The existing store loader validates the
 * record schema next; this function never returns record contents. */
export function readHrDurablePreimageSha256(storeFile) {
  const fd = openSync(storeFile,
    constants.O_RDONLY | constants.O_NOFOLLOW | (constants.O_CLOEXEC ?? 0))
  try {
    const before = fstatSync(fd, { bigint: true })
    if (!before.isFile() || before.nlink !== 1n || before.size < 1n
        || before.size > 268_439_552n) {
      throw new TypeError('HR cut: durable record preimage unavailable')
    }
    const digest = createHash('sha256')
    const buffer = Buffer.alloc(65_536)
    let bytesRead = 0n
    for (;;) {
      const length = readSync(fd, buffer, 0, buffer.length, null)
      if (length === 0) break
      bytesRead += BigInt(length)
      if (bytesRead > 268_439_552n) throw new TypeError('HR cut: durable record preimage oversized')
      digest.update(buffer.subarray(0, length))
    }
    const after = fstatSync(fd, { bigint: true })
    if (bytesRead !== before.size || before.dev !== after.dev
        || before.ino !== after.ino || before.size !== after.size
        || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) {
      throw new TypeError('HR cut: durable record preimage drift')
    }
    return digest.digest('hex')
  } finally {
    closeSync(fd)
  }
}

/** No path argument, environment override, or caller-selected Agent. Absence
 * leaves historical HR fencing in force; invalidity is a bounded error for
 * the startup coordinator to report while keeping other Agents available. */
export function readFixedPreparedHrCut() {
  try {
    for (const path of ['/usr', '/usr/local', '/usr/local/libexec']) {
      nonWritableRootDirectory(path)
    }
    nonWritableRootDirectory(HR_CUT_PROJECTION_DIRECTORY, 0o755)
    const fd = openSync(HR_CUT_PROJECTION_FILE,
      constants.O_RDONLY | constants.O_NOFOLLOW | (constants.O_CLOEXEC ?? 0))
    try {
      const before = fstatSync(fd, { bigint: true })
      if (!before.isFile() || before.uid !== 0n || before.gid !== 0n
          || before.nlink !== 1n || (before.mode & 0o777n) !== 0o644n
          || before.size < 1n || before.size > BigInt(MAX_BYTES)) {
        throw new TypeError('HR cut projection: file custody invalid')
      }
      const buffer = Buffer.alloc(MAX_BYTES + 1)
      let length = 0
      for (;;) {
        const count = readSync(fd, buffer, length, buffer.length - length, null)
        if (count === 0) break
        length += count
        if (length > MAX_BYTES) throw new TypeError('HR cut projection: oversized receipt')
      }
      const after = fstatSync(fd, { bigint: true })
      if (before.dev !== after.dev || before.ino !== after.ino
          || before.size !== after.size || before.mtimeNs !== after.mtimeNs
          || before.ctimeNs !== after.ctimeNs || length !== Number(before.size)) {
        throw new TypeError('HR cut projection: read drift')
      }
      return validatePreparedHrCutBytes(buffer.subarray(0, length))
    } finally {
      closeSync(fd)
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

/** A bounded Router observation, not an authentication assertion. Root must
 * independently verify actual launchd process birth/executable/ancestry,
 * live child generation, Binding and window custody before COMPLETE. */
export function buildFixedHrMountAck(prepared, bindingReceipt, store, hrProcess,
  { runtimePid = process.pid, nowMs = Date.now(),
    runtimeStartAtMs = Math.floor(Date.now() - process.uptime() * 1000) } = {}) {
  if (prepared?.receipt?.phase !== 'PREPARED_CUT'
      || prepared.receipt.cutOperationId !== HR_CUT_OPERATION_ID
      || bindingReceipt?.operationId !== HR_CUT_OPERATION_ID
      || bindingReceipt.newRuntimeEpoch !== store.runtimeEpoch
      || bindingReceipt.newSessionId !== prepared.receipt.newSessionId
      || !HASH.test(bindingReceipt.bindingCutSha256 ?? '')
      || !nonempty(bindingReceipt.channelConversationId)
      || store.freshHrLineage?.operationId !== HR_CUT_OPERATION_ID
      || store.activeFenceForAgent(HR_CUT_AGENT_ID)?.handle !== HR_CUT_OLD_HANDLE
      || hrProcess?.agentId !== HR_CUT_AGENT_ID || hrProcess.state !== 'READY'
      || hrProcess.exit !== undefined
      || !Number.isSafeInteger(hrProcess.processGeneration)
      || hrProcess.processGeneration <= prepared.receipt.issuanceFloor
      || !Number.isSafeInteger(hrProcess.pid) || hrProcess.pid < 1
      || hrProcess.ownership?.pid !== hrProcess.pid
      || hrProcess.ownership?.childObject !== hrProcess.child
      || !Number.isSafeInteger(runtimePid) || runtimePid < 1
      || !Number.isSafeInteger(nowMs) || nowMs < 1
      || !Number.isSafeInteger(runtimeStartAtMs) || runtimeStartAtMs < 1) {
    throw new TypeError('HR cut mount acknowledgement: joint cut not proven')
  }
  return Object.freeze({
    schema: 'HR_FRESH_LINEAGE_MOUNT_ACK_V1', cutOperationId: HR_CUT_OPERATION_ID,
    receiptSha256: prepared.receiptSha256,
    nonce: prepared.receipt.nonce, windowId: prepared.receipt.windowId,
    oldAgentId: HR_CUT_AGENT_ID, oldTurnHandle: HR_CUT_OLD_HANDLE,
    newSessionId: prepared.receipt.newSessionId,
    bindingCutSha256: bindingReceipt.bindingCutSha256,
    channelConversationIdSha256: sha256(Buffer.from(bindingReceipt.channelConversationId)),
    newRuntimeEpoch: store.runtimeEpoch, runtimePid,
    // This timestamp is only a claimed observation; DS must read OS birth.
    runtimeStartAtMs, processGeneration: hrProcess.processGeneration,
    childPid: hrProcess.pid, consumerSha256: prepared.receipt.consumerSha256,
    oldFenceRetained: true, mountedAtMs: nowMs,
  })
}

/** One fixed UID505-to-root fact file. No DS socket caller expansion. */
export function writeFixedHrMountAck(prepared, bindingReceipt, store, hrProcess) {
  if (process.getuid?.() !== 505) {
    throw new TypeError('HR cut mount acknowledgement: runtime UID mismatch')
  }
  const ack = buildFixedHrMountAck(prepared, bindingReceipt, store, hrProcess)
  const control = lstatSync(HR_CUT_MOUNT_ACK_DIRECTORY)
  if (!control.isDirectory() || control.isSymbolicLink() || control.uid !== 505
      || (control.mode & 0o777) !== 0o700) {
    throw new TypeError('HR cut mount acknowledgement: runtime custody invalid')
  }
  const bytes = Buffer.from(`${JSON.stringify(ack)}\n`)
  if (bytes.length > MAX_BYTES) throw new TypeError('HR cut mount acknowledgement: oversized')
  const temp = `${HR_CUT_MOUNT_ACK_FILE}.tmp-${process.pid}-${randomUUID()}`
  const fd = openSync(temp,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600)
  try {
    writeSync(fd, bytes)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  // Hard-link publication is atomic/no-overwrite. A crash with both names
  // yields nlink=2 and the root verifier must fail closed, not replay a cut.
  try {
    linkSync(temp, HR_CUT_MOUNT_ACK_FILE)
  } finally {
    unlinkSync(temp)
  }
  const dirFd = openSync(HR_CUT_MOUNT_ACK_DIRECTORY,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
  try { fsyncSync(dirFd) } finally { closeSync(dirFd) }
  const readFd = openSync(HR_CUT_MOUNT_ACK_FILE,
    constants.O_RDONLY | constants.O_NOFOLLOW | (constants.O_CLOEXEC ?? 0))
  try {
    const before = fstatSync(readFd, { bigint: true })
    const observed = readFileSync(readFd)
    const after = fstatSync(readFd, { bigint: true })
    if (!before.isFile() || before.uid !== 505n || before.nlink !== 1n
        || (before.mode & 0o777n) !== 0o600n || before.size !== BigInt(bytes.length)
        || before.dev !== after.dev || before.ino !== after.ino
        || before.size !== after.size || before.mtimeNs !== after.mtimeNs
        || before.ctimeNs !== after.ctimeNs || sha256(observed) !== sha256(bytes)) {
      throw new TypeError('HR cut mount acknowledgement: readback unknown')
    }
  } finally { closeSync(readFd) }
  return Object.freeze({ acknowledgementSha256: sha256(bytes), ...ack })
}
