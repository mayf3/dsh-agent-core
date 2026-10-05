import { normalizeProgressCheckpoint } from '../../workflow-execution/src/progress.js'

function fail(code, detail) {
  return { ok: false, error: { code, detail } }
}

function mapCommitFailure(cause) {
  if (cause === 'stale_attempt') return 'stale_attempt'
  if (cause === 'reporter_mismatch') return 'reporter_mismatch'
  if (cause === 'session_mismatch') return 'session_mismatch'
  return 'internal_error'
}

/**
 * Mount the workflow_progress LOCAL provider over the SAME workflow-execution
 * ledger used by the engine. This surface records execution-resume metadata
 * only; it never mutates svc-workflow business state or wakes another node.
 */
export function mountWorkflowProgressRuntime({ ctx, ledger, log = { log() {} } }) {
  if (ctx === undefined || typeof ctx.provide !== 'function') {
    throw new TypeError('workflow-progress-runtime: ctx with provide() is required')
  }
  if (ledger === undefined || typeof ledger.recordProgressCheckpoint !== 'function') {
    throw new TypeError('workflow-progress-runtime: workflow execution ledger is required')
  }
  const workflowContext = ctx.get('workflowExecutionContextAccess')
  if (workflowContext?.resolveWorkflowExecutionContext === undefined) {
    throw new TypeError('workflow-progress-runtime: workflowExecutionContextAccess service missing')
  }

  function trusted(trustedContext) {
    return workflowContext.resolveWorkflowExecutionContext(trustedContext)
  }
  async function checkpoint(args, trustedContext) {
    const resolved = trusted(trustedContext)
    if (resolved === undefined) {
      return fail('missing_workflow_context', 'current turn is not a trusted Workflow execution turn')
    }

    let normalized
    try {
      normalized = normalizeProgressCheckpoint(args ?? {})
    } catch (error) {
      return fail('invalid_arguments', String(error?.message ?? error))
    }

    const reporterAgentId = resolved.agentId ?? trustedContext?.agentId
    try {
      const outcome = await ledger.recordProgressCheckpoint({
        nodeVisitId: resolved.workflow.nodeVisitId,
        attemptId: resolved.workflow.attemptId,
        reporterAgentId,
        sessionId: resolved.sessionId,
        turnExecutionId: resolved.turnExecutionId,
        checkpoint: normalized,
      })
      if (outcome.committed !== true) {
        return fail(mapCommitFailure(outcome.cause), outcome.cause)
      }
      return {
        ok: true,
        result: {
          recorded: true,
          attemptId: resolved.workflow.attemptId,
          checkpoint: outcome.attempt.latestProgressCheckpoint,
        },
      }
    } catch (error) {
      const message = String(error?.message ?? error)
      if (error instanceof TypeError) return fail('invalid_arguments', message)
      if (message.includes('attempt is terminal')
        || message.includes('active delivered Run')
        || message.includes('no attempt exists')) {
        return fail('stale_attempt', message)
      }
      return fail('internal_error', message)
    }
  }
  async function readCurrent(_args, trustedContext) {
    const resolved = trusted(trustedContext)
    if (resolved === undefined) {
      return fail('missing_workflow_context', 'current turn is not a trusted Workflow execution turn')
    }

    const attempts = await ledger.snapshotFresh()
    const attempt = attempts.find((candidate) => candidate.nodeVisitId === resolved.workflow.nodeVisitId)
    if (attempt === undefined || attempt.attemptId !== resolved.workflow.attemptId) {
      return fail('stale_attempt', 'trusted Workflow attempt is no longer the current ledger generation')
    }
    if (attempt.delivered?.agentId !== (resolved.agentId ?? trustedContext?.agentId)) {
      return fail('reporter_mismatch', 'trusted caller does not own the delivered Run')
    }
    if (resolved.sessionId !== undefined && attempt.delivered?.sessionId !== resolved.sessionId) {
      return fail('session_mismatch', 'trusted Session no longer matches the delivered Run')
    }

    return {
      ok: true,
      result: {
        attemptId: attempt.attemptId,
        checkpoint: attempt.latestProgressCheckpoint ?? null,
      },
    }
  }
  const handlers = {
    workflow_progress: {
      checkpoint,
      read_current: readCurrent,
    },
  }

  const access = Object.freeze({ handlers })
  ctx.provide('workflowProgressAccess', access)
  log.log('workflow-progress surface mounted (execution-resume metadata only)')
  return access
}
