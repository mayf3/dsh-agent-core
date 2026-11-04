/** Executable R28 recovery state machine; all side effects are injected. */
export const R28_STATES = Object.freeze([
  'DETECT', 'EVIDENCE', 'RECOVER_OR_ESCALATE', 'REWAKE_WORKFLOW', 'VERIFY', 'CONTINUE',
])

export async function executeR28Recovery({ agentId, generation, workflow, deps }) {
  if (!agentId || !Number.isSafeInteger(generation) || generation < 1) {
    throw Object.assign(new TypeError('exact agentId and generation are required'), { code: 'R28_INPUT_INVALID' })
  }
  const history = []
  const receipt = (state, data = {}) => history.push({ state, at: new Date().toISOString(), ...data })
  receipt('DETECT')
  const detected = await deps.detect({ agentId, generation })
  if (detected !== true) return { state: 'DETECT', outcome: 'WAITING', history }

  receipt('EVIDENCE')
  const evidence = await deps.terminationEvidence({ agentId, generation })
  if (!evidence || evidence.agentId !== agentId || evidence.generation !== generation
    || evidence.childRealExit !== true || evidence.liveOwnership !== false || !evidence.registryCasToken) {
    await deps.escalate({ target: 'itops/HUMAN_GATE', agentId, generation, reason: 'TERMINATION_EVIDENCE_INCOMPLETE' })
    receipt('RECOVER_OR_ESCALATE', { outcome: 'ESCALATED' })
    return { state: 'RECOVER_OR_ESCALATE', outcome: 'ESCALATED', history }
  }

  receipt('RECOVER_OR_ESCALATE')
  let recovery
  try {
    recovery = await deps.recover({ agentId, generation, registryCasToken: evidence.registryCasToken })
  } catch (error) {
    await deps.escalate({ target: 'itops/HUMAN_GATE', agentId, generation, reason: error.code ?? 'RECOVERY_FAILED' })
    receipt('RECOVER_OR_ESCALATE', { outcome: 'ESCALATED' })
    return { state: 'RECOVER_OR_ESCALATE', outcome: 'ESCALATED', history }
  }
  if (!recovery?.recovered || recovery.generation !== generation) {
    await deps.escalate({ target: 'itops/HUMAN_GATE', agentId, generation, reason: 'RECOVERY_CAS_NOT_PROVEN' })
    receipt('RECOVER_OR_ESCALATE', { outcome: 'ESCALATED' })
    return { state: 'RECOVER_OR_ESCALATE', outcome: 'ESCALATED', history }
  }

  receipt('REWAKE_WORKFLOW')
  const kick = await deps.rewakeWorkflow({ ...workflow, agentId, generation, recoveryReceipt: recovery.receipt })
  if (!kick?.workflowInstanceId || !kick.nodeVisitId || !Number.isSafeInteger(kick.workflowStateVersion)) {
    await deps.escalate({ target: 'itops/HUMAN_GATE', agentId, generation, reason: 'WORKFLOW_REWAKE_RECEIPT_INCOMPLETE' })
    receipt('REWAKE_WORKFLOW', { outcome: 'ESCALATED' })
    return { state: 'REWAKE_WORKFLOW', outcome: 'ESCALATED', history }
  }

  receipt('VERIFY')
  const verified = await deps.verify({ kick, agentId, generation })
  if (!verified?.newTurnId || !verified?.workflowEventId || verified.workflowStateVersion < kick.workflowStateVersion) {
    await deps.escalate({ target: 'itops/HUMAN_GATE', agentId, generation, reason: 'REWAKE_VERIFY_FAILED' })
    receipt('VERIFY', { outcome: 'ESCALATED' })
    return { state: 'VERIFY', outcome: 'ESCALATED', history }
  }

  receipt('CONTINUE')
  const terminal = await deps.continueWorkflow({ kick, verified })
  receipt('CONTINUE', { outcome: terminal?.terminal === true ? 'TERMINAL' : 'CONTINUING' })
  return { state: 'CONTINUE', outcome: terminal?.terminal === true ? 'TERMINAL' : 'CONTINUING', history, kick, verified, terminal }
}
