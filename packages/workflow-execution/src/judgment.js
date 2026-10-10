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
 * WORKFLOW_STALE_REENTRY_V1 CTR-SRE-002: extract the dispatch-time business
 * baseline (instance workflow_state_version) from ONE instance-detail read
 * performed AS THE TARGET AGENT immediately after a successful delivery.
 * Best-effort by contract: a failure yields ok:false and the attempt is
 * simply never stale-eligible (conservative V2 behaviour for it).
 *
 * @returns {{ok:true, version:number} | {ok:false, reason:string}}
 */
export function judgeDispatchVersionFromDetail({ body }) {
  const { visibility, detail } = body ?? {}
  if (visibility !== 'full' || detail === null || typeof detail !== 'object') {
    return { ok: false, reason: 'dispatch_version_unavailable: unexpected visibility' }
  }
  const version = detail.instance?.workflow_state_version
  if (!Number.isInteger(version) || version < 1) {
    return { ok: false, reason: 'dispatch_version_unavailable: no instance workflow_state_version' }
  }
  return { ok: true, version }
}

/**
 * WORKFLOW_STALE_REENTRY_V1 CTR-SRE-002: the stale re-entry judgment from
 * ONE instance-detail read performed AS THE TARGET AGENT (same seam and
 * visibility invariant as the settle probe). Pure — no I/O, no clocks; the
 * engine owns the delivered-age threshold check.
 *
 * ONLY svc business facts decide:
 *   - visit moved / instance terminal            → 'progressed' (business
 *     moved on: transition, RETURN, admin move, cancel, archive)
 *   - version != workflowStateVersionAtDispatch  → 'progressed' (assistance
 *     open / HUMAN_REQUIRED, wake, admin ops — all bump the version; Goal
 *     CASE 4: never stale-redispatch past a new ownership state)
 *   - visit still current + version unchanged    → 'stale_confirmed'
 *   - any unreadable state                       → 'unavailable' (never stale)
 *
 * @returns {{kind:'stale_confirmed'|'progressed'|'unavailable', reason:string}}
 */
export function judgeStaleFromDetail({ body, nodeVisitId, workflowStateVersionAtDispatch }) {
  const { visibility, detail } = body ?? {}
  if (visibility === 'historical_participant') {
    return { kind: 'progressed', reason: 'assignee_no_longer_current: instance moved past our visit (visibility invariant)' }
  }
  if (visibility !== 'full' || detail === null || typeof detail !== 'object') {
    return { kind: 'unavailable', reason: `stale_check_unavailable: unexpected visibility ${JSON.stringify(visibility ?? null)}` }
  }
  const currentVisitId = detail.current_node_visit_id
  if (typeof currentVisitId !== 'string' || !UUID_RE.test(currentVisitId)) {
    return { kind: 'unavailable', reason: 'stale_check_unavailable: full detail has no current_node_visit_id' }
  }
  if (currentVisitId.toLowerCase() !== nodeVisitId.toLowerCase()) {
    return { kind: 'progressed', reason: 'node_visit_no_longer_current' }
  }
  if (detail.instance?.is_terminal === true) {
    return { kind: 'progressed', reason: 'instance_terminal' }
  }
  const version = detail.instance?.workflow_state_version
  if (!Number.isInteger(version) || version < 1) {
    return { kind: 'unavailable', reason: 'stale_check_unavailable: no instance workflow_state_version' }
  }
  if (!Number.isInteger(workflowStateVersionAtDispatch)) {
    return { kind: 'unavailable', reason: 'stale_check_unavailable: no workflowStateVersionAtDispatch recorded at delivery' }
  }
  if (version !== workflowStateVersionAtDispatch) {
    return { kind: 'progressed', reason: `workflow_state_version advanced (${workflowStateVersionAtDispatch} -> ${version}) since dispatch` }
  }
  return { kind: 'stale_confirmed', reason: `visit still current with workflow_state_version ${version} unchanged since dispatch` }
}

