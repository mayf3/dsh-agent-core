import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { JobStore } from '../src/store.js'
import { createSelfServiceSchedulerAccess } from '../src/self-service.js'
import {
  parseCriticalInventory,
  evaluateCriticalJobGuard,
  CRITICAL_GUARD_REASONS,
  DEFAULT_CRITICAL_INVENTORY_PATH,
} from '../src/critical-job-guard.js'

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

// Deterministic fixture manifest writer (hermetic — never the host file).
function inventoryFile(t, content) {
  return mkdtemp(join(tmpdir(), 'critical-guard-')).then(async (resolvedDir) => {
    const path = join(resolvedDir, 'scheduler-desired-state.json')
    await writeFile(path, typeof content === 'string' ? content : JSON.stringify(content))
    t.after(() => rm(resolvedDir, { recursive: true, force: true }))
    return path
  })
}

async function rig(t, { inventoryPath, adminAgents = new Set() } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'critical-guard-store-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const storePath = join(dir, 'jobs.json')
  const store = new JobStore(storePath, { runLogPath: join(dir, 'runs.jsonl') })
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
  // seed: one SELF-owned job whose logicalKey IS in the inventory (when the
  // manifest says so), one SELF-owned NON-critical job.
  await call('create', { logical_key: CRITICAL_KEY, name: 'hr dispatch', schedule_kind: 'every', every_ms: 1800000, message: 'must-not-leak' }, trusted('agt_hr'))
  await call('create', { logical_key: 'agt_a:ordinary', name: 'ordinary', schedule_kind: 'every', every_ms: 60000, message: 'ordinary' }, trusted('agt_a'))
  const jobs = (await store.loadDoc({ force: true })).jobs
  const criticalSelfJob = jobs.find((j) => j.logicalKey === CRITICAL_KEY && j.agentId === 'agt_hr')
  const ordinaryJob = jobs.find((j) => j.logicalKey === 'agt_a:ordinary')
  const snapshot = async () => JSON.stringify((await store.loadDoc({ force: true })).jobs)
  const rawStoreBytes = async () => readFile(storePath, 'utf8')
  return { store, call, denialEvents, criticalSelfJob, ordinaryJob, snapshot, rawStoreBytes, storePath, jobsDir: dir }
}

const criticalManifest = () => ({ version: 1, jobs: [{ logicalKey: CRITICAL_KEY }] })

