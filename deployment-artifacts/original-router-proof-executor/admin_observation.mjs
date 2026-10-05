/** Fixed original root executor's private admin canary store readback.
 * Invocation arguments originate only from its authenticated same-child
 * socket; they are not a public event/proof submission surface. */
import { createHash } from 'node:crypto'
import { readDurableRecoveryStore } from '/usr/local/libexec/agent-core/app/packages/agent-router/src/reconciliation/durable-file.js'

function require(ok, reason) { if (!ok) throw new Error(reason) }
const [file, handle, runtimeEpoch, started] = process.argv.slice(2)
require(/^\/dev\/fd\/[0-9]+$/.test(file ?? '')
  && /^turn:[^:]{1,128}:a[0-9]+:g[0-9]+:s[0-9]+$/.test(handle ?? '')
  && typeof runtimeEpoch === 'string' && runtimeEpoch.length > 0 && runtimeEpoch.length <= 128
  && /^[0-9]+$/.test(started ?? ''), 'ADMIN_OBSERVER_INVOCATION')
const since = Number(started)
require(Number.isSafeInteger(since) && since >= 0, 'ADMIN_OBSERVER_TIME')
require(handle.startsWith(`turn:${runtimeEpoch}:`), 'ADMIN_RUNTIME_HANDLE_MISMATCH')
const store = readDurableRecoveryStore(file)
require(store !== null, 'ADMIN_STORE_ABSENT')
const issuance = store.issuance.get('agt_efficiency-agent')
require(issuance !== undefined, 'ADMIN_ISSUANCE_ABSENT')
const live = [...issuance.generations.entries()].map(([generation, range]) =>
  ({ generation, minSeq: range.minSeq, maxSeq: range.maxSeq })).sort((a,b) => a.generation - b.generation)
const evicted = [...issuance.evictedGenerations.entries()]
const floor = Math.max(live.at(-1)?.generation ?? 0,
  ...evicted.map(([generation]) => generation), issuance.evictedThroughGeneration ?? 0)
require(live.every((range, i) => i === 0 || range.minSeq > live[i-1].maxSeq), 'ADMIN_OVERLAP')
const record = store.records.get(handle)
require(record && record.agentId === 'agt_efficiency-agent'
  && record.runtimeEpoch === runtimeEpoch && record.createdAt >= since
  && (record.ingressCorrelation === null || record.ingressCorrelation === undefined)
  && (record.callerCorrelation === null || record.callerCorrelation === undefined),
  'ADMIN_NATIVE_IDENTITY_UNKNOWN')
require(record.state === 'settled' && record.settlementResult === 'completed'
  && record.fenceState === 'armed'
  && record.finalAssistantOutputEvidence?.originalBytes > 0
  && record.finalAssistantOutputEvidence.truncated === false
  && typeof record.messageId === 'string' && record.messageId,
  'ADMIN_NATIVE_COMPLETION_UNKNOWN')
const hash = value => createHash('sha256').update(value).digest('hex')
process.stdout.write(JSON.stringify({
  floor, maxIssuedTurnSeq: issuance.maxIssuedTurnSeq, live, evicted,
  watermark: issuance.evictedThroughGeneration,
  turnExecutionId: record.handle, processGeneration: record.processGeneration,
  nativeMessageSha256: hash(record.messageId),
  nativeReceiptSha256: hash(`${record.handle}\0${record.messageId}`),
  replySha256: record.finalAssistantOutputEvidence.sha256,
  completedAtWallMs: record.updatedAt,
}))
