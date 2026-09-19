/**
 * @agent-core/execution-history/src/index.js — public entry: one query core,
 * four roots (Spec §4.1). Domain failures return {ok:false, code, detail};
 * the broker provider maps them onto the manifest error table verbatim.
 * Authorization rules (§4.2) are enforced HERE; correlation itself never
 * carries authorization duties (R8) and no production path may consume this
 * module (§4.5, structure-test asserted).
 */

import { createQueryContext } from './correlate/context.js'
import { buildWorkflowRoot, briefWorkflow } from './correlate/workflow-root.js'
import { buildSessionRoot, briefSession } from './correlate/session-root.js'
import { buildSchedulerRoot } from './correlate/scheduler-root.js'
import { buildMessageRoot } from './correlate/message-root.js'
import { assembleResult, renderReportText } from './report.js'
import { jobRoutingAgent } from './loaders/scheduler-store.js'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const AGENT_ID_RE = /^agt_[A-Za-z0-9_-]+$/

const err = (code, detail) => ({ ok: false, code, detail })

/**
 * @param {object} opts
 * @param {'workflow_instance'|'agent_session'|'scheduler_run'|'message'} opts.root
 * @param {object} opts.args
 * @param {{agentId: string, audit: boolean}} opts.viewer - caller from the
 *   trusted gateway context (never from model args).
 * @param {object} opts.paths - {homesRoot, controlDir, historyDir, jobsStore, workflowExecutionDir, evidenceLog, turnRecoveryStore?}
 * @param {Function} [opts.svcRequest] - async (agentId, {method, path, query}) => {ok, body|code, detail}
 * @param {string} [opts.cursor] - vector cursor from a previous page.
 * @param {number} [opts.limit] - page size (default 200).
 * @param {number} [opts.nowMs]
 * @param {'structured'|'report'} [opts.view]
 */
export async function queryExecutionTrace(opts) {
  const args = { ...(opts.args ?? {}) }
  // Pagination/view may arrive as query arguments (manifest surface) or as
  // library options; the argument form wins, then the option form.
  const cursor = typeof opts.cursor === 'string' ? opts.cursor : (typeof args.cursor === 'string' ? args.cursor : undefined)
  const limit = Number.isInteger(opts.limit) ? opts.limit : (Number.isInteger(args.limit) ? args.limit : 200)
  const view = opts.view ?? (args.view === 'report' ? 'report' : 'structured')
  const { root, viewer, paths, svcRequest, nowMs = Date.now(), caps } = opts
  if (viewer?.agentId === undefined || typeof viewer.agentId !== 'string' || !AGENT_ID_RE.test(viewer.agentId)) {
    return err('forbidden_not_owner', 'trusted caller identity unavailable')
  }
  const audit = viewer.audit === true
  const normArgs = args
  const ctx = createQueryContext({ paths, caps, viewer, svcRequest })

  try {
    switch (root) {
      case 'workflow_instance': return await runWorkflow(ctx, normArgs, { root, viewer, audit, svcRequest, cursor, limit, nowMs, view })
      case 'agent_session': return await runSession(ctx, normArgs, { root, viewer, audit, cursor, limit, nowMs, view })
      case 'scheduler_run': return await runScheduler(ctx, normArgs, { root, viewer, audit, cursor, limit, nowMs, view })
      case 'message': return await runMessage(ctx, normArgs, { root, viewer, audit, cursor, limit, nowMs, view })
      default: return err('invalid_arguments', `unknown root ${String(root)}`)
    }
  } catch (error) {
    if (error?.code !== undefined) return err(error.code, error.message)
    throw error
  }
}

