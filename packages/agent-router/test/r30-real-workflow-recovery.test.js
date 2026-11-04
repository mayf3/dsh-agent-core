import test from 'node:test'
import assert from 'node:assert/strict'

// This test is intentionally enabled only by the release rehearsal. It must
// use a real svc-workflow base URL/token and never substitutes in-memory
// verify/continue answers.
test('R30 real cross-system Workflow recovery via KICK/due feed', { skip: !process.env.R30_REAL_WORKFLOW_BASE_URL }, async () => {
  const base = process.env.R30_REAL_WORKFLOW_BASE_URL
  const token = process.env.R30_REAL_WORKFLOW_TOKEN
  assert.ok(token, 'R30_REAL_WORKFLOW_TOKEN is required for the real rehearsal')
  const response = await fetch(`${base}/health`, { headers: { authorization: `Bearer ${token}` } })
  assert.equal(response.ok, true)
  // The release harness supplies instanceId/nodeVisitId/stateVersion and must
  // assert real outbox/due-feed, new turn, and Workflow event receipts here.
  throw new Error('release harness must provide real instance/nodeVisit receipts; no stub is permitted')
})
