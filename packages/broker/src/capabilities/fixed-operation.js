/**
 * FIXED_OPERATION_V1 candidate capability — broker manifest for the fixed-
 * operation registry (fixture operations only). Follows the LOCAL capability
 * pattern (self_ops / agent_definition): pure-data manifest here, handlers
 * injected by the composition (`fixedOperationAccess`).
 *
 * Wire discipline: the model/workflow can pass ONLY the operation selector,
 * the pinned `version` + `hash` from the fixed-operation catalog, and the
 * operation's declared business arguments (closed schema). There is no
 * scriptPath/shell/code surface — argument schemas close with
 * `additionalProperties: false` and the runtime re-validates at the gateway.
 */

import { defineOperation } from '../../../fixed-operation/src/registry.js'
import { FIXED_OPERATION_ERRORS } from '../../../fixed-operation/src/errors.js'
import { fixtureEcho, fixtureSum } from '../../../fixed-operation/src/fixtures.js'

/** Normalized definitions (hash included) — the exact registry surface the
 * local handler executes against. */
export const FIXED_OPERATION_DEFINITIONS = [fixtureEcho, fixtureSum].map(defineOperation)

const WIRE_NAMES = { 'fixture.echo': 'fixture_echo', 'fixture.sum': 'fixture_sum' }

/** wire operation name -> canonical registry operationKey. */
export const FIXED_OPERATION_WIRE_KEYS = Object.fromEntries(
  FIXED_OPERATION_DEFINITIONS.map((definition) => [WIRE_NAMES[definition.key], definition.key]),
)

const errorCodes = [
  'unsupported_operation', 'unknown_operation',
  'operation_version_mismatch', 'operation_hash_mismatch',
  'invalid_arguments', 'missing_trusted_context', 'internal_error',
]

const string = (description) => ({ type: 'string', minLength: 1, description })

/** Every invocation pins the exact catalog entry it intends to call. */
const PIN_ARGS = {
  version: string('The pinned operation version from the fixed-operation catalog.'),
  hash: string('The pinned definition hash (sha256:...) from the fixed-operation catalog.'),
}

export const fixedOperationManifest = {
  id: 'fixed_operation',
  toolName: 'fixed_operation',
  selector: 'operation',
  name: 'Fixed Operations',
  description:
    'Invoke a registered fixed operation by pinning its exact catalog version and definition hash. '
    + 'Arguments are closed; provenance comes from the trusted runtime, never from arguments.',
  local: true,
  errors: errorCodes.map((code) => ({ code, description: code.replaceAll('_', ' ') })),
  operations: FIXED_OPERATION_DEFINITIONS.map((definition) => ({
    name: WIRE_NAMES[definition.key],
    description: `${definition.description} Pinned: version ${definition.version}, definition ${definition.hash}.`,
    arguments: {
      additionalProperties: false,
      structuralDiagnostics: true,
      properties: { ...PIN_ARGS, ...definition.inputSchema.properties },
      required: ['version', 'hash', ...(definition.inputSchema.required ?? [])],
    },
    result: { type: 'json' },
    errors: errorCodes,
  })),
}

export const fixedOperationManifests = [fixedOperationManifest]