/**
 * #724 submission-gap diagnosis — a READ-ONLY explain-result beside the frozen
 * reconcile judgment (never a new execution state, never an auto-retry
 * trigger): given one ended attempt, its settle probe result, and the
 * structured tool result of the SAME attempt's last workflow_execute
 * submission, name the explainable category with explicit evidence references
 * and evidence gaps. Pure: no I/O, no clocks, deterministic; it never submits,
 * retries, swaps versions, substitutes identity, or infers a business fact
 * from exit0 shapes or model text.
 *
 * Category contract (#724):
 *   - INPUT_INVALID: same-attempt structured submission/context rejection
 *     (field paths + error code + request ref only — never payload values);
 *   - STALE_VERSION: same-attempt workflow_state_version_conflict — suggests
 *     re-reading the current visit and an explicit resubmission decision;
 *   - AUTHORIZATION_BLOCKED: explicit identity/permission denial, original
 *     error preserved, no fallback principal/token/global-read;
 *   - OUTCOME_UNKNOWN: the call may have landed but the result is unknown
 *     (timeout/5xx/malformed/still-processing or unreadable evidence) —
 *     reconcile via the original read entry, never repeat the call;
 *   - NO_COMMIT_OBSERVED: run ended with the visit still current and no
 *     provable cause from the categories above — model "done" text and
 *     success-shaped results are never business conclusions;
 *   - 'settled' / 'progressed': the existing vocabulary reused verbatim —
 *     the instance moved past this attempt, which is not a business-quality
 *     verdict. Cross-attempt / stale-visit / non-JSON evidence never upgrades
 *     to a cause: it is excluded and reported in missingEvidence.
 *
 * @param {object} input
 * @param {{attemptId?:string, nodeVisitId?:string, workflowInstanceId?:string,
 *          phase?:string}} input.attempt - ledger projection of the attempt.
 * @param {{kind:'settled'|'still_current'|'unavailable'|'progressed', reason:string}|undefined}
 *          input.settle - judgeSettleFromDetail / judgeStaleFromDetail output.
 * @param {{attemptId?:string, nodeVisitId?:string, workflowInstanceId?:string,
 *          ok?:boolean, text?:unknown, error?:{code?:string, fieldPaths?:string[],
 *          requestId?:string}}|undefined} input.lastToolResult - structured
 *          result of the SAME attempt's last submission call (values are
 *          dropped by contract; only codes/paths/request ids are referenced).
 * @param {'readable'|'unreadable'|'truncated'|'cross_attempt'} [input.evidenceStatus]
 * @returns {{category:string, evidenceRefs:string[], missingEvidence:string[],
 *            suggestedNextStep:string}}
 */
