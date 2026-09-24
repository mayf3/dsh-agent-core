/**
 * AGENT_CORE_EXECUTION_HISTORY_QUERY_V1 — the read-only execution-history
 * LOCAL capability manifests (accepted, implementation_authority: contracts).
 *
 * Two tools, ONE query core (Spec §4.2): the gateway's `requiredScopes` check
 * is an all-or-nothing token request with no per-operation scopes and no way
 * for a handler to probe "does the caller additionally hold X", so the
 * self/audit split is expressed as two manifests:
 *   - execution_trace_query       (execution.history.read)  — self domain
 *   - execution_history_audit_query (execution.history.audit) — global domain
 * Content projection is REDACTED for non-owned sessions under BOTH tools
 * (audit ≠ decryption right, Spec §4.3); ownership checks live in the trusted
 * handler, never in model arguments. Caller identity is gateway-derived.
 *
 * Conditional per-root required fields cannot be expressed by the mapping
 * validator — the trusted handler is the authority (ASM V2 precedent); the
 * schema below is the model-facing hint plus defense-in-depth.
 */

export const EXECUTION_TRACE_QUERY_CAPABILITY_ID = 'execution_trace_query'
export const EXECUTION_HISTORY_AUDIT_QUERY_CAPABILITY_ID = 'execution_history_audit_query'
export const AGENT_SESSION_LIST_CAPABILITY_ID = 'agent_session_list'

const baseErrors = [
  { code: 'invalid_arguments', description: 'Arguments violate the root contract (unknown root, missing root key, bad UUID/agentId, or a msg_sh1_* display id where a native messageId is required).' },
  { code: 'id_namespace_mismatch', description: 'A mobile display id (msg_sh1_*) was passed where the native messageId is required; display ids are content hashes and cannot be resolved back.' },
  { code: 'forbidden_not_owner', description: 'The queried record is not owned by the caller (self scope).' },
  { code: 'workflow_instance_not_found', description: 'Workflow instance not found or not visible to the caller (svc visibility decides).' },
  { code: 'session_not_found', description: 'No resolvable session journal for this agentId/sessionId.' },
  { code: 'scheduler_record_not_found', description: 'No scheduler job/occurrence/run matches the given coordinates.' },
  { code: 'message_not_found', description: 'No record matches the given message coordinate.' },
  { code: 'downstream_unavailable', description: 'svc-workflow is unreachable; the trace degrades to local sources with explicit gaps.' },
  { code: 'history_unavailable', description: 'Every history source is absent or degraded.' },
  { code: 'credential_unavailable', description: 'No trusted caller credential is bound.' },
  { code: 'credential_invalid', description: 'The trusted caller credential was rejected by the auth-service.' },
  { code: 'access_denied', description: 'The caller lacks the required execution-history grant.' },
  { code: 'transport_failure', description: 'The auth-service/broker transport failed during the local grant check, before any handler ran.' },
  { code: 'unsupported_operation', description: 'The execute-time local handler is not resolvable (missing or miswired provider).' },
  { code: 'internal_error', description: 'The trusted handler failed.' },
]

const properties = {
  root: { type: 'string', enum: ['workflow_instance', 'agent_session', 'scheduler_run', 'message'], description: 'Query root; exactly one root key below is required, matching the root.' },
  workflowInstanceId: { type: 'string', description: 'workflow_instance root: instance id (UUID).' },
  agentId: { type: 'string', description: 'agent_session root: owning Agent canonical id (agt_*); self scope requires the caller itself.' },
  sessionId: { type: 'string', description: 'agent_session root: native session id (e.g. main, cron-run-occ:...).' },
  jobId: { type: 'string', description: 'scheduler_run root: Scheduler job id.' },
  occurrenceId: { type: 'string', description: 'scheduler_run root: occurrence id (occ:...).' },
  runId: { type: 'string', description: 'scheduler_run root: run id (run:occ:...).' },
  messageId: { type: 'string', description: 'message root: NATIVE messageId (from a send receipt / inbox spliced event / audit row). msg_sh1_* display ids are rejected.' },
  reconciliationHandle: { type: 'string', description: 'message root: Router turn reconciliation handle (turnExecutionId).' },
  requestId: { type: 'string', description: 'message root: ASM send requestId.' },
  cursor: { type: 'string', description: 'Opaque vector cursor from a previous page (nextCursor).' },
  limit: { type: 'integer', minimum: 1, maximum: 500, description: 'Timeline page size (default 200).' },
  view: { type: 'string', enum: ['structured', 'report'], description: 'structured (default, machine-readable) or report (human-readable text + structured).' },
  audience: { type: 'string', enum: ['owner', 'agent'], description: 'Report view audience hint.' },
}

