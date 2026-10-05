/** Fixed metadata-only derivation, using current product path/Binding authorities. */
import { BindingStore } from '../../../packages/agent-router/src/binding-store.js'
import { resolveWorkspace, sanitizeAgentId } from '../../../packages/workspace-bootstrap/src/paths.js'
import { encodeSessionSegment, sessionProjectKey } from '../../../packages/production-runtime/src/agent-session/turn-inspection.js'
import { isAbsolute } from 'node:path'
const ROOT = '/Users/authsvc/.agent-core'
const AGENT = 'agt_hr-agent'
const HANDLE = 'turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256'
export function deriveFixedMetadata(input) {
  const { subject, primary, headers, bindingsFd } = input
  if (subject?.agentId !== AGENT || subject.turnExecutionId !== HANDLE ||
      subject.reconciliationHandle !== HANDLE || typeof subject.sessionId !== 'string' ||
      subject.sessionId === '' || !Number.isSafeInteger(bindingsFd) || bindingsFd < 3 ||
      primary === null || typeof primary !== 'object' || Array.isArray(primary)) {
    throw new Error('HOLDER_PATH_UNKNOWN')
  }
  for (const [agent, path] of Object.entries(primary)) {
    sanitizeAgentId(agent)
    if (typeof path !== 'string' || !isAbsolute(path)) throw new Error('HOLDER_PATH_UNKNOWN')
  }
  const store = new BindingStore({ storeFile: `/dev/fd/${bindingsFd}` })
  const paths = new Set([`${ROOT}/workspaces`, resolveWorkspace(AGENT, `${ROOT}/workspaces`, {}, primary)])
  for (const row of store.bindings.values()) {
    if (row.activeAgentId !== AGENT) continue
    if (row.workspace != null) {
      sanitizeAgentId(row.workspace)
      paths.add(resolveWorkspace(row.workspace, `${ROOT}/workspaces`, {}))
    }
  }
  if (headers !== undefined) {
    if (!Array.isArray(headers) || headers.length === 0 || headers.length > 64) throw new Error('HOLDER_PATH_UNKNOWN')
    for (const item of headers) {
      const header = item.header
      if (header?.type !== 'session' || header.id !== subject.sessionId ||
          typeof header.cwd !== 'string' || !isAbsolute(header.cwd) ||
          item.projectKey !== sessionProjectKey(header.cwd)) throw new Error('HOLDER_PATH_UNKNOWN')
      paths.add(header.cwd)
    }
  }
  if (paths.size > 64 || [...paths].some(path => Buffer.byteLength(path) > 4096)) throw new Error('HOLDER_PATH_UNKNOWN')
  return { paths: [...paths].sort(), encodedSession: encodeSessionSegment(subject.sessionId),
    sessionsRoot: `${ROOT}/homes/${AGENT}/sessions` }
}
