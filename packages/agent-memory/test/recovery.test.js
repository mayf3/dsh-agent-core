/**
 * recoverSource() tests (SIGTRAP fix v1) — the migration tool's mechanical
 * recovery contract: maximal unwrap of esc^k layers, unique logical
 * recovery, ambiguity flagged (never guessed) when the candidate still
 * carries a `\`+ESCAPE pair or the unwrap bound is hit.
 */

import assert from 'node:assert/strict'
import { test, describe } from 'node:test'

import { isEscapeCanonical, recoverSource, MEMORY_GUARD_LIMITS, MIGRATION_GUARD_LIMITS } from '../src/memory.js'

// The historical asymmetric codec (exact pre-fix semantics).
const ESCAPE = /([\\`*_[\]{}()#+.!|>~-])/g
const oldEsc = (t) => String(t).replace(ESCAPE, '\\$1')

describe('recoverSource: mechanical esc^k recovery', () => {
  const SEEDS = [
    'consolidation:session:cron-run-occ:47081',
    '2026-08-24/25 老板拍板 + 执行验证',
    'tool (v1.0)',
    'https://example.com/a?b=c#frag',
  ]

  for (const seed of SEEDS) {
    test(`recovers exactly across 16 amplification layers: ${seed.slice(0, 24)}`, () => {
      let stored = seed
      for (let k = 1; k <= 16; k++) {
        stored = oldEsc(stored)
        const r = recoverSource(stored, MIGRATION_GUARD_LIMITS)
        assert.equal(r.source, seed, `layer ${k}: logical recovery mismatch`)
        assert.equal(r.layers, k, `layer ${k}: layer count mismatch`)
        assert.equal(r.ambiguous, false, `layer ${k}: wrongly flagged ambiguous`)
      }
    })
  }

  test('deep amplification (21 layers, production corpus scale) recovers exactly', () => {
    const seed = '2026-08-27 与小马哥对话' // 17-char class of real corpus candidates
    let stored = seed
    for (let k = 0; k < 21; k++) stored = oldEsc(stored)
    assert.ok(stored.length > 4_000_000) // genuinely in the pathological region (2 specials × 2^21)
    const r = recoverSource(stored, MIGRATION_GUARD_LIMITS)
    assert.equal(r.source, seed)
    assert.equal(r.layers, 21)
    assert.equal(r.ambiguous, false)
  })

  test('zero-layer stored values (no specials) are their own original', () => {
    const r = recoverSource('consolidation:session:main')
    assert.equal(r.source, 'consolidation:session:main')
    assert.equal(r.layers, 0)
    assert.equal(r.ambiguous, false)
  })

  test('backslash-bearing originals without special pairs recover exactly', () => {
    // C:\Users\yanfenma — `\U`,`\y` are NOT escape pairs; esc only doubles
    // the backslashes; unwrapping stops at the true original.
    const seed = 'C:\\Users\\yanfenma\\notes'
    let stored = seed
    for (let k = 0; k < 5; k++) stored = oldEsc(stored)
    const r = recoverSource(stored, MIGRATION_GUARD_LIMITS)
    assert.equal(r.source, seed)
    assert.equal(r.layers, 5)
    assert.equal(r.ambiguous, false)
  })

  test('a lone-backslash original recovers exactly through the fixpoint rule', () => {
    const seed = '\\' // single literal backslash
    let stored = seed
    for (let k = 0; k < 4; k++) stored = oldEsc(stored)
    const r = recoverSource(stored, MIGRATION_GUARD_LIMITS)
    assert.equal(r.source, seed)
    assert.equal(r.ambiguous, false)
  })

  test('canonical-with-pairs originals resolve by the declared maximal-unwrap prior (deterministic)', () => {
    // original `\*` (backslash-star) is escape-canonical: its stored value is
    // byte-identical to amplified `*`. The rule resolves deterministically to
    // the maximal unwrap; the layer count records the alternative (which only
    // differs in backslash placement of the metadata, never in visible text).
    let stored = '\\*'
    for (let k = 0; k < 3; k++) stored = oldEsc(stored)
    const r1 = recoverSource(stored, MIGRATION_GUARD_LIMITS)
    const r2 = recoverSource(stored, MIGRATION_GUARD_LIMITS)
    assert.deepEqual(r1, r2) // deterministic: same bytes → same recovery, no guessing
    assert.ok(r1.layers >= 1)
  })

  test('unwrap bound is honored and flagged (ambiguous = true, no guessing)', () => {
    const limits = { ...MEMORY_GUARD_LIMITS, maxRecoveryLayers: 3 }
    let stored = 'session 2026-08-24 床笠调研'
    for (let k = 0; k < 10; k++) stored = oldEsc(stored)
    const r = recoverSource(stored, limits)
    assert.equal(r.bounded, true)
    assert.equal(r.ambiguous, true)
    assert.equal(r.layers, 3)
  })

  test('isEscapeCanonical matches the image of esc', () => {
    assert.equal(isEscapeCanonical(oldEsc('tool (v1.0)')), true)
    assert.equal(isEscapeCanonical('tool (v1.0)'), false) // bare specials
    assert.equal(isEscapeCanonical('plainmain'), true) // esc is a no-op here
    assert.equal(isEscapeCanonical('C:\\Users\\x'), false) // bare backslash+non-special
  })
})
