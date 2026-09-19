/**
 * @agent-core/execution-history/src/rules.js — the epistemic judgment layer
 * (Spec §5). Every verdict is derived ONLY from collected facts + explicit
 * rules; "not found" is never conflated with "did not happen", accepted ≠
 * started ≠ business-committed, outcome_unknown ≠ no side effects, human
 * wait / not-due / legal skip are never failures.
 */

export const VERDICTS = Object.freeze({
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  ADMITTED: 'ADMITTED',
  NOT_ADMITTED: 'NOT_ADMITTED',
  WAITING_ADMISSION: 'WAITING_ADMISSION',
  ACCEPTED: 'ACCEPTED',
  STARTED: 'STARTED',
  REPLIED: 'REPLIED',
  NO_RECEIPT: 'NO_RECEIPT',
  OUTCOME_UNKNOWN: 'OUTCOME_UNKNOWN',
  BUSINESS_COMMITTED: 'BUSINESS_COMMITTED',
  BUSINESS_REJECTED: 'BUSINESS_REJECTED',
  LEGAL_WAIT: 'LEGAL_WAIT',
  LEGAL_SKIP: 'LEGAL_SKIP',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN',
})

export const DIMENSIONS = Object.freeze([
  'schedulingAdmission',
  'agentExecution',
  'businessProgress',
  'messageDelivery',
  'evidenceIntegrity',
])

/**
 * Dimension observation emitted by root builders; reducer folds them into
 * the final per-dimension verdict.
 */
export function observation(dimension, verdict, { ruleId, evidenceRefs = [], note } = {}) {
  return { dimension, verdict, ruleId, evidenceRefs, ...(note !== undefined ? { note } : {}) }
}

export function reduceDimensions(observations) {
  const byDim = new Map(DIMENSIONS.map((d) => [d, []]))
  for (const obs of observations) {
    if (!byDim.has(obs.dimension)) continue
    byDim.get(obs.dimension).push(obs)
  }
  const out = {}
  for (const dim of DIMENSIONS) {
    const list = byDim.get(dim)
    if (list.length === 0) { out[dim] = { verdict: VERDICTS.UNKNOWN, ruleId: 'R7', evidenceRefs: [] }; continue }
    out[dim] = fold(dim, list)
  }
  return out
}

function fold(dim, list) {
  const facts = list.map((o) => o.verdict)
  const evidence = [...new Set(list.flatMap((o) => o.evidenceRefs))]
  const ruleIds = [...new Set(list.map((o) => o.ruleId).filter(Boolean))]
  switch (dim) {
    case 'schedulingAdmission':
      return { verdict: pick(facts, [VERDICTS.NOT_ADMITTED, VERDICTS.ADMITTED, VERDICTS.WAITING_ADMISSION, VERDICTS.LEGAL_SKIP]) ?? VERDICTS.UNKNOWN, ruleIds, evidenceRefs: evidence }
    case 'agentExecution':
      return { verdict: pick(facts, [VERDICTS.FAILED, VERDICTS.STARTED, VERDICTS.REPLIED, VERDICTS.ACCEPTED, VERDICTS.OUTCOME_UNKNOWN, VERDICTS.NO_RECEIPT, VERDICTS.LEGAL_WAIT]) ?? VERDICTS.UNKNOWN, ruleIds, evidenceRefs: evidence }
    case 'businessProgress':
      // LEGAL_WAIT outranks COMMITTED by design: it is only emitted for an
      // OPEN assistance case postdating the last commit — the current state.
      return { verdict: pick(facts, [VERDICTS.LEGAL_WAIT, VERDICTS.BUSINESS_COMMITTED, VERDICTS.BUSINESS_REJECTED, VERDICTS.LEGAL_SKIP, VERDICTS.OUTCOME_UNKNOWN]) ?? VERDICTS.UNKNOWN, ruleIds, evidenceRefs: evidence }
    case 'messageDelivery':
      return { verdict: pick(facts, [VERDICTS.REPLIED, VERDICTS.ACCEPTED, VERDICTS.NO_RECEIPT, VERDICTS.OUTCOME_UNKNOWN, VERDICTS.NOT_APPLICABLE]) ?? VERDICTS.UNKNOWN, ruleIds, evidenceRefs: evidence }
    case 'evidenceIntegrity':
      // Any DEGRADED/ABSENT/TRUNCATED/retention-loss fact surfaces here; the
      // dimension is UNKNOWN only when nothing was observable at all.
      if (facts.includes('SOURCE_DEGRADED') || facts.includes('SOURCE_ABSENT') || facts.includes('TRUNCATED') || facts.includes('RETENTION_LOSS_PRE_V1')) {
        return { verdict: facts.includes('SOURCE_ABSENT') && facts.length === 1 ? VERDICTS.UNKNOWN : 'PARTIAL', ruleIds, evidenceRefs: evidence }
      }
      return { verdict: pick(facts, ['COMPLETE']) ?? VERDICTS.UNKNOWN, ruleIds, evidenceRefs: evidence }
    default:
      return { verdict: VERDICTS.UNKNOWN, ruleIds, evidenceRefs: evidence }
  }
}

