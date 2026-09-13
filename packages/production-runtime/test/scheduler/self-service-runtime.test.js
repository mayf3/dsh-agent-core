import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { JobStore } from '../../../scheduler/src/store.js'
import { createBrokerGateway } from '../../../broker/src/gateway.js'
import { selfOpsManifest } from '../../../broker/src/capabilities/self-ops.js'
import { createPluginContext } from '../../src/context.js'
import { mountSchedulerSelfServiceRuntime } from '../../src/scheduler/self-service-runtime.js'

test('mount exposes scheduler and self_ops providers over the same store', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'scheduler-self-provider-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const ctx = createPluginContext()
  const store = new JobStore(join(dir, 'jobs.json'))
  const router = {
    resolveCallerCorrelation: () => ({ state: 'never_existed' }),
    reconciliationRuntimeStatus: () => ({ generationId: 'opaque-epoch', health: 'healthy' }),
  }
  mountSchedulerSelfServiceRuntime({ ctx, store, router, broker: {}, log: { error() {} } })
  assert.ok(ctx.get('selfServiceSchedulerAccess')?.handlers?.scheduler)
  assert.ok(ctx.get('selfOpsAccess')?.handlers?.self_ops)
  const envelope = await ctx.get('selfOpsAccess').handlers.self_ops.status({}, { callerAgentId: 'agt_self' })
  assert.equal(envelope.ok, true)
  assert.equal(envelope.result.runtime.generationId, 'opaque-epoch')
  assert.equal(envelope.result.scheduler.ownedJobCount, 0)
})

test('missing Router reconciliation seams fail closed by withholding self_ops provider', () => {
  const ctx = createPluginContext()
  const store = new JobStore('/tmp/self-ops-provider-never-read.json')
  mountSchedulerSelfServiceRuntime({ ctx, store, router: {}, broker: {}, log: { error() {} } })
  assert.equal(ctx.get('selfOpsAccess'), undefined)
  assert.ok(ctx.get('selfServiceSchedulerAccess'))
})

test('real Broker gateway preserves the real production self_ops status envelope', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'scheduler-self-broker-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const ctx = createPluginContext()
  const store = new JobStore(join(dir, 'jobs.json'))
  mountSchedulerSelfServiceRuntime({
    ctx,
    store,
    router: {
      resolveCallerCorrelation: () => ({ state: 'never_existed' }),
      reconciliationRuntimeStatus: () => ({ generationId: 'combined-epoch', health: 'healthy' }),
    },
    broker: {},
    log: { error() {} },
  })
  const gateway = createBrokerGateway({
    manifests: [selfOpsManifest],
    targets: [],
    localHandlers: ctx.get('selfOpsAccess').handlers,
  })
  const answer = await gateway.execute(
    { capabilityId: 'self_ops', operation: 'status', args: {} },
    { agentId: 'agt_self' },
  )
  assert.equal(answer.ok, true)
  assert.equal(answer.result.callerAgentId, 'agt_self')
  assert.equal(answer.result.runtime.generationId, 'combined-epoch')
  assert.equal(answer.result.scheduler.ownedJobCount, 0)
})
