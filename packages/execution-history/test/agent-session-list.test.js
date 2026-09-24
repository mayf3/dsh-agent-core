/**
 * SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1 — `agent_session_list`
 * (MY_SESSIONS) acceptance tests over the isolated fixture root (zero
 * production side-effects).
 *
 *  T1        session identity collision: bare sessionId is never a global key
 *  T6        restart/rebuild: the listing is stable across index deletion
 *  T7        privacy: the listing is self-only and coordinate-only
 *  B2        journals created after the index are discovered
 *  C1/C2     caller-subtree scan only (no fleet index build/read, no fleet cap)
 *  C5        non-finite cursor timestamps are rejected
 *  F1        authoritative pagination validation (core + direct parent-RPC)
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, linkSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { queryExecutionTrace, listAgentSessions } from '../src/index.js'
import { buildFixtureRoot, destroyFixtureRoot, OCC_ID } from './fixtures.js'

const SELF_A = { agentId: 'agt_a', audit: false }
const PROJ_KEY = '--Users-fixture--'

function indexDirOf(fixture) {
  return join(fixture.paths.controlDir, 'execution-history-index')
}

// ── T1 ───────────────────────────────────────────────────────────────────────

test('T1: both agents own a session literally named main — listing is per-agent, never a bare-sessionId global key', () => {
  const fixture = buildFixtureRoot()
  try {
    const forA = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_a' })
    assert.equal(forA.ok, true)
    const idsA = forA.result.sessions.map((s) => s.sessionId)
    assert.ok(idsA.includes('main'), 'agt_a sees its own main')
    assert.equal(idsA.filter((id) => id === 'main').length, 1, 'exactly one main — the caller\'s own')
    assert.equal(forA.result.agentId, 'agt_a')

    const forHr = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(forHr.ok, true)
    const idsHr = forHr.result.sessions.map((s) => s.sessionId)
    assert.ok(idsHr.includes('main'), 'agt_hr sees its own main with the SAME bare id — collision handled by (agentId, sessionId)')
    assert.ok(idsHr.some((id) => id.startsWith('cron-run-')), 'agt_hr sees its scheduler session')

    // Cross-agent session query stays forbidden (self scope).
    return queryExecutionTrace({
      root: 'agent_session', args: { agentId: 'agt_hr', sessionId: 'main' }, viewer: SELF_A, paths: fixture.paths,
    }).then((cross) => {
      assert.equal(cross.ok, false)
      assert.equal(cross.code, 'forbidden_not_owner')
    })
  } finally { destroyFixtureRoot(fixture) }
})

// ── T6 ───────────────────────────────────────────────────────────────────────

test('T6: restart/rebuild — deleting the derived index changes nothing in the listing (rebuilt from durable journals)', () => {
  const fixture = buildFixtureRoot()
  try {
    const before = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(before.ok, true)
    rmSync(indexDirOf(fixture), { recursive: true, force: true })
    const after = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(after.ok, true)
    assert.deepEqual(after.result.sessions, before.result.sessions, 'index is a rebuildable view, not evidence')
  } finally { destroyFixtureRoot(fixture) }
})

// ── T7 ───────────────────────────────────────────────────────────────────────

test('T7: privacy — the listing is self-only and coordinate-only (no content fields ever)', () => {
  const fixture = buildFixtureRoot()
  try {
    const forA = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_a' })
    assert.equal(forA.ok, true)
    const serialized = JSON.stringify(forA.result)
    assert.ok(!serialized.includes('private user text'), 'no journal content leaks')
    assert.ok(!serialized.includes('HR private diary'), 'no foreign content leaks')
    assert.ok(!serialized.includes('agt_hr'), 'no foreign coordinates leak')
    for (const row of forA.result.sessions) {
      assert.ok(!('content' in row) && !('messages' in row) && !('text' in row), 'coordinate-only shape')
    }
    // Foreign caller identity is fail-closed, never an enumeration.
    const bad = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'not-an-agent' })
    assert.equal(bad.ok, false)
    assert.equal(bad.code, 'forbidden_not_owner')
  } finally { destroyFixtureRoot(fixture) }
})

// ── B2 (PR #318 review): journals created after the index must be discovered ─

test('B2: a journal created after the index exists is discovered by the next listing (NEW_SESSION_JOURNAL_CREATED)', () => {
  const fixture = buildFixtureRoot()
  try {
    const before = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(before.ok, true)
    const beforeIds = before.result.sessions.map((s) => s.sessionId)
    assert.ok(!beforeIds.includes('fresh-after-index'), 'pre-condition: new session does not exist yet')

    // Create a NEW journal; touch NO previously listed journal.
    mkdirSync(join(fixture.paths.homesRoot, 'agt_hr', 'sessions', PROJ_KEY, 'fresh-after-index'), { recursive: true })
    writeFileSync(join(fixture.paths.homesRoot, 'agt_hr', 'sessions', PROJ_KEY, 'fresh-after-index', 'session.jsonl'), [
      JSON.stringify({ type: 'session', version: 0, id: 'fresh-after-index', createdAt: 42, cwd: '/w' }),
    ].join('\n') + '\n')

    const after = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(after.ok, true)
    assert.ok(after.result.sessions.some((s) => s.sessionId === 'fresh-after-index'), 'new journal MUST appear')
  } finally { destroyFixtureRoot(fixture) }
})

// ── C1/C2 (GitHub fresh review @ d25ae108): caller-scoped scan, no fleet index ─

test('C1/C2: the listing scans ONLY the caller subtree — it never builds or reads the fleet-wide index and never inherits its cap', () => {
  const fixture = buildFixtureRoot()
  try {
    // No index exists at all; the listing must still succeed WITHOUT creating
    // one (a caller must not be able to trigger a fleet-wide journal scan).
    const out = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(out.ok, true)
    assert.equal(out.result.sessions.length, 2, 'caller sessions enumerated completely from the caller subtree')
    assert.ok(!existsSync(join(indexDirOf(fixture), 'sessions.idx.jsonl')), 'listing must not create the fleet-wide index file')

    // Even a deliberately stale/poisoned fleet index (zero caller entries) is
    // irrelevant: the listing enumerates the caller subtree independently, so
    // no global cap can truncate the caller's own sessions.
    mkdirSync(indexDirOf(fixture), { recursive: true })
    writeFileSync(join(indexDirOf(fixture), 'sessions.idx.jsonl'), JSON.stringify({ v: 2, agentId: 'agt_other', sessionId: 'main', file: '/nonexistent', coordinates: {} }) + '\n')
    const poisoned = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(poisoned.ok, true)
    assert.equal(poisoned.result.sessions.length, 2, 'caller listing unaffected by fleet index contents/cap')
  } finally { destroyFixtureRoot(fixture) }
})

// ── C5 (GitHub fresh review @ d25ae108): non-finite cursor timestamps ───────

test('C5: a base64url cursor decoding to a non-finite timestamp is rejected, never a repeating first page', () => {
  const fixture = buildFixtureRoot()
  try {
    // base64url('NaN:main') — syntactically valid cursor, non-finite atMs.
    const out = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr', cursor: 'TmFOOm1haW4' })
    assert.equal(out.ok, false)
    assert.equal(out.code, 'invalid_arguments')
  } finally { destroyFixtureRoot(fixture) }
})

// ── F1 (PR #318 review): authoritative pagination validation in the core ────

test('F1: listing core rejects invalid pagination (no clamping, no silent drop)', async () => {
  const fixture = buildFixtureRoot()
  try {
    const base = { homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' }
    for (const bad of [{ limit: 0 }, { limit: 201 }, { limit: 1.5 }, { limit: '10' }, { limit: null }, { cursor: 5 }, { cursor: {} }, { cursor: [] }, { cursor: '' }]) {
      const out = listAgentSessions({ ...base, ...bad })
      assert.equal(out.ok, false, `expected invalid_arguments for ${JSON.stringify(bad)}`)
      assert.equal(out.code, 'invalid_arguments')
    }
    // Valid faces unchanged: absent, explicit null cursor, and 1..200 integers.
    for (const good of [{}, { cursor: null }, { limit: 1 }, { limit: 200 }]) {
      const out = listAgentSessions({ ...base, ...good })
      assert.equal(out.ok, true, `expected ok for ${JSON.stringify(good)}`)
    }
  } finally { destroyFixtureRoot(fixture) }
})

// ── F1 (PR #318 review): trusted handler = authoritative validation boundary ─

test('F1: direct parent-RPC calls to the trusted handler fail closed on invalid pagination (never clamped or dropped)', async () => {
  const fixture = buildFixtureRoot()
  try {
    const { createExecutionHistoryRuntime } = await import('../../production-runtime/src/execution-history/runtime.js')
    const runtime = createExecutionHistoryRuntime({
      layout: {
        homesRoot: fixture.paths.homesRoot,
        controlDir: fixture.paths.controlDir,
        historyDir: fixture.paths.historyDir,
        jobsStore: fixture.paths.jobsStore,
        workflowExecutionDir: fixture.paths.workflowExecutionDir,
        evidenceLog: fixture.paths.evidenceLog,
      },
      credentialsFile: '/dev/null', authServiceOrigin: '', log: {},
    })
    const providers = new Map()
    runtime.mount({ provide: (k, v) => providers.set(k, v) })
    const list = providers.get('executionHistoryAccess').handlers.agent_session_list.list

    const invalid = [
      { limit: 0 }, { limit: 201 }, { limit: 1.5 }, { limit: '10' }, { limit: null },
      { cursor: 5 }, { cursor: {} }, { cursor: [] }, { cursor: '' },
      { unknown: 1 }, { limit: 5, other: true },
    ]
    for (const args of invalid) {
      const out = await list(args, { agentId: 'agt_hr' })
      assert.equal(out.ok, false, `expected invalid_arguments for ${JSON.stringify(args)}`)
      assert.equal(out.error?.code, 'invalid_arguments')
    }
    // Valid faces: absent, null cursor, 1..200 integers — unchanged behavior.
    for (const args of [undefined, {}, { cursor: null }, { limit: 1 }, { limit: 200 }]) {
      const out = await list(args, { agentId: 'agt_hr' })
      assert.equal(out.ok, true, `expected ok for ${JSON.stringify(args)}`)
      assert.ok(Array.isArray(out.result.sessions), 'listing executed')
    }
    // Wrong viewer identity still fails closed.
    const noIdentity = await list({}, {})
    assert.equal(noIdentity.ok, false)
    assert.equal(noIdentity.error?.code, 'forbidden_not_owner')
  } finally { destroyFixtureRoot(fixture) }
})

test('CTR-SCT-002: keyset pagination is deterministic and exhaustive', () => {
  const fixture = buildFixtureRoot()
  try {
    const first = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr', limit: 1 })
    assert.equal(first.ok, true)
    if (first.result.truncated) {
      assert.ok(typeof first.result.nextCursor === 'string' && first.result.nextCursor.length > 0)
      const second = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr', cursor: first.result.nextCursor })
      assert.equal(second.ok, true)
      const firstIds = first.result.sessions.map((s) => s.sessionId)
      const secondIds = second.result.sessions.map((s) => s.sessionId)
      for (const id of secondIds) assert.ok(!firstIds.includes(id), 'pages never overlap')
      assert.deepEqual([...firstIds, ...secondIds].sort(), ['cron-run-occ:003a05ed6629f358ff53', 'main'], 'pagination covers the whole owned set')
    }
    const badCursor = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr', cursor: '%%%not-base64url%%%' })
    assert.equal(badCursor.ok, false)
    assert.equal(badCursor.code, 'invalid_arguments')
  } finally { destroyFixtureRoot(fixture) }
})

test('CTR-SCT-002: scheduler-kind sessions carry their occurrence coordinate; origins reflect journal sidecars', () => {
  const fixture = buildFixtureRoot()
  try {
    const forHr = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(forHr.ok, true)
    const cron = forHr.result.sessions.find((s) => s.kind === 'scheduler')
    assert.ok(cron, 'cron-run session listed with kind=scheduler')
    assert.equal(cron.sessionId, 'cron-run-occ:003a05ed6629f358ff53', 'dir name decoded to the native session id (real ~003A encoding)')
    assert.equal(forHr.result.anomalies.idMismatch, 0, 'a healthy dir/header encoding pair is NEVER an anomaly (CTR-SCT-002 honesty counter)')
    assert.ok(cron.schedulerOccurrenceIds.includes(OCC_ID), 'occurrence coordinate derived from the session id')
    const main = forHr.result.sessions.find((s) => s.sessionId === 'main')
    assert.equal(main.kind, 'main')
    assert.equal(main.origins.user, true, 'user-origin presence from the journal')
  } finally { destroyFixtureRoot(fixture) }
})

// ── A3 (authority round-3 review): confined reader — symlink/hardlink escape ─

test('A3: a symlink or hardlink planted in the caller subtree can never pull a foreign journal into the listing', async () => {
  const fixture = buildFixtureRoot()
  try {
    // The foreign victim journal lives OUTSIDE the caller subtree and is
    // world-readable on purpose — only the confinement gate can stop the leak.
    mkdirSync(join(fixture.paths.homesRoot, 'agt_victim', 'sessions', '--victim--', 'secret'), { recursive: true })
    const victimFile = join(fixture.paths.homesRoot, 'agt_victim', 'sessions', '--victim--', 'secret', 'session.jsonl')
    writeFileSync(victimFile, [
      JSON.stringify({ type: 'session', version: 0, id: 'victim-secret', createdAt: 7, cwd: '/v' }),
      JSON.stringify({ type: 'user/message', seq: 1, time: new Date(8).toISOString(), data: { content: 'victim-only coordinate {"workflowInstanceId":"99999999-9999-4999-8999-999999999999"}', source: { kind: 'user' } } }),
    ].join('\n') + '\n')

    const callerDir = join(fixture.paths.homesRoot, 'agt_hr', 'sessions', PROJ_KEY)
    // 1) SYMLINK planted in the caller's session directory.
    try { symlinkSync(victimFile, join(callerDir, 'sneaky-symlink', 'session.jsonl')) } catch { /* dir first */ }
    // 2) HARDLINK (same device, nlink=2 — a symlink is not required to escape).
    mkdirSync(join(callerDir, 'sneaky-hardlink'), { recursive: true })
    let hardlinked = false
    try { linkSync(victimFile, join(callerDir, 'sneaky-hardlink', 'session.jsonl')); hardlinked = true } catch { /* cross-device */ }

    const out = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(out.ok, true)
    const serialized = JSON.stringify(out.result)
    assert.ok(!serialized.includes('victim-secret'), 'foreign session id never enters the listing')
    assert.ok(!serialized.includes('99999999-9999-4999-8999-999999999999'), 'foreign coordinates never enter the listing')
    for (const row of out.result.sessions) {
      assert.ok(row.sessionId !== 'sneaky-symlink' && row.sessionId !== 'sneaky-hardlink', 'escape-hatch entries are skipped entirely')
    }
    // The victim journal was never read for its content: its mtime is unchanged.
    const victimMtime = statSync(victimFile).mtimeMs
    const again = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(again.ok, true)
    assert.equal(statSync(victimFile).mtimeMs, victimMtime, 'victim journal untouched')
  } finally { destroyFixtureRoot(fixture) }
})

