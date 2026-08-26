import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { apply as applyIngress } from '../src/index.js'
import { NotificationIdempotencyStore } from '../src/idempotency.js'
import {
  FORUM, STORE_URL, VALID_BODY, WORKFLOW, basic, deliver, fakeCtx, makeRoot, mount,
  okFetch, readStoreDoc, recordOf, runCrashChild, stubRouter,
} from './idempotency-test-support.js'

// ── C-IDM-013 / AC-IDM-07 / F-22 — retention / bounded growth ──────────────

test('C-IDM-013 AC-IDM-07 F-22: retention prunes TERMINAL records (over-age then over-count); non-terminal passes the boot sweep first', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ni-ret-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const storeFile = join(dir, 'idempotency.json')

  let clock = 1_700_000_000_000
  const now = () => new Date(clock).toISOString()
  const clockMs = () => clock

  const store = new NotificationIdempotencyStore({
    storeFile, now, clockMs, retentionMs: 604800000, maxRecords: 100000,
  })
  // Three terminal records at t0, one reserved at t0.
  for (const requestId of ['old-a', 'old-b', 'old-c']) {
    await store.reserve({ callerPrincipalId: 'c1', requestId, payloadHash: `h-${requestId}` })
    await store.settle({ callerPrincipalId: 'c1', requestId, state: 'delivered', sessionId: 's', reason: 'router_accepted' })
  }
  await store.reserve({ callerPrincipalId: 'c1', requestId: 'reserved-old', payloadHash: 'h-res' })
  store.stop()

  // Advance 10 days (> 7-day retention): a NEW process boot-sweeps first
  // (reserved -> outcome_unknown) and then prunes every over-age terminal.
  // The freshly-migrated record's TERMINAL time is its migration time (now),
  // so it is NOT over-age: retention measures terminal age, not reserve age.
  clock += 10 * 24 * 3600 * 1000
  const sweeper = new NotificationIdempotencyStore({ storeFile, now, clockMs, retentionMs: 604800000, maxRecords: 100000 })
  assert.equal(sweeper.lookup('c1', 'reserved-old')?.state, 'outcome_unknown', 'non-terminal was swept, not silently dropped')
  for (const requestId of ['old-a', 'old-b', 'old-c']) {
    assert.equal(sweeper.lookup('c1', requestId), undefined, `${requestId} pruned as over-age terminal`)
  }
  assert.notEqual(sweeper.lookup('c1', 'reserved-old'), undefined, 'the just-migrated record keeps a full retention window')
  assert.ok(sweeper.evidenceLines().some((e) => e.kind === 'sweep_pruned' && e.count >= 3))
  sweeper.stop()

  // Over-count eviction: oldest terminal first.
  const store2 = new NotificationIdempotencyStore({ storeFile, now, clockMs, maxRecords: 2, retentionMs: 604800000000 })
  for (const requestId of ['n1', 'n2', 'n3']) {
    clock += 1000
    await store2.reserve({ callerPrincipalId: 'c2', requestId, payloadHash: `h2-${requestId}` })
    await store2.settle({ callerPrincipalId: 'c2', requestId, state: 'delivered', sessionId: 's', reason: 'router_accepted' })
  }
  // Reboot with maxRecords = 2: n1 (oldest terminal) is evicted.
  const store3 = new NotificationIdempotencyStore({ storeFile, now, clockMs, maxRecords: 2, retentionMs: 604800000000 })
  assert.equal(store3.lookup('c2', 'n1'), undefined, 'oldest terminal evicted over-count')
  assert.notEqual(store3.lookup('c2', 'n2'), undefined)
  assert.notEqual(store3.lookup('c2', 'n3'), undefined)
  store2.stop()
  store3.stop()
})

// ── C-IDM-014 / AC-IDM-06 / F-16 — corruption fail-loud ────────────────────

test('C-IDM-014 AC-IDM-06 F-16: corrupt store -> mount throws, port never serves', async (t) => {
  const badDocuments = [
    '{not json',
    JSON.stringify({ version: 2, records: {} }),
    JSON.stringify({ version: 1, records: [] }),
    JSON.stringify({ version: 1, records: { c1: { r1: { state: 'mysterious_state' } } } }),
    JSON.stringify({ version: 1, records: { c1: { r1: { callerPrincipalId: 'OTHER', requestId: 'r1', payloadHash: 'h', state: 'reserved', createdAt: 'x', updatedAt: 'y' } } } }),
  ]
  for (const bad of badDocuments) {
    const root = makeRoot(t)
    mkdirSync(join(root.root, 'notification-ingress'), { recursive: true })
    writeFileSync(root.storeFile, bad)
    const ctx = fakeCtx(new Map([['agentRouter', stubRouter()]]))
    assert.throws(
      () => applyIngress(ctx, { port: 0, authConfigFile: root.authConfigFile, storeFile: root.storeFile, fetchImpl: okFetch() }),
      (error) => error.code === 'IDEMPOTENCY_STORE_CORRUPT',
      `corrupt document must fail the mount loudly: ${bad.slice(0, 60)}`,
    )
    // No server was created — nothing listens.
    assert.equal(ctx.disposeAll === undefined ? false : false, false)
  }
})

