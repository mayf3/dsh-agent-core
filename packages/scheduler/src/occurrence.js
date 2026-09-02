import {
  applyTransition,
  buildOccurrenceRecord,
  deriveNativeSessionId,
  findOccurrenceByCoords,
  findOccurrenceById,
  isUnresolvedUnknown,
  logicalCoordinates,
  rebuildFences,
  structuredCollisionError,
} from './occurrence-model.js'
import {
  deriveJobStateSummary,
  hasNonTerminalOccurrence,
  naturalCandidate,
  retryCandidate,
  retryChainLength,
  ONE_SHOT_RETRY_BACKOFF_MS,
} from './eligibility.js'

export const AGENT_TURN_SAFETY_TIMEOUT_MS = 3600 * 1000
export const TIMEOUT_ERROR_TEXT = 'cron: job execution timed out'
const TERMINATION_EVIDENCE = new Set([
  'exact_terminal_then_idle',
  'exact_queued_removal',
  'child_real_exit',
  'cancellation_ack',
])
const hasTerminationProof = (outcome) => TERMINATION_EVIDENCE.has(
  outcome?.terminationEvidence ?? outcome?.evidence?.terminationEvidence,
)

/** C-026: reserve eligibility and the admitted record in one locked mutation. */
export async function reserveOccurrence(candidate) {
  let admittedAt
  const { doc, value } = await this.store.mutateDoc((latest) => {
    // The deadline clock starts only after the cross-process mutation lock is
    // held; pre-admission queue/lock wait is never execution time.
    admittedAt = this.nowMs()
    const attempted = buildOccurrenceRecord({
      job: candidate.job,
      kind: candidate.kind,
      nominalScheduledAt: candidate.nominalScheduledAt,
      retryOfOccurrenceId: candidate.retryOfOccurrenceId,
      catchUpOfNominalAt: candidate.catchUpOfNominalAt,
      admittedAt,
      timeoutMs: candidate.job.payload.timeoutSeconds
        ? Math.floor(candidate.job.payload.timeoutSeconds * 1000)
        : AGENT_TURN_SAFETY_TIMEOUT_MS,
    })
    const byCoords = findOccurrenceByCoords(latest.occurrences, logicalCoordinates(attempted))
    if (byCoords) {
      if (byCoords.occurrenceId !== attempted.occurrenceId) throw structuredCollisionError(byCoords, attempted)
      if (byCoords.payloadHash !== attempted.payloadHash) {
        throw Object.assign(
          new Error(`idempotency key ${attempted.idempotencyKey} is already bound to a different payloadHash`),
          { code: 'OCCURRENCE_PAYLOAD_CONFLICT', occurrenceId: attempted.occurrenceId },
        )
      }
      return { value: { record: byCoords, deduped: true } }
    }
    const byId = findOccurrenceById(latest.occurrences, attempted.occurrenceId)
    if (byId) throw structuredCollisionError(byId, attempted)

    const job = latest.jobs.find((entry) => entry.id === candidate.job.id)
    if (!job || !job.enabled) return { value: null }
    if (job.scheduleRevision !== candidate.job.scheduleRevision) return { value: null }
    if (latest.fences[job.id] !== undefined) return { value: null }
    if (hasNonTerminalOccurrence(latest.occurrences, job.id)) return { value: null }

    if (candidate.kind === 'retry') {
      const retry = retryCandidate({ job, occurrences: latest.occurrences, nowMs: admittedAt })
      if (!retry || retry.exhausted || !retry.due
        || retry.retryOfOccurrenceId !== candidate.retryOfOccurrenceId) return { value: null }
    } else {
      const natural = naturalCandidate({
        job, occurrences: latest.occurrences, nowMs: admittedAt,
        atCatchupGraceMs: this.atCatchupGraceMs,
      })
      const expectedNominal = candidate.kind === 'catchup'
        ? candidate.catchUpOfNominalAt
        : candidate.nominalScheduledAt
      if (!natural.due || natural.nominal !== expectedNominal) return { value: null }
    }

    const record = buildOccurrenceRecord({
      job,
      kind: candidate.kind,
      nominalScheduledAt: candidate.nominalScheduledAt,
      retryOfOccurrenceId: candidate.retryOfOccurrenceId,
      catchUpOfNominalAt: candidate.catchUpOfNominalAt,
      admittedAt,
      timeoutMs: job.payload.timeoutSeconds
        ? Math.floor(job.payload.timeoutSeconds * 1000)
        : AGENT_TURN_SAFETY_TIMEOUT_MS,
    })
    this.invoker.assertRunnable(job.agentId)
    latest.occurrences.push(record)
    return { value: { record, deduped: false } }
  })
  if (!value) return null
  this.doc = doc
  if (!value.deduped) {
    await this._evidence({
      ts: admittedAt,
      action: 'occurrence_reserved',
      occurrenceId: value.record.occurrenceId,
      runId: value.record.runId,
      jobId: value.record.jobId,
      kind: value.record.kind,
      nominal: value.record.nominalScheduledAt
        ?? value.record.retryOfOccurrenceId
        ?? value.record.catchUpOfNominalAt,
      scheduleRevision: value.record.scheduleRevision,
      payloadHash: value.record.payloadHash,
      executionDeadlineAtMs: value.record.executionDeadlineAtMs,
    })
  }
  const job = doc.jobs.find((entry) => entry.id === value.record.jobId)
  if (!value.deduped) {
    await this._historyWrite('occurrenceReserved', {
      record: structuredClone(value.record),
      job: job === undefined ? undefined : structuredClone(job),
    })
  }
  return { job, record: structuredClone(value.record), deduped: value.deduped }
}

