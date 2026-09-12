/**
 * Focused tests for the PRODUCT_API_AUTHENTICATION_V1 admission layer
 * (packages/product-api/src/history-auth.js): peer canonicalization matrix
 * (CTR-PA-013), surface header canonical-encoding matrix (CTR-PA-003),
 * out-of-Git config schema/readiness matrix (CTR-PA-005), the frozen 403/503
 * bipartition with the admission order (CTR-PA-006/CTR-PA-007), exact pair
 * matching including the transient `Node.ID` negative (CTR-PA-004/ACC-PA-V),
 * and the trusted authContext shape (no StableID, no Binding, CTR-PA-003).
 */

import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  admitHistoryRequest,
  canonicalizePeerAddress,
  FORBIDDEN,
  loadAuthConfigProfile,
  NOT_READY,
  verifiedSurfaceId,
} from '../src/history-auth.js'

const TMP = mkdtempSync(join(os.tmpdir(), 'history-auth-test-'))
const VALID_SURFACE = '3f2a1b4c-5d6e-4f70-8a90-1b2c3d4e5f60'

const validConfig = {
  version: 1,
  generation: 'gen-abc',
  profile: 'local-tailnet-mobile-history-v1',
  allowedCallers: [
    { tailscaleStableNodeId: 'node:phone-1', surfaceId: VALID_SURFACE },
  ],
}

function writeConfig(name, payload) {
  const path = join(TMP, name)
  writeFileSync(path, typeof payload === 'string' ? payload : JSON.stringify(payload))
  chmodSync(path, 0o600)
  return path
}

test('C1 peer canonicalization matrix (CTR-PA-013 / ACC-PA-P)', () => {
  assert.equal(canonicalizePeerAddress('100.64.0.7').canonical, '100.64.0.7')
  assert.equal(canonicalizePeerAddress('fd7a:115c:a1e0:0::1').canonical, 'fd7a:115c:a1e0::1')
  // IPv4-mapped IPv6 and plain IPv4 are the SAME identity.
  assert.equal(canonicalizePeerAddress('::ffff:100.64.0.7').canonical, '100.64.0.7')
  assert.equal(canonicalizePeerAddress('::FFFF:100.64.0.7').canonical, '100.64.0.7')
  // Scope zone → unknown (503 class), never a Node address.
  assert.deepEqual(canonicalizePeerAddress('fe80::1%en0'), { ok: false, unknown: true })
  // Non-IP literal → fail closed.
  assert.deepEqual(canonicalizePeerAddress('phone.tailnet.example'), { ok: false, unknown: true })
  assert.deepEqual(canonicalizePeerAddress(''), { ok: false, unknown: true })
  // Zero-run compression stays canonical and lowercase.
  assert.equal(canonicalizePeerAddress('FD7A:115C:A1E0:0000:0000:0000:0000:0001').canonical, 'fd7a:115c:a1e0::1')
})

test('C2 surface header matrix: only canonical lowercase UUID v4 passes (ACC-PA-G)', () => {
  assert.equal(verifiedSurfaceId({ 'x-agentcore-surface-id': VALID_SURFACE }), VALID_SURFACE)
  const rejected = [
    {},
    { 'x-agentcore-surface-id': '' },
    { 'x-agentcore-surface-id': VALID_SURFACE.toUpperCase() },
    { 'x-agentcore-surface-id': ` ${VALID_SURFACE}` },
    { 'x-agentcore-surface-id': `${VALID_SURFACE} ` },
    { 'x-agentcore-surface-id': '{3f2a1b4c-5d6e-4f70-8a90-1b2c3d4e5f60}' },
    { 'x-agentcore-surface-id': 'urn:uuid:3f2a1b4c-5d6e-4f70-8a90-1b2c3d4e5f60' },
    { 'x-agentcore-surface-id': '3f2a1b4c5d6e4f708a901b2c3d4e5f60' },
    { 'x-agentcore-surface-id': '3f2a1b4c-5d6e-4f70-8a90-1b2c3d4e5f6g' },
    { 'x-agentcore-surface-id': '3f2a1b4c-5d6e-4f70-0a90-1b2c3d4e5f60' }, // version nibble ≠ 4
    { 'x-agentcore-surface-id': '3f2a1b4c-5d6e-4f70-ca90-1b2c3d4e5f60' }, // variant nibble ∉ {8,9,a,b}
    { 'x-agentcore-surface-id': `${VALID_SURFACE}, other` }, // comma list
    { 'x-agentcore-surface-id': ['x', 'y'] }, // duplicate field line → array in Node
  ]
  for (const headers of rejected) {
    assert.equal(verifiedSurfaceId(headers), null, JSON.stringify(headers))
  }
})

