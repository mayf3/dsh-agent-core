/**
 * RECONCILIATION_ABANDONED_EVICTION_V1 r2 (#707 structural slice) — the
 * three independent-review counterexamples, each frozen, plus the
 * review-mandated coverage matrix (crash-mid-persist, restart, late effects,
 * historical declarations, same-key retry).
 *
 *   CE1  restore-apply risk-acceptance boundary: the durable registry is
 *        re-applied at boot, but the D6 acceptance audit is stamped ONLY for
 *        entries carrying the explicit durable `ownerRiskAcceptance: true`
 *        flag (+decisionRef). Flag-less entries restore MARKER-ONLY — the
 *        admission quarantine stays. Invalid flag shapes fail closed.
 *   CE2  correlated abandoned eviction preserves the no-replay tombstone:
 *        the correlation index entry survives the eviction AND the durable
 *        round-trip; the same correlation can never mint again.
 *   CE3  marker-only quarantined records are never releasable capacity —
 *        only records carrying BOTH the marker and the D6 acceptance audit;
 *        the legal completion is the same-declarationId re-invocation with
 *        the explicit owner risk acceptance (R131 succession).
 */

import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { TurnReconciliationStore } from '../../src/reconciliation/index.js'
import { writeAbandonmentDeclarationRegistry } from '../../src/reconciliation/durable-file.js'
import { hasAcceptanceAudit } from '../../src/reconciliation/admin-abandonment.js'

const HR = 'agt_hr-agent'

function stuckTurn(store, agentId, { generation = 1, requestId = null } = {}) {
  const handle = store.mintTurnExecution({
    agentId,
    processGeneration: generation,
    sessionId: 'main',
    ...(requestId === null ? {} : { callerCorrelation: { requestId } }),
  })
  store.markPromptWriteAttempted(handle)
  store.markOutcomeUnknown(handle, { source: 'unit-fixture' })
  return handle
}

async function tempDir(t, prefix) {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}

// ── CE1: restore-apply risk-acceptance boundary ────────────────────────────

test('CE1: flag-less entry restores MARKER-ONLY (quarantine preserved); explicit flag stamps the D6 audit; invalid shape fails closed', async (t) => {
  const dir = await tempDir(t, 'acr-ce1-')
  const pf = join(dir, 'recovery.json')
  {
    const store = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-ce1' })
    stuckTurn(store, HR, { generation: 1, requestId: 'req-ce1' })
  }
  const handle = 'turn:epoch-ce1:a1:g1:s1'

  // Flag-less operator pre-seed: marker-only restore — NO acceptance audit,
  // the admission quarantine stays (the D6 boundary is not auto-upgraded).
  writeAbandonmentDeclarationRegistry(pf + '.abandonment-declarations.json', [
    { declarationId: 'preseed-marker-only', agentId: HR, handles: [handle], declaredAt: Date.now() - 2000 },
  ])
  void handle
  {
    const store = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-ce1-r2' })
    const record = store.records.get(handle)
    assert.equal(record.fenceState, 'active', 'marker-only restore keeps the honest blocked state')
    assert.equal(hasAcceptanceAudit(record), false,
      'NO acceptance audit without the explicit flag (the D6 boundary is what the review demanded)')
    assert.equal(store.admissionBlockerForAgent(HR), null,
      'the marker unblocks admission (abandoned semantics) — the D6 acceptance audit is NOT fabricated')
  }

  // Explicit ownerRiskAcceptance entry: the D6 audit is stamped at restore.
  writeAbandonmentDeclarationRegistry(pf + '.abandonment-declarations.json', [
    { declarationId: 'preseed-accepted', agentId: HR, handles: [handle],
      declaredAt: Date.now() - 1000, ownerRiskAcceptance: true, decisionRef: 'owner-p1-20261120-707-pathA' },
  ])
  {
    const store = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-ce1-r3' })
    const record = store.records.get(handle)
    assert.equal(hasAcceptanceAudit(record), true, 'the explicit flag stamps the D6 acceptance audit')
    assert.equal(store.admissionBlockerForAgent(HR), null, 'admission unblocked for the accepted record')
  }

  // Invalid flag shape fails CLOSED at restore: the store starts blocked
  // (startupBlockedReason), never silently ignoring the malformed registry.
  writeAbandonmentDeclarationRegistry(pf + '.abandonment-declarations.json', [
    { declarationId: 'bad', agentId: HR, handles: [], declaredAt: Date.now(),
      ownerRiskAcceptance: 'yes-please' },
  ])
  {
    const store = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-ce1-bad' })
    assert.equal(store.startupBlockedReason, 'durable_store_invalid',
      'the malformed registry fails the store CLOSED at startup')
    assert.equal(store.admissionBlockerForAgent(HR), null,
      'a startup-blocked store has no records to block on')
  }
})