// ── B-B (authority round-3 review): ancestor symlink-swap cannot escape ─────

test('B-B: swapping a caller session directory for a symlink to another agent\'s tree cannot leak foreign coordinates', async () => {
  const fixture = buildFixtureRoot()
  try {
    // The foreign victim journal lives in ANOTHER agent's sessions tree.
    const victimDir = join(fixture.paths.homesRoot, 'agt_victim', 'sessions', '--victim--', 'stolen-main')
    mkdirSync(victimDir, { recursive: true })
    writeFileSync(join(victimDir, 'session.jsonl'), [
      JSON.stringify({ type: 'session', version: 0, id: 'stolen-main', createdAt: 7, cwd: '/v' }),
      JSON.stringify({ type: 'user/message', seq: 1, time: new Date(8).toISOString(), data: { content: 'victim-only {"occurrenceId":"occ:aaaaaaaaaaaaaaaa"}', source: { kind: 'user' } } }),
    ].join('\n') + '\n')

    // Caller has one legitimate session; then its PROJECT directory is
    // replaced by a symlink pointing at the victim's sessions tree — the
    // final file is a plain regular file with nlink=1, so only the
    // canonical-root binding can stop the escape.
    const callerProj = join(fixture.paths.homesRoot, 'agt_hr', 'sessions', PROJ_KEY)
    const movedAside = join(fixture.paths.homesRoot, 'agt_hr', 'moved-aside')
    renameSync(callerProj, movedAside)
    symlinkSync(victimDir, callerProj)

    const out = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(out.ok, true)
    const serialized = JSON.stringify(out.result)
    assert.ok(!serialized.includes('stolen-main'), 'foreign session never enters the listing')
    assert.ok(!serialized.includes('aaaaaaaaaaaaaaaa'), 'foreign coordinates never enter the listing')
    assert.ok(!out.result.sessions.some((s) => s.sessionId === 'cron-run-occ:003a05ed6629f358ff53'), 'the symlinked-away caller sessions are gone (honest absence), not resolved through the escape hatch')
  } finally { destroyFixtureRoot(fixture) }
})

