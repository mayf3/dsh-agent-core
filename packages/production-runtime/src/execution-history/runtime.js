/**
 * @agent-core/production-runtime/src/execution-history/runtime.js — the
 * control-plane provider for AGENT_CORE_EXECUTION_HISTORY_QUERY_V1: wires the
 * read-only query core (packages/execution-history) into the broker gateway
 * as the `executionHistoryAccess` LOCAL capability provider, plus a
 * per-caller svc read transport (same credential seam and target pinning as
 * the generic broker transport — identity travels only in the credential).
 */

import { join } from 'node:path'

import {
  createHttpTransport,
} from '../../../broker/src/transport.js'
import { targets as defaultTargets } from '../../../broker/src/targets.js'
import { loadCredentialFor } from '../../../broker/src/credential-store.js'
import {
  EXECUTION_TRACE_QUERY_CAPABILITY_ID,
  EXECUTION_HISTORY_AUDIT_QUERY_CAPABILITY_ID,
  AGENT_SESSION_LIST_CAPABILITY_ID,
} from '../../../broker/src/capabilities/execution-history.js'
import { listAgentSessions, queryExecutionTrace } from '../../../execution-history/src/index.js'

/**
 * Synthetic single-op manifests let the generic authorized transport execute
 * the internal svc timeline/detail/submissions reads with the SAME
 * resource/scope/token machinery as every other broker capability
 * (transport.js derives the token scope from manifest.requiredScopes).
 */
function internalSvcManifest(method, path, queryKeys) {
  return {
    id: 'execution_history_internal_svc_read',
    requiredScopes: ['workflow.read'],
    operations: [{
      name: 'call',
      http: { target: 'svc-workflow', method, path, query: queryKeys },
    }],
  }
}

const ERROR_CODE_MAP = {
  invalid_arguments: 'invalid_arguments',
  binding_error: 'internal_error',
  credential_unavailable: 'credential_unavailable',
  access_denied: 'downstream_unavailable',
  transport_failure: 'downstream_unavailable',
  downstream_error: 'downstream_unavailable',
  malformed_response: 'downstream_unavailable',
  unsupported_operation: 'internal_error',
}

/** The closed manifest error table (capabilities/execution-history.js). */
const KNOWN_ERROR_CODES = new Set([
  'invalid_arguments', 'id_namespace_mismatch', 'forbidden_not_owner',
  'workflow_instance_not_found', 'session_not_found', 'scheduler_record_not_found',
  'message_not_found', 'downstream_unavailable', 'history_unavailable',
])

