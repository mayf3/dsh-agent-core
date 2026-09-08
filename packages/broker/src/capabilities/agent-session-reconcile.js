/**
 * AGENT_CORE_AGENT_SESSION_MESSAGING_V1 §5.3 (AMENDMENT_1, accepted r4) — the
 * agent_session_send_reconcile LOCAL capability manifest: the READ-ONLY
 * discovery surface the child relay uses to reconcile a lost/unusable
 * agent_session_send parent response.
 *
 * `infrastructure: true`: this capability is NEVER presented as a model tool —
 * the broker child apply filters infrastructure manifests out of the model
 * tool inventory while the gateway keeps validating/executing them over the
 * trusted RPC channel (the anchor lookup is relay infrastructure, not a
 * model-facing primitive).
 *
 * Trust contract (§5.3): the lookup is bound to the GATEWAY-DERIVED caller —
 * `sourceAgentId` comes from the trusted execute context, never from
 * arguments. `invocationCorrelation` is an opaque child-minted anchor that
 * only CORRELATES the caller's own L1 rows; it confers no identity. The
 * invocation issue timestamp rides the trusted boundary too (like rpcMeta),
 * which keeps the model-visible args to EXACTLY one field per the amendment.
 *
 * Read-only: zero Router delivery, zero Session mutation, bounded exact-key
 * scan over the L1 evidence files (live + one-deep rotation).
 */

const agentId = (description) => ({
  type: 'string',
  minLength: 5,
  description,
})

const errorTable = [
  { code: 'invalid_arguments', description: 'Arguments violate the exact one-field input contract (§5.3).' },
  { code: 'credential_unavailable', description: 'No trusted caller credential is bound.' },
  { code: 'credential_invalid', description: 'The trusted caller credential was rejected by the auth-service.' },
  { code: 'access_denied', description: 'The caller lacks the agent.session.send grant.' },
  { code: 'transport_failure', description: 'The auth-service/broker transport failed during the local grant check, before any handler ran.' },
  { code: 'unsupported_operation', description: 'The execute-time local handler is not resolvable (missing or miswired provider).' },
  { code: 'internal_error', description: 'The trusted handler or the evidence read failed; no state was mutated.' },
]

export const AGENT_SESSION_SEND_RECONCILE_CAPABILITY_ID = 'agent_session_send_reconcile'

export const agentSessionReconcileManifest = {
  id: AGENT_SESSION_SEND_RECONCILE_CAPABILITY_ID,
  toolName: 'agent_session_send_reconcile',
  selector: 'operation',
  name: 'Agent Session Send Reconcile',
  description: 'Infrastructure-only read-only lookup of one agent_session_send invocation outcome by its runtime correlation anchor. Never exposed as a model tool.',
  local: { resource: 'agent-session-messaging-reconcile' },
  infrastructure: true,
  requiredScopes: ['agent.session.send'],
  errors: errorTable,
  operations: [
    {
      name: 'lookup',
      description: 'Look up the L1 evidence rows of ONE agent_session_send invocation by correlation anchor (gateway-caller-bound).',
      arguments: {
        additionalProperties: false,
        properties: {
          invocationCorrelation: {
            type: 'string',
            minLength: 8,
            description: 'Opaque child-minted anchor minted for EXACTLY ONE agent_session_send RPC invocation (trusted-channel field; correlates the caller\'s own L1 rows). Length bound (<=128) is enforced by the trusted handler (mapping.js has no maxLength).',
          },
        },
        required: ['invocationCorrelation'],
      },
      result: { type: 'json' },
      errors: errorTable.map((e) => e.code),
    },
  ],
}

export const manifests = [agentSessionReconcileManifest]
