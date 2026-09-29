/**
 * HTTP tests for the /agent-process/turn-abandonment admin surface
 * (HR_RESET_AND_RESUME_V1). Same harness discipline as workflow-execution-api:
 * a REAL loopback server over a fake cordis ctx, an INJECTABLE stub token
 * verifier, and a REAL agent-router facade (durable TurnReconciliationStore +
 * createProcessRegistry + createIngressDelivery over the tool-free fixture
 * worker). Pins:
 *
 *   - the authorization gate reuses the EXISTING authsvc verifier seam and
 *     binds the EXACT canonical CTO machine identity recorded by the accepted
 *     bootstrap authority (AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_V1
 *     OBS-WA-008: agt_cto-agent / principal 4e5a4578-0645-4133-bd35-
 *     b80e453dfee9) — 401/403 fail-closed BEFORE any store mutation, zero
 *     mutation on every denial;
 *   - the operation target is PINNED to agt_hr-agent (any other target is
 *     refused before any mutation);
 *   - a live identifiable HR execution refuses the reset with a structured
 *     limitation (review r4130766489) instead of stamping over a possibly
 *     running task;
 *   - an EMPTY lifecycle slot is NOT termination evidence: a stuck unknown
 *     fence WITHOUT durable exit evidence (the restart-lost class) refuses
 *     fail-closed; only stuck turns bearing durable child_real_exit evidence
 *     (C-015 kind 4) or no stuck turns at all may proceed;
 *   - a legitimate admin reset unblocks the SAME HR through the SAME normal
 *     ingress path (the reset never sends anything itself);
 *   - retrying a completed declaration never adopts a later unknown;
 *   - declarations stay readable after a controller restart;
 *   - the 32-distinct-declaration budget is a real, tested boundary whose
 *     exhaustion keeps retries of existing ids working (no recycling).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  call,
  CTO_AGENT_MISMATCH_TOKEN,
  CTO_TOKEN,
  CTO_UUID_MISMATCH_TOKEN,
  evidencedRestartRig,
  evidencedStuckTurn,
  hrRig,
  HR,
  LEGACY_CTO_TOKEN,
  mount,
  mutationProbe,
  OTHER,
  OTHER_WORKFLOW_ADMIN_TOKEN,
  restartLostRig,
  stuckTurn,
  TurnReconciliationStore,
  USER_TOKEN,
} from './admin-turn-abandonment-helpers.mjs'

test('admin gate: no token / wrong scope / foreign target all fail closed with ZERO store mutation', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-gate-'))
  const { rig, oldHandle } = await evidencedRestartRig(t, root)
  const { base } = await mount(t, { routerFacade: rig })
  const post = { agentId: HR, declarationId: 'reset-gate-1' }
  const before = mutationProbe(rig)

  let res = await call(base, '/agent-process/turn-abandonment', { method: 'POST', body: post })
  assert.equal(res.status, 401)
  assert.equal(res.body.error.code, 'unauthenticated')

  res = await call(base, '/agent-process/turn-abandonment', { method: 'POST', body: post, token: USER_TOKEN })
  assert.equal(res.status, 403)
  assert.equal(res.body.error.code, 'forbidden', 'ordinary scheduler.read user is not an administrator')


  res = await call(base, '/agent-process/turn-abandonment', { method: 'POST', body: { agentId: OTHER, declarationId: 'reset-gate-1' }, token: CTO_TOKEN })
  assert.equal(res.status, 403, 'target outside the pinned agt_hr-agent scope is refused')

  res = await call(base, '/agent-process/turn-abandonment', { method: 'POST', body: { agentId: HR, declarationId: 'x', extra: 1 }, token: CTO_TOKEN })
  assert.equal(res.status, 400, 'closed body: unknown fields refused')

  assert.equal(mutationProbe(rig), before, 'denied calls mutate nothing')
  assert.ok(rig.store.activeFenceForAgent(HR)?.handle === oldHandle, 'fence untouched')
})

test('legitimate admin reset through the real HTTP entry unblocks the same HR via the normal ingress', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-ok-'))
  const { rig, oldHandle } = await evidencedRestartRig(t, root)
  const { base } = await mount(t, { routerFacade: rig })

  // The next ordinary message is STILL fenced before the reset.
  const fenced = await rig.request('NEW independent HR request before reset')
  assert.notEqual(fenced?.reply, 'fixture-ok', 'pre-reset ordinary message stays fenced')

  const reset = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-entry-1' }, token: CTO_TOKEN,
  })
  assert.equal(reset.status, 200)
  assert.deepEqual(reset.body.abandonedHandles, [oldHandle])
  const oldRecord = rig.store.records.get(oldHandle)
  assert.equal(oldRecord.initialOutcome, 'outcome_unknown', 'old business result stays UNKNOWN')
  assert.equal(oldRecord.fenceState, 'active', 'old record keeps its honest fenced state')
  assert.equal(oldRecord.adminAbandonment?.declarationId, 'reset-entry-1', 'minimal audit / no-replay marker kept')

  // Declarations are readable (read-only projection).
  const read = await call(base, `/agent-process/turn-abandonment?agentId=${encodeURIComponent(HR)}`, { token: CTO_TOKEN })
  assert.equal(read.status, 200)
  assert.deepEqual(read.body.declarations.map(d => d.declarationId), ['reset-entry-1'])
  assert.deepEqual(read.body.declarations[0].handles, [oldHandle])

  // The reset itself never sends anything; the NEXT ordinary message is the
  // normal ingress path and now completes on the same HR / same entry.
  const next = await rig.request('NEW independent HR request after admin reset')
  assert.equal(next?.reply, 'fixture-ok', JSON.stringify(next))
  assert.equal(next.agentId, HR)
  assert.equal(next.sessionId, 'main')
  const prompts = readFileSync(join(root, 'fixture-prompts.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
  assert.equal(prompts.length, 1, 'exactly the one new prompt; the reset sent nothing and replayed nothing')
})

test('retrying a completed declaration over HTTP never adopts a later unknown turn', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-retry-'))
  const { rig } = await evidencedRestartRig(t, root)
  const { base } = await mount(t, { routerFacade: rig })

  const first = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-entry-1' }, token: CTO_TOKEN,
  })
  assert.equal(first.status, 200)

  // A LATER turn becomes unknown after the declaration completed (with its
  // own observed exit, so the entry's evidence gate stays satisfied).
  const laterHandle = evidencedStuckTurn(rig.store, HR, { generation: 1 })
  const retry = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-entry-1' }, token: CTO_TOKEN,
  })
  assert.equal(retry.status, 200)
  assert.deepEqual(retry.body.abandonedHandles, [], 'retry abandons nothing new')
  assert.equal(rig.store.records.get(laterHandle).adminAbandonment ?? null, null, 'later task never marked by the old id')
  assert.equal(rig.store.admissionBlockerForAgent(HR)?.handle, laterHandle, 'later task keeps fencing admission')

  // Only an explicit NEW declaration resets the later task.
  const second = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-entry-2' }, token: CTO_TOKEN,
  })
  assert.equal(second.status, 200)
  assert.deepEqual(second.body.abandonedHandles, [laterHandle])
  assert.equal(rig.store.admissionBlockerForAgent(HR), null)
})

test('declarations survive a controller restart and stay readable at the entry', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-restart-'))
  const persistenceFile = join(root, 'turn-recovery.json')
  const crashed = new TurnReconciliationStore({ persistenceFile, runtimeEpoch: 'epoch-crashed' })
  const oldHandle = stuckTurn(crashed, HR)
  crashed.claimRecovery(oldHandle, { operationId: 'reap-fixture', claimantRuntimeEpoch: 'epoch-crashed' })
  crashed.markExitObserved(oldHandle)
  const first = hrRig(root, 'epoch-restarted-a')
  const { base } = await mount(t, { routerFacade: first })
  const reset = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-restart-1' }, token: CTO_TOKEN,
  })
  assert.equal(reset.status, 200)
  await first.close()

  // Controller restart: fresh epoch, same durable file, fresh registry.
  const second = hrRig(root, 'epoch-restarted-b')
  t.after(async () => { await second.close(); rmSync(root, { recursive: true, force: true }) })
  const read = await call(base, `/agent-process/turn-abandonment?agentId=${encodeURIComponent(HR)}`, { token: CTO_TOKEN })
  assert.equal(read.status, 200)
  assert.deepEqual(read.body.declarations.map(d => d.declarationId), ['reset-restart-1'])
  assert.deepEqual(read.body.declarations[0].handles, [oldHandle], 'declaration scope readable after restart')
  assert.equal(second.store.admissionBlockerForAgent(HR), null, 'unblock survives the restart')
})

test('an identifiable live HR execution refuses the reset with a structured limitation (r4130766489)', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-live-'))
  const rig = hrRig(root, 'epoch-live')
  const { base } = await mount(t, { routerFacade: rig })
  // Produce a REAL live worker: a completed turn leaves the READY process up.
  const done = await rig.request('hello')
  assert.equal(done?.reply, 'fixture-ok')
  const snapshot = rig.registrySnapshot()
  assert.ok(snapshot.some(p => p.agentId === HR && p.alive), 'live HR process is identifiable')

  const stuck = stuckTurn(rig.store, HR, { generation: 2 })
  const before = mutationProbe(rig)
  const refusal = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-live-1' }, token: CTO_TOKEN,
  })
  assert.equal(refusal.status, 409)
  assert.equal(refusal.body.error.code, 'live_execution_present')
  assert.match(refusal.body.error.message, /cancel|shutdown/, 'limitation names the existing controlled path')
  assert.equal(mutationProbe(rig), before, 'refusal mutates nothing')
  assert.equal(rig.store.records.get(stuck).adminAbandonment ?? null, null, 'no marker written over a live execution')
})

test('the 32-distinct-declaration budget is a real boundary; retries of existing ids still work', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-budget-'))
  const rig = hrRig(root, 'epoch-budget')
  const { base } = await mount(t, { routerFacade: rig })
  for (let i = 1; i <= 32; i += 1) {
    const res = await call(base, '/agent-process/turn-abandonment', {
      method: 'POST', body: { agentId: HR, declarationId: `budget-${i}` }, token: CTO_TOKEN,
    })
    assert.equal(res.status, 200, `declaration ${i} of 32 accepted`)
  }
  const exhausted = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'budget-33' }, token: CTO_TOKEN,
  })
  assert.equal(exhausted.status, 409)
  assert.equal(exhausted.body.error.code, 'abandonment_capacity_exhausted')
  assert.match(exhausted.body.error.message, /32/, 'exhaustion message states the exact bound')
  // No recycling: an existing id still replays idempotently.
  const retry = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'budget-1' }, token: CTO_TOKEN,
  })
  assert.equal(retry.status, 200)
  assert.deepEqual(retry.body.abandonedHandles, [])
})

test('GET requires the same admin authority; the loopback /v1/message path cannot reach the admin operation', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-readgate-'))
  const { rig } = await restartLostRig(t, root)
  const { base } = await mount(t, { routerFacade: rig })

  let res = await call(base, `/agent-process/turn-abandonment?agentId=${encodeURIComponent(HR)}`)
  assert.equal(res.status, 401)
  res = await call(base, `/agent-process/turn-abandonment?agentId=${encodeURIComponent(HR)}`, { token: USER_TOKEN })
  assert.equal(res.status, 403)

  // The ordinary message path carries no admin surface: a message is just a
  // normal HR turn (fenced here, because the stuck turn is still fenced).
  const normal = await rig.request('ordinary user message')
  assert.notEqual(normal?.reply, 'fixture-ok', 'ordinary message stays a normal fenced turn, not an admin reset')
  assert.equal(rig.store.adminAbandonmentDeclarations.length, 0, 'ordinary ingress performs no abandonment')
  rmSync(root, { recursive: true, force: true })
})

test('Owner-designated sole authority: workflow.admin alone and CTO identity mismatches are all denied with ZERO mutation', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-cto-'))
  const { rig, oldHandle } = await evidencedRestartRig(t, root)
  const { base } = await mount(t, { routerFacade: rig })
  const post = { agentId: HR, declarationId: 'reset-cto-1' }
  const before = mutationProbe(rig)

  // A different principal holding workflow.admin is NOT the authority.
  let res = await call(base, '/agent-process/turn-abandonment', { method: 'POST', body: post, token: OTHER_WORKFLOW_ADMIN_TOKEN })
  assert.equal(res.status, 403)
  // Canonical CTO principal UUID bound to the WRONG agentId: fail closed.
  res = await call(base, '/agent-process/turn-abandonment', { method: 'POST', body: post, token: CTO_UUID_MISMATCH_TOKEN })
  assert.equal(res.status, 403)
  // The cto-agent id carrying a DIFFERENT principal UUID: fail closed.
  res = await call(base, '/agent-process/turn-abandonment', { method: 'POST', body: post, token: CTO_AGENT_MISMATCH_TOKEN })
  assert.equal(res.status, 403)
  // The legacy OpenClaw-era fixture pair (cto-agent / 3e2439d2-…) itself:
  // NOT authorized alongside the canonical pair (spec D3) — fail closed.
  res = await call(base, '/agent-process/turn-abandonment', { method: 'POST', body: post, token: LEGACY_CTO_TOKEN })
  assert.equal(res.status, 403)
  // GET is gated by the same exact binding.
  res = await call(base, `/agent-process/turn-abandonment?agentId=${encodeURIComponent(HR)}`, { token: OTHER_WORKFLOW_ADMIN_TOKEN })
  assert.equal(res.status, 403)

  assert.equal(mutationProbe(rig), before, 'every denial mutates nothing')
  assert.ok(rig.store.activeFenceForAgent(HR)?.handle === oldHandle, 'fence untouched')

  // Only the exact canonical binding is authorized.
  res = await call(base, '/agent-process/turn-abandonment', { method: 'POST', body: post, token: CTO_TOKEN })
  assert.equal(res.status, 200, JSON.stringify(res.body))
  assert.deepEqual(res.body.abandonedHandles, [oldHandle])
})

test('non-drained lifecycle slots refuse the reset: STARTUP and REAP are explicit local limitations, zero mutation', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-slots-'))
  const rig = hrRig(root, 'epoch-slots')
  const { base } = await mount(t, { routerFacade: rig })
  const stuck = stuckTurn(rig.store, HR, { generation: 1 })

  // STARTUP: an in-flight generation the registry has not drained.
  rig.lifecycleSlotSnapshot = () => ({ state: 'STARTUP', generation: 7 })
  const beforeStartup = mutationProbe(rig)
  let res = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-slot-1' }, token: CTO_TOKEN,
  })
  assert.equal(res.status, 409)
  assert.equal(res.body.error.code, 'startup_in_progress')
  assert.equal(mutationProbe(rig), beforeStartup, 'STARTUP refusal mutates nothing')

  // REAP: a generation still reaping (real exit not yet settled).
  rig.lifecycleSlotSnapshot = () => ({ state: 'REAP', generation: 7 })
  const beforeReap = mutationProbe(rig)
  res = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-slot-2' }, token: CTO_TOKEN,
  })
  assert.equal(res.status, 409)
  assert.equal(res.body.error.code, 'reaping_in_progress')
  assert.equal(mutationProbe(rig), beforeReap, 'REAP refusal mutates nothing')
  assert.equal(rig.store.records.get(stuck).adminAbandonment ?? null, null, 'no marker over a non-drained slot')

  // EMPTY slot, but the stuck turn carries NO durable exit evidence: an
  // empty local registry after a restart is NOT termination evidence —
  // fail closed instead of stamping over an unproven old execution.
  rig.lifecycleSlotSnapshot = () => ({ state: 'EMPTY' })
  const beforeEmpty = mutationProbe(rig)
  const unproven = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-slot-3' }, token: CTO_TOKEN,
  })
  assert.equal(unproven.status, 409, JSON.stringify(unproven.body))
  assert.equal(unproven.body.error.code, 'restart_lost_termination_evidence_unavailable')
  assert.equal(mutationProbe(rig), beforeEmpty, 'EMPTY without exit evidence mutates nothing')
  assert.equal(rig.store.records.get(stuck).adminAbandonment ?? null, null, 'no marker over an unproven execution')

  // EMPTY slot WITH durable child_real_exit evidence on the stuck turn: the
  // old execution's real exit is proven, so the reset may proceed.
  assert.ok(rig.store.markExitObserved(stuck), 'fixture records the observed real exit')
  const ok = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-slot-4' }, token: CTO_TOKEN,
  })
  assert.equal(ok.status, 200, JSON.stringify(ok.body))
  assert.deepEqual(ok.body.abandonedHandles, [stuck])
})

test('missing lifecycle verification capability fails closed instead of defaulting to resettable', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-nocap-'))
  const rig = hrRig(root, 'epoch-nocap')
  stuckTurn(rig.store, HR, { generation: 1 })
  const { base } = await mount(t, { routerFacade: rig })
  const before = mutationProbe(rig)
  // The router service is resolved at request time, so removing a probe from
  // the mounted facade is exactly the deployed "capability missing" state.
  const savedSlot = rig.lifecycleSlotSnapshot
  delete rig.lifecycleSlotSnapshot
  const noSlot = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-nocap-1' }, token: CTO_TOKEN,
  })
  assert.equal(noSlot.status, 503)
  assert.equal(noSlot.body.error.code, 'liveness_verification_unavailable')
  rig.lifecycleSlotSnapshot = savedSlot
  // The same fail-closed posture for a missing termination-evidence check:
  // an unverifiable gate never defaults to resettable.
  const savedEvidence = rig.stuckFenceWithoutDurableExitEvidenceForAgent
  delete rig.stuckFenceWithoutDurableExitEvidenceForAgent
  const noEvidence = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-nocap-2' }, token: CTO_TOKEN,
  })
  assert.equal(noEvidence.status, 503)
  assert.equal(noEvidence.body.error.code, 'liveness_verification_unavailable')
  rig.stuckFenceWithoutDurableExitEvidenceForAgent = savedEvidence
  assert.equal(mutationProbe(rig), before, 'unverifiable gates never default to a reset')
})

test('restart-lost unknown fences without durable exit evidence refuse the entry: EMPTY is not drained', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hr-admin-entry-restartlost-'))
  const { rig, oldHandle } = await restartLostRig(t, root)
  const { base } = await mount(t, { routerFacade: rig })
  const before = mutationProbe(rig)
  const res = await call(base, '/agent-process/turn-abandonment', {
    method: 'POST', body: { agentId: HR, declarationId: 'reset-restartlost-1' }, token: CTO_TOKEN,
  })
  assert.equal(res.status, 409, JSON.stringify(res.body))
  assert.equal(res.body.error.code, 'restart_lost_termination_evidence_unavailable')
  assert.match(res.body.error.message, /quiescence|recovery/, 'the refusal names the accepted evidence path')
  assert.equal(mutationProbe(rig), before, 'the unproven restart-lost class mutates nothing')
  assert.equal(rig.store.records.get(oldHandle).adminAbandonment ?? null, null, 'old record stays fenced + unmarked')
  assert.ok(rig.store.activeFenceForAgent(HR), 'the fence stays up for the unproven class')
})
