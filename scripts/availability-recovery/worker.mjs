// Tool-free protocol fixture. Real OS child; no model, network, or production data.
import readline from 'node:readline'
import { appendFileSync } from 'node:fs'
let count = 0
const send = value => process.stdout.write(JSON.stringify(value) + '\n')
const event = (sessionId, type, data) => send({ method: 'session.event', params: { sessionId, event: { type, data } } })
const input = readline.createInterface({ input: process.stdin })
input.on('close', () => process.exit(0))
input.on('line', line => {
  const message = JSON.parse(line)
  const p = message.params ?? {}
  if (message.method === 'initialize') {
    send({ id: message.id, result: { registeredProviders: ['availability-fixture'] } })
  } else if (message.method === 'shutdown') {
    process.stdout.write(JSON.stringify({ id: message.id, result: { ok: true } }) + '\n', () => process.exit(0))
  } else if (message.method === 'session/prompt') {
    appendFileSync(process.env.FIXTURE_PROMPT_LOG, JSON.stringify({ pid: process.pid, params: p }) + '\n')
    const n = ++count
    const sessionId = p.sessionId ?? 'main'
    const id = `fixture-message-${n}`
    send({ id: message.id, result: { messageId: id } })
    event(sessionId, 'agent/inbox/spliced', { inserted: [{ id }] })
    event(sessionId, 'turn/start', { turn: n })
    event(sessionId, 'user/message', { id })
    const text = JSON.stringify(p)
    if (text.includes('STALL')) return
    if (text.includes('CRASH')) { setTimeout(() => process.exit(42), 5); return }
    event(sessionId, 'assistant/message', { message: { content: [{ type: 'text', text: 'fixture-ok' }] } })
    event(sessionId, 'turn/end', { turn: n, reason: { kind: 'completed' } })
    send({ method: 'session.status', params: { sessionId, status: 'idle' } })
  } else if (message.id !== undefined) {
    send({ id: message.id, result: { sessionId: p.sessionId ?? 'main' } })
  }
})