// ── E2 (GitHub fresh review @ 70bc04d0): structured provenance, not raw text ─

test('E2: a message body quoting perfectly-shaped coordinates does not fabricate listing origins or coordinates', () => {
  const fixture = buildFixtureRoot()
  try {
    const FAKE_WF = '123e4567-e89b-12d3-a456-426614174000'
    mkdirSync(join(fixture.paths.homesRoot, 'agt_hr', 'sessions', PROJ_KEY, 'text-coords-quoter'), { recursive: true })
    writeFileSync(join(fixture.paths.homesRoot, 'agt_hr', 'sessions', PROJ_KEY, 'text-coords-quoter', 'session.jsonl'), [
      JSON.stringify({ type: 'session', version: 0, id: 'text-coords-quoter', createdAt: 11, cwd: '/w' }),
      JSON.stringify({ type: 'user/message', seq: 1, time: new Date(12).toISOString(), data: { content: `reminder text citing {"workflowInstanceId":"${FAKE_WF}"} and {"occurrenceId":"occ:003a05ed6629f358ff53"}`, source: { kind: 'user' } } }),
      JSON.stringify({ type: 'user/message', seq: 2, time: new Date(13).toISOString(), data: { content: 'ask the user', source: { kind: 'user' } } }),
    ].join('\n') + '\n')
    const out = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(out.ok, true)
    const row = out.result.sessions.find((s) => s.sessionId === 'text-coords-quoter')
    assert.ok(row, 'session listed')
    assert.equal(row.origins.user, true, 'user origin from structured message provenance')
    assert.deepEqual(row.workflowInstanceIds, [], 'quoted workflowInstanceId in message TEXT is not provenance')
    assert.deepEqual(row.schedulerOccurrenceIds, [], 'quoted occurrenceId in message TEXT is not a touched coordinate')
  } finally { destroyFixtureRoot(fixture) }
})

