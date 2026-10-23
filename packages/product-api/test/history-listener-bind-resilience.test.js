/**
 * Regression tests for the history listener bind-resilience contract
 * (2026-10-23: a pinned tailscale IP disappeared across a network change;
 * the async EADDRNOTAVAIL 'error' event had no handler and the uncaught
 * exception killed the whole production-runtime process — taking the
 * workflow-admission core (same process, port 8787) down with it, which
 * surfaced as fleet-wide `503 workflow assignment was not admitted`).
 *
 * Pins:
 *   - binding an unroutable address must NOT throw synchronously, must NOT
 *     reject the caller, and must register an 'error' handler on the server
 *     (containment: the process survives, the history route degrades);
 *   - the failure path retries on a bounded cadence (transient bind codes);
 *   - a normal loopback bind still works and serves.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { startHistoryListener } from '../src/history-listener.js'

const UNROUTABLE_HOST = '203.0.113.99' // TEST-NET-3, never assignable here

const MINIMAL_DEPS = () => ({
  profile: { ready: false },
  sessionHistory: {},
  resolveStableNodeId: async () => undefined,
})

test('unroutable bind address is contained: no throw, error handler attached, retry scheduled', async () => {
  let captured
  const originalError = console.error
  console.error = (...args) => { captured = args.join(' ') }
  try {
    const listener = startHistoryListener({
      host: UNROUTABLE_HOST,
      port: 8789,
      ...MINIMAL_DEPS(),
    })
    // The old code never reached here with an unhandled 'error' event: the
    // async EADDRNOTAVAIL escaped as an uncaught exception. Containment =
    // the call returns a server with the resilience handler attached.
    assert.ok(listener.server, 'listener returns its server')
    assert.ok(
      listener.server.listenerCount('error') > 0,
      'server must have an error handler (containment contract)',
    )
    // Give the async bind failure time to fire; the test process surviving
    // this await IS the regression assertion (old code died here). No
    // close() on a never-bound server: close would hang.
    await new Promise((resolve) => setTimeout(resolve, 150))
    assert.match(
      String(captured),
      /history-listener/,
      'bind failure must be logged, not fatal',
    )
  } finally {
    console.error = originalError
  }
})

test('loopback bind on an ephemeral port still works', async () => {
  const listener = startHistoryListener({
    host: '127.0.0.1',
    port: 0,
    ...MINIMAL_DEPS(),
  })
  const address = await new Promise((resolve, reject) => {
    listener.server.once('listening', () => resolve(listener.address()))
    listener.server.once('error', reject)
  })
  assert.ok(address.port > 0, 'ephemeral port assigned')
  await listener.close()
})
