/**
 * Optional structured-history sink. History records facts only and never
 * gates admission or changes an engine decision; failures stay fail-soft and
 * visible while the authoritative occurrence state proceeds.
 */
export async function writeToHistory(method, payload) {
  const history = this.history
  if (history === undefined || history === null) return
  try {
    await history[method](payload)
  } catch (error) {
    this.log.warn(`history.${method} failed (authoritative state unaffected): ${error?.message ?? error}`)
  }
}

/** Persist the terminal mirror without teaching the scheduler core result semantics. */
export async function writeTerminalToHistory(record, classification, deliveryStatus, outcome, endedAt) {
  await this._historyWrite('runTerminal', {
    record: structuredClone(record),
    classification: {
      state: classification.state,
      reason: classification.reason,
      endedAt,
      terminalEvidence: classification.terminalEvidence,
      rejectionCode: classification.rejectionCode,
    },
    deliveryStatus,
    outcome,
    startedAt: record.__started === true ? record.__startedAt : undefined,
  })
}
