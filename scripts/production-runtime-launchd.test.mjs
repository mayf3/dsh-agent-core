// Focused offline test for the production-runtime-launchd plist template's
// FROZEN scheduler verifier seam (Product #425 CONFIG_SOURCE_FIX). The
// 2026-10-02 HR availability incident regressed the live plist to
// SCHEDULER_AUTH_AUDIENCE=agent-platform — an audience that does not exist in
// Minimal Auth V1 — because the template never pinned the triple. These tests
// pin the rendered values so any future regeneration (and any regression)
// is caught before install. Zero network, zero production contact.

import assert from 'node:assert/strict'
import test from 'node:test'

import { FROZEN_SCHEDULER_AUTH, renderPlist } from './production-runtime-launchd.mjs'

function render() {
  return renderPlist({
    root: '/tmp/launchd-test-root',
    label: 'ai.agent-core.runtime',
    nodeBin: '/usr/local/bin/node',
    harness: '/tmp/harness',
    runtimeScript: '/tmp/app/scripts/production-runtime.mjs',
    workingDir: '/tmp/app',
  })
}

test('frozen scheduler auth triple is the Minimal Auth V1 production shape', () => {
  assert.deepEqual(FROZEN_SCHEDULER_AUTH, {
    jwksUrl: 'http://127.0.0.1:4001/.well-known/jwks.json',
    issuer: 'auth-service',
    audience: 'scheduler',
  })
})

test('rendered plist always carries the scheduler verifier env triple', () => {
  const plist = render()
  assert.match(plist, /<key>SCHEDULER_AUTH_AUDIENCE<\/key><string>scheduler<\/string>/)
  assert.match(plist, /<key>SCHEDULER_AUTH_ISSUER<\/key><string>auth-service<\/string>/)
  assert.match(plist, /<key>SCHEDULER_AUTH_JWKS_URL<\/key><string>http:\/\/127\.0\.0\.1:4001\/\.well-known\/jwks\.json<\/string>/)
})

test('rendered plist never regresses to a non-existent audience (Product #425 incident value)', () => {
  const plist = render()
  assert.ok(!plist.includes('agent-platform'), 'rendered plist must never carry the phantom agent-platform audience')
  for (const line of plist.split('\n')) {
    if (line.includes('<key>SCHEDULER_AUTH_AUDIENCE</key>')) {
      assert.equal(line.trim(), '<key>SCHEDULER_AUTH_AUDIENCE</key><string>scheduler</string>')
    }
  }
})

test('scheduler auth triple is frozen output, not installer-shell pass-through', () => {
  const previous = { ...process.env }
  try {
    process.env.SCHEDULER_AUTH_AUDIENCE = 'agent-platform'
    process.env.SCHEDULER_AUTH_ISSUER = 'something-else'
    const plist = render()
    assert.match(plist, /<key>SCHEDULER_AUTH_AUDIENCE<\/key><string>scheduler<\/string>/)
    assert.ok(!plist.includes('agent-platform'))
  } finally {
    process.env = previous
  }
})
