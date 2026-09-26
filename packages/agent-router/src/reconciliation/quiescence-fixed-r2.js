/** Fixed R2 journal adapter only. Root custody/live window remain separate gates. */
import { basename, join } from 'node:path'
import { ownedFile, proofReject, sha256 } from './quiescence-custody.js'

export const FIXED_R2_OPERATION = 'hr-s256-trusted-quiescence-cut-20260925-v1'
const HANDLE = 'turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256'
const HASH = /^[a-f0-9]{64}$/
const exact = (value, names) => value !== null && typeof value === 'object'
  && !Array.isArray(value) && Object.keys(value).length === names.length
  && names.every(name => Object.hasOwn(value, name))
const time = value => Number.isSafeInteger(value) && value >= 0
const require = ok => { if (!ok) proofReject('V9_fixed_journal_invalid') }

// Match the existing Python root journal's closed, sorted, ASCII JSON bytes.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort()
    .map(key => `${canonical(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, char =>
    `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

function receipt(dir, name, io) {
  const path = join(dir, `${name}.json`)
  const bytes = ownedFile(path, 65536, io)
  require((io.stat(path).mode & 0o777) === 0o600)
  let value
  try { value = JSON.parse(bytes.toString('utf8')) } catch { proofReject('V9_fixed_journal_invalid') }
  require(bytes.toString('utf8') === canonical(value)) // duplicate keys/noncanonical rejected
  return { value, digest: sha256(bytes) }
}

export function resolveFixedR2Journal(bundleFile, bytes, bundle, evidenceDir, io) {
  require(basename(bundleFile) === 'bundle.json' && basename(evidenceDir) === FIXED_R2_OPERATION)
  require(bytes.toString('utf8') === canonical(bundle))
  const cut = bundle.recoveryCutover
  require(bundle.subject.reconciliationHandle === HANDLE && bundle.subject.turnExecutionId === HANDLE
    && bundle.subject.agentId === 'agt_hr-agent' && bundle.subject.processGeneration === 1)
  // Missing/denied terminal-state readback is UNKNOWN, never "absent".
  for (const name of ['phase-unknown', 'phase-abandoned', 'phase-closed', 'key-tombstone']) {
    try { io.stat(join(evidenceDir, `${name}.json`)); proofReject('V9_fixed_operation_terminal') }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  const intent = receipt(evidenceDir, 'intent', io)
  const auth = receipt(evidenceDir, 'launch-authorization', io)
  const commitment = receipt(evidenceDir, 'bundle-commitment', io)
  const index = receipt(evidenceDir, 'live-handle-index', io)
  const sealed = receipt(evidenceDir, 'phase-sealed', io)
  const attempt = receipt(evidenceDir, 'phase-launch-attempt', io)
  const claim = receipt(evidenceDir, 'launch-claimed', io)
  const nonceDigest = sha256(cut.startupNonce)
  const preimage = cut.subjectPreimageSha256
  const i = intent.value
  require(exact(i, ['version', 'operationId', 'phase', 'subject', 'subjectPreimageSha256', 'nonceSha256', 'atWallMs'])
    && i.version === 1 && i.phase === 'INTENT' && i.operationId === FIXED_R2_OPERATION
    && i.subject === HANDLE && i.subjectPreimageSha256 === preimage && i.nonceSha256 === nonceDigest
    && time(i.atWallMs) && i.atWallMs < cut.windowOpenedAtWallMs)
  const a = auth.value
  require(exact(a, ['version', 'operationId', 'phase', 'intentSha256', 'authorization'])
    && a.version === 1 && a.operationId === FIXED_R2_OPERATION && a.phase === 'LAUNCH_AUTHORIZED'
    && a.intentSha256 === intent.digest && auth.digest === cut.launchAuthorizationReceiptSha256)
  require(exact(a.authorization, ['operationId', 'hostId', 'startupNonce', 'subject', 'subjectPreimageSha256',
    'consumingBinarySha256', 'archiveSha256', 'outputsSha256', 'holderCheck', 'authorizedStartupAtWallMs'])
    && canonical(a.authorization.subject) === canonical(bundle.subject)
    && a.authorization.subjectPreimageSha256 === preimage)
  const c = commitment.value
  require(exact(c, ['receiptVersion', 'operationId', 'hostId', 'startupNonce', 'reconciliationHandle', 'subject',
    'subjectPreimageSha256', 'launchAuthorizationReceiptSha256', 'bundleSha256', 'bundleByteLength', 'sealedAtWallMs', 'producerId'])
    && c.receiptVersion === 1 && c.operationId === FIXED_R2_OPERATION && c.reconciliationHandle === HANDLE
    && c.hostId === cut.hostId && c.startupNonce === cut.startupNonce && c.subjectPreimageSha256 === preimage
    && c.launchAuthorizationReceiptSha256 === auth.digest && c.bundleSha256 === sha256(bytes)
    && c.bundleByteLength === bytes.length && time(c.sealedAtWallMs)
    && c.sealedAtWallMs >= cut.authorizedStartupAtWallMs
    && c.producerId === 'trusted root recovery control plane')
  const x = index.value
  require(exact(x, ['version', 'operationId', 'reconciliationHandle', 'hostId', 'startupNonceSha256', 'bundleSha256'])
    && x.version === 1 && x.operationId === FIXED_R2_OPERATION && x.reconciliationHandle === HANDLE
    && x.hostId === cut.hostId && x.startupNonceSha256 === nonceDigest && x.bundleSha256 === c.bundleSha256)
  for (const [entry, phase, previous] of [[sealed, 'SEALED_NOT_ATTEMPTED', null],
    [attempt, 'LAUNCH_ATTEMPT_COMMITTED', sealed.digest]]) {
    const p = entry.value
    require(exact(p, ['version', 'operationId', 'phase', 'hostId', 'reconciliationHandle',
      'startupNonceSha256', 'bundleCommitmentSha256', 'previousPhaseSha256', 'atWallMs'])
      && p.version === 1 && p.operationId === FIXED_R2_OPERATION && p.phase === phase
      && p.hostId === cut.hostId && p.reconciliationHandle === HANDLE && p.startupNonceSha256 === nonceDigest
      && p.bundleCommitmentSha256 === commitment.digest && p.previousPhaseSha256 === previous && time(p.atWallMs))
  }
  require(sealed.value.atWallMs === c.sealedAtWallMs && attempt.value.atWallMs > sealed.value.atWallMs)
  const q = claim.value
  require(exact(q, ['version', 'operationId', 'phase', 'launchAuthorizationSha256', 'bundleCommitmentSha256', 'atWallMs'])
    && q.version === 1 && q.operationId === FIXED_R2_OPERATION && q.phase === 'LAUNCH_CLAIMED'
    && q.launchAuthorizationSha256 === auth.digest && q.bundleCommitmentSha256 === commitment.digest
    && q.atWallMs === attempt.value.atWallMs && time(q.atWallMs)
    && HASH.test(c.bundleSha256))
  return { authorization: a.authorization, commitment: c, commitmentSha256: commitment.digest }
}
