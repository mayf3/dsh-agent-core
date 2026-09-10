import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { JobStore } from '../src/store.js'
import { createSelfServiceSchedulerAccess, parseCriticalInventory, evaluateCriticalJobGuard, CRITICAL_GUARD_REASONS } from '../src/self-service.js'

function trusted(agentId = 'agt_a', overrides = {}) {
  return {
    agentId,
    callerAgentId: agentId,
    processGeneration: 7,
    turnExecutionId: `turn:${agentId}:7:1`,
    ...overrides,
  }
}

const CRITICAL_KEY = 'agt_hr-agent:hr-workflow-auto-dispatch'

function inventoryFile(t, content) {
  const dir = mkdtemp(join(tmpdir(), 'critical-guard-')).then(async (resolvedDir) => {
    const path = join(resolvedDir, 'scheduler-desired-state.json')
    await writeFile(path, typeof content === 'string' ? content : JSON.stringify(content))
    t.after(() => rm(resolvedDir, { recursive: true, force: true }))
    return path
  })
  return dir
}

async function rig(t, { inventoryPath, adminAgents = new Set() } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'critical-guard-store-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const store = new JobStore(join(dir, 'jobs.json'), { runLogPath: join(dir, 'runs.jsonl') })
  const denialEvents = []
  const originalAppend = store.appendRunEvent.bind(store)
  store.appendRunEvent = async (event) => {
    if (event.action === 'self_service_denied') denialEvents.push(event)
    return originalAppend(event)
  }
  const access = createSelfServiceSchedulerAccess({
    store,
    assertGrant: async (agentId, scope) => scope === 'scheduler.admin' && adminAgents.has(agentId),
    criticalInventoryPath: inventoryPath,
  })
  const call = (action, args, context = trusted()) => access.handlers.scheduler[action](args, context)
  // seed: one SELF-owned job whose logicalKey IS in the inventory, one
  // SELF-owned NON-critical job. (logicalKey uniqueness forbids a second job
  // sharing the critical key — foreign access is exercised by a FOREIGN CALLER
  // targeting the critical job, see T5.)
  await call('create', { logical_key: CRITICAL_KEY, name: 'hr dispatch', schedule_kind: 'every', every_ms: 1800000, message: 'must-not-leak' }, trusted('agt_hr'))
  await call('create', { logical_key: 'agt_a:ordinary', name: 'ordinary', schedule_kind: 'every', every_ms: 60000, message: 'ordinary' }, trusted('agt_a'))
  const jobs = (await store.loadDoc({ force: true })).jobs
  const criticalSelfJob = jobs.find((j) => j.logicalKey === CRITICAL_KEY && j.agentId === 'agt_hr')
  const ordinaryJob = jobs.find((j) => j.logicalKey === 'agt_a:ordinary')
  const snapshot = async () => JSON.stringify((await store.loadDoc({ force: true })).jobs)
  return { store, call, denialEvents, criticalSelfJob, ordinaryJob, snapshot, jobsDir: dir }
}

test('T1: self-owned NON-critical job disable -> existing behavior unchanged (guard inert)', async (t) => {
  const { call, ordinaryJob } = await rig(t)
  const r = await call('disable', { job_id: ordinaryJob.id }, trusted('agt_a'))
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.equal(r.result.enabled, false)
})

test('T1b (identity, EXACT_LOGICAL_KEY_ONLY): case/whitespace variants of an inventory key are NOT critical', () => {
  const inventory = { state: 'ok', logicalKeys: new Set([CRITICAL_KEY]) }
  assert.equal(evaluateCriticalJobGuard({ operation: 'disable', logicalKey: CRITICAL_KEY.toUpperCase(), inventory }), null)
  assert.equal(evaluateCriticalJobGuard({ operation: 'disable', logicalKey: ` ${CRITICAL_KEY}`, inventory }), null)
  assert.equal(evaluateCriticalJobGuard({ operation: 'disable', logicalKey: 'agt_a:ordinary', inventory }), null)
  assert.equal(evaluateCriticalJobGuard({ operation: 'disable', logicalKey: CRITICAL_KEY, inventory }), CRITICAL_GUARD_REASONS.SELF_DISABLE)
})

