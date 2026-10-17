/**
 * FIXED_OPERATION_V1 — the model-visible surface for invoking a PRE-REGISTERED
 * immutable workflow operation. Exactly ONE operation (`invoke`): the agent
 * selects an operation_key at a pinned expected_version/expected_hash and
 * fills the `input` object; the wire schema has NO field for scripts, shell
 * commands, executable text, agent identity, or workflow coordinates — the
 * caller identity and the trusted workflow_execution context arrive
 * server-side (gateway + Router provenance), and the answer is a structured
 * receipt of what the operation did (never a workflow business commit).
 */

const string = (description) => ({ type: 'string', minLength: 1, description })

const errorCodes = [
  'invalid_arguments', 'invalid_input', 'unknown_operation',
  'operation_hash_mismatch', 'trusted_caller_required',
  'trusted_workflow_context_required', 'internal_error',
]

const args = (properties, required = []) => ({
  additionalProperties: false,
  structuralDiagnostics: true,
  properties,
  required,
})

export const fixedOperationManifest = {
  id: 'workflow_fixed_ops',
  toolName: 'workflow_fixed_ops',
  name: 'Workflow Fixed Operations',
  description:
    'Invoke one PRE-REGISTERED fixed operation at its pinned version and contract hash. '
    + 'Operations and their inputs are fixed by the runtime; you can only select a registered '
    + 'operation and fill its declared input. The execution is bound to the trusted workflow '
    + 'execution context of the current Run (never model-supplied) and answers with a receipt '
    + 'of what the operation did — the receipt is NOT a workflow transition or business commit.',
  local: { resource: 'workflow_execution' },
  errors: errorCodes.map((code) => ({ code, description: code.replaceAll('_', ' ') })),
  operations: [
    {
      name: 'invoke',
      description:
        'Run one registered fixed operation. Pass operation_key + expected_version + expected_hash '
        + '(the 64-hex contract hash your workflow plan pinned) and the input object declared by '
        + 'that operation. Fails closed on unknown operation, version/hash drift, invalid input, '
        + 'or a missing trusted workflow execution context.',
      arguments: args({
        operation_key: string('Exact registered operation key, e.g. "test.echo_summary".'),
        expected_version: string('The exact version your plan pinned for this operation.'),
        expected_hash: string('The 64-hex contract hash your plan pinned for this operation version.'),
        input: {
          type: 'object',
          description: 'The operation input object, constrained by the registered operation schema.',
          additionalProperties: true,
        },
      }, ['operation_key', 'expected_version', 'expected_hash', 'input']),
      result: { type: 'json' },
      errors: errorCodes,
    },
  ],
}

export const fixedOperationManifests = [fixedOperationManifest]
