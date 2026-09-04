/**
 * AGENT_CORE_AGENT_SESSION_MESSAGING_V1 — the agent_session_send LOCAL
 * capability manifest (accepted r3, implementation_authority: contracts).
 *
 * One capability, one write operation (`send`). The manifest is deliberately
 * pure data: R2's authoritative input contract (UTF-8 byte bounds, NUL
 * rejection, exact three-field closure) is enforced by the TRUSTED handler in
 * the control plane (packages/production-runtime) — the broker structural
 * validator cannot express byte-length or NUL rules (mapping.js supports
 * minLength/nonBlank only), so everything declared here is the model-facing
 * schema hint plus defense-in-depth, never the authority.
 *
 * The error table is the CLOSED §5 taxonomy of the accepted Spec. It must
 * declare `transport_failure` / `unsupported_operation`: both are permanent
 * emissions of the broker's own grant/handler pipeline (gateway.js), and an
 * undeclared code would fail closed to invalid_arguments, mislabeling a
 * grant-check outage or a wiring gap as a model input fault.
 *
 * Identity: `local.resource = 'agent-session-messaging'` is the nominal token
 * resource for the gateway's Auth grant check (`agent.session.send`). The
 * model-visible argument schema physically excludes sessionKey, sessionId,
 * sourceAgentId, principalId, requestId, provenance, channel, and every other
 * R2-forbidden field — source identity and correlation are runtime-owned
 * (R3) and never read from tool arguments.
 */

const agentId = (description) => ({
  type: 'string',
  minLength: 5,
  description,
})

const properties = {
  targetAgentId: agentId('Target Agent canonical id (agt_*). Routing target only — never the caller identity.'),
  message: { type: 'string', minLength: 1, nonBlank: true, description: 'Private message text delivered into the target Agent canonical main Session (1..65536 UTF-8 bytes; NUL forbidden).' },
  timeoutSeconds: { type: 'integer', minimum: 0, maximum: 300, description: '0 = return after the real inbox receipt; 1..300 = additionally wait up to N seconds for this exact Run\'s one aggregated final reply. No default.' },
}

const errorTable = [
  { code: 'invalid_arguments', description: 'Arguments violate the exact three-field input contract (R2).' },
  { code: 'credential_unavailable', description: 'No trusted caller credential is bound.' },
  { code: 'credential_invalid', description: 'The trusted caller credential was rejected by the auth-service.' },
  { code: 'access_denied', description: 'The caller lacks the agent.session.send grant.' },
  { code: 'target_not_found', description: 'No enabled Agent resolves the targetAgentId.' },
  { code: 'target_disabled', description: 'The target Agent exists but is disabled (not routable).' },
  { code: 'self_send_not_supported', description: 'Sending to the calling Agent itself is not supported in V1.' },
  { code: 'not_admitted', description: 'The target admission was provably rejected before any prompt byte was written.' },
  { code: 'queue_capacity_exceeded', description: 'The target process bounded queue rejected the admission before any prompt byte.' },
  { code: 'outcome_unknown', description: 'The send or the target Run terminated without a proven outcome; nothing is retried or replayed.' },
  { code: 'target_run_failed', description: 'The exact target Run settled as failed; retained partial text is never returned as success.' },
  { code: 'reply_unavailable', description: 'The exact target Run completed without a retrievable complete reply (no_output / truncated / evicted / restart_lost / never_existed).' },
  { code: 'transport_failure', description: 'The auth-service/broker transport failed during the local grant check, before any handler ran.' },
  { code: 'unsupported_operation', description: 'The execute-time local handler is not resolvable (missing or miswired provider).' },
  { code: 'internal_error', description: 'The trusted handler or the audit append failed; Router delivery count is zero when raised before delivery.' },
]

/** Wire capability id (also the provider handlers key — see index.js F9). */
export const AGENT_SESSION_SEND_CAPABILITY_ID = 'agent_session_send'

export const agentSessionMessagingManifest = {
  id: AGENT_SESSION_SEND_CAPABILITY_ID,
  toolName: 'agent_session_send',
  selector: 'operation',
  name: 'Agent Session Messaging',
  description: 'Send one private message to another Agent\'s canonical main Session. Each send creates exactly one new Run/Turn in the target main — never a new Session. timeoutSeconds=0 returns after the real inbox receipt; timeoutSeconds>0 waits for at most that many seconds for this exact Run\'s one aggregated final assistant reply. Source identity and correlation are derived by the trusted runtime; no automatic replay, no automatic reply, no active-run steering, no external delivery.',
  local: { resource: 'agent-session-messaging' },
  requiredScopes: ['agent.session.send'],
  errors: errorTable,
  operations: [
    {
      name: 'send',
      description: 'Deliver one message into the target Agent canonical main Session (reuse existing main; establish it when absent).',
      arguments: {
        additionalProperties: false,
        properties,
        required: ['targetAgentId', 'message', 'timeoutSeconds'],
      },
      result: { type: 'json' },
      errors: errorTable.map((e) => e.code),
    },
  ],
}

export const manifests = [agentSessionMessagingManifest]