test('R1: no injected path + env absent -> the FIXED production default path is used (and it fail-closes like any source)', async (t) => {
  const fixture = await inventoryFile(t, { version: 1, jobs: [{ logicalKey: CRITICAL_KEY }] })
  const fixtureBytes = await readFile(fixture, 'utf8')
  let requestedPath = null
  const restoreEnv = process.env.SCHEDULER_DESIRED_STATE
  delete process.env.SCHEDULER_DESIRED_STATE
  try {
    const dir = await mkdtemp(join(tmpdir(), 'critical-guard-r1-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const store = new JobStore(join(dir, 'jobs.json'), { runLogPath: join(dir, 'runs.jsonl') })
    const access = createSelfServiceSchedulerAccess({
      store,
      assertGrant: async () => false,
      // NO criticalInventoryPath: exercises DEFAULT_CRITICAL_INVENTORY_PATH.
      readInventoryFile: (p) => { requestedPath = p; return fixtureBytes },
    })
    const created = await access.handlers.scheduler.create(
      { logical_key: CRITICAL_KEY, name: 'x', schedule_kind: 'every', every_ms: 60000, message: 'x' },
      trusted('agt_hr'),
    )
    const denied = await access.handlers.scheduler.disable({ job_id: created.result.jobId }, trusted('agt_hr'))
    assert.equal(denied.ok, false)
    assert.match(denied.error.detail, /critical_job_self_disable/)
    assert.equal(requestedPath, DEFAULT_CRITICAL_INVENTORY_PATH, 'fixed production path is the fallback source')
    assert.equal(DEFAULT_CRITICAL_INVENTORY_PATH, '/usr/local/libexec/agent-core/config/scheduler-desired-state.json')
  } finally {
    if (restoreEnv !== undefined) process.env.SCHEDULER_DESIRED_STATE = restoreEnv
  }
})

test('R1b: default-path read failure -> FAIL_CLOSED, never inert (hermetic via throwing reader)', async (t) => {
  const restoreEnv = process.env.SCHEDULER_DESIRED_STATE
  delete process.env.SCHEDULER_DESIRED_STATE
  try {
    const dir = await mkdtemp(join(tmpdir(), 'critical-guard-r1b-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const store = new JobStore(join(dir, 'jobs.json'), { runLogPath: join(dir, 'runs.jsonl') })
    let asked = null
    const access = createSelfServiceSchedulerAccess({
      store,
      assertGrant: async () => false,
      // NO criticalInventoryPath: exercises DEFAULT_CRITICAL_INVENTORY_PATH;
      // the reader throws = the fixed manifest is missing/unreadable.
      readInventoryFile: (p) => { asked = p; throw new Error('ENOENT: simulated missing default manifest') },
    })
    const created = await access.handlers.scheduler.create(
      { logical_key: 'agt_x:anything', name: 'x', schedule_kind: 'every', every_ms: 60000, message: 'x' },
      trusted('agt_x'),
    )
    const denied = await access.handlers.scheduler.disable({ job_id: created.result.jobId }, trusted('agt_x'))
    assert.equal(denied.ok, false)
    assert.match(denied.error.detail, /critical_inventory_unavailable/, 'missing default manifest fail-closes ALL self disables')
    assert.equal(asked, DEFAULT_CRITICAL_INVENTORY_PATH)
  } finally {
    if (restoreEnv !== undefined) process.env.SCHEDULER_DESIRED_STATE = restoreEnv
  }
})

test('R2: fixed-style configured path MISSING -> disable FAIL_CLOSED (critical_inventory_unavailable), zero mutation', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'critical-guard-r2-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const missing = join(dir, 'absent.json')
  const { call, ordinaryJob, snapshot } = await rig(t, { inventoryPath: missing })
  const before = await snapshot()
  const r = await call('disable', { job_id: ordinaryJob.id }, trusted('agt_a'))
  assert.equal(r.ok, false)
  assert.match(r.error.detail, /critical_inventory_unavailable/)
  assert.equal(await snapshot(), before, 'zero store mutation')
})

test('R3: configured path MISSING -> remove FAIL_CLOSED, zero mutation', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'critical-guard-r3-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const missing = join(dir, 'absent.json')
  const { call, ordinaryJob, snapshot } = await rig(t, { inventoryPath: missing })
  const before = await snapshot()
  const r = await call('remove', { job_id: ordinaryJob.id }, trusted('agt_a'))
  assert.equal(r.ok, false)
  assert.match(r.error.detail, /critical_inventory_unavailable/)
  assert.equal(await snapshot(), before)
})

test('R4: explicit injected manifest -> exact logicalKey behavior (critical denies, non-critical allows)', async (t) => {
  const inventory = await inventoryFile(t, criticalManifest())
  const { call, criticalSelfJob, ordinaryJob } = await rig(t, { inventoryPath: inventory })
  const denied = await call('disable', { job_id: criticalSelfJob.id }, trusted('agt_hr'))
  assert.equal(denied.ok, false)
  assert.match(denied.error.detail, /critical_job_self_disable/)
  const allowed = await call('disable', { job_id: ordinaryJob.id }, trusted('agt_a'))
  assert.equal(allowed.ok, true, 'non-critical job unchanged')
  const en = await call('enable', { job_id: ordinaryJob.id }, trusted('agt_a'))
  assert.equal(en.ok, true)
})

test('T1b (identity, EXACT_LOGICAL_KEY_ONLY): case/whitespace variants of an inventory key are NOT critical', () => {
  const inventory = { state: 'ok', logicalKeys: new Set([CRITICAL_KEY]) }
  assert.equal(evaluateCriticalJobGuard({ operation: 'disable', logicalKey: CRITICAL_KEY.toUpperCase(), inventory }), null)
  assert.equal(evaluateCriticalJobGuard({ operation: 'disable', logicalKey: ` ${CRITICAL_KEY}`, inventory }), null)
  assert.equal(evaluateCriticalJobGuard({ operation: 'disable', logicalKey: CRITICAL_KEY, inventory }), CRITICAL_GUARD_REASONS.SELF_DISABLE)
})

test('T2+T2a: self-owned CRITICAL disable AND remove -> FAIL_CLOSED, ZERO store mutation, durable sanitized denial evidence', async (t) => {
  const inventory = await inventoryFile(t, criticalManifest())
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
  const after = JSON.parse(await snapshot())
  const survived = after.find((j) => j.id === criticalSelfJob.id)
  assert.notEqual(survived, undefined)
  assert.equal(survived.enabled, true, 'critical job survives, still enabled')
})

test('T3+T3a: replay of denied disable/remove -> denied again, still zero mutation (idempotent refusal)', async (t) => {
  const inventory = await inventoryFile(t, criticalManifest())
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
  const inventory = await inventoryFile(t, criticalManifest())
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
  const inventory = await inventoryFile(t, criticalManifest())
  const { call, criticalSelfJob, snapshot } = await rig(t, { inventoryPath: inventory })
  const before = await snapshot()
  const r = await call('disable', { job_id: criticalSelfJob.id }, trusted('agt_other'))
  assert.equal(r.ok, false)
  assert.equal(r.error.code, 'access_denied')
  assert.match(r.error.detail, /no visible job/) // existing foreign-denial wording, no disclosure
  assert.equal(await snapshot(), before)
})

test('T6/R8: operator CLI path (control-layer disableJobOp) keeps full critical-disable authority', async (t) => {
  const { disableJobOp } = await import('../src/control.js')
  const inventory = await inventoryFile(t, criticalManifest())
  const { store, criticalSelfJob } = await rig(t, { inventoryPath: inventory })
  const updated = await disableJobOp(store, criticalSelfJob.id, { nowMs: Date.now() })
  assert.equal(updated.enabled, false, 'operator emergency stop preserved — no guard in the control layer')
})

test('T7/R9: scheduler.manage:any (exact admin proof) disables a critical job via self-service — allowed, semantics unchanged', async (t) => {
  const inventory = await inventoryFile(t, criticalManifest())
  const { call, criticalSelfJob, denialEvents } = await rig(t, { inventoryPath: inventory, adminAgents: new Set(['agt_admin']) })
  const r = await call('disable', { job_id: criticalSelfJob.id }, trusted('agt_admin'))
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.equal(r.result.enabled, false)
  assert.equal(denialEvents.length, 0)
})

test('T8: inventory malformed / unsupported version -> FAIL_CLOSED (critical_inventory_unavailable), even for non-critical jobs', async (t) => {
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

test('R5 (TOCTOU disable): unlocked snapshot non-critical -> locked current becomes critical -> DENIED, zero mutation (expected_revision omitted)', async (t) => {
  const inventory = await inventoryFile(t, criticalManifest())
  const { store, call, ordinaryJob, snapshot, denialEvents } = await rig(t, { inventoryPath: inventory })
  const before = await snapshot()
  // Mechanical race: the operator/backfill flips the job's logicalKey INSIDE
  // the locked mutation window (before the control op's own logic runs). The
  // unlocked snapshot the handler first saw still says non-critical.
  const originalMutate = store.mutateDoc.bind(store)
  let armed = true
  store.mutateDoc = async (fn) => originalMutate(async (latest) => {
    if (armed) {
      armed = false
      const j = latest.jobs.find((x) => x.id === ordinaryJob.id)
      if (j) j.logicalKey = CRITICAL_KEY
    }
    return fn(latest)
  })
  const r = await call('disable', { job_id: ordinaryJob.id }, trusted('agt_a'))
  assert.equal(r.ok, false, 'locked-current classification must deny')
  assert.match(r.error.detail, /critical_job_self_disable/)
  assert.equal(await snapshot(), before, 'zero store mutation')
  assert.equal(denialEvents.filter((e) => e.reason === CRITICAL_GUARD_REASONS.SELF_DISABLE).length, 1)
})

test('R6 (TOCTOU remove): same race on remove -> DENIED, zero mutation', async (t) => {
  const inventory = await inventoryFile(t, criticalManifest())
  const { store, call, ordinaryJob, snapshot } = await rig(t, { inventoryPath: inventory })
  const before = await snapshot()
  const originalMutate = store.mutateDoc.bind(store)
  let armed = true
  store.mutateDoc = async (fn) => originalMutate(async (latest) => {
    if (armed) {
      armed = false
      const j = latest.jobs.find((x) => x.id === ordinaryJob.id)
      if (j) j.logicalKey = CRITICAL_KEY
    }
    return fn(latest)
  })
  const r = await call('remove', { job_id: ordinaryJob.id }, trusted('agt_a'))
  assert.equal(r.ok, false)
  assert.match(r.error.detail, /critical_job_self_disable/)
  assert.equal(await snapshot(), before, 'job still exists — zero mutation')
})

test('R7: concurrent denied requests -> both denied, zero mutation', async (t) => {
  const inventory = await inventoryFile(t, criticalManifest())
  const { call, criticalSelfJob, snapshot, denialEvents } = await rig(t, { inventoryPath: inventory })
  const before = await snapshot()
  const results = await Promise.all([
    call('disable', { job_id: criticalSelfJob.id }, trusted('agt_hr')),
    call('disable', { job_id: criticalSelfJob.id }, trusted('agt_hr')),
    call('remove', { job_id: criticalSelfJob.id }, trusted('agt_hr')),
  ])
  for (const r of results) {
    assert.equal(r.ok, false)
    assert.match(r.error.detail, /critical_job_self_disable/)
  }
  assert.equal(await snapshot(), before)
  assert.equal(denialEvents.length, 3)
})

test('T9: denial evidence is durable + sanitized (runs.jsonl carries whitelisted attribution only, zero payload bytes)', async (t) => {
  const inventory = await inventoryFile(t, criticalManifest())
  const { call, criticalSelfJob, jobsDir } = await rig(t, { inventoryPath: inventory })
  await call('disable', { job_id: criticalSelfJob.id }, trusted('agt_hr'))
  const runs = await readFile(join(jobsDir, 'runs.jsonl'), 'utf8')
  const denial = runs.split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((e) => e.action === 'self_service_denied')
  assert.equal(denial.length, 1)
  assert.deepEqual(Object.keys(denial[0]).sort(), ['action', 'jobId', 'operation', 'operatorAgentId', 'reason', 'ts'])
  assert.equal(runs.includes('must-not-leak'), false, 'no payload/credential leakage in the evidence channel')
})

test('T10/R10: enable/list/runs/update zero regression — enable of a critical job by its owner stays ALLOWED (guard is disable/remove only)', async (t) => {
  const inventory = await inventoryFile(t, criticalManifest())
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

test('ZERO_STORE_MUTATION raw-bytes proof: denial leaves the store FILE byte-identical (mutateDoc abort leaves disk untouched)', async (t) => {
  const inventory = await inventoryFile(t, criticalManifest())
  const { call, criticalSelfJob, rawStoreBytes } = await rig(t, { inventoryPath: inventory })
  // settle initial state to disk
  await call('list', {}, trusted('agt_hr'))
  const before = await rawStoreBytes()
  await call('disable', { job_id: criticalSelfJob.id }, trusted('agt_hr'))
  await call('remove', { job_id: criticalSelfJob.id }, trusted('agt_hr'))
  assert.equal(await rawStoreBytes(), before, 'raw store file bytes unchanged')
})