// ── D4 (GitHub fresh review @ 70bc04d0): coordinate-shape honesty ────────────

test('D4: occurrence coordinates must match the real id shape — message text quoting a fake id is not a touched coordinate', () => {
  const fixture = buildFixtureRoot()
  try {
    // Real journals plus one whose user message QUOTES a fake occurrence id.
    mkdirSync(join(fixture.paths.homesRoot, 'agt_hr', 'sessions', PROJ_KEY, 'fake-occ-quoter'), { recursive: true })
    writeFileSync(join(fixture.paths.homesRoot, 'agt_hr', 'sessions', PROJ_KEY, 'fake-occ-quoter', 'session.jsonl'), [
      JSON.stringify({ type: 'session', version: 0, id: 'fake-occ-quoter', createdAt: 9, cwd: '/w' }),
      JSON.stringify({ type: 'user/message', seq: 1, time: new Date(10).toISOString(), data: { content: 'see {"occurrenceId":"occ:not-a-real-run"} in text', source: { kind: 'user' } } }),
    ].join('\n') + '\n')
    const out = listAgentSessions({ homesRoot: fixture.paths.homesRoot, indexDir: indexDirOf(fixture), viewerAgentId: 'agt_hr' })
    assert.equal(out.ok, true)
    const quoter = out.result.sessions.find((s) => s.sessionId === 'fake-occ-quoter')
    assert.ok(quoter, 'session listed')
    assert.ok(!quoter.schedulerOccurrenceIds.includes('occ:not-a-real-run'), 'fake (non-hex) id never becomes a coordinate')
    assert.ok(quoter.schedulerOccurrenceIds.length === 0, 'no fabricated occurrence coordinates')
  } finally { destroyFixtureRoot(fixture) }
})

