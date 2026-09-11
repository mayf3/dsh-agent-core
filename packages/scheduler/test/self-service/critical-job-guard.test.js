import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { JobStore } from '../../src/store.js'
import {
  createSelfServiceSchedulerAccess,
  parseCriticalInventory,
  evaluateCriticalJobGuard,
  CRITICAL_GUARD_REASONS,
  DEFAULT_CRITICAL_INVENTORY_PATH,
} from '../../src/self-service.js'
import {
  trusted,
  createCriticalGuardRig as rig,
  createSelfServiceRig,
  inventoryFile,
  criticalManifest,
  CRITICAL_KEY,
  createAtArgs,
  storedDefinitionDigest,
  assertExactCommittedResult,
} from './harness.js'

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
  const { disableJobOp } = await import('../../src/control.js')
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

test('ownership is rechecked inside the locked control mutation (TOCTOU fails closed)', async (t) => {
  const { call, store, grantCalls } = await createSelfServiceRig(t)
  const created = await call('create', { name: 'owned', logical_key: 'self-test:k1', schedule_kind: 'every', every_ms: 60_000, message: 'm' })
  const jobId = created.result.jobId
  const originalLoad = store.loadDoc.bind(store)
  let swapped = false
  store.loadDoc = async (...args) => {
    const snapshot = await originalLoad(...args)
    if (!swapped) {
      swapped = true
      await store.mutateDoc((doc) => { doc.jobs.find((job) => job.id === jobId).agentId = 'agt_b' })
    }
    return snapshot
  }
  const out = await call('update', { job_id: jobId, name: 'must-not-commit' })
  assert.equal(out.ok, false)
  assert.equal(out.error.code, 'access_denied')
  const doc = await originalLoad({ force: true })
  assert.equal(doc.jobs[0].agentId, 'agt_b')
  assert.equal(doc.jobs[0].name, 'owned')
  assert.deepEqual(grantCalls, [])
})

