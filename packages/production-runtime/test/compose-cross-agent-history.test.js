/**
 * Combined composition regression for the accepted cross-agent Scheduler and
 * Scheduler Run History contracts. Uses the real production composition,
 * self-service authorization, Router seam, Scheduler, and HistoryStore with a
 * fake target process and loopback Auth token endpoint only.
 */
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { test } from 'node:test'

import { composeProductionRuntime } from '../src/compose.js'
import { FakeProc, seedRuntime, silentLog } from './compose-fixture.js'

test('cross-agent scheduler authorization flows one target-owned fresh Run into HistoryStore without source authority propagation or replay', async (t) => {
  const sourceAgentId = 'agt_history-source'
  const targetAgentId = 'agt_history-target'
  const sourceSecret = 'source-authority-must-stop-at-control-plane'
  const { root, layout } = await seedRuntime(t, {
    agents: [[sourceAgentId, 'History Source'], [targetAgentId, 'History Target']],
  })
  const credentialsFile = join(root, 'credentials.json')
  writeFileSync(credentialsFile, `${JSON.stringify({
    version: 1,
    credentials: {
      [sourceAgentId]: { clientId: 'history-source-client', clientSecret: sourceSecret },
    },
  })}\n`)

  const grantRequests = []
  const authServer = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      grantRequests.push({ authorization: req.headers.authorization, body })
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ access_token: 'scheduler-manage-any-token', expires_in: 300 }))
    })
  })
  await new Promise((resolve) => authServer.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => authServer.close(resolve)))
  const authServiceOrigin = `http://127.0.0.1:${authServer.address().port}`

  const spawned = []
  const runtime = await composeProductionRuntime({
    layout,
    productApi: { enabled: false, port: 0 },
    notificationIngress: { enabled: false, host: '127.0.0.1', port: 0 },
    broker: { credentialsFile, authServiceOrigin },
    processFactory: (opts) => {
      const proc = new FakeProc(opts)
      spawned.push({ opts, proc })
      return proc
    },
    log: silentLog,
  })
  t.after(() => runtime.stop())

  const access = runtime.ctx.get('selfServiceSchedulerAccess')
  const dueAt = new Date(Date.now() + 250).toISOString()
  const created = await access.handlers.scheduler.create({
    name: 'composed cross-agent history',
    schedule_kind: 'at',
    at: dueAt,
    message: 'run once as the target',
    target_agent_id: targetAgentId,
    delivery_mode: 'none',
  }, {
    agentId: sourceAgentId,
    callerAgentId: sourceAgentId,
    processGeneration: 7,
    turnExecutionId: 'turn:history-source:7:1',
  })
  assert.equal(created.ok, true, JSON.stringify(created))
  assert.equal(created.result.targetAgentId, targetAgentId)
  assert.equal(grantRequests.length, 1, 'the source credential is consulted exactly once for scheduler.manage:any')
  assert.equal(grantRequests[0].authorization, `Basic ${Buffer.from(`history-source-client:${sourceSecret}`).toString('base64')}`)
  const grantBody = new URLSearchParams(grantRequests[0].body)
  assert.equal(grantBody.get('resource'), 'scheduler')
  assert.equal(grantBody.get('scope'), 'scheduler.manage:any')

  await runtime.scheduler.start({ autoStart: false, catchup: false })
  const waitMs = Math.max(0, Date.parse(dueAt) - Date.now() + 25)
  await new Promise((resolve) => setTimeout(resolve, waitMs))
  await Promise.all([runtime.scheduler.tick(), runtime.scheduler.tick()])
  await runtime.scheduler.whenIdle()
  await runtime.scheduler.tick()
  await runtime.scheduler.whenIdle()

  assert.equal(spawned.length, 1, 'concurrent and repeated ticks spawn only the target Agent once')
  assert.equal(spawned[0].proc.agentId, targetAgentId)
  assert.equal(spawned[0].proc.turns.length, 1, 'one occurrence produces exactly one target Run with no replay')
  const targetTurn = spawned[0].proc.turns[0]
  assert.match(targetTurn.sessionId, /^cron-run-/, 'the target Run uses a fresh scheduler-native Session')
  assert.notEqual(targetTurn.sessionId, 'main')

  const forbiddenAuthorityKey = /principal|credential|clientsecret|authorization|bearer|grant|calleragent|sourceagent|impersonat/i
  const forbiddenKeys = []
  const seen = new WeakSet()
  const inspectTargetOptions = (value, key) => {
    if (key !== undefined && forbiddenAuthorityKey.test(key)) forbiddenKeys.push(key)
    if (value === null || typeof value !== 'object' || seen.has(value)) return
    seen.add(value)
    for (const [childKey, childValue] of Object.entries(value)) inspectTargetOptions(childValue, childKey)
  }
  inspectTargetOptions(spawned[0].opts)
  assert.deepEqual(forbiddenKeys, [], 'the target process receives no source Principal/Grant/credential fields')
  assert.equal(JSON.stringify(spawned[0].opts).includes(sourceSecret), false, 'the source credential bytes never enter target process options')

  const history = runtime.ctx.get('schedulerHistory')
  const runs = history.queryRuns({ jobId: created.result.jobId }).runs
  assert.equal(runs.length, 1, 'HistoryStore contains one Run for the authorized cross-agent occurrence')
  const run = runs[0]
  assert.equal(run.job_id, created.result.jobId)
  assert.equal(run.agent_id, targetAgentId)
  assert.equal(run.session_id, targetTurn.sessionId)
  assert.equal(run.occurrence_id.startsWith('occ:'), true)
  assert.equal(run.run_id, `run:${run.occurrence_id}`)
  assert.equal(run.request_id, run.occurrence_id)
  assert.equal(run.correlation_id, `schcorr:${run.occurrence_id}`)
  assert.equal(run.parent_run_id, null, 'a natural occurrence is the correlation-chain root')
  assert.equal(run.outcome, 'succeeded')
  assert.equal(run.status_view, 'success')
  assert.equal(run.delivery_status, 'not-requested')

  const occurrence = history.getOccurrence(run.occurrence_id)
  assert.equal(occurrence.runs.length, 1)
  assert.equal(occurrence.runs[0].run_id, run.run_id)
  assert.equal(occurrence.occurrence.occurrence_id, run.occurrence_id)
  assert.equal(history.getJobSnapshot(run.run_id).agent_id, targetAgentId)
})