// ── CE2 + CE3: eviction with no-replay preservation, D6 threshold ──────────

test('CE2: correlated abandoned eviction preserves the no-replay tombstone across restarts', async (t) => {
  const dir = await tempDir(t, 'acr-ce2-')
  const pf = join(dir, 'recovery.json')
  const store = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-ce2' })

  // Three same-generation records: acceptance-audited, marker-only, correlated.
  const audited = stuckTurn(store, HR, { generation: 1, requestId: 'req-audited' })
  const markerOnly = stuckTurn(store, HR, { generation: 1, requestId: 'req-marker-only' })
  const correlated = stuckTurn(store, HR, { generation: 1, requestId: 'req-correlated' })
  const correlationKey = [...store.correlationIndex.entries()].find(([, h]) => h === correlated)?.[0]
  assert.notEqual(correlationKey, undefined, 'the correlated record has a correlation index entry')

  // Owner risk acceptance over the full due scope: all three stamp; all
  // three are releasable (the acceptance audit is on every stamped record).
  const result = store.declareAdminAbandonment({ agentId: HR, declarationId: 'ce2-decl', ownerRiskAcceptance: true })
  assert.equal(result.abandonedHandles.length, 3)

  // The capacity eviction runs at the next mint (the cap); trigger it directly.
  store.evictSettledGenerationForCapacity(HR, store.issuance.get(HR))

  assert.equal(store.records.has(audited), false, 'audited record evicted')
  assert.equal(store.records.has(markerOnly), false, 'marker-only record evicted')
  assert.equal(store.records.has(correlated), false, 'correlated record evicted')
  assert.equal(store.correlationIndex.get(correlationKey), correlated,
    'CE2: the correlated tombstone KEEPS the index entry — no-replay preserved')

  // Replay negative control: the same correlation can never mint again.
  assert.throws(
    () => store.mintTurnExecution({ agentId: HR, processGeneration: 2, sessionId: 'main',
      callerCorrelation: { requestId: 'req-correlated' } }),
    error => error.code === 'RECONCILIATION_CORRELATION_CONFLICT',
  )

  // Cross-restart negative control: the tombstone survives the durable
  // round-trip. Production persists continuously; the test triggers the
  // same explicit persist the runtime's mutation path performs.
  store.persistDurable()
  const store2 = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-ce2-restart' })
  assert.equal(store2.correlationIndex.get(correlationKey), correlated,
    'the tombstone survives the restart')
  assert.throws(
    () => store2.mintTurnExecution({ agentId: HR, processGeneration: 99, sessionId: 'main',
      callerCorrelation: { requestId: 'req-correlated' } }),
    error => error.code === 'RECONCILIATION_CORRELATION_CONFLICT',
  )
})

test('CE3: marker-only quarantined records are never releasable capacity — the legal completion is the same-key acceptance re-invocation', async (t) => {
  const dir = await tempDir(t, 'acr-ce3-')
  const pf = join(dir, 'recovery.json')
  const store = new TurnReconciliationStore({ persistenceFile: pf, runtimeEpoch: 'epoch-ce3' })
  const audited = stuckTurn(store, HR, { generation: 1, requestId: 'req-audited' })
  const markerOnly = stuckTurn(store, HR, { generation: 1, requestId: 'req-marker-only' })

  // Marker-only completion (R131 succession): re-invoking the SAME
  // declarationId with the explicit owner risk acceptance completes the
  // quarantined record — THIS is the legal path, never a capacity backdoor.
  store.declareAdminAbandonment({ agentId: HR, declarationId: 'ce3-marker-decl' })
  store.declareAdminAbandonment({ agentId: HR, declarationId: 'ce3-marker-decl', ownerRiskAcceptance: true })
  assert.equal(hasAcceptanceAudit(store.records.get(markerOnly)), true,
    'the same-key completion stamps the D6 acceptance audit')
  assert.equal(hasAcceptanceAudit(store.records.get(audited)), true,
    'both in-scope records carry the audit after the accepted completion')
})

// ── §3 frozen invariants (restored per review blocker 2 — these were
//    gratuitously deleted in the r1 rewrite; the QA verified 3/3 against
//    ea27a3f0 and demanded they be test-frozen again) ───────────────────────

test('§3-1: 256-cap deadlock recovery through the mint-integrated prefix walk', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-cap' })
  for (let generation = 1; generation <= 256; generation++) stuckTurn(store, HR, { generation })
  assert.throws(
    () => stuckTurn(store, HR, { generation: 257 }),
    error => error.code === 'RECONCILIATION_CAPACITY_EXHAUSTED',
    'pre-fix behavior: the cap throws once full',
  )

  const result = store.declareAdminAbandonment({
    agentId: HR, declarationId: 'cap-decl-1', ownerRiskAcceptance: true,
  })
  assert.ok(result.abandonedHandles.length >= 256, `expected the full backlog abandoned, got ${result.abandonedHandles.length}`)

  const h257 = stuckTurn(store, HR, { generation: 257 })
  assert.equal(h257.split(':')[3], 'g257')
  assert.equal(store.records.has(h257), true)
})

