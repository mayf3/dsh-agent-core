import test from 'node:test'
import assert from 'node:assert/strict'

const required = [
  'R30_REAL_WORKFLOW_BASE_URL', 'R30_REAL_WORKFLOW_TOKEN',
  'R30_REAL_WORKFLOW_INSTANCE_ID', 'R30_REAL_WORKFLOW_NODE_VISIT_ID',
]
const rehearsalReady = required.every(key => process.env[key])

async function jsonRequest(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(options.headers ?? {}) },
  })
  const text = await response.text()
  let body
  try { body = JSON.parse(text) } catch { body = { raw: text } }
  assert.equal(response.ok, true, `${response.status} ${url}: ${text}`)
  return body
}

test('R30 real cross-system Workflow recovery via KICK/due feed', { skip: !rehearsalReady }, async () => {
  const base = process.env.R30_REAL_WORKFLOW_BASE_URL.replace(/\/$/, '')
  const token = process.env.R30_REAL_WORKFLOW_TOKEN
  const workflowInstanceId = process.env.R30_REAL_WORKFLOW_INSTANCE_ID
  const nodeVisitId = process.env.R30_REAL_WORKFLOW_NODE_VISIT_ID

  // The dispatch intent is authoritative. The kick endpoint does not accept
  // stateVersion/cause and does not return a business receipt.
  const due = await jsonRequest(`${base}${process.env.R30_REAL_WORKFLOW_DISPATCH_INTENTS_PATH ?? '/internal/v1/dispatch-intents'}`, token)
  const intent = (due.items ?? []).find(item =>
    item.workflowInstanceId === workflowInstanceId && item.nodeVisitId === nodeVisitId)
  assert.ok(intent?.dispatchIntentId, 'due feed must provide the exact dispatchIntentId')
  const kick = await jsonRequest(`${base}${process.env.R30_REAL_WORKFLOW_KICK_PATH ?? '/workflow-execution/kicks'}`, token, {
    method: 'POST',
    body: JSON.stringify({ workflowInstanceId, nodeVisitId, dispatchIntentId: intent.dispatchIntentId }),
  })
  assert.equal(kick.ok, true)
  assert.equal(kick.kicked === true || kick.coalesced === true, true)

  const eventPath = process.env.R30_REAL_WORKFLOW_EVENT_PATH
  const turnPath = process.env.R30_REAL_WORKFLOW_TURN_PATH
  assert.ok(eventPath && turnPath, 'real rehearsal requires event and turn readback paths')
  const event = await jsonRequest(`${base}${eventPath}`, token)
  const turn = await jsonRequest(`${base}${turnPath}`, token)
  assert.equal(event.workflowInstanceId, workflowInstanceId)
  assert.equal(event.nodeVisitId, nodeVisitId)
  assert.ok(event.eventId ?? event.id)
  assert.ok(turn.turnExecutionId ?? turn.turnId)
  assert.equal(turn.workflowInstanceId, workflowInstanceId)
})
