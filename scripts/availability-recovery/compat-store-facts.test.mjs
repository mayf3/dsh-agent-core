import assert from 'node:assert/strict'
import test from 'node:test'
import { assertRouterFacts } from './compat-store-facts.mjs'

const action = time => ({ action: 'ownership_check', result: 'blocked',
  observedAtWallMs: time, reasonCode: 'runtime_restart_ownership_unavailable' })
const snapshot = actions => ({ runtimeEpoch: 'old', runtimeEpochs: ['old'],
  issuance: [['agent', 1]], records: [{ handle: 'old:agent:1:1', runtimeEpoch: 'old',
    agentId: 'agent', state: 'blocked', initialOutcome: 'outcome_unknown',
    fenceState: 'active', settlementResult: null, terminationEvidence: null,
    finalAssistantOutputEvidence: { sha256: 'a'.repeat(64) }, bytes: 512,
    updatedAt: 100, attemptedActions: actions }] })
const append = (before, entries) => {
  const after = structuredClone(before)
  after.records[0].attemptedActions.push(...entries)
  after.records[0].attemptedActions = after.records[0].attemptedActions.slice(-32)
  after.records[0].updatedAt = 200
  return after
}

test('startup facts allow bounded audit append and oldest-prefix ring rollover', () => {
  for (const entries of [[], [action(1)], Array.from({ length: 32 }, (_, n) => action(n + 1))]) {
    const before = snapshot(entries)
    assertRouterFacts(before, before)
    assertRouterFacts(before, append(before, [action(150), action(151)]))
  }
})

test('startup facts reject unbounded audit count and UTF-8 bytes', () => {
  const before = snapshot([action(1)])
  const count = append(before, [])
  count.records[0].attemptedActions = Array.from({ length: 33 }, (_, n) => action(n))
  assert.throws(() => assertRouterFacts(before, count), /audit count cap/)
  const bytes = append(before, [{ ...action(150), reasonCode: '界'.repeat(22000) }])
  assert.throws(() => assertRouterFacts(before, bytes), /audit byte cap/)
})

test('startup facts reject audit rewrite, reorder, deletion and unproven full replacement', () => {
  const before = snapshot([action(1), action(2), action(3)])
  for (const actions of [[action(1), action(99), action(3)], [action(2), action(1), action(3)],
    [action(2), action(3)], [action(150), action(151), action(152)]]) {
    const after = structuredClone(before)
    after.records[0].attemptedActions = actions
    assert.throws(() => assertRouterFacts(before, after), /audit must append/)
  }
})

test('startup facts reject malformed appended audit and business fact changes or record deletion', () => {
  const before = snapshot([action(1)])
  for (const bad of [{ ...action(150), action: 'invented' }, { ...action(150), result: 'invented' },
    { ...action(150), observedAtWallMs: -1 }, { ...action(150), reasonCode: 'x'.repeat(257) },
    { ...action(150), payload: 'forbidden' }]) {
    assert.throws(() => assertRouterFacts(before, append(before, [bad])))
  }
  for (const [key, value] of Object.entries({ initialOutcome: 'completed', fenceState: 'cleared',
    settlementResult: 'terminated_without_outcome', terminationEvidence: { kind: 'invented' },
    agentId: 'other', finalAssistantOutputEvidence: null })) {
    const after = append(before, [action(150)])
    after.records[0][key] = value
    assert.throws(() => assertRouterFacts(before, after), /every business\/evidence field preserved/)
  }
  const deleted = structuredClone(before)
  deleted.records.pop()
  assert.throws(() => assertRouterFacts(before, deleted), /no lost\/added records/)
})
