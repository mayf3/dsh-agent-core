/**
 * FIXED_OPERATION_V1 candidate capability — broker manifest for the fixed-
 * operation registry (fixture operations only). LOCAL capability pattern:
 * pure-data manifest here, handlers injected by the composition
 * (`fixedOperationAccess`).
 *
 * Wire discipline: the model/workflow can pass ONLY { operation, version,
 * hash, args } — the pinned catalog entry plus its business arguments. The
 * closed envelope rejects every other top-level key; the nested `args` object
 * is validated by the registry against the pinned operation's schema. There
 * is no scriptPath/shell/code/env/path surface anywhere on the wire.
 */

import { defineOperation } from '../../../fixed-operation/src/registry.js'
import { FIXED_OPERATION_ERRORS } from '../../../fixed-operation/src/errors.js'
import { fixtureEcho, fixtureSum } from '../../../fixed-operation/src/fixtures.js'

/** Normalized definitions (hash included) — the exact registry surface the
 * local handler executes against. */
export const FIXED_OPERATION_DEFINITIONS = [fixtureEcho, fixtureSum].map(defineOperation)

const errorCodes = [
  'unsupported_operation', 'unknown_operation',
  'operation_version_mismatch', 'operation_hash_mismatch',
  'invalid_arguments', 'missing_trusted_context', 'internal_error',
]

export const fixedOperationManifest = {
  id: 'fixed_operation',
  toolName: 'fixed_operation',
  selector: 'operation',
  name: 'Fixed Operations',
  description:
    'Execute a registered fixed operation: pass its catalog operation key, the pinned version and '
    + 'definition hash, and its business arguments. Provenance comes from the trusted runtime, never '
    + 'from arguments. Registered operations: '
    + FIXED_OPERATION_DEFINITIONS.map((d) => `${d.key} @ ${d.version} (${d.hash})`).join(', '),
  local: { resource: 'fixed-operation' },
  errors: errorCodes.map((code) => ({ code, description: code.replaceAll('_', ' ') })),
  operations: [
    {
      name: 'execute',
      description: 'Execute one registered fixed operation by pinned key + version + hash.',
      arguments: {
        additionalProperties: false,
        structuralDiagnostics: true,
        properties: {
          operation: { type: 'string', minLength: 1, description: 'Registered fixed-operation key (e.g. "fixture.echo").' },
          version: { type: 'string', minLength: 1, description: 'The pinned operation version from the fixed-operation catalog.' },
          hash: { type: 'string', minLength: 1, description: 'The pinned definition hash (sha256:...) from the fixed-operation catalog.' },
          args: { type: 'object', description: 'Business arguments, validated by the registry against the pinned operation schema.' },
        },
        required: ['operation', 'version', 'hash', 'args'],
      },
      result: { type: 'json' },
      errors: errorCodes,
    },
  ],
}
