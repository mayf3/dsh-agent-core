/**
 * @agent-core/workflow-execution/src/judgment.js — pure judgment helpers
 * (WORKFLOW_AGENT_EXECUTION_V1). No I/O, no clocks: everything is derived
 * from explicit inputs so the reconcile rules are unit-table-testable.
 *
 * Semantic anchors (the AGENT_SPECIAL_SEMANTICS of the goal):
 *  - a model reply "收到"/"完成了" is NEVER a business fact;
 *  - the ONLY settle fact is svc-workflow state: the NodeVisit is no longer
 *    the current visit (someone's transition committed) or the assignee is
 *    provably no longer current;
 *  - reply timeouts / lost reconciliation records are outcome UNKNOWN —
 *    unknown never becomes "not delivered, so run it again".
 */

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/** The exact 7-field camelCase due-feed record contract (VISIT_ACTIVATION_V1). */
export function normalizeDueIntent(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'not an object' }
  const required = ['dispatchIntentId', 'nodeVisitId', 'workflowInstanceId', 'ownerPrincipalId', 'nextEligibleAt', 'createdAt', 'updatedAt']
  const keys = Object.keys(raw)
  for (const field of required) {
    if (!keys.includes(field)) return { ok: false, reason: `missing field ${field}` }
  }
  if (keys.length !== required.length) return { ok: false, reason: `unexpected fields: ${keys.filter((k) => !required.includes(k)).join(',')}` }
  for (const field of ['dispatchIntentId', 'nodeVisitId', 'workflowInstanceId', 'ownerPrincipalId']) {
    if (typeof raw[field] !== 'string' || !UUID_RE.test(raw[field])) return { ok: false, reason: `${field} is not a UUID` }
  }
  for (const field of ['nextEligibleAt', 'createdAt', 'updatedAt']) {
    if (typeof raw[field] !== 'string' || raw[field] === '') return { ok: false, reason: `${field} is not a timestamp string` }
  }
  return {
    ok: true,
    intent: {
      dispatchIntentId: raw.dispatchIntentId.toLowerCase(),
      nodeVisitId: raw.nodeVisitId.toLowerCase(),
      workflowInstanceId: raw.workflowInstanceId.toLowerCase(),
      ownerPrincipalId: raw.ownerPrincipalId.toLowerCase(),
      nextEligibleAt: raw.nextEligibleAt,
    },
  }
}

/**
 * Settle judgment from ONE instance-detail read performed WITH THE TARGET
 * AGENT'S OWN PRINCIPAL (the assignee gets full visibility; a poller
 * principal would get historical_participant at best and 403 at worst).
 *
 * Wire shapes (svc-workflow VISIT_ACTIVATION_V1, snake_case detail):
 *   {visibility:'full', detail:{instance:{is_terminal,...}, current_node_visit_id, current_visit:{...}}}
 *   {visibility:'historical_participant', detail:{instance:{is_terminal,...}}}   // no visit id
 *
 * The visibility invariant that makes the restricted case decidable:
 * at admission the attempt's agent IS the due visit's canonical assignee
 * (ownerPrincipalId resolved it). Node-visit rows are immutable (assignee is
 * fixed at visit creation), so if our visit were STILL the current visit its
 * assignee — our agent — would hold CurrentAssigneeFull visibility. Therefore
 * `historical_participant` mechanically proves our visit is no longer current
 * (the instance moved on: committed transition, admin move, or termination).
 * That is exactly the settled business fact; it is never inferred from model
 * text.
 *
 * @returns {{kind:'settled', reason:string}
 *           | {kind:'still_current', reason:string}
 *           | {kind:'unavailable', reason:string}}
 */
export function judgeSettleFromDetail({ body, nodeVisitId }) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { kind: 'unavailable', reason: 'settle_check_unavailable: detail response is not an object' }
  }
  const { visibility, detail } = body
  if (visibility === 'historical_participant') {
    return { kind: 'settled', reason: 'assignee_no_longer_current: instance moved past our visit (visibility invariant)' }
  }
  if (visibility !== 'full' || detail === null || typeof detail !== 'object') {
    return { kind: 'unavailable', reason: `settle_check_unavailable: unexpected visibility ${JSON.stringify(visibility ?? null)}` }
  }
  const currentVisitId = detail.current_node_visit_id
  if (typeof currentVisitId !== 'string' || !UUID_RE.test(currentVisitId)) {
    // A full view must carry the current visit id; absence is an unreadable
    // state, never silently treated as settled.
    return { kind: 'unavailable', reason: 'settle_check_unavailable: full detail has no current_node_visit_id' }
  }
  if (currentVisitId.toLowerCase() === nodeVisitId.toLowerCase()) {
    return { kind: 'still_current', reason: 'node_visit_still_current' }
  }
  return { kind: 'settled', reason: 'node_visit_no_longer_current' }
}

/**
 * Reconcile judgment for ONE ACTIVE attempt, given the Router's turn
 * reconciliation state and the settle probe result.
 *
 * @param {object} attempt - ledger projection (phase planned | run_delivered).
 * @param {object} input
 * @param {string} input.turnState - getTurnReconciliation()/resolveCallerCorrelation()
 *   state: 'pending' | 'settled' | 'evicted' | 'restart_lost' | 'never_existed',
 *   or undefined when the attempt has no run linkage to query.
 * @param {{kind:'settled'|'still_current'|'unavailable', reason:string}|undefined} input.settle
 *   - judgeSettleFromDetail result; required when the turn lookup is terminal/lost.
 * @returns {{state:'ACTIVE'|'SETTLED'|'NEEDS_REVIEW', judgment:string, reason:string}}
 */
export function judgeAttempt(attempt, { turnState, settle }) {
  // No verified Run linkage: the attempt was planned but delivery was never
  // recorded (crash window inside the delivery seam). Unknown — never a
  // second delivery.
  if (attempt.phase !== 'run_delivered' || turnState === undefined) {
    return { state: 'NEEDS_REVIEW', judgment: 'delivery_unverified', reason: 'attempt has no verified Run linkage (planned but delivery not recorded)' }
  }
  // The Run is still in flight: ACTIVE, no settle probe spent on it.
  if (turnState === 'pending') {
    return { state: 'ACTIVE', judgment: 'run_running', reason: 'turn reconciliation pending (run in flight)' }
  }
  // Terminal or lost turn record: the settle probe is the deciding evidence.
  if (settle === undefined) {
    return { state: 'NEEDS_REVIEW', judgment: 'settle_check_unavailable', reason: 'turn terminal but no settle probe ran' }
  }
  if (settle.kind === 'settled') {
    return { state: 'SETTLED', judgment: 'business_commitment_observed', reason: settle.reason }
  }
  if (settle.kind === 'unavailable') {
    return { state: 'NEEDS_REVIEW', judgment: 'settle_check_unavailable', reason: settle.reason }
  }
  // still_current: the run ENDED (or its outcome is unknowable) and the visit
  // still awaits its business submission. A completed turn with text like
  // "完成了" but no committed transition lands here — that is the negative
  // case the V1 contract requires, never a silent loss, never a rerun.
  if (turnState === 'settled') {
    return { state: 'NEEDS_REVIEW', judgment: 'run_ended_no_submission', reason: `run ended without committing the transition (${settle.reason})` }
  }
  return { state: 'NEEDS_REVIEW', judgment: 'run_outcome_unknown', reason: `run outcome unknown (${turnState}) while ${settle.reason}` }
}