test('T2+T2a: self-owned CRITICAL disable AND remove -> FAIL_CLOSED, ZERO store mutation, durable sanitized denial evidence', async (t) => {
  const inventory = await inventoryFile(t, { version: 1, jobs: [{ logicalKey: CRITICAL_KEY }] })
  const { call, denialEvents, criticalSelfJob, snapshot } = await rig(t, { inventoryPath: inventory })
  const before = await snapshot()
  const rd = await call('disable', { job_id: criticalSelfJob.id }, trusted('agt_hr'))
  assert.equal(rd.ok, false)
  assert.match(rd.error.detail, /critical_job_self_disable/)
  const rr = await call('remove', { job_id: criticalSelfJob.id }, trusted('agt_hr'))
  assert.equal(rr.ok, false)
  assert.match(rr.error.detail, /critical_job_self_disable/)
  assert.equal(await snapshot(), before, 'ZERO store mutation')
  assert.equal(denialEvents.length, 2)
  for (const e of denialEvents) {
    assert.equal(e.action, 'self_service_denied')
    assert.equal(e.operatorAgentId, 'agt_hr')
    assert.equal(e.reason, CRITICAL_GUARD_REASONS.SELF_DISABLE)
    assert.equal(JSON.stringify(e).includes('must-not-leak'), false, 'no payload leakage')
  }
  // the critical job survives, still enabled (zero mutation)
  const after = JSON.parse(await snapshot())
  const survived = after.find((j) => j.id === criticalSelfJob.id)
  assert.notEqual(survived, undefined)
  assert.equal(survived.enabled, true)
})

test('T3+T3a: replay of denied disable/remove -> denied again, still zero mutation (idempotent refusal)', async (t) => {
  const inventory = await inventoryFile(t, { version: 1, jobs: [{ logicalKey: CRITICAL_KEY }] })
  const { call, criticalSelfJob, snapshot } = await rig(t, { inventoryPath: inventory })
  const before = await snapshot()
  for (let i = 0; i < 3; i += 1) {
    const rd = await call('disable', { job_id: criticalSelfJob.id }, trusted('agt_hr'))
    assert.equal(rd.ok, false)
    const rr = await call('remove', { job_id: criticalSelfJob.id }, trusted('agt_hr'))
    assert.equal(rr.ok, false)
  }
  assert.equal(await snapshot(), before)
})

test('T4: alternate identifiers cannot evade — resolution is exact-id only, and any resolved route hits the same persisted logicalKey', async (t) => {
  const inventory = await inventoryFile(t, { version: 1, jobs: [{ logicalKey: CRITICAL_KEY }] })
  const { call, criticalSelfJob, snapshot } = await rig(t, { inventoryPath: inventory })
  const before = await snapshot()
  const variants = [` ${criticalSelfJob.id}`, criticalSelfJob.id.toUpperCase(), `${criticalSelfJob.id.slice(0, 8)}-0000-0000-0000-000000000000`]
  for (const variant of variants) {
    const r = await call('disable', { job_id: variant }, trusted('agt_hr'))
    assert.equal(r.ok, false)
    assert.equal(r.error.code, 'job_not_found', 'non-exact id resolves to nothing — no fuzzy evasion surface')
  }
  assert.equal(await snapshot(), before)
})

test('T5: foreign Agent targeting a critical job stays denied by existing ownership rules (unchanged)', async (t) => {
  const inventory = await inventoryFile(t, { version: 1, jobs: [{ logicalKey: CRITICAL_KEY }] })
  const { call, criticalSelfJob, snapshot } = await rig(t, { inventoryPath: inventory })
  const before = await snapshot()
  const r = await call('disable', { job_id: criticalSelfJob.id }, trusted('agt_other'))
  assert.equal(r.ok, false)
  assert.equal(r.error.code, 'access_denied')
  assert.match(r.error.detail, /no visible job/) // existing foreign-denial wording, no disclosure
  assert.equal(await snapshot(), before)
})

test('T6: operator CLI path (control-layer disableJobOp) keeps full critical-disable authority', async (t) => {
  const { disableJobOp } = await import('../src/control.js')
  const inventory = await inventoryFile(t, { version: 1, jobs: [{ logicalKey: CRITICAL_KEY }] })
  const { store, criticalSelfJob } = await rig(t, { inventoryPath: inventory })
  const updated = await disableJobOp(store, criticalSelfJob.id, { nowMs: Date.now() })
  assert.equal(updated.enabled, false, 'operator emergency stop preserved — no guard in the control layer')
})

test('T7: scheduler.manage:any (exact admin proof) disables a critical job via self-service — allowed, semantics unchanged', async (t) => {
  const inventory = await inventoryFile(t, { version: 1, jobs: [{ logicalKey: CRITICAL_KEY }] })
  const { call, criticalSelfJob, denialEvents } = await rig(t, { inventoryPath: inventory, adminAgents: new Set(['agt_admin']) })
  const r = await call('disable', { job_id: criticalSelfJob.id }, trusted('agt_admin'))
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.equal(r.result.enabled, false)
  assert.equal(denialEvents.length, 0)
})