test('C3 config readiness matrix: every failure is PROFILE_NOT_READY, valid config yields digest (ACC-PA-I)', () => {
  // Missing file.
  assert.equal(loadAuthConfigProfile(join(TMP, 'nope.json')).ready, false)
  assert.equal(loadAuthConfigProfile(undefined).ready, false)

  // Valid config → ready + generation digest that hides the raw value.
  const good = loadAuthConfigProfile(writeConfig('good.json', validConfig))
  assert.equal(good.ready, true)
  assert.equal(typeof good.generationDigest, 'string')
  assert.equal(good.generationDigest.length, 64)
  assert.ok(!JSON.stringify(good).includes('gen-abc'))
  assert.ok(good.pairs.has('node:phone-1\u0000' + VALID_SURFACE))

  // Permission wider than 0600.
  const loose = writeConfig('loose.json', validConfig)
  chmodSync(loose, 0o644)
  assert.equal(loadAuthConfigProfile(loose).ready, false)

  // Symlink.
  const target = writeConfig('target.json', validConfig)
  const link = join(TMP, 'link.json')
  rmSync(link, { force: true })
  symlinkSync(target, link)
  assert.equal(loadAuthConfigProfile(link).ready, false)

  // Directory / device-ish (directory covers non-regular).
  mkdirSync(join(TMP, 'adir.json'), { recursive: true })
  assert.equal(loadAuthConfigProfile(join(TMP, 'adir.json')).ready, false)

  // Bad JSON.
  assert.equal(loadAuthConfigProfile(writeConfig('bad.json', '{nope')).ready, false)

  const broken = (name, mutate) => {
    const clone = structuredClone(validConfig)
    mutate(clone)
    return loadAuthConfigProfile(writeConfig(name, clone)).ready
  }
  assert.equal(broken('unknown-field.json', (c) => { c.extra = true }), false)
  assert.equal(broken('wrong-version.json', (c) => { c.version = 2 }), false)
  assert.equal(broken('wrong-profile.json', (c) => { c.profile = 'other' }), false)
  assert.equal(broken('no-generation.json', (c) => { delete c.generation }), false)
  assert.equal(broken('empty-generation.json', (c) => { c.generation = '' }), false)
  assert.equal(broken('empty-allowlist.json', (c) => { c.allowedCallers = [] }), false, 'empty allowlist ≠ allow all; it is PROFILE_NOT_READY')
  assert.equal(broken('dup-pair.json', (c) => { c.allowedCallers.push({ ...c.allowedCallers[0] }) }), false)
  assert.equal(broken('bad-surface.json', (c) => { c.allowedCallers[0].surfaceId = 'NOT-A-UUID' }), false)
  assert.equal(broken('extra-pair-field.json', (c) => { c.allowedCallers[0].note = 'x' }), false)
})

/** Admission harness: WhoIs resolver stub keyed by canonical peer IP. */
function admissionHarness({ profile, whoisByIp, remoteAddress, headers, routeClass }) {
  const calls = { history: 0 }
  const resolveStableNodeId = async (canonicalIp) => {
    const entry = whoisByIp[canonicalIp]
    if (entry === undefined) return { ok: false }
    return typeof entry === 'string' ? { ok: true, stableNodeId: entry } : { ok: false }
  }
  const decision = () => admitHistoryRequest({
    routeClass,
    socket: { remoteAddress },
    headers,
    profile,
    resolveStableNodeId,
  })
  return { calls, decision }
}

const routeClass = { rawAgentId: 'agt_test', rawSelector: 'main' }
const headers = { 'x-agentcore-surface-id': VALID_SURFACE }

test('C4 admission: non-history route class is 403 with zero WhoIs work (CTR-PA-001/CTR-PA-006 step 1)', async () => {
  const profile = loadAuthConfigProfile(writeConfig('c4.json', validConfig))
  const { decision } = admissionHarness({
    profile,
    whoisByIp: { '100.64.0.7': 'node:phone-1' },
    remoteAddress: '100.64.0.7',
    headers,
    routeClass: null,
  })
  assert.equal((await decision()).decision, 'forbidden')
  const { decision: methodDecision } = admissionHarness({
    profile,
    whoisByIp: { '100.64.0.7': 'node:phone-1' },
    remoteAddress: '100.64.0.7',
    headers,
    routeClass: null,
  })
  assert.equal((await methodDecision()).decision, 'forbidden')
})

