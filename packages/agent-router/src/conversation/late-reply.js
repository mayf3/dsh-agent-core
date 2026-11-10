/** CTR-W2: the ORIGINAL ingress caller consumes exact late success, once. */
import { createHash } from 'node:crypto'
import { lateReplyId } from '../reconciliation/late-reply-records.js'

export function createLateReplyDelivery({ reconciliationStore: store, routeChain, feishu, log }) {
  const records = routeChain.lateReplyRecords
  const waiting = new Map()
  let disposed = false
  function observedFailure(error, handle) {
    log.error?.(`late-reply-record-failed ${JSON.stringify({ reconciliationHandle: handle,
      code: error?.code ?? 'LATE_REPLY_RECORD_UNAVAILABLE' })}`)
    records?.unavailable(handle)
  }
  function outputEvidence(output) {
    return output?.state !== 'available' ? { state: output?.state ?? 'unavailable' } : {
      state: 'available', sha256: createHash('sha256').update(output.text).digest('hex'),
      originalBytes: output.originalBytes, truncated: output.truncated === true,
    }
  }
  async function consume(handle) {
    const id = waiting.get(handle)
    if (disposed || id === undefined) return
    try {
      const { state, snapshot } = store.getTurnReconciliation(handle)
      if (state === 'pending' || state === 'recovering') return
      if (state !== 'settled') {
        waiting.delete(handle)
        records.failed(id, `reconciliation_${state}`)
        return
      }
      waiting.delete(handle)
      if (snapshot.initialSource !== 'caller_wait_exceeded' || snapshot.lateOutcome !== 'late_completed'
          || snapshot.outcomeEvidence !== 'exact_turn_end_success') {
        records.update(id, 'late_reply_not_eligible')
        return
      }
      if (!records.claim(id)) return
      const output = store.readFinalAssistantOutput(handle)
      const evidence = outputEvidence(output)
      const record = records.read(id)
      const reason = output.state !== 'available' ? `output_${output.state}`
        : output.truncated ? 'output_truncated' : !output.text.trim() ? 'output_empty'
          : !record.target || !feishu ? 'destination_unavailable' : null
      if (reason !== null) {
        records.failed(id, reason, evidence)
        return
      }
      try {
        const receipt = await feishu.reply(record.target, `${output.text}\n\n（补投）`,
          { ux: { rendering: 'markdown', autoMentionTriggerSender: true } })
        records.update(id, 'late_reply_delivered', { output: evidence,
          receipt: { messageId: typeof receipt?.messageId === 'string' ? receipt.messageId.slice(0, 256) : null } })
        log.log?.(`late-reply-delivered ${JSON.stringify({ id, reconciliationHandle: handle })}`)
      } catch {
        // A timeout may mean partial/complete delivery. Never resend the answer.
        records.failed(id, 'reply_delivery_failed_or_unknown', evidence)
      }
    } catch (error) { observedFailure(error, handle) }
  }
  const unsubscribe = records ? store.onTurnReconciled?.(({ handle }) => { void consume(handle) }) : undefined
  if (records) {
    try {
      for (const record of records.pending()) {
        if (record.disposition === 'late_reply_attempted') {
          records.failed(record.id, 'delivery_outcome_unknown_after_restart')
        } else {
          waiting.set(record.reconciliationHandle, record.id)
          void consume(record.reconciliationHandle)
        }
      }
    } catch (error) { observedFailure(error, null) }
  }
  return {
    replyAttempted(handle) {
      if (!records || typeof handle !== 'string') return false
      try {
        const record = records.read(lateReplyId(handle))
        return record.reconciliationHandle === handle
          && ['late_reply_attempted', 'late_reply_delivered'].includes(record.disposition)
      } catch { return false }
    },
    capture(ingress) {
      try {
        // Connector target construction is mechanical; copy before the turn yields.
        const target = feishu?.replyTargetFor(ingress).replyTo(ingress.messageId)
        if (!target) return null
        const captured = {}
        for (const key of ['kind', 'conversationId', 'chatId', 'channel', 'threadId', 'rootMsgId',
          'triggerSenderOpenId', 'receiveIdType', 'receiveId', 'replyMsgId', 'replyInThread']) {
          const value = target[key]
          if ((typeof value === 'string' && Buffer.byteLength(value) <= 512) || typeof value === 'boolean') captured[key] = value
        }
        if (captured.kind !== 'reply' || typeof captured.replyMsgId !== 'string' || captured.replyMsgId === ''
            || captured.replyMsgId !== ingress.messageId || captured.receiveId !== ingress.chatId
            || typeof captured.receiveId !== 'string' || captured.receiveId === '') return null
        return Object.freeze(captured)
      } catch { return null }
    },
    watch(error, context) {
      const handle = error?.reconciliationHandle
      if (!records || typeof handle !== 'string' || disposed) return
      try {
        const snapshot = store.getTurnReconciliation(handle).snapshot
        if (snapshot?.initialOutcome !== 'outcome_unknown' || snapshot.initialSource !== 'caller_wait_exceeded'
            || snapshot.agentId !== context.agentId || snapshot.sessionId !== context.sessionId) return
        const record = records.register({ handle, ...context })
        if (record.disposition !== 'late_reply_pending') return
        waiting.set(handle, record.id)
        // Settlement can precede the await/catch that returns the caller timeout.
        void consume(handle)
      } catch (failure) { observedFailure(failure, handle) }
    },
    dispose() { disposed = true; waiting.clear(); unsubscribe?.() },
  }
}