/** C-027: persist exact-turn start evidence by occurrence/run identity. */
export function markOccurrenceRunning(record) {
  record.__started = true
  const at = this.nowMs()
  record.__startedAt = at
  void this.store.mutateDoc((doc) => {
    const current = findOccurrenceById(doc.occurrences, record.occurrenceId)
    if (!current || current.runId !== record.runId || current.state !== 'admitted') return {}
    applyTransition(current, {
      to: 'running',
      at,
      reason: 'turn start evidence from invoker seam',
      startedAt: at,
      nativeSessionId: record.nativeSessionId,
    })
  }).then(({ doc }) => { this.doc = doc }).catch((error) => {
    this.log.error(`start evidence write failed for ${record.occurrenceId}: ${error?.message ?? error}`)
  })
  void this._evidence({ ts: at, action: 'turn_start', occurrenceId: record.occurrenceId, runId: record.runId })
  void this._historyWrite('runStarted', { record: structuredClone(record) })
}

/** Invoke, classify, deliver, and write one occurrence; never creates another admission. */
export async function runOccurrence(job, record) {
  this._inflight.add(record.occurrenceId)
  const working = { ...record, nativeSessionId: deriveNativeSessionId(record.occurrenceId) }
  try {
    await this._evidence({
      ts: this.nowMs(),
      action: 'router_admission',
      phase: 'attempted',
      occurrenceId: record.occurrenceId,
      runId: record.runId,
      requestId: record.idempotencyKey,
    })
    const outcome = await this._invokeWithDeadline(working, job)
    const classification = this._classifyOutcome(working, outcome)
    await this._evidence({
      ts: this.nowMs(),
      action: 'router_admission',
      phase: outcome.__timedOut ? 'unknown' : outcome.status === 'ok' ? 'accepted' : outcome.status,
      occurrenceId: record.occurrenceId,
      runId: record.runId,
      requestId: record.idempotencyKey,
      error: outcome.error,
      reconciliationHandle: outcome.reconciliationHandle,
      deadlineAtWallMs: outcome.deadlineAtWallMs,
      evidence: outcome.evidence,
    })
    const deliveryStatus = await this._deliverOccurrence(job, classification)
    void this._historyWrite('deliveryOutcome', { record: structuredClone(working), deliveryStatus })
    await this._writeOccurrenceOutcome(working, classification, deliveryStatus, outcome)
    // The unknown state and fence MUST commit before a fast late result can
    // resolve it. Starting the watcher earlier races and can strand the fence.
    if (classification.state === 'outcome_unknown' && outcome.__timedOut) {
      void this._watchLateSettlement(working, outcome.__promise)
    }
    return classification.state
  } catch (error) {
    this.log.error(`occurrence ${record.occurrenceId} run crashed: ${error?.message ?? error}`)
    try {
      await this._writeOccurrenceOutcome(
        working,
        { state: 'outcome_unknown', reason: `engine crash guard: ${error?.message ?? error}` },
        'unknown',
      )
    } catch (writeError) {
      this.log.error(`occurrence ${record.occurrenceId} crash writeback failed: ${writeError?.message ?? writeError}`)
    }
    return 'outcome_unknown'
  } finally {
    this._inflight.delete(record.occurrenceId)
  }
}

