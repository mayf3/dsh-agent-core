import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chmod, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { compileIncidents } from '../../src/watchdog/incident-compiler.js'
import { markNotificationDelivery, updateIncidentState } from '../../src/watchdog/incident-lifecycle.js'
import { retryableOutboxIntents, stableNotificationText } from '../../src/watchdog/delivery.js'
import { commitIncidentState, loadIncidentState, validateIncidentState } from '../../src/watchdog/durable-state.js'
import {
  DELIVERY_PROJECTION_VERSION, annotateFindingsWithJobs, projectIncidentDelivery,
} from '../../src/watchdog/delivery-projection.js'

// Product #428 — external delivery projection. Internal facts, incidents and
// transition intents stay complete and durable (CTR-INCIDENT-001/CTR-ALERT-001);
// the projection only decides which durable intents are USER-facing: it re-reads
// current truth, correlates one causal incident window, coalesces same-occurrence
// detector pairs and suppresses duplicate child spam.

const iso = (ms) => new Date(ms).toISOString()
const RUNTIME = { class: 'SCHEDULER_RUNTIME_UNHEALTHY', reason: 'health endpoint unreachable' }
const CONSECUTIVE = (jobId, revision, errors = 2) => ({
  class: 'CONSECUTIVE_FAILURE', jobId, logicalKey: 'owner:hr', agentId: 'agt-hr', jobRevision: revision, consecutiveErrors: errors,
})
const RUN_FAILED = (jobId, occurrenceId, endedAt) => ({
  class: 'RUN_FAILED', jobId, runId: `run-${occurrenceId}`, occurrenceId, endedAt: iso(endedAt),
})
const RUN_STUCK = (jobId, occurrenceId, startedAt) => ({
  class: 'RUN_STUCK', jobId, runId: `run-${occurrenceId}`, occurrenceId, startedAt: iso(startedAt),
})
const FENCE = (jobId, occurrenceId, blockedSince) => ({
  class: 'ADMISSION_BLOCKED_UNKNOWN', jobId, runId: `run-${occurrenceId}`, occurrenceId, blockedSince: iso(blockedSince),
})

function cycle(state, findings, nowMs) {
  return updateIncidentState(state, compileIncidents(findings).incidents, { nowMs })
}

function pendingIntents(state, producer = 'w1') {
  return retryableOutboxIntents(state, { producer })
}

function decide(state, intents) {
  return projectIncidentDelivery(state, intents)
}

function decisionOf(result, rootIdentity, transitionKind) {
  const found = [...result.decisions.values()].find(
    (d) => d.rootIdentity === rootIdentity && d.transitionKind === transitionKind,
  )
  assert.ok(found, `missing projection decision for ${rootIdentity} ${transitionKind}`)
  return found
}

test('T-DP-1 runtime unhealthy subsumes mechanically-attributable occurrence failures, not unrelated ones', () => {
  let state = cycle({}, [RUNTIME], 1_000).state // runtime down from 1000
  // child failed DURING the outage (ended 1500) + an unrelated earlier failure (ended 500)
  state = cycle(state, [RUNTIME, RUN_FAILED('job-a', 'occ-in', 1_500), RUN_FAILED('job-b', 'occ-out', 500)], 2_000).state

  const active = decide(state, pendingIntents(state))
  assert.equal(decisionOf(active, 'control|SCHEDULER_RUNTIME_UNHEALTHY|watchdog|scheduler-runtime', 'OPEN').deliver, true, 'the causal runtime incident pages')
  const inWindow = decisionOf(active, 'occurrence|RUN_FAILED|job-a|occ-in', 'OPEN')
  assert.equal(inWindow.deliver, false, 'attributable child failure is evidence-only')
  assert.equal(inWindow.code, 'subsumed_by_scheduler_runtime_unhealthy')
  assert.equal(decisionOf(active, 'occurrence|RUN_FAILED|job-b|occ-out', 'OPEN').deliver, true, 'unrelated failure stays a separate user-facing incident')

  // everything recovers: subsumed child recovery stays evidence-only; runtime + unrelated recover user-facing
  state = cycle(state, [], 3_000).state
  const recovered = decide(state, pendingIntents(state))
  assert.equal(decisionOf(recovered, 'occurrence|RUN_FAILED|job-a|occ-in', 'CLOSED_RECOVERED').deliver, false, 'child whose OPEN was subsumed never pages its recovery')
  assert.equal(decisionOf(recovered, 'occurrence|RUN_FAILED|job-b|occ-out', 'CLOSED_RECOVERED').deliver, true)
  assert.equal(decisionOf(recovered, 'control|SCHEDULER_RUNTIME_UNHEALTHY|watchdog|scheduler-runtime', 'CLOSED_RECOVERED').deliver, true)
})

