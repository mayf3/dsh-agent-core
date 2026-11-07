import { AGENT_ID_RE } from '../attempt-identity.js'
import { judgeSettleFromDetail } from '../judgment.js'
import { matchesRecoveryTrigger, recoveryIdentity } from './automatic-ledger.js'

/** CTR-EKRWAE-004/007: retain the original obligation, not a handoff claim.
 * The ACTIVE writer persisted the cadence before refusal. Terminal consumption
 * is read-only: no append, closure, recovery invocation or business mutation.
 * The existing poller owns cadence; this module creates no timer or store. */
export function createRefusalConsumer({ ledger, clock, enabled, budget, readInstanceDetail, resolvePrincipalToAgent }) {
  const served = new Map() // throttle/fairness only; restart rediscovers the durable obligation
  const owns = attempt => attempt?.state === 'NEEDS_REVIEW' && attempt.phase === 'recovery_refused'
    && attempt.recoveryCheck?.refusalSchedule !== undefined

  function due(attempt) {
    if (!owns(attempt)) return undefined
    const { firstCheckAtMs, intervalMs } = attempt.recoveryCheck.refusalSchedule
    const now = clock()
    if (now < firstCheckAtMs) return undefined
    const slot = Math.floor((now - firstCheckAtMs) / intervalMs)
    const nextCheckAtMs = firstCheckAtMs + (slot + 1) * intervalMs
    if (!Number.isSafeInteger(nextCheckAtMs) || served.get(attempt.attemptId)?.slot >= slot) return undefined
    return { slot, nextCheckAtMs }
  }

  async function observe(attempt) {
    let agentId, result = 'unavailable', reason = 'target_identity_unavailable'
    try {
      const resolved = await resolvePrincipalToAgent(attempt.ownerPrincipalId)
      if (resolved.ok && typeof resolved.agentId === 'string' && AGENT_ID_RE.test(resolved.agentId) && enabled()) {
        agentId = resolved.agentId
        const read = await readInstanceDetail({ agentId, workflowInstanceId: attempt.workflowInstanceId })
        reason = 'instance_detail_unavailable'
        if (read.ok) {
          reason = 'instance_identity_unverified'
          if (read.body?.detail?.instance?.workflow_instance_id === attempt.workflowInstanceId) {
            const world = judgeSettleFromDetail({ body: read.body, nodeVisitId: attempt.nodeVisitId })
            reason = world.reason
            if (world.kind !== 'unavailable') {
              result = 'world_observed'
              if (read.body.detail.instance.is_terminal === true) reason = 'instance_terminal'
            }
          }
        }
      }
    } catch { reason = 'read_dependency_unavailable' }
    return { source: 'target_agent_instance_detail', observedAtMs: clock(), result, reason,
      ...(agentId === undefined ? {} : { agentId }) }
  }

  async function reconcile() {
    if (!enabled()) return []
    const attempts = await ledger.inspectFresh(items => items.filter(owns))
    const retainedIds = new Set(attempts.map(attempt => attempt.attemptId))
    for (const id of served.keys()) if (!retainedIds.has(id)) served.delete(id)
    const candidates = attempts.filter(attempt => due(attempt))
      .sort((a, b) => (served.get(a.attemptId)?.atMs ?? -Infinity) - (served.get(b.attemptId)?.atMs ?? -Infinity)
        || a.recoveryCheck.refusalSchedule.firstCheckAtMs - b.recoveryCheck.refusalSchedule.firstCheckAtMs
        || a.attemptId.localeCompare(b.attemptId)).slice(0, budget)
    const results = []
    for (const scanned of candidates) {
      if (!enabled()) break
      // Same OwnerLock/fresh replay, but deliberately use none of the record
      // ports. Overlapping scans recheck both identity/revision and due slot.
      const checked = await ledger.mutateWithRecord(scanned.nodeVisitId, async (_record, getAttempt) => {
        const attempt = getAttempt()
        if (!enabled() || !owns(attempt) || !matchesRecoveryTrigger(attempt, recoveryIdentity(scanned))) return
        const trigger = due(attempt)
        if (!trigger) return
        served.set(attempt.attemptId, { slot: trigger.slot, atMs: clock() })
        const observation = await observe(attempt)
        const schedule = attempt.recoveryCheck.refusalSchedule
        // Slow dependency reads may span slots. Throttle through completion
        // and report the next future slot of the same persisted cadence.
        const completedSlot = Math.max(trigger.slot,
          Math.floor((clock() - schedule.firstCheckAtMs) / schedule.intervalMs))
        served.set(attempt.attemptId, { slot: completedSlot, atMs: clock() })
        return { outcome: 'REFUSAL_RESPONSIBILITY_PENDING', nodeVisitId: attempt.nodeVisitId,
          attemptId: attempt.attemptId, ...schedule,
          nextCheckAtMs: schedule.firstCheckAtMs + (completedSlot + 1) * schedule.intervalMs, observation,
          businessOutcome: 'UNKNOWN' }
      })
      if (checked) results.push(checked)
    }
    return results
  }
  return { reconcile }
}
