/**
 * Internal pure attribution for the `unsupported` fold of the trusted
 * Router-readback classification (self-ops diagnosis neighborhood).
 *
 * UNINTEGRATED: this module has no production caller. The public self_ops
 * surfaces are frozen by AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V4
 * (CTR-V3-STATUS-001 bounded projection: row shape + closed
 * routerDisposition enum; CTR-V3-RECON-002 closed negative matrix), so the
 * richer attribution below must stay internal until a contract amendment
 * provides a legal producer surface. It is consumed only by the isolated
 * regression battery.
 *
 * What this adds: classifyRouter folds structurally distinct no-proof
 * readbacks into one `unsupported` disposition (bare literal for the
 * missing-evidence folds; raw snapshot/handle still attached internally for
 * outcome-vocabulary misses — status() reads only .disposition, so the
 * public row cannot tell them apart), and returns a direct opaque
 * `mismatch` for both owner mismatches and wrong exact triples.
 * diagnoseRouterReadback re-runs the real classifyRouter and, when it
 * folds, attributes the FIRST fold point in classifyRouter's own check
 * order; for `mismatch` it splits OWNER_MISMATCH vs
 * TRIPLE_MISSING_OR_WRONG internally. Both carry an evidence map of
 * existence/trust booleans and the fixed missing-evidence → next-legal-
 * Owner-action mapping.
 *
 * Hard bounds (mirrored by the battery):
 * - pure and synchronous — a thenable provider return violates the
 *   synchronous readback contract and is NEVER awaited (fail-closed
 *   UNEXPECTED_THENABLE);
 * - nothing is upgraded to a trusted terminal: the verdict is always the
 *   real classifyRouter verdict; a fold stays UNKNOWN, zero dispatch,
 *   zero settlement, zero write;
 * - the result carries only the public enum value, an internal closed
 *   reason enum, existence/trust booleans and fixed action strings — never
 *   payload, ids, handles, snapshot bodies, paths, sessions or credentials,
 *   so foreign/legacy/retargeted opaque denials are not bypassed or
 *   enriched.
 */

import { classifyRouter, requestIdFor, ROUTER_DISPOSITIONS } from './diagnosis.js'
import { TRUSTED_TERMINATION_EVIDENCE } from './invoker-outcome.js'

/** Closed internal reason enum for `unsupported` attribution. */
export const UNSUPPORTED_READBACK_REASONS = new Set([
  'UNEXPECTED_THENABLE',
  'EMPTY_OR_NON_OBJECT_RETURN',
  'PROVIDER_CONTRACT_MISMATCH',
  'NOT_SETTLED',
  'MISSING_SNAPSHOT',
  'OWNER_MISMATCH',
  'TRIPLE_MISSING_OR_WRONG',
  'MISSING_HANDLE',
  'UNTRUSTED_TERMINATION_KIND',
  'UNKNOWN_OUTCOME',
])

// Fixed, data-free action strings. No interpolation: the mapping must never
// echo live readback content and must never promise self-service recovery
// that the evidence does not prove.
const NEXT_LEGAL_ACTION = Object.freeze({
  UNEXPECTED_THENABLE:
    'no legal self action: the Router readback violated its synchronous contract and was not awaited — '
    + 'repair the provider wiring at the runtime boundary, then let the next trusted readback re-derive; '
    + 'the occurrence stays outcome_unknown with zero dispatch and zero write',
  EMPTY_OR_NON_OBJECT_RETURN:
    'no legal self action: re-sample through the same trusted provider later, or settle through the '
    + 'operator reconcile path with real terminal evidence; occurrence stays outcome_unknown, zero write',
  PROVIDER_CONTRACT_MISMATCH:
    'no legal self action: the return is not a Router closed-union envelope — repair the provider '
    + 'wiring, then re-derive; occurrence stays outcome_unknown, zero write',
  NOT_SETTLED:
    'no legal self action: no trusted settlement exists yet — wait for a real terminal proof or use '
    + 'the operator reconcile path; occurrence stays outcome_unknown, zero dispatch',
  MISSING_SNAPSHOT:
    'no legal self action: a settled claim without a snapshot is unactionable — operator reconcile '
    + 'with real terminal evidence only; occurrence stays outcome_unknown, zero write',
  OWNER_MISMATCH:
    'no disclosure and no self action: the readback is an opaque correlation mismatch — verify the '
    + 'owned run coordinates through the owned scheduler readback surface; zero write',
  TRIPLE_MISSING_OR_WRONG:
    'no disclosure and no self action: the exact occurrence/run/request correlation is absent or '
    + 'wrong — re-derive it from owned records only; zero write',
  MISSING_HANDLE:
    'no legal self action: termination evidence exists but the opaque handle needed for the evidence '
    + 'id is missing — operator reconcile only; occurrence stays outcome_unknown, zero write',
  UNTRUSTED_TERMINATION_KIND:
    'no legal self action: the termination kind is outside the trusted vocabulary (HUMAN_REQUIRED) — '
    + 'operator reconcile with real terminal evidence only; occurrence stays outcome_unknown, zero write',
  UNKNOWN_OUTCOME:
    'no legal self action: the readback outcome is outside the closed disposition vocabulary — '
    + 'operator-authority settlement only; occurrence stays outcome_unknown, zero write',
})

