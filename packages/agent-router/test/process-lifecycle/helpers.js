/**
 * AGENT_PROCESS_LIFECYCLE_HARDENING_V2 §10.3 suite helpers — shared by the
 * process-lifecycle/ split test files (startup / rpc / pipe-failure /
 * correlation / timeout / late-settlement / shutdown / evidence-caps).
 *
 * Structure refactor only: every assertion helper is byte-identical to the
 * former single-file process-lifecycle.test.js preamble.
 */

import assert from 'node:assert/strict'

export { makeFx } from '../helpers/fake-child.js'

export const prompts = (fx) => fx.writes.filter((write) => write.method === 'session/prompt')

/** Slot-op sequence in compact form: ['casReap:g1', 'casEmpty:g1', ...]. */
export const slotSeq = (fx) => fx.slotOps.map(op => `${op.op}:g${op.generation}`)

export function firstHandle(fx) {
  return fx.store.records.keys().next().value
}

export async function rejectsWith(promise, check) {
  let observed = null
  try { await promise } catch (error) { observed = error }
  assert.ok(observed !== null, 'expected the promise to reject')
  await check(observed)
  return observed
}
