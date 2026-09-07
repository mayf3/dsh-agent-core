/**
 * Unified Scheduler self-service Broker manifest.
 *
 * The manifest is deliberately pure data. `selector: 'action'` opts this one
 * capability into the accepted action selector; every older manifest defaults
 * to `operation`. Exact closed/conditional enforcement lives in the trusted
 * Broker mapping layer, not in the model-facing schema hint.
 */

const nonEmptyString = (description) => ({ type: 'string', minLength: 1, description })

const destination = {
  type: 'object',
  additionalProperties: false,
  required: ['channel', 'to'],
  properties: {
    channel: nonEmptyString('Explicit delivery channel (admin-only).'),
    to: nonEmptyString('Explicit exact delivery destination (admin-only).'),
  },
  description: 'ADMIN ONLY: explicit persisted delivery destination.',
}

const properties = {
  name: nonEmptyString('Human-readable job name.'),
  schedule_kind: { type: 'string', enum: ['cron', 'at', 'every'], description: 'Complete schedule kind.' },
  cron_expr: nonEmptyString('Standard five-field cron expression.'),
  at: nonEmptyString('Future ISO instant or positive relative duration such as 15m.'),
  every_ms: { type: 'integer', minimum: 1, description: 'Fixed interval in milliseconds.' },
  timezone: nonEmptyString('IANA timezone required for cron schedules.'),
  message: nonEmptyString('Agent-turn message executed at each occurrence.'),
  timeout: { type: 'integer', minimum: 1, description: 'Per-occurrence timeout in seconds.' },
  light_context: { type: 'boolean', description: 'Use light context for occurrence turns.' },
  model: nonEmptyString('Optional model override.'),
  logical_key: nonEmptyString(
    'Stable caller-provided logical identity for the job (create only). Persisted and unique; '
    + 're-creating with the same key and the same definition answers the existing job instead of duplicating it; '
    + 're-creating with the same key and a different definition fails closed (logical_key_conflict).',
  ),
  expected_revision: {
    type: 'object',
    additionalProperties: false,
    required: ['schedule_revision', 'updated_at_ms'],
    properties: {
      schedule_revision: { type: 'integer', minimum: 1, description: 'scheduleRevision observed before mutating.' },
      updated_at_ms: { type: 'integer', minimum: 1, description: 'updatedAtMs observed before mutating.' },
    },
    description: 'Compare-before-write guard: refuse (stale_target_conflict, zero write) when the live job moved past the observed revision.',
  },
  delivery_mode: { type: 'string', enum: ['announce', 'none', 'silent'], description: 'Complete delivery mode replacement.' },
  delivery_target: { type: 'string', enum: ['current_conversation'], description: 'Resolve the active trusted Feishu conversation.' },
  destination,
  best_effort: { type: 'boolean', description: 'Best-effort announced delivery.' },
  delete_after_run: { type: 'boolean', description: 'Delete the definition after a completed one-shot.' },
  auto_retry: { type: 'boolean', description: 'Explicit automatic retry opt-in.' },
  target_agent_id: nonEmptyString('ADMIN ONLY: target another Agent.'),
  job_id: nonEmptyString('Opaque Scheduler job id.'),
  limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Maximum run records returned.' },
  all_agents: { type: 'boolean', description: 'ADMIN ONLY: include every Agent.' },
}

const args = (names, required = []) => ({
  additionalProperties: false,
  properties: Object.fromEntries(names.map((name) => [name, properties[name]])),
  required,
})

const mutationNames = [
  'name', 'schedule_kind', 'cron_expr', 'at', 'every_ms', 'timezone', 'message',
  'timeout', 'light_context', 'model', 'delivery_mode', 'delivery_target',
  'destination', 'best_effort', 'delete_after_run', 'auto_retry', 'target_agent_id',
]

const baseErrors = [
  { code: 'invalid_arguments', description: 'Arguments do not satisfy the selected action schema.' },
  { code: 'unsupported_operation', description: 'The requested action is not supported.' },
  { code: 'credential_unavailable', description: 'No trusted caller credential is bound.' },
  { code: 'capability_unavailable', description: 'Scheduler mutation is not ready on this runtime (credential provider unconfigured or caller unbound); the mutation never reached the Scheduler.' },
  { code: 'access_denied', description: 'The caller is not authorized for the requested target.' },
  { code: 'job_not_found', description: 'No visible job has the requested id.' },
  { code: 'validation_error', description: 'The Scheduler rejected the normalized definition.' },
  { code: 'logical_key_conflict', description: 'The logical key is already bound to a job with a different desired definition; no write was performed.' },
  { code: 'stale_target_conflict', description: 'The job moved past the expected revision; re-read and re-apply. No write was performed.' },
  { code: 'mutation_not_applied', description: 'Canonical read-back proved the mutation never committed; a retry with the SAME logical identity is safe.' },
  { code: 'mutation_outcome_unknown', description: 'The mutation may have committed and read-back could not prove the state; do not retry blindly — the watchdog will alert.' },
  { code: 'internal_error', description: 'The local Scheduler handler failed.' },
]

const operation = (name, description, argumentSchema, errors) => ({
  name,
  description,
  arguments: argumentSchema,
  result: { type: 'json' },
  errors,
})

export const schedulerManifest = {
  id: 'scheduler',
  toolName: 'scheduler',
  selector: 'action',
  name: 'Scheduler',
  description:
    'Create, inspect, update, enable, disable, and remove the calling Agent\'s Scheduler V2 definitions. ' +
    'Caller identity and current conversation come only from trusted Parent Runtime context. ' +
    'Announced delivery for an ordinary Agent must use delivery_target=current_conversation.',
  local: { resource: 'scheduler' },
  errors: baseErrors,
  operations: [
    operation('create', 'Create one scheduled job.', args([...mutationNames, 'logical_key'], ['name', 'schedule_kind', 'message', 'logical_key']), ['invalid_arguments', 'access_denied', 'validation_error', 'logical_key_conflict', 'capability_unavailable', 'mutation_not_applied']),
    operation('list', 'List visible job definitions.', args(['all_agents', 'logical_key', 'job_id']), ['invalid_arguments', 'access_denied']),
    operation('runs', 'Read visible occurrence evidence.', args(['job_id', 'limit', 'all_agents']), ['invalid_arguments', 'access_denied', 'job_not_found']),
    operation('update', 'Replace selected mutable fields on one job.', args(['job_id', 'expected_revision', ...mutationNames], ['job_id']), ['invalid_arguments', 'access_denied', 'job_not_found', 'validation_error', 'stale_target_conflict', 'capability_unavailable', 'mutation_not_applied']),
    operation('enable', 'Enable one job for future slots.', args(['job_id', 'expected_revision'], ['job_id']), ['invalid_arguments', 'access_denied', 'job_not_found', 'stale_target_conflict', 'capability_unavailable', 'mutation_not_applied']),
    operation('disable', 'Disable future occurrence minting for one job.', args(['job_id', 'expected_revision'], ['job_id']), ['invalid_arguments', 'access_denied', 'job_not_found', 'stale_target_conflict', 'capability_unavailable', 'mutation_not_applied']),
    operation('remove', 'Remove one definition while retaining occurrence evidence.', args(['job_id', 'expected_revision'], ['job_id']), ['invalid_arguments', 'access_denied', 'job_not_found', 'stale_target_conflict', 'capability_unavailable', 'mutation_not_applied']),
  ],
}

/** Compatibility export consumed by the Broker default manifest list. */
export const schedulerManifests = [schedulerManifest]
