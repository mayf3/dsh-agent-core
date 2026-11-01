/**
 * @agent-core/execution-history/src/loaders/svc-facts.js — svc-workflow read
 * facade. The runtime provider injects `request(agentId, {method, path,
 * query})` (per-caller credential seam via transportFor-equivalent); this
 * module stays transport-free and pure. Detail/submissions reuse the same
 * endpoints as the existing broker read tools; timeline is the NEW internal
 * direct call (Spec §2/§6-G6) on the deployed contract (after=event_sequence).
 *
 * svc reachability is a degrade-not-fail surface: downstream_unavailable is
 * reported per-fact, the local-source trace continues.
 */

import { sourceReadRevision } from '../boundary.js'

/**
 * Fetch instance detail as the caller (svc visibility classes decide).
 * @returns {Promise<{ok: true, detail: object} | {ok: false, code: string, detail?: string}>}
 */
export async function fetchInstanceDetail(request, agentId, workflowInstanceId) {
  return request(agentId, { method: 'GET', path: `/internal/v1/workflow-instances/${encodeURIComponent(workflowInstanceId)}` })
}

/** Fetch one timeline page; returns {items, nextCursor} shape verbatim. */
export async function fetchTimelinePage(request, agentId, workflowInstanceId, { after, limit = 100 } = {}) {
  const query = {}
  if (after !== undefined && after !== null) query.after = String(after)
  if (limit !== undefined) query.limit = String(limit)
  return request(agentId, { method: 'GET', path: `/internal/v1/workflow-instances/${encodeURIComponent(workflowInstanceId)}/timeline`, query })
}

/** Fetch all timeline pages up to caps (svc cursor = last event_sequence). */
export async function fetchTimelineAll(request, agentId, workflowInstanceId, { maxEvents = 2000, pageSize = 100 } = {}) {
  const items = []
  let after
  let truncated = false
  let lastError = null
  let complete = false
  const pageRevisions = []
  for (let page = 0; page < Math.ceil(maxEvents / pageSize) + 1; page += 1) {
    const result = await fetchTimelinePage(request, agentId, workflowInstanceId, { after, limit: pageSize })
    pageRevisions.push(sourceReadRevision(result))
    if (!result.ok) { lastError = result; break }
    if (!Array.isArray(result.body?.items)) { truncated = true; break }
    const batch = result.body.items
    items.push(...batch)
    const camel = Object.hasOwn(result.body, 'nextCursor')
    const snake = Object.hasOwn(result.body, 'next_cursor')
    if ((!camel && !snake) || (camel && snake && result.body.nextCursor !== result.body.next_cursor)) {
      truncated = true
      break
    }
    const next = camel ? result.body.nextCursor : result.body.next_cursor
    let lastSequence = after ?? 0
    for (const row of batch) {
      const sequence = row?.event_sequence ?? row?.eventSequence
      if (row === null || typeof row !== 'object' || Array.isArray(row)
        || !Number.isSafeInteger(sequence) || sequence <= lastSequence) { truncated = true; break }
      lastSequence = sequence
    }
    if (items.length > maxEvents) { items.length = maxEvents; truncated = true }
    if (truncated) break
    if (next === null) { complete = true; break }
    if (!Number.isSafeInteger(next) || next < 1 || batch.length === 0
      || next !== lastSequence || (after !== undefined && next <= after)) { truncated = true; break }
    if (items.length >= maxEvents) { truncated = true; break }
    after = next
  }
  return { items, truncated: truncated || (!complete && lastError === null), error: lastError,
    revision: sourceReadRevision(pageRevisions) }
}

/** Fetch submission history (existing broker-read endpoint shape). */
export async function fetchSubmissions(request, agentId, workflowInstanceId, { limit = 50 } = {}) {
  return request(agentId, { method: 'GET', path: `/internal/v1/workflow-instances/${encodeURIComponent(workflowInstanceId)}/submissions`, query: { limit: String(limit) } })
}

/** Timeline events are already svc facts — normalize into SourceRecords. */
export function timelineToRecords(items) {
  return (Array.isArray(items) ? items : []).filter((e) => e && typeof e === 'object').map((event) => ({
    source: 'svc_timeline',
    kind: `svc_${event.eventType ?? event.event_type ?? 'event'}`,
    provenanceClass: 'PRIMARY_PERSISTED',
    nativeSeq: event.eventSequence ?? event.event_sequence,
    atMs: Date.parse(event.createdAt ?? event.created_at ?? '') || null,
    nativeRefs: {
      workflowInstanceId: event.workflowInstanceId ?? event.workflow_instance_id,
      commandId: event.commandId ?? event.command_id,
      submissionId: event.submissionId ?? event.submission_id,
      sourceNodeVisitId: event.sourceNodeVisitId ?? event.source_node_visit_id,
      targetNodeVisitId: event.targetNodeVisitId ?? event.target_node_visit_id,
    },
    dedupeKey: `svc:${event.eventSequence ?? event.event_sequence}`,
    data: event,
  }))
}

/** Convert a svc request failure into a gap entry (never a hard failure). */
export function svcFailureGap(result, stage) {
  return {
    code: 'SOURCE_DEGRADED',
    stage,
    reason: result?.code ?? 'downstream_unavailable',
    detail: result?.detail,
  }
}
