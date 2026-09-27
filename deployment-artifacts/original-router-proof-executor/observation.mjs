/** Private original procedure observer, never a supplied event parser. */
import { createHash } from 'node:crypto'
import { readDurableRecoveryStore } from '/usr/local/libexec/agent-core/app/packages/agent-router/src/reconciliation/durable-file.js'

const AGENT = 'agt_cto-agent'
function require(ok, reason) { if (!ok) throw new Error(reason) }

// The original driver passes only its held store descriptor and its compiled
// original Owner selector. Neither argument supplies an event or a proof.
const [file, owner, started] = process.argv.slice(2)
require(/^\/dev\/fd\/[0-9]+$/.test(file ?? '') && /^[a-f0-9]{64}$/.test(owner ?? '')
  && /^[0-9]+$/.test(started ?? ''), 'ORIGINAL_OBSERVER_INVOCATION')
const since = Number(started)
require(Number.isSafeInteger(since) && since >= 0, 'ORIGINAL_OBSERVER_TIME')
const store = readDurableRecoveryStore(file)
require(store !== null, 'ORIGINAL_STORE_ABSENT')
const issuance = store.issuance.get(AGENT)
require(issuance !== undefined, 'ORIGINAL_ISSUANCE_ABSENT')
const live = [...issuance.generations.entries()].map(([generation, range]) =>
  ({ generation, minSeq: range.minSeq, maxSeq: range.maxSeq })).sort((a,b) => a.generation - b.generation)
const evicted = [...issuance.evictedGenerations.entries()]
const floor = Math.max(live.at(-1)?.generation ?? 0,
  ...evicted.map(([generation]) => generation), issuance.evictedThroughGeneration ?? 0)
require(live.every((range, i) => i === 0 || range.minSeq > live[i-1].maxSeq), 'ORIGINAL_OVERLAP')
const candidates = [...store.records.values()].filter(record =>
  record.agentId === AGENT && record.createdAt >= since
  && record.ingressCorrelation?.channelNamespace === 'feishu'
  && createHash('sha256').update(record.ingressCorrelation.feishuSenderOpenId).digest('hex') === owner)
require(candidates.length <= 1, 'ORIGINAL_NATIVE_AMBIGUOUS')
const record = candidates[0]
if (!record || record.state !== 'settled') {
  process.stdout.write(JSON.stringify({ waiting: true }))
} else {
  require(record.settlementResult === 'completed' && record.fenceState === 'cleared'
    && record.finalAssistantOutputEvidence !== null
    && record.finalAssistantOutputEvidence.originalBytes > 0
    && typeof record.messageId === 'string' && record.messageId !== '', 'ORIGINAL_TURN_INCOMPLETE')
  const hash = value => createHash('sha256').update(value).digest('hex')
  process.stdout.write(JSON.stringify({
    floor, maxIssuedTurnSeq: issuance.maxIssuedTurnSeq, live, evicted,
    watermark: issuance.evictedThroughGeneration,
    turnExecutionId: record.handle, processGeneration: record.processGeneration,
    nativeMessageSha256: hash(record.ingressCorrelation.feishuMessageId),
    nativeReceiptSha256: hash(record.messageId), completedAtWallMs: record.updatedAt,
  }))
}
