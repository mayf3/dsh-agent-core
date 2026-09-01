# scheduler-code-excerpts — verbatim excerpts backing SCHEDULER_SEMANTICS_PREP_INVESTIGATION_V1

BASE = 840d2f4ad91f8252eb1f163330c041216a0dd9c4. All paths relative to repo root. Line numbers from the BASE worktree files.

## 1. Trigger types are exactly cron | at | every

packages/scheduler/src/schedule.js:215-247
```js
export function normalizeSchedule(raw, { nowMs = Date.now() } = {}) {
  if (!raw || typeof raw !== 'object') throw new TypeError('schedule required')
  const kind = String(raw.kind ?? '').trim().toLowerCase()
  if (kind === 'at') {
    const at = typeof raw.at === 'string' && raw.at.trim() ? raw.at : undefined
    if (!at) throw new TypeError('schedule.at (ISO string) required for at jobs')
    const atMs = parseAbsoluteTimeMs(at)
    if (atMs === null) throw new TypeError(`schedule.at invalid: ${at}`)
    return { kind: 'at', at: new Date(atMs).toISOString() }
  }
  if (kind === 'every') {
    const everyMsRaw = typeof raw.everyMs === 'number' ? raw.everyMs : Number(raw.everyMs)
    if (!Number.isFinite(everyMsRaw) || everyMsRaw < 1) throw new TypeError('schedule.everyMs required for every jobs')
    const out = { kind: 'every', everyMs: Math.max(1, Math.floor(everyMsRaw)) }
    const anchorRaw = typeof raw.anchorMs === 'number' ? raw.anchorMs : Number(raw.anchorMs)
    if (Number.isFinite(anchorRaw)) out.anchorMs = Math.max(0, Math.floor(anchorRaw))
    return out
  }
  if (kind === 'cron') {
    const expr = typeof raw.expr === 'string' ? raw.expr.trim() : ''
    if (!expr) throw new TypeError('schedule.expr required for cron jobs')
    const fields = expr.split(/\s+/).filter(Boolean)
    if (fields.length !== 5) throw new TypeError(`schedule.expr must be 5 fields: ${expr}`)
    const out = { kind: 'cron', expr }
    if (typeof raw.tz === 'string' && raw.tz.trim()) out.tz = raw.tz.trim()
    const staggerMs = typeof raw.staggerMs === 'number' ? raw.staggerMs : Number(raw.staggerMs)
    if (Number.isFinite(staggerMs) && staggerMs > 0) out.staggerMs = Math.floor(staggerMs)
    // Validate the expression eagerly (fail-loud on unsupported syntax).
    resolveCron(expr, out.tz)
    return out
  }
  throw new TypeError(`schedule.kind must be cron|at|every, got: ${String(raw.kind)}`)
}
```

## 2. `at` UTC normalization of offset-less inputs (flag A.6-1)

packages/scheduler/src/schedule.js:33-47
```js
export function parseAbsoluteTimeMs(input) {
  if (typeof input !== 'string') return null
  const raw = input.trim()
  if (!raw) return null
  if (/^\d+$/.test(raw)) {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return Math.floor(n)
    return null
  }
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z`
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(raw) ? `${raw}Z`
      : raw
  const parsed = Date.parse(normalized)
  return Number.isFinite(parsed) ? parsed : null
}
```

## 3. Cron timezone default = system local; OpenClaw-compatible stagger

packages/scheduler/src/schedule.js:74-78, 94-107, 110-114
```js
export function resolveCronTimezone(tz) {
  const trimmed = typeof tz === 'string' ? tz.trim() : ''
  if (trimmed) return trimmed
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}
...
export function isRecurringTopOfHourCronExpr(expr) {
  const fields = typeof expr === 'string' ? expr.trim().split(/\s+/).filter(Boolean) : []
  if (fields.length !== 5) return false
  const [minuteField, hourField] = fields
  return minuteField === '0' && hourField.includes('*')
}
export function resolveCronStaggerMs(schedule) {
  if (typeof schedule.staggerMs === 'number' && Number.isFinite(schedule.staggerMs) && schedule.staggerMs > 0) {
    return Math.floor(schedule.staggerMs)
  }
  return isRecurringTopOfHourCronExpr(schedule.expr) ? DEFAULT_TOP_OF_HOUR_STAGGER_MS : 0
}
function stableStaggerOffsetMs(jobId, staggerMs) {
  if (staggerMs <= 1) return 0
  const digest = createHash('sha256').update(jobId).digest()
  return digest.readUInt32BE(0) % staggerMs
}
```

## 4. Deterministic identity + one-run + non-main session

packages/scheduler/src/occurrence-model.js:70-89
```js
export function deriveOccurrenceId({ jobId, scheduleRevision, kind, nominalScheduledAt, retryOfOccurrenceId, catchUpOfNominalAt }) {
  const slot = kind === 'retry' ? retryOfOccurrenceId : kind === 'catchup' ? catchUpOfNominalAt : nominalScheduledAt
  if (slot === undefined) {
    throw new TypeError(`occurrence identity: kind '${kind}' requires its slot coordinate`)
  }
  return `occ:${shaHex16(encodeCoords([jobId, String(scheduleRevision), kind, String(slot)]))}`
}

