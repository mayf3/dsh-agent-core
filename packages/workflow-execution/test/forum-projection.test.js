/**
 * Forum projection tests (WORKFLOW_EXECUTION_CONTROL_V1 CTR-WEC1-007).
 * Injected fakes only: a temp dir with a hand-written attempts.jsonl tail,
 * a stub thread resolver and message poster. Pins:
 *   - never creates threads: no thread → events HOLD (offset stays), then
 *     post once the thread appears (Goal Case 8 agent side)
 *   - dedupe by eventKey: a restart (fresh module, same state file) never
 *     re-posts the committed window
 *   - posting failure holds the offset and retries (at-least-once)
 *   - posting failures never throw into the caller
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createForumProjection, forumMessageFor } from '../src/forum-projection.js'
import { LEDGER_EVENTS_FILE } from '../src/ledger.js'

const INSTANCE = '4d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e55'
const VISIT = '0d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e11'
const INTENT = '2d5c2f0a-3f19-4a7e-9a3f-5d1c2b0a9e33'

function seedLedger(dir) {
  // Every line carries workflowInstanceId — the ledger stamps it onto every
  // durable event (the CTR-WEC1-007 projection keys on the line alone).
  const lines = [
    JSON.stringify({ kind: 'attempt_planned', attemptId: 'wfeat-1', nodeVisitId: VISIT, dispatchIntentId: INTENT, workflowInstanceId: INSTANCE, ownerPrincipalId: 'p1', atMs: 1 }),
    JSON.stringify({ kind: 'run_delivered', nodeVisitId: VISIT, workflowInstanceId: INSTANCE, agentId: 'agt_x', requestId: 'wfeat-1', sessionId: 'main', reconciliationHandle: 'turn:h', atMs: 2, workflowStateVersionAtDispatch: 1 }),
    JSON.stringify({ kind: 'escalation_requested', nodeVisitId: VISIT, workflowInstanceId: INSTANCE, atMs: 3, reason: 'ATTEMPTS_EXHAUSTED', attemptCount: 3 }),
  ]
  writeFileSync(join(dir, LEDGER_EVENTS_FILE), lines.map((l) => `${l}\n`).join(''), 'utf8')
  return lines
}

function fixture({ threadId = 'thr-1', postResults = [], resolveResults = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-forum-'))
  seedLedger(dir)
  const calls = { resolve: [], posts: [] }
  const confirmedKeys = new Set()
  let resolveSeq = 0
  let postSeq = 0
  const projection = createForumProjection({
    dir,
    resolveThread: async ({ workflowInstanceId }) => {
      calls.resolve.push(workflowInstanceId)
      const preset = resolveResults[resolveSeq]
      resolveSeq += 1
      if (preset !== undefined) return preset
      return { ok: true, threadId }
    },
    loadPostedKeys: async () => ({ ok: true, keys: [...confirmedKeys] }),
    postMessage: async (req) => {
      calls.posts.push(req)
      const preset = postResults[postSeq]
      postSeq += 1
      if (preset !== undefined) {
        if (preset.ok === true) confirmedKeys.add(req.metadata.eventKey)
        return preset
      }
      confirmedKeys.add(req.metadata.eventKey)
      return { ok: true }
    },
  })
  return {
    dir, projection, calls,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}

test('forumMessageFor covers the Goal Scope G execution events', () => {
  assert.match(forumMessageFor({ kind: 'run_delivered', nodeVisitId: VISIT, agentId: 'agt_x', sessionId: 'main' }, { generation: 2 }), /Attempt #2 dispatched to Agent `agt_x`/)
  assert.match(forumMessageFor({ kind: 'reconciled', nodeVisitId: VISIT, judgment: 'run_ended_no_submission' }, { generation: 1 }), /WITHOUT a business transition/)
  assert.match(forumMessageFor({ kind: 'escalation_requested', nodeVisitId: VISIT, reason: 'ATTEMPTS_EXHAUSTED' }), /HUMAN_REQUIRED/)
  assert.equal(forumMessageFor({ kind: 'attempt_unknown_kind' }, {}), undefined)
})

test('no thread yet → events hold (offset unchanged); thread appears → all events post in order', async () => {
  const f = fixture({ resolveResults: [{ ok: true, threadId: null }] })
  try {
    const first = await f.projection.pass()
    assert.equal(first.posted, 0)
    assert.equal(first.skipped, 1)
    // Offset HELD: nothing posted, nothing lost (no state file written yet).
    assert.equal(existsSync(f.projection.stateFile), false)

    // The svc binding lands: same events, resolved thread → 3 posts in order.
    const second = await f.projection.pass()
    assert.equal(second.posted, 3)
    assert.equal(second.skipped, 0)
    assert.equal(f.calls.posts.length, 3)
    assert.equal(f.calls.posts[0].content.includes('Attempt #1 planned'), true)
    assert.equal(f.calls.posts[1].content.includes("dispatched to Agent `agt_x`"), true)
    assert.equal(f.calls.posts[2].content.includes('HUMAN_REQUIRED'), true)
    for (const post of f.calls.posts) {
      assert.equal(post.threadId, 'thr-1')
      assert.equal(post.metadata.workflowInstanceId, INSTANCE)
      assert.equal(typeof post.metadata.eventKey, 'string')
      assert.equal(post.kind, 'comment')
    }
    const state2 = JSON.parse(readFileSync(f.projection.stateFile, 'utf8'))
    assert.equal(state2.byteOffset > 0, true)
  } finally {
    f.cleanup()
  }
})

test('restart: the persisted offset + posted keys prevent re-posting the committed window', async () => {
  const f = fixture()
  try {
    await f.projection.pass()
    assert.equal(f.calls.posts.length, 3)

    // A brand-new projection over the same dir (simulated restart): the
    // ledger file has not grown, so nothing re-posts.
    const restarted = createForumProjection({
      dir: f.dir,
      resolveThread: async () => ({ ok: true, threadId: 'thr-1' }),
      loadPostedKeys: async () => ({ ok: true, keys: f.calls.posts.map((p) => p.metadata.eventKey) }),
      postMessage: async (req) => { f.calls.posts.push(req); return { ok: true } },
    })
    const pass = await restarted.pass()
    assert.equal(pass.posted, 0)
    assert.equal(f.calls.posts.length, 3, 'no duplicate system messages after restart')
  } finally {
    f.cleanup()
  }
})

test('posting failure holds the offset and retries; a new event still posts once recovered', async () => {
  const f = fixture({ postResults: [{ ok: false, code: 'forum_down' }] })
  try {
    const first = await f.projection.pass()
    assert.equal(first.posted, 0)
    assert.equal(f.calls.posts.length, 1, 'the failing post was attempted')

    // Recover: next pass re-attempts the SAME event first (at-least-once).
    const second = await f.projection.pass()
    assert.equal(second.posted, 3)
    assert.equal(f.calls.posts.length, 4)
    assert.equal(f.calls.posts[0].metadata.eventKey, f.calls.posts[1].metadata.eventKey, 'the retried event is the same one')
  } finally {
    f.cleanup()
  }
})

test('poster throwing never propagates (guarded pass)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-forum2-'))
  try {
    seedLedger(dir)
    const projection = createForumProjection({
      dir,
      resolveThread: async () => { throw new Error('gateway exploded') },
      loadPostedKeys: async () => ({ ok: true, keys: [] }),
      postMessage: async () => ({ ok: true }),
    })
    const result = await projection.pass()
    assert.equal(result.posted, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('ledger larger than 4 MiB drains from persisted offset without starting mid-line', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-forum-large-'))
  try {
    const lines = Array.from({ length: 5 }, (_, i) => JSON.stringify({
      kind: 'attempt_planned', workflowInstanceId: INSTANCE, nodeVisitId: VISIT,
      dispatchIntentId: INTENT, atMs: i, pad: 'x'.repeat(1_200_000),
    }))
    writeFileSync(join(dir, LEDGER_EVENTS_FILE), `${lines.join('\n')}\n`)
    const posts = []
    const projection = createForumProjection({
      dir,
      resolveThread: async () => ({ ok: true, threadId: 'thr-1' }),
      loadPostedKeys: async () => ({ ok: true, keys: posts.map((p) => p.metadata.eventKey) }),
      postMessage: async (req) => { posts.push(req); return { ok: true } },
    })
    const first = await projection.pass()
    const second = await projection.pass()
    assert.equal(first.posted + second.posted, 5)
    assert.equal(posts.length, 5)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('large historical unknown events advance offset to a later projectable event', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-forum-historical-'))
  try {
    const historical = JSON.stringify({ kind: 'historical_unknown', pad: 'x'.repeat(1_200_000) })
    const live = JSON.stringify({ kind: 'attempt_planned', workflowInstanceId: INSTANCE, nodeVisitId: VISIT, dispatchIntentId: INTENT })
    writeFileSync(join(dir, LEDGER_EVENTS_FILE), `${Array(5).fill(historical).join('\n')}\n${live}\n`)
    const posts = []
    const projection = createForumProjection({
      dir,
      resolveThread: async () => ({ ok: true, threadId: 'thr-1' }),
      loadPostedKeys: async () => ({ ok: true, keys: posts.map((p) => p.metadata.eventKey) }),
      postMessage: async (req) => { posts.push(req); return { ok: true } },
    })
    await projection.pass()
    await projection.pass()
    assert.equal(posts.length, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('lost local state reads remote eventKeys before reposting a confirmed Forum message', async () => {
  const f = fixture()
  try {
    await f.projection.pass()
    assert.equal(f.calls.posts.length, 3)
    unlinkSync(f.projection.stateFile)
    const restarted = createForumProjection({
      dir: f.dir,
      resolveThread: async () => ({ ok: true, threadId: 'thr-1' }),
      loadPostedKeys: async () => ({ ok: true, keys: f.calls.posts.map((p) => p.metadata.eventKey) }),
      postMessage: async (req) => { f.calls.posts.push(req); return { ok: true } },
    })
    await restarted.pass()
    assert.equal(f.calls.posts.length, 3, 'remote confirmed keys must survive local state loss')
  } finally {
    f.cleanup()
  }
})

test('unavailable remote readback holds the event and does not post', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wfe-forum-readback-'))
  try {
    seedLedger(dir)
    const posts = []
    const projection = createForumProjection({
      dir,
      resolveThread: async () => ({ ok: true, threadId: 'thr-1' }),
      loadPostedKeys: async () => ({ ok: false, code: 'forum_unavailable' }),
      postMessage: async (req) => { posts.push(req); return { ok: true } },
    })
    const result = await projection.pass()
    assert.equal(result.posted, 0)
    assert.equal(posts.length, 0)
    assert.equal(existsSync(projection.stateFile), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
