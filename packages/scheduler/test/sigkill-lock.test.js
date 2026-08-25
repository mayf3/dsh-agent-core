/**
 * SIGKILL_LOCK_FILE_WINDOW — independent reproduction + closure (PR #71 fix).
 *
 * The audited window: lock acquisition used a two-step `open(wx)` +
 * `writeFile`, so a SIGKILL between the two stranded a lock artifact with NO
 * owner identity. No process could mechanically prove that owner dead, so
 * the dead-owner reap never engaged and every later acquisition failed loud
 * forever (store bricked) — or, had the code guessed, a live owner's lock
 * could have been wrongly seized.
 *
 * These tests:
 *   1. reproduce the exact artifact a SIGKILL in that window produced and
 *      prove the old failure mode (no mechanical recovery, never seized,
 *      one bounded lock_unverifiable evidence event);
 *   2. prove the window is CLOSED: real concurrent acquirers killed at
 *      random instants can never leave an identity-less artifact, and a
 *      dead full-identity owner is reaped mechanically (never by time);
 *   3. run the required SEPARATE-PROCESS fault scenario: engine A is
 *      SIGKILLed while holding BOTH lock artifacts at the exact window;
 *      engine B recovers with a single owner, zero duplicate admissions, an
 *      intact store, no replay, and bounded lock_recovery evidence;
 *   4. prove a second live engine never admits (single-live-engine).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { JobStore } from '../src/store.js'
import { OwnerLock } from '../src/lock.js'
import { normalizeJob } from '../src/job-model.js'

const root = join(import.meta.dirname, '..', '..', '..')
const schedulerUrl = pathToFileURL(join(root, 'packages/scheduler/src/scheduler.js')).href
const storeUrl = pathToFileURL(join(root, 'packages/scheduler/src/store.js')).href

const deferred = () => {
  let resolve
  const promise = new Promise((yes) => { resolve = yes })
  return { promise, resolve }
}

function waitForOutput(child, marker, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    let output = ''
    const timeout = setTimeout(() => reject(new Error(`timed out waiting for ${marker}: ${output}`)), timeoutMs)
    child.stdout.on('data', (chunk) => {
      output += chunk
      if (!output.includes(marker)) return
      clearTimeout(timeout)
      resolve(output)
    })
    child.stderr?.on('data', (chunk) => { output += chunk })
    child.once('exit', (code, signal) => {
      if (!output.includes(marker)) {
        clearTimeout(timeout)
        reject(new Error(`child exited ${code}/${signal} before ${marker}: ${output}`))
      }
    })
  })
}

const killAndWait = async (child) => {
  const exited = deferred()
  child.once('exit', () => exited.resolve())
  child.kill('SIGKILL')
  await exited.promise
}

const parseOwner = (raw) => {
  try { return JSON.parse(raw) } catch { return null }
}

// ── 1. the audited window, reproduced ─────────────────────────────────────

test('SIGKILL_LOCK_WINDOW_REPRODUCED: identity-less artifact has no mechanical recovery and is never seized', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sigkill-window-'))
  const file = join(dir, 'jobs.json')
  const store = new JobStore(file)
  await store.mutateDoc((doc) => { doc.jobs.push({ id: 'seed' }) })

  // Child performs the PRE-FIX acquisition step verbatim — `open(wx)` first,
  // identity written only afterwards — and is SIGKILLed inside that window.
  // The resulting artifact is byte-identical to what the pre-fix code left.
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import { promises as fs } from 'node:fs';
    const handle = await fs.open(process.argv[1], 'wx');  // artifact created — EMPTY
    process.stdout.write('CREATED\\n');
    setInterval(() => {}, 1000);                          // SIGKILL lands before identity write
  `, `${file}.lock`], { stdio: ['ignore', 'pipe', 'pipe'] })
  await waitForOutput(child, 'CREATED')
  await killAndWait(child)

  const raw = readFileSync(`${file}.lock`, 'utf8')
  assert.equal(raw, '', 'artifact is identity-less (the audited window outcome)')
  const owner = parseOwner(raw)
  assert.equal(owner, null)
  assert.equal(new OwnerLock(`${file}.lock`).ownerAlive(owner?.pid), null,
    'no pid -> death can NEVER be proven mechanically')

  // Peer cannot recover and NEVER seizes the artifact: fail loud on timeout,
  // twice; the artifact survives; one bounded evidence event per attempt.
  const peer = new JobStore(file, { lockTimeoutMs: 250 })
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await assert.rejects(() => peer.mutateDoc((doc) => { doc.jobs.push({ id: `peer-${attempt}` }) }),
      /held by a live or unverifiable owner/)
  }
  assert.equal(readFileSync(`${file}.lock`, 'utf8'), '', 'identity-less artifact never removed (no wrongful seizure)')
  const events = await peer.readRunEvents()
  const unverifiable = events.filter((event) => event.action === 'lock_unverifiable')
  assert.equal(unverifiable.length, 2, 'exactly one bounded lock_unverifiable evidence event per acquisition attempt')
  assert.equal(unverifiable[0].contentSnapshot, '')
  const doc = await peer.loadDoc({ force: true })
  assert.deepEqual(doc.jobs.map((job) => job.id), ['seed'], 'store content untouched by the failed peers')
})

// ── 2. the window is closed: atomic identity publish ──────────────────────

test('SIGKILL_LOCK_WINDOW_CLOSED: concurrent acquirers killed at random instants never leave an identity-less artifact', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sigkill-window-closed-'))
  const lockPath = join(dir, 'jobs.json.lock')

  const childSource = `
    import { OwnerLock } from ${JSON.stringify(pathToFileURL(join(root, 'packages/scheduler/src/lock.js')).href)};
    const lock = new OwnerLock(process.argv[1]);
    for (;;) {
      const token = await lock.acquire();
      await new Promise((resolve) => setTimeout(resolve, 5 + Math.floor(Math.random() * 20)));
      await lock.release(token);
    }
  `
  const children = [0, 1, 2].map(() => spawn(
    process.execPath, ['--input-type=module', '-e', childSource, lockPath],
    { stdio: ['ignore', 'ignore', 'pipe'] }, // hammer children: stdout unused
  ))

  // Continuously sample the artifact: whenever it EXISTS it must carry a
  // full parseable owner identity (pid + token) — the closed-window
  // invariant. Identity-less states are unrepresentable via link() publish.
  const deadline = Date.now() + 1_500
  let samples = 0
  while (Date.now() < deadline && children.some((child) => child.exitCode === null)) {
    try {
      const raw = readFileSync(lockPath, 'utf8')
      const owner = parseOwner(raw)
      samples += 1
      assert.ok(owner !== null && Number.isSafeInteger(owner.pid) && owner.pid > 0 && typeof owner.token === 'string',
        `lock artifact observed without full owner identity: ${JSON.stringify(raw)}`)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 3))
  }
  assert.ok(samples > 20, `sampled the artifact ${samples} times`)

  // Kill the acquirers at random instants (mid-acquire, mid-hold, mid-release).
  // Exit listeners attach BEFORE the kill so a fast exit can never be missed.
  const exits = children.map((child) => new Promise((resolve) => child.once('exit', resolve)))
  const killAt = [Date.now() + 100, Date.now() + 400, Date.now() + 900]
  for (let index = 0; index < children.length; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, killAt[index] - Date.now())))
    if (children[index].exitCode === null) children[index].kill('SIGKILL')
  }
  await Promise.all(exits)

  // Post-mortem: if a holder was killed mid-hold, the surviving artifact
  // still carries identity; the next owner acquires via MECHANICAL dead-pid
  // reap (never time) and the reap leaves bounded evidence.
  const events = []
  const lock = new OwnerLock(lockPath, { timeoutMs: 5_000, onEvidence: (event) => events.push(event) })
  const token = await lock.acquire()
  assert.ok(token)
  await lock.release(token)
  const reaped = events.filter((event) => event.action === 'lock_recovery')
  if (existsSync(lockPath) === false && reaped.length === 0) {
    // last child died between acquire and hold — artifact absent, clean acquire
  } else {
    const ownerReaps = reaped.filter((event) => event.outcome === 'dead-owner-reaped')
    assert.ok(ownerReaps.length >= 1, 'dead full-identity owner was reaped mechanically')
    for (const event of ownerReaps) {
      assert.ok(Number.isSafeInteger(event.deadPid) && event.deadPid > 0, 'reap names the mechanically-proven dead pid')
    }
    for (const event of reaped.filter((e) => e.outcome === 'dead-reaper-marker-reclaimed')) {
      assert.ok(Number.isSafeInteger(event.deadPid) && event.deadPid > 0,
        'a SIGKILLed reaper marker was itself reclaimed only on mechanical proof')
    }
  }
})

// ── 3. the required separate-process fault scenario ───────────────────────

test('SIGKILL_EXACT_LOCK_WINDOW_SEPARATE_PROCESS: engine A killed at the lock window; engine B recovers as sole owner, no duplicate admission, no replay', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sigkill-exact-window-'))
  const file = join(dir, 'jobs.json')
  const callsA = join(dir, 'calls-a.jsonl')
  const callsB = join(dir, 'calls-b.jsonl')
  const callsB2 = join(dir, 'calls-b2.jsonl')
  const now = Date.now()
  const job = normalizeJob({
    id: 'due-one-shot', name: 'due one-shot', agentId: 'agent-a',
    schedule: { kind: 'at', at: new Date(now + 1_200).toISOString() },
    payload: { kind: 'agentTurn', message: 'work' }, delivery: { mode: 'none' },
    deleteAfterRun: false,
  }, { nowMs: now })
  const seed = new JobStore(file)
  await seed.mutateDoc((doc) => { doc.jobs = [structuredClone(job)] })

  // Engine A: starts (takes the ENGINE lease), then takes the MUTATION lock
  // and parks — killed exactly while owning both lock artifacts.
  const childSource = (callsPath, { catchup = false } = {}) => `
    import { Scheduler } from ${JSON.stringify(schedulerUrl)};
    import { JobStore } from ${JSON.stringify(storeUrl)};
    import { appendFileSync } from 'node:fs';
    const store = new JobStore(process.argv[1]);
    const invoke = async (request) => {
      appendFileSync(process.argv[2], JSON.stringify({ occurrenceId: request.occurrenceId }) + '\\n');
      return { status: 'ok', summary: 'done' };
    };
    invoke.assertRunnable = () => true;
    const scheduler = new Scheduler({ store, invoker: invoke });
    await scheduler.start({ autoStart: false, catchup: ${catchup ? 'true' : 'false'} });
    ${callsPath === undefined
      ? `await store._mutationLock.acquire(); // park owning BOTH lock artifacts
         setInterval(() => {}, 1000);`
      : "process.stdout.write('HOLDING\\n'); await new Promise((r) => setTimeout(r, 400)); await scheduler.stop(); process.stdout.write('DONE\\n');"}
  `
  const engineA = spawn(process.execPath, ['--input-type=module', '-e', childSource(), file], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
  })
  const aOutputDeferred = deferred()
  let aOutput = ''
  engineA.stdout.on('data', (chunk) => { aOutput += chunk })
  engineA.stderr.on('data', (chunk) => { aOutput += chunk })
  engineA.once('exit', () => aOutputDeferred.resolve())
  // Wait until BOTH artifacts exist carrying A's pid (A parks holding them);
  // the artifacts appear asynchronously right after A's start().
  const aPid = engineA.pid
  const readOwnerSafe = (lockPath) => {
    try { return parseOwner(readFileSync(lockPath, 'utf8')) } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  }
  const deadline = Date.now() + 5_000
  for (;;) {
    if (engineA.exitCode !== null) throw new Error(`engine A exited early (${engineA.exitCode}): ${aOutput}`)
    const engineOwner = readOwnerSafe(`${file}.engine.lock`)
    const mutationOwner = readOwnerSafe(`${file}.lock`)
    if (engineOwner?.pid === aPid && mutationOwner?.pid === aPid) break
    if (Date.now() > deadline) throw new Error(`engine A never owned both lock artifacts: ${engineOwner?.pid}/${mutationOwner?.pid} — ${aOutput}`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  // The at-slot becomes due while A is parked (downtime), then A is killed
  // at the exact window (owning both artifacts, admission never attempted).
  await new Promise((resolve) => setTimeout(resolve, 1_400))
  assert.equal(existsSync(callsA), false, 'engine A never invoked (parked at the lock window)')
  await killAndWait(engineA)

  // Engine B (separate process): must mechanically prove A dead, reap BOTH
  // locks, recover the store, and admit the due slot exactly once.
  const engineB = spawn(process.execPath, ['--input-type=module', '-e', childSource(callsB, { catchup: true }), file, callsB], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
  })
  await waitForOutput(engineB, 'HOLDING')
  const engineOwnerDuringB = parseOwner(readFileSync(`${file}.engine.lock`, 'utf8'))
  assert.equal(engineOwnerDuringB.pid, engineB.pid, 'exactly ONE owner during recovery: engine B')
  const bExit = new Promise((resolve) => engineB.once('exit', resolve))
  await waitForOutput(engineB, 'DONE')
  await bExit

  // Store integrity + single admission + no duplicate
  const verifier = new JobStore(file)
  const doc = await verifier.loadDoc({ force: true })
  assert.equal(doc.version, 2, 'document intact and valid')
  const records = doc.occurrences.filter((record) => record.jobId === job.id)
  assert.equal(records.length, 1, 'exactly one occurrence record (duplicate admission = 0)')
  assert.equal(records[0].kind, 'catchup', 'native downtime catch-up occurrence')
  assert.ok(['succeeded', 'running', 'admitted'].includes(records[0].state), `state settled: ${records[0].state}`)
  assert.equal(readFileSync(callsB, 'utf8').trim().split('\n').filter(Boolean).length, 1,
    'engine B invoked the due occurrence exactly once')

  // Bounded recovery evidence: A's dead pid reaped on both lock artifacts.
  const events = await verifier.readRunEvents()
  const recoveries = events.filter((event) => event.action === 'lock_recovery')
  assert.ok(recoveries.length >= 2, `both lock artifacts reaped with evidence: ${recoveries.length}`)
  for (const event of recoveries) {
    assert.equal(event.deadPid, aPid, 'reap evidence names the mechanically-proven dead owner (engine A)')
    assert.equal(event.outcome, 'dead-owner-reaped')
  }

  // No replay: engine B2 restarts on the recovered store — zero new admissions.
  const engineB2 = spawn(process.execPath, ['--input-type=module', '-e', `
    import { Scheduler } from ${JSON.stringify(schedulerUrl)};
    import { JobStore } from ${JSON.stringify(storeUrl)};
    import { appendFileSync } from 'node:fs';
    const store = new JobStore(process.argv[1]);
    const invoke = async (request) => {
      appendFileSync(process.argv[2], JSON.stringify({ occurrenceId: request.occurrenceId }) + '\\n');
      return { status: 'ok', summary: 'done' };
    };
    invoke.assertRunnable = () => true;
    const scheduler = new Scheduler({ store, invoker: invoke });
    await scheduler.start({ autoStart: false, catchup: true });
    await scheduler.tick();
    await scheduler.whenIdle();
    await scheduler.stop();
    process.stdout.write('DONE2\\n');
  `, file, callsB2], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
  await waitForOutput(engineB2, 'DONE2')
  const doc2 = await new JobStore(file).loadDoc({ force: true })
  assert.equal(doc2.occurrences.filter((record) => record.jobId === job.id).length, 1,
    'restart replayed nothing (same single occurrence record)')
  assert.equal(existsSync(callsB2), false, 'restart invoked nothing')

  // Final lock state: B stopped cleanly -> lease released -> no engine lock;
  // mutation lock likewise absent between mutations.
  assert.equal(existsSync(`${file}.engine.lock`), false, 'engine lease released on clean stop')
})

// ── 4. single live engine ─────────────────────────────────────────────────

test('SINGLE_LIVE_ENGINE: a second engine fails loud and never admits; after the owner dies the next engine recovers', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sigkill-single-engine-'))
  const file = join(dir, 'jobs.json')

  // Engine A (live) holds the engine lease.
  const engineA = spawn(process.execPath, ['--input-type=module', '-e', `
    import { Scheduler } from ${JSON.stringify(schedulerUrl)};
    import { JobStore } from ${JSON.stringify(storeUrl)};
    const invoke = async () => ({ status: 'ok', summary: 'done' });
    invoke.assertRunnable = () => true;
    const scheduler = new Scheduler({ store: new JobStore(process.argv[1]), invoker: invoke });
    await scheduler.start({ autoStart: false, catchup: false });
    process.stdout.write('HOLDING\\n');
    setInterval(() => {}, 1000);
  `, file], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
  await waitForOutput(engineA, 'HOLDING')

  // Engine B (separate process) must fail loud: the lease is held by a LIVE
  // owner — no time-threshold seizure, no admission.
  const engineB = spawn(process.execPath, ['--input-type=module', '-e', `
    import { Scheduler } from ${JSON.stringify(schedulerUrl)};
    import { JobStore } from ${JSON.stringify(storeUrl)};
    const invoke = async () => { process.exit(77); };  // must never be called
    invoke.assertRunnable = () => true;
    const scheduler = new Scheduler({ store: new JobStore(process.argv[1], { lockTimeoutMs: 500 }), invoker: invoke });
    await scheduler.start({ autoStart: false, catchup: true });
    await scheduler.tick();
  `, file], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
  let bOutput = ''
  engineB.stderr.on('data', (chunk) => { bOutput += chunk })
  const bExit = new Promise((resolve) => engineB.once('exit', (code) => resolve(code)))
  assert.notEqual(await bExit, 77, 'second engine never admitted anything')
  assert.match(bOutput, /held by a live or unverifiable owner/, 'second engine failed loud on the live lease')

  // A is still the sole owner; kill it, then engine C recovers mechanically.
  const aPid = engineA.pid
  assert.equal(parseOwner(readFileSync(`${file}.engine.lock`, 'utf8')).pid, aPid)
  await killAndWait(engineA)
  const engineC = spawn(process.execPath, ['--input-type=module', '-e', `
    import { Scheduler } from ${JSON.stringify(schedulerUrl)};
    import { JobStore } from ${JSON.stringify(storeUrl)};
    const invoke = async () => ({ status: 'ok', summary: 'done' });
    invoke.assertRunnable = () => true;
    const scheduler = new Scheduler({ store: new JobStore(process.argv[1], { lockTimeoutMs: 5_000 }), invoker: invoke });
    await scheduler.start({ autoStart: false, catchup: true });
    await scheduler.stop();
    process.stdout.write('RECOVERED\\n');
  `, file], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
  await waitForOutput(engineC, 'RECOVERED')
  const events = await new JobStore(file).readRunEvents()
  assert.ok(events.some((event) => event.action === 'lock_recovery' && event.deadPid === aPid),
    'engine C recovered the dead engine lease with bounded evidence')
})
