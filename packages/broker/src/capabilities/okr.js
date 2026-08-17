/**
 * @agent-core/broker — First-batch OKR capability manifests (V1, P1).
 *
 * Pure DATA (JSON-serializable) describing the deployed svc-okr capability a
 * DSH agent needs first. capabilityId / method / path / scope follow
 * the deployed OpenClaw capability registry and
 * were cross-checked against svc-okr route source
 * (svc-okr/src/routes/goals/core.ts: GET /api/goals/mine, authRequired):
 *
 *   okr_read   GET /api/goals/mine   okr.read
 *
 * OKR write (POST/PUT /api/goals, lifecycle — okr.write + okr_admin/okr_owner
 * roles) is deferred: no agent currently uses it through the broker (see
 * report DEFERRED CAPABILITIES).
 */

import { withTransportErrors } from '../transport.js'

export const okrReadManifest = withTransportErrors({
  id: 'okr_read',
  toolName: 'okr_read',
  name: 'OKR Read',
  description:
    'Agent Core capability `okr_read` (svc-okr): read the calling agent\'s own OKR goal cards. ' +
    'Returns {ok: true, result: <goals>} on success.',
  requiredScopes: ['okr.read'],
  errors: [
    { code: 'invalid_arguments', description: 'Arguments did not satisfy the operation schema.' },
    { code: 'unsupported_operation', description: 'The requested operation is not supported by this capability.' },
  ],
  operations: [
    {
      name: 'read',
      description: 'Read my OKR goals.',
      arguments: { properties: {}, required: [] },
      result: { type: 'json' },
      errors: ['invalid_arguments'],
      http: { target: 'svc-okr', method: 'GET', path: '/api/goals/mine' },
    },
  ],
})

/** All first-batch OKR manifests. */
export const manifests = [okrReadManifest]
