/** Fixed read-only settlement projection. No arbitrary handle or store mutation. */
import { fstatSync, readSync } from 'node:fs'
import { readDurableRecoveryStore } from '../../../packages/agent-router/src/reconciliation/durable-file.js'
import { authorityCapacityMethods } from '../../../packages/agent-router/src/reconciliation/authority-capacity.js'
import { RECONCILIATION_CAPS } from '../../../packages/agent-router/src/reconciliation/capacity.js'

const HANDLE = 'turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256'

export function readSettlement(fdPath) {
  if (!/^\/dev\/fd\/\d+$/.test(fdPath)) throw new Error('FIXED_STORE_FD_REQUIRED')
  const fd = Number(fdPath.slice('/dev/fd/'.length))
  const size = fstatSync(fd).size
  if (!Number.isSafeInteger(size) || size < 1 || size > 16 * 1024 * 1024) {
    throw new Error('FIXED_STORE_SIZE_INVALID')
  }
  const raw = Buffer.alloc(size)
  let offset = 0
  while (offset < size) {
    const n = readSync(fd, raw, offset, size - offset, offset)
    if (n === 0) throw new Error('FIXED_STORE_READ_INCOMPLETE')
    offset += n
  }
  const runtimeEpoch = JSON.parse(raw.toString('utf8')).runtimeEpoch
  const durable = readDurableRecoveryStore(fdPath)
  if (!durable) throw new Error('DURABLE_STORE_ABSENT')
  const authority = {
    ...durable,
    callerCorrelationKey({ occurrenceId, runId, requestId }) {
      const values = [occurrenceId, runId, requestId]
      if (values.some(v => v != null && typeof v !== 'string')) throw new Error('CALLER_CORRELATION_INVALID')
      const key = values.map(v => v ?? '').join('\u0000')
      if (Buffer.byteLength(key) > RECONCILIATION_CAPS.MAX_CORRELATION_KEY_BYTES) throw new Error('CALLER_CORRELATION_CAPACITY')
      return key
    },
  }
  authorityCapacityMethods.validateRestoredAuthority.call(authority)
  const record = durable.records.get(HANDLE)
  if (!record || record.handle !== HANDLE || record.agentId !== 'agt_hr-agent'
      || record.processGeneration !== 1 || record.turnSeq !== 256
      || !durable.runtimeEpochs.has(record.runtimeEpoch) || record.runtimeEpoch === runtimeEpoch
      || record.state !== 'settled' || record.recoveryState !== 'settled'
      || record.initialOutcome !== 'outcome_unknown' || record.fenceState !== 'cleared'
      || record.terminationEvidence !== 'restart_quiescence_proven' || record.exitObservedAt !== null) {
    throw new Error('EXACT_S256_SETTLEMENT_UNKNOWN')
  }
  return {
    subject: { reconciliationHandle: HANDLE, turnExecutionId: HANDLE,
      runtimeEpoch: record.runtimeEpoch, agentId: record.agentId,
      processGeneration: record.processGeneration },
    settlement: { reconciliationHandle: HANDLE, queryState: 'settled',
      fenceState: 'cleared', initialOutcome: 'outcome_unknown',
      terminationEvidence: 'restart_quiescence_proven' },
  }
}
