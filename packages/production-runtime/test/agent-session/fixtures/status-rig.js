import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { locateSessionArtifact } from '../../../src/agent-session/turn-inspection.js'

export const CALLER = 'agt_Source_A'
export const TRACE = { targetAgentId: 'agt_target-agent', sessionId: 'main', messageId: 'm-status-owned' }
export const WORKSPACE = '/fixture/workspaces/agt_target-agent'

export function auditRow(extra = {}) {
  return { kind: 'agent_session_send', phase: 'outcome', sourceAgentId: CALLER,
    ...TRACE, requestId: 'request-1', result: 'accepted', ts: 10, ...extra }
}

export function records({ reason = { kind: 'completed' }, started = true, end = true, text = 'done' } = {}) {
  return [
    { type: 'session', version: 1, id: 'main', cwd: WORKSPACE },
    { seq: 1, time: 10, type: 'agent/inbox/spliced', data: { inserted: [{ id: TRACE.messageId, role: 'user', source: { kind: 'inter_agent', sourceAgentId: CALLER }, content: [{ type: 'text', text: 'private prompt' }] }] } },
    ...(started ? [
      { seq: 2, time: 20, type: 'turn/start', data: { turn: 7 } },
      { seq: 3, time: 21, type: 'user/message', data: { id: TRACE.messageId, source: { kind: 'inter_agent', sourceAgentId: CALLER }, content: [{ type: 'text', text: 'private prompt' }] } },
      { seq: 4, time: 22, type: 'assistant/message', data: { turn: 7, message: { content: [{ type: 'reasoning', text: 'HIDDEN_MARKER' }, { type: 'text', text }] } } },
      ...(end ? [{ seq: 5, time: 30, type: 'turn/end', data: { turn: 7, reason } }] : []),
      { seq: 6, time: 31, type: 'assistant/message', data: { turn: 8, message: { content: [{ type: 'text', text: 'ADJACENT_MARKER' }] } } },
    ] : []),
  ]
}

export function writeJsonl(file, rows) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, rows.length === 0 ? '' : rows.map(row => JSON.stringify(row)).join('\n') + '\n')
}

export function statusRig(t, { rows = [auditRow()], native = records(), caller = CALLER } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'dispatch-status-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const auditFile = join(root, 'control', 'audit.jsonl')
  const home = join(root, 'homes', TRACE.targetAgentId)
  const artifact = locateSessionArtifact({ dshHome: home, canonicalWorkspace: WORKSPACE, sessionId: TRACE.sessionId })
  writeJsonl(auditFile, rows)
  writeJsonl(artifact, native)
  const calls = []
  const deps = {
    args: TRACE, callerAgentId: caller, auditFile,
    resolveTarget: id => ({ id }), resolveDshHome: () => home,
    resolveCanonicalWorkspace: () => WORKSPACE,
    io: {
      existsSync(file) { calls.push(['exists', file]); return existsSync(file) },
      statSync(file) { calls.push(['stat', file]); return statSync(file) },
      readFileSync(file) { calls.push(['read', file]); return readFileSync(file) },
    },
  }
  return { root, auditFile, artifact, deps, calls }
}