function pick(facts, precedence) {
  for (const candidate of precedence) {
    if (facts.includes(candidate)) return candidate
  }
  return null
}

// ── per-fact classifiers (rules R1-R9 feed these) ───────────────────────────

/** ASM audit outcome row → agentExecution/messageDelivery observation. */
export function classifySendOutcome(row) {
  const refs = row.nativeRefs ?? {}
  if (row.kind === 'send_intent') {
    // §5: an intent row is written BEFORE delivery — it is not a receipt.
    // ACCEPTED is reserved for the outcome row's proven `result: 'accepted'`;
    // an intent alone must never mint a delivery verdict (and must never
    // mask a later failure/unknown: UNKNOWN ranks below every concrete
    // outcome in the reducer precedence).
    return observation('messageDelivery', VERDICTS.UNKNOWN, { ruleId: 'R1', evidenceRefs: [refs.requestId].filter(Boolean), note: 'send intent recorded pre-delivery — no receipt observed yet (intent ≠ accepted)' })
  }
  if (row.kind === 'send_outcome') {
    const result = row.data?.result
    const refs2 = [refs.requestId, refs.messageId].filter(Boolean)
    if (result === 'replied') return observation('messageDelivery', VERDICTS.REPLIED, { ruleId: 'R1', evidenceRefs: refs2 })
    if (result === 'accepted') return observation('messageDelivery', VERDICTS.ACCEPTED, { ruleId: 'R1', evidenceRefs: refs2, note: 'accepted ≠ started ≠ business done' })
    if (result === 'timeout') return observation('messageDelivery', VERDICTS.OUTCOME_UNKNOWN, { ruleId: 'R1', evidenceRefs: refs2, note: 'timeout ≠ no side effects' })
    if (result === 'failed') return observation('messageDelivery', VERDICTS.NO_RECEIPT, { ruleId: 'R1', evidenceRefs: refs2 })
    return observation('messageDelivery', VERDICTS.OUTCOME_UNKNOWN, { ruleId: 'R1', evidenceRefs: refs2 })
  }
  return null
}

/** Attempts ledger projection → agentExecution/businessProgress facts.
 * Returns an ARRAY: every generation's outcome stays visible — an earlier
 * delivered receipt never masks a later generation's fence/supersession. */