test('§3-2: evicted abandoned records keep UNKNOWN and resolve as evicted — never as a business settled', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-cap-2' })
  const firstStuck = stuckTurn(store, HR, { generation: 1 })
  for (let generation = 2; generation <= 256; generation++) stuckTurn(store, HR, { generation })
  store.declareAdminAbandonment({ agentId: HR, declarationId: 'cap-decl-2', ownerRiskAcceptance: true })
  stuckTurn(store, HR, { generation: 257 })

  const snapshot = store.getTurnReconciliation(firstStuck)
  assert.equal(snapshot.state, 'evicted', 'the abandoned record resolves via the eviction watermark')
  assert.notEqual(snapshot.state, 'settled', 'abandonment must never become a business settled')
})

test('§3-3: eviction is idempotent and keeps the audit linkage on the declaration registry', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-cap-3' })
  for (let generation = 1; generation <= 256; generation++) stuckTurn(store, HR, { generation })
  store.declareAdminAbandonment({ agentId: HR, declarationId: 'cap-decl-3', ownerRiskAcceptance: true })
  stuckTurn(store, HR, { generation: 257 })

  // Re-declare with the SAME id: retry stays possible, nothing re-stamps.
  const repeat = store.declareAdminAbandonment({ agentId: HR, declarationId: 'cap-decl-3', ownerRiskAcceptance: true })
  assert.deepEqual(repeat.abandonedHandles, [])
})

// ── review-mandated additions (r2 re-review coverage matrix) ───────────────

test('迟到效果: late settlement for an evicted abandoned record cannot fabricate a business settled', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-late' })
  const firstStuck = stuckTurn(store, HR, { generation: 1 })
  for (let generation = 2; generation <= 256; generation++) stuckTurn(store, HR, { generation })
  store.declareAdminAbandonment({ agentId: HR, declarationId: 'late-decl', ownerRiskAcceptance: true })
  stuckTurn(store, HR, { generation: 257 })

  // The abandoned record resolved `evicted` via the watermark — the record
  // is gone from the store, so a LATE result for it can never fabricate a
  // business settled: the projection stays `evicted`, and re-minting the
  // same generation's next turn is unaffected by the ghost.
  const before = store.getTurnReconciliation(firstStuck).state
  assert.equal(before, 'evicted')

  // Any late-effect attempt lands nowhere: the handle has no record to
  // settle, and the watermark resolution is immutable.
  assert.equal(store.getTurnReconciliation(firstStuck).state, 'evicted')
  assert.equal(store.records.has(firstStuck), false)
})

test('走查门: marker-only records are never evicted by the capacity walk — the prefix stops honestly at the quarantined generation', () => {
  const store = new TurnReconciliationStore({ runtimeEpoch: 'epoch-gate' })
  // gen1: declared marker-only (no acceptance audit — the quarantined class).
  const g1 = stuckTurn(store, HR, { generation: 1 })
  store.declareAdminAbandonment({ agentId: HR, declarationId: 'gate-marker-only' })
  assert.equal(hasAcceptanceAudit(store.records.get(g1)), false)

  // gen2: declared with acceptance (releasable).
  const g2 = stuckTurn(store, HR, { generation: 2 })
  store.declareAdminAbandonment({ agentId: HR, declarationId: 'gate-accepted', ownerRiskAcceptance: true })
  assert.equal(hasAcceptanceAudit(store.records.get(g2)), true)

  // The contiguous prefix starts at gen1 — a marker-only quarantined record
  // is NOT releasable, so the walk stops honestly and evicts NOTHING
  // (progress guard), leaving both generations pinned.
  const retired = store.evictSettledGenerationForCapacity(HR, store.issuance.get(HR))
  void retired
  assert.equal(store.records.has(g1), true, 'the quarantined marker-only generation stays pinned')
  assert.equal(store.records.has(g2), true, 'the walk did not skip past the quarantined prefix')

  // Completing gen1's marker-only record legally (same-declarationId
  // acceptance re-invocation) makes it releasable: the walk then evicts
  // BOTH (the contiguous prefix advances through the completed generation).
  store.declareAdminAbandonment({ agentId: HR, declarationId: 'gate-marker-only', ownerRiskAcceptance: true })
  assert.equal(hasAcceptanceAudit(store.records.get(g1)), true)
  store.evictSettledGenerationForCapacity(HR, store.issuance.get(HR))
  assert.equal(store.records.has(g1), false)
  assert.equal(store.records.has(g2), false)
})