export function createExecutionHistoryRuntime({ layout, credentialsFile, authServiceOrigin, log }) {
  const transports = new Map()

  function svcTransport(agentId) {
    let transport = transports.get(agentId)
    if (transport === undefined) {
      transport = createHttpTransport({
        credentialProvider: { getCredential: async () => loadCredentialFor(credentialsFile, agentId) },
        targets: defaultTargets,
        authServiceOrigin,
      })
      transports.set(agentId, transport)
    }
    return transport
  }

  /** Per-caller svc read; failures degrade to {ok:false, code} — never throw. */
  async function svcRequest(agentId, { method, path, query }) {
    const queryKeys = Object.keys(query ?? {})
    const manifest = internalSvcManifest(method, path, queryKeys)
    try {
      const result = await svcTransport(agentId).execute({ manifest, operation: 'call', args: query ?? {} })
      if (result !== null && typeof result === 'object' && result.errorCode !== undefined) {
        return { ok: false, code: ERROR_CODE_MAP[result.errorCode] ?? 'downstream_unavailable', detail: result.detail }
      }
      return { ok: true, body: result }
    } catch (error) {
      log.error?.(`[execution-history] svc read failed for ${agentId}: ${error?.message ?? error}`)
      return { ok: false, code: 'downstream_unavailable', detail: String(error?.message ?? error) }
    }
  }

  function handleFor(audit) {
    return async function handle(args, trustedContext) {
      const viewer = { agentId: trustedContext.agentId, audit }
      const outcome = await queryExecutionTrace({
        root: args?.root,
        args,
        viewer,
        paths: {
          homesRoot: layout.homesRoot,
          controlDir: layout.controlDir,
          historyDir: layout.historyDir,
          jobsStore: layout.jobsStore,
          workflowExecutionDir: layout.workflowExecutionDir,
          evidenceLog: layout.evidenceLog,
          turnRecoveryStore: layout.turnRecoveryStore,
        },
        svcRequest,
        cursor: typeof args?.cursor === 'string' ? args.cursor : undefined,
        limit: Number.isInteger(args?.limit) ? args.limit : 200,
        view: args?.view === 'report' ? 'report' : 'structured',
      })
      if (outcome.ok !== true) {
        // The manifest error table is CLOSED (broker error preservation
        // rules): an unmapped code (e.g. an unexpected library error code)
        // must never surface as an undeclared string — map it to
        // internal_error.
        const code = KNOWN_ERROR_CODES.has(outcome.code) ? outcome.code : 'internal_error'
        return { ok: false, error: { code, detail: outcome.detail } }
      }
      return { ok: true, result: outcome.result }
    }
  }

  /** CTR-SCT-002: MY_SESSIONS — self-only, coordinate-only derived listing. */
  function listHandle() {
    return async function handle(args, trustedContext) {
      // F1: the trusted LOCAL handler is the authoritative validation
      // boundary (direct parent-RPC calls bypass manifest validation).
      // Invalid pagination input FAILS CLOSED with invalid_arguments — it is
      // never clamped, coerced, or silently dropped.
      if (args !== undefined && args !== null && (typeof args !== 'object' || Array.isArray(args))) {
        return { ok: false, error: { code: 'invalid_arguments', detail: 'arguments must be an object' } }
      }
      const keys = Object.keys(args ?? {})
      if (keys.some((k) => k !== 'cursor' && k !== 'limit')) {
        return { ok: false, error: { code: 'invalid_arguments', detail: 'unknown argument; only cursor and limit are admitted' } }
      }
      const rawCursor = args?.cursor
      if (rawCursor !== undefined && rawCursor !== null && typeof rawCursor !== 'string') {
        return { ok: false, error: { code: 'invalid_arguments', detail: 'cursor must be a string' } }
      }
      const rawLimit = args?.limit
      if (rawLimit !== undefined && (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 200)) {
        return { ok: false, error: { code: 'invalid_arguments', detail: 'limit must be an integer in 1..200' } }
      }
      const outcome = listAgentSessions({
        homesRoot: layout.homesRoot,
        indexDir: join(layout.controlDir, 'execution-history-index'),
        viewerAgentId: trustedContext.agentId,
        cursor: typeof rawCursor === 'string' ? rawCursor : undefined,
        limit: rawLimit === undefined ? undefined : rawLimit,
      })
      if (outcome.ok !== true) {
        const code = KNOWN_ERROR_CODES.has(outcome.code) ? outcome.code : 'internal_error'
        return { ok: false, error: { code, detail: outcome.detail } }
      }
      return { ok: true, result: outcome.result }
    }
  }

  return {
    mount(ctx) {
      ctx.provide('executionHistoryAccess', {
        handlers: {
          [EXECUTION_TRACE_QUERY_CAPABILITY_ID]: { query: handleFor(false) },
          [EXECUTION_HISTORY_AUDIT_QUERY_CAPABILITY_ID]: { query: handleFor(true) },
          [AGENT_SESSION_LIST_CAPABILITY_ID]: { list: listHandle() },
        },
      })
    },
  }
}

/**
 * One-line composition entry (compose.js is a registered no-growth file):
 * builds the runtime from the broker env contract and mounts the provider.
 */
export function mountExecutionHistoryRuntime(ctx, { layout, broker, log }) {
  createExecutionHistoryRuntime({
    layout,
    credentialsFile: broker?.credentialsFile ?? process.env.AGENT_CORE_CREDENTIALS_FILE,
    authServiceOrigin: broker?.authServiceOrigin ?? process.env.BROKER_AUTH_ORIGIN,
    log,
  }).mount(ctx)
}
