/**
 * @agent-core/execution-history/src/redact.js — content visibility rules
 * (Spec §4.3). Seeing a workflow must not mean seeing the agents' private
 * history: records of sessions the viewer does not own are reduced to
 * COORDINATES (messageId/seq/kind/tool name/business coordinates/status
 * codes) — never message text, never tool arguments beyond the coordinate
 * fields. The audit scope is NOT a decryption right: same reduction.
 */

const COORDINATE_KEYS = ['workflowInstanceId', 'transitionDefinitionId', 'expectedWorkflowStateVersion', 'domainId', 'definitionVersionId', 'jobId', 'occurrenceId', 'tool']

export function isOwnedSession(agentId, viewerAgentId) {
  return agentId === viewerAgentId
}

/** Reduce a session-journal message to coordinates for a non-owner viewer. */
export function redactMessage(message) {
  return {
    seq: message.seq,
    role: message.role,
    timeMs: message.timeMs ?? null,
    ...(message.messageId !== undefined ? { messageId: message.messageId } : {}),
    ...(message.source !== undefined ? { sourceKind: message.source?.kind ?? null, sourceAgentId: message.source?.sourceAgentId, correlation: message.source?.correlation, workflowInstanceId: message.source?.workflowInstanceId, nodeVisitId: message.source?.nodeVisitId, attemptId: message.source?.attemptId } : {}),
    content: 'redacted_not_owned',
  }
}

/** Reduce a tool call/result to coordinates for a non-owner viewer. */
export function redactToolCall(call) {
  const coords = {}
  for (const key of COORDINATE_KEYS) {
    if (call.coordinates?.[key] !== undefined) coords[key] = call.coordinates[key]
  }
  return {
    seq: call.seq,
    kind: call.kind ?? 'call',
    timeMs: call.timeMs ?? null,
    ...(call.callId !== undefined ? { callId: call.callId } : {}),
    ...(call.name !== undefined ? { name: call.name } : {}),
    ...(call.isError !== undefined ? { isError: call.isError } : {}),
    ...(call.kind === 'result' ? { result: 'redacted_not_owned' } : {}),
    coordinates: coords,
  }
}

/**
 * Project a loaded journal for a viewer. Content is owned-view ONLY when the
 * viewer IS the session owner — the audit scope widens WHICH sessions are
 * reachable, never WHAT content is visible (Spec §4.3: audit ≠ decryption).
 * @param {object} opts
 * @param {string} opts.sessionAgentId - owner agent of the session.
 * @param {string} opts.viewerAgentId - caller.
 * @param {boolean} [opts.audit] - retained for signature compatibility and
 *   explicit non-use in the ownership decision (documented non-authority).
 */
export function projectForViewer({ sessionAgentId, viewerAgentId, audit, journal }) {
  const owned = isOwnedSession(sessionAgentId, viewerAgentId)
  if (owned) {
    return {
      ownership: 'owned',
      messages: journal.messages.map((m) => ({ ...m, content: m.text ?? m.brief ?? null })),
      toolCalls: journal.toolCalls,
      turns: journal.turns,
      spliced: journal.spliced,
      workflowCoordinates: journal.workflowCoordinates,
    }
  }
  return {
    ownership: 'foreign_reduced_to_coordinates',
    messages: journal.messages.map(redactMessage),
    toolCalls: journal.toolCalls.map(redactToolCall),
    turns: journal.turns.map((t) => ({ turn: t.turn, startSeq: t.startSeq, endSeq: t.endSeq, startTimeMs: t.startTimeMs ?? null, endTimeMs: t.endTimeMs ?? null, stopReason: t.stopReason })),
    spliced: journal.spliced,
    workflowCoordinates: journal.workflowCoordinates,
  }
}
