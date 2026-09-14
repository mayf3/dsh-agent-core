import { join } from 'node:path'

import { createAgentSessionMessagingAccess } from '../agent-session-messaging.js'
import { createAgentSessionMessagingAudit } from './audit.js'
import { inspectAgentSessionTurn } from './turn-inspection.js'

/** Minimal composition helper for the independently granted send/inspect pair. */
export function createAgentSessionRuntime({ layout, definition, workspaceBootstrap, router, log }) {
  const auditFile = join(layout.controlDir, 'agent-session-messaging-audit.jsonl')
  const audit = createAgentSessionMessagingAudit({ auditFile })
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