export function diagnoseSubmissionGap({ attempt, settle, lastToolResult, evidenceStatus } = {}) {
  const evidenceRefs = []
  const missingEvidence = []
  const attemptId = attempt?.attemptId
  if (typeof attemptId === 'string' && attemptId !== '') evidenceRefs.push(`attempt:${attemptId}`)
  const outcomeUnknown = () => ({
    category: 'OUTCOME_UNKNOWN',
    evidenceRefs,
    missingEvidence,
    suggestedNextStep: 'the outcome cannot be established from the retained evidence: read back the instance via workflow_instance_detail with the original entry to reconcile before any further action; this diagnosis never re-sends the call',
  })
  const noCommitObserved = () => ({
    category: 'NO_COMMIT_OBSERVED',
    evidenceRefs,
    missingEvidence,
    suggestedNextStep: 'the run ended with the visit still current and no provable submission-blocking cause: complete the work and commit via workflow_execute.transition, or use the existing Assistance path when actually blocked; model text and exit0 shapes are never completion evidence',
  })

  // 1. The business moved past this attempt: reuse settled/progressed verbatim.
  if (settle?.kind === 'settled' || settle?.kind === 'progressed') {
    if (typeof settle.reason === 'string' && settle.reason !== '') evidenceRefs.push(`settle:${settle.reason}`)
    return {
      category: settle.kind,
      evidenceRefs,
      missingEvidence,
      suggestedNextStep: 'no submission is needed for this attempt: the instance moved past it (settled/progressed). This is not a business-quality verdict',
    }
  }
  // 2. Without a verified run linkage nothing about the submission can be classified.
  if (attempt?.phase !== 'run_delivered') {
    missingEvidence.push('no verified run linkage for this attempt (delivery unverified)')
    return outcomeUnknown()
  }
  // 3. The submission-gap premise (visit still awaiting this submission) needs
  //    a settle probe; without one even NO_COMMIT_OBSERVED would be a guess.
  if (settle === undefined || settle === null || settle?.kind === 'unavailable') {
    missingEvidence.push('settle probe unavailable: cannot establish whether the visit still awaits this submission')
    return outcomeUnknown()
  }
  // 4. Unreadable/truncated evidence is unknown — never "no call was made".
  const status = evidenceStatus ?? 'readable'
  if (status === 'unreadable' || status === 'truncated') {
    missingEvidence.push(`evidence ${status}: the correlated structured result could not be read completely for this attempt`)
    return outcomeUnknown()
  }
  // 5. Only a truly same-attempt structured result may classify; anything else
  //    is an explicit gap (cross-attempt evidence never upgrades to a cause).
  let result
  if (lastToolResult !== undefined && lastToolResult !== null && typeof lastToolResult === 'object') {
    const sameAttempt = (lastToolResult.attemptId === undefined || attemptId === undefined || lastToolResult.attemptId === attemptId) &&
      (lastToolResult.nodeVisitId === undefined || attempt?.nodeVisitId === undefined || lastToolResult.nodeVisitId === attempt.nodeVisitId)
    if (!sameAttempt || status === 'cross_attempt') {
      missingEvidence.push('a structured tool result exists but belongs to another attempt/visit; it is excluded from this diagnosis (cross-attempt evidence stays a gap)')
    } else {
      result = lastToolResult
    }
  }
  // 6. Classify by the structured error code, when there is one.
  const code = result?.error?.code
  if (result !== undefined && typeof code === 'string' && code !== '') {
    evidenceRefs.push(`tool_result:error.code=${code}`)
    if (typeof result.error.requestId === 'string' && result.error.requestId !== '') evidenceRefs.push(`tool_result:requestId=${result.error.requestId}`)
    if (Array.isArray(result.error.fieldPaths)) {
      for (const path of result.error.fieldPaths) {
        if (typeof path === 'string' && path !== '') evidenceRefs.push(`tool_result:field=${path}`)
      }
    }
    if (SUBMISSION_VALIDATION_CODES.has(code)) {
      return {
        category: 'INPUT_INVALID',
        evidenceRefs,
        missingEvidence,
        suggestedNextStep: 'fix the rejected fields named by the preserved error detail and resubmit explicitly through the existing flow; do not change identity or widen scope',
      }
    }
    if (code === 'workflow_state_version_conflict') {
      return {
        category: 'STALE_VERSION',
        evidenceRefs,
        missingEvidence,
        suggestedNextStep: 're-read the current visit via workflow_instance_detail, then explicitly decide whether to resubmit under the fresh version exactly as the execution instruction allows (once); this diagnosis never swaps versions and never submits',
      }
    }
    if (SUBMISSION_AUTHZ_CODES.has(code)) {
      return {
        category: 'AUTHORIZATION_BLOCKED',
        evidenceRefs,
        missingEvidence,
        suggestedNextStep: 'keep the original denial: resolve authorization through the existing domain membership/ownership channels; the diagnosis never substitutes identity',
      }
    }
    if (SUBMISSION_OUTCOME_UNKNOWN_CODES.has(code)) {
      missingEvidence.push('the submission call may have landed but its result is unknown')
      return outcomeUnknown()
    }
    // A definite structured rejection outside the diagnosis vocabulary stands
    // as-is — it is never bent into one of the categories above.
    missingEvidence.push(`structured rejection code "${code}" is outside the diagnosis vocabulary; the original error stands uninterpreted`)
    return noCommitObserved()
  }
  if (result !== undefined && result.ok === true) {
    missingEvidence.push('the retained tool result is success-shaped while the settle probe still shows the visit awaiting submission; a success shape is never a business fact')
  }
  return noCommitObserved()
}

/** Same-attempt structured rejection codes that name invalid submission/context input. */
const SUBMISSION_VALIDATION_CODES = new Set([
  'context_validation_failed', 'invalid_input', 'submission_required', 'submission_validation_failed',
  'size_limit_exceeded', 'invalid_return_references', 'transition_not_applicable', 'idempotency_conflict',
  'binding_error',
])

/** Explicit identity/permission denial codes (svc + local fail-closed credential seam). */
const SUBMISSION_AUTHZ_CODES = new Set([
  'principal_not_found', 'principal_disabled', 'principal_not_assignee', 'not_domain_owner',
  'domain_membership_required', 'domain_disabled', 'cross_domain_violation', 'credential_unavailable',
  'credential_invalid', 'authorization_denied',
  // Manifest-declared auth-layer denials every workflow_execute call can
  // produce (broker authErrors: claims.rs / error.rs) — an expired bearer or
  // a missing scope is an authorization block, never a missing commit.
  'unauthenticated', 'forbidden',
])

/** Codes where the call may have landed but the result is unknowable. */
const SUBMISSION_OUTCOME_UNKNOWN_CODES = new Set([
  'transport_failure', 'http_5xx', 'malformed_response', 'command_still_processing',
])

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
