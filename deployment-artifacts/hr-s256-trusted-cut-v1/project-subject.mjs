/** Fixed s256 read-only projection from a DS-passed, no-follow store FD. */
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { readDurableRecoveryStore } from '../../packages/agent-router/src/reconciliation/durable-file.js'
import { authorityCapacityMethods } from '../../packages/agent-router/src/reconciliation/authority-capacity.js'
import { RECONCILIATION_CAPS } from '../../packages/agent-router/src/reconciliation/capacity.js'

export const HANDLE = 'turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256'
export const AGENT_ID = 'agt_hr-agent'

export function projectSubject(storeFdPath) {
  if (!/^\/dev\/fd\/\d+$/.test(storeFdPath)) throw new Error('FIXED_STORE_FD_REQUIRED')
  const durable = readDurableRecoveryStore(storeFdPath)
  if (durable === null) throw new Error('DURABLE_STORE_ABSENT')
  const authority = {
    ...durable,
    callerCorrelationKey({ occurrenceId, runId, requestId }) {
      const coordinates = [occurrenceId, runId, requestId]
      if (coordinates.some(value => value !== null && value !== undefined && typeof value !== 'string')) {
        throw new TypeError('CALLER_CORRELATION_INVALID')
      }
      const key = coordinates.map(value => value ?? '').join('\u0000')
      if (Buffer.byteLength(key, 'utf8') > RECONCILIATION_CAPS.MAX_CORRELATION_KEY_BYTES) {
        throw new TypeError('CALLER_CORRELATION_CAPACITY')
      }
      return key
    },
  }
  authorityCapacityMethods.validateRestoredAuthority.call(authority)
  const record = durable.records.get(HANDLE)
  if (!record || record.handle !== HANDLE || record.agentId !== AGENT_ID
      || !durable.runtimeEpochs.has(record.runtimeEpoch)
      || record.processGeneration !== 1 || record.turnSeq !== 256
      || record.state !== 'pending' || record.recoveryState !== 'blocked'
      || record.initialOutcome !== 'outcome_unknown'
      || record.failureReason !== 'runtime_restart_ownership_unavailable'
      || record.terminationEvidence !== null || record.exitObservedAt !== null
      || record.fenceState !== 'active') throw new Error('S256_P1_P10_INVALID')
  if (!Number.isSafeInteger(record.createdAtWallMs)
      || !Number.isSafeInteger(record.updatedAt)) throw new Error('S256_TIME_INVALID')
  return {
    reconciliationHandle: HANDLE, turnExecutionId: HANDLE,
    runtimeEpoch: record.runtimeEpoch, agentId: AGENT_ID,
    processGeneration: record.processGeneration, sessionId: record.sessionId,
    createdAtWallMs: record.createdAtWallMs, updatedAt: record.updatedAt,
    subjectPreimageSha256: createHash('sha256').update(JSON.stringify(record)).digest('hex'),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const projection = projectSubject(process.argv[2])
    process.stdout.write(`${JSON.stringify(projection)}\n`)
  } catch {
    process.exitCode = 2
  }
}
