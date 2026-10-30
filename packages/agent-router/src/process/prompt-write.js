/** Write one admitted prompt and bind its exact native receipt. */
import { envelopeCarrier, promptFenceError } from './state-machine.js'

export async function promptWrite(execution, sessionId, text, opts) {
  const lineageError = promptFenceError(this.store, this.agentId)
  if (lineageError) throw lineageError
  if (opts?.websiteControl) {
    await opts.websiteControl.recheck()
    execution.websiteControl = opts.websiteControl
  }
  const receiptDeadlineMono = Math.min(execution.promptReceiptDeadlineMono, execution.turnDeadlineMono,
    opts?.admissionDeadlineMono ?? Infinity)
  const requestId = execution.promptRequestId
  execution.phase = 'prompt_sending'
  this.store.markPromptWriteAttempted(execution.handle)
  if (this.counters !== undefined) {
    this.counters.explicitNewRequestExecutions ??= 0
    this.counters.explicitNewRequestExecutions += 1
  }
  const receipt = await this.request('session/prompt', {
    sessionId,
    contentBlocks: [{ type: 'text', text }],
    // Parent-minted protocol metadata, consumed by demo-server's private
    // agentRpc carrier and never exposed as model tool arguments.
    turnExecutionId: execution.handle,
    ...(opts?.cwd === undefined ? {} : { cwd: opts.cwd }),
    // R4 trusted source sidecar: generic sibling metadata, exact-allowlist
    // validated upstream (deliver) and consumed by the session seam.
    ...(opts?.messageOrigin === undefined ? {} : { messageOrigin: opts.messageOrigin }),
    ...(opts?.conversationSource === undefined ? {} : {conversationSource:opts.conversationSource}),
    ...(opts?.nativeGoalContinuation === undefined ? {} : { nativeGoalContinuation: opts.nativeGoalContinuation }),
    ...(opts?.websiteControl === undefined ? {} : { websiteAdmission: opts.websiteControl.carrier }),
  }, undefined, {
    deadlineMono: receiptDeadlineMono,
    execution,
  })
  if (opts?.nativeGoalContinuation && receipt?.messageId !== opts.nativeGoalContinuation.messageId) {
    throw envelopeCarrier('outcome_unknown', execution.handle, 'NATIVE_GOAL_RECEIPT_MISMATCH', 'native receipt did not prove the reserved message')
  }
  execution.receiptMessageId = receipt?.messageId ?? null
  execution.promptReceipt = receipt?.messageId !== undefined ? 'accepted' : 'unknown'
  this.store.markPromptReceipt(execution.handle, { messageId: execution.receiptMessageId })
  // C-011: exact receipt messageId is now bound — replay the bounded ring
  // from the watermark so events that arrived before this JSON-RPC
  // response are correctly attributed to this execution.
  this.replayExecutionFromWatermark(execution)
  return receipt
 }