test('T-DP-2 job CONSECUTIVE_FAILURE suppresses same-window child RUN_FAILED spam; first failure and post-recovery failures page', () => {
  let state = cycle({}, [RUN_FAILED('job-a', 'occ-1', 900)], 1_000).state // first failure pages alone
  state = cycle(state, [RUN_FAILED('job-a', 'occ-1', 900), RUN_FAILED('job-a', 'occ-2', 1_900), CONSECUTIVE('job-a', 1)], 2_000).state
  state = cycle(state, [RUN_FAILED('job-a', 'occ-1', 900), RUN_FAILED('job-a', 'occ-2', 1_900), RUN_FAILED('job-a', 'occ-3', 2_900), CONSECUTIVE('job-a', 1)], 3_000).state

  const active = decide(state, pendingIntents(state))
  assert.equal(decisionOf(active, 'occurrence|RUN_FAILED|job-a|occ-1', 'OPEN').deliver, true, 'the first detected failure is a genuine active failure')
  assert.equal(decisionOf(active, 'occurrence|RUN_FAILED|job-a|occ-2', 'OPEN').code, 'subsumed_by_job_consecutive_failure')
  assert.equal(decisionOf(active, 'occurrence|RUN_FAILED|job-a|occ-2', 'OPEN').deliver, false)
  assert.equal(decisionOf(active, 'occurrence|RUN_FAILED|job-a|occ-3', 'OPEN').deliver, false, 'duplicate child spam is suppressed while the causal window is active')
  assert.equal(decisionOf(active, 'job|CONSECUTIVE_FAILURE|job-a|1', 'OPEN').deliver, true, 'the aggregated job incident pages once')

  // parent recovers; children close from the immutable ledger: no child paging after recovery
  state = cycle(state, [], 4_000).state
  const recovered = decide(state, pendingIntents(state))
  assert.equal(decisionOf(recovered, 'job|CONSECUTIVE_FAILURE|job-a|1', 'CLOSED_RECOVERED').deliver, true)
  assert.equal(decisionOf(recovered, 'occurrence|RUN_FAILED|job-a|occ-1', 'CLOSED_RECOVERED').deliver, true, 'a child that paged its OPEN also pages exactly one recovery')
  assert.equal(decisionOf(recovered, 'occurrence|RUN_FAILED|job-a|occ-2', 'CLOSED_RECOVERED').deliver, false, 'historical failures stay silent after recovery')
  assert.equal(decisionOf(recovered, 'occurrence|RUN_FAILED|job-a|occ-3', 'CLOSED_RECOVERED').deliver, false)

  // a NEW failure after the incident recovered is a genuine active failure and pages
  state = cycle(state, [RUN_FAILED('job-a', 'occ-4', 4_900)], 5_000).state
  const later = decide(state, pendingIntents(state))
  assert.equal(decisionOf(later, 'occurrence|RUN_FAILED|job-a|occ-4', 'OPEN').deliver, true)
})

test('T-DP-3 same-occurrence RUN_STUCK + RUN_STUCK_OUTCOME_UNKNOWN coalesce to one OPEN and one RECOVERED', () => {
  let state = cycle({}, [RUN_STUCK('job-a', 'occ-s', 0)], 7_200_001).state // stuck detected first
  const firstOpen = decide(state, pendingIntents(state))
  assert.equal(decisionOf(firstOpen, 'occurrence|RUN_STUCK|job-a|occ-s', 'OPEN').deliver, true, 'first detector transition carries the single OPEN')

  state = cycle(state, [FENCE('job-a', 'occ-s', 7_200_000)], 7_500_000).state // then the same-occurrence fence
  const staged = decide(state, pendingIntents(state))
  const fenceOpen = decisionOf(staged, 'occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-a|occ-s', 'OPEN')
  assert.equal(fenceOpen.deliver, false, 'same-occurrence fence OPEN is coalesced')
  assert.equal(fenceOpen.code, 'coalesced_same_occurrence_stuck_pair')

  state = cycle(state, [FENCE('job-a', 'occ-s', 7_200_000)], 10_800_000).state // stuck closes, fence still open
  const midClose = decide(state, pendingIntents(state))
  const stuckRecovered = decisionOf(midClose, 'occurrence|RUN_STUCK|job-a|occ-s', 'CLOSED_RECOVERED')
  assert.equal(stuckRecovered.deliver, false, 'coalesced incident is not closed while the fence is still open')
  assert.equal(stuckRecovered.code, 'coalesced_same_occurrence_stuck_pair')

  state = cycle(state, [], 14_400_000).state // fence reconciled
  const final = decide(state, pendingIntents(state))
  assert.equal(decisionOf(final, 'occurrence|RUN_STUCK|job-a|occ-s', 'CLOSED_RECOVERED').deliver, false)
  assert.equal(decisionOf(final, 'occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-a|occ-s', 'CLOSED_RECOVERED').deliver, true, 'one RECOVERED when the causal episode is actually closed')
})

