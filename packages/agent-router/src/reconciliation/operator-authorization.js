/** Owner-file authorization for immutable, offline candidates; never exit proof. */
import { digest, privateFile, refuse } from './operator-files.js'

const SHA = /^[a-f0-9]{64}$/u
const IDENTITY = ['handle', 'runtimeEpoch', 'agentId', 'processGeneration', 'evidence', 'exitObservedAt']
const COMMON = ['version', 'operationId', 'ownerUid', 'sourceSha256', 'loaderSha256']
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',')
export const DURABLE_IDLE_PROOFS = ['exact_started_then_idle', 'exact_queued_removal']

function validTarget(target, batch) {
  return exactKeys(target, batch ? [...IDENTITY, 'restoreBlockedFence'] : IDENTITY)
    && typeof target.handle === 'string' && target.handle.length > 0 && target.handle.length <= 512
    && ['agentId', 'runtimeEpoch'].every(key => typeof target[key] === 'string' && target[key] !== '')
    && Number.isSafeInteger(target.processGeneration) && target.processGeneration > 0
    && ['child_real_exit', 'durable_settlement_cleanup', ...(batch ? DURABLE_IDLE_PROOFS : [])].includes(target.evidence)
    && (target.exitObservedAt === null || (Number.isSafeInteger(target.exitObservedAt) && target.exitObservedAt >= 0))
    && (!batch || typeof target.restoreBlockedFence === 'boolean')
}

export function authorizeCandidate(path, source, loaderSha256, batch = false) {
  const { bytes, stat } = privateFile(path, 'AUTHORIZATION_UNAVAILABLE')
  const uid = process.getuid()
  if ((uid !== 0 && source.stat.uid !== uid) || stat.uid !== uid || (stat.mode & 0o077) !== 0) refuse('UNSAFE_FILE')
  let auth
  try { auth = JSON.parse(bytes) } catch { refuse('AUTHORIZATION_INVALID') }
  const keys = batch ? [...COMMON, 'records'] : [...COMMON, ...IDENTITY]
  if (!exactKeys(auth, keys) || auth.version !== (batch ? 2 : 1)
      || typeof auth.operationId !== 'string' || !/^[a-zA-Z0-9._:-]{1,128}$/u.test(auth.operationId)
      || auth.ownerUid !== uid || !SHA.test(auth.sourceSha256 ?? '') || auth.loaderSha256 !== loaderSha256) {
    refuse('AUTHORIZATION_INVALID')
  }
  const records = batch ? auth.records : [Object.fromEntries(IDENTITY.map(key => [key, auth[key]]))]
  if (!Array.isArray(records) || records.length === 0 || records.length > 256
      || records.some(record => !validTarget(record, batch))
      || new Set(records.map(record => record.handle)).size !== records.length) refuse('AUTHORIZATION_INVALID')
  if (auth.sourceSha256 !== digest(source.bytes)) refuse('PREIMAGE_MISMATCH')
  return { auth, targets: records, authorizationSha256: digest(bytes) }
}

/** Restore only this known illegal projection, only on an explicitly named target. */
export function restoreAuthorizedFences(document, targets) {
  if (!Array.isArray(document?.records)) refuse('STORE_INVALID')
  const repairs = []
  for (const target of targets) {
    if (!target.restoreBlockedFence) continue
    const matches = document.records.filter(row => row?.handle === target.handle)
    if (matches.length !== 1) refuse('AUTHORIZATION_MISMATCH')
    const record = matches[0]
    if (['runtimeEpoch', 'agentId', 'processGeneration'].some(key => record[key] !== target[key])) refuse('AUTHORIZATION_MISMATCH')
    if (record.state !== 'blocked' || record.queryState !== 'pending' || record.fenceState !== 'cleared'
        || record.initialOutcome !== 'outcome_unknown' || record.settlementResult !== null) refuse('REPAIR_SHAPE_MISMATCH')
    record.fenceState = 'active'
    repairs.push({ handle: target.handle, field: 'fenceState', before: 'cleared', after: 'active' })
  }
  return repairs
}