/** C-001/C-010/C-025: local deadline expiry requests abort but proves no termination. */
export async function invokeWithDeadline(record, job) {
  const controller = new AbortController()
  const request = {
    agentId: job.agentId,
    sessionId: record.nativeSessionId,
    occurrenceId: record.occurrenceId,
    runId: record.runId,
    requestId: record.idempotencyKey,
    payloadHash: record.payloadHash,
    message: job.payload.message,
    model: job.payload.model,
    lightContext: job.payload.lightContext,
    timeoutMs: Math.max(1, record.executionDeadlineAtMs - this.nowMs()),
    deliveryTarget: job.delivery,
    signal: controller.signal,
    onStart: () => this._markRunning(record),
  }
  let timer
  const invocation = Promise.resolve(this.invoker.invokeAgent(request))
  try {
    return await Promise.race([
      invocation.then((outcome) => outcome && typeof outcome === 'object'
        ? { ...outcome, __promise: invocation }
        : { status: 'error', error: 'invoker returned a non-object outcome', started: false, __promise: invocation }),
      new Promise((resolve) => {
        timer = this.deadlineSetTimeout(() => {
          controller.abort()
          resolve({
            status: 'outcome_unknown',
            error: TIMEOUT_ERROR_TEXT,
            __timedOut: true,
            __promise: invocation,
          })
        }, Math.max(1, record.executionDeadlineAtMs - this.nowMs()))
      }),
    ])
  } finally {
    if (timer !== undefined) this.deadlineClearTimeout(timer)
  }
}

export function classifyOccurrenceOutcome(record, outcome) {
  if (outcome.status === 'ok') {
    return {
      state: 'succeeded',
      executionOutcome: 'succeeded',
      reason: 'invoker returned terminal success',
      summary: outcome.summary,
    }
  }
  if (outcome.__timedOut || outcome.status === 'outcome_unknown') {
    return {
      state: 'outcome_unknown',
      reason: outcome.__timedOut
        ? `execution deadline exceeded without termination proof: ${outcome.error ?? TIMEOUT_ERROR_TEXT}`
        : `invoker reported outcome_unknown: ${outcome.error ?? ''}`,
    }
  }
  const started = record.__started === true || outcome.started === true
  const provenFailure = (!started && outcome.started === false) || hasTerminationProof(outcome)
  if (!provenFailure) {
    return {
      state: 'outcome_unknown',
      reason: `invoker failure lacks exact-turn termination proof: ${outcome.error ?? 'invoke failed'}`,
    }
  }
  return {
    state: 'failed',
    executionOutcome: 'failed',
    reason: outcome.error ?? 'invoke failed',
    terminalEvidence: {
      kind: started ? 'turn-terminal' : 'pre-start-rejection',
      detailRef: outcome.error ?? 'invoke failed',
    },
  }
}

/** D-007 §11.4: delivery is separate and cannot rewrite execution success. */
export async function deliverOccurrence(job, classification) {
  if (job.delivery.mode === 'none') return 'not-requested'
  if (classification.state !== 'succeeded') {
    return classification.state === 'outcome_unknown' ? 'unknown' : 'not-delivered'
  }
  try {
    await this.deliver({
      job,
      result: { status: 'ok', summary: classification.summary },
      text: classification.summary,
    })
    return 'delivered'
  } catch (error) {
    this.log.warn(`job ${job.id.slice(0, 8)} delivery failed: ${error?.message ?? error}`)
    return 'not-delivered'
  }
}