const queryOperation = (description) => ({
  name: 'query',
  description,
  arguments: {
    additionalProperties: false,
    properties,
    required: ['root'],
  },
  result: { type: 'json' },
  errors: ['invalid_arguments'],
})

export const executionTraceQueryManifest = {
  id: EXECUTION_TRACE_QUERY_CAPABILITY_ID,
  toolName: 'execution_trace_query',
  selector: 'operation',
  name: 'Execution Trace Query',
  description:
    'Read-only execution-history trace over the calling Agent\'s own records: given a workflow instance, one of your sessions, a scheduler job/occurrence/run, or a native message coordinate, assemble the full execution chain (admission → dispatch → send → turn/tool calls → workflow command) with per-source read boundaries, correlation rules, five-dimension verdicts and explicit gaps. Self scope: you may query your own sessions/jobs and workflow instances svc-visible to you; other Agents\' session content is never readable here.',
  local: { resource: 'execution-history' },
  renderErrorDetail: true,
  requiredScopes: ['execution.history.read'],
  errors: baseErrors,
  operations: [queryOperation(
    'Assemble one execution trace from the caller-owned records (workflow_instance | agent_session | scheduler_run | message root).',
  )],
}

export const executionHistoryAuditQueryManifest = {
  id: EXECUTION_HISTORY_AUDIT_QUERY_CAPABILITY_ID,
  toolName: 'execution_history_audit_query',
  selector: 'operation',
  name: 'Execution History Audit Query',
  description:
    'Read-only execution-history trace across ALL Agents and scheduler jobs (audit scope). The four roots and the result shape are identical to execution_trace_query; the widened reach is WHICH records are queryable, never WHAT content is visible — sessions not owned by the caller are still reduced to coordinates (messageId/seq/tool names/business coordinates); message text stays redacted.',
  local: { resource: 'execution-history' },
  renderErrorDetail: true,
  requiredScopes: ['execution.history.audit'],
  errors: baseErrors,
  operations: [queryOperation(
    'Assemble one execution trace across Agents (workflow_instance | agent_session | scheduler_run | message root).',
  )],
}

export const agentSessionListManifest = {
  id: AGENT_SESSION_LIST_CAPABILITY_ID,
  toolName: 'agent_session_list',
  selector: 'operation',
  name: 'Agent Session List',
  description:
    'List YOUR OWN sessions (MY_SESSIONS) as a coordinate-only view: sessionId, kind (main | scheduler | other), createdAt, lastActiveAt, origin presence (user / inter_agent / workflow_execution), and the scheduler/workflow coordinates each session touches. Sessions are keyed by (agentId, sessionId); you only ever see your own. No message content, tool bodies, or private text is included — coordinates and presence flags only. Use a returned sessionId with execution_trace_query root=agent_session to read the full trace of that session.',
  // SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1 CTR-SCT-002/D-SCT-2: zero-Auth
  // self surface (scheduler self-service precedent). Ownership comes from the
  // trusted gateway identity — the tool takes NO identity argument, so there
  // is no cross-agent enumeration face at all. requiredScopes is OMITTED
  // (agent-directory precedent): the schema treats omitted as [] and the
  // gateway performs zero token requests.
  local: true,
  errors: [
    { code: 'invalid_arguments', description: 'Arguments violate the operation schema (list takes only cursor/limit pagination).' },
    { code: 'forbidden_not_owner', description: 'Trusted caller identity unavailable (fail closed).' },
    { code: 'credential_unavailable', description: 'No MachineClient credential is bound to the calling agent (the gateway loads it before any local capability except self_ops); never mislabeled as a bad-argument failure.' },
    { code: 'history_unavailable', description: 'The session homes root is not readable.' },
    { code: 'unsupported_operation', description: 'The execute-time local handler is not resolvable (missing or miswired provider).' },
    { code: 'internal_error', description: 'The trusted handler failed.' },
  ],
  operations: [
    {
      name: 'list',
      description: 'List the calling Agent\'s own sessions, newest-first (keyset cursor for the next page).',
      arguments: {
        additionalProperties: false,
        properties: {
          cursor: { type: 'string', description: 'Opaque keyset cursor from a previous page (nextCursor).' },
          limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Page size (default/max 200).' },
        },
        required: [],
      },
      result: { type: 'json' },
      errors: ['invalid_arguments', 'forbidden_not_owner', 'credential_unavailable', 'history_unavailable', 'internal_error'],
    },
  ],
}

export const manifests = [executionTraceQueryManifest, executionHistoryAuditQueryManifest, agentSessionListManifest]
