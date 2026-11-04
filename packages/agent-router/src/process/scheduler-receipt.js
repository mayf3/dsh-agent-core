/** Trusted Scheduler receipt selection; never a message-owned timeout override. */
const deploymentReceiptValues = new WeakMap()
const scheduledBudgets = new WeakMap()

export function bindDeploymentReceipt(deadlines, explicitReceiptMs) {
  deploymentReceiptValues.set(deadlines, explicitReceiptMs)
  return deadlines
}

export function deploymentReceiptFor(deadlines) {
  return deploymentReceiptValues.get(deadlines)
}

/** Called only by the Scheduler bridge after validating its selected Job payload. */
export function createScheduledReceiptBudget(request, { defaultMs, overrideMs }) {
  for (const value of [defaultMs, ...(overrideMs === undefined ? [] : [overrideMs])]) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError('invalid Scheduler receipt budget')
  }
  const token = Object.freeze({})
  scheduledBudgets.set(token, Object.freeze({
    agentId: request.agentId, sessionId: request.sessionId,
    occurrenceId: request.occurrenceId, runId: request.runId, requestId: request.requestId,
    defaultMs, overrideMs,
  }))
  return token
}

export function scheduledReceiptDeadline(proc, sessionId, opts) {
  const budget = scheduledBudgets.get(opts?.scheduledReceiptBudget)
  if (!budget) return proc.deadlines.promptReceiptTimeoutMs
  const correlation = opts?.callerCorrelation
  if (budget.agentId !== proc.agentId || budget.sessionId !== sessionId
      || ['occurrenceId', 'runId', 'requestId'].some(key => budget[key] !== correlation?.[key])) {
    throw new TypeError('Scheduler receipt budget identity mismatch')
  }
  return budget.overrideMs ?? proc.schedulerDeploymentReceiptMs ?? budget.defaultMs
}