function finalize(ctx, result, meta) {
  if (result.notFound !== undefined) return err(result.notFound.code, result.notFound.detail)
  const { root, viewer, audit, cursor, limit, nowMs, view, brief, extraSources = [] } = meta
  const loadedSources = new Map()
  for (const name of ['scheduler_store', 'scheduler_history', 'attempts_ledger', 'asm_audit', 'runtime_evidence', ...extraSources]) {
    if (ctx._sources.has(name)) {
      const src = ctx._sources.get(name)
      loadedSources.set(name, { status: src.status, files: src.files ?? [], rows: src.rowsRead ?? 0 })
    }
  }
  for (const [key, journal] of ctx._journals) {
    if (journal === null) continue
    const name = `journal:${key}`
    loadedSources.set(name, {
      status: journal.raw.readFailed !== undefined
        ? { status: 'DEGRADED', reason: `journal unreadable: ${journal.raw.readFailed}`, truncated: true }
        : { status: 'OK', badLines: journal.raw.skipped, truncated: journal.raw.truncated },
      files: [{ file: journal.file, size: journal.raw.size, mtimeMs: journal.raw.mtimeMs ?? 0 }],
      rows: journal.raw.events.length,
    })
  }
  // §4.4 history_unavailable: zero records AND every consulted source
  // absent/degraded — the honest "we could see nothing at all" answer.
  const recordCount = result.records.length
  const consulted = [...loadedSources.values()]
  if (recordCount === 0 && consulted.length > 0 && consulted.every((s) => s.status?.status === 'ABSENT' || s.status?.status === 'DEGRADED')) {
    return err('history_unavailable', 'every consulted history source is absent or degraded')
  }
  const assembled = assembleResult({
    root, args: meta.args, build: result, loadedSources, viewer: { agentId: viewer.agentId, audit },
    nowMs, cursor, limit, brief,
  })
  if (view === 'report') {
    return { ok: true, result: { reportId: assembled.reportId, format: 'text/report', report: renderReportText(assembled), structured: assembled } }
  }
  return { ok: true, result: assembled }
}

async function runWorkflow(ctx, args, meta) {
  const workflowInstanceId = String(args.workflowInstanceId ?? '')
  if (!UUID_RE.test(workflowInstanceId)) return err('invalid_arguments', 'workflowInstanceId must be a UUID')
  const built = await buildWorkflowRoot(ctx, { workflowInstanceId })
  if (meta.audit !== true) {
    // svc visibility is the authority for self-scope workflow queries: when
    // the caller's own credential could not see the instance AND no svc facts
    // exist, there is nothing lawful to show.
    const svcDetailFailed = built.gaps.some((g) => g.stage === 'svc_instance_detail')
    const hasSvcFacts = built.records.some((r) => r.source === 'svc_detail' || r.source === 'svc_timeline' || r.source === 'svc_submissions')
    if (svcDetailFailed && !hasSvcFacts) {
      return err('workflow_instance_not_found', 'not found or not visible to the caller')
    }
  }
  return finalize(ctx, built, { ...meta, args, brief: briefWorkflow, extraSources: ['svc_detail', 'svc_timeline', 'svc_submissions'] })
}

async function runSession(ctx, args, meta) {
  const agentId = String(args.agentId ?? '')
  const sessionId = String(args.sessionId ?? '')
  if (!AGENT_ID_RE.test(agentId) || sessionId === '') return err('invalid_arguments', 'agentId (agt_*) and sessionId are required')
  if (meta.audit !== true && agentId !== meta.viewer.agentId) {
    return err('forbidden_not_owner', `session ${agentId}/${sessionId} is not owned by the caller`)
  }
  const built = await buildSessionRoot(ctx, { agentId, sessionId })
  return finalize(ctx, built, { ...meta, args, brief: briefSession })
}

