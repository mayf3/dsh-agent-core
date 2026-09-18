import { join } from 'node:path'
import { appendFileSync } from 'node:fs'

import { createAgentSessionMessagingAccess } from '../agent-session-messaging.js'
import { createAgentSessionMessagingAudit } from './audit.js'
import { inspectAgentSessionTurn } from './turn-inspection.js'

/** Minimal composition helper for the independently granted send/inspect pair. */
export function createAgentSessionRuntime({ layout, definition, workspaceBootstrap, router, log }) {
  const auditFile = join(layout.controlDir, 'agent-session-messaging-audit.jsonl')
  const audit = createAgentSessionMessagingAudit({
    auditFile,
    // WPA-1 (AGENT_CORE_EXECUTION_HISTORY_QUERY_V1 §6): an archive failure is
    // a retention loss, not a send failure — report it in the runtime evidence
    // log and keep the send path untouched.
    onArchiveFailure: ({ reason, detail }) => {
      try {
        appendFileSync(layout.evidenceLog, `${JSON.stringify({ kind: reason, source: 'agent-session-messaging-audit-archive', detail, ts: Date.now() })}\n`)
      } catch { /* evidence is best-effort */ }
      log.error(`[agent-session-messaging] audit archive failed: ${detail}`)
    },
  })
  return {
    auditDenial(info) {
      if (!['agent_session_send', 'agent_session_send_reconcile', 'agent_session_turn_inspect'].includes(info?.capabilityId)) return
      if (audit.appendDenial(info) !== 'appended') log.error('[agent-session-messaging] L0 denial audit append failed')
    },
    mount(ctx) {
      ctx.provide('agentSessionMessagingAccess', createAgentSessionMessagingAccess({
        router,
        audit,
        inspectTurn: ({ args, callerAgentId }) => inspectAgentSessionTurn({
          args,
          callerAgentId,
          auditFile,
          resolveTarget: (agentId) => definition.getAgent(agentId),
          resolveDshHome: (agentId) => workspaceBootstrap.resolveDshHome(agentId),
          resolveCanonicalWorkspace: (agentId) => workspaceBootstrap.resolveWorkspace(agentId),
        }),
        onAuditFailure: ({ phase, requestId }) => {
          log.error(`[agent-session-messaging] audit ${phase} append failed after requestId ${requestId ?? '(not-minted)'}`)
        },
      }))
    },
  }
}
