/** #720 read adapter: existing caller GETs only, no writes or execution calls. */
import { projectBusinessResult } from '../../workflow-execution/src/business-result.js'
import { projectNodeAttemptHistory } from './workflow-node-history.js'
import { sourceReadRevision as revision } from './boundary.js'

export async function buildWorkflowResult(ctx, workflowInstanceId, records, attempts, observations) {
  const detail = records.find((r) => r.source === 'svc_detail')?.data ?? null
  const input = {
    workflowInstanceId, detail,
    timeline: records.filter((r) => r.source === 'svc_timeline').map((r) => r.data),
    timelineComplete: ctx._sources.get('svc_timeline')?.status?.status === 'OK',
    submissions: records.find((r) => r.source === 'svc_submissions')?.data ?? null,
    execution: attempts.flatMap((attempt) => projectNodeAttemptHistory(attempt).map((entry) => ({
      nodeVisitId: attempt.nodeVisitId, attemptId: entry.attemptId, generation: entry.generation,
      executionState: entry.execution.state,
    }))), observations,
  }
  for (const source of ['svc_detail', 'svc_timeline', 'svc_submissions']) {
    const loaded = ctx._sources.get(source)
    if (loaded && loaded.revision === undefined) {
      loaded.revision = revision({ status: loaded.status, data: records.filter((r) => r.source === source).map((r) => r.data) })
    }
  }
  const preliminary = projectBusinessResult(input)
  const instance = detail?.detail?.instance
  if (preliminary.businessOutcome.state === 'FORWARD' && ctx.svcRequest !== null
    && typeof instance?.definition_version_id === 'string' && typeof instance?.domain_id === 'string') {
    const read = async (source, path) => {
      const result = await ctx.svcRequest(ctx.viewer.agentId, { method: 'GET', path })
      observations.push({ source, observedAtMs: Date.now() })
      ctx._sources.set(source, { status: { status: result.ok ? 'OK' : 'ABSENT',
        ...(result.ok ? {} : { reason: result.code }) }, files: [], rowsRead: result.ok ? 1 : 0, revision: revision(result) })
      return result
    }
    const versionId = encodeURIComponent(instance.definition_version_id)
    const identity = await read('svc_definition_identity', `/internal/v1/definition-versions/${versionId}/input-contract`)
    if (identity.ok && identity.body?.definitionVersionId === instance.definition_version_id
      && typeof identity.body?.definitionId === 'string') {
      const graph = await read('svc_definition_version', `/internal/v1/domains/${encodeURIComponent(instance.domain_id)}/definitions/${encodeURIComponent(identity.body.definitionId)}/versions/${versionId}`)
      if (graph.ok && graph.body?.definition?.id === identity.body.definitionId) input.definition = graph.body
    }
  }
  return projectBusinessResult(input)
}
