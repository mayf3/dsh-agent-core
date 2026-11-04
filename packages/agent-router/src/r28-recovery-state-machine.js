/** Executable R28/R33 recovery state machine; side effects are injected. */
export const R28_STATES = Object.freeze([
  'DETECT', 'EVIDENCE', 'RECOVER_OR_ESCALATE', 'REWAKE_WORKFLOW', 'VERIFY', 'CONTINUE',
])

export async function executeR28Recovery({ agentId, generation, workflow, deps }) {
  if (!agentId || !Number.isSafeInteger(generation) || generation < 1) {
    throw Object.assign(new TypeError('exact agentId and generation are required'), { code: 'R28_INPUT_INVALID' })
  }
  const historyStore = deps.historyStore
  const history = historyStore ? await historyStore.load() : []
  const last = state => [...history].reverse().find(entry => entry.state === state && entry.outcome !== 'ESCALATED')
  const receipt = async (state, data = {}) => {
    const entry = { state, at: new Date().toISOString(), ...data }
    history.push(entry)
    if (historyStore) await historyStore.append(entry)
  }

  let detected = Boolean(last('DETECT'))
  if (!detected) { await receipt('DETECT'); detected = await deps.detect({ agentId, generation }) }
  if (detected !== true) return { state: 'DETECT', outcome: 'WAITING', history }

  let evidence = last('EVIDENCE')?.evidence
  if (!evidence) {
    await receipt('EVIDENCE')
    evidence = await deps.terminationEvidence({ agentId, generation })
    if (evidence && evidence.agentId === agentId && evidence.generation === generation
      && evidence.childRealExit === true && evidence.liveOwnership === false && evidence.registryCasToken) {
      await receipt('EVIDENCE', { evidence })
    }
  }
  if (!evidence || evidence.agentId !== agentId || evidence.generation !== generation
    || evidence.childRealExit !== true || evidence.liveOwnership !== false || !evidence.registryCasToken) {
    await deps.escalate({ target: 'itops/HUMAN_GATE', agentId, generation, reason: 'TERMINATION_EVIDENCE_INCOMPLETE' })
    await receipt('RECOVER_OR_ESCALATE', { outcome: 'ESCALATED' })
    return { state: 'RECOVER_OR_ESCALATE', outcome: 'ESCALATED', history }
  }

  let recovery = last('RECOVER_OR_ESCALATE')?.recovery
  if (!recovery?.recovered) {
    await receipt('RECOVER_OR_ESCALATE')
    try { recovery = await deps.recover({ agentId, generation, registryCasToken: evidence.registryCasToken }) } catch (error) {
      await deps.escalate({ target: 'itops/HUMAN_GATE', agentId, generation, reason: error.code ?? 'RECOVERY_FAILED' })
      await receipt('RECOVER_OR_ESCALATE', { outcome: 'ESCALATED' })
      return { state: 'RECOVER_OR_ESCALATE', outcome: 'ESCALATED', history }
    }
    if (!recovery?.recovered || recovery.generation !== generation) {
      await deps.escalate({ target: 'itops/HUMAN_GATE', agentId, generation, reason: 'RECOVERY_CAS_NOT_PROVEN' })
      await receipt('RECOVER_OR_ESCALATE', { outcome: 'ESCALATED' })
      return { state: 'RECOVER_OR_ESCALATE', outcome: 'ESCALATED', history }
    }
    await receipt('RECOVER_OR_ESCALATE', { outcome: 'RECOVERED', recovery })
  }

  let kick = last('REWAKE_WORKFLOW')?.kick
  if (!kick) {
    await receipt('REWAKE_WORKFLOW')
    kick = await deps.rewakeWorkflow({ ...workflow, agentId, generation, recoveryReceipt: recovery.receipt })
    if (!kick?.workflowInstanceId || !kick.nodeVisitId || !Number.isSafeInteger(kick.workflowStateVersion)) {
      await deps.escalate({ target: 'itops/HUMAN_GATE', agentId, generation, reason: 'WORKFLOW_REWAKE_RECEIPT_INCOMPLETE' })
      await receipt('REWAKE_WORKFLOW', { outcome: 'ESCALATED' })
      return { state: 'REWAKE_WORKFLOW', outcome: 'ESCALATED', history }
    }
    await receipt('REWAKE_WORKFLOW', { outcome: 'REWAKENED', kick })
  }

  let verified = last('VERIFY')?.verified
  if (!verified) {
    await receipt('VERIFY')
    verified = await deps.verify({ kick, agentId, generation })
    if (!verified?.newTurnId || !verified?.workflowEventId || verified.workflowStateVersion < kick.workflowStateVersion) {
      await deps.escalate({ target: 'itops/HUMAN_GATE', agentId, generation, reason: 'REWAKE_VERIFY_FAILED' })
      await receipt('VERIFY', { outcome: 'ESCALATED' })
      return { state: 'VERIFY', outcome: 'ESCALATED', history }
    }
    await receipt('VERIFY', { outcome: 'VERIFIED', verified })
  }

  const priorContinue = last('CONTINUE')
  if (priorContinue?.terminal === true) return { state: 'CONTINUE', outcome: 'TERMINAL', history, kick, verified, terminal: priorContinue.terminalResult }
  await receipt('CONTINUE')
  const terminal = await deps.continueWorkflow({ kick, verified })
  await receipt('CONTINUE', { outcome: terminal?.terminal === true ? 'TERMINAL' : 'CONTINUING', terminal: terminal?.terminal === true, terminalResult: terminal })
  return { state: 'CONTINUE', outcome: terminal?.terminal === true ? 'TERMINAL' : 'CONTINUING', history, kick, verified, terminal }
}