/** C-027: terminal/unknown writeback always re-reads the latest document. */
export async function writeOccurrenceOutcome(record, classification, deliveryStatus, outcome = {}) {
  const endedAt = this.nowMs()
  const { doc, value } = await this.store.mutateDoc((latest) => {
    const current = findOccurrenceById(latest.occurrences, record.occurrenceId)
    if (!current || current.runId !== record.runId) {
      throw Object.assign(
        new Error(`occurrence ${record.occurrenceId}/${record.runId} missing at writeback`),
        { code: 'OCCURRENCE_WRITEBACK_MISSING' },
      )
    }
    if (current.payloadHash !== record.payloadHash || current.scheduleRevision !== record.scheduleRevision) {
      throw Object.assign(
        new Error(`occurrence ${record.occurrenceId} identity mismatch at writeback (payloadHash/scheduleRevision)`),
        { code: 'OCCURRENCE_PAYLOAD_CONFLICT' },
      )
    }
    const started = record.__started === true || current.state === 'running'
    if (current.state === 'admitted'
      && (classification.state === 'succeeded' || (classification.state === 'failed' && started))) {
      applyTransition(current, {
        to: 'running',
        at: endedAt,
        reason: `terminal ${classification.state} of a started run`,
        startedAt: current.startedAt ?? endedAt,
      })
    }
    applyTransition(current, {
      to: classification.state,
      at: endedAt,
      reason: classification.reason,
      endedAt,
      executionOutcome: classification.executionOutcome,
      deliveryStatus,
      nativeSessionId: record.nativeSessionId,
      terminalEvidence: classification.terminalEvidence ?? current.terminalEvidence,
    })
    return { value: applyJobCompletion(latest, current, endedAt) }
  })
  this.doc = doc
  await this._evidence({
    ts: endedAt,
    action: 'outcome',
    occurrenceId: record.occurrenceId,
    runId: record.runId,
    state: classification.state,
    executionOutcome: classification.executionOutcome,
    deliveryStatus,
    reason: classification.reason,
    jobId: value?.jobId,
  })
  await this._evidence({
    ts: endedAt,
    action: 'delivery',
    occurrenceId: record.occurrenceId,
    runId: record.runId,
    deliveryStatus,
  })
  // AGENT_CORE_SCHEDULER_RUN_HISTORY_V1: the structured execution-history
  // terminal fact (outcome classification + delivery + the trusted wrapper's
  // structured result, persisted verbatim and never interpreted — R4/R-H7).
  // History NEVER gates admission (R-H1) — a history failure is fail-soft.
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
  return value
}

/** C-011: exact timed-out invocation may settle later; never another admission. */
export async function watchLateSettlement(record, invocationPromise) {
  try {
    const outcome = await invocationPromise
    if (!outcome || typeof outcome !== 'object' || outcome.status === 'outcome_unknown') return
    if (outcome.status === 'ok' && !outcome.error) {
      await this._applyLateSettlement(record, 'succeeded', 'invoker late terminal success after timeout', outcome)
      return
    }
    const provenFailure = outcome.status === 'error'
      && (outcome.started === false || hasTerminationProof(outcome))
    if (provenFailure) {
      await this._applyLateSettlement(
        record,
        'failed',
        `invoker late proven terminal failure after timeout: ${outcome.error ?? ''}`,
        outcome,
      )
    }
  } catch {
    // A thrown/malformed late result has no exact-turn termination proof.
  }
}