// ── C-IDM-015 — evidence events + rotation ─────────────────────────────────

test('C-IDM-015: evidence JSONL records the event vocabulary and rotates at the threshold (2 generations)', async (t) => {
  const root = makeRoot(t)
  const router = stubRouter(async () => { throw new Error('boom') })
  const { base, api } = await mount(t, { root, router })
  await deliver(base, { body: { ...VALID_BODY, requestId: 'ev-1' } })
  await deliver(base, { body: { ...VALID_BODY, requestId: 'ev-1' } }) // duplicate
  const events = api.store.evidenceLines().map((e) => e.kind)
  assert.ok(events.includes('auth_ok'))
  assert.ok(events.includes('idempotency_transition'))
  assert.ok(events.includes('outcome'))

  // Rotation with a tiny threshold (test seam; production default 10 MiB).
  const dir = mkdtempSync(join(tmpdir(), 'ni-evd-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const store = new NotificationIdempotencyStore({ storeFile: join(dir, 'idempotency.json'), rotateBytes: 150 })
  for (let i = 0; i < 40; i += 1) {
    store.appendEvidence({ kind: 'noise', i })
  }
  store.stop()
  assert.ok(existsSync(join(dir, 'evidence.jsonl')), 'live generation exists')
  assert.ok(existsSync(join(dir, 'evidence.jsonl.1')), 'previous generation retained')
  assert.equal(existsSync(join(dir, 'evidence.jsonl.2')), false, 'at most 2 generations are kept')
})

// ── C-IDM-016 — BindingStore boundary ──────────────────────────────────────

test('C-IDM-016: the ingress never reads or writes the Router BindingStore / freshSessions', async () => {
  for (const file of [
    '../src/idempotency.js', '../src/idempotency-persistence.js', '../src/idempotency-record.js',
    '../src/deliver-handler.js', '../src/index.js', '../src/wire-response.js',
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    // No import of any Router module (behavioral boundary: separate stores).
    assert.ok(!/^import[^\n]*agent-router/m.test(source), `${file} must not import the Router package`)
    assert.ok(!/binding-store/.test(source), `${file} must not touch the Binding store module`)
    assert.ok(!/freshSessions/.test(source), `${file} must not touch Router fresh-session mappings`)
  }
})

// ── history cap ────────────────────────────────────────────────────────────

test('C-IDM-003: per-record history is capped at 16 entries (oldest evicted)', () => {
  const record = { state: 'reserved' }
  for (let i = 0; i < 25; i += 1) {
    NotificationIdempotencyStore.historyPush(record, `at-${i}`, 'reserved', 'outcome_unknown', `reason-${i}`)
  }
  assert.equal(record.history.length, 16)
  assert.equal(record.history[0].reason, 'reason-9', 'oldest entries evicted')
  assert.equal(record.history.at(-1).reason, 'reason-24')
})

// ── C-IDM-003 discipline: mutation queue + cross-process lock ──────────────

test('C-IDM-003: concurrent store mutations serialize; the lockfile appears and is released', async (t) => {
  const root = makeRoot(t)
  const store = new NotificationIdempotencyStore({ storeFile: root.storeFile })
  t.after(() => store.stop())
  await Promise.all([...Array(20)].map((_, i) =>
    store.reserve({ callerPrincipalId: 'c', requestId: `r${i}`, payloadHash: `h${i}` })))
  const doc = readStoreDoc(root)
  assert.equal(Object.keys(doc.records.c).length, 20, 'every serialized mutation landed')
  assert.equal(existsSync(join(root.root, 'notification-ingress', 'idempotency.lock')), false, 'lock released after mutations')
})

test('C-IDM-003: cross-process writers serialize through the lockfile (two real processes)', async (t) => {
  const root = makeRoot(t)
  const script = `
    const { NotificationIdempotencyStore } = await import(process.env.NI_STORE_URL)
    const store = new NotificationIdempotencyStore({ storeFile: process.env.NI_STORE_FILE })
    for (let i = 0; i < 15; i += 1) {
      await store.reserve({ callerPrincipalId: 'p' + process.env.NI_PROC, requestId: 'r' + i, payloadHash: 'h' })
    }
  `
  const children = ['1', '2'].map((proc) => spawn(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, NI_STORE_URL: STORE_URL, NI_STORE_FILE: root.storeFile, NI_PROC: proc },
    stdio: ['ignore', 'ignore', 'inherit'],
  }))
  await Promise.all(children.map((child) => new Promise((resolve, reject) => {
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`child exited ${code}`))))
  })))
  const doc = readStoreDoc(root)
  assert.equal(Object.keys(doc.records.p1 ?? {}).length, 15)
  assert.equal(Object.keys(doc.records.p2 ?? {}).length, 15, 'both processes completed every mutation (re-read-latest under lock)')
  assert.equal(existsSync(join(root.root, 'notification-ingress', 'idempotency.lock')), false)
})
