import test from 'node:test'
import assert from 'node:assert/strict'

const required = [
  'R30_REAL_WORKFLOW_BASE_URL', 'R30_REAL_WORKFLOW_TOKEN',
  'R30_REAL_KICK_BASE_URL', 'R30_REAL_KICK_TOKEN',
  'R30_REAL_WORKFLOW_AUDIENCE', 'R30_REAL_WORKFLOW_SCOPE',
  'R30_REAL_KICK_AUDIENCE', 'R30_REAL_KICK_SCOPE',
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
  const workflowBase = process.env.R30_REAL_WORKFLOW_BASE_URL.replace(/\/$/, '')
  const kickBase = process.env.R30_REAL_KICK_BASE_URL.replace(/\/$/, '')
  const workflowToken = process.env.R30_REAL_WORKFLOW_TOKEN
  const kickToken = process.env.R30_REAL_KICK_TOKEN
  assert.notEqual(workflowBase, kickBase, 'Workflow and Agent Core endpoints must be distinct')
  assert.notEqual(workflowToken, kickToken, 'Workflow and Agent Core credentials must be distinct')
  assert.notEqual(process.env.R30_REAL_WORKFLOW_AUDIENCE, process.env.R30_REAL_KICK_AUDIENCE, 'audiences must be distinct')
  assert.notEqual(process.env.R30_REAL_WORKFLOW_SCOPE, process.env.R30_REAL_KICK_SCOPE, 'scopes must be distinct')
  const workflowInstanceId = process.env.R30_REAL_WORKFLOW_INSTANCE_ID
  const nodeVisitId = process.env.R30_REAL_WORKFLOW_NODE_VISIT_ID

  // The dispatch intent is authoritative. The kick endpoint does not accept
  // stateVersion/cause and does not return a business receipt.
  const due = await jsonRequest(`${workflowBase}${process.env.R30_REAL_WORKFLOW_DISPATCH_INTENTS_PATH ?? '/internal/v1/dispatch-intents'}`, workflowToken)
  const intent = (due.items ?? []).find(item =>
    item.workflowInstanceId === workflowInstanceId && item.nodeVisitId === nodeVisitId)
  assert.ok(intent?.dispatchIntentId, 'due feed must provide the exact dispatchIntentId')
  const kick = await jsonRequest(`${kickBase}${process.env.R30_REAL_WORKFLOW_KICK_PATH ?? '/workflow-execution/kicks'}`, kickToken, {
    method: 'POST',
    body: JSON.stringify({ workflowInstanceId, nodeVisitId, dispatchIntentId: intent.dispatchIntentId }),
  })
  assert.equal(kick.ok, true)
  assert.equal(kick.kicked === true || kick.coalesced === true, true)

  const eventPath = process.env.R30_REAL_WORKFLOW_EVENT_PATH
  const turnPath = process.env.R30_REAL_WORKFLOW_TURN_PATH
  assert.ok(eventPath && turnPath, 'real rehearsal requires event and turn readback paths')
  const event = await jsonRequest(`${workflowBase}${eventPath}`, workflowToken)
  const turn = await jsonRequest(`${workflowBase}${turnPath}`, workflowToken)
  assert.equal(event.workflowInstanceId, workflowInstanceId)
  assert.equal(event.nodeVisitId, nodeVisitId)
  assert.ok(event.eventId ?? event.id)
  assert.ok(turn.turnExecutionId ?? turn.turnId)
  assert.equal(turn.workflowInstanceId, workflowInstanceId)
})