test('C5 admission 503 matrix: not-ready config, unknown peer, whois failure (CTR-PA-007)', async () => {
  const notReady = loadAuthConfigProfile(join(TMP, 'missing-c5.json'))
  const { decision } = admissionHarness({
    profile: notReady,
    whoisByIp: { '100.64.0.7': 'node:phone-1' },
    remoteAddress: '100.64.0.7',
    headers,
    routeClass,
  })
  assert.equal((await decision()).decision, 'not_ready')

  const ready = loadAuthConfigProfile(writeConfig('c5-ready.json', validConfig))
  // Unknown peer IP (no WhoIs match → ACC-PA-E(b) loopback/unknown).
  const unknownPeer = admissionHarness({
    profile: ready,
    whoisByIp: {},
    remoteAddress: '127.0.0.1',
    headers,
    routeClass,
  })
  assert.equal((await unknownPeer.decision()).decision, 'not_ready')

  // WhoIs transport failure stubbed as {ok:false} for a real peer.
  const failingWhois = admissionHarness({
    profile: ready,
    whoisByIp: { '100.64.0.7': { ok: false } },
    remoteAddress: '100.64.0.7',
    headers,
    routeClass,
  })
  assert.equal((await failingWhois.decision()).decision, 'not_ready')

  // Zoned/unparseable peer address → unknown → 503.
  const zoned = admissionHarness({
    profile: ready,
    whoisByIp: {},
    remoteAddress: 'fe80::1%en0',
    headers,
    routeClass,
  })
  assert.equal((await zoned.decision()).decision, 'not_ready')
})

test('C6 admission 403 matrix: unlisted Node, cross pair, wrong surface, bad header (CTR-PA-007)', async () => {
  const ready = loadAuthConfigProfile(writeConfig('c6.json', validConfig))
  const base = { profile: ready, headers, routeClass }

  // Arbitrary Tailnet member (ACC-PA-D).
  assert.equal(
    (await admissionHarness({ ...base, whoisByIp: { '100.64.0.9': 'node:stranger' }, remoteAddress: '100.64.0.9' }).decision()).decision,
    'forbidden',
  )
  // Mac local Node (ACC-PA-E(a)).
  assert.equal(
    (await admissionHarness({ ...base, whoisByIp: { '100.64.0.9': 'node:macbook' }, remoteAddress: '100.64.0.9' }).decision()).decision,
    'forbidden',
  )
  // Allowed Node + wrong surface (ACC-PA-B).
  assert.equal(
    (await admissionHarness({ ...base, whoisByIp: { '100.64.0.7': 'node:phone-1' }, headers: { 'x-agentcore-surface-id': '00000000-0000-4000-8000-000000000000' }, remoteAddress: '100.64.0.7' }).decision()).decision,
    'forbidden',
  )
  // Wrong Node + allowed surface (cross pair, ACC-PA-C).
  assert.equal(
    (await admissionHarness({ ...base, whoisByIp: { '100.64.0.7': 'node:stranger' }, remoteAddress: '100.64.0.7' }).decision()).decision,
    'forbidden',
  )
  // Missing surface header.
  assert.equal(
    (await admissionHarness({ ...base, whoisByIp: { '100.64.0.7': 'node:phone-1' }, headers: {}, remoteAddress: '100.64.0.7' }).decision()).decision,
    'forbidden',
  )
  // Non-canonical surface header.
  assert.equal(
    (await admissionHarness({ ...base, whoisByIp: { '100.64.0.7': 'node:phone-1' }, headers: { 'x-agentcore-surface-id': VALID_SURFACE.toUpperCase() }, remoteAddress: '100.64.0.7' }).decision()).decision,
    'forbidden',
  )
  // Transient Node.ID numeric text configured as the StableID never matches
  // the WhoIs-resolved StableID (ACC-PA-V(b)): the caller's real identity is
  // the stable string, so the misconfigured numeric entry mismatches → 403.
  const transientConfig = structuredClone(validConfig)
  transientConfig.allowedCallers[0].tailscaleStableNodeId = '12345'
  const transientProfile = loadAuthConfigProfile(writeConfig('c6-transient.json', transientConfig))
  assert.equal(transientProfile.ready, true)
  assert.equal(
    (await admissionHarness({ profile: transientProfile, whoisByIp: { '100.64.0.7': 'node:phone-1' }, headers, remoteAddress: '100.64.0.7', routeClass }).decision()).decision,
    'forbidden',
  )
})

test('C7 allow path: exact pair yields the frozen trusted authContext, no StableID inside (CTR-PA-003)', async () => {
  const ready = loadAuthConfigProfile(writeConfig('c7.json', validConfig))
  const { decision } = admissionHarness({
    profile: ready,
    whoisByIp: { '100.64.0.7': 'node:phone-1' },
    remoteAddress: '::ffff:100.64.0.7', // mapped form resolves to the same identity
    headers,
    routeClass,
  })
  const result = await decision()
  assert.equal(result.decision, 'allow')
  assert.deepEqual(result.authContext, {
    principalType: 'mobile_tailnet_node',
    surfaceId: VALID_SURFACE,
    authProfile: 'local-tailnet-mobile-history-v1',
    configGeneration: ready.generationDigest,
  })
  const wire = JSON.stringify(result.authContext)
  assert.ok(!wire.includes('node:phone-1'), 'raw StableID MUST NOT travel in the authContext')
  assert.ok(!wire.toLowerCase().includes('binding'), 'no Binding data in the authContext')
})
