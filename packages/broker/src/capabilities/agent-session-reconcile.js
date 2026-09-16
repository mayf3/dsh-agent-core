/**
 * Infrastructure-only reconciliation for one lost/unusable
 * agent_session_send parent-RPC response (ASM V2 CTR-ASM2-007/009).
 * The child relay invokes this over the trusted channel; it is never a model
 * tool and never delivers, reads a Session, or reconstructs reply text.
 */

const errors = [
  { code: 'invalid_arguments', description: 'The exact invocation-correlation lookup argument is invalid.' },
  { code: 'credential_unavailable', description: 'No trusted caller credential is bound.' },
  { code: 'credential_invalid', description: 'The trusted caller credential was rejected.' },
  { code: 'access_denied', description: 'The caller lacks agent.session.send.' },
  { code: 'transport_failure', description: 'The grant check transport failed.' },
  { code: 'unsupported_operation', description: 'The trusted lookup handler is unavailable.' },
  { code: 'internal_error', description: 'The bounded evidence lookup failed closed.' },
]

export const AGENT_SESSION_SEND_RECONCILE_CAPABILITY_ID = 'agent_session_send_reconcile'

export const agentSessionReconcileManifest = {
  id: AGENT_SESSION_SEND_RECONCILE_CAPABILITY_ID,
  toolName: AGENT_SESSION_SEND_RECONCILE_CAPABILITY_ID,
  selector: 'operation',
  name: 'Agent Session Send Reconcile',
  description: 'Trusted-channel-only read of one caller-owned send invocation outcome.',
  local: { resource: 'agent-session-messaging' },
  infrastructure: true,
  requiredScopes: ['agent.session.send'],
  errors,
  operations: [{
    name: 'lookup',
    description: 'Read the retained audit outcome for one invocation correlation.',
    arguments: {
      additionalProperties: false,
      properties: {
        invocationCorrelation: {
          type: 'string',
          minLength: 8,
          description: 'Opaque child-runtime invocation anchor.',
        },
      },
      required: ['invocationCorrelation'],
    },
    result: { type: 'json' },
    errors: errors.map((entry) => entry.code),
  }],
}

export const manifests = [agentSessionReconcileManifest]