test('T-DP-4 simultaneous pair transitions still yield exactly one OPEN and one RECOVERED, deterministically', () => {
  let state = cycle({}, [RUN_STUCK('job-a', 'occ-s', 0), FENCE('job-a', 'occ-s', 1)], 7_200_000).state
  const active = decide(state, pendingIntents(state))
  const activePair = [...active.decisions.values()].filter((d) => d.rootIdentity.startsWith('occurrence|RUN_STUCK'))
  assert.equal(activePair.length, 2, 'both pair members have OPEN decisions')
  assert.equal(activePair.filter((d) => d.deliver).length, 1, 'exactly one OPEN pages for the pair')

  state = cycle(state, [], 10_800_000).state
  const recovered = decide(state, pendingIntents(state))
  const pairDecisions = [...recovered.decisions.values()].filter((d) => d.rootIdentity.startsWith('occurrence|RUN_STUCK'))
  assert.equal(pairDecisions.length, 4, 'both pair members have OPEN + RECOVERED decisions')
  assert.equal(pairDecisions.filter((d) => d.transitionKind === 'CLOSED_RECOVERED' && d.deliver).length, 1, 'exactly one RECOVERED pages once the episode actually closed')
  const stillPendingOpens = pairDecisions.filter((d) => d.transitionKind === 'OPEN' && !d.deliver)
  assert.equal(stillPendingOpens.length, 2, 'undelivered OPENs of a closed episode never page as NEW (stale or pair-coalesced)')

  const again = decide(state, pendingIntents(state))
  assert.deepEqual([...again.decisions.entries()], [...recovered.decisions.entries()], 'projection is a pure function of durable state')
})

test('T-DP-5 a NEW that already recovered before delivery is suppressed; only the truthful RECOVERED pages', () => {
  let state = cycle({}, [RUN_FAILED('job-a', 'occ-1', 900)], 1_000).state // OPEN minted, delivery fails
  state = cycle(state, [], 2_000).state // fact left detection before the intent was ever delivered

  const result = decide(state, pendingIntents(state))
  const open = decisionOf(result, 'occurrence|RUN_FAILED|job-a|occ-1', 'OPEN')
  assert.equal(open.deliver, false, 'stale NEW must not page as if currently active')
  assert.equal(open.code, 'stale_new_incident_recovered')
  assert.equal(decisionOf(result, 'occurrence|RUN_FAILED|job-a|occ-1', 'CLOSED_RECOVERED').deliver, true)
})

test('T-DP-6 restart/replay is idempotent and the projection never mutates durable state', async () => {
  let state = cycle({}, [RUNTIME, RUN_FAILED('job-a', 'occ-in', 1_200), CONSECUTIVE('job-a', 1)], 1_000).state
  const before = structuredClone(state)
  const first = decide(state, pendingIntents(state))
  assert.deepEqual(state, before, 'projection is read-only over the incident store')
  const deliveredKeys = [...first.decisions.entries()].filter(([, d]) => d.deliver).map(([key]) => key)
  assert.equal(deliveredKeys.length, 2, 'runtime + job aggregation page; the attributable child is evidence-only')

  // delivery of the user-facing intents fails durably, then the process "restarts"
  let marked = state
  for (const key of deliveredKeys) marked = markNotificationDelivery(marked, key, 'FAILED', 1_001)
  const retryProjection = decide(marked, pendingIntents(marked))
  assert.deepEqual(
    [...retryProjection.decisions.entries()].filter(([, d]) => d.deliver).map(([key]) => key).sort(),
    [...deliveredKeys].sort(),
    'failed user-facing intents keep their projection decision for retry',
  )

  const dir = await mkdtemp(join(tmpdir(), 'incident-projection-replay-'))
  await chmod(dir, 0o700)
  const path = join(dir, 'incidents.json')
  let hash = loadIncidentState(path).hash
  ;({ hash } = commitIncidentState(path, marked, { expectedHash: hash }))
  const reloaded = loadIncidentState(path).state
  validateIncidentState(reloaded)
  const replayed = decide(reloaded, pendingIntents(reloaded))
  assert.deepEqual([...replayed.decisions.entries()], [...retryProjection.decisions.entries()], 'restart replays identical delivery decisions')
})