export async function applyLateSettlement(record, resolvedTo, note, outcome = {}) {
  const resolvedAt = this.nowMs()
  const lateEvidence = {
    requestId: record.idempotencyKey,
    ...(typeof outcome.reconciliationHandle === 'string' ? { reconciliationHandle: outcome.reconciliationHandle } : {}),
    ...(typeof outcome.evidence?.externalEffectReceipt === 'string' ? { externalEffectReceipt: outcome.evidence.externalEffectReceipt } : {}),
    ...(typeof outcome.evidence?.terminationEvidence === 'string' ? { terminationEvidence: outcome.evidence.terminationEvidence } : {}),
    ...(typeof outcome.evidence?.source === 'string' ? { source: outcome.evidence.source } : {}),
  }
  const evidenceRef = `invoker late settlement ${JSON.stringify(lateEvidence)}`
  try {
    const { doc } = await this.store.mutateDoc((latest) => {
      const current = findOccurrenceById(latest.occurrences, record.occurrenceId)
      if (!current || current.runId !== record.runId || !isUnresolvedUnknown(current)) return {}
      applyTransition(current, {
        to: resolvedTo,
        at: resolvedAt,
        reason: note,
        endedAt: resolvedAt,
        executionOutcome: resolvedTo,
        lateSettlement: {
          resolvedTo,
          resolvedAt,
          basis: 'trusted-late-evidence',
          evidenceRef,
        },
        terminalEvidence: { kind: 'late-settlement', detailRef: note },
      })
      latest.fences = rebuildFences(latest.occurrences)
      applyLateCompletion(latest, current, resolvedAt)
      return {}
    })
    this.doc = doc
    await this._evidence({
      ts: resolvedAt,
      action: 'late_settlement',
      occurrenceId: record.occurrenceId,
      runId: record.runId,
      resolvedTo,
      basis: 'trusted-late-evidence',
      note,
      evidenceRef,
      evidence: lateEvidence,
    })
    await this._historyWrite('lateSettlement', {
      record: structuredClone(record),
      resolvedTo,
      basis: 'trusted-late-evidence',
      note,
    })
  } catch (error) {
    this.log.error(`late settlement failed for ${record.occurrenceId}: ${error?.message ?? error}`)
  }
}

export async function appendOccurrenceEvidence(event) {
  const result = await this.store.appendRunEvent(event)
  if (result?.ok === false) {
    this.log.warn(`runs.jsonl evidence append failed (${result.error}) — authoritative state unaffected`)
  }
  return result
}

/**
 * AGENT_CORE_SCHEDULER_RUN_HISTORY_V1: optional structured-history sink
 * (deps.history). History records facts only and NEVER gates admission or
 * changes any engine decision (spec R-H1) — a history failure is fail-soft
 * and visible in the log while the authoritative state proceeds.
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

function applyJobCompletion(doc, occurrence, nowMs) {
  const job = doc.jobs.find((entry) => entry.id === occurrence.jobId)
  if ((occurrence.state === 'succeeded' || occurrence.state === 'failed')
    && job?.schedule.kind === 'at') {
    if (occurrence.state === 'succeeded' && job.deleteAfterRun === true) {
      doc.jobs.splice(doc.jobs.indexOf(job), 1)
      doc.fences = rebuildFences(doc.occurrences)
      return { jobId: occurrence.jobId, deleted: true }
    }
    if (occurrence.state === 'succeeded') job.enabled = false
    else {
      const chain = retryChainLength(doc.occurrences, occurrence)
      const retriesLeft = job.retry?.auto === true && chain < ONE_SHOT_RETRY_BACKOFF_MS.length
      if (!retriesLeft) job.enabled = false
    }
  }
  doc.fences = rebuildFences(doc.occurrences)
  for (const entry of doc.jobs) entry.state = deriveJobStateSummary(entry, doc.occurrences, nowMs)
  return { jobId: occurrence.jobId, deleted: false }
}

function applyLateCompletion(doc, occurrence, nowMs) {
  const job = doc.jobs.find((entry) => entry.id === occurrence.jobId)
  if (job?.schedule.kind === 'at' && occurrence.state === 'succeeded') {
    if (job.deleteAfterRun === true) doc.jobs.splice(doc.jobs.indexOf(job), 1)
    else job.enabled = false
  }
  for (const entry of doc.jobs) entry.state = deriveJobStateSummary(entry, doc.occurrences, nowMs)
}

/** Attach cohesive occurrence operations without bloating the Scheduler class file. */
export const occurrenceEngineMethods = {
  _reserve: reserveOccurrence,
  _markRunning: markOccurrenceRunning,
  _runOccurrence: runOccurrence,
  _invokeWithDeadline: invokeWithDeadline,
  _classifyOutcome: classifyOccurrenceOutcome,
  _deliverOccurrence: deliverOccurrence,
  _writeOccurrenceOutcome: writeOccurrenceOutcome,
  _watchLateSettlement: watchLateSettlement,
  _applyLateSettlement: applyLateSettlement,
  _evidence: appendOccurrenceEvidence,
  _historyWrite: writeToHistory,
}