export function classifyAttempt(proj) {
  const delivered = proj.events.find((e) => e.kind === 'attempt_run_delivered')
  const failed = proj.events.find((e) => e.kind === 'attempt_delivery_failed')
  const stale = proj.events.find((e) => e.kind === 'attempt_stale_superseded')
  const fence = proj.events.find((e) => e.kind === 'attempt_delivery_started')
  const refs = [proj.attemptId, proj.workflowInstanceId].filter(Boolean)
  const out = []
  if (delivered !== undefined) {
    const hasMessage = typeof delivered.data?.messageId === 'string'
    out.push(observation('agentExecution', hasMessage ? VERDICTS.ACCEPTED : VERDICTS.NO_RECEIPT, {
      ruleId: 'R3',
      evidenceRefs: refs.concat(hasMessage ? [delivered.data.messageId] : []),
      note: hasMessage ? undefined : 'run_delivered without messageId — receipt loss visible',
    }))
  } else if (failed !== undefined) {
    out.push(observation('agentExecution', VERDICTS.FAILED, { ruleId: 'R3', evidenceRefs: refs }))
  } else if (fence !== undefined) {
    out.push(observation('agentExecution', VERDICTS.OUTCOME_UNKNOWN, { ruleId: 'R3', evidenceRefs: refs, note: 'delivery fence open — outcome unknown, side effects possible' }))
  } else {
    out.push(observation('agentExecution', VERDICTS.UNKNOWN, { ruleId: 'R2', evidenceRefs: refs }))
  }
  if (stale !== undefined) {
    out.push(observation('agentExecution', VERDICTS.LEGAL_SKIP, { ruleId: 'R2', evidenceRefs: refs.concat([String(stale.data?.observedWorkflowStateVersion ?? '')]), note: `a later generation superseded this attempt at stateVersion ${stale.data?.observedWorkflowStateVersion ?? '?'}` }))
  }
  return out
}

/** svc timeline events (workflow_execute transitions / admin events). */
export function classifySvcEvents(records) {
  const observations = []
  let lastCommitSeq = -1
  let lastAssistanceSeq = -1
  let lastAssistanceResolutionSeq = -1
  for (const rec of records) {
    const seq = Number.isFinite(rec.nativeSeq) ? rec.nativeSeq : -1
    const type = String(rec.data?.eventType ?? rec.data?.event_type ?? rec.kind)
    if (rec.nativeRefs.commandId && !/ASSISTANCE/.test(type)) {
      lastCommitSeq = Math.max(lastCommitSeq, seq)
      observations.push(observation('businessProgress', VERDICTS.BUSINESS_COMMITTED, {
        ruleId: 'R4',
        evidenceRefs: [String(rec.nativeSeq ?? ''), rec.nativeRefs.commandId].filter(Boolean),
        note: `event_sequence=${rec.nativeSeq} == result workflowStateVersion bridge`,
      }))
    }
    if (/ASSISTANCE_(REQUESTED|ESCALATED)/.test(type)) lastAssistanceSeq = Math.max(lastAssistanceSeq, seq)
    if (/ASSISTANCE_RESOLVED/.test(type)) lastAssistanceResolutionSeq = Math.max(lastAssistanceResolutionSeq, seq)
    if (type.includes('CANCELLED')) observations.push(observation('businessProgress', VERDICTS.LEGAL_SKIP, { ruleId: 'R4', evidenceRefs: [String(rec.nativeSeq ?? '')], note: 'instance cancelled' }))
  }
  // §5: an OPEN assistance case that postdates the last business commit is a
  // human/owner wait — the CURRENT business state is LEGAL_WAIT, never a
  // failure and not a completed commit narrative.
  if (lastAssistanceSeq > lastCommitSeq && lastAssistanceSeq > lastAssistanceResolutionSeq) {
    observations.push(observation('businessProgress', VERDICTS.LEGAL_WAIT, {
      ruleId: 'R4',
      evidenceRefs: [String(lastAssistanceSeq)],
      note: `open assistance case at event_sequence=${lastAssistanceSeq} (after last commit at ${lastCommitSeq}): owner/human input is being waited for (§5)`,
    }))
  }
  return observations
}

/**
 * The §5 negative-space rules, checked over assembled facts:
 * absence of a record class must surface as UNKNOWN with the gap, never as
 * "did not happen".
 */
export function absenceObservations(sourceStatuses) {
  const observations = []
  for (const [source, status] of Object.entries(sourceStatuses)) {
    if (status?.status === 'ABSENT') {
      observations.push(observation('evidenceIntegrity', 'SOURCE_ABSENT', { ruleId: 'R7', evidenceRefs: [source], note: `${source} absent — not proof that events did not happen` }))
    } else if (status?.status === 'DEGRADED' || status?.truncated) {
      observations.push(observation('evidenceIntegrity', 'SOURCE_DEGRADED', { ruleId: 'R7', evidenceRefs: [source], note: status.reason ?? 'degraded read' }))
    }
  }
  return observations
}
