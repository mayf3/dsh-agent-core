import { createHash } from 'node:crypto'
import { createTransportControl, TransportControlError } from '../../transport/control.js'
import { COMPLETE_LIMITS as L, completeArguments, completeFailure, exactKeys, canonicalUuid } from './complete-contract.js'
import { workflowCurrentTaskInputManifest } from './index.js'

const bodyKeys = ['kind', 'id', 'sha256', 'encoding', 'serialization', 'total_bytes', 'offset', 'text', 'next_offset', 'content_status']
const bad = () => { throw new TransportControlError('protocol') }
const tooBig = () => { throw new TransportControlError('limit') }
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const bindingFor = a => ({ workflow_instance_id: a.workflowInstanceId, definition_version_id: a.expectedDefinitionVersionId,
  node_visit_id: a.expectedNodeVisitId, workflow_state_version: a.expectedWorkflowStateVersion, context_revision_id: a.expectedContextRevisionId })

function pageBytes(page, args, binding, offset, total) {
  if (!exactKeys(page, ['view', 'binding', 'body']) || page.view !== 'body'
    || !exactKeys(page.binding, Object.keys(binding)) || !exactKeys(page.body, bodyKeys)) bad()
  for (const [key, value] of Object.entries(binding)) {
    if ((key === 'workflow_state_version' ? page.binding[key] : canonicalUuid(page.binding[key])) !== value) bad()
  }
  const b = page.body
  if (b.kind !== args.bodyKind || canonicalUuid(b.id) !== args.bodyId || b.sha256 !== args.expectedBodySha256
    || b.encoding !== 'utf-8' || b.serialization !== 'JCS' || !Number.isSafeInteger(b.total_bytes)
    || b.total_bytes < 0 || (total !== undefined && b.total_bytes !== total)
    || !Number.isSafeInteger(b.offset) || b.offset !== offset || typeof b.text !== 'string'
    || !b.text.isWellFormed()) bad()
  if (b.total_bytes > L.body) tooBig()
  const bytes = Buffer.from(b.text, 'utf8'), end = offset + bytes.length
  if (bytes.length > L.page || end > b.total_bytes) bad()
  if (end === b.total_bytes) {
    if (b.content_status !== 'COMPLETE' || b.next_offset !== null) bad()
  } else if (b.content_status !== 'TRUNCATED' || !bytes.length || !Number.isSafeInteger(b.next_offset) || b.next_offset !== end) bad()
  return bytes
}

/** The only auth/network primitive used by this LOCAL handler is transport.execute. */
export async function readCompleteBody({ call, manifest, transport, context = {}, control }) {
  const args = completeArguments(call?.args)
  if (call?.operation !== 'read') return completeFailure({ code: 'unsupported_operation' }, manifest)
  if (!args) return completeFailure({ code: 'invalid_arguments' }, manifest)
  if (typeof context.agentId !== 'string' || !context.agentId) return completeFailure({ code: 'credential_unavailable' }, manifest)
  const owned = control ?? createTransportControl({ deadlineMs: L.deadline, maxEntityBytes: L.entity,
    maxTotalBytes: L.total, maxAttempts: L.attempts, signal: context.signal })
  const binding = bindingFor(args), chunks = []
  let offset = 0, total, count = 0
  try {
    while (true) {
      owned.check()
      if (count >= L.attempts) tooBig()
      const response = await owned.wait(() => transport.execute({ manifest: workflowCurrentTaskInputManifest,
        operation: 'read', control: owned, args: { workflowInstanceId: args.workflowInstanceId, view: 'body',
          expectedNodeVisitId: args.expectedNodeVisitId, expectedWorkflowStateVersion: args.expectedWorkflowStateVersion,
          expectedContextRevisionId: args.expectedContextRevisionId, bodyKind: args.bodyKind, bodyId: args.bodyId,
          expectedBodySha256: args.expectedBodySha256, offset } }))
      count++
      if (typeof response?.errorCode === 'string') {
        const codes = { transport_limit_exceeded: 'current_task_body_limit_exceeded',
          transport_deadline_exceeded: 'current_task_body_deadline_exceeded', malformed_response: 'current_task_body_protocol_error' }
        return completeFailure({ ...response, code: codes[response.errorCode] ?? response.errorCode }, manifest)
      }
      if (!exactKeys(response, ['value'])) bad()
      const page = response.value
      const bytes = pageBytes(page, args, binding, offset, total)
      chunks.push(bytes)
      total = page.body.total_bytes
      offset += bytes.length
      if (offset === total) break
    }
    owned.check()
    const bytes = Buffer.concat(chunks, total)
    if (digest(bytes) !== args.expectedBodySha256) return completeFailure({ code: 'current_task_body_digest_mismatch' }, manifest)
    const result = { ok: true, result: { view: 'complete_body', binding,
      body: { kind: args.bodyKind, id: args.bodyId, sha256: args.expectedBodySha256, encoding: 'utf-8', serialization: 'JCS',
        total_bytes: total, offset: 0, text: bytes.toString('utf8'), next_offset: null, content_status: 'COMPLETE' },
      verification: { sha256_verified: true, page_count: count } } }
    if (Buffer.byteLength(JSON.stringify(result)) > L.success) tooBig()
    owned.check()
    return result
  } catch (error) {
    const code = error?.kind === 'limit' ? 'current_task_body_limit_exceeded'
      : error?.kind === 'deadline' ? 'current_task_body_deadline_exceeded'
        : error?.kind === 'protocol' ? 'current_task_body_protocol_error' : 'transport_failure'
    return completeFailure({ code }, manifest)
  } finally {
    chunks.length = 0
    if (!control) owned.close()
  }
}