test('T8: inventory unreadable / invalid / unsupported version -> FAIL_CLOSED (critical_inventory_unavailable), even for non-critical jobs', async (t) => {
  const cases = [
    await inventoryFile(t, '{"version":1,"jobs":[{"logicalKey"'),
    await inventoryFile(t, { version: 2, jobs: [] }),
    await inventoryFile(t, '{"jobs":[]}'),
  ]
  for (const inventory of cases) {
    const { call, ordinaryJob, snapshot } = await rig(t, { inventoryPath: inventory })
    const before = await snapshot()
    const r = await call('disable', { job_id: ordinaryJob.id }, trusted('agt_a'))
    assert.equal(r.ok, false)
    assert.match(r.error.detail, /critical_inventory_unavailable/)
    assert.equal(await snapshot(), before, 'zero mutation under unverifiable inventory')
  }
})

test('T8b: unconfigured inventory (no path) -> guard inert; self disable behaves exactly as accepted V2', async (t) => {
  const { call, ordinaryJob, criticalSelfJob } = await rig(t)
  const r = await call('disable', { job_id: ordinaryJob.id }, trusted('agt_a'))
  assert.equal(r.ok, true)
  assert.equal(r.result.enabled, false)
  assert.equal(evaluateCriticalJobGuard({ operation: 'disable', logicalKey: CRITICAL_KEY, inventory: { state: 'unconfigured' } }), null)
  assert.ok(criticalSelfJob.id)
})

test('T9: denial evidence is durable + sanitized (runs.jsonl carries whitelisted attribution only, zero payload bytes)', async (t) => {
  const inventory = await inventoryFile(t, { version: 1, jobs: [{ logicalKey: CRITICAL_KEY }] })
  const { call, criticalSelfJob, jobsDir } = await rig(t, { inventoryPath: inventory })
  await call('disable', { job_id: criticalSelfJob.id }, trusted('agt_hr'))
  const { readFile } = await import('node:fs/promises')
  const runs = await readFile(join(jobsDir, 'runs.jsonl'), 'utf8')
  const denial = runs.split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((e) => e.action === 'self_service_denied')
  assert.equal(denial.length, 1)
  assert.deepEqual(Object.keys(denial[0]).sort(), ['action', 'jobId', 'operation', 'operatorAgentId', 'reason', 'ts'])
  assert.equal(runs.includes('must-not-leak'), false, 'no payload/credential leakage in the evidence channel')
})

test('T10: enable/list/runs zero regression — enable of a critical job by its owner stays ALLOWED (guard is disable/remove only)', async (t) => {
  const inventory = await inventoryFile(t, { version: 1, jobs: [{ logicalKey: CRITICAL_KEY }] })
  const { call, criticalSelfJob, ordinaryJob } = await rig(t, { inventoryPath: inventory })
  const list = await call('list', {}, trusted('agt_hr'))
  assert.equal(list.ok, true)
  assert.equal(list.result.jobs.length, 1)
  const runs = await call('runs', {}, trusted('agt_hr'))
  assert.equal(runs.ok, true)
  const en = await call('enable', { job_id: criticalSelfJob.id }, trusted('agt_hr'))
  assert.equal(en.ok, true, 'enable is NOT guarded (AMENDMENT_1 covers disable/remove only)')
  assert.equal(en.result.enabled, true)
  const upd = await call('update', { job_id: ordinaryJob.id, name: 'renamed' }, trusted('agt_a'))
  assert.equal(upd.ok, true, 'update unaffected')
})

test('parseCriticalInventory unit: rejects non-object/missing jobs/bad entries; accepts empty inventory', () => {
  assert.throws(() => parseCriticalInventory('null'))
  assert.throws(() => parseCriticalInventory('[]'))
  assert.throws(() => parseCriticalInventory('{"version":1}'))
  assert.throws(() => parseCriticalInventory('{"version":2,"jobs":[]}'))
  assert.throws(() => parseCriticalInventory('{"version":1,"jobs":[{}]}'))
  assert.deepEqual([...parseCriticalInventory('{"version":1,"jobs":[]}')], [])
  assert.deepEqual([...parseCriticalInventory('{"version":1,"jobs":[{"logicalKey":"k"}]}')], ['k'])
})

test('NEW_MUTATION_SURFACE=NO proof: a denial never invokes the control operation (no store write path engaged)', async (t) => {
  const inventory = await inventoryFile(t, { version: 1, jobs: [{ logicalKey: CRITICAL_KEY }] })
  const { store, call, criticalSelfJob } = await rig(t, { inventoryPath: inventory })
  let controlWrites = 0
  const originalMutate = store.mutateDoc?.bind(store)
  if (typeof originalMutate === 'function') {
    store.mutateDoc = async (...args) => { controlWrites += 1; return originalMutate(...args) }
  }
  const r = await call('disable', { job_id: criticalSelfJob.id }, trusted('agt_hr'))
  assert.equal(r.ok, false)
  assert.equal(controlWrites, 0, 'denial path engages zero control-op/store-write machinery')
})
