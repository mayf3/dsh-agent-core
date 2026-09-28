import { defineOperation } from './registry.js'

/**
 * FIXED_OPERATION_V1 test fixtures — PURE operations with no shell, file
 * system, network, credential or production side effects. These exist only
 * to exercise the registry contract; none of them is registered in the
 * production broker manifests.
 */

/** Valid trusted workflow execution context for tests: exact provenance
 * shape minted by the workflow-execution engine (UUID coordinates + a
 * ledger-style wfeat-* attempt id). */
export const FIXTURE_TRUSTED_CONTEXT = Object.freeze({
  kind: 'workflow_execution',
  workflowInstanceId: 'a3f1c2d4-0000-4000-8000-000000000001',
  nodeVisitId: 'b7e2d3c4-0000-4000-8000-000000000002',
  attemptId: `wfeat-${'a'.repeat(24)}`,
})

export const fixtureEcho = {
  key: 'fixture.echo',
  version: '1.0.0',
  description: 'FIXED_OPERATION_V1 test fixture: echo a message back. Pure, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string', minLength: 1, nonBlank: true, description: 'Message to echo.' },
    },
    required: ['message'],
    additionalProperties: false,
  },
  handler: ({ message }) => ({ echo: message }),
}

export const fixtureSum = {
  key: 'fixture.sum',
  version: '1.0.0',
  description: 'FIXED_OPERATION_V1 test fixture: add two integers. Pure, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      a: { type: 'integer', description: 'First addend.' },
      b: { type: 'integer', description: 'Second addend.' },
    },
    required: ['a', 'b'],
    additionalProperties: false,
  },
  handler: ({ a, b }) => ({ sum: a + b }),
}

/**
 * Wrap a fixture definition so its handler records every call. Tests assert
 * `calls.length` to prove a handler was (or was never) reached.
 */
export function spyOnDefinition(definition) {
  const calls = []
  const spied = defineOperation({
    ...definition,
    handler: (args, context) => {
      calls.push({ args, context })
      return definition.handler(args, context)
    },
  })
  return { definition: spied, calls }
}