test('locked update preserves concurrently changed omitted fields and audits the exact preimage', async (t) => {
  const { call, store, dir } = await createSelfServiceRig(t)
  const created = await call('create', {
    name: 'merge', logical_key: 'self-test:merge', schedule_kind: 'every', every_ms: 60_000, message: 'old', timeout: 30,
  })
  const jobId = created.result.jobId
  const originalLoad = store.loadDoc.bind(store)
  let concurrentDefinition
  let injected = false
  store.loadDoc = async (...args) => {
    const snapshot = await originalLoad(...args)
    if (!injected) {
      injected = true
      await store.mutateDoc((doc) => {
        const job = doc.jobs.find((candidate) => candidate.id === jobId)
        job.payload.timeoutSeconds = 99
      })
      concurrentDefinition = (await originalLoad({ force: true })).jobs.find((job) => job.id === jobId)
    }
    return snapshot
  }
  const out = await call('update', { job_id: jobId, message: 'new' })
  assert.equal(out.ok, true)
  const finalJob = (await originalLoad({ force: true })).jobs.find((job) => job.id === jobId)
  assert.equal(finalJob.payload.message, 'new')
  assert.equal(finalJob.payload.timeoutSeconds, 99)
  const events = (await readFile(join(dir, 'runs.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)
  const updateAudit = events.findLast((event) => event.operation === 'update')
  assert.equal(updateAudit.beforeDigest, storedDefinitionDigest(concurrentDefinition))
})

test('live post-rename fault returns known committed projection and attempts one audit append', async (t) => {
  const { call, store } = await createSelfServiceRig(t)
  let syncCalls = 0
  let auditAttempts = 0
  store._syncDir = async () => { syncCalls += 1; throw new Error('injected directory sync failure after rename') }
  store.appendRunEvent = async () => { auditAttempts += 1; return { ok: true } }
  const out = await call('create', { name: 'durable', logical_key: 'self-test:k2', schedule_kind: 'every', every_ms: 60_000, message: 'm' })
  assert.equal(out.ok, true)
  assertExactCommittedResult(out.result)
  assert.equal(out.result.auditStatus, 'appended')
  assert.equal(syncCalls, 1)
  assert.equal(auditAttempts, 1)
  const doc = await store.loadDoc({ force: true })
  assert.equal(doc.jobs.some((job) => job.id === out.result.jobId), true)
})

test('pre-commit failure is known clean; uncertain commit failure is outcome-unknown with zero retry', async (t) => {
  const first = await createSelfServiceRig(t)
  first.store.beforeCommit = async () => { throw new Error('before commit') }
  const clean = await first.call('create', { name: 'clean-fail', logical_key: 'self-test:k3', schedule_kind: 'every', every_ms: 60_000, message: 'm' })
  assert.equal(clean.ok, false)
  assert.equal(clean.error.code, 'internal_error')
  assert.equal((await first.store.loadDoc({ force: true })).jobs.length, 0)

  const scopedReadFailure = await createSelfServiceRig(t)
  const scopedJob = await scopedReadFailure.call('create', {
    name: 'scoped-read', logical_key: 'self-test:scoped-read', schedule_kind: 'every', every_ms: 60_000, message: 'm',
  })
  scopedReadFailure.store.loadDoc = async () => { throw new Error('injected authorization snapshot failure') }
  const scopedKnown = await scopedReadFailure.call('update', { job_id: scopedJob.result.jobId, name: 'never' })
  assert.equal(scopedKnown.ok, false)
  assert.equal(scopedKnown.error.code, 'internal_error')

  const readFailure = await createSelfServiceRig(t)
  readFailure.store._loadDocForMutation = async () => { throw new Error('injected pre-write load failure') }
  const known = await readFailure.call('create', { name: 'read-fail', logical_key: 'self-test:k4', schedule_kind: 'every', every_ms: 60_000, message: 'm' })
  assert.equal(known.ok, false)
  assert.equal(known.error.code, 'internal_error')

  const lockFailure = await createSelfServiceRig(t)
  lockFailure.store._withLock = async () => { throw new Error('injected lock acquisition failure') }
  const noLock = await lockFailure.call('create', { name: 'lock-fail', logical_key: 'self-test:k5', schedule_kind: 'every', every_ms: 60_000, message: 'm' })
  assert.equal(noLock.ok, false)
  assert.equal(noLock.error.code, 'internal_error')

  const renameFailure = await createSelfServiceRig(t)
  renameFailure.store.beforeCommit = async () => { await mkdir(renameFailure.store.filePath) }
  const noRename = await renameFailure.call('create', {
    name: 'rename-fail', logical_key: 'self-test:rename-fail', schedule_kind: 'every', every_ms: 60_000, message: 'm',
  })
  assert.equal(noRename.ok, false)
  assert.equal(noRename.error.code, 'internal_error', 'a rejected commit-point rename proves no mutation')

  const second = await createSelfServiceRig(t)
  let attempts = 0
  second.store._writeAtomicDoc = async () => {
    attempts += 1
    throw Object.assign(new Error('rename outcome unavailable'), { mutationOutcome: 'unknown' })
  }
  const unknown = await second.call('create', { name: 'unknown', logical_key: 'self-test:k6', schedule_kind: 'every', every_ms: 60_000, message: 'm' })
  assert.equal(unknown.ok, false)
  assert.equal(unknown.error.code, 'mutation_outcome_unknown')
  assert.equal(attempts, 1)
})

test('audit append failure returns known committed result, logs sanitized coordinates, and does not retry', async (t) => {
  const { call, store, auditErrors } = await createSelfServiceRig(t, { auditFailure: true })
  let appendAttempts = 0
  store.appendRunEvent = async () => { appendAttempts += 1; return { ok: false, error: 'SECRET-MESSAGE' } }
  const created = await call('create', createAtArgs({ delivery_mode: 'none', delivery_target: undefined }))
  assert.equal(created.ok, true)
  assert.equal(created.result.auditStatus, 'append_failed')
  assertExactCommittedResult(created.result)
  assert.equal(appendAttempts, 1)
  assert.equal((await store.loadDoc({ force: true })).jobs.length, 1, 'known definition commit is not rolled back')
  assert.deepEqual(auditErrors, [{ operation: 'create', jobId: created.result.jobId }])
  assert.equal(JSON.stringify(auditErrors).includes('SECRET-MESSAGE'), false)
})

test('mutation audit is one sanitized append per committed mutation', async (t) => {
  const { call, dir } = await createSelfServiceRig(t)
  const created = await call('create', { name: 'x', logical_key: 'self-test:k7', schedule_kind: 'every', every_ms: 1000, message: 'TOP-SECRET' })
  await call('update', { job_id: created.result.jobId, name: 'y' })
  await call('disable', { job_id: created.result.jobId })
  await call('enable', { job_id: created.result.jobId })
  await call('remove', { job_id: created.result.jobId })
  const events = (await readFile(join(dir, 'runs.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)
  assert.deepEqual(events.map((event) => event.operation), ['create', 'update', 'disable', 'enable', 'remove'])
  assert.equal(events.every((event) => event.action === 'self_service_mutation'), true)
  assert.equal(events.every((event) => event.operatorAgentId === 'agt_a' && event.targetAgentId === 'agt_a'), true)
  assert.equal(JSON.stringify(events).includes('TOP-SECRET'), false)
})
