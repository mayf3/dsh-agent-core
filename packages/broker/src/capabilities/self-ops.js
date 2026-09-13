/** Caller-scoped Scheduler termination-reconciliation tool (accepted Tools V3). */

const string = (description) => ({ type: 'string', minLength: 1, description })
const args = (properties, required = []) => ({
  additionalProperties: false,
  structuralDiagnostics: true,
  properties,
  required,
})

const errorCodes = [
  'invalid_arguments', 'capability_unavailable', 'not_found_or_not_owned',
  'not_reconcilable', 'termination_not_proven', 'correlation_mismatch',
  'business_outcome_available', 'store_conflict', 'internal_error',
]

export const selfOpsManifest = {
  id: 'self_ops',
  toolName: 'self_ops',
  selector: 'action',
  infrastructure: true,
  name: 'Self Operations',
  description:
    'Inspect the calling Agent runtime and Scheduler blockers, and reconcile only an exact '
    + 'caller-owned run whose termination without business outcome is proven by the trusted Runtime.',
  local: { resource: 'scheduler' },
  errors: errorCodes.map((code) => ({ code, description: code.replaceAll('_', ' ') })),
  operations: [
    {
      name: 'status',
      description: 'Read a bounded caller-owned runtime and Scheduler blocker projection.',
      arguments: args({}),
      result: { type: 'json' },
      errors: errorCodes,
    },
    {
      name: 'reconcile_turn',
      description: 'Reconcile proven termination for one exact caller-owned unknown run.',
      arguments: args({
        job_id: string('Exact Scheduler job id.'),
        occurrence_id: string('Exact Scheduler occurrence id.'),
        run_id: string('Exact Scheduler run id.'),
      }, ['job_id', 'occurrence_id', 'run_id']),
      result: { type: 'json' },
      errors: errorCodes,
    },
  ],
}

export const selfOpsManifests = [selfOpsManifest]
