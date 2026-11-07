import assert from 'node:assert/strict'
import { fork } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { detail, VISIT, AGENT, INSTANCE } from './fixture.js'

const bytes = file => readFileSync(file, 'utf8')

for (const scenario of ['B1-503', 'B4-missing-baseline']) {
  test(`${scenario}: persisted responsibility survives real process exit; existing poller converges after HTTP recovery`, { timeout: 15_000 }, async t => {
    const dir = mkdtempSync(join(tmpdir(), 'ekr-readback-process-'))
    const requests = []
    let recovered = false, moved = false, child, exit
    const server = createServer((req, res) => {
      // Pre-plan and locked final validation precede the dispatch-time sample.
      const status = scenario === 'B1-503' && requests.length >= 3 && !recovered
        || scenario === 'B4-missing-baseline' && requests.length === 2 ? 503 : 200
      requests.push({ status, agentId: req.headers['x-agent-id'], instanceId: req.headers['x-workflow-id'] })
      res.writeHead(status, { 'content-type': 'application/json' })
      const body = detail(8).body
      if (moved) body.detail.current_node_visit_id = 'ad5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e77'
      res.end(JSON.stringify(status === 200 ? body : { error: 'injected_dependency_unavailable' }))
    })
    function start(mode) {
      child = fork(new URL('./readback-process.js', import.meta.url), [dir, `http://127.0.0.1:${server.address().port}`, mode], {
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: { ...process.env, EKR_READBACK_CHILD: '1' },
      })
      exit = once(child, 'exit')
      return once(child, 'message')
    }
    try {
      server.listen(0, '127.0.0.1')
      await once(server, 'listening')
      const [seed] = await start('seed')
      assert.equal(seed.stage, 'seeded', JSON.stringify(seed))
      assert.deepEqual(seed.errors, [])
      assert.equal(seed.admission.action, 'admitted')
      assert.equal(seed.attempt.readback.status, 'pending')
      assert.ok(Number.isSafeInteger(seed.attempt.readback.nextCheckAtMs))
      assert.deepEqual(await exit, [0, null])
      const originalWal = bytes(join(dir, 'attempts.jsonl'))
      recovered = true
      moved = scenario === 'B1-503'
      let [reply] = await start('poll')
      if (scenario === 'B4-missing-baseline') {
        assert.equal(reply.stage, 'observed', JSON.stringify(reply))
        assert.equal(reply.attempt.readback.observationBaseline.kind, 'late_current_read')
        assert.equal(reply.attempt.workflowStateVersionAtDispatch, undefined)
        assert.equal(reply.attempt.preDeliveryWorkflowStateVersion, 8)
        assert.equal(reply.attempt.state, 'ACTIVE')
        const closed = once(child, 'message')
        moved = true
        ;[reply] = await closed
      }
      assert.equal(reply.stage, 'closed', JSON.stringify(reply))
      assert.deepEqual(reply.errors, [])
      assert.deepEqual(await exit, [0, null])
      assert.equal(reply.attempt.attemptId, seed.attempt.attemptId)
      assert.equal(reply.attempt.generation, 1)
      assert.equal(reply.attempt.readback.completedByThisRun, false)
      assert.equal(reply.attempt.readback.businessOutcome, 'UNKNOWN')
      assert.equal(bytes(join(dir, 'deliveries.jsonl')).trim().split('\n').length, 1)
      assert.ok(bytes(join(dir, 'attempts.jsonl')).startsWith(originalWal))
      assert.ok(requests.some(request => request.status === 503))
      assert.ok(requests.every(request => request.agentId === AGENT && request.instanceId === INSTANCE))
      const added = bytes(join(dir, 'attempts.jsonl')).slice(originalWal.length).trim().split('\n').map(JSON.parse)
      assert.ok(added.every(event => event.kind === 'readback_checked'))
      t.diagnostic(JSON.stringify({ sourceSha: process.env.EKR_SOURCE_SHA ?? 'UNKNOWN', testName: scenario,
        faultInjection: 'actual loopback HTTP503 and exit/restart of engine process', initialState: seed.attempt,
        expectedResult: 'durable next check; automatic readback; zero replay; late sample is observation only',
        actualResult: reply.attempt, rawReceipt: { requests, childExit: [0, null], events: added },
        originalRequest: seed.attempt.attemptId, deliveryCount: 1, productionWrites: 0,
        limitations: 'isolated real ledger/process/HTTP; Router and due-feed injected; no Svc DB or live cross-service claim' }))
    } finally {
      if (child?.exitCode === null) child.kill('SIGKILL')
      await exit?.catch(() => {})
      await new Promise(resolve => server.close(resolve))
      rmSync(dir, { recursive: true, force: true })
    }
  })
}