export function deriveRunId(occurrenceId) {
  return `run:${occurrenceId}`
}

export function deriveNativeSessionId(occurrenceId) {
  return `cron-run-${occurrenceId}`
}
```

## 5. Durable states + §9.1 state machine

packages/scheduler/src/occurrence-model.js:20-41
```js
export const OCCURRENCE_KINDS = new Set(['natural', 'retry', 'catchup'])
export const OCCURRENCE_STATES = new Set(['admitted', 'running', 'succeeded', 'failed', 'outcome_unknown'])
export const TERMINAL_STATES = new Set(['succeeded', 'failed'])
...
const STATE_TRANSITIONS = {
  admitted: new Set(['running', 'failed', 'outcome_unknown']),
  running: new Set(['succeeded', 'failed', 'outcome_unknown']),
  succeeded: new Set(),
  failed: new Set(),
  outcome_unknown: new Set(['succeeded', 'failed']),
}
```

## 6. Reserve-before-Router admission idempotency (coords dedupe + payload conflict)

packages/scheduler/src/occurrence.js:34-68 (excerpt)
```js
export async function reserveOccurrence(candidate) {
  let admittedAt
  const { doc, value } = await this.store.mutateDoc((latest) => {
    // The deadline clock starts only after the cross-process mutation lock is
    // held; pre-admission queue/lock wait is never execution time.
    admittedAt = this.nowMs()
    const attempted = buildOccurrenceRecord({ ... })
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
```

packages/scheduler/src/occurrence-model.js:257-268 (admitted record + persisted deadline)
```js
  const record = {
    occurrenceId,
    jobId: job.id,
    scheduleRevision: job.scheduleRevision,
    kind,
    runId: deriveRunId(occurrenceId),
    idempotencyKey: occurrenceId,
    payloadHash: computePayloadHash({ agentId: job.agentId, payload: job.payload }),
    state: 'admitted',
    admittedAt,
    executionDeadlineAtMs: admittedAt + timeoutMsResolved,
    history: [{ at: admittedAt, from: null, to: 'admitted', reason: `${kind} occurrence reserved` }],
  }
```

## 7. Deadline enforcement = abort + outcome_unknown (never ordinary failed)

packages/scheduler/src/occurrence.js:21-31, 220-230
```js
export const AGENT_TURN_SAFETY_TIMEOUT_MS = 3600 * 1000
export const TIMEOUT_ERROR_TEXT = 'cron: job execution timed out'
const TERMINATION_EVIDENCE = new Set([
  'exact_terminal_then_idle',
  'exact_queued_removal',
  'child_real_exit',
  'cancellation_ack',
])
...
        timer = this.deadlineSetTimeout(() => {
          controller.abort()
          resolve({
            status: 'outcome_unknown',
            error: TIMEOUT_ERROR_TEXT,
            __timedOut: true,
            __promise: invocation,
          })
        }, Math.max(1, record.executionDeadlineAtMs - this.nowMs()))
```

## 8. Outcome classification (succeeded / failed-with-proof / unknown)

packages/scheduler/src/occurrence.js:237-271
```js
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
```

## 9. Delivery separation (never rewrites execution outcome)

packages/scheduler/src/occurrence.js:273-290
```js
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
```

## 10. Restart sweep: admitted/running ⇒ outcome_unknown

packages/scheduler/src/scheduler.js:210-232 (excerpt)
```js
  /** Recovery never re-admits an admitted/running record. */
  async _sweepUnresolved() {
    const now = this.nowMs()
    const swept = []
    await this._commitDoc((doc) => {
      for (const record of doc.occurrences) {
        if (record.state !== 'admitted' && record.state !== 'running') continue
        applyTransition(record, {
          to: 'outcome_unknown',
          at: now,
          reason: 'restart_unresolved: no termination proof at recovery',
          deliveryStatus: record.deliveryStatus ?? 'unknown',
        })
        swept.push(record.occurrenceId)
      }
      doc.fences = rebuildFences(doc.occurrences)
```

## 11. Fence projection (unresolved unknown holds the job)

packages/scheduler/src/occurrence-model.js:317-333 (excerpt)
```js
export function rebuildFences(occurrences) {
  const fences = {}
  for (const record of occurrences) {
    if (!isUnresolvedUnknown(record)) continue
    const existing = fences[record.jobId]
    // Keep the earliest activating unknown (stable rebuild result).
    if (existing === undefined || record.admittedAt < existing.activatedAtMs) {
      fences[record.jobId] = {
        occurrenceId: record.occurrenceId,
        runId: record.runId,
        activatedAtMs: record.admittedAt,
        reason: `outcome_unknown without termination proof (occurrence ${record.occurrenceId})`,
      }
    }
  }
  return fences
}
```

## 12. deleteAfterRun removes ONLY the definition (evidence survives)

packages/scheduler/src/control.js:118-126
```js
/** delete removes ONLY the definition — occurrence/run evidence always persists (D-007 §12.3). */
export async function deleteJobOp(store, id, { assertJob } = {}) {
  await store.mutateDoc((latest) => {
    const job = findJob(latest.jobs, id)
    if (typeof assertJob === 'function') assertJob(job)
    latest.jobs.splice(latest.jobs.indexOf(job), 1)
  })
  return true
}
```

## 13. runs.jsonl: bounded evidence (10MB, newest lines kept), non-authority

packages/scheduler/src/store.js:33-34, 399-414 (excerpt), 416-448 (header comment)
```js
    this.runLogPath = opts.runLogPath ?? path.join(path.dirname(filePath), 'runs.jsonl')
    this.maxRunLogBytes = opts.maxRunLogBytes ?? 10 * 1024 * 1024
...
  async appendRunEvent(event) {
    try {
      await this._ensureDir()
      const handle = await fs.open(this.runLogPath, 'a')
      try {
        await handle.writeFile(`${JSON.stringify(event)}\n`, 'utf8')
        await handle.sync()
      } finally {
        await handle.close()
      }
      await this._truncateRunLog()
      return { ok: true }
    } catch (error) {
      return { ok: false, error: `${error?.code ?? ''}: ${error?.message ?? error}` }
    }
  }
```
Evidence append is best-effort: packages/scheduler/src/occurrence.js:426-432
```js
export async function appendOccurrenceEvidence(event) {
  const result = await this.store.appendRunEvent(event)
  if (result?.ok === false) {
    this.log.warn(`runs.jsonl evidence append failed (${result.error}) — authoritative state unaffected`)
  }
  return result
}
```

## 14. runs.jsonl events DO carry occurrenceId/runId at BASE (draft-spec staleness proof)

packages/scheduler/src/occurrence.js:104-118
```js
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
```

## 15. Real invoker wiring: route chain + callerCorrelation + onDispatch start evidence

packages/scheduler-router/src/index.js:146-166 (excerpt)
```js
      const turnTimeoutMs = request.timeoutMs ? request.timeoutMs + 30_000 : 300_000
      const turnResult = await router.runTurnWithRouteChain(request.agentId, {
        sessionId: request.sessionId,
        message: request.message,
        deadlineMs: turnTimeoutMs,
        ...(request.model === undefined ? {} : { strictReason: 'explicit_model_strict' }),
        opts: {
          callerCorrelation: {
            occurrenceId: request.occurrenceId,
            runId: request.runId,
            requestId: request.requestId,
          },
          // Exactly once, when the FIRST route attempt's turn dispatches.
          onDispatch: () => {
            turnDispatched = true
            if (typeof request.onStart === 'function') request.onStart()
          },
        },
      })
```

## 16. AbortSignal observed, not a cancellation seam

packages/scheduler-router/src/index.js:34-40
```js
 * AbortSignal (scheduler TIMEOUT_ABORT audit): the scheduler passes
 * `request.signal` into the seam; this bridge OBSERVES it (records
 * `aborted` on every settled call). The Router / AgentProcess currently has
 * NO cancellation seam (turn() has no signal; the demo-server JSON-RPC
 * METHODS set has no cancel), so the signal cannot cancel a real turn yet
```

## 17. Unproven post-dispatch failure ⇒ outcome_unknown (bridge mapping)

packages/scheduler-router/src/index.js:180-198 (excerpt)
```js
    } catch (error) {
      const explicitlyUnknown = error?.status === 'outcome_unknown' || error?.envelope === 'outcome_unknown'
      const terminationEvidence = error?.terminationEvidence ?? error?.evidence?.terminationEvidence
      const provenTerminal = error?.status === 'failed' && TERMINATION_EVIDENCE.has(terminationEvidence)
      // Any post-dispatch failure without exact-turn termination proof is
      // outcome_unknown, even when represented as a generic thrown Error.
      const unknown = explicitlyUnknown || (turnDispatched && !provenTerminal)
      const outcome = {
        status: unknown ? 'outcome_unknown' : 'error',
        ...
        started: turnDispatched, // false = proven pre-start rejection (C-004)
```

## 18. CLI runs already shows the occurrence dimension (D-007 §12.2 partially fulfilled)

scripts/agentcore-cron.mjs:20-24, 257-267 (excerpt)
```js
 * `runs` shows the OCCURRENCE dimension (occurrenceId / runId / state incl.
 * outcome_unknown / kind / nominal / admitted / started / ended /
 * deliveryStatus / lateSettlement / fence) — not just job-level status.
...
async function cmdRuns(args) {
  const id = flagValue(args, '--id')
  const limit = Number(flagValue(args, '--limit') ?? '10')
  const store = new JobStore(storePathFromArgs(args))
  const doc = await store.loadDoc()
  const occurrences = (id === undefined ? doc.occurrences : doc.occurrences.filter((r) => r.jobId === id))
    .slice(-limit)
    .reverse()
```

## 19. Retry authorization is explicit opt-in only; stale `at` grace

packages/scheduler/src/eligibility.js:29-33, 135-137, 146-153 (excerpt)
```js
export const ONE_SHOT_RETRY_BACKOFF_MS = [30 * 1000, 60 * 1000, 300 * 1000]
export const RECURRING_RETRY_BACKOFF_MS = [30 * 1000, 60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000]
export const DEFAULT_AT_CATCHUP_GRACE_MS = 15 * 60 * 1000
...
  if (job.schedule.kind === 'at' && nowMs - slot > atCatchupGraceMs) {
    return { due: false, reason: `stale at slot (older than grace ${atCatchupGraceMs}ms) — native catch-up policy`, nominal: slot }
  }
...
export function retryCandidate({ job, occurrences, nowMs }) {
  if (!job.enabled || job.retry?.auto !== true) return null
  ...
  if (job.schedule.kind === 'at' && chain >= ONE_SHOT_RETRY_BACKOFF_MS.length) {
    return { exhausted: true, chain, terminal }
  }
```
(Note the recurring branch: no exhaustion return — flag A.6-5.)

## 20. Operator reconcile identity = effective OS user, never request body

packages/scheduler/src/control.js:184-192
```js
  // Trusted control context: effective OS user, captured here — not from the request body.
  const osUser = userInfo()
  const identity = {
    provenance: 'local-trusted-control-context:effective-os-user',
    username: osUser.username,
    uid: osUser.uid,
    gid: osUser.gid,
  }
```
