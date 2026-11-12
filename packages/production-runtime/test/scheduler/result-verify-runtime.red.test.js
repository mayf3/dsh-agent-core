// RED tests (#1379 c741b315/9cbe0668 review blockers — Owner-audited).
// These failures are the deterministic contract gaps; the minimal fix must
// turn them GREEN without changing the frozen no-invented-PASS contract.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createResultVerifyRuntime } from '../../src/scheduler/result-verify-runtime.js'

const state = () => mkdtempSync(join(tmpdir(), 'rv-red-'))
const hist = async (recs, dir) => {
  const f = await import('node:fs')
  const pp = join(dir, 'runs-2026-11.json')
  f.mkdirSync(dir, {recursive:true})
  f.writeFileSync(pp, JSON.stringify({records: recs}))
  return pp
}

test('RED-1: verify instruction must reach the agent turn seam, not an empty feishu announcement', async () => {
  const dir = state()
  try {
    const calls = []
    const rt = createResultVerifyRuntime({
      layout: { historyDir: dir, controlDir: dir },
      // The Owner-audited blocker: deliver({job, payload:{text}}) drops `text`
      // (feishu contract is {job,result,text}) -> empty group announcement,
      // which is NOT a verify turn. RED until the call carries text under the
      // real contract key AND the target is the responsible agent turn seam.
      deliver: async (req) => { calls.push(req) },
      store: { readJobs: async () => [{ id: 'j1', enabled: true, agent_id: 'agt_x', delivery: { channel: 'feishu', to: 'oc_x' } }] },
      nowMs: () => 1794400000000,
      stateDir: dir,
    })
    await hist([{ run_id: 'r-1', job_id: 'j1', outcome: 'succeeded', result_status: null, agent_id: 'agt_x' }], dir)
    await rt.tick()
    assert.equal(calls.length, 1, 'one verify delivery')
    assert.ok(calls[0].text && calls[0].text.includes('scheduler-result'), 'text must carry the verify instruction under the real contract key')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('RED-2: dedupe must be per RUN identity, and receipt must clear the skip', async () => {
  const dir = state()
  try {
    let deliveries = 0
    const rt = createResultVerifyRuntime({
      layout: { historyDir: dir, controlDir: dir },
      deliver: async () => { deliveries += 1; return { ok: true } },
      store: { readJobs: async () => [{ id: 'j1', enabled: true, agent_id: 'agt_x', delivery: { channel: 'feishu', to: 'oc_x' } }] },
      nowMs: () => 1794400000000,
      stateDir: dir,
    })
    await hist([
      { run_id: 'r-1', job_id: 'j1', outcome: 'succeeded', result_status: null, agent_id: 'agt_x' },
      { run_id: 'r-2', job_id: 'j1', outcome: 'succeeded', result_status: null, agent_id: 'agt_x' },
    ], dir)
    await rt.tick()
    assert.equal(deliveries, 2, 'both unverified runs delivered in one tick (MAX=3)')
    // A second run of the same job must still get its own verify — jobId-level
    // permanent skip (markers.verifiedDelivered[jobId]) loses run r-2's duty.
    await hist([
      { run_id: 'r-2', job_id: 'j1', outcome: 'succeeded', result_status: null, agent_id: 'agt_x' },
    ], dir)
    await rt.tick()
    assert.equal(deliveries, 2, 'no duplicate re-verify: delivered runs are marker-skipped; r-2 removal adds nothing')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
