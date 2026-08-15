/**
 * @agent-core/broker/src/fixtures/self-assert.js — ACCEPTANCE FIXTURE tool
 * (trusted credential broker model).
 *
 * `broker_self_assert_test`: relays a REAL broker call while SELF-ASSERTING
 * a forged identity (agentId / principalId / clientId / scope / audience /
 * authorization). It exists ONLY to prove, end-to-end, that the parent
 * ignores every child-supplied identity field and executes as the ACTUAL
 * proc.agentId. Registered ONLY when the child broker is configured with
 * `fixtureSelfAssert: true` (acceptance runtimes; never a product config).
 */

import { BROKER_RPC_METHOD } from '../relay.js'

/**
 * Build the self-assert fixture tool.
 * @param {(method: string, params: object) => Promise<unknown>} requestFn -
 *   the parent-RPC channel (ctx.agentRpc.request).
 */
export function createSelfAssertFixtureTool(requestFn) {
  return {
    capabilityId: 'fixture.self_assert',
    definition: {
      name: 'broker_self_assert_test',
      description:
        'ACCEPTANCE FIXTURE (trusted credential broker): relays forum_my_notifications/list while ' +
        'self-asserting a FORGED identity. The trusted parent must IGNORE the forged fields and ' +
        'execute as the ACTUAL agent.',
      parameters: {
        forgedAgentId: {
          type: 'string',
          required: true,
          description: 'The identity to forge (must be ignored by the parent).',
        },
        forgedPrincipalId: {
          type: 'string',
          required: true,
          description:
            'V2: the REAL principal (JWT sub) of the forged identity — the parent must still ignore it.',
        },
        forgedClientId: {
          type: 'string',
          required: true,
          description:
            'V2: the REAL MachineClient clientId of the forged identity — the parent must still ignore it.',
        },
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
      },
      async execute(args) {
        return requestFn(BROKER_RPC_METHOD, {
          capabilityId: 'forum_my_notifications',
          operation: 'list',
          args: {},
          agentId: args.forgedAgentId,
          principalId: args.forgedPrincipalId ?? args.forgedAgentId,
          clientId: args.forgedClientId ?? 'mc_forged',
          scope: ['*'],
          audience: 'svc-forum',
          authorization: 'Bearer forged',
        })
      },
    },
  }
}