const SUPPORTED_NEXT_LEGAL_ACTION = Object.freeze({
  terminated_without_outcome:
    'the existing termination-only contract applies (self_ops.reconcile_turn); this diagnostic '
    + 'itself performs no write',
  late_completed:
    'trusted business completion belongs to the authorized late-outcome authority, not the '
    + 'termination-only path; self stays zero-write',
  late_failed:
    'trusted business failure belongs to the authorized late-outcome authority, not the '
    + 'termination-only path; self stays zero-write',
  pending:
    'no trusted terminal yet — no action; the occurrence stays outcome_unknown, zero dispatch',
  restart_lost:
    'router-side loss of the exact correlation — no self action; operator reconcile path only; '
    + 'zero dispatch',
  evicted:
    'router-side eviction of the exact run — no self action; operator reconcile path only; '
    + 'zero dispatch',
  never_existed:
    'no such run on the Router — no self action; verify owned coordinates; zero dispatch',
  mismatch:
    'opaque correlation mismatch — no disclosure, no self action, zero write',
  conflict:
    'correlation conflict — no disclosure, no self action, zero write',
})

function collectEvidence(result, record, callerAgentId) {
  const isObject = result !== null && typeof result === 'object'
  const evidence = {
    providerReturnPresent: result !== null && result !== undefined,
    resultObject: isObject,
    syncContractHeld: !(isObject && typeof result.then === 'function'),
    settledStateClaimed: result?.state === 'settled',
    snapshotPresent: Boolean(result?.snapshot),
    ownerMatches: null,
    tripleMatches: null,
    handlePresent: null,
    terminationEvidenceTrusted: null,
    outcomeRecognized: null,
  }
  const snapshot = result?.snapshot
  if (evidence.snapshotPresent && snapshot && typeof snapshot === 'object') {
    evidence.ownerMatches = snapshot.agentId === callerAgentId
    const expected = {
      occurrenceId: record.occurrenceId,
      runId: record.runId,
      requestId: requestIdFor(record),
    }
    evidence.tripleMatches = evidence.ownerMatches && Boolean(snapshot.callerCorrelation)
      && Object.keys(expected).every((key) => snapshot.callerCorrelation?.[key] === expected[key])
    const effective = snapshot.lateOutcome ?? snapshot.outcome ?? 'unsupported'
    evidence.outcomeRecognized = typeof effective === 'string' && ROUTER_DISPOSITIONS.has(effective)
    if (effective === 'terminated_without_outcome') {
      evidence.handlePresent = typeof result.handle === 'string' && result.handle !== ''
      evidence.terminationEvidenceTrusted = TRUSTED_TERMINATION_EVIDENCE.has(snapshot.terminationEvidence)
    }
  }
  return evidence
}

// Mirror of classifyRouter's fold-point order; returns [reason, missing].
// Only reached when the real classifyRouter already folded to `unsupported`.
function attributeFold(result, record, callerAgentId) {
  if (!result || typeof result !== 'object') return ['EMPTY_OR_NON_OBJECT_RETURN', ['providerReturnObject']]
  if (typeof result.then === 'function') return ['UNEXPECTED_THENABLE', ['synchronousProviderReturn']]
  if (typeof result.state !== 'string') return ['PROVIDER_CONTRACT_MISMATCH', ['closedUnionState']]
  if (result.state !== 'settled') return ['NOT_SETTLED', ['trustedSettlement']]
  if (!result.snapshot) return ['MISSING_SNAPSHOT', ['readbackSnapshot']]
  const snapshot = result.snapshot
  if (snapshot.agentId !== callerAgentId) return ['OWNER_MISMATCH', ['ownerMatch']]
  const expected = {
    occurrenceId: record.occurrenceId,
    runId: record.runId,
    requestId: requestIdFor(record),
  }
  if (!snapshot.callerCorrelation
    || Object.keys(expected).some((key) => snapshot.callerCorrelation[key] !== expected[key])) {
    return ['TRIPLE_MISSING_OR_WRONG', ['callerCorrelationTriple']]
  }
  const effective = snapshot.lateOutcome ?? snapshot.outcome ?? 'unsupported'
  if (effective === 'terminated_without_outcome') {
    if (typeof result.handle !== 'string' || result.handle === '') {
      return ['MISSING_HANDLE', ['opaqueHandle']]
    }
    if (!TRUSTED_TERMINATION_EVIDENCE.has(snapshot.terminationEvidence)) {
      return ['UNTRUSTED_TERMINATION_KIND', ['trustedTerminationEvidence']]
    }
  }
  return ['UNKNOWN_OUTCOME', ['recognizedClosedOutcome']]
}

/**
 * Attribute one Router-readback classification. Always runs the real
 * classifyRouter; the verdict (including `unsupported`) is never invented
 * here. `unsupported` folds are attributed to the first missing evidence
 * layer; the `mismatch` verdict — which classifyRouter produces directly,
 * not as a fold — is split internally into OWNER_MISMATCH vs
 * TRIPLE_MISSING_OR_WRONG without weakening its opaque public semantics.
 * Other supported dispositions pass through with reason:null.
 */
export function diagnoseRouterReadback(result, record, callerAgentId) {
  const classified = classifyRouter(result, record, callerAgentId)
  const evidence = collectEvidence(result, record, callerAgentId)
  if (classified.disposition === 'unsupported' || classified.disposition === 'mismatch') {
    const [reason, missingEvidence] = attributeFold(result, record, callerAgentId)
    const attributable = classified.disposition === 'unsupported'
      || reason === 'OWNER_MISMATCH' || reason === 'TRIPLE_MISSING_OR_WRONG'
    if (attributable) {
      return {
        disposition: classified.disposition,
        foldedUnsupported: classified.disposition === 'unsupported',
        reason,
        evidence,
        missingEvidence,
        nextLegalAction: NEXT_LEGAL_ACTION[reason],
      }
    }
  }
  return {
    disposition: classified.disposition,
    foldedUnsupported: false,
    reason: null,
    evidence,
    missingEvidence: [],
    nextLegalAction: SUPPORTED_NEXT_LEGAL_ACTION[classified.disposition] ?? 'no mapped action',
  }
}
