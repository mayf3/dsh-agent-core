/**
 * #707 due-feed flood fix, slice ③ — WORKFLOW_EXECUTION_DUE_FEED_LIMIT env
 * surface: the poller's per-sweep due-feed batch size is env-configurable
 * (strict positive integer, fail-loud) instead of hardcoded 100.
 *
 * Frozen invariants:
 *   - unset/'' → fallback 100 (svc-workflow hard cap, unchanged default)
 *   - valid override → effective limit changes (deployment knob for the
 *     #707 due-feed flood model: keep ≤ the child turn-queue cap minus
 *     headroom)
 *   - garbage ('0', '1e6', 'abc', negative, decimals) → TypeError
 *     (fail-loud; a silently-degraded limit would be an invisible policy)
 *   - module default resolves from the real env at load time
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { DUE_FEED_LIMIT, resolveDueFeedLimit, WORKFLOW_EXECUTION_DUE_FEED_LIMIT_ENV } from '../src/workflow-execution-runtime.js'

test('resolveDueFeedLimit: unset/empty → fallback 100 (default unchanged)', () => {
  assert.equal(resolveDueFeedLimit(undefined), 100)
  assert.equal(resolveDueFeedLimit(''), 100)
})

test('resolveDueFeedLimit: valid override', () => {
  assert.equal(resolveDueFeedLimit('16'), 16)
  assert.equal(resolveDueFeedLimit('100'), 100)
  assert.equal(resolveDueFeedLimit('1'), 1)
})

test('resolveDueFeedLimit: garbage fails loud (TypeError naming the env)', () => {
  for (const bad of ['0', '1e6', 'abc', '-5', '1.5', '0x10', '3600abc']) {
    assert.throws(
      () => resolveDueFeedLimit(bad),
      error => error instanceof TypeError && /WORKFLOW_EXECUTION_DUE_FEED_LIMIT/.test(error.message),
      `expected TypeError for ${JSON.stringify(bad)}`,
    )
  }
})

test('resolveDueFeedLimit: shared resolver trims surrounding whitespace (documented contract)', () => {
  assert.equal(resolveDueFeedLimit(' 16'), 16)
  assert.equal(resolveDueFeedLimit('16 '), 16)
})

test('module default resolves from the real env at load time', async () => {
  const saved = process.env[WORKFLOW_EXECUTION_DUE_FEED_LIMIT_ENV]
  delete process.env[WORKFLOW_EXECUTION_DUE_FEED_LIMIT_ENV]
  try {
    const mod = await import('../src/workflow-execution-runtime.js')
    assert.equal(mod.DUE_FEED_LIMIT, 100)
    assert.equal(mod.WORKFLOW_EXECUTION_DUE_FEED_LIMIT_ENV, 'WORKFLOW_EXECUTION_DUE_FEED_LIMIT')
  } finally {
    if (saved !== undefined) process.env[WORKFLOW_EXECUTION_DUE_FEED_LIMIT_ENV] = saved
  }
})
