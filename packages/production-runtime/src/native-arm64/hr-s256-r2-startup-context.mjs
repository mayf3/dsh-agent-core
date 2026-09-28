/** Private fixed-root startup context; no environment/config can install it. */
import { spawnSync } from 'node:child_process'
import { fstatSync, readSync, writeSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { Socket } from 'node:net'

const OP = 'hr-s256-trusted-quiescence-cut-20260925-v1'
const ADMIN_OP = 'hr-s256-admin-emergency-cut-20260928-v1'
const EVIDENCE = `/private/var/db/agent-deploy-system/${OP}`
const DEPLOYMENT = '/private/var/db/agent-deploy-system/hr-s256-deployment-proof'
const HELPER = fileURLToPath(new URL('./hr-s256-r2-child-proof.py', import.meta.url))
export const FIXED_RECEIPT_NAMES = Object.freeze([
  'intent.json', 'launch-authorization.json', 'bundle-commitment.json', 'live-handle-index.json',
  'phase-sealed.json', 'phase-launch-attempt.json', 'launch-claimed.json', 'bundle.json',
  'exclusive-window.json', 'launch-sources-inhibited.json', 'old-tree-quiesced.json',
  'controlled-stop.json', 'census-ps.txt', 'census-lsof.txt', 'census-archive.json',
  'phase-unknown.json', 'phase-abandoned.json', 'phase-closed.json', 'key-tombstone.json',
])
let installed
let authenticatedEvidenceIO
let admissionListenerInstalled = false
let qualificationAttempted = false
let qualification
const qualificationReplies = new WeakMap()
const qualificationReplyWaiters = new WeakMap()
function reject(reason) { throw Object.assign(new Error(reason), { code: reason }) }
function fd(value) { const n = Number(value); if ((typeof value !== 'number' && !/^[0-9]+$/.test(value ?? '')) || !Number.isSafeInteger(n) || n < 3) reject('R2_DESCRIPTOR_INVALID'); return n }

/** Separate original-executor qualification grammar; no HR receipt slots. */
export function parsedQualificationInvocation(argv) {
  const names = new Set(['--hr-qf-context-sha256', '--hr-qf-challenge-fd', '--hr-qf-window-fd', '--hr-qf-context-fd'])
  const values = new Map(), runtimeArgs = []
  for (let i = 0; i < argv.length; i++) {
    if (!names.has(argv[i])) {
      if (/^--hr-/.test(argv[i])) reject('QF_INVOCATION_INVALID')
      runtimeArgs.push(argv[i]); continue
    }
    if (values.has(argv[i]) || i + 1 >= argv.length) reject('QF_INVOCATION_INVALID')
    values.set(argv[i], argv[++i])
  }
  const digest = values.get('--hr-qf-context-sha256')
  if (!/^[a-f0-9]{64}$/.test(digest ?? '') || values.size !== 4) reject('QF_INVOCATION_INVALID')
  const challengeFd = fd(values.get('--hr-qf-challenge-fd')), windowFd = fd(values.get('--hr-qf-window-fd'))
  const contextFd = fd(values.get('--hr-qf-context-fd'))
  if (new Set([challengeFd, windowFd, contextFd]).size !== 3) reject('QF_DESCRIPTOR_INVALID')
  return { digest, challengeFd, windowFd, contextFd, runtimeArgs }
}

function parseFixedStartupInvocation(argv, prefix, operationId) {
  const names = new Set([`${prefix}receipt-sha256`, `${prefix}challenge-fd`,
    `${prefix}window-fd`, `${prefix}receipt-fds`])
  const values = new Map(), runtimeArgs = []
  for (let i = 0; i < argv.length; i++) {
    if (!names.has(argv[i])) { if (argv[i].startsWith('--hr-')) reject('R2_INVOCATION_INVALID'); runtimeArgs.push(argv[i]); continue }
    if (values.has(argv[i]) || i + 1 >= argv.length) reject('R2_INVOCATION_INVALID')
    values.set(argv[i], argv[++i])
  }
  const receipt = values.get(`${prefix}receipt-sha256`)
  if (!/^[a-f0-9]{64}$/.test(receipt ?? '') || values.size !== 4) reject('R2_INVOCATION_INVALID')
  const challengeFd = fd(values.get(`${prefix}challenge-fd`)), windowFd = fd(values.get(`${prefix}window-fd`))
  let descriptors
  try { descriptors = JSON.parse(values.get(`${prefix}receipt-fds`)) } catch { reject('R2_INVOCATION_INVALID') }
  // Fixed slots: two directories, nineteen receipt files, two deployment files.
  if (!Array.isArray(descriptors) || descriptors.length !== FIXED_RECEIPT_NAMES.length + 4) reject('R2_DESCRIPTOR_INVALID')
  const terminal = new Set([15, 16, 17, 18].map(n => n + 2))
  descriptors.forEach((value, index) => { if (value === -1 && terminal.has(index)) return; if (typeof value !== 'number') reject('R2_DESCRIPTOR_INVALID'); fd(value) })
  const active = [challengeFd, windowFd, ...descriptors.filter(n => n !== -1)]
  if (new Set(active).size !== active.length) reject('R2_DESCRIPTOR_INVALID')
  return { operationId, receipt, challengeFd, windowFd, descriptors, runtimeArgs }
}

export function parsedStartupInvocation(argv) {
  return parseFixedStartupInvocation(argv, '--hr-r2-', OP)
}

export function parsedAdminStartupInvocation(argv) {
  return parseFixedStartupInvocation(argv, '--hr-admin-', ADMIN_OP)
}

export function readonlyReceiptIO(invocation) {
  if (invocation.operationId !== OP && invocation.operationId !== ADMIN_OP) reject('R2_OPERATION_UNKNOWN')
  const evidence = `/private/var/db/agent-deploy-system/${invocation.operationId}`
  const paths = new Map([[evidence, invocation.descriptors[0]], [DEPLOYMENT, invocation.descriptors[1]],
    [`${evidence}/window.lock`, invocation.windowFd]])
  FIXED_RECEIPT_NAMES.forEach((name, index) => paths.set(`${evidence}/${name}`, invocation.descriptors[index + 2]))
  paths.set(`${DEPLOYMENT}/floor-proven.json`, invocation.descriptors.at(-2))
  paths.set(`${DEPLOYMENT}/validator-installed.json`, invocation.descriptors.at(-1))
  const bounded = path => {
    if (!paths.has(path)) reject('R2_RECEIPT_PATH_INVALID')
    const descriptor = paths.get(path)
    if (descriptor === -1) throw Object.assign(new Error('root observed absent before sole launch'), { code: 'ENOENT' })
    const meta = fstatSync(descriptor)
    if (meta.uid !== 0 || (meta.mode & 0o022) || meta.size > 65536) reject('R2_RECEIPT_CUSTODY')
    return { descriptor, meta }
  }
  // Missing terminal descriptors are an initial root observation only. Every
  // settlement still challenges the live owner, which denies after UNKNOWN.
  return Object.freeze({
    stat: path => bounded(path).meta,
    fstat: fstatSync,
    readFile(path) {
      const { descriptor, meta } = bounded(path), bytes = Buffer.alloc(meta.size)
      let count = 0
      while (count < bytes.length) {
        const n = readSync(descriptor, bytes, count, bytes.length - count, count)
        if (n === 0) reject('R2_RECEIPT_SHORT_READ')
        count += n
      }
      return bytes
    },
    readdir(path) { bounded(path); if (path !== evidence) reject('R2_RECEIPT_PATH_INVALID'); return ['bundle.json'] },
    challengeWindow(descriptor, query) {
      if (authenticatedEvidenceIO === undefined) reject('R2_STARTUP_PROOF_REJECTED')
      return authenticatedEvidenceIO.challengeWindow(descriptor, query)
    },
  })
}

export function getFixedStartupContext() { return installed }
export function hasFixedQualificationContext() { return qualification !== undefined }
/** Private Router composition only; no service or caller-facing selector. */
export function getFixedAdminQualificationContext() {
  return qualification?.context.role === 'original_executor_admin_qualification'
    ? qualification.context : undefined
}

/** Completion notice only; root independently validates the actual store. */
export function signalFixedStartupConsumptionFinished() {
  if (installed === undefined) return
  const { hostId, startupNonce, challengeFd } = installed.startup
  const notice = Buffer.from(JSON.stringify({ operationId: installed.operationId, hostId, startupNonce,
    challenge: 'startup-consumption-finished' }) + '\n')
  if (writeSync(challengeFd, notice) !== notice.length) reject('R2_COMPLETION_NOTICE_INCOMPLETE')
}

export async function authenticateFixedStartupContext() {
  if (installed !== undefined || qualificationAttempted) reject('R2_STARTUP_CONTEXT_NO_REPLAY')
  if (process.argv.slice(2).some(arg => arg.startsWith('--hr-qf-'))) return authenticateQualificationContext()
  const admin = process.argv.slice(2).some(arg => arg.startsWith('--hr-admin-'))
  const invocation = admin ? parsedAdminStartupInvocation(process.argv.slice(2))
    : parsedStartupInvocation(process.argv.slice(2))
  const evidence = `/private/var/db/agent-deploy-system/${invocation.operationId}`
  const authorizationFd = invocation.descriptors[3]
  const result = spawnSync('/usr/bin/python3', ['-I', '-S', HELPER,
    admin ? '--startup-prove-admin' : '--startup-prove', '3', '4', invocation.receipt, '5'], {
    stdio: ['ignore', 'pipe', 'pipe', invocation.challengeFd, invocation.windowFd, authorizationFd],
    env: { PATH: '/usr/bin:/bin', PYTHONNOUSERSITE: '1', PYTHONDONTWRITEBYTECODE: '1' },
    timeout: 750, maxBuffer: 2048, encoding: 'utf8',
  })
  if (result.error || result.status !== 0) reject('R2_STARTUP_PROOF_REJECTED')
  let startup
  try { startup = JSON.parse(result.stdout) } catch { reject('R2_STARTUP_PROOF_REJECTED') }
  if (!startup || Object.keys(startup).sort().join(',') !== 'consumingBinarySha256,hostId,recoveryPlanStopsRuntime,startupNonce'
      || startup.recoveryPlanStopsRuntime !== true || !/^[a-f0-9]{64}$/.test(startup.consumingBinarySha256)
      || typeof startup.hostId !== 'string' || typeof startup.startupNonce !== 'string') reject('R2_STARTUP_PROOF_REJECTED')
  const io = readonlyReceiptIO(invocation)
  // Resolve and bind the passed auth FD again; no helper stdout alone is proof.
  const raw = io.readFile(`${evidence}/launch-authorization.json`)
  if (createHash('sha256').update(raw).digest('hex') !== invocation.receipt) reject('R2_STARTUP_CONTEXT_MISMATCH')
  const authorization = JSON.parse(raw).authorization
  for (const name of ['hostId', 'startupNonce', 'consumingBinarySha256']) {
    if (authorization[name] !== startup[name]) reject('R2_STARTUP_CONTEXT_MISMATCH')
  }
  // No Router module loads until the real root/OFD/receipt proof succeeds.
  const { defaultEvidenceIO } = await import('../../../agent-router/src/reconciliation/quiescence-custody.js')
  authenticatedEvidenceIO = defaultEvidenceIO
  installed = Object.freeze({ operationId: invocation.operationId, evidenceDir: evidence,
    deploymentDir: DEPLOYMENT, receipt: invocation.receipt,
    startup: Object.freeze({ ...startup, windowFd: invocation.windowFd, challengeFd: invocation.challengeFd }), io })
  return invocation.runtimeArgs
}

function qualificationBytes(invocation) {
  const descriptor = invocation.contextFd, before = fstatSync(descriptor)
  const valid = m => m.isFile() && m.uid === 0 && m.nlink === 1 && (m.mode & 0o777) === 0o600
    && Number.isSafeInteger(m.size) && m.size > 0 && m.size <= 2048
  if (!valid(before)) reject('QF_CONTEXT_CUSTODY')
  const raw = Buffer.alloc(before.size)
  let count = 0
  while (count < raw.length) {
    const n = readSync(descriptor, raw, count, raw.length - count, count)
    if (n === 0) reject('QF_CONTEXT_SHORT_READ')
    count += n
  }
  const after = fstatSync(descriptor)
  const identity = m => [m.dev, m.ino, m.uid, m.mode, m.nlink, m.size, m.mtimeMs, m.ctimeMs].join(':')
  if (!valid(after) || identity(before) !== identity(after)
      || createHash('sha256').update(raw).digest('hex') !== invocation.digest) reject('QF_CONTEXT_CHANGED')
  return raw
}

async function authenticateQualificationContext() {
  const invocation = parsedQualificationInvocation(process.argv.slice(2))
  qualificationAttempted = true // Any fallible attempt is terminal in this child.
  const before = qualificationBytes(invocation)
  const result = spawnSync('/usr/bin/python3', ['-I', '-S', HELPER, '--qualification-prove', '3', '4', invocation.digest, '5'], {
    stdio: ['ignore', 'pipe', 'pipe', invocation.challengeFd, invocation.windowFd, invocation.contextFd],
    env: { PATH: '/usr/bin:/bin', PYTHONNOUSERSITE: '1', PYTHONDONTWRITEBYTECODE: '1' },
    timeout: 750, maxBuffer: 2048, encoding: 'utf8',
  })
  if (result.error || result.status !== 0) reject('QF_STARTUP_PROOF_REJECTED')
  let observed, context
  try { observed = JSON.parse(result.stdout); context = JSON.parse(before) } catch { reject('QF_STARTUP_PROOF_REJECTED') }
  const keys = ['role', 'phase', 'consumingBinarySha256', 'validatorSha256', 'entryManifestSha256', 'procedureSha256', 'startupNonce'].sort()
  if (!observed || Object.keys(observed).sort().join(',') !== keys.join(',')
      || !context || Object.keys(context).sort().join(',') !== keys.join(',')
      || keys.some(key => observed[key] !== context[key])
      || ![['original_executor_qualification', 'd8cfc5a3925c29ee843258a8077f57f4d8223f44bf697bbd24edba011753911e'],
        ['original_executor_admin_qualification', 'b1a1d5e148143c5ddf43fd644cb377cf7f74a4c561354b9098d80bd8c6933d44']]
        .some(([role, digest]) => context.role === role && context.procedureSha256 === digest)
      || !['deployment_start', 'restart_a', 'restart_b'].includes(context.phase)
      || ['consumingBinarySha256', 'validatorSha256', 'entryManifestSha256', 'startupNonce']
        .some(key => !/^[a-f0-9]{64}$/.test(context[key] ?? ''))) reject('QF_CONTEXT_BINDING')
  if (!qualificationBytes(invocation).equals(before)) reject('QF_CONTEXT_CHANGED')
  qualification = Object.freeze({ context: Object.freeze({ ...context }), challengeFd: invocation.challengeFd })
  // Deliberately do not set installed, import HR evidence IO, or consume any
  // bundle/operation ID. Existing Router floor/validator/fences remain active.
  return invocation.runtimeArgs
}


/** Separate ephemeral H5 frame; read the actual provided service on each request. */
export function runtimeAdmissionProjection(query, service, binding) {
  const keys = ['operationId', 'hostId', 'startupNonce', 'challenge',
    'launchAuthorizationReceiptSha256', 'reconciliationHandle']
  const operationId = binding?.operationId ?? OP
  if (operationId !== OP && operationId !== ADMIN_OP) reject('R2_ADMISSION_BINDING')
  if (!query || typeof query !== 'object' || Object.keys(query).length !== keys.length
      || keys.some(key => !Object.hasOwn(query, key)) || query.operationId !== operationId
      || query.hostId !== binding.hostId || query.startupNonce !== binding.startupNonce
      || query.launchAuthorizationReceiptSha256 !== binding.receipt
      || query.reconciliationHandle !== 'turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256'
      || !/^[a-f0-9]{32}$/.test(query.challenge ?? '')) reject('R2_ADMISSION_BINDING')
  const runtime = service.reconciliationRuntimeStatus()
  const fields = ['generationId', 'health', 'businessAdmission', 'blockedReason', 'unresolvedRecoveries']
  if (!runtime || typeof runtime !== 'object' || Object.keys(runtime).length !== fields.length
      || fields.some(key => !Object.hasOwn(runtime, key))
      || typeof runtime.generationId !== 'string' || runtime.generationId.length < 1 || runtime.generationId.length > 128
      || !['healthy', 'blocked'].includes(runtime.health)
      || !['open', 'fail_closed'].includes(runtime.businessAdmission)
      || (runtime.blockedReason !== null && (typeof runtime.blockedReason !== 'string' || runtime.blockedReason.length > 128))
      || !Number.isSafeInteger(runtime.unresolvedRecoveries) || runtime.unresolvedRecoveries < 0) reject('R2_ADMISSION_SHAPE')
  return { ...query, runtime: { ...runtime } }
}

/** Existing authenticated socket only, after the actual Router service provision. */
export function publishFixedRuntimeAdmission(service, reconciliationStore, ensureFixedAdminProcess) {
  if (qualification?.context.role === 'original_executor_admin_qualification') {
    publishAdminQualificationRuntime(service, reconciliationStore, ensureFixedAdminProcess); return
  }
  if (qualification !== undefined) { publishQualificationRuntime(service, reconciliationStore); return }
  if (installed === undefined) return
  if (admissionListenerInstalled) reject('R2_ADMISSION_NO_REPLAY')
  admissionListenerInstalled = true
  const channel = new Socket({ fd: installed.startup.challengeFd, readable: true, writable: true })
  let bytes = Buffer.alloc(0), used = false
  const timer = setTimeout(() => channel.destroy(), 120000)
  timer.unref()
  channel.on('close', () => clearTimeout(timer))
  channel.on('error', () => channel.destroy())
  channel.on('data', part => {
    try {
      if (used || bytes.length + part.length > 4096) reject('R2_ADMISSION_NO_REPLAY')
      bytes = Buffer.concat([bytes, part])
      if (!bytes.includes(10)) return
      if (bytes.at(-1) !== 10 || bytes.subarray(0, -1).includes(10)) reject('R2_ADMISSION_SHAPE')
      used = true
      const query = JSON.parse(bytes)
      const frame = runtimeAdmissionProjection(query, service,
        { ...installed.startup, operationId: installed.operationId, receipt: installed.receipt })
      channel.write(JSON.stringify(frame) + '\n')
    } catch { channel.destroy() } // Root observes UNKNOWN, never a positive stub.
  })
  channel.unref()
}


/** Private QF view from the actual provided Router, never an HR frame. */
export function qualificationRuntimeProjection(query, service, binding, reconciliationStore) {
  const fields = ['role','phase','consumingBinarySha256','validatorSha256','entryManifestSha256','procedureSha256','startupNonce'].sort()
  if (!binding || Object.keys(binding).sort().join(',') !== fields.join(',')
      || binding.role !== 'original_executor_qualification'
      || !['deployment_start','restart_a','restart_b'].includes(binding.phase)
      || binding.procedureSha256 !== 'd8cfc5a3925c29ee843258a8077f57f4d8223f44bf697bbd24edba011753911e'
      || ['consumingBinarySha256','validatorSha256','entryManifestSha256','startupNonce'].some(k => !/^[a-f0-9]{64}$/.test(binding[k] ?? ''))) reject('QF_READBACK_BINDING')
  if (!query || Object.keys(query).sort().join(',') !== 'challenge,context,deadlineMonotonicNs,handle'
      || !query.context || Object.keys(query.context).sort().join(',') !== Object.keys(binding).sort().join(',')
      || Object.keys(binding).some(key => query.context[key] !== binding[key])
      || !/^[a-f0-9]{32}$/.test(query.challenge ?? '')
      || !/^[0-9]{1,20}$/.test(query.deadlineMonotonicNs ?? '')
      || typeof query.handle !== 'string' || query.handle.length > 256) reject('QF_READBACK_BINDING')
  // Fixed Darwin carrier: Python monotonic and libuv hrtime use the same
  // kernel monotonic epoch. This private frame never resets Root's deadline.
  const deadline = BigInt(query.deadlineMonotonicNs)
  if (process.hrtime.bigint() >= deadline) reject('QF_READBACK_DEADLINE')
  const runtime = service.reconciliationRuntimeStatus()
  const result = service.getTurnReconciliation(query.handle)
  const record = result?.snapshot
  if (!runtime || runtime.health !== 'healthy' || runtime.businessAdmission !== 'open'
      || typeof runtime.generationId !== 'string' || !runtime.generationId
      || result.state !== 'settled' || !record || record.agentId !== 'agt_cto-agent'
      || record.handle !== query.handle || record.runtimeEpoch !== runtime.generationId
      || record.settlementResult !== 'completed' || record.fenceState !== 'cleared'
      || !record.finalAssistantOutput || record.finalAssistantOutput.originalBytes <= 0
      || typeof record.messageId !== 'string' || !record.messageId
      || record.ingressCorrelation?.channelNamespace !== 'feishu'
      || typeof record.ingressCorrelation.feishuMessageId !== 'string') reject('QF_OWNED_TURN_UNKNOWN')
  const hash = value => createHash('sha256').update(value).digest('hex')
  const delivered = qualificationReplies.get(reconciliationStore)
  if (!delivered || delivered.unknown || delivered.handle !== query.handle
      || delivered.runtimeEpoch !== runtime.generationId
      || delivered.nonce !== binding.startupNonce) reject('QF_REPLY_COMPLETION_UNKNOWN')
  if (process.hrtime.bigint() >= deadline) reject('QF_READBACK_DEADLINE')
  return { context: { ...binding }, challenge: query.challenge, handle: query.handle,
    runtimeGeneration: runtime.generationId, processGeneration: record.processGeneration,
    nativeMessageSha256: hash(record.ingressCorrelation.feishuMessageId),
    nativeReceiptSha256: hash(record.messageId), completedAtWallMs: record.updatedAt,
    replyReceiptSha256: delivered.replyReceiptSha256 }
}

/** Only the actual ingress resolved-reply callsite receives this private closure. */
export function qualificationReplyObserver(store) {
  if (!qualification) return undefined
  const nonce = qualification.context.startupNonce
  const runtimeEpoch = store.occupancy().runtimeEpoch
  return (handle, result) => {
    try {
    const record = store.getTurnReconciliation(handle)?.snapshot
    if (record?.agentId !== 'agt_cto-agent') return
    const previous = qualificationReplies.get(store)
    const keys = Object.keys(result ?? {}).sort().join(',')
    if (previous || record.runtimeEpoch !== runtimeEpoch || record.handle !== handle
        || record.settlementResult !== 'completed'
        || !['chatId,messageId,method','chatId,chunkIds,messageId,method'].includes(keys)
        || typeof result.messageId !== 'string' || !result.messageId || result.messageId.length > 256
        || typeof result.chatId !== 'string' || !result.chatId || result.chatId.length > 256
        || result.method !== 'reply'
        || (result.chunkIds !== undefined && (!Array.isArray(result.chunkIds)
          || result.chunkIds.length > 256 || result.chunkIds.some(id => typeof id !== 'string' || !id || id.length > 256)))) {
      qualificationReplies.set(store, { unknown: true })
      return
    }
    qualificationReplies.set(store, { handle, runtimeEpoch, nonce,
      replyReceiptSha256: createHash('sha256').update(JSON.stringify(result)).digest('hex') })
    } catch {
      qualificationReplies.set(store, { unknown: true })
    } finally {
      qualificationReplyWaiters.get(store)?.()
    } // Read-only observer failure never sends another transport reply.
  }
}

/** One private admin canary on the authenticated qualification socket. The
 * Router passes its privately held registry closure; a query cannot select
 * an Agent, prompt, route, child, receipt or capability. */
export async function fixedAdminCanaryProjection(query, service, binding, store, ensureFixedAdminProcess) {
  const fields = ['role','phase','consumingBinarySha256','validatorSha256','entryManifestSha256','procedureSha256','startupNonce'].sort()
  if (!binding || Object.keys(binding).sort().join(',') !== fields.join(',')
      || binding.role !== 'original_executor_admin_qualification'
      || binding.procedureSha256 !== 'b1a1d5e148143c5ddf43fd644cb377cf7f74a4c561354b9098d80bd8c6933d44'
      || !['deployment_start','restart_a','restart_b'].includes(binding.phase)
      || ['consumingBinarySha256','validatorSha256','entryManifestSha256','startupNonce']
        .some(key => !/^[a-f0-9]{64}$/.test(binding[key] ?? ''))) reject('QF_ADMIN_BINDING')
  if (!query || Object.keys(query).sort().join(',') !== 'challenge,context,deadlineMonotonicNs'
      || !query.context || Object.keys(query.context).sort().join(',') !== fields.join(',')
      || fields.some(key => query.context[key] !== binding[key])
      || !/^[a-f0-9]{32}$/.test(query.challenge ?? '')
      || !/^[0-9]{1,20}$/.test(query.deadlineMonotonicNs ?? '')) reject('QF_ADMIN_QUERY')
  const deadline = BigInt(query.deadlineMonotonicNs)
  const before = () => { if (process.hrtime.bigint() >= deadline) reject('QF_ADMIN_DEADLINE') }
  before()
  store.assertBusinessAdmissionReady()
  if (store.activeFenceForAgent('agt_efficiency-agent') !== null) reject('QF_ADMIN_AGENT_FENCED')
  const proc = await ensureFixedAdminProcess()
  before()
  const expected = { role:'fixed_admin_qualification',agentId:'agt_efficiency-agent',
    phase:binding.phase,hostId:'FF99ABD5-79A0-5EE0-9E0B-B62671271560',
    packageSha256:binding.entryManifestSha256,
    consumingBinarySha256:binding.consumingBinarySha256,startupNonce:binding.startupNonce,
    processGeneration:proc?.processGeneration }
  if (!proc || !Number.isSafeInteger(proc.processGeneration) || proc.processGeneration < 1
      || Object.keys(proc.fixedAdminQualification ?? {}).sort().join(',') !== Object.keys(expected).sort().join(',')
      || Object.keys(expected).some(key => proc.fixedAdminQualification[key] !== expected[key])
      || proc.fixedAdminEffectAttempted) reject('QF_ADMIN_CHILD_UNKNOWN')
  const result = await proc.qualifyFixedTurn()
  before()
  if (proc.fixedAdminEffectAttempted || result?.status !== 'completed'
      || typeof result.reconciliationHandle !== 'string' || !result.reconciliationHandle
      || typeof result.messageId !== 'string' || !result.messageId
      || typeof result.reply !== 'string' || !result.reply) reject('QF_ADMIN_COMPLETION_UNKNOWN')
  const runtime = service.reconciliationRuntimeStatus()
  const durable = store.getTurnReconciliation(result.reconciliationHandle)
  const record = durable?.snapshot
  if (!runtime || runtime.health !== 'healthy' || runtime.businessAdmission !== 'open'
      || typeof runtime.generationId !== 'string' || !runtime.generationId
      || durable.state !== 'settled' || !record
      || record.handle !== result.reconciliationHandle
      || record.agentId !== 'agt_efficiency-agent'
      || record.runtimeEpoch !== runtime.generationId
      || record.processGeneration !== proc.processGeneration
      || record.settlementResult !== 'completed' || record.fenceState !== 'armed'
      || record.messageId !== result.messageId
      || !(record.finalAssistantOutput?.originalBytes > 0)
      || record.finalAssistantOutput.truncated !== false
      || record.finalAssistantOutput.text !== result.reply
      || proc.fixedAdminEffectAttempted) reject('QF_ADMIN_DURABLE_UNKNOWN')
  before()
  const hash = value => createHash('sha256').update(value).digest('hex')
  return { context:{...binding},challenge:query.challenge,
    handle:record.handle,runtimeGeneration:runtime.generationId,
    processGeneration:proc.processGeneration,
    nativeMessageSha256:hash(record.messageId),
    nativeReceiptSha256:hash(`${record.handle}\0${result.messageId}`),
    replySha256:hash(result.reply),
    completedAtWallMs:record.updatedAt }
}

function publishAdminQualificationRuntime(service, store, ensureFixedAdminProcess) {
  if (admissionListenerInstalled || typeof ensureFixedAdminProcess !== 'function') reject('QF_ADMIN_LISTENER_UNAVAILABLE')
  admissionListenerInstalled = true
  const channel = new Socket({ fd: qualification.challengeFd, readable: true, writable: true })
  let bytes = Buffer.alloc(0), used = false, closed = false
  const timer = setTimeout(() => channel.destroy(), 120000)
  timer.unref()
  channel.on('close', () => { closed = true; clearTimeout(timer) })
  channel.on('error', () => channel.destroy())
  channel.on('data', async part => {
    try {
      if (closed || used || bytes.length + part.length > 4096) reject('QF_ADMIN_NO_REPLAY')
      bytes = Buffer.concat([bytes, part])
      if (!bytes.includes(10)) return
      if (bytes.at(-1) !== 10 || bytes.subarray(0,-1).includes(10)) reject('QF_ADMIN_QUERY')
      used = true
      const raw = bytes.subarray(0,-1).toString('utf8')
      const query = JSON.parse(raw)
      const canonical = value => value && typeof value === 'object' && !Array.isArray(value)
        ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
        : JSON.stringify(value)
      if (raw !== canonical(query)) reject('QF_ADMIN_QUERY')
      const frame = await fixedAdminCanaryProjection(query, service, qualification.context,
        store, ensureFixedAdminProcess)
      if (closed || process.hrtime.bigint() >= BigInt(query.deadlineMonotonicNs)) reject('QF_ADMIN_DEADLINE')
      channel.write(JSON.stringify(frame) + '\n')
    } catch { channel.destroy() } // Root retains UNKNOWN; no retry or fallback.
  })
  channel.unref()
}

function publishQualificationRuntime(service, reconciliationStore) {
  if (admissionListenerInstalled) reject('QF_READBACK_NO_REPLAY')
  admissionListenerInstalled = true
  const channel = new Socket({ fd: qualification.challengeFd, readable: true, writable: true })
  let bytes = Buffer.alloc(0), used = false, closed = false
  const timer = setTimeout(() => channel.destroy(), 120000)
  timer.unref()
  channel.on('close', () => {
    closed = true; clearTimeout(timer)
    qualificationReplyWaiters.get(reconciliationStore)?.()
  })
  channel.on('error', () => channel.destroy())
  channel.on('data', async part => {
    try {
      if (closed || used || bytes.length + part.length > 4096) reject('QF_READBACK_NO_REPLAY')
      bytes = Buffer.concat([bytes, part])
      if (!bytes.includes(10)) return
      if (bytes.at(-1) !== 10 || bytes.subarray(0,-1).includes(10)) reject('QF_READBACK_SHAPE')
      used = true
      const query = JSON.parse(bytes)
      try {
        qualificationRuntimeProjection(query, service, qualification.context, reconciliationStore)
      } catch (error) {
        if (error.code !== 'QF_REPLY_COMPLETION_UNKNOWN'
            || qualificationReplies.has(reconciliationStore)) throw error
        // Store settlement can precede the original awaited transport return.
        // Hold this ONE query; never repeat the turn or issue another query.
        await new Promise((resolve, rejectWait) => {
          const remaining = Number(BigInt(query.deadlineMonotonicNs) - process.hrtime.bigint()) / 1e6
          if (!(remaining > 0)) { rejectWait(new Error('QF_READBACK_DEADLINE')); return }
          const pending = setTimeout(() => { qualificationReplyWaiters.delete(reconciliationStore); rejectWait(new Error('QF_READBACK_DEADLINE')) }, remaining)
          qualificationReplyWaiters.set(reconciliationStore, () => {
            clearTimeout(pending); qualificationReplyWaiters.delete(reconciliationStore); resolve()
          })
        })
      }
      if (closed) reject('QF_READBACK_NO_REPLAY')
      channel.write(JSON.stringify(qualificationRuntimeProjection(query,service,
        qualification.context, reconciliationStore)) + '\n')
    } catch { channel.destroy() }
  })
  channel.unref()
}
