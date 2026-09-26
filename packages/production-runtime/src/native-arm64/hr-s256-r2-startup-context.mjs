/** Private fixed-root startup context; no environment/config can install it. */
import { spawnSync } from 'node:child_process'
import { fstatSync, readSync, writeSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const OP = 'hr-s256-trusted-quiescence-cut-20260925-v1'
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
function reject(reason) { throw Object.assign(new Error(reason), { code: reason }) }
function fd(value) { const n = Number(value); if ((typeof value !== 'number' && !/^[0-9]+$/.test(value ?? '')) || !Number.isSafeInteger(n) || n < 3) reject('R2_DESCRIPTOR_INVALID'); return n }

export function parsedStartupInvocation(argv) {
  const names = new Set(['--hr-r2-receipt-sha256', '--hr-r2-challenge-fd', '--hr-r2-window-fd', '--hr-r2-receipt-fds'])
  const values = new Map(), runtimeArgs = []
  for (let i = 0; i < argv.length; i++) {
    if (!names.has(argv[i])) { if (argv[i].startsWith('--hr-r2-')) reject('R2_INVOCATION_INVALID'); runtimeArgs.push(argv[i]); continue }
    if (values.has(argv[i]) || i + 1 >= argv.length) reject('R2_INVOCATION_INVALID')
    values.set(argv[i], argv[++i])
  }
  const receipt = values.get('--hr-r2-receipt-sha256')
  if (!/^[a-f0-9]{64}$/.test(receipt ?? '') || values.size !== 4) reject('R2_INVOCATION_INVALID')
  const challengeFd = fd(values.get('--hr-r2-challenge-fd')), windowFd = fd(values.get('--hr-r2-window-fd'))
  let descriptors
  try { descriptors = JSON.parse(values.get('--hr-r2-receipt-fds')) } catch { reject('R2_INVOCATION_INVALID') }
  // Fixed slots: two directories, nineteen receipt files, two deployment files.
  if (!Array.isArray(descriptors) || descriptors.length !== FIXED_RECEIPT_NAMES.length + 4) reject('R2_DESCRIPTOR_INVALID')
  const terminal = new Set([15, 16, 17, 18].map(n => n + 2))
  descriptors.forEach((value, index) => { if (value === -1 && terminal.has(index)) return; if (typeof value !== 'number') reject('R2_DESCRIPTOR_INVALID'); fd(value) })
  const active = [challengeFd, windowFd, ...descriptors.filter(n => n !== -1)]
  if (new Set(active).size !== active.length) reject('R2_DESCRIPTOR_INVALID')
  return { receipt, challengeFd, windowFd, descriptors, runtimeArgs }
}

export function readonlyReceiptIO(invocation) {
  const paths = new Map([[EVIDENCE, invocation.descriptors[0]], [DEPLOYMENT, invocation.descriptors[1]],
    [`${EVIDENCE}/window.lock`, invocation.windowFd]])
  FIXED_RECEIPT_NAMES.forEach((name, index) => paths.set(`${EVIDENCE}/${name}`, invocation.descriptors[index + 2]))
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
    readdir(path) { bounded(path); if (path !== EVIDENCE) reject('R2_RECEIPT_PATH_INVALID'); return ['bundle.json'] },
    challengeWindow(descriptor, query) {
      if (authenticatedEvidenceIO === undefined) reject('R2_STARTUP_PROOF_REJECTED')
      return authenticatedEvidenceIO.challengeWindow(descriptor, query)
    },
  })
}

export function getFixedStartupContext() { return installed }

/** Completion notice only; root independently validates the actual store. */
export function signalFixedStartupConsumptionFinished() {
  if (installed === undefined) return
  const { hostId, startupNonce, challengeFd } = installed.startup
  const notice = Buffer.from(JSON.stringify({ operationId: OP, hostId, startupNonce,
    challenge: 'startup-consumption-finished' }) + '\n')
  if (writeSync(challengeFd, notice) !== notice.length) reject('R2_COMPLETION_NOTICE_INCOMPLETE')
}

export async function authenticateFixedStartupContext() {
  if (installed !== undefined) reject('R2_STARTUP_CONTEXT_NO_REPLAY')
  const invocation = parsedStartupInvocation(process.argv.slice(2))
  const authorizationFd = invocation.descriptors[3]
  const result = spawnSync('/usr/bin/python3', ['-I', '-S', HELPER, '--startup-prove', '3', '4', invocation.receipt, '5'], {
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
  const raw = io.readFile(`${EVIDENCE}/launch-authorization.json`)
  if (createHash('sha256').update(raw).digest('hex') !== invocation.receipt) reject('R2_STARTUP_CONTEXT_MISMATCH')
  const authorization = JSON.parse(raw).authorization
  for (const name of ['hostId', 'startupNonce', 'consumingBinarySha256']) {
    if (authorization[name] !== startup[name]) reject('R2_STARTUP_CONTEXT_MISMATCH')
  }
  // No Router module loads until the real root/OFD/receipt proof succeeds.
  const { defaultEvidenceIO } = await import('../../../agent-router/src/reconciliation/quiescence-custody.js')
  authenticatedEvidenceIO = defaultEvidenceIO
  installed = Object.freeze({ evidenceDir: EVIDENCE, deploymentDir: DEPLOYMENT,
    startup: Object.freeze({ ...startup, windowFd: invocation.windowFd, challengeFd: invocation.challengeFd }), io })
  return invocation.runtimeArgs
}