async function runScheduler(ctx, args, meta) {
  const hasId = ['jobId', 'occurrenceId', 'runId'].some((k) => typeof args[k] === 'string' && args[k] !== '')
  if (!hasId) return err('invalid_arguments', 'one of jobId | occurrenceId | runId is required')
  const built = await buildSchedulerRoot(ctx, args)
  if (built.notFound !== undefined) return err(built.notFound.code, built.notFound.detail)
  // §4.4 ordering rules (404) come before ownership rules (403) —
  // an unknown coordinate must not answer as a forbidden one.
  const storeFacts = built.records.some((r) => r.source === 'scheduler_store' || r.source === 'scheduler_history')
  if (!storeFacts && built.records.length === 0) {
    return err('scheduler_record_not_found', 'no job/occurrence/run matches the given coordinates')
  }
  if (meta.audit !== true) {
    const owned = ownershipOfSchedulerResult(ctx, built, meta.viewer.agentId)
    if (owned === false) return err('forbidden_not_owner', 'scheduler records are not owned by the caller')
  }
  return finalize(ctx, built, { ...meta, args, brief: briefScheduler })
}

function ownershipOfSchedulerResult(ctx, built, viewerAgentId) {
  if (built.records.some((r) => r.source === 'scheduler_store' && r.kind === 'job_definition' && jobRoutingAgent(r.data) === viewerAgentId)) return true
  for (const entry of ctx._journals.values()) {
    if (entry !== null && entry.agentId === viewerAgentId) return true
  }
  const history = ctx.source('scheduler_history')
  return history.records.some((r) => r.kind === 'run_record' && built.records.includes(r) && r.data?.agent_id === viewerAgentId)
}

async function runMessage(ctx, args, meta) {
  const provided = ['messageId', 'reconciliationHandle', 'requestId'].filter((k) => typeof args[k] === 'string' && args[k] !== '')
  if (provided.length !== 1) return err('invalid_arguments', 'exactly one of messageId | reconciliationHandle | requestId is required')
  const key = provided[0]
  if (key === 'messageId') {
    if (String(args.messageId).startsWith('msg_sh1_')) {
      return err('id_namespace_mismatch', 'msg_sh1_* is the mobile display namespace (content-hash, non-reversible); provide the native messageId')
    }
  }
  const built = await buildMessageRoot(ctx, { [key]: args[key] })
  if (built.notFound === undefined && meta.audit !== true) {
    const allowed = ownedMessageAccess(ctx, built, meta.viewer.agentId, args[key])
    if (allowed === false) return err('forbidden_not_owner', 'message coordinates resolve to sessions not owned by the caller')
  }
  return finalize(ctx, built, { ...meta, args: { [key]: args[key] }, brief: briefSession })
}

function ownedMessageAccess(ctx, built, viewerAgentId, needle) {
  const ownedJournal = [...ctx._journals.values()].some((j) => j !== null && j.agentId === viewerAgentId)
  if (ownedJournal) return true
  // The caller was the SENDER of this dispatch (ASM sourceAgentId) or is the
  // agent the workflow attempt was delivered TO (run_delivered.agentId) —
  // both are owner-class observers of the coordinate.
  if (ctx.source('asm_audit').records.some((r) => (r.nativeRefs.requestId === needle || r.nativeRefs.messageId === needle) && r.nativeRefs.sourceAgentId === viewerAgentId)) return true
  return ctx.attemptProjections().some((proj) => proj.events.some((e) => e.kind === 'attempt_run_delivered'
    && (e.nativeRefs?.requestId === needle || e.nativeRefs?.messageId === needle)
    && e.nativeRefs?.agentId === viewerAgentId))
}

function briefScheduler(rec) {
  if (rec.kind === 'job_definition') return `job ${rec.data?.id} → ${rec.data?.agentId ?? '?'} (enabled=${rec.data?.enabled})`
  if (rec.kind === 'occurrence') return `occurrence ${rec.data?.occurrenceId} state=${rec.data?.state} outcome=${rec.data?.executionOutcome ?? '?'}`
  if (rec.kind === 'run_record') return `run ${rec.nativeRefs.run_id} outcome=${rec.data?.outcome ?? '?'} delivery=${rec.data?.delivery_status ?? '?'}`
  return briefSession(rec)
}
