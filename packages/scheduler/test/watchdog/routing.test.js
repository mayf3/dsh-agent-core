import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chmod, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  ROUTE_CLASSES,
  readProtectedRoutingManifest,
  routeReadback,
  resolveNotificationRoute,
  validateProtectedPathMetadata,
  validateIncidentDeliveryBindings,
  validateRoutingManifest,
} from '../../src/watchdog/routing.js'

const target = (to) => ({ channel: 'feishu', to })
const manifest = {
  version: 1,
  canonicalOpsTarget: target('ops'),
  ownerTargets: { agt_a: target('owner-a') },
  jobFailureTargets: { 'job.logical': target('job-failure') },
}
const job = { id: 'job-a', agentId: 'agt_a', logicalKey: 'job.logical', delivery: target('business') }

test('T12 the three route classes resolve only through their accepted precedence', () => {
  assert.equal(resolveNotificationRoute({ routeClass: ROUTE_CLASSES.BUSINESS_OUTPUT, job, manifest }).route.to, 'business')
  assert.equal(resolveNotificationRoute({ routeClass: ROUTE_CLASSES.JOB_FAILURE, job, manifest }).route.to, 'job-failure')
  assert.equal(resolveNotificationRoute({ routeClass: ROUTE_CLASSES.SCHEDULER_CONTROL_PLANE_INCIDENT, job, manifest }).route.to, 'ops')

  const ownerOnly = { ...manifest, jobFailureTargets: {} }
  assert.equal(resolveNotificationRoute({ routeClass: ROUTE_CLASSES.JOB_FAILURE, job, manifest: ownerOnly }).route.to, 'owner-a')
})

test('persisted control-plane binding must match canonical ops target and routing generation', () => {
  const intent = { notificationKey: 'a'.repeat(64), routeClass: ROUTE_CLASSES.SCHEDULER_CONTROL_PLANE_INCIDENT,
    incident: {}, deliveryBinding: { route: target('ops'), routeSource: 'canonicalOpsTarget', routingSha256: 'b'.repeat(64) } }
  const state = { outbox: { [intent.notificationKey]: intent } }
  assert.equal(validateIncidentDeliveryBindings(state, { manifest, jobs: [], routingSha256: 'b'.repeat(64), nowMs: 1 }), true)
  intent.deliveryBinding.route = target('daily-thought-agent-group')
  assert.throws(() => validateIncidentDeliveryBindings(state, { manifest, jobs: [], routingSha256: 'b'.repeat(64), nowMs: 1 }), /routing authority mismatch/)
})

test('T30 protected manifest reader uses no-follow identity checks and returns secret-safe provenance', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'routing-manifest-'))
  await chmod(dir, 0o700)
  const path = join(dir, 'routing.json')
  await writeFile(path, JSON.stringify(manifest), { mode: 0o600 })
  const uid = process.getuid()
  const gid = process.getgid()
  const loaded = readProtectedRoutingManifest(path, { expectedUid: uid, allowedGids: [gid], maxMode: 0o600, parentBoundary: dir })
  assert.deepEqual(loaded.manifest, manifest)
  assert.equal(loaded.readback.valid, true)
  assert.doesNotMatch(JSON.stringify(loaded.readback), /owner-a|job-failure|"ops"/)

  await chmod(path, 0o644)
  assert.throws(() => readProtectedRoutingManifest(path, { expectedUid: uid, allowedGids: [gid], maxMode: 0o600, parentBoundary: dir }), /unsafe protected path/)
  const link = join(dir, 'routing-link.json')
  await symlink(path, link)
  assert.throws(() => readProtectedRoutingManifest(link, { expectedUid: uid, allowedGids: [gid], maxMode: 0o644, parentBoundary: dir }), /unsafe protected path/)
})

test('T13 missing Job/owner target falls to canonical ops with durable marker, never job.delivery/session', () => {
  const result = resolveNotificationRoute({
    routeClass: ROUTE_CLASSES.JOB_FAILURE,
    job: { ...job, agentId: 'agt_missing', logicalKey: 'missing' },
    manifest,
    currentChat: 'forbidden',
    lastActiveSession: 'forbidden',
  })
  assert.equal(result.route.to, 'ops')
  assert.equal(result.alertTargetMissing, true)
  assert.notEqual(result.route.to, job.delivery.to)
})

test('T14 missing canonical ops route fails loud into local sink without forbidden fallback', () => {
  const invalid = { ...manifest, canonicalOpsTarget: null }
  const result = resolveNotificationRoute({
    routeClass: ROUTE_CLASSES.SCHEDULER_CONTROL_PLANE_INCIDENT,
    job,
    manifest: invalid,
  })
  assert.equal(result.route, null)
  assert.equal(result.configDegraded, true)
  assert.equal(result.localOpsSinkRequired, true)
  assert.equal(result.delivery, 'FAILED')
})

test('T30 manifest schema is closed and rejects unsupported/empty/unknown routing data', () => {
  assert.deepEqual(validateRoutingManifest(manifest), manifest)
  assert.throws(() => validateRoutingManifest({ ...manifest, version: 2 }), /version/)
  assert.throws(() => validateRoutingManifest({ ...manifest, currentChat: 'x' }), /unknown field/)
  assert.throws(() => validateRoutingManifest({ ...manifest, canonicalOpsTarget: target('') }), /non-empty/)
  assert.throws(() => validateRoutingManifest({ ...manifest, ownerTargets: { ' agt_a ': target('x'), agt_a: target('y') } }), /duplicate normalized/)
})

test('T30 protected route/incident paths fail closed for symlink, mode, owner, parent write, ACL', () => {
  const safe = { type: 'file', symlink: false, uid: 501, gid: 20, mode: 0o640, extendedAcl: false }
  assert.equal(validateProtectedPathMetadata({ file: safe, parents: [{ type: 'directory', mode: 0o755, extendedAcl: false }], expectedUid: 501, allowedGids: [20], maxMode: 0o640 }), true)
  for (const file of [
    { ...safe, symlink: true }, { ...safe, mode: 0o644 }, { ...safe, uid: 0 }, { ...safe, extendedAcl: true }, { ...safe, type: 'directory' },
  ]) assert.throws(() => validateProtectedPathMetadata({ file, parents: [], expectedUid: 501, allowedGids: [20], maxMode: 0o640 }), /unsafe protected path/)
  assert.throws(() => validateProtectedPathMetadata({ file: safe, parents: [{ type: 'directory', mode: 0o777 }], expectedUid: 501, allowedGids: [20], maxMode: 0o640 }), /unsafe protected path/)
})

test('T16/T30 routing readback is secret-safe and contains provenance only', () => {
  const result = routeReadback({ path: '/protected/routes.json', sha256: 'abc', valid: true, manifest })
  assert.deepEqual(result, { path: '/protected/routes.json', sha256: 'abc', valid: true, version: 1, canonicalOpsConfigured: true, ownerTargetCount: 1, jobFailureTargetCount: 1 })
  assert.doesNotMatch(JSON.stringify(result), /ops|owner-a|job-failure/)
})
