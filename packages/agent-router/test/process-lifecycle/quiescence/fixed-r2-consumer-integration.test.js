import assert from 'node:assert/strict'
import { lstatSync, readFileSync, renameSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fixedR2Fixture } from '../../helpers/fixed-r2-consumer-fixture.js'

const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}
function change(fx, name, mutate) {
  const path = join(fx.evidenceDir, name)
  const value = JSON.parse(readFileSync(path, 'utf8'))
  writeFileSync(path, canonical(mutate(value) ?? value), { mode: 0o600 })
}
function zeroConsumption(fx) {
  const before = readFileSync(fx.persistenceFile)
  const result = fx.store.consumeStartupQuiescence(fx)
  assert.equal(result.some(row => row.status === 'settled' || row.status === 'duplicate_ignored'), false, JSON.stringify(result))
  assert.deepEqual(readFileSync(fx.persistenceFile), before)
  assert.equal(fx.store.records.get(fx.handle).fenceState, 'active')
  return result
}

test('synthetic Python fixed journal bundle reaches actual startup V2 consumer once', t => {
  const fx = fixedR2Fixture(cleanup => t.after(cleanup))
  const emissions = []
  fx.store.onTurnReconciled(event => emissions.push(event))
  const result = fx.store.consumeStartupQuiescence(fx)
  assert.deepEqual(result.map(row => row.status), ['settled'], JSON.stringify(result))
  assert.equal(fx.store.records.get(fx.handle).terminationEvidence, 'restart_quiescence_proven')
  const winning = () => Object.fromEntries(['handle', 'settledAtWallMs', 'terminationEvidence',
    'lateOutcome', 'initialOutcome', 'exitObservedAt', 'fenceState', 'recoveryState',
    'settlementResult', 'nextSafeAction'].map(key => [key, fx.store.records.get(fx.handle)[key]]))
  const original = winning()
  const commitment = readFileSync(join(fx.evidenceDir, 'bundle-commitment.json'))
  // Accepted V2 RQ-004 / ACC-RQ-011: exact same-window duplicate may append
  // only bounded duplicate_ignored audit; it must not rewrite the winner or emit.
  assert.deepEqual(fx.store.consumeStartupQuiescence(fx).map(row => row.status), ['duplicate_ignored'])
  assert.deepEqual(winning(), original)
  assert.deepEqual(readFileSync(join(fx.evidenceDir, 'bundle-commitment.json')), commitment)
  assert.equal(fx.store.activeFenceForAgent('agt_hr-agent'), null)
  assert.equal(emissions.length, 1)
  const before = readFileSync(fx.persistenceFile)
  change(fx, 'bundle.json', value => { value.hostCensus.executedAtWallMs += 1 })
  assert.equal(fx.store.consumeStartupQuiescence(fx)[0].status, 'rejected')
  assert.deepEqual(readFileSync(fx.persistenceFile), before)
})

test('fixed producer interop rejects filename, bare/wrong authorization, phase, nonce and changed bundle', async t => {
  const cases = {
    'wrong filename': fx => renameSync(fx.bundleFile, join(fx.evidenceDir, 'wrong.bundle.json')),
    'bare authorization': fx => change(fx, 'launch-authorization.json', value => value.authorization),
    'extra authorization field': fx => change(fx, 'launch-authorization.json', value => { value.unexpected = true }),
    'changed bundle': fx => change(fx, 'bundle.json', value => { value.holderCheck.paths = ['/synthetic/substitution'] }),
    'wrong phase': fx => change(fx, 'phase-launch-attempt.json', value => { value.phase = 'SEALED_NOT_ATTEMPTED' }),
    'wrong nonce': fx => { fx.startup.startupNonce = 'wrong-nonce' },
    'duplicate receipt metadata': fx => { const path = join(fx.evidenceDir, 'bundle-commitment.json'); const raw = readFileSync(path, 'utf8'); writeFileSync(path, raw.replace('{', '{"operationId":"privatePayload",')) },
    'unknown operation': fx => writeFileSync(join(fx.evidenceDir, 'phase-unknown.json'), '{}', { mode: 0o600 }),
    'missing claim': fx => renameSync(join(fx.evidenceDir, 'launch-claimed.json'), join(fx.evidenceDir, 'unused-claim.json')),
    'symlink receipt': fx => { const path = join(fx.evidenceDir, 'launch-authorization.json'); renameSync(path, path + '.copy'); symlinkSync(path + '.copy', path) },
  }
  for (const [name, mutate] of Object.entries(cases)) await t.test(name, sub => {
    const fx = fixedR2Fixture(cleanup => sub.after(cleanup))
    mutate(fx)
    zeroConsumption(fx)
    zeroConsumption(fx) // No write, release or recovery on repeat UNKNOWN inputs.
  })
})

test('UNKNOWN/denied readback emerging after initial verification is rechecked before settlement', t => {
  const fx = fixedR2Fixture(cleanup => t.after(cleanup))
  let challenges = 0
  const original = fx.io.challengeWindow
  fx.io.challengeWindow = (fd, challenge) => {
    if (++challenges === 3) writeFileSync(join(fx.evidenceDir, 'phase-unknown.json'), '{}', { mode: 0o600 })
    return original(fd, challenge)
  }
  zeroConsumption(fx)
})

test('surrogate custody cannot authenticate a real root holder or missing source closure', t => {
  const fx = fixedR2Fixture(cleanup => t.after(cleanup))
  fx.io.stat = path => lstatSync(path) // Restore real nonroot identity.
  zeroConsumption(fx)
  fx.io.stat = path => ({ ...lstatSync(path), uid: 0 })
  fx.io.challengeWindow = (_fd, challenge) => ({ ...challenge, exclusiveWindowHeld: true,
    launchSourcesStillInhibited: false, windowClosed: false })
  zeroConsumption(fx)
})
