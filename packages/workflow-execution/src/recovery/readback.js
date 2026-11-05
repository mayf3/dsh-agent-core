import { judgeDispatchVersionFromDetail, judgeSettleFromDetail } from '../judgment.js'
import { readbackCategory, readbackIdentity } from './readback-ledger.js'

export function createReadbackOperations({ ledger, readInstanceDetail, resolvePrincipalToAgent, clock, config, log }) {
  const budget = config.maxReadbackChecksPerPoll ?? 25
  const delayMs = config.readbackRetryDelayMs ?? 30_000
  const maxDelayMs = config.readbackMaxDelayMs ?? 300_000
  for (const [name, value] of Object.entries({ maxReadbackChecksPerPoll: budget,
    readbackRetryDelayMs: delayMs, readbackMaxDelayMs: maxDelayMs })) {
    if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`workflow-execution: config.${name} must be a finite positive integer`)
  }
  if (maxDelayMs < delayMs) throw new TypeError('workflow-execution: readback max delay must cover initial delay')
  if (!Number.isSafeInteger(clock() + maxDelayMs)) throw new TypeError('workflow-execution: readback next-check exceeds safe timestamp')

  async function sampleDispatch(attempt, agentId) {
    try {
      const read = await readInstanceDetail({ agentId, workflowInstanceId: attempt.workflowInstanceId })
      const judged = read.ok ? judgeDispatchVersionFromDetail({ body: read.body }) : { ok: false }
      if (judged.ok) return judged.version
      log.warn?.(`workflow-execution: dispatch version probe unavailable for ${attempt.nodeVisitId}`)
    } catch { log.warn?.(`workflow-execution: dispatch version probe unavailable for ${attempt.nodeVisitId}`) }
  }

  function owns(attempt) { return readbackCategory(attempt) !== undefined }

  async function schedule(attempt, category, reason) {
    if (attempt.readback?.status === 'pending') return { committed: false, cause: 'already_scheduled' }
    return ledger.recordReadback({ ...readbackIdentity(attempt), category, result: 'scheduled', reason,
      failures: 0, observedAtMs: clock(), nextCheckAtMs: clock() + delayMs })
  }

  async function check(attempt) {
    const category = readbackCategory(attempt)
    let result = 'unavailable', reason = 'read_unavailable', observationBaseline
    try {
      // Revalidate the original Principal mapping, never fall back to a poller
      // identity. Failure retains responsibility without business settlement.
      const resolved = await resolvePrincipalToAgent(attempt.ownerPrincipalId)
      if (!resolved.ok || resolved.agentId !== attempt.delivered.agentId) {
        reason = 'target_identity_unavailable'
      } else {
        const read = await readInstanceDetail({ agentId: resolved.agentId, workflowInstanceId: attempt.workflowInstanceId })
        if (!read.ok) reason = 'instance_detail_unavailable'
        else if (read.body?.detail?.instance?.workflow_instance_id !== attempt.workflowInstanceId) reason = 'instance_identity_unverified'
        else {
          const settled = judgeSettleFromDetail({ body: read.body, nodeVisitId: attempt.nodeVisitId })
          if (settled.kind === 'settled') {
            result = 'closed'
            reason = read.body.visibility === 'historical_participant' ? 'historical_participant' : 'node_visit_no_longer_current'
          } else if (settled.kind === 'still_current'
            && read.body.detail.current_visit?.assignee_principal_id === attempt.ownerPrincipalId) {
            if (read.body.detail.instance.is_terminal === true) {
              result = 'closed'
              reason = 'instance_terminal'
            } else {
              const sample = judgeDispatchVersionFromDetail({ body: read.body })
              if (sample.ok) {
                observationBaseline = { kind: 'late_current_read', source: 'target_agent_instance_detail',
                  version: sample.version, observedAtMs: clock() }
                result = category === 'version' && sample.version === attempt.workflowStateVersionAtDispatch
                  ? 'revalidated' : 'still_current'
                reason = result === 'revalidated' ? 'original_version_revalidated' : 'unfinished_visit_recheck'
              } else reason = 'current_version_unavailable'
            }
          } else reason = 'visit_or_visibility_unverified'
        }
      }
    } catch { reason = 'read_dependency_unavailable' }
    const failures = result === 'unavailable' ? Math.min((attempt.readback?.failures ?? 0) + 1, 53) : 0
    const observedAtMs = observationBaseline?.observedAtMs ?? clock()
    const nextCheckAtMs = clock() + Math.min(maxDelayMs, delayMs * 2 ** Math.min(failures, 30))
    return ledger.recordReadback({ ...readbackIdentity(attempt), category, result, reason,
      failures, observedAtMs, nextCheckAtMs,
      ...(observationBaseline === undefined ? {} : { observationBaseline }) })
  }

  async function reconcile() {
    const results = []
    // Only the existing startup/poll calls this. A registration consumes the
    // same budget as a read; no local retry timer, no business delivery seam.
    for (const attempt of await ledger.listReadbackCandidatesFresh(budget, clock())) {
      const category = readbackCategory(attempt)
      results.push(attempt.readback?.status === 'pending'
        ? await check(attempt) : await schedule(attempt, category, `${category}_readback_required`))
    }
    return results
  }
  return { sampleDispatch, owns, schedule, reconcile }
}