test('T-DP-7 internal evidence stays complete: every fact, incident and transition survives projection-only suppression', () => {
  // mirror the production pipeline: annotation joins Agent/Job identity before compilation
  const findings = annotateFindingsWithJobs(
    [RUN_FAILED('job-a', 'occ-2', 1_900), CONSECUTIVE('job-a', 1)],
    [{ id: 'job-a', logicalKey: 'owner:hr', agentId: 'agt-hr' }],
  )
  const state = cycle({}, findings, 2_000).state
  const result = decide(state, pendingIntents(state))

  const child = state.incidents['occurrence|RUN_FAILED|job-a|occ-2']
  assert.ok(child, 'subsumed child incident is still durably compiled')
  assert.equal(child.lifecycle, 'OPEN')
  assert.deepEqual(
    child.facts,
    [{ ...RUN_FAILED('job-a', 'occ-2', 1_900), logicalKey: 'owner:hr', agentId: 'agt-hr' }],
    'raw detector fact preserved with additive identification only',
  )
  assert.equal(state.incidents['job|CONSECUTIVE_FAILURE|job-a|1'].facts[0].consecutiveErrors, 2)
  for (const key of result.suppressed.map((s) => s.notificationKey)) {
    assert.ok(state.outbox[key], 'suppressed intent remains durable and queryable in the single outbox')
  }
  assert.ok(result.suppressed.length >= 1)
})

test('T-DP-8 user-facing text is human-readable and action-oriented; legacy intents keep the frozen wire format', () => {
  const findings = annotateFindingsWithJobs([RUN_FAILED('job-a', 'occ-1', 900)], [{
    id: 'job-a', logicalKey: 'owner:hr', agentId: 'agt-hr',
  }])
  const state = cycle({}, findings, 1_000).state
  const [intent] = pendingIntents(state)
  const text = stableNotificationText(intent)

  assert.ok(text.includes('Agent: agt-hr'), 'identifies the affected Agent')
  assert.ok(text.includes('Job: owner:hr'), 'identifies the affected Job')
  assert.ok(text.includes('First detected:'), 'states the first detected time')
  assert.ok(text.includes('Current state:'), 'states the current state')
  assert.ok(text.includes('Action:'), 'states the action status while open')
  assert.ok(text.includes(intent.incidentId), 'carries exactly one evidence/reference id')
  assert.equal(text.split('notification-key').length - 1, 1, 'raw hash demoted to a single debug footer')
  assert.ok(text.includes(`[notification-key:${intent.notificationKey}]`), 'provider readback marker preserved')
  assert.equal(intent.incident.deliveryProjection, DELIVERY_PROJECTION_VERSION)
  assert.equal(stableNotificationText(structuredClone(intent)), text, 'text is deterministic for binding immutability')

  const recoveredState = cycle(state, [], 2_000).state
  const [recoveredIntent] = pendingIntents(recoveredState).filter((i) => i.transitionKind === 'CLOSED_RECOVERED')
  const recoveredText = stableNotificationText(recoveredIntent)
  assert.ok(recoveredText.includes('RECOVERED'))
  assert.ok(recoveredText.includes('Recovery:'), 'states the recovery status once resolved')

  const legacy = {
    notificationKey: 'a'.repeat(64),
    transitionKind: 'OPEN',
    incident: { rootIdentity: 'control|X|watchdog|w1', rootCauseClass: 'X', facts: [] },
  }
  assert.equal(
    stableNotificationText(legacy),
    `Scheduler watchdog NEW [control|X|watchdog|w1] X [notification-key:${'a'.repeat(64)}]`,
    'pre-projection durable bindings keep their exact frozen payload text',
  )
})

test('T-DP-9 runtime outage subsumes the same-occurrence stuck pair: only the runtime incident pages', () => {
  let state = cycle({}, [RUNTIME], 1_000).state
  state = cycle(state, [RUNTIME, RUN_STUCK('job-a', 'occ-s', 800), FENCE('job-a', 'occ-s', 800)], 2_000).state

  const active = decide(state, pendingIntents(state))
  const deliveredOpens = [...active.decisions.values()].filter((d) => d.transitionKind === 'OPEN' && d.deliver)
  assert.equal(deliveredOpens.length, 1, 'runtime OPEN is the only user-facing opening')
  assert.ok(deliveredOpens[0].rootIdentity.startsWith('control|SCHEDULER_RUNTIME_UNHEALTHY'))
  assert.equal(decisionOf(active, 'occurrence|RUN_STUCK|job-a|occ-s', 'OPEN').deliver, false)
  assert.equal(decisionOf(active, 'occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-a|occ-s', 'OPEN').deliver, false)

  state = cycle(state, [], 3_000).state
  const recovered = decide(state, pendingIntents(state))
  const deliveredCloses = [...recovered.decisions.values()].filter((d) => d.transitionKind === 'CLOSED_RECOVERED' && d.deliver)
  assert.equal(deliveredCloses.length, 1, 'only the runtime recovery pages')
  assert.ok(deliveredCloses[0].rootIdentity.startsWith('control|SCHEDULER_RUNTIME_UNHEALTHY'))
})
